// ---------------------------------------------------------------------------
// Room climate (design doc Phase 3): every room has a feel that comes from
// what happens in it. A light nudge, not a new stat to manage.
//
// What happens in a room (StoryBook.recordStory calls noteClimateStory)
// adds to four scores for that room, which fade away over a few days
// (CLIMATE_TAU):
//   warm   brushing, cuddles, play, treats, toys, praise, comfort, births,
//          tricks, wishes coming true
//   tense  fights, being picked on, harsh lessons
//   fear   harm from you, frights, nightmares, scars and injuries
//   grief  deaths, stillbirths, family sold or taken away
// Also, while it lasts: a crowded room is tense, a tense room next door
// makes this one a little uneasy, and an old, contented fluffy in the room
// keeps everyone calmer.
//
// The feel (climateOf):
//   Warm      happier (they settle a bit higher), learn a little faster,
//             play more; those who love you run to you at the door
//   Calm      nothing special
//   Uneasy    a little less happy
//   Tense     less happy, learn slower, keep still more, go quiet at the
//             door
//   Fearful   less happy, learn slower, frights hit harder; fluffies that
//             fear you scatter when you come in
//   Grieving  less happy, play less
// It's shown next to the room's name at the top (with a trend arrow);
// hover it for why.
// Fluffies that fear you flinch when your hand comes close, anywhere.
// You hear it too: happy chirps in a Warm room, whimpers in a Fearful or
// Grieving one. Foals growing up in a Warm room grow friendlier, in a Tense
// or Fearful one more timid (Personality.js).
// ---------------------------------------------------------------------------

const CLIMATE_TAU = 1.5 * DAY_LENGTH; // scores fade to a third in this time
const CLIMATE_CAP = 20;
const CLIMATE_TREND_EVERY = 2 * HOUR_LENGTH;
const CLIMATE_FLINCH_FEAR = 0.4;
const CLIMATE_FLINCH_RANGE = 90;
const CLIMATE_FLINCH_REST = 6; // game seconds
const CLIMATE_GREET_RUNNERS = 6;

// What each story event adds: [warm, tense, fear, grief]
const CLIMATE_WEIGHTS = {
  brushed: [0.5, 0, 0, 0],
  held_happy: [0.5, 0, 0, 0],
  treat: [0.4, 0, 0, 0],
  gift: [0.5, 0, 0, 0],
  toy: [0.4, 0, 0, 0],
  praised: [0.5, 0, 0, 0],
  played: [0.4, 0, 0, 0],
  comforted: [0.6, 0, -0.2, 0],
  bathed: [0.2, 0, 0, 0],
  born: [1.5, 0, 0, 0],
  trick: [1, 0, 0, 0],
  show: [1, 0, 0, 0],
  wish_granted: [2, 0, 0, 0],
  named: [0.5, 0, 0, 0],
  attacked: [0, 1.2, 0.2, 0],
  lesson: [0, 0.4, 0.2, 0],
  scolded: [0, 0.5, 0.2, 0],
  drilled: [0, 0.4, 0.2, 0],
  wish_denied: [0, 0.8, 0, 0.3],
  harmed: [0, 0.6, 1.2, 0], // (only a fifth for those who just saw it)
  fright: [0, 0, 0.3, 0],
  nightmare: [0, 0, 0.3, 0],
  scarred: [0, 0.5, 3, 0],
  injured: [0, 0.3, 2, 0],
  died: [0, 0, 0.5, 4],
  stillborn: [0, 0, 0, 3],
  sold: [0, 0, 0, 1.5],
};

// The words for the hover: kind -> reason
const CLIMATE_REASON = {
  brushed: "brushing", held_happy: "cuddles", treat: "treats", gift: "gifts", toy: "toys", praised: "praise",
  played: "play", comforted: "comfort", bathed: "baths", born: "new foals", trick: "tricks learnt", show: "show wins",
  wish_granted: "wishes come true", named: "names given", attacked: "fights", lesson: "harsh lessons",
  wish_denied: "wishes denied", scolded: "scoldings", drilled: "harsh training", harmed: "your harshness", fright: "frights", nightmare: "nightmares",
  scarred: "scars", injured: "injuries", died: "a death", stillborn: "a lost foal", sold: "family taken away",
};

