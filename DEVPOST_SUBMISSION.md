# Devpost Submission Draft

## Project Name

Server Guardian Warboard

## Tagline

A privacy-preserving, bilingual command view — built with Codex and GPT-5.6 —
that turns hostile automation into an explainable RPG/NORAD defense scene and
files confirmed attackers to community threat intelligence.

## Track

Apps for Your Life

## Official Rules Alignment

Authoritative source: https://openai.devpost.com/rules

- Submission deadline: July 21, 2026 at 5:00 pm Pacific Time.
- Category: Apps for Your Life (managing a personal server as a hobby, made safe and watchable).
- Existing-project rule: prior work and Submission Period work are separated in
  `README.md`, with dated commits and `docs/GPT-5.6-USAGE.md` as evidence.
- Working access: the public demo is free, requires no account, and does not need
  to be rebuilt by judges.
- Repository: public, MIT-licensed, with third-party notices and test instructions.
- Video: English, public on YouTube, clear demo with audio, and shorter than three
  minutes; it explains both the product and Codex/GPT-5.6 collaboration.
- Required manual field: the entrant must provide the `/feedback` Codex Session ID
  for the project thread where most core functionality was built.

## Demo URL

https://plzhacknono.duckdns.org/

## Inspiration

Running a personal server is part hobby and part everyday maintenance. The
security logs are useful, but difficult to scan and risky to share. I wanted a
life app that makes that daily defense understandable and safe to watch — then
realized the same high-confidence captures could contribute useful signal to
defenders beyond my home.

## What It Does

Server Guardian Warboard, built with Codex and GPT-5.6, converts privacy-filtered
honeypot-style events into RPG, map, NORAD, battle, and FPS-inspired defense
scenes. Confirmed high-confidence attacks pass a safety gate, 24-hour per-IP
deduplication, and rate limits before the backend files the attacker address and
standard categories to the AbuseIPDB community threat-intelligence feed. The
read-only app shows live reports filed, unique IPs, average confidence, and a
report badge. At the approved review render it demonstrated 200 reports,
200 unique IPs, and 98% average confidence. Judges can switch between English
and Korean and run deterministic demo scenes when live traffic is quiet.

## How We Built It

The product uses a small Python backend and a self-contained browser frontend,
built with Codex and GPT-5.6: the viewer modes and UI, the privacy redaction
boundary, the automatic AbuseIPDB contribution pipeline (24h per-IP dedup, rate
limiting, confirmed-event gate), deterministic demos, verification, and
documentation. Human decisions set the product direction, visual language,
privacy boundaries, and final acceptance criteria.
The deployment-neutral reporter and seven network-free mocked tests are published
under `source/backend/`, alongside a privacy-safe aggregate evidence snapshot.

## Privacy and Safety

Source IPs are replaced with stable `bot-xxxxxxxx` aliases, login names become
`login-xxxxxx`, the protected host is shown only as `Protected Sandbox`, and
suspicious URLs or command-like strings are defanged. Credentials, private
addresses, hostnames, raw event records, and operational deployment details are
not included in the public submission.
The AbuseIPDB reporter is backend-only and never triggered by the viewer. It
sends only the attacker IP and standard category codes, is gated to confirmed
high-confidence events, and deduplicates each IP for 24 hours.

## Challenges

The main challenge was preserving enough event structure to tell a useful story
while removing identifiers that could reveal the protected system or individual
sources. Deterministic scenes were added so evaluation does not depend on live
traffic.

## Accomplishments

- A judge-ready public experience with no login or private access requirement.
- English/Korean switching remembered locally in the browser.
- Privacy filtering at the backend response boundary.
- Repeatable visual demos for consistent judging.
- A privacy-safe GPT-5.6 collaboration record.
- An automatic community threat-intel contribution: confirmed attackers filed to
  AbuseIPDB, turning a personal defense into shared internet protection.
- The executable reporter, aggregate API whitelist, seven mocked tests, and a
  no-raw-IP evidence snapshot are included in the public repository.

## Potential Impact

The official judging criterion asks for a credible, specific case addressing a
real problem for a real audience, based on what is demonstrated. This project
starts with a real personal need: make daily home-server defense understandable
without exposing the server. Its wider audience includes firewalls, hosting
providers, security teams, and other home labs that consume community threat
intelligence. The demonstrated claim is deliberately bounded and measurable:
200 high-confidence reports filed for 200 unique addresses at 98% average
confidence during the review render. It does not claim to have “fixed” the
internet; it proves that one personal defense can contribute shared signal.

