// ---------------------------------------------------------------------------
// Foal life (batch 12): forgetting mum, wandering off, not understanding
// death, and foals picking on foals.
//
// FORGETTING MUM: a foal kept in another area from its mum (still hers to
// nurse) counts the time apart (f.mumApart, saved; back together it falls
// twice as fast). After FORGET_AFTER for its age - a few hours for a
// chirpy, longer for a crawler, longest for a walking foal - it doesn't
// know her any more (f.forgotMum, saved): it won't drink from her or run
// to her when it's scared, it shies away from her, and she grieves. It can
// get to know her again: RELEARN_TIME near her, awake, in the same area.
// (A foal in the incubator is Premature.js's business.)
//
// WANDERING: a curious foal (brave and lively, Traits.js) that can crawl,
// isn't hungry and has mum near sometimes sets off on its own
// (WANDER_CHANCE a game hour) somewhere well away from her - by the river,
// right to the water's edge. Mum notices after a little while (if she can
// see or hear), calls for it and goes to fetch it.
//
// NOT UNDERSTANDING DEATH: a young foal (growth under CONFUSED_GROWTH)
// whose mum, brother or sister dies near it doesn't understand at first.
// For CONFUSED_TIME (less for a clever foal, over at once once the body
// starts to smell) it goes to the body, tries to nurse from its dead mum
// or nudges its dead sibling to wake up and play; then it understands,
// and grieves as usual (HorseFamily). A clever herd takes such a body away
// sooner (HerdWars.js).
//
// FOALS BULLYING FOALS: a walking foal that sees an alicorn foal (World
// Alicorn Intolerance on, and it isn't used to them) or a poopie-coated one
// (World Colorism on, and it looks down on that colour) as a "munstah"
// may pick on it (BULLY_CHANCE a game hour, more for a grumpy foal and an
// old hand at it; then not again for BULLY_REST): it goes over and shoves it off the milk (a shove: it
// stings, never kills). Other foals who feel the same join in, calling
// names. The one picked on grows timid (Personality.js "pickedOnFoal");
// the ringleader grows grumpier and into a bully (f.bullyScore, saved). A
// brave friend or sibling may stand up for it (a good deed to praise).
// Scold it just after (Care.js) and it learns a little.
// PLAY NICE (a lesson, only with a stuffed toy in the room): it never
// turns on a stuffy by itself - you have to teach it. Each lesson that
// sinks in (LESSON_PLAY_NICE) it takes it out on the stuffy instead -
// "bad munstah stuffy!" - then says sorry and makes up with it, and is a
// bit less of a bully. Taught, when it next wants to pick on a foal and a
// stuffy is near, it goes to the stuffy instead - as often as it's been
// taught (f.playNice, saved: half taught, half the time). Shown in the
// magnifying glass (Friends, "Bullying").
// PREJUDICE AND BULLYING are two things: prejudice (coloristDegree, alicorn
// fear) is who it sees as a munstah; the bully score is whether it acts on
// it. No prejudice, no bullying, whatever the score: the Colours and
// Alicorns lessons cure the cause, Play nice the shoving.
// GROWN BULLIES: a fluffy that grew up a bully (bullyScore BULLY_GROWN or
// more) keeps at it: it picks on alicorns and poopie-coated fluffies of any
// age (the same shove), unless taught Play nice. A grown fluffy taught Play
// nice (fully) as a foal or later: its "grumpier" from bullying is taken
// back, it's likelier to stand up for anyone picked on (not just friends),
// and the foals it raises don't pick up its bullying.
// RAISED BY A BULLY: a foal growing up in the same room as a mum or dad who
// is a bully (and not taught Play nice) picks up the habit
// (BULLY_HABIT_PER_DAY, at most BULLY_HABIT_MAX; f.bullyHabit, saved): it
// starts picking on others sooner. (It picks up their views too, as ever:
// Upbringing.js.)
// ---------------------------------------------------------------------------

