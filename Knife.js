class Knife {
  constructor(type = "knife", scene = "INDOORS") {
    this.id = nextObjectId++;
    this.type = type; // 'knife' or 'scalpel'

    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.whackTimer = 0;
    this.currentCage = null;
    this.angle = 0;
  }

  update(dt) {
    if (this.whackTimer > 0) {
      this.whackTimer -= dt;
    }

    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.y = Math.max(this.y, topWallHeight + 10);
    }

    const img = images[this.type];
    if (img) {
      handleGenericCageContainment(this, img.width, img.height);
    }
  }

  onDrop() {
    this.angle = Math.random() * Math.PI;
    return handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  hitTest(px, py) {
    const img = images[this.type];
    if (!img) return false;
    const w = img.width;
    const h = img.height;

    const dx = px - this.x;
    const dy = py - this.y;

    let angle = 0;
    if (this.whackTimer > 0) {
      const t = (0.2 - this.whackTimer) / 0.2;
      angle = Math.sin(t * Math.PI) * this.angle;
    } else {
      angle = this.angle;
    }

    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;

    return rx >= -w / 2 && rx <= w / 2 && ry >= -h && ry <= 0;
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return {
      classType: "Knife",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      type: this.type,
      angle: this.angle,
      whackTimer: this.whackTimer,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.angle = data.angle || 0;
    this.whackTimer = data.whackTimer || 0;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = images[this.type];
    if (!img) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.whackTimer > 0) {
      // Animation: 0.2s duration.
      const t = (0.2 - this.whackTimer) / 0.2;
      const angle = (Math.sin(t * Math.PI) * (60 * Math.PI)) / 180;
      ctx.rotate(angle);
    } else if (!this.isDragging) {
      ctx.rotate(this.angle);
    }

    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
