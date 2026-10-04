// ---------------------------------------------------------------------------
// The Fluff-Bot: a little robot vacuum that cleans the floor for you.
//
// Buy it at Fluff Mart (Home & Play, ROOMBA_PRICE, delivered). Put it in a
// room and it looks after that room:
//   - drives to the nearest mess (poop, pee, sick, blood, spilled water or
//     tears - any puddle) and cleans it up (ROOMBA_CLEAN a second)
//   - when the floor's clean, goes back to its dock (where you last put it
//     down) and waits
//   - it works whether or not you're looking at that room
//   - empties litterboxes in its room once they're a quarter full
//     (FLUFFBOT_LITTER_AT; not a Litterpal with a fluffy strapped in)
// Right-click it to switch it on or off. You can pick it up and move it to
// another room; wherever you drop it becomes its new dock.
//
// Fluffies notice it: when it bumps into one, timid fluffies get a fright
// ("Scawy munstah!"), brave or playful ones think it's fun. It's not a
// substitute for bath time (Bath.js) - it only does floors.
//
// Saved (serialize): on/off, its dock.
// ---------------------------------------------------------------------------

const ROOMBA_PRICE = 250;
const ROOMBA_SPEED = 70; // px a second
const ROOMBA_CLEAN = 0.35; // puddle size cleaned a second
const ROOMBA_BUMP_EVERY = 6; // seconds before the same fluffy reacts again
const FLUFFBOT_LITTER_AT = 0.25; // of a litterbox's uses: time to empty it

