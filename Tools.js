// ---------------------------------------------------------------------------
// Harsher tools (plan batch 4): forever foals, mouth surgery, the
// auto-amputator, spinning, poisoned food, and talking to them.
//
// FOREVER FOALS: right-click a foal of yours (or Actions): "Stay little"
// ($STAY_LITTLE_COST a dose, a day each) - a stay-little formula. While
// it's dosed it doesn't grow, kept away from grown fluffies other than its
// mum (any other grown one in the room halves the effect). Every day kept
// little it's worth more to some buyers (FOREVER_PREMIUM a day, up to
// FOREVER_PREMIUM_MAX) and more dependent. Stop, and it grows up: if it was
// kept little FOREVER_CONFUSED_DAYS or more, it grows up confused and timid.
// Saved: f.stayLittle = { until, days }, f.wasForeverFoal.
//
// MOUTH SURGERY: on the surgery chart's part list: Teeth (pull) - kibble
// hurts to eat from then on (it eats it only when really hungry, and it
// hurts); sketties, formula, grass and berries are fine - and Tongue - it
// can't talk any more, only cry. Saved: f.toothless, f.tongueless.
//
// THE AUTO-AMPUTATOR (Hardware, $AMPUTATOR_PRICE): a machine. Right-click a
// fluffy of yours in the same room (or Actions): "Amputator" - it's put in,
// and every leg, wing and the horn come off in one go (the knife's cut on
// each: bleeding, shock, the same as by hand). Long-press/right-click the
// machine says what it does.
//
// SPINNING: pick a fluffy up and swing the mouse (or your finger) round in
// circles - SPIN_TURNS turns in a few seconds and it's spun: dizzy for a
// while (it staggers), it cries, it may be sick, and it remembers.
//
// POISONED FOOD: pour rat poison into a bowl that already has food in it
// (kibble, sketties, Scrapz) and it's mixed in: it looks and smells like the
// food, so they eat it without noticing (Rat poison: slow, and fatal).
// Anyone who sees one of them sick or dying of it learns to fear that bowl
// and won't eat from it (unless starving). The poison's gone when the bowl
// is empty. Saved: bowl.poisoned, f.fearedBowls.
//
// TALKING TO THEM: right-click a fluffy of yours (or Actions): "Talk" - pick
// what you say:
//   Tell it what it did wrong   just after a misdeed: the lesson sinks in
//                               better than a scolding (TALK_LESSON x); for
//                               nothing it's confused and sad
//   Bad fluffy!                 shames it: sad, a little afraid of you
//   Cruel words                 hurts it: much sadder, afraid of you, a step
//                               towards Broken (Titles.js), and it may cry
//                               itself to sleep tonight
// ---------------------------------------------------------------------------

const STAY_LITTLE_COST = 8;
const FOREVER_PREMIUM = 0.1;
const FOREVER_PREMIUM_MAX = 0.6;
const FOREVER_CONFUSED_DAYS = 2;
const AMPUTATOR_PRICE = 900;
const SPIN_TURNS = 3;
const SPIN_WINDOW = 4; // real seconds
const SPIN_DIZZY = 30; // game seconds
const TALK_LESSON = 1.5;
const TALK_REST = 20; // game seconds between talks

if (typeof MEMORY_TEXT !== "undefined") {
  Object.assign(MEMORY_TEXT, { spun: "Spun round and round by you", amputator: "Put in the amputator", cruel_words: "Cruel words from you", bad_fluffy: "Called a bad fluffy" });
}
if (typeof MEMORY_HARM_TYPES !== "undefined") for (const k of ["spun", "amputator", "cruel_words"]) MEMORY_HARM_TYPES.add(k);
if (typeof FEAR_FROM_WEAPON !== "undefined") Object.assign(FEAR_FROM_WEAPON, { spun: 0.12, amputator: 0.6 });