const FORGET_AFTER = [
  [CHIRPY_THRESHOLD, 4 * HOUR_LENGTH], // a chirpy
  [WALKY_THRESHOLD, 8 * HOUR_LENGTH], // a crawler
  [1, 16 * HOUR_LENGTH], // a walking foal
];
const RELEARN_TIME = 3 * HOUR_LENGTH;
const RELEARN_NEAR = 220;
const WANDER_CHANCE = 0.2; // a game hour, an average curious foal
const WANDER_MAX_GROWTH = 0.6;
const WANDER_FAR = [350, 700]; // px from mum
const WANDER_GIVE_UP = 150; // game seconds
const WANDER_NOTICE = 12; // game seconds before mum notices
const WANDER_NOTICE_FAR = 260; // px: far enough for her to notice
const CONFUSED_GROWTH = 0.6;
const CONFUSED_TIME = 100; // game seconds (2 hours)
const CONFUSED_ROT = 0.3; // the body smells: it understands
const BULLY_CHANCE = 0.2; // a game hour
const BULLY_REST = 3 * HOUR_LENGTH; // after picking on one, before it starts again
const BULLY_GROWN_RATE = 0.5; // a grown bully starts half as often (BULLY_REST x2)
const BULLY_RANGE = 420;
const BULLY_GANG_RANGE = 250;
const BULLY_PLUSHIE_RANGE = 320;
const LESSON_PLAY_NICE = 0.25; // 4 lessons and it's learnt
const BULLY_GROWN = 4; // bullyScore: "a bully"
const BULLY_PROTECT_CHANCE = 0.3;
const BULLY_HABIT_PER_DAY = 0.75; // bully habit a foal picks up a game day, raised by a bully
const BULLY_HABIT_MAX = 1.5;
const foalLifeTicker = new Ticker(5);

if (typeof GROWTH_RULES !== "undefined") {
  GROWTH_RULES.toldOffFoals = { trait: "temper", dir: -1, need: 3, why: (n) => `Being told off for hurting foals made ${n} calmer.` };
  GROWTH_RULES.pickedOnFoal = { trait: "bravery", dir: -1, need: 3, why: (n) => `Being picked on by the other foals made ${n} timid.` };
  GROWTH_RULES.bullyFoal = { trait: "temper", dir: 1, need: 3, why: (n) => `Picking on other foals made ${n} a bully.` };
}

function _folName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Fluffy";
}
function _folMum(f) {
  if (!f || f.motherId === null || f.motherId === undefined) return null;
  return fluffyById(f.motherId) || null;
}
function _folAwake(f) {
  return f.isAlive && f.currentStateKey !== "SLEEPING" && !f.isDragging && !f.placedOn;
}

// ---- Forgetting mum ----

function forgetAfter(f) {
  for (const [g, t] of FORGET_AFTER) if (f.growth < g) return t;
  return Infinity;
}

// Hers to nurse (or taken from her), still a foal, not in the incubator
function _folStillHers(mum, f) {
  if (!mum || !mum.isAlive || f.growth >= 1) return false;
  if (typeof Incubator !== "undefined" && f.currentCage instanceof Incubator) return false;
  return (relationships[mum.id] || {})[f.id] === "baby_child";
}

function foalForgetsMum(f, mum = _folMum(f)) {
  f.forgotMum = true;
  f.mumApart = 0;
  f._relearn = 0;
  if (mum && mum.isAlive) {
    mum.changeHappiness(-0.2, "Her foal doesn't know her");
    if (typeof mum.separation === "object" && mum.separation) mum.separation.grief = Math.max(mum.separation.grief || 0, 0.3);
  }
  if ((f.adopted || (mum && mum.adopted)) && typeof addUIMessage === "function")
    addUIMessage(`${_folName(f)} has been away from ${mum ? _folName(mum) : "its mum"} so long it doesn't know her any more.`);
  if (typeof recordStory === "function") recordStory("turning", f, { x: `Kept away from ${mum ? _folName(mum) : "its mum"} too long, ${_folName(f)} forgot her.` });
}

