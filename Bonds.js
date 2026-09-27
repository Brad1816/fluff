// ---------------------------------------------------------------------------
// Bonds and grudges between fluffies.
//
// Every fluffy keeps an opinion of every other fluffy it has dealt with:
//   f.opinions[otherId]   -1 (hates) .. 0 (neutral) .. +1 (adores)
//   f.opinionWhy[otherId] a short reason for strong feelings ("bit me")
// Both are saved with the fluffy.
//
// What changes opinions:
//   + spending calm time near each other, chatting, hugging, becoming
//     friends (and it grows into friendship by itself)
//   - being attacked, seeing someone hurt your friend/family, bullies
//   opinions slowly fade back toward neutral unless kept up.
//
// What opinions change:
//   - buddies (0.5+) seek each other out and hang around together, and
//     jump in to defend each other in fights (if brave enough)
//   - grudges (-0.3 and below) avoid each other, grumble, and dislike
//     makes friendship offers fail; a grumpy fluffy with a deep grudge may
//     start a scuffle
//   - "Buddies" and "Grudges" rows in the magnifying glass panel
//
// getLiking(a, b) = opinion + a bonus for family / friends / special
// friends. It's the one number to use when a fluffy "decides" how it feels
// about another, and it's what future herds can be built on.
// ---------------------------------------------------------------------------

const OPINION_BUDDY = 0.5;
const OPINION_DISLIKE = -0.3;
const OPINION_GRUDGE = -0.6;
const OPINION_FADE_PER_MIN = 0.01;
const BOND_NEAR = 130; // px: "spending time together"

const RELATIONSHIP_LIKING = {
  friend: 0.25,
  special_friend: 0.6,
  mother: 0.45,
  father: 0.35,
  baby: 0.45,
  child: 0.4,
  baby_child: 0.45,
  brother: 0.35,
  sister: 0.35,
  estranged_child: -0.2,
  rejected_baby: -0.2,
};

function ensureOpinions(f) {
  if (!f.opinions || typeof f.opinions !== "object") f.opinions = {};
  if (!f.opinionWhy || typeof f.opinionWhy !== "object") f.opinionWhy = {};
}

function getOpinion(a, b) {
  if (!a || !b) return 0;
  const id = typeof b === "object" ? b.id : b;
  return (a.opinions && a.opinions[id]) || 0;
}

// Opinion plus family/friend feelings, -1..1
function getLiking(a, b) {
  if (!a || !b) return 0;
  const rel = relationships[a.id] && relationships[a.id][b.id];
  let bonus = 0;
  if (rel) {
    const simple = typeof getSimpleRelationship === "function" ? getSimpleRelationship(rel) : rel;
    bonus = RELATIONSHIP_LIKING[rel] ?? RELATIONSHIP_LIKING[simple] ?? 0;
  }
  return clamp(getOpinion(a, b) + bonus, -1, 1);
}

function changeOpinion(a, b, amount, why = null) {
  if (!a || !b || a === b) return;
  ensureOpinions(a);
  const before = a.opinions[b.id] || 0;
  const after = clamp(before + amount, -1, 1);
  a.opinions[b.id] = after;
  if (why && Math.abs(after) >= 0.3) a.opinionWhy[b.id] = why;
  // Grown into friends by themselves
  if (before < OPINION_BUDDY && after >= OPINION_BUDDY) _maybeBecomeFriends(a, b);
}

function _maybeBecomeFriends(a, b) {
  if (!a.isAlive || !b.isAlive) return;
  const rels = relationships[a.id] || {};
  if (rels[b.id]) return; // already family / friends
  if (getOpinion(b, a) < 0.2) return; // it has to go both ways
  if (a.isSmarty() || b.isSmarty()) return;
  setRelationship(a.id, b.id, "friend");
  setRelationship(b.id, a.id, "friend");
  if (!a.tooYoungToSpeak() && a.happiness > WAN_DIE_THRESHOLD && a.scene === b.scene)
    a.speak(getDialogue(["BOND", "NEW_BUDDY"], a, b));
}

function _canNotice(f) {
  return f.isAlive && f.currentStateKey !== "SLEEPING" && (f.canSee() || f.canHear());
}

// ---- Events (hooked in from Horse.js / HorseActionHandler.js) ----

function onFluffiesChatted(a, b) {
  changeOpinion(a, b, 0.03);
  changeOpinion(b, a, 0.03);
}

function onFluffiesHugged(a, b) {
  changeOpinion(a, b, 0.08, "hugs");
  changeOpinion(b, a, 0.08, "hugs");
}

function onFriendshipMade(a, b) {
  changeOpinion(a, b, 0.2);
  changeOpinion(b, a, 0.2);
}

// Should `other` turn down a friendship offer from `from`?
function refusesFriendshipFrom(other, from) {
  return getLiking(other, from) < -0.1;
}

