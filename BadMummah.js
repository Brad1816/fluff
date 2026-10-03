// ---------------------------------------------------------------------------
// Bad-mother rehab: a mare on her last chance.
//
// A mum's slips (noteMumMisdeed), counted for every mare:
//   - "hoarded"  keeping the last of her milk for her bestest babbeh and
//                turning another foal away (Favourites.js)
//   - "hurt"     hurting a foal of her own (its colour, an alicorn foal, a
//                shove: HorseSocial.performAttack)
//   - "rejected" turning a foal away for its smell (Runts.js)
// At most one slip each MUM_SLIP_REST. Each one is also a misdeed you can
// scold her for just after (Care.js: "for being a bad mummah").
//
// RIGHT-CLICK one of your mares with foals on her (or the Actions button in
// the magnifying glass): "Last chance". From then on she tries: when she's
// about to slip she may hold herself back (mumObeyChance: more the more she
// trusts or fears you, and the more strikes she has), and if she does
// she's good for the rest of that hour - a good deed you can praise her for.
// If she slips anyway it's a strike, and each costs her more (MUM_STEPS):
//   1. time away   MUM_AWAY_TIME in the corner, away from her foals: they
//                  can't drink from her, she pines (they find a feeder, a
//                  foster mum or the Feed-Bot)
//   2. her bestest her favourite (or the foal she wronged) goes to a foster
//                  mum - one of your mares with milk, if there is one;
//                  otherwise it's taken from her all the same (it needs a
//                  feeder or the Feed-Bot)
//   3. all of them every foal still on her goes, and the list ends
// Good behaviour clears a strike: MUM_GOOD_SPELL with her foals and no
// slip, or praising her just after a good deed (Care.js). "Off the list"
// lifts it (the strikes stay until she earns them back).
// Shown in the magnifying glass (Family, "Mothering").
// Saved: f.badMum = { on, slips, strikes, step, lastSlipAt, goodAt, awayUntil, heldAt }.
// ---------------------------------------------------------------------------

const MUM_SLIP_REST = HOUR_LENGTH;
const MUM_AWAY_TIME = 3 * HOUR_LENGTH;
const MUM_GOOD_SPELL = 4 * HOUR_LENGTH;
const MUM_OBEY_BASE = 0.35;
const MUM_OBEY_PER_STRIKE = 0.12;
const MUM_STEPS = [
  { key: "away", name: "Time away" },
  { key: "bestest", name: "Her bestest" },
  { key: "all", name: "All her foals" },
];
const badMummahTicker = new Ticker(5);

function _bmName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Fluffy";
}

function badMumOf(m) {
  if (!m.badMum || typeof m.badMum !== "object") m.badMum = { on: false, slips: 0, strikes: 0, step: 0, lastSlipAt: null, goodAt: null, awayUntil: null, heldAt: null };
  return m.badMum;
}

function onLastChance(m) {
  return !!(m && m.badMum && m.badMum.on);
}

// In the corner, away from her foals
function mumAway(m) {
  const b = m && m.badMum;
  if (!b || typeof b.awayUntil !== "number") return false;
  // (asking doesn't change anything: updateBadMummahs sends her back)
  return timePlayed < b.awayUntil && b.awayUntil - timePlayed <= MUM_AWAY_TIME + 5;
}

// Her foals still on her (alive)
function _bmFoals(m) {
  return typeof litterOf === "function" ? litterOf(m) : [];
}

function setLastChance(m, on) {
  const b = badMumOf(m);
  b.on = !!on;
  // Back on the list after losing them all: a fresh start (not straight to the end)
  if (on && (b.step || 0) >= MUM_STEPS.length) {
    b.step = 0;
    b.strikes = 0;
  }
  if (on) b.goodAt = timePlayed;
  else b.awayUntil = null;
  if (typeof addUIMessage === "function")
    addUIMessage(on ? `${_bmName(m)} is on her last chance. Slip again and it'll cost her: time away, then her bestest, then all her foals.` : `${_bmName(m)} is off the list.`);
  if (on && !m.tooYoungToSpeak() && m.currentStateKey !== "SLEEPING" && typeof getDialogue === "function") m.speak(getDialogue(["BAD_MUMMAH", "TOLD"], m), true);
  return b.on;
}

function mumObeyChance(m) {
  const b = badMumOf(m);
  let p = MUM_OBEY_BASE + 0.3 * (m.playerTrust ?? 0.5) + 0.3 * (m.playerFear || 0) + MUM_OBEY_PER_STRIKE * (b.strikes || 0);
  if (typeof titleOf === "function" && titleOf(m) === "Rebel") p *= 0.5;
  return Math.max(0.1, Math.min(0.95, p));
}

