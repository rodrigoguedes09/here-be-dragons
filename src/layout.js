// From a realm (analysis) to geography: islands, borders, cities, mountains, labels.
import Delaunator from './vendor/delaunator.js';
import { packSiblings } from './vendor/pack.js';
import { rng, seaNames, provinceLabel, realmTitle } from './names.js';
import { createNoise } from './noise.js';
import { areaWeight } from './classify.js';

const HOUSE_COLORS = ['#9b2c2c', '#2c4f8a', '#2f6b3a', '#a8761c', '#6a3d8f', '#1f6f73', '#a5502a', '#5b6b2a'];

export function layout(realm, { seed = realm.name, width = 1600, height = 1100 } = {}) {
  const random = rng(`layout:${seed}`);
  const { fbm } = createNoise(seed);
  const { files, provinces } = realm;
  const W = width;
  const H = height;

  // ---------------------------------------------------------------------------
  // 1. Pack the directory hierarchy into nested circles.
  const fileR = (f) => Math.sqrt(Math.max(areaWeight(f), 6));
  const duchyOfFile = new Int32Array(files.length).fill(-1);
  let duchyCount = 0;

  function packNode(node) {
    const items = [];
    for (const child of node.children.values()) items.push(packNode(child));
    for (const i of node.files) items.push({ r: fileR(files[i]) + 0.9, file: i });
    items.sort((a, b) => b.r - a.r);
    const R = packSiblings(items, random);
    return { r: R + 2.5, children: items };
  }

  const provItems = provinces.map((p) => {
    const item = packNode(p.node);
    item.province = provinces.indexOf(p);
    // Each direct child of a province is a duchy.
    for (const child of item.children) {
      const id = duchyCount++;
      forEachFile(child, (i) => (duchyOfFile[i] = id));
    }
    return item;
  });

  const totalR = Math.sqrt(provItems.reduce((s, it) => s + it.r * it.r, 0));
  const gap = 0.09 * totalR;
  const order = [...provItems].sort((a, b) => b.r - a.r);
  for (let i = 1; i < order.length - 1; i++) {
    if (random() < 0.5) [order[i], order[i + 1]] = [order[i + 1], order[i]];
  }
  const wrappers = order.map((it) => ({ r: it.r + gap / 2, item: it }));
  packSiblings(wrappers, random);

  // ---------------------------------------------------------------------------
  // 2. Fit the packed world's bounding box into the canvas (gently stretched).
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const w of wrappers) {
    minX = Math.min(minX, w.x - w.item.r);
    maxX = Math.max(maxX, w.x + w.item.r);
    minY = Math.min(minY, w.y - w.item.r);
    maxY = Math.max(maxY, w.y + w.item.r);
  }
  // Panels drawn over the map (cartouche, houses, legend, compass): no city may hide beneath them.
  const reserved = reservedBoxes(realm, W, H);
  const cities = files.map((f, i) => ({ file: i, x: 0, y: 0, r: 0, province: f.province, duchy: duchyOfFile[i] }));
  const provGeo = provinces.map(() => ({ x: 0, y: 0, rx: 1, ry: 1 }));
  let sx = 1;
  let sy = 1;
  let cx = 0;
  let cy = 0;
  for (let attempt = 0, shrink = 1; attempt < 8; attempt++, shrink *= 0.94) {
    const midX = W / 2;
    const midY = H * 0.54;
    const box = {
      x0: midX - (W * 0.44) * shrink,
      x1: midX + (W * 0.44) * shrink,
      y0: midY - (H * 0.39) * shrink,
      y1: midY + (H * 0.39) * shrink,
    };
    sx = (box.x1 - box.x0) / Math.max(1e-6, maxX - minX);
    sy = (box.y1 - box.y0) / Math.max(1e-6, maxY - minY);
    if (sx / sy > 1.45) sx = sy * 1.45;
    if (sy / sx > 1.2) sy = sx * 1.2;
    cx = (box.x0 + box.x1) / 2 - ((minX + maxX) / 2) * sx;
    cy = (box.y0 + box.y1) / 2 - ((minY + maxY) / 2) * sy;
    for (const w of wrappers) placeItem(w.item, w.x, w.y);
    const hidden = cities.some((c) => reserved.some((b) => c.x > b.x - 10 && c.x < b.x + b.w + 10 && c.y > b.y - 10 && c.y < b.y + b.h + 10));
    if (!hidden) break;
  }
  const rs = Math.sqrt(sx * sy);

  function placeItem(item, x, y) {
    if (item.file !== undefined) {
      const c = cities[item.file];
      c.x = cx + x * sx;
      c.y = cy + y * sy;
      c.r = (item.r - 0.9) * Math.sqrt(sx * sy);
      return;
    }
    for (const ch of item.children) placeItem(ch, x + ch.x, y + ch.y);
  }
  for (const w of wrappers) {
    const it = w.item;
    provGeo[it.province] = { x: cx + w.x * sx, y: cy + w.y * sy, rx: it.r * sx, ry: it.r * sy };
    placeItem(it, w.x, w.y);
  }

  // ---------------------------------------------------------------------------
  // 3. Scatter points and triangulate: every point owns a Voronoi cell.
  const spacing = 6.5 * (W / 1600);
  const cols = Math.ceil(W / spacing);
  const rows = Math.ceil(H / spacing);
  const n = cols * rows;
  const coords = new Float64Array(n * 2);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      coords[2 * i] = Math.min(W, (col + 0.5 + (random() - 0.5) * 0.75) * spacing);
      coords[2 * i + 1] = Math.min(H, (row + 0.5 + (random() - 0.5) * 0.75) * spacing);
    }
  }
  const del = new Delaunator(coords);
  const { triangles, halfedges } = del;
  const X = (i) => coords[2 * i];
  const Y = (i) => coords[2 * i + 1];
  const nextHE = (e) => (e % 3 === 2 ? e - 2 : e + 1);

  // Cell adjacency (CSR).
  const degree = new Int32Array(n);
  for (let e = 0; e < triangles.length; e++) {
    if (halfedges[e] === -1 || e < halfedges[e]) {
      degree[triangles[e]]++;
      degree[triangles[nextHE(e)]]++;
    }
  }
  const adjStart = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) adjStart[i + 1] = adjStart[i] + degree[i];
  const adj = new Int32Array(adjStart[n]);
  const fill = adjStart.slice(0, n);
  for (let e = 0; e < triangles.length; e++) {
    if (halfedges[e] === -1 || e < halfedges[e]) {
      const a = triangles[e];
      const b = triangles[nextHE(e)];
      adj[fill[a]++] = b;
      adj[fill[b]++] = a;
    }
  }
  const neighbors = (i, fn) => {
    for (let k = adjStart[i]; k < adjStart[i + 1]; k++) fn(adj[k]);
  };
  const cellAt = (x, y) => {
    const col = Math.max(0, Math.min(cols - 1, Math.floor(x / spacing)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor(y / spacing)));
    let best = row * cols + col;
    let bd = Infinity;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r2 = row + dr;
        const c2 = col + dc;
        if (r2 < 0 || c2 < 0 || r2 >= rows || c2 >= cols) continue;
        const i = r2 * cols + c2;
        const d = (X(i) - x) ** 2 + (Y(i) - y) ** 2;
        if (d < bd) [bd, best] = [d, i];
      }
    }
    return best;
  };

  // ---------------------------------------------------------------------------
  // 4. Land and sea. Provinces are noisy ovals; the noise makes coasts.
  const land = new Uint8Array(n);
  const prov = new Int32Array(n).fill(-1);
  const edge = Math.min(W, H) * 0.028;
  for (let i = 0; i < n; i++) {
    const x = X(i);
    const y = Y(i);
    if (x < edge || y < edge || x > W - edge || y > H - edge) continue;
    const wobble = fbm(x / 190, y / 190) * 62 + fbm(x / 42 + 11.3, y / 42 - 4.7, 3) * 15;
    let best = Infinity;
    let bp = -1;
    for (let p = 0; p < provGeo.length; p++) {
      const g = provGeo[p];
      const dx = (x - g.x) / g.rx;
      const dy = (y - g.y) / g.ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 2.2) continue;
      const pert = Math.max(-0.42, Math.min(0.42, wobble / Math.min(g.rx, g.ry)));
      const score = d - pert;
      if (score < best) [best, bp] = [score, p];
    }
    if (best < 1) {
      land[i] = 1;
      prov[i] = bp;
    }
  }

  // Cities always stand on dry land.
  for (const c of cities) {
    const i = cellAt(c.x, c.y);
    c.cell = i;
    if (!land[i] || prov[i] !== c.province) {
      land[i] = 1;
      prov[i] = c.province;
    }
  }

  // Drop specks of land without a city; fill puddles.
  const comp = new Int32Array(n).fill(-1);
  const cityCell = new Uint8Array(n);
  for (const c of cities) cityCell[c.cell] = 1;
  const queue = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (comp[s] !== -1) continue;
    const isLand = land[s];
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    comp[s] = s;
    let hasCity = false;
    let touchesEdge = false;
    while (head < tail) {
      const i = queue[head++];
      if (cityCell[i]) hasCity = true;
      if (X(i) < edge || Y(i) < edge || X(i) > W - edge || Y(i) > H - edge) touchesEdge = true;
      neighbors(i, (j) => {
        if (comp[j] === -1 && land[j] === isLand) {
          comp[j] = s;
          queue[tail++] = j;
        }
      });
    }
    const size = tail;
    if (isLand && size < 10 && !hasCity) {
      for (let k = 0; k < size; k++) land[queue[k]] = 0, prov[queue[k]] = -1;
    } else if (!isLand && !touchesEdge && size < 7) {
      for (let k = 0; k < size; k++) {
        const i = queue[k];
        land[i] = 1;
        neighbors(i, (j) => {
          if (prov[j] !== -1 && prov[i] === -1) prov[i] = prov[j];
        });
      }
    }
  }
  for (let i = 0; i < n; i++) if (land[i] && prov[i] === -1) land[i] = 0;

  // ---------------------------------------------------------------------------
  // 5. Every land cell belongs to its nearest city of the same province.
  const cityGrid = new SpatialGrid(48);
  cities.forEach((c, i) => cityGrid.insert(c.x, c.y, i));
  const cellCity = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (!land[i]) continue;
    const ci = cityGrid.nearest(X(i), Y(i), (k) => cities[k].province === prov[i]);
    // Land far from any settlement stays unclaimed wilderness.
    if (ci >= 0 && Math.hypot(X(i) - cities[ci].x, Y(i) - cities[ci].y) < Math.max(26, cities[ci].r * 2 + 16)) cellCity[i] = ci;
  }
  const duchy = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (cellCity[i] >= 0) duchy[i] = cities[cellCity[i]].duchy;

  // ---------------------------------------------------------------------------
  // 6. Boundaries: coastlines, province borders, duchy borders.
  const ccx = new Float64Array(triangles.length / 3);
  const ccy = new Float64Array(triangles.length / 3);
  for (let t = 0; t < triangles.length / 3; t++) {
    const a = triangles[3 * t];
    const b = triangles[3 * t + 1];
    const c = triangles[3 * t + 2];
    // Centroid instead of circumcenter: smoother and never flies off on slivers.
    ccx[t] = (X(a) + X(b) + X(c)) / 3;
    ccy[t] = (Y(a) + Y(b) + Y(c)) / 3;
  }
  const tri = (e) => Math.floor(e / 3);

  function boundary(differs) {
    const segs = [];
    for (let e = 0; e < triangles.length; e++) {
      const o = halfedges[e];
      if (o === -1 || o < e) continue;
      const p = triangles[e];
      const q = triangles[nextHE(e)];
      if (differs(p, q)) segs.push([tri(e), tri(o)]);
    }
    return chain(segs).map((pts) => ({
      closed: pts.closed,
      points: chaikin(pts.ids.map((t) => [ccx[t], ccy[t]]), pts.closed, 2),
    }));
  }

  const coast = boundary((p, q) => land[p] !== land[q]);
  const provinceBorders = boundary((p, q) => land[p] && land[q] && prov[p] !== prov[q]);
  const duchyBorders = boundary((p, q) => land[p] && land[q] && prov[p] === prov[q] && duchy[p] !== duchy[q]);

  /** Closed outlines of all cells matching `inRegion` (fill with evenodd). */
  function regionOutline(inRegion) {
    return boundary((p, q) => !!inRegion(p) !== !!inRegion(q));
  }

  // Houses: the top owners each get a banner color; their land is tinted.
  const houseNames = [];
  const ownedLoc = new Map();
  for (const f of files) if (f.owner) ownedLoc.set(f.owner, (ownedLoc.get(f.owner) ?? 0) + f.loc);
  const rankedOwners = [...ownedLoc].sort((a, b) => b[1] - a[1]);
  const totalLoc = files.reduce((s, f) => s + f.loc, 0) || 1;
  for (const [name, loc] of rankedOwners) {
    if (houseNames.length >= HOUSE_COLORS.length) break;
    if (loc / totalLoc < 0.02 && houseNames.length >= 3) break;
    houseNames.push(name);
  }
  const houses = houseNames.map((name, h) => ({
    name,
    color: HOUSE_COLORS[h],
    loc: ownedLoc.get(name),
    outline: regionOutline((i) => land[i] && cellCity[i] >= 0 && files[cellCity[i]].owner === name),
  }));

  const aiLand = regionOutline((i) => land[i] && cellCity[i] >= 0 && files[cellCity[i]].aiShare >= 0.3);
  const ruinLand = regionOutline((i) => land[i] && cellCity[i] >= 0 && files[cellCity[i]].ruin);

  // ---------------------------------------------------------------------------
  // 7. Distance from the coast (in cells), used for labels and decorations.
  const coastDist = bfsDistance(n, (i) => !land[i], (i) => !!land[i], neighbors, queue);
  const seaDist = bfsDistance(n, (i) => !!land[i], (i) => !land[i], neighbors, queue);

  // ---------------------------------------------------------------------------
  // 8. Terrain fields splatted from cities: mountains (nesting), forests (age), swamps (TODOs).
  const g = 8;
  const gw = Math.ceil(W / g);
  const gh = Math.ceil(H / g);
  const mountainF = new Float32Array(gw * gh);
  const forestF = new Float32Array(gw * gh);
  const swampF = new Float32Array(gw * gh);
  const splat = (field, x, y, sigma, v) => {
    const rad = Math.ceil((sigma * 2.2) / g);
    const gx = Math.floor(x / g);
    const gy = Math.floor(y / g);
    for (let yy = gy - rad; yy <= gy + rad; yy++) {
      if (yy < 0 || yy >= gh) continue;
      for (let xx = gx - rad; xx <= gx + rad; xx++) {
        if (xx < 0 || xx >= gw) continue;
        const d2 = (xx * g + g / 2 - x) ** 2 + (yy * g + g / 2 - y) ** 2;
        field[yy * gw + xx] += v * Math.exp(-d2 / (2 * sigma * sigma));
      }
    }
  };
  for (const c of cities) {
    const f = files[c.file];
    if (f.kind === 'docs' || f.kind === 'config') continue;
    const avgDepth = f.complexity / Math.max(1, f.loc);
    const flat = f.kind === 'test' ? 0.45 : f.kind === 'code' ? 1 : 0.5;
    const rugged = flat * (Math.max(0, Math.min(1, (avgDepth - 1.4) / 1.8)) * Math.min(1, f.loc / 250) + Math.max(0, f.maxDepth - 6) * 0.05);
    if (rugged > 0) splat(mountainF, c.x, c.y, c.r * 1.25 + 7, rugged);
    if (f.ancient) splat(forestF, c.x, c.y, c.r * 1.3 + 8, Math.min(1, 0.4 + Math.log10(f.loc + 1) / 4));
    if (f.todos >= 2) splat(swampF, c.x, c.y, c.r + 7, Math.min(1, f.todos / 8));
  }
  const field = (F, x, y) => {
    const gx = Math.min(gw - 1, Math.max(0, Math.floor(x / g)));
    const gy = Math.min(gh - 1, Math.max(0, Math.floor(y / g)));
    return F[gy * gw + gx];
  };

  // ---------------------------------------------------------------------------
  // 9. Cities: importance, class, capital.
  const kindWeight = { code: 1, test: 0.35, style: 0.5, markup: 0.5, docs: 0.25, config: 0.2 };
  const importance = (f) => f.loc * (1 + Math.log2(1 + f.revisions)) * (kindWeight[f.kind] ?? 0.5);
  const byImportance = files.map((f, i) => i).sort((a, b) => importance(files[b]) - importance(files[a]));
  const rankOf = new Int32Array(files.length);
  byImportance.forEach((fi, r) => (rankOf[fi] = r));
  const codeByRevs = files
    .map((f, i) => i)
    .filter((i) => files[i].kind === 'code')
    .sort((a, b) => files[b].revisions - files[a].revisions || files[b].loc - files[a].loc);
  const capital = codeByRevs.find((i) => files[i].dragon === -1) ?? codeByRevs[0] ?? byImportance[0];
  const nCities = Math.max(3, Math.min(Math.round(files.length * 0.025), 24));
  const nTowns = Math.min(Math.round(files.length * 0.14), 140);
  for (const c of cities) {
    const rank = rankOf[c.file];
    const f = files[c.file];
    c.class =
      c.file === capital ? 'capital'
      : rank < nCities ? 'city'
      : rank < nCities + nTowns && f.loc >= 40 ? 'town'
      : 'village';
  }

  // ---------------------------------------------------------------------------
  // 10. Labels. Reserved boxes keep the cartouche, legend and compass clear.
  const boxes = [];
  const free = (b) => !boxes.some((o) => overlap(o, b)) && !reserved.some((o) => overlap(o, b));

  // Province labels at the cell farthest from their border.
  const provinceLabels = [];
  const provinceDist = new Int32Array(n);
  const provOrder = provinces.map((p, i) => i).sort((a, b) => provinces[b].loc - provinces[a].loc);
  for (const p of provOrder) {
    const share = provinces[p].loc / totalLoc;
    if (share < 0.012 && provinceLabels.length >= 10) continue;
    const dist = bfsDistance(n, (i) => prov[i] !== p, (i) => prov[i] === p, neighbors, queue, provinceDist);
    let best = -1;
    let bd = -1;
    for (let i = 0; i < n; i++) {
      if (prov[i] !== p) continue;
      // Prefer the interior, nudged toward the province's center of mass.
      const d = dist[i] - 0.02 * Math.hypot(X(i) - provGeo[p].x, Y(i) - provGeo[p].y) / spacing;
      if (d > bd) [bd, best] = [d, i];
    }
    if (best < 0) continue;
    const text = provinceLabel(provinces[p].path).toUpperCase();
    let size = Math.max(10, Math.min(34, 10 + 30 * Math.sqrt(share)));
    const room = Math.max(1, dist[best]) * spacing * 2.4;
    const widthOf = (s) => text.length * s * 0.86 + s;
    while (size > 9 && widthOf(size) > room * 1.6) size -= 1;
    const b = { x: X(best) - widthOf(size) / 2, y: Y(best) - size * 0.8, w: widthOf(size), h: size * 1.1 };
    if (!free(b)) {
      b.y += size * 1.4;
      if (!free(b)) continue;
    }
    boxes.push(b);
    provinceLabels.push({ province: p, text, x: b.x + b.w / 2, y: b.y + size * 0.8, size });
  }

  // Dragons perch beside their lairs.
  const dragonGlyphs = [];
  for (const d of realm.dragons) {
    const c = cities[d.file];
    const scale = d.tier === 'Ancient Wyrm' ? 1.35 : d.tier === 'Elder Dragon' ? 1.1 : 0.9;
    const w = 54 * scale;
    const h = 40 * scale;
    let placed = null;
    const spotsAround = [];
    for (const dist of [1, 1.6, 2.3]) {
      for (let k = 0; k < 12; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 6 + (k % 2 ? 0.2 : 0);
        spotsAround.push([Math.cos(a) * (w * 0.62) * dist - w / 2, Math.sin(a) * (h * 0.85) * dist - (h + 24) / 2]);
      }
    }
    let bestCost = Infinity;
    for (const [ox, oy] of spotsAround) {
      const b = { x: c.x + ox, y: c.y + oy, w, h: h + 24 };
      if (b.x < 24 || b.y < 24 || b.x + b.w > W - 24 || b.y + b.h > H - 24) continue;
      if (free(b)) {
        placed = b;
        break;
      }
      // Nothing free: settle for the spot that hides the least.
      const cost =
        boxes.reduce((s2, o) => s2 + overlapArea(o, b), 0) +
        reserved.reduce((s2, o) => s2 + overlapArea(o, b) * 20, 0) +
        Math.hypot(ox + w / 2, oy + (h + 24) / 2) * 0.5;
      if (cost < bestCost) [bestCost, placed] = [cost, { ...b, fallback: true }];
    }
    placed ??= { x: c.x + 18, y: c.y - h - 6, w, h: h + 24 };
    boxes.push(placed);
    dragonGlyphs.push({ dragon: d, x: placed.x, y: placed.y, scale, w, h, cx: c.x, cy: c.y });
  }

  // City labels, most important first.
  const cityLabels = [];
  const maxLabels = Math.round(Math.min(60, 14 + Math.sqrt(files.length) * 1.6));
  const cityBoxes = cities.map((c) => {
    const s = c.class === 'capital' ? 9 : c.class === 'city' ? 6 : c.class === 'town' ? 4 : 2;
    return { x: c.x - s, y: c.y - s, w: 2 * s, h: 2 * s };
  });
  for (const fi of byImportance) {
    if (cityLabels.length >= maxLabels) break;
    const c = cities[fi];
    if (c.class === 'village' && files[fi].dragon === -1) continue;
    const name = labelFor(files[fi].path);
    const size = c.class === 'capital' ? 12 : c.class === 'city' ? 10.5 : 9;
    const w = name.length * size * 0.56;
    const h = size * 1.2;
    for (const [ox, oy] of [[7, -h / 2], [-w - 7, -h / 2], [-w / 2, 6], [-w / 2, -h - 6]]) {
      const b = { x: c.x + ox, y: c.y + oy, w, h };
      if (b.x < 12 || b.x + w > W - 12) continue;
      if (free(b) && !cityBoxes.some((o, j) => j !== fi && overlap(o, b))) {
        boxes.push(b);
        cityLabels.push({ file: fi, text: name, x: b.x, y: b.y + h * 0.78, size, class: c.class });
        break;
      }
    }
  }

  // Seas get named in the widest open water.
  const seaLabels = [];
  const names = seaNames(seed, 4);
  const seaCandidates = [];
  for (let i = 0; i < n; i++) if (!land[i] && seaDist[i] >= 7) seaCandidates.push(i);
  seaCandidates.sort((a, b) => seaDist[b] - seaDist[a]);
  for (const i of seaCandidates) {
    if (seaLabels.length >= names.length) break;
    const text = names[seaLabels.length];
    const size = 13;
    const w = text.length * size * 0.62;
    const b = { x: X(i) - w / 2, y: Y(i) - size, w, h: size * 1.4 };
    if (b.x < 40 || b.x + w > W - 40 || b.y < 44 || b.y + b.h > H - 44) continue;
    if (seaLabels.some((s) => Math.hypot(s.x - X(i), s.y - Y(i)) < 260)) continue;
    if (!free(b)) continue;
    boxes.push(b);
    seaLabels.push({ text, x: X(i), y: Y(i), size });
  }

  // ---------------------------------------------------------------------------
  // 11. Decorations: mountains, forests, swamps, grass — kept off cities and labels.
  const glyphs = [];
  const deco = 10.5 * (W / 1600);
  const occupied = new SpatialGrid(24);
  cities.forEach((c) => {
    if (c.class !== 'village') occupied.insert(c.x, c.y, c.class === 'capital' ? 14 : c.class === 'city' ? 10 : 7);
    else occupied.insert(c.x, c.y, 4.5);
  });
  const blocked = (x, y, rad) =>
    occupied.any(x, y, rad + 14, (r, px, py) => Math.hypot(px - x, py - y) < r + rad) ||
    boxes.some((b) => x > b.x - 3 && x < b.x + b.w + 3 && y > b.y - 3 && y < b.y + b.h + 3);
  const spots = [];
  const placedGlyphs = new SpatialGrid(24);
  for (let y = deco; y < H - deco; y += deco) {
    for (let x = deco; x < W - deco; x += deco * 1.15) {
      const jx = x + (random() - 0.5) * deco * 0.8;
      const jy = y + (random() - 0.5) * deco * 0.8;
      const i = cellAt(jx, jy);
      if (!land[i] || coastDist[i] < 2) continue;
      spots.push([jx, jy, field(mountainF, jx, jy) + fbm(jx / 60, jy / 60) * 0.12, field(forestF, jx, jy) + fbm(jx / 50 + 3, jy / 50) * 0.15]);
    }
  }
  // Keep each biome to a believable share of the land.
  const mCut = Math.max(0.3, spotsQuantile(spots, 2, 0.9));
  const fCut = Math.max(0.42, spotsQuantile(spots, 3, 0.62));
  for (const [jx, jy, m, f] of spots) {
    const s = field(swampF, jx, jy);
    let glyph = null;
    if (m > mCut) glyph = { type: 'mountain', size: 7.5 + Math.min(1, m) * 6 + random() * 2.5 };
    else if (f > fCut) glyph = { type: random() < 0.6 ? 'tree' : 'pine', size: 4 + random() * 1.5 };
    else if (s > 0.35) glyph = { type: 'swamp', size: 5 };
    else if (random() < 0.07) glyph = { type: 'grass', size: 3 };
    if (!glyph || blocked(jx, jy, glyph.size * 0.8)) continue;
    const gap = glyph.type === 'mountain' ? glyph.size * 1.35 : glyph.size * 0.95;
    if (placedGlyphs.any(jx, jy, 30, (gs, px, py) => Math.hypot(px - jx, py - jy) < Math.max(gs, gap))) continue;
    placedGlyphs.insert(jx, jy, gap);
    glyphs.push({ ...glyph, x: jx, y: jy });
  }
  glyphs.sort((a, b) => a.y - b.y);

  // ---------------------------------------------------------------------------
  // 12. Trade routes between files that change together.
  const routes = realm.routes.map((r) => {
    const a = cities[r.a];
    const b = cities[r.b];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const bend = (rng(`route:${r.a}:${r.b}`)() - 0.5) * 0.5 * len;
    return {
      ...r,
      sea: a.province !== b.province,
      d: `M${f1(a.x)},${f1(a.y)} Q${f1(mx - ((b.y - a.y) / len) * bend)},${f1(my + ((b.x - a.x) / len) * bend)} ${f1(b.x)},${f1(b.y)}`,
    };
  });

  const ruins = cities
    .filter((c) => files[c.file].ruin)
    .sort((a, b) => files[b.file].loc - files[a.file].loc)
    .slice(0, 30);

  return {
    width: W,
    height: H,
    cities,
    capital,
    coast,
    provinceBorders,
    duchyBorders,
    houses,
    aiLand,
    ruinLand,
    glyphs,
    routes,
    ruins,
    provinceLabels,
    cityLabels,
    seaLabels,
    dragonGlyphs,
    provGeo,
    scale: rs,
  };
}

