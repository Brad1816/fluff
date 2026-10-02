// ---------------------------------------------------------------------------
// The Gene Lab's planner: say what you want, and it finds who can give it.
//
// "Planner" (top of the Gene Lab) swaps the mother/father lists for a set of
// targets - type (earthy, unicorn, pegasus, alicorn), coat colour, mane
// colour, pattern (spots, stripes, gradient) and mane (fancy, rainbow); one
// pick per group, tap again to clear. Then it lists:
//   - Have now: your fluffies that already look like that
//   - Best pairs: every grown mare x stallion of yours, by the chance a foal
//     of theirs has everything you picked - worked out with the game's own
//     inheritance (HorseGenetics.combineGenes) from PLAN_SAMPLES pretend
//     foals each, a few pairs a frame so the screen doesn't freeze; with how
//     many are born alive and whether they're kin (Kinship.js)
// Tap a pair to look at it in the normal lab view.
// ---------------------------------------------------------------------------

const PLAN_SAMPLES = 160;
const PLAN_PAIRS_PER_FRAME = 4;
const PLAN_COLOURS = [
  ["wite", "White"],
  ["bwack", "Black"],
  ["gway", "Grey"],
  ["bwown", "Brown"],
  ["wed", "Red"],
  ["owange", "Orange"],
  ["yewwow", "Yellow"],
  ["gween", "Green"],
  ["bwue", "Blue"],
  ["puwpuw", "Purple"],
  ["pink", "Pink"],
];
const PLAN_GROUPS = [
  { key: "type", name: "Type", opts: [["earthy", "Earthy"], ["unicorn", "Unicorn"], ["pegasus", "Pegasus"], ["alicorn", "Alicorn"]] },
  { key: "coat", name: "Coat", opts: PLAN_COLOURS },
  { key: "mane", name: "Mane colour", opts: PLAN_COLOURS },
  { key: "pattern", name: "Pattern", opts: [["spots", "Spots"], ["stripes", "Stripes"], ["gradient", "Gradient"]] },
  { key: "fancy", name: "Fancy mane", opts: [["fancy", "Any fancy"], ["rainbow", "Rainbow"]] },
];

let genePlannerOn = false;
let genePlan = {}; // group key -> option key
let _planJob = null; // { key, pairs, i, results, have }

function _planColourName(rgb) {
  try {
    return HorseGenetics.prototype.getColorName.call({ horse: { colors: { body: rgb } } });
  } catch (e) {
    return "";
  }
}

// Does a set of genes have everything in the plan?
function genesMatchPlan(genes, plan = genePlan) {
  const d = typeof describeGenes === "function" ? describeGenes(genes) : null;
  if (!d) return false;
  if (plan.type && _labTypeOf(d) !== plan.type) return false;
  if (plan.coat && _planColourName(d.body) !== plan.coat) return false;
  if (plan.mane && _planColourName(d.mane) !== plan.mane) return false;
  if (plan.pattern && d[plan.pattern] !== 4) return false;
  if (plan.fancy === "fancy" && !d.manePattern) return false;
  if (plan.fancy === "rainbow" && !(d.manePattern && d.manePattern.kind === "rainbow")) return false;
  return true;
}

function _planKey() {
  const ids = fluffies.filter((f) => f.isAlive && f.adopted && f.growth >= 1).map((f) => f.id).join(",");
  return JSON.stringify(genePlan) + "|" + ids;
}

function _planStart() {
  const grown = (g) => fluffies.filter((f) => f.isAlive && f.adopted && f.gender === g && f.growth >= 1);
  const pairs = [];
  for (const m of grown("female")) for (const d of grown("male")) pairs.push([m, d]);
  _planJob = {
    key: _planKey(),
    pairs,
    i: 0,
    results: [],
    have: fluffies.filter((f) => f.isAlive && f.adopted && genesMatchPlan(f.genes)),
  };
}