function _folForgetTick(f, step) {
  const mum = _folMum(f);
  if (!_folStillHers(mum, f)) {
    if (f.mumApart) f.mumApart = 0;
    return;
  }
  if (f.forgotMum) {
    // Getting to know her again
    if (mum.scene === f.scene && _folAwake(f) && mum.currentStateKey !== "SLEEPING" && Math.hypot(mum.x - f.x, mum.y - f.y) < RELEARN_NEAR) {
      f._relearn = (f._relearn || 0) + step;
      if (f._relearn >= RELEARN_TIME) {
        f.forgotMum = false;
        f._relearn = 0;
        mum.changeHappiness(0.2, "Her foal knows her again");
        if (!mum.tooYoungToSpeak()) mum.speak(getDialogue(["FORGOT_MUM", "KNOWS_AGAIN"], mum, f), true);
        if ((f.adopted || mum.adopted) && typeof addUIMessage === "function") addUIMessage(`${_folName(f)} knows ${_folName(mum)} again.`);
      }
    }
    return;
  }
  if (mum.scene !== f.scene) {
    f.mumApart = (f.mumApart || 0) + step;
    if (f.mumApart >= forgetAfter(f)) foalForgetsMum(f, mum);
  } else if (f.mumApart) {
    f.mumApart = Math.max(0, f.mumApart - 2 * step);
  }
}

// HorseFamily.attemptFeedFromMare: it doesn't know her - it won't drink
function foalShiesFromMum(f, mum) {
  if (!f || !f.forgotMum || !mum || mum.id !== f.motherId) return false;
  f.milkCooldown = 3;
  if (!f.speech || !f.speech.text) f.speak(getDialogue(["FORGOT_MUM", f.tooYoungToSpeak() ? "CHIRPY" : "FOAL"], f, mum));
  if (mum.happiness > WAN_DIE_THRESHOLD && !mum.tooYoungToSpeak() && Math.random() < 0.5) mum.speak(getDialogue(["FORGOT_MUM", "MUM"], mum, f));
  return true;
}

// ---- Wandering ----

function _folCurious(f) {
  const brave = typeof traitValue === "function" ? traitValue(f, "bravery") : 0;
  const lively = typeof traitValue === "function" ? traitValue(f, "energy") : 0;
  return (brave + lively) / 2;
}

function canWanderOff(f) {
  if (!_folAwake(f) || f.currentCage || f.growth < CHIRPY_THRESHOLD || f.growth >= WANDER_MAX_GROWTH) return false;
  if ((typeof cantCrawlYet === "function" && cantCrawlYet(f)) || f._riding || (f.isSensitive && f.isSensitive())) return false;
  if (f.hunger < 0.5 || (typeof isFrightened === "function" && isFrightened(f)) || f._wander) return false;
  const mum = _folMum(f);
  if (!mum || !mum.isAlive || mum.scene !== f.scene || (relationships[mum.id] || {})[f.id] !== "baby_child") return false;
  return _folCurious(f) > 0.1;
}

function startWandering(f) {
  const mum = _folMum(f);
  const W = typeof sceneW === "function" ? sceneW(f.scene) : 1280;
  const H = typeof sceneH === "function" ? sceneH(f.scene) : 720;
  const top = (typeof sceneTop === "function" ? sceneTop(f.scene) : 100) + 30;
  let x;
  let y;
  if (f.scene === "RIVER" && Math.random() < 0.4) {
    // Right down to the water's edge (it may slip in)
    x = width * 0.25 + (-22 + Math.random() * 60);
    y = top + Math.random() * (H - top - 40);
  } else {
    const ang = Math.random() * Math.PI * 2;
    const d = WANDER_FAR[0] + Math.random() * (WANDER_FAR[1] - WANDER_FAR[0]);
    x = (mum ? mum.x : f.x) + Math.cos(ang) * d;
    y = (mum ? mum.y : f.y) + Math.sin(ang) * d * 0.5;
  }
  x = Math.max(40, Math.min(W - 40, x));
  y = Math.max(top, Math.min(H - 40, y));
  f._wander = { x, y, at: timePlayed, noticed: false };
  if (!f.tooYoungToSpeak() && Math.random() < 0.5) f.speak(getDialogue(["WANDER", "OFF"], f));
  return f._wander;
}

function _folWanderTick(f, step) {
  const w = f._wander;
  if (w) {
    if (timePlayed - w.at > WANDER_GIVE_UP || timePlayed < w.at || !f.isAlive || f.isDragging || f.currentCage) f._wander = null;
    return;
  }
  if (!canWanderOff(f)) return;
  const p = (WANDER_CHANCE * (step / HOUR_LENGTH)) * (0.5 + 2 * _folCurious(f));
  if (Math.random() < p) startWandering(f);
}

