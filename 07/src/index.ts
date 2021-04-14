import * as fs from "fs";
import * as readline from "readline";

if (process.argv.length !== 3) {
  throw "assembler: missing operand"; // FIXME
}

const INPUT_PATH = process.argv[2];
// const OUTPUT_PATH = INPUT_PATH.replace(/\.vm$/, ".asm"); // TODO: Support directory

type Command =
  | { type: "ARITHMETIC"; args: [string] }
  | { type: "PUSH"; args: [string, string] }
  | { type: "POP"; args: [string, string] }
  | { type: "LABEL"; args: [string] }
  | { type: "GOTO"; args: [string] }
  | { type: "IF"; args: [string] }
  | { type: "FUNCTION"; args: [string, string] }
  | { type: "RETURN" }
  | { type: "CALL"; args: [string, string] };

const ARITH_LOGIC_COMMANDS = [
  "add",
  "sub",
  "neq",
  "eq",
  "gt",
  "lt",
  "and",
  "or",
  "not",
];

const COMMAND_TO_TYPE: { [command: string]: Command["type"] } = {
  ...Object.fromEntries(ARITH_LOGIC_COMMANDS.map((c) => [c, "ARITHMETIC"])),
  push: "PUSH",
  pop: "POP",
  label: "LABEL",
  goto: "GOTO",
  "if-goto": "IF",
  function: "FUNCTION",
  call: "CALL",
  return: "RETURN",
};

function parseLine(raw: string): Command | null {
  const line = raw.replace(/\/\/.*$/, "");
  if (line.trim() === "") {
    return null;
  }

  // TODO: remove any, redundant code...
  const terms = line.split(/\s+/);
  if (terms.length === 1 && ARITH_LOGIC_COMMANDS.includes(terms[0])) {
    return { type: COMMAND_TO_TYPE[terms[0]] as any, args: [terms[0]] };
  }
  if (terms.length === 1) {
    return { type: COMMAND_TO_TYPE[terms[0]] as any };
  }
  if (terms.length === 2) {
    return { type: COMMAND_TO_TYPE[terms[0]] as any, args: [terms[1]] };
  }
  if (terms.length === 3) {
    return {
      type: COMMAND_TO_TYPE[terms[0]] as any,
      args: [terms[1], terms[2]],
    };
  }

  return null;
}

async function* parse(items: AsyncIterable<string>): AsyncIterable<Command> {
  for await (const line of items) {
    const command = parseLine(line);
    if (!command) {
      continue;
    }
    yield command;
  }
}

class CodeWriter {
  write(command: Command) {
    // FIXME: write to file, not stdout
    if (command.type === "ARITHMETIC" && command.args[0] === "add") {
      console.log("@SP");
      console.log("M=M-1");
      console.log("A=M-1");
      console.log("D=M");
      console.log("A=A+1");
      console.log("D=D+M");
      console.log("A=A-1");
      console.log("M=D");
    }
    if (command.type === "PUSH" && command.args[0] === "constant") {
      const constant = parseInt(command.args[1], 10);
      console.log(`@${constant}`);
      console.log("D=A");
      console.log("@SP");
      console.log("M=M+1");
      console.log("A=M-1");
      console.log("M=D");
    }
    // Do nothing ...
  }
}

const createInputStream = (path: string) => {
  const input = fs.createReadStream(path);
  return readline.createInterface({ input, crlfDelay: Infinity });
};

(async function main() {
  const rl = createInputStream(INPUT_PATH);
  const writer = new CodeWriter();
  for await (const command of parse(rl)) {
    writer.write(command);
  }
})();
