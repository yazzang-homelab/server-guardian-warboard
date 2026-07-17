---
theme: default
title: Server Guardian Warboard — Build Week
info: OpenAI Build Week — Apps for Your Life submission deck
aspectRatio: 16/9
canvasWidth: 1920
transition: fade
fonts:
  sans: Inter
  mono: IBM Plex Mono
---

<div class="corner">OPENAI BUILD WEEK · DEVELOPER TOOLS</div>
<div class="hook-grid">
  <div>
    <div class="kicker">The incident that started it</div>
    <div class="rule"></div>
    <h1 class="display xl">Someone kept trying to break into <span class="accent">my server.</span></h1>
    <p class="lede" style="margin-top:30px">Automated probes. Repeated logins. Payload drops.<br>Not a demo dataset — a problem at home.</p>
    <div style="display:flex;gap:10px;margin-top:34px">
      <span class="tag"><span class="dot" style="background:var(--red)"></span> LIVE SIGNALS</span>
      <span class="tag">READ-ONLY DEFENSE</span>
    </div>
  </div>
  <div class="server-orbit">
    <div class="ring r2"></div><div class="ring"></div>
    <div class="server-core"><div class="slot"></div><div class="slot"></div><div class="slot"></div><div class="slot"></div></div>
    <div class="attack-dot d1"></div><div class="attack-dot d2"></div><div class="attack-dot d3"></div><div class="attack-dot d4"></div><div class="attack-dot d5"></div>
  </div>
</div>
<div class="footer"><span>SERVER GUARDIAN WARBOARD</span><span>01 / ORIGIN</span></div>

---

<div class="corner">FROM DEFENSE TO PLAY</div>
<div class="kicker">The idea</div>
<div class="rule"></div>
<h1 class="display">I defended it.<br>Then I turned the attacks into <span class="accent">a game.</span></h1>
<div class="origin-row">
  <div class="origin-card"><span class="icon">⚠</span><span class="num">01</span><h3>Hostile automation</h3><p>Internet-wide probes repeatedly hit a public decoy service.</p><span class="origin-arrow">→</span></div>
  <div class="origin-card"><span class="icon">◈</span><span class="num">02</span><h3>Privacy-safe defense</h3><p>A read-only honeypot captures intent without exposing the real system.</p><span class="origin-arrow">→</span></div>
  <div class="origin-card"><span class="icon">⚔</span><span class="num">03</span><h3>Explainable play</h3><p>Every signal becomes a monster, battle, map route, or village event.</p></div>
</div>
<div class="footer"><span>RAW LOGS → A STORY PEOPLE CAN READ</span><span>02 / CONCEPT</span></div>

---

<div class="corner">PRIVACY BOUNDARY</div>
<div class="kicker">How a signal becomes a scene</div>
<div class="rule"></div>
<h1 class="display">The browser never receives the <span class="red">raw attack record.</span></h1>
<div class="pipeline">
  <div class="pipe-card"><div class="eyebrow">Input</div><h3>Internet probes</h3><ul><li>Login attempts</li><li>Session activity</li><li>Payload indicators</li></ul></div>
  <div class="pipe-arrow">→</div>
  <div class="pipe-card"><div class="eyebrow">Defense</div><h3>Read-only decoy</h3><ul><li>No route to real host</li><li>No write controls</li><li>Structured events</li></ul></div>
  <div class="pipe-arrow">→</div>
  <div class="pipe-card privacy"><div class="eyebrow">Privacy boundary</div><h3>Redact & defang</h3><ul><li>IP → bot-xxxxxxxx</li><li>Login → login-xxxxxx</li><li>Host → Protected Sandbox</li><li>Commands/URLs defanged</li></ul></div>
  <div class="pipe-arrow">→</div>
  <div class="pipe-card"><div class="eyebrow">Output</div><h3>Warboard</h3><ul><li>RPG village</li><li>Map / NORAD</li><li>Battle / FPS</li></ul></div>
