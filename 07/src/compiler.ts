import { HackOperation } from "./hack";
import { Command, SEGMENT_TYPE } from "./vm";

function compileCommand(
  command: Command,
  filename: string,
  uniqueNumber: number
): HackOperation[] {
  if (command.type === "ARITHMETIC") {
    const op = command.args[0];

    if (op === "neg") {
      return ["@SP", "A=M-1", "M=-M"];
    }
    if (op === "not") {
      return ["@SP", "A=M-1", "M=!M"];
    }

    if (op === "add" || op === "sub" || op == "and" || op === "or") {
      const op2asm = {
        add: "M=D+M",
        sub: "M=M-D",
        and: "M=D&M",
        or: "M=D|M",
      } as const;

      return ["@SP", "M=M-1", "A=M", "D=M", "A=A-1", op2asm[op]];
    }

    const label = `$ARITHMETIC.${filename}.${uniqueNumber}`;
    const op2jump = {
      eq: "JEQ",
      lt: "JLT",
      gt: "JGT",
    } as const;

    return [
      "@SP",
      "M=M-1",
      "A=M",
      "D=M",
      "A=A-1",
      "D=M-D",
      "M=-1",
      `@${label}`,
      `D;${op2jump[op]}`,
      "@SP",
      "A=M-1",
      "M=0",
      `(${label})`,
    ];
  }

  if (command.type === "PUSH") {
    const [segment, index] = command.args;
    const seg2ops: { [s in SEGMENT_TYPE]: HackOperation[] } = {
      argument: ["@ARG", "D=M", `@${index}`, "A=D+A", "D=M"],
      local: ["@LCL", "D=M", `@${index}`, "A=D+A", "D=M"],
      this: ["@THIS", "D=M", `@${index}`, "A=D+A", "D=M"],
      that: ["@THAT", "D=M", `@${index}`, "A=D+A", "D=M"],
      constant: [`@${index}`, "D=A"],
      static: [`@${filename}.${index}`, "D=M"],
      pointer: [(["@THIS", "@THAT"] as const)[index], "D=M"],
      temp: [`@R${index + 5}`, "D=M"],
    };

    return [...seg2ops[segment], "@SP", "M=M+1", "A=M-1", "M=D"];
  }

  if (command.type === "POP") {
    const [segment, index] = command.args;
    if (segment === "constant") {
      throw `Invalid POP: ${command}`;
    }

    if (segment === "static" || segment === "pointer" || segment === "temp") {
      const seg2addr = {
        static: `@${filename}.${index}`,
        pointer: (["@THIS", "@THAT"] as const)[index],
        temp: `@R${index + 5}`,
      } as const;

      return ["@SP", "M=M-1", "A=M", "D=M", seg2addr[segment], "M=D"];
    }

    const seg2addr = {
      argument: "@ARG",
      local: "@LCL",
      this: "@THIS",
      that: "@THAT",
    } as const;

    return [
      seg2addr[segment],
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

  const _: never = command;
  throw `Invalid Command: ${JSON.stringify(command)}`;
}

export function compile(items: Command[], filename: string): HackOperation[] {
  const ops: HackOperation[] = [];
  let uniqueNumber = 0;
  for (const command of items) {
    ops.push(...compileCommand(command, filename, uniqueNumber++));
  }
  return ops;
}
