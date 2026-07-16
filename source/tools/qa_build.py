#!/usr/bin/env python3
"""QA 계측 빌드 — build/index.html에 가상클럭 셔임+자동 드라이버를 주입해 build/qa.html 생성.

배경: headless --virtual-time-budget은 setTimeout/Promise 타임라인을 정상 구동하지
못해 v2 QA가 전투 안무를 실검증하지 못했다(TODO-v2.1 ② 참조). 이 하네스는
performance.now/타이머/rAF를 페이지 안에서 가상클럭으로 목킹하고 프레임을
동기 스텝으로 강제 구동한다. 산출물은 배포되지 않는다(빌드 아티팩트 아님).
"""
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"

# ── 셔임: 게임 스크립트 이전에 삽입 (가상클럭 + hidden 무력화) ──
SHIM = r"""<script>
/* QA 가상클럭 셔임 — 게임 코드가 보는 시간축 전체를 스텝 구동으로 치환 */
(() => {
  const META = Object.freeze(/*__QA_META__*/);
  const real = {
    setTimeout: window.setTimeout.bind(window),
    now: performance.now.bind(performance),
    dateNow: Date.now.bind(Date),
    random: Math.random.bind(Math),
  };
  let VT = 0, tid = 1;
  let randomState = 2166136261;
  for (let i = 0; i < META.seed.length; i++) randomState = Math.imul(randomState ^ META.seed.charCodeAt(i), 16777619);
  const random = () => {
    randomState = (randomState + 0x6D2B79F5) | 0;
    let t = randomState;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  performance.now = () => VT;
  Date.now = () => META.fixed_epoch + Math.floor(VT);
  Math.random = random;
  const timers = [];            // {id,t,fn,iv?}
  const rafQ = [];
  window.setTimeout = (fn, ms, ...a) => { timers.push({ id: tid, t: VT + (+ms || 0), fn: () => fn(...a) }); return tid++; };
  window.setInterval = (fn, ms, ...a) => { timers.push({ id: tid, t: VT + (+ms || 100), iv: Math.max(1, +ms || 100), fn: () => fn(...a) }); return tid++; };
  window.clearTimeout = window.clearInterval = id => { const i = timers.findIndex(x => x.id === id); if (i >= 0) timers.splice(i, 1); };
  window.requestAnimationFrame = fn => { rafQ.push(fn); return rafQ.length; };
  window.cancelAnimationFrame = () => {};
  try { Object.defineProperty(document, 'hidden', { get: () => false }); } catch (e) {}
  // 콘솔 에러/경고 캡처 (qa_check 게이트 ①)
  const errs = [];
  for (const lv of ['error', 'warn']) {
    const o = console[lv].bind(console);
    console[lv] = (...a) => { try { errs.push({ lv, m: a.map(x => String(x && x.stack || x)).join(' ').slice(0, 400) }); } catch (e) {} o(...a); };
  }
  addEventListener('error', e => errs.push({ lv: 'uncaught', m: String(e.message || e).slice(0, 400) }));
  addEventListener('unhandledrejection', e => errs.push({ lv: 'unhandled', m: String(e.reason && e.reason.stack || e.reason).slice(0, 400) }));
  // 매크로태스크 홉(마이크로태스크 체인 배수) — setTimeout(0) 클램프 회피
  const mc = new MessageChannel(); let hopR = null;
  mc.port1.onmessage = () => { const r = hopR; hopR = null; r && r(); };
  const hop = () => new Promise(r => { hopR = r; mc.port2.postMessage(0); });
  window.QA = {
    meta: META, frame: 0, vt: () => VT, rec: [], draws: [], shots: [], events: [], errors: errs,
    async step(n, dtMs) {
      dtMs = dtMs || 1000 / 60;
      for (let i = 0; i < n; i++) {
        VT += dtMs; this.frame++;
        for (;;) {                                  // 만기 타이머 (등록순)
          const due = timers.filter(x => x.t <= VT).sort((a, b) => a.t - b.t || a.id - b.id)[0];
          if (!due) break;
          if (due.iv) due.t = VT + due.iv; else timers.splice(timers.indexOf(due), 1);
          try { due.fn(); } catch (e) { console.error(e); }
          await hop();
        }
        const q = rafQ.splice(0);
        for (const f of q) { try { f(VT); } catch (e) { console.error(e); } }
        await hop(); await hop();                   // promise 체인 배수
      }
    },
  };
})();
</script>"""

