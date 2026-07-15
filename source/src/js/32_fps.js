/* ═══════════════════════════════════════════════════════════════
   32_fps — 1인칭 돌입전(Doom풍 서버던전) — battle 씬의 B.mode='fps' 서브모드
   · 발동: 고위험 침입(payload 투하) 전용 — G.startBattle 디스패처가 게이팅
   · 관전형 절차 안무(시드 결정론) — 기존 타임라인 DSL 재사용(cam/적 = slide 액터)
   · 240레이(2px 열) DDA + 열 슬라이스 빌보드(zbuf) + 절차 벽 텍스처(gen_fps.py)
   · 공격자 문자열은 캔버스 G.text 만 — 30_battle 과 동일 규약
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const F = {
  on: !1, map: null, N: 16, way: [], nodes: [], door: null, cam: null,
  ents: [], lookAt: null, phase: '', t: 0, horizon: G.H / 2,
  zbuf: new Float32Array(240), stats: { cols: 0, spr: 0 },
  kills: 0, goal: 4, bolts: 24, face: 'ok', faceT: 0,
  handAnim: null, muzzleT: 0, alarm: !1, fade: 0,
};

/* 안개 8단계 + 천장/바닥 밴드 (사전 생성 — 프레임당 문자열 생성 0) */
const FOG = ['', 'rgba(7,10,22,.12)', 'rgba(7,10,22,.24)', 'rgba(7,10,22,.36)',
  'rgba(7,10,22,.48)', 'rgba(7,10,22,.60)', 'rgba(7,10,22,.71)', 'rgba(7,10,22,.80)'];
const CEIL = ['#080a14', '#090b17', '#0a0d1a', '#0b101e', '#0c1222', '#0d1425', '#0e1629', '#10182d', '#121a31'];
const FLOOR = ['#0b0d17', '#0c0f1b', '#0e111f', '#101423', '#121627', '#14182b', '#161b30', '#181d34', '#1a2038'];
const fogIdx = d => Math.min(7, Math.floor(d / 1.6));

/* ── 맵 생성 — 경로 먼저 깎기(루트 유효성 구성상 보장), 셀: 0=통로 1=벽돌 2=랙 3=케이블 8=문 ── */
function genMap(r) {
  const N = F.N, m = new Uint8Array(N * N).fill(1);
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  let x = 2, y = 8, dir = 0;
  m[y * N + x] = 0;
  const way = [[x, y]], nodes = [];
  for (let s = 0; s < 4; s++) {                          // 4세그먼트 고정(변주는 길이/턴)
    const len = 3 + Math.floor(r() * 3);
    for (let i = 0; i < len; i++) {
      const nx = x + DX[dir], ny = y + DY[dir];
      if (nx < 2 || nx > N - 3 || ny < 2 || ny > N - 3) break;
      x = nx; y = ny; m[y * N + x] = 0;
    }
    way.push([x, y]);
    if (s === 1 || s === 3) {                            // 교전 노드 = 3×3 알코브
      nodes.push([x, y]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
        m[(y + dy) * N + (x + dx)] = 0;
    }
    dir = (dir + (r() < 0.5 ? 1 : 3)) % 4;
  }
  let bd = 0;                                            // 보스방 방향 — 6셀 여유 있는 쪽
  for (const d of [dir, (dir + 1) % 4, (dir + 3) % 4, (dir + 2) % 4]) {
    const ex = x + DX[d] * 6, ey = y + DY[d] * 6;
    if (ex >= 2 && ex <= N - 3 && ey >= 2 && ey <= N - 3) { bd = d; break; }
  }
  const dx = DX[bd], dy = DY[bd];
  const door = [x + dx, y + dy], mid = [x + dx * 2, y + dy * 2], boss = [x + dx * 4, y + dy * 4];
  m[door[1] * N + door[0]] = 8;
  for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++)
    m[(boss[1] + yy) * N + (boss[0] + xx)] = 0;
  m[mid[1] * N + mid[0]] = 0;
  way.push(door, mid, boss);
  const h = (a, b) => ((a * 73856093) ^ (b * 19349663) ^ 0x5bd1) & 0x7fffffff;
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {  // 벽 텍스처 배정
    if (m[cy * N + cx] !== 1) continue;
    if (Math.abs(cx - boss[0]) <= 3 && Math.abs(cy - boss[1]) <= 3)
      m[cy * N + cx] = h(cx, cy) % 3 === 0 ? 3 : 1;      // 보스방 인접 = 케이블 섞기
    else if (h(cx, cy) % 4 === 0) m[cy * N + cx] = 2;    // 서버랙
    else if (h(cx, cy) % 7 === 0) m[cy * N + cx] = 3;
  }
  return { m, way, nodes, door, mid, boss };
}

/* ── 투영/조준 헬퍼 (draw·fx 타겟팅 공용) ── */
function fpsProject(e) {
  const dirX = Math.cos(F.cam.ang), dirY = Math.sin(F.cam.ang);
  const plX = -dirY * 0.66, plY = dirX * 0.66;
  const rx = e.x - F.cam.x, ry = e.y - F.cam.y;
  const invDet = 1 / (plX * dirY - dirX * plY);
  return { tX: invDet * (dirY * rx - dirX * ry), tY: invDet * (-plY * rx + plX * ry) };
}
function screenOf(e) {
  const { tX, tY } = fpsProject(e);
  const t = Math.max(0.15, tY);
  const px = (G.W / 2) * (1 + tX / t);
  const footY = F.horizon + (G.H / t) * 0.5;
  const hPx = (G.H / t) * e.size;
  return { x: px, y: footY - hPx * 0.5, footY, hPx, tY: t };
}
const bbFx = e => Math.max(1, Math.min(2.6, screenOf(e).hPx / 42));

