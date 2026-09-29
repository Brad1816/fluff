// ---------------------------------------------------------------------------
// Play and boredom.
//
// Boredom (f.boredom, 0..1, saved) - fluffies you own only (the park is
// exciting enough). It creeps up while a fluffy is awake with nothing to do:
//   BOREDOM_PER_HOUR (0.06: bored after most of a day of nothing),
//   faster for playful fluffies and foals, slower for lazy ones and the
//   elderly, slower with a friend in the room, and it goes DOWN in the park.
// Playing takes it away (onFluffyPlayed): kicking a ball, picking up blocks,
// watching the TV, doing a trick, and best of all playing with you.
// Its favourite toy (favouriteToy: ball, blocks or the TV - playful ones
// lean to the ball, lazy ones to the TV) counts half as much again.
//
// Playing with you: pick up a ball and wave it near your fluffies. Ones
// that are bored or playful chase it (ChaseHeldBallDesire); when one catches
// up it's a game - boredom -0.35, happier, affection ("played"), and it
// burns off a little weight (Diet.js). Once a minute per fluffy.
//
// What boredom does:
//   bored (0.4+):      wants to play more (playDesireBonus, the ball and
//                      block desires), grumbles about it now and then
//   bored (0.4+) also caps happiness at 0.88; very bored at 0.7
//   very bored (0.7+): slowly unhappy, and gets into mischief about twice a
//                      game day (boredMischief): knocks over a bowl of food,
//                      or picks on another fluffy; shows -4 points
//   content (< 0.3):   shows +2 points
//
// Shown in the magnifying glass: Boredom (Overview), Favourite toy (Looks &
// nature). Fetch (a trick in Tricks.js) uses the ball.
// ---------------------------------------------------------------------------

const BOREDOM_PER_HOUR = 0.06;
const BOREDOM_BORED = 0.4;
const BOREDOM_VERY = 0.7;
const PLAY_RELIEF = { ball: 0.1, block: 0.1, tv: 0.008, trick: 0.05, fetch: 0.15, you: 0.35 }; // tv: per second
const PLAY_WITH_YOU_COOLDOWN = 60;
const TOYS = [
  { key: "ball", name: "The ball" },
  { key: "block", name: "Blocks" },
  { key: "tv", name: "Fluff TV" },
];

const playTicker = new Ticker(2);

function _plNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}
function _plTrait(f, key) {
  return typeof traitValue === "function" ? traitValue(f, key) : 0;
}
function _plName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Your fluffy";
}

function boredomOf(f) {
  return typeof f.boredom === "number" ? f.boredom : 0;
}
function isBored(f) {
  return boredomOf(f) >= BOREDOM_BORED;
}

// How much it likes each toy (made the first time, saved)
function toyLike(f, key) {
  if (!f.toyLikes || typeof f.toyLikes !== "object") f.toyLikes = {};
  if (typeof f.toyLikes[key] !== "number") f.toyLikes[key] = Math.round(Math.random() * 100) / 100;
  let v = f.toyLikes[key];
  const e = _plTrait(f, "energy"); // playful +, lazy -
  if (key === "ball") v += 0.35 * e;
  if (key === "tv") v -= 0.35 * e;
  return v;
}

function favouriteToy(f) {
  let best = TOYS[0].key;
  let bestV = -Infinity;
  for (const t of TOYS) {
    const v = toyLike(f, t.key);
    if (v > bestV) {
      bestV = v;
      best = t.key;
    }
  }
  return best;
}

// Something fun happened. amount multiplies the relief (TV: seconds watched)
function onFluffyPlayed(f, kind, amount = 1) {
  if (!f || !f.isAlive) return;
  let relief = (PLAY_RELIEF[kind] || 0.1) * amount;
  const toy = kind === "you" || kind === "fetch" ? "ball" : kind;
  if (TOYS.some((t) => t.key === toy) && favouriteToy(f) === toy) relief *= 1.5;
  f.boredom = Math.max(0, boredomOf(f) - relief);
  // Running about burns off sketties (Diet.js)
  if ((kind === "ball" || kind === "you" || kind === "fetch") && typeof changeWeight === "function") {
    changeWeight(f, kind === "you" ? -0.02 : -0.01);
  }
}

