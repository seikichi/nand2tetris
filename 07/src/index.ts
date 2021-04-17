import * as fs from "fs";
import * as readline from "readline";

if (process.argv.length !== 3) {
  throw "assembler: missing operand"; // FIXME
}

const INPUT_PATH = process.argv[2];
const OUTPUT_PATH = INPUT_PATH.replace(/\.vm$/, ".asm"); // TODO: Support directory

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
] as const;

type ARITH_LOGIC_COMMAND_TYPE = typeof ARITH_LOGIC_COMMANDS[number];

const SEGMENTS = [
  "argument",
  "local",
  "static",
  "constant",
  "this",
  "that",
  "pointer",
  "temp",
] as const;

type SEGMENT_TYPE = typeof SEGMENTS[number];

type Command =
  | { type: "ARITHMETIC"; args: [ARITH_LOGIC_COMMAND_TYPE] }
  | { type: "PUSH"; args: [SEGMENT_TYPE, number] }
  | { type: "POP"; args: [SEGMENT_TYPE, number] }
  | { type: "LABEL"; args: [string] }
  | { type: "GOTO"; args: [string] }
  | { type: "IF"; args: [string] }
  | { type: "FUNCTION"; args: [string, string] }
  | { type: "RETURN" }
  | { type: "CALL"; args: [string, string] };

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
  if (terms.length === 1 && ARITH_LOGIC_COMMANDS.includes(terms[0] as any)) {
    return { type: COMMAND_TO_TYPE[terms[0]] as any, args: [terms[0]] };
  }
  if (terms.length === 1) {
    return { type: COMMAND_TO_TYPE[terms[0]] as any };
  }
  if (terms.length === 2) {
    return { type: COMMAND_TO_TYPE[terms[0]] as any, args: [terms[1]] };
  }
  if (terms.length === 3 && (terms[0] == "push" || terms[0] === "pop")) {
    return {
      type: COMMAND_TO_TYPE[terms[0]] as any,
      args: [terms[1] as SEGMENT_TYPE, parseInt(terms[2], 10)],
    };
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

function translateCommand(
  command: Command,
  filename: string,
  uniqueNumber: number
): string[] {
  // ARITHMETIC
  if (command.type === "ARITHMETIC") {
    const op = command.args[0];

    if (op === "neg") {
      return ["@SP", "A=M-1", "M=-M"];
    }
    if (op === "not") {
      return ["@SP", "A=M-1", "M=!M"];
    }

    if (op === "add" || op === "sub" || op == "and" || op === "or") {
      return [
        "@SP",
        "M=M-1",
        "A=M",
        "D=M",
        "A=A-1",
        {
          add: "M=M+D",
          sub: "M=M-D",
          and: "M=M&D",
          or: "M=D|M",
        }[op],
      ];
    }

    const label = `__ARITHMETIC__.${uniqueNumber}`;
    const jump = {
      eq: "JEQ",
      lt: "JLT",
      gt: "JGT",
    }[op];
    return [
      "@SP",
      "M=M-1",
      "A=M",
      "D=M",
      "A=A-1",
      "D=M-D",
      "M=-1",
      `@${label}`,
      `D;${jump}`,
      "@SP",
      "A=M-1",
      "M=0",
      `(${label})`,
    ];
  }
  // PUSH
  if (command.type === "PUSH") {
    const [segment, index] = command.args;
    return [
      ...{
        argument: ["@ARG", "D=M", `@${index}`, "A=D+A", "D=M"],
        local: ["@LCL", "D=M", `@${index}`, "A=D+A", "D=M"],
        this: ["@THIS", "D=M", `@${index}`, "A=D+A", "D=M"],
        that: ["@THAT", "D=M", `@${index}`, "A=D+A", "D=M"],
        constant: [`@${index}`, "D=A"],
        static: [`@${filename}.${index}`, "D=M"],
        pointer: [["@THIS", "@THAT"][index], "D=M"],
        temp: [`@R${index + 5}`, "D=M"],
      }[segment],
      "@SP",
      "M=M+1",
      "A=M-1",
      "M=D",
    ];
  }
  // POP
  if (command.type === "POP") {
    const [segment, index] = command.args;
    if (segment === "constant") {
      throw `Invalid POP: ${command}`;
    }
    if (segment === "static" || segment === "pointer" || segment === "temp") {
      return [
        "@SP",
        "M=M-1",
        "A=M",
        "D=M",
        {
          static: `@${filename}.${index}`,
          pointer: ["@THIS", "@THAT"][index],
          temp: `@R${index + 5}`,
        }[segment],
        "M=D",
      ];
    }

    return [
      {
        argument: "@ARG",
        local: "@LCL",
        this: "@THIS",
        that: "@THAT",
      }[segment],
      "D=M",
      `@${index}`,
      "D=D+A",
      "@R13",
      "M=D",
      "@SP",
      "M=M-1",
      "A=M",
      "D=M",
      "@R13",
      "A=M",
      "M=D",
    ];
  }

  throw `Unknown command: ${command}`;
}

async function* translate(
  items: AsyncIterable<Command>,
  filename: string
): AsyncIterable<string> {
  let uniqueNumber = 0;
  for await (const command of items) {
    const ops = translateCommand(command, filename, uniqueNumber++);
    for (const op of ops) {
      yield op;
    }
  }
}

const createInputStream = (path: string) => {
  const input = fs.createReadStream(path);
  return readline.createInterface({ input, crlfDelay: Infinity });
};

(async function main() {
  const rl = createInputStream(INPUT_PATH);
  const out = fs.createWriteStream(OUTPUT_PATH);

  for await (const op of translate(parse(rl), "FOO")) {
    out.write(`${op}\n`);
  }
})();
