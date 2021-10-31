export const ARITH_LOGIC_COMMANDS = [
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

export const SEGMENTS = [
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
  | { type: "ARITHMETIC"; args: [ARITH_LOGIC_COMMAND_TYPE] }
  | { type: "PUSH"; args: [SEGMENT_TYPE, number] }
  | { type: "POP"; args: [SEGMENT_TYPE, number] };
