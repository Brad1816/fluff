// ---------------------------------------------------------------------------
// Summer heat (plan batch 5): the other deadly season.
//
// HEAT (placeHeat, 0 = fine .. 1 = scorching), in summer only:
//   outdoors  by the time of day: up to HEAT_OUTDOOR around mid-afternoon
//             (HEAT_PEAK_HOUR), nothing at night; less in rain
//   the house up to HEAT_INDOOR - stuffy, not deadly - and a running fan in
//             the room takes it away completely
// and for one fluffy (heatAt): shade under a park tree, a running sprinkler
// or a fan nearby (outdoors: within FAN_RADIUS) cool it; a running heater
// makes it worse. The incubator keeps its own temperature.
// HOT (f.heat, 0..1, saved) moves towards heat x exposure (foals, the old,
// the fat and a hot day suffer most; a fresh drink, a bath or the sprinkler
// cool it) over HEAT_SETTLE.
//   HOT_ABOVE      hot: wilting - unhappier, thirstier (hungrier) - and it
//                  goes looking for shade, water, a sprinkler or a fan
//                  (HeatDesire)
//   HEATSTROKE     losing health (foals and the old twice as fast); it can
//                  die of heatstroke
// THE WATER BOWL (Fluff Mart, $WATER_BOWL_PRICE): a drink cools a hot fluffy
// (DRINK_COOLS). It never runs dry. THE FAN ($FAN_PRICE): cools the room
// it's in (outdoors, FAN_RADIUS around it). Right-click: on or off.
// At night in summer fluffies outside greet the moon: the "nu-hawt-baww".
// Shown in the magnifying glass (Overview, "Heat").
// ---------------------------------------------------------------------------

const HEAT_OUTDOOR = 0.9;
const HEAT_INDOOR = 0.35;
const HEAT_PEAK_HOUR = 15;
const HEAT_SETTLE = 240;
const HOT_ABOVE = 0.45;
const HEATSTROKE = 0.75;
const FAN_RADIUS = 220;
const FAN_PRICE = 120;
const WATER_BOWL_PRICE = 15;
const DRINK_COOLS = 0.35;
const heatTicker = new Ticker(1);

function _hSeason() {
  return typeof getSeason === "function" ? getSeason() : "Spring";
}
function _hHour() {
  return typeof gameHour === "function" ? gameHour() : 12;
}

// The area's heat before fans and shade
function placeHeat(scene) {
  if (_hSeason() !== "Summer") return 0;
  const cfg = typeof getSceneConfig === "function" ? getSceneConfig(scene) : {};
  if (cfg && cfg.isStore) return 0;
  const h = _hHour();
  const day = Math.max(0, 1 - Math.abs(h - HEAT_PEAK_HOUR) / 6);
  if (day <= 0) return 0;
  const outdoor = typeof isOutdoorScene === "function" ? isOutdoorScene(scene) : false;
  const rain = typeof rainAmount === "function" ? rainAmount() : 0;
  if (outdoor) return HEAT_OUTDOOR * day * (1 - 0.6 * rain);
  return HEAT_INDOOR * day;
}

function _hOn(cls) {
  return typeof objects !== "undefined" && typeof cls !== "undefined" ? objects.filter((o) => o instanceof cls && o.on !== false && o.isOn !== false) : [];
}

function fansIn(scene) {
  return typeof Fan !== "undefined" ? _hOn(Fan).filter((o) => o.scene === scene) : [];
}

function heatAt(f) {
  if (typeof inIncubator === "function" && inIncubator(f)) return 0;
  let h = placeHeat(f.scene);
  if (h <= 0) return 0;
  const outdoor = typeof isOutdoorScene === "function" ? isOutdoorScene(f.scene) : false;
  const fans = fansIn(f.scene);
  if (fans.length) {
    if (!outdoor) return 0;
    const d = Math.min(...fans.map((o) => Math.hypot(o.x - f.x, o.y - f.y)));
    if (d < FAN_RADIUS) h *= 0.3 + 0.7 * (d / FAN_RADIUS);
  }
  if (typeof parkShelterNear === "function" && typeof PARK_SCENE !== "undefined" && f.scene === PARK_SCENE && parkShelterNear(f.x, f.y)) h -= 0.35;
  if (typeof Sprinkler !== "undefined" && objects.some((o) => o instanceof Sprinkler && o.isOn && o.scene === f.scene && Math.hypot(o.x - f.x, o.y - f.y) < 220)) h -= 0.5;
  if (typeof heatersIn === "function" && heatersIn(f.scene).some((o) => o.on !== false && Math.hypot(o.x - f.x, o.y - f.y) < 300)) h += 0.2;
  return Math.max(0, Math.min(1, h));
}

