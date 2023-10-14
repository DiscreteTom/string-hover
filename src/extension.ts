import * as vscode from "vscode";
import { escapeMarkdownCodeBlock, profile } from "./utils";
import { config } from "./config";
import { jsonStringParser } from "./providers/json";
import { jsoncStringParser } from "./providers/jsonc";

function registerStringHoverProvider(
  selector: vscode.DocumentSelector,
  stringParser: (
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ) => string | undefined
) {
  return vscode.languages.registerHoverProvider(selector, {
    provideHover(document, position, cancel) {
      const str = profile(selector.toString(), () =>
        stringParser(document, position, cancel)
      );

      if (str !== undefined) {
        // the markdown result
        const md = escapeMarkdownCodeBlock(str);

        if (config.debug) {
          console.log(md);
        }

        return {
          contents: [md],
        };
      }
    },
  });
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    registerStringHoverProvider("json", jsonStringParser),
    registerStringHoverProvider("jsonc", jsoncStringParser)
  );
}

export function deactivate() {}
