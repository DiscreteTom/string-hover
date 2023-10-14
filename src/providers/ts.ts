import * as vscode from "vscode";
import { Lexer } from "retsac";
import { config } from "../config";

const lexer = new Lexer.Builder()
  .ignore(
    // first, ignore comments
    Lexer.comment("//"),
    Lexer.comment("/*", "*/"),
    // then, ignore all non-string-beginning-or-slash chars in one token
    /[^"'`\/]+/,
    // then, ignore non-comment slash
    /\//
    // now the rest must starts with a string
  )
  .define({
    string: [
      Lexer.stringLiteral(`"`),
      Lexer.stringLiteral(`'`),
      // TODO: support interpolation in template string
      Lexer.stringLiteral("`", { multiline: true }),
    ],
  })
  .build({ debug: config.debug });

export function tsStringParser(
  document: vscode.TextDocument,
  position: vscode.Position,
  cancel: vscode.CancellationToken
) {
  // we have to get the whole document because multi-line string is allowed
  const text = document.getText();
  const offset = document.offsetAt(position);

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
      token.start <= offset &&
      token.start + token.content.length >= offset
    ) {
      // got a string token, and the position is in the token

      // don't show hover if the string is not escaped and no newline in it
      if (
        token.content.indexOf("\\") === -1 &&
        token.content.indexOf("\n") === -1
      ) {
        if (config.debug) {
          console.log(`got simple: ${token.content}`);
        }
        return;
      }

      return token.content;
    }

    // perf: if current token's end is after the position, no need to continue
    if (token.start + token.content.length > offset) {
      return;
    }

    // else, got token but not string, continue
  }
}
