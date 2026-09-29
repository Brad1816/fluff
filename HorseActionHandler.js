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
            !b.carriedBy &&
            Math.sqrt((b.x - this.horse.x) ** 2 + (b.y - this.horse.y) ** 2) <
              50,
        );
        if (ball) {
          if (typeof onFluffyPlayed === "function") onFluffyPlayed(this.horse, "ball"); // Play.js
          poofs.push(new Poof(ball.x, ball.y, this.horse.scene));
          ball.vx = (Math.random() - 0.5) * 800;
          ball.vy = -300 - Math.random() * 300;
          this.horse.speak(getDialogue(["PLAY", "BALL"], this.horse));
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
            if (typeof onFluffyPlayed === "function") onFluffyPlayed(this.horse, "block"); // Play.js
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
          if (typeof onFluffyPlayed === "function") onFluffyPlayed(this.horse, "block"); // Play.js
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

      // Fences (Fence.js): if one is in the way, head for a point on the
      // way round it instead of straight at the target
      let mdx = dx,
        mdy = dy,
        mdist = dist;
      if (typeof getFenceSteerPoint === "function") {
        const sp = getFenceSteerPoint(this.horse);
        if (sp) {
          mdx = sp.x - this.horse.x;
          mdy = sp.y - this.horse.y;
          mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        }
      }

      if (mdist > 0.001) {
        const step = Math.min(mdist, moveStep);
        this.horse.x += step >= mdist ? mdx : (mdx / mdist) * step;
        this.horse.y += step >= mdist ? mdy : (mdy / mdist) * step;
      }

      if (mdist > 1) {
        this.horse.facingRight = mdx >= 0;
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
    this.horse.speech.nextTime = 0;
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
    this.horse.speech.nextTime = 0;
    this.horse.setShock(3.0);

    const runawayTarget = this.horse.positioning.getRunawayTarget(
      target.x,
      target.y,
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
      smarty.x,
      smarty.y,
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
    this.horse.lastBabbleTime = gameTimeMs();

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

      const proposedPerception = f.genetics.calculateColorismPerception();
      if (
        worldSettings.colorism &&
        Math.random() * this.horse.coloristDegree > proposedPerception
      )
        continue;

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

          // Nobody offers friendship to someone they can't stand (Bonds.js)
          const dislikes = typeof getLiking === "function" && getLiking(this.horse, f) < -0.1;
          if (!isRelated && !dislikes) {
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
          this.horse.fluffyIsRelatedOrSpecialFriend(f)) &&
        // Not with a rival herd's members (Herds.js)
        !(typeof keepsApart === "function" && keepsApart(this.horse, f))
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
        this.horse.currentStateKey !== "FOCUSING" &&
        rels[closestFriend.id] === "friend"
      ) {
        this.horse.speak(getDialogue(["HELLO", "FRIEND"], this.horse));
        if (typeof onFluffiesChatted === "function") onFluffiesChatted(this.horse, closestFriend); // Bonds.js
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
        target.speech.nextTime = 0;
        this.horse.speech.nextTime = 0;
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
        puddle.color !== "#8a0303" &&
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
        this.horse.setTargetPosition(bestTarget.x, bestTarget.y);

        this.horse.milkCooldown = 2.0;
        fed = true;
      }
    }

    return fed;
  }
}
