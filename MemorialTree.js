// ---------------------------------------------------------------------------
// The memorial tree (Fluff Mart, Home & Play, $200): a tree with a little
// brass plaque, for the fluffies you've lost.
//
// The plaque (memorialPlaque, saved with the game) lists every one of your
// fluffies that dies - its name, the day, and what took it - whether or not
// you have a tree yet: plant one and they're all on it. Long-press (right-
// click) the tree to read it. There's one plaque however many trees you
// plant; it holds the last MEMORIAL_KEEP names.
//
// Mourning: when one of yours dies, those close to it - its mum and dad,
// its foals, its brothers and sisters, its special friend, and good
// friends (Bonds.js opinion MOURN_FRIEND) - mourn it (f.mourning, saved) for
// MOURN_DAYS: a little less happy (MOURN_UNHAPPY a game hour), and they
// talk about missing it. With a memorial tree in their room a mourner goes
// to it now and then (MOURN_VISIT_CHANCE a game hour) and sits by the
// plaque a while: each visit cheers it (MOURN_VISIT_JOY) and takes a good
// part of its mourning away (MOURN_VISIT_EASE). You can carry one there too.
// The first visit goes in its story.
// The tree is drawn here (drawMemorialTree).
// ---------------------------------------------------------------------------

const MEMORIAL_PRICE = 200;
const MEMORIAL_KEEP = 300;
const MOURN_DAYS = 2;
const MOURN_UNHAPPY = 0.015; // a game hour
const MOURN_FRIEND = 0.5;
const MOURN_VISIT_CHANCE = 0.3; // a game hour
const MOURN_VISIT_NEAR = 110; // px: at the plaque
const MOURN_VISIT_STAY = 15; // game seconds
const MOURN_VISIT_JOY = 0.08;
const MOURN_VISIT_EASE = 0.35; // of what's left
let memorialPlaque = []; // [{ id, name, day, cause, foal }]
const memorialTicker = new Ticker(3);

function _mmNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}
function _mmName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
}

class MemorialTree {
  constructor(scene = "BACKYARD") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }
  update() {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = Math.max(mouse.y + this.dragOffset.y, sceneTop(this.scene) + 10);
    }
  }
  onDrop() {
    return handleDropping(this);
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  getBottomY() {
    return this.y;
  }
  hitTest(px, py) {
    return px >= this.x - 60 && px <= this.x + 60 && py >= this.y - 190 && py <= this.y + 6;
  }
  serialize() {
    return { classType: "MemorialTree", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: null };
  }
  deserialize() {}
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    drawMemorialTree(ctx, this.x, this.y, 1, memorialPlaque.length);
  }
}

// A leafy tree with a brass plaque on its trunk; (x, y) is the foot of the trunk
function drawMemorialTree(c, x, y, k = 1, names = 0) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.lineJoin = "round";
  // Shadow
  c.fillStyle = "rgba(0,0,0,0.18)";
  c.beginPath();
  c.ellipse(0, 0, 58, 12, 0, 0, Math.PI * 2);
  c.fill();
  // Trunk
  c.fillStyle = "#7a5233";
  c.strokeStyle = "#3f2a18";
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(-16, 0);
  c.quadraticCurveTo(-12, -60, -14, -105);
  c.lineTo(14, -105);
  c.quadraticCurveTo(12, -60, 18, 0);
  c.closePath();
  c.fill();
  c.stroke();
  // Leaves: soft round clumps
  const clumps = [
    [0, -150, 52],
    [-42, -125, 36],
    [42, -125, 36],
    [-26, -175, 32],
    [26, -175, 32],
  ];
  for (const [cx, cy, r] of clumps) {
    c.fillStyle = "#6fae5a";
    c.strokeStyle = "#3d6b2f";
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  c.fillStyle = "rgba(255,255,255,0.18)";
  c.beginPath();
  c.arc(-14, -165, 18, 0, Math.PI * 2);
  c.fill();
  // A few pink blossoms
  c.fillStyle = "#f6b8d2";
  for (const [bx, by] of [[-30, -140], [18, -160], [40, -118], [-8, -128], [10, -185]]) {
    c.beginPath();
    c.arc(bx, by, 4, 0, Math.PI * 2);
    c.fill();
  }
  // The plaque
  c.fillStyle = "#c9a24a";
  c.strokeStyle = "#6b5220";
  c.lineWidth = 1.5;
  if (c.roundRect) {
    c.beginPath();
    c.roundRect(-13, -62, 26, 18, 3);
    c.fill();
    c.stroke();
  } else {
    c.fillRect(-13, -62, 26, 18);
    c.strokeRect(-13, -62, 26, 18);
  }
  c.strokeStyle = "rgba(90, 65, 20, 0.7)";
  c.lineWidth = 1;
  for (let i = 0; i < Math.min(3, Math.max(1, names)); i++) {
    c.beginPath();
    c.moveTo(-8, -57 + i * 4);
    c.lineTo(8, -57 + i * 4);
    c.stroke();
  }
  c.restore();
}