// -----------------------------------------------------------------------------

/** Value at quantile q of column k across all spots. */
function spotsQuantile(spots, k, q) {
  const v = spots.map((s) => s[k]).sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : Infinity;
}

/** Rectangles covered by the cartouche, great houses, legend and compass (mirrors render.js). */
export function reservedBoxes(realm, W, H) {
  const title = realmTitle(realm.name);
  const titleSize = Math.max(20, Math.min(34, 520 / Math.max(8, title.length + 9)));
  const cw = Math.max(360, (title.length + 11) * titleSize * 0.62 + 40);
  return [
    { x: 0, y: 0, w: 34 + cw + 8, h: 146 }, // cartouche
    { x: W - 278, y: 0, w: 278, h: 190 }, // great houses
    { x: 0, y: H - 210, w: 312, h: 210 }, // legend
    { x: W - 165, y: H - 170, w: 165, h: 170 }, // compass
  ];
}

const GENERIC = /^(index|main|mod|lib|test|tests|spec|__init__|__main__|config|types|utils?|helpers?|constants|readme|package|_config|setup|app|server|client|style|styles)$/i;

/** City name: the file name, with its folder when the name alone says little (src/index.ts). */
export function labelFor(path) {
  const parts = path.split('/');
  const base = parts.pop();
  const stemName = base.replace(/\.[^.]+$/, '');
  return GENERIC.test(stemName) && parts.length ? `${parts.pop()}/${base}` : base;
}

