import { config } from "./config";

/**
 * Escape `` ` `` for markdown code block.
 * @see https://github.com/microsoft/vscode/issues/193746
 */
export function escapeMarkdownCodeBlock(code: string) {
  const longestMatchLength =
    code.match(/`+/g)?.reduce((a, b) => (a.length > b.length ? a : b)).length ??
    0;
  const codeblockBorderLength =
    longestMatchLength >= 3 ? longestMatchLength + 1 : 3;

  // the markdown result
  return [
    `${"`".repeat(codeblockBorderLength)}txt`,
    code,
    `${"`".repeat(codeblockBorderLength)}`,
  ].join("\n");
}

export function profile<R>(label: string, f: () => R) {
  if (config.profile) {
    console.time(label);
  }
  const res = f();
  if (config.profile) {
    console.timeEnd(label);
  }
  return res;
}

export function evalJsonString(jsonStr: string) {
  try {
    // JSON.parse() is used to eval escape sequences like \n
    const res = JSON.parse(jsonStr);
    if (typeof res !== "string") {
      console.error(`Parsed JSON is not string: ${JSON.stringify(jsonStr)}`);
      return;
    }
    return res;
  } catch {
    console.error(`Failed to parse JSON string: ${JSON.stringify(jsonStr)}`);
    return;
  }
}
