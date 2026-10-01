// ---------------------------------------------------------------------------
// The Feed-Bot: a little robot that keeps the bowls in its room filled.
//
// Buy it at Fluff Mart (Home & Play, FEEDBOT_PRICE, delivered). It waits at
// its dock (where you last put it down), drives to bowls and troughs in its
// room that need food, fills them and goes back.
//
// Loading: hold a food bag over it to pour the bag into its hopper
// (FEEDBOT_HOPPER portions - 2 bags; a bag is 25). It serves what's loaded,
// oldest first. Formula goes into its own tank (FEEDBOT_TANK): it keeps baby
// feeders topped up and carries formula straight to orphaned newborns too
// young to walk (no nursing mum in the room). When it runs low it blinks and
// says so; the Household screen shows it too.
//
// Right-click: change mode -
//   Keep full       tops up any bowl below half
//   Mealtimes       fills every bowl at breakfast and dinner (FEEDBOT_MEALS),
//                   ringing a bell first. Fluffies learn the bell
//                   (f.bellLearn, saved) and come running when it rings.
//   Small portions  fills bowls only halfway (for fluffies getting fat)
//   Off             parks at its dock
//
// Fluffies: most like it ("Nummy-wobot!"). Timid ones can be scared of it
// like the Fluff-Bot (Fears.js "bot"), but every time it brings food nearby
// that fear fades a little (FEEDBOT_FEAR_FADE).
//
// Tipping over: rowdy fluffies (energetic, bad-tempered, bored or very
// hungry ones, and Smarties - feedBotRowdiness) sometimes knock it over when
// it has food, more at crowded mealtimes. Some food spills on the floor
// (FoodSpill - fluffies eat it, the Fluff-Bot cleans it up), timid ones get
// a fright, and it stops until you stand it up (pick it up or right-click).
// Sometimes it breaks (FEEDBOT_BREAK, more if it was tipped again soon after):
// use a Repair Kit on it (REPAIR_KIT_PRICE), or right-click to send it for
// repair (FEEDBOT_REPAIR_PRICE, back the next game day). Each fluffy's count
// is kept (f.feedBotTips, saved).
//
// Meals from the Feed-Bot are not you feeding them: no affection.
//
// Saved (serialize): hopper, formula tank, mode, state, dock, repair day.
// ---------------------------------------------------------------------------

const FEEDBOT_PRICE = 300;
const FEEDBOT_HOPPER = 50;
const FEEDBOT_TANK = 25;
const FEEDBOT_SPEED = 60; // px a second
const FEEDBOT_MEALS = [8, 18]; // game hours
const FEEDBOT_TIP_CHANCE = 0.002; // a second, x rowdiness, per fluffy right next to it
const FEEDBOT_BREAK = 0.25;
const FEEDBOT_BREAK_AGAIN = 0.6; // tipped again within FEEDBOT_RETIP seconds
const FEEDBOT_RETIP = 100;
const FEEDBOT_REPAIR_PRICE = 80;
const REPAIR_KIT_PRICE = 40;
const FEEDBOT_FEAR_FADE = 0.01;
const FEEDBOT_MODES = [
  { key: "full", name: "Keep full" },
  { key: "meals", name: "Mealtimes" },
  { key: "small", name: "Small portions" },
  { key: "off", name: "Off" },
];
const FOOD_SPILL_LIFE = 300; // seconds before a spill is trodden in and gone

