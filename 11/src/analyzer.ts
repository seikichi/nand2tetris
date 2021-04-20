import { Token, Keyword, Symbol } from "./tokenizer";

const operations = ["+", "-", "*", "/", "&", "|", "<", ">", "="] as const;
const unaryOperations = ["-", "~"] as const;

export type Operation = typeof operations[number];
export type UnaryOperation = typeof unaryOperations[number];

export type Type = string;

export type ClassVarDec = {
  kind: "static" | "field";
  type: Type;
  names: string[];
};

export type Parameter = {
  type: Type;
  name: string;
};

export type VarDec = {
  type: Type;
  names: string[];
};

export type SubroutineBody = {
  vars: VarDec[];
  statements: Statement[];
};

export type SubroutineDec = {
  kind: "constructor" | "function" | "method";
  type: "void" | Type;
  name: string;
  parameters: Parameter[];
  body: SubroutineBody;
};

export type Class = {
  name: string;
  classVarDecs: ClassVarDec[];
  subroutineDecs: SubroutineDec[];
};

export type Statement =
  | { type: "let"; name: string; index?: Expression; expression: Expression }
  | {
      type: "if";
      predicate: Expression;
      consequent: Statement[];
      alternative?: Statement[];
    }
  | { type: "while"; predicate: Expression; statements: Statement[] }
  | { type: "do"; call: SubroutineCall }
  | { type: "return"; expression?: Expression };

export type SubroutineCall = {
  type: "subroutine";
  context?: string;
  name: string;
  parameters: Expression[];
};

export type Expression = {
  head: Term;
  tail: { op: Operation; term: Term }[];
};

export type Term =
  | { type: "integer"; val: number }
  | { type: "string"; val: string }
  | { type: "keyword"; val: "true" | "false" | "null" | "this" }
  | { type: "var"; name: string; index?: Expression }
  | SubroutineCall
  | { type: "expression"; expression: Expression }
  | { type: "unary"; op: UnaryOperation; term: Term };

function assertSymbol(tokens: Token[], p: number, symbol: Symbol) {
  const token = tokens[p];
  if (token.type !== "SYMBOL" || token.symbol !== symbol) {
    throw `invalid token: expect symbol (${symbol}), but given ${JSON.stringify(
      token
    )} at ${p}`;
  }
}

function assertKeyword(tokens: Token[], p: number, keyword: Keyword) {
  const token = tokens[p];
  if (token.type !== "KEYWORD" || token.keyword !== keyword) {
    throw `invalid token: expect keyword (${keyword}), but given ${JSON.stringify(
      token
    )} at ${p}`;
  }
}

function getKeywordOrDie(tokens: Token[], p: number): Keyword {
  const token = tokens[p];
  if (token.type !== "KEYWORD") {
    throw `invalid token: expect keyword, but given ${JSON.stringify(
      token
    )} at ${p}`;
  }
  return token.keyword;
}

function getKeyword(tokens: Token[], p: number): Keyword | null {
  const token = tokens[p];
  if (token.type !== "KEYWORD") {
    return null;
  }
  return token.keyword;
}

function getSymbolOrDie(tokens: Token[], p: number): Symbol {
  const token = tokens[p];
  if (token.type !== "SYMBOL") {
    throw `invalid token: expect symbol, but given ${JSON.stringify(
      token
    )} at ${p}`;
  }
  return token.symbol;
}

function getSymbol(tokens: Token[], p: number): Symbol | null {
  const token = tokens[p];
  if (token.type !== "SYMBOL") {
    return null;
  }
  return token.symbol;
}

function getIdentifierOrDie(tokens: Token[], p: number): string {
  const token = tokens[p];
  if (token.type !== "IDENTIFIER") {
    throw `invalid token: expect identifier, but given ${JSON.stringify(
      token
    )} at ${p}`;
  }
  return token.identifier;
}

export function analyze(tokens: Token[]): Class {
  let p = 0;

  assertKeyword(tokens, p++, "class");
  const name = getIdentifierOrDie(tokens, p++);
  assertSymbol(tokens, p++, "{");

  const classVarDecs: ClassVarDec[] = [];
  const subroutineDecs: SubroutineDec[] = [];

  while (isClassVarDec(tokens, p)) {
    let [dec, np] = parseClassVarDec(tokens, p);
    classVarDecs.push(dec);
    p = np;
  }
  while (isSubroutineDec(tokens, p)) {
    let [dec, np] = parseSubroutineDec(tokens, p);
    subroutineDecs.push(dec);
    p = np;
  }

  assertSymbol(tokens, p++, "}");
  return { name, classVarDecs, subroutineDecs };
}

function isClassVarDec(tokens: Token[], p: number): boolean {
  const keyword = getKeyword(tokens, p);
  return keyword === "static" || keyword === "field";
}

