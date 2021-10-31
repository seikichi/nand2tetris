import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

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
  | { type: "IF_GOTO"; args: [string] }
  | { type: "FUNCTION"; args: [string, number] }
  | { type: "RETURN" }
  | { type: "CALL"; args: [string, number] };

const COMMAND_TO_TYPE: { [command: string]: Command["type"] } = {
  ...Object.fromEntries(ARITH_LOGIC_COMMANDS.map((c) => [c, "ARITHMETIC"])),
  push: "PUSH",
  pop: "POP",
  label: "LABEL",
  goto: "GOTO",
  "if-goto": "IF_GOTO",
  function: "FUNCTION",
  call: "CALL",
  return: "RETURN",
};

function parseLine(raw: string): Command | null {
  const line = raw.replace(/\/\/.*$/, "").trim();
  if (line === "") {
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
  if (terms.length === 3) {
    return {
      type: COMMAND_TO_TYPE[terms[0]] as any,
      args: [terms[1] as any, parseInt(terms[2], 10)],
    };
  }
  throw `Unknown Command: ${raw}`;
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
  functionName: string,
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

    const label = `$ARITHMETIC.${filename}.${uniqueNumber}`;
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
  // LABEL, GOTO, IF_GOTO
  if (command.type === "LABEL") {
    const label = `${functionName}$${command.args[0]}`;
    return [`(${label})`];
  }
  if (command.type === "GOTO") {
    const label = `${functionName}$${command.args[0]}`;
    return [`@${label}`, `0;JMP`];
  }
  if (command.type === "IF_GOTO") {
    const label = `${functionName}$${command.args[0]}`;
    return ["@SP", "M=M-1", "A=M", "D=M", `@${label}`, "D;JNE"];
  }
  // FUNCTION, RETURN
  if (command.type === "FUNCTION") {
    const [f, k] = command.args;
    functionName = f;
    return [
      `(${f})`,
      ...new Array(k).fill(0).flatMap(() => ["@SP", "M=M+1", "A=M-1", "M=0"]),
    ];
  }
  if (command.type === "RETURN") {
    return [
      // FRAME = LCL
      "@LCL",
      "D=M",
      "@R13",
      "M=D",
      // RET = *(FRAME-5)
      "@R13",
      "D=M",
      "@5",
      "A=D-A",
      "D=M",
      "@R14",
      "M=D",
      // *ARG = POP
      "@SP",
      "M=M-1",
      "A=M",
      // "A=M-1",
      "D=M",
      "@ARG",
      "A=M",
      "M=D",
      // SP = ARG + 1
      "@ARG",
      "D=M+1",
      "@SP",
      "M=D",
      // THAT = *(FRAME - 1)
      "@R13",
      "D=M",
      "@1",
      "A=D-A",
      "D=M",
      "@THAT",
      "M=D",
      // THIS = *(FRAME - 2)
      "@R13",
      "D=M",
      "@2",
      "A=D-A",
      "D=M",
      "@THIS",
      "M=D",
      // ARG  = *(FRAME - 3)
      "@R13",
      "D=M",
      "@3",
      "A=D-A",
      "D=M",
      "@ARG",
      "M=D",
      // LCL  = *(FRAME - 4)
      "@R13",
      "D=M",
      "@4",
      "A=D-A",
      "D=M",
      "@LCL",
      "M=D",
      // goto RET
      "@R14",
      "A=M",
      "0;JMP",
    ];
  }
  // CALL
  const pushA = ["D=A", "@SP", "M=M+1", "A=M-1", "M=D"];
  const pushM = ["D=M", "@SP", "M=M+1", "A=M-1", "M=D"];

  const [f, n] = command.args;
  const address = `$RETURN.${filename}.${uniqueNumber}`;
  return [
    // push return-address
    `@${address}`,
    ...pushA,
    // push LCL
    "@LCL",
    ...pushM,
    // push ARG
    "@ARG",
    ...pushM,
    // push THIS
    "@THIS",
    ...pushM,
    // push THAT
    "@THAT",
    ...pushM,
    // ARG = SP - n - 5
    "@SP",
    "D=M",
    `@${n + 5}`,
    "D=D-A",
    "@ARG",
    "M=D",
    // LCL = SP
    "@SP",
    "D=M",
    "@LCL",
    "M=D",
    // goto f
    `@${f}`,
    "0;JMP",
    // (return address)
    `(${address})`,
  ];
}

async function* translate(
  items: AsyncIterable<Command>,
  filename: string
): AsyncIterable<string> {
  let uniqueNumber = 0;
  let functionName = "";
  for await (const command of items) {
    if (command.type === "FUNCTION") {
      functionName = command.args[0];
    }

    const ops = translateCommand(
      command,
      filename,
      functionName,
      uniqueNumber++
    );
    for (const op of ops) {
      yield op;
    }
  }
}

const createInputStream = (path: string) => {
  const input = fs.createReadStream(path);
  return readline.createInterface({ input, crlfDelay: Infinity });
};

function getSources(p: string): string[] {
  const stat = fs.statSync(p);
  const files = stat.isDirectory()
    ? fs.readdirSync(p).map((f) => path.join(p, f))
    : [p];
  return files.filter((f) => f.match(/\.vm$/));
}

function getOutputPath(p: string): string {
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    const filename = `${path.basename(p)}.asm`;
    return path.join(p, filename);
  } else {
    return p.replace(/\.vm$/, ".asm");
  }
}

const START_UP = [
  // @SP
  "@256",
  "D=A",
  "@SP",
  "M=D",
  // @LCL
  "@300",
  "D=A",
  "@LCL",
  "M=D",
  // @ARG
  "@400",
  "D=A",
  "@ARG",
  "M=D",
  // @THIS
  "@3000",
  "D=A",
  "@THIS",
  "M=D",
  // @THAT
  "@4000",
  "D=A",
  "@THAT",
  "M=D",
  // Call Sys.init
  ...translateCommand(
    { type: "CALL", args: ["Sys.init", 0] },
    "$STARTUP",
    "",
    0
  ),
];

if (process.argv.length !== 3) {
  throw "assembler: missing operand"; // FIXME
}

const INPUT_PATH = process.argv[2];

(async function main() {
  const sources = getSources(INPUT_PATH);
  if (sources.length === 0) {
    throw "No .vm file";
  }

  const out = fs.createWriteStream(getOutputPath(INPUT_PATH));

  for (const op of START_UP) {
    out.write(`${op}\n`);
  }

  for (const s of sources) {
    const input = createInputStream(s);
    const name = path.basename(s, ".vm");

    for await (const op of translate(parse(input), name)) {
      out.write(`${op}\n`);
    }
  }
})();
