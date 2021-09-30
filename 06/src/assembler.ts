import { Command } from "./command";
import { Table } from "./table";

const DEST_TO_CODE: { [dest: string]: string } = {
  M: "001",
  D: "010",
  MD: "011",
  A: "100",
  AM: "101",
  AD: "110",
  AMD: "111",
};

const JUMP_TO_CODE: { [jump: string]: string } = {
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

const COMP_TO_CODE = Object.fromEntries(
  Object.entries(CODE_TO_COMP).flatMap(([code, cs]) =>
    cs.map((c, i) => [c, `${i}${code}`])
  )
);

function fromDest(mnemonic: string | undefined): string {
  return mnemonic ? DEST_TO_CODE[mnemonic]! : "000";
}

function fromComp(mnemonic: string): string {
  return COMP_TO_CODE[mnemonic]!;
}

function fromJump(mnemonic: string | undefined): string {
  return mnemonic ? JUMP_TO_CODE[mnemonic] : "000";
}

function assembleCommand(c: Command, table: Table): string | null {
  if (c.type === "C") {
    const { dest, comp, jump } = c;
    return `111${fromComp(comp)}${fromDest(dest)}${fromJump(jump)}`;
  }

  if (c.type === "A") {
    const address = typeof c.symbol === "number" ? c.symbol : table[c.symbol];
    return `0${address.toString(2).padStart(15, "0")}`;
  }
  return null;
}

export function assemble(commands: Command[], table: Table): string {
  const lines: string[] = [];
  for (const command of commands) {
    const code = assembleCommand(command, table);
    if (!code) {
      continue;
    }

    lines.push(code);
  }
  return lines.join("\n");
}
