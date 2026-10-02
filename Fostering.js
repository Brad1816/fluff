// ---------------------------------------------------------------------------
// Foster mums: a wild mare may take in an orphaned wild foal near her.
//
// Who might: a grown wild (not yours) mare, awake and well, who is either
//   - grieving: she lost a foal of her own in the last FOSTER_GRIEF_DAYS
//     days (it died, or was born dead: f.lostFoalAt, HorseAnatomy.die).
//     If her milk has dried up it comes back for the foal (and any foster
//     mum's milk lasts till the foal's weaned).
//   - a kind mum: gentle (temper trait at most FOSTER_KIND_TEMPER) and
//     nursing foals of her own right now (she has milk)
// and isn't a mum who'd reject this foal anyway (its colour, an alicorn
// she can't stand, one she's already turned away), and hasn't a full
// litter already (FOSTER_MAX_LITTER).
// Who can be taken in: a wild foal still on milk (growth under
// FOSTER_MAX_GROWTH) whose mum is dead or gone, in the same area, within
// FOSTER_RANGE of her, and that she can see or hear.
// How often: now and then (FOSTER_CHANCE_*, per game hour, less the more
// foals she's already nursing) - but a hungry orphan cries for its mum
// (FOSTER_HUNGRY), she hears it from further off (FOSTER_HEAR_RANGE), and
// she's far likelier to come (FOSTER_CRY_BOOST): an orphan starves in a few
// hours, so a crying one is the one a mum goes to. She walks over, takes it in, and it's
// hers: her baby_child (Carrying.js: a newborn rides on her back), her
// special friend its dad, her foals its brothers and sisters - as when an
// orphan finds a mare who'll let it drink (HorseFamily.attemptAdoption).
// It goes in both their stories ("taken in by"), the magnifying glass
// shows it ("Foster mum: ..."; the family tree keeps its birth mum), and
// the foal's foster mum is saved (f.fosterMumId).
// Only wild ones: your own orphans are yours to look after.
// ---------------------------------------------------------------------------

const FOSTER_EVERY = 10; // game seconds between looks
const FOSTER_RANGE = 380; // px
const FOSTER_REACH = 55; // px: close enough to take it in
const FOSTER_WALK_MAX = 60; // game seconds to get there before she gives up
const FOSTER_GRIEF_DAYS = 3;
const FOSTER_KIND_TEMPER = -0.25; // "Gentle" end of the temper trait
const FOSTER_MAX_GROWTH = 0.36; // still on milk
const FOSTER_MAX_LITTER = 5; // foals she's nursing already
const FOSTER_CHANCE_GRIEVING = 0.5; // per game hour
const FOSTER_CHANCE_KIND = 0.2; // per game hour
const FOSTER_HUNGRY = 0.4; // an orphan this hungry cries for a mum...
const FOSTER_HEAR_RANGE = 750; // px: ...heard this far off...
const FOSTER_CRY_BOOST = 4; // ...and she's this much likelier to come (at most FOSTER_CHANCE_MAX)
const FOSTER_CHANCE_MAX = 0.95;
const FOSTER_CRY_EVERY = 12; // game seconds between its cries
const fosterTicker = new Ticker(FOSTER_EVERY);

function _fsNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}

// Its mum is dead or gone (a wild foal still on milk)
function isWildOrphan(f) {
  if (!f || !f.isAlive || f.adopted || f.growth >= FOSTER_MAX_GROWTH) return false;
  if (f.isDragging || f.placedOn || f.currentCage) return false;
  if (f.motherId === null || f.motherId === undefined) return true;
  const mum = fluffies.find((m) => m.id === f.motherId);
  return !mum || !mum.isAlive;
}

// Foals she's nursing (baby_child, alive)
function _fsNursing(m) {
  const rels = relationships[m.id] || {};
  let n = 0;
  for (const [id, rel] of Object.entries(rels)) {
    if (rel !== "baby_child") continue;
    const k = fluffies.find((x) => String(x.id) === id);
    if (k && k.isAlive) n++;
  }
  return n;
}

