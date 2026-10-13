// Decide which files belong on the map and what kind of land they are.

const CODE = new Set([
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'vue', 'svelte', 'astro',
  'py', 'pyx', 'rb', 'php', 'go', 'rs', 'java', 'kt', 'kts', 'scala', 'groovy', 'clj', 'cljs',
  'c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'hh', 'hxx', 'm', 'mm', 'cs', 'fs', 'vb', 'swift',
  'dart', 'lua', 'pl', 'pm', 'r', 'jl', 'ex', 'exs', 'erl', 'hrl', 'hs', 'ml', 'mli', 'elm',
  'zig', 'nim', 'v', 'sol', 'cr', 'd', 'f90', 'f', 'ada', 'pas', 'gd', 'odin', 'mojo', 'gleam',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'psm1', 'bat', 'sql', 'graphql', 'gql', 'proto',
  'tf', 'hcl', 'nix', 'cmake', 'gradle', 'wgsl', 'glsl', 'hlsl', 'metal', 'cu', 'vhd', 'sv',
]);
const STYLE = new Set(['css', 'scss', 'sass', 'less', 'styl', 'pcss']);
const MARKUP = new Set(['html', 'htm', 'xml', 'xaml', 'hbs', 'ejs', 'erb', 'twig', 'liquid', 'njk', 'pug', 'jinja', 'j2']);
const DOCS = new Set(['md', 'mdx', 'rst', 'adoc', 'txt', 'tex', 'org']);
const CONFIG = new Set(['json', 'jsonc', 'json5', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'env', 'properties']);

const NAMED = new Map([
  ['makefile', 'code'], ['dockerfile', 'config'], ['rakefile', 'code'], ['gemfile', 'config'],
  ['justfile', 'code'], ['vagrantfile', 'code'], ['podfile', 'config'], ['brewfile', 'config'],
]);

const LOCKFILES = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|Pipfile\.lock|uv\.lock|composer\.lock|Gemfile\.lock|go\.sum|mix\.lock|flake\.lock|packages\.lock\.json|gradle\.lockfile|pubspec\.lock|Package\.resolved)$/;
const GENERATED_DIRS = /(^|\/)(node_modules|vendor|third_party|third-party|thirdparty|dist|build|out|target|coverage|\.next|\.nuxt|\.svelte-kit|__pycache__|\.venv|venv|bower_components|Pods|DerivedData|\.yarn|\.pnpm-store|site-packages|generated|__generated__|gen)\//;
const GENERATED_FILES = /(\.min\.(js|css)|\.bundle\.js|\.map|\.snap|\.pb\.go|_pb2\.py|_pb2_grpc\.py|\.generated\.\w+|\.g\.dart|\.freezed\.dart|\.designer\.cs|-lock\.\w+)$/i;
const CHANGELOGS = /(^|\/)(CHANGELOG|CHANGES|HISTORY|RELEASES?|NEWS)(\.\w+)?$/i;

const TEST_PATH = /(^|\/)(tests?|__tests__|specs?|testing|e2e|cypress|playwright|fixtures?|__mocks__|testdata|test-data|integration-tests?)\//i;
const TEST_FILE = /(\.(test|spec|e2e|cy)\.[a-z]+$)|(_test\.(go|py|rb|exs|dart|cc|cpp|c|rs)$)|((^|\/)test_[^/]+\.py$)|((Test|Tests|Spec|IT)\.(java|kt|scala|cs|swift|groovy)$)|(_spec\.rb$)|(\.t$)/;

export function extension(path) {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase();
}

export function basename(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function isTestPath(path) {
  return TEST_PATH.test(path) || TEST_FILE.test(path);
}

/**
 * Returns the kind of land a file is, or null when it should be left off the map.
 * Kinds: code | test | style | markup | docs | config
 */
export function classify(path) {
  if (LOCKFILES.test(path) || GENERATED_DIRS.test(path) || GENERATED_FILES.test(path)) return null;
  const base = basename(path).toLowerCase();
  const ext = extension(path);
  let kind = NAMED.get(base) ?? null;
  if (!kind) {
    if (CODE.has(ext)) kind = 'code';
    else if (STYLE.has(ext)) kind = 'style';
    else if (MARKUP.has(ext)) kind = 'markup';
    else if (DOCS.has(ext)) kind = 'docs';
    else if (CONFIG.has(ext)) kind = 'config';
    else return null;
  }
  if (kind === 'code' && isTestPath(path)) return 'test';
  return kind;
}

/** Only real code can host a dragon: churn in docs, changelogs and config is expected. */
export function canHostDragon(path, kind) {
  return kind === 'code' && !CHANGELOGS.test(path) && !/\.d\.[cm]?ts$/.test(path);
}

export function language(path) {
  const ext = extension(path);
  const names = {
    js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', mts: 'TypeScript',
    cts: 'TypeScript', tsx: 'TypeScript', py: 'Python', rb: 'Ruby', php: 'PHP', go: 'Go', rs: 'Rust', java: 'Java',
    kt: 'Kotlin', kts: 'Kotlin', scala: 'Scala', c: 'C', h: 'C', cc: 'C++', cpp: 'C++', cxx: 'C++', hpp: 'C++',
    cs: 'C#', swift: 'Swift', dart: 'Dart', lua: 'Lua', ex: 'Elixir', exs: 'Elixir', hs: 'Haskell', zig: 'Zig',
    vue: 'Vue', svelte: 'Svelte', css: 'CSS', scss: 'SCSS', html: 'HTML', md: 'Markdown', sh: 'Shell', sql: 'SQL',
  };
  return names[ext] ?? (ext ? ext.toUpperCase() : basename(path));
}

/** The "stem" used to pair a source file with its tests: src/foo/Bar.ts -> bar */
export function stem(path) {
  let b = basename(path).replace(/\.[^.]+$/, '');
  if (isTestPath(path)) {
    b = b
      .replace(/\.(test|spec|e2e|cy)$/i, '')
      .replace(/^test_/i, '')
      .replace(/_(test|spec)$/i, '')
      .replace(/(Tests?|Spec|IT)$/, '');
  }
  return b.toLowerCase();
}

/** Area a file takes on the map: prose and config count for less than code. */
export function areaWeight(f) {
  if (TEST_DATA.test(f.path)) return f.loc * 0.12;
  return f.kind === 'code' ? f.loc : f.kind === 'test' ? f.loc * 0.6 : f.loc * 0.4;
}

/** Fixtures, snapshots and recorded test data: real files, but not where the code lives. */
const TEST_DATA = /(^|\/)(fixtures?|__fixtures__|__snapshots__|snapshots?|testdata|test-data|samples|golden|expected|__testfixtures__)\//i;
