// ---------------------------------------------------------------------------
// Memory and trust: how each fluffy feels about YOU (the hand/cursor).
//
// Every fluffy has (saved with it):
//   playerTrust     0..1  goes up when you brush it, feed it, spend time
//                         with it while it's happy; down when you hurt it
//   playerFear      0..1  goes up when you hurt it (or it sees you hurt a
//                         friend or family), fades slowly over time
//   playerMemories  the last few things you did to it, newest first:
//                   [{ type, text, t }]  (t = game seconds)
//
// What it changes:
//   - scared fluffies back away from your hand (FleePlayerDesire) and
//     panic when picked up; trusting ones come up to your hand
//     (SeekPlayerDesire) and like being held (onFluffyPickedUp)
//   - shown in the magnifying glass panel; customers can ask for fluffies
//     that are "friendly with people" (Orders.js)
// Personality traits (Traits.js) change how fast: brave fluffies scare
// less easily, gentle ones forgive faster, social ones warm up quicker.
// ---------------------------------------------------------------------------

const TRUST_START = 0.5; // a fluffy that grew up with you
const TRUST_START_FERAL = 0.35; // one from outside
const PASSIVE_TRUST = 0.6; // as far as meals from you and your company go (the rest takes care)
const FEAR_FADE_PER_MIN = 0.0125; // how fast fear fades (per 60 game seconds: about a quarter a game day)
const FEAR_FADE_DELAY = 100; // no fading for this long after being hurt (two game hours)
const FEAR_MOOD = 0.15; // a fluffy that fears you is never quite content at home (Horse.update)
const MEMORY_KEEP = 5;

// How scary each way of being hurt is (victim's fear goes up by this)
const FEAR_FROM_WEAPON = {
  stick: 0.12, // sorry stick
  spray: 0.04, // a squirt from the spray bottle: startling, not painful
  thumbtack: 0.2, // thumbtack and syringe
  cattle_prod: 0.25,
  knife: 0.3,
  scalpel: 0.3,
  grinder: 0.5,
  throw: 0.2, // thrown and landing hard (ThrowTool.js)
  cull: 0.5, // a culling cage (Cage.js): only ever seen, never survived
  cautery: 0.3, // a wound burnt shut with the hot iron (CauteryIron.js)
};

const MEMORY_TEXT = {
  sprayed_lots: "Sprayed again and again",
  forced_fear: "Forced to face what it fears", // (FearExposure.js)
  stick: "Hit with the stick",
  spray: "Squirted with the spray bottle",
  thumbtack: "Poked with a tack",
  cattle_prod: "Shocked with the prod",
  knife: "Cut with a knife",
  scalpel: "Cut with a scalpel",
  grinder: "Saw the grinder",
  throw: "Thrown by you",
  cautery: "Burnt with the hot iron",
  witness: "Saw you hurt a fluffy",
  witness_family: "Saw you hurt its family",
  training: "Stick potty training",
  brushed: "Brushed by you",
  held_happy: "Cuddled by you",
  took_family: "Saw you take its family away",
  taken_away: "Taken from its herd and family",
  taken_from_mum: "Taken from its mum",
  wish_denied: "Had its wish taken away", // Wishes.js
  broken_promise: "A promise you broke",
};

// Memories of harm from you (for the story book, StoryBook.js)
const MEMORY_HARM_TYPES = new Set(["stick", "thumbtack", "cattle_prod", "knife", "scalpel", "grinder", "witness", "witness_family", "training", "sprayed_lots", "took_family", "taken_away", "taken_from_mum", "forced_fear"]);

function ensurePlayerMemory(f) {
  if (typeof f.playerTrust !== "number") f.playerTrust = f.adopted ? TRUST_START : TRUST_START_FERAL;
  if (typeof f.playerFear !== "number") f.playerFear = 0;
  if (!Array.isArray(f.playerMemories)) f.playerMemories = [];
}