# ── 드라이버: 게임 스크립트 이후 삽입 (계측 + 시나리오 + 리포트 송신) ──
DRIVER = r"""<script>
(async () => {
  const Q = window.QA;
  const mode = (location.search.match(/demo=(\w+)/) || [])[1] || 'srw';
  // 부팅 완료 대기(아틀라스 로드는 실비동기) — 실클럭 폴링
  await new Promise(res => { const iv = () => (window.G && G.scene && (G.META || G.standin)) ? res() : setTimeout0(iv);
    const mc = new MessageChannel(); let cb = null; mc.port1.onmessage = () => cb && cb();
    function setTimeout0(f) { cb = f; mc.port2.postMessage(0); } iv(); });

  // drawSpr 계측: 캐릭터/fx/모닥불(p_fire — 겹침 게이트용), 화면 rect 산출
  const SKIP = /^(tt_|bg_)/;
  const orig = G.drawSpr;
  G.drawSpr = (n, x, y, o) => {
    if (!SKIP.test(n)) {
      o = o || {};
      const s = G.spr(n), sc = o.scale || 1, fl = o.flip ? 1 : 0;
      let r = null;
      if (s) { const [, , , w, h, ax, ay] = s;
        r = [Math.round(x - sc * (fl ? w - ax : ax)), Math.round(y - sc * ay), Math.round(w * sc), Math.round(h * sc)]; }
      Q.draws.push({ f: Q.frame, n, x: Math.round(x), y: Math.round(y), sc: +sc.toFixed(2),
        al: o.alpha == null ? 1 : +o.alpha.toFixed(2), ok: !!s, r });
    }
    return orig(n, x, y, o);
  };
  const seen0 = G.setScene; G.setScene = n => { Q.events.push({ f: Q.frame, ev: 'scene', v: n }); seen0(n); };

  const snapActor = a => a ? { x: Math.round(a.x), y: Math.round(a.y), an: a.anim.name, fi: a.anim.fi,
    def: !!a.anim.def, sl: !!a.slide, hu: +(a.hurtT || 0).toFixed(2), sc: a.scale || 1, dead: !!a.dead } : null;
  const tick = () => {
    const B = G.B || {};
    const fr = { f: Q.frame, sc: G.sceneName };
    if (G.sceneName === 'battle') {
      fr.mode = B.mode; fr.hp = [+(B.heroHP || 0).toFixed(2), +(B.foeHP || 0).toFixed(2)];
      fr.cut = B.cutin ? B.cutin.side : '';
      fr.say = B.say ? B.say.who : '';
      fr.res = B.result || '';
      fr.A = {}; for (const k in B.actors) fr.A[k] = snapActor(B.actors[k]);
      if (B.fxs) fr.nfx = B.fxs.length;
      if (B.wave && B.wave.replay) fr.rep = 1;                  // 재연 표식 (게이트 ⑧)
      if (B.mode === 'fps' && B.fps) fr.fps = {                 // fps 텔레메트리 (게이트 ⑩)
        c: B.fps.stats.cols, s: B.fps.stats.spr, ph: B.fps.phase, w: B.fps.wpn,
        x: +B.fps.cam.x.toFixed(2), y: +B.fps.cam.y.toFixed(2) };
    }
    if (G.sceneName === 'village') fr.t3 = (G.TOP3 || []).length;  // 처형대 랭킹 (게이트 ⑦)
    Q.rec.push(fr);
  };
  const shot = tag => { try { Q.shots.push({ f: Q.frame, tag, png: G.cv.toDataURL('image/png') }); } catch (e) {} };

  // ── 시나리오: 마을 3s → 데모 전투 ~45s → 마을 복귀 25s ──
  const SHOT_EVERY = 30;                       // 0.5s
  let battleSeen = false, battleEnd = 0;
  for (let i = 0; i < 60 * 75; i++) {
    await Q.step(1);
    tick();
    const inBattle = G.sceneName === 'battle';
    if (inBattle && !battleSeen) { battleSeen = true; shot('battle-start'); }
    if (inBattle && Q.frame % SHOT_EVERY === 0) shot('b');
    if (!inBattle && Q.frame % 120 === 0) shot('v');
    if (battleSeen && !inBattle && !battleEnd) battleEnd = Q.frame;
    if (battleEnd && Q.frame - battleEnd > 60 * 25) break;      // 마을 25s 관찰 후 종료
  }
  // ── 생활 액션 강제 스윕 (v2.2): 전 액션 커버리지 + 착석/베이크 검증 ──
  if (typeof nextAct === 'function' && typeof V !== 'undefined' && G.sceneName === 'village') {
    for (const id of ['rest', 'wood', 'lute', 'fell', 'mine', 'smelt', 'craft', 'fish', 'cook', 'herb', 'well', 'patrol']) {
      nextAct(id);
      V.guard.x = V.guard.tx; V.guard.y = V.guard.ty;   // 텔레포트(보행 생략 — 좌표는 clampFire 통과분)
      Q.events.push({ f: Q.frame, ev: 'act', v: id });
      for (let i = 0; i < 240; i++) { await Q.step(1); tick(); }
      shot('act-' + id);
    }
  }
  // ── 재연전투 강제 (dq 런에서만 — 게이트 ⑧: 전투 발생 + kills/waves 미집계) ──
  // 프로덕션 트리거(!G.DEMO+120s 유휴)는 QA 에서 못 밟으므로 synthReplay 를 직접 구동해 메커니즘을 검증.
  if (mode === 'dq' && typeof synthReplay === 'function' && G.sceneName === 'village' && G.ST) {
    const s0 = { w: G.SAVE.waves || 0, k: G.SAVE.kills || 0 };
    G.startBattle(synthReplay());
    for (let i = 0; i < 60 * 55; i++) { await Q.step(1); tick();
      if (Q.frame % SHOT_EVERY === 0 && G.sceneName === 'battle') shot('rep');
      if (G.sceneName === 'village' && i > 120) break; }
    Q.events.push({ f: Q.frame, ev: 'replay',
      v: { w0: s0.w, k0: s0.k, w1: G.SAVE.waves || 0, k1: G.SAVE.kills || 0 } });
    shot('replay-end');
  }
  // 리포트 송신
  const report = {
    schema: Q.meta.schema, version: Q.meta.version, run_id: Q.meta.run_id,
    candidate_sha256: Q.meta.candidate_sha256, mode, seed: Q.meta.seed,
    fixed_epoch: Q.meta.fixed_epoch, fixture: Q.meta.fixture,
    events: Q.events, frames: Q.rec, draws: Q.draws, shots: Q.shots, errors: Q.errors,
  };
  const canonical = JSON.stringify(report);
  if (!window.crypto || !window.crypto.subtle) throw new Error('QA report digest requires Web Crypto');
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  report.report_sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const body = JSON.stringify(report);
  await fetch('/qa?mode=' + mode, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  document.title = 'QA-DONE';
})();
</script>"""


