/* ═══════════════════════════════════════════════════════════════
   20_village — 탑다운 마을 + 마비노기풍 생활 루프(불멍 레이어)
   지표 은유: 장작=events_1h · 낚시=auth 미끼 · 요리=봇 세션 · 채집=IOC · 연주=평화
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const V = {
  guard: null, act: null, actT: 0, bubble: null, bubbleT: 0,
  idleSince: 0, fireAnim: null, fireScale: 1, tick: 0,
};

/* POI 좌표 (480×360 논리 — v2.4 4:3 확장: y' = 84 + (구y-84)×1.484) */
const POI = {
  camp: [238, 208], pond: [82, 282], herb: [396, 155], hut: [352, 96],
  cook: [262, 182], patrolA: [120, 137], patrolB: [400, 270], well: [180, 122],
  fell: [402, 303], mine: [436, 220], forge: [300, 143], bench: [316, 176],
};

/* 모닥불 키프아웃 타원(발밑 기준) — 영웅이 불 안으로 못 들어오게 (v2.2)
   반발 타원은 QA 발밑 풋프린트 게이트(rw*0.45≈15.5, ±9)보다 넓게. */
const FIRE = { x: POI.camp[0], y: POI.camp[1] + 4, rx: 16, ry: 10 };
const clampFire = p => {                                 // 타원 내부 목표점 → 경계 밖 방사 투영
  const nx = (p[0] - FIRE.x) / FIRE.rx, ny = (p[1] - FIRE.y) / FIRE.ry;
  const d = Math.hypot(nx, ny);
  if (d >= 1 || d < 1e-4) return p;
  const k = 1.15 / d;
  return [FIRE.x + nx * k * FIRE.rx, FIRE.y + ny * k * FIRE.ry];
};

/* 처형대(효수대) — 마을 입구(세로 길 상단). 침입 횟수 상위 3 IP 효수 —
   머리는 국기(cc 이모지)로 순화, 피만 표현. 랭킹 = G.TOP3 (00_data poll 캐시). */
const GIBBET = { x: 217, y: 114, hooks: [-13, 0, 13] };
const rB = G.rng(0xb100d);                               // 핏방울 전용 시드 스트림

/* 생활 액션 (마비노기 감성) — anim 은 gen_sprites 베이크 모션(td_hero_*), 부재 시 idle 폴백.
   camp 계열은 seats(불 주변 착석 지점, 타원 밖)로 정지 위치를 결정론화. */
