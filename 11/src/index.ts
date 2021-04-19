import * as fs from "fs";
import { tokenize } from "./tokenizer";
import { analyze } from "./analyzer";

if (process.argv.length !== 3) {
  throw "assembler: missing operand"; // FIXME
}

const INPUT_PATH = process.argv[2];
const OUTPUT_PATH = INPUT_PATH.replace(/\.jack$/, ".test.xml"); // FIXME: support folder

const source = fs.readFileSync(INPUT_PATH, { encoding: "utf-8" });
const tokens = tokenize(source);

const tree = analyze(tokens);
// fs.writeFileSync(OUTPUT_PATH, JSON.stringify(tree, null, 2));
console.log(JSON.stringify(tree, null, 2));
