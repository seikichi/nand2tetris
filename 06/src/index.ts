import * as fs from "fs";

if (process.argv.length !== 3) {
  throw "assembler: missing operand"; // FIXME
}

const INPUT_PATH = process.argv[2];
const OUTPUT_PATH = INPUT_PATH.replace(/\.asm$/, ".hack");

function preprocess(line: string): string {
  return line.replace(/\s+/g, "").replace(/\/\/.*$/, "");
}

function escapeRegExp(s: string) {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const comps = [
  "0",
  "1",
  "-1",
  "D",
  "A",
  "!D",
  "!A",
  "-D",
  "-A",
  "D+1",
  "A+1",
  "D-1",
  "A-1",
  "D+A",
  "D-A",
  "A-D",
  "D&A",
  "D|A",
  "M",
  "!M",
  "-M",
  "M+1",
  "M-1",
  "D+M",
  "D-M",
  "M-D",
  "D&M",
  "D|M",
];
const cPattern = comps.map(escapeRegExp).join("|");
const dPattern = "M|D|MD|A|AM|AD|AMD";
const jPattern = "JGT|JEQ|JGE|JLT|JNE|JLE|JMP";
const pattern = `^(?:(?<dest>${dPattern})=)?(?<comp>${cPattern})(?:;(?<jump>${jPattern}))?$`;
const symbol = "[A-Za-z_.$:][0-9A-Za-z_.$:]*";
const digits = "[0-9]+";

const aCommandPattern = new RegExp(`^@(?<symbol>${symbol}|${digits})$`);
const lCommandPattern = new RegExp(`^\\((?<symbol>${symbol})\\)$`);
const cCommandPattern = new RegExp(pattern);

function parse(line: string): Command {
  let match = line.match(lCommandPattern);
  if (match) {
    const { symbol } = match.groups!;
    return { type: "L_COMMAND", symbol };
  }
  match = line.match(aCommandPattern);
  if (match) {
    const { symbol } = match.groups!;
    return { type: "A_COMMAND", symbol };
  }
  match = line.match(cCommandPattern);
  if (match) {
    const { dest, comp, jump } = match.groups!;
    return { type: "C_COMMAND", dest, comp, jump };
  }
  throw `Invalid Line: ${line}`;
}

type Command =
  | { type: "A_COMMAND"; symbol: string }
  | { type: "C_COMMAND"; dest?: string; comp: string; jump?: string }
  | { type: "L_COMMAND"; symbol: string };

type CommandType = "A_COMMAND" | "C_COMMAND" | "L_COMMAND";

class Parser {
  private index: number = -1;
  private readonly commands: readonly Command[];

  constructor(path: string) {
    const src = fs.readFileSync(INPUT_PATH, "utf-8");
    const lines = src.split(/\r?\n/);
    this.commands = lines
      .map(preprocess)
      .filter((s) => s !== "")
      .map(parse);
  }

  hasMoreCommands(): boolean {
    return this.index + 1 < this.commands.length;
  }

  advance(): void {
    if (!this.hasMoreCommands()) {
      throw "illegal state";
    }
    this.index++;
  }

  commandType(): CommandType {
    return this.commands[this.index].type;
  }

  symbol(): string {
    const current = this.commands[this.index];
    if (current.type === "C_COMMAND") {
      throw "illegal state";
    }
    return current.symbol;
  }

  dest(): string | undefined {
    const current = this.commands[this.index];
    if (current.type !== "C_COMMAND") {
      throw "illegal state";
    }
    return current.dest;
  }

  comp(): string {
    const current = this.commands[this.index];
    if (current.type !== "C_COMMAND") {
      throw "illegal state";
    }
    return current.comp;
  }

  jump(): string | undefined {
    const current = this.commands[this.index];
    if (current.type !== "C_COMMAND") {
      throw "illegal state";
    }
    return current.jump;
  }
}

module Code {
  export function dest(mnemonic: string | undefined): string {
    if (typeof mnemonic === "undefined") {
      return "000";
    }

    return {
      M: "001",
      D: "010",
      MD: "011",
      A: "100",
      AM: "101",
      AD: "110",
      AMD: "111",
    }[mnemonic]!;
  }

  export function comp(mnemonic: string): string {
    return {
      "0": "0101010",
      "1": "0111111",
      "-1": "0111010",
      D: "0001100",
      A: "0110000",
      "!D": "0001101",
      "!A": "0110001",
      "-D": "0001111",
      "-A": "0110011",
      "D+1": "0011111",
      "A+1": "0110111",
      "D-1": "0001110",
      "A-1": "0110010",
      "D+A": "0000010",
      "D-A": "0010011",
      "A-D": "0000111",
      "D&A": "0000000",
      "D|A": "0010101",
      M: "1110000",
      "!M": "1110001",
      "-M": "1110011",
      "M+1": "1110111",
      "M-1": "1110010",
      "D+M": "1000010",
      "D-M": "1010011",
      "M-D": "1000111",
      "D&M": "1000000",
      "D|M": "1010101",
    }[mnemonic]!;
  }

  export function jump(mnemonic: string | undefined): string {
    if (typeof mnemonic === "undefined") {
      return "000";
    }

    return {
      JGT: "001",
      JEQ: "010",
      JGE: "011",
      JLT: "100",
      JNE: "101",
      JLE: "110",
      JMP: "111",
    }[mnemonic]!;
  }
}

class SymbolTable {
  private table: { [symbol: string]: number } = {
    SP: 0,
    LCL: 1,
    ARG: 2,
    THIS: 3,
    THAT: 4,
    R0: 0,
    R1: 1,
    R2: 2,
    R3: 3,
    R4: 4,
    R5: 5,
    R6: 6,
    R7: 7,
    R8: 8,
    R9: 9,
    R10: 10,
    R11: 11,
    R12: 12,
    R13: 13,
    R14: 14,
    R15: 15,
    SCREEN: 16384,
    KBD: 24576,
  };

  addEntry(symbol: string, address: number) {
    this.table[symbol] = address;
  }

  contains(symbol: string): boolean {
    return symbol in this.table;
  }

  getAddress(symbol: string): number {
    return this.table[symbol];
  }
}

const table = new SymbolTable();

// First
let parser = new Parser(INPUT_PATH);
let current = 0;
while (parser.hasMoreCommands()) {
  parser.advance();

  switch (parser.commandType()) {
    case "A_COMMAND":
      current++;
      break;
    case "C_COMMAND":
      current++;
      break;
    case "L_COMMAND":
      table.addEntry(parser.symbol(), current);
      break;
  }
}

// Second
parser = new Parser(INPUT_PATH);
let next = 16;
const lines = [];

while (parser.hasMoreCommands()) {
  parser.advance();

  switch (parser.commandType()) {
    case "A_COMMAND":
      const symbol = parser.symbol();
      let address: number;
      if (symbol.match(/[0-9]+/)) {
        address = parseInt(symbol, 10);
      } else {
        if (!table.contains(symbol)) {
          table.addEntry(symbol, next++);
        }
        address = table.getAddress(symbol);
      }
      lines.push(`0${address.toString(2).padStart(15, "0")}`);
      break;
    case "C_COMMAND":
      const dest = Code.dest(parser.dest());
      const comp = Code.comp(parser.comp());
      const jump = Code.jump(parser.jump());
      lines.push(`111${comp}${dest}${jump}`);
      break;
    case "L_COMMAND":
      break;
  }
}

fs.writeFileSync(OUTPUT_PATH, lines.join("\n"));