const ACTS = [
  { id: 'rest', poi: 'camp', dur: 9, seats: [[-19, 7], [19, 8], [-2, 16]],
    bub: ['불멍… 최고다', '오늘도 평화롭군', '장작이 잘 탄다', '오늘 포획 {blk}건… 뿌듯하다',
      '불꽃이 좋은 건 로그가 마르지 않아서지'],
    bubEn: ['Fire-gazing… the best', 'Peaceful day, as always', 'The firewood burns well', '{blk} captures today… satisfying',
      'Fires are great — the logs never run dry'], fx: 'ember' },
  { id: 'wood', poi: 'camp', dur: 6, anim: 'chop', seats: [[-21, 3], [21, 5]],
    bub: ['장작 투입! (시간당 침입 {e1h}건)', '더 태워라~', '침입 {e1h}건이면 장작 {e1h}단',
      '연료 걱정은 없다, 봇들이 계속 오니까'],
    bubEn: ['More firewood! ({e1h} intrusions/hour)', 'Burn it all~', '{e1h} intrusions, {e1h} bundles of wood',
      'No fuel worries — the bots keep coming'], fx: 'ember' },
  { id: 'lute', poi: 'camp', dur: 10, anim: 'lute', seats: [[-20, 9], [20, 9]],
    bub: ['♪ 늪가의 야영곡 ♪', '♬ 봇들의 진혼곡 ♬', '♪ 딕셔너리 어택 블루스 ♪',
      '♬ 오늘 밤도 root 는 없다네 ♬'],
    bubEn: ['♪ Campfire song of the marsh ♪', '♬ Requiem for the bots ♬', '♪ Dictionary Attack Blues ♪',
      '♬ No root again tonight ♬'], fx: 'note' },
  { id: 'fish', poi: 'pond', dur: 9, anim: 'fish',
    bub: ['미끼(root/1234) 투척…', '월척! 크리덴셜 {auth}개째', '입질이 좋다',
      '가짜 성문에 또 걸렸군', '오늘 입질 {auth}번 — 풍년이다'],
    bubEn: ['Casting the bait (root/1234)…', 'Big catch! Credential #{auth}', 'They are biting today',
      'Another one hooked on the fake gate', '{auth} bites today — a fine haul'], fx: 'splash' },
  { id: 'cook', poi: 'cook', dur: 8, anim: 'cook',
    bub: ['오늘 잡은 봇 {ses}마리 굽는 중', '노릇노릇…', '페이로드 {pay}개는 소스로 쓰자',
      '레시피: 늪 세션 {ses}마리, 약불에'],
    bubEn: ['Roasting today\'s {ses} captured bots', 'Nice and crispy…', 'These {pay} payloads will make good sauce',
      'Recipe: {ses} marsh sessions, low heat'], fx: 'steam' },
  { id: 'herb', poi: 'herb', dur: 7, anim: 'herb',
    bub: ['악성 URL 채집… {ioc}개 건조 중', '이건 hxxp 약초로군', '독초는 장갑 끼고 — 전부 무해화 표기',
      'IOC 약초 {ioc}뿌리 건조 완료'],
    bubEn: ['Gathering malicious URLs… drying {ioc}', 'Ah, an hxxp herb', 'Gloves on for the toxic ones — all defanged',
      '{ioc} IOC herbs dried and stored'], fx: 'leaf' },
  { id: 'well', poi: 'well', dur: 7, anim: 'well',
    bub: ['우물물 한 바가지… 서버도 시원~', '두레박이 묵직하다 (늪 세션 {ses}개)',
      '고유 IP {uip}개가 두레박에 찰랑', '늪물은 마르지 않는다'],
    bubEn: ['A scoop of well water… refreshing', 'The bucket feels heavy ({ses} marsh sessions)',
      '{uip} unique IPs sloshing in the bucket', 'The marsh never runs dry'], fx: 'drop' },
  { id: 'fell', poi: 'fell', dur: 7, anim: 'chop',
    bub: ['방벽 보수용 통나무 벌목 중', '나이테마다 침입 기록이 {e1h}겹', '쓰러진다~ (봇넷도 이렇게)',
      '좋은 목재는 늪가에서 자란다'],
    bubEn: ['Felling logs to mend the rampart', '{e1h} intrusion rings in this trunk', 'Timber~ (botnets fall the same way)',
      'Good lumber grows by the marsh'], fx: 'leaf' },
  { id: 'mine', poi: 'mine', dur: 7, anim: 'mine',
    bub: ['차단석 채광… 오늘 {blk}덩이', '곡괭이질 한 번에 IP 하나', '반짝이는 건 전부 IOC 원석',
      '이 광맥, 마르질 않네'],
    bubEn: ['Mining blockstone… {blk} chunks today', 'One IP per pickaxe swing', 'Everything shiny here is raw IOC ore',
      'This vein never runs out'], fx: null },
  { id: 'smelt', poi: 'forge', dur: 8, anim: 'smelt',
    bub: ['포획 IP {uip}개, 주괴로 제련 중', '불순물(오탐)은 걷어내고…', '풀무질… 화력은 침입 {e1h}건/시',
      '식기 전에 두들겨야 한다'],
    bubEn: ['Smelting {uip} captured IPs into ingots', 'Skimming off the false positives…', 'Pumping the bellows… {e1h} intrusions/hour of heat',
      'Strike while it\'s hot'], fx: 'forgefire' },
  { id: 'craft', poi: 'bench', dur: 8, anim: 'craft',
    bub: ['가짜 자물쇠 제작 — 성문용 미끼', '못질 세 번, 허니팟 한 채', '수리할 문은 없다, 어차피 다 가짜니까',
      '오늘의 작업: 미끼 열쇠 {auth}개'],
    bubEn: ['Crafting fake locks — bait for the gate', 'Three nails, one honeypot', 'Nothing to repair — the doors were never real',
      'Today\'s work: {auth} decoy keys'], fx: null },
  { id: 'patrol', poi: 'patrolB', roam: ['patrolA', 'patrolB', 'hut', 'well'], dur: 8,
    bub: ['순찰 중… 성문은 (가짜지만) 이상 무', '수상한 그림자는 전부 도감행',
      '성문 비번은 나도 몰라 (없으니까)', '수상한 발자국 {e1h}개, 전부 도감행'],
    bubEn: ['On patrol… the (fake) gate holds', 'Every shady shadow goes in the bestiary',
      'Even I don\'t know the gate password (there is none)', '{e1h} suspicious footprints, all catalogued'], fx: null },
];
/* 작업 타격감 프레임 이벤트: anim → [프레임, 파티클, 개수] · 사운드: anim → sfx 이름 */
const ACT_FEV = { chop: [2, 'chip', 4], fish: [1, 'splash', 2], well: [2, 'drop', 2],
  mine: [2, 'rock', 5], smelt: [1, 'slag', 2], craft: [2, 'spark', 3] };
