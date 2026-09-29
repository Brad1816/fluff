// ---------------------------------------------------------------------------
// Affection: how much each fluffy you own loves you, shown as hearts.
//
// Affection IS the trust score from Memory.js (f.playerTrust, 0..1), so
// everything that already used trust (show scores, buyers, prices, orders for
// "friendly with people") now follows affection too. This file adds:
//
// Nice things (giveAffection):         AFFECTION_ACTS
//   brushing, filling the bowl it eats from, sketties (a treat), a present
//   (putting an accessory on it), a toy dropped near it, patching up a
//   bleeding wound, the vet making it better, giving it a name, cuddles.
//   Each counts in full only the first few times a day (perDay); after that
//   only a fifth, so brushing one fluffy fifty times doesn't buy its love.
//   Some also have a cooldown (seconds) so holding the food bag over a bowl
//   doesn't count every quarter second.
//
// Bad things (loseAffection):
//   hurting it or its family (Memory.js fear - fear also costs trust),
//   horrid "accessories" (blindfold, gag, castration band), and neglect,
//   checked by updateAffection every few seconds for fluffies you own:
//     starving (hunger < 0.15)        AFFECTION_NEGLECT.hungry per game hour
//     freezing (warmth < 0.3)         .cold
//     shut in a cage for 6+ hours     .caged
//     no kindness from you for 2 days .missed (only drifts down to 0.6)
//
// Hearts: affectionHearts(f) = 0..5 in halves. Levels (affectionLevel):
//   adores (0.95+), loves (0.75+), likes (0.55+), unsure (0.3+), dislikes.
//
// What it changes:
//   - loves/adores: talks about loving you now and then, a bit happier when
//     you're in the room, brushing makes it 1.5x as happy, forgives being
//     hurt faster (Memory.js); plus the old trust effects (comes to your
//     hand, likes being picked up)
//   - dislikes: brushing only makes it half as happy and it grumbles,
//     squirms when picked up
//   - a little heart pops up over it when it goes up (a broken one when it
//     drops), and you get a message when it starts to love you or stops
//
// Shown at the top right of the magnifying glass and in the Mind tab.
// ---------------------------------------------------------------------------

const AFFECTION_ACTS = {
  brushed: { amount: 0.05, perDay: 3 },
  held_happy: { amount: 0.01, perDay: 5 },
  fed: { amount: 0.02, perDay: 3, cooldown: 120 },
  treat: { amount: 0.04, perDay: 2, cooldown: 120 },
  gift: { amount: 0.06, perDay: 2 },
  toy: { amount: 0.02, perDay: 3, cooldown: 60 },
  patched: { amount: 0.06, perDay: 3 },
  vet: { amount: 0.05, perDay: 2 },
  named: { amount: 0.05, perDay: 1 },
};
const AFFECTION_WEAK = 0.2; // after the daily allowance, each counts this much

// Lost per game hour while it lasts
const AFFECTION_NEGLECT = { hungry: 0.02, cold: 0.02, caged: 0.005, missed: 0.03 / 24 };
const AFFECTION_CAGE_HOURS = 6;
const AFFECTION_MISS_DAYS = 2;
const AFFECTION_MISS_FLOOR = 0.6;
const AFFECTION_HORRID = new Set(["blindfold", "mouthgag", "castration_band"]);

Object.assign(MEMORY_TEXT, {
  fed: "Fed by you",
  treat: "Got sketties from you",
  gift: "Got a present from you",
  toy: "You brought a toy",
  patched: "You fixed its owie",
  vet: "You made it better",
  named: "You gave it a name",
  horrid: "You put something horrid on it",
  hungry: "You let it go hungry",
  cold: "You left it in the cold",
  caged: "Shut in a cage for ages",
  missed: "Misses you",
});

const affectionTicker = new Ticker(2);
let affectionPops = []; // little hearts over fluffies (not saved)

function _affNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}
function _affDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : Math.floor(_affNow() / 1200);
}
function _affName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Your fluffy";
}

function affectionLevel(f) {
  const t = typeof f.playerTrust === "number" ? f.playerTrust : 0.5;
  if (t >= 0.95) return "adores";
  if (t >= 0.75) return "loves";
  if (t >= 0.55) return "likes";
  if (t >= 0.3) return "unsure";
  return "dislikes";
}

// 0..5 in halves
function affectionHearts(f) {
  const t = typeof f.playerTrust === "number" ? f.playerTrust : 0.5;
  return Math.round(clamp(t, 0, 1) * 10) / 2;
}

function affectionHeartText(f) {
  const h = affectionHearts(f);
  const full = Math.floor(h);
  const half = h - full >= 0.5 ? 1 : 0;
  return "♥".repeat(full) + (half ? "❥" : "") + "♡".repeat(5 - full - half);
}

