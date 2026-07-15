#!/usr/bin/env node
/* Deterministic browser capture for the OpenAI Build Week demo video.
 * Uses system Chromium via playwright-core. One clean context per scene so a
 * failed take can be re-recorded without repeating the whole session.
 * Captures page content only (no browser UI, no cursor overlay). */
import { chromium } from 'playwright-core';
import { mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TAKES = join(ROOT, 'takes');
mkdirSync(TAKES, { recursive: true });

const DEMO = 'https://plzhacknono.duckdns.org/';
const REPO = 'https://github.com/yazzang-homelab/server-guardian-warboard';
const VIEW = { width: 1920, height: 1080 };

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1'],
});

async function scene(name, fn) {
  const ctx = await browser.newContext({
    viewport: VIEW,
    recordVideo: { dir: TAKES, size: VIEW },
    locale: 'en-US',
    timezoneId: 'UTC',
  });
  const page = await ctx.newPage();
  try {
    await fn(page);
    const video = page.video();
    await page.close();
    const p = await video.path();
    await ctx.close();
    renameSync(p, join(TAKES, `${name}.webm`));
    console.log('OK', name);
  } catch (e) {
    await ctx.close().catch(() => {});
    console.error('FAIL', name, e.message);
    process.exitCode = 1;
  }
}

const waitBoot = async page => {
  await page.waitForSelector('#stage, canvas', { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => {
    const b = document.getElementById('boot');
    return !b || b.offsetParent === null || getComputedStyle(b).display === 'none' || getComputedStyle(b).opacity === '0';
  }, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
};

// S2 dashboard overview
await scene('s02_dashboard', async page => {
  await page.goto(DEMO, { waitUntil: 'domcontentloaded' });
  await waitBoot(page);
  await page.waitForTimeout(26000);
});

// S3 redaction: panels then slow scroll to submission notes and back
await scene('s03_redaction', async page => {
  await page.goto(DEMO, { waitUntil: 'domcontentloaded' });
  await waitBoot(page);
  await page.waitForTimeout(9000);
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  await page.waitForTimeout(9000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(12000);
});

// S4 language toggle EN -> KO -> EN
await scene('s04_lang', async page => {
  await page.goto(DEMO, { waitUntil: 'domcontentloaded' });
  await waitBoot(page);
  await page.waitForTimeout(5000);
  await page.click('#btnLang');
  await page.waitForTimeout(9000);
  await page.click('#btnLang');
  await page.waitForTimeout(8000);
});

// S5 view modes: RPG -> Map -> RPG -> NORAD
await scene('s05_modes', async page => {
  await page.goto(DEMO, { waitUntil: 'domcontentloaded' });
  await waitBoot(page);
  await page.waitForTimeout(6000);
  await page.click('#btnMap');
  await page.waitForTimeout(11000);
  await page.click('#btnMap');
  await page.waitForTimeout(2000);
  await page.click('#btnTheme');
  await page.waitForTimeout(13000);
});

// S6 deterministic skirmish demo
await scene('s06_skirmish', async page => {
  await page.goto(DEMO + '?demo=skirmish', { waitUntil: 'domcontentloaded' });
  await waitBoot(page);
  await page.waitForTimeout(15000);
});

// S7 FPS demo (sword variant)
await scene('s07_fps', async page => {
  await page.goto(DEMO + '?demo=fpss', { waitUntil: 'domcontentloaded' });
  await waitBoot(page);
  await page.waitForTimeout(15000);
});

// S8 GitHub README + GPT-5.6 usage record (public pages, signed out)
await scene('s08_github', async page => {
  await page.goto(REPO, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'smooth' }));
  await page.waitForTimeout(7000);
  await page.goto(REPO + '/blob/main/docs/GPT-5.6-USAGE.md', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
  await page.waitForTimeout(6000);
});

await browser.close();
