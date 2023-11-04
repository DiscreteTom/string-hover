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

  test("string with escape", () => {
    expectHoverEqual(
      new JsoncStringParser(),
      new vscode.Position(0, 0),
      "1\n23",
      `"1\\n23"`
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
      '1"23',
      `"1\\"23"`
    );
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

  test("unclosed string", () => {
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
