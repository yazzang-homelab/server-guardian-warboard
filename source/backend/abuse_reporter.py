#!/usr/bin/env python3
"""Privacy-safe AbuseIPDB contribution pipeline used by Server Guardian Warboard.

This is the publishable implementation of the deployed reporter. It is disabled
by default and requires both WARBOARD_ABUSE_REPORT=1 and ABUSEIPDB_API_KEY.
Runtime paths are configurable so the repository contains no deployment details.

Public contract:
- only confirmed payload activity or repeated SSH authentication attempts;
- public IP addresses only;
- 24-hour per-IP deduplication and a daily submission cap;
- only attacker IP, AbuseIPDB category codes, and a generic comment are sent;
- incremental private state prevents duplicate reports after interruption;
- public state contains aggregate counts only, never source addresses;
- HTTP 429 stops the current run instead of hammering the API.
"""
from __future__ import annotations

import ipaddress
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Iterable

API_URL = "https://api.abuseipdb.com/api/v2/report"
INTERESTING = (
    "authorized_keys", "wget", "curl", "chattr", "rm -rf", "mkfs",
    "base64", "chmod +x", "/tmp/", "http://", "https://", "xmrig",
)
DEFAULT_COMMENT = (
    "SSH honeypot: automated intrusion attempts against a personal decoy "
    "server. Read-only capture."
)
EMPTY_CONTRIBUTION = {
    "reports": 0,
    "unique_ips": 0,
    "avg_confidence": 0.0,
    "last_ts": "",
}


@dataclass(frozen=True)
class Config:
    events_path: Path
    private_state_path: Path
    public_contribution_path: Path
    api_url: str = API_URL
    min_auth: int = 5
    dedup_hours: int = 24
    daily_cap: int = 200
    request_delay: float = 0.4
    comment: str = DEFAULT_COMMENT
    enabled: bool = False
    api_key: str = ""

    @classmethod
    def from_env(cls) -> "Config":
        runtime = Path(os.environ.get("WARBOARD_RUNTIME_DIR", "runtime"))
        return cls(
            events_path=Path(os.environ.get(
                "WARBOARD_EVENTS_FILE", str(runtime / "sessions.log"))),
            private_state_path=Path(os.environ.get(
                "WARBOARD_REPORT_STATE", str(runtime / "abuse_reporter_state.json"))),
            public_contribution_path=Path(os.environ.get(
                "WARBOARD_CONTRIB_STATE", str(runtime / "abuse_contrib.json"))),
            api_url=os.environ.get("ABUSEIPDB_REPORT_URL", API_URL),
            min_auth=int(os.environ.get("WARBOARD_REPORT_MIN_AUTH", "5")),
            dedup_hours=int(os.environ.get("WARBOARD_REPORT_DEDUP_HOURS", "24")),
            daily_cap=int(os.environ.get("WARBOARD_REPORT_DAILY_CAP", "200")),
            request_delay=float(os.environ.get("WARBOARD_REPORT_DELAY", "0.4")),
            comment=os.environ.get("WARBOARD_REPORT_COMMENT", DEFAULT_COMMENT),
            enabled=os.environ.get("WARBOARD_ABUSE_REPORT") == "1",
            api_key=os.environ.get("ABUSEIPDB_API_KEY", "").strip(),
        )


class RateLimited(Exception):
    """AbuseIPDB returned HTTP 429; the current run must stop."""


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError, TypeError):
        return default


def atomic_write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, separators=(",", ":")))
    temporary.replace(path)


def iter_events(path: Path) -> Iterable[dict]:
    if not path.exists():
        return
    for line in path.read_text(errors="replace").splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if isinstance(event, dict):
            yield event


def mask_ip(value: str) -> str:
    """Return a log-safe address; never print a complete source address."""
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return "****"
    if address.version == 6:
        return value.split(":", 1)[0] + ":****"
    return value.split(".", 1)[0] + ".x.x.x"


