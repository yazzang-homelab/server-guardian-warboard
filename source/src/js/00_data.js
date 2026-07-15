/* ═══════════════════════════════════════════════════════════════
   00_data — 데이터 레이어 (방어용 honeypot 포획 로그 시각화 전용)
   · 읽기전용: /api/threat GET 폴링만. 쓰기 경로 없음.
   · 공격자 입력(ip/user/pass/cmd/url)은 반드시 esc()/textContent/캔버스 fillText로만 렌더.
   ═══════════════════════════════════════════════════════════════ */
'use strict';
const G = window.G = {};
G.$ = id => document.getElementById(id);

/* ── 무해화 유틸 ── */
G.esc = s => String(s ?? '').replace(/[<>&"'`]/g, m => ({
  '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;','`':'&#96;'}[m]));
G.defang = u => String(u || '').replace(/^https?:\/\//i, 'hxxp://').replace(/\./g, '[.]');
G.trunc = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n) + '…' : s; };
G.hashIP = s => { let h = 2166136261; s = String(s || '?');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0; };

/* ── 국가 ── */
G.flagCC = cc => {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return '🌐';
  const A = 0x1F1E6, u = cc.toUpperCase();
  return String.fromCodePoint(A + u.charCodeAt(0) - 65, A + u.charCodeAt(1) - 65);
};
G.NAME2CC = {'China':'CN','Hong Kong':'HK','United States':'US','Sweden':'SE','United Kingdom':'GB',
  'Russia':'RU','Netherlands':'NL','The Netherlands':'NL','Germany':'DE','France':'FR','India':'IN',
  'Brazil':'BR','Vietnam':'VN','Singapore':'SG','Japan':'JP','South Korea':'KR','Korea':'KR',
  'Indonesia':'ID','Iran':'IR','Ukraine':'UA','Turkey':'TR','Canada':'CA','Taiwan':'TW','Thailand':'TH',
  'Bulgaria':'BG','Romania':'RO','Poland':'PL','Lithuania':'LT','Seychelles':'SC','Panama':'PA',
  'Moldova':'MD','UNKNOWN':''};

/* ── 시간/하늘 ── */
G.kstHour = () => { const d = new Date(); return (d.getUTCHours() + 9 + d.getUTCMinutes() / 60) % 24; };
G.lerpHex = (a, b, t) => {
  const pa = [1,3,5].map(i => parseInt(a.slice(i,i+2),16)), pb = [1,3,5].map(i => parseInt(b.slice(i,i+2),16));
  return '#' + pa.map((v,i) => Math.round(v + (pb[i]-v)*t).toString(16).padStart(2,'0')).join('');
};
G.SKY_KEYS = [ // [KST시, 상, 중, 하, 별]
  [0.0,'#070a14','#0d1326','#161c33',1],[4.5,'#0a0e1e','#131a30','#1d2338',0.9],
  [6.0,'#2a2340','#6b3a55','#c9764f',0.25],[7.5,'#28405e','#48688f','#7d9cc0',0],
  [12.0,'#2d4a6d','#52709d','#86a5c9',0],[16.5,'#2a3a58','#5d5a80','#a06a58',0],
  [18.5,'#20263f','#7a3d52','#e08a4a',0.2],[20.0,'#0c1020','#111830','#1a2036',0.85],
  [24.0,'#070a14','#0d1326','#161c33',1]];
G.skyAt = h => {
  const K = G.SKY_KEYS; let i = 0;
  while (i < K.length - 1 && K[i+1][0] <= h) i++;
  const a = K[i], b = K[Math.min(i+1, K.length-1)], t = b[0] === a[0] ? 0 : (h - a[0]) / (b[0] - a[0]);
  return { top: G.lerpHex(a[1],b[1],t), mid: G.lerpHex(a[2],b[2],t), low: G.lerpHex(a[3],b[3],t),
           stars: a[4] + (b[4]-a[4]) * t, h };
};

/* ── 종족 모델 v2 (스프라이트 키 = 아틀라스 애니 접두어) ── */
G.GENERIC = ['skeleton','goblin','mushroom','flyeye','mimic','rat','slime','bat','worm'];
G.NAMED = ['king','sorcerer','golem','alphabat'];
G.SPEC = {
  skeleton:{ko:'해골 병사'}, goblin:{ko:'고블린 정찰꾼'}, mushroom:{ko:'독버섯 괴수'},
  flyeye:{ko:'감시 눈알'}, mimic:{ko:'미믹 상자'}, rat:{ko:'시궁쥐 도적'},
  slime:{ko:'슬라임'}, bat:{ko:'동굴 박쥐'}, worm:{ko:'화염 지렁이'},
  wraith:{ko:'정체불명 망령', named:1},
  king:{ko:'무법자 왕', named:1}, sorcerer:{ko:'채굴 마도사', named:1},
  golem:{ko:'드로퍼 골렘', named:1}, alphabat:{ko:'군체 대박쥐', named:1},
};
G.EPITHET = ['끈질긴','허접한','졸린','성난','배고픈','수상한','근성의','덜렁이','음침한','촉촉한',
  '바쁜','뻔뻔한','기름진','서투른','집요한','미련한'];

