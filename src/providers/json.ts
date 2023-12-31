import type * as vscode from "vscode";
import { Lexer } from "retsac";
import { config } from "../config";
import type { IStringParser } from "../model";

function buildLexer() {
  return (
    new Lexer.Builder()
      // perf: ignore all non-string-beginning chars in one token
      // since JSON doesn't allow multi-line string & comments
      .ignore(/[^"]+/)
      .define({ string: Lexer.json.stringLiteral() })
      .build({ debug: config.debug })
  );
}

export class JsonStringParser implements IStringParser {
  private lexer: ReturnType<typeof buildLexer>;

  constructor() {
    this.lexer = buildLexer();
  }

  parse(
    document: vscode.TextDocument,
    position: vscode.Position,
    cancel: vscode.CancellationToken
  ) {
    // perf: only get the current line
    // since JSON doesn't allow multi-line string & comments
    const text = document.lineAt(position).text;

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
        token.kind === "string" &&
        token.start <= position.character &&
        token.start + token.content.length >= position.character
      ) {
        // got a string token, and the position is in the token

        // don't show hover if the string is not escaped
        if (token.data.escapes.length === 0) {
          if (config.debug) {
            console.log(`got unescaped string: ${token.content}`);
          }
          return;
        }

        return token.data.value;
      }

      // perf: if current token's end is after the position, no need to continue
      if (token.start + token.content.length > position.character) {
        return;
      }

      // else, got token but not string, continue
    }
  }
}
