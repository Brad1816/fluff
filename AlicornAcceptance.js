// ---------------------------------------------------------------------------
// Alicorn acceptance: fluffies slowly get used to alicorns.
//
// With alicorn intolerance on (the "Headcanon" setting), fluffies are scared
// of alicorns ("munstahs"). Each fluffy has alicornComfort (0..1, saved).
// It grows while the fluffy is awake and can see an alicorn within
// ALICORN_SEE_RANGE that isn't hurting anyone; at 1 it accepts alicorns for
// good (alicornTolerance, as before).
//
// It's meant to be rare and hard work. Plain exposure takes
// ALICORN_ACCEPT_TIME seconds of actually seeing one (10 game days; in
// practice far longer, since scared ones keep running out of sight), and
// it's forgotten again when they're kept apart (ALICORN_FORGET_TIME).
// A little faster for:
//   - foals (x2 when tiny, x1.5 when half grown)
//   - a mum with her own alicorn foal (x2) - and once she accepts it, it's
//     her baby again instead of an "estranged" one
//   - brave fluffies (up to x1.3; timid ones down to x0.7)
//   - friends, family or herd-mates who already accept alicorns being close
//     by (up to x1.5)
//   - the alicorn being in a cage (x1.2)
//   - you holding the fluffy close to the alicorn ("introducing" them), if it
//     trusts you a lot (Memory.js playerTrust >= 0.7): ALICORN_INTRO_TIME
//   - the "munstah" channel on the Fluff TV: a tiny bit each time
// Much slower for smarties (x0.1), and for hungry or miserable ones (x0.5).
// Setbacks: an alicorn attacking it (-0.5) or one it can see (-0.2).
//
// As comfort grows the fear range shrinks a little (alicornFearRange: 300px
// when afraid, 180px just before accepting).
// The magnifying glass shows "Alicorns: Afraid / Getting used to them (40%) /
// Accepts them".
// ---------------------------------------------------------------------------

const ALICORN_SEE_RANGE = 450;
const ALICORN_ACCEPT_TIME = 12000; // game seconds of plain exposure, 0 -> 1 (10 game days)
const ALICORN_INTRO_TIME = 1800; // seconds held close by a trusted hand, 0 -> 1
const ALICORN_INTRO_TRUST = 0.7; // how much it must trust you for introductions
const ALICORN_FORGET_TIME = 6000; // seconds apart to lose it all again (5 game days)
const ALICORN_TICK = 1;

let _alicornTick = 0;

function _alicornIntoleranceOn() {
  return typeof worldSettings === "undefined" || !!worldSettings.alicornIntolerance;
}

function _isVisibleAlicorn(f) {
  return f && f.isAlive && f.typeVisibleToOthers && f.typeVisibleToOthers() === "alicorn";
}

function getAlicornComfort(f) {
  if (!f) return 0;
  if (f.tolerantOfAlicorns && f.tolerantOfAlicorns()) return 1;
  return Math.max(0, Math.min(1, f.alicornComfort || 0));
}

// How close an alicorn has to be before this fluffy runs (HorsePositioning.findScaryAlicorn)
function alicornFearRange(f) {
  return 300 * (1 - 0.4 * getAlicornComfort(f));
}

// Magnifying glass row: [text, tone], or null if it doesn't apply
function describeAlicornFeeling(f) {
  if (!_alicornIntoleranceOn() || !f || f.type === "alicorn") return null;
  if (f.tolerantOfAlicorns()) return ["Accepts them", "good"];
  const c = getAlicornComfort(f);
  if (c < 0.05) return ["Afraid", "bad"];
  return [`Getting used to them (${Math.round(c * 100)}%)`, "ok"];
}

function _acceptLikes(a, b) {
  const rel = typeof relationships !== "undefined" && relationships[a.id] ? relationships[a.id][b.id] : null;
  if (rel && rel !== "estranged_child") return true;
  if (typeof sameHerd === "function" && sameHerd(a, b)) return true;
  return typeof getLiking === "function" && getLiking(a, b) >= 0.3;
}

