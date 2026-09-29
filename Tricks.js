// ---------------------------------------------------------------------------
// Tricks and training.
//
// How to train: RIGHT-CLICK one of your fluffies. A row of tricks pops up
// over it (TRICKS: come, sit, lie down, bow, dance, wave), each with how well
// it knows it. Pick one and it tries:
//   - it gets it right (trickChance): it does the trick, and for a few
//     seconds two buttons show - "Good fluffy!" (praise, free) and "Treat"
//     (sketties, TRICK_TREAT_COST). Rewarding it straight away is how it
//     learns (TRICK_LEARN); a success nobody rewards teaches almost nothing.
//   - it gets it wrong: does something else and looks confused (a tiny bit
//     learnt from trying).
//   - it won't: Smarties never do tricks, scared ones won't with you, ones
//     that don't like you often refuse, and after TRICK_TRIES_PER_DAY goes in
//     a day it's had enough until tomorrow.
//   "Come": after picking it, click the spot it should come to.
//
// Skill is 0..1 per trick (f.tricks, saved). At TRICK_KNOWN (0.7) it "knows"
// the trick. How fast it learns (trickLearnRate): affection (Affection.js)
// most - a fluffy that loves you learns about twice as fast as one that
// doesn't like you; playful ones faster, lazy slower; foals faster, the
// elderly slower. How often it gets it right (trickChance): skill, plus
// affection, minus hunger or misery.
//
// Watching: foals in the room that see a trick done copy a little of it.
// Showing off: a fluffy that loves you sometimes does a trick it knows
// on its own when you're around.
//
// What known tricks are worth:
//   - Shows: +TRICK_SHOW_BONUS points each (up to 3) in every show, and the
//     "Trick Show" theme (Shows.js)
//   - Price: +5% each (trickPriceMultiplier, HorseGenetics.calculatePrice),
//     and families and kids at the door like them (Buyers.js)
//   - Orders can ask for "Knows 2 tricks" (Orders.js), and there's a goal
//   - "Come" is handy: call a fluffy over instead of carrying it
//
// Shown in the magnifying glass (Mind tab, "Tricks").
// ---------------------------------------------------------------------------

const TRICKS = [
  { key: "come", name: "Come", time: 15 },
  { key: "sit", name: "Sit", pose: "SITTING", time: 4 },
  { key: "down", name: "Lie down", pose: "LYING", time: 4 },
  { key: "bow", name: "Bow", pose: "BENDING_2", time: 2.5 },
  { key: "dance", name: "Dance", pose: "FLUFFY_STOMPIE", time: 3, spin: true },
  { key: "wave", name: "Wave", pose: "FLUFFY_JAB", time: 2.5 },
];
const TRICK_KNOWN = 0.7;
const TRICK_TRIES_PER_DAY = 10;
const TRICK_TREAT_COST = 2;
const TRICK_LEARN = { treat: 0.12, praise: 0.07, none: 0.01, fail: 0.01 };
const TRICK_REWARD_WINDOW = 5; // game seconds after it starts the trick
const TRICK_SHOW_BONUS = 2;
const TRICK_WATCH = 0.03; // a foal watching learns this much (up to half)

let trickUI = null; // { phase: "menu" | "spot" | "reward", id, trick, until }

function _trNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}
function _trDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : Math.floor(_trNow() / 1200);
}
function _trName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Your fluffy";
}
function _trTrait(f, key) {
  return typeof traitValue === "function" ? traitValue(f, key) : 0;
}
function getTrick(key) {
  return TRICKS.find((t) => t.key === key) || null;
}

function trickSkill(f, key) {
  return (f && f.tricks && f.tricks[key]) || 0;
}
function knownTricks(f) {
  return TRICKS.filter((t) => trickSkill(f, t.key) >= TRICK_KNOWN).map((t) => t.key);
}
function trickTriesLeft(f) {
  const d = _trDay();
  if (!f.trickTries || f.trickTries.day !== d) return TRICK_TRIES_PER_DAY;
  return Math.max(0, TRICK_TRIES_PER_DAY - f.trickTries.n);
}

function canLearnTricks(f) {
  return !!f && f.isAlive && f.adopted && !f.tooYoungToWalk() && !f.isCrawling;
}

