// Circle packing (front-chain siblings + smallest enclosing circle).
// Ported from d3-hierarchy v3 — https://github.com/d3/d3-hierarchy
// ISC License. Copyright 2010-2021 Mike Bostock.
// Changes: plain functions, seeded shuffle passed in by the caller.

function place(b, a, c) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  if (d2) {
    let a2 = a.r + c.r;
    a2 *= a2;
    let b2 = b.r + c.r;
    b2 *= b2;
    if (a2 > b2) {
      const x = (d2 + b2 - a2) / (2 * d2);
      const y = Math.sqrt(Math.max(0, b2 / d2 - x * x));
      c.x = b.x - x * dx - y * dy;
      c.y = b.y - x * dy + y * dx;
    } else {
      const x = (d2 + a2 - b2) / (2 * d2);
      const y = Math.sqrt(Math.max(0, a2 / d2 - x * x));
      c.x = a.x + x * dx - y * dy;
      c.y = a.y + x * dy + y * dx;
    }
  } else {
    c.x = a.x + c.r;
    c.y = a.y;
  }
}

function intersects(a, b) {
  const dr = a.r + b.r - 1e-6;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dr > 0 && dr * dr > dx * dx + dy * dy;
}

function score(node) {
  const a = node._;
  const b = node.next._;
  const ab = a.r + b.r;
  const dx = (a.x * b.r + b.x * a.r) / ab;
  const dy = (a.y * b.r + b.y * a.r) / ab;
  return dx * dx + dy * dy;
}

function Node(circle) {
  this._ = circle;
  this.next = null;
  this.previous = null;
}

/** Packs circles ({r}) tangent to each other around the origin; sets x/y; returns enclosing radius. */
export function packSiblings(circles, random) {
  const n = circles.length;
  if (!n) return 0;
  let a, b, c, aa, ca, i, j, k, sj, sk;

  a = circles[0];
  a.x = 0;
  a.y = 0;
  if (!(n > 1)) return a.r;

  b = circles[1];
  a.x = -b.r;
  b.x = a.r;
  b.y = 0;
  if (!(n > 2)) return a.r + b.r;

  place(b, a, (c = circles[2]));

  a = new Node(a);
  b = new Node(b);
  c = new Node(c);
  a.next = c.previous = b;
  b.next = a.previous = c;
  c.next = b.previous = a;

  pack: for (i = 3; i < n; ++i) {
    place(a._, b._, (c = circles[i]));
    c = new Node(c);

    j = b.next;
    k = a.previous;
    sj = b._.r;
    sk = a._.r;
    do {
      if (sj <= sk) {
        if (intersects(j._, c._)) {
          b = j;
          a.next = b;
          b.previous = a;
          --i;
          continue pack;
        }
        sj += j._.r;
        j = j.next;
      } else {
        if (intersects(k._, c._)) {
          a = k;
          a.next = b;
          b.previous = a;
          --i;
          continue pack;
        }
        sk += k._.r;
        k = k.previous;
      }
    } while (j !== k.next);

    c.previous = a;
    c.next = b;
    a.next = b.previous = b = c;

    aa = score(a);
    while ((c = c.next) !== b) {
      if ((ca = score(c)) < aa) {
        a = c;
        aa = ca;
      }
    }
    b = a.next;
  }

  const chain = [b._];
  c = b;
  while ((c = c.next) !== b) chain.push(c._);
  const e = packEnclose(chain, random);

  for (i = 0; i < n; ++i) {
    circles[i].x -= e.x;
    circles[i].y -= e.y;
  }
  return e.r;
}

export function packEnclose(circles, random) {
  const list = [...circles];
  for (let m = list.length; m; ) {
    const i = (random() * m--) | 0;
    [list[m], list[i]] = [list[i], list[m]];
  }
  let i = 0;
  let B = [];
  let e;
  while (i < list.length) {
    const p = list[i];
    if (e && enclosesWeak(e, p)) ++i;
    else {
      B = extendBasis(B, p);
      e = encloseBasis(B);
      i = 0;
    }
  }
  return e;
}

function extendBasis(B, p) {
  if (enclosesWeakAll(p, B)) return [p];
  for (let i = 0; i < B.length; ++i) {
    if (enclosesNot(p, B[i]) && enclosesWeakAll(encloseBasis2(B[i], p), B)) return [B[i], p];
  }
  for (let i = 0; i < B.length - 1; ++i) {
    for (let j = i + 1; j < B.length; ++j) {
      if (
        enclosesNot(encloseBasis2(B[i], B[j]), p) &&
        enclosesNot(encloseBasis2(B[i], p), B[j]) &&
        enclosesNot(encloseBasis2(B[j], p), B[i]) &&
        enclosesWeakAll(encloseBasis3(B[i], B[j], p), B)
      ) {
        return [B[i], B[j], p];
      }
    }
  }
  throw new Error('packEnclose: degenerate basis');
}

function enclosesNot(a, b) {
  const dr = a.r - b.r;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dr < 0 || dr * dr < dx * dx + dy * dy;
}

function enclosesWeak(a, b) {
  const dr = a.r - b.r + Math.max(a.r, b.r, 1) * 1e-9;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dr > 0 && dr * dr > dx * dx + dy * dy;
}

function enclosesWeakAll(a, B) {
  for (let i = 0; i < B.length; ++i) if (!enclosesWeak(a, B[i])) return false;
  return true;
}

function encloseBasis(B) {
  switch (B.length) {
    case 1:
      return { x: B[0].x, y: B[0].y, r: B[0].r };
    case 2:
      return encloseBasis2(B[0], B[1]);
    default:
      return encloseBasis3(B[0], B[1], B[2]);
  }
}

function encloseBasis2(a, b) {
  const x21 = b.x - a.x;
  const y21 = b.y - a.y;
  const r21 = b.r - a.r;
  const l = Math.sqrt(x21 * x21 + y21 * y21);
  return {
    x: (a.x + b.x + (x21 / l) * r21) / 2,
    y: (a.y + b.y + (y21 / l) * r21) / 2,
    r: (l + a.r + b.r) / 2,
  };
}

function encloseBasis3(a, b, c) {
  const x1 = a.x, y1 = a.y, r1 = a.r;
  const x2 = b.x, y2 = b.y, r2 = b.r;
  const x3 = c.x, y3 = c.y, r3 = c.r;
  const a2 = x1 - x2;
  const a3 = x1 - x3;
  const b2 = y1 - y2;
  const b3 = y1 - y3;
  const c2 = r2 - r1;
  const c3 = r3 - r1;
  const d1 = x1 * x1 + y1 * y1 - r1 * r1;
  const d2 = d1 - x2 * x2 - y2 * y2 + r2 * r2;
  const d3 = d1 - x3 * x3 - y3 * y3 + r3 * r3;
  const ab = a3 * b2 - a2 * b3;
  const xa = (b2 * d3 - b3 * d2) / (ab * 2) - x1;
  const xb = (b3 * c2 - b2 * c3) / ab;
  const ya = (a3 * d2 - a2 * d3) / (ab * 2) - y1;
  const yb = (a2 * c3 - a3 * c2) / ab;
  const A = xb * xb + yb * yb - 1;
  const B = 2 * (r1 + xa * xb + ya * yb);
  const C = xa * xa + ya * ya - r1 * r1;
  const r = -(Math.abs(A) > 1e-6 ? (B + Math.sqrt(B * B - 4 * A * C)) / (2 * A) : C / B);
  return { x: x1 + xa + xb * r, y: y1 + ya + yb * r, r };
}
