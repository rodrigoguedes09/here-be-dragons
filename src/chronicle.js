// The realm told as a story, plus the quests worth taking on.
// Every sentence is generated from the analysis; nothing is invented.
import { realmTitle } from './names.js';

const n = (x) => x.toLocaleString('en-US');
const pct = (x) => `${x >= 0.1 ? Math.round(x * 100) : Math.round(x * 1000) / 10}%`;
const kloc = (x) => (x >= 10000 ? `${Math.round(x / 1000)}k` : x >= 1000 ? `${Math.round(x / 100) / 10}k` : String(x));
const month = (t) => new Date(t).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Chronicle paragraphs. Each paragraph is a list of segments:
 * strings, or { b: text } for emphasis, or { code: path } for a file.
 */
export function chronicle(realm) {
  const { stats: s, files, provinces, dragons, routes, authors } = realm;
  const short = realmTitle(realm.name);
  const out = [];

  const years = s.firstCommit ? Math.max(1, Math.round((s.lastCommit - s.firstCommit) / (365.25 * 86400000))) : 0;
  out.push([
    'The realm of ', { b: short }, s.firstCommit ? ` was founded in ${month(s.firstCommit)}.` : '.',
    ` Over ${years} year${years === 1 ? '' : 's'}, ${n(s.authors)} soul${s.authors === 1 ? '' : 's'} left their mark across ${n(s.commits)} commit${s.commits === 1 ? '' : 's'}`,
    s.truncated ? ' (the oldest chronicles were not read)' : '',
    `. Today ${n(s.activeAuthors)} still walk its roads.`,
  ]);

  const bigProv = [...provinces].sort((a, b) => b.loc - a.loc);
  const provSeg = ['It spans ', `${n(s.files)} settlements and ${kloc(s.loc)} lines across ${provinces.length} province${provinces.length === 1 ? '' : 's'}.`];
  if (bigProv.length > 1) {
    provSeg.push(' The greatest is ', { b: label(bigProv[0]) }, ` (${kloc(bigProv[0].loc)} lines)`);
    if (bigProv.length > 2) provSeg.push(', followed by ', { b: label(bigProv[1]) }, ' and ', { b: label(bigProv[2]) });
    provSeg.push('.');
  }
  if (s.languages.length) provSeg.push(` Its people speak mostly ${s.languages.slice(0, 3).map((l) => l.name).join(', ')}.`);
  out.push(provSeg);

  if (dragons.length) {
    const d = dragons[0];
    out.push([
      `${dragons.length} dragon${dragons.length === 1 ? ' has' : 's have'} been sighted. The mightiest, `,
      { b: `${d.name} ${d.title}` }, ', lairs in ', { code: d.path },
      `: ${n(d.loc)} lines nested up to ${d.maxDepth} levels deep, reshaped in ${n(d.revisions)} commits by ${n(d.authors)} hand${d.authors === 1 ? '' : 's'}.`,
      ' Dragons nest where complex code keeps changing; that is where bugs breed, and where refactoring pays off first.',
    ]);
  } else {
    out.push(['No dragons have been sighted. Either the realm is young, or its complex code is left in peace. Rare and lucky.']);
  }

  const ruinShare = s.loc ? s.ruinLoc / s.loc : 0;
  if (s.ruinLoc > 0) {
    const worst = files.filter((f) => f.ruin).sort((a, b) => b.loc - a.loc)[0];
    out.push([
      `${pct(ruinShare)} of the realm lies in ruins: code whose main author has not committed here in half a year. The largest is `,
      { code: worst.path }, `, built by ${worst.owner}.`,
    ]);
  } else if (s.commits > 20) {
    out.push(['There are no ruins. Every corner of the realm still has a living keeper.']);
  }

  if (authors.length) {
    const top = authors[0];
    const share = s.loc ? top.ownedLoc / s.loc : 0;
    const busFactor = realmBusFactor(realm);
    out.push([
      'House ', { b: top.name }, ` holds ${pct(share)} of the land.`,
      busFactor <= 2
        ? ` If ${busFactor === 1 ? 'that one soul' : 'two souls'} left, half the realm's knowledge would leave with ${busFactor === 1 ? 'them' : 'them both'}.`
        : ` Knowledge is spread well: it would take ${busFactor} departures to lose half of it.`,
    ]);
  }

  if (s.aiCommits > 0) {
    const tools = s.aiTools.map((t) => `${t.tool} ×${n(t.commits)}`).join(', ');
    out.push([`${pct(s.aiShare)} of the realm was forged by AI agents, across ${n(s.aiCommits)} signed commits (${tools}).`]);
  } else if (s.commits > 20) {
    out.push(['No AI agent has signed its work here. Every line was laid by human hands (or by agents too shy to say so).']);
  }

  const ancient = files.filter((f) => f.ancient).reduce((a, f) => a + f.loc, 0);
  const extras = [];
  if (s.loc && ancient / s.loc > 0.05) extras.push(`Ancient forests cover ${pct(ancient / s.loc)} of the land: code untouched for two years or more.`);
  const code = files.filter((f) => f.kind === 'code').length;
  if (code) extras.push(`${pct(s.tested)} of its code cities stand behind walls of tests.`);
  if (s.todos) extras.push(`${n(s.todos)} TODOs and FIXMEs sink into the marshes.`);
  if (extras.length) out.push([extras.join(' ')]);

  if (routes.length) {
    const r = routes[0];
    out.push([
      'The busiest road runs between ', { code: files[r.a].path }, ' and ', { code: files[r.b].path },
      `: they changed together in ${n(r.shared)} commits. Files that always move together are bound by a dependency the code may not show.`,
    ]);
  }
  return out;
}

