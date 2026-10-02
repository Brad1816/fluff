// ---------------------------------------------------------------------------
// Smarty moods: Smarties are bullies, not killing machines.
//
//   - They like or put up with their own: herd-mates, family, friends and
//     special friends (anyone they like, getLiking >= SMARTY_TOLERATE in
//     Bonds.js). They don't pick on them.
//   - Real fights (SmartyCombat, "SMARTY_VIOLENCE") only happen when a
//     Smarty is in a bad mood (happiness under SMARTY_BAD_MOOD) or was
//     provoked: hit by that fluffy in the last SMARTY_PROVOKED_TIME, or it
//     holds a deep grudge against it (hitting it back doesn't count). Even
//     then, unless it's in a bad mood, it stops after SMARTY_POINT_HITS
//     hits, once the other is hurt (SMARTY_SPARE_HEALTH) or once it's hurt
//     itself (SMARTY_RETREAT_HEALTH), draws no blood, and lets that quarrel
//     go for SMARTY_SETTLED_TIME.
//   - In a good mood it just bullies now and then (every SMARTY_BULLY_GAP
//     or so): shoves a fluffy outside its circle out of the way. A shove
//     ("BULLY") hurts a little and can never kill.
//   - Enfies: after one, a Smarty waits SMARTY_ENFIES_GAP (2-5 game hours)
//     before seeking another, and only goes after a pregnant mare when no
//     other mare it could chase is around (HorsePositioning.findSmartyMateTarget).
// ---------------------------------------------------------------------------

const SMARTY_BAD_MOOD = 0.4;
const SMARTY_TOLERATE = 0.2; // liking at which it leaves you alone
const SMARTY_PROVOKED_TIME = 2 * HOUR_LENGTH;
const SMARTY_SPARE_HEALTH = 60; // a good-mood Smarty stops once they're this hurt,
const SMARTY_POINT_HITS = 3; // or after this many hits (it's made its point),
const SMARTY_RETREAT_HEALTH = 50; // or when it's this hurt itself
const SMARTY_SETTLED_TIME = DAY_LENGTH; // ...and leaves that one be for a day
const SMARTY_BULLY_GAP = [2 * HOUR_LENGTH, 6 * HOUR_LENGTH];
const SMARTY_BULLY_RANGE = 300;
const SMARTY_BULLY_DAMAGE = 4;
const SMARTY_BULLY_FLOOR = 30; // a shove never takes health below this
const SMARTY_ENFIES_GAP = [2 * HOUR_LENGTH, 5 * HOUR_LENGTH];

function _smGap(range) {
  return range[0] + Math.random() * (range[1] - range[0]);
}

function smartyInBadMood(s) {
  return !!s && s.happiness < SMARTY_BAD_MOOD;
}

// Someone started on it (HorseSocial.performAttack; hitting back doesn't count)
function noteSmartyProvoked(s, by) {
  if (!s || !by || s === by) return;
  s.smartyProvokerId = by.id;
  s.smartyProvokedUntil = timePlayed + SMARTY_PROVOKED_TIME;
  if (s.smartySettled) delete s.smartySettled[by.id]; // a new quarrel
  if (s.smartyQuarrelHits) delete s.smartyQuarrelHits[by.id];
}

function smartyProvokedBy(s, f) {
  if (!s || !f) return false;
  if (s.smartyProvokerId === f.id && timePlayed < (s.smartyProvokedUntil || 0)) return true;
  // A deep grudge, unless it has already made its point lately
  if (s.smartySettled && timePlayed < (s.smartySettled[f.id] || 0)) return false;
  return typeof getOpinion === "function" && typeof OPINION_GRUDGE !== "undefined" && getOpinion(s, f) <= OPINION_GRUDGE;
}

// It has made its point: that quarrel is over for a while
function smartySettle(s, f) {
  if (!s || !f) return;
  if (s.smartyProvokerId === f.id) s.smartyProvokedUntil = 0;
  if (!s.smartySettled) s.smartySettled = {};
  s.smartySettled[f.id] = timePlayed + SMARTY_SETTLED_TIME;
  if (s.smartyQuarrelHits) delete s.smartyQuarrelHits[f.id];
}