function forEachFile(item, fn) {
  if (item.file !== undefined) fn(item.file);
  else for (const c of item.children) forEachFile(c, fn);
}

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function overlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function f1(v) {
  return Math.round(v * 10) / 10;
}

/** Multi-source BFS over the cell graph: hops from cells where isSource() into cells where canEnter(). */
function bfsDistance(n, isSource, canEnter, neighbors, queue, out = new Int32Array(n)) {
  out.fill(-1);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (isSource(i)) {
      out[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    neighbors(i, (j) => {
      if (out[j] === -1 && canEnter(j)) {
        out[j] = out[i] + 1;
        queue[tail++] = j;
      }
    });
  }
  return out;
}

/** Join boundary segments (pairs of triangle ids) into polylines and loops. */
export function chain(segs) {
  const adj = new Map();
  segs.forEach(([a, b], s) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(s);
    adj.get(b).push(s);
  });
  const used = new Uint8Array(segs.length);
  const out = [];
  const walk = (start, firstSeg) => {
    const ids = [start];
    let v = start;
    let s = firstSeg;
    while (s !== undefined && !used[s]) {
      used[s] = 1;
      const [a, b] = segs[s];
      v = a === v ? b : a;
      ids.push(v);
      const next = adj.get(v);
      if (next.length !== 2) break;
      s = next[0] === s ? next[1] : next[0];
    }
    return ids;
  };
  // Open chains start at junctions or dead ends.
  for (const [v, list] of adj) {
    if (list.length === 2) continue;
    for (const s of list) {
      if (used[s]) continue;
      out.push({ ids: walk(v, s), closed: false });
    }
  }
  // Whatever is left forms closed loops.
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    const ids = walk(segs[s][0], s);
    const closed = ids.length > 2 && ids[0] === ids[ids.length - 1];
    if (closed) ids.pop();
    out.push({ ids, closed });
  }
  return out;
}

