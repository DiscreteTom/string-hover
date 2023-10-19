import * as vscode from "vscode";

export interface IStringParser {
  parse(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): string | undefined;
}
