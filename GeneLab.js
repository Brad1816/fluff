// ---------------------------------------------------------------------------
// Gene Lab: a machine you buy at Fluff Mart (Pharmacy & Lab aisle).
// Right-click it to open the lab screen: pick a mother and a father and it
// predicts what their foals could be like.
//
// The predictions aren't guesses: the lab runs the game's own inheritance
// code (HorseGenetics.combineGenes) for 400 pretend foals and counts what
// comes out, and works out the "born alive" odds with the same rules
// HorseAnatomy.triggerPregnancy uses. Decoding genes into traits is
// describeGenes() in FamilyTree.js.
// ---------------------------------------------------------------------------

const GENE_LAB_SAMPLES = 400;

// ======================= The machine (a world item) ========================

class GeneLab {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.y = Math.max(this.y, topWallHeight + 10);
    }
  }

  onDrop() {
    return handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  // (x, y) is the middle of its bottom edge
  hitTest(px, py) {
    return px >= this.x - 50 && px <= this.x + 50 && py >= this.y - 112 && py <= this.y;
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return {
      classType: "GeneLab",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {}

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const t = typeof timePlayed === "number" ? timePlayed : 0;
    drawGeneLabMachine(ctx, this.x, this.y, 1, t);

    // "Right-click to use" when the mouse is over it
    const busy =
      isGlobalDragging || (typeof isAnyScreenOpen === "function" && isAnyScreenOpen());
    if (!busy && this.scene === currentScene && this.hitTest(mouse.x, mouse.y)) {
      ctx.save();
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "black";
      ctx.fillStyle = "white";
      ctx.strokeText("Right-click to use", this.x, this.y - 122);
      ctx.fillText("Right-click to use", this.x, this.y - 122);
      ctx.restore();
    }
  }
}

// The machine's picture. (x, y) = middle of the bottom; scale 1 = 100x112px
function drawGeneLabMachine(c, x, y, scale, t = 0) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);

  const rr = (x0, y0, w, h, r) => {
    c.beginPath();
    c.moveTo(x0 + r, y0);
    c.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
    c.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    c.arcTo(x0, y0 + h, x0, y0, r);
    c.arcTo(x0, y0, x0 + w, y0, r);
    c.closePath();
  };

  // Cabinet
  c.fillStyle = "#dfe6ea";
  rr(-50, -112, 100, 112, 10);
  c.fill();
  c.strokeStyle = "#5f6f78";
  c.lineWidth = 3;
  c.stroke();

  // Screen with a turning DNA helix
  c.fillStyle = "#0f1f28";
  rr(-40, -102, 80, 48, 6);
  c.fill();
  c.save();
  c.beginPath();
  c.rect(-38, -100, 76, 44);
  c.clip();
  for (let i = 0; i <= 16; i++) {
    const px = -36 + i * 4.5;
    const a = t * 3 + i * 0.55;
    const y1 = -78 + Math.sin(a) * 15;
    const y2 = -78 - Math.sin(a) * 15;
    c.strokeStyle = "rgba(255,255,255,0.25)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(px, y1);
    c.lineTo(px, y2);
    c.stroke();
    c.fillStyle = "#7fd8ff";
    c.fillRect(px - 1.5, y1 - 1.5, 3, 3);
    c.fillStyle = "#ff9ccf";
    c.fillRect(px - 1.5, y2 - 1.5, 3, 3);
  }
  c.restore();

  // Label
  c.fillStyle = "#2e4a62";
  c.font = "bold 12px Arial";
  c.textAlign = "center";
  c.fillText("GENE LAB", 0, -40);

  // Mother and father pads
  c.fillStyle = "#f1b6d4";
  c.beginPath();
  c.arc(-22, -18, 12, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#9cc4ec";
  c.beginPath();
  c.arc(22, -18, 12, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#5f6f78";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(-22, -18, 12, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.arc(22, -18, 12, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = "#333";
  c.font = "bold 14px Arial";
  c.fillText("♀", -22, -13);
  c.fillText("♂", 22, -13);

  // Blinking light
  c.fillStyle = Math.floor(t * 2) % 2 ? "#6f6" : "#2a4";
  c.beginPath();
  c.arc(40, -46, 3.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// Shelf / menu picture (drawn around 0,0, about 30px across)
function drawGeneLabIcon(ctx, btnSize) {
  drawGeneLabMachine(ctx, 0, 16, 0.28, 0);
}

// ======================= The predictions ==================================

// Small repeatable random number generator, so a prediction doesn't change
// every time the screen redraws
function _labRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _labTypeOf(d) {
  if (d.wings >= 4 && d.horn >= 4) return "alicorn";
  if (d.wings >= 4) return "pegasus";
  if (d.horn >= 4) return "unicorn";
  return "earthy";
}

// Chance a foal of these two is born alive. triggerPregnancy picks one of
// each parent's two genes in each of 3 pairs (65/66, 67/68, 69/70); if the
// two picks are the same number in ANY pair, the foal isn't viable.
function geneLabViability(momGenes, dadGenes) {
  let alive = 1;
  for (let pair = 0; pair < 3; pair++) {
    const i = 65 + pair * 2;
    let same = 0;
    for (const m of [momGenes[i], momGenes[i + 1]])
      for (const d of [dadGenes[i], dadGenes[i + 1]]) if (m === d) same++;
    alive *= 1 - same / 4;
  }
  return alive;
}

// Everything the lab shows for a pair. momSensitive: is the mother a
// sensitive fluffy (raises the sensitive-baby chance, like spawnBaby).
function computeLitterPrediction(momGenes, dadGenes, seed = 1, momSensitive = false) {
  const rnd = _labRandom(seed);
  const n = GENE_LAB_SAMPLES;
  const count = {
    earthy: 0, unicorn: 0, pegasus: 0, alicorn: 0,
    spots: 0, stripes: 0, gradient: 0,
    wingCarrier: 0, hornCarrier: 0,
    nice: 0, drab: 0, poopie: 0,
    big: 0, average: 0, small: 0,
  };
  let sbTotal = 0;
  const samples = [];
  const traitCount = {};
  if (typeof TRAITS !== "undefined") for (const t of TRAITS) traitCount[t.key] = { high: 0, low: 0 };

  // Borrow the game's own combineGenes, with our repeatable randomness
  const realRandom = Math.random;
  Math.random = rnd;
  try {
    for (let k = 0; k < n; k++) {
      const genes = HorseGenetics.prototype.combineGenes.call({ horse: { genes: momGenes } }, dadGenes);
      const d = describeGenes(genes);
      const type = _labTypeOf(d);
      count[type]++;
      if (d.spots === 4) count.spots++;
      if (d.stripes === 4) count.stripes++;
      if (d.gradient >= 2) count.gradient++;
      if (d.wings === 3) count.wingCarrier++;
      if (d.horn === 3) count.hornCarrier++;
      const coat = describeRecordCoat({ genes });
      if (coat.tone === "good") count.nice++;
      else if (coat.tone === "ok") count.drab++;
      else count.poopie++;
      if (d.size >= 2) count.big++;
      else if (d.size <= -2) count.small++;
      else count.average++;
      sbTotal += Math.min(1, (momSensitive ? 0.175 : 0.04) * Math.pow(4, d.sbPairs));
      // Personality traits (Traits.js)
      if (typeof TRAITS !== "undefined") {
        for (const t of TRAITS) {
          const sum = traitGeneSum(genes, t.key);
          if (sum === null) continue;
          if (sum >= 4) traitCount[t.key].high++;
          else if (sum <= 1) traitCount[t.key].low++;
        }
      }
      if (samples.length < 80) samples.push({ genes, type, body: d.body });
    }
  } finally {
    Math.random = realRandom;
  }

  const pct = {};
  for (const key in count) pct[key] = count[key] / n;
  const traits = {};
  for (const key in traitCount) traits[key] = { high: traitCount[key].high / n, low: traitCount[key].low / n };
  return {
    pct,
    traits,
    samples,
    alive: geneLabViability(momGenes, dadGenes),
    sensitive: sbTotal / n,
  };
}

// n example foals whose types match the odds (so 60% pegasus = about 60% of
// the examples), most common type first
function geneLabExampleFoals(result, n = 7) {
  const types = ["earthy", "unicorn", "pegasus", "alicorn"];
  const want = types.map((t) => ({ t, exact: result.pct[t] * n }));
  want.forEach((w) => (w.count = Math.floor(w.exact)));
  let left = n - want.reduce((s, w) => s + w.count, 0);
  [...want]
    .sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))
    .forEach((w) => {
      if (left > 0 && w.exact > 0) {
        w.count++;
        left--;
      }
    });
  const picked = [];
  for (const w of want.sort((a, b) => b.exact - a.exact)) {
    picked.push(...result.samples.filter((s) => s.type === w.t).slice(0, w.count));
  }
  // Not enough of some type among the samples: top up with any others
  for (const s of result.samples) {
    if (picked.length >= n) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked.slice(0, n);
}

// How two fluffies are related (from the family record book), or null
function describeFamilyRelation(aId, bId) {
  const a = getFamilyRecord(aId);
  const b = getFamilyRecord(bId);
  if (!a || !b) return null;
  const known = (x) => x !== null && x !== undefined;
  const parentsOf = (r) => [r.motherId, r.fatherId].filter(known);
  if (parentsOf(a).includes(b.id) || parentsOf(b).includes(a.id)) return "parent and foal";
  const pa = parentsOf(a);
  const pb = parentsOf(b);
  const shared = pa.filter((p) => pb.includes(p));
  if (shared.length === 2) return "brother and sister";
  if (shared.length === 1) return "half-siblings";
  const grand = (r) => parentsOf(r).flatMap((p) => { const pr = getFamilyRecord(p); return pr ? parentsOf(pr) : []; });
  if (grand(a).includes(b.id) || grand(b).includes(a.id)) return "grandparent and grandchild";
  const ga = grand(a);
  if (grand(b).some((g) => ga.includes(g))) return "cousins";
  const auntUncle = (r, other) => parentsOf(r).some((p) => {
    const pr = getFamilyRecord(p);
    return pr && parentsOf(pr).length && parentsOf(pr).some((gp) => parentsOf(other).includes(gp));
  });
  if (auntUncle(a, b) || auntUncle(b, a)) return "aunt/uncle and niece/nephew";
  return null;
}

// ======================= The lab screen ====================================

let geneLabOpen = false;
let geneLabMotherId = null;
let geneLabFatherId = null; // a fluffy id, or "PREGNANCY" (the mother's current litter)
let geneLabPages = { female: 0, male: 0 };
let _geneLabCache = null;
let _geneLabPortraits = {};

const GL_W = 1160;
const GL_H = 690;
const GL_ROWS = 9;
const GL_ROW_H = 52;
const GL_LIST_TOP = 112;
const GL_COLS = { female: 20, male: 272 };
const GL_LIST_W = 240;
const GL_PANEL_X = 530;

function isGeneLabOpen() {
  return geneLabOpen;
}

function openGeneLab() {
  if (typeof syncFamilyRecords === "function") syncFamilyRecords();
  geneLabOpen = true;
  geneLabMotherId = null;
  geneLabFatherId = null;
  geneLabPages = { female: 0, male: 0 };
  _geneLabCache = null;
  _geneLabPortraits = {};
  return true;
}

function closeGeneLab() {
  geneLabOpen = false;
  _geneLabCache = null;
  _geneLabPortraits = {};
}

function _glOrigin() {
  const s = Math.min(1, (width - 30) / GL_W, (height - 30) / GL_H);
  return { s, ox: (width - GL_W * s) / 2, oy: (height - GL_H * s) / 2 };
}

function _glMouse() {
  const { s, ox, oy } = _glOrigin();
  return { x: (mouse.x - ox) / s, y: (mouse.y - oy) / s };
}

const GL_BUTTONS = {
  close: { x: GL_W - 110, y: 18, w: 90, h: 34, label: "Close" },
};

// Your living fluffies of one gender, by name
function geneLabCandidates(gender) {
  return fluffies
    .filter((f) => f.isAlive && f.adopted && f.gender === gender)
    .sort((a, b) => {
      const na = (fluffyNames[a.id] || "Fluffy").toLowerCase();
      const nb = (fluffyNames[b.id] || "Fluffy").toLowerCase();
      return na < nb ? -1 : na > nb ? 1 : a.id - b.id;
    });
}

// Rows shown in each list (the father list starts with "this pregnancy"
// when the chosen mother is expecting)
function _geneLabRows(gender) {
  const rows = geneLabCandidates(gender).map((f) => ({ id: f.id, fluffy: f }));
  if (gender === "male") {
    const mom = fluffies.find((f) => f.id === geneLabMotherId);
    if (mom && mom.isPregnant && Array.isArray(mom.fatherGenes)) {
      rows.unshift({ id: "PREGNANCY", pregnancyOf: mom });
    }
  }
  return rows;
}

function _geneLabPageCount(gender) {
  return Math.max(1, Math.ceil(_geneLabRows(gender).length / GL_ROWS));
}

function _geneLabVisibleRows(gender) {
  const rows = _geneLabRows(gender);
  const pages = Math.max(1, Math.ceil(rows.length / GL_ROWS));
  geneLabPages[gender] = clamp(geneLabPages[gender], 0, pages - 1);
  const start = geneLabPages[gender] * GL_ROWS;
  return rows.slice(start, start + GL_ROWS).map((r, i) => ({
    ...r,
    x: GL_COLS[gender],
    y: GL_LIST_TOP + i * GL_ROW_H,
    w: GL_LIST_W,
    h: GL_ROW_H - 6,
  }));
}

function _geneLabPageButtons(gender) {
  const x = GL_COLS[gender];
  const y = GL_LIST_TOP + GL_ROWS * GL_ROW_H + 6;
  return {
    prev: { x, y, w: 60, h: 30, label: "▲" },
    next: { x: x + GL_LIST_W - 60, y, w: 60, h: 30, label: "▼" },
  };
}

function _geneLabPortrait(key, makeFluffy, size) {
  const k = key + ":" + size;
  if (_geneLabPortraits[k] === undefined) {
    _geneLabPortraits[k] = drawFluffyPortraitCanvas(makeFluffy(), size);
  }
  return _geneLabPortraits[k];
}

// The chosen pair's genes (or null if not both chosen)
function _geneLabPair() {
  const mom = fluffies.find((f) => f.id === geneLabMotherId && f.isAlive);
  if (!mom) return null;
  if (geneLabFatherId === "PREGNANCY") {
    if (!mom.isPregnant || !Array.isArray(mom.fatherGenes)) return null;
    const dadRec = getFamilyRecord(mom.babyDaddyId);
    return {
      mom,
      momGenes: mom.genes,
      dadGenes: mom.fatherGenes,
      dadName: dadRec ? getFamilyName(dadRec) : (fluffyNames[mom.babyDaddyId] || "the father"),
      dadId: mom.babyDaddyId,
      pregnancy: true,
    };
  }
  const dad = fluffies.find((f) => f.id === geneLabFatherId && f.isAlive);
  if (!dad) return null;
  return {
    mom,
    momGenes: mom.genes,
    dadGenes: dad.genes,
    dadName: fluffyNames[dad.id] || "Fluffy",
    dadId: dad.id,
    pregnancy: false,
  };
}

function _geneLabPrediction() {
  const pair = _geneLabPair();
  if (!pair) return null;
  const key = `${pair.mom.id}|${geneLabFatherId}|${pair.dadId}`;
  if (!_geneLabCache || _geneLabCache.key !== key) {
    const seed = (pair.mom.id + 1) * 7919 + ((pair.dadId ?? 0) + 1) * 104729;
    _geneLabCache = {
      key,
      pair,
      result: computeLitterPrediction(
        pair.momGenes,
        pair.dadGenes,
        seed,
        pair.mom.isSensitive && pair.mom.isSensitive(),
      ),
      relation: describeFamilyRelation(pair.mom.id, pair.dadId),
    };
  }
  return _geneLabCache;
}

// ---- Drawing ----

function _glText(c, text, x, y, color = "white", font = "14px Arial", align = "left") {
  c.font = font;
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(text, x, y);
}

function _glRoundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function _glButton(c, b, m, disabled = false) {
  const over = !disabled && m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;
  c.fillStyle = over ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)";
  _glRoundRect(c, b.x, b.y, b.w, b.h, 8);
  c.fill();
  c.strokeStyle = disabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)";
  c.lineWidth = 1.5;
  c.stroke();
  _glText(c, b.label, b.x + b.w / 2, b.y + b.h / 2 + 6, disabled ? "rgba(255,255,255,0.3)" : "white", "bold 16px Arial", "center");
}

