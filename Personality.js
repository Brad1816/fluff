// ---------------------------------------------------------------------------
// Personality (design doc Phase 1): what each fluffy loves most, and how its
// story slowly changes who it is.
//
// FAVOURITE CARE (f.favouriteCare, saved): one of FAVOURITE_CARE_KINDS -
// brushing, treats, play, praise, presents or cuddles - counts extra for
// each fluffy: FAVOURITE_TRUST_BONUS x the affection and a little more
// happiness (Affection.giveAffection -> onFavouriteCare). You find out by
// trying: the first time, it's a turning point and a line in its story
// ("She was never much for treats, but she'd melt when you brushed her.")
// and the magnifying glass shows it ("Loves most").
//
// PERSONALITY GROWTH (f.traitShift, saved): the genes (Traits.js) set who
// a fluffy starts as; what happens to it shifts that a little (traitValue
// adds the shift, capped at TRAIT_SHIFT_MAX either way). Checked once a
// game day from what happened (f.growthProgress, saved):
//   got over a fear it had (a fear from 0.3+ to almost nothing)  braver
//   comforted through GROW_COMFORTS frights                     calmer
//   hungry (hunger < 0.2) for GROW_HUNGRY_DAYS                  greedier
//   hurt by you GROW_HARMS times                                more timid
//   loved (trust 0.8+) for GROW_LOVED_DAYS days                 friendlier
//   played with GROW_PLAYS times                                livelier
//   picked on by others GROW_PICKED_ON times                    grumpier
// Each step is TRAIT_SHIFT_STEP, noted in its story; a rule can move a
// trait at most GROW_RULE_MAX times. Foals copy part of their raiser's
// shifts while growing up (Upbringing.js, UPBRINGING_SHIFT_SHARE).
// ---------------------------------------------------------------------------

const FAVOURITE_CARE_KINDS = ["brushed", "treat", "played", "praised", "gift", "held_happy"];
const FAVOURITE_CARE_WORDS = {
  brushed: { ing: "being brushed", did: "brushed her", never: "brushing" },
  treat: { ing: "treats", did: "gave her a treat", never: "treats" },
  played: { ing: "playing ball with you", did: "played with her", never: "play" },
  praised: { ing: "being praised", did: "praised her", never: "praise" },
  gift: { ing: "presents", did: "gave her a present", never: "presents" },
  held_happy: { ing: "cuddles", did: "cuddled her", never: "cuddles" },
};
const FAVOURITE_TRUST_BONUS = 1.6;
const FAVOURITE_HAPPY_BONUS = 0.03;

const TRAIT_SHIFT_STEP = 0.1;
const TRAIT_SHIFT_MAX = 0.6;
const GROW_RULE_MAX = 3;
const GROW_COMFORTS = 6;
const GROW_HUNGRY_DAYS = 2;
const GROW_HARMS = 4;
const GROW_LOVED_DAYS = 5;
const GROW_PLAYS = 12;
const GROW_PICKED_ON = 6;
const UPBRINGING_SHIFT_SHARE = 0.3;

// The rules: [progress key, trait, direction, story line]
const GROW_ROOM_DAYS = 2; // a foal's days in a Warm (or Tense/Fearful) room
const GROWTH_RULES = {
  fearGone: { trait: "bravery", dir: 1, why: (n, p, x) => `Getting over ${p.poss} fear of ${x} made ${n} braver.` },
  comforted: { trait: "temper", dir: -1, need: GROW_COMFORTS, why: (n, p) => `Being comforted through so many frights made ${n} calmer.` },
  hungry: { trait: "appetite", dir: 1, need: GROW_HUNGRY_DAYS * DAY_LENGTH, why: (n, p) => `Going hungry so often made ${n} greedier.` },
  harmed: { trait: "bravery", dir: -1, need: GROW_HARMS, why: (n, p) => `Being hurt again and again made ${n} more timid.` },
  loved: { trait: "social", dir: 1, need: GROW_LOVED_DAYS, why: (n, p) => `Being loved made ${n} friendlier.` },
  played: { trait: "energy", dir: 1, need: GROW_PLAYS, why: (n, p) => `All that play made ${n} livelier.` },
  pickedOn: { trait: "temper", dir: 1, need: GROW_PICKED_ON, why: (n, p) => `Being picked on made ${n} grumpier.` },
  // Foals absorb the feel of the room they grow up in (Climate.js)
  warmRoom: { trait: "social", dir: 1, need: GROW_ROOM_DAYS * DAY_LENGTH, why: (n, p) => `Growing up in a warm, happy room made ${n} friendlier.` },
  fearRoom: { trait: "bravery", dir: -1, need: GROW_ROOM_DAYS * DAY_LENGTH, why: (n, p) => `Growing up in a frightened, tense room made ${n} more timid.` },
};

