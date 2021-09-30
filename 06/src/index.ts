import * as fs from "fs";

import { parse } from "./parser";
import { makeTable } from "./table";
import { assemble } from "./assembler";

if (process.argv.length !== 3 || !process.argv[2].endsWith(".asm")) {
  console.log("Usage: assembler: assembler input.asm");
  process.exit(-1);
}

const inPath = process.argv[2];
const outPath = inPath.replace(/\.asm$/, ".hack");

const source = fs.readFileSync(inPath, { encoding: "utf-8" });

const commands = parse(source);
const table = makeTable(commands);
const code = assemble(commands, table);

fs.writeFileSync(outPath, code, { encoding: "utf-8" });
