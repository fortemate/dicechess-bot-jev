# Roadmap

Deliver each milestone as a small, reviewable pull request. The checkboxes record
implementation status, not a release or deployment commitment.

## Bootstrap

- [x] Public repository, description, topics, and license.
- [x] Accepted architecture and staged implementation plan.
- [x] Contribution/security guidance and canonical Fortemate agent policies.
- [x] Offline documentation checks and GitHub Actions workflow.

## 1. Offline adaptive planner

- [x] Pin Node.js, TypeScript, formatting tools, and test dependencies.
- [x] Add reproducible `mise` tasks and format/build/typecheck/test CI.
- [x] Accept the authoritative legal-turn tree and preserve its original leaves
      through traversal; use the public engine for synthetic fixtures and transitions.
- [x] Implement provider-independent adaptive choices, explicit limits, and
      typed planner errors.

Delivered with `@fortemate/dicechess-engine` 0.13.0 and
`@fortemate/dicechess-bot-runtime` 0.1.0-alpha.1. Tests use synthetic
engine-backed states and a mocked client; no network or API key is required.

## 2. Provider prompts and decisions

- [ ] Define versioned prompts for full continuations and next micro-moves.
- [ ] Verify the selected provider's current option and request contracts.
- [ ] Measure provider token budgets separately from the planner's caller-set
      option-count and serialized-JSON-byte limits.

The offline planner supplies the adaptive traversal, structural grouping,
forced-choice handling, and option-ID validation. There is no provider
transport or production limit default yet.

## 3. Jev transport

- [ ] Implement the OpenRouter Decisions client with a pinned model identifier.
- [ ] Enforce request limits, deadlines, cancellation, and response validation.
- [ ] Load credentials from the environment and redact diagnostic output.
- [ ] Record the metadata needed to reproduce and measure decisions privately.

Acceptance: local mocked HTTP tests cover success, provider errors, invalid
choices, unavailable usage metadata, redaction, and late responses. CI makes no
paid calls. Any live smoke test is a separate operator action.

## 4. Webhook integration

- [ ] Wire the planner into the shared runtime's current `BotStrategy` contract.
- [ ] Resolve capped move trees without confusing missing data with forced pass.
- [ ] Bind work to the game/version/DFEN and use one deadline for the whole turn.
- [ ] Handle duplicate deliveries and explicitly map failures to runtime behavior.

Acceptance: signed local webhook tests return one complete legal turn, reject
stale/partial results, and demonstrate failure and retry behavior against the
pinned runtime. No automatic registration, ladder entry, or deployment.

## 5. Controlled gameplay experiment

- [ ] Prepare an operator runbook and a bounded live smoke test.
- [ ] Verify complete games against known baselines in a controlled environment.
- [ ] Compare full-turn and sequential decisions, latency, errors, and cost.

Acceptance: retain private reproducible evidence with engine/model/prompt
versions and game seeds. The owner decides separately whether to register,
deploy, or release the bot after reviewing those results.