// Why she'd take one in: "grieving", "kind", or null
function fosterMumReason(m) {
  if (!m || !m.isAlive || m.adopted || m.gender !== "female" || m.growth < 1) return null;
  if (m.currentStateKey === "SLEEPING" || m.isDragging || m.placedOn || m.currentCage || m.isPregnant) return null;
  if (m.happiness <= WAN_DIE_THRESHOLD || m.health < 40) return null;
  if (_fsNursing(m) >= FOSTER_MAX_LITTER) return null;
  const now = _fsNow();
  if (typeof m.lostFoalAt === "number" && m.lostFoalAt <= now && now - m.lostFoalAt <= FOSTER_GRIEF_DAYS * DAY_LENGTH) return "grieving";
  const temper = typeof traitValue === "function" ? traitValue(m, "temper") : 0;
  if (temper <= FOSTER_KIND_TEMPER && m.lactatingTimer > 0 && _fsNursing(m) > 0) return "kind";
  return null;
}

// Crying for a mum: hungry, awake
function orphanCrying(f) {
  return isWildOrphan(f) && f.hunger < FOSTER_HUNGRY && f.currentStateKey !== "SLEEPING";
}

// Would she take this one? (a crying one she can hear from further off)
function canFoster(m, foal) {
  if (!fosterMumReason(m) || !isWildOrphan(foal) || m.scene !== foal.scene || m === foal) return false;
  const crying = orphanCrying(foal);
  if (Math.hypot(m.x - foal.x, m.y - foal.y) > (crying ? FOSTER_HEAR_RANGE : FOSTER_RANGE)) return false;
  if (crying ? !m.canHear() : !(m.canSee() || m.canHear())) return false;
  const rel = (relationships[m.id] || {})[foal.id];
  if (rel === "rejected_baby" || rel === "estranged_child") return false;
  if (typeof mumRejectsFoalColour === "function" && mumRejectsFoalColour(m, foal)) return false;
  if (typeof worldSettings !== "undefined" && worldSettings.alicornIntolerance && foal.typeVisibleToOthers() === "alicorn" && !m.tolerantOfAlicorns()) return false;
  if (typeof canFluffyReach === "function" && typeof sceneHasFences === "function" && sceneHasFences(m.scene) && !canFluffyReach(m, foal.x, foal.y)) return false;
  return true;
}

// Make it hers (also used when an orphan finds a mare who lets it drink)
function takeInFoal(mare, foal) {
  const rels = relationships[mare.id] || (relationships[mare.id] = {});
  foal.motherId = mare.id;
  foal.adopted = mare.adopted;
  setRelationship(mare.id, foal.id, "baby_child");
  setRelationship(foal.id, mare.id, "mother");
  // Her foals: its brothers and sisters
  for (const sibling of fluffies) {
    if (sibling === foal || sibling.motherId !== mare.id) continue;
    setRelationship(foal.id, sibling.id, sibling.gender === "male" ? "brother" : "sister");
    setRelationship(sibling.id, foal.id, foal.gender === "male" ? "brother" : "sister");
  }
  // Her special friend: its dad
  const specialFriendId = Object.keys(rels).find((id) => rels[id] === "special_friend");
  if (specialFriendId) {
    const dad = fluffies.find((f) => f.id == specialFriendId);
    if (dad) {
      setRelationship(dad.id, foal.id, "baby_child");
      setRelationship(foal.id, dad.id, "father");
    }
  }
  if (typeof meet === "function") meet(mare, foal); // (Acquaintance.js)
}

