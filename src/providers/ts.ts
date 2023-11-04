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
        Lexer.comment("/*", "*/")
      )
      .ignore(
        Lexer.javascript.regexLiteral(),
        // then, ignore all chars except string-beginning,
        // slash (the beginning of comment & regex)
        // and curly braces (to calculate nested depth)
        // in one token (to optimize performance)
        /[^"'`/{}]+/,
        // then, ignore non-comment-or-regex slash
        /\//
        // now the rest must starts with a string
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
            // reject if no '{' before '}'
            .reject(({ input }) => input.state.braceDepthStack[0] === 0)
            .then(({ input }) => input.state.braceDepthStack[0]--)
      )
      // simple strings
      .define({ string: [Lexer.stringLiteral(`"`), Lexer.stringLiteral(`'`)] })
      // template strings
      .define(
        // TODO: https://github.com/DiscreteTom/retsac/issues/28
        {
          string: (a) =>
            a
              .from(/`(?:\\.|[^\\`$])*(?:\$\{|`|$)/)
              // reject if ends with '${'
              .reject(({ output }) => output.content.endsWith("${"))
              .data(({ output }) => ({
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                unclosed: !output.content.split(/\\./).at(-1)!.endsWith("`"),
              })),
        }
      )
      .define({
        tempStrLeft: (a) =>
          a
            .from(/`(?:\\.|[^\\`$])*(?:\$\{|`|$)/)
            // reject if not ends with '${'
            .reject(({ output }) => !output.content.endsWith("${"))
            .then(({ input }) => input.state.braceDepthStack.unshift(0)),
      })
      .define({
        tempStrRight: (a) =>
          a
            .from(/\}(?:\\.|[^\\`$])*(?:\$\{|`|$)/)
            .reject(
              ({ output, input }) =>
                input.state.braceDepthStack[0] !== 0 || // brace not close
                input.state.braceDepthStack.length === 1 || // not in template string
                output.content.endsWith("${") // should be tempStrMiddle
            )
            .then(({ input }) => input.state.braceDepthStack.shift()),
      })
      .define({
        tempStrMiddle: (a) =>
          a
            .from(/\}(?:\\.|[^\\`$])*(?:\$\{|`|$)/)
            // reject if not in template string
            .reject(
              ({ input, output }) =>
                input.state.braceDepthStack[0] !== 0 || // brace not close
                input.state.braceDepthStack.length === 1 || // not in template string
                !output.content.endsWith("${") // should be tempStrRight
            ),
      })
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
    // we have to get the whole document because multi-line string is allowed
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

        return Lexer.javascript.evalString(
          token.data.unclosed ? token.content + token.content[0] : token.content
        );
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
        if (targetTempStrIndex === tempStrStack.length) {
          // got the target template string, calculate string value
          const quoted = tokens.map((t) => t.content).join("...");
          return Lexer.javascript.evalString(quoted); // TODO: handle unclosed
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
