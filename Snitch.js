// ---------------------------------------------------------------------------
// Snitches and hidden foals (from the mill stories: nurse mares and studs
// paid in treats to tell on the others).
//
// SNITCH: right-click a grown fluffy of yours - "Make a snitch". Every game
// hour (SNITCH_EVERY) it tells you one thing it's seen in its room, for a
// treat (TRICK_TREAT_COST, Tricks.js):
//   - a mum hiding a foal (below) - which you then find
//   - a mum keeping milk from her foals (Favourites.js noteTurnedAway)
//   - a bully, or a fluffy that's been starting fights
//   - a bad smarty growing up
// Fluffies lie badly, so it's always true. But the others don't like a
// tattletale (SNITCH_DISLIKE from each who sees it tell; more from the one
// told on). Saved: f.snitch.
//
// HIDDEN FOALS: a mum of yours who expects a foal of hers to be taken -
// it's deformed, a runt, has a hereditary defect or a poopie coat, and she's
// seen a cull or a sale from a cage, or fears cages - may hide it
// (HIDE_CHANCE a game hour, while it's small) under a bed, in a box or in
// the litterbox. Hidden (f.hiddenBy, saved: mum's id; f.hideSpot: the
// object's id), it isn't drawn, can't be clicked and doesn't move; she
// slips over to feed it. It's found when you move what it's under (she
// blames you), when a snitch tells (she blames the snitch), when mum dies,
// or when it's big enough to walk (it comes out by itself).
// ---------------------------------------------------------------------------

const SNITCH_EVERY = 50; // game seconds (an hour)
const SNITCH_DISLIKE = -0.08;
const SNITCH_TOLD_ON = -0.3;
const HIDE_CHANCE = 0.25; // a game hour
const HIDE_UNTIL = 0.36; // growth: big enough to walk, it comes out
const snitchTicker = new Ticker(SNITCH_EVERY);
const hideTicker = new Ticker(SNITCH_EVERY);

function snitchActions(f) {
  if (!f || !f.isAlive || !f.adopted || f.growth < 1 || f.tooYoungToSpeak()) return [];
  return f.snitch
    ? [{ key: "snitch", name: "Stop snitching", sub: "no more tips", run: (x) => setSnitch(x, false) }]
    : [{ key: "snitch", name: "Make a snitch", sub: `tells on others for $${typeof TRICK_TREAT_COST === "number" ? TRICK_TREAT_COST : 2} treats`, run: (x) => setSnitch(x, true) }];
}

function setSnitch(f, on) {
  f.snitch = !!on;
  if (typeof addUIMessage === "function")
    addUIMessage(on ? `${fluffyDisplayName(f)} will tell you what goes on in its room, for a treat.` : `${fluffyDisplayName(f)} isn't a snitch any more.`);
  if (on && !f.tooYoungToSpeak()) f.speak(getDialogue(["SNITCH", "DEAL"], f), true);
}

// ---- Hidden foals ----

function isHiddenFoal(f) {
  return !!f && f.hiddenBy !== null && f.hiddenBy !== undefined;
}

function _hideSpotOf(f) {
  if (!isHiddenFoal(f) || typeof objects === "undefined") return null;
  return objects.find((o) => o.id === f.hideSpot) || null;
}

// Would she expect this foal to be taken from her?
function _atRisk(foal, mum) {
  const marked =
    (Array.isArray(foal.deformities) && foal.deformities.length > 0) ||
    !!foal.runt ||
    (typeof hasDefect === "function" && (hasDefect(foal, "dummy") || hasDefect(foal, "shaky"))) ||
    (typeof isPoopieCoated === "function" && isPoopieCoated(foal) && !isPoopieCoated(mum));
  if (!marked) return false;
  const knows = typeof knowsCage === "function" && (knowsCage(mum, "cull") || knowsCage(mum, "sell"));
  return knows;
}

function _hideSpots(scene) {
  if (typeof objects === "undefined") return [];
  return objects.filter((o) => o.scene === scene && !o.isDragging && !o.currentCage && ((typeof Bed !== "undefined" && o instanceof Bed) || (typeof Litterbox !== "undefined" && o instanceof Litterbox)));
}

