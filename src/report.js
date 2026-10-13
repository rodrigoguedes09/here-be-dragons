// Text outputs: the terminal summary, a Markdown report and JSON for agents and CI.
import { realmTitle } from './names.js';
import { chronicle, quests, paragraphText, realmBusFactor } from './chronicle.js';

const n = (x) => x.toLocaleString('en-US');
const kloc = (x) => (x >= 10000 ? `${Math.round(x / 1000)}k` : x >= 1000 ? `${Math.round(x / 100) / 10}k` : String(x));

/** Lean, stable JSON for agents and CI: what to look at, and why. */
export function toJSON(realm, { full = false } = {}) {
  const files = realm.files;
  const hotspots = files
    .filter((f) => f.hotspot > 0)
    .sort((a, b) => b.hotspot - a.hotspot)
    .slice(0, 25)
    .map((f) => ({
      path: f.path,
      score: round(f.hotspot),
      revisions: f.revisions,
      loc: f.loc,
      maxDepth: f.maxDepth,
      authors: f.authorCount,
      owner: f.owner,
      tested: f.tested,
      ruin: f.ruin,
      aiShare: round(f.aiShare),
    }));
  const out = {
    tool: 'here-be-dragons',
    schema: 1,
    name: realm.name,
    generatedAt: realm.generatedAt,
    head: realm.head.hash,
    stats: { ...realm.stats, busFactor: realmBusFactor(realm), provinces: realm.provinces.length },
    dragons: realm.dragons.map(({ file, ...d }) => d),
    quests: quests(realm),
    hotspots,
    coupling: realm.routes.map((r) => ({ a: files[r.a].path, b: files[r.b].path, shared: r.shared, degree: round(r.degree) })),
    provinces: realm.provinces.map((p) => ({
      path: p.path || '.',
      heartland: p.loose,
      files: p.files.length,
      loc: p.loc,
      owner: p.owner,
      busFactor: p.busFactor,
      tested: round(p.tested),
      aiShare: round(p.aiShare),
      ruinShare: round(p.ruinShare),
    })),
    knowledgeLoss: files
      .filter((f) => f.ruin)
      .sort((a, b) => b.loc - a.loc)
      .slice(0, 20)
      .map((f) => ({ path: f.path, owner: f.owner, ownerShare: round(f.ownerShare), loc: f.loc })),
    chronicle: chronicle(realm).map((p) => paragraphText(p)),
  };
  if (full) {
    out.files = files.map((f) => ({
      path: f.path,
      kind: f.kind,
      lang: f.lang,
      loc: f.loc,
      complexity: f.complexity,
      maxDepth: f.maxDepth,
      revisions: f.revisions,
      authors: f.authorCount,
      owner: f.owner,
      ageDays: f.ageDays,
      hotspot: round(f.hotspot),
      tested: f.tested,
      aiShare: round(f.aiShare),
      ruin: f.ruin,
      todos: f.todos,
    }));
  }
  return out;
}

export function toMarkdown(realm, { svgPath } = {}) {
  const s = realm.stats;
  const short = realmTitle(realm.name);
  const lines = [];
  lines.push(`# 🐉 The Realm of ${short}`, '');
  if (svgPath) lines.push(`![Map of ${short}](${svgPath})`, '');
  lines.push(
    `| Settlements | Lines | Commits | Souls | Provinces | Dragons | Bus factor |`,
    `|---:|---:|---:|---:|---:|---:|---:|`,
    `| ${n(s.files)} | ${kloc(s.loc)} | ${n(s.commits)} | ${n(s.authors)} | ${realm.provinces.length} | ${realm.dragons.length} | ${realmBusFactor(realm)} |`,
    '',
  );
  lines.push('## Chronicle', '');
  for (const p of chronicle(realm)) lines.push(paragraphText(p, { markdown: true }), '');
  if (realm.dragons.length) {
    lines.push('## Dragons', '', 'Hotspots: complex code that keeps changing. Defects concentrate here.', '');
    lines.push('| # | Dragon | File | Commits | Lines | Depth | Authors |', '|---:|---|---|---:|---:|---:|---:|');
    realm.dragons.forEach((d, i) =>
      lines.push(`| ${i + 1} | **${d.name}** ${d.title} | \`${d.path}\` | ${n(d.revisions)} | ${n(d.loc)} | ${d.maxDepth} | ${d.authors} |`),
    );
    lines.push('');
  }
  const qs = quests(realm);
  if (qs.length) {
    lines.push('## Quests', '');
    for (const q of qs) lines.push(`- **${q.title}** (\`${q.path}\`${q.other ? ` ⇄ \`${q.other}\`` : ''}): ${q.why} ${q.how}`);
    lines.push('');
  }
  lines.push('---', '', '<sub>Charted by [here-be-dragons](https://github.com/rodrigoguedes09/here-be-dragons).</sub>', '');
  return lines.join('\n');
}

/** Colorful terminal summary. */
export function toTerminal(realm, { color = true, outputs = [] } = {}) {
  const c = (code) => (s) => (color ? `\x1b[${code}m${s}\x1b[0m` : String(s));
  const red = c('31');
  const dim = c('2');
  const bold = c('1');
  const yellow = c('33');
  const cyan = c('36');
  const s = realm.stats;
  const short = realmTitle(realm.name);
  const out = [];
  out.push('', `  ${bold(`THE REALM OF ${short.toUpperCase()}`)}`);
  out.push(`  ${dim(`${n(s.files)} settlements · ${kloc(s.loc)} lines · ${n(s.commits)} commits · ${n(s.authors)} souls · ${realm.provinces.length} provinces`)}`);
  if (s.aiCommits) out.push(`  ${dim(`${Math.round(s.aiShare * 1000) / 10}% forged by AI agents (${s.aiTools.map((t) => t.tool).join(', ')})`)}`);
  out.push('');
  if (realm.dragons.length) {
    out.push(`  ${red('🐉 Dragons sighted')} ${dim('(complex code that keeps changing)')}`);
    const width = Math.max(...realm.dragons.map((d) => `${d.name} ${d.title}`.length));
    const pathWidth = Math.min(56, Math.max(...realm.dragons.map((d) => d.path.length)));
    realm.dragons.forEach((d, i) => {
      const who = `${d.name} ${d.title}`.padEnd(width);
      out.push(`  ${dim(String(i + 1).padStart(2))}. ${red(who)}  ${d.path.padEnd(pathWidth)}  ${dim(`${n(d.revisions)} commits · ${n(d.loc)} lines · depth ${d.maxDepth}`)}`);
    });
  } else {
    out.push(`  ${yellow('No dragons sighted.')} ${dim('The realm is calm.')}`);
  }
  const qs = quests(realm).slice(0, 5);
  if (qs.length) {
    out.push('', `  ${yellow('⚔ Quests')}`);
    for (const q of qs) out.push(`   • ${q.title} ${dim(`— ${q.path}`)}`);
  }
  if (outputs.length) {
    out.push('');
    for (const [label, path] of outputs) out.push(`  ${cyan(label.padEnd(5))} ${path}`);
  }
  out.push('');
  return out.join('\n');
}

function round(x) {
  return Math.round(x * 1000) / 1000;
}
