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

export type Keyword = typeof keywords[number];

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

export type Symbol = typeof symbols[number];

export type Token =
  | { type: "KEYWORD"; keyword: Keyword }
  | { type: "SYMBOL"; symbol: Symbol }
  | { type: "IDENTIFIER"; identifier: string }
  | { type: "INT_CONST"; val: number }
  | { type: "STRING_CONST"; val: string };

function escapeRegExp(s: string) {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function tokenize(source: string): Token[] {
  // remove comments
  source = source.replace(/\/\/.*/g, "").replace(/\/\*(.*?)\*\//gs, "");

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
