#!/usr/bin/env python3
"""Build readable SRT captions from the approved v2 narration section windows."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "script" / "narration-v2.txt"
OUTPUT = ROOT / "out" / "v2" / "subtitles.srt"
OPENING_SECONDS = 10.0
WINDOWS = [
    (OPENING_SECONDS + 0.0, OPENING_SECONDS + 12.0),
    (OPENING_SECONDS + 12.0, OPENING_SECONDS + 24.0),
    (OPENING_SECONDS + 24.0, OPENING_SECONDS + 44.0),
    (OPENING_SECONDS + 44.0, OPENING_SECONDS + 72.0),
    (OPENING_SECONDS + 72.0, OPENING_SECONDS + 84.0),
    (OPENING_SECONDS + 84.0, OPENING_SECONDS + 98.0),
    (OPENING_SECONDS + 98.0, OPENING_SECONDS + 149.0),
    (OPENING_SECONDS + 149.0, OPENING_SECONDS + 157.0),
    (OPENING_SECONDS + 157.0, OPENING_SECONDS + 165.0),
]
MAX_WORDS = 9


def stamp(seconds: float) -> str:
    millis = max(0, round(seconds * 1000))
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    secs, millis = divmod(millis, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def chunks(paragraph: str) -> list[str]:
    words = paragraph.split()
    result: list[str] = []
    current: list[str] = []
    for word in words:
        current.append(word)
        sentence_end = bool(re.search(r'[.!?][\"\']?$', word))
        if len(current) >= MAX_WORDS or (sentence_end and len(current) >= 4):
            result.append(" ".join(current))
            current = []
    if current:
        if result and len(current) <= 3:
            result[-1] += " " + " ".join(current)
        else:
            result.append(" ".join(current))
    return result


def main() -> None:
    paragraphs = [p.replace("\n", " ").strip() for p in SCRIPT.read_text().split("\n\n") if p.strip()]
    if len(paragraphs) != len(WINDOWS):
        raise SystemExit(f"Expected {len(WINDOWS)} narration sections, found {len(paragraphs)}")

    cues: list[tuple[float, float, str]] = []
    for paragraph, (start, end) in zip(paragraphs, WINDOWS, strict=True):
        parts = chunks(paragraph)
        weights = [len(part.split()) for part in parts]
        total = sum(weights)
        cursor = start
        for index, (part, weight) in enumerate(zip(parts, weights, strict=True)):
            cue_end = end if index == len(parts) - 1 else cursor + (end - start) * weight / total
            cues.append((cursor, cue_end, part))
            cursor = cue_end

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as out:
        for index, (start, end, text) in enumerate(cues, 1):
            out.write(f"{index}\n{stamp(start)} --> {stamp(end)}\n{text}\n\n")
    print(f"Wrote {OUTPUT} ({len(cues)} cues, {WINDOWS[-1][1]:.0f}s)")


if __name__ == "__main__":
    main()
