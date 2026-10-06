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
const GRUDGE_FIGHT_CHANCE = 0.01; // a second, while near someone it can't stand
const GRUDGE_FIGHT_REST = 4 * (typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50); // between scuffles with the same one

// Family is strong enough (0.45+) to count as a herd bond from day one
const RELATIONSHIP_LIKING = {
  friend: 0.25,
  special_friend: 0.6,
  mother: 0.5,
  father: 0.45,
  baby: 0.5,
  child: 0.5,
  baby_child: 0.5,
  brother: 0.45,
  sister: 0.45,
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
  // A stranger: no feelings either way (Acquaintance.js)
  if (typeof haveMet === "function" && !haveMet(a, b)) return 0;
  const rel = relationships[a.id] && relationships[a.id][b.id];
  let bonus = 0;
  if (rel) {
    const simple = typeof getSimpleRelationship === "function" ? getSimpleRelationship(rel) : rel;
    bonus = RELATIONSHIP_LIKING[rel] ?? RELATIONSHIP_LIKING[simple] ?? 0;
  }
  // Herd-mates like each other more, rival herds less (Herds.js)
  if (typeof herdLikingBonus === "function") bonus += herdLikingBonus(a, b);
  // Took each other in: a bond for life (Fostering.js)
  if (typeof fosterLikingBonus === "function") bonus += fosterLikingBonus(a, b);
  return clamp(getOpinion(a, b) + bonus, -1, 1);
}

function changeOpinion(a, b, amount, why = null) {
  if (!a || !b || a === b) return;
  if (typeof meet === "function") meet(a, b); // (it knows it now: Acquaintance.js)
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
  if (typeof onGossipChat === "function") onGossipChat(a, b); // what they've heard about you (Gossip.js)
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
  // Herds don't make friends with fluffies they're chasing off their land (Territory.js)
  if (typeof unwelcomeOnLand === "function" && (unwelcomeOnLand(from, other) || unwelcomeOnLand(other, from)))
    return true;
  // Nor with members of another herd
  if (typeof rivalHerds === "function" && rivalHerds(other, from)) return true;
  return getLiking(other, from) < -0.1;
}

// performAttack (Horse.js): `attacker` hit `victim`
function noteFluffyAttack(attacker, victim, intent) {
  if (!attacker || !victim || attacker === victim) return;
  if (typeof noteHerdFight === "function") noteHerdFight(attacker, victim); // herd feuds (HerdWars.js)
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
      // (a Guardian always has the nerve, and usually does, Titles.js)
      const guardian = typeof titleOf === "function" && titleOf(w) === "Guardian";
      if (
        !hitBack &&
        intent !== "BULLY" && // (a Smarty's shove isn't a fight worth jumping into)
        liking >= OPINION_BUDDY &&
        (brave >= 0 || guardian) &&
        dist < (guardian ? 160 : 110) &&
        w.canFightBack() &&
        !w.tooYoungToWalk() &&
        attacker.isAlive &&
        Math.random() < (guardian ? 0.9 : 0.5)
      ) {
        w.counterattack.fluffy = attacker;
        w.counterattack.timer = 0.4 + Math.random() * 0.4;
        if (typeof noteTitleDefend === "function") noteTitleDefend(w, victim);
        if (!w.tooYoungToSpeak()) w.speak(getDialogue(["BOND", "DEFEND"], w, victim), true);
      }
    } else if (!hitBack) {
      changeOpinion(w, attacker, -0.04, "a bully");
    }
  }
}

// ---- Every simulation step (script.js); does its work once a second ----

const bondsTicker = new Ticker(1.0);

function updateSocialBonds(dt) {
  const step = bondsTicker.step(dt); // seconds since last time, or 0 (Systems.js)
  if (!step) return;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  const fade = (OPINION_FADE_PER_MIN / 60) * step;

  for (const f of fluffies) if (f.isAlive) ensureOpinions(f);

  // Only pairs that are close together (SpatialGrid.js finds them quickly)
  rebuildFluffyGrid();
  forEachNearbyPair(BOND_NEAR, (a, b) => {
    if (typeof canFluffiesReachEachOther === "function" && !canFluffiesReachEachOther(a, b)) return;
    // Calm time together (sleeping side by side counts too)
    const calm = a.happiness > HAPPINESS_SAD_THRESHOLD && b.happiness > HAPPINESS_SAD_THRESHOLD;
    // Members of different herds don't warm to each other (Herds.js)
    const rivals = typeof rivalHerds === "function" && rivalHerds(a, b);
    if (calm && !rivals && !a.isScared && !b.isScared) {
      // Social fluffies bond faster, loners slower
      const sa = 1 + 0.5 * (typeof traitValue === "function" ? traitValue(a, "social") : 0);
      const sb = 1 + 0.5 * (typeof traitValue === "function" ? traitValue(b, "social") : 0);
      if (getLiking(a, b) > -0.1) changeOpinion(a, b, 0.0012 * step * sa);
      if (getLiking(b, a) > -0.1) changeOpinion(b, a, 0.0012 * step * sb);
    }
    _grudgeNear(a, b, now, step);
    _grudgeNear(b, a, now, step);
  });

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
  if (a.happiness > HAPPINESS_MISERABLE_THRESHOLD) a.changeHappiness(-0.002 * step, "A rival nearby");
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
    !(a._grudgeFightAt && now - (a._grudgeFightAt[b.id] ?? -1e9) < GRUDGE_FIGHT_REST) &&
    Math.random() < GRUDGE_FIGHT_CHANCE * step
  ) {
    // (one scuffle with the same one every few hours at most: in a single
    // room two that can't stand each other used to feud all day, every day)
    if (!a._grudgeFightAt || typeof a._grudgeFightAt !== "object") a._grudgeFightAt = {};
    a._grudgeFightAt[b.id] = now;
    a.performAttack(b, "GRUDGE");
  }
}

