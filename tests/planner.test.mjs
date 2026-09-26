import assert from "node:assert/strict";
import { test } from "node:test";
import { DiceChess } from "@fortemate/dicechess-engine";
import { applyMove, getLegalUciMoves } from "@fortemate/dicechess-engine/rules";
import {
  isCompletePath,
  planTurn,
  PlannerError,
  questionBytes,
} from "../dist/index.js";

// Synthetic test budgets, not deployment defaults.
const limits = {
  maxOptions: 255,
  maxQuestionBytes: 16384,
  maxTreeNodes: 1024,
  maxTreeDepth: 8,
};
const pawn = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1 PP";
const mixed = "4k3/8/8/8/8/8/4P3/4K1N1 w - - 0 1 PPN";
const capture = "8/8/8/2k5/8/1N6/2P5/K7 w - - 0 1 NPP";
const input = (dfen) => ({
  dfen,
  legalMoves: DiceChess.getLegalTurnTree(dfen),
});
const control = (signal = new AbortController().signal) => ({
  signal,
  deadlineEpochMs: Date.now() + 10000,
});
const failIfCalled = {
  choose: async () => assert.fail("forced choices must not call the provider"),
};
const errorCode = (code) => (error) =>
  error instanceof PlannerError && error.code === code;

function leaves(tree, prefix = []) {
  return Object.keys(tree).length === 0
    ? [prefix]
    : Object.entries(tree).flatMap(([move, child]) =>
        leaves(child, [...prefix, move]),
      );
}

/** Select an exact stored path, including through structural range questions. */
function choosePath(path, questions = []) {
  return {
    async choose(question, passedControl) {
      questions.push(question);
      assert.equal(passedControl.signal.aborted, false);
      const next = path[question.context.prefix.length];
      const suffix = path.slice(question.context.prefix.length);
      const option = question.options.find((candidate) => {
        if (question.kind === "continuation")
          return JSON.stringify(candidate.moves) === JSON.stringify(suffix);
        if (question.kind === "micro-move") return candidate.moves[0] === next;
        const [first, last = first] = candidate.label.split(" … ");
        return first <= next && next <= last;
      });
      assert.ok(
        option,
        `target ${suffix} must remain reachable in ${JSON.stringify(question)}`,
      );
      return option.id;
    },
  };
}

test("small tree offers every complete path and maps an opaque ID to a leaf", async () => {
  const state = input(pawn);
  const questions = [];
  const path = ["e2e4", "e4e5"];
  assert.deepEqual(
    await planTurn(state, choosePath(path, questions), limits, control()),
    path,
  );
  assert.equal(questions.length, 1);
  assert.equal(questions[0].kind, "continuation");
  assert.deepEqual(
    questions[0].options.map((option) => option.moves),
    leaves(state.legalMoves),
  );
  assert.equal(isCompletePath(state.legalMoves, ["e2e4"]), false);
});

test("forced complete path and empty root do not call a decision client", async () => {
  const forced = { dfen: pawn, legalMoves: { e2e3: { e3e4: {} } } };
  assert.deepEqual(await planTurn(forced, failIfCalled, limits, control()), [
    "e2e3",
    "e3e4",
  ]);
  assert.deepEqual(
    await planTurn(
      { dfen: pawn, legalMoves: {} },
      failIfCalled,
      limits,
      control(),
    ),
    [],
  );
  await assert.rejects(
    planTurn({ dfen: pawn, legalMoves: null }, failIfCalled, limits, control()),
    errorCode("missing_legal_moves"),
  );
});

test("shared forced prefix advances locally before offering alternatives", async () => {
  const state = {
    dfen: mixed,
    legalMoves: {
      e2e4: {
        g1f3: { e4e5: {} },
        g1h3: { e4e5: {} },
      },
    },
  };
  const questions = [];
  const path = ["e2e4", "g1h3", "e4e5"];
  assert.deepEqual(
    await planTurn(state, choosePath(path, questions), limits, control()),
    path,
  );
  assert.equal(questions.length, 1);
  assert.deepEqual(questions[0].context.prefix, ["e2e4"]);
  assert.equal(questions[0].context.remainingDice, "PN");
});