// Mum notices one of hers has wandered off
function _folMumNotices(m) {
  if (!_folAwake(m) || m._seekFoal !== undefined && m._seekFoal !== null) return;
  if (!(m.canSee() || m.canHear())) return;
  for (const f of typeof litterOf === "function" ? litterOf(m) : []) {
    const w = f._wander;
    if (!w || w.noticed || f.scene !== m.scene || timePlayed - w.at < WANDER_NOTICE) continue;
    if (Math.hypot(f.x - m.x, f.y - m.y) < WANDER_NOTICE_FAR) continue;
    w.noticed = true;
    m._seekFoal = f.id;
    m._seekAt = timePlayed;
    if (!m.tooYoungToSpeak()) m.speak(getDialogue(["WANDER", "MUM_CALLS"], m, f), true);
    return;
  }
}

// ---- Not understanding death ----

// HorseFamily.updateRelationships, a relative dead near it: not yet
function foalDoesntUnderstand(f, body, relation) {
  if (!f || !body || f.growth >= CONFUSED_GROWTH || body.isDestroyed) return false;
  if (/^Born /.test(body.causeOfDeath || "")) return false; // (a stillborn: it never knew it alive)
  if (relation !== "mother" && relation !== "brother" && relation !== "sister") return false;
  const now = timePlayed;
  const smarts = typeof smartsOf === "function" ? smartsOf(f) : 0;
  const lasts = CONFUSED_TIME * Math.max(0.3, 1 - 0.6 * smarts);
  let c = f._deathConfusion;
  if (!c || c.id !== body.id) {
    // One body at a time: a second one doesn't start it over (it understands
    // that one straight away), and once it's understood, only a death a good
    // while later confuses it again
    if (c && (!c.done || (c.seen && c.seen[body.id]) || (now >= c.doneAt && now - c.doneAt < lasts))) {
      if (c.seen) c.seen[body.id] = true;
      return false;
    }
    c = f._deathConfusion = { id: body.id, at: now, relation, done: false, lastTry: -99, seen: { [body.id]: true } };
  }
  if (c.done) return false;
  const smells = typeof corpseRot === "function" && corpseRot(body) >= CONFUSED_ROT;
  if (now - c.at >= lasts || smells || now < c.at || body._carriedBy) {
    c.done = true;
    c.doneAt = now;
    return false;
  }
  return true;
}

function _folConfusedBody(f) {
  const c = f._deathConfusion;
  if (!c || c.done) return null;
  const body = fluffyById(c.id);
  if (!body || body.isAlive || body.isDestroyed || body.scene !== f.scene) return null;
  return body;
}

// HerdWars._hwBodyCare: foals don't understand this one yet - take it away
function bodyConfusesFoals(body) {
  return fluffies.some((f) => f.isAlive && f._deathConfusion && !f._deathConfusion.done && f._deathConfusion.id === body.id);
}

// ---- Bullying ----

// Does it see that foal as a "munstah"?
function seesAsMunstah(f, v) {
  if (!f || !v || f === v) return false;
  if (typeof worldSettings !== "undefined" && worldSettings.alicornIntolerance && v.typeVisibleToOthers && v.typeVisibleToOthers() === "alicorn") {
    if (!f.tolerantOfAlicorns() && !(typeof getAlicornComfort === "function" && getAlicornComfort(f) >= 0.5)) return "alicorn";
  }
  if (typeof worldSettings !== "undefined" && worldSettings.colorism && v.genetics && typeof v.genetics.calculateColorismPerception === "function") {
    const p = v.genetics.calculateColorismPerception();
    if (p < COAT_POOPIE_LINE && (f.coloristDegree || 0) > p) return "colour";
  }
  return false;
}

function _folWalkingFoal(f) {
  return f.isAlive && f.growth >= WALKY_THRESHOLD && f.growth < 1 && !(f.isSensitive && f.isSensitive());
}

// A grown fluffy that grew up a bully
function grownBully(f) {
  return !!f && f.isAlive && f.growth >= 1 && (f.bullyScore || 0) >= BULLY_GROWN;
}

