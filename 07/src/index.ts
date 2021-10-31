import * as fs from "fs";
import * as path from "path";

import { HackOperation } from "./hack";
import { parse } from "./parser";
import { compile } from "./compiler";
import { getOutputPath, getSourcePaths } from "./utils";

// MEMO: 2 important functions
//
// - parse: string -> Command[]
// - compile: Command[] -> HackOperation[]

if (process.argv.length !== 3) {
  throw "assembler: missing operand"; // FIXME
}

const inputPaths = getSourcePaths(process.argv[2]);
const outputPath = getOutputPath(process.argv[2]);

if (inputPaths.length === 0) {
  throw "No .vm file";
}

const ops: HackOperation[] = [];

for (const p of inputPaths) {
  const filename = path.basename(p);
  const source = fs.readFileSync(p, { encoding: "utf-8" });
  const commands = parse(source);
  ops.push(...compile(commands, filename));
}

fs.writeFileSync(outputPath, ops.join("\n"), { encoding: "utf-8" });
