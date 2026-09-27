class ImmobilizationBoard extends FluffyTable {
  constructor(scene = "INDOORS") {
    super(scene);
  }

  serialize() {
    const data = super.serialize();
    data.classType = "ImmobilizationBoard";
    return data;
  }

  deserialize(data) {
    super.deserialize(data);
  }

  getFluffyTableReference() {
    return this.securedFluffy ? this.securedFluffy.placedOn : null;
  }

  setFluffyTableReference(val) {
    if (this.securedFluffy) {
      this.securedFluffy.placedOn = val;
    }
  }

  renderStrap(ctx, horse) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const strapW = 12;
    const strapH = 5 + 100 * horse.scale;
    ctx.fillStyle = "#A05050";
    ctx.fillRect(-strapW / 2, -strapH + 10, strapW, strapH);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.strokeRect(-strapW / 2, -strapH + 10, strapW, strapH);
    ctx.restore();
  }

  drawOffScreen(ctx) {
    if (!images.immobilization_board) {
      // Fallback drawing if image not loaded
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(-this.w / 2 + 5, -this.h / 2 + 5, this.w, this.h);
      ctx.fillStyle = "#8d6e63"; // Brownish for board
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
      return;
    }

    const img =
      this.securedFluffy && images.immobilization_board_in_use
        ? images.immobilization_board_in_use
        : images.immobilization_board;
    const w = img.width;
    const h = img.height;
    this.w = w;
    this.h = h;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(img, -w / 2, -h / 2);
    ctx.restore();
  }
}
