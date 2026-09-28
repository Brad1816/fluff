// ---------------------------------------------------------------------------
// Family tree and genetics viewer.
//
// PART 1: the family record book (`fluffyRecords`)
//   Fluffies disappear from the `fluffies` list when they're sold, bagged,
//   taken by dogs... so the game forgets them. The record book remembers
//   every fluffy you've owned (and their parents) forever: name, gender,
//   genes, parents, foster mum, when it was born and what became of it.
//   It's saved with the game (SAVED_GAME_STATE in Persistence.js).
//
// PART 2: the family tree screen
//   Opened with the "Family tree" button in the magnifying glass panel.
//   Shows grandparents, parents, brothers and sisters, and foals. Click any
//   fluffy to move the tree onto it. The panel on the right shows the
//   genetics of whoever the mouse is over (or the fluffy in the middle).
// ---------------------------------------------------------------------------

// ======================= PART 1: the record book ===========================

// id -> {
//   id, name, gender, type, genes (array), growth,
//   motherId, fatherId        (birth parents, null if unknown)
//   fosterMotherId            (a mare that adopted it, if any)
//   bornAt                    (game seconds, null if unknown)
//   status                    "alive" | "dead" | "sold" | "day care" | "taken" | "gone"
//   causeOfDeath, leftAt, pottyTraining, personalities
//   bred                      true if you bred it (born at home to your mare)
//   age                       its age (game seconds) when last seen
//   soldFor                   money you got when it was sold
// (bred / age / soldFor feed the breeding records screen, BreedingRecords.js)
// }
let fluffyRecords = {};
let _familySyncTimer = 0;

const FAMILY_STATUS_TEXT = {
  alive: "Alive",
  dead: "Died",
  sold: "Sold",
  "day care": "At day care",
  taken: "Taken by dogs",
  gone: "Gone",
  breeder: "With its breeder", // parents of bought stock (StockMarket.js)
};

