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

export type ARITH_LOGIC_COMMAND_TYPE = typeof ARITH_LOGIC_COMMANDS[number];

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

export type SEGMENT_TYPE = typeof SEGMENTS[number];

export type Command =
  | { type: "arithmetic"; args: [ARITH_LOGIC_COMMAND_TYPE] }
  | { type: "push"; args: [SEGMENT_TYPE, number] }
  | { type: "pop"; args: [SEGMENT_TYPE, number] }
  | { type: "label"; args: [string] }
  | { type: "goto"; args: [string] }
  | { type: "if-goto"; args: [string] }
  | { type: "function"; args: [string, number] }
  | { type: "return" }
  | { type: "call"; args: [string, number] };

export function showCommand(command: Command): string {
  if (command.type === "return") {
    return `${command.type}`;
  }
  return `${command.type} ${command.args.map((a: any) => `${a}`).join(" ")}`;
}