/* 페이로드 시그니처 → 네임드 (포획 로그 분류 표기용) */
G.sigOf = ip => {
  const ST = G.ST;
  if (!ST || !Array.isArray(ST.payloads)) return null;
  const c = ST.payloads.filter(p => p.src === ip).map(p => String(p.cmd || '')).join(' ').toLowerCase();
  if (!c) return null;
  if (c.includes('mdrfckr') || c.includes('authorized_keys')) return 'king';
  if (c.includes('xmrig') || c.includes('miner') || c.includes('mining')) return 'sorcerer';
  if ((c.includes('wget') || c.includes('curl')) && (c.includes('.sh') || c.includes('.tgz') || c.includes('chmod'))) return 'golem';
  if (c.includes('busybox') || c.includes('mirai')) return 'alphabat';
  return 'wraith';
};
G.speciesOf = b => {
  if (b.payload) { const s = G.sigOf(b.ip); if (s) return s; }
  return G.GENERIC[G.hashIP(b.ip) % G.GENERIC.length];
};
G.makeFoe = b => {
  const sp = G.speciesOf(b), h = G.hashIP(b.ip);
  const named = !!G.SPEC[sp].named;
  const tier = named ? 'named' : (b.count > 30 ? 'boss' : (b.count > 3 ? 'elite' : 'mob'));
  const name = named ? G.SPEC[sp].ko : G.EPITHET[h % G.EPITHET.length] + ' ' + G.SPEC[sp].ko;
  return { ip: b.ip, cc: b.cc || '', sp, h, tier, name,
           xp: Math.max(1, b.count | 0), payload: !!b.payload, variant: (h >>> 8) % 3 };
};

/* ── 세이브 (v1 마이그레이션 + 데모 격리) ── */
G.DEMO = /[?&]demo\b/.test(location.search);
G.demoKind = (() => { const m = location.search.match(/[?&]demo=(skirmish|dq|srw|fpss|fpsm|fps)/); return m ? m[1] : null; })();
G.demoWpn = { fps: 'xbow', fpss: 'sword', fpsm: 'magic' }[G.demoKind] || null;   // fps 무기 강제 (QA/미리보기)
const MIG = {slime:'slime',goblin:'goblin',wisp:'flyeye',bat:'bat',mush:'mushroom',crab:'mimic',
  ghost:'wraith',outlaw:'king',miner:'sorcerer',golem:'golem',mirai:'alphabat'};
G.loadSave = () => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem('phn_rpg_v2') || 'null'); } catch (e) {}
  if (!s) {
    s = { bestXp: 0, seen: {}, kills: 0, waves: 0 };
    try {
      const v1 = JSON.parse(localStorage.getItem('phn_rpg_v1') || 'null');
      if (v1) {
        s.bestXp = v1.bestXp || 0; s.kills = v1.kills || 0;
        for (const k in (v1.seen || {})) if (MIG[k]) s.seen[MIG[k]] = 1;
        s.migrated = 1;
      }
    } catch (e) {}
  }
  return s;
};
G.SAVE = G.loadSave();
G.save = () => { if (G.DEMO) return; /* 데모는 읽기전용 — 도감/전적 오염 금지 */
  try { localStorage.setItem('phn_rpg_v2', JSON.stringify(G.SAVE)); } catch (e) {} };

/* ── 성장 ── */
G.TITLES = [[1,'떠돌이 파수꾼'],[3,'견습 수호자'],[6,'정식 수호자'],[10,'늪의 명인'],[15,'미끼술사'],
  [20,'서버 성기사'],[28,'불침번 대공'],[38,'전설의 수호자'],[55,'살아있는 방화벽']];
G.lvlOf = xp => Math.max(1, Math.floor(Math.sqrt(xp / 20)) + 1);
G.xpAt = l => 20 * (l - 1) * (l - 1);
G.titleOf = l => { let t = G.TITLES[0][1]; for (const [tl, tn] of G.TITLES) if (l >= tl) t = tn; return t; };
G.costumeOf = l => l < 5 ? 1 : l < 10 ? 2 : l < 20 ? 3 : l < 35 ? 4 : 5;
G.COSTUME_KO = {1:'낡은 여행자', 2:'초록 순찰대', 3:'푸른 기사단', 4:'황금 성기사', 5:'전설의 수호자'};
G.SKILLS = [
  ['🎣','미끼술', s => s.stats.sessions >= 50, '늪 세션 50'],
  ['🕸','늪 강화', s => s.stats.total_events >= 1000, '흡수 1,000'],
  ['⛓','포획 결계', s => s.stats.blocked >= 10, '포획 10'],
  ['👁','감식안', () => Object.keys(G.SAVE.seen).length >= 7, '도감 7종'],
  ['🏆','전설 수집가', () => G.NAMED.every(k => G.SAVE.seen[k]), '네임드 완집'],
];

