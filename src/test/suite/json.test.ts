import * as vscode from "vscode";
import { expectHoverEqual } from "./helper";
import { JsonStringParser } from "../../providers/json";

suite("JSON", () => {
  test("simple string", () => {
    expectHoverEqual(
      new JsonStringParser(),
      new vscode.Position(0, 0),
      undefined,
      `"123"`
    );
  });

  test("string with escape", () => {
    expectHoverEqual(
      new JsonStringParser(),
      new vscode.Position(0, 0),
      "1\n23",
      `"1\\n23"`
    );

    expectHoverEqual(
      new JsonStringParser(),
      new vscode.Position(0, 0),
      "1\t23",
      `"1\\t23"`
    );

    expectHoverEqual(
      new JsonStringParser(),
      new vscode.Position(0, 0),
      '1"23',
      `"1\\"23"`
    );
  });
});
