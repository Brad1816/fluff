// ---------------------------------------------------------------------------
// Fence.js - placeable fence pieces for building pens.
//
// Each Fence is one straight piece, FENCE_SEGMENT_LENGTH pixels long, that is
// either horizontal ("h", runs left-right) or vertical ("v", runs up-down /
// into the screen). Pieces snap to a grid so they line up into closed pens.
//
// Fluffies walking on their own cannot cross a fence. You can still pick
// fluffies up and drop them on either side, so that is how you put a fluffy
// into (or take it out of) a pen.
//
//   * Buy "Fence" in the shop - the new piece sticks to your cursor.
//   * Click to place it. Click it again later to move it.
//   * Right click (or press R while holding it) to turn it 90 degrees.
//   * Shift + click to sell it back, like any other item.
//
// GATES are fence pieces that open. Right click a placed gate to open or
// close it (to turn a gate, pick it up and press R or right click).
//
// Fluffies understand pens (see "Pens" further down): they know which spots
// they can actually reach, walk round through open gates, don't try to go
// for food or toys on the other side of a fence, and get sad when a pen
// separates them from their friends or family.
// ---------------------------------------------------------------------------

// How long one fence piece is, in pixels.
const FENCE_SEGMENT_LENGTH = 80;
// Pieces snap to this grid while you drag them. Half a piece means you can
// line pens up neatly but still have some freedom where they go.
const FENCE_GRID = 40;
// How tall the fence is drawn (fluffies are roughly 115px tall).
const FENCE_HEIGHT = 56;
// Shop prices are set in globals.js (SPAWN_ACTIONS). Selling gives back half.

// New pieces from the shop face the same way as the last piece you turned
let lastFenceOrientation = "h";

// Wood colours taken from the existing backyard fence art (fence_post.png)
const FENCE_COLORS = {
  wood: "rgb(240, 226, 222)",
  grain: "rgb(222, 205, 201)",
  shade: "rgb(211, 194, 190)",
  outline: "#000",
};
// Gates use a slightly warmer wood and a dark latch so they stand out
const GATE_COLORS = {
  wood: "rgb(236, 208, 190)",
  shade: "rgb(206, 176, 158)",
  latch: "#5a4a42",
};

class Fence {
  constructor(scene = "INDOORS", orientation = "h", isGate = false) {
    this.id = nextObjectId++;
    this.scene = scene;
    this.orientation = orientation; // "h" or "v"
    this.isGate = !!isGate;
    this.isOpen = false; // only used by gates

    // (x, y) is where the piece touches the ground:
    //   "h": the LEFT end of the piece
    //   "v": the FAR (top of screen) end of the piece
    this.x = 0;
    this.y = 0;

    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }

  // ---- Geometry helpers ---------------------------------------------------

  // Where the two ends of the piece are on the ground
  getEnds() {
    if (this.orientation === "h") {
      return {
        x1: this.x,
        y1: this.y,
        x2: this.x + FENCE_SEGMENT_LENGTH,
        y2: this.y,
      };
    }
    return {
      x1: this.x,
      y1: this.y,
      x2: this.x,
      y2: this.y + FENCE_SEGMENT_LENGTH,
    };
  }

  // Rectangle (on screen) covering the drawn fence, used for clicking it
  getScreenRect() {
    const pad = 6;
    if (this.orientation === "h") {
      return {
        left: this.x - pad,
        top: this.y - FENCE_HEIGHT - pad,
        right: this.x + FENCE_SEGMENT_LENGTH + pad,
        bottom: this.y + pad,
      };
    }
    return {
      left: this.x - 12,
      top: this.y - FENCE_HEIGHT - pad,
      right: this.x + 12,
      bottom: this.y + FENCE_SEGMENT_LENGTH + pad,
    };
  }

  hitTest(px, py) {
    const r = this.getScreenRect();
    return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
  }

  // Does this piece stop fluffies right now? (An open gate doesn't.)
  blocksFluffies() {
    return !(this.isGate && this.isOpen);
  }

