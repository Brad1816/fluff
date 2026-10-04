// ---------------------------------------------------------------------------
// The house you can see: what the numbers under the surface look like.
//
//   Room tint     each room is washed faintly with its feel (Climate.js):
//                 golden when Warm, reddish when Tense, cold and dark at the
//                 edges when Fearful, grey and washed out when Grieving. It
//                 fades between feels over a couple of seconds.
//   Ears          a sad, grieving, frightened or Broken fluffy's ears droop
//                 back (HorseUpdate._updateEarFlop asks earDroopAngle).
//   Huddles       in a Tense or Fearful room, fluffies that are just standing
//                 or sitting about go and sit close to a friend or their mum,
//                 and take a little comfort from it.
//   Sleep piles   a fluffy asleep near a friend (or its mum) shuffles up
//                 against it and turns to face it, so friends sleep in a
//                 real heap (Bonds.js already sends them to sleep nearby);
//                 a pile of three or more gets a shared soft shadow.
//   Parties       throwParty (SharedMemories.js) puts paper hats on the
//                 guests, strings bunting across the wall, and throws
//                 confetti for a moment.
// ---------------------------------------------------------------------------

// Can a system send this fluffy walking somewhere? Not while it's held,
// strapped to a board or table, caged, in time-out, being sat with, mating,
// asleep, or too little to walk. (Used by huddles, greetings at the door,
// feeding time and bored mischief.)
function canBeMovedExternally(f) {
  if (!f || !f.isAlive || f.isDragging || f.placedOn || f.currentCage) return false;
  if (f._bolt) return false; // making for the door (Runaways.js)
  if (f.sitWith || (typeof inTimeOut === "function" && inTimeOut(f))) return false;
  if (f.matingState && f.matingState.isMating) return false;
  if (f.currentStateKey === "SLEEPING") return false;
  if (typeof f.tooYoungToWalk === "function" && f.tooYoungToWalk()) return false;
  return typeof f.initBehavior === "function" && typeof f.setTargetPosition === "function";
}

// ---- Room tint ----

const ROOM_TINTS = {
  Warm: { colour: [255, 170, 60], alpha: 0.13 },
  Uneasy: { colour: [150, 140, 100], alpha: 0.08 },
  Tense: { colour: [220, 60, 40], alpha: 0.12 },
  Fearful: { colour: [35, 30, 90], alpha: 0.16, vignette: 0.5 },
  Grieving: { colour: [80, 95, 125], alpha: 0.14, grey: 0.55 },
};
const ROOM_TINT_FADE = 0.6; // per real second
let roomTintsOn = true;
let _tint = { scene: null, w: {} }; // shown weight of each label (0-1)
let _tintLast = 0;

function _hlRealNow() {
  return typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000;
}
function isHouseRoom(scene) {
  return scene === "BACKYARD" || (typeof houseRoomName === "function" && !!houseRoomName(scene));
}

// How strongly each tint shows now (steps towards the room's feel)
function roomTintWeights(scene = currentScene, dt = null) {
  const now = _hlRealNow();
  if (dt === null) dt = _tintLast ? Math.min(0.5, now - _tintLast) : 1;
  _tintLast = now;
  const label = isHouseRoom(scene) && typeof climateOf === "function" ? climateOf(scene).label : "Calm";
  // Walking into another room: its feel at once
  if (_tint.scene !== scene) {
    _tint = { scene, w: {} };
    if (ROOM_TINTS[label]) _tint.w[label] = 1;
    return _tint.w;
  }
  for (const k of Object.keys(ROOM_TINTS)) {
    const target = k === label ? 1 : 0;
    const v = _tint.w[k] || 0;
    const step = ROOM_TINT_FADE * dt;
    _tint.w[k] = target > v ? Math.min(target, v + step) : Math.max(target, v - step);
    if (_tint.w[k] <= 0) delete _tint.w[k];
  }
  return _tint.w;
}

