import * as vscode from "vscode";
import { expectHoverEqual } from "./helper";
import { TsStringParser } from "../../providers/ts";

suite("TypeScript", () => {
  test("simple string without escapes", () => {
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      undefined,
      `"123"`
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      undefined,
      `'123'`
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      undefined,
      "`123`"
    );
  });

  test("simple string with escapes", () => {
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "123\n",
      `"123\\n"`
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "123\n",
      `'123\\n'`
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "123\n",
      "`123\\n`"
    );
  });

  test("multiline simple template string", () => {
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "123\n456",
      "`123\n456`"
    );
  });

  test("nested template strings", () => {
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "begin${...}end",
      "`begin${ `${ `123` }` }end`"
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 9),
      "${...}",
      "`begin${ `${ `123` }` }end`"
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 23),
      "begin${...}end",
      "`begin${ `${ `123` }` }end`"
    );
  });

  test("template string middle", () => {
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 15),
      "begin${...}middle${...}end",
      "`begin${ 123 }middle${ 456 }end`"
    );
  });

  test("simple string after template string", () => {
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 12),
      undefined,
      `\`123\\n456\` "123"`
    );
  });

  test("line continuation", () => {
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "123456",
      '"123\\\n456"'
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "123456",
      "'123\\\n456"
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "123456",
      "'123\\\n456"
    );
  });

  test("other escaped characters", () => {
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "1\t23",
      `"1\\t23"`
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      '1"23',
      `"1\\"23"`
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "1\t\t23",
      `"1\t\\t23"`
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "1\xA923",
      `"1\\xA923"`
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "1\u00A923",
      `"1\\u00A923"`
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "1\u115523",
      `"1\\u115523"`
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "1\u{2F804}23",
      `"1\\u{2F804}23"`
    );
  });

  test("unclosed string", () => {
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      `123"`,
      `"123\\"`
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      '123"',
      `'123\\"`
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      '123"',
      '`123\\"'
    );
    expectHoverEqual(
      new TsStringParser(),
      new vscode.Position(0, 0),
      "123 ${...}",
      "`123 ${ 123 }"
    );
  });
});
