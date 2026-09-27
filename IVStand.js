class IVStand {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = width / 2;
    this.y = height / 2;
    this.w = 50;
    this.h = 150;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.bounds = { left: 0, right: 0, top: 0, bottom: 0 };
    this.connectedFluffy = null;
    this.attachedBag = null;
    this.isConnecting = false;
    this.maxCordLength = 300;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const halfW = this.w / 2;
      const halfH = this.h / 2;
      const topWallHeight = height * 0.15;
      this.x = clamp(this.x, halfW, width - halfW);
      this.y = clamp(this.y, topWallHeight + halfH + 5, height - halfH);
    }

    const halfW = this.w / 2;
    const halfH = this.h / 2;
    this.bounds.left = this.x - halfW;
    this.bounds.right = this.x + halfW;
    this.bounds.top = this.y - halfH;
    this.bounds.bottom = this.y + halfH;

    if (!this.attachedBag) {
      this.connectedFluffy = null;
      this.isConnecting = false;
    }

    if (!fluffies.some((f) => f === this.connectedFluffy)) {
      this.connectedFluffy = null;
    }

    if (this.connectedFluffy) {
      if (
        this.connectedFluffy.isDestroyed ||
        this.connectedFluffy.scene !== this.scene
      ) {
        this.connectedFluffy = null;
      } else {
        const dx = this.connectedFluffy.x - this.x;
        const dy = this.connectedFluffy.y - 10 - (this.y - this.h / 2 + 10); // From top of stand to fluffy torso
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.maxCordLength) {
          this.connectedFluffy = null;
        }
      }
    }
  }

  hitTest(px, py) {
    return (
      px >= this.bounds.left &&
      px <= this.bounds.right &&
      py >= this.bounds.top &&
      py <= this.bounds.bottom
    );
  }

  hitTestTop(px, py) {
    const topSectionH = this.h * 0.25;
    return (
      px >= this.bounds.left &&
      px <= this.bounds.right &&
      py >= this.bounds.top &&
      py <= this.bounds.top + topSectionH
    );
  }

  getTopPoint() {
    return { x: this.x, y: this.y - this.h / 2 + 35 }; // Match bag visual
  }

  onDrop() {
    handleDropping(this);
  }

  getBottomY() {
    return this.y + this.h / 2;
  }

  serialize() {
    return {
      classType: "IVStand",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      connectedFluffyId: this.connectedFluffy ? this.connectedFluffy.id : null,
      attachedBagId: this.attachedBag ? this.attachedBag.id : null,
      isConnecting: this.isConnecting,
    };
  }

  deserialize(data) {
    this.isConnecting = data.isConnecting || false;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = images.iv_stand;
    this.w = img.width;
    this.h = img.height;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(img, -this.w / 2, -this.h / 2);
    ctx.restore();

    // Draw Cord
    const top = this.getTopPoint();
    if (this.connectedFluffy) {
      ctx.beginPath();
      ctx.strokeStyle = "black";
      ctx.lineWidth = 1;
      ctx.moveTo(top.x, top.y);
      const fh =
        this.connectedFluffy.positioning.getExtentsForCage().top -
        this.connectedFluffy.positioning.getExtentsForCage().bottom;
      let yOffset = this.connectedFluffy.placedOn
        ? 0
        : this.connectedFluffy.anim.yOffset;

      ctx.lineTo(
        this.connectedFluffy.x,
        this.connectedFluffy.y +
          10 +
          this.connectedFluffy.scale * (yOffset - 40),
      );
      ctx.stroke();
    } else if (this.isConnecting) {
      ctx.beginPath();
      ctx.strokeStyle = "black";
      ctx.lineWidth = 1;
      ctx.moveTo(top.x, top.y);

      let targetX = mouse.x;
      let targetY = mouse.y;
      const dx = targetX - top.x;
      const dy = targetY - top.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > this.maxCordLength) {
        targetX = top.x + (dx / dist) * this.maxCordLength;
        targetY = top.y + (dy / dist) * this.maxCordLength;
      }

      ctx.lineTo(targetX, targetY);
      ctx.stroke();
    }
  }
}
