// ---------------------------------------------------------------------------
// Rough handling and hard tools (plan round 8): shaking, the wall hook and
// the hook pole, the hot plate, the defibrillator and the lethal injection.
//
// SHAKING: hold a fluffy and shake the mouse (or your finger) back and forth
// hard - SHAKE_SWINGS swings inside SHAKE_WINDOW - and it's shaken: dizzy a
// while, frightened of you, it may wet itself or be sick, and it remembers
// ("shaken").
//
// THE WALL HOOK (Hardware, HOOK_PRICE): put it up, then set a fluffy down on
// it and it hangs there by its tail: it struggles and cries, loses
// happiness (HOOK_SAD) and some health (HOOK_HURT) while it hangs, and
// remembers. Everyone who sees it hanging learns to fear the hook (FEARS
// "hook"); one that fears it is frightened when it goes near. Take it down
// by picking it up.
// THE HOOK POLE (Hardware, a tool): click a bed, box or litterbox a mum has
// hidden a foal in (Snitch.js) and it's dragged out - roughly: it hurts
// (POLE_HURT) and scares it, and the mum blames you.
//
// THE HOT PLATE (Hardware, HOT_PLATE_PRICE): right-click to switch on. Set a
// fluffy down on it, or hold one against it: it burns (BURN_HURT, a burn
// scar), it leaps off screaming, and the burn heals slowly
// (f.burned = { until }, saved: sore, slower, sadder - the vet can dress it).
// Anyone watching learns to fear fire; it fears fire most of all.
//
// THE DEFIBRILLATOR (Pharmacy & Lab, DEFIB_PRICE, a tool): click a grown
// fluffy that died within DEFIB_WINDOW game seconds (whole, not ground up)
// and it may come back (DEFIB_CHANCE): weak (DEFIB_HEALTH), shaken, and it
// remembers what nearly killed it (f.nearDeath, saved).
//
// THE LETHAL INJECTION (Pharmacy & Lab, an IV bag for the syringe): a dose
// of LETHAL_DOSE or more and it gets sleepy and dies quietly a little later
// (LETHAL_TIME). Those watching are sad, but it isn't violence: no fear of
// you, no fright.
// ---------------------------------------------------------------------------

const SHAKE_SWINGS = 6;
const SHAKE_WINDOW = 1.6; // real seconds
const SHAKE_MIN = 18; // px a swing
const SHAKE_DIZZY = 15; // game seconds
const HOOK_PRICE = 120;
const HOOK_SAD = 0.3; // happiness a game hour
const HOOK_HURT = 4; // health a game hour
const HOOK_SEEN_FEAR = 0.25;
const HOOK_NEAR = 140;
const POLE_PRICE = 60;
const POLE_HURT = 6;
const HOT_PLATE_PRICE = 80;
const BURN_HURT = 15;
const BURN_HEAL = 1.5 * DAY_LENGTH; // game seconds
const BURN_SAD = 0.06;
const DEFIB_PRICE = 1200;
const DEFIB_WINDOW = 12; // game seconds after death
const DEFIB_CHANCE = 0.7;
const DEFIB_HEALTH = 15;
const LETHAL_DOSE = 5;
const LETHAL_TIME = 8; // game seconds
const handlingTicker = new Ticker(1);

if (typeof MEMORY_TEXT !== "undefined") Object.assign(MEMORY_TEXT, { shaken: "Shaken hard", hook: "Hung on the hook", hook_pole: "Dragged out with the hook pole", hot_plate: "Burnt on the hot plate" });
if (typeof MEMORY_HARM_TYPES !== "undefined") for (const k of ["shaken", "hook", "hook_pole", "hot_plate"]) MEMORY_HARM_TYPES.add(k);
if (typeof FEAR_FROM_WEAPON !== "undefined") Object.assign(FEAR_FROM_WEAPON, { shaken: 0.08, hook: 0.35, hook_pole: 0.15, hot_plate: 0.4 });
if (typeof FEARS !== "undefined" && !FEARS.some((x) => x.key === "hook")) FEARS.push({ key: "hook", name: "the hook", learnt: true });
if (typeof FRIGHT_TIME !== "undefined") FRIGHT_TIME.hook = 12;
if (typeof FRIGHT_REST !== "undefined") FRIGHT_REST.hook = 120;

