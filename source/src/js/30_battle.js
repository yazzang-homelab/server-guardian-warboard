/* ═══════════════════════════════════════════════════════════════
   30_battle — 전투 3종(a 스커미시 / b DQ 1인칭 / c 슈로대) + 절차 안무
   · 모든 수치는 각본(포획 로그 시각화) — 항상 방어 승리
   · 공격자 유래 문자열(ip/이름)은 캔버스 fillText 로만 표시
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* ── 대사 풀 (조롱-패배 프레이밍) ── */
const FOE_INTRO = {
  mob: ['흐흐, 문이 열려 있잖아?', 'root/root… 어? 왜 안 되지', '오늘은 뚫린다, 반드시!', '여기가 그 소문의 서버냐'],
  elite: ['이 몸이 직접 왔다!', '스캔 완료. 침입 개시한다', '수호자? 웃기고 있네', '내 사전에 실패란 없… 없었다'],
  boss: ['이 성벽, 내가 부순다!!', '부하들이 다 당했다고…? 내가 간다', '오늘 밤 이 마을은 끝이다'],
  named: {
    king: '무법자 왕이다. 열쇠(authorized_keys)를 심으러 왔지…',
    sorcerer: '채굴 마도사… 네 CPU, 전부 내 금광이 될 것이다',
    golem: '드로퍼 골렘… wget… chmod… 실행…',
    alphabat: '끼에엑! 군체가 간다! busybox! busybox!',
    wraith: '…나는 기록되지 않는 자… (이미 도감에 박제됨)',
  },
};
const HERO_INTRO = ['여기까지다, 몬스터!', '이 문은 미끼다. 넌 이미 늪 안이야', '오늘의 장작이 왔군',
  '도감에 얼굴 박제하고 보내주마', '수호자의 이름으로, 통과 불가!'];
const HERO_WIN = ['다음엔 비번이라도 바꿔서 와라', '경험치 고마워. 또 와', '늪은 오늘도 평화롭다',
  '침입 성공률 0% 갱신 중', '장작 +1. 모닥불이 따뜻해졌다'];
const FOE_LOSE = ['내, 내 IP가 박제됐다고…?!', '이럴 수가… 문이 가짜였다니', '기억해라 수호자…!', '으아악 로그로 남는다아…'];

/* ── 무브 정의 ──
   choreo 빌더가 rng 로 조합. actor 키: hero / merc / foe / foe2 */
const HERO_PREFIX = 'hero_';
const MERC = {
  huntress: { pre: 'huntress_', ko: '용병 궁수', atk: 'attack1', proj: 'fx_arrow' },
  wizardm: { pre: 'wizardm_', ko: '용병 마도사', atk: 'attack1', proj: 'fx_orb' },
  martial: { pre: 'martial_', ko: '용병 무투가', atk: 'attack2', proj: null },
};

/* 종족별 공격 모션·투사체 */
const FOE_ATK = {
  skeleton: { anim: 'attack', fx: 'slash' }, goblin: { anim: 'attack', fx: 'slash' },
  mushroom: { anim: 'attack', fx: 'spore' }, flyeye: { anim: 'attack', fx: 'beam' },
  mimic: { anim: 'attack', fx: 'bite' }, rat: { anim: 'attack', fx: 'slash' },
  slime: { anim: 'attack', fx: 'splash' }, bat: { anim: 'attack', fx: 'dive' },
  worm: { anim: 'attack', fx: 'fireball' }, wraith: { anim: 'attack', fx: 'beam' },
  king: { anim: 'attack1', fx: 'slash', pat: 'summon' },
  sorcerer: { anim: 'attack1', fx: 'orb', pat: 'charge' },
  golem: { anim: 'attack', fx: 'splash', pat: 'slam' },
  alphabat: { anim: 'attack', fx: 'dive', pat: 'swarm' },
};

/* ── 전투 상태 ── */
const B = {
  mode: '', foe: null, wave: null, actors: {}, tl: null, timers: [], fxs: [],
  say: null, sayT: 0, msgQ: [], msgCur: '', msgCh: 0, popups: [], projectiles: [],
  heroHP: 1, foeHP: 1, t0: 0, result: '', bgSeed: 0, cutin: null, over: !1,
  heroHome: [0, 0], foeHome: [0, 0],
};
G.B = B;

const mkActor = (prefix, x, y, o) => Object.assign(
  { x, y, prefix, anim: new G.Anim(prefix), flip: !1, scale: 1, alpha: 1, hurtT: 0, slide: null, dead: !1 },
  o || {});

/* ── 시각 bbox 헬퍼 (idle 0프레임 실측 — 타점/근접 거리/이펙트 크기의 기준) ── */
function actorBox(a) {
  const d = a && G.animDef(a.prefix + 'idle'), s = d && G.spr(d.f[0]);
  const sc = (a && a.scale) || 1;
  if (!s) { const l = a.x - 14 * sc; return { l, r: a.x + 14 * sc, t: a.y - 30 * sc, b: a.y, w: 28 * sc, h: 30 * sc, cx: a.x, cy: a.y - 15 * sc }; }
  const [, , , w, h, ax, ay] = s;
  const l = a.x - sc * (a.flip ? w - ax : ax), t = a.y - sc * ay;
  return { l, r: l + w * sc, t, b: t + h * sc, w: w * sc, h: h * sc, cx: l + w * sc / 2, cy: t + h * sc / 2 };
}
const meleeX = foe => actorBox(foe).l - 14;              // 몬스터 앞가장자리 — 파묻힘 방지
const fxScale = (a, base) => Math.max(1, Math.min(2.6, actorBox(a).h * 0.9 / (base || 30)));

/* ── 안무 빌더 (시드 결정론 + 랜덤 이벤트) ── */
function heroStrike(env, r, kind) {
  const foe = B.actors.foe, hero = B.actors.hero;
  const evt = r();                                     // 랜덤 이벤트 주사위
  const crit = evt > 0.82, miss = !crit && evt < 0.08;
  const dmg = 8 + Math.floor(r() * 14) + (crit ? 18 : 0);
  const steps = [];
  if (kind === 'dash') steps.push(
    { do: 'anim', who: 'hero', name: 'run', loop: !0 },
    { do: 'slide', who: 'hero', to: () => [meleeX(B.actors.foe), B.heroHome[1]], dur: 260 });
  steps.push({ do: 'sfx', name: 'kiai' },
    { do: 'anim', who: 'hero', name: G.pick(r, ['attack1', 'attack2', 'attack3']), wait: !0 });
  if (miss) steps.push(
    { do: 'call', fn: () => popup(foe.x, foe.y - 46, 'MISS', '#9fb2c8') },
    { do: 'slide', who: 'foe', to: () => [B.foeHome[0] + 14, B.foeHome[1]], dur: 120 },
    { do: 'slide', who: 'foe', to: () => B.foeHome.slice(), dur: 160 });
  else steps.push(
    { par: [
      { do: 'fx', fx: 'slash', x: () => actorBox(B.actors.foe).cx, y: () => actorBox(B.actors.foe).cy,
        scale: () => fxScale(B.actors.foe) },
      ...(crit ? [{ do: 'sfx', name: 'crit' },
        { do: 'fx', fx: 'impact', x: () => actorBox(B.actors.foe).cx, y: () => actorBox(B.actors.foe).cy,
          scale: () => fxScale(B.actors.foe) * 1.15 }] : []),
      { do: 'hitstop', dur: crit ? 130 : 70 },
      { do: 'shake', mag: crit ? 5 : 2.5, dur: crit ? 300 : 160 },
      { do: 'call', fn: () => { hurt('foe'); popup(foe.x, foe.y - 46, (crit ? '회심! ' : '') + dmg, crit ? '#ffd23b' : '#fff'); dipFoe(dmg); } },
    ] });
  if (kind === 'dash') steps.push({ do: 'slide', who: 'hero', to: () => B.heroHome.slice(), dur: 240 },
    { do: 'anim', who: 'hero', name: 'idle', loop: !0 });
  return steps;
}

