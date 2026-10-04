// ---------------------------------------------------------------------------
// The herd on a pest job (Exterminator.js) and you (ExterminatorPlayer.js).
//
// ExtFeralDesire (a desire every fluffy has; only a job's ferals use it):
//   - you come close (EXT_SCARE): it runs, crying a warning ("Hoomin
//     munstah!") that sets the others in the room off too
//   - a foal, or a timid grown-up, near something to hide behind
//     (EXT_HIDE_NEAR) may dive behind it instead (f.jobHide, hidden: not
//     drawn, can't be grabbed). Standing there and pressing Grab (Search)
//     flushes out whatever's hiding (extFlushOut) - it bolts
//   - a mare stays near her foals; foals run to her
//   - held, or in a crate: it struggles and begs (no AI)
//   - once you're well away it calms down and goes back to grazing
//
// Fighting back (none of it can hurt you - it's all show):
//   - who fights: a brave or bad-tempered grown-up (_extFighter), a mare
//     who's just seen her foal taken or killed (f._extRage, EXT_RAGE_TIME),
//     and anyone a smarty has rallied (f._extRally, EXT_RALLY_TIME - a timid
//     one may still run)
//   - a smarty doesn't fight: it hangs back and orders the herd at you
//     ("Get dummeh hoomin!"), and runs if you come for it
//   - a fighter runs at you and kicks, stomps and bites at your boots
//     (EXT_HIT_EVERY; a gagged or muzzled one can't bite)
//   - now and then one clings to your leg instead (EXT_CLING_CHANCE, at most
//     EXT_CLING_MAX): you walk slower with each one (extClingSlow) until it
//     drops off (EXT_CLING_TIME) or you Grab it off
//   - glued down, held, crated or clinging: no desire runs
//
// Until it knows you're there a herd just lives its life - grazing, playing,
// mating, all of it. It notices you (f._extAware) when it sees you in the
// room (EXT_NOTICE; asleep, only close up), hears a warning, or sees one of
// its own caught; the ones near it catch on too. Aware, it's wary: no
// mating (any under way stops), courting, play, chatter, napping or
// begging (DESIRE_VETOES, EXT_WARY_SKIP); foals keep close to mum. It
// forgets once it's gone EXT_AWARE_TIME without seeing you.
// ---------------------------------------------------------------------------

const EXT_SCARE = 230;
const EXT_CALM = 420;
const EXT_HIDE_NEAR = 260;
const EXT_HIDE_CHANCE = 0.55; // a foal's; a timid grown-up's is a third of it
const EXT_NOTICE = 520;
const EXT_NOTICE_SPREAD = 320; // the ones near it catch on
const EXT_AWARE_TIME = 40;
const EXT_WARY_SKIP = new Set(["Mate", "Heat", "SeekSmartySpecialHuggies", "SeekSpecialFriend", "ProposeSpecialFriendship", "ProposeFriendship", "PlayWithBall", "PlayWithBlocks", "BabbleToFriends", "RandomBabble", "SeekPlayer", "Sleep", "RunToTV", "WatchTV"]);
const EXT_FIGHT_RANGE = 340; // fighters come for you from further than the rest run
const EXT_HIT_REACH = 52;
const EXT_HIT_EVERY = 1.6;
const EXT_CLING_CHANCE = 0.25;
const EXT_CLING_TIME = 8;
const EXT_CLING_MAX = 3;
const EXT_RAGE_TIME = 60;
const EXT_RALLY_TIME = 20;
const EXT_RALLY_EVERY = 15;

function _extIsFeral(f) {
  return !!(f && f.jobFeral != null && f.isAlive && isJobScene(f.scene));
}

function _extPlayerHere(f) {
  const p = typeof _extP === "function" ? _extP() : null;
  return p && p.scene === f.scene ? p : null;
}

function _extHideSpots(scene) {
  const room = jobRoomOf(scene);
  return room ? room.props : [];
}

function _extTimid(f) {
  return typeof traitValue === "function" ? traitValue(f, "bravery") < -0.2 : false;
}

