/* ═══════════════════════════════════════════════════════════════
   12_audio — 샘플(G_SFX_B64)+신스 이중 SFX 버스
   · 기본 OFF, phn_snd 로 영속(50_ui 토글이 제어) — 자동재생 정책상 제스처 후 unlock
   · 샘플 부재/디코드 실패 시 오실레이터 신스 폴백, 음성류(기합/아나운서)는 대체 없음
   · 스팸 가드: 이름별 최소 간격(gap) + 동시발음 캡(8)
   ═══════════════════════════════════════════════════════════════ */
'use strict';

G.snd = { on: !1, ac: null, buf: {}, ready: !1, acFail: !1, last: {}, live: 0 };

/* 이벤트 → { alt:[샘플 스템(랜덤 선택)], synth:[freq,dur,wave]|null, vol, gap(ms) } */
G.SFXDEF = {
  swing:      { alt: ['swing1', 'swing2'], synth: [320, 0.08, 'square'], vol: 0.45, gap: 70 },
  impact:     { alt: ['impact1', 'impact2'], synth: [180, 0.06, 'square'], vol: 0.5, gap: 60 },
  crit:       { alt: ['crit'], synth: [140, 0.12, 'square'], vol: 0.6, gap: 90 },
  boom:       { alt: ['boom1', 'boom2'], synth: [90, 0.3, 'sawtooth'], vol: 0.55, gap: 120 },
  zap:        { alt: ['zap'], synth: [880, 0.14, 'sawtooth'], vol: 0.5, gap: 90 },
  magic:      { alt: ['magic1'], synth: [660, 0.2, 'sine'], vol: 0.4, gap: 90 },
  arrow:      { alt: ['arrow'], synth: [520, 0.06, 'square'], vol: 0.4, gap: 60 },
  parry:      { alt: ['parry'], synth: [740, 0.09, 'square'], vol: 0.5, gap: 90 },
  kiai:       { alt: ['kiai1', 'kiai2', 'kiai3'], synth: null, vol: 0.55, gap: 260 },
  hurt_h:     { alt: ['hurt_h'], synth: [160, 0.1, 'square'], vol: 0.5, gap: 200 },
  growl:      { alt: ['growl1', 'growl2', 'growl3'], synth: [70, 0.3, 'sawtooth'], vol: 0.5, gap: 400 },
  death:      { alt: ['death_m'], synth: [110, 0.4, 'sawtooth'], vol: 0.5, gap: 300 },
  cutin:      { alt: ['cutin'], synth: [980, 0.12, 'sine'], vol: 0.45, gap: 250 },
  fanfare:    { alt: ['fanfare'], synth: [520, 0.3, 'triangle'], vol: 0.5, gap: 800 },
  ann_fight:  { alt: ['ann_fight'], synth: null, vol: 0.6, gap: 1200 },
  ann_combo:  { alt: ['ann_combo'], synth: null, vol: 0.6, gap: 1200 },
  ann_finish: { alt: ['ann_finish'], synth: null, vol: 0.6, gap: 1500 },
  // 마을 생활음 (은은하게)
  chop:       { alt: ['chop'], synth: [220, 0.05, 'square'], vol: 0.3, gap: 140 },
  mine:       { alt: ['mine_hit'], synth: [260, 0.05, 'square'], vol: 0.3, gap: 140 },
  hammer:     { alt: ['hammer'], synth: [300, 0.05, 'square'], vol: 0.3, gap: 140 },
  drop:       { alt: ['drop2'], synth: [620, 0.06, 'sine'], vol: 0.28, gap: 140 },
  // FPS 씬 (v2.3) — door 는 신스 전용(샘플 0바이트), shot 은 arrow 별칭
  door:       { alt: [], synth: [90, 0.3, 'square'], vol: 0.4, gap: 400 },
  shot:       { alt: ['arrow'], synth: [520, 0.06, 'square'], vol: 0.45, gap: 90 },
  // 마을 생활음 확충 (v2.3.2) — 전부 노이즈 신스(용량 0). freq=필터 중심(>1500 하이패스/<500 로패스/그 외 밴드패스)
  crackle:    { alt: [], synth: [700, 0.09, 'noise'], vol: 0.3, gap: 340 },   // 모닥불 탁탁 (rest/wood)
  sizzle:     { alt: [], synth: [3800, 0.35, 'noise'], vol: 0.22, gap: 450 }, // 요리·제련 지글
  rustle:     { alt: [], synth: [1800, 0.15, 'noise'], vol: 0.22, gap: 320 }, // 채집·벌목 잎 바스락
  splash2:    { alt: [], synth: [420, 0.24, 'noise'], vol: 0.32, gap: 380 },  // 낚시 첨벙
  furnace:    { alt: [], synth: [240, 0.5, 'noise'], vol: 0.24, gap: 650 },   // 화덕 훅- (풀무)
  // UI + 레거시 별칭 (hit/win/note 하위호환)
  ui:         { alt: ['ui'], synth: [660, 0.1, 'sine'], vol: 0.4, gap: 120 },
  note:       { alt: [], synth: [660, 0.15, 'sine'], vol: 0.35, gap: 110 },  // 류트 = 신스 유지
  hit:        { alt: ['impact1'], synth: [180, 0.06, 'square'], vol: 0.5, gap: 60 },
  win:        { alt: ['fanfare'], synth: [520, 0.3, 'triangle'], vol: 0.5, gap: 800 },
};

