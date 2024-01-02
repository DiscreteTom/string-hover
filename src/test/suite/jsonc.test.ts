import * as vscode from "vscode";
import { expectHoverEqual } from "./helper";
import { JsoncStringParser } from "../../providers/jsonc";

suite("JSON with comments", () => {
  test("simple string", () => {
    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 0),
      undefined,
      `"123"`
    );
  });

  test("invalid char", () => {
    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 0),
      "1\x19\n",
      `"1\x19\\n"`
    );
  });

  test("string with escape", () => {
    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 0),
      '1"23',
      `"1\\"23"`
    );

    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 0),
      "1\\23",
      `"1\\\\23"`
    );

    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 0),
      "1/23",
      `"1\\/23"`
    );

    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 0),
      "1\b23",
      `"1\\b23"`
    );

    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 0),
      "1\f23",
      `"1\\f23"`
    );

    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 0),
      "1\n23",
      `"1\\n23"`
    );

    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 0),
      "1\r23",
      `"1\\r23"`
    );

    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 0),
      "1\t23",
      `"1\\t23"`
    );

    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 0),
      "1\u123423",
      `"1\\u123423"`
    );
  });

  suite("bad escape", () => {
    test("unicode", () => {
      expectHoverEqual(
        new JsoncStringParser(),
        new vscode.Position(0, 0),
        "1zzzz",
        `"1\\uzzzz"`
      );
    });

    test("unnecessary", () => {
      expectHoverEqual(
        new JsoncStringParser(),
        new vscode.Position(0, 0),
        "1a23",
        `"1\\a23"`
      );
    });

    test("unterminated", () => {
      expectHoverEqual(
        new JsoncStringParser(),
        new vscode.Position(0, 0),
        "1\\",
        `"1\\`
      );
    });
  });

  test("string after comments", () => {
    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 5),
      "1\n23",
      `/**/"1\\n23"`
    );
    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(1, 0),
      "1\n23",
      `//\n"1\\n23"`
    );
  });

  test("string in comments", () => {
    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 3),
      undefined,
      `/*"1\\n23"*/`
    );
    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 3),
      undefined,
      `//"1\\n23"`
    );
  });

  suite("unclosed string", () => {
    test("end of input", () => {
      expectHoverEqual(
        new JsoncStringParser(),
        new vscode.Position(0, 0),
        "1\n",
        `"1\\n`
      );
    });

    test("end of line", () => {
      expectHoverEqual(
        new JsoncStringParser(),
        new vscode.Position(0, 0),
        "1\n",
        `"1\\n\n`
      );
    });

    test("end of line with escape", () => {
      expectHoverEqual(
        new JsoncStringParser(),
        new vscode.Position(0, 0),
        "1\\",
        `"1\\`
      );
    });

    test("escaped quote", () => {
      expectHoverEqual(
        new JsoncStringParser(),
        new vscode.Position(0, 0),
        '1"',
        `"1\\"`
      );

      expectHoverEqual(
        new JsoncStringParser(),
        new vscode.Position(0, 0),
        '1"',
        `"1\\"\n`
      );
    });
  });
});