function parseClassVarDec(tokens: Token[], p: number): [ClassVarDec, number] {
  const kind = getKeywordOrDie(tokens, p++) as "static" | "field";
  const [type, _] = parseType(tokens, p++);
  const names = [getIdentifierOrDie(tokens, p++)];

  while (getSymbol(tokens, p) === ",") {
    names.push(getIdentifierOrDie(tokens, p + 1));
    p += 2;
  }
  assertSymbol(tokens, p++, ";");
  return [{ kind, type, names }, p];
}

function isSubroutineDec(tokens: Token[], p: number): boolean {
  const k = getKeyword(tokens, p);
  return k === "constructor" || k === "function" || k === "method";
}

function parseSubroutineDec(
  tokens: Token[],
  p: number
): [SubroutineDec, number] {
  const kind = getKeywordOrDie(tokens, p++) as SubroutineDec["kind"];
  const [type, _] = parseTypeOrVoid(tokens, p++);
  const name = getIdentifierOrDie(tokens, p++);
  assertSymbol(tokens, p++, "(");

  const parameters: Parameter[] = [];
  while (getSymbol(tokens, p) !== ")") {
    const [type, _] = parseType(tokens, p++);
    const name = getIdentifierOrDie(tokens, p++);
    parameters.push({ type, name });

    if (getSymbol(tokens, p) !== ")") {
      assertSymbol(tokens, p++, ",");
    }
  }
  assertSymbol(tokens, p++, ")");

  const [body, np] = parseSubroutineBody(tokens, p);
  p = np;

  return [{ kind, type, name, parameters, body }, p];
}

function parseType(tokens: Token[], p: number): [Type, number] {
  const token = tokens[p];
  if (
    token.type === "KEYWORD" &&
    ["int", "char", "boolean"].includes(token.keyword)
  ) {
    return [token.keyword, p + 1];
  }

  if (token.type === "IDENTIFIER") {
    return [token.identifier, p + 1];
  }

  throw "invalid token";
}

function parseTypeOrVoid(tokens: Token[], p: number): [Type | "void", number] {
  if (getKeyword(tokens, p) === "void") {
    return ["void", p + 1];
  }
  return parseType(tokens, p);
}

function parseStatementList(tokens: Token[], p: number): [Statement[], number] {
  const statements: Statement[] = [];
  while (getSymbol(tokens, p) !== "}") {
    const [st, np] = parseStatement(tokens, p);
    statements.push(st);
    p = np;
  }
  return [statements, p];
}

function parseSubroutineBody(
  tokens: Token[],
  p: number
): [SubroutineBody, number] {
  assertSymbol(tokens, p++, "{");

  const vars: VarDec[] = [];
  while (isVarDec(tokens, p)) {
    const [varDec, np] = parseVarDec(tokens, p);
    vars.push(varDec);
    p = np;
  }

  const [statements, np] = parseStatementList(tokens, p);
  p = np;

  assertSymbol(tokens, p++, "}");
  return [{ vars, statements }, p];
}

function isVarDec(tokens: Token[], p: number): boolean {
  return getKeyword(tokens, p) === "var";
}

function parseVarDec(tokens: Token[], p: number): [VarDec, number] {
  assertKeyword(tokens, p++, "var");
  const [type, _] = parseType(tokens, p++);
  const names = [getIdentifierOrDie(tokens, p++)];

  while (getSymbol(tokens, p) === ",") {
    names.push(getIdentifierOrDie(tokens, p + 1));
    p += 2;
  }
  assertSymbol(tokens, p++, ";");
  return [{ type, names }, p];
}

function parseStatement(tokens: Token[], p: number): [Statement, number] {
  if (getKeyword(tokens, p) === "let") {
    assertKeyword(tokens, p++, "let");
    const name = getIdentifierOrDie(tokens, p++);
    let index: Expression | undefined = undefined;
    if (getSymbol(tokens, p) === "[") {
      assertSymbol(tokens, p++, "[");
      const [e, np] = parseExpression(tokens, p);
      index = e;
      p = np;
      assertSymbol(tokens, p++, "]");
    }
    assertSymbol(tokens, p++, "=");
    const [expression, np] = parseExpression(tokens, p);
    p = np;
    assertSymbol(tokens, p++, ";");
    return [{ type: "let", name, index, expression }, p];
  } else if (getKeyword(tokens, p) === "if") {
    assertKeyword(tokens, p++, "if");
    assertSymbol(tokens, p++, "(");
    const [predicate, np1] = parseExpression(tokens, p);
    p = np1;
    assertSymbol(tokens, p++, ")");
    assertSymbol(tokens, p++, "{");
    const [consequent, np2] = parseStatementList(tokens, p);
    p = np2;
    assertSymbol(tokens, p++, "}");
    let alternative: Statement[] | undefined = undefined;
    if (getKeyword(tokens, p) === "else") {
      assertKeyword(tokens, p++, "else");
      assertSymbol(tokens, p++, "{");
      const [expression, np3] = parseStatementList(tokens, p);
      alternative = expression;
      p = np3;
      assertSymbol(tokens, p++, "}");
    }
    return [{ type: "if", predicate, consequent, alternative }, p];
  } else if (getKeyword(tokens, p) === "while") {
    assertKeyword(tokens, p++, "while");
    assertSymbol(tokens, p++, "(");
    const [predicate, np1] = parseExpression(tokens, p);
    p = np1;
    assertSymbol(tokens, p++, ")");
    assertSymbol(tokens, p++, "{");
    const [statements, np2] = parseStatementList(tokens, p);
    p = np2;
    assertSymbol(tokens, p++, "}");
    return [{ type: "while", predicate, statements }, p];
  } else if (getKeyword(tokens, p) === "do") {
    assertKeyword(tokens, p++, "do");
    const [call, np] = parseSubroutineCall(tokens, p);
    p = np;
    assertSymbol(tokens, p++, ";");
    return [{ type: "do", call }, p];
  } else if (getKeyword(tokens, p) === "return") {
    assertKeyword(tokens, p++, "return");
    let expression: Expression | undefined;
    if (getSymbol(tokens, p) !== ";") {
      const [e, np] = parseExpression(tokens, p);
      expression = e;
      p = np;
    }
    assertSymbol(tokens, p++, ";");
    return [{ type: "return", expression }, p];
  } else {
    throw `invalid statement: ${tokens[p]}`;
  }
}

