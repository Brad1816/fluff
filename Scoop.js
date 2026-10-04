// ---------------------------------------------------------------------------
// The scoop (playtest 6): pick up several fluffies at once - a new litter
// out of a cage, say. Everyone has one in the toolbox, after the throw tool
// (a save without one gets one: ensureThrowToolPrepended, globals.js).
//
// Hold it and drag a box round the fluffies (press, drag, let go - a finger
// works the same). Up to SCOOP_MAX of them in the box are lifted together
// and carried with the pointer, to any room. Click (tap) and they're all set
// down there - over a cage, they all go in it. A tap without dragging
// scoops just the one under the pointer.
//
// Putting the scoop away (Esc, its toolbox button) sets them down where you
// are. Ones of yours can't be set down outside in a bunch (one at a time:
// Strays.js asks first).
//
// Hooks: attemptDrop (script.js) calls scoopClick first; the window's
// mouseup (globals.js) calls scoopMouseUp. The carried fluffies are simply
// held (f.isDragging) with offsets round the pointer, so they move rooms with
// you like anything you carry (changeScene).
// ---------------------------------------------------------------------------

const SCOOP_MAX = 12;
const SCOOP_MIN_BOX = 12; // px: smaller than this is a tap

let scoopBox = null; // { x0, y0, scene } while dragging out a box
let scoopCarry = []; // fluffy ids in the scoop

function makeScoopImage() {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 46;
  cv.height = 40;
  const c = cv.getContext("2d");
  if (!c) return null;
  // The handle
  c.strokeStyle = "#7a5a32";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(8, 18);
  c.quadraticCurveTo(23, -4, 38, 18);
  c.stroke();
  // The basket
  c.fillStyle = "#c99a58";
  c.strokeStyle = "#7a5a32";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(3, 18);
  c.lineTo(43, 18);
  c.lineTo(37, 37);
  c.lineTo(9, 37);
  c.closePath();
  c.fill();
  c.stroke();
  // Weave
  c.strokeStyle = "rgba(122, 90, 50, 0.7)";
  c.lineWidth = 1;
  for (let y = 23; y < 37; y += 5) {
    c.beginPath();
    c.moveTo(5 + (y - 18) * 0.3, y);
    c.lineTo(41 - (y - 18) * 0.3, y);
    c.stroke();
  }
  for (let x = 11; x < 40; x += 6) {
    c.beginPath();
    c.moveTo(x, 19);
    c.lineTo(x + (23 - x) * 0.15, 36);
    c.stroke();
  }
  return cv;
}

function scoopImage() {
  if (typeof images === "undefined") return null;
  if (!images.scoop) {
    const img = makeScoopImage();
    if (img) images.scoop = img;
  }
  return images.scoop;
}

class Scoop {
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
    if (this.isDragging && typeof mouse !== "undefined") {
      this.x = mouse.x;
      this.y = mouse.y;
    }
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    if (!this.isDragging) return;
    // The box being dragged out
    if (scoopBox && scoopBox.scene === this.scene) {
      const r = _scoopRect(scoopBox.x0, scoopBox.y0, this.x, this.y);
      ctx.save();
      ctx.fillStyle = "rgba(255, 220, 140, 0.12)";
      ctx.strokeStyle = "rgba(255, 220, 140, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.setLineDash([]);
      const n = scoopCandidates(r).length;
      if (n) {
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "black";
        ctx.fillStyle = "#ffe7b0";
        const t = `${Math.min(n, SCOOP_MAX)}${n > SCOOP_MAX ? ` of ${n}` : ""}`;
        ctx.strokeText(t, r.x + 3, r.y - 3);
        ctx.fillText(t, r.x + 3, r.y - 3);
      }
      ctx.restore();
    }
    const img = scoopImage();
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = scoopCarried().length ? 0.9 : 0.55;
    ctx.drawImage(img, this.x - img.width / 2, this.y - img.height + 6);
    ctx.restore();
  }

  hitTest(px, py) {
    return Math.hypot(px - this.x, py - this.y) <= 20;
  }

  getBottomY() {
    return Infinity;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  onDrop() {
    scoopSetDownAll(true);
    this.isDragging = false;
    const idx = objects.indexOf(this);
    if (idx !== -1) objects.splice(idx, 1);
    isGlobalDragging = objects.some((o) => o.isDragging) || fluffies.some((f) => f.isDragging);
  }

  serialize() {
    return { classType: "Scoop", id: this.id, scene: this.scene };
  }

  deserialize(data) {
    if (data.id !== undefined && data.id !== null) this.id = data.id;
    if (data.scene) this.scene = data.scene;
  }
}