const personalityTicker = new Ticker(5);

function _pnHe(f) {
  return f.gender === "male" ? { sub: "he", obj: "him", poss: "his", Sub: "He" } : { sub: "she", obj: "her", poss: "her", Sub: "She" };
}
function _pnName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "It";
}
function _pnWords(kind, f) {
  const w = FAVOURITE_CARE_WORDS[kind];
  const p = _pnHe(f);
  return { ...w, did: w.did.replace("her", p.obj) };
}

// ---- Favourite care ----

function favouriteCareOf(f) {
  if (!f) return null;
  if (!FAVOURITE_CARE_KINDS.includes(f.favouriteCare)) {
    f.favouriteCare = FAVOURITE_CARE_KINDS[Math.floor(Math.random() * FAVOURITE_CARE_KINDS.length)];
  }
  return f.favouriteCare;
}

// Affection.giveAffection: a multiplier for this act's affection (1 = none)
function onFavouriteCare(f, type) {
  if (!f || !FAVOURITE_CARE_KINDS.includes(type) || favouriteCareOf(f) !== type) return 1;
  f.changeHappiness(FAVOURITE_HAPPY_BONUS);
  if (!f.favouriteFound && f.adopted) {
    f.favouriteFound = typeof getDayNumber === "function" ? getDayNumber() : 1;
    const p = _pnHe(f);
    const w = _pnWords(type, f);
    // Something else you've tried that it didn't care for as much
    const tried = new Set();
    if (typeof storyOf === "function") for (const e of storyOf(f)) if (e.k === "tally") for (const k of Object.keys(e.c)) tried.add(k);
    const other = FAVOURITE_CARE_KINDS.find((k) => k !== type && tried.has(k));
    const line = other
      ? `${p.Sub} was never much for ${FAVOURITE_CARE_WORDS[other].never}, but ${p.sub}'d melt when you ${w.did}.`
      : `Nothing made ${p.obj} happier than ${w.ing}.`;
    if (typeof recordStory === "function") recordStory("fav_found", f, { x: line });
    if (typeof noteTurningPoint === "function") noteTurningPoint(f, `${_pnName(f)} loves ${w.ing} most of all.`, { record: false });
  }
  return FAVOURITE_TRUST_BONUS;
}

// Magnifying glass row
function describeFavouriteCare(f) {
  if (!f || !f.adopted) return null;
  if (!f.favouriteFound) return ["Not found yet (try different kinds of care)", ""];
  return [_pnWords(favouriteCareOf(f), f).ing.replace(/^./, (c) => c.toUpperCase()), "good"];
}