// About to slip: does she hold herself back? (only on her last chance)
function mumHoldsBack(m, f = null) {
  if (!onLastChance(m)) return false;
  const b = badMumOf(m);
  const now = timePlayed;
  if (typeof b.heldAt === "number" && now >= b.heldAt && now - b.heldAt < MUM_SLIP_REST) return true; // (being good this hour)
  if (Math.random() >= mumObeyChance(m)) return false;
  b.heldAt = now;
  if (!m.tooYoungToSpeak() && m.happiness > WAN_DIE_THRESHOLD) m.speak(getDialogue(["BAD_MUMMAH", "HOLDS_BACK"], m, f), true);
  if (typeof noteGoodDeed === "function") noteGoodDeed(m, "held_back");
  return true;
}

// A slip (any mare). Returns true if it counted (not within MUM_SLIP_REST of the last).
function noteMumSlip(m, f, what) {
  if (!m || !m.isAlive) return false;
  const b = badMumOf(m);
  const now = timePlayed;
  if (typeof b.lastSlipAt === "number" && now >= b.lastSlipAt && now - b.lastSlipAt < MUM_SLIP_REST) return false;
  b.lastSlipAt = now;
  b.slips = (b.slips || 0) + 1;
  b.goodAt = now;
  b.lastWhat = what;
  if (!b.on) return true;
  // On her last chance: a strike, and the next step
  b.strikes = (b.strikes || 0) + 1;
  const step = MUM_STEPS[Math.min(b.step || 0, MUM_STEPS.length - 1)];
  b.step = Math.min(MUM_STEPS.length, (b.step || 0) + 1);
  applyMumStep(m, step.key, f);
  return true;
}

function applyMumStep(m, key, wronged = null) {
  const b = badMumOf(m);
  const n = _bmName(m);
  const what = { hoarded: "kept the milk from a foal", hurt: "hurt a foal", rejected: "turned a foal away" }[b.lastWhat] || "slipped";
  if (key === "away") {
    b.awayUntil = timePlayed + MUM_AWAY_TIME;
    m.changeHappiness(-0.1, "Time away from her foals");
    if (typeof addUIMessage === "function") addUIMessage(`${n} ${what} again: time away from her foals (3 hours in the corner).`);
    if (!m.tooYoungToSpeak()) m.speak(getDialogue(["BAD_MUMMAH", "AWAY"], m), true);
  } else if (key === "bestest") {
    const best = (typeof bestestOf === "function" && bestestOf(m)) || (wronged && wronged.isAlive && wronged.motherId === m.id ? wronged : null) || _bmFoals(m)[0];
    if (best) giveFoalAway(m, best);
    if (typeof addUIMessage === "function") addUIMessage(`${n} ${what} again: ${best ? `${_bmName(best)} has been taken from her` : "nothing left to take"}. One more and she loses them all.`);
  } else {
    const all = _bmFoals(m);
    for (const f of all) giveFoalAway(m, f);
    b.on = false;
    if (typeof addUIMessage === "function") addUIMessage(`${n} ${what} again: all her foals have been taken from her.`);
    if (typeof recordStory === "function") recordStory("turning", m, { x: `${n} lost all her foals for being a bad mummah.` });
  }
  if (typeof noteDayEvent === "function" && m.adopted) noteDayEvent("news", { text: `${n}: last chance, strike ${b.strikes}` });
}

