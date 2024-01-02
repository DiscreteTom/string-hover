import * as vscode from "vscode";
import { expectHoverEqual } from "../helper";
import type { IStringParser } from "../../../model";

// ref: https://www.json.org/json-en.html

export function runJsonTests(parser: IStringParser) {
  const pos = new vscode.Position(0, 0);

  test("simple string", () => {
    expectHoverEqual(parser, pos, undefined, `"123"`);
  });

  test("invalid char", () => {
    expectHoverEqual(parser, pos, "1\x19\n", `"1\x19\\n"`);
  });

  test("string with escape", () => {
    expectHoverEqual(parser, pos, '1"23', `"1\\"23"`);
    expectHoverEqual(parser, pos, "1\\23", `"1\\\\23"`);
    expectHoverEqual(parser, pos, "1/23", `"1\\/23"`);
    expectHoverEqual(parser, pos, "1\b23", `"1\\b23"`);
    expectHoverEqual(parser, pos, "1\f23", `"1\\f23"`);
    expectHoverEqual(parser, pos, "1\n23", `"1\\n23"`);
    expectHoverEqual(parser, pos, "1\r23", `"1\\r23"`);
    expectHoverEqual(parser, pos, "1\t23", `"1\\t23"`);
    expectHoverEqual(parser, pos, "1\u123423", `"1\\u123423"`);
  });

  suite("bad escape", () => {
    test("unicode", () => {
      expectHoverEqual(parser, pos, "1zzzz", `"1\\uzzzz"`);
    });

    test("unnecessary", () => {
      expectHoverEqual(parser, pos, "1a23", `"1\\a23"`);
    });

    test("unterminated", () => {
      expectHoverEqual(parser, pos, "1\\", `"1\\`);
    });
  });

  suite("unclosed string", () => {
    test("end of input", () => {
      expectHoverEqual(parser, pos, "1\n", `"1\\n`);
    });

    test("end of line", () => {
      expectHoverEqual(parser, pos, "1\n", `"1\\n\n`);
    });

    test("end of line with escape", () => {
      expectHoverEqual(parser, pos, "1\\", `"1\\`);
    });

    test("escaped quote", () => {
      expectHoverEqual(parser, pos, '1"', `"1\\"`);
      expectHoverEqual(parser, pos, '1"', `"1\\"\n`);
    });
  });
}