// performAttack (Horse.js): `attacker` hit `victim`
function noteFluffyAttack(attacker, victim, intent) {
  if (!attacker || !victim || attacker === victim) return;
  const hitBack = intent === "RETALIATION";
  changeOpinion(victim, attacker, hitBack ? -0.1 : -0.35, hitBack ? "hit back" : "attacked it");
  // The one that got hit back doesn't love the one who started it either
  if (hitBack) changeOpinion(attacker, victim, -0.15, "attacked it");

  for (const w of fluffies) {
    if (w === attacker || w === victim || w.scene !== victim.scene || !_canNotice(w)) continue;
    const liking = getLiking(w, victim);
    if (liking >= 0.3) {
      changeOpinion(w, attacker, -0.15, "hurt its buddy");
      // Jump in to help, if brave and close enough
      const brave = typeof traitValue === "function" ? traitValue(w, "bravery") : 0;
      const dist = Math.hypot(w.x - attacker.x, w.y - attacker.y);
      if (
        !hitBack &&
        liking >= OPINION_BUDDY &&
        brave >= 0 &&
        dist < 110 &&
        w.canFightBack() &&
        !w.tooYoungToWalk() &&
        attacker.isAlive &&
        Math.random() < 0.5
      ) {
        w.counterattack.fluffy = attacker;
        w.counterattack.timer = 0.4 + Math.random() * 0.4;
        if (!w.tooYoungToSpeak()) w.speak(getDialogue(["BOND", "DEFEND"], w, victim), true);
      }
    } else if (!hitBack) {
      changeOpinion(w, attacker, -0.04, "a bully");
    }
  }
}

// ---- Every simulation step (script.js); does its work once a second ----

let _bondTimer = 0;

function updateSocialBonds(dt) {
  _bondTimer -= dt;
  if (_bondTimer > 0) return;
  const step = 1.0 - _bondTimer; // seconds since last time
  _bondTimer = 1.0;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  const fade = (OPINION_FADE_PER_MIN / 60) * step;

  // Group by scene so we only compare fluffies that can meet
  const byScene = {};
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    ensureOpinions(f);
    (byScene[f.scene] = byScene[f.scene] || []).push(f);
  }

  for (const scene in byScene) {
    const list = byScene[scene];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > BOND_NEAR) continue;
        if (typeof canFluffiesReachEachOther === "function" && !canFluffiesReachEachOther(a, b)) continue;
        // Calm time together (sleeping side by side counts too)
        const calm = a.happiness > HAPPINESS_SAD_THRESHOLD && b.happiness > HAPPINESS_SAD_THRESHOLD;
        if (calm && !a.isScared && !b.isScared) {
          // Social fluffies bond faster, loners slower
          const sa = 1 + 0.5 * (typeof traitValue === "function" ? traitValue(a, "social") : 0);
          const sb = 1 + 0.5 * (typeof traitValue === "function" ? traitValue(b, "social") : 0);
          if (getLiking(a, b) > -0.1) changeOpinion(a, b, 0.0012 * step * sa);
          if (getLiking(b, a) > -0.1) changeOpinion(b, a, 0.0012 * step * sb);
        }
        _grudgeNear(a, b, now, step);
        _grudgeNear(b, a, now, step);
      }
    }
  }

  // Everything fades a little toward neutral
  for (const f of fluffies) {
    if (!f.opinions) continue;
    for (const id in f.opinions) {
      const v = f.opinions[id];
      const nv = v > 0 ? Math.max(0, v - fade) : Math.min(0, v + fade);
      if (nv === 0) {
        delete f.opinions[id];
        if (f.opinionWhy) delete f.opinionWhy[id];
      } else {
        f.opinions[id] = nv;
      }
    }
  }
}

// `a` is near `b`, whom it may hold a grudge against
function _grudgeNear(a, b, now, step) {
  const liking = getLiking(a, b);
  if (liking > OPINION_DISLIKE || !_canNotice(a)) return;
  // Being near someone you can't stand isn't nice
  if (a.happiness > HAPPINESS_MISERABLE_THRESHOLD) a.changeHappiness(-0.002 * step);
  if (!a._lastGrumble || now - a._lastGrumble > 25) {
    a._lastGrumble = now;
    if (!a.tooYoungToSpeak() && Math.random() < 0.5) a.speak(getDialogue(["BOND", "GRUMBLE"], a, b));
  }
  // A grumpy, brave fluffy with a deep grudge may start a scuffle
  const temper = typeof traitValue === "function" ? traitValue(a, "temper") : 0;
  const brave = typeof traitValue === "function" ? traitValue(a, "bravery") : 0;
  if (
    liking <= OPINION_GRUDGE &&
    temper > 0.1 &&
    brave >= 0 &&
    !b.tooYoungToWalk() &&
    a.attackCooldown <= 0 &&
    a.canFightBack() &&
    Math.hypot(a.x - b.x, a.y - b.y) < 90 &&
    Math.random() < 0.03 * step
  ) {
    a.performAttack(b, "GRUDGE");
  }
}

