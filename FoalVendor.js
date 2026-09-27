class FoalVendor {
  constructor(scene = "ALLEY") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = width - 150;
    this.y = height * 0.15 + 260;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }

  update(dt) {
    // Stationary machine, keeps its position fixed in top right of the scene
    this.x = width - 150;
    this.y = height * 0.15 + 260;
  }

  onDrop() {}

  setPosition(x, y) {
    // Enforce fixed position
    this.x = width - 150;
    this.y = height * 0.15 + 260;
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return {
      classType: "FoalVendor",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {}

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    if (!images.foal_vendor) return;

    const img = images.foal_vendor;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
