import * as vscode from "vscode";
// import { config } from "../config";
import type { IStringParser } from "../model";
import { JsonStrParser } from "../../wasm/pkg/wasm";

export class JsoncStringParser implements IStringParser {
  private parser: JsonStrParser;

  constructor() {
    this.parser = new JsonStrParser();
  }

  parse(
    document: vscode.TextDocument,
    position: vscode.Position,
    cancel: vscode.CancellationToken
  ) {
    // perf: only get from the document's start to the current line's end
    // since JSON with comments doesn't allow multi-line string.
    // we can't only get the current line because the line maybe in a comment.
    const text = document.getText(new vscode.Range(0, 0, position.line + 1, 0));
    const offset = document.offsetAt(position);

    // TODO: move to config
    const requireEscape = true;

    return this.parser.parse_jsonc(text, offset, requireEscape, cancel);
  }
}