// Change to the ball and block desires (HorseBrain, normally 30): a content
// fluffy of yours plays less (15), a very bored one much more (up to 70)
function playDesireBonus(f) {
  if (!f.adopted) return 0;
  return Math.round(-15 + 55 * boredomOf(f));
}

// Shows (Shows.js showScore)
function boredomShowBonus(f) {
  const b = boredomOf(f);
  if (b >= BOREDOM_VERY) return -4;
  if (b < 0.3) return 2;
  return 0;
}

function describeBoredom(f) {
  const b = boredomOf(f);
  if (b >= BOREDOM_VERY) return ["Very bored - needs to play", "bad"];
  if (b >= BOREDOM_BORED) return ["Bored", "ok"];
  if (b >= 0.2) return ["Fine", ""];
  return ["Having fun", "good"];
}

function describeFavouriteToy(f) {
  const t = TOYS.find((x) => x.key === favouriteToy(f));
  return t ? t.name : "The ball";
}

// ---- Playing with you: chase the ball in your hand ----

function _heldBall(scene) {
  if (typeof objects === "undefined") return null;
  return objects.find((o) => o instanceof Ball && o.isDragging && o.scene === scene) || null;
}

class ChaseHeldBallDesire extends Desire {
  constructor() {
    super("ChaseHeldBall");
    this.lastTime = -Infinity;
  }
  evaluate(h) {
    if (!h.isAlive || !h.adopted || h.isDragging || h.placedOn || h.currentCage) return 0;
    if (h.sleepingOrTargetSet() || h.isStacking || h.trickNow) return 0;
    if (!h.canSee() || !canRun(h)) return 0;
    if (h.happiness <= WAN_DIE_THRESHOLD || (h.playerFear || 0) >= 0.45) return 0;
    const ball = _heldBall(h.scene);
    if (!ball) return 0;
    if (Math.hypot(ball.x - h.x, ball.y - h.y) > 450) return 0;
    const keen = boredomOf(h) >= 0.2 || _plTrait(h, "energy") > 0 || h.growth < 1;
    if (!keen) return 0;
    if (h._playedWithYouAt && _plNow() - h._playedWithYouAt < PLAY_WITH_YOU_COOLDOWN) return 0;
    return 55 + 20 * boredomOf(h);
  }
  execute(h) {
    const ball = _heldBall(h.scene);
    if (!ball) return false;
    const d = Math.hypot(ball.x - h.x, ball.y + 40 - h.y);
    if (d < 70) {
      playedWithYou(h);
      return true;
    }
    // Keep after it (every so often, so it doesn't jitter)
    const now = gameTimeMs();
    if (now - this.lastTime > 300 || !h.isMovingOrRunning()) {
      this.lastTime = now;
      if (!h.isMovingOrRunning()) h.initBehavior("MOVING");
      const ty = Math.max(sceneTop(h.scene) + 40, Math.min(sceneH(h.scene) - 40, ball.y + 40));
      h.setTargetPosition(ball.x, ty);
    }
    return true;
  }
}

function playedWithYou(f) {
  f._playedWithYouAt = _plNow();
  onFluffyPlayed(f, "you");
  f.changeHappiness(0.06);
  if (typeof giveAffection === "function") giveAffection(f, "played");
  f.expressionOverride = "GOOD_UPSIES";
  f.expressionOverrideTimer = 2;
  if (f.isMovingOrRunning()) f.initBehavior("IDLE");
  if (!f.tooYoungToSpeak()) f.speak(getDialogue(["PLAY", "WITH_YOU"], f), true);
}

// ---- Mischief ----

