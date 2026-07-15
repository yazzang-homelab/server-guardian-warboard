#!/usr/bin/env python3
"""Build the approved SERVER GUARDIAN YouTube thumbnail and review proofs."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps, ImageStat

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "out" / "v2" / "review" / "opening-v2-cyber-reference.png"
FONT_PATH = ROOT / "assets" / "fonts" / "BebasNeue-Regular.ttf"
OUT = ROOT / "out" / "v2"
REVIEW = OUT / "review"
MASTER_SIZE = (3840, 2160)
TITLE_HEIGHT = 504
SAFE = 240
SCENE_CROP = (260, 300, 2300, 1180)

OFF_WHITE = (241, 245, 247, 255)
AMBER = (255, 194, 57, 255)
NAVY = (4, 9, 20, 255)
CYAN = (73, 228, 219, 170)
RED = (255, 75, 88, 170)


def tracked_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, tracking: int) -> int:
    return sum(draw.textlength(char, font=font) for char in text) + tracking * max(0, len(text) - 1)


def draw_tracked(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    tracking: int,
) -> float:
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=font, fill=fill)
        x += draw.textlength(char, font=font) + tracking
    return x


def title_metrics(draw: ImageDraw.ImageDraw) -> tuple[ImageFont.FreeTypeFont, int, int, int]:
    tracking = 9
    gap = 108
    size = 390
    max_width = MASTER_SIZE[0] - 2 * SAFE
    while size >= 240:
        font = ImageFont.truetype(str(FONT_PATH), size)
        server = round(tracked_width(draw, "SERVER", font, tracking))
        guardian = round(tracked_width(draw, "GUARDIAN", font, tracking))
        if server + gap + guardian <= max_width:
            return font, tracking, gap, server + gap + guardian
        size -= 6
    raise RuntimeError("SERVER GUARDIAN title does not fit the safe area")


def build_master() -> Image.Image:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing approved cyber artwork: {SOURCE}")
    if not FONT_PATH.is_file():
        raise SystemExit(f"Missing licensed display font: {FONT_PATH}")

    source = Image.open(SOURCE).convert("RGB")
    scene = source.crop(SCENE_CROP).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    scene = scene.resize((MASTER_SIZE[0], MASTER_SIZE[1] - TITLE_HEIGHT), Image.Resampling.LANCZOS)
    scene = ImageEnhance.Contrast(scene).enhance(1.07)
    scene = ImageEnhance.Color(scene).enhance(1.06)

    # Match the title band to the scene's sky so the join reads as one composition.
    sky_strip = scene.crop((0, 0, scene.width, 32))
    sky = tuple(round(value) for value in ImageStat.Stat(sky_strip).mean[:3])
    gradient = Image.new("RGB", (1, TITLE_HEIGHT))
    pixels = gradient.load()
    for y in range(TITLE_HEIGHT):
        t = (y / max(1, TITLE_HEIGHT - 1)) ** 1.35
        pixels[0, y] = tuple(round(NAVY[i] * (1 - t) + sky[i] * t) for i in range(3))
    gradient = gradient.resize((MASTER_SIZE[0], TITLE_HEIGHT))

    master = Image.new("RGB", MASTER_SIZE)
    master.paste(gradient, (0, 0))
    master.paste(scene, (0, TITLE_HEIGHT))
    master = master.convert("RGBA")

    # One optically centered line, with artwork and lettering kept independent.
    measure = ImageDraw.Draw(master)
    font, tracking, gap, title_width = title_metrics(measure)
    x = round((MASTER_SIZE[0] - title_width) / 2) - 18
    bbox = font.getbbox("SERVER GUARDIAN")
    y = SAFE - bbox[1]

    shadow = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    end = draw_tracked(shadow_draw, (x + 14, y + 18), "SERVER", font, (0, 0, 0, 220), tracking)
    draw_tracked(shadow_draw, (end + gap, y + 18), "GUARDIAN", font, (0, 0, 0, 220), tracking)
    shadow = shadow.filter(ImageFilter.GaussianBlur(13))
    master = Image.alpha_composite(master, shadow)

    draw = ImageDraw.Draw(master)
    end = draw_tracked(draw, (x, y), "SERVER", font, OFF_WHITE, tracking)
    draw_tracked(draw, (end + gap, y), "GUARDIAN", font, AMBER, tracking)
    return master.convert("RGB")


def save_proofs(master: Image.Image) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    master.save(OUT / "youtube-thumbnail-4k.png", optimize=True)

    upload = master.resize((1280, 720), Image.Resampling.LANCZOS)
    upload = upload.filter(ImageFilter.UnsharpMask(radius=0.8, percent=115, threshold=2))
    upload.save(OUT / "youtube-thumbnail.jpg", quality=94, subsampling=0, optimize=True)

    mobile = upload.resize((384, 216), Image.Resampling.LANCZOS)
    mobile.save(REVIEW / "youtube-thumbnail-mobile.png", optimize=True)
    ImageOps.grayscale(upload).save(REVIEW / "youtube-thumbnail-grayscale.png", optimize=True)

    overlay = master.convert("RGBA")
    grid = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(grid)
    column = MASTER_SIZE[0] / 12
    for index in range(13):
        x = round(index * column)
        draw.line((x, 0, x, MASTER_SIZE[1]), fill=CYAN, width=3)
    draw.rectangle((SAFE, SAFE, MASTER_SIZE[0] - SAFE, MASTER_SIZE[1] - SAFE),
                   outline=(255, 255, 255, 190), width=8)
    draw.rectangle((MASTER_SIZE[0] - 480, MASTER_SIZE[1] - 240,
                    MASTER_SIZE[0], MASTER_SIZE[1]),
                   outline=RED, fill=(255, 75, 88, 35), width=8)
    overlay = Image.alpha_composite(overlay, grid).convert("RGB")
    overlay.resize((1280, 720), Image.Resampling.LANCZOS).save(
        REVIEW / "youtube-thumbnail-alignment.png", optimize=True
    )


def main() -> None:
    master = build_master()
    save_proofs(master)
    upload = OUT / "youtube-thumbnail.jpg"
    if upload.stat().st_size >= 2_000_000:
        raise SystemExit(f"Upload thumbnail exceeds 2 MB: {upload.stat().st_size}")
    print("Wrote SERVER GUARDIAN thumbnail master and four review proofs")


if __name__ == "__main__":
    main()