const CLIMATE_LABELS = {
  Warm: { colour: "#ffd27a", happy: 0.05, learn: 1.1 },
  Calm: { colour: "rgba(255,255,255,0.75)", happy: 0, learn: 1 },
  Uneasy: { colour: "#e8c9a0", happy: -0.03, learn: 1 },
  Tense: { colour: "#ff9f80", happy: -0.06, learn: 0.9 },
  Fearful: { colour: "#c9a7ff", happy: -0.08, learn: 0.9 },
  Grieving: { colour: "#a8c4e0", happy: -0.06, learn: 1 },
};

// Warm/Tense/... change how much some things appeal: desire name -> multiplier
const CLIMATE_DESIRES = {
  Warm: { PlayWithBall: 1.25, PlayWithBlocks: 1.25, BabbleToFriends: 1.15, ProposeFriendship: 1.15 },
  Tense: { Wander: 0.7, Sit: 1.2, LieDown: 1.2, PlayWithBall: 0.8, PlayWithBlocks: 0.8, SeekSpecialFriend: 1.2 },
  Fearful: { Wander: 0.7, Sit: 1.2, LieDown: 1.2, PlayWithBall: 0.8, PlayWithBlocks: 0.8, SeekSpecialFriend: 1.2 },
  Grieving: { PlayWithBall: 0.7, PlayWithBlocks: 0.7, RandomBabble: 0.8 },
};

function freshRoomClimate() {
  return {};
}

let roomClimate = freshRoomClimate(); // scene -> { w, t, f, g, at, why: {kind: amount}, trend: {at, score, prev} }
let _climateCache = null; // { at, map: scene -> result }

function _clNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}

function _clRoom(scene, create) {
  if (!roomClimate || typeof roomClimate !== "object") roomClimate = freshRoomClimate();
  let r = roomClimate[scene];
  if (!r || typeof r !== "object") {
    if (!create) return null;
    r = roomClimate[scene] = { w: 0, t: 0, f: 0, g: 0, at: _clNow(), why: {} };
  }
  if (!r.why || typeof r.why !== "object") r.why = {};
  // Fade since last time (and start again if the clock went back)
  const now = _clNow();
  if (!(now >= r.at)) r.at = now;
  const dt = now - r.at;
  if (dt > 0) {
    const k = Math.exp(-dt / CLIMATE_TAU);
    for (const s of ["w", "t", "f", "g"]) r[s] = (+r[s] || 0) * k;
    for (const key of Object.keys(r.why)) {
      r.why[key] *= k;
      if (r.why[key] < 0.05) delete r.why[key];
    }
    r.at = now;
  }
  return r;
}

// StoryBook.recordStory: something happened to these fluffies
function noteClimateStory(kind, ids, opts = {}) {
  const w = CLIMATE_WEIGHTS[kind];
  if (!w || !ids || !ids.length || typeof fluffies === "undefined") return;
  const main = fluffies.find((f) => f.id === ids[0]);
  const scene = opts.s || (main && main.scene);
  if (!scene || typeof scene !== "string") return;
  const r = _clRoom(scene, true);
  // Watching someone else get hurt: it's the one hit, not one per watcher
  const seen = kind === "harmed" && typeof MEMORY_TEXT !== "undefined" && (opts.x === MEMORY_TEXT.witness || opts.x === MEMORY_TEXT.witness_family) ? 0.2 : 1;
  r.w = Math.min(CLIMATE_CAP, r.w + w[0] * seen);
  r.t = Math.min(CLIMATE_CAP, r.t + w[1] * seen);
  r.f = Math.max(0, Math.min(CLIMATE_CAP, r.f + w[2] * seen));
  r.g = Math.min(CLIMATE_CAP, r.g + w[3] * seen);
  if (seen === 1) r.why[kind] = (r.why[kind] || 0) + 1; // (how many lately, fading)
  _climateCache = null;
}

// Straight onto a room's feel (SharedMemories.js: parties, anniversaries): { w, t, f, g }
function addRoomClimate(scene, add) {
  if (!scene || typeof scene !== "string" || !add) return;
  const r = _clRoom(scene, true);
  for (const k of ["w", "t", "f", "g"]) if (add[k]) r[k] = Math.max(0, Math.min(CLIMATE_CAP, r[k] + add[k]));
  _climateCache = null;
}

