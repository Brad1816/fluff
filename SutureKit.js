class SutureKit {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;

    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.whackTimer = 0;
    this.currentCage = null;
    this.angle = 0;
    this.charges = 4;
  }

  update(dt) {
    if (this.whackTimer > 0) {
      this.whackTimer -= dt;
    }

    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.y = Math.max(this.y, topWallHeight + 10);
    }

    if (images.suture_kit) {
      handleGenericCageContainment(
        this,
        images.suture_kit.width,
        images.suture_kit.height,
      );
    }
  }

  onDrop() {
    this.angle = Math.random() * Math.PI;
    return handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  hitTest(px, py) {
    if (!images.suture_kit) return false;
    const img = images.suture_kit;
    const w = img.width;
    const h = img.height;

    const dx = px - this.x;
    const dy = py - this.y;

    let angle = 0;
    if (this.whackTimer > 0) {
      const t = (0.2 - this.whackTimer) / 0.2;
      angle = Math.sin(t * Math.PI) * this.angle;
    } else {
      angle = this.angle;
    }

    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;

    return rx >= -w / 2 && rx <= w / 2 && ry >= -h && ry <= 0;
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return {
      classType: "SutureKit",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      angle: this.angle,
      whackTimer: this.whackTimer,
      charges: this.charges,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.angle = data.angle || 0;
    this.whackTimer = data.whackTimer || 0;
    this.charges = data.charges || 4;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    if (!images.suture_kit) return;

    const img = images.suture_kit;

    ctx.save();
    ctx.translate(this.x, this.y);
    // In your hand: centred on the pointer
    if (this.isDragging) ctx.translate(0, img.height / 2);

    if (this.whackTimer > 0) {
      // Animation: 0.2s duration.
      const t = (0.2 - this.whackTimer) / 0.2;
      const angle = (Math.sin(t * Math.PI) * (60 * Math.PI)) / 180;
      ctx.rotate(angle);
    } else if (!this.isDragging) {
      ctx.rotate(this.angle);
    }

    ctx.drawImage(img, -img.width / 2, -img.height);

    // Draw Amount
    ctx.fillStyle = "white";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.strokeText(`${this.charges}`, 0, -img.height / 2);
    ctx.fillText(`${this.charges}`, 0, -img.height / 2);

    ctx.restore();
  }
}

// Stitch a bleeding wound shut (a click with the kit, or the surgery
// screen): it stops bleeding, and it's grateful. One use; an empty kit is
// gone. Returns true if it did.
function sutureWound(f, kit) {
  if (!f || !kit || !(f.bleedingTimer > 0) || !(kit.charges > 0)) return false;
  f.bleedingTimer = 0;
  // You fixed its owie (Affection.js)
  if (typeof giveAffection === "function") giveAffection(f, "patched");
  kit.whackTimer = 0.2;
  kit.charges--;
  if (kit.charges <= 0) {
    if (typeof removeToolFromToolbox === "function") removeToolFromToolbox(kit);
    const idx = objects.indexOf(kit);
    if (idx > -1) objects.splice(idx, 1);
    if (typeof poofs !== "undefined" && typeof Poof !== "undefined") poofs.push(new Poof(kit.x, kit.y, kit.scene));
  }
  return true;
}
