// ---------------------------------------------------------------------------
// The pieces of a fluffy's update (Horse.update in Horse.js), one method per
// job: sleep and mood, blinking, eating, illness, pregnancy, growing up and
// so on. Horse.update calls them in the same order as before.
// Methods that return true mean "stop the rest of this update" (e.g. the
// fluffy just died).
// (Part of the Horse class, split out of Horse.js: addHorseMethods adds
// these to every fluffy. Loaded right after Horse.js.)
// ---------------------------------------------------------------------------

const MOVE_GIVE_UP = 20; // seconds with no progress towards where it's walking

addHorseMethods({
  // Smoke rising from a smoking fluffy
  _updateSmoke(dt) {
    if (this.smokePoints && this.smokePoints.length > 0) {
      this.smokeParticleTimer = (this.smokeParticleTimer || 0) - dt;
      const shouldSpawnPoof = this.smokeParticleTimer <= 0;
      if (shouldSpawnPoof) {
        this.smokeParticleTimer = SMOKE_PARTICLE_FREQUENCY;
      }

      for (let i = this.smokePoints.length - 1; i >= 0; i--) {
        const sp = this.smokePoints[i];
        sp.timer -= dt;

        if (
          shouldSpawnPoof &&
          typeof poofs !== "undefined" &&
          typeof SmokePoof !== "undefined" &&
          this.scene === currentScene
        ) {
          const offset = sp.offset || { x: sp.x || 0, y: sp.y || 0 };
          const worldPos = this.getWorldPositionFromTorsoOffset(offset.x, offset.y);
          const jitter = (Math.random() - 0.5) * 4 * (this.scale || 1.0);
          poofs.push(new SmokePoof(worldPos.x + jitter, worldPos.y + jitter, this.scene, CATTLE_PROD_SMOKE_COLOR));
        }

        if (sp.timer <= 0) {
          this.smokePoints.splice(i, 1);
        }
      }
    } else {
      this.smokeParticleTimer = 0;
    }
  },

  // Mums chasing after a grabbed baby, then moving and arriving
  _updateMovementAndMums(dt) {
    if (this.isAlive) {
      // Mother chasing grabbed baby logic
      // (only while something's being carried: it searched everyone, every step)
      if ((typeof isGlobalDragging === "undefined" || isGlobalDragging) && !this.isDragging && !this.placedOn && !this.tooYoungToWalk() && this.canSee()) {
        const rels = relationships[this.id];

        if (rels) {
          const grabbedChild = fluffies.find(
            (f) =>
              f.isDragging &&
              f.tooYoungToWalk() &&
              f.isAlive &&
              !f.isSmarty() &&
              f.gender === "female" &&
              f.scene === this.scene &&
              (rels[f.id] === "baby_child" || rels[f.id] === "child") &&
              // (only if it's upset at being picked up, or calling for her)
              (f.foalInDistress() || f.foalCallingMum()),
          );
          if (grabbedChild) {
            const childPos = grabbedChild.getWorldPosition(); // (where it was lifted from)
            this.setTargetPosition(childPos.x, childPos.y);

            this.setShock(0.5); // Sustain while held
            if (!this.isMovingOrRunning()) {
              this.initBehavior(this.isCrawling ? "MOVING" : "RUNNING");
            } else if (this.currentStateKey === "MOVING" && !this.isCrawling) {
              this.currentStateKey = "RUNNING";
            }
          }
        }
      }

      if (this.isBeingTased()) {
        this.vx = 0;
        this.vy = 0;
        if (this.matingState && this.matingState.isMating) {
          this._interruptMating();
        }
        this.changeHappiness(HAPPINESS_PENALTY_CATTLE_PROD * dt);

        this.continuousTasedTimer = (this.continuousTasedTimer || 0) + dt;
        this.continuousTasedSmokeTimer = (this.continuousTasedSmokeTimer || 0) + dt;
        if (this.continuousTasedSmokeTimer >= CATTLE_PROD_SMOKE_THRESHOLD) {
          this.continuousTasedSmokeTimer -= CATTLE_PROD_SMOKE_THRESHOLD;
          const hitPoint =
            this.tasedPoint || (typeof mouse !== "undefined" ? { x: mouse.x, y: mouse.y } : { x: this.x, y: this.y });
          const offset = this.getTorsoOffsetFromPoint(hitPoint.x, hitPoint.y);
          if (!this.smokePoints) this.smokePoints = [];
          this.smokePoints.push({
            offset: { x: offset.x, y: offset.y },
            x: offset.x,
            y: offset.y,
            timer: CATTLE_PROD_SMOKE_DURATION,
          });
        }

        const growth = this.growth !== undefined ? this.growth : 1.0;
        const damage =
          CATTLE_PROD_BASE_DAMAGE *
          dt *
          this.continuousTasedTimer *
          (CATTLE_PROD_GROWTH_FACTOR_BASE * (1.0 - growth) + 1);
        this.health = Math.max(0, this.health - damage);

        if (this.health <= 0) {
          this.tasedTimer = 0;
          this.continuousTasedTimer = 0;
          this.continuousTasedSmokeTimer = 0;
          this.tasedPoint = null;
          if (this.updateCrawling) this.updateCrawling();
          this.die("cattle_prod", "Electrocuted to death");
        }

        if (this.isAlive) {
          if (this.tasedOverrideTimer === undefined || this.tasedOverrideTimer <= 0) {
            this.tasedOverrideTimer = CATTLE_PROD_OVERRIDE_DURATION;
            this.expressionOverride = "CRYING_SHOCKED";
            this.expressionOverrideTimer = CATTLE_PROD_OVERRIDE_DURATION;
            if (this.happiness > WAN_DIE_THRESHOLD && this.canTalk()) {
              this.speak(getDialogue(["CATTLE_PROD", this.tooYoungToSpeak() ? "BABY" : "DEFAULT"], this), false, true);
            }
          } else {
            this.tasedOverrideTimer -= dt;
          }
        }
      } else {
        this.continuousTasedTimer = 0;
        this.continuousTasedSmokeTimer = 0;
        this.tasedOverrideTimer = 0;
        this.tasedPoint = null;
        if (this.isMovingOrRunning()) {
          if (!this.actionHandler.checkArrivals(dt)) {
            // Still moving, handled internally by checkArrivals
          }
          this._giveUpIfStuck(dt);
        } else {
          this.stateTimer -= dt;
          this.nextStateGivenIdle(dt);
        }
      }

      if (this.isAlive) {
        this.setAnimLerps(dt);
        this.consumePuddlesIfNeeded(dt);
      }
    }
  },

  // Walking somewhere it can't get to (a fence, a wall, a spot off the
  // floor): no closer for MOVE_GIVE_UP seconds, it stops and thinks again
  _giveUpIfStuck(dt) {
    if (!this.isMovingOrRunning()) return;
    const key = `${Math.round(this.targetX)},${Math.round(this.targetY)}`;
    const d = Math.hypot((this.targetX || 0) - this.x, (this.targetY || 0) - this.y);
    if (this._moveKey !== key || d < (this._moveBest ?? Infinity) - 5) {
      this._moveKey = key;
      this._moveBest = d;
      this._moveStuck = 0;
      return;
    }
    this._moveStuck = (this._moveStuck || 0) + dt;
    if (this._moveStuck > MOVE_GIVE_UP) {
      this._moveStuck = 0;
      this._moveKey = null;
      this._moveBest = undefined;
      this.ballTarget = false;
      this.blockTarget = false;
      this.initBehavior("IDLE");
    }
  },

  // Flailing and body animation
  _updateFlailing(dt) {
    if (this.isAlive) {
      if (this.shouldFlail()) {
        this.animPhase += 20.0 * dt;
        if (this.currentStateKey === "SITTING" && this.grabbedPart === "torso") {
          this.animPhase -= 15.0 * dt;
        }
        this.flailAngle = Math.sin(this.animPhase) * 0.8;
      } else {
        this.flailAngle = 0;
      }

      if (this.currentStateKey === "DROWNING" && this.expressionOverrideTimer <= 1) {
        if (this.happiness !== WAN_DIE_THRESHOLD) {
          this.expressionOverride = "CRYING_SHOCKED";
          this.expressionOverrideTimer = 2.0;
          this.facingRight = Math.random() > 0.5;

          let key = this.tooYoungToSpeak() ? "CHIRPY" : "DEFAULT";
          this.speak(getDialogue(["DROWNING", key], this));

          this.speech.nextTime = 1.0 + Math.random();
        } else {
          // (a wan die fluffy just lets it happen)
          this.expressionOverride = "MISERABLE";
          this.expressionOverrideTimer = 2.0;
        }
      }
    }
  },

  // Pregnancy, labour and birth
  _updatePregnancy(dt) {
    if (this.isPregnant) {
      // Update stretch
      if (this.pregnancyTimer > 0) {
        this.pregnancyTorsoStretch = Math.max(0, 1.0 - this.pregnancyTimer / pregnancyDuration);
      }

      if (!this.isPregnancyDue()) {
        this.pregnancyTimer -= dt * debugPregnancyMultiplier;
        // (a miscarriage brings labour on early: HorseMating.beginMiscarriage)
        if (this.miscarriageTimer !== null && this.miscarriageTimer !== undefined) {
          this.miscarriageTimer -= dt * debugPregnancyMultiplier;
        }
        if (this.isPregnancyDue()) {
          if (this.hasBlockOnBack()) {
            this.blockOnBack.heldBy = null;
            this.blockOnBack.x = this.x;
            this.blockOnBack.y = this.y;
            this.blockOnBack.groundY = this.y;
            this.blockOnBack = null;
          }
          // How her pregnancy went decides the litter (Pregnancy.js)
          if (typeof onLabourStarts === "function") onLabourStarts(this);
          if (this.babiesToBirth === 0) {
            this.babiesToBirth = Math.floor(Math.random() * 7) + 1;
          }
          if (this.foalViability.length === 0) {
            for (let i = 0; i < this.babiesToBirth; i++) {
              this.foalViability.push(true);
            }
          }

          const birthBed =
            this.claimedBed && this.claimedBed.scene === this.scene && this.claimedBed.currentCage === this.currentCage
              ? this.claimedBed
              : null;
          const distToBed = birthBed ? Math.sqrt((birthBed.x - this.x) ** 2 + (birthBed.y - this.y) ** 2) : Infinity;

          if (birthBed && distToBed > 30) {
            this.seekingBirthBed = true;
            this.birthBedSeekTimeout = 30.0;
            if (!this.isMovingOrRunning()) this.initBehavior("MOVING");
          } else {
            this._startActiveLabor();
          }
        }
      } else if (this.seekingBirthBed) {
        this.birthBedSeekTimeout -= dt;
        const birthBed =
          this.claimedBed && this.claimedBed.scene === this.scene && this.claimedBed.currentCage === this.currentCage
            ? this.claimedBed
            : null;
        const atBed = birthBed && Math.sqrt((birthBed.x - this.x) ** 2 + (birthBed.y - this.y) ** 2) <= 30;
        if (atBed || this.birthBedSeekTimeout <= 0 || !birthBed) {
          this.seekingBirthBed = false;
          this._startActiveLabor();
        } else if (!this.isMovingOrRunning()) {
          this.initBehavior("MOVING");
        }
      } else if (this.babiesToBirth > 0) {
        this.birthIntervalTimer -= dt;
        if (this.birthIntervalTimer <= 0) {
          if (this.hasBlockOnBack()) {
            this.blockOnBack.heldBy = null;
            this.blockOnBack.x = this.x;
            this.blockOnBack.y = this.y;
            this.blockOnBack.groundY = this.y;
            this.blockOnBack = null;
          }
          this.speak(getDialogue(["BIRTH", "PAIN"], this), true);
          this.initBehavior("BENDING_2");
          this.stateTimer = 0.8;
          const viabilityIdx = this.foalViability.length - this.babiesToBirth;
          // (born early, it may not live: Premature.js)
          const isViable = this.spawnBaby(this.foalViability[viabilityIdx] !== false) !== false;

          // Each birth costs her health: less with good care or a midwife
          // (Pregnancy.js)
          if (typeof applyBirthHealthCost === "function") applyBirthHealthCost(this, isViable);
          else this.health = Math.max(0, this.health - (isViable ? 20 : 40));
          if (this.health <= 0) {
            this.die(null, "Died in childbirth");
          }

          this.babiesToBirth--;
          if (this.babiesToBirth > 0) {
            this.birthIntervalTimer = 3.0; // 3 second delay
          } else {
            if (typeof onLitterFinished === "function") onLitterFinished(this);
            this.isPregnant = false;
            this.pregnancyTimer = 0;
            this.miscarriageTimer = null;
            this.pregnancyTorsoStretch = 0;
            this.fatherGenes = null;
            this.foalViability = [];
            this.updateGrowthStats();
          }
        }
      }
    }
  },

  // Filling up and needing to poop and pee
  _updateToiletNeeds(dt) {
    // Poop and Pee Storage Accumulation
    if (this.hunger > 0.5 || this.poopStorage > 0.3) {
      this.poopStorage += Math.random() * dt * 0.005 * debugPoopMultiplier;
      this.poopStorage = Math.min(1.0, this.poopStorage);
    }
    this.peeStorage += Math.random() * dt * 0.02 * debugPeeMultiplier;
    this.peeStorage = Math.min(1.0, this.peeStorage);

    // Peeing and Pooping
    if ((this.avoidStateChangerActions() || this.placedOn instanceof LitterpalBox) && !this.hasBlockOnBack()) {
      // Pooping logic
      if (Math.max(this.poopStorage, this.peeStorage) > 0.6 + this.pottyTraining * 0.2) {
        this.attemptPoop();
      }
    }
  },

  // Ear flopping
  _updateEarFlop(dt) {
    // Sad, grieving, scared or Broken: the ears hang back (HouseLife.js)
    const droop = typeof earDroopAngle === "function" ? earDroopAngle(this) : null;
    if (droop !== null) {
      this.limbs.targetEarFlopAngle = droop;
      this._earsDrooping = true;
    } else if (this._earsDrooping) {
      this._earsDrooping = false;
      this.limbs.targetEarFlopAngle = 0;
    }
    // Ear Flopping
    if (droop === null && Math.random() < dt / 15.0) {
      // Random angle avoiding 1/3 pi to 2/3 pi
      this.limbs.targetEarFlopAngle = (Math.random() < 0.5 ? Math.random() / 4 : 3 / 4 + Math.random() / 4) * Math.PI;
    }
    this.limbs.earFlopValue = lerpAngle(this.limbs.earFlopValue || 0, this.limbs.targetEarFlopAngle, 5 * dt);
  },

  // Cannibalism
  _updateCannibalism() {
    // Cannibalism interaction
    if (this.cannibalTarget && !this.isDragging) {
      // Prioritize nearby gibs over horses
      if (this.cannibalTarget instanceof Horse && typeof gibs !== "undefined") {
        let nearestGib = null;
        let minGibDist = Infinity;
        for (const gib of gibs) {
          if (gib.scene === this.scene && gib.freeGib) {
            const d = Math.sqrt((this.x - gib.x) ** 2 + (this.y - gib.y) ** 2);
            if (d < 300 && d < minGibDist) {
              minGibDist = d;
              nearestGib = gib;
            }
          }
        }
        if (nearestGib) {
          this.cannibalTarget = nearestGib;
          this.setTargetPosition(nearestGib.x, nearestGib.y);
        }
      }
      const target = this.cannibalTarget;
      const isStillValid =
        (target instanceof Gib && !target.shouldDespawn && target.scene === this.scene) ||
        (target instanceof Horse &&
          target.scene === this.scene &&
          target.currentCage === this.currentCage &&
          !target.isDestroyed);

      if (!isStillValid) {
        this.cannibalTarget = null;
      } else {
        const dist = Math.sqrt((this.x - target.x) ** 2 + (this.y - target.y) ** 2);
        const isGagged = this.accessories && this.accessories.mouth && this.accessories.mouth.id === "mouthgag";
        if (dist < 50) {
          if (target instanceof Gib) {
            if (!isGagged) this.eatGib(target);
            this.cannibalTarget = null;
          } else if (target instanceof Horse) {
            if (target.isAlive) {
              if (this.attackCooldown <= 0) {
                this.performCannibalAttack(target);
              }
            } else {
              if (!isGagged) this.eatCorpse(target);
              this.cannibalTarget = null;
            }
          }
        } else {
          // Move to target is already handled by scout/targetX in positioning
        }
      }
    }
  },

  // Growing up
  _updateGrowingUp(dt) {
    if (this.growth < 1.0) {
      const wasTooYoungToSpeak = this.tooYoungToSpeak();
      // Strong, well-fed foals grow faster (Pregnancy.js)
      const rate = typeof foalGrowthRate === "function" ? foalGrowthRate(this) : 1;
      this.growth = Math.min(1.0, this.growth + (dt / GROW_UP_TIME) * debugGrowthMultiplier * rate);
      if (this.growth >= 1.0) {
        for (const ownerId in relationships) {
          if (relationships[ownerId][this.id] === "baby_child") {
            relationships[ownerId][this.id] = "child";
          }
        }
      }
      if (wasTooYoungToSpeak && !this.tooYoungToSpeak()) {
        this.initBehavior("IDLE");
        this.firstWordsBabble();
      }
      this.updateGrowthStats();
    }
  },

  // Eating and drinking
  _updateEating() {
    if (this.hunger < 0.6) {
      const isGagged = this.accessories && this.accessories.mouth && this.accessories.mouth.id === "mouthgag";
      // Bowl Eating (Not for chirpies)
      if (
        !isGagged &&
        !this.tooYoungToWalk() &&
        this.happiness > WAN_DIE_THRESHOLD && // Depressed fluffies don't eat
        !this.isUnderAphrodisiac() && // Under aphrodisiac males don't eat
        !(this.placedOn instanceof OperatingTable) &&
        typeof objects !== "undefined"
      ) {
        const bowls = objects.filter((o) => o instanceof Bowl || o instanceof Grass);
        for (const bowl of bowls) {
          if (
            (bowl instanceof Grass || (bowl.type !== "feeder" && bowl.type !== "mega_feeder")) &&
            bowl.hasFood() &&
            bowl.scene === this.scene
          ) {
            // Accessibility Check
            if (this.currentCage !== bowl.currentCage) continue;
            // Can't eat through a fence
            if (typeof fenceCanReachThing === "function" && !fenceCanReachThing(this, bowl)) continue;

            const dist = Math.sqrt((this.x - bowl.x) ** 2 + (this.y - bowl.y) ** 2);
            // In a cage both sit on the floor, and a big fluffy can't squeeze
            // up to a bowl by the bars: side by side is close enough (caged
            // fluffies starved beside full bowls in the long test games)
            const reach = this.currentCage && this.currentCage === bowl.currentCage ? Math.abs(this.x - bowl.x) < CAGE_EAT_REACH : dist < 50;
            if (reach) {
              // Won't touch food it really dislikes unless starving (Diet.js)
              const foodType = typeof foodTypeOf === "function" ? foodTypeOf(bowl) : bowl.foodType;
              if (typeof refusesFood === "function" && refusesFood(this, foodType)) {
                grumbleAboutFood(this, foodType);
                continue;
              }
              if (bowl.eat()) {
                // Who filled it: you, or the Feed-Bot (Memory.js trust)
                this._mealFromYou = bowl.byYou !== false;
                // Cheap food doesn't fill them up as much (Diet.js)
                this.hunger = typeof foodFill === "function" ? foodFill(foodType) : 1.0;
                this.initBehavior("EATING");
                let key;
                if (bowl.foodType === "sketties") {
                  key = ["EAT", "SKETTIES"];
                } else if (bowl.foodType === "scrap_kibble") {
                  key = ["EAT", "SCRAPZ"];
                } else if (bowl.foodType === "rat_poison") {
                  key = ["EAT", "RAT_POISON"];
                } else if (typeof mealDialogueKey === "function") {
                  key = mealDialogueKey(this, foodType);
                } else {
                  key = ["EAT", "NUMMIES"];
                }

                if (this.isSmarty()) {
                  if (bowl.foodType === "sketties") {
                    key = ["EAT", "SKETTIES", "SMARTY"];
                  } else if (bowl.foodType === "scrap_kibble") {
                    key = ["EAT", "SCRAPZ"];
                  } else if (bowl.foodType === "rat_poison") {
                    key = ["EAT", "RAT_POISON"];
                  } else {
                    key = ["EAT", "NUMMIES", "SMARTY"];
                  }
                  this.expressionOverride = "ANGRY_PUFFED";
                  this.expressionOverrideTimer = 3.0;
                }
                if (bowl.foodType === "sketties") {
                  this.changeHappiness(HAPPINESS_BONUS_SKETTIES);
                } else if (bowl.foodType === "scrap_kibble") {
                  this.changeHappiness(-0.03);
                  if (!this.isSmarty()) {
                    this.expressionOverride = "MISERABLE";
                    this.expressionOverrideTimer = 3.0;
                  }
                } else if (bowl.foodType === "rat_poison") {
                  this.isPoisoned = true;
                  if (this.renderer) this.renderer.tinted = null;
                  this.vomitTimer = 4.0 + Math.random() * 6.0;
                  this.changeHappiness(-0.1);
                  if (!this.isSmarty()) {
                    this.expressionOverride = "MISERABLE";
                    this.expressionOverrideTimer = 3.0;
                  }
                } else {
                  // How much it likes it (Diet.js)
                  this.changeHappiness(typeof mealHappiness === "function" ? mealHappiness(this, foodType) : HAPPINESS_BONUS_NUMMIES);
                }
                if (typeof onFluffyAte === "function") onFluffyAte(this, foodType);
                this.speak(getDialogue(key, this));
                break;
              }
            }
          }
        }
      }
    }
  },

  // Castration band
  _updateCastrationBand(dt) {
    // Castration Band Logic: pain dialogue every 5-10s, bloodless amputation & poof after 3 mins
    if (
      this.accessories &&
      this.accessories["ABOVE_LUMPS"] &&
      this.accessories["ABOVE_LUMPS"].id === "castration_band" &&
      this.gender === "male" &&
      this.limbs.lumps &&
      !this.spayed
    ) {
      this.castrationBandTimer -= dt;
      this.castrationBandPainTimer -= dt;

      if (this.castrationBandPainTimer <= 0) {
        this.castrationBandPainTimer = 5.0 + Math.random() * 5.0;
        if (this.happiness > WAN_DIE_THRESHOLD) {
          this.expressionOverride = "CRYING_SHOCKED";
          this.expressionOverrideTimer = 3.0;
          this.speak(getDialogue(["CASTRATION_BAND_PAIN", this.tooYoungToSpeak() ? "BABY" : "DEFAULT"]));
        }
      }

      if (this.castrationBandTimer <= 0) {
        // 3 minutes completed! Bloodless amputation & band poof
        this.limbs.lumps = false;
        const accData = this.accessories["ABOVE_LUMPS"];
        this.spawnGib("special_lumps");

        delete this.accessories["ABOVE_LUMPS"];
        this.castrationBandTimer = CASTRATION_BAND_TIMER;
        this.castrationBandPainTimer = 5.0 + Math.random() * 5.0;

        if (typeof AccessoryItem !== "undefined" && typeof objects !== "undefined") {
          const droppedAcc = new AccessoryItem(this.scene, accData.id);
          droppedAcc.x = this.x;
          droppedAcc.y = this.y - 20;
          droppedAcc.color = accData.color;
          objects.push(droppedAcc);

          if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
            poofs.push(new Poof(droppedAcc.x, droppedAcc.y, this.scene));
          }
        }

        if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
          poofs.push(new Poof(this.x, this.y, this.scene));
        }

        if (this.happiness > WAN_DIE_THRESHOLD) {
          this.expressionOverride = "CRYING_SHOCKED";
          this.expressionOverrideTimer = 5.0;
          this.changeHappiness(HAPPINESS_PENALTY_AMPUTATION);
          this.speak(getDialogue(["CASTRATION_BAND_FINISH", this.tooYoungToSpeak() ? "BABY" : "DEFAULT"]));
        }
      }
    } else if (
      this.accessories &&
      this.accessories["ABOVE_LUMPS"] &&
      (this.gender !== "male" || !this.limbs.lumps || this.spayed)
    ) {
      const accData = this.accessories["ABOVE_LUMPS"];
      delete this.accessories["ABOVE_LUMPS"];
      this.castrationBandTimer = CASTRATION_BAND_TIMER;
      this.castrationBandPainTimer = 5.0 + Math.random() * 5.0;

      if (typeof AccessoryItem !== "undefined" && typeof objects !== "undefined") {
        const droppedAcc = new AccessoryItem(this.scene, accData.id);
        droppedAcc.x = this.x;
        droppedAcc.y = this.y - 20;
        droppedAcc.color = accData.color;
        objects.push(droppedAcc);

        if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
          poofs.push(new Poof(droppedAcc.x, droppedAcc.y, this.scene));
        }
      }
    } else {
      this.castrationBandTimer = CASTRATION_BAND_TIMER;
      this.castrationBandPainTimer = 5.0 + Math.random() * 5.0;
    }
  },

  // Poisoning, toxoplasmosis, diarrhoea and incontinence
  _updateAilments(dt) {
    // Poisoning Logic: 1 damage per second forever & periodic vomiting
    if (this.isPoisoned) {
      this.health = Math.max(0, this.health - 1.0 * dt);
      if (this.health <= 0) {
        this.anatomy.die(null, "Rat poison");
      } else {
        this.vomitTimer -= dt;
        if (this.vomitTimer <= 0) {
          this.vomitTimer = 16.0 + Math.random() * 14.0;
          this.triggerVomit();
          this.health = Math.max(0, this.health - 20.0);
          if (this.health <= 0) {
            this.anatomy.die(null, "Rat poison");
          }
        }
      }
    }
    // Toxoplasmosis Logic: 1 damage per 5 seconds forever, no regeneration, and diarrhea
    if (this.isToxoplasmosis) {
      if (typeof worldSettings !== "undefined" && !worldSettings.toxoplasmosis) {
        this.isToxoplasmosis = false;
      } else if (this.isToxoVaccinated) {
        this.isToxoplasmosis = false; // jabbed: it can't take hold (Vet.js)
      } else {
        this.health = Math.max(0, this.health - 0.2 * dt);

        if (this.poopStorage > 0.2 && Math.random() < (1 / 30) * dt) {
          this.isDiarrhea = true;
        }

        if (this.health <= 0) {
          this.anatomy.die(null, "Toxoplasmosis");
        } else {
          this.vomitTimer -= dt;
          if (this.vomitTimer <= 0) {
            this.vomitTimer = 16.0 + Math.random() * 14.0;
            this.triggerVomit();
            this.health = Math.max(0, this.health - 5.0);
            if (this.health <= 0) {
              this.anatomy.die(null, "Toxoplasmosis");
            }
          }
        }
      }
    }

    // Diarrhea logic. A fluffy will void its bowels where it stands regardless of what's going on.
    // The time can be arbitrarily defined, check out anxiety incontinence.
    if (this.isDiarrhea) {
      // Delays diarrhea until fluffy has at least enough poopstorage
      if (!this.diarrheaTimer || this.diarrheaTimer <= 0) {
        if (this.poopStorage >= 0.2) this.diarrheaTimer = this.poopStorage * 10;
      }
      // Only run and check for cleanup if the timer has successfully initialized
      if (this.diarrheaTimer > 0) {
        // As long as poopStorage is above zero, it voids its bowels
        if (this.poopStorage > 0) {
          this.diarrheaTimer -= 1 * dt;
          this.poopStorage = Math.max(0, this.poopStorage - 0.3 * dt);
          this.excretePoop(dt);
        }
        // When either storage or timer hits zero, it's over
        if (this.poopStorage <= 0 || this.diarrheaTimer <= 0) {
          this.isDiarrhea = false;
          this.diarrheaTimer = 0;
        }
      }
    }

    // Incontinence logic. A fluffy will empty its bladder where it stands regardless of what's going on.
    if (this.isIncontinent) {
      if (!this.incontinenceTimer || this.incontinenceTimer <= 0) {
        if (this.peeStorage >= 0.2) this.incontinenceTimer = this.peeStorage * 10;
      }
      if (this.incontinenceTimer > 0) {
        if (this.peeStorage > 0) {
          this.incontinenceTimer -= 1 * dt;
          this.peeStorage = Math.max(0, this.peeStorage - 0.3 * dt);
          this.excretePee(dt);
        }
        if (this.peeStorage <= 0 || this.incontinenceTimer <= 0) {
          this.isIncontinent = false;
          this.incontinenceTimer = 0;
        }
      }
    }

    // Anxiety incontinence: soiling itself in fright (checked once per scare)
    if (this.isScared) {
      if (!this.scareCheck && this.poopStorage > 0.3 && !this.isDiarrhea) {
        this.scareCheck = true;
        if (Math.random() < 0.25) {
          this.diarrheaTimer = 0.5;
          this.isDiarrhea = true;
        }
      }
    } else {
      this.scareCheck = false;
    }
    return false;
  },

  // Hunger, drugs, bleeding, health and healing
  _updateHungerAndHealth(dt) {
    // Greedy fluffies get hungry faster, picky eaters slower (Traits.js)
    const traitHunger = typeof traitHungerMultiplier === "function" ? traitHungerMultiplier(this) : 1;
    this.hunger -=
      (dt / 450.0 + (dt / 225.0) * (1.0 - this.growth)) *
      debugHungerMultiplier *
      traitHunger *
      (typeof weatherHungerMultiplier === "function" ? weatherHungerMultiplier(this) : 1); // snow (WorldTime.js)

    // Drug Metabolism & Bloodstream Logic
    this.updateMetabolism(dt);
    if (!this.isAlive) return true;

    if (this.hunger <= 0) {
      this.die(null, "Starved to death");
    } else if (this.hunger <= 0.05 && this.currentStateKey !== "LYING") {
      this.initBehavior("LYING");
    }

    // Bleeding Logic
    if (this.bleedingTimer > 0) {
      this.bleedingTimer -= dt;
      this.health -= 8 * dt;
      this.excreteBlood(dt);
      this.sleepTargetSet = false;
    }

    if (this.lastAttackTimer > 0) {
      this.lastAttackTimer -= dt;
    }

    if (this.health <= 0) {
      if (this.lastAttackTimer > 0 && this.lastAttackerId !== null) {
        const attackerName =
          typeof fluffyDisplayNameById === "function"
            ? fluffyDisplayNameById(this.lastAttackerId)
            : fluffyNames[this.lastAttackerId] || "Fluffy";
        // It's a killer now (Kinship.js: something's not right with it)
        const killer = typeof fluffies !== "undefined" ? fluffies.find((x) => x.id === this.lastAttackerId) : null;
        if (killer) killer.hasKilled = (killer.hasKilled || 0) + 1;
        this.die(null, `Killed by ${attackerName}`);
      } else {
        this.die(null, "Bled to death");
      }
    }

    // Health Regeneration (Disabled if poisoned, suffering toxoplasmosis,
    // or ill with Fluffy flu - Illness.js)
    if (
      this.health < 100 &&
      this.bleedingTimer <= 0 &&
      !this.isPoisoned &&
      !(typeof fluShowing === "function" && fluShowing(this)) &&
      (!this.isToxoplasmosis || (typeof worldSettings !== "undefined" && !worldSettings.toxoplasmosis))
    ) {
      this.health = Math.min(100, this.health + 5 * this.growth * dt);
    }
    return false;
  },

  // Tapping at the door to come in (outdoors)
  _updateDoorTapping(dt) {
    // Door Tapping Logic (Outdoors)
    if (getSceneConfig(this.scene).id === "OUTDOORS" && getSceneConfig(currentScene).insidePlayerQuarters) {
      if (this.isTapping) {
        this.tapTimer -= dt;
        if (this.tapTimer < 1.0) {
          this.tapOpacity = Math.max(0, this.tapTimer);
        } else {
          this.tapOpacity = 1.0;
        }
        if (this.tapTimer <= 0) {
          this.isTapping = false;
          this.tapText = null;
          this.nextTapTime = 5 + Math.random() * 10;
        }
      } else {
        this.nextTapTime = (this.nextTapTime || 0) - dt;
        if (this.nextTapTime <= 0) {
          const distToDoor = Math.sqrt((this.x - width / 2) ** 2 + (this.y - (height * 0.15 + 50)) ** 2);

          if (distToDoor < 300 && !this.isFrantic && !this.tooYoungToSpeak()) {
            let text = null;
            const recent = recentOutdoorDialogue.filter((d) => gameTimeMs() - d.time < 10000);

            let key = null;

            if (this.adopted) {
              if (this.hunger > 0.6) {
                key = ["DOOR_KNOCK", "ADOPTED"];
              }
            } else {
              // Feral knocking
              key = ["DOOR_KNOCK", "FERAL"];
            }

            if (key) {
              text = getDialogue(key, this);
            }

            if (text) {
              if (typeof addDoorMessage !== "undefined") {
                addDoorMessage(text);
              }
              this.nextTapTime = 5 + Math.random() * 10;
            } else {
              this.nextTapTime = 1.0;
            }
          } else {
            // Retry later if conditions not met
            this.nextTapTime = 1.0;
          }
        }
      }
    }
  },

  // In the adoption room
  _updateAdoptionRoom() {
    if (getSceneConfig(this.scene).isAdoptionRoom) {
      if (!this.adopted && !this.tooYoungToSpeak() && (this.canSee() || this.canHear())) {
        const key = this.isSmarty() ? ["ADOPTED", "SMARTY"] : ["ADOPTED"];
        this.speak(getDialogue(key, this));
        this.changeHappiness(1.0 - this.happiness);
      }
      if (!this.adopted && this.formerPet && typeof onFormerPetHome === "function") onFormerPetHome(this); // (Runaways.js)
      this.adopted = true;
    }
  },

  // Smarty and aphrodisiac chasing
  _updateSmartyChase() {
    // Smarty & Aphrodisiac Chase Logic
    if (this.isAlive && (this.isSmarty() || this.isUnderAphrodisiac()) && this.chaseTarget && this.canSee()) {
      const target = this.chaseTarget;
      // A Smarty's fight or shove (SmartyMood.js) rather than enfies
      const brawl = !this.isUnderAphrodisiac() && (this.chaseReason === "ATTACK" || this.chaseReason === "BULLY");
      // Validation
      if (
        !target.isAlive ||
        target.scene !== this.scene ||
        target.isDragging ||
        target.currentCage !== this.currentCage ||
        (!brawl && !this.isUnderAphrodisiac() && this.specialHuggiesCooldown > 0) ||
        (!this.isUnderAphrodisiac() && this.isFrantic) ||
        this.isCrawling ||
        (!brawl && !this.limbs.lumps) ||
        (!brawl && !placedOnValidForSpecialHuggies(target.placedOn)) ||
        (this.chaseReason === "ATTACK" && this.isSmarty() && smartyStopsFighting(this, target)) ||
        this.happiness <= WAN_DIE_THRESHOLD
      ) {
        this.chaseTarget = null;
        this.chaseReason = null;
      } else {
        const targetPos = target.getWorldPosition();
        this.setTargetPosition(targetPos.x, targetPos.y);

        if (!this.isMovingOrRunning() && this.attackCooldown <= 0) {
          this.initBehavior("RUNNING");
        }

        if (this.speech.nextTime <= 0) {
          this.speech.nextTime = 2 + Math.random();

          // Smarty yells 100% of the time if target can't hear.
          // Otherwise, regular logic: 100% if target can see, 20% if target can't.
          const yellChance = !target.canHear() ? 1.0 : target.canSee() ? 1.0 : 0.2;
          if (this.chaseReason === "BULLY") {
            this.speak(getDialogue(["SMARTY_BULLY"], this, target));
          } else if (Math.random() < yellChance) {
            const isTargetStallion = target.gender === "male";
            const yellKey = isTargetStallion ? ["SMARTY_CHASE", "STALLION"] : ["SMARTY_CHASE", "MARE"];
            const yellText = this.isUnderAphrodisiac()
              ? this.getAphrodisiacDialogue()
              : getDialogue(yellKey, this, target);
            this.speak(yellText, this.isUnderAphrodisiac());

            // Target only reacts to yelling if they can hear.
            // If they can't see, they only react if they hear him.
            if (!target.canSee() && target.canHear() && !target.tooYoungToSpeak()) {
              target.actionHandler.executeSmartyChaseFear(this);
            }
          }
        }

        const dist = Math.sqrt((this.x - target.x) ** 2 + (this.y - target.y) ** 2);
        if (dist < 50 && this.attackCooldown <= 0) {
          const isMaleOnMaleUnconsensual =
            this.gender === "male" && target.gender === "male" && !isSexuallyAttractedTo(target, this);

          if (this.chaseReason === "BULLY" && !this.isUnderAphrodisiac()) {
            // A shove, then off it goes (SmartyMood.js)
            this.performAttack(target, "BULLY");
            this.speak(getDialogue(["SMARTY_BULLY"], this, target));
            smartyDidBully(this);
            this.chaseTarget = null;
            this.chaseReason = null;
          } else if (this.chaseReason === "MATING" || this.isUnderAphrodisiac()) {
            if (isMaleOnMaleUnconsensual && canFightBack(target)) {
              this.performAttack(target, "SMARTY_VIOLENCE");
              const attackText = this.isUnderAphrodisiac()
                ? this.getAphrodisiacDialogue()
                : getDialogue(["ATTACK", "SMARTY", this.tooYoungToSpeak() ? "BABY" : "ADULT"], this);
              this.speak(attackText, this.isUnderAphrodisiac());
            } else if (this.mateWith(target, false, true)) {
              if (this.isSmarty() && !this.isUnderAphrodisiac()) smartyDidEnfies(this);
              this.chaseTarget = null;
              this.chaseReason = null;
            }
          } else if (this.chaseReason === "ATTACK" || target.gender === "male") {
            if (this.isSmarty()) {
              this.performAttack(target, "SMARTY_VIOLENCE");
              smartyLandedHit(this, target);
              this.speak(getDialogue(["ATTACK", "SMARTY", this.tooYoungToSpeak() ? "BABY" : "ADULT"], this));
              // Unless it's in a foul mood, it leaves it at that once they're hurt
              if (this.chaseTarget && smartyStopsFighting(this, target)) {
                this.chaseTarget = null;
                this.chaseReason = null;
              }
            }
          } else if (this.mateWith(target, false, true)) {
            if (this.isSmarty()) smartyDidEnfies(this);
            this.chaseTarget = null;
            this.chaseReason = null;
          }
        }
      }
    }
  },

  // Stacking blocks
  _updateStacking(dt) {
    if (this.isStacking) {
      this.stackingTimer += dt;
      if (
        this.stackingTimer > 12.0 ||
        (this.stackTargetBlock && (this.stackTargetBlock.isDragging || this.stackTargetBlock.heldBy))
      ) {
        this.isStacking = false;
        this.blockCooldown = 10.0;
        if (this.blockOnBack) {
          this.blockOnBack.heldBy = null;
          this.blockOnBack.x = this.x;
          this.blockOnBack.y = this.y;
          this.blockOnBack.groundY = this.y;
          this.blockOnBack.clampY();
          this.blockOnBack = null;
        }
        this.initBehavior("IDLE");
      } else if (this.stackingTimer > 3.0) {
        if (this.blockOnBack && this.stackTargetBlock) {
          this.blockCooldown = 10.0;
          if (Math.random() < 0.4 * this.stackTargetBlock.stackHeight()) {
            this.failStackBlocks(this.stackTargetBlock);
            this.speak(getDialogue(["PLAY", "BLOCK", "FAIL"], this));
          } else {
            let top = this.stackTargetBlock;
            while (top.getStackedAbove()) {
              top = top.getStackedAbove();
            }
            this.blockOnBack.stackedOn = top;
            this.blockOnBack.stackXOffset = (Math.random() - 0.5) * 10;
            this.blockOnBack.heldBy = null;
            this.blockOnBack = null;
            this.speak(getDialogue(["PLAY", "BLOCK"], this));
            this.expressionOverride = "GOOD_UPSIES";
            this.expressionOverrideTimer = 2.0;
          }
        }
        this.isStacking = false;
        this.initBehavior("IDLE");
      }
    }
  },

  // Crying tears
  _updateTears(dt) {
    if (this.isAlive) {
      const shouldCry = this.isCrying();

      if (shouldCry) {
        this.tearStreakSize = Math.min(1.0, this.tearStreakSize + dt);
      } else {
        this.tearStreakSize = Math.max(0.0, this.tearStreakSize - dt);
      }

      if (this.tearStreakSize > 0) {
        this.tearFlowPhase = (this.tearFlowPhase + dt * 40) % 15;
        this.tearGapPhase = this.tearGapPhase + dt * 2;

        this.tearTimer += dt;
        if (this.tearTimer > 1.0) {
          this.spawnTear();
          this.tearTimer = Math.random() * 0.8;
        }
      }
    }
  },

  // Dreams while asleep
  _updateDreams(dt) {
    if (this.isAlive && this.currentStateKey === "SLEEPING" && !this.tooYoungToWalk()) {
      this.dreamTimer -= dt;
      if (this.dreamTimer <= 0) {
        const dreams = ["sketties", "ball", "block", "man", "sun"];
        if (Math.random() < 0.75) this.currentDream = null;
        else {
          // From its own story, most of the time (Dreams.js)
          const story = typeof chooseDream === "function" ? chooseDream(this) : undefined;
          this.currentDream = story !== undefined ? story : dreams[Math.floor(Math.random() * dreams.length)];
        }
        this.dreamTimer = 3.0 + Math.random() * 5.0;
      }

      this.dreamEffectTimer -= dt;
      if (this.dreamEffectTimer <= 0) {
        this.dreamStretch = {
          x: 0.95 + Math.random() * 0.1,
          y: 0.95 + Math.random() * 0.1,
        };
        this.dreamAngle = (Math.random() - 0.5) * 0.2;
        this.dreamEffectTimer = 0.4;
      }
    } else {
      this.currentDream = null;
      this.dreamTimer = 0;
      this.dreamEffectTimer = 0;
      this.dreamStretch = { x: 1.0, y: 1.0 };
      this.dreamAngle = 0;
    }

    // Dream bubble: shrink out before switching/ending a dream, grow in for a new one
    if (this.shownDream !== this.currentDream && this.dreamBubbleProgress <= 0) {
      this.shownDream = this.currentDream;
    }
    const bubbleTarget = this.shownDream && this.shownDream === this.currentDream ? 1 : 0;
    const bubbleStep = dt / DREAM_BUBBLE_ANIM_TIME;
    this.dreamBubbleProgress =
      bubbleTarget > this.dreamBubbleProgress
        ? Math.min(1, this.dreamBubbleProgress + bubbleStep)
        : Math.max(0, this.dreamBubbleProgress - bubbleStep);
    if (this.dreamBubbleProgress > 0) {
      this.dreamPulsePhase = (this.dreamPulsePhase + (dt * Math.PI * 2) / DREAM_BUBBLE_PULSE_PERIOD) % (Math.PI * 2);
    } else {
      this.dreamPulsePhase = 0;
    }
  },

  // Wing flapping
  _updateWings(dt) {
    // Wing Flapping
    if (this.isAlive && (this.type === "pegasus" || this.type === "alicorn")) {
      // (flapping while held, and while flying through the air: ThrowTool.js)
      const flying = Math.abs(this.throwFallVx || 0) > 10 || Math.abs(this.throwFallVy || 0) > 10;
      if (this.isDragging || flying) {
        this.wingFlapTimer = 0.0;
      }
      if (this.wingFlapPhase > 0) {
        this.wingFlapPhase += dt * 20; // Fast flapping
        if (this.wingFlapPhase >= Math.PI * 2) {
          this.wingFlapPhase = 0;
          this.wingFlapTimer = 0.0 + Math.random() * 5.0;
        }
      } else {
        this.wingFlapTimer -= dt;
        if (this.wingFlapTimer <= 0) {
          this.wingFlapPhase = 0.01;
        }
      }
    }
  },

  // Pupil movement and twitching
  _updatePupils(dt) {
    // Pupil Movement & Twitching
    if (this.isAlive) {
      // 1. Target cursor if close
      const distToMouse = Math.sqrt((mouse.x - this.x) ** 2 + (mouse.y - this.y) ** 2);
      let targetX = 0;
      let targetY = 0;
      if (distToMouse < 400 && this.currentStateKey !== "FOCUSING") {
        const dx = mouse.x - this.x;
        const dy = mouse.y - (this.y - 20 * this.scale); // Offset towards head approx
        const angle = Math.atan2(dy, dx * (this.facingRight ? 1 : -1));
        const strength = 1.0 - distToMouse / 400;
        const maxOffset = 3;
        targetX = Math.cos(angle) * maxOffset * strength;
        targetY = Math.sin(angle) * maxOffset * strength;
      }

      // 2. Smoothly move offset to target
      this.pupilOffset.x = lerp(this.pupilOffset.x, targetX, 10 * dt);
      this.pupilOffset.y = lerp(this.pupilOffset.y, targetY, 10 * dt);

      // 3. Pupil Twitching
      this.pupilTwitchTimer -= dt;
      if (this.pupilTwitchTimer <= 0) {
        if (this.pupilTwitchOffset.x === 0 && this.pupilTwitchOffset.y === 0) {
          // Start twitch
          this.pupilTwitchOffset.x = (Math.random() - 0.5) * 2;
          this.pupilTwitchOffset.y = (Math.random() - 0.5) * 2;
          this.pupilTwitchTimer = 0.05 + Math.random() * 0.1;
        } else {
          // Reset twitch
          this.pupilTwitchOffset.x = 0;
          this.pupilTwitchOffset.y = 0;
          this.pupilTwitchTimer = 0.5 + Math.random() * 2.5;
        }
      }
    }
  },

  // Blinking
  _updateBlinking(dt) {
    this.blinkTimer -= dt;
    if (this.currentStateKey === "SLEEPING" || !this.eyesHaveGrown() || this.isSensitive()) {
      this.isBlinking = true;
      this.blinkTimer = 0.5;
    } else if (this.blinkTimer <= 0 && this.isAlive) {
      if (this.isBlinking) {
        this.isBlinking = false;
        this.blinkTimer = Math.random() * 2 + 1; // Time until next blink
      } else {
        this.isBlinking = true;
        this.blinkTimer = 0.15; // Blink duration
      }
    }
  },

  // Sleep, happiness and other effects of the current state
  _updateStateEffects(dt) {
    // State-based expressions
    if (this.isAlive) {
      if (this.currentStateKey === "SLEEPING") {
        // Day and night change how fast they rest / get tired (WorldTime.js)
        const sleepRates = typeof sleepRateMultipliers === "function" ? sleepRateMultipliers() : [1, 1];
        this.sleepDeprivation = Math.max(0, this.sleepDeprivation - (dt / 30) * sleepRates[1]); // Takes 2 mins to fully rest

        const inBed =
          this.claimedBed &&
          this.claimedBed.scene === this.scene &&
          this.claimedBed.currentCage === this.currentCage &&
          (this.x - this.claimedBed.x) ** 2 + (this.y - this.claimedBed.y) ** 2 < 10000;

        if (inBed && this.happiness > WAN_DIE_THRESHOLD) {
          if (this.claimedBed.type === "cardboard_box") {
            this.changeHappiness((HAPPINESS_BONUS_SLEEP_BOX / 60) * dt);

            this.boxWhimperTimer = (this.boxWhimperTimer || 5 + Math.random() * 15) - dt;
            if (this.boxWhimperTimer <= 0) {
              this.boxWhimperTimer = 15.0 + Math.random() * 20.0;
              if (!this.tooYoungToSpeak() && typeof getDialogue !== "undefined") {
                this.speak(getDialogue(["BED", "BOX_SLEEP"], this));
              }
            }
          } else {
            this.changeHappiness((HAPPINESS_BONUS_SLEEP_BED / 60) * dt);
          }
        }
      } else {
        const tireRate = typeof sleepRateMultipliers === "function" ? sleepRateMultipliers()[0] : 1;
        this.sleepDeprivation = Math.min(1.0, this.sleepDeprivation + (dt / 120) * tireRate); // Takes 5 mins to get fully tired
      }

      // Hunger penalty: < 0.4 hunger -> -0.2 happiness per minute (not below
      // HUNGER_CAGE_FLOOR: hunger and cages wear a fluffy down, but leave room
      // for a bad moment without tipping it into "wan die" - at 0.05 the next
      // knock, like one forced mating, did, and a caged mill starved in a day)
      if (this.hunger < 0.4 && this.happiness > HUNGER_CAGE_FLOOR) {
        const decrease = (0.2 / 60) * dt;
        this.changeHappiness(-Math.min(decrease, this.happiness - HUNGER_CAGE_FLOOR));
      }

      // Cage penalty: -0.1 per minute (not below HUNGER_CAGE_FLOOR)
      // (not in an Enclosure: roomy enough to be happy in - Enclosure.js)
      const penned = this.currentCage && !(this.currentCage instanceof Cage && !this.currentCage.causesUnhappiness());
      if ((penned || this.placedOn instanceof LitterpalBox) && this.happiness > HUNGER_CAGE_FLOOR) {
        const decrease = (0.1 / 60) * dt;
        this.changeHappiness(-Math.min(decrease, this.happiness - HUNGER_CAGE_FLOOR));
      }
      this.changeHappiness(0); // Clamp and trigger rule logic if needed

      // The face: every step when you can see it, twice a second otherwise
      // (talking checks for a shocked face)
      this._exprTimer = (this._exprTimer || 0) - dt;
      if (this.scene === currentScene || this._exprTimer <= 0) {
        this._exprTimer = 0.5;
        this.updateExpression(dt);
      }

      // A new face makes a noise (FluffySounds.js)
      if (typeof onFluffyExpression === "function") onFluffyExpression(this);
      if (this.expressionOverrideTimer > 0) {
        this.expressionOverrideTimer -= dt;
      }

      if (this.gender === "male" && this.specialHuggiesCooldown > 0) {
        this.specialHuggiesCooldown -= dt;
      }

      if (this.isUnderAphrodisiac()) {
        if (this.aphrodisiacUtteranceTimer === undefined) {
          this.aphrodisiacUtteranceTimer = 1.0 + Math.random() * 2.0;
        }
        this.aphrodisiacUtteranceTimer -= dt;
        if (this.aphrodisiacUtteranceTimer <= 0) {
          this.aphrodisiacUtteranceTimer = 3.0 + Math.random() * 3.0;
          this.speak(this.getAphrodisiacDialogue(), true);
          this.expressionOverride = "CRYING_SHOCKED";
          this.expressionOverrideTimer = 3.0;
        }
      } else {
        this.aphrodisiacUtteranceTimer = 0;
      }

      if (this.speech.nextTime > 0) {
        this.speech.nextTime -= dt;
      }

      for (const id in this.friendshipCooldowns) {
        this.friendshipCooldowns[id] -= dt;
        if (this.friendshipCooldowns[id] <= 0) {
          delete this.friendshipCooldowns[id];
        }
      }

      if (this.attackCooldown > 0) {
        this.attackCooldown -= dt;
      }
      if (this.counterattack.timer > 0) {
        this.counterattack.timer -= dt;
        if (this.counterattack.timer <= 0 && this.counterattack.fluffy) {
          const attacker = this.counterattack.fluffy;
          if (
            attacker.isAlive &&
            attacker.scene === this.scene &&
            !this.isDragging &&
            !this.placedOn &&
            this.canFightBack()
          ) {
            const dist = Math.sqrt((this.x - attacker.x) ** 2 + (this.y - attacker.y) ** 2);
            // Retaliate if within reasonable reach (gentle fluffies often
            // don't: Traits.js)
            if (dist < 100 && (typeof traitWillRetaliate !== "function" || traitWillRetaliate(this))) {
              this.performAttack(attacker, "RETALIATION");
            }
          }
          this.counterattack.fluffy = null;
        }
      }
      if (this.milkCooldown > 0) {
        this.milkCooldown -= dt;
      }

      if (this.lactatingTimer > 0) {
        this.lactatingTimer -= dt;
        const restingAtBed =
          this.claimedBed &&
          this.claimedBed.scene === this.scene &&
          Math.sqrt((this.x - this.claimedBed.x) ** 2 + (this.y - this.claimedBed.y) ** 2) < 120 &&
          !this.isMovingOrRunning() &&
          this.currentStateKey !== "SLEEPING";
        this.milkRegenTimer += dt;
        if (
          this.milkRegenTimer >= (restingAtBed ? LACTATING_CHARGE_INCREASE_TIMER / 2 : LACTATING_CHARGE_INCREASE_TIMER)
        ) {
          this.milkRegenTimer = 0;
          if (this.milkCharges < 5) {
            this.milkCharges++;
          }
        }
      } else {
        this.milkRegenTimer = 0;
      }
    }
  },

  // Colourist mums attacking foals they think are poopie
  _updateColoristMum(dt = 1 / 60) {
    // Proactive colorist mom attack logic (looked at 4 times a second: it
    // searched every fluffy for every mare on every step)
    this._coloristT = (this._coloristT ?? 0) - dt;
    if (this._coloristT > 0) return;
    this._coloristT = 0.2 + Math.random() * 0.1; // (spread out)
    if (
      worldSettings.colorism &&
      this.isAlive &&
      this.gender === "female" &&
      this.happiness > WAN_DIE_THRESHOLD &&
      this.attackCooldown <= 0 &&
      this.canSee()
    ) {
      // Find babies
      for (const child of fluffies) {
        if (
          child.isAlive &&
          child.motherId === this.id &&
          child.scene === this.scene &&
          child.currentCage === this.currentCage
        ) {
          const dist = Math.sqrt((this.x - child.x) ** 2 + (this.y - child.y) ** 2);
          if (dist < 100) {
            if (mumRejectsFoalColour(this, child)) {
              this.performAttack(child, "COLOR");
              this.speak(getDialogue(["ATTACK", "COLOR"], this));
              relationships[this.id][child.id] = "estranged_child";
              break;
            }
          }
        }
      }
    }
  },

  // Footstep sounds
  _updateMovementSound(dt) {
    // Movement Sound Logic
    if (this.isAlive && !this.isDragging && !this.placedOn && this.scene === currentScene) {
      if ((this.currentStateKey === "MOVING" || this.currentStateKey === "RUNNING") && !this.isCrawling) {
        this.moveSoundTimer -= 9 * dt;
        if (this.moveSoundTimer <= 0) {
          const isRunning = this.currentStateKey === "RUNNING";
          this.moveSoundTimer = Math.PI;
          if (isRunning) {
            this.moveSoundTimer = 2 * Math.PI;
            setTimeout(() => {
              if (this.isAlive && !this.isDestroyed && this.scene === currentScene) {
                const pitch2 = 0.9 + Math.random() * 0.2;
                playSound("fluffy_move", 0.5, pitch2);
              }
            }, 100);
          }

          // Random pitch +- 10%
          const pitch = 0.9 + Math.random() * 0.2;
          playSound("fluffy_move", 0.5, pitch);
        }
      } else {
        this.moveSoundTimer = 0;
      }
    }
  },
});
