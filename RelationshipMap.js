// ---------------------------------------------------------------------------
// The relationship map: one screen of who's who among your fluffies.
//
// Open it from Household ("Relationships") or with M. Your fluffies sit in
// groups: each herd together (in its colour), then families (everyone in a
// family line), then the ones on their own. Lines between them:
//   Love      green (a heart for special friends); an arrow if only one way
//   Family    thin grey, mum or dad to foal
//   Grudges   red; dashed when it's only one of them, "fights" when blows
//             have been swapped
//   Fear      purple arrow: scared of it (it hurt them, or an alicorn)
//   Gossip    gold dotted arrow: who told whom about you, lately
//   You       (off at first) you in the middle: green if it trusts you,
//             purple if it's afraid of you
// Chips at the top switch each kind on and off. Hover a fluffy to light up
// its lines; click it to see everything about its friends and enemies on
// the right, and "Show me" to go to it.
// Yours / Wild (top right): the wild fluffies in one place instead - the
// area you're in, or the park if there are none here (relMapScope). Opening
// it from a wild fluffy (its magnifying glass, the family tree) shows that
// one's area.
// Zoom: the mouse wheel over the map (about the pointer), or the + / - / Fit
// buttons in its corner; drag the map to move about when zoomed in
// (relMapView, REL_ZOOM_MAX).
// ---------------------------------------------------------------------------

const REL_LOVE = 0.5; // liking for a love line
const REL_GRUDGE = -0.3; // for a grudge line
const REL_TRUST = 0.6; // "You" lines
const REL_FEAR_YOU = 0.4;
const REL_GOSSIP_DAYS = 3; // gossip paths shown this long
const REL_CACHE = 0.5; // seconds (real) between rebuilding the lines

const REL_KINDS = [
  { id: "love", label: "Love", colour: "#6fdc8c" },
  { id: "family", label: "Family", colour: "#c8c8d0" },
  { id: "grudge", label: "Grudges", colour: "#ff6b6b" },
  { id: "fear", label: "Fear", colour: "#b98cff" },
  { id: "gossip", label: "Gossip", colour: "#ffd24d" },
  { id: "you", label: "You", colour: "#ffffff" },
];

let relMapOpen = false;
let relMapSel = null; // selected fluffy id
let relMapAll = null; // { id, page }: every tie one fluffy has, as a list ("All ties")
let relMapFilters = { love: true, family: true, grudge: true, fear: true, gossip: true, you: false };
let _relCache = null; // { at, people, groups, edges }
let _relPortraits = {}; // id:size -> canvas
let _relPortraitAt = 0;
let relMapView = { zoom: 1, x: 0, y: 0 }; // zoom, and how far it's moved (px)
let relMapScope = { wild: false, scene: null }; // whose map: yours, or the wild ones in a scene
let _relPan = null; // dragging the map: { sx, sy, x, y }
const REL_ZOOM_MAX = 4;
const REL_ZOOM_STEP = 1.25; // each wheel notch or button press

function openRelationshipMap(focus = null) {
  relMapOpen = true;
  relMapScope = focus && focus.isAlive && !focus.adopted ? { wild: true, scene: focus.scene } : { wild: false, scene: null };
  relMapSel = focus && focus.id !== undefined ? focus.id : null;
  relMapView = { zoom: 1, x: 0, y: 0 };
  _relCache = null;
  _relPortraits = {};
}
function closeRelationshipMap() {
  relMapOpen = false;
  relMapSel = null;
  relMapAll = null;
}
function isRelationshipMapOpen() {
  return relMapOpen;
}

function _relNow() {
  return typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000;
}
function _relName(f) {
  if (!f) return "?";
  const n = typeof fluffyNames !== "undefined" ? fluffyNames[f.id] : null;
  if (n) return n;
  const looks = typeof describeFluffyLooks === "function" ? describeFluffyLooks(f) : "fluffy";
  return looks.length > 16 ? looks.split(" ").slice(0, 2).join(" ") : looks;
}
function _relFullName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : _relName(f);
}

// Who's on the map: your living fluffies - or the wild ones in one place
function relMapPeople() {
  if (typeof fluffies === "undefined") return [];
  if (relMapScope.wild) return fluffies.filter((f) => f.isAlive && !f.adopted && f.scene === relMapScope.scene);
  return fluffies.filter((f) => f.isAlive && f.adopted);
}

// Where to look at the wild ones: here, or (none here) the park
function _relWildScene() {
  const here = typeof currentScene !== "undefined" ? currentScene : null;
  if (here && fluffies.some((f) => f.isAlive && !f.adopted && f.scene === here)) return here;
  return typeof PARK_SCENE !== "undefined" ? PARK_SCENE : here;
}

function setRelMapScope(wild) {
  relMapScope = wild ? { wild: true, scene: relMapScope.wild ? relMapScope.scene : _relWildScene() } : { wild: false, scene: null };
  relMapSel = null;
  relMapAll = null;
  relMapView = { zoom: 1, x: 0, y: 0 };
  _relCache = null;
}

function _relPlaceName(scene) {
  if (typeof householdRoomName === "function") return householdRoomName(scene);
  return String(scene || "").toLowerCase();
}

// Groups: herds, then family lines (2+), then the rest
function relMapGroups(people) {
  const groups = [];
  const placed = new Set();
  const herds = new Map();
  for (const f of people) {
    const h = typeof herdOf === "function" ? herdOf(f) : null;
    if (!h) continue;
    if (!herds.has(h)) herds.set(h, []);
    herds.get(h).push(f);
  }
  for (const [h, members] of herds) {
    groups.push({
      key: `herd:${h.id}`,
      label: typeof getHerdName === "function" ? getHerdName(h) : "A herd",
      colour: typeof getHerdColor === "function" ? getHerdColor(h) : "#ffffff",
      members,
    });
    for (const m of members) placed.add(m);
  }
  const lines = new Map();
  for (const f of people) {
    if (placed.has(f)) continue;
    const root = typeof lineRootOf === "function" ? lineRootOf(f.id) : f.id;
    if (!lines.has(root)) lines.set(root, []);
    lines.get(root).push(f);
  }
  const alone = [];
  for (const [root, members] of lines) {
    if (members.length < 2) {
      alone.push(...members);
      continue;
    }
    const n = typeof _flName === "function" ? _flName(root) : "A";
    groups.push({ key: `line:${root}`, label: `${n}'s family`, colour: "rgba(255,255,255,0.55)", members });
  }
  if (alone.length) groups.push({ key: "alone", label: groups.length ? "On their own" : "Your fluffies", colour: "rgba(255,255,255,0.4)", members: alone });
  for (const g of groups) g.members.sort((a, b) => a.id - b.id);
  return groups;
}