// A labelled percentage bar
function _glBar(c, label, frac, x, y, color, barW = 150) {
  _glText(c, label, x, y, "#cfcfcf", "13px Arial");
  const bx = x + 78;
  c.fillStyle = "rgba(255,255,255,0.1)";
  c.fillRect(bx, y - 11, barW, 13);
  c.fillStyle = color;
  c.fillRect(bx, y - 11, Math.round(barW * frac), 13);
  _glText(c, `${Math.round(frac * 100)}%`, bx + barW + 8, y, "white", "bold 13px Arial");
}

function _drawGeneLabList(c, gender, m) {
  const x = GL_COLS[gender];
  _glText(c, gender === "female" ? "Mother ♀" : "Father ♂", x, 98, gender === "female" ? "#f1b6d4" : "#9cc4ec", "bold 17px Arial");
  const rows = _geneLabVisibleRows(gender);
  if (rows.length === 0) {
    _glText(c, `No ${gender === "female" ? "mares" : "stallions"} of yours yet.`, x, GL_LIST_TOP + 24, "#999", "13px Arial");
  }
  const selected = gender === "female" ? geneLabMotherId : geneLabFatherId;
  for (const r of rows) {
    const isSel = r.id === selected;
    const over = m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h;
    c.fillStyle = isSel ? "rgba(247, 215, 116, 0.18)" : over ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)";
    _glRoundRect(c, r.x, r.y, r.w, r.h, 8);
    c.fill();
    if (isSel) {
      c.strokeStyle = "#f7d774";
      c.lineWidth = 2;
      c.stroke();
    }
    if (r.pregnancyOf) {
      const mom = r.pregnancyOf;
      const dadRec = getFamilyRecord(mom.babyDaddyId);
      const dadName = dadRec ? getFamilyName(dadRec) : fluffyNames[mom.babyDaddyId] || "unknown father";
      _glText(c, "This pregnancy", r.x + 12, r.y + 20, "#f7d774", "bold 14px Arial");
      _glText(c, `by ${dadName}`, r.x + 12, r.y + 38, "#cfcfcf", "12px Arial");
      continue;
    }
    const f = r.fluffy;
    const p = _geneLabPortrait("f" + f.id, () => f, 44);
    if (p) c.drawImage(p, r.x + 2, r.y + 1);
    let name = fluffyNames[f.id] || "Fluffy";
    c.font = "bold 14px Arial";
    while (name.length > 3 && c.measureText(name).width > r.w - 60) name = name.slice(0, -2) + ".";
    _glText(c, name, r.x + 52, r.y + 20, "white", "bold 14px Arial");
    const coat = describeRecordCoat({ genes: f.genes });
    let sub = `${f.growth < 1 ? "foal " : ""}${f.type}`;
    if (f.gender === "female" && f.isPregnant) sub += " · pregnant";
    _glText(c, sub, r.x + 52, r.y + 38, "#cfcfcf", "12px Arial");
    const toneColor = { good: "#7dff8a", ok: "#ffe066", bad: "#ff6b6b" }[coat.tone] || "#ccc";
    c.fillStyle = toneColor;
    c.beginPath();
    c.arc(r.x + r.w - 12, r.y + r.h / 2, 5, 0, Math.PI * 2);
    c.fill();
  }
  const pages = _geneLabPageCount(gender);
  if (pages > 1) {
    const btns = _geneLabPageButtons(gender);
    _glButton(c, btns.prev, m, geneLabPages[gender] === 0);
    _glButton(c, btns.next, m, geneLabPages[gender] >= pages - 1);
    _glText(c, `${geneLabPages[gender] + 1} / ${pages}`, x + GL_LIST_W / 2, btns.prev.y + 21, "#cfcfcf", "13px Arial", "center");
  }
}

