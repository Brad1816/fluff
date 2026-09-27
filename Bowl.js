class Bowl {
  constructor(type = "bowl", scene = "INDOORS") {
    this.id = nextObjectId++;
    this.type = type; // 'bowl', 'feeder', 'mega_feeder', or 'trough'
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.food = 0;
    this.maxFood = type === "trough" || type === "mega_feeder" ? 25 : 5;
    this.foodType = null; // 'kibble', 'sketties', 'formula'
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }

  get priority() {
    if (typeof getFoodPriority !== "undefined") {
      return getFoodPriority(this.foodType);
    }
    const priorities = {
      sketties: 3,
      kibble: 2,
      rat_poison: 2,
      formula: 2,
      soylent_brown: 1,
    };
    return this.foodType && priorities[this.foodType] !== undefined
      ? priorities[this.foodType]
      : 2;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const topWallHeight = height * 0.15;
      this.y = Math.max(this.y, topWallHeight + 10);
    }

    const img = this.getImage();

    if (img) {
      handleGenericCageContainment(this, img.width, img.height);
    }
  }

  getImage() {
    let img = images.bowl;
    if (this.type === "feeder") img = images.baby_feeder;
    else if (this.type === "mega_feeder") img = images.mega_baby_feeder;
    else if (this.type === "trough") img = images.trough;
    return img;
  }

  onDrop() {
    handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  hitTest(px, py) {
    const img = this.getImage();
    const w = img.width;
    const h = img.height;
    return (
      px >= this.x - w / 2 &&
      px <= this.x + w / 2 &&
      py >= this.y - h &&
      py <= this.y
    );
  }

  fill(amount, foodType) {
    // Validation
    if (this.type === "feeder" || this.type === "mega_feeder") {
      if (foodType !== "formula") return false;
    } else {
      // Bowl or Trough
      if (foodType === "formula") return false;
    }

    // If not empty, check if types match
    if (this.food > 0 && this.foodType !== foodType) {
      this.food = 0;
    }

    if (this.food >= this.maxFood) return false;

    this.foodType = foodType;
    this.food = Math.min(this.maxFood, this.food + amount);
    return true;
  }

  addFood() {
    // Legacy/Debug method
    if (this.type === "feeder") this.fill(5, "formula");
    else if (this.type === "mega_feeder") this.fill(25, "formula");
    else if (this.type === "trough") this.fill(25, "kibble");
    else this.fill(5, "kibble");
  }

  hasFood() {
    return this.food > 0;
  }

  eat() {
    if (this.food > 0) {
      this.food--;
      if (this.food <= 0) {
        this.foodType = null;
      }
      return true;
    }
    return false;
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return {
      classType: "Bowl",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      type: this.type,
      food: this.food,
      maxFood: this.maxFood,
      foodType: this.foodType,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    this.food = data.food || 0;
    this.maxFood =
      data.maxFood ||
      (data.type === "trough" || data.type === "mega_feeder" ? 25 : 5);
    this.foodType = data.foodType || null;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    let img = null;

    if (this.type === "feeder") {
      if (this.food > 2 && images.formula_baby_feeder) {
        img = images.formula_baby_feeder;
      } else if (0 < this.food && this.food <= 2) {
        img = images.formula_half_baby_feeder;
      } else {
        img = images.baby_feeder;
      }
    } else if (this.type === "mega_feeder") {
      if (this.food > 13 && images.mega_formula_baby_feeder) {
        img = images.mega_formula_baby_feeder;
      } else if (0 < this.food && this.food <= 13) {
        img = images.mega_half_formula_baby_feeder;
      } else {
        img = images.mega_baby_feeder;
      }
    } else if (this.type === "trough") {
      if (this.food == 0) {
        img = images.trough;
      } else if (this.foodType === "rat_poison" && this.food > 0) {
        img = images.rat_poison_trough;
      } else if (this.foodType === "soylent_brown" && this.food > 0) {
        img = images.soylent_brown_trough;
      } else if (this.foodType === "kibble" && this.food > 13) {
        img = images.kibble_trough;
      } else if (
        this.foodType === "kibble" &&
        this.food < 14 &&
        this.food > 0
      ) {
        img = images.kibble_half_trough;
      } else if (this.foodType === "sketties" && this.food > 13) {
        img = images.sketties_trough;
      } else {
        img = images.sketties_half_trough;
      }
    } else {
      // Bowl
      if (this.food == 0) {
        img = images.bowl;
      } else if (this.foodType === "rat_poison" && this.food > 0) {
        img = images.rat_poison_bowl;
      } else if (this.foodType === "soylent_brown" && this.food > 0) {
        img = images.soylent_brown_bowl;
      } else if (this.foodType === "kibble" && this.food > 2) {
        img = images.kibble_bowl;
      } else if (this.foodType === "kibble" && this.food < 3 && this.food > 0) {
        img = images.kibble_half_bowl;
      } else if (this.foodType === "sketties" && this.food > 2) {
        img = images.sketties_bowl;
      } else {
        img = images.sketties_half_bowl;
      }
    }

    if (!img) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
