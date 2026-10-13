import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const DAY = 86400;

/**
 * Build a throwaway git repository from a list of commits:
 *   { author, email?, daysAgo, message?, files: { 'src/a.js': 'content' } }
 * Times are relative to a fixed epoch so tests are reproducible.
 */
export function makeRepo(commits, { epoch = 1790000000 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hbd-test-'));
  const git = (args, env = {}) => {
    const res = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
    if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
    return res.stdout;
  };
  git(['init', '-q', '-b', 'main']);
  git(['config', 'commit.gpgsign', 'false']);
  git(['config', 'core.autocrlf', 'false']);
  for (const c of commits) {
    for (const [path, content] of Object.entries(c.files ?? {})) {
      const full = join(dir, path);
      if (content === null) {
        rmSync(full, { force: true });
        continue;
      }
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    for (const [from, to] of Object.entries(c.renames ?? {})) git(['mv', from, to]);
    git(['add', '-A']);
    const when = `${epoch - Math.round((c.daysAgo ?? 0) * DAY)} +0000`;
    git(['commit', '-q', '--allow-empty', '-m', c.message ?? 'change'], {
      GIT_AUTHOR_NAME: c.author,
      GIT_AUTHOR_EMAIL: c.email ?? `${c.author.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      GIT_AUTHOR_DATE: when,
      GIT_COMMITTER_NAME: c.author,
      GIT_COMMITTER_EMAIL: c.email ?? 'x@example.com',
      GIT_COMMITTER_DATE: when,
    });
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Source text with `lines` lines nested `depth` levels deep. */
export function code(lines, depth = 1, salt = '') {
  const out = [];
  for (let i = 0; i < lines; i++) {
    const d = 1 + (i % depth);
    out.push(`${'  '.repeat(d)}value_${i}_${salt} = compute(${i});`);
  }
  return `function main() {\n${out.join('\n')}\n}\n`;
}
