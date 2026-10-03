// ---------------------------------------------------------------------------
// Day and night, seasons and weather.
//
// TIME (worked out from the game clock, timePlayed, so it's saved and
// follows fast forward):
//   - A day is DAY_LENGTH game seconds (20 minutes at 1x). A new game
//     starts at 8:00 in the morning of day 1, in spring.
//   - Night is 21:00-6:00. It gets dark from 18:00 (sunset glow) and light
//     from 5:00 (sunrise glow).
//   - Each season lasts DAYS_PER_SEASON days: Spring, Summer, Autumn, Winter.
//
// WEATHER (weatherState, saved): clear, cloudy, rain, storm or snow,
// picked by season every few game hours, fading in and out.
//
// WHAT IT DOES
//   - Outdoor areas get darker at night, orange at sunrise/sunset, grey
//     under clouds; rain, snow and lightning are drawn over them. Indoors is
//     only a little dimmer at night (the lights are on).
//   - Sleep: at night fluffies get tired faster and sleep longer; in the day
//     the opposite (sleepRateMultipliers, used in HorseUpdate.js). The Sleep desire
//     also kicks in sooner at night (HorseBrain.js).
//   - Rain/storms upset fluffies that are out in them; in the park they run
//     for cover under the trees (ShelterDesire). Thunder startles them.
//   - Snow: outdoor fluffies get hungry faster and are a bit miserable.
//   - Grass and berries grow by season and weather (growthMultiplier):
//     lush in spring and after rain, berries in autumn, next to nothing in
//     winter - which makes the park herds fight harder over food.
//   - At night park herds head home to their meadow, and no new wild groups
//     wander in (ParkLife.js / Territory.js).
// ---------------------------------------------------------------------------

const DAY_LENGTH = 1200; // game seconds in a day
const HOUR_LENGTH = DAY_LENGTH / 24;
const START_HOUR = 8;
const DAYS_PER_SEASON = 3; // a 12-day year: one game day ~ a month of a fluffy's life (Aging.js)
const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];

// Chances of each weather, per season
const WEATHER_CHANCES = {
  Spring: { clear: 0.35, cloudy: 0.3, rain: 0.3, storm: 0.05 },
  Summer: { clear: 0.6, cloudy: 0.2, rain: 0.1, storm: 0.1 },
  Autumn: { clear: 0.3, cloudy: 0.35, rain: 0.28, storm: 0.07 },
  Winter: { clear: 0.3, cloudy: 0.3, snow: 0.4 },
};
const WEATHER_NAMES = { clear: "Clear", cloudy: "Cloudy", rain: "Rain", storm: "Thunderstorm", snow: "Snow" };
const WEATHER_FADE = 15; // seconds to fade in or out

function freshWeatherState() {
  return { type: "clear", target: "clear", intensity: 1, until: 3 * HOUR_LENGTH, snowCover: 0 };
}
let weatherState = freshWeatherState();
let _lightning = 0; // flash brightness, 0..1
let _thunderTimer = 10;
let _weatherTick = 0;

// ---- Time ----

function _clockSeconds() {
  return (typeof timePlayed === "number" ? timePlayed : 0) + START_HOUR * HOUR_LENGTH;
}

// 0..24
function gameHour() {
  return (_clockSeconds() % DAY_LENGTH) / HOUR_LENGTH;
}

function getDayNumber() {
  return Math.floor(_clockSeconds() / DAY_LENGTH) + 1;
}

function getSeason() {
  return SEASONS[Math.floor((getDayNumber() - 1) / DAYS_PER_SEASON) % SEASONS.length];
}

// 0 = full day, 1 = full night, in between at dusk and dawn
function nightAmount(hour = gameHour()) {
  if (hour >= 21 || hour < 5) return 1;
  if (hour >= 18) return (hour - 18) / 3;
  if (hour < 7) return 1 - (hour - 5) / 2;
  return 0;
}

function isNightTime(hour = gameHour()) {
  return hour >= 21 || hour < 6;
}

// Orange glow around sunrise and sunset, 0..1
function sunGlow(hour = gameHour()) {
  const peak = (h, c, w) => Math.max(0, 1 - Math.abs(h - c) / w);
  return Math.max(peak(hour, 19.5, 1.8), peak(hour, 6, 1.3));
}

