import * as vscode from "vscode";
import { Lexer } from "retsac";
import { config } from "../config";
import type { IStringParser } from "../model";

function buildLexer() {
  return new Lexer.Builder()
    .ignore(
      Lexer.comment("//"),
      Lexer.comment("/*", "*/"),
      // perf: ignore all non-string-beginning-or-slash chars in one token
      /[^"/]+/
    )
    .define({ string: Lexer.json.stringLiteral() })
    .build({ debug: config.debug });
}

export class JsoncStringParser implements IStringParser {
  private lexer: ReturnType<typeof buildLexer>;

  constructor() {
    this.lexer = buildLexer();
  }

  parse(
    document: vscode.TextDocument,
    position: vscode.Position,
    cancel: vscode.CancellationToken
  ) {
    // perf: only get from the document's start to the current line's end
    // since JSON with comments doesn't allow multi-line string.
    // we can't only get the current line because the line maybe in a comment.
    const text = document.getText(new vscode.Range(0, 0, position.line + 1, 0));
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
        token.kind === "string" &&
        token.start <= offset &&
        token.start + token.content.length >= offset
      ) {
        // got a string token, and the position is in the token

        // don't show hover if the string is not escaped
        if (token.data.escapes.length === 0) {
          if (config.debug) {
            console.log(`got simple: ${token.content}`);
          }
          return;
        }

        return token.data.value;
      }

      // perf: if current token's end is after the position, no need to continue
      if (token.start + token.content.length > offset) {
        return;
      }

      // else, got token but not string, continue
    }
  }
}
