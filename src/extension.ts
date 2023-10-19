import * as vscode from "vscode";
import { escapeMarkdownCodeBlock, profile } from "./utils";
import { config } from "./config";
import { jsonStringParser } from "./providers/json";
import { jsoncStringParser } from "./providers/jsonc";
import { tsStringParser } from "./providers/ts";
import { StringParser } from "./types";

function registerStringHoverProvider(
  selector: vscode.DocumentSelector,
  stringParser: StringParser
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
    registerStringHoverProvider("jsonc", jsoncStringParser),
    registerStringHoverProvider("javascript", tsStringParser),
    registerStringHoverProvider("typescript", tsStringParser)
  );
}

export function deactivate() {}