test("large tree switches from micro-move mode to complete suffixes after a prefix", async () => {
  const questions = [];
  const path = ["e2e4", "e4e5", "g1f3"];
  const actual = await planTurn(
    input(mixed),
    choosePath(path, questions),
    { ...limits, maxOptions: 6 },
    control(),
  );
  assert.deepEqual(actual, path);
  assert.deepEqual(
    questions.map((q) => q.kind),
    ["micro-move", "continuation"],
  );
  assert.equal(
    questions[1].context.dfen,
    "4k3/8/8/8/4P3/8/8/4K1N1 w - e3 0 1 PN",
  );
  assert.equal(questions[1].context.originalDice, "PPN");
  assert.equal(questions[1].context.remainingDice, "PN");
});

test("c2c4 permits only king capture, not re-rooted quiet knight moves", async () => {
  const state = input(capture);
  const questions = [];
  const path = ["c2c4", "b3c5"];
  const actual = await planTurn(
    state,
    choosePath(path, questions),
    { ...limits, maxOptions: 7 },
    control(),
  );
  assert.deepEqual(actual, path);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].kind, "micro-move");
  const after = applyMove(capture, "c2", "c4");
  assert.ok(
    getLegalUciMoves(after).includes("b3d2"),
    "re-rooting would admit a quiet move",
  );
  assert.equal(isCompletePath(state.legalMoves, ["c2c4", "b3d2"]), false);
  assert.deepEqual(Object.keys(state.legalMoves.c2c4), ["b3c5"]);
});

test("king capture ends at an original leaf with unspent dice", async () => {
  const path = ["b3c5"];
  assert.deepEqual(
    await planTurn(input(capture), choosePath(path), limits, control()),
    path,
  );
  assert.ok(applyMove(capture, "b3", "c5").endsWith(" PP"));
});

test("every original leaf stays reachable through nested structural groups", async () => {
  const state = input(capture);
  let groups = 0;
  for (const path of leaves(state.legalMoves)) {
    const questions = [];
    assert.deepEqual(
      await planTurn(
        state,
        choosePath(path, questions),
        { ...limits, maxOptions: 2 },
        control(),
      ),
      path,
    );
    assert.ok(isCompletePath(state.legalMoves, path));
    for (const question of questions) {
      groups += Number(question.kind === "group");
      assert.ok(question.options.length <= 2);
      assert.ok(questionBytes(question) <= limits.maxQuestionBytes);
    }
  }
  assert.ok(groups > 0);
});

test("exact JSON byte boundary fits, one byte less triggers smaller questions", async () => {
  const path = ["e2e4", "e4e5"];
  const first = [];
  await planTurn(input(pawn), choosePath(path, first), limits, control());
  const exact = questionBytes(first[0]);
  assert.equal(exact, Buffer.byteLength(JSON.stringify(first[0]), "utf8"));
  const fits = [];
  await planTurn(
    input(pawn),
    choosePath(path, fits),
    { ...limits, maxQuestionBytes: exact },
    control(),
  );
  assert.equal(fits[0].kind, "continuation");
  const smaller = [];
  assert.deepEqual(
    await planTurn(
      input(pawn),
      choosePath(path, smaller),
      { ...limits, maxQuestionBytes: exact - 1 },
      control(),
    ),
    path,
  );
  assert.equal(smaller[0].kind, "micro-move");
  assert.ok(smaller.every((q) => questionBytes(q) < exact));
});

test("byte budget can force structural groups even when option count fits", async () => {
  const state = input(mixed);
  const target = ["e2e4", "e4e5", "g1f3"];
  const questions = [];
  await planTurn(
    state,
    choosePath(target, questions),
    { ...limits, maxOptions: 6 },
    control(),
  );
  const microBytes = questionBytes(questions[0]);
  const grouped = [];
  assert.deepEqual(
    await planTurn(
      state,
      choosePath(target, grouped),
      { ...limits, maxQuestionBytes: microBytes - 1 },
      control(),
    ),
    target,
  );
  assert.equal(grouped[0].kind, "group");
  assert.ok(grouped.every((q) => questionBytes(q) < microBytes));
});