function extHide(f, prop) {
  const room = jobRoomOf(f.scene);
  const idx = room ? room.props.indexOf(prop) : -1;
  if (idx < 0) return false;
  f.jobHide = { prop: idx };
  f.hiddenBy = -1; // (not drawn, can't be clicked: Snitch.js treats it as hidden)
  f.hideSpot = null;
  f.x = prop.x + (Math.random() - 0.5) * 30;
  f.y = prop.y - 4;
  f.targetX = null;
  f.targetY = null;
  if (typeof f.initBehavior === "function") f.initBehavior("IDLE");
  return true;
}

function extUnhide(f) {
  if (!f || !f.jobHide) return false;
  f.jobHide = null;
  f.hiddenBy = null;
  f.hideSpot = null;
  return true;
}

// Who's hiding where you're standing (the prop): its index, or null
function extHiddenNear(scene, x, y, reach) {
  const room = jobRoomOf(scene);
  if (!room) return null;
  for (let i = 0; i < room.props.length; i++) {
    const pr = room.props[i];
    if (Math.hypot(pr.x - x, pr.y - 20 - y) > reach + 40) continue;
    if (fluffies.some((f) => f.scene === scene && f.jobHide && f.jobHide.prop === i && f.isAlive)) return { prop: i };
  }
  return null;
}

// Search: out they come, running
function extFlushOut(spot) {
  const p = _extP();
  if (!p || !spot) return false;
  let n = 0;
  for (const f of fluffies) {
    if (f.scene !== p.scene || !f.jobHide || f.jobHide.prop !== spot.prop || !f.isAlive) continue;
    extUnhide(f);
    f._extHideAgainAt = timePlayed + 8; // (not straight back in)
    if (f.actionHandler) f.actionHandler.executeRunawayFear({ x: p.x, y: p.y }, ["EXTERMINATOR", "FOUND"]);
    n++;
  }
  if (n && typeof addUIMessage === "function") addUIMessage(n === 1 ? "Something bolts out from its hiding place!" : `${n} bolt out from their hiding place!`);
  return n > 0;
}

// Grabbed, crated or killed: the others see. A mum who sees her foal taken
// goes for you.
function onExtCaught(f, killed = false) {
  for (const o of fluffies) {
    if (o === f || !_extIsFeral(o) || o.scene !== f.scene || !o.canSee || !o.canSee()) continue;
    if (Math.hypot(o.x - f.x, o.y - f.y) > 500) continue;
    o._extAlarm = timePlayed;
    extNotice(o, false);
    if (f.motherId === o.id && o.growth >= 1) {
      o._extRage = timePlayed;
      if (!o.tooYoungToSpeak() && typeof getDialogue === "function") o.speak(getDialogue(["EXTERMINATOR", killed ? "RAGE" : "MUM_SEES"], o, f), true);
    }
  }
}

function _extRecent(at, span) {
  return typeof at === "number" && timePlayed >= at && timePlayed - at < span;
}

// Knows you're about
function extAware(f) {
  return !!f && _extRecent(f._extAware, EXT_AWARE_TIME);
}

// It's noticed you: whatever it was up to stops, and those near it catch on
function extNotice(f, spread = true) {
  if (!_extIsFeral(f)) return false;
  const fresh = !extAware(f);
  f._extAware = timePlayed;
  if (!fresh) return false;
  if (f.matingState && f.matingState.isMating && typeof f.interruptMating === "function") f.interruptMating();
  if (f.currentStateKey === "SLEEPING" && typeof f.initBehavior === "function") f.initBehavior("IDLE");
  if (spread)
    for (const o of fluffies) {
      if (o === f || !_extIsFeral(o) || o.scene !== f.scene || extAware(o)) continue;
      if (o.currentStateKey === "SLEEPING") continue;
      if (Math.hypot(o.x - f.x, o.y - f.y) < EXT_NOTICE_SPREAD) extNotice(o, false);
    }
  return true;
}

if (typeof DESIRE_VETOES !== "undefined") DESIRE_VETOES.push((h, name) => EXT_WARY_SKIP.has(name) && h.jobFeral != null && extAware(h) && isJobScene(h.scene));

// Has the fight in it (on its own, before any rallying)
function _extFighter(f) {
  if (!f || f.growth < 1 || (f.health ?? 100) < 40) return false;
  if (typeof f.isInLabor === "function" && f.isInLabor()) return false;
  if (_extRecent(f._extRage, EXT_RAGE_TIME)) return true;
  if (f.isSmarty && f.isSmarty()) return false;
  const tv = (k) => (typeof traitValue === "function" ? traitValue(f, k) : 0);
  if (tv("bravery") >= 0.4 || tv("temper") >= 0.4) return true;
  return _extRecent(f._extRally, EXT_RALLY_TIME) && !_extTimid(f);
}

