class HorseActionHandler {
  constructor(horse) {
    this.horse = horse;
  }

  checkArrivals(dt) {
    if (
      !this.horse.isMovingOrRunning() ||
      (this.horse.isBeingTased && this.horse.isBeingTased())
    )
      return false;

    if (this.horse.currentCage != null) {
      this.horse.positioning.constrainTargetToCage();
    }

    this.horse.attemptUseTargetLitterbox();
    const dx = this.horse.targetX - this.horse.x;
    const dy = this.horse.targetY - this.horse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 10 && !this.horse.litterboxUsed) {
      // Arrived at target
      if (this.horse.ballTarget) {
        const balls = objects.filter((o) => o instanceof Ball);
        const ball = balls.find(
          (b) =>
            b.scene === this.horse.scene &&
            Math.sqrt((b.x - this.horse.x) ** 2 + (b.y - this.horse.y) ** 2) <
              50,
        );
        if (ball) {
          poofs.push(new Poof(ball.x, ball.getCenterY(), this.horse.scene));
          ball.vx = (Math.random() - 0.5) * 800;
          ball.vy = -300 - Math.random() * 300;
          this.horse.speak(getDialogue(["PLAY", "BALL"], this.horse));
          this.horse.ballCooldown = Math.random() * 10 + 10;
          this.horse.expressionOverride = "GOOD_UPSIES";
          this.horse.expressionOverrideTimer = 2.0;
          this.horse.changeHappiness(HAPPINESS_BONUS_PLAY);
        }
        this.horse.ballTarget = false;
      } else if (this.horse.blockTarget) {
        const blocks = objects.filter((o) => o instanceof Block);
        const block = blocks.find(
          (b) =>
            b.scene === this.horse.scene &&
            Math.sqrt(
              (b.x - this.horse.x) ** 2 +
                (b.getBottomY() - 50 - this.horse.y) ** 2,
            ) < 50 &&
            !b.heldBy &&
            !b.getStackedAbove() &&
            (this.horse.hasBlockOnBack() || !b.stackedOn) &&
            !b.isDragging &&
            b.isStill(),
        );
        if (block) {
          if (!this.horse.hasBlockOnBack()) {
            this.horse.blockOnBack = block;
            block.heldBy = this.horse;
            block.stackedOn = null;
            this.horse.speak(getDialogue(["PLAY", "BLOCK"], this.horse));
            this.horse.expressionOverride = "GOOD_UPSIES";
            this.horse.expressionOverrideTimer = 2.0;
            this.horse.changeHappiness(HAPPINESS_BONUS_PLAY);
          } else {
            // Start Stacking
            this.horse.isStacking = true;
            this.horse.stackingTimer = 0;
            this.horse.initBehavior("SITTING");
            this.horse.stackTargetBlock = block;
            this.horse.y = block.getBottomY() - 50;
            this.horse.x =
              block.x +
              (this.horse.facingRight
                ? -block.getImage().width / 2
                : block.getImage().width / 2);
            this.horse.speak(
              getDialogue(["PLAY", "BLOCK", "SUCCESS"], this.horse),
            );
          }
        }
        this.horse.blockTarget = false;
      } else if (this.horse.blockTowerKnockOverTarget) {
        const blocks = objects.filter((o) => o instanceof Block);
        let block = blocks.find(
          (b) =>
            b.scene === this.horse.scene &&
            Math.sqrt(
              (b.x - this.horse.x) ** 2 +
                (b.getBottomY() - 50 - this.horse.y) ** 2,
            ) < 50 &&
            !b.heldBy &&
            !b.stackedOn &&
            !b.isDragging &&
            b.isStill(),
        );
        while (block && block.getStackedAbove()) {
          block = block.getStackedAbove();
        }
        if (block) {
          this.horse.expressionOverride = "GOOD_UPSIES";
          this.horse.expressionOverrideTimer = 2.0;
          this.horse.changeHappiness(HAPPINESS_BONUS_PLAY);
          this.horse.initBehavior("FLUFFY_JAB");
          this.horse.speak(getDialogue(["PLAY", "BLOCK_KNOCK_DOWN"]));
          this.horse.failStackBlocks(block);
        }
        this.horse.blockTowerKnockOverTarget = false;
      } else {
        const next = BEHAVIOR_RULES[this.horse.currentStateKey].getNextState(
          this.horse,
        );
        this.horse.initBehavior(next);
      }
      return true;
    } else {
      // Still moving
      const speed = this.horse.speed;
      const moveStep = speed * dt;
      const step = Math.min(dist, moveStep);
      this.horse.x += step >= dist ? dx : (dx / dist) * step;
      this.horse.y += step >= dist ? dy : (dy / dist) * step;

      if (dist > 1) {
        this.horse.facingRight = dx >= 0;
      }

      if (typeof objects !== "undefined" && Array.isArray(objects)) {
        for (let i = 0; i < objects.length; i++) {
          const obj = objects[i];
          if (
            typeof Thumbtack !== "undefined" &&
            obj instanceof Thumbtack &&
            !obj.isDragging &&
            obj.scene === this.horse.scene
          ) {
            if (
              typeof obj.checkFluffyCollision === "function" &&
              obj.checkFluffyCollision(this.horse)
            ) {
              return true;
            }
          }
        }
      }
      return false;
    }
  }

  executeRunawayFear(target, dialogueKey) {
    this.horse.isScared = true;
    this.horse.scaredTimer = 5.0;
    this.horse.setShock(3.0);

    const runawayTarget = this.horse.positioning.getRunawayTarget(
      target.x,
      target.y,
    );
    this.horse.initBehavior("MOVING");
    this.horse.setTargetPosition(runawayTarget.x, runawayTarget.y);
    this.horse.currentStateKey = "RUNNING";

    if (!this.horse.tooYoungToSpeak()) {
      this.horse.speak(getDialogue(dialogueKey, this.horse));
      this.horse.speech.nextTime = 2 + Math.random();
    }
    return true;
  }

  executeCarFear(target) {
    if (this.horse.carFearDecisionTimer <= 0) {
      this.horse.carFearDecisionTimer = 1.0;
      if (this.horse.isSmarty()) {
        this.horse.carFearDecision = "SIT";
      } else {
        this.horse.carFearDecision = Math.random() < 0.5 ? "RUN" : "SIT";
      }
      this.horse.speech.nextTime = 0;
    }

    if (this.horse.carFearDecision === "RUN") {
      this.horse.isScared = true;
      this.horse.scaredTimer = 2.0;
      this.horse.setShock(3.0);

      const runawayTarget = this.horse.positioning.getRunawayTarget(
        target.x,
        target.y,
      );
      this.horse.initBehavior("MOVING");
      this.horse.setTargetPosition(runawayTarget.x, runawayTarget.y);
      this.horse.currentStateKey = "RUNNING";

      if (!this.horse.tooYoungToSpeak() && this.horse.speech.nextTime <= 0) {
        this.horse.speak(getDialogue(["FEAR", "CAR"], this.horse));
        this.horse.speech.nextTime = 2 + Math.random();
      }
    } else {
      this.horse.isScared = true;
      this.horse.scaredTimer = 2.0;

      this.horse.initBehavior("SITTING");
      this.horse.currentStateKey = "SITTING";

      this.horse.facingRight = target.x > this.horse.x;

      if (this.horse.isSmarty()) {
        this.horse.expressionOverride = "ANGRY_PUFFED";
        this.horse.expressionOverrideTimer = 2.0;

        if (!this.horse.tooYoungToSpeak()) {
          this.horse.speak(getDialogue(["FEAR", "CAR_SMARTY"], this.horse));
          this.horse.speech.nextTime = 2 + Math.random();
        }
      } else {
        this.horse.expressionOverride = "CRYING_SHOCKED";
        this.horse.expressionOverrideTimer = 2.0;

        if (!this.horse.tooYoungToSpeak()) {
          this.horse.speak(getDialogue(["FEAR", "CAR_COWER"], this.horse));
          this.horse.speech.nextTime = 2 + Math.random();
        }
      }
    }
    return true;
  }

  executeAlicornFear(target) {
    if (!worldSettings.alicornIntolerance) return true;
    this.horse.positioning.attemptAlicornFear(target, false);
    return true;
  }

  executeFearedFluffyFear(target) {
    this.horse.isScared = true;
    this.horse.scaredTimer = 5.0;
    this.horse.setShock(3.0);

    const runawayTarget = this.horse.positioning.getRunawayTarget(
      target.getWorldPosition().x,
      target.getWorldPosition().y,
    );
    this.horse.initBehavior("MOVING");
    this.horse.setTargetPosition(runawayTarget.x, runawayTarget.y);
    this.horse.currentStateKey = "RUNNING";

    if (!this.horse.tooYoungToSpeak()) {
      const fearedEntry = this.horse.fearedFluffies.find(
        (ff) => ff.id === target.id,
      );
      let dialogueKey = ["FEAR", "BAD_ENFIES"];
      if (fearedEntry && fearedEntry.reason != null) {
        dialogueKey = ["FEAR", fearedEntry.reason];
      }
      this.horse.speak(getDialogue(dialogueKey, this.horse));
      this.horse.speech.nextTime = 2 + Math.random();
      this.horse.changeHappiness(-0.05);
    }
    return true;
  }

  executeCorpseReaction(closestCorpse) {
    let key = closestCorpse.tooYoungToWalk() ? ["CORPSE", "BABY"] : "CORPSE";

    const rels =
      typeof relationships !== "undefined"
        ? relationships[this.horse.id]
        : null;
    if (rels && rels[closestCorpse.id]) {
      const rel = rels[closestCorpse.id];
      // Exit early if the child is bad
      if (rel === "estranged_child") {
        return true;
      }
      this.horse.expressionOverride = "CRYING_SHOCKED";
      this.horse.expressionOverrideTimer = 3.0;
      if (
        this.horse.gender === "female" &&
        (rel === "baby_child" || rel === "child" || rel === "dead_baby_child")
      ) {
        key = ["CORPSE", "BABY", "MOTHER"];
        rels[closestCorpse.id] = "dead_baby_child";
        if (relationships[closestCorpse.id])
          relationships[closestCorpse.id][this.horse.id] = "dead_mother";
      } else if (
        rel === "special_friend" ||
        rel === "forgotten_special_friend"
      ) {
        key = ["CORPSE", "FRIEND"];
      } else if (rel === "mother") {
        key = ["CORPSE", "MOTHER"];
        rels[closestCorpse.id] = "dead_mother";
        if (relationships[closestCorpse.id])
          relationships[closestCorpse.id][this.horse.id] = "dead_baby_child";
      } else if (rel === "father") {
        key = ["CORPSE", "FATHER"];
      }
    }

    this.horse.setShock(3.0);
    this.horse.bloodReactionTimer = 5.0;

    let penalty = HAPPINESS_PENALTY_CORPSE_FEAR_GENERAL;

    this.horse.changeHappiness(penalty);
    if (!this.horse.tooYoungToSpeak()) {
      this.horse.speak(getDialogue(key, this.horse, closestCorpse));
      this.horse.speech.nextTime = 2 + Math.random();
    }
    return true;
  }

  executeBloodReaction(closestBloodPoint) {
    this.horse.isScared = true;
    this.horse.scaredTimer = 5.0;
    this.horse.setShock(3.0);
    this.horse.bloodTolerance = 1.0;
    this.horse.bloodReactionTimer = 15.0;

    const target = this.horse.positioning.getRunawayTarget(
      closestBloodPoint.x,
      closestBloodPoint.y,
    );
    this.horse.changeHappiness(HAPPINESS_PENALTY_BLOOD_FEAR);

    this.horse.initBehavior("MOVING");
    this.horse.setTargetPosition(target.x, target.y);
    this.horse.currentStateKey = "RUNNING";

    if (!this.horse.tooYoungToSpeak()) {
      this.horse.speak(getDialogue(["FEAR", "BLOOD"], this.horse));
      this.horse.speech.nextTime = 2 + Math.random();
    }
    return true;
  }

  executeSmartyChaseFear(smarty) {
    if (this.horse.tooYoungToSpeak()) {
      return false;
    }
    this.horse.isScared = true;
    this.horse.scaredTimer = 5.0;

    const runawayTarget = this.horse.positioning.getRunawayTarget(
      smarty.getWorldPosition().x,
      smarty.getWorldPosition().y,
    );
    this.horse.initBehavior("MOVING");
    this.horse.setTargetPosition(runawayTarget.x, runawayTarget.y);
    this.horse.currentStateKey = "RUNNING";

    if (this.horse.speech.nextTime <= 0) {
      const chaseFearKey =
        this.horse.gender === "male"
          ? ["FEAR", "CHASING_SMARTY", "STALLION"]
          : ["FEAR", "CHASING_SMARTY", "MARE"];
      this.horse.speak(getDialogue(chaseFearKey, this.horse, smarty));
      this.horse.speech.nextTime = 2 + Math.random();
      if (this.horse.happiness > WAN_DIE_THRESHOLD) {
        this.horse.setShock(3.0);
      }
    }
    return true;
  }

  executeMateWithSpecialFriend(friend) {
    if (!friend || !placedOnValidForSpecialHuggies(friend.placedOn))
      return false;
    if (!this.horse.hasBlockOnBack() && !friend.hasBlockOnBack()) {
      if (!(this.horse.limbs.legs[1] && this.horse.limbs.legs[2])) {
        if (this.horse.speech.nextTime <= 0) {
          this.horse.changeHappiness(HAPPINESS_PENALTY_CANT_HUG);
          this.horse.speak(
            getDialogue(["SPECIAL_HUGGIES", "NO_LEGS"], this.horse),
          );
          this.horse.specialHuggiesCooldown = 30;
        }
      } else if (!this.horse.limbs.lumps) {
        if (this.horse.speech.nextTime <= 0) {
          this.horse.changeHappiness(HAPPINESS_PENALTY_CANT_HUG);
          this.horse.speak(
            getDialogue(["SPECIAL_HUGGIES", "NO_LUMPS"], this.horse),
          );
          this.horse.specialHuggiesCooldown = 30;
        }
      } else {
        this.horse.mateWith(friend);
      }
    }
    return true;
  }

  executeProposeToFriend(target) {
    const isTargetStallion = target.gender === "male";
    const isSpeakerStallion = this.horse.gender === "male";

    let proposeKey;
    if (!isSpeakerStallion && !isTargetStallion) {
      proposeKey = ["PROPOSE", "MARE_TO_MARE"];
    } else if (isTargetStallion) {
      proposeKey = ["PROPOSE", "STALLION"];
    } else {
      proposeKey = ["PROPOSE", "MARE"];
    }

    // Small cooldown to prevent instant normal/special huggies
    this.horse.specialHuggiesCooldown = 5;
    this.horse.lastBabbleTime = Date.now();

    this.horse.speak(getDialogue(proposeKey, this.horse, target));
    this.horse.speech.nextTime = 2 + Math.random();
    const targetFriends =
      typeof relationships !== "undefined" && relationships[target.id]
        ? Object.values(relationships[target.id])
        : [];
    if (targetFriends.includes("special_friend")) {
      target.speak(getDialogue(["PROPOSE", "REJECT"], target, this.horse));
      this.horse.friendshipCooldowns[target.id] = 60;
    } else if (!isSexuallyAttractedTo(target, this.horse)) {
      const rejectKey = isSpeakerStallion
        ? ["PROPOSE", "REJECT_SEXUALITY", "STALLION"]
        : ["PROPOSE", "REJECT_SEXUALITY", "MARE"];
      target.speak(getDialogue(rejectKey, target, this.horse));
      this.horse.friendshipCooldowns[target.id] = 60;
    } else {
      let acceptKey;
      if (!isSpeakerStallion && !isTargetStallion) {
        acceptKey = ["PROPOSE", "ACCEPT", "MARE_TO_MARE"];
      } else if (isTargetStallion) {
        acceptKey = ["PROPOSE", "ACCEPT", "STALLION"];
      } else {
        acceptKey = ["PROPOSE", "ACCEPT", "MARE"];
      }
      target.speak(getDialogue(acceptKey, target, this.horse));
      this.horse.changeHappiness(HAPPINESS_BONUS_PROPOSAL_ACCEPT);
      target.changeHappiness(HAPPINESS_BONUS_PROPOSAL_ACCEPT);
      if (!relationships[this.horse.id]) relationships[this.horse.id] = {};
      if (!relationships[target.id]) relationships[target.id] = {};
      relationships[this.horse.id][target.id] = "special_friend";
      relationships[target.id][this.horse.id] = "special_friend";
    }
    this.horse.initBehavior("IDLE");
    target.initBehavior("IDLE");
    return true;
  }

  executeProposeFriendship() {
    for (const f of fluffies) {
      if (
        worldSettings.alicornIntolerance &&
        f.typeVisibleToOthers() === "alicorn" &&
        !this.horse.tolerantOfAlicorns()
      )
        continue;

      if (fluffyColoristAgainstOtherFluffy(this.horse, f)) continue;

      if (
        f !== this.horse &&
        f.isAlive &&
        f.scene === this.horse.scene &&
        f.currentCage === this.horse.currentCage &&
        !f.tooYoungToWalk() &&
        f.avoidStateChangerActions() &&
        !f.isSmarty()
      ) {
        const dist = Math.sqrt(
          (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
        );
        if (dist < 150) {
          const rels = relationships[this.horse.id];
          const isRelated = rels && rels[f.id];

          if (!isRelated) {
            this.horse.proposeFriendship(f);
            return true;
          }
        }
      }
    }
    return false;
  }

  executeBabbleToFriends() {
    const rels = relationships[this.horse.id];
    if (!rels) return false;

    let closestFriend = null;
    let minFriendDist = Infinity;

    for (const f of fluffies) {
      if (
        f !== this.horse &&
        f.isAlive &&
        f.scene === this.horse.scene &&
        f.currentCage === this.horse.currentCage &&
        !f.isDragging &&
        (rels[f.id] === "friend" ||
          this.horse.fluffyIsRelatedOrSpecialFriend(f))
      ) {
        const dist = Math.sqrt(
          (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
        );
        if (dist < minFriendDist) {
          minFriendDist = dist;
          closestFriend = f;
        }
      }
    }

    if (closestFriend) {
      if (
        minFriendDist < 100 &&
        this.horse.speech.timer <= 0 &&
        !this.horse.tooYoungToSpeak() &&
        this.horse.canSee() &&
        !isFocusingState(this.horse.currentStateKey) &&
        rels[closestFriend.id] === "friend"
      ) {
        // A friend in a used diaper gets remarked on instead
        const key =
          closestFriend.hasUsedDiaper() && Math.random() < 0.5
            ? ["DIAPER", "SMELLY"]
            : ["HELLO", "FRIEND"];
        this.horse.speak(getDialogue(key, this.horse, closestFriend));
      }

      if (minFriendDist < 50 && Math.random() < 0.3 && this.horse.canSee()) {
        if (
          !this.horse.hasBlockOnBack() &&
          !closestFriend.hasBlockOnBack() &&
          this.horse.limbs.legs[1] &&
          this.horse.limbs.legs[2] &&
          closestFriend.happiness > WAN_DIE_THRESHOLD
        ) {
          this.horse.attemptHugging(closestFriend);
        }
      }
      return true;
    }
    return false;
  }

  executeSmartyCombatTargeting() {
    let minDist = Infinity;
    let target = null;
    for (const f of fluffies) {
      if (
        f.id !== this.horse.id &&
        f.isAlive &&
        f.scene === this.horse.scene &&
        !f.isDragging &&
        f.currentCage === this.horse.currentCage &&
        (!worldSettings.alicornIntolerance ||
          this.horse.tolerantOfAlicorns() ||
          f.typeVisibleToOthers() !== "alicorn") &&
        f.gender === "male" &&
        (this.horse.herdId === null ||
          f.herdId === null ||
          this.horse.herdId !== f.herdId)
      ) {
        const d = Math.sqrt(
          (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
        );
        if (d < 500 && d < minDist) {
          minDist = d;
          target = f;
        }
      }
    }

    if (target) {
      if (this.horse.chaseTarget !== target) {
        this.horse.chaseTarget = target;
        this.horse.chaseReason = "ATTACK";
        this.horse.initBehavior("RUNNING");
      }
      return true;
    }

    return false;
  }

  executeComplainAboutPuddle() {
    if (typeof puddles === "undefined") return false;

    for (const puddle of puddles) {
      if (
        puddle.scene === this.horse.scene &&
        puddle.type !== "blood" &&
        puddle.points.length >= 4
      ) {
        for (const pt of puddle.points) {
          const d = Math.sqrt(
            (this.horse.x - pt.x) ** 2 + (this.horse.y - pt.y) ** 2,
          );
          if (d < 200) {
            let key = ["POOP", "DIRTY_PUDDLE_COMPLAINT"];
            if (this.horse.isSmarty()) {
              key = ["POOP", "DIRTY_PUDDLE_COMPLAINT", "SMARTY"];
              this.horse.expressionOverride = "ANGRY_PUFFED";
              this.horse.expressionOverrideTimer = 3.0;
            } else {
              this.horse.expressionOverride = "DISGUSTED";
              this.horse.expressionOverrideTimer = 3.0;
            }
            this.horse.speak(getDialogue(key, this.horse));
            this.horse.changeHappiness(HAPPINESS_PENALTY_DIRTY_PUDDLE);
            this.horse.lastPuddleReactionTime = 0;
            return true;
          }
        }
      }
    }
    return false;
  }

  executeChirpyBabyMilk() {
    let fed = false;

    if (
      this.horse.currentCage &&
      typeof FoalInACan !== "undefined" &&
      this.horse.currentCage instanceof FoalInACan
    ) {
      const can = this.horse.currentCage;
      if (can.formulaCharges > 0) {
        can.formulaCharges--;
        this.horse.hunger = 1.0;
        this.horse.speak(
          getDialogue(["DRINK_MILKIES", "FORMULA"], this.horse, null),
        );
        fed = true;
      }
      return fed;
    }

    let bestTarget = null;
    let minDist = Infinity;

    if (this.horse.motherId !== undefined) {
      const mom = fluffies.find(
        (f) =>
          f.id === this.horse.motherId &&
          f.isAlive &&
          f.scene === this.horse.scene &&
          f.lactatingTimer > 0 &&
          f.currentCage === this.horse.currentCage,
      );
      if (mom) {
        const dist = Math.sqrt(
          (this.horse.x - mom.x) ** 2 + (this.horse.y - mom.y) ** 2,
        );
        if (dist < minDist) {
          minDist = dist;
          bestTarget = mom;
        }
      }
    }

    if (!bestTarget) {
      for (const f of fluffies) {
        if (
          f.id !== this.horse.id &&
          f.id !== this.horse.motherId &&
          f.gender === "female" &&
          f.growth >= 1.0 &&
          f.isAlive &&
          f.scene === this.horse.scene &&
          f.lactatingTimer > 0 &&
          f.attackCooldown <= 0 &&
          f.currentCage === this.horse.currentCage
        ) {
          const dist = Math.sqrt(
            (this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2,
          );
          if (dist < minDist) {
            minDist = dist;
            bestTarget = f;
          }
        }
      }
    }

    let closestFeeder = null;
    if (typeof objects !== "undefined") {
      const bowls = objects.filter(
        (o) =>
          o instanceof Bowl &&
          (o.type === "feeder" || o.type === "mega_feeder") &&
          o.hasFood() &&
          o.foodType === "formula" &&
          o.scene === this.horse.scene &&
          o.currentCage === this.horse.currentCage,
      );
      for (const bowl of bowls) {
        const dist = Math.sqrt(
          (this.horse.x - bowl.x) ** 2 + (this.horse.y - bowl.y) ** 2,
        );
        if (dist < minDist) {
          minDist = dist;
          closestFeeder = bowl;
          bestTarget = bowl;
        }
      }
    }

    if (bestTarget) {
      const isFeeder = closestFeeder === bestTarget;
      const threshold = isFeeder ? 50 : 80;

      if (minDist < threshold) {
        if (isFeeder) {
          if (bestTarget.eat()) {
            this.horse.hunger = 1.0;
            this.horse.addPreferredMilkSource(bestTarget.id, "FEEDER");
            this.horse.speak(
              getDialogue(["DRINK_MILKIES", "FORMULA"], this.horse, null),
            );
            fed = true;
          }
        } else {
          if (this.horse.attemptFeedFromMare(bestTarget)) {
            fed = true;
          }
        }
      } else {
        if (!this.horse.isMovingOrRunning()) {
          this.horse.initBehavior("MOVING");
        }
        const targetPos =
          bestTarget instanceof Horse
            ? bestTarget.getWorldPosition()
            : { x: bestTarget.x, y: bestTarget.y };
        this.horse.setTargetPosition(targetPos.x, targetPos.y);

        this.horse.milkCooldown = 2.0;
        fed = true;
      }
    }

    return fed;
  }

  // Colorist mothers attack foals whose color they dislike
  updateColoristAttacks() {
    const h = this.horse;
    // Proactive colorist mom attack logic
    if (
      worldSettings.colorism &&
      h.isAlive &&
      h.gender === "female" &&
      h.happiness > WAN_DIE_THRESHOLD &&
      h.attackCooldown <= 0 &&
      h.canSee()
    ) {
      // Find babies
      for (const child of fluffies) {
        if (
          child.isAlive &&
          child.motherId === h.id &&
          child.scene === h.scene &&
          child.currentCage === h.currentCage
        ) {
          const dist = Math.sqrt((h.x - child.x) ** 2 + (h.y - child.y) ** 2);
          if (dist < 100) {
            if (fluffyColoristAgainstOtherFluffy(h, child)) {
              h.performAttack(child, "COLOR");
              h.speak(getDialogue(["ATTACK", "COLOR"], h));
              relationships[h.id][child.id] = "estranged_child";
              break;
            }
          }
        }
      }
    }
  }

  // Delayed retaliation against a recent attacker
  updateCounterattack(dt) {
    const h = this.horse;
    if (h.counterattack.timer > 0) {
      h.counterattack.timer -= dt;
      if (h.counterattack.timer <= 0 && h.counterattack.fluffy) {
        const attacker = h.counterattack.fluffy;
        if (
          attacker.isAlive &&
          attacker.scene === h.scene &&
          !h.isDragging &&
          !h.placedOn &&
          h.canFightBack()
        ) {
          const dist = Math.sqrt(
            (h.x - attacker.x) ** 2 + (h.y - attacker.y) ** 2,
          );
          // Retaliate if within reasonable reach
          if (dist < 100) {
            h.performAttack(attacker, "RETALIATION");
          }
        }
        h.counterattack.fluffy = null;
      }
    }
  }

  // Finish or abort stacking a carried block
  updateBlockStacking(dt) {
    const h = this.horse;
    if (h.blockCooldown > 0) {
      h.blockCooldown -= dt;
    }

    if (h.isStacking) {
      h.stackingTimer += dt;
      if (
        h.stackingTimer > 12.0 ||
        (h.stackTargetBlock &&
          (h.stackTargetBlock.isDragging || h.stackTargetBlock.heldBy))
      ) {
        h.isStacking = false;
        h.blockCooldown = 10.0;
        if (h.blockOnBack) {
          h.blockOnBack.heldBy = null;
          h.blockOnBack.x = h.x;
          h.blockOnBack.y = h.y;
          h.blockOnBack.groundY = h.y;
          h.blockOnBack.clampY();
          h.blockOnBack = null;
        }
        h.initBehavior("IDLE");
      } else if (h.stackingTimer > 3.0) {
        if (h.blockOnBack && h.stackTargetBlock) {
          h.blockCooldown = 10.0;
          if (Math.random() < 0.4 * h.stackTargetBlock.stackHeight()) {
            h.failStackBlocks(h.stackTargetBlock);
            h.speak(getDialogue(["PLAY", "BLOCK", "FAIL"], h));
          } else {
            let top = h.stackTargetBlock;
            while (top.getStackedAbove()) {
              top = top.getStackedAbove();
            }
            h.blockOnBack.stackedOn = top;
            h.blockOnBack.stackXOffset = (Math.random() - 0.5) * 10;
            h.blockOnBack.heldBy = null;
            h.blockOnBack = null;
            h.speak(getDialogue(["PLAY", "BLOCK"], h));
            h.expressionOverride = "GOOD_UPSIES";
            h.expressionOverrideTimer = 2.0;
          }
        }
        h.isStacking = false;
        h.initBehavior("IDLE");
      }
    }
  }

  // Smarty/aphrodisiac chasing, yelling at and reaching the chase target
  updateChase() {
    const h = this.horse;
    // Smarty & Aphrodisiac Chase Logic
    if (
      h.isAlive &&
      (h.isSmarty() || h.isUnderAphrodisiac()) &&
      h.chaseTarget &&
      h.canSee()
    ) {
      const target = h.chaseTarget;
      // Validation
      if (
        !target.isAlive ||
        target.scene !== h.scene ||
        target.isDragging ||
        target.currentCage !== h.currentCage ||
        (!h.isUnderAphrodisiac() && h.specialHuggiesCooldown > 0) ||
        (!h.isUnderAphrodisiac() && h.isFrantic) ||
        h.isCrawling ||
        !h.limbs.lumps ||
        !placedOnValidForSpecialHuggies(target.placedOn) ||
        h.happiness <= WAN_DIE_THRESHOLD
      ) {
        h.chaseTarget = null;
        h.chaseReason = null;
      } else {
        const targetPos = target.getWorldPosition();
        h.setTargetPosition(targetPos.x, targetPos.y);

        if (!h.isMovingOrRunning() && h.attackCooldown <= 0) {
          h.initBehavior("RUNNING");
        }

        if (h.speech.nextTime <= 0) {
          h.speech.nextTime = 2 + Math.random();

          // Smarty yells 100% of the time if target can't hear.
          // Otherwise, regular logic: 100% if target can see, 20% if target can't.
          const yellChance = !target.canHear()
            ? 1.0
            : target.canSee()
              ? 1.0
              : 0.2;
          if (Math.random() < yellChance) {
            const isTargetStallion = target.gender === "male";
            const yellKey = isTargetStallion
              ? ["SMARTY_CHASE", "STALLION"]
              : ["SMARTY_CHASE", "MARE"];
            const yellText = h.isUnderAphrodisiac()
              ? h.getAphrodisiacDialogue()
              : getDialogue(yellKey, h, target);
            h.speak(yellText, h.isUnderAphrodisiac());

            // Target only reacts to yelling if they can hear.
            // If they can't see, they only react if they hear him.
            if (
              !target.canSee() &&
              target.canHear() &&
              !target.tooYoungToSpeak()
            ) {
              target.actionHandler.executeSmartyChaseFear(h);
            }
          }
        }

        const dist = Math.sqrt((h.x - target.x) ** 2 + (h.y - target.y) ** 2);
        if (dist < 50 && h.attackCooldown <= 0) {
          const isMaleOnMaleUnconsensual =
            h.gender === "male" &&
            target.gender === "male" &&
            !isSexuallyAttractedTo(target, h);

          if (h.chaseReason === "MATING" || h.isUnderAphrodisiac()) {
            if (isMaleOnMaleUnconsensual && canFightBack(target)) {
              h.performAttack(target, "SMARTY_VIOLENCE");
              const attackText = h.isUnderAphrodisiac()
                ? h.getAphrodisiacDialogue()
                : getDialogue(
                    [
                      "ATTACK",
                      "SMARTY",
                      h.tooYoungToSpeak() ? "BABY" : "ADULT",
                    ],
                    h,
                  );
              h.speak(attackText, h.isUnderAphrodisiac());
            } else if (h.mateWith(target, false, true)) {
              h.chaseTarget = null;
              h.chaseReason = null;
            }
          } else if (h.chaseReason === "ATTACK" || target.gender === "male") {
            if (h.isSmarty()) {
              h.performAttack(target, "SMARTY_VIOLENCE");
              h.speak(
                getDialogue(
                  ["ATTACK", "SMARTY", h.tooYoungToSpeak() ? "BABY" : "ADULT"],
                  h,
                ),
              );
            }
          } else if (h.mateWith(target, false, true)) {
            h.chaseTarget = null;
            h.chaseReason = null;
          }
        }
      }
    }
  }

  // Outdoor fluffies knocking on the door while the player is inside
  updateDoorTapping(dt) {
    const h = this.horse;
    // Door Tapping Logic (Outdoors)
    if (
      getSceneConfig(h.scene).id === "OUTDOORS" &&
      getSceneConfig(currentScene).insidePlayerQuarters
    ) {
      if (h.isTapping) {
        h.tapTimer -= dt;
        if (h.tapTimer < 1.0) {
          h.tapOpacity = Math.max(0, h.tapTimer);
        } else {
          h.tapOpacity = 1.0;
        }
        if (h.tapTimer <= 0) {
          h.isTapping = false;
          h.tapText = null;
          h.nextTapTime = 5 + Math.random() * 10;
        }
      } else {
        h.nextTapTime = (h.nextTapTime || 0) - dt;
        if (h.nextTapTime <= 0) {
          const distToDoor = Math.sqrt(
            (h.x - width / 2) ** 2 + (h.y - (height * 0.15 + 50)) ** 2,
          );

          if (distToDoor < 300 && !h.isFrantic && !h.tooYoungToSpeak()) {
            let text = null;
            const recent = recentOutdoorDialogue.filter(
              (d) => Date.now() - d.time < 10000,
            );

            let key = null;

            if (h.adopted) {
              if (h.hunger > 0.6) {
                key = ["DOOR_KNOCK", "ADOPTED"];
              }
            } else {
              // Feral knocking
              key = ["DOOR_KNOCK", "FERAL"];
            }

            if (key) {
              text = getDialogue(key, h);
            }

            if (text) {
              if (typeof addDoorMessage !== "undefined") {
                addDoorMessage(text);
              }
              h.nextTapTime = 5 + Math.random() * 10;
            } else {
              h.nextTapTime = 1.0;
            }
          } else {
            // Retry later if conditions not met
            h.nextTapTime = 1.0;
          }
        }
      }
    }
  }

  // Eat from a nearby bowl or grass when hungry
  updateBowlEating() {
    const h = this.horse;
    // Eating / Drinking Logic

    if (h.hunger < 0.6) {
      const isGagged =
        h.accessories &&
        h.accessories.mouth &&
        h.accessories.mouth.id === "mouthgag";
      // Bowl Eating (Not for chirpies)
      if (
        !isGagged &&
        !h.tooYoungToWalk() &&
        h.happiness > WAN_DIE_THRESHOLD && // Depressed fluffies don't eat
        !h.isUnderAphrodisiac() && // Under aphrodisiac males don't eat
        !(h.placedOn instanceof OperatingTable) &&
        typeof objects !== "undefined"
      ) {
        const bowls = objects.filter(
          (o) => o instanceof Bowl || o instanceof Grass,
        );
        for (const bowl of bowls) {
          if (
            (bowl instanceof Grass ||
              (bowl.type !== "feeder" && bowl.type !== "mega_feeder")) &&
            bowl.hasFood() &&
            bowl.scene === h.scene
          ) {
            // Accessibility Check
            if (h.currentCage !== bowl.currentCage) continue;

            const dist = Math.sqrt((h.x - bowl.x) ** 2 + (h.y - bowl.y) ** 2);
            if (dist < 50) {
              if (bowl.eat()) {
                h.hunger = 1.0;
                h.initBehavior("EATING");
                let key;
                if (bowl.foodType === "sketties") {
                  key = ["EAT", "SKETTIES"];
                } else if (bowl.foodType === "soylent_brown") {
                  key = ["EAT", "SOYLENT_BROWN"];
                } else if (bowl.foodType === "rat_poison") {
                  key = ["EAT", "RAT_POISON"];
                } else {
                  key = ["EAT", "NUMMIES"];
                }

                if (h.isSmarty()) {
                  if (bowl.foodType === "sketties") {
                    key = ["EAT", "SKETTIES", "SMARTY"];
                  } else if (bowl.foodType === "soylent_brown") {
                    key = ["EAT", "SOYLENT_BROWN"];
                  } else if (bowl.foodType === "rat_poison") {
                    key = ["EAT", "RAT_POISON"];
                  } else {
                    key = ["EAT", "NUMMIES", "SMARTY"];
                  }
                  h.expressionOverride = "ANGRY_PUFFED";
                  h.expressionOverrideTimer = 3.0;
                }
                if (bowl.foodType === "sketties") {
                  h.changeHappiness(HAPPINESS_BONUS_SKETTIES);
                } else if (bowl.foodType === "soylent_brown") {
                  h.changeHappiness(-0.03);
                  if (!h.isSmarty()) {
                    h.expressionOverride = "MISERABLE";
                    h.expressionOverrideTimer = 3.0;
                  }
                } else if (bowl.foodType === "rat_poison") {
                  h.isPoisoned = true;
                  if (h.renderer) h.renderer.tinted = null;
                  h.vomitTimer = 4.0 + Math.random() * 6.0;
                  h.changeHappiness(-0.1);
                  if (!h.isSmarty()) {
                    h.expressionOverride = "MISERABLE";
                    h.expressionOverrideTimer = 3.0;
                  }
                } else {
                  h.changeHappiness(HAPPINESS_BONUS_NUMMIES);
                }
                h.speak(getDialogue(key, h));
                break;
              }
            }
          }
        }
      }
    }
  }

  // Approach and eat/attack the cannibalism target
  updateCannibalism() {
    const h = this.horse;
    // Cannibalism interaction
    if (h.cannibalTarget && !h.isDragging) {
      // Prioritize nearby gibs over horses
      if (h.cannibalTarget instanceof Horse && typeof gibs !== "undefined") {
        let nearestGib = null;
        let minGibDist = Infinity;
        for (const gib of gibs) {
          if (gib.scene === h.scene && gib.freeGib) {
            const d = Math.sqrt((h.x - gib.x) ** 2 + (h.y - gib.y) ** 2);
            if (d < 300 && d < minGibDist) {
              minGibDist = d;
              nearestGib = gib;
            }
          }
        }
        if (nearestGib) {
          h.cannibalTarget = nearestGib;
          h.setTargetPosition(nearestGib.x, nearestGib.y);
        }
      }
      const target = h.cannibalTarget;
      const isStillValid =
        (target instanceof Gib &&
          !target.shouldDespawn &&
          target.scene === h.scene) ||
        (target instanceof Horse &&
          target.scene === h.scene &&
          target.currentCage === h.currentCage &&
          !target.isDestroyed);

      if (!isStillValid) {
        h.cannibalTarget = null;
      } else {
        const dist = Math.sqrt((h.x - target.x) ** 2 + (h.y - target.y) ** 2);
        const isGagged =
          h.accessories &&
          h.accessories.mouth &&
          h.accessories.mouth.id === "mouthgag";
        if (dist < 50) {
          if (target instanceof Gib) {
            if (!isGagged) h.eatGib(target);
            h.cannibalTarget = null;
          } else if (target instanceof Horse) {
            if (target.isAlive) {
              if (h.attackCooldown <= 0) {
                h.performCannibalAttack(target);
              }
            } else {
              if (!isGagged) h.eatCorpse(target);
              h.cannibalTarget = null;
            }
          }
        } else {
          // Move to target is already handled by scout/targetX in positioning
        }
      }
    }
  }

  // Mothers run after their grabbed foal
  updateMotherChase() {
    const h = this.horse;
    // Mother chasing grabbed baby logic
    if (!h.isDragging && !h.placedOn && !h.tooYoungToWalk() && h.canSee()) {
      const rels = relationships[h.id];

      if (rels) {
        const grabbedChild = fluffies.find(
          (f) =>
            f.isDragging &&
            f.tooYoungToWalk() &&
            f.isAlive &&
            !f.isSmarty() &&
            f.gender === "female" &&
            f.scene === h.scene &&
            (rels[f.id] === "baby_child" || rels[f.id] === "child"),
        );
        if (grabbedChild) {
          const childPos = grabbedChild.getWorldPosition();
          h.setTargetPosition(childPos.x, childPos.y);

          h.setShock(0.5); // Sustain while held
          if (!h.isMovingOrRunning()) {
            h.initBehavior(h.isCrawling ? "MOVING" : "RUNNING");
          } else if (h.currentStateKey === "MOVING" && !h.isCrawling) {
            h.currentStateKey = "RUNNING";
          }
        }
      }
    }
  }
}
