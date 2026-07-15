# Devpost Submission Draft

## Project Name

Server Guardian Warboard

## Tagline

A privacy-preserving, bilingual viewer that turns hostile automation signals
into an explainable RPG/NORAD security dashboard.

## Track

Developer Tools

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
- Public 3-minute YouTube demo: `[ADD YOUTUBE URL]`
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
- [ ] Record the demo video (production package under `video/`).
- [ ] Upload the video to YouTube (public) and insert its URL above. (user)
- [ ] Provide the `/feedback` Codex Session ID on the submission form. (user)
- [ ] Submit the final entry through Devpost before July 21, 2026 5:00 pm PT. (user)

## Three-Minute Demo Script

### 0:00-0:25 — Problem and Product

Open the public URL. Explain that raw security logs are difficult and unsafe to
share, and that Server Guardian Warboard is a read-only, privacy-preserving
viewer built for OpenAI Build Week.

### 0:25-0:55 — Main Dashboard

Show activity volume, country aggregates, payload hints, and the event feed.
Point out that source addresses and login names are aliases and the protected
host is generalized.

### 0:55-1:20 — Bilingual UI

Use the `한국어` button, show the Korean interface, then switch back to English
for judging.

### 1:20-2:05 — Visual Modes

Switch through RPG, map, and NORAD modes. Briefly explain that each view presents
the same privacy-filtered event stream for a different scanning workflow.

### 2:05-2:35 — Deterministic Demo

Open `?demo=skirmish`, then one FPS-style demo. Explain that deterministic scenes
let judges test the experience even when live event volume is low.

### 2:35-2:55 — GPT-5.6 Collaboration

Show the submission notes and usage record. State that Codex and GPT-5.6 helped
implement the bilingual UI, privacy boundary, demos, checks, and documentation,
while the human retained product and safety decisions.

### 2:55-3:00 — Close

Return to the main dashboard and state: “A safer way to understand hostile
automation without exposing the system it protects.”
