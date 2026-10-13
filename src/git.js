import { spawn, spawnSync } from 'node:child_process';

const RS = '\x1e'; // record separator: starts every commit
const US = '\x1f'; // unit separator: between header fields
const GS = '\x1d'; // group separator: ends the commit message

/** Run git synchronously and return stdout. Throws with git's stderr on failure. */
export function git(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 30 });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr.trim()}`);
  }
  return res.stdout;
}

/** Run git asynchronously, collecting stdout as a Buffer (handles huge logs). */
function gitBuffer(cwd, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd });
    const chunks = [];
    let stderr = '';
    child.stdout.on('data', (c) => chunks.push(c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`git ${args[0]} failed: ${stderr.trim()}`));
      resolve(Buffer.concat(chunks));
    });
    if (input !== undefined) child.stdin.end(input);
  });
}

export function repoRoot(dir) {
  const inside = spawnSync('git', ['rev-parse', '--is-bare-repository'], { cwd: dir, encoding: 'utf8' });
  if (inside.status === 0 && inside.stdout.trim() === 'true') return git(dir, ['rev-parse', '--absolute-git-dir']).trim();
  return git(dir, ['rev-parse', '--show-toplevel']).trim();
}

export function isShallow(dir) {
  const res = spawnSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: dir, encoding: 'utf8' });
  return res.status === 0 && res.stdout.trim() === 'true';
}

export function hasCommits(dir) {
  return spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: dir }).status === 0;
}

/**
 * Files at HEAD with their blob ids and sizes, read from git itself so the map
 * reflects the committed tree (works for bare clones and odd checkouts too).
 */
export function listTree(root) {
  const out = git(root, ['-c', 'core.quotepath=off', 'ls-tree', '-r', '-z', '--long', 'HEAD']);
  const entries = [];
  for (const rec of out.split('\0')) {
    if (!rec) continue;
    const tab = rec.indexOf('\t');
    const [mode, type, hash, size] = rec.slice(0, tab).split(/\s+/);
    if (type !== 'blob' || mode === '120000') continue; // skip submodules and symlinks
    entries.push({ path: rec.slice(tab + 1), hash, size: Number(size) || 0 });
  }
  return entries;
}

/** Read many blobs in one `git cat-file --batch` round trip. Returns Map<hash, Buffer>. */
export async function readBlobs(root, hashes) {
  const blobs = new Map();
  if (!hashes.length) return blobs;
  const buf = await gitBuffer(root, ['cat-file', '--batch'], hashes.join('\n') + '\n');
  let pos = 0;
  while (pos < buf.length) {
    const nl = buf.indexOf(10, pos);
    if (nl === -1) break;
    const [hash, type, size] = buf.toString('utf8', pos, nl).split(' ');
    if (type === 'missing' || size === undefined) {
      pos = nl + 1;
      continue;
    }
    const len = Number(size);
    blobs.set(hash, buf.subarray(nl + 1, nl + 1 + len));
    pos = nl + 1 + len + 1;
  }
  return blobs;
}

export function remoteName(root) {
  try {
    const url = git(root, ['config', '--get', 'remote.origin.url']).trim();
    const m = url.match(/[/:]([^/:]+\/[^/]+?)(?:\.git)?\/?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a numstat path that may carry rename notation:
 *   "src/{old => new}/file.js"  or  "old.js => new.js"
 * Returns [oldPath, newPath] (identical when no rename happened).
 */
export function parseRenamePath(p) {
  const brace = p.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
  if (brace) {
    const [, pre, from, to, post] = brace;
    const clean = (s) => s.replace(/\/\//g, '/').replace(/^\//, '');
    return [clean(pre + from + post), clean(pre + to + post)];
  }
  const arrow = p.split(' => ');
  if (arrow.length === 2) return [arrow[0], arrow[1]];
  return [p, p];
}

/**
 * Parse `git log` output produced with the format used by readLog.
 * Commits arrive newest first; renames are folded so every change is
 * attributed to the file's name at HEAD.
 */
export function parseLog(raw) {
  const commits = [];
  const alias = new Map(); // historical path -> path at HEAD
  const canonical = (p) => alias.get(p) ?? p;

  for (const record of raw.split(RS)) {
    if (!record.trim()) continue;
    const end = record.indexOf(GS);
    if (end === -1) continue;
    const [hash, author, email, ts, message = ''] = record.slice(0, end).split(US);
    const changes = [];
    for (const line of record.slice(end + 1).split('\n')) {
      if (!line) continue;
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const [added, deleted] = parts;
      const [from, to] = parseRenamePath(parts.slice(2).join('\t'));
      const path = canonical(to);
      if (from !== to) alias.set(from, path);
      changes.push({
        path,
        added: added === '-' ? 0 : Number(added) || 0,
        deleted: deleted === '-' ? 0 : Number(deleted) || 0,
      });
    }
    commits.push({ hash, author, email: email.toLowerCase(), time: Number(ts) * 1000, message, changes });
  }
  return commits;
}

/** Read the commit history of HEAD with per-file line stats. */
export async function readLog(root, { maxCommits = 20000, since } = {}) {
  const args = [
    '-c', 'core.quotepath=off',
    'log', 'HEAD', '--no-merges', '--numstat', '-M',
    `--format=${RS}%H${US}%aN${US}%aE${US}%at${US}%B${GS}`,
    '-n', String(maxCommits),
  ];
  if (since) args.push(`--since=${since}`);
  return parseLog((await gitBuffer(root, args)).toString('utf8'));
}
