# Contributing

This repository is at the documentation/bootstrap stage. Start with the
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

Requires Git and Python 3.11 or newer, with no third-party packages:

```sh
python3 scripts/check_docs.py
git diff --check
```

The documentation check validates local file targets, UTF-8, final newlines, and
trailing whitespace in Markdown. It does not resolve external URLs or anchors.
The implementation milestone will add Scala formatting, compilation, and tests
to the same CI gate. There is no bot build command yet.

## Contribution boundaries

Use synthetic positions and mocked provider responses in public tests. Never
commit credentials, production configuration, private evaluation material, or
game records without an explicit redistribution grant. Follow [SECURITY.md](SECURITY.md)
for vulnerability reports and [AGENTS.md](AGENTS.md) for repository policies.

Contributions are submitted under this repository's **AGPL-3.0-only** license.
This bootstrap does not introduce a separate CLA requirement.
