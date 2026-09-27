class Cage {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.scale = 1.0;
    this.bounds = { left: 0, right: 0, top: 0, bottom: 0 };
    this.x = width / 2;
    this.y = height / 2;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.tag = "none"; // "none", "breeding", "sell"
  }

  cycleTag() {
    const tags = ["none", "breeding", "sell"];
    const idx = tags.indexOf(this.tag);
    this.tag = tags[(idx + 1) % tags.length];
  }

  update(dt) {
    if (!images.cage) return;

    const lastX = this.x;
    const lastY = this.y;

    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      // Simple boundary clamping for the cage itself
      const topWallHeight = height * 0.15;
      const w = images.cage.width * this.scale;
      const h = images.cage.height * this.scale;
      this.x = clamp(this.x, w / 2, width - w / 2);
      this.y = clamp(this.y, topWallHeight + h / 2, height - h / 2);
    }

    const dx = this.x - lastX;
    const dy = this.y - lastY;

    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      this.moveContents(dx, dy);
    }

    // Hit Test Bounds (Always sync in update)
    const img = images.cage;
    const w = img.width * this.scale;
    const h = img.height * this.scale;
    this.bounds.left = this.x - w / 2;
    this.bounds.right = this.x + w / 2;
    this.bounds.top = this.y - h / 2;
    this.bounds.bottom = this.y + h / 2;
  }

  moveContents(dx, dy) {
    const move = (item) => {
      if (item.currentCage === this && !item.isDragging) {
        item.x += dx;
        item.y += dy;
        if (item.targetX !== undefined) {
          item.targetX += dx;
          item.targetY += dy;
        }
      }
    };
    const arrays = [
      typeof fluffies !== "undefined" ? fluffies : [],
      typeof objects !== "undefined" ? objects : [],
    ];
    arrays.forEach((arr) => arr.forEach(move));
  }

  onDrop() {
    const lastX = this.x;
    const lastY = this.y;
    const transitioned = handleDropping(this);
    if (transitioned) {
      const dx = this.x - lastX;
      const dy = this.y - lastY;
      // Update scene and position for all contents
      const syncSceneAndPos = (item) => {
        if (item.currentCage === this) {
          item.scene = this.scene;
          item.x += dx;
          item.y += dy;
          if (item.targetX !== undefined) {
            item.targetX += dx;
            item.targetY += dy;
          }
        }
      };
      const arrays = [
        typeof fluffies !== "undefined" ? fluffies : [],
        typeof objects !== "undefined" ? objects : [],
      ];
      arrays.forEach((arr) => arr.forEach(syncSceneAndPos));
    }
  }

  getBottomY() {
    if (!images.cage) return this.y;
    return this.y + (images.cage.height * this.scale) / 2;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  serialize() {
    return {
      id: this.id,
      classType: "Cage",
      x: this.x,
      y: this.y,
      scene: this.scene,
      scale: this.scale,
      tag: this.tag,
    };
  }

  deserialize(data) {
    this.scale = data.scale || 1.0;
    this.tag = data.tag || "none";
  }

  drawOffScreen(ctx) {
    if (!images.cage) return;
    const img = images.cage;
    const w = img.width * this.scale;
    const h = img.height * this.scale;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    // Draw Tag
    if (this.tag && this.tag !== "none") {
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = this.tag === "breeding" ? "#E91E63" : "#4CAF50";
      ctx.fillRect(
        -w / 2 + 5,
        -h / 2 + 5,
        ctx.measureText(this.tag.toUpperCase()).width + 10,
        20,
      );
      ctx.fillStyle = "white";
      ctx.fillText(
        this.tag.toUpperCase(),
        -w / 2 + 5 + (ctx.measureText(this.tag.toUpperCase()).width + 10) / 2,
        -h / 2 + 19,
      );
    }
    ctx.restore();
  }
}
