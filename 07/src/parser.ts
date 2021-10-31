import { ARITH_LOGIC_COMMANDS, Command } from "./vm";

const COMMAND_TO_TYPE: { [command: string]: Command["type"] } = {
  ...Object.fromEntries(ARITH_LOGIC_COMMANDS.map((c) => [c, "ARITHMETIC"])),
  push: "PUSH",
  pop: "POP",
};

function parseLine(raw: string): Command | null {
  const line = raw.replace(/\/\/.*$/, "").trim();
  if (line === "") {
    return null;
  }

  // TODO: remove any, redundant code...
  const terms = line.split(/\s+/);
  if (terms.length === 1 && ARITH_LOGIC_COMMANDS.includes(terms[0] as any)) {
    return { type: COMMAND_TO_TYPE[terms[0]] as any, args: [terms[0] as any] };
  }
  if (terms.length === 2) {
    return { type: COMMAND_TO_TYPE[terms[0]] as any, args: [terms[1] as any] };
  }
  if (terms.length === 3) {
    return {
      type: COMMAND_TO_TYPE[terms[0]] as any,
      args: [terms[1] as any, parseInt(terms[2], 10)],
    };
  }
  throw `Unknown Command: ${raw}`;
}

export function parse(source: string): Command[] {
  const commands = [];
  for (const line of source.split(/\r?\n/)) {
    const c = parseLine(line);
    if (!c) {
      continue;
    }
    commands.push(c);
  }
  return commands;
}