test("impossible size and option limits fail rather than truncate or choose a fallback", async () => {
  await assert.rejects(
    planTurn(
      input(pawn),
      failIfCalled,
      { ...limits, maxQuestionBytes: 1 },
      control(),
    ),
    errorCode("question_too_large"),
  );
  await assert.rejects(
    planTurn(
      input(pawn),
      failIfCalled,
      { ...limits, maxOptions: 1 },
      control(),
    ),
    errorCode("question_too_large"),
  );
});

test("node/depth bounds include the root and accept their exact boundary", async () => {
  const path = ["e2e3", "e3e4"];
  assert.deepEqual(
    await planTurn(
      input(pawn),
      choosePath(path),
      { ...limits, maxTreeNodes: 5, maxTreeDepth: 2 },
      control(),
    ),
    path,
  );
  await assert.rejects(
    planTurn(
      input(pawn),
      failIfCalled,
      { ...limits, maxTreeNodes: 4 },
      control(),
    ),
    errorCode("invalid_tree"),
  );
});

test("arbitrary move text, missing IDs, and malformed answers cannot become actions", async () => {
  for (const choice of ["e2e4", "option-99", undefined, { id: "option-0" }]) {
    await assert.rejects(
      planTurn(input(pawn), { choose: async () => choice }, limits, control()),
      errorCode("invalid_choice"),
    );
  }
});

test("input mutation cannot change the snapshot, and questions are deeply frozen", async () => {
  const state = input(pawn);
  const path = ["e2e4", "e4e5"];
  const client = choosePath(path);
  const actual = await planTurn(
    state,
    {
      async choose(question, passedControl) {
        assert.ok(Object.isFrozen(question));
        assert.ok(Object.isFrozen(question.context));
        assert.ok(Object.isFrozen(question.context.prefix));
        assert.ok(Object.isFrozen(question.options[0].moves));
        assert.throws(() => question.options.push({ id: "forged" }), TypeError);
        delete state.legalMoves.e2e4;
        return client.choose(question, passedControl);
      },
    },
    limits,
    control(),
  );
  assert.deepEqual(actual, path);
});

test("malformed, cyclic, accessor, oversized and over-deep trees fail closed", async () => {
  const cyclic = {};
  cyclic.e2e3 = cyclic;
  const accessor = {};
  Object.defineProperty(accessor, "e2e3", {
    enumerable: true,
    get() {
      assert.fail("must not invoke accessors");
    },
  });
  for (const legalMoves of [
    undefined,
    [],
    { invalid: {} },
    { e2e3: null },
    cyclic,
    accessor,
    { [Symbol("hidden")]: {} },
  ]) {
    await assert.rejects(
      planTurn({ dfen: pawn, legalMoves }, failIfCalled, limits, control()),
      errorCode("invalid_tree"),
    );
  }
  await assert.rejects(
    planTurn(
      input(pawn),
      failIfCalled,
      { ...limits, maxTreeNodes: 1 },
      control(),
    ),
    errorCode("invalid_tree"),
  );
  await assert.rejects(
    planTurn(
      input(pawn),
      failIfCalled,
      { ...limits, maxTreeDepth: 1 },
      control(),
    ),
    errorCode("invalid_tree"),
  );
});

test("invalid configuration, DFEN and die-incompatible transitions fail explicitly", async () => {
  for (const key of Object.keys(limits)) {
    await assert.rejects(
      planTurn(input(pawn), failIfCalled, { ...limits, [key]: 0 }, control()),
      errorCode("invalid_configuration"),
    );
  }
  for (const dfen of ["invalid", pawn.slice(0, -3)]) {
    await assert.rejects(
      planTurn({ dfen, legalMoves: {} }, failIfCalled, limits, control()),
      errorCode("invalid_position"),
    );
  }
  await assert.rejects(
    planTurn(
      { dfen: pawn.replace(" PP", " NNN"), legalMoves: { e2e4: {} } },
      failIfCalled,
      limits,
      control(),
    ),
    errorCode("invalid_position"),
  );
});

