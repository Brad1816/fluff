const SPRINKLER_RADIUS = 500;
const SPRINKLER_WASH = 0.03; // dirt (and cage mess) washed off a second in the spray

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
      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.y = Math.max(this.y, topWallHeight + 10);
    }

    if (this.isOn) {
      this.arcPhase += dt * 5;
      this.waterTimer += dt;

      // Puts out burning fluffies within its spray
      if (typeof fluffies !== "undefined") {
        for (const f of fluffies) {
          if (
            !f.isOnFire ||
            f.scene !== this.scene ||
            f.currentCage !== this.currentCage
          )
            continue;
          const dx = f.x - this.x;
          const dy = (f.y - this.y) * 2; // Elliptical reach
          if (Math.hypot(dx, dy) < SPRINKLER_RADIUS) f.extinguishFire();
        }
      }

      // 1. Clean nearby puddles (poop, pee, blood)
      if (typeof puddles !== "undefined") {
        for (let i = puddles.length - 1; i >= 0; i--) {
          const puddle = puddles[i];
          if (
            puddle.scene === this.scene &&
            puddle.type !== "tears" &&
            puddle.type !== "water"
          ) {
            // Not tears, not water
            for (let j = puddle.points.length - 1; j >= 0; j--) {
              const pt = puddle.points[j];
              const d = Math.sqrt((this.x - pt.x) ** 2 + (this.y - pt.y) ** 2);
              if (d < SPRINKLER_RADIUS) {
                puddle.isGrowing = true;
                puddle.shrinkPoint(j, 0.5 * dt, 0, true);
              }
            }
            if (puddle.isEmpty() && puddle.type !== "blood") {
              // Don't remove the persistent blood anchor unless empty too?
              // Actually, let's remove any empty non-water/non-tear puddle.
              const idx = puddles.indexOf(puddle);
              if (idx > -1) puddles.splice(idx, 1);
            }
          }
        }
      }

      // 1b. Washes whoever's in the spray - a caged fluffy can't get away
      // from it, so the sprinkler is a cage bath (and it rinses the cage)
      for (const f of typeof fluffies !== "undefined" ? fluffies : []) {
        if (!f.isAlive || f.scene !== this.scene || f.isDragging) continue;
        if (Math.hypot(f.x - this.x, (f.y - this.y) * 2) > SPRINKLER_RADIUS) continue;
        if ((f.dirt || 0) > 0) f.dirt = Math.max(0, f.dirt - SPRINKLER_WASH * dt);
        if (typeof soakFluffy === "function") soakFluffy(f, 0.8); // (WetFur.js)
        if (f.currentCage && typeof startFright === "function" && typeof fearOf === "function" && fearOf(f, "bath") >= FEAR_MIN && !(f._sprinkledAt > timePlayed - 30)) {
          f._sprinkledAt = timePlayed;
          startFright(f, "bath");
        }
      }
      for (const o of typeof objects !== "undefined" ? objects : []) {
        if (!(typeof Cage !== "undefined" && o instanceof Cage) || o.scene !== this.scene || !(o.mess > 0)) continue;
        if (Math.hypot(o.x - this.x, (o.bounds.bottom - this.y) * 2) > SPRINKLER_RADIUS + 60) continue;
        o.mess = Math.max(0, o.mess - SPRINKLER_WASH * 1.5 * dt);
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

    addPointToPuddle(this.scene, pX, pY, "water", 5 / 200, 20 / 200, 0.1);
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