function _toName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Fluffy";
}
function _toSay(f, keys, force = true) {
  if (f && f.isAlive && !f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(keys, f), force);
}
function _toPay(cost) {
  if (typeof showDebugMenu !== "undefined" && showDebugMenu) return true;
  if (money < cost) {
    if (typeof addUIMessage === "function") addUIMessage(`Not enough money ($${cost}).`);
    return false;
  }
  money -= cost;
  return true;
}

// ---- Forever foals ----

function stayLittleActive(f) {
  const s = f && f.stayLittle;
  return !!(s && typeof s.until === "number" && timePlayed < s.until && s.until - timePlayed <= DAY_LENGTH + 1);
}

function canStayLittle(f) {
  return !!f && f.isAlive && f.adopted && f.growth < 0.9 && f.growth >= CHIRPY_THRESHOLD && !stayLittleActive(f);
}

function giveStayLittle(f) {
  if (!canStayLittle(f) || !_toPay(STAY_LITTLE_COST)) return false;
  const days = (f.stayLittle && f.stayLittle.days) || 0;
  f.stayLittle = { until: timePlayed + DAY_LENGTH, days };
  if (typeof addUIMessage === "function") addUIMessage(`${_toName(f)} had its stay-little formula: it won't grow for a day.`);
  return true;
}

// HorseUpdate._updateGrowingUp: x how fast it grows (0 = not at all)
function stayLittleGrowth(f) {
  if (!stayLittleActive(f)) return 1;
  // (who's near is looked at every couple of seconds, not every step)
  const c = f._slNear;
  if (!c || timePlayed - c.at >= 2 || timePlayed < c.at) {
    const near = fluffies.some((o) => o !== f && o.isAlive && o.growth >= 1 && o.scene === f.scene && o.id !== f.motherId && Math.hypot(o.x - f.x, o.y - f.y) < 400);
    f._slNear = { at: timePlayed, near };
  }
  return f._slNear.near ? 0.5 : 0;
}

const foreverTicker = new Ticker(10);
function updateForeverFoals(dt) {
  const step = foreverTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  for (const f of fluffies) {
    if (!f.isAlive || !f.stayLittle) continue;
    if (stayLittleActive(f)) f.stayLittle.days = (f.stayLittle.days || 0) + step / DAY_LENGTH;
    if (f.growth >= 1 && !f.wasForeverFoal) {
      const days = f.stayLittle.days || 0;
      f.wasForeverFoal = true;
      f.stayLittle = null;
      if (days >= FOREVER_CONFUSED_DAYS) {
        if (!f.traitShift || typeof f.traitShift !== "object") f.traitShift = {};
        f.traitShift.bravery = Math.max(-0.6, (f.traitShift.bravery || 0) - 0.3);
        f.changeHappiness(-0.2, "Grew up confused");
        _toSay(f, ["FOREVER_FOAL", "GREW_UP"]);
        if (typeof recordStory === "function") recordStory("turning", f, { x: `Kept a baby for ${Math.round(days)} days, ${_toName(f)} grew up confused and timid.` });
      }
    }
  }
}
registerSystem("foreverFoals", updateForeverFoals, 138);

// HorseGenetics price: a premium for a forever foal
function foreverFoalPriceMultiplier(f) {
  if (!f || f.growth >= 1 || !f.stayLittle) return 1;
  return 1 + Math.min(FOREVER_PREMIUM_MAX, FOREVER_PREMIUM * (f.stayLittle.days || 0));
}

function describeForeverFoal(f) {
  if (!f) return null;
  if (f.stayLittle && f.growth < 1) return [`Kept little ${Math.floor(f.stayLittle.days || 0)} day(s)${stayLittleActive(f) ? " (dosed today)" : " (needs its formula)"}`, "bad"];
  if (f.wasForeverFoal) return ["Was kept a baby", "bad"];
  return null;
}

// ---- Mouth surgery ----

if (typeof SURGERY_PARTS !== "undefined") {
  const body = SURGERY_PARTS.body;
  delete SURGERY_PARTS.body;
  SURGERY_PARTS.teeth = { label: "Teeth (pull)", has: (f) => !f.toothless };
  SURGERY_PARTS.tongue = { label: "Tongue", has: (f) => !f.tongueless };
  SURGERY_PARTS.body = body;
}

