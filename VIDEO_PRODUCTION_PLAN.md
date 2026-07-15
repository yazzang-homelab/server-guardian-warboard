# YouTube Demo Video Production Plan

## Objective

Produce a public YouTube demo for the OpenAI Build Week submission that:

- is shorter than three minutes;
- contains clear English audio;
- demonstrates the working project;
- explains how Codex and GPT-5.6 contributed;
- exposes no credentials, private infrastructure, or raw security events; and
- uses only original or properly licensed visual and audio material.

Target duration: **2 minutes 55 seconds**.

## Production Approach

Use a cinematic seven-slide presentation to establish the incident, product
concept, privacy architecture, Build Week contribution, game composition, verified
result, and call to action. Intercut those slides with real 1080p browser captures
of the working map, NORAD, skirmish, SRW, and FPS views. The application remains
the primary visual evidence rather than serving as a repeated dashboard backdrop.

Use a ten-second Higgsfield cyber-defense cold open built from a privacy-safe
project frame. It must show a hacker attacking a protected server and the Guardian
raising a cyan defense, with synchronized original generated effects and no
dialogue or copyrighted melody. The seven-slide presentation begins only after
this curiosity-building opening. All remaining motion comes from the real
application or restrained editorial transitions.

### Why

- The origin story gives judges a concrete problem and audience.
- Architecture slides make the privacy boundary legible without exposing logs.
- Real browser capture proves that the public product is accessible and functional.
- Alternating presentation and product footage avoids a dashboard-only edit.
- A single generated establishing shot can add atmosphere without weakening proof.

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
- Intended use: one 10-second 16:9 cyber-defense opening with synchronized effects.
- Input policy: upload only public, redacted screenshots. Never upload logs,
  private addresses, hostnames, credentials, or account metadata.

Higgsfield is not required for the core video. If account access, credits, or
output quality are unsuitable, use a local title sequence instead.

## Production Tooling

1. `playwright-core` drives deterministic 1080p page-only captures.
2. `video/tools/capture-v2.mjs` captures seven Slidev frames and five live product takes.
3. `video/tools/assemble-narration.py` fits eight ElevenLabs sections to the storyboard.
4. `video/tools/make-score.py` creates the original deterministic underscore and effects.
5. `video/tools/make-subtitles.py` starts captions after the ten-second cold open.
6. `video/tools/render-v2.sh` assembles the generated opening, presentation, real product
   footage, narration, score, and captions into the validated H.264/AAC master.

The tooling uses the installed system Chromium rather than downloading another browser.

## Storyboard

| Time | Visual | Audio / Message |
| --- | --- | --- |
| 0:00-0:10 | Cyber-defense cold open | Hacker sends malicious-code pulses; Guardian raises the server shield; synchronized drone, glitches, shield impact, and security chime. |
| 0:10-0:22 | Origin slide | Repeated attempts against a personal server started the project. |
| 0:22-0:34 | Defense-to-game concept slide | Defense came first; filtered attacks then became explainable play. |
| 0:34-0:54 | Live strategic map | Show the working public product and aggregate event routes. |
| 0:54-1:08 | Privacy pipeline slide | Explain server-side aliasing, generalization, and defanging. |
| 1:08-1:24 | Live NORAD view | Show the same filtered stream as an operations-room display. |
| 1:24-1:38 | Build Week development slide | Distinguish prior work from Codex/GPT-5.6 additions and human decisions. |
| 1:38-1:56 | Live deterministic skirmish | Demonstrate a repeatable judge scene when traffic is quiet. |
| 1:56-2:05 | Game composition slide | Establish the supported scanning and play workflows. |
| 2:05-2:22 | Live SRW-style battle | Show a cinematic interpretation driven by filtered signals. |
| 2:22-2:39 | Live FPS scene | Show the same product from a first-person viewpoint. |
| 2:39-2:47 | Verified result slide | State current metrics and six-mode QA evidence. |
| 2:47-2:55 | Final URL card | Close with the live demo and public repository. |

## Narration And Sound

