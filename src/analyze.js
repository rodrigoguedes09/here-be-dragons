import { basename as pathBasename } from 'node:path';
import { listTree, readBlobs, readLog, repoRoot, remoteName, hasCommits, isShallow } from './git.js';
import { classify, canHostDragon, language, stem, isTestPath, areaWeight } from './classify.js';
import { buildTree, chooseProvinces, filesUnder } from './tree.js';
import { dragonName } from './names.js';

const DAY = 86400000;
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;

// Commit trailers and bot identities left behind by coding agents.
const AI_SIGNS = [
  [/noreply@anthropic\.com|claude code|co-authored-by:\s*claude/i, 'Claude'],
  [/co-authored-by:[^\n]*codex|codex@openai\.com|chatgpt-codex-connector/i, 'Codex'],
  [/copilot-swe-agent|co-authored-by:\s*copilot|github copilot/i, 'Copilot'],
  [/cursoragent@cursor\.com|co-authored-by:\s*cursor/i, 'Cursor'],
  [/devin-ai-integration|devin ai/i, 'Devin'],
  [/google-labs-jules|co-authored-by:\s*jules/i, 'Jules'],
  [/co-authored-by:\s*aider|^aider: /im, 'Aider'],
  [/ampcode\.com|co-authored-by:\s*amp\b/i, 'Amp'],
  [/co-authored-by:\s*gemini|gemini-code-assist/i, 'Gemini'],
  [/windsurf|codeium/i, 'Windsurf'],
  [/opencode\.ai|co-authored-by:\s*opencode/i, 'opencode'],
];

const BOTS = /\[bot\]|^dependabot|^renovate|^github-actions|^greenkeeper|^snyk-bot|^imgbot|^allcontributors|-bot$|^bot$/i;

/** Maintenance bots (dependency bumps, formatting) are not part of the story. */
export function isBot(commit) {
  return BOTS.test(commit.author) || BOTS.test(commit.email.split('@')[0]);
}

export function detectAI(commit) {
  const text = `${commit.author} <${commit.email}>\n${commit.message}`;
  for (const [re, name] of AI_SIGNS) if (re.test(text)) return name;
  return null;
}

/** Lines, indentation complexity (Tornhill's "whitespace complexity") and TODO count. */
export function measure(text) {
  const lines = text.split(/\r?\n/);
  const indents = [];
  let loc = 0;
  let todos = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    loc++;
    if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) todos++;
    let spaces = 0;
    for (const ch of line) {
      if (ch === ' ') spaces++;
      else if (ch === '\t') spaces += 4;
      else break;
    }
    indents.push(spaces);
  }
  // Indent unit: the most common positive step between consecutive lines.
  const steps = new Map();
  for (let i = 1; i < indents.length; i++) {
    const d = Math.abs(indents[i] - indents[i - 1]);
    if (d > 0 && d <= 8) steps.set(d, (steps.get(d) ?? 0) + 1);
  }
  let unit = 4;
  let best = 0;
  for (const [d, n] of steps) if (n > best || (n === best && d < unit)) [unit, best] = [d, n];
  let complexity = 0;
  let maxDepth = 0;
  for (const s of indents) {
    const depth = Math.floor(s / unit);
    complexity += depth;
    if (depth > maxDepth) maxDepth = depth;
  }
  return { loc, complexity, maxDepth, todos };
}

function decode(buf) {
  if (!buf || buf.subarray(0, 8000).includes(0)) return null;
  return buf.toString('utf8');
}

/** Percentile rank of every value in `values` (0..1, ties share the higher rank). */
function percentiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const rankOf = new Map();
  sorted.forEach((v, i) => rankOf.set(v, n > 1 ? i / (n - 1) : 1));
  return values.map((v) => rankOf.get(v));
}

/**
 * Analyze a repository and return the realm: everything the map and reports need.
 */
