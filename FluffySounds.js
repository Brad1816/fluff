// ---------------------------------------------------------------------------
// Fluffy sounds: the voice clips in assets/sounds that weren't used before.
//
// fluffySound(f, kind) plays the right clip for a fluffy in the room you're
// looking at (foals have their own versions), with a little random pitch so
// a room full of fluffies doesn't sound copy-pasted, deeper for big adults.
// Each fluffy waits SOUND_COOLDOWN[kind] seconds before making the same
// noise again, and the whole room plays at most one of each kind at a time
// (SOUND_ROOM_GAP), so a stampede isn't a wall of noise.
//
// When they play:
//   happy    a happy face (GOOD_UPSIES: brushed, cuddled, playing, tricks...)
//   angry    an angry face (ANGRY_PUFFED: smarties, refusing, fights...)
//   sad      a miserable face (MISERABLE / BAD_UPSIES: bad food, grief...)
//   scree    a shocked, crying face (CRYING_SHOCKED: hurt, scared...)
//   death    dying (HorseAnatomy die)
//   enf      mating (HorseMating)
//   shitting pooping (HorseToilet excrete, diarrhea)
//   peep     a newborn foal (HorseAnatomy spawnBaby)
// The faces are watched in HorseUpdate (onFluffyExpression), so anything
// that sets expressionOverride gets its sound for free.
// ---------------------------------------------------------------------------

const FLUFFY_SOUNDS = {
  happy: { adult: "fluffy_happy", foal: "foal_peep", volume: 0.4 },
  angry: { adult: "fluffy_angry", foal: "foal_scree", volume: 0.45 },
  sad: { adult: "fluffy_sad", foal: "foal_scree", volume: 0.4 },
  scree: { adult: "fluffy_scree", foal: "foal_scree", volume: 0.5 },
  death: { adult: "fluffy_death", foal: "foal_death", volume: 0.6 },
  enf: { adult: "fluffy_enf", foal: null, volume: 0.4 },
  shitting: { adult: "fluffy_shitting", foal: "fluffy_shitting", volume: 0.3 },
  peep: { adult: "foal_peep", foal: "foal_peep", volume: 0.45 },
};
const SOUND_COOLDOWN = { happy: 20, angry: 10, sad: 15, scree: 3, death: 0, enf: 10, shitting: 6, peep: 6 }; // seconds, per fluffy
const SOUND_ROOM_GAP = 0.5; // seconds between two of the same kind in the room

const EXPRESSION_SOUNDS = {
  GOOD_UPSIES: "happy",
  ANGRY_PUFFED: "angry",
  MISERABLE: "sad",
  BAD_UPSIES: "sad",
  CRYING_SHOCKED: "scree",
};

const _roomLastSound = {};

// New game / load: the game clock jumps, so forget when things last played
function resetFluffySounds() {
  for (const k of Object.keys(_roomLastSound)) delete _roomLastSound[k];
}

function _sndNow() {
  return typeof gameTimeMs === "function" ? gameTimeMs() / 1000 : Date.now() / 1000;
}

// Returns true if it played (or would have, when sound is off)
function fluffySound(f, kind) {
  const def = FLUFFY_SOUNDS[kind];
  if (!def || !f || typeof playSound !== "function") return false;
  if (typeof currentScene !== "undefined" && f.scene !== currentScene) return false;
  if (kind !== "death" && !f.isAlive) return false;
  const young = f.growth < 1 && (typeof f.tooYoungToSpeak !== "function" || f.tooYoungToSpeak() || f.growth < 0.5);
  const key = young ? def.foal : def.adult;
  if (!key) return false;
  const now = _sndNow();
  if (!f._soundAt) f._soundAt = {};
  const cd = SOUND_COOLDOWN[kind] || 0;
  // (a time in the future means the clock jumped back: ignore it)
  const last = f._soundAt[kind];
  if (cd && last !== undefined && now >= last && now - last < cd) return false;
  const roomLast = _roomLastSound[kind];
  if (roomLast !== undefined && now >= roomLast && now - roomLast < SOUND_ROOM_GAP && kind !== "death") return false;
  f._soundAt[kind] = now;
  _roomLastSound[kind] = now;
  // Big grown-ups a bit deeper, little ones a bit higher, plus some variety
  const size = young ? 1.05 : 1.08 - 0.12 * Math.min(1, Math.max(0, (f.scale || 1) - 0.8));
  const pitch = size * (0.93 + Math.random() * 0.14);
  playSound(key, def.volume, pitch);
  return true;
}

// HorseUpdate, every step: a new face means a new noise
function onFluffyExpression(f) {
  const expr = f.expressionOverride;
  const t = f.expressionOverrideTimer || 0;
  const fresh = expr !== f._soundExpr || t > (f._soundExprTimer || 0) + 0.05;
  f._soundExpr = expr;
  f._soundExprTimer = t;
  if (!fresh || t <= 0) return;
  const kind = EXPRESSION_SOUNDS[expr];
  if (kind) fluffySound(f, kind);
}
