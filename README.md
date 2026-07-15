# Server Guardian Warboard

Demo: https://plzhacknono.duckdns.org/

Submission guide: https://plzhacknono.duckdns.org/submission-guide.html?v=20260715-v2

Source repository: https://github.com/yazzang-homelab/server-guardian-warboard

Server Guardian Warboard is a read-only hackathon viewer for honeypot-style security events. It converts event counts, country aggregates, defanged payload hints, and IOC summaries into RPG/NORAD-style scenes without exposing private infrastructure details.

## OpenAI Build Week

- Track: Developer Tools
- Built/extended with: Codex and GPT-5.6
- Judge-facing URL: https://plzhacknono.duckdns.org/
- No account, payment, private hardware, or write access is required.

The original viewer existed before the submission period. For OpenAI Build Week, the project was meaningfully extended with new viewer modes, deterministic demo scenes, privacy-preserving public output, bilingual UI, and this judge-facing documentation.

## Prior Work vs. Build Week Work

This project is a pre-existing viewer that was meaningfully extended during the
OpenAI Build Week Submission Period (July 13-21, 2026, PT). Judges should
evaluate the Build Week work listed below.

| Period | Work | Evidence |
| --- | --- | --- |
| Before the Submission Period (July 10-13, 2026 KST) | Honeypot event dashboard core, RPG village/battle engine, sprite atlas pipeline, map and NORAD views, audio, FPS mode, visual effects | Pre-existing deployment; summarized in commit `dad3ced` |
| Submission Period (from July 14, 2026 KST) | Bilingual English/Korean UI with full English coverage of all judge-facing text (nameplates, dialogue, ticker, panels), backend privacy redaction boundary (`bot-xxxxxxxx` aliases, `login-xxxxxx`, `Protected Sandbox`, defanged strings), deterministic demo scenes documentation, submission guide page, licensing and notices, this public repository, and the demo video | Dated commit history of this repository (all commits 2026-07-15 or later); privacy-safe session record in `docs/GPT-5.6-USAGE.md` |

All Build Week work was performed with Codex and GPT-5.6.

## How to Test

1. Open https://plzhacknono.duckdns.org/.
2. Use the `한국어` / `English` button to switch languages.
3. Switch between RPG, map, and NORAD views.
4. Try deterministic demo scenes:
   - `https://plzhacknono.duckdns.org/?demo=skirmish`
   - `https://plzhacknono.duckdns.org/?demo=dq`
   - `https://plzhacknono.duckdns.org/?demo=srw`
   - `https://plzhacknono.duckdns.org/?demo=fps`
   - `https://plzhacknono.duckdns.org/?demo=fpss`
   - `https://plzhacknono.duckdns.org/?demo=fpsm`

### Run Locally

Supported platforms: any modern desktop browser (verified with Chromium; no
plugins required). The public build is a single self-contained HTML file with
no external dependencies, build step, or account requirement.

```sh
git clone https://github.com/yazzang-homelab/server-guardian-warboard
cd server-guardian-warboard/app
python3 -m http.server 8080
# open http://127.0.0.1:8080/index.html?demo=skirmish
```

Without a backend, live panels stay empty (the `/api/threat` poll fails
gracefully) but every deterministic `?demo=` scene, the language switch, and
all view modes work offline. The hosted demo above serves the same file backed
by the live redacted event API. `python3 source/tools/build.py` reassembles the
frontend from source; without the packed asset-atlas artifacts (not
redistributed — see `THIRD_PARTY_NOTICES.md`) it produces a stand-in
silhouette build, so `app/index.html` remains the judge-facing artifact.

## Privacy and Safety

- Public IP addresses are replaced with stable `bot-xxxxxxxx` aliases.
- Host identity and location are generalized as `Protected Sandbox`.
- Suspicious URLs and commands are displayed only in defanged form.
- The public viewer is read-only and has no write actions.
- Attacker-controlled strings are rendered as text or canvas text, not injected HTML.
- Operational deployment details are intentionally omitted from public documentation.

## What It Shows

- Event volume and recent activity.
- Country-level aggregate signals.
- Defanged payload and IOC summaries.
- RPG, map, NORAD, battle, and FPS-style visual interpretations.
- Repeatable demo scenes for judges when live event volume is low.

## Codex and GPT-5.6 Collaboration

Codex and GPT-5.6 were used to:

- convert the project into a more complete product experience for judging;
- add repeatable demo modes and deterministic build checks;
- harden the public display layer by redacting IPs and defanging risky strings;
- add bilingual English/Korean UI controls;
- prepare the Devpost-facing README and testing instructions.

Human decisions covered the product direction, privacy posture, visual style, safety boundaries, and final submission framing.

The privacy-safe development record is available in
[`docs/GPT-5.6-USAGE.md`](docs/GPT-5.6-USAGE.md). It documents the work
performed with Codex and GPT-5.6 without publishing prompts containing
credentials, private addresses, hostnames, or raw security-event data.

## Repository Layout

- `app/index.html`: self-contained public viewer build.
- `app/submission-guide.html`: bilingual submission checklist and demo script.
- `source/src`: browser source modules.
- `source/tools/build.py`: deterministic frontend builder.
- `docs/GPT-5.6-USAGE.md`: privacy-safe model collaboration record.
- `DEVPOST_SUBMISSION.md`: submission copy and final external-action checklist.

The production event adapter and deployment configuration are intentionally not
published because they contain operational assumptions. The included public
build is the judge-facing, read-only artifact.

## License

Original code is MIT licensed (see [`LICENSE`](LICENSE)). Embedded third-party
art, font, and sound assets remain under their original licenses, listed in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
