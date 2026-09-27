class TrashBag {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;

    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.angle = 0;
    this.fillAmount = 0; // max capacity 5.0
    this.grabTimer = 0;
    this.whackTimer = 0;
    this.storedItems = [];
  }

  update(dt) {
    if (this.whackTimer > 0) {
      this.whackTimer -= dt;
    }
    if (this.grabTimer > 0) {
      this.grabTimer -= dt;
    }

    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const topWallHeight = height * 0.15;
      this.y = Math.max(this.y, topWallHeight + 10);

      // Auto grab corpses and parts nearby if not full
      if (this.fillAmount < 5.0 && this.grabTimer <= 0) {
        if (this.attemptGrabNearby()) {
          this.grabTimer = 0.25;
          this.whackTimer = 0.2;
        }
      }
    }

    // Auto empty into grinder if filled (fillAmount >= 5.0)
    if (this.fillAmount >= 5.0) {
      this.checkAutoEmpty();
    }

    const img = this.getCurrentImage();
    if (img) {
      handleGenericCageContainment(this, img.width, img.height);
    }
  }

  attemptGrabNearby() {
    if (typeof fluffies === "undefined" || typeof gibs === "undefined")
      return false;

    const grabRadius = 70;
    let grabbedValueThisTick = 0;
    let grabbedSomething = false;

    // Check fluffy corpses
    for (let i = fluffies.length - 1; i >= 0; i--) {
      if (grabbedValueThisTick >= 1.0) break;
      const f = fluffies[i];
      if (f.scene !== this.scene) continue;
      if (f.isAlive || f.isDestroyed) continue;
      if (
        f.currentCage &&
        typeof FoalInACan !== "undefined" &&
        f.currentCage instanceof FoalInACan
      )
        continue;

      const dist = Math.hypot(
        this.x - f.x,
        this.y - (f.getBottomY ? f.getBottomY() : f.y),
      );
      if (dist < grabRadius) {
        const val =
          typeof calculateTrashBagGrowthValue === "function"
            ? calculateTrashBagGrowthValue(f)
            : f.growth || 1.0;

        this.fillAmount += val;
        this.storedItems.push({
          itemType: "fluffy",
          data: f.serialize(),
        });

        if (f.isDragging && typeof isGlobalDragging !== "undefined") {
          f.isDragging = false;
          isGlobalDragging = false;
        }
        if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
          poofs.push(new Poof(f.x, f.y, f.scene));
        }
        fluffies.splice(i, 1);
        if (typeof relationships !== "undefined" && relationships[f.id]) {
          delete relationships[f.id];
        }

        grabbedValueThisTick += val;
        grabbedSomething = true;
      }
    }

    // Check gibs
    for (let i = gibs.length - 1; i >= 0; i--) {
      if (grabbedValueThisTick >= 1.0) break;
      const g = gibs[i];
      if (g.scene !== this.scene) continue;
      if (g.shouldDespawn || g.grinder || g.isDragging) continue;

      const dist = Math.hypot(this.x - g.x, this.y - g.y);
      if (dist < grabRadius) {
        const val =
          typeof calculateTrashBagGrowthValue === "function"
            ? calculateTrashBagGrowthValue(g)
            : g.growthValue || 0.1;

        this.fillAmount += val;
        this.storedItems.push({
          itemType: "gib",
          data: g.serialize(),
        });

        if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
          poofs.push(new Poof(g.x, g.y, g.scene));
        }
        gibs.splice(i, 1);

        grabbedValueThisTick += val;
        grabbedSomething = true;
      }
    }

    if (grabbedSomething && typeof playSound === "function") {
      playSound("fluffy_move");
    }

    return grabbedSomething;
  }

  checkAutoEmpty() {
    if (typeof objects === "undefined") return;
    const grinders = objects.filter(
      (o) => o instanceof Grinder && o.scene === this.scene && !o.isDragging,
    );
    for (const grinder of grinders) {
      const g = grinder.bounds;
      if (
        this.x > g.left &&
        this.x < g.right &&
        this.y > g.top &&
        this.y < g.bottom
      ) {
        this.emptyIntoGrinder(grinder);
        return;
      }
    }
  }

  emptyIntoGrinder(grinder) {
    if (!grinder || this.fillAmount <= 0) return;

    if (this.storedItems && this.storedItems.length > 0) {
      for (const item of this.storedItems) {
        if (item.itemType === "fluffy" && typeof Horse !== "undefined") {
          const f = Horse.deserialize(item.data);
          f.x = grinder.x;
          f.y = grinder.y;
          f.scene = grinder.scene;
          if (typeof fluffies !== "undefined") {
            f.explode(grinder);
          }
        } else if (item.itemType === "gib" && typeof Gib !== "undefined") {
          const g = Gib.deserialize(item.data);
          const h =
            typeof images !== "undefined" && images.grinder
              ? images.grinder.height * grinder.scale
              : 100;
          g.x = grinder.x + (Math.random() - 0.5) * h * 0.5;
          g.y = grinder.y - 50;
          g.scene = grinder.scene;
          g.grinder = grinder;
          g.freeGib = false;
          g.isRoadkill = false;
          g.roadkillFloorY = null;
          g.bounds = grinder.gibBounds();
          g.vx = (Math.random() - 0.5) * 200;
          g.vy = -100 - Math.random() * 200;
          if (typeof gibs !== "undefined") {
            gibs.push(g);
          }
        }
      }
    } else {
      grinder.addGrowth(this.fillAmount);
    }

    this.isDragging = false;
    if (typeof isGlobalDragging !== "undefined") isGlobalDragging = false;
    if (typeof removeToolFromToolbox === "function") {
      removeToolFromToolbox(this);
    }
    const idx = typeof objects !== "undefined" ? objects.indexOf(this) : -1;
    if (idx > -1) objects.splice(idx, 1);
    if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
      poofs.push(new Poof(this.x, this.y, this.scene));
    }
    if (typeof playSound === "function") playSound("fluffy_move");
  }

  onDrop() {
    this.angle = Math.random() * Math.PI;
    return handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  getCurrentImage() {
    if (typeof images === "undefined") return null;
    if (this.fillAmount >= 5.0)
      return images.trash_bag_full || images.trash_bag_empty;
    if (this.fillAmount > 0)
      return images.trash_bag_partially_full || images.trash_bag_empty;
    return images.trash_bag_empty;
  }

  hitTest(px, py) {
    const img = this.getCurrentImage();
    if (!img) return false;
    const w = img.width;
    const h = img.height;

    const dx = px - this.x;
    const dy = py - this.y;

    let angle = 0;
    if (this.whackTimer > 0) {
      const t = (0.2 - this.whackTimer) / 0.2;
      angle = (Math.sin(t * Math.PI) * (30 * Math.PI)) / 180;
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
      classType: "TrashBag",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      angle: this.angle,
      fillAmount: this.fillAmount,
      whackTimer: this.whackTimer,
      storedItems: JSON.parse(JSON.stringify(this.storedItems)),
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.angle = data.angle || 0;
    this.fillAmount = data.fillAmount || 0;
    this.whackTimer = data.whackTimer || 0;
    this.storedItems = data.storedItems || [];
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = this.getCurrentImage();
    if (!img) return;

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