function _fbNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}
function _fbHour() {
  return typeof gameHour === "function" ? gameHour() : 12;
}
function _fbDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : Math.floor(_fbNow() / 1200);
}
function _fbTrait(f, key) {
  return typeof traitValue === "function" ? traitValue(f, key) : 0;
}
function _fbSay(f, key) {
  if (f && f.isAlive && !f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING") f.speak(getDialogue(["FEEDBOT", key], f));
}

// How likely this fluffy is to knock the Feed-Bot over (0 = never)
function feedBotRowdiness(f) {
  let r = 0;
  r += 0.5 * Math.max(0, _fbTrait(f, "energy"));
  r += 0.6 * Math.max(0, _fbTrait(f, "temper")); // (bad-tempered)
  r += 0.8 * (f.boredom || 0);
  if (f.hunger < 0.3) r += 0.5;
  if (f.isSmarty && f.isSmarty()) r += 1;
  return r;
}

const FEEDBOT_STARVING = 0.25; // a newborn this hungry gets formula, mum or no mum

// A mum who turns her own foal away from the milk (HorseFamily.attemptFeedFromMare)
function mumWontFeed(mum, foal) {
  if (!mum || !foal) return false;
  if (typeof mumRejectsFoalColour === "function" && mumRejectsFoalColour(mum, foal)) return true;
  const rel = typeof relationships !== "undefined" && relationships[mum.id] ? relationships[mum.id][foal.id] : null;
  if (rel === "estranged_child" || rel === "rejected_baby") return true;
  return !!(
    typeof worldSettings !== "undefined" &&
    worldSettings.alicornIntolerance &&
    typeof foal.typeVisibleToOthers === "function" &&
    foal.typeVisibleToOthers() === "alicorn" &&
    typeof mum.tolerantOfAlicorns === "function" &&
    !mum.tolerantOfAlicorns()
  );
}

class FeedBot {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.hopper = []; // [[foodType, portions], ...] oldest first
    this.formula = 0;
    this.mode = "full";
    this.state = "docked"; // docked | driving | tipped | broken | away
    this.homeX = null;
    this.homeY = null;
    this.facing = 1;
    this.spin = 0;
    this.returnDay = null;
    this.lastTipAt = -1e9;
    this._job = null;
    this._mealPending = false;
    this._lastHour = null;
    this._bell = 0;
    this._lowWarned = false;
    this._tick = 0;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
  }

  onDrop() {
    const r = handleDropping(this);
    this.currentCage = null;
    this.homeX = this.x;
    this.homeY = this.y;
    // Picked up and put down: it's back on its wheels
    if (this.state === "tipped") this.state = "docked";
    if (this.state === "driving") this.state = "docked";
    this._job = null;
    return r;
  }

  getBottomY() {
    return this.y;
  }

  hitTest(px, py) {
    if (this.state === "away") return false;
    if (this.state === "tipped" || this.state === "broken") return px >= this.x - 40 && px <= this.x + 40 && py >= this.y - 34 && py <= this.y + 4;
    return px >= this.x - 30 && px <= this.x + 30 && py >= this.y - 62 && py <= this.y + 4;
  }

  // ---- Food ----

  portions() {
    return this.hopper.reduce((a, c) => a + c[1], 0);
  }

  // Pour food in. Returns how many portions went in.
  load(type, portions) {
    if (type === "formula") {
      const n = Math.max(0, Math.min(portions, FEEDBOT_TANK - this.formula));
      this.formula += n;
      return n;
    }
    const n = Math.max(0, Math.min(portions, FEEDBOT_HOPPER - this.portions()));
    if (n <= 0) return 0;
    const last = this.hopper[this.hopper.length - 1];
    if (last && last[0] === type) last[1] += n;
    else this.hopper.push([type, n]);
    if (this.portions() > 20) this._lowWarned = false;
    return n;
  }

  // Take up to n portions of the oldest food: { type, n }
  _take(n) {
    const c = this.hopper[0];
    if (!c) return null;
    const got = Math.min(n, c[1]);
    c[1] -= got;
    if (c[1] <= 0) this.hopper.shift();
    return { type: c[0], n: got };
  }

  // ---- Jobs ----

  // What a bowl should be filled to now (0 = leave it)
  _bowlTarget(b) {
    if (this.mode === "off") return 0;
    const max = b.maxFood;
    if (this.mode === "meals") return this._mealPending && b.food < max ? max : 0;
    if (this.mode === "small") return b.food < max / 4 ? Math.ceil(max / 2) : 0;
    return b.food < max / 2 ? max : 0; // keep full
  }

  _bowls() {
    if (typeof objects === "undefined" || typeof Bowl === "undefined") return [];
    return objects.filter((o) => o instanceof Bowl && o.type !== "spill" && o.scene === this.scene && !o.currentCage && !o.isDragging);
  }

  // Newborns too young to walk with no nursing mum in the room - or a mum
  // who won't feed it (its coat colour, it's an alicorn), or one starving
  // anyway: those starved beside her in the long test games
  _orphans() {
    if (this.formula <= 0 || this.mode === "off") return [];
    return fluffies.filter((f) => {
      if (!f.isAlive || f.scene !== this.scene || !f.tooYoungToWalk() || f.hunger >= 0.5) return false;
      if (f.isDragging || f.placedOn || f.currentCage) return false;
      const mum = fluffies.find((m) => m.id === f.motherId && m.isAlive && m.scene === f.scene && m.lactatingTimer > 0 && m.currentCage === f.currentCage);
      // (and any newborn going really hungry: a big litter can drink mum dry)
      return !mum || mumWontFeed(mum, f) || f.hunger < FEEDBOT_STARVING;
    });
  }

  _findJob() {
    const near = (a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y);
    const orphans = this._orphans().sort(near);
    if (orphans.length) return { kind: "orphan", target: orphans[0] };
    const bowls = this._bowls();
    if (this.formula > 0 && this.mode !== "off") {
      const feeders = bowls.filter((b) => (b.type === "feeder" || b.type === "mega_feeder") && b.food < b.maxFood / 2).sort(near);
      if (feeders.length) return { kind: "feeder", target: feeders[0] };
    }
    if (this.portions() > 0) {
      const need = bowls.filter((b) => b.type !== "feeder" && b.type !== "mega_feeder" && this._bowlTarget(b) > b.food).sort(near);
      if (need.length) return { kind: "bowl", target: need[0] };
    }
    return null;
  }

  _bounds() {
    return {
      left: 35,
      right: (typeof sceneW === "function" ? sceneW(this.scene) : width) - 35,
      top: (typeof sceneTop === "function" ? sceneTop(this.scene) : 120) + 25,
      bottom: (typeof sceneH === "function" ? sceneH(this.scene) : height) - 10,
    };
  }

  _driveTo(tx, ty, dt) {
    const B = this._bounds();
    tx = Math.max(B.left, Math.min(B.right, tx));
    ty = Math.max(B.top, Math.min(B.bottom, ty));
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) return true;
    const step = Math.min(d, FEEDBOT_SPEED * dt);
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    if (Math.abs(dx) > 1) this.facing = dx > 0 ? 1 : -1;
    this.spin += dt * 10;
    return false;
  }

  _doJob(job) {
    const t = job.target;
    if (job.kind === "orphan") {
      if (!t.isAlive || this.formula <= 0) return;
      this.formula--;
      t.hunger = 1;
      if (!t.tooYoungToSpeak()) t.speak(getDialogue(["DRINK_MILKIES", "FORMULA"], t, null));
      return;
    }
    if (job.kind === "feeder") {
      const n = Math.min(this.formula, t.maxFood - (t.foodType === "formula" ? t.food : 0));
      if (n > 0 && t.fill(n, "formula")) {
        this.formula -= n;
        t.byYou = false; // (the Feed-Bot's meals aren't you feeding them)
      }
      return;
    }
    // A bowl or trough: fill it to what this mode wants
    const target = this._bowlTarget(t);
    for (let guard = 0; guard < 4 && t.food < target && this.portions() > 0; guard++) {
      const got = this._take(target - t.food);
      if (!got || !t.fill(got.n, got.type)) break;
      t.byYou = false; // (the Feed-Bot's meals aren't you feeding them)
    }
    this._afterServing(t);
  }

  // Food arrived: fans cheer, the scared get a little less scared
  _afterServing(b) {
    let cheered = false;
    for (const f of fluffies) {
      if (!f.isAlive || f.scene !== this.scene || Math.hypot(f.x - b.x, f.y - b.y) > 220) continue;
      if (typeof fearOf === "function" && fearOf(f, "bot") > 0) changeFear(f, "bot", -FEEDBOT_FEAR_FADE);
      if (!cheered && f.hunger < 0.7 && !f.tooYoungToWalk() && Math.random() < 0.3) {
        cheered = true;
        _fbSay(f, "FOND");
      }
    }
  }

  // ---- Mealtimes and the bell ----

  _checkMealtime() {
    const h = _fbHour();
    if (this._lastHour === null) this._lastHour = h;
    for (const m of FEEDBOT_MEALS) {
      const crossed = this._lastHour < m && h >= m;
      if (crossed && this.mode === "meals") this._ringBell();
    }
    this._lastHour = h;
  }

  _ringBell() {
    this._mealPending = true;
    this._bell = 3;
    for (const f of fluffies) {
      if (!f.isAlive || f.scene !== this.scene || f.currentStateKey === "SLEEPING" || f.tooYoungToWalk()) continue;
      const learnt = f.bellLearn || 0;
      f.bellLearn = Math.min(1, learnt + 0.1);
      if (learnt < 0.5 || f.isDragging || f.placedOn || f.currentCage || f.hunger >= 0.95) continue;
      // Knows the bell: comes running to the nearest bowl
      const b = this._bowls()
        .filter((x) => x.type !== "feeder" && x.type !== "mega_feeder")
        .sort((p, q) => Math.hypot(p.x - f.x, p.y - f.y) - Math.hypot(q.x - f.x, q.y - f.y))[0];
      if (!b) continue;
      if (typeof canFluffyReach === "function" && !canFluffyReach(f, b.x, b.y + 10)) continue;
      f.initBehavior("MOVING");
      f.setTargetPosition(b.x + (Math.random() - 0.5) * 60, b.y + 10);
      f.expressionOverride = "GOOD_UPSIES";
      f.expressionOverrideTimer = 2;
      if (Math.random() < 0.4) _fbSay(f, "BELL");
    }
  }

  // ---- Tipping over ----

  _checkTipping() {
    if (this.portions() + this.formula <= 0) return;
    const crowd = fluffies.filter((f) => f.isAlive && f.scene === this.scene && Math.hypot(f.x - this.x, f.y - this.y) < 90).length;
    const busy = this._mealPending || crowd >= 3 ? 2 : 1;
    for (const f of fluffies) {
      if (!f.isAlive || f.scene !== this.scene || f.growth < 1 || f.isDragging || f.placedOn || f.currentCage) continue;
      if (f.currentStateKey === "SLEEPING" || Math.hypot(f.x - this.x, f.y - this.y) > 75) continue;
      const r = feedBotRowdiness(f);
      if (r > 0 && Math.random() < FEEDBOT_TIP_CHANCE * r * busy) {
        this.tipOver(f);
        return;
      }
    }
  }

  // Knocked over (by a fluffy, or null). Returns "tipped" or "broken".
  tipOver(f = null) {
    if (this.state === "tipped" || this.state === "broken" || this.state === "away") return this.state;
    const now = _fbNow();
    const again = now - this.lastTipAt < FEEDBOT_RETIP;
    this.lastTipAt = now;
    this._job = null;
    const broke = Math.random() < (again ? FEEDBOT_BREAK_AGAIN : FEEDBOT_BREAK);
    this.state = broke ? "broken" : "tipped";
    // Some food spills out
    const spilt = this._take(3 + Math.floor(Math.random() * 5));
    if (spilt && spilt.n > 0 && typeof objects !== "undefined") {
      const s = new FoodSpill(this.scene, spilt.type, spilt.n);
      s.setPosition(this.x + this.facing * 30, this.y + 6);
      objects.push(s);
    }
    const name = f ? (typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy") : "Something";
    if (f) {
      f.feedBotTips = (f.feedBotTips || 0) + 1;
      if (typeof recordStory === "function") recordStory("feedbot_tip", f);
      f.expressionOverride = "ANGRY_PUFFED";
      f.expressionOverrideTimer = 1.5;
      _fbSay(f, "TIP");
      if (typeof onFluffyPlayed === "function") onFluffyPlayed(f, "block"); // (a bit of fun for it)
    }
    // Timid ones nearby get a fright
    if (typeof startFright === "function") {
      for (const o of fluffies) {
        if (o !== f && o.isAlive && o.scene === this.scene && Math.hypot(o.x - this.x, o.y - this.y) < 250) startFright(o, "bot");
      }
    }
    if (this.scene === currentScene || (f && f.adopted)) {
      if (typeof addUIMessage === "function")
        addUIMessage(broke ? `${name} knocked over the Feed-Bot - it's broken! Use a Repair Kit, or right-click it to send it for repair.` : `${name} knocked over the Feed-Bot! Pick it up or right-click it to stand it up.`);
    }
    return this.state;
  }

  standUp() {
    if (this.state !== "tipped") return false;
    this.state = "docked";
    return true;
  }

  repair() {
    if (this.state !== "broken" && this.state !== "tipped") return false;
    this.state = "docked";
    this.lastTipAt = -1e9;
    return true;
  }

  sendForRepair() {
    if (this.state !== "broken") return "not broken";
    const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
    if (!free && money < FEEDBOT_REPAIR_PRICE) return "money";
    if (!free) money -= FEEDBOT_REPAIR_PRICE;
    this.state = "away";
    this.returnDay = _fbDay() + 1;
    return "sent";
  }

  // Right-click
  rightClick() {
    const msg = (t) => typeof addUIMessage === "function" && addUIMessage(t);
    if (this.state === "away") return;
    if (this.state === "tipped") {
      this.standUp();
      msg("Feed-Bot back on its wheels.");
      return;
    }
    if (this.state === "broken") {
      const r = this.sendForRepair();
      if (r === "sent") msg(`Feed-Bot sent for repair ($${FEEDBOT_REPAIR_PRICE}). It'll be back tomorrow - feed them by hand until then.`);
      else if (r === "money") msg(`Repairs cost $${FEEDBOT_REPAIR_PRICE} - not enough money. A Repair Kit ($${REPAIR_KIT_PRICE}) fixes it too.`);
      return;
    }
    const i = FEEDBOT_MODES.findIndex((m) => m.key === this.mode);
    this.mode = FEEDBOT_MODES[(i + 1) % FEEDBOT_MODES.length].key;
    this._mealPending = false;
    this._job = null;
    msg(`Feed-Bot: ${feedBotModeName(this.mode)}. (${this.portions()}/${FEEDBOT_HOPPER} food, ${this.formula}/${FEEDBOT_TANK} formula)`);
  }

  // ---- Update ----

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      this.y = Math.max(this.y, sceneTop(this.scene) + 10);
      return;
    }
    if (this.homeX === null) {
      this.homeX = this.x;
      this.homeY = this.y;
    }
    if (this._bell > 0) this._bell -= dt;
    if (this.state === "away") {
      if (_fbDay() >= (this.returnDay || 0)) {
        this.state = "docked";
        this.x = this.homeX;
        this.y = this.homeY;
        if (typeof addUIMessage === "function") addUIMessage("The Feed-Bot is back from repair.");
      }
      return;
    }
    if (this.state === "tipped" || this.state === "broken") return;
    this._checkMealtime();
    this._tick += dt;
    if (this._tick >= 1) {
      this._tick -= 1;
      this._checkTipping();
      if (this.state === "tipped" || this.state === "broken") return;
      this._warnLow();
    }
    if (!this._job || !this._stillNeeded(this._job)) this._job = this._findJob();
    if (!this._job && this._mealPending && this.mode === "meals") this._mealPending = false; // everyone's served
    const job = this._job;
    if (job) {
      this.state = "driving";
      const t = job.target;
      const ty = job.kind === "orphan" ? t.y : t.y + 8;
      const tx = t.x + (t.x >= this.x ? -34 : 34);
      if (this._driveTo(tx, ty, dt)) {
        this._doJob(job);
        this._job = null;
      }
    } else if (this.state !== "docked") {
      if (this._driveTo(this.homeX, this.homeY, dt)) this.state = "docked";
    }
  }

  _stillNeeded(job) {
    const t = job.target;
    if (job.kind === "orphan") return t.isAlive && t.scene === this.scene && t.hunger < 0.5 && this.formula > 0;
    if (!objects.includes(t) || t.scene !== this.scene || t.isDragging) return false;
    if (job.kind === "feeder") return this.formula > 0 && t.food < t.maxFood;
    return this.portions() > 0 && this._bowlTarget(t) > t.food;
  }

  _warnLow() {
    const low = this.portions() < 10;
    if (low && !this._lowWarned && this.mode !== "off") {
      this._lowWarned = true;
      if (typeof addUIMessage === "function") addUIMessage(this.portions() <= 0 ? "The Feed-Bot is out of food - pour a food bag into it." : "The Feed-Bot is running low on food.");
    }
  }

  // Household screen: a short line if it needs you, else null
  statusLine() {
    const where = typeof householdRoomName === "function" ? householdRoomName(this.scene) : this.scene;
    if (this.state === "broken") return `Feed-Bot (${where}): broken`;
    if (this.state === "tipped") return `Feed-Bot (${where}): tipped over`;
    if (this.state === "away") return `Feed-Bot: away for repair`;
    if (this.mode === "off") return null;
    if (this.portions() <= 0) return `Feed-Bot (${where}): out of food`;
    if (this.portions() < 10) return `Feed-Bot (${where}): low on food`;
    return null;
  }

  // ---- Save ----

  serialize() {
    return {
      classType: "FeedBot",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      hopper: this.hopper.map((c) => [c[0], c[1]]),
      formula: this.formula,
      mode: this.mode,
      state: this.state === "driving" ? "docked" : this.state,
      homeX: this.homeX,
      homeY: this.homeY,
      returnDay: this.returnDay,
      currentCageId: null,
    };
  }

  deserialize(data) {
    this.hopper = Array.isArray(data.hopper) ? data.hopper.filter((c) => Array.isArray(c) && c[1] > 0).map((c) => [c[0], c[1]]) : [];
    this.formula = typeof data.formula === "number" ? data.formula : 0;
    this.mode = FEEDBOT_MODES.some((m) => m.key === data.mode) ? data.mode : "full";
    this.state = ["docked", "tipped", "broken", "away"].includes(data.state) ? data.state : "docked";
    this.homeX = typeof data.homeX === "number" ? data.homeX : data.x;
    this.homeY = typeof data.homeY === "number" ? data.homeY : data.y;
    this.returnDay = data.returnDay ?? null;
  }

  // ---- Drawing ----

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    if (this.state === "away") return;
    drawFeedBotShape(ctx, this.x, this.y, 1, {
      fill: this.portions() / FEEDBOT_HOPPER,
      formula: this.formula / FEEDBOT_TANK,
      state: this.state,
      mode: this.mode,
      facing: this.facing,
      spin: this.spin,
      low: this.portions() < 10 && this.mode !== "off",
    });
    if (this._bell > 0) {
      ctx.save();
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255, 220, 120, 0.95)";
      ctx.fillText("♪ ding ding! ♪", this.x, this.y - 78 - (3 - this._bell) * 6);
      ctx.restore();
    }
  }
}

