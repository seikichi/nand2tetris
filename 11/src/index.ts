import * as fs from "fs";
import { tokenize } from "./tokenizer";
import { analyze } from "./analyzer";
import { compile } from "./compiler";
import { showCommand } from "./vm";

if (process.argv.length !== 3) {
  throw "assembler: missing operand"; // FIXME
}

const INPUT_PATH = process.argv[2];
const OUTPUT_PATH = INPUT_PATH.replace(/\.jack$/, ".vm"); // FIXME: support folder

const source = fs.readFileSync(INPUT_PATH, { encoding: "utf-8" });

const stream = fs.createWriteStream(OUTPUT_PATH);
for (const command of compile(analyze(tokenize(source)))) {
  stream.write(showCommand(command) + "\n");
}