  // Open / close a gate
  toggleGate() {
    if (!this.isGate) return;
    this.isOpen = !this.isOpen;
    if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
      const cx =
        this.orientation === "h" ? this.x + FENCE_SEGMENT_LENGTH / 2 : this.x;
      const cy =
        this.orientation === "h"
          ? this.y - FENCE_HEIGHT / 2
          : this.y + FENCE_SEGMENT_LENGTH / 2 - FENCE_HEIGHT / 2;
      poofs.push(new Poof(cx, cy, this.scene));
    }
  }

  // Turn the piece 90 degrees, keeping it roughly where it was.
  rotate() {
    const half = FENCE_SEGMENT_LENGTH / 2;
    if (this.orientation === "h") {
      this.orientation = "v";
      this.x += half;
      this.y -= half;
    } else {
      this.orientation = "h";
      this.x -= half;
      this.y += half;
    }
    lastFenceOrientation = this.orientation;
    this.snapToGrid();
  }

  snapToGrid() {
    this.x = Math.round(this.x / FENCE_GRID) * FENCE_GRID;
    this.y = Math.round(this.y / FENCE_GRID) * FENCE_GRID;

    // Keep the fence on the floor (below the back wall, inside the screen)
    const topWallHeight = height * 0.15;
    const minY = Math.ceil((topWallHeight + 40) / FENCE_GRID) * FENCE_GRID;
    const len = FENCE_SEGMENT_LENGTH;
    const maxX = this.orientation === "h" ? width - len : width;
    const maxY = this.orientation === "h" ? height : height - len;
    this.x = clamp(this.x, 0, Math.floor(maxX / FENCE_GRID) * FENCE_GRID);
    this.y = clamp(this.y, minY, Math.floor(maxY / FENCE_GRID) * FENCE_GRID);
  }

  // ---- Game object interface (same shape as the other items) --------------

  update(dt) {
    if (this.isDragging) {
      // Follow the mouse, holding the piece by its middle, snapped to grid
      if (this.orientation === "h") {
        this.x = mouse.x - FENCE_SEGMENT_LENGTH / 2;
        this.y = mouse.y + FENCE_HEIGHT / 2;
      } else {
        this.x = mouse.x;
        this.y = mouse.y - (FENCE_SEGMENT_LENGTH - FENCE_HEIGHT) / 2;
      }
      this.snapToGrid();
    }
    // Fences are never inside a cage
    this.currentCage = null;
  }

  onDrop() {
    handleDropping(this);
    this.currentCage = null;
    this.snapToGrid();
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.snapToGrid();
  }

  // Used for draw order: things lower on screen are drawn in front
  getBottomY() {
    return this.orientation === "h" ? this.y : this.y + FENCE_SEGMENT_LENGTH;
  }

  serialize() {
    return {
      classType: "Fence",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      orientation: this.orientation,
      isGate: this.isGate,
      isOpen: this.isOpen,
    };
  }

  deserialize(data) {
    this.orientation = data.orientation === "v" ? "v" : "h";
    this.isGate = !!data.isGate;
    this.isOpen = !!data.isOpen;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    ctx.save();
    if (this.isDragging) ctx.globalAlpha = 0.75;
    if (this.isGate) {
      drawGate(ctx, this.x, this.y, this.orientation, this.isOpen);
    } else if (this.orientation === "h") {
      drawHorizontalFence(ctx, this.x, this.y, FENCE_SEGMENT_LENGTH);
    } else {
      drawVerticalFence(ctx, this.x, this.y, FENCE_SEGMENT_LENGTH);
    }
    ctx.restore();

    // While carrying a piece, show where it will block
    if (this.isDragging) {
      const e = this.getEnds();
      ctx.save();
      ctx.strokeStyle = "rgba(255, 215, 0, 0.9)";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1);
      ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Bought from the shop: a new piece that sticks to the cursor, facing the
// same way as the last piece you turned. (Used by ItemRegistry.js.)
function createHeldFence(isGate) {
  // Put down anything already being carried first
  for (const o of objects) {
    if (o.isDragging && o instanceof Fence) o.onDrop();
  }
  const fence = new Fence(currentScene, lastFenceOrientation, isGate);
  fence.isDragging = true;
  isGlobalDragging = true;
  fence.update(0);
  return fence;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function fenceBoard(ctx, x, y, w, h) {
  ctx.fillStyle = FENCE_COLORS.wood;
  ctx.fillRect(x, y, w, h);
  // A little shading along the bottom / right for depth
  ctx.fillStyle = FENCE_COLORS.shade;
  if (w >= h) ctx.fillRect(x, y + h - 3, w, 3);
  else ctx.fillRect(x + w - 3, y, 3, h);
  ctx.strokeStyle = FENCE_COLORS.outline;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

// A post standing on the ground at (x, groundY), with a pointed top
function fencePost(ctx, x, groundY) {
  const w = 12;
  const top = groundY - FENCE_HEIGHT;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, groundY);
  ctx.lineTo(x - w / 2, top + 6);
  ctx.lineTo(x, top);
  ctx.lineTo(x + w / 2, top + 6);
  ctx.lineTo(x + w / 2, groundY);
  ctx.closePath();
  ctx.fillStyle = FENCE_COLORS.wood;
  ctx.fill();
  // grain line + shaded side
  ctx.fillStyle = FENCE_COLORS.shade;
  ctx.fillRect(x + w / 2 - 3, top + 5, 3, FENCE_HEIGHT - 5);
  ctx.strokeStyle = FENCE_COLORS.grain;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 1, top + 10);
  ctx.lineTo(x - 1, groundY - 4);
  ctx.stroke();
  ctx.strokeStyle = FENCE_COLORS.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, groundY);
  ctx.lineTo(x - w / 2, top + 6);
  ctx.lineTo(x, top);
  ctx.lineTo(x + w / 2, top + 6);
  ctx.lineTo(x + w / 2, groundY);
  ctx.closePath();
  ctx.stroke();
}

