import { Command } from "./command";

const cPattern = "[^;]+";
const dPattern = "M|D|MD|A|AM|AD|AMD";
const jPattern = "JGT|JEQ|JGE|JLT|JNE|JLE|JMP";
const symbol = "[A-Za-z_.$:][0-9A-Za-z_.$:]*";
const aCommandPattern = new RegExp(`^@(?<symbol>${symbol}|[0-9]+)$`);
const lCommandPattern = new RegExp(`^\\((?<symbol>${symbol})\\)$`);
const cCommandPattern = new RegExp(
  `^((?<dest>${dPattern})=)?(?<comp>${cPattern})(;(?<jump>${jPattern}))?$`
);

function parseLine(rawLine: string): Command | null {
  // Remove whitelines, comments
  const line = rawLine.replace(/\s+/g, "").replace(/\/\/.*$/, "");

  let match = line.match(lCommandPattern);
  if (match) {
    const { symbol } = match.groups!;
    return { type: "L", symbol };
  }

  match = line.match(aCommandPattern);
  if (match) {
    const s = match.groups!.symbol;
    const isNumber = s.match(/^[0-9]+$/);
    const symbol = isNumber ? parseInt(s, 10) : s;
    return { type: "A", symbol };
  }

  match = line.match(cCommandPattern);
  if (match) {
    const { dest, comp, jump } = match.groups!;
    return { type: "C", dest, comp, jump };
  }
  return null;
}

export function parse(source: string): Command[] {
  const commands: Command[] = [];
  for (const line of source.split(/\r?\n/)) {
    const c = parseLine(line);
    if (!c) {
      continue;
    }
    commands.push(c);
  }

  return commands;
}