// ---- Sleeping together ----

// How much `horse` wants to go and sleep next to `sleeper`, as a distance
// (smaller = better), or null for "no thanks". Used by scoutForSleep
// (HorsePositioning.js), which used to pick the nearest sleeper anywhere -
// so in the park every herd ended up in one big pile.
//   - never someone it dislikes, or a member of another herd
//   - herd-mates and family/buddies count as much closer
//   - indoors, anyone else it doesn't mind; in the park, only a nearby
//     stranger when neither is in a herd
function sleepBuddyScore(horse, sleeper, dist) {
  const liking = getLiking(horse, sleeper);
  if (liking < 0) return null;
  const hh = typeof herdOf === "function" ? herdOf(horse) : null;
  const hs = typeof herdOf === "function" ? herdOf(sleeper) : null;
  if (hh && hs && hh !== hs) return null; // rival herds sleep apart
  if (hh && hh === hs) return dist - 600;
  if (liking >= 0.25) return dist - 400;
  // A stranger: indoors that's fine (as before). In the park only if it's
  // close by, and never a herd member's pile (or a herd member joining one)
  if (!(typeof isCameraScene === "function" && isCameraScene(horse.scene))) return dist;
  if (hh || hs) return null;
  return dist <= 250 ? dist : null;
}

// In the park, where should a tired fluffy go before lying down? Near its
// herd's leader if that's far, or away from a rival / someone it dislikes
// that's right next to it. null = here is fine. Gives up after a few moves.
function sleepSpotAwayFromRivals(horse, besidePile = false) {
  if (!(typeof isCameraScene === "function" && isCameraScene(horse.scene))) return null;
  if ((horse._sleepMoves || 0) >= 3) return null;
  let rival = null;
  let rd = 170;
  for (const f of fluffies) {
    if (f === horse || !f.isAlive || f.scene !== horse.scene) continue;
    const d = Math.hypot(f.x - horse.x, f.y - horse.y);
    if (d < rd && typeof keepsApart === "function" && keepsApart(horse, f)) {
      rd = d;
      rival = f;
    }
  }
  const h = typeof herdOf === "function" ? herdOf(horse) : null;
  const leader = h ? getHerdLeader(h) : null;
  let spot = null;
  if (
    !besidePile &&
    leader &&
    leader !== horse &&
    leader.scene === horse.scene &&
    Math.hypot(leader.x - horse.x, leader.y - horse.y) > 160
  ) {
    spot = { x: leader.x + (Math.random() - 0.5) * 90, y: leader.y + (Math.random() - 0.5) * 40 };
  } else if (rival) {
    spot = horse.positioning.getRunawayTarget(rival.x, rival.y);
  }
  if (spot) horse._sleepMoves = (horse._sleepMoves || 0) + 1;
  return spot;
}

// ---- For the magnifying glass panel ----

function _fluffyName(id) {
  if (typeof fluffyDisplayNameById === "function") return fluffyDisplayNameById(id); // Names.js
  return (typeof fluffyNames !== "undefined" && fluffyNames[id]) || "Fluffy";
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
  return fluffiesInScene(horse.scene).filter(
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
    // Not buddies who are now in a rival herd (Herds.js)
    const buddies = _bondCandidates(
      horse,
      (f) => getLiking(horse, f) >= OPINION_BUDDY && !(typeof keepsApart === "function" && keepsApart(horse, f)),
    );
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
    horse.setTargetPosition(clamp(b.x + side * 60, 40, sceneW(horse.scene) - 40), b.y + (Math.random() - 0.5) * 30);
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
      (f) => Math.hypot(f.x - horse.x, f.y - horse.y) < 110 && getLiking(horse, f) <= OPINION_DISLIKE, // (the cheap test first)
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

// Runs every simulation step (Systems.js)
registerSystem("bonds", updateSocialBonds, 20);