</div>
<div class="privacy-note"><b>Redaction happens before the browser</b> — not after rendering.</div>
<div class="footer"><span>PRIVACY-PRESERVING BY ARCHITECTURE</span><span>03 / PIPELINE</span></div>

---

<div class="corner">BUILD WEEK · JULY 2026</div>
<div class="kicker">Development pipeline</div>
<div class="rule"></div>
<h1 class="display">Built with <span class="green">Codex + GPT-5.6</span> — from raw logs to a real product.</h1>
<div class="build-grid">
  <div class="timeline">
    <div class="timeline-step">Codex builds the judge-facing product</div>
    <div class="timeline-step">Privacy redaction boundary</div>
    <div class="timeline-step">AbuseIPDB threat-intel contribution</div>
    <div class="timeline-step">Full EN / KO judge surface</div>
    <div class="timeline-step">Deterministic demo modes</div>
    <div class="timeline-step">Six-mode automated QA</div>
  </div>
  <div class="diff-box">
    <div class="diff-row"><b>Codex + GPT-5.6</b><span>Product build, contribution pipeline, redaction, bilingual coverage, deterministic checks, docs</span></div>
    <div class="diff-row"><b>Human</b><span>Product direction, privacy boundaries, visual language, safety decisions, final acceptance</span></div>
    <div class="diff-row"><b>Evidence</b><span>Dated commits · usage record · public repo · repeatable build · live demo</span></div>
    <div class="diff-row"><b>Gate</b><span class="green">6 / 6 modes passed · deterministic build</span></div>
  </div>
</div>
<div class="footer"><span>WORK ADDED DURING THE SUBMISSION PERIOD</span><span>04 / BUILD</span></div>

---

<div class="corner">ONE STREAM · MANY WAYS TO READ IT</div>
<div class="kicker">Game composition</div>
<div class="rule"></div>
<h1 class="display">One filtered stream. <span class="accent">Four ways to scan it.</span></h1>
<div class="mode-grid">
  <div class="mode-card"><div class="shot" style="background-image:url('/assets/village.png')"></div><div class="body"><h3>RPG Village</h3><p>Signals become patrols and battles.</p></div></div>
  <div class="mode-card"><div class="shot" style="background-image:url('/assets/map.png')"></div><div class="body"><h3>Strategic Map</h3><p>Country-level origins and routes.</p></div></div>
  <div class="mode-card"><div class="shot" style="background-image:url('/assets/norad.png')"></div><div class="body"><h3>NORAD</h3><p>Operations view for rapid triage.</p></div></div>
  <div class="mode-card"><div class="shot" style="background-image:url('/assets/fps.png')"></div><div class="body"><h3>Battle / FPS</h3><p>Repeatable scene for judge review.</p></div></div>
</div>
<div class="footer"><span>VISUALIZATION WITHOUT EXPOSING INFRASTRUCTURE</span><span>05 / GAME</span></div>

---

<div class="corner">NEW BUILD WEEK FEATURE · APPS FOR YOUR LIFE</div>
<div class="kicker">From a life app to shared protection</div>
<div class="rule"></div>
<h1 class="display">A captured attack becomes <span class="green">shared protection.</span></h1>
<div class="pipeline feature-pipeline">
  <div class="pipe-card feature-card"><div class="eyebrow">01 · Capture</div><h3>Confirmed attack</h3><ul><li>Payload execution</li><li>Repeated SSH attempts</li></ul></div>
  <div class="pipe-arrow feature-arrow">→</div>
  <div class="pipe-card privacy feature-card"><div class="eyebrow">02 · Safety gate</div><h3>High-confidence only</h3><ul><li>24h per-IP dedup</li><li>Rate + daily limits</li><li>No victim data</li></ul></div>
  <div class="pipe-arrow feature-arrow">→</div>
  <div class="pipe-card feature-card"><div class="eyebrow">03 · Contribution</div><h3>Share a vetted signal</h3><ul><li>IP + standard categories</li><li>Backend-only write</li></ul></div>
  <div class="pipe-arrow feature-arrow">→</div>
  <div class="pipe-card feature-card"><div class="eyebrow">04 · Proof</div><h3>Evidence, not hype</h3><ul><li>Reports + unique IPs</li><li>Confidence score</li><li>In-app report badge</li></ul></div>