## What We Learned

Privacy is easier to verify when redaction happens before data reaches the
browser. A deterministic judging mode also makes a live-data product much easier
to evaluate fairly.

## What's Next

Add configurable event adapters, richer contribution analytics (per-category and
per-region breakdowns), accessibility improvements, and offline replay packages
that preserve the same public redaction contract.

## Links To Add Before Submission

- Public source repository: https://github.com/yazzang-homelab/server-guardian-warboard
- Public 3-minute YouTube demo: **pending v6 upload** (supersedes previous v2: https://youtu.be/J-gfPQeM5WA)
- GPT-5.6 usage record: `docs/GPT-5.6-USAGE.md`

## Final Checklist

- [x] Public demo URL works without an account.
- [x] English-language judging surface is available (full English coverage of
      all judge-facing text as of 2026-07-15).
- [x] Korean/English UI switch is included.
- [x] Public output excludes private infrastructure identifiers.
- [x] README explains Codex and GPT-5.6 collaboration.
- [x] README documents prior work vs. Submission Period work with dated evidence.
- [x] Privacy-safe GPT-5.6 usage record is included.
- [x] Repository licensing resolved (MIT + THIRD_PARTY_NOTICES.md).
- [x] Publish a shareable source repository and insert its URL above.
- [x] Produce and approve the v6 correction master (`video/out/v2/final.mp4`: 2:55,
      1080p30 H.264/AAC yuv420p, full-frame object-animated presentation,
      upgraded mobile-landscape app footage, 47 burned English subtitle cues,
      and an on-screen REVIEW SNAPSHOT · VERIFIED JULY 16, 2026 disclosure over
      the 200/200/98% contribution scene). The v6 render removes all
      loading-overlay frames and restores the village horizon with the licensed
      pixel-art forest/mountain atlas. Independent visual raters previously
      scored the package 85.25 / 85.59; conservative gate: 85.12 PASS. SHA256:
      `a3f7cacd9ee63389705faff39b78c5a0c4436371412c5cde2aade0e6755ce3ba`.
- [x] Produce and verify the `SERVER GUARDIAN` 4K/HD custom thumbnail, mobile check,
      grayscale hierarchy check, and alignment overlay.
- [x] Commit and push the v4 application, automatic-reporting feature, motion
      capture/render tooling, and submission documentation. (`432323d`)
- [x] Publish the deployment-neutral AbuseIPDB reporter, seven network-free tests,
      aggregate API contract, and privacy-safe evidence snapshot.
- [x] Upgrade and verify the app, presentation, and video with exact six-mode QA,
      candidate/release manifests, Gitleaks positive/negative scans, and NAS hashes.
- [ ] Upload v6 video to YouTube as Public and replace the pending URL above. (user)
- [ ] Provide the `/feedback` Codex Session ID on the submission form. (user)
- [ ] Submit the final entry through Devpost before July 21, 2026 5:00 pm PT. (user)

## 2:55 Demo Timeline

- **0:00-0:10 — Cyber-defense cold open:** a hacker attacks the protected server;
  the Guardian raises a cyan shield over synchronized generated effects.
- **0:10-0:34 — Incident and concept:** explain the attempts against a personal
  server, the read-only defense, and the decision to turn filtered events into play.
- **0:34-0:51 — Live strategic map:** show the real public product and aggregate routes.
- **0:51-1:15 — Privacy boundary and NORAD:** animated backend aliasing/defanging
  pipeline, followed by the same safe stream in the live NORAD view.
- **1:15-1:27 — Codex build:** show the judge-facing work built with Codex/GPT-5.6.
- **1:27-1:42 — New automatic-reporting feature:** animate the complete path from
  confirmed attack → high-confidence gate → AbuseIPDB → measurable evidence.
- **1:42-1:54 — Live feature evidence:** show the real public app at 200 filed reports,
  200 unique IPs, 98% average confidence, and trigger the report badge.
- **1:54-2:30 — Real game scenes:** deterministic skirmish, SRW battle, and FPS.
- **2:30-2:39 — Potential Impact:** apply the official judging test — a credible,
  specific case for a real problem and real audience, backed by demonstrated evidence.
- **2:39-2:47 — Verified result:** state the product and six-mode QA evidence.
- **2:47-2:55 — Close:** show the live demo and public repository URLs.