def is_public_ip(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return False
    return not (
        address.is_private or address.is_loopback or address.is_link_local
        or address.is_multicast or address.is_reserved or address.is_unspecified
    )


def classify(events: Iterable[dict], min_auth: int = 5) -> dict[str, dict]:
    """Select high-confidence candidates and map AbuseIPDB categories.

    Categories: 18 Brute-Force, 22 SSH, 15 Hacking, 20 Exploited Host.
    """
    aggregate: dict[str, dict] = defaultdict(
        lambda: {"categories": set(), "auth": 0, "payload": False, "last_ts": ""}
    )
    for event in events:
        source = str(event.get("src", ""))
        if not is_public_ip(source):
            continue
        record = aggregate[source]
        timestamp = str(event.get("ts", ""))
        if timestamp > record["last_ts"]:
            record["last_ts"] = timestamp
        event_type = event.get("event")
        if event_type == "auth":
            record["auth"] += 1
            record["categories"].update({18, 22})
        elif event_type == "session":
            commands = event.get("cmds", [])
            if isinstance(commands, list) and any(
                any(needle in str(command).lower() for needle in INTERESTING)
                for command in commands
            ):
                record["payload"] = True
                record["categories"].update({15, 20, 22})
    return {
        source: record for source, record in aggregate.items()
        if record["payload"] or record["auth"] >= min_auth
    }


def post_report(config: Config, source: str, categories: set[int]) -> int | None:
    if not config.api_url.startswith("https://"):
        raise ValueError("AbuseIPDB report URL must use HTTPS")
    body = urllib.parse.urlencode({
        "ip": source,
        "categories": ",".join(str(category) for category in sorted(categories)),
        "comment": config.comment,
    }).encode()
    request = urllib.request.Request(
        config.api_url,
        data=body,
        method="POST",
        headers={"Key": config.api_key, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode())
        return int(payload.get("data", {}).get("abuseConfidenceScore", 0))
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            raise RateLimited from None
        print(f"[report-fail] {mask_ip(source)}: HTTP {exc.code}", file=sys.stderr)
    except Exception as exc:  # network/JSON failures are isolated per candidate
        print(f"[report-fail] {mask_ip(source)}: {type(exc).__name__}", file=sys.stderr)
    return None


def _safe_int(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _safe_float(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def read_public_contribution(path: Path) -> dict:
    """Load and type-check the only reporting data safe for a public API."""
    raw = load_json(path, EMPTY_CONTRIBUTION)
    if not isinstance(raw, dict):
        raw = EMPTY_CONTRIBUTION
    reports = max(0, _safe_int(raw.get("reports", 0)))
    unique_ips = max(0, _safe_int(raw.get("unique_ips", 0)))
    confidence = max(0.0, min(100.0, _safe_float(raw.get("avg_confidence", 0))))
    return {
        "reports": reports,
        "unique_ips": unique_ips,
        "avg_confidence": confidence,
        "last_ts": str(raw.get("last_ts", "")),
    }


def attach_public_contribution(payload: dict, path: Path) -> dict:
    """Return an API payload containing aggregates, never private reporter state."""
    result = dict(payload)
    result["contrib"] = read_public_contribution(path)
    return result


def run_once(
    config: Config,
    *,
    now: datetime | None = None,
    post: Callable[[Config, str, set[int]], int | None] = post_report,
    sleep: Callable[[float], None] = time.sleep,
) -> dict:
    if not config.enabled:
        return {"status": "disabled", "filed": 0}
    if not config.api_key:
        return {"status": "missing-key", "filed": 0}

    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    today = current.strftime("%Y-%m-%d")
    cutoff = current - timedelta(hours=config.dedup_hours)
    state = load_json(config.private_state_path, {})
    if not isinstance(state, dict):
        state = {}
    daily = int(state.get("_count", 0) or 0) if state.get("_day") == today else 0
    contribution = read_public_contribution(config.public_contribution_path)
    base_reports = contribution["reports"]
    base_average = contribution["avg_confidence"]
    candidates = classify(iter_events(config.events_path), config.min_auth)
    filed = 0
    confidence_sum = 0
    status = "ok"

    def flush() -> None:
        state["_day"] = today
        state["_count"] = daily
        atomic_write_json(config.private_state_path, state)
        total = base_reports + filed
        if filed:
            contribution["avg_confidence"] = round(
                (base_average * base_reports + confidence_sum) / max(total, 1), 1
            )
        contribution["reports"] = total
        contribution["unique_ips"] = len([
            key for key in state if not key.startswith("_")
        ])
        contribution["last_ts"] = current.isoformat()
        atomic_write_json(config.public_contribution_path, contribution)

    flush()
    for source, record in sorted(
        candidates.items(), key=lambda item: item[1]["last_ts"], reverse=True
    ):
        if daily >= config.daily_cap:
            status = "daily-cap"
            break
        previous = state.get(source)
        if previous:
            try:
                if datetime.fromisoformat(previous) > cutoff:
                    continue
            except (TypeError, ValueError):
                pass
        try:
            score = post(config, source, record["categories"])
        except RateLimited:
            status = "rate-limited"
            break
        if score is None:
            continue
        state[source] = current.isoformat()
        confidence_sum += max(0, min(100, int(score)))
        filed += 1
        daily += 1
        flush()  # interruption-safe dedup state
        sleep(config.request_delay)

    flush()
    return {
        "status": status,
        "filed": filed,
        "contribution": dict(contribution),
    }


def main() -> int:
    result = run_once(Config.from_env())
    print(json.dumps(result, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
