import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeRepo, code } from './helpers.js';
import { analyze } from '../src/analyze.js';
import { layout } from '../src/layout.js';
import { renderSVG } from '../src/render.js';
import { renderHTML } from '../src/html.js';
import { toJSON, toMarkdown } from '../src/report.js';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

// A small kingdom: one hot, complex core file; a coupled pair; an abandoned
// module whose author left long ago; a tested util; an AI-written helper.
let repo;
let realm;
before(async () => {
  const commits = [
    {
      author: 'Old Wizard',
      daysAgo: 900,
      files: {
        'src/legacy/ledger.js': code(120, 3, 'l'),
        'src/core/engine.js': code(200, 6, 'e0'),
        'src/core/router.js': code(60, 2, 'r0'),
        'src/core/routes.js': code(50, 2, 's0'),
        'src/util/format.js': code(40, 2, 'f'),
        'test/format.test.js': code(30, 2, 't'),
        'docs/guide.md': '# Guide\n\nWords.\n',
        'README.md': '# Realm\n',
      },
    },
  ];
  for (let i = 1; i <= 24; i++) {
    commits.push({
      author: i % 3 ? 'Ana Lima' : 'Bo Chen',
      daysAgo: 400 - i * 15,
      message: `tune engine ${i}`,
      files: { 'src/core/engine.js': code(200 + i * 4, 6, `e${i}`) },
    });
  }
  for (let i = 1; i <= 8; i++) {
    commits.push({
      author: 'Ana Lima',
      daysAgo: 300 - i * 20,
      message: `routing ${i}`,
      files: { 'src/core/router.js': code(60 + i, 2, `r${i}`), 'src/core/routes.js': code(50 + i, 2, `s${i}`) },
    });
  }
  commits.push({
    author: 'Ana Lima',
    daysAgo: 5,
    message: 'add helper\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
    files: { 'src/util/helper.js': code(80, 2, 'h') },
  });
  repo = makeRepo(commits);
  realm = await analyze(repo.dir);
});
after(() => repo?.cleanup());

test('reads files and history', () => {
  assert.equal(realm.stats.commits, 34);
  assert.equal(realm.stats.authors, 3);
  const paths = realm.files.map((f) => f.path).sort();
  assert.ok(paths.includes('src/core/engine.js'));
  assert.ok(paths.includes('README.md'));
  const engine = realm.files.find((f) => f.path === 'src/core/engine.js');
  assert.equal(engine.revisions, 25);
  assert.equal(engine.maxDepth, 6);
});

test('the hot, complex file is the mightiest dragon', () => {
  assert.ok(realm.dragons.length >= 1);
  assert.equal(realm.dragons[0].path, 'src/core/engine.js');
  assert.equal(realm.dragons[0].tier, 'Ancient Wyrm');
  assert.match(realm.dragons[0].name, /^[A-Z][a-z]+$/);
});

test('files that change together are joined by a road', () => {
  const road = realm.routes.find((r) => {
    const pair = [realm.files[r.a].path, realm.files[r.b].path].sort().join(' ');
    return pair === 'src/core/router.js src/core/routes.js';
  });
  assert.ok(road, 'router.js and routes.js should be coupled');
  assert.equal(road.shared, 9, "8 routing commits plus the founding commit");
});

test('knowledge left with its only author becomes ruins', () => {
  const ledger = realm.files.find((f) => f.path === 'src/legacy/ledger.js');
  assert.equal(ledger.owner, 'Old Wizard');
  assert.equal(ledger.ruin, true);
  assert.equal(ledger.ancient, true);
  const engine = realm.files.find((f) => f.path === 'src/core/engine.js');
  assert.equal(engine.ruin, false, 'active authors own the engine now');
});