function feedBotModeName(key) {
  const m = FEEDBOT_MODES.find((x) => x.key === key);
  return m ? m.name : key;
}

// (x, y) = the middle of its bottom
function drawFeedBotShape(c, x, y, k = 1, o = {}) {
  const fill = Math.max(0, Math.min(1, o.fill ?? 0.6));
  const formula = Math.max(0, Math.min(1, o.formula ?? 0));
  const state = o.state || "docked";
  const t = typeof performance !== "undefined" ? performance.now() / 1000 : 0;
  c.save();
  c.translate(x, y);
  c.scale(k * (o.facing || 1), k);
  // Shadow
  c.fillStyle = "rgba(0,0,0,0.18)";
  c.beginPath();
  c.ellipse(0, 1, 32, 6, 0, 0, Math.PI * 2);
  c.fill();
  if (state === "tipped" || state === "broken") {
    c.translate(0, -14);
    c.rotate(-Math.PI / 2);
    c.translate(14, 0);
  }
  // Base with wheels
  c.fillStyle = "#3f6f5a";
  c.beginPath();
  c.roundRect ? c.roundRect(-28, -18, 56, 18, 6) : c.rect(-28, -18, 56, 18);
  c.fill();
  c.fillStyle = "#222";
  for (const wx of [-18, 18]) {
    c.beginPath();
    c.arc(wx, -2, 5, 0, Math.PI * 2);
    c.fill();
  }
  // Hopper (see-through, food level inside)
  c.fillStyle = "rgba(220, 240, 255, 0.55)";
  c.strokeStyle = "#2c4f40";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-20, -18);
  c.lineTo(-24, -58);
  c.lineTo(20, -58);
  c.lineTo(16, -18);
  c.closePath();
  c.fill();
  if (fill > 0) {
    const top = -18 - 38 * fill;
    c.fillStyle = "#a0703c";
    c.beginPath();
    c.moveTo(-20, -18);
    c.lineTo(-20 - 4 * fill, top);
    c.lineTo(16 + 4 * fill, top);
    c.lineTo(16, -18);
    c.closePath();
    c.fill();
  }
  c.beginPath();
  c.moveTo(-20, -18);
  c.lineTo(-24, -58);
  c.lineTo(20, -58);
  c.lineTo(16, -18);
  c.closePath();
  c.stroke();
  // Lid
  c.fillStyle = "#4f8a70";
  c.fillRect(-26, -62, 48, 5);
  // Formula bottle on its side
  c.fillStyle = "rgba(255,255,255,0.85)";
  c.fillRect(20, -38, 9, 20);
  c.fillStyle = "#f3e6c8";
  c.fillRect(20, -38 + 20 * (1 - formula), 9, 20 * formula);
  c.strokeStyle = "#888";
  c.lineWidth = 1;
  c.strokeRect(20, -38, 9, 20);
  // Light: green working, blue docked, grey off, blinking amber low, red tipped/broken
  let col = o.mode === "off" ? "#8a8f98" : state === "driving" ? "#4be07a" : "#5ab4ff";
  if (o.low && Math.floor(t * 2) % 2 === 0) col = "#f0b030";
  if (state === "tipped" || state === "broken") col = Math.floor(t * 3) % 2 === 0 ? "#e04545" : "#702020";
  c.fillStyle = col;
  c.beginPath();
  c.arc(-14, -10, 3, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // Sparks when broken
  if (state === "broken") {
    c.save();
    c.strokeStyle = "rgba(255, 230, 90, 0.9)";
    c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const a = t * 9 + i * 2.1;
      const sx = x + Math.cos(a) * 12;
      const sy = y - 24 + Math.sin(a * 1.3) * 8;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(sx + Math.cos(a * 3) * 7, sy + Math.sin(a * 2) * 7);
      c.stroke();
    }
    c.restore();
  }
}