function fenceShadow(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawHorizontalFence(ctx, x, groundY, len) {
  fenceShadow(ctx, x, groundY, x + len, groundY);
  // Two rails, then the posts in front of them
  fenceBoard(ctx, x - 2, groundY - 46, len + 4, 9);
  fenceBoard(ctx, x - 2, groundY - 25, len + 4, 9);
  fencePost(ctx, x, groundY);
  fencePost(ctx, x + len, groundY);
}

function drawVerticalFence(ctx, x, groundY, len) {
  // The piece runs "into" the screen, so we see it end-on: the far post,
  // the rails running toward us, then the near post in front.
  fenceShadow(ctx, x, groundY, x, groundY + len);
  fencePost(ctx, x, groundY);
  fenceBoard(ctx, x - 4, groundY - 46, 8, len + 9);
  fenceBoard(ctx, x - 4, groundY - 25, 8, len + 9);
  fencePost(ctx, x, groundY + len);
}

// Little icon for the shop button (drawn centred on 0,0)
function drawFenceIcon(ctx, btnSize) {
  ctx.save();
  const s = (btnSize * 0.55) / FENCE_SEGMENT_LENGTH;
  ctx.scale(s, s);
  drawHorizontalFence(
    ctx,
    -FENCE_SEGMENT_LENGTH / 2,
    FENCE_HEIGHT / 2,
    FENCE_SEGMENT_LENGTH,
  );
  ctx.restore();
}

// A gate board: like fenceBoard but in gate colours
function gateBoard(ctx, x, y, w, h) {
  ctx.fillStyle = GATE_COLORS.wood;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = GATE_COLORS.shade;
  if (w >= h) ctx.fillRect(x, y + h - 3, w, 3);
  else ctx.fillRect(x + w - 3, y, 3, h);
  ctx.strokeStyle = FENCE_COLORS.outline;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

// A diagonal brace board from (x1,y1) to (x2,y2)
function gateBrace(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = FENCE_COLORS.outline;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = GATE_COLORS.wood;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function gateLatch(ctx, x, y) {
  ctx.fillStyle = GATE_COLORS.latch;
  ctx.fillRect(x - 3, y - 5, 6, 10);
  ctx.strokeStyle = FENCE_COLORS.outline;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 3, y - 5, 6, 10);
}

function drawGate(ctx, x, groundY, orientation, isOpen) {
  const len = FENCE_SEGMENT_LENGTH;
  if (orientation === "h") {
    fenceShadow(ctx, x, groundY, x + len, groundY);
    if (!isOpen) {
      // Closed: a framed door with a diagonal brace and a latch
      gateBoard(ctx, x + 4, groundY - 48, len - 8, 9);
      gateBoard(ctx, x + 4, groundY - 18, len - 8, 9);
      gateBrace(ctx, x + 10, groundY - 14, x + len - 10, groundY - 44);
      fencePost(ctx, x, groundY);
      fencePost(ctx, x + len, groundY);
      gateLatch(ctx, x + len - 12, groundY - 30);
    } else {
      // Open: the door has swung toward us from the left post
      const swing = len * 0.6;
      fencePost(ctx, x + len, groundY);
      fencePost(ctx, x, groundY);
      gateBoard(ctx, x + 2, groundY - 48, 8, swing + 9);
      gateBoard(ctx, x + 2, groundY - 18, 8, swing + 9);
      gateLatch(ctx, x + 6, groundY + swing - 30);
    }
  } else {
    fenceShadow(ctx, x, groundY, x, groundY + len);
    if (!isOpen) {
      fencePost(ctx, x, groundY);
      gateBoard(ctx, x - 5, groundY - 48, 10, len + 9);
      gateBoard(ctx, x - 5, groundY - 18, 10, len + 9);
      // hinges by the far post and a latch sticking out by the near post
      ctx.fillStyle = GATE_COLORS.latch;
      ctx.fillRect(x - 9, groundY - 40, 5, 6);
      ctx.fillRect(x - 9, groundY - 12, 5, 6);
      ctx.fillRect(x + 4, groundY + len - 40, 10, 8);
      ctx.strokeStyle = FENCE_COLORS.outline;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4, groundY + len - 40, 10, 8);
      fencePost(ctx, x, groundY + len);
    } else {
      // Open: the door has swung out sideways from the far post
      const swing = len * 0.6;
      fencePost(ctx, x, groundY);
      gateBoard(ctx, x, groundY - 48, swing, 9);
      gateBoard(ctx, x, groundY - 18, swing, 9);
      gateBrace(ctx, x + 6, groundY - 14, x + swing - 6, groundY - 44);
      gateLatch(ctx, x + swing - 6, groundY - 30);
      fencePost(ctx, x, groundY + len);
    }
  }
}

function drawGateIcon(ctx, btnSize) {
  ctx.save();
  const s = (btnSize * 0.55) / FENCE_SEGMENT_LENGTH;
  ctx.scale(s, s);
  drawGate(ctx, -FENCE_SEGMENT_LENGTH / 2, FENCE_HEIGHT / 2, "h", false);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Collision: stopping fluffies from walking through fences
// ---------------------------------------------------------------------------

// Fences in each scene, rebuilt once per frame by prepareFenceCollisions()
// (only pieces that block right now: open gates and carried pieces don't)
let fencesByScene = {};
// A short text describing each scene's fences, so the pen map (below) knows
// when it has to be rebuilt
let fenceSignatureByScene = {};

function prepareFenceCollisions() {
  fencesByScene = {};
  fenceSignatureByScene = {};
  if (typeof objects === "undefined") return;
  for (const o of objects) {
    if (o instanceof Fence && !o.isDragging && o.blocksFluffies()) {
      (fencesByScene[o.scene] = fencesByScene[o.scene] || []).push(o);
      fenceSignatureByScene[o.scene] =
        (fenceSignatureByScene[o.scene] || "") +
        o.orientation + o.x + "," + o.y + ";";
    }
  }
}

function sceneHasFences(scene) {
  const list = fencesByScene[scene];
  return !!(list && list.length);
}

// A fluffy's x/y is the middle of its body; its hooves are a bit lower.
// This is kept the same for every size of fluffy on purpose: if it grew with
// the fluffy, a foal growing up right next to a fence could slowly end up on
// the other side of it without ever walking.
function fenceFootOffset(horse) {
  return 40;
}

// The area around a fence piece a fluffy's hooves can't be in. Bigger
// fluffies get a bigger area so their bodies don't poke through the fence.
function fenceBlockedArea(fence, horse) {
  const s = horse.scale || 0.5;
  // Across the fence: for side fences keep the whole body on its own side
  // (only the head can lean over the rails).
  const side = fence.orientation === "h" ? 12 : 105 * s;
  const end = fence.orientation === "h" ? 30 * s : 12; // past each end
  const e = fence.getEnds();
  if (fence.orientation === "h") {
    return {
      left: e.x1 - end,
      right: e.x2 + end,
      top: e.y1 - side,
      bottom: e.y1 + side,
    };
  }
  return {
    left: e.x1 - side,
    right: e.x1 + side,
    top: e.y1 - end,
    bottom: e.y2 + end,
  };
}

function pointInArea(x, y, a) {
  return x > a.left && x < a.right && y > a.top && y < a.bottom;
}

// Would walking from (ax, ay) to (bx, by) (body positions) go through a fence?
function isFenceMoveBlocked(horse, ax, ay, bx, by) {
  const fences = fencesByScene[horse.scene];
  if (!fences || !fences.length) return false;

  const off = fenceFootOffset(horse);
  ay += off;
  by += off;
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(dist / 4));

  for (const fence of fences) {
    const area = fenceBlockedArea(fence, horse);
    const startInside = pointInArea(ax, ay, area);
    // Which side of the fence line we start on, and how far from it
    const startSide =
      fence.orientation === "h" ? Math.sign(ay - fence.y) : Math.sign(ax - fence.x);
    const startDist =
      fence.orientation === "h" ? Math.abs(ay - fence.y) : Math.abs(ax - fence.x);

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = ax + (bx - ax) * t;
      const py = ay + (by - ay) * t;
      if (!pointInArea(px, py, area)) continue;
      if (!startInside) return true; // walking into the fence
      // Already overlapping the fence (e.g. dropped on it, or it grew):
      // may walk away from it or along it, but not closer or through it.
      const side =
        fence.orientation === "h" ? Math.sign(py - fence.y) : Math.sign(px - fence.x);
      if (startSide !== 0 && side !== 0 && side !== startSide) return true;
      const d =
        fence.orientation === "h" ? Math.abs(py - fence.y) : Math.abs(px - fence.x);
      if (d < startDist - 0.01) return true;
    }
  }
  return false;
}

