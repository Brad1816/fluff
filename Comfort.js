// ---------------------------------------------------------------------------
// Comfort and the mind (plan round 8): the mummah blankie, lights left on,
// "babbehs am at da vet", "da towew", the last straw and crowding collapse.
//
// MUMMAH BLANKIE (Fluff Mart, Home & Housing, BLANKIE_PRICE; in the shopping
// bag): leave it by a mum while she rests and it picks up her smell
// (BLANKIE_SMELL seconds near her; blankie.smellOf, saved). Her foal, kept
// apart from her (another room, a cage, or she's gone), is calmer with it
// close by: its grief eases, it cheers up, a fright passes. A foal that
// has an accident on it soils it (blankie.soiled) - take a soiled blankie
// away while the foal sees and it learns it's "bad poopies" (f.badPoopies,
// saved): sadder and more timid each time. The sponge washes a blankie.
//
// LIGHTS LEFT ON (the 💡 chip on a room's wall): the light stays on all
// night. No fear of the dark - but they sleep badly (LIGHTS_REST rest), and
// after LIGHTS_LOST nights of it they lose track of the days (f.lostDays,
// saved): mood and health slip until they get a dark night again.
//
// "BABBEHS AM AT DA VET": a mum missing her foals (taken to another room,
// sold, given away) can be lied to - right-click: "Tell her: at da vet".
// For VET_LIE_DAYS she doesn't grieve them ("Babbehs come back soon!");
// then she works it out, and it hits harder (VET_LIE_HIT, and less trust).
//
// "DA TOWEW": when one of yours is taken for good (sold, culled, ground up,
// fed to the machine...) the others who knew it tell scary stories about
// where it went (f.towerFear, saved): a bit sadder, a bit better behaved
// (calmer: temper eased), nightmares about it. It fades (TOWER_FADE a day).
//
// THE LAST STRAW: a gentle fluffy picked on again and again (FoalLife.js
// bullying) builds up pressure (f.strawPressure). At LAST_STRAW it goes for
// the bully once with everything it has (LAST_STRAW_HIT), then sits stunned;
// the others are wary of it for a while.
//
// CROWDING COLLAPSE: a room over its space (Population.js) for
// COLLAPSE_HOURS breaks down (crowdCollapse, saved): mums stop nursing,
// grown-ups go listless (only eat and groom: slower, sadder) and foals
// raised there grow up misfits (f.crowdRaised, saved: less sociable). It
// recovers once the room's been under its space a while.
// ---------------------------------------------------------------------------

const BLANKIE_PRICE = 15;
const BLANKIE_SMELL = 40; // game seconds by her
const BLANKIE_NEAR = 110;
const LIGHTS_REST = 0.5;
const LIGHTS_LOST = 2; // nights
const VET_LIE_DAYS = 2;
const VET_LIE_HIT = 0.3;
const TOWER_HEARD = 0.25;
const TOWER_FADE = 0.15; // a game day
const TOWER_RETOLD = 0.6; // a retelling leaves the listener at most this much of the teller's fear
const LAST_STRAW = 5;
const LAST_STRAW_HIT = 30;
const COLLAPSE_HOURS = 24;
const comfortTicker = new Ticker(2);

if (typeof SHOPPING_BAG_TYPES !== "undefined" && !SHOPPING_BAG_TYPES.includes("blankie")) SHOPPING_BAG_TYPES.push("blankie");

function _cSay(f, keys, target = null, force = true) {
  if (f && f.isAlive && !f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(keys, f, target), force);
}
function _cHours(step) {
  return step / HOUR_LENGTH;
}

// ---- Saved state: lights and collapse ----
function freshComfortState() {
  return { lights: {}, collapse: {} };
}
let comfortState = freshComfortState();
if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({
    name: "comfortState",
    get: () => comfortState,
    set: (v) => {
      _towerKnown = null; // (a loaded game: start watching afresh)
      return (comfortState = v && typeof v === "object" ? v : freshComfortState());
    },
    fresh: () => freshComfortState(),
  });
}
function _csOk() {
  if (!comfortState || typeof comfortState !== "object") comfortState = freshComfortState();
  if (!comfortState.lights || typeof comfortState.lights !== "object") comfortState.lights = {};
  if (!comfortState.collapse || typeof comfortState.collapse !== "object") comfortState.collapse = {};
  return comfortState;
}

