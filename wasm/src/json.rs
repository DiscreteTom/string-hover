use in_str::in_str;
use whitehole::{
  combinator::{eat, next},
  parser::Builder,
  range::{Range, WithRange},
  C,
};

use crate::log;

#[derive(Clone, PartialEq, Eq, Debug)]
enum JsonToken {
  String,
  Others,
}

fn create_entry() -> C!(WithRange<JsonToken>) {
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

  (others | string).range()
}

fn search(entry: C!(WithRange<JsonToken>), line: &str, column: usize) -> Option<&str> {
  let mut parser = Builder::new().entry(entry).build(line);

  while let Some(output) = parser.parse() {
    // ignore non-string tokens
    if output.value.data != JsonToken::String {
      continue;
    }

    // check if the matched string beyond the cursor
    let start = line[..output.value.range.start].chars().count();
    if start > column {
      break; // already beyond the cursor, early stop
    }

    // check if the cursor is in the matched string
    let content = &line[output.value.range];
    let end = start + content.chars().count();
    if end < column {
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

fn create_eval() -> C!(Vec<CharOrByteRange>) {
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
        || vec![], // TODO: optimize this, prevent vec or place in heap?
        |v, mut acc, _| {
          acc.push(v);
          acc
        },
      )
  }
  .tuple();

  { eat('"') + body_optional + '"' }.map(|(v,)| v)
}

fn eval(entry: C!(Vec<CharOrByteRange>), content: &str) -> String {
  let mut parser = Builder::new().entry(entry).build(content);
  let mut s = String::new();

  for v in parser.parse().unwrap().value {
    match v {
      CharOrByteRange::Char(c) => s.push(c),
      CharOrByteRange::ByteRange(r) => s.push_str(&content[r]),
    }
  }

  s
}

pub fn parse_json_str_at(line: &str, column: usize) -> Option<String> {
  // TODO: reuse entry instead of creating it every time
  Some(eval(create_eval(), search(create_entry(), line, column)?))
}