// 0.5 (doesn't like you, lazy, old) .. about 2 (loves you, playful foal)
function trickLearnRate(f) {
  const lvl = typeof affectionLevel === "function" ? affectionLevel(f) : "unsure";
  let r = { adores: 1.4, loves: 1.3, likes: 1.1, unsure: 0.9, dislikes: 0.6 }[lvl] ?? 1;
  r *= 1 + 0.25 * _trTrait(f, "energy");
  const stage = typeof lifeStage === "function" ? lifeStage(f) : "adult";
  if (stage === "foal") r *= 1.3;
  else if (stage === "elderly") r *= 0.6;
  return r;
}

// How likely it gets it right this time
function trickChance(f, key) {
  const lvl = typeof affectionLevel === "function" ? affectionLevel(f) : "unsure";
  let p = 0.12 + 0.83 * trickSkill(f, key);
  p *= { adores: 1.15, loves: 1.1, likes: 1, unsure: 0.9, dislikes: 0.6 }[lvl] ?? 1;
  if (f.hunger < 0.3) p *= 0.7;
  if (f.happiness < 0.3) p *= 0.7;
  return Math.max(0.03, Math.min(0.97, p));
}

// Why it won't even try (null = it'll try)
function trickRefusal(f) {
  if (!canLearnTricks(f)) return "can't";
  if (f.currentStateKey === "SLEEPING") return "asleep";
  if (f.isSmarty && f.isSmarty()) return "smarty";
  if ((f.playerFear || 0) >= 0.45) return "scared";
  if (trickTriesLeft(f) <= 0) return "tired";
  return null;
}

