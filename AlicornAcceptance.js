// ---------------------------------------------------------------------------
// Alicorn acceptance: fluffies slowly get used to alicorns.
//
// With alicorn intolerance on (the "Headcanon" setting), fluffies are scared
// of alicorns ("munstahs"). Each fluffy has alicornComfort (0..1, saved).
// It grows while the fluffy is awake and can see an alicorn within
// ALICORN_SEE_RANGE that isn't hurting anyone; at 1 it accepts alicorns for
// good (alicornTolerance, as before).
//
// Plain exposure takes ALICORN_ACCEPT_TIME seconds of seeing one (a game
// day; in practice about two, since scared ones keep running out of sight).
// Faster for:
//   - foals (x4 when tiny, x2 when half grown) - young ones learn quickly
//   - a mum with her own alicorn foal (x4) - and once she accepts it, it's
//     her baby again instead of an "estranged" one
//   - brave fluffies (up to x1.5; timid ones down to x0.5)
//   - friends, family or herd-mates who already accept alicorns being close
//     by (up to x2.5): they see there's nothing to fear
//   - the alicorn being in a cage (x1.5): safe to look at
//   - you holding the fluffy close to the alicorn ("introducing" them), if it
//     trusts you (Memory.js playerTrust >= 0.5)
//   - the "munstah" channel on the Fluff TV: even the ones that run off
//     learn a little each time
// Slower for smarties (x0.3), and for hungry or miserable fluffies (x0.5).
// Setbacks: an alicorn attacking it (-0.3) or one it can see (-0.1).
//
// As comfort grows the fear range shrinks (alicornFearRange: 300px when
// afraid, 120px just before accepting), so they run less often.
// The magnifying glass shows "Alicorns: Afraid / Getting used to them (40%) /
// Accepts them".
// ---------------------------------------------------------------------------

const ALICORN_SEE_RANGE = 450;
const ALICORN_ACCEPT_TIME = 1200; // game seconds of plain exposure, 0 -> 1 (one game day)
const ALICORN_INTRO_TIME = 120; // seconds held close by a trusted hand, 0 -> 1
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
  return 300 * (1 - 0.6 * getAlicornComfort(f));
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
  if (f.growth < 0.3) r *= 4;
  else if (f.growth < 1) r *= 2;
  if (f.isSmarty && f.isSmarty()) r *= 0.3;
  const brave = typeof traitValue === "function" ? traitValue(f, "bravery") : 0;
  r *= 1 + 0.5 * brave;
  if (a.currentCage) r *= 1.5;
  if (a.motherId === f.id) r *= 4;
  // Good examples nearby
  let examples = 0;
  for (const o of fluffies) {
    if (o === f || o === a || !o.isAlive || o.scene !== f.scene || o.type === "alicorn") continue;
    if (o.currentStateKey === "SLEEPING" || !o.tolerantOfAlicorns()) continue;
    if (Math.hypot(o.x - f.x, o.y - f.y) > 300) continue;
    if (_acceptLikes(f, o) && ++examples >= 2) break;
  }
  r *= 1 + 0.75 * examples;
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
    if (f === target) f.alicornComfort = Math.max(0, (f.alicornComfort || 0) - 0.3);
    else if (f.canSee() && f.currentStateKey !== "SLEEPING" && Math.hypot(f.x - attacker.x, f.y - attacker.y) < 300)
      f.alicornComfort = Math.max(0, (f.alicornComfort || 0) - 0.1);
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
  if (!alicorns.length) return;
  for (const f of fluffies) {
    if (!f.isAlive || f.tolerantOfAlicorns() || f.currentStateKey === "SLEEPING" || !f.canSee()) continue;
    const near = _nearestAlicorn(f, alicorns);
    if (!near || near.d > ALICORN_SEE_RANGE) continue;
    let gain = alicornAcceptanceRate(f, near.a) * step;
    // Held up close by a hand it trusts: an introduction
    if (f.isDragging && near.d < 200 && (f.playerTrust ?? 0.5) >= 0.5) {
      gain += step / ALICORN_INTRO_TIME;
      if (Math.random() < 0.08 && !f.tooYoungToSpeak() && f.speech.nextTime <= 0)
        f.speak(getDialogue(["ALICORN_ACCEPT", "INTRO"], f));
    }
    addAlicornComfort(f, gain);
  }
}
