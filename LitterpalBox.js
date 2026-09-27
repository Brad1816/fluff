class LitterpalBox extends FluffyTable {
  constructor(scene = "INDOORS") {
    super(scene);
    this.uses = 0;
    this.maxUses = 20;
    this.scale = 1;
    this.isBox = false;
  }

  serialize() {
    const data = super.serialize();
    data.classType = "LitterpalBox";
    data.uses = this.uses;
    data.maxUses = this.maxUses;
    data.scale = this.scale;
    data.isBox = this.isBox;
    return data;
  }

  deserialize(data) {
    super.deserialize(data);
    if (data.uses !== undefined) this.uses = data.uses;
    if (data.maxUses !== undefined) this.maxUses = data.maxUses;
    if (data.scale !== undefined) this.scale = data.scale;
    if (data.isBox !== undefined) this.isBox = data.isBox;
  }

  getFluffyTableReference() {
    return this.securedFluffy ? this.securedFluffy.placedOn : null;
  }

  setFluffyTableReference(val) {
    if (this.securedFluffy) {
      this.securedFluffy.placedOn = val;
    }
  }

  onDrop() {
    handleDropping(this);
  }

  getSeekingCoords(f) {
    return {
      x: this.x - 90 * this.scale - 50 * f.scale,
      y: this.y,
    };
  }

  releaseFluffy() {
    if (this.securedFluffy) {
      this.setFluffyTableReference(null);
      this.securedFluffy = null;
    }
  }

  use() {
    this.uses = Math.min(this.maxUses, this.uses + 1);
  }

  isFull() {
    return this.uses >= this.maxUses;
  }

  getImage() {
    return this.isBox ? images.litterpal_box : images.litterpal_box_kit;
  }

  setScaleBasedOnSecuredFluffy() {
    if (this.isBox) return;
    this.isBox = true;
    poofs.push(new Poof(this.x, this.y, this.scene));
    this.scale = this.getScaleBasedOnSecuredFluffy();
  }

  getScaleBasedOnSecuredFluffy() {
    return 0.3 + 1.6 * this.securedFluffy.scale;
  }

  getOuttakeImage() {
    if (this.isFull()) {
      return images.lbb_outtake_full;
    } else if (this.uses > 0) {
      return images.lbb_outtake_used;
    } else {
      return images.lbb_outtake_empty;
    }
  }

  update(dt) {
    super.update(dt);
    if (this.securedFluffy) {
      if (this.getScaleBasedOnSecuredFluffy() > this.scale + 0.2) {
        this.releaseFluffy();
        poofs.push(new Poof(this.x, this.y, this.scene));
        const idx = objects.indexOf(this);
        if (idx > -1) objects.splice(idx, 1);
      }
    }
  }

  drawOffScreen(ctx) {
    const img = this.getImage();
    const w = img.width;
    const h = img.height;
    this.w = w;
    this.h = h;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    ctx.drawImage(img, -w / 2, -h / 2);
    if (this.isBox) {
      const outtakeImg = this.getOuttakeImage();
      const outtakeW = outtakeImg.width;
      const outtakeH = outtakeImg.height;
      ctx.translate(w / 2 + outtakeW / 2, h / 2 - outtakeH / 2);
      ctx.drawImage(outtakeImg, -outtakeW / 2, -outtakeH / 2);
    }
    ctx.restore();
  }
}
