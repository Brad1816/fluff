// ---------------------------------------------------------------------------
// Territory: herds in Fluffy Park claim meadows and fight over them.
//
// Built on Herds.js (herds, leaders), ParkLife.js (meadows, bushes) and
// SpatialGrid.js (finding who's nearby quickly).
//
// - A meadow's territory is the meadow plus a strip around it
//   (TERRITORY_MARGIN_X/Y), so bushes at its edge belong to it too.
// - Claiming: a herd with 2+ grown-ups in the park and no territory claims
//   the nearest free meadow. If none are free it picks a herd smaller than
//   itself and heads for that herd's meadow (a challenge).
// - Taking over: if another herd has more grown-ups inside a territory than
//   its owners for TAKEOVER_TIME seconds, the meadow changes hands. The
//   losers remember who did it (opinions drop both ways).
// - Defending: owners chase out fluffies that aren't in their herd
//   (DefendTerritoryDesire). When they reach them they shout, the intruder
//   runs out (LeaveTerritoryDesire) and keeps away for KEEP_OUT_TIME, and
//   now and then there's a scuffle -
//   much more likely against a challenging herd than a lost loner. Timid
//   fluffies don't chase anyone; brave, grumpy ones don't run.
// - Food: hungry fluffies prefer food on their own land and avoid food in
//   another herd's territory unless they're starving (territoryFoodBias,
//   used by HorsePositioning scoutForHunger).
// - Leaders take the herd home (HomeTerritoryDesire); members follow the
//   leader as usual.
//
// Stored on each herd in herdState (so it's saved): h.territory (meadow
// index or null), h.challenge (meadow index or null), h.contest
// ({ idx, time } while trying to take a meadow).
// ---------------------------------------------------------------------------

const TERRITORY_MARGIN_X = 140;
const TERRITORY_MARGIN_Y = 100;
const TERRITORY_TICK = 2; // seconds
const TAKEOVER_TIME = 20; // seconds of outnumbering the owners
const DEFEND_RANGE = 380; // owners this close to an intruder go after it
const KEEP_OUT_TIME = 120; // seconds a chased-off fluffy keeps away
const HUNGRY_HERD = 0.45; // average hunger below this: the herd looks for better land

const MEADOW_NAMES = [
  "Buttercup Field",
  "Clover Patch",
  "Sunny Hollow",
  "Tall Grass Dip",
  "Daisy Bank",
  "Bumblebee Green",
  "Dewdrop Lea",
  "Foxglove Rise",
  "Honey Hill",
  "Mossy Flat",
];

let _territoryTimer = 0;

function meadowName(idx) {
  return MEADOW_NAMES[idx % MEADOW_NAMES.length];
}

function territoryZone(idx) {
  const m = PARK_MEADOWS[idx];
  return { x: m.x, y: m.y, rx: m.rx + TERRITORY_MARGIN_X, ry: m.ry + TERRITORY_MARGIN_Y };
}

function inTerritoryZone(idx, x, y) {
  const z = territoryZone(idx);
  return ((x - z.x) / z.rx) ** 2 + ((y - z.y) / z.ry) ** 2 <= 1;
}

function _validIdx(i) {
  return Number.isInteger(i) && i >= 0 && i < PARK_MEADOWS.length;
}

// The herd that holds meadow idx (or null)
function territoryOwner(idx) {
  if (typeof _herdList !== "function") return null;
  return _herdList().find((h) => h.territory === idx) || null;
}

// The meadow a herd holds (or null)
function herdTerritory(h) {
  return h && _validIdx(h.territory) ? h.territory : null;
}

// Which held territory is (x, y) in? { idx, herd } or null
function territoryAt(scene, x, y) {
  if (scene !== PARK_SCENE) return null;
  for (let i = 0; i < PARK_MEADOWS.length; i++) {
    if (!inTerritoryZone(i, x, y)) continue;
    const herd = territoryOwner(i);
    if (herd) return { idx: i, herd };
  }
  return null;
}

// Is `f` somewhere it doesn't belong? Returns the territory or null
function trespassing(f) {
  const t = territoryAt(f.scene, f.x, f.y);
  if (!t || herdOf(f) === t.herd) return null;
  return t;
}

