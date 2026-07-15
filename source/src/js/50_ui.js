/* ═══════════════════════════════════════════════════════════════
   50_ui — HTML 패널(도감/랭킹/기록/전리품)·테마·헤더·부팅
   공격자 데이터는 예외 없이 textContent (HTML 조립 금지)
   ═══════════════════════════════════════════════════════════════ */
'use strict';
const $ = G.$;
const el = (tag, cls, txt) => { const e = document.createElement(tag);
  if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

/* ── 언어 ── */
G.lang = localStorage.getItem('phn_lang') || 'en';
const I18N = {
  en: {
    langBtn: '한국어', title: 'Server Guardian Warboard',
    sub: 'Read-only honeypot event viewer · RPG/NORAD visualization',
    map: 'Map', rpg: 'RPG view', norad: 'NORAD', sndOn: 'Audio on', sndOff: 'Audio off',
    share: 'Share card', status: 'Guardian Status', dex: 'Signal Bestiary',
    rank: 'Activity Ranking', loot: 'Defanged Artifacts', lootNote: 'safe display', feed: 'Event Log',
    tiles: ['Events', 'Unique bots', 'Sessions', 'Auth lures', 'Captures', 'IOCs'],
    ev: { auth: 'auth lure', session: 'captured session', payload: 'payload hint', connect: 'connect' },
    about: '<b>What is this?</b> Server Guardian Warboard is a <b>read-only</b> hackathon viewer that visualizes captured honeypot-style events as an RPG/NORAD dashboard. It redacts public IPs into stable bot aliases, defangs suspicious URLs and commands, and exposes no write actions. · Controls: map/NORAD/theme/audio/share toggles; add ?demo=skirmish|dq|srw|fps|fpss|fpsm for deterministic demo scenes. · Built for OpenAI Build Week with Codex and GPT-5.6.',
    submission: '<h2>OpenAI Build Week Submission Notes</h2><div class="submitgrid"><section><h3>Track</h3><p>Developer Tools. A safe viewer for understanding hostile automation signals without exposing private infrastructure.</p></section><section><h3>How to Test</h3><p>Open this URL, switch between RPG, map, and NORAD views, then try the demo query strings for repeatable judging scenes.</p></section><section><h3>Privacy</h3><p>Public IPs are replaced by bot aliases, host identity is generalized, and suspicious strings are defanged before display.</p></section><section><h3>Codex + GPT-5.6</h3><p>Codex and GPT-5.6 were used to extend the viewer, harden display paths, add deterministic QA checks, and prepare this judging surface.</p></section></div>',
  },
  ko: {
    langBtn: 'English', title: '서버 수호자 워보드',
    sub: '읽기전용 허니팟 이벤트 뷰어 · RPG/NORAD 시각화',
    map: '지도', rpg: 'RPG 화면', norad: 'NORAD', sndOn: '소리 켜짐', sndOff: '소리 꺼짐',
    share: '공유 카드', status: '수호자 상태', dex: '신호 도감',
    rank: '활동 랭킹', loot: '무해화 산출물', lootNote: '안전 표기', feed: '이벤트 로그',
    tiles: ['이벤트', '고유 봇', '세션', '인증 미끼', '포획', 'IOC'],
    ev: { auth: '인증 미끼', session: '세션 포획', payload: '페이로드 힌트', connect: '접속' },
    about: '<b>이 화면은?</b> 서버 수호자 워보드는 해커톤 제출용 <b>읽기전용</b> 뷰어입니다. 허니팟형 이벤트를 RPG/NORAD 대시보드로 시각화하되, 공개 IP는 안정적인 bot 별칭으로 바꾸고 의심 URL·명령은 무해화해서 보여줍니다. 쓰기 동작은 없습니다. · 조작: 지도/NORAD/테마/소리/공유 토글, ?demo=skirmish|dq|srw|fps|fpss|fpsm 로 반복 가능한 데모 장면 확인 · OpenAI Build Week를 위해 Codex와 GPT-5.6으로 준비했습니다.',
    submission: '<h2>OpenAI Build Week 제출 노트</h2><div class="submitgrid"><section><h3>트랙</h3><p>Developer Tools. 사설 인프라 정보를 노출하지 않고 적대적 자동화 신호를 이해하기 위한 안전한 뷰어입니다.</p></section><section><h3>테스트 방법</h3><p>URL을 열고 RPG, 지도, NORAD 화면을 전환한 뒤 데모 쿼리로 반복 가능한 심사용 장면을 확인합니다.</p></section><section><h3>프라이버시</h3><p>공개 IP는 bot 별칭으로 대체하고, 호스트 정체성은 일반화하며, 의심 문자열은 무해화한 뒤 표시합니다.</p></section><section><h3>Codex + GPT-5.6</h3><p>Codex와 GPT-5.6으로 뷰어 확장, 표시 경로 하드닝, 결정론 QA, 심사용 화면 준비를 진행했습니다.</p></section></div>',
  },
};
const T = () => I18N[G.lang] || I18N.en;
G.applyLang = lang => {
  G.lang = lang; try { localStorage.setItem('phn_lang', lang); } catch (e) {}
  const t = T();
  $('btnLang').textContent = t.langBtn; $('appTitle').textContent = t.title; $('appSub').textContent = t.sub;
  $('statusTitle').textContent = t.status; $('dexTitle').textContent = t.dex; $('rankTitle').textContent = t.rank;
  $('lootTitle').textContent = t.loot; $('lootNote').textContent = t.lootNote; $('feedTitle').textContent = t.feed;
  $('btnShare').textContent = t.share; $('about').innerHTML = t.about; $('submission').innerHTML = t.submission;
  if (G.ST) renderPanels(G.ST);
  G.applyTheme(G.theme || 'rpg');
  if (G.snd) $('btnSnd').textContent = G.snd.on ? t.sndOn : t.sndOff;
};

/* ── 테마/뷰 ── */
G.theme = localStorage.getItem('phn_theme') || 'rpg';
G.applyTheme = t => {
  const i = T();
  G.theme = t; try { localStorage.setItem('phn_theme', t); } catch (e) {}
  document.body.dataset.theme = t;
  $('btnTheme').textContent = t === 'norad' ? i.rpg : i.norad;
  G.setScene(t === 'norad' ? 'norad' : 'village');
};
G.toggleMap = () => {
  const i = T();
  if (G.theme === 'norad') return;
  G.setScene(G.sceneName === 'map' ? 'village' : 'map');
  $('btnMap').textContent = G.sceneName === 'map' ? i.rpg : i.map;
};

/* ── 사운드: 12_audio.js (샘플+신스 이중 버스, phn_snd 영속) — 토글은 boot 에서 ── */

/* ── 도감 ── */
const DEX_KEYS = [...G.GENERIC, 'wraith', ...G.NAMED];
function dexThumb(cv, sp, got) {
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = !1;
  c.clearRect(0, 0, cv.width, cv.height);
  const def = G.animDef(sp + '_idle');
  const save = G.ctx; G.ctx = c;                      // drawSpr 재사용
  if (got) { const fr = def ? def.f[0] : sp + '_idle', s = G.spr(fr);
    const sc = s ? Math.min(1, 24 / s[4], 34 / s[3]) : 1;
    G.drawSpr(fr, cv.width / 2, cv.height - 3, { scale: sc, sw: 22, sh: 22 }); }
  else { c.fillStyle = '#1a2030'; c.fillRect(6, 4, cv.width - 12, cv.height - 8);
    c.fillStyle = '#4a5570'; c.font = '16px monospace'; c.textAlign = 'center';
    c.fillText('?', cv.width / 2, cv.height / 2 + 6); }
  G.ctx = save;
}
function renderDex() {
  const box = $('dex'); box.replaceChildren();
  let got = 0;
  for (const sp of DEX_KEYS) {
    const has = !!G.SAVE.seen[sp]; if (has) got++;
    const d = el('div', 'dexcell' + (has ? ' got' : ''));
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30;
    d.append(cv, el('div', 'dn', has ? G.SPEC[sp].ko : '???'));
    if (G.SPEC[sp].named) d.classList.add('named');
    box.append(d);
    dexThumb(cv, sp, has);
  }
  $('dexpct').textContent = `${got}/${DEX_KEYS.length}`;
}

/* ── 패널 (전부 textContent) ── */
function li2(a, b, cls) { const d = el('div', 'row ' + (cls || ''));
  d.append(el('span', 'k', a), el('span', 'v', b)); return d; }
function renderPanels(s) {
  const i18 = T();
  // 상태창
  const xp = Math.max(s.stats.total_events, G.SAVE.bestXp || 0);
  const lv = G.lvlOf(xp), cur = G.xpAt(lv), next = G.xpAt(lv + 1);
  if (xp > (G.SAVE.bestXp || 0)) { G.SAVE.bestXp = xp; G.save(); }
  $('lv').textContent = lv; $('herotitle').textContent = G.titleOf(lv);
  $('xfill').style.width = Math.min(100, Math.round((xp - cur) / (next - cur) * 100)) + '%';
  $('xptxt').textContent = `XP ${xp.toLocaleString()} · 처치 ${G.SAVE.kills || 0}`;
  $('costume').textContent = G.COSTUME_KO[G.costumeOf(lv)];
  const tiles = [[i18.tiles[0], s.stats.total_events], [i18.tiles[1], s.stats.unique_ips],
    [i18.tiles[2], s.stats.sessions], [i18.tiles[3], s.stats.auth_attempts],
    [i18.tiles[4], s.stats.blocked], [i18.tiles[5], s.stats.ioc_urls]];
  const tb = $('tiles'); tb.replaceChildren();
  for (const [k, v] of tiles) { const d = el('div', 'tile');
    d.append(el('b', '', (v ?? 0).toLocaleString()), el('span', '', k)); tb.append(d); }
  const sk = $('skills'); sk.replaceChildren();
  for (const [ic, nm, fn, cond] of G.SKILLS) {
    let got = !1; try { got = fn(s); } catch (e) {}
    const d = el('span', 'skill' + (got ? ' got' : ''), ic + nm);
    d.title = '해금: ' + cond; sk.append(d);
  }
  // 랭킹
  const hb = $('hof'); hb.replaceChildren();
  (s.top_users || []).slice(0, 5).forEach(([u, n], i) =>
    hb.append(li2(`${i + 1}. ${u}`, n + '회', i === 0 ? 'gold' : '')));
  const cb = $('countries'); cb.replaceChildren();
  (s.top_countries || []).slice(0, 5).forEach(([nm, n]) =>
    cb.append(li2(`${G.flagCC(G.NAME2CC[nm] || '')} ${nm}`, n + '')));
  // 전리품(IOC — defang, 비클릭)
  const lb = $('loot'); lb.replaceChildren();
  (s.ioc_urls || []).slice(0, 8).forEach(u => lb.append(el('div', 'ioc', G.trunc(G.defang(u), 52))));
  (s.payloads || []).slice(0, 4).forEach(p =>
    lb.append(el('div', 'ioc cmd', `${p.src} ▸ ${G.trunc(G.defang(p.cmd), 60)}`)));
  // 모험 기록(피드)
  const fb = $('feed');
  const evKo = i18.ev;
  fb.replaceChildren();
  (s.feed || []).slice(0, 14).forEach(ev => {
    const d = el('div', 'fr');
    d.append(el('span', 'ts', (ev.ts || '').slice(11, 19)),
      el('span', 'src', `${G.flagCC(ev.cc)} ${ev.src}`),
      el('span', 'ev', evKo[ev.event] || ev.event || ''),
      ev.user ? el('span', 'usr', G.trunc(ev.user, 14)) : el('span', 'usr', ''));
    fb.append(d);
  });
  $('mood').textContent = (G.MOODS[s.defcon] || G.MOODS[5])[0];
  $('mood').dataset.lv = s.defcon;
}

/* ── 공유 카드 ── */
G.shareCard = () => {
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = 418;
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = !1;
  const s = G.ST || { stats: {} };
  const ko = G.lang === 'ko';
  c.fillStyle = '#0a0d1c'; c.fillRect(0, 0, 800, 418);
  c.strokeStyle = '#e8e4d8'; c.lineWidth = 3; c.strokeRect(8, 8, 784, 402);
  c.fillStyle = '#ffd23b'; c.font = '34px GalmuriPx, monospace';
  c.fillText(ko ? '서버 수호자 워보드 — 오늘의 뷰어 스냅샷' : 'Server Guardian Warboard — viewer snapshot', 30, 60);
  c.fillStyle = '#e6e0d0'; c.font = '22px GalmuriPx, monospace';
  const xp = Math.max(s.stats.total_events || 0, G.SAVE.bestXp || 0);
  const lines = ko ? [
    `LV.${G.lvlOf(xp)} ${G.titleOf(G.lvlOf(xp))}`,
    `이벤트 ${(s.stats.total_events || 0).toLocaleString()} · 데모 처치 ${G.SAVE.kills || 0}`,
    `인증 미끼 ${(s.stats.auth_attempts || 0).toLocaleString()} · 포획 ${s.stats.blocked || 0}`,
    `도감 ${Object.keys(G.SAVE.seen).length}/${DEX_KEYS.length} · IOC ${s.stats.ioc_urls || 0}`,
    '', 'plzhacknono.duckdns.org — 해커톤용 읽기전용 뷰어']
    : [
    `LV.${G.lvlOf(xp)} ${G.titleOf(G.lvlOf(xp))}`,
    `Events ${(s.stats.total_events || 0).toLocaleString()} · demo wins ${G.SAVE.kills || 0}`,
    `Auth lures ${(s.stats.auth_attempts || 0).toLocaleString()} · captures ${s.stats.blocked || 0}`,
    `Bestiary ${Object.keys(G.SAVE.seen).length}/${DEX_KEYS.length} · IOCs ${s.stats.ioc_urls || 0}`,
    '', 'plzhacknono.duckdns.org — read-only hackathon viewer'];
  lines.forEach((t, i) => c.fillText(t, 30, 120 + i * 42));
  // 씬 스냅샷 축소 삽입
  try { c.drawImage(G.cv, 560, 250, 200, 112); c.strokeRect(560, 250, 200, 112); } catch (e) {}
  cv.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'guardian-report.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
};

/* ── 부팅 ── */
G.boot = async () => {
  await G.loadAtlas().catch(e => { console.error(e); G.standin = !0; });
  G.initStage();
  document.fonts && document.fonts.load('9px GalmuriPx').catch(() => {});
  G.setScene('village');
  if (location.hash === '#map') G.toggleMap();
  if (location.hash === '#norad' || G.theme === 'norad') G.applyTheme(G.theme = location.hash === '#norad' ? 'norad' : G.theme);
  G.startLoop();
  // 타자기 티커
  const tk = $('taunt');
  const spanify = t => { const s = el('span', '', t); return s; };
  G.TAUNTS.concat(G.TAUNTS).forEach(t => tk.append(spanify(t)));
  // 버튼
  $('btnMap').onclick = G.toggleMap;
  $('btnLang').onclick = () => G.applyLang(G.lang === 'en' ? 'ko' : 'en');
  $('btnTheme').onclick = () => G.applyTheme(G.theme === 'norad' ? 'rpg' : 'norad');
  const applySnd = () => { const i = T(); $('btnSnd').textContent = G.snd.on ? i.sndOn : i.sndOff; };
  G.snd.on = localStorage.getItem('phn_snd') === '1';
  applySnd();
  if (G.snd.on) {                              // 자동재생 정책 unlock — resume 성공까지 재시도 (v2.3.1)
    const unlock = () => { G.audioInit();
      if (G.snd.ac && G.snd.ac.state === 'running') {
        removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); } };
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  }
  $('btnSnd').onclick = () => { G.snd.on = !G.snd.on;
    try { localStorage.setItem('phn_snd', G.snd.on ? '1' : '0'); } catch (e) {}
    if (G.snd.on) { G.audioInit(); G.sfx('ui'); } applySnd(); };
  $('btnShare').onclick = G.shareCard;
  $('btnCRT').onclick = () => { document.body.classList.toggle('crt');
    try { localStorage.setItem('phn_crt', document.body.classList.contains('crt') ? '1' : '0'); } catch (e) {} };
  if ((localStorage.getItem('phn_crt') ?? (innerWidth > 900 ? '1' : '0')) === '1') document.body.classList.add('crt');
  G.applyLang(G.lang);
  // 시계
  setInterval(() => { const d = new Date();
    $('clock').textContent = new Date(d.getTime() + 9 * 36e5).toISOString().slice(5, 19).replace('T', ' ') + ' KST';
  }, 1000);
  // 데이터
  G.bus.on('state', renderPanels);
  G.bus.on('victory', () => { renderDex(); G.sfx('win'); });
  renderDex();
  G.poll(); setInterval(G.poll, 4000);
};
addEventListener('DOMContentLoaded', G.boot);
