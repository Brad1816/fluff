// ---------------------------------------------------------------------------
// Fluffy flu: a catching illness.
//
// f.illness = { type: "flu", t: seconds since caught, known: vet found it }
// (saved with the fluffy), plus f.fluImmuneUntil (game time; after getting
// better) and f.fluVaccinated (a jab at the vet, Vet.js).
//
//   0 .. FLU_HIDDEN       no symptoms yet, but already catching (only a
//                         vet check-up finds it)
//   FLU_HIDDEN .. FLU_LENGTH   sick: sneezes, miserable now and then, loses
//                         health (FLU_HEALTH_PER_DAY; x2 for foals and the
//                         elderly) and a little happiness. Can die of it.
//   FLU_LENGTH            better, and immune for FLU_IMMUNE_DAYS
//
// Spreading (updateIllness, every ILLNESS_TICK): a fluffy with flu can pass
// it to any fluffy within FLU_RANGE in the same area that isn't immune or
// vaccinated - but not through cage bars or fences: fluffies in different
// cages, or that can't reach each other (Fence.js), can't catch it from
// each other. So a cage or a pen is a quarantine. It's half as catching
// before symptoms show.
//
// Where it comes from: some wild fluffies arriving in the park
// (FLU_WILD_CHANCE), strays turning up outside (FLU_STRAY_CHANCE), and the
// night-time tummy bug (NightEvents.js). Bought stock is always healthy.
// ---------------------------------------------------------------------------

const FLU_HIDDEN = 300; // 5 game minutes before symptoms
const FLU_LENGTH = 1800; // 1.5 game days in all
const FLU_HEALTH_PER_DAY = 45;
const FLU_IMMUNE_DAYS = 10;
const FLU_RANGE = 160;
const FLU_SPREAD_CHANCE = 0.02; // per nearby fluffy per tick (half before symptoms)
const FLU_WILD_CHANCE = 0.08;
const FLU_STRAY_CHANCE = 0.1;
const ILLNESS_TICK = 5;

let _illnessTimer = 0;

function hasFlu(f) {
  return !!(f && f.illness && f.illness.type === "flu");
}

// Sick with symptoms (anyone can see it)
function fluShowing(f) {
  return hasFlu(f) && f.illness.t >= FLU_HIDDEN;
}

// Known to you: showing, or found by the vet
function fluKnown(f) {
  return hasFlu(f) && (f.illness.known || fluShowing(f));
}

function canCatchFlu(f) {
  if (!f || !f.isAlive || hasFlu(f) || f.fluVaccinated) return false;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  return !(f.fluImmuneUntil > now);
}

// Give a fluffy the flu (from the start, or already a while in)
function catchFlu(f, t = 0) {
  if (!canCatchFlu(f)) return false;
  f.illness = { type: "flu", t, known: false };
  if (f.adopted && t >= FLU_HIDDEN) _announceFlu(f);
  return true;
}

function cureFlu(f) {
  if (!hasFlu(f)) return;
  f.illness = null;
  f.fluImmuneUntil = (typeof timePlayed === "number" ? timePlayed : 0) + FLU_IMMUNE_DAYS * DAY_LENGTH;
}

// New arrivals: maybe carrying it (hidden or already sick)
function maybeCarryFlu(f, chance) {
  if (Math.random() < chance) catchFlu(f, Math.random() * FLU_HIDDEN * 2);
}

function _illName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
}

function _announceFlu(f) {
  if (!f.adopted || f._fluAnnounced) return;
  f._fluAnnounced = true;
  if (typeof addUIMessage === "function") addUIMessage(`${_illName(f)} has Fluffy flu! Keep it apart from the others.`);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: "Fluffy flu is going round your fluffies." });
}

// Can a could pass it to b? Same area, close, and nothing between them
function _fluCanReach(a, b) {
  if (a.scene !== b.scene) return false;
  if ((a.currentCage || null) !== (b.currentCage || null)) return false;
  if (Math.hypot(a.x - b.x, a.y - b.y) > FLU_RANGE) return false;
  if (typeof canFluffiesReachEachOther === "function" && !canFluffiesReachEachOther(a, b)) return false;
  return true;
}

// Magnifying glass condition text, or null
function describeIllness(f) {
  if (!fluKnown(f)) return null;
  return fluShowing(f) ? "Fluffy flu" : "Fluffy flu (no symptoms yet)";
}

// script.js updateSimulation (works every ILLNESS_TICK seconds)
function updateIllness(dt) {
  _illnessTimer -= dt;
  if (_illnessTimer > 0) return;
  const step = ILLNESS_TICK - _illnessTimer;
  _illnessTimer = ILLNESS_TICK;
  const sick = [];
  for (const f of fluffies) {
    if (!hasFlu(f)) continue;
    if (!f.isAlive) {
      f.illness = null;
      continue;
    }
    const wasHidden = f.illness.t < FLU_HIDDEN;
    f.illness.t += step;
    sick.push(f);
    if (f.illness.t >= FLU_LENGTH) {
      cureFlu(f);
      f._fluAnnounced = false;
      if (f.adopted && typeof addUIMessage === "function") addUIMessage(`${_illName(f)} is over the flu.`);
      continue;
    }
    if (f.illness.t < FLU_HIDDEN) continue;
    if (wasHidden) _announceFlu(f);
    // Symptoms
    const frail = f.growth < 0.5 || (typeof isElderly === "function" && isElderly(f));
    f.health = Math.max(0, (f.health ?? 100) - ((FLU_HEALTH_PER_DAY * (frail ? 2 : 1)) / DAY_LENGTH) * step);
    if (f.happiness > WAN_DIE_THRESHOLD + 0.1) f.changeHappiness(-0.004 * (step / ILLNESS_TICK));
    if (f.health <= 0) {
      f.anatomy.die(null, "Fluffy flu");
      continue;
    }
    if (f.currentStateKey !== "SLEEPING" && Math.random() < 0.15) {
      if (!f.tooYoungToSpeak() && f.speech.nextTime <= 0) f.speak(getDialogue(["ILLNESS", "FLU"], f));
      f.expressionOverride = "MISERABLE";
      f.expressionOverrideTimer = 2;
      if (typeof poofs !== "undefined" && typeof Poof !== "undefined" && f.scene === currentScene)
        poofs.push(new Poof(f.x + (f.facingRight ? 30 : -30), f.y - 20, f.scene, "rgba(230,240,255,0.9)"));
    }
  }
  // Spreading
  for (const s of sick) {
    if (!hasFlu(s)) continue;
    for (const o of fluffies) {
      if (o === s || !canCatchFlu(o) || !_fluCanReach(s, o)) continue;
      const chance = FLU_SPREAD_CHANCE * (fluShowing(s) ? 1 : 0.5) * (step / ILLNESS_TICK);
      if (Math.random() < chance) catchFlu(o);
    }
  }
}
