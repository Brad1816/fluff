// ---------------------------------------------------------------------------
// Strays move between the outdoor areas.
//
// Every MIGRATE_EVERY game seconds each outdoor area (MIGRATE_LINKS: the
// garden, the river, the alley, the road and Shelter Alley; the park only
// takes them in - it looks after its own) looks at its strays. One may set
// off for a neighbouring area if:
//   - it's hungry and there's next to no food here, and more next door
//     (grass, or a bowl someone left out)
//   - the area's crowded (more than MIGRATE_CAP)
//   - it's being driven out: it can't stand two or more of the others, or
//     it's just been beaten up
// It walks to that side's edge (you can watch it go: slowly) and turns up
// at the other side of the next area, where it may well not be welcome
// (Bonds/Herds/Territory take it from there). A herd goes together when
// its leader goes; a mum takes her foals still on milk.
// Never into the house, the backyard, the shelter or the shops, and never
// one of yours (put one out and it's a stray, though: Strays.js).
// Not saved (a walk in progress is forgotten on load).
// ---------------------------------------------------------------------------

const MIGRATE_EVERY = HOUR_LENGTH / 2;
const MIGRATE_CHANCE = 0.35; // a stray with a reason, per look
const MIGRATE_WALK_MAX = 90; // game seconds to reach the edge before it just goes
const MIGRATE_HUNGRY = 0.35;
const MIGRATE_CAP = { OUTDOORS: 12, RIVER: 14, ALLEY: 8, ALLEY_ROAD: 4, ALLEY_DAY_CARE: 8 };
// area -> { neighbour: which edge of this area it's through }
const MIGRATE_LINKS = {
  OUTDOORS: { RIVER: "left", ALLEY: "right" },
  RIVER: { OUTDOORS: "right" },
  ALLEY: { OUTDOORS: "left", ALLEY_ROAD: "down", ALLEY_DAY_CARE: "right" },
  ALLEY_ROAD: { ALLEY: "up" },
  ALLEY_DAY_CARE: { ALLEY: "left", PARK: "right" },
};
const _MIG_OPPOSITE = { left: "right", right: "left", up: "down", down: "up" };

const migrateTicker = new Ticker(1);
let _migrateClock = 0;

function _migNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}

function canMigrate(f) {
  if (!f || !f.isAlive || f.adopted || f.isDragging || f.currentCage || f.placedOn || f.raiding) return false;
  if (f.currentStateKey === "SLEEPING" || f.tooYoungToWalk()) return false;
  return !!MIGRATE_LINKS[f.scene];
}

// Food lying about: tufts of grass worth eating, bowls with food
function foodIn(scene) {
  if (typeof objects === "undefined") return 0;
  let n = 0;
  for (const o of objects) {
    if (o.scene !== scene) continue;
    if (typeof Grass !== "undefined" && o instanceof Grass && o.growth >= 0.5) n += o.growth / 2;
    else if (typeof Bowl !== "undefined" && o instanceof Bowl && o.hasFood && o.hasFood()) n += 2;
  }
  return n;
}

function _strays(scene) {
  return fluffies.filter((f) => f.isAlive && !f.adopted && f.scene === scene);
}

// Why it would leave, or null
function migrateReason(f, here = _strays(f.scene)) {
  if (!canMigrate(f)) return null;
  if (f.hunger < MIGRATE_HUNGRY && foodIn(f.scene) < 1) return "hungry";
  if (here.length > (MIGRATE_CAP[f.scene] || 99)) return "crowded";
  if (f.lastAttackTimer > 0) return "driven";
  if (typeof getLiking === "function") {
    let hate = 0;
    for (const o of here) if (o !== f && getLiking(f, o) <= -0.4) hate++;
    if (hate >= 2) return "driven";
  }
  return null;
}

// The best neighbour to go to
function migrateDestination(f, why) {
  const links = MIGRATE_LINKS[f.scene];
  if (!links) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const to of Object.keys(links)) {
    const crowd = to === "PARK" ? 0.3 : _strays(to).length / (MIGRATE_CAP[to] || 10);
    const food = to === "PARK" ? 4 : foodIn(to);
    let s = -crowd + (why === "hungry" ? food * 0.4 : food * 0.05) + Math.random() * 0.3;
    if (to === "ALLEY_ROAD") s -= 0.5; // (cars)
    if (s > bestScore) {
      bestScore = s;
      best = to;
    }
  }
  return best;
}