// ---- Food on the floor ----

// Spilled food: fluffies eat it like a bowl (it is one, type "spill"); it
// can't be picked up or refilled, fades after FOOD_SPILL_LIFE, and the
// Fluff-Bot hoovers it up.
class FoodSpill extends Bowl {
  constructor(scene = "INDOORS", foodType = "kibble", amount = 3) {
    super("bowl", scene);
    this.type = "spill";
    this.foodType = foodType;
    this.food = amount;
    this.maxFood = amount;
    this.bornAt = _fbNow();
  }

  update(dt) {
    const now = _fbNow();
    if (this.food <= 0 || now - this.bornAt > FOOD_SPILL_LIFE || now < this.bornAt - 60) {
      const i = objects.indexOf(this);
      if (i >= 0) objects.splice(i, 1);
    }
  }

  fill() {
    return false;
  }

  eat() {
    const r = super.eat();
    if (this.food <= 0) this.foodType = null;
    return r;
  }

  hitTest(px, py) {
    return Math.abs(px - this.x) < 30 && Math.abs(py - this.y) < 12;
  }

  onDrop() {}

  serialize() {
    return {
      classType: "FoodSpill",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      food: this.food,
      foodType: this.foodType,
      bornAt: this.bornAt,
      currentCageId: null,
    };
  }

