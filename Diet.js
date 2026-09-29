// ---------------------------------------------------------------------------
// Food and diet: kibble brands, tastes, nutrition and weight.
//
// Foods (FOODS), bags sold at Fluff Mart (globals.js SPAWN_ACTIONS):
//   Fluffy Feast Premium  $80  very nutritious, nearly every fluffy loves it
//   Kibble                $25  decent; some fluffies like it, some don't
//   Value Kibble          $10  not very nutritious, not filling, a bit bland
//   Scrapz                 $3  made from ground-up fluffies (the grinder makes
//                              it too - Grinder.js). Barely food: not filling,
//                              most hate it, and it can upset their tummy
//                              (diarrhea) and hurts them
//   Sketties ($120, a treat), formula, grass and berries have values too.
//   (Soylent Brown is gone: old saves' bags and bowls become Scrapz.)
//   nutrition   0..1, how good it is for them
//   fill        how full a meal makes them (1 = full; cheap food = hungry
//               again sooner, so it goes further than it looks... or not)
//   taste       -1..1, how much the average fluffy likes it
//   spread      how much fluffies differ (kibble: a lot)
//
// Tastes: tasteFor(f, food) = taste + that fluffy's own liking (f.tastes,
// made up the first time it's needed, saved) x spread, bent by the appetite
// trait: picky eaters dislike things more, greedy ones like everything more.
//   - Fluffies go for the food they like most (foodPriorityFor, used by
//     HorsePositioning.scoutForHunger).
//   - They won't touch food they really dislike (below FOOD_REFUSE) unless
//     they're starving (hunger < FOOD_DESPERATE), and grumble about it.
//   - Eating: happier the more they like it; a favourite (favouriteFood, the
//     best-liked everyday food - not sketties) is extra nice.
//
// Diet (f.diet, 0..1, saved): a running average of how nutritious its meals
// are (DIET_START 0.6 = ordinary kibble-ish). What it changes:
//   - Shows: (diet - 0.6) x 20 points (about -12..+8), Shows.js showScore
//   - Price: x0.85..x1.1 (dietPriceMultiplier, HorseGenetics)
//   - Health: 0.8+ slowly heals, under 0.25 (malnourished) slowly hurts
//   - Foals grow faster or slower (Pregnancy.js foalGrowthRate) and
//     pregnant mares do better or worse (pregnancyConditionNow)
//
// Weight (f.weight, 0..1, saved): sketties (+0.06 a meal) and training
// treats (+0.015) fatten; it burns off slowly, faster when moving.
//   chubby (WEIGHT_CHUBBY 0.45): slower (x0.85), -4 at shows, rounder belly
//   fat    (WEIGHT_FAT 0.75):    slower (x0.7), -10 at shows, x0.9 price,
//                                slowly loses health
//
// Shown in the magnifying glass: Diet and Weight (Overview), Favourite food
// (Looks & nature).
// ---------------------------------------------------------------------------

const FOODS = {
  premium_kibble: {
    name: "Fluffy Feast Premium",
    short: "Premium kibble",
    nutrition: 1.0,
    fill: 1.0,
    taste: 0.6,
    spread: 0.25,
    filter: "sepia(0.7) saturate(2.2) hue-rotate(-10deg) brightness(1.15)",
    tag: "#e0a526",
  },
  kibble: { name: "Kibble", short: "Kibble", nutrition: 0.7, fill: 1.0, taste: 0.05, spread: 0.7 },
  value_kibble: {
    name: "Value Kibble",
    short: "Value kibble",
    nutrition: 0.4,
    fill: 0.7,
    taste: -0.2,
    spread: 0.3,
    filter: "grayscale(0.75) brightness(1.05)",
    tag: "#8a8f99",
  },
  scrap_kibble: {
    name: "Scrapz",
    short: "Scrapz",
    nutrition: 0.1,
    fill: 0.55,
    taste: -0.6,
    spread: 0.25,
    sick: 0.25, // chance a meal upsets its tummy
    harm: 4, // health lost each meal
    filter: "sepia(1) hue-rotate(35deg) saturate(0.7) brightness(0.55)",
    tag: "#5d6b2f",
  },
  sketties: { name: "Sketties", short: "Sketties", nutrition: 0.35, fill: 1.0, taste: 0.95, spread: 0.1, fatten: 0.06 },
  formula: { name: "Formula", short: "Formula", nutrition: 0.9, fill: 1.0, taste: 0.4, spread: 0.1 },
  // Park food: the same for every fluffy, so the park works as before
  // (grass priority 2, berries 3 - ParkLife.js)
  grass: { name: "Grass", short: "Grass", nutrition: 0.5, fill: 1.0, taste: 0, spread: 0 },
  berries: { name: "Berries", short: "Berries", nutrition: 0.6, fill: 1.0, taste: 0.5, spread: 0 },
  rat_poison: { name: "Rat Poison", short: "Rat poison", nutrition: 0, fill: 1.0, taste: 0.5, spread: 0 },
};
// Everyday foods a fluffy can have as its favourite
const FAVOURITE_FOODS = ["premium_kibble", "kibble", "value_kibble", "scrap_kibble", "grass"];