// Surgery.surgeryCut, after the knife's cut
function onMouthSurgery(f, id) {
  if (id === "teeth") {
    f.toothless = true;
    _toSay(f, ["MOUTH", "TEETH"]);
  } else if (id === "tongue") {
    f.tongueless = true;
    f.speak(getDialogue(["MOUTH", "TONGUE"], f), true, true);
  }
}

// HorseTalk.speak: no tongue, no words - only crying
function tonguelessSpeech(f, text) {
  const cries = ["*cries*", "Mmmh! Mmmh!", "*sob*", "Hhhuuu...", "*whimper*", "Aaah... aah..."];
  if (/♪/.test(String(text))) return "*hums, wordless*";
  return cries[Math.floor(Math.random() * cries.length)];
}

const SOFT_FOODS = new Set(["sketties", "formula", "grass", "berries"]);
// HorseUpdate eating: kibble hurts with no teeth - only when really hungry
function toothlessRefuses(f, foodType) {
  if (!f.toothless || SOFT_FOODS.has(foodType)) return false;
  return (f.hunger ?? 1) > 0.25;
}
function toothlessAte(f, foodType) {
  if (!f.toothless || SOFT_FOODS.has(foodType)) return;
  f.changeHappiness(-0.04, "Kibble hurts its gums");
  if (Math.random() < 0.4) _toSay(f, ["MOUTH", "KIBBLE_HURTS"]);
}

// ---- The auto-amputator ----

class AutoAmputator {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this._run = 0;
  }
  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = Math.max(mouse.y + this.dragOffset.y, sceneTop(this.scene) + 10);
    }
    if (this._run > 0) this._run = Math.max(0, this._run - dt);
  }
  onDrop() {
    return handleDropping(this);
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  getBottomY() {
    return this.y;
  }
  hitTest(px, py) {
    return px >= this.x - 50 && px <= this.x + 50 && py >= this.y - 70 && py <= this.y + 4;
  }
  serialize() {
    return { classType: "AutoAmputator", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: null };
  }
  deserialize() {}
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    drawAmputatorShape(ctx, this.x, this.y, 1, this._run > 0);
  }
}

function drawAmputatorShape(c, x, y, k = 1, running = false) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.strokeStyle = "#222";
  c.lineWidth = 2;
  c.fillStyle = "#8d9399";
  roundRectPath(c, -50, -40, 100, 38, 6);
  c.fill();
  c.stroke();
  // Clamps
  c.fillStyle = running ? "#d9534f" : "#5b6168";
  for (const cx of [-34, -12, 12, 34]) {
    c.fillRect(cx - 5, -52, 10, 14);
    c.strokeRect(cx - 5, -52, 10, 14);
  }
  // Blade arms
  c.strokeStyle = running ? "#ffdddd" : "#ccd";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-46, -62);
  c.lineTo(-30, -44);
  c.moveTo(46, -62);
  c.lineTo(30, -44);
  c.stroke();
  c.fillStyle = "#222";
  c.font = "bold 9px Arial";
  c.textAlign = "center";
  c.fillText("AUTO-AMP", 0, -16);
  c.restore();
}

function amputatorNear(f) {
  return typeof objects !== "undefined" ? objects.find((o) => o instanceof AutoAmputator && o.scene === f.scene) || null : null;
}

const AMPUTATOR_PARTS = ["leg_0", "leg_1", "leg_2", "leg_3", "leftWing", "rightWing", "horn"];

function amputatorParts(f) {
  return AMPUTATOR_PARTS.filter((p) => typeof surgeryPartPresent === "function" && surgeryPartPresent(f, p));
}

