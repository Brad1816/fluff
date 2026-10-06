// ---------------------------------------------------------------------------
// Pregnancy and foal care: how well a mare is looked after while she's
// pregnant decides how her litter turns out.
//
// Litter size (plannedLitterSize, at conception - HorseAnatomy
// triggerPregnancy): runs in families. Every foal remembers the size of the
// litter it was born in (f.litterBorn); a pairing's expected litter is half
// LITTER_BASE, half the average of mum's and dad's (when known). Seniors
// have about one foal fewer. Then some chance either way (1-10).
//
// Big litters are hard on her (lore): carrying more than BIG_LITTER_FROM
// foals, each one more adds BIG_LITTER_RISK to the chance she miscarries
// some time in her pregnancy (bigLitterMiscarriageChance - 6 foals 12%,
// 10 foals 36%; good care takes a little off). Checked a bit at a time in
// updatePregnancyCare; the miscarriage itself is HorseMating
// beginMiscarriage (early labour - Premature.js decides how the foals do).
//
// Care (updatePregnancyCare, every PREG_CARE_EVERY seconds while she's
// pregnant): a running average of how she's doing - fed, happy, healthy,
// rested, not scared of you (pregnancyCareScore, 0..1). Shown in the
// magnifying glass and at the vet.
//
// When labour starts (onLabourStarts - HorseUpdate _updatePregnancy):
//   - poor care (under CARE_OK) loses foals before birth,
//   - bad care (under CARE_RISKY) makes stillbirths more likely,
//   - each birth costs her health (birthHealthCost): 15 with great care,
//     25 with none; x2 for a stillbirth; a midwife from the vet halves it
//     and won't let her die.
// Each foal (onFoalBorn - HorseAnatomy spawnBaby) gets f.birthVigor
// (0.7-1.2) from mum's care: weak foals start below full health, and vigor
// and milk/food (foalGrowthRate) set how fast foals grow up.
//
// Saved with each fluffy (SAVED_HORSE_FIELDS): pregCare, litterSize,
// litterBorn, birthVigor, midwife, pregScan, litterCareAt, litterLost.
// ---------------------------------------------------------------------------

const LITTER_BASE = 4;
const LITTER_SPREAD = 1.6;
const LITTER_MAX = 10;
const BIG_LITTER_FROM = 4; // more foals than this, more risk
const BIG_LITTER_RISK = 0.06; // per foal over, across the whole pregnancy
const PREG_CARE_EVERY = 2; // seconds
const CARE_OK = 0.65; // below this she may lose foals
const CARE_RISKY = 0.5; // below this, stillbirths get more likely
const pregnancyCareTicker = new Ticker(PREG_CARE_EVERY);

function _gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---- Litter size (runs in families) ----

function inheritedLitterMean(mare, sire = null) {
  const known = [mare && mare.litterBorn, sire && sire.litterBorn].filter((n) => typeof n === "number" && n > 0);
  let mean = LITTER_BASE;
  if (known.length) mean = 0.5 * LITTER_BASE + (0.5 * known.reduce((s, n) => s + n, 0)) / known.length;
  const stage = typeof lifeStage === "function" ? lifeStage(mare) : "adult";
  if (stage === "senior" || stage === "elderly") mean -= 1;
  return mean;
}

// HorseAnatomy.triggerPregnancy
function plannedLitterSize(mare, sire = null) {
  const n = Math.round(inheritedLitterMean(mare, sire) + _gauss() * LITTER_SPREAD);
  return Math.max(1, Math.min(LITTER_MAX, n));
}

// The chance a pregnancy this big ends in a miscarriage (0..0.5)
function bigLitterMiscarriageChance(f) {
  const n = (f && f.babiesToBirth) || 0;
  if (n <= BIG_LITTER_FROM) return 0;
  const care = pregnancyCareScore(f); // (0.7 when nothing's been seen yet)
  return Math.min(0.5, BIG_LITTER_RISK * (n - BIG_LITTER_FROM) * (1.2 - 0.4 * care));
}

