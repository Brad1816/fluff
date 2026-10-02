class Thumbtack {
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
    this.steppedHorses = new Set();
    this.stepCooldowns = {};
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
      this.steppedHorses.clear();
    } else {
      if (typeof fluffies !== "undefined" && Array.isArray(fluffies)) {
        const tackBounds = this.bounds;
        const currentInZone = new Set();
        for (let i = 0; i < fluffies.length; i++) {
          const f = fluffies[i];
          if (!f || !f.isAlive || f.isDestroyed) continue;
          if (f.scene !== this.scene) continue;
          if (f.isDragging || f.placedOn || f.currentCage) continue;

          const fRadius = 25 * (f.scale || 1.0);
          const fLeft = f.x - fRadius;
          const fRight = f.x + fRadius;
          const fBottom = f.y;
          const fTop = f.y - 40 * (f.scale || 1.0);

          const overlapX =
            fRight >= tackBounds.left && fLeft <= tackBounds.right;
          const overlapY =
            fBottom >= tackBounds.top && fTop <= tackBounds.bottom;

          if (overlapX && overlapY) {
            currentInZone.add(f.id);
            const now = Date.now ? Date.now() : +new Date();
            const cooldownMs =
              (typeof THUMBTACK_COOLDOWN !== "undefined"
                ? THUMBTACK_COOLDOWN
                : 1.5) * 1000;
            const lastStepped = this.stepCooldowns[f.id] || 0;
            if (
              !this.steppedHorses.has(f.id) &&
              now - lastStepped > cooldownMs &&
              f.currentStateKey !== "FLUFFY_KNOCKED_DOWN"
            ) {
              this.steppedHorses.add(f.id);
              this.stepCooldowns[f.id] = now;
              this.steppedOn(f);
            }
          }
        }
        for (const horseId of this.steppedHorses) {
          if (!currentInZone.has(horseId)) {
            this.steppedHorses.delete(horseId);
          }
        }
      }
    }

    this.currentCage = null;
  }

  onDrop() {
    this.angle = 0;
    this.currentCage = null;
    this.steppedHorses.clear();
    return handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  checkFluffyCollision(f) {
    if (!f || !f.isAlive || f.isDestroyed) return false;
    if (this.isDragging) return false;
    if (f.isDragging || f.placedOn || f.currentCage) return false;
    if (f.scene !== this.scene) return false;
    if (f.currentStateKey === "FLUFFY_KNOCKED_DOWN") return false;

    const tackBounds = this.bounds;
    const fRadius = 25 * (f.scale || 1.0);
    const fLeft = f.x - fRadius;
    const fRight = f.x + fRadius;
    const fBottom = f.y;
    const fTop = f.y - 40 * (f.scale || 1.0);

    const overlapX = fRight >= tackBounds.left && fLeft <= tackBounds.right;
    const overlapY = fBottom >= tackBounds.top && fTop <= tackBounds.bottom;

    if (overlapX && overlapY) {
      const now = Date.now ? Date.now() : +new Date();
      const cooldownMs =
        (typeof THUMBTACK_COOLDOWN !== "undefined" ? THUMBTACK_COOLDOWN : 1.5) *
        1000;
      const lastStepped = this.stepCooldowns[f.id] || 0;
      if (!this.steppedHorses.has(f.id) && now - lastStepped > cooldownMs) {
        this.steppedHorses.add(f.id);
        this.stepCooldowns[f.id] = now;
        this.steppedOn(f);
        return true;
      }
    } else {
      if (this.steppedHorses.has(f.id)) {
        this.steppedHorses.delete(f.id);
      }
    }
    return false;
  }

  applyPrick(targetFluffy, isTraining = false, hitPart = null) {
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

    targetFluffy.initBehavior("FLUFFY_KNOCKED_DOWN");
    targetFluffy.stateTimer = 0.5;

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
          "blood",
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

      if (isTraining) {
        if (typeof getDialogue !== "undefined") {
          targetFluffy.speak(
            getDialogue(["THUMBTACK", "TRAINING"], targetFluffy),
          );
        }
      } else {
        const isChirpy =
          typeof targetFluffy.tooYoungToSpeak === "function"
            ? targetFluffy.tooYoungToSpeak()
            : targetFluffy.growth < 0.25;
        const dKey = isChirpy
          ? ["THUMBTACK", "FOAL"]
          : ["THUMBTACK", "DEFAULT"];
        if (typeof getDialogue !== "undefined") {
          targetFluffy.speak(getDialogue(dKey, targetFluffy), false, true);
        }
      }
    }
    return true;
  }

  manualUse(targetFluffy = null, isTraining = false, hitPart = null) {
    this.pokeTimer = this.pokeDuration;
    if (targetFluffy) {
      return this.applyPrick(targetFluffy, isTraining, hitPart);
    }
    return false;
  }

  poke(targetFluffy = null, isTraining = false, hitPart = null) {
    return this.manualUse(targetFluffy, isTraining, hitPart);
  }

  steppedOn(targetFluffy) {
    if (!targetFluffy || !targetFluffy.isAlive) return false;
    // Never lesson learning / sorry stick training or eye blinding when stepped on
    return this.applyPrick(targetFluffy, false, null);
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
    return this.manualUse(targetFluffy, false, eyePart);
  }

  get bounds() {
    const img = images.thumbtack;
    const w = img ? img.width : 30;
    const h = img ? img.height : 60;
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
    const img = images.thumbtack;
    const w = img ? img.width : 30;
    const h = img ? img.height : 60;

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

  serialize() {
    return {
      classType: "Thumbtack",
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
    this.currentCage = null;
    this.steppedHorses = new Set();
    this.stepCooldowns = {};
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = images.thumbtack;
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

    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