// Write down (or update) everything we know about a fluffy that exists now
function recordFluffy(f) {
  if (!f || f.id === undefined || f.id === null) return null;
  let rec = fluffyRecords[f.id];
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  if (!rec) {
    rec = {
      id: f.id,
      motherId: f.motherId ?? null,
      fatherId: f.fatherId ?? null,
      fosterMotherId: null,
      bornAt: Math.max(0, now - (f.age || 0)),
      genes: Array.isArray(f.genes) ? f.genes.slice() : null,
    };
    // Bred by you: a newborn of one of your mares
    const mum = f.motherId !== null && f.motherId !== undefined ? fluffies.find((x) => x.id === f.motherId) : null;
    rec.bred = !!(f.adopted && f.growth < 0.25 && mum && mum.adopted);
    fluffyRecords[f.id] = rec;
  }
  rec.age = f.age || 0;
  rec.name = (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || rec.name || null;
  rec.gender = f.gender;
  rec.type = f.type;
  rec.growth = f.growth;
  // (also refresh genes recorded before newer genes, like traits, existed)
  if (Array.isArray(f.genes) && (!rec.genes || rec.genes.length < f.genes.length))
    rec.genes = f.genes.slice();
  if (rec.fatherId === null && f.fatherId !== undefined && f.fatherId !== null)
    rec.fatherId = f.fatherId;
  // A mare that adopted it replaces motherId on the fluffy; keep the birth
  // mother in the record and note the foster mum separately
  if (f.motherId !== null && f.motherId !== undefined) {
    if (rec.motherId === null) rec.motherId = f.motherId;
    else if (f.motherId !== rec.motherId) rec.fosterMotherId = f.motherId;
  }
  rec.status = f.isAlive ? "alive" : "dead";
  rec.causeOfDeath = f.isAlive ? null : f.causeOfDeath || rec.causeOfDeath || null;
  rec.pottyTraining = f.pottyTraining || 0;
  rec.personalities = f.personalities ? [...f.personalities] : [];
  return rec;
}

// Should this fluffy be in the book? Yours, already known (a parent of one
// of yours), or a foal of someone in the book (so a mare you bring home, or
// look at, has her foals in her tree even if they aren't yours)
function shouldRecordFluffy(f) {
  if (f.adopted || fluffyRecords[f.id]) return true;
  return !!(
    (f.motherId !== null && f.motherId !== undefined && fluffyRecords[f.motherId]) ||
    (f.fatherId !== null && f.fatherId !== undefined && fluffyRecords[f.fatherId])
  );
}

// Record a fluffy and its whole living family now: parents, foals, and
// brothers and sisters (used when a family tree is opened)
function recordLivingFamily(f) {
  if (!f) return;
  recordFluffy(f);
  const isKin = (x) =>
    x !== f &&
    (x.id === f.motherId ||
      x.id === f.fatherId ||
      x.motherId === f.id ||
      x.fatherId === f.id ||
      (f.motherId !== null && f.motherId !== undefined && x.motherId === f.motherId) ||
      (f.fatherId !== null && f.fatherId !== undefined && x.fatherId === f.fatherId));
  for (const x of fluffies) if (isKin(x)) recordFluffy(x);
}

// Bring the whole book up to date with the fluffies that exist right now
function syncFamilyRecords() {
  if (typeof fluffies === "undefined") return;
  const present = new Set();
  // (foals are made after their mums, so they come later in the list and
  // count as family of a known mum in the same pass)
  for (const f of fluffies) {
    present.add(String(f.id));
    if (!shouldRecordFluffy(f)) continue;
    recordFluffy(f);
    // Parents who are still around (even ferals) go in the book too
    for (const pid of [f.motherId, f.fatherId]) {
      if (pid === null || pid === undefined) continue;
      const parent = fluffies.find((p) => p.id === pid);
      if (parent) recordFluffy(parent);
    }
  }
  const atDayCare = new Set(
    (typeof dayCareFluffies !== "undefined" ? dayCareFluffies : []).map((d) => String(d.id)),
  );
  for (const id in fluffyRecords) {
    _guessBred(fluffyRecords[id]);
    if (present.has(id)) continue;
    const rec = fluffyRecords[id];
    if (atDayCare.has(id)) {
      rec.status = "day care";
    } else if (rec.status === "alive" || rec.status === "day care") {
      rec.status = "gone";
      rec.leftAt = typeof timePlayed === "number" ? timePlayed : 0;
    }
  }
}

// Called where a fluffy leaves the game for a known reason (sold, taken).
// price: what you got for it, if it was sold.
function noteFluffyLeft(f, reason, price = null) {
  if (!f || !shouldRecordFluffy(f)) return;
  const rec = recordFluffy(f);
  rec.status = reason;
  rec.leftAt = typeof timePlayed === "number" ? timePlayed : 0;
  if (price !== null && price !== undefined) rec.soldFor = Math.round(price);
}

// Saves from before records knew who you bred: a best guess (a record
// with a known mum that you didn't buy and isn't a breeder's)
function _guessBred(rec) {
  if (rec.bred !== undefined) return;
  const mum = rec.motherId !== null && rec.motherId !== undefined ? fluffyRecords[rec.motherId] : null;
  rec.bred = !!(mum && !rec.boughtFrom && rec.status !== "breeder" && mum.status !== "breeder" && rec.bornAt > 0);
}

// Runs every simulation step (script.js); syncs about once a second
function updateFamilyRecords(dt) {
  _familySyncTimer -= dt;
  if (_familySyncTimer <= 0) {
    _familySyncTimer = 1.0;
    syncFamilyRecords();
  }
}

function getFamilyRecord(id) {
  if (id === null || id === undefined) return null;
  return fluffyRecords[id] || null;
}

function getFamilyName(rec) {
  if (!rec) return "Unknown";
  const n = (typeof fluffyNames !== "undefined" && fluffyNames[rec.id]) || rec.name;
  if (n) return n;
  // Unnamed: "Fluffy (pink unicorn mare)" (Names.js)
  return typeof describeRecordLooks === "function" ? `Fluffy (${describeRecordLooks(rec)})` : "Fluffy";
}

// Foals of a fluffy (as mother or father), oldest first
function getFamilyChildren(id) {
  return Object.values(fluffyRecords)
    .filter((r) => r.motherId === id || r.fatherId === id)
    .sort((a, b) => (a.bornAt || 0) - (b.bornAt || 0) || a.id - b.id);
}

// Brothers and sisters: share a mother or a father. `full` = both parents.
function getFamilySiblings(id) {
  const me = getFamilyRecord(id);
  if (!me) return [];
  const known = (p) => p !== null && p !== undefined;
  return Object.values(fluffyRecords)
    .filter(
      (r) =>
        r.id !== id &&
        ((known(me.motherId) && r.motherId === me.motherId) ||
          (known(me.fatherId) && r.fatherId === me.fatherId)),
    )
    .map((r) => ({
      rec: r,
      full:
        known(me.motherId) &&
        known(me.fatherId) &&
        r.motherId === me.motherId &&
        r.fatherId === me.fatherId,
    }))
    .sort((a, b) => (a.rec.bornAt || 0) - (b.rec.bornAt || 0) || a.rec.id - b.rec.id);
}

// ---- Genetics, read straight from the genes (see HorseGenetics.processGenes) ----

function _geneSum(genes, from, count) {
  let s = 0;
  for (let i = 0; i < count; i++) s += genes[from + i] || 0;
  return s;
}

function _geneRGB(genes, start) {
  const c = (i) => Math.floor(_geneSum(genes, i, 8) * 31.875);
  return `rgb(${c(start)}, ${c(start + 8)}, ${c(start + 16)})`;
}

// Everything the genetics panel shows, worked out from a gene list
function describeGenes(genes) {
  if (!Array.isArray(genes) || genes.length < 71) return null;
  const eyeBases = ["rgb(173, 216, 230)", "rgb(144, 238, 144)", "rgb(255, 182, 193)"];
  const size = [71, 72, 73].reduce((s, i) => s + (genes[i] ? 1 : 0), 0) -
    [74, 75, 76].reduce((s, i) => s + (genes[i] ? 1 : 0), 0);
  const rgbAt = (r, g, b, fallback) =>
    genes[r] !== undefined ? `rgb(${genes[r]}, ${genes[g]}, ${genes[b]})` : fallback;
  // Sensitive-baby genes: each matching pair makes it much more likely
  const sbPairs = [65, 67, 69].filter((i) => genes[i] === genes[i + 1]).length;
  return {
    body: _geneRGB(genes, 0),
    mane: _geneRGB(genes, 24),
    eyeBase: eyeBases[genes[48]] || eyeBases[0],
    eyeDark: _geneSum(genes, 49, 4),
    wings: _geneSum(genes, 53, 5), // shows at 4 of 5
    horn: _geneSum(genes, 58, 5), // shows at 4 of 5
    spots: _geneSum(genes, 79, 4), // shows at 4 of 4
    spotColor: rgbAt(84, 85, 86, "rgb(255, 255, 255)"),
    stripes: _geneSum(genes, 87, 4), // shows at 4 of 4
    stripeColor: rgbAt(92, 93, 94, "rgb(0, 0, 0)"),
    gradient: _geneSum(genes, 95, 4), // shows at 2 of 4
    gradientColor: rgbAt(100, 101, 102, "rgb(255, 255, 255)"),
    size, // -3 (tiny) .. +3 (big)
    maneStyle: genes[63] || 0,
    tailStyle: genes[64] || 0,
    sbPairs,
  };
}

// Colour name and "poopie" rating for a record (same maths as the game)
function describeRecordCoat(rec) {
  const g = rec && rec.genes;
  if (!Array.isArray(g)) return { name: "?", quality: "", tone: "" };
  const rgb = [0, 8, 16].map((i) => Math.floor(_geneSum(g, i, 8) * 31.875));
  let minD = Infinity;
  for (const a of POOPIE_ANCHORS) {
    const d = Math.sqrt((rgb[0] - a[0]) ** 2 + (rgb[1] - a[1]) ** 2 + (rgb[2] - a[2]) ** 2);
    if (d < minD) minD = d;
  }
  const p = Math.max(0, Math.min(1, (minD - 7.5) / 100));
  // Same colour names as HorseGenetics.getColorName ("bwown", "gween"...)
  let name = "";
  try {
    name = HorseGenetics.prototype.getColorName.call({
      horse: { colors: { body: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` } },
    });
  } catch (e) {
    name = "";
  }
  if (p < 0.5) return { name, quality: "poopie colours!", tone: "bad" };
  if (p < 0.9) return { name, quality: "a bit drab", tone: "ok" };
  return { name, quality: "nice colours", tone: "good" };
}

// ======================= PART 2: the tree screen ===========================

let familyTreeFocusId = null; // who's in the middle; null = closed
let familyTreeHistory = []; // for the Back button
let _familyTreeCache = null; // { focusId, canvas, nodes, builtAt }
let _familyPortraitCache = {}; // id -> canvas

function isFamilyTreeOpen() {
  return familyTreeFocusId !== null;
}

function openFamilyTree(fluffyId) {
  syncFamilyRecords();
  const f = fluffies.find((x) => x.id === fluffyId);
  if (f) recordLivingFamily(f); // even a feral you're looking at, with its foals
  familyTreeHistory = [];
  familyTreeFocusId = fluffyId;
  _familyTreeCache = null;
  _familyPortraitCache = {};
}

function closeFamilyTree() {
  familyTreeFocusId = null;
  familyTreeHistory = [];
  _familyTreeCache = null;
  _familyPortraitCache = {};
}

function focusFamilyTree(id) {
  if (id === familyTreeFocusId || !getFamilyRecord(id)) return;
  familyTreeHistory.push(familyTreeFocusId);
  familyTreeFocusId = id;
  _familyTreeCache = null;
}

// The screen is laid out at this size and scaled to fit the window
const FT_W = 1160;
const FT_H = 690;
const FT_TREE_W = 820; // left part; the genetics panel is to the right

function _ftScale() {
  return Math.min(1, (width - 30) / FT_W, (height - 30) / FT_H);
}

function _ftOrigin() {
  const s = _ftScale();
  return { s, ox: (width - FT_W * s) / 2, oy: (height - FT_H * s) / 2 };
}

// Mouse position in the screen's own coordinates
function _ftMouse() {
  const { s, ox, oy } = _ftOrigin();
  return { x: (mouse.x - ox) / s, y: (mouse.y - oy) / s };
}

const FT_BUTTONS = {
  back: { x: 20, y: 18, w: 90, h: 34, label: "Back" },
  close: { x: FT_W - 110, y: 18, w: 90, h: 34, label: "Close" },
};

// A fluffy to draw portraits with. Living fluffies draw themselves; for the
// rest a stand-in is made from the saved genes (without touching the game).
// A throwaway fluffy made from a gene list, for drawing portraits (family
// tree, gene lab). It never joins the game: its id is handed back and its
// relationships entry removed.
function makeStandInFluffy(genes, opts = {}) {
  if (!Array.isArray(genes)) return null;
  const savedId = nextFluffyId;
  let h = null;
  try {
    h = new Horse(
      opts.growth ?? 1,
      null,
      "FAMILY_TREE_PORTRAIT",
      opts.type || "earthy",
      genes.slice(),
      null,
      null,
      opts.gender || null,
    );
  } catch (e) {
    h = null;
  }
  if (h) delete relationships[h.id];
  nextFluffyId = savedId;
  return h;
}

// Draw a fluffy's portrait into a new size x size canvas (null on failure)
function drawFluffyPortraitCanvas(h, size) {
  if (!h || typeof h.drawPortrait !== "function") return null;
  try {
    const canvas = new OffscreenCanvas(size, size);
    const c = canvas.getContext("2d");
    // drawPortrait centres on the body; the head sticks out up and right
    h.drawPortrait(c, size * 0.44, size * 0.6, size * 0.78);
    return canvas;
  } catch (e) {
    return null;
  }
}

function _familyPortraitFluffy(rec) {
  const live = fluffies.find((f) => f.id === rec.id);
  if (live) return live;
  const h = makeStandInFluffy(rec.genes, {
    growth: rec.growth,
    type: rec.type,
    gender: rec.gender,
  });
  if (h && rec.status === "dead") {
    h.isAlive = false;
    h.deathTimer = 999;
  }
  return h;
}

function _familyPortrait(rec, size) {
  const key = rec.id + ":" + size;
  if (_familyPortraitCache[key] !== undefined) return _familyPortraitCache[key];
  const canvas = drawFluffyPortraitCanvas(_familyPortraitFluffy(rec), size);
  _familyPortraitCache[key] = canvas;
  return canvas;
}

function _ftRoundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// Work out where every card goes for the fluffy in the middle
function _buildFamilyTreeLayout(focusId) {
  const me = getFamilyRecord(focusId);
  const nodes = [];
  const lines = [];
  const card = (rec, cx, top, w, h, role) => {
    const n = { rec, id: rec ? rec.id : null, x: cx - w / 2, y: top, w, h, role };
    nodes.push(n);
    return n;
  };
  const mid = (a) => ({ x: a.x + a.w / 2, top: a.y, bottom: a.y + a.h });
  const elbow = (from, to) => lines.push({ from: mid(from), to: mid(to) });

  const rowGP = 70;
  const rowP = 205;
  const rowMe = 345;
  const rowKids = 505;
  const bigW = 104;
  const bigH = 124;
  const smallW = 88;
  const smallH = 108;

  const mom = me ? getFamilyRecord(me.motherId) : null;
  const dad = me ? getFamilyRecord(me.fatherId) : null;
  const unknownIf = (rec, idKnown) => rec || (idKnown !== null && idKnown !== undefined ? { id: idKnown, missing: true } : null);

  // Grandparents
  const gp = [
    [mom, "motherId", FT_TREE_W * 0.125, "Grandma"],
    [mom, "fatherId", FT_TREE_W * 0.325, "Grandpa"],
    [dad, "motherId", FT_TREE_W * 0.675, "Grandma"],
    [dad, "fatherId", FT_TREE_W * 0.875, "Grandpa"],
  ].map(([parent, key, x, role]) => {
    const pid = parent ? parent[key] : null;
    return card(unknownIf(getFamilyRecord(pid), pid), x, rowGP, smallW, smallH, role);
  });
  const momNode = card(unknownIf(mom, me && me.motherId), FT_TREE_W * 0.225, rowP, bigW, bigH, "Mother");
  const dadNode = card(unknownIf(dad, me && me.fatherId), FT_TREE_W * 0.775, rowP, bigW, bigH, "Father");
  elbow(gp[0], momNode);
  elbow(gp[1], momNode);
  elbow(gp[2], dadNode);
  elbow(gp[3], dadNode);

  const meNode = card(me, FT_TREE_W / 2, rowMe, bigW + 12, bigH + 12, "focus");
  elbow(momNode, meNode);
  elbow(dadNode, meNode);

  // Brothers and sisters either side
  const sibs = getFamilySiblings(focusId);
  const shownSibs = sibs.slice(0, 6);
  shownSibs.forEach((s, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const step = Math.floor(i / 2) + 1;
    const x = FT_TREE_W / 2 + side * (70 + step * 98);
    const n = card(s.rec, x, rowMe + 20, smallW, smallH, s.full ? "Sibling" : "Half-sibling");
    n.sibling = true;
  });
  const moreSibs = sibs.length - shownSibs.length;

  // Foals
  const kids = getFamilyChildren(focusId);
  const shownKids = kids.slice(0, 8);
  const kidStep = 98;
  const kidStart = FT_TREE_W / 2 - ((shownKids.length - 1) * kidStep) / 2;
  shownKids.forEach((k, i) => {
    const n = card(k, kidStart + i * kidStep, rowKids, smallW, smallH, "Foal");
    elbow(meNode, n);
  });
  const moreKids = kids.length - shownKids.length;

  return { nodes, lines, moreSibs, moreKids, kidCount: kids.length, sibCount: sibs.length };
}

function _drawFamilyCard(c, n, focusId) {
  const rec = n.rec;
  const isFocus = n.role === "focus";
  if (!rec || rec.missing) {
    c.save();
    c.setLineDash([6, 5]);
    c.strokeStyle = "rgba(255,255,255,0.35)";
    c.lineWidth = 2;
    _ftRoundRect(c, n.x, n.y, n.w, n.h, 10);
    c.stroke();
    c.restore();
    c.fillStyle = "rgba(255,255,255,0.45)";
    c.font = "bold 13px Arial";
    c.textAlign = "center";
    c.fillText(rec && rec.missing ? "Not recorded" : "Unknown", n.x + n.w / 2, n.y + n.h / 2);
    c.font = "11px Arial";
    c.fillText(n.role, n.x + n.w / 2, n.y + n.h / 2 + 18);
    return;
  }

  const male = rec.gender === "male";
  const edge = isFocus ? "#f7d774" : male ? "#6fa8dc" : "#e69ac1";
  c.fillStyle = rec.status === "alive" ? "rgba(30, 30, 45, 0.95)" : "rgba(45, 40, 40, 0.95)";
  _ftRoundRect(c, n.x, n.y, n.w, n.h, 10);
  c.fill();
  c.strokeStyle = edge;
  c.lineWidth = isFocus ? 4 : 2;
  c.stroke();

  const pSize = Math.round(n.w * 0.72);
  const portrait = _familyPortrait(rec, pSize);
  c.save();
  if (rec.status !== "alive") c.globalAlpha = 0.55;
  if (portrait) c.drawImage(portrait, n.x + (n.w - pSize) / 2, n.y + 4);
  c.restore();

  c.textAlign = "center";
  c.fillStyle = "white";
  c.font = "bold 13px Arial";
  let name = getFamilyName(rec);
  while (name.length > 3 && c.measureText(name).width > n.w - 22) name = name.slice(0, -2) + ".";
  c.fillText(name, n.x + n.w / 2 + 7, n.y + n.h - 24);
  c.fillStyle = edge;
  c.font = "bold 13px Arial";
  const symX = n.x + n.w / 2 - c.measureText(name).width / 2 - 2;
  c.fillText(male ? "♂" : "♀", symX, n.y + n.h - 24);

  c.font = "11px Arial";
  const statusColor = { alive: "#9fe0a8", dead: "#ff8a80", sold: "#f7d774" }[rec.status] || "#cfcfcf";
  c.fillStyle = statusColor;
  const role = isFocus ? "" : n.role + " · ";
  c.fillText(role + (FAMILY_STATUS_TEXT[rec.status] || rec.status), n.x + n.w / 2, n.y + n.h - 9);
}

function _renderFamilyTreeCanvas(focusId) {
  const layout = _buildFamilyTreeLayout(focusId);
  const canvas = new OffscreenCanvas(FT_TREE_W, FT_H);
  const c = canvas.getContext("2d");

  // Connecting lines (elbows)
  c.strokeStyle = "rgba(255, 255, 255, 0.35)";
  c.lineWidth = 2;
  for (const l of layout.lines) {
    const midY = (l.from.bottom + l.to.top) / 2;
    c.beginPath();
    c.moveTo(l.from.x, l.from.bottom);
    c.lineTo(l.from.x, midY);
    c.lineTo(l.to.x, midY);
    c.lineTo(l.to.x, l.to.top);
    c.stroke();
  }
  // Siblings hang off a faint bar at the parents' level
  const sibNodes = layout.nodes.filter((n) => n.sibling);
  if (sibNodes.length) {
    const barY = 345 - 12;
    c.strokeStyle = "rgba(255, 255, 255, 0.18)";
    const xs = sibNodes.map((n) => n.x + n.w / 2).concat([FT_TREE_W / 2]);
    c.beginPath();
    c.moveTo(Math.min(...xs), barY);
    c.lineTo(Math.max(...xs), barY);
    for (const n of sibNodes) {
      c.moveTo(n.x + n.w / 2, barY);
      c.lineTo(n.x + n.w / 2, n.y);
    }
    c.stroke();
  }

  for (const n of layout.nodes) _drawFamilyCard(c, n, focusId);

  // Row labels and "+N more"
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.font = "bold 13px Arial";
  c.textAlign = "left";
  c.fillText("Grandparents", 14, 62);
  c.fillText("Parents", 14, 197);
  c.fillText(layout.kidCount ? `Foals (${layout.kidCount})` : "Foals: none yet", 14, 497);
  c.textAlign = "center";
  if (layout.moreSibs > 0)
    c.fillText(`+${layout.moreSibs} more brothers and sisters`, FT_TREE_W / 2, 482);
  if (layout.moreKids > 0)
    c.fillText(`+${layout.moreKids} more foals`, FT_TREE_W / 2, 640);

  return { canvas, nodes: layout.nodes };
}

function _getFamilyTreeCache() {
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  if (
    !_familyTreeCache ||
    _familyTreeCache.focusId !== familyTreeFocusId ||
    Math.abs(now - _familyTreeCache.builtAt) > 2
  ) {
    syncFamilyRecords();
    _familyPortraitCache = {};
    const built = _renderFamilyTreeCanvas(familyTreeFocusId);
    _familyTreeCache = { focusId: familyTreeFocusId, builtAt: now, ...built };
  }
  return _familyTreeCache;
}

function _familyNodeAt(mx, my) {
  const cache = _getFamilyTreeCache();
  const tx = mx - 10; // tree is drawn at x = 10
  const ty = my;
  return (
    cache.nodes.find(
      (n) => n.rec && !n.rec.missing && tx >= n.x && tx <= n.x + n.w && ty >= n.y && ty <= n.y + n.h,
    ) || null
  );
}

// ---- The genetics panel on the right ----

function _ftText(c, text, x, y, color = "white", font = "14px Arial", align = "left") {
  c.font = font;
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(text, x, y);
}

function _ftSwatch(c, color, x, y, size = 16) {
  c.fillStyle = color;
  c.fillRect(x, y - size + 3, size, size);
  c.strokeStyle = "rgba(255,255,255,0.6)";
  c.lineWidth = 1;
  c.strokeRect(x, y - size + 3, size, size);
}

// Dots: filled = genes this fluffy has; the marker shows how many it needs
function _ftGeneDots(c, have, total, needed, x, y, color) {
  for (let i = 0; i < total; i++) {
    c.beginPath();
    c.arc(x + i * 15 + 6, y - 5, 5.5, 0, Math.PI * 2);
    c.fillStyle = i < have ? color : "rgba(255,255,255,0.12)";
    c.fill();
    if (i === needed - 1) {
      c.strokeStyle = "rgba(255,255,255,0.8)";
      c.lineWidth = 1.5;
      c.stroke();
    }
  }
}

function _geneVerdict(have, needed) {
  if (have >= needed) return ["shows", "#9fe0a8"];
  if (have >= needed - 1) return ["carrier", "#f7d774"];
  if (have > 0) return ["weak", "#cfcfcf"];
  return ["none", "#888"];
}

function drawFamilyGeneticsPanel(c, rec, px, py, pw) {
  c.fillStyle = "rgba(255,255,255,0.06)";
  _ftRoundRect(c, px, py, pw, FT_H - py - 20, 10);
  c.fill();
  if (!rec) return;

  const x = px + 16;
  let y = py + 14;
  const portrait = _familyPortrait(rec, 96);
  c.save();
  if (rec.status !== "alive") c.globalAlpha = 0.6;
  if (portrait) c.drawImage(portrait, x - 6, y);
  c.restore();

  const tx = x + 100;
  _ftText(c, getFamilyName(rec), tx, y + 24, "white", "bold 20px Arial");
  const male = rec.gender === "male";
  _ftText(c, `${male ? "♂ Male" : "♀ Female"} ${rec.type || ""}`, tx, y + 46, male ? "#9cc4ec" : "#f1b6d4", "bold 14px Arial");
  let status = FAMILY_STATUS_TEXT[rec.status] || rec.status;
  if (rec.status === "dead" && rec.causeOfDeath) status += ` (${rec.causeOfDeath})`;
  _ftText(c, status, tx, y + 66, "#cfcfcf", "13px Arial");
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  if (rec.bornAt !== null && rec.bornAt !== undefined) {
    const ago = Math.max(0, Math.round((now - rec.bornAt) / 60));
    _ftText(c, ago < 1 ? "Born just now" : `Born ${ago} min ago`, tx, y + 84, "#cfcfcf", "13px Arial");
  } else if (rec.boughtFrom) {
    // Bought stock (StockMarket.js)
    _ftText(c, `From ${rec.boughtFrom}`, tx, y + 84, "#cfcfcf", "13px Arial");
  }
  y += 116;

  const nameOf = (id) => (id === null || id === undefined ? "Unknown" : getFamilyName(getFamilyRecord(id) || { id }));
  _ftText(c, `Mother: ${nameOf(rec.motherId)}`, x, y, "#e0e0e0", "13px Arial");
  y += 18;
  _ftText(c, `Father: ${nameOf(rec.fatherId)}`, x, y, "#e0e0e0", "13px Arial");
  y += 18;
  if (rec.fosterMotherId !== null && rec.fosterMotherId !== undefined) {
    _ftText(c, `Raised by: ${nameOf(rec.fosterMotherId)}`, x, y, "#e0e0e0", "13px Arial");
    y += 18;
  }
  const kids = getFamilyChildren(rec.id).length;
  _ftText(c, `Foals: ${kids}`, x, y, "#e0e0e0", "13px Arial");
  y += 26;

  const g = describeGenes(rec.genes);
  if (!g) {
    _ftText(c, "No genes recorded.", x, y, "#cfcfcf", "13px Arial");
    return;
  }

  _ftText(c, "LOOKS", x, y, "#f7d774", "bold 13px Arial");
  y += 22;
  const coat = describeRecordCoat(rec);
  _ftSwatch(c, g.body, x, y);
  _ftText(c, "Coat", x + 24, y, "#cfcfcf", "13px Arial");
  const toneColor = { good: "#7dff8a", ok: "#ffe066", bad: "#ff6b6b" }[coat.tone] || "white";
  _ftText(c, `${coat.name ? coat.name + " - " : ""}${coat.quality}`, x + 80, y, toneColor, "bold 13px Arial");
  y += 22;
  _ftSwatch(c, g.mane, x, y);
  _ftText(c, "Mane", x + 24, y, "#cfcfcf", "13px Arial");
  _ftText(c, `style ${g.maneStyle + 1}, tail style ${g.tailStyle + 1}`, x + 80, y, "white", "13px Arial");
  y += 22;
  const t = 1 - g.eyeDark / 4;
  const eb = g.eyeBase.match(/\d+/g).map(Number).map((v) => Math.floor(v * t));
  _ftSwatch(c, `rgb(${eb[0]}, ${eb[1]}, ${eb[2]})`, x, y);
  _ftText(c, "Eyes", x + 24, y, "#cfcfcf", "13px Arial");
  const sizeText = g.size >= 2 ? "Big" : g.size <= -2 ? "Small" : g.size === 0 ? "Average" : g.size > 0 ? "A bit big" : "A bit small";
  _ftText(c, `Size: ${sizeText}`, x + 80, y, "white", "13px Arial");
  y += 30;

  _ftText(c, "GENES (what foals can inherit)", x, y, "#f7d774", "bold 13px Arial");
  y += 22;
  const geneRows = [
    ["Wings", g.wings, 5, 4, "#9cc4ec"],
    ["Horn", g.horn, 5, 4, "#c9a0ff"],
    ["Spots", g.spots, 4, 4, g.spotColor],
    ["Stripes", g.stripes, 4, 4, g.stripeColor],
    ["Gradient", g.gradient, 4, 2, g.gradientColor],
  ];
  for (const [label, have, total, needed, color] of geneRows) {
    _ftText(c, label, x, y, "#cfcfcf", "13px Arial");
    _ftGeneDots(c, have, total, needed, x + 72, y, color);
    const [verdict, vColor] = _geneVerdict(have, needed);
    _ftText(c, verdict, x + 72 + total * 15 + 10, y, vColor, "bold 13px Arial");
    y += 21;
  }
  if (typeof worldSettings !== "undefined" && worldSettings.sbs) {
    const risk = ["Low", "Raised", "High", "Very high"][g.sbPairs];
    _ftText(c, "Sensitive baby risk", x, y, "#cfcfcf", "13px Arial");
    _ftText(c, risk, x + 150, y, g.sbPairs >= 2 ? "#ff6b6b" : g.sbPairs === 1 ? "#ffe066" : "#9fe0a8", "bold 13px Arial");
    y += 21;
  }
  // Personality traits (Traits.js): low label, 5 gene dots, high label
  if (typeof TRAITS !== "undefined" && typeof traitGeneSum === "function") {
    y += 8;
    _ftText(c, "PERSONALITY TRAITS", x, y, "#f7d774", "bold 13px Arial");
    y += 19;
    for (const t of TRAITS) {
      const sum = traitGeneSum(rec.genes, t.key);
      const lowOn = sum !== null && sum <= 1;
      const highOn = sum !== null && sum >= 4;
      _ftText(c, t.low, x + 78, y, lowOn ? "#ffe066" : "#8a8a8a", lowOn ? "bold 13px Arial" : "13px Arial", "right");
      for (let i = 0; i < TRAIT_GENES_EACH; i++) {
        c.beginPath();
        c.arc(x + 92 + i * 14, y - 5, 5, 0, Math.PI * 2);
        c.fillStyle = sum === null ? "rgba(255,255,255,0.06)" : i < sum ? "#e0c0ff" : "rgba(255,255,255,0.12)";
        c.fill();
      }
      _ftText(c, sum === null ? "unknown" : t.high, x + 92 + TRAIT_GENES_EACH * 14 + 4, y, highOn ? "#ffe066" : "#8a8a8a", highOn ? "bold 13px Arial" : "13px Arial");
      y += 18;
    }
  }
  y += 6;
  c.font = "12px Arial";
  c.fillStyle = "rgba(255,255,255,0.6)";
  c.textAlign = "left";
  const note =
    "Foals get each gene from one parent or the other at random. Ringed dot = how many a trait needs to show.";
  const lines = typeof wrapText === "function" ? wrapText(c, note, pw - 32) : [note];
  for (const l of lines) {
    c.fillText(l, x, y);
    y += 15;
  }
}

// ---- Drawing and clicking the whole screen ----

function drawFamilyTree(c) {
  if (!isFamilyTreeOpen()) return;
  // drawUI runs twice a frame (world buffer, then screen); only draw on the
  // screen pass so speech bubbles can't end up on top of this
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const focus = getFamilyRecord(familyTreeFocusId);
  if (!focus) {
    closeFamilyTree();
    return;
  }
  const cache = _getFamilyTreeCache();
  const { s, ox, oy } = _ftOrigin();
  const m = _ftMouse();

  c.save();
  c.globalAlpha = 1;
  c.textBaseline = "alphabetic";
  c.setLineDash([]);
  c.fillStyle = "rgba(0,0,0,0.6)";
  c.fillRect(0, 0, width, height);
  c.translate(ox, oy);
  c.scale(s, s);

  c.fillStyle = "rgb(18, 14, 26)";
  _ftRoundRect(c, 0, 0, FT_W, FT_H, 14);
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.4)";
  c.lineWidth = 2;
  c.stroke();

  _ftText(c, `${getFamilyName(focus)}'s family`, FT_W / 2, 44, "white", "bold 28px Arial", "center");

  c.drawImage(cache.canvas, 10, 0);

  const hover = _familyNodeAt(m.x, m.y);
  if (hover) {
    c.strokeStyle = "white";
    c.lineWidth = 3;
    _ftRoundRect(c, hover.x + 10 - 3, hover.y - 3, hover.w + 6, hover.h + 6, 12);
    c.stroke();
  }

  drawFamilyGeneticsPanel(c, hover ? hover.rec : focus, FT_TREE_W + 20, 70, FT_W - FT_TREE_W - 40);

  _ftText(
    c,
    "Click a fluffy to see its family. Hover to see its genes.",
    FT_TREE_W / 2 + 10,
    FT_H - 16,
    "rgba(255,255,255,0.55)",
    "13px Arial",
    "center",
  );

  for (const key of ["back", "close"]) {
    const b = FT_BUTTONS[key];
    if (key === "back" && familyTreeHistory.length === 0) continue;
    const over = m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;
    c.fillStyle = over ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)";
    _ftRoundRect(c, b.x, b.y, b.w, b.h, 8);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = 1.5;
    c.stroke();
    _ftText(c, b.label, b.x + b.w / 2, b.y + 23, "white", "bold 16px Arial", "center");
  }
  c.restore();
}

// Returns true if the click was used by the family tree screen
function handleFamilyTreeClick() {
  if (!isFamilyTreeOpen()) return false;
  const m = _ftMouse();
  const inRect = (b) => m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;

  if (inRect(FT_BUTTONS.close)) {
    closeFamilyTree();
    return true;
  }
  if (familyTreeHistory.length > 0 && inRect(FT_BUTTONS.back)) {
    familyTreeFocusId = familyTreeHistory.pop();
    _familyTreeCache = null;
    return true;
  }
  const node = _familyNodeAt(m.x, m.y);
  if (node) {
    focusFamilyTree(node.rec.id);
    return true;
  }
  // Clicking outside the screen closes it; inside does nothing
  if (m.x < 0 || m.y < 0 || m.x > FT_W || m.y > FT_H) closeFamilyTree();
  return true;
}