// Loves you and isn't scared of you
function lovesYou(f) {
  return !!f && (f.playerTrust ?? 0.5) >= 0.75 && (f.playerFear || 0) < 0.2;
}

// A nice thing you did. Returns how much affection it gained.
function giveAffection(f, type, scale = 1) {
  if (!f || !f.isAlive) return 0;
  const act = AFFECTION_ACTS[type];
  if (!act) return 0;
  ensurePlayerMemory(f);
  const now = _affNow();
  const day = _affDay();
  if (!f.affectionToday || f.affectionToday.day !== day) f.affectionToday = { day, n: {}, at: {} };
  const today = f.affectionToday;
  if (!today.at) today.at = {};
  if (act.cooldown && today.at[type] !== undefined && now - today.at[type] < act.cooldown) return 0;
  today.at[type] = now;
  const n = today.n[type] || 0;
  today.n[type] = n + 1;
  let amount = act.amount * scale * (n < act.perDay ? 1 : AFFECTION_WEAK);
  // A frightened fluffy is slow to believe you mean it
  if ((f.playerFear || 0) >= 0.45) amount *= 0.5;
  const before = f.playerTrust;
  changePlayerTrust(f, amount);
  f.lastKindnessAt = now;
  rememberPlayerEvent(f, type);
  return f.playerTrust - before;
}

// A bad thing (other than hurting it - that's Memory.js fear)
function loseAffection(f, type, amount, remember = true) {
  if (!f || !f.isAlive || amount <= 0) return 0;
  ensurePlayerMemory(f);
  const before = f.playerTrust;
  f.playerTrust = clamp(f.playerTrust - amount, 0, 1);
  if (remember) rememberPlayerEvent(f, type);
  onAffectionChanged(f, before);
  return before - f.playerTrust;
}

// Called whenever trust changes (Memory.js changePlayerTrust/changePlayerFear)
function onAffectionChanged(f, before) {
  if (!f || typeof before !== "number") return;
  const d = f.playerTrust - before;
  const now = _affNow();
  if (Math.abs(d) >= 0.015 && f.isAlive) {
    if (!f._lastHeartPop || now - f._lastHeartPop > 1 || typeof timePlayed !== "number") {
      f._lastHeartPop = now;
      affectionPops.push({ x: f.x, y: f.y, scene: f.scene, good: d > 0, born: _popClock(), id: f.id, growth: f.growth || 1 });
      if (affectionPops.length > 40) affectionPops.shift();
    }
  }
  if (!f.adopted || !f.isAlive) return;
  const rank = { dislikes: 0, unsure: 1, likes: 2, loves: 3, adores: 4 };
  const lvlBefore = affectionLevel({ playerTrust: before });
  const lvlNow = affectionLevel(f);
  if (lvlBefore === lvlNow) return;
  if (f._affMsgAt && now - f._affMsgAt < 60) return;
  const up = rank[lvlNow] > rank[lvlBefore];
  let msg = null;
  if (up && lvlNow === "loves") msg = `${_affName(f)} loves you now! ♥`;
  else if (up && lvlNow === "adores") msg = `${_affName(f)} adores you! ♥♥`;
  else if (!up && lvlBefore === "loves") msg = `${_affName(f)} doesn't love you like before.`;
  else if (!up && lvlNow === "dislikes") msg = `${_affName(f)} doesn't like you any more.`;
  if (msg) {
    f._affMsgAt = now;
    if (typeof addUIMessage === "function") addUIMessage(msg);
  }
}

// ---- Hooks from the rest of the game ----

// FoodBag.attemptFill: you filled a bowl. Everyone you own in the room who's
// awake sees who brings the food.
function onBowlFilledByYou(bowl, foodType) {
  if (!bowl || foodType === "rat_poison") return;
  const kind = foodType === "sketties" ? "treat" : "fed";
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted || f.scene !== bowl.scene) continue;
    if (f.currentStateKey === "SLEEPING") continue;
    if (typeof f.canSee === "function" && !f.canSee()) continue;
    giveAffection(f, kind);
  }
}

// Ball/Block onDrop: a toy put down near it
function onToyDropped(toy) {
  if (!toy) return;
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted || f.scene !== toy.scene) continue;
    if (f.currentStateKey === "SLEEPING" || f.isDragging) continue;
    if (Math.hypot(f.x - toy.x, f.y - toy.y) > 220) continue;
    giveAffection(f, "toy");
  }
}

