class CattleProd {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;

    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.pokeOffset = 0;
    this.pokeDistance = 25;
    this.currentCage = null;
    this.angle = 0;
    this.shockedFluffy = null;
    this.loopingSound = null;
  }

  startTaserSound() {
    if (this.loopingSound) return;
    if (typeof currentScene !== "undefined" && this.scene !== currentScene) return;
    if (typeof startLoopingSound === "function") {
      this.loopingSound = startLoopingSound("taser");
    } else if (typeof playSound === "function") {
      this.loopingSound = playSound("taser", 1.0, 1.0, true);
    }
  }

  stopTaserSound() {
    if (this.loopingSound) {
      if (typeof stopSound === "function") {
        stopSound(this.loopingSound);
      } else if (typeof this.loopingSound.stop === "function") {
        this.loopingSound.stop();
      }
      this.loopingSound = null;
    }
  }

  getHoveredFluffy() {
    if (typeof fluffies === "undefined" || !Array.isArray(fluffies)) return null;

    const isMouseDown = typeof mouse !== "undefined" && !!mouse.down;
    // When the prod is being used on a fluffy, use the lenient hitbox multiplier to stay on
    if (isMouseDown && this.shockedFluffy) {
      const sf = this.shockedFluffy;
      if (
        sf.isAlive &&
        sf.scene === this.scene &&
        (!sf.currentCage ||
          !(typeof FoalInACan !== "undefined" && sf.currentCage instanceof FoalInACan))
      ) {
        if (sf.hitTest(mouse.x, mouse.y, CATTLE_PROD_HITBOX_MULTIPLIER)) {
          return sf;
        }
      }
    }

    for (const f of fluffies) {
      if (f.scene !== this.scene || !f.isAlive) continue;
      if (
        f.currentCage &&
        typeof FoalInACan !== "undefined" &&
        f.currentCage instanceof FoalInACan
      )
        continue;
      if (f.hitTest(mouse.x, mouse.y)) {
        return f;
      }
    }
    return null;
  }

  getContactPoint() {
    if (!this.isDragging) {
      if (this.shockedFluffy) {
        return {
          x: this.shockedFluffy.x,
          y: this.shockedFluffy.y - 15 * (this.shockedFluffy.scale || 1.0),
        };
      }
      return { x: this.x, y: this.y };
    }
    const angle = (225 * Math.PI) / 180;
    return {
      x: this.x + this.pokeOffset * Math.sin(angle),
      y: this.y - this.pokeOffset * Math.cos(angle),
    };
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.y = Math.max(this.y, topWallHeight + 10);

      const isMouseDown = typeof mouse !== "undefined" && !!mouse.down;
      const hoveredFluffy = this.getHoveredFluffy();
      const shouldBeIn = isMouseDown && !!hoveredFluffy;

      if (shouldBeIn) {
        this.startTaserSound();
        hoveredFluffy.tasedTimer = 0.15;
        hoveredFluffy.tasedPoint = this.getContactPoint();
        if (hoveredFluffy.updateCrawling) hoveredFluffy.updateCrawling();
        if (this.shockedFluffy !== hoveredFluffy) {
          if (this.shockedFluffy && this.shockedFluffy !== hoveredFluffy) {
            this.shockedFluffy.tasedTimer = 0;
            this.shockedFluffy.continuousTasedTimer = 0;
            this.shockedFluffy.continuousTasedSmokeTimer = 0;
            this.shockedFluffy.tasedPoint = null;
            if (this.shockedFluffy.updateCrawling) this.shockedFluffy.updateCrawling();
          }
          this.shockedFluffy = hoveredFluffy;
          let hitPart = hoveredFluffy.hitTest(
            mouse.x,
            mouse.y,
            CATTLE_PROD_HITBOX_MULTIPLIER
          );
          if (
            hoveredFluffy.placedOn instanceof OperatingTable &&
            hoveredFluffy.placedOn.category !== "DEFAULT"
          ) {
            const cat = hoveredFluffy.placedOn.category;
            if (cat === "LEFT EYE") hitPart = "leftEye";
            if (cat === "RIGHT EYE") hitPart = "rightEye";
          }
          this.applyPrick(hoveredFluffy, hitPart);
        }
      } else {
        this.stopTaserSound();
        if (this.shockedFluffy) {
          this.shockedFluffy.tasedTimer = 0;
          this.shockedFluffy.continuousTasedTimer = 0;
          this.shockedFluffy.continuousTasedSmokeTimer = 0;
          this.shockedFluffy.tasedPoint = null;
          if (this.shockedFluffy.updateCrawling) this.shockedFluffy.updateCrawling();
          this.shockedFluffy = null;
        }
      }

      const targetOffset = shouldBeIn ? this.pokeDistance : 0;
      const speed = this.pokeDistance / CATTLE_PROD_USE_ANIMATION_DURATION; 
      if (this.pokeOffset < targetOffset) {
        this.pokeOffset = Math.min(targetOffset, this.pokeOffset + speed * dt);
      } else if (this.pokeOffset > targetOffset) {
        this.pokeOffset = Math.max(targetOffset, this.pokeOffset - speed * dt);
      }
    } else {
      this.stopTaserSound();
      this.pokeOffset = 0;
      if (this.shockedFluffy) {
        this.shockedFluffy.tasedTimer = 0;
        this.shockedFluffy.continuousTasedTimer = 0;
        this.shockedFluffy.continuousTasedSmokeTimer = 0;
        this.shockedFluffy.tasedPoint = null;
        if (this.shockedFluffy.updateCrawling) this.shockedFluffy.updateCrawling();
      }
      this.shockedFluffy = null;
    }

    // Cattle prods cannot be captured in cages
    this.currentCage = null;
  }

  onDrop() {
    this.stopTaserSound();
    if (this.shockedFluffy) {
      this.shockedFluffy.tasedTimer = 0;
      this.shockedFluffy.continuousTasedTimer = 0;
      this.shockedFluffy.continuousTasedSmokeTimer = 0;
      this.shockedFluffy.tasedPoint = null;
      if (this.shockedFluffy.updateCrawling) this.shockedFluffy.updateCrawling();
    }
    this.angle = 0;
    this.pokeOffset = 0;
    this.shockedFluffy = null;
    this.currentCage = null;
    return handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  manualUse(targetFluffy, hitPart = null) {
    if (!targetFluffy || !targetFluffy.isAlive) return false;
    this.shockedFluffy = targetFluffy;
    this.pokeOffset = this.pokeDistance;
    targetFluffy.tasedTimer = 0.15;
    targetFluffy.tasedPoint = this.getContactPoint();
    if (targetFluffy.updateCrawling) targetFluffy.updateCrawling();
    this.startTaserSound();
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

    this.startTaserSound();
    targetFluffy.tasedTimer = 0.15;
    if (targetFluffy.updateCrawling) targetFluffy.updateCrawling();

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
      targetFluffy.bleedingTimer = 0;

      if (typeof HAPPINESS_PENALTY_AMPUTATION !== "undefined") {
        targetFluffy.changeHappiness(HAPPINESS_PENALTY_AMPUTATION);
      }

      let damage = (25 / (2 + 2 * targetFluffy.growth)) * 2;
      targetFluffy.health = Math.max(0, targetFluffy.health - damage);

      if (typeof notifyViolence === "function") {
        notifyViolence(targetFluffy, false, "cattle_prod", false, true);
      }

      if (targetFluffy.tooYoungToSpeak()) {
        targetFluffy.speak(getDialogue(["AMPUTATION", "CHIRPY"], targetFluffy));
      } else {
        targetFluffy.speak(
          getDialogue(["AMPUTATION", "DEFAULT"], targetFluffy),
        );
      }
    } else {
      targetFluffy.bleedingTimer = 0;
    }

    return true;
  }

  get bounds() {
    const img = images.cattle_prod;
    const w = img ? img.width : 10;
    const h = img ? img.height : 57;
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
    const img = images.cattle_prod;
    const w = img ? img.width : 10;
    const h = img ? img.height : 57;

    const dx = px - this.x;
    const dy = py - this.y;

    const angle = this.isDragging ? (225 * Math.PI) / 180 : 0;
    const pokeOffset = this.isDragging ? this.pokeOffset : 0;

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

  serialize() {
    return {
      classType: "CattleProd",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      angle: 0,
      currentCageId: null,
    };
  }

  deserialize(data) {
    this.angle = 0;
    this.pokeOffset = 0;
    this.shockedFluffy = null;
    this.stopTaserSound();
    this.currentCage = null;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = images.cattle_prod;
    if (!img) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.isDragging) {
      const angle = (225 * Math.PI) / 180;
      ctx.rotate(angle);

      if (this.pokeOffset > 0) {
        ctx.translate(0, -this.pokeOffset);
      }
      ctx.translate(0, img.height);
    } else {
      ctx.rotate(0);
    }

    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
