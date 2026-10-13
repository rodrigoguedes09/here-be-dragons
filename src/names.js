// Deterministic randomness and the lore that comes with it.

/** 32-bit FNV-1a hash of a string. */
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: tiny, fast, seedable PRNG returning floats in [0, 1). */
export function rng(seed) {
  let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, list) => list[Math.floor(r() * list.length)];

const HEADS = ['Vor', 'Kal', 'Thra', 'Mor', 'Zyr', 'Ash', 'Bal', 'Gor', 'Syl', 'Nyx', 'Dra', 'Ul', 'Ign', 'Fae', 'Rha', 'Ska', 'Vex', 'Tyr', 'Ophi', 'Quel', 'Ser', 'Kor', 'Yth', 'Az', 'Hal', 'Oru', 'Xa', 'Myr'];
const TAILS = ['thrax', 'gorn', 'mir', 'vex', 'lith', 'dros', 'rion', 'zar', 'goth', 'myr', 'nyx', 'thas', 'drake', 'ion', 'oth', 'garde', 'vorn', 'mael', 'sith', 'ruun', 'kesh', 'phyr'];
const LINKS = ['', '', 'a', 'e', 'i', 'o', 'u', 'y'];

/** A dragon name that is stable for a given file path, e.g. "Vorathrax". */
export function dragonName(path) {
  const r = rng(`dragon:${path}`);
  return pick(r, HEADS) + pick(r, LINKS) + pick(r, TAILS);
}

const SEAS = [
  'The Sea of Merge Conflicts', 'The Null Ocean', 'Gulf of Deprecation', 'The Undefined Deep',
  'Bay of Breaking Changes', 'The Endless Backlog', 'Straits of Refactoring', 'The Stack Overflow',
  'Sea of Lost Stashes', 'The Detached Head', 'Mare Legacy', 'The Off-By-One Shoals',
  'Sea of Flaky Tests', 'The Race Condition', 'Bay of Yak Shaving', 'The Dependency Abyss',
];

export function seaNames(seed, n) {
  const r = rng(`seas:${seed}`);
  const pool = [...SEAS];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

/** Province title from its path: "packages/react-dom" -> "React-Dom". */
export function provinceLabel(path) {
  if (!path || path === '(root)') return 'The Heartland';
  const heart = path.endsWith(' (heartland)');
  const outskirts = path.endsWith(' (outskirts)');
  const clean = path.replace(/ \((heartland|outskirts)\)$/, '');
  const last = clean.split('/').filter(Boolean).pop() ?? clean;
  const title = last.replace(/^[._]+/, '') || last;
  if (heart) return `${title} Heartland`;
  if (outskirts) return title ? `${title} Isles` : 'The Scattered Isles';
  return title;
}

const GENERIC_REPOS = /^(core|main|app|web|api|server|client|backend|frontend|monorepo|src|code|repo|project|platform|engine|mono)$/i;

/** The realm's short title: "facebook/react" -> "react", but "vuejs/core" -> "vuejs". */
export function realmTitle(name) {
  const parts = name.split('/');
  const repo = parts.pop();
  return GENERIC_REPOS.test(repo) && parts.length ? parts.pop() : repo;
}