// She takes it in
function fosterFoal(mare, foal, why = fosterMumReason(mare)) {
  if (!mare || !foal) return false;
  takeInFoal(mare, foal);
  foal.fosterMumId = mare.id;
  // Her milk lasts till it's weaned (grieving, dried up: it comes back)
  const grow = typeof GROW_UP_TIME === "number" ? GROW_UP_TIME : 2400;
  const need = Math.max(0, FOSTER_MAX_GROWTH - foal.growth) * grow * 1.1;
  if (!(mare.lactatingTimer > 0)) mare.milkCharges = Math.max(mare.milkCharges || 0, 2);
  mare.lactatingTimer = Math.max(mare.lactatingTimer || 0, need);
  mare.lostFoalAt = null; // (she has a foal to look after now)
  mare._fostering = null;
  foal.changeHappiness(0.2);
  mare.changeHappiness(why === "grieving" ? 0.25 : 0.1);
  if (typeof recordStory === "function") recordStory("fostered", [foal.id, mare.id]);
  if (mare.happiness > WAN_DIE_THRESHOLD && !mare.tooYoungToSpeak()) mare.speak(getDialogue(["FOSTER", why === "grieving" ? "GRIEVING" : "KIND"], mare, foal), true);
  if (foal.tooYoungToSpeak()) foal.speak(getDialogue(["FOSTER", "FOAL"], foal, mare), false, true);
  return true;
}

// Magnifying glass: [text, tone] or null
function describeFoster(f) {
  if (!f || f.fosterMumId === null || f.fosterMumId === undefined) return null;
  const name = typeof fluffyDisplayNameById === "function" ? fluffyDisplayNameById(f.fosterMumId, "a wild mare") : "a wild mare";
  return [`Taken in by ${name}`, "good"];
}

function updateFostering(dt) {
  if (typeof fluffies === "undefined") return;
  const now = _fsNow();
  // On her way to a foal: steered every step (or she wanders off)
  for (const m of fluffies) {
    const job = m._fostering;
    if (!job) continue;
    const foal = fluffies.find((x) => x.id === job.id);
    if (!foal || !canFoster(m, foal) || now - job.at > FOSTER_WALK_MAX) {
      m._fostering = null;
      continue;
    }
    if (Math.hypot(m.x - foal.x, m.y - foal.y) <= FOSTER_REACH) {
      fosterFoal(m, foal, job.why);
      continue;
    }
    if (!m.isMovingOrRunning()) m.initBehavior("MOVING");
    m.setTargetPosition(foal.x, foal.y);
  }
  const step = fosterTicker.step(dt);
  if (!step) return;
  // Who sets off for one?
  const orphans = fluffies.filter(isWildOrphan);
  if (!orphans.length) return;
  // Hungry ones cry for a mum
  for (const o of orphans) {
    if (!orphanCrying(o) || (o.speech && o.speech.text)) continue;
    if (typeof o._orphanCryAt === "number" && o._orphanCryAt <= now && now - o._orphanCryAt < FOSTER_CRY_EVERY) continue;
    o._orphanCryAt = now;
    o.speak(getDialogue(["FOAL_CALL", o.tooYoungToSpeak() ? "CHIRPY" : "DEFAULT"], o), false, true);
  }
  const taken = new Set(fluffies.filter((m) => m._fostering).map((m) => m._fostering.id));
  for (const m of fluffies) {
    if (m._fostering) continue;
    const why = fosterMumReason(m);
    if (!why) continue;
    const near = orphans
      .filter((o) => !taken.has(o.id) && canFoster(m, o))
      .sort((a, b) => (orphanCrying(b) ? 1 : 0) - (orphanCrying(a) ? 1 : 0) || Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y));
    if (!near.length) continue;
    let perHour = (why === "grieving" ? FOSTER_CHANCE_GRIEVING : FOSTER_CHANCE_KIND) * Math.max(0, 1 - 0.2 * _fsNursing(m));
    if (orphanCrying(near[0])) perHour = Math.min(FOSTER_CHANCE_MAX, perHour * FOSTER_CRY_BOOST);
    const chance = 1 - Math.pow(1 - perHour, step / HOUR_LENGTH);
    if (Math.random() > chance) continue;
    m._fostering = { id: near[0].id, at: now, why };
    taken.add(near[0].id);
    m.initBehavior("MOVING");
    m.setTargetPosition(near[0].x, near[0].y);
    if (m.happiness > WAN_DIE_THRESHOLD && !m.tooYoungToSpeak() && (!m.speech || !m.speech.text)) m.speak(getDialogue(["FOSTER", "SEES"], m, near[0]));
  }
}
registerSystem("fostering", updateFostering, 64);
