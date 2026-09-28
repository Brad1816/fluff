// ---------------------------------------------------------------------------
// Life in Fluffy Park (Park.js is the camera and scenery; this is what lives
// there).
//
// Food:
//   - Meadows: patches of long grass. Grass grows back in them by itself
//     (up to MEADOW_MAX_TUFTS tufts per meadow). Outside meadows the park is
//     short lawn with nothing to eat.
//   - Berry bushes: each holds up to BERRY_MAX berries and regrows one every
//     BERRY_REGROW seconds. Eating takes one berry; the bush stays. Fluffies
//     like berries more than grass (priority 3 vs 2), but in the park they
//     also care how far away food is (see HorsePositioning scoutForHunger).
//
// Wild fluffies:
//   - The park keeps about PARK_WILD_TARGET wild (not adopted) fluffies.
//     When there are fewer, a new group wanders in at the edge of the park
//     every minute or two: mostly families (mum, maybe dad, and foals of
//     different ages), sometimes a few friends, sometimes a loner. Families
//     like each other, so they make herds by themselves (Herds.js).
//   - If the park gets crowded (over PARK_WILD_MAX, e.g. lots of foals), a
//     wild grown-up now and then wanders off - never one you can see.
//   - The usual "taken by dogs" clean-up (script.js updateFerals) leaves
//     living park fluffies alone.
//
// Tests switch the wild spawning off (parkLife.enabled) so other tests aren't
// surprised by new fluffies; the park tests switch it back on.
// ---------------------------------------------------------------------------

const MEADOW_MAX_TUFTS = 5;
const MEADOW_SEED_EVERY = 18; // seconds between new tufts in each meadow
const BERRY_MAX = 5;
const BERRY_REGROW = 90; // seconds per berry
const PARK_WILD_TARGET = 16;
const PARK_WILD_MAX = 30;

const parkLife = {
  enabled: true,
  spawnTimer: 3,
  seedTimer: 0,
  trimTimer: 45,
};

// Seeded, so every game has the same park layout (like PARK_SCENERY)
const _parkRnd = (() => {
  let s = 777123;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
})();

const PARK_MEADOWS = (() => {
  const list = [];
  let tries = 0;
  while (list.length < 7 && tries++ < 500) {
    const r = 170 + _parkRnd() * 90;
    const m = {
      x: 260 + _parkRnd() * (PARK_W - 520),
      y: PARK_TOP + 220 + _parkRnd() * (PARK_H - PARK_TOP - 440),
      rx: r,
      ry: r * 0.6,
    };
    // Keep meadows apart so herds have several places to go
    if (list.some((o) => Math.hypot(o.x - m.x, (o.y - m.y) * 1.4) < o.rx + m.rx + 120)) continue;
    list.push(m);
  }
  return list;
})();

// Bushes: some at the edge of meadows, some on their own
const PARK_BUSH_SPOTS = (() => {
  const spots = [];
  PARK_MEADOWS.forEach((m, i) => {
    if (i % 2 === 0) {
      const a = _parkRnd() * Math.PI * 2;
      spots.push({ x: m.x + Math.cos(a) * (m.rx + 50), y: m.y + Math.sin(a) * (m.ry + 40) });
    }
  });
  while (spots.length < 12) {
    spots.push({
      x: 150 + _parkRnd() * (PARK_W - 300),
      y: PARK_TOP + 150 + _parkRnd() * (PARK_H - PARK_TOP - 300),
    });
  }
  return spots;
})();

function inParkMeadow(x, y) {
  return PARK_MEADOWS.some((m) => ((x - m.x) / m.rx) ** 2 + ((y - m.y) / m.ry) ** 2 <= 1);
}

function _randomPointInMeadow(m) {
  const a = Math.random() * Math.PI * 2;
  const d = Math.sqrt(Math.random()) * 0.9;
  return { x: m.x + Math.cos(a) * m.rx * d, y: m.y + Math.sin(a) * m.ry * d };
}

