#!/usr/bin/env python3
"""Create an original, deterministic cinematic underscore for the demo video."""
from __future__ import annotations

import argparse
import wave
from pathlib import Path

import numpy as np

SR = 48_000


def tone(t: np.ndarray, hz: float, phase: float = 0.0) -> np.ndarray:
    return np.sin(2.0 * np.pi * hz * t + phase)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=float, default=165.0)
    parser.add_argument("--output", type=Path, default=Path("out/v2/score.wav"))
    args = parser.parse_args()

    n = int(args.duration * SR)
    t = np.arange(n, dtype=np.float64) / SR
    rng = np.random.default_rng(20260715)

    # Low, non-melodic security-room bed: an original D/A drone with slow motion.
    slow = 0.55 + 0.18 * tone(t, 0.031) + 0.10 * tone(t, 0.071, 1.3)
    bed = (
        0.055 * tone(t, 36.71)
        + 0.032 * tone(t, 55.00, 0.7)
        + 0.018 * tone(t, 73.42, 1.8)
    ) * slow

    # Restrained high signal shimmer, intentionally sparse under narration.
    shimmer = np.zeros(n, dtype=np.float64)
    for start in np.arange(9.0, args.duration, 13.0):
        i0 = int(start * SR)
        length = min(int(2.2 * SR), n - i0)
        if length <= 0:
            continue
        x = np.arange(length) / SR
        env = np.sin(np.pi * np.clip(x / 2.2, 0, 1)) ** 2
        shimmer[i0 : i0 + length] += 0.012 * env * (
            tone(x, 440.0, rng.uniform(0, 6.28)) + 0.5 * tone(x, 659.25)
        )

    # Quiet 84 BPM pulse gives the edit forward motion without becoming music-led.
    pulse = np.zeros(n, dtype=np.float64)
    for start in np.arange(4.0, args.duration, 60.0 / 84.0):
        i0 = int(start * SR)
        length = min(int(0.24 * SR), n - i0)
        if length <= 0:
            continue
        x = np.arange(length) / SR
        env = np.exp(-18.0 * x)
        pulse[i0 : i0 + length] += 0.020 * env * tone(x, 62.0 - 18.0 * x)

    # Transition impacts and short synthetic whooshes for section changes.
    fx = np.zeros(n, dtype=np.float64)
    for start in (0.0, 16.0, 38.0, 61.0, 86.0, 111.0, 137.0, 156.0):
        i0 = int(start * SR)
        length = min(int(1.1 * SR), n - i0)
        if length <= 0:
            continue
        x = np.arange(length) / SR
        impact = np.exp(-5.5 * x) * (0.055 * tone(x, 44.0) + 0.026 * tone(x, 88.0))
        noise = rng.normal(0, 1, length)
        smooth = np.convolve(noise, np.ones(160) / 160, mode="same")
        whoosh = 0.030 * np.sin(np.pi * np.clip(x / 1.1, 0, 1)) ** 2 * smooth
        fx[i0 : i0 + length] += impact + whoosh

    mono = np.tanh((bed + shimmer + pulse + fx) * 1.35)
    # Subtle stereo width without phase-sensitive bass cancellation.
    delay = int(0.012 * SR)
    right = 0.96 * mono + 0.04 * np.roll(shimmer + fx, delay)
    left = 0.96 * mono + 0.04 * np.roll(shimmer + fx, -delay)
    stereo = np.stack((left, right), axis=1)
    peak = max(float(np.max(np.abs(stereo))), 1e-9)
    stereo = np.clip(stereo * min(0.82 / peak, 1.0), -1.0, 1.0)
    pcm = (stereo * 32767.0).astype("<i2")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(args.output), "wb") as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes(pcm.tobytes())
    print(f"Wrote {args.output} ({args.duration:.1f}s, original synthesized score)")


if __name__ == "__main__":
    main()
