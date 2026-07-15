#!/usr/bin/env python3
"""warboard v2 결정론 조립 빌더.
src/css + src/js + assets/world.js + build/atlas_*(있으면) + build/font.css(있으면)
→ build/index.html 단일 자기완결 파일. 크기 예산 리포트 포함."""
import base64
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, BUILD, ASSETS = ROOT / "src", ROOT / "build", ROOT / "assets"

TEMPLATE = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow">
<title>Server Guardian Warboard — plzhacknono</title>
<meta name="description" content="Read-only, privacy-preserving honeypot event viewer with RPG and NORAD-style views for OpenAI Build Week judging.">
<meta property="og:title" content="Server Guardian Warboard — plzhacknono">
<meta property="og:description" content="A public, read-only hackathon viewer built with Codex and GPT-5.6 that turns security events into an explainable dashboard.">
<style>/*__CSS__*/</style>
<style>/*__FONTCSS__*/</style>
</head><body data-theme="rpg">
<div id="boot"><div class="flame"></div><small>Lighting the campfire…</small></div>
<div id="app">
<header>
  <div><h1 id="appTitle">Server Guardian Warboard</h1><div id="appSub" class="sub">Read-only honeypot event viewer · RPG/NORAD visualization</div></div>
  <div id="heroChip"><span>LV.<b id="lv">1</b></span>
    <div><div id="herotitle">Wandering Sentry</div><div id="xbar"><div id="xfill"></div></div></div>
  </div>
  <span id="xptxt" class="sub"></span>
  <div id="mood" data-lv="5">…</div>
  <div class="btns">
    <button id="btnLang">한국어</button><button id="btnMap">Map</button><button id="btnTheme">NORAD</button>
    <button id="btnSnd">Audio off</button><button id="btnCRT">CRT</button>
    <button id="btnShare">Share card</button>
  </div>
  <span id="clock"></span>
</header>
<div id="ticker"><div id="taunt"></div></div>
<main>
  <div id="stageBox"><canvas id="stage" width="480" height="360"></canvas></div>
  <div class="side">
    <div class="panel"><h3><span id="statusTitle">Guardian Status</span> <small id="costume"></small></h3>
      <div id="tiles"></div><div id="skills"></div></div>
    <div class="panel"><h3><span id="dexTitle">Signal Bestiary</span> <small id="dexpct"></small></h3><div id="dex"></div></div>
    <div class="panel"><h3 id="rankTitle">Activity Ranking</h3>
      <div class="cols2"><div id="hof"></div><div id="countries"></div></div></div>
    <div class="panel"><h3><span id="lootTitle">Defanged Artifacts</span> <small id="lootNote">safe display</small></h3><div id="loot"></div></div>
  </div>
</main>
<div id="feedPanel"><h3 id="feedTitle" style="font-size:12px;color:var(--gold);margin-bottom:5px">Event Log</h3>
  <div id="feed"></div></div>
<div id="about">
  <b>What is this?</b> Server Guardian Warboard is a <b>read-only</b> hackathon viewer that visualizes honeypot-style events
  as an RPG/NORAD security dashboard. Battles are narrative renderings; each monster represents redacted bot activity.
  IP addresses are shown as bot aliases, and potentially malicious URLs and commands are shown only in defanged hxxp/[.] form.
  · Controls: map/NORAD/theme/audio/share toggles; add ?demo=skirmish|dq|srw|fps|fpss|fpsm for deterministic demo scenes.
  · Devpost testing: no account required, no write actions, and the public viewer is privacy-preserving.
  · Built for OpenAI Build Week with Codex and GPT-5.6.
  · Assets: 0x72, LuizMelo, Kenney, Ansimuz and others (CC0) + Pimen free assets; SFX by Juhani Junkala, Kenney, Ogrebane, thebardofblasphemy (CC0); font Galmuri (OFL).
