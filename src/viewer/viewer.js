(() => {
  'use strict';
  const D = JSON.parse(document.getElementById('realm').textContent);
  const stage = document.getElementById('stage');
  const svg = stage.querySelector('svg');
  const tip = document.getElementById('tip');
  const content = document.getElementById('content');
  const dossier = document.getElementById('dossier');
  const W = D.width;
  const H = D.height;
  const NS = 'http://www.w3.org/2000/svg';
  const originalSVG = svg.outerHTML;

  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const num = (x) => Number(x).toLocaleString('en-US');
  const pct = (x) => `${Math.round(x * 100)}%`;
  const ago = (days) => {
    if (days === null || days === undefined) return 'before the chronicles';
    if (days < 1) return 'today';
    if (days < 45) return `${days} day${days === 1 ? '' : 's'} ago`;
    if (days < 600) return `${Math.round(days / 30)} months ago`;
    return `${Math.round((days / 365) * 10) / 10} years ago`;
  };

  // ---------------------------------------------------------------- viewport
  let vb = { x: 0, y: 0, w: W, h: H };
  const apply = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  apply();

  const toMap = (cx, cy) => {
    const pt = svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };
  const unitsPerPx = () => {
    const r = svg.getBoundingClientRect();
    return Math.max(vb.w / r.width, vb.h / r.height);
  };
  function zoomAt(factor, cx, cy) {
    const p = toMap(cx, cy);
    const w = Math.min(W * 1.3, Math.max(W / 16, vb.w * factor));
    const f = w / vb.w;
    vb = { x: p.x - (p.x - vb.x) * f, y: p.y - (p.y - vb.y) * f, w, h: vb.h * f };
    apply();
  }
  function zoomCenter(factor) {
    const r = svg.getBoundingClientRect();
    zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2);
  }
  let anim = 0;
  function flyTo(x, y, w = W / 4) {
    cancelAnimationFrame(anim);
    const from = { ...vb };
    const h = w * (H / W);
    const to = { x: x - w / 2, y: y - h / 2, w, h };
    const t0 = performance.now();
    const dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
    const step = (now) => {
      const t = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      vb = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e };
      apply();
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  const reset = () => flyTo(W / 2, H / 2, W);

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(Math.pow(1.0018, e.deltaY * (e.deltaMode === 1 ? 30 : 1)), e.clientX, e.clientY);
  }, { passive: false });

  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let moved = false;
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, vb: { ...vb } };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: vb.w };
      drag = null;
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((pinch.w * (pinch.d / d)) / vb.w, (a.x + b.x) / 2, (a.y + b.y) / 2);
      moved = true;
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        moved = true;
        stage.classList.add('dragging');
        hideTip();
      }
      if (moved) {
        const u = unitsPerPx();
        vb = { ...drag.vb, x: drag.vb.x - dx * u, y: drag.vb.y - dy * u };
        apply();
      }
      return;
    }
    if (e.pointerType === 'mouse') hover(e);
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      if (drag && !moved) click(e);
      drag = null;
      stage.classList.remove('dragging');
    }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && hideTip());

  // ---------------------------------------------------------------- picking
  const G = 24;
  const grid = new Map();
  D.files.forEach((f, i) => {
    const k = `${Math.floor(f.x / G)},${Math.floor(f.y / G)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  function pick(clientX, clientY) {
    const p = toMap(clientX, clientY);
    const radius = Math.max(6, 14 * unitsPerPx());
    const r = Math.ceil(radius / G);
    const gx = Math.floor(p.x / G);
    const gy = Math.floor(p.y / G);
    let best = -1;
    let bd = radius;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (const i of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          const f = D.files[i];
          const weight = f.c === 'village' ? 1 : 0.8; // bigger settlements win ties
          const d = Math.hypot(f.x - p.x, f.y - p.y) * weight;
          if (d < bd) [bd, best] = [d, i];
        }
      }
    }
    return best;
  }

  const hl = document.createElementNS(NS, 'g');
  hl.setAttribute('class', 'hbd-hl');
  svg.appendChild(hl);
  function highlight(i, sticky) {
    hl.innerHTML = '';
    if (i < 0) return;
    const f = D.files[i];
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', f.x);
    c.setAttribute('cy', f.y);
    c.setAttribute('r', f.c === 'village' ? 6 : 12);
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', sticky ? '#7c1d14' : '#3a2716');
    c.setAttribute('stroke-width', sticky ? 2.4 : 1.6);
    hl.appendChild(c);
  }

  function flagsOf(f) {
    const out = [];
    if (f.d >= 0) out.push(`<span class="flag dragon">🐉 ${esc(D.dragons[f.d].name)}</span>`);
    if (f.t) out.push('<span class="flag tested">walled · tested</span>');
    if (f.ru) out.push('<span class="flag ruin">ruins · keeper away</span>');
    if (f.ai >= 0.05) out.push(`<span class="flag ai">${pct(f.ai)} forged by AI</span>`);
    if (f.td) out.push(`<span class="flag">${f.td} TODO${f.td === 1 ? '' : 's'}</span>`);
    return out.join('');
  }

  let hovered = -1;
  function hover(e) {
    const i = pick(e.clientX, e.clientY);
    if (i !== hovered) {
      hovered = i;
      if (selected < 0) highlight(i, false);
    }
    if (i < 0) return hideTip();
    const f = D.files[i];
    tip.innerHTML = `<div class="t-name">${esc(f.n)}</div><div class="t-path">${esc(f.p)}</div>
      <div class="t-row"><span>${num(f.loc)} lines</span><span>${num(f.rev)} commits</span><span>${num(f.au)} author${f.au === 1 ? '' : 's'}</span><span>changed ${ago(f.age)}</span></div>
      <div class="t-flags">${flagsOf(f)}</div>`;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 16;
    let y = e.clientY + 16;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 16;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 16;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
    stage.style.cursor = 'pointer';
  }
  function hideTip() {
    tip.hidden = true;
    stage.style.cursor = '';
    if (selected < 0) highlight(-1);
    hovered = -1;
  }

  // ---------------------------------------------------------------- selection
  let selected = -1;
  function click(e) {
    const dragonEl = e.target.closest && e.target.closest('[data-dragon]');
    const i = dragonEl ? D.dragons[Number(dragonEl.dataset.dragon)].file : pick(e.clientX, e.clientY);
    if (i >= 0) select(i, false);
    else deselect();
  }
  function select(i, fly = true) {
    selected = i;
    highlight(i, true);
    const f = D.files[i];
    if (fly) flyTo(f.x, f.y, Math.min(vb.w, W / 4));
    const prov = D.provinces[f.pr];
    const roads = D.routes.filter((r) => r.a === i || r.b === i);
    const dragon = f.d >= 0 ? D.dragons[f.d] : null;
    dossier.innerHTML = `
      <div class="dossier-head"><h2>${esc(f.n)}</h2><button aria-label="Close" data-close>×</button></div>
      <div class="muted" style="font-size:13px;word-break:break-all">${esc(f.p)}</div>
      ${dragon ? `<p style="margin:8px 0 4px"><b style="color:var(--red)">${esc(dragon.name)} ${esc(dragon.title)}</b> lairs here (${esc(dragon.tier)}). Complex code that keeps changing: the likeliest place for the next bug.</p>` : ''}
      <div class="flags">${flagsOf(f)}</div>
      <div class="stats">
        <div><b>${num(f.loc)}</b>lines (${esc(f.l)})</div>
        <div><b>${num(f.rev)}</b>commits</div>
        <div><b>${f.dp}</b>max nesting depth</div>
        <div><b>${f.hs ? f.hs.toFixed(2) : '—'}</b>hotspot score</div>
        <div><b>${num(f.au)}</b>authors</div>
        <div><b>${ago(f.age)}</b>last changed</div>
      </div>
      ${f.o ? `<p style="margin:8px 0 0;font-size:15px">Keeper: <b>${esc(f.o)}</b> (${pct(f.os)} of its lines)${f.ru ? ', no commits here in 6+ months' : ''}.</p>` : ''}
      ${prov ? `<p class="muted" style="margin:4px 0 0;font-size:14px">Province of <b>${esc(prov.name)}</b></p>` : ''}
      ${roads.length ? `<div style="margin-top:8px;font:14px var(--fell-sc);letter-spacing:1px" class="muted">Roads (changes together with)</div><ul class="mini-list">${roads
        .map((r) => {
          const o = r.a === i ? r.b : r.a;
          return `<li data-file="${o}">${esc(D.files[o].p)} <span class="muted">· ${r.shared} commits</span></li>`;
        })
        .join('')}</ul>` : ''}`;
    dossier.hidden = false;
    openPanel();
    history.replaceState(null, '', `#${encodeURIComponent(f.p)}`);
  }
  function deselect() {
    selected = -1;
    highlight(-1);
    dossier.hidden = true;
    history.replaceState(null, '', location.pathname + location.search);
  }
  dossier.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return deselect();
    const li = e.target.closest('[data-file]');
    if (li) select(Number(li.dataset.file));
  });

  // ---------------------------------------------------------------- panel
  const tabs = {
    chronicle() {
      const paras = D.chronicle
        .map((p) => `<p>${p.map((s) => (typeof s === 'string' ? esc(s) : s.b ? `<b>${esc(s.b)}</b>` : `<code>${esc(s.code)}</code>`)).join('')}</p>`)
        .join('');
      const s = D.stats;
      return `${paras}<div class="stats" style="margin-top:14px">
        <div><b>${num(s.files)}</b>settlements</div><div><b>${num(s.loc)}</b>lines</div>
        <div><b>${num(s.commits)}</b>commits</div><div><b>${num(s.authors)}</b>souls</div>
        <div><b>${D.dragons.length}</b>dragons</div><div><b>${D.busFactor}</b>bus factor</div>
      </div>`;
    },
    dragons() {
      if (!D.dragons.length) return '<p>No dragons here. Complex code is left in peace, or the realm is still young.</p>';
      const max = Math.max(...D.dragons.map((d) => d.revisions));
      return `<p class="muted" style="font-size:15px">Dragons lair in <b>hotspots</b>: files that are both complex and changed often. They are where defects concentrate, and the first places worth refactoring.</p>${D.dragons
        .map(
          (d, k) => `<div class="card" data-file="${d.file}">
          <div class="tier">${esc(d.tier)} · #${k + 1}</div>
          <h4>${esc(d.name)} ${esc(d.title)}</h4>
          <div class="meta"><code>${esc(d.path)}</code></div>
          <div class="why">${num(d.loc)} lines · depth ${d.maxDepth} · ${num(d.revisions)} commits · ${num(d.authors)} authors${d.ruin ? ' · keeper away' : ''}${d.aiShare >= 0.05 ? ` · ${pct(d.aiShare)} AI` : ''}</div>
          <div class="bar"><i style="width:${Math.round((d.revisions / max) * 100)}%"></i></div>
        </div>`,
        )
        .join('')}`;
    },
    quests() {
      if (!D.quests.length) return '<p>The realm is at peace. No quests today.</p>';
      const icon = { slay: '⚔', fortify: '🛡', rebuild: '🏚', survey: '🧭' };
      return D.quests
        .map((q) => {
          const i = D.files.findIndex((f) => f.p === q.path);
          return `<div class="card" data-file="${i}">
            <h4>${icon[q.kind] ?? '•'} ${esc(q.title)}</h4>
            <div class="meta"><code>${esc(q.path)}</code>${q.other ? ` ⇄ <code>${esc(q.other)}</code>` : ''}</div>
            <div class="why">${esc(q.why)}</div>
            <div class="why muted">${esc(q.how)}</div>
          </div>`;
        })
        .join('');
    },
    houses() {
      const total = D.stats.loc || 1;
      const color = new Map(D.houses.map((h) => [h.name, h.color]));
      return `<p class="muted" style="font-size:15px">Each settlement belongs to the author who wrote most of it. Knowledge held by people who have left becomes <b>ruins</b>.</p>
      <table><thead><tr><th>House</th><th class="num">Land</th><th class="num">Commits</th><th>Last seen</th></tr></thead><tbody>${D.authors
        .filter((a) => a.ownedLoc > 0)
        .slice(0, 25)
        .map(
          (a) => `<tr><td>${color.has(a.name) ? `<span class="swatch" style="background:${color.get(a.name)}"></span>` : ''}${esc(a.name)}</td>
          <td class="num">${pct(a.ownedLoc / total)}</td><td class="num">${num(a.commits)}</td>
          <td class="${a.active ? '' : 'muted'}">${new Date(a.last).toISOString().slice(0, 10)}</td></tr>`,
        )
        .join('')}</tbody></table>`;
    },
    provinces() {
      return `<table><thead><tr><th>Province</th><th class="num">Lines</th><th class="num">Bus</th><th class="num">Tested</th></tr></thead><tbody>${D.provinces
        .map((p, i) => [p, i])
        .sort((a, b) => b[0].loc - a[0].loc)
        .map(
          ([p, i]) => `<tr data-x="${p.x}" data-y="${p.y}" data-p="${i}"><td>${esc(p.name)}${p.heartland ? ' <span class="muted">(heartland)</span>' : ''}<br><span class="muted" style="font-size:12px">${num(p.files)} files · ${esc(p.owner ?? '—')}</span></td>
          <td class="num">${num(p.loc)}</td><td class="num">${p.busFactor}</td><td class="num">${pct(p.tested)}</td></tr>`,
        )
        .join('')}</tbody></table><p class="muted" style="font-size:13px;margin-top:8px">Bus factor: how many people hold half of a province's knowledge.</p>`;
    },
  };
  let current = 'chronicle';
  function showTab(name) {
    current = name;
    for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
    content.innerHTML = tabs[name]();
    content.scrollTop = 0;
  }
  document.getElementById('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) showTab(b.dataset.tab);
  });
  content.addEventListener('click', (e) => {
    const card = e.target.closest('[data-file]');
    if (card && Number(card.dataset.file) >= 0) return select(Number(card.dataset.file));
    const row = e.target.closest('tr[data-x]');
    if (row) flyTo(Number(row.dataset.x), Number(row.dataset.y), W / 3);
  });
  const openPanel = () => document.body.classList.remove('panel-closed');
  if (innerWidth <= 820) document.body.classList.add('panel-closed');
  document.getElementById('when').textContent = new Date(D.generatedAt).toISOString().slice(0, 10);

  // ---------------------------------------------------------------- search
  const q = document.getElementById('q');
  const results = document.getElementById('results');
  let hits = [];
  let cursor = 0;
  function score(f, terms) {
    const p = f.p.toLowerCase();
    let s = 0;
    for (const t of terms) {
      const i = p.lastIndexOf(t);
      if (i < 0) return -1;
      s += i >= p.lastIndexOf('/') ? 10 : 2; // matches in the file name count more
    }
    return s + Math.log10(f.loc + 1) + (f.d >= 0 ? 3 : 0);
  }
  function search() {
    const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) {
      results.hidden = true;
      return;
    }
    hits = D.files
      .map((f, i) => [score(f, terms), i])
      .filter(([s]) => s >= 0)
      .sort((a, b) => b[0] - a[0])
      .slice(0, 12)
      .map(([, i]) => i);
    cursor = 0;
    results.innerHTML = hits.length
      ? hits.map((i, k) => `<li role="option" data-file="${i}" aria-selected="${k === 0}">${D.files[i].d >= 0 ? '🐉 ' : ''}${esc(D.files[i].n)}<small>${esc(D.files[i].p)}</small></li>`).join('')
      : '<li class="muted">No such settlement.</li>';
    results.hidden = false;
  }
  q.addEventListener('input', search);
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = (cursor + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % Math.max(1, hits.length);
      [...results.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === cursor)));
    } else if (e.key === 'Enter' && hits.length) {
      select(hits[cursor]);
      results.hidden = true;
      q.blur();
    } else if (e.key === 'Escape') {
      q.value = '';
      results.hidden = true;
      q.blur();
    }
  });
  results.addEventListener('click', (e) => {
    const li = e.target.closest('[data-file]');
    if (!li) return;
    select(Number(li.dataset.file));
    results.hidden = true;
  });

  // ---------------------------------------------------------------- tools
  const layersPop = document.getElementById('layers');
  const dlPop = document.getElementById('downloads');
  const togglePop = (pop, other) => {
    other.hidden = true;
    pop.hidden = !pop.hidden;
  };
  document.getElementById('tools').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'zoom-in') zoomCenter(1 / 1.5);
    else if (act === 'zoom-out') zoomCenter(1.5);
    else if (act === 'reset') reset();
    else if (act === 'layers') togglePop(layersPop, dlPop);
    else if (act === 'download') togglePop(dlPop, layersPop);
    else if (act === 'panel') document.body.classList.toggle('panel-closed');
  });
  layersPop.addEventListener('change', (e) => {
    const name = e.target.dataset.layer;
    if (name === 'ruins') document.body.classList.toggle('show-ruins', e.target.checked);
    else document.body.classList.toggle(`hide-${name}`, !e.target.checked);
  });

  const slug = D.name.replace(/[^\w.-]+/g, '-');
  const save = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  dlPop.addEventListener('click', (e) => {
    const kind = e.target.dataset && e.target.dataset.dl;
    if (!kind) return;
    if (kind === 'svg') save(new Blob([originalSVG], { type: 'image/svg+xml' }), `${slug}-map.svg`);
    if (kind === 'json') save(new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' }), `${slug}-realm.json`);
    if (kind === 'png') {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = W * 2;
        canvas.height = H * 2;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => b && save(b, `${slug}-map.png`), 'image/png');
      };
      img.src = URL.createObjectURL(new Blob([originalSVG], { type: 'image/svg+xml' }));
    }
  });

  addEventListener('keydown', (e) => {
    if (e.target === q) return;
    if (e.key === '/') {
      e.preventDefault();
      q.focus();
    } else if (e.key === '+' || e.key === '=') zoomCenter(1 / 1.5);
    else if (e.key === '-') zoomCenter(1.5);
    else if (e.key === '0') reset();
    else if (e.key === 'Escape') {
      deselect();
      layersPop.hidden = dlPop.hidden = true;
    }
  });
  addEventListener('click', (e) => {
    if (!e.target.closest('#search')) results.hidden = true;
    if (!e.target.closest('.pop') && !e.target.closest('#tools')) layersPop.hidden = dlPop.hidden = true;
  });

  showTab(current);
  const fromHash = decodeURIComponent(location.hash.slice(1));
  if (fromHash) {
    const i = D.files.findIndex((f) => f.p === fromHash);
    if (i >= 0) setTimeout(() => select(i), 200);
  }
})();