// Where a fluffy's centre goes for its hooves to be on the ground at y
function _extFootY(f, y) {
  const off = typeof f.getBottomYStanding === "function" && f.layout ? f.getBottomYStanding() - f.y : 40 * (f.growth || 1);
  return y - (isFinite(off) ? off : 40);
}

function _extClingers(p = typeof _extP === "function" ? _extP() : null) {
  if (!p) return [];
  return fluffies.filter((f) => f.extCling && f.isAlive && f.scene === p.scene);
}

// Walking speed with fluffies hanging off your legs
function extClingSlow() {
  return Math.max(0.4, 1 - 0.2 * _extClingers().length);
}

function extUncling(f, knocked = false) {
  if (!f || !f.extCling) return false;
  f.extCling = false;
  f.extClingUntil = null;
  f._extHitAt = timePlayed + 2; // (a moment to get up)
  if (knocked && f.isAlive && typeof f.initBehavior === "function") f.initBehavior("FLUFFY_KNOCKED_DOWN");
  return true;
}

// The smarty orders the herd at you
function extRally(smarty) {
  if (_extRecent(smarty._extRallyAt, EXT_RALLY_EVERY)) return false;
  smarty._extRallyAt = timePlayed;
  let n = 0;
  for (const o of fluffies) {
    if (o === smarty || !_extIsFeral(o) || o.scene !== smarty.scene || o.growth < 1) continue;
    if (Math.hypot(o.x - smarty.x, o.y - smarty.y) > 600) continue;
    o._extRally = timePlayed;
    n++;
  }
  if (!smarty.tooYoungToSpeak() && typeof getDialogue === "function") smarty.speak(getDialogue(["EXTERMINATOR", "RALLY"], smarty), true);
  return n > 0;
}

// One blow at your boots (all show), or a grab at your leg
function extHitPlayer(f, p) {
  if (_extRecent(f._extHitAt, EXT_HIT_EVERY)) return false;
  f._extHitAt = timePlayed;
  f.facingRight = p.x > f.x;
  f.targetX = null;
  f.targetY = null;
  const gagged = f.accessories && f.accessories.mouth && (f.accessories.mouth.id === "mouthgag" || f.accessories.mouth.id === "muzzle");
  const r = Math.random();
  const move = !gagged && r < 0.3 ? "FLUFFY_BITE" : r < 0.65 ? "FLUFFY_JAB" : "FLUFFY_STOMPIE";
  f._biteNoBlood = true;
  f.initBehavior(move);
  f._biteNoBlood = false;
  f.expressionOverride = "ANGRY";
  f.expressionOverrideTimer = 1.5;
  p.bumped = 0.25;
  const talk = !f.tooYoungToSpeak() && typeof getDialogue === "function";
  if (_extClingers(p).length < EXT_CLING_MAX && Math.random() < EXT_CLING_CHANCE) {
    f.extCling = true;
    f.extClingUntil = timePlayed + EXT_CLING_TIME;
    f._extClingSide = f.x < p.x ? -1 : 1;
    if (talk) f.speak(getDialogue(["EXTERMINATOR", "CLING"], f), true);
    return true;
  }
  if (talk && Math.random() < 0.35) f.speak(getDialogue(["EXTERMINATOR", _extRecent(f._extRage, EXT_RAGE_TIME) ? "RAGE" : "FIGHT"], f), false);
  return true;
}