test("a malformed tree cannot extend a turn using dice-free analysis moves", async () => {
  const state = {
    dfen: pawn.replace(" PP", " P"),
    legalMoves: { e2e4: { e4e5: {} } },
  };
  await assert.rejects(
    planTurn(state, failIfCalled, limits, control()),
    errorCode("invalid_position"),
  );
});

test("all choices share the original deadline instead of resetting it per call", async () => {
  const passedControl = control();
  const path = ["e2e4", "e4e5", "g1f3"];
  const client = choosePath(path);
  let calls = 0;
  assert.deepEqual(
    await planTurn(
      input(mixed),
      {
        async choose(question, currentControl) {
          calls++;
          assert.equal(
            currentControl.deadlineEpochMs,
            passedControl.deadlineEpochMs,
          );
          return client.choose(question, currentControl);
        },
      },
      { ...limits, maxOptions: 6 },
      passedControl,
    ),
    path,
  );
  assert.equal(calls, 2);
});

test("castling spends king and rook dice and retains the pawn die for the next choice", async () => {
  const dfen = "4k3/8/8/8/8/8/4P3/4K2R w K - 0 1 PRK";
  const questions = [];
  const path = ["e1g1", "e2e3"];
  assert.deepEqual(
    await planTurn(
      input(dfen),
      choosePath(path, questions),
      { ...limits, maxOptions: 2 },
      control(),
    ),
    path,
  );
  const afterCastle = questions.find((q) => q.context.prefix[0] === "e1g1");
  assert.ok(afterCastle);
  assert.equal(afterCastle.context.remainingDice, "P");
  assert.equal(afterCastle.context.dfen, "4k3/8/8/8/8/8/4P3/5RK1 w - - 1 1 P");
});

test("promotion suffix and en-passant paths use canonical engine transitions", async () => {
  const promotion = "k7/4P3/8/8/8/8/8/4K3 w - - 0 1 P";
  assert.deepEqual(
    await planTurn(input(promotion), choosePath(["e7e8n"]), limits, control()),
    ["e7e8n"],
  );
  const ep = "4k3/8/8/2Pp4/8/8/8/4K3 w - d6 0 1 PP";
  const path = ["c5d6", "d6d7"];
  assert.deepEqual(
    await planTurn(input(ep), choosePath(path), limits, control()),
    path,
  );
  assert.equal(applyMove(ep, "c5", "d6"), "4k3/8/3P4/8/8/8/8/4K3 w - - 0 1 P");
});

test("provider failures expose only a sanitized error code", async () => {
  await assert.rejects(
    planTurn(
      input(pawn),
      {
        choose: async () => {
          throw new Error("synthetic secret must not escape");
        },
      },
      limits,
      control(),
    ),
    (error) => {
      assert.equal(error.code, "provider_failed");
      assert.equal(error.message, "provider_failed");
      assert.equal(error.cause, undefined);
      return true;
    },
  );
});

test("pre-cancelled and expired decisions never call a provider", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    planTurn(input(pawn), failIfCalled, limits, control(controller.signal)),
    errorCode("cancelled"),
  );
  await assert.rejects(
    planTurn(input(pawn), failIfCalled, limits, {
      ...control(),
      deadlineEpochMs: Date.now() - 1,
    }),
    errorCode("deadline_exceeded"),
  );
});

test("cancellation interrupts a noncooperative client and ignores its late answer", async () => {
  const controller = new AbortController();
  let finish;
  let passedSignal;
  const client = {
    choose: async (_question, passedControl) => {
      passedSignal = passedControl.signal;
      queueMicrotask(() => controller.abort());
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  };
  await assert.rejects(
    planTurn(input(pawn), client, limits, control(controller.signal)),
    errorCode("cancelled"),
  );
  assert.equal(passedSignal.aborted, true);
  finish("option-0");
});

test("one deadline interrupts a client that never resolves", async () => {
  let signal;
  const client = {
    choose: async (_question, passedControl) => {
      signal = passedControl.signal;
      return new Promise(() => {});
    },
  };
  await assert.rejects(
    planTurn(input(pawn), client, limits, {
      ...control(),
      deadlineEpochMs: Date.now() + 100,
    }),
    errorCode("deadline_exceeded"),
  );
  assert.equal(signal.aborted, true);
});