function runAmputator(f, machine = amputatorNear(f)) {
  if (!f || !f.isAlive || !machine || !amputatorParts(f).length) return false;
  f.isDragging = false;
  f.placedOn = null;
  f.x = machine.x;
  f.y = machine.y - 30;
  machine._run = 3;
  const blade = { type: "knife", whackTimer: 0 };
  let n = 0;
  for (const p of amputatorParts(f)) {
    if (!f.isAlive) break;
    knifeCut(f, p, blade);
    n++;
  }
  if (typeof playSound === "function") playSound("amputation");
  if (f.isAlive) {
    if (typeof f.setShock === "function") f.setShock(3);
    if (typeof rememberPlayerEvent === "function") rememberPlayerEvent(f, "amputator");
    f.speak(getDialogue(["AMPUTATOR", "AFTER"], f), true, true);
  }
  if (typeof addUIMessage === "function") addUIMessage(f.isAlive ? `The auto-amputator took ${n} part${n === 1 ? "" : "s"} off ${_toName(f)}. It's bleeding badly.` : `${_toName(f)} didn't survive the auto-amputator.`);
  return true;
}

function openAmputator(m) {
  if (typeof openChoice !== "function") return false;
  return openChoice({
    title: "Auto-amputator",
    lines: ["Right-click (or long-press) a fluffy of yours in this room: \"Amputator\".", "Every leg, wing and the horn come off in one go - bleeding and shock as by hand."],
    buttons: [{ label: "Close", cancel: true, run: () => {} }],
  });
}

// ---- Spinning ----

let _spin = null; // { id, last: {x, y}, angle, dir, total, t0 }

function _spinReset(f) {
  _spin = { id: f.id, prev: null, dirPrev: null, total: 0, t0: performance.now() };
}

// Every frame (a system): is the fluffy in your hand being swung round?
function updateSpinning(dt) {
  if (typeof fluffies === "undefined") return;
  const f = fluffies.find((x) => x.isDragging && x.isAlive);
  if (!f) {
    _spin = null;
    return;
  }
  if (!_spin || _spin.id !== f.id) _spinReset(f);
  const now = performance.now();
  if (now - _spin.t0 > SPIN_WINDOW * 1000) _spinReset(f);
  const p = { x: mouse.x, y: mouse.y };
  if (_spin.prev) {
    const dx = p.x - _spin.prev.x;
    const dy = p.y - _spin.prev.y;
    if (Math.hypot(dx, dy) >= 6) {
      const dir = Math.atan2(dy, dx);
      if (_spin.dirPrev !== null) {
        let d = dir - _spin.dirPrev;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        _spin.total += d;
      }
      _spin.dirPrev = dir;
      _spin.prev = p;
    }
  } else _spin.prev = p;
  if (Math.abs(_spin.total) >= SPIN_TURNS * 2 * Math.PI) {
    spinFluffy(f);
    _spinReset(f);
  }
}
registerSystem("spinning", updateSpinning, 139);

function spinFluffy(f) {
  if (!f || !f.isAlive) return false;
  f.dizzyUntil = timePlayed + SPIN_DIZZY;
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 3;
  f.changeHappiness(-0.06, "Spun round and round");
  _toSay(f, ["SPUN"]);
  if (Math.random() < 0.4 && typeof f.triggerVomit === "function") f.triggerVomit();
  if (typeof notePlayerViolence === "function") notePlayerViolence(f, false, "spun", false, false);
  if (typeof noteTitleHarm === "function") noteTitleHarm(f, 0.3, "spun");
  return true;
}

function isDizzy(f) {
  return !!f && typeof f.dizzyUntil === "number" && timePlayed < f.dizzyUntil && f.dizzyUntil - timePlayed <= SPIN_DIZZY + 1;
}

// Staggering about while dizzy (a desire)
class DizzyDesire extends Desire {
  constructor() {
    super("Dizzy");
  }
  evaluate(h) {
    if (!isDizzy(h) || h.isDragging || h.placedOn || h.currentCage) return 0;
    return 78;
  }
  execute(h) {
    if (!h.isMovingOrRunning() || Math.random() < 0.05) {
      h.initBehavior("MOVING");
      h.setTargetPosition(h.x + (Math.random() - 0.5) * 120, h.y + (Math.random() - 0.5) * 50);
    }
    h.facingRight = Math.random() < 0.5 ? h.facingRight : !h.facingRight;
    return true;
  }
}

