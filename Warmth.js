// ---------------------------------------------------------------------------
// Warmth and heating: winter is cold, most of all out in the park at night.
//
// COLD (placeColdness, 0 = comfortable .. 1 = freezing) for each area:
//   outdoors  by season (Spring 0.15, Summer 0, Autumn 0.3, Winter 0.7),
//             + up to 0.2 at night, + 0.2 in snow, + 0.1 in rain
//   the house by season (Autumn 0.1, Winter 0.35), + a little at night -
//             chilly in winter, not freezing
//   shops     heated (0)
// and for one fluffy (coldAt): a working heater in the same house room
// takes the cold away completely; outdoors a heater warms HEATER_RADIUS
// around it; a park tree keeps a bit of the weather off.
//
// WARMTH (f.warmth, 0..1, saved): every second it moves towards 1 - cold x
// exposure, taking about WARMTH_SETTLE seconds (a few game hours).
// Exposure (warmthExposure) is higher for foals (x1.5, x1.2 older ones) and
// the elderly (x1.3), lower in a scarf (x0.7) or wingjacket (x0.75), asleep
// in a bed (x0.6) and huddled up with others (x0.75 with one, x0.55 with
// two or more close by). So a herd sleeping together gets through a winter
// night; a lone foal in the snow doesn't.
//   under 0.6  chilly: unhappier and hungrier (coldHungerMultiplier)
//   under 0.3  freezing: losing health, and can freeze to death
//
// HEATERS (the Heater item, Fluff Mart, delivered): warm the room they're
// in. They only run when it's cold (a thermostat) and cost
// HEATER_COST_PER_DAY a day while they do, taken as they run; yesterday's
// bill goes on the morning news. Right-click one to turn it off or on.
// Saved: heatingState (SAVED_GAME_STATE), f.warmth (SAVED_HORSE_FIELDS).
// ---------------------------------------------------------------------------

const WARMTH_SETTLE = 300; // seconds for warmth to move most of the way
const CHILLY_BELOW = 0.6;
const FREEZING_BELOW = 0.3;
const HEATER_RADIUS = 240; // outdoors
const HEATER_COST_PER_DAY = 30;
const HEATER_PRICE = 400;
const warmthTicker = new Ticker(1);

function freshHeatingState() {
  return { owed: 0, today: 0, day: 1 };
}
let heatingState = freshHeatingState();

// ---- How cold it is ----

function _isHouseRoom(scene) {
  return typeof playerQuartersAndNotBackyard === "function" && playerQuartersAndNotBackyard(scene);
}

function _season() {
  return typeof getSeason === "function" ? getSeason() : "Spring";
}

// The area's cold before any heaters
function placeColdness(scene) {
  const cfg = typeof getSceneConfig === "function" ? getSceneConfig(scene) : {};
  const season = _season();
  const night = typeof nightAmount === "function" ? nightAmount() : 0;
  if (cfg && cfg.isStore) return 0; // the shop is heated
  let c;
  if (cfg && cfg.isOutdoor) {
    c = { Spring: 0.15, Summer: 0, Autumn: 0.3, Winter: 0.7 }[season] ?? 0;
    c += (season === "Summer" ? 0.1 : 0.2) * night; // (warm summer nights)
    c += 0.2 * (typeof snowAmount === "function" ? snowAmount() : 0);
    c += 0.1 * (typeof rainAmount === "function" ? rainAmount() : 0);
  } else {
    c = { Spring: 0, Summer: 0, Autumn: 0.1, Winter: 0.35 }[season] ?? 0;
    if (season === "Autumn" || season === "Winter") c += 0.1 * night;
    if (!_isHouseRoom(scene)) c *= 0.5; // other indoor places are mostly heated
  }
  return Math.max(0, Math.min(1, c));
}

function heatersIn(scene) {
  if (typeof Heater === "undefined") return [];
  // (no power while you're in debt, Pressure.js)
  if (typeof powerCut === "function" && powerCut()) return [];
  return objects.filter((o) => o instanceof Heater && o.scene === scene && o.on && !o.isDragging);
}

// Is this house room kept warm by a heater?
function roomIsHeated(scene) {
  return _isHouseRoom(scene) && heatersIn(scene).length > 0;
}

// The cold one fluffy feels where it is
function coldAt(f) {
  let c = placeColdness(f.scene);
  if (c <= 0) return 0;
  const heaters = heatersIn(f.scene);
  if (heaters.length) {
    if (_isHouseRoom(f.scene)) return 0;
    let d = Infinity;
    for (const h of heaters) d = Math.min(d, Math.hypot(h.x - f.x, h.y - f.y));
    if (d < HEATER_RADIUS) c *= 0.15 + 0.85 * (d / HEATER_RADIUS);
  }
  if (typeof parkShelterNear === "function" && typeof PARK_SCENE !== "undefined" && f.scene === PARK_SCENE && parkShelterNear(f.x, f.y))
    c -= 0.15;
  return Math.max(0, c);
}

