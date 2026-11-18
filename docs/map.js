const NS = "http://www.w3.org/2000/svg";
const CELL = 20;
const PX = 6;
const ISLAND_W = 560;
const ISLAND_H = 380;
const GAP = 240;
const REFRESH_MS = 60_000;
const ME_KEY = "katasMapMe";
const SAMPLE = new URLSearchParams(location.search).has("sample");

const THEMES = {
  beach: { ground: "#6cbf4b", edge: "#f2d388", deco: ["palm", "palm", "bush", "rock"] },
  jungle: { ground: "#2f8f3e", edge: "#c9b26b", deco: ["pine", "bush", "pine", "palm"] },
  desert: { ground: "#e8a74e", edge: "#f5d38a", deco: ["cactus", "rock", "cactus"] },
  snow: { ground: "#e9f3fb", edge: "#b9d4ea", deco: ["snowpine", "rock", "snowpine"] },
  lava: { ground: "#4a3b47", edge: "#7a5a4f", deco: ["volcano", "rock", "ember"] },
  castle: { ground: "#7fae5a", edge: "#bfb7a6", deco: ["tower", "bush", "rock"] },
  fog: { ground: "#8e9bb0", edge: "#b4bfcf", deco: [] },
};

const PALETTE = {
  G: "#2e7d32", g: "#66bb6a", B: "#8d5a2b", S: "#7d7d8c", s: "#c0c0cc", C: "#3c9a4a",
  W: "#ffffff", R: "#e53935", O: "#ff9800", K: "#241a33",
};

const SPRITES = {
  palm: ["..gg.gg.", ".gGGgGGg", "gG.BB.Gg", "...BB...", "...BB...", "...BB...", "..BBBB.."],
  pine: ["...G...", "..GGG..", ".GgGGG.", "..GGG..", ".GGgGG.", "GGGGGGG", "...B...", "...B..."],
  snowpine: ["...W...", "..WGW..", ".GWGGG.", "..GGG..", ".WGGGW.", "GGGWGGG", "...B...", "...B..."],
  bush: [".gGg.", "gGGGg", "GGGGG"],
  rock: ["..ss.", ".sSSs", "sSSSS"],
  cactus: ["..C..", "C.C..", "CCC.C", "..CCC", "..C..", "..C.."],
  volcano: ["...RO...", "..KRRK..", ".KSSSSK.", "KSSsSSSK", "SSSSSsSS"],
  ember: ["O.R", "ROR", ".R."],
  tower: ["S.S.S", "SSSSS", "SsSsS", "SSKSS", "SSKSS"],
  flag: ["KRRRR", "KRRRR", "KRRR.", "K....", "K....", "K....", "K...."],
};

const $ = (id) => document.getElementById(id);
const svg = $("map");
const tip = $("tip");

let worldsCfg = { title: "Python Katas", worlds: [] };
let progress = { students: {}, tested: [] };
let layout = null;
let me = localStorage.getItem(ME_KEY) || "";
let view = { x: 0, y: 0, w: 1000, h: 600 };

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sprite(name, x, y, parent, scale = PX) {
  const rows = SPRITES[name];
  const g = el("g", { transform: `translate(${x - (rows[0].length * scale) / 2},${y - rows.length * scale})` }, parent);
  rows.forEach((row, ry) => [...row].forEach((ch, rx) => {
    if (PALETTE[ch]) el("rect", { x: rx * scale, y: ry * scale, width: scale, height: scale, fill: PALETTE[ch] }, g);
  }));
  return g;
}

function label(text, x, y, size, parent, attrs = {}) {
  const t = el("text", {
    x, y, "font-size": size, "text-anchor": "middle", fill: "#fff4d6",
    stroke: "#241a33", "stroke-width": Math.max(3, size / 5), "paint-order": "stroke",
    "stroke-linejoin": "round", ...attrs,
  }, parent);
  t.textContent = text;
  return t;
}

/* ---------- layout ---------- */

function checkpointSpots(n) {
  const spots = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -200 + (400 * i) / (n - 1);
    spots.push({ x, y: i % 2 ? 55 : -45 });
  }
  return spots;
}

function computeLayout(worlds) {
  const items = worlds.map((w, i) => ({ ...w, index: i }));
  items.push({ id: "fog", name: "???", theme: "fog", katas: [], fog: true, index: worlds.length });
  return items.map((w) => {
    const cx = w.index * (ISLAND_W + GAP);
    const cy = w.index % 2 ? 70 : -70;
    return {
      ...w, cx, cy,
      entry: { x: cx - 260, y: cy + 10 },
      flag: { x: cx + 255, y: cy + 5 },
      spots: checkpointSpots(w.katas.length).map((p) => ({ x: cx + p.x, y: cy + p.y })),
    };
  });
}

