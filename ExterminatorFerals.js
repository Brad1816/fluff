// ---------------------------------------------------------------------------
// The herd on a pest job (Exterminator.js) and you (ExterminatorPlayer.js).
// (After CuriousSimp's "Day Job" stories.)
//
// Before it knows you're there a herd just lives its life - grazing,
// playing, mating, all of it. You're noticed (f._extAware) when one sees
// you (EXT_NOTICE; asleep, only close up), hears a warning or sees one of
// its own caught; those near it catch on at once, and within EXT_WORD_TIME
// the whole herd knows, in every room (job.seenAt). Once you've shown
// yourself it doesn't forget: the herd stays wary for the rest of the job -
// no mating (any under way stops), courting, play, chatter, napping or
// begging for a home (DESIRE_VETOES, EXT_WARY_SKIP), foals keep to mum, and
// with you about the little ones and the timid lie low behind things. Out
// of your sight a while (EXT_CREEP_OUT) hiders creep back out - and the
// odd foal gives itself away ("Am spwowin' babbeh!") - but walk back in and
// they scream and scatter all over again.
//
// ExtFeralDesire (every fluffy has it; only a job's ferals use it):
//   - close (EXT_SCARE): it runs, crying a warning ("Hoomin munstah!"), or
//     a foal / timid grown-up dives behind something (f.jobHide: not drawn,
//     can't be grabbed; stand there and Search to flush it out)
//   - cornered (EXT_CORNER), some plead instead of running: beg, cover
//     their eyes ("No see fwuffy..."), dance for you, hug a friend and cry,
//     or - the dim ones - ask you to be their new daddy (_extPleadStyle)
//   - a clever, gentle mare may hold her foal out to you ("Pwease mistaw,
//     sabe babbeh!"); take it and she's grateful, not enraged (_extOffered)
//   - held, or in a crate: it struggles and begs (no AI)
//
// Fighting back (none of it can hurt you - it's all show):
//   - a bad smarty marches out in front with a speech and threats ("Dis
//     smawty wand! Go 'way!"), the herd cheering, and orders its toughies
//     at you (_extRally); it'll ram your shins itself if you come close
//   - fighters: brave or bad-tempered grown-ups (_extFighter), rallied
//     ones, and a mare who's seen her foal taken (_extRage, EXT_RAGE_TIME)
//     run at you and kick, stomp and bite your boots (EXT_HIT_EVERY; gagged
//     or muzzled can't bite); some cling to your leg (EXT_CLING_CHANCE, at
//     most EXT_CLING_MAX; extClingSlow) until it drops off or you Grab it off
//   - kill one in front of them and it stops being a game: the ones who saw
//     break and run (_extBroken, EXT_BREAK_TIME) - a raging mum excepted -
//     and the smarty hides for good ("Smawty h-hide!", _extPanic)
//   - lose the smarty and, a little later, a toughie declares himself the
//     new one (job.vacuumAt, EXT_VACUUM_TIME)
//   - hold one and Ask: it points to where the rest are (a loyal toughie may
//     lie; a smarty won't say)
// ---------------------------------------------------------------------------