/* ── 무기 3종 (v2.5) — 석궁/검·방패/마법. 종족 성향이 무기를 결정(보스·패턴·이펙트 공변) ── */
const WPN_MELEE = /^(king|golem|mimic|skeleton)$/;     // 근접계 침입자 → 검으로 응수
const WPN_CASTER = /^(sorcerer|wraith|flyeye|worm)$/;  // 마법계 침입자 → 마법 대결
const WPN_IDLE = { xbow: 'fps_hand_idle', sword: 'fps_sword_idle', magic: 'fps_magic_idle' };
function pickWeapon(r) {
  const pool = ['xbow'];
  if (G.animDef('fps_sword_slash')) pool.push('sword');   // 에셋 게이팅 — 구아틀라스는 석궁만
  if (G.animDef('fps_magic_cast')) pool.push('magic');
  if (G.demoWpn && pool.includes(G.demoWpn)) return G.demoWpn;
  if (WPN_CASTER.test(B.foe.sp) && pool.includes('magic')) return 'magic';
  if (WPN_MELEE.test(B.foe.sp) && pool.includes('sword')) return 'sword';
  return G.pick(r, pool);
}

/* ── 발사/피격 연출 ── */
function fpsShoot() {
  F.bolts = Math.max(0, F.bolts - 1);
  F.muzzleT = 0.08;
  if (G.animDef('fps_hand_fire'))
    F.handAnim.set('fps_hand_fire', { onEnd: () => { F.handAnim.set('none'); } });
  G.sfx('shot');
}
function fpsSlash() {
  F.strikes++;
  if (G.animDef('fps_sword_slash'))
    F.handAnim.set('fps_sword_slash', { onEnd: () => { F.handAnim.set('none'); } });
  G.sfx('swing');
  spawnFx({ fx: 'slash', x: G.W / 2 + 6, y: G.H / 2 + 28, scale: 2.2, flip: F.strikes % 2 === 0 });
}
function fpsCast(big) {
  F.mana = Math.max(0, F.mana - (big ? 6 : 3));
  F.muzzleT = 0.12;
  const a = big ? 'fps_magic_charge' : 'fps_magic_cast';
  if (G.animDef(a)) F.handAnim.set(a, big ? { loop: !0 } : { onEnd: () => { F.handAnim.set('none'); } });
  G.sfx('magic');
}
function fpsBlock() {                                    // 방패 블록 — 노피해 카운터 진입
  if (G.animDef('fps_sword_block'))
    F.handAnim.set('fps_sword_block', { onEnd: () => { F.handAnim.set('none'); } });
  G.sfx('parry'); G.flash('rgba(160,220,255,.4)', 0.1); G.shake(2, 0.15);
  popup(G.W / 2, G.H / 2 + 8, '막음!', '#7fd8ff');
}
function fpsHit(e, dmg, kill, fxKind) {
  const s = screenOf(e);
  e.hurtT = 0.22;
  spawnFx({ fx: fxKind || 'impact', x: s.x, y: s.y, scale: bbFx(e) });
  popup(s.x, s.y - s.hPx * 0.4, dmg, '#fff');
  dipFoe(dmg * 0.5);
  if (!kill) return;
  e.dead = !0; G.sfx('death');
  F.kills++; F.face = 'grin'; F.faceT = 1;
  e.anim.set('death', { onEnd: () => { e.alpha = 0.25;
    B.timers.push(setTimeout(() => { e.on = !1; }, 2000)); } });
}
function fpsHurt(dmg, label) {
  G.flash('rgba(255,60,40,.35)', 0.14); G.shake(4, 0.3); G.sfx('hurt_h');
  F.face = 'hurt'; F.faceT = 1.1; dipHero(dmg);
  popup(G.W / 2, G.H / 2 + 15, label || dmg, '#ff9f7f');
}

/* ── 무기별 단타 빌더 — env.actors 키(m1/m2/el/boss)와 엔티티를 함께 받음 ── */
function wKill(key, e, dmg, kill) {
  if (F.wpn === 'sword') return [
    { do: 'slide', who: key, to: () => [F.cam.x + Math.cos(F.cam.ang) * 0.85,   // 근접 돌진
      F.cam.y + Math.sin(F.cam.ang) * 0.85], dur: 300, ease: 'lin' },
    { do: 'call', fn: () => fpsSlash() }, { do: 'wait', dur: 120 },
    { par: [{ do: 'hitstop', dur: 80 }, { do: 'shake', mag: 3, dur: 180 },
      { do: 'call', fn: () => fpsHit(e, dmg, kill, 'slash') }] },
  ];
  if (F.wpn === 'magic') return [
    { do: 'call', fn: () => fpsCast() },
    { do: 'fx', fx: 'orb', x: () => screenOf(e).x, y: () => screenOf(e).y, scale: () => bbFx(e) },
    { do: 'wait', dur: 260 },
    { par: [{ do: 'hitstop', dur: 70 }, { do: 'shake', mag: 2.5, dur: 160 },
      { do: 'call', fn: () => fpsHit(e, dmg, kill, 'burst') }] },
  ];
  return [
    { do: 'call', fn: () => fpsShoot() }, { do: 'wait', dur: 90 },
    { par: [{ do: 'hitstop', dur: 70 }, { do: 'call', fn: () => fpsHit(e, dmg, kill) }] },
  ];
}