function parseExpression(tokens: Token[], p: number): [Expression, number] {
  const [head, np] = parseTerm(tokens, p);
  p = np;
  const tail: Expression["tail"] = [];

  while (operations.includes(getSymbol(tokens, p) as any)) {
    const op = getSymbolOrDie(tokens, p++) as Operation;
    const [term, np] = parseTerm(tokens, p);
    p = np;
    tail.push({ op, term });
  }
  return [{ head, tail }, p];
}

function parseTerm(tokens: Token[], p: number): [Term, number] {
  const token = tokens[p];
  if (token.type === "INT_CONST") {
    return [{ type: "integer", val: token.val }, p + 1];
  } else if (token.type === "STRING_CONST") {
    return [{ type: "string", val: token.val }, p + 1];
  } else if (token.type === "KEYWORD") {
    const keyword = token.keyword;
    if (!["true", "false", "null", "this"].includes(keyword)) {
      throw `invalid keyword: ${keyword}`;
    }
    return [{ type: "keyword", val: keyword as any }, p + 1];
  } else if (token.type === "IDENTIFIER") {
    if (p + 1 < tokens.length && getSymbol(tokens, p + 1) === "(") {
      return parseSubroutineCall(tokens, p);
    }
    if (p + 1 < tokens.length && getSymbol(tokens, p + 1) === ".") {
      return parseSubroutineCall(tokens, p);
    }
    if (p + 1 < tokens.length && getSymbol(tokens, p + 1) === "[") {
      const name = getIdentifierOrDie(tokens, p++);
      assertSymbol(tokens, p++, "[");
      const [index, np] = parseExpression(tokens, p);
      p = np;
      assertSymbol(tokens, p++, "]");
      return [{ type: "var", index, name }, p];
    } else {
      return [{ type: "var", name: getIdentifierOrDie(tokens, p) }, p + 1];
    }
  } else if (getSymbol(tokens, p) === "(") {
    assertSymbol(tokens, p++, "(");
    const [expression, np] = parseExpression(tokens, p);
    p = np;
    assertSymbol(tokens, p++, ")");
    return [{ type: "expression", expression }, p];
  } else if (
    token.type === "SYMBOL" &&
    unaryOperations.includes(token.symbol as any)
  ) {
    p++;
    const [term, np] = parseTerm(tokens, p);
    p = np;
    return [{ type: "unary", op: token.symbol as any, term }, p];
  }
  throw `invalid term: ${JSON.stringify(tokens[p])}`;
}

function parseSubroutineCall(
  tokens: Token[],
  p: number
): [SubroutineCall, number] {
  if (getSymbol(tokens, p + 1) !== ".") {
    const name = getIdentifierOrDie(tokens, p++);
    assertSymbol(tokens, p++, "(");
    const [parameters, np] = parseExpressionList(tokens, p);
    assertSymbol(tokens, p++, ")");
    return [{ type: "subroutine", name, parameters }, p];
  } else {
    const context = getIdentifierOrDie(tokens, p++);
    assertSymbol(tokens, p++, ".");
    const name = getIdentifierOrDie(tokens, p++);
    assertSymbol(tokens, p++, "(");
    const [parameters, np] = parseExpressionList(tokens, p);
    p = np;
    assertSymbol(tokens, p++, ")");
    return [{ type: "subroutine", context, name, parameters }, p];
  }
}

function parseExpressionList(
  tokens: Token[],
  p: number
): [Expression[], number] {
  if (getSymbol(tokens, p) === ")") {
    return [[], p];
  }
  const [first, np] = parseExpression(tokens, p);
  p = np;

  const expressions = [first];
  while (getSymbol(tokens, p) === ",") {
    assertSymbol(tokens, p++, ",");
    const [e, np] = parseExpression(tokens, p);
    expressions.push(e);
    p = np;
  }
  return [expressions, p];
}
