# Security policy

Report vulnerabilities privately through GitHub's **Security → Report a
vulnerability** when available, or email **security@fortemate.com**. Do not open
public issues containing exploit details, credentials, or private game data.

The [Fortemate security policy](https://github.com/fortemate/.github/blob/main/SECURITY.md)
describes the reporting process. This repository is experimental and has no
released or deployed bot yet.

## Development requirements

- Provider API keys and webhook signing secrets belong in server-side environment
  variables or an operator-managed secret store. Never place them in a browser.
- Keep local secrets in ignored files; verify with `git check-ignore` before use.
- Validate provider output against the exact request's legal choices. Treat all
  external response content as data, not executable instructions.
- Send only the position, rules, dice, and choices required for inference.
- Apply request/deadline limits and reject stale or partial decisions.
- Redact credentials before logging. Provider bodies can echo sensitive input.
- Public CI uses synthetic fixtures and mocked HTTP responses with no live keys.

If a credential is exposed, report it privately and have the owner revoke it.
Removing a credential from the latest commit does not remove it from history.