// ---- The blankie ----
class Blankie {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.smellOf = null;
    this.smell = 0;
    this.soiled = false;
    this._wasHeld = false;
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  update() {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = Math.max(mouse.y + this.dragOffset.y, sceneTop(this.scene) + 10);
      if (!this._wasHeld) {
        this._wasHeld = true;
        blankieTakenAway(this);
      }
    } else this._wasHeld = false;
    handleGenericCageContainment(this, 44, 20);
  }
  onDrop() {
    return handleDropping(this);
  }
  hitTest(px, py) {
    return Math.abs(px - this.x) < 26 && py > this.y - 22 && py < this.y + 6;
  }
  getBottomY() {
    return this.y;
  }
  serialize() {
    return { classType: "Blankie", id: this.id, x: this.x, y: this.y, scene: this.scene, smellOf: this.smellOf, smell: this.smell, soiled: this.soiled, currentCageId: this.currentCage ? this.currentCage.id : null };
  }
  deserialize(d) {
    this.smellOf = d.smellOf ?? null;
    this.smell = d.smell || 0;
    this.soiled = !!d.soiled;
  }
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    drawBlankieShape(ctx, this.x, this.y, 1, this.soiled, !!this.smellOf);
  }
}

function drawBlankieShape(c, x, y, k = 1, soiled = false, smells = false) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.fillStyle = "#f3c6dd";
  c.strokeStyle = "#b9789a";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-24, -4);
  c.quadraticCurveTo(-10, -16, 6, -12);
  c.quadraticCurveTo(24, -10, 24, -2);
  c.quadraticCurveTo(10, 4, -24, -4);
  c.fill();
  c.stroke();
  c.fillStyle = "#e7a8c8";
  for (let i = -16; i < 20; i += 9) c.fillRect(i, -9, 4, 4);
  if (soiled) {
    c.fillStyle = "rgba(110, 76, 48, 0.85)";
    c.beginPath();
    c.ellipse(4, -6, 6, 3, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (smells) {
    c.fillStyle = "#d64b8a";
    c.font = "10px Arial";
    c.textAlign = "center";
    c.fillText("♥", 0, -16);
  }
  c.restore();
}

function _blankiesNear(f, range = BLANKIE_NEAR) {
  return objects.filter((o) => o instanceof Blankie && o.scene === f.scene && !o.isDragging && o.currentCage === f.currentCage && Math.hypot(o.x - f.x, o.y - f.y) < range);
}

// A foal kept apart from its mum, with her blankie by it?
function blankieComforts(f) {
  if (!f || !f.isAlive || f.growth >= 0.6 || f.motherId == null) return null;
  const mum = fluffyById(f.motherId);
  const apart = !mum || !mum.isAlive || mum.scene !== f.scene || mum.currentCage !== f.currentCage;
  if (!apart) return null;
  return _blankiesNear(f).find((b) => b.smellOf === f.motherId) || null;
}

// HorseToilet: an accident on the blankie
function blankieSoiledBy(f, x, y) {
  for (const b of objects) {
    if (!(b instanceof Blankie) || b.scene !== f.scene || b.isDragging || Math.hypot(b.x - x, b.y - y) > 50) continue;
    b.soiled = true;
    return true;
  }
  return false;
}

// Picked up: was it soiled, with its foal watching? "Bad poopies"
function blankieTakenAway(b) {
  if (!b.soiled || b.smellOf == null) return false;
  let any = false;
  for (const f of fluffies) {
    if (!f.isAlive || f.motherId !== b.smellOf || f.growth >= 0.6 || f.scene !== b.scene || !f.canSee() || Math.hypot(f.x - b.x, f.y - b.y) > 300) continue;
    f.badPoopies = (f.badPoopies || 0) + 1;
    f.changeHappiness(-0.1, "Its blankie taken away: bad poopies");
    if (!f.traitShift || typeof f.traitShift !== "object") f.traitShift = {};
    f.traitShift.bravery = Math.max(-0.6, (f.traitShift.bravery || 0) - 0.08);
    f.expressionOverride = "CRYING_SHOCKED";
    f.expressionOverrideTimer = 3;
    _cSay(f, ["BLANKIE", "BAD_POOPIES"]);
    any = true;
  }
  return any;
}

// ---- Lights left on ----
function lightsAlwaysOn(scene) {
  return !!_csOk().lights[scene];
}

function toggleLights(scene = currentScene) {
  const s = _csOk();
  s.lights[scene] = !s.lights[scene];
  if (!s.lights[scene]) delete s.lights[scene];
  if (typeof addUIMessage === "function") addUIMessage(s.lights[scene] ? "The lights will stay on all night in here." : "Lights out at night again.");
  return !!s.lights[scene];
}

// HorseUpdate sleep: resting under a light left on
function lightsRestFactor(f) {
  if (!f || !lightsAlwaysOn(f.scene)) return 1;
  const night = typeof nightAmount === "function" ? nightAmount() : 0;
  return night > 0.5 ? LIGHTS_REST : 1;
}

// ---- "Babbehs am at da vet" ----
function _lostFoals(mum) {
  if (!mum || !mum.perceivedRelationships || mum.gender !== "female") return [];
  const rels = (typeof relationships !== "undefined" && relationships[mum.id]) || {};
  const out = [];
  for (const [id, p] of Object.entries(mum.perceivedRelationships)) {
    if (p.state !== "lost") continue;
    if (rels[id] !== "baby_child" && rels[id] !== "child") continue;
    const k = fluffyById(id);
    if (k && k.growth >= 1) continue;
    out.push(id);
  }
  return out;
}

function vetLieActive(mum) {
  return !!(mum && mum.vetLie && typeof mum.vetLie.until === "number" && timePlayed < mum.vetLie.until);
}

// HorseFamily.updateRelationships: believes they're coming back
function believesAtVet(mum, otherId) {
  return vetLieActive(mum) && Array.isArray(mum.vetLie.ids) && mum.vetLie.ids.includes(String(otherId));
}

function tellVetLie(mum) {
  const ids = _lostFoals(mum);
  if (!ids.length) return false;
  mum.vetLie = { ids: ids.map(String), until: timePlayed + VET_LIE_DAYS * DAY_LENGTH, at: timePlayed };
  for (const id of ids) if (mum.perceivedRelationships[id]) mum.perceivedRelationships[id].state = "current";
  mum.changeHappiness(0.1, "Her babbehs are at the vet");
  _cSay(mum, ["VET_LIE", "BELIEVES"]);
  return true;
}

function _vetLieFoundOut(mum) {
  const ids = mum.vetLie.ids || [];
  mum.vetLie = null;
  let gone = 0;
  for (const id of ids) {
    const k = fluffyById(id);
    if (k && k.isAlive && k.scene === mum.scene) continue; // (one came back)
    gone++;
    if (mum.perceivedRelationships[id]) mum.perceivedRelationships[id].state = "lost";
  }
  if (!gone) return;
  mum.changeHappiness(-VET_LIE_HIT, "Her babbehs never came back from the vet");
  if (typeof changePlayerTrust === "function") changePlayerTrust(mum, -0.15);
  mum.expressionOverride = "CRYING_SHOCKED";
  mum.expressionOverrideTimer = 4;
  _cSay(mum, ["VET_LIE", "FOUND_OUT"]);
  if (typeof recordStory === "function") recordStory("turning", mum, { x: `${fluffyDisplayName(mum)} worked out her foals were never coming back from the vet.` });
}

// ---- "Da towew" ----
let _towerKnown = null; // id -> { scene, alive }

function _towerTaken(f, scene, killed = false) {
  // Room-mates who knew it hear the story (one gone missing a day is enough
  // to scare them - a busy day of sales doesn't stack up; a killing always does)
  const day = typeof getDayNumber === "function" ? getDayNumber() : 0;
  for (const o of fluffies) {
    if (o === f || !o.isAlive || !o.adopted || o.scene !== scene || o.tooYoungToSpeak()) continue;
    const knew = typeof haveMet !== "function" || haveMet(o, f);
    if (!knew) continue;
    if (!killed && o._towerDay === day) continue;
    o._towerDay = day;
    hearTowerStory(o, TOWER_HEARD);
  }
}

function hearTowerStory(o, amount) {
  o.towerFear = Math.min(1, (o.towerFear || 0) + amount);
  o.changeHappiness(-0.03, "Scary stories about the tower");
  if (!o.traitShift || typeof o.traitShift !== "object") o.traitShift = {};
  o.traitShift.temper = Math.max(-0.4, (o.traitShift.temper || 0) - 0.03); // (better behaved)
}

function _towerCheck() {
  const now = new Map();
  for (const f of fluffies) now.set(f.id, { scene: f.scene, alive: f.isAlive, cause: f.causeOfDeath || "", adopted: !!f.adopted });
  if (_towerKnown) {
    for (const [id, was] of _towerKnown) {
      if (!was.alive || !was.adopted) continue; // (only yours; one that ran off or was put out isn't "taken")
      const cur = now.get(id);
      const away = typeof dayCareFluffies !== "undefined" && Array.isArray(dayCareFluffies) && dayCareFluffies.some((d) => String(d.id) === String(id)); // (only at day care)
      const takenAlive = !cur && !away && typeof getSceneConfig === "function" && getSceneConfig(was.scene).insidePlayerQuarters;
      const killed = cur && !cur.alive && /cull|suffocat|grind|machine|mill|put to sleep|ground/i.test(cur.cause);
      if (takenAlive || killed) _towerTaken({ id }, was.scene, !!killed);
    }
  }
  _towerKnown = now;
}

if (typeof DREAM_SOURCES !== "undefined") {
  DREAM_SOURCES.push((f) => ((f.towerFear || 0) > 0.15 ? [{ good: false, weight: 4 * f.towerFear, icon: null, text: "Nu! Nu wan' go tu da towew!" }] : []));
}

// ---- The last straw ----
function lastStrawPressure(victim, bully) {
  if (!victim || !bully || !victim.isAlive || !bully.isAlive) return false;
  const temper = typeof traitValue === "function" ? traitValue(victim, "temper") : 0;
  if (temper > 0.1) return false; // (only a gentle one bottles it up)
  victim.strawPressure = (victim.strawPressure || 0) + 1;
  if (victim.strawPressure < LAST_STRAW) return false;
  victim.strawPressure = 0;
  // Everything it has, once
  _cSay(victim, ["LAST_STRAW", "SNAP"], bully);
  if (typeof victim.performAttack === "function") victim.performAttack(bully);
  bully.health = Math.max(1, bully.health - LAST_STRAW_HIT * (0.5 + 0.5 * Math.min(1, victim.growth)));
  bully.changeHappiness(-0.1, "Turned on by the one it picked on");
  bully.bullyScore = Math.max(0, (bully.bullyScore || 0) - 3);
  // ...then sits there, stunned
  if (typeof victim.initBehavior === "function") victim.initBehavior("SITTING");
  victim.expressionOverride = "CRYING_SHOCKED";
  victim.expressionOverrideTimer = 5;
  victim.lastStrawAt = timePlayed;
  for (const o of fluffies) {
    if (o === victim || !o.isAlive || o.scene !== victim.scene || !o.canSee()) continue;
    if (!Array.isArray(o.fearedFluffies)) o.fearedFluffies = [];
    if (!o.fearedFluffies.some((x) => x.id === victim.id)) o.fearedFluffies.push({ id: victim.id, timer: 300, reason: "LAST_STRAW" });
  }
  if (typeof recordStory === "function") recordStory("turning", victim, { x: `${fluffyDisplayName(victim)} had had enough, and turned on ${fluffyDisplayName(bully)}.` });
  return true;
}

// ---- Crowding collapse ----
function roomCollapsed(scene) {
  return (_csOk().collapse[scene] || 0) >= COLLAPSE_HOURS;
}

function _collapseTick(step) {
  const s = _csOk();
  const scenes = typeof deliveryRooms === "function" ? deliveryRooms() : ["INDOORS", "BACKYARD"];
  for (const sc of scenes) {
    const crowded = typeof crowding === "function" && crowding(sc) > 0;
    const h = s.collapse[sc] || 0;
    const nh = crowded ? h + _cHours(step) : Math.max(0, h - 2 * _cHours(step));
    if (!crowded && h >= COLLAPSE_HOURS && nh < COLLAPSE_HOURS && typeof noteDayEvent === "function") noteDayEvent("news", { text: `${typeof houseRoomName === "function" ? houseRoomName(sc) || "The backyard" : sc} is settling down again.` });
    if (crowded && h < COLLAPSE_HOURS && nh >= COLLAPSE_HOURS) {
      const name = (typeof houseRoomName === "function" && houseRoomName(sc)) || "The backyard";
      if (typeof addUIMessage === "function") addUIMessage(`${name} has been crowded too long - it's breaking down.`);
      if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `${name} has been crowded too long and is breaking down: mums stop nursing, the grown-ups go listless.` });
    }
    if (nh > 0) s.collapse[sc] = Math.min(COLLAPSE_HOURS * 3, nh);
    else delete s.collapse[sc];
  }
}