test('tests raise walls and AI work is recognized', () => {
  assert.equal(realm.files.find((f) => f.path === 'src/util/format.js').tested, true);
  assert.equal(realm.files.find((f) => f.path === 'src/core/engine.js').tested, false);
  assert.equal(realm.stats.aiCommits, 1);
  assert.equal(realm.stats.aiTools[0].tool, 'Claude');
  assert.equal(realm.files.find((f) => f.path === 'src/util/helper.js').aiShare, 1);
});

test('layout is deterministic and keeps every city on the canvas', () => {
  const a = layout(realm);
  const b = layout(realm);
  assert.deepEqual(a.cities.map((c) => [c.x, c.y]), b.cities.map((c) => [c.x, c.y]));
  for (const c of a.cities) {
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y));
    assert.ok(c.x > 0 && c.x < a.width && c.y > 0 && c.y < a.height);
  }
  assert.ok(a.coast.length > 0 && a.coast.every((l) => l.closed));
  const other = layout(realm, { seed: 'another world' });
  assert.notDeepEqual(other.cities.map((c) => [c.x, c.y]), a.cities.map((c) => [c.x, c.y]));
});

test('renders a clean SVG and a self-contained HTML atlas', () => {
  const geo = layout(realm);
  const svg = renderSVG(realm, geo);
  assert.match(svg, /^<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.ok(svg.trimEnd().endsWith('</svg>'));
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  assert.match(svg, /The Realm of/);
  const open = (svg.match(/<g[\s>]/g) ?? []).length;
  const close = (svg.match(/<\/g>/g) ?? []).length;
  assert.equal(open, close, 'balanced groups');
  for (const theme of ['midnight']) assert.doesNotMatch(renderSVG(realm, geo, { theme }), /NaN|undefined/);
  const html = renderHTML(realm, geo, renderSVG(realm, geo, { interactive: true }));
  assert.match(html, /<script id="realm" type="application\/json">/);
  const data = JSON.parse(html.match(/<script id="realm" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.files.length, realm.files.length);
  assert.equal(data.dragons[0].path, 'src/core/engine.js');
});

test('JSON and Markdown reports carry dragons and quests', () => {
  const json = toJSON(realm);
  assert.equal(json.tool, 'here-be-dragons');
  assert.equal(json.dragons[0].path, 'src/core/engine.js');
  assert.ok(json.quests.some((q) => q.kind === 'slay'));
  assert.ok(json.knowledgeLoss.some((k) => k.path === 'src/legacy/ledger.js'));
  assert.ok(json.chronicle.length >= 3);
  const md = toMarkdown(realm);
  assert.match(md, /## Dragons/);
  assert.match(md, /src\/core\/engine\.js/);
});

test('CLI writes the atlas and prints JSON', () => {
  const out = mkdtempSync(join(tmpdir(), 'hbd-out-'));
  try {
    const res = spawnSync(process.execPath, [CLI, repo.dir, '-o', out, '--no-open', '--quiet'], { encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
    for (const f of ['map.html', 'map.svg', 'realm.json']) assert.ok(existsSync(join(out, f)), f);
    assert.match(readFileSync(join(out, 'map.svg'), 'utf8'), /<svg/);
    const json = spawnSync(process.execPath, [CLI, repo.dir, '--json'], { encoding: 'utf8' });
    assert.equal(json.status, 0, json.stderr);
    assert.equal(JSON.parse(json.stdout).dragons[0].path, 'src/core/engine.js');
    const bad = spawnSync(process.execPath, [CLI, join(out, 'nope')], { encoding: 'utf8' });
    assert.notEqual(bad.status, 0);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('a single-commit, single-file repository still gets a map', async () => {
  const tiny = makeRepo([{ author: 'Solo', files: { 'main.py': 'print("hi")\n' } }]);
  try {
    const r = await analyze(tiny.dir);
    assert.equal(r.files.length, 1);
    assert.equal(r.dragons.length, 0);
    const geo = layout(r);
    assert.doesNotMatch(renderSVG(r, geo), /NaN|undefined/);
  } finally {
    tiny.cleanup();
  }
});
