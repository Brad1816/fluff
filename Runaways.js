// ---------------------------------------------------------------------------
// Beyond the house, part 2 (design doc Phase 5): runaways, released
// fluffies, and what the park's herds say about you.
//
// Runaways: once a game day, a grown fluffy of yours that's had enough may
// slip away to Fluffy Park (never from the room you're looking at, a cage,
// the shelter or a pen): a Rebel RUN_REBEL of the time, one that's
// frightened of you and miserable RUN_MISERABLE. You get a message and it
// goes in the morning report and its story.
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
const RUN_MISERABLE = 0.1;
const LORE_KIND = 0.15;
const LORE_HARM = 0.15;

function _raNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}
function _raDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : 1;
}
function _raName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
}

function isYourFormerPet(f) {
  return !!(f && f.formerPet && !f.adopted);
}

// Would it run away today?
function runAwayChance(f) {
  if (!f || !f.isAlive || !f.adopted || f.growth < 1 || f.tooYoungToWalk()) return 0;
  const title = typeof titleOf === "function" ? titleOf(f) : null;
  if (title === "Broken") return 0; // (it hasn't the will)
  if (title === "Rebel") return RUN_REBEL;
  if ((f.playerFear || 0) >= 0.6 && f.happiness < 0.3) return RUN_MISERABLE;
  return 0;
}

function _canSlipAway(f) {
  if (typeof currentScene !== "undefined" && f.scene === currentScene) return false;
  if (f.currentCage || f.placedOn || f.isDragging) return false;
  if (typeof getSceneConfig === "function" && !getSceneConfig(f.scene).insidePlayerQuarters) return false;
  return typeof PARK_SCENE !== "undefined";
}

function _goWild(f, how) {
  const name = (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || null;
  f.formerPet = { how, day: _raDay(), name };
  f.adopted = false;
  f.trickNow = null;
  f.sitWith = null;
  f.timeOut = null;
  f.claimedBed = null;
  f.chaseTarget = null;
}

function runAway(f) {
  const n = _raName(f);
  const at = typeof _parkEdgeSpot === "function" ? _parkEdgeSpot() : { x: 400, y: 600 };
  _goWild(f, "ran away");
  f.scene = PARK_SCENE;
  f.x = at.x;
  f.y = at.y;
  if (typeof f.initBehavior === "function") f.initBehavior("IDLE");
  const line = `${n} ran away from home. Maybe it went to the park.`;
  if (typeof addUIMessage === "function") addUIMessage(line);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `${n} ran away` });
  if (typeof noteWeekRanAway === "function") noteWeekRanAway(); // (WeekSummary.js)
  if (typeof recordStory === "function") recordStory("turning", f, { x: `${n} ran away from home.` });
  if (typeof noteWishEvent === "function") noteWishEvent(null, "left", { who: f, reason: "ran away" });
  return true;
}

// Right-click, in the park
function releaseActions(f) {
  if (!f || !f.isAlive || !f.adopted || typeof isCameraScene !== "function" || !isCameraScene(f.scene)) return [];
  return [{ key: "release", name: "Let it go", sub: "into the park", run: (x) => releaseFluffy(x) }];
}

function releaseFluffy(f) {
  if (!f || !f.adopted) return false;
  const n = _raName(f);
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
  const n = _raName(f);
  if (typeof recordStory === "function") recordStory("turning", f, { x: `${n} came home again.` });
  if (typeof addUIMessage === "function") addUIMessage(`${n} is home again.`);
  f.formerPet = null;
}

// ---- Seeing it again in the park ----
function _raMeet(f) {
  const fp = f.formerPet;
  const day = _raDay();
  if (fp.metDay === day) return false;
  fp.metDay = day;
  const ago = Math.max(0, day - fp.day);
  const n = fp.name || _raName(f);
  if (typeof addUIMessage === "function") addUIMessage(`You spot ${n} in the park - it ${fp.how === "let go" ? "was let go" : "ran away"} ${ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`}.`);
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
function updateRunaways(dt) {
  if (!runawaysTicker.step(dt) || typeof fluffies === "undefined") return;
  const day = _raDay();
  // Once a day: anyone had enough?
  if (_raDayChecked !== day) {
    const first = _raDayChecked === null;
    _raDayChecked = day;
    if (!first) {
      for (const f of fluffies.slice()) {
        const p = runAwayChance(f);
        if (p > 0 && _canSlipAway(f) && Math.random() < p) runAway(f);
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
