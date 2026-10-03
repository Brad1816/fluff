// ---------------------------------------------------------------------------
// Mating, pregnancy and giving birth.
// (Part of the Horse class, split out of Horse.js: addHorseMethods adds
// these to every fluffy. Loaded right after Horse.js.)
// ---------------------------------------------------------------------------

// The breeding cage (a stick, spray or tack on the stallion, script.js): why
// it wouldn't make foals with this mare, in a sentence for you - or null
function forcedBreedingProblem(male, mare) {
  const n = (f) => (typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "It");
  if (!mare) return "There's no grown mare in the cage with him.";
  if (male.isSensitive && male.isSensitive() && !(typeof sensitiveCanBreed === "function" && sensitiveCanBreed(male)))
    return `${n(male)} is too poorly to breed again yet.`;
  if ((male.specialHuggiesCooldown || 0) > 0) return `${n(male)} needs a rest before he can again.`;
  if (male.accessories && male.accessories["ABOVE_LUMPS"] && male.accessories["ABOVE_LUMPS"].id === "castration_band") return `${n(male)} has a castration band on.`;
  if (typeof canFluffiesMate === "function" && !canFluffiesMate(male, mare, true)) return `${n(male)} isn't interested in mares.`;
  if (mare.isPregnant) return `${n(mare)} is already pregnant - forcing him on her would make her lose the foals.`;
  if (mare.spayed) return `${n(mare)} is spayed: no foals.`;
  if (typeof tooOldToBreed === "function" && tooOldToBreed(mare)) return `${n(mare)} is too old for foals.`;
  if (typeof restingAfterBirth === "function" && restingAfterBirth(mare)) {
    const r = typeof describeBreedingRest === "function" ? describeBreedingRest(mare) : null;
    return `${n(mare)} is ${r ? r[0].charAt(0).toLowerCase() + r[0].slice(1) : "resting after her litter"} - no foals yet.`;
  }
  if (mare.isSensitive && mare.isSensitive() && !(typeof sensitiveCanBreed === "function" && sensitiveCanBreed(mare)))
    return `${n(mare)} is too poorly to breed again yet.`;
  return null;
}

let _breedingCageSaidAt = -1e9;
function sayBreedingCageProblem(text) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - _breedingCageSaidAt < 2500) return;
  _breedingCageSaidAt = now;
  if (typeof addUIMessage === "function") addUIMessage(text);
}