// Who goes with it: its herd (if it leads it) and its foals still on milk
function migrateGroup(f) {
  const group = [f];
  const h = typeof herdOf === "function" ? herdOf(f) : null;
  if (h && h.leaderId === f.id && typeof getHerdMembers === "function") {
    for (const m of getHerdMembers(h)) if (m !== f && m.scene === f.scene && !m.adopted && !m.currentCage && !m.placedOn && !m.isDragging) group.push(m);
  }
  const rels = typeof relationships !== "undefined" ? relationships[f.id] || {} : {};
  for (const [id, rel] of Object.entries(rels)) {
    if (rel !== "baby_child") continue;
    const k = fluffies.find((x) => String(x.id) === id);
    if (k && k.isAlive && !k.adopted && k.scene === f.scene && !group.includes(k) && !k.currentCage && !k.isDragging) group.push(k);
  }
  return group;
}

function _edgeSpot(scene, side) {
  const top = typeof sceneTop === "function" ? sceneTop(scene) : height * 0.15;
  if (side === "left") return { x: 30, y: top + 120 + Math.random() * (height - top - 220) };
  if (side === "right") return { x: width - 30, y: top + 120 + Math.random() * (height - top - 220) };
  if (side === "down") return { x: width * 0.35 + Math.random() * width * 0.3, y: height - 45 };
  return { x: width * 0.35 + Math.random() * width * 0.3, y: top + 50 };
}

// Set off. Returns how many go.
function startMigration(f, to, why) {
  const side = MIGRATE_LINKS[f.scene] && MIGRATE_LINKS[f.scene][to];
  if (!side) return 0;
  const group = migrateGroup(f);
  const now = _migNow();
  for (const g of group) {
    const spot = _edgeSpot(g.scene, side);
    g._migrate = { to, side, x: spot.x, y: spot.y, at: now };
    if (typeof g.initBehavior === "function" && !g.tooYoungToWalk()) {
      g.initBehavior("MOVING");
      g.setTargetPosition(spot.x, spot.y);
    }
  }
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["MIGRATE", why.toUpperCase()], f));
  return group.length;
}

// It's there: into the next area, at the far side
function arriveMigration(f) {
  const m = f._migrate;
  f._migrate = null;
  if (!m || !f.isAlive || f.adopted) return false;
  f.scene = m.to;
  if (m.to === "PARK" || (typeof isCameraScene === "function" && isCameraScene(m.to))) {
    const p = typeof _parkEdgeSpot === "function" ? _parkEdgeSpot() : { x: 300, y: 600 };
    f.x = p.x;
    f.y = p.y;
  } else {
    const spot = _edgeSpot(m.to, _MIG_OPPOSITE[m.side]);
    f.x = spot.x;
    f.y = spot.y;
  }
  f.vx = 0;
  f.vy = 0;
  if (typeof f.initBehavior === "function") {
    f.initBehavior("MOVING");
    f.setTargetPosition(Math.max(120, Math.min(width - 120, f.x + (m.side === "left" ? -180 : m.side === "right" ? 180 : 0))), f.y + (m.side === "down" ? 0 : 0));
  }
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function" && Math.random() < 0.5) f.speak(getDialogue(["MIGRATE", "ARRIVE"], f));
  return true;
}

function updateMigration(dt) {
  const step = migrateTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const now = _migNow();
  // On their way: keep heading for the edge; through it when there
  for (const f of fluffies) {
    const m = f._migrate;
    if (!m) continue;
    if (!f.isAlive || f.adopted || f.isDragging || f.currentCage || f.placedOn || !MIGRATE_LINKS[f.scene]) {
      f._migrate = null;
      continue;
    }
    const near = Math.hypot(f.x - m.x, f.y - m.y) < 45;
    if (near || now - m.at > MIGRATE_WALK_MAX || f.tooYoungToWalk()) {
      // (a foal goes when its mum does)
      if (f.tooYoungToWalk() && f.motherId !== null) {
        const mum = fluffies.find((x) => x.id === f.motherId);
        if (mum && mum._migrate && mum.scene === f.scene) continue;
      }
      arriveMigration(f);
    } else if (f.currentStateKey !== "SLEEPING") {
      if (!f.isMovingOrRunning()) f.initBehavior("MOVING");
      f.setTargetPosition(m.x, m.y);
    }
  }
  // Every so often: who sets off?
  _migrateClock += step;
  if (_migrateClock < MIGRATE_EVERY) return;
  _migrateClock = 0;
  for (const scene of Object.keys(MIGRATE_LINKS)) {
    const here = _strays(scene);
    let crowdLeft = Math.max(0, here.length - (MIGRATE_CAP[scene] || 99));
    for (const f of here.slice().sort(() => Math.random() - 0.5)) {
      if (f._migrate) continue;
      const why = migrateReason(f, here);
      if (!why) continue;
      if (why === "crowded") {
        if (crowdLeft <= 0) continue;
      } else if (Math.random() > MIGRATE_CHANCE) continue;
      const to = migrateDestination(f, why);
      if (!to) continue;
      const n = startMigration(f, to, why);
      if (why === "crowded") crowdLeft -= n;
    }
  }
}
registerSystem("migration", updateMigration, 135);
