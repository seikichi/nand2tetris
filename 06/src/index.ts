import * as fs from "fs";
import * as readline from "readline";

if (process.argv.length !== 3) {
  throw "assembler: missing operand"; // FIXME
}

const INPUT_PATH = process.argv[2];
const OUTPUT_PATH = INPUT_PATH.replace(/\.asm$/, ".hack");

type Command =
  | { type: "A"; symbol: string }
  | { type: "C"; dest?: string; comp: string; jump?: string }
  | { type: "L"; symbol: string };

module Code {
  export const DEST_TO_CODE: { [dest: string]: string } = {
    M: "001",
    D: "010",
    MD: "011",
    A: "100",
    AM: "101",
    AD: "110",
    AMD: "111",
  };

  export const JUMP_TO_CODE: { [jump: string]: string } = {
    JGT: "001",
    JEQ: "010",
    JGE: "011",
    JLT: "100",
    JNE: "101",
    JLE: "110",
    JMP: "111",
  };

  const CODE_TO_COMP = {
    "101010": ["0"],
    "111111": ["1"],
    "111010": ["-1"],
    "001100": ["D"],
    "110000": ["A", "M"],
    "001101": ["!D"],
    "110001": ["!A", "!M"],
    "001111": ["-D"],
    "110011": ["-A", "-M"],
    "011111": ["D+1"],
    "110111": ["A+1", "M+1"],
    "001110": ["D-1"],
    "110010": ["A-1", "M-1"],
    "000010": ["D+A", "D+M"],
    "010011": ["D-A", "D-M"],
    "000111": ["A-D", "M-D"],
    "000000": ["D&A", "D&M"],
    "010101": ["D|A", "D|M"],
  };

  export const COMP_TO_CODE = Object.fromEntries(
    Object.entries(CODE_TO_COMP).flatMap(([code, cs]) =>
      cs.map((c, i) => [c, `${i}${code}`])
    )
  );

  export function dest(mnemonic: string | undefined): string {
    return mnemonic ? DEST_TO_CODE[mnemonic]! : "000";
  }

  export function comp(mnemonic: string): string {
    return COMP_TO_CODE[mnemonic]!;
  }

  export function jump(mnemonic: string | undefined): string {
    return mnemonic ? JUMP_TO_CODE[mnemonic] : "000";
  }
}

const cPattern = Object.keys(Code.COMP_TO_CODE).map(escapeRegExp).join("|");
const dPattern = Object.keys(Code.DEST_TO_CODE).map(escapeRegExp).join("|");
const jPattern = Object.keys(Code.JUMP_TO_CODE).map(escapeRegExp).join("|");
const symbol = "[A-Za-z_.$:][0-9A-Za-z_.$:]*";
const aCommandPattern = new RegExp(`^@(?<symbol>${symbol}|[0-9]+)$`);
const lCommandPattern = new RegExp(`^\\((?<symbol>${symbol})\\)$`);
const cCommandPattern = new RegExp(
  `^((?<dest>${dPattern})=)?(?<comp>${cPattern})(;(?<jump>${jPattern}))?$`
);

function preprocess(line: string): string {
  return line.replace(/\s+/g, "").replace(/\/\/.*$/, "");
}

function escapeRegExp(s: string) {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseLine(rawLine: string): Command | null {
  const line = preprocess(rawLine);

  let match = line.match(lCommandPattern);
  if (match) {
    const { symbol } = match.groups!;
    return { type: "L", symbol };
  }
  match = line.match(aCommandPattern);
  if (match) {
    const { symbol } = match.groups!;
    return { type: "A", symbol };
  }
  match = line.match(cCommandPattern);
  if (match) {
    const { dest, comp, jump } = match.groups!;
    return { type: "C", dest, comp, jump };
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

const createInputStream = (path: string) => {
  const input = fs.createReadStream(path);
  return readline.createInterface({ input, crlfDelay: Infinity });
};

const table: { [symbol: string]: number } = {
  SP: 0,
  LCL: 1,
  ARG: 2,
  THIS: 3,
  THAT: 4,
  SCREEN: 16384,
  KBD: 24576,
  ...Object.fromEntries(new Array(16).fill(0).map((_, i) => [`R${i}`, i])),
};

(async function main() {
  // First
  let rl = createInputStream(INPUT_PATH);
  let current = 0;
  for await (const command of parse(rl)) {
    if (command.type === "L") {
      table[command.symbol] = current;
    } else {
      current++;
    }
  }

  // Second
  rl = createInputStream(INPUT_PATH);
  let next = 16;
  const out = fs.createWriteStream(OUTPUT_PATH);
  for await (const command of parse(rl)) {
    if (command.type === "C") {
      const { dest, comp, jump } = command;
      out.write(`111${Code.comp(comp)}${Code.dest(dest)}${Code.jump(jump)}\n`);
    }

    if (command.type === "A") {
      const { symbol } = command;
      const isNumber = symbol.match(/^[0-9]+$/);
      if (!isNumber && !(symbol in table)) {
        table[symbol] = next++;
      }
      const address = isNumber ? parseInt(symbol, 10) : table[symbol];
      out.write(`0${address.toString(2).padStart(15, "0")}\n`);
    }
  }
})();