function memorialTrees() {
  return typeof objects !== "undefined" ? objects.filter((o) => o instanceof MemorialTree) : [];
}

// ---- When one of yours dies (HorseAnatomy.die) ----
function rememberOnPlaque(f) {
  if (!f || !f.adopted) return false;
  if (memorialPlaque.some((e) => e.id === f.id)) return false;
  const day = typeof getDayNumber === "function" ? getDayNumber() : 1;
  const named = typeof fluffyNames !== "undefined" && fluffyNames[f.id];
  memorialPlaque.push({ id: f.id, name: named ? _mmName(f) : f.growth < 0.36 ? "A little foal" : _mmName(f), day, cause: f.causeOfDeath || "", foal: f.growth < 1 });
  if (memorialPlaque.length > MEMORIAL_KEEP) memorialPlaque.splice(0, memorialPlaque.length - MEMORIAL_KEEP);
  startMourning(f);
  return true;
}

// Those close to it mourn
function mournersOf(dead) {
  const rels = (typeof relationships !== "undefined" && relationships) || {};
  const close = ["mother", "father", "baby_child", "child", "sister", "brother", "special_friend"];
  return fluffies.filter((o) => {
    if (o === dead || !o.isAlive || !o.adopted) return false;
    const r = rels[o.id] && rels[o.id][dead.id];
    if (close.includes(r)) return true;
    return typeof getOpinion === "function" && getOpinion(o, dead) >= MOURN_FRIEND;
  });
}

function startMourning(dead) {
  if (typeof fluffies === "undefined") return 0;
  const now = _mmNow();
  let n = 0;
  for (const o of mournersOf(dead)) {
    o.mourning = { id: dead.id, name: _mmName(dead), until: now + MOURN_DAYS * DAY_LENGTH, visited: false };
    n++;
  }
  return n;
}

function isMourning(f) {
  return !!(f && f.isAlive && f.mourning && f.mourning.until > _mmNow());
}

function _mmSay(f, key) {
  if (!f.mourning || f.tooYoungToSpeak() || typeof getDialogue !== "function") return;
  const line = getDialogue(["MEMORIAL", key], f);
  if (line) f.speak(line.replace(/<Name>/g, f.mourning.name));
}

// A visit to the tree: comfort, and less grief left
function memorialVisit(f) {
  if (!isMourning(f)) return false;
  const now = _mmNow();
  f.changeHappiness(MOURN_VISIT_JOY);
  f.mourning.until = now + (f.mourning.until - now) * (1 - MOURN_VISIT_EASE);
  if (!f.mourning.visited) {
    f.mourning.visited = true;
    if (typeof recordStory === "function") recordStory("turning", f, { x: `${_mmName(f)} sat by ${f.mourning.name}'s name on the memorial tree.` });
  }
  _mmSay(f, "VISIT");
  return true;
}

// Magnifying glass: [text, tone] or null
function describeMourning(f) {
  if (!isMourning(f)) return null;
  const hrs = Math.max(1, Math.round((f.mourning.until - _mmNow()) / HOUR_LENGTH));
  return [`Missing ${f.mourning.name} (${hrs}h)${memorialTrees().length ? "" : " - a memorial tree would help"}`, "bad"];
}