// Is there a fence between this fluffy and a spot it wants to walk to?
function isFencePathBlocked(horse, targetX, targetY) {
  if (!sceneHasFences(horse.scene)) return false;
  return isFenceMoveBlocked(horse, horse.x, horse.y, targetX, targetY);
}

// Called for every fluffy once per frame, after it has moved. Compares where
// it is now with where it was after last frame's check (so it also catches
// movement that happened outside the fluffy's own update). If the move went
// through a fence, slide along the fence instead, or stop.
function resolveFenceCollision(horse) {
  const prevX = horse._fenceLastX;
  const prevY = horse._fenceLastY;
  const prevScene = horse._fenceLastScene;
  const remember = () => {
    horse._fenceLastX = horse.x;
    horse._fenceLastY = horse.y;
    horse._fenceLastScene = horse.scene;
  };

  if (
    prevX === undefined ||
    horse.scene !== prevScene ||
    !sceneHasFences(horse.scene) ||
    horse.isDragging ||
    horse.currentCage ||
    horse.placedOn
  ) {
    remember();
    return;
  }

  const dx = horse.x - prevX;
  const dy = horse.y - prevY;
  // Very big jumps are teleports by game logic (scene changes, day care
  // etc.), not walking - leave those alone.
  if ((dx === 0 && dy === 0) || Math.hypot(dx, dy) > 150) {
    remember();
    return;
  }

  if (!isFenceMoveBlocked(horse, prevX, prevY, horse.x, horse.y)) {
    remember();
    return;
  }

  // Try sliding along the fence: keep only the sideways part of the move
  if (dx !== 0 && !isFenceMoveBlocked(horse, prevX, prevY, prevX + dx, prevY)) {
    horse.y = prevY;
    remember();
    return;
  }
  if (dy !== 0 && !isFenceMoveBlocked(horse, prevX, prevY, prevX, prevY + dy)) {
    horse.x = prevX;
    remember();
    return;
  }

  // Completely blocked: stay put and give up on that destination so the
  // fluffy picks something else to do.
  horse.x = prevX;
  horse.y = prevY;
  if (typeof horse.setTargetPosition === "function" && horse.targetX != null) {
    horse.setTargetPosition(horse.x, horse.y);
  }
}

