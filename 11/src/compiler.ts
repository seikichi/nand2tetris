import { strict as assert } from "assert";

import {
  Class,
  Expression,
  Operation,
  Statement,
  SubroutineCall,
  SubroutineDec,
  Term,
  Type,
} from "./analyzer";
import { Command, SEGMENT_TYPE } from "./vm";

type Kind = "static" | "field" | "argument" | "var";
type Symbol = { type: Type; kind: Kind; index: number };
type SymbolTable = { [name: string]: Symbol | undefined };

function createSymbolTable(
  klass: Class,
  subroutineDec: SubroutineDec
): SymbolTable {
  let index;
  const table: SymbolTable = {};

  // Add static
  index = 0;
  for (const { kind, type, names } of klass.classVarDecs) {
    if (kind === "static") {
      for (const name of names) {
        table[name] = { type, kind, index: index++ };
      }
    }
  }
  // Add field
  index = 0;
  for (const { kind, type, names } of klass.classVarDecs) {
    if (kind === "field") {
      for (const name of names) {
        table[name] = { type, kind, index: index++ };
      }
    }
  }

  // Add arguments
  index = 0;
  if (subroutineDec.kind === "method") {
    table["this"] = { type: klass.name, kind: "argument", index: index++ };
  }
  for (const { name, type } of subroutineDec.parameters) {
    table[name] = { type, kind: "argument", index: index++ };
  }

  // Add vars
  index = 0;
  for (const { names, type } of subroutineDec.body.vars) {
    for (const name of names) {
      table[name] = { type, kind: "var", index: index++ };
    }
  }

  return table;
}

export function* compile(klass: Class): Iterable<Command> {
  for (const dec of klass.subroutineDecs) {
    const name = `${klass.name}.${dec.name}`;
    const table = createSymbolTable(klass, dec);
    const nlocals = dec.body.vars.reduce((sum, d) => sum + d.names.length, 0);

    yield { type: "function", args: [name, nlocals] };

    if (dec.kind === "method") {
      yield { type: "push", args: ["argument", 0] };
      yield { type: "pop", args: ["pointer", 0] };
    }

    let i = 0;
    for (const s of dec.body.statements) {
      const label = `${name}.${i++}`;
      yield* compileStatement(s, table, label);
    }
  }
}

function* compileStatement(
  s: Statement,
  table: SymbolTable,
  label: string
): Iterable<Command> {
  let i = 0;
  const L1 = `${label}.L1`;
  const L2 = `${label}.L2`;

  switch (s.type) {
    case "let":
      yield* compileExpression(s.expression, table);

      if (s.index) {
        yield compileSymbol(table[s.name]!, "push");
        yield* compileExpression(s.index, table);
        yield { type: "arithmetic", args: ["add"] };
        yield { type: "pop", args: ["pointer", 1] };
        yield { type: "pop", args: ["that", 0] };
      } else {
        yield compileSymbol(table[s.name]!, "pop");
      }
      break;

    case "if":
      yield* compileExpression(s.predicate, table);
      yield { type: "arithmetic", args: ["not"] };
      yield { type: "if-goto", args: [L1] };

      for (const st of s.consequent) {
        const nlabel = `${label}.${i++}`;
        yield* compileStatement(st, table, nlabel);
      }
      yield { type: "goto", args: [L2] };
      yield { type: "label", args: [L1] };

      if (s.alternative) {
        for (const st of s.alternative) {
          const nlabel = `${label}.${i++}`;
          yield* compileStatement(st, table, nlabel);
        }
      }

      yield { type: "label", args: [L2] };
      break;

    case "while":
      yield { type: "label", args: [L1] };
      yield* compileExpression(s.predicate, table);
      yield { type: "arithmetic", args: ["not"] };
      yield { type: "if-goto", args: [L2] };
      for (const st of s.statements) {
        const nlabel = `${label}.${i++}`;
        yield* compileStatement(st, table, nlabel);
      }
      yield { type: "goto", args: [L1] };
      yield { type: "label", args: [L2] };
      break;

    case "do":
      yield* compileSubroutineCall(s.call, table);
      yield { type: "pop", args: ["temp", 0] };
      break;

    case "return":
      if (s.expression) {
        yield* compileExpression(s.expression, table);
      } else {
        yield { type: "push", args: ["constant", 0] };
      }
      yield { type: "return" };
      break;
  }
}