const DIET_START = 0.6;
const DIET_LEARN = 0.12; // each meal moves the diet this much of the way
const FOOD_REFUSE = -0.45;
const FOOD_DESPERATE = 0.25;
const WEIGHT_CHUBBY = 0.45;
const WEIGHT_FAT = 0.75;
const WEIGHT_TREAT = 0.015;
const WEIGHT_BURN = 0.025; // per game hour (x2 when moving)

const dietTicker = new Ticker(2);

function foodInfo(type) {
  if (type === "soylent_brown") type = "scrap_kibble"; // old saves
  return FOODS[type || "grass"] || FOODS.grass;
}
function foodTypeOf(thing) {
  if (!thing) return "grass";
  return thing.foodType || "grass";
}
function isKibbleType(type) {
  return type === "kibble" || type === "premium_kibble" || type === "value_kibble" || type === "scrap_kibble";
}

function _dietTrait(f) {
  return typeof traitValue === "function" ? traitValue(f, "appetite") : 0;
}

// -1..1: how much THIS fluffy likes that food
function tasteFor(f, type) {
  const food = foodInfo(type);
  if (!f.tastes || typeof f.tastes !== "object") f.tastes = {};
  if (typeof f.tastes[type] !== "number") f.tastes[type] = Math.round((Math.random() * 2 - 1) * 100) / 100;
  let t = food.taste + f.tastes[type] * food.spread;
  const a = _dietTrait(f); // greedy +, picky -
  if (a > 0) t += 0.25 * a;
  else if (a < 0) {
    if (t < 0) t *= 1 + 0.6 * -a;
    else t -= 0.15 * -a;
  }
  return Math.max(-1, Math.min(1, t));
}

function favouriteFood(f) {
  let best = null;
  let bestT = -Infinity;
  for (const k of FAVOURITE_FOODS) {
    const t = tasteFor(f, k);
    if (t > bestT) {
      bestT = t;
      best = k;
    }
  }
  return best;
}

// How much it wants to go for a bowl of this (HorsePositioning), about 0..4
function foodPriorityFor(f, type) {
  if (type === "rat_poison") return 3; // it smells like food...
  return 2 + 2 * tasteFor(f, type);
}

// Won't eat it (not hungry enough to put up with it)
function refusesFood(f, type) {
  if (type === "rat_poison" || type === "formula") return false;
  if ((f.hunger ?? 1) < FOOD_DESPERATE) return false;
  return tasteFor(f, type) < FOOD_REFUSE;
}