const ACT_SND = { chop: 'chop', mine: 'mine', craft: 'hammer', well: 'drop',
  smelt: 'sizzle', fish: 'splash2' };                    // v2.3.2 — 제련 지글·낚시 첨벙
/* 주변음: 액션 fx 파티클 스폰 → sfx (v2.3.2 — 모닥불 탁탁/요리 지글/채집 바스락/화덕 풀무) */
const ACT_FX_SND = { note: 'note', ember: 'crackle', steam: 'sizzle', leaf: 'rustle', forgefire: 'furnace' };

/* 재연 웨이브 합성 — blips 상위 침입자 중 최근 재연 4개 제외, 시드 결정론(회차 seq 혼입).
   큐 미사용(즉석 startBattle) → 실 웨이브 항상 우선. kills/waves 미집계는 victory 가드 담당. */
const R = { seq: 0, recent: [] };
function synthReplay() {
  const all = [...G.ST.blips].filter(b => b && b.ip)
    .sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 20);
  let pool = all.filter(b => !R.recent.includes(b.ip));
  if (!pool.length) pool = all;
  const r = G.rng(G.hashIP(pool[0].ip) ^ (++R.seq) * 0x9e3779b9);
  const picks = [G.pick(r, pool)];
  if (pool.length > 1 && r() < 0.4) {
    const p2 = G.pick(r, pool.filter(b => b.ip !== picks[0].ip));
    if (p2) picks.push(p2);
  }
  for (const b of picks) { R.recent.push(b.ip); if (R.recent.length > 4) R.recent.shift(); }
  const foes = picks.map(b => G.makeFoe({ ip: b.ip, cc: b.cc, count: b.count || 1, payload: !!b.payload }));
  const rank = { named: 4, boss: 3, elite: 2, mob: 1 };
  foes.sort((a, b) => rank[b.tier] - rank[a.tier] || b.xp - a.xp);
  return { foes, top: foes[0], ts: Date.now(), replay: 1, seq: R.seq };
}

function fillVars(s) {
  const st = G.ST || { stats: {} }, t = st.stats || {};
  const m = { '{e1h}': st.events_1h, '{auth}': t.auth_attempts, '{ses}': t.sessions, '{ioc}': t.ioc_urls,
    '{uip}': t.unique_ips, '{blk}': t.blocked, '{pay}': t.payloads };
  for (const k in m) s = s.replaceAll(k, m[k] ?? '?');
  return s;
}

function nextAct(forceId) {                              // forceId = QA 하네스 강제 구동용
  const r = Math.random;
  const pool = ACTS.filter(a => a.id !== (V.act && V.act.id));
  V.act = (forceId && ACTS.find(a => a.id === forceId)) || pool[Math.floor(r() * pool.length)];
  V.actT = 0; V.lastFi = -1;
  const poiKey = V.act.roam ? V.act.roam[Math.floor(r() * V.act.roam.length)] : V.act.poi;
  const [tx, ty] = POI[poiKey];
  let t;
  if (V.act.seats) {                                     // 착석 지점 + 미세 지터만
    const s = V.act.seats[Math.floor(r() * V.act.seats.length)];
    t = [tx + s[0] + (r() * 4 - 2), ty + s[1] + (r() * 2 - 1)];
  } else t = [tx + (r() * 16 - 8), ty + (r() * 8 - 4)];
  t = clampFire(t);
  V.guard.tx = t[0]; V.guard.ty = t[1];
  V.bubble = null;
}

