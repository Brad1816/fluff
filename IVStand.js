const IV_SPARES_MAX = 3; // spare bags an IV stand holds

// The shop price of a bag of this kind (globals.js SPAWN_ACTIONS)
function ivBagPrice(type) {
  const a = typeof SPAWN_ACTIONS !== "undefined" ? SPAWN_ACTIONS.find((x) => x.isItem === "iv_bag" && x.bagType === type) : null;
  return a ? a.cost : 200;
}

class IVStand {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = width / 2;
    this.y = height / 2;
    this.w = 50;
    this.h = 150;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.bounds = { left: 0, right: 0, top: 0, bottom: 0 };
    this.connectedFluffy = null;
    this.attachedBag = null;
    this.isConnecting = false;
    this.maxCordLength = 300;
    this.autoRefill = false; // buys a new bag of the same kind when one runs out
    this.spares = []; // [{ type, charges }] bags waiting to go up next
  }

  // ---- Keeping the drip going ----
  // Spare bags: drop a bag on a stand that already has one of the same kind
  // and it waits (IV_SPARES_MAX); when the hanging bag runs dry the next one
  // goes up and the fluffy stays on the line. Auto-refill (right-click the
  // AUTO tag on the pole): with no spare left, it buys one at the shop price.

  // A bag of the same kind dropped on it: keep it as a spare. True if kept.
  addSpare(bag) {
    if (!this.attachedBag || !bag || bag.type !== this.attachedBag.type) return false;
    if (this.spares.length >= IV_SPARES_MAX) {
      if (typeof addUIMessage === "function") addUIMessage(`The IV stand holds ${IV_SPARES_MAX} spare bags at most.`);
      return false;
    }
    this.spares.push({ type: bag.type, charges: bag.charges });
    return true;
  }

  // The hanging bag has run dry: put up the next one. True if it did.
  replaceEmptyBag(oldBag) {
    const type = oldBag.type;
    let charges = null;
    const i = this.spares.findIndex((b) => b.type === type);
    let paid = 0;
    if (i >= 0) charges = this.spares.splice(i, 1)[0].charges;
    else if (this.autoRefill) {
      const price = ivBagPrice(type);
      const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
      if (!free && money < price) {
        if (!this._toldNoMoney && typeof addUIMessage === "function") addUIMessage(`The IV stand couldn't buy a new ${type.toUpperCase()} bag ($${price}): not enough money.`);
        this._toldNoMoney = true;
        return false;
      }
      if (!free) money -= price;
      paid = price;
      charges = 1000;
    } else return false;
    this._toldNoMoney = false;
    const bag = new IVBag(this.scene, type);
    bag.charges = charges;
    bag.attachedTo = this;
    bag.x = this.x;
    bag.y = this.y - this.h / 2 + 25;
    this.attachedBag = bag;
    objects.push(bag);
    if (typeof addUIMessage === "function" && this.scene === currentScene)
      addUIMessage(paid ? `The IV stand put up a new ${type.toUpperCase()} bag ($${paid}).` : `The IV stand put up a spare ${type.toUpperCase()} bag.`);
    return true;
  }

  // The AUTO tag on the pole (right-click it)
  autoTagRect() {
    return { x: this.x - 22, y: this.y + 8, w: 44, h: 16 };
  }
  hitTestAutoTag(px, py) {
    const r = this.autoTagRect();
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  // Game seconds left on the hanging bag and the spares (Today.js)
  dripSecondsLeft() {
    if (!this.attachedBag) return 0;
    const m = typeof DRUG_METABOLISM !== "undefined" && DRUG_METABOLISM[this.attachedBag.type];
    const rate = m && m.rate > 0 ? m.rate : 0.5;
    const spare = this.spares.filter((b) => b.type === this.attachedBag.type).reduce((a, b) => a + b.charges, 0);
    return (this.attachedBag.charges + spare) / rate;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const halfW = this.w / 2;
      const halfH = this.h / 2;
      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.x = clamp(this.x, halfW, sceneW(this.scene) - halfW);
      this.y = clamp(this.y, topWallHeight + halfH + 5, sceneH(this.scene) - halfH);
    }

    const halfW = this.w / 2;
    const halfH = this.h / 2;
    this.bounds.left = this.x - halfW;
    this.bounds.right = this.x + halfW;
    this.bounds.top = this.y - halfH;
    this.bounds.bottom = this.y + halfH;

    if (!this.attachedBag) {
      this.connectedFluffy = null;
      this.isConnecting = false;
    }

    if (!fluffies.some((f) => f === this.connectedFluffy)) {
      this.connectedFluffy = null;
    }

    if (this.connectedFluffy) {
      if (
        this.connectedFluffy.isDestroyed ||
        this.connectedFluffy.scene !== this.scene
      ) {
        this.connectedFluffy = null;
      } else {
        const dx = this.connectedFluffy.x - this.x;
        const dy = this.connectedFluffy.y - 10 - (this.y - this.h / 2 + 10); // From top of stand to fluffy torso
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.maxCordLength) {
          this.connectedFluffy = null;
        }
      }
    }
  }

  hitTest(px, py) {
    return (
      px >= this.bounds.left &&
      px <= this.bounds.right &&
      py >= this.bounds.top &&
      py <= this.bounds.bottom
    );
  }

  hitTestTop(px, py) {
    const topSectionH = this.h * 0.25;
    return (
      px >= this.bounds.left &&
      px <= this.bounds.right &&
      py >= this.bounds.top &&
      py <= this.bounds.top + topSectionH
    );
  }

  getTopPoint() {
    return { x: this.x, y: this.y - this.h / 2 + 35 }; // Match bag visual
  }

  onDrop() {
    handleDropping(this);
  }

  getBottomY() {
    return this.y + this.h / 2;
  }

  serialize() {
    return {
      classType: "IVStand",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      connectedFluffyId: this.connectedFluffy ? this.connectedFluffy.id : null,
      attachedBagId: this.attachedBag ? this.attachedBag.id : null,
      isConnecting: this.isConnecting,
      autoRefill: !!this.autoRefill,
      spares: this.spares.map((b) => ({ type: b.type, charges: b.charges })),
    };
  }

  deserialize(data) {
    this.isConnecting = data.isConnecting || false;
    this.autoRefill = !!data.autoRefill;
    this.spares = Array.isArray(data.spares) ? data.spares.filter((b) => b && typeof b.type === "string").map((b) => ({ type: b.type, charges: +b.charges || 1000 })) : [];
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = images.iv_stand;
    this.w = img.width;
    this.h = img.height;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(img, -this.w / 2, -this.h / 2);
    ctx.restore();

    // The AUTO tag (auto-refill) and how many spare bags wait
    const r = this.autoTagRect();
    ctx.save();
    ctx.fillStyle = this.autoRefill ? "rgba(60, 170, 90, 0.9)" : "rgba(90, 90, 90, 0.75)";
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 4);
      ctx.fill();
    } else ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "white";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.autoRefill ? "AUTO ON" : "AUTO", r.x + r.w / 2, r.y + r.h / 2 + 1);
    if (this.spares.length) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(this.x + 14, this.y - this.h / 2 + 10, 24, 16);
      ctx.fillStyle = "white";
      ctx.fillText(`+${this.spares.length}`, this.x + 26, this.y - this.h / 2 + 19);
    }
    ctx.restore();

    // Draw Cord
    const top = this.getTopPoint();
    if (this.connectedFluffy) {
      ctx.beginPath();
      ctx.strokeStyle = "black";
      ctx.lineWidth = 1;
      ctx.moveTo(top.x, top.y);
      const fh =
        this.connectedFluffy.positioning.getExtentsForCage().top -
        this.connectedFluffy.positioning.getExtentsForCage().bottom;
      let yOffset = this.connectedFluffy.placedOn
        ? 0
        : this.connectedFluffy.anim.yOffset;

      ctx.lineTo(
        this.connectedFluffy.x,
        this.connectedFluffy.y +
          10 +
          this.connectedFluffy.scale * (yOffset - 40),
      );
      ctx.stroke();
    } else if (this.isConnecting) {
      ctx.beginPath();
      ctx.strokeStyle = "black";
      ctx.lineWidth = 1;
      ctx.moveTo(top.x, top.y);

      let targetX = mouse.x;
      let targetY = mouse.y;
      const dx = targetX - top.x;
      const dy = targetY - top.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > this.maxCordLength) {
        targetX = top.x + (dx / dist) * this.maxCordLength;
        targetY = top.y + (dy / dist) * this.maxCordLength;
      }

      ctx.lineTo(targetX, targetY);
      ctx.stroke();
    }
  }
}