// ---------------------------------------------------------------------------
// Pens: helping fluffies understand where they can go
// ---------------------------------------------------------------------------
//
// For every scene with fences we build a "pen map": the floor is cut into
// small squares, squares covered by a fence are marked as blocked, and then
// every connected patch of open floor gets a number (a "region"). Two spots
// with the same region number can be walked between (maybe the long way
// round, through an open gate). Different numbers = a fence is in the way.
//
// The biggest region in a scene counts as "outside"; a fluffy standing in
// any smaller region is "penned".
//
// The map is only rebuilt when the fences in that scene change (placed,
// moved, removed, a gate opened or closed).

const PEN_MAP_CELL = 10; // size of one square, in pixels
// The map is built for a fluffy about this size (a big adult), so a gap in
// the map is always wide enough for any fluffy to really fit through.
const PEN_MAP_FLUFFY_SCALE = 0.55;
// How much happiness a fluffy loses each time it gets upset about being
// separated by a pen (the "lost family" penalty in the base game is -0.025)
const HAPPINESS_PENALTY_PEN_SEPARATED = -0.015;
const HAPPINESS_BONUS_PEN_REUNITED = 0.05;

let penMapCache = {}; // scene -> map

function getPenMap(scene) {
  if (!sceneHasFences(scene)) return null;
  const sig = fenceSignatureByScene[scene];
  const cached = penMapCache[scene];
  if (cached && cached.sig === sig && cached.w === width && cached.h === height)
    return cached;

  const C = PEN_MAP_CELL;
  const cols = Math.ceil(width / C);
  const rows = Math.ceil(height / C);
  const blocked = new Uint8Array(cols * rows);

  // Floor limits: fluffies' hooves never go above this line (the back wall)
  // or below the bottom of the screen
  const minFeetY = height * 0.15 + 50 + fenceFootOffset(null) - C;
  const maxFeetY = height;
  for (let r = 0; r < rows; r++) {
    const cy = r * C + C / 2;
    if (cy < minFeetY || cy > maxFeetY) {
      for (let c = 0; c < cols; c++) blocked[r * cols + c] = 1;
    }
  }

  // Mark squares covered by fences
  const sizeRef = { scale: PEN_MAP_FLUFFY_SCALE };
  for (const fence of fencesByScene[scene]) {
    const a = fenceBlockedArea(fence, sizeRef);
    const c0 = Math.max(0, Math.floor(a.left / C));
    const c1 = Math.min(cols - 1, Math.floor(a.right / C));
    const r0 = Math.max(0, Math.floor(a.top / C));
    const r1 = Math.min(rows - 1, Math.floor(a.bottom / C));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (pointInArea(c * C + C / 2, r * C + C / 2, a)) {
          blocked[r * cols + c] = 1;
        }
      }
    }
  }

  // Number the connected patches of open floor (flood fill)
  const region = new Int32Array(cols * rows).fill(-1);
  const sizes = [];
  const queue = new Int32Array(cols * rows);
  for (let start = 0; start < cols * rows; start++) {
    if (blocked[start] || region[start] !== -1) continue;
    const id = sizes.length;
    let head = 0,
      tail = 0,
      count = 0;
    queue[tail++] = start;
    region[start] = id;
    while (head < tail) {
      const i = queue[head++];
      count++;
      const c = i % cols;
      const r = (i - c) / cols;
      const nbrs = [
        c > 0 ? i - 1 : -1,
        c < cols - 1 ? i + 1 : -1,
        r > 0 ? i - cols : -1,
        r < rows - 1 ? i + cols : -1,
      ];
      for (const n of nbrs) {
        if (n >= 0 && !blocked[n] && region[n] === -1) {
          region[n] = id;
          queue[tail++] = n;
        }
      }
    }
    sizes.push(count);
  }

  let mainRegion = 0;
  for (let i = 1; i < sizes.length; i++) {
    if (sizes[i] > sizes[mainRegion]) mainRegion = i;
  }

  const map = {
    sig,
    w: width,
    h: height,
    cols,
    rows,
    blocked,
    region,
    sizes,
    mainRegion,
  };
  penMapCache[scene] = map;
  return map;
}

