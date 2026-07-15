# YouTube Demo Video Production Plan

## Objective

Produce a public YouTube demo for the OpenAI Build Week submission that:

- is shorter than three minutes;
- contains clear English audio;
- demonstrates the working project;
- explains how Codex and GPT-5.6 contributed;
- exposes no credentials, private infrastructure, or raw security events; and
- uses only original or properly licensed visual and audio material.

Target duration: **2 minutes 45 seconds**.

## Recommended Approach

Use real browser capture as the core of the video. Higgsfield is optional and
limited to a short, clearly stylized opening or transition. The project demo
must remain the main visual evidence.

### Why

- Judges need to see the working UI, not a generated interpretation of it.
- Browser capture proves the public demo is accessible and functional.
- A short generated opening can improve pacing without weakening credibility.
- Keeping generated footage separate from real UI footage makes disclosure and
  privacy review simpler.

## Available Local Environment

- Chromium 147 for browser automation and capture.
- FFmpeg 7.1 with H.264, AAC, subtitle, font, and audio filters.
- Approximately 17 GB available memory.
- Approximately 14 GB temporary storage.
- English and Korean system fonts.
- `espeak-ng` as an offline narration fallback.

## Optional Higgsfield Environment

- MCP endpoint: `https://mcp.higgsfield.ai/mcp`
- Authentication: Higgsfield account OAuth; do not store credentials in the
  repository or project `.env` files.
- Billing: generation consumes Higgsfield account credits.
- Intended use: one 5-8 second 16:9 stylized opening.
- Input policy: upload only public, redacted screenshots. Never upload logs,
  private addresses, hostnames, credentials, or account metadata.

Higgsfield is not required for the core video. If account access, credits, or
output quality are unsuitable, use a local title sequence instead.

## Tooling To Add

Install project-local automation only after approval:

1. `playwright-core` for deterministic Chromium control.
2. A capture script under `video/tools/capture.mjs`.
3. An FFmpeg assembly script under `video/tools/render.sh`.
4. English narration text and an SRT subtitle file under `video/script/`.

Do not install a bundled browser because a compatible system Chromium is
already present.

## Storyboard

| Time | Visual | Audio / Message |
| --- | --- | --- |
| 0:00-0:08 | Stylized title or optional Higgsfield opening | Server Guardian Warboard: a privacy-preserving security event viewer. |
| 0:08-0:30 | Open the public demo and main dashboard | Explain the problem, read-only design, and public judging surface. |
| 0:30-1:00 | Event metrics, bot aliases, IOC and payload summaries | Explain backend redaction and why raw security data never reaches the browser. |
| 1:00-1:22 | Toggle English/Korean during a battle | Show that dashboard and canvas battle UI react to the same language state. |
| 1:22-1:55 | RPG, map, and NORAD views | Explain that each mode presents the same filtered event stream differently. |
| 1:55-2:18 | `?demo=skirmish` and one FPS demo | Explain deterministic judging scenes when live activity is low. |
| 2:18-2:38 | GitHub README and GPT-5.6 usage record | Explain Codex/GPT-5.6 contributions and human decisions. |
| 2:38-2:45 | Demo and repository URLs | Close with the product value statement. |

## Narration

Preferred order:

1. Human English narration for credibility and natural pacing.
2. Higgsfield voiceover if its license and output are acceptable.
3. Local `espeak-ng` narration as an offline fallback.

The final mix must contain intelligible speech. Keep background audio at least
15 dB below narration. Avoid copyrighted music; silence with UI sound effects is
acceptable.

## Capture Specification

- Resolution: 1920x1080.
- Aspect ratio: 16:9.
- Frame rate: 30 fps.
- Browser viewport: 1440x810 or 1920x1080, scaled without cropping UI.
- Output: H.264 video and AAC audio in an MP4 container.
- Pixel format: `yuv420p` for broad YouTube compatibility.
- Maximum final duration: 2:55 hard gate; 2:45 target.

## Automated Capture Sequence

