// ---------------------------------------------------------------------------
// What goes in (plan round 8): hot peppers and the rock eater.
//
// HOT PEPPERS (Fluff Mart, Food & Feeding, a bag like kibble; or the
// computer): they look like a treat, so a fluffy eats them - then it burns.
// It cries, its mouth hurts (PEPPER_SAD), and it runs for water (a water
// bowl in the room). It learns to fear that bowl (f.fearedBowls, as with
// poison: it won't eat from it again unless starving). The burn wears off.
//
// THE ROCK EATER: a dim fluffy (smarts under ROCK_SMARTS, or the "dim"
// deformity) sometimes eats a small block in its room ("it aww tuwns into
// poopies"), or a pebble outside (ROCK_CHANCE a game hour). Most pass with a
// tummy ache (ROCK_ACHE health, sad); now and then one gets stuck
// (ROCK_BLOCK): f.blockage (saved) - it can't poop, loses health
// (ROCK_BLOCK_HURT a game hour) and gets sadder until the vet clears it
// (Vet.js), or it passes after ROCK_PASS. Picking it up while it's chewing
// stops it - and sets off a tantrum.
// ---------------------------------------------------------------------------

const PEPPER_PRICE = 15;
const PEPPER_SAD = 0.08;
const PEPPER_BURN = 3 * 60; // game seconds of a burning mouth
const ROCK_SMARTS = 30;
const ROCK_CHANCE = 0.12; // a game hour
const ROCK_ACHE = 6;
const ROCK_BLOCK = 0.25;
const ROCK_BLOCK_HURT = 3;
const ROCK_PASS = DAY_LENGTH;
const tummyTicker = new Ticker(2);

if (typeof FOODS !== "undefined" && !FOODS.hot_peppers) {
  FOODS.hot_peppers = { name: "Hot Peppers", short: "Hot peppers", nutrition: 0.3, fill: 0.85, taste: 0.4, spread: 0, filter: "hue-rotate(-40deg) saturate(3) brightness(0.95)", tag: "#d63c1e" };
}

function _tSay(f, keys, force = true) {
  if (f && f.isAlive && !f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(keys, f), force);
}

// HorseUpdate eating: after its usual line
function onAteSpecial(f, foodType, bowl) {
  if (foodType !== "hot_peppers") return;
  f.pepperUntil = timePlayed + PEPPER_BURN;
  f.changeHappiness(-PEPPER_SAD, "Hot peppers!");
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 4;
  _tSay(f, ["PEPPER", "BURN"]);
  // It learns to fear that bowl
  if (bowl && bowl.id != null) {
    if (!Array.isArray(f.fearedBowls)) f.fearedBowls = [];
    if (!f.fearedBowls.includes(bowl.id)) f.fearedBowls.push(bowl.id);
    if (f.fearedBowls.length > 6) f.fearedBowls.shift();
  }
  // ...and runs for water
  const water = typeof WaterBowl !== "undefined" ? objects.find((o) => o instanceof WaterBowl && o.scene === f.scene && o.currentCage === f.currentCage) : null;
  if (water && typeof f.initBehavior === "function") {
    f.initBehavior("RUNNING");
    f.setTargetPosition(water.x, water.y + 10);
    f._pepperWater = water.id;
  }
}

function pepperBurning(f) {
  return !!(f && typeof f.pepperUntil === "number" && timePlayed < f.pepperUntil && f.pepperUntil - timePlayed <= PEPPER_BURN + 1);
}

// ---- The rock eater ----
function isRockEater(f) {
  if (!f || !f.isAlive || f.growth < 0.3) return false;
  if (Array.isArray(f.deformities) && f.deformities.includes("dim")) return true;
  return (typeof smartsScore === "function" ? smartsScore(f) : 50) < ROCK_SMARTS;
}

function hasBlockage(f) {
  return !!(f && f.blockage && typeof f.blockage.at === "number");
}

