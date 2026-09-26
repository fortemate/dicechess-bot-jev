# Architecture

Status: offline planner implemented; provider and webhook integration pending.

## Objective

Build a Dice Chess webhook bot whose decisions are made by Jev over the complete
legal option set. The application controls legality, request construction, state
transitions, and transport. It does not rank moves by playing strength.

## Boundaries

Webhook integration will take the authoritative legal-turn tree from the public
JS runtime. The offline planner receives that tree and retains its original
allowed leaves throughout traversal. Synthetic tests use `getLegalTurnTree` on
the full engine entry to obtain canonical fixtures. Runtime
webhook integration and binding decisions to a game, seat, state version, and
root DFEN remain future work.

The `@fortemate/dicechess-engine` 0.13.0 rules API (`rules.applyMove`) supplies
intermediate DFEN and remaining dice. The original tree remains the allowed
choice set; do not call `getLegalUciMoves` again after a prefix to expand
choices.

The Jev adapter owns structured requests and validates returned option IDs.
The webhook boundary submits a complete `TurnAction` only after final validation.
Provider calls and all intermediate choices happen before that submission.

## Adaptive traversal

`src/planner.ts` exports `planTurn(input, client, limits, control)`. The client
implements `choose(question, control)` and returns an option ID. Snapshot and
freeze the original prefix tree. Keep that immutable tree and a per-request
cursor with the selected prefix, current position,
and remaining dice.

At each cursor:

1. A leaf completes the selected turn. An empty tree at the root instead means
   the server has no legal move and auto-passes.
2. If exactly one complete continuation remains, append it without inference.
   A shared, forced next micro-move may likewise be advanced locally.
3. If all remaining complete suffixes fit both request limits, offer all of them
   as choices. Resolve the selected ID back to the exact stored suffix.
4. Otherwise offer every distinct next micro-move at this node. If the question
   is still oversized, split the sorted UCI choices into deterministic,
   balanced contiguous ranges and repeat recursively. Resolve the selected ID,
   advance into that child, update the position, and repeat.
5. Before returning a turn, verify exact sequence membership in the original
   legal paths and check the original deadline/cancellation signal. Binding the
   context to a live game/version is part of the future webhook integration.

For example, a large root may require one micro-move decision, after which the
remaining complete suffixes fit into a single second request. The planner must
reconsider complete-suffix mode after every advance.

There is no score-based filtering, top-K selection, early selection of a winning
move among alternatives, or fallback to another playing strategy. Jev chooses
between all alternatives represented at each decision. An invalid response does
not authorize playing an arbitrary legal move.

## Request limits and representation

The caller must provide explicit positive values for `maxOptions`,
`maxQuestionBytes`, `maxTreeNodes`, and `maxTreeDepth`. There are no production
defaults. The planner measures the exact serialized question JSON against the
byte limit. These option-count and byte thresholds have not been measured
against a live provider token limit; provider contracts must be checked before
enabling live calls.

Apply the same limits to a next-micro-move question. If it still does not fit,
partition choices into deterministic lexicographic UCI ranges. Every branch
must remain reachable; never truncate options or select a subset by evaluation.
If even the minimum state and question cannot fit, return an explicit size
error. Structural grouping may require additional calls.

The byte limit applies to the serialized neutral decision question. Any final
provider prompt and token overhead belong to the adapter and must be budgeted
there when transport is added.

Each neutral question carries the original roll, selected prefix, root and current
position, remaining dice, and a distinction between a full continuation, a
micro-move, and a structural group. The future provider adapter must add the
Dice Chess rules and versioned instructions. The moving side remains
unchanged until the turn is complete. Option IDs map to exact stored paths or
branches; free-form move text is never executed.

Versioned provider prompts and model selection are pending with the provider
integration. Choice confidence, if later exposed, is model confidence in its
selection, not a measured probability of winning the game or an engine
evaluation.

## Dice Chess invariants

- Legal complete paths maximize **dice consumed**, subject to the king-capture
  exception. Path length alone is not a sufficient legality check.
- A normal micro-move consumes a matching die. Castling consumes king and rook
  dice together. Use the engine's canonical accounting.
- King capture ends the game and is a leaf even when other paths are longer.
- Repeated moves by the same piece, promotions, and en passant use engine rules.
- Retain castling and en passant state and remaining dice between micro-moves;
  do not reconstruct the position from piece placement alone.
- Distinguish `legalMoves == null` (unknown or unavailable) from an empty list
  (no legal turn, server auto-pass). Unknown moves are an error, not a pass.
- Every returned path must terminate at an original leaf. An incomplete prefix
  must never become a submitted turn.

## Errors and timing

Bound the whole decision by one turn deadline, including all provider calls and
any retries. Reserve time to return the webhook response. Cancellation, expired
deadlines, changed state versions, and late responses must not submit stale turns.

The initial transport should use explicit, typed errors for provider rejection,
malformed or out-of-set choices, missing move trees, request-size failures, and
timeouts. It must not silently switch algorithms, resign, or send empty moves as
a substitute for failure. The webhook milestone will verify the exact failure
response and retry behavior against the pinned runtime and platform versions.
Repeated webhook deliveries must not duplicate paid work or apply a turn twice.

## Data and credentials

Keep provider credentials and webhook secrets server-side. Send the provider
only the game rules, position, dice, prefix, and legal choices needed to decide.
Player identities, authentication material, and operational metadata are not
part of the prompt. Logs must redact credentials and avoid raw response/header
dumps that could echo them.

Use synthetic fixtures in public tests. Operational configuration and experiment
results remain outside this public repository under Fortemate's publication
policy. No live provider request is part of normal builds or CI.

## Implemented scope and validation

The offline planner uses a mocked decision client and engine-backed fixtures to
check full-suffix mode, micro-move mode, switching modes after a prefix, forced
choices, oversized questions, and terminal conditions. It makes no paid HTTP
calls and does not register, deploy, or run a bot server. Provider transport
tests for malformed responses, deadlines, cancellation, redaction, and
duplicate deliveries remain future work.

Before adding transport, cover malformed provider responses, deadlines,
cancellation, redaction, and duplicate deliveries. Any live smoke test is a
separate operator action.

## References

- [Fortemate Bot API](https://bots.fortemate.com/)
- [Runtime turn context](https://github.com/fortemate/dicechess-bot-runtime-js/blob/main/src/protocol.ts)
- [Dice Chess Engine](https://github.com/fortemate/dicechess-engine)
- [TypeSafe Choice](https://docs.typesafe.ai/primitives/choice)
- [OpenRouter Jev Decisions API](https://openrouter.ai/blog/insights/what-is-jev/)

The provider references were checked on 2026-09-24. Limits and endpoints must be
verified again when implementing the transport.
