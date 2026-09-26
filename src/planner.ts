import type {
  DecisionControl,
  TurnContext,
} from "@fortemate/dicechess-bot-runtime";
import { applyMove, canonicalKey } from "@fortemate/dicechess-engine/rules";
import { PlannerError } from "./errors.js";
import { completeSuffixes, isCompletePath, snapshotTree } from "./tree.js";

/** Application inputs, not production defaults or provider token limits. */
export interface PlannerLimits {
  readonly maxOptions: number;
  readonly maxQuestionBytes: number;
  readonly maxTreeNodes: number;
  readonly maxTreeDepth: number;
}

export interface DecisionOption {
  readonly id: string;
  readonly label: string;
  /** Only continuations/micro-moves have executable paths; groups have labels. */
  readonly moves?: readonly string[];
}

/** Neutral structured input; the provider adapter adds versioned rules/prompts. */
export interface DecisionQuestion {
  readonly kind: "continuation" | "micro-move" | "group";
  readonly context: {
    readonly rootDfen: string;
    readonly dfen: string;
    readonly originalDice: string;
    readonly remainingDice: string;
    readonly prefix: readonly string[];
  };
  readonly options: readonly DecisionOption[];
}

export interface DecisionClient {
  choose(question: DecisionQuestion, control: DecisionControl): Promise<string>;
}

/** The byte budget includes the exact JSON question, not just its option list. */
export function questionBytes(question: DecisionQuestion): number {
  return new TextEncoder().encode(JSON.stringify(question)).byteLength;
}

const diceOf = (dfen: string): string => dfen.trim().split(/\s+/)[6] ?? "";

function optionLabel(
  kind: DecisionQuestion["kind"],
  moves: readonly string[],
): string {
  if (kind !== "group") return moves.join(" ");
  if (moves.length === 1) return moves[0]!;
  return `${moves[0]} … ${moves.at(-1)}`;
}

