// ---------------------------------------------------------------------------
// Growing old: life stages, greying, and dying of old age.
//
// A fluffy's age is f.age (game seconds since it was born; saved). A game
// day is DAY_LENGTH (1,200s, WorldTime.js).
//   foal      growing up (about 1.4 days, HorseUpdate._updateGrowingUp)
//   adult     until SENIOR_DAYS (16)
//   senior    from 16 days: its mane and tail start to go grey
//   elderly   from ELDERLY_DAYS (24): grey, slower (Horse.updateSpeed x0.75),
//             mares can't get pregnant any more (HorseMating), worth less
//   old age   from OLD_AGE_RISK_DAYS (28) there's a chance each day of dying
//             peacefully of old age, rising until MAX_AGE_DAYS (40), when
//             it always happens. Most live to about 35 days.
//
// Price (HorseGenetics.calculatePrice): senior x0.8, elderly x0.5.
// Greying: agedColor() blends the mane/tail colour toward silver
// (HorseRenderer.ensureTintedImages); the tints are redrawn when the grey
// level moves up a step (updateAging).
// Fluffies that turn up already grown get a believable age (setSpawnAge,
// called from script.js spawnFeral, ParkLife.js _makeWild and
// StockMarket.js) instead of starting at 0.
// ---------------------------------------------------------------------------

const GROW_UP_TIME = 1680; // seconds from newborn to grown (HorseUpdate)
const SENIOR_DAYS = 16;
const ELDERLY_DAYS = 24;
const OLD_AGE_RISK_DAYS = 28;
const MAX_AGE_DAYS = 40;
const AGING_TICK = 5; // seconds

const agingTicker = new Ticker(AGING_TICK);

function ageDays(f) {
  return (f && f.age ? f.age : 0) / DAY_LENGTH;
}

// "foal" | "adult" | "senior" | "elderly"
function lifeStage(f) {
  if (!f || f.growth < 1) return "foal";
  const d = ageDays(f);
  if (d >= ELDERLY_DAYS) return "elderly";
  if (d >= SENIOR_DAYS) return "senior";
  return "adult";
}

// 0 (none) .. 1 (fully grey), from senior to a few days into elderly
function greyAmount(f) {
  const d = ageDays(f);
  if (d < SENIOR_DAYS) return 0;
  return Math.min(1, (d - SENIOR_DAYS) / (ELDERLY_DAYS + 4 - SENIOR_DAYS));
}

// "rgb(r, g, b)" blended toward silver by amount (0..1)
function agedColor(color, amount) {
  if (!amount || typeof color !== "string") return color;
  const m = color.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return color;
  const silver = 214;
  const [r, g, b] = m.slice(0, 3).map(Number).map((v) => Math.round(v + (silver - v) * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

// For the mane and tail (HorseRenderer)
function maneColorFor(f) {
  return agedColor(f.colors.mane, 0.8 * greyAmount(f));
}

// Magnifying glass: "Foal, 40% grown" / "Adult, 5 days old" / "Elderly, 27 days old"
function describeAge(f) {
  if (!f) return "";
  const days = Math.floor(ageDays(f));
  const old = days === 1 ? "1 day old" : `${days} days old`;
  const stage = lifeStage(f);
  if (stage === "foal") return `Foal, ${Math.floor(f.growth * 100)}% grown (${old})`;
  const word = { adult: "Adult", senior: "Senior", elderly: "Elderly" }[stage];
  return `${word}, ${old}`;
}

function describeAgeTone(f) {
  const s = lifeStage(f);
  return s === "elderly" ? "bad" : s === "senior" ? "ok" : "";
}

function agePriceMultiplier(f) {
  const s = lifeStage(f);
  return s === "elderly" ? 0.5 : s === "senior" ? 0.8 : 1;
}

function isElderly(f) {
  return lifeStage(f) === "elderly";
}

// Elderly mares don't get pregnant (HorseMating.triggerPregnancy)
function tooOldToBreed(f) {
  return !!f && f.gender === "female" && isElderly(f);
}

// Chance of dying of old age within a day at this age (0..1)
function oldAgeDailyRisk(f) {
  const d = ageDays(f);
  if (f.growth < 1 || d < OLD_AGE_RISK_DAYS) return 0;
  return Math.min(1, ((d - OLD_AGE_RISK_DAYS) / (MAX_AGE_DAYS - OLD_AGE_RISK_DAYS)) ** 2);
}

// A believable age for a fluffy that turns up already grown.
// minDays/maxDays: the range for adults (days old).
function setSpawnAge(f, minDays = GROW_UP_TIME / DAY_LENGTH + 0.5, maxDays = 13) {
  if (!f) return;
  if (f.growth < 1) f.age = f.growth * GROW_UP_TIME;
  else f.age = (minDays + Math.random() * (maxDays - minDays)) * DAY_LENGTH;
}

function dieOfOldAge(f) {
  if (!f || !f.isAlive) return;
  f.anatomy.die(null, "Old age");
  if (f.adopted && typeof addUIMessage === "function") {
    const who = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
    addUIMessage(`${who} died peacefully of old age.`);
  }
}

// script.js updateSimulation (works every AGING_TICK seconds)
function updateAging(dt) {
  const step = agingTicker.step(dt); // seconds since last time, or 0 (Systems.js)
  if (!step) return;
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    // Greyer: redraw its mane and tail
    const g = Math.round(greyAmount(f) * 5);
    if (f._greyStep !== g) {
      if (f._greyStep !== undefined && f.renderer) f.renderer.tinted = null;
      f._greyStep = g;
    }
    // Old age
    if (f.growth < 1) continue;
    if (ageDays(f) >= MAX_AGE_DAYS) dieOfOldAge(f);
    else {
      const risk = oldAgeDailyRisk(f);
      if (risk > 0 && Math.random() < (risk * step) / DAY_LENGTH) dieOfOldAge(f);
    }
  }
}

// Runs every simulation step (Systems.js)
registerSystem("aging", updateAging, 130);