function _clHouseNeighbours(scene) {
  if (scene === "INDOORS") return ["INDOORSL1", "INDOORSR1"];
  const m = typeof scene === "string" && scene.match(/^INDOORS([LR])(\d+)$/);
  if (!m) return [];
  const n = +m[2];
  return [n === 1 ? "INDOORS" : `INDOORS${m[1]}${n - 1}`, `INDOORS${m[1]}${n + 1}`];
}

// An old, contented fluffy in the room (keeps everyone calmer)
function _clElder(scene) {
  if (typeof fluffies === "undefined" || typeof isElderly !== "function") return null;
  // (or a Cherished one, Titles.js)
  return (
    fluffies.find(
      (f) => f.isAlive && f.scene === scene && f.adopted && ((isElderly(f) && f.happiness >= 0.5) || (typeof titleCalmsRoom === "function" && titleCalmsRoom(f))),
    ) || null
  );
}

// { label, colour, score, trend (-1/0/1), reasons: [text] }
function climateOf(scene) {
  if (!scene || typeof scene !== "string") return { label: "Calm", colour: CLIMATE_LABELS.Calm.colour, score: 0, trend: 0, reasons: [] };
  const now = _clNow();
  if (_climateCache && _climateCache.at === now && _climateCache.map[scene]) return _climateCache.map[scene];
  if (!_climateCache || _climateCache.at !== now) _climateCache = { at: now, map: {} };
  const r = _clRoom(scene, false) || { w: 0, t: 0, f: 0, g: 0, why: {} };
  let { w, t, f, g } = r;
  const extra = [];
  // Crowding
  const crowd = typeof crowding === "function" ? crowding(scene) : 0;
  if (crowd > 0) {
    t += Math.min(6, crowd * 4);
    extra.push(["crowding", crowd * 4]);
  }
  // A tense room next door
  let next = 0;
  for (const s of _clHouseNeighbours(scene)) {
    const o = roomClimate && roomClimate[s];
    if (o) next += 0.3 * ((+o.t || 0) * Math.exp(-Math.max(0, now - o.at) / CLIMATE_TAU));
  }
  // (it only ever makes this one Uneasy, never Tense on its own)
  let uneasy = 0;
  if (next > 0.3) {
    uneasy = Math.min(2.5, next);
    extra.push(["trouble next door", uneasy]);
  }
  // An old, contented fluffy
  const elder = _clElder(scene);
  if (elder && t + f > 0.5) {
    t *= 0.75;
    f *= 0.75;
    const n = typeof fluffyNames !== "undefined" && fluffyNames[elder.id];
    extra.push([`${n || "a calm fluffy"} keeps everyone calm`, 1]);
  }
  const bad = t + f + g + uneasy;
  let label = "Calm";
  if (g >= 3 && g >= t && g >= f) label = "Grieving";
  else if (f >= 4 && f >= t) label = "Fearful";
  else if (t >= 4) label = "Tense";
  else if (bad >= 2 && bad > w) label = "Uneasy";
  else if (w >= 4 && w > bad * 1.5) label = "Warm";
  const score = w - bad;
  // Trend: against a couple of game hours ago
  let trend = 0;
  const real = roomClimate && roomClimate[scene];
  if (real) {
    if (!real.trend || typeof real.trend !== "object" || !(now >= real.trend.at)) real.trend = { at: now, score, prev: score };
    if (now - real.trend.at >= CLIMATE_TREND_EVERY) real.trend = { at: now, score, prev: real.trend.score };
    const d = score - real.trend.prev;
    trend = d > 0.5 ? 1 : d < -0.5 ? -1 : 0;
  }
  // Why: the biggest things behind it
  const size = (k) => (CLIMATE_WEIGHTS[k] || [1]).reduce((a, x) => a + Math.abs(x), 0);
  const all = Object.entries(r.why)
    .map(([k, n]) => [`${CLIMATE_REASON[k] || k}${n >= 1.5 ? ` (${Math.round(n)})` : ""}`, n * size(k)])
    .concat(extra);
  all.sort((a, b) => b[1] - a[1]);
  const reasons = all.filter((x) => x[1] >= 0.3).slice(0, 4).map((x) => x[0]);
  const out = { label, colour: CLIMATE_LABELS[label].colour, score, trend, reasons };
  _climateCache.map[scene] = out;
  return out;
}

