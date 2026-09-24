# Dice Chess Bot — Jev

Experimental [Dice Chess](https://fortemate.com) webhook bot that lets
[TypeSafe Jev](https://docs.typesafe.ai/primitives/choice) choose from every legal
turn using adaptive, structured decisions through OpenRouter.

**Status: repository bootstrap.** The architecture and implementation milestones
are documented. There is no runnable bot, paid inference, or deployment yet.

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

## Planned implementation

- **Scala 3 / JVM** for the bot service.
- [dicechess-bot-runtime](https://github.com/fortemate/dicechess-bot-runtime)
  for webhook authentication, turn context, and response transport.
- [dicechess-engine](https://github.com/fortemate/dicechess-engine)
  for canonical position transitions and dice accounting.
- [OpenRouter Decisions API](https://openrouter.ai/blog/insights/what-is-jev/)
  for Jev's structured choices.

Dependency versions and build tooling will be pinned in the first implementation
milestone. Ordinary tests and CI will use mocked provider responses and synthetic
game states. See the [Roadmap](docs/roadmap.md) for the delivery order.

## Working with this bootstrap

With Git and Python 3.11 or newer installed:

```sh
python3 scripts/check_docs.py
git diff --check
```

These checks validate repository documentation and local file links, not bot
behavior. They run in GitHub Actions as well. External links and Markdown anchors
are reviewed separately. Python is used only for this bootstrap check; the
planned bot runtime is Scala/JVM.

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