// script.js drawGame, after the sky and weather (screen positions)
function drawRoomTint(c) {
  if (!roomTintsOn || typeof currentScene === "undefined") return;
  const weights = roomTintWeights(currentScene);
  const top = 0;
  for (const [label, k] of Object.entries(weights)) {
    const t = ROOM_TINTS[label];
    if (!t || k <= 0) continue;
    c.save();
    if (t.grey) {
      // wash the colour out a little
      c.globalCompositeOperation = "saturation";
      c.fillStyle = `rgba(128,128,128,${t.grey * k})`;
      c.fillRect(0, top, width, height - top);
      c.globalCompositeOperation = "source-over";
    }
    const [r, g, b] = t.colour;
    c.fillStyle = `rgba(${r},${g},${b},${t.alpha * k})`;
    c.fillRect(0, top, width, height - top);
    if (t.vignette) {
      const grad = c.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.7);
      grad.addColorStop(0, "rgba(10,5,30,0)");
      grad.addColorStop(1, `rgba(10,5,30,${t.vignette * k})`);
      c.fillStyle = grad;
      c.fillRect(0, top, width, height - top);
    }
    c.restore();
  }
}

// ---- Ears ----

const EAR_DROOP_SAD = -0.75;
const EAR_DROOP_LOW = -1.15;
const EAR_PINNED = -1.3;
const EAR_SAD_AT = 0.3; // happiness under this: ears go down

// The angle its ears should hang at, or null for "as they like"
function earDroopAngle(f) {
  if (!f || !f.isAlive) return null;
  if (f.currentStateKey === "SLEEPING") return null;
  if ((f.scaredTimer || 0) > 0 || (typeof isFrightened === "function" && isFrightened(f))) return EAR_PINNED;
  if (typeof titleOf === "function" && titleOf(f) === "Broken") return EAR_DROOP_LOW;
  if (f.separation && (f.separation.grief || 0) >= 0.2) return EAR_DROOP_LOW;
  const h = typeof f.happiness === "number" ? f.happiness : 0.5;
  if (h < EAR_SAD_AT) return EAR_DROOP_SAD + (EAR_DROOP_LOW - EAR_DROOP_SAD) * Math.min(1, (EAR_SAD_AT - h) / EAR_SAD_AT);
  return null;
}

// ---- Huddles ----

const HUDDLE_CHECK = 3; // game seconds
const HUDDLE_TIME = 40; // game seconds a huddle lasts
const HUDDLE_CHANCE = 0.35; // per check, for one that could huddle
const HUDDLE_NEAR = 70; // close enough to count
const HUDDLE_COMFORT = 0.004; // happiness per check while huddled
const HUDDLE_STATES = ["IDLE", "SITTING", "LYING"];

function _hlLiked(f, o) {
  if (o.id === f.motherId || f.id === o.motherId) return 1;
  return typeof getLiking === "function" ? getLiking(f, o) : 0;
}

// Who it would huddle with: its mum, or the friend it likes best in the room
function huddlePartner(f) {
  let best = null;
  let bestScore = 0.25;
  for (const o of fluffies) {
    if (o === f || !o.isAlive || o.scene !== f.scene || o.isDragging || o.currentStateKey === "SLEEPING") continue;
    if (o.currentCage !== f.currentCage) continue;
    if (typeof fenceCanReachThing === "function" && !fenceCanReachThing(f, o)) continue;
    const s = _hlLiked(f, o) - Math.hypot(o.x - f.x, o.y - f.y) / 4000;
    if (s > bestScore) {
      bestScore = s;
      best = o;
    }
  }
  return best;
}

function _startHuddle(f, o) {
  const now = timePlayed;
  f._huddle = { with: o.id, until: now + HUDDLE_TIME };
  const side = f.x < o.x ? -1 : 1;
  const tx = o.x + side * (40 + Math.random() * 12);
  const ty = o.y + (Math.random() - 0.5) * 16;
  if (Math.hypot(tx - f.x, ty - f.y) > 20 && typeof f.initBehavior === "function") {
    f.initBehavior("MOVING");
    if (typeof f.setTargetPosition === "function") f.setTargetPosition(tx, ty);
  }
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function" && Math.random() < 0.3) f.speak(getDialogue(["CLIMATE", "HUDDLE"], f, o), true);
}