function _hSay(f, keys, force = true) {
  if (f && f.isAlive && !f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(keys, f), force);
}

// ---- Shaking ----
let _shake = null; // { id, last, dir, swings: [times], from }

function updateShaking() {
  if (typeof fluffies === "undefined" || typeof mouse === "undefined") return;
  const f = fluffies.find((x) => x.isDragging && x.isAlive && !x.heldWithThrowTool);
  if (!f) {
    _shake = null;
    return;
  }
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!_shake || _shake.id !== f.id) _shake = { id: f.id, from: mouse.x, dir: 0, swings: [] };
  const dx = mouse.x - _shake.from; // (from: the far end of this swing)
  if (!_shake.dir) {
    if (Math.abs(dx) >= SHAKE_MIN) {
      _shake.dir = Math.sign(dx);
      _shake.from = mouse.x;
    }
  } else if (Math.sign(dx) === _shake.dir) _shake.from = mouse.x;
  else if (Math.abs(dx) >= SHAKE_MIN) {
    _shake.swings.push(now);
    _shake.dir = -_shake.dir;
    _shake.from = mouse.x;
  }
  _shake.swings = _shake.swings.filter((t) => now - t < SHAKE_WINDOW * 1000);
  if (_shake.swings.length >= SHAKE_SWINGS) {
    shakeFluffy(f);
    _shake.swings = [];
  }
}
registerSystem("shaking", updateShaking, 139.5);

function shakeFluffy(f) {
  if (!f || !f.isAlive) return false;
  f.dizzyUntil = Math.max(f.dizzyUntil || 0, timePlayed + SHAKE_DIZZY);
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 3;
  f.changeHappiness(-0.05, "Shaken hard");
  _hSay(f, ["SHAKEN"]);
  // It may wet itself, or be sick
  if (Math.random() < 0.45 && typeof f.excrete === "function") f.excrete("pee", Math.max(0.15, f.peeStorage || 0.2));
  else if (Math.random() < 0.3 && typeof f.triggerVomit === "function") f.triggerVomit();
  if (typeof notePlayerViolence === "function") notePlayerViolence(f, false, "shaken", false, false);
  if (typeof noteTitleHarm === "function") noteTitleHarm(f, 0.2, "shaken");
  return true;
}

// ---- The wall hook ----
class WallHook {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.securedFluffy = null;
    this.holdsFluffy = true;
    this.bounds = { left: 0, right: 0, top: 0, bottom: 0 };
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x;
      this.y = Math.max(mouse.y, sceneTop(this.scene) + 20);
    }
    this.bounds = { left: this.x - 20, right: this.x + 20, top: this.y - 30, bottom: this.y + 30 };
    const f = this.securedFluffy;
    if (f && (f.placedOn !== this || !fluffies.includes(f) || f.scene !== this.scene)) this.securedFluffy = null;
  }
  // Horse.onDrop: set down close enough to the hook
  catchesFluffy(f) {
    if (this.securedFluffy || this.isDragging) return false;
    return Math.abs(f.x - this.x) < 50 && f.y > this.y - 40 && f.y < this.y + 140;
  }
  lockPosition(f) {
    f.x = this.x;
    f.y = this.y + 30 + 80 * (f.scale || 0.5);
    f.vx = 0;
    f.vy = 0;
  }
  releaseFluffy() {
    if (this.securedFluffy && this.securedFluffy.placedOn === this) this.securedFluffy.placedOn = null;
    this.securedFluffy = null;
  }
  onDrop() {
    return handleDropping(this);
  }
  hitTest(px, py) {
    return Math.abs(px - this.x) < 16 && py > this.y - 22 && py < this.y + 22;
  }
  getBottomY() {
    return this.y + 10;
  }
  serialize() {
    return { classType: "WallHook", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: null };
  }
  deserialize() {}
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    drawHookShape(ctx, this.x, this.y, 1);
  }
}

