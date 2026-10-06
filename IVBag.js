class IVBag {
  constructor(scene = "INDOORS", type = "tpn") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.type = type; // "tpn", "prolactin", "growth_hormone", "het", "bit", "hot",
    this.x = width / 2;
    this.y = height / 2;
    this.w = 30;
    this.h = 40;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.attachedTo = null; // Reference to IVStand
    this.bounds = { left: 0, right: 0, top: 0, bottom: 0 };
    this.tintedSprite = null;
    this.charges = 1000;
    this.isDestroyed = false;
  }

  update(dt) {
    if (!this.tintedSprite && images.iv_bag && images.iv_bag.complete) {
      this.createTintedSprite();
    }

    if (this.charges <= 0) {
      this.isDestroyed = true;
      // A spare, or auto-refill: the next bag goes up and the line stays in
      if (this.attachedTo && typeof this.attachedTo.replaceEmptyBag === "function" && this.attachedTo.replaceEmptyBag(this)) {
        this.attachedTo = null;
        return;
      }
      if (this.attachedTo) {
        this.attachedTo.attachedBag = null;
        this.attachedTo.connectedFluffy = null;
        this.attachedTo.isConnecting = false;
      }
      return;
    }

    if (this.attachedTo) {
      if (this.attachedTo.isDestroyed || this.attachedTo.scene !== this.scene) {
        this.attachedTo = null;
      } else {
        // Position relative to the stand
        this.x = this.attachedTo.x + 0; // Slightly offset from center pole
        this.y = this.attachedTo.y - this.attachedTo.h / 2 + 25;

        if (this.attachedTo.connectedFluffy) {
          // Drug Delivery into connected fluffy's bloodstream
          // The IV stand will make sure there are 10 units in the bloodstream of its drug at all times until the bag depleted
          const f = this.attachedTo.connectedFluffy;
          if (f.isAlive && this.charges > 0) {
            const current = f.getDrugAmount(this.type);
            if (current < 10) {
              const needed = 10 - current;
              const transfer = Math.min(needed, this.charges);
              this.charges -= transfer;
              f.administerDrug(this.type, transfer);
            }
          }
        }
      }
    }

    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const halfW = this.w / 2;
      const halfH = this.h / 2;
      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.x = clamp(this.x, halfW, sceneW(this.scene) - halfW);
      this.y = clamp(this.y, topWallHeight + halfH + 5, sceneH(this.scene) - halfH);
    }

    this.bounds.left = this.x - this.w / 2;
    this.bounds.right = this.x + this.w / 2;
    this.bounds.top = this.y - this.h / 2;
    this.bounds.bottom = this.y + this.h / 2;
  }

  hitTest(px, py) {
    return (
      px >= this.bounds.left &&
      px <= this.bounds.right &&
      py >= this.bounds.top &&
      py <= this.bounds.bottom
    );
  }

  onDrop() {
    handleDropping(this);
  }

  getBottomY() {
    return this.y + this.h / 2;
  }

  serialize() {
    return {
      classType: "IVBag",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      type: this.type,
      charges: this.charges,
      isDestroyed: this.isDestroyed,
      attachedToId: this.attachedTo ? this.attachedTo.id : null,
    };
  }

  deserialize(data) {
    this.charges = data.charges || 1000;
    this.isDestroyed = data.isDestroyed || false;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  createTintedSprite() {
    if (!images.iv_bag || !images.iv_bag.complete || !images.iv_bag.width)
      return;
    const color =
      typeof getDrugColor === "function"
        ? getDrugColor(this.type, "#add8e6")
        : DRUG_COLORS?.[this.type] || "#add8e6";
    this.tintedSprite = tintImage(images.iv_bag, color);
  }

  drawOffScreen(ctx) {
    if (!this.tintedSprite) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const fallbackColor =
        typeof getDrugRgba === "function"
          ? getDrugRgba(this.type, 0.8, "rgba(173, 216, 230, 0.8)")
          : "rgba(173, 216, 230, 0.8)";
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
    } else {
      const img = this.tintedSprite;
      this.w = img.width;
      this.h = img.height;

      ctx.save();
      ctx.translate(this.x, this.y);

      // Draw tinted image
      ctx.drawImage(img, -this.w / 2, -this.h / 2);

      // Draw label on top
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = "black";
      let label = "TPN";
      if (this.type === "prolactin") label = "PRO";
      if (this.type === "growth_hormone") label = "GH";
      if (this.type === "aphrodisiac") label = "APH";
      if (this.type === "het") label = "HeT";
      if (this.type === "bit") label = "BiT";
      if (this.type === "hot") label = "HoT";
      if (this.type === "toxo_vaccine") label = "Tvx";
      if (this.type === "toxo_parasite") label = "Tpr";
      if (this.type === "laxative") label = "Lax";
      if (this.type === "diuretic") label = "Diu";
      if (this.type === "abortifacient") label = "FBG";
      if (this.type === "lethal") label = "LTH"; // (Handling.js)
      ctx.fillText(label, 0, -4);
      ctx.fillText(Math.ceil(this.charges), 0, 10);

      ctx.restore();
    }
  }
}