// The map square at a ground position. If that square is covered by a fence
// (e.g. a small foal standing close to one), use the nearest open square.
function penMapCellAt(map, x, feetY) {
  const C = PEN_MAP_CELL;
  const c = clamp(Math.floor(x / C), 0, map.cols - 1);
  const r = clamp(Math.floor(feetY / C), 0, map.rows - 1);
  const i = r * map.cols + c;
  if (!map.blocked[i]) return i;
  // Search outwards in growing squares
  for (let rad = 1; rad <= 12; rad++) {
    let best = -1,
      bestD = Infinity;
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const rr = r + dr,
          cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= map.rows || cc >= map.cols) continue;
        const j = rr * map.cols + cc;
        if (map.blocked[j]) continue;
        const d = dr * dr + dc * dc;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
    }
    if (best !== -1) return best;
  }
  return -1;
}

function penRegionAt(map, x, feetY) {
  const i = penMapCellAt(map, x, feetY);
  return i === -1 ? -1 : map.region[i];
}

// Where a thing "stands" on the ground. Fluffies' x/y is their body, so
// their hooves are lower; items' y is already where they touch the ground.
function fenceGroundPointOf(thing) {
  if (typeof Horse !== "undefined" && thing instanceof Horse) {
    return { x: thing.x, y: thing.y + fenceFootOffset(thing) };
  }
  return { x: thing.x, y: thing.y };
}

// Can this fluffy walk to the spot where its body would be at (tx, ty)?
function canFluffyReach(horse, tx, ty) {
  const map = getPenMap(horse.scene);
  if (!map) return true;
  const off = fenceFootOffset(horse);
  return (
    penRegionAt(map, horse.x, horse.y + off) === penRegionAt(map, tx, ty + off)
  );
}

// Can this fluffy get to this item / other fluffy? (Used by the fluffy AI when
// looking for food, beds, toys, friends... just like the cage checks.)
function fenceCanReachThing(horse, thing) {
  if (!thing || thing.scene !== horse.scene) return true;
  if (horse.currentCage || thing.currentCage) return true; // cages decide
  const map = getPenMap(horse.scene);
  if (!map) return true;
  const g = fenceGroundPointOf(thing);
  return (
    penRegionAt(map, horse.x, horse.y + fenceFootOffset(horse)) ===
    penRegionAt(map, g.x, g.y)
  );
}

function canFluffiesReachEachOther(a, b) {
  return fenceCanReachThing(a, b);
}

// Is this fluffy shut inside a pen (not in the big open area)?
function isFluffyPenned(horse) {
  const map = getPenMap(horse.scene);
  if (!map) return false;
  const r = penRegionAt(map, horse.x, horse.y + fenceFootOffset(horse));
  return r !== -1 && r !== map.mainRegion;
}

// The closest spot to (tx, ty) that this fluffy can actually walk to, as a
// body position, or null.
function nearestReachablePoint(horse, tx, ty) {
  const map = getPenMap(horse.scene);
  if (!map) return { x: tx, y: ty };
  const off = fenceFootOffset(horse);
  const myRegion = penRegionAt(map, horse.x, horse.y + off);
  if (myRegion === -1) return null;
  const C = PEN_MAP_CELL;
  const tc = clamp(Math.floor(tx / C), 0, map.cols - 1);
  const tr = clamp(Math.floor((ty + off) / C), 0, map.rows - 1);
  let best = -1,
    bestD = Infinity;
  for (let i = 0; i < map.region.length; i++) {
    if (map.region[i] !== myRegion) continue;
    const c = i % map.cols;
    const r = (i - c) / map.cols;
    const d = (c - tc) ** 2 + (r - tr) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best === -1) return null;
  const c = best % map.cols;
  const r = (best - c) / map.cols;
  return { x: c * C + C / 2, y: r * C + C / 2 - off };
}

