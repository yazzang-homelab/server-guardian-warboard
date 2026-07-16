#!/usr/bin/env python3
"""Generate per-section narration MP3s for the v2 video.

Reads the 9-paragraph script (script/narration-v2.txt) and produces
out/v2/tts/section-01.mp3 .. section-09.mp3.

Primary: ElevenLabs (key from ELEVENLABS_API_KEY, voice from ELEVENLABS_VOICE_ID
or a default). The key is used only against the ElevenLabs HTTPS endpoint and is
never printed. Fallback: espeak-ng offline synthesis, so a render is always
possible even without API access/credits.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "script" / "narration-v2.txt"
TTS = ROOT / "out" / "v2" / "tts"
VOICE = os.environ.get("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")
MODEL = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")


def paragraphs() -> list[str]:
    raw = SCRIPT.read_text().split("\n\n")
    return [p.replace("\n", " ").strip() for p in raw if p.strip()]


def eleven(text: str, out: Path, key: str) -> bool:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}"
    body = json.dumps({
        "text": text,
        "model_id": MODEL,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75,
                           "style": 0.0, "use_speaker_boost": True},
    }).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "xi-api-key": key, "Content-Type": "application/json",
        "Accept": "audio/mpeg"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        if not data or len(data) < 2000:
            raise ValueError("suspiciously small audio")
        out.write_bytes(data)
        return True
    except urllib.error.HTTPError as exc:
        print(f"  ElevenLabs HTTP {exc.code} — falling back to espeak", file=sys.stderr)
        return False
    except Exception as exc:
        print(f"  ElevenLabs error {type(exc).__name__} — falling back to espeak", file=sys.stderr)
        return False


def espeak(text: str, out: Path) -> None:
    wav = out.with_suffix(".espeak.wav")
    subprocess.run(["espeak-ng", "-v", "en-us+m3", "-s", "158", "-p", "42",
                    "-w", str(wav), text], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav),
                    "-ar", "44100", "-ac", "1", "-b:a", "128k", str(out)], check=True)
    wav.unlink(missing_ok=True)


def main() -> int:
    TTS.mkdir(parents=True, exist_ok=True)
    paras = paragraphs()
    if len(paras) != 9:
        print(f"expected 9 paragraphs, got {len(paras)}", file=sys.stderr)
        return 1
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    used_eleven = 0
    for i, text in enumerate(paras, 1):
        out = TTS / f"section-{i:02d}.mp3"
        ok = eleven(text, out, key) if key else False
        if ok:
            used_eleven += 1
        else:
            espeak(text, out)
        print(f"section {i:02d}: {'ElevenLabs' if ok else 'espeak'} -> {out.name}")
    print(f"done: {used_eleven}/9 ElevenLabs, {9 - used_eleven}/9 espeak")
    return 0


if __name__ == "__main__":
    sys.exit(main())