// "Braver, calmer" - how its life has changed it (magnifying glass)
const TRAIT_SHIFT_WORDS = {
  bravery: ["braver", "more timid"],
  temper: ["grumpier", "calmer"],
  appetite: ["greedier", "pickier"],
  social: ["friendlier", "more of a loner"],
  energy: ["livelier", "lazier"],
};
function describeTraitShifts(f) {
  if (!f || !f.traitShift) return null;
  const out = [];
  for (const [k, v] of Object.entries(f.traitShift)) {
    if (Math.abs(v) < 0.05 || !TRAIT_SHIFT_WORDS[k]) continue;
    out.push(TRAIT_SHIFT_WORDS[k][v > 0 ? 0 : 1]);
  }
  if (!out.length) return null;
  const s = out.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- Personality growth ----

function traitShiftOf(f, key) {
  return (f && f.traitShift && f.traitShift[key]) || 0;
}

// Move a trait a step and say why in its story. Returns true if it moved.
function shiftTrait(f, rule, extra = "") {
  const r = GROWTH_RULES[rule];
  if (!r) return false;
  if (!f.traitShift || typeof f.traitShift !== "object") f.traitShift = {};
  if (!f.growthProgress || typeof f.growthProgress !== "object") f.growthProgress = {};
  const times = (f.growthProgress[`${rule}Times`] || 0);
  if (times >= GROW_RULE_MAX) return false;
  const now = f.traitShift[r.trait] || 0;
  const next = Math.max(-TRAIT_SHIFT_MAX, Math.min(TRAIT_SHIFT_MAX, now + r.dir * TRAIT_SHIFT_STEP));
  if (next === now) return false;
  f.traitShift[r.trait] = Math.round(next * 100) / 100;
  f.growthProgress[`${rule}Times`] = times + 1;
  const line = r.why(_pnName(f), _pnHe(f), extra);
  if (typeof recordStory === "function") recordStory("trait_shift", f, { x: line });
  return true;
}

function _pnAdd(f, key, amount) {
  if (!f.growthProgress || typeof f.growthProgress !== "object") f.growthProgress = {};
  f.growthProgress[key] = (f.growthProgress[key] || 0) + amount;
  const rule = GROWTH_RULES[key];
  if (rule && rule.need && f.growthProgress[key] >= rule.need) {
    f.growthProgress[key] = 0;
    shiftTrait(f, key);
  }
}

// Called by the hooks (StoryBook tallies and events)
function noteGrowthEvent(f, kind) {
  if (!f || !f.adopted) return;
  if (kind === "comforted") _pnAdd(f, "comforted", 1);
  else if (kind === "harmed") _pnAdd(f, "harmed", 1);
  else if (kind === "played") _pnAdd(f, "played", 1);
  else if (kind === "attacked") _pnAdd(f, "pickedOn", 1);
}

// Every 5 seconds: hunger, love, fears overcome
function updatePersonality(dt) {
  const step = personalityTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const day = typeof getDayNumber === "function" ? getDayNumber() : 0;
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted) continue;
    if (f.hunger < 0.2) _pnAdd(f, "hungry", step);
    // A foal takes in the feel of its room (Climate.js)
    if (f.growth < 1 && typeof climateOf === "function" && typeof getSceneConfig === "function" && getSceneConfig(f.scene).insidePlayerQuarters) {
      const label = climateOf(f.scene).label;
      if (label === "Warm") _pnAdd(f, "warmRoom", step);
      else if (label === "Tense" || label === "Fearful") _pnAdd(f, "fearRoom", step);
    }
    // Once a day: loved, and fears it got over
    if (!f.growthProgress || typeof f.growthProgress !== "object") f.growthProgress = {};
    const gp = f.growthProgress;
    if (gp.day !== day) {
      gp.day = day;
      if ((f.playerTrust || 0) >= 0.8) _pnAdd(f, "loved", 1);
      if (typeof fearsOf === "function") {
        const fears = fearsOf(f);
        const had = gp.fears || {};
        for (const [k, v] of Object.entries(fears)) {
          if ((had[k] || 0) >= 0.3 && v < 0.05) {
            const name = typeof FEARS !== "undefined" ? (FEARS.find((x) => x.key === k) || {}).name || k : k;
            shiftTrait(f, "fearGone", String(name));
          }
        }
        gp.fears = { ...fears };
      }
    }
  }
}

registerSystem("personality", updatePersonality, 17);
