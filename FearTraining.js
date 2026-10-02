// ---------------------------------------------------------------------------
// Strict (fear-based) training (design doc Phase 4, risk #7): a complete
// path of its own, not a dead end.
//
// The trick menu has a style switch (trainingStyle: "kind" or "strict",
// saved). Strict:
//   - it doesn't refuse: fear makes it try even if it's scared of you or
//     doesn't like you (not a Smarty or a Rebel, though; Titles.js)
//   - how often it gets it right comes from skill and fear, not love
//     (fearTrickChance); holding the stick near a stick-conditioned one
//     helps (Care.js)
//   - got it right: "Nod" (a curt yes, FEAR_LEARN.nod) or a treat as usual
//   - got it wrong: for a few seconds you can punish it - "Scold"
//     (FEAR_LEARN.scold) or "Smack" (FEAR_LEARN.smack, a whack with the
//     stick as training: fear, Memory.js). Fast at first, then it plateaus
//     (x the part still to learn), so it takes about 1.5x the sessions.
//   - every punishment costs trust and happiness, adds a little fear, makes
//     the room tense (Climate.js), strains it towards breaking (Titles.js)
//     and goes in its story ("drilled")
// What's learnt through fear sticks for good like any trick (f.trickFear:
// how much of each came from fear). A trick learnt mostly through fear
// (fearShare >= 0.5) is done instantly and reliably, never refused, but
// joylessly (a miserable face, no happy chatter); the Trick Show judges it
// lower (up to FEAR_SHOW_COST), and dark-market buyers like it (Buyers.js).
// Lessons, strict: fear makes it listen (it doesn't matter if it loves you),
// but its views soften only half as much (it stops out of fear; the
// prejudice goes slowly), and it costs the same as a scolding.
// ---------------------------------------------------------------------------

const FEAR_LEARN = { nod: 0.03, scold: 0.05, smack: 0.07 };
const FEAR_PLATEAU_MIN = 0.3; // learning never drops below this share
const FEAR_PUNISH_WINDOW = 5;
const FEAR_SHOW_COST = 0.3;
const FEAR_LESSON_VIEWS = 0.5; // share of a view lesson that sticks when strict

let trainingStyle = "kind";

function isStrict() {
  return trainingStyle === "strict";
}
function toggleTrainingStyle() {
  trainingStyle = isStrict() ? "kind" : "strict";
  return trainingStyle;
}

// Does fear make it do as it's told (no refusing)?
function obeysFromFear(f, key = null) {
  if (!f) return false;
  if (key && fearShare(f, key) >= 0.5 && trickSkill(f, key) >= TRICK_KNOWN) return true; // (a drilled trick)
  if (typeof titleOf === "function" && titleOf(f) === "Broken") return true;
  if (typeof stickHeldNear === "function" && stickHeldNear(f)) return true;
  return isStrict();
}

function fearShare(f, key) {
  const s = typeof trickSkill === "function" ? trickSkill(f, key) : 0;
  const fr = (f && f.trickFear && f.trickFear[key]) || 0;
  return s > 0 ? Math.min(1, fr / s) : 0;
}

// Strict: how often it gets it right
function fearTrickChance(f, key) {
  const s = trickSkill(f, key);
  let p = 0.25 + 0.65 * s + 0.2 * (f.playerFear || 0);
  if (typeof stickHeldNear === "function" && stickHeldNear(f)) p += 0.15;
  if (typeof titleOf === "function" && titleOf(f) === "Broken") p += 0.2;
  if (f.hunger < 0.3) p *= 0.8;
  return Math.max(0.1, Math.min(0.97, p));
}

// Tricks.trickChance: what fear adds on top of the usual
function fearChanceBoost(f, key, p) {
  if (isStrict()) return Math.max(p * 0.6, fearTrickChance(f, key)); // (love matters little here)
  // A trick drilled in with fear: instant and reliable, whoever asks
  if (fearShare(f, key) >= 0.5) return Math.max(p, 0.5 + 0.5 * trickSkill(f, key));
  if (typeof titleOf === "function" && titleOf(f) === "Broken") return Math.max(p, fearTrickChance(f, key));
  return p;
}

