// A fluffy that hasn't moved for this long while walking stops (seconds)
const WALK_IN_PLACE_GIVE_UP = 1.5;

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
    // No target left (e.g. it reached a litterbox but couldn't go): stop,
    // rather than walk off toward the corner
    if (this.horse.targetX === null || this.horse.targetY === null || this.horse.targetX === undefined || this.horse.targetY === undefined) {
      if (!this.horse.litterboxUsed) {
        this.horse.initBehavior("IDLE");
        return true;
      }
    }
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
            !(typeof isBallCarried === "function" ? isBallCarried(b) : b.carriedBy) &&
            // (in a cage it stands higher than the ball rolls, and can't get
            // right up to the bars: near enough along the floor will do)
            (this.horse.currentCage && b.currentCage === this.horse.currentCage
              ? Math.abs(b.x - this.horse.x) < 80
              : Math.sqrt((b.x - this.horse.x) ** 2 + (b.y - this.horse.y) ** 2) < 50),
        );
        if (ball) {
          if (typeof onFluffyPlayed === "function") onFluffyPlayed(this.horse, "ball"); // Play.js
          poofs.push(new Poof(ball.x, ball.getCenterY(), this.horse.scene));
          ball.vx = (Math.random() - 0.5) * 800;
          ball.vy = -300 - Math.random() * 300;
          this.horse.speak(getDialogue(["PLAY", "BALL"], this.horse));
          this.horse.ballCooldown = Math.random() * 10 + 10;
          this.horse.expressionOverride = "GOOD_UPSIES";
          this.horse.expressionOverrideTimer = 2.0;
          this.horse.changeHappiness(HAPPINESS_BONUS_PLAY, "Played");
        }
        this.horse.ballTarget = false;
      } else if (this.horse.blockTarget) {
        const blocks = objects.filter((o) => o instanceof Block);
        const block = blocks.find(
          (b) =>
            b.scene === this.horse.scene &&
            this._nearBlock(b) &&
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
            this.horse.changeHappiness(HAPPINESS_BONUS_PLAY, "Played");
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
            this._nearBlock(b) &&
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
          this.horse.changeHappiness(HAPPINESS_BONUS_PLAY, "Played");
          this.horse.initBehavior("FLUFFY_JAB");
          if (typeof onFluffyPlayed === "function") onFluffyPlayed(this.horse, "block"); // Play.js
          this.horse.speak(getDialogue(["PLAY", "BLOCK_KNOCK_DOWN"], this.horse));
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
      let steering = false;
      if (typeof getFenceSteerPoint === "function") {
        const sp = getFenceSteerPoint(this.horse);
        if (sp) {
          steering = true;
          mdx = sp.x - this.horse.x;
          mdy = sp.y - this.horse.y;
          mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        }
      }

      const ox = this.horse.x;
      const oy = this.horse.y;
      if (mdist > 0.001) {
        const step = Math.min(mdist, moveStep);
        this.horse.x += step >= mdist ? mdx : (mdx / mdist) * step;
        this.horse.y += step >= mdist ? mdy : (mdy / mdist) * step;
      }
      // Walking on the spot (a wall, a block, a fence or a cage side in the
      // way, a target it can't reach): if it gets no closer for a moment it
      // gives up and stops there, so the legs don't keep going (the arrival
      // check above takes it from here)
      const h = this.horse;
      const now = timePlayed;
      const pr = h._walkProg;
      if (!pr || Math.hypot(pr.tx - h.targetX, pr.ty - h.targetY) > 30 || now < pr.at || now - pr.at > 5) {
        h._walkProg = { best: dist, at: now, tx: h.targetX, ty: h.targetY, x: h.x, y: h.y };
        h._walkInPlace = 0;
      } else if (dist < pr.best - 2 || (steering && Math.hypot(h.x - pr.x, h.y - pr.y) > 2)) {
        // (closer - or, going round a fence, at least getting somewhere)
        pr.best = Math.min(pr.best, dist);
        pr.at = now;
        pr.x = h.x;
        pr.y = h.y;
        h._walkInPlace = 0;
      } else h._walkInPlace = now - pr.at;
      if (this.horse._walkInPlace > WALK_IN_PLACE_GIVE_UP) {
        this.horse._walkInPlace = 0;
        this.horse._walkProg = null;
        this.horse.litterboxUsed = null;
        this.horse.ballTarget = false;
        this.horse.blockTarget = false;
        this.horse.blockTowerKnockOverTarget = false;
        this.horse.targetX = this.horse.x;
        this.horse.targetY = this.horse.y;
        this.horse.initBehavior("IDLE");
        return true;
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
    }
    // Running away hurts most the first time; one fright can't cost more
    // than FEARED_FLUFFY_MAX_LOSS however often it runs (in a small room it
    // used to run every few seconds until it gave up and starved)
    const entry = this.horse.fearedFluffies.find((ff) => ff.id === target.id);
    const lost = (entry && entry.lost) || 0;
    const loss = Math.min(lost > 0 ? 0.01 : 0.05, Math.max(0, FEARED_FLUFFY_MAX_LOSS - lost));
    if (loss > 0) {
      this.horse.changeHappiness(-loss);
      if (entry) entry.lost = lost + loss;
    }
    return true;
  }

  executeCorpseReaction(closestCorpse) {
    let key = closestCorpse.tooYoungToWalk() ? ["CORPSE", "BABY"] : "CORPSE";
    // A dead alicorn it never accepted: no grief (AlicornAcceptance.js)
    if (typeof shrugsOffAlicornDeath === "function" && shrugsOffAlicornDeath(this.horse, closestCorpse)) {
      this.horse.bloodReactionTimer = 5.0;
      if (!this.horse.tooYoungToSpeak() && this.horse.speech.nextTime <= 0) {
        this.horse.speak(getDialogue(["CORPSE", "ALICORN"], this.horse, closestCorpse));
        this.horse.speech.nextTime = 4 + Math.random() * 2;
      }
      return true;
    }

    // Too young or too simple to know: it's asleep (FoalLife.js) - or it's
    // one of its own it's already puzzling over
    const c = this.horse._deathConfusion;
    if ((c && !c.done && c.id === closestCorpse.id) || (typeof mistakesBodyForSleeping === "function" && mistakesBodyForSleeping(this.horse, closestCorpse))) {
      this.horse.bloodReactionTimer = 8.0;
      if (!(c && c.id === closestCorpse.id) && this.horse.speech.nextTime <= 0 && Math.random() < 0.5) {
        this.horse.speak(getDialogue(["NOT_DEAD", "STRANGER", this.horse.tooYoungToSpeak() ? "CHIRPY" : "DEFAULT"], this.horse, closestCorpse));
        this.horse.speech.nextTime = 4 + Math.random() * 2;
      }
      return true;
    }

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

    this.horse.changeHappiness(penalty, "Saw a body");
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
    this.horse.changeHappiness(HAPPINESS_PENALTY_BLOOD_FEAR, "Saw blood");

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
          this.horse.changeHappiness(HAPPINESS_PENALTY_CANT_HUG, "Hug turned down");
          this.horse.speak(
            getDialogue(["SPECIAL_HUGGIES", "NO_LEGS"], this.horse),
          );
          this.horse.specialHuggiesCooldown = 30;
        }
      } else if (!this.horse.limbs.lumps) {
        if (this.horse.speech.nextTime <= 0) {
          this.horse.changeHappiness(HAPPINESS_PENALTY_CANT_HUG, "Hug turned down");
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
      const me = this.horse;
      const accept = () => {
        target.speak(getDialogue(acceptKey, target, me));
        me.changeHappiness(HAPPINESS_BONUS_PROPOSAL_ACCEPT, "A new friend");
        target.changeHappiness(HAPPINESS_BONUS_PROPOSAL_ACCEPT, "A new friend");
      };
      // (your say, when you're in the room: SpecialFriends.js)
      if (typeof proposeSpecialFriends === "function") proposeSpecialFriends(me, target, accept);
      else {
        accept();
        if (!relationships[me.id]) relationships[me.id] = {};
        if (!relationships[target.id]) relationships[target.id] = {};
        relationships[me.id][target.id] = "special_friend";
        relationships[target.id][me.id] = "special_friend";
      }
    }
    this.horse.initBehavior("IDLE");
    target.initBehavior("IDLE");
    return true;
  }

  executeProposeFriendship() {
    for (const f of fluffies) {
      // (the cheap tests first: someone else, alive, close by)
      if (f === this.horse || !f.isAlive || f.scene !== this.horse.scene || f.currentCage !== this.horse.currentCage) continue;
      if ((this.horse.x - f.x) ** 2 + (this.horse.y - f.y) ** 2 >= 150 * 150) continue;
      if (
        worldSettings.alicornIntolerance &&
        f.typeVisibleToOthers() === "alicorn" &&
        !this.horse.tolerantOfAlicorns()
      )
        continue;

      // Colourists shun poopie and drab coats (globals.js colourShunChance)
      if (Math.random() < colourShunChance(this.horse, f)) continue;

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
            this.horse.changeHappiness(HAPPINESS_PENALTY_DIRTY_PUDDLE, "Dirty puddle");
            this.horse.lastPuddleReactionTime = 0;
            return true;
          }
        }
      }
    }
    return false;
  }

  // Close enough to a block to play with it? (in a cage it stands higher
  // than the blocks sit and can't reach the bars: along the floor will do)
  _nearBlock(b) {
    const h = this.horse;
    if (h.currentCage && b.currentCage === h.currentCage) return Math.abs(b.x - h.x) < 70;
    return Math.sqrt((b.x - h.x) ** 2 + (b.getBottomY() - 50 - h.y) ** 2) < 50;
  }

  // Turned away by this mare lately? (executeChirpyBabyMilk)
  _milkRefused(mare) {
    const t = this.horse._milkNo && this.horse._milkNo[mare.id];
    const now = typeof timePlayed === "number" ? timePlayed : 0;
    return typeof t === "number" && t > now && t - now <= MILK_REFUSED_WAIT;
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
          f.currentCage === this.horse.currentCage &&
          !this._milkRefused(f) &&
          // (not one who won't nurse it, or is away from it: Runts.js, BadMummah.js)
          !(typeof mumWontNurse === "function" && mumWontNurse(f, this.horse)),
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
          f.currentCage === this.horse.currentCage &&
          !this._milkRefused(f)
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
            // (the formula mummah has its own words: ArtificialMummah.js)
            const own = typeof onFeederDrink === "function" ? onFeederDrink(this.horse, bestTarget) : false;
            if (!own) {
              this.horse.speak(
                getDialogue(["DRINK_MILKIES", "FORMULA"], this.horse, null),
              );
            }
            fed = true;
          }
        } else {
          if (this.horse.attemptFeedFromMare(bestTarget)) {
            fed = true;
          } else if (!(typeof nursingSlotsFull === "function" && nursingSlotsFull(bestTarget, this.horse))) {
            // Turned away (or she's dry): try a feeder or someone else for a
            // while - an alicorn foal kept going back to the mum who wouldn't
            // have it, and starved beside a full feeder
            if (!this.horse._milkNo) this.horse._milkNo = {};
            this.horse._milkNo[bestTarget.id] = (typeof timePlayed === "number" ? timePlayed : 0) + MILK_REFUSED_WAIT;
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

}
