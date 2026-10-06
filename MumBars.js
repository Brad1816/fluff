// ---------------------------------------------------------------------------
// Mum behind bars (plan): a mum who can't reach her foal - it's in a cage,
// an incubator or a can, or behind a pen fence, and she isn't (or the other
// way round) - notices, waits by the bars and frets, instead of walking up,
// failing to feed it and walking off again.
//
//   - She goes to the nearest side of the bars and sits there, facing it
//     (WaitByBarsDesire), while a foal of hers is hungry, crying or
//     frightened on the other side. A dad does too, a little less keenly.
//   - Her own lines, at most once a minute for each foal (BARS_LINE_EVERY):
//     can't feed it, calling to it, puzzled by the bars or glass, and
//     begging you when you're there. The foal answers: a talking foal calls
//     "Mummah!", a chirpy cries - through glass it only cries.
//   - It weighs on her: a steady drop (BARS_SAD_HOUR a game hour, half for a
//     dad), "Can't reach her foals" on the Mood tab. It hits hard, but never
//     so far that she gives up (Horse.barrierHurt: Brady's rule).
//   - Back together: she says so, cheers up (BARS_RELIEF) and feeds a
//     hungry foal straight away.
//   - A mum who's given up (happiness at "wan die") doesn't come (the bug
//     report: she ran to her hungry foals in a pen).
// Not saved: it starts again from what it sees.
// ---------------------------------------------------------------------------

const BARS_LINE_EVERY = 60; // game seconds between her lines, for each foal
const BARS_SAD_HOUR = 0.08; // happiness a game hour while a needy foal is out of reach (x0.5 for a dad)
const BARS_RELIEF = 0.06;
const BARS_NEAR = 40; // px: close enough to her spot by the bars
const BARS_SEE = 700; // px: a foal this far off in the same area counts
const BARS_FOAL_AGE = 0.5; // growth: foals younger than this
const barsTicker = new Ticker(1);

// What's between a parent and its foal: "glass" (an incubator), "bars" (a
// cage, enclosure or can), "fence" (a pen fence), or null
function barsKind(a, b) {
  if (!a || !b || a === b || a.scene !== b.scene) return null;
  if (a.isBehindBarrierFrom(b)) {
    const glass = (c) => typeof Incubator !== "undefined" && c instanceof Incubator;
    return glass(a.currentCage) || glass(b.currentCage) ? "glass" : "bars";
  }
  if (typeof canFluffiesReachEachOther === "function" && !canFluffiesReachEachOther(a, b)) return "fence";
  return null;
}

function _barsIsMum(p) {
  return p.gender === "female";
}

// Its foals in the same area
function _barsFoalsOf(p) {
  const list = typeof fluffiesInScene === "function" ? fluffiesInScene(p.scene) : fluffies;
  return list.filter((f) => f !== p && f.isAlive && f.scene === p.scene && f.growth < BARS_FOAL_AGE && (f.motherId === p.id || f.fatherId === p.id));
}

// Does this foal want its mum? Hungry, crying or frightened
function barsFoalNeedy(f) {
  if (!f || !f.isAlive) return false;
  if (f.hunger < 0.4) return true;
  if (typeof f.isCrying === "function" && f.isCrying()) return true;
  return typeof isFrightened === "function" && isFrightened(f);
}

function _barsCanCare(p) {
  return (
    p &&
    p.isAlive &&
    p.growth >= 1 &&
    p.happiness > WAN_DIE_THRESHOLD && // (given up: she doesn't come)
    !p.isDragging &&
    !p.placedOn &&
    !(typeof isFrightened === "function" && isFrightened(p))
  );
}

// The needy foal of p's that's out of reach (closest first), or null
function barsFoalFor(p) {
  if (!_barsCanCare(p)) return null;
  let best = null;
  let bestD = Infinity;
  for (const f of _barsFoalsOf(p)) {
    if (!barsFoalNeedy(f)) continue;
    const kind = barsKind(p, f);
    if (!kind) continue;
    const d = Math.hypot(f.x - p.x, f.y - p.y);
    if (d > BARS_SEE || d >= bestD) continue;
    best = f;
    bestD = d;
  }
  return best;
}

// Where she waits: beside the cage her foal's in, at its height; or, shut
// in herself, at the side of hers nearest it; or up against the fence
function barsSpot(p, f) {
  const topY = (typeof height === "number" ? height : 800) * 0.15 + 20;
  const clampY = (y) => Math.max(topY, y);
  const fc = f.currentCage;
  const pc = p.currentCage;
  if (fc && fc !== pc && fc.bounds) {
    const b = fc.bounds;
    const cx = (b.left + b.right) / 2;
    if (!pc) {
      return { x: p.x < cx ? b.left - 28 : b.right + 28, y: clampY(Math.min(Math.max(f.y, b.top + 30), b.bottom)) };
    }
  }
  if (pc && pc.bounds) {
    const b = pc.bounds;
    const cx = (b.left + b.right) / 2;
    return { x: f.x < cx ? b.left + 30 : b.right - 30, y: clampY(Math.min(Math.max(f.y, b.top + 30), b.bottom - 10)) };
  }
  // A fence (or both in different cages): head for it and be stopped
  return { x: f.x + (f.x > p.x ? -30 : 30), y: clampY(f.y) };
}