class ExtFeralDesire extends Desire {
  constructor() {
    super("ExtFeral");
  }
  evaluate(h) {
    this.mode = null;
    if (!_extIsFeral(h) || h.isDragging) return 0;
    if (typeof isGluedDown === "function" && isGluedDown(h)) return 0;
    // Held, crated, hanging off your leg or hiding: nothing else on its mind
    // (updateExtFerals keeps it where it is)
    if (h.extHeld || h.extCling || h.jobHide || (h.currentCage && h.currentCage.isTransportCrate)) {
      this.mode = "busy";
      return 99;
    }
    if (h.currentCage) return 0;
    if (h.currentStateKey === "SLEEPING") {
      const p = _extPlayerHere(h);
      if (!p || Math.hypot(p.x - h.x, p.y - h.y) > EXT_SCARE * 0.5) return 0;
    }
    const p = _extPlayerHere(h);
    if (!p) return 0;
    const d = Math.hypot(p.x - h.x, p.y - 30 - h.y);
    const alarmed = _extRecent(h._extAlarm, 6);
    // A smarty: shouts orders from a safe distance, runs if you come close
    if (h.growth >= 1 && h.isSmarty && h.isSmarty() && !_extRecent(h._extRage, EXT_RAGE_TIME) && d < EXT_FIGHT_RANGE * 1.3 && d > 150 && !_extRecent(h._extRallyAt, EXT_RALLY_EVERY)) {
      this.mode = "rally";
      return 96;
    }
    // A fighter: comes for you
    if (_extFighter(h) && d < EXT_FIGHT_RANGE * (alarmed ? 1.4 : 1)) {
      this.mode = "fight";
      this.from = p;
      return 97;
    }
    if (d > EXT_SCARE * (alarmed ? 1.6 : 1)) {
      // Wary: a foal keeps close to its mum
      if (extAware(h) && h.growth < 1 && h.motherId != null) {
        const mum = fluffyById(h.motherId);
        if (mum && mum.isAlive && mum.scene === h.scene && !mum.extHeld && !mum.currentCage && Math.hypot(mum.x - h.x, mum.y - h.y) > 110) {
          this.mode = "to_mum";
          this.mum = mum;
          return 70;
        }
      }
      return 0;
    }
    // Hide?
    const canHide = !(typeof h._extHideAgainAt === "number" && timePlayed < h._extHideAgainAt);
    if (canHide) {
      const chance = h.growth < 1 ? EXT_HIDE_CHANCE : _extTimid(h) ? EXT_HIDE_CHANCE / 3 : 0;
      const spot = _extHideSpots(h.scene)
        .filter((pr) => Math.hypot(pr.x - h.x, pr.y - h.y) < EXT_HIDE_NEAR && Math.hypot(pr.x - p.x, pr.y - p.y) > 120)
        .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      if (spot && (h._extHideRoll === undefined || timePlayed - h._extHideRoll > 4)) {
        h._extHideRoll = timePlayed;
        if (Math.random() < chance) {
          this.mode = "hide";
          this.spot = spot;
          return 95;
        }
      }
    }
    this.mode = "flee";
    this.from = p;
    return 90;
  }
  execute(h) {
    if (this.mode === "busy") return true;
    if (this.mode === "to_mum") {
      const m = this.mum;
      if (h.currentStateKey !== "RUNNING") h.initBehavior("RUNNING");
      h.setTargetPosition(m.x + (Math.random() - 0.5) * 50, m.y + 14);
      return true;
    }
    if (this.mode === "rally") {
      h.targetX = null;
      h.targetY = null;
      if (h.currentStateKey !== "IDLE") h.initBehavior("IDLE");
      const p = _extPlayerHere(h);
      if (p) h.facingRight = p.x > h.x;
      return extRally(h);
    }
    if (this.mode === "fight") {
      const p = _extPlayerHere(h);
      if (!p) return false;
      const side = h.x < p.x ? -1 : 1;
      const fx = p.x + side * 40;
      const fy = _extFootY(h, p.y + 4); // (just in front of your boots)
      if (Math.hypot(fx - h.x, fy - h.y) > EXT_HIT_REACH) {
        if (h.currentStateKey !== "RUNNING") h.initBehavior("RUNNING");
        h.setTargetPosition(fx, fy);
        return true;
      }
      return extHitPlayer(h, p) || true;
    }
    if (this.mode === "hide") {
      const s = this.spot;
      if (Math.hypot(s.x - h.x, s.y - h.y) < 40) return extHide(h, s);
      h.initBehavior("RUNNING");
      h.setTargetPosition(s.x, s.y);
      return true;
    }
    if (this.mode === "flee") {
      if (h.isMovingOrRunning() && h.scaredTimer > 0) return true;
      const p = this.from;
      // The first to see you warns the rest
      if (!(typeof h._extWarnedAt === "number" && timePlayed - h._extWarnedAt < 10 && timePlayed >= h._extWarnedAt)) {
        h._extWarnedAt = timePlayed;
        for (const o of fluffies)
          if (o !== h && _extIsFeral(o) && o.scene === h.scene) {
            o._extAlarm = timePlayed;
            extNotice(o, false);
          }
        return h.actionHandler.executeRunawayFear({ x: p.x, y: p.y - 30 }, ["EXTERMINATOR", "WARN"]);
      }
      return h.actionHandler.executeRunawayFear({ x: p.x, y: p.y - 30 }, ["EXTERMINATOR", "FLEE"]);
    }
    return false;
  }
}
if (typeof EXTRA_DESIRES !== "undefined") EXTRA_DESIRES.push(ExtFeralDesire);

