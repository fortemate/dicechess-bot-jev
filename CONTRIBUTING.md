# Contributing

This repository contains an offline planner, not a deployed bot. Start with the
[architecture](docs/architecture.md) and [roadmap](docs/roadmap.md), and keep each
implementation pull request focused on one milestone or a bounded part of it.

## Workflow

1. Discuss features and bugs in an issue with Context, Objective, and a testable
   Definition of Done. Documentation-only changes can use a pull request directly.
2. Work on a branch such as `feat/adaptive-planner`, `bug/response-validation`,
   or `docs/architecture`. Never commit directly to the default branch.
3. Write code, documentation, commits, issues, and pull requests in English.
4. Run the available checks and describe their scope in the pull request.
5. The repository owner reviews and merges changes.

## Current checks

Requires Git, mise, and Python 3.11 or newer:

```sh
mise install
mise exec -- npm ci --ignore-scripts
mise run format
mise run check
git diff --check
```

`mise run format` formats the TypeScript sources. `mise run check` maps to the
package check, which runs formatting checks, build, typecheck, tests, and the
Python documentation check. Documentation validation checks local file targets,
UTF-8, final newlines, and trailing whitespace in Markdown; it does not resolve
external URLs or anchors. These checks cover the offline planner, not a runnable
bot server, provider transport, or live gameplay.

## Contribution boundaries

Use synthetic positions and mocked provider responses in public tests. Never
commit credentials, production configuration, private evaluation material, or
game records without an explicit redistribution grant. Follow [SECURITY.md](SECURITY.md)
for vulnerability reports and [AGENTS.md](AGENTS.md) for repository policies.

Contributions are submitted under this repository's **AGPL-3.0-only** license.
This bootstrap does not introduce a separate CLA requirement.