function mercAssist(env, r) {
  const key = G.pick(r, Object.keys(MERC)), m = MERC[key], foe = B.actors.foe;
  const y = B.groundY(), x0 = -30;
  const dmg = 10 + Math.floor(r() * 12);
  return [
    { do: 'call', fn: () => {                            // 등장 시점에 생성 (빌드 시 유령 방지)
      B.actors.merc = mkActor(m.pre, x0, y, {});
      B.actors.merc.anim.set('idle', { loop: !0 }); } },
    { do: 'say', who: 'merc', name: m.ko, text: G.pick(r, ['지원 사격!', '수호자, 엄호한다!', '한 발 아끼지 마라!']) },
    { do: 'slide', who: 'merc', to: [70, y], dur: 240 },
    { do: 'anim', who: 'merc', name: m.atk, wait: !0 },
    { do: 'call', fn: () => m.proj && shoot(m.proj, 84, y - 26, foe.x, foe.y - 24, 380) },
    { do: 'wait', dur: 300 },
    { par: [
      { do: 'fx', fx: 'burst', x: () => actorBox(B.actors.foe).cx, y: () => actorBox(B.actors.foe).cy,
        scale: () => fxScale(B.actors.foe) },
      { do: 'hitstop', dur: 80 }, { do: 'shake', mag: 3, dur: 200 },
      { do: 'call', fn: () => { hurt('foe'); popup(foe.x, foe.y - 46, dmg, '#aef'); dipFoe(dmg); } },
    ] },
    { do: 'slide', who: 'merc', to: [x0, y], dur: 260 },
    { do: 'call', fn: () => delete B.actors.merc },
  ];
}

function foeTurn(env, r) {
  const foe = B.actors.foe, hero = B.actors.hero, FA = FOE_ATK[B.foe.sp] || FOE_ATK.goblin;
  const parry = r() > 0.68;                            // 패링→카운터
  const dmg = 6 + Math.floor(r() * 10);
  const steps = [{ do: 'anim', who: 'foe', name: FA.anim, wait: !0 }];
  if (FA.pat === 'charge') steps.unshift(
    { do: 'say', who: 'foe', name: B.foe.name, text: '차지… 해시레이트 최대!' },
    { do: 'fx', fx: 'charge', x: () => foe.x, y: () => foe.y + 2, dur: 500 });   // 마법진 = 시전자 발밑 (v2.6 앵커 정합)
  if (FA.pat === 'slam') steps.push({ do: 'shake', mag: 6, dur: 350 });
  if (FA.pat === 'swarm') steps.push({ do: 'call', fn: () => swarmBats(foe.x, foe.y) });
  if (FA.pat === 'summon') steps.push(
    { do: 'say', who: 'foe', name: B.foe.name, text: '부하들아, 나와라!' },
    { do: 'call', fn: () => summonMinions(r) });
  if (parry) steps.push(
    { do: 'sfx', name: 'parry' },
    { do: 'call', fn: () => popup(hero.x, hero.y - 44, '패링!', '#7fd8ff') },
    { do: 'flash', color: 'rgba(160,220,255,.5)', dur: 90 },
    { do: 'hitstop', dur: 90 },
    ...heroStrike(env, r, 'counter'));
  else steps.push(
    { par: [
      // 종족별 공격 fx (구 'slash' 고정 결함 수정) + 지면형(spore 등)은 발밑 정합 (v2.6)
      { do: 'fx', fx: FA.fx, flip: !0, x: () => actorBox(B.actors.hero).cx, y: () => fxY(B.actors.hero, FA.fx),
        scale: () => fxScale(B.actors.hero) },
      { do: 'hitstop', dur: 55 }, { do: 'shake', mag: 2, dur: 140 },
      { do: 'call', fn: () => { hurt('hero'); popup(hero.x, hero.y - 44, dmg, '#ff9f7f'); dipHero(dmg); } },
    ] },
    { do: 'anim', who: 'hero', name: 'idle', loop: !0 });
  return steps;
}