addHorseMethods({
  mateWith(friend, maleForced = false, femaleForced = false) {
    if (this.gender === "male" && this.specialHuggiesCooldown > 0) return false;
    // (a sensitive stallion can't by himself; you can breed him - Inbreeding.js)
    if (this.gender === "male" && this.isSensitive() && !(maleForced && typeof sensitiveCanBreed === "function" && sensitiveCanBreed(this))) return false;
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
      this.changeHappiness(HAPPINESS_BONUS_MATE_SUCCESS, "Special huggies");
      friend.changeHappiness(HAPPINESS_BONUS_MATE_SUCCESS, "Special huggies");
      this.expressionOverride = "GOOD_UPSIES";
      this.expressionOverrideTimer = 3.0;
      friend.expressionOverride = "GOOD_UPSIES";
      friend.expressionOverrideTimer = 3.0;
      friend.speak(getDialogue(["SPECIAL_HUGGIES", "IP"], friend));
    } else if (!maleForced && femaleForced) {
      this.changeHappiness(HAPPINESS_BONUS_MATE_SUCCESS, "Special huggies");
      friend.changeHappiness(HAPPINESS_PENALTY_MATE_FORCED_MARE, "Forced");
      if (!this.isUnderAphrodisiac()) {
        this.expressionOverride = "SMUG";
        this.expressionOverrideTimer = 3.0;
      }
      friend.setShock(3.0);
      if (!friend.tooYoungToSpeak()) {
        friend.speak(getDialogue(badEnfiesKey, friend, this));
      }
    } else if (maleForced && femaleForced) {
      this.changeHappiness(HAPPINESS_PENALTY_MATE_BAD_ENFIES, "Bad enfies");
      friend.changeHappiness(HAPPINESS_PENALTY_MATE_BAD_ENFIES, "Bad enfies");
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
      // Against your rule? (MatingRule.js)
      if (typeof noteMatingBreach === "function") {
        noteMatingBreach(this);
        noteMatingBreach(friend);
      }
    }
    if (!hasCastrationBand) {
      this.speak(getDialogue(["SPECIAL_HUGGIES", "GUD_FEEWS"], this));
    }

    if (friend.gender === "female" && friend.isPregnant) {
      // Mating a pregnant mare makes her lose the foals: labour in a few
      // seconds, however far along she is (HorseAnatomy.giveBirth)
      friend.beginMiscarriage();
    } else if (friend.gender === "female" && this.gender === "male" && !friend.spayed && !hasCastrationBand) {
      friend.triggerPregnancy(this);
      // Sensitive ones are worn out by it (Inbreeding.js)
      if (typeof noteSensitiveBred === "function") {
        noteSensitiveBred(this);
        noteSensitiveBred(friend);
      }
    }
  },

  // Labour comes early: within MISCARRIAGE_LABOR_DELAY seconds. How the
  // foals turn out depends on how far along she is (Premature.js): too
  // early and they're all stillborn.
  beginMiscarriage() {
    if (!this.isPregnant || !this.foalViability) return;
    const timeLeft = Math.min(this.pregnancyTimer, MISCARRIAGE_LABOR_DELAY);
    this.miscarriageTimer =
      this.miscarriageTimer === null || this.miscarriageTimer === undefined ? timeLeft : Math.min(this.miscarriageTimer, timeLeft);
    if (!this.traumaMemory.some((tm) => tm.type === "miscarriage")) {
      this.traumaMemory.push({
        type: "miscarriage",
        timer: 30 + Math.random() * 60,
      });
    }
    this.changeHappiness(HAPPINESS_PENALTY_LOST_RELATIVE, "Lost its foals");
  },

  // Labor is due once the pregnancy has run its course or a miscarriage has
  isPregnancyDue() {
    return (
      this.pregnancyTimer <= 0 ||
      (this.miscarriageTimer !== null && this.miscarriageTimer !== undefined && this.miscarriageTimer <= 0)
    );
  },

  isInLabor() {
    return this.isPregnancyDue() && this.babiesToBirth > 0;
  },

  // How far along the pregnancy is, 0 to 1
  getPregnancyProgress() {
    return clamp(1.0 - this.pregnancyTimer / pregnancyDuration, 0, 1);
  },

  triggerPregnancy(father) {
    // Elderly mares don't get pregnant any more (Aging.js)
    if (typeof tooOldToBreed === "function" && tooOldToBreed(this)) return;
    // Resting after a litter, or a hungry park (Population.js)
    if (typeof canConceiveNow === "function" && !canConceiveNow(this)) return;
    this.anatomy.triggerPregnancy(father);
  },

  _startActiveLabor() {
    // Settle into her bed - if she got there. (Held on a rack or table, or
    // still on her way when labour came, she gives birth where she is: a jump
    // to the bed pulled out her IV drips.)
    const bed = this.claimedBed;
    if (!this.placedOn && bed && bed.scene === this.scene && bed.currentCage === this.currentCage && Math.hypot(bed.x - this.x, bed.y - this.y) <= 80) {
      this.x = this.claimedBed.x;
      this.y =
        this.claimedBed.type === "cardboard_box"
          ? this.claimedBed.y + CARDBOARD_BOX_SLEEP_OFFSET
          : this.claimedBed.y - BED_HEIGHT / 2 - this.scale * 40;
    }
    this.birthIntervalTimer = 3;
    this.speak(getDialogue(this.isSensitive() ? ["SENSITIVE", "BIRTH"] : ["BIRTH", "START"], this), true, this.isSensitive());
    this.initBehavior("BENDING_2");
    this.stateTimer = 0.8;
  },

  spawnBaby(isViable = true) {
    return this.anatomy.spawnBaby(isViable);
  },
});