function _clFor(f) {
  if (!f || !f.adopted || !f.isAlive || typeof f.scene !== "string") return null;
  if (typeof getSceneConfig === "function" && !getSceneConfig(f.scene).insidePlayerQuarters) return null;
  return climateOf(f.scene);
}

// Horse.update homeostasis: where its happiness settles in this room
function climateHappinessTarget(f) {
  const c = _clFor(f);
  return c ? CLIMATE_LABELS[c.label].happy : 0;
}

// Lessons.lessonChance, Tricks.trickChance
function climateLearnMultiplier(f) {
  const c = _clFor(f);
  return c ? CLIMATE_LABELS[c.label].learn : 1;
}

// Fears.startFright: frights hit harder in a Fearful room
function climateFrightMultiplier(f) {
  const c = _clFor(f);
  return c && c.label === "Fearful" ? 1.2 : 1;
}

// HorseBrain.think
function climateDesireMultiplier(f, desireName) {
  const c = _clFor(f);
  if (!c) return 1;
  const m = CLIMATE_DESIRES[c.label];
  return (m && m[desireName]) || 1;
}

// ---- At the door (globals.changeScene) ----
// True if it greeted you its own way (instead of the usual remark)
let _clGreetRunners = 0;
function climateGreetStart() {
  _clGreetRunners = 0;
}
function climateGreetFluffy(f, scene) {
  if (!f || !f.adopted || f.isDragging || f.growth < 0.3) return false;
  const c = climateOf(scene);
  const fear = f.playerFear || 0;
  const trust = f.playerTrust || 0;
  // Scatter: it's afraid of you
  if (fear >= CLIMATE_FLINCH_FEAR && fear >= trust * 0.8) {
    const w = typeof sceneW === "function" ? sceneW(scene) : 1280;
    const away = typeof mouse !== "undefined" && mouse.x < w / 2 ? w - 90 - Math.random() * 150 : 90 + Math.random() * 150;
    if (typeof f.initBehavior === "function") f.initBehavior("RUNNING");
    if (typeof f.setTargetPosition === "function") f.setTargetPosition(away, f.y);
    f.expressionOverride = "CRYING_SHOCKED";
    f.expressionOverrideTimer = 2;
    if (!f.tooYoungToSpeak() && Math.random() < 0.5) f.speak(getDialogue(["CLIMATE", "SCATTER"], f), true);
    return true;
  }
  // Go quiet: it's not a happy room
  if ((c.label === "Tense" || c.label === "Fearful" || c.label === "Grieving") && trust < 0.6) {
    f.expressionOverride = "MISERABLE";
    f.expressionOverrideTimer = 2;
    return true;
  }
  // Run to you: a happy room and it loves you
  if ((c.label === "Warm" && trust >= 0.6) || (c.label === "Calm" && trust >= 0.8)) {
    if (_clGreetRunners >= CLIMATE_GREET_RUNNERS || f.currentStateKey === "SLEEPING") return false;
    _clGreetRunners++;
    const top = typeof sceneTop === "function" ? sceneTop(scene) + 60 : 200;
    const tx = typeof mouse !== "undefined" ? mouse.x + (Math.random() - 0.5) * 120 : f.x;
    const ty = Math.max(top, (typeof mouse !== "undefined" ? mouse.y : f.y) + 60);
    if (typeof f.initBehavior === "function") f.initBehavior("RUNNING");
    if (typeof f.setTargetPosition === "function") f.setTargetPosition(Math.max(60, Math.min((typeof sceneW === "function" ? sceneW(scene) : 1280) - 60, tx)), Math.min((typeof sceneH === "function" ? sceneH(scene) : 720) - 60, ty));
    f.expressionOverride = "GOOD_UPSIES";
    f.expressionOverrideTimer = 2;
    if (!f.tooYoungToSpeak()) f.speak(getDialogue(["CLIMATE", "GREET_RUN"], f), true);
    return true;
  }
  return false;
}

// ---- Flinching from your hand ----
function _clFlinch(f) {
  const now = _clNow();
  if (f._flinchAt !== undefined && now >= f._flinchAt && now - f._flinchAt < CLIMATE_FLINCH_REST) return false;
  f._flinchAt = now;
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 1;
  // a step back, if it's just standing about
  if (f.currentStateKey === "IDLE" && typeof f.setTargetPosition === "function" && typeof mouse !== "undefined") {
    const w = typeof sceneW === "function" ? sceneW(f.scene) : 1280;
    const dx = f.x >= mouse.x ? 50 : -50;
    f.initBehavior("MOVING");
    f.setTargetPosition(Math.max(60, Math.min(w - 60, f.x + dx)), f.y);
  }
  if (!f.tooYoungToSpeak() && Math.random() < 0.25) f.speak(getDialogue(["CLIMATE", "FLINCH"], f), true);
  return true;
}

