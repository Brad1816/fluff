// ---------------------------------------------------------------------------
// Mating, pregnancy and giving birth.
// (Part of the Horse class, split out of Horse.js: addHorseMethods adds
// these to every fluffy. Loaded right after Horse.js.)
// ---------------------------------------------------------------------------

addHorseMethods({
  mateWith(friend, maleForced = false, femaleForced = false) {
    if (this.gender === "male" && this.specialHuggiesCooldown > 0) return false;
    if (this.gender === "male" && this.isSensitive()) return false;
    const force = maleForced || femaleForced;
    if (
      !friend ||
      !placedOnValidForSpecialHuggies(friend.placedOn) ||
      (friend.isPregnant && !force) ||
      !canFluffiesMate(this, friend, force)
    )
      return false;
    // Not with close family, unless you make them or something's wrong
    // with them (Kinship.js)
    if (typeof kinBlocksMating === "function" && kinBlocksMating(this, friend, maleForced, femaleForced)) {
      if (this.gender === "male") this.specialHuggiesCooldown = Math.max(this.specialHuggiesCooldown || 0, 30);
      // Special friends who turn out to be close family: just friends now,
      // so each can find someone else
      if (!femaleForced && typeof relationships !== "undefined") {
        for (const [x, y] of [
          [this, friend],
          [friend, this],
        ]) {
          if (relationships[x.id] && relationships[x.id][y.id] === "special_friend") relationships[x.id][y.id] = "friend";
        }
      }
      if (typeof this.tooYoungToSpeak === "function" && !this.tooYoungToSpeak() && Math.random() < 0.3 && typeof getDialogue === "function")
        this.speak(getDialogue(["SPECIAL_HUGGIES", "FAMILY"], this, friend));
      return false;
    }
    const isMaleOnMaleUnconsensual =
      this.gender === "male" && friend.gender === "male" && !isSexuallyAttractedTo(friend, this);
    if (isMaleOnMaleUnconsensual && canFightBack(friend)) {
      return false;
    }
    if (!this.tinted || !this.tinted.torso) return false;
    // Not through a fence
    if (typeof canFluffiesReachEachOther === "function" && !canFluffiesReachEachOther(this, friend)) return false;

    friend.y = this.y + this.tinted.torso.height * 0.25 * this.scale;
    const d = this.tinted.torso.width * 0.35 * this.scale;
    const diff = this.facingRight ? -d : d;
    this.x = friend.x + diff;
    friend.facingRight = this.facingRight;

    const hasCastrationBand =
      this.accessories && this.accessories["ABOVE_LUMPS"] && this.accessories["ABOVE_LUMPS"].id === "castration_band";

    this.initBehavior("BENDING");
    if (hasCastrationBand) {
      this.speak(getDialogue(["CASTRATION_BAND_MATING", this.tooYoungToSpeak() ? "BABY" : "DEFAULT"], this));
    } else {
      this.speak(getDialogue(["SPECIAL_HUGGIES", "ENF"], this));
    }
    friend.initBehavior("BENDING_2");

    if (this.gender === "male") {
      this.specialHuggiesCooldown = this.isUnderAphrodisiac() ? 10 : 30;
    }

    this.matingState.isMating = true;
    const time = hasCastrationBand ? 1.0 : Math.random() * 3 + 3;
    this.stateTimer = time + 0.5;
    friend.stateTimer = time + 0.5;
    this.matingState.matingTimer = time;
    this.matingState.matingWith = friend;
    this.matingState.femaleForced = femaleForced;
    this.matingState.interruptible = !maleForced && femaleForced;
    this.matingState.hasCastrationBand = hasCastrationBand;

    // Set friend's mating state as well
    friend.matingState.isMating = true;
    if (typeof fluffySound === "function") fluffySound(this, "enf"); // FluffySounds.js
    friend.matingState.matingWith = this;
    friend.matingState.matingTimer = time;
    friend.matingState.femaleForced = femaleForced;
    friend.matingState.interruptible = this.matingState.interruptible;

    if (femaleForced && friend.fearedFluffies && !friend.fearedFluffies.some((f) => f.id === this.id)) {
      friend.fearedFluffies.push({
        id: this.id,
        timer: 300,
        reason: "BAD_ENFIES",
      });
    }

    const badEnfiesKey =
      friend.gender === "male"
        ? ["SPECIAL_HUGGIES", "BAD_ENFIES", "STALLION"]
        : ["SPECIAL_HUGGIES", "BAD_ENFIES", "MARE"];

    if (!maleForced && !femaleForced) {
      this.changeHappiness(HAPPINESS_BONUS_MATE_SUCCESS);
      friend.changeHappiness(HAPPINESS_BONUS_MATE_SUCCESS);
      this.expressionOverride = "GOOD_UPSIES";
      this.expressionOverrideTimer = 3.0;
      friend.expressionOverride = "GOOD_UPSIES";
      friend.expressionOverrideTimer = 3.0;
      friend.speak(getDialogue(["SPECIAL_HUGGIES", "IP"], friend));
    } else if (!maleForced && femaleForced) {
      this.changeHappiness(HAPPINESS_BONUS_MATE_SUCCESS);
      friend.changeHappiness(HAPPINESS_PENALTY_MATE_FORCED_MARE);
      if (!this.isUnderAphrodisiac()) {
        this.expressionOverride = "SMUG";
        this.expressionOverrideTimer = 3.0;
      }
      friend.setShock(3.0);
      if (!friend.tooYoungToSpeak()) {
        friend.speak(getDialogue(badEnfiesKey, friend, this));
      }
    } else if (maleForced && femaleForced) {
      this.changeHappiness(HAPPINESS_PENALTY_MATE_BAD_ENFIES);
      friend.changeHappiness(HAPPINESS_PENALTY_MATE_BAD_ENFIES);
      this.expressionOverride = "BAD_UPSIES";
      this.expressionOverrideTimer = 3.0;
      friend.setShock(3.0);
      if (!friend.tooYoungToSpeak()) {
        friend.speak(getDialogue(badEnfiesKey, friend, this));
      }
    }

    if (hasCastrationBand) {
      this.expressionOverride = "CRYING_SHOCKED";
      this.expressionOverrideTimer = 3.0;
    }

    return true;
  },

  _interruptMating() {
    if (!this.matingState.isMating) {
      return;
    }

    this.speak(getDialogue(["SPECIAL_HUGGIES", "INTERRUPTED"], this));
    this.matingState.isMating = false;
    const friend = this.matingState.matingWith;
    this.matingState.matingWith = null;

    if (friend && friend.matingState.isMating) {
      friend.interruptMating();
    }
  },

  interruptMating() {
    if (!this.matingState.isMating) {
      return;
    }

    this._interruptMating();
    this.initBehavior("IDLE");
  },

  updateMating(dt) {
    if (!this.matingState.isMating || this.gender !== "male") {
      return;
    }
    this.matingState.matingTimer -= dt;
    if (this.matingState.matingTimer <= 0.0) {
      this.finishMating();
    }
  },

  finishMating() {
    const friend = this.matingState.matingWith;
    const femaleForced = this.matingState.femaleForced;
    const hasCastrationBand =
      this.matingState.hasCastrationBand ||
      (this.accessories && this.accessories["ABOVE_LUMPS"] && this.accessories["ABOVE_LUMPS"].id === "castration_band");
    this.matingState.isMating = false;
    this.matingState.matingWith = null;

    if (friend) {
      friend.matingState.isMating = false;
      friend.matingState.matingWith = null;
      friend.initBehavior("IDLE");
    }

    if (!friend) {
      return;
    }

    if (!femaleForced) {
      friend.speak(getDialogue(["SPECIAL_HUGGIES", "GUD_FEEWS"], this));
    }
    if (!hasCastrationBand) {
      this.speak(getDialogue(["SPECIAL_HUGGIES", "GUD_FEEWS"], this));
    }

    if (friend.gender === "female" && friend.isPregnant) {
      // Force miscarriage of existing foals
      if (friend.foalViability) {
        for (let i = 0; i < friend.foalViability.length; i++) {
          friend.foalViability[i] = false;
          friend.pregnancyTimer = Math.min(friend.pregnancyTimer, 10);
        }
        if (!friend.traumaMemory.some((tm) => tm.type === "miscarriage")) {
          friend.traumaMemory.push({
            type: "miscarriage",
            timer: 30 + Math.random() * 60,
          });
        }
        friend.changeHappiness(HAPPINESS_PENALTY_LOST_RELATIVE);
      }
    } else if (friend.gender === "female" && this.gender === "male" && !friend.spayed && !hasCastrationBand) {
      friend.triggerPregnancy(this);
    }
  },

  triggerPregnancy(father) {
    // Elderly mares don't get pregnant any more (Aging.js)
    if (typeof tooOldToBreed === "function" && tooOldToBreed(this)) return;
    // Resting after a litter, or a hungry park (Population.js)
    if (typeof canConceiveNow === "function" && !canConceiveNow(this)) return;
    this.anatomy.triggerPregnancy(father);
  },

  _startActiveLabor() {
    if (this.claimedBed && this.claimedBed.scene === this.scene && this.claimedBed.currentCage === this.currentCage) {
      this.x = this.claimedBed.x;
      this.y =
        this.claimedBed.type === "cardboard_box"
          ? this.claimedBed.y + CARDBOARD_BOX_SLEEP_OFFSET
          : this.claimedBed.y - BED_HEIGHT / 2 - this.scale * 40;
    }
    this.birthIntervalTimer = 3;
    this.speak(getDialogue(["BIRTH", "START"], this), true);
    this.initBehavior("BENDING_2");
    this.stateTimer = 0.8;
  },

  spawnBaby(isViable = true) {
    this.anatomy.spawnBaby(isViable);
  },
});
