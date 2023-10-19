import * as vscode from "vscode";
import { Lexer } from "retsac";
import { config } from "../config";
import { evalJsonString } from "../utils";

const lexer = new Lexer.Builder()
  .useState({
    // use braceDepthStack to calculate the depth of nested curly braces.
    // when a new template string starts, push 0 to the front of the stack.
    braceDepthStack: [0],
  })
  .ignore(
    // first, ignore comments & regex literals
    Lexer.comment("//"),
    Lexer.comment("/*", "*/"),
    Lexer.regexLiteral(),
    // then, ignore all chars except string-beginning,
    // slash (the beginning of comment & regex)
    // and curly braces (to calculate nested depth)
    // in one token (to optimize performance)
    /[^"'`\/{}]+/,
    // then, ignore non-comment-or-regex slash
    /\//
    // now the rest must starts with a string
    // or curly braces
  )
  // TODO: use Lexer.anonymous, https://github.com/DiscreteTom/retsac/issues/27
  // eslint-disable-next-line @typescript-eslint/naming-convention
  .define({ "": Lexer.exact("{") }, (a) =>
    a.then(({ input }) => input.state.braceDepthStack[0]++)
  )
  // eslint-disable-next-line @typescript-eslint/naming-convention
  .define({ "": Lexer.exact("}") }, (a) =>
    a
      // reject if no '{' before '}'
      .reject(({ input }) => input.state.braceDepthStack[0] === 0)
      .then(({ input }) => input.state.braceDepthStack[0]--)
  )
  // simple strings
  .define({ string: [Lexer.stringLiteral(`"`), Lexer.stringLiteral(`'`)] })
  // template strings
  .define(
    // TODO: https://github.com/DiscreteTom/retsac/issues/28
    { string: /`(?:\\.|[^\\`$])*(?:\$\{|`|$)/ },
    // reject if ends with '${'
    (a) => a.reject(({ output }) => output.content.endsWith("${"))
  )
  .define({ tempStrLeft: /`(?:\\.|[^\\`$])*(?:\$\{|`|$)/ }, (a) =>
    a
      // reject if not ends with '${'
      .reject(({ output }) => !output.content.endsWith("${"))
      .then(({ input }) => input.state.braceDepthStack.unshift(0))
  )
  .define({ tempStrRight: /\}(?:\\.|[^\\`$])*(\$\{|`|$)/ }, (a) =>
    a
      .reject(
        ({ output, input }) =>
          input.state.braceDepthStack[0] !== 0 || // brace not close
          input.state.braceDepthStack.length === 1 || // not in template string
          output.content.endsWith("${") // should be tempStrMiddle
      )
      .then(({ input }) => input.state.braceDepthStack.shift())
  )
  .define(
    { tempStrMiddle: /\}(?:\\.|[^\\`$])*(\$\{|`|$)/ },
    // reject if not in template string
    (a) =>
      a.reject(
        ({ input, output }) =>
          input.state.braceDepthStack[0] !== 0 || // brace not close
          input.state.braceDepthStack.length === 1 || // not in template string
          !output.content.endsWith("${") // should be tempStrRight
      )
  )
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

  const tempStrStack = [] as NonNullable<ReturnType<(typeof lexer)["lex"]>>[][];
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

    const token = lexer.lex();

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

      // remove quotes
      const quote = token.content[0];
      const unquoted = token.content.slice(
        1,
        // the string might be un-closed, so the last char might not be the quote
        token.content.endsWith(quote) ? -1 : undefined
      );

      // use double quotes to quote the string
      const doubleQuoted = '"' + unquoted.replace(/"/g, '\\"') + '"';

      // fix \n in template string
      // since newline is allowed in template string but not allowed in JSON string
      // TODO: escape \t and other escape sequences
      // TODO: move these logic into evalJsonString?
      // TODO: unescape bad-escaped char, e.g. '`'
      const escaped = doubleQuoted.replace(/\n/g, "\\n");

      // now the string should be a valid JSON string
      return evalJsonString(escaped);
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
    }

    if (token.kind === "tempStrLeft") {
      tempStrStack.push([token]);
    } else if (token.kind === "tempStrMiddle") {
      tempStrStack.at(-1)!.push(token);
    } else if (token.kind === "tempStrRight") {
      const tokens = tempStrStack.pop()!;
      tokens.push(token);
      if (targetTempStrIndex === tempStrStack.length) {
        // got the target template string, calculate string value
        const quoted = tokens.map((t) => t.content).join("...");
        const unquoted = quoted.slice(1, quoted.endsWith("`") ? -1 : undefined);
        const doubleQuoted = '"' + unquoted.replace(/"/g, '\\"') + '"';
        // fix \n in template string
        // since newline is allowed in template string but not allowed in JSON string
        const escaped = doubleQuoted.replace(/\n/g, "\\n");
        return evalJsonString(escaped);
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