// The sound of the room: happy chirps in a Warm one, whimpers in a Fearful one
const CLIMATE_SOUND_CHANCE = 0.012; // per check (4 a second)
function _clRoomSound() {
  if (typeof fluffySound !== "function" || Math.random() > CLIMATE_SOUND_CHANCE) return;
  const c = climateOf(currentScene);
  const kind = c.label === "Warm" ? "happy" : c.label === "Fearful" || c.label === "Grieving" ? "sad" : null;
  if (!kind) return;
  const here = fluffies.filter((f) => f.isAlive && f.adopted && f.scene === currentScene && f.currentStateKey !== "SLEEPING");
  if (here.length) fluffySound(here[Math.floor(Math.random() * here.length)], kind);
}

const climateTicker = new Ticker(0.25);
function updateClimate(dt) {
  if (!climateTicker.step(dt)) return;
  if (typeof fluffies === "undefined" || typeof mouse === "undefined" || typeof currentScene === "undefined") return;
  _clRoomSound();
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted || f.scene !== currentScene || f.isDragging) continue;
    if ((f.playerFear || 0) < CLIMATE_FLINCH_FEAR || f.currentStateKey === "SLEEPING") continue;
    if (typeof f.canSee === "function" && !f.canSee()) continue;
    if (Math.hypot(mouse.x - f.x, mouse.y - (f.y - 30)) > CLIMATE_FLINCH_RANGE) continue;
    _clFlinch(f);
  }
}

// ---- The label (UIScenes.drawHouseNav) ----
let _climateLabelRect = null;

// Draws "· Warm ↑" right-aligned at (right, y); returns its width
function drawClimateLabel(c, right, y) {
  const cl = climateOf(currentScene);
  const arrow = cl.trend > 0 ? " ↑" : cl.trend < 0 ? " ↓" : "";
  const text = `${cl.label}${arrow}`;
  c.save();
  c.font = "bold 12px Arial";
  c.textAlign = "right";
  c.textBaseline = "middle";
  c.fillStyle = cl.colour;
  c.fillText(text, right, y);
  const w = c.measureText(text).width;
  c.restore();
  _climateLabelRect = { x: right - w - 4, y: y - 10, w: w + 8, h: 20, scene: currentScene };
  return w;
}

function drawClimateTooltip(c) {
  const R = _climateLabelRect;
  if (!R || R.scene !== currentScene || typeof mouse === "undefined" || typeof isPointInRect !== "function") return;
  if (typeof playerQuartersAndNotBackyard === "function" && !playerQuartersAndNotBackyard(currentScene)) return;
  if (!isPointInRect(mouse.x, mouse.y, R.x, R.y, R.w, R.h)) return;
  const cl = climateOf(currentScene);
  const lines = [`This room feels ${cl.label.toLowerCase()}.`];
  if (cl.reasons.length) lines.push(`Because of: ${cl.reasons.join(", ")}.`);
  else lines.push("Nothing much has happened here lately.");
  if (cl.trend) lines.push(cl.trend > 0 ? "Getting better." : "Getting worse.");
  c.save();
  c.font = "12px Arial";
  const w = Math.max(...lines.map((l) => c.measureText(l).width)) + 16;
  const h = lines.length * 16 + 10;
  const x = Math.max(8, Math.min((typeof width === "number" ? width : 1280) - w - 8, R.x + R.w - w));
  const y = R.y + R.h + 6;
  c.fillStyle = "rgba(20,16,24,0.88)";
  if (typeof fillRoundRect === "function") fillRoundRect(c, x, y, w, h, 8);
  else c.fillRect(x, y, w, h);
  c.fillStyle = "white";
  c.textAlign = "left";
  c.textBaseline = "top";
  lines.forEach((l, i) => c.fillText(l, x + 8, y + 6 + i * 16));
  c.restore();
}

registerSystem("climate", updateClimate, 143);
