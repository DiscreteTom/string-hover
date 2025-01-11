use in_str::in_str;
use whitehole::{
  action::{Action, Input},
  combinator::{eat, next, till},
  parser::Builder,
  range::{Range, WithRange},
};

#[derive(Clone, PartialEq, Eq, Debug)]
enum JsonToken {
  String,
  Others,
}

fn create_search_entry() -> Box<dyn Action<Value = WithRange<JsonToken>>> {
  // perf: ignore all non-string-beginning chars in one token
  // since JSON doesn't allow multi-line string & comments
  let others = (next(|c| c != '"') * (1..)).bind(JsonToken::Others);

  // TODO: error handling for string
  let string = {
    let escape = {
      let simple = next(in_str!("\"\\/bfnrt"));
      let hex = eat('u') + next(|c| c.is_ascii_hexdigit()) * 4;
      eat('\\') + (simple | hex)
    };
    let non_escape =
      next(|c| c != '"' && c != '\\' && matches!(c, '\u{0020}'..='\u{10ffff}')) * (1..);
    let body_optional = (escape | non_escape) * ..;
    eat('"') + body_optional + '"'
  }
  .bind(JsonToken::String);

  let entry = (others | string).range();

  Box::new(entry)
}

// TODO: error handling
fn create_search_entry_jsonc() -> Box<dyn Action<Value = WithRange<JsonToken>>> {
  let others = {
    // perf: ignore all non-comments-nor-string chars in one token
    let non_comments_nor_string = next(|c| c != '"' && c != '/') * (1..);

    let comments = {
      let single_line = eat("//") + (till('\n') | till(()));
      let multi_line = eat("/*") + (till("*/") | till(()));
      single_line | multi_line
    };

    non_comments_nor_string | comments
  }
  .bind(JsonToken::Others);

  // TODO: merge dup code
  let string = {
    let escape = {
      let simple = next(in_str!("\"\\/bfnrt"));
      let hex = eat('u') + next(|c| c.is_ascii_hexdigit()) * 4;
      eat('\\') + (simple | hex)
    };
    let non_escape =
      next(|c| c != '"' && c != '\\' && matches!(c, '\u{0020}'..='\u{10ffff}')) * (1..);
    let body_optional = (escape | non_escape) * ..;
    eat('"') + body_optional + '"'
  }
  .bind(JsonToken::String);

  let entry = (others | string).range();

  Box::new(entry)
}

fn search<'text>(
  entry: &dyn Action<Value = WithRange<JsonToken>>,
  text: &'text str,
  offset: usize,
) -> Option<&'text str> {
  let mut parser = Builder::new().entry(entry).build(text);

  let mut parsed_chars = 0;
  while let Some(output) = parser.parse() {
    // update parsed chars
    let start = parsed_chars;
    let content = &text[output.value.range];
    parsed_chars = start + content.chars().count();

    // ignore non-string tokens
    if output.value.data != JsonToken::String {
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

enum CharOrByteRange {
  Char(char),
  ByteRange(Range),
}

fn create_eval_entry() -> Box<dyn Action<(), String, Value = ()>> {
  let escape = {
    let simple = {
      eat('"').bind('"')
        | eat('\\').bind('\\')
        | eat('/').bind('/')
        | eat('b').bind('\u{0008}')
        | eat('f').bind('\u{000c}')
        | eat('n').bind('\n')
        | eat('r').bind('\r')
        | eat('t').bind('\t')
    }
    .tuple();

    let hex = eat('u') + { next(|c| c.is_ascii_hexdigit()) * 4 }
      .select(|ctx| char::from_u32(u32::from_str_radix(ctx.content(), 16).unwrap()).unwrap())
      .tuple();

    eat('\\') + (simple | hex)
  }
  .map(|(c,)| CharOrByteRange::Char(c));

  let non_escape =
    { next(|c| c != '"' && c != '\\' && matches!(c, '\u{0020}'..='\u{10ffff}')) * (1..) }
      .select(|ctx| CharOrByteRange::ByteRange(ctx.range()));

  let body_optional = {
    (escape | non_escape).fold(
      || {},
      |v, _acc, input: Input<_, &mut String>| match v {
        CharOrByteRange::Char(c) => input.heap.push(c),
        CharOrByteRange::ByteRange(r) => input.heap.push_str(&input.instant().text()[r]),
      },
    ) * (..)
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

  pub fn parse(&self, line: &str, column: usize) -> Option<String> {
    let content = search(&self.search, line, column)?;
    Some(eval(
      &self.eval,
      content,
      String::with_capacity(content.len()),
    ))
  }

  pub fn parse_jsonc(&self, text: &str, offset: usize) -> Option<String> {
    // TODO: remove dup code
    let content = search(&self.search_jsonc, text, offset)?;
    Some(eval(
      &self.eval,
      content,
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
      parser.parse(r#"{"key": "value"}"#, 8),
      Some("value".to_string())
    );
    assert_eq!(
      parser.parse(r#"{"key": "value"}"#, 14),
      Some("value".to_string())
    );
    assert_eq!(parser.parse(r#"{"key": "value"}"#, 15), None);
  }
}
