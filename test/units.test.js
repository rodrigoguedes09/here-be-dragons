import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRenamePath, parseLog } from '../src/git.js';
import { classify, stem, canHostDragon, isTestPath } from '../src/classify.js';
import { measure, detectAI, isBot, globToRegex } from '../src/analyze.js';
import { chain, chaikin, labelFor } from '../src/layout.js';
import { dragonName, rng, seaNames } from '../src/names.js';

test('parseRenamePath understands both rename notations', () => {
  assert.deepEqual(parseRenamePath('src/{old => new}/a.js'), ['src/old/a.js', 'src/new/a.js']);
  assert.deepEqual(parseRenamePath('src/{ => lib}/a.js'), ['src/a.js', 'src/lib/a.js']);
  assert.deepEqual(parseRenamePath('{lib => }/a.js'), ['lib/a.js', 'a.js']);
  assert.deepEqual(parseRenamePath('old.js => new.js'), ['old.js', 'new.js']);
  assert.deepEqual(parseRenamePath('plain/path.js'), ['plain/path.js', 'plain/path.js']);
});

test('parseLog folds history through renames onto the current name', () => {
  const RS = '\x1e';
  const US = '\x1f';
  const GS = '\x1d';
  const rec = (hash, author, ts, msg, stats) => `${RS}${hash}${US}${author}${US}${author}@x.io${US}${ts}${US}${msg}${GS}\n${stats}\n`;
  const raw =
    rec('c3', 'Ana', 300, 'edit new', '5\t1\tsrc/new.js') +
    rec('c2', 'Ana', 200, 'rename', '0\t0\tsrc/{old.js => new.js}') +
    rec('c1', 'Bo', 100, 'create', '40\t0\tsrc/old.js\n-\t-\timg.png');
  const commits = parseLog(raw);
  assert.equal(commits.length, 3);
  assert.deepEqual(commits.map((c) => c.changes.map((x) => x.path)), [['src/new.js'], ['src/new.js'], ['src/new.js', 'img.png']]);
  assert.equal(commits[2].changes[0].added, 40);
  assert.equal(commits[2].changes[1].added, 0, 'binary stats count as zero');
  assert.equal(commits[0].time, 300000);
});

test('classify keeps code, recognizes tests and drops generated files', () => {
  assert.equal(classify('src/app.ts'), 'code');
  assert.equal(classify('src/app.test.ts'), 'test');
  assert.equal(classify('tests/test_api.py'), 'test');
  assert.equal(classify('pkg/server_test.go'), 'test');
  assert.equal(classify('README.md'), 'docs');
  assert.equal(classify('package.json'), 'config');
  assert.equal(classify('Makefile'), 'code');
  assert.equal(classify('package-lock.json'), null);
  assert.equal(classify('dist/bundle.js'), null);
  assert.equal(classify('node_modules/x/index.js'), null);
  assert.equal(classify('web/app.min.js'), null);
  assert.equal(classify('logo.png'), null);
  assert.equal(canHostDragon('CHANGELOG.md', 'docs'), false);
  assert.equal(canHostDragon('src/core.rs', 'code'), true);
  assert.equal(canHostDragon('types/index.d.ts', 'code'), false, 'declaration files are not hotspots');
  assert.equal(isTestPath('src/__tests__/a.js'), true);
});

test('stem pairs sources with their tests without mangling plain names', () => {
  assert.equal(stem('src/parser.ts'), stem('test/parser.test.ts'));
  assert.equal(stem('app/api.py'), stem('tests/test_api.py'));
  assert.equal(stem('Foo.java'), stem('FooTest.java'));
  assert.equal(stem('src/split.js'), 'split');
  assert.equal(stem('src/commit.ts'), 'commit');
});

test('measure counts lines, nesting and TODOs', () => {
  const m = measure('a\n  b\n    c // TODO fix\n\n  d\n');
  assert.equal(m.loc, 4);
  assert.equal(m.maxDepth, 2);
  assert.equal(m.complexity, 0 + 1 + 2 + 1);
  assert.equal(m.todos, 1);
  assert.equal(measure('x\n\ty\n\t\tz').maxDepth, 2, 'tabs are indentation too');
});

test('detectAI recognizes agent trailers and bots', () => {
  const c = (message, author = 'Dev', email = 'dev@x.io') => ({ message, author, email });
  assert.equal(detectAI(c('fix\n\nCo-Authored-By: Claude <noreply@anthropic.com>')), 'Claude');
  assert.equal(detectAI(c('feat', 'Copilot', 'copilot-swe-agent@users.noreply.github.com')), 'Copilot');
  assert.equal(detectAI(c('feat\n\nCo-authored-by: Cursor <cursoragent@cursor.com>')), 'Cursor');
  assert.equal(detectAI(c('aider: refactor parser')), 'Aider');
  assert.equal(detectAI(c('handwritten with love')), null);
  assert.equal(isBot(c('bump deps', 'renovate[bot]', '29139614+renovate[bot]@users.noreply.github.com')), true);
  assert.equal(isBot(c('chore', 'dependabot[bot]')), true);
  assert.equal(isBot(c('fix', 'Ana Lima', 'ana@x.io')), false);
});

test('globToRegex matches folders and files', () => {
  assert.ok(globToRegex('docs/**').test('docs/a/b.md'));
  assert.ok(globToRegex('*.snap').test('src/x/__snap__/a.snap'));
  assert.ok(!globToRegex('docs/**').test('src/docs.ts'));
});

test('chain joins segments into loops and open lines', () => {
  const loops = chain([[1, 2], [2, 3], [3, 1]]);
  assert.equal(loops.length, 1);
  assert.equal(loops[0].closed, true);
  assert.equal(loops[0].ids.length, 3);
  const lines = chain([[1, 2], [2, 3], [3, 4], [3, 5]]);
  const total = lines.reduce((s, l) => s + l.ids.length - 1, 0);
  assert.equal(total, 4, 'every segment is used exactly once');
  assert.ok(lines.every((l) => !l.closed));
  const smooth = chaikin([[0, 0], [10, 0], [10, 10]], false, 1);
  assert.deepEqual(smooth[0], [0, 0]);
  assert.deepEqual(smooth[smooth.length - 1], [10, 10]);
});

test('names are deterministic', () => {
  assert.equal(dragonName('src/core.js'), dragonName('src/core.js'));
  assert.notEqual(dragonName('src/core.js'), dragonName('src/other.js'));
  const a = rng('seed');
  const b = rng('seed');
  assert.equal(a(), b());
  assert.deepEqual(seaNames('x', 3), seaNames('x', 3));
  assert.equal(new Set(seaNames('x', 4)).size, 4);
});

test('labelFor adds the folder to generic file names', () => {
  assert.equal(labelFor('src/router/index.ts'), 'router/index.ts');
  assert.equal(labelFor('src/router/matcher.ts'), 'matcher.ts');
  assert.equal(labelFor('index.js'), 'index.js');
});