function drawHookShape(c, x, y, k = 1) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.fillStyle = "#6f7880";
  c.fillRect(-10, -20, 20, 12);
  c.strokeStyle = "#3d4248";
  c.lineWidth = 1.5;
  c.strokeRect(-10, -20, 20, 12);
  c.strokeStyle = "#9aa3ab";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(0, -8);
  c.lineTo(0, 8);
  c.arc(-6, 8, 6, 0, Math.PI, false);
  c.stroke();
  c.restore();
}

function hookedOn(f) {
  return !!(f && typeof WallHook !== "undefined" && f.placedOn instanceof WallHook);
}

// ---- The hook pole ----
class HookPole {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }
  update() {
    if (this.isDragging) {
      this.x = mouse.x;
      this.y = mouse.y;
    }
  }
  // script.js attemptDrop: a click on a fluffy, or on a hiding place
  useOnFluffy(f) {
    return poleDragOut(f);
  }
  useOnEmpty() {
    return hookPoleClick();
  }
  onDrop() {
    return handleDropping(this);
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  hitTest(px, py) {
    return Math.abs(px - this.x) < 14 && py > this.y - 90 && py < this.y + 6;
  }
  getBottomY() {
    return this.y;
  }
  serialize() {
    return { classType: "HookPole", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: null };
  }
  deserialize() {}
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    const img = hookPoleImage();
    if (!img) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.isDragging) drawHeldTool(ctx, img, "hook_pole");
    else ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
if (typeof TOOL_GRIPS !== "undefined") TOOL_GRIPS.hook_pole = { ax: 0.2, ay: 0.95, turn: 0 };

function hookPoleImage() {
  if (typeof images === "undefined") return null;
  if (images.hook_pole) return images.hook_pole;
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 30;
  cv.height = 96;
  const c = cv.getContext("2d");
  if (!c) return null;
  c.strokeStyle = "#8a6a3e";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(20, 4);
  c.lineTo(8, 88);
  c.stroke();
  c.strokeStyle = "#9aa3ab";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(8, 88);
  c.quadraticCurveTo(2, 96, 12, 94);
  c.stroke();
  images.hook_pole = cv;
  return cv;
}

// A hidden foal under the click (its hiding place), or one clicked
function _poleHiddenAt(x, y) {
  return fluffies.find((f) => f.hiddenBy != null && f.scene === currentScene && (() => {
    const spot = objects.find((o) => o.id === f.hideSpot);
    return spot && Math.hypot(spot.x - x, (spot.y || 0) - y) < 70;
  })());
}

function poleDragOut(f) {
  if (!f || !f.isAlive) return false;
  const hidden = f.hiddenBy != null;
  if (hidden && typeof revealFoal === "function") revealFoal(f, "you");
  f.health = Math.max(1, f.health - POLE_HURT);
  f.changeHappiness(-0.06, "Dragged with the hook pole");
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 2.5;
  _hSay(f, ["HOOK", "POLE"]);
  if (typeof notePlayerViolence === "function") notePlayerViolence(f, false, "hook_pole", false, false);
  return true;
}

// script.js attemptDrop: the pole clicked on a hiding place (not a fluffy)
function hookPoleClick() {
  const pole = objects.find((o) => o instanceof HookPole && o.isDragging);
  if (!pole || mouse.rightDown) return false;
  const f = _poleHiddenAt(mouse.x, mouse.y);
  if (!f) return false;
  poleDragOut(f);
  return true;
}

// ---- The hot plate ----
class HotPlate {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.on = false;
    this.holdsFluffy = false;
    this._glow = 0;
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x;
      this.y = Math.max(mouse.y, sceneTop(this.scene) + 20);
    }
    this._glow += ((this.on ? 1 : 0) - this._glow) * Math.min(1, dt * 1.5);
  }
  // Horse.onDrop: set down on it while it's on
  catchesFluffy(f) {
    if (!this.on || !f.isAlive) return false;
    if (Math.abs(f.x - this.x) > 50 || Math.abs(f.y - this.y) > 40) return false;
    burnOnHotPlate(f, this);
    return true;
  }
  onDrop() {
    return handleDropping(this);
  }
  hitTest(px, py) {
    return Math.abs(px - this.x) < 46 && py > this.y - 30 && py < this.y + 10;
  }
  getBottomY() {
    return this.y + 8;
  }
  serialize() {
    return { classType: "HotPlate", id: this.id, x: this.x, y: this.y, scene: this.scene, on: this.on, currentCageId: null };
  }
  deserialize(d) {
    this.on = !!d.on;
  }
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    drawHotPlateShape(ctx, this.x, this.y, 1, this._glow);
  }
}

