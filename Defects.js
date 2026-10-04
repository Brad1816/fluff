// ---------------------------------------------------------------------------
// Hereditary defects (from the "Guide to Birth Defects & Diseases"): rare
// recessive genes that run in families. A fluffy with one copy is a hidden
// carrier; a foal of two carriers has a one-in-four chance of getting two
// copies - and the defect.
//
//   dummy  a "dummy foal": grunts instead of chirping and can't nurse from
//          a mare (a bottle or feeder still works, if you're there), and
//          grows up simple-minded (the "dim" deformity, Inbreeding.js)
//   shaky  shaky legs: once it walks it stumbles and falls over now and
//          then, walks slower, and often misses the litterbox. For life.
//
// f.defectGenes (saved) { dummy: 0..2, shaky: 0..2 } copies. A fluffy that
// turns up from nowhere (bought, wild, a can) is a carrier of each with
// DEFECT_CARRIER chance; a foal gets one copy from each parent at random
// (mum's own, and the sire's kept at conception: f.sireDefects, saved -
// HorseAnatomy.triggerPregnancy). Close kin breeding brings them out.
// The DNA test (the vet's breeding advice, DNA_TEST_PRICE) shows a fluffy's
// carrier genes (f.dnaTested, saved) in the magnifying glass, and the vet's
// pair advice then warns of the odds for a pair that's both been tested.
// ---------------------------------------------------------------------------

const DEFECTS = {
  dummy: { name: "dummy foal", carrier: "the dummy-foal gene" },
  shaky: { name: "shaky legs", carrier: "the shaky-legs gene" },
};
const DEFECT_CARRIER = 0.06; // each defect, a fluffy from nowhere
const DNA_TEST_PRICE = 40;
const SHAKY_FALL = 0.012; // a second
const SHAKY_SPEED = 0.8;
const SHAKY_MISS = 0.5; // of litterbox trips
const defectsTicker = new Ticker(1);

function _dfGenes(f) {
  if (!f.defectGenes || typeof f.defectGenes !== "object") {
    // Turned up from nowhere: maybe a carrier
    f.defectGenes = {};
    for (const k in DEFECTS) f.defectGenes[k] = Math.random() < DEFECT_CARRIER ? 1 : 0;
  }
  return f.defectGenes;
}

function hasDefect(f, key) {
  return !!f && !!f.defectGenes && (f.defectGenes[key] || 0) >= 2;
}

function carriesDefect(f, key) {
  return !!f && !!f.defectGenes && (f.defectGenes[key] || 0) === 1;
}

// HorseAnatomy.triggerPregnancy: what the sire will pass on
function noteSireDefects(mare, father) {
  if (!mare || !father) return;
  mare.sireDefects = { ..._dfGenes(father) };
}

function _pass(copies) {
  return Math.random() < (copies || 0) / 2 ? 1 : 0;
}

// HorseAnatomy.spawnBaby (via onFoalBorn): one copy from each parent
function inheritDefects(baby, mum) {
  if (!baby || !mum) return;
  const m = _dfGenes(mum);
  const d = mum.sireDefects || {};
  baby.defectGenes = {};
  for (const k in DEFECTS) baby.defectGenes[k] = _pass(m[k]) + _pass(d[k]);
  if (hasDefect(baby, "dummy")) {
    if (!Array.isArray(baby.deformities)) baby.deformities = [];
    if (!baby.deformities.includes("dim")) baby.deformities.push("dim");
  }
}

// HorseFamily.attemptFeedFromMare: a dummy foal can't nurse
function cantNurse(f) {
  return hasDefect(f, "dummy") && f.growth < 1;
}

// Horse.updateSpeed
function defectSpeed(f) {
  return hasDefect(f, "shaky") && !f.tooYoungToWalk() ? SHAKY_SPEED : 1;
}

// HorseBrain UseLitterboxDesire: shaky legs often don't get there
function missesLitterbox(f) {
  return hasDefect(f, "shaky") && Math.random() < SHAKY_MISS;
}

function updateDefects(dt) {
  const step = defectsTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    _dfGenes(f);
    if (!hasDefect(f, "shaky") || f.tooYoungToWalk() || f.isDragging || f.placedOn || f.currentStateKey === "SLEEPING") continue;
    if (f.isMovingOrRunning() && Math.random() < SHAKY_FALL * step * 3) {
      f.initBehavior("FLUFFY_KNOCKED_DOWN");
      if (!f.tooYoungToSpeak() && Math.random() < 0.4) f.speak(getDialogue(["DEFECT", "SHAKY_FALL"], f));
    }
  }
}
registerSystem("defects", updateDefects, 151);

// The vet's DNA test
function dnaTest(f) {
  if (!f || f.dnaTested) return false;
  const price = typeof vetPrice === "function" ? vetPrice(DNA_TEST_PRICE, "check") : DNA_TEST_PRICE;
  if (typeof money === "number" && money < price) {
    if (typeof addUIMessage === "function") addUIMessage(`A DNA test is $${price}.`);
    return false;
  }
  if (typeof money === "number") money -= price;
  f.dnaTested = true;
  const g = _dfGenes(f);
  const found = Object.keys(DEFECTS).filter((k) => (g[k] || 0) > 0).map((k) => ((g[k] || 0) >= 2 ? `has ${DEFECTS[k].name}` : `carries ${DEFECTS[k].carrier}`));
  if (typeof addUIMessage === "function") addUIMessage(`DNA test: ${fluffyDisplayName(f)} ${found.length ? found.join(" and ") : "carries no hidden defects"}.`);
  return true;
}

// Kinship.pairAdvice: the odds of a defect for two tested fluffies, or null
function defectRisk(mom, dad) {
  if (!mom || !dad || !mom.dnaTested || !dad.dnaTested) return null;
  const a = _dfGenes(mom);
  const b = _dfGenes(dad);
  let worst = null;
  for (const k in DEFECTS) {
    const p = ((a[k] || 0) / 2) * ((b[k] || 0) / 2);
    if (p > 0 && (!worst || p > worst.p)) worst = { key: k, p, name: DEFECTS[k].name };
  }
  return worst;
}

// Magnifying glass: [text, tone]
function describeDefect(f) {
  if (!f) return null;
  const has = Object.keys(DEFECTS).filter((k) => hasDefect(f, k));
  if (has.length) return [has.map((k) => DEFECTS[k].name).join(", ") + " (hereditary)", "bad"];
  if (f.dnaTested) {
    const carries = Object.keys(DEFECTS).filter((k) => carriesDefect(f, k));
    return carries.length ? [`Carrier: ${carries.map((k) => DEFECTS[k].carrier).join(", ")} (DNA tested)`, "ok"] : ["No hidden defects (DNA tested)", "good"];
  }
  return null;
}
