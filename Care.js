// ---------------------------------------------------------------------------
// Care actions (design doc Phase 4): the "Other" row of the right-click menu
// (Tricks.rightClickActions).
//
//   Sit with   (kind) only when it's sad, grieving or frightened. You stay
//              with it a while (SIT_WITH_TIME): it sits by you, a fright
//              ends, it cheers up and its grief eases as the time passes,
//              and it trusts you more. Heals a Broken or Survivor fluffy
//              (Titles.js). Once per SIT_WITH_REST each.
//   Praise     (kind) quick, free "Good fluffy!" outside tricks: a little
//              affection and cheer, PRAISE_PER_DAY a day each.
//   Scold      (harsh, mild) stops what it's doing at once. If it's just
//              done something (a fight, mischief, an accident) it's a quick
//              lesson: a fight settles and a Smarty behaves a bit, mischief
//              stops for a while, an accident teaches the litter box fast.
//              Costs a little trust, a little fear, a story mark, and
//              tension in the room. Scolding for nothing is just unkind.
//   Time-out   (harsh, mild) off to a corner for TIME_OUT_TIME: it can't
//              fight or be fought, a Smarty cools off; it sulks and remembers.
//
// Conditioning: fluffies link things to what happens with them.
//   - brushing in the evening (after BRUSH_EVENING_HOUR): after
//     CONDITION_AT of those, brushing before bed calms it (fears and
//     happiness) and it sleeps better
//   - food from you: after CONDITION_AT bowls you fill in front of it, it
//     comes running (a hungry one, from anywhere in the room) when you fill one
//   - the stick: after CONDITION_AT hits with the Sorry Stick (or any harm
//     from the stick), holding the stick near it makes it freeze and obey:
//     it won't refuse a trick and does it more reliably (Tricks.js)
//   - your hand: fear makes it flinch (Climate.js)
// Shown in the magnifying glass (Mind, "Conditioned").
// ---------------------------------------------------------------------------

const SIT_WITH_TIME = 20; // game seconds
const SIT_WITH_REST = HOUR_LENGTH;
const SIT_WITH_JOY = 0.12; // over the whole sit
const SIT_WITH_GRIEF = 0.3;
const PRAISE_PER_DAY = 3;
const SCOLD_RECENT = 20; // game seconds: "just now"
const TIME_OUT_TIME = 60;
const CONDITION_AT = 10;
const BRUSH_EVENING_HOUR = 17;
const STICK_FREEZE_RANGE = 160;

Object.assign(MEMORY_TEXT, {
  sat_with: "You sat with it when it was sad",
  scolded: "You scolded it",
  time_out: "Put in a time-out",
});
if (typeof AFFECTION_ACTS !== "undefined") AFFECTION_ACTS.sat_with = { amount: 0.05, perDay: 2 };

