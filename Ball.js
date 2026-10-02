class Ball {
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
    this.type = Math.random() < 0.1 ? "jellenheimer" : "normal";
  }

  serialize() {
    return {
      classType: "Ball",
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      scene: this.scene,
      groundY: this.groundY,
      type: this.type,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.id = data.id;
    this.vx = data.vx || 0;
    this.vy = data.vy || 0;
    this.groundY = data.groundY || this.y;
    this.type = data.type || "normal";
  }

  getImage() {
    return images[`ball_${this.type}`];
  }

  isStill() {
    return (
      !this.isDragging &&
      Math.abs(this.vx) < 1 &&
      Math.abs(this.vy) < 1 &&
      Math.abs(this.y - this.groundY) < 1
    );
  }

  // x/y is the bottom center of the sprite (where it touches the ground)
  getBottomY() {
    return this.y;
  }

  getCenterY() {
    const img = this.getImage();
    return this.y - (img ? img.height / 2 : 0);
  }

  update(dt) {
    if (this.isDragging) {
      this.lastX = this.x;
      this.lastY = this.y;
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      const topWallHeight = height * 0.15;
      this.y = Math.max(this.y, topWallHeight + 10);
      return;
    }

    if (
      this.currentCage &&
      (!objects.includes(this.currentCage) ||
        this.currentCage.scene !== this.scene)
    ) {
      this.currentCage = null;
    }

    if (this.currentCage) {
      const bounds = this.getCageBounds();
      this.groundY = bounds.bottom;
      handleBouncingPhysics(this, dt, bounds);
    } else {
      handleBouncingPhysics(this, dt);
    }
  }

  // Limits for x/y (the ball's bottom center) while inside its cage
  getCageBounds() {
    const cage = this.currentCage;
    const img = this.getImage();
    const halfW = img ? img.width / 2 : 20;
    const ballH = img ? img.height : 40;
    const r = cage.getImage()
      ? cage.getInteriorRect()
      : {
          x: cage.bounds.left,
          y: cage.bounds.top,
          w: cage.bounds.right - cage.bounds.left,
          h: cage.bounds.bottom - cage.bounds.top,
        };
    return {
      left: r.x + halfW,
      right: r.x + r.w - halfW,
      top: r.y + ballH,
      bottom: r.y + r.h,
    };
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = this.getImage();
    if (!img || img.width === 0) return;
    ctx.save();
    ctx.translate(this.x, this.getCenterY());
    ctx.rotate(this.x * 0.05); // Rolling visual
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }

  hitTest(px, py) {
    const img = this.getImage();
    if (!img) return false;
    const dist = Math.sqrt((this.x - px) ** 2 + (this.getCenterY() - py) ** 2);
    return dist < img.width / 2;
  }

  onDrop() {
    handleDropping(this);
    this.groundY = this.y;
    this.vx = (this.x - this.lastX) / 0.016 || 0;
    this.vy = (this.y - this.lastY) / 0.016 || 0;
  }
}
