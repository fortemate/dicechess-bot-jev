# Dice Chess Bot — Jev

Experimental [Dice Chess](https://fortemate.com) webhook bot that lets
[TypeSafe Jev](https://docs.typesafe.ai/primitives/choice) choose from every legal
turn using adaptive, structured decisions through OpenRouter.

**Status: offline planner implemented.** The reusable planner is available, but
there is no runnable server, provider integration, paid inference, or deployment.

## How it will choose a turn

1. Obtain the complete tree of legal turns for the current position and dice roll.
2. If every remaining full continuation fits the option and request-size limits,
   ask Jev to choose one complete continuation.
3. Otherwise, ask Jev to choose the next micro-move from the current tree node.
4. Follow that branch, update the position and remaining dice, and repeat the
   same size check. A small enough subtree can be selected in one call.
5. Verify that the assembled sequence belongs to the original legal-turn set,
   then submit the whole turn to the server.

All legal choices remain available until Jev chooses a branch. There is no
heuristic pre-ranking, top-K shortlist, or built-in strategy choosing among
alternatives. A sole legal continuation needs no model call.

The rules engine determines legality; Jev makes the decisions. The server remains
authoritative when applying the turn. See [Architecture](docs/architecture.md)
for the algorithm, state boundaries, failure handling, and provider constraints.

## Current implementation

`planTurn(input, client, limits, control)` in `src/planner.ts` implements
provider-independent traversal. The client supplies `choose(question, control)`
and returns an option ID. Callers must set positive `maxOptions`,
`maxQuestionBytes`, `maxTreeNodes`, and `maxTreeDepth` limits; the library does
not assume production values. The engine supplies authoritative intermediate
DFEN and dice state, while the planner retains the original legal tree.

The implementation uses
[`@fortemate/dicechess-engine` 0.13.0](https://github.com/fortemate/dicechess-engine)
and
[`@fortemate/dicechess-bot-runtime` 0.1.0-alpha.1](https://github.com/fortemate/dicechess-bot-runtime-js).
The runtime package is a dependency for public contracts; webhook serving and
provider calls are not implemented. See the [Roadmap](docs/roadmap.md) for the
remaining work.

## Working with this repository

With [mise](https://mise.jdx.dev/) and Python 3.11 or newer installed:

```sh
mise install
mise exec -- npm ci --ignore-scripts
mise run format
mise run check
git diff --check
```

These checks format and validate the offline library and its tests. `npm run
check` also runs the Python documentation check. They make no paid provider
calls and do not validate webhook serving or gameplay. External links and
Markdown anchors are reviewed separately.
CI also checks Node.js 22.23.3 and 24.21.0; the local mise pin is 26.8.2.

## Repository guide

- [Architecture](docs/architecture.md) — accepted selection and integration contract.
- [Roadmap](docs/roadmap.md) — incremental implementation and acceptance criteria.
- [Contributing](CONTRIBUTING.md) — branches, review, and local checks.
- [Security](SECURITY.md) — vulnerability reporting and credential handling.
- [Agent guidance](AGENTS.md) — repository scope and shared Fortemate policies.

## Inspiration and license

The [ChessBot Jev experiment](https://github.com/bariskisir/ChessBot/tree/8c9501c08eeb4ec2cb0706f4cd60e795749d9242)
inspired the use of constrained model choices. This repository integrates with
the Dice Chess Bot API; no code, browser extension, or Stockfish assets from that
project have been copied into this bootstrap.

Copyright (c) 2026 Fortemate. Licensed under **AGPL-3.0-only**; see [LICENSE](LICENSE).
Jev is an external model service and is not distributed by this repository.