/* ── 안무 (총 ~23s) — DSL 재사용: cam/적 = slide 액터, 회전은 update 자동 조향 ── */
function buildFpsChoreo(r, E) {
  const w = F.way;
  const P = i => [w[i][0] + 0.5, w[i][1] + 0.5];
  const D = (i, j) => Math.max(240, Math.hypot(w[j][0] - w[i][0], w[j][1] - w[i][1]) * 640);
  const dirAt = i => { const dx = w[i + 1][0] - w[i][0], dy = w[i + 1][1] - w[i][1];
    const d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
  const named = B.foe.tier === 'named';
  const introFoe = named ? FOE_INTRO.named[B.foe.sp]
    : G.pick(r, FOE_INTRO[B.foe.tier] || FOE_INTRO.boss);
  const steps = [];
  // ── 인트로: 경보 + 침입자 배너 (컷인 배너는 B.actors.foe 초상 재사용)
  steps.push(
    { do: 'call', fn: () => { G.letterbox(!0); F.alarm = !0; F.phase = 'intro'; } },
    { do: 'call', fn: () => cutin('foe', '') },
    { do: 'say', who: 'foe', name: B.foe.name, text: introFoe },
    { do: 'call', fn: () => cutinOut() },
    { do: 'wait', dur: 150 },
    { do: 'call', fn: () => { B.cutin = null; G.letterbox(!1); } },
    { do: 'say', who: 'hero', name: '수호자', text: '페이로드 투하 감지 — ' +
      ({ sword: '방패를 들고 돌입한다!', magic: '마력을 끌어올린다!' }[F.wpn] || '서버 던전으로 돌입한다!') },
    { do: 'sfx', name: 'ann_fight' },
    { do: 'call', fn: () => { F.phase = 'walk1'; } });
  // ── 전진 1 → 교전 노드 1
  for (let i = 1; i <= 2; i++) steps.push({ do: 'slide', who: 'cam', to: P(i), dur: D(i - 1, i), ease: 'lin' });
  const [f1x, f1y] = dirAt(2), n1 = F.nodes[0];
  const m1p = [n1[0] + 0.5 + f1x * 1.2 - f1y * 0.7, n1[1] + 0.5 + f1y * 1.2 + f1x * 0.7];
  const m2p = [n1[0] + 0.5 + f1x * 1.4 + f1y * 0.8, n1[1] + 0.5 + f1y * 1.4 - f1x * 0.8];
  steps.push(
    { do: 'call', fn: () => { F.phase = 'fight1'; F.alarm = !1;
      E.m1.x = m1p[0]; E.m1.y = m1p[1]; E.m1.on = !0;
      E.m2.x = m2p[0]; E.m2.y = m2p[1]; E.m2.on = !0;
      F.lookAt = E.m1; G.sfx('growl'); } },
    { do: 'slide', who: 'm1', to: [m1p[0] - f1x * 0.4, m1p[1] - f1y * 0.4], dur: 480, ease: 'lin' },
    { do: 'wait', dur: 260 });
  // 교전 1 도입 — 무기별 (석궁=MISS 랜덤 / 검=몹 선공 블록 / 마법=발밑 마법진 조준)
  if (F.wpn === 'xbow' && r() < 0.45) steps.push(        // 랜덤 이벤트: 첫 발 빗나감 (볼트 낭비)
    { do: 'call', fn: () => { fpsShoot();
      B.timers.push(setTimeout(() => { const s = screenOf(E.m1);
        popup(s.x + 14, s.y, 'MISS', '#9fb2c8'); }, 90)); } },
    { do: 'wait', dur: 320 });
  if (F.wpn === 'sword') steps.push(
    { do: 'anim', who: 'm1', name: 'attack', wait: !0 },
    { do: 'call', fn: () => fpsBlock() },
    { do: 'wait', dur: 240 });
  if (F.wpn === 'magic') steps.push(
    { do: 'fx', fx: 'circle', x: () => screenOf(E.m1).x, y: () => screenOf(E.m1).footY - 3,
      scale: () => bbFx(E.m1), dur: 360 });
  steps.push(
    ...wKill('m1', E.m1, 12 + Math.floor(r() * 10), !0),
    { do: 'wait', dur: 330 },
    { do: 'call', fn: () => { F.lookAt = E.m2; } },
    { do: 'wait', dur: 240 },
    ...wKill('m2', E.m2, 12 + Math.floor(r() * 10), !0),
    { do: 'wait', dur: 380 },
    { do: 'call', fn: () => { F.lookAt = null; } });
  // ── 전진 2 → 문 (way[5]=문, way[6]=문 너머, way[7]=보스방 중심)
  steps.push({ do: 'call', fn: () => { F.phase = 'walk2'; } });
  for (let i = 3; i <= 4; i++) steps.push({ do: 'slide', who: 'cam', to: P(i), dur: D(i - 1, i), ease: 'lin' });
  steps.push(
    { do: 'call', fn: () => { F.phase = 'door'; F.lookAt = { x: w[5][0] + 0.5, y: w[5][1] + 0.5 }; } },
    { do: 'say', who: 'foe', name: B.foe.name, text: G.pick(r, ['이 문 너머는 내 구역이다', '잠갔다. 못 들어온다', '여기까지 오다니…']) },
    { do: 'sfx', name: 'door' },
    { do: 'call', fn: () => { F.door.target = 1; } },
    { do: 'wait', dur: 750 });
  // ── 문 통과 → 교전 2 (엘리트 — 피격 턴 포함)
  const [f2x, f2y] = [(w[7][0] - w[4][0]) && Math.sign(w[7][0] - w[4][0]), (w[7][1] - w[4][1]) && Math.sign(w[7][1] - w[4][1])];
  const elp = [w[6][0] + 0.5 + f2x * 1.4, w[6][1] + 0.5 + f2y * 1.4];
  const elAtk = (FOE_ATK[E.el.sp] || FOE_ATK.goblin);
  steps.push(
    { do: 'slide', who: 'cam', to: P(6), dur: D(4, 6), ease: 'lin' },
    { do: 'call', fn: () => { F.phase = 'fight2';
      E.el.x = elp[0]; E.el.y = elp[1]; E.el.on = !0; F.lookAt = E.el; G.sfx('growl'); } },
    { do: 'wait', dur: 350 },
    { do: 'anim', who: 'el', name: elAtk.anim, wait: !0 });
  // 엘리트 응수 — 무기별 (석궁=피격 감수 / 검=블록 후 선제타 / 마법=오브 상쇄)
  if (F.wpn === 'sword') steps.push(
    { do: 'call', fn: () => fpsBlock() },
    { do: 'anim', who: 'el', name: 'idle', loop: !0 },
    { do: 'wait', dur: 300 },
    { do: 'call', fn: () => fpsSlash() }, { do: 'wait', dur: 110 },
    { par: [{ do: 'hitstop', dur: 60 },
      { do: 'call', fn: () => fpsHit(E.el, 9 + Math.floor(r() * 6), !1, 'slash') }] },
    { do: 'wait', dur: 220 });
  else if (F.wpn === 'magic') steps.push(
    { par: [
      { do: 'fx', fx: 'orb', x: () => G.W / 2, y: () => G.H / 2 + 20, scale: 1.5 },
      { do: 'sfx', name: 'magic' }] },
    { do: 'anim', who: 'el', name: 'idle', loop: !0 },
    { do: 'wait', dur: 220 },
    { do: 'call', fn: () => { fpsCast(); popup(G.W / 2, G.H / 2 - 10, '상쇄!', '#9fe8ff'); } },
    { do: 'fx', fx: 'impact', x: () => G.W / 2, y: () => G.H / 2 + 10, scale: 1.6 },
    { do: 'wait', dur: 300 });
  else steps.push(
    { par: [
      { do: 'fx', fx: elAtk.fx, x: () => G.W / 2, y: () => G.H / 2 + 33, scale: 1.4 },
      { do: 'call', fn: () => fpsHurt(10 + Math.floor(r() * 8)) }] },
    { do: 'anim', who: 'el', name: 'idle', loop: !0 },
    { do: 'wait', dur: 420 });
  steps.push(
    ...wKill('el', E.el, 16 + Math.floor(r() * 10), !0),
    { do: 'wait', dur: 420 },
    { do: 'call', fn: () => { F.lookAt = null; } });
  // ── 보스방 — 2차 배너 + 피격 + 차지 피니셔(3연발)
  const bossP = [w[7][0] + 0.5 + f2x * 0.9, w[7][1] + 0.5 + f2y * 0.9];
  steps.push(
    { do: 'slide', who: 'cam', to: [w[7][0] + 0.5 - f2x * 1.4, w[7][1] + 0.5 - f2y * 1.4], dur: D(6, 7), ease: 'lin' },
    { do: 'call', fn: () => { F.phase = 'boss';
      E.boss.x = bossP[0]; E.boss.y = bossP[1]; E.boss.on = !0; F.lookAt = E.boss; } },
    { do: 'call', fn: () => cutin('foe', '') },
    { do: 'say', who: 'foe', name: B.foe.name,
      text: named ? FOE_INTRO.named[B.foe.sp] : G.pick(r, FOE_INTRO.boss) },
    { do: 'call', fn: () => cutinOut() },
    { do: 'wait', dur: 180 },
    { do: 'call', fn: () => { B.cutin = null; } });
  const bAtk = FOE_ATK[E.boss.sp] || FOE_ATK.goblin;
  const heroKiai = [
    { do: 'sfx', name: 'kiai' },
    { do: 'say', who: 'hero', name: '수호자', text: G.pick(r, ['필살…!', '이걸로 끝이다!', '늪의 이름으로!']) }];
  if (F.wpn === 'sword') {
    // 검 보스전: 돌진 강타(방패 밀림) → 재공격 블록 → 근접 3연참 (hitstop 점증)
    steps.push(
      { do: 'slide', who: 'boss', to: () => [F.cam.x + Math.cos(F.cam.ang) * 1.05,
        F.cam.y + Math.sin(F.cam.ang) * 1.05], dur: 460, ease: 'lin' },
      { do: 'anim', who: 'boss', name: bAtk.anim, wait: !0 },
      { par: [
        { do: 'sfx', name: 'boom' }, { do: 'shake', mag: 6, dur: 350 },
        { do: 'call', fn: () => fpsHurt(14 + Math.floor(r() * 8), '방패가 밀렸다!') }] },
      { do: 'wait', dur: 380 },
      { do: 'anim', who: 'boss', name: bAtk.anim, wait: !0 },
      { do: 'call', fn: () => fpsBlock() },
      { do: 'anim', who: 'boss', name: 'idle', loop: !0 },
      { do: 'wait', dur: 260 },
      ...heroKiai, { do: 'sfx', name: 'ann_combo' });
    for (let i = 0; i < 3; i++) steps.push(              // 근접 3연참
      { do: 'call', fn: () => fpsSlash() }, { do: 'wait', dur: 110 },
      { par: [
        { do: 'hitstop', dur: 80 + i * 40 },
        { do: 'shake', mag: 3 + i * 2, dur: 200 + i * 100 },
        ...(i === 2 ? [
          { do: 'fx', fx: G.animDef('fx_slashbig') ? 'slashbig' : 'impact',
            x: () => screenOf(E.boss).x, y: () => screenOf(E.boss).y, scale: () => bbFx(E.boss) * 1.2 },
          { do: 'flash', color: 'rgba(255,255,255,.6)', dur: 140 }] : []),
        { do: 'call', fn: () => fpsHit(E.boss, 18 + Math.floor(r() * 12), i === 2, 'slash') }] },
      { do: 'wait', dur: i === 2 ? 200 : 160 });
  } else if (F.wpn === 'magic') {
    // 마법 보스전: 오브 3연사(2발 상쇄·1발 피격) → 풀차지 → 대폭발
    for (let i = 0; i < 3; i++) steps.push(
      { do: 'anim', who: 'boss', name: bAtk.anim, wait: !0 },
      { par: [
        { do: 'fx', fx: 'orb', x: () => G.W / 2 + (i - 1) * 40, y: () => G.H / 2 + 18, scale: 1.5 },
        { do: 'sfx', name: 'magic' }] },
      { do: 'wait', dur: 200 },
      ...(i === 2
        ? [{ par: [{ do: 'shake', mag: 5, dur: 300 },
            { do: 'call', fn: () => fpsHurt(12 + Math.floor(r() * 8)) }] }]
        : [{ do: 'call', fn: () => { fpsCast(); popup(G.W / 2 + (i - 1) * 40, G.H / 2 - 8, '상쇄!', '#9fe8ff'); } },
           { do: 'fx', fx: 'impact', x: () => G.W / 2 + (i - 1) * 40, y: () => G.H / 2 + 12, scale: 1.5 },
           { do: 'wait', dur: 260 }]));
    steps.push(
      { do: 'anim', who: 'boss', name: 'idle', loop: !0 },
      { do: 'wait', dur: 300 },
      ...heroKiai,
      { do: 'call', fn: () => fpsCast(!0) },             // 풀차지 (charge 루프)
      { do: 'fx', fx: 'circle', x: () => screenOf(E.boss).x, y: () => screenOf(E.boss).footY - 4,
        scale: () => bbFx(E.boss) * 1.2, dur: 850 },
      { do: 'wait', dur: 100 },
      { par: [
        { do: 'call', fn: () => { F.handAnim.set('none'); G.sfx('boom'); } },
        { do: 'fx', fx: 'explosion', x: () => screenOf(E.boss).x, y: () => screenOf(E.boss).y,
          scale: () => bbFx(E.boss) * 1.3 },
        { do: 'flash', color: 'rgba(160,240,255,.55)', dur: 150 },
        { do: 'hitstop', dur: 150 }, { do: 'shake', mag: 7, dur: 450 },
        { do: 'call', fn: () => fpsHit(E.boss, 26 + Math.floor(r() * 12), !0, 'burst') }] },
      { do: 'wait', dur: 250 });
  } else {
    // 석궁 보스전 (기존): 원거리 피격 → 마법진 조준 → 3연발 속사
    steps.push(
      { do: 'anim', who: 'boss', name: bAtk.anim, wait: !0 },
      { par: [
        { do: 'sfx', name: B.foe.sp === 'sorcerer' ? 'zap' : 'boom' },
        { do: 'fx', fx: bAtk.fx, x: () => G.W / 2, y: () => G.H / 2 + 25, scale: 1.7 },
        { do: 'shake', mag: 6, dur: 350 },
        { do: 'call', fn: () => fpsHurt(14 + Math.floor(r() * 8)) }] },
      { do: 'anim', who: 'boss', name: 'idle', loop: !0 },
      { do: 'wait', dur: 500 },
      ...heroKiai,
      { do: 'fx', fx: 'circle', x: () => screenOf(E.boss).x, y: () => screenOf(E.boss).footY - 4,
        scale: () => bbFx(E.boss), dur: 620 });
    for (let i = 0; i < 3; i++) steps.push(              // 3연발 속사 — 장전 생략 연출
      { do: 'call', fn: () => fpsShoot() }, { do: 'wait', dur: 90 },
      { par: [
        { do: 'hitstop', dur: i === 2 ? 150 : 80 },
        { do: 'shake', mag: 3 + i * 2, dur: 200 + i * 100 },
        ...(i === 2 ? [
          { do: 'fx', fx: 'explosion', x: () => screenOf(E.boss).x, y: () => screenOf(E.boss).y,
            scale: () => bbFx(E.boss) * 1.2 },
          { do: 'flash', color: 'rgba(255,255,255,.6)', dur: 140 }] : []),
        { do: 'call', fn: () => fpsHit(E.boss, 20 + Math.floor(r() * 14), i === 2) }] },
      { do: 'wait', dur: i === 2 ? 200 : 150 });
  }
  steps.push(
    { do: 'sfx', name: 'ann_finish' },
    { do: 'wait', dur: 700 },
    { do: 'say', who: 'foe', name: B.foe.name, text: G.pick(r, FOE_LOSE) },
    { do: 'say', who: 'hero', name: '수호자', text: G.pick(r, HERO_WIN) },
    { do: 'call', fn: () => { F.phase = 'win'; victory(); } });
  return steps;
}

/* ── 씬 훅 (30_battle enter/update/exit 이 호출) ── */
G.FPS = {
  enter(seed) {
    const r = G.rng(seed);
    const g = genMap(r);
    F.map = g.m; F.way = g.way; F.nodes = g.nodes;
    F.door = { cx: g.door[0], cy: g.door[1], openT: 0, target: 0 };
    const [sx, sy] = g.way[0];
    F.cam = { x: sx + 0.5, y: sy + 0.5, px: sx + 0.5, py: sy + 0.5,
      ang: Math.atan2(g.way[1][1] - sy, g.way[1][0] - sx), walkT: 0, moving: 0, slide: null };
    F.ents = []; F.lookAt = null; F.kills = 0; F.bolts = 24; F.mana = 24; F.strikes = 0;
    F.wpn = pickWeapon(r);                               // 무기 3종 — 침입자 종족 성향이 결정 (v2.5)
    F.face = 'ok'; F.faceT = 0; F.muzzleT = 0; F.alarm = !1; F.fade = 1;
    F.phase = 'intro'; F.t = 0; F.horizon = G.H / 2; F.stats = { cols: 0, spr: 0 };
    F.handAnim = new G.Anim('');
    const others = ((B.wave && B.wave.foes) || []).filter(f => f !== B.foe).map(f => f.sp);
    const gen = () => G.GENERIC[Math.floor(r() * G.GENERIC.length)];
    const mkEnt = (sp, size) => {
      const e = { x: 0, y: 0, sp, size, anim: new G.Anim(sp + '_'),
        on: !1, dead: !1, hurtT: 0, alpha: 1, flip: !1, slide: null, scale: 1 };
      e.anim.set('idle', { loop: !0 }); F.ents.push(e); return e;
    };
    const E = { m1: mkEnt(others[0] || gen(), 0.5), m2: mkEnt(others[1] || gen(), 0.5),
      el: mkEnt(others[2] || gen(), 0.62), boss: mkEnt(B.foe.sp, 0.92) };
    F.goal = 4; F.on = !0; B.fps = F;
    B.tl = G.timeline(buildFpsChoreo(r, E), {
      actors: { cam: F.cam, m1: E.m1, m2: E.m2, el: E.el, boss: E.boss },
      timers: B.timers, clock: () => performance.now(),
      spawnFx: st => spawnFx(st), say: st => say(st),
      popup: st => popup(st.x, st.y, st.text, st.c),
    });
  },
  update(dt) {
    if (!F.on) return;
    F.t += dt;
    if (F.muzzleT > 0) F.muzzleT -= dt;
    if (F.faceT > 0) { F.faceT -= dt; if (F.faceT <= 0) F.face = 'ok'; }
    if (F.fade > 0) F.fade = Math.max(0, F.fade - dt * 2.5);
    if (F.door.target > F.door.openT) F.door.openT = Math.min(1, F.door.openT + dt / 0.6);
    F.handAnim.update(dt);
    if (F.cam.slide) F.cam.slide();
    for (const e of F.ents) { if (e.slide) e.slide(); e.anim.update(dt); if (e.hurtT > 0) e.hurtT -= dt; }
    // 자동 조향 — 이동 방향 우선, 정지 시 lookAt
    const mvx = F.cam.x - F.cam.px, mvy = F.cam.y - F.cam.py;
    const moving = Math.hypot(mvx, mvy) > 0.0004;
    F.cam.moving += ((moving ? 1 : 0) - F.cam.moving) * Math.min(1, dt * 8);
    if (moving) F.cam.walkT += dt;
    let target = null;
    if (moving) target = Math.atan2(mvy, mvx);
    else if (F.lookAt && !F.lookAt.dead) target = Math.atan2(F.lookAt.y - F.cam.y, F.lookAt.x - F.cam.x);
    if (target != null) {
      let d = target - F.cam.ang;
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const mx = 3.2 * dt;
      F.cam.ang += Math.abs(d) <= mx ? d : Math.sign(d) * mx;
    }
    F.cam.px = F.cam.x; F.cam.py = F.cam.y;
  },
  reset() { F.on = !1; F.ents = []; F.lookAt = null; B.fps = null; },
};

/* ── 렌더 ── */
function drawFPS() {
  const c = G.ctx;
  if (!F.on || !F.cam) { c.fillStyle = '#05060f'; c.fillRect(0, 0, G.W, G.H); return; }
  const camX = F.cam.x, camY = F.cam.y;
  const dirX = Math.cos(F.cam.ang), dirY = Math.sin(F.cam.ang);
  const plX = -dirY * 0.66, plY = dirX * 0.66;
  const bob = G.RM ? 0 : Math.round(Math.sin(F.cam.walkT * 9) * 2 * F.cam.moving);
  const hz = F.horizon = G.H / 2 + bob;
  // 천장/바닥 — 양자화 밴드 (지평선 근처가 어둡다 = 거리 안개)
  for (let i = 0; i < 9; i++) {
    c.fillStyle = CEIL[i]; c.fillRect(0, hz - (i + 1) * 16, G.W, 16);
    c.fillStyle = FLOOR[i]; c.fillRect(0, hz + i * 16, G.W, 16);
  }
  c.fillStyle = CEIL[8]; c.fillRect(0, 0, G.W, Math.max(0, hz - 144));
  c.fillStyle = FLOOR[8]; c.fillRect(0, hz + 144, G.W, Math.max(0, G.H - hz - 144));
  // 벽 — 240열 DDA
  const N = F.N, rackF = (F.t * 2 | 0) % 2, lit = F.muzzleT > 0 ? 1 : 0;
  let cols = 0;
  for (let col = 0; col < 240; col++) {
    const camU = 2 * col / 240 - 1;
    const rdx = dirX + plX * camU || 1e-9, rdy = dirY + plY * camU || 1e-9;
    let mapX = Math.floor(camX), mapY = Math.floor(camY);
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
    let stepX, stepY, sdx, sdy;
    if (rdx < 0) { stepX = -1; sdx = (camX - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - camX) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (camY - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - camY) * ddy; }
    let side = 0, cell = 1;
    for (let it = 0; it < 40; it++) {
      if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; } else { sdy += ddy; mapY += stepY; side = 1; }
      if (mapX < 0 || mapX >= N || mapY < 0 || mapY >= N) { cell = 1; break; }
      cell = F.map[mapY * N + mapX];
      if (cell === 8 && F.door.openT >= 0.95) continue;  // 열린 문 = 통과
      if (cell) break;
    }
    const perp = Math.max(0.08, side ? (mapY - camY + (1 - stepY) / 2) / rdy
      : (mapX - camX + (1 - stepX) / 2) / rdx);
    F.zbuf[col] = perp;
    const lineH = Math.min(1400, G.H / perp);
    const y0 = hz - lineH / 2;
    let wallX = side ? camX + perp * rdx : camY + perp * rdy;
    wallX -= Math.floor(wallX);
    let tx = Math.floor(wallX * 32);
    if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = 31 - tx;
    const s = G.spr(cell === 8 ? 'wt_door' : cell === 2 ? 'wt_rack_' + rackF
      : cell === 3 ? 'wt_cable' : 'wt_brick');
    if (s) {
      if (cell === 8 && F.door.openT > 0.01) {           // 리프트 도어 — 하단부터 개방
        const k = F.door.openT, dh = lineH * (1 - k);
        if (dh > 0.5) c.drawImage(G.tex[s[0]], s[1] + tx, s[2] + Math.floor(32 * k), 1,
          Math.max(1, Math.floor(32 * (1 - k))), col * 2, y0, 2, dh);
        c.fillStyle = '#04050c'; c.fillRect(col * 2, y0 + dh, 2, lineH - dh);
      } else c.drawImage(G.tex[s[0]], s[1] + tx, s[2], 1, 32, col * 2, y0, 2, lineH);
    } else { c.fillStyle = side ? '#31384e' : '#3a4468'; c.fillRect(col * 2, Math.round(y0), 2, Math.round(lineH)); }
    const shade = Math.max(0, Math.min(7, fogIdx(perp) + (side ? 1 : 0) - lit));
    if (shade) { c.fillStyle = FOG[shade]; c.fillRect(col * 2, Math.round(y0), 2, Math.ceil(lineH)); }
    cols++;
  }
  F.stats.cols = cols;
  // 빌보드 — 깊이 내림차순, 열 슬라이스 zbuf 클립
  let sprN = 0;
  const order = [];
  for (const e of F.ents) {
    if (!e.on) continue;
    const p = fpsProject(e);
    if (p.tY > 0.12) order.push({ e, tX: p.tX, tY: p.tY });
  }
  order.sort((a, b) => b.tY - a.tY);
  for (const o of order) {
    const e = o.e;
    const d = e.anim.def, fr = d ? d.f[Math.min(e.anim.fi, d.f.length - 1)] : null;
    const s = fr && G.spr(fr);
    const px = (G.W / 2) * (1 + o.tX / o.tY);
    const hPx = (G.H / o.tY) * e.size;
    const footY = hz + (G.H / o.tY) * 0.5;
    const blink = e.hurtT > 0 && Math.floor(e.hurtT * 30) % 2;
    const al = e.alpha * (blink ? 0.35 : 1);
    if (!s) {                                            // 스탠드인 폴백
      c.globalAlpha = al; c.fillStyle = '#ff9f7f';
      c.fillRect(Math.round(px - hPx * 0.2), Math.round(footY - hPx), Math.round(hPx * 0.4), Math.round(hPx));
      c.globalAlpha = 1; sprN++; continue;
    }
    const [t, sxx, syy, w, h, ax] = s;
    const sc = hPx / Math.max(1, h);
    const left = px - (e.flip ? w - ax : ax) * sc;
    const top = footY - h * sc;
    const c0 = Math.max(0, Math.floor(left / 2)), c1 = Math.min(239, Math.ceil((left + w * sc) / 2));
    if (c1 < c0) continue;
    c.globalAlpha = al;
    for (let col = c0; col <= c1; col++) {
      if (F.zbuf[col] <= o.tY) continue;
      let srcX = Math.floor((col * 2 + 1 - left) / sc);
      if (srcX < 0 || srcX >= w) continue;
      if (e.flip) srcX = w - 1 - srcX;
      c.drawImage(G.tex[t], sxx + srcX, syy, 1, h, col * 2, top, 2, h * sc);
    }
    c.globalAlpha = 1;
    sprN++;
  }
  F.stats.spr = sprN;
  // 스프라이트 fx(B.fxs, 스크린 좌표) + 파티클
  drawFxs();
  // 머즐/캐스트 글로우 (로컬 — 풀스크린 flash 아님, 광과민 안전. 마법=청록)
  const hx = G.W / 2 + 64, hy = G.H - 34 + bob;
  if (F.muzzleT > 0 && !G.RM) {
    const a = Math.max(0, F.muzzleT / (F.wpn === 'magic' ? 0.12 : 0.08));
    const mg = F.wpn === 'magic';
    c.fillStyle = mg ? `rgba(140,230,255,${(0.3 * a).toFixed(3)})` : `rgba(255,220,140,${(0.3 * a).toFixed(3)})`;
    c.beginPath(); c.arc(hx - 4, hy - 84, 26, 0, 7); c.fill();
    c.fillStyle = mg ? `rgba(224,250,255,${(0.5 * a).toFixed(3)})` : `rgba(255,244,210,${(0.5 * a).toFixed(3)})`;
    c.beginPath(); c.arc(hx - 4, hy - 84, 11, 0, 7); c.fill();
  }
  // 무기손 (하단 중앙 우측 — Doom 규격, ×2. 대기 프레임은 무기별)
  const hName = (!F.handAnim.done && F.handAnim.def)
    ? F.handAnim.def.f[Math.min(F.handAnim.fi, F.handAnim.def.f.length - 1)]
    : (WPN_IDLE[F.wpn] || 'fps_hand_idle');
  G.drawSpr(hName, hx, hy, { scale: 2, sw: 40, sh: 34 });
  // 크로스헤어 — 석궁=점 / 마법=서클 / 검=없음(근접)
  if (F.wpn === 'magic') {
    c.strokeStyle = 'rgba(160,235,255,.55)';
    c.beginPath(); c.arc(G.W / 2, hz, 3.5, 0, 7); c.stroke();
  } else if (F.wpn !== 'sword') {
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(G.W / 2 - 1, hz - 1, 2, 2);
  }
  // 경보 틴트 (인트로 — 저진폭 펄스, RM 시 정적)
  if (F.alarm) {
    const a = 0.1 + (G.RM ? 0 : 0.04 * Math.sin(F.t * 6));
    c.fillStyle = `rgba(255,50,40,${a.toFixed(3)})`; c.fillRect(0, 0, G.W, G.H);
  }
  drawFpsHUD();
  if (F.fade > 0) { c.globalAlpha = F.fade; c.fillStyle = '#000'; c.fillRect(0, 0, G.W, G.H); c.globalAlpha = 1; }
  drawBattleOverlay();
}