export async function analyze(dir, opts = {}) {
  const {
    maxCommits = 20000,
    since,
    exclude = [],
    activeDays = 180,
    ancientDays = 730,
    maxChangeset = 30,
    onProgress = () => {},
  } = opts;

  const root = repoRoot(dir);
  if (!hasCommits(root)) throw new Error('This repository has no commits yet. Every realm needs a history.');

  const excludeRes = exclude.map(globToRegex);
  onProgress('Surveying the land');
  const files = [];
  const entries = listTree(root).filter(
    (e) => e.size <= MAX_FILE_BYTES && classify(e.path) && !excludeRes.some((re) => re.test(e.path)),
  );
  const blobs = await readBlobs(root, entries.map((e) => e.hash));
  for (const { path, hash } of entries) {
    const kind = classify(path);
    const text = decode(blobs.get(hash));
    if (text === null) continue;
    const m = measure(text);
    if (m.loc === 0) continue;
    files.push({
      path,
      kind,
      lang: language(path),
      ...m,
      revisions: 0,
      added: 0,
      deleted: 0,
      authorLines: new Map(),
      authorCommits: new Map(),
      firstTime: null,
      lastTime: null,
      aiAdded: 0,
      aiCommits: 0,
    });
  }
  if (!files.length) throw new Error('No source files found to map.');
  const byPath = new Map(files.map((f, i) => [f.path, i]));

  onProgress('Reading the chronicles');
  const commits = await readLog(root, { maxCommits, since });
  const headTime = commits.length ? commits[0].time : Date.now();

  const authors = new Map(); // key -> { name, email, commits, added, first, last }
  const authorKey = (c) => c.name.trim().toLowerCase();
  const aiByTool = new Map();
  let aiCommitCount = 0;
  const pairs = new Map();
  const timeline = [];

  for (const c of commits) {
    const ai = detectAI(c);
    if (!ai && isBot(c)) continue;
    if (ai) {
      aiCommitCount++;
      aiByTool.set(ai, (aiByTool.get(ai) ?? 0) + 1);
    }
    const key = authorKey({ name: c.author });
    let a = authors.get(key);
    if (!a) authors.set(key, (a = { name: c.author, email: c.email, commits: 0, added: 0, first: c.time, last: c.time, spellings: new Map() }));
    a.spellings.set(c.author, (a.spellings.get(c.author) ?? 0) + 1);
    a.commits++;
    a.first = Math.min(a.first, c.time);
    a.last = Math.max(a.last, c.time);

    const touched = [];
    let commitAdded = 0;
    for (const ch of c.changes) {
      const i = byPath.get(ch.path);
      if (i === undefined) continue;
      const f = files[i];
      f.revisions++;
      f.added += ch.added;
      f.deleted += ch.deleted;
      f.authorLines.set(key, (f.authorLines.get(key) ?? 0) + ch.added + ch.deleted * 0.5);
      f.authorCommits.set(key, (f.authorCommits.get(key) ?? 0) + 1);
      f.firstTime = f.firstTime === null ? c.time : Math.min(f.firstTime, c.time);
      f.lastTime = f.lastTime === null ? c.time : Math.max(f.lastTime, c.time);
      if (ai) {
        f.aiAdded += ch.added;
        f.aiCommits++;
      }
      a.added += ch.added;
      commitAdded += ch.added;
      if (f.kind !== 'docs' && f.kind !== 'config') touched.push(i);
    }
    timeline.push({ time: c.time, added: commitAdded, ai: !!ai });

    // Temporal coupling: files that keep changing together.
    if (touched.length >= 2 && touched.length <= maxChangeset) {
      touched.sort((x, y) => x - y);
      for (let x = 0; x < touched.length; x++) {
        for (let y = x + 1; y < touched.length; y++) {
          const k = touched[x] * 1048576 + touched[y];
          pairs.set(k, (pairs.get(k) ?? 0) + 1);
        }
      }
    }
  }

  // Authors still around near HEAD; display the most common spelling of each name.
  for (const a of authors.values()) {
    a.active = headTime - a.last <= activeDays * DAY;
    a.name = [...a.spellings].sort((x, y) => y[1] - x[1])[0][0];
    delete a.spellings;
  }
  const displayName = (key) => authors.get(key)?.name ?? key;

  // Ownership, knowledge loss, age, AI share.
  const testStems = new Set(files.filter((f) => f.kind === 'test' || isTestPath(f.path)).map((f) => stem(f.path)));
  for (const f of files) {
    let owner = null;
    let ownerLines = 0;
    let totalLines = 0;
    for (const [k, v] of f.authorLines) {
      totalLines += v;
      if (v > ownerLines) [owner, ownerLines] = [k, v];
    }
    f.owner = owner ? displayName(owner) : null;
    f.ownerShare = totalLines ? ownerLines / totalLines : 0;
    f.authorCount = f.authorLines.size;
    f.aiShare = f.added ? Math.min(1, f.aiAdded / f.added) : 0;
    f.ageDays = f.lastTime === null ? null : Math.round((headTime - f.lastTime) / DAY);
    f.ancient = f.lastTime === null || headTime - f.lastTime > ancientDays * DAY;
    const ownerAuthor = owner ? authors.get(owner) : null;
    f.ruin = !!ownerAuthor && !ownerAuthor.active && f.ownerShare >= 0.5 && f.loc >= 40 && f.kind === 'code';
    const s = stem(f.path);
    f.tested = f.kind === 'code' && s.length >= 3 && testStems.has(s);
  }

  // Hotspots: complex code that keeps changing.
  const candidates = files.filter((f) => canHostDragon(f.path, f.kind) && f.loc >= 30 && f.revisions >= 2);
  const pr = percentiles(candidates.map((f) => f.revisions));
  const pc = percentiles(candidates.map((f) => f.complexity));
  candidates.forEach((f, i) => (f.hotspot = pr[i] * pc[i]));
  for (const f of files) f.hotspot ??= 0;

  const maxDragons = clamp(Math.round(Math.sqrt(candidates.length) / 2.2), 1, 10);
  const dragonFiles = [...candidates]
    .filter((f) => f.hotspot >= 0.4 && f.revisions >= 3)
    .sort((a, b) => b.hotspot - a.hotspot || b.revisions - a.revisions)
    .slice(0, candidates.length >= 2 ? maxDragons : 0);

  // Trade routes.
  const revOf = (i) => files[i].revisions;
  const minShared = clamp(Math.round(commits.length / 1500), 3, 8);
  let routes = [];
  for (const [k, shared] of pairs) {
    if (shared < minShared) continue;
    const a = Math.floor(k / 1048576);
    const b = k % 1048576;
    if (stem(files[a].path) === stem(files[b].path)) continue; // foo.ts <-> foo.test.ts is expected
    if (files[a].kind !== 'code' || files[b].kind !== 'code') continue; // code moving with its tests is expected
    const degree = shared / ((revOf(a) + revOf(b)) / 2);
    if (degree < 0.25) continue;
    routes.push({ a, b, shared, degree });
  }
  routes.sort((x, y) => y.shared * y.degree - x.shared * x.degree);
  routes = routes.slice(0, 28);

  // Provinces.
  const weight = (f) => Math.max(areaWeight(f), 8);
  const tree = buildTree(files, weight, (f) => f.kind === 'code');
  const provinceRegions = chooseProvinces(tree);
  const provinces = provinceRegions.map((r, pi) => {
    const idx = r.loose ? [...r.node.files] : filesUnder(r.node);
    for (const i of idx) files[i].province = pi;
    return { name: r.name, path: r.path, loose: !!r.loose, node: r.node, files: idx };
  });

  for (const p of provinces) {
    const fs = p.files.map((i) => files[i]);
    p.loc = sum(fs, (f) => f.loc);
    p.revisions = sum(fs, (f) => f.revisions);
    const lines = new Map();
    for (const f of fs) for (const [k, v] of f.authorLines) lines.set(k, (lines.get(k) ?? 0) + v);
    const ranked = [...lines].sort((a, b) => b[1] - a[1]);
    const total = ranked.reduce((s, [, v]) => s + v, 0);
    p.owner = ranked.length ? displayName(ranked[0][0]) : null;
    p.ownerShare = total ? ranked[0][1] / total : 0;
    let acc = 0;
    p.busFactor = 0;
    for (const [, v] of ranked) {
      p.busFactor++;
      acc += v;
      if (acc >= total * 0.5) break;
    }
    const code = fs.filter((f) => f.kind === 'code');
    p.tested = code.length ? code.filter((f) => f.tested).length / code.length : 0;
    const added = sum(fs, (f) => f.added);
    p.aiShare = added ? sum(fs, (f) => f.aiAdded) / added : 0;
    p.ruinShare = p.loc ? sum(fs.filter((f) => f.ruin), (f) => f.loc) / p.loc : 0;
    p.ancientShare = p.loc ? sum(fs.filter((f) => f.ancient), (f) => f.loc) / p.loc : 0;
    p.todos = sum(fs, (f) => f.todos);
  }

  // Dragons get names and a title from their strongest trait (varied across the flight).
  const maxOf = (fn) => Math.max(1, ...dragonFiles.map(fn));
  const usedTitles = new Map();
  const dragons = dragonFiles.map((f, rank) => {
    const coupled = routes.filter((r) => files[r.a] === f || files[r.b] === f).length;
    const traits = [
      ['the Restless', f.revisions / maxOf((d) => d.revisions)],
      ['the Tangled', f.maxDepth / maxOf((d) => d.maxDepth)],
      ['the Colossal', f.loc / maxOf((d) => d.loc)],
      ['the Many-Handed', f.authorCount / maxOf((d) => d.authorCount)],
      ['the Entwined', coupled ? 0.55 + coupled / 10 : 0],
      ['the Forsaken', f.ruin ? 0.92 : 0],
      ['the Unfinished', f.todos >= 5 ? 0.6 + f.todos / 40 : 0],
      ['the Machine-Born', f.aiShare >= 0.5 ? 1.05 : 0],
    ]
      .map(([t, v]) => [t, v - 0.3 * (usedTitles.get(t) ?? 0)])
      .sort((a, b) => b[1] - a[1]);
    const title = traits[0][0];
    usedTitles.set(title, (usedTitles.get(title) ?? 0) + 1);
    f.dragon = rank;
    return {
      file: files.indexOf(f),
      path: f.path,
      name: dragonName(f.path),
      title,
      tier: rank === 0 ? 'Ancient Wyrm' : rank < 3 ? 'Elder Dragon' : 'Drake',
      score: round(f.hotspot, 3),
      revisions: f.revisions,
      loc: f.loc,
      complexity: f.complexity,
      maxDepth: f.maxDepth,
      authors: f.authorCount,
      owner: f.owner,
      ruin: f.ruin,
      todos: f.todos,
      aiShare: round(f.aiShare, 2),
      coupled,
    };
  });
  for (const f of files) f.dragon ??= -1;

  // Houses: the authors who own the most land.
  const ownedLoc = new Map();
  for (const f of files) if (f.owner) ownedLoc.set(f.owner, (ownedLoc.get(f.owner) ?? 0) + f.loc);
  const authorList = [...authors.values()]
    .map((a) => ({ ...a, ownedLoc: ownedLoc.get(a.name) ?? 0 }))
    .sort((a, b) => b.ownedLoc - a.ownedLoc || b.commits - a.commits);

  const langs = new Map();
  for (const f of files) if (f.kind !== 'docs' && f.kind !== 'config') langs.set(f.lang, (langs.get(f.lang) ?? 0) + f.loc);

  const totalAdded = sum(files, (f) => f.added);
  const name = remoteName(root) ?? pathBasename(root);

  return {
    name,
    root,
    generatedAt: new Date().toISOString(),
    head: { hash: commits[0]?.hash ?? null, time: headTime },
    stats: {
      files: files.length,
      loc: sum(files, (f) => f.loc),
      commits: commits.length,
      truncated: commits.length >= maxCommits,
      shallow: isShallow(root),
      authors: authors.size,
      activeAuthors: [...authors.values()].filter((a) => a.active).length,
      firstCommit: commits.length ? commits[commits.length - 1].time : null,
      lastCommit: headTime,
      aiCommits: aiCommitCount,
      aiShare: totalAdded ? sum(files, (f) => f.aiAdded) / totalAdded : 0,
      aiTools: [...aiByTool].sort((a, b) => b[1] - a[1]).map(([tool, commits]) => ({ tool, commits })),
      languages: [...langs].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, loc]) => ({ name, loc })),
      tested: (() => {
        const code = files.filter((f) => f.kind === 'code');
        return code.length ? code.filter((f) => f.tested).length / code.length : 0;
      })(),
      ruinLoc: sum(files.filter((f) => f.ruin), (f) => f.loc),
      todos: sum(files, (f) => f.todos),
    },
    files,
    provinces,
    dragons,
    routes,
    authors: authorList,
    timeline,
  };
}

function sum(arr, fn) {
  let s = 0;
  for (const x of arr) s += fn(x);
  return s;
}

function round(x, d) {
  const p = 10 ** d;
  return Math.round(x * p) / p;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

/** Minimal glob: ** matches across folders, * within one, ? one character. */
export function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (ch === '*') re += '[^/]*';
    else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`(^|/)${re}($|/)`);
}
