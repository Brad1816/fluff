class Syringe {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;

    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.pokeTimer = 0;
    this.pokeDuration = 0.2;
    this.pokeDistance = 25;
    this.currentCage = null;
    this.angle = 0;

    // Fluid storage (up to 20 units)
    this.fluidType = null; // e.g. "tpn", "prolactin", "growth_hormone"
    this.fluidAmount = 0;
    this.maxFluid = 20;
  }

  update(dt) {
    if (this.pokeTimer > 0) {
      this.pokeTimer -= dt;
      if (this.pokeTimer < 0) this.pokeTimer = 0;
    }

    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const topWallHeight = height * 0.15;
      this.y = Math.max(this.y, topWallHeight + 10);
    }

    // Syringes cannot be captured in cages
    this.currentCage = null;
  }

  onDrop() {
    this.angle = 0;
    this.currentCage = null;
    return handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  drawFromBag(bag) {
    if (!bag || bag.charges <= 0) return false;
    const currentAmount = this.fluidType === bag.type ? this.fluidAmount : 0;
    const needed = this.maxFluid - currentAmount;
    if (needed <= 0) return false;

    const transfer = Math.min(needed, bag.charges);
    this.fluidType = bag.type;
    this.fluidAmount = currentAmount + transfer;
    bag.charges -= transfer;

    if (bag.charges <= 0) {
      bag.isDestroyed = true;
      if (bag.attachedTo) {
        bag.attachedTo.attachedBag = null;
        bag.attachedTo.connectedFluffy = null;
        bag.attachedTo.isConnecting = false;
      }
    }

    if (typeof playSound === "function" && this.scene === currentScene) {
      playSound("sponge_squish");
    }
    if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
      poofs.push(new Poof(this.x, this.y, this.scene, this.getFluidColor()));
    }
    return true;
  }

  manualUse(targetFluffy, hitPart = null) {
    this.pokeTimer = this.pokeDuration;
    if (!targetFluffy || !targetFluffy.isAlive) return false;

    // 1. Fluid injection if syringe contains fluid
    if (this.fluidAmount > 0 && this.fluidType) {
      const dose = this.fluidAmount;

      // Enters bloodstream and metabolic system
      targetFluffy.administerDrug(this.fluidType, dose);

      if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
        poofs.push(
          new Poof(
            targetFluffy.x,
            targetFluffy.y,
            targetFluffy.scene,
            this.getFluidColor(),
          ),
        );
      }

      this.fluidType = null;
      this.fluidAmount = 0;
    }

    // 2. Needle prick effect
    return this.applyPrick(targetFluffy, hitPart);
  }

  poke(targetFluffy = null, hitPart = null) {
    return this.manualUse(targetFluffy, hitPart);
  }

  blind(targetFluffy, eyePart = null) {
    if (!targetFluffy || !targetFluffy.isAlive) return false;
    if (!eyePart) {
      const nearEye = targetFluffy.facingRight ? "rightEye" : "leftEye";
      eyePart =
        targetFluffy.limbs && targetFluffy.limbs[nearEye]
          ? nearEye
          : nearEye === "rightEye"
            ? "leftEye"
            : "rightEye";
    }
    return this.manualUse(targetFluffy, eyePart);
  }

  applyPrick(targetFluffy, hitPart = null) {
    if (!targetFluffy || !targetFluffy.isAlive) return false;

    if (
      typeof playSound === "function" &&
      targetFluffy.scene === currentScene
    ) {
      playSound("thumbtack");
    }

    const isEye =
      hitPart === "leftEye" ||
      hitPart === "rightEye" ||
      hitPart === "left_eye" ||
      hitPart === "right_eye";
    let blindedPart = null;
    if (isEye) {
      const eyeKey = hitPart.toLowerCase().includes("left")
        ? "leftEye"
        : "rightEye";
      if (targetFluffy.limbs && targetFluffy.limbs[eyeKey]) {
        blindedPart = targetFluffy.amputate(eyeKey, this);
      }
    }

    if (blindedPart) {
      targetFluffy.expressionOverride = "CRYING_SHOCKED";
      targetFluffy.expressionOverrideTimer = 10.0;
      targetFluffy.bleedingTimer = Math.max(
        targetFluffy.bleedingTimer || 0,
        10,
      );

      if (typeof HAPPINESS_PENALTY_AMPUTATION !== "undefined") {
        targetFluffy.changeHappiness(HAPPINESS_PENALTY_AMPUTATION);
      }

      let damage = (25 / (2 + 2 * targetFluffy.growth)) * 2;
      targetFluffy.health = Math.max(0, targetFluffy.health - damage);

      if (typeof addPointToPuddle !== "undefined") {
        const pX = targetFluffy.x;
        const pY =
          typeof targetFluffy.getBottomY === "function"
            ? targetFluffy.getBottomY()
            : targetFluffy.y;
        addPointToPuddle(
          targetFluffy.scene,
          pX,
          pY,
          "#8a0303",
          5 / 200,
          25 / 200,
        );
      }

      if (typeof notifyViolence === "function") {
        notifyViolence(targetFluffy, false, "thumbtack", false, true);
      }

      if (targetFluffy.tooYoungToSpeak()) {
        targetFluffy.speak(getDialogue(["AMPUTATION", "CHIRPY"], targetFluffy));
      } else {
        targetFluffy.speak(
          getDialogue(["AMPUTATION", "DEFAULT"], targetFluffy),
        );
      }
    } else {
      targetFluffy.expressionOverride = "CRYING_SHOCKED";
      targetFluffy.expressionOverrideTimer = 6.0;
      targetFluffy.bleedingTimer = Math.max(
        targetFluffy.bleedingTimer || 0,
        0.25,
      );

      if (typeof HAPPINESS_PENALTY_THUMBTACK_PRICK !== "undefined") {
        targetFluffy.changeHappiness(HAPPINESS_PENALTY_THUMBTACK_PRICK);
      }

      const isChirpy =
        typeof targetFluffy.tooYoungToSpeak === "function"
          ? targetFluffy.tooYoungToSpeak()
          : targetFluffy.growth < 0.25;
      const dKey = isChirpy ? ["THUMBTACK", "FOAL"] : ["THUMBTACK", "DEFAULT"];
      if (typeof getDialogue !== "undefined") {
        targetFluffy.speak(getDialogue(dKey, targetFluffy), false, true);
      }
    }

    return true;
  }

  get bounds() {
    const img = images.syringe;
    const w = img ? img.width : 15;
    const h = img ? img.height : 40;
    return {
      left: this.x - w / 2,
      right: this.x + w / 2,
      top: this.y - h,
      bottom: this.y,
    };
  }

  getExtents() {
    return this.bounds;
  }

  hitTest(px, py) {
    const img = images.syringe;
    const w = img ? img.width : 15;
    const h = img ? img.height : 40;

    const dx = px - this.x;
    const dy = py - this.y;

    const angle = this.isDragging ? (225 * Math.PI) / 180 : 0;
    let pokeOffset = 0;
    if (this.isDragging && this.pokeTimer > 0) {
      const progress = 1 - this.pokeTimer / this.pokeDuration;
      pokeOffset = Math.sin(progress * Math.PI) * this.pokeDistance;
    }

    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const rx = dx * cos - dy * sin;
    let ry = dx * sin + dy * cos;

    ry += pokeOffset;

    const pad = 6;
    if (this.isDragging) {
      return (
        rx >= -w / 2 - pad && rx <= w / 2 + pad && ry >= -pad && ry <= h + pad
      );
    } else {
      return (
        rx >= -w / 2 - pad && rx <= w / 2 + pad && ry >= -h - pad && ry <= pad
      );
    }
  }

  getBottomY() {
    return this.y;
  }

  getFluidColor() {
    if (typeof getDrugColor === "function") {
      return getDrugColor(this.fluidType, "#ffffff");
    }
    if (typeof DRUG_COLORS !== "undefined" && DRUG_COLORS[this.fluidType]) {
      return DRUG_COLORS[this.fluidType];
    }
    return "#ffffff";
  }

  serialize() {
    return {
      classType: "Syringe",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      angle: 0,
      fluidType: this.fluidType,
      fluidAmount: this.fluidAmount,
      currentCageId: null,
    };
  }

  deserialize(data) {
    this.angle = 0;
    this.currentCage = null;
    this.fluidType = data.fluidType || null;
    this.fluidAmount = data.fluidAmount || 0;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = images.syringe;
    if (!img) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.isDragging) {
      const angle = (225 * Math.PI) / 180;
      ctx.rotate(angle);

      if (this.pokeTimer > 0) {
        const progress = 1 - this.pokeTimer / this.pokeDuration;
        const pokeOffset = Math.sin(progress * Math.PI) * this.pokeDistance;
        ctx.translate(0, -pokeOffset);
      }
      ctx.translate(0, img.height);
    } else {
      ctx.rotate(0);
    }

    // Draw fluid in the barrel if filled
    if (this.fluidAmount > 0) {
      const fillRatio = Math.min(1.0, this.fluidAmount / this.maxFluid);
      const barrelH = 14;
      const fillH = barrelH * fillRatio;
      ctx.fillStyle = this.getFluidColor();
      ctx.globalAlpha = 0.8;
      // Barrel interior is between y: -27 and y: -13, width is ~6px (-3 to 3)
      ctx.fillRect(-3, -13 - fillH, 6, fillH);
      ctx.globalAlpha = 1.0;
    }

    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
