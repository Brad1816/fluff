// ---------------------------------------------------------------------------
// Fluffy family life: feeding from and adopting mums, keeping track of
// family (missing relatives, reunions) and milk preferences.
// (Part of the Horse class, split out of Horse.js: addHorseMethods adds
// these to every fluffy. Loaded right after Horse.js.)
// ---------------------------------------------------------------------------

// Foals call for their mums (updateFoalCalls): when in distress (every
// FOAL_CALL_REST seconds while it lasts), and now and then when they've been
// on their own a while (FOAL_LONELY_AFTER seconds more than FOAL_MUM_NEAR
// away). A mum comes running only for a call she hears or a foal in
// distress she can see (tooFarFromBaby).
const FOAL_MUM_NEAR = 150; // px: close enough already
const FOAL_CALL_HEARD = 8; // game seconds a call brings her
const FOAL_CALL_REST = 10; // between calls in distress
const FOAL_LONELY_AFTER = 90; // on its own this long before it calls
const FOAL_LONELY_CHANCE = 0.03; // ...then a call this often a second
const FOAL_HUNGRY_CALL = 0.35;
const foalCallTicker = new Ticker(1);

function updateFoalCalls(dt) {
  const step = foalCallTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  for (const f of fluffies) {
    if (!f.isAlive || !f.tooYoungToWalk() || f.motherId === null || f.motherId === undefined) continue;
    if (f.currentStateKey === "SLEEPING") continue;
    const mum = fluffies.find((m) => m.id === f.motherId);
    if (!mum || !mum.isAlive || mum.scene !== f.scene || relationships[mum.id]?.[f.id] !== "baby_child") {
      f._aloneSince = undefined;
      continue;
    }
    const far = Math.hypot(mum.x - f.x, mum.y - f.y) > FOAL_MUM_NEAR;
    if (!far) {
      f._aloneSince = undefined;
      continue;
    }
    if (f._aloneSince === undefined || f._aloneSince > now) f._aloneSince = now;
    if (f.foalCallingMum() || (f._mumCallAt !== undefined && now - f._mumCallAt >= 0 && now - f._mumCallAt < FOAL_CALL_REST)) continue;
    const distress = f.foalInDistress();
    const lonely = now - f._aloneSince >= FOAL_LONELY_AFTER && Math.random() < FOAL_LONELY_CHANCE * step;
    if (!distress && !lonely) continue;
    f._mumCallAt = now;
    if (!f.speech || !f.speech.text) f.speak(getDialogue(["FOAL_CALL", f.tooYoungToSpeak() ? "CHIRPY" : "DEFAULT"], f));
  }
}
registerSystem("foalCalls", updateFoalCalls, 60);

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

    // A mum keeping the last of her milk for her bestest babbeh (Favourites.js)
    const heldBack = isMom && typeof bestestHoldsBack === "function" && mare.happiness > WAN_DIE_THRESHOLD && mare.canSee() && bestestHoldsBack(mare, this);
    if (mare.milkCharges > 0 && heldBack) {
      this.milkCooldown = 3.0;
      noteTurnedAway(mare, this);
      return false;
    }
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
      } else if (isMom && typeof mumForgotFoal === "function" && mumForgotFoal(mare, this)) {
        // She doesn't know it any more (too long in the incubator: Premature.js)
        key1 = "DENY_MILKIES";
        key2 = "NOT_MOM";
        this.milkCooldown = 3.0;
        success = false;
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
      if (isMom && typeof noteBestestFed === "function") noteBestestFed(mare, this); // (Favourites.js)
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
      // ADOPT! (Fostering.js)
      takeInFoal(mare, this);
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
          // (a relative it's never been around isn't missed: Acquaintance.js)
          state: other && (typeof haveMet !== "function" || haveMet(this, other)) ? "current" : "unmet",
          timer: 0,
        };
      }

      const pRel = this.perceivedRelationships[otherId];
      if (pRel.state === "unmet" && other && typeof haveMet === "function" && haveMet(this, other)) pRel.state = other.scene === this.scene ? "current" : "unmet";
      if (other && other.scene === this.scene) {
        if (!other.isAlive) {
          if (pRel.state !== "dead" && typeof shrugsOffAlicornDeath === "function" && shrugsOffAlicornDeath(this, other)) {
            pRel.state = "dead"; // (a munstah: good riddance - AlicornAcceptance.js)
            if (!this.tooYoungToSpeak() && Math.random() < 0.5) this.speak(getDialogue(["CORPSE", "ALICORN"], this));
          } else if (pRel.state !== "dead") {
            pRel.state = "dead";
            if (relation === "special_friend") {
              rels[otherId] = "forgotten_special_friend";
            }
            this.changeHappiness(HAPPINESS_PENALTY_CORPSE_FEAR_RELATION, "Saw family dead");
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
        if (pRel.state === "unmet") continue;
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
          this.changeHappiness(HAPPINESS_PENALTY_LOST_RELATIVE, "Lost family");
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
      this.changeHappiness(HAPPINESS_BONUS_FAMILY_BABBLE, "Family chatter");
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

  // A foal of hers that needs her and isn't by her side: one in distress she
  // can see, or one calling for her she can hear (it used to be any foal
  // more than 400px away, so mums were always running about)
  tooFarFromBaby() {
    const rels = relationships[this.id];
    if (!rels) return null;

    for (const [otherId, relation] of Object.entries(rels)) {
      if (relation !== "baby_child") continue;
      const other = fluffies.find((f) => f.id == otherId);
      if (!other || !other.isAlive || other.scene !== this.scene || !other.tooYoungToWalk()) continue;
      const dist = Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
      // A newborn that can't crawl yet and isn't on her back: she fetches it
      // (Carrying.js) - she has to come right up to it
      const fetch = typeof cantCrawlYet === "function" && cantCrawlYet(other) && !other._riding && typeof rideMumFor === "function" && rideMumFor(other) === this;
      if (dist <= (fetch ? RIDE_REACH * 0.7 : FOAL_MUM_NEAR)) continue;
      if (fetch && this.canSee()) return other;
      if ((other.foalCallingMum() && this.canHear()) || (other.foalInDistress() && this.canSee())) return other;
    }
    return null;
  },

  // A foal in trouble: scared, crying, hungry, hurt, attacked, or picked up
  // by a hand it's afraid of
  foalInDistress() {
    if (!this.isAlive) return false;
    if (this.isScared || this.bleedingTimer > 0 || this.health < 60 || this.lastAttackTimer > 0) return true;
    if (this.hunger < FOAL_HUNGRY_CALL) return true;
    if (this.expressionOverrideTimer > 0 && (this.expressionOverride === "CRYING_SHOCKED" || this.expressionOverride === "MISERABLE")) return true;
    if (this.isDragging && ((this.playerFear || 0) >= 0.3 || (this.playerTrust ?? 0.5) < 0.3)) return true;
    return false;
  },

  // Has it called for its mum just now? (updateFoalCalls)
  foalCallingMum() {
    const now = typeof timePlayed === "number" ? timePlayed : 0;
    return this._mumCallAt !== undefined && now - this._mumCallAt >= 0 && now - this._mumCallAt < FOAL_CALL_HEARD;
  },
});
