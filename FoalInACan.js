class FoalInACan {
  constructor(scene = "ALLEY") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = width / 2;
    this.y = height / 2;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.formulaCharges = CAN_FORMULA_MAX;
    this.bounds = { left: 0, right: 0, top: 0, bottom: 0 };
    this.scale = 1.0;
    this.currentCage = null; // Cages cannot be inside other cages
  }

  update(dt) {
    const img = images.foal_in_a_can;
    const w = img ? img.width * this.scale : 60;
    const h = img ? img.height * this.scale : 70;

    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      // Boundary clamping (y is the bottom of the can)
      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.x = clamp(this.x, w / 2, sceneW(this.scene) - w / 2);
      this.y = clamp(this.y, topWallHeight + h + 10, sceneH(this.scene) - 10);
    }

    // Always sync bounds
    this.bounds.left = this.x - w / 2;
    this.bounds.right = this.x + w / 2;
    this.bounds.top = this.y - h;
    this.bounds.bottom = this.y;
  }

  onDrop() {
    const lastX = this.x;
    const lastY = this.y;
    const transitioned = handleDropping(this);
    if (transitioned && typeof fluffies !== "undefined") {
      const dx = this.x - lastX;
      const dy = this.y - lastY;
      const foal = fluffies.find((f) => f.currentCage === this);
      if (foal) {
        foal.scene = this.scene;
        foal.x += dx;
        foal.y += dy;
        if (foal.targetX !== undefined) {
          foal.targetX += dx;
          foal.targetY += dy;
        }
      }
    }
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  getBottomY() {
    return this.y;
  }

  freeFoal() {
    if (typeof fluffies !== "undefined") {
      const foal = fluffies.find((f) => f.currentCage === this);
      if (foal) {
        foal.currentCage = null;
        foal.despawnProtectionTimer = 10;
        // Jump out a little bit
        foal.vy = -150;
      }
    }

    if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
      poofs.push(new Poof(this.x, this.y - 20, this.scene, "green"));
    }

    if (typeof objects !== "undefined") {
      const idx = objects.indexOf(this);
      if (idx > -1) {
        objects.splice(idx, 1);
      }
    }
  }

  serialize() {
    return {
      classType: "FoalInACan",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      formulaCharges: this.formulaCharges,
      currentCageId: null,
    };
  }

  deserialize(data) {
    this.formulaCharges =
      data.formulaCharges !== undefined ? data.formulaCharges : 8;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    if (!images.foal_in_a_can) return;

    const img = images.foal_in_a_can;
    const w = img.width * this.scale;
    const h = img.height * this.scale;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }
}
