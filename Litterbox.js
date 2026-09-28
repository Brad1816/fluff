class Litterbox {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.uses = 0;
    this.maxUses = 30;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.y = Math.max(this.y, topWallHeight + 50);
    }

    if (images.litterbox) {
      handleGenericCageContainment(
        this,
        images.litterbox.width,
        images.litterbox.height,
      );
    }
  }

  isFull() {
    return this.uses >= this.maxUses;
  }

  use() {
    this.uses++;
  }

  onDrop() {
    handleDropping(this);
  }

  getBottomY() {
    return this.y;
  }

  getExtents() {
    if (!images.litterbox)
      return { left: this.x, right: this.x, top: this.y, bottom: this.y };
    const w = images.litterbox.width;
    const h = images.litterbox.height;
    return {
      left: this.x - w / 2,
      right: this.x + w / 2,
      top: this.y - h,
      bottom: this.y,
    };
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  serialize() {
    return {
      classType: "Litterbox",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      uses: this.uses,
      maxUses: this.maxUses,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.uses = data.uses || 0;
    this.maxUses = data.maxUses || 30;
  }

  drawOffScreen(ctx) {
    let img = images.litterbox;
    if (this.isFull() && images.litterbox_full) {
      img = images.litterbox_full;
    } else if (this.uses > 0 && images.litterbox_partially_full) {
      img = images.litterbox_partially_full;
    }

    if (!img) return;
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.drawImage(img, -img.width / 2, -img.height);

    ctx.restore();
  }
}
