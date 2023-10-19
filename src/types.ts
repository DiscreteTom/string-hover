import * as vscode from "vscode";

export type StringParser = (
  document: vscode.TextDocument,
  position: vscode.Position,
  token: vscode.CancellationToken
) => string | undefined;
