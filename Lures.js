// ---------------------------------------------------------------------------
// Luring strays: what you leave out in the garden, the alley or the
// backyard (LURE_SCENES) draws strays, and decides who comes.
//
// Lures (lureItemsIn): a bowl with food in it, a stuffed toy, a bed, a ball
// or blocks. Each lure in a place makes new strays likelier to turn up
// there (LURE_WEIGHT on top of the place's usual share, up to LURE_MAX of
// them) and strays come sooner everywhere (LURE_SOONER each). What turns
// up depends on the best lure there (lureSpawnPlan):
//   sketties             the greedy: a stray (or two) with a big appetite
//   a stuffy or a toy    foals: an abandoned foal, or a mum and her foals
//   good kibble          a lost pet: tame, trusting, with nicer colours
//   kibble, a bed        anyone (a couple likes a bed)
// The backyard isn't somewhere strays wander into on their own - unless the
// fence is down - but lures there bring them in through the gate (not past
// the best fence), as a group you're asked about (Strays.js), and they draw
// raids (Raids.js). The food gets eaten, of course.
// ---------------------------------------------------------------------------

const LURE_SCENES = ["OUTDOORS", "ALLEY", "BACKYARD"];
const LURE_WEIGHT = 2; // spawn weight per lure in a place
const LURE_MAX = 3;
const LURE_SOONER = 0.25; // strays come (1 + this x lures)x as often
const LURE_BACKYARD_CHANCE = 0.06; // a game hour, each lure: strays through the gate
const LURE_GREEDY = 0.5; // appetite shift for a greedy stray
const lureTicker = new Ticker(5);
let _lureBoost = false; // spawning a lost pet: better colours (randomFeralQuality asks)

// What's out to draw strays: [{ obj, kind }] kind: sketties | good_kibble | kibble | stuffy | toy | bed
function lureItemsIn(scene) {
  if (typeof objects === "undefined" || !LURE_SCENES.includes(scene)) return [];
  const out = [];
  for (const o of objects) {
    if (o.scene !== scene || o.isDragging || o.heldBy || o.currentCage) continue;
    let kind = null;
    if (typeof Bowl !== "undefined" && o instanceof Bowl) {
      if (!o.hasFood() || o.foodType === "formula" || o.foodType === "rat_poison") continue;
      kind = o.foodType === "sketties" ? "sketties" : o.foodType === "premium_kibble" ? "good_kibble" : "kibble";
    } else if (typeof Plushie !== "undefined" && o instanceof Plushie) kind = "stuffy";
    else if (typeof Bed !== "undefined" && o instanceof Bed) kind = "bed";
    else if ((typeof Ball !== "undefined" && o instanceof Ball) || (typeof Block !== "undefined" && o instanceof Block)) kind = "toy";
    if (kind) out.push({ obj: o, kind });
  }
  return out;
}

function lureCount(scene) {
  return Math.min(LURE_MAX, lureItemsIn(scene).length);
}

// script.js updateFerals: extra spawn weight for a place with lures
function lureSpawnWeight(scene) {
  // (a stocked Foal-4-Sketties machine draws hungry families too: FoalMachine.js)
  // (a bin fence keeps most strays away: Wild.js)
  const fence = typeof binFenceIn === "function" && binFenceIn(scene) ? -0.7 : 0;
  return LURE_WEIGHT * lureCount(scene) + (typeof machineLureWeight === "function" ? machineLureWeight(scene) : 0) + fence;
}

// ...and strays come sooner
function lureSoonerFactor() {
  let n = 0;
  for (const s of LURE_SCENES) n += lureCount(s);
  return 1 + LURE_SOONER * n;
}