const EXT_SCARE = 230;
const EXT_CALM = 420;
const EXT_HIDE_NEAR = 260;
const EXT_HIDE_CHANCE = 0.55; // a foal's; a timid grown-up's is a third of it
const EXT_NOTICE = 520;
const EXT_NOTICE_SPREAD = 320; // the ones near it catch on at once
const EXT_WORD_TIME = 12; // ...and the whole herd knows this soon after
const EXT_CREEP_OUT = 30; // hiders creep out once you've been away this long
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
const EXT_FRONT_DIST = 150; // where a smarty stands to make its speech
const EXT_BREAK_TIME = 60;
const EXT_VACUUM_TIME = 20;
const EXT_CORNER = 85;
const EXT_PLEAD_CHANCE = 0.4;
const EXT_LIE_CHANCE = 0.5; // a toughie's, asked where the others are
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
// goes for you (unless she held it out to you). A killing breaks the game:
// those who saw run, and a smarty who saw hides for good.
function onExtCaught(f, killed = false) {
  const talk = (o, key, t = null) => {
    if (!o.tooYoungToSpeak() && typeof getDialogue === "function") o.speak(getDialogue(["EXTERMINATOR", key], o, t), true);
  };
  for (const o of fluffies) {
    if (o === f || !_extIsFeral(o) || o.scene !== f.scene || !o.canSee || !o.canSee()) continue;
    if (Math.hypot(o.x - f.x, o.y - f.y) > 500) continue;
    o._extAlarm = timePlayed;
    extNotice(o, false);
    const mum = f.motherId === o.id && o.growth >= 1;
    if (mum && f._extOffered && !killed) {
      talk(o, "OFFER_THANKS", f);
      continue;
    }
    if (mum) {
      o._extRage = timePlayed;
      talk(o, killed ? "RAGE" : "MUM_SEES", f);
      continue;
    }
    if (!killed) continue;
    if (o.isSmarty && o.isSmarty()) {
      if (o._extPanic == null) talk(o, "SMARTY_HIDE");
      o._extPanic = timePlayed;
    } else if (!_extRecent(o._extBroken, EXT_BREAK_TIME)) {
      o._extBroken = timePlayed;
      o._extRally = undefined;
      if (Math.random() < 0.4) talk(o, "PANIC");
    }
  }
  // Their smarty's gone: someone will step up
  const job = typeof _extActive === "function" ? _extActive() : null;
  if (job && f.jobFeral === job.id && f.isSmarty && f.isSmarty() && (job.vacuums || 0) < 2) job.vacuumAt = timePlayed + EXT_VACUUM_TIME;
}

function _extRecent(at, span) {
  return typeof at === "number" && timePlayed >= at && timePlayed - at < span;
}

// Knows you're about (for the rest of the job, once it does)
function extAware(f) {
  return !!f && f.jobFeral != null && typeof f._extAware === "number";
}

// It's noticed you: whatever it was up to stops, and those near it catch on
// (the whole herd hears of it soon after: updateExtFerals)
function extNotice(f, spread = true) {
  if (!_extIsFeral(f) || extAware(f)) return false;
  f._extAware = timePlayed;
  const job = typeof _extActive === "function" ? _extActive() : null;
  if (job && f.jobFeral === job.id && job.seenAt == null) job.seenAt = timePlayed;
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
  if (_extRecent(f._extBroken, EXT_BREAK_TIME)) return false; // (seen one killed: it's not a game now)
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
  if (!smarty.tooYoungToSpeak() && typeof getDialogue === "function") smarty.speak(getDialogue(["EXTERMINATOR", Math.random() < 0.5 ? "THREAT" : "RALLY"], smarty), true);
  // The rest of the herd cheers it on
  const fans = fluffies.filter((o) => o !== smarty && _extIsFeral(o) && o.scene === smarty.scene && !o.tooYoungToSpeak() && !o.extHeld && !o.jobHide);
  const fan = fans[Math.floor(Math.random() * fans.length)];
  if (fan && typeof getDialogue === "function") fan.speak(getDialogue(["EXTERMINATOR", "CHEER"], fan, smarty), false);
  return n > 0;
}

// Cornered: how it pleads (decided once)
function _extPleadStyle(h) {
  if (h._extPleadStyle) return h._extPleadStyle;
  const tv = (k) => (typeof traitValue === "function" ? traitValue(h, k) : 0);
  const friend = fluffies.find((o) => o !== h && _extIsFeral(o) && o.scene === h.scene && !o.extHeld && !o.jobHide && Math.hypot(o.x - h.x, o.y - h.y) < 80);
  const r = Math.random();
  let style;
  if (tv("wits") < -0.2 && r < 0.6) style = "daddy";
  else if (friend && r < 0.35) style = "hug";
  else style = ["beg", "cover", "dance"][Math.floor(Math.random() * 3)];
  h._extPleadStyle = style;
  return style;
}

