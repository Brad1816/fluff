// ---------------------------------------------------------------------------
// Upbringing: foals pick up the views of whoever raises them.
//
// A foal's colour prejudice starts from its genes (Horse.js,
// calculateColorismPerception) and its fear of alicorns starts at nothing
// learnt. While it's growing up (growth < 1), it copies the grown-ups
// around it (same room, within UPBRINGING_RANGE), drifting towards their
// views:
//   - its mum (motherId - a mare that adopted it counts): weight 1
//   - its dad (fatherId): weight 0.5
//   - any other grown fluffy nearby: weight 0.15 each
// The drift is towards the weighted average of their views, at
// UPBRINGING_RATE a second times how much influence there is (capped at 1,
// so a foal with its mum around copies at the full rate). A foal that spends
// all of its foalhood (about 2 months, GROW_UP_TIME) with its mum ends up close to
// her views - so a mare you've talked out of colour prejudice (Lessons.js)
// raises tolerant foals, and a prejudiced one raises prejudiced foals.
//
// What's copied:
//   - colour views (coloristDegree), when World Colorism is on
//   - how it feels about alicorns (alicornComfort, AlicornAcceptance.js),
//     when World Alicorn Intolerance is on. A foal of a mare that fully
//     accepts alicorns ends up accepting them too.
//   - its fears of thunder, the dark and the Fluff-Bot (Fears.js)
// Lessons on the foal still work, but a prejudiced mum keeps pulling it back
// - it's best to teach mum first.
//
// Shown in the magnifying glass (Looks & nature, "Growing up") for foals.
// ---------------------------------------------------------------------------

const UPBRINGING_RATE = 1.68 / GROW_UP_TIME; // a second: about 80% of the way over a whole foalhood
const UPBRINGING_RANGE = 600;
const UPBRINGING_WEIGHTS = { mum: 1, dad: 0.5, other: 0.15 };

const upbringingTicker = new Ticker(1);

// Who this foal is learning from right now: [{ f, weight, who }]
function upbringingInfluences(f) {
  if (!f || !f.isAlive || !(f.growth < 1)) return [];
  const out = [];
  for (const o of fluffies) {
    if (o === f || !o.isAlive || o.growth < 1 || o.scene !== f.scene) continue;
    if (Math.hypot(o.x - f.x, o.y - f.y) > UPBRINGING_RANGE) continue;
    let who = "other";
    if (f.motherId !== null && f.motherId !== undefined && o.id === f.motherId) who = "mum";
    else if (f.fatherId !== null && f.fatherId !== undefined && o.id === f.fatherId) who = "dad";
    out.push({ f: o, weight: UPBRINGING_WEIGHTS[who], who });
  }
  // Something else raising it (the formula mummah: ArtificialMummah.js)
  if (typeof UPBRINGING_SOURCES !== "undefined") for (const src of UPBRINGING_SOURCES) out.push(...(src(f) || []));
  return out;
}

function _upAverage(list, view) {
  let sum = 0;
  let w = 0;
  for (const i of list) {
    sum += view(i.f) * i.weight;
    w += i.weight;
  }
  return w > 0 ? { target: sum / w, weight: w } : null;
}

function _upColours() {
  return typeof worldSettings === "undefined" || !!worldSettings.colorism;
}
function _upAlicorns() {
  return typeof _alicornIntoleranceOn === "function" ? _alicornIntoleranceOn() : false;
}

// One step of copying (seconds)
function applyUpbringing(f, seconds) {
  const list = upbringingInfluences(f);
  if (!list.length) return false;
  let changed = false;
  if (_upColours()) {
    const a = _upAverage(list, (o) => Math.max(0, Math.min(1, o.coloristDegree || 0)));
    if (a) {
      const k = Math.min(1, UPBRINGING_RATE * seconds * Math.min(1, a.weight));
      const now = f.coloristDegree || 0;
      f.coloristDegree = Math.max(0, Math.min(1, now + (a.target - now) * k));
      changed = true;
    }
  }
  if (_upAlicorns() && typeof getAlicornComfort === "function" && !(f.tolerantOfAlicorns && f.tolerantOfAlicorns())) {
    const a = _upAverage(list, (o) => getAlicornComfort(o));
    if (a) {
      const k = Math.min(1, UPBRINGING_RATE * seconds * Math.min(1, a.weight));
      const now = getAlicornComfort(f);
      let next = Math.max(0, Math.min(1, now + (a.target - now) * k));
      // Close enough to a mum that fully accepts them: it does too
      if (a.target >= 0.999 && next >= 0.75) next = 1;
      if (next >= 1 && typeof acceptAlicorns === "function") acceptAlicorns(f);
      else f.alicornComfort = next;
      changed = true;
    }
  }
  // What life did to its raisers, a little of it (Personality.js)
  if (typeof TRAITS !== "undefined" && typeof UPBRINGING_SHIFT_SHARE !== "undefined") {
    for (const t of TRAITS) {
      const a = _upAverage(list, (o) => ((o.traitShift && o.traitShift[t.key]) || 0) * UPBRINGING_SHIFT_SHARE);
      if (!a || Math.abs(a.target) < 0.001) continue;
      if (!f.traitShift || typeof f.traitShift !== "object") f.traitShift = {};
      const k = Math.min(1, UPBRINGING_RATE * seconds * Math.min(1, a.weight));
      const now = f.traitShift[t.key] || 0;
      f.traitShift[t.key] = now + (a.target - now) * k;
      changed = true;
    }
  }
  // Fears (Fears.js): scared grown-ups raise scared foals
  if (typeof FEARS !== "undefined" && typeof fearsOf === "function") {
    const mine = fearsOf(f);
    for (const fe of FEARS) {
      const a = _upAverage(list, (o) => fearOf(o, fe.key));
      if (!a) continue;
      const k = Math.min(1, UPBRINGING_RATE * seconds * Math.min(1, a.weight));
      mine[fe.key] = Math.max(0, Math.min(1, mine[fe.key] + (a.target - mine[fe.key]) * k));
    }
    changed = true;
  }
  return changed;
}

function updateUpbringing(dt) {
  const step = upbringingTicker.step(dt);
  if (!step) return;
  for (const f of fluffies) {
    if (!f.isAlive || !(f.growth < 1)) continue;
    applyUpbringing(f, step);
  }
}
registerSystem("upbringing", updateUpbringing, 132);

// Magnifying glass row for foals: [text, tone] or null
function describeUpbringing(f) {
  if (!f || !f.isAlive || !(f.growth < 1)) return null;
  const list = upbringingInfluences(f);
  const main = list.find((i) => i.who === "mum") || list.find((i) => i.who === "dad") || list.find((i) => i.who === "machine");
  const nameOf = (o) => (typeof fluffyDisplayName === "function" ? fluffyDisplayName(o) : "its parent");
  if (!list.length) return ["No grown-ups around to learn from", ""];
  const from = main ? (main.who === "machine" ? "the formula mummah" : `${main.who === "mum" ? "Mum" : "Dad"} (${nameOf(main.f)})`) : "the grown-ups nearby";
  if (!_upColours()) return [`Learning from ${from}`, ""];
  const a = _upAverage(list, (o) => Math.max(0, Math.min(1, o.coloristDegree || 0)));
  if (a.target < 0.2) return [`Learning from ${from}: kind to every colour`, "good"];
  if (a.target < 0.6) return [`Learning from ${from}: a bit picky about colours`, "ok"];
  return [`Learning from ${from}: mean to poopie fluffies`, "bad"];
}
