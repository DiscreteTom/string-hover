import * as vscode from "vscode";
import { expectHoverEqual } from "./helper";
import { RustStringParser } from "../../providers/rust";

suite("Rust", () => {
  test("simple string", () => {
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      undefined,
      `"123"`
    );
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      undefined,
      `'1'`
    );
  });

  test("escaped char", () => {
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      "\n",
      `'\\n'`
    );
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      "\xA9",
      `'\\xA9'`
    );
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      "\u1155",
      `'\\u{1155}'`
    );
  });

  test("escaped string", () => {
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      "1\t23",
      `"1\\t23"`
    );
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      '1"23',
      `"1\\"23"`
    );
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      "1\t\t23",
      `"1\t\\t23"`
    );
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      "1\xA923",
      `"1\\xA923"`
    );
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      "1\u00A923",
      `"1\\u{00A9}23"`
    );
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      "1\u115523",
      `"1\\u{1155}23"`
    );
  });

  test("raw string", () => {
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      "1\\u{1155}23",
      `r"1\\u{1155}23"`
    );
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      "1\\u{1155}23",
      `r#"1\\u{1155}23"#`
    );
    expectHoverEqual(
      new RustStringParser(),
      new vscode.Position(0, 0),
      "1\\u{1155}23#",
      `r##"1\\u{1155}23#"##`
    );
  });
});