function finisher(env, r) {
  const foe = B.actors.foe, hero = B.actors.hero;
  const pool = ['blade', 'rain', 'nova'];
  if (G.animDef('fx_thunder')) pool.push('judgment');  // 에셋 게이팅 — rng 소비는 항상 1회
  if (G.animDef('fx_fireburst')) pool.push('inferno'); // v2.6 신규 필살기 3종
  if (G.animDef('fx_ice')) pool.push('glacier');
  if (G.animDef('fx_holy')) pool.push('sanction');
  const kind = G.pick(r, pool);
  const common = [
    { do: 'call', fn: () => G.letterbox(!0) },
    { do: 'sfx', name: 'kiai' },
    { do: 'say', who: 'hero', name: '수호자', text: G.pick(r, ['필살…!', '이걸로 끝이다!', '늪의 이름으로!']) },
  ];
  const foeCx = () => actorBox(B.actors.foe).cx, foeCy = () => actorBox(B.actors.foe).cy;
  const foeB = () => actorBox(B.actors.foe).b;
  const seq = {
    blade: [                                           // 삼연참: 관통→교차 참격×2→대참+임팩트 (hitstop 점증)
      { do: 'sfx', name: 'ann_combo' },
      { do: 'anim', who: 'hero', name: 'run', loop: !0 },
      { do: 'slide', who: 'hero', to: () => [actorBox(B.actors.foe).r + 16, B.heroHome[1]], dur: 180 },
      { do: 'call', fn: () => afterimage(hero) },
      { par: [{ do: 'hitstop', dur: 90 }, { do: 'shake', mag: 4, dur: 220 },
        { do: 'fx', fx: 'slash3', x: foeCx, y: foeCy, scale: () => fxScale(B.actors.foe) },
        { do: 'call', fn: () => hurt('foe') }] },
      { do: 'wait', dur: 130 },
      { par: [{ do: 'hitstop', dur: 120 }, { do: 'shake', mag: 5, dur: 260 },
        { do: 'fx', fx: 'slash2', flip: !0, x: foeCx, y: foeCy, scale: () => fxScale(B.actors.foe) * 1.1 },
        { do: 'call', fn: () => hurt('foe') }] },
      { do: 'wait', dur: 150 },
      { par: [{ do: 'hitstop', dur: 160 }, { do: 'flash', color: 'rgba(255,255,255,.6)', dur: 140 },
        { do: 'shake', mag: 7, dur: 400 },
        { do: 'fx', fx: G.animDef('fx_slashbig') ? 'slashbig' : 'slash', x: foeCx, y: foeCy,
          scale: () => fxScale(B.actors.foe, 44) * 1.3 },                 // 대참 = 대형 X 참격 (v2.6)
        { do: 'fx', fx: 'impact', x: foeCx, y: foeCy, scale: () => fxScale(B.actors.foe) * 1.2 },
        { do: 'call', fn: () => { hurt('foe'); popup(foe.x, foe.y - 50, '삼연참!', '#ffd23b'); } }] },
      { do: 'slide', who: 'hero', to: () => B.heroHome.slice(), dur: 200 },
      { do: 'anim', who: 'hero', name: 'attack1', wait: !0 },
    ],
    rain: [                                            // 화살비: 착탄마다 임팩트 스파크
      { do: 'call', fn: () => { for (let i = 0; i < 7; i++) {
        B.timers.push(setTimeout(() => shoot('fx_arrow', 40 + i * 30, -8, foe.x + (i - 3) * 6, foe.y - 20, 300), i * 90));
        B.timers.push(setTimeout(() => spawnFx({ fx: 'impact', x: foe.x + (i - 3) * 6, y: foe.y - 20, scale: 1.15 }), i * 90 + 300));
      } } },
      { do: 'wait', dur: 900 },
      { par: [{ do: 'shake', mag: 5, dur: 400 },
        { do: 'fx', fx: 'explosion', x: foeCx, y: foeCy, scale: () => fxScale(B.actors.foe, 62) * 0.8 },  // 폭발=몸통 중심 (v2.6 앵커 정합)
        { do: 'call', fn: () => hurt('foe') }] },
    ],
    nova: [                                            // 마법진→더블 버스트
      { do: 'fx', fx: 'circle', x: () => B.actors.foe.x, y: () => foeB() + 2,
        scale: () => fxScale(B.actors.foe, 40), dur: 620 },
      { par: [{ do: 'fx', fx: 'explosion', x: foeCx, y: foeCy, scale: () => fxScale(B.actors.foe, 62) },
        { do: 'flash', color: 'rgba(255,210,120,.55)', dur: 160 },
        { do: 'hitstop', dur: 140 }, { do: 'shake', mag: 7, dur: 450 },
        { do: 'call', fn: () => { hurt('foe');
          B.timers.push(setTimeout(() => spawnFx({ fx: 'explosion2', x: foeCx() + 10, y: foeCy() + 4,
            scale: fxScale(B.actors.foe, 70) }), 120)); } }] },
    ],
    inferno: [                                         // 업화: 마법진→화염 폭발 연쇄 (v2.6)
      { do: 'fx', fx: 'circle', x: () => B.actors.foe.x, y: () => foeB() + 2,
        scale: () => fxScale(B.actors.foe, 40), dur: 550 },
      { par: [{ do: 'fx', fx: 'fireburst', x: foeCx, y: foeCy, scale: () => fxScale(B.actors.foe, 50) },
        { do: 'flash', color: 'rgba(255,150,60,.5)', dur: 140 },
        { do: 'hitstop', dur: 130 }, { do: 'shake', mag: 6, dur: 420 },
        { do: 'call', fn: () => { hurt('foe'); popup(foe.x, foe.y - 54, '업화!', '#ff9f3b');
          B.timers.push(setTimeout(() => spawnFx({ fx: 'fireburst', x: foeCx() - 16, y: foeCy() + 8,
            scale: fxScale(B.actors.foe, 50) * 0.8 }), 150));
          B.timers.push(setTimeout(() => spawnFx({ fx: 'explosion2', x: foeCx() + 10, y: foeCy(),
            scale: fxScale(B.actors.foe, 70) }), 320)); } }] },
    ],
    glacier: [                                         // 빙옥: 발밑 결정 성장→빙결 정지→분쇄 (v2.6)
      { do: 'fx', fx: 'ice', x: () => B.actors.foe.x, y: () => foeB() + 2,
        scale: () => Math.max(1.4, fxScale(B.actors.foe, 26)), dur: 600 },
      { do: 'call', fn: () => popup(foe.x, foe.y - 56, '빙결!', '#9fe8ff') },
      { do: 'hitstop', dur: 220 },
      { par: [{ do: 'fx', fx: 'iceburst', x: () => B.actors.foe.x, y: () => foeB() + 2,
          scale: () => Math.max(1.4, fxScale(B.actors.foe, 26)) },
        { do: 'fx', fx: 'icehit', x: foeCx, y: foeCy, scale: () => fxScale(B.actors.foe) },
        { do: 'flash', color: 'rgba(160,220,255,.5)', dur: 150 },
        { do: 'shake', mag: 6, dur: 400 },
        { do: 'call', fn: () => hurt('foe') }] },
    ],
    sanction: [                                        // 축성: 성속 빛기둥 강림 ×2 (v2.6)
      { par: [{ do: 'fx', fx: 'holy', x: () => B.actors.foe.x, y: () => foeB() + 2,
          scale: () => Math.max(1.5, fxScale(B.actors.foe, 40)) },
        { do: 'flash', color: 'rgba(255,240,180,.55)', dur: 150 },
        { do: 'hitstop', dur: 140 }, { do: 'shake', mag: 6, dur: 400 },
        { do: 'call', fn: () => { hurt('foe'); popup(foe.x, foe.y - 54, '축성!', '#ffe8a0');
          B.timers.push(setTimeout(() => spawnFx({ fx: 'holy', x: foeCx() + 12, y: foeB() + 2, scale: 1.3 }), 170));
          B.timers.push(setTimeout(() => spawnFx({ fx: 'thunderhit', x: foeCx(), y: foeCy(),
            scale: fxScale(B.actors.foe) }), 240)); } }] },
    ],
    judgment: [                                        // 낙뢰 심판: 마법진→벼락×2+히트링
      { do: 'fx', fx: 'circle', x: () => B.actors.foe.x, y: () => foeB() + 2,
        scale: () => fxScale(B.actors.foe, 40), dur: 550 },
      { par: [{ do: 'fx', fx: 'thunder', x: foeCx, y: foeB, scale: () => Math.max(1.6, fxScale(B.actors.foe, 40)) },
        { do: 'flash', color: 'rgba(255,255,255,.7)', dur: 160 },
        { do: 'hitstop', dur: 150 }, { do: 'shake', mag: 8, dur: 450 },
        { do: 'call', fn: () => { hurt('foe');
          B.timers.push(setTimeout(() => spawnFx({ fx: 'thunder', x: foeCx() + 14, y: foeB(), scale: 1.6 }), 120));
          B.timers.push(setTimeout(() => spawnFx({ fx: 'thunderhit', x: foeCx(), y: foeCy(),
            scale: fxScale(B.actors.foe) }), 170)); } }] },
    ],
  }[kind];
  return [...common, ...seq,
    { do: 'call', fn: () => { B.foeHP = 0; } },
    { do: 'sfx', name: 'death' },
    { do: 'anim', who: 'foe', name: 'death', wait: !0 },
    { do: 'call', fn: () => { B.actors.foe.dead = !0; G.letterbox(!1); } },
    { do: 'sfx', name: 'ann_finish' },
    { do: 'say', who: 'foe', name: B.foe.name, text: G.pick(r, FOE_LOSE) },
    { do: 'say', who: 'hero', name: '수호자', text: G.pick(r, HERO_WIN) },
  ];
}