// A few more pairs (called while drawing)
function _planWork(maxPairs = PLAN_PAIRS_PER_FRAME) {
  if (!Object.keys(genePlan).length) {
    _planJob = null;
    return;
  }
  if (!_planJob || _planJob.key !== _planKey()) _planStart();
  const J = _planJob;
  const realRandom = Math.random;
  try {
    for (let n = 0; n < maxPairs && J.i < J.pairs.length; n++, J.i++) {
      const [mom, dad] = J.pairs[J.i];
      Math.random = _labRandom((mom.id + 1) * 7919 + (dad.id + 1) * 104729 + 17);
      let hit = 0;
      for (let k = 0; k < PLAN_SAMPLES; k++) {
        const genes = HorseGenetics.prototype.combineGenes.call({ horse: { genes: mom.genes } }, dad.genes);
        if (genesMatchPlan(genes)) hit++;
      }
      Math.random = realRandom;
      const kin = typeof relatedness === "function" ? relatedness(mom, dad) : 0;
      let alive = typeof geneLabViability === "function" ? geneLabViability(mom.genes, dad.genes) : 1;
      if (typeof INBRED_KIN === "number" && kin >= INBRED_KIN) alive += (1 - alive) * INBRED_PULL_THROUGH;
      J.results.push({ mom, dad, chance: hit / PLAN_SAMPLES, alive, kin });
    }
  } finally {
    Math.random = realRandom;
  }
}

// Run it all now (tests)
function runGenePlan() {
  _planWork(1e9);
  return _planJob;
}

// ---- Layout and drawing (inside the Gene Lab, its own coordinates) ----

function genePlannerLayout() {
  const chips = [];
  let y = 120;
  for (const g of PLAN_GROUPS) {
    let x = 30;
    const rowStart = y;
    for (const [key, label] of g.opts) {
      const w = Math.max(64, 18 + label.length * 8.5);
      if (x + w > 510) {
        x = 30;
        y += 38;
      }
      chips.push({ group: g.key, key, label, x, y: y + 18, w, h: 32 });
      x += w + 6;
    }
    g._y = rowStart;
    y += 38 + 26;
  }
  return { chips, clear: { x: 30, y: Math.min(GL_H - 70, y + 6), w: 120, h: 34 }, results: { x: 540, y: 110, w: GL_W - 560, h: GL_H - 160 } };
}

function _planRows() {
  if (!_planJob) return [];
  return _planJob.results
    .filter((r) => r.chance > 0)
    .sort((a, b) => b.chance * (0.5 + 0.5 * b.alive) - a.chance * (0.5 + 0.5 * a.alive))
    .slice(0, 10);
}