function rememberPlayerEvent(f, type) {
  ensurePlayerMemory(f);
  // Harm goes in the story book (the kind things are tallied by Affection.js);
  // a squirt of water is only a telling-off
  if (MEMORY_HARM_TYPES.has(type) && typeof recordStory === "function") recordStory("harmed", f, { x: MEMORY_TEXT[type] || type });
  else if (type === "spray" && typeof recordStory === "function") recordStory("scolded", f);
  const now = timePlayed;
  // The same thing again within a minute just refreshes the time
  const last = f.playerMemories[0];
  if (last && last.type === type && now - last.t < 60) {
    last.t = now;
    last.count = (last.count || 1) + 1;
    return;
  }
  f.playerMemories.unshift({ type, text: MEMORY_TEXT[type] || type, t: now });
  if (f.playerMemories.length > MEMORY_KEEP) f.playerMemories.length = MEMORY_KEEP;
}

function changePlayerTrust(f, amount) {
  ensurePlayerMemory(f);
  // Social fluffies warm up to you faster
  if (amount > 0) amount *= 1 + 0.3 * traitValue(f, "social");
  // A Survivor is loyal, a Wary one slow to believe (Titles.js)
  if (amount > 0 && typeof titleTrustMultiplier === "function") amount *= titleTrustMultiplier(f);
  const before = f.playerTrust;
  f.playerTrust = clamp(f.playerTrust + amount, 0, 1);
  if (typeof onAffectionChanged === "function") onAffectionChanged(f, before);
}

function changePlayerFear(f, amount) {
  ensurePlayerMemory(f);
  if (amount > 0) {
    // Brave fluffies scare less easily, timid ones more
    amount *= 1 - 0.4 * traitValue(f, "bravery");
    f.lastHurtByPlayerAt = timePlayed;
    // Being hurt also costs trust (affection, Affection.js)
    const before = f.playerTrust;
    f.playerTrust = clamp(f.playerTrust - amount * 0.6, 0, 1);
    if (typeof onAffectionChanged === "function") onAffectionChanged(f, before);
  }
  f.playerFear = clamp(f.playerFear + amount, 0, 1);
}

// How far fear of you pulls down the happiness it settles at (Horse.update)
function fearHappinessTarget(f) {
  if (!f || !f.adopted || !(f.playerFear > 0)) return 0;
  return -FEAR_MOOD * f.playerFear;
}

// Sprayed more than SPRAY_OVERUSE times in a game day? (counts this one)
const SPRAY_OVERUSE = 4;
function sprayOverused(f) {
  const now = timePlayed;
  f._sprays = (Array.isArray(f._sprays) ? f._sprays : []).filter((t) => now - t < DAY_LENGTH);
  f._sprays.push(now);
  return f._sprays.length > SPRAY_OVERUSE;
}

