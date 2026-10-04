// ---------------------------------------------------------------------------
// Glue traps: a cheap sticky board for the floor (Fluff Mart, Hardware,
// GLUE_TRAP_PRICE, into the shopping bag).
//
// Anything that walks onto one (GLUE_TRAP_REACH) is stuck fast - yours,
// strays, raiders, a foal that wandered off. Stuck (f.gluedTo, saved: the
// trap's id), it can't move: it panics (GLUE lines), loses happiness
// (GLUE_SAD a game hour), may wet itself (Scaredy.js), and goes hungry and
// thirsty where it is - left long enough, it starves there.
// Getting it off:
//   - pick it up: it tears free, leaving fluff and skin behind (GLUE_TEAR
//     health, a bleed, maybe a scar - and it remembers who did it)
//   - right-click the trap: a splash of cooking oil (GLUE_OIL_COST) frees it
//     gently
// Either way the trap is spent and thrown away. One fluffy per trap; a dead
// one stays stuck until its body is moved.
// ---------------------------------------------------------------------------

const GLUE_TRAP_PRICE = 15;
const GLUE_TRAP_REACH = 22; // px from its middle
const GLUE_SAD = 0.06; // happiness a game hour, stuck
const GLUE_TEAR = 15; // health torn off with it
const GLUE_OIL_COST = 3;
const GLUE_TALK_EVERY = 6; // seconds, at most

class GlueTrap {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.stuckId = null;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  onDrop() {
    return handleDropping(this);
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      this.y = Math.max(this.y, sceneTop(this.scene) + 10);
    }
  }

  stuck() {
    if (this.stuckId === null || this.stuckId === undefined || typeof fluffyById !== "function") return null;
    const f = fluffyById(this.stuckId);
    return f && f.gluedTo === this.id ? f : null;
  }

  getBottomY() {
    return this.y - 2; // (drawn under whoever's on it)
  }

  hitTest(px, py) {
    return px >= this.x - 30 && px <= this.x + 30 && py >= this.y - 14 && py <= this.y + 8;
  }

  serialize() {
    return { classType: "GlueTrap", id: this.id, x: this.x, y: this.y, scene: this.scene, stuckId: this.stuckId ?? null, currentCageId: this.currentCage ? this.currentCage.id : null };
  }

  deserialize(data) {
    this.stuckId = data.stuckId ?? null;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    drawGlueTrapShape(ctx, this.x, this.y, 1, !!this.stuck());
  }
}

function drawGlueTrapShape(c, x, y, s, used) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = "#d9cfa9";
  c.strokeStyle = "#9c8f62";
  c.lineWidth = 2;
  c.beginPath();
  c.rect(-30, -10, 60, 18);
  c.fill();
  c.stroke();
  // The glue
  c.fillStyle = used ? "rgba(200, 160, 60, 0.75)" : "rgba(240, 200, 80, 0.65)";
  c.fillRect(-25, -7, 50, 12);
  c.fillStyle = "rgba(255, 255, 255, 0.5)";
  c.fillRect(-20, -6, 14, 2);
  c.restore();
}

function isGluedDown(f) {
  return !!f && f.gluedTo !== null && f.gluedTo !== undefined;
}

function _glueTrapOf(f) {
  if (!isGluedDown(f) || typeof objects === "undefined") return null;
  return objects.find((o) => o instanceof GlueTrap && o.id === f.gluedTo) || null;
}

function _glueSpend(trap) {
  const i = objects.indexOf(trap);
  if (i > -1) objects.splice(i, 1);
}

function _glueRelease(f) {
  const trap = _glueTrapOf(f);
  f.gluedTo = null;
  if (trap) _glueSpend(trap);
}

// Memory.onFluffyPickedUp (and any body moved): torn off the trap
function tearOffGlueTrap(f) {
  if (!isGluedDown(f)) return false;
  _glueRelease(f);
  if (!f.isAlive) return true;
  f.health = Math.max(1, (f.health ?? 100) - GLUE_TEAR);
  f.bleedingTimer = Math.max(f.bleedingTimer || 0, 4);
  f.changeHappiness(-0.06, "Torn off a glue trap");
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 3;
  if (!f.tooYoungToSpeak()) f.speak(getDialogue(["GLUE", "TORN"], f), true);
  if (typeof notePlayerViolence === "function") notePlayerViolence(f, false, "glue", false, false);
  if (typeof addScar === "function" && Math.random() < 0.5) addScar(f, "bald", `torn off a glue trap on day ${getDayNumber()}`);
  return true;
}