function _relFeared(f, o) {
  if ((f.fearedFluffies || []).some((x) => x && x.id === o.id)) return "it hurt them";
  if (
    typeof worldSettings !== "undefined" &&
    worldSettings.alicornIntolerance &&
    typeof o.typeVisibleToOthers === "function" &&
    o.typeVisibleToOthers() === "alicorn" &&
    f.type !== "alicorn" &&
    typeof f.tolerantOfAlicorns === "function" &&
    !f.tolerantOfAlicorns()
  )
    return "an alicorn";
  return null;
}

// Every line between them: { a, b, kind, strength, mutual, note }
function relMapEdges(people) {
  const edges = [];
  const byId = new Map(people.map((f) => [f.id, f]));
  const liking = (a, b) => (typeof getLiking === "function" ? getLiking(a, b) : 0);
  const special = (a, b) => typeof relationships !== "undefined" && relationships[a.id] && relationships[a.id][b.id] === "special_friend";
  const nowGame = typeof timePlayed === "number" ? timePlayed : 0;
  const day = typeof DAY_LENGTH === "number" ? DAY_LENGTH : 1200;
  for (let i = 0; i < people.length; i++) {
    const a = people[i];
    for (let j = i + 1; j < people.length; j++) {
      const b = people[j];
      // Family: mum or dad
      const parent = b.motherId === a.id || b.fatherId === a.id ? [a, b] : a.motherId === b.id || a.fatherId === b.id ? [b, a] : null;
      if (parent) edges.push({ a: parent[0], b: parent[1], kind: "family", strength: 0.5, mutual: true, note: parent[0].gender === "male" ? "dad" : "mum" });
      // Love and grudges (family love is taken as read: only strong ones)
      const ab = liking(a, b);
      const ba = liking(b, a);
      const sp = special(a, b) || special(b, a);
      const loveA = ab >= REL_LOVE;
      const loveB = ba >= REL_LOVE;
      if ((loveA || loveB) && (!parent || Math.min(ab, ba) >= 0.8 || sp)) {
        const mutual = loveA && loveB;
        const [x, y] = mutual || loveA ? [a, b] : [b, a];
        edges.push({ a: x, b: y, kind: "love", strength: Math.max(ab, ba), mutual, note: sp ? "special friends" : mutual ? "buddies" : "likes" });
      }
      const oa = typeof getOpinion === "function" ? getOpinion(a, b) : ab;
      const ob = typeof getOpinion === "function" ? getOpinion(b, a) : ba;
      const hateA = oa <= REL_GRUDGE;
      const hateB = ob <= REL_GRUDGE;
      if (hateA || hateB) {
        const mutual = hateA && hateB;
        const [x, y] = mutual || hateA ? [a, b] : [b, a];
        const why = [(a.opinionWhy || {})[b.id], (b.opinionWhy || {})[a.id]].filter(Boolean);
        const fights = why.some((w) => /attack|hit|bit/.test(w));
        edges.push({ a: x, b: y, kind: "grudge", strength: -Math.min(oa, ob), mutual, note: fights ? "fights" : mutual ? "can't stand each other" : "holds a grudge" });
      }
      // Fear (either way)
      for (const [x, y] of [
        [a, b],
        [b, a],
      ]) {
        const why = _relFeared(x, y);
        if (why) edges.push({ a: x, b: y, kind: "fear", strength: 0.6, mutual: false, note: why, alicorn: why === "an alicorn" });
      }
    }
  }
  // Gossip: who told whom lately
  for (const to of people) {
    const g = to.gossip;
    if (!g || !Array.isArray(g.from)) continue;
    for (const t of g.from) {
      const from = byId.get(t.id);
      if (!from || !(nowGame - (t.t || 0) < REL_GOSSIP_DAYS * day)) continue;
      edges.push({ a: from, b: to, kind: "gossip", strength: 0.5, mutual: false, note: t.kind === "harm" ? "told it you hurt fluffies" : "told it you're kind" });
    }
  }
  // You
  for (const f of people) {
    const trust = f.playerTrust || 0;
    const fear = f.playerFear || 0;
    if (fear >= REL_FEAR_YOU && fear >= trust * 0.8) edges.push({ a: f, b: null, kind: "you", strength: fear, mutual: false, note: "afraid of you", bad: true });
    else if (trust >= REL_TRUST) edges.push({ a: f, b: null, kind: "you", strength: trust, mutual: false, note: "trusts you" });
  }
  return edges;
}

function relMapData() {
  const now = _relNow();
  if (_relCache && now - _relCache.at < REL_CACHE) return _relCache;
  const people = relMapPeople();
  _relCache = { at: now, people, groups: relMapGroups(people), edges: relMapEdges(people) };
  return _relCache;
}

// ---- Layout ----

