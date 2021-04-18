import * as fs from "fs";

const keywords = [
  "class",
  "constructor",
  "function",
  "method",
  "field",
  "static",
  "var",
  "int",
  "char",
  "boolean",
  "void",
  "true",
  "false",
  "null",
  "this",
  "let",
  "do",
  "if",
  "else",
  "while",
  "return",
] as const;

type Keyword = typeof keywords[number];

const symbols = [
  "{",
  "}",
  "(",
  ")",
  "[",
  "]",
  ".",
  ",",
  ";",
  "+",
  "-",
  "*",
  "/",
  "&",
  "|",
  "<",
  ">",
  "=",
  "~",
] as const;

type Symbol = typeof symbols[number];

type Token =
  | { type: "KEYWORD"; keyword: Keyword }
  | { type: "SYMBOL"; symbol: Symbol }
  | { type: "IDENTIFIER"; identifier: string }
  | { type: "INT_CONST"; val: number }
  | { type: "STRING_CONST"; val: string };

function escapeRegExp(s: string) {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenize(source: string): Token[] {
  const symbolP = symbols.map(escapeRegExp).join("|");
  const integerP = "\\d+";
  const stringP = '"[^"]*"';
  const identifierP = "[A-Za-z_][0-9A-Za-z_]*";
  const pattern = new RegExp(
    `\\s*(?:(?<symbol>${symbolP})|(?<integer>${integerP})|(?<string>${stringP})|(?<identifier>${identifierP}))\\s*`,
    "g"
  );
  const matches = source.matchAll(pattern);
  const tokens: Token[] = [];
  for (const match of matches) {
    const { symbol, integer, string, identifier } = match.groups!;
    if (symbol) {
      tokens.push({ type: "SYMBOL", symbol: symbol as Symbol });
    } else if (integer) {
      tokens.push({ type: "INT_CONST", val: parseInt(integer, 10) });
    } else if (string) {
      tokens.push({ type: "STRING_CONST", val: string.slice(1, -1) });
    } else if (identifier) {
      if (keywords.includes(identifier as any)) {
        tokens.push({ type: "KEYWORD", keyword: identifier as Keyword });
      } else {
        tokens.push({ type: "IDENTIFIER", identifier });
      }
    } else {
      throw "invalid source";
    }
  }
  return tokens;
}

function preprocess(source: string): string {
  return source.replace(/\/\/.*/g, "").replace(/\/\*(.*?)\*\//gs, "");
}

function escapeXml(unsafe: string) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

function toXmlFromTokens(tokens: Token[]): string {
  return [
    "<tokens>",
    ...tokens.map((t) => {
      switch (t.type) {
        case "KEYWORD":
          return `<keyword> ${escapeXml(t.keyword)} </keyword>`;
        case "SYMBOL":
          return `<symbol> ${escapeXml(t.symbol)} </symbol>`;
        case "IDENTIFIER":
          return `<identifier> ${escapeXml(t.identifier)} </identifier>`;
        case "INT_CONST":
          return `<integerConstant> ${t.val} </integerConstant>`;
        case "STRING_CONST":
          return `<stringConstant> ${escapeXml(t.val)} </stringConstant>`;
      }
    }),
    "</tokens>",
  ].join("\n");
}

const operations = ["+", "-", "*", "/", "&", "|", "<", ">", "="] as const;
const unaryOperations = ["-", "~"] as const;

type Operation = typeof operations[number];
type UnaryOperation = typeof unaryOperations[number];

type Type = "int" | "char" | "boolean" | { type: "class"; name: string };

type ClassVarDec = {
  kind: "static" | "field";
  type: Type;
  names: string[];
};

type Parameter = {
  type: Type;
  name: string;
};

type VarDec = {
  type: Type;
  names: string[];
};

type SubroutineBody = {
  vars: VarDec[];
  statements: Statement[];
};

type SubroutineDec = {
  kind: "constructor" | "function" | "method";
  type: "void" | Type;
  name: string;
  parameters: Parameter[];
  body: SubroutineBody;
};

type Class = {
  name: string;
  classVarDecs: ClassVarDec[];
  subroutineDecs: SubroutineDec[];
};

type Statement =
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

type SubroutineCall = {
  type: "subroutine";
  context?: string;
  name: string;
  parameters: Expression[];
};

type Expression = {
  head: Term;
  tail: { op: Operation; term: Term }[];
};

type Term =
  | { type: "integer"; val: number }
  | { type: "string"; val: string }
  | { type: "keyword"; val: "true" | "false" | "null" | "this" }
  | { type: "var"; name: string; index?: Expression }
  | SubroutineCall
  | { type: "expression"; expression: Expression }
  | { type: "unary"; op: UnaryOperation; term: Term };

if (process.argv.length !== 3) {
  throw "assembler: missing operand"; // FIXME
}

const INPUT_PATH = process.argv[2];
const OUTPUT_PATH = INPUT_PATH.replace(/\.jack$/, ".test.xml"); // FIXME: support folder

const source = fs.readFileSync(INPUT_PATH, { encoding: "utf-8" });
const tokens = tokenize(preprocess(source));

// const out = toXmlFromTokens(tokens);
// fs.writeFileSync(OUTPUT_PATH, out);

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

function getIdentifier(tokens: Token[], p: number): string | null {
  const token = tokens[p];
  if (token.type !== "IDENTIFIER") {
    return null;
  }
  return token.identifier;
}

function analyze(tokens: Token[]): Class {
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

  // FIXME
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
    return [token.keyword as Type, p + 1];
  }

  if (token.type === "IDENTIFIER") {
    return [{ type: "class", name: token.identifier }, p + 1];
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
      const [index, np] = parseExpression(tokens, p);
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

const tree = analyze(tokens);

function toXml(klass: Class): string {
  return `\
<class>
  <keyword> class </keyword>
  <identifier> ${klass.name} </identifier>
  <symbol> { </symbol>
    ${klass.classVarDecs.map(toXmlFromClassVarDec).join("\n")}
    ${klass.subroutineDecs.map(toXmlFromSubroutineDecs).join("\n")}
  <symbol> } </symbol>
</class>
`;
}

function toXmlFromClassVarDec(dec: ClassVarDec): string {
  return `\
  <classVarDec>
    <keyword> ${dec.kind} </keyword>
    <keyword> ${dec.type} </keyword>
    ${dec.names
      .map((n) => `<identifier> ${n} </identifier>`)
      .join("<symbol> , </symbol>")}
    <symbol> ; </symbol>
  </classVarDec>
  `;
}

function toXmlFromSubroutineDecs(dec: SubroutineDec): string {
  return `\
  <subroutineDec>
    <keyword> ${dec.kind} </keyword>
    <keyword> ${dec.type} </keyword>
    <identifier> ${dec.name} </identifier>
    <symbol> ( </symbol>
    <parameterList>
      ${dec.parameters.map(toXmlFromParameter).join("<symbol> , </symbol>")}
    </parameterList>
    <symbol> ) </symbol>
    <subroutineBody>
      <symbol> { </symbol>
        ${dec.body.vars.map(toXmlFromVarDec).join("\n")}
        <statements>
        </statements>
      <symbol> } </symbol>
    </subroutineBody>
  </subroutineDec>
  `; // ${dec.body.statements.map(toXmlFromStatement).join("\n")}
}

function toXmlFromParameter(p: Parameter): string {
  return `<keyword> ${p.type} </keyword><identifier> ${p.name} </identifier>`;
}
function toXmlFromVarDec(dec: VarDec): string {
  return `
    <varDec>
      <keyword> var </keyword>
      ${toXmlFromType(dec.type)}
      ${dec.names
        .map((n) => `<identifier> ${n} </identifier>`)
        .join("<symbol> , </symbol>")}
        <symbol> ; </symbol>
    </varDec>
  `;
}

function toXmlFromType(t: Type): string {
  if (t === "int" || t === "char" || t === "boolean") {
    return `<keyword> ${t} </keyword>`;
  }
  return `<identifier> ${t.name} </identifier>`;
}

function toXmlFromStatement(s: Statement): string {
  // return `<keyword> ${p.type} </keyword><identifier> ${p.name} </identifier>`;
  return "";
}

const out = toXml(tree);
fs.writeFileSync(OUTPUT_PATH, out);