function _meadowTufts(m) {
  return objects.filter(
    (o) =>
      o instanceof Grass &&
      !(o instanceof BerryBush) &&
      o.scene === PARK_SCENE &&
      ((o.x - m.x) / m.rx) ** 2 + ((o.y - m.y) / m.ry) ** 2 <= 1,
  );
}

// ---- Berry bush ----
// Works like grass for hungry fluffies (they find and eat it the same way),
// but it keeps its berries coming back instead of being eaten away.
class BerryBush extends Grass {
  constructor(x, y, scene = PARK_SCENE, berries = BERRY_MAX) {
    super(x, y, scene, berries);
  }

  serialize() {
    return { ...super.serialize(), classType: "BerryBush" };
  }

  hasFood() {
    return this.growth >= 1;
  }

  eat() {
    if (this.growth < 1) return false;
    this.growth -= 1;
    if (typeof poofs !== "undefined") poofs.push(new Poof(this.x, this.y - 20, this.scene, "#8e44ad"));
    return true;
  }

  get foodType() {
    return "berries";
  }

  get priority() {
    return 3;
  }

  get berries() {
    return Math.floor(this.growth);
  }

  update(dt) {
    // Lots in autumn, none in winter (WorldTime.js)
    const season = typeof growthMultiplier === "function" ? growthMultiplier("berries") : 1;
    this.growth = Math.min(BERRY_MAX, this.growth + (dt / BERRY_REGROW) * season);
  }

