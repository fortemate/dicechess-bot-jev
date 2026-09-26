import type { MoveTree } from "@fortemate/dicechess-bot-runtime";
import { PlannerError } from "./errors.js";

const uci = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Copy and freeze bounded JSON trees before asynchronous decisions can mutate them. */
export function snapshotTree(
  input: unknown,
  maxNodes: number,
  maxDepth: number,
): MoveTree {
  if (input === null) throw new PlannerError("missing_legal_moves");
  let count = 0;
  const ancestors = new WeakSet<object>();
  const visit = (value: unknown, depth: number): MoveTree => {
    if (
      !value ||
      typeof value !== "object" ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      ancestors.has(value) ||
      ++count > maxNodes ||
      depth > maxDepth
    )
      throw new PlannerError("invalid_tree");
    ancestors.add(value);
    const copy: Record<string, MoveTree> = Object.create(null);
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string"))
      throw new PlannerError("invalid_tree");
    for (const key of (keys as string[]).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !uci.test(key) ||
        !descriptor?.enumerable ||
        !Object.hasOwn(descriptor, "value")
      )
        throw new PlannerError("invalid_tree");
      copy[key] = visit(descriptor.value, depth + 1);
    }
    ancestors.delete(value);
    return Object.freeze(copy);
  };
  try {
    return visit(input, 0);
  } catch {
    throw new PlannerError("invalid_tree");
  }
}

/** Enumerate at most limit + 1 suffixes, so oversized trees need not be flattened. */
export function completeSuffixes(
  node: MoveTree,
  limit: number,
): readonly (readonly string[])[] {
  const paths: (readonly string[])[] = [];
  const visit = (current: MoveTree, prefix: readonly string[]): void => {
    if (paths.length > limit) return;
    const keys = Object.keys(current).sort();
    if (keys.length === 0) paths.push(Object.freeze([...prefix]));
    else
      for (const move of keys) {
        visit(current[move]!, [...prefix, move]);
        if (paths.length > limit) break;
      }
  };
  visit(node, []);
  return Object.freeze(paths);
}

/** A prefix is not a complete turn, even if each individual edge exists. */
export function isCompletePath(
  root: MoveTree,
  moves: readonly string[],
): boolean {
  let node = root;
  for (const move of moves) {
    if (!Object.hasOwn(node, move)) return false;
    node = node[move]!;
  }
  return Object.keys(node).length === 0;
}