Use ElevenLabs English narration with a calm, credible documentary delivery.
Generate one short voice sample first and reject it if it sounds compressed,
robotic, clipped, or excessively dramatic. The final 330-370 word script must
cover the real incident, defense-to-game concept, privacy boundary, Build Week
work, product modes, verification, and call to action.

The ElevenLabs audio must remain clearly intelligible after encoding. Keep the
original synthesized underscore at least 15 dB below narration, with sparse
transition impacts rather than continuous attention-grabbing effects. Do not use
copyrighted music or stock audio without a recorded license.

## Capture Specification

- Resolution: 1920x1080.
- Aspect ratio: 16:9.
- Frame rate: 30 fps.
- Browser viewport: 1440x810 or 1920x1080, scaled without cropping UI.
- Output: H.264 video and AAC audio in an MP4 container.
- Pixel format: `yuv420p` for broad YouTube compatibility.
- Maximum final duration: below 3:00; 2:55 target.

## Automated Capture Sequence

1. Start the local Slidev deck and capture slides 1-7 at 1920x1080.
2. Open `https://plzhacknono.duckdns.org/` in a clean English browser context.
3. Disable CRT and audio, hide the cursor, and capture page content only.
4. Capture the live strategic map and NORAD operations view.
5. Open deterministic skirmish, SRW, and FPS demo URLs in separate clean contexts.
6. Stop each take separately so a failed scene can be replaced without repeating the
   complete recording.
7. Extract review frames and reject any take containing private identifiers, browser
   chrome, loading overlays, or unreadable composition.

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

## YouTube Thumbnail Redesign

Retire the first `HACKED → GAME` draft. Do not reuse its DejaVu headline,
stacked arrow treatment, cyan underline, heavy HUD frame, or mixed alignment.
The replacement must read as a designed product identity rather than a generic
gaming thumbnail.

### Approved Message

Use exactly one headline: **SERVER GUARDIAN**. Do not add a badge, subtitle,
arrow, or secondary slogan. The video title and description carry the explanatory
detail; the thumbnail establishes the product name and cyber-defense conflict.

### Recommended Composition

Use a clean 12-column grid on a 3840x2160 canvas with a 240-pixel safe margin.

- Hacker: left third, large dark silhouette, red attack energy moving inward.
- Protected server core: visual center, cyan shield and highest local contrast.
- Guardian: right third, readable defensive stance facing the hacker.
- Headline: one horizontal line in the upper safe area, optically centered to the
  full composition rather than mechanically centered to the canvas.
- Background: continuous project mountain battlefield with no hard tile edge,
  crop, HUD, panel border, or unrelated decoration.
- Lower-right: keep clear for the YouTube duration badge.

Typography and artwork must be built separately. Generate or edit the clean
background scene first, then typeset `SERVER GUARDIAN` locally with a licensed
condensed display face such as Bebas Neue or Anton. Use consistent cap height,
tracking, baseline, and stroke; never rely on AI-generated lettering. Set
`SERVER` in neutral off-white and `GUARDIAN` in the project's amber or cyan,
with a restrained dark shadow for mobile separation.

### Deliverables And Review Gates

1. Full-size 3840x2160 PNG master.
2. Upload-ready 1280x720 JPG under 2 MB.
3. 384x216 mobile proof viewed at actual size.
4. Grayscale proof confirming title and server-core hierarchy.
5. Alignment overlay showing grid, safe margins, and clear timestamp zone.

Reject the thumbnail if any subject is clipped, the title needs more than one
second to read, the server core is not the first or second visual focus, the
layout loses balance at mobile size, or the artwork implies functionality not
shown in the video. Use YouTube Test & Compare only after this primary design
passes review.

References:
- https://support.google.com/youtube/answer/72431
- https://support.google.com/youtube/answer/12340300
- https://support.google.com/youtube/answer/13861714
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
- A custom thumbnail is readable at 10% scale, truthful, and uses no private data.
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

1. Review the single optional Higgsfield opening before it enters the final cut.
2. Review and approve the final MP4.
3. Upload through YouTube Studio and set visibility to Public.
4. Complete YouTube audience, licensing, and synthetic-content disclosures.
5. Provide the final YouTube URL for insertion into Devpost and repository docs.
6. Enter the `/feedback` Codex Session ID and submit through Devpost.

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