function _caDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : Math.floor(timePlayed / DAY_LENGTH) + 1;
}
function _caSay(f, key) {
  if (f && !f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING" && typeof getDialogue === "function") f.speak(getDialogue(["CARE", key], f), true);
}
function _caToday(f) {
  const d = _caDay();
  if (!f.careToday || f.careToday.day !== d) f.careToday = { day: d, praise: 0 };
  return f.careToday;
}

// ---- What needs it ----

function needsSitWith(f) {
  if (!f || !f.isAlive || !f.adopted || f.currentStateKey === "SLEEPING") return null;
  if (typeof isFrightened === "function" && isFrightened(f)) return "frightened";
  if (f.separation && (f.separation.grief || 0) >= 0.2) return "grieving";
  if (f.happiness < 0.35) return "sad";
  if (typeof titleOf === "function" && titleOf(f) === "Broken") return "broken";
  return null;
}

// What it just did that a scolding could be for (null: nothing)
function recentMisdeed(f) {
  const now = timePlayed;
  const recent = (t) => typeof t === "number" && now >= t && now - t <= SCOLD_RECENT;
  // (the worst first: Batch 12, mothers and foals)
  if (recent(f._cannibalAt)) return "cannibal";
  if (recent(f._badMumAt)) return "badmum";
  if (recent(f._foalAttackAt)) return "hurt_foal";
  if (recent(f._bullyAt)) return "bully";
  if (recent(f._lastAttackAt) || (f.chaseTarget && f.chaseReason && f.chaseReason !== "MATING")) return "fight";
  if (recent(f._mischiefAt)) return "mischief";
  if (recent(f._accidentAt)) return "accident";
  return null;
}

// ---- The right-click row ----

function careActions(f) {
  if (!f || !f.isAlive || !f.adopted) return [];
  const out = [];
  const why = needsSitWith(f);
  const now = timePlayed;
  if (why && !(f.sitWith && now < f.sitWith.until) && !(typeof f._sitWithAt === "number" && now >= f._sitWithAt && now - f._sitWithAt < SIT_WITH_REST)) {
    out.push({ key: "sitwith", name: "Sit with", sub: why, run: (x) => sitWith(x) });
  }
  if (f.currentStateKey !== "SLEEPING" && _caToday(f).praise < PRAISE_PER_DAY) {
    const deed = recentGoodDeed(f);
    out.push({ key: "praise", name: "Praise", sub: deed ? GOOD_DEED_WORDS[deed] : `${PRAISE_PER_DAY - _caToday(f).praise} left today`, run: (x) => praiseFluffy(x) });
  }
  if (f.currentStateKey !== "SLEEPING") {
    const m = recentMisdeed(f);
    out.push({ key: "scold", name: "Scold", sub: m ? MISDEED_WORDS[m] : "harsh", harsh: true, run: (x) => scoldFluffy(x) });
    if (!(f.timeOut && now < f.timeOut.until)) out.push({ key: "timeout", name: "Time-out", sub: "harsh", harsh: true, run: (x) => timeOut(x) });
  }
  return out;
}

// ---- More to praise or punish (batch 12) ----
//
// Misdeeds (each "just now", SCOLD_RECENT, the worst first):
//   cannibal   it ate (or bit to eat) another fluffy: less willing to again
//              (cannibalismAcceptance - SCOLD_CANNIBAL)
//   badmum     a mum who kept the milk from a foal, hurt one or turned one
//              away (BadMummah.js): a step towards loving all her babies
//              (babyLove + SCOLD_BABY_LOVE, Runts.js)
//   hurt_foal  a grown fluffy that hurt a foal (a stallion too): its
//              attacks stop a while, and told off often enough it grows
//              calmer (Personality.js)
//   bully      a foal picking on another (FoalLife.js): less colour
//              prejudice, less afraid of alicorns, less of a bully
// Good deeds (praise one just after, GOOD_DEED_RECENT): a mum singing to
// her foals, holding herself back on her last chance, sharing her milk
// (feeding the foals that aren't her bestest, or someone else's), taking
// in an orphan, nursing a foal she'd once have turned away, and a foal
// standing up for one being picked on. Praise then: more affection, and a
// mum on her last chance gets a strike off (BadMummah.js) and loves her
// babies a little more.
const SCOLD_CANNIBAL = 0.25;
const SCOLD_BABY_LOVE = 0.1;
const GOOD_DEED_RECENT = 45; // game seconds
const MISDEED_WORDS = {
  fight: "for fighting",
  mischief: "for mischief",
  accident: "for the mess",
  cannibal: "for eating fluffy",
  badmum: "bad mummah",
  hurt_foal: "hurt a foal",
  bully: "for bullying",
};
const GOOD_DEED_WORDS = {
  sang: "sang to foals",
  held_back: "was a good mum",
  shared: "shared milk",
  fostered: "took one in",
  accepted: "fed a foal",
  protected: "stood up for one",
};
// (the growth rule "toldOffFoals" is added in FoalLife.js, after Personality.js)

function noteGoodDeed(f, kind) {
  if (!f || !f.isAlive) return;
  f._goodDeed = { at: timePlayed, kind };
}

function recentGoodDeed(f) {
  const d = f && f._goodDeed;
  if (!d || typeof d.at !== "number" || timePlayed < d.at || timePlayed - d.at > GOOD_DEED_RECENT) return null;
  return d.kind;
}

// A mum's slip (Favourites, Runts, attacks): a misdeed now, and a slip
// for her last chance (BadMummah.js)
function noteMumMisdeed(m, f, what) {
  if (!m || !m.isAlive) return;
  m._badMumAt = timePlayed;
  if (typeof noteMumSlip === "function") noteMumSlip(m, f, what);
}

// HorseSocial.performAttack: a grown fluffy hurting a foal
function noteFoalAttacked(attacker, target, intent) {
  if (!attacker || !target || intent === "RETALIATION" || target.growth >= 1 || attacker.growth < 1) return;
  if (intent === "BULLY" && (attacker.bullyScore || 0) > 0) return; // (a bully's shove: "for bullying", FoalLife.js)
  attacker._foalAttackAt = timePlayed;
  if (target.motherId === attacker.id && attacker.gender === "female") noteMumMisdeed(attacker, target, "hurt");
}

// Scolded just after one of the new misdeeds: what it learns
function scoldLesson(f, misdeed) {
  const learn = typeof smartsLearn === "function" ? smartsLearn(f) : 1;
  if (misdeed === "cannibal") {
    f.cannibalismAcceptance = Math.max(0, (f.cannibalismAcceptance || 0) - SCOLD_CANNIBAL * learn);
    f.cannibalTarget = null;
  } else if (misdeed === "badmum") {
    f.babyLove = Math.min(1, (f.babyLove || 0) + SCOLD_BABY_LOVE * learn);
  } else if (misdeed === "hurt_foal") {
    f.attackCooldown = Math.max(f.attackCooldown || 0, 30);
    if (typeof _pnAdd === "function") _pnAdd(f, "toldOffFoals", 1);
  } else if (misdeed === "bully") {
    if (typeof LESSON_COLOURS === "number") f.coloristDegree = Math.max(0, (f.coloristDegree || 0) - LESSON_COLOURS * 0.5 * learn);
    if (typeof addAlicornComfort === "function") addAlicornComfort(f, 0.04 * learn);
    f.bullyScore = Math.max(0, (f.bullyScore || 0) - 1);
    f._bullyJob = null;
  }
}

// Praised just after a good deed
function praiseGoodDeed(f, deed) {
  if (typeof giveAffection === "function") giveAffection(f, "praised", 1);
  if (deed === "sang" || deed === "held_back" || deed === "shared" || deed === "fostered" || deed === "accepted") {
    f.babyLove = Math.min(1, (f.babyLove || 0) + 0.05);
    if (typeof clearMumStrike === "function") clearMumStrike(f, "praised");
  }
  if (deed === "accepted") {
    if (typeof addAlicornComfort === "function") addAlicornComfort(f, 0.03);
    f.coloristDegree = Math.max(0, (f.coloristDegree || 0) - 0.03);
  }
  if (deed === "protected") f.changeHappiness(0.03, "Praised for being brave");
}

// ---- Kind ----

function sitWith(f) {
  const why = needsSitWith(f);
  if (!why) return false;
  const now = timePlayed;
  f._sitWithAt = now;
  f.sitWith = { until: now + SIT_WITH_TIME, why, left: SIT_WITH_TIME };
  if (typeof isFrightened === "function" && isFrightened(f) && typeof onComfortedByYou === "function") onComfortedByYou(f, "sat");
  f.trickNow = null;
  f.expressionOverride = "RELIEF";
  f.expressionOverrideTimer = 2;
  _caSay(f, "SIT_WITH");
  if (typeof addUIMessage === "function") addUIMessage(`You sit with ${fluffyDisplayName(f)} for a while.`);
  return true;
}

// Every care tick while you're sitting with it
function _sitWithTick(f, step) {
  const s = f.sitWith;
  const d = Math.min(step, s.left);
  s.left -= d;
  const share = d / SIT_WITH_TIME;
  f.changeHappiness(SIT_WITH_JOY * share, "You sat with it");
  if (f.separation && typeof f.separation.grief === "number") {
    f.separation.grief = Math.max(0, f.separation.grief - SIT_WITH_GRIEF * share);
    // ...and the ache it grows back towards eases too, so it lasts
    if (typeof f.separation.bond === "number") f.separation.bond = Math.max(0, f.separation.bond - SIT_WITH_GRIEF * share * 0.5);
  }
  if (typeof f.missingOwner === "number") f.missingOwner = Math.max(0, f.missingOwner - 0.1 * share);
  if (s.left <= 0 || timePlayed >= s.until) {
    f.sitWith = null;
    if (typeof giveAffection === "function") giveAffection(f, "sat_with");
    if (typeof noteTitleCare === "function") noteTitleCare(f, "sat_with"); // healing (Titles.js; sat_with isn't an affection act)
    if (typeof recordStory === "function") recordStory("comforted", f);
    f.expressionOverride = "GOOD_UPSIES";
    f.expressionOverrideTimer = 2;
    _caSay(f, "SAT_WITH_DONE");
  }
}

function praiseFluffy(f) {
  if (!f || !f.isAlive || f.currentStateKey === "SLEEPING") return false;
  const t = _caToday(f);
  if (t.praise >= PRAISE_PER_DAY) return false;
  t.praise++;
  if (typeof giveAffection === "function") giveAffection(f, "praised", 2);
  f.changeHappiness(0.03, "Praised");
  // Just did something good: it learns from it
  const deed = recentGoodDeed(f);
  if (deed) {
    f._goodDeed = null;
    praiseGoodDeed(f, deed);
  }
  f.expressionOverride = "GOOD_UPSIES";
  f.expressionOverrideTimer = 1.5;
  _caSay(f, "PRAISED");
  return true;
}

// ---- Harsh (mild) ----

function scoldFluffy(f) {
  if (!f || !f.isAlive) return null;
  const misdeed = recentMisdeed(f);
  // It stops, now
  f.trickNow = null;
  if (f.chaseTarget) {
    const t = f.chaseTarget;
    f.chaseTarget = null;
    f.chaseReason = null;
    if (typeof smartySettle === "function" && f.isSmarty && f.isSmarty() && t) smartySettle(f, t);
  }
  f.attackCooldown = Math.max(f.attackCooldown || 0, 10);
  if (typeof f.initBehavior === "function" && f.currentStateKey !== "SLEEPING") f.initBehavior("SITTING");
  f.stateTimer = 2;
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 2;
  // The lesson
  if (misdeed === "fight") {
    if (f.isSmarty && f.isSmarty()) f.smartyReform = Math.min(0.95, (f.smartyReform || 0) + 0.03);
    if (typeof f.smartyProvokedUntil === "number") f.smartyProvokedUntil = 0;
  } else if (misdeed === "mischief") {
    f._nextMischief = timePlayed + DAY_LENGTH * (typeof smartsLearn === "function" ? smartsLearn(f) : 1); // (a clever one remembers longer)
  } else if (misdeed === "accident") {
    f.pottyTraining = Math.min(1, (f.pottyTraining || 0) + 0.05 * (typeof smartsLearn === "function" ? smartsLearn(f) : 1));
  } else if (misdeed) {
    scoldLesson(f, misdeed);
  }
  // The cost: a telling-off is a small thing (three times as much for nothing)
  const k = misdeed ? 1 : 3;
  if (typeof loseAffection === "function") loseAffection(f, "scolded", 0.01 * k);
  if (typeof changePlayerFear === "function") changePlayerFear(f, 0.01 * k);
  f.changeHappiness(-0.03 * k, "Scolded");
  if (typeof recordStory === "function") recordStory("scolded", f);
  if (typeof noteTitleHarm === "function") noteTitleHarm(f, 0.1 * k, "scolded"); // (Titles.js; a stick hit is 1)
  if (misdeed && typeof noteTitleCare === "function") noteTitleCare(f, "scolded"); // (firm care for a Spoiled one)
  _caSay(f, misdeed ? "SCOLDED" : "SCOLDED_NOTHING");
  return misdeed || "nothing";
}

function timeOut(f) {
  if (!f || !f.isAlive) return false;
  const now = timePlayed;
  // The nearest corner
  const w = typeof sceneW === "function" ? sceneW(f.scene) : 1280;
  const top = typeof sceneTop === "function" ? sceneTop(f.scene) + 50 : 200;
  const x = f.x < w / 2 ? 70 : w - 70;
  f.timeOut = { until: now + TIME_OUT_TIME, x, y: top + 20 };
  f.trickNow = null;
  if (f.chaseTarget && f.isSmarty && f.isSmarty() && typeof smartySettle === "function") smartySettle(f, f.chaseTarget);
  f.chaseTarget = null;
  f.chaseReason = null;
  // Nobody fights it in there
  for (const o of fluffies) {
    if (o.chaseTarget === f) {
      o.chaseTarget = null;
      o.chaseReason = null;
    }
  }
  if (typeof loseAffection === "function") loseAffection(f, "time_out", 0.02);
  f.changeHappiness(-0.05, "Time-out");
  if (typeof recordStory === "function") recordStory("scolded", f);
  if (typeof noteTitleHarm === "function") noteTitleHarm(f, 0.5, "time_out");
  _caSay(f, "TIME_OUT");
  return true;
}

function inTimeOut(f) {
  return !!(f && f.timeOut && timePlayed < f.timeOut.until && timePlayed >= f.timeOut.until - TIME_OUT_TIME - 1);
}

// Holds it in the corner, or by you while you sit with it
class CareDesire extends Desire {
  constructor() {
    super("Care");
  }
  evaluate(h) {
    if (!h.isAlive || h.isDragging || h.placedOn) return 0;
    if (inTimeOut(h)) return 80;
    if (h.sitWith && timePlayed < h.sitWith.until) return 75;
    return 0;
  }
  execute(h) {
    if (inTimeOut(h)) {
      const t = h.timeOut;
      if (Math.hypot(h.x - t.x, h.y - t.y) > 40) {
        if (!h.isMovingOrRunning()) h.initBehavior("MOVING");
        h.setTargetPosition(t.x, t.y);
      } else if (h.currentStateKey !== "SITTING") {
        h.initBehavior("SITTING");
        h.stateTimer = 3;
        h.expressionOverride = "MISERABLE";
        h.expressionOverrideTimer = 3;
      }
      return true;
    }
    if (h.currentStateKey !== "SITTING" && h.currentStateKey !== "LYING") {
      h.initBehavior("SITTING");
      h.stateTimer = 3;
    }
    return true;
  }
}

// ---- Conditioning ----

function _caCond(f) {
  if (!f.conditioned || typeof f.conditioned !== "object") f.conditioned = {};
  return f.conditioned;
}

// Brush code (Memory.onFluffyBrushed)
function noteConditionBrush(f) {
  if (!f || !f.adopted) return;
  const hour = typeof gameHour === "function" ? gameHour() : 12;
  if (hour < BRUSH_EVENING_HOUR) return;
  const c = _caCond(f);
  c.brush = (c.brush || 0) + 1;
  if (c.brush >= CONDITION_AT) {
    // Brushing before bed calms it
    f.changeHappiness(0.02, "Brushed before bed");
    if (typeof fearsOf === "function" && typeof changeFear === "function") {
      const fears = fearsOf(f);
      for (const k of Object.keys(fears)) if (fears[k] > 0) changeFear(f, k, -0.01);
    }
    f._calmBedtime = timePlayed;
  }
}

// Affection.onBowlFilledByYou: the ones watching link food with you;
// conditioned hungry ones come running
function noteConditionFeed(bowl) {
  if (!bowl || typeof fluffies === "undefined") return;
  // (holding the bag over a bowl only counts once a minute)
  const now = timePlayed;
  if (typeof bowl._condAt === "number" && now >= bowl._condAt && now - bowl._condAt < 60) return;
  bowl._condAt = now;
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted || f.scene !== bowl.scene || f.currentStateKey === "SLEEPING") continue;
    const c = _caCond(f);
    c.food = (c.food || 0) + 1;
    if (c.food >= CONDITION_AT && f.hunger < 0.7 && (typeof canBeMovedExternally === "function" ? canBeMovedExternally(f) : !f.isDragging && !inTimeOut(f))) {
      f.initBehavior("RUNNING");
      f.setTargetPosition(bowl.x + (Math.random() - 0.5) * 60, bowl.y + 20);
      f.expressionOverride = "GOOD_UPSIES";
      f.expressionOverrideTimer = 1.5;
    }
  }
}

