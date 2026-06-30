from pathlib import Path


SKIP_DIRS = {
    ".git",
    "__pycache__",
    "dist",
    "media",
    "node_modules",
    "staticfiles",
    "venv",
}

TEXT_EXTENSIONS = {
    ".conf",
    ".css",
    ".env",
    ".example",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".py",
    ".sh",
    ".ts",
    ".tsx",
    ".yaml",
    ".yml",
}

MOJIBAKE_MARKERS = [
    "\u00d8\u00a2",
    "\u00d8\u00a7",
    "\u00d8\u00a8",
    "\u00d8\u00b1",
    "\u00d8\u00b3",
    "\u00d8\u00b4",
    "\u00d8\u00b7",
    "\u00d8\u00b8",
    "\u00d8\u00b9",
    "\u00d8\u00ba",
    "\u00d8\u008c",
    "\u00d8\u009b",
    "\u00d8\u009f",
    "\u00d9\u201e",
    "\u00d9\u2020",
    "\u00d9\u2021",
    "\u00d9\u2026",
    "\u00e2\u20ac",
    "\u00ef\u00bb\u00bf",
]

# Latin/punctuation characters that show up when real UTF-8 Persian bytes get
# misread one byte at a time as Windows-1256 and re-saved as UTF-8 (a different,
# more common corruption pattern than the classic Ø/Ù double-encoding above —
# it survives `pip install`/copy-paste round trips that re-validate as UTF-8).
CP1256_MOJIBAKE_SIGNATURE = "\u0637\u0638\u0647\u063a\u00a9\u0639"

# Arabic letters that are valid Unicode but wrong for Persian — usually typed
# on an Arabic keyboard layout or pasted from an Arabic-locale tool. These
# look almost identical to their Persian counterparts but are a different
# codepoint, so they silently slip past UTF-8 validity checks. Described in
# words (not written literally) so this file doesn't flag its own source.
ARABIC_VARIANT_LETTERS = {
    "\u064a": "Arabic yeh U+064A (use Persian yeh U+06CC instead)",
    "\u0643": "Arabic kaf U+0643 (use Persian keheh U+06A9 instead)",
    "\u0629": "Arabic teh marbuta U+0629 (rare in Persian)",
    "\u0649": "Arabic alef maksura U+0649",
}


def should_check(path: Path) -> bool:
    if not path.is_file():
        return False
    if any(part in SKIP_DIRS for part in path.parts):
        return False
    return path.suffix in TEXT_EXTENSIONS or path.name.startswith(".env")


def cp1256_roundtrip_fix(line: str) -> str | None:
    """If `line` is Persian text that was misread as Windows-1256 and
    re-encoded as UTF-8, reversing that mistake yields clean Persian.
    Returns the fixed string, or None if the line isn't valid for the
    round-trip (i.e. almost certainly not this kind of mojibake)."""
    try:
        return line.encode("utf-8").decode("utf-8").encode("cp1256").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return None


def main() -> int:
    problems: list[str] = []

    for path in Path(".").rglob("*"):
        if not should_check(path):
            continue

        data = path.read_bytes()
        if data.startswith(b"\xef\xbb\xbf"):
            problems.append(f"{path}:1: UTF-8 BOM found")

        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError as exc:
            problems.append(f"{path}:{exc.start}: invalid UTF-8")
            continue

        for line_no, line in enumerate(text.splitlines(), 1):
            if "\ufeff" in line or "\ufffd" in line:
                problems.append(f"{path}:{line_no}: replacement/BOM character found")
            if any(marker in line for marker in MOJIBAKE_MARKERS):
                problems.append(f"{path}:{line_no}: possible Persian mojibake")

            if any(ch in line for ch in CP1256_MOJIBAKE_SIGNATURE):
                fixed = cp1256_roundtrip_fix(line)
                if fixed is not None and fixed != line:
                    persian_chars = sum(1 for ch in fixed if "\u0600" <= ch <= "\u06ff")
                    if persian_chars >= 3:
                        problems.append(
                            f"{path}:{line_no}: CP1256 mojibake "
                            f"(should read: {fixed.strip()!r})"
                        )

            for ch, desc in ARABIC_VARIANT_LETTERS.items():
                if ch in line:
                    problems.append(f"{path}:{line_no}: Arabic-variant letter {desc}")

    if problems:
        print("Unicode audit failed:")
        for problem in problems:
            print(problem)
        return 1

    print("Unicode audit passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
