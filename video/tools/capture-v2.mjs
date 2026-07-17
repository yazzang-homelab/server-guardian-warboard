#!/usr/bin/env node
/* Deterministic 1080p capture for the v2 Build Week video.
 * Every app take uses a fresh browser context. Only the page viewport is
 * captured; browser chrome, profiles, and unrelated tabs never enter a take. */
import { chromium } from 'playwright-core';
import { mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TAKES = join(ROOT, 'takes', 'v2');
const SLIDEV_URL = (process.env.SLIDEV_URL || 'http://127.0.0.1:4175').replace(/\/+$/, '');
const DEMO_URL = process.env.DEMO_URL || 'https://plzhacknono.duckdns.org/';
const SLIDE_VIEW = { width: 1920, height: 1080 };
const APP_VIEW = { width: 1440, height: 810 };
const CHROMIUM = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const ONLY = new Set((process.env.CAPTURE_ONLY || '').split(',').filter(Boolean));
const wants = name => ONLY.size === 0 || ONLY.has(name);
const APP_CAPTURE_SETTLE_MS = 1_000;
const APP_USABLE_TAIL_MS = 26_000;
const CAPTURE_KST_HOUR = 16.5;

mkdirSync(TAKES, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-notifications',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
  ],
});

function demoUrl(kind) {
  const url = new URL(DEMO_URL);
  if (kind) url.searchParams.set('demo', kind);
  return url.href;
}

async function makeContext(recordVideo = false) {
  const viewport = recordVideo ? APP_VIEW : SLIDE_VIEW;
  const context = await browser.newContext({
    viewport,
    screen: viewport,
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    ...(recordVideo ? { recordVideo: { dir: TAKES, size: APP_VIEW } } : {}),
  });
  await context.addInitScript(() => {
    localStorage.setItem('phn_lang', 'en');
    localStorage.setItem('phn_crt', '0');
    localStorage.setItem('phn_snd', '0');
  });
  if (recordVideo) {
    await context.addInitScript(() => {
      const styleId = 'capture-v2-boot-guard';
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
  }
  return context;
}

async function captureSlides() {
  const context = await makeContext();
  const page = await context.newPage();
  try {
    for (let number = 1; number <= 9; number += 1) {
      await page.goto(`${SLIDEV_URL}/${number}`, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForSelector(`.slidev-page-${number}`, { state: 'visible', timeout: 15_000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(image => {
          if (image.complete) return Promise.resolve();
          return new Promise(resolve => {
            const done = () => resolve();
            image.addEventListener('load', done, { once: true });
            image.addEventListener('error', done, { once: true });
            setTimeout(done, 5_000);
          });
        }));
        let style = document.querySelector('#capture-v2-style');
        if (!style) {
          style = document.createElement('style');
          style.id = 'capture-v2-style';
          style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;cursor:none!important}';
          document.head.append(style);
        }
      });
      await page.screenshot({ path: join(TAKES, `slide-${String(number).padStart(2, '0')}.png`) });
      console.log(`OK slide-${String(number).padStart(2, '0')}`);
    }
  } finally {
    await context.close();
  }
}

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
    document.body.classList.remove('crt');
    localStorage.setItem('phn_lang', 'en');
    localStorage.setItem('phn_crt', '0');
    localStorage.setItem('phn_snd', '0');
    if (!document.querySelector('#capture-v2-cursor-style')) {
      const style = document.createElement('style');
      style.id = 'capture-v2-cursor-style';
      style.textContent = '*{cursor:none!important}';
      document.head.append(style);
    }
    document.querySelector('#boot')?.remove();
  }, CAPTURE_KST_HOUR);
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  console.log(`READY app content; KST hour pinned to ${CAPTURE_KST_HOUR}`);
}

async function captureApp(name, kind, prepare) {
  const destination = join(TAKES, `app-${name}.webm`);
  const context = await makeContext(true);
  const page = await context.newPage();
  const video = page.video();
  let source;
  try {
    await page.goto(demoUrl(kind), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForApp(page);
    if (prepare) await prepare(page);
    await page.waitForTimeout(APP_CAPTURE_SETTLE_MS);
    console.log(`READY app-${name}; preserving ${APP_USABLE_TAIL_MS / 1_000}s terminal usable tail`);
    await page.waitForTimeout(APP_USABLE_TAIL_MS);
    await page.close();
    source = await video.path();
    await context.close();
    renameSync(source, destination);
    console.log(`OK app-${name}`);
  } catch (error) {
    await context.close().catch(() => {});
    throw new Error(`app-${name}: ${error.message}`);
  }
}

try {
  if (wants('slides')) await captureSlides();

  if (wants('map')) await captureApp('map', null, async page => {
    await page.click('#btnMap');
    await page.waitForFunction(() => document.querySelector('#btnMap')?.textContent?.includes('RPG'));
  });
  if (wants('norad')) await captureApp('norad', null, async page => {
    await page.click('#btnTheme');
    await page.waitForFunction(() => document.body.dataset.theme === 'norad');
  });
  if (wants('skirmish')) await captureApp('skirmish', 'skirmish');
  if (wants('srw')) await captureApp('srw', 'srw');
  if (wants('fps')) await captureApp('fps', 'fpss');
} finally {
  await browser.close();
}