// Right-click the trap: cooking oil
function oilGlueTrap(trap) {
  const f = trap && trap.stuck();
  if (!f) {
    if (typeof addUIMessage === "function") addUIMessage("Nothing's stuck on it. Anything that walks over it will be.");
    return false;
  }
  if (typeof money === "number" && money < GLUE_OIL_COST) {
    if (typeof addUIMessage === "function") addUIMessage(`You need $${GLUE_OIL_COST} for cooking oil.`);
    return false;
  }
  if (typeof money === "number") money -= GLUE_OIL_COST;
  _glueRelease(f);
  if (f.isAlive && !f.tooYoungToSpeak()) f.speak(getDialogue(["GLUE", "FREED"], f), true);
  if (typeof addUIMessage === "function") addUIMessage(`A splash of cooking oil frees ${fluffyDisplayName(f)} (-$${GLUE_OIL_COST}).`);
  return true;
}

function updateGlueTraps(dt) {
  if (typeof objects === "undefined" || typeof fluffies === "undefined") return;
  const traps = objects.filter((o) => o instanceof GlueTrap && !o.isDragging);
  if (!traps.length && !fluffies.some(isGluedDown)) return;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  // Caught
  for (const trap of traps) {
    if (trap.stuck()) continue;
    trap.stuckId = null;
    for (const f of fluffies) {
      if (!f.isAlive || f.scene !== trap.scene || f.isDragging || f.placedOn || isGluedDown(f) || f.currentCage !== trap.currentCage) continue;
      if (f.heldWithThrowTool || f.isFallingFromThrow || f._riding) continue;
      if (Math.abs(f.x - trap.x) > GLUE_TRAP_REACH || Math.abs(f.y - trap.y) > GLUE_TRAP_REACH) continue;
      f.gluedTo = trap.id;
      trap.stuckId = f.id;
      f.x = trap.x;
      f.y = trap.y;
      f.initBehavior("IDLE");
      if (typeof scaredyMess === "function") scaredyMess(f, 0.6);
      if (!f.tooYoungToSpeak()) f.speak(getDialogue(["GLUE", "CAUGHT"], f), true);
      else f.speak(getDialogue(["GLUE", "CHIRPY"], f), false, true);
      if (f.adopted && f.scene !== currentScene && typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(f)} is stuck on a glue trap!`);
      break;
    }
  }
  // Stuck
  for (const f of fluffies) {
    if (!isGluedDown(f)) continue;
    const trap = _glueTrapOf(f);
    if (!trap || trap.scene !== f.scene) {
      f.gluedTo = null;
      continue;
    }
    if (f.isDragging) {
      tearOffGlueTrap(f);
      continue;
    }
    f.x = trap.x;
    f.y = trap.y;
    if (f.targetX !== undefined) {
      f.targetX = null;
      f.targetY = null;
    }
    if (!f.isAlive) continue;
    if (f.isMovingOrRunning()) f.initBehavior("IDLE");
    f.changeHappiness(-(GLUE_SAD / HOUR_LENGTH) * dt, "Stuck on a glue trap");
    f.expressionOverride = "CRYING_SHOCKED";
    f.expressionOverrideTimer = Math.max(f.expressionOverrideTimer || 0, 0.5);
    if (!(f._glueTalkAt !== undefined && now - f._glueTalkAt >= 0 && now - f._glueTalkAt < GLUE_TALK_EVERY) && Math.random() < 0.3) {
      f._glueTalkAt = now;
      if (!f.tooYoungToSpeak()) f.speak(getDialogue(["GLUE", "STUCK"], f));
      else f.speak(getDialogue(["GLUE", "CHIRPY"], f), false, true);
    }
  }
}
registerSystem("glueTraps", updateGlueTraps, 57);

// Magnifying glass: [text, tone]
function describeGlued(f) {
  return isGluedDown(f) ? ["Stuck on a glue trap (pick it up to tear it free, or right-click the trap for oil)", "bad"] : null;
}

SPAWN_ACTIONS.push({
  name: "Glue trap",
  desc: "A sticky board for the floor. Whatever walks onto it - strays, raiders, your own - is stuck fast. Right-click it to free one with cooking oil.",
  cost: GLUE_TRAP_PRICE,
  isItem: "glue_trap",
});
