class AccessoryItem {
  constructor(scene, accessoryId) {
    this.id =
      typeof nextObjectId !== "undefined"
        ? nextObjectId++
        : Math.floor(Math.random() * 1000000);
    this.scene = scene;
    this.accessoryId = accessoryId;
    this.w = 40;
    this.h = 40;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };

    const accDef = ACCESSORY_DB[this.accessoryId];
    this.name = accDef.name;

    // Some accessories have random colors
    if (accDef.canColor) {
      const h = Math.floor(Math.random() * 360);
      const s = Math.floor(70 + Math.random() * 30);
      const l = Math.floor(40 + Math.random() * 40);
      this.color = `hsl(${h}, ${s}%, ${l}%)`;
    } else {
      this.color = null;
    }
  }

  serialize() {
    return {
      classType: "AccessoryItem",
      x: this.x,
      y: this.y,
      scene: this.scene,
      accessoryId: this.accessoryId,
      color: this.color,
    };
  }

  static deserialize(data) {
    const item = new AccessoryItem(data.scene, data.accessoryId);
    item.x = data.x;
    item.y = data.y;
    item.color = data.color;
    return item;
  }

  deserialize(data) {
    this.color = data.color;
  }

  update(dt) {
    const accDef = ACCESSORY_DB[this.accessoryId];
    let img =
      accDef && typeof images !== "undefined" ? images[accDef.imageKey] : null;
    if (img && img.complete) {
      const accScale = (accDef.scale !== undefined ? accDef.scale : 1.0) * 0.5;
      this.w = img.width * accScale;
      this.h = img.height * accScale;
    }

    if (this.isDragging) {
      if (typeof mouse !== "undefined") {
        this.x = mouse.x + this.dragOffset.x;
        this.y = mouse.y + this.dragOffset.y;

        const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
        this.y = Math.max(this.y, topWallHeight + 10);
      }
    }

    if (typeof handleGenericCageContainment !== "undefined") {
      handleGenericCageContainment(this, this.w, this.h);
    }

    this.bounds = { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  getBottomY() {
    return this.y + this.h;
  }

  hitTest(px, py) {
    return (
      px >= this.x &&
      px <= this.x + this.w &&
      py >= this.y &&
      py <= this.y + this.h
    );
  }

  onDrop() {
    if (typeof handleDropping !== "undefined" && !handleDropping(this)) {
      this.attemptEquip();
    }
  }

  attemptEquip() {
    if (typeof fluffies === "undefined") return;

    const fluffy = fluffies.find(
      (f) =>
        f.isAlive &&
        f.scene === this.scene &&
        f.hitTest(this.x + this.w / 2, this.y + this.h / 2),
    );

    if (fluffy) {
      const accDef = ACCESSORY_DB[this.accessoryId];
      if (!accDef) return;

      // Restrict ABOVE_LUMPS slot to unneutered stallions & reset timer upon application
      if (accDef.slot === "ABOVE_LUMPS") {
        const isUnneuteredStallion =
          fluffy.gender === "male" && fluffy.limbs && fluffy.limbs.lumps;
        if (!isUnneuteredStallion) {
          return;
        }
        fluffy.castrationBandTimer = CASTRATION_BAND_TIMER;
        fluffy.castrationBandPainTimer = 5.0 + Math.random() * 5.0;
      }

      if (!fluffy.accessories) fluffy.accessories = {};

      if (fluffy.accessories[accDef.slot]) {
        const oldData = fluffy.accessories[accDef.slot];
        const oldItem = new AccessoryItem(this.scene, oldData.id);
        oldItem.color = oldData.color;
        oldItem.x = fluffy.x;
        oldItem.y = fluffy.y;
        objects.push(oldItem);
      }

      fluffy.accessories[accDef.slot] = {
        id: this.accessoryId,
        color: this.color,
      };
      // A present - or something horrid (Affection.js)
      if (typeof onAccessoryGiven === "function") onAccessoryGiven(fluffy, this.accessoryId);

      const idx = objects.indexOf(this);
      if (idx > -1) objects.splice(idx, 1);

      if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
        poofs.push(new Poof(this.x, this.y, this.scene));
      }
    }
  }

  draw(ctx) {
    if (this.scene !== currentScene) return;

    const accDef = ACCESSORY_DB[this.accessoryId];
    if (!accDef) return;

    let img = images[accDef.imageKey];
    if (!img || !img.complete) return;

    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);

    const scale = (accDef.scale !== undefined ? accDef.scale : 1.0) * 0.5;
    ctx.scale(scale, scale);

    if (this.color) {
      if (!this.tintedImg) {
        this.tintedImg = tintImage(img, this.color);
      }
      ctx.drawImage(
        this.tintedImg,
        -this.tintedImg.width / 2,
        -this.tintedImg.height / 2,
      );
    } else {
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    }

    ctx.restore();
  }
}
