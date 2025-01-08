use in_str::in_str;
use whitehole::{
  action::{Action, Input},
  combinator::{eat, next},
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

fn search<'text>(
  entry: &dyn Action<Value = WithRange<JsonToken>>,
  line: &'text str,
  column: usize,
) -> Option<&'text str> {
  let mut parser = Builder::new().entry(entry).build(line);

  while let Some(output) = parser.parse() {
    // check if the matched content already beyond the cursor
    // TODO: accumulate chars instead of counting every time
    let start = line[..output.value.range.start].chars().count();
    if start > column {
      break; // already beyond the cursor, early stop
    }

    // ignore non-string tokens
    if output.value.data != JsonToken::String {
      continue;
    }

    // check if the cursor is in the matched string
    let content = &line[output.value.range];
    let end = start + content.chars().count();
    if end <= column {
      continue; // not in the matched string, continue
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
    (escape | non_escape)
      * (
        ..,
        || {},
        |v, _acc, input: Input<&mut (), &mut String>| match v {
          CharOrByteRange::Char(c) => input.heap.push(c),
          CharOrByteRange::ByteRange(r) => input.heap.push_str(&input.instant().text()[r]),
        },
      )
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
  eval: Box<dyn Action<(), String, Value = ()>>,
}

impl JsonStrParser {
  pub fn new() -> Self {
    Self {
      search: create_search_entry(),
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