function fearLearnRate(f) {
  return 0.8 + 0.4 * (f.playerFear || 0);
}

function _ftLearn(f, key, amount) {
  const plateau = Math.max(FEAR_PLATEAU_MIN, 1 - trickSkill(f, key));
  const got = _trLearn(f, key, amount * plateau * fearLearnRate(f));
  if (!f.trickFear || typeof f.trickFear !== "object") f.trickFear = {};
  f.trickFear[key] = Math.round(((f.trickFear[key] || 0) + got) * 1000) / 1000;
  return got;
}

// The cost of drilling it (punishments; strict lessons)
function _ftCost(f, trust = 0.015) {
  if (typeof loseAffection === "function") loseAffection(f, "drilled", trust, false);
  f.changeHappiness(-0.03);
  if (typeof recordStory === "function") recordStory("drilled", f);
  if (typeof noteTitleHarm === "function") noteTitleHarm(f, 0.2, "drilled");
}

// Reward phase in strict mode: a curt nod
function fearNod(f, key) {
  const got = _ftLearn(f, key, FEAR_LEARN.nod);
  f.expressionOverride = "MISERABLE";
  f.expressionOverrideTimer = 1;
  return got;
}

// Punish a wrong try: "scold" or "smack"
function fearPunish(f, key, how) {
  if (!f || !f.isAlive) return 0;
  const got = _ftLearn(f, key, FEAR_LEARN[how] || FEAR_LEARN.scold);
  if (how === "smack") {
    if (typeof notifyViolence === "function") notifyViolence(f, false, "stick", true); // (strain comes with the harm memory, Titles.js)
    f.changeHappiness(-0.03);
    if (typeof recordStory === "function") recordStory("drilled", f);
  } else {
    if (typeof changePlayerFear === "function") changePlayerFear(f, 0.015);
    _ftCost(f);
  }
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 1.5;
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["TRICK", "PUNISHED"], f), true);
  return got;
}

// A trick drilled with fear is done joylessly (Tricks.tryTrick)
function isJoylessTrick(f, key) {
  return fearShare(f, key) >= 0.5 || (typeof titleOf === "function" && titleOf(f) === "Broken");
}

// Tricks.trickShowScore: judges see the fear
function fearShowSkill(f, key) {
  return trickSkill(f, key) * (1 - FEAR_SHOW_COST * fearShare(f, key));
}

// ---- Lessons, strict ----

function fearLessonChance(f, key) {
  let p = 0.35 + 0.5 * (f.playerFear || 0);
  if (typeof titleOf === "function" && titleOf(f) === "Broken") p += 0.2;
  if (key === "smarty") p *= LESSON_SMARTY_CHANCE;
  return Math.max(0.05, Math.min(0.9, p));
}

// Lessons.giveLesson, after a strict lesson sank in: views only soften by half
function fearLessonAfter(f, key) {
  const back = 1 - FEAR_LESSON_VIEWS;
  if (key === "colours") f.coloristDegree = Math.min(1, (f.coloristDegree || 0) + LESSON_COLOURS * back);
  else if (key === "alicorns" && typeof addAlicornComfort === "function") addAlicornComfort(f, -LESSON_ALICORNS * back);
  else if (key === "brave" && typeof FEARS !== "undefined" && typeof changeFear === "function") for (const fe of FEARS) if (fearOf(f, fe.key) > 0) changeFear(f, fe.key, LESSON_BRAVE * back);
  else if (key === "table") f.tableCourage = Math.max(0, (f.tableCourage || 0) - LESSON_TABLE * back);
}

// Every strict lesson costs, sunk in or not
function fearLessonCost(f) {
  if (typeof changePlayerFear === "function") changePlayerFear(f, 0.01);
  _ftCost(f);
}

function describeFearTraining(f) {
  if (!f || !f.trickFear) return null;
  const drilled = TRICKS.filter((t) => trickSkill(f, t.key) >= TRICK_KNOWN && fearShare(f, t.key) >= 0.5).map((t) => t.name);
  return drilled.length ? [`Drilled with fear: ${drilled.join(", ")} (instant, joyless)`, "bad"] : null;
}
