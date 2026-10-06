class Block {
  constructor(x, y, scene) {
    this.id = nextObjectId++;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.scene = scene;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.groundY = y;
    this.currentCage = null;
    this.stackedOn = null;
    this.heldBy = null;
    this.stackXOffset = 0;
    const types = ["e", "p", "t", "n"];
    this.type = types[Math.floor(Math.random() * types.length)];
  }

  serialize() {
    return {
      classType: "Block",
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      scene: this.scene,
      groundY: this.groundY,
      type: this.type,
      currentCageId: this.currentCage ? this.currentCage.id : null,
      stackedOnId: this.stackedOn ? this.stackedOn.id : null,
      heldById: this.heldBy ? this.heldBy.id : null,
      stackXOffset: this.stackXOffset,
    };
  }

  deserialize(data) {
    this.vx = data.vx || 0;
    this.vy = data.vy || 0;
    this.groundY = data.groundY || this.y;
    this.type = data.type;
    this.stackXOffset = data.stackXOffset || 0;
  }

  getImage() {
    return images[`block_${this.type}`];
  }

  // x/y is the bottom center of the sprite. A stacked block reports the
  // bottom of its whole stack.
  getBottomY() {
    // (held up in its hooves: drawn in front of it - Block.js blockHoovesUp)
    if (this.heldBy && typeof blockHoovesUp === "function" && blockHoovesUp(this.heldBy)) return this.heldBy.y + 0.5;
    return this.stackedOn ? this.stackedOn.getBottomY() : this.y;
  }

  getHalfHeight() {
    const img = this.getImage();
    return img ? img.height / 2 : 20;
  }

  getCenterY() {
    return this.y - this.getHalfHeight();
  }

  isStill() {
    return !this.isDragging && Math.abs(this.vx) < 1 && Math.abs(this.vy) < 1;
  }

  getClampedY() {
    const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
    return Math.max(this.y, topWallHeight + 10 + this.getHalfHeight());
  }

  clampY() {
    this.y = this.getClampedY();
    this.groundY = this.y;
  }

  update(dt) {
    if (this.isDragging) {
      this.lastX = this.x;
      this.lastY = this.y;
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      this.stackedOn = null;
      this.heldBy = null;
      this.stackXOffset = 0;
      this.clampY();
      return;
    }

    if (this.heldBy) {
      this.scene = this.heldBy.scene;
      // Being lifted up, or put on the tower (an animation, not physics)
      if (blockLiftPose(this, this.heldBy)) return;
      this.x = this.heldBy.x;
      this.y = this.heldBy.y;
      if (this.heldBy.layout && this.heldBy.layout.block) {
        const s = this.heldBy.facingRight
          ? this.heldBy.scale
          : -this.heldBy.scale;
        this.x = this.heldBy.x + this.heldBy.layout.block.x * s;
        // The block's center sits on the carry point
        this.y =
          this.heldBy.y +
          this.heldBy.layout.block.y * this.heldBy.scale +
          this.getHalfHeight();
      }
      return;
    }

    if (this.stackedOn) {
      const img = this.getImage();
      this.x = this.stackedOn.x + this.stackXOffset;
      this.y = this.stackedOn.y - (img ? img.height : 40); // Block height offset
      this.scene = this.stackedOn.scene;
      return;
    }

    handleBouncingPhysics(this, dt);

    if (this.currentCage) {
      handleGenericCageContainment(this, 40, 40);
      this.groundY = this.y;
    }
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = this.getImage();
    if (!img || img.width === 0) return;
    ctx.save();
    ctx.translate(this.x, this.getCenterY());
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }

  stackHeight() {
    return 1 + (this.stackedOn ? this.stackedOn.stackHeight() : 0);
  }

  hitTest(px, py) {
    const img = this.getImage();
    if (!img) return false;
    return (
      px >= this.x - img.width / 2 &&
      px <= this.x + img.width / 2 &&
      py >= this.y - img.height &&
      py <= this.y
    );
  }

  blockCycle(other) {
    let b = this.stackedOn;
    while (b) {
      if (b === other) return true;
      b = b.stackedOn;
    }
    return false;
  }

  onDrop() {
    handleDropping(this);
    if (typeof onToyDropped === "function") onToyDropped(this); // Affection.js
    this.groundY = this.y;

    const blocks = objects.filter((o) => o instanceof Block);
    const other = blocks.find(
      (b) =>
        b !== this &&
        b.scene === this.scene &&
        !b.heldBy &&
        Math.abs(b.x - this.x) < 30 &&
        Math.abs(b.y - this.y) < 50 &&
        !b.getStackedAbove() &&
        !b.blockCycle(this),
    );
    if (other) {
      // Find top of stack
      let top = other;
      while (top.getStackedAbove()) {
        top = top.getStackedAbove();
      }
      if (top !== this) {
        this.stackedOn = top;
        this.stackXOffset = (Math.random() - 0.5) * 10;
      }
    }
  }

  getStackedAbove() {
    if (typeof objects === "undefined") return null;
    const blocks = objects.filter((o) => o instanceof Block);
    return blocks.find((b) => b.stackedOn === this);
  }
}