function routePoints(world) {
  return [world.entry, ...world.spots, world.flag];
}

/* ---------- drawing the world ---------- */

function drawIsland(world, parent) {
  const theme = THEMES[world.theme] || THEMES.beach;
  const rand = rng(hash(world.id));
  const g = el("g", { class: "island" }, parent);
  const a = ISLAND_W / 2 - 10;
  const b = ISLAND_H / 2 - 10;
  const phase = rand() * Math.PI * 2;
  const land = [];

  for (let gx = -16; gx <= 16; gx++) {
    for (let gy = -12; gy <= 12; gy++) {
      const x = gx * CELL;
      const y = gy * CELL;
      const ang = Math.atan2(y, x);
      const v = (x / a) ** 2 + (y / b) ** 2 + Math.sin(ang * 3 + phase) * 0.1 + (rand() - 0.5) * 0.12;
      const px = world.cx + x - CELL / 2;
      const py = world.cy + y - CELL / 2;
      if (v < 1.2 && v >= 1) {
        el("rect", { x: px, y: py, width: CELL, height: CELL, fill: "#3f86c4" }, g);
      } else if (v < 1) {
        el("rect", { x: px, y: py, width: CELL, height: CELL, fill: v > 0.78 ? theme.edge : theme.ground }, g);
        if (v < 0.7) land.push({ x: world.cx + x, y: world.cy + y });
      }
    }
  }

  const avoid = routePoints(world);
  const decos = [];
  for (const p of land.sort(() => rand() - 0.5)) {
    if (decos.length >= 9 || !theme.deco.length) break;
    if (avoid.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 75)) continue;
    if (decos.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 60)) continue;
    if (Math.abs(p.y - world.cy) < 40 && Math.abs(p.x - world.cx) < 230) continue;
    decos.push(p);
  }
  decos.sort((p, q) => p.y - q.y).forEach((p, i) => sprite(theme.deco[i % theme.deco.length], p.x, p.y, g));
  return g;
}

function dottedLine(points, parent, step = 18) {
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const n = Math.max(1, Math.floor(Math.hypot(q.x - p.x, q.y - p.y) / step));
    for (let k = 0; k < n; k++) {
      const x = p.x + ((q.x - p.x) * k) / n;
      const y = p.y + ((q.y - p.y) * k) / n;
      el("rect", { x: x - 3, y: y - 3, width: 6, height: 6, fill: "#fff4d6", stroke: "#241a33", "stroke-width": 1.5 }, parent);
    }
  }
}

function seaRoute(from, to) {
  const pts = [];
  const mx = (from.x + to.x) / 2;
  const my = Math.max(from.y, to.y) + 90;
  for (let t = 0; t <= 1.0001; t += 0.1) {
    pts.push({
      x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * mx + t ** 2 * to.x,
      y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * my + t ** 2 * to.y,
    });
  }
  return pts;
}

function drawWaves(parent) {
  const rand = rng(42);
  const minX = layout[0].cx - 1600;
  const maxX = layout[layout.length - 1].cx + 1600;
  const count = Math.round((maxX - minX) / 18);
  for (let i = 0; i < count; i++) {
    const x = Math.round((minX + rand() * (maxX - minX)) / PX) * PX;
    const y = Math.round((-1100 + rand() * 2200) / PX) * PX;
    el("rect", { x, y, width: PX * 3, height: PX, fill: "#2f6aa8" }, parent);
    el("rect", { x: x + PX * 3, y: y - PX, width: PX * 2, height: PX, fill: "#2f6aa8" }, parent);
  }
}

