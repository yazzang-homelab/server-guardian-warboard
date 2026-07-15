# Devpost Submission Draft

## Project Name

Server Guardian Warboard

## Tagline

A privacy-preserving, bilingual viewer that turns hostile automation signals
into an explainable RPG/NORAD security dashboard.

## Track

Developer Tools

## Official Rules Alignment

Authoritative source: https://openai.devpost.com/rules

- Submission deadline: July 21, 2026 at 5:00 pm Pacific Time.
- Category: Developer Tools (security and developer-facing visualization).
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

Security logs are useful but difficult to scan quickly and risky to share. This
project explores whether a read-only visual layer can make hostile automation
patterns understandable without exposing the protected server or raw attacker
identifiers.

## What It Does

Server Guardian Warboard converts privacy-filtered honeypot-style events into
RPG, map, NORAD, battle, and FPS-inspired views. Judges can switch between
English and Korean and use deterministic demo scenes when live event volume is
low. The public viewer contains no write controls.

## How We Built It

The viewer uses a small Python backend and a self-contained browser frontend.
Codex and GPT-5.6 assisted with code analysis, bilingual UI implementation,
privacy hardening, deterministic demos, verification, and submission
documentation. Human decisions set the product direction, visual language,
privacy boundaries, and final acceptance criteria.

## Privacy and Safety

Source IPs are replaced with stable `bot-xxxxxxxx` aliases, login names become
`login-xxxxxx`, the protected host is shown only as `Protected Sandbox`, and
suspicious URLs or command-like strings are defanged. Credentials, private
addresses, hostnames, raw event records, and operational deployment details are
not included in the public submission.

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

## What We Learned

Privacy is easier to verify when redaction happens before data reaches the
browser. A deterministic judging mode also makes a live-data product much easier
to evaluate fairly.

## What's Next

Add configurable event adapters, accessibility improvements, and offline replay
packages that preserve the same public redaction contract.

## Links To Add Before Submission

- Public source repository: https://github.com/yazzang-homelab/server-guardian-warboard
- Public 3-minute YouTube demo: https://youtu.be/J-gfPQeM5WA
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
- [x] Produce the cinematic v2 review master (`video/out/v2/final.mp4`: 2:55,
      1080p30 H.264/AAC, ten-second Higgsfield cyber-defense opening with generated
      effects, English ElevenLabs narration, burned English subtitles, real product
      footage) and the YouTube package. The user accepted this cut at 65/100 and
      explicitly requested no further editing investment.
- [x] Produce and verify the `SERVER GUARDIAN` 4K/HD custom thumbnail, mobile proof,
      grayscale hierarchy proof, and alignment overlay.
- [x] Commit and push the reviewed v2.8 application, video tooling, thumbnail tooling,
      licensing update, and submission documentation to the public repository. (1541c26)
- [x] Upload the video to YouTube (public) and insert its URL above.
      (https://youtu.be/J-gfPQeM5WA)
- [ ] Provide the `/feedback` Codex Session ID on the submission form. (user)
- [ ] Submit the final entry through Devpost before July 21, 2026 5:00 pm PT. (user)

## 2:55 Demo Timeline

- **0:00-0:10 — Cyber-defense cold open:** a hacker attacks the protected server;
  the Guardian raises a cyan shield over synchronized generated effects.
- **0:10-0:34 — Incident and concept:** explain the attempts against a personal
  server, the read-only defense, and the decision to turn filtered events into play.
- **0:34-0:54 — Live strategic map:** show the real public product and aggregate
  activity routes.
- **0:54-1:24 — Privacy boundary and NORAD:** explain backend aliasing,
  generalization, and defanging, then show the same safe stream in NORAD view.
- **1:24-1:38 — Build Week work:** distinguish the pre-existing viewer from the
  Codex/GPT-5.6 privacy, bilingual, deterministic-demo, QA, and documentation work.
- **1:38-2:39 — Real game scenes:** demonstrate repeatable skirmish, SRW-style
  battle, and first-person modes inside the same read-only application.
- **2:39-2:47 — Verified result:** state the documented metrics and six-mode QA.
- **2:47-2:55 — Close:** show the live demo and public repository URLs.