/** Plan one whole turn, without network, registration, or another playing strategy. */
export async function planTurn(
  input: Pick<TurnContext, "dfen" | "legalMoves">,
  client: DecisionClient,
  suppliedLimits: PlannerLimits,
  suppliedControl: DecisionControl,
): Promise<readonly string[]> {
  const limits = Object.freeze({ ...suppliedLimits });
  if (
    ![
      limits.maxOptions,
      limits.maxQuestionBytes,
      limits.maxTreeNodes,
      limits.maxTreeDepth,
    ].every((value) => Number.isSafeInteger(value) && value > 0) ||
    limits.maxTreeDepth > 256 ||
    !Number.isSafeInteger(suppliedControl.deadlineEpochMs)
  )
    throw new PlannerError("invalid_configuration");
  const control = Object.freeze({ ...suppliedControl });
  const check = (): void => {
    if (control.signal.aborted) throw new PlannerError("cancelled");
    if (Date.now() >= control.deadlineEpochMs)
      throw new PlannerError("deadline_exceeded");
  };
  check();
  const root = snapshotTree(
    input.legalMoves,
    limits.maxTreeNodes,
    limits.maxTreeDepth,
  );
  const rootDfen = input.dfen;
  if (
    typeof rootDfen !== "string" ||
    !diceOf(rootDfen) ||
    canonicalKey(rootDfen) === undefined
  )
    throw new PlannerError("invalid_position");
  const prefix: string[] = [];
  let dfen = rootDfen;
  let node = root;
  const context = (): DecisionQuestion["context"] =>
    Object.freeze({
      rootDfen,
      dfen,
      originalDice: diceOf(rootDfen),
      remainingDice: diceOf(dfen),
      prefix: Object.freeze([...prefix]),
    });
  const question = (
    kind: DecisionQuestion["kind"],
    entries: readonly (readonly string[])[],
  ): DecisionQuestion =>
    Object.freeze({
      kind,
      context: context(),
      options: Object.freeze(
        entries.map((moves, index) =>
          Object.freeze({
            id: `option-${index}`,
            label: optionLabel(kind, moves),
            ...(kind !== "group" ? { moves: Object.freeze([...moves]) } : {}),
          }),
        ),
      ),
    });
  const fits = (value: DecisionQuestion): boolean =>
    value.options.length <= limits.maxOptions &&
    questionBytes(value) <= limits.maxQuestionBytes;

  const select = async (value: DecisionQuestion): Promise<number> => {
    check();
    if (!fits(value)) throw new PlannerError("question_too_large");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: () => void = () => {};
    const interrupted = new Promise<never>((_, reject) => {
      onAbort = () => {
        controller.abort();
        reject(new PlannerError("cancelled"));
      };
      control.signal.addEventListener("abort", onAbort, { once: true });
      const expire = (): void => {
        const remaining = control.deadlineEpochMs - Date.now();
        if (remaining > 0)
          timer = setTimeout(expire, Math.min(remaining, 2147483647));
        else {
          controller.abort();
          reject(new PlannerError("deadline_exceeded"));
        }
      };
      expire();
      if (control.signal.aborted) onAbort();
    });
    try {
      const provider = Promise.resolve()
        .then(() => {
          check();
          return client.choose(
            value,
            Object.freeze({
              signal: controller.signal,
              deadlineEpochMs: control.deadlineEpochMs,
            }),
          );
        })
        .catch(() => {
          check();
          if (controller.signal.aborted)
            throw new PlannerError("deadline_exceeded");
          throw new PlannerError("provider_failed");
        });
      const id = await Promise.race([provider, interrupted]);
      check();
      const index = value.options.findIndex((option) => option.id === id);
      if (index < 0) throw new PlannerError("invalid_choice");
      return index;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      control.signal.removeEventListener("abort", onAbort);
    }
  };

  const advance = (moves: readonly string[]): void => {
    for (const move of moves) {
      check();
      if (!Object.hasOwn(node, move)) throw new PlannerError("invalid_choice");
      // applyMove also supports dice-free analysis boards; a turn must not use that mode.
      if (!diceOf(dfen)) throw new PlannerError("invalid_position");
      const next = applyMove(dfen, move.slice(0, 2), move.slice(2, 4), move[4]);
      if (next === undefined) throw new PlannerError("invalid_position");
      node = node[move]!;
      prefix.push(move);
      dfen = next;
    }
  };

  const chooseNext = async (original: readonly string[]): Promise<string> => {
    let candidates = original;
    while (candidates.length > 1) {
      check();
      const micro = question(
        "micro-move",
        candidates.map((move) => [move]),
      );
      if (fits(micro)) return candidates[await select(micro)]!;
      // Balanced, contiguous UCI ranges retain every alternative without scores.
      let size = Math.min(
        limits.maxOptions,
        Math.max(2, Math.ceil(candidates.length / 2)),
      );
      let groups: readonly (readonly string[])[] | undefined;
      let grouped: DecisionQuestion | undefined;
      while (size >= 2) {
        const partitions = Array.from({ length: size }, (_, index) =>
          candidates.slice(
            Math.floor((index * candidates.length) / size),
            Math.floor(((index + 1) * candidates.length) / size),
          ),
        );
        const proposal = question("group", partitions);
        if (fits(proposal)) {
          groups = partitions;
          grouped = proposal;
          break;
        }
        if (size === 2) break;
        size = Math.max(2, Math.floor(size / 2));
      }
      if (!groups || !grouped) throw new PlannerError("question_too_large");
      candidates = groups[await select(grouped)]!;
    }
    return candidates[0]!;
  };

  while (Object.keys(node).length > 0) {
    check();
    const keys = Object.keys(node).sort();
    const suffixes = completeSuffixes(node, limits.maxOptions);
    check();
    if (suffixes.length === 1) advance(suffixes[0]!);
    else if (keys.length === 1) advance([keys[0]!]);
    else {
      const complete = question("continuation", suffixes);
      if (fits(complete)) advance(suffixes[await select(complete)]!);
      else advance([await chooseNext(keys)]);
    }
  }
  check();
  if (!isCompletePath(root, prefix)) throw new PlannerError("invalid_choice");
  return Object.freeze([...prefix]);
}