// Shortest walk (as map squares) from one square to another in the same region
function findPenPath(map, startIdx, goalIdx) {
  const n = map.cols * map.rows;
  const prev = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0,
    tail = 0;
  queue[tail++] = startIdx;
  prev[startIdx] = startIdx;
  const cols = map.cols;
  while (head < tail) {
    const i = queue[head++];
    if (i === goalIdx) break;
    const c = i % cols;
    const r = (i - c) / cols;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr,
          cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= map.rows || cc >= cols) continue;
        const j = rr * cols + cc;
        if (map.blocked[j] || prev[j] !== -1) continue;
        // no cutting diagonally past a fence corner
        if (dr && dc && (map.blocked[r * cols + cc] || map.blocked[rr * cols + c]))
          continue;
        prev[j] = i;
        queue[tail++] = j;
      }
    }
  }
  if (prev[goalIdx] === -1) return null;
  const path = [];
  for (let i = goalIdx; i !== startIdx; i = prev[i]) path.push(i);
  path.reverse();
  return path;
}

// Called while a fluffy walks. Returns the spot it should head for right now
// (a point on the way round a fence), or null to walk straight at its target.
// If the target can't be reached at all, the fluffy changes its mind: it goes
// to the closest spot by the fence if the target is just on the other side,
// otherwise it gives up on that target.
function getFenceSteerPoint(horse) {
  if (!sceneHasFences(horse.scene)) return null;
  if (horse.isDragging || horse.currentCage || horse.placedOn) return null;
  const tx = horse.targetX,
    ty = horse.targetY;
  if (tx == null || ty == null) return null;

  if (!isFenceMoveBlocked(horse, horse.x, horse.y, tx, ty)) {
    horse._fenceSteer = null;
    return null; // nothing in the way
  }

  const map = getPenMap(horse.scene);
  if (!map) return null;
  const off = fenceFootOffset(horse);
  const startIdx = penMapCellAt(map, horse.x, horse.y + off);
  const goalIdx = penMapCellAt(map, tx, ty + off);
  if (startIdx === -1 || goalIdx === -1) return null;

  if (map.region[startIdx] !== map.region[goalIdx]) {
    // Can't get there from here.
    const np = nearestReachablePoint(horse, tx, ty);
    if (np && Math.hypot(np.x - tx, np.y - ty) <= 170) {
      horse.targetX = np.x;
      horse.targetY = np.y;
    } else {
      horse.targetX = horse.x;
      horse.targetY = horse.y;
    }
    horse._fenceSteer = null;
    return { x: horse.x, y: horse.y }; // stand still this step
  }

  // The spot is on our side, but squeezed up against a fence, closer than a
  // fluffy's body can get. Aim for the nearest spot it can really stand on
  // instead, or it would keep walking into the fence and never arrive.
  const rawGoal =
    clamp(Math.floor((ty + off) / PEN_MAP_CELL), 0, map.rows - 1) * map.cols +
    clamp(Math.floor(tx / PEN_MAP_CELL), 0, map.cols - 1);
  if (map.blocked[rawGoal]) {
    const np = nearestReachablePoint(horse, tx, ty);
    if (np) {
      horse.targetX = np.x;
      horse.targetY = np.y;
    }
    horse._fenceSteer = null;
    return { x: horse.x, y: horse.y }; // stand still this step
  }

  // Reachable, but not in a straight line: follow a path round the fences.
  // The path is worked out now and then, not every frame.
  const now = typeof timePlayed !== "undefined" ? timePlayed : 0;
  let st = horse._fenceSteer;
  if (
    !st ||
    st.goalIdx !== goalIdx ||
    st.sig !== map.sig ||
    now - st.time > 1.5 ||
    Math.hypot(st.x - horse.x, st.y - horse.y) < 12
  ) {
    const path = findPenPath(map, startIdx, goalIdx);
    if (!path) return null;
    if (!path.length) path.push(goalIdx); // already in the goal's square
    // Head for the furthest point along the path we can walk to in a
    // straight line (checking every few squares to keep it quick)
    const C = PEN_MAP_CELL;
    const toPoint = (idx) => {
      const c = idx % map.cols;
      const r = (idx - c) / map.cols;
      return { x: c * C + C / 2, y: r * C + C / 2 - off };
    };
    let chosen = toPoint(path[Math.min(path.length - 1, 2)]);
    const limit = Math.min(path.length - 1, 80);
    for (let k = limit; k >= 3; k -= 4) {
      const p = toPoint(path[k]);
      if (!isFenceMoveBlocked(horse, horse.x, horse.y, p.x, p.y)) {
        chosen = p;
        break;
      }
    }
    st = { goalIdx, sig: map.sig, time: now, x: chosen.x, y: chosen.y };
    horse._fenceSteer = st;
  }
  return { x: st.x, y: st.y };
}

// ---------------------------------------------------------------------------
// Pen feelings: being separated from friends and family
// ---------------------------------------------------------------------------

