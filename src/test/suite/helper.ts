import * as vscode from "vscode";
import type { IStringParser } from "../../model";
import * as assert from "assert";

export function expectHoverEqual(
  parser: IStringParser,
  pos: vscode.Position,
  expected: string | undefined,
  text: string
) {
  assert.equal(
    parser.parse(
      mockTextDocument(text),
      pos,
      new vscode.CancellationTokenSource().token
    ),
    expected
  );
}

function mockTextDocument(text: string): vscode.TextDocument {
  const lines = text
    .split("\n")
    .map((line, i, arr) => (i === arr.length - 1 ? line : line + "\n"));

  const mock = {
    eol: vscode.EndOfLine.LF,
    fileName: "",
    getText: (range?: vscode.Range | undefined) => {
      if (range === undefined) {
        return text;
      }

      const adjusted = mock.validateRange(range);

      if (adjusted.start.line === adjusted.end.line) {
        return lines[adjusted.start.line].slice(
          adjusted.start.character,
          adjusted.end.character + 1
        );
      }
      const res = [lines[adjusted.start.line].slice(adjusted.start.character)];
      for (let i = adjusted.start.line + 1; i < adjusted.end.line; i++) {
        res.push(lines[i]);
      }
      res.push(lines[adjusted.end.line].slice(0, adjusted.end.character + 1));
      return res.join("");
    },
    getWordRangeAtPosition: (
      _position: vscode.Position,
      _regex?: RegExp | undefined
    ) => undefined,
    isClosed: false,
    isDirty: false,
    isUntitled: false,
    languageId: "",
    lineAt: (pos: number | vscode.Position) => {
      const line = typeof pos === "number" ? pos : pos.line;
      return {
        firstNonWhitespaceCharacterIndex: lines[line].search(/\S/),
        isEmptyOrWhitespace: lines[line].search(/\S/) === -1,
        lineNumber: line,
        range: new vscode.Range(
          line,
          0,
          line,
          lines[line].at(-1) === "\n"
            ? lines[line].length - 2
            : lines[line].length - 1
        ),
        rangeIncludingLineBreak: new vscode.Range(
          line,
          0,
          line,
          lines[line].length - 1
        ),
        text:
          lines[line].at(-1) === "\n" ? lines[line].slice(0, -1) : lines[line],
      };
    },
    lineCount: lines.length,
    offsetAt: (position: vscode.Position) => {
      let res = 0;
      for (let i = 0; i < position.line; i++) {
        res += lines[i].length;
      }
      res += position.character;
      return res;
    },
    positionAt: (offset: number) => {
      let line = 0;
      while (offset > lines[line].length) {
        offset -= lines[line].length;
        line++;
      }
      return new vscode.Position(line, offset);
    },
    save: () => Promise.resolve(true),
    uri: vscode.Uri.parse(""),
    validatePosition: (position: vscode.Position) => {
      if (position.line < 0) {
        // line underflow, return 0, 0
        return new vscode.Position(0, 0);
      }
      if (position.line > lines.length - 1) {
        // line overflow, return last line, last char
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return new vscode.Position(lines.length - 1, lines.at(-1)!.length - 1);
      }

      // else, line in range, clamp character
      return new vscode.Position(
        position.line,
        Math.max(
          Math.min(position.character, lines[position.line].length - 1),
          0
        )
      );
    },
    validateRange: (range: vscode.Range) => {
      return new vscode.Range(
        mock.validatePosition(range.start),
        mock.validatePosition(range.end)
      );
    },
    version: 0,
  };

  return mock;
}
