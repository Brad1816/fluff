// ---------------------------------------------------------------------------
// Beyond the house, part 2 (design doc Phase 5): runaways, released
// fluffies, and what the park's herds say about you.
//
// Runaways: once a game day, a grown fluffy of yours that's had enough may
// make for the front door (never from a cage, the shelter or a pen): a Rebel
// RUN_REBEL of the time, one that's frightened of you and miserable
// RUN_MISERABLE. You're told, and it's on Today; pick it up or comfort it and
// it stays, otherwise it's off to Fluffy Park (in the morning report and its
// story).
// Letting go: take one of yours to the park and right-click it: "Let it go".
// Either way it's wild now (f.formerPet: how, when, its old name), with
// everything it remembers about you. In the park it chats with the wild
// ones like any fluffy, so what it tells them spreads (Gossip.js): a fluffy
// that loved you makes the herds warm to you, one you hurt makes them wary.
// A Rebel is a natural leader (Herds.js leadership).
// Meeting again: the first time you see it in the park each day you're told
// ("You spot Rowan in the park - it ran away 3 days ago."); one that loved
// you comes running, one that feared you bolts. Bring it home through the
// adoption room and it's yours again ("came home").
//
// Herd lore: each herd's view of you is what its members have seen and
// heard (herdLore: their trust and fear of you, and the tales they carry),
// shown with the herd in the magnifying glass and on the park map
// ("Sunny Meadow herd: they've heard you're kind").
// ---------------------------------------------------------------------------

const RUN_REBEL = 0.25;
const RUN_MISERABLE = 0.06;
// "Miserable": it fears you (RUN_FEAR) and either doesn't trust you at all
// (RUN_TRUST) or is unhappy (RUN_UNHAPPY). Happiness alone is a poor guide:
// meals and a bed lift it every day, however it's treated.
const RUN_FEAR = 0.5;
const RUN_TRUST = 0.2;
const RUN_UNHAPPY = 0.3;
const LORE_KIND = 0.15;
const LORE_HARM = 0.15;


function isYourFormerPet(f) {
  return !!(f && f.formerPet && !f.adopted);
}

// Would it run away today?
function runAwayChance(f) {
  if (!f || !f.isAlive || !f.adopted || f.growth < 1 || f.tooYoungToWalk()) return 0;
  const title = typeof titleOf === "function" ? titleOf(f) : null;
  if (title === "Broken") return 0; // (it hasn't the will)
  if (title === "Rebel") return RUN_REBEL;
  if ((f.playerFear || 0) >= RUN_FEAR && ((f.playerTrust || 0) < RUN_TRUST || f.happiness < RUN_UNHAPPY)) return RUN_MISERABLE;
  return 0;
}

function _canSlipAway(f) {
  if (f._bolt) return false;
  if (f.currentCage || f.placedOn || f.isDragging) return false;
  if (typeof getSceneConfig === "function" && !getSceneConfig(f.scene).insidePlayerQuarters) return false;
  return typeof PARK_SCENE !== "undefined";
}

function _goWild(f, how) {
  const name = (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || null;
  f.formerPet = { how, day: getDayNumber(), name };
  f.adopted = false;
  f.trickNow = null;
  f.sitWith = null;
  f.timeOut = null;
  f.claimedBed = null;
  f.chaseTarget = null;
}

function runAway(f, how = null) {
  const n = fluffyDisplayName(f);
  f._bolt = null;
  const at = typeof _parkEdgeSpot === "function" ? _parkEdgeSpot() : { x: 400, y: 600 };
  _goWild(f, "ran away");
  f.scene = PARK_SCENE;
  f.x = at.x;
  f.y = at.y;
  if (typeof f.initBehavior === "function") f.initBehavior("IDLE");
  const line = how ? `${n} ${how}. Maybe it went to the park.` : `${n} ran away from home. Maybe it went to the park.`;
  if (typeof addUIMessage === "function") addUIMessage(line);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `${n} ran away` });
  if (typeof noteWeekRanAway === "function") noteWeekRanAway(); // (WeekSummary.js)
  if (typeof recordStory === "function") recordStory("turning", f, { x: `${n} ran away from home.` });
  if (typeof noteWishEvent === "function") noteWishEvent(null, "left", { who: f, reason: "ran away" });
  return true;
}

// ---- Making for the door ----
// The day's roll doesn't just spirit it away: it heads for the front door
// (from a side room, through the house) and waits there for its chance.
// Pick it up, sit with it or be kind to it within BOLT_HOURS and it stays;
// otherwise it's gone (watching or not). Shown on Today.
const BOLT_HOURS = 2;
const BOLT_REACH = 45;