function updateMemorial(dt) {
  if (typeof fluffies === "undefined") return;
  const now = _mmNow();
  // On the way to the tree, or sitting by it
  for (const f of fluffies) {
    const v = f._memVisit;
    if (!v) continue;
    const tree = memorialTrees().find((t) => t.id === v.id);
    if (!tree || !f.isAlive || tree.scene !== f.scene || f.isDragging || f.currentCage || f.placedOn || f.currentStateKey === "SLEEPING" || now - v.at > 80) {
      f._memVisit = null;
      continue;
    }
    const tx = tree.x + (f.x < tree.x ? -55 : 55);
    const ty = tree.y + 20;
    if (!v.arrived) {
      if (Math.hypot(f.x - tx, f.y - ty) > 35) {
        if (!f.isMovingOrRunning()) f.initBehavior("MOVING");
        f.setTargetPosition(tx, ty);
        continue;
      }
      v.arrived = now;
      f.initBehavior("IDLE");
      f.facingRight = tree.x > f.x;
      memorialVisit(f);
    }
    if (now - v.arrived > MOURN_VISIT_STAY) f._memVisit = null;
  }
  const step = memorialTicker.step(dt);
  if (!step) return;
  const hourly = (x) => 1 - Math.pow(1 - x, step / HOUR_LENGTH);
  const trees = memorialTrees();
  for (const f of fluffies) {
    if (!f.mourning) continue;
    if (!isMourning(f) || !f.isAlive) {
      if (f.isAlive) f.mourning = null;
      continue;
    }
    // Missing it
    if (f.happiness > WAN_DIE_THRESHOLD + 0.1) f.changeHappiness((-MOURN_UNHAPPY * step) / HOUR_LENGTH);
    if (f.currentStateKey !== "SLEEPING" && Math.random() < 0.002 * step && (!f.speech || !f.speech.text)) _mmSay(f, "MISSING");
    // Carried (or walked) to the tree: a visit
    const at = trees.find((t) => t.scene === f.scene && Math.hypot(t.x - f.x, t.y - f.y) < MOURN_VISIT_NEAR);
    if (at && !f._memVisit && !f.isDragging && (typeof f._memLastVisit !== "number" || now - f._memLastVisit > 2 * HOUR_LENGTH)) {
      f._memLastVisit = now;
      memorialVisit(f);
      continue;
    }
    // Goes by itself now and then
    if (f._memVisit || f.currentStateKey === "SLEEPING" || f.isDragging || f.currentCage || f.placedOn || f.growth < 0.36) continue;
    const tree = trees.find((t) => t.scene === f.scene && !t.isDragging);
    if (!tree || (typeof f._memLastVisit === "number" && now - f._memLastVisit < 2 * HOUR_LENGTH)) continue;
    if (Math.random() < hourly(MOURN_VISIT_CHANCE)) {
      f._memVisit = { id: tree.id, at: now };
      f._memLastVisit = now;
    }
  }
}
registerSystem("memorial", updateMemorial, 136);

// ---- Reading the plaque (long-press / right-click the tree) ----
let memorialOpen = false;
let memorialPage = 0;
const MEMORIAL_PER_PAGE = 14;

function openMemorial() {
  memorialOpen = true;
  memorialPage = 0;
}
function closeMemorial() {
  memorialOpen = false;
}

function getMemorialLayout() {
  const w = Math.min(620, width - 40);
  const h = Math.min(560, height - 30);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  return {
    x,
    y,
    w,
    h,
    close: { x: x + w - 150, y: y + h - 54, w: 130, h: 38 },
    prev: { x: x + 20, y: y + h - 54, w: 110, h: 38 },
    next: { x: x + 140, y: y + h - 54, w: 110, h: 38 },
  };
}

