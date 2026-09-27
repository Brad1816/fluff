class DayCareDesk {
  constructor(scene = "DAY_CARE") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.updatePosition();
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }

  updatePosition() {
    this.x = width / 2;
    const imgH =
      images.day_care_desk &&
      images.day_care_desk.complete &&
      images.day_care_desk.height > 0
        ? images.day_care_desk.height
        : 150;
    this.y = height * 0.15 + imgH;
  }

  update(dt) {
    this.updatePosition();
  }

  onDrop() {}

  setPosition(x, y) {
    this.updatePosition();
  }

  getBottomY() {
    return this.y;
  }

  hitTest(px, py) {
    const img = images.day_care_desk;
    const w = img && img.complete && img.width > 0 ? img.width : 200;
    const h = img && img.complete && img.height > 0 ? img.height : 150;
    return isPointInRect(px, py, this.x - w / 2, this.y - h, w, h);
  }

  serialize() {
    return {
      classType: "DayCareDesk",
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
    if (!images.day_care_desk) return;

    const img = images.day_care_desk;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