function passCounts() {
  const counts = {};
  for (const s of Object.values(progress.students || {})) {
    for (const k of s.passed || []) counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}

function drawWorld(world, parent, tested, counts) {
  drawIsland(world, parent);
  const g = el("g", {}, parent);

  if (world.fog) {
    for (const [dx, dy, s] of [[-150, -60, 1.3], [40, -110, 1], [120, 40, 1.4], [-60, 70, 1.1]]) {
      const c = el("g", { class: "cloud" }, g);
      c.style.animationDelay = `${dx / 40}s`;
      for (const [x, y, w, h] of [[0, 10, 120, 30], [20, -10, 70, 25], [60, 0, 50, 20]]) {
        el("rect", { x: world.cx + dx + x * s, y: world.cy + dy + y * s, width: w * s, height: h * s, fill: "#eef2f8" }, c);
      }
    }
    label("???", world.cx, world.cy + 14, 56, g, { "font-weight": 700 });
    label("Next world coming soon", world.cx, world.cy - ISLAND_H / 2 - 4, 22, g);
    return;
  }

  label(world.name, world.cx, world.cy - ISLAND_H / 2 - 4, 30, g, { "font-weight": 700 });
  dottedLine(routePoints(world), g);
  sprite("flag", world.flag.x + 12, world.flag.y + 6, g, 7);

  world.katas.forEach((kata, i) => {
    const p = world.spots[i];
    const isTested = tested.has(kata);
    const cp = el("g", { class: "checkpoint", tabindex: 0, role: "img" }, g);
    const box = el("rect", {
      x: p.x - 17, y: p.y - 17, width: 34, height: 34,
      fill: isTested ? "#ffcc33" : "#b4bfcf", stroke: "#241a33", "stroke-width": 3,
    }, cp);
    if (!isTested) box.setAttribute("stroke-dasharray", "6 4");
    const num = el("text", {
      x: p.x, y: p.y + 7, "font-size": 20, "font-weight": 700, "text-anchor": "middle", fill: "#241a33",
    }, cp);
    num.textContent = isTested ? String(i + 1) : "?";
    label(kata, p.x, p.y + 40, 15, cp);
    const text = isTested
      ? `<strong>${kata}</strong><br>${counts[kata] || 0} passed`
      : `<strong>${kata}</strong><br>Coming soon`;
    cp.setAttribute("aria-label", `${kata}: ${isTested ? `${counts[kata] || 0} passed` : "coming soon"}`);
    bindTip(cp, () => text);
  });
}

/* ---------- soldiers ---------- */

function soldierAnchor(student) {
  const worlds = layout.filter((w) => !w.fog);
  if (!worlds.length) return null;
  if (student.world >= worlds.length) {
    const last = worlds[worlds.length - 1];
    return { x: last.flag.x + 40, y: last.flag.y + 10, key: "finish" };
  }
  const world = worlds[student.world];
  const tested = new Set(progress.tested || []);
  const passed = new Set(student.passed || []);
  const idx = world.katas.findIndex((k) => tested.has(k) && !passed.has(k));
  if (idx < 0) return { ...world.entry, key: `${world.index}:entry` };
  return { ...world.spots[idx], key: `${world.index}:${idx}` };
}

function teamColor(login) {
  return `hsl(${hash(login) % 360} 70% 55%)`;
}

function drawSoldier(login, student, x, y, parent) {
  const isMe = me && login.toLowerCase() === me.toLowerCase();
  const g = el("g", {
    class: `soldier${isMe ? " me" : ""}`, transform: `translate(${x},${y})`,
    tabindex: 0, role: "img", "aria-label": `${login}, ${(student.passed || []).length} katas passed`,
    "data-login": login,
  }, parent);
  const body = el("g", { class: "bob" }, g);
  body.style.animationDelay = `${(hash(login) % 10) / 10}s`;
  const color = teamColor(login);
  el("rect", { x: -8, y: 4, width: 6, height: 10, fill: "#241a33" }, body);
  el("rect", { x: 2, y: 4, width: 6, height: 10, fill: "#241a33" }, body);
  el("rect", { x: -11, y: -10, width: 22, height: 16, fill: color, stroke: "#241a33", "stroke-width": 2.5 }, body);
  const clipId = `clip-${hash(login)}`;
  const clip = el("clipPath", { id: clipId }, body);
  el("circle", { cx: 0, cy: -22, r: 13 }, clip);
  el("circle", { cx: 0, cy: -22, r: 13, fill: color }, body);
  label(login[0].toUpperCase(), 0, -16, 16, body, { "font-weight": 700 });
  if (!SAMPLE) {
    el("image", {
      href: `https://github.com/${encodeURIComponent(login)}.png?size=64`,
      x: -13, y: -35, width: 26, height: 26, "clip-path": `url(#${clipId})`,
      preserveAspectRatio: "xMidYMid slice",
    }, body).addEventListener("error", (e) => e.target.remove());
  }
  el("circle", { class: "ring", cx: 0, cy: -22, r: 13, fill: "none", stroke: "#241a33", "stroke-width": 3 }, body);
  el("rect", { x: -12, y: -41, width: 24, height: 7, fill: "#5b6b2f", stroke: "#241a33", "stroke-width": 2 }, body);
  el("rect", { x: -16, y: -35, width: 32, height: 4, fill: "#5b6b2f", stroke: "#241a33", "stroke-width": 2 }, body);
  bindTip(g, () => soldierTip(login, student));
  return g;
}

function soldierTip(login, student) {
  const worlds = layout.filter((w) => !w.fog);
  const where = student.world >= worlds.length ? "Finished every world" : worlds[student.world]?.name || "";
  const n = (student.passed || []).length;
  return `<strong>${login}</strong><br>${n} kata${n === 1 ? "" : "s"} passed<br>${where}`;
}

function drawSoldiers(parent) {
  parent.replaceChildren();
  const groups = new Map();
  for (const [login, s] of Object.entries(progress.students || {})) {
    const anchor = soldierAnchor(s);
    if (!anchor) continue;
    if (!groups.has(anchor.key)) groups.set(anchor.key, { anchor, list: [] });
    groups.get(anchor.key).list.push([login, s]);
  }
  const isMe = (l) => me && l.toLowerCase() === me.toLowerCase();
  for (const { anchor, list } of groups.values()) {
    list.sort(([a, sa], [b, sb]) => (isMe(b) - isMe(a)) || String(sb.updated_at).localeCompare(String(sa.updated_at)));
    const shown = list.slice(0, 3);
    const offsets = [[0, -28], [-26, -20], [26, -20]];
    [...shown].reverse().forEach(([login, s], ri) => {
      const [dx, dy] = offsets[shown.length - 1 - ri];
      drawSoldier(login, s, anchor.x + dx, anchor.y + dy, parent);
    });
    if (list.length > 3) {
      const extra = list.slice(3);
      const badge = el("g", { class: "soldier", tabindex: 0, role: "img", "aria-label": `${extra.length} more soldiers` }, parent);
      el("rect", { x: anchor.x + 30, y: anchor.y - 74, width: 40, height: 24, fill: "#ffcc33", stroke: "#241a33", "stroke-width": 3 }, badge);
      const t = el("text", { x: anchor.x + 50, y: anchor.y - 56, "font-size": 16, "font-weight": 700, "text-anchor": "middle", fill: "#241a33" }, badge);
      t.textContent = `+${extra.length}`;
      bindTip(badge, () => {
        const names = extra.slice(0, 15).map(([l]) => l).join("<br>");
        return extra.length > 15 ? `${names}<br>and ${extra.length - 15} more` : names;
      });
    }
  }
}

/* ---------- tooltip ---------- */

function bindTip(node, html) {
  const show = (x, y) => {
    tip.innerHTML = html();
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(x + 14, innerWidth - r.width - 8)}px`;
    tip.style.top = `${Math.max(8, y - r.height - 10)}px`;
  };
  node.addEventListener("pointerenter", (e) => show(e.clientX, e.clientY));
  node.addEventListener("pointermove", (e) => show(e.clientX, e.clientY));
  node.addEventListener("pointerleave", () => { tip.hidden = true; });
  node.addEventListener("focus", () => {
    const r = node.getBoundingClientRect();
    show(r.right, r.top);
  });
  node.addEventListener("blur", () => { tip.hidden = true; });
}

/* ---------- pan & zoom ---------- */

function applyView() {
  svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
}

function toWorld(clientX, clientY) {
  const r = svg.getBoundingClientRect();
  return { x: view.x + ((clientX - r.left) / r.width) * view.w, y: view.y + ((clientY - r.top) / r.height) * view.h };
}

function zoomAt(clientX, clientY, factor) {
  const p = toWorld(clientX, clientY);
  const aspect = view.h / view.w;
  const w = Math.min(8000, Math.max(320, view.w * factor));
  const k = w / view.w;
  view = { x: p.x - (p.x - view.x) * k, y: p.y - (p.y - view.y) * k, w, h: w * aspect };
  applyView();
}

function centerOn(x, y, w = view.w) {
  const aspect = svg.clientHeight / svg.clientWidth;
  view = { x: x - w / 2, y: y - (w * aspect) / 2, w, h: w * aspect };
  applyView();
}

function fitView() {
  const aspect = svg.clientHeight / svg.clientWidth;
  const minX = layout[0].cx - ISLAND_W / 2 - 60;
  const maxX = layout[layout.length - 1].cx + ISLAND_W / 2 + 60;
  const minH = ISLAND_H + 380;
  let w = maxX - minX;
  if (w * aspect < minH) w = minH / aspect;
  const maxW = svg.clientWidth < 700 ? ISLAND_W + 140 : Math.max(minH / aspect, 1400);
  const focus = findMe();
  if (w > maxW || focus) {
    w = Math.min(w, maxW);
    const anchor = focus ? soldierAnchor(progress.students[focus]) : layout[0];
    const x = focus ? anchor.x : Math.max(layout[0].cx, minX + w / 2);
    centerOn(x, anchor.y ?? anchor.cy, w);
    return;
  }
  centerOn((minX + maxX) / 2, 0, w);
}

function setupPanZoom() {
  const pointers = new Map();
  let last = null;
  let pinch = null;

  svg.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    svg.setPointerCapture(e.pointerId);
    svg.classList.add("dragging");
    last = { x: e.clientX, y: e.clientY };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch / d);
      pinch = d;
      return;
    }
    const r = svg.getBoundingClientRect();
    view.x -= ((e.clientX - last.x) / r.width) * view.w;
    view.y -= ((e.clientY - last.y) / r.height) * view.h;
    last = { x: e.clientX, y: e.clientY };
    applyView();
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) svg.classList.remove("dragging");
    const rest = [...pointers.values()][0];
    if (rest) last = { ...rest };
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015));
  }, { passive: false });
  addEventListener("resize", () => {
    const aspect = svg.clientHeight / svg.clientWidth;
    view.h = view.w * aspect;
    applyView();
  });
}

/* ---------- data & HUD ---------- */

function findMe() {
  if (!me) return null;
  return Object.keys(progress.students || {}).find((l) => l.toLowerCase() === me.toLowerCase()) || null;
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return "";
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `Updated ${hours} h ago` : `Updated ${Math.round(hours / 24)} days ago`;
}

function renderHud() {
  $("title").textContent = worldsCfg.title || "Python Katas";
  document.title = worldsCfg.title || "Python Katas";
  const n = Object.keys(progress.students || {}).length;
  const soldiers = n === 1 ? "1 soldier on the map" : `${n} soldiers on the map`;
  const ago = progress.updated_at ? `. ${timeAgo(progress.updated_at)}` : "";
  $("stats").textContent = soldiers + ago;
}

function showBanner(text) {
  const banner = $("banner");
  banner.textContent = text || "";
  banner.hidden = !text;
}

let soldierLayer;

function render() {
  layout = computeLayout(worldsCfg.worlds || []);
  svg.replaceChildren();
  const sea = el("g", {}, svg);
  drawWaves(sea);
  const tested = new Set(progress.tested || []);
  const counts = passCounts();
  for (let i = 0; i < layout.length - 1; i++) dottedLine(seaRoute(layout[i].flag, layout[i + 1].entry), sea, 22);
  const worldsLayer = el("g", {}, svg);
  layout.forEach((w) => drawWorld(w, worldsLayer, tested, counts));
  soldierLayer = el("g", {}, svg);
  drawSoldiers(soldierLayer);
  renderHud();
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function loadData() {
  if (SAMPLE) {
    const sample = await fetchJson("sample-progress.json");
    return { worlds: sample.worlds, progress: sample.progress };
  }
  const [worlds, prog] = await Promise.all([fetchJson("worlds.json"), fetchJson("progress.json")]);
  return { worlds, progress: prog };
}

async function refresh(initial = false) {
  try {
    const data = await loadData();
    if (data.worlds) worldsCfg = data.worlds;
    progress = data.progress || { students: {}, tested: [] };
    const empty = !Object.keys(progress.students || {}).length;
    showBanner(empty ? "No soldiers yet. Open your [map] pull request to join the map." : "");
    if (initial) {
      render();
      fitView();
    } else {
      render();
    }
  } catch (err) {
    console.error(err);
    showBanner("Could not load the latest progress. The map will retry in a minute.");
    if (initial) render();
  }
}

function setupFind() {
  const input = $("find-input");
  input.value = me;
  $("find").addEventListener("submit", (e) => {
    e.preventDefault();
    me = input.value.trim().replace(/^@/, "");
    localStorage.setItem(ME_KEY, me);
    drawSoldiers(soldierLayer);
    const login = findMe();
    if (!me) return showBanner("");
    if (!login) return showBanner(`No soldier named ${me} yet. Open your [map] pull request to join.`);
    showBanner("");
    const a = soldierAnchor(progress.students[login]);
    centerOn(a.x, a.y, Math.min(view.w, 1100));
  });
}

setupPanZoom();
setupFind();
refresh(true);
setInterval(() => refresh(false), REFRESH_MS);
