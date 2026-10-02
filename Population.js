// ---------------------------------------------------------------------------
// Population limits (design doc Phase 0, stage 2): with fluffies living 5-7
// years, houses and the park need something to stop them filling up.
//
// Crowding: each house room and the backyard has room for so many fluffies
// (ROOM_SPACE; a foal takes half a place). Over that, the room is crowded:
//   - everyone in it is slowly unhappier (CROWD_UNHAPPY a game hour at 100%
//     over), and grumbles now and then
//   - grumpy grown-ups start scuffles with whoever's next to them
//     (CROWD_SCUFFLE), using the usual attack (HorseSocial.performAttack,
//     intent "CROWDED")
// The room name at the top turns red and says so, and the Household screen
// lists crowded rooms.
//
// Mares rest after a litter: for MARE_REST_DAYS (about 2 months) after
// giving birth she can't get pregnant again (HorseMating.triggerPregnancy).
// f.lastBirthAt (saved) is set by HorseAnatomy.spawnBaby.
//
// Park births follow food: a wild mare in the park only gets pregnant with
// chance parkBirthFactor() - food per wild fluffy (grass tufts and berries)
// against PARK_FOOD_PER_FLUFFY, lower still when the park is over
// PARK_WILD_MAX (ParkLife.js). So winters and a crowded park mean fewer foals.
// ---------------------------------------------------------------------------

const ROOM_SPACE = { house: 10, BACKYARD: 16 };
const CROWD_UNHAPPY = 0.04; // happiness a game hour, x how far over (1 = double)
const CROWD_SCUFFLE = 0.0015; // a second, x how far over, x (1 + temper), per grumpy grown-up
const MARE_REST_DAYS = 2; // about 2 months (a game day ~ a month, Aging.js)
const PARK_FOOD_PER_FLUFFY = 1.5; // bites of food about per wild fluffy for full breeding
const PARK_MIN_BIRTHS = 0.1;

const populationTicker = new Ticker(2);

function _isHouseRoomScene(scene) {
  return typeof scene === "string" && /^INDOORS/.test(scene);
}

// How many fluffies a place has room for (null = no limit here)
function roomSpace(scene) {
  if (_isHouseRoomScene(scene)) return ROOM_SPACE.house;
  if (scene === "BACKYARD") return ROOM_SPACE.BACKYARD;
  return null;
}

// How many places the living fluffies here take up (a foal is half)
function roomLoad(scene) {
  let n = 0;
  for (const f of fluffies) {
    if (!f.isAlive || f.scene !== scene || f.isDragging) continue;
    n += f.growth < 1 ? 0.5 : 1;
  }
  return n;
}

// 0 = fine, 0.5 = half as many again as there's room for, ...
function crowding(scene) {
  const space = roomSpace(scene);
  if (!space) return 0;
  return Math.max(0, (roomLoad(scene) - space) / space);
}

// "Living room: crowded (14/10)" lines for the Household screen
function crowdedRoomLines() {
  const scenes = [...new Set(fluffies.filter((f) => f.isAlive).map((f) => f.scene))];
  const out = [];
  for (const s of scenes) {
    if (crowding(s) <= 0) continue;
    const name = typeof householdRoomName === "function" ? householdRoomName(s) : s;
    out.push(`${name}: crowded (${Math.round(roomLoad(s))}/${roomSpace(s)})`);
  }
  return out;
}

// ---- Mares resting after a litter ----

function restingAfterBirth(f) {
  if (!f || f.gender !== "female" || typeof f.lastBirthAt !== "number") return false;
  const since = timePlayed - f.lastBirthAt;
  if (since < 0) {
    f.lastBirthAt = null; // (clock went back: new game or load)
    return false;
  }
  return since < MARE_REST_DAYS * DAY_LENGTH;
}

// Magnifying glass: [text, tone] or null
function describeBreedingRest(f) {
  if (!restingAfterBirth(f)) return null;
  const left = (MARE_REST_DAYS * DAY_LENGTH - (timePlayed - f.lastBirthAt)) / DAY_LENGTH;
  const t = typeof fluffyAgeText === "function" ? fluffyAgeText(left) : `${left.toFixed(1)} days`;
  return [`Resting after her litter (${t === "newborn" ? "a few days" : t} left)`, ""];
}

// ---- Park births follow food ----

function parkFood() {
  let food = 0;
  if (typeof objects === "undefined" || typeof Grass === "undefined") return 0;
  for (const o of objects) {
    if (!(o instanceof Grass) || o.scene !== "PARK") continue;
    food += Math.max(0, Math.floor(o.growth || 0));
  }
  return food;
}

function parkWildCount() {
  return fluffies.filter((f) => f.isAlive && !f.adopted && f.scene === "PARK").length;
}

// 0.1 .. 1: how likely a wild mare in the park is to get pregnant
function parkBirthFactor() {
  const wild = Math.max(1, parkWildCount());
  let factor = Math.min(1, parkFood() / wild / PARK_FOOD_PER_FLUFFY);
  if (typeof PARK_WILD_MAX === "number" && wild >= PARK_WILD_MAX) factor *= 0.3;
  return Math.max(PARK_MIN_BIRTHS, factor);
}

// HorseMating.triggerPregnancy: can this mare get pregnant now?
function canConceiveNow(mare) {
  if (restingAfterBirth(mare)) return false;
  if (!mare.adopted && mare.scene === "PARK" && Math.random() > parkBirthFactor()) return false;
  return true;
}

// ---- The system: crowded rooms ----

function updatePopulation(dt) {
  const step = populationTicker.step(dt);
  if (!step) return;
  const hours = step / (typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50);
  const now = timePlayed;
  const scenes = new Set();
  for (const f of fluffies) if (f.isAlive && roomSpace(f.scene)) scenes.add(f.scene);
  for (const scene of scenes) {
    const over = crowding(scene);
    if (over <= 0) continue;
    const here = fluffies.filter((f) => f.isAlive && f.scene === scene && !f.isDragging);
    for (const f of here) {
      if (f.happiness > 0.05) f.changeHappiness(-CROWD_UNHAPPY * over * hours);
      // Grumbling
      if (scene === currentScene && !f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING") {
        if (typeof f._nextCrowdGrumble !== "number") f._nextCrowdGrumble = now + 60 + Math.random() * 240;
        if (now >= f._nextCrowdGrumble) {
          f._nextCrowdGrumble = now + 240 + Math.random() * 360;
          f.speak(getDialogue(["CROWDED", "GRUMBLE"], f));
        }
      }
      // Scuffles: grumpy grown-ups
      if (f.growth < 1 || f.currentStateKey === "SLEEPING" || f.placedOn || f.currentCage) continue;
      const temper = typeof traitValue === "function" ? traitValue(f, "temper") : 0;
      if (temper <= 0 || f.attackCooldown > 0 || !f.canFightBack()) continue;
      if (Math.random() >= CROWD_SCUFFLE * over * (1 + temper) * step) continue;
      const victim = here.find(
        (o) => o !== f && o.growth >= 0.5 && !o.tooYoungToWalk() && o.currentStateKey !== "SLEEPING" && Math.hypot(o.x - f.x, o.y - f.y) < 80,
      );
      if (!victim) continue;
      if (!f.tooYoungToSpeak()) f.speak(getDialogue(["CROWDED", "SHOVE"], f, victim));
      f.performAttack(victim, "CROWDED");
    }
  }
}
registerSystem("population", updatePopulation, 142);
