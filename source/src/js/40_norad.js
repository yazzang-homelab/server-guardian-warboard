/* ═══════════════════════════════════════════════════════════════
   40_norad — 세계지도 씬(RPG 웜톤) + NORAD 테마 씬(인광 그린)
   WORLD 폴리곤(G_WORLD) 재사용 · 벡터만(아틀라스 예산 0)
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const M = { path: null, pathScale: null, blipPhase: 0 };
/* 지도는 480×270 비례 밴드로 유지(4:3 스테이지에서 세로 왜곡 방지), 세로 중앙 배치 */
const MAPH = 270, MAPY = (G.H - MAPH) / 2;
const projX = lon => (lon + 180) / 360 * G.W;
const projY = lat => MAPY + (90 - lat) / 180 * MAPH;

function worldPath() {
  if (M.path) return M.path;
  const p = new Path2D();
  for (const poly of (window.G_WORLD || [])) {
    for (let i = 0; i < poly.length; i++) {
      const [lon, lat] = poly[i], x = projX(lon), y = projY(lat);
      i ? p.lineTo(x, y) : p.moveTo(x, y);
    }
    p.closePath();
  }
  M.path = p; return p;
}

/* 태양 직하점 → 야간 반구 폴리곤 (터미네이터) */
function nightShade(c, alpha) {
  const d = new Date();
  const doy = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
  const decl = -23.44 * Math.cos(2 * Math.PI / 365 * (doy + 10)) * Math.PI / 180;
  const sunLon = 180 - (d.getUTCHours() + d.getUTCMinutes() / 60) * 15;
  c.fillStyle = `rgba(2,4,12,${alpha})`;
  c.beginPath();
  let first = !0;
  for (let lon = -180; lon <= 180; lon += 4) {
    const ha = (lon - sunLon) * Math.PI / 180;
    let lat = Math.atan(-Math.cos(ha) / Math.tan(decl)) * 180 / Math.PI;
    const x = projX(lon), y = projY(lat);
    first ? c.moveTo(x, y) : c.lineTo(x, y);
    first = !1;
  }
  // 야간측 폐합(북/남 — 태양 적위 부호로)
  const yEdge = decl > 0 ? MAPY + MAPH : MAPY;
  c.lineTo(G.W, yEdge); c.lineTo(0, yEdge);
  c.closePath(); c.fill();
}

function drawArcs(c, color) {
  const st = G.ST; if (!st || !st.blips) return;
  const t = st.target || { lat: 37.5, lon: 127 };
  const tx = projX(t.lon), ty = projY(t.lat);
  M.blipPhase += 0.016;
  const now = Date.now() / 1000;
  for (const b of st.blips.slice(0, 40)) {
    const x = projX(b.lon), y = projY(b.lat);
    const age = now - (Date.parse(b.last_ts || 0) / 1000 || now);
    const hot = age < 900;
    c.globalAlpha = hot ? 0.9 : 0.35;
    c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), 2, 2);
    if (hot) {
      const k = (M.blipPhase * 0.35 + (b.ip ? G.hashIP(b.ip) % 100 / 100 : 0)) % 1;
      const mx = (x + tx) / 2, my = Math.min(y, ty) - 34;
      const qx = (1 - k) ** 2 * x + 2 * (1 - k) * k * mx + k * k * tx;
      const qy = (1 - k) ** 2 * y + 2 * (1 - k) * k * my + k * k * ty;
      c.strokeStyle = color; c.globalAlpha = 0.22; c.beginPath();
      c.moveTo(x, y); c.quadraticCurveTo(mx, my, tx, ty); c.stroke();
      c.globalAlpha = 0.95; c.fillRect(Math.round(qx), Math.round(qy), 2, 2);
    }
  }
  c.globalAlpha = 1;
  // 표적(서울 야영지)
  const pulse = 3 + Math.sin(performance.now() / 300) * 1.5;
  c.strokeStyle = color; c.beginPath(); c.arc(tx, ty, pulse, 0, 7); c.stroke();
  c.fillStyle = '#ffd23b'; c.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3);
}

/* ── RPG 세계지도(웜톤 양피지) ── */
G.regScene('map', {
  draw() {
    const c = G.ctx;
    c.fillStyle = '#151009'; c.fillRect(0, 0, G.W, G.H);
    c.fillStyle = '#3a3020'; c.fill(worldPath());
    c.strokeStyle = '#57472c'; c.lineWidth = 0.5; c.stroke(worldPath());
    nightShade(c, 0.42);
    drawArcs(c, '#ff9f5a');
    G.win(6, 6, 190, 30);
    G.text('침공 경로도', 12, 10, { size: 9, color: '#ffd6a0' });
    const st = G.ST;
    G.text(st ? `활성 몬스터 ${st.blips.length} · ${G.moodOf(st.defcon)[0]}` : '…', 12, 21, { size: 9, color: '#bfa77f' });
  },
});

/* ── NORAD 테마 씬 ── */
G.regScene('norad', {
  draw() {
    const c = G.ctx, P = '#39ff88';
    c.fillStyle = '#020604'; c.fillRect(0, 0, G.W, G.H);
    // 그리드
    c.strokeStyle = 'rgba(57,255,136,.08)';
    for (let x = 0; x < G.W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, G.H); c.stroke(); }
    for (let y = 0; y < G.H; y += 45) { c.beginPath(); c.moveTo(0, y); c.lineTo(G.W, y); c.stroke(); }
    c.fillStyle = 'rgba(57,255,136,.16)'; c.fill(worldPath());
    c.strokeStyle = 'rgba(57,255,136,.55)'; c.lineWidth = 0.5; c.stroke(worldPath());
    nightShade(c, 0.5);
    drawArcs(c, P);
    const st = G.ST;
    // 헤더/DEFCON
    G.text('■ STRATEGIC THREAT DISPLAY — HONEYPOT CAPTURE FEED (READ-ONLY)', 8, 6,
      { size: 9, color: P });
    if (st) {
      const lv = st.defcon;
      for (let i = 5; i >= 1; i--) {
        const x = G.W - 30 * (6 - i) - 8;
        c.strokeStyle = P; c.strokeRect(x + 0.5, 6.5, 24, 14);
        if (i === lv) { c.fillStyle = i <= 2 ? '#ff5a4a' : P; c.fillRect(x + 2, 8, 21, 11);
          c.fillStyle = '#020604'; }
        G.text('' + i, x + 10, 9, { size: 9, color: i === lv ? '#020604' : P });
      }
      G.text(`DEFCON ${lv} · ${st.defcon_label || ''} · EVENTS/1H ${st.events_1h}`, 8, G.H - 16,
        { size: 9, color: P });
    }
  },
});