G.regScene('village', {
  enter() {
    if (!V.guard) {
      V.guard = { x: POI.camp[0], y: POI.camp[1], tx: POI.camp[0], ty: POI.camp[1],
        anim: new G.Anim('td_hero_'), flip: !1 };
      V.guard.anim.set('idle', { loop: !0 });
      V.fireAnim = new G.Anim(''); V.fireAnim.set('p_fire', { loop: !0 });
      nextAct();
    }
    V.idleSince = performance.now();
    // 데모: 가짜 웨이브 (세이브는 G.DEMO 로 보호됨)
    if (G.DEMO && !V.demoFired) { V.demoFired = !0;
      setTimeout(() => {
        const isFps = /^fps/.test(G.demoKind || '');
        const foe = G.makeFoe({ ip: '198.51.100.99', cc: 'US', count: 55, payload: isFps });
        const foes = [foe];
        if (G.demoKind === 'dq') { foe.tier = 'elite';   // DQ 데모 = 3마리 웨이브 (가로 펼침 검증)
          for (const [ip, cc] of [['203.0.113.7', 'CN'], ['198.51.100.23', 'RU']])
            foes.push(G.makeFoe({ ip, cc, count: 4, payload: !1 }));
        } else if (G.demoKind !== 'skirmish') { foe.tier = 'named';
          // fps 변형은 무기 성향 종족으로 보스 교체 (fps=석궁/fpss=검/fpsm=마법)
          foe.sp = { fpss: 'king', fpsm: 'sorcerer', fps: 'alphabat' }[G.demoKind] || 'king';
          foe.name = G.SPEC[foe.sp].ko; }
        G.startBattle({ foes, top: foe, ts: Date.now() }, isFps ? 'fps' : (G.demoKind || 'srw'));
      }, 2200); }
  },
  update(dt) {
    V.tick += dt;
    const g = V.guard;
    // 이동
    const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy);
    if (d > 2) { const sp = 34; g.x += dx / d * sp * dt; g.y += dy / d * sp * dt;
      g.flip = dx < 0;
      if (g.anim.name !== 'run') g.anim.set('run', { loop: !0 });
    } else {
      if (V.act.seats) g.flip = g.x > FIRE.x;         // 착석 시 모닥불을 바라봄
      const want = (V.act.anim && G.animDef('td_hero_' + V.act.anim)) ? V.act.anim : 'idle';
      if (g.anim.name !== want) { g.anim.set(want, { loop: !0 }); V.lastFi = -1; }
      V.actT += dt;
      const fe = ACT_FEV[want];                       // 작업 프레임 이벤트 (도끼 임팩트 등)
      if (fe && g.anim.fi === fe[0] && V.lastFi !== fe[0]) {
        for (let i = 0; i < fe[2]; i++) spawnActFx(fe[1], g.x, g.y);
        if (ACT_SND[want]) G.sfx(ACT_SND[want]);      // 작업음 (OFF 면 무음)
      }
      V.lastFi = g.anim.fi;
      if (V.actT > 1 && !V.bubble && V.act.bub && Math.random() < dt * 0.5) {
        const bset = (G.lang === 'en' && V.act.bubEn) || V.act.bub;
        V.bubble = fillVars(bset[Math.floor(Math.random() * bset.length)]);
        V.bubbleT = 3.4;
      }
      if (V.act.fx && Math.random() < dt * 3) {
        spawnActFx(V.act.fx, g.x, g.y);
        if (ACT_FX_SND[V.act.fx]) G.sfx(ACT_FX_SND[V.act.fx]);   // 주변음 (gap 스로틀이 빈도 제어)
      }
      if (V.actT > V.act.dur) nextAct();
    }
    // 모닥불 키프아웃 반발 — 이동 경로가 불을 관통하지 않도록 (시트/목표는 이미 타원 밖).
    // 반발 속도는 보행속도(34px/s)보다 커야 함 — 약하면 경계에서 밀치락 정체.
    {
      const fdx = (g.x - FIRE.x) / FIRE.rx, fdy = (g.y - FIRE.y) / FIRE.ry, fd = Math.hypot(fdx, fdy);
      if (fd < 1 && fd > 0.01) { g.x += fdx / fd * 60 * dt; g.y += fdy / fd * 40 * dt; }
    }
    if (V.bubbleT > 0) { V.bubbleT -= dt; if (V.bubbleT <= 0) V.bubble = null; }
    g.anim.update(dt); V.fireAnim.update(dt);
    // 모닥불 세기 = events_1h
    const e1 = (G.ST && G.ST.events_1h) || 0;
    V.fireScale = Math.min(1.5, 0.8 + e1 / 40);
    // 밤 반딧불
    const sky = G.skyAt(G.kstHour());
    if (sky.stars > 0.5 && Math.random() < dt * 2) G.emit(1, () => ({
      x: Math.random() * G.W, y: 120 + Math.random() * (G.H - 140), vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 10, life: 2.5, t: 0, c: '#cfe86a', s: 1, fade: 1, layer: 0 }));
    // 처형대 핏방울 — 효수 중인 랭커 아래로 낙하 (RM 제외, 시드 스트림)
    if (!G.RM && G.TOP3.length) for (let i = 0; i < Math.min(3, G.TOP3.length); i++)
      if (rB() < dt * 0.4) spawnActFx('blood', GIBBET.x + GIBBET.hooks[i], GIBBET.y - 4);
    // ── 큐 펌프 (불멍 보장: 최소 6s 간격 + 60s 롤링 전투 ≤40%) ──
    if (G.queue.length && performance.now() - V.idleSince > 6000 && G.combatSpent() < 0.4) {
      const wave = G.queue.shift();
      V.idleSince = performance.now();
      G.startBattle(wave);
    }
    // ── 유휴 재연전투: 실 침입이 없을 때 최근 기록(blips) 리플레이 — 실 웨이브가 구조적으로 우선 ──
    else if (!G.DEMO && G.ST && Array.isArray(G.ST.blips) && G.ST.blips.length
      && performance.now() - V.idleSince > 120000 && G.combatSpent() < 0.4) {
      V.idleSince = performance.now();
      G.startBattle(synthReplay());
    }
  },
  draw() {                                             // 모닥불↔영웅↔처형대 3-엔티티 Y-소트 (겹침 시각 정합)
    this.drawBase(1, !0);
    const ents = [{ y: FIRE.y, d: drawCampfire }, { y: V.guard.y, d: drawGuardian },
      { y: GIBBET.y, d: drawGibbet }];
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.d();
    drawVillageHUD();
  },
  exit() { V.idleSince = performance.now(); },

  /* 스커미시 밴드가 배경으로 재사용 (noFire 미지정 = 기존과 동일하게 불 포함) */
  drawBase(alpha, noFire) {
    const c = G.ctx, sky = G.skyAt(G.kstHour());
    c.save(); if (alpha < 1) c.globalAlpha = 1;
    // 하늘(상단 스트립) + 지면
    const gr = c.createLinearGradient(0, 0, 0, 84);
    gr.addColorStop(0, sky.top); gr.addColorStop(1, sky.mid);
    c.fillStyle = gr; c.fillRect(0, 0, G.W, 84);
    if (sky.stars > 0.05) { const r = G.rng(3); c.fillStyle = `rgba(230,238,255,${0.8 * sky.stars})`;
      for (let i = 0; i < 34; i++) c.fillRect(Math.floor(r() * G.W), Math.floor(r() * 70), 1, 1); }
    drawTiles(c, noFire);
    // 시간대 틴트
    const tint = sky.stars > 0.05 ? `rgba(10,14,40,${0.38 * sky.stars})` : 'rgba(255,220,150,0.05)';
    c.fillStyle = tint; c.fillRect(0, 0, G.W, G.H);
    if (alpha < 1) { c.fillStyle = `rgba(4,6,14,${1 - alpha})`; c.fillRect(0, 0, G.W, G.H); }
    c.restore();
  },
});