// A good mum of yours with milk who'd take it in (not her, not on the list)
function _bmFosterFor(m, foal) {
  let best = null;
  let bd = Infinity;
  for (const o of fluffies) {
    if (o === m || !o.isAlive || o.gender !== "female" || o.growth < 1 || !o.adopted || !foal.adopted) continue;
    if (!(o.lactatingTimer > 0) || onLastChance(o) || (o.badMum && o.badMum.strikes > 0)) continue;
    if (typeof _fsNursing === "function" && _fsNursing(o) >= FOSTER_MAX_LITTER) continue;
    if (typeof mumRejectsFoalColour === "function" && mumRejectsFoalColour(o, foal)) continue;
    if (typeof worldSettings !== "undefined" && worldSettings.alicornIntolerance && foal.typeVisibleToOthers() === "alicorn" && !o.tolerantOfAlicorns()) continue;
    if (o.currentCage || o.placedOn) continue;
    const d = (o.scene === foal.scene ? 0 : 5000) + Math.hypot(o.x - foal.x, o.y - foal.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

// Taken from her: to a foster mum if there is one
function giveFoalAway(m, f) {
  if (!f || !f.isAlive) return false;
  setRelationship(m.id, f.id, "child"); // (not hers to nurse any more)
  f.takenFromMum = m.id;
  m.changeHappiness(-0.15, "A foal taken from her");
  f.changeHappiness(-0.05);
  if (m.bestestId === f.id) m.bestestId = null;
  const foster = _bmFosterFor(m, f);
  if (foster) {
    if (f.scene !== foster.scene && !f.currentCage && !f.placedOn && !f.isDragging) {
      f.scene = foster.scene;
      f.currentCage = null;
    }
    if (f.scene === foster.scene) {
      f.x = foster.x + (Math.random() < 0.5 ? -40 : 40);
      f.y = foster.y + 6;
    }
    if (typeof fosterFoal === "function") fosterFoal(foster, f, "kind");
  } else if (typeof addUIMessage === "function") {
    addUIMessage(`No mare of yours has milk to foster ${_bmName(f)}: give it a feeder of formula or the Feed-Bot.`);
  }
  if (!m.tooYoungToSpeak() && m.happiness > WAN_DIE_THRESHOLD) m.speak(getDialogue(["BAD_MUMMAH", "TAKEN"], m, f), true);
  return true;
}

// Praise just after a good deed, or a good spell: one strike off
function clearMumStrike(m, why = "good") {
  const b = m && m.badMum;
  if (!b || !(b.strikes > 0)) return false;
  b.strikes--;
  b.step = Math.min(b.step || 0, b.strikes);
  b.goodAt = timePlayed;
  if (m.adopted && typeof addUIMessage === "function") addUIMessage(`${_bmName(m)} has been a good mummah: a strike off (${b.strikes} left).`);
  return true;
}

// Every few seconds: good spells, and going back after time away
function updateBadMummahs(dt) {
  if (!badMummahTicker.step(dt) || typeof fluffies === "undefined") return;
  const now = timePlayed;
  for (const m of fluffies) {
    const b = m.badMum;
    if (!b || !m.isAlive) continue;
    if (b.awayUntil !== null && b.awayUntil !== undefined && !mumAway(m)) {
      b.awayUntil = null;
      b.spot = null;
      if (!m.tooYoungToSpeak()) m.speak(getDialogue(["BAD_MUMMAH", "BACK"], m), true);
    }
    if (!(b.strikes > 0) || !_bmFoals(m).length) continue;
    if (typeof b.goodAt !== "number" || b.goodAt > now) b.goodAt = now;
    if (now - b.goodAt >= MUM_GOOD_SPELL && !mumAway(m)) clearMumStrike(m, "spell");
  }
}
registerSystem("badMummahs", updateBadMummahs, 64);

// Right-click (Tricks.rightClickActions)
function badMummahActions(f) {
  if (!f || !f.isAlive || !f.adopted || f.gender !== "female" || f.growth < 1) return [];
  if (onLastChance(f)) return [{ key: "mum_off", name: "Off the list", sub: "last chance", run: (x) => setLastChance(x, false) }];
  if (!_bmFoals(f).length) return [];
  return [{ key: "mum_on", name: "Last chance", sub: "bad mummah", harsh: true, run: (x) => setLastChance(x, true) }];
}

// Magnifying glass: [text, tone] or null
function describeMothering(f) {
  const b = f && f.badMum;
  if (!b || (!b.on && !b.slips && !b.strikes)) return null;
  const parts = [];
  if (b.on) parts.push(`Last chance: ${b.strikes || 0} strike${b.strikes === 1 ? "" : "s"}`);
  else if (b.strikes) parts.push(`${b.strikes} strike${b.strikes === 1 ? "" : "s"}`);
  if (b.slips) parts.push(`slipped ${b.slips === 1 ? "once" : `${b.slips} times`}`);
  if (mumAway(f)) parts.push(`time away: ${Math.ceil((b.awayUntil - timePlayed) / HOUR_LENGTH)}h left`);
  else if (b.on) parts.push(`next: ${MUM_STEPS[Math.min(b.step || 0, MUM_STEPS.length - 1)].name.toLowerCase()}`);
  return [parts.join(" · "), b.strikes || mumAway(f) ? "bad" : "ok"];
}

// The corner, while she's away from her foals
class MumAwayDesire extends Desire {
  constructor() {
    super("MumAway");
  }
  evaluate(h) {
    if (!h.isAlive || h.isDragging || h.placedOn || h.currentCage || !mumAway(h)) return 0;
    return 79;
  }
  execute(h) {
    const b = h.badMum;
    if (!b.spot || b.spot.scene !== h.scene) {
      const w = typeof sceneW === "function" ? sceneW(h.scene) : 1280;
      const top = typeof sceneTop === "function" ? sceneTop(h.scene) + 50 : 200;
      // The corner furthest from her foals
      const foals = _bmFoals(h).filter((f) => f.scene === h.scene);
      const fx = foals.length ? foals.reduce((s, f) => s + f.x, 0) / foals.length : h.x;
      b.spot = { scene: h.scene, x: fx < w / 2 ? w - 70 : 70, y: top + 20 };
    }
    if (Math.hypot(h.x - b.spot.x, h.y - b.spot.y) > 40) {
      if (!h.isMovingOrRunning()) h.initBehavior("MOVING");
      h.setTargetPosition(b.spot.x, b.spot.y);
    } else if (h.currentStateKey !== "SITTING" && h.currentStateKey !== "SLEEPING") {
      h.initBehavior("SITTING");
      h.stateTimer = 3;
      h.expressionOverride = "MISERABLE";
      h.expressionOverrideTimer = 3;
    }
    return true;
  }
}
