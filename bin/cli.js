#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, relative, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { analyze } from '../src/analyze.js';
import { layout } from '../src/layout.js';
import { renderSVG } from '../src/render.js';
import { renderHTML } from '../src/html.js';
import { toJSON, toMarkdown, toTerminal } from '../src/report.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const HELP = `
  🐉 here-be-dragons ${pkg.version}
  Turn any git repository into a fantasy map. The dragons are real.

  Usage
    $ npx here-be-dragons [path | github-url | owner/repo] [options]

  Examples
    $ npx here-be-dragons                        map the repository you are in
    $ npx here-be-dragons facebook/react         map any public GitHub repository
    $ npx here-be-dragons --svg .github/map.svg  keep a map in your README
    $ npx here-be-dragons --json > realm.json    hotspots & quests for agents and CI

  Output
    -o, --out <dir>         where to write map.html, map.svg, realm.json (default: ./here-be-dragons)
        --svg <file>        also write the static map to this exact path
        --json              print the survey as JSON (nothing else is written)
        --md                print a Markdown report (nothing else is written)
        --full              with --json: include every file
        --theme <name>      parchment (default) or midnight
        --no-open           do not open the map in a browser

  Survey
        --since <date>      only read history since a date, e.g. "2 years ago"
        --max-commits <n>   read at most n commits (default 20000)
        --exclude <glob>    leave paths off the map (repeatable), e.g. "docs/**"
        --seed <text>       reshape the world (same seed, same map)

    -q, --quiet             print nothing but errors
    -v, --version
    -h, --help
`;

let args;
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      svg: { type: 'string' },
      json: { type: 'boolean' },
      md: { type: 'boolean' },
      full: { type: 'boolean' },
      theme: { type: 'string', default: 'parchment' },
      open: { type: 'boolean', default: true },
      'no-open': { type: 'boolean' },
      since: { type: 'string' },
      'max-commits': { type: 'string' },
      exclude: { type: 'string', multiple: true, default: [] },
      seed: { type: 'string' },
      quiet: { type: 'boolean', short: 'q' },
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
  });
} catch (err) {
  fail(`${err.message}\n  Run with --help to see the options.`);
}
const opt = args.values;
if (opt.help) {
  process.stdout.write(HELP);
  process.exit(0);
}
if (opt.version) {
  console.log(pkg.version);
  process.exit(0);
}

const machine = opt.json || opt.md;
const color = Boolean(process.stderr.isTTY && !process.env.NO_COLOR);
const say = (msg) => {
  if (!opt.quiet && !machine) process.stderr.write(msg);
};
const dim = (s) => (color ? `\x1b[2m${s}\x1b[0m` : s);
const green = (s) => (color ? `\x1b[32m${s}\x1b[0m` : s);

function fail(message) {
  process.stderr.write(`\n  ${color ? '\x1b[31m✖\x1b[0m' : '✖'} ${message}\n\n`);
  process.exit(1);
}

/** Accept local paths, git URLs and owner/repo shorthands. */
function resolveTarget(target) {
  if (!target) return { dir: process.cwd() };
  if (existsSync(target)) return { dir: resolve(target) };
  let url = null;
  if (/^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/.test(target)) url = target;
  else if (/^[\w.-]+\/[\w.-]+$/.test(target)) url = `https://github.com/${target}.git`;
  if (!url) fail(`No repository at "${target}".`);
  const slug = url.replace(/\.git$/, '').split(/[/:]/).slice(-2).join('-').replace(/[^\w.-]/g, '');
  const dir = join(tmpdir(), 'here-be-dragons', slug);
  if (existsSync(join(dir, 'HEAD'))) {
    say(`  ${dim('Updating cached clone of')} ${url}\n`);
    spawnSync('git', ['fetch', '--quiet', '--prune', 'origin', '+refs/heads/*:refs/heads/*'], { cwd: dir, stdio: 'ignore' });
  } else {
    say(`  ${dim('Cloning')} ${url} ${dim('(full history, this can take a moment)')}\n`);
    mkdirSync(dirname(dir), { recursive: true });
    const res = spawnSync('git', ['clone', '--bare', '--quiet', '--single-branch', url, dir], { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
    if (res.status !== 0) fail(`Could not clone ${url}\n  ${res.stderr.trim()}`);
  }
  return { dir, remote: url };
}

function openInBrowser(file) {
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const argv = process.platform === 'win32' ? ['/c', 'start', '', file] : [file];
  try {
    spawn(cmd, argv, { stdio: 'ignore', detached: true }).unref();
  } catch {
    // No browser available; the path is printed anyway.
  }
}

say(`\n  🐉 ${color ? '\x1b[1mhere-be-dragons\x1b[0m' : 'here-be-dragons'} ${dim(`v${pkg.version}`)}\n\n`);
const target = resolveTarget(args.positionals[0]);
const outDir = resolve(opt.out ?? 'here-be-dragons');
const exclude = [...opt.exclude];
const rel = relative(target.dir, outDir).replace(/\\/g, '/');
if (rel && !rel.startsWith('..')) exclude.push(`${rel}/**`); // never map our own output

let last = '';
const t0 = Date.now();
let realm;
try {
  realm = await analyze(target.dir, {
    since: opt.since,
    maxCommits: opt['max-commits'] ? Number(opt['max-commits']) : undefined,
    exclude,
    onProgress: (step) => {
      if (last) say(` ${green('✓')}\n`);
      say(`  ${step}…`);
      last = step;
    },
  });
} catch (err) {
  if (last) say('\n');
  fail(/not a git repository/i.test(err.message) ? `"${target.dir}" is not a git repository.` : err.message);
}
say(` ${green('✓')}\n`);
if (realm.stats.shallow) {
  say(`  ${color ? '\x1b[33m!\x1b[0m' : '!'} Shallow clone: the chronicles are incomplete. Run ${dim('git fetch --unshallow')} for a truer map.\n`);
}
say('  Drawing the map…');
const geo = layout(realm, { seed: opt.seed ?? realm.name });
say(` ${green('✓')} ${dim(`${((Date.now() - t0) / 1000).toFixed(1)}s`)}\n`);

if (opt.json) {
  process.stdout.write(`${JSON.stringify(toJSON(realm, { full: opt.full }), null, 2)}\n`);
  process.exit(0);
}
if (opt.md) {
  process.stdout.write(toMarkdown(realm, { svgPath: opt.svg }));
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const svg = renderSVG(realm, geo, { theme: opt.theme });
const htmlPath = join(outDir, 'map.html');
const svgPath = join(outDir, 'map.svg');
writeFileSync(htmlPath, renderHTML(realm, geo, renderSVG(realm, geo, { theme: opt.theme, interactive: true })));
writeFileSync(svgPath, svg);
writeFileSync(join(outDir, 'realm.json'), `${JSON.stringify(toJSON(realm), null, 2)}\n`);
const outputs = [['Map', relative(process.cwd(), htmlPath) || htmlPath], ['SVG', relative(process.cwd(), svgPath)]];
if (opt.svg) {
  const extra = resolve(opt.svg);
  mkdirSync(dirname(extra), { recursive: true });
  writeFileSync(extra, svg);
  outputs.push(['Embed', `![Map of ${realm.name}](${relative(process.cwd(), extra).replace(/\\/g, '/')})`]);
}

if (!opt.quiet) process.stderr.write(toTerminal(realm, { color, outputs }));
const shouldOpen = opt.open && !opt['no-open'] && process.stdout.isTTY && !process.env.CI;
if (shouldOpen) openInBrowser(htmlPath);