// Is `f` unwelcome on `host`'s herd's land right now? (trespassing there, or
// recently chased off it). Hosts won't make friends with it (Bonds.js).
function unwelcomeOnLand(f, host) {
  const h = herdOf(host);
  const idx = herdTerritory(h);
  if (idx === null || herdOf(f) === h) return false;
  if (f.scene === PARK_SCENE && inTerritoryZone(idx, f.x, f.y)) return true;
  return !!f._keepOut && f._keepOut.idx === idx && f._keepOut.until > _now();
}

// For the herd line in the magnifying glass panel
function describeTerritory(h) {
  const t = herdTerritory(h);
  return t === null ? "" : meadowName(t);
}

// ---- Food choice (HorsePositioning scoutForHunger, in the park) ----
// A number of pixels added to how far away the food "feels"
function territoryFoodBias(horse, food) {
  const t = territoryAt(food.scene, food.x, food.y);
  if (!t) return 0;
  if (t.herd === herdOf(horse)) return -150; // our own land: go there first
  return horse.hunger < 0.25 ? 150 : 450; // someone else's: only if starving
}

// ---- Who can do what ----

function _tv(f, k) {
  return typeof traitValue === "function" ? traitValue(f, k) : 0;
}

function _grownUp(f) {
  return f.isAlive && f.growth >= 1 && !f.tooYoungToWalk();
}

function _canDefend(f) {
  return (
    _grownUp(f) &&
    !f.isDragging &&
    !f.placedOn &&
    !f.currentCage &&
    !f.isScared &&
    f.currentStateKey !== "SLEEPING" &&
    f.hunger >= 0.2 &&
    f.canSee() &&
    _tv(f, "bravery") > -0.4
  );
}

// Brave and grumpy: doesn't run when chased
function _standsGround(f) {
  return _tv(f, "bravery") > 0.5 && _tv(f, "temper") > 0.5;
}

function _now() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}

function _parkNews(text) {
  if (currentScene === PARK_SCENE && typeof addUIMessage === "function") addUIMessage(text);
}

// ---- Every simulation step (script.js); works every TERRITORY_TICK ----

function updateTerritories(dt) {
  if (typeof _herdList !== "function" || typeof PARK_MEADOWS === "undefined") return;
  _territoryTimer -= dt;
  if (_territoryTimer > 0) return;
  const step = TERRITORY_TICK - _territoryTimer;
  _territoryTimer = TERRITORY_TICK;
  const now = _now();
  rebuildFluffyGrid();

  const herds = _herdList();
  const parkAdults = new Map();
  for (const h of herds) {
    parkAdults.set(
      h,
      getHerdMembers(h).filter((f) => f.scene === PARK_SCENE && _grownUp(f)),
    );
  }

  // 1. Herds that have left the park (or shrunk) let go of their land
  for (const h of herds) {
    if (!_validIdx(h.territory)) h.territory = null;
    if (!_validIdx(h.challenge) || h.challenge === h.territory) h.challenge = null;
    if (parkAdults.get(h).length < 2) {
      h.territory = null;
      h.challenge = null;
      h.contest = null;
    }
  }

  // 2. Claim a free meadow, or pick a weaker herd to challenge
  for (const h of herds) {
    const adults = parkAdults.get(h);
    if (adults.length < 2) continue;
    if (h.territory !== null) {
      _maybeHungryChallenge(h, adults, herds, parkAdults);
      continue;
    }
    const c = getHerdCentre(h, PARK_SCENE);
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < PARK_MEADOWS.length; i++) {
      if (territoryOwner(i)) continue;
      const d = Math.hypot(PARK_MEADOWS[i].x - c.x, PARK_MEADOWS[i].y - c.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best !== null) {
      h.territory = best;
      h.challenge = null;
      h.contest = null;
      _say(getHerdLeader(h), ["TERRITORY", "CLAIM"]);
      _tellPlayer(h, `The ${getHerdName(h)} made ${meadowName(best)} in Fluffy Park its home.`);
      continue;
    }
    // Everything's taken: go after a smaller herd's meadow
    let target = null;
    bestD = Infinity;
    for (const o of herds) {
      if (o === h || herdTerritory(o) === null) continue;
      if (parkAdults.get(o).length >= adults.length) continue;
      const m = PARK_MEADOWS[o.territory];
      const d = Math.hypot(m.x - c.x, m.y - c.y);
      if (d < bestD) {
        bestD = d;
        target = o.territory;
      }
    }
    h.challenge = target;
  }

  // 3. Who's in each held territory: takeovers and defending
  for (let idx = 0; idx < PARK_MEADOWS.length; idx++) {
    const owner = territoryOwner(idx);
    if (!owner) continue;
    const z = territoryZone(idx);
    const inside = fluffiesNear(PARK_SCENE, z.x, z.y, z.rx).filter((f) => inTerritoryZone(idx, f.x, f.y));

    // Grown-ups per herd inside
    const counts = new Map();
    for (const f of inside) {
      const h = herdOf(f);
      if (h && _grownUp(f)) counts.set(h, (counts.get(h) || 0) + 1);
    }
    const ownersIn = counts.get(owner) || 0;
    for (const h of herds) {
      if (h === owner) continue;
      const n = counts.get(h) || 0;
      if (n >= 2 && n > ownersIn) {
        if (!h.contest || h.contest.idx !== idx) h.contest = { idx, time: 0 };
        h.contest.time += step;
        if (h.contest.time >= TAKEOVER_TIME) _takeOver(h, owner, idx);
      } else if (h.contest && h.contest.idx === idx) {
        h.contest = null;
      }
    }
    if (territoryOwner(idx) !== owner) continue; // just changed hands

    // Owners go after intruders (one chaser each, two for challengers)
    const defenders = fluffiesNear(PARK_SCENE, z.x, z.y, z.rx + DEFEND_RANGE).filter(
      (f) => herdOf(f) === owner && _canDefend(f),
    );
    for (const intruder of inside) {
      if (herdOf(intruder) === owner || intruder.growth < 0.3 || intruder.isDragging || intruder.currentCage) continue;
      const challenger = _isChallenger(intruder, idx);
      const want = challenger ? 2 : 1;
      let have = defenders.filter((d) => d._defend && d._defend.id === intruder.id && d._defend.until > now).length;
      const free = defenders
        .filter((d) => !d._defend || d._defend.until <= now)
        .map((d) => [d, Math.hypot(d.x - intruder.x, d.y - intruder.y)])
        .filter(([, dist]) => dist < DEFEND_RANGE)
        .sort((a, b) => a[1] - b[1]);
      for (const [d] of free) {
        if (have >= want) break;
        d._defend = { id: intruder.id, idx, until: now + 10 };
        have++;
      }
    }
  }
}

