// ---------------------------------------------------------------------------
// Pegasus wings. In the lore a pegasus can't really fly - it flutters a
// very little - but its wings do break a fall: it survives a fall that
// would hurt another fluffy.
//
// A pegasus or alicorn with both wings flaps when it falls
// (HorsePhysics.updateThrowFall, Horse.handleThrowImpact):
//   - it falls a little slower (gravity x (1 - WING_LIFT x strength))
//   - a landing has to be faster to hurt it (x (1 + WING_CUSHION x
//     strength)), and hurts less when it does (x (1 - WING_SOFTEN x
//     strength))
//   - with strong enough wings (WING_FEET) a small fall puts it down on its
//     feet instead of knocking it flat
// Its wings get stronger with use (f.flightSkill 0..1, saved - "wing
// strength"): a little each time it's thrown and comes down (FLIGHT_LEARN),
// and flapping practice on the perch (Perch.js). Even a pegasus with the
// strongest wings never takes off, glides or flies anywhere by itself.
// No wings (a wing cut off): nothing to flap - what it built up isn't lost.
// The magnifying glass shows it ("Wings: ...").
// ---------------------------------------------------------------------------

const FLIGHT_LEARN = 0.05; // wing strength a throw
const WING_LIFT = 0.3;
const WING_CUSHION = 0.6;
const WING_SOFTEN = 0.5;
const WING_FEET = 0.3; // lands on its feet from a small fall
const WING_BASE = 0.25; // what any pegasus's wings do, untrained (strength counts from here)

// Both wings, to flap with
function canFly(f) {
  if (typeof isMangled === "function" && (isMangled(f, "leftWing") || isMangled(f, "rightWing"))) return false; // (Injuries.js)
  return !!(f && f.isAlive && typeof f.hasBothWings === "function" && f.hasBothWings());
}

// 0..1: how much its wings help (a little even untrained)
function flightSkillOf(f) {
  if (!canFly(f)) return 0;
  const s = Math.max(0, Math.min(1, f.flightSkill || 0));
  return WING_BASE + (1 - WING_BASE) * s;
}

// The pull down on it while it's falling
function flightGravity(f, base) {
  return base * (1 - WING_LIFT * flightSkillOf(f));
}

// Horse.handleThrowImpact: how fast a landing has to be to hurt it, and how much
function wingImpactThreshold(f, base) {
  return base * (1 + WING_CUSHION * flightSkillOf(f));
}
function wingDamageFactor(f) {
  return 1 - WING_SOFTEN * flightSkillOf(f);
}

// It came down from a throw (or practised on the perch, Perch.js): stronger wings
function learnFlight(f, amount = FLIGHT_LEARN) {
  if (!canFly(f)) return 0;
  const before = f.flightSkill || 0;
  f.flightSkill = Math.min(1, before + amount);
  for (const [at, key] of [[WING_FEET, "GLIDE"], [0.8, "SOLO"]]) {
    if (before < at && f.flightSkill >= at && !f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["FLIGHT", key], f), true);
  }
  return f.flightSkill;
}

// How hard it lands (HorsePhysics)
function landingSpeed(f, vx, vy) {
  return Math.hypot(vx, vy);
}

// Lands on its feet? (strong wings, and a landing too soft to hurt it)
function landsOnItsFeet(f, impactSpeed) {
  return canFly(f) && (f.flightSkill || 0) >= WING_FEET && impactSpeed < wingImpactThreshold(f, THROW_IMPACT_MIN_SPEED);
}

// A flutter hop's shadow stays put (Perch.js; HorsePhysics)
function updateFlightShadow(f) {
  const fl = f._flight;
  if (!fl) return;
  const span = fl.x1 - fl.x0;
  const t = span ? Math.max(0, Math.min(1, (f.x - fl.x0) / span)) : 1;
  f.throwShadowY = fl.b0 + (fl.b1 - fl.b0) * t;
}

// Magnifying glass: [text, tone] or null (only winged ones)
function describeFlight(f) {
  if (!f || !f.isAlive || (f.type !== "pegasus" && f.type !== "alicorn")) return null;
  const s = Math.max(0, Math.min(1, f.flightSkill || 0));
  if (!canFly(f)) {
    const mangled = typeof isMangled === "function" && (isMangled(f, "leftWing") || isMangled(f, "rightWing"));
    return [mangled && f.hasBothWings() ? "Can't flap (a wing is mangled)" : "Can't flap (a wing is gone)", "bad"];
  }
  if (typeof isPractisingFlight === "function" && isPractisingFlight(f)) return ["Practising flapping on the perch", "good"];
  if (s >= 0.8) return ["Very strong: breaks almost any fall", "good"];
  if (s >= WING_FEET) return ["Strong: lands on its feet from a small fall", "good"];
  if (s > 0) return ["Getting stronger: softens a fall", "ok"];
  return ["Flutters a little: softens a fall", "ok"];
}