// It looked at a bowl it won't eat and there's nothing else
function grumbleAboutFood(f, type) {
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  if (f._foodGrumbleAt && now - f._foodGrumbleAt < 40) return;
  f._foodGrumbleAt = now;
  if (!f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING") f.speak(getDialogue(["EAT", "REFUSE"], f));
}

// How full a meal makes it
function foodFill(type) {
  return foodInfo(type).fill;
}

// Happiness from a meal (HorseUpdate eating), not sketties/Scrapz/poison
function mealHappiness(f, type) {
  let h = 0.04 + 0.08 * tasteFor(f, type);
  if (favouriteFood(f) === type) h += 0.05;
  return h;
}

// Which line it says
function mealDialogueKey(f, type) {
  if (favouriteFood(f) === type && tasteFor(f, type) > 0.3) return ["EAT", "FAVOURITE"];
  const t = tasteFor(f, type);
  if (t > 0.45) return ["EAT", "YUMMY"];
  if (t < -0.3) return ["EAT", "YUCKY"];
  return ["EAT", "NUMMIES"];
}

// HorseUpdate, after any meal from a bowl, grass or berries
function onFluffyAte(f, type) {
  if (!f || !f.isAlive) return;
  const food = foodInfo(type);
  if (typeof f.diet !== "number") f.diet = DIET_START;
  f.diet = Math.round((f.diet + DIET_LEARN * (food.nutrition - f.diet)) * 1000) / 1000;
  if (food.fatten) changeWeight(f, food.fatten);
  if (food.harm) f.health = Math.max(1, f.health - food.harm);
  if (food.sick && Math.random() < food.sick) {
    f.isDiarrhea = true;
    f.expressionOverride = "MISERABLE";
    f.expressionOverrideTimer = 3;
  }
  // Remember the last few meals (for the magnifying glass)
  if (!Array.isArray(f.recentMeals)) f.recentMeals = [];
  f.recentMeals.unshift(type);
  if (f.recentMeals.length > 5) f.recentMeals.length = 5;
}

function changeWeight(f, amount) {
  const before = weightLevel(f);
  f.weight = Math.max(0, Math.min(1, (f.weight || 0) + amount));
  if (weightLevel(f) !== before && typeof f.updateSpeed === "function") f.updateSpeed();
}

function weightLevel(f) {
  const w = f.weight || 0;
  if (w >= WEIGHT_FAT) return "fat";
  if (w >= WEIGHT_CHUBBY) return "chubby";
  return "trim";
}

// ---- What diet and weight change ----

function weightSpeedMultiplier(f) {
  const l = weightLevel(f);
  return l === "fat" ? 0.7 : l === "chubby" ? 0.85 : 1;
}

function dietPriceMultiplier(f) {
  const d = typeof f.diet === "number" ? f.diet : DIET_START;
  let m = Math.max(0.85, Math.min(1.1, 1 + 0.25 * (d - DIET_START)));
  if (weightLevel(f) === "fat") m *= 0.9;
  return m;
}

function dietShowBonus(f) {
  const d = typeof f.diet === "number" ? f.diet : DIET_START;
  const l = weightLevel(f);
  return Math.round((d - DIET_START) * 20) - (l === "fat" ? 10 : l === "chubby" ? 4 : 0);
}

// Foals (Pregnancy.js foalGrowthRate) and pregnant mares (pregnancyConditionNow)
function dietGrowthMultiplier(f) {
  const d = typeof f.diet === "number" ? f.diet : DIET_START;
  return Math.max(0.8, Math.min(1.2, 1 + 0.4 * (d - DIET_START)));
}

// Belly (HorseRenderer): 0..1 extra roundness
function weightBelly(f) {
  const w = f.weight || 0;
  return w < 0.25 ? 0 : Math.min(1, (w - 0.25) / 0.6);
}

// ---- Magnifying glass ----

function dietLevel(f) {
  const d = typeof f.diet === "number" ? f.diet : DIET_START;
  if (d >= 0.85) return ["Excellent", "good"];
  if (d >= 0.58) return ["Good", "good"]; // (a new fluffy, 0.6, is "Good")
  if (d >= 0.42) return ["Fair", "ok"];
  if (d >= 0.25) return ["Poor", "bad"];
  return ["Malnourished", "bad"];
}

function describeDiet(f) {
  const [lvl, tone] = dietLevel(f);
  const meals = Array.isArray(f.recentMeals) ? f.recentMeals : [];
  if (!meals.length) return [lvl, tone];
  // What it's mostly been eating
  const count = {};
  for (const m of meals) count[m] = (count[m] || 0) + 1;
  const main = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
  return [`${lvl} (mostly ${foodInfo(main).short.toLowerCase()})`, tone];
}

function describeWeight(f) {
  const l = weightLevel(f);
  if (l === "fat") return ["Fat - too many sketties", "bad"];
  if (l === "chubby") return ["Getting chubby", "ok"];
  return ["Trim", "good"];
}

function describeFavouriteFood(f) {
  const fav = favouriteFood(f);
  const t = tasteFor(f, fav);
  const kibble = tasteFor(f, "kibble");
  const extra = kibble < -0.3 ? " (not keen on plain kibble)" : kibble > 0.5 && fav !== "kibble" ? " (likes plain kibble too)" : "";
  return `${foodInfo(fav).name}${t < 0.2 ? " (fussy)" : ""}${extra}`;
}

// ---- The system: health from diet, weight burning off ----

function updateDiet(dt) {
  const step = dietTicker.step(dt);
  if (!step) return;
  const hours = step / (typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50);
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    const d = typeof f.diet === "number" ? f.diet : DIET_START;
    if (d >= 0.8 && f.health < 100) f.health = Math.min(100, f.health + 1 * hours);
    else if (d < 0.25) f.health = Math.max(1, f.health - 1.5 * hours);
    if (f.weight > 0) {
      const moving = typeof f.isMovingOrRunning === "function" && f.isMovingOrRunning();
      changeWeight(f, -WEIGHT_BURN * hours * (moving ? 2 : 1));
    }
    if (weightLevel(f) === "fat") f.health = Math.max(1, f.health - 0.5 * hours);
  }
}
registerSystem("diet", updateDiet, 137);
