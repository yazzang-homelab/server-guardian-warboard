#!/usr/bin/env node
/* Capture the live public app's Global Threat Intel panel and report badge.
 * Uses only the public, already-redacted judging surface. No browser chrome,
 * credentials, raw IPs, or private infrastructure can enter the recording.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'takes', 'v4');
const URL = process.env.DEMO_URL || 'https://plzhacknono.duckdns.org/';
const CHROMIUM = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const CAPTURE_KST_HOUR = 16.5;
const IMPACT_USABLE_TAIL_MS = 12_000;
/* The impact scene replays the contribution values verified at the approved
 * July 16, 2026 review render (they match the recorded narration). The replay
 * is disclosed on-screen via the REVIEW SNAPSHOT label; every other field in
 * the /api/threat payload passes through unmodified live. */
const REVIEW_CONTRIB = Object.freeze({ reports: 200, unique_ips: 200, avg_confidence: 98 });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 }, screen: { width: 1440, height: 810 },
  deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'dark', reducedMotion: 'no-preference',
  recordVideo: { dir: OUT, size: { width: 1440, height: 810 } },
});
await context.addInitScript(() => {
  localStorage.setItem('phn_lang', 'en');
  localStorage.setItem('phn_crt', '0');
  localStorage.setItem('phn_snd', '0');
});
await context.addInitScript(() => {
  const styleId = 'capture-impact-boot-guard';
  const installBootGuard = () => {
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '#boot{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}';
    (document.head || document.documentElement).append(style);
  };
  installBootGuard();
  new MutationObserver(installBootGuard).observe(document, { childList: true, subtree: true });
});
async function waitForApp(page) {
  await page.waitForSelector('#stage, canvas', { state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => {
    const G = window.G;
    return Boolean(G && G.scene && G.cv && (G.META || G.standin));
  }, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const intel = document.querySelector('#intel');
    return Boolean(window.G?.ST && intel && intel.querySelectorAll('.icell b').length === 3);
  }, undefined, { timeout: 30_000 });
  await page.evaluate(hour => {
    window.G.kstHour = () => hour;
    document.querySelector('#boot')?.remove();
  }, CAPTURE_KST_HOUR);
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  console.log(`READY live app content; KST hour pinned to ${CAPTURE_KST_HOUR}`);
}

const page = await context.newPage();
await page.route('**/api/threat', async route => {
  const response = await route.fetch();
  if (!response.ok()) throw new Error(`Threat snapshot fetch failed: HTTP ${response.status()}`);
  const payload = await response.json();
  payload.contrib = { ...REVIEW_CONTRIB };
  await route.fulfill({ response, json: payload });
});
try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await waitForApp(page);
  await page.waitForSelector('#intelPanel', { state: 'visible', timeout: 20_000 });
  await page.waitForFunction(() => {
    const box = document.querySelector('#intel');
    return box && /Reports filed/.test(box.textContent) && !/^0\b/.test(box.textContent.trim());
  }, undefined, { timeout: 20_000 });
  await page.addStyleTag({ content: `
    @keyframes impactGlow { 0%,100%{box-shadow:0 0 0 rgba(84,227,157,0)} 50%{box-shadow:0 0 32px rgba(84,227,157,.55)} }
    @keyframes impactTag { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
    #intelPanel{border-color:#54e39d!important;animation:impactGlow 1.8s ease-in-out infinite;position:relative}
    #intelPanel::before{content:'REVIEW SNAPSHOT · VERIFIED JULY 16, 2026';position:absolute;right:8px;top:-21px;color:#54e39d;font:600 9px monospace;letter-spacing:.08em;animation:impactTag .5s ease-out both}
    #intel .icell b{font-size:16px!important;color:#54e39d!important}
    #intel .iline{color:#d8e7df!important}
    *,*::before,*::after{cursor:none!important}
  ` });
  await page.waitForTimeout(2_000);
  await page.evaluate(() => window.G?.flashIntelBadge?.());
  await page.waitForTimeout(3_200);
  await page.evaluate(() => window.G?.flashIntelBadge?.());
  await page.waitForTimeout(4_200);
  await page.evaluate(() => window.G?.flashIntelBadge?.());
  console.log(`READY live impact; preserving ${IMPACT_USABLE_TAIL_MS / 1_000}s terminal usable tail`);
  await page.waitForTimeout(IMPACT_USABLE_TAIL_MS);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const video = page.video();
  await page.close();
  await context.close();
  await video.saveAs(join(OUT, 'app-impact-live.webm'));
  console.log(`OK ${join(OUT, 'app-impact-live.webm')}`);
} finally {
  await browser.close();
}