// "7:40 PM"
function formatClockTime(hour = gameHour()) {
  let h = Math.floor(hour);
  const m = Math.floor(((hour - h) * 60) / 10) * 10; // to 10 minutes
  const ampm = h < 12 ? "AM" : "PM";
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function describeWorldTime() {
  return `Day ${getDayNumber()} · ${formatClockTime()}`;
}

function describeWeather() {
  const w = weatherState.target !== weatherState.type ? weatherState.target : weatherState.type;
  // How cold it is where you are (Warmth.js)
  const temp = typeof describeTemperature === "function" ? describeTemperature() : "";
  return `${getSeason()} · ${WEATHER_NAMES[w] || "Clear"}${temp ? ` · ${temp}` : ""}`;
}

// ---- Weather ----

function _rollWeather() {
  const chances = WEATHER_CHANCES[getSeason()];
  let r = Math.random();
  for (const [type, p] of Object.entries(chances)) {
    r -= p;
    if (r <= 0) return type;
  }
  return "clear";
}

function setWeather(type, hours = 3) {
  weatherState.target = type;
  weatherState.until = (typeof timePlayed === "number" ? timePlayed : 0) + hours * HOUR_LENGTH;
}

// How strongly it's raining (0..1; storms count double for the drawing)
function rainAmount() {
  const t = weatherState.type;
  return t === "rain" || t === "storm" ? weatherState.intensity : 0;
}
function snowAmount() {
  return weatherState.type === "snow" ? weatherState.intensity : 0;
}
function isStorming() {
  return weatherState.type === "storm" && weatherState.intensity > 0.5;
}

function isOutdoorScene(scene) {
  const cfg = typeof getSceneConfig === "function" ? getSceneConfig(scene) : null;
  return !!(cfg && cfg.isOutdoor);
}

// ---- Effects on fluffies and plants ----

// [getting tired, resting] speed multipliers (Horse.js)
function sleepRateMultipliers() {
  const n = nightAmount();
  return [0.8 + 1.4 * n, 1 - 0.65 * n];
}

// Outdoor fluffies burn more food in the snow (Horse.js hunger)
function weatherHungerMultiplier(f) {
  // ...and cold fluffies anywhere (Warmth.js)
  const cold = typeof coldHungerMultiplier === "function" ? coldHungerMultiplier(f) : 1;
  // ...and hot ones get thirsty (Heat.js)
  const hot = typeof heatHungerMultiplier === "function" ? heatHungerMultiplier(f) : 1;
  return (isOutdoorScene(f.scene) ? 1 + 0.4 * snowAmount() : 1) * cold * hot;
}

// How fast grass / berries grow right now (Grass.js, ParkLife.js)
function growthMultiplier(kind = "grass") {
  const season = getSeason();
  let m = 1;
  if (kind === "berries") m = { Spring: 1, Summer: 1.2, Autumn: 1.8, Winter: 0 }[season];
  else m = { Spring: 1.5, Summer: 1, Autumn: 0.8, Winter: 0.15 }[season];
  if (kind === "grass") m *= 1 + 0.5 * rainAmount();
  return m;
}

// Is a park fluffy under a tree?
function parkShelterNear(x, y, range = 70) {
  if (typeof PARK_SCENERY === "undefined") return null;
  let best = null;
  let bd = range;
  for (const t of PARK_SCENERY) {
    if (t.kind !== "tree") continue;
    const d = Math.hypot(t.x - x, (t.y + 10 - y) * 1.5);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

function _sheltered(f) {
  return f.scene === (typeof PARK_SCENE !== "undefined" ? PARK_SCENE : "PARK") && !!parkShelterNear(f.x, f.y);
}

function _fluffySays(f, key) {
  sayIfAwake(f, ["WEATHER", key]); // (globals.js)
}

let _wsFilled = null; // (the weather state last checked for missing fields)
// script.js updateSimulation
function updateWorldTime(dt) {
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  // Old saves / odd data: fill in anything missing
  if (!weatherState || typeof weatherState !== "object") weatherState = freshWeatherState();
  if (_wsFilled !== weatherState || weatherState.until === undefined || weatherState.until === null) {
    for (const [k, v] of Object.entries(freshWeatherState())) {
      if (weatherState[k] === undefined || weatherState[k] === null) weatherState[k] = k === "until" ? now : v;
    }
    _wsFilled = weatherState;
  }
  const w = weatherState;

  // Pick the next weather when it's time
  if (now >= w.until) {
    setWeather(_rollWeather(), 2 + Math.random() * 4);
  }
  // Fade out the old weather, then in the new one
  if (w.target !== w.type) {
    w.intensity -= dt / WEATHER_FADE;
    if (w.intensity <= 0) {
      w.type = w.target;
      w.intensity = 0;
    }
  } else if (w.intensity < 1) {
    w.intensity = Math.min(1, w.intensity + dt / WEATHER_FADE);
  }
  // Snow settles and melts
  if (w.type === "snow") w.snowCover = Math.min(1, w.snowCover + (dt / 120) * w.intensity);
  else w.snowCover = Math.max(0, w.snowCover - dt / (getSeason() === "Winter" ? 600 : 90));

  // Lightning
  _lightning = Math.max(0, _lightning - dt * 2.5);
  if (isStorming()) {
    _thunderTimer -= dt;
    if (_thunderTimer <= 0) {
      _thunderTimer = 12 + Math.random() * 25;
      _lightning = 1;
      if (typeof onThunder === "function") onThunder(); // fluffies scared of thunder (Fears.js)
      for (const f of fluffies) {
        if (!f.isAlive || !isOutdoorScene(f.scene) || f.currentStateKey === "SLEEPING" || Math.random() > 0.35)
          continue;
        f.expressionOverride = "CRYING_SHOCKED";
        f.expressionOverrideTimer = 2;
        f.changeHappiness(-0.02, "Thunder");
        _fluffySays(f, "THUNDER");
      }
    }
  }

  // Once a second: how the weather feels to fluffies outside
  _weatherTick -= dt;
  if (_weatherTick > 0) return;
  _weatherTick = 1;
  const rain = rainAmount();
  const snow = snowAmount();
  const hour = gameHour();
  for (const f of fluffies) {
    if (!f.isAlive || !isOutdoorScene(f.scene) || f.currentCage) continue;
    const asleep = f.currentStateKey === "SLEEPING";
    if (rain > 0.3 && !_sheltered(f)) {
      if (f.happiness > WAN_DIE_THRESHOLD + 0.05) f.changeHappiness(-0.0012 * rain, "Rained on");
      if (!asleep && Math.random() < 0.012) _fluffySays(f, "RAIN");
    } else if (snow > 0.3) {
      if (f.happiness > WAN_DIE_THRESHOLD + 0.05) f.changeHappiness(-0.0006 * snow, "Snowed on");
      if (!asleep && Math.random() < 0.008) _fluffySays(f, "SNOW");
    } else if (!asleep && weatherState.type === "clear" && hour > 9 && hour < 17 && Math.random() < 0.002) {
      _fluffySays(f, "SUNNY");
    }
    if (!asleep && nightAmount(hour) > 0.9 && Math.random() < 0.002) _fluffySays(f, "NIGHT");
  }
}

// ---- Park: run for cover when it rains ----

class ShelterDesire extends Desire {
  constructor() {
    super("Shelter");
    this.lastTime = -Infinity;
  }
  evaluate(horse) {
    if (rainAmount() < 0.3 || horse.scene !== (typeof PARK_SCENE !== "undefined" ? PARK_SCENE : "PARK")) return 0;
    if (!horse.isAlive || horse.isDragging || horse.placedOn || horse.isScared || horse.currentCage) return 0;
    if (horse.sleepingOrTargetSet() || horse.tooYoungToWalk() || !horse.canSee()) return 0;
    if (horse.hunger < 0.3) return 0;
    if (_sheltered(horse)) {
      // Already under a tree: stay put (beats wandering and following)
      return horse.isMovingOrRunning() ? 0 : 47.5;
    }
    if (gameTimeMs() - this.lastTime < 3000) return 0;
    // Nearest tree without a rival herd under it
    let best = null;
    let bd = 900;
    for (const t of PARK_SCENERY) {
      if (t.kind !== "tree") continue;
      const d = Math.hypot(t.x - horse.x, t.y - horse.y);
      if (d >= bd) continue;
      const rivalThere = fluffies.some(
        (f) =>
          f !== horse &&
          f.isAlive &&
          f.scene === horse.scene &&
          Math.hypot(f.x - t.x, f.y - t.y) < 110 &&
          typeof keepsApart === "function" &&
          keepsApart(horse, f),
      );
      if (rivalThere) continue;
      bd = d;
      best = t;
    }
    if (!best) {
      this.lastTime = gameTimeMs(); // (no tree free: look again in a few seconds, not every think)
      return 0;
    }
    this.tree = best;
    return 49;
  }
  execute(horse) {
    if (_sheltered(horse)) return true; // stay
    this.lastTime = gameTimeMs();
    const t = this.tree;
    if (!t) return false;
    horse.initBehavior("MOVING");
    horse.setTargetPosition(t.x + (Math.random() - 0.5) * 60, t.y + 5 + Math.random() * 15);
    horse.currentStateKey = "RUNNING";
    if (Math.random() < 0.3) _fluffySays(horse, "RAIN");
    return true;
  }
}

// ---- Drawing ----

// Snow lying on the ground (world positions; after the background)
function drawWeatherGround(c) {
  const cover = weatherState.snowCover || 0;
  if (cover <= 0.01 || !isOutdoorScene(currentScene)) return;
  c.save();
  c.fillStyle = `rgba(245, 248, 255, ${(0.55 * cover).toFixed(3)})`;
  if (typeof isCameraScene === "function" && isCameraScene(currentScene)) {
    c.fillRect(camera.x, camera.y, width, height);
  } else {
    const top = typeof sceneTop === "function" ? sceneTop(currentScene) : height * 0.15;
    c.fillRect(0, top, width, height - top);
  }
  c.restore();
}

function _hash(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Sky, rain, snow, lightning over the whole screen (screen positions;
// script.js render, before the UI)
function drawSkyAndWeather(c) {
  const outdoor = isOutdoorScene(currentScene);
  const night = nightAmount();
  // Real time for the rain/snow movement so it looks the same at any speed
  const rt = performance.now() / 1000;
  c.save();

  if (!outdoor) {
    if (night > 0) {
      c.fillStyle = `rgba(20, 25, 60, ${(0.18 * night).toFixed(3)})`;
      c.fillRect(0, 0, width, height);
    }
    c.restore();
    return;
  }

  // Clouds
  const w = weatherState;
  const cloud = { clear: 0, cloudy: 0.12, rain: 0.22, storm: 0.32, snow: 0.1 }[w.type] * w.intensity;
  if (cloud > 0) {
    c.fillStyle = `rgba(70, 80, 95, ${cloud.toFixed(3)})`;
    c.fillRect(0, 0, width, height);
  }
  // Sunrise / sunset glow
  const glow = sunGlow() * (1 - cloud * 2);
  if (glow > 0) {
    c.fillStyle = `rgba(255, 120, 40, ${(0.16 * glow).toFixed(3)})`;
    c.fillRect(0, 0, width, height);
  }
  // Night
  if (night > 0) {
    c.fillStyle = `rgba(8, 14, 45, ${(0.55 * night).toFixed(3)})`;
    c.fillRect(0, 0, width, height);
  }

  // Rain
  const rain = rainAmount();
  if (rain > 0) {
    const n = Math.round((w.type === "storm" ? 260 : 160) * rain);
    c.strokeStyle = "rgba(190, 210, 255, 0.55)";
    c.lineWidth = 1.3;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const speed = 900 + _hash(i, 1) * 500;
      const x = (_hash(i, 2) * (width + 200) - rt * 180) % (width + 200);
      const y = (_hash(i, 3) * height + rt * speed) % height;
      const xx = x < 0 ? x + width + 200 : x;
      c.moveTo(xx, y);
      c.lineTo(xx - 5, y + 16);
    }
    c.stroke();
  }
  // Snow
  const snow = snowAmount();
  if (snow > 0) {
    const n = Math.round(140 * snow);
    c.fillStyle = "rgba(255, 255, 255, 0.85)";
    for (let i = 0; i < n; i++) {
      const speed = 40 + _hash(i, 4) * 50;
      const y = (_hash(i, 5) * height + rt * speed) % height;
      const x = (_hash(i, 6) * width + Math.sin(rt * 0.8 + i) * 25 + width) % width;
      c.beginPath();
      c.arc(x, y, 1.5 + _hash(i, 7) * 2, 0, Math.PI * 2);
      c.fill();
    }
  }
  // Lightning flash
  if (_lightning > 0) {
    c.fillStyle = `rgba(235, 240, 255, ${(0.6 * _lightning).toFixed(3)})`;
    c.fillRect(0, 0, width, height);
  }
  c.restore();
}

registerSystem("worldTime", updateWorldTime, 50);
