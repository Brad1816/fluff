// ---------------------------------------------------------------------------
// The Auto-Trainer (Fluff Mart, Home & Play, AUTO_TRAINER_PRICE): a little
// machine that trains your fluffies while you're busy.
//
// Long-press (right-click) it to set it up (the "autoTrainer" screen):
//   - which tricks and which lessons to work on (none ticked: it rests)
//   - the reward: Praise (free, slower) or Treats (TRICK_TREAT_COST each;
//     treats add weight, Diet.js)
//   - on or off
// Every so often it beeps and calls one of your fluffies in its room over
// (awake, well, not busy, not trained by it for AUTO_TRAINER_GAP game hours,
// with something ticked still to learn). At the machine it runs up to
// AUTO_TRAINER_REPS goes: tricks (Tricks.js tryTrick, rewarded the way you
// chose) and lessons (Lessons.js giveLesson). They use the fluffy's tries for
// the day, the same as when you train it.
// A machine isn't you: it learns AUTO_TRAINER_EFFECT as much from each go,
// and none of it is affection. How fast it learns still depends on how
// clever it is (Intelligence.js), how it feels about you and so on.
// The machine is drawn here (drawAutoTrainerShape).
// ---------------------------------------------------------------------------

const AUTO_TRAINER_PRICE = 250;
const AUTO_TRAINER_EFFECT = 0.75;
const AUTO_TRAINER_GAP = 1.5; // game hours before it calls the same fluffy again
const AUTO_TRAINER_REPS = 3;
const AUTO_TRAINER_REACH = 70; // px: close enough to train
const AUTO_TRAINER_WALK = 40; // game seconds to get there
const AUTO_TRAINER_CALL = 0.4; // chance a game hour of calling someone, each trainer
const autoTrainerTicker = new Ticker(1);

class AutoTrainer {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.tricks = ["sit"];
    this.lessons = [];
    this.reward = "praise"; // "praise" | "treat"
    this.on = true;
    this.session = null; // { fluffyId, at, reps, next, arrived }
    this._blink = 0;
  }
  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = Math.max(mouse.y + this.dragOffset.y, sceneTop(this.scene) + 10);
    }
    this._blink += dt;
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
    return px >= this.x - 30 && px <= this.x + 30 && py >= this.y - 86 && py <= this.y + 4;
  }
  serialize() {
    return {
      classType: "AutoTrainer",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      currentCageId: null,
      tricks: [...this.tricks],
      lessons: [...this.lessons],
      reward: this.reward,
      on: this.on,
    };
  }
  deserialize(d) {
    if (Array.isArray(d.tricks)) this.tricks = d.tricks.filter((k) => typeof getTrick === "function" && getTrick(k));
    if (Array.isArray(d.lessons)) this.lessons = d.lessons.slice();
    if (d.reward === "treat" || d.reward === "praise") this.reward = d.reward;
    if (typeof d.on === "boolean") this.on = d.on;
  }
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    const busy = !!this.session;
    drawAutoTrainerShape(ctx, this.x, this.y, 1, this.on ? (busy ? (Math.floor(this._blink * 3) % 2 ? "#7dff8a" : "#2c9a49") : "#7dd6ff") : "#555");
  }
}

