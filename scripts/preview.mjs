// Dev helper: render a repo's map and screenshot it with headless Chrome.
//   node scripts/preview.mjs <repo> <out.png> [theme]
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyze } from '../src/analyze.js';
import { layout } from '../src/layout.js';
import { renderSVG } from '../src/render.js';

const [repo, out = 'preview.png', theme = 'parchment'] = process.argv.slice(2);
const t0 = Date.now();
const realm = await analyze(repo);
const t1 = Date.now();
const geo = layout(realm);
const t2 = Date.now();
const svg = renderSVG(realm, geo, { theme });
const svgPath = resolve(out.replace(/\.png$/, '.svg'));
writeFileSync(svgPath, svg);
console.log(`analyze ${t1 - t0}ms, layout ${t2 - t1}ms, svg ${(svg.length / 1024).toFixed(0)}KB`);
const chrome = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
execFileSync(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--screenshot=${resolve(out)}`,
  `--window-size=${geo.width},${geo.height}`,
  pathToFileURL(svgPath).href,
], { stdio: 'ignore' });
console.log('wrote', resolve(out));