function isBolting(f) {
  return !!(f && f._bolt && f.adopted && f.isAlive);
}

function _boltDoorSpot() {
  const top = typeof sceneTop === "function" ? sceneTop("INDOORS") : height * 0.15;
  return { x: width / 2, y: top + 55 };
}

// Where it heads in the room it's in: the front door, or the side of a side room nearest home
function _boltTarget(f) {
  if (f.scene === "INDOORS") return _boltDoorSpot();
  const left = String(f.scene).startsWith("INDOORSL") ? false : String(f.scene).startsWith("INDOORSR") ? true : f.x < width / 2;
  return { x: left ? 30 : width - 30, y: Math.max(f.y, (typeof sceneTop === "function" ? sceneTop(f.scene) : height * 0.15) + 60) };
}

function startBolt(f) {
  const hour = typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50;
  if (typeof f.lastKindnessAt !== "number") f.lastKindnessAt = timePlayed; // (as Affection.js would)
  f._bolt = { since: timePlayed, until: timePlayed + BOLT_HOURS * hour, kind0: f.lastKindnessAt };
  const n = fluffyDisplayName(f);
  if (typeof addUIMessage === "function") addUIMessage(`${n} is making for the door! Pick it up or comfort it to stop it.`);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `${n} tried to run away` });
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function" && typeof currentScene !== "undefined" && f.scene === currentScene) f.speak(getDialogue(["RUNAWAY", "BOLT"], f), true);
  _boltHead(f);
}

function _boltHead(f) {
  if (typeof currentScene === "undefined" || f.scene !== currentScene) return; // (unseen: it just goes when time's up)
  if (f.currentStateKey === "SLEEPING" || f.isDragging) return;
  const t = _boltTarget(f);
  if (typeof f.initBehavior === "function" && !(f.isMovingOrRunning && f.isMovingOrRunning())) f.initBehavior("MOVING");
  if (typeof f.setTargetPosition === "function") f.setTargetPosition(t.x, t.y);
}

// Stopped: picked up, comforted, sat with, or it can't get out
function _boltStopped(f) {
  const b = f._bolt;
  if (f.isDragging || f.sitWith) return "held";
  if (typeof f.lastKindnessAt === "number" && f.lastKindnessAt !== b.kind0) return "held";
  if (f.currentCage || f.placedOn || f.timeOut) return "stuck";
  if (typeof getSceneConfig === "function" && !getSceneConfig(f.scene).insidePlayerQuarters) return "stuck";
  return null;
}

function _updateBolt(f) {
  const b = f._bolt;
  const why = _boltStopped(f);
  if (why) {
    f._bolt = null;
    if (why === "held") {
      if (typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(f)} stays - for now.`);
      if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["RUNAWAY", "STAYED"], f), true);
    }
    return;
  }
  const seen = typeof currentScene !== "undefined" && f.scene === currentScene;
  if (seen) {
    const t = _boltTarget(f);
    const dist = Math.hypot(f.x - t.x, f.y - t.y);
    if (b.atDoor && dist > 2 * BOLT_REACH) b.atDoor = false; // (wandered off: back it goes)
    if (dist <= BOLT_REACH) {
      if (f.scene === "INDOORS") {
        // At the door: it waits for its chance (time's up)
        if (!b.atDoor) {
          b.atDoor = true;
          if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["RUNAWAY", "BOLT"], f), true);
        }
      } else {
        // Through to the main room, coming in from that side
        f.scene = "INDOORS";
        f.x = t.x < width / 2 ? width - 40 : 40;
      }
    }
    if (!b.atDoor) _boltHead(f);
  }
  if (timePlayed >= b.until) {
    f._bolt = null;
    runAway(f, seen && f.scene === "INDOORS" ? "slipped out of the front door" : null);
  }
}

// Right-click, in the park
function releaseActions(f) {
  if (!f || !f.isAlive || !f.adopted || typeof isCameraScene !== "function" || !isCameraScene(f.scene)) return [];
  return [{ key: "release", name: "Let it go", sub: "into the park", run: (x) => releaseFluffy(x) }];
}

function releaseFluffy(f) {
  if (!f || !f.adopted) return false;
  const n = fluffyDisplayName(f);
  _goWild(f, "let go");
  if (typeof addUIMessage === "function") addUIMessage(`You let ${n} go. It's wild now.`);
  if (typeof recordStory === "function") recordStory("turning", f, { x: `You let ${n} go in the park.` });
  if (typeof noteWishEvent === "function") noteWishEvent(null, "left", { who: f, reason: "let go" });
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["RUNAWAY", (f.playerTrust || 0) >= 0.6 ? "LET_GO_SAD" : "LET_GO_FREE"], f), true);
  return true;
}

