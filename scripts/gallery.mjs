// Build the gallery site in docs/: one interactive atlas per famous repository.
//   node scripts/gallery.mjs <dir-with-clones> [slug ...]
// Each clone is a (bare) git repository named like "owner-repo".
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { analyze } from '../src/analyze.js';
import { layout } from '../src/layout.js';
import { renderSVG } from '../src/render.js';
import { renderHTML } from '../src/html.js';
import { shoot } from './shoot.mjs';

const [clones, ...only] = process.argv.slice(2);
if (!clones) {
  console.error('usage: node scripts/gallery.mjs <dir-with-clones> [slug ...]');
  process.exit(1);
}
const docs = resolve('docs');
const atlas = join(docs, 'atlas');
mkdirSync(atlas, { recursive: true });
const indexPath = join(docs, 'gallery.json');
const gallery = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};

const slugs = only.length ? only : readdirSync(clones).filter((d) => !d.startsWith('.'));
for (const slug of slugs) {
  const dir = join(clones, slug);
  const t0 = Date.now();
  process.stdout.write(`${slug} … `);
  const realm = await analyze(dir, { maxCommits: 60000 });
  const geo = layout(realm);
  const svg = renderSVG(realm, geo);
  writeFileSync(join(atlas, `${slug}.html`), renderHTML(realm, geo, renderSVG(realm, geo, { interactive: true })));
  shoot(svg, join(atlas, `${slug}.png`), { scale: 0.6 });
  // Thumbnails ship as JPEG (needs ffmpeg); keep the PNG if it isn't installed.
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(atlas, `${slug}.png`), '-q:v', '3', join(atlas, `${slug}.jpg`)]);
    rmSync(join(atlas, `${slug}.png`));
  } catch {}
  const top = realm.dragons[0];
  gallery[slug] = {
    slug,
    name: realm.name,
    files: realm.stats.files,
    loc: realm.stats.loc,
    commits: realm.stats.commits,
    authors: realm.stats.authors,
    dragons: realm.dragons.length,
    aiShare: realm.stats.aiShare,
    top: top ? { name: `${top.name} ${top.title}`, path: top.path } : null,
    generatedAt: realm.generatedAt,
  };
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s · ${realm.stats.files} files · ${realm.stats.commits} commits · ${realm.dragons.length} dragons`);
}
writeFileSync(indexPath, `${JSON.stringify(gallery, null, 2)}\n`);
console.log(`gallery: ${Object.keys(gallery).length} realms`);