// Food left in a territory (grass and berries, in bites)
function territoryFood(idx) {
  let n = 0;
  for (const o of objects) {
    if (o instanceof Grass && o.scene === PARK_SCENE && inTerritoryZone(idx, o.x, o.y)) n += Math.floor(o.growth);
  }
  return n;
}

// A herd that has land but is going hungry eyes a smaller herd's meadow
// that has more food
function _maybeHungryChallenge(h, adults, herds, parkAdults) {
  const members = getHerdMembers(h).filter((f) => f.scene === PARK_SCENE);
  const avgHunger = members.reduce((s, f) => s + f.hunger, 0) / Math.max(1, members.length);
  if (avgHunger >= HUNGRY_HERD) {
    if (h.challenge !== null && avgHunger > HUNGRY_HERD + 0.2) h.challenge = null; // fed again
    return;
  }
  if (h.challenge !== null && territoryOwner(h.challenge)) return; // already on it
  const mine = territoryFood(h.territory);
  let target = null;
  let bestFood = mine + 3;
  for (const o of herds) {
    if (o === h || herdTerritory(o) === null) continue;
    if (parkAdults.get(o).length >= adults.length) continue;
    const food = territoryFood(o.territory);
    if (food > bestFood) {
      bestFood = food;
      target = o.territory;
    }
  }
  h.challenge = target;
}

// Is `f` part of a herd trying to take meadow idx?
function _isChallenger(f, idx) {
  const h = herdOf(f);
  return !!h && (h.challenge === idx || (h.contest && h.contest.idx === idx));
}

function _takeOver(winner, loser, idx) {
  loser.territory = null;
  loser.contest = null;
  winner.territory = idx;
  winner.challenge = null;
  winner.contest = null;
  // Bad blood
  const ws = getHerdMembers(winner);
  const ls = getHerdMembers(loser);
  for (const a of ls) for (const b of ws) changeOpinion(a, b, -0.3, "took its meadow");
  for (const a of ws) for (const b of ls) changeOpinion(a, b, -0.05, "rival herd");
  _say(getHerdLeader(winner), ["TERRITORY", "WON"]);
  _say(getHerdLeader(loser), ["TERRITORY", "LOST"]);
  const text = `The ${getHerdName(winner)} drove the ${getHerdName(loser)} out of ${meadowName(idx)}!`;
  _tellPlayer(winner, text);
  _tellPlayer(loser, text);
  if (!ws.concat(ls).some((f) => f.adopted)) _parkNews(text);
}