function drawGenePlanner(c, m) {
  _planWork();
  const L = genePlannerLayout();
  canvasText(c, "What do you want? Pick from any group (tap again to clear).", 30, 100, "#cfcfcf", "14px Arial");
  for (const g of PLAN_GROUPS) canvasText(c, g.name, 30, g._y + 10, "#f7d774", "bold 13px Arial");
  for (const ch of L.chips) {
    const on = genePlan[ch.group] === ch.key;
    const over = m.x >= ch.x && m.x <= ch.x + ch.w && m.y >= ch.y && m.y <= ch.y + ch.h;
    c.fillStyle = on ? "rgba(60, 150, 110, 0.95)" : over ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)";
    roundRectPath(c, ch.x, ch.y, ch.w, ch.h, 8);
    c.fill();
    canvasText(c, (on ? "✓ " : "") + ch.label, ch.x + ch.w / 2, ch.y + 21, "white", "13px Arial", "center");
  }
  _glButton(c, { ...L.clear, label: "Clear" }, m, !Object.keys(genePlan).length);
  // Results
  const R = L.results;
  c.fillStyle = "rgba(255,255,255,0.05)";
  roundRectPath(c, R.x, R.y - 10, R.w, R.h, 10);
  c.fill();
  let y = R.y + 18;
  if (!Object.keys(genePlan).length) {
    canvasText(c, "Pick what you're after on the left.", R.x + 20, y, "rgba(255,255,255,0.6)", "15px Arial");
    return;
  }
  const J = _planJob;
  canvasText(c, "HAVE NOW", R.x + 20, y, "#f7d774", "bold 13px Arial");
  y += 20;
  const have = J ? J.have : [];
  const haveText = have.length ? have.slice(0, 6).map((f) => fluffyDisplayNameById(f.id)).join(", ") + (have.length > 6 ? ` and ${have.length - 6} more` : "") : "None of yours looks like that yet.";
  for (const line of typeof wrapText === "function" ? wrapText(c, haveText, R.w - 40) : [haveText]) {
    canvasText(c, line, R.x + 20, y, have.length ? "#7dff8a" : "rgba(255,255,255,0.6)", "14px Arial");
    y += 18;
  }
  y += 14;
  const done = J ? J.i >= J.pairs.length : false;
  canvasText(c, done ? "BEST PAIRS (chance each foal has all of it)" : `BEST PAIRS - working it out... ${J ? J.i : 0}/${J ? J.pairs.length : 0}`, R.x + 20, y, "#f7d774", "bold 13px Arial");
  y += 8;
  const rows = _planRows();
  if (J && !J.pairs.length) {
    canvasText(c, "You need a grown mare and a grown stallion.", R.x + 20, y + 22, "rgba(255,255,255,0.6)", "14px Arial");
  } else if (done && !rows.length) {
    canvasText(c, "None of your pairs can give that. Look for fluffies that", R.x + 20, y + 22, "rgba(255,255,255,0.7)", "14px Arial");
    canvasText(c, "carry it (the shelter, breeding stock) - or pick less.", R.x + 20, y + 40, "rgba(255,255,255,0.7)", "14px Arial");
  }
  for (const r of rows) {
    const ry = y + 10;
    if (ry + 38 > R.y - 10 + R.h - 6) {
      r._box = null; // (no room left in the panel)
      continue;
    }
    const box = { x: R.x + 14, y: ry, w: R.w - 28, h: 38 };
    r._box = box;
    const over = m.x >= box.x && m.x <= box.x + box.w && m.y >= box.y && m.y <= box.y + box.h;
    c.fillStyle = over ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)";
    roundRectPath(c, box.x, box.y, box.w, box.h, 8);
    c.fill();
    const pct = r.chance >= 0.1 ? Math.round(r.chance * 100) : Math.round(r.chance * 1000) / 10;
    canvasText(c, `${pct}%`, box.x + 12, ry + 25, r.chance >= 0.25 ? "#7dff8a" : r.chance >= 0.08 ? "#ffe066" : "#ffb86b", "bold 17px Arial");
    let names = `${fluffyDisplayNameById(r.mom.id)} ♀ + ${fluffyDisplayNameById(r.dad.id)} ♂`;
    c.font = "14px Arial";
    while (names.length > 8 && c.measureText(names).width > box.w - 260) names = names.slice(0, -2);
    canvasText(c, names, box.x + 76, ry + 24, "white", "14px Arial");
    const note = `${Math.round(r.alive * 100)}% alive${r.kin >= (typeof INBRED_KIN === "number" ? INBRED_KIN : 0.125) ? " · kin!" : ""}`;
    canvasText(c, note, box.x + box.w - 12, ry + 24, r.kin >= 0.125 ? "#ffb86b" : "#cfcfcf", "13px Arial", "right");
    y += 44;
  }
}

// A click in planner mode (lab coordinates). True if used.
function handleGenePlannerClick(m) {
  const L = genePlannerLayout();
  const inRect = (b) => b && m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;
  for (const ch of L.chips) {
    if (!inRect(ch)) continue;
    if (genePlan[ch.group] === ch.key) delete genePlan[ch.group];
    else genePlan[ch.group] = ch.key;
    return true;
  }
  if (inRect(L.clear)) {
    genePlan = {};
    return true;
  }
  for (const r of _planRows()) {
    if (!inRect(r._box)) continue;
    // Look at this pair in the lab
    geneLabMotherId = r.mom.id;
    geneLabFatherId = r.dad.id;
    genePlannerOn = false;
    return true;
  }
  return false;
}
