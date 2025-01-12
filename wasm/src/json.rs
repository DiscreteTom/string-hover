use in_str::in_str;
use whitehole::{
  action::{Action, Input, Output},
  combinator::{eat, next, till, wrap, Combinator},
  parser::Builder,
  range::WithRange,
};

#[derive(Clone, PartialEq, Eq, Debug)]
enum JsonToken {
  String { escaped: bool },
  Others,
}

fn common_entry(
  others: Combinator<impl Action + 'static>,
) -> Box<dyn Action<Value = WithRange<JsonToken>>> {
  let string = {
    let body_optional = {
      let escape = {
        let simple = next(in_str!("\"\\/bfnrt"));
        let hex = eat('u') + next(|c| c.is_ascii_hexdigit()) * 4;
        eat('\\') + (simple | hex)
      };
      let non_escape =
        next(|c| c != '"' && c != '\\' && matches!(c, '\u{0020}'..='\u{10ffff}')) * (1..);

      (escape.bind(true) | non_escape.bind(false)).fold(|| false, |v, acc, _| v || acc) * ..
    };
    eat('"') + body_optional.tuple() + '"'
  }
  .pop()
  .map(|escaped| JsonToken::String { escaped });

  let entry = (others.bind(JsonToken::Others) | string).range();

  Box::new(entry)
}

fn create_search_entry() -> Box<dyn Action<Value = WithRange<JsonToken>>> {
  // perf: ignore all non-string-beginning chars in one token
  // since JSON doesn't allow multi-line string & comments
  common_entry(next(|c| c != '"') * (1..))
}

fn create_search_entry_jsonc() -> Box<dyn Action<Value = WithRange<JsonToken>>> {
  common_entry({
    // perf: ignore all non-comments-nor-string chars in one token
    let non_comments_nor_string = next(|c| c != '"' && c != '/') * (1..);

    let comments = {
      let single_line = eat("//") + (till('\n') | till(()));
      let multi_line = eat("/*") + (till("*/") | till(()));
      single_line | multi_line
    };

    non_comments_nor_string | comments
  })
}

fn search<'text>(
  entry: &dyn Action<Value = WithRange<JsonToken>>,
  text: &'text str,
  offset: usize,
  require_escape: bool,
) -> Option<&'text str> {
  let mut parser = Builder::new().entry(entry).build(text);

  let mut parsed_chars = 0;
  while let Some(output) = parser.parse() {
    // update parsed chars
    let start = parsed_chars;
    let content = &text[output.value.range];
    parsed_chars = start + content.chars().count();

    // ignore non-string tokens
    let JsonToken::String { escaped } = output.value.data else {
      continue;
    };

    // ignore non-escaped strings if require escape
    if !escaped && require_escape {
      continue;
    }

    // check if the cursor is before the matched string
    if parsed_chars <= offset {
      continue; // not in the matched string, continue
    }

    // check if the matched content already beyond the cursor
    if start > offset {
      break; // already beyond the cursor, early stop
    }

    return Some(content);
  }

  None
}

fn create_eval_entry() -> Box<dyn Action<(), String, Value = ()>> {
  let body_optional = {
    let escape = {
      let simple = {
        wrap(|input: Input<_, &mut String>| {
          input
            .instant()
            .rest()
            .chars()
            .next()
            .and_then(|c| {
              Some(match c {
                '"' | '\\' | '/' => c,
                'b' => '\u{0008}',
                'f' => '\u{000c}',
                'n' => '\n',
                'r' => '\r',
                't' => '\t',
                _ => return None,
              })
            })
            .map(|c| Output {
              digested: 1,
              value: c,
            })
        })
      };

      let hex = {
        eat('u') + { next(|c| c.is_ascii_hexdigit()) * 4 }
          .select(|ctx| char::from_u32(u32::from_str_radix(ctx.content(), 16).unwrap()).unwrap())
          .tuple()
      }
      .pop();

      eat('\\')
        + (simple | hex)
          .then(|ctx| {
            let (input, output) = ctx.split();
            (input.heap as &mut String).push(output.value);
          })
          .bind(())
    };

    let non_escape =
      { next(|c| c != '"' && c != '\\' && matches!(c, '\u{0020}'..='\u{10ffff}')) * (1..) }.then(
        |mut ctx| {
          let content = ctx.content();
          (ctx.heap() as &mut String).push_str(content)
        },
      );

    (escape | non_escape) * (..)
  }
  .prepare(|input| input.heap.clear());

  Box::new(eat('"') + body_optional + '"')
}

fn eval(entry: &dyn Action<(), String, Value = ()>, content: &str, buffer: String) -> String {
  let mut parser = Builder::new().heap(buffer).entry(entry).build(content);
  parser.parse().unwrap();
  parser.heap
}

pub struct JsonStrParser {
  search: Box<dyn Action<Value = WithRange<JsonToken>>>,
  search_jsonc: Box<dyn Action<Value = WithRange<JsonToken>>>,
  eval: Box<dyn Action<(), String, Value = ()>>,
}

impl JsonStrParser {
  pub fn new() -> Self {
    Self {
      search: create_search_entry(),
      search_jsonc: create_search_entry_jsonc(),
      eval: create_eval_entry(),
    }
  }

  pub fn parse(&self, line: &str, column: usize, require_escape: bool) -> Option<String> {
    self.parse_common(&self.search, line, column, require_escape)
  }

  pub fn parse_jsonc(&self, text: &str, offset: usize, require_escape: bool) -> Option<String> {
    self.parse_common(&self.search_jsonc, text, offset, require_escape)
  }

  fn parse_common(
    &self,
    search_entry: &dyn Action<Value = WithRange<JsonToken>>,
    text: &str,
    offset: usize,
    require_escape: bool,
  ) -> Option<String> {
    let content = search(search_entry, text, offset, require_escape)?;
    Some(eval(
      &self.eval,
      content,
      // perf: pre-allocate the buffer with a maximum possible length
      String::with_capacity(content.len()),
    ))
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_json_str_parser() {
    let parser = JsonStrParser::new();
    assert_eq!(
      parser.parse(r#"{"key": "value"}"#, 8, false),
      Some("value".to_string())
    );
    assert_eq!(
      parser.parse(r#"{"key": "value"}"#, 14, false),
      Some("value".to_string())
    );
    assert_eq!(parser.parse(r#"{"key": "value"}"#, 14, true), None);
    assert_eq!(parser.parse(r#"{"key": "value"}"#, 15, false), None);
  }
}
