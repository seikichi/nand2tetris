import * as fs from "fs";
import * as readline from "readline";

if (process.argv.length !== 3) {
  throw "assembler: missing operand"; // FIXME
}

const INPUT_PATH = process.argv[2];
const OUTPUT_PATH = INPUT_PATH.replace(/\.vm$/, ".asm"); // TODO: Support directory

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
  "neg",
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
  private readonly stream: fs.WriteStream;
  private counter: number;

  constructor(path: string) {
    this.stream = fs.createWriteStream(OUTPUT_PATH);
    this.counter = 0;
  }

  private out(str: string) {
    this.stream.write(`${str}\n`);
  }

  private nextLabel() {
    return `WRITER.${this.counter++}`;
  }

  write(command: Command) {
    if (command.type === "ARITHMETIC" && command.args[0] === "neg") {
      this.out("@SP");
      this.out("A=M-1");
      this.out("M=-M");
      return;
    }
    if (command.type === "ARITHMETIC" && command.args[0] === "not") {
      this.out("@SP");
      this.out("A=M-1");
      this.out("M=!M");
      return;
    }

    if (command.type === "ARITHMETIC") {
      this.out("@SP");
      this.out("M=M-1");
      this.out("A=M");
      this.out("D=M");
      this.out("A=A-1");
      switch (command.args[0]) {
        case "add":
          this.out("M=M+D");
          break;
        case "sub":
          this.out("M=M-D");
          break;
        case "and":
          this.out("M=D&M");
          break;
        case "or":
          this.out("M=D|M");
          break;
        case "eq":
        case "lt":
        case "gt":
          const label = this.nextLabel();
          const jump = {
            eq: "JEQ",
            lt: "JLT",
            gt: "JGT",
          }[command.args[0]];

          this.out("D=M-D");
          this.out("M=-1");
          this.out(`@${label}`);
          this.out(`D;${jump}`);
          this.out("@SP");
          this.out("A=M-1");
          this.out("M=0");
          this.out(`(${label})`);
          break;
        default:
          throw `uninplemented ${command.args[0]}`;
      }
    }
    if (command.type === "PUSH" && command.args[0] === "constant") {
      const constant = parseInt(command.args[1], 10);
      this.out(`@${constant}`);
      this.out("D=A");
      this.out("@SP");
      this.out("M=M+1");
      this.out("A=M-1");
      this.out("M=D");
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
  const writer = new CodeWriter(OUTPUT_PATH);
  for await (const command of parse(rl)) {
    writer.write(command);
  }
})();