// Memory.notePlayerViolence with the stick
function noteConditionStick(f) {
  if (!f) return;
  const c = _caCond(f);
  c.stick = (c.stick || 0) + 1;
}

function isStickConditioned(f) {
  return !!(f && f.conditioned && (f.conditioned.stick || 0) >= CONDITION_AT);
}

// Are you holding the stick near it? (it freezes and obeys)
function stickHeldNear(f) {
  if (!isStickConditioned(f) || typeof mouse === "undefined") return false;
  const held = typeof objects !== "undefined" && typeof SorryStick !== "undefined" && objects.some((o) => o.isDragging && o instanceof SorryStick);
  if (!held) return false;
  return Math.hypot(mouse.x - f.x, mouse.y - f.y) < STICK_FREEZE_RANGE;
}

function describeConditioning(f) {
  const c = f && f.conditioned;
  if (!c) return null;
  const parts = [];
  if ((c.brush || 0) >= CONDITION_AT) parts.push("calmed by a bedtime brush");
  if ((c.food || 0) >= CONDITION_AT) parts.push("comes running when you fill a bowl");
  if ((c.stick || 0) >= CONDITION_AT) parts.push("freezes at the sight of the stick");
  if (!parts.length) return null;
  const text = parts.join(", ");
  return [text.charAt(0).toUpperCase() + text.slice(1), (c.stick || 0) >= CONDITION_AT ? "bad" : "good"];
}

// ---- Every second ----
const careTicker = new Ticker(1);
function updateCare(dt) {
  const step = careTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    if (f.sitWith) {
      if (!f.adopted) f.sitWith = null;
      else _sitWithTick(f, step);
    }
    if (f.timeOut && timePlayed >= f.timeOut.until) {
      f.timeOut = null;
      f.expressionOverride = "MISERABLE";
      f.expressionOverrideTimer = 2;
      _caSay(f, "TIME_OUT_OVER");
    }
    // Frozen by the stick
    if (f.adopted && f.scene === (typeof currentScene !== "undefined" ? currentScene : null) && stickHeldNear(f) && f.currentStateKey !== "SLEEPING") {
      if (f.isMovingOrRunning && f.isMovingOrRunning()) f.initBehavior("IDLE");
      f.expressionOverride = "CRYING_SHOCKED";
      f.expressionOverrideTimer = 1.2;
    }
  }
}

registerSystem("care", updateCare, 134);