function drawHotPlateShape(c, x, y, k = 1, glow = 0) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.fillStyle = "#2f3337";
  c.fillRect(-44, -14, 88, 22);
  c.fillStyle = "#1c1f22";
  c.beginPath();
  c.ellipse(0, -14, 34, 9, 0, 0, Math.PI * 2);
  c.fill();
  const r = Math.round(60 + 195 * glow);
  c.strokeStyle = `rgb(${r}, ${Math.round(60 + 40 * glow)}, ${Math.round(60 - 20 * glow)})`;
  c.lineWidth = 2.5;
  for (const rr of [10, 18, 26]) {
    c.beginPath();
    c.ellipse(0, -14, rr, rr * 0.26, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = glow > 0.5 ? "#ff5a3c" : "#555";
  c.beginPath();
  c.arc(36, 0, 3, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function isBurned(f) {
  return !!(f && f.burned && typeof f.burned.until === "number" && timePlayed < f.burned.until && f.burned.until - timePlayed <= BURN_HEAL + 1);
}

function burnOnHotPlate(f, plate) {
  if (!f || !f.isAlive) return false;
  if (f._burntAt && timePlayed - f._burntAt < 2 && timePlayed >= f._burntAt) return false;
  f._burntAt = timePlayed;
  f.health = Math.max(1, f.health - BURN_HURT);
  f.burned = { until: timePlayed + BURN_HEAL };
  f.changeHappiness(-0.12, "Burnt on the hot plate");
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 4;
  _hSay(f, ["HOT_PLATE"]);
  if (typeof addScar === "function") addScar(f, "burn", "Burnt on the hot plate", { always: true });
  if (typeof learnFearOfFire === "function") learnFearOfFire(f);
  if (typeof notePlayerViolence === "function") notePlayerViolence(f, false, "hot_plate", false, false);
  if (typeof noteTitleHarm === "function") noteTitleHarm(f, 0.5, "hot_plate");
  // It leaps off
  if (!f.isDragging) {
    f.x = plate.x + (Math.random() < 0.5 ? -80 : 80);
    f.y = plate.y + 30;
    if (typeof f.initBehavior === "function") f.initBehavior("RUNNING");
  }
  return true;
}

// Horse.updateSpeed-like: sore and slow while the burn heals
function burnSpeed(f) {
  return isBurned(f) ? 0.8 : 1;
}

// ---- The defibrillator ----
class Defibrillator {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.readyAt = 0;
    this.useOnDead = true; // (script.js: it's for the dead)
  }
  update() {
    if (this.isDragging) {
      this.x = mouse.x;
      this.y = mouse.y;
    }
  }
  useOnFluffy(f) {
    return useDefibrillator(f, this);
  }
  onDrop() {
    return handleDropping(this);
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  hitTest(px, py) {
    return Math.abs(px - this.x) < 24 && py > this.y - 34 && py < this.y + 6;
  }
  getBottomY() {
    return this.y;
  }
  serialize() {
    return { classType: "Defibrillator", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: null };
  }
  deserialize() {}
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    const img = defibImage();
    if (!img) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.isDragging) drawHeldTool(ctx, img, "defibrillator");
    else ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
// (it isn't swallowed by the generic "attemptDrop" for any tool: useOnFluffy handles it, dead or alive)
if (typeof TOOL_GRIPS !== "undefined") TOOL_GRIPS.defibrillator = { ax: 0.5, ay: 0.85, turn: 0 };

function defibImage() {
  if (typeof images === "undefined") return null;
  if (images.defibrillator) return images.defibrillator;
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 46;
  cv.height = 40;
  const c = cv.getContext("2d");
  if (!c) return null;
  c.fillStyle = "#d84a3a";
  c.fillRect(2, 8, 42, 26);
  c.strokeStyle = "#7a231a";
  c.lineWidth = 2;
  c.strokeRect(2, 8, 42, 26);
  c.fillStyle = "#fff";
  c.fillRect(19, 13, 8, 16);
  c.fillRect(15, 17, 16, 8);
  c.fillStyle = "#333";
  c.fillRect(8, 34, 10, 5);
  c.fillRect(28, 34, 10, 5);
  images.defibrillator = cv;
  return cv;
}

function canDefibrillate(f) {
  return !!(f && !f.isAlive && !f.isDestroyed && f.growth >= 1 && (f.deathTimer || 0) <= DEFIB_WINDOW && f.limbs && f.deathWeapon !== "grinder");
}

function reviveFluffy(f, health = DEFIB_HEALTH) {
  f.isAlive = true;
  f.health = health;
  f.deathAnim = 0;
  f.deathSnapshot = null;
  f.deathTimer = 0;
  const cause = f.causeOfDeath;
  f.causeOfDeath = null;
  f.deathWeapon = null;
  f.bleedingTimer = 0;
  f.continuousTasedTimer = 0;
  f.continuousTasedSmokeTimer = 0;
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 3;
  if (f.speech) {
    f.speech.text = null;
    f.speech.timer = 0;
  }
  f.chaseTarget = null;
  f.cannibalTarget = null;
  if (f.hunger <= 0.1) f.hunger = 0.5;
  if (f.happiness <= WAN_DIE_THRESHOLD) f.happiness = WAN_DIE_THRESHOLD + 0.15;
  f.currentStateKey = "IDLE";
  if (f.renderer) f.renderer.tinted = null;
  if (typeof f.updateCrawling === "function") f.updateCrawling();
  if (typeof f.updateLayout === "function") f.updateLayout();
  return cause;
}

function useDefibrillator(f, defib) {
  const say = (m) => typeof addUIMessage === "function" && addUIMessage(m);
  if (f.isAlive) return say("It's alive - the paddles are for a heart that's stopped."), false;
  if (!canDefibrillate(f)) return say(f.growth < 1 ? "Too small for the paddles." : "Too late - it's been gone too long."), false;
  if (defib && timePlayed < (defib.readyAt || 0)) return say("Charging..."), false;
  if (defib) defib.readyAt = timePlayed + 3;
  if (typeof poofs !== "undefined" && typeof Poof !== "undefined") poofs.push(new Poof(f.x, f.y - 30, f.scene, "#fff6a0"));
  if (typeof playSound === "function") playSound("taser", 0.4, 1.2);
  if (Math.random() >= DEFIB_CHANCE) return say("Clear! ...nothing."), false;
  const cause = reviveFluffy(f);
  f.nearDeath = { cause: cause || "something", at: timePlayed };
  f.changeHappiness(-0.1, "Nearly died");
  if (typeof recordStory === "function") recordStory("turning", f, { x: `${fluffyDisplayName(f)} nearly died (${String(cause || "something").toLowerCase()}) and was brought back.` });
  _hSay(f, ["DEFIB"]);
  say(`${fluffyDisplayName(f)} is breathing again!`);
  return true;
}

function describeNearDeath(f) {
  if (!f || !f.nearDeath) return null;
  return [`Brought back from the dead (${String(f.nearDeath.cause).toLowerCase()})`, "bad"];
}

// ---- The lethal injection ----
if (typeof DRUG_COLORS !== "undefined") DRUG_COLORS.lethal = "#3b3b4f";
if (typeof DRUG_METABOLISM !== "undefined") {
  DRUG_METABOLISM.lethal = {
    rate: 0.3,
    color: "#3b3b4f",
    onApplication: (horse) => {
      if (typeof horse._lethalAt !== "number") horse._lethalAt = timePlayed;
    },
    effect: () => {},
  };
}

// ---- Every second ----
function updateHandling(dt) {
  const step = handlingTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const hours = step / HOUR_LENGTH;
  // Hanging on a hook
  for (const o of objects) {
    if (!(o instanceof WallHook)) continue;
    const f = o.securedFluffy;
    if (!f || f.placedOn !== o) continue;
    if (f.isAlive) {
      if (!f._hookedAt) {
        f._hookedAt = timePlayed;
        if (typeof notePlayerViolence === "function") notePlayerViolence(f, false, "hook", false, false);
        if (typeof noteTitleHarm === "function") noteTitleHarm(f, 0.4, "hook");
      }
      f.changeHappiness(-HOOK_SAD * hours, "Hung on the hook");
      f.health = Math.max(0, f.health - HOOK_HURT * hours);
      if (f.health <= 0 && typeof f.die === "function") f.die(null, "Left on the hook");
      f.expressionOverride = "CRYING_SHOCKED";
      f.expressionOverrideTimer = 1.5;
      if (Math.random() < 0.12 * step) _hSay(f, ["HOOK", "HANGING"], false);
    }
    // Who sees it learns to fear the hook
    for (const w of fluffies) {
      if (w === f || !w.isAlive || w.scene !== o.scene || w.currentStateKey === "SLEEPING" || !w.canSee()) continue;
      if (!w._hookSeen) w._hookSeen = {};
      if (w._hookSeen[f.id] === f._hookedAt) continue;
      w._hookSeen[f.id] = f._hookedAt;
      if (typeof changeFear === "function") changeFear(w, "hook", HOOK_SEEN_FEAR);
      if (Math.random() < 0.5) _hSay(w, ["HOOK", "SEEN"]);
    }
  }
  for (const f of fluffies) {
    if (f._hookedAt && !hookedOn(f)) f._hookedAt = null;
    if (!f.isAlive) continue;
    // Frightened near a hook it fears
    if (typeof fearOf === "function" && fearOf(f, "hook") >= 0.3 && !hookedOn(f) && f.currentStateKey !== "SLEEPING") {
      const near = objects.some((o) => o instanceof WallHook && o.scene === f.scene && Math.hypot(o.x - f.x, o.y + 60 - f.y) < HOOK_NEAR);
      if (near && Math.random() < 0.05 * step && typeof startFright === "function") startFright(f, "hook");
    }
    // A burn healing
    if (isBurned(f)) f.changeHappiness(-BURN_SAD * hours, "A burn healing");
    else if (f.burned && timePlayed >= f.burned.until) f.burned = null;
    // A lethal dose: sleepy, then gone
    if (typeof f._lethalAt === "number") {
      const dose = typeof f.getDrugAmount === "function" ? f.getDrugAmount("lethal") : 0;
      if (timePlayed - f._lethalAt >= LETHAL_TIME || timePlayed < f._lethalAt) {
        f._lethalAt = null;
        if (dose >= LETHAL_DOSE * 0.5 || f._lethalFull) {
          if (typeof f.die === "function") f.die(null, "Put to sleep");
          continue;
        }
      } else {
        if (dose >= LETHAL_DOSE) f._lethalFull = true;
        if (f.currentStateKey !== "SLEEPING" && typeof f.initBehavior === "function" && f._lethalFull) f.initBehavior("SLEEPING");
      }
    }
  }
  // Held against a hot plate
  for (const f of fluffies) {
    if (!f.isDragging || !f.isAlive) continue;
    const plate = objects.find((o) => o instanceof HotPlate && o.on && o.scene === f.scene && Math.abs(o.x - f.x) < 50 && Math.abs(o.y - f.y) < 45);
    if (plate) burnOnHotPlate(f, plate);
  }
}
registerSystem("handling", updateHandling, 142);

// ---- Menu, magnifying glass, vet ----
if (typeof INSPECT_ROWS !== "undefined") {
  INSPECT_ROWS.push(["Near death", "describeNearDeath"]);
  INSPECT_ROWS.push(["Burn", "describeBurn"]);
}
function describeBurn(f) {
  if (!isBurned(f)) return null;
  const hrs = Math.ceil((f.burned.until - timePlayed) / HOUR_LENGTH);
  return [`Healing slowly (${hrs >= 24 ? `${Math.ceil(hrs / 24)} days` : `${hrs} hours`} left)`, "bad"];
}
if (typeof EXTRA_VET_PROBLEMS !== "undefined") {
  EXTRA_VET_PROBLEMS.push({
    has: (f) => (isBurned(f) ? ["burns", 40] : null),
    cure: (f) => {
      if (f.burned) f.burned.until = timePlayed + (f.burned.until - timePlayed) / 3;
    },
  });
}

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push(
    { name: "Wall hook", desc: "Put it up and set a fluffy down on it: it hangs by its tail, struggling and crying. Those who see learn to fear the hook.", cost: HOOK_PRICE, isItem: "wall_hook" },
    { name: "Hook pole", desc: "Click a bed, box or litterbox where a mum has hidden a foal to drag it out. It hurts.", cost: POLE_PRICE, isItem: "hook_pole" },
    { name: "Hot plate", desc: "Right-click to switch on. Set a fluffy down on it (or hold one against it): a bad burn that heals slowly, and a lasting fear of fire.", cost: HOT_PLATE_PRICE, isItem: "hot_plate" },
    { name: "Defibrillator", desc: "Click a grown fluffy that's only just died: it may come back, weak, remembering what nearly killed it.", cost: DEFIB_PRICE, isItem: "defibrillator" },
    { name: "Lethal", desc: "A drug for the syringe: a full dose and the fluffy falls asleep and dies quietly a little later. Those watching are sad, but not frightened.", cost: 150, isItem: "iv_bag", bagType: "lethal" },
  );
}
if (typeof STORE_AISLES !== "undefined") {
  const hw = STORE_AISLES.find((a) => a.id === "hardware");
  if (hw) for (const k of ["wall_hook", "hook_pole", "hot_plate"]) if (!hw.items.includes(k)) hw.items.push(k);
  const ph = STORE_AISLES.find((a) => a.id === "pharmacy");
  if (ph && !ph.items.includes("defibrillator")) ph.items.push("defibrillator");
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push(
    {
      sellType: "wall_hook",
      is: (o) => o instanceof WallHook,
      inCage: "never",
      sellable: true,
      hitTest: (o, x, y) => o.hitTest(x, y),
      canPickUp: (o) => !o.securedFluffy,
      create: (a, sx, sy) => atSpot(new WallHook(currentScene), sx, sy),
      drawIcon: (ctx) => drawHookShape(ctx, 0, 6, 0.9),
    },
    {
      sellType: "hot_plate",
      is: (o) => o instanceof HotPlate,
      inCage: "never",
      sellable: true,
      hitTest: (o, x, y) => o.hitTest(x, y),
      create: (a, sx, sy) => atSpot(new HotPlate(currentScene), sx, sy),
      drawIcon: (ctx) => drawHotPlateShape(ctx, 0, 6, 0.35, 1),
      onRightClick: (o) => {
        o.on = !o.on;
        if (typeof addUIMessage === "function") addUIMessage(o.on ? "Hot plate on." : "Hot plate off.");
      },
    },
    {
      sellType: "hook_pole",
      is: (o) => o instanceof HookPole,
      inCage: "never",
      sellable: true,
      icon: "hook_pole",
      tool: {
        className: "HookPole",
        create: (scene) => new HookPole(scene),
        key: "hook_pole",
        name: "Hook pole",
        desc: "Click where a mum has hidden a foal (under a bed, in a box or litterbox) to drag it out. It hurts it.",
        image: () => hookPoleImage(),
      },
    },
    {
      sellType: "defibrillator",
      is: (o) => o instanceof Defibrillator,
      inCage: "never",
      sellable: true,
      icon: "defibrillator",
      tool: {
        className: "Defibrillator",
        create: (scene) => new Defibrillator(scene),
        key: "defibrillator",
        name: "Defib",
        fullName: "Defibrillator",
        desc: `Click a grown fluffy that died in the last few seconds: it may come back (${Math.round(DEFIB_CHANCE * 100)}%), weak.`,
        image: () => defibImage(),
      },
    },
  );
}
if (typeof SAVED_CLASSES !== "undefined") {
  SAVED_CLASSES.WallHook = (d) => new WallHook(d.scene);
  SAVED_CLASSES.HotPlate = (d) => new HotPlate(d.scene);
  SAVED_CLASSES.HookPole = (d) => new HookPole(d.scene);
  SAVED_CLASSES.Defibrillator = (d) => new Defibrillator(d.scene);
}
hookPoleImage();
defibImage();
