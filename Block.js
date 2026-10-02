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
    const topWallHeight = height * 0.15;
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
      this.x = this.heldBy.x;
      this.y = this.heldBy.y;
      this.scene = this.heldBy.scene;
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