/* AudioContext 생성 + 임베드 샘플 전체 디코드 (사용자 제스처 후 1회)
   v2.3.1: ready 여도 suspended 면 resume — 소리 ON 상태로 리로드하면 제스처 전
   sfx 호출이 AC 를 suspended 로 만들고, 조기 반환 탓에 이후 제스처가 와도
   영영 resume 되지 않아 전체 무음이 되던 결함 수정. */
G.audioInit = () => {
  if (G.snd.acFail) return;
  if (G.snd.ready) {
    const ac = G.snd.ac;
    if (ac && ac.state !== 'running') ac.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { G.snd.acFail = !0; return; }
    const ac = G.snd.ac = G.snd.ac || new AC();
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    G.snd.ready = !0;
    const src = window.G_SFX_B64 || {};
    for (const k in src)
      fetch(src[k]).then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b))
        .then(buf => { G.snd.buf[k] = buf; }).catch(() => {});
  } catch (e) { G.snd.acFail = !0; }
};

G.sfx = (kind, o) => {
  if (!G.snd.on) return;
  const def = G.SFXDEF[kind] || { alt: [], synth: [300, 0.1, 'sine'], vol: 0.4, gap: 80 };
  const now = performance.now();
  if (now - (G.snd.last[kind] || -1e9) < (def.gap || 60)) return;      // 스팸 가드
  G.snd.last[kind] = now;
  try {
    G.audioInit();
    const ac = G.snd.ac;
    if (!ac) return;
    const names = def.alt || [];
    const nm = names.length ? names[Math.floor(Math.random() * names.length)] : null;
    const buf = nm && G.snd.buf[nm];
    const vol = (def.vol ?? 0.4) * ((o && o.vol) || 1);
    if (buf) {                                                          // 샘플 재생
      if (ac.state !== 'running') return;    // suspended 중 소스 시작 금지 — onended 미발화로 live 누수(→전면 무음) 방지
      if (G.snd.live >= 8) return;                                      // 동시발음 캡
      const s = ac.createBufferSource(), g = ac.createGain();
      s.buffer = buf;
      s.playbackRate.value = 1 + (Math.random() * 0.08 - 0.04);         // ±4% 피치 지터
      g.gain.value = vol * 0.55;
      s.connect(g).connect(ac.destination);
      G.snd.live++;
      s.onended = () => { G.snd.live = Math.max(0, G.snd.live - 1); };
      s.start();
      return;
    }
    if (!def.synth) return;                                             // 음성류는 신스 대체 없음
    let [fq, dur, wave] = def.synth;
    if (wave === 'noise') {                                             // 노이즈 신스 (v2.3.2 — 지글/탁탁/바스락/첨벙)
      const nb = G.snd.noiseBuf || (G.snd.noiseBuf = (() => {
        const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return b; })());
      const s = ac.createBufferSource(); s.buffer = nb; s.loop = !0;
      const f = ac.createBiquadFilter();
      f.type = fq > 1500 ? 'highpass' : fq < 500 ? 'lowpass' : 'bandpass';
      f.frequency.value = fq * (1 + (Math.random() * 0.2 - 0.1));       // ±10% 지터 = 반복 단조로움 방지
      if (f.type === 'bandpass') f.Q.value = 0.9;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.14 * (vol / 0.4), ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      s.connect(f).connect(g).connect(ac.destination);
      s.start(); s.stop(ac.currentTime + dur + 0.02);
      return;
    }
    if (kind === 'note') fq *= [1, 1.189, 1.335, 1.498][Math.random() * 4 | 0];  // 류트 4음계
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = wave; osc.frequency.value = fq;
    if (kind === 'win' || kind === 'fanfare')
      osc.frequency.setValueCurveAtTime([392, 523, 659, 784], ac.currentTime, Math.min(0.28, dur));
    g.gain.setValueAtTime(0.12 * (vol / 0.4), ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(g).connect(ac.destination); osc.start(); osc.stop(ac.currentTime + dur + 0.02);
  } catch (e) { /* headless/미지원 환경 — 무해화 */ }
};
