import { HackOperation } from "./hack";
import { Command } from "./vm";

function compileCommand(
  command: Command,
  filename: string,
  uniqueNumber: number
): HackOperation[] {
  // ARITHMETIC
  if (command.type === "ARITHMETIC") {
    const op = command.args[0];

    if (op === "neg") {
      return ["@SP", "A=M-1", "M=-M"];
    }
    if (op === "not") {
      return ["@SP", "A=M-1", "M=!M"];
    }

    if (op === "add" || op === "sub" || op == "and" || op === "or") {
      return [
        "@SP",
        "M=M-1",
        "A=M",
        "D=M",
        "A=A-1",
        (
          {
            add: "M=D+M",
            sub: "M=M-D",
            and: "M=D&M",
            or: "M=D|M",
          } as const
        )[op],
      ];
    }

    const label = `$ARITHMETIC.${filename}.${uniqueNumber}`;
    const jump = (
      {
        eq: "JEQ",
        lt: "JLT",
        gt: "JGT",
      } as const
    )[op];
    return [
      "@SP",
      "M=M-1",
      "A=M",
      "D=M",
      "A=A-1",
      "D=M-D",
      "M=-1",
      `@${label}`,
      `D;${jump}`,
      "@SP",
      "A=M-1",
      "M=0",
      `(${label})`,
    ];
  }

  // PUSH
  if (command.type === "PUSH") {
    const [segment, index] = command.args;
    return [
      ...(
        {
          argument: ["@ARG", "D=M", `@${index}`, "A=D+A", "D=M"],
          local: ["@LCL", "D=M", `@${index}`, "A=D+A", "D=M"],
          this: ["@THIS", "D=M", `@${index}`, "A=D+A", "D=M"],
          that: ["@THAT", "D=M", `@${index}`, "A=D+A", "D=M"],
          constant: [`@${index}`, "D=A"],
          static: [`@${filename}.${index}`, "D=M"],
          pointer: [["@THIS", "@THAT"][index], "D=M"],
          temp: [`@R${index + 5}`, "D=M"],
        } as { [segment: string]: HackOperation[] }
      )[segment],
      "@SP",
      "M=M+1",
      "A=M-1",
      "M=D",
    ];
  }
  // POP
  if (command.type === "POP") {
    const [segment, index] = command.args;
    if (segment === "constant") {
      throw `Invalid POP: ${command}`;
    }
    if (segment === "static" || segment === "pointer" || segment === "temp") {
      return [
        "@SP",
        "M=M-1",
        "A=M",
        "D=M",
        (
          {
            static: `@${filename}.${index}`,
            pointer: ["@THIS", "@THAT"][index],
            temp: `@R${index + 5}`,
          } as { [segment: string]: HackOperation }
        )[segment],
        "M=D",
      ];
    }

    return [
      (
        {
          argument: "@ARG",
          local: "@LCL",
          this: "@THIS",
          that: "@THAT",
        } as { [segment: string]: HackOperation }
      )[segment],
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