// ---- Poisoned food ----

// Bowl.fill: rat poison into a bowl that has food in it mixes in
function mixPoison(bowl, foodType) {
  if (foodType !== "rat_poison" || !bowl || !(bowl.food > 0) || !bowl.foodType || bowl.foodType === "rat_poison" || bowl.foodType === "formula") return false;
  bowl.poisoned = true;
  return true;
}

// HorseUpdate eating: it ate from a poisoned bowl
function atePoisonedFood(f, bowl, wasPoisoned = false) {
  if (!bowl || !(bowl.poisoned || wasPoisoned)) return;
  f.isPoisoned = true;
  if (f.renderer) f.renderer.tinted = null;
  f.vomitTimer = 6 + Math.random() * 8;
  f._poisonBowlId = bowl.id;
  if (!(bowl.food > 0)) bowl.poisoned = false;
}

// It's sick from it (Horse.triggerVomit) or dying of it: witnesses fear that bowl
function poisonWitnessed(f) {
  const id = f && f._poisonBowlId;
  if (id === undefined || id === null) return;
  for (const o of fluffies) {
    if (o === f || !o.isAlive || o.scene !== f.scene || o.currentStateKey === "SLEEPING" || !(o.canSee && o.canSee())) continue;
    if (Math.hypot(o.x - f.x, o.y - f.y) > 450) continue;
    if (!Array.isArray(o.fearedBowls)) o.fearedBowls = [];
    if (!o.fearedBowls.includes(id)) {
      o.fearedBowls.push(id);
      if (o.fearedBowls.length > 6) o.fearedBowls.shift();
      if (Math.random() < 0.4) _toSay(o, ["POISON", "WITNESS"], false);
    }
  }
}

// HorseUpdate eating: won't touch a bowl it saw make someone sick (unless starving)
function fearsBowl(f, bowl) {
  return !!(bowl && Array.isArray(f.fearedBowls) && f.fearedBowls.includes(bowl.id) && (f.hunger ?? 1) > 0.1);
}

// ---- Talking to them ----

function canTalkTo(f) {
  return !!f && f.isAlive && f.adopted && f.currentStateKey !== "SLEEPING" && f.canHear && f.canHear() && !(typeof f._talkAt === "number" && timePlayed >= f._talkAt && timePlayed - f._talkAt < TALK_REST);
}

function openTalk(f) {
  if (!canTalkTo(f) || typeof openChoice !== "function") return false;
  const m = typeof recentMisdeed === "function" ? recentMisdeed(f) : null;
  return openChoice({
    title: `Talk to ${_toName(f)}`,
    lines: [m ? `It's just done something wrong (${(typeof MISDEED_WORDS !== "undefined" && MISDEED_WORDS[m]) || m}).` : "It hasn't done anything wrong just now."],
    buttons: [
      { label: "Tell it what it did wrong", run: () => talkTo(f, "explain") },
      { label: "Bad fluffy!", kind: "danger", run: () => talkTo(f, "bad") },
      { label: "Cruel words", kind: "danger", run: () => talkTo(f, "cruel") },
      { label: "Never mind", cancel: true, run: () => {} },
    ],
  });
}