/* ── 분위기(구 DEFCON) & 티커 ── */
G.MOODS = {5:['모닥불이 고요히 탄다','평온 · 봇 없음'],4:['숲이 조금 수상하다','경계 · 몇 놈 왔다감'],
  3:['몬스터 기척이 잦다','주의 · 바글바글'],2:['침공 러시!','심각 · 떼로 몰려옴'],
  1:['대격전!!','교전 중 · 아주 신났네']};
G.TAUNTS = [
  '🎣 어서 와, 여긴 함정이야 — 진짜 서버는 딴 데 있음',
  '💸 니 AI 에이전트 토큰, 지금 이 화면 읽느라 잘 타고 있니?',
  '⚔️ 몬스터 여러분, 오늘도 경험치 셔틀 감사합니다',
  '🐌 천천히 읽어… 1분에 몇 글자씩 정성껏 보내주는 중',
  '📸 니 IP랑 때린 명령어 전부 도감에 박제 완료. 웃어',
  '🔒 root 비번 맞췄다고? 축하해, 근데 그거 가짜야',
  '🏕️ 서울 야영지에서 인사한다 봇아, 오늘도 수고가 많다',
  '🧨 wget 한 그 악성코드 주소? 우리가 안 눌러줘서 미안',
  '🍖 오늘 잡은 봇은 모닥불에 구워서 경험치로 먹었습니다',
  '📉 몬스터 침공 성공률 0%. 꾸준함 하나는 인정',
  '🛡️ 수호자는 오늘도 무패. 애초에 문이 가짜라서 그래',
];

/* ── 이벤트 버스 ── */
G.bus = (() => { const m = {}; return {
  on: (k, f) => (m[k] = m[k] || []).push(f),
  emit: (k, ...a) => (m[k] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } }),
}; })();

/* ── 전투 시간 예산 (불멍 보장: 최근 60s 중 전투 ≤40%) ── */
G.combat = { log: [], busy: false };
G.combatSpent = () => {
  const now = performance.now(), cut = now - 60000;
  G.combat.log = G.combat.log.filter(x => x[1] > cut);
  return G.combat.log.reduce((a, x) => a + (Math.min(now, x[1]) - Math.max(cut, x[0])), 0) / 60000;
};
G.combatMark = (t0, t1) => { G.combat.log.push([t0, t1]); };

/* ── 폴링 + 웨이브 병합 ── */
G.ST = null;
G.TOP3 = [];                // 침입 횟수 상위 3 (처형대 효수 랭킹 — poll 이 count desc 캐시)
G.queue = [];               // 웨이브 큐 (각 항목 = {foes:[], top:foe, ts})
let lastFeedKey = '', firstPoll = true;
G.poll = async () => {
  let s;
  try { s = await (await fetch('/api/threat', { cache: 'no-store' })).json(); }
  catch (e) { G.bus.emit('offline'); return; }
  G.ST = s;
  // fresh 이벤트 감지 (v1과 동일: feed 최신키 비교) → 이번 폴링분 전체를 1개 웨이브로
  const feed = Array.isArray(s.feed) ? s.feed : [];
  const key = feed.length ? feed[0].ts + '|' + feed[0].src : '';
  let freshList = [];
  if (!firstPoll && key && key !== lastFeedKey) {
    for (const ev of feed) {
      if (ev.ts + '|' + ev.src === lastFeedKey) break;
      freshList.push(ev);
      if (freshList.length >= 12) break;
    }
  }
  lastFeedKey = key || lastFeedKey; firstPoll = false;
  if (freshList.length) {
    // src별 집계 → blips에서 상세 보강 → foe 목록
    const byIp = new Map();
    for (const ev of freshList) if (ev.src && !byIp.has(ev.src)) byIp.set(ev.src, ev);
    const blipOf = ip => (s.blips || []).find(b => b.ip === ip);
    const foes = [...byIp.values()].map(ev => {
      const b = blipOf(ev.src) || {};
      return G.makeFoe({ ip: ev.src, cc: ev.cc || b.cc, count: b.count || 1, payload: !!b.payload });
    });
    if (foes.length) {
      const rank = { named: 4, boss: 3, elite: 2, mob: 1 };
      foes.sort((a, b2) => rank[b2.tier] - rank[a.tier] || b2.xp - a.xp);
      // 큐 폭주 방지: 대기 2개 초과면 병합(최상위 웨이브만 유지)
      if (G.queue.length >= 2) { G.queue[G.queue.length - 1].foes.push(...foes); G.queue[G.queue.length - 1].top = G.queue[G.queue.length - 1].foes[0]; }
      else G.queue.push({ foes, top: foes[0], ts: Date.now() });
      G.bus.emit('wave');
    }
  }
  // 처형대 랭킹 캐시 — 4s 폴링당 1회 정렬(blips ≤60)이라 비용 무시 가능
  const t3 = [...(s.blips || [])].filter(b => b && b.ip)
    .sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 3);
  if (t3.map(b => b.ip).join('|') !== G.TOP3.map(b => b.ip).join('|')) { G.TOP3 = t3; G.bus.emit('top3'); }
  else G.TOP3 = t3;
  G.bus.emit('state', s);
};