// ---- Care during pregnancy ----

// How she's doing right now, 0..1
function pregnancyConditionNow(f) {
  const fed = Math.min(1, (f.hunger ?? 1) / 0.7);
  const happy = Math.max(0, Math.min(1, f.happiness ?? 0.6));
  const health = Math.max(0, Math.min(1, (f.health ?? 100) / 100));
  const rested = 1 - Math.max(0, Math.min(1, f.sleepDeprivation || 0));
  const calm = 1 - Math.max(0, Math.min(1, f.playerFear || 0));
  // Eating well helps her and the foals (Diet.js)
  const diet = typeof dietGrowthMultiplier === "function" ? dietGrowthMultiplier(f) : 1;
  return Math.min(1, (0.3 * fed + 0.25 * happy + 0.25 * health + 0.1 * rested + 0.1 * calm) * diet);
}

// The average over her pregnancy so far (0.7 if nothing's been seen yet)
function pregnancyCareScore(f) {
  const c = f && f.pregCare;
  if (!c || !c.n) return 0.7;
  return c.sum / c.n;
}

function describeCare(c) {
  if (c >= 0.8) return ["Great", "good"];
  if (c >= CARE_OK) return ["Good", "good"];
  if (c >= CARE_RISKY) return ["Fair", "ok"];
  return ["Poor", "bad"];
}

function startPregnancyCare(f) {
  f.pregCare = { sum: 0, n: 0 };
  f.pregScan = null;
  f.midwife = false;
}

// Systems.js, every 2 seconds
function updatePregnancyCare(dt) {
  if (!pregnancyCareTicker.step(dt)) return;
  for (const f of fluffies) {
    if (!f.isAlive || !f.isPregnant || f.isPregnancyDue()) continue;
    if (!f.pregCare || typeof f.pregCare !== "object") f.pregCare = { sum: 0, n: 0 };
    f.pregCare.sum += pregnancyConditionNow(f);
    f.pregCare.n += 1;
    // Too many in there: she may lose them (spread over the pregnancy)
    const risk = bigLitterMiscarriageChance(f);
    if (risk > 0 && (f.miscarriageTimer === null || f.miscarriageTimer === undefined)) {
      const perCheck = 1 - Math.pow(1 - risk, PREG_CARE_EVERY / pregnancyDuration);
      if (Math.random() < perCheck) f.beginMiscarriage();
    }
  }
}

// ---- Labour and birth ----

// HorseUpdate._updatePregnancy, when her time comes
function onLabourStarts(mare) {
  const c = pregnancyCareScore(mare);
  let n = mare.babiesToBirth > 0 ? mare.babiesToBirth : plannedLitterSize(mare);
  const viability = Array.isArray(mare.foalViability) ? mare.foalViability.slice() : [];
  while (viability.length < n) viability.push(!mare._aborted); // (ended with Foal-B-Gone: none live)
  mare._aborted = false;
  // Poor care: some foals are lost before birth
  let lost = 0;
  if (c < CARE_OK) lost = Math.min(n - 1, Math.floor((CARE_OK - c) * 4 + Math.random()));
  n -= lost;
  const out = viability.slice(0, n);
  // Bad care: stillbirths more likely
  if (c < CARE_RISKY) {
    for (let i = 0; i < out.length; i++) if (out[i] && Math.random() < (CARE_RISKY - c) * 0.6) out[i] = false;
  }
  mare.babiesToBirth = n;
  mare.foalViability = out;
  mare.litterSize = n;
  mare.litterCareAt = c;
  mare.litterLost = lost;
}

// Health each birth costs her
function birthHealthCost(mare, viable) {
  const c = mare.litterCareAt ?? pregnancyCareScore(mare);
  let cost = 20 * (1.25 - 0.5 * c);
  if (!viable) cost *= 2;
  if (mare.midwife) cost *= 0.5;
  return cost;
}

