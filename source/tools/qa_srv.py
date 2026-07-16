#!/usr/bin/env python3
"""QA 하네스 서버 :8125 — build/qa.html 서빙 + /api/threat 목 + POST /qa 리포트 수신.
사용: qa_srv.py <출력디렉터리>   (리포트는 qa-report-<mode>.json 으로 저장)"""
import http.server
import json
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

BUILD = Path(__file__).resolve().parent.parent / "build"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else BUILD

MOCK = {
    "ts": "2026-07-11T05:00:00", "target": "warboard", "defcon": 3, "defcon_label": "WARY",
    "events_1h": 42,
    "stats": {"total_events": 1234, "unique_ips": 66, "sessions": 50, "auth_attempts": 200,
              "blocked": 9, "payloads": 4, "ioc_urls": 3, "ioc_keys": 1},
    # 실 API 규약 = `ip` 키 (구 `src` 는 오기였음). 처형대 TOP3/재연 검증용 3건, count 상이.
    "blips": [
        {"lat": 52.1, "lon": 4.9, "cc": "NL", "ip": "198.51.100.99", "count": 55,
         "payload": False, "last_ts": "2026-07-11T04:59:00"},
        {"lat": 42.7, "lon": 23.3, "cc": "BG", "ip": "203.0.113.7", "count": 3263,
         "payload": True, "last_ts": "2026-07-11T04:58:30"},
        {"lat": 39.0, "lon": -77.5, "cc": "US", "ip": "192.0.2.10", "count": 830,
         "payload": False, "last_ts": "2026-07-11T04:57:00"},
    ],
    "feed": [
        {"ts": "2026-07-11T04:59:59", "src": "198.51.100.10", "cc": "NL", "event": "auth", "user": "root"},
        {"ts": "2026-07-11T04:59:58", "src": "203.0.113.7", "cc": "CN", "event": "payload", "user": "root"},
    ],
    "hist": [[str(h), 5] for h in range(24)],
    "top_countries": [["Netherlands", 42], ["China", 30]],
    "top_users": [["root", 99], ["admin", 55]],
    "top_passwords": [["123456", 77]],
    "payloads": [{"src": "203.0.113.7", "cmd": "echo test", "ts": "2026-07-11T04:58:00"}],
    "ioc_urls": ["http://198.51.100.7/sample.bin"],
}


class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, body, ct):
        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/threat"):
            self._send(json.dumps(MOCK).encode(), "application/json")
        else:
            self._send((BUILD / "qa.html").read_bytes(), "text/html; charset=utf-8")

    def do_POST(self):
        if not self.path.startswith("/qa"):
            self.send_response(404); self.end_headers(); return
        mode = (parse_qs(urlparse(self.path).query).get("mode") or ["x"])[0]
        n = int(self.headers.get("Content-Length", 0))
        data = self.rfile.read(n)
        out = OUT / f"qa-report-{mode}.json"
        out.write_bytes(data)
        print(f"[qa_srv] {mode} 리포트 수신 {n//1024} KB → {out}", flush=True)
        self._send(b"ok", "text/plain")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    http.server.ThreadingHTTPServer(("127.0.0.1", 8125), H).serve_forever()