/* HP 각본 딥: 영웅은 라운드마다 감소하되 25% 바닥 */
function dipHero(d) { B.heroHP = Math.max(0.25, B.heroHP - d / 100); }
function dipFoe(d) { B.foeHP = Math.max(0.08, B.foeHP - d / (B.foe.tier === 'named' ? 130 : 90)); }
function hurt(who) { const a = B.actors[who]; if (!a) return; a.hurtT = 0.22;
  G.sfx(who === 'hero' ? 'hurt_h' : 'impact');
  if (G.animDef(a.prefix + 'hit')) a.anim.set('hit', { onEnd: () => !a.dead && a.anim.set('idle', { loop: !0 }) }); }
function popup(x, y, txt, c) { B.popups.push({ x, y, txt: String(txt), c, t: 0 }); }
function shoot(spr, x0, y0, x1, y1, ms) { G.sfx('arrow'); B.projectiles.push({ spr, x0, y0, x1, y1, t: 0, ms }); }
function afterimage(a) { if (G.RM) return;
  for (let i = 0; i < 4; i++) B.popups.push({ x: a.x - i * 14, y: a.y - 26, txt: '', ghost: a, t: -i * 0.04 }); }
function swarmBats(x, y) { G.sfx('growl'); G.emit(10, i => ({ x: x + 20, y: y - 30, vx: -60 - Math.random() * 80,
  vy: 20 + Math.random() * 30, life: 1.1, t: 0, c: '#5a4a6a', s: 2, fade: 1, layer: 1 })); }
function summonMinions(r) {
  G.sfx('growl');
  const y = B.groundY();
  B.actors.foe2 = mkActor(G.pick(r, ['goblin_', 'skeleton_']), G.W + 20, y, { flip: !0, scale: 0.8 });
  B.actors.foe2.anim.set('idle', { loop: !0 });
  B.tlPush([{ do: 'slide', who: 'foe2', to: [B.actors.foe.x + 42, y], dur: 300 }]);
}

/* ── 안무 조립 ── */
function buildChoreo(r, mode) {
  const rounds = { mob: 1, elite: 2, boss: 3, named: 3 }[B.foe.tier] || 1;
  const steps = [];
  const named = B.foe.tier === 'named';
  // 인트로 대사 (슈로대 컷인은 srw 모드에서만 풀연출)
  const introFoe = named ? FOE_INTRO.named[B.foe.sp] : G.pick(r, FOE_INTRO[B.foe.tier] || FOE_INTRO.mob);
  if (mode !== 'skirmish') steps.push(
    { do: 'call', fn: () => cutin('foe', introFoe) },
    { do: 'say', who: 'foe', name: B.foe.name, text: introFoe },
    { do: 'call', fn: () => cutinOut() },
    { do: 'wait', dur: 200 },
    { do: 'call', fn: () => cutin('hero', '') },
    { do: 'say', who: 'hero', name: '수호자', text: G.pick(r, HERO_INTRO) },
    { do: 'call', fn: () => cutinOut() },
    { do: 'wait', dur: 200 },
    { do: 'call', fn: () => (B.cutin = null) },
    { do: 'sfx', name: 'ann_fight' });
  for (let i = 0; i < rounds; i++) {
    steps.push(...foeTurn(null, r));
    if (i === rounds - 1 && rounds > 1 && r() > 0.45) steps.push(...mercAssist(null, r));
    steps.push(...heroStrike(null, r, r() > 0.5 ? 'dash' : 'stand'));
    if (mode === 'skirmish') break;                    // 스커미시는 1왕복 고정
  }
  steps.push(...(mode === 'skirmish'
    ? [{ do: 'anim', who: 'hero', name: 'attack1', wait: !0 },
       { par: [{ do: 'hitstop', dur: 70 },
         { do: 'fx', fx: 'slash', x: () => actorBox(B.actors.foe).cx, y: () => actorBox(B.actors.foe).cy,
           scale: () => fxScale(B.actors.foe) },
         { do: 'call', fn: () => { B.foeHP = 0; hurt('foe'); } }] },
       { do: 'anim', who: 'foe', name: 'death', wait: !0 },
       { do: 'call', fn: () => (B.actors.foe.dead = !0) }]
    : finisher(null, r)));
  steps.push({ do: 'call', fn: () => victory() });
  return steps;
}

function cutin(side, _txt) { B.cutin = { side, t: 0, out: 0 }; G.sfx('cutin'); if (side === 'foe') G.sfx('growl'); }
function cutinOut() { if (B.cutin && !B.cutin.out) B.cutin.out = B.cutin.t; }

/* ── 승리 처리 (도감/XP — 데모는 G.save 가 무시) ── */
function victory() {
  B.result = 'win'; B.over = !0;
  const S = G.SAVE;
  if (!(B.wave && B.wave.replay)) {                      // 재연은 전과(kills/waves) 미집계 — 통계 정직성
    S.kills = (S.kills || 0) + (B.wave ? B.wave.foes.length : 1);
    S.waves = (S.waves || 0) + 1;
  }
  for (const f of (B.wave ? B.wave.foes : [B.foe])) if (!S.seen[f.sp]) S.seen[f.sp] = Date.now();
  G.save();
  if (B.mode === 'dq' && (B.actors.foeL || B.actors.foeR))
    popup(G.W / 2, G.H - 120, '나머지는 도망쳤다!', '#9fb2c8'); // DQ 정석 — 중앙 격파 시 사이드 도주
  if (B.actors.hero && G.animDef('fx_heal'))            // 승리 회복 연출 (v2.6 — 발밑 앵커)
    spawnFx({ fx: 'heal', x: B.actors.hero.x, y: B.actors.hero.y + 2, scale: 1 });
  G.combatMark(B.t0, performance.now());
  G.bus.emit('victory', B.foe);
  B.timers.push(setTimeout(() => G.setScene('village'), 2600));
}

