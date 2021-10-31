import * as fs from "fs";
import * as path from "path";

export function getSourcePaths(p: string): string[] {
  const stat = fs.statSync(p);
  const files = stat.isDirectory()
    ? fs.readdirSync(p).map((f) => path.join(p, f))
    : [p];
  return files.filter((f) => f.match(/\.vm$/));
}

export function getOutputPath(p: string): string {
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    const filename = `${path.basename(p)}.asm`;
    return path.join(p, filename);
  } else {
    return p.replace(/\.vm$/, ".asm");
  }
}