function isListless(f) {
  return !!(f && f.isAlive && f.growth >= 1 && !f.currentCage && roomCollapsed(f.scene) && f.id % 2 === 0);
}

// Horse.updateSpeed
function listlessSpeed(f) {
  return isListless(f) ? 0.6 : 1;
}

// ---- Every couple of seconds ----
function updateComfort(dt) {
  const step = comfortTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const hours = _cHours(step);
  const night = typeof nightAmount === "function" ? nightAmount() : 0;
  // Blankies pick up a mum's smell; washed by the sponge
  for (const b of objects) {
    if (!(b instanceof Blankie) || b.isDragging) continue;
    const mum = fluffies.find((m) => m.isAlive && m.gender === "female" && m.growth >= 1 && m.scene === b.scene && m.currentCage === b.currentCage && Math.hypot(m.x - b.x, m.y - b.y) < 70 && fluffies.some((k) => k.isAlive && k.motherId === m.id && k.growth < 0.6));
    if (mum) {
      if (b.smellOf !== mum.id) {
        b.smell = Math.max(0, (b.smell || 0) - step * 0.5);
        if (b.smell <= 0) b.smellOf = null;
      }
      if (b.smellOf == null || b.smellOf === mum.id) {
        b.smell = Math.min(BLANKIE_SMELL, (b.smell || 0) + step);
        if (b.smell >= BLANKIE_SMELL) b.smellOf = mum.id;
      }
    }
    const sponge = typeof Sponge !== "undefined" ? objects.find((o) => o instanceof Sponge && o.isDragging && o.scene === b.scene && Math.hypot(o.x - b.x, o.y - b.y) < 40) : null;
    if (sponge && b.soiled) {
      b.soiled = false;
      if (typeof addUIMessage === "function") addUIMessage("Blankie washed.");
    }
  }
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    // Comforted by mum's blankie
    const b = blankieComforts(f);
    if (b) {
      f.changeHappiness(0.06 * hours, "Mummah's blankie");
      if (f.separation && typeof f.separation.grief === "number") f.separation.grief = Math.max(0, f.separation.grief - 0.04 * hours);
      if (typeof isFrightened === "function" && isFrightened(f) && Math.random() < 0.3 && typeof endFright === "function") endFright(f);
      if (Math.random() < 0.01 * step) _cSay(f, ["BLANKIE", "COMFORT"], null, false);
    }
    // Bad poopies: it carries that
    if ((f.badPoopies || 0) > 0 && Math.random() < 0.004 * step) _cSay(f, ["BLANKIE", "SHAME"], null, false);
    // Lights left on at night
    if (night > 0.6 && lightsAlwaysOn(f.scene) && f.adopted) {
      f._litNightAt = timePlayed;
      if (!f._litNightCounted || timePlayed - f._litNightCounted > DAY_LENGTH * 0.6) {
        f._litNightCounted = timePlayed;
        f.litNights = (f.litNights || 0) + 1;
        if (f.litNights >= LIGHTS_LOST && !f.lostDays) {
          f.lostDays = true;
          _cSay(f, ["LIGHTS", "LOST"], null, false);
        }
      }
      if (f.currentStateKey === "SLEEPING") f.changeHappiness(-0.03 * hours, "The light's on - can't sleep well");
    } else if (night > 0.6 && !lightsAlwaysOn(f.scene)) {
      f.litNights = 0;
      if (f.lostDays) f.lostDays = false;
    }
    if (f.lostDays) {
      f.changeHappiness(-0.02 * hours, "Lost track of the days");
      f.health = Math.max(1, f.health - 0.5 * hours);
    }
    // At da vet
    if (f.vetLie) {
      if (!vetLieActive(f)) _vetLieFoundOut(f);
      else if (Math.random() < 0.004 * step) _cSay(f, ["VET_LIE", "WAITING"], null, false);
    }
    // Da towew: told and retold, fading
    if ((f.towerFear || 0) > 0) {
      f.towerFear = Math.max(0, f.towerFear - (TOWER_FADE * step) / DAY_LENGTH);
      if (f.towerFear > 0.3 && f.scene === currentScene && Math.random() < 0.006 * step && f.currentStateKey !== "SLEEPING" && !f.tooYoungToSpeak()) {
        // (a retold story is weaker: a listener ends up at most TOWER_RETOLD of
        // the teller's fear, so it dies away instead of feeding on itself)
        const listener = fluffies.find((o) => o !== f && o.isAlive && o.adopted && o.scene === f.scene && !o.tooYoungToSpeak() && Math.hypot(o.x - f.x, o.y - f.y) < 250 && (o.towerFear || 0) < f.towerFear * TOWER_RETOLD);
        if (listener) {
          _cSay(f, ["TOWER", "TELL"], listener);
          hearTowerStory(listener, Math.min(TOWER_HEARD * 0.4, f.towerFear * TOWER_RETOLD - (listener.towerFear || 0)));
        }
      }
    }
    // Crowding collapse (a caged one has its own space: spared - a mill's rows of cages keep going)
    if (roomCollapsed(f.scene) && !f.currentCage) {
      if (f.gender === "female" && f.lactatingTimer > 0) {
        f.lactatingTimer = Math.max(0, f.lactatingTimer - step * 3);
        if (Math.random() < 0.1) f.milkCharges = Math.max(0, (f.milkCharges || 0) - 1);
      }
      if (isListless(f)) f.changeHappiness(-0.03 * hours, "The room's breaking down");
      if (f.growth < 1) f._raisedCrowded = (f._raisedCrowded || 0) + step;
    }
    if (f.growth >= 1 && (f._raisedCrowded || 0) > DAY_LENGTH * 0.5 && !f.crowdRaised) {
      f.crowdRaised = true;
      if (!f.traitShift || typeof f.traitShift !== "object") f.traitShift = {};
      f.traitShift.social = Math.max(-0.6, (f.traitShift.social || 0) - 0.3);
    }
  }
  _towerCheck();
  _collapseTick(step);
}
registerSystem("comfort", updateComfort, 146.5);

