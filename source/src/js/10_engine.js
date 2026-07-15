/* ═══════════════════════════════════════════════════════════════
   10_engine — 캔버스 스테이지·아틀라스·타임라인 DSL·씬 매니저
   내부 좌표계 480×360(4:3) 고정. 확대는 정수(데스크톱)/0.5스텝(협폭).
   ═══════════════════════════════════════════════════════════════ */
'use strict';
G.W = 480; G.H = 360;
G.RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── RNG (시드 랜덤 — 안무 재현성) ── */
G.rng = seed => { let a = seed >>> 0; return () => {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
G.pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

/* ── 스테이지 캔버스 ── */
G.initStage = () => {
  const cv = G.$('stage'), box = cv.parentElement;
  G.cv = cv; G.ctx = cv.getContext('2d');
  const fit = () => {
    const r = box.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    let cssScale = Math.floor(r.width / G.W * 4) / 4;      // 0.25 스텝(협폭/모바일 대응)
    if (r.width >= G.W * 2) cssScale = Math.floor(r.width / G.W); // 넉넉하면 정수
    cssScale = Math.max(0.5, Math.min(cssScale, 4));
    const rs = Math.max(1, Math.round(cssScale * dpr));    // 백버퍼 정수 배율
    cv.width = G.W * rs; cv.height = G.H * rs;
    cv.style.width = (G.W * cssScale) + 'px'; cv.style.height = (G.H * cssScale) + 'px';
    G.rs = rs;
    G.ctx.imageSmoothingEnabled = false;
  };
  new ResizeObserver(fit).observe(box); fit();
};

/* ── 아틀라스 ──
   build.py 가 주입: G.ATLAS_META = {sprites:{name:[tex,x,y,w,h,ax,ay]}, anims:{name:{f:[..],fps,loop,holds?}}}
   G.ATLAS_B64 = ['data:image/png;base64,...']  (없으면 스탠드인 모드) */
G.tex = []; G.standin = !1;
G.loadAtlas = async () => {
  if (!window.G_ATLAS_META || !window.G_ATLAS_B64 || !G_ATLAS_B64.length) { G.standin = !0; return; }
  G.META = G_ATLAS_META;
  G.tex = await Promise.all(G_ATLAS_B64.map(u => new Promise((ok, no) => {
    const im = new Image();
    im.onload = () => createImageBitmap(im).then(ok).catch(() => ok(im));
    im.onerror = no; im.src = u;
  })));
};
G.spr = n => G.META && G.META.sprites[n];
G.animDef = n => G.META && G.META.anims[n];

/* 스탠드인: 아틀라스 없이도 실루엣 박스로 동작(파이프라인 前 엔진 검증용) */
const STAND_C = {guard:'#7fb2ff', merc:'#9fd8a0', foe:'#ff9f7f', fx:'#ffe07f', prop:'#c0a0ff'};
G.drawSpr = (name, x, y, o) => {
  o = o || {};
  const sc = o.scale || 1, fl = o.flip ? -1 : 1, ctx = G.ctx;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(fl * sc, sc);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  const s = G.spr(name);
  if (s) {
    const [t, sx, sy, w, h, ax, ay] = s;
    ctx.drawImage(G.tex[t], sx, sy, w, h, -ax, -ay, w, h);
  } else { // 스탠드인 실루엣
    const kind = name.startsWith('hero') ? 'guard' : name.startsWith('fx') ? 'fx'
      : name.startsWith('p_') ? 'prop' : /huntress|wizardm|martial/.test(name) ? 'merc' : 'foe';
    const w = o.sw || 28, h = o.sh || 34;
    ctx.fillStyle = STAND_C[kind]; ctx.fillRect(-w / 2, -h, w, h);
    ctx.fillStyle = '#0008'; ctx.fillRect(-w / 2, -h, w, 3);
  }
  ctx.restore();
};

/* ── 애니메이션 플레이어 ── */
G.Anim = class {
  constructor(prefix) { this.prefix = prefix || ''; this.name = ''; this.t = 0; this.fi = 0; this.done = !1; }
  set(n, opt) { opt = opt || {};
    this.name = n; this.t = 0; this.fi = 0; this.done = !1;
    this.loop = opt.loop; this.onEnd = opt.onEnd || null;
    this.def = G.animDef(this.prefix + n) || null;
    this.fps = (this.def && this.def.fps) || opt.fps || 8;
    return this; }
  update(dt) {
    if (this.done) return;
    const frames = this.def ? this.def.f.length : 4;
    this.t += dt * this.fps;
    let fi = Math.floor(this.t);
    if (fi >= frames) {
      if (this.loop) { this.t %= frames; fi = Math.floor(this.t); }
      else { fi = frames - 1; if (!this.done) { this.done = !0; this.onEnd && this.onEnd(); } }
    }
    this.fi = fi; }
  draw(x, y, o) {
    o = o || {};
    const fr = this.def ? this.def.f[Math.min(this.fi, this.def.f.length - 1)] : null;
    G.drawSpr(fr || (this.prefix + this.name), x, y, o); }
};

/* ── 텍스트 (캔버스 픽셀폰트 — 공격자 문자열 안전 렌더) ── */
const SCENE_EN = {
  '수호자': 'GUARDIAN', '침입자': 'INTRUDER', '국지전': 'SKIRMISH',
  '침공 격퇴!': 'INVASION REPELLED!', '~ 지난 침입 재연 ~': '~ INCIDENT REPLAY ~',
  '기록 재연 · 전과 미집계': 'REPLAY · NO SCORE', '나머지는 도망쳤다!': 'THE REST FLED!',
  '회심! ': 'CRITICAL! ', '지원 사격!': 'COVER FIRE!', '수호자, 엄호한다!': 'GUARDIAN, COVERING!',
  '한 발 아끼지 마라!': 'FIRE AT WILL!', '패링!': 'PARRY!', '막음!': 'BLOCK!',
  '삼연참!': 'TRIPLE SLASH!', '업화!': 'INFERNO!', '빙결!': 'FREEZE!', '축성!': 'SMITE!',
  '상쇄!': 'NULLIFIED!', '방패가 밀렸다!': 'SHIELD BROKEN!',
  '필살…!': 'FINISHER...!', '이걸로 끝이다!': 'THIS ENDS NOW!', '늪의 이름으로!': 'FOR THE MARSH!',
  '차지… 해시레이트 최대!': 'CHARGE... HASHRATE MAX!', '부하들아, 나와라!': 'MINIONS, RISE!',
  '페이로드 투하 감지 — 서버 던전으로 돌입한다!': 'PAYLOAD DROP DETECTED — ENTERING SERVER DUNGEON!',
  '페이로드 투하 감지 — 방패를 들고 돌입한다!': 'PAYLOAD DROP DETECTED — SHIELD UP!',
  '페이로드 투하 감지 — 마력을 끌어올린다!': 'PAYLOAD DROP DETECTED — CHANNELING MAGIC!'
};
G.sceneText = value => {
  let s = String(value == null ? '' : value);
  if (G.lang !== 'en') return s;
  if (SCENE_EN[s]) return SCENE_EN[s];
  s = s.replace(/^박제 (\d+\/\d+)$/, 'CAPTURES $1')
    .replace(/^참격 (\d+)$/, 'SLASH $1').replace(/^마나 (\d+)$/, 'MANA $1')
    .replace(/^볼트 (\d+)$/, 'BOLTS $1').replace(/^침입자 /, 'INTRUDER ')
    .replace(/^활성 몬스터 (\d+) · /, 'ACTIVE HOSTILES $1 · ')
    .replace(/^침공 경로도$/, 'INTRUSION ROUTES');
  return s;
};
G.text = (str, x, y, o) => {
  o = o || {};
  str = G.sceneText(str);
  const ctx = G.ctx, size = o.size || 9;
  ctx.save();
  ctx.font = `${size}px GalmuriPx, 'Galmuri9', monospace`;
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'top';
  x = Math.round(x); y = Math.round(y);
  if (o.outline) { ctx.fillStyle = o.outline;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) ctx.fillText(str, x + dx, y + dy); }
  ctx.fillStyle = o.color || '#e8e4d8';
  ctx.fillText(str, x, y);
  ctx.restore();
};
G.textW = (str, size) => { const c = G.ctx; c.save(); str = G.sceneText(str);
  c.font = `${size || 9}px GalmuriPx, 'Galmuri9', monospace`;
  const w = c.measureText(str).width; c.restore(); return w; };

/* ── DQ풍 절차 윈도우 (아틀라스 불요 — 예산 0) ── */
G.win = (x, y, w, h, o) => {
  o = o || {}; const c = G.ctx;
  x = Math.round(x); y = Math.round(y);
  c.fillStyle = o.bg || 'rgba(8,10,24,.92)';
  c.fillRect(x, y, w, h);
  c.fillStyle = o.border || '#e8e4d8';
  c.fillRect(x + 1, y + 1, w - 2, 2); c.fillRect(x + 1, y + h - 3, w - 2, 2);
  c.fillRect(x + 1, y + 1, 2, h - 2); c.fillRect(x + w - 3, y + 1, 2, h - 2);
  c.fillStyle = o.bg || 'rgba(8,10,24,.92)';
  c.fillRect(x, y, 1, 1); c.fillRect(x + w - 1, y, 1, 1);
  c.fillRect(x, y + h - 1, 1, 1); c.fillRect(x + w - 1, y + h - 1, 1, 1);
};

/* ── 화면 효과: 셰이크/플래시(광과민 캡)/레터박스 ── */
G.fx = { shakeT: 0, shakeM: 0, flashes: [], lb: 0, lbTarget: 0, flashLog: [] };
G.shake = (mag, dur) => { if (G.RM) return; G.fx.shakeM = mag; G.fx.shakeT = dur; };
G.flash = (color, dur) => {
  if (G.RM) return;
  const now = performance.now();
  G.fx.flashLog = G.fx.flashLog.filter(t => now - t < 1000);
  if (G.fx.flashLog.length >= 3) return;       // 풀스크린 플래시 ≤3회/초
  G.fx.flashLog.push(now);
  G.fx.flashes.push({ c: color || '#fff', t: 0, d: dur || 0.12 });
};
G.letterbox = on => { G.fx.lbTarget = on ? 24 : 0; };

/* ── 파티클 ── */
G.parts = [];
G.emit = (n, fn) => { for (let i = 0; i < n; i++) { const p = fn(i); if (p) G.parts.push(p); } };
G.updateParts = dt => {
  const P = G.parts;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    p.t += dt; if (p.t >= p.life) { P.splice(i, 1); continue; }
    p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
    if (p.g) p.vy += p.g * dt;
  }
  if (P.length > 220) P.splice(0, P.length - 220);
};
G.drawParts = layer => {
  const c = G.ctx;
  for (const p of G.parts) {
    if ((p.layer || 0) !== layer) continue;
    const k = 1 - p.t / p.life;
    c.globalAlpha = p.fade ? k : 1;
    if (p.ch) G.text(p.ch, p.x, p.y, { size: p.size || 9, color: p.c });
    else { c.fillStyle = p.c; const s = p.s || 1; c.fillRect(Math.round(p.x), Math.round(p.y), s, s); }
    c.globalAlpha = 1;
  }
};

