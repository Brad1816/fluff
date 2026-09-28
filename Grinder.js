class Grinder {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.angle = 0;
    this.maxSpeed = 15; // Radians per second
    this.currentSpeed = 0;
    this.acceleration = 10;
    this.scale = 1.0;
    this.bounds = { left: 0, right: 0, top: 0, bottom: 0, isGrinder: true };
    this.x = (width * 5) / 6;
    this.y = height / 2;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.totalGrowth = 0;
  }

  addGrowth(amount) {
    this.totalGrowth += amount;
    while (this.totalGrowth >= 1.0) {
      this.totalGrowth -= 1.0;
      if (typeof objects !== "undefined" && typeof FoodBag !== "undefined") {
        const bag = new FoodBag("soylent_brown", this.scene);
        bag.setPosition(
          this.x + (Math.random() - 0.5) * 50,
          this.y + 50 + (Math.random() - 0.5) * 50,
        );
        objects.push(bag);
        bag.combineWithNearby();

        if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
          poofs.push(new Poof(this.x, this.y, this.scene));
        }
      }
    }
  }

  hitTestBounds() {
    const img = images.grinder;
    const w = img.width * this.scale;
    const h = img.height * this.scale;
    return {
      left: this.x - w / 2,
      right: this.x + w / 2,
      top: this.y - h / 2,
      bottom: this.y + h / 2,
    };
  }

  gibBounds() {
    const img = images.grinder;
    const w = img.width * this.scale;
    const h = img.height * this.scale;
    return {
      left: this.x - w / 2,
      right: this.x + w / 2,
      top: this.y - h / 2,
      bottom: this.y,
      isGrinder: true,
    };
  }

  update(dt) {
    if (!images.grinder || !images.grinder_blade) return;

    const img = images.grinder;
    const w = img.width * this.scale;
    const h = img.height * this.scale;

    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      // Simple boundary clamping
      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.x = clamp(this.x, w / 2, sceneW(this.scene) - w / 2);
      this.y = clamp(this.y, topWallHeight + h / 2 + 5, sceneH(this.scene) - h / 2);
    }

    // Hit Test Bounds
    this.bounds = this.hitTestBounds();

    // Blade spin logic
    let shouldSpin = false;
    if (typeof fluffies !== "undefined") {
      for (const f of fluffies) {
        if (f.isDragging && f.scene === this.scene) {
          const dist = Math.sqrt(
            (mouse.x - this.x) ** 2 + (mouse.y - this.y) ** 2,
          );
          if (dist < 200) {
            shouldSpin = true;
            break;
          }
        }
      }

      for (const gib of gibs) {
        if (gib.isDragging && gib.scene === this.scene) {
          const dist = Math.sqrt(
            (mouse.x - this.x) ** 2 + (mouse.y - this.y) ** 2,
          );
          if (dist < 200) {
            shouldSpin = true;
            break;
          }
        }
      }
    }

    // Also spin if gibs inside
    if (!shouldSpin && typeof gibs !== "undefined") {
      for (const gib of gibs) {
        if (gib.grinder === this) {
          shouldSpin = true;
          break;
        }
      }
    }

    if (shouldSpin) {
      this.currentSpeed += this.acceleration * dt;
      if (this.currentSpeed > this.maxSpeed) this.currentSpeed = this.maxSpeed;
    } else {
      this.currentSpeed -= this.acceleration * dt;
      if (this.currentSpeed < 0) this.currentSpeed = 0;
    }

    this.angle += this.currentSpeed * dt;
  }

  onDrop() {
    handleDropping(this);
  }

  getBottomY() {
    if (!images.grinder) return this.y;
    return this.y + (images.grinder.height * this.scale) / 2;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  serialize() {
    return {
      classType: "Grinder",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      angle: this.angle,
      currentSpeed: this.currentSpeed,
      totalGrowth: this.totalGrowth,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.angle = data.angle || 0;
    this.currentSpeed = data.currentSpeed || 0;
    this.totalGrowth = data.totalGrowth || 0;
  }

  drawOffScreen(ctx) {
    if (!images.grinder || !images.grinder_blade) return;

    const img = images.grinder;
    const blade = images.grinder_blade;
    const w = img.width * this.scale;
    const h = img.height * this.scale;
    const bw = blade.width * this.scale * 0.5;
    const bh = blade.height * this.scale * 0.5;

    ctx.save();
    ctx.translate(this.x, this.y);

    // 1. Draw 5 Blades behind
    const bladeOffsets = [-w * 0.4, -w * 0.2, 0, w * 0.2, w * 0.4];
    for (const ox of bladeOffsets) {
      ctx.save();
      ctx.translate(ox, -h / 2.5);
      ctx.rotate(this.angle + ox); // Slight offset in rotation for variety
      ctx.drawImage(blade, -bw / 2, -bh / 2, bw, bh);
      ctx.restore();
    }

    ctx.restore(); // Restore from main translate(this.x, this.y) to draw gibs in global space

    if (window.drawGibsForGrinder) {
      window.drawGibsForGrinder(ctx, this);
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // 2. Draw Main Housing
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    ctx.restore();
  }
}
