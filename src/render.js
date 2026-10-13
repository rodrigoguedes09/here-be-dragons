// Geography -> an old-world ink map as a standalone SVG.
import { realmTitle } from './names.js';

export const THEMES = {
  parchment: {
    paper: '#efe0bb',
    sea: '#d3dccb',
    seaInk: '#48606a',
    land: '#f4e8c8',
    ink: '#3a2716',
    inkSoft: '#6b4f33',
    border: '#8e2f25',
    dragon: '#7c1d14',
    route: '#7a4a24',
    hatch: '#2d5d7b',
  },
  midnight: {
    paper: '#0f1720',
    sea: '#13222e',
    seaInk: '#6f93a6',
    land: '#1e2a2c',
    ink: '#d9c9a3',
    inkSoft: '#a8987a',
    border: '#d0704f',
    dragon: '#ff7a59',
    route: '#c9a46a',
    hatch: '#7cc4e8',
  },
};

const FONT = `'IM Fell English', 'IM FELL English', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif`;
const FONT_SC = `'IM Fell English SC', 'IM FELL English SC', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const r1 = (v) => Math.round(v * 10) / 10;
const fmt = (n) => (n >= 1e6 ? `${r1(n / 1e6)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${r1(n / 1e3)}k` : String(n));

function pathOf(lines) {
  let d = '';
  for (const { points, closed } of lines) {
    if (points.length < 2) continue;
    d += `M${r1(points[0][0])},${r1(points[0][1])}`;
    for (let i = 1; i < points.length; i++) d += `L${r1(points[i][0])},${r1(points[i][1])}`;
    if (closed) d += 'Z';
  }
  return d;
}

/** The dragon: a heraldic wyvern drawn in a 100 x 74 box, facing left. */
const DRAGON = (t) => `
  <path d="M43,37 C40,27 37,17 33,6 C27,9 21,12 15,17 C20,19 23,22 24,27 C28,25 32,26 34,31 C37,30 40,32 41,37 Z" fill="${t.dragon}" opacity="0.62" stroke="${t.ink}" stroke-width="1"/>
  <path d="M5,35 C8,32 12,30 16,29 L19,24 L17,16 L23,22 C25,23 27,25 28,27 C33,29 37,34 40,39 C47,35 56,35 64,39 C72,43 81,45 88,42 C93,40 95,36 93,32 L99,33 L96,37 L101,41 L94,40 C92,48 81,54 68,52 C63,56 57,58 52,57 L54,66 L57,68 L49,68 L48,58 C44,58 41,56 38,52 L38,60 L41,62 L33,62 L34,50 C31,44 27,40 22,39 C18,40 13,40 9,38 Z" fill="${t.dragon}" stroke="${t.ink}" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M45,40 C47,28 50,17 55,4 C63,8 73,10 85,14 C79,17 75,22 74,29 C70,26 65,26 62,31 C58,29 54,31 52,37 C50,37 47,38 45,40 Z" fill="${t.dragon}" stroke="${t.ink}" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M55,4 C58,14 59,22 62,31 M55,4 C64,13 69,20 74,29 M55,4 C54,16 53,27 52,37" fill="none" stroke="${t.land}" stroke-width="1" opacity="0.75"/>
  <path d="M60,44 C66,46 72,47 78,46 M50,46 C53,49 55,52 56,55" fill="none" stroke="${t.land}" stroke-width="0.8" opacity="0.45"/>
  <circle cx="14" cy="31.5" r="1.2" fill="${t.land}"/>
  <path d="M5,35 C1,34 -3,36 -6,34 C-3,37 -5,39 -9,40 C-4,41 0,39 3,37" fill="none" stroke="${t.border}" stroke-width="1.3" stroke-linecap="round" opacity="0.85"/>`;

const SYMBOLS = (t) => `
  <symbol id="hbd-mountain" viewBox="-10 -10 20 14" overflow="visible">
    <path d="M-9,3.5 C-6.5,0 -4.5,-3.5 -2.2,-8 C-1,-6.2 0,-5.2 1.3,-5.6 C3.8,-1.8 6.4,1.4 9,3.5" fill="${t.land}" stroke="${t.ink}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M-2.2,-8 C-1.2,-4 -1.4,-0.5 -0.4,3.4 M1.3,-5.6 C1.9,-2.5 2.7,0.6 3.6,3.4 M0.6,-1 L2.6,0.2 M0.2,1.3 L2.8,2.6 M4.3,0.2 L5.8,1.6" fill="none" stroke="${t.ink}" stroke-width="0.55" stroke-linecap="round"/>
  </symbol>
  <symbol id="hbd-tree" viewBox="-4 -7 8 10" overflow="visible">
    <path d="M0,1.8 L0,-1" stroke="${t.ink}" stroke-width="0.7"/>
    <path d="M-2.6,-2.2 C-3.2,-4.6 -1.4,-6.4 0.2,-6 C2.2,-6.4 3.4,-4.2 2.6,-2.2 C2,-0.8 -1.8,-0.6 -2.6,-2.2 Z" fill="${t.land}" stroke="${t.ink}" stroke-width="0.7"/>
    <path d="M0.8,-4.8 C1.6,-4 1.7,-3 1.2,-2.2" fill="none" stroke="${t.ink}" stroke-width="0.4"/>
  </symbol>
  <symbol id="hbd-pine" viewBox="-4 -8 8 11" overflow="visible">
    <path d="M0,2 L0,0.6" stroke="${t.ink}" stroke-width="0.7"/>
    <path d="M0,-7.4 L-2.9,0.8 L2.9,0.8 Z" fill="${t.land}" stroke="${t.ink}" stroke-width="0.7" stroke-linejoin="round"/>
    <path d="M0.4,-5 L1.6,0.4" stroke="${t.ink}" stroke-width="0.4"/>
  </symbol>
  <symbol id="hbd-swamp" viewBox="-5 -5 10 7" overflow="visible">
    <path d="M-4.5,1 h3 M0.6,1 h3.4 M-2.4,2.6 h4.2 M-1.2,1 l-0.7,-3 M-0.3,1 l0,-3.8 M0.6,1 l0.7,-3 M2.8,1 l0.3,-2" fill="none" stroke="${t.ink}" stroke-width="0.55" stroke-linecap="round"/>
  </symbol>
  <symbol id="hbd-grass" viewBox="-3 -3 6 4" overflow="visible">
    <path d="M-1.6,0.6 l-0.7,-2 M0,0.6 l0,-2.5 M1.6,0.6 l0.7,-2" fill="none" stroke="${t.inkSoft}" stroke-width="0.45" stroke-linecap="round" opacity="0.7"/>
  </symbol>
  <symbol id="hbd-ruin" viewBox="-5 -6 10 8" overflow="visible">
    <path d="M-4,2 h8 M-3,2 v-4 l0.6,-0.6 M-1,2 v-2.4 M1,2 v-5.2 l0.8,0.8 M3,2 v-1.6" fill="none" stroke="${t.ink}" stroke-width="0.8" stroke-linecap="round"/>
    <path d="M1.4,-1.6 l-0.6,1.2 0.5,0.8" fill="none" stroke="${t.ink}" stroke-width="0.4"/>
  </symbol>
  <symbol id="hbd-castle" viewBox="-7 -9 14 12" overflow="visible">
    <path d="M-6,2.5 V-3 H-4.6 V-4.4 H-3.4 V-3 H-2 V-6 L0,-8.2 L2,-6 V-3 H3.4 V-4.4 H4.6 V-3 H6 V2.5 Z" fill="${t.land}" stroke="${t.ink}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M-1,2.5 V0.4 C-1,-0.8 1,-0.8 1,0.4 V2.5" fill="${t.ink}"/>
    <path d="M0,-8.2 V-11.4 L3,-10.6 L0,-9.8" fill="${t.border}" stroke="${t.ink}" stroke-width="0.5"/>
  </symbol>
  <symbol id="hbd-city" viewBox="-6 -7 12 10" overflow="visible">
    <path d="M-4.8,2.4 V-1.8 H-3.4 V-3 H-2.2 V-1.8 H-1 V-4.6 L0.2,-5.8 L1.4,-4.6 V-1.8 H2.6 V-3 H3.8 V-1.8 H4.8 V2.4 Z" fill="${t.land}" stroke="${t.ink}" stroke-width="0.85" stroke-linejoin="round"/>
  </symbol>
  <pattern id="hbd-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
    <line x1="0" y1="0" x2="0" y2="5" stroke="${t.hatch}" stroke-width="1.1" opacity="0.55"/>
  </pattern>
  <pattern id="hbd-ruinhatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="${t.ink}" stroke-width="0.6" stroke-dasharray="1.5 1.5" opacity="0.45"/>
  </pattern>
  <filter id="hbd-paper" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="noise"/>
    <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.09 0"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>
  <filter id="hbd-stain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="3"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0 0.1  0 0 0 0.28 -0.06"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>
  <radialGradient id="hbd-vignette" cx="50%" cy="50%" r="72%">
    <stop offset="62%" stop-color="${t.ink}" stop-opacity="0"/>
    <stop offset="100%" stop-color="${t.ink}" stop-opacity="0.28"/>
  </radialGradient>`;

export function renderSVG(realm, geo, { theme = 'parchment', interactive = false } = {}) {
  const t = THEMES[theme] ?? THEMES.parchment;
  const { width: W, height: H } = geo;
  const files = realm.files;
  const out = [];
  const push = (s) => out.push(s);

  const coastD = pathOf(geo.coast);

  push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${esc(FONT)}" class="hbd-map">`);
  push(`<title>${esc(realm.name)} — a map by here-be-dragons</title>`);
  push(`<defs>${SYMBOLS(t)}<path id="hbd-coast" d="${coastD}"/><clipPath id="hbd-land"><use href="#hbd-coast" clip-rule="evenodd"/></clipPath>`);
  push(`<g id="hbd-dragon">${DRAGON(t)}</g></defs>`);
  push(`<style>
    .hbd-map .halo{paint-order:stroke;stroke:${t.land};stroke-width:3px;stroke-linejoin:round}
    .hbd-map .seahalo{paint-order:stroke;stroke:${t.sea};stroke-width:3px;stroke-linejoin:round}
  </style>`);

  // Paper, sea and texture.
  push(`<rect width="${W}" height="${H}" fill="${t.paper}"/>`);
  push(`<rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="${t.sea}"/>`);

  // Sea ripples: concentric contour lines echoing the coast.
  push(`<g fill="none" stroke-linejoin="round">`);
  for (const [w, op, dash] of [[34, 0.16, '3 4'], [23, 0.26, ''], [13, 0.4, '']]) {
    push(`<use href="#hbd-coast" stroke="${t.seaInk}" stroke-width="${w}" opacity="${op}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
    push(`<use href="#hbd-coast" stroke="${t.sea}" stroke-width="${w - 1.6}"/>`);
  }
  push(`</g>`);

  // Land.
  push(`<use href="#hbd-coast" fill="${t.land}" fill-rule="evenodd"/>`);
  push(`<g clip-path="url(#hbd-land)">`);
  push(`<use href="#hbd-coast" fill="none" stroke="${t.inkSoft}" stroke-width="7" opacity="0.13"/>`);
  push(`<g class="layer layer-houses">`);
  for (const h of geo.houses) {
    push(`<path d="${pathOf(h.outline)}" fill="${h.color}" fill-rule="evenodd" opacity="0.075"/>`);
  }
  push(`</g>`);
  push(`<g class="layer layer-ai"><path d="${pathOf(geo.aiLand)}" fill="url(#hbd-hatch)" fill-rule="evenodd"/></g>`);
  push(`<g class="layer layer-ruins"${interactive ? ' style="display:none"' : ' display="none"'}><path d="${pathOf(geo.ruinLand)}" fill="url(#hbd-ruinhatch)" fill-rule="evenodd"/></g>`);
  push(`</g>`);

  // Borders and coast ink.
  push(`<g class="layer layer-borders" fill="none" stroke-linecap="round" stroke-linejoin="round">`);
  push(`<path d="${pathOf(geo.duchyBorders)}" stroke="${t.ink}" stroke-width="0.7" stroke-dasharray="0.8 2.6" opacity="0.5"/>`);
  const pb = pathOf(geo.provinceBorders);
  push(`<path d="${pb}" stroke="${t.border}" stroke-width="6" opacity="0.14"/>`);
  push(`<path d="${pb}" stroke="${t.border}" stroke-width="1.3" stroke-dasharray="6 2.5 1.5 2.5" opacity="0.8"/>`);
  push(`</g>`);
  push(`<use href="#hbd-coast" fill="none" stroke="${t.ink}" stroke-width="1.5" stroke-linejoin="round"/>`);

  // Terrain glyphs.
  push(`<g class="layer layer-terrain">`);
  for (const g of geo.glyphs) {
    const s = g.size;
    const id = `hbd-${g.type}`;
    const [w, h] = g.type === 'mountain' ? [s * 2, s * 1.4] : g.type === 'swamp' ? [s * 2, s * 1.4] : [s * 2, s * 2.5];
    push(`<use href="#${id}" x="${r1(g.x - w / 2)}" y="${r1(g.y - h * 0.75)}" width="${r1(w)}" height="${r1(h)}"/>`);
  }
  push(`</g>`);

  // Trade routes.
  push(`<g class="layer layer-routes" fill="none" stroke-linecap="round">`);
  for (const r of geo.routes) {
    const w = 0.8 + Math.min(2, r.shared / 15);
    push(`<path d="${r.d}" stroke="${t.route}" stroke-width="${r1(w)}" stroke-dasharray="${r.sea ? '1 3.2' : '4 2.4'}" opacity="${r.sea ? 0.75 : 0.65}"><title>${esc(files[r.a].path)} ⇄ ${esc(files[r.b].path)}: changed together in ${r.shared} commits</title></path>`);
  }
  push(`</g>`);

  // Settlements.
  push(`<g class="layer layer-cities">`);
  for (const c of geo.cities) {
    const f = files[c.file];
    const data = interactive ? ` data-f="${c.file}"` : '';
    if (c.class === 'village') {
      const rr = Math.max(0.55, Math.min(f.kind === 'code' ? 1.6 : 1.2, c.r * 0.45));
      const soft = f.kind !== 'code';
      push(`<circle cx="${r1(c.x)}" cy="${r1(c.y)}" r="${r1(rr)}" fill="${soft ? t.inkSoft : t.ink}"${soft ? ' opacity="0.7"' : ''}${data}/>`);
      continue;
    }
    if (f.tested) {
      const rr = c.class === 'town' ? 4.6 : c.class === 'city' ? 8 : 10.5;
      push(`<circle cx="${r1(c.x)}" cy="${r1(c.y)}" r="${rr}" fill="none" stroke="${t.ink}" stroke-width="1.6" stroke-dasharray="1.3 1.1"/>`);
    }
    if (c.class === 'town') {
      push(`<circle cx="${r1(c.x)}" cy="${r1(c.y)}" r="2.7" fill="${t.land}" stroke="${t.ink}" stroke-width="1.1"${data}/><circle cx="${r1(c.x)}" cy="${r1(c.y)}" r="0.9" fill="${t.ink}"/>`);
    } else if (c.class === 'city') {
      push(`<use href="#hbd-city" x="${r1(c.x - 6)}" y="${r1(c.y - 6.5)}" width="12" height="10"${data}/>`);
    } else {
      push(`<use href="#hbd-castle" x="${r1(c.x - 9.1)}" y="${r1(c.y - 11.7)}" width="18.2" height="15.6"${data}/>`);
    }
  }
  for (const c of geo.ruins) {
    if (c.class === 'village' && files[c.file].loc < 120) continue;
    push(`<use href="#hbd-ruin" x="${r1(c.x + 3)}" y="${r1(c.y - 1)}" width="10" height="8"/>`);
  }
  push(`</g>`);

  // Dragons.
  push(`<g class="layer layer-dragons">`);
  for (const g of geo.dragonGlyphs) {
    const d = g.dragon;
    const s = (g.w / 100) * 1;
    const flip = g.x + g.w / 2 < g.cx; // face toward the lair
    const tx = flip ? g.x + g.w : g.x;
    push(`<g class="dragon" data-dragon="${realm.dragons.indexOf(d)}">`);
    push(`<path d="M${r1(g.cx)},${r1(g.cy)} L${r1(g.x + g.w / 2)},${r1(g.y + g.h * 0.75)}" stroke="${t.dragon}" stroke-width="0.7" stroke-dasharray="1.5 2" opacity="0.7"/>`);
    push(`<use href="#hbd-dragon" transform="translate(${r1(tx)},${r1(g.y)}) scale(${flip ? -s : s},${s})"/>`);
    const ly = g.y + g.h + 9;
    push(`<text x="${r1(g.x + g.w / 2)}" y="${r1(ly)}" text-anchor="middle" font-family="${esc(FONT_SC)}" font-size="${r1(10 * Math.max(1, g.scale * 0.9))}" fill="${t.dragon}" class="halo" letter-spacing="0.6">${esc(d.name)}</text>`);
    push(`<text x="${r1(g.x + g.w / 2)}" y="${r1(ly + 9.5)}" text-anchor="middle" font-style="italic" font-size="8.5" fill="${t.ink}" class="halo">${esc(d.title)}</text>`);
    push(`</g>`);
  }
  push(`</g>`);

  // Labels.
  push(`<g class="layer layer-labels">`);
  for (const l of geo.provinceLabels) {
    push(`<text x="${r1(l.x)}" y="${r1(l.y)}" text-anchor="middle" font-family="${esc(FONT_SC)}" font-size="${r1(l.size)}" letter-spacing="${r1(l.size * 0.22)}" fill="${t.ink}" opacity="0.88" class="halo">${esc(l.text)}</text>`);
  }
  for (const l of geo.cityLabels) {
    const style = l.class === 'capital' ? ` font-weight="bold"` : '';
    push(`<text x="${r1(l.x)}" y="${r1(l.y)}" font-size="${l.size}" font-style="italic" fill="${t.ink}" class="halo"${style}>${esc(l.text)}</text>`);
  }
  for (const l of geo.seaLabels) {
    push(`<text x="${r1(l.x)}" y="${r1(l.y)}" text-anchor="middle" font-size="${l.size}" font-style="italic" letter-spacing="2.2" fill="${t.seaInk}" class="seahalo">${esc(l.text)}</text>`);
  }
  push(`</g>`);

  // Paper texture over everything inside the frame, then vignette.
  push(`<rect width="${W}" height="${H}" fill="${t.paper}" filter="url(#hbd-stain)" style="mix-blend-mode:multiply" pointer-events="none"/>`);
  push(`<rect width="${W}" height="${H}" fill="${t.paper}" filter="url(#hbd-paper)" pointer-events="none"/>`);
  push(`<rect width="${W}" height="${H}" fill="url(#hbd-vignette)" pointer-events="none"/>`);

  push(frame(W, H, t));
  push(cartouche(realm, t));
  push(houses(geo, W, t));
  push(legend(H, t));
  push(compass(W - 92, H - 98, t));
  push(`</svg>`);
  return out.join('\n');
}

function frame(W, H, t) {
  const seg = 24;
  return `<g fill="none" stroke="${t.ink}" pointer-events="none">
    <rect x="9" y="9" width="${W - 18}" height="${H - 18}" stroke-width="2.4"/>
    <rect x="13.5" y="13.5" width="${W - 27}" height="${H - 27}" stroke-width="5" stroke-dasharray="${seg} ${seg}" opacity="0.85"/>
    <rect x="18" y="18" width="${W - 36}" height="${H - 36}" stroke-width="0.9"/>
  </g>`;
}

function cartouche(realm, t) {
  const s = realm.stats;
  const x = 34;
  const y = 34;
  const title = realmTitle(realm.name);
  const titleSize = Math.max(20, Math.min(34, 520 / Math.max(8, title.length + 9)));
  const w = Math.max(360, (title.length + 11) * titleSize * 0.62 + 40);
  const h = 104;
  const years = s.firstCommit ? `${new Date(s.firstCommit).getUTCFullYear()}–${new Date(s.lastCommit).getUTCFullYear()}` : '';
  const sub = `${realm.name} · charted from ${s.commits.toLocaleString('en-US')} commits${years ? ` · ${years}` : ''}`;
  const stats = `${s.files.toLocaleString('en-US')} settlements · ${fmt(s.loc)} lines · ${s.authors.toLocaleString('en-US')} souls · ${realm.dragons.length} dragon${realm.dragons.length === 1 ? '' : 's'}`;
  return `<g class="cartouche">
    <rect x="${x}" y="${y}" width="${r1(w)}" height="${h}" fill="${t.land}" stroke="${t.ink}" stroke-width="1.6"/>
    <rect x="${x + 5}" y="${y + 5}" width="${r1(w - 10)}" height="${h - 10}" fill="none" stroke="${t.ink}" stroke-width="0.7"/>
    ${[[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]].map(([cx, cy]) => `<circle cx="${r1(cx)}" cy="${cy}" r="3.2" fill="${t.land}" stroke="${t.ink}" stroke-width="0.8"/>`).join('')}
    <text x="${r1(x + w / 2)}" y="${y + 24}" text-anchor="middle" font-family="${esc(FONT_SC)}" font-size="11" letter-spacing="3" fill="${t.inkSoft}">HERE BE DRAGONS</text>
    <text x="${r1(x + w / 2)}" y="${y + 24 + titleSize}" text-anchor="middle" font-family="${esc(FONT_SC)}" font-size="${r1(titleSize)}" fill="${t.ink}" letter-spacing="1.5">The Realm of ${esc(title)}</text>
    <text x="${r1(x + w / 2)}" y="${y + h - 26}" text-anchor="middle" font-style="italic" font-size="11" fill="${t.inkSoft}">${esc(sub)}</text>
    <text x="${r1(x + w / 2)}" y="${y + h - 12}" text-anchor="middle" font-size="10" fill="${t.inkSoft}">${esc(stats)}</text>
  </g>`;
}

function houses(geo, W, t) {
  if (!geo.houses.length) return '';
  const list = geo.houses.slice(0, 6);
  const w = 236;
  const x = W - 34 - w;
  const y = 34;
  const h = 30 + list.length * 18;
  const rows = list
    .map((hh, i) => {
      const yy = y + 34 + i * 18;
      return `<path d="M${x + 14},${yy - 9} h10 v7 c0,4 -5,6 -5,6 c0,0 -5,-2 -5,-6 Z" fill="${hh.color}" stroke="${t.ink}" stroke-width="0.7"/>
      <text x="${x + 32}" y="${yy}" font-size="10.5" fill="${t.ink}">House ${esc(truncate(hh.name, 27))}</text>`;
    })
    .join('');
  return `<g class="houses">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${t.land}" stroke="${t.ink}" stroke-width="1.2" opacity="0.94"/>
    <text x="${x + w / 2}" y="${y + 17}" text-anchor="middle" font-family="${esc(FONT_SC)}" font-size="11" letter-spacing="2" fill="${t.inkSoft}">GREAT HOUSES</text>
    ${rows}
  </g>`;
}

function legend(H, t) {
  const x = 34;
  const items = [
    ['dragon', 'Dragon: complex code that keeps changing'],
    ['mountain', 'Mountains: deeply nested code'],
    ['tree', 'Forest: untouched for 2+ years'],
    ['swamp', 'Marsh: TODO & FIXME'],
    ['walls', 'Walls: has tests'],
    ['ruin', 'Ruins: its keeper is away (6+ months)'],
    ['ai', 'Hatched: forged by AI agents'],
    ['route', 'Road: files that change together'],
    ['border', 'Border: top-level directory'],
  ];
  const rowH = 15.5;
  const h = 26 + items.length * rowH;
  const y = H - 34 - h;
  const w = 268;
  const icon = (k, ix, iy) => {
    switch (k) {
      case 'dragon':
        return `<use href="#hbd-dragon" transform="translate(${ix - 9},${iy - 7}) scale(0.18)"/>`;
      case 'mountain':
        return `<use href="#hbd-mountain" x="${ix - 7}" y="${iy - 6}" width="14" height="10"/>`;
      case 'tree':
        return `<use href="#hbd-tree" x="${ix - 6}" y="${iy - 8}" width="7" height="9"/><use href="#hbd-pine" x="${ix}" y="${iy - 8}" width="7" height="9.6"/>`;
      case 'swamp':
        return `<use href="#hbd-swamp" x="${ix - 7}" y="${iy - 5}" width="14" height="9.8"/>`;
      case 'walls':
        return `<circle cx="${ix}" cy="${iy - 1}" r="4.6" fill="none" stroke="${t.ink}" stroke-width="1.6" stroke-dasharray="1.3 1.1"/><circle cx="${ix}" cy="${iy - 1}" r="2" fill="${t.ink}"/>`;
      case 'ruin':
        return `<use href="#hbd-ruin" x="${ix - 6}" y="${iy - 7}" width="12" height="9.6"/>`;
      case 'ai':
        return `<rect x="${ix - 7}" y="${iy - 7}" width="14" height="10" fill="url(#hbd-hatch)" stroke="${t.ink}" stroke-width="0.5"/>`;
      case 'route':
        return `<path d="M${ix - 8},${iy} q8,-7 16,0" fill="none" stroke="${t.route}" stroke-width="1.4" stroke-dasharray="4 2.4"/>`;
      default:
        return `<path d="M${ix - 8},${iy - 2} h16" stroke="${t.border}" stroke-width="1.3" stroke-dasharray="6 2.5 1.5 2.5"/>`;
    }
  };
  const rows = items
    .map(([k, label], i) => {
      const yy = y + 34 + i * rowH;
      return `${icon(k, x + 20, yy)}<text x="${x + 36}" y="${yy}" font-size="10.5" fill="${t.ink}">${esc(label)}</text>`;
    })
    .join('');
  return `<g class="legend">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${t.land}" stroke="${t.ink}" stroke-width="1.2" opacity="0.94"/>
    <text x="${x + w / 2}" y="${y + 16}" text-anchor="middle" font-family="${esc(FONT_SC)}" font-size="11" letter-spacing="2" fill="${t.inkSoft}">LEGEND</text>
    ${rows}
  </g>`;
}

function compass(cx, cy, t) {
  const pts = (r1_, r2_, n, rot) => {
    const out = [];
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i * Math.PI) / n;
      const r = i % 2 === 0 ? r1_ : r2_;
      out.push(`${r1(cx + Math.sin(a) * r)},${r1(cy - Math.cos(a) * r)}`);
    }
    return out.join(' ');
  };
  const half = (a, r, w, dark) => {
    const tip = [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
    const l = [cx + Math.sin(a - Math.PI / 2) * w, cy - Math.cos(a - Math.PI / 2) * w];
    const rr = [cx + Math.sin(a + Math.PI / 2) * w, cy - Math.cos(a + Math.PI / 2) * w];
    return `<path d="M${cx},${cy} L${r1(tip[0])},${r1(tip[1])} L${r1(l[0])},${r1(l[1])} Z" fill="${dark ? t.ink : t.land}" stroke="${t.ink}" stroke-width="0.7"/>
      <path d="M${cx},${cy} L${r1(tip[0])},${r1(tip[1])} L${r1(rr[0])},${r1(rr[1])} Z" fill="${dark ? t.land : t.ink}" stroke="${t.ink}" stroke-width="0.7"/>`;
  };
  let star = '';
  for (let i = 0; i < 4; i++) star += half(Math.PI / 4 + (i * Math.PI) / 2, 34, 6, i % 2 === 0);
  for (let i = 0; i < 4; i++) star += half((i * Math.PI) / 2, 56, 9, i % 2 === 1);
  return `<g class="compass" pointer-events="none">
    <circle cx="${cx}" cy="${cy}" r="44" fill="none" stroke="${t.ink}" stroke-width="0.8"/>
    <circle cx="${cx}" cy="${cy}" r="40" fill="none" stroke="${t.ink}" stroke-width="2.6" stroke-dasharray="1 4.2" opacity="0.7"/>
    <polygon points="${pts(30, 12, 16, Math.PI / 16)}" fill="none" stroke="${t.inkSoft}" stroke-width="0.5" opacity="0.6"/>
    ${star}
    <circle cx="${cx}" cy="${cy}" r="3" fill="${t.land}" stroke="${t.ink}" stroke-width="0.8"/>
    <text x="${cx}" y="${cy - 61}" text-anchor="middle" font-family="${esc(FONT_SC)}" font-size="15" fill="${t.ink}">N</text>
  </g>`;
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