// ---------------------------------------------------------------------------
// Picking a block up and putting it on a tower, as something you can see
// (playtest: they flipped back and forth and the block jumped about).
//   Picking up (startBlockLift, from HorseActionHandler when it reaches the
//   block - it walks to the block's side, BLOCK_STAND_OFF): it sits, faces
//   the block, raises it up in its hooves (the first BLOCK_LIFT_RAISE of
//   BLOCK_LIFT_TIME), holds it up, then swings it onto its back.
//   Stacking (HorseUpdate._updateStacking, 3 seconds sitting by the tower):
//   it lifts the block off its back, holds it up over the tower, and sets
//   it down on top.
// Not saved: a lift going on when the game's saved just finishes or drops.
// ---------------------------------------------------------------------------
const BLOCK_STAND_OFF = 38; // px either side of a block, where it stands to pick it up
const BLOCK_LIFT_TIME = 1.4; // seconds
const BLOCK_LIFT_RAISE = 0.45; // of the time: raising it up
const BLOCK_STACK_TIME = 3.0; // (HorseUpdate._updateStacking)

function startBlockLift(f, block) {
  if (!f || !block) return false;
  block.heldBy = f;
  block.stackedOn = null;
  block.vx = block.vy = 0;
  f._blockLift = { block, t: 0, dur: BLOCK_LIFT_TIME, x0: block.x, y0: block.getBottomY() };
  f.facingRight = block.x > f.x;
  f.initBehavior("SITTING");
  f.stateTimer = BLOCK_LIFT_TIME + 0.4;
  return true;
}

// Done (on its back), or stopped (it drops it where it is)
function endBlockLift(f, done) {
  const L = f && f._blockLift;
  if (!L) return;
  f._blockLift = null;
  const b = L.block;
  if (!b) return;
  if (done && b.heldBy === f) {
    f.blockOnBack = b;
    f.speak(getDialogue(["PLAY", "BLOCK"], f));
    f.expressionOverride = "GOOD_UPSIES";
    f.expressionOverrideTimer = 2.0;
    f.changeHappiness(HAPPINESS_BONUS_PLAY, "Played");
    if (typeof onFluffyPlayed === "function") onFluffyPlayed(f, "block"); // Play.js
    return;
  }
  if (b.heldBy === f) {
    b.heldBy = null;
    b.x = f.x + (f.facingRight ? 1 : -1) * 25 * (f.scale || 0.5) * 2;
    b.y = Math.max(f.y, L.y0 - 5);
    b.groundY = b.y;
    if (typeof b.clampY === "function") b.clampY();
  }
}

// Where its back carry point is (as Block.update)
function _blockBackSpot(b, f) {
  if (f.layout && f.layout.block) {
    const s = f.facingRight ? f.scale : -f.scale;
    return { x: f.x + f.layout.block.x * s, y: f.y + f.layout.block.y * f.scale + b.getHalfHeight() };
  }
  return { x: f.x, y: f.y };
}

// Held up in front of it, in its hooves
function _blockRaisedSpot(b, f) {
  const s = f.scale || 0.5;
  const dir = f.facingRight ? 1 : -1;
  return { x: f.x + dir * 92 * s, y: f.y - 40 * s };
}

function _ease(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

// Block.update: a block it's lifting or stacking. True if it placed it.
function blockLiftPose(b, f) {
  const L = f._blockLift;
  if (L && L.block === b) {
    const p = L.t / L.dur;
    const up = _blockRaisedSpot(b, f);
    if (p < BLOCK_LIFT_RAISE) {
      // From the floor up into its hooves
      const k = _ease(p / BLOCK_LIFT_RAISE);
      b.x = L.x0 + (up.x - L.x0) * k;
      b.y = L.y0 + (up.y - L.y0) * k;
    } else if (p < 0.75) {
      // Held up (a little wobble: it's heavy)
      b.x = up.x + Math.sin(L.t * 9) * 1.5;
      b.y = up.y + Math.sin(L.t * 6) * 2;
    } else {
      // Over onto its back
      const back = _blockBackSpot(b, f);
      const k = _ease((p - 0.75) / 0.25);
      b.x = up.x + (back.x - up.x) * k;
      b.y = up.y + (back.y - up.y) * k - Math.sin(k * Math.PI) * 18;
    }
    return true;
  }
  if (f.isStacking && f.blockOnBack === b && f.stackTargetBlock) {
    let top = f.stackTargetBlock;
    let n = 0;
    while (top.getStackedAbove() && n++ < 30) top = top.getStackedAbove();
    if (top === b) return false;
    const img = top.getImage();
    const onTop = { x: top.x, y: top.y - (img ? img.height : 40) };
    const back = _blockBackSpot(b, f);
    const over = { x: onTop.x, y: Math.min(onTop.y - 25, _blockRaisedSpot(b, f).y) };
    const p = Math.max(0, Math.min(1, (f.stackingTimer || 0) / BLOCK_STACK_TIME));
    if (p < 0.4) {
      const k = _ease(p / 0.4);
      b.x = back.x + (over.x - back.x) * k;
      b.y = back.y + (over.y - back.y) * k - Math.sin(k * Math.PI) * 14;
    } else if (p < 0.8) {
      b.x = over.x + Math.sin((f.stackingTimer || 0) * 9) * 1.5;
      b.y = over.y;
    } else {
      const k = _ease((p - 0.8) / 0.2);
      b.x = over.x;
      b.y = over.y + (onTop.y - over.y) * k;
    }
    return true;
  }
  return false;
}

// HorseRenderer: are its front hooves up, holding the block? (from part way
// through raising it until it swings it onto its back; over the tower)
function blockHoovesUp(f) {
  const L = f && f._blockLift;
  if (L) {
    const p = L.t / L.dur;
    return p > BLOCK_LIFT_RAISE * 0.4 && p < 0.85;
  }
  if (f && f.isStacking && f.blockOnBack) {
    const p = (f.stackingTimer || 0) / BLOCK_STACK_TIME;
    return p > 0.2 && p < 0.95;
  }
  return false;
}