function drawTiles(c, noFire) {
  // 잔디 기반 (아틀라스 tt_grass 있으면 타일, 없으면 톤 사각)
  const gs = G.spr('tt_grass');
  if (gs) {
    const v2 = G.spr('tt_grass2'), v3 = G.spr('tt_grass3');
    for (let y = 84; y < G.H; y += 16) for (let x = 0; x < G.W; x += 16) {
      const n = (x * 7 + y * 13) % 29;
      const s = (n === 3 && v2) || (n === 17 && v3) || gs;
      c.drawImage(G.tex[s[0]], s[1], s[2], s[3], s[4], x, y, s[3], s[4]);
    }
  } else { c.fillStyle = '#20301c'; c.fillRect(0, 84, G.W, G.H - 84);
    const r = G.rng(11); c.fillStyle = '#283a22';
    for (let i = 0; i < 160; i++) c.fillRect(Math.floor(r() * G.W), 84 + Math.floor(r() * (G.H - 84)), 2, 1); }
  // 연못
  c.fillStyle = '#1b2c46'; c.beginPath(); c.ellipse(POI.pond[0] - 14, POI.pond[1] + 8, 46, 18, 0, 0, 7); c.fill();
  c.fillStyle = '#28405e'; c.beginPath(); c.ellipse(POI.pond[0] - 14, POI.pond[1] + 8, 40, 14, 0, 0, 7); c.fill();
  // 길
  c.fillStyle = '#4a3c28';
  c.fillRect(210, 84, 14, G.H - 84);
  c.fillRect(60, 197, 300, 12);
  // 처형대 아래 핏자국 (정적 얼룩 — 고정 시드, 캔버스 직화 = 팔레트 비용 0)
  { const rs = G.rng(0xb10d2); c.fillStyle = '#5a1010';
    for (let i = 0; i < 26; i++) c.fillRect(205 + Math.floor(rs() * 26), 110 + Math.floor(rs() * 8), 2, 1);
    c.fillStyle = '#3e0c0c';
    for (let i = 0; i < 14; i++) c.fillRect(208 + Math.floor(rs() * 20), 112 + Math.floor(rs() * 6), 1, 1); }
  // 오두막/우물/울타리/나무 (아틀라스 소품 우선)
  drawProp('tt_house', POI.hut[0], POI.hut[1], 40, 34, '#5a4632');
  drawProp('tt_well', POI.well[0], POI.well[1], 16, 18, '#6a7280');
  for (const [tx, ty] of [[40, 108], [70, 96], [430, 102], [452, 149], [418, 309], [60, 330]])
    drawProp('tt_tree', tx, ty, 18, 26, '#1e4020');
  // 모닥불 (마을 씬은 Y-소트를 위해 noFire 로 생략 후 별도 draw)
  if (!noFire) drawCampfire();
  // 채집지 표시
  c.fillStyle = '#2c5a2e'; for (let i = 0; i < 5; i++) c.fillRect(POI.herb[0] - 12 + i * 6, POI.herb[1] + 6, 2, 4);
  // 대장간 구역: 화덕(석재+개구부 글로우) + 작업대 (v2.2)
  const [ox, oy] = POI.forge;
  c.fillStyle = '#3c3f4a'; c.fillRect(ox - 8, oy - 12, 16, 12);
  c.fillStyle = '#2b2e38'; c.fillRect(ox - 8, oy - 14, 16, 3);
  c.fillStyle = '#23252e'; c.fillRect(ox - 4, oy - 8, 8, 7);
  const glow = 0.55 + 0.35 * Math.sin(performance.now() / 220);
  c.fillStyle = `rgba(255,140,50,${glow.toFixed(3)})`; c.fillRect(ox - 3, oy - 7, 6, 5);
  c.fillStyle = `rgba(255,214,89,${(glow * 0.9).toFixed(3)})`; c.fillRect(ox - 1, oy - 5, 2, 2);
  const [wx, wy] = POI.bench;
  c.fillStyle = '#5a4632'; c.fillRect(wx - 7, wy - 8, 14, 6);
  c.fillStyle = '#3e2f20'; c.fillRect(wx - 6, wy - 2, 2, 4); c.fillRect(wx + 4, wy - 2, 2, 4);
  c.fillStyle = '#8a8f9c'; c.fillRect(wx + 1, wy - 10, 4, 2);
  // 바위지대(채광) + IOC 원석 반짝이 (v2.2)
  const [mx, my] = POI.mine;
  c.fillStyle = '#4a4f5c'; c.fillRect(mx - 10, my - 6, 9, 7); c.fillRect(mx + 2, my - 9, 11, 10);
  c.fillStyle = '#6a7080'; c.fillRect(mx - 8, my - 5, 3, 2); c.fillRect(mx + 5, my - 7, 4, 3);
  c.fillStyle = '#31343e'; c.fillRect(mx + 2, my - 1, 11, 2); c.fillRect(mx - 10, my, 9, 1);
  c.fillStyle = '#9fd8ff'; c.fillRect(mx + 7, my - 5, 1, 1); c.fillRect(mx - 5, my - 3, 1, 1);
}