// How much of the cold gets to it
function warmthExposure(f) {
  let e = 1;
  if (f.growth < 0.5) e *= 1.5;
  else if (f.growth < 1) e *= 1.2;
  const stage = typeof lifeStage === "function" ? lifeStage(f) : "adult";
  if (stage === "elderly") e *= 1.3;
  else if (stage === "senior") e *= 1.1;
  const acc = f.accessories || {};
  if (acc.neck && acc.neck.id === "scarf") e *= 0.7;
  if (acc.torso && acc.torso.id === "wingjacket") e *= 0.75;
  const asleep = f.currentStateKey === "SLEEPING";
  if (asleep && typeof Bed !== "undefined" && objects.some((b) => b instanceof Bed && b.scene === f.scene && Math.hypot(b.x - f.x, b.y - f.y) < 60))
    e *= 0.6;
  // Huddled up with others
  let near = 0;
  for (const o of fluffies) {
    if (o === f || !o.isAlive || o.scene !== f.scene || o.currentCage !== f.currentCage) continue;
    if (Math.abs(o.x - f.x) < 60 && Math.abs(o.y - f.y) < 45) near++;
    if (near >= 2) break;
  }
  if (near >= 2) e *= 0.55;
  else if (near === 1) e *= 0.75;
  return e;
}

function warmthTarget(f) {
  return Math.max(0, Math.min(1, 1 - coldAt(f) * warmthExposure(f)));
}

// Hunger (WorldTime.js weatherHungerMultiplier): cold fluffies burn more
function coldHungerMultiplier(f) {
  const w = f.warmth ?? 1;
  return w < CHILLY_BELOW ? 1 + (0.6 * (CHILLY_BELOW - w)) / CHILLY_BELOW : 1;
}

// ---- Every second ----

function updateWarmth(dt) {
  const step = warmthTicker.step(dt);
  if (!step) return;
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    if (typeof f.warmth !== "number") f.warmth = 1;
    const target = warmthTarget(f);
    f.warmth += (target - f.warmth) * Math.min(1, step / WARMTH_SETTLE) * 3;
    f.warmth = Math.max(0, Math.min(1, f.warmth));
    const w = f.warmth;
    if (w < CHILLY_BELOW) {
      if (f.happiness > WAN_DIE_THRESHOLD + 0.05) f.changeHappiness((-0.0008 * step * (CHILLY_BELOW - w)) / CHILLY_BELOW);
      if (f.currentStateKey !== "SLEEPING" && !f.tooYoungToSpeak() && Math.random() < 0.004 * step && typeof getDialogue === "function")
        f.speak(getDialogue(["WEATHER", "COLD"], f));
    }
    if (w < FREEZING_BELOW) {
      const rate = (0.25 * (FREEZING_BELOW - w)) / FREEZING_BELOW;
      f.health -= rate * step * (f.growth < 0.5 ? 2 : 1);
      if (f.health <= 0) {
        f.health = 0;
        const mine = f.adopted;
        f.die(null, "Froze to death");
        if (mine && typeof addUIMessage === "function") {
          const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
          addUIMessage(`${name} froze to death.`);
        }
      }
    }
  }
  _runHeaters(step);
}

function _runHeaters(step) {
  const s = heatingState && typeof heatingState === "object" ? heatingState : (heatingState = freshHeatingState());
  const day = typeof getDayNumber === "function" ? getDayNumber() : 1;
  if (s.day !== day) {
    if (s.today > 0) {
      const text = `Heating bill yesterday: $${Math.round(s.today)}.`;
      if (typeof noteDayEvent === "function") noteDayEvent("news", { text });
      if (typeof addUIMessage === "function") addUIMessage(text);
    }
    s.day = day;
    s.today = 0;
  }
  if (typeof Heater === "undefined") return;
  const perSecond = HEATER_COST_PER_DAY / DAY_LENGTH;
  for (const h of objects) {
    if (!(h instanceof Heater)) continue;
    h.heating = h.on && placeColdness(h.scene) > 0.05 && !(typeof powerCut === "function" && powerCut());
    if (!h.heating) continue;
    s.owed += perSecond * step;
  }
  if (s.owed >= 1) {
    const whole = Math.floor(s.owed);
    s.owed -= whole;
    s.today += whole;
    if (!(typeof showDebugMenu !== "undefined" && showDebugMenu)) money -= whole;
  }
}