def main() -> int:
    candidate = BUILD / "index.html"
    candidate_bytes = candidate.read_bytes()
    candidate_sha256 = hashlib.sha256(candidate_bytes).hexdigest()
    expected_sha256 = os.environ.get("QA_CANDIDATE_SHA256")
    if expected_sha256 and expected_sha256 != candidate_sha256:
        raise SystemExit(
            f"qa_build: QA_CANDIDATE_SHA256 does not match build/index.html "
            f"({expected_sha256} != {candidate_sha256})"
        )

    try:
        fixed_epoch = int(os.environ.get("QA_EPOCH_MS", "1763164800000"))
    except ValueError as exc:
        raise SystemExit("qa_build: QA_EPOCH_MS must be an integer epoch in milliseconds") from exc
    meta = {
        "schema": "warboard.qa.report",
        "version": 1,
        "run_id": os.environ.get("QA_RUN_ID", "qa-local"),
        "candidate_sha256": candidate_sha256,
        "seed": os.environ.get("QA_SEED", "warboard-qa-seed-v1"),
        "fixed_epoch": fixed_epoch,
        "fixture": {
            "viewport": {"width": 1400, "height": 900},
            "dpr": 1,
            "timezone": "UTC",
            "browser": "chromium-headless",
            "font": "GalmuriPx",
            "reduced_motion": "reduce",
        },
    }
    if not meta["run_id"]:
        raise SystemExit("qa_build: QA_RUN_ID must not be empty")
    if not meta["seed"]:
        raise SystemExit("qa_build: QA_SEED must not be empty")

    html = candidate_bytes.decode()
    anchor = '<body data-theme="rpg">'
    assert anchor in html, "body 앵커 미발견"
    shim = SHIM.replace("/*__QA_META__*/", json.dumps(meta, separators=(",", ":"), ensure_ascii=False))
    assert shim != SHIM, "QA metadata anchor missing"
    html = html.replace(anchor, anchor + "\n" + shim, 1)
    assert "</body>" in html
    html = html.replace("</body>", DRIVER + "\n</body>", 1)
    (BUILD / "qa.html").write_text(html)
    print(f"build/qa.html {len(html)//1024} KB (계측판 — 배포 금지)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
