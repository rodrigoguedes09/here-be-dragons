// Build docs/index.html (the GitHub Pages landing page) from docs/gallery.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { realmTitle } from '../src/names.js';

const gallery = Object.values(JSON.parse(readFileSync('docs/gallery.json', 'utf8')));
const ORDER = ['facebook-react', 'vuejs-core', 'django-django', 'rails-rails', 'sveltejs-svelte', 'vitejs-vite', 'tailwindlabs-tailwindcss', 'fastapi-fastapi', 'expressjs-express', 'pallets-flask', 'colinhacks-zod'];
gallery.sort((a, b) => (ORDER.indexOf(a.slug) + 1 || 99) - (ORDER.indexOf(b.slug) + 1 || 99));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const n = (x) => x.toLocaleString('en-US');
const k = (x) => (x >= 1e6 ? `${Math.round(x / 1e5) / 10}M` : x >= 1e4 ? `${Math.round(x / 1e3)}k` : n(x));
const REPO = 'https://github.com/rodrigoguedes09/here-be-dragons';

const cards = gallery
  .map(
    (g) => `<a class="card" href="atlas/${g.slug}.html">
      <img src="atlas/${g.slug}.jpg" alt="Fantasy map of ${esc(g.name)}" loading="lazy" width="1200" height="825">
      <div class="meta">
        <h3>${esc(realmTitle(g.name))}<span>${esc(g.name)}</span></h3>
        <p>${k(g.files)} settlements · ${k(g.commits)} commits · ${g.dragons} dragon${g.dragons === 1 ? '' : 's'}</p>
        ${g.top ? `<p class="dragon">🐉 ${esc(g.top.name)}<br><code>${esc(g.top.path)}</code></p>` : ''}
      </div>
    </a>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>here-be-dragons: turn any git repo into a fantasy map</title>
<meta name="description" content="Turn any git repository into a fantasy map. Dragons mark your real hotspots: complex code that keeps changing. One command, runs locally.">
<meta property="og:title" content="here-be-dragons: turn any git repo into a fantasy map">
<meta property="og:description" content="The dragons are real. They mark your hotspots. npx here-be-dragons">
<meta property="og:image" content="https://rodrigoguedes09.github.io/here-be-dragons/assets/social.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🐉</text></svg>')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=swap" rel="stylesheet">
<style>
:root{--paper:#efe0bb;--paper2:#f6ecd2;--ink:#3a2716;--soft:#6b4f33;--red:#7c1d14;--line:rgba(58,39,22,.25)}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:18px/1.6 'EB Garamond',Palatino,Georgia,serif}
a{color:var(--red)}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
header.hero{text-align:center;padding:56px 0 18px}
.kicker{font:14px 'IM Fell English SC',Georgia,serif;letter-spacing:4px;color:var(--soft)}
h1{font:clamp(44px,8vw,86px)/1 'IM Fell English',Georgia,serif;margin:10px 0 8px}
.tag{font:italic clamp(20px,3vw,27px)/1.3 'IM Fell English',Georgia,serif;color:var(--soft);margin:0 0 26px}
.cmd{display:inline-flex;align-items:center;gap:12px;background:#2a2118;color:#f6ecd2;padding:12px 14px 12px 20px;font:18px ui-monospace,Consolas,monospace;border:1px solid var(--ink);box-shadow:0 8px 24px rgba(40,25,10,.25)}
.cmd button{font:14px 'EB Garamond',serif;background:var(--paper2);color:var(--ink);border:0;padding:6px 12px;cursor:pointer}
.links{margin:18px 0 0;font-size:17px}
.links a{margin:0 10px}
.heroimg{display:block;margin:34px auto 0;width:100%;border:1px solid var(--ink);box-shadow:0 14px 40px rgba(40,25,10,.3)}
section{padding:40px 0}
h2{font:34px 'IM Fell English',Georgia,serif;text-align:center;margin:0 0 6px}
.lede{text-align:center;color:var(--soft);font-style:italic;margin:0 auto 26px;max-width:720px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:22px}
.card{display:block;text-decoration:none;color:inherit;background:var(--paper2);border:1px solid var(--ink);box-shadow:0 6px 18px rgba(40,25,10,.15);transition:transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(40,25,10,.25)}
.card img{display:block;width:100%;height:auto;border-bottom:1px solid var(--line)}
.card .meta{padding:10px 14px 12px}
.card h3{font:24px 'IM Fell English',Georgia,serif;margin:0;display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.card h3 span{font:13px 'EB Garamond',serif;color:var(--soft)}
.card p{margin:2px 0 0;font-size:15px;color:var(--soft)}
.card .dragon{color:var(--red)}
.card code{font:12px ui-monospace,Consolas,monospace;color:var(--ink);word-break:break-all}
.legend{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px 26px;max-width:980px;margin:0 auto}
.legend div{border-top:1px solid var(--line);padding-top:8px}
.legend b{font:19px 'IM Fell English',Georgia,serif}
.legend p{margin:2px 0 0;font-size:16px;color:var(--soft)}
pre{background:#2a2118;color:#f6ecd2;padding:16px 18px;overflow:auto;font:15px/1.5 ui-monospace,Consolas,monospace;border:1px solid var(--ink)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start}
@media(max-width:800px){.two{grid-template-columns:1fr}}
footer{text-align:center;padding:30px 0 50px;color:var(--soft);font-size:16px;border-top:1px solid var(--line)}
</style>
</head>
<body>
<header class="hero wrap">
  <div class="kicker">Hic sunt dracones</div>
  <h1>here-be-dragons</h1>
  <p class="tag">Turn any git repo into a fantasy map. The dragons are real.</p>
  <div class="cmd"><span>npx here-be-dragons</span><button onclick="navigator.clipboard.writeText('npx here-be-dragons');this.textContent='Copied'">Copy</button></div>
  <div class="links"><a href="${REPO}">GitHub</a> · <a href="#gallery">Gallery</a> · <a href="#legend">How to read a map</a> · <a href="#agents">For AI agents</a></div>
  <a href="atlas/vuejs-core.html"><img class="heroimg" src="assets/hero.jpg" alt="Vue's core repository as a fantasy map"></a>
</header>

<section class="wrap">
  <p class="lede" style="font-size:20px">Old cartographers drew dragons where the known world ended. Your codebase has dragons too: the files that are <b>complex</b> and <b>keep changing</b>, where bugs breed. here-be-dragons reads your git history and draws them, along with the roads between files that secretly change together, the ruins left when authors move on, and the land forged by AI agents.</p>
</section>

<section id="gallery" class="wrap">
  <h2>The Atlas of Famous Realms</h2>
  <p class="lede">Every map below is interactive. Zoom in, hover a settlement, meet the dragons.</p>
  <div class="grid">
${cards}
  </div>
</section>

<section id="legend" class="wrap">
  <h2>How to read a map</h2>
  <p class="lede">Every mark is computed from your repository. Nothing is decoration.</p>
  <div class="legend">
    <div><b>🐉 Dragons</b><p>Hotspots: complex code that changes often. Defects concentrate here.</p></div>
    <div><b>⛰ Mountains</b><p>Deeply nested code.</p></div>
    <div><b>🌲 Ancient forests</b><p>Code untouched for two years or more.</p></div>
    <div><b>🏰 Castles &amp; towns</b><p>The biggest and busiest files.</p></div>
    <div><b>🧱 Walls</b><p>The file has a matching test file.</p></div>
    <div><b>🛤 Roads</b><p>Files that keep changing in the same commits: hidden dependencies.</p></div>
    <div><b>🏚 Ruins</b><p>Code whose main author has not committed in six months.</p></div>
    <div><b>▨ Hatched land</b><p>Lines written in commits signed by AI coding agents.</p></div>
    <div><b>🛡 Great Houses</b><p>Who wrote most of each part of the realm.</p></div>
  </div>
</section>

<section id="agents" class="wrap">
  <h2>For you, and for your agents</h2>
  <p class="lede">Your coding agent should know where the dragons are before it touches your code.</p>
  <div class="two">
    <div>
      <pre># draw your realm
npx here-be-dragons

# any public GitHub repository
npx here-be-dragons facebook/react

# keep a map in your README
npx here-be-dragons --svg .github/realm.svg</pre>
    </div>
    <div>
      <pre># teach your agent (Claude Code, Codex, Cursor…)
npx skills add rodrigoguedes09/here-be-dragons

# or hand it the survey directly
npx here-be-dragons --json</pre>
    </div>
  </div>
</section>

<footer>
  Open source under the MIT license · <a href="${REPO}">github.com/rodrigoguedes09/here-be-dragons</a><br>
  Your code never leaves your machine.
</footer>
</body>
</html>
`;
writeFileSync('docs/index.html', html);
console.log(`docs/index.html with ${gallery.length} realms`);