/* ── 타임라인 DSL (9 cmd 동결: slide anim fx sfx shake flash hitstop say popup)
   구조 보조: wait / call / par. 상대 duration 순차, hitstop=클럭 정지, 취소 토큰. ── */
G.hitstop = 0; // 실시간 ms — 전투 dt 만 정지
G.timeline = (steps, env) => {
  let cancelled = !1, resolve;
  const done = new Promise(r => resolve = r);
  (async () => {
    const run = async list => {
      for (const st of list) {
        if (cancelled) return;
        if (st.par) { await Promise.all(st.par.map(s => run([s]))); continue; }
        await step(st);
      }
    };
    const step = st => new Promise(next => {
      if (cancelled) return next();
      const fin = ms => { const t = setTimeout(() => next(), ms);
        env.timers.push(t); };
      switch (st.do) {
        case 'slide': { // {who,to:[x,y]|()=>[x,y],dur,ease} — to 는 슬라이드 시작 시점 평가
          const a = env.actors[st.who]; if (!a) return next();
          const to = typeof st.to === 'function' ? st.to() : st.to;
          const fx = a.x, fy = a.y, tx = to[0], ty = to[1], d = st.dur || 300;
          const t0 = env.clock();
          a.slide = () => { let k = Math.min(1, (env.clock() - t0) / d);
            if (st.ease !== 'lin') k = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
            a.x = fx + (tx - fx) * k; a.y = fy + (ty - fy) * k;
            if (k >= 1) { a.slide = null; } };
          fin(st.dur || 300); break; }
        case 'anim': { // {who,name,wait?,loop?}
          const a = env.actors[st.who]; if (!a) return next();
          if (st.wait) a.anim.set(st.name, { onEnd: () => next() });
          else { a.anim.set(st.name, { loop: !!st.loop }); next(); }
          break; }
        case 'fx': env.spawnFx && env.spawnFx(st); fin(st.dur || 1); break;
        case 'sfx': G.sfx && G.sfx(st.name, st); fin(st.dur || 1); break;
        case 'shake': G.shake(st.mag || 3, (st.dur || 250) / 1000); fin(st.dur || 250); break;
        case 'flash': G.flash(st.color, (st.dur || 120) / 1000); fin(st.dur || 120); break;
        case 'hitstop': if (!G.RM) G.hitstop = st.dur || 80; fin((st.dur || 80) + 10); break;
        case 'say': env.say && env.say(st); fin(st.dur || Math.max(700, String(st.text || '').length * 55)); break;
        case 'popup': env.popup && env.popup(st); fin(st.dur || 60); break;
        case 'wait': fin(st.dur || 200); break;
        case 'call': try { st.fn(env); } catch (e) { console.error(e); } next(); break;
        default: next();
      }
    });
    await run(steps);
    resolve(!cancelled);
  })();
  return { done, cancel: () => { cancelled = !0;
    (env.timers || []).forEach(clearTimeout); env.timers = []; resolve(!1); } };
};

