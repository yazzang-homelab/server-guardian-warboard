# Project Story — Server Guardian Warboard

> Paste-ready "About the project" story for the Devpost submission form
> (Markdown + LaTeX). Judge-facing claims match the public repo, live demo,
> and the approved v6 video evidence.

## Inspiration

Running a personal server is part hobby, part daily chore. Every morning my
SSH honeypot logs were full of real attacks — useful signal, but painful to
read and dangerous to share, because raw logs leak IPs, hostnames, and
infrastructure details. I wanted two things at once:

1. Make my daily home-server defense **understandable and genuinely fun to
   watch**, like a game, without exposing the server.
2. Stop letting high-confidence attack captures die in a local log file, and
   instead **contribute them back** to the defenders' commons.

That second idea became the heart of the project: a personal defense that
files confirmed attackers to community threat intelligence — automatically,
safely, and verifiably.

## What it does

Server Guardian Warboard converts privacy-filtered honeypot events into
RPG, map, NORAD, battle, and FPS-inspired defense scenes, in English and
Korean, in a single self-contained HTML file that judges can open with no
account and no build step.

Behind the read-only viewer, a backend pipeline files confirmed attackers to
the AbuseIPDB community feed. An event is reported only when every gate in
this predicate holds:

$$
\text{file}(ip, e) \iff \text{confirmed}(e)\ \wedge\ \text{conf}(e) \ge \tau\ \wedge\ t_{\text{now}} - t_{\text{last}}(ip) \ge 24\,\text{h}\ \wedge\ n_{\text{window}} < R_{\max}
$$

— a confirmed-event gate, a confidence threshold, 24-hour per-IP
deduplication, and a rate limit. Only the attacker IP and standard category
codes are ever sent; never victim, host, or account details. At the approved
review render the live counter showed **200 reports · 200 unique IPs · 98%
average confidence** (labelled on screen as a dated review snapshot — the
live counter keeps growing).

## How we built it

The Build Week product was built with **Codex and GPT-5.6**. Human decisions
set the product direction, privacy boundaries, visual language, and final
acceptance; Codex/GPT-5.6 did the implementation, hardening, verification,
and documentation:

- **Privacy boundary at the API edge.** Redaction happens *before* data
  reaches the browser: source IPs become stable non-reversible aliases
  ($ip \mapsto \texttt{bot-}h(ip)_{[0:8]}$), logins become `login-xxxxxx`,
  the host is generalized to `Protected Sandbox`, and payloads are defanged.
- **The AbuseIPDB contribution pipeline** — backend-only, key sourced from
  the environment, never triggered by the public viewer — plus a
  deployment-neutral published reporter with seven network-free mocked tests.
- **Deterministic judging.** Six demo scenes (`?demo=skirmish|dq|srw|fps|fpss|fpsm`)
  replay identically so evaluation never depends on live traffic, and the
  build is reproducible: two independent builds must satisfy
  $H_{\text{sha256}}(B_1) = H_{\text{sha256}}(B_2)$ before anything ships.
- **Fail-closed QA.** Every release passes an exact six-mode gate (12/12
  actions, 9/9 bakes, 6/6 fx) bound to the candidate hash; the deployed file
  hash must match the repository artifact.

## Challenges

- **Story vs. anonymity.** Keeping enough event structure to tell a useful
  story while removing everything that could identify the protected system
  or individual sources. The answer was redaction at the response boundary,
  verified by inspecting what the browser can ever see.
- **Honest impact claims.** Live counters grow continuously, so the demo
  video pins a dated, labelled review snapshot instead of pretending a
  moving number is static. Bounded, measurable, reproducible — not inflated.
- **Judging a live-data product fairly.** Solved with deterministic demo
  scenes and reproducible builds, so a judge at 3am sees the same product I
  approved.
- **Reporting responsibly.** Automatic reporting can harm if it misfires;
  the gate equation above (confirmation, threshold, dedup, rate limit) makes
  over-reporting structurally impossible rather than merely discouraged.

## Accomplishments we're proud of

- A judge-ready public experience: no login, no payment, no rebuild required.
- A personal defense that measurably contributes shared signal — 200
  high-confidence filings for 200 unique addresses at 98% average confidence
  at the review snapshot.
- A privacy contract you can audit: aliases, defanging, aggregate-only
  public API, read-only viewer.
- An independently scored 85+ visual package with fail-closed QA evidence.

## What we learned

Privacy is easiest to *verify* when redaction happens before data reaches
the client — the browser cannot leak what it never receives. Deterministic
demo scenes make a live-data product dramatically easier to judge fairly.
And honest labelling (a dated review snapshot instead of a fake "live"
number) costs nothing and builds trust.

## What's next

Configurable event adapters for other honeypots and firewalls, per-category
and per-region contribution analytics, accessibility improvements, and
offline replay packages that preserve the same public redaction contract.