function _scoopRect(x0, y0, x1, y1) {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

function heldScoop() {
  return objects.find((o) => o instanceof Scoop && o.isDragging) || null;
}

function scoopCarried() {
  return scoopCarry.map((id) => fluffies.find((f) => f.id === id)).filter((f) => f && f.isDragging);
}

// Could this one be scooped up? (the same as picking it up by hand)
function canScoop(f) {
  if (!f || f.scene !== currentScene || f.isDragging) return false;
  if (f.currentCage && typeof FoalInACan !== "undefined" && f.currentCage instanceof FoalInACan) return false;
  if (typeof Cage !== "undefined" && Cage.locksItem(f)) return false;
  if (f.hiddenBy) return false; // (tucked away by a snitch: Snitch.js)
  if (f.isFallingFromThrow || f.heldWithThrowTool) return false;
  return true;
}

// The fluffies in a box, nearest its middle first
function scoopCandidates(r) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const pad = 8;
  return fluffies
    .filter((f) => canScoop(f))
    .filter((f) => {
      const y = f.y - 10;
      return f.x >= r.x - pad && f.x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
    })
    .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
}

// Lift them into the scoop
function scoopUp(list) {
  list = list.filter((f) => canScoop(f)).slice(0, Math.max(0, SCOOP_MAX - scoopCarried().length));
  if (!list.length) return 0;
  const told = new Set();
  let spoken = 0;
  for (const f of list) {
    if (typeof f.interruptMating === "function") f.interruptMating();
    if (f.placedOn) {
      if (typeof f.placedOn.releaseFluffy === "function") f.placedOn.releaseFluffy();
      f.placedOn = null;
    }
    f.grabbedPart = "torso";
    f.isDragging = true;
    if (typeof onFluffyPickedUp === "function") onFluffyPickedUp(f);
    if (f.isAlive && spoken < 2 && typeof getDialogue === "function") {
      if (f.tooYoungToWalk()) f.speak(getDialogue("BABY_PEEP", f), false, true);
      else if (!f.tooYoungToSpeak()) f.speak(getDialogue(f.adopted ? ["UPSIES"] : ["UPSIES", "FERAL"], f));
      spoken++;
    }
    scoopCarry.push(f.id);
    // A mum sees her babies scooped up (once each)
    if (f.isAlive && f.tooYoungToWalk() && f.motherId != null && !told.has(f.motherId)) {
      const mom = fluffies.find((m) => m.id === f.motherId && m.scene === f.scene && m.isAlive && !list.includes(m));
      if (mom && mom.canSee() && (relationships[mom.id] || {})[f.id] !== "estranged_child") {
        told.add(mom.id);
        mom.setShock(3.0);
        if (typeof HAPPINESS_PENALTY_BABBEH_GRABBED !== "undefined") mom.changeHappiness(HAPPINESS_PENALTY_BABBEH_GRABBED);
        if (typeof getDialogue === "function") mom.speak(getDialogue(mom.adopted ? ["UPSIES", "WITNESS_BABY"] : ["UPSIES", "WITNESS_BABY", "FERAL"], mom));
      }
    }
  }
  _scoopArrange();
  isGlobalDragging = true;
  return list.length;
}