// A clever, gentle mare: she'd hand her foal to you to save it
function _extOffersFoal(h) {
  if (h.growth < 1 || h.gender !== "female" || _extRecent(h._extRage, EXT_RAGE_TIME)) return null;
  const tv = (k) => (typeof traitValue === "function" ? traitValue(h, k) : 0);
  if (tv("wits") < 0.3 || tv("temper") > 0) return null;
  return fluffies.find((o) => o.motherId === h.id && o.isAlive && o.growth < 1 && o.scene === h.scene && !o.extHeld && !o.currentCage && !o.jobHide && Math.hypot(o.x - h.x, o.y - h.y) < 140) || null;
}

// Hold one and ask: it points to where the rest are (or lies, or won't say)
function extCanAsk(f) {
  return !!(f && f.isAlive && f.jobFeral != null && !f._extAsked && !f.tooYoungToSpeak());
}
function extAsk(f) {
  if (!extCanAsk(f)) return null;
  f._extAsked = true;
  const site = typeof jobSite === "function" ? jobSite() : null;
  const say = (key) => {
    if (typeof getDialogue === "function") f.speak(getDialogue(["EXTERMINATOR", key], f), true);
  };
  if (f.isSmarty && f.isSmarty()) {
    say("REFUSE");
    if (typeof addUIMessage === "function") addUIMessage("It won't tell you anything.");
    return { refused: true };
  }
  const counts = new Map();
  for (const o of fluffies) {
    if (o === f || !_extIsFeral(o) || o.jobFeral !== f.jobFeral || o.extHeld || (o.currentCage && o.currentCage.isTransportCrate)) continue;
    counts.set(o.scene, (counts.get(o.scene) || 0) + 1);
  }
  const rooms = site ? site.rooms.map((r) => r.scene) : [...counts.keys()];
  let best = null;
  for (const sc of rooms) if (sc !== f.scene && (counts.get(sc) || 0) > 0 && (!best || counts.get(sc) > counts.get(best))) best = sc;
  if (!best) {
    const here = counts.get(f.scene) || 0;
    say(here ? "POINT_HERE" : "POINT_NONE");
    if (typeof addUIMessage === "function") addUIMessage(here ? "It won't look you in the eye: the rest are all in here somewhere." : "It says there's nobody left.");
    return { scene: here ? f.scene : null };
  }
  const tv = (k) => (typeof traitValue === "function" ? traitValue(f, k) : 0);
  const loyal = tv("bravery") >= 0.4 || tv("temper") >= 0.3;
  let scene = best;
  let lie = false;
  if (loyal && rooms.length > 2 && Math.random() < EXT_LIE_CHANCE) {
    const others = rooms.filter((r) => r !== best && r !== f.scene);
    scene = others[Math.floor(Math.random() * others.length)];
    lie = true;
  }
  say("POINT");
  const p = typeof _extP === "function" ? _extP() : null;
  if (p) p.tip = { scene, at: timePlayed };
  if (typeof addUIMessage === "function") addUIMessage(`It points the way: ${typeof jobRoomName === "function" ? jobRoomName(scene) : scene}.`);
  return { scene, lie };
}

// What you can hear from the rooms next door: [{ dir, name, kind }]
// ("babbling": a herd that doesn't know you're here; "crying": one that
// does, out in the open; one lying low makes no sound)
function extRoomSounds(scene) {
  const room = jobRoomOf(scene);
  if (!room) return [];
  const out = [];
  for (const [dir, to] of Object.entries(room.links)) {
    const here = fluffies.filter((f) => _extIsFeral(f) && f.scene === to && !f.jobHide && !f.extHeld);
    if (!here.length) continue;
    const kind = here.some((f) => !extAware(f) && f.currentStateKey !== "SLEEPING") ? "babbling" : here.some((f) => extAware(f) && f.growth < 1) ? "crying" : null;
    if (kind) out.push({ dir, name: jobRoomName(to), kind, scene: to });
  }
  return out;
}

