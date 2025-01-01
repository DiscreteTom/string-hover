import type * as vscode from "vscode";
// import { config } from "../config";
import type { IStringParser } from "../model";
import { parse_json_str_at } from "../../wasm/pkg/wasm";

export class JsonStringParser implements IStringParser {
  parse(
    document: vscode.TextDocument,
    position: vscode.Position,
    _cancel: vscode.CancellationToken
  ) {
    // perf: only get the current line
    // since JSON doesn't allow multi-line string & comments
    const line = document.lineAt(position).text;

    // TODO: apply cancel.isCancellationRequested
    // TODO: don't show hover if no escape, only show in debug log
    return parse_json_str_at(line, position.character);
  }
}