/* ── 전투 씬 ── */
G.regScene('battle', {
  enter() {
    B.over = !1; B.result = ''; B.popups = []; B.projectiles = []; B.msgQ = []; B.say = null; B.fxs = [];
    B.t0 = performance.now();
    // 안무 시드 — 재연 회차(seq) 혼입: 같은 IP 재연이라도 매번 다른 안무
    const seed = B.foe.h ^ (G.SAVE.waves || 0) * 2654435761 ^ ((B.wave && B.wave.seq || 0) * 0x85ebca6b);
    if (B.mode === 'fps') {                              // 1인칭 돌입전 — 3D 뷰/안무는 G.FPS 전담
      B.actors = { foe: mkActor(B.foe.sp + '_', -999, -999, { scale: 1 }) };  // 컷인 배너 초상 전용(hero 없음)
      B.actors.foe.anim.set('idle', { loop: !0 });
      B.heroHP = 1; B.foeHP = 1; B.bgSeed = B.foe.h;
      G.FPS.enter(seed);
      return;
    }
    const y = B.groundY();
    B.actors = {
      hero: mkActor(HERO_PREFIX, 96, y, {}),
      foe: mkActor(B.foe.sp + '_', G.W - 110, y, { flip: !0,
        scale: { mob: 1, elite: 1.15, boss: 1.6, named: 1.75 }[B.foe.tier] || 1 }),
    };
    if (B.mode === 'dq') {                             // DQ 무대: 실좌표/실스케일로 일원화 (fx·팝업·근접 정렬)
      B.actors.foe.x = G.W / 2; B.actors.foe.y = G.H - 98;
      B.actors.foe.scale = Math.round((B.actors.foe.scale + 1.2) * 2) / 2;
      B.actors.hero.x = 46; B.actors.hero.y = G.H - 20;
      // 다수 웨이브 = DQ 정석 가로 펼침 (표시 전용 — 안무/actorBox/타점은 중앙 foe 만 참조)
      const rest = ((B.wave && B.wave.foes) || []).filter(f => f !== B.foe).slice(0, 2);
      rest.forEach((f, i) => {
        const k = i ? 'foeR' : 'foeL';                   // foe2 키는 summonMinions 예약 — 회피
        B.actors[k] = mkActor(f.sp + '_', G.W / 2 + (i ? 72 : -72), G.H - 98,
          { scale: Math.max(1, Math.round(B.actors.foe.scale * 0.85 * 2) / 2) });
        B.actors[k].anim.set('idle', { loop: !0 });
      });
    }
    B.heroHome = [B.actors.hero.x, B.actors.hero.y];
    B.foeHome = [B.actors.foe.x, B.actors.foe.y];
    B.actors.hero.anim.set('idle', { loop: !0 });
    B.actors.foe.anim.set('idle', { loop: !0 });
    B.heroHP = 1; B.foeHP = 1;
    const r = G.rng(seed);
    B.bgSeed = B.foe.h;
    if (B.mode === 'srw') G.letterbox(!0), setTimeout(() => G.letterbox(!1), 2200);
    B.tl = G.timeline(buildChoreo(r, B.mode), {
      actors: B.actors, timers: B.timers, clock: () => performance.now(),
      spawnFx: st => spawnFx(st), say: st => say(st), popup: st => popup(st.x, st.y, st.text, st.c),
    });
  },
  exit() {
    if (B.tl) B.tl.cancel();
    B.timers.forEach(clearTimeout); B.timers = [];
    if (!B.over) G.combatMark(B.t0, performance.now());
    G.letterbox(!1); B.actors = {}; B.cutin = null; B.fxs = [];
    if (G.FPS) G.FPS.reset();
  },
  update(dt) {
    if (B.mode === 'fps' && G.FPS) G.FPS.update(dt);
    for (const k in B.actors) { const a = B.actors[k];
      a.anim.update(dt); a.slide && a.slide(); if (a.hurtT > 0) a.hurtT -= dt; }
    for (let i = B.fxs.length - 1; i >= 0; i--) { const f = B.fxs[i];
      f.anim.update(dt); if (f.done) B.fxs.splice(i, 1); }
    if (B.cutin) B.cutin.t += dt;
    for (let i = B.popups.length - 1; i >= 0; i--) { const p = B.popups[i];
      p.t += dt; if (p.t > 1) B.popups.splice(i, 1); }
    for (let i = B.projectiles.length - 1; i >= 0; i--) { const p = B.projectiles[i];
      p.t += dt * 1000; if (p.t > p.ms) { B.projectiles.splice(i, 1); } }
    if (B.say) { B.sayT += dt; const shown = G.sceneText(B.say.text);
      B.msgCh = Math.min(shown.length, Math.floor(B.sayT * 22)); }
  },
  draw() { (DRAW[B.mode] || DRAW.srw)(); },
  groundY: () => B.groundY(),
});
B.groundY = () => B.mode === 'dq' ? G.H - 60 : G.H - 62;   // 스커미시 밴드/무대 발밑 (270 시절 210/208 등가)
B.tlPush = steps => { const env = { actors: B.actors, timers: B.timers, clock: () => performance.now(),
  spawnFx: spawnFx, say: say, popup: (st) => popup(st.x, st.y, st.text, st.c) };
  G.timeline(steps, env); };

/* 전투 시작 API */
G.startBattle = (wave, forceMode) => {
  B.wave = wave; B.foe = wave.top;
  const deep = G.queue.length >= 1;                   // 대기 웨이브 있으면 저비용 강등
  const r = G.rng(B.foe.h ^ 0x9e37);
  const fpsOk = !!(G.FPS && G.animDef('fps_hand_fire')); // 에셋+모듈 게이팅 (fx_thunder 방식)
  let mode = forceMode
    || (fpsOk && !wave.replay && B.foe.payload ? 'fps' // 고위험(페이로드 투하) → 1인칭 돌입전. 재연은 금지(경보 시맨틱)
      : fpsOk && !wave.replay && B.foe.tier === 'boss' ? G.pick(r, ['fps', 'srw'])
      : B.foe.tier === 'named' || B.foe.tier === 'boss' ? 'srw'
      : deep ? 'skirmish'
      : B.foe.tier === 'elite' ? G.pick(r, ['srw', 'dq'])
      : G.pick(r, ['dq', 'skirmish', 'srw']));
  B.mode = mode;
  G.setScene('battle');
};

/* ── fx/say 구현 ── */
/* fx 키 → 아틀라스 스프라이트 (부재 시 자동 파티클 폴백 — G.animDef 가드) */
const SPRFX = { explosion: 'fx_explosion', explosion2: 'fx_explosion2', slash: 'fx_slash',
  slash2: 'fx_slash2', slash3: 'fx_slash3', slash4: 'fx_slash4', burst: 'fx_impact',
  impact: 'fx_impact', charge: 'fx_circle', circle: 'fx_circle', spore: 'fx_poison',
  beam: 'fx_dark', orb: 'fx_dark', fireball: 'fx_fireburst', bite: 'fx_slash3',
  dive: 'fx_impact', splash: 'fx_impact', thunder: 'fx_thunder', thunderhit: 'fx_thunderhit',
  // v2.6 — Pimen 2차 (화염 폭발/빙결/성속 기둥/대형 참격/연기/회복)
  fireburst: 'fx_fireburst', ice: 'fx_ice', iceburst: 'fx_iceburst', icehit: 'fx_icehit',
  holy: 'fx_holy', slashbig: 'fx_slashbig', smoke: 'fx_smoke', heal: 'fx_heal' };
/* fx 키 → 사운드 (단일 병목 — 모든 이펙트가 여기서 소리 남. null=무음) */
const FXSND = { slash: 'swing', slash2: 'swing', slash3: 'swing', slash4: 'swing', bite: 'swing',
  dive: 'swing', burst: 'impact', impact: 'impact', splash: 'impact', charge: 'magic',
  circle: 'magic', spore: 'magic', beam: 'magic', orb: 'magic', fireball: 'boom',
  explosion: 'boom', explosion2: 'boom', thunder: 'zap', thunderhit: 'zap',
  fireburst: 'boom', ice: 'magic', iceburst: 'impact', icehit: 'impact',
  holy: 'magic', slashbig: 'swing', smoke: null, heal: 'magic' };
/* 지면 발생형 fx(발밑 앵커) — 호출부 y 산정 공용 (v2.6 앵커 정합) */
const FX_FOOT = /^(charge|circle|spore|thunder|ice|iceburst|holy|smoke|heal)$/;
const fxY = (a, fx) => FX_FOOT.test(fx) ? actorBox(a).b + 2 : actorBox(a).cy;

