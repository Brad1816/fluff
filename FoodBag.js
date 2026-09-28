class FoodBag {
  constructor(type, scene = "INDOORS") {
    this.id = nextObjectId++;
    this.type = type; // 'formula', 'kibble', 'sketties'
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.amount = 5;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.fillTimer = 0;
    this.jiggleTimer = 0;
  }

  update(dt) {
    if (this.jiggleTimer > 0) {
      this.jiggleTimer -= dt;
    }
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.y = Math.max(this.y, topWallHeight + 10);

      this.fillTimer -= dt;
      if (this.fillTimer <= 0) {
        if (this.attemptFill()) {
          this.fillTimer = 0.25;
          this.jiggleTimer = 0.2;
        }
      }
    }

    if (images.food_bag) {
      handleGenericCageContainment(
        this,
        images.food_bag.width,
        images.food_bag.height,
      );
    }
  }

  attemptFill() {
    if (this.amount <= 0) return false;
    if (typeof objects === "undefined") return false;

    const bowls = objects.filter((o) => o instanceof Bowl);
    for (const bowl of bowls) {
      if (bowl.scene !== this.scene) continue;

      // Use hitTest or check bounds
      if (bowl.hitTest(mouse.x, mouse.y)) {
        // Attempt fill
        let filled = false;
        if (bowl.type === "trough" || bowl.type === "mega_feeder") {
          const space = bowl.maxFood - bowl.food;
          if (space > 0) {
            const available = this.amount * 5;
            const toAdd = space;
            if (bowl.fill(toAdd, this.type)) {
              this.amount -= toAdd / 5.0;
              filled = true;
            }
          }
        } else {
          if (bowl.fill(5, this.type)) {
            this.amount--;
            filled = true;
          }
        }

        if (filled) return true;
      }
    }
    return false;
  }

  onDrop() {
    if (!handleDropping(this)) {
      // If didn't transition scenes, try to combine
      this.combineWithNearby();
    }
  }

  combineWithNearby() {
    if (typeof objects === "undefined") return;

    const nearbyBag = objects.find(
      (obj) =>
        obj !== this &&
        obj instanceof FoodBag &&
        obj.type === this.type &&
        obj.scene === this.scene &&
        Math.sqrt((obj.x - this.x) ** 2 + (obj.y - this.y) ** 2) < 250,
    );

    if (nearbyBag) {
      nearbyBag.amount += this.amount;
      const idx = objects.indexOf(this);
      if (idx > -1) objects.splice(idx, 1);
      if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
        poofs.push(new Poof(this.x, this.y, this.scene));
      }
      return true;
    }
    return false;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  getBottomY() {
    return this.y;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  serialize() {
    return {
      classType: "FoodBag",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      type: this.type,
      amount: this.amount,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.amount = data.amount || 5;
  }

  drawOffScreen(ctx) {
    if (!images.food_bag) return;

    const img = images.food_bag;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.jiggleTimer > 0) {
      const t = (0.2 - this.jiggleTimer) / 0.2;
      const jiggleAngle = (Math.sin(t * Math.PI) * (30 * Math.PI)) / 180;
      ctx.rotate(jiggleAngle);
    }

    ctx.drawImage(img, -img.width / 2, -img.height);

    // Draw Text
    ctx.fillStyle = "black";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.lineWidth = 1;

    let label = "";
    if (this.type === "formula") label = "Formula";
    else if (this.type === "kibble") label = "Kibble";
    else if (this.type === "sketties") label = "Sketties";
    else if (this.type === "soylent_brown") label = "Soylent Brown";
    else if (this.type === "rat_poison") label = "Rat Poison";

    ctx.fillText(label, 2, -img.height / 2);
    // Draw Amount
    ctx.font = "10px Arial";
    ctx.strokeText(`${Math.ceil(this.amount)}`, 0, -img.height / 2 + 12);
    ctx.fillText(`${Math.ceil(this.amount)}`, 0, -img.height / 2 + 12);

    ctx.restore();
  }
}
