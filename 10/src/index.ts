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

if (process.argv.length !== 3) {
  throw "assembler: missing operand"; // FIXME
}

const INPUT_PATH = process.argv[2];
const OUTPUT_PATH = INPUT_PATH.replace(/\.jack$/, ".test.xml"); // FIXME: support folder

const source = fs.readFileSync(INPUT_PATH, { encoding: "utf-8" });
const tokens = tokenize(preprocess(source));

const out = toXmlFromTokens(tokens);
fs.writeFileSync(OUTPUT_PATH, out);