// Count its hits in a quarrel (HorseUpdate._updateSmartyChase)
function smartyLandedHit(s, f) {
  if (!s.smartyQuarrelHits) s.smartyQuarrelHits = {};
  s.smartyQuarrelHits[f.id] = (s.smartyQuarrelHits[f.id] || 0) + 1;
}

// Its herd, family and friends (and anyone else it likes)
function smartyTolerates(s, f) {
  if (!s || !f) return false;
  if (s.herdId !== null && s.herdId !== undefined && s.herdId === f.herdId) return true;
  if (f.id === s.motherId || f.id === s.fatherId || f.motherId === s.id || f.fatherId === s.id) return true;
  const known = (x) => x !== null && x !== undefined;
  if ((known(s.motherId) && f.motherId === s.motherId) || (known(s.fatherId) && f.fatherId === s.fatherId)) return true;
  if (typeof getLiking === "function" && getLiking(s, f) >= SMARTY_TOLERATE) return true;
  return false;
}

// Does it want a real fight with f right now?
function smartyWantsToFight(s, f) {
  if (!s || !f || !f.isAlive) return false;
  if (smartyProvokedBy(s, f)) return true;
  return smartyInBadMood(s) && !smartyTolerates(s, f);
}

// Should an ongoing fight stop? (the other one has had enough, it cooled
// down, or it's one of its own again)
function smartyStopsFighting(s, f) {
  if (!smartyWantsToFight(s, f)) return true;
  const hits = (s.smartyQuarrelHits && s.smartyQuarrelHits[f.id]) || 0;
  if (!smartyInBadMood(s) && (f.health < SMARTY_SPARE_HEALTH || hits >= SMARTY_POINT_HITS || s.health < SMARTY_RETREAT_HEALTH)) {
    smartySettle(s, f);
    return true;
  }
  return false;
}

function _smCanReach(s, f) {
  return (
    f !== s &&
    f.isAlive &&
    f.scene === s.scene &&
    !f.isDragging &&
    f.currentCage === s.currentCage &&
    (typeof fenceCanReachThing !== "function" || fenceCanReachThing(s, f))
  );
}

// Who it would fight: whoever provoked it, else (in a bad mood) the
// nearest stallion that isn't one of its own. null = no fight.
function smartyFightTarget(s) {
  const alicornOk = (f) =>
    !worldSettings.alicornIntolerance || s.tolerantOfAlicorns() || f.typeVisibleToOthers() !== "alicorn";
  let best = null;
  let bestD = 500;
  for (const f of fluffies) {
    if (!_smCanReach(s, f) || !alicornOk(f)) continue;
    const provoked = smartyProvokedBy(s, f);
    if (!provoked && !(f.gender === "male" && smartyInBadMood(s) && !smartyTolerates(s, f))) continue;
    const d = Math.hypot(s.x - f.x, s.y - f.y) - (provoked ? 1000 : 0); // provokers first
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  if (best && !smartyInBadMood(s) && best.health < SMARTY_SPARE_HEALTH) return null;
  return best;
}

// A good-mood bully: now and then, someone outside its circle to shove
function smartyBullyTarget(s) {
  const now = timePlayed;
  if (s.smartyNextBullyAt === undefined) s.smartyNextBullyAt = now + _smGap(SMARTY_BULLY_GAP);
  if (now < s.smartyNextBullyAt) return null;
  let best = null;
  let bestD = SMARTY_BULLY_RANGE;
  for (const f of fluffies) {
    if (!_smCanReach(s, f) || smartyTolerates(s, f) || f.tooYoungToWalk()) continue;
    if (f.health <= SMARTY_BULLY_FLOOR) continue;
    const d = Math.hypot(s.x - f.x, s.y - f.y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  // Nobody about: try again later
  if (!best) s.smartyNextBullyAt = now + _smGap(SMARTY_BULLY_GAP) / 2;
  return best;
}

function smartyDidBully(s) {
  s.smartyNextBullyAt = timePlayed + _smGap(SMARTY_BULLY_GAP);
}

// Enfies: not again for a while
function smartyReadyForEnfies(s) {
  return timePlayed >= (s.smartyNextEnfiesAt || 0);
}
function smartyDidEnfies(s) {
  s.smartyNextEnfiesAt = timePlayed + _smGap(SMARTY_ENFIES_GAP);
}