// Could it pick on someone? (a walking foal, or a grown bully)
function _folCanBully(f) {
  return _folWalkingFoal(f) || (grownBully(f) && !(f.isSensitive && f.isSensitive()) && !f.isCrawling);
}

// How much of a bully it is, for the chance it starts (its own, and picked up)
function bullyUrge(f) {
  return (f.bullyScore || 0) + (f.bullyHabit || 0);
}

function _folBullyTick(f, step) {
  if (f._bullyJob) {
    if (timePlayed - f._bullyJob.at > 40 || timePlayed < f._bullyJob.at) f._bullyJob = null;
    return;
  }
  const rest = BULLY_REST * (f.growth >= 1 ? 2 : 1);
  const last = Math.max(typeof f._bullyAt === "number" ? f._bullyAt : -Infinity, typeof f._bullyRestAt === "number" ? f._bullyRestAt : -Infinity);
  if (timePlayed >= last && timePlayed - last < rest) return;
  if (!_folCanBully(f) || !_folAwake(f) || f.hunger < 0.3 || f.currentCage || (typeof isFrightened === "function" && isFrightened(f))) return;
  const grown = f.growth >= 1;
  let victim = null;
  let vd = Infinity;
  for (const v of fluffies) {
    // (a foal picks on foals; a grown bully on anyone)
    if (v === f || !v.isAlive || v.scene !== f.scene || v.currentCage !== f.currentCage || (!grown && v.growth >= 1) || v.isDragging || v.placedOn) continue;
    const d = Math.hypot(v.x - f.x, v.y - f.y);
    if (d > BULLY_RANGE || d >= vd || !seesAsMunstah(f, v)) continue;
    victim = v;
    vd = d;
  }
  if (!victim) return;
  const temper = typeof traitValue === "function" ? traitValue(f, "temper") : 0;
  const p = BULLY_CHANCE * (step / HOUR_LENGTH) * Math.max(0.2, 1 + temper + 0.15 * Math.min(4, bullyUrge(f))) * (grown ? BULLY_GROWN_RATE : 1);
  if (Math.random() >= p) return;
  startBullying(f, victim);
}

function startBullying(f, victim) {
  const now = timePlayed;
  // Taught to play nice: a stuffy close by takes it instead (as often as it's been taught)
  const toy = stuffyNear(f, BULLY_PLUSHIE_RANGE);
  if (toy && Math.random() < playNiceOf(f)) {
    f._bullyJob = { at: now, plushie: true, x: toy.x, y: toy.y, id: null };
    if (!f.tooYoungToSpeak()) f.speak(getDialogue(["FOAL_BULLY", "STUFFY"], f), true);
    return f._bullyJob;
  }
  f._bullyJob = { at: now, id: victim.id };
  if (!f.tooYoungToSpeak()) f.speak(getDialogue(["FOAL_BULLY", "START"], f, victim), true);
  // The gang
  for (const o of fluffies) {
    if (o === f || o === victim || !_folCanBully(o) || !_folAwake(o) || o.scene !== f.scene || o.growth >= 1 !== f.growth >= 1) continue;
    if (Math.hypot(o.x - f.x, o.y - f.y) > BULLY_GANG_RANGE || !seesAsMunstah(o, victim)) continue;
    o.bullyScore = (o.bullyScore || 0) + 0.5;
    o._bullyAt = now;
    if (!o.tooYoungToSpeak() && (!o.speech || !o.speech.text)) o.speak(getDialogue(["FOAL_BULLY", "GANG"], o, victim));
  }
  return f._bullyJob;
}

