// ---------------------------------------------------------------------------
// Fluffy family life: feeding from and adopting mums, keeping track of
// family (missing relatives, reunions) and milk preferences.
// (Part of the Horse class, split out of Horse.js: addHorseMethods adds
// these to every fluffy. Loaded right after Horse.js.)
// ---------------------------------------------------------------------------

addHorseMethods({
  attemptFeedFromMare(mare) {
    if (
      !mare ||
      !mare.isAlive ||
      mare.lactatingTimer <= 0 ||
      mare.placedOn instanceof OperatingTable ||
      mare.currentCage != this.currentCage
    )
      return false;

    const isMom = mare.id === this.motherId;
    const mareTolerant =
      !worldSettings.alicornIntolerance || this.typeVisibleToOthers() !== "alicorn" || mare.tolerantOfAlicorns();
    const canSee = mare.canSee();
    const legless = mare.limbs.legs.every((l) => !l);

    // Keys
    let key1 = "GIVE_MILKIES",
      key2,
      key3;
    let success = true;

    if (mare.milkCharges > 0) {
      if (mare.happiness <= WAN_DIE_THRESHOLD) {
        key2 = "DEFAULT";
      } else if (
        canSee &&
        mare.genetics &&
        mumRejectsFoalColour(mare, this)
      ) {
        // Colorism rejection!
        key1 = "ATTACK";
        key2 = "COLOR";
        if (mare.attackCooldown <= 0 && mare.babiesToBirth <= 0) {
          mare.performAttack(this, "COLOR");
        }
        this.milkCooldown = 3.0;
        success = false;
      } else if (mare.currentStateKey === "SLEEPING") {
        key2 = "ASLEEP";
      } else if (!canSee) {
        key2 = "BLIND";
      } else if (isMom && mareTolerant) {
        key2 = "DEFAULT";
      } else if (legless && (mare.placedOn instanceof ImmobilizationBoard || Math.random() < 0.5)) {
        key2 = mareTolerant ? "LEGLESS" : "ALICORN";
      } else if (mareTolerant && this.attemptAdoption(mare)) {
        key2 = "ADOPTION";
      } else {
        // Failure: attack
        key1 = "DENY_MILKIES";
        key2 = "NOT_MOM";
        if (!mareTolerant) {
          key2 = "ALICORN";
        }
        if (mare.attackCooldown <= 0 && mare.babiesToBirth <= 0) {
          mare.performAttack(this, "MUNSTAH_BABBEH_ATTACK");
        }
        // 50% chance to fear the mare for 1 minute
        if (Math.random() < 0.5 && !this.fearedFluffies.some((f) => f.id === mare.id)) {
          this.fearedFluffies.push({
            id: mare.id,
            timer: 60,
            reason: "MILKIE_THIEF",
          });
        }
        this.milkCooldown = 3.0;
        success = false;
      }
    } else {
      // No milk left
      key1 = "NO_MILKIES";
      if ((!mareTolerant || !isMom) && mare.canSee()) {
        key2 = "BAD_BABY";
      }
      this.milkCooldown = 3.0;
      success = false;
    }

    if (success) {
      mare.milkCharges--;
      this.hunger = 1.0;
      this.addPreferredMilkSource(mare.id, "HORSE");
      if (mare.isPoisoned) {
        this.isPoisoned = true;
        if (this.renderer) this.renderer.tinted = null;
        this.vomitTimer = 4.0 + Math.random() * 6.0;
      }
      this.speak(getDialogue("DRINK_MILKIES", this, mare), false, true);
    }
    if (mare.happiness > WAN_DIE_THRESHOLD) {
      mare.speak(getDialogue([key1, key2], mare, this));
    }

    return success;
  },

  attemptAdoption(mare) {
    const mom = fluffies.find((f) => f.id === this.motherId);
    const rels = relationships[mare.id];
    if (
      rels[this.id] === "rejected_baby" ||
      (mom && mom.isAlive) ||
      mare.gender !== "female" ||
      mare.lactatingTimer <= 0
    )
      return false;

    const babies = fluffies.filter((f) => f.motherId === mare.id && f.isAlive && f.tooYoungToWalk());
    const adoptionChance = 1 + this.adoptionModifier - babies.length * 0.34;
    if (Math.random() < adoptionChance) {
      // ADOPT!
      this.motherId = mare.id;
      this.adopted = mare.adopted;

      setRelationship(mare.id, this.id, "baby_child");
      setRelationship(this.id, mare.id, "mother");

      // Siblings
      const otherKids = fluffies.filter((f) => f.motherId === mare.id && f.id !== this.id);
      for (const sibling of otherKids) {
        setRelationship(this.id, sibling.id, sibling.gender === "male" ? "brother" : "sister");
        setRelationship(sibling.id, this.id, this.gender === "male" ? "brother" : "sister");
      }

      // Special Friend
      const specialFriendId = Object.keys(rels).find((id) => rels[id] === "special_friend");
      if (specialFriendId) {
        const dad = fluffies.find((f) => f.id == specialFriendId);
        if (dad) {
          setRelationship(dad.id, this.id, "baby_child");
          setRelationship(this.id, dad.id, "father");
        }
      }
      return true;
    } else {
      setRelationship(mare.id, this.id, "rejected_baby");
      return false;
    }
  },

  updateRelationships(dt) {
    const rels = relationships[this.id];
    if (!rels) return;

    let missingRelative = false;
    const effectiveDt = relCheat ? dt * 50 : dt;
    let newlyLostRelative = null;

    for (const [otherId, relation] of Object.entries(rels)) {
      // Only perceive certain relationships
      if (
        ![
          "mother",
          "father",
          "child",
          "baby_child",
          "brother",
          "sister",
          "special_friend",
          "forgotten_special_friend",
        ].includes(relation)
      )
        continue;

      const other = fluffies.find((f) => f.id == otherId);
      if (!this.perceivedRelationships[otherId]) {
        this.perceivedRelationships[otherId] = {
          state: "current",
          timer: 0,
        };
      }

      const pRel = this.perceivedRelationships[otherId];
      if (other && other.scene === this.scene) {
        if (!other.isAlive) {
          if (pRel.state !== "dead") {
            pRel.state = "dead";
            if (relation === "special_friend") {
              rels[otherId] = "forgotten_special_friend";
            }
            this.changeHappiness(HAPPINESS_PENALTY_CORPSE_FEAR_RELATION);
            this.expressionOverride = "CRYING_SHOCKED";
            this.expressionOverrideTimer = 3.0;
            if (!this.tooYoungToSpeak()) {
              this.speak(getDialogue("RELATIVE_KILLED", this));
            }
          }
        } else {
          // Reunited or Current
          if (pRel.state === "lost" || pRel.state === "forgotten" || pRel.state === "dead") {
            this.handleReunion(other, relation);
          }
          pRel.state = "current";
          pRel.timer = 0;
        }
      } else {
        // Not in scene
        pRel.timer += effectiveDt;
        if (pRel.state === "current") {
          this.speech.nextTime = 0;
          pRel.state = "lost";
          newlyLostRelative = [otherId, pRel];
        } else if (pRel.state === "lost" && pRel.timer > 180) {
          pRel.state = "forgotten";
          if (relation === "special_friend") {
            rels[otherId] = "forgotten_special_friend";
          }

          if (relation === "mother") {
            this.speak(
              getDialogue(
                this.tooYoungToSpeak() ? ["LOST", "MOTHER", "PERMANENT_CHIRPY"] : ["LOST", "MOTHER", "PERMANENT"],
                this,
              ),
            );
          }
        }
      }

      // Frantic logic only for "lost" state
      if (this.hasMissingRelative(relation, pRel)) {
        missingRelative = true;
      }
    }

    if (missingRelative && this.speech.nextTime <= 0 && (this.canSee() || this.canHear())) {
      let target = null;
      let key = null;

      let lostRelative = newlyLostRelative;
      if (!lostRelative) {
        lostRelative = Object.entries(this.perceivedRelationships).find(([_, pRel]) => pRel.state === "lost");
      }
      if (!lostRelative) return;
      const [otherId, pRel] = lostRelative;

      if (pRel.state === "lost") {
        const relation = rels[otherId];
        const other = fluffies.find((f) => f.id == otherId);
        if (this.gender === "female" && (relation === "baby_child" || relation === "child")) {
          target = other;
          key = ["LOST", "BABY"];
        } else if (relation === "mother") {
          target = other;
          key = this.tooYoungToSpeak() ? ["LOST", "MOTHER", "CHIRPY"] : ["LOST", "MOTHER"];
        } else if ((relation === "brother" || relation === "sister") && !this.tooYoungToSpeak()) {
          target = other;
          key = relation === "brother" ? ["LOST", "BROTHER"] : ["LOST", "SISTER"];
        } else if (relation === "special_friend") {
          target = other;
          key = ["LOST", "SPECIAL_FRIEND"];
        }
      }

      if (key) {
        if (!this.sensitiveBaby) {
          this.speak(getDialogue(key, this, target));
        }

        if (this.happiness > HAPPINESS_MISERABLE_THRESHOLD) {
          this.changeHappiness(HAPPINESS_PENALTY_LOST_RELATIVE);
        }

        this.expressionOverride = "MISERABLE";
        this.expressionOverrideTimer = 3.0;
        this.speech.nextTime = 10 + Math.random() * 5;
      }
    }
  },

  hasMissingRelative(relation = null, pRel = null) {
    if (relation !== null || pRel !== null) {
      if (!pRel || pRel.state !== "lost") return false;
      return (
        relation === "baby_child" ||
        relation === "child" ||
        relation === "mother" ||
        relation === "brother" ||
        relation === "sister" ||
        relation === "special_friend"
      );
    }

    const rels = typeof relationships !== "undefined" ? relationships[this.id] : null;
    if (!rels || !this.perceivedRelationships) return false;

    for (const [otherId, pRelEntry] of Object.entries(this.perceivedRelationships)) {
      if (pRelEntry && pRelEntry.state === "lost") {
        const rel = rels[otherId];
        if (
          rel === "baby_child" ||
          rel === "child" ||
          rel === "mother" ||
          rel === "brother" ||
          rel === "sister" ||
          rel === "special_friend"
        ) {
          return true;
        }
      }
    }
    return false;
  },

  calculateIsFrantic(hasMissing = null) {
    if (!this.isAlive) return false;
    const wanDieThreshold = WAN_DIE_THRESHOLD;
    if (this.happiness <= wanDieThreshold) return false;
    const missing = hasMissing !== null ? hasMissing : this.hasMissingRelative();
    const aphro = this.isUnderAphrodisiac();
    return !!(missing || aphro);
  },

  handleReunion(other, relation) {
    const key1 = "REUNION";
    const key2 = getSimpleRelationship(relation);
    let key3;

    if (key2 === "special_friend") {
      // Check if either has a DIFFERENT special friend now
      const myRels = relationships[this.id];
      const otherRels = relationships[other.id];

      let iHaveNew = false;
      let otherHasNew = false;

      if (myRels) {
        for (const [rid, rtype] of Object.entries(myRels)) {
          if (rtype === "special_friend" && rid != other.id) {
            iHaveNew = true;
            break;
          }
        }
      }
      if (otherRels) {
        for (const [rid, rtype] of Object.entries(otherRels)) {
          if (rtype === "special_friend" && rid != this.id) {
            otherHasNew = true;
            break;
          }
        }
      }

      if (iHaveNew || otherHasNew) {
        key3 = "REJECT";
        // If they were forgotten, they are now just friends
        if (relation === "forgotten_special_friend") {
          if (myRels) myRels[other.id] = "friend";
          if (otherRels) otherRels[this.id] = "friend";
        }
      } else {
        key3 = this.gender !== other.gender ? "HETERO" : "DEFAULT";
        // If they were forgotten, restore the relationship
        if (relation === "forgotten_special_friend") {
          if (myRels) myRels[other.id] = "special_friend";
          if (otherRels) otherRels[this.id] = "special_friend";
        }
      }
    }

    if (relation && !this.tooYoungToSpeak()) {
      this.speak(getDialogue([key1, key2, key3], this, other));
      this.changeHappiness(HAPPINESS_BONUS_FAMILY_BABBLE);
    }
  },

  addPreferredMilkSource(id, type) {
    if (!this.preferredMilkSources.some((s) => s.id === id && s.type === type)) {
      this.preferredMilkSources.push({ id, type });
    }
  },

  fluffyIsRelatedOrSpecialFriend(f) {
    if (!relationships[this.id]) return false;
    const rel = (relationships[this.id] || {})[f.id];
    return (
      rel === "mother" ||
      rel === "father" ||
      rel === "child" ||
      rel === "baby_child" ||
      rel === "brother" ||
      rel === "sister" ||
      rel === "special_friend"
    );
  },

  tooFarFromBaby() {
    const rels = relationships[this.id];
    if (!rels) return null;

    for (const [otherId, relation] of Object.entries(rels)) {
      const other = fluffies.find((f) => f.id == otherId);
      if (!other || !other.isAlive || other.scene !== this.scene) continue;

      if (relation === "baby_child" && other.tooYoungToWalk() && (this.canSee() || this.canHear())) {
        const dist = Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
        if (dist > 400) return other;
      }
    }
    return null;
  },
});