function spawnFx(st) {
  const x = typeof st.x === 'function' ? st.x() : st.x, y = typeof st.y === 'function' ? st.y() : st.y;
  const sc = Math.max(1, (typeof st.scale === 'function' ? st.scale() : st.scale) || 1);
  const snd = FXSND[st.fx];
  if (snd !== null) G.sfx(snd || 'impact');
  const sf = SPRFX[st.fx];
  let spr = !1;
  if (sf && G.animDef(sf)) {                           // 스프라이트 fx — 전용 리스트(update+draw 는 씬이 담당)
    const f = { x, y, scale: sc, flip: !!st.flip, anim: new G.Anim(''), done: !1 };
    f.anim.set(sf, { onEnd: () => (f.done = !0) });
    B.fxs.push(f);
    // 폭발 여운 — 연기 자동 스폰 (에셋 게이팅, 연쇄 방지로 smoke 자신은 제외)
    if (/^(explosion2?|fireburst|fireball)$/.test(st.fx) && G.animDef('fx_smoke'))
      B.timers.push(setTimeout(() => spawnFx({ fx: 'smoke', x, y: y + 14, scale: Math.min(1.6, sc) }), 300));
    if (/^(explosion2?|thunder|thunderhit|circle|charge|spore|beam|orb|fireburst|fireball|ice|iceburst|icehit|holy|smoke|heal)$/.test(st.fx)) return;
    spr = !0;                                          // 슬래시/임팩트류는 파편 파티클 소량 겸용
  }
  const colors = { slash: '#fff', burst: '#aef', charge: '#c9f', spore: '#9c6', beam: '#f66',
    fireball: '#f93', splash: '#6cf', dive: '#a8f', bite: '#fc6', thunder: '#ffe89f',
    impact: '#fff', circle: '#9fe8ff', orb: '#c9f' };
  G.emit(Math.round((st.fx === 'charge' ? 14 : 9) * Math.min(1.8, sc) * (spr ? 0.5 : 1)), () => ({ x, y,
    vx: (Math.random() * 2 - 1) * 90 * sc, vy: (Math.random() * 2 - 1) * 70 * sc - 20,
    g: 120, life: 0.5, t: 0, c: colors[st.fx] || '#fff', s: sc > 1.5 ? 3 : 2, fade: 1, layer: 1 }));
}
function say(st) { B.say = { who: st.who, name: st.name || '', text: String(st.text || '') }; B.sayT = 0;
  B.timers.push(setTimeout(() => { if (B.say && B.say.text === st.text) B.say = null; },
    st.dur || Math.max(700, String(st.text || '').length * 55) + 160)); }

/* ── 렌더 3종 ── */
const DRAW = { skirmish: drawSkirmish, dq: drawDQ, srw: drawSRW };

function drawBattleBG(kind) {
  const c = G.ctx, sky = G.skyAt(G.kstHour()), gY = G.H - 54, seed = B.bgSeed >>> 0;
  const gr = c.createLinearGradient(0, 0, 0, G.H);
  gr.addColorStop(0, sky.top); gr.addColorStop(0.48, sky.mid); gr.addColorStop(0.72, sky.low); gr.addColorStop(1, '#111a16');
  c.fillStyle = gr; c.fillRect(0, 0, G.W, G.H);
  // 수평 안개와 달빛은 뒤쪽 레이어에만 두어 배우와 HUD의 대비를 남긴다.
  c.fillStyle = 'rgba(174,220,210,.08)'; c.fillRect(0, gY - 92, G.W, 2);
  c.fillStyle = 'rgba(5,10,20,.12)'; c.fillRect(0, gY - 48, G.W, 20);
  if (sky.stars > 0.05) {
    const r = G.rng(7); c.fillStyle = `rgba(230,238,255,${0.75 * sky.stars})`;
    for (let i = 0; i < 40; i++) c.fillRect(Math.floor(r() * G.W), Math.floor(r() * (G.H - 150)), 1, 1);
    const mx = 54 + seed % 110, my = 42 + (seed >>> 7) % 34;
    c.fillStyle = `rgba(210,238,230,${0.18 + sky.stars * 0.28})`; c.fillRect(mx - 4, my - 4, 8, 8);
    c.fillStyle = `rgba(235,250,235,${0.22 + sky.stars * 0.35})`; c.fillRect(mx - 2, my - 2, 4, 4);
  }
  // 아틀라스 풍경은 그대로 반복하고, 부재 시에도 고정 시드 능선으로 세 층 깊이를 유지한다.
  for (let L = 0; L < 3; L++) {
    const spr = G.spr(`bg_${kind}_${L}`);
    const yBase = gY - 66 + L * 24;
    if (spr) {
      const [t, sx, sy, w, h] = spr;
      const start = -((seed >> (L * 3)) % w), dy = yBase - h + 60;
      for (let x = start, i = 0; x < G.W; x += w - 1, i++) {
        const dx = Math.round(x);
        if (kind === 'srw' && (i & 1)) {
          c.save(); c.translate(dx + w + 1, 0); c.scale(-1, 1);
          c.drawImage(G.tex[t], sx, sy, w, h, 0, dy, w + 1, h); c.restore();
        } else c.drawImage(G.tex[t], sx, sy, w, h, dx, dy, w + 1, h);
      }
    } else {
      c.fillStyle = ['#24364a', '#18283a', '#101c2b'][L];
      const r = G.rng(seed + L); c.beginPath(); c.moveTo(0, G.H);
      for (let x = 0; x <= G.W; x += 40) c.lineTo(x, yBase - r() * 34);
      c.lineTo(G.W, G.H); c.fill();
    }
  }
  c.fillStyle = 'rgba(110,190,160,.08)'; c.fillRect(0, gY - 10, G.W, 10);
  c.fillStyle = '#14221a'; c.fillRect(0, gY, G.W, G.H - gY);
  c.fillStyle = '#07100c'; c.fillRect(0, gY, G.W, 2);
  c.fillStyle = '#2d4930'; c.fillRect(0, gY + 2, G.W, 1);
  const rg = G.rng(seed ^ 0x51);
  c.fillStyle = '#243b25';
  for (let i = 0; i < 58; i++) {
    const gx = Math.floor(rg() * G.W), gy = gY + 3 + Math.floor(rg() * 46);
    c.fillRect(gx, gy, 2, 1);
    if (rg() > 0.55) c.fillRect(gx + 1, gy - 2, 1, 2);
    if (rg() > 0.82) { c.fillStyle = '#5c7145'; c.fillRect(gx - 1, gy + 3, 2, 1); c.fillStyle = '#243b25'; }
  }
}