// Bunched up round the pointer, a few to a row
function _scoopArrange() {
  const list = scoopCarried();
  const cols = Math.max(1, Math.ceil(Math.sqrt(list.length)));
  const rows = Math.ceil(list.length / cols);
  list.forEach((f, i) => {
    const c = i % cols;
    const row = Math.floor(i / cols);
    f.dragOffset = { x: (c - (cols - 1) / 2) * 28, y: (row - (rows - 1) / 2) * 16 + 20 };
    f.x = mouse.x + f.dragOffset.x;
    f.y = mouse.y + f.dragOffset.y;
  });
}

// The cage the pointer's over that would take a fluffy
function _scoopCageAt(x, y) {
  if (typeof Cage === "undefined") return null;
  const cages = objects.filter((o) => o instanceof Cage && o.scene === currentScene && !o.isDragging);
  for (let i = cages.length - 1; i >= 0; i--) {
    const b = cages[i].bounds;
    if (b && x > b.left && x < b.right && y > b.top && y < b.bottom) return cages[i];
  }
  return null;
}

// Set them all down. where-they-are: put down at their own spots (the
// scoop put away), else round the pointer. Returns false if they can't go.
function scoopSetDownAll(whereTheyAre = false) {
  const list = scoopCarried();
  if (!list.length) {
    scoopCarry = [];
    return true;
  }
  if (!whereTheyAre && typeof wouldPutOut === "function" && list.some((f) => wouldPutOut(f))) {
    if (typeof addUIMessage === "function") addUIMessage("Not in a bunch - put yours outside one at a time.");
    return false;
  }
  const cage = whereTheyAre ? null : _scoopCageAt(mouse.x, mouse.y);
  const b = cage && cage.bounds;
  for (const f of list) {
    if (!whereTheyAre) {
      f.x = mouse.x + (f.dragOffset ? f.dragOffset.x : 0);
      f.y = mouse.y + (f.dragOffset ? f.dragOffset.y : 0);
    }
    if (b) {
      f.x = clamp(f.x, b.left + 14, b.right - 14);
      f.y = clamp(f.y, b.top + 14, b.bottom - 4);
    }
    f.onDrop();
  }
  scoopCarry = [];
  // (the scoop's still in your hand)
  isGlobalDragging = objects.some((o) => o.isDragging) || fluffies.some((f) => f.isDragging);
  return true;
}

// attemptDrop (script.js): a click with the scoop in hand
function scoopClick() {
  const scoop = heldScoop();
  if (!scoop || mouse.rightDown) return false;
  if (scoopCarried().length) {
    scoopSetDownAll(false);
    return true;
  }
  scoopCarry = [];
  scoopBox = { x0: mouse.x, y0: mouse.y, scene: currentScene };
  return true;
}

// The window's mouseup (globals.js): the box is done
function scoopMouseUp() {
  if (!scoopBox) return 0;
  const box = scoopBox;
  scoopBox = null;
  if (!heldScoop() || box.scene !== currentScene) return 0;
  if (typeof mouseToWorld === "function") mouseToWorld();
  const r = _scoopRect(box.x0, box.y0, mouse.x, mouse.y);
  let list;
  if (r.w < SCOOP_MIN_BOX && r.h < SCOOP_MIN_BOX) {
    // A tap: the one under the pointer
    list = [];
    for (let i = fluffies.length - 1; i >= 0; i--) {
      const f = fluffies[i];
      if (canScoop(f) && f.hitTestAsSeen(mouse.x, mouse.y)) {
        list.push(f);
        break;
      }
    }
  } else list = scoopCandidates(r);
  const n = scoopUp(list);
  if (typeof mouseToScreen === "function") mouseToScreen();
  if (n && typeof addUIMessage === "function" && n > 1) addUIMessage(`Scooped up ${n}. Click to set them down.`);
  return n;
}

// Every step: forget any that were put down some other way, and set them
// down if the scoop's been put away
function updateScoop() {
  if (!scoopCarry.length) return;
  const held = scoopCarried();
  if (!heldScoop()) {
    scoopSetDownAll(true);
    return;
  }
  if (held.length !== scoopCarry.length) scoopCarry = held.map((f) => f.id);
}

if (typeof registerSystem === "function") registerSystem("scoop", updateScoop, 4);
