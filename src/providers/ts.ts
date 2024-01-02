import type * as vscode from "vscode";
import { Lexer } from "retsac";
import { config } from "../config";
import type { IStringParser } from "../model";

function buildLexer() {
  return (
    new Lexer.Builder()
      .state({
        // use braceDepthStack to calculate the depth of nested curly braces.
        // when a new template string starts, push 0 to the front of the stack.
        braceDepthStack: [0],
      })
      .ignore(
        // first, ignore comments & regex literals
        Lexer.comment("//"),
        Lexer.comment("/*", "*/"),
        Lexer.javascript.regexLiteral(),
        // then, ignore all chars except string-beginning,
        // slash (the beginning of comment & regex)
        // and curly braces (to calculate nested depth)
        // in one token (to optimize performance)
        /[^"'`/{}]+/,
        // then, ignore non-comment-or-regex slash
        /\//
        // now the rest must starts with a string's quote
        // or curly braces
      )
      .anonymous(
        (a) =>
          a
            .from(Lexer.exact("{"))
            .then(({ input }) => input.state.braceDepthStack[0]++),
        (a) =>
          a
            .from(Lexer.exact("}"))
            // reject before exec if no '{' before '}'
            .prevent((input) => input.state.braceDepthStack[0] === 0)
            .then(({ input }) => input.state.braceDepthStack[0]--)
      )
      // simple strings
      .define({ string: Lexer.javascript.simpleStringLiteral() })
      // template strings
      .append((a) =>
        a
          .from(Lexer.javascript.templateStringLiteralLeft())
          .kinds("string", "tempStrLeft")
          .select(({ output }) =>
            output.data.kind === "simple" ? "string" : "tempStrLeft"
          )
          .then(({ input, output }) => {
            if (output.kind === "tempStrLeft") {
              // push 0 to the front of the stack
              input.state.braceDepthStack.unshift(0);
            }
          })
      )
      .append((a) =>
        a
          .from(Lexer.javascript.templateStringLiteralRight())
          .prevent(
            (input) =>
              input.state.braceDepthStack[0] !== 0 || // brace not close
              input.state.braceDepthStack.length === 1 // not in template string
          )
          .kinds("tempStrRight", "tempStrMiddle")
          .select((ctx) =>
            ctx.output.data.kind === "middle" ? "tempStrMiddle" : "tempStrRight"
          )
          .then(({ input, output }) => {
            if (output.kind === "tempStrRight")
              // pop the stack
              input.state.braceDepthStack.shift();
          })
      )
      .build({ debug: config.debug })
  );
}

export class TsStringParser implements IStringParser {
  private lexer: ReturnType<typeof buildLexer>;

  constructor() {
    this.lexer = buildLexer();
  }

  parse(
    document: vscode.TextDocument,
    position: vscode.Position,
    cancel: vscode.CancellationToken
  ) {
    // we have to get the whole document because multi-line string is allowed in js/ts
    const text = document.getText();
    const offset = document.offsetAt(position);

    this.lexer.reset().feed(text);

    const tempStrStack = [] as NonNullable<
      ReturnType<(typeof this.lexer)["lex"]>
    >[][];
    /**
     * `undefined` if the hover is not in a template string.
     * Otherwise, it's the index of the template string in `tempStrStack`.
     */
    let targetTempStrIndex: number | undefined = undefined;
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

      // if simple string or simple template string(no interpolation)
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

        return token.data.value;
      }

      // if the hover is in a template string, set targetTempStrIndex
      if (
        ["tempStrLeft", "tempStrMiddle", "tempStrRight"].includes(token.kind) &&
        token.start <= offset &&
        offset <= token.start + token.content.length
      ) {
        targetTempStrIndex =
          token.kind === "tempStrLeft"
            ? tempStrStack.length
            : tempStrStack.length - 1;
        if (config.debug) {
          console.log(`set target temp string index: ${targetTempStrIndex}`);
        }
      }

      if (token.kind === "tempStrLeft") {
        tempStrStack.push([token]);
      } else if (token.kind === "tempStrMiddle") {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        tempStrStack.at(-1)!.push(token);
      } else if (token.kind === "tempStrRight") {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const tokens = tempStrStack.pop()!;
        tokens.push(token);
        const unclosed = token.data.invalid?.unclosed;
        if (targetTempStrIndex === tempStrStack.length) {
          // got the target template string, calculate string value
          const quoted = tokens.map((t) => t.content).join("...");
          return Lexer.javascript.evalString(unclosed ? quoted + "`" : quoted);
        }
      }

      // perf: if current token's end is after the position, no need to continue.
      // make sure current token is a simple string, and not in a temp string
      // otherwise the hover target may be the tempStrMiddle/tempStrRight which is after the position
      if (
        token.kind === "string" &&
        tempStrStack.length === 0 &&
        token.start + token.content.length > offset
      ) {
        return;
      }

      // else, got token but not string, continue
    }
  }
}