// After a birth: can she die of it? (a midwife won't let her)
function applyBirthHealthCost(mare, viable) {
  const floor = mare.midwife ? 10 : 0;
  mare.health = Math.max(Math.min(mare.health, floor), mare.health - birthHealthCost(mare, viable));
  return mare.health <= 0;
}

// HorseAnatomy.spawnBaby, for each foal
function onFoalBorn(mare, baby, viable) {
  baby.litterBorn = mare.litterSize || null;
  if (typeof inheritDefects === "function") inheritDefects(baby, mare); // (Defects.js)
  // Born to one of your mares: "Bred by you" for commissions (Commissions.js)
  baby.bredHere = !!mare.adopted;
  if (typeof onBabyBornHooks === "function") onBabyBornHooks(mare, baby, viable); // (Wild.js, Coats.js)
  if (!viable) return;
  const c = mare.litterCareAt ?? pregnancyCareScore(mare);
  baby.birthVigor = Math.max(0.7, Math.min(1.2, 0.7 + 0.5 * c + (Math.random() - 0.5) * 0.1));
  if (baby.birthVigor < 0.85) baby.health = Math.round(100 * (0.4 + 0.5 * baby.birthVigor));
}

// When the last foal is born
function onLitterFinished(mare) {
  const born = fluffies.filter((f) => f.motherId === mare.id && f.growth < 0.05);
  const alive = born.filter((f) => f.isAlive).length;
  const dead = born.length - alive;
  const c = mare.litterCareAt ?? 0.7;
  if (mare.adopted && typeof addUIMessage === "function") {
    const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(mare) : "Your mare";
    let text = `${name} had ${alive} foal${alive === 1 ? "" : "s"}`;
    if (dead) text += ` (${dead} stillborn)`;
    if (c >= 0.8) text += ". She was well looked after: strong foals.";
    else if (c < CARE_RISKY) text += ". A hard pregnancy: weak foals, and she lost some.";
    else if (mare.litterLost) text += `. She lost ${mare.litterLost} before birth - better care next time.`;
    else text += ".";
    addUIMessage(text);
  }
  mare.midwife = false;
  mare.pregScan = null;
  mare.pregCare = null;
}

// ---- Growing up ----

// HorseUpdate._updateGrowingUp: how fast a foal grows (1 = normal)
function foalGrowthRate(f) {
  if (!f || f.growth >= 1) return 1;
  const vigor = Math.max(0.8, Math.min(1.15, f.birthVigor ?? 1));
  const h = f.hunger ?? 1;
  const fed = h >= 0.6 ? 1.05 : h >= 0.3 ? 1 : h >= 0.1 ? 0.75 : 0.5;
  // Good food, faster growing (Diet.js)
  const diet = typeof dietGrowthMultiplier === "function" ? dietGrowthMultiplier(f) : 1;
  // A runt grows slower (Runts.js)
  const runt = typeof runtGrowthRate === "function" ? runtGrowthRate(f) : 1;
  return vigor * fed * diet * runt;
}

// ---- What you see ----

function pregnancyMinutesLeft(f) {
  return Math.max(0, Math.ceil((f.pregnancyTimer || 0) / 60));
}

// Magnifying glass "Pregnant" row: [text, tone]
function describePregnancy(f) {
  if (!f.isPregnant) return ["No", ""];
  if (f.isPregnancyDue()) return ["Giving birth", "ok"];
  const [care, tone] = describeCare(pregnancyCareScore(f));
  const scan = f.pregScan ? ` · expecting ${f.pregScan.count}` : "";
  return [`Due in ${pregnancyMinutesLeft(f)} min · care: ${care}${scan}`, tone];
}