</div>
<div class="privacy-note feature-note"><b>The public app stays read-only.</b> Reporting stays behind the privacy boundary.</div>
<div class="footer"><span>CODEX-BUILT · GATED · DEDUPLICATED · MEASURABLE</span><span>06 / NEW FEATURE</span></div>

---

<div class="corner">JUDGING CRITERION · POTENTIAL IMPACT</div>
<div class="kicker">From one life app to shared protection</div>
<div class="rule"></div>
<h1 class="display">One life app. <span class="green">Shared protection.</span></h1>
<div class="impact-grid">
  <div class="impact-story">
    <div class="impact-step"><b>Personal need</b><span>Make home-server defense understandable.</span></div>
    <div class="impact-link">↓</div>
    <div class="impact-step"><b>Community benefit</b><span>Share confirmed intelligence beyond this server.</span></div>
    <div class="impact-link">↓</div>
    <div class="impact-step"><b>Credible claim</b><span>Count filed reports — never claim the internet is fixed.</span></div>
  </div>
  <div class="impact-proof">
    <div class="proof-label">VERIFIED CONTRIBUTION · REVIEW SNAPSHOT · JULY 16, 2026</div>
    <div class="proof-metrics">
      <div class="proof-metric"><b>200</b><span>reports filed</span></div>
      <div class="proof-metric"><b>200</b><span>unique IPs flagged</span></div>
      <div class="proof-metric"><b>98%</b><span>average confidence</span></div>
    </div>
    <div class="audience-row"><span>Firewalls</span><span>Hosting providers</span><span>Security teams</span><span>Home labs</span></div>
    <div class="proof-note">Snapshot of AbuseIPDB filings verified at the approved review render. The live counter keeps growing.</div>
  </div>
</div>
<div class="footer"><span>SPECIFIC · CREDIBLE · MEASURABLE</span><span>07 / IMPACT</span></div>

---

<div class="corner">VERIFIED RESULT</div>
<div class="kicker">What shipped</div>
<div class="rule"></div>
<h1 class="display">Public. Proven. <span class="green">Verifiable.</span></h1>
<div class="metric-grid">
  <div class="metric"><b>48K+</b><span>hostile automation events visualized at recording time</span></div>
  <div class="metric"><b>6</b><span>deterministic judge demo modes</span></div>
  <div class="metric"><b>14</b><span>signal / monster species</span></div>
  <div class="metric"><b>3</b><span>FPS weapon choreographies</span></div>
</div>
<div class="result-band">
  <div class="result-pill">FULL ENGLISH / KOREAN UI</div>
  <div class="result-pill">READ-ONLY PUBLIC DEMO</div>
  <div class="result-pill">6 / 6 QA MODES PASSED</div>
</div>
<div class="footer"><span>LIVE · PUBLIC · PRIVACY-FILTERED</span><span>08 / RESULT</span></div>

---

<div class="corner">SERVER GUARDIAN WARBOARD</div>
<div class="end-wrap">
  <div>
    <div class="kicker">From hostile automation to an explainable game</div>
    <div class="rule" style="margin:24px auto 28px"></div>
    <h1 class="display xl">Understand the attack.<br><span class="accent">Never expose the system.</span></h1>
    <div class="links">
      <div class="link-card">plzhacknono.duckdns.org</div>
      <div class="link-card">github.com/yazzang-homelab/server-guardian-warboard</div>
    </div>
    <p class="lede" style="margin:34px auto 0;font-size:19px">Built with Codex + GPT-5.6 for OpenAI Build Week</p>
  </div>
</div>
<div class="footer"><span>TRY THE LIVE DEMO</span><span>09 / CLOSE</span></div>