// Who the lures there bring: { scenario, kind } or null
function lureSpawnPlan(scene) {
  const mp = typeof machineLurePlan === "function" ? machineLurePlan(scene) : null; // (FoalMachine.js)
  if (mp) return mp;
  const items = lureItemsIn(scene);
  if (!items.length) return null;
  const kinds = new Set(items.map((i) => i.kind));
  const pick = (k) => ({ kind: k, scenario: LURE_SCENARIOS[k]() });
  // (the most telling lure wins; when there are several, now and then another)
  const order = ["sketties", "good_kibble", "stuffy", "toy", "bed", "kibble"].filter((k) => kinds.has(k));
  const k = Math.random() < 0.75 ? order[0] : order[Math.floor(Math.random() * order.length)];
  return pick(k);
}

const LURE_SCENARIOS = {
  sketties: () => (Math.random() < 0.6 ? "lone" : "couple"),
  good_kibble: () => "lone",
  stuffy: () => (Math.random() < 0.5 ? "abandoned_baby" : "single_mom"),
  toy: () => (Math.random() < 0.5 ? "abandoned_baby" : "single_mom"),
  bed: () => (Math.random() < 0.5 ? "couple" : "lone"),
  kibble: () => null, // (anyone)
};

// script.js randomFeralQuality: a lost pet's nicer colours
function lureQualityBoost() {
  return _lureBoost ? 0.6 + Math.random() * 0.4 : null;
}

// Before the group is made (spawnFeralGroup)
function lureBeforeSpawn(plan) {
  _lureBoost = !!plan && plan.kind === "good_kibble";
}

// After: what the lure made of them
function applyLure(list, plan) {
  _lureBoost = false;
  if (!plan || !list.length) return;
  if (plan.kind === "sketties") {
    for (const f of list) {
      if (f.growth < 1) continue;
      if (!f.traitShift || typeof f.traitShift !== "object") f.traitShift = {};
      f.traitShift.appetite = Math.min(typeof TRAIT_SHIFT_MAX === "number" ? TRAIT_SHIFT_MAX : 0.6, (f.traitShift.appetite || 0) + LURE_GREEDY);
      f.hunger = Math.min(f.hunger ?? 1, 0.4);
    }
  } else if (plan.kind === "machine") {
    if (typeof machineLureArrived === "function") machineLureArrived(list);
  } else if (plan.kind === "good_kibble") {
    const pet = list.find((f) => f.growth >= 1) || list[0];
    pet.personalities = (pet.personalities || []).filter((p) => p !== "true_feral");
    pet.playerTrust = Math.max(pet.playerTrust ?? 0, 0.65 + Math.random() * 0.15);
    pet.playerFear = Math.min(pet.playerFear ?? 0, 0.02);
    pet.lostPet = true;
    if (typeof giveOwnerName === "function") giveOwnerName(pet);
  }
  for (const f of list) f.luredBy = plan.kind;
}

// Lures in the backyard bring strays in through the gate
function updateLures(dt) {
  const step = lureTicker.step(dt);
  if (!step || typeof spawnFeralGroup !== "function") return;
  if (currentScene === "BACKYARD") return; // (not while you're watching: no popping in)
  if (typeof backyardFenceTier !== "undefined" && backyardFenceTier >= 2 && !backyardFenceBroken) return;
  const n = lureCount("BACKYARD");
  if (!n) return;
  if (fluffies.filter((f) => f.isAlive && !f.adopted && f.scene === "BACKYARD").length >= 6) return; // (enough of them already)
  if (Math.random() >= LURE_BACKYARD_CHANCE * n * (step / HOUR_LENGTH)) return;
  const plan = lureSpawnPlan("BACKYARD");
  spawnFeralGroup("BACKYARD", plan ? plan.scenario : null, { lure: plan });
}
registerSystem("lures", updateLures, 135);

// Magnifying glass ("Came for"): [text, tone] or null
function describeLured(f) {
  if (!f || !f.luredBy || f.adopted) return null;
  return [{ sketties: "the sketties you left out", good_kibble: "the good kibble you left out", kibble: "the food you left out", machine: "the smell of the machine's sketties", stuffy: "the stuffy you left out", toy: "the toys you left out", bed: "the bed you left out" }[f.luredBy] || "what you left out", ""];
}