function getRelMapLayout() {
  const w = Math.min(1120, width - 30);
  const h = Math.min(690, height - 30);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  const side = 290;
  const paneX = x + 16 + (w - side - 40) + 16;
  // Filter chips: a second row if they'd run under the side pane
  const chips = [];
  let cx = x + 24;
  let cy = y + 58;
  for (const k of REL_KINDS) {
    const cw = 16 + k.label.length * 8 + 22;
    if (cx + cw > paneX - 8 && cx > x + 24) {
      cx = x + 24;
      cy += 34;
    }
    chips.push({ id: k.id, x: cx, y: cy, w: cw, h: 28 });
    cx += cw + 8;
  }
  const top = cy + 42;
  const graph = { x: x + 16, y: top, w: w - side - 40, h: y + h - 62 - top };
  const pane = { x: paneX, y: y + 60, w: side, h: h - 60 - 62 };
  const data = relMapData();
  const nodes = _relNodePositions(data, graph);
  // Zoomed in: everything moved and scaled about the middle of the map
  const view = _relViewOf(graph);
  if (view.z !== 1 || relMapView.x || relMapView.y) {
    for (const n of nodes.values()) {
      const p = view.at(n.x, n.y);
      n.x = p.x;
      n.y = p.y;
      n.r *= view.z;
    }
  }
  const youAt = view.at(graph.x + graph.w / 2, graph.y + graph.h / 2);
  // Yours | Wild (top right)
  const scope = [
    { id: "yours", label: "Yours", x: x + w - 280, y: y + 16, w: 110, h: 30 },
    { id: "wild", label: "Wild", x: x + w - 164, y: y + 16, w: 140, h: 30 },
  ];
  const zb = 30;
  const zoomBtns = [
    { id: "in", label: "+", x: graph.x + graph.w - 3 * (zb + 6) - 4, y: graph.y + 8, w: zb, h: zb },
    { id: "out", label: "\u2212", x: graph.x + graph.w - 2 * (zb + 6) - 4, y: graph.y + 8, w: zb, h: zb },
    { id: "fit", label: "Fit", x: graph.x + graph.w - (zb + 6) - 4, y: graph.y + 8, w: zb + 6, h: zb },
  ];
  return {
    view,
    scope,
    zoomBtns,
    x,
    y,
    w,
    h,
    graph,
    pane,
    chips,
    nodes,
    you: relMapFilters.you ? { x: youAt.x, y: youAt.y, r: 24 * view.z } : null,
    showMe: relMapSel !== null && !relMapAll ? { x: pane.x + 14, y: pane.y + pane.h - 44, w: 120, h: 34 } : null,
    allTies: relMapSel !== null && !relMapAll ? { x: pane.x + 142, y: pane.y + pane.h - 44, w: 134, h: 34 } : null,
    list: { x: x + 16, y: y + 60, w: w - 32, h: h - 60 - 62 },
    back: { x: x + 20, y: y + h - 50, w: 130, h: 36 },
    prev: { x: x + 160, y: y + h - 50, w: 110, h: 36 },
    next: { x: x + 280, y: y + h - 50, w: 110, h: 36 },
    close: { x: x + w - 150, y: y + h - 50, w: 130, h: 36 },
  };
}

// The zoom: { z, at(x, y) } turning a spot on the unzoomed map into where it
// is on screen now
function _relViewOf(G) {
  const cx = G.x + G.w / 2;
  const cy = G.y + G.h / 2;
  const z = relMapView.zoom;
  return { z, at: (x, y) => ({ x: cx + (x - cx) * z + relMapView.x, y: cy + (y - cy) * z + relMapView.y }) };
}

// Zoom by `factor`, keeping the spot at (px, py) where it is
function relMapZoom(factor, px, py) {
  const L = getRelMapLayout();
  const G = L.graph;
  const cx = G.x + G.w / 2;
  const cy = G.y + G.h / 2;
  if (px === undefined) {
    px = cx;
    py = cy;
  }
  const z = relMapView.zoom;
  const z2 = Math.max(1, Math.min(REL_ZOOM_MAX, z * factor));
  relMapView.x = px - cx - ((px - cx - relMapView.x) * z2) / z;
  relMapView.y = py - cy - ((py - cy - relMapView.y) * z2) / z;
  relMapView.zoom = z2;
  _relClampView(G);
}

// Keep the map from being moved off the edge
function _relClampView(G) {
  const z = relMapView.zoom;
  const mx = ((z - 1) * G.w) / 2;
  const my = ((z - 1) * G.h) / 2;
  relMapView.x = Math.max(-mx, Math.min(mx, relMapView.x));
  relMapView.y = Math.max(-my, Math.min(my, relMapView.y));
  if (z <= 1) relMapView.x = relMapView.y = 0;
}

function relMapFit() {
  relMapView = { zoom: 1, x: 0, y: 0 };
}

// The mouse wheel (globals.js): over the map, zoom about the pointer
function handleRelMapWheel(deltaY) {
  if (!relMapOpen || !deltaY) return false;
  const G = getRelMapLayout().graph;
  if (!isPointInRect(mouse.x, mouse.y, G.x, G.y, G.w, G.h)) return false;
  relMapZoom(deltaY < 0 ? REL_ZOOM_STEP : 1 / REL_ZOOM_STEP, mouse.x, mouse.y);
  return true;
}

// Dragging the map about (when zoomed in)
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("mousemove", () => {
    if (!_relPan || !relMapOpen) return;
    if (!mouse.down) {
      _relPan = null;
      return;
    }
    relMapView.x = _relPan.x + (mouse.x - _relPan.sx);
    relMapView.y = _relPan.y + (mouse.y - _relPan.sy);
    _relClampView(getRelMapLayout().graph);
  });
  window.addEventListener("mouseup", () => {
    _relPan = null;
  });
}