function drawActorFloor(a, target) {
  const c = G.ctx, b = actorBox(a), rx = Math.max(10, Math.round(b.w * 0.38)), ry = Math.max(3, Math.round(rx * 0.28));
  c.fillStyle = 'rgba(3,7,12,.56)'; c.beginPath(); c.ellipse(a.x, b.b + 2, rx, ry, 0, 0, 7); c.fill();
  if (target) {
    c.strokeStyle = target === 'foe' ? 'rgba(255,127,106,.78)' : 'rgba(95,208,127,.64)';
    c.beginPath(); c.ellipse(a.x, b.b + 1, Math.max(8, rx - 3), Math.max(2, ry - 1), 0, 0, 7); c.stroke();
  }
}
function drawActors() {
  for (const k of ['foe2', 'foe', 'merc', 'hero']) {
    const a = B.actors[k]; if (a) drawActorFloor(a, !a.dead && (k === 'foe' ? 'foe' : k === 'hero' ? 'hero' : ''));
  }
  for (const k of ['foe2', 'foe', 'merc', 'hero']) {
    const a = B.actors[k]; if (!a) continue;
    const blink = a.hurtT > 0 && Math.floor(a.hurtT * 30) % 2;   // 피격 점멸 = 감쇠(완전 비가시 금지)
    a.anim.draw(a.x, a.y, { flip: a.flip, scale: a.scale, alpha: a.alpha * (blink ? 0.35 : 1) });
  }
  drawFxs();
}
function drawFxs() {
  const c = G.ctx;
  for (const f of B.fxs) {
    c.fillStyle = 'rgba(174,232,255,.10)'; c.beginPath(); c.ellipse(f.x, f.y + 2, 8 * f.scale, 4 * f.scale, 0, 0, 7); c.fill();
    f.anim.draw(f.x, f.y, { scale: f.scale, flip: f.flip });
  }
  G.drawParts(1);                                        // spawnFx 파편 파티클 — 전투 씬 공통 draw (v2.3 결함 수정)
}

function drawHUD() {
  const c = G.ctx;
  // HP 바와 식별자를 같은 고대비 창에 묶어 배경·연출 위에서도 즉시 읽힌다.
  G.win(8, 8, 150, 43, { bg: 'rgba(6,13,18,.94)', border: '#5fd07f' });
  G.text('수호자', 14, 12, { size: 9, color: '#cfe0ff', outline: '#000c' });
  c.fillStyle = '#14231d'; c.fillRect(14, 24, 138, 8); c.fillStyle = '#07100c'; c.fillRect(15, 25, 136, 6);
  c.fillStyle = B.heroHP > 0.4 ? '#5fd07f' : '#ffd23b'; c.fillRect(15, 25, Math.round(136 * B.heroHP), 6);
  c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(15, 25, Math.round(136 * B.heroHP), 1);
  G.win(G.W - 158, 8, 150, 43, { bg: 'rgba(22,8,14,.94)', border: '#ff7f6a' });
  const extraN = B.mode === 'dq' && B.wave && B.wave.foes.length > 1
    ? ` 외 ${Math.min(2, B.wave.foes.length - 1)}` : '';
  G.text(G.trunc(B.foe.name, 14) + extraN, G.W - 152, 12, { size: 9, color: '#ffd6c8', outline: '#000c' });
  c.fillStyle = '#2a1620'; c.fillRect(G.W - 152, 24, 138, 8); c.fillStyle = '#13070c'; c.fillRect(G.W - 151, 25, 136, 6);
  c.fillStyle = '#ff7f6a'; c.fillRect(G.W - 151, 25, Math.round(136 * B.foeHP), 6);
  c.fillStyle = 'rgba(255,240,220,.28)'; c.fillRect(G.W - 151, 25, Math.round(136 * B.foeHP), 1);
  G.text(`${G.flagCC(B.foe.cc)} ${G.actorAlias(B.foe.ip)}`, G.W - 152, 40, { size: 9, color: '#c6d6e8', outline: '#000c' });
  drawBattleOverlay();
}

/* 팝업/투사체/대사/컷인/리절트 — 모드 공통 오버레이 (fps 는 자체 HUD + 이것만 사용) */
function drawBattleOverlay() {
  if (B.wave && B.wave.replay)
    G.text('~ 지난 침입 재연 ~', G.W / 2, 8, { size: 9, color: '#c6d6e8', align: 'center', outline: '#000c' });
  // 팝업
  for (const p of B.popups) {
    if (p.ghost) { if (p.t >= 0) p.ghost.anim.draw(p.x, p.y + 26, { alpha: 0.25, flip: p.ghost.flip }); continue; }
    const y = p.y - p.t * 26;
    G.text(p.txt, p.x, y, { size: p.txt.length > 3 ? 9 : 18, color: p.c, align: 'center', outline: '#000c' });
  }
  // 투사체는 1px 잔상으로 방향을 읽히게 하고 스프라이트가 있으면 그대로 우선한다.
  for (const p of B.projectiles) {
    const k = Math.min(1, p.t / p.ms), x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * 24;
    const tx = p.x0 + (p.x1 - p.x0) * Math.max(0, k - 0.06), ty = p.y0 + (p.y1 - p.y0) * Math.max(0, k - 0.06) - Math.sin(Math.max(0, k - 0.06) * Math.PI) * 24;
    G.ctx.strokeStyle = 'rgba(255,224,127,.45)'; G.ctx.beginPath(); G.ctx.moveTo(tx, ty); G.ctx.lineTo(x, y); G.ctx.stroke();
    if (G.spr(p.spr)) G.drawSpr(p.spr, x, y, {});
    else { G.ctx.fillStyle = '#ffe07f'; G.ctx.fillRect(Math.round(x), Math.round(y), 3, 3); }
  }
  // 대사 윈도우 (fps 는 하단 HUD 밴드 위로 상향)
  if (B.say) {
    const w = 300, x = (G.W - w) / 2, isFoe = B.say.who === 'foe';
    const sy = B.mode === 'fps' ? G.H - 96 : G.H - 60, accent = isFoe ? '#ff7f6a' : '#7fd8ff';
    G.win(x, sy, w, 48, { bg: 'rgba(5,10,22,.96)', border: accent });
    G.ctx.fillStyle = accent; G.ctx.fillRect(x + 5, sy + 5, 2, 38);
    G.text(B.say.name, x + 12, sy + 4, { size: 9, color: isFoe ? '#ffb0a0' : '#a8e5ff', outline: '#000c' });
    const shown = G.sceneText(B.say.text);
    G.text(shown.slice(0, B.msgCh), x + 12, sy + 19, { size: 9, color: '#efe9da', outline: '#000c' });
  }
  // 컷인 (슈로대풍 배너 밴드 — 필드 위 무배경 확대 금지, 슬라이드 인/아웃)
  if (B.cutin) {
    const c = G.ctx, side = B.cutin.side === 'foe' ? 1 : 0;
    const a = B.actors[B.cutin.side];
    const tIn = Math.min(1, B.cutin.t / 0.22), kIn = 1 - (1 - tIn) ** 3;
    const kOut = B.cutin.out ? Math.min(1, (B.cutin.t - B.cutin.out) / 0.18) ** 2 : 0;
    if (a && kOut < 1) {
      const y0 = Math.round(G.H / 2) - 73, bh = 106, dir = side ? 1 : -1;
      const off = Math.round(dir * ((1 - kIn) * 200 + kOut * 160));
      c.save(); c.globalAlpha = Math.min(1, tIn * 2.5) * (1 - kOut);
      const grd = c.createLinearGradient(0, y0, 0, y0 + bh);
      grd.addColorStop(0, 'rgba(4,7,18,.98)'); grd.addColorStop(0.5, 'rgba(14,21,42,.96)'); grd.addColorStop(1, 'rgba(5,7,18,.98)');
      c.fillStyle = grd; c.fillRect(0, y0, G.W, bh);
      c.fillStyle = side ? '#ff9f8a' : '#8ad0ff';
      c.fillRect(0, y0, G.W, 2); c.fillRect(0, y0 + bh - 2, G.W, 2);
      c.beginPath(); c.rect(0, y0 + 2, G.W, bh - 4); c.clip();
      c.strokeStyle = 'rgba(255,255,255,.10)';
      const sl = (B.cutin.t * 260) % 48;
      for (let x = -60 + sl; x < G.W + 60; x += 48) {
        c.beginPath(); c.moveTo(x + off, y0); c.lineTo(x - 26 + off, y0 + bh); c.stroke(); }
      // 초상: pt_* 우선, 없으면 스프라이트를 밴드 안 목표 높이로 정규화
      const px = (side ? G.W - 92 : 92) + off, flip = side ? !0 : !1;
      const pt = 'pt_' + (side ? B.foe.sp : 'guardian');
      if (G.spr(pt)) G.drawSpr(pt, px, y0 + bh - 8, {});
      else { const raw = actorBox(a).h / (a.scale || 1);
        a.anim.draw(px, y0 + bh - 8, { flip, scale: Math.max(1.2, Math.min(2.5, 84 / Math.max(20, raw))) }); }
      // 명판
      const nx = (side ? 16 : G.W - 16) + off, al = side ? 'left' : 'right';
      G.text(side ? '침입자' : '수호자', nx, y0 + 30, { size: 9, color: side ? '#ff9f8a' : '#8ad0ff', align: al, outline: '#000c' });
      G.text(side ? B.foe.name : G.titleOf(G.lvlOf(Math.max((G.ST && G.ST.stats.total_events) || 0, G.SAVE.bestXp || 0))),
        nx, y0 + 44, { size: 18, color: '#efe9da', align: al, outline: '#000c' });
      c.restore();
    }
  }
  if (B.result === 'win') {
    const wy = Math.round(G.H / 2) - 61;
    G.win(G.W / 2 - 80, wy, 160, 40, { bg: 'rgba(10,16,26,.96)', border: '#ffd23b' });
    G.text('침공 격퇴!', G.W / 2, wy + 8, { size: 18, color: '#ffd23b', align: 'center', outline: '#000' });
    G.text(B.wave && B.wave.replay ? '기록 재연 · 전과 미집계' : `+${B.foe.xp} XP`,
      G.W / 2, wy + 26, { size: 9, color: '#cfe0ff', align: 'center', outline: '#000c' });
  }
}

