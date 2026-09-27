class FluffyTable {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = width / 3;
    this.y = height * 0.7;
    this.w = 200;
    this.h = 100;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.securedFluffy = null;
    this.bounds = { left: 0, right: 0, top: 0, bottom: 0 };
    this.currentCage = null;
  }

  update(dt) {
    const halfW = this.w / 2;
    const halfH = this.h / 2;

    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const topWallHeight = height * 0.15;
      this.x = clamp(this.x, halfW, width - halfW);
      this.y = clamp(this.y, topWallHeight + halfH + 5, height - halfH);
    }

    this.bounds.left = this.x - halfW;
    this.bounds.right = this.x + halfW;
    this.bounds.top = this.y - halfH;
    this.bounds.bottom = this.y + halfH;

    if (this.securedFluffy) {
      if (this.shouldReleaseFluffy()) {
        this.releaseFluffy();
      }

      if (!fluffies.some((f) => f === this.securedFluffy)) {
        this.securedFluffy = null;
      }
    }
  }

  shouldReleaseFluffy() {
    return (
      this.securedFluffy.isDestroyed ||
      this.securedFluffy.scene !== this.scene ||
      this.getFluffyTableReference() !== this
    );
  }

  getFluffyTableReference() {
    return null; // Override in subclass
  }

  releaseFluffy() {
    if (this.getFluffyTableReference() === this) {
      this.setFluffyTableReference(null);
    }
    this.securedFluffy = null;
  }

  setFluffyTableReference(val) {
    // Override in subclass
  }

  hitTest(px, py) {
    return (
      px >= this.bounds.left &&
      px <= this.bounds.right &&
      py >= this.bounds.top &&
      py <= this.bounds.bottom
    );
  }

  onDrop() {
    handleDropping(this);
  }

  getBottomY() {
    return this.y + this.h / 2;
  }

  serialize() {
    return {
      classType: "FluffyTable",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      securedFluffyId: this.securedFluffy ? this.securedFluffy.id : null,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    if (data.currentCageId !== undefined && data.currentCageId !== null) {
      this.currentCage = objects.find((obj) => obj.id === data.currentCageId);
    }
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    // Override in subclass
  }
}