function drawMemorialPlaque(c) {
  if (!memorialOpen) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const L = getMemorialLayout();
  c.save();
  if (typeof drawScreenPanel === "function") drawScreenPanel(c, L, { theme: "pink", dim: 0.5 });
  else {
    c.fillStyle = "rgba(20,15,25,0.95)";
    c.fillRect(L.x, L.y, L.w, L.h);
  }
  // The brass plaque
  const px = L.x + 24;
  const py = L.y + 24;
  const pw = L.w - 48;
  const ph = L.h - 100;
  const g = c.createLinearGradient(px, py, px, py + ph);
  g.addColorStop(0, "#d9b45a");
  g.addColorStop(1, "#a9822f");
  c.fillStyle = g;
  if (c.roundRect) {
    c.beginPath();
    c.roundRect(px, py, pw, ph, 10);
    c.fill();
  } else c.fillRect(px, py, pw, ph);
  c.strokeStyle = "#5e4519";
  c.lineWidth = 3;
  c.stroke();
  c.textAlign = "center";
  c.fillStyle = "#3d2b0c";
  c.font = "bold 22px Georgia, serif";
  c.fillText("In loving memory", px + pw / 2, py + 36);
  c.font = "13px Georgia, serif";
  c.fillText(memorialPlaque.length ? `${memorialPlaque.length} remembered here` : "No names yet.", px + pw / 2, py + 56);
  const list = memorialPlaque.slice().reverse();
  const pages = Math.max(1, Math.ceil(list.length / MEMORIAL_PER_PAGE));
  memorialPage = Math.max(0, Math.min(pages - 1, memorialPage));
  const shown = list.slice(memorialPage * MEMORIAL_PER_PAGE, (memorialPage + 1) * MEMORIAL_PER_PAGE);
  const rowH = Math.min(26, (ph - 80) / MEMORIAL_PER_PAGE);
  shown.forEach((e, i) => {
    const ry = py + 84 + i * rowH;
    c.textAlign = "left";
    c.font = "bold 15px Georgia, serif";
    c.fillStyle = "#2e2008";
    c.fillText(e.name, px + 22, ry);
    c.textAlign = "right";
    c.font = "italic 13px Georgia, serif";
    c.fillStyle = "#4a3612";
    const cause = (e.cause || "").replace(/^Killed by /, "killed by ");
    let line = `day ${e.day}${cause ? " · " + cause : ""}`;
    while (line.length > 8 && c.measureText(line).width > pw * 0.6) line = line.slice(0, -2);
    if (line !== `day ${e.day}${cause ? " · " + cause : ""}`) line += "…";
    c.fillText(line, px + pw - 22, ry);
  });
  if (typeof drawGlassButton === "function") {
    drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 15, borderRadius: 10 });
    if (pages > 1) {
      drawGlassButton(L.prev.x, L.prev.y, L.prev.w, L.prev.h, "◀ Newer", { fontSize: 14, borderRadius: 10 });
      drawGlassButton(L.next.x, L.next.y, L.next.w, L.next.h, "Older ▶", { fontSize: 14, borderRadius: 10 });
      c.fillStyle = "rgba(255,255,255,0.75)";
      c.font = "13px Arial";
      c.textAlign = "left";
      c.fillText(`Page ${memorialPage + 1} of ${pages}`, L.next.x + L.next.w + 12, L.close.y + 24);
    }
  }
  c.restore();
}

function handleMemorialClick() {
  if (!memorialOpen) return false;
  const L = getMemorialLayout();
  const hit = (r) => isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h);
  if (hit(L.close) || !isPointInRect(mouse.x, mouse.y, L.x, L.y, L.w, L.h)) closeMemorial();
  else if (hit(L.prev)) memorialPage--;
  else if (hit(L.next)) memorialPage++;
  return true;
}

if (typeof registerScreen === "function") {
  registerScreen({
    name: "memorial",
    layer: 15,
    isOpen: () => memorialOpen,
    close: () => closeMemorial(),
    draw: (c) => drawMemorialPlaque(c),
    click: () => handleMemorialClick(),
  });
}

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({
    name: "Memorial tree",
    desc: "A tree with a little plaque that remembers every fluffy you've lost. Long-press or right-click it to read it. Fluffies mourning someone go and sit by it, and it eases their grief.",
    cost: MEMORIAL_PRICE,
    isItem: "memorial_tree",
  });
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push({
    sellType: "memorial_tree",
    is: (o) => o instanceof MemorialTree,
    inCage: "never",
    hitTest: (o, x, y) => o.hitTest(x, y),
    sellable: true,
    create: (a, sx, sy) => atSpot(new MemorialTree(currentScene), sx, sy),
    drawIcon: (ctx, btnSize) => drawMemorialTree(ctx, 0, 30, 0.28, 1),
    onRightClick: () => {
      openMemorial();
    },
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.MemorialTree = (d) => new MemorialTree(d.scene);
if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({
    name: "memorialPlaque",
    get: () => memorialPlaque,
    set: (v) => (memorialPlaque = Array.isArray(v) ? v : []),
    fresh: () => [],
  });
}
