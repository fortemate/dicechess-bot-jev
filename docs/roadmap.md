# Roadmap

Deliver each milestone as a small, reviewable pull request. The checkboxes record
implementation status, not a release or deployment commitment.

## Bootstrap

- [x] Public repository, description, topics, and license.
- [x] Accepted architecture and staged implementation plan.
- [x] Contribution/security guidance and canonical Fortemate agent policies.
- [x] Offline documentation checks and GitHub Actions workflow.

## 1. Build and legal-turn model

- [ ] Pin Scala, JDK, sbt, formatting tools, and test dependencies.
- [ ] Add reproducible `mise` tasks and compilation/test CI.
- [ ] Introduce an immutable legal-turn tree with prefix and leaf operations.
- [ ] Define a provider-independent decision interface and explicit errors.

Acceptance: synthetic tests prove path preservation, empty-root semantics,
single-continuation handling, and exact final path membership. No network or API
key is required. Pin public engine/runtime artifacts when first introduced.

## 2. Adaptive decision planner

- [ ] Select complete suffixes when all options fit the count and size limits.
- [ ] Otherwise select the next micro-move, then reconsider complete suffixes.
- [ ] Advance forced choices locally and handle oversized branches structurally.
- [ ] Validate selected IDs and keep every legal path reachable.

Acceptance: mocked choices cover all mode transitions, boundary sizes, malformed
answers, and shorter terminal paths. No heuristic or score affects eligibility.

## 3. Position context

- [ ] Use the public rules engine to derive intermediate positions and dice.
- [ ] Define versioned prompts for full continuations and next micro-moves.
- [ ] Explain the Dice Chess win condition and turn structure explicitly.

Acceptance: engine-backed fixtures cover ordinary consumption, repeated-piece
moves, castling, promotion, en passant, and king capture. Choices remain confined
to the original tree throughout the turn.

## 4. Jev transport

- [ ] Implement the OpenRouter Decisions client with a pinned model identifier.
- [ ] Enforce request limits, deadlines, cancellation, and response validation.
- [ ] Load credentials from the environment and redact diagnostic output.
- [ ] Record the metadata needed to reproduce and measure decisions privately.

Acceptance: local mocked HTTP tests cover success, provider errors, invalid
choices, unavailable usage metadata, redaction, and late responses. CI makes no
paid calls. Any live smoke test is a separate operator action.

## 5. Webhook integration

- [ ] Wire the planner into the shared runtime's current `BotStrategy` contract.
- [ ] Resolve capped move trees without confusing missing data with forced pass.
- [ ] Bind work to the game/version/DFEN and use one deadline for the whole turn.
- [ ] Handle duplicate deliveries and explicitly map failures to runtime behavior.

Acceptance: signed local webhook tests return one complete legal turn, reject
stale/partial results, and demonstrate failure and retry behavior against the
pinned runtime. No automatic registration, ladder entry, or deployment.

## 6. Controlled gameplay experiment

- [ ] Prepare an operator runbook and a bounded live smoke test.
- [ ] Verify complete games against known baselines in a controlled environment.
- [ ] Compare full-turn and sequential decisions, latency, errors, and cost.

Acceptance: retain private reproducible evidence with engine/model/prompt
versions and game seeds. The owner decides separately whether to register,
deploy, or release the bot after reviewing those results.
