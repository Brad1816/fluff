// ---------------------------------------------------------------------------
// Wing practice, the gentle way: the perch (Fluff Mart, Home & Play, $90).
//
// A pegasus or alicorn with both wings (Flight.js canFly) that's awake, well
// and not busy, near a perch in its room, now and then goes over to it and
// practises: PERCH_HOPS little flutter-hops, flapping hard (it can't really
// fly - a hop is all it manages), each making its wings a little stronger
// (PERCH_LEARN; being thrown builds them faster, FLIGHT_LEARN, but hurts).
// Stronger wings break its falls better (Flight.js). It's fun - less bored,
// a little happier - and nothing to be scared of. Then it rests a while
// (PERCH_REST) before it goes again.
// The perch is drawn here (drawPerchShape).
// ---------------------------------------------------------------------------

const PERCH_PRICE = 90;
const PERCH_NEAR = 450; // px: a perch this close in its room is worth going to
const PERCH_REACH = 50; // px: close enough to hop
const PERCH_LEARN = 0.01; // wing strength a hop
const PERCH_HOPS = 4;
const PERCH_REST = 3; // game hours between goes
const PERCH_CHANCE = 0.25; // a game hour, of going over (each fluffy)
const PERCH_GIVE_UP = 40; // game seconds to get there
const perchTicker = new Ticker(2);

class Perch {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = Math.max(mouse.y + this.dragOffset.y, sceneTop(this.scene) + 10);
    }
    if (typeof handleGenericCageContainment === "function") handleGenericCageContainment(this, 60, 100);
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
    return px >= this.x - 34 && px <= this.x + 34 && py >= this.y - 100 && py <= this.y + 4;
  }

  serialize() {
    return { classType: "Perch", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: this.currentCage ? this.currentCage.id : null };
  }

  deserialize() {}

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    drawPerchShape(ctx, this.x, this.y, 1);
  }
}

