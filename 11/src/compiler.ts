import { strict as assert } from "assert";

import {
  Class,
  Expression,
  Operation,
  Statement,
  SubroutineCall,
  Term,
} from "./analyzer";
import { ARITH_LOGIC_COMMAND_TYPE, Command } from "./vm";

export function* compile(klass: Class): Iterable<Command> {
  assert(klass.classVarDecs.length === 0, "classVarDecs not implemented");

  for (const dec of klass.subroutineDecs) {
    const name = `${klass.name}.${dec.name}`;

    assert(dec.kind === "function", "method, ctor not implemented");
    yield { type: "function", args: [name, dec.parameters.length] };

    assert(dec.body.vars.length === 0, "vars not implemented");
    for (const s of dec.body.statements) {
      yield* compileStatement(s);
    }
  }
}

function* compileStatement(s: Statement): Iterable<Command> {
  switch (s.type) {
    // case "let":
    //   break;
    // case "if":
    //   break;
    // case "while":
    //   break;
    case "do":
      yield* compileSubroutineCall(s.call);
      yield { type: "pop", args: ["temp", 0] };
      break;
    case "return":
      assert(!s.expression, "return expression not supported");
      yield { type: "push", args: ["constant", 0] };
      yield { type: "return" };
      break;
    default:
      assert(false, `${s.type} not supported`);
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

function* compileExpression(e: Expression): Iterable<Command> {
  yield* compileTerm(e.head);
  for (const { op, term } of e.tail) {
    yield* compileTerm(term);
    yield compileOperation(op);
  }
}

function* compileTerm(t: Term): Iterable<Command> {
  switch (t.type) {
    case "expression":
      yield* compileExpression(t.expression);
      break;
    case "integer":
      yield { type: "push", args: ["constant", t.val] };
      break;
    default:
      assert(false, `${t.type} not supported`);
  }
}

function* compileSubroutineCall(s: SubroutineCall): Iterable<Command> {
  assert(!!s.context, "no context not supported");

  for (const p of s.parameters) {
    yield* compileExpression(p);
  }

  const name = `${s.context}.${s.name}`;
  yield { type: "call", args: [name, s.parameters.length] };
}