// One blow at your boots (all show), or a grab at your leg
function extHitPlayer(f, p, canCling = true) {
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
  f.expressionOverride = "ANGRY_PUFFED";
  f.expressionOverrideTimer = 1.5;
  p.bumped = 0.25;
  const talk = !f.tooYoungToSpeak() && typeof getDialogue === "function";
  if (canCling && _extClingers(p).length < EXT_CLING_MAX && Math.random() < EXT_CLING_CHANCE) {
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
    const aware = extAware(h);
    // Its mum's holding it out to you: it stays with her
    if (h._extOffered && h.growth < 1) {
      const mum = fluffyById(h.motherId);
      if (mum && mum.isAlive && mum.scene === h.scene && !mum.extHeld) {
        this.mode = "offered";
        this.mum = mum;
        return 96;
      }
      h._extOffered = false;
    }
    const p = _extPlayerHere(h);
    if (!p) return aware ? this._wary(h, null) : 0;
    if (h.currentStateKey === "SLEEPING" && Math.hypot(p.x - h.x, p.y - h.y) > EXT_SCARE * 0.5) return 0;
    const d = Math.hypot(p.x - h.x, p.y - 30 - h.y);
    if (!aware) {
      if (d > EXT_SCARE) return 0;
      extNotice(h); // (right on top of it: it can't miss you)
    }
    const alarmed = _extRecent(h._extAlarm, 6);
    const raging = _extRecent(h._extRage, EXT_RAGE_TIME);
    // A bad smarty: out in front with its speech - until it's seen what you do
    if (h.growth >= 1 && h.isSmarty && h.isSmarty() && !raging && h._extPanic == null && d < EXT_FIGHT_RANGE * 1.3) {
      this.mode = "front";
      this.from = p;
      return 96;
    }
    // A fighter: comes for you
    if (_extFighter(h) && d < EXT_FIGHT_RANGE * (alarmed ? 1.4 : 1)) {
      this.mode = "fight";
      this.from = p;
      return 97;
    }
    // A mother who'd rather you saved her foal
    if (d < 230 && !(h.isSmarty && h.isSmarty())) {
      const foal = _extOffersFoal(h);
      if (foal) {
        this.mode = "offer";
        this.foal = foal;
        this.from = p;
        return 96;
      }
    }
    if (d > EXT_SCARE * (alarmed ? 1.6 : 1)) return this._wary(h, p);
    // Cornered: it pleads (some of them), until you back off
    if (d < (h._extPleading ? EXT_CORNER * 1.8 : EXT_CORNER) && h._extPanic == null) {
      if (!h._extPleading && !_extRecent(h._extPleadRoll, 8)) {
        h._extPleadRoll = timePlayed;
        if (Math.random() < EXT_PLEAD_CHANCE) h._extPleading = _extPleadStyle(h);
      }
      if (h._extPleading) {
        this.mode = "plead";
        this.from = p;
        return 94;
      }
    } else h._extPleading = null;
    // Hide?
    const canHide = !(typeof h._extHideAgainAt === "number" && timePlayed < h._extHideAgainAt);
    if (canHide) {
      const panicked = h._extPanic != null; // (a smarty that's seen a killing: hides)
      const chance = panicked ? 0.9 : h.growth < 1 ? EXT_HIDE_CHANCE : _extTimid(h) ? EXT_HIDE_CHANCE / 3 : 0;
      const spot = this._spot(h, p);
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
  _spot(h, p) {
    return _extHideSpots(h.scene)
      .filter((pr) => Math.hypot(pr.x - h.x, pr.y - h.y) < EXT_HIDE_NEAR && (!p || Math.hypot(pr.x - p.x, pr.y - p.y) > 120))
      .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
  }
  // Knows you're about, you're not on top of it: foals keep to mum; with
  // you in the room, the little and the timid lie low
  _wary(h, p) {
    if (h.growth < 1 && h.motherId != null) {
      const mum = fluffyById(h.motherId);
      if (mum && mum.isAlive && mum.scene === h.scene && !mum.extHeld && !mum.currentCage && !mum.jobHide && Math.hypot(mum.x - h.x, mum.y - h.y) > 110) {
        this.mode = "to_mum";
        this.mum = mum;
        return 70;
      }
    }
    if (p && (h.growth < 1 || _extTimid(h) || h._extPanic != null) && !(typeof h._extHideAgainAt === "number" && timePlayed < h._extHideAgainAt)) {
      if (h._extLowRoll === undefined || timePlayed - h._extLowRoll > 6) {
        h._extLowRoll = timePlayed;
        const spot = this._spot(h, p);
        if (spot && Math.random() < 0.4) {
          this.mode = "hide";
          this.spot = spot;
          return 72;
        }
      }
    }
    return 0;
  }
  _say(h, key, every = 5, target = null) {
    if (_extRecent(h._extSaidAt, every) || h.tooYoungToSpeak() || typeof getDialogue !== "function") return;
    h._extSaidAt = timePlayed;
    h.speak(getDialogue(["EXTERMINATOR", key], h, target), true);
  }
  _still(h, pose, face) {
    h.targetX = null;
    h.targetY = null;
    if (h.currentStateKey !== pose && !(pose === "IDLE" && h.currentStateKey && h.currentStateKey.startsWith("FLUFFY_"))) h.initBehavior(pose);
    if (face) h.facingRight = face.x > h.x;
  }
  execute(h) {
    const p = this.from || _extPlayerHere(h);
    if (this.mode === "busy") return true;
    if (this.mode === "to_mum") {
      const m = this.mum;
      if (h.currentStateKey !== "RUNNING") h.initBehavior("RUNNING");
      h.setTargetPosition(m.x + (Math.random() - 0.5) * 50, m.y + 14);
      return true;
    }
    if (this.mode === "offered") {
      const m = this.mum;
      if (Math.hypot(m.x - h.x, m.y + 14 - h.y) > 45) {
        if (h.currentStateKey !== "MOVING") h.initBehavior("MOVING");
        h.setTargetPosition(m.x + (m.facingRight ? 40 : -40), m.y + 14);
      } else this._still(h, "IDLE", null);
      return true;
    }
    if (this.mode === "offer") {
      this._still(h, "SITTING", p);
      this.foal._extOffered = true;
      h.expressionOverride = "MISERABLE";
      h.expressionOverrideTimer = 1.5;
      this._say(h, "OFFER", 7, this.foal);
      return true;
    }
    if (this.mode === "front") {
      // Out in front of you, a little way off: threats, stamping, orders
      const d = Math.hypot(p.x - h.x, p.y - 30 - h.y);
      if (d < 100) return extHitPlayer(h, p, false) || true; // (come close and it rams your shins)
      const side = h.x < p.x ? -1 : 1;
      const sx = p.x + side * EXT_FRONT_DIST;
      const sy = _extFootY(h, p.y + 6);
      if (Math.hypot(sx - h.x, sy - h.y) > 50 && d > EXT_FRONT_DIST + 20) {
        if (h.currentStateKey !== "MOVING") h.initBehavior("MOVING");
        h.setTargetPosition(sx, sy);
        return true;
      }
      this._still(h, "IDLE", p);
      h.expressionOverride = "ANGRY_PUFFED";
      h.expressionOverrideTimer = 1.5;
      if (Math.random() < 0.3) h.initBehavior("FLUFFY_STOMPIE");
      if (!_extRecent(h._extRallyAt, EXT_RALLY_EVERY)) extRally(h);
      return true;
    }
    if (this.mode === "plead") {
      const style = h._extPleading;
      if (style === "daddy") {
        // Hasn't understood at all: wants you for its new daddy
        const fx = p.x + (h.x < p.x ? -40 : 40);
        const fy = _extFootY(h, p.y + 4);
        if (Math.hypot(fx - h.x, fy - h.y) > 40) {
          if (h.currentStateKey !== "MOVING") h.initBehavior("MOVING");
          h.setTargetPosition(fx, fy);
        } else this._still(h, "SITTING", p);
        h.expressionOverride = "GOOD_UPSIES";
        h.expressionOverrideTimer = 1.5;
        this._say(h, "PLEAD_DADDY");
        return true;
      }
      if (style === "dance") {
        this._still(h, "IDLE", p);
        if (!h.currentStateKey.startsWith("FLUFFY_")) h.initBehavior("FLUFFY_STOMPIE");
        h.expressionOverride = "HAPPY";
        h.expressionOverrideTimer = 1;
        this._say(h, "PLEAD_DANCE");
        return true;
      }
      if (style === "hug") {
        const friend = fluffies.find((o) => o !== h && _extIsFeral(o) && o.scene === h.scene && !o.extHeld && !o.jobHide && Math.hypot(o.x - h.x, o.y - h.y) < 110);
        this._still(h, "SITTING", friend || p);
        h.expressionOverride = "CRYING_SHOCKED";
        h.expressionOverrideTimer = 1.5;
        this._say(h, "PLEAD_HUG", 5, friend);
        return true;
      }
      this._still(h, "SITTING", p);
      h.expressionOverride = style === "cover" ? "MISERABLE" : "CRYING_SHOCKED";
      h.expressionOverrideTimer = 1.5;
      if (style === "cover") h.facingRight = p.x < h.x; // (turned away, hooves over its eyes)
      this._say(h, style === "cover" ? "PLEAD_COVER" : "PLEAD_BEG");
      return true;
    }
    if (this.mode === "fight") {
      if (!p) return false;
      const side = h.x < p.x ? -1 : 1;
      const fx = p.x + side * 40;
      const fy = _extFootY(h, p.y + 4); // (just in front of your boots)
      if (Math.hypot(fx - h.x, fy - h.y) > EXT_HIT_REACH) {
        if (h.currentStateKey !== "RUNNING") h.initBehavior("RUNNING");
        h.setTargetPosition(fx, fy);
        h.expressionOverride = "ANGRY_PUFFED";
        h.expressionOverrideTimer = 1;
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
      return h.actionHandler.executeRunawayFear({ x: p.x, y: p.y - 30 }, ["EXTERMINATOR", _extRecent(h._extBroken, EXT_BREAK_TIME) ? "PANIC" : "FLEE"]);
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
  const job = typeof _extActive === "function" ? _extActive() : null;
  // Word gets round: the whole herd knows you're here
  if (job && job.seenAt != null && !job.wordOut && timePlayed - job.seenAt >= EXT_WORD_TIME) {
    job.wordOut = true;
    for (const f of fluffies) if (f.jobFeral === job.id) extNotice(f, false);
  }
  // A new smarty steps up
  if (job && job.vacuumAt != null && timePlayed >= job.vacuumAt) {
    job.vacuumAt = null;
    _extNewSmarty(job);
  }
  for (const f of fluffies) {
    if (!f.isAlive || f.jobFeral == null || !isJobScene(f.scene)) continue;
    if (job && job.wordOut && f.jobFeral === job.id && !extAware(f)) extNotice(f, false); // (loaded mid-job)
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
      if (f.jobHide.calm > EXT_CREEP_OUT) {
        extUnhide(f);
        f._extHideAgainAt = timePlayed + 10;
        // (a foal that's had enough of hiding gives itself away)
        if (f.growth < 1 && !f.tooYoungToSpeak() && Math.random() < 0.5 && typeof getDialogue === "function") f.speak(getDialogue(["EXTERMINATOR", "SLIP"], f), true);
      }
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

// The smarty's gone: the bravest stallion left declares himself the new one
function _extNewSmarty(job) {
  const herd = fluffies.filter((f) => _extIsFeral(f) && f.jobFeral === job.id && !f.extHeld && !(f.currentCage && f.currentCage.isTransportCrate));
  if (herd.some((f) => f.isSmarty && f.isSmarty())) return null;
  const tv = (f, k) => (typeof traitValue === "function" ? traitValue(f, k) : 0);
  const who = herd.filter((f) => f.growth >= 1 && f.gender === "male").sort((a, b) => tv(b, "bravery") + tv(b, "temper") - (tv(a, "bravery") + tv(a, "temper")))[0];
  if (!who) return null;
  who.personalities = [...(who.personalities || []).filter((x) => x !== "smarty"), "smarty"];
  who.smartyKind = "bad";
  who._extPanic = null;
  job.vacuums = (job.vacuums || 0) + 1;
  if (!who.tooYoungToSpeak() && typeof getDialogue === "function") who.speak(getDialogue(["EXTERMINATOR", "NEW_SMARTY"], who), true);
  return who;
}

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
