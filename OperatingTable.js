class OperatingTable extends FluffyTable {
  constructor(scene = "INDOORS") {
    super(scene);
    this.categories = [
      "DEFAULT",
      "FRONT RIGHT LEG",
      "FRONT LEFT LEG",
      "BACK RIGHT LEG",
      "BACK LEFT LEG",
      "TAIL",
      "LEFT EAR",
      "RIGHT EAR",
      "LEFT EYE",
      "RIGHT EYE",
      "LEFT WING",
      "RIGHT WING",
      "HORN",
      "SPAYNEUTER",
    ];
    this.categoryIndex = 0;
  }

  cycleCategory() {
    this.categoryIndex = (this.categoryIndex + 1) % this.categories.length;
  }

  get category() {
    return this.categories[this.categoryIndex];
  }

  serialize() {
    const data = super.serialize();
    data.classType = "OperatingTable";
    data.categoryIndex = this.categoryIndex;
    return data;
  }

  deserialize(data) {
    super.deserialize(data);
    if (data.categoryIndex !== undefined) {
      this.categoryIndex = data.categoryIndex;
    }
  }

  getFluffyTableReference() {
    return this.securedFluffy ? this.securedFluffy.placedOn : null;
  }

  setFluffyTableReference(val) {
    if (this.securedFluffy) {
      this.securedFluffy.placedOn = val;
    }
  }

  drawOffScreen(ctx) {
    const img = images.operating_table;
    const w = img.width;
    const h = img.height;
    this.w = w;
    this.h = h;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(img, -w / 2, -h / 2);

    // Draw Category Tag
    const cat = this.category;
    if (cat !== "DEFAULT") {
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = "#2196F3"; // Blue for surgery categories
      const textWidth = ctx.measureText(cat).width;
      ctx.fillRect(-w / 2 + 5, 15, textWidth + 10, 20);
      ctx.fillStyle = "white";
      ctx.fillText(cat, -w / 2 + 5 + (textWidth + 10) / 2, 30);
    }

    ctx.restore();
  }
}
