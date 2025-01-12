import type * as vscode from "vscode";
// import { config } from "../config";
import type { IStringParser } from "../model";
import { JsonStrParser } from "../../wasm/pkg/wasm";

export class JsonStringParser implements IStringParser {
  private parser: JsonStrParser;

  constructor() {
    this.parser = new JsonStrParser();
  }

  parse(
    document: vscode.TextDocument,
    position: vscode.Position,
    _cancel: vscode.CancellationToken
  ) {
    // perf: only get the current line
    // since JSON doesn't allow multi-line string & comments
    const line = document.lineAt(position).text;

    // TODO: apply cancel.isCancellationRequested

    // TODO: move to config
    const requireEscape = true;

    return this.parser.parse(line, position.character, requireEscape);
  }
}
