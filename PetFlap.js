// ---------------------------------------------------------------------------
// The pet flap: a little door from a room of yours out to the backyard.
//
// Buy it at Fluff Mart (Home & Play, PET_FLAP_PRICE) and put it in a room
// (not the backyard itself). Then your fluffies come and go on their own
// (checked every PET_FLAP_EVERY s):
//   - out: on a dry day (PET_FLAP_OUT_CHANCE a check; more if bored), a
//     walking fluffy goes to the flap and through it into the yard, coming
//     out by the back door (petFlapYardSpot)
//   - in: at night, in rain or snow, when cold, hungry with nothing to eat
//     out there, or after a while (PET_FLAP_IN_CHANCE), back in through it
// Right-click it to lock or unlock. Locked, nobody goes through (a fluffy
// that wants out scratches at it). Unlocked, anything wild in the yard -
// strays or raiders that got past a broken fence - may come in too
// (PET_FLAP_WILD_CHANCE a check), eat your food and pick fights.
// (The backyard fence breaks far less often now: script.js.)
//
// Saved (serialize): locked. Fluffies on the way: f._flapTrip (not saved).
// ---------------------------------------------------------------------------

const PET_FLAP_PRICE = 200;
const PET_FLAP_EVERY = 5; // seconds
const PET_FLAP_OUT_CHANCE = 0.02; // a walking fluffy of yours, each check, on a fine day
const PET_FLAP_IN_CHANCE = 0.03; // ...and back in, each check, after PET_FLAP_MIN_OUT
const PET_FLAP_MIN_OUT = 1.5 * 50; // game seconds (1.5 hours) outside before it might wander back for no reason
const PET_FLAP_WILD_CHANCE = 0.15; // each wild fluffy in the yard, each check, when unlocked
const PET_FLAP_TRIP_GIVE_UP = 60; // seconds walking to it
const petFlapTicker = new Ticker(PET_FLAP_EVERY);

class PetFlap {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.locked = false;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  onDrop() {
    const r = handleDropping(this);
    this.currentCage = null;
    if (this.scene === "BACKYARD" && typeof addUIMessage === "function") addUIMessage("The pet flap goes in a room of the house - it leads out to the backyard.");
    return r;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      this.y = Math.max(this.y, sceneTop(this.scene) + 10);
    }
  }

  // Does it lead anywhere from where it is?
  works() {
    if (this.isDragging || this.scene === "BACKYARD") return false;
    const cfg = typeof getSceneConfig === "function" ? getSceneConfig(this.scene) : null;
    return !!(cfg && cfg.insidePlayerQuarters);
  }

  getBottomY() {
    return this.y;
  }

  hitTest(px, py) {
    return px >= this.x - 34 && px <= this.x + 34 && py >= this.y - 74 && py <= this.y + 4;
  }

  toggleLock() {
    this.locked = !this.locked;
    if (typeof addUIMessage === "function") addUIMessage(this.locked ? "Pet flap locked: nobody goes in or out." : "Pet flap unlocked: your fluffies can come and go - but so can anything in the yard.");
  }

  serialize() {
    return { classType: "PetFlap", id: this.id, x: this.x, y: this.y, scene: this.scene, locked: !!this.locked };
  }

  deserialize(data) {
    this.locked = !!data.locked;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    drawPetFlapShape(ctx, this.x, this.y, 1, this.locked);
  }
}

// (x, y) is the middle of its bottom
function drawPetFlapShape(c, x, y, s, locked) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  // Frame
  c.fillStyle = "#6d4a2c";
  c.fillRect(-32, -72, 64, 72);
  c.fillStyle = "#3b2a1c";
  c.fillRect(-26, -64, 52, 64);
  // The flap
  c.fillStyle = "#a9794a";
  c.fillRect(-22, -60, 44, 56);
  c.strokeStyle = "#5a3d24";
  c.lineWidth = 2;
  c.strokeRect(-22, -60, 44, 56);
  c.beginPath();
  c.moveTo(-22, -54);
  c.lineTo(22, -54);
  c.stroke();
  // Paw print
  c.fillStyle = "rgba(90, 61, 36, 0.7)";
  c.beginPath();
  c.arc(0, -26, 6, 0, Math.PI * 2);
  for (const [px, py] of [[-7, -36], [-2, -39], [3, -39], [8, -36]]) c.arc(px, py, 2.4, 0, Math.PI * 2);
  c.fill();
  if (locked) {
    // Padlock
    c.fillStyle = "#c9c9c9";
    c.strokeStyle = "#888";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, -50, 5, Math.PI, 0);
    c.stroke();
    c.fillRect(-7, -50, 14, 11);
  }
  c.restore();
}

// Where a fluffy comes out in the yard (by the back door)
function petFlapYardSpot() {
  const w = typeof sceneW === "function" ? sceneW("BACKYARD") : width;
  const top = typeof sceneTop === "function" ? sceneTop("BACKYARD") : 120;
  return { x: w / 2 + (Math.random() - 0.5) * 80, y: top + 50 + Math.random() * 30 };
}

// The yard and a room with a pet flap are one home: a fluffy in one knows
// who's out in (or in from) the other, so it doesn't think they're lost
// (playtest 6: HorseFamily.updateRelationships)
let _flapRooms = null;
let _flapRoomsAt = -1;
function homeLinked(a, b) {
  if (a === b) return true;
  if (a !== "BACKYARD" && b !== "BACKYARD") return false;
  const now = typeof gameTimeMs === "function" ? gameTimeMs() : 0;
  if (!_flapRooms || now - _flapRoomsAt > 1000 || now < _flapRoomsAt) {
    _flapRooms = new Set(objects.filter((o) => o instanceof PetFlap).map((o) => o.scene));
    _flapRoomsAt = now;
  }
  return _flapRooms.has(a === "BACKYARD" ? b : a);
}