// HorseUpdate._updateAdoptionRoom: it came back
function onFormerPetHome(f) {
  if (!f || !f.formerPet) return;
  const n = fluffyDisplayName(f);
  if (typeof recordStory === "function") recordStory("turning", f, { x: `${n} came home again.` });
  if (typeof addUIMessage === "function") addUIMessage(`${n} is home again.`);
  f.formerPet = null;
}

// ---- Seeing it again in the park ----
function _raMeet(f) {
  const fp = f.formerPet;
  const day = getDayNumber();
  if (fp.metDay === day) return false;
  fp.metDay = day;
  const ago = Math.max(0, day - fp.day);
  const n = fp.name || fluffyDisplayName(f);
  if (typeof addUIMessage === "function") addUIMessage(`You spot ${n} in the park - it ${{ "let go": "was let go", "put out": "was put out", dumped: "was dumped here" }[fp.how] || "ran away"} ${ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`}.`);
  const trust = f.playerTrust || 0;
  const fear = f.playerFear || 0;
  if (trust >= 0.6 && fear < 0.3 && typeof f.setTargetPosition === "function" && typeof mouse !== "undefined") {
    f.initBehavior("RUNNING");
    f.setTargetPosition(mouse.x, mouse.y + 60); // (world position while in the park)
    if (!f.tooYoungToSpeak()) f.speak(getDialogue(["RUNAWAY", "MEET_HAPPY"], f), true);
  } else if (fear >= 0.4) {
    f.expressionOverride = "CRYING_SHOCKED";
    f.expressionOverrideTimer = 2;
    if (!f.tooYoungToSpeak()) f.speak(getDialogue(["RUNAWAY", "MEET_SCARED"], f), true);
  }
  return true;
}

// ---- Herd lore ----

// What a herd thinks of you: { kind, harm, n }
function herdLore(h) {
  if (!h || typeof getHerdMembers !== "function") return null;
  const members = getHerdMembers(h).filter((f) => f && f.isAlive);
  if (!members.length) return null;
  let kind = 0;
  let harm = 0;
  for (const f of members) {
    const tales = typeof gossipTales === "function" ? gossipTales(f) : { harm: 0, kind: 0 };
    kind += Math.max(tales.kind, Math.max(0, (f.playerTrust || 0) - 0.4));
    harm += Math.max(tales.harm, Math.max(0, (f.playerFear || 0) - 0.2));
  }
  return { kind: kind / members.length, harm: harm / members.length, n: members.length };
}

function describeHerdLore(h) {
  const l = herdLore(h);
  if (!l) return null;
  if (l.harm >= LORE_HARM && l.harm >= l.kind) return "they've heard you hurt fluffies";
  if (l.kind >= LORE_KIND) return "they've heard you're kind";
  return null;
}

// Herds.herdLeadershipScore: a Rebel leads
function runawayLeaderBonus(f) {
  return typeof titleOf === "function" && titleOf(f) === "Rebel" ? 0.6 : 0;
}

const runawaysTicker = new Ticker(2);
let _raDayChecked = null;
// The day's roll waits for the daytime, so it's awake and you might see it go
const RUN_FROM_HOUR = 9;
const RUN_TO_HOUR = 19;
function updateRunaways(dt) {
  if (typeof fluffies === "undefined") return;
  // Making for the door: every frame (a quick grab counts)
  for (const f of fluffies.slice()) {
    if (!f._bolt) continue;
    if (!isBolting(f)) f._bolt = null;
    else {
      if (f.currentStateKey === "SLEEPING") f._bolt.until += dt; // (it waits till it wakes)
      _updateBolt(f);
    }
  }
  if (!runawaysTicker.step(dt)) return;
  const day = getDayNumber();
  const hour = typeof gameHour === "function" ? gameHour() : 12;
  // Once a day: anyone had enough?
  if (_raDayChecked !== day && hour >= RUN_FROM_HOUR && hour < RUN_TO_HOUR) {
    const first = _raDayChecked === null;
    _raDayChecked = day;
    if (!first) {
      for (const f of fluffies.slice()) {
        const p = runAwayChance(f);
        if (p > 0 && _canSlipAway(f) && Math.random() < p) startBolt(f);
      }
    }
  }
  // In the park: old friends
  if (typeof currentScene !== "undefined" && typeof isCameraScene === "function" && isCameraScene(currentScene)) {
    for (const f of fluffies) {
      if (!isYourFormerPet(f) || !f.isAlive || f.scene !== currentScene) continue;
      if (typeof isOnParkScreen === "function" && !isOnParkScreen(f.x, f.y, 0)) continue;
      _raMeet(f);
    }
  }
}

registerSystem("runaways", updateRunaways, 141);