// Per second, for f seeing alicorn a
function alicornAcceptanceRate(f, a) {
  let r = 1 / ALICORN_ACCEPT_TIME;
  if (f.growth < 0.3) r *= 2;
  else if (f.growth < 1) r *= 1.5;
  if (f.isSmarty && f.isSmarty()) r *= 0.1;
  const brave = typeof traitValue === "function" ? traitValue(f, "bravery") : 0;
  r *= 1 + 0.3 * brave;
  if (a.currentCage) r *= 1.2;
  if (a.motherId === f.id) r *= 2;
  // Good examples nearby
  let examples = 0;
  for (const o of fluffies) {
    if (o === f || o === a || !o.isAlive || o.scene !== f.scene || o.type === "alicorn") continue;
    if (o.currentStateKey === "SLEEPING" || !o.tolerantOfAlicorns()) continue;
    if (Math.hypot(o.x - f.x, o.y - f.y) > 300) continue;
    if (_acceptLikes(f, o) && ++examples >= 2) break;
  }
  r *= 1 + 0.25 * examples;
  if (f.hunger < 0.3 || f.happiness <= WAN_DIE_THRESHOLD + 0.1) r *= 0.5;
  return r;
}

function _nearestAlicorn(f, alicorns) {
  let best = null;
  let bestD = Infinity;
  for (const a of alicorns) {
    if (a === f || a.scene !== f.scene) continue;
    const d = Math.hypot(a.x - f.x, a.y - f.y);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best ? { a: best, d: bestD } : null;
}

function addAlicornComfort(f, amount) {
  if (!f || !f.isAlive || f.tolerantOfAlicorns()) return;
  f.alicornComfort = Math.max(0, Math.min(1, (f.alicornComfort || 0) + amount));
  if (f.alicornComfort >= 1) acceptAlicorns(f);
}

// It's not scared any more
function acceptAlicorns(f) {
  f.alicornTolerance = true;
  f.alicornComfort = 1;
  f.changeHappiness(0.05);
  if (!f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING") f.speak(getDialogue(["ALICORN_ACCEPT", "DEFAULT"], f));
  if (f.adopted && typeof addUIMessage === "function") {
    const who = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
    addUIMessage(`${who} isn't scared of alicorns any more.`);
  }
  // A mum takes back the alicorn foal she'd turned away
  const rels = typeof relationships !== "undefined" ? relationships[f.id] : null;
  if (rels) {
    for (const id in rels) {
      if (rels[id] !== "estranged_child") continue;
      const child = fluffies.find((x) => x.id == id);
      if (!child || !child.isAlive || child.type !== "alicorn") continue;
      rels[id] = child.growth < 1 ? "baby_child" : "child";
      if (typeof noteDayEvent === "function" && f.adopted)
        noteDayEvent("news", { text: `${typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A mare"} took back her alicorn foal.` });
    }
  }
}

// HorseSocial.wasAttackedBy: an alicorn hurting someone sets back the ones
// that are still scared
function noteAlicornAttack(attacker, target) {
  if (!_alicornIntoleranceOn() || !_isVisibleAlicorn(attacker) || !target) return;
  for (const f of fluffies) {
    if (!f.isAlive || f === attacker || f.scene !== attacker.scene || f.tolerantOfAlicorns()) continue;
    if (f === target) f.alicornComfort = Math.max(0, (f.alicornComfort || 0) - 0.5);
    else if (f.canSee() && f.currentStateKey !== "SLEEPING" && Math.hypot(f.x - attacker.x, f.y - attacker.y) < 300)
      f.alicornComfort = Math.max(0, (f.alicornComfort || 0) - 0.2);
  }
}

// script.js updateSimulation
function updateAlicornAcceptance(dt) {
  _alicornTick -= dt;
  if (_alicornTick > 0) return;
  const step = ALICORN_TICK - _alicornTick; // seconds since the last tick
  _alicornTick = ALICORN_TICK;
  if (!_alicornIntoleranceOn()) return;
  const alicorns = fluffies.filter(_isVisibleAlicorn);
  for (const f of fluffies) {
    if (!f.isAlive || f.tolerantOfAlicorns()) continue;
    const near = alicorns.length ? _nearestAlicorn(f, alicorns) : null;
    if (!near || near.d > ALICORN_SEE_RANGE) {
      // Kept apart: slowly forgets (asleep or not)
      if (f.alicornComfort > 0) f.alicornComfort = Math.max(0, f.alicornComfort - step / ALICORN_FORGET_TIME);
      continue;
    }
    if (f.currentStateKey === "SLEEPING" || !f.canSee()) continue;
    let gain = alicornAcceptanceRate(f, near.a) * step;
    // Held up close by a hand it trusts: an introduction
    if (f.isDragging && near.d < 200 && (f.playerTrust ?? 0.5) >= ALICORN_INTRO_TRUST) {
      gain += step / ALICORN_INTRO_TIME;
      if (Math.random() < 0.08 && !f.tooYoungToSpeak() && f.speech.nextTime <= 0)
        f.speak(getDialogue(["ALICORN_ACCEPT", "INTRO"], f));
    }
    addAlicornComfort(f, gain);
  }
}