1. Open `https://plzhacknono.duckdns.org/` in a clean browser profile.
2. Wait for the boot overlay to disappear and the canvas to render.
3. Capture the dashboard without hovering over private browser UI.
4. Trigger the English/Korean button and verify visible canvas text changes.
5. Capture RPG, map, and NORAD modes.
6. Open deterministic demo URLs in separate clean takes.
7. Capture the public GitHub README and GPT-5.6 usage record.
8. Stop each take separately so failed scenes can be replaced without repeating
   the entire recording.

## Editing Sequence

1. Normalize all takes to 1080p/30 fps.
2. Remove loading pauses and accidental cursor movement.
3. Add restrained title and section labels.
4. Add narration and synchronize English subtitles.
5. Insert the optional Higgsfield opening only if it matches the real UI.
6. Add a final card with demo and repository URLs.
7. Export a review master and a final YouTube MP4.

## Privacy Review

Review every frame at full resolution. Reject the video if it reveals:

- API keys, cookies, browser profiles, email addresses, or account names;
- private IP addresses, hostnames, shell prompts, service names, or local paths;
- raw commands, SSH keys, unredacted source addresses, or raw logs;
- GitHub authentication screens or private repository controls; or
- notifications, bookmarks, browser history, or unrelated tabs.

Use a clean Chromium profile and capture only page content.

## Copyright And Disclosure Review

- Use no third-party trademarks except where needed to identify OpenAI Build
  Week, Codex, GPT-5.6, GitHub, Higgsfield, or YouTube factually.
- Use no copyrighted music.
- Preserve existing asset attribution in the repository and description.
- If a realistic generated scene is used, select the appropriate altered or
  synthetic content disclosure during YouTube upload.
- A stylized pixel-art opening should still be identified in the description as
  AI-assisted for transparency.

## Quality Gates

The final file must pass all of the following:

- Duration is below 3:00 and preferably no longer than 2:55.
- Audio is present and narration is understandable.
- The working demo occupies most of the runtime.
- Codex and GPT-5.6 collaboration is explicitly described.
- English subtitles match the narration.
- Demo and repository URLs are readable and correct.
- No private or operational information appears.
- No unlicensed music or footage is included.
- MP4 decodes without errors and uses H.264/AAC.
- The uploaded YouTube video is publicly visible while signed out.

## YouTube Metadata Draft

### Title

Server Guardian Warboard - OpenAI Build Week Demo

### Description

Server Guardian Warboard is a read-only, privacy-preserving viewer that turns
redacted honeypot-style security events into RPG, map, NORAD, and battle views.

Demo: https://plzhacknono.duckdns.org/

Source: https://github.com/yazzang-homelab/server-guardian-warboard

Built with Codex and GPT-5.6 for OpenAI Build Week. Codex and GPT-5.6 assisted
with implementation, privacy hardening, bilingual UI work, deterministic demo
scenes, testing, and submission documentation. Product, safety, privacy, and
design decisions were made by the human entrant.

This video may include a short AI-assisted stylized title sequence. The product
demonstration itself is captured from the live public application.

## External Actions Requiring The User

1. Choose human narration, Higgsfield voiceover, or local synthetic narration.
2. Authenticate a Higgsfield account only if the optional opening is approved.
3. Review and approve the final MP4.
4. Upload through YouTube Studio and set visibility to Public.
5. Complete YouTube audience, licensing, and synthetic-content disclosures.
6. Provide the final YouTube URL for insertion into Devpost and repository docs.

## Execution Order

1. Resolve repository licensing for original code and third-party assets.
2. Approve narration and optional Higgsfield use.
3. Add local capture tooling.
4. Record deterministic browser takes.
5. Produce narration and subtitles.
6. Assemble and review the 2:45 MP4.
7. Upload publicly to YouTube.
8. Add the YouTube URL to `DEVPOST_SUBMISSION.md` and the public submission guide.
9. Perform the final signed-out Devpost submission audit.