// Called at the start of notifyViolence (Horse.js): you hurt `victim`
function notePlayerViolence(victim, isDead, weaponType, isTraining, isAmputation) {
  if (!victim || weaponType === "car") return; // traffic isn't you
  let fear = FEAR_FROM_WEAPON[weaponType] ?? 0.15;
  if (isTraining) fear *= 0.5; // it knows what that was for... mostly
  // (other tools pass the same flag, but only cutting something off counts)
  if (isAmputation && (weaponType === "knife" || weaponType === "scalpel")) fear += 0.2;
  // For Separation.js: was it hurt or killed by you shortly before being taken?
  if (!isTraining) {
    victim.hurtByPlayerAt = timePlayed;
    if (isDead || !victim.isAlive) victim.killedByPlayer = true;
  }
  if (!isDead && victim.isAlive) {
    // Hurt in the middle of a bath: afraid of baths from now on (Fears.js)
    if (victim._bathAt !== undefined && timePlayed - victim._bathAt < 2 * BATH_SESSION && typeof learnFearOfBaths === "function")
      learnFearOfBaths(victim, weaponType === "spray" ? BATH_FROM_ROUGH / 3 : BATH_FROM_ROUGH);
    // A fright that bad: it may wet itself (Scaredy.js)
    if (typeof scaredyMess === "function") scaredyMess(victim, Math.min(1, fear * 2.5));
    if ((weaponType === "stick" || weaponType === "spray") && typeof noteConditionStick === "function") noteConditionStick(victim); // (Care.js)
    changePlayerFear(victim, fear);
    // A squirt of water is a telling-off, not harm - unless you overdo it
    let memory = isTraining ? "training" : weaponType;
    if (weaponType === "spray") memory = sprayOverused(victim) ? "sprayed_lots" : "spray";
    rememberPlayerEvent(victim, memory);
    // It may carry the mark for good (Scars.js)
    if (!isTraining && !isAmputation && typeof scarFromYou === "function") scarFromYou(victim, weaponType);
  }
  // Its special friend saw (SpecialFriends.js) - not for a squirt or a lesson
  if (!isTraining && weaponType !== "spray" && typeof onSpecialFriendHarmed === "function") onSpecialFriendHarmed(victim, null);
  // Everyone who saw or heard it gets scared of you too (hardly at all for a
  // squirt of water or a lesson: they saw a telling-off, not cruelty, so
  // they don't remember it as harm either)
  const mild = weaponType === "spray" || isTraining;
  for (const other of fluffies) {
    if (
      other === victim ||
      !other.isAlive ||
      other.scene !== victim.scene ||
      other.currentStateKey === "SLEEPING" ||
      (!other.canSee() && !other.canHear())
    )
      continue;
    const rel = relationships[other.id] && relationships[other.id][victim.id];
    const close = rel && rel !== "friend";
    let amount = (close ? 0.08 : 0.03) * (isDead ? 2 : 1) * (isTraining ? 0.3 : 1) * (weaponType === "spray" ? 0.1 : 1);
    changePlayerFear(other, amount);
    if (!mild) rememberPlayerEvent(other, close ? "witness_family" : "witness");
  }
}

// Brush code (script.js): brushing builds trust and calms
// (Affection.js: only the first few brushes a day count in full)
function onFluffyBrushed(f) {
  if (typeof brushOutMats === "function") brushOutMats(f); // (a long coat's mats: Coats.js)
  if (typeof noteConditionBrush === "function") noteConditionBrush(f); // a bedtime brush (Care.js)
  if (typeof onComfortedByYou === "function") onComfortedByYou(f, "brushed"); // (Fears.js)
  if (typeof giveAffection === "function") giveAffection(f, "brushed");
  else {
    changePlayerTrust(f, 0.05);
    rememberPlayerEvent(f, "brushed");
  }
  f.playerFear = Math.max(0, (f.playerFear || 0) - 0.03);
}

// Picking a fluffy up (UI.js mousedown)
function onFluffyPickedUp(f) {
  if (typeof tearOffGlueTrap === "function") tearOffGlueTrap(f); // (GlueTrap.js: stuck to one - it tears)
  if (typeof rockTantrum === "function") rockTantrum(f); // (stopped eating a rock: Tummy.js)
  if (!f.isAlive) return;
  if (typeof onComfortedByYou === "function") onComfortedByYou(f, "held"); // a cuddle when frightened (Fears.js)
  ensurePlayerMemory(f);
  const now = timePlayed;
  if (f._lastPickupReaction && now - f._lastPickupReaction < 20) return;
  f._lastPickupReaction = now;
  const canTalk = !f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING";
  if (f.playerFear >= 0.45) {
    f.expressionOverride = "CRYING_SHOCKED";
    f.expressionOverrideTimer = 3.0;
    f.changeHappiness(-0.01);
    if (canTalk) f.speak(getDialogue(["TRUST", "UPSIES_SCARED"], f), true);
    if (f.playerFear >= 0.75 && Math.random() < 0.3) f.excrete("pee");
  } else if (f.playerTrust >= 0.7 && f.playerFear < 0.2) {
    f.expressionOverride = "GOOD_UPSIES";
    f.expressionOverrideTimer = 2.0;
    f.changeHappiness(0.02);
    if (typeof giveAffection === "function") giveAffection(f, "held_happy");
    else {
      changePlayerTrust(f, 0.01);
      rememberPlayerEvent(f, "held_happy");
    }
    if (canTalk) f.speak(getDialogue(["TRUST", "UPSIES_HAPPY"], f), true);
  } else if (f.playerTrust < 0.3 && f.adopted) {
    // Doesn't like you: squirms (Affection.js)
    f.expressionOverride = "BAD_UPSIES";
    f.expressionOverrideTimer = 2.0;
    f.changeHappiness(-0.01);
    if (canTalk) f.speak(getDialogue(["TRUST", "UPSIES_GRUMPY"], f), true);
  }
}

