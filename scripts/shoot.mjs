// Screenshot an SVG map (with its web fonts) using a local Chrome or Edge.
import { writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export function findChrome() {
  const found = CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error('No Chrome/Edge found. Set CHROME=/path/to/chrome.');
  return found;
}

/**
 * Render `svg` to a PNG at `out`. `scale` shrinks or enlarges the 1600x1100 map;
 * `crop` = {x, y, w, h} in map units renders only that window.
 */
export function shoot(svg, out, { width = 1600, height = 1100, scale = 1, crop } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hbd-shot-'));
  const view = crop ?? { x: 0, y: 0, w: width, h: height };
  const pw = Math.round(view.w * scale);
  const ph = Math.round(view.h * scale);
  const sized = svg.replace(/<svg([^>]*?) viewBox="[^"]*" width="\d+" height="\d+"/, `<svg$1 viewBox="${view.x} ${view.y} ${view.w} ${view.h}" width="${pw}" height="${ph}"`);
  const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=block" rel="stylesheet">
<style>html,body{margin:0;background:#2a2118;overflow:hidden}svg{display:block}</style></head><body>${sized}</body></html>`;
  const page = join(dir, 'page.html');
  writeFileSync(page, html);
  try {
    execFileSync(findChrome(), [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--virtual-time-budget=4000',
      `--screenshot=${out}`,
      `--window-size=${pw},${ph}`,
      pathToFileURL(page).href,
    ], { stdio: 'ignore' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
