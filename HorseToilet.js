// ---------------------------------------------------------------------------
// Pooping, peeing, bleeding, being sick, litterboxes, and eating waste off
// the floor.
// (Part of the Horse class, split out of Horse.js: addHorseMethods adds
// these to every fluffy. Loaded right after Horse.js.)
// ---------------------------------------------------------------------------

addHorseMethods({
  consumePuddlesIfNeeded(dt) {
    if (this.currentStateKey === "EATING") {
      let consumed = false;
      if (typeof puddles !== "undefined") {
        for (const puddle of puddles) {
          if (puddle.scene !== this.scene || puddle.points.length === 0) continue;
          // Only bodily waste (poop, pee, sick, blood) - not water or tears
          if (typeof isBodilyWaste === "function" && !isBodilyWaste(puddle.color)) continue;

          for (let j = puddle.points.length - 1; j >= 0; j--) {
            const p = puddle.points[j];
            const px = p.x;
            const py = p.y;
            const dPt = Math.sqrt((this.x - px) ** 2 + (this.y - py) ** 2);
            if (dPt < 40) {
              p.scale -= 0.02 * dt;
              if (p.targetScale) p.targetScale = Math.min(p.targetScale, p.scale);
              if (p.scale < 0.05) {
                puddle.points.splice(j, 1);
              }
              // (This used to read `color == "#5c4033" || "#8a0303"`, which is
              // always true; the filter above now keeps it to waste.)
              this.hunger = Math.min(1.0, this.hunger + 0.015 * dt);
              this.poopStorage = Math.min(1.0, this.poopStorage + 0.01 * dt);
              if (this.happiness > 0.1) {
                //prevents wetrooms turning into a wan die-fest
                this.changeHappiness(HAPPINESS_PENALTY_ATE_BODILY_WASTE * dt);
              }

              this.health = Math.max(0, this.health - 1 * dt);
              if (
                (typeof worldSettings === "undefined" || worldSettings.toxoplasmosis) &&
                !this.isToxoplasmosis &&
                Math.random() < 0.3 * dt &&
                puddle.color == "#5c4033"
              ) {
                this.isToxoplasmosis = true;
              }
              if (this.health <= 0) {
                this.anatomy.die(null, "Eating bodily waste");
                consumed = true;
              }
            }
          }
        }
      }
      if (!consumed && typeof objects !== "undefined") {
        const litterboxes = objects.filter((o) => o instanceof Litterbox);
        for (const lb of litterboxes) {
          if (lb.scene === this.scene && lb.currentCage === this.currentCage && lb.uses > 0) {
            const dLb = Math.sqrt((this.x - lb.x) ** 2 + (this.y - lb.y) ** 2);
            if (dLb < 50) {
              this.eatTimer += dt;
              this.hunger = Math.min(1.0, this.hunger + 0.1 * dt);
              if (this.eatTimer > 1.0) {
                lb.uses--;
                this.eatTimer = 0;
              }
              consumed = true;
            }
          }
        }
      }
    }
  },

  attemptUseTargetLitterbox() {
    if (!this.litterboxUsed) {
      return false;
    }
    const lx =
      this.litterboxUsed instanceof LitterpalBox ? this.litterboxUsed.getSeekingCoords(this).x : this.litterboxUsed.x;
    const ly =
      this.litterboxUsed instanceof LitterpalBox
        ? this.litterboxUsed.getSeekingCoords(this).y
        : this.litterboxUsed.y - 50;
    const dx = lx - this.x;
    const dy = ly - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 50) {
      return false;
    }
    this.targetX = null;
    this.targetY = null;

    if (this.litterboxUsed instanceof LitterpalBox) {
      this.x = this.litterboxUsed.getSeekingCoords(this).x;
      this.y = this.litterboxUsed.getSeekingCoords(this).y;
      this.facingRight = false;
    } else {
      this.x = this.litterboxUsed.x;
      this.y = this.litterboxUsed.y - 50;
    }
    this.attemptPoop();

    // Store a walk-away target as a flag so it survives any animation
    // states (e.g. ATTEMPTING_EXCRETION) that fire before the next move.
    // _pickNewTarget() will consume this on the fluffy's next movement decision.
    const walkAwayDist = 180;
    const angle = Math.random() * Math.PI * 2;
    this._pendingWalkAwayX = clamp(this.x + Math.cos(angle) * walkAwayDist, 100, sceneW(this.scene) - 100);
    const groundYMax = this.scene === "BACKYARD" ? height - 120 : sceneH(this.scene) - 50;
    this._pendingWalkAwayY = clamp(this.y + Math.sin(angle) * walkAwayDist, sceneTop(this.scene) + 50, groundYMax);

    return true;
  },

  attemptPoop() {
    if (Math.random() < Math.max(this.poopStorage, this.peeStorage)) {
      let excreteType = this.poopStorage > this.peeStorage ? "poop" : "pee";
      //Determines what the fluffy excretes.
      this.excrete(excreteType);
      this.litterboxUsed = null;
    } else {
      this.initBehavior("ATTEMPTING_EXCRETION");
      this.speak(getDialogue(["POOP", "PUSH"], this));
    }
  },

  excrete(type, amount) {
    if (!type) {
      type = this.poopStorage > this.peeStorage ? "poop" : "pee";
    }
    const isPoop = type === "poop";
    if (amount === undefined) {
      amount = isPoop ? this.poopStorage : this.peeStorage;
    }
    if (isPoop && amount > 0.05 && typeof fluffySound === "function") fluffySound(this, "shitting"); // FluffySounds.js

    // Check for nearby litterbox
    let nearLitterbox = this.positioning.isCloseToAnyLitterbox();
    let lbIsFull = nearLitterbox ? nearLitterbox.isFull() : false;

    // Reset storage
    if (type === "poop") {
      this.poopStorage = 0;
    } else if (type === "pee") {
      this.peeStorage = 0;
    }

    // Check for LitterpalBox
    if (this.placedOn instanceof LitterpalBox) {
      this.placedOn.use();
      this.goodPoopieTimer = 3.0;
      this.trainedForThisOccurrence = false;
    } else if (!nearLitterbox || lbIsFull) {
      if (nearLitterbox && lbIsFull) {
        this.speak(getDialogue(["POOP", "LITTERBOX_FULL"], this));
        this.goodPoopieTimer = 3.0; // Still a good attempt!
        this.trainedForThisOccurrence = false;
      } else {
        this.badPoopieTimer = 3.0;
        this.trainedForThisOccurrence = false;
      }

      if (this.pottyTraining > 0.2 && Math.random() < 0.5 && !lbIsFull && !nearLitterbox && !this.tooYoungToSpeak()) {
        this.speak(getDialogue(["POOP", "BAD"], this));
      }

      const puddleColor = isPoop ? "#5c4033" : "#f1c40f"; // Brown or Yellow
      const torsoWidth = this.layout ? this.layout.torso.w : 100;
      const offsetX = (torsoWidth / 2) * (this.facingRight ? -1 : 1) * this.scale;
      const pX = this.x + offsetX;
      const pY = this.getBottomY() - 10;

      // Size based on amount and growth
      const baseTargetScale = ((60 * amount) / 200) * Math.max(CHIRPY_THRESHOLD, this.growth);

      addPointToPuddle(this.scene, pX, pY, puddleColor, 5 / 200, baseTargetScale, 0.02);

      if (nearLitterbox && lbIsFull) {
        nearLitterbox.use();
      }
    } else {
      // Success! No puddle created.
      if (nearLitterbox instanceof LitterpalBox && nearLitterbox.securedFluffy) {
        // It's a Litterpal!
        this.speak(getDialogue(["LITTERPAL", "USE"]));
        if (
          (typeof worldSettings === "undefined" || worldSettings.toxoplasmosis) &&
          this.isToxoplasmosis &&
          Math.random() < 0.3
        ) {
          nearLitterbox.securedFluffy.isToxoplasmosis = true;
        }
        nearLitterbox.securedFluffy.hunger = Math.min(1.0, nearLitterbox.securedFluffy.hunger + 0.15);
        nearLitterbox.securedFluffy.speak(getDialogue(["LITTERPAL", "USE", "VICTIM"]));
        nearLitterbox.securedFluffy.changeHappiness(HAPPINESS_PENALTY_LITTERBOX_VICTIM);
        nearLitterbox.securedFluffy.expressionOverride = "MISERABLE";
        nearLitterbox.securedFluffy.expressionOverrideTimer = 3.0;
        if (this.gender === "male" && Math.random() < 0.3) {
          this.speak(getDialogue(["LITTERPAL", "USE", "MALE"]));
        }
        // Does not fill the box
      } else {
        nearLitterbox.use();
      }
      this.goodPoopieTimer = 3.0;
      this.trainedForThisOccurrence = false;

      if (this.pottyTraining < 1.0) {
        this.pottyTraining = Math.min(1.0, this.pottyTraining + 0.01);
      }
    }

    if (!this.tooYoungToWalk() && this.currentStateKey !== "SLEEPING") {
      this.initBehavior("BENDING_2");
      this.stateTimer = 0.5;
    }

    if (isPoop && Math.random() < 0.5 && !this.speech.text) {
      this.speak(getDialogue(["POOP", "FART"], this));
    }

    this.litterboxJitterOffset = 0;
  },

  excretePoop(dt) {
    if (typeof fluffySound === "function") fluffySound(this, "shitting"); // (the runs)
    const torsoWidth = this.layout ? this.layout.torso.w : 100;
    const offsetX = (torsoWidth / 2) * (this.facingRight ? -1 : 1) * this.scale;
    const pX = this.x + offsetX;
    const pY = this.getBottomY() - 10;
    const puddleColor = "#5c4033";

    // Increment area-based target scale
    const targetAddedAreaPerSec = 0.05;
    const targetScaleInc = Math.sqrt(targetAddedAreaPerSec * dt);

    const addedAreaPerSec = 0.01;
    const scaleInc = Math.sqrt(addedAreaPerSec * dt);

    addPointToPuddle(this.scene, pX, pY, puddleColor, scaleInc, targetScaleInc, 0.02);
  },

  excretePee(dt) {
    const torsoWidth = this.layout ? this.layout.torso.w : 100;
    const offsetX = (torsoWidth / 2) * (this.facingRight ? -0.5 : 0.5) * this.scale;
    const pX = this.x + offsetX;
    const pY = this.getBottomY() - 6;
    const puddleColor = "#f1c40f";

    // Increment area-based target scale
    const targetAddedAreaPerSec = 0.05;
    const targetScaleInc = Math.sqrt(targetAddedAreaPerSec * dt);

    const addedAreaPerSec = 0.01;
    const scaleInc = Math.sqrt(addedAreaPerSec * dt);

    addPointToPuddle(this.scene, pX, pY, puddleColor, scaleInc, targetScaleInc, 0.02);
  },

  excreteBlood(dt) {
    const pX = this.x;
    const pY = this.getBottomY();
    const puddleColor = "#8a0303";

    // Increment area-based target scale
    const targetAddedAreaPerSec = 0.1;
    const targetScaleInc = Math.sqrt(targetAddedAreaPerSec * dt);

    const addedAreaPerSec = 0.025;
    const scaleInc = Math.sqrt(addedAreaPerSec * dt);

    addPointToPuddle(this.scene, pX, pY, puddleColor, scaleInc, targetScaleInc, 0.02);
  },

  triggerVomit() {
    if (!this.isAlive) return;
    if (!this.avoidStateChangerActions()) return;

    this.initBehavior("VOMITING");
    this.expressionOverride = "MISERABLE";
    this.expressionOverrideTimer = 2.5;

    const phrase = Math.random() < 0.5 ? "*HACK* *GURGLE*" : "*GURGLEBARF*";
    this.speak(phrase);

    let px = this.x;
    let py = this.getBottomY();
    if (this.layout && this.layout.head) {
      const s = this.scale;
      const fx = this.facingRight ? 1 : -1;
      px = this.x + this.layout.head.x * s * fx;
      py = this.y + this.layout.head.y * s + 10;
    }

    if (typeof addPointToPuddle !== "undefined") {
      const vomitColor = "#4b5320"; // Putrid green
      const scale = (10 * this.scale) / 200;
      const targetScale = ((25 + Math.random() * 25) * this.scale) / 200;
      addPointToPuddle(this.scene, px, py, vomitColor, scale, targetScale, 0.08, "vomit");
    }
  },
});
