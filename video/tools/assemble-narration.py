#!/usr/bin/env python3
"""Fit eight ElevenLabs section takes to the approved 165-second storyboard."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "out" / "v2" / "tts"
WORK = ROOT / "out" / "v2" / "narration-sections"
OUTPUT = ROOT / "out" / "v2" / "narration.wav"
WINDOWS = [12.0, 12.0, 20.0, 30.0, 14.0, 61.0, 8.0, 8.0]
END_PAD = 0.20


def duration(path: Path) -> float:
    raw = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "json", str(path),
    ], text=True)
    return float(json.loads(raw)["format"]["duration"])


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    rendered: list[Path] = []
    for index, target in enumerate(WINDOWS, 1):
        source = SOURCE / f"section-{index:02d}.mp3"
        if not source.is_file():
            raise SystemExit(f"Missing ElevenLabs section: {source}")
        fitted = max(0.1, target - END_PAD)
        speed = max(1.0, duration(source) / fitted)
        if not 0.5 <= speed <= 2.0:
            raise SystemExit(f"Section {index} needs unsupported atempo={speed:.4f}")
        output = WORK / f"section-{index:02d}.wav"
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-i", str(source),
            "-af", (
                f"atempo={speed:.8f},aresample=48000,"
                f"aformat=sample_fmts=s16:channel_layouts=mono,apad,atrim=0:{target:.3f}"
            ),
            "-c:a", "pcm_s16le", str(output),
        ], check=True)
        rendered.append(output)
        print(f"section {index}: {duration(source):.2f}s -> {target:.2f}s (atempo {speed:.3f})")

    listing = WORK / "list.txt"
    listing.write_text("".join(f"file '{path.name}'\n" for path in rendered))
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
        "-i", str(listing), "-c:a", "pcm_s16le", str(OUTPUT),
    ], check=True)
    actual = duration(OUTPUT)
    if abs(actual - sum(WINDOWS)) > 0.05:
        raise SystemExit(f"Narration duration mismatch: {actual:.3f}s")
    print(f"Wrote {OUTPUT} ({actual:.3f}s, ElevenLabs)")


if __name__ == "__main__":
    main()