// ---- Menus and the magnifying glass ----
function comfortActions(f) {
  if (!f || !f.isAlive || !f.adopted) return [];
  const out = [];
  if (!vetLieActive(f) && _lostFoals(f).length) out.push({ key: "vet_lie", name: "Tell her: at da vet", sub: "she won't grieve - yet", harsh: true, run: (x) => tellVetLie(x) });
  return out;
}
if (typeof FLUFFY_ACTION_SOURCES !== "undefined") FLUFFY_ACTION_SOURCES.push(comfortActions);

function describeComfortMind(f) {
  const parts = [];
  if (vetLieActive(f)) parts.push("thinks her babbehs are at the vet");
  if ((f.badPoopies || 0) > 0) parts.push(`thinks it's "bad poopies"`);
  if (f.lostDays) parts.push("lost track of the days (the light's always on)");
  if ((f.towerFear || 0) > 0.15) parts.push("scared of \"da towew\"");
  if (isListless(f)) parts.push("listless (the room's crowded too long)");
  if (f.crowdRaised) parts.push("grew up in a crowd: a misfit");
  if ((f.strawPressure || 0) >= 3) parts.push("at the end of its tether with a bully");
  if (blankieComforts(f)) parts.push("comforted by mummah's blankie");
  if (!parts.length) return null;
  return [parts.join(" · "), blankieComforts(f) && parts.length === 1 ? "good" : "bad"];
}
if (typeof INSPECT_ROWS !== "undefined") INSPECT_ROWS.push(["On its mind", "describeComfortMind"]);

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({ name: "Blankie", desc: "Leave it by a mum while she rests and it smells of her: her foal, kept apart from her, is calmer with it. Wash it if it's soiled - taking a soiled one away hurts.", cost: BLANKIE_PRICE, isItem: "blankie" });
}
if (typeof STORE_AISLES !== "undefined") {
  const home = STORE_AISLES.find((a) => a.id === "home");
  if (home && !home.items.includes("blankie")) home.items.splice(home.items.indexOf("plushie") + 1, 0, "blankie");
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push({
    sellType: "blankie",
    is: (o) => o instanceof Blankie,
    sellable: true,
    hitTest: (o, x, y) => o.hitTest(x, y),
    create: (a, sx, sy) => atSpot(new Blankie(currentScene), sx, sy),
    drawIcon: (ctx) => drawBlankieShape(ctx, 0, 8, 0.9),
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.Blankie = (d) => new Blankie(d.scene);
