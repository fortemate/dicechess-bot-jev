# Architecture

Status: accepted design, implementation pending.

## Objective

Build a Dice Chess webhook bot whose decisions are made by Jev over the complete
legal option set. The application controls legality, request construction, state
transitions, and transport. It does not rank moves by playing strength.

## Boundaries

The platform supplies an authoritative position, state version, and legal turns.
The shared runtime exposes complete UCI paths in `TurnContext.legalMoves` and can
fetch the uncapped move tree when it was omitted from the webhook. Each decision
must stay bound to the same game, seat, state version, and root DFEN.

The rules engine supplies intermediate positions and remaining dice for the
prompt. The original server tree remains the allowed choice set; regenerating
moves from a later position must never add a new branch to it.

The Jev adapter owns structured requests and validates returned option IDs.
The webhook boundary submits a complete `TurnAction` only after final validation.
Provider calls and all intermediate choices happen before that submission.

## Adaptive traversal

Build a prefix tree from the original complete legal paths. Keep an immutable
reference to that set and a per-request cursor with the selected prefix, current
position, and remaining dice.

At each cursor:

1. A leaf completes the selected turn. An empty tree at the root instead means
   the server has no legal move and auto-passes.
2. If exactly one complete continuation remains, append it without inference.
   A shared, forced next micro-move may likewise be advanced locally.
3. If all remaining complete suffixes fit both request limits, offer all of them
   as choices. Resolve Jev's selected ID back to the exact stored suffix.
4. Otherwise offer every distinct next micro-move at this node. Resolve the
   selected ID, advance into that child, update the position, and repeat.
5. Before returning a turn, verify exact sequence membership in the original
   legal paths and confirm that the request context is still current.

For example, a large root may require one micro-move decision, after which the
remaining complete suffixes fit into a single second request. The planner must
reconsider complete-suffix mode after every advance.

There is no score-based filtering, top-K selection, early selection of a winning
move among alternatives, or fallback to another playing strategy. Jev chooses
between all alternatives represented at each decision. An invalid response does
not authorize playing an arbitrary legal move.

## Request limits and representation

As of 2026-09-24, TypeSafe documents a maximum of **255 options per Choice**.
The adapter must check the selected provider's current contract before enabling
live calls. The configured full-continuation threshold must respect that cap and
a separate serialized request/context budget. Count alone is insufficient.

Apply the same limits to a next-micro-move question. If it still does not fit,
partition choices structurally, for example by source square, then destination
and promotion. Every branch must remain reachable; never truncate options or
select a subset by evaluation. If even the minimum state and question cannot
fit, return an explicit size error. Structural grouping may require additional
calls beyond the number of micro-moves.

Each request carries the Dice Chess rules, original roll, selected prefix,
current position, remaining dice, and a clear distinction between choosing a
full continuation and choosing only the next micro-move. The moving side remains
unchanged until the turn is complete. Option IDs map to exact stored paths or
branches; free-form move text is never executed.

Fix and record the model version and prompt version for an experiment. Avoid a
moving `latest` alias. Choice confidence is model confidence in its selection,
not a measured probability of winning the game or an engine evaluation.

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

## Validation

Prove that every original legal leaf is reachable through structural decisions
and that every returned sequence is an original leaf. Cover full-suffix mode,
micro-move mode, switching modes after a prefix, forced choices, oversized
questions, and all terminal conditions with a mocked decision client.

Use engine-backed fixtures for dice consumption and intermediate state. Add
transport tests for malformed responses, deadlines, cancellation, redaction, and
duplicate deliveries before conducting separately authorized live smoke tests.

## References

- [Fortemate Bot API](https://bots.fortemate.com/)
- [Runtime turn context](https://github.com/fortemate/dicechess-bot-runtime#turn-context)
- [Dice Chess Engine](https://github.com/fortemate/dicechess-engine)
- [TypeSafe Choice](https://docs.typesafe.ai/primitives/choice)
- [OpenRouter Jev Decisions API](https://openrouter.ai/blog/insights/what-is-jev/)

The provider references were checked on 2026-09-24. Limits and endpoints must be
verified again when implementing the transport.
