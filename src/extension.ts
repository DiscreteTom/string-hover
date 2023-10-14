import * as vscode from "vscode";
import { Lexer } from "retsac";
import { escapeMarkdownCodeBlock } from "./utils";

const debug = process.env.VSCODE_DEBUG_MODE === "true";

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({
    string: Lexer.stringLiteral(`"`), // double quote string literal
    number: /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  })
  .define(Lexer.wordKind("true", "false", "null")) // type's name is the literal value
  .anonymous(Lexer.exact(..."[]{},:")) // single char borders
  .build({ debug });

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerHoverProvider("json", {
      provideHover(document, position, token) {
        const text = document.getText();
        const offset = document.offsetAt(position);

        if (debug) {
          console.log(`offset: ${offset}`);
        }

        lexer.reset().feed(text);

        // perf: jump to the start of the target line, instead of lexing the whole file
        // since JSON doesn't allow multi-line string
        const lineStartOffset = document.offsetAt(
          new vscode.Position(position.line, 0)
        );
        if (lineStartOffset > 0) {
          lexer.take(lineStartOffset);
          if (debug) {
            console.log(`lineStartOffset: ${lineStartOffset}`);
          }
        }

        while (true) {
          const token = lexer.lex();
          if (token === null) {
            break;
          }

          if (debug) {
            console.log(token);
          }

          if (
            token.kind === "string" &&
            token.start <= offset &&
            token.start + token.content.length >= offset
          ) {
            // don't show hover if the string is not escaped
            if (token.content.indexOf("\\") === -1) {
              if (debug) {
                console.log(`unescaped string: ${token.content}}`);
              }
              return;
            }

            // the markdown result
            const md = escapeMarkdownCodeBlock(token.content);

            if (debug) {
              console.log(md);
            }

            return {
              contents: [md],
            };
          }
        }
      },
    })
  );
}

export function deactivate() {}