function _barsSay(f, path, other, always = false) {
  if (!f || !f.isAlive || typeof getDialogue !== "function") return;
  const line = getDialogue(path, f, other);
  if (line) f.speak(line, always, always);
}

// Her line (and the foal's answer a moment later)
function barsTalk(p, f, kind) {
  if (p.tooYoungToSpeak() || p.currentStateKey === "SLEEPING") return false;
  const now = timePlayed;
  p._barsLine = p._barsLine || {};
  if (now - (p._barsLine[f.id] ?? -Infinity) < BARS_LINE_EVERY) return false;
  p._barsLine[f.id] = now;
  const mum = _barsIsMum(p);
  let group;
  if (mum && f.hunger < 0.4 && p.lactatingTimer > 0) group = "CANT_FEED";
  else if (p.scene === currentScene && Math.random() < 0.3) group = "BEG";
  else if (kind !== "fence" && Math.random() < 0.35) group = kind === "glass" ? "PUZZLED_GLASS" : "PUZZLED";
  else group = mum ? "CALL" : "CALL_DAD";
  _barsSay(p, ["BARS", group], f);
  p.expressionOverride = "CRYING_SHOCKED";
  p.expressionOverrideTimer = 3;
  // The foal answers
  f._barsAnswer = { at: now + 1.5, from: p.id, glass: kind === "glass" };
  return group;
}

function _barsAnswer(f) {
  const a = f._barsAnswer;
  if (!a || timePlayed < a.at) return;
  f._barsAnswer = null;
  if (!f.isAlive || f.currentStateKey === "SLEEPING") return;
  const parent = fluffyById(a.from);
  if (!f.tooYoungToSpeak() && !a.glass) {
    _barsSay(f, ["BARS", parent && !_barsIsMum(parent) ? "FOAL_CALL_DAD" : "FOAL_CALL"], parent);
  } else {
    _barsSay(f, ["BARS", "FOAL_CRY"], parent, true); // (a starving chirpy still cries)
    f.expressionOverride = "CRYING_SHOCKED";
    f.expressionOverrideTimer = 2.5;
  }
}

// Back together
function barsReunited(p, f) {
  if (!p.tooYoungToSpeak()) _barsSay(p, ["BARS", _barsIsMum(p) ? "RELIEF" : "RELIEF_DAD"], f);
  p.changeHappiness(BARS_RELIEF, _barsIsMum(p) ? "Back with her foals" : "Back with his foals");
  p.expressionOverride = "RELIEF";
  p.expressionOverrideTimer = 2.5;
  // ...and a hungry one is fed straight away
  if (_barsIsMum(p) && p.lactatingTimer > 0 && f.hunger < 0.6 && p.positioning && typeof p.positioning.scoutForHungryFoal === "function") {
    p.positioning.scoutForHungryFoal();
  }
}

function updateMumBars(dt) {
  const step = barsTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const hours = step / HOUR_LENGTH;
  for (const p of fluffies) {
    if (p._barsAnswer) _barsAnswer(p);
    if (!p.isAlive || p.growth < 1) continue;
    const f = barsFoalFor(p);
    if (f) {
      const kind = barsKind(p, f);
      p._bars = { foalId: f.id, kind, since: p._bars && p._bars.foalId === f.id ? p._bars.since : timePlayed };
      // It weighs on her (never down to "wan die")
      const sad = BARS_SAD_HOUR * hours * (_barsIsMum(p) ? 1 : 0.5);
      p.barrierHurt(-sad, _barsIsMum(p) ? "Can't reach her foals" : "Can't reach his foals");
      // Lines once she's close enough to see it
      if (Math.hypot(f.x - p.x, f.y - p.y) < 260) barsTalk(p, f, kind);
      continue;
    }
    // Was kept apart: are they together now?
    if (p._bars) {
      const was = fluffyById(p._bars.foalId);
      p._bars = null;
      if (was && was.isAlive && was.scene === p.scene && !barsKind(p, was) && p.isAlive && p.happiness > WAN_DIE_THRESHOLD) barsReunited(p, was);
    }
  }
}
registerSystem("mumBars", updateMumBars, 146);

// Waits by the bars, facing its foal
class WaitByBarsDesire extends Desire {
  constructor() {
    super("WaitByBars");
  }
  evaluate(h) {
    if (!h._bars || !_barsCanCare(h) || h.isScared || h.isStacking) return 0;
    if (h.currentStateKey === "SLEEPING" || h.tooYoungToWalk()) return 0;
    const f = fluffyById(h._bars.foalId);
    if (!f || !f.isAlive || !barsKind(h, f)) return 0;
    return _barsIsMum(h) ? 55 : 44;
  }
  execute(h) {
    const f = h._bars && fluffyById(h._bars.foalId);
    if (!f) return false;
    const spot = barsSpot(h, f);
    if (Math.hypot(spot.x - h.x, spot.y - h.y) > BARS_NEAR) {
      if (!h.isMovingOrRunning()) h.initBehavior("MOVING");
      h.setTargetPosition(spot.x, spot.y);
      if (typeof h.constrainTargetToCage === "function") h.constrainTargetToCage();
      return true;
    }
    // There: settle, facing it
    h.facingRight = f.x > h.x;
    if (h.currentStateKey !== "SITTING" && !h.isCrawling) h.initBehavior("SITTING");
    return true;
  }
}
if (typeof EXTRA_DESIRES !== "undefined") EXTRA_DESIRES.push(WaitByBarsDesire);
