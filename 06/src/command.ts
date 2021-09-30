export type Command =
  | { type: "A"; symbol: string | number }
  | { type: "C"; dest?: string; comp: string; jump?: string }
  | { type: "L"; symbol: string };