function heatExposure(f) {
  let e = 1;
  if (f.growth < 0.5) e *= 1.4;
  else if (f.growth < 1) e *= 1.15;
  const stage = typeof lifeStage === "function" ? lifeStage(f) : "adult";
  if (stage === "elderly") e *= 1.3;
  else if (stage === "senior") e *= 1.1;
  e *= 1 + 0.4 * (f.weight || 0);
  if (f.micro) e *= 1.3;
  if (typeof f._drankAt === "number" && timePlayed - f._drankAt < HOUR_LENGTH && timePlayed >= f._drankAt) e *= 0.6;
  if (typeof f._bathAt === "number" && timePlayed - f._bathAt < 2 * HOUR_LENGTH && timePlayed >= f._bathAt) e *= 0.6;
  if (f.currentStateKey === "SLEEPING") e *= 0.85;
  return e;
}

function heatTarget(f) {
  return Math.max(0, Math.min(1, heatAt(f) * heatExposure(f)));
}

// WorldTime.weatherHungerMultiplier: hot ones get thirsty
function heatHungerMultiplier(f) {
  const h = f.heat || 0;
  return h > HOT_ABOVE ? 1 + (0.5 * (h - HOT_ABOVE)) / (1 - HOT_ABOVE) : 1;
}

function updateHeat(dt) {
  const step = heatTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const summer = _hSeason() === "Summer";
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    if (typeof f.heat !== "number") f.heat = 0;
    if (!summer && f.heat === 0) continue;
    const t = summer ? heatTarget(f) : 0;
    f.heat += (t - f.heat) * Math.min(1, (step / HEAT_SETTLE) * 3);
    f.heat = Math.max(0, Math.min(1, f.heat));
    const h = f.heat;
    if (h > HOT_ABOVE) {
      if (f.happiness > WAN_DIE_THRESHOLD + 0.05) f.changeHappiness((-0.0008 * step * (h - HOT_ABOVE)) / (1 - HOT_ABOVE), "Too hot");
      if (f.currentStateKey !== "SLEEPING" && !f.tooYoungToSpeak() && Math.random() < 0.004 * step && typeof getDialogue === "function") f.speak(getDialogue(["HEAT", "HOT"], f));
    }
    if (h > HEATSTROKE) {
      const old = typeof lifeStage === "function" && lifeStage(f) === "elderly";
      const rate = (0.3 * (h - HEATSTROKE)) / (1 - HEATSTROKE);
      f.health -= rate * step * (f.growth < 0.5 || old ? 2 : 1);
      if (f.health <= 0) {
        f.health = 0;
        const mine = f.adopted;
        f.die(null, "Heatstroke");
        if (mine && typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(f)} died of heatstroke.`);
      }
    }
    // The nu-hawt-baww
    if (summer && f.currentStateKey !== "SLEEPING" && !f.tooYoungToSpeak() && typeof isNightTime === "function" && isNightTime() && typeof isOutdoorScene === "function" && isOutdoorScene(f.scene) && Math.random() < 0.0015 * step) {
      if (typeof getDialogue === "function") f.speak(getDialogue(["HEAT", "MOON"], f));
    }
  }
}
registerSystem("heat", updateHeat, 141);

// ---- Water bowl ----

class WaterBowl {
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
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
    }
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
    return Math.abs(px - this.x) < 30 && py > this.y - 22 && py < this.y + 8;
  }
  serialize() {
    return { classType: "WaterBowl", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: this.currentCage ? this.currentCage.id : null };
  }
  deserialize() {}
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    drawWaterBowlShape(ctx, this.x, this.y, 1);
  }
}

function drawWaterBowlShape(c, x, y, k = 1) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.fillStyle = "#3d7bd1";
  c.strokeStyle = "#1f3f6d";
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(0, -8, 28, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = "#9fd4ff";
  c.beginPath();
  c.ellipse(0, -11, 21, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drinkWater(f) {
  f.heat = Math.max(0, (f.heat || 0) - DRINK_COOLS);
  f._drankAt = timePlayed;
  f.changeHappiness(0.02, "A cool drink");
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["HEAT", "DRINK"], f));
}

// ---- Fan ----

class Fan {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.on = true;
    this._spin = 0;
  }
  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = Math.max(mouse.y + this.dragOffset.y, sceneTop(this.scene) + 10);
    }
    if (this.on) this._spin += dt * 12;
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
    return Math.abs(px - this.x) < 30 && py > this.y - 80 && py < this.y + 4;
  }
  serialize() {
    return { classType: "Fan", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: null, on: this.on };
  }
  deserialize(d) {
    if (typeof d.on === "boolean") this.on = d.on;
  }
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    drawFanShape(ctx, this.x, this.y, 1, this.on ? this._spin : 0, this.on);
  }
}

function drawFanShape(c, x, y, k = 1, spin = 0, on = true) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.strokeStyle = "#2b2f33";
  c.lineWidth = 2;
  c.fillStyle = "#cfd6dc";
  c.fillRect(-4, -48, 8, 44);
  c.beginPath();
  c.ellipse(0, -4, 20, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Head
  c.translate(0, -60);
  c.fillStyle = on ? "#eaf6ff" : "#aab";
  c.beginPath();
  c.arc(0, 0, 20, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.rotate(spin);
  c.fillStyle = "#7fb3d5";
  for (let i = 0; i < 3; i++) {
    c.rotate((Math.PI * 2) / 3);
    c.beginPath();
    c.ellipse(9, 0, 9, 4, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// ---- Looking for relief ----

function _hReliefSpot(f) {
  const cands = [];
  for (const o of objects) {
    if (o.scene !== f.scene) continue;
    if (o instanceof WaterBowl) cands.push({ x: o.x, y: o.y, kind: "water", o });
    else if (o instanceof Fan && o.on) cands.push({ x: o.x + 40, y: o.y + 10, kind: "fan" });
    else if (typeof Sprinkler !== "undefined" && o instanceof Sprinkler && o.isOn) cands.push({ x: o.x + 60, y: o.y, kind: "sprinkler" });
  }
  if (typeof PARK_SCENERY !== "undefined" && typeof PARK_SCENE !== "undefined" && f.scene === PARK_SCENE) for (const t of PARK_SCENERY) if (t.kind === "tree") cands.push({ x: t.x, y: t.y + 10, kind: "shade" });
  let best = null;
  let bd = 1200;
  for (const c of cands) {
    const d = Math.hypot(c.x - f.x, c.y - f.y);
    if (d < bd && (typeof canFluffyReach !== "function" || canFluffyReach(f, c.x, c.y))) {
      bd = d;
      best = c;
    }
  }
  return best;
}

class HeatDesire extends Desire {
  constructor() {
    super("Heat");
  }
  evaluate(h) {
    if (!h.isAlive || (h.heat || 0) < HOT_ABOVE || h.isDragging || h.placedOn || h.currentCage || h.tooYoungToWalk()) return 0;
    if (typeof h._drankAt === "number" && timePlayed - h._drankAt < HOUR_LENGTH / 2 && timePlayed >= h._drankAt && h.heat < HEATSTROKE) return 0;
    const spot = _hReliefSpot(h);
    if (!spot) return 0;
    this.spot = spot;
    return 50 + 30 * h.heat;
  }
  execute(h) {
    const s = this.spot;
    if (!s) return false;
    if (Math.hypot(s.x - h.x, s.y - h.y) > 45) {
      if (!h.isMovingOrRunning()) h.initBehavior("MOVING");
      h.setTargetPosition(s.x, s.y);
      return true;
    }
    if (s.kind === "water") drinkWater(h);
    else if (h.currentStateKey !== "LYING") {
      h.initBehavior("LYING");
      h.stateTimer = 5;
    }
    return true;
  }
}

function describeHeat(f) {
  const h = f && f.heat;
  if (!(h > 0.2)) return null;
  if (h > HEATSTROKE) return ["Heatstroke! Get it into the shade, water or indoors", "bad"];
  if (h > HOT_ABOVE) return ["Too hot: wilting", "bad"];
  return ["Warm", "ok"];
}

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push(
    { name: "Water bowl", desc: "A bowl of cool water that never runs dry. A hot fluffy has a drink and cools down (summer).", cost: WATER_BOWL_PRICE, isItem: "water_bowl" },
    { name: "Fan", desc: "Cools the room it's in on hot summer days (outdoors, the area around it). Right-click to switch it off or on.", cost: FAN_PRICE, isItem: "fan" },
  );
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push(
    {
      sellType: "water_bowl",
      is: (o) => o instanceof WaterBowl,
      hitTest: (o, x, y) => o.hitTest(x, y),
      sellable: true,
      create: (a, sx, sy) => {
        const b = new WaterBowl(currentScene);
        b.setPosition(sx, sy);
        return b;
      },
      drawIcon: (ctx) => drawWaterBowlShape(ctx, 0, 14, 0.8),
    },
    {
      sellType: "fan",
      is: (o) => o instanceof Fan,
      hitTest: (o, x, y) => o.hitTest(x, y),
      sellable: true,
      create: (a, sx, sy) => {
        const fan = new Fan(currentScene);
        fan.setPosition(sx, sy);
        return fan;
      },
      drawIcon: (ctx) => drawFanShape(ctx, 0, 30, 0.42, 0.4, true),
      onRightClick: (o) => {
        o.on = !o.on;
        if (typeof addUIMessage === "function") addUIMessage(`The fan is ${o.on ? "on" : "off"}.`);
      },
    },
  );
}
if (typeof SAVED_CLASSES !== "undefined") {
  SAVED_CLASSES.WaterBowl = (d) => new WaterBowl(d.scene);
  SAVED_CLASSES.Fan = (d) => new Fan(d.scene);
}
