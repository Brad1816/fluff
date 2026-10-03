// How fast grass grows back (game seconds for one bite's worth) and spreads
const GRASS_REGROW = 240; // (was 120: twice as slow now)
const GRASS_SPREAD_EVERY = 45;

class Grass {
  constructor(x, y, scene = "OUTDOORS", growth = 0.0) {
    this.id = nextObjectId++;
    this.x = x;
    this.y = y;
    this.scene = scene;
    this.growth = growth;
    this.spawnTimer = 0;
    this.isDragging = false;
    this.currentCage = null;
    this.isDestroyed = false;
  }

  serialize() {
    return {
      classType: "Grass",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      growth: this.growth,
      spawnTimer: this.spawnTimer,
    };
  }

  deserialize(data) {
    this.id = data.id;
    this.growth = data.growth !== undefined ? data.growth : 0.0;
    this.spawnTimer = data.spawnTimer || 0;
  }

  hasFood() {
    return this.growth > 0;
  }

  eat() {
    if (this.growth > 0) {
      this.growth = Math.max(0, this.growth - 1);
      if (typeof poofs !== "undefined") {
        poofs.push(new Poof(this.x, this.y, this.scene, "green"));
      }
      if (this.growth <= 0) {
        this.isDestroyed = true;
      }
      return true;
    }
    return false;
  }

  get foodType() {
    return "grass";
  }

  get priority() {
    return 2;
  }

  getBottomY() {
    return this.y;
  }

  hitTest(px, py) {
    return false;
  }

  update(dt) {
    // grows from 0 to 2, by 1 every GRASS_REGROW game seconds
    // Faster in spring and in the rain, hardly at all in winter (WorldTime.js)
    const season = typeof growthMultiplier === "function" ? growthMultiplier("grass") : 1;
    this.growth = Math.min(2, this.growth + (dt / GRASS_REGROW) * season);

    // In the park, grass only grows back in meadows (ParkLife.js does that)
    if (typeof PARK_SCENE !== "undefined" && this.scene === PARK_SCENE) return;

    // Grass will occasionally spawn extra grass at 0.2 growth
    // if there are fewer than 5 grass in a radius around it
    if (this.growth >= 0.4) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= GRASS_SPREAD_EVERY) {
        this.spawnTimer = 0;
        const radius = 200;

        // Get other grass in the same scene and within radius
        if (typeof objects !== "undefined") {
          const nearbyGrass = objects.filter(
            (o) =>
              o instanceof Grass &&
              o.scene === this.scene &&
              Math.sqrt((o.x - this.x) ** 2 + (o.y - this.y) ** 2) <= radius,
          );

          if (nearbyGrass.length < 3) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 80;
            const newX = Math.max(
              50,
              Math.min(width - 50, this.x + Math.cos(angle) * dist),
            );
            const newY = Math.max(
              height * 0.15 + 50,
              Math.min(height - 50, this.y + Math.sin(angle) * dist),
            );

            const newGrass = new Grass(newX, newY, this.scene, 0.2);
            objects.push(newGrass);
            if (typeof poofs !== "undefined") {
              poofs.push(new Poof(newX, newY, this.scene, "green"));
            }
          }
        }
      }
    } else {
      this.spawnTimer = 0;
    }
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = images.grass;
    if (!img || img.width === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Flip grass depending on if x coordinate of grass rounded to whole number is even or odd
    const roundedX = Math.round(this.x);
    if (Math.abs(roundedX) % 2 !== 0) {
      ctx.scale(-1, 1);
    }

    // Grass size determined by growth
    const scale = this.growth / 2.0;
    if (scale > 0) {
      ctx.drawImage(
        img,
        (-img.width / 2) * scale,
        -img.height * scale,
        img.width * scale,
        img.height * scale,
      );
    }
    ctx.restore();
  }
}