function drawCampfire() {
  const c = G.ctx;
  const [fx, fy] = POI.camp;
  c.fillStyle = '#3a3430'; c.fillRect(fx - 8, fy + 2, 16, 4);
  if (G.animDef('p_fire')) V.fireAnim.draw(fx, fy + 4, { scale: V.fireScale });
  else { const f = Math.sin(performance.now() / 90) * 2;
    c.fillStyle = '#ff9f3b'; c.fillRect(fx - 4, fy - 8 - f, 8, 10 + f);
    c.fillStyle = '#ffd23b'; c.fillRect(fx - 2, fy - 3 - f, 4, 5 + f); }
}
function drawProp(spr, x, y, w, h, col) {
  if (G.spr(spr)) { G.drawSpr(spr, x, y + h / 2, {}); return; }
  const c = G.ctx; c.fillStyle = col; c.fillRect(Math.round(x - w / 2), Math.round(y - h / 2), w, h);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(Math.round(x - w / 2), Math.round(y + h / 2 - 3), w, 3);
}

function drawGibbet() {
  const c = G.ctx, gx = GIBBET.x, gy = GIBBET.y, t = performance.now();
  drawProp('p_gibbet', gx, gy - 13, 52, 26, '#5a4632');  // drawProp 발밑 = y+h/2 → 실발밑 gy
  const top3 = G.TOP3 || [];
  for (let i = 0; i < 3; i++) {
    const hx = gx + GIBBET.hooks[i];
    const hy = gy - 13 + (G.RM ? 0 : Math.round(Math.sin(t / 500 + i * 1.3)));
    G.text(String(i + 1), hx, gy - 34, { size: 9, color: '#ffd23b', align: 'center', outline: '#000c' });
    if (top3[i]) {                                       // "머리" = 국기 순화 (백킹 사각 = 가독성)
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(hx - 6, hy - 1, 12, 11);
      G.text(G.flagCC(top3[i].cc), hx, hy, { size: 10, align: 'center' });
    }
  }
  if (top3.length) {                                     // 순환 명판 — 4s 주기 1→2→3위
    const i = Math.floor(t / 4000) % Math.min(3, top3.length), b = top3[i];
    const s = `${i + 1}위 ${G.flagCC(b.cc)} ${b.ip} · ${(b.count || 0).toLocaleString()}회`;
    const w = Math.min(240, G.textW(s, 9) + 12);
    const bx = Math.max(4, Math.min(G.W - w - 4, gx - w / 2));
    G.win(bx, gy - 52, w, 16, { bg: 'rgba(12,14,30,.88)' });
    G.text(s, bx + 6, gy - 48, { size: 9, color: '#ffb0a0' });
  }
}