// AccessoryItem: put on it
function onAccessoryGiven(f, accessoryId) {
  if (!f || !f.isAlive) return;
  if (AFFECTION_HORRID.has(accessoryId)) {
    loseAffection(f, "horrid", 0.05);
    return;
  }
  if (accessoryId === "duncehat") return; // it doesn't know what that means
  giveAffection(f, "gift");
  if (!f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING") f.speak(getDialogue(["TRUST", "GIFT"], f), true);
}

// ---- How you treat it changes how it acts ----

// Brushing's happiness bonus (script.js)
function brushHappinessMultiplier(f) {
  const lvl = affectionLevel(f);
  if (lvl === "loves" || lvl === "adores") return 1.5;
  if (lvl === "dislikes") return 0.5;
  return 1;
}

// A fluffy that doesn't like you grumbles instead of the usual brush line
function brushDialogueKey(f, key) {
  if (affectionLevel(f) === "dislikes" && !f.tooYoungToSpeak() && Math.random() < 0.6) return ["TRUST", "GRUMBLE"];
  return key;
}

// ---- The system: neglect, missing you, love talk ----

function updateAffection(dt) {
  const step = affectionTicker.step(dt);
  if (!step) return;
  const now = _affNow();
  const hours = step / (typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50);
  const day = _affDay();
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted) continue;
    ensurePlayerMemory(f);
    if (typeof f.lastKindnessAt !== "number") f.lastKindnessAt = now;
    const once = (type) => {
      if (!f.affectionNeglect || f.affectionNeglect.day !== day) f.affectionNeglect = { day, seen: {} };
      if (f.affectionNeglect.seen[type]) return false;
      f.affectionNeglect.seen[type] = true;
      return true;
    };
    const lose = (type, perHour) => {
      const remember = once(type);
      loseAffection(f, type, perHour * hours, remember);
    };
    if (f.hunger < 0.15) lose("hungry", AFFECTION_NEGLECT.hungry);
    if (typeof f.warmth === "number" && f.warmth < 0.3) lose("cold", AFFECTION_NEGLECT.cold);
    // Shut in a cage (not a foal can) for hours on end
    const caged = f.currentCage && !(typeof FoalInACan !== "undefined" && f.currentCage instanceof FoalInACan);
    if (caged) {
      if (typeof f._cagedSince !== "number") f._cagedSince = now;
      if (now - f._cagedSince > AFFECTION_CAGE_HOURS * (typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50)) {
        lose("caged", AFFECTION_NEGLECT.caged);
      }
    } else f._cagedSince = null;
    // Nothing nice from you for days: it misses you
    const dayLen = typeof DAY_LENGTH === "number" ? DAY_LENGTH : 1200;
    if (now - f.lastKindnessAt > AFFECTION_MISS_DAYS * dayLen && f.playerTrust > AFFECTION_MISS_FLOOR) {
      const before = f.playerTrust;
      const remember = once("missed");
      f.playerTrust = Math.max(AFFECTION_MISS_FLOOR, f.playerTrust - AFFECTION_NEGLECT.missed * hours);
      if (remember) rememberPlayerEvent(f, "missed");
      onAffectionChanged(f, before);
    }
    // Loves you: happier with you around, and says so now and then
    if (lovesYou(f) && f.scene === currentScene && f.currentStateKey !== "SLEEPING") {
      if (f.happiness < 1) f.changeHappiness(0.0005 * step);
      if (typeof f._nextLoveTalk !== "number") f._nextLoveTalk = now + 60 + Math.random() * 180;
      if (now >= f._nextLoveTalk) {
        f._nextLoveTalk = now + 150 + Math.random() * 200;
        if (!f.tooYoungToSpeak() && !f.isSmarty()) f.speak(getDialogue(["TRUST", "LOVE"], f));
      }
    }
  }
}
registerSystem("affection", updateAffection, 135);

// ---- Little hearts ----

function _popClock() {
  return typeof gameTimeMs === "function" ? gameTimeMs() : Date.now();
}

function drawAffectionPops(ctx) {
  if (!affectionPops.length) return;
  const now = _popClock();
  affectionPops = affectionPops.filter((p) => now - p.born < 1400);
  ctx.save();
  ctx.textAlign = "center";
  for (const p of affectionPops) {
    if (p.scene !== currentScene) continue;
    const f = fluffies.find((x) => x.id === p.id);
    const x = f ? f.x : p.x;
    const y = (f ? f.y : p.y) - 70 - 50 * (p.growth || 1);
    const k = (now - p.born) / 1400;
    ctx.globalAlpha = Math.max(0, 1 - k * k);
    ctx.font = `bold ${Math.round(26 + 8 * Math.sin(Math.min(1, k * 3) * Math.PI))}px Arial`;
    ctx.fillStyle = p.good ? "#ff5d8f" : "#6f7a8f";
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 3;
    const ty = y - k * 40;
    ctx.strokeText("♥", x, ty);
    ctx.fillText("♥", x, ty);
    if (!p.good) {
      // a crack through the broken heart
      ctx.strokeStyle = "#1c1f28";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 1, ty - 20);
      ctx.lineTo(x + 3, ty - 12);
      ctx.lineTo(x - 3, ty - 7);
      ctx.lineTo(x + 1, ty);
      ctx.stroke();
    }
  }
  ctx.restore();
}