function boredMischief(f) {
  // Knock over a bowl of food
  const bowl =
    typeof objects !== "undefined"
      ? objects.find(
          (o) =>
            o instanceof Bowl &&
            o.scene === f.scene &&
            o.type !== "feeder" &&
            o.type !== "mega_feeder" &&
            o.food > 0 &&
            o.currentCage === f.currentCage &&
            Math.hypot(o.x - f.x, o.y - f.y) < 700,
        )
      : null;
  const victim = fluffies.find(
    (o) => o !== f && o.isAlive && o.scene === f.scene && o.currentCage === f.currentCage && Math.hypot(o.x - f.x, o.y - f.y) < 400,
  );
  const pick = bowl && (!victim || Math.random() < 0.6) ? "bowl" : victim ? "pick" : null;
  if (pick === "bowl") {
    bowl.food = 0;
    bowl.foodType = null;
    f.initBehavior("FLUFFY_STOMPIE");
    f.stateTimer = 0.5;
    if (typeof poofs !== "undefined") poofs.push(new Poof(bowl.x, bowl.y - 10, bowl.scene, "#8b5a2b"));
    if (!f.tooYoungToSpeak()) f.speak(getDialogue(["PLAY", "MISCHIEF_BOWL"], f), true);
    if (f.adopted && typeof addUIMessage === "function") addUIMessage(`${_plName(f)} knocked a bowl of food over - it's bored.`);
    f.boredom = Math.max(0, boredomOf(f) - 0.1);
    return "bowl";
  }
  if (pick === "pick") {
    f.initBehavior("FLUFFY_JAB");
    f.stateTimer = 0.5;
    f.facingRight = victim.x > f.x;
    victim.changeHappiness(-0.05);
    victim.expressionOverride = "CRYING_SHOCKED";
    victim.expressionOverrideTimer = 1.5;
    if (!f.tooYoungToSpeak()) f.speak(getDialogue(["PLAY", "MISCHIEF_PICK"], f), true);
    if (!victim.tooYoungToSpeak()) victim.speak(getDialogue(["PLAY", "PICKED_ON"], victim));
    if (f.adopted && typeof addUIMessage === "function") addUIMessage(`${_plName(f)} is picking on ${_plName(victim)} - it's bored.`);
    f.boredom = Math.max(0, boredomOf(f) - 0.1);
    return "pick";
  }
  return null;
}

// ---- The system ----

function updatePlay(dt) {
  const step = playTicker.step(dt);
  if (!step) return;
  const now = _plNow();
  const hours = step / (typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50);
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted || f.tooYoungToWalk()) continue;
    if (typeof f.boredom !== "number") f.boredom = 0;
    // Watching TV
    if (f.tvFocus) {
      onFluffyPlayed(f, "tv", step);
      continue;
    }
    if (f.currentStateKey === "SLEEPING") continue;
    // The park is exciting
    if (typeof PARK_SCENE !== "undefined" && f.scene === PARK_SCENE) {
      f.boredom = Math.max(0, f.boredom - 0.2 * hours);
      continue;
    }
    let rate = BOREDOM_PER_HOUR * (1 + 0.4 * _plTrait(f, "energy"));
    if (f.growth < 1) rate *= 1.3;
    if (typeof lifeStage === "function" && lifeStage(f) === "elderly") rate *= 0.6;
    const friend = fluffies.some(
      (o) => o !== f && o.isAlive && o.scene === f.scene && relationships[f.id] && relationships[f.id][o.id],
    );
    if (friend) rate *= 0.7;
    f.boredom = Math.min(1, f.boredom + rate * hours);
    // A bored fluffy can't be perfectly happy (so it shows in its price too)
    const cap = f.boredom >= BOREDOM_VERY ? 0.7 : f.boredom >= BOREDOM_BORED ? 0.88 : 1;
    if (f.happiness > cap) f.happiness = cap;

    if (f.boredom >= BOREDOM_VERY) {
      f.changeHappiness(-0.1 * hours);
      if (typeof f._nextMischief !== "number") f._nextMischief = now + 300 + Math.random() * 300;
      if (now >= f._nextMischief && !f.trickNow && f.currentStateKey !== "EATING") {
        f._nextMischief = now + 480 + Math.random() * 420; // about twice a game day
        boredMischief(f);
      }
    } else if (f.boredom >= BOREDOM_BORED && f.scene === currentScene) {
      if (typeof f._nextBoredTalk !== "number") f._nextBoredTalk = now + 60 + Math.random() * 120;
      if (now >= f._nextBoredTalk) {
        f._nextBoredTalk = now + 150 + Math.random() * 200;
        if (!f.tooYoungToSpeak()) f.speak(getDialogue(["PLAY", "BORED"], f));
      }
    }
  }
}
registerSystem("play", updatePlay, 138);