// Where each fluffy goes: groups round an oval, members in a ring
function _relNodePositions(data, g) {
  const out = new Map();
  const groups = data.groups;
  const n = data.people.length;
  const size = n > 30 ? 30 : n > 16 ? 38 : 46;
  const cx = g.x + g.w / 2;
  const cy = g.y + g.h / 2;
  const k = groups.length;
  // Lots of groups: a grid of them, each in its own cell
  if (k > 5) {
    const cols = Math.ceil(Math.sqrt((k * g.w) / g.h));
    const rows = Math.ceil(k / cols);
    const cw = g.w / cols;
    const ch = g.h / rows;
    const cellR = Math.max(0, Math.min(cw, ch) / 2 - size / 2 - 26);
    groups.forEach((grp, gi) => {
      const m = grp.members.length;
      grp.r = m <= 1 ? 0 : Math.min(cellR, (size * 1.25 * m) / (2 * Math.PI) + 18);
      grp.cx = g.x + cw * ((gi % cols) + 0.5);
      grp.cy = g.y + ch * (Math.floor(gi / cols) + 0.5) + 10;
      grp.members.forEach((f, i) => {
        const a = -Math.PI / 2 + (i / Math.max(1, m)) * Math.PI * 2;
        out.set(f.id, { f, x: grp.cx + Math.cos(a) * grp.r, y: grp.cy + Math.sin(a) * grp.r, r: size / 2, group: grp });
      });
    });
    return out;
  }
  // Each ring big enough for its members, but inside its share of the space
  const maxR = k > 1 ? Math.min(g.w, g.h) / (k > 4 ? 5.2 : 3.6) : Math.min(g.w, g.h) / 2 - 60;
  for (const grp of groups) {
    const m = grp.members.length;
    grp.r = m <= 1 ? 0 : Math.min(maxR, (size * 1.25 * m) / (2 * Math.PI) + 18);
  }
  // ...and the rings kept inside the box (with room for their names)
  const ring = Math.max(0, ...groups.map((x) => x.r)) + size / 2 + 22;
  groups.forEach((grp, gi) => {
    let gx = cx;
    let gy = cy;
    if (k > 1) {
      const ang = -Math.PI / 2 + (gi / k) * Math.PI * 2;
      gx = cx + Math.cos(ang) * Math.max(0, g.w / 2 - ring - 20);
      gy = cy + 10 + Math.sin(ang) * Math.max(0, g.h / 2 - ring - 30);
    }
    const m = grp.members.length;
    const r = grp.r;
    grp.cx = gx;
    grp.cy = gy;
    grp.members.forEach((f, i) => {
      const a = -Math.PI / 2 + (i / Math.max(1, m)) * Math.PI * 2;
      out.set(f.id, { f, x: gx + Math.cos(a) * r, y: gy + Math.sin(a) * r, r: size / 2, group: grp });
    });
  });
  return out;
}

function _relPortrait(f, size) {
  const now = _relNow();
  if (now - _relPortraitAt > 10) {
    _relPortraits = {};
    _relPortraitAt = now;
  }
  const key = `${f.id}:${size}`;
  if (_relPortraits[key] === undefined) _relPortraits[key] = typeof drawFluffyPortraitCanvas === "function" ? drawFluffyPortraitCanvas(f, size) : null;
  return _relPortraits[key];
}

// Which fluffy is under the mouse (id or null)
function _relHover(L) {
  const G = L.graph;
  if (!isPointInRect(mouse.x, mouse.y, G.x, G.y, G.w, G.h)) return null; // (zoomed in, some are off the map)
  for (const [id, n] of L.nodes) if (Math.hypot(mouse.x - n.x, mouse.y - n.y) <= n.r + 3) return id;
  return null;
}

// ---- Drawing ----

function _relArrow(c, x1, y1, x2, y2, r2, colour, width, opts = {}) {
  const d = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / d;
  const uy = (y2 - y1) / d;
  // a gentle curve, so two lines between the same pair don't overlap
  const bend = opts.bend || 0;
  const mx = (x1 + x2) / 2 - uy * bend;
  const my = (y1 + y2) / 2 + ux * bend;
  const ex = x2 - ux * (r2 + 3);
  const ey = y2 - uy * (r2 + 3);
  c.strokeStyle = colour;
  c.lineWidth = width;
  c.setLineDash(opts.dash || []);
  c.beginPath();
  c.moveTo(x1 + ux * (opts.r1 || 0), y1 + uy * (opts.r1 || 0));
  c.quadraticCurveTo(mx, my, ex, ey);
  c.stroke();
  c.setLineDash([]);
  if (opts.arrow) {
    const tx = ex - mx;
    const ty = ey - my;
    const td = Math.hypot(tx, ty) || 1;
    const ax = tx / td;
    const ay = ty / td;
    const s = 7 + width;
    c.fillStyle = colour;
    c.beginPath();
    c.moveTo(ex, ey);
    c.lineTo(ex - ax * s - ay * s * 0.6, ey - ay * s + ax * s * 0.6);
    c.lineTo(ex - ax * s + ay * s * 0.6, ey - ay * s - ax * s * 0.6);
    c.closePath();
    c.fill();
  }
}

const _REL_BEND = { love: 0, family: 14, grudge: -14, fear: 26, gossip: -26, you: 0 };