function drawFpsHUD() {
  const c = G.ctx, y0 = G.H - 36;
  c.fillStyle = 'rgba(8,10,24,.94)'; c.fillRect(0, y0, G.W, 36);
  c.fillStyle = '#e8e4d8'; c.fillRect(0, y0, G.W, 2);
  // 수호자 얼굴 (Doom 패러디) — ok/피격/처치 반응
  if (G.spr('fps_face_' + F.face)) G.drawSpr('fps_face_' + F.face, 22, G.H - 5, {});
  else G.text('◉', 14, y0 + 10, { size: 18, color: '#cfe0ff' });
  G.text('수호자', 42, y0 + 6, { size: 9, color: '#cfe0ff' });
  c.fillStyle = '#233'; c.fillRect(42, y0 + 19, 100, 7);
  c.fillStyle = B.heroHP > 0.4 ? '#5fd07f' : '#ffd23b';
  c.fillRect(42, y0 + 19, Math.round(100 * B.heroHP), 7);
  const ammo = F.wpn === 'sword' ? `참격 ${F.strikes}` : F.wpn === 'magic' ? `마나 ${F.mana}` : `볼트 ${F.bolts}`;
  G.text(ammo, 152, y0 + 19, { size: 9, color: F.wpn === 'magic' ? '#9fe8ff' : '#ffd6a0' });
  G.text(`박제 ${F.kills}/${F.goal}`, 152, y0 + 6, { size: 9, color: '#9fb2c8' });
  G.text(`침입자 ${G.trunc(G.sceneText(B.foe.name), 12)}`, G.W - 8, y0 + 6, { size: 9, color: '#ffd6c8', align: 'right' });
  G.text(`${G.flagCC(B.foe.cc)} ${G.actorAlias(B.foe.ip)}`, G.W - 8, y0 + 19, { size: 9, color: '#8fa3bd', align: 'right' });
}

DRAW.fps = drawFPS;
