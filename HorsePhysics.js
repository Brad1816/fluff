class HorsePhysics {
  constructor(horse) {
    this.horse = horse;
  }

  //Osscilates a number between min and max
  pingPong(min, max, speed, time) {
    const range = max - min;
    return min + ((Math.sin(time * speed) + 1) / 2) * range;
  }

  updateRiverDrowning(dt) {
    if (
      this.horse.scene === "RIVER" &&
      this.horse.x + 30 * this.horse.scale < width * 0.25 &&
      !this.horse.isDragging &&
      !this.horse.placedOn &&
      !this.horse.currentCage &&
      !this.horse.isFallingFromThrow
    ) {
      this.horse.drowningTimer = Math.max(
        1.0,
        Math.min(5, this.horse.drowningTimer + dt),
      );
      if (
        this.horse.drowningTimer > 0 &&
        this.horse.currentStateKey !== "DROWNING" &&
        this.horse.isAlive
      ) {
        this.horse.initBehavior("DROWNING");
        if (typeof onFoalDrowning === "function") onFoalDrowning(this.horse); // (its mum: FoalLife.js)
      }
      this.horse.y += Math.random() * 2.0;
      this.horse.x += this.pingPong(-0.5, 0.1, 1, performance.now() / 1000);
      if (this.horse.drowningTimer >= 5) {
        // (it dies properly - its story, the memorial, its mum - then the
        // river takes it)
        if (this.horse.isAlive && this.horse.anatomy) this.horse.anatomy.die(null, "Drowned");
        this.horse.isAlive = false;
        this.horse.isDestroyed = true;
      }
    } else {
      // Pulled out alive: afraid of water (and baths) now (Fears.js)
      if (this.horse.drowningTimer > 0 && this.horse.isAlive && typeof learnFearOfBaths === "function") learnFearOfBaths(this.horse, BATH_FROM_DROWNING);
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

    if (
      this.horse.heldWithThrowTool &&
      (typeof mouse === "undefined" || !mouse.down || mouse.rightDown)
    ) {
      this.horse.onDrop();
      return false;
    }

    if (this.horse.hasBlockOnBack()) {
      this.horse.blockOnBack.heldBy = null;
      this.horse.blockOnBack.x = this.horse.x;
      this.horse.blockOnBack.y = this.horse.y;
      this.horse.blockOnBack.groundY = this.horse.y;
      this.horse.blockOnBack = null;
    }
    this.horse.lastX = this.horse.x;
    this.horse.lastY = this.horse.y;
    let slamDistance = 0;

    const grabbedCorrectly = !this.horse.grabbedPart || this.horse.grabbedPart === "torso";

    // Handle Grabbing Physics
    if (grabbedCorrectly) {
      // Standard Torso Drag
      this.horse.x = mouse.x + this.horse.dragOffset.x;
      let oldY = this.horse.y;
      this.horse.y = mouse.y + this.horse.dragOffset.y;
      if (this.horse.heldWithThrowTool) {
          this.horse.y = Math.min(this.horse.throwStartY, this.horse.y);
          slamDistance = this.horse.y - oldY;
      }
      // Basic Swing
      this.horse.vx = (this.horse.x - this.horse.lastX) / dt;
      this.horse.vy = (this.horse.y - this.horse.lastY) / dt;
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
      let oldY = this.horse.y;
      this.horse.y = mouse.y - rotY;
      if (this.horse.heldWithThrowTool) {
          this.horse.y = Math.min(this.horse.throwStartY, this.horse.y);
          slamDistance = this.horse.y - oldY;
      }

      this.horse.vx = (this.horse.x - this.horse.lastX) / dt;
      this.horse.vy = (this.horse.y - this.horse.lastY) / dt;
    }

    let minY = groundYMin;
    if (this.horse.heldWithThrowTool) {
      const isIndoor =
        typeof isIndoorScene === "function"
          ? isIndoorScene(this.horse.scene)
          : !!(
              typeof getSceneConfig === "function" &&
              getSceneConfig(this.horse.scene)?.isIndoor
            );
      minY = isIndoor ? -20 : -Infinity;
    } else if (typeof minY !== "number") {
      const hasWall =
        typeof sceneHasWall === "function"
          ? sceneHasWall(this.horse.scene)
          : !!(
              typeof getSceneConfig === "function" &&
              getSceneConfig(this.horse.scene)?.topWallColor
            );
      minY = hasWall ? (typeof height !== "undefined" ? height * 0.15 + 50 : 170) : 0;
    }
    if (this.horse.heldWithThrowTool) {
      this.horse.y = Math.min(this.horse.throwStartY, this.horse.y);
      let slammed = (this.horse.y === this.horse.throwStartY);
      if (slammed) {
        this.horse.handleThrowImpact(slamDistance * 0.3 / dt);
      }
    }

    this.horse.y = Math.max(this.horse.y, minY);

    // Held near grinder logic
    if (
      this.horse.isAlive &&
      !this.horse.tooYoungToSpeak() &&
      (this.horse.canSee() || this.horse.canHear())
    ) {
      if (this.horse.isNearRunningGrinder()) {
        if (
          this.horse.expressionOverrideTimer <= 1 &&
          this.horse.happiness !== WAN_DIE_THRESHOLD
        ) {
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

    // Held high with throw tool logic
    if (
      this.horse.isAlive &&
      this.horse.heldWithThrowTool &&
      this.horse.canSee() &&
      typeof this.horse.throwStartY === "number"
    ) {
      const heightInAir = Math.max(0, this.horse.throwStartY - this.horse.y);
      if (heightInAir >= THROW_HIGH_ALTITUDE_THRESHOLD) {
        this.horse.wasHeldHigh = true;
        const isWinged = this.horse.hasBothWings();
        const isChirpy = this.horse.tooYoungToSpeak();
        const targetExp = isWinged && !isChirpy ? this.horse.grabbedPart === "torso" ? "GOOD_UPSIES" : null : "CRYING_SHOCKED";

        if (
          this.horse.expressionOverride !== targetExp ||
          this.horse.expressionOverrideTimer <= 0 
        ) {
          this.horse.expressionOverride = targetExp;
          this.horse.expressionOverrideTimer = 2.0;

          if (this.horse.happiness > WAN_DIE_THRESHOLD && (!isWinged || isChirpy || this.horse.grabbedPart === "torso")) {
            const dialogueType = isChirpy
                ? "CHIRPY" : isWinged ? "WINGED"
                : "DEFAULT";
            const line = getDialogue(
              ["THROW_HELD_HIGH", dialogueType],
              this.horse,
            );
            if (line) {
              this.horse.speak(line, false, isChirpy);
              if (this.horse.speech) {
                this.horse.speech.nextTime = 1.0 + Math.random();
              }
            }
          }
        }
      } else if (this.horse.wasHeldHigh) {
        this.horse.wasHeldHigh = false;
        if (
          this.horse.expressionOverride === "CRYING_SHOCKED" ||
          this.horse.expressionOverride === "GOOD_UPSIES"
        ) {
          this.horse.expressionOverride = null;
          this.horse.expressionOverrideTimer = 0;
        }
      }
    }

    this.horse.updateLayout();
    return true;
  }

  // Highest Y the horse may stand at in its scene
  getGroundYMin() {
    const h = this.horse;
    // Held up with the throw tool: up to the ceiling indoors, anywhere outside
    if (h.heldWithThrowTool) return isIndoorScene(h.scene) ? -50 : -Infinity;
    return sceneTop(h.scene) + 50;
  }

  // Falling after a throw. Returns true while airborne (skips the rest of the update)
  updateThrowFall(dt) {
    const h = this.horse;
    // Caught in the air (picked up by hand): it's held now, not falling
    if (h.isFallingFromThrow && h.isDragging && !h.heldWithThrowTool) {
      h.isFallingFromThrow = false;
      h.throwFallVx = 0;
      h.throwFallVy = 0;
      h.throwStartY = null;
      h.throwShadowY = null;
      h._flight = null;
      return false;
    }
    if (h.isFallingFromThrow) {
      // A pegasus flaps: it falls a little slower (Flight.js)
      const flying = !!h._flight; // (a flutter hop on the perch: Perch.js)
      const gravity = typeof flightGravity === "function" && (flying || (h.throwFallVy || 0) > 0) ? flightGravity(h, 1500) : 1500;
      h.throwFallVy = (h.throwFallVy || 0) + gravity * dt;
      h.y += h.throwFallVy * dt;
      h.x += (h.throwFallVx || 0) * dt;
      if (flying && typeof updateFlightShadow === "function") updateFlightShadow(h);

      // Air resistance damping for horizontal movement
      if (h.throwFallVx) {
        if (!flying) h.throwFallVx *= Math.exp(-0.4 * dt);
        if (h.throwFallVx > 10) h.facingRight = true;
        else if (h.throwFallVx < -10) h.facingRight = false;
      }

      // Screen edge clamping / bouncing
      const screenW = sceneW(h.scene); // (the park is wider than the screen)
      if (h.x < 30 && (h.throwFallVx || 0) < 0) {
        const impactSpeed = Math.abs(h.throwFallVx);
        h.x = 30;
        h.throwFallVx = -(h.throwFallVx || 0) * 0.3;
        if (h.y >= -20) {
          h.handleThrowImpact(impactSpeed);
        }
      } else if (h.x > screenW - 30 && (h.throwFallVx || 0) > 0) {
        const impactSpeed = Math.abs(h.throwFallVx);
        h.x = screenW - 30;
        h.throwFallVx = -(h.throwFallVx || 0) * 0.3;
        if (h.y >= -20) {
          h.handleThrowImpact(impactSpeed);
        }
      }

      // Indoor ceiling clamping / bouncing
      const isIndoor =
        typeof isIndoorScene === "function"
          ? isIndoorScene(h.scene)
          : !!(
              typeof getSceneConfig === "function" &&
              getSceneConfig(h.scene)?.isIndoor
            );
      if (isIndoor && h.y < -20) {
        const impactSpeed = Math.abs(h.throwFallVy || 0);
        h.y = -20;
        if (h.throwFallVy < 0) {
          h.throwFallVx = (h.throwFallVx || 0) * 0.5;
          h.throwFallVy = -h.throwFallVy * 0.3;
          h.handleThrowImpact(impactSpeed);
        }
      }

      // Ground landing
      if (
        typeof h.throwStartY === "number" &&
        h.y >= h.throwStartY &&
        h.throwFallVy >= 0
      ) {
        const impactSpeed =
          typeof landingSpeed === "function"
            ? landingSpeed(h, h.throwFallVx || 0, h.throwFallVy || 0)
            : Math.hypot(h.throwFallVx || 0, h.throwFallVy || 0);
        h.y = h.throwStartY;
        h.throwFallVy = 0;
        h.throwFallVx = 0;
        h.vx = 0;
        h.vy = 0;
        h.isFallingFromThrow = false;
        h.throwStartY = null;
        h.throwShadowY = null;
        if (h._flight) {
          // A flutter hop: lands lightly (Perch.js)
          h._flight = null;
          if (h.isAlive) h.initBehavior("IDLE");
        } else {
          // Thrown: a pegasus's wings get a little stronger each time
          // (Flight.js), and strong ones land it on its feet
          const onFeet = typeof landsOnItsFeet === "function" && landsOnItsFeet(h, impactSpeed);
          if (typeof learnFlight === "function") learnFlight(h);
          h.handleThrowImpact(impactSpeed);
          if (h.isAlive && !onFeet) h.initBehavior("FLUFFY_KNOCKED_DOWN");
          else if (h.isAlive) h.initBehavior("IDLE"); // (on its feet)
        }
      }
      h.updateLayout();
      return true;
    }
    return false;
  }
}