</div>
<div id="submission">
  <h2>OpenAI Build Week Submission Notes</h2>
  <div class="submitgrid">
    <section><h3>Track</h3><p>Apps for Your Life. Managing my own server is a personal hobby, and this turns everyday defense of it into something worth watching without exposing private infrastructure.</p></section>
    <section><h3>How to Test</h3><p>Open this URL, wait for the live feed, switch between RPG, map, and NORAD views, then try the demo query strings for repeatable judging scenes.</p></section>
    <section><h3>Privacy</h3><p>Public IPs are replaced by bot aliases, host identity is generalized, and suspicious strings are defanged before display.</p></section>
    <section><h3>Codex + GPT-5.6</h3><p>Codex and GPT-5.6 were used to extend the viewer, harden display paths, add deterministic QA checks, and prepare this judging surface.</p></section>
  </div>
</div>
</div>
<div id="crtfx"></div>
<script>/*__WORLD__*/</script>
<script>/*__ATLAS__*/</script>
<script>/*__AUDIO__*/</script>
<script>/*__JS__*/</script>
</body></html>"""


def slot(html: str, key: str, content: str) -> str:
    marker = "/*__" + key + "__*/"
    parts = html.split(marker)
    assert len(parts) == 2, f"marker {key} not found or duplicated"
    return parts[0] + content + parts[1]


def main() -> int:
    BUILD.mkdir(exist_ok=True)
    css = "\n".join(p.read_text() for p in sorted((SRC / "css").glob("*.css")))
    js = "\n;\n".join(p.read_text() for p in sorted((SRC / "js").glob("*.js")))
    world = (ASSETS / "world.js").read_text().strip() if (ASSETS / "world.js").exists() else "window.G_WORLD=[];"

    fontcss = (BUILD / "font.css").read_text() if (BUILD / "font.css").exists() else ""

    atlas_js = "/* 아틀라스 미주입 — 스탠드인 모드 */"
    meta_p = BUILD / "atlas_meta.json"
    if meta_p.exists():
        meta = json.loads(meta_p.read_text())
        texs = []
        for i in range(meta.get("ntex", 1)):
            p = BUILD / f"atlas_{i}.png"
            texs.append("data:image/png;base64," + base64.b64encode(p.read_bytes()).decode())
        atlas_js = ("window.G_ATLAS_META=" + json.dumps({"sprites": meta["sprites"], "anims": meta["anims"]},
                    separators=(",", ":"), ensure_ascii=False)
                    + ";\nwindow.G_ATLAS_B64=" + json.dumps(texs) + ";")

    audio_js = "window.G_SFX_B64={};"
    sfx_dir = ASSETS / "sfx"
    if sfx_dir.exists():
        entries = {p.stem: "data:audio/ogg;base64," + base64.b64encode(p.read_bytes()).decode()
                   for p in sorted(sfx_dir.glob("*.ogg"))}
        if entries:
            audio_js = "window.G_SFX_B64=" + json.dumps(entries, separators=(",", ":")) + ";"

    html = TEMPLATE
    html = slot(html, "CSS", css)
    html = slot(html, "FONTCSS", fontcss)
    html = slot(html, "WORLD", world)
    html = slot(html, "ATLAS", atlas_js)
    html = slot(html, "AUDIO", audio_js)
    html = slot(html, "JS", js + "\n;document.getElementById('boot').classList.add('off');")

    out = BUILD / "index.html"
    out.write_text(html)
    (BUILD / "_all.js").write_text(js)  # node --check 용

    tot = len(html.encode())
    print(f"build/index.html = {tot/1024:.0f} KB  (예산 1536KB {'OK' if tot <= 1536*1024 else '★초과★'})")
    for name, s in [("css", css), ("font", fontcss), ("world", world), ("atlas", atlas_js),
                    ("audio", audio_js), ("js", js)]:
        print(f"  {name:6} {len(s.encode())/1024:8.1f} KB")
    if len(audio_js.encode()) > 300 * 1024:
        print("  ★audio 300KB 상한 초과 — 파일 수/샘플레이트 축소 검토★")
    print("sha256", hashlib.sha256(html.encode()).hexdigest()[:16])
    return 0


if __name__ == "__main__":
    sys.exit(main())