  deserialize(data) {
    this.food = data.food || 0;
    this.maxFood = Math.max(1, this.food);
    this.foodType = data.foodType || "kibble";
    this.bornAt = typeof data.bornAt === "number" ? data.bornAt : _fbNow();
  }

  drawOffScreen(c) {
    if (this.food <= 0) return;
    const col = this.foodType === "sketties" ? "#d9a441" : this.foodType === "scrap_kibble" ? "#7a5a4a" : "#a0703c";
    c.save();
    c.fillStyle = col;
    const n = Math.min(18, 4 + this.food * 2);
    for (let i = 0; i < n; i++) {
      const a = (i * 2.399 + this.id) % (Math.PI * 2);
      const r = 4 + ((i * 7 + this.id) % 22);
      c.beginPath();
      c.ellipse(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r * 0.35, 3, 2, a, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
}

// ---- Repair Kit ----

class RepairKit {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  getBottomY() {
    return this.y;
  }
  hitTest(px, py) {
    return px >= this.x - 18 && px <= this.x + 18 && py >= this.y - 22 && py <= this.y + 2;
  }
  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      this.y = Math.max(this.y, sceneTop(this.scene) + 10);
      // Held over a knocked-over or broken Feed-Bot: fixes it (used up)
      const bot = objects.find((o) => o instanceof FeedBot && o.scene === this.scene && (o.state === "broken" || o.state === "tipped") && o.hitTest(mouse.x, mouse.y));
      if (bot && bot.repair()) {
        const i = objects.indexOf(this);
        if (i >= 0) objects.splice(i, 1);
        this.isDragging = false;
        if (typeof poofs !== "undefined" && typeof Poof !== "undefined") poofs.push(new Poof(bot.x, bot.y - 30, bot.scene));
        if (typeof addUIMessage === "function") addUIMessage("Feed-Bot repaired.");
      }
    }
    if (typeof handleGenericCageContainment === "function") handleGenericCageContainment(this, 36, 24);
  }
  onDrop() {
    return handleDropping(this);
  }
  serialize() {
    return { classType: "RepairKit", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: this.currentCage ? this.currentCage.id : null };
  }
  deserialize() {}
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    drawRepairKitShape(ctx, this.x, this.y, 1);
  }
}