class Roomba {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.on = true;
    this.homeX = null;
    this.homeY = null;
    this.state = "docked"; // docked | cleaning | homing
    this.facing = 1;
    this.spin = 0;
    this.pause = 0;
    this._bumped = {};
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
  }

  onDrop() {
    const r = handleDropping(this);
    this.currentCage = null; // it roams; cages don't hold it
    // Wherever you put it is its dock now
    this.homeX = this.x;
    this.homeY = this.y;
    this.state = "docked";
    return r;
  }

  getBottomY() {
    return this.y;
  }

  hitTest(px, py) {
    return px >= this.x - 34 && px <= this.x + 34 && py >= this.y - 26 && py <= this.y + 4;
  }

  // Where it can drive to (it can clean a little beyond, ROOMBA_REACH)
  _bounds() {
    return {
      left: 35,
      right: (typeof sceneW === "function" ? sceneW(this.scene) : width) - 35,
      top: (typeof sceneTop === "function" ? sceneTop(this.scene) : 120) + 25,
      bottom: (typeof sceneH === "function" ? sceneH(this.scene) : height) - 10,
    };
  }

  // The nearest bit of mess in its room that it can reach (not sprinkler
  // water, and not spots it has already given up on)
  _nearestMess() {
    if (typeof puddles === "undefined") return null;
    const B = this._bounds();
    const now = typeof timePlayed === "number" ? timePlayed : 0;
    let best = null;
    let bestD = Infinity;
    for (const p of puddles) {
      if (p.scene !== this.scene || p.color === "rgba(100, 150, 255, 0.3)") continue;
      for (const pt of p.points) {
        if (pt.x < B.left - 28 || pt.x > B.right + 28 || pt.y < B.top - 18 || pt.y > B.bottom + 18) continue;
        if (pt._botSkipUntil && pt._botSkipUntil > now) continue;
        const d = (pt.x - this.x) ** 2 + (pt.y - this.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = pt;
        }
      }
    }
    return best;
  }

  _nearestSpill() {
    if (typeof FoodSpill === "undefined" || typeof objects === "undefined") return null;
    let best = null;
    let bd = Infinity;
    for (const o of objects) {
      if (!(o instanceof FoodSpill) || o.scene !== this.scene || o.food <= 0) continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  // A litterbox (or Litterpal) in its room that wants emptying
  _litterToEmpty() {
    if (typeof objects === "undefined") return null;
    let best = null;
    let bd = Infinity;
    for (const o of objects) {
      if (!((typeof Litterbox !== "undefined" && o instanceof Litterbox) || (typeof LitterpalBox !== "undefined" && o instanceof LitterpalBox))) continue;
      if (o.scene !== this.scene || o.isDragging || o.securedFluffy) continue;
      const max = o.maxUses || 30;
      if ((o.uses || 0) < Math.max(1, Math.ceil(max * FLUFFBOT_LITTER_AT))) continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  _driveTo(tx, ty, dt) {
    const B = this._bounds();
    tx = Math.max(B.left, Math.min(B.right, tx));
    ty = Math.max(B.top, Math.min(B.bottom, ty));
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) return true;
    const step = Math.min(d, ROOMBA_SPEED * dt);
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    if (Math.abs(dx) > 1) this.facing = dx > 0 ? 1 : -1;
    this.spin += dt * 12;
    return false;
  }

  _cleanAround(dt) {
    if (typeof puddles === "undefined") return false;
    let cleaned = false;
    for (const p of puddles) {
      if (p.scene !== this.scene) continue;
      for (let i = p.points.length - 1; i >= 0; i--) {
        const pt = p.points[i];
        if (Math.abs(pt.x - this.x) > 30 || Math.abs(pt.y - this.y) > 20) continue;
        p.shrinkPoint(i, ROOMBA_CLEAN * dt, 0.0201);
        cleaned = true;
      }
    }
    return cleaned;
  }

  _bumpFluffies() {
    const now = typeof timePlayed === "number" ? timePlayed : 0;
    for (const f of fluffies) {
      if (!f.isAlive || f.scene !== this.scene || f.isDragging || f.currentStateKey === "SLEEPING") continue;
      if (Math.abs(f.x - this.x) > 45 || Math.abs(f.y - this.y) > 30) continue;
      if (this._bumped[f.id] !== undefined && now - this._bumped[f.id] < ROOMBA_BUMP_EVERY) continue;
      this._bumped[f.id] = now;
      this.pause = 0.6;
      reactToRoomba(f, this);
    }
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      this.y = Math.max(this.y, sceneTop(this.scene) + 10);
      return;
    }
    if (this.homeX === null) {
      this.homeX = this.x;
      this.homeY = this.y;
    }
    if (!this.on) return;
    if (this.pause > 0) {
      this.pause -= dt;
      return;
    }
    const mess = this._nearestMess();
    if (mess) {
      this.state = "cleaning";
      const there = this._driveTo(mess.x, mess.y, dt);
      const cleaned = this._cleanAround(dt);
      // Parked on it but can't get at it (under something, in a corner): skip it for a minute
      this._stuckFor = there && !cleaned ? (this._stuckFor || 0) + dt : 0;
      if (this._stuckFor > 2) {
        mess._botSkipUntil = (typeof timePlayed === "number" ? timePlayed : 0) + 60;
        this._stuckFor = 0;
      }
      if (this.scene === currentScene) this._bumpFluffies();
    } else if (this._nearestSpill()) {
      // Food spilled on the floor (FeedBot.js): hoover it up
      const sp = this._nearestSpill();
      this.state = "cleaning";
      if (this._driveTo(sp.x, sp.y, dt) || Math.hypot(sp.x - this.x, sp.y - this.y) < 30) {
        sp._botEaten = (sp._botEaten || 0) + 3 * dt;
        if (sp._botEaten >= 1) {
          sp._botEaten -= 1;
          sp.food = Math.max(0, sp.food - 1);
        }
      }
      if (this.scene === currentScene) this._bumpFluffies();
    } else if (this._litterToEmpty()) {
      // A litterbox getting full: scoop it out
      const box = this._litterToEmpty();
      this.state = "cleaning";
      if (this._driveTo(box.x, box.y, dt) || Math.hypot(box.x - this.x, box.y - this.y) < 40) box.uses = 0;
      if (this.scene === currentScene) this._bumpFluffies();
    } else if (this.state !== "docked") {
      this.state = "homing";
      if (this._driveTo(this.homeX, this.homeY, dt)) this.state = "docked";
    }
  }

  serialize() {
    return {
      classType: "Roomba",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      on: this.on,
      homeX: this.homeX,
      homeY: this.homeY,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.on = data.on !== false;
    this.homeX = typeof data.homeX === "number" ? data.homeX : data.x;
    this.homeY = typeof data.homeY === "number" ? data.homeY : data.y;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    drawRoombaShape(ctx, this.x, this.y, 1, this.on, this.state, this.spin, this.facing);
  }
}

// (x, y) is the middle of its bottom
function drawRoombaShape(c, x, y, k = 1, on = true, state = "docked", spin = 0, facing = 1) {
  c.save();
  c.translate(x, y);
  c.scale(k * facing, k);
  // Shadow
  c.fillStyle = "rgba(0,0,0,0.18)";
  c.beginPath();
  c.ellipse(0, 1, 34, 7, 0, 0, Math.PI * 2);
  c.fill();
  // Side and top
  c.fillStyle = "#3b3f47";
  c.beginPath();
  c.ellipse(0, -8, 32, 9, 0, 0, Math.PI);
  c.rect(-32, -16, 64, 8);
  c.fill();
  c.fillStyle = "#5a606b";
  c.beginPath();
  c.ellipse(0, -16, 32, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#2a2d33";
  c.lineWidth = 1.5;
  c.stroke();
  // Button / sensor
  c.fillStyle = "#8b93a1";
  c.beginPath();
  c.ellipse(0, -17, 11, 3.5, 0, 0, Math.PI * 2);
  c.fill();
  // Light: green working, blue docked, red off
  c.fillStyle = !on ? "#d64545" : state === "cleaning" ? "#4be07a" : "#5ab4ff";
  c.beginPath();
  c.arc(18, -17, 2.5, 0, Math.PI * 2);
  c.fill();
  // Spinning brush at the front
  if (on && state !== "docked") {
    c.strokeStyle = "rgba(230,230,230,0.8)";
    c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * Math.PI * 2) / 3;
      c.beginPath();
      c.moveTo(28, -3);
      c.lineTo(28 + Math.cos(a) * 7, -3 + Math.sin(a) * 2.5);
      c.stroke();
    }
  }
  c.restore();
}

// A fluffy the Fluff-Bot bumped into
function reactToRoomba(f, bot) {
  const brave = typeof traitValue === "function" ? traitValue(f, "bravery") : 0;
  const playful = typeof traitValue === "function" ? traitValue(f, "energy") : 0;
  const talk = !f.tooYoungToSpeak();
  // Scared of the Fluff-Bot (Fears.js): always a fright
  if (typeof onRoombaBump === "function" && onRoombaBump(f)) return "frightened";
  if (brave + playful > 0.3 || (f.growth < 1 && Math.random() < 0.5)) {
    f.expressionOverride = "GOOD_UPSIES";
    f.expressionOverrideTimer = 1.5;
    f.changeHappiness(0.01);
    if (talk) f.speak(getDialogue(["ROOMBA", "FUN"], f));
    return "fun";
  }
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 1.5;
  f.changeHappiness(-0.01);
  if (talk) f.speak(getDialogue(["ROOMBA", "SCARED"], f));
  // Scoot out of the way
  if (!f.isDragging && !f.placedOn && !f.currentCage && !f.tooYoungToWalk() && (typeof canRun !== "function" || canRun(f)) && f.canSee && f.canSee()) {
    // A spot a little away that it can actually get to (inside the room, not past a fence)
    let tx = Math.max(60, Math.min(sceneW(f.scene) - 60, f.x + (f.x >= bot.x ? 120 : -120)));
    let ty = Math.max(sceneTop(f.scene) + 50, Math.min(sceneH(f.scene) - 30, f.y + (Math.random() - 0.5) * 60));
    if (typeof canFluffyReach === "function" && !canFluffyReach(f, tx, ty)) {
      const p = typeof nearestReachablePoint === "function" ? nearestReachablePoint(f, tx, ty) : null;
      if (!p) return "scared";
      tx = p.x;
      ty = p.y;
    }
    f.initBehavior("MOVING");
    f.setTargetPosition(tx, ty);
  }
  return "scared";
}

SPAWN_ACTIONS.push({
  name: "Fluff-Bot",
  desc: "A little robot vacuum. It cleans up any mess in its room by itself and empties the litterboxes, then goes back to where you put it. Right-click to switch it off.",
  cost: ROOMBA_PRICE,
  isItem: "roomba",
});
