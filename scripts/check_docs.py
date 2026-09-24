#!/usr/bin/env python3
"""Check bootstrap Markdown and inline local file links, without network access.

This intentionally handles the repository's simple inline-link convention.
External URLs, reference-style links, and anchors are outside its scope.
"""

from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    names = subprocess.check_output(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=root,
    ).decode("utf-8").split("\0")
    documents = sorted({name for name in names if name.endswith(".md")})
    errors: list[str] = []
    links = 0
    for name in documents:
        path = root / name
        try:
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as error:
            errors.append(f"{name}: cannot read UTF-8: {error}")
            continue
        if not content.endswith("\n"):
            errors.append(f"{name}: missing final newline")
        for number, line in enumerate(content.splitlines(), start=1):
            if line.rstrip() != line:
                errors.append(f"{name}:{number}: trailing whitespace")
        for target in re.findall(r"\[[^\]\n]*\]\(([^)\n]+)\)", content):
            parsed = urlsplit(target.strip().strip("<>"))
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            links += 1
            destination = path.parent / unquote(parsed.path)
            if not destination.exists():
                errors.append(f"{name}: missing local link target: {target}")
    if not documents:
        errors.append("No Markdown files found")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Checked {len(documents)} Markdown files and {links} local file links")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
