import { Class } from "./analyzer";
import { Command } from "./vm";

export function* compile(klass: Class): Iterable<Command> {}
