import * as vscode from "vscode";
import { Lexer } from "retsac";
import { config } from "../config";

const lexer = new Lexer.Builder()
  // perf: ignore all non-string-beginning chars in one token
  // since JSON doesn't allow multi-line string & comments
  .ignore(/[^"]+/)
  .define({ string: Lexer.stringLiteral(`"`) })
  .build({ debug: config.debug });

export function jsonStringParser(
  document: vscode.TextDocument,
  position: vscode.Position,
  cancel: vscode.CancellationToken
) {
  // perf: only get the current line
  // since JSON doesn't allow multi-line string & comments
  const text = document.getText(
    new vscode.Range(position.line, 0, position.line + 1, 0)
  );

  lexer.reset().feed(text);

  while (true) {
    // just return if cancellation is requested
    if (cancel.isCancellationRequested) {
      return;
    }

    const token = lexer.lex();

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
      if (token.content.indexOf("\\") === -1) {
        if (config.debug) {
          console.log(`got unescaped string: ${token.content}}`);
        }
        return;
      }

      return token.content;
    }

    // perf: if current token's end is after the position, no need to continue
    if (token.start + token.content.length > position.character) {
      return;
    }

    // else, got token but not string, continue
  }
}
