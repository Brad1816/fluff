const SPRINKLER_RADIUS = 500;

class Sprinkler {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = width / 2;
    this.y = height / 2;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.isOn = false;
    this.waterTimer = 0;
    this.arcPhase = 0;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      const topWallHeight = height * 0.15;
      this.y = Math.max(this.y, topWallHeight + 10);
    }

    if (this.isOn) {
      this.arcPhase += dt * 5;
      this.waterTimer += dt;

      // 1. Clean nearby puddles (poop, pee, blood)
      if (typeof puddles !== "undefined") {
        for (let i = puddles.length - 1; i >= 0; i--) {
          const puddle = puddles[i];
          if (
            puddle.scene === this.scene &&
            puddle.color !== "rgba(180, 180, 180, 0.25)" &&
            puddle.color !== "rgba(100, 150, 255, 0.3)"
          ) {
            // Not tears, not water
            for (let j = puddle.points.length - 1; j >= 0; j--) {
              const pt = puddle.points[j];
              const d = Math.sqrt((this.x - pt.x) ** 2 + (this.y - pt.y) ** 2);
              if (d < SPRINKLER_RADIUS) {
                if (pt.scale) pt.scale = Math.max(0, pt.scale - 0.5 * dt);
                if (pt.targetScale)
                  pt.targetScale = Math.max(0, pt.targetScale - 0.5 * dt);

                puddle.isGrowing = true;

                if (pt.scale <= 0) {
                  puddle.points.splice(j, 1);
                }
              }
            }
            if (puddle.points.length === 0 && puddle.color !== "#8a0303") {
              // Don't remove the persistent blood anchor unless empty too?
              // Actually, let's remove any empty non-water/non-tear puddle.
              const idx = puddles.indexOf(puddle);
              if (idx > -1) puddles.splice(idx, 1);
            }
          }
        }
      }

      // 2. Spawn water puddles
      if (this.waterTimer > 0.5) {
        this.spawnWater();
        this.waterTimer = 0;
      }
    }
  }

  spawnWater() {
    // Random point within arcs
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * (SPRINKLER_RADIUS - 50);
    const pX = this.x + Math.cos(angle) * dist;
    const pY = this.y + Math.sin(angle) * dist * 0.5; // Elliptical reach

    const color = "rgba(100, 150, 255, 0.3)";
    addPointToPuddle(this.scene, pX, pY, color, 5 / 200, 20 / 200, 0.1);
  }

  onDrop() {
    return handleDropping(this);
  }

  hitTest(px, py) {
    const w = 40,
      h = 40;
    return (
      px >= this.x - w / 2 &&
      px <= this.x + w / 2 &&
      py >= this.y - h &&
      py <= this.y
    );
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return {
      classType: "Sprinkler",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      isOn: this.isOn,
      waterTimer: this.waterTimer,
      arcPhase: this.arcPhase,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.isOn = data.isOn || false;
    this.waterTimer = data.waterTimer || 0;
    this.arcPhase = data.arcPhase || 0;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = this.isOn ? images.sprinkler_on : images.sprinkler_off;
    if (!img) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Draw Arcs
    if (this.isOn) {
      let arcCount = 8;
      for (let i = 0; i < arcCount; i++) {
        const angle = this.arcPhase + (i * Math.PI) / (arcCount / 2);
        const tx = Math.cos(angle) * SPRINKLER_RADIUS;
        const ty = Math.sin(angle) * (SPRINKLER_RADIUS * 0.5) - 20;

        const grad = ctx.createLinearGradient(0, -20, tx, ty);
        grad.addColorStop(0, "rgba(150, 200, 255, 0.8)");
        grad.addColorStop(1, "rgba(150, 200, 255, 0.1)");
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.moveTo(-2.5, -20);
        ctx.quadraticCurveTo(tx / 2 - 2.5, ty - 100, tx - 10, ty);
        ctx.lineTo(tx + 40, ty);
        ctx.quadraticCurveTo(tx / 2 + 2.5, ty - 100, 2.5, -20);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