function _drawGeneLabPrediction(c) {
  const px = GL_PANEL_X;
  const pw = GL_W - px - 20;
  c.fillStyle = "rgba(255,255,255,0.06)";
  _glRoundRect(c, px, 72, pw, GL_H - 92, 10);
  c.fill();

  const pred = _geneLabPrediction();
  if (!pred) {
    _glText(c, "Pick a mother and a father", px + pw / 2, 300, "white", "bold 22px Arial", "center");
    _glText(c, "to see what their foals could be like.", px + pw / 2, 328, "#cfcfcf", "16px Arial", "center");
    _glText(c, "(Only your own fluffies are listed. The dot shows coat colour: green nice, yellow drab, red poopie.)", px + pw / 2, 360, "#999", "12px Arial", "center");
    return;
  }
  const { pair, result, relation } = pred;
  const x = px + 18;
  let y = 104;
  const momName = fluffyNames[pair.mom.id] || "Fluffy";
  _glText(c, `${momName} ♀  +  ${pair.dadName} ♂`, x, y, "white", "bold 20px Arial");
  if (pair.pregnancy) _glText(c, "(her current pregnancy)", x + c.measureText(`${momName} ♀  +  ${pair.dadName} ♂`).width + 12, y, "#f7d774", "13px Arial");
  y += 22;
  if (relation) {
    _glText(c, `⚠ These two are related: ${relation}.`, x, y, "#ffb86b", "bold 13px Arial");
  } else {
    _glText(c, "Not related (as far as the family records know).", x, y, "#9fe0a8", "13px Arial");
  }
  y += 12;

  // Example foals
  _glText(c, "EXAMPLE FOALS (how they'd look grown up)", x, y + 16, "#f7d774", "bold 13px Arial");
  y += 24;
  const shown = geneLabExampleFoals(result, 7);
  shown.forEach((s, i) => {
    const key = `s${pred.key}:${i}`;
    const p = _geneLabPortrait(key, () => makeStandInFluffy(s.genes, { gender: i % 2 ? "male" : "female" }), 78);
    const fx = x + i * 84;
    c.fillStyle = "rgba(0,0,0,0.25)";
    _glRoundRect(c, fx, y, 78, 78, 8);
    c.fill();
    if (p) c.drawImage(p, fx, y);
    _glText(c, s.type, fx + 39, y + 92, "#cfcfcf", "11px Arial", "center");
  });
  y += 116;

  // Left column: type and patterns
  const col2 = x + 300;
  let ly = y;
  _glText(c, "FOAL TYPE", x, ly, "#f7d774", "bold 13px Arial");
  ly += 20;
  _glBar(c, "Earthy", result.pct.earthy, x, ly, "#c8b48a"); ly += 19;
  _glBar(c, "Unicorn", result.pct.unicorn, x, ly, "#c9a0ff"); ly += 19;
  _glBar(c, "Pegasus", result.pct.pegasus, x, ly, "#9cc4ec"); ly += 19;
  _glBar(c, "Alicorn", result.pct.alicorn, x, ly, "#f7d774"); ly += 27;
  _glText(c, "PATTERNS", x, ly, "#f7d774", "bold 13px Arial");
  ly += 20;
  _glBar(c, "Spots", result.pct.spots, x, ly, "#e8a0a0"); ly += 19;
  _glBar(c, "Stripes", result.pct.stripes, x, ly, "#a0a0e8"); ly += 19;
  _glBar(c, "Gradient", result.pct.gradient, x, ly, "#a0e8c8"); ly += 27;
  _glText(c, "HIDDEN CARRIERS (can pass it on)", x, ly, "#f7d774", "bold 13px Arial");
  ly += 20;
  _glBar(c, "Wings", result.pct.wingCarrier, x, ly, "#6f8fae"); ly += 19;
  _glBar(c, "Horn", result.pct.hornCarrier, x, ly, "#8f73b8");

  // Right column: coat, size, litter
  let ry = y;
  _glText(c, "COAT COLOURS", col2, ry, "#f7d774", "bold 13px Arial");
  ry += 20;
  _glBar(c, "Nice", result.pct.nice, col2, ry, "#7dff8a"); ry += 19;
  _glBar(c, "Drab", result.pct.drab, col2, ry, "#ffe066"); ry += 19;
  _glBar(c, "Poopie", result.pct.poopie, col2, ry, "#ff6b6b"); ry += 12;
  // A strip of possible coat colours
  result.samples.slice(0, 16).forEach((s, i) => {
    c.fillStyle = s.body;
    c.fillRect(col2 + i * 16, ry, 14, 14);
  });
  c.strokeStyle = "rgba(255,255,255,0.3)";
  c.lineWidth = 1;
  c.strokeRect(col2 - 1, ry - 1, 16 * 16, 16);
  ry += 34;
  _glText(c, "SIZE", col2, ry, "#f7d774", "bold 13px Arial");
  ry += 20;
  _glBar(c, "Big", result.pct.big, col2, ry, "#b0d0b0"); ry += 19;
  _glBar(c, "Average", result.pct.average, col2, ry, "#b0b0b0"); ry += 19;
  _glBar(c, "Small", result.pct.small, col2, ry, "#d0b0b0"); ry += 27;
  _glText(c, "LITTER", col2, ry, "#f7d774", "bold 13px Arial");
  ry += 20;
  const aliveColor = result.alive >= 0.8 ? "#7dff8a" : result.alive >= 0.5 ? "#ffe066" : "#ff6b6b";
  _glText(c, "Born alive:", col2, ry, "#cfcfcf", "13px Arial");
  _glText(c, `${Math.round(result.alive * 100)}% of foals`, col2 + 90, ry, aliveColor, "bold 13px Arial");
  ry += 19;
  if (pair.pregnancy) {
    const mom = pair.mom;
    const total = mom.foalViability ? mom.foalViability.length : mom.babiesToBirth;
    const dead = (mom.foalViability || []).filter((v) => v === false).length;
    _glText(c, "Scan:", col2, ry, "#cfcfcf", "13px Arial");
    _glText(c, `${total} foal${total === 1 ? "" : "s"} on the way${dead ? `, ${dead} won't make it` : ", all healthy"}`, col2 + 90, ry, dead ? "#ff6b6b" : "#7dff8a", "bold 13px Arial");
  } else {
    _glText(c, "Litter size:", col2, ry, "#cfcfcf", "13px Arial");
    _glText(c, "1 to 7 foals", col2 + 90, ry, "white", "13px Arial");
  }
  ry += 19;
  if (typeof worldSettings !== "undefined" && worldSettings.sbs) {
    _glText(c, "Sensitive baby:", col2, ry, "#cfcfcf", "13px Arial");
    const sb = result.sensitive;
    _glText(c, `${Math.round(sb * 100)}% chance each`, col2 + 110, ry, sb >= 0.25 ? "#ff6b6b" : sb >= 0.1 ? "#ffe066" : "#7dff8a", "bold 13px Arial");
  }

  // Personality traits (Traits.js): chance of each label, two columns
  if (result.traits && typeof TRAITS !== "undefined") {
    let ty = Math.max(ly, ry) + 30;
    _glText(c, "PERSONALITY TRAITS (chance for each foal)", x, ty, "#f7d774", "bold 13px Arial");
    ty += 19;
    TRAITS.forEach((t, i) => {
      const tr = result.traits[t.key] || { high: 0, low: 0 };
      const tx = i % 2 === 0 ? x : col2;
      const rowY = ty + Math.floor(i / 2) * 18;
      _glText(c, `${t.high} ${Math.round(tr.high * 100)}%`, tx, rowY, "white", "13px Arial");
      _glText(c, `·  ${t.low} ${Math.round(tr.low * 100)}%`, tx + 110, rowY, "#cfcfcf", "13px Arial");
    });
  }

  _glText(
    c,
    `Worked out from ${GENE_LAB_SAMPLES} pretend foals using the game's own inheritance rules.`,
    px + pw / 2,
    GL_H - 32,
    "rgba(255,255,255,0.5)",
    "12px Arial",
    "center",
  );
}

function drawGeneLab(c) {
  if (!geneLabOpen) return;
  // Only on the screen pass of drawUI (see drawFamilyTree)
  if (typeof ctx !== "undefined" && c !== ctx) return;
  // The chosen fluffies might have died or been sold
  if (geneLabMotherId !== null && !fluffies.some((f) => f.id === geneLabMotherId && f.isAlive)) {
    geneLabMotherId = null;
    geneLabFatherId = null;
  }

  const { s, ox, oy } = _glOrigin();
  const m = _glMouse();
  c.save();
  c.globalAlpha = 1;
  c.textBaseline = "alphabetic";
  c.setLineDash([]);
  c.fillStyle = "rgba(0,0,0,0.6)";
  c.fillRect(0, 0, width, height);
  c.translate(ox, oy);
  c.scale(s, s);
  c.fillStyle = "rgb(16, 22, 28)";
  _glRoundRect(c, 0, 0, GL_W, GL_H, 14);
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.4)";
  c.lineWidth = 2;
  c.stroke();

  drawGeneLabMachine(c, 60, 62, 0.42, typeof timePlayed === "number" ? timePlayed : 0);
  _glText(c, "Gene Lab", 96, 46, "white", "bold 28px Arial");
  _glText(c, "Pick a mother and a father to see what their foals could be like.", 240, 44, "#cfcfcf", "15px Arial");

  _drawGeneLabList(c, "female", m);
  _drawGeneLabList(c, "male", m);
  _drawGeneLabPrediction(c);
  _glButton(c, GL_BUTTONS.close, m);
  c.restore();
}