/** Chaikin corner cutting. Open lines keep their endpoints. */
export function chaikin(points, closed, iterations = 2) {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    if (pts.length < 3) return pts;
    const out = [];
    const m = pts.length;
    if (!closed) out.push(pts[0]);
    for (let i = 0; i < (closed ? m : m - 1); i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % m];
      out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1]);
      out.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    if (!closed) out.push(pts[m - 1]);
    pts = out;
  }
  return pts;
}

/** Bucketed points for fast neighborhood queries. */
class SpatialGrid {
  constructor(size) {
    this.size = size;
    this.cells = new Map();
  }
  key(cx, cy) {
    return cx * 65536 + cy;
  }
  insert(x, y, value) {
    const k = this.key(Math.floor(x / this.size), Math.floor(y / this.size));
    if (!this.cells.has(k)) this.cells.set(k, []);
    this.cells.get(k).push([x, y, value]);
  }
  /** Value of the nearest point accepted by filter (searches outward ring by ring). */
  nearest(x, y, filter) {
    const gx = Math.floor(x / this.size);
    const gy = Math.floor(y / this.size);
    let best = -1;
    let bd = Infinity;
    for (let ring = 0; ring < 200; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const list = this.cells.get(this.key(gx + dx, gy + dy));
          if (!list) continue;
          for (const [px, py, v] of list) {
            const d = (px - x) ** 2 + (py - y) ** 2;
            if (d < bd && filter(v)) [bd, best] = [d, v];
          }
        }
      }
      if (best !== -1 && Math.sqrt(bd) < ring * this.size) break;
    }
    return best;
  }
  any(x, y, radius, test) {
    const r = Math.ceil(radius / this.size);
    const gx = Math.floor(x / this.size);
    const gy = Math.floor(y / this.size);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const list = this.cells.get(this.key(gx + dx, gy + dy));
        if (!list) continue;
        for (const [px, py, v] of list) if (test(v, px, py)) return true;
      }
    }
    return false;
  }
}