function drawRelationshipMap(c) {
  if (!relMapOpen) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const L = getRelMapLayout();
  const data = relMapData();
  c.save();
  drawScreenPanel(c, L, { theme: "pink", dim: 0.55 });
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.fillStyle = "#ffd6f0";
  c.font = "bold 24px Arial";
  c.fillText("Who's who", L.x + 24, L.y + 40);
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.7)";
  {
    // (cut short to fit before the Yours | Wild buttons)
    let hint = relMapScope.wild ? `Wild fluffies: ${_relPlaceName(relMapScope.scene)}` : "Hover a fluffy to light up its lines; click one for the details.";
    const room = L.scope[0].x - 12 - (L.x + 170);
    if (c.measureText(hint).width > room && !relMapScope.wild) hint = "Click a fluffy for the details.";
    if (c.measureText(hint).width <= room) c.fillText(hint, L.x + 170, L.y + 40);
  }
  // Yours | Wild
  for (const b of L.scope) {
    const on = (b.id === "wild") === !!relMapScope.wild;
    const over = isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h);
    fillRoundRect(c, b.x, b.y, b.w, b.h, 12, on ? "rgba(255, 170, 220, 0.4)" : over ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)");
    c.fillStyle = on ? "white" : "rgba(255,255,255,0.7)";
    c.font = on ? "bold 14px Arial" : "14px Arial";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(b.id === "wild" ? "Wild fluffies" : "Your fluffies", b.x + b.w / 2, b.y + b.h / 2 + 1);
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
  }

  if (relMapAll) {
    _drawRelAllTies(c, L);
    drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 16, borderRadius: 10 });
    c.restore();
    return;
  }

  // Filter chips
  for (const ch of L.chips) {
    const k = REL_KINDS.find((x) => x.id === ch.id);
    const on = relMapFilters[ch.id];
    fillRoundRect(c, ch.x, ch.y, ch.w, ch.h, 12, on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)");
    c.fillStyle = on ? k.colour : "rgba(255,255,255,0.25)";
    c.beginPath();
    c.arc(ch.x + 14, ch.y + ch.h / 2, 5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = on ? "white" : "rgba(255,255,255,0.45)";
    c.font = "bold 13px Arial";
    c.textBaseline = "middle";
    c.fillText(k.label, ch.x + 26, ch.y + ch.h / 2 + 1);
  }
  c.textBaseline = "alphabetic";

  // The graph
  const G = L.graph;
  fillRoundRect(c, G.x, G.y, G.w, G.h, 14, "rgba(0,0,0,0.18)");
  if (data.people.length < 2) {
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.font = "16px Arial";
    c.textAlign = "center";
    if (relMapScope.wild) {
      c.fillText(`Hardly any wild fluffies in ${_relPlaceName(relMapScope.scene)} right now.`, G.x + G.w / 2, G.y + G.h / 2 - 10);
      c.fillText("Try the park, or look again later.", G.x + G.w / 2, G.y + G.h / 2 + 14);
    } else {
      c.fillText("When you have a few fluffies, their friendships, grudges and", G.x + G.w / 2, G.y + G.h / 2 - 10);
      c.fillText("families will show here.", G.x + G.w / 2, G.y + G.h / 2 + 14);
    }
    c.textAlign = "left";
  }
  const hover = _relHover(L);
  const focus = hover !== null ? hover : relMapSel;
  c.save();
  c.beginPath();
  c.rect(G.x, G.y, G.w, G.h);
  c.clip();
  // Group rings and names
  const z = L.view.z;
  for (const grp of data.groups) {
    if (grp.cx === undefined) continue;
    const gp = L.view.at(grp.cx, grp.cy);
    c.strokeStyle = grp.colour;
    c.globalAlpha = 0.35;
    c.lineWidth = 2;
    c.setLineDash([4, 6]);
    c.beginPath();
    c.arc(gp.x, gp.y, (grp.r + 34) * z, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 0.9;
    c.fillStyle = grp.colour;
    c.font = `bold ${Math.round(13 * Math.min(1.6, z))}px Arial`;
    c.textAlign = "center";
    c.fillText(grp.label, gp.x, gp.y - (grp.r + 40) * z);
    c.globalAlpha = 1;
  }
  // Lines (fear of an alicorn only for the one you're looking at: with
  // alicorn intolerance on, nearly everyone would have one)
  const hearts = [];
  for (const e of data.edges) {
    if (!relMapFilters[e.kind]) continue;
    const na = L.nodes.get(e.a.id);
    const nb = e.b ? L.nodes.get(e.b.id) : L.you;
    if (!na || !nb) continue;
    const lit = focus === null || e.a.id === focus || (e.b && e.b.id === focus);
    if (e.alicorn && (focus === null || !lit)) continue;
    c.globalAlpha = lit ? 0.95 : 0.12;
    const k = REL_KINDS.find((x) => x.id === e.kind);
    let colour = k.colour;
    if (e.kind === "you") colour = e.bad ? "#b98cff" : "#6fdc8c";
    const w = e.kind === "family" ? 1.5 : 1.5 + Math.min(1, Math.abs(e.strength)) * 2.5;
    _relArrow(c, na.x, na.y, nb.x, nb.y, nb.r, colour, w, {
      r1: na.r,
      bend: _REL_BEND[e.kind],
      arrow: !e.mutual || e.kind === "gossip" || e.kind === "fear",
      dash: e.kind === "gossip" ? [3, 5] : e.kind === "grudge" && !e.mutual ? [8, 5] : e.kind === "you" ? [2, 4] : [],
    });
    if (e.kind === "love" && e.note === "special friends") hearts.push({ x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2, a: c.globalAlpha });
  }
  for (const h of hearts) {
    c.globalAlpha = h.a;
    c.fillStyle = "#ff7eb6";
    c.strokeStyle = "rgba(20,10,25,0.9)";
    c.lineWidth = 3;
    c.font = "bold 18px Arial";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.strokeText("\u2665", h.x, h.y);
    c.fillText("\u2665", h.x, h.y);
    c.textBaseline = "alphabetic";
  }
  c.globalAlpha = 1;
  // You
  if (L.you) {
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.beginPath();
    c.arc(L.you.x, L.you.y, L.you.r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#402040";
    c.font = "bold 14px Arial";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("You", L.you.x, L.you.y + 1);
    c.textBaseline = "alphabetic";
  }
  // Fluffies (the focused one's neighbours worked out once)
  const near = new Set();
  if (focus !== null)
    for (const e of data.edges) {
      if (!relMapFilters[e.kind] || !e.b) continue;
      if (e.a.id === focus) near.add(e.b.id);
      else if (e.b.id === focus) near.add(e.a.id);
    }
  for (const [id, n] of L.nodes) {
    const on = focus === null || id === focus || near.has(id);
    c.globalAlpha = on ? 1 : 0.35;
    const sel = id === relMapSel;
    c.fillStyle = "rgba(255,255,255,0.12)";
    c.beginPath();
    c.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    c.fill();
    const p = _relPortrait(n.f, Math.round((n.r * 2.2) / 8) * 8); // (sizes in steps, so zooming doesn't redraw every frame)
    if (p) {
      c.save();
      c.beginPath();
      c.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      c.clip();
      c.drawImage(p, n.x - n.r * 1.1, n.y - n.r * 1.15, n.r * 2.2, (p.height * n.r * 2.2) / (p.width || 1));
      c.restore();
    }
    c.strokeStyle = sel ? "#ffd24d" : n.group.colour;
    c.lineWidth = sel ? 3.5 : 2;
    c.beginPath();
    c.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    c.stroke();
    const fz = Math.min(1.6, z);
    c.font = `bold ${Math.round(11 * fz)}px Arial`;
    c.textAlign = "center";
    c.lineWidth = 3;
    c.strokeStyle = "rgba(20,10,25,0.9)";
    const name = _relName(n.f);
    c.strokeText(name, n.x, n.y + n.r + 13 * fz);
    c.fillStyle = "white";
    c.fillText(name, n.x, n.y + n.r + 13 * fz);
    let below = 25;
    if (typeof titleOf === "function" && titleOf(n.f)) {
      c.font = `${Math.round(10 * fz)}px Arial`;
      c.fillStyle = "#f7d774";
      c.fillText(titleOf(n.f), n.x, n.y + n.r + below * fz);
      below += 12;
    }
    // Its herd job (HerdJobs.js)
    const job = typeof herdJobLabel === "function" ? herdJobLabel(n.f) : null;
    if (job) {
      c.font = `${Math.round(10 * fz)}px Arial`;
      c.fillStyle = job === "Toughie" ? "#ff9a8a" : "#9be89b";
      c.fillText(job, n.x, n.y + n.r + below * fz);
    }
  }
  c.globalAlpha = 1;
  c.restore();
  // Zoom buttons, and how to move about
  if (data.people.length >= 2) {
    for (const b of L.zoomBtns) drawGlassButton(b.x, b.y, b.w, b.h, b.label, { fontSize: b.id === "fit" ? 12 : 18, borderRadius: 8 });
    c.font = "12px Arial";
    c.textAlign = "left";
    c.fillStyle = "rgba(255,255,255,0.45)";
    c.fillText(z > 1 ? `Zoom x${z.toFixed(1)} \u00b7 drag to move about` : "Scroll to zoom in", G.x + 10, G.y + G.h - 10);
  }

  _drawRelPane(c, L, data, focus);
  if (L.showMe) drawGlassButton(L.showMe.x, L.showMe.y, L.showMe.w, L.showMe.h, "Show me", { fontSize: 15, borderRadius: 9 });
  if (L.allTies) drawGlassButton(L.allTies.x, L.allTies.y, L.allTies.w, L.allTies.h, "All its ties", { fontSize: 15, borderRadius: 9 });
  drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 16, borderRadius: 10 });
  c.restore();
}