function drawSkirmish() {
  // 마을을 배경으로 하단 밴드 사이드뷰
  const v = G.sceneMap.village; v && v.drawBase && v.drawBase(0.45);
  const c = G.ctx, y0 = G.H - 100;
  c.fillStyle = 'rgba(5,9,19,.87)'; c.fillRect(0, y0, G.W, 100);
  c.fillStyle = '#0b160f'; c.fillRect(0, G.H - 30, G.W, 30);
  c.fillStyle = '#31582d'; c.fillRect(0, G.H - 30, G.W, 1);
  c.fillStyle = '#cfe0ff'; c.fillRect(0, y0, G.W, 1);
  drawActors(); drawHUD();
  G.text('국지전', 10, y0 + 6, { size: 9, color: '#c6d6e8', outline: '#000c' });
}

function drawDQ() {
  const c = G.ctx, winB = G.H - 104;
  c.fillStyle = '#05060f'; c.fillRect(0, 0, G.W, G.H);
  // 지면 패턴 + 비네트
  const r = G.rng(B.bgSeed); c.fillStyle = '#10142a';
  for (let i = 0; i < 60; i++) c.fillRect(Math.floor(r() * G.W), G.H - 120 + Math.floor(r() * 90), 2, 1);
  // 풍경 창은 이중 테두리와 얇은 빛선으로 분리해, 뒤 풍경과 전투 대상을 함께 읽게 한다.
  G.win(40, 36, G.W - 80, winB - 36, { bg: '#0a0d1e', border: '#6a7280' });
  c.fillStyle = '#7fd8ff'; c.fillRect(44, 40, G.W - 88, 1);
  c.save(); c.beginPath(); c.rect(43, 39, G.W - 86, winB - 42); c.clip();
  c.translate(0, -36);
  drawBattleBG(['forest', 'mount', 'ruins'][(B.bgSeed >>> 0) % 3]);
  c.restore();
  c.save(); c.beginPath(); c.rect(43, 39, G.W - 86, winB - 42); c.clip();
  c.fillStyle = 'rgba(5,8,20,.31)'; c.fillRect(43, 39, G.W - 86, winB - 42);
  c.fillStyle = '#385374'; c.fillRect(43, winB - 6, G.W - 86, 1);
  c.restore();
  // 발밑 타원(DQ 무대 바닥) — 사이드 몬스터 있으면 확대
  const wide = B.actors.foeL || B.actors.foeR;
  const erx = wide ? 96 : 72;
  c.fillStyle = '#0a1220'; c.beginPath(); c.ellipse(G.W / 2, winB + 10, erx, 13, 0, 0, 7); c.fill();
  c.strokeStyle = '#426078'; c.beginPath(); c.ellipse(G.W / 2, winB + 10, erx, 13, 0, 0, 7); c.stroke();
  for (const k of ['foeL', 'foeR', 'foe', 'merc', 'hero']) {
    const a = B.actors[k]; if (a) drawActorFloor(a, !a.dead && (k === 'foe' ? 'foe' : k === 'hero' ? 'hero' : ''));
  }
  // 사이드 몬스터 (표시 전용, 페인터 순서 = 중앙보다 먼저) — 중앙 격파 시 도주(비표시)
  const foe = B.actors.foe;
  if (foe && !foe.dead) for (const k of ['foeL', 'foeR']) {
    const s = B.actors[k]; if (!s) continue;
    const bob2 = Math.sin(performance.now() / 520 + (k === 'foeL' ? 1.1 : 2.3)) > 0 ? 1 : 0;
    s.anim.draw(s.x, s.y + bob2, { scale: s.scale });
  }
  // 정면 몬스터 = 정수 확대 + 1px 숨쉬기(인코딩 시 픽셀 경계 떨림 방지)
  if (foe && !foe.dead) {
    const bob = Math.sin(performance.now() / 460) > 0 ? 1 : 0;
    const blink = foe.hurtT > 0 && Math.floor(foe.hurtT * 30) % 2;
    foe.anim.draw(foe.x, foe.y + bob, { scale: foe.scale, alpha: blink ? 0.35 : 1 });
  } else if (foe && foe.dead) { /* 사망 후 빈 무대 */ }
  const merc = B.actors.merc;
  if (merc) merc.anim.draw(merc.x, merc.y, { flip: merc.flip });
  const hero = B.actors.hero;                          // 하단 좌측 아군석 — 영웅 실표시 (구 -999 비표시 폐지)
  if (hero) {
    const blink = hero.hurtT > 0 && Math.floor(hero.hurtT * 30) % 2;
    hero.anim.draw(hero.x, hero.y, { flip: hero.flip, alpha: blink ? 0.35 : 1 });
  }
  drawFxs();
  drawHUD();
}

function drawSRW() {
  drawBattleBG(['forest', 'mount', 'ruins'][(B.bgSeed >>> 0) % 3]);
  drawActors(); drawHUD();
}
