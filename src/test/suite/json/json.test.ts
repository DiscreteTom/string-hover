import { JsonStringParser } from "../../../providers/json";
import { runJsonTests } from "./common";

// ref: https://www.json.org/json-en.html

suite("JSON", () => {
  runJsonTests(new JsonStringParser());
});
