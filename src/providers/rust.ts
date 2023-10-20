import * as vscode from "vscode";
import { Lexer } from "retsac";
import { config } from "../config";
import { IStringParser } from "../model";

export class RustStringParser implements IStringParser {
  private lexer: Lexer.Lexer<string, "" | "string" | "char" | "raw", never>;

  constructor() {
    this.lexer = new Lexer.Builder()
      .ignore(/[^'"\/r]+/, Lexer.comment("//"), Lexer.comment("/*", "*/"), /\//)
      // https://doc.rust-lang.org/reference/tokens.html#character-and-string-literals
      .define({
        // including byte literals
        char: /'(?:[^'\\\n\r\t]|\\(?:'|"|\\|n|r|t|0|x(?:[0-9a-fA-F]{2})|u\{[0-9a-fA-F]{1,6}\}))'/,
        string:
          /"(?:[^"\\]|\\(?:"|'|\\|n|r|t|0|x(?:[0-9a-fA-F]{2})|u\{[0-9a-fA-F]{1,6}\}|\n))*"/,
        raw: Lexer.Action.from((input) => {
          // consume raw string start
          const start = /r#*"/y;
          start.lastIndex = input.start;
          const startRes = start.exec(input.buffer);
          if (startRes === null) {
            // raw string not found
            return 0;
          }
          const bangs = startRes[0].length - 2; // num of '#'s, 2 is for 'r' and '"'

          // consume raw string content
          const content = /[^"]*/y;
          content.lastIndex = start.lastIndex;
          const contentRes = content.exec(input.buffer);

          if (config.debug) {
            console.log(`raw string content: ${contentRes?.[0]}`);
          }

          // consume raw string end
          const end = new RegExp(`"#{${bangs}}`, "y");
          end.lastIndex = start.lastIndex + (contentRes?.[0].length ?? 0);
          const endRes = end.exec(input.buffer);
          if (endRes === null) {
            // unclosed string, accept all rest
            return input.buffer.length - input.start;
          } else {
            // raw string found
            return end.lastIndex - input.start;
          }
        }),
      })
      .ignore(/r/)
      .build({ debug: config.debug });
  }

  parse(
    document: vscode.TextDocument,
    position: vscode.Position,
    cancel: vscode.CancellationToken
  ) {
    // we have to get the whole document because multi-line string is allowed
    const text = document.getText();
    const offset = document.offsetAt(position);

    this.lexer.reset().feed(text);

    while (true) {
      // just return if cancellation is requested
      if (cancel.isCancellationRequested) {
        return;
      }

      const token = this.lexer.lex();

      if (token === null) {
        // no more tokens
        return;
      }

      if (
        (token.kind === "string" ||
          token.kind === "char" ||
          token.kind === "raw") &&
        token.start <= offset &&
        token.start + token.content.length >= offset
      ) {
        // got a string token, and the position is in the token

        // don't show hover if the string is not escaped or multiline
        if (
          token.content.indexOf("\\") === -1 &&
          token.content.indexOf("\n") === -1
        ) {
          if (config.debug) {
            console.log(`got unescaped string: ${token.content}`);
          }
          return;
        }

        if (token.kind !== "raw") {
          return evalRustString(token.content);
        } else {
          // raw string, remove the prefix and suffix
          const start = /^r#*"/;
          const res = start.exec(token.content)!;
          return token.content.slice(res[0].length, -(res[0].length - 1));
        }
      }

      // perf: if current token's end is after the position, no need to continue
      if (token.start + token.content.length > offset) {
        return;
      }

      // else, got token but not string, continue
    }
  }
}

function evalRustString(quoted: string) {
  // remove quotes
  const quote = quoted[0];
  const unquoted = quoted.slice(
    // remove the first quote
    1,
    // the string might be un-closed, so the last char might not be the quote.
    quoted.at(-1) === quote ? -1 : undefined
  );

  // IMPORTANT! all escaped chars should be searched simultaneously!
  // e.g. you should NOT search `\\` first then search `\n`
  return unquoted.replace(
    /(\\0|\\'|\\"|\\n|\\\\|\\r|\\t|\\\n|\\x([0-9a-fA-F]{2})|\\u\{([0-9a-fA-F]{1,6})\})/g,
    (match) => {
      if (match === `\\0`) {
        return "\0";
      } else if (match === `\\'`) {
        return "'";
      } else if (match === `\\"`) {
        return '"';
      } else if (match === `\\n`) {
        return "\n";
      } else if (match === `\\\\`) {
        return "\\";
      } else if (match === `\\r`) {
        return "\r";
      } else if (match === `\\t`) {
        return "\t";
      } else if (match === `\\\n`) {
        return "";
      } else if (match.startsWith("\\x")) {
        return String.fromCharCode(parseInt(match.slice(2), 16));
      } else {
        // match.startsWith("\\u")
        return String.fromCharCode(parseInt(match.slice(3, -1), 16));
      }
    }
  );
}