// A little kiosk on a round base with a screen and a treat chute; (x, y) is
// the middle of its base
function drawAutoTrainerShape(c, x, y, k = 1, screen = "#7dd6ff") {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.lineJoin = "round";
  c.strokeStyle = "#2b3440";
  c.lineWidth = 2;
  // Base
  c.fillStyle = "#8a96a6";
  c.beginPath();
  c.ellipse(0, -5, 28, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Body
  c.fillStyle = "#d9dee6";
  roundRectPath(c, -20, -76, 40, 70, 8);
  c.fill();
  c.stroke();
  // Screen with a little paw
  c.fillStyle = screen;
  roundRectPath(c, -14, -68, 28, 20, 4);
  c.fill();
  c.stroke();
  c.fillStyle = "rgba(255,255,255,0.85)";
  c.beginPath();
  c.arc(0, -56, 4, 0, Math.PI * 2);
  for (const [dx, dy] of [
    [-5, -62],
    [0, -64],
    [5, -62],
  ])
    c.arc(dx, dy, 1.8, 0, Math.PI * 2);
  c.fill();
  // Treat chute and a bowl-shaped tray
  c.fillStyle = "#6a7480";
  roundRectPath(c, -8, -40, 16, 12, 3);
  c.fill();
  c.stroke();
  c.fillStyle = "#f2a7c8";
  c.beginPath();
  c.ellipse(0, -18, 13, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Antenna
  c.beginPath();
  c.moveTo(0, -76);
  c.lineTo(0, -88);
  c.stroke();
  c.fillStyle = screen;
  c.beginPath();
  c.arc(0, -90, 3.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

function autoTrainers() {
  return typeof objects !== "undefined" ? objects.filter((o) => o instanceof AutoTrainer) : [];
}

// What it still has to learn from this trainer: [{ kind, key }]
function autoTrainerWork(t, f) {
  const work = [];
  const triesLeft = (!f.trickTries || f.trickTries.day !== _atDay()) ? TRICK_TRIES_PER_DAY : TRICK_TRIES_PER_DAY - f.trickTries.n;
  if (triesLeft > 0 && typeof trickSkill === "function") {
    for (const k of t.tricks) {
      const trick = getTrick(k);
      if (!trick || trickSkill(f, k) >= 1) continue;
      if (trick.needsBall && !(typeof fetchableBall === "function" && fetchableBall(f))) continue;
      work.push({ kind: "trick", key: k });
    }
  }
  if (typeof lessonsFor === "function" && typeof lessonTriesLeft === "function" && lessonTriesLeft(f) > 0) {
    const need = lessonsFor(f).map((l) => l.key);
    for (const k of t.lessons) if (need.includes(k)) work.push({ kind: "lesson", key: k });
  }
  return work;
}

function _atDay() {
  return typeof _trDay === "function" ? _trDay() : getDayNumber();
}

function _atCanTrain(f, inSession = false) {
  if (!f || !f.isAlive || !f.adopted || f.growth < 0.36) return false;
  if (f.currentStateKey === "SLEEPING" || f.isDragging || f.placedOn || f.isFallingFromThrow) return false;
  if (f.health < 40 || f.hunger < 0.2 || (f.trickNow && !inSession) || f.timeOut || f._perch || f._memVisit || f._bolt) return false;
  if (typeof isFrightened === "function" && isFrightened(f)) return false;
  if (typeof mareResting === "function" && mareResting(f)) return false;
  if (f.tooYoungToWalk && f.tooYoungToWalk()) return false;
  return true;
}

// A caged fluffy can be trained through the bars by a machine right beside
// its cage (AUTO_TRAINER_CAGE_NEAR px from the cage's side)
const AUTO_TRAINER_CAGE_NEAR = 160;
function _atThroughBars(t, f) {
  const c = f.currentCage;
  if (!c || t.currentCage === c) return false;
  if (typeof c.updateBounds === "function" && !c.bounds) c.updateBounds();
  const b = c.bounds;
  if (!b) return false;
  // (beside it, in front of it or behind it - or standing over it)
  const dx = t.x < b.left ? b.left - t.x : t.x > b.right ? t.x - b.right : 0;
  const dy = t.y < b.top ? b.top - t.y : t.y > b.bottom ? t.y - b.bottom : 0;
  return dx <= AUTO_TRAINER_CAGE_NEAR && dy <= AUTO_TRAINER_CAGE_NEAR;
}

// Where a caged fluffy stands for the machine: as near to it as the cage
// lets it get (inside the cage with it, or at the bars nearest it)
function _atCagedSpot(t, f) {
  const lim = f.positioning && typeof f.positioning.getCageLimits === "function" ? f.positioning.getCageLimits() : null;
  if (!lim) return { x: f.x, y: f.y };
  const wantX = t.currentCage === f.currentCage ? t.x + (f.x < t.x ? -55 : 55) : t.x;
  // (a cage has one floor to stand on)
  return { x: Math.max(lim.minX, Math.min(lim.maxX, wantX)), y: typeof lim.y === "number" ? lim.y : f.y };
}

// One go at the machine
function autoTrainerRep(t, f) {
  const work = autoTrainerWork(t, f);
  if (!work.length) return false;
  const w = work[Math.floor(Math.random() * work.length)];
  f.facingRight = t.x > f.x;
  if (w.kind === "lesson") {
    giveLesson(f, w.key);
    return true;
  }
  const res = tryTrick(f, w.key);
  if (res === "done") {
    let kind = t.reward;
    if (kind === "treat") {
      if (typeof money === "number" && money < TRICK_TREAT_COST) kind = "praise";
      else {
        if (typeof money === "number") money -= TRICK_TREAT_COST;
        if (typeof changeWeight === "function") changeWeight(f, WEIGHT_TREAT);
      }
    }
    _trLearn(f, w.key, (TRICK_LEARN[kind] || 0) * trickLearnRate(f) * AUTO_TRAINER_EFFECT);
    f.changeHappiness(kind === "treat" ? 0.03 : 0.01);
    if (kind === "treat" && !f.tooYoungToSpeak() && Math.random() < 0.5) f.speak(getDialogue(["TRICK", "TREAT"], f), true);
    return true;
  }
  return res === "failed" || res === "refused";
}

function _atEnd(t, f) {
  t.session = null;
  if (f) {
    f._autoTrainAt = timePlayed;
    if (f.isAlive && f.isMovingOrRunning && f.isMovingOrRunning()) f.initBehavior("IDLE");
  }
}

function updateAutoTrainers(dt) {
  if (typeof fluffies === "undefined" || typeof objects === "undefined") return;
  const trainers = autoTrainers();
  if (!trainers.length) return;
  const now = timePlayed;
  // Sessions under way
  for (const t of trainers) {
    const s = t.session;
    if (!s) continue;
    const f = fluffyById(s.fluffyId);
    if (!t.on || t.isDragging || !f || f.scene !== t.scene || !_atCanTrain(f, true) || now - s.at > AUTO_TRAINER_WALK + 20) {
      _atEnd(t, f);
      continue;
    }
    let spotX = t.x + (f.x < t.x ? -55 : 55);
    let spotY = t.y + 10;
    // (in a cage - with the machine or beside it: as near as the cage lets it)
    const caged = !!f.currentCage;
    const bars = caged && t.currentCage !== f.currentCage;
    if (bars && !_atThroughBars(t, f)) {
      _atEnd(t, f);
      continue;
    }
    if (caged) {
      const spot = _atCagedSpot(t, f);
      spotX = spot.x;
      spotY = spot.y;
    }
    if (!s.arrived) {
      if (caged ? Math.abs(f.x - spotX) > 25 || Math.abs(f.y - spotY) > 40 : Math.hypot(f.x - spotX, f.y - spotY) > AUTO_TRAINER_REACH) {
        if (now - s.at > AUTO_TRAINER_WALK) {
          _atEnd(t, f);
          continue;
        }
        if (!f.isMovingOrRunning()) f.initBehavior("MOVING");
        f.setTargetPosition(spotX, spotY);
        continue;
      }
      s.arrived = true;
      s.next = now + 1;
      if (f.isMovingOrRunning()) f.initBehavior("IDLE");
    }
    if (now < s.next || (f.trickNow && now <= f.trickNow.until)) continue;
    if (s.reps <= 0 || !autoTrainerRep(t, f)) {
      _atEnd(t, f);
      continue;
    }
    s.reps--;
    s.at = now; // (still at it)
    s.next = now + 4 + Math.random() * 2;
  }
  // Calling someone over
  const step = autoTrainerTicker.step(dt);
  if (!step) return;
  const chance = 1 - Math.pow(1 - AUTO_TRAINER_CALL, step / HOUR_LENGTH);
  for (const t of trainers) {
    if (!t.on || t.session || t.isDragging || (!t.tricks.length && !t.lessons.length)) continue;
    if (Math.random() > chance) continue;
    const busy = new Set(trainers.filter((x) => x.session).map((x) => x.session.fluffyId));
    const pick = fluffies
      .filter((f) => f.scene === t.scene && !busy.has(f.id) && _atCanTrain(f))
      .filter((f) => typeof f._autoTrainAt !== "number" || now - f._autoTrainAt > AUTO_TRAINER_GAP * HOUR_LENGTH || now < f._autoTrainAt)
      .filter((f) => !f.currentCage || f.currentCage === t.currentCage || _atThroughBars(t, f))
      .filter((f) => f.currentCage || typeof canFluffyReach !== "function" || typeof sceneHasFences !== "function" || !sceneHasFences(f.scene) || canFluffyReach(f, t.x, t.y))
      .filter((f) => autoTrainerWork(t, f).length)
      .sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
    if (!pick) continue;
    t.session = { fluffyId: pick.id, at: now, reps: AUTO_TRAINER_REPS, next: now, arrived: false };
    t._blink = 0;
  }
}
registerSystem("autoTrainer", updateAutoTrainers, 71);

// Magnifying glass: being trained now?
function describeAutoTraining(f) {
  const t = autoTrainers().find((x) => x.session && x.session.fluffyId === f.id);
  return t ? "At the Auto-Trainer" : null;
}

// ---- Setting it up (long-press / right-click) ----
let autoTrainerOpen = null; // the trainer being set up

function openAutoTrainer(t) {
  autoTrainerOpen = t;
}
function closeAutoTrainer() {
  autoTrainerOpen = null;
}

function getAutoTrainerLayout() {
  const w = Math.min(760, width - 30);
  const h = Math.min(560, height - 30);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  const chips = [];
  const chipH = 40;
  const gap = 8;
  let cy = y + 96;
  const row = (items, kind) => {
    let cx = x + 24;
    for (const it of items) {
      const cw = Math.max(96, 22 + it.name.length * 9);
      if (cx + cw > x + w - 24) {
        cx = x + 24;
        cy += chipH + gap;
      }
      chips.push({ kind, key: it.key, name: it.name, x: cx, y: cy, w: cw, h: chipH });
      cx += cw + gap;
    }
    cy += chipH + 34;
  };
  row(TRICKS, "trick");
  const lessonsY = cy - 6;
  row(typeof LESSONS !== "undefined" ? LESSONS.map((l) => ({ key: l.key, name: l.name })) : [], "lesson");
  const rewardY = cy - 6;
  chips.push({ kind: "reward", key: "praise", name: "Praise (free)", x: x + 24, y: cy, w: 150, h: chipH });
  chips.push({ kind: "reward", key: "treat", name: `Treats ($${TRICK_TREAT_COST})`, x: x + 182, y: cy, w: 150, h: chipH });
  return {
    x,
    y,
    w,
    h,
    chips,
    lessonsY,
    rewardY,
    power: { x: x + 24, y: y + h - 54, w: 130, h: 40 },
    close: { x: x + w - 150, y: y + h - 54, w: 130, h: 40 },
  };
}

function drawAutoTrainerScreen(c) {
  const t = autoTrainerOpen;
  if (!t) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  if (!objects.includes(t)) {
    autoTrainerOpen = null;
    return;
  }
  const L = getAutoTrainerLayout();
  c.save();
  drawScreenPanel(c, L, { theme: "pink", dim: 0.5 });
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.fillStyle = "#ffd6f0";
  c.font = "bold 22px Arial";
  c.fillText("Auto-Trainer", L.x + 24, L.y + 38);
  c.font = "13px Arial";
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.fillText("It calls your fluffies in this room over, one at a time, and works on what you tick.", L.x + 24, L.y + 58);
  c.font = "bold 15px Arial";
  c.fillStyle = "#ffe066";
  c.fillText("Tricks", L.x + 24, L.y + 88);
  c.fillText("Lessons (only for the ones that need them)", L.x + 24, L.lessonsY);
  c.fillText("Reward", L.x + 24, L.rewardY);
  for (const ch of L.chips) {
    const on = ch.kind === "trick" ? t.tricks.includes(ch.key) : ch.kind === "lesson" ? t.lessons.includes(ch.key) : t.reward === ch.key;
    fillRoundRect(c, ch.x, ch.y, ch.w, ch.h, 10, on ? "rgba(60, 150, 110, 0.95)" : "rgba(255,255,255,0.1)");
    c.strokeStyle = on ? "#9dffc8" : "rgba(255,255,255,0.3)";
    c.lineWidth = 1.5;
    roundRectPath(c, ch.x, ch.y, ch.w, ch.h, 10);
    c.stroke();
    c.fillStyle = "white";
    c.font = "15px Arial";
    c.textAlign = "center";
    c.fillText(`${on ? "✓ " : ""}${ch.name}`, ch.x + ch.w / 2, ch.y + 26);
    c.textAlign = "left";
  }
  // Who it's training now
  const s = t.session;
  const f = s ? fluffyById(s.fluffyId) : null;
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.8)";
  c.fillText(!t.on ? "Switched off." : f ? `Training ${fluffyDisplayName(f)} now.` : "Waiting for someone to train.", L.x + 170, L.y + L.h - 28);
  drawGlassButton(L.power.x, L.power.y, L.power.w, L.power.h, t.on ? "Switch off" : "Switch on", { fontSize: 15, borderRadius: 10 });
  drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 16, borderRadius: 10 });
  c.restore();
}

function handleAutoTrainerClick() {
  const t = autoTrainerOpen;
  if (!t) return false;
  const L = getAutoTrainerLayout();
  const hit = (r) => isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h);
  if (hit(L.close) || !hit(L)) {
    closeAutoTrainer();
    return true;
  }
  if (hit(L.power)) {
    t.on = !t.on;
    if (!t.on && t.session) _atEnd(t, fluffyById(t.session.fluffyId));
    return true;
  }
  for (const ch of L.chips) {
    if (!hit(ch)) continue;
    const toggle = (list) => (list.includes(ch.key) ? list.filter((k) => k !== ch.key) : [...list, ch.key]);
    if (ch.kind === "trick") t.tricks = toggle(t.tricks);
    else if (ch.kind === "lesson") t.lessons = toggle(t.lessons);
    else t.reward = ch.key;
    return true;
  }
  return true;
}

if (typeof registerScreen === "function") {
  registerScreen({
    name: "autoTrainer",
    layer: 15,
    isOpen: () => !!autoTrainerOpen,
    close: () => closeAutoTrainer(),
    draw: (c) => drawAutoTrainerScreen(c),
    click: () => handleAutoTrainerClick(),
  });
}

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({
    name: "Auto-Trainer",
    desc: "Trains your fluffies while you're busy: it calls them over one at a time and works on the tricks and lessons you pick, with praise or treats. Long-press or right-click it to set it up. A machine isn't you, so they learn a bit slower and it earns you no love.",
    cost: AUTO_TRAINER_PRICE,
    isItem: "auto_trainer",
  });
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push({
    sellType: "auto_trainer",
    is: (o) => o instanceof AutoTrainer,
    hitTest: (o, x, y) => o.hitTest(x, y),
    sellable: true,
    create: (a, sx, sy) => atSpot(new AutoTrainer(currentScene), sx, sy),
    drawIcon: (ctx, btnSize) => drawAutoTrainerShape(ctx, 0, 30, 0.42),
    onRightClick: (o) => openAutoTrainer(o),
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.AutoTrainer = (d) => new AutoTrainer(d.scene);