// The ringleader reached it (or the stuffy)
function bullyShove(f, victim) {
  const now = timePlayed;
  f._bullyJob = null;
  // Can't get at it (a fence between them): nothing happens
  if (!victim || !victim.isAlive || (typeof canFluffiesReachEachOther === "function" && !canFluffiesReachEachOther(f, victim))) {
    f._bullyRestAt = now;
    return false;
  }
  f._bullyAt = now;
  f.bullyScore = (f.bullyScore || 0) + 1;
  if (typeof _pnAdd === "function") _pnAdd(f, "bullyFoal", 1);
  if (typeof f.performAttack === "function") f.performAttack(victim, "BULLY");
  if (!f.tooYoungToSpeak()) f.speak(getDialogue(["FOAL_BULLY", "SHOVE"], f, victim), true);
  victim.milkCooldown = Math.max(victim.milkCooldown || 0, 8); // (shoved off the milk)
  victim.bullied = (victim.bullied || 0) + 1;
  victim.changeHappiness(-0.05, f.growth >= 1 ? "Picked on by a bully" : "Picked on by other foals");
  if (victim.growth < 1 && typeof _pnAdd === "function") _pnAdd(victim, "pickedOnFoal", 1);
  if (typeof changeOpinion === "function") changeOpinion(victim, f, -0.1, "picked on me");
  // A brave friend or sibling stands up for it - or anyone who's learnt to play nice
  const rels = relationships[victim.id] || {};
  for (const o of fluffies) {
    if (o === f || o === victim || !o.isAlive || o.scene !== victim.scene || !_folAwake(o) || o.tooYoungToSpeak()) continue;
    const nice = playNiceOf(o) >= 0.999;
    if ((!nice && !["friend", "brother", "sister", "special_friend"].includes(rels[o.id])) || seesAsMunstah(o, victim)) continue;
    if (Math.hypot(o.x - victim.x, o.y - victim.y) > 260) continue;
    const brave = typeof traitValue === "function" ? traitValue(o, "bravery") : 0;
    if ((!nice && brave < 0.2) || Math.random() >= BULLY_PROTECT_CHANCE * (nice ? 2 : 1)) continue;
    o.speak(getDialogue(["FOAL_BULLY", "PROTECT"], o, f), true);
    if (typeof noteGoodDeed === "function") noteGoodDeed(o, "protected");
    if (typeof changeOpinion === "function") changeOpinion(victim, o, 0.15, "stood up for me");
    break;
  }
  if (f.bullyScore >= BULLY_GROWN && !f._bullyNoted) {
    f._bullyNoted = true;
    if (typeof recordStory === "function") recordStory("turning", f, { x: `${_folName(f)} became the foal who picks on the others.` });
  }
}

function bullyMakesUpWithStuffy(f) {
  f._bullyJob = null;
  f._bullyRestAt = timePlayed; // (a rest, not a misdeed: Care.recentMisdeed reads _bullyAt)
  f.bullyScore = Math.max(0, (f.bullyScore || 0) - 0.5);
  f.changeHappiness(0.02, "Made up with the stuffy");
  if (!f.tooYoungToSpeak()) f.speak(getDialogue(["FOAL_BULLY", "STUFFY_HIT"], f), true);
  f._stuffySorryAt = timePlayed;
}