function petFlaps() {
  return typeof objects === "undefined" || typeof PetFlap === "undefined" ? [] : objects.filter((o) => o instanceof PetFlap && o.works());
}

function _pfCanGo(f) {
  return (
    f.isAlive &&
    !f.isDragging &&
    !f.placedOn &&
    !f.currentCage &&
    f.currentStateKey !== "SLEEPING" &&
    !f.tooYoungToWalk() &&
    !(f.matingState && f.matingState.isMating) &&
    !(typeof f.isInLabor === "function" && f.isInLabor()) &&
    !(typeof isGluedDown === "function" && isGluedDown(f))
  );
}

function _pfWeatherBad() {
  return (typeof rainAmount === "function" && rainAmount() > 0.2) || (typeof snowAmount === "function" && snowAmount() > 0.2) || (typeof isStorming === "function" && isStorming());
}

// Does one of yours out in the yard want to come back in?
function _pfWantsIn(f, now) {
  if (typeof isNightTime === "function" && isNightTime()) return true;
  if (_pfWeatherBad()) return true;
  if (typeof f.warmth === "number" && f.warmth < 0.4) return true;
  if (f.hunger < 0.35) return true;
  const out = f._flapOutAt;
  return out !== undefined && now - out >= PET_FLAP_MIN_OUT && Math.random() < PET_FLAP_IN_CHANCE;
}

function _pfWantsOut(f) {
  if ((typeof isNightTime === "function" && isNightTime()) || _pfWeatherBad()) return false;
  // (not a mum whose foals can't walk yet)
  if (typeof litterOf === "function" && litterOf(f).some((k) => k.tooYoungToWalk())) return false;
  if (f.hunger < 0.4) return false;
  const bored = typeof f.boredom === "number" ? f.boredom : 0;
  return Math.random() < PET_FLAP_OUT_CHANCE * (1 + 2 * bored);
}

function _pfWalk(f, x, y) {
  f.initBehavior("MOVING");
  f.setTargetPosition(x, y);
}

function _pfThrough(f, to, flap) {
  if (to === "out") {
    f.scene = "BACKYARD";
    const p = petFlapYardSpot();
    f.x = p.x;
    f.y = p.y;
    f._flapOutAt = typeof timePlayed === "number" ? timePlayed : 0;
  } else {
    f.scene = flap.scene;
    f.x = flap.x + (Math.random() - 0.5) * 40;
    f.y = flap.y + 20;
    f._flapOutAt = undefined;
  }
  f.currentCage = null;
  f.initBehavior("IDLE");
  if (typeof f.targetX !== "undefined") {
    f.targetX = null;
    f.targetY = null;
  }
}

let _pfWildToldAt = -1e9;

function updatePetFlaps(dt) {
  if (typeof fluffies === "undefined") return;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  // Fluffies on their way to the flap (every step: arrive and go through)
  for (const f of fluffies) {
    const t = f._flapTrip;
    if (!t) continue;
    const flap = objects.find((o) => o.id === t.flapId);
    if (!flap || !flap.works() || !_pfCanGo(f) || now - t.at > PET_FLAP_TRIP_GIVE_UP || now < t.at) {
      f._flapTrip = null;
      continue;
    }
    const spot = t.to === "out" ? { x: flap.x, y: flap.y + 10 } : t.yard;
    if (Math.hypot(f.x - spot.x, f.y - spot.y) > 40) {
      if (!f.isMovingOrRunning()) _pfWalk(f, spot.x, spot.y);
      continue;
    }
    f._flapTrip = null;
    if (flap.locked) {
      if (f.adopted && !f.tooYoungToSpeak() && typeof sayIfAwake === "function") sayIfAwake(f, ["PET_FLAP", "LOCKED"]);
      continue;
    }
    _pfThrough(f, t.to, flap);
    if (!f.adopted && t.to === "in" && now - _pfWildToldAt > 120 && typeof addUIMessage === "function") {
      _pfWildToldAt = now;
      addUIMessage("Something wild got in through the pet flap!");
    }
  }
  if (!petFlapTicker.step(dt)) return;
  const flaps = petFlaps();
  if (!flaps.length) return;
  for (const flap of flaps) {
    for (const f of fluffies) {
      if (f._flapTrip || !_pfCanGo(f)) continue;
      if (f.adopted && f.scene === flap.scene) {
        if (_pfWantsOut(f)) {
          f._flapTrip = { to: "out", flapId: flap.id, at: now };
          if (!flap.locked && typeof sayIfAwake === "function" && Math.random() < 0.3) sayIfAwake(f, ["PET_FLAP", "OUT"]);
        }
      } else if (f.scene === "BACKYARD" && (f.adopted ? flap === flaps[0] && _pfWantsIn(f, now) : !flap.locked && Math.random() < PET_FLAP_WILD_CHANCE)) {
        const yard = petFlapYardSpot();
        f._flapTrip = { to: "in", flapId: flap.id, at: now, yard };
      }
    }
  }
}
registerSystem("petFlap", updatePetFlaps, 58);

SPAWN_ACTIONS.push({
  name: "Pet flap",
  desc: "A little door out to the backyard: your fluffies come and go on their own. Right-click to lock it - unlocked, strays in the yard can get in too.",
  cost: PET_FLAP_PRICE,
  isItem: "pet_flap",
});