// A wooden stand with a crossbar; (x, y) is the middle of its foot
function drawPerchShape(c, x, y, k = 1) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.lineJoin = "round";
  c.strokeStyle = "#4b2f18";
  c.lineWidth = 2;
  // Foot
  c.fillStyle = "#8a5a32";
  c.beginPath();
  c.ellipse(0, -4, 30, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Post
  c.fillStyle = "#a8743f";
  c.fillRect(-4, -92, 8, 88);
  c.strokeRect(-4, -92, 8, 88);
  // Crossbar, with a soft wrap
  c.fillStyle = "#a8743f";
  c.fillRect(-30, -98, 60, 9);
  c.strokeRect(-30, -98, 60, 9);
  c.fillStyle = "#f2a7c8";
  c.fillRect(-12, -99, 24, 11);
  c.strokeRect(-12, -99, 24, 11);
  // A little feather
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.ellipse(20, -82, 4, 9, 0.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

// ---- Practising ----

function _canPractise(f) {
  if (!canFly(f) || !(f.growth >= 0.5) || (f.flightSkill || 0) >= 1) return false;
  if (f.currentStateKey === "SLEEPING" || f.isDragging || f.currentCage || f.placedOn || f._riding) return false;
  if (f.isFallingFromThrow || f.health < 50 || f.isPregnant) return false;
  if (typeof isFrightened === "function" && isFrightened(f)) return false;
  if (f.trickNow || f.timeOut || f._fostering || f._bolt) return false;
  return true;
}

function _perchById(id) {
  return typeof objects !== "undefined" ? objects.find((o) => o instanceof Perch && o.id === id) : null;
}

// One little hop up off the floor, flapping hard (lands lightly, Flight.js _flight)
function perchHop(f, perch) {
  const g = typeof flightGravity === "function" ? flightGravity(f, 1500) : 1500;
  const up = 30 + 25 * (f.flightSkill || 0); // (a hop and a flutter: it can't really fly)
  f.throwStartY = f.y;
  f.throwFallVy = -Math.sqrt(2 * g * up);
  f.throwFallVx = perch ? Math.sign(perch.x - f.x) * 20 : 0;
  f._flight = { x0: f.x, x1: f.x, b0: f.getBottomYStanding(), b1: f.getBottomYStanding() };
  f.throwShadowY = f._flight.b0;
  f.isFallingFromThrow = true;
  if (perch) f.facingRight = perch.x > f.x;
  f.expressionOverride = "GOOD_UPSIES";
  f.expressionOverrideTimer = 1.2;
}

function _perchLearn(f) {
  if (typeof learnFlight === "function") learnFlight(f, PERCH_LEARN);
  if (typeof f.changeHappiness === "function") f.changeHappiness(0.01);
  if (typeof f.boredom === "number") f.boredom = Math.max(0, f.boredom - 0.05);
}

// Magnifying glass: practising now?
function isPractisingFlight(f) {
  return !!(f && f._perch);
}

function updatePerches(dt) {
  if (typeof fluffies === "undefined" || typeof objects === "undefined") return;
  const now = timePlayed;
  // On their way, or hopping
  for (const f of fluffies) {
    const p = f._perch;
    if (!p) continue;
    const perch = _perchById(p.id);
    if (!perch || perch.scene !== f.scene || perch.isDragging || !f.isAlive || (!f.isFallingFromThrow && !_canPractise(f)) || now - p.at > PERCH_GIVE_UP + PERCH_HOPS * 4) {
      f._perch = null;
      continue;
    }
    if (f.isFallingFromThrow) continue; // (mid-hop)
    const dx = perch.x - 40 * Math.sign(perch.x - f.x || 1) - f.x;
    if (Math.abs(perch.x - f.x) > PERCH_REACH + 20 || Math.abs(perch.y - f.y) > 60) {
      if (!f.isMovingOrRunning()) f.initBehavior("MOVING");
      f.setTargetPosition(f.x + dx, perch.y);
      continue;
    }
    // At the perch: a hop, a pause, another
    if (p.wait > 0) {
      p.wait -= dt;
      continue;
    }
    if (p.hops <= 0) {
      f._perch = null;
      f._perchRest = now + PERCH_REST * HOUR_LENGTH;
      if (f.isAlive && f.currentStateKey !== "IDLE") f.initBehavior("IDLE");
      continue;
    }
    if (f.isMovingOrRunning()) f.initBehavior("IDLE");
    perchHop(f, perch);
    _perchLearn(f);
    p.hops--;
    p.wait = 0.8 + Math.random() * 0.8;
    if (p.hops === PERCH_HOPS - 1 && !f.tooYoungToSpeak() && Math.random() < 0.5 && (!f.speech || !f.speech.text) && typeof getDialogue === "function") f.speak(getDialogue(["FLIGHT", "PRACTICE"], f));
  }
  const step = perchTicker.step(dt);
  if (!step) return;
  // Who goes to practise?
  const perches = objects.filter((o) => o instanceof Perch && !o.isDragging);
  if (perches.length) {
    const chance = 1 - Math.pow(1 - PERCH_CHANCE, step / HOUR_LENGTH);
    for (const f of fluffies) {
      if (f._perch || !f.isAlive || !_canPractise(f)) continue;
      if (typeof f._perchRest === "number" && now < f._perchRest) continue;
      const near = perches.filter((o) => o.scene === f.scene && Math.hypot(o.x - f.x, o.y - f.y) < PERCH_NEAR);
      if (!near.length || Math.random() > chance) continue;
      if (typeof sceneHasFences === "function" && sceneHasFences(f.scene) && typeof canFluffyReach === "function" && !canFluffyReach(f, near[0].x, near[0].y)) continue;
      f._perch = { id: near[0].id, at: now, hops: PERCH_HOPS, wait: 0 };
    }
  }
}
registerSystem("perches", updatePerches, 69);

// ---- In the shop and the save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({
    name: "Wing perch",
    desc: "A perch for pegasi and alicorns to practise flapping on. They go over by themselves now and then to hop and flutter: their wings get stronger, so falls hurt them less. Slower than throwing them, but fun and nothing to be afraid of.",
    cost: PERCH_PRICE,
    isItem: "perch",
  });
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push({
    sellType: "perch",
    is: (o) => o instanceof Perch,
    hitTest: (o, x, y) => o.hitTest(x, y),
    sellable: true,
    create: (a, sx, sy) => atSpot(new Perch(currentScene), sx, sy),
    drawIcon: (ctx, btnSize) => drawPerchShape(ctx, 0, 22, 0.4),
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.Perch = (d) => new Perch(d.scene);
