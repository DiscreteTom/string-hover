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
    // JSON.parse() is used to eval escape sequences like \n
    `${JSON.parse(code)}`,
    `${"`".repeat(codeblockBorderLength)}`,
  ].join("\n");
}
