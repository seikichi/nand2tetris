import { Command } from "./command";

export type Table = { [symbol: string]: number };

export function makeTable(commands: Command[]): Table {
  const table: Table = {
    SP: 0,
    LCL: 1,
    ARG: 2,
    THIS: 3,
    THAT: 4,
    SCREEN: 16384,
    KBD: 24576,
    ...Object.fromEntries(new Array(16).fill(0).map((_, i) => [`R${i}`, i])),
  };

  let current = 0;
  for (const command of commands) {
    if (command.type === "L") {
      table[command.symbol] = current;
      continue;
    }
    current++;
  }

  let next = 16;
  for (const command of commands) {
    if (command.type === "A") {
      const { symbol } = command;
      if (typeof symbol === "string" && !(symbol in table)) {
        table[symbol] = next++;
      }
    }
  }

  return table;
}