function hideFoal(mum, foal, spot) {
  foal.hiddenBy = mum.id;
  foal.hideSpot = spot.id;
  foal.x = spot.x;
  foal.y = spot.y;
  if (foal._riding) foal._riding = null;
  if (!mum.tooYoungToSpeak() && mum.scene === currentScene && Math.random() < 0.5) mum.speak(getDialogue(["SNITCH", "HIDE"], mum, foal));
}

// Out it comes. how: "you" (you moved its hiding place), "snitch", "grown", "mum"
function revealFoal(foal, how, by = null) {
  if (!isHiddenFoal(foal)) return false;
  if (foal.jobHide && typeof extUnhide === "function") return extUnhide(foal); // (a pest job's hider)
  const mum = fluffyById(foal.hiddenBy);
  const spot = _hideSpotOf(foal);
  foal.hiddenBy = null;
  foal.hideSpot = null;
  if (spot) {
    foal.x = spot.x + 30;
    foal.y = (spot.y || foal.y) + 10;
  }
  const n = fluffyDisplayName(foal);
  if (how === "you" || how === "snitch") {
    if (typeof addUIMessage === "function") addUIMessage(`${n} was hidden ${spot && spot instanceof Bed ? (spot.type === "cardboard_box" ? "in a box" : "under a bed") : "in the litterbox"}${mum ? ` - ${fluffyDisplayName(mum)} hid it from you` : ""}.`);
    if (mum && mum.isAlive) {
      if (!mum.tooYoungToSpeak()) mum.speak(getDialogue(["SNITCH", "FOUND"], mum, foal), true);
      if (how === "you") {
        if (typeof changePlayerTrust === "function") changePlayerTrust(mum, -0.15);
        if (typeof changePlayerFear === "function") changePlayerFear(mum, 0.08);
      } else if (by && typeof changeOpinion === "function") changeOpinion(mum, by, -0.5, "told on my babbeh");
    }
  }
  return true;
}

function _updateHidden() {
  for (const f of fluffies) {
    if (!isHiddenFoal(f)) continue;
    if (f.jobHide) continue; // (hiding from you on a pest job: ExterminatorFerals.js)
    const mum = fluffyById(f.hiddenBy);
    const spot = _hideSpotOf(f);
    if (!f.isAlive) {
      revealFoal(f, "dead");
      continue;
    }
    if (!mum || !mum.isAlive) {
      revealFoal(f, "mum");
      continue;
    }
    if (!spot || spot.scene !== f.scene) {
      revealFoal(f, "you");
      continue;
    }
    if (spot.isDragging) {
      revealFoal(f, "you");
      continue;
    }
    if (f.growth >= HIDE_UNTIL) {
      revealFoal(f, "grown");
      continue;
    }
    // Stays put; mum slips over to feed it
    f.x = spot.x;
    f.y = spot.y;
    f.targetX = null;
    f.targetY = null;
    if (f.isMovingOrRunning()) f.initBehavior("IDLE");
    if (f.hunger < 0.6 && mum.scene === f.scene && mum.lactatingTimer > 0 && mum.milkCharges > 0 && !mum.isDragging && !mum.currentCage && mum.currentStateKey !== "SLEEPING") {
      if (Math.hypot(mum.x - spot.x, mum.y - spot.y) > 60) {
        if (!mum.isMovingOrRunning()) {
          mum.initBehavior("MOVING");
          mum.setTargetPosition(spot.x + 40, spot.y);
        }
      } else {
        mum.milkCharges--;
        f.hunger = 1;
      }
    }
  }
}