// Which relationships a fluffy cares about being separated from, and the
// dialogue key used for each. Earlier in the list = cares more.
const PEN_RELATIONS = [
  ["baby_child", "BABY"],
  ["child", "BABY"],
  ["mother", "MOTHER"],
  ["special_friend", "SPECIAL_FRIEND"],
  ["father", "FATHER"],
  ["brother", "SIBLING"],
  ["sister", "SIBLING"],
  ["friend", "FRIEND"],
];

// Who (if anyone) is this fluffy separated from by a fence right now?
function findPenSeparatedRelative(horse) {
  const rels =
    typeof relationships !== "undefined" ? relationships[horse.id] : null;
  if (!rels) return null;
  let best = null,
    bestRank = Infinity;
  for (const [otherId, rel] of Object.entries(rels)) {
    const rank = PEN_RELATIONS.findIndex((p) => p[0] === rel);
    if (rank === -1 || rank >= bestRank) continue;
    const other = fluffies.find((f) => f.id == otherId);
    if (
      !other ||
      !other.isAlive ||
      other.scene !== horse.scene ||
      other.isDragging ||
      other.currentCage
    )
      continue;
    if (!fenceCanReachThing(horse, other)) {
      best = { other, key: PEN_RELATIONS[rank][1] };
      bestRank = rank;
    }
  }
  return best;
}

// Runs for every fluffy each frame (checks about once a second)
function updatePenFeelings(horse, dt) {
  if (!horse.isAlive || horse.isDragging) return;
  if (horse._penCheckTimer === undefined) horse._penCheckTimer = Math.random();
  horse._penCheckTimer -= dt;
  if (horse._penCheckTimer > 0) return;
  horse._penCheckTimer = 1.0;

  const sep =
    sceneHasFences(horse.scene) && !horse.currentCage && !horse.placedOn
      ? findPenSeparatedRelative(horse)
      : null;

  if (sep) {
    horse._penSeparatedTime = (horse._penSeparatedTime || 0) + 1;
    horse._penSeparatedFromId = sep.other.id;
    if (horse._penSadTimer === undefined) horse._penSadTimer = 2 + Math.random() * 3;
    horse._penSadTimer -= 1;
    if (horse._penSadTimer > 0) return;
    horse._penSadTimer = 10 + Math.random() * 10;

    if (horse.currentStateKey === "SLEEPING") return;
    const penned = isFluffyPenned(horse);
    const family = sep.key === "BABY" || sep.key === "MOTHER";

    // Feel it
    // Social fluffies mind it more, loners less (Traits.js)
    const social =
      typeof traitLonelinessMultiplier === "function" ? traitLonelinessMultiplier(horse) : 1;
    if (horse.happiness > HAPPINESS_MISERABLE_THRESHOLD) {
      horse.changeHappiness(
        (penned
          ? HAPPINESS_PENALTY_PEN_SEPARATED
          : HAPPINESS_PENALTY_PEN_SEPARATED / 2) * social,
      );
    }
    horse.expressionOverride = family ? "MISERABLE" : "SAD";
    horse.expressionOverrideTimer = 3.0;

    // Say it
    if (horse.canSee() || horse.canHear()) {
      const key = horse.tooYoungToSpeak()
        ? ["PENNED", "CHIRPY"]
        : ["PENNED", sep.key, penned ? "INSIDE" : "OUTSIDE"];
      horse.speak(getDialogue(key, horse, sep.other));
    }

    // Go to the fence to be as close to them as possible
    if (
      !horse.tooYoungToWalk() &&
      !horse.isScared &&
      (horse.currentStateKey === "IDLE" || horse.currentStateKey === "SITTING")
    ) {
      const np = nearestReachablePoint(horse, sep.other.x, sep.other.y);
      if (np && Math.hypot(np.x - horse.x, np.y - horse.y) > 40) {
        horse.initBehavior("MOVING");
        horse.setTargetPosition(np.x, np.y);
      }
    }
    return;
  }

  // Not separated (any more). If we were for a while, and they're here with
  // us now, that's a happy reunion.
  if ((horse._penSeparatedTime || 0) >= 5) {
    const other = fluffies.find((f) => f.id == horse._penSeparatedFromId);
    if (
      other &&
      other.isAlive &&
      other.scene === horse.scene &&
      fenceCanReachThing(horse, other)
    ) {
      horse.changeHappiness(HAPPINESS_BONUS_PEN_REUNITED);
      horse.expressionOverride = "HAPPY";
      horse.expressionOverrideTimer = 3.0;
      if (!horse.tooYoungToSpeak() && (horse.canSee() || horse.canHear())) {
        horse.speak(getDialogue(["PENNED", "REUNITED"], horse, other));
      }
    }
  }
  horse._penSeparatedTime = 0;
  horse._penSeparatedFromId = null;
  horse._penSadTimer = undefined;
}
