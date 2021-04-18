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

type SubroutineDec = {
  kind: "constructor" | "function" | "method";
  type: "void" | Type;
  name: string;
  parameters: {
    type: Type;
    name: string;
  }[];
  body: {
    vars: {
      type: Type;
      names: string[];
    }[];
    statements: Statement[];
  };
};

type Class = {
  name: string;
  classVarDecs: ClassVarDec[];
  subroutineDecs: SubroutineDec[];
};

type Statement =
  | { type: "let"; var: string; index?: Expression; expression: Expression }
  | {
      type: "if";
      predicate: Expression;
      consequent: Expression;
      alternative: Expression;
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

function analyze(tokens: Token[]): Class {
  if (tokens[0].type !== "KEYWORD" || tokens[0].keyword !== "class") {
    throw `invalid tokens: ${tokens[0]}`;
  }
  if (tokens[1].type !== "IDENTIFIER") {
    throw `invalid tokens: ${tokens[1]}`;
  }
  const name = tokens[1].identifier;
  const classVarDecs: ClassVarDec[] = [];
  const subroutineDecs: SubroutineDec[] = [];

  let p = 3;
  while (isClassVarDec(tokens, p)) {
    let [dec, np] = analyzeClassVarDec(tokens, p);
    classVarDecs.push(dec);
    p = np;
  }
  while (isSubroutineDec(tokens, p)) {
    let [dec, np] = analyzeSubroutineDec(tokens, p);
    subroutineDecs.push(dec);
    p = np;
  }
  const last = tokens[p];
  if (last.type !== "SYMBOL" || last.symbol !== "}") {
    throw "invalid tokens";
  }

  return { name, classVarDecs, subroutineDecs };
}

function isClassVarDec(tokens: Token[], p: number): boolean {
  const t = tokens[p];
  return t.type === "KEYWORD" && ["static", "field"].includes(t.keyword);
}

function analyzeClassVarDec(tokens: Token[], p: number): [ClassVarDec, number] {
  let token = tokens[p];
  if (token.type !== "KEYWORD") {
    throw "invalid tokens";
  }
  const kind = token.keyword as "static" | "field";
  const [type, _] = parseType(tokens, p + 1);
  const names = [(tokens[p + 2] as any).identifier];

  p = p + 3;
  while ((tokens[p] as any).symbol === ",") {
    names.push((tokens[p + 1] as any).identifier);
    p += 2;
  }

  return [{ kind, type, names }, p + 1];
}

function isSubroutineDec(tokens: Token[], p: number): boolean {
  const t = tokens[p];
  return (
    t.type === "KEYWORD" &&
    ["constructor", "function", "method"].includes(t.keyword)
  );
}

function analyzeSubroutineDec(
  tokens: Token[],
  p: number
): [SubroutineDec, number] {
  return null as any;
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

const tree = analyze(tokens);
console.log(tree);
