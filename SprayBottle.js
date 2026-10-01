class SprayBottle {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;

    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.sprayTimer = 0;
    this.currentCage = null;
    this.angle = 0;
  }

  update(dt) {
    if (this.sprayTimer > 0) {
      this.sprayTimer -= dt;
    }

    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.y = Math.max(this.y, topWallHeight + 10);
    }

    if (images.spray_bottle) {
      handleGenericCageContainment(
        this,
        images.spray_bottle.width,
        images.spray_bottle.height,
      );
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
    if (!images.spray_bottle) return false;
    const img = images.spray_bottle;
    const w = img.width;
    const h = img.height;

    const dx = px - this.x;
    const dy = py - this.y;

    const cos = Math.cos(-this.angle);
    const sin = Math.sin(-this.angle);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;

    return rx >= -w / 2 && rx <= w / 2 && ry >= -h && ry <= 0;
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return {
      classType: "SprayBottle",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      angle: this.angle,
      sprayTimer: this.sprayTimer,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.angle = data.angle || 0;
    this.sprayTimer = data.sprayTimer || 0;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    if (!images.spray_bottle) return;

    const img = images.spray_bottle;

    ctx.save();
    ctx.translate(this.x, this.y);

    // In your hand: the nozzle on the pointer, with a little squeeze
    if (this.isDragging) {
      drawHeldTool(ctx, img, "spray_bottle", 0, _toolBump(this.sprayTimer) * 4);
      ctx.restore();
      return;
    }

    let yOffset = 0;
    if (this.sprayTimer > 0) {
      // Animation: 0.2s duration.
      // Bob up and down by up to 15 pixels.
      const t = (0.2 - this.sprayTimer) / 0.2;
      yOffset = -Math.sin(t * Math.PI) * 15;
    } else if (!this.isDragging) {
      ctx.rotate(this.angle);
    }

    ctx.drawImage(img, -img.width / 2, -img.height + yOffset);
    ctx.restore();
  }
}