function talkTo(f, how) {
  if (!f || !f.isAlive) return null;
  f._talkAt = timePlayed;
  const m = typeof recentMisdeed === "function" ? recentMisdeed(f) : null;
  if (how === "explain") {
    if (m && typeof scoldLesson === "function") {
      // A telling-off it understands: the lesson, half again
      scoldLesson(f, m);
      if (Math.random() < TALK_LESSON - 1 && typeof scoldLesson === "function") scoldLesson(f, m);
      if (m === "mischief") f._nextMischief = timePlayed + 1.5 * DAY_LENGTH;
      if (m === "accident") f.pottyTraining = Math.min(1, (f.pottyTraining || 0) + 0.08);
      if (m === "fight" && f.isSmarty && f.isSmarty()) f.smartyReform = Math.min(0.95, (f.smartyReform || 0) + 0.04);
      f.changeHappiness(-0.02, "Told off");
      _toSay(f, ["TALK", "EXPLAINED"]);
      return "lesson";
    }
    f.changeHappiness(-0.04, "Told off for nothing");
    _toSay(f, ["TALK", "CONFUSED"]);
    return "confused";
  }
  if (how === "bad") {
    f.changeHappiness(-0.08, "Called a bad fluffy");
    if (typeof changePlayerFear === "function") changePlayerFear(f, 0.03);
    if (typeof loseAffection === "function") loseAffection(f, "bad_fluffy", 0.02, false);
    if (typeof rememberPlayerEvent === "function") rememberPlayerEvent(f, "bad_fluffy");
    if (m && typeof scoldLesson === "function") scoldLesson(f, m);
    f.expressionOverride = "MISERABLE";
    f.expressionOverrideTimer = 3;
    _toSay(f, ["TALK", "BAD_FLUFFY"]);
    return "shamed";
  }
  // Cruel words
  f.changeHappiness(-0.18, "Cruel words");
  if (typeof changePlayerFear === "function") changePlayerFear(f, 0.08);
  if (typeof loseAffection === "function") loseAffection(f, "cruel_words", 0.06, false);
  if (typeof rememberPlayerEvent === "function") rememberPlayerEvent(f, "cruel_words");
  if (typeof noteTitleHarm === "function") noteTitleHarm(f, 0.6, "cruel_words");
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 4;
  f._criedTonight = typeof getDayNumber === "function" ? getDayNumber() : 0;
  _toSay(f, ["TALK", "CRUEL"]);
  if (typeof fluffySound === "function") fluffySound(f, "sad");
  return "hurt";
}

// ---- Right-click ----

function toolActions(f) {
  if (!f || !f.isAlive || !f.adopted) return [];
  const out = [];
  if (canStayLittle(f)) out.push({ key: "stay_little", name: "Stay little", sub: `formula $${STAY_LITTLE_COST}`, harsh: true, run: (x) => giveStayLittle(x) });
  if (amputatorNear(f) && amputatorParts(f).length) out.push({ key: "amputator", name: "Amputator", sub: "every limb", harsh: true, run: (x) => runAmputator(x) });
  if (canTalkTo(f)) out.push({ key: "talk", name: "Talk", sub: "pick your words", run: (x) => openTalk(x) });
  return out;
}

// Magnifying glass: [text, tone] or null
function describeMouth(f) {
  if (!f || (!f.toothless && !f.tongueless)) return null;
  const parts = [];
  if (f.toothless) parts.push("no teeth: kibble hurts");
  if (f.tongueless) parts.push("no tongue: can't talk");
  return [parts.join(" · "), "bad"];
}
function describeDizzy(f) {
  return isDizzy(f) ? ["Dizzy (spun round)", "bad"] : null;
}

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({
    name: "Auto-amputator",
    desc: "Takes every leg, wing and the horn off a fluffy in one go. Right-click (or long-press) a fluffy of yours in the same room: Amputator. It bleeds and goes into shock, as by hand.",
    cost: AMPUTATOR_PRICE,
    isItem: "auto_amputator",
  });
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push({
    sellType: "auto_amputator",
    is: (o) => o instanceof AutoAmputator,
    hitTest: (o, x, y) => o.hitTest(x, y),
    sellable: true,
    create: (a, sx, sy) => {
      const m = new AutoAmputator(currentScene);
      m.setPosition(sx, sy);
      return m;
    },
    drawIcon: (ctx) => drawAmputatorShape(ctx, 0, 24, 0.36),
    onRightClick: (o) => openAmputator(o),
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.AutoAmputator = (d) => new AutoAmputator(d.scene);
