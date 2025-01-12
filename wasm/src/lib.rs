mod json;
mod utils;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
  #[wasm_bindgen(js_namespace = console, js_name = log)]
  fn console_log(s: &str);
  #[wasm_bindgen(js_namespace = Date, js_name = now)]
  fn date_now_ms() -> u64;

  pub type CancellationToken;
  #[wasm_bindgen(method, getter)]
  fn isCancellationRequested(this: &CancellationToken) -> bool;
}

#[wasm_bindgen]
pub struct JsonStrParser {
  inner: json::JsonStrParser,
}

#[wasm_bindgen]
impl JsonStrParser {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    utils::set_panic_hook();
    Self {
      inner: json::JsonStrParser::new(),
    }
  }

  pub fn parse(
    &self,
    line: &str,
    column: usize,
    require_escape: bool,
    cancel: CancellationToken,
  ) -> Option<String> {
    self.inner.parse(line, column, require_escape, || {
      cancel.isCancellationRequested()
    })
  }

  pub fn parse_jsonc(
    &self,
    text: &str,
    offset: usize,
    require_escape: bool,
    cancel: CancellationToken,
  ) -> Option<String> {
    self.inner.parse_jsonc(text, offset, require_escape, || {
      cancel.isCancellationRequested()
    })
  }
}