function eatRock(f, block = null) {
  if (!f || !f.isAlive) return false;
  if (block) {
    if (block.heldBy || block.isDragging) return false;
    const i = objects.indexOf(block);
    if (i >= 0) objects.splice(i, 1);
  }
  _tSay(f, ["ROCK", "EAT"]);
  f._rockAt = timePlayed;
  if (Math.random() < ROCK_BLOCK) {
    f.blockage = { at: timePlayed };
    _tSay(f, ["ROCK", "STUCK"]);
  } else {
    f.health = Math.max(1, f.health - ROCK_ACHE);
    f.changeHappiness(-0.05, "Tummy hurties (ate a rock)");
  }
  return true;
}

// Picked up while chewing: a tantrum (Memory.onFluffyPickedUp)
function rockTantrum(f) {
  if (!f || !(typeof f._rockChewAt === "number" && timePlayed - f._rockChewAt < 4)) return false;
  f._rockChewAt = null;
  f.changeHappiness(-0.04, "Stopped eating a rock");
  f.expressionOverride = "ANGRY_PUFFED";
  f.expressionOverrideTimer = 3;
  _tSay(f, ["ROCK", "TANTRUM"]);
  return true;
}

function updateTummy(dt) {
  const step = tummyTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const hours = step / HOUR_LENGTH;
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    // A burning mouth
    if (pepperBurning(f)) {
      f.changeHappiness(-PEPPER_SAD * 0.5 * hours, "Mouth on fire");
      const w = f._pepperWater != null ? objects.find((o) => o.id === f._pepperWater) : null;
      if (w && Math.hypot(w.x - f.x, w.y - f.y) < 60) {
        f.pepperUntil = timePlayed; // (a drink puts it out)
        f._pepperWater = null;
        _tSay(f, ["PEPPER", "WATER"]);
      } else if (Math.random() < 0.15 * step) _tSay(f, ["PEPPER", "BURN"], false);
    }
    // A blockage
    if (hasBlockage(f)) {
      f.poopStorage = Math.min(f.poopStorage || 0, 0.2); // (nothing comes out)
      f.health = Math.max(0, f.health - ROCK_BLOCK_HURT * hours);
      f.changeHappiness(-0.05 * hours, "Tummy blocked");
      if (f.health <= 0 && typeof f.die === "function") {
        f.die(null, "A blocked tummy");
        continue;
      }
      if (timePlayed - f.blockage.at >= ROCK_PASS || timePlayed < f.blockage.at) {
        f.blockage = null;
        _tSay(f, ["ROCK", "PASSED"]);
      } else if (Math.random() < 0.05 * step) _tSay(f, ["ROCK", "STUCK"], false);
    }
    // A dim one eats a block (or a pebble outside)
    if (!isRockEater(f) || f.isDragging || f.placedOn || f.currentStateKey === "SLEEPING" || hasBlockage(f)) continue;
    if (Math.random() >= ROCK_CHANCE * hours) continue;
    const block = typeof Block !== "undefined" ? objects.find((o) => o instanceof Block && o.scene === f.scene && o.currentCage === f.currentCage && !o.heldBy && !o.isDragging && Math.hypot(o.x - f.x, o.y - f.y) < 250) : null;
    const outside = typeof isOutdoorScene === "function" && isOutdoorScene(f.scene);
    if (!block && !outside) continue;
    f._rockChewAt = timePlayed;
    eatRock(f, block);
  }
}
registerSystem("tummy", updateTummy, 137.5);

function describeTummy(f) {
  if (hasBlockage(f)) return ["Blocked - it ate a rock (the vet can clear it)", "bad"];
  if (pepperBurning(f)) return ["Mouth on fire (hot peppers)", "bad"];
  if (isRockEater(f) && f.adopted) return ["Eats rocks and blocks", "ok"];
  return null;
}
if (typeof INSPECT_ROWS !== "undefined") INSPECT_ROWS.push(["Tummy", "describeTummy"]);
if (typeof EXTRA_VET_PROBLEMS !== "undefined") {
  EXTRA_VET_PROBLEMS.push({ has: (f) => (hasBlockage(f) ? ["a blocked tummy (a rock)", 70] : null), cure: (f) => (f.blockage = null) });
}

// ---- Shop ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({ name: "Hot Peppers", desc: "They look like a treat. They aren't: the fluffy's mouth burns, it cries and runs for water, and it won't eat from that bowl again. Hover over a bowl while holding the bag.", cost: PEPPER_PRICE, isItem: "food_bag", foodType: "hot_peppers", priority: 1 });
}