// Every simulation step, for each fluffy (script.js)
function updatePlayerMemory(f, dt) {
  if (!f.isAlive) return;
  ensurePlayerMemory(f);
  const now = timePlayed;

  // Fear fades once it's been a while; gentle fluffies forgive faster
  if (f.playerFear > 0 && now - (f.lastHurtByPlayerAt || -1e9) > FEAR_FADE_DELAY) {
    let forgive = 1 - 0.5 * traitValue(f, "temper"); // gentle 1.5x, grumpy 0.5x
    if (f.playerTrust >= 0.75) forgive *= 1.5; // it loves you (Affection.js)
    f.playerFear = Math.max(0, f.playerFear - (FEAR_FADE_PER_MIN / 60) * forgive * dt);
  }

  if (!f.adopted || f.playerFear >= 0.45) return;
  // Just being looked after takes it as far as liking you (PASSIVE_TRUST);
  // more than that takes real care: brushing, play, cuddles... (Affection.js)
  if (f.playerTrust >= PASSIVE_TRUST) return;
  const passive = (amount) => changePlayerTrust(f, Math.min(amount, Math.max(0, PASSIVE_TRUST - f.playerTrust)));
  // Being fed at home - by you, not the Feed-Bot
  if (f.currentStateKey === "EATING" && getSceneConfig(f.scene).insidePlayerQuarters && f._mealFromYou !== false) {
    // Only if it likes what it's eating (Diet.js: last meal's taste)
    const meal = Array.isArray(f.recentMeals) && f.recentMeals[0];
    const taste = meal && typeof tasteFor === "function" ? tasteFor(f, meal) : 0;
    if (taste > -0.3) passive(0.004 * dt);
  }
  // Spending happy time with you around
  if (
    f.scene === currentScene &&
    f.happiness > HAPPINESS_HAPPY_THRESHOLD &&
    f.currentStateKey !== "SLEEPING"
  ) {
    passive(0.00005 * dt); // (about 0.06 a day - Affection.js does the rest)
  }
}

// ---- How it feels about you, in words (magnifying glass panel) ----

function describePlayerFeeling(f) {
  ensurePlayerMemory(f);
  if (f.playerFear >= 0.75) return ["Terrified of you", "bad"];
  if (f.playerFear >= 0.45) return ["Scared of you", "bad"];
  if (f.playerFear >= 0.2) return ["Wary of you", "ok"];
  if (f.playerTrust >= 0.75) return ["Loves you", "good"];
  if (f.playerTrust >= 0.55) return ["Trusts you", "good"];
  if (f.playerTrust < 0.3) return ["Doesn't trust you", "ok"];
  return ["Unsure of you", ""];
}

function isFriendlyWithPeople(f) {
  ensurePlayerMemory(f);
  return f.playerTrust >= 0.55 && f.playerFear < 0.2;
}

