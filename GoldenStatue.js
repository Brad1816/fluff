class GoldenStatue {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;

    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.y = Math.max(this.y, topWallHeight + 10);
    }

    if (images.golden_statue) {
      handleGenericCageContainment(
        this,
        images.golden_statue.width,
        images.golden_statue.height,
      );
    }
  }

  onDrop() {
    handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return {
      classType: "GoldenStatue",
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
    if (!images.golden_statue) return;

    const img = images.golden_statue;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