function drawGuardian() {
  const g = V.guard, c = G.ctx;
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(g.x, g.y + 1, 7, 3, 0, 0, 7); c.fill();
  g.anim.draw(g.x, g.y, { flip: g.flip });
  // 액션 소품 — 베이크 모션(td_hero_*)이 있으면 소품이 프레임에 포함되므로 오버레이 생략
  const baked = V.act && V.act.anim && G.animDef('td_hero_' + V.act.anim);
  const propMap = { fish: 'p_rod', lute: 'p_lute', cook: 'p_pot', wood: 'p_log', herb: 'p_basket' };
  const pr = !baked && V.act && propMap[V.act.id];
  if (pr) {
    if (G.spr(pr)) G.drawSpr(pr, g.x + (g.flip ? -10 : 10), g.y - 6, { flip: g.flip });
    else { c.fillStyle = '#c9a86a'; c.fillRect(Math.round(g.x + (g.flip ? -13 : 9)), Math.round(g.y - 12), 4, 10); }
  }
  if (V.act && V.act.id === 'fish') { // 낚싯줄+찌
    c.strokeStyle = 'rgba(220,230,240,.5)'; c.beginPath();
    const bx = POI.pond[0] - 14, by = POI.pond[1] + 6 + Math.sin(performance.now() / 500);
    c.moveTo(g.x + (g.flip ? -14 : 14), g.y - 14); c.lineTo(bx, by); c.stroke();
    c.fillStyle = '#ff6a4a'; c.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3);
  }
  // 말풍선
  if (V.bubble) {
    const w = Math.min(230, G.textW(V.bubble, 9) + 14);
    const bx = Math.max(4, Math.min(G.W - w - 4, g.x - w / 2));
    G.win(bx, g.y - 46, w, 20, { bg: 'rgba(12,14,30,.94)' });
    G.text(V.bubble, bx + 7, g.y - 40, { size: 9, color: '#e6e0d0' });
  }
}