function _maybeHide() {
  for (const mum of fluffies) {
    if (!mum.isAlive || !mum.adopted || mum.gender !== "female" || mum.growth < 1 || typeof litterOf !== "function") continue;
    if (mum.currentCage || mum.isDragging || mum.currentStateKey === "SLEEPING") continue;
    for (const foal of litterOf(mum)) {
      if (isHiddenFoal(foal) || foal.scene !== mum.scene || foal.growth >= HIDE_UNTIL || foal.currentCage || foal.isDragging) continue;
      if (!_atRisk(foal, mum) || Math.random() >= HIDE_CHANCE) continue;
      const spots = _hideSpots(mum.scene);
      if (!spots.length) continue;
      spots.sort((a, b) => Math.hypot(a.x - foal.x, a.y - foal.y) - Math.hypot(b.x - foal.x, b.y - foal.y));
      hideFoal(mum, foal, spots[0]);
      break;
    }
  }
}

// ---- What the snitch tells ----

function _snitchFinding(s) {
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  const here = fluffies.filter((o) => o !== s && o.isAlive && o.scene === s.scene);
  const hidden = here.find((o) => isHiddenFoal(o));
  if (hidden) return { kind: "HIDDEN", who: fluffyById(hidden.hiddenBy) || hidden, foal: hidden };
  const hoarder = here.find((o) => o._hoardedAt !== undefined && now - o._hoardedAt >= 0 && now - o._hoardedAt < 3 * SNITCH_EVERY);
  if (hoarder) return { kind: "HOARDER", who: hoarder };
  const bully = here.find((o) => o._bullyAt !== undefined && now - o._bullyAt >= 0 && now - o._bullyAt < 3 * SNITCH_EVERY);
  if (bully) return { kind: "BULLY", who: bully };
  const fighter = here.find((o) => o._lastAttackAt !== undefined && now - o._lastAttackAt >= 0 && now - o._lastAttackAt < 2 * SNITCH_EVERY);
  if (fighter) return { kind: "FIGHTS", who: fighter };
  const smarty = here.find((o) => o.growth < 1 && typeof o.isSmarty === "function" && Array.isArray(o.personalities) && o.personalities.includes("smarty") && o.smartyKind !== "good");
  if (smarty) return { kind: "SMARTY", who: smarty };
  return null;
}

function snitchTells(s) {
  const find = _snitchFinding(s);
  if (!find) return null;
  const cost = typeof TRICK_TREAT_COST === "number" ? TRICK_TREAT_COST : 2;
  if (typeof money === "number") {
    if (money < cost) return null;
    money -= cost;
  }
  s.changeHappiness(0.02, "A treat for telling");
  const target = find.foal || find.who;
  s.speak(getDialogue(["SNITCH", find.kind], s, find.who), true);
  const n = fluffyDisplayName(s);
  const what = {
    HIDDEN: `${fluffyDisplayName(find.who)} is hiding a foal`,
    HOARDER: `${fluffyDisplayName(find.who)} keeps the milk from her foals`,
    BULLY: `${fluffyDisplayName(find.who)} picks on the others`,
    FIGHTS: `${fluffyDisplayName(find.who)} has been starting fights`,
    SMARTY: `${fluffyDisplayName(find.who)} is growing up a smarty`,
  }[find.kind];
  if (typeof addUIMessage === "function") addUIMessage(`${n} tells you (for a treat): ${what}.`);
  if (find.kind === "HIDDEN") revealFoal(find.foal, "snitch", s);
  // A tattletale
  for (const o of fluffies) {
    if (o === s || !o.isAlive || o.scene !== s.scene || o.currentStateKey === "SLEEPING" || !(o.canSee() || o.canHear())) continue;
    if (typeof changeOpinion === "function") changeOpinion(o, s, o === find.who ? SNITCH_TOLD_ON : SNITCH_DISLIKE, "a tattletale");
  }
  return find.kind;
}

function updateSnitches(dt) {
  if (typeof fluffies === "undefined") return;
  _updateHidden();
  if (hideTicker.step(dt)) _maybeHide();
  if (!snitchTicker.step(dt)) return;
  for (const s of fluffies) {
    if (!s.snitch || !s.isAlive || !s.adopted || s.currentStateKey === "SLEEPING" || s.tooYoungToSpeak()) continue;
    snitchTells(s);
  }
}
registerSystem("snitches", updateSnitches, 64);

// Magnifying glass
function describeSnitch(f) {
  return f && f.snitch ? ["A snitch: tells you what goes on, for treats", "ok"] : null;
}