/* ── 씬 매니저 ── */
G.sceneMap = {}; G.scene = null; G.sceneName = '';
G.regScene = (n, s) => G.sceneMap[n] = s;
G.setScene = n => {
  if (G.sceneName === n) return;
  if (G.scene && G.scene.exit) G.scene.exit();
  G.parts.length = 0;
  G.sceneName = n; G.scene = G.sceneMap[n];
  document.body.dataset.scene = n;
  if (G.scene && G.scene.enter) G.scene.enter();
  G.bus.emit('scene', n);
};

/* ── 메인 루프 ── */
let lastT = 0, hiddenPause = !1;
document.addEventListener('visibilitychange', () => {
  hiddenPause = document.hidden;
  if (hiddenPause) G.bus.emit('hidden');
  else lastT = performance.now();
});
G.startLoop = () => {
  const frame = t => {
    requestAnimationFrame(frame);
    if (hiddenPause || !G.ctx) return;
    let dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    if (G.hitstop > 0) { G.hitstop -= dt * 1000; dt = 0; }
    const c = G.ctx;
    c.setTransform(G.rs, 0, 0, G.rs, 0, 0);
    // 셰이크
    if (G.fx.shakeT > 0) { G.fx.shakeT -= dt || 0.016;
      const m = G.fx.shakeM * Math.max(0, G.fx.shakeT / 0.4);
      c.translate(Math.round((Math.random() * 2 - 1) * m), Math.round((Math.random() * 2 - 1) * m)); }
    if (G.scene) { G.scene.update && G.scene.update(dt); G.updateParts(dt); G.scene.draw && G.scene.draw(); }
    // 레터박스
    G.fx.lb += (G.fx.lbTarget - G.fx.lb) * Math.min(1, (dt || 0.016) * 8);
    if (G.fx.lb > 0.5) { c.fillStyle = '#000';
      c.fillRect(0, 0, G.W, Math.round(G.fx.lb)); c.fillRect(0, G.H - Math.round(G.fx.lb), G.W, Math.round(G.fx.lb)); }
    // 플래시
    for (let i = G.fx.flashes.length - 1; i >= 0; i--) {
      const f = G.fx.flashes[i]; f.t += dt || 0.016;
      if (f.t >= f.d) { G.fx.flashes.splice(i, 1); continue; }
      c.globalAlpha = 1 - f.t / f.d; c.fillStyle = f.c; c.fillRect(0, 0, G.W, G.H); c.globalAlpha = 1;
    }
  };
  lastT = performance.now();
  requestAnimationFrame(frame);
};