function spawnActFx(kind, x, y) {
  const defs = {
    ember: () => ({ x: POI.camp[0] + (Math.random() * 8 - 4), y: POI.camp[1] - 6, vx: (Math.random() - 0.5) * 8,
      vy: -22 - Math.random() * 18, life: 1.2, t: 0, c: ['#ffd23b', '#ff9f3b', '#ff6a3b'][Math.random() * 3 | 0], s: 1, fade: 1, layer: 1 }),
    note: () => ({ x: x + (Math.random() * 14 - 7), y: y - 18, vx: (Math.random() - 0.5) * 8, vy: -14,
      life: 1.6, t: 0, ch: ['♪', '♬', '♩'][Math.random() * 3 | 0], c: '#a8d8ff', fade: 1, layer: 1 }),
    splash: () => (Math.random() < 0.3 ? { x: POI.pond[0] - 14, y: POI.pond[1] + 6, vx: (Math.random() - 0.5) * 20,
      vy: -26, g: 90, life: 0.7, t: 0, c: '#6a9fd8', s: 1, fade: 1, layer: 1 } : null),
    steam: () => ({ x: x + 8, y: y - 14, vx: (Math.random() - 0.5) * 5, vy: -12, life: 1.3, t: 0,
      c: 'rgba(220,220,230,.7)', s: 2, fade: 1, layer: 1 }),
    leaf: () => ({ x: x + (Math.random() * 16 - 8), y: y - 8, vx: (Math.random() - 0.5) * 14, vy: -8, g: 20,
      life: 1.1, t: 0, c: '#7fbf6a', s: 1, fade: 1, layer: 1 }),
    chip: () => ({ x: x + (6 + Math.random() * 6) * (V.guard.flip ? -1 : 1), y: y - 8,
      vx: (Math.random() - 0.5) * 44, vy: -28 - Math.random() * 22, g: 150, life: 0.6, t: 0,
      c: ['#c9a86a', '#94663a'][Math.random() * 2 | 0], s: 1, fade: 1, layer: 1 }),
    drop: () => ({ x: x + (Math.random() * 8 - 4) * (V.guard.flip ? -1 : 1) + (V.guard.flip ? -7 : 7), y: y - 10,
      vx: (Math.random() - 0.5) * 12, vy: 20, g: 70, life: 0.5, t: 0, c: '#6a9fd8', s: 1, fade: 1, layer: 1 }),
    rock: () => ({ x: x + (8 + Math.random() * 6) * (V.guard.flip ? -1 : 1), y: y - 6,
      vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 20, g: 160, life: 0.55, t: 0,
      c: ['#8a8f9c', '#6a7080', '#9fd8ff'][Math.random() * 3 | 0], s: 1, fade: 1, layer: 1 }),
    spark: () => ({ x: x + (7 + Math.random() * 5) * (V.guard.flip ? -1 : 1), y: y - 8,
      vx: (Math.random() - 0.5) * 60, vy: -26 - Math.random() * 26, g: 120, life: 0.35, t: 0,
      c: ['#ffd23b', '#ff9f3b', '#fff1a8'][Math.random() * 3 | 0], s: 1, fade: 1, layer: 1 }),
    slag: () => ({ x: x + (9 + Math.random() * 4) * (V.guard.flip ? -1 : 1), y: y - 9,
      vx: (Math.random() - 0.5) * 10, vy: 16, g: 60, life: 0.5, t: 0, c: '#ff9f3b', s: 1, fade: 1, layer: 1 }),
    forgefire: () => ({ x: POI.forge[0] + (Math.random() * 6 - 3), y: POI.forge[1] - 8,
      vx: (Math.random() - 0.5) * 6, vy: -16 - Math.random() * 10, life: 0.9, t: 0,
      c: ['#ffd23b', '#ff9f3b', '#ff6a3b'][Math.random() * 3 | 0], s: 1, fade: 1, layer: 1 }),
    blood: () => ({ x: x + (rB() * 4 - 2), y, vx: (rB() - 0.5) * 6, vy: 16 + rB() * 14, g: 180,
      life: 0.55, t: 0, c: rB() < 0.5 ? '#a01018' : '#c33', s: 1, fade: 1, layer: 1 }),
  };
  const f = defs[kind]; if (f) G.emit(1, f);
}

function drawVillageHUD() {
  G.drawParts(0); G.drawParts(1);
  // 상단 지표 리본
  const st = G.ST;
  if (st) {
    const mood = G.moodOf(st.defcon);
    G.text(`${mood[0]}`, 6, 5, { size: 9, color: '#ffd6a0', outline: '#0008' });
    G.text(G.lang === 'en'
      ? `Today's marsh · intrusions ${st.stats.total_events.toLocaleString()} · captures ${st.stats.blocked}`
      : `오늘의 늪 · 침입 ${st.stats.total_events.toLocaleString()} · 포획 ${st.stats.blocked}`,
      6, 16, { size: 9, color: '#9fb2c8', outline: '#0008' });
  }
  if (G.queue.length) G.text(`⚔ 접근 중인 몬스터 ${G.queue.length}무리`, G.W - 6, 5,
    { size: 9, color: '#ff9f8a', align: 'right', outline: '#0008' });
}