// What one fluffy feels, in words: [{ head, lines: [..] }]
function relMapDetails(f, data = relMapData()) {
  const mine = (kind) => data.edges.filter((e) => e.kind === kind && (e.a === f || e.b === f));
  const other = (e) => (e.a === f ? e.b : e.a);
  const out = [];
  const love = mine("love").map((e) => `${_relName(other(e))}${e.note === "special friends" ? " ♥" : !e.mutual ? (e.a === f ? " (not both ways)" : " (likes it)") : ""}`);
  if (love.length) out.push({ head: "Loves", colour: "#6fdc8c", lines: love });
  const fam = mine("family").map((e) => (e.a === f ? `${_relName(e.b)} (${f.gender === "male" ? "his" : "her"} foal)` : `${_relName(e.a)} (${e.note})`));
  if (fam.length) out.push({ head: "Family", colour: "#c8c8d0", lines: fam });
  const hate = mine("grudge").map((e) => `${_relName(other(e))}${e.note === "fights" ? " (fights)" : !e.mutual ? (e.a === f ? "" : " (it has a grudge)") : ""}`);
  if (hate.length) out.push({ head: "Grudges", colour: "#ff6b6b", lines: hate });
  const fear = mine("fear").map((e) => (e.a === f ? `Scared of ${_relName(e.b)} (${e.note})` : `${_relName(e.a)} is scared of it`));
  if (fear.length) out.push({ head: "Fear", colour: "#b98cff", lines: fear });
  const heard = mine("gossip").map((e) => (e.b === f ? `${_relName(e.a)} ${e.note}` : `Told ${_relName(e.b)} about you`));
  if (heard.length) out.push({ head: "Gossip", colour: "#ffd24d", lines: heard });
  const you = mine("you")[0];
  if (you) out.push({ head: "You", colour: you.bad ? "#b98cff" : "#6fdc8c", lines: [you.bad ? "Afraid of you" : "Trusts you"] });
  return out;
}

function _drawRelPane(c, L, data, focus) {
  const P = L.pane;
  fillRoundRect(c, P.x, P.y, P.w, P.h, 12, "rgba(0,0,0,0.22)");
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  let y = P.y + 30;
  const f = focus !== null ? data.people.find((x) => x.id === focus) : null;
  if (!f) {
    // Totals and a key
    const count = (k) => data.edges.filter((e) => e.kind === k).length;
    c.fillStyle = "#ffd6f0";
    c.font = "bold 17px Arial";
    c.fillText(`${data.people.length} fluffies`, P.x + 14, y);
    y += 28;
    const rows = [
      ["love", `${count("love")} friendships`],
      ["family", `${count("family")} mum/dad and foal`],
      ["grudge", `${count("grudge")} grudges`],
      ["fear", `${data.edges.filter((e) => e.kind === "fear" && !e.alicorn).length} scared of another`],
      ["gossip", `${count("gossip")} passed on gossip`],
    ];
    for (const [k, text] of rows) {
      const kind = REL_KINDS.find((x) => x.id === k);
      c.fillStyle = kind.colour;
      c.fillRect(P.x + 14, y - 9, 22, 4);
      c.fillStyle = "rgba(255,255,255,0.88)";
      c.font = "14px Arial";
      c.fillText(text, P.x + 46, y - 3);
      y += 24;
    }
    y += 10;
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.font = "13px Arial";
    const scaredOfAlicorns = data.edges.filter((e) => e.alicorn).length;
    if (scaredOfAlicorns) {
      c.fillStyle = "rgba(255,255,255,0.7)";
      c.font = "13px Arial";
      c.fillText(`(and ${scaredOfAlicorns} scared of an alicorn: hover it)`, P.x + 46, y - 6);
      y += 16;
    }
    for (const line of ["An arrow: only one way.", "Dashed red: a one-sided grudge.", "Dotted gold: gossip about you,", "from the teller to the listener.", "Rings: herds and families."]) {
      c.fillText(line, P.x + 14, y);
      y += 19;
    }
    return;
  }
  // One fluffy
  const p = _relPortrait(f, 64);
  if (p) c.drawImage(p, P.x + 10, y - 22);
  c.fillStyle = "#ffd6f0";
  c.font = "bold 16px Arial";
  const nm = _relFullName(f);
  c.fillText(nm.length > 22 ? _relName(f) : nm, P.x + 80, y);
  c.font = "13px Arial";
  c.fillStyle = "rgba(255,255,255,0.75)";
  const bits = [];
  const h = typeof herdOf === "function" ? herdOf(f) : null;
  if (h && typeof getHerdName === "function") bits.push(getHerdName(h));
  const role = typeof familyRoleOf === "function" ? familyRoleOf(f) : null;
  if (role) bits.push(role);
  if (typeof titleOf === "function" && titleOf(f)) bits.push(titleOf(f));
  const wrap = (text, max) => (typeof wrapText === "function" ? wrapText(c, text, max) : [text]);
  let yy = y + 18;
  for (const line of wrap(bits.join(" · ") || "No herd", P.w - 94)) {
    c.fillText(line, P.x + 80, yy);
    yy += 16;
  }
  y = Math.max(y + 52, yy + 8);
  const details = relMapDetails(f, data);
  if (!details.length) {
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillText("No strong feelings about anyone yet.", P.x + 14, y);
  }
  const bottom = P.y + P.h - 56;
  for (const d of details) {
    if (y > bottom) break;
    c.fillStyle = d.colour;
    c.font = "bold 14px Arial";
    c.fillText(d.head, P.x + 14, y);
    y += 18;
    c.font = "13px Arial";
    c.fillStyle = "rgba(255,255,255,0.88)";
    const lines = d.lines.slice(0, 5);
    if (d.lines.length > 5) lines.push(`...and ${d.lines.length - 5} more`);
    for (const line of lines) {
      for (const w of wrap(line, P.w - 34)) {
        if (y > bottom) break;
        c.fillText(w, P.x + 22, y);
        y += 16;
      }
    }
    y += 8;
  }
}