// ---- Desires (added in the Horse constructor) ----

// Chase an intruder off our land
class DefendTerritoryDesire extends Desire {
  constructor() {
    super("DefendTerritory");
    this.lastTime = -Infinity;
  }
  _target(horse) {
    const d = horse._defend;
    if (!d || d.until <= _now()) return null;
    const t = fluffies.find((f) => f.id === d.id);
    if (!t || !t.isAlive || t.scene !== horse.scene || t.isDragging) return null;
    if (!inTerritoryZone(d.idx, t.x, t.y) || territoryOwner(d.idx) !== herdOf(horse)) return null;
    return t;
  }
  evaluate(horse) {
    if (!horse._defend) return 0;
    if (!horse.isAlive || horse.isDragging || horse.placedOn || horse.isScared || horse.tooYoungToWalk()) return 0;
    if (horse.currentStateKey === "SLEEPING" || !horse.avoidStateChangerActions()) return 0;
    const t = this._target(horse);
    if (!t) {
      horse._defend = null;
      return 0;
    }
    this.target = t;
    return 52;
  }
  execute(horse) {
    const t = this.target;
    if (!t) return false;
    const now = gameTimeMs();
    if (now - this.lastTime < 500) return true; // keep going
    this.lastTime = now;
    const dist = Math.hypot(t.x - horse.x, t.y - horse.y);
    if (dist > 70) {
      horse.initBehavior("MOVING");
      horse.setTargetPosition(t.x + (horse.x < t.x ? -40 : 40), t.y);
      horse.currentStateKey = "RUNNING";
      if (!horse._lastChaseLine || _now() - horse._lastChaseLine > 6) {
        horse._lastChaseLine = _now();
        _say(horse, ["TERRITORY", "CHASE"], t);
      }
      return true;
    }
    // Caught up: shout them off, and maybe a scuffle
    const idx = horse._defend.idx;
    t._chasedOff = { idx, by: horse.id, until: _now() + 8 };
    // ...and it'll stay away for a while
    t._keepOut = { idx, until: _now() + KEEP_OUT_TIME };
    _say(horse, ["TERRITORY", "CHASE"], t);
    const temper = _tv(horse, "temper");
    const chance = (_isChallenger(t, idx) ? 0.5 : 0.12) * (1 + 0.5 * temper);
    if (
      horse.attackCooldown <= 0 &&
      horse.canFightBack() &&
      t.growth >= 0.5 &&
      !t.tooYoungToWalk() &&
      Math.random() < chance
    ) {
      horse.performAttack(t, "TERRITORY");
    }
    horse._defend = null; // job done; back to normal
    return true;
  }
}

// Get off someone else's land after being chased (running), or walk out if
// it wanders back in while it's still keeping away
class LeaveTerritoryDesire extends Desire {
  constructor() {
    super("LeaveTerritory");
    this.lastTime = -Infinity;
  }
  _active(horse) {
    const now = _now();
    for (const key of ["_chasedOff", "_keepOut"]) {
      const c = horse[key];
      if (!c) continue;
      if (c.until <= now || !territoryOwner(c.idx) || territoryOwner(c.idx) === herdOf(horse)) {
        horse[key] = null;
        continue;
      }
      if (inTerritoryZone(c.idx, horse.x, horse.y)) return { c, running: key === "_chasedOff" };
      if (key === "_chasedOff") horse._chasedOff = null; // made it out
    }
    return null;
  }
  evaluate(horse) {
    if (!horse._chasedOff && !horse._keepOut) return 0;
    const a = this._active(horse);
    if (!a) return 0;
    if (!horse.isAlive || horse.isDragging || horse.placedOn || horse.tooYoungToWalk()) return 0;
    if (horse.currentStateKey === "SLEEPING" || !horse.avoidStateChangerActions()) return 0;
    // A herd that's there to take the meadow holds its ground
    const h = herdOf(horse);
    if (h && h.contest && h.contest.idx === a.c.idx) return 0;
    if (_standsGround(horse)) return 0;
    this.active = a;
    return a.running ? 54 : 46;
  }
  execute(horse) {
    const now = gameTimeMs();
    if (now - this.lastTime < 1000) return true;
    this.lastTime = now;
    const a = this.active;
    if (!a) return false;
    const z = territoryZone(a.c.idx);
    let ang = Math.atan2((horse.y - z.y) / z.ry, (horse.x - z.x) / z.rx);
    ang += (Math.random() - 0.5) * 0.4;
    const x = clamp(z.x + Math.cos(ang) * z.rx * 1.35, 60, PARK_W - 60);
    const y = clamp(z.y + Math.sin(ang) * z.ry * 1.35, PARK_TOP + 60, PARK_H - 60);
    horse.initBehavior("MOVING");
    horse.setTargetPosition(x, y);
    if (a.running) {
      horse.currentStateKey = "RUNNING";
      if (!horse._lastLeaveLine || _now() - horse._lastLeaveLine > 8) {
        horse._lastLeaveLine = _now();
        const chaser = fluffies.find((f) => f.id === a.c.by);
        _say(horse, ["TERRITORY", "LEAVE"], chaser);
      }
    }
    return true;
  }
}

