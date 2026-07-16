#!/bin/bash
# QA 하네스 러너 — qa.html 생성 → 격리 run 디렉터리 → 모드별 headless 구동 → 리포트 회수
# 사용: qa_run.sh <출력디렉터리> [skirmish srw dq fps fpss fpsm]
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$DIR/build"
if (( $# > 0 )); then
  OUT="$1"
  shift
fi

MODES=(skirmish srw dq fps fpss fpsm)
if (( $# > 0 )); then
  if (( $# != ${#MODES[@]} )); then
    echo "qa_run: modes must be exactly: ${MODES[*]}"
    exit 2
  fi
  REQUESTED=("$@")
  for i in "${!MODES[@]}"; do
    if [[ "${REQUESTED[$i]}" != "${MODES[$i]}" ]]; then
      echo "qa_run: modes must be exactly: ${MODES[*]}"
      exit 2
    fi
  done
fi

if fuser -s 8125/tcp; then
  echo "qa_run: port 8125 is already in use; refusing to replace another QA producer"
  exit 1
fi
if [[ ! -f "$DIR/build/index.html" ]]; then
  echo "qa_run: candidate missing: $DIR/build/index.html"
  exit 1
fi

RUN_ID="qa-$(python3 -c 'import uuid; print(uuid.uuid4().hex)')"
CANDIDATE_SHA256="$(python3 - "$DIR/build/index.html" <<'PY'
import hashlib
import sys
from pathlib import Path

print(hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest())
PY
)"
QA_SEED="warboard-qa-seed-v1"
QA_EPOCH_MS="1763164800000"
RUN_DIR="$OUT/qa-runs/$RUN_ID"
mkdir -p "$OUT/qa-runs"
if ! mkdir "$RUN_DIR"; then
  echo "qa_run: isolated run directory already exists: $RUN_DIR"
  exit 1
fi

SRV=""
CH=""
PROFILE=""
cleanup() {
  status=$?
  trap - EXIT INT TERM
  if [[ -n "$CH" ]]; then
    kill "$CH" || true
    wait "$CH" || true
  fi
  if [[ -n "$PROFILE" ]]; then
    rm -rf "$PROFILE" || true
  fi
  if [[ -n "$SRV" ]]; then
    kill "$SRV" || true
    wait "$SRV" || true
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

QA_RUN_ID="$RUN_ID" QA_CANDIDATE_SHA256="$CANDIDATE_SHA256" \
  QA_SEED="$QA_SEED" QA_EPOCH_MS="$QA_EPOCH_MS" \
  python3 "$DIR/tools/qa_build.py"

QA_RUN_DIR="$RUN_DIR" QA_RUN_ID="$RUN_ID" QA_CANDIDATE_SHA256="$CANDIDATE_SHA256" \
  QA_SEED="$QA_SEED" QA_EPOCH_MS="$QA_EPOCH_MS" python3 - <<'PY'
import json
import os
import time
from pathlib import Path

manifest = {
    "schema": "warboard.qa.run",
    "version": 1,
    "run_id": os.environ["QA_RUN_ID"],
    "candidate_sha256": os.environ["QA_CANDIDATE_SHA256"],
    "modes": ["skirmish", "srw", "dq", "fps", "fpss", "fpsm"],
    "seed": os.environ["QA_SEED"],
    "fixed_epoch": int(os.environ["QA_EPOCH_MS"]),
    "fixture": {
        "viewport": {"width": 1400, "height": 900},
        "dpr": 1,
        "timezone": "UTC",
        "browser": "chromium-headless",
        "font": "GalmuriPx",
        "reduced_motion": "reduce",
    },
    "started_at_ns": time.time_ns(),
}
Path(os.environ["QA_RUN_DIR"], "qa-run.json").write_text(
    json.dumps(manifest, separators=(",", ":"), ensure_ascii=False)
)
PY

python3 "$DIR/tools/qa_srv.py" "$RUN_DIR" &
SRV=$!
sleep 0.5
if ! kill -0 "$SRV"; then
  echo "qa_run: report producer exited before browser launch"
  exit 1
fi

for m in "${MODES[@]}"; do
  REPORT="$RUN_DIR/qa-report-$m.json"
  PROFILE="$(mktemp -d "$RUN_DIR/chrome-$m-XXXXXX")"
  TZ=UTC chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --window-size=1400,900 --force-device-scale-factor=1 \
    --force-prefers-reduced-motion=reduce --force-time-zone-for-testing=UTC \
    --user-data-dir="$PROFILE" --remote-debugging-port=0 \
    "http://127.0.0.1:8125/?demo=$m" &
  CH=$!
  deadline=$((SECONDS + 180))
  while [[ ! -s "$REPORT" ]]; do
    if ! kill -0 "$SRV"; then
      echo "qa_run: report producer failed while collecting $m"
      exit 1
    fi
    if ! kill -0 "$CH"; then
      wait "$CH" || true
      CH=""
      echo "qa_run: browser producer exited before report for $m"
      exit 1
    fi
    if (( SECONDS >= deadline )); then
      echo "qa_run: timeout waiting for report for $m (180s)"
      exit 1
    fi
    sleep 1
  done
  kill "$CH" || true
  wait "$CH" || true
  CH=""
  rm -rf "$PROFILE" || true
  PROFILE=""
  echo "OK  $m"
done

kill "$SRV" || true
wait "$SRV" || true
SRV=""

# v2.2 자동 게이트 — 콘솔0·영웅비가시0·모닥불겹침0·스프라이트누락0·액션커버리지·fx재생
python3 "$DIR/tools/qa_check.py" "$RUN_DIR"
