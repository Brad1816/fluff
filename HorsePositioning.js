class HorsePositioning {
  constructor(horse) {
    this.horse = horse;
  }

  scoutForBabies() {
    if (this.horse.speech.text) return false;

    const other = this.horse.tooFarFromBaby();
    if (other) {
      this.horse.speak(getDialogue("MUMMAH_COMIN", this.horse, other));

      // Initialize behavior first (resets target)
      this.horse.initBehavior("MOVING");
      let x = other.x + (Math.random() - 0.5) * 100;
      let y = other.y + (Math.random() - 0.5) * 50;

      const d = Math.sqrt((x - this.horse.x) ** 2 + (y - this.horse.y) ** 2);

      if (d < 50) {
        return false;
      }

      // Set actual target
      this.horse.setTargetPosition(x, y);
      if (d > 300 && !this.horse.isCrawling) {
        this.horse.currentStateKey = "RUNNING";
      } else {
        this.horse.currentStateKey = "MOVING";
      }
      return true;
    }
    return false;
  }

  scoutForHungryFoal() {
    if (this.horse.lactatingTimer <= 0 || this.horse.milkCharges <= 0)
      return false;

    const rels = relationships[this.horse.id];
    if (!rels) return false;

    let hungryFoal = null;
    let worstHunger = Infinity;

    for (const [id, relation] of Object.entries(rels)) {
      if (relation !== "baby_child") continue;
      const foal = fluffies.find(
        (f) =>
          f.id == id &&
          f.isAlive &&
          f.scene === this.horse.scene &&
          f.growth < 0.4,
      );
      if (foal && foal.hunger < 0.4 && foal.hunger < worstHunger) {
        worstHunger = foal.hunger;
        hungryFoal = foal;
      }
    }

    if (!hungryFoal) return false;

    const x = hungryFoal.x + (Math.random() - 0.5) * 100;
    const y = hungryFoal.y + (Math.random() - 0.5) * 50;

    const d = Math.sqrt(
      (this.horse.targetX - this.horse.x) ** 2 +
        (this.horse.targetY - this.horse.y) ** 2,
    );

    if (d < 40) {
      return false;
    }

    this.horse.initBehavior("MOVING");
    this.horse.setTargetPosition(x, y);
    if (d > 300 && !this.horse.isCrawling) {
      this.horse.currentStateKey = "RUNNING";
    }

    return true;
  }

  scoutForCannibalism() {
    const threshold = 0.25 + 0.3 * this.horse.cannibalismAcceptance;
    if (this.horse.hunger >= threshold || this.horse.tooYoungToWalk())
      return false;

    // Check for any filled food containers first
    if (typeof objects !== "undefined") {
      const bowls = objects.filter(
        (o) =>
          (o instanceof Bowl || o instanceof Grass) &&
          o.hasFood() &&
          o.scene === this.horse.scene &&
          o.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, o) &&
          (!(o instanceof Bowl) ||
            (o.type !== "feeder" && o.type !== "mega_feeder")),
      );
      if (bowls.length > 0) return false;
    }

    // 1. Look for Gibs
    if (typeof gibs !== "undefined") {
      let nearestGib = null;
      let minGibDist = Infinity;
      for (const gib of gibs) {
        if (
          gib.scene === this.horse.scene &&
          gib.freeGib &&
          !gib.shouldDespawn
        ) {
          const d = Math.sqrt(
            (this.horse.x - gib.x) ** 2 + (this.horse.y - gib.y) ** 2,
          );
          if (d < minGibDist) {
            minGibDist = d;
            nearestGib = gib;
          }
        }
      }

      if (nearestGib) {
        if (!this.horse.isMovingOrRunning()) {
          this.horse.initBehavior("MOVING");
        }
        this.horse.setTargetPosition(nearestGib.x, nearestGib.y);
        this.horse.cannibalTarget = nearestGib;
        return true;
      }
    }

    // 2. Look for Corpses
    let nearestCorpse = null;
    let minCorpseDist = Infinity;
    for (const f of fluffies) {
      if (
        !f.isAlive &&
        f !== this.horse &&
        f.scene === this.horse.scene &&
        f.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, f) &&
        !this.horse.fluffyIsRelatedOrSpecialFriend(f)
      ) {
        const d = Math.sqrt(
          (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
        );
        if (d < minCorpseDist) {
          minCorpseDist = d;
          nearestCorpse = f;
        }
      }
    }

    if (nearestCorpse) {
      if (!this.horse.isMovingOrRunning()) {
        this.horse.initBehavior("MOVING");
      }
      this.horse.setTargetPosition(nearestCorpse.x, nearestCorpse.y);
      this.horse.cannibalTarget = nearestCorpse;
      return true;
    }

    // 3. Look for Victims
    let nearestVictim = null;
    let minVictimDist = Infinity;
    for (const f of fluffies) {
      if (
        f !== this.horse &&
        f.isAlive &&
        f.scene === this.horse.scene &&
        f.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, f) &&
        !this.horse.fluffyIsRelatedOrSpecialFriend(f)
      ) {
        const d = Math.sqrt(
          (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
        );
        if (d < minVictimDist) {
          minVictimDist = d;
          nearestVictim = f;
        }
      }
    }

    if (nearestVictim) {
      if (!this.horse.isMovingOrRunning()) {
        this.horse.initBehavior("MOVING");
      }
      this.horse.setTargetPosition(nearestVictim.x, nearestVictim.y);
      this.horse.cannibalTarget = nearestVictim;
      if (!this.horse.isMovingOrRunning()) {
        this.horse.initBehavior("RUNNING");
      }
      return true;
    }

    return false;
  }

  bystanderAttemptInterruptMating() {
    if (
      this.horse.gender !== "male" ||
      !this.horse.isAlive ||
      this.horse.tooYoungToWalk() ||
      !this.horse.avoidStateChangerActions() ||
      this.horse.isSmarty()
    )
      return false;

    let targetMatingSession = null;
    let minDist = Infinity;

    for (const f of fluffies) {
      if (
        f !== this.horse &&
        f.scene === this.horse.scene &&
        f.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, f)
      ) {
        if (
          f.matingState &&
          f.matingState.isMating &&
          f.matingState.interruptible &&
          f.gender === "male"
        ) {
          const d = Math.sqrt(
            (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
          );
          if (d < minDist) {
            minDist = d;
            targetMatingSession = f;
          }
        }
      }
    }

    if (targetMatingSession) {
      if (minDist < 50) {
        // Interruption logic: Attack the mating male
        if (this.horse.attackCooldown <= 0) {
          const victim = targetMatingSession.matingState?.matingWith;
          const saveKey =
            victim?.gender === "male"
              ? ["FLUFFY_SAVE_FROM_BAD_ENFIES", "STALLION"]
              : ["FLUFFY_SAVE_FROM_BAD_ENFIES", "MARE"];
          this.horse.speak(getDialogue(saveKey, this.horse, victim));
          this.horse.performAttack(targetMatingSession, false);
          targetMatingSession.interruptMating();
        }
      } else {
        // Move towards the session
        if (!this.horse.isMovingOrRunning()) {
          this.horse.initBehavior("MOVING");
        }
        this.horse.setTargetPosition(
          targetMatingSession.x,
          targetMatingSession.y,
        );
        if (this.horse.speech.timer <= 0) {
          const victim = targetMatingSession.matingState?.matingWith;
          const saveKey =
            victim?.gender === "male"
              ? ["FLUFFY_SAVE_FROM_BAD_ENFIES", "STALLION"]
              : ["FLUFFY_SAVE_FROM_BAD_ENFIES", "MARE"];
          this.horse.speak(getDialogue(saveKey, this.horse, victim));
        }
        if (!this.horse.isMovingOrRunning()) {
          this.horse.initBehavior("RUNNING");
        }
      }
      return true;
    }

    return false;
  }

  scoutForSleep() {
    if (this.horse.sleepTargetSet) return true;

    if (this.horse.happiness <= WAN_DIE_THRESHOLD) {
      this.horse.initBehavior("SLEEPING");
      return true;
    }

    // Head to claimed bed if it's in the same scene/cage
    if (this.horse.claimedBed) {
      const bed = this.horse.claimedBed;
      if (
        bed.scene === this.horse.scene &&
        bed.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, bed)
      ) {
        const targetY =
          bed.type === "cardboard_box"
            ? bed.y + CARDBOARD_BOX_SLEEP_OFFSET
            : bed.y;
        const d = Math.sqrt(
          (this.horse.x - bed.x) ** 2 + (this.horse.y - targetY) ** 2,
        );
        if (d < 50) {
          this.horse.initBehavior("SLEEPING");
          return true;
        }

        if (!this.horse.isMovingOrRunning()) {
          this.horse.initBehavior("MOVING");
        }
        this.horse.setTargetPosition(bed.x, targetY);
        this.horse.sleepTargetSet = true;
        return true;
      }
    }

    // Find nearest claimable bed in same scene/cage
    if (!this.horse.tooYoungToWalk() && typeof objects !== "undefined") {
      let bestBed = null;
      let bestDist = Infinity;
      for (const o of objects) {
        if (!(o instanceof Bed)) continue;
        if (
          o.scene !== this.horse.scene ||
          (o.currentCage !== this.horse.currentCage ||
            !fenceCanReachThing(this.horse, o))
        )
          continue;
        if (!o.canAccept(this.horse)) continue;
        const targetY =
          o.type === "cardboard_box" ? o.y + CARDBOARD_BOX_SLEEP_OFFSET : o.y;
        const d = Math.sqrt(
          (this.horse.x - o.x) ** 2 + (this.horse.y - targetY) ** 2,
        );
        if (d < bestDist) {
          bestDist = d;
          bestBed = o;
        }
      }
      if (bestBed) {
        const targetY =
          bestBed.type === "cardboard_box"
            ? bestBed.y + CARDBOARD_BOX_SLEEP_OFFSET
            : bestBed.y -
              (this.horse.renderer.tinted.torso.height +
                this.horse.renderer.layout.stretch) *
                0.8 *
                this.horse.scale;
        if (bestDist < 50) {
          this.horse.initBehavior("SLEEPING");
          return true;
        }

        if (!this.horse.isMovingOrRunning()) {
          this.horse.initBehavior("MOVING");
        }
        this.horse.setTargetPosition(bestBed.x, targetY);
        this.horse.sleepTargetSet = true;
        return true;
      }
    }

    let nearestSleeper = null;
    let minDist = Infinity;
    let bestScore = Infinity;

    if (this.horse.canSee()) {
      for (const f of fluffies) {
        if (
          f !== this.horse &&
          f.scene === this.horse.scene &&
          f.currentStateKey === "SLEEPING" &&
          f.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, f) &&
          (!worldSettings.alicornIntolerance ||
            f.typeVisibleToOthers() !== "alicorn" ||
            this.horse.tolerantOfAlicorns())
        ) {
          const d = Math.sqrt(
            (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
          );
          // Only snuggle up with fluffies it gets on with: herd-mates,
          // family and buddies first, never rivals (Bonds.js)
          const score =
            typeof sleepBuddyScore === "function" ? sleepBuddyScore(this.horse, f, d) : d;
          if (score === null) continue;

          if (score < bestScore) {
            bestScore = score;
            minDist = d;
            nearestSleeper = f;
          }
        }
      }
    }

    // In the park: first get to the herd / away from rivals (Bonds.js)
    const moveFirst =
      typeof sleepSpotAwayFromRivals === "function" &&
      (!nearestSleeper || minDist < 80) &&
      sleepSpotAwayFromRivals(this.horse, !!nearestSleeper);
    if (moveFirst) {
      if (!this.horse.isMovingOrRunning()) this.horse.initBehavior("MOVING");
      this.horse.setTargetPosition(moveFirst.x, moveFirst.y);
      this.horse.sleepTargetSet = true;
      return true;
    }
    this.horse._sleepMoves = 0;

    if (nearestSleeper) {
      if (minDist < 80) {
        this.horse.initBehavior("SLEEPING");
        return true;
      }

      let x = nearestSleeper.x + (Math.random() - 0.5) * 80;
      let y = nearestSleeper.y + (Math.random() - 0.5) * 40;

      if (!this.horse.isMovingOrRunning()) {
        this.horse.initBehavior("MOVING");
      }
      this.horse.setTargetPosition(x, y);
      this.horse.sleepTargetSet = true;
    } else {
      this.horse.initBehavior("SLEEPING");
    }

    return true;
  }

  scoutForHunger() {
    if (this.horse.isUnderAphrodisiac()) return false;
    if (!(this.horse.hunger < 0.6 && typeof objects !== "undefined"))
      return false;

    const isGagged =
      this.horse.accessories &&
      this.horse.accessories.mouth &&
      this.horse.accessories.mouth.id === "mouthgag";
    if (isGagged) return false;

    if (this.horse.tooYoungToWalk()) {
      return false;
    }

    // Adults seek bowls (non-feeder)
    // Prioritize Sketties, then closest.
    // Must match cage state.

    const bowls = objects.filter(
      (o) => o instanceof Bowl || o instanceof Grass,
    );
    let bestBowl = null;
    let maxPriority = -Infinity;
    let minDst = Infinity;
    // In the big park, distance matters too: better food is worth a walk,
    // but not right across the park (each priority step = 150px)
    const farAway = typeof isCameraScene === "function" && isCameraScene(this.horse.scene);
    let bestScore = Infinity;
    let refused = null;

    for (const b of bowls) {
      if (b instanceof Bowl) {
        if (b.type === "feeder" || b.type === "mega_feeder") continue;
      }
      if (!b.hasFood()) continue;
      if (b.scene !== this.horse.scene) continue;

      // Cage accessibility check
      if (this.horse.currentCage !== b.currentCage) continue;
      if (!fenceCanReachThing(this.horse, b)) continue;

      // What THIS fluffy likes (Diet.js); food it won't eat is skipped
      const ft = typeof foodTypeOf === "function" ? foodTypeOf(b) : b.foodType;
      if (typeof refusesFood === "function" && refusesFood(this.horse, ft)) {
        refused = ft;
        continue;
      }
      const prio =
        typeof foodPriorityFor === "function"
          ? foodPriorityFor(this.horse, ft)
          : b.priority !== undefined ? b.priority : getFoodPriority(b.foodType);
      const dst = (this.horse.x - b.x) ** 2 + (this.horse.y - b.y) ** 2;

      if (farAway) {
        let score = Math.sqrt(dst) - prio * 150;
        // Own land first; other herds' land only when starving (Territory.js)
        if (typeof territoryFoodBias === "function") score += territoryFoodBias(this.horse, b);
        if (score < bestScore) {
          bestScore = score;
          bestBowl = b;
        }
        continue;
      }

      if (prio > maxPriority) {
        maxPriority = prio;
        minDst = dst;
        bestBowl = b;
      } else if (prio === maxPriority && dst < minDst) {
        minDst = dst;
        bestBowl = b;
      }
    }

    if (bestBowl) {
      if (!this.horse.isMovingOrRunning()) {
        this.horse.initBehavior("MOVING");
      }
      this.horse.setTargetPosition(bestBowl.x, bestBowl.y);
      return true;
    }
    // Only food it won't eat: grumble (Diet.js)
    if (refused && typeof grumbleAboutFood === "function") grumbleAboutFood(this.horse, refused);

    return false;
  }

  scoutForFallbackHunger() {
    if (this.horse.hunger >= 0.3 || this.horse.tooYoungToWalk()) return false;

    let bestTarget = null;
    let minDist = Infinity;

    // Check Puddles (seeking nearest POINT, not anchor)
    if (typeof puddles !== "undefined") {
      for (const puddle of puddles) {
        if (puddle.scene !== this.horse.scene || puddle.points.length === 0)
          continue;
        // Starving fluffies eat waste, not water or tears (Puddle.js)
        if (typeof isBodilyWaste === "function" && !isBodilyWaste(puddle.color)) continue;

        for (const pt of puddle.points) {
          const px = pt.x;
          const py = pt.y;
          const d = (this.horse.x - px) ** 2 + (this.horse.y - py) ** 2;

          if (d < minDist) {
            minDist = d;
            bestTarget = { x: px, y: py };
          }
        }
      }
    }

    // Check Litterboxes
    if (typeof objects !== "undefined") {
      const litterboxes = objects.filter((o) => o instanceof Litterbox);
      for (const lb of litterboxes) {
        if (
          lb.scene === this.horse.scene &&
          lb.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, lb) &&
          lb.uses > 0
        ) {
          const d = (this.horse.x - lb.x) ** 2 + (this.horse.y - lb.y) ** 2;
          if (d < minDist) {
            minDist = d;
            bestTarget = { x: lb.x, y: lb.y };
          }
        }
      }
    }

    if (bestTarget) {
      if (minDist < 1600) {
        // 40^2
        this.horse.initBehavior("EATING");
      } else {
        if (!this.horse.isMovingOrRunning()) {
          this.horse.initBehavior("MOVING");
        }
        this.horse.setTargetPosition(bestTarget.x, bestTarget.y);
      }

      return true;
    }
    return false;
  }

  scoutForLitterbox() {
    if (this.horse.isSmarty()) return false;
    if (
      !(
        (this.horse.poopStorage > 0.5 || this.horse.peeStorage > 0.5) &&
        typeof objects !== "undefined" &&
        !this.isCloseToAnyLitterbox()
      )
    )
      return false;

    let bestLb = null;
    let minDist = Infinity;

    // Prioritize Litterpals (LitterpalBox with a fluffy)
    const boxes = objects.filter((o) => o instanceof LitterpalBox);
    for (const box of boxes) {
      const isGagged =
        box.securedFluffy &&
        box.securedFluffy.accessories &&
        box.securedFluffy.accessories.mouth &&
        box.securedFluffy.accessories.mouth.id === "mouthgag";
      if (
        box.securedFluffy &&
        !isGagged &&
        box.scene === this.horse.scene &&
        box.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, box)
      ) {
        let x = box.getSeekingCoords(this.horse).x;
        let y = box.getSeekingCoords(this.horse).y;
        const d = (this.horse.x - x) ** 2 + (this.horse.y - y) ** 2;
        if (d < minDist) {
          minDist = d;
          bestLb = box;
        }
      }
    }

    // If the best Litterpal already has another fluffy en-route, skip it and use a regular box
    if (bestLb instanceof LitterpalBox) {
      const alreadySeeking = fluffies.some(
        (f) => f !== this.horse && f.litterboxUsed === bestLb,
      );
      if (alreadySeeking) bestLb = null;
    }

    // If no Litterpal found, look for normal litterboxes
    if (!bestLb) {
      const litterboxes = objects.filter((o) => o instanceof Litterbox);
      for (const lb of litterboxes) {
        if (
          lb.scene === this.horse.scene &&
          lb.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, lb)
        ) {
          const d =
            (this.horse.x - lb.x) ** 2 + (this.horse.y - lb.y + 50) ** 2;
          if (d < minDist) {
            minDist = d;
            bestLb = lb;
          }
        }
      }
    }

    if (bestLb) {
      if (bestLb instanceof LitterpalBox) {
        this.horse.initBehavior("MOVING");
        this.horse.setTargetPosition(
          bestLb.getSeekingCoords(this.horse).x,
          bestLb.getSeekingCoords(this.horse).y,
        );
      } else {
        this.horse.initBehavior("MOVING");
        this.horse.setTargetPosition(bestLb.x, bestLb.y);
      }
      this.horse.litterboxUsed = bestLb;
      return true;
    }
    return false;
  }

  isCloseToLitterbox(lb) {
    if (!lb) return false;
    if (lb.scene !== this.horse.scene) return false;
    if ((lb.currentCage !== this.horse.currentCage ||
            !fenceCanReachThing(this.horse, lb))) return false;
    let lbx =
      lb instanceof LitterpalBox ? lb.getSeekingCoords(this.horse).x : lb.x;
    let lby =
      lb instanceof LitterpalBox ? lb.getSeekingCoords(this.horse).y : lb.y;
    return (
      Math.sqrt((lbx - this.horse.x) ** 2 + (lby - this.horse.y) ** 2) < 75
    );
  }

  isCloseToAnyLitterbox() {
    if (typeof objects === "undefined") return null;

    // Prioritize Litterpals
    const boxes = objects.filter((o) => o instanceof LitterpalBox);
    for (const box of boxes) {
      if (box.securedFluffy && this.isCloseToLitterbox(box)) {
        return box;
      }
    }

    let fullBox = null;
    const litterboxes = objects.filter((o) => o instanceof Litterbox);
    for (const lb of litterboxes) {
      if (!this.isCloseToLitterbox(lb)) continue;
      if (!lb.isFull()) {
        return lb; // Found a non-full box, return immediately
      }
      if (!fullBox) {
        fullBox = lb; // Keep track of the first full box found
      }
    }
    return fullBox; // Return the first full box if no non-full boxes were found
  }

  scoutForTV() {
    if (
      !this.horse.isAlive ||
      !this.horse.canSee() ||
      this.horse.tooYoungToSpeak() ||
      this.horse.happiness <= WAN_DIE_THRESHOLD ||
      this.horse.speech.timer > 0 ||
      this.horse.isScared ||
      this.horse.isFrantic ||
      !this.horse.avoidStateChangerActions()
    )
      return false;

    let closestTV = null;
    for (const obj of objects) {
      if (
        obj instanceof FluffTV &&
        obj.channel !== "OFF" &&
        obj.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, obj) &&
        obj.scene === this.horse.scene
      ) {
        const dist = Math.sqrt(
          (this.horse.x - obj.x) ** 2 + (this.horse.y - obj.y) ** 2,
        );
        if (closestTV) {
          const cdist = Math.sqrt(
            (this.horse.x - closestTV.x) ** 2 +
              (this.horse.y - closestTV.y) ** 2,
          );
          if (dist < cdist) closestTV = obj;
        } else {
          closestTV = obj;
        }
      }
    }
    if (closestTV) {
      if (!this.horse.isMovingOrRunning()) {
        this.horse.initBehavior("MOVING");
      }
      this.horse.setTargetPosition(
        closestTV.x - 20 + 40 * Math.random(),
        closestTV.y + 40 - 5 + 10 * Math.random(),
      );
      return true;
    }
    return false;
  }

  scoutForBall() {
    if (
      !this.horse.canSee() ||
      this.horse.isDragging ||
      this.horse.ballTarget ||
      this.horse.blockTarget ||
      this.horse.blockTowerKnockOverTarget ||
      this.horse.currentCage ||
      !canRun(this.horse)
    )
      return false;

    const balls = objects.filter((o) => o instanceof Ball);
    const stillBall = balls.find(
      (b) =>
        b.scene === this.horse.scene &&
        !b.currentCage &&
        !(typeof isBallCarried === "function" ? isBallCarried(b) : b.carriedBy) &&
        b.isStill() &&
        !fluffies.some((f) => f.ballTarget && f.targetX === b.x),
    );
    if (stillBall) {
      this.horse.ballTarget = true;
      this.horse.initBehavior("MOVING");
      this.horse.setTargetPosition(stillBall.x, stillBall.y);
      return true;
    }
    return false;
  }

  scoutForBlock() {
    if (
      !this.horse.canSee() ||
      this.horse.isDragging ||
      this.horse.blockTarget ||
      this.horse.blockTowerKnockOverTarget ||
      this.horse.currentCage ||
      this.horse.isStacking ||
      this.horse.blockCooldown > 0 ||
      !this.horse.limbs.legs[1] ||
      !this.horse.limbs.legs[2] ||
      this.horse.ballTarget
    )
      return false;

    const blocks = objects.filter((o) => o instanceof Block);
    const sceneBlocks = blocks.filter(
      (b) =>
        b.scene === this.horse.scene &&
        !b.currentCage &&
        (!b.heldBy || b.heldBy === this.horse),
    );
    if (sceneBlocks.length >= 2) {
      if (!this.horse.hasBlockOnBack() && canRun(this.horse)) {
        this.horse.attemptFindBlocksToStackOrKnock(sceneBlocks);
        return true; // We assume attemptFind... sets target
      } else if (this.horse.hasBlockOnBack()) {
        const targetBlock = sceneBlocks.find(
          (b) =>
            !b.heldBy &&
            b !== this.horse.blockOnBack &&
            !fluffies.some((f) => f.blockTarget && f.targetX === b.x) &&
            !b.getStackedAbove() &&
            !b.isDragging &&
            b.isStill(),
        );
        if (targetBlock) {
          this.horse.blockTarget = true;
          this.horse.initBehavior("MOVING");
          let targetX = targetBlock.x;
          let targetY = targetBlock.getBottomY() - 50;
          this.horse.setTargetPosition(targetX, targetY);
          return true;
        }
      }
    }
    return false;
  }

  findSmartyMateTarget() {
    let minDist = Infinity;
    let target = null;
    for (const f of fluffies) {
      if (
        f !== this.horse &&
        f.growth >= 1.0 &&
        f.isAlive &&
        f.scene === this.horse.scene &&
        !f.isDragging &&
        f.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, f) &&
        placedOnValidForSpecialHuggies(f.placedOn) &&
        canFluffiesMate(this.horse, f, true)
      ) {
        const d = Math.sqrt(
          (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
        );
        if (d < minDist) {
          minDist = d;
          target = f;
        }
      }
    }
    return target;
  }

  findAphrodisiacMateTarget() {
    // Preference is given to an existing special friend, but otherwise any compatible adult
    const rels =
      typeof relationships !== "undefined"
        ? relationships[this.horse.id]
        : null;
    if (rels) {
      const friendId = Object.keys(rels).find(
        (id) => rels[id] === "special_friend",
      );
      if (friendId) {
        const friend = fluffies.find(
          (f) =>
            f.id == friendId &&
            f.isAlive &&
            f.scene === this.horse.scene &&
            !f.isDragging &&
            f.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, f) &&
            placedOnValidForSpecialHuggies(f.placedOn) &&
            f.growth >= 1.0 &&
            canFluffiesMate(this.horse, f, true),
        );
        if (friend) return friend;
      }
    }

    let minDist = Infinity;
    let target = null;
    for (const f of fluffies) {
      if (
        f !== this.horse &&
        f.growth >= 1.0 &&
        f.isAlive &&
        f.scene === this.horse.scene &&
        !f.isDragging &&
        f.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, f) &&
        placedOnValidForSpecialHuggies(f.placedOn) &&
        canFluffiesMate(this.horse, f, true)
      ) {
        const d = Math.sqrt(
          (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
        );
        if (d < minDist) {
          minDist = d;
          target = f;
        }
      }
    }
    return target;
  }

  findSpecialFriend(allowPregnant = false) {
    const rels =
      typeof relationships !== "undefined"
        ? relationships[this.horse.id]
        : null;
    if (!rels) return null;
    const friendId = Object.keys(rels).find(
      (id) => rels[id] === "special_friend",
    );
    if (friendId) {
      return fluffies.find(
        (f) =>
          f.id == friendId &&
          f.isAlive &&
          f.scene === this.horse.scene &&
          !f.isDragging &&
          f.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, f) &&
          (allowPregnant || !f.isPregnant),
      );
    }
    return null;
  }

  findCompatibleFriendToPropose() {
    if (!this.horse.canSee()) return null;
    let potentialSpecialFriend = null;
    let minDist = Infinity;
    const rels =
      typeof relationships !== "undefined"
        ? relationships[this.horse.id]
        : null;
    if (!rels) return null;
    for (const f of fluffies) {
      if (this.horse.gender === "female" && f.gender !== "female") continue;
      if (
        f.growth >= 1.0 &&
        f.scene === this.horse.scene &&
        f.isAlive &&
        f.id !== this.horse.id &&
        !f.isDragging &&
        f.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, f) &&
        !this.horse.fluffyIsRelatedOrSpecialFriend(f) &&
        !f.fearedFluffies.some((ff) => ff.id === this.horse.id) &&
        rels[f.id] === "friend" &&
        !this.horse.friendshipCooldowns[f.id] &&
        isSexuallyAttractedTo(this.horse, f)
      ) {
        const d = Math.sqrt(
          (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
        );
        if (d < minDist && d < 150) {
          minDist = d;
          potentialSpecialFriend = f;
        }
      }
    }
    if (
      potentialSpecialFriend &&
      this.horse.avoidStateChangerActions() &&
      potentialSpecialFriend.avoidStateChangerActions()
    ) {
      return potentialSpecialFriend;
    }
    return null;
  }

  _pickNewTarget() {
    // In labor and heading to her bed — keep re-targeting it until she arrives or times out
    if (this.horse.seekingBirthBed) {
      const bed = this.horse.claimedBed;
      if (bed && bed.scene === this.horse.scene) {
        this.horse.targetX = bed.x;
        this.horse.targetY = bed.y;
        return;
      }
      this.horse.seekingBirthBed = false;
    }

    if (this.horse._pendingWalkAwayX !== undefined) {
      this.horse.setTargetPosition(
        this.horse._pendingWalkAwayX,
        this.horse._pendingWalkAwayY,
      );
      this.horse._pendingWalkAwayX = undefined;
      this.horse._pendingWalkAwayY = undefined;
      return;
    }

    const topWallHeight = sceneTop(this.horse.scene);
    const margin = 100;
    let minX = margin;

    const groundYMin = topWallHeight + 50;
    const groundYMax =
      this.horse.scene === "BACKYARD" ? sceneH(this.horse.scene) - 120 : sceneH(this.horse.scene) - 50;

    if (this.horse.isFrantic && this.horse.hunger > 0.5) {
      // Frantic random movement
      let x = Math.random() * (sceneW(this.horse.scene) - margin - minX) + minX;
      let y = Math.random() * (groundYMax - groundYMin) + groundYMin;
      this.horse.setTargetPosition(x, y);
      return;
    }

    // Adopted / Door Seeking Logic (OUTDOORS)
    if (this.horse.adopted && this.horse.scene === "OUTDOORS") {
      const doorCenterX = width / 2;
      const doorBottomY = topWallHeight;

      let targetX = doorCenterX + (Math.random() - 0.5) * 150;
      let targetY = doorBottomY + 50 + Math.random() * 100;

      targetX = clamp(targetX, minX, sceneW(this.horse.scene) - margin);
      targetY = clamp(targetY, groundYMin, groundYMax);

      this.horse.setTargetPosition(targetX, targetY);
      return;
    }

    // Relationship Following Override
    if (this.horse.growth < 0.4 && this.horse.motherId !== undefined) {
      const mom = fluffies.find(
        (f) =>
          f.id === this.horse.motherId &&
          f.isAlive &&
          f.scene === this.horse.scene,
      );
      if (mom) {
        // If mom is heading to the bathroom, stay at her bed instead of following
        if (
          mom.litterboxUsed &&
          mom.claimedBed &&
          mom.claimedBed.scene === this.horse.scene &&
          mom.claimedBed.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, mom.claimedBed)
        ) {
          const bed = mom.claimedBed;
          const targetX = clamp(
            bed.x + (Math.random() - 0.5) * 100,
            minX,
            sceneW(this.horse.scene) - margin,
          );
          const targetY = clamp(
            bed.y + (Math.random() - 0.5) * 50,
            groundYMin,
            groundYMax,
          );
          this.horse.setTargetPosition(targetX, targetY);
          return;
        }

        let targetX = mom.x + (Math.random() - 0.5) * 150;
        let targetY = mom.y + (Math.random() - 0.5) * 100;
        targetY = clamp(this.horse.targetY, groundYMin, groundYMax);
        targetX = clamp(this.horse.targetX, minX, sceneW(this.horse.scene) - margin);

        this.horse.setTargetPosition(targetX, targetY);
        return;
      }
    }

    // Soft-leash older foals (past the follow-mom stage, not yet adult) to mom's bed
    if (
      this.horse.growth >= 0.4 &&
      this.horse.growth < 1.0 &&
      this.horse.motherId !== undefined
    ) {
      const mom = fluffies.find(
        (f) =>
          f.id === this.horse.motherId &&
          f.isAlive &&
          f.scene === this.horse.scene,
      );
      if (
        mom &&
        mom.claimedBed &&
        mom.claimedBed.scene === this.horse.scene &&
        mom.claimedBed.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, mom.claimedBed)
      ) {
        const bed = mom.claimedBed;
        const leashRadius = 250;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * leashRadius;
        const targetX = clamp(
          bed.x + Math.cos(angle) * dist,
          minX,
          sceneW(this.horse.scene) - margin,
        );
        const targetY = clamp(
          bed.y + Math.sin(angle) * dist,
          groundYMin,
          groundYMax,
        );
        this.horse.setTargetPosition(targetX, targetY);
        return;
      }
    }

    // Lactating mom with nursing-age foals anchors near her bed between need runs
    if (
      this.horse.lactatingTimer > 0 &&
      this.horse.claimedBed &&
      this.horse.claimedBed.scene === this.horse.scene &&
      this.horse.claimedBed.currentCage === this.horse.currentCage &&
        fenceCanReachThing(this.horse, this.horse.claimedBed)
    ) {
      const rels = relationships[this.horse.id];
      const hasNursingFoal =
        rels &&
        Object.keys(rels).some((id) => {
          if (rels[id] !== "baby_child") return false;
          const foal = fluffies.find(
            (f) => f.id == id && f.isAlive && f.scene === this.horse.scene,
          );
          return foal && foal.growth < 0.4;
        });
      if (hasNursingFoal) {
        const bed = this.horse.claimedBed;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 120;
        const targetX = clamp(
          bed.x + Math.cos(angle) * dist,
          minX,
          sceneW(this.horse.scene) - margin,
        );
        const targetY = clamp(
          bed.y + Math.sin(angle) * dist,
          groundYMin,
          groundYMax,
        );
        this.horse.setTargetPosition(targetX, targetY);
        return;
      }
    }

    // Mom biases target towards baby
    const rels = relationships[this.horse.id];
    if (rels) {
      const childId = Object.keys(rels).find((id) => rels[id] === "baby_child");
      if (childId) {
        const child = fluffies.find(
          (f) => f.id == childId && f.isAlive && f.scene === this.horse.scene,
        );
        if (child) {
          let targetX = child.x + (Math.random() - 0.5) * 250;
          let targetY = child.y + (Math.random() - 0.5) * 150;
          targetY = clamp(targetY, groundYMin, groundYMax);
          targetX = clamp(targetX, minX, sceneW(this.horse.scene) - margin);

          this.horse.setTargetPosition(targetX, targetY);
          return;
        }
      }
    }

    if (rels && this.horse.growth >= 1.0 && Math.random() < 0.7) {
      const hasSpecialFriend = Object.keys(rels).find(
        (id) => rels[id] === "special_friend",
      );
      if (hasSpecialFriend) {
        const friend = fluffies.find(
          (f) =>
            f.id == hasSpecialFriend &&
            f.isAlive &&
            f.scene === this.horse.scene,
        );
        if (friend) {
          let targetX = friend.x + (Math.random() - 0.5) * 20;
          let targetY = friend.y + (Math.random() - 0.5) * 10;
          targetY = clamp(targetY, groundYMin, groundYMax);
          targetX = clamp(targetX, minX, sceneW(this.horse.scene) - margin);
          this.horse.setTargetPosition(targetX, targetY);
          return;
        }
      }
    }

    // Regular Friend Wandering - Search for CLOSEST friend
    if (rels && Math.random() < 0.4) {
      let closestFriend = null;
      let minDist = Infinity;
      for (const f of fluffies) {
        if (
          f !== this.horse &&
          f.isAlive &&
          f.scene === this.horse.scene &&
          rels[f.id] === "friend"
        ) {
          const d = Math.sqrt(
            (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
          );
          if (d < minDist) {
            minDist = d;
            closestFriend = f;
          }
        }
      }
      if (closestFriend) {
        let targetX = closestFriend.x + (Math.random() - 0.5) * 80;
        let targetY = closestFriend.y + (Math.random() - 0.5) * 40;
        targetY = clamp(targetY, groundYMin, groundYMax);
        targetX = clamp(targetX, minX, sceneW(this.horse.scene) - margin);
        this.horse.setTargetPosition(targetX, targetY);
        return;
      }
    }

    // Avoid picking a rest/play target on top of bowls or litterboxes.
    // Try up to 5 candidates and take the first one that isn't crowded.
    const avoidObjects =
      typeof objects !== "undefined"
        ? objects.filter(
            (o) =>
              o.scene === this.horse.scene &&
              (o instanceof Bowl ||
                o instanceof Grass ||
                o instanceof Litterbox ||
                o instanceof LitterpalBox),
          )
        : [];
    const avoidRadius = 120;

    // If there are fences here, only wander to spots the fluffy can actually
    // walk to, maybe the long way round through an open gate (so penned
    // fluffies wander around inside their pen).
    const hasFences =
      typeof sceneHasFences === "function" &&
      sceneHasFences(this.horse.scene);
    const maxAttempts = hasFences ? 20 : 5;

    let targetX, targetY;
    let goodX = this.horse.x,
      goodY = this.horse.y;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      targetX = Math.random() * (sceneW(this.horse.scene) - margin - minX) + minX;
      targetY = Math.random() * (groundYMax - groundYMin) + groundYMin;
      if (hasFences) {
        // Later attempts look closer by, which works better in small pens
        if (attempt >= 10) {
          targetX = clamp(
            this.horse.x + (Math.random() - 0.5) * 300,
            minX,
            sceneW(this.horse.scene) - margin,
          );
          targetY = clamp(
            this.horse.y + (Math.random() - 0.5) * 200,
            groundYMin,
            groundYMax,
          );
        }
        if (!canFluffyReach(this.horse, targetX, targetY)) continue;
      }
      goodX = targetX;
      goodY = targetY;
      const tooClose = avoidObjects.some((o) => {
        const dx = targetX - o.x;
        const dy = targetY - o.y;
        return Math.sqrt(dx * dx + dy * dy) < avoidRadius;
      });
      if (!tooClose) break;
    }
    if (hasFences) {
      // Use the last reachable spot found (or stay put if there was none)
      targetX = goodX;
      targetY = goodY;
    }
    this.horse.setTargetPosition(targetX, targetY);
  }

  pickNewTarget() {
    this._pickNewTarget();
    if (this.horse.currentCage) {
      this.constrainTargetToCage();
    }
  }

  constrainTargetToCage() {
    if (!this.horse.currentCage) return;

    const extents = this.getExtentsForCage();
    const localLeft = extents.left - this.horse.x;
    const localRight = extents.right - this.horse.x;
    const localBottom = extents.bottom - this.horse.y;

    const b = this.horse.currentCage.bounds;

    this.horse.targetY = b.bottom - localBottom;
    this.horse.targetX = clamp(
      this.horse.targetX,
      b.left - localLeft,
      b.right - localRight,
    );
  }

  attemptAlicornFear(alicorn, oldScared) {
    if (!worldSettings.alicornIntolerance) return;
    // If this is an intolerant mother and the target is her alicorn offspring, attack it.
    const rels = relationships[this.horse.id];
    const isMyAlicornChild =
      this.horse.gender === "female" &&
      rels &&
      (rels[alicorn.id] === "child" ||
        rels[alicorn.id] === "baby_child" ||
        rels[alicorn.id] === "estranged_child");

    if (isMyAlicornChild) {
      const d = Math.sqrt(
        (this.horse.x - alicorn.x) ** 2 + (this.horse.y - alicorn.y) ** 2,
      );
      if (d < 50) {
        if (this.horse.attackCooldown <= 0) {
          this.horse.performAttack(alicorn, false);
        }
      } else {
        // Chase it
        this.horse.setTargetPosition(alicorn.x, alicorn.y);
        if (!this.horse.isMovingOrRunning()) {
          this.horse.initBehavior("RUNNING");
        }
      }
      this.horse.isScared = false; // Not scared, angry/aggressive
      return;
    }

    if (!oldScared) {
      this.horse.speech.nextTime = 0;
      this.horse.setShock(3.0);
    }
    this.horse.isScared = true;
    this.horse.scaredTimer = 2.0;
    const target = this.getRunawayTarget(alicorn.x, alicorn.y);
    if (!this.horse.isMovingOrRunning()) {
      this.horse.initBehavior("MOVING");
    }
    this.horse.setTargetPosition(target.x, target.y);

    if (!this.horse.tooYoungToSpeak() && this.horse.speech.nextTime <= 0) {
      this.horse.speak(getDialogue(["FEAR", "ALICORN"], this.horse));
      this.horse.speech.nextTime = 2 + Math.random();
    }
  }

  findScaryGrinder() {
    if (typeof objects === "undefined") return null;
    let closest = null;
    let minDist = Infinity;
    for (const obj of objects) {
      if (
        obj instanceof Grinder &&
        obj.scene === this.horse.scene &&
        obj.currentSpeed > 0
      ) {
        const d = Math.sqrt(
          (this.horse.x - obj.x) ** 2 + (this.horse.y - obj.y) ** 2,
        );
        if (d < 300 && d < minDist) {
          minDist = d;
          closest = obj;
        }
      }
    }
    return closest;
  }

  findScaryAlicorn() {
    if (!worldSettings.alicornIntolerance) return null;
    let closest = null;
    let minDist = Infinity;
    for (const f of fluffies) {
      if (
        f.scene === this.horse.scene &&
        f.isAlive &&
        f.typeVisibleToOthers() === "alicorn"
      ) {
        const d = Math.sqrt(
          (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
        );
        // Less scared as it gets used to them (AlicornAcceptance.js)
        const range = typeof alicornFearRange === "function" ? alicornFearRange(this.horse) : 300;
        if (d < range && d < minDist) {
          minDist = d;
          closest = f;
        }
      }
    }
    return closest;
  }

  findScaryFearedFluffy() {
    let closest = null;
    let minDist = Infinity;
    for (const f of fluffies) {
      if (
        f.scene === this.horse.scene &&
        f.isAlive &&
        this.horse.fearedFluffies.some((ff) => ff.id === f.id)
      ) {
        const d = Math.sqrt(
          (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
        );
        if (d < 300 && d < minDist) {
          minDist = d;
          closest = f;
        }
      }
    }
    return closest;
  }

  findScaryCar() {
    if (typeof cars === "undefined") return null;
    let closest = null;
    let minDist = Infinity;
    for (const car of cars) {
      if (car.isDestroyed) continue;
      const carScene = car.scene || "ALLEY_ROAD";
      if (carScene !== this.horse.scene) continue;
      const d = Math.sqrt(
        (this.horse.x - car.x) ** 2 + (this.horse.y - car.y) ** 2,
      );
      if (d < 350 && d < minDist) {
        minDist = d;
        closest = car;
      }
    }
    return closest;
  }

  findScarySprinkler() {
    if (typeof objects === "undefined") return null;
    let closest = null;
    let minDist = Infinity;
    for (const obj of objects) {
      if (
        obj instanceof Sprinkler &&
        obj.scene === this.horse.scene &&
        obj.isOn
      ) {
        const d = Math.sqrt(
          (this.horse.x - obj.x) ** 2 + (this.horse.y - obj.y) ** 2,
        );
        if (d < 250 && d < minDist) {
          minDist = d;
          closest = obj;
        }
      }
    }
    return closest;
  }

  findScaryCorpse() {
    let closest = null;
    let minDist = Infinity;
    for (const f of fluffies) {
      if (
        this.horse.cannibalismAcceptance > 0.0 &&
        !f.fluffyIsRelatedOrSpecialFriend(this.horse)
      ) {
        continue;
      }
      if (relationships[this.horse.id][f.id] === "estranged_child") {
        continue;
      }

      if (f.scene === this.horse.scene && !f.isAlive) {
        const d = Math.sqrt(
          (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
        );
        if (d < 200 && d < minDist) {
          minDist = d;
          closest = f;
        }
      }
    }
    return closest;
  }

  findScaryBlood() {
    let closest = null;
    let minDist = Infinity;
    if (typeof puddles !== "undefined") {
      for (const p of puddles) {
        if (p.scene === this.horse.scene && p.color === "#8a0303") {
          for (const pt of p.points) {
            const d = Math.sqrt(
              (this.horse.x - pt.x) ** 2 + (this.horse.y - pt.y) ** 2,
            );
            if (d < 200 && d < minDist) {
              minDist = d;
              closest = { x: pt.x, y: pt.y };
            }
          }
        }
      }
    }
    return closest;
  }

  findChasingSmarty() {
    let closest = null;
    let minDist = Infinity;
    for (const f of fluffies) {
      if (
        f.isAlive &&
        f.scene === this.horse.scene &&
        (f.isSmarty() || f.isUnderAphrodisiac()) &&
        f.chaseTarget === this.horse
      ) {
        const d = Math.sqrt(
          (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
        );
        if (d < 400 && d < minDist) {
          minDist = d;
          closest = f;
        }
      }
    }
    return closest;
  }

  getRunawayTarget(sourceX, sourceY) {
    const dx = this.horse.x - sourceX;
    const dy = this.horse.y - sourceY;
    let angle = Math.atan2(dy, dx);

    // Add small randomness to the angle
    angle += (Math.random() - 0.5) * 0.7;

    const runDist = 300;
    let tx = this.horse.x + Math.cos(angle) * runDist;
    let ty = this.horse.y + Math.sin(angle) * runDist;

    // Clamp
    const topWallHeight = sceneTop(this.horse.scene);
    const groundYMin = topWallHeight + 50;
    const groundYMax =
      this.horse.scene === "BACKYARD" ? sceneH(this.horse.scene) - 120 : sceneH(this.horse.scene) - 50;
    tx = clamp(tx, 100, sceneW(this.horse.scene) - 100);
    ty = clamp(ty, groundYMin, groundYMax);

    return { x: tx, y: ty };
  }

  getExtentsForCage() {
    this.horse.updateLayout();
    return this.getExtentsForLayout(this.horse.layout);
  }

  getSittingExtents() {
    const anim = ANIMATION_STATES.SITTING;
    const bodyAngle = anim.bodyAngle;
    const headAngle = anim.headAngle;
    const bodyY = anim.yOffset;

    const renderer = this.horse.renderer;
    renderer.ensureTintedImages();
    if (!renderer.tinted || !renderer.tinted.torso) {
      return {
        left: this.horse.x,
        right: this.horse.x,
        top: this.horse.y,
        bottom: this.horse.y,
      };
    }

    const tinted = renderer.tinted;
    const tW = tinted.torso.width;
    const tH = tinted.torso.height;
    const lW = tinted.leg.width;
    const lH = tinted.leg.height;

    const rotate = (ox, oy) => {
      const cos = Math.cos(bodyAngle);
      const sin = Math.sin(bodyAngle);
      return { x: ox * cos - oy * sin, y: ox * sin + oy * cos };
    };

    const headPos = rotate(tW * 0.35, -tH * 0.25);
    const tailPos = rotate(-tW * 0.4, -tH * 0.3);
    const frontLegX = tW * 0.3,
      backLegX = -tW * 0.3,
      legY = tH * 0.2;
    const legPos0 = rotate(backLegX, legY);
    const legPos1 = rotate(frontLegX, legY);

    const leftLegAngle = Math.PI / 4;
    const rightLegAngle = Math.PI / 4;
    const backLegAngle = Math.PI / 16;

    const sittingLayout = {
      torso: { x: 0, y: 0, angle: bodyAngle, w: tW, h: tH },
      head: {
        x: headPos.x,
        y: headPos.y,
        angle: headAngle + bodyAngle,
        w: tinted.head.width,
        h: tinted.head.height,
      },
      tail: {
        x: tailPos.x,
        y: tailPos.y,
        angle: bodyAngle,
        w: tinted.tail.width,
        h: tinted.tail.height,
      },
      legs: [
        {
          x: legPos0.x,
          y: legPos0.y,
          angle: backLegAngle + bodyAngle,
          w: lW,
          h: lH,
        },
        {
          x: legPos1.x,
          y: legPos1.y,
          angle: rightLegAngle + bodyAngle,
          w: lW,
          h: lH,
        },
        {
          x: legPos1.x,
          y: legPos1.y,
          angle: leftLegAngle + bodyAngle,
          w: lW,
          h: lH,
        },
        {
          x: legPos0.x,
          y: legPos0.y,
          angle: backLegAngle + bodyAngle,
          w: lW,
          h: lH,
        },
      ],
      bodyY: bodyY,
      globalRotation: 0,
      stretch: 0,
    };

    return this.getExtentsForLayout(sittingLayout);
  }

  getExtentsForLayout(layout) {
    if (!layout)
      return {
        left: this.horse.x,
        right: this.horse.x,
        top: this.horse.y,
        bottom: this.horse.y,
      };

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    const sX = this.horse.facingRight ? this.horse.scale : -this.horse.scale;
    const sY = this.horse.scale;
    const cosG = Math.cos(layout.globalRotation);
    const sinG = Math.sin(layout.globalRotation);

    const addPoint = (lx, ly, rect) => {
      // 1. Rotate by rect.angle
      const cosA = Math.cos(rect.angle);
      const sinA = Math.sin(rect.angle);
      let x = lx * cosA - ly * sinA;
      let y = lx * sinA + ly * cosA;

      // 2. Translate by rect.x, rect.y
      x += rect.x;
      y += rect.y;

      // 3. Add bodyY
      y += layout.bodyY;

      // 4. Rotate by globalRotation
      let rx = x * cosG - y * sinG;
      let ry = x * sinG + y * cosG;

      // 5. Scale
      rx *= sX;
      ry *= sY;

      // 6. Translate by this.horse.x, this.horse.y
      const finalX = rx + this.horse.x;
      const finalY = ry + this.horse.y;

      minX = Math.min(minX, finalX);
      maxX = Math.max(maxX, finalX);
      minY = Math.min(minY, finalY);
      maxY = Math.max(maxY, finalY);
    };

    const addRect = (rect, ox, oy) => {
      const w = rect.w;
      const h = rect.h + (rect === layout.torso ? layout.stretch : 0);
      addPoint(ox, oy, rect);
      addPoint(ox + w, oy, rect);
      addPoint(ox + w, oy + h, rect);
      addPoint(ox, oy + h, rect);
    };

    addRect(layout.torso, -layout.torso.w / 2, -layout.torso.h / 2);
    addRect(layout.head, -layout.head.w * 0.25, -layout.head.h * 0.85);
    layout.legs.forEach((leg) => addRect(leg, -leg.w / 2, 0));

    if (minX === Infinity)
      return {
        left: this.horse.x,
        right: this.horse.x,
        top: this.horse.y,
        bottom: this.horse.y,
      };

    return {
      left: minX,
      right: maxX,
      top: minY,
      bottom: maxY,
    };
  }
}