function _trSay(f, key) {
  if (!f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING") f.speak(getDialogue(["TRICK", key], f), true);
}

function _trLearn(f, key, amount) {
  if (!f.tricks) f.tricks = {};
  const before = trickSkill(f, key);
  const after = Math.min(1, before + amount);
  f.tricks[key] = Math.round(after * 1000) / 1000;
  if (before < TRICK_KNOWN && after >= TRICK_KNOWN && f.adopted && typeof addUIMessage === "function") {
    addUIMessage(`${_trName(f)} knows "${getTrick(key).name}" now! ✓`);
  }
  return after - before;
}

// Ask it to do a trick. Returns "done", "failed", or why it didn't try.
function tryTrick(f, key, target = null) {
  const trick = getTrick(key);
  if (!trick || !f) return "can't";
  const why = trickRefusal(f);
  if (why) {
    if (why === "smarty") _trSay(f, "SMARTY");
    else if (why === "tired") _trSay(f, "TIRED");
    else if (why === "scared" && !f.tooYoungToSpeak()) f.speak(getDialogue(["TRUST", "FLEE"], f), true);
    return why;
  }
  const d = _trDay();
  if (!f.trickTries || f.trickTries.day !== d) f.trickTries = { day: d, n: 0 };
  f.trickTries.n++;
  // Doesn't like you: often just won't
  if (typeof affectionLevel === "function" && affectionLevel(f) === "dislikes" && Math.random() < 0.4) {
    _trSay(f, "REFUSE");
    f.expressionOverride = "ANGRY_PUFFED";
    f.expressionOverrideTimer = 1.5;
    return "refused";
  }
  if (Math.random() < trickChance(f, key)) {
    startTrick(f, key, target);
    _trSay(f, key.toUpperCase());
    _trWatchers(f, key);
    return "done";
  }
  // Wrong: does some other trick, or wanders off when called
  _trLearn(f, key, TRICK_LEARN.fail * trickLearnRate(f));
  const others = TRICKS.filter((t) => t.pose && t.key !== key);
  const wrong = key === "come" ? null : others[Math.floor(Math.random() * others.length)];
  if (wrong) startTrick(f, wrong.key, null, 1.5);
  f.expressionOverride = "SHOCKED";
  f.expressionOverrideTimer = 1.5;
  _trSay(f, "FAIL");
  return "failed";
}

// Make it do the trick now (no learning)
function startTrick(f, key, target = null, time = null) {
  const trick = getTrick(key);
  const now = _trNow();
  f.trickNow = { key, start: now, until: now + (time ?? trick.time), x: target ? target.x : f.x, y: target ? target.y : f.y, started: false };
}

// Foals watching pick a little of it up
function _trWatchers(f, key) {
  for (const o of fluffies) {
    if (o === f || !o.isAlive || o.scene !== f.scene || o.growth >= 1 || o.tooYoungToWalk()) continue;
    if (o.currentStateKey === "SLEEPING" || (o.canSee && !o.canSee())) continue;
    if (Math.hypot(o.x - f.x, o.y - f.y) > 500) continue;
    if (trickSkill(o, key) >= 0.5) continue;
    if (!o.tricks) o.tricks = {};
    o.tricks[key] = Math.min(0.5, trickSkill(o, key) + TRICK_WATCH);
  }
}

// "Good fluffy!" (praise) or "treat". Returns how much it learnt.
function rewardTrick(f, kind, key) {
  if (!f || !f.isAlive) return 0;
  if (kind === "treat") {
    if (typeof money === "number" && money < TRICK_TREAT_COST) {
      if (typeof addUIMessage === "function") addUIMessage("Not enough money for a treat.");
      return 0;
    }
    if (typeof money === "number") money -= TRICK_TREAT_COST;
  }
  const got = _trLearn(f, key, (TRICK_LEARN[kind] || 0) * trickLearnRate(f));
  if (typeof giveAffection === "function") giveAffection(f, kind === "treat" ? "treat" : "praised");
  f.changeHappiness(kind === "treat" ? 0.05 : 0.03);
  f.expressionOverride = "GOOD_UPSIES";
  f.expressionOverrideTimer = 1.5;
  _trSay(f, "PRAISED");
  return got;
}

// Worth more with tricks (HorseGenetics.calculatePrice)
function trickPriceMultiplier(f) {
  return 1 + 0.05 * knownTricks(f).length;
}

// 0..100 for the Trick Show (Shows.js): the best 3 tricks
function trickShowScore(f) {
  const s = TRICKS.map((t) => trickSkill(f, t.key)).sort((a, b) => b - a);
  return Math.round(((s[0] + s[1] + s[2]) / 3) * 100);
}

function describeTricks(f) {
  const learning = TRICKS.filter((t) => trickSkill(f, t.key) > 0).sort((a, b) => trickSkill(f, b.key) - trickSkill(f, a.key));
  if (!learning.length) return ["None yet (right-click it to train)", ""];
  const txt = learning
    .map((t) => {
      const s = trickSkill(f, t.key);
      return s >= TRICK_KNOWN ? `${t.name} ✓` : `${t.name} ${Math.round(s * 100)}%`;
    })
    .join(" · ");
  return [txt, knownTricks(f).length ? "good" : ""];
}

// ---- Doing the trick (a desire, so the brain holds the pose) ----

class TrickDesire extends Desire {
  constructor() {
    super("Trick");
  }
  evaluate(h) {
    const t = h.trickNow;
    if (!t) return 0;
    if (!h.isAlive || h.isDragging || h.placedOn || h.currentStateKey === "SLEEPING" || _trNow() > t.until) {
      h.trickNow = null;
      return 0;
    }
    return 70; // over wandering, eating when peckish and chatting; not fears
  }
  execute(h) {
    const t = h.trickNow;
    if (!t) return false;
    const trick = getTrick(t.key);
    if (t.key === "come") {
      if (!t.started) {
        t.started = true;
        h.initBehavior("MOVING");
        const reach = typeof canFluffyReach === "function" && !canFluffyReach(h, t.x, t.y) && typeof nearestReachablePoint === "function" ? nearestReachablePoint(h, t.x, t.y) : null;
        h.setTargetPosition(reach ? reach.x : t.x, reach ? reach.y : t.y);
      } else if (!t.arrived && !h.isMovingOrRunning()) {
        // Here! Sits and waits a moment, like a good fluffy
        t.arrived = true;
        t.until = _trNow() + 3;
        h.initBehavior("SITTING");
        h.stateTimer = 3;
      } else if (t.arrived && h.currentStateKey !== "SITTING") {
        h.initBehavior("SITTING");
        h.stateTimer = Math.max(0.5, t.until - _trNow());
      }
      return true;
    }
    if (h.currentStateKey !== trick.pose) {
      if (trick.spin && t.started) h.facingRight = !h.facingRight;
      t.started = true;
      h.initBehavior(trick.pose);
      // Dancing and waving repeat a short move; poses are held
      h.stateTimer = trick.spin || trick.pose === "FLUFFY_JAB" ? 0.5 : Math.max(0.5, t.until - _trNow());
    }
    return true;
  }
}

// ---- Right-click menu ----

function _trCam() {
  return typeof isCameraScene === "function" && isCameraScene(currentScene) && typeof camera !== "undefined" ? camera : { x: 0, y: 0 };
}

function trickUIFluffy() {
  return trickUI ? fluffies.find((f) => f.id === trickUI.id && f.isAlive) || null : null;
}

// UI.js mousedown, right button, world positions. True if it opened the menu.
function trickRightClick() {
  if (fluffies.some((f) => f.isDragging)) return false;
  const hits = fluffies
    .filter((f) => f.scene === currentScene && f.isAlive && f.adopted && f.hitTestAsSeen(mouse.x, mouse.y))
    .sort((a, b) => b.y - a.y);
  const f = hits[0];
  if (!f) return false;
  if (!canLearnTricks(f)) {
    if (typeof addUIMessage === "function") addUIMessage(`${_trName(f)} is too little to learn tricks.`);
    return true;
  }
  trickUI = { phase: "menu", id: f.id };
  return true;
}

function closeTrickUI() {
  trickUI = null;
}

// Chip rectangles in screen positions
function getTrickMenuLayout() {
  const f = trickUIFluffy();
  if (!f) return null;
  const cam = _trCam();
  const cx = f.x - cam.x;
  const top = f.y - cam.y - 90 - 60 * (f.growth || 1);
  const chips = [];
  if (trickUI.phase === "menu") {
    const w = 96;
    const gap = 6;
    const total = TRICKS.length * w + (TRICKS.length - 1) * gap;
    let x = Math.max(8, Math.min(width - total - 8, cx - total / 2));
    const y = Math.max(40, Math.min(height - 80, top - 40));
    for (const t of TRICKS) {
      chips.push({ x, y, w, h: 38, key: t.key, trick: t });
      x += w + gap;
    }
    return { f, chips, titleX: Math.max(8 + total / 2, Math.min(width - 8 - total / 2, cx)), titleY: y - 10 };
  }
  if (trickUI.phase === "reward") {
    const w = 140;
    const x = Math.max(8, Math.min(width - 2 * w - 14, cx - w - 3));
    const y = Math.max(40, Math.min(height - 80, top - 30));
    chips.push({ x, y, w, h: 36, key: "praise" });
    chips.push({ x: x + w + 6, y, w, h: 36, key: "treat" });
    return { f, chips, titleX: x + w + 3, titleY: y - 10 };
  }
  return { f, chips, titleX: Math.max(160, Math.min(width - 160, cx)), titleY: Math.max(40, top) };
}

function handleTrickClick() {
  if (!trickUI) return false;
  const L = getTrickMenuLayout();
  if (!L) {
    closeTrickUI();
    return false;
  }
  const sm = typeof screenMouse === "function" ? screenMouse() : mouse;
  const hit = L.chips.find((c) => sm.x >= c.x && sm.x <= c.x + c.w && sm.y >= c.y && sm.y <= c.y + c.h);
  const f = L.f;
  if (trickUI.phase === "menu") {
    if (!hit) {
      closeTrickUI();
      return true;
    }
    if (hit.key === "come") {
      trickUI = { phase: "spot", id: f.id };
      return true;
    }
    _trAsk(f, hit.key);
    return true;
  }
  if (trickUI.phase === "spot") {
    const cam = _trCam();
    _trAsk(f, "come", { x: sm.x + cam.x, y: sm.y + cam.y });
    return true;
  }
  if (trickUI.phase === "reward") {
    if (hit) rewardTrick(f, hit.key, trickUI.trick);
    else _trLearn(f, trickUI.trick, TRICK_LEARN.none);
    closeTrickUI();
    return true;
  }
  return false;
}

function _trAsk(f, key, target = null) {
  const res = tryTrick(f, key, target);
  if (res === "done") trickUI = { phase: "reward", id: f.id, trick: key, until: _trNow() + TRICK_REWARD_WINDOW };
  else {
    closeTrickUI();
    const msg = {
      asleep: `${_trName(f)} is asleep.`,
      tired: `${_trName(f)} has had enough tricks for today.`,
      scared: `${_trName(f)} is too scared of you to learn.`,
      smarty: `Smarties don't do tricks.`,
    }[res];
    if (msg && typeof addUIMessage === "function") addUIMessage(msg);
  }
}

function drawTrickUI(c) {
  if (!trickUI) return;
  const L = getTrickMenuLayout();
  if (!L) {
    closeTrickUI();
    return;
  }
  const f = L.f;
  const sm = typeof screenMouse === "function" ? screenMouse() : mouse;
  c.save();
  c.textAlign = "center";
  c.textBaseline = "middle";
  const label = (text, x, y) => {
    c.font = "bold 14px Arial";
    const w = c.measureText(text).width + 20;
    fillRoundRect(c, x - w / 2, y - 12, w, 24, 10, "rgba(20, 16, 30, 0.85)");
    c.fillStyle = "white";
    c.fillText(text, x, y);
  };
  if (trickUI.phase === "menu") {
    label(`Train ${_trName(f)} · ${trickTriesLeft(f)} tries left today`, L.titleX, L.titleY - 8);
    for (const ch of L.chips) {
      const s = trickSkill(f, ch.key);
      const hover = sm.x >= ch.x && sm.x <= ch.x + ch.w && sm.y >= ch.y && sm.y <= ch.y + ch.h;
      fillRoundRect(c, ch.x, ch.y, ch.w, ch.h, 10, hover ? "rgba(120, 80, 170, 0.95)" : "rgba(40, 30, 60, 0.9)");
      c.fillStyle = "white";
      c.font = "bold 14px Arial";
      c.fillText(ch.trick.name, ch.x + ch.w / 2, ch.y + 13);
      c.font = "11px Arial";
      c.fillStyle = s >= TRICK_KNOWN ? "#8fe39f" : "#cfc6e0";
      c.fillText(s >= TRICK_KNOWN ? "knows it ✓" : `${Math.round(s * 100)}%`, ch.x + ch.w / 2, ch.y + 28);
      // progress bar
      c.fillStyle = "rgba(255,255,255,0.15)";
      c.fillRect(ch.x + 8, ch.y + ch.h - 4, ch.w - 16, 2);
      c.fillStyle = s >= TRICK_KNOWN ? "#8fe39f" : "#c9a6ff";
      c.fillRect(ch.x + 8, ch.y + ch.h - 4, (ch.w - 16) * s, 2);
    }
  } else if (trickUI.phase === "spot") {
    label(`Click where ${_trName(f)} should come to`, sm.x, sm.y - 30);
  } else if (trickUI.phase === "reward") {
    const left = Math.max(0, trickUI.until - _trNow());
    label(`Reward it now! (${Math.ceil(left)}s)`, L.titleX, L.titleY - 8);
    for (const ch of L.chips) {
      const hover = sm.x >= ch.x && sm.x <= ch.x + ch.w && sm.y >= ch.y && sm.y <= ch.y + ch.h;
      const col = ch.key === "praise" ? (hover ? "rgb(230, 90, 140)" : "rgba(190, 60, 110, 0.92)") : hover ? "rgb(230, 150, 60)" : "rgba(190, 110, 40, 0.92)";
      fillRoundRect(c, ch.x, ch.y, ch.w, ch.h, 10, col);
      c.fillStyle = "white";
      c.font = "bold 14px Arial";
      c.fillText(ch.key === "praise" ? "♥ Good fluffy!" : `Treat $${TRICK_TREAT_COST}`, ch.x + ch.w / 2, ch.y + ch.h / 2);
    }
  }
  c.restore();
}

registerScreen({
  name: "tricks",
  layer: 6,
  isOpen: () => !!trickUI,
  close: () => closeTrickUI(),
  draw: (c) => drawTrickUI(c),
  click: () => handleTrickClick(),
});

// ---- The system: reward window, showing off ----

const tricksTicker = new Ticker(1);

function updateTricks(dt) {
  // Missed the moment to reward it
  if (trickUI && trickUI.phase === "reward" && _trNow() > trickUI.until) {
    const f = trickUIFluffy();
    if (f) _trLearn(f, trickUI.trick, TRICK_LEARN.none);
    closeTrickUI();
  }
  if (trickUI && !trickUIFluffy()) closeTrickUI();
  const step = tricksTicker.step(dt);
  if (!step) return;
  const now = _trNow();
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted || f.scene !== currentScene || f.trickNow) continue;
    if (f.currentStateKey !== "IDLE" || f.happiness < 0.7) continue;
    if (typeof lovesYou === "function" && !lovesYou(f)) continue;
    const known = knownTricks(f).filter((k) => k !== "come");
    if (!known.length) continue;
    if (typeof f._nextShowOff !== "number") f._nextShowOff = now + 120 + Math.random() * 240;
    if (now < f._nextShowOff) continue;
    f._nextShowOff = now + 240 + Math.random() * 360;
    const key = known[Math.floor(Math.random() * known.length)];
    startTrick(f, key);
    _trSay(f, "SHOW_OFF");
  }
}
registerSystem("tricks", updateTricks, 136);
