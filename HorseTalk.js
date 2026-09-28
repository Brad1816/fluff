// ---------------------------------------------------------------------------
// What fluffies say: babbling, family chatter, first words and speaking
// (speech bubbles and the chat log).
// (Part of the Horse class, split out of Horse.js: addHorseMethods adds
// these to every fluffy. Loaded right after Horse.js.)
// ---------------------------------------------------------------------------

addHorseMethods({
  getAphrodisiacDialogue() {
    return getDialogue("APHRODISIAC", this);
  },

  canBabble() {
    return !this.isFrantic && !this.isScared && this.expression !== "SHOCKED" && this.expression !== "CRYING_SHOCKED";
  },

  randomBabble() {
    if (!this.canBabble()) return false;
    const isGagged = this.accessories && this.accessories.mouth && this.accessories.mouth.id === "mouthgag";
    if (isGagged && Math.random() < 0.5) {
      this.expressionOverride = "MISERABLE";
      this.expressionOverrideTimer = 3.0;
      return;
    }

    let text = null;
    let speakBypass = false;

    if (!this.tooYoungToSpeak() && this.happiness <= WAN_DIE_THRESHOLD) {
      text = getDialogue("WAN_DIE", this);
      speakBypass = true;
    }

    if (!text) {
      if (this.tooYoungToSpeak()) {
        if (this.hunger < 0.2) {
          text = getDialogue(["STARVING", "CHIRPY"], this);
        } else if (this.hunger < 0.3) {
          text = getDialogue(["VERY_HUNGRY", "CHIRPY"], this);
        } else if (this.hunger < 0.5) {
          text = getDialogue(["HUNGRY", "CHIRPY"], this);
        }
      }
    }

    if (!text && this.happiness > 0.1 && !this.tooYoungToSpeak()) {
      if (this.hunger < 0.2) {
        text = getDialogue(["STARVING"], this);
      } else if (this.hunger < 0.25) {
        let key = this.adopted ? ["VERY_HUNGRY", "ADOPTED"] : ["VERY_HUNGRY", "FERAL"];
        text = getDialogue(key, this);
      } else if (this.hunger < 0.5) {
        let key = this.adopted ? ["HUNGRY", "ADOPTED"] : ["HUNGRY", "FERAL"];
        text = getDialogue(key, this);
      }
    }

    if (!text && this.currentCage && this.happiness > WAN_DIE_THRESHOLD) {
      if (this.tooYoungToSpeak()) {
        text = getDialogue(["LOST", "MOTHER", "CHIRPY"], this);
      } else if (this.isSmarty()) {
        text = getDialogue(["SORRY_BOX", "SMARTY"], this);
        this.expressionOverride = "ANGRY_PUFFED";
        this.expressionOverrideTimer = 3.0;
      } else if (this.adopted) {
        text = getDialogue(["SORRY_BOX", "ADOPTED"], this);
      } else {
        text = getDialogue(["SORRY_BOX", "FERAL"], this);
      }
    }

    if (
      !text &&
      !this.tooYoungToSpeak() &&
      this.happiness > WAN_DIE_THRESHOLD &&
      this.placedOn instanceof LitterpalBox
    ) {
      if (this.isSmarty()) {
        text = getDialogue(["LITTERPAL", "SMARTY"], this);
        this.expressionOverride = "ANGRY_PUFFED";
        this.expressionOverrideTimer = 3.0;
      } else {
        text = getDialogue("LITTERPAL", this);
        this.expressionOverride = "MISERABLE";
        this.expressionOverrideTimer = 3.0;
      }
    }

    if (
      !text &&
      this.accessories &&
      this.accessories["torso"] &&
      this.accessories["torso"].id === "wingjacket" &&
      !this.tooYoungToSpeak() &&
      this.happiness > WAN_DIE_THRESHOLD &&
      Math.random() < 0.3
    ) {
      if ((this.limbs.leftWing || this.limbs.rightWing) && Math.random() < 0.75) {
        text = getDialogue("COMPLAIN_WINGJACKET_WINGS", this);
      } else {
        text = getDialogue("COMPLAIN_WINGJACKET", this);
      }
      this.expressionOverride = "DISGUSTED";
      this.expressionOverrideTimer = 3.0;
    }

    if (
      !text &&
      this.accessories &&
      this.accessories["eyes"] &&
      this.accessories["eyes"].id === "blindfold" &&
      !this.tooYoungToSpeak() &&
      this.happiness > WAN_DIE_THRESHOLD &&
      Math.random() < 0.25
    ) {
      text = getDialogue("COMPLAIN_BLINDFOLD", this);
      this.expressionOverride = "SHOCKED";
      this.expressionOverrideTimer = 3.0;
    }

    // Relationship check: prioritize family dialogue if close
    if (!text) {
      text = this.babbleFamilyDialogue();
    }

    if (!text) {
      if (this.isPregnant && !this.tooYoungToSpeak() && Math.random() < 0.8 && this.hunger > 0.6) {
        text = getDialogue(["HELLO", "TUMMY_BABIES", "MOTHER"], this);
        this.initBehavior("LYING");
      }
    }

    if (!text && !this.tooYoungToSpeak() && this.health < 40) {
      text = getDialogue("LOW_HEALTH", this);
    }

    if (!text) {
      const lostBabies = Object.keys(this.trauma).filter((id) => this.trauma[id] >= 300);
      if (lostBabies.length > 0 && Math.random() < 0.4) {
        const babyId = lostBabies[Math.floor(Math.random() * lostBabies.length)];
        const baby = fluffies.find((f) => f.id == babyId);
        text = getDialogue(["TRAUMA", "BABY"], this, baby);
      }
    }

    if (!text) {
      if (this.personalities.length > 0 && Math.random() < 0.3 && this.adopted && !this.tooYoungToSpeak()) {
        const p = this.personalities[Math.floor(Math.random() * this.personalities.length)];
        if (p === "true_feral") text = getDialogue(["PERSONALITY", "TRUE_FERAL"], this);
        else if (p === "lost_from_herd") text = getDialogue(["PERSONALITY", "LOST_HERD"], this);
        else if (p === "runaway") text = getDialogue(["PERSONALITY", "RUNAWAY"], this);
        else if (p === "smarty") {
          text = getDialogue(["PERSONALITY", "SMARTY"], this);
          this.expressionOverride = "ANGRY_PUFFED";
          this.expressionOverrideTimer = 3.0;
        } else if (p === "mill_escapee") text = getDialogue(["PERSONALITY", "MILL_ESCAPE"], this);
        else if (p === "mill_baby") text = getDialogue(["PERSONALITY", "MILL_BABY"], this);
        else if (p === "abandoned_baby") text = getDialogue(["PERSONALITY", "ABANDONED_BABY"], this);
        else if (p === "abandoned") text = getDialogue(["PERSONALITY", "ABANDONED"], this);
      }
    }

    // Now and then, say something that shows a personality trait (Traits.js)
    if (
      !text &&
      this.adopted &&
      !this.tooYoungToSpeak() &&
      typeof getTraitBabble === "function" &&
      Math.random() < 0.15
    ) {
      text = getTraitBabble(this);
    }

    if (!text && this.happiness > 0.5) {
      if (!this.adopted && !getSceneConfig(this.scene).insidePlayerQuarters) {
        let key = this.tooYoungToSpeak() ? ["HELLO", , "FERAL_CHIRPY"] : ["HELLO", , "FERAL"];
        if (!getSceneConfig(currentScene).insidePlayerQuarters && this.canSee()) {
          key = this.tooYoungToSpeak()
            ? ["HELLO", "PLAYER", "CHIRPY"]
            : this.isSmarty()
              ? ["HELLO", "PLAYER", "SMARTY"]
              : ["HELLO", "PLAYER"];
        }
        text = getDialogue(key, this);
      } else {
        if (this.tooYoungToSpeak()) {
          text = getDialogue("CHIRP", this);
        } else {
          if (this.isSmarty()) {
            text = getDialogue(["PERSONALITY", "SMARTY"], this);
            this.expressionOverride = "ANGRY_PUFFED";
            this.expressionOverrideTimer = 3.0;
          } else {
            text = getDialogue(["HELLO", "FATHER"], this);
          }
        }
      }
    }

    if (text) {
      this.speak(text, speakBypass, false);
      return true;
    }
    return false;
  },

  babbleFamilyDialogue() {
    if (this.tooYoungToSpeak() || (!this.canSee() && !this.canHear())) return null;
    const rels = relationships[this.id];
    if (!rels) return null;

    const candidates = [];
    for (const [otherId, relation] of Object.entries(rels)) {
      const other = fluffies.find((f) => f.id == otherId && f.isAlive && f.scene === this.scene);
      if (relation === "estranged_child") {
        continue;
      }

      // Not with someone on the other side of a fence: that's handled by
      // the sad "pen feelings" in Fence.js instead of a happy chat
      if (other && typeof canFluffiesReachEachOther === "function" && !canFluffiesReachEachOther(this, other)) {
        continue;
      }

      if (other) {
        const dist = Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
        if (dist < 500) {
          candidates.push({ other, relation });
        }
      }
    }

    if (candidates.length === 0) return null;

    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    const other = choice.other;
    const relation = choice.relation;

    const key1 = "HELLO";
    const key2 = getSimpleRelationship(relation);
    const key3 = getSimpleRelationship(relationships[other.id][this.id]); // get the other side of the relationship

    this.changeHappiness(HAPPINESS_BONUS_FAMILY_BABBLE);
    other.changeHappiness(HAPPINESS_BONUS_FAMILY_BABBLE);
    if (typeof onFluffiesChatted === "function") onFluffiesChatted(this, other); // Bonds.js

    if (key2 == "father" && this.isSmarty()) {
      this.expressionOverride = "ANGRY_PUFFED";
      this.expressionOverrideTimer = 3.0;
      return getDialogue(["PERSONALITY", "SMARTY"], this, other);
    }

    return getDialogue([key1, key2, key3], this, other);
  },

  firstWordsBabble() {
    const text = getDialogue("BABY_FIRST_WORDS", this);
    this.speak(text, false, true);
  },

  speak(text, wanDieBypass = false, chirpyBypass = false) {
    if (this.accessories && this.accessories.mouth && this.accessories.mouth.id === "mouthgag") return;
    if (!wanDieBypass) {
      if (this.hunger <= 0.1) return;
      if (this.happiness <= WAN_DIE_THRESHOLD) return;
    }

    let finalLines = text;

    if (!this.tooYoungToSpeak() && this.growth < FULL_SPEECH_THRESHOLD && !chirpyBypass) {
      finalLines = filterBabyTalk(finalLines, this.growth);
    }

    if (this.tooYoungToSpeak() && this.scene === currentScene) {
      // Random pitch +- 10%
      const pitch = 1.5 + Math.random() * 0.5;
      const sound = ["foal_chirp_1", "foal_chirp_2", "foal_chirp_3", "foal_chirp_4"][Math.floor(Math.random() * 4)];
      playSound(sound, 0.5, pitch);
    }

    this.speech.text = finalLines;

    this.speech.timer = 3.0;

    this.speech.opacity = 1;

    this.speech.nextTime = Math.random() * 5 + 5;

    if (this.scene === currentScene) {
      const speakerName =
        typeof fluffyDisplayName === "function"
          ? fluffyDisplayName(this)
          : (typeof fluffyNames !== "undefined" && fluffyNames[this.id]) || "Fluffy";
      const bodyColor = this.colors && this.colors.body ? this.colors.body : null;
      if (typeof logChatMessage === "function") {
        logChatMessage(this.scene, speakerName, finalLines, bodyColor);
      }
    }

    if (this.scene === "OUTDOORS" && Math.random() < 0.4) {
      addDoorMessage(filterMuffled(text, 0.5));
    }
  },
});
