#!/usr/bin/env node
/* Capture Slidev slides as 1080p videos with object-level CSS animation.
 * No camera zoom/crop is applied: the complete 16:9 slide remains visible.
 *
 * Run after `npm run deck:build` (deck/dist must exist). Outputs:
 * takes/v4/slide-01.webm .. slide-09.webm.
 */
import http from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'deck', 'dist');
const TAKES = join(ROOT, 'takes', 'v4');
const CHROMIUM = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const PORT = Number(process.env.SLIDE_CAPTURE_PORT || 4187);
const SLIDE_COUNT = 9;
const CAPTURE_DELAY = '2.2s';

if (!existsSync(join(DIST, 'index.html'))) {
  throw new Error(`Missing ${join(DIST, 'index.html')}; run npm run deck:build first`);
}
mkdirSync(TAKES, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};
const server = http.createServer((req, res) => {
  let file = join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!existsSync(file) || !extname(file)) file = join(DIST, 'index.html'); // SPA fallback
  try {
    const data = readFileSync(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));

const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
try {
  for (let number = 1; number <= SLIDE_COUNT; number += 1) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }, screen: { width: 1920, height: 1080 },
      deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'no-preference',
      recordVideo: { dir: TAKES, size: { width: 1920, height: 1080 } },
    });
    await context.addInitScript(delay => {
      document.documentElement.style.setProperty('--capture-delay', delay);
    }, CAPTURE_DELAY);
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/${number}`, {
      waitUntil: 'networkidle', timeout: 30_000,
    });
    await page.waitForSelector(`.slidev-page-${number}`, { state: 'visible', timeout: 15_000 });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.waitForTimeout(6_500);
    const video = page.video();
    await page.close();
    await context.close();
    const out = join(TAKES, `slide-${String(number).padStart(2, '0')}.webm`);
    await video.saveAs(out);
    console.log(`OK ${out}`);
  }
} finally {
  await browser.close();
  server.close();
}
