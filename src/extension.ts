import * as vscode from "vscode";
import { escapeMarkdownCodeBlock, profile } from "./utils";
import { config } from "./config";
import { IStringParser } from "./model";
import { JsonStringParser } from "./providers/json";
import { JsoncStringParser } from "./providers/jsonc";
import { TsStringParser } from "./providers/ts";
import { RustStringParser } from "./providers/rust";

function registerStringHoverProvider(
  selector: vscode.DocumentSelector,
  parser: IStringParser
) {
  return vscode.languages.registerHoverProvider(selector, {
    provideHover(document, position, cancel) {
      const str = profile(selector.toString(), () =>
        parser.parse(document, position, cancel)
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
    registerStringHoverProvider("json", new JsonStringParser()),
    registerStringHoverProvider("jsonc", new JsoncStringParser()),
    registerStringHoverProvider("javascript", new TsStringParser()),
    registerStringHoverProvider("typescript", new TsStringParser()),
    registerStringHoverProvider("rust", new RustStringParser())
  );
}

export function deactivate() {}