let _huddleT = 0;
function updateHuddles(dt) {
  _huddleT += dt;
  if (_huddleT < HUDDLE_CHECK || typeof fluffies === "undefined") return;
  _huddleT = 0;
  const now = timePlayed;
  const labels = {};
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted || f.isDragging) continue;
    const scene = f.scene;
    if (!(scene in labels)) labels[scene] = isHouseRoom(scene) && typeof climateOf === "function" ? climateOf(scene).label : "Calm";
    const uneasy = labels[scene] === "Tense" || labels[scene] === "Fearful";
    if (f._huddle) {
      const o = fluffyById(f._huddle.with);
      if (!uneasy || f._huddle.until <= now || !o || !o.isAlive || o.scene !== f.scene) {
        f._huddle = null;
        continue;
      }
      // Arrived: sit down beside it, facing it
      if (Math.hypot(o.x - f.x, o.y - f.y) <= HUDDLE_NEAR) {
        if (f.currentStateKey === "IDLE" && canBeMovedExternally(f)) f.initBehavior("SITTING");
        f.facingRight = o.x > f.x;
        if (typeof f.changeHappiness === "function") f.changeHappiness(HUDDLE_COMFORT);
      }
      continue;
    }
    if (!uneasy || !HUDDLE_STATES.includes(f.currentStateKey) || !canBeMovedExternally(f)) continue;
    if (f._huddleRest && now < f._huddleRest) continue;
    if (Math.random() > HUDDLE_CHANCE) continue;
    const o = huddlePartner(f);
    if (!o) {
      f._huddleRest = now + HUDDLE_TIME;
      continue;
    }
    _startHuddle(f, o);
    f._huddleRest = now + HUDDLE_TIME * 2;
  }
}

// ---- Sleeping piles ----

const PILE_NEAR = 130; // a friend asleep this close: shuffle up to it
const PILE_GAP = 44; // how close they end up (a foal by mum: closer)
const PILE_GAP_FOAL = 28;
const PILE_SHUFFLE = 6; // px per second while shuffling

function _pileBuddy(f) {
  let best = null;
  let bd = PILE_NEAR;
  for (const o of fluffies) {
    if (o === f || !o.isAlive || o.scene !== f.scene || o.currentStateKey !== "SLEEPING") continue;
    if (o.currentCage !== f.currentCage || o.claimedBed || o.placedOn) continue;
    if (typeof fenceCanReachThing === "function" && !fenceCanReachThing(f, o)) continue;
    const d = Math.hypot(o.x - f.x, o.y - f.y);
    if (d >= bd) continue;
    const mum = o.id === f.motherId;
    if (!mum && _hlLiked(f, o) < 0.25) continue;
    // The smaller one comes to the bigger (a foal to mum); between equals,
    // the newer one moves
    if (o.growth < f.growth || (o.growth === f.growth && o.id > f.id)) continue;
    best = o;
    bd = d;
  }
  return best;
}

let _pileT = 0;
function updateSleepHeaps(dt) {
  _pileT += dt;
  if (_pileT < 0.5 || typeof fluffies === "undefined") return;
  const step = _pileT;
  _pileT = 0;
  for (const f of fluffies) {
    // (in the house: the park's herds already sleep together - Bonds.js)
    if (!f.isAlive || f.currentStateKey !== "SLEEPING" || f.isDragging || f.claimedBed || f.placedOn || !isHouseRoom(f.scene)) {
      if (f._pileWith) f._pileWith = null;
      continue;
    }
    // Pick who to snuggle up to when it falls asleep, then keep them
    let o = f._pileWith ? fluffyById(f._pileWith) : null;
    if (!o || !o.isAlive || o.currentStateKey !== "SLEEPING" || o.scene !== f.scene) {
      o = _pileBuddy(f);
      // (not two fluffies each shuffling to the other)
      if (o && o._pileWith === f.id) o = null;
      f._pileWith = o ? o.id : null;
      if (o) f.facingRight = o.x > f.x;
    }
    if (!o) continue;
    const foal = f.growth < 1 && o.id === f.motherId;
    const gap = foal ? PILE_GAP_FOAL : PILE_GAP;
    const dx = o.x - f.x;
    const dy = o.y + (foal ? 8 : 0) - f.y;
    const d = Math.hypot(dx, dy);
    if (d <= gap) continue;
    const move = Math.min(d - gap, PILE_SHUFFLE * step);
    f.x += (dx / d) * move;
    f.y += (dy / d) * move;
  }
}