  drawOffScreen(c) {
    const x = this.x;
    const y = this.y;
    c.save();
    c.fillStyle = "rgba(0,0,0,0.18)";
    c.beginPath();
    c.ellipse(x, y + 2, 38, 10, 0, 0, Math.PI * 2);
    c.fill();
    const blobs = [
      [-18, -18, 20],
      [18, -18, 20],
      [0, -30, 24],
      [0, -14, 22],
    ];
    for (const [dx, dy, r] of blobs) {
      c.fillStyle = dy < -20 ? "#3f8f3a" : "#2f7a2e";
      c.beginPath();
      c.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      c.fill();
    }
    // One dot per berry, in fixed spots
    const spots = [
      [-20, -22],
      [10, -36],
      [22, -14],
      [-6, -12],
      [2, -26],
    ];
    for (let i = 0; i < this.berries; i++) {
      const [dx, dy] = spots[i];
      c.fillStyle = "#6a1b9a";
      c.beginPath();
      c.arc(x + dx, y + dy, 5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.5)";
      c.beginPath();
      c.arc(x + dx - 1.5, y + dy - 1.5, 1.6, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  draw(c) {
    this.drawOffScreen(c);
  }
}

// ---- Wild fluffies ----

function isParkWild(f) {
  return f.scene === PARK_SCENE && f.isAlive && !f.adopted;
}

function countParkWild() {
  let n = 0;
  for (const f of fluffies) if (isParkWild(f)) n++;
  return n;
}

// A spot just inside the hedge, off screen if you're in the park
function _parkEdgeSpot() {
  let p = null;
  for (let i = 0; i < 12; i++) {
    const side = Math.floor(Math.random() * 4);
    const along = Math.random();
    const pad = 90;
    if (side === 0) p = { x: pad + along * (PARK_W - pad * 2), y: PARK_TOP + pad };
    else if (side === 1) p = { x: pad + along * (PARK_W - pad * 2), y: PARK_H - pad };
    else if (side === 2) p = { x: pad, y: PARK_TOP + pad + along * (PARK_H - PARK_TOP - pad * 2) };
    else p = { x: PARK_W - pad, y: PARK_TOP + pad + along * (PARK_H - PARK_TOP - pad * 2) };
    if (currentScene !== PARK_SCENE || !isOnParkScreen(p.x, p.y, 100)) break;
  }
  return p;
}

function _wildPersonality() {
  const r = Math.random();
  if (r < 0.7) return ["true_feral"];
  if (r < 0.9) return ["lost_from_herd"];
  return ["runaway"];
}

function _makeWild(growth, at, opts = {}) {
  const bq = opts.bq ?? randomFeralQuality();
  const mq = opts.mq ?? randomFeralQuality();
  const h = new Horse(growth, opts.motherId ?? null, PARK_SCENE, "earthy", opts.genes ?? null, bq, mq, opts.gender ?? null);
  h.x = Math.max(60, Math.min(PARK_W - 60, at.x + (Math.random() - 0.5) * 90));
  h.y = Math.max(PARK_TOP + 60, Math.min(PARK_H - 60, at.y + (Math.random() - 0.5) * 90));
  h.personalities = [...h.personalities, ...(opts.personalities || [])];
  h.hunger = 0.7 + Math.random() * 0.3;
  fluffies.push(h);
  return h;
}

// Spawn one group at the edge of the park. Returns the new fluffies.
// kind: "family" | "single_mom" | "friends" | "loner" (random if not given)
function spawnParkGroup(kind = null, at = null) {
  if (!kind) {
    const r = Math.random();
    kind = r < 0.5 ? "family" : r < 0.72 ? "single_mom" : r < 0.9 ? "friends" : "loner";
  }
  at = at || _parkEdgeSpot();
  const group = [];

  if (kind === "family" || kind === "single_mom") {
    const mum = _makeWild(1, at, { gender: "female", personalities: _wildPersonality() });
    group.push(mum);
    let dad = null;
    if (kind === "family") {
      dad = _makeWild(1, at, { gender: "male", personalities: _wildPersonality() });
      group.push(dad);
      if (!isSexuallyAttractedTo(mum, dad)) mum.sexuality = "heterosexual";
      if (!isSexuallyAttractedTo(dad, mum)) dad.sexuality = "heterosexual";
      setRelationship(mum.id, dad.id, "special_friend");
      setRelationship(dad.id, mum.id, "special_friend");
    }
    const dadGenes = dad ? dad.genes : mum.generateRandomGenes(randomFeralQuality(), randomFeralQuality());
    const kids = 1 + Math.floor(Math.random() * (kind === "family" ? 4 : 3));
    for (let i = 0; i < kids; i++) {
      // Foals old enough to walk (the park is no place for newborns)
      const growth = 0.2 + Math.random() * 0.7;
      const kid = _makeWild(growth, at, { motherId: mum.id, genes: mum.combineGenes(dadGenes) });
      if (dad) {
        kid.fatherId = dad.id;
        setRelationship(kid.id, dad.id, "father");
        setRelationship(dad.id, kid.id, growth < 1 ? "baby_child" : "child");
      }
      group.push(kid);
    }
  } else if (kind === "friends") {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) group.push(_makeWild(1, at, { personalities: _wildPersonality() }));
    for (const a of group)
      for (const b of group) {
        if (a === b) continue;
        ensureOpinions(a);
        a.opinions[b.id] = 0.55;
        a.opinionWhy[b.id] = "travelled together";
      }
  } else {
    group.push(_makeWild(1, at, { personalities: _wildPersonality() }));
  }
  return group;
}

// Take one wild fluffy away (it wandered off). Never ones you're carrying,
// caged or adopted.
function _parkWanderOff() {
  // Never one you can see on screen
  const pool = fluffies.filter(
    (f) =>
      isParkWild(f) &&
      !f.isDragging &&
      !f.currentCage &&
      f.growth >= 1 &&
      (currentScene !== PARK_SCENE || !isOnParkScreen(f.x, f.y, 150)),
  );
  if (!pool.length) return null;
  // Loners first, then anyone
  const loners = pool.filter((f) => typeof herdOf !== "function" || !herdOf(f));
  const from = loners.length ? loners : pool;
  const f = from[Math.floor(Math.random() * from.length)];
  if (typeof noteFluffyLeft === "function") noteFluffyLeft(f, "wandered off");
  fluffies.splice(fluffies.indexOf(f), 1);
  return f;
}

// ---- Setup and update ----

// Bushes and some meadow grass (new game, and old saves from before the park
// had food). populate: also let a few wild groups in (new game).
function setupParkLife(populate = false) {
  if (!objects.some((o) => o instanceof BerryBush && o.scene === PARK_SCENE)) {
    for (const s of PARK_BUSH_SPOTS) objects.push(new BerryBush(s.x, s.y, PARK_SCENE, 2 + Math.floor(Math.random() * 4)));
  }
  for (const m of PARK_MEADOWS) {
    const have = _meadowTufts(m).length;
    for (let i = have; i < MEADOW_MAX_TUFTS - 2; i++) {
      const p = _randomPointInMeadow(m);
      objects.push(new Grass(p.x, p.y, PARK_SCENE, 0.5 + Math.random() * 1.5));
    }
  }
  if (populate && parkLife.enabled) {
    for (let i = 0; i < 3; i++) spawnParkGroup(i === 0 ? "family" : null, {
      x: 300 + Math.random() * (PARK_W - 600),
      y: PARK_TOP + 300 + Math.random() * (PARK_H - PARK_TOP - 600),
    });
  }
  parkLife.spawnTimer = 20;
}

// script.js updateSimulation
function updateParkLife(dt) {
  // Meadows grow back
  parkLife.seedTimer -= dt;
  if (parkLife.seedTimer <= 0) {
    // New tufts come faster in spring and rain, slowly in winter (WorldTime.js)
    const season = typeof growthMultiplier === "function" ? growthMultiplier("grass") : 1;
    parkLife.seedTimer = MEADOW_SEED_EVERY / Math.max(0.1, season);
    for (const m of PARK_MEADOWS) {
      if (_meadowTufts(m).length >= MEADOW_MAX_TUFTS) continue;
      const p = _randomPointInMeadow(m);
      objects.push(new Grass(p.x, p.y, PARK_SCENE, 0.2));
    }
  }

  if (!parkLife.enabled) return;

  // New wild fluffies wander in
  parkLife.spawnTimer -= dt;
  if (parkLife.spawnTimer <= 0) {
    const n = countParkWild();
    // New groups arrive in the daytime (WorldTime.js)
    const night = typeof isNightTime === "function" && isNightTime();
    if (n < PARK_WILD_TARGET && !night) {
      const group = spawnParkGroup();
      if (typeof noteDayEvent === "function") noteDayEvent("wildArrived", { count: group.length }); // morning report
    }
    parkLife.spawnTimer = n < PARK_WILD_TARGET / 2 ? 25 + Math.random() * 20 : 60 + Math.random() * 60;
  }

  // Too crowded: someone wanders off (not while you're watching)
  parkLife.trimTimer -= dt;
  if (parkLife.trimTimer <= 0) {
    const n = countParkWild();
    // Way over: wander off faster
    parkLife.trimTimer = n > PARK_WILD_MAX + 5 ? 10 : 30 + Math.random() * 30;
    if (n > PARK_WILD_MAX) _parkWanderOff();
  }
}

// ---- Drawing ----

// Under everything else in the park (Park.js drawParkScenery)
function drawParkMeadows(c) {
  for (const m of PARK_MEADOWS) {
    if (!isOnParkScreen(m.x, m.y, m.rx + 50)) continue;
    c.fillStyle = "rgba(120, 200, 70, 0.28)";
    c.beginPath();
    c.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(150, 220, 90, 0.25)";
    c.beginPath();
    c.ellipse(m.x, m.y, m.rx * 0.75, m.ry * 0.75, 0, 0, Math.PI * 2);
    c.fill();
  }
}

// On the park map (Park.js drawParkHud)
function drawParkLifeOnMap(c, r) {
  const sx = r.w / PARK_W;
  const sy = r.h / PARK_H;
  c.fillStyle = "rgba(140, 210, 80, 0.45)";
  for (const m of PARK_MEADOWS) {
    c.beginPath();
    c.ellipse(r.x + m.x * sx, r.y + m.y * sy, m.rx * sx, m.ry * sy, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (typeof drawTerritoriesOnMap === "function") drawTerritoriesOnMap(c, r);
  for (const o of objects) {
    if (!(o instanceof BerryBush) || o.scene !== PARK_SCENE) continue;
    c.fillStyle = o.hasFood() ? "#b04fd6" : "#4a3a55";
    c.beginPath();
    c.arc(r.x + o.x * sx, r.y + o.y * sy, 2.5, 0, Math.PI * 2);
    c.fill();
  }
}
