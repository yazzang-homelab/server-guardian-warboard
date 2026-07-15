# GPT-5.6 Usage Record

This record supports the OpenAI Build Week submission for Server Guardian
Warboard. It intentionally excludes API keys, account identifiers, private
network details, hostnames, and raw honeypot records.

## Model and Tooling

- Model family: GPT-5.6
- Public API alias: `gpt-5.6`
- Collaboration surface: Codex
- Work date: 2026-07-15
- Human role: product direction, privacy boundaries, visual decisions, and
  final acceptance
- Model role: code analysis, implementation, hardening, documentation, and
  verification assistance

The public OpenAI model catalog identifies `gpt-5.6` as the alias for GPT-5.6
Sol. This project does not publish request IDs, account metadata, usage totals,
or credentials as proof because those records can expose private account data.

## Recorded Contributions

1. Reviewed the existing viewer and identified the judge-facing product surface.
2. Added an English/Korean language switch with a locally remembered choice.
3. Replaced public source IPs and login names with stable, non-reversible aliases.
4. Generalized protected-host identity and location in the public API response.
5. Kept suspicious URLs and command-like strings defanged for display.
6. Added deterministic demo scenes so judges can evaluate the viewer without
   waiting for live events.
7. Added OpenAI Build Week submission notes and privacy-safe testing guidance.
8. Ran JavaScript and Python syntax checks and compared built/deployed artifact
   hashes during release verification.

## Representative Requests

The following are sanitized summaries, not verbatim private prompts:

- Prepare the existing public viewer for the OpenAI Build Week rules.
- Hide personal and server information as much as possible.
- Present the project clearly as a hackathon viewer built with GPT-5.6.
- Add an English/Korean switch to the UI.
- Preserve a public usage record without exposing secrets or infrastructure.

## Result

The resulting public experience is read-only, bilingual, deterministic for
judging, and privacy-preserving. No OpenAI API key is embedded in the frontend,
repository documentation, or public API output.

## Verification

- Frontend source includes both `en` and `ko` translation dictionaries.
- Public event sources use `bot-xxxxxxxx` aliases.
- Public login labels use `login-xxxxxx` aliases.
- Protected infrastructure is presented as `Protected Sandbox`.
- The generated frontend bundle passes `node --check`.
- The backend source passes Python AST parsing.
