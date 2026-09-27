class HorsePhysics {
  constructor(horse) {
    this.horse = horse;
  }

  updateRiverDrowning(dt) {
    if (
      this.horse.scene === "RIVER" &&
      this.horse.x + 30 * this.horse.scale < width * 0.25 &&
      !this.horse.isDragging &&
      !this.horse.placedOn &&
      !this.horse.currentCage
    ) {
      this.horse.drowningTimer = Math.max(
        1.0,
        Math.min(5, this.horse.drowningTimer + dt),
      );
      this.horse.expressionOverride = "CRYING_SHOCKED";
      if (
        this.horse.drowningTimer > 0 &&
        this.horse.currentStateKey !== "DROWNING" &&
        this.horse.isAlive
      ) {
        this.horse.initBehavior("DROWNING");
      }
      this.horse.y += (Math.random() - 0.5) * 4.0;
      if (this.horse.drowningTimer >= 5) {
        this.horse.isAlive = false;
        this.horse.isDestroyed = true;
      }
    } else {
      this.horse.drowningTimer = 0;
    }
  }

  updateTablePhysics(dt) {
    const currentTable = this.horse.placedOn;
    if (!currentTable) return false;

    this.horse.attemptLockIntoTable(currentTable);
    this.horse.vx = 0;
    this.horse.vy = 0;
    this.horse.setTargetPosition(this.horse.x, this.horse.y);

    if (
      this.horse.placedOn instanceof ImmobilizationBoard ||
      this.horse.placedOn instanceof LitterpalBox
    ) {
      this.horse.facingRight = false; // Always face left
    }
    if (
      this.horse.placedOn instanceof OperatingTable ||
      this.horse.placedOn instanceof LitterpalBox
    ) {
      this.horse.attemptLockIntoTable(this.horse.placedOn);
    }

    if (this.horse.placedOn instanceof OperatingTable) {
      if (this.horse.fearOfOperatingTable) {
        this.horse.expressionOverride = "CRYING_SHOCKED";
      }

      if (
        this.horse.isAlive &&
        !this.horse.tooYoungToSpeak() &&
        this.horse.canSee() &&
        (!this.horse.fearOfOperatingTable ||
          this.horse.expressionOverrideTimer <= 0.5) &&
        (this.horse.fearOfOperatingTable || this.horse.speech.nextTime <= 0)
      ) {
        let key = this.horse.fearOfOperatingTable
          ? ["OPERATING_TABLE", "FEAR"]
          : "OPERATING_TABLE";
        let text = getDialogue(key, this.horse);

        if (this.horse.fearOfOperatingTable) {
          const hasLegs = this.horse.limbs.legs.some((l) => l);
          const hasLumps = this.horse.limbs.lumps;

          const extraLines = [];
          if (hasLegs)
            extraLines.push(
              getDialogue(["OPERATING_TABLE", "FEAR", "LEGS"], this.horse),
            );
          if (hasLumps)
            extraLines.push(
              getDialogue(["OPERATING_TABLE", "FEAR", "LUMPS"], this.horse),
            );

          if (extraLines.length > 0 && Math.random() < 0.5) {
            text = extraLines[Math.floor(Math.random() * extraLines.length)];
          }
        }
        this.horse.speak(text);
        this.horse.speech.nextTime = 4 + Math.random();
        if (this.horse.fearOfOperatingTable) {
          this.horse.expressionOverrideTimer = 2 + Math.random();
        }
      }
    }
    return true;
  }

  updateDragging(dt, groundYMin) {
    if (!this.horse.isDragging) return false;

    if (this.horse.hasBlockOnBack()) {
      this.horse.blockOnBack.heldBy = null;
      this.horse.blockOnBack.x = this.horse.x;
      this.horse.blockOnBack.y = this.horse.y;
      this.horse.blockOnBack.groundY = this.horse.y;
      this.horse.blockOnBack = null;
    }
    this.horse.lastX = this.horse.x;
    this.horse.lastY = this.horse.y;

    // Handle Grabbing Physics
    if (!this.horse.grabbedPart || this.horse.grabbedPart === "torso") {
      // Standard Torso Drag
      this.horse.x = mouse.x + this.horse.dragOffset.x;
      this.horse.y = mouse.y + this.horse.dragOffset.y;
      // Basic Swing
      this.horse.vx = (this.horse.x - this.horse.lastX) / dt;
      let dangle = clamp(-this.horse.vx * 0.002, -1.2, 1.2);
      if (Math.abs(this.horse.vx) > 10 && this.horse.isAlive)
        this.horse.facingRight = this.horse.vx >= 0;
      if (this.horse.facingRight) {
        dangle = -dangle;
      }
      this.horse.physicsLegAngle = lerpAngle(
        this.horse.physicsLegAngle,
        dangle,
        0.2,
      );

      // Reset rotation
      this.horse.ragdollRotation = lerpAngle(
        this.horse.ragdollRotation,
        0,
        10 * dt,
      );
    } else {
      // Limb/Part Drag (Ragdoll)
      // 1. Calculate Local Anchor
      let ax = 0,
        ay = 0;
      if (this.horse.tinted && this.horse.tinted.torso) {
        const w = this.horse.tinted.torso.width;
        const h = this.horse.tinted.torso.height;
        if (this.horse.grabbedPart === "head") {
          ax = w * 0.35;
          ay = -h * 0.25;
        } else if (this.horse.grabbedPart === "tail") {
          ax = -w * 0.4;
          ay = -h * 0.3;
        } else if (this.horse.grabbedPart.startsWith("leg_")) {
          const idx = parseInt(this.horse.grabbedPart.split("_")[1]);
          // 0, 3 are Back. 1, 2 are Front.
          if (idx === 1 || idx === 2) {
            ax = w * 0.3;
            ay = h * 0.2;
          } // Front
          else {
            ax = -w * 0.3;
            ay = h * 0.2;
          } // Back
        }
      }

      // 2. Scale and Flip Anchor
      const sX = this.horse.facingRight ? this.horse.scale : -this.horse.scale;
      const sY = this.horse.scale;
      const rAx = ax * sX;
      const rAy = ay * sY;

      // 3. Calculate Target Angle (Hang from anchor)
      let targetRot = Math.PI / 2 - Math.atan2(-rAy, -rAx);
      targetRot += this.horse.vx * 0.001;
      while (targetRot > Math.PI) targetRot -= Math.PI * 2;
      while (targetRot < -Math.PI) targetRot += Math.PI * 2;
      this.horse.ragdollRotation = lerpAngle(
        this.horse.ragdollRotation,
        targetRot,
        10 * dt,
      );

      // 4. Position Body (Torso) relative to Mouse (Anchor)
      const cos = Math.cos(this.horse.ragdollRotation);
      const sin = Math.sin(this.horse.ragdollRotation);

      const rotX = rAx * cos - rAy * sin;
      const rotY = rAx * sin + rAy * cos;

      this.horse.x = mouse.x - rotX;
      this.horse.y = mouse.y - rotY;

      this.horse.vx = (this.horse.x - this.horse.lastX) / dt;
      this.horse.vy = (this.horse.y - this.horse.lastY) / dt;
    }

    this.horse.y = Math.max(this.horse.y, groundYMin);

    // Held near grinder logic
    if (
      this.horse.isAlive &&
      !this.horse.tooYoungToSpeak() &&
      (this.horse.canSee() || this.horse.canHear())
    ) {
      if (this.horse.isNearRunningGrinder()) {
        if (this.horse.expressionOverrideTimer <= 1) {
          this.horse.expressionOverride = "CRYING_SHOCKED";
          this.horse.expressionOverrideTimer = 2.0;

          const pool = ["DEFAULT"];
          if (this.horse.adopted) {
            pool.push("ADOPTED");
          } else {
            pool.push("FERAL");
          }

          this.horse.speak(
            getDialogue(
              [
                "HELD_NEAR_GRINDER",
                pool[Math.floor(Math.random() * pool.length)],
              ],
              this.horse,
            ),
          );
          this.horse.speech.nextTime = 1.0 + Math.random();
        }
      }
    }

    this.horse.updateLayout();
    return true;
  }
}
