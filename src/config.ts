import * as vscode from "vscode";

export const config = {
  debug: process.env.VSCODE_DEBUG_MODE === "true",
  profile: process.env.VSCODE_PROFILE_MODE === "true",
  // settings
  get renderNewlines() {
    return vscode.workspace
      .getConfiguration("string-hover")
      .get("renderNewlines") as boolean;
  },
  get renderTabs() {
    return vscode.workspace
      .getConfiguration("string-hover")
      .get("renderTabs") as boolean;
  },
  get renderSpaces() {
    return vscode.workspace
      .getConfiguration("string-hover")
      .get("renderSpaces") as boolean;
  },
};