// Leaders take the herd home (or to the meadow they're after)
class HomeTerritoryDesire extends Desire {
  constructor() {
    super("HomeTerritory");
    this.lastTime = -Infinity;
  }
  evaluate(horse) {
    if (horse.scene !== PARK_SCENE) return 0;
    if (!horse.isAlive || horse.isDragging || horse.placedOn || horse.isScared || horse.isStacking) return 0;
    if (horse.sleepingOrTargetSet() || horse.tooYoungToWalk() || !horse.canSee()) return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD || horse.hunger < 0.35) return 0;
    if (gameTimeMs() - this.lastTime < 8000) return 0;
    const h = herdOf(horse);
    if (!h || h.leaderId !== horse.id) return 0;
    // Going after someone else's meadow comes first, then home
    const idx = _validIdx(h.challenge) && territoryOwner(h.challenge) ? h.challenge : herdTerritory(h);
    if (!_validIdx(idx)) return 0;
    const m = PARK_MEADOWS[idx];
    if (((horse.x - m.x) / m.rx) ** 2 + ((horse.y - m.y) / m.ry) ** 2 <= 0.8) return 0;
    this.idx = idx;
    return 46.5; // above a wander; members' follow (47) still wins for them
  }
  execute(horse) {
    this.lastTime = gameTimeMs();
    const m = PARK_MEADOWS[this.idx];
    if (!m) return false;
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 0.6;
    horse.initBehavior("MOVING");
    horse.setTargetPosition(m.x + Math.cos(a) * m.rx * d, m.y + Math.sin(a) * m.ry * d);
    return true;
  }
}

// ---- Drawing (park, world positions; after the meadows) ----

function drawTerritories(c) {
  for (let i = 0; i < PARK_MEADOWS.length; i++) {
    const z = territoryZone(i);
    if (!isOnParkScreen(z.x, z.y, z.rx + 60)) continue;
    const owner = territoryOwner(i);
    c.save();
    if (owner) {
      c.strokeStyle = getHerdColor(owner);
      c.globalAlpha = 0.55;
      c.lineWidth = 4;
      c.setLineDash([18, 12]);
      c.beginPath();
      c.ellipse(z.x, z.y, z.rx, z.ry, 0, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
    // Name tag at the top
    c.globalAlpha = 0.9;
    c.font = "bold 13px Arial";
    c.textAlign = "center";
    c.textBaseline = "middle";
    const label = owner ? `${meadowName(i)} - ${getHerdName(owner)}` : `${meadowName(i)} (free)`;
    const w = c.measureText(label).width + 16;
    const ty = z.y - z.ry + 4;
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.fillRect(z.x - w / 2, ty - 11, w, 22);
    if (owner) {
      c.fillStyle = getHerdColor(owner);
      c.fillRect(z.x - w / 2, ty - 11, 5, 22);
    }
    c.fillStyle = "white";
    c.fillText(label, z.x, ty);
    c.restore();
  }
}

// Park map: held meadows get their herd's colour
function drawTerritoriesOnMap(c, r) {
  const sx = r.w / PARK_W;
  const sy = r.h / PARK_H;
  for (let i = 0; i < PARK_MEADOWS.length; i++) {
    const owner = territoryOwner(i);
    if (!owner) continue;
    const z = territoryZone(i);
    c.strokeStyle = getHerdColor(owner);
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(r.x + z.x * sx, r.y + z.y * sy, z.rx * sx, z.ry * sy, 0, 0, Math.PI * 2);
    c.stroke();
  }
}