// ---- All its ties: everyone it has a bond, a grudge or family with, here or
// not (the herd it came from, fluffies sold or gone, ones that died) ----

const REL_TIE_WORDS = {
  mother: "Mum",
  father: "Dad",
  baby_child: "Foal",
  child: "Foal",
  estranged_child: "Foal (turned away)",
  dead_baby_child: "Foal (died)",
  dead_mother: "Mum (died)",
  sister: "Sister",
  brother: "Brother",
  special_friend: "Special friend \u2665",
  friend: "Friend",
};

function _relFeelingWords(v) {
  if (v >= 0.6) return "adores";
  if (v >= 0.3) return "likes";
  if (v >= 0.1) return "friendly";
  if (v <= -0.6) return "hates";
  if (v <= -0.3) return "dislikes";
  if (v <= -0.1) return "wary of";
  return null;
}

// { herd, pastHerds: [text], met, here: [rows], away: [rows] }; a row is
// { id, name, text, where, strength }
function allTiesOf(f) {
  const rel = (typeof relationships !== "undefined" && relationships[f.id]) || {};
  const ops = f.opinions || {};
  const why = f.opinionWhy || {};
  const ids = new Set();
  for (const id of Object.keys(rel)) ids.add(String(id));
  for (const [id, v] of Object.entries(ops)) if (Math.abs(v) >= 0.1) ids.add(String(id));
  if (f.motherId !== null && f.motherId !== undefined) ids.add(String(f.motherId));
  if (f.fatherId !== null && f.fatherId !== undefined) ids.add(String(f.fatherId));
  for (const o of fluffies) if (o !== f && (o.motherId === f.id || o.fatherId === f.id)) ids.add(String(o.id));
  ids.delete(String(f.id));
  const here = [];
  const away = [];
  for (const id of ids) {
    const o = fluffies.find((x) => String(x.id) === id) || null;
    const rec = typeof getFamilyRecord === "function" ? getFamilyRecord(id) : null;
    if (!o && !rec && !(typeof fluffyNames !== "undefined" && fluffyNames[id])) continue; // (nothing known about it)
    const bits = [];
    let tie = REL_TIE_WORDS[rel[id]] || null;
    if (!tie && String(f.motherId) === id) tie = "Mum";
    if (!tie && String(f.fatherId) === id) tie = "Dad";
    if (!tie && o && (o.motherId === f.id || o.fatherId === f.id)) tie = "Foal";
    if (tie) bits.push(tie);
    const v = typeof ops[id] === "number" ? ops[id] : 0;
    const feel = _relFeelingWords(v);
    if (feel) bits.push(why[id] ? `${feel} (${why[id]})` : feel);
    if (o && typeof sameHerd === "function" && sameHerd(f, o)) bits.push("same herd");
    if (!bits.length) continue;
    let where = null;
    if (o && o.isAlive) {
      if (!o.adopted) where = `wild, ${typeof householdRoomName === "function" ? householdRoomName(o.scene) : o.scene}`;
      else if (o.scene !== f.scene) where = typeof householdRoomName === "function" ? householdRoomName(o.scene) : o.scene;
    } else if (o && !o.isAlive) where = "died";
    else if (rec) where = (typeof FAMILY_STATUS_TEXT !== "undefined" && FAMILY_STATUS_TEXT[rec.status]) || rec.status || "gone";
    else where = "not seen since";
    const row = {
      id,
      name: typeof fluffyDisplayNameById === "function" ? fluffyDisplayNameById(id) : id,
      text: bits.join(" \u00b7 "),
      where,
      strength: (tie ? 1 : 0) + Math.abs(v),
    };
    (o && o.isAlive && o.adopted ? here : away).push(row);
  }
  here.sort((a, b) => b.strength - a.strength);
  away.sort((a, b) => b.strength - a.strength);
  const h = typeof herdOf === "function" ? herdOf(f) : null;
  const pastHerds = (Array.isArray(f.pastHerds) ? f.pastHerds : [])
    .slice()
    .reverse()
    .map((p) => `The ${p.name}${p.wild ? " (wild)" : ""}, until day ${p.day}`);
  const met = typeof metOf === "function" ? Object.keys(metOf(f) || {}).length : 0;
  return { herd: h && typeof getHerdName === "function" ? `The ${getHerdName(h)}` : null, pastHerds, met, here, away };
}

