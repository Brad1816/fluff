// Blowtorch: hold the mouse down while it's equipped to shoot a horizontal
// flame from its nozzle. Holding the flame's tip on a fluffy sets it on fire.
class Blowtorch {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0; // Center of the image
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.angle = 0;
    this.isFiring = false;
    this.flameTime = 0;
    this.burnTarget = null;
    this.burnTime = 0;
  }

  // The image is centered on (x, y)
  getImageTopLeft() {
    const img = images.blowtorch;
    const w = img ? img.width : 40;
    const h = img ? img.height : 70;
    return { x: this.x - w / 2, y: this.y - h / 2 };
  }

  // Where the flame comes out: 7px down from the image's top-left
  getNozzle() {
    const tl = this.getImageTopLeft();
    return { x: tl.x, y: tl.y + BLOWTORCH_NOZZLE_OFFSET_Y };
  }

  // End of the flame, which points left from the nozzle
  getFlameTip() {
    const n = this.getNozzle();
    return { x: n.x - BLOWTORCH_FLAME_LENGTH, y: n.y };
  }

  // Fluffy the flame tip is touching
  getTargetFluffy() {
    if (typeof fluffies === "undefined") return null;
    const tip = this.getFlameTip();
    for (let i = fluffies.length - 1; i >= 0; i--) {
      const f = fluffies[i];
      if (f.scene !== this.scene || !f.isAlive) continue;
      if (f.currentCage instanceof FoalInACan) continue;
      if (f.hitTest(tip.x, tip.y)) return f;
    }
    return null;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      const topWallHeight = height * 0.15;
      this.y = Math.max(this.y, topWallHeight + 10);
      this.isFiring = !!mouse.down && !mouse.rightDown;
    } else {
      this.isFiring = false;
    }

    if (this.isFiring) {
      this.flameTime += dt;
      const target = this.getTargetFluffy();
      if (target !== this.burnTarget) {
        this.burnTarget = target;
        this.burnTime = 0;
      }
      if (target) {
        this.burnTime += dt;
        if (this.burnTime >= BLOWTORCH_IGNITE_TIME && !target.isOnFire) {
          target.igniteFire();
          // It (and anyone watching) knows who did it (Memory.js)
          if (target.isOnFire && typeof notifyViolence === "function") notifyViolence(target, false, "blowtorch");
        }
      }
    } else {
      this.burnTarget = null;
      this.burnTime = 0;
    }

    // Blowtorches cannot be captured in cages
    this.currentCage = null;
  }

  onDrop() {
    this.isFiring = false;
    this.burnTarget = null;
    this.burnTime = 0;
    this.currentCage = null;
    return handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  hitTest(px, py) {
    const img = images.blowtorch;
    if (!img) return false;
    const tl = this.getImageTopLeft();
    return (
      px >= tl.x &&
      px <= tl.x + img.width &&
      py >= tl.y &&
      py <= tl.y + img.height
    );
  }

  getBottomY() {
    const img = images.blowtorch;
    return this.y + (img ? img.height : 70) / 2;
  }

  serialize() {
    return {
      classType: "Blowtorch",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      currentCageId: null,
    };
  }

  deserialize(data) {
    this.isFiring = false;
    this.burnTarget = null;
    this.currentCage = null;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = images.blowtorch;
    if (!img) return;
    const tl = this.getImageTopLeft();
    if (this.isFiring) {
      // Horizontal flame from the nozzle to the tip
      const nozzle = this.getNozzle();
      drawFlame(
        ctx,
        nozzle.x,
        nozzle.y,
        BLOWTORCH_FLAME_LENGTH,
        12,
        Math.PI,
        this.flameTime,
      );
    }
    ctx.drawImage(img, tl.x, tl.y);
  }
}
