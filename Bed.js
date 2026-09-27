const BED_WIDTH = 199;
const BED_HEIGHT = 45;

class Bed {
  constructor(scene = "INDOORS", type = "normal") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.type = type; // 'normal' or 'cardboard_box'
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.claimants = []; // up to 2 fluffy IDs
    if (type === "cardboard_box") {
      this.lifespanTimer = 240.0 + Math.random() * 120.0; // ~5 minutes lifespan
    } else {
      this.lifespanTimer = null;
    }
    this.shouldDespawn = false;
    const hueRanges = [
      [345, 370], // red (370 = 10 after mod)
      [305, 345], // pink
      [255, 305], // purple
      [195, 255], // blue
      [90, 165], // green
      [45, 75], // yellow
    ];
    const [hMin, hMax] =
      hueRanges[Math.floor(Math.random() * hueRanges.length)];
    this.bedHue = (hMin + Math.floor(Math.random() * (hMax - hMin))) % 360;
    this.tinted = null; // built lazily once images are loaded
  }

  _buildTinted() {
    if (
      !images.bed_fluff_back ||
      !images.bed_fluff_middle ||
      !images.bed_fluff_front
    )
      return;
    const h = this.bedHue;
    this.tinted = {
      back: tintImage(images.bed_fluff_back, `hsl(${h}, 70%, 55%)`),
      middle: tintImage(images.bed_fluff_middle, `hsl(${h}, 70%, 35%)`),
      front: tintImage(images.bed_fluff_front, `hsl(${h}, 70%, 75%)`),
    };
  }

  canAccept(horse) {
    if (horse.claimedBed && horse.claimedBed !== this) return false;
    if (this.claimants.includes(horse.id)) return true;
    if (this.type === "cardboard_box") {
      if (this.claimants.length === 0) return true;
      if (this.claimants.length === 1)
        return areSpecialFriends(horse.id, this.claimants[0]);
      return false;
    }
    if (this.claimants.length === 0) return horse.gender === "female";
    if (this.claimants.length === 1)
      return areSpecialFriends(horse.id, this.claimants[0]);
    return false;
  }

  tryClaimFor(horse) {
    if (this.claimants.includes(horse.id)) return true;
    if (!this.canAccept(horse)) return false;
    const isPartner = this.claimants.length === 1;
    this.claimants.push(horse.id);
    horse.claimedBed = this;
    if (typeof getDialogue !== "undefined") {
      horse.speak(
        getDialogue(
          isPartner ? ["BED", "CLAIM_PARTNER"] : ["BED", "CLAIM"],
          horse,
        ),
      );
    }
    return true;
  }

  unclaim(fluffyId) {
    this.claimants = this.claimants.filter((id) => id !== fluffyId);
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      const topWallHeight = height * 0.15;
      this.y = Math.max(this.y, topWallHeight + 10);
    }
    handleGenericCageContainment(this, BED_WIDTH, BED_HEIGHT);

    if (
      this.type === "cardboard_box" &&
      isAlleyScene(this.scene) &&
      this.lifespanTimer !== null
    ) {
      this.lifespanTimer -= dt;
      if (
        this.lifespanTimer <= 0 &&
        typeof currentScene !== "undefined" &&
        this.scene !== currentScene
      ) {
        this.shouldDespawn = true;
        this.claimants.forEach((id) => {
          const f = fluffies.find((fl) => fl.id === id);
          if (f && f.claimedBed === this) {
            f.claimedBed = null;
          }
        });
        this.claimants = [];
      }
    }

    // Clean up dead or removed claimants
    this.claimants = this.claimants.filter((id) => {
      const f = fluffies.find((f) => f.id === id);
      if (!f || !f.isAlive) {
        if (f) f.claimedBed = null;
        return false;
      }
      return true;
    });
  }

  onDrop() {
    handleDropping(this);
  }

  getBottomY() {
    return this.y;
  }

  getExtents() {
    return {
      left: this.x - BED_WIDTH / 2,
      right: this.x + BED_WIDTH / 2,
      top: this.y - BED_HEIGHT,
      bottom: this.y,
    };
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawBack(ctx) {
    if (this.type === "cardboard_box") return;
    if (!images.bed_wood) return;
    if (!this.tinted) this._buildTinted();
    if (!this.tinted) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(
      this.tinted.back,
      -images.bed_fluff_back.width / 2,
      -images.bed_fluff_back.height,
    );
    ctx.restore();
  }

  serialize() {
    return {
      classType: "Bed",
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      scene: this.scene,
      claimants: this.claimants,
      bedHue: this.bedHue,
      lifespanTimer: this.lifespanTimer,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.type = data.type || "normal";
    this.claimants = data.claimants || [];
    this.bedHue = data.bedHue || 0;
    this.lifespanTimer =
      data.lifespanTimer !== undefined
        ? data.lifespanTimer
        : this.type === "cardboard_box"
          ? 300
          : null;
  }

  drawOffScreen(ctx) {
    if (this.type === "cardboard_box") {
      ctx.save();
      ctx.translate(this.x, this.y);
      const boxImg = images.cardboard_box;
      if (boxImg) {
        ctx.drawImage(boxImg, -boxImg.width / 2, -boxImg.height);
      } else {
        ctx.fillStyle = "#C29B38";
        ctx.fillRect(-BED_WIDTH / 2, -BED_HEIGHT, BED_WIDTH, BED_HEIGHT);
      }
      if (this.claimants.length > 0) {
        ctx.fillStyle = "white";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(
          "♥".repeat(this.claimants.length),
          -BED_WIDTH / 2 + 6,
          -BED_HEIGHT / 2 + 20,
        );
      }
      ctx.restore();
      return;
    }
    if (images.bed_wood) {
      if (!this.tinted) this._buildTinted();
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.tinted) {
        ctx.drawImage(
          this.tinted.middle,
          -images.bed_fluff_middle.width / 2,
          -images.bed_fluff_middle.height,
        );
        ctx.drawImage(
          this.tinted.front,
          -images.bed_fluff_front.width / 2,
          -images.bed_fluff_front.height,
        );
      }
      ctx.drawImage(
        images.bed_wood,
        -images.bed_wood.width / 2,
        -images.bed_wood.height,
      );
      if (this.claimants.length > 0) {
        ctx.fillStyle = "white";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(
          "♥".repeat(this.claimants.length),
          -images.bed_wood.width / 2 + 6,
          -images.bed_wood.height / 2 + 20,
        );
      }
      ctx.restore();
      return;
    }

    if (images.bed) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.drawImage(images.bed, -images.bed.width / 2, -images.bed.height);
      ctx.restore();
      return;
    }

    const w = BED_WIDTH;
    const h = BED_HEIGHT;
    const headW = 14;
    const footW = 10;
    const headH = h + 16;
    const footH = h + 6;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Bed frame
    ctx.fillStyle = "#6B3A2A";
    ctx.fillRect(-w / 2, -h, w, h);

    // Mattress
    ctx.fillStyle = "#E8D5B0";
    ctx.fillRect(-w / 2 + headW, -h + 4, w - headW - footW, h - 6);

    // Headboard
    ctx.fillStyle = "#5C3020";
    ctx.fillRect(-w / 2, -headH, headW, headH);

    // Footboard
    ctx.fillStyle = "#5C3020";
    ctx.fillRect(w / 2 - footW, -footH, footW, footH);

    // Pillow
    ctx.fillStyle = "#FFF8E7";
    ctx.fillRect(-w / 2 + headW + 4, -h + 6, 22, 14);

    // Claim hearts
    if (this.claimants.length > 0) {
      ctx.fillStyle = "#E05070";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("♥".repeat(this.claimants.length), 0, -headH - 5);
    }

    ctx.restore();
  }
}