// Held: it wriggles and begs now and then
const extFeralTicker = new Ticker(1);
function updateExtFerals(dt) {
  const step = extFeralTicker.step(dt);
  if (!step) return;
  const p = typeof _extP === "function" ? _extP() : null;
  for (const f of fluffies) {
    if (!f.isAlive || f.jobFeral == null || !isJobScene(f.scene)) continue;
    // Does it see you?
    if (p && p.scene === f.scene && !f.extHeld && !f.extCling && !f.jobHide) {
      const d = Math.hypot(p.x - f.x, p.y - 30 - f.y);
      const asleep = f.currentStateKey === "SLEEPING";
      if (d < (asleep ? EXT_SCARE * 0.5 : EXT_NOTICE) && (asleep || !f.canSee || f.canSee())) extNotice(f);
    }
    // (one that hadn't seen you can't carry on with one that has)
    if (f.matingState && f.matingState.isMating && extAware(f) && typeof f.interruptMating === "function") f.interruptMating();
    // Hiding: it keeps still - and creeps out once you've been gone a while
    if (f.jobHide) {
      const room = jobRoomOf(f.scene);
      const pr = room && room.props[f.jobHide.prop];
      if (!pr) {
        extUnhide(f);
        continue;
      }
      f.x = pr.x;
      f.y = pr.y - 4;
      f.targetX = null;
      f.targetY = null;
      const far = !p || p.scene !== f.scene || Math.hypot(p.x - pr.x, p.y - pr.y) > EXT_CALM;
      f.jobHide.calm = far ? (f.jobHide.calm || 0) + step : 0;
      if (f.jobHide.calm > 25) extUnhide(f);
      continue;
    }
    // Clinging to your leg: carried along until it lets go
    if (f.extCling) {
      if (!p || p.scene !== f.scene || f.currentCage || f.extHeld || (typeof f.extClingUntil === "number" && timePlayed >= f.extClingUntil)) {
        extUncling(f, !!p && p.scene === f.scene);
        continue;
      }
      if (Math.random() < 0.5 * step) {
        f._biteNoBlood = true;
        f.initBehavior(Math.random() < 0.5 ? "FLUFFY_JAB" : "FLUFFY_STOMPIE");
        f._biteNoBlood = false;
        p.bumped = 0.2;
      }
      f.expressionOverride = "ANGRY";
      f.expressionOverrideTimer = 1.2;
      continue;
    }
    if (f.extHeld || (f.currentCage && f.currentCage.isTransportCrate)) {
      f.expressionOverride = "CRYING_SHOCKED";
      f.expressionOverrideTimer = 1.2;
      if (f.scene === currentScene && Math.random() < 0.08 * step && !f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["EXTERMINATOR", "BEG"], f), false);
    }
  }
}
registerSystem("extFerals", updateExtFerals, 190);

// Every frame (after you move): clingers stay on your legs
function updateExtClingers() {
  const p = typeof _extP === "function" ? _extP() : null;
  if (!p) return;
  _extClingers(p).forEach((f, i) => {
    const side = f._extClingSide || (i % 2 ? 1 : -1);
    f.x = p.x + side * (44 + Math.floor(i / 2) * 18);
    f.y = _extFootY(f, p.y - 2); // (just behind your legs: you're drawn over it)
    f.facingRight = side < 0;
    f.targetX = null;
    f.targetY = null;
    if (f.isMovingOrRunning && f.isMovingOrRunning()) f.initBehavior("IDLE");
  });
}
registerSystem("extClingers", updateExtClingers, 191);