// The heaps in a scene: [[fluffy, ...], ...] (3 or more asleep together)
// (worked out a few times a second at most: it's drawn every frame)
let _heapCache = null;
function sleepHeaps(scene) {
  const now = _hlRealNow();
  if (_heapCache && _heapCache.scene === scene && now - _heapCache.at < 0.3) return _heapCache.heaps;
  const heaps = _sleepHeapsNow(scene);
  _heapCache = { scene, at: now, heaps };
  return heaps;
}
function _sleepHeapsNow(scene) {
  const sleepers = fluffies.filter((f) => f.isAlive && f.scene === scene && f.currentStateKey === "SLEEPING" && !f.claimedBed && !f.placedOn);
  const seen = new Set();
  const heaps = [];
  for (const f of sleepers) {
    if (seen.has(f)) continue;
    const heap = [];
    const todo = [f];
    seen.add(f);
    while (todo.length) {
      const a = todo.pop();
      heap.push(a);
      for (const b of sleepers) {
        if (seen.has(b) || Math.hypot(a.x - b.x, a.y - b.y) > PILE_GAP + 22) continue;
        seen.add(b);
        todo.push(b);
      }
    }
    if (heap.length >= 3) heaps.push(heap);
  }
  return heaps;
}

// Under the fluffies (script.js, before the renderables)
function drawSleepHeapShadows(c) {
  if (typeof currentScene === "undefined" || !isHouseRoom(currentScene)) return;
  for (const heap of sleepHeaps(currentScene)) {
    const xs = heap.map((f) => f.x);
    const ys = heap.map((f) => f.y + 30 * (f.scale || 0.5) * 2);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
    const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + 60;
    c.save();
    const grad = c.createRadialGradient(cx, cy, 5, cx, cy, rx);
    grad.addColorStop(0, "rgba(255, 220, 240, 0.28)");
    grad.addColorStop(1, "rgba(255, 220, 240, 0)");
    c.fillStyle = grad;
    c.beginPath();
    c.ellipse(cx, cy, rx, 34, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

// ---- Parties: hats, bunting and confetti ----

const PARTY_HAT_TIME = 0.6; // game hours (about half a minute)
const PARTY_BUNTING_TIME = 1; // game hours
const PARTY_CONFETTI_TIME = 6; // game seconds
const PARTY_COLOURS = ["#ff6fa8", "#ffd84d", "#6fd3ff", "#8dff7a", "#c49bff", "#ff9d4d"];

let partyDecor = {}; // scene -> { until, start, colours }
let _confetti = []; // { x, y, vx, vy, r, spin, colour, scene, until }

function _hlHour() {
  return typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50;
}

// SharedMemories.throwParty
function decorateParty(host, guests) {
  const now = timePlayed;
  const scene = host.scene;
  const colours = PARTY_COLOURS.slice().sort(() => Math.random() - 0.5);
  partyDecor[scene] = { until: now + PARTY_BUNTING_TIME * _hlHour(), start: now, colours };
  const all = [host, ...guests.filter((g) => g !== host)];
  all.forEach((g, i) => {
    if (g.accessories && g.accessories.head) return; // already wearing one
    g.partyHat = { until: now + PARTY_HAT_TIME * _hlHour(), colour: colours[i % colours.length], stripe: colours[(i + 2) % colours.length] };
  });
  for (let i = 0; i < 90; i++) {
    _confetti.push({
      x: host.x + (Math.random() - 0.5) * 260,
      y: host.y - 160 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 80,
      vy: 20 + Math.random() * 60,
      r: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 8,
      colour: PARTY_COLOURS[i % PARTY_COLOURS.length],
      scene,
      until: now + PARTY_CONFETTI_TIME * (0.6 + Math.random() * 0.4),
    });
  }
  if (_confetti.length > 400) _confetti = _confetti.slice(-400);
}

function hasPartyHat(f) {
  return !!(f && f.partyHat && f.partyHat.until > timePlayed);
}

function updatePartyDecor(dt) {
  const now = timePlayed;
  for (const [s, d] of Object.entries(partyDecor)) if (!d || d.until <= now) delete partyDecor[s];
  if (typeof fluffies !== "undefined") for (const f of fluffies) if (f.partyHat && (f.partyHat.until <= now || !f.isAlive)) f.partyHat = null;
  for (const p of _confetti) {
    p.vy = Math.min(90, p.vy + 60 * dt);
    p.vx *= 1 - 0.8 * dt;
    p.x += (p.vx + Math.sin(p.r) * 20) * dt;
    p.y += p.vy * dt;
    p.r += p.spin * dt;
  }
  if (_confetti.length) _confetti = _confetti.filter((p) => p.until > now);
}

// A paper cone on its head (HorseRenderer, after the head)
function drawPartyHat(ctx, renderer, layout = renderer && renderer.layout) {
  const f = renderer && renderer.horse;
  if (!hasPartyHat(f) || !layout || !layout.head) return;
  const rect = layout.head;
  const hat = f.partyHat;
  ctx.save();
  ctx.translate(rect.x, rect.y);
  ctx.rotate(rect.angle);
  const hs = typeof renderer.getHeadScale === "function" ? renderer.getHeadScale() : 1;
  ctx.scale(hs, hs);
  const ox = -rect.w * 0.25;
  const oy = -rect.h * 0.85;
  const bx = ox + rect.w * 0.5;
  const by = oy + rect.h * 0.16;
  const hw = rect.w * 0.2;
  const hh = rect.h * 0.62;
  ctx.translate(bx, by);
  ctx.rotate(0.25);
  // cone
  ctx.fillStyle = hat.colour;
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-hw, 0);
  ctx.lineTo(0, -hh);
  ctx.lineTo(hw, 0);
  ctx.closePath();
  ctx.fill();
  // stripes
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = hat.stripe;
  ctx.lineWidth = hw * 0.35;
  for (let i = 1; i <= 3; i++) {
    const y = -hh * (i / 4);
    ctx.beginPath();
    ctx.moveTo(-hw, y + hw * 0.3);
    ctx.lineTo(hw, y - hw * 0.3);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-hw, 0);
  ctx.lineTo(0, -hh);
  ctx.lineTo(hw, 0);
  ctx.closePath();
  ctx.stroke();
  // pom-pom
  ctx.fillStyle = hat.stripe;
  ctx.beginPath();
  ctx.arc(0, -hh, hw * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Bunting across the wall (script.js, behind the fluffies)
function drawPartyBunting(c) {
  if (typeof currentScene === "undefined") return;
  const d = partyDecor[currentScene];
  if (!d || d.until <= timePlayed) return;
  const w = typeof sceneW === "function" ? sceneW(currentScene) : width;
  const wall = typeof sceneTop === "function" ? sceneTop(currentScene) : height * 0.15;
  const t = _hlRealNow();
  c.save();
  for (let row = 0; row < 2; row++) {
    // hung from the top of the room, just below the wall
    const y0 = wall + 2 + row * 10;
    const sag = 34 + row * 22;
    const x0 = row ? w * 0.18 : 0;
    const x1 = row ? w * 0.82 : w;
    const at = (u) => ({ x: x0 + (x1 - x0) * u, y: y0 + Math.sin(Math.PI * u) * sag });
    c.strokeStyle = "rgba(90, 60, 50, 0.9)";
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i <= 40; i++) {
      const p = at(i / 40);
      if (i === 0) c.moveTo(p.x, p.y);
      else c.lineTo(p.x, p.y);
    }
    c.stroke();
    const flags = Math.max(6, Math.round((x1 - x0) / 55));
    for (let i = 0; i < flags; i++) {
      const u = (i + 0.5) / flags;
      const p = at(u);
      const swing = Math.sin(t * 2 + i + row) * 0.12;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(swing);
      c.fillStyle = d.colours[(i + row) % d.colours.length];
      c.beginPath();
      c.moveTo(-13, 0);
      c.lineTo(13, 0);
      c.lineTo(0, 26);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(0,0,0,0.35)";
      c.lineWidth = 1;
      c.stroke();
      c.restore();
    }
  }
  c.restore();
}

// Confetti (script.js, over the fluffies)
function drawConfetti(c) {
  if (!_confetti.length || typeof currentScene === "undefined") return;
  c.save();
  for (const p of _confetti) {
    if (p.scene !== currentScene) continue;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.r);
    c.fillStyle = p.colour;
    c.fillRect(-4, -2.5, 8, 5 * Math.abs(Math.cos(p.r * 1.7)) + 1);
    c.restore();
  }
  c.restore();
}

function updateHouseLife(dt) {
  updateHuddles(dt);
  updateSleepHeaps(dt);
  updatePartyDecor(dt);
}

registerSystem("houseLife", updateHouseLife, 147);