// The lines of the list, in order: { text, colour, bold, indent }
function _relTieLines(f) {
  const T = allTiesOf(f);
  const out = [];
  const head = (text, colour) => out.push({ text, colour, bold: true });
  const line = (text, colour = "rgba(255,255,255,0.9)", indent = 1) => out.push({ text, colour, indent });
  head("Herds", "#ffd6f0");
  line(T.herd ? `Now: ${T.herd}` : "Now: no herd");
  for (const p of T.pastHerds) line(`Before: ${p}`, "rgba(255,255,255,0.7)");
  if (T.met) line(`Has met ${T.met} other fluffies`, "rgba(255,255,255,0.6)");
  head(`Here with it (${T.here.length})`, "#6fdc8c");
  if (!T.here.length) line("Nobody yet", "rgba(255,255,255,0.6)");
  for (const r of T.here) line(`${r.name}: ${r.text}${r.where ? `  [${r.where}]` : ""}`);
  head(`Elsewhere, or gone (${T.away.length})`, "#c8c8d0");
  if (!T.away.length) line("Nobody", "rgba(255,255,255,0.6)");
  for (const r of T.away) line(`${r.name}: ${r.text}  [${r.where}]`, "rgba(255,255,255,0.8)");
  return out;
}

function _drawRelAllTies(c, L) {
  const f = fluffies.find((x) => x.id === relMapAll.id);
  if (!f) {
    relMapAll = null;
    return;
  }
  const A = L.list;
  fillRoundRect(c, A.x, A.y, A.w, A.h, 12, "rgba(0,0,0,0.22)");
  const p = _relPortrait(f, 64);
  if (p) c.drawImage(p, A.x + 10, A.y + 6);
  c.textAlign = "left";
  c.fillStyle = "#ffd6f0";
  c.font = "bold 18px Arial";
  c.fillText(`${_relFullName(f)}: all its ties`, A.x + 84, A.y + 32);
  c.font = "13px Arial";
  c.fillStyle = "rgba(255,255,255,0.65)";
  c.fillText("Family, friends and grudges - here, in the wild, sold or gone - and the herds it has belonged to.", A.x + 84, A.y + 52);
  // Two columns of lines, paged
  const lines = _relTieLines(f);
  const rowH = 19;
  const top = A.y + 84;
  const perCol = Math.max(4, Math.floor((A.h - 96) / rowH));
  const cols = A.w >= 760 ? 2 : 1;
  const perPage = perCol * cols;
  const pages = Math.max(1, Math.ceil(lines.length / perPage));
  relMapAll.page = Math.max(0, Math.min(pages - 1, relMapAll.page));
  const shown = lines.slice(relMapAll.page * perPage, (relMapAll.page + 1) * perPage);
  const colW = (A.w - 40) / cols;
  shown.forEach((ln, i) => {
    const col = Math.floor(i / perCol);
    const x = A.x + 20 + col * colW + (ln.indent ? 14 : 0);
    const y = top + (i % perCol) * rowH;
    c.font = ln.bold ? "bold 15px Arial" : "14px Arial";
    c.fillStyle = ln.colour || "white";
    let t = ln.text;
    while (t.length > 4 && c.measureText(t).width > colW - 24) t = t.slice(0, -2);
    if (t !== ln.text) t += "\u2026";
    c.fillText(t, x, y);
  });
  drawGlassButton(L.back.x, L.back.y, L.back.w, L.back.h, "\u25c0 Map", { fontSize: 15, borderRadius: 10 });
  if (pages > 1) {
    drawGlassButton(L.prev.x, L.prev.y, L.prev.w, L.prev.h, "Previous", { fontSize: 14, borderRadius: 10 });
    drawGlassButton(L.next.x, L.next.y, L.next.w, L.next.h, "Next", { fontSize: 14, borderRadius: 10 });
    c.fillStyle = "rgba(255,255,255,0.75)";
    c.font = "13px Arial";
    c.textAlign = "left";
    c.fillText(`Page ${relMapAll.page + 1} of ${pages}`, L.next.x + L.next.w + 12, L.next.y + 23);
  }
}

// ---- Clicks ----

function handleRelationshipMapClick() {
  if (!relMapOpen) return false;
  const L = getRelMapLayout();
  const hit = (r) => r && isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h);
  if (hit(L.close) || !hit(L)) {
    closeRelationshipMap();
    return true;
  }
  for (const b of L.scope) {
    if (hit(b)) {
      if ((b.id === "wild") !== !!relMapScope.wild) setRelMapScope(b.id === "wild");
      return true;
    }
  }
  for (const ch of L.chips) {
    if (hit(ch)) {
      relMapFilters[ch.id] = !relMapFilters[ch.id];
      _relCache = null;
      return true;
    }
  }
  for (const b of L.zoomBtns) {
    if (hit(b)) {
      if (b.id === "fit") relMapFit();
      else relMapZoom(b.id === "in" ? REL_ZOOM_STEP : 1 / REL_ZOOM_STEP);
      return true;
    }
  }
  if (relMapAll) {
    if (hit(L.back)) relMapAll = null;
    else if (hit(L.prev)) relMapAll.page = Math.max(0, relMapAll.page - 1);
    else if (hit(L.next)) relMapAll.page++;
    return true;
  }
  if (hit(L.allTies)) {
    relMapAll = { id: relMapSel, page: 0 };
    return true;
  }
  if (hit(L.showMe)) {
    const f = relMapPeople().find((x) => x.id === relMapSel);
    closeRelationshipMap();
    if (f && typeof goToFluffy === "function") goToFluffy(f);
    return true;
  }
  const id = _relHover(L);
  if (id !== null) relMapSel = relMapSel === id ? null : id;
  else if (hit(L.graph)) {
    relMapSel = null;
    // ...and a drag from here moves the map about
    if (relMapView.zoom > 1) _relPan = { sx: mouse.x, sy: mouse.y, x: relMapView.x, y: relMapView.y };
  }
  return true;
}

registerScreen({
  name: "relationshipMap",
  layer: 25,
  isOpen: () => relMapOpen,
  close: () => closeRelationshipMap(),
  draw: (c) => drawRelationshipMap(c),
  click: () => handleRelationshipMapClick(),
});