function compileOperation(op: Operation): Command {
  switch (op) {
    case "+":
      return { type: "arithmetic", args: ["add"] };
    case "-":
      return { type: "arithmetic", args: ["sub"] };
    case "*":
      return { type: "call", args: ["Math.multiply", 2] };
    case "/":
      return { type: "call", args: ["Math.divide", 2] };
    case "&":
      return { type: "arithmetic", args: ["and"] };
    case "|":
      return { type: "arithmetic", args: ["or"] };
    case "<":
      return { type: "arithmetic", args: ["lt"] };
    case ">":
      return { type: "arithmetic", args: ["gt"] };
    case "=":
      return { type: "arithmetic", args: ["eq"] };
  }
}

function* compileExpression(
  e: Expression,
  table: SymbolTable
): Iterable<Command> {
  yield* compileTerm(e.head, table);
  for (const { op, term } of e.tail) {
    yield* compileTerm(term, table);
    yield compileOperation(op);
  }
}

function* compileTerm(t: Term, table: SymbolTable): Iterable<Command> {
  switch (t.type) {
    case "expression":
      yield* compileExpression(t.expression, table);
      break;
    case "integer":
      yield { type: "push", args: ["constant", t.val] };
      break;
    case "subroutine":
      yield* compileSubroutineCall(t, table);
      break;
    case "var":
      yield compileSymbol(table[t.name]!, "push");
      if (t.index) {
        yield* compileExpression(t.index, table);
        yield { type: "arithmetic", args: ["add"] };
        yield { type: "pop", args: ["pointer", 1] };
        yield { type: "push", args: ["that", 0] };
      }
      break;
    case "unary":
      const op = ({ "-": "neg", "~": "not" } as const)[t.op];
      yield* compileTerm(t.term, table);
      yield { type: "arithmetic", args: [op] };
      break;
    case "keyword":
      yield* compileKeyword(t.val);
      break;
    case "string":
      yield { type: "push", args: ["constant", t.val.length] };
      yield { type: "call", args: ["String.new", 1] };
      for (const c of t.val) {
        yield { type: "push", args: ["constant", c.charCodeAt(0)] };
        yield { type: "call", args: ["String.appendChar", 2] };
      }
      break;
  }
}

function* compileKeyword(
  k: "true" | "false" | "null" | "this"
): Iterable<Command> {
  switch (k) {
    case "true":
      yield { type: "push", args: ["constant", 1] };
      yield { type: "arithmetic", args: ["neg"] };
      break;
    case "false":
      yield { type: "push", args: ["constant", 0] };
      break;
    case "null":
      yield { type: "push", args: ["constant", 0] };
      break;
    case "this":
      yield { type: "push", args: ["pointer", 0] };
      break;
  }
}

// TODO: Fix this ugly parameter...
function compileSymbol(s: Symbol, type: "push" | "pop"): Command {
  switch (s.kind) {
    case "static":
      return { type, args: ["static", s.index] };
    case "field":
      return { type, args: ["this", s.index] };
    case "argument":
      return { type, args: ["argument", s.index] };
    case "var":
      return { type, args: ["local", s.index] };
  }
}

function* compileSubroutineCall(
  s: SubroutineCall,
  table: SymbolTable
): Iterable<Command> {
  assert(!!s.context, "no context not supported");

  for (const p of s.parameters) {
    yield* compileExpression(p, table);
  }

  const name = `${s.context}.${s.name}`;
  yield { type: "call", args: [name, s.parameters.length] };
}