// Magnifying glass "Born" row for foals: null or [text, tone]
function describeBirth(f) {
  if (typeof f.litterBorn !== "number" && typeof f.birthVigor !== "number") return null;
  const parts = [];
  if (typeof f.litterBorn === "number") parts.push(f.litterBorn === 1 ? "an only foal" : `one of ${f.litterBorn}`);
  let tone = "";
  if (typeof f.birthVigor === "number" && f.growth < 1) {
    if (f.birthVigor < 0.85) {
      parts.push("weak (hard pregnancy)");
      tone = "bad";
    } else if (f.birthVigor >= 1.05) {
      parts.push("strong");
      tone = "good";
    }
  }
  return [parts.join(", "), tone];
}

// Would this litter be dangerous for her? (the vet's scan)
function isRiskyLitter(f) {
  if (!f.isPregnant) return false;
  const n = f.babiesToBirth || 0;
  const perBirth = 20 * (1.25 - 0.5 * pregnancyCareScore(f)) * (f.midwife ? 0.5 : 1);
  return n * perBirth >= (f.health ?? 100) - 10;
}

registerSystem("pregnancy", updatePregnancyCare, 125);

// ---- Heavy with foal, and just foaled: she hardly moves ----
// From MARE_HEAVY of the way through, and for MARE_POSTPARTUM game hours
// after giving birth, a mare shuffles at MARE_REST_SPEED (Horse.updateSpeed),
// doesn't wander (HorseBrain WanderDesire) and lies down when she's idle. She
// still goes to her bed to give birth, and to eat and use the litterbox.
const MARE_HEAVY = 0.8;
const MARE_POSTPARTUM = 3; // game hours
const MARE_REST_SPEED = 0.3; // (on top of being pregnant: x0.5)
const mareRestTicker = new Ticker(2);

function mareResting(f) {
  if (!f || f.gender !== "female" || !f.isAlive) return false;
  if (f.isPregnant && typeof f.getPregnancyProgress === "function" && f.getPregnancyProgress() >= MARE_HEAVY) return true;
  return typeof f.lastBirthAt === "number" && timePlayed - f.lastBirthAt >= 0 && timePlayed - f.lastBirthAt < MARE_POSTPARTUM * HOUR_LENGTH;
}

// Horse.updateSpeed
function mareRestSpeed(f) {
  if (!mareResting(f)) return 1;
  return f.seekingBirthBed ? 0.7 : MARE_REST_SPEED;
}

// Magnifying glass
function describeMareRest(f) {
  if (!mareResting(f)) return null;
  return f.isPregnant ? "Heavy with foal: resting, barely moves" : "Just gave birth: resting";
}

function updateMareRest(dt) {
  const step = mareRestTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  for (const f of fluffies) {
    if (!mareResting(f) || f.isDragging || f.currentCage || f.placedOn || f.seekingBirthBed) continue;
    if (f.currentStateKey === "IDLE" && Math.random() < 0.5) f.initBehavior("LYING");
  }
}
registerSystem("mareRest", updateMareRest, 126);

// ---- Ending a pregnancy (Foal-B-Gone, globals.js DRUG_METABOLISM) ----
// The foals come within MISCARRIAGE_LABOR_DELAY seconds, all stillborn
// however far along she was. It takes it out of her (the miscarriage's own
// sadness and trauma, HorseMating.beginMiscarriage). True if it took.
function abortPregnancy(f) {
  if (!f || !f.isAlive || !f.isPregnant) return false;
  const n = Math.max(1, f.babiesToBirth || (Array.isArray(f.foalViability) ? f.foalViability.length : 0) || 1);
  if (!Array.isArray(f.foalViability) || !f.foalViability.length) f.foalViability = [];
  while (f.foalViability.length < n) f.foalViability.push(false);
  f.foalViability = f.foalViability.map(() => false);
  f._aborted = true; // (onLabourStarts keeps them stillborn)
  if (typeof f.beginMiscarriage === "function") f.beginMiscarriage();
  return true;
}
