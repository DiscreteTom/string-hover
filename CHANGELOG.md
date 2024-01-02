# CHANGELOG

## v0.1.8

- Feat(json/jsonc): error handling for invalid escape sequence with retsac v0.15.0 built-in json utils.

## v0.1.7

- Feat(json/jsonc/ts): support unclosed string.
- Fix(ts): support line continuation. [#1](https://github.com/DiscreteTom/string-hover/issues/1)
- Fix(ts): support unicode code point escaped. [#2](https://github.com/DiscreteTom/string-hover/issues/2)
- Perf(ts): prevent re-scanning interpolated string with retsac's multi-kind action.

## v0.1.6

- Add icon.
- Ignore unnecessary files when publishing.
- Optimize package size.

## v0.1.5

Fix README.

## v0.1.4

- Fix(ts): fix `\u` escape sequence.
- Fix(ts): fix `"\\"`.
- Feat: support Rust lang.
- Feat: add settings to render whitespaces.
  - `string-hover.renderNewlines`
  - `string-hover.renderTabs`
  - `string-hover.renderWhitespaces`

## v0.1.3

- Fix(ts): fix all escape sequence, including `\x` and `\u`.
- Remove singleton and global variables.
- Add tests.

## v0.1.2

- Fix(ts): fix `targetTempStrIndex` initial value.

## v0.1.1

- Feat: support more languages
  - JavaScript (`*.js`)
  - TypeScript (`*.ts`)

## v0.1.0

The initial release.

Support for the following languages:

- JSON (`*.json`)
- JSON with comments (`*.jsonc`)