// A stuffed toy lying in its room, near enough (or anywhere in the room)
function stuffyNear(f, range = Infinity) {
  if (typeof allPlushies !== "function") return null;
  let best = null;
  let bd = range;
  for (const p of allPlushies()) {
    if (p.scene !== f.scene || p.heldBy || p.isDragging) continue;
    const d = Math.hypot(p.x - f.x, p.y - f.y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

function playNiceOf(f) {
  return Math.max(0, Math.min(1, (f && f.playNice) || 0));
}

// Fully taught: the "grumpier" bullying gave it is taken back, and the
// habit it picked up growing up is gone
function learntPlayNice(f) {
  f.bullyHabit = 0;
  const gp = f.growthProgress || {};
  const times = gp.bullyFoalTimes || 0;
  if (times > 0 && f.traitShift && typeof f.traitShift.temper === "number") {
    const step = typeof TRAIT_SHIFT_STEP === "number" ? TRAIT_SHIFT_STEP : 0.1;
    f.traitShift.temper = Math.round((f.traitShift.temper - step * times) * 100) / 100;
    gp.bullyFoalTimes = 0;
    if (typeof recordStory === "function") recordStory("trait_shift", f, { x: `Learning to play nice made ${_folName(f)} calmer again.` });
  }
}

// A foal raised by a bully (mum or dad in the room, not taught) picks up the habit
function _folHabitTick(f, step) {
  if (!_folWalkingFoal(f) || (f.bullyHabit || 0) >= BULLY_HABIT_MAX || playNiceOf(f) > 0) return;
  for (const id of [f.motherId, f.fatherId]) {
    if (id === null || id === undefined) continue;
    const p = fluffyById(id);
    if (!p || !grownBully(p) || playNiceOf(p) >= 0.999 || p.scene !== f.scene) continue;
    f.bullyHabit = Math.min(BULLY_HABIT_MAX, (f.bullyHabit || 0) + (BULLY_HABIT_PER_DAY * step) / DAY_LENGTH);
    return;
  }
}

// The lesson (Lessons row): needs a stuffy in the room
if (typeof LESSONS !== "undefined") {
  LESSONS.push({
    key: "playnice",
    name: "Play nice",
    applies: (f) => (f.bullyScore || 0) > 0 && playNiceOf(f) < 0.999 && !!stuffyNear(f),
    progress: (f) => playNiceOf(f),
    teach: (f) => {
      f.playNice = Math.min(1, playNiceOf(f) + LESSON_PLAY_NICE);
      // Show it: the stuffy's the munstah - then sorry, and friends
      const toy = stuffyNear(f);
      if (toy) f._bullyJob = { at: timePlayed, plushie: true, x: toy.x, y: toy.y, id: null };
      else f.bullyScore = Math.max(0, (f.bullyScore || 0) - 0.5);
      if (f.playNice < 0.999) return false;
      learntPlayNice(f);
      return true;
    },
    doneMsg: (n) => `${n} has learnt to play nice: when it wants to pick on a foal, it takes it out on a stuffy instead. ✓`,
  });
}

// ---- Every few seconds ----

function updateFoalLife(dt) {
  const step = foalLifeTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    if (f.growth < 1) {
      _folForgetTick(f, step);
      _folWanderTick(f, step);
      _folBullyTick(f, step);
      _folHabitTick(f, step);
    } else {
      if (f.gender === "female") _folMumNotices(f);
      if (grownBully(f) || f._bullyJob) _folBullyTick(f, step);
    }
    // "Sowwy stuffy": a moment after shoving it
    if (typeof f._stuffySorryAt === "number" && timePlayed - f._stuffySorryAt > 3 && timePlayed - f._stuffySorryAt < 10 && !f.tooYoungToSpeak()) {
      f._stuffySorryAt = null;
      f.speak(getDialogue(["FOAL_BULLY", "MAKE_UP"], f), true);
    }
  }
}
registerSystem("foalLife", updateFoalLife, 65);

// ---- What they do about it ----

class FoalLifeDesire extends Desire {
  constructor() {
    super("FoalLife");
  }
  _bully(h) {
    if (!h._bullyJob || h.currentStateKey === "SLEEPING" || h.currentCage) return null;
    if (h._bullyJob.plushie) return { kind: "bully", f: null, score: 50 };
    const v = fluffyById(h._bullyJob.id);
    if (!v || !v.isAlive || v.scene !== h.scene) {
      h._bullyJob = null;
      return null;
    }
    return { kind: "bully", f: v, score: 50 };
  }
  _job(h) {
    if (!h.isAlive || h.isDragging || h.placedOn || h.isStacking) return null;
    if (h.growth >= 1) {
      if (h._seekFoal !== null && h._seekFoal !== undefined) {
        const f = fluffyById(h._seekFoal);
        if (!f || !f.isAlive || f.scene !== h.scene || !f._wander || timePlayed - h._seekAt > WANDER_GIVE_UP || h.currentCage) h._seekFoal = null;
        else return { kind: "seek", f, score: 86 };
      }
      return this._bully(h); // (a grown bully)
    }
    if (h.currentStateKey === "SLEEPING" || h.currentCage) return null;
    const b = this._bully(h);
    if (b) return b;
    if (!(typeof cantCrawlYet === "function" && cantCrawlYet(h)) && !h._riding) {
      const body = _folConfusedBody(h);
      if (body) return { kind: "body", f: body, score: 40 };
    }
    if (h._wander && h.hunger >= 0.3) return { kind: "wander", score: 30 };
    return null;
  }
  evaluate(h) {
    const j = this._job(h);
    return j ? j.score : 0;
  }
  _go(h, x, y, run = false) {
    if (!h.isMovingOrRunning()) h.initBehavior(run && !h.isCrawling ? "RUNNING" : "MOVING");
    h.setTargetPosition(x, y);
  }
  execute(h) {
    const j = this._job(h);
    if (!j) return false;
    if (j.kind === "seek") {
      const f = j.f;
      if (Math.hypot(f.x - h.x, f.y - h.y) > 55) {
        this._go(h, f.x, f.y, true);
        return true;
      }
      // Found it
      f._wander = null;
      h._seekFoal = null;
      if (!h.tooYoungToSpeak()) h.speak(getDialogue(["WANDER", "FOUND"], h, f), true);
      if (!f.tooYoungToSpeak()) f.speak(getDialogue(["WANDER", "SORRY"], f, h));
      return false;
    }
    if (j.kind === "bully") {
      const job = h._bullyJob;
      const tx = job.plushie ? job.x : j.f.x;
      const ty = job.plushie ? job.y : j.f.y;
      if (Math.hypot(tx - h.x, ty - h.y) > 45) {
        this._go(h, tx, ty, true);
        return true;
      }
      if (job.plushie) bullyMakesUpWithStuffy(h);
      else bullyShove(h, j.f);
      return true;
    }
    if (j.kind === "body") {
      const body = j.f;
      if (Math.hypot(body.x - h.x, body.y - h.y) > 45) {
        this._go(h, body.x + (h.x < body.x ? -30 : 30), body.y);
        return true;
      }
      const c = h._deathConfusion;
      if (timePlayed - (c.lastTry ?? -99) >= 6) {
        c.lastTry = timePlayed;
        h.facingRight = body.x > h.x;
        const nurse = c.relation === "mother" && h.growth < (typeof FOSTER_MAX_GROWTH === "number" ? FOSTER_MAX_GROWTH : 0.36);
        h.speak(getDialogue(["NOT_DEAD", nurse ? "NURSE" : c.relation === "mother" ? "MUM" : "SIBLING", h.tooYoungToSpeak() ? "CHIRPY" : "DEFAULT"], h, body));
      }
      if (h.currentStateKey !== "SITTING") {
        h.initBehavior("SITTING");
        h.stateTimer = 3;
      }
      return true;
    }
    // Wandering
    const w = h._wander;
    if (Math.hypot(w.x - h.x, w.y - h.y) > 30) {
      this._go(h, w.x, w.y);
      return true;
    }
    if (h.currentStateKey !== "SITTING") {
      h.initBehavior("SITTING");
      h.stateTimer = 4;
    }
    return true;
  }
}

// ---- Magnifying glass ----

function describeFoalMum(f) {
  if (!f || !f.isAlive || f.growth >= 1) return null;
  if (f.forgotMum) return ["Doesn't know its mum any more (kept apart too long)", "bad"];
  if (f.takenFromMum !== undefined && f.takenFromMum !== null && f.motherId === f.takenFromMum) return ["Taken from its mum (her last chance)", "bad"];
  const left = forgetAfter(f) - (f.mumApart || 0);
  if (f.mumApart > HOUR_LENGTH && left > 0) return [`Away from mum ${Math.floor(f.mumApart / HOUR_LENGTH)}h: forgets her in ${Math.ceil(left / HOUR_LENGTH)}h`, "bad"];
  return null;
}

function describeBullying(f) {
  if (!f) return null;
  const parts = [];
  let tone = "";
  if (f.bullied) {
    parts.push(`Picked on by bullies (${f.bullied === 1 ? "once" : `${f.bullied} times`})`);
    tone = "bad";
  }
  const s = f.bullyScore || 0;
  if (s >= BULLY_GROWN) {
    parts.push(f.growth >= 1 ? (playNiceOf(f) >= 0.999 ? "Grew up a bully" : "A bully: picks on alicorns and poopie coats") : "A bully: picks on other foals");
    tone = "bad";
  } else if (s >= 1) {
    parts.push("Picks on other foals");
    tone = "bad";
  }
  if ((f.bullyHabit || 0) >= 0.25 && f.growth < 1) {
    parts.push("picking up bullying from a parent");
    tone = "bad";
  }
  const taught = playNiceOf(f);
  if (taught >= 0.999) parts.push("learnt to play nice");
  else if (taught > 0) parts.push(`Play nice ${Math.round(taught * 100)}%`);
  else if (s >= 1 && f.adopted) parts.push("teach it Play nice (needs a stuffy in the room)");
  return parts.length ? [parts.join(" · "), tone] : null;
}
