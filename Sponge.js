class Sponge {
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
    this.cleanTimer = 0;
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

      this.cleanTimer -= dt;
      if (this.cleanTimer <= 0) {
        if (this.attemptClean()) {
          this.cleanTimer = 0.25;
          this.whackTimer = 0.2;
        }
      }
    }

    if (images.sponge) {
      handleGenericCageContainment(
        this,
        images.sponge.width,
        images.sponge.height,
      );
    }
  }

  attemptClean() {
    let cleanedSomething = false;

    // 0. Bath time: rubbing a fluffy (Bath.js)
    if (typeof spongeFluffy === "function" && spongeFluffy(this)) return true;

    // 1. Check Puddles
    if (typeof puddles !== "undefined") {
      const baseA = 200;
      const baseB = 100;

      for (const puddle of puddles) {
        if (puddle.scene !== this.scene) continue;
        for (let j = puddle.points.length - 1; j >= 0; j--) {
          const p = puddle.points[j];
          const a = baseA * Math.max(0.2, p.scale);
          const b = baseB * Math.max(0.2, p.scale);

          if (a <= 0 || b <= 0) continue;

          const normalizedDist =
            Math.pow(this.x - p.x, 2) / (a * a) +
            Math.pow(this.y - p.y, 2) / (b * b);

          if (normalizedDist <= 1) {
            p.scale -= 0.1;
            if (p.targetScale) p.targetScale = Math.min(p.targetScale, p.scale);
            if (p.scale < 0.1) {
              puddle.points.splice(j, 1);
            }
            cleanedSomething = true;
            break;
          }
        }
        if (cleanedSomething) break;
      }
    }

    // 2. Check Litterboxes & LitterpalBoxes
    if (!cleanedSomething && typeof objects !== "undefined") {
      const cleanables = objects.filter(
        (o) => o instanceof Litterbox || o instanceof LitterpalBox,
      );
      for (const lb of cleanables) {
        if (lb.scene === this.scene && lb.uses > 0) {
          let hit = false;
          if (lb instanceof Litterbox) {
            const lbExtents = lb.getExtents();
            hit =
              this.x >= lbExtents.left &&
              this.x <= lbExtents.right &&
              this.y >= lbExtents.top &&
              this.y <= lbExtents.bottom;
          } else if (lb instanceof LitterpalBox) {
            hit = lb.hitTest(this.x, this.y);
          }

          if (hit) {
            lb.uses = 0; // Clean all uses at once
            cleanedSomething = true;
            break;
          }
        }
      }
    }

    return cleanedSomething;
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
    if (!images.sponge) return false;
    const img = images.sponge;
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
      classType: "Sponge",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      angle: this.angle,
      whackTimer: this.whackTimer,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.angle = data.angle || 0;
    this.whackTimer = data.whackTimer || 0;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    if (!images.sponge) return;

    const img = images.sponge;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.whackTimer > 0) {
      const t = (0.2 - this.whackTimer) / 0.2;
      const angle = (Math.sin(t * Math.PI) * (30 * Math.PI)) / 180;
      ctx.rotate(angle);
    } else if (!this.isDragging) {
      ctx.rotate(this.angle);
    }

    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