function describePlayerMemories(f, max = 2) {
  ensurePlayerMemory(f);
  if (!f.playerMemories.length) return "Nothing special yet";
  const now = timePlayed;
  return f.playerMemories
    .slice(0, max)
    .map((m) => {
      const mins = Math.floor((now - m.t) / 60);
      const when = mins < 1 ? "just now" : `${mins} min ago`;
      return `${m.text}${m.count > 1 ? ` x${m.count}` : ""} (${when})`;
    })
    .join("; ");
}

// ---- Desires (added in the Horse constructor) ----

function _handNear(horse, radius) {
  if (horse.scene !== currentScene) return false;
  if (typeof isAnyScreenOpen === "function" && isAnyScreenOpen()) return false;
  const dx = horse.x - mouse.x;
  const dy = horse.y - 40 - mouse.y;
  return dx * dx + dy * dy < radius * radius;
}

// Scared of you: back away from your hand when it comes close
class FleePlayerDesire extends Desire {
  constructor() {
    super("FleePlayer");
    this.lastTime = -Infinity;
  }
  evaluate(horse) {
    if (!horse.isAlive || horse.isDragging || horse.placedOn) return 0;
    if (horse.currentStateKey === "SLEEPING" || !horse.canSee()) return 0;
    if (!horse.avoidStateChangerActions()) return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD) return 0;
    ensurePlayerMemory(horse);
    if (horse.playerFear < 0.45) return 0;
    if (gameTimeMs() - this.lastTime < 2500) return 0;
    if (!_handNear(horse, 170)) return 0;
    return 40 + horse.playerFear * 50; // 62..90: beats most things but real dangers
  }
  execute(horse) {
    this.lastTime = gameTimeMs();
    return horse.actionHandler.executeRunawayFear({ x: mouse.x, y: mouse.y + 40 }, ["TRUST", "FLEE"]);
  }
}

// Trusts you: every now and then, trot over to your hand
class SeekPlayerDesire extends Desire {
  constructor() {
    super("SeekPlayer");
    this.lastTime = gameTimeMs() - Math.random() * 30000;
  }
  evaluate(horse) {
    if (!horse.isAlive || horse.isDragging || horse.placedOn || !horse.adopted) return 0;
    if (horse.sleepingOrTargetSet() || horse.isStacking) return 0;
    if (!horse.canSee() || horse.tooYoungToWalk()) return 0;
    if (horse.scene !== currentScene) return 0;
    ensurePlayerMemory(horse);
    if (horse.playerTrust < 0.75 || horse.playerFear >= 0.2) return 0;
    if (horse.hunger < 0.4) return 0;
    if (gameTimeMs() - this.lastTime < 45000) return 0;
    if (typeof isAnyScreenOpen === "function" && isAnyScreenOpen()) return 0;
    // Only if your hand is somewhere on the floor
    const sm = screenMouse();
    if (sm.y < sceneTop(horse.scene) + 40 && !isCameraScene(horse.scene)) return 0;
    if (sm.y > height - 40) return 0;
    if (_handNear(horse, 120)) return 0; // already there
    return 47; // a bit above an idle wander (45) or going to a buddy (46)
  }
  execute(horse) {
    this.lastTime = gameTimeMs();
    let tx = clamp(mouse.x + (Math.random() - 0.5) * 60, 60, sceneW(horse.scene) - 60);
    let ty = clamp(mouse.y + 60, sceneTop(horse.scene) + 60, sceneH(horse.scene) - 60);
    if (typeof nearestReachablePoint === "function" && typeof canFluffyReach === "function" && !canFluffyReach(horse, tx, ty)) {
      const p = nearestReachablePoint(horse, tx, ty);
      if (!p) return false;
      tx = p.x;
      ty = p.y;
    }
    horse.initBehavior("MOVING");
    horse.setTargetPosition(tx, ty);
    if (!horse.tooYoungToSpeak()) horse.speak(getDialogue(["TRUST", "SEEK"], horse));
    return true;
  }
}