// Returns true if the click was used by the lab screen
function handleGeneLabClick() {
  if (!geneLabOpen) return false;
  const m = _glMouse();
  const inRect = (b) => m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;

  if (inRect(GL_BUTTONS.close)) {
    closeGeneLab();
    return true;
  }
  for (const gender of ["female", "male"]) {
    for (const r of _geneLabVisibleRows(gender)) {
      if (!inRect(r)) continue;
      if (gender === "female") {
        if (geneLabMotherId !== r.id) {
          geneLabMotherId = r.id;
          // Expecting? Show her current litter straight away
          const mom = r.fluffy;
          geneLabFatherId = mom.isPregnant && Array.isArray(mom.fatherGenes) ? "PREGNANCY" : geneLabFatherId === "PREGNANCY" ? null : geneLabFatherId;
          geneLabPages.male = 0;
        }
      } else {
        geneLabFatherId = r.id;
      }
      return true;
    }
    const pages = _geneLabPageCount(gender);
    if (pages > 1) {
      const btns = _geneLabPageButtons(gender);
      if (inRect(btns.prev)) {
        geneLabPages[gender] = Math.max(0, geneLabPages[gender] - 1);
        return true;
      }
      if (inRect(btns.next)) {
        geneLabPages[gender] = Math.min(pages - 1, geneLabPages[gender] + 1);
        return true;
      }
    }
  }
  if (m.x < 0 || m.y < 0 || m.x > GL_W || m.y > GL_H) closeGeneLab();
  return true;
}
