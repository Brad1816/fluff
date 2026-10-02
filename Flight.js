// ---------------------------------------------------------------------------
// Throwing teaches pegasi to fly.
//
// A pegasus or alicorn with both wings (and no wing jacket) learns a little
// every time it's thrown and comes down (FLIGHT_LEARN; f.flightSkill 0..1,
// saved). As it learns (HorsePhysics.updateThrowFall):
//   - it flaps: it falls slower (gravity x (1 - FLIGHT_LIFT x skill)) and
//     drifts further, so it lands softer - a skilled one lands on its feet,
//     unhurt, instead of being knocked flat
//   - from FLIGHT_GLIDE it glides: its fall can't get faster than
//     glideSpeed(), so it never lands hard
//   - from FLIGHT_SOLO it flies by itself: now and then, heading somewhere
//     far off (FLIGHT_SOLO_DIST), it takes off and flies there instead of
//     walking (startSoloFlight)
// No wings (a wing cut off), no flying - what it learnt isn't forgotten.
// The magnifying glass shows how it's getting on ("Flying: flutters").
// ---------------------------------------------------------------------------

const FLIGHT_LEARN = 0.08; // a throw
const FLIGHT_LIFT = 0.7;
const FLIGHT_GLIDE = 0.4;
const FLIGHT_SOLO = 0.8;
const FLIGHT_SOLO_DIST = 260; // px
const FLIGHT_SOLO_CHANCE = 0.25; // a second, heading far
const FLIGHT_HEIGHT = 90; // px above the higher end, a solo flight
const flightTicker = new Ticker(1);

function canFly(f) {
  return !!(f && f.isAlive && typeof f.hasBothWings === "function" && f.hasBothWings());
}

function flightSkillOf(f) {
  return canFly(f) ? Math.max(0, Math.min(1, f.flightSkill || 0)) : 0;
}

// The pull down on it while it's in the air
function flightGravity(f, base) {
  const s = flightSkillOf(f);
  return base * (1 - FLIGHT_LIFT * s);
}

// The fastest it'll fall gliding (Infinity: not gliding yet)
function glideSpeed(f) {
  const s = flightSkillOf(f);
  if (s < FLIGHT_GLIDE) return Infinity;
  return 480 - 340 * ((s - FLIGHT_GLIDE) / (1 - FLIGHT_GLIDE)); // 480 -> 140 (under THROW_IMPACT_MIN_SPEED: a soft landing)
}

// It came down from a throw (or hopped on the perch, Perch.js): a little better at it
function learnFlight(f, amount = FLIGHT_LEARN) {
  if (!canFly(f)) return 0;
  const before = f.flightSkill || 0;
  f.flightSkill = Math.min(1, before + amount);
  for (const [at, key] of [[FLIGHT_GLIDE, "GLIDE"], [FLIGHT_SOLO, "SOLO"]]) {
    if (before < at && f.flightSkill >= at && !f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["FLIGHT", key], f), true);
  }
  return f.flightSkill;
}

// How hard it lands: one that can glide runs out its forward speed on
// landing - only the drop counts
function landingSpeed(f, vx, vy) {
  return flightSkillOf(f) >= FLIGHT_GLIDE * 0.75 ? Math.abs(vy) : Math.hypot(vx, vy);
}

// Lands on its feet? (a soft landing, and it knows how)
function landsOnItsFeet(f, impactSpeed) {
  return flightSkillOf(f) >= FLIGHT_GLIDE * 0.75 && impactSpeed < THROW_IMPACT_MIN_SPEED;
}

// Take off and fly to (tx, ty), using the throw's fall (HorsePhysics)
function startSoloFlight(f, tx, ty) {
  if (!canFly(f) || flightSkillOf(f) < FLIGHT_SOLO || f.isFallingFromThrow) return false;
  const g = flightGravity(f, 1500);
  const y0 = f.y;
  const y1 = ty;
  const apex = Math.min(y0, y1) - FLIGHT_HEIGHT;
  const vy0 = -Math.sqrt(2 * g * (y0 - apex));
  // when it comes down to y1
  const T = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * g * (y1 - y0))) / g;
  if (!(T > 0)) return false;
  f.isFallingFromThrow = true;
  f.throwStartY = y1;
  f.throwFallVy = vy0;
  f.throwFallVx = (tx - f.x) / T;
  f._flight = { x0: f.x, x1: tx, b0: f.getBottomYStanding(), b1: f.getBottomYStanding() + (y1 - y0) };
  f.throwShadowY = f._flight.b0;
  f.facingRight = tx > f.x;
  f.expressionOverride = "GOOD_UPSIES"; // (loves it)
  f.expressionOverrideTimer = Math.max(1.5, T);
  if (!f.tooYoungToSpeak() && Math.random() < 0.4 && (!f.speech || !f.speech.text) && typeof getDialogue === "function") f.speak(getDialogue(["FLIGHT", "FLYING"], f));
  return true;
}

// While flying by itself: its shadow follows along the ground
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
  if (!canFly(f)) return s > 0 ? ["Can't fly any more (wings)", "bad"] : null;
  if (s >= FLIGHT_SOLO) return ["Flies by itself", "good"];
  if (s >= FLIGHT_GLIDE) return ["Glides (lands on its feet)", "good"];
  if (typeof isPractisingFlight === "function" && isPractisingFlight(f)) return ["Practising on the perch", "good"];
  if (s > 0) return ["Flutters - getting the hang of it", "ok"];
  return ["Can't fly yet", "ok"];
}

// Now and then, heading somewhere far: it flies there
function updateFlight(dt) {
  const step = flightTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  for (const f of fluffies) {
    if (flightSkillOf(f) < FLIGHT_SOLO || f.isFallingFromThrow || f.isDragging || f.currentCage || f.placedOn || f._riding) continue;
    if (!f.isMovingOrRunning() || f.isCrawling || f.tooYoungToWalk() || f.health < 50 || f.currentStateKey === "SLEEPING") continue;
    if (typeof f.targetX !== "number" || typeof f.targetY !== "number") continue;
    if (Math.hypot(f.targetX - f.x, f.targetY - f.y) < FLIGHT_SOLO_DIST) continue;
    if (typeof sceneHasFences === "function" && sceneHasFences(f.scene) && typeof canFluffyReach === "function" && !canFluffyReach(f, f.targetX, f.targetY)) continue;
    if (Math.random() < FLIGHT_SOLO_CHANCE * step) startSoloFlight(f, f.targetX, f.targetY);
  }
}
registerSystem("flight", updateFlight, 68);