// ---- For the magnifying glass panel ----

function _fluffyName(id) {
  return (typeof fluffyNames !== "undefined" && fluffyNames[id]) || "Unnamed fluffy";
}

function _isAround(id) {
  return fluffies.some((f) => f.id == id && f.isAlive);
}

// "Pip, Daisy" (earned buddies, best first) or "None yet"
function describeBuddies(f, max = 3) {
  ensureOpinions(f);
  const list = Object.entries(f.opinions)
    .filter(([id, v]) => v >= OPINION_BUDDY && _isAround(id))
    .sort((x, y) => y[1] - x[1])
    .slice(0, max)
    .map(([id]) => _fluffyName(id));
  return list.length ? list.join(", ") : "None yet";
}

// "Rocky (attacked it)" or "None"
function describeGrudges(f, max = 2) {
  ensureOpinions(f);
  const list = Object.entries(f.opinions)
    .filter(([id, v]) => v <= OPINION_DISLIKE && _isAround(id))
    .sort((x, y) => x[1] - y[1])
    .slice(0, max)
    .map(([id]) => {
      const why = f.opinionWhy[id];
      return why ? `${_fluffyName(id)} (${why})` : _fluffyName(id);
    });
  return list.length ? list.join(", ") : "None";
}

// ---- Desires (added in the Horse constructor) ----

function _bondCandidates(horse, test) {
  return fluffies.filter(
    (f) =>
      f !== horse &&
      f.isAlive &&
      f.scene === horse.scene &&
      !f.isDragging &&
      test(f) &&
      (typeof canFluffiesReachEachOther !== "function" || canFluffiesReachEachOther(horse, f)),
  );
}

// Go and hang out with a buddy now and then
class SeekBuddyDesire extends Desire {
  constructor() {
    super("SeekBuddy");
    this.lastTime = gameTimeMs() - Math.random() * 20000;
    this.wait = 25000 + Math.random() * 20000;
  }
  evaluate(horse) {
    if (!horse.isAlive || horse.isDragging || horse.placedOn || horse.isScared || horse.isStacking) return 0;
    if (horse.sleepingOrTargetSet() || horse.tooYoungToWalk() || !horse.canSee()) return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD || horse.hunger < 0.35) return 0;
    if (gameTimeMs() - this.lastTime < this.wait) return 0;
    const buddies = _bondCandidates(horse, (f) => getLiking(horse, f) >= OPINION_BUDDY);
    if (!buddies.length) return 0;
    // Only if the closest buddy isn't already right here
    let best = null;
    let bestD = Infinity;
    for (const f of buddies) {
      const d = Math.hypot(f.x - horse.x, f.y - horse.y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    if (bestD < BOND_NEAR) return 0;
    this.target = best;
    return 46; // just above an idle wander
  }
  execute(horse) {
    this.lastTime = gameTimeMs();
    this.wait = 25000 + Math.random() * 20000;
    const b = this.target;
    if (!b || !b.isAlive) return false;
    const side = horse.x < b.x ? -1 : 1;
    horse.initBehavior("MOVING");
    horse.setTargetPosition(clamp(b.x + side * 60, 40, width - 40), b.y + (Math.random() - 0.5) * 30);
    return true;
  }
}

// Walk away from someone you hold a grudge against
class AvoidGrudgeDesire extends Desire {
  constructor() {
    super("AvoidGrudge");
    this.lastTime = -Infinity;
  }
  evaluate(horse) {
    if (!horse.isAlive || horse.isDragging || horse.placedOn || horse.isScared) return 0;
    if (horse.currentStateKey === "SLEEPING" || horse.tooYoungToWalk() || !horse.canSee()) return 0;
    if (!horse.avoidStateChangerActions()) return 0;
    if (gameTimeMs() - this.lastTime < 4000) return 0;
    // Grumpy fluffies stand their ground
    if (typeof traitValue === "function" && traitValue(horse, "temper") > 0.5) return 0;
    const near = _bondCandidates(
      horse,
      (f) => getLiking(horse, f) <= OPINION_DISLIKE && Math.hypot(f.x - horse.x, f.y - horse.y) < 110,
    );
    if (!near.length) return 0;
    this.target = near[0];
    return 50;
  }
  execute(horse) {
    this.lastTime = gameTimeMs();
    const t = this.target;
    if (!t) return false;
    const away = horse.positioning.getRunawayTarget(t.x, t.y);
    horse.initBehavior("MOVING");
    horse.setTargetPosition(away.x, away.y);
    return true;
  }
}