function drawRepairKitShape(c, x, y, k = 1) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.fillStyle = "#c0392b";
  c.fillRect(-17, -20, 34, 20);
  c.fillStyle = "#922b21";
  c.fillRect(-17, -20, 34, 5);
  c.strokeStyle = "#555";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-7, -20);
  c.lineTo(-7, -25);
  c.lineTo(7, -25);
  c.lineTo(7, -20);
  c.stroke();
  // Spanner
  c.strokeStyle = "#e8e8e8";
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(-8, -5);
  c.lineTo(7, -13);
  c.stroke();
  c.restore();
}

// Held food bag over the Feed-Bot (FoodBag.attemptFill): pour one lot in.
// True if it poured.
function pourIntoFeedBot(bag) {
  if (typeof objects === "undefined") return false;
  const bot = objects.find((o) => o instanceof FeedBot && o.scene === bag.scene && o.state !== "away" && o.hitTest(mouse.x, mouse.y));
  if (!bot || bag.amount <= 0) return false;
  const want = Math.min(5, bag.amount * 5);
  const n = bot.load(bag.type, want);
  if (n <= 0) return false;
  bag.amount -= n / 5;
  if (bag.amount < 0.001) bag.amount = 0;
  return true;
}

// Household screen lines for Feed-Bots that need you
function feedBotStatusLines() {
  if (typeof objects === "undefined") return [];
  return objects.filter((o) => o instanceof FeedBot).map((o) => o.statusLine()).filter(Boolean);
}

SPAWN_ACTIONS.push({
  name: "Feed-Bot",
  desc: "Keeps the bowls in its room filled. Pour food bags into it (formula too, for feeders and orphaned foals). Right-click to change mode: keep full, mealtimes, small portions, off.",
  cost: FEEDBOT_PRICE,
  isItem: "feedbot",
});
SPAWN_ACTIONS.push({
  name: "Repair Kit",
  desc: "Fixes a broken or knocked-over Feed-Bot. Hold it over the bot.",
  cost: REPAIR_KIT_PRICE,
  isItem: "repair_kit",
});
