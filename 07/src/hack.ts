type AddressOperation = `@${string}`;

type DestPart = "M" | "D" | "MD" | "A" | "AM" | "AD" | "AMD";
type JumpPart = "JGT" | "JEQ" | "JGE" | "JLT" | "JNE" | "JLE" | "JMP";
type CompPart =
  | "0"
  | "1"
  | "-1"
  | "D"
  | "A"
  | "!D"
  | "!A"
  | "-D"
  | "-A"
  | "D+1"
  | "A+1"
  | "D-1"
  | "A-1"
  | "D+A"
  | "D-A"
  | "A-D"
  | "D&A"
  | "D|A"
  | "M"
  | "!M"
  | "-M"
  | "M+1"
  | "M-1"
  | "D+M"
  | "D-M"
  | "M-D"
  | "D&M"
  | "D|M";

type CommandOperation =
  | `${CompPart}`
  | `${DestPart}=${CompPart}`
  | `${CompPart};${JumpPart}`
  | `${DestPart}=${CompPart};${JumpPart}`;

type LabelCommand = `(${string})`;

export type HackOperation = AddressOperation | CommandOperation | LabelCommand;
