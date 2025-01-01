mod json;
mod utils;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn parse_json_str_at(line: &str, column: usize) -> Option<String> {
  utils::set_panic_hook();
  json::parse_json_str_at(line, column)
}
