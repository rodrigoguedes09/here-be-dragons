// Directory tree -> provinces. A province is a top-level region of the map.

/**
 * Build a directory tree. Each leaf carries the index of a file in `files`.
 * node: { name, path, children: Map, files: number[], weight }
 */
export function buildTree(files, weightOf, isCode = () => true) {
  const root = { name: '', path: '', children: new Map(), files: [], weight: 0, own: 0 };
  files.forEach((f, i) => {
    const parts = f.path.split('/');
    let node = root;
    for (let d = 0; d < parts.length - 1; d++) {
      const name = parts[d];
      if (!node.children.has(name)) {
        node.children.set(name, {
          name,
          path: parts.slice(0, d + 1).join('/'),
          children: new Map(),
          files: [],
          weight: 0,
          own: 0,
        });
      }
      node = node.children.get(name);
    }
    node.files.push(i);
  });
  const sum = (node) => {
    node.own = node.files.reduce((s, i) => s + weightOf(files[i]), 0);
    node.weight = node.own;
    node.code = node.files.reduce((s, i) => s + (isCode(files[i]) ? weightOf(files[i]) : 0), 0);
    for (const c of node.children.values()) {
      node.weight += sum(c);
      node.code += c.code;
    }
    return node.weight;
  };
  sum(root);
  collapse(root);
  return root;
}

/** Merge chains like src/main/java/com/acme into a single node. */
function collapse(node) {
  for (const [key, child] of [...node.children]) {
    let c = child;
    while (c.files.length === 0 && c.children.size === 1) {
      const only = [...c.children.values()][0];
      c = { ...only, name: `${c.name}/${only.name}` };
    }
    if (c !== child) {
      node.children.delete(key);
      node.children.set(c.name, c);
    }
    collapse(c);
  }
}

/** All file indices under a node. */
export function filesUnder(node, out = []) {
  out.push(...node.files);
  for (const c of node.children.values()) filesUnder(c, out);
  return out;
}

/**
 * Pick provinces: start from the root's children and keep splitting any region
 * that holds more than half of the realm, until the map has a good number of
 * provinces. Loose files at a split level become "<dir> (heartland)".
 */
export function chooseProvinces(root, { min = 4, max = 28 } = {}) {
  const asRegion = (node) => ({ name: node.path || '(root)', path: node.path, node, weight: node.weight });
  const heartland = (node) => ({
    name: node.path ? `${node.path} (heartland)` : '(root)',
    path: node.path,
    node: { ...node, children: new Map(), weight: node.own },
    weight: node.own,
    loose: true,
  });

  // Split a node into its children. When there are more children than free
  // slots, the biggest stay provinces and the rest become one "outskirts" region.
  const split = (node, slots = Infinity) => {
    const kids = [...node.children.values()].sort((a, b) => b.weight - a.weight);
    const room = Math.max(6, slots) - (node.files.length ? 1 : 0);
    if (kids.length <= room) {
      const out = kids.map(asRegion);
      if (node.files.length) out.push(heartland(node));
      return out;
    }
    const keep = kids.slice(0, room - 1);
    const rest = kids.slice(room - 1);
    const outskirts = {
      name: node.name,
      path: node.path,
      children: new Map(rest.map((c) => [c.name, c])),
      files: [],
      own: 0,
      weight: rest.reduce((sum, c) => sum + c.weight, 0),
      code: rest.reduce((sum, c) => sum + (c.code ?? 0), 0),
    };
    const out = keep.map(asRegion);
    out.push({ name: `${node.path || '(root)'} (outskirts)`, path: `${node.path} (outskirts)`, node: outskirts, weight: outskirts.weight, outskirts: true });
    if (node.files.length) out.push(heartland(node));
    return out;
  };

  let regions = split(root);
  if (regions.length === 0) return [];

  for (let guard = 0; guard < 12; guard++) {
    regions.sort((a, b) => b.weight - a.weight);
    const total = regions.reduce((s, r) => s + r.weight, 0) || 1;
    const big = regions[0];
    const splittable = (r) => !r.loose && !r.outskirts && r.node.children.size > 0;
    const dominant = big.weight / total > 0.5 && splittable(big);
    // A sparse map with one big region of real code reads better split up.
    const codeHeavy = regions.find((r) => splittable(r) && r.weight / total > 0.25 && (r.node.code ?? 0) / (r.weight || 1) >= 0.5);
    const rich = regions.length < 10 && codeHeavy;
    const tooFew = regions.length < min && regions.some(splittable);
    if (!dominant && !rich && !tooFew) break;
    const target = dominant ? big : rich ? codeHeavy : regions.find(splittable);
    const slots = max - (regions.length - 1);
    if (slots < 3 && !dominant) break;
    regions = regions.filter((r) => r !== target).concat(split(target.node, slots));
  }
  return regions;
}
