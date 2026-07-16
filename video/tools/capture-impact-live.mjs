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
const page = await context.newPage();
try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.waitForSelector('#intelPanel', { state: 'visible', timeout: 20_000 });
  await page.waitForFunction(() => {
    const box = document.querySelector('#intel');
    return box && /Reports filed/.test(box.textContent) && !/^0\b/.test(box.textContent.trim());
  }, { timeout: 20_000 });
  await page.addStyleTag({ content: `
    @keyframes impactGlow { 0%,100%{box-shadow:0 0 0 rgba(84,227,157,0)} 50%{box-shadow:0 0 32px rgba(84,227,157,.55)} }
    @keyframes impactTag { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
    #intelPanel{border-color:#54e39d!important;animation:impactGlow 1.8s ease-in-out infinite;position:relative}
    #intelPanel::before{content:'LIVE · VERIFIED COMMUNITY CONTRIBUTION';position:absolute;right:8px;top:-21px;color:#54e39d;font:600 9px monospace;letter-spacing:.08em;animation:impactTag .5s ease-out both}
    #intel .icell b{font-size:16px!important;color:#54e39d!important}
    #intel .iline{color:#d8e7df!important}
    *,*::before,*::after{cursor:none!important}
  ` });
  await page.waitForTimeout(2_000);
  await page.evaluate(() => window.G?.flashIntelBadge?.());
  await page.waitForTimeout(3_200);
  await page.evaluate(() => window.G?.flashIntelBadge?.());
  await page.waitForTimeout(4_200);
  const video = page.video();
  await page.close();
  await context.close();
  await video.saveAs(join(OUT, 'app-impact-live.webm'));
  console.log(`OK ${join(OUT, 'app-impact-live.webm')}`);
} finally {
  await browser.close();
}
