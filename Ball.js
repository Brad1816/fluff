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

  getBottomY() {
    return this.y + this.getImage().height / 2;
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
    ctx.translate(this.x, this.y);
    ctx.rotate(this.x * 0.05); // Rolling visual
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }

  hitTest(px, py) {
    const img = this.getImage();
    if (!img) return false;
    const dist = Math.sqrt((this.x - px) ** 2 + (this.y - py) ** 2);
    return dist < img.width / 2;
  }

  onDrop() {
    handleDropping(this);
    this.groundY = this.y;
    this.vx = (this.x - this.lastX) / 0.016 || 0;
    this.vy = (this.y - this.lastY) / 0.016 || 0;
  }
}