/** Concrete, prioritized work items derived from the map. */
export function quests(realm) {
  const { files, dragons, routes } = realm;
  const q = [];
  for (const d of dragons.slice(0, 5)) {
    q.push({
      kind: 'slay',
      title: `Slay ${d.name} ${d.title}`,
      path: d.path,
      why: `${d.loc} lines, nesting depth ${d.maxDepth}, changed in ${d.revisions} commits by ${d.authors} authors (hotspot score ${d.score}).`,
      how: 'Split it along its responsibilities, extract the deepest nested blocks, and add tests around the parts that change most.',
    });
  }
  const unwalled = dragons.filter((d) => !files[d.file].tested).slice(0, 3);
  for (const d of unwalled) {
    q.push({
      kind: 'fortify',
      title: `Raise walls around ${base(d.path)}`,
      path: d.path,
      why: 'A dragon lairs here and no matching test file was found.',
      how: 'Add characterization tests before changing it further.',
    });
  }
  const ruins = files.filter((f) => f.ruin && f.revisions > 3).sort((a, b) => b.hotspot - a.hotspot || b.loc - a.loc).slice(0, 3);
  for (const f of ruins) {
    q.push({
      kind: 'rebuild',
      title: `Find a new keeper for ${base(f.path)}`,
      path: f.path,
      why: `${Math.round(f.ownerShare * 100)}% of it was written by ${f.owner}, who has not committed here in over six months.`,
      how: 'Spread the knowledge: pair someone else with it, document its intent, and review it together.',
    });
  }
  for (const r of routes.slice(0, 3)) {
    q.push({
      kind: 'survey',
      title: `Survey the road ${base(files[r.a].path)} ⇄ ${base(files[r.b].path)}`,
      path: files[r.a].path,
      other: files[r.b].path,
      why: `Changed together in ${r.shared} commits (${Math.round(r.degree * 100)}% coupling).`,
      how: 'Either make the dependency explicit (shared module, interface) or move what changes together into one place.',
    });
  }
  return q;
}

/** How many top authors hold half the realm's knowledge (by lines touched). */
export function realmBusFactor(realm) {
  const lines = new Map();
  for (const f of realm.files) for (const [k, v] of f.authorLines ?? []) lines.set(k, (lines.get(k) ?? 0) + v);
  const ranked = [...lines.values()].sort((a, b) => b - a);
  const total = ranked.reduce((a, b) => a + b, 0);
  let acc = 0;
  let k = 0;
  for (const v of ranked) {
    k++;
    acc += v;
    if (acc >= total / 2) break;
  }
  return Math.max(1, k);
}

/** Flatten a chronicle paragraph to text (markdown or plain). */
export function paragraphText(p, { markdown = false } = {}) {
  return p
    .map((seg) => {
      if (typeof seg === 'string') return seg;
      if (seg.b) return markdown ? `**${seg.b}**` : seg.b;
      if (seg.code) return markdown ? `\`${seg.code}\`` : seg.code;
      return '';
    })
    .join('');
}

function label(p) {
  const name = (p.path || '(root)').replace(' (heartland)', '');
  return name || 'the heartland';
}

function base(path) {
  return path.split('/').pop();
}
