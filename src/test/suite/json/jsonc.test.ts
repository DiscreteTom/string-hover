import * as vscode from "vscode";
import { expectHoverEqual } from "../helper";
import { JsoncStringParser } from "../../../providers/jsonc";
import { runJsonTests } from "./common";

suite("JSON with comments", () => {
  const parser = new JsoncStringParser();

  runJsonTests(parser);

  test("string after comments", () => {
    expectHoverEqual(
      parser,
      new vscode.Position(0, 5),
      "1\n23",
      `/**/"1\\n23"`
    );
    expectHoverEqual(
      parser,
      new vscode.Position(1, 0),
      "1\n23",
      `//\n"1\\n23"`
    );
  });

  test("string in comments", () => {
    expectHoverEqual(
      parser,
      new vscode.Position(0, 3),
      undefined,
      `/*"1\\n23"*/`
    );
    expectHoverEqual(
      parser,
      new vscode.Position(0, 3),
      undefined,
      `//"1\\n23"`
    );
  });
});
