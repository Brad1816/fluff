// ---------------------------------------------------------------------------
// Foals born early. How they turn out depends on how far along their mum
// was (HorseMating.getPregnancyProgress, 0..1) when labour came:
//
//   under 40%    Too early: every foal is stillborn, and tiny.
//   40% - 65%    Very premature: most don't make it (25% survive at 40%,
//                60% at 65%). Survivors are very small, weak (low health)
//                and slow to grow.
//   65% - 90%    Premature: most make it (70% up to 95%). Small, a little
//                weak, a little slow to grow.
//   90% or more  Near enough full term: normal foals.
//
// A midwife from the vet (Pregnancy.js) gives each early foal a better
// chance (PREMATURE_MIDWIFE). A foal that would have been stillborn anyway
// (poor care: Pregnancy.js) still is.
// Small foals catch up as they grow (Horse.updateGrowthStats:
// prematureGrowth and bornEarly, saved). The magnifying glass shows
// "Born premature" and so on.
//
// What brings labour on early (HorseMating.beginMiscarriage):
//   - a stallion mating her while she's pregnant (HorseMating)
//   - a hard landing when she's thrown (Horse.handleThrowImpact): the
//     harder the fall, the likelier (PREMATURE_FALL_*)
// ---------------------------------------------------------------------------

const PREMATURE_TOO_EARLY = 0.4; // below this: all stillborn
const PREMATURE_VERY = 0.65; // below this: very premature
const PREMATURE_TERM = 0.9; // from this: a normal birth
const PREMATURE_MIDWIFE = 0.15; // extra chance each foal survives with a midwife
const PREMATURE_FALL_DAMAGE = 10; // a landing at least this hard can bring labour on...
const PREMATURE_FALL_CHANCE = 1 / 60; // ...with this chance per point of damage (max 80%)

// Which stage a birth at this progress is, with what it means for a foal:
// survive (chance), size (how small at birth: prematureGrowth), health
// and vigor (Pregnancy.js birthVigor: how fast it grows) for survivors
function prematureStage(progress) {
  const p = Math.max(0, Math.min(1, progress));
  const t = (a, b) => (p - a) / (b - a); // 0..1 through a stage
  if (p < PREMATURE_TOO_EARLY) {
    return { key: "too_early", name: "Too early", survive: 0, size: 0.3 + 0.3 * p, health: 0, vigor: 0 };
  }
  if (p < PREMATURE_VERY) {
    const k = t(PREMATURE_TOO_EARLY, PREMATURE_VERY);
    return { key: "very", name: "Very premature", survive: 0.25 + 0.35 * k, size: 0.45 + 0.2 * k, health: 35 + 20 * k, vigor: 0.7 };
  }
  if (p < PREMATURE_TERM) {
    const k = t(PREMATURE_VERY, PREMATURE_TERM);
    return { key: "premature", name: "Premature", survive: 0.7 + 0.25 * k, size: 0.7 + 0.2 * k, health: 60 + 25 * k, vigor: 0.85 };
  }
  return null; // full term
}

// HorseAnatomy.spawnBaby: is this foal born alive? (viable: as it would
// have been at full term)
function prematureSurvives(mare, stage, viable) {
  if (!viable) return false;
  if (!stage) return true;
  const chance = stage.survive + (stage.survive > 0 && mare && mare.midwife ? PREMATURE_MIDWIFE : 0);
  return Math.random() < chance;
}

// ...and once it's born: small, and weak if it lived (after Pregnancy.js
// onFoalBorn has given it its vigor)
function applyPrematureBirth(baby, stage, alive) {
  if (!stage) return;
  baby.bornEarly = stage.key; // (saved)
  baby.prematureGrowth = stage.size;
  baby.updateGrowthStats();
  if (!alive) return;
  baby.health = Math.min(baby.health, Math.round(stage.health));
  baby.birthVigor = Math.min(baby.birthVigor || 1, stage.vigor);
  baby.hunger = Math.min(baby.hunger, 0.3); // (born hungry: needs feeding soon)
}

// Horse.handleThrowImpact: a pregnant mare landing hard may go into labour
function maybeEarlyLabourFromFall(mare, damage) {
  if (!mare || !mare.isAlive || !mare.isPregnant || mare.isPregnancyDue()) return false;
  if (!(damage >= PREMATURE_FALL_DAMAGE)) return false;
  if (Math.random() > Math.min(0.8, damage * PREMATURE_FALL_CHANCE)) return false;
  mare.beginMiscarriage();
  return true;
}

// Magnifying glass: [text, tone] while it's still small from being born early
const PREMATURE_WORDS = { too_early: "far too early", very: "very premature", premature: "premature" };
function describePremature(f) {
  if (!f || !f.bornEarly) return null;
  const how = PREMATURE_WORDS[f.bornEarly] || "early";
  if (!f.isAlive) return [`Born ${how}`, "bad"];
  if (f.growth >= 1) return null; // (caught up)
  return [`Born ${how}: small for its age`, "bad"];
}
