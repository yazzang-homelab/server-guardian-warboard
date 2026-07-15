#!/usr/bin/env python3
"""Offline narration + subtitle builder (espeak-ng fallback narration).

Generates per-chunk WAVs with espeak-ng, assembles a full-length narration
track aligned to the segment timeline, and emits matching English SRT
subtitles. Deterministic: same input -> same output."""
import subprocess
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "script"
OUT = ROOT / "out"
TMP = OUT / "narr"
TMP.mkdir(parents=True, exist_ok=True)

RATE = 48000
VOICE = "en-us+m3"
SPEED = "158"

# (segment_start_s, segment_len_s, [(tts_text, subtitle_text), ...])
# Timeline: title 8 | dash 22 | redact 26 | lang 22 | modes 30 | skirmish 12
#           fps 11 | github 20 | end 7  => 158 s total.
SEGMENTS = [
    (0.4, 8, [
        ("Server Guardian Warboard. Built with Codex and G P T five point six for OpenAI Build Week.",
         "Server Guardian Warboard — built with Codex\nand GPT-5.6 for OpenAI Build Week."),
    ]),
    (8.5, 22, [
        ("Raw security logs are hard to scan, and risky to share.",
         "Raw security logs are hard to scan, and risky to share."),
        ("Server Guardian Warboard is a read only viewer that turns honeypot style events from a live decoy server into an explainable game dashboard.",
         "Server Guardian Warboard is a read-only viewer that turns\nhoneypot-style events from a live decoy server\ninto an explainable game dashboard."),
        ("This is the public judging surface. No account, and no write actions.",
         "This is the public judging surface.\nNo account, and no write actions."),
    ]),
    (30.5, 26, [
        ("Privacy filtering happens in the backend, before data ever reaches the browser.",
         "Privacy filtering happens in the backend,\nbefore data ever reaches the browser."),
        ("Source addresses become stable bot aliases. Login names are masked. The protected host is generalized.",
         "Source addresses become stable bot aliases.\nLogin names are masked. The protected host is generalized."),
        ("Suspicious web addresses and commands are defanged for safe display. What you see here is everything the public can see.",
         "Suspicious URLs and commands are defanged for safe display.\nWhat you see here is everything the public can see."),
    ]),
    (56.5, 22, [
        ("The interface is fully bilingual.", "The interface is fully bilingual."),
        ("One click switches every panel, nameplate, and dialogue line between English and Korean, including the canvas battle scenes.",
         "One click switches every panel, nameplate, and dialogue line\nbetween English and Korean — including the canvas battle scenes."),
        ("The choice is remembered locally in the browser.",
         "The choice is remembered locally in the browser."),
    ]),
    (78.5, 30, [
        ("Each view mode presents the same filtered event stream for a different scanning workflow.",
         "Each view mode presents the same filtered event stream\nfor a different scanning workflow."),
        ("The R P G village visualizes activity as a living scene. The map view shows aggregate origins.",
         "The RPG village visualizes activity as a living scene.\nThe map view shows aggregate origins."),
        ("And the NORAD view gives a classic operations room overview. All read only, all privacy filtered.",
         "And the NORAD view gives a classic operations-room overview.\nAll read-only, all privacy-filtered."),
    ]),
    (108.5, 12, [
        ("Deterministic demo scenes let judges evaluate the experience even when live traffic is low.",
         "Deterministic demo scenes let judges evaluate\nthe experience even when live traffic is low."),
        ("Demo equals skirmish replays a complete battle.",
         "?demo=skirmish replays a complete battle."),
    ]),
    (120.5, 11, [
        ("High risk payload events can even trigger first person dungeon sequences, with three weapons and three distinct choreographies.",
         "High-risk payload events can even trigger first-person dungeon\nsequences — three weapons, three distinct choreographies."),
    ]),
    (131.5, 20, [
        ("For Build Week, Codex and G P T five point six added the bilingual interface, the privacy boundary, deterministic demos, and Q A gates.",
         "For Build Week, Codex and GPT-5.6 added the bilingual interface,\nthe privacy boundary, deterministic demos, and QA gates."),
        ("Product, privacy, and design decisions stayed human. The repository documents prior work versus Build Week work.",
         "Product, privacy, and design decisions stayed human.\nThe repository documents prior work vs. Build Week work."),
    ]),
    (151.5, 7, [
        ("Try it live. A safer way to understand hostile automation, without exposing the system it protects.",
         "A safer way to understand hostile automation,\nwithout exposing the system it protects."),
    ]),
]

TOTAL = 158.0


def tts(text: str, path: Path) -> float:
    subprocess.run(["espeak-ng", "-v", VOICE, "-s", SPEED, "-a", "180",
                    "-w", str(path), text], check=True)
    with wave.open(str(path)) as w:
        return w.getnframes() / w.getframerate()


def read_pcm(path: Path):
    with wave.open(str(path)) as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2
        rate = w.getframerate()
        return w.readframes(w.getnframes()), rate


def srt_ts(t: float) -> str:
    ms = int(round(t * 1000))
    return f"{ms//3600000:02d}:{ms%3600000//60000:02d}:{ms%60000//1000:02d},{ms%1000:03d}"


def main():
    total_frames = int(TOTAL * RATE)
    mix = bytearray(total_frames * 2)          # 16-bit mono silence
    subs = []
    n = 0
    for seg_start, seg_len, chunks in SEGMENTS:
        t = seg_start
        for tts_text, sub_text in chunks:
            n += 1
            wav = TMP / f"c{n:02d}.wav"
            dur = tts(tts_text, wav)
            pcm, rate = read_pcm(wav)
            if t + dur > seg_start + seg_len:
                raise SystemExit(f"chunk {n} overflows segment: {t + dur:.1f} > {seg_start + seg_len}")
            # resample by simple frame duplication if rates differ
            if rate != RATE:
                factor = RATE / rate
                src = struct.unpack(f"<{len(pcm)//2}h", pcm)
                out = [src[min(int(i / factor), len(src) - 1)] for i in range(int(len(src) * factor))]
                pcm = struct.pack(f"<{len(out)}h", *out)
            off = int(t * RATE) * 2
            mix[off:off + len(pcm)] = pcm
            subs.append((t, min(t + dur + 0.3, seg_start + seg_len), sub_text))
            t += dur + 0.55
    with wave.open(str(OUT / "narration.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(bytes(mix))
    with open(OUT / "subtitles.srt", "w", encoding="utf-8") as f:
        for i, (a, b, txt) in enumerate(subs, 1):
            f.write(f"{i}\n{srt_ts(a)} --> {srt_ts(b)}\n{txt}\n\n")
    print(f"narration.wav {TOTAL}s, {len(subs)} subtitle cues")


if __name__ == "__main__":
    main()