// ---- What you see ----

// Magnifying glass: null (warm) or [text, tone]
function describeWarmth(f) {
  const w = f && typeof f.warmth === "number" ? f.warmth : 1;
  if (!f || !f.isAlive || w >= 0.8) return null;
  if (w >= CHILLY_BELOW) return ["A little cold", "ok"];
  if (w >= FREEZING_BELOW) return ["Chilly: unhappy and hungry", "bad"];
  return ["Freezing - losing health!", "bad"];
}

// Top bar: how it feels where you are ("" when it's fine)
function describeTemperature(scene = currentScene) {
  if (roomIsHeated(scene)) return placeColdness(scene) > 0.05 ? "Heated" : "";
  const c = placeColdness(scene);
  if (c < 0.12) return "";
  if (c < 0.3) return "Cool";
  if (c < 0.6) return "Cold";
  return "Freezing";
}

// A snowflake by fluffies that are cold (script.js, with the speech bubbles)
function drawColdMarker(c, f) {
  const w = typeof f.warmth === "number" ? f.warmth : 1;
  if (!f.isAlive || w >= CHILLY_BELOW) return;
  const s = Math.sqrt(f.scale * 2.0);
  const x = f.x + 38 * s;
  const y = f.y - 42 * s;
  const shiver = w < FREEZING_BELOW ? Math.sin(performance.now() / 45) * 1.5 : 0;
  c.save();
  c.font = `bold ${Math.round((w < FREEZING_BELOW ? 30 : 22) * Math.max(0.9, Math.min(1.3, s)))}px Arial`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = 3;
  c.strokeStyle = "rgba(20,40,80,0.8)";
  c.strokeText("❄", x + shiver, y);
  c.fillStyle = w < FREEZING_BELOW ? "#7fd4ff" : "#d6f1ff";
  c.fillText("❄", x + shiver, y);
  c.restore();
}

// ---- The heater (Fluff Mart, Home & Play) ----

class Heater {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.on = true;
    this.heating = false;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      this.y = Math.max(this.y, sceneTop(this.scene) + 10);
    }
    if (typeof handleGenericCageContainment === "function") handleGenericCageContainment(this, 70, 56);
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
    return px >= this.x - 38 && px <= this.x + 38 && py >= this.y - 60 && py <= this.y + 2;
  }

  serialize() {
    return {
      classType: "Heater",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      on: this.on,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.on = data.on !== false;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    drawHeaterShape(ctx, this.x, this.y, 1, this.on, this.heating);
  }
}

// A little radiator; (x, y) is the middle of its bottom
function drawHeaterShape(c, x, y, k = 1, on = true, heating = false) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  if (heating) {
    // Warm glow and shimmer
    const g = c.createRadialGradient(0, -28, 5, 0, -28, 70);
    g.addColorStop(0, "rgba(255, 150, 60, 0.35)");
    g.addColorStop(1, "rgba(255, 150, 60, 0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, -28, 70, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255, 190, 120, 0.6)";
    c.lineWidth = 2;
    const t = performance.now() / 300;
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      for (let yy = 0; yy <= 22; yy += 2) {
        const xx = i * 14 + Math.sin(t + yy / 4 + i) * 3;
        if (yy === 0) c.moveTo(xx, -62 - yy);
        else c.lineTo(xx, -62 - yy);
      }
      c.stroke();
    }
  }
  // Feet
  c.fillStyle = "#6d6d6d";
  c.fillRect(-30, -6, 8, 6);
  c.fillRect(22, -6, 8, 6);
  // Body and fins
  c.fillStyle = "#e8e4dc";
  c.strokeStyle = "#4a4a4a";
  c.lineWidth = 2;
  c.beginPath();
  if (c.roundRect) c.roundRect(-34, -58, 68, 52, 6);
  else c.rect(-34, -58, 68, 52);
  c.fill();
  c.stroke();
  c.strokeStyle = "#a9a49a";
  for (let i = -24; i <= 24; i += 8) {
    c.beginPath();
    c.moveTo(i, -52);
    c.lineTo(i, -12);
    c.stroke();
  }
  // Dial and light
  c.fillStyle = on ? (heating ? "#ff5a2a" : "#f7c948") : "#555";
  c.beginPath();
  c.arc(24, -50, 4, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

SPAWN_ACTIONS.push({
  name: "Heater",
  desc: "Keeps a room warm in the cold months. Uses power only when it's cold. Right-click to switch off.",
  cost: HEATER_PRICE,
  isItem: "heater",
});

registerSystem("warmth", updateWarmth, 145);
