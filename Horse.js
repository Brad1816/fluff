const trauma_timer = 300;
const pregnancyDuration = 300;

function areSpecialFriends(id1, id2) {
  if (!relationships[id1] || !relationships[id2]) return false;
  return relationships[id1][id2] === "special_friend";
}

function triggerShock(hitFluffy) {
  const rels = relationships[hitFluffy.id];
  if (!rels) return;
  for (const [otherId, rel] of Object.entries(rels)) {
    if (rel === "mother") {
      const mom = fluffies.find((f) => f.id == otherId);
      if (
        mom &&
        mom.scene === hitFluffy.scene &&
        (mom.canSee() || mom.canHear())
      ) {
        // Check if mom considers hitFluffy a baby_child
        if (
          relationships[mom.id] &&
          relationships[mom.id][hitFluffy.id] === "baby_child"
        ) {
          mom.initBehavior("IDLE");
          mom.setShock(3.0);
          mom.speak(
            getDialogue(
              mom.adopted
                ? ["WITNESS_VIOLENCE", "BABY"]
                : ["WITNESS_VIOLENCE", "BABY", "FERAL"],
              mom,
              hitFluffy,
            ),
          );

          // Run to baby
          mom.initBehavior("MOVING");
          let targetX = hitFluffy.x + (Math.random() - 0.5) * 100;
          let targetY = hitFluffy.y + (Math.random() - 0.5) * 50;
          mom.setTargetPosition(targetX, targetY);
          if (!mom.isCrawling) {
            mom.currentStateKey = "RUNNING";
          }
        }
      }
    }
  }
}

function notifyViolence(
  victim,
  isDead,
  weaponType = "knife",
  isTraining = false,
  isAmputation = false,
) {
  // Victim and witnesses remember it was you (Memory.js)
  if (typeof notePlayerViolence === "function") {
    notePlayerViolence(victim, isDead, weaponType, isTraining, isAmputation);
  }
  if (victim.placedOn && isAmputation) {
    victim.fearOfOperatingTable = true;
  }
  for (const other of fluffies) {
    if (
      other === victim ||
      !other.isAlive ||
      other.happiness <= WAN_DIE_THRESHOLD ||
      other.scene !== victim.scene ||
      other.tooYoungToSpeak() ||
      other.currentStateKey === "SLEEPING" ||
      (!other.canSee() && !other.canHear())
    )
      continue;

    if (victim.placedOn && isAmputation) {
      other.fearOfOperatingTable = true;
    }

    // keys
    const key1 = "WITNESS_VIOLENCE";
    let key2, key3;
    const rel = relationships[other.id]?.[victim.id];
    // Witnessing potty training (Sorry Stick)
    if (isTraining && weaponType === "stick") {
      if (!other.isSmarty()) continue;

      other.pottyTraining = Math.min(
        1.0,
        other.pottyTraining + (0.05 + Math.random() * 0.05) * 0.25,
      );
      key2 = "STICK";
      key3 = "TRAINING";
    } else if (rel && rel != "friend") {
      if (isDead) continue; // Perceived death handled in Horse.updateRelationships
      other.expressionOverride = "CRYING_SHOCKED";
      other.expressionOverrideTimer = 3.0;
    } else if (
      typeof weaponType !== "undefined" &&
      (!isDead || weaponType === "grinder")
    ) {
      // I think the objective of the !isDead is to fall back to the default choice
      // (without setting weapon type or adoption)
      // which is representative of witnessing death for unrelated fluffies?
      // In any case this is the correct choice for grinders which always are instant kills
      other.setShock(1.5);
      other.isScared = true;
      other.scaredTimer = 10.0;
      key2 = weaponType.toUpperCase();
      key3 = other.adopted ? "ADOPTED" : "FERAL";
    }
    other.changeHappiness(HAPPINESS_PENALTY_WITNESS_VIOLENCE);
    other.speak(getDialogue([key1, key2, key3], other, victim));
  }
}

class Horse {
  get layout() {
    return this.renderer.layout;
  }

  get tinted() {
    return this.renderer.tinted;
  }

  get personalities() {
    return this._personalities;
  }

  set personalities(val) {
    if (!Array.isArray(val)) {
      this._personalities = [];
      return;
    }
    let unique = [...new Set(val)];
    if (this.gender === "female") {
      this._personalities = unique.filter((p) => p !== "smarty");
    } else {
      this._personalities = unique;
    }
  }

  getName() {
    const hName =
      (typeof fluffyNames !== "undefined" && fluffyNames[this.id]) || "Fluffy";
    return hName;
  }

  isSmarty() {
    if (
      typeof worldSettings !== "undefined" &&
      worldSettings.smarties === false
    ) {
      return false;
    }
    return this.personalities.includes("smarty");
  }

  isUnderAphrodisiac() {
    return (
      this.isAlive &&
      this.gender === "male" &&
      this.limbs &&
      this.limbs.lumps &&
      this.bloodstream &&
      (this.bloodstream["aphrodisiac"] || 0) > 0 &&
      this.happiness > WAN_DIE_THRESHOLD &&
      this.growth >= 1.0
    );
  }

  getAphrodisiacDialogue() {
    return getDialogue("APHRODISIAC", this);
  }

  constructor(
    initialGrowth = 1.0,
    motherId = null,
    scene,
    type = "earthy",
    initialGenes = null,
    bodyQuality = null,
    maneQuality = null,
    gender = null,
  ) {
    this.renderer = new HorseRenderer(this);
    this.genetics = new HorseGenetics(this);
    this.positioning = new HorsePositioning(this);
    this.actionHandler = new HorseActionHandler(this);
    this.physics = new HorsePhysics(this);
    this.anatomy = new HorseAnatomy(this);
    this.brain = new HorseBrain(this);
    this.brain.addDesire(new GrinderFearDesire());
    this.brain.addDesire(new AlicornFearDesire());
    this.brain.addDesire(new FearedFluffyDesire());
    this.brain.addDesire(new SprinklerFearDesire());
    this.brain.addDesire(new CarFearDesire());
    this.brain.addDesire(new CorpseReactionDesire());
    this.brain.addDesire(new BloodReactionDesire());
    this.brain.addDesire(new SmartyChaseFearDesire());
    this.brain.addDesire(new BystanderInterruptMatingDesire());
    this.brain.addDesire(new EatDesire());
    this.brain.addDesire(new UseLitterboxDesire());
    this.brain.addDesire(new CareForBabiesDesire());
    this.brain.addDesire(new FeedHungryFoalDesire());
    this.brain.addDesire(new SleepDesire());
    this.brain.addDesire(new SeekSmartySpecialHuggiesDesire());
    this.brain.addDesire(new SeekSpecialFriendDesire());
    this.brain.addDesire(new MateDesire());
    this.brain.addDesire(new ProposeSpecialFriendshipDesire());
    this.brain.addDesire(new PlayWithBlocksDesire());
    this.brain.addDesire(new PlayWithBallDesire());
    this.brain.addDesire(new RunToTVDesire());
    this.brain.addDesire(new WatchTVDesire());
    this.brain.addDesire(new ProposeFriendshipDesire());
    this.brain.addDesire(new BabbleToFriendsDesire());
    this.brain.addDesire(new RandomBabbleDesire());
    this.brain.addDesire(new SmartyCombatDesire());
    this.brain.addDesire(new ComplainAboutPuddleDesire());
    this.brain.addDesire(new WanderDesire());
    this.brain.addDesire(new SitDesire());
    this.brain.addDesire(new LieDownDesire());
    // Memory and trust (Memory.js): back away from / come to your hand
    if (typeof FleePlayerDesire !== "undefined") {
      this.brain.addDesire(new FleePlayerDesire());
      this.brain.addDesire(new SeekPlayerDesire());
    }
    // Bonds and grudges (Bonds.js): hang out with buddies, avoid grudges
    if (typeof SeekBuddyDesire !== "undefined") {
      this.brain.addDesire(new SeekBuddyDesire());
      this.brain.addDesire(new AvoidGrudgeDesire());
    }
    // Herds (Herds.js): stay near the herd's leader
    if (typeof FollowHerdDesire !== "undefined") {
      this.brain.addDesire(new FollowHerdDesire());
    }
    // Territory in the park (Territory.js): go home, chase off intruders, leave when chased
    // Weather (WorldTime.js): run for cover under the park trees when it rains
    if (typeof ShelterDesire !== "undefined") {
      this.brain.addDesire(new ShelterDesire());
    }
    if (typeof DefendTerritoryDesire !== "undefined") {
      this.brain.addDesire(new HomeTerritoryDesire());
      this.brain.addDesire(new DefendTerritoryDesire());
      this.brain.addDesire(new LeaveTerritoryDesire());
    }
    this.id = nextFluffyId++;
    this.age = 0;
    this.motherId = motherId;
    this.fatherId = null;
    relationships[this.id] = {};
    this.herdId = null;

    this.gender = gender || (Math.random() < 0.5 ? "male" : "female");

    this.x = width / 2;
    this.y = height / 2;
    const sceneCfg =
      typeof getSceneConfig === "function"
        ? getSceneConfig(scene)
        : typeof SCENES !== "undefined"
          ? SCENES[scene]
          : null;
    if ((sceneCfg && sceneCfg.hasRiver) || scene === "RIVER") {
      this.x = Math.max(width * 0.25 + 60, this.x);
    }

    this.growth = initialGrowth;

    this.facingRight = true;
    this.isAlive = true;
    this.lastDesire = null;
    this.deathTimer = 0;
    this.causeOfDeath = null;
    this.lastAttackerId = null;
    this.lastAttackTimer = 0;

    this.hunger = 1.0;
    this.health = 100;
    this.happiness = 0.6;
    this.cannibalismAcceptance = 0;
    this.isPoisoned = false;
    this.isToxoplasmosis = false;
    this.isToxoVaccinated = false;
    this.vomitTimer = 6.0 + Math.random() * 10.0;
    this.tasedTimer = 0;
    this.tasedOverrideTimer = 0;
    this.continuousTasedTimer = 0;
    this.continuousTasedSmokeTimer = 0;
    this.tasedPoint = null;
    this.smokePoints = [];
    this.smokeParticleTimer = 0;
    this.bloodstream = {};

    // Physics / Interaction
    this.isDragging = false;
    this.grabbedPart = null;
    this.dragOffset = { x: 0, y: 0 };
    this.vx = 0;
    this.vy = 0;
    this.lastX = this.x;
    this.lastY = this.y;
    this.physicsLegAngle = 0;
    this.flailAngle = 0;

    // State Management
    this.currentStateKey = "IDLE";
    this.stateTimer = 0;
    this.targetX = this.x;
    this.targetY = this.y;
    this.lastSeenPlayerTime = gameTimeMs();
    this.perceivedRelationships = {}; // otherId -> { state: 'current'|'lost'|'forgotten'|'dead', timer: seconds }
    this.matingState = {
      isMating: false,
      timer: 0,
      matingWith: null,
      femaleForced: false,
      interruptible: false,
    };

    // Current actual animation values (for smooth transitions)
    this.anim = {
      ...ANIMATION_STATES.IDLE,
      bodyAngle: 0,
      yOffset: 0,
    };
    this.animPhase = 0;

    // Speech Bubble
    this.speech = {
      text: null,
      timer: 0,
      nextTime: 0,
      opacity: 1,
    };
    this.attackCooldown = 0;
    this.cannibalTarget = null;
    this.aphrodisiacUtteranceTimer = 0;

    // Colors & Tinting
    this.colors = {};

    this.scene = scene;
    this.isFrantic = false;
    this.isScared = false;
    this.scaredTimer = 0;
    this.isDestroyed = false;
    this.trauma = {}; // otherId -> timer
    this.traumaMemory = []; // { type, timer }
    this.deathAnim = 0;
    this.birthRotation = 0;
    this.ragdollRotation = 0;
    this.currentCage = null;
    this.claimedBed = null;
    this.placedOn = null;
    this.fearOfOperatingTable = false;
    this.litterboxUsed = null;
    this.litterboxJitterTimer = 0;
    this.litterboxJitterOffset = 0;
    this.friendshipCooldowns = {};

    this.adopted = this.scene
      ? getSceneConfig(this.scene).insidePlayerQuarters
      : false;
    // How it feels about you (Memory.js)
    this.playerTrust =
      typeof TRUST_START === "number" ? (this.adopted ? TRUST_START : TRUST_START_FERAL) : 0.5;
    this.playerFear = 0;
    this.playerMemories = [];
    this.lastHurtByPlayerAt = null;
    // What it thinks of other fluffies (Bonds.js)
    this.opinions = {};
    this.opinionWhy = {};
    this.nextTapTime = Math.random() * 10; // Initialize random start

    this.isPregnant = false;
    this.sensitiveBaby = false;
    this.spayed = false;
    this.pregnancyTimer = 0;
    this.pregnancyTorsoStretch = 0;
    this.fatherGenes = null;
    this.seekingBirthBed = false;
    this.birthBedSeekTimeout = 0;
    this.babiesToBirth = 0;
    this.foalViability = [];
    this.birthIntervalTimer = 0;
    this.interactionTimer = Math.random() * 5;
    this.specialHuggiesCooldown = 0;
    this.fearedFluffies = []; // Now stores { id, timer }
    this.preferredMilkSources = []; // { id, type: 'HORSE' | 'FEEDER' }
    this.castrationBandTimer = CASTRATION_BAND_TIMER;
    this.castrationBandPainTimer = 5.0 + Math.random() * 5.0;

    this.wingFlapTimer = Math.random() * 5 + 2;
    this.wingFlapPhase = 0;

    this.personalities = [];
    if (this.gender === "male" && Math.random() < 0.15) {
      this.personalities = ["smarty"];
    }

    this.sexuality =
      typeof rollSexuality === "function" ? rollSexuality() : "heterosexual";

    this.dreamTimer = 0;
    this.currentDream = null;
    this.dreamEffectTimer = 0;
    this.dreamStretch = { x: 1.0, y: 1.0 };
    this.dreamAngle = 0;
    this.sleepDeprivation = 0;
    this.sleepTargetSet = false;

    this.expression = "NEUTRAL"; // "HAPPY", "NEUTRAL", "SAD", "MISERABLE", "SHOCKED"
    this.expressionOverride = null;
    this.expressionOverrideTimer = 0;
    this.headKnockTimer = 0;
    this.ballTarget = false;
    this.blockTarget = false;
    this.blockTowerKnockOverTarget = false;
    this.chaseTarget = null;
    this.chaseReason = null;
    this.blockOnBack = null;
    this.stackingTimer = 0;
    this.isStacking = false;
    this.blockCooldown = 0;
    this.fearReactionTimer = 0;
    this.carFearDecisionTimer = 0;
    this.carFearDecision = null;

    this.limbs = {
      legs: [true, true, true, true],
      tail: true,
      leftEar: true,
      rightEar: true,
      leftEye: true,
      rightEye: true,
      lumps: this.gender === "male",
      udders: this.gender === "female",
      leftWing: false,
      rightWing: false,
      horn: false,
      targetEarFlopAngle: 0,
      earFlopValue: 0,
    };

    this.poopStorage = 0;
    this.peeStorage = 0;
    this.pottyTraining = 0;
    this.badPoopieTimer = 0;
    this.goodPoopieTimer = 0;
    this.trainedForThisOccurrence = false;
    this.eatTimer = 0;
    this.blinkTimer = Math.random() * 2 + 1;
    this.moveSoundTimer = 0;
    this.drowningTimer = 0;
    this.isBlinking = false;
    this.bloodTolerance = 0;
    this.bloodReactionTimer = 0;
    this.lastPuddleReactionTime = 0;
    this.pupilOffset = { x: 0, y: 0 };
    this.pupilTwitchOffset = { x: 0, y: 0 };
    this.pupilTwitchOffset = { x: 0, y: 0 };
    this.pupilTwitchTimer = Math.random() * 2;
    this.tearTimer = 0;
    this.tearStreakSize = 0;
    this.tearFlowPhase = 0;
    this.tearGapPhase = 0;
    this.bleedingTimer = 0;
    this.alicornTolerance = false;
    this.lactatingTimer = 0;
    this.milkCharges = 0;
    this.milkRegenTimer = 0;
    this.milkCooldown = 0;
    this.despawnProtectionTimer = 0;
    this.tvSeekingTimer = 20;
    this.adoptionModifier = 0;
    this.isToxoVaccinated = false;
    this.isToxoplasmosis = false;

    this.counterattack = {
      fluffy: null,
      timer: 0,
    };

    if (initialGenes) {
      this.genes = initialGenes;
    } else {
      this.genes = this.generateRandomGenes(bodyQuality, maneQuality);
      if (type && type !== "earthy") {
        this.setGenesFromType(type);
      }
    }
    this.processGenes();
    this.coloristDegree = this.genetics.calculateColorismPerception();
    if (this.type === "alicorn") {
      this.alicornTolerance = true;
      this.limbs.horn = true;
      this.limbs.leftWing = true;
      this.limbs.rightWing = true;
    }

    if (this.type === "pegasus") {
      this.limbs.leftWing = true;
      this.limbs.rightWing = true;
    }

    if (this.type === "unicorn") {
      this.limbs.horn = true;
    }

    if (motherId !== null) {
      relationships[this.id][motherId] = "mother";
      if (relationships[motherId]) {
        const mom = fluffies.find((f) => f.id == motherId);
        if (mom && mom.type === "alicorn") {
          this.alicornTolerance = true;
        }
        let relType = initialGrowth < 1.0 ? "baby_child" : "child";
        if (
          worldSettings.alicornIntolerance &&
          this.type === "alicorn" &&
          mom &&
          mom.type !== "alicorn"
        ) {
          relType = "estranged_child";
        }
        if (
          worldSettings.colorism &&
          mom &&
          mom.coloristDegree > this.genetics.calculateColorismPerception()
        ) {
          relType = "estranged_child";
        }
        relationships[motherId][this.id] = relType;

        // Sibling Logic
        for (const other of fluffies) {
          if (other.id !== this.id && other.motherId === motherId) {
            relationships[this.id][other.id] =
              other.gender === "male" ? "brother" : "sister";
            if (!relationships[other.id]) relationships[other.id] = {};
            relationships[other.id][this.id] =
              this.gender === "male" ? "brother" : "sister";
          }
        }
      }
      this.motherId = motherId;
    }

    this.accessories = {};

    this.updateGrowthStats();
    this.initBehavior("IDLE");
  }

  setTargetPosition(x, y) {
    this.targetX = x;
    this.targetY = y;
    this.litterboxUsed = null;
  }

  generateRandomGenes(bodyQuality = null, maneQuality = null) {
    return this.genetics.generateRandomGenes(bodyQuality, maneQuality);
  }

  processGenes() {
    this.genetics.processGenes();
  }

  setGenesFromType(type) {
    this.genetics.setGenesFromType(type);
  }

  getColorName() {
    return this.genetics.getColorName();
  }

  calculatePrice() {
    return this.genetics.calculatePrice();
  }

  calculateColorMultiplier() {
    return this.genetics.calculateColorMultiplier();
  }

  combineGenes(otherGenes) {
    return this.genetics.combineGenes(otherGenes);
  }

  drawPortrait(ctx, x, y, size) {
    this.renderer.drawPortrait(ctx, x, y, size);
  }

  amputate(part, weapon = null) {
    return this.anatomy.amputate(part, weapon);
  }

  getMissingBodyParts() {
    return this.anatomy.getMissingBodyParts();
  }

  getMissingBodyPartsText() {
    return this.anatomy.getMissingBodyPartsText();
  }

  die(weaponType = null, cause = null) {
    this.anatomy.die(weaponType, cause);
  }

  isCrying() {
    return this.renderer.isCrying();
  }

  canSee() {
    if (
      this.accessories &&
      this.accessories.eyes &&
      this.accessories.eyes.id === "blindfold"
    )
      return false;
    if (this.isSensitive()) return false;
    return (
      (this.limbs.leftEye || this.limbs.rightEye) &&
      this.currentStateKey !== "SLEEPING" &&
      this.eyesHaveGrown()
    );
  }

  canHear() {
    return this.limbs.leftEar || this.limbs.rightEar;
  }

  tolerantOfAlicorns() {
    return this.alicornTolerance || this.type === "alicorn";
  }

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
      !worldSettings.alicornIntolerance ||
      this.typeVisibleToOthers() !== "alicorn" ||
      mare.tolerantOfAlicorns();
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
        worldSettings.colorism &&
        canSee &&
        mare.genetics &&
        this.genetics &&
        Math.random() * mare.coloristDegree >
          this.genetics.calculateColorismPerception()
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
      } else if (
        legless &&
        (mare.placedOn instanceof ImmobilizationBoard || Math.random() < 0.5)
      ) {
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
        if (
          Math.random() < 0.5 &&
          !this.fearedFluffies.some((f) => f.id === mare.id)
        ) {
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
  }

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

    const babies = fluffies.filter(
      (f) => f.motherId === mare.id && f.isAlive && f.tooYoungToWalk(),
    );
    const adoptionChance = 1 + this.adoptionModifier - babies.length * 0.34;
    if (Math.random() < adoptionChance) {
      // ADOPT!
      this.motherId = mare.id;
      this.adopted = mare.adopted;

      setRelationship(mare.id, this.id, "baby_child");
      setRelationship(this.id, mare.id, "mother");

      // Siblings
      const otherKids = fluffies.filter(
        (f) => f.motherId === mare.id && f.id !== this.id,
      );
      for (const sibling of otherKids) {
        setRelationship(
          this.id,
          sibling.id,
          sibling.gender === "male" ? "brother" : "sister",
        );
        setRelationship(
          sibling.id,
          this.id,
          this.gender === "male" ? "brother" : "sister",
        );
      }

      // Special Friend
      const specialFriendId = Object.keys(rels).find(
        (id) => rels[id] === "special_friend",
      );
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
  }

  setShock(duration) {
    this.expressionOverride = "SHOCKED";
    this.expressionOverrideTimer = duration;
  }

  changeHappiness(amount) {
    const oldHappiness = this.happiness;
    let newHappiness = clamp(this.happiness + amount, 0, 1);

    // If happiness is below or equal to WAN_DIE_THRESHOLD, it never goes above it
    if (oldHappiness <= WAN_DIE_THRESHOLD && newHappiness > WAN_DIE_THRESHOLD) {
      newHappiness = WAN_DIE_THRESHOLD;
    }

    this.happiness = newHappiness;
  }

  canBabble() {
    return (
      !this.isFrantic &&
      !this.isScared &&
      this.expression !== "SHOCKED" &&
      this.expression !== "CRYING_SHOCKED"
    );
  }

  randomBabble() {
    if (!this.canBabble()) return false;
    const isGagged =
      this.accessories &&
      this.accessories.mouth &&
      this.accessories.mouth.id === "mouthgag";
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
        let key = this.adopted
          ? ["VERY_HUNGRY", "ADOPTED"]
          : ["VERY_HUNGRY", "FERAL"];
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
      if (
        (this.limbs.leftWing || this.limbs.rightWing) &&
        Math.random() < 0.75
      ) {
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
      if (
        this.isPregnant &&
        !this.tooYoungToSpeak() &&
        Math.random() < 0.8 &&
        this.hunger > 0.6
      ) {
        text = getDialogue(["HELLO", "TUMMY_BABIES", "MOTHER"], this);
        this.initBehavior("LYING");
      }
    }

    if (!text && !this.tooYoungToSpeak() && this.health < 40) {
      text = getDialogue("LOW_HEALTH", this);
    }

    if (!text) {
      const lostBabies = Object.keys(this.trauma).filter(
        (id) => this.trauma[id] >= 300,
      );
      if (lostBabies.length > 0 && Math.random() < 0.4) {
        const babyId =
          lostBabies[Math.floor(Math.random() * lostBabies.length)];
        const baby = fluffies.find((f) => f.id == babyId);
        text = getDialogue(["TRAUMA", "BABY"], this, baby);
      }
    }

    if (!text) {
      if (
        this.personalities.length > 0 &&
        Math.random() < 0.3 &&
        this.adopted &&
        !this.tooYoungToSpeak()
      ) {
        const p =
          this.personalities[
            Math.floor(Math.random() * this.personalities.length)
          ];
        if (p === "true_feral")
          text = getDialogue(["PERSONALITY", "TRUE_FERAL"], this);
        else if (p === "lost_from_herd")
          text = getDialogue(["PERSONALITY", "LOST_HERD"], this);
        else if (p === "runaway")
          text = getDialogue(["PERSONALITY", "RUNAWAY"], this);
        else if (p === "smarty") {
          text = getDialogue(["PERSONALITY", "SMARTY"], this);
          this.expressionOverride = "ANGRY_PUFFED";
          this.expressionOverrideTimer = 3.0;
        } else if (p === "mill_escapee")
          text = getDialogue(["PERSONALITY", "MILL_ESCAPE"], this);
        else if (p === "mill_baby")
          text = getDialogue(["PERSONALITY", "MILL_BABY"], this);
        else if (p === "abandoned_baby")
          text = getDialogue(["PERSONALITY", "ABANDONED_BABY"], this);
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
        let key = this.tooYoungToSpeak()
          ? ["HELLO", , "FERAL_CHIRPY"]
          : ["HELLO", , "FERAL"];
        if (
          !getSceneConfig(currentScene).insidePlayerQuarters &&
          this.canSee()
        ) {
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
  }

  babbleFamilyDialogue() {
    if (this.tooYoungToSpeak() || (!this.canSee() && !this.canHear()))
      return null;
    const rels = relationships[this.id];
    if (!rels) return null;

    const candidates = [];
    for (const [otherId, relation] of Object.entries(rels)) {
      const other = fluffies.find(
        (f) => f.id == otherId && f.isAlive && f.scene === this.scene,
      );
      if (relation === "estranged_child") {
        continue;
      }

      // Not with someone on the other side of a fence: that's handled by
      // the sad "pen feelings" in Fence.js instead of a happy chat
      if (
        other &&
        typeof canFluffiesReachEachOther === "function" &&
        !canFluffiesReachEachOther(this, other)
      ) {
        continue;
      }

      if (other) {
        const dist = Math.sqrt(
          (this.x - other.x) ** 2 + (this.y - other.y) ** 2,
        );
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
  }

  isNearRunningGrinder() {
    if (typeof objects === "undefined") return false;
    for (const obj of objects) {
      if (
        obj instanceof Grinder &&
        obj.scene === this.scene &&
        obj.currentSpeed > 0
      ) {
        const dist = Math.sqrt((this.x - obj.x) ** 2 + (this.y - obj.y) ** 2);
        if (dist < 200) return true;
      }
    }
    return false;
  }

  shouldFlail() {
    if (!this.isAlive) return false;
    if (this.currentStateKey === "DROWNING") return true;
    if (!this.isDragging) return false;
    if (this.grabbedPart !== "torso") return true;
    if (this.isNearRunningGrinder() && (this.canSee() || this.canHear()))
      return true;
    if (this.currentStateKey === "SITTING" && this.grabbedPart === "torso")
      return true;
    return false;
  }

  eyesHaveGrown() {
    return this.growth > 0.12;
  }

  tooYoungToSpeak() {
    if (this.isSensitive()) return true;
    return this.growth < CHIRPY_THRESHOLD;
  }

  canTalk() {
    if (!this.isAlive) return false;
    if (
      this.accessories &&
      this.accessories.mouth &&
      this.accessories.mouth.id === "mouthgag"
    ) {
      return false;
    }
    if (this.hunger <= 0.1) return false;
    return true;
  }

  tooYoungToWalk() {
    if (this.isSensitive()) return true;
    return this.growth < WALKY_THRESHOLD;
  }

  isSensitive() {
    return (
      this.sensitiveBaby &&
      typeof worldSettings !== "undefined" &&
      worldSettings.sbs
    );
  }

  hasBlockOnBack() {
    return this.blockOnBack !== null;
  }

  dropHeldBlock() {
    this.isStacking = false;
    if (this.hasBlockOnBack() || this.stackTargetBlock) {
      this.failStackBlocks(this.stackTargetBlock);
      this.stackTargetBlock = null;
    }
  }

  isBeingTased() {
    return this.tasedTimer > 0;
  }

  isMovingOrRunning() {
    if (this.isBeingTased()) return false;
    return (
      this.currentStateKey === "MOVING" || this.currentStateKey === "RUNNING"
    );
  }

  tvFocusDistance() {
    return 200;
  }

  findNearbyTV() {
    if (typeof objects === "undefined") return null;
    for (const obj of objects) {
      if (
        obj instanceof FluffTV &&
        obj.scene === this.scene &&
        obj.currentCage === this.currentCage
      ) {
        const dist = Math.sqrt((this.x - obj.x) ** 2 + (this.y - obj.y) ** 2);
        if (dist < this.tvFocusDistance()) {
          if (
            this.isSmarty() &&
            obj.channel === "OFF" &&
            this.expressionOverrideTimer < 0.5 &&
            !this.tooYoungToSpeak()
          ) {
            this.speak(getDialogue(["TV_FOCUS", "SMARTY_OFF"], this));
            this.expressionOverride = "ANGRY_PUFFED";
            this.expressionOverrideTimer = 3.0;
          }
          if (obj.channel !== "OFF" && this.y > obj.y) {
            return obj;
          }
        }
      }
    }
    return null;
  }

  fleeFromTV(tv) {
    this.tvFocus = null;
    this.initBehavior("MOVING");
    const target = this.getRunawayTarget(tv.x, tv.y);
    this.setTargetPosition(target.x, target.y);
    this.currentStateKey = "RUNNING";
    this.expressionOverride = "CRYING_SHOCKED";
    this.expressionOverrideTimer = 3.0;
    this.changeHappiness(-0.1);
    this.isScared = true;
    this.scaredTimer = 5.0;
  }

  updateTVFocus(dt) {
    if (!this.isAlive) return;
    if (!this.canSee()) return;
    if (this.tooYoungToSpeak()) return;
    if (this.isDragging) {
      this.tvFocus = null;
      return;
    }
    if (this.placedOn) return;
    if (this.currentStateKey === "SLEEPING") return;
    if (this.happiness <= WAN_DIE_THRESHOLD) {
      this.tvFocus = null;
      return;
    }

    // If currently in TV focus
    if (this.tvFocus) {
      // Validate TV still exists, is in same scene/cage, and is not OFF
      const tv = this.tvFocus.tv;
      const tvValid =
        tv &&
        typeof objects !== "undefined" &&
        objects.includes(tv) &&
        tv.channel !== "OFF" &&
        tv.scene === this.scene &&
        tv.currentCage === this.currentCage;
      if (!tvValid || this.hunger < 0.5) {
        this.tvFocus = null;
        if (this.currentStateKey === "FOCUSING") {
          this.initBehavior("IDLE");
        }
        return;
      }

      this.tvFocus.timer -= dt;
      if (this.tvFocus.timer <= 0) {
        this.tvFocus = null;
        this.initBehavior("IDLE");
      }
      return;
    }
  }

  avoidStateChangerActions() {
    if (this.placedOn) return false;
    if (this.isBeingTased && this.isBeingTased()) return false;
    return (
      this.currentStateKey !== "EATING" &&
      this.currentStateKey !== "BENDING" &&
      this.currentStateKey !== "BENDING_2" &&
      this.currentStateKey !== "ATTEMPTING_EXCRETION" &&
      this.currentStateKey !== "FLUFFY_JAB" &&
      this.currentStateKey !== "FLUFFY_STOMPIE" &&
      this.currentStateKey !== "FLUFFY_KNOCKED_DOWN" &&
      this.currentStateKey !== "FLUFFY_BITE" &&
      this.currentStateKey !== "HUGGING" &&
      this.currentStateKey !== "DROWNING"
    );
  }

  getRunawayTarget(sourceX, sourceY) {
    return this.positioning.getRunawayTarget(sourceX, sourceY);
  }

  updateSpeed() {
    if (this.isCrawling) {
      this.speed = 40;
    } else if (this.currentStateKey === "RUNNING") {
      this.speed = 175;
    } else {
      this.speed = 100;
    }

    if (this.hasBlockOnBack()) {
      this.speed = Math.min(this.speed, 180);
    }

    if (this.isPregnant) {
      this.speed *= 0.5;
    }
    if (this.limbs === undefined) {
      return;
    }
    let limbsMissing = this.getLimbsMissing();
    this.speed /= 1 + limbsMissing;
    if (this.isSensitive()) {
      this.speed /= 4;
    }

    this.speed *= Math.max(WALKY_THRESHOLD, this.growth);
  }

  updateExpression(dt) {
    this.renderer.updateExpression(dt);
  }

  getLimbsMissing() {
    if (this.limbs === undefined) return 0;
    let limbsMissing = 0;
    for (let i = 0; i < 4; i++) {
      if (!this.limbs.legs[i]) limbsMissing++;
    }
    return limbsMissing;
  }

  getGrowthScale() {
    return 0.25 + 0.75 * this.growth;
  }

  performCannibalAttack(target) {
    if (
      this.accessories &&
      this.accessories.mouth &&
      this.accessories.mouth.id === "mouthgag"
    )
      return;
    this.anatomy.performCannibalAttack(target);
  }

  eatGib(gib) {
    this.anatomy.eatGib(gib);
  }

  eatCorpse(corpse) {
    this.anatomy.eatCorpse(corpse);
  }

  spawnGib(part, grinder = null, pregnancyData = null) {
    return this.anatomy.spawnGib(part, grinder, pregnancyData);
  }

  updateGrowthStats() {
    const genetics = this.geneticsSizeBonus || 0;
    const genderBonus = this.gender === "male" ? 0.08 : 0;
    const g = this.getGrowthScale();
    this.scale = 0.5 * (lerp(1, 0.92 + genderBonus, g) + genetics) * g;
    this.updateCrawling();
  }

  administerDrug(drug, amount) {
    if (!drug || isNaN(amount) || amount <= 0) return;
    if (!this.bloodstream) this.bloodstream = {};
    const currentAmount = this.bloodstream[drug] || 0;

    if (currentAmount <= 0) {
      const def =
        typeof DRUG_METABOLISM !== "undefined" ? DRUG_METABOLISM[drug] : null;
      if (def) {
        def.onApplication(this, amount);
      }
    }

    this.bloodstream[drug] = (this.bloodstream[drug] || 0) + amount;
    this.updateCrawling();
  }

  applyDrug(drug, amount) {
    return this.administerDrug(drug, amount);
  }

  getDrugAmount(drug) {
    if (!this.bloodstream || !drug) return 0;
    return this.bloodstream[drug] || 0;
  }

  hasDrugOverdose(threshold = 50) {
    if (!this.bloodstream) return false;
    return Object.values(this.bloodstream).some((amt) => amt > threshold);
  }

  updateCrawling() {
    let drugOverdoseCrawling = false;
    if (this.bloodstream) {
      for (const drug in this.bloodstream) {
        if (this.bloodstream[drug] > 40) {
          drugOverdoseCrawling = true;
          break;
        }
      }
    }

    this.isCrawling =
      this.placedOn ||
      this.tooYoungToWalk() ||
      (this.hunger !== undefined && this.hunger < 0.15) ||
      this.health < CRAWLING_HEALTH_THRESHOLD ||
      this.getLimbsMissing() >= 2 ||
      drugOverdoseCrawling ||
      (this.isBeingTased && this.isBeingTased());
  }

  isTooWeakToFightBack() {
    return isTooWeakToFightBack(this);
  }

  canFightBack() {
    return canFightBack(this);
  }

  updateMetabolism(dt) {
    if (!this.isAlive || !this.bloodstream) return;

    let maxDrug = 0;

    for (const [drug, amount] of Object.entries(this.bloodstream)) {
      if (amount <= 0) {
        this.bloodstream[drug] = 0;
        delete this.bloodstream[drug];
        continue;
      }

      if (amount > maxDrug) {
        maxDrug = amount;
      }

      const def = (typeof DRUG_METABOLISM !== "undefined" &&
        DRUG_METABOLISM[drug]) || {
        rate: 0.2,
        effect: null,
      };

      const rate = typeof def.rate === "number" ? def.rate : 0.2;
      const metabolized = Math.min(amount, rate * dt);

      if (metabolized > 0) {
        this.bloodstream[drug] -= metabolized;
        if (this.bloodstream[drug] <= 0.0001) {
          this.bloodstream[drug] = 0;
          delete this.bloodstream[drug];
        }
        if (typeof def.effect === "function") {
          def.effect(this, metabolized);
        }
      }
    }

    // Overdose check (>50 units might kill the fluffy)
    if (maxDrug > 50 && this.isAlive) {
      const overdoseSeverity = maxDrug - 50;
      // Roll for fatal overdose (scales with severity)
      const fatalChance = (0.08 + overdoseSeverity * 0.01) * dt;
      if (Math.random() < fatalChance) {
        this.die(null, "Drug overdose");
        return;
      }
      // Health penalty while overdosed
      this.health = Math.max(0, this.health - (5 + overdoseSeverity) * dt);
      if (this.health <= 0) {
        this.die(null, "Drug overdose");
        return;
      }
    }
  }

  spawnMouthPoof(color = "white") {
    this.anatomy.spawnMouthPoof(color);
  }

  initBehavior(stateKey) {
    if (stateKey === "FLUFFY_BITE") {
      this.spawnMouthPoof("#8a0303");
    }
    if (stateKey === "FLUFFY_KNOCKED_DOWN") {
      this._interruptMating();
      this.headKnockTimer = headKnockTime;
    }
    if (stateKey !== "MOVING" && stateKey !== "RUNNING") {
      this.ballTarget = false;
      this.blockTarget = false;
    }

    if (stateKey === "MOVING") {
      this.pickNewTarget();

      const dist = Math.sqrt(
        (this.targetX - this.x) ** 2 + (this.targetY - this.y) ** 2,
      );

      if (dist > 300 && canRun(this)) {
        stateKey = "RUNNING";
      }
    }

    // Stops calling the sleep helper until close to wherever the sleep target was (i.e. not moving, running)
    if (
      stateKey === "SLEEPING" ||
      (stateKey !== "MOVING" && stateKey !== "RUNNING")
    ) {
      this.sleepTargetSet = false;
    }

    if (stateKey === "SLEEPING" && typeof objects !== "undefined") {
      const nearbyBed = objects.find(
        (o) =>
          o instanceof Bed &&
          o.scene === this.scene &&
          o.currentCage === this.currentCage &&
          Math.sqrt((this.x - o.x) ** 2 + (this.y - o.y) ** 2) < 80,
      );
      if (nearbyBed) {
        const wasAlreadyClaimed = this.claimedBed === nearbyBed;
        nearbyBed.tryClaimFor(this); // speaks BED_CLAIM if newly claimed
        this.x = nearbyBed.x;
        this.y =
          nearbyBed.type === "cardboard_box"
            ? nearbyBed.y + CARDBOARD_BOX_SLEEP_OFFSET
            : nearbyBed.y - BED_HEIGHT / 2 - this.scale * 40;
        if (wasAlreadyClaimed && !this.tooYoungToSpeak()) {
          this.speak(getDialogue(["BED", "SLEEP"], this));
        }
      }
    }

    this.currentStateKey = stateKey;
    const behavior = BEHAVIOR_RULES[stateKey];

    if (stateKey === "MOVING" || stateKey === "RUNNING") {
      if (!this.targetX) this.pickNewTarget();
    } else {
      this.stateTimer = behavior.getDuration();
    }
  }

  getBottomY() {
    if (!this.layout) return this.y;
    return this.positioning.getExtentsForCage().bottom;
  }

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
          if (
            pRel.state === "lost" ||
            pRel.state === "forgotten" ||
            pRel.state === "dead"
          ) {
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
                this.tooYoungToSpeak()
                  ? ["LOST", "MOTHER", "PERMANENT_CHIRPY"]
                  : ["LOST", "MOTHER", "PERMANENT"],
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

    if (
      missingRelative &&
      this.speech.nextTime <= 0 &&
      (this.canSee() || this.canHear())
    ) {
      let target = null;
      let key = null;

      let lostRelative = newlyLostRelative;
      if (!lostRelative) {
        lostRelative = Object.entries(this.perceivedRelationships).find(
          ([_, pRel]) => pRel.state === "lost",
        );
      }
      if (!lostRelative) return;
      const [otherId, pRel] = lostRelative;

      if (pRel.state === "lost") {
        const relation = rels[otherId];
        const other = fluffies.find((f) => f.id == otherId);
        if (
          this.gender === "female" &&
          (relation === "baby_child" || relation === "child")
        ) {
          target = other;
          key = ["LOST", "BABY"];
        } else if (relation === "mother") {
          target = other;
          key = this.tooYoungToSpeak()
            ? ["LOST", "MOTHER", "CHIRPY"]
            : ["LOST", "MOTHER"];
        } else if (
          (relation === "brother" || relation === "sister") &&
          !this.tooYoungToSpeak()
        ) {
          target = other;
          key =
            relation === "brother" ? ["LOST", "BROTHER"] : ["LOST", "SISTER"];
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
  }

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

    const rels =
      typeof relationships !== "undefined" ? relationships[this.id] : null;
    if (!rels || !this.perceivedRelationships) return false;

    for (const [otherId, pRelEntry] of Object.entries(
      this.perceivedRelationships,
    )) {
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
  }

  calculateIsFrantic(hasMissing = null) {
    if (!this.isAlive) return false;
    const wanDieThreshold = WAN_DIE_THRESHOLD;
    if (this.happiness <= wanDieThreshold) return false;
    const missing =
      hasMissing !== null ? hasMissing : this.hasMissingRelative();
    const aphro = this.isUnderAphrodisiac();
    return !!(missing || aphro);
  }

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
  }

  wasAttackedBy(attacker) {
    if (!this.isAlive || !attacker || !attacker.isAlive) return;

    this.lastAttackerId = attacker.id;
    this.lastAttackTimer = 5.0; // 5 seconds window for "Killed by"

    const isMaleOnMaleMatingFight =
      attacker.gender === "male" &&
      this.gender === "male" &&
      !isSexuallyAttractedTo(this, attacker) &&
      (attacker.chaseReason === "MATING" ||
        (typeof attacker.isUnderAphrodisiac === "function" &&
          attacker.isUnderAphrodisiac()));

    if (isMaleOnMaleMatingFight) {
      if (this.canFightBack()) {
        this.counterattack.fluffy = attacker;
        this.counterattack.timer = 0.5 + Math.random() * 0.5; // 0.5s to 1.0s
      }
      return;
    }

    if (
      !this.canSee() ||
      this.isCrawling ||
      (typeof WAN_DIE_THRESHOLD !== "undefined" &&
        this.happiness <= WAN_DIE_THRESHOLD)
    )
      return;

    // 60% chance to retaliate
    if (Math.random() < 0.6) {
      this.counterattack.fluffy = attacker;
      this.counterattack.timer = 0.5 + Math.random() * 0.5; // 0.5s to 1.0s
    }
  }

  performAttack(target, intent = "SMARTY_VIOLENCE") {
    if (!target || !target.isAlive) return;
    // Can't reach them through a fence
    if (
      typeof canFluffiesReachEachOther === "function" &&
      !canFluffiesReachEachOther(this, target)
    )
      return;

    target.wasAttackedBy(this);

    // Face the target
    this.facingRight = target.x > this.x;
    target.facingRight = target.x < this.x;

    // Choose attack: STAB or STOMP
    const arr = [];
    const isGagged =
      this.accessories &&
      this.accessories.mouth &&
      this.accessories.mouth.id === "mouthgag";
    if (!isGagged) {
      arr.push("FLUFFY_BITE");
    }

    const hasAllLegs = !this.isCrawling && this.limbs.legs.every((l) => l);
    if (hasAllLegs) {
      arr.push("FLUFFY_JAB", "FLUFFY_STOMPIE");
    }

    if (arr.length === 0) return; // Cannot attack at all

    const behavior = arr[Math.floor(Math.random() * arr.length)];
    this.initBehavior(behavior);

    // Target reacts
    target.wasAttackedBy(this);
    // Grudges, and buddies jumping in (Bonds.js)
    if (typeof noteFluffyAttack === "function") noteFluffyAttack(this, target, intent);
    target.health -= 10;
    if (target.health <= 0) {
      const attackerName = typeof fluffyDisplayName === "function" ? fluffyDisplayName(this) : fluffyNames[this.id] || "Fluffy";
      target.die(null, `Killed by ${attackerName}`);
    } else {
      target.initBehavior("FLUFFY_KNOCKED_DOWN");
      target.setShock(1.0);
    }

    if (!target.tooYoungToSpeak()) {
      if (intent === "SMARTY_VIOLENCE") {
        target.speak(getDialogue(["HURT", "SMARTY"], target));
      } else if (intent === "RETALIATION" || intent === "GRUDGE" || intent === "TERRITORY") {
        target.speak(getDialogue(["HURT"], this));
      } else {
        target.speak(getDialogue(["HURT", "ALICORN_BABY"], target));
      }
    }

    // Cooldown for the attacker so they don't spam attack
    this.attackCooldown = 1.5;
    if (this.chaseReason !== "MATING" && Math.random() < 0.25) {
      this.chaseTarget = null;
    }
    if (Math.random() < 0.15) {
      target.bleedingTimer = 5;
    }
    target.attackCooldown = 5.0;
    target.chaseTarget = null;
  }

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
    const isMaleOnMaleUnconsensual =
      this.gender === "male" &&
      friend.gender === "male" &&
      !isSexuallyAttractedTo(friend, this);
    if (isMaleOnMaleUnconsensual && canFightBack(friend)) {
      return false;
    }
    if (!this.tinted || !this.tinted.torso) return false;
    // Not through a fence
    if (
      typeof canFluffiesReachEachOther === "function" &&
      !canFluffiesReachEachOther(this, friend)
    )
      return false;

    friend.y = this.y + this.tinted.torso.height * 0.25 * this.scale;
    const d = this.tinted.torso.width * 0.35 * this.scale;
    const diff = this.facingRight ? -d : d;
    this.x = friend.x + diff;
    friend.facingRight = this.facingRight;

    const hasCastrationBand =
      this.accessories &&
      this.accessories["ABOVE_LUMPS"] &&
      this.accessories["ABOVE_LUMPS"].id === "castration_band";

    this.initBehavior("BENDING");
    if (hasCastrationBand) {
      this.speak(
        getDialogue(
          [
            "CASTRATION_BAND_MATING",
            this.tooYoungToSpeak() ? "BABY" : "DEFAULT",
          ],
          this,
        ),
      );
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
    friend.matingState.matingWith = this;
    friend.matingState.matingTimer = time;
    friend.matingState.femaleForced = femaleForced;
    friend.matingState.interruptible = this.matingState.interruptible;

    if (
      femaleForced &&
      friend.fearedFluffies &&
      !friend.fearedFluffies.some((f) => f.id === this.id)
    ) {
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
  }

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
  }

  interruptMating() {
    if (!this.matingState.isMating) {
      return;
    }

    this._interruptMating();
    this.initBehavior("IDLE");
  }

  updateMating(dt) {
    if (!this.matingState.isMating || this.gender !== "male") {
      return;
    }
    this.matingState.matingTimer -= dt;
    if (this.matingState.matingTimer <= 0.0) {
      this.finishMating();
    }
  }

  finishMating() {
    const friend = this.matingState.matingWith;
    const femaleForced = this.matingState.femaleForced;
    const hasCastrationBand =
      this.matingState.hasCastrationBand ||
      (this.accessories &&
        this.accessories["ABOVE_LUMPS"] &&
        this.accessories["ABOVE_LUMPS"].id === "castration_band");
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
    } else if (
      friend.gender === "female" &&
      this.gender === "male" &&
      !friend.spayed &&
      !hasCastrationBand
    ) {
      friend.triggerPregnancy(this);
    }
  }

  triggerPregnancy(father) {
    this.anatomy.triggerPregnancy(father);
  }

  updateFear(dt) {
    if (!this.isAlive) return;
    for (let i = this.fearedFluffies.length - 1; i >= 0; i--) {
      this.fearedFluffies[i].timer -= dt;
      if (this.fearedFluffies[i].timer <= 0) {
        this.fearedFluffies.splice(i, 1);
      }
    }
  }

  addPreferredMilkSource(id, type) {
    if (
      !this.preferredMilkSources.some((s) => s.id === id && s.type === type)
    ) {
      this.preferredMilkSources.push({ id, type });
    }
  }

  fluffyIsRelatedOrSpecialFriend(f) {
    if (!relationships[this.id]) return false;
    const rel = relationships[this.id][f.id];
    return (
      rel === "mother" ||
      rel === "father" ||
      rel === "child" ||
      rel === "baby_child" ||
      rel === "brother" ||
      rel === "sister" ||
      rel === "special_friend"
    );
  }

  firstWordsBabble() {
    const text = getDialogue("BABY_FIRST_WORDS", this);
    this.speak(text, false, true);
  }

  speak(text, wanDieBypass = false, chirpyBypass = false) {
    if (
      this.accessories &&
      this.accessories.mouth &&
      this.accessories.mouth.id === "mouthgag"
    )
      return;
    if (!wanDieBypass) {
      if (this.hunger <= 0.1) return;
      if (this.happiness <= WAN_DIE_THRESHOLD) return;
    }

    let finalLines = text;

    if (
      !this.tooYoungToSpeak() &&
      this.growth < FULL_SPEECH_THRESHOLD &&
      !chirpyBypass
    ) {
      finalLines = filterBabyTalk(finalLines, this.growth);
    }

    if (this.tooYoungToSpeak() && this.scene === currentScene) {
      // Random pitch +- 10%
      const pitch = 1.5 + Math.random() * 0.5;
      const sound = [
        "foal_chirp_1",
        "foal_chirp_2",
        "foal_chirp_3",
        "foal_chirp_4",
      ][Math.floor(Math.random() * 4)];
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
      const bodyColor =
        this.colors && this.colors.body ? this.colors.body : null;
      if (typeof logChatMessage === "function") {
        logChatMessage(this.scene, speakerName, finalLines, bodyColor);
      }
    }

    if (this.scene === "OUTDOORS" && Math.random() < 0.4) {
      addDoorMessage(filterMuffled(text, 0.5));
    }
  }

  scoutForSleep() {
    return this.positioning.scoutForSleep();
  }

  scoutForHunger() {
    return this.positioning.scoutForHunger();
  }

  scoutForFallbackHunger() {
    return this.positioning.scoutForFallbackHunger();
  }

  scoutForLitterbox() {
    return this.positioning.scoutForLitterbox();
  }

  _pickNewTarget() {
    this.positioning._pickNewTarget();
  }

  pickNewTarget() {
    this.positioning.pickNewTarget();
  }

  constrainTargetToCage() {
    this.positioning.constrainTargetToCage();
  }

  attemptFindBlocksToStackOrKnock(sceneBlocks) {
    let targetBlock = sceneBlocks.find(
      (b) =>
        !b.heldBy &&
        !b.stackedOn &&
        !fluffies.some((f) => f.blockTarget && f.targetX === b.x) &&
        !b.getStackedAbove() &&
        !b.isDragging &&
        b.isStill(),
    );
    if (targetBlock) {
      this.blockTarget = true;
      this.initBehavior("MOVING");
      this.setTargetPosition(targetBlock.x, targetBlock.y);
    } else {
      // find block stack to knock over
      targetBlock = sceneBlocks.find(
        (b) =>
          !b.heldBy &&
          !b.stackedOn &&
          !fluffies.some((f) => f.blockTarget && f.targetX === b.x) &&
          !b.isDragging &&
          b.isStill(),
      );
      if (targetBlock) {
        this.blockTowerKnockOverTarget = true;
        this.initBehavior("MOVING");
        this.setTargetPosition(targetBlock.x, targetBlock.y);
      }
    }
  }

  handleCageContainment() {
    if (this.isDragging) return;

    if (
      this.currentCage &&
      (typeof objects === "undefined" ||
        !objects.includes(this.currentCage) ||
        this.currentCage.scene !== this.scene)
    ) {
      this.currentCage = null;
    }

    const extents = this.positioning.getExtentsForCage();
    const localLeft = extents.left - this.x;
    const localRight = extents.right - this.x;
    const localBottom = extents.bottom - this.y;

    if (this.currentCage) {
      const b = this.currentCage.bounds;
      if (
        typeof FoalInACan !== "undefined" &&
        this.currentCage instanceof FoalInACan
      ) {
        this.y = b.bottom - localBottom - 3;
        this.x = this.currentCage.x;
        this.scene = this.currentCage.scene;
        this.setTargetPosition(this.x, this.y);
      } else {
        // Force Y so visual bottom is at cage bottom
        this.y = b.bottom - localBottom - 10;
        this.x = clamp(this.x, b.left - localLeft, b.right - localRight);
      }
    }
  }

  updateLayout() {
    this.renderer.updateLayout();
  }

  needsLitterbox() {
    return (
      this.pottyTraining > 0 &&
      Math.max(this.poopStorage, this.peeStorage) >
        0.6 - this.pottyTraining * 0.2
    );
  }

  attemptLockIntoTable(table) {
    this.x = table.x;
    const tableOffset = 30;
    table.securedFluffy = this;
    if (this.currentStateKey !== "LYING" && this.avoidStateChangerActions()) {
      this.initBehavior("LYING");
    }
    if (table instanceof OperatingTable) {
      this.y = table.y - tableOffset;
    }
    if (table instanceof ImmobilizationBoard) {
      const extents = this.positioning.getExtentsForCage();
      this.y =
        table.y + 15 + 40 * this.scale + (extents.top - extents.bottom) / 2;
    }
    if (table instanceof LitterpalBox) {
      table.setScaleBasedOnSecuredFluffy();
      this.x = table.x - 5 * table.scale;
      this.y = table.y + 8 * table.scale;
    }
  }

  onDrop() {
    handleDropping(this);
    this.despawnProtectionTimer = 10;
    if (!this.isAlive) {
      this.layout.globalRotation = 0;
      this.ragdollRotation = 0;
      this.layout.torso.angle = 0;
    }

    // Check for Operating Table
    if (typeof objects !== "undefined") {
      const tables = objects.filter((o) => o instanceof OperatingTable);
      for (const table of tables) {
        if (
          this.x > table.bounds.left &&
          this.x < table.bounds.right &&
          this.y > table.bounds.top &&
          this.y < table.bounds.bottom &&
          this.scene === table.scene &&
          !table.securedFluffy
        ) {
          this.placedOn = table;
          this.attemptLockIntoTable(table);
          return;
        }
      }
    }

    // Check for Immobilization Board
    if (typeof objects !== "undefined") {
      const boards = objects.filter((o) => o instanceof ImmobilizationBoard);
      for (const board of boards) {
        if (
          this.x > board.bounds.left &&
          this.x < board.bounds.right &&
          this.y > board.bounds.top &&
          this.y < board.bounds.bottom &&
          this.scene === board.scene &&
          !board.securedFluffy
        ) {
          this.placedOn = board;
          this.facingRight = false; // Always face left
          this.attemptLockIntoTable(board);
          return;
        }
      }
    }

    // Check for Litterpal Box
    if (typeof objects !== "undefined" && !this.tooYoungToSpeak()) {
      const boxes = objects.filter((o) => o instanceof LitterpalBox);
      for (const box of boxes) {
        if (
          box.hitTest(this.x, this.y) &&
          this.scene === box.scene &&
          !box.securedFluffy
        ) {
          this.placedOn = box;
          this.attemptLockIntoTable(box);
          return;
        }
      }
    }
    this.placedOn = null;

    if (typeof objects !== "undefined") {
      const grinders = objects.filter((o) => o instanceof Grinder);
      for (const grinder of grinders) {
        const g = grinder.bounds;
        if (
          this.x > g.left &&
          this.x < g.right &&
          this.y > g.top &&
          this.y < g.bottom &&
          this.scene === grinder.scene
        ) {
          this.explode(grinder);
          return;
        }
      }
    }

    this.initBehavior("IDLE");
  }

  canBeSold() {
    if (!this.isAlive || !this.adopted) return false;
    if (this.accessories && Object.keys(this.accessories).length > 0)
      return false;
    return true;
  }

  update(dt) {
    if (isNaN(dt) || dt <= 0) return;
    if (this.isDestroyed) return;
    this.despawnProtectionTimer -= dt;
    if (this.carFearDecisionTimer > 0) {
      this.carFearDecisionTimer -= dt;
    }

    this.physics.updateRiverDrowning(dt);

    // Movement Sound Logic
    if (
      this.isAlive &&
      !this.isDragging &&
      !this.placedOn &&
      this.scene === currentScene
    ) {
      if (
        (this.currentStateKey === "MOVING" ||
          this.currentStateKey === "RUNNING") &&
        !this.isCrawling
      ) {
        this.moveSoundTimer -= 9 * dt;
        if (this.moveSoundTimer <= 0) {
          const isRunning = this.currentStateKey === "RUNNING";
          this.moveSoundTimer = Math.PI;
          if (isRunning) {
            this.moveSoundTimer = 2 * Math.PI;
            setTimeout(() => {
              if (
                this.isAlive &&
                !this.isDestroyed &&
                this.scene === currentScene
              ) {
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

    if (this.isAlive) {
      this.age += dt;
      // Homeostasis: stabilize at 0.6 over 3 minutes
      this.changeHappiness((0.6 - this.happiness) * (dt / 180));
    } else {
      this.deathTimer += dt;
    }

    // Proactive colorist mom attack logic
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
          const dist = Math.sqrt(
            (this.x - child.x) ** 2 + (this.y - child.y) ** 2,
          );
          if (dist < 100) {
            if (
              child.genetics &&
              this.coloristDegree > child.genetics.calculateColorismPerception()
            ) {
              this.performAttack(child, "COLOR");
              this.speak(getDialogue(["ATTACK", "COLOR"], this));
              relationships[this.id][child.id] = "estranged_child";
              break;
            }
          }
        }
      }
    }

    this.physics.updateTablePhysics(dt);

    const topWallHeight = sceneTop(this.scene);
    const groundYMin = topWallHeight + 50;

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
          (this.x - this.claimedBed.x) ** 2 +
            (this.y - this.claimedBed.y) ** 2 <
            10000;

        if (inBed && this.happiness > WAN_DIE_THRESHOLD) {
          if (this.claimedBed.type === "cardboard_box") {
            this.changeHappiness((HAPPINESS_BONUS_SLEEP_BOX / 60) * dt);

            this.boxWhimperTimer =
              (this.boxWhimperTimer || 5 + Math.random() * 15) - dt;
            if (this.boxWhimperTimer <= 0) {
              this.boxWhimperTimer = 15.0 + Math.random() * 20.0;
              if (
                !this.tooYoungToSpeak() &&
                typeof getDialogue !== "undefined"
              ) {
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

      // Hunger penalty: < 0.4 hunger -> -0.2 happiness per minute (not below WAN_DIE_THRESHOLD)
      if (this.hunger < 0.4 && this.happiness > WAN_DIE_THRESHOLD + 0.05) {
        const decrease = (0.2 / 60) * dt;
        this.changeHappiness(-decrease);
      }

      // Cage penalty: -0.1 per minute (not below WAN_DIE_THRESHOLD)
      if (
        (this.currentCage || this.placedOn instanceof LitterpalBox) &&
        this.happiness > WAN_DIE_THRESHOLD + 0.05
      ) {
        const decrease = (0.1 / 60) * dt;
        this.changeHappiness(-decrease);
      }
      this.changeHappiness(0); // Clamp and trigger rule logic if needed

      this.updateExpression(dt);

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
            const dist = Math.sqrt(
              (this.x - attacker.x) ** 2 + (this.y - attacker.y) ** 2,
            );
            // Retaliate if within reasonable reach (gentle fluffies often
            // don't: Traits.js)
            if (
              dist < 100 &&
              (typeof traitWillRetaliate !== "function" || traitWillRetaliate(this))
            ) {
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
          Math.sqrt(
            (this.x - this.claimedBed.x) ** 2 +
              (this.y - this.claimedBed.y) ** 2,
          ) < 120 &&
          !this.isMovingOrRunning() &&
          this.currentStateKey !== "SLEEPING";
        this.milkRegenTimer += dt;
        if (
          this.milkRegenTimer >=
          (restingAtBed
            ? LACTATING_CHARGE_INCREASE_TIMER / 2
            : LACTATING_CHARGE_INCREASE_TIMER)
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

    if (this.headKnockTimer > 0) {
      this.headKnockTimer -= dt;
    }

    this.blinkTimer -= dt;
    if (
      this.currentStateKey === "SLEEPING" ||
      !this.eyesHaveGrown() ||
      this.isSensitive()
    ) {
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

    // Pupil Movement & Twitching
    if (this.isAlive) {
      // 1. Target cursor if close
      const distToMouse = Math.sqrt(
        (mouse.x - this.x) ** 2 + (mouse.y - this.y) ** 2,
      );
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

    // Wing Flapping
    if (this.isAlive && (this.type === "pegasus" || this.type === "alicorn")) {
      if (this.isDragging) {
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

    if (
      this.isAlive &&
      this.currentStateKey === "SLEEPING" &&
      !this.tooYoungToWalk()
    ) {
      this.dreamTimer -= dt;
      if (this.dreamTimer <= 0) {
        const dreams = ["sketties", "ball", "block", "man", "sun"];
        this.currentDream =
          Math.random() < 0.75
            ? null
            : dreams[Math.floor(Math.random() * dreams.length)];
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

    if (this.badPoopieTimer > 0) {
      this.badPoopieTimer -= dt;
    }

    if (this.goodPoopieTimer > 0) {
      this.goodPoopieTimer -= dt;
    }

    this.lastPuddleReactionTime += dt;

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

    if (this.blockCooldown > 0) {
      this.blockCooldown -= dt;
    }

    if (this.isStacking) {
      this.stackingTimer += dt;
      if (
        this.stackingTimer > 12.0 ||
        (this.stackTargetBlock &&
          (this.stackTargetBlock.isDragging || this.stackTargetBlock.heldBy))
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

    if (this.birthRotation > 0) {
      this.birthRotation = Math.max(0, this.birthRotation - dt * 2.0);
    }
    if (this.isAlive) {
      this.updateSpeed();
      if (this.ragdollRotation !== 0 && !this.isDragging) {
        this.ragdollRotation = lerpAngle(this.ragdollRotation, 0, 10 * dt);
        if (Math.abs(this.ragdollRotation) < 0.01) this.ragdollRotation = 0;
      }

      // Smarty & Aphrodisiac Chase Logic
      if (
        this.isAlive &&
        (this.isSmarty() || this.isUnderAphrodisiac()) &&
        this.chaseTarget &&
        this.canSee()
      ) {
        const target = this.chaseTarget;
        // Validation
        if (
          !target.isAlive ||
          target.scene !== this.scene ||
          target.isDragging ||
          target.currentCage !== this.currentCage ||
          (!this.isUnderAphrodisiac() && this.specialHuggiesCooldown > 0) ||
          (!this.isUnderAphrodisiac() && this.isFrantic) ||
          this.isCrawling ||
          !this.limbs.lumps ||
          !placedOnValidForSpecialHuggies(target.placedOn) ||
          this.happiness <= WAN_DIE_THRESHOLD
        ) {
          this.chaseTarget = null;
          this.chaseReason = null;
        } else {
          this.setTargetPosition(target.x, target.y);

          if (!this.isMovingOrRunning() && this.attackCooldown <= 0) {
            this.initBehavior("RUNNING");
          }

          if (this.speech.nextTime <= 0) {
            this.speech.nextTime = 2 + Math.random();

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
              const yellText = this.isUnderAphrodisiac()
                ? this.getAphrodisiacDialogue()
                : getDialogue(yellKey, this, target);
              this.speak(yellText, this.isUnderAphrodisiac());

              // Target only reacts to yelling if they can hear.
              // If they can't see, they only react if they hear him.
              if (
                !target.canSee() &&
                target.canHear() &&
                !target.tooYoungToSpeak()
              ) {
                target.actionHandler.executeSmartyChaseFear(this);
              }
            }
          }

          const dist = Math.sqrt(
            (this.x - target.x) ** 2 + (this.y - target.y) ** 2,
          );
          if (dist < 50 && this.attackCooldown <= 0) {
            const isMaleOnMaleUnconsensual =
              this.gender === "male" &&
              target.gender === "male" &&
              !isSexuallyAttractedTo(target, this);

            if (this.chaseReason === "MATING" || this.isUnderAphrodisiac()) {
              if (isMaleOnMaleUnconsensual && canFightBack(target)) {
                this.performAttack(target, "SMARTY_VIOLENCE");
                const attackText = this.isUnderAphrodisiac()
                  ? this.getAphrodisiacDialogue()
                  : getDialogue(
                      [
                        "ATTACK",
                        "SMARTY",
                        this.tooYoungToSpeak() ? "BABY" : "ADULT",
                      ],
                      this,
                    );
                this.speak(attackText, this.isUnderAphrodisiac());
              } else if (this.mateWith(target, false, true)) {
                this.chaseTarget = null;
                this.chaseReason = null;
              }
            } else if (
              this.chaseReason === "ATTACK" ||
              target.gender === "male"
            ) {
              if (this.isSmarty()) {
                this.performAttack(target, "SMARTY_VIOLENCE");
                this.speak(
                  getDialogue(
                    [
                      "ATTACK",
                      "SMARTY",
                      this.tooYoungToSpeak() ? "BABY" : "ADULT",
                    ],
                    this,
                  ),
                );
              }
            } else if (this.mateWith(target, false, true)) {
              this.chaseTarget = null;
              this.chaseReason = null;
            }
          }
        }
      }

      if (getSceneConfig(this.scene).isAdoptionRoom) {
        if (
          !this.adopted &&
          !this.tooYoungToSpeak() &&
          (this.canSee() || this.canHear())
        ) {
          const key = this.isSmarty() ? ["ADOPTED", "SMARTY"] : ["ADOPTED"];
          this.speak(getDialogue(key, this));
          this.changeHappiness(1.0 - this.happiness);
        }
        this.adopted = true;
      }

      // Door Tapping Logic (Outdoors)
      if (
        getSceneConfig(this.scene).id === "OUTDOORS" &&
        getSceneConfig(currentScene).insidePlayerQuarters
      ) {
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
            const distToDoor = Math.sqrt(
              (this.x - width / 2) ** 2 + (this.y - (height * 0.15 + 50)) ** 2,
            );

            if (
              distToDoor < 300 &&
              !this.isFrantic &&
              !this.tooYoungToSpeak()
            ) {
              let text = null;
              const recent = recentOutdoorDialogue.filter(
                (d) => gameTimeMs() - d.time < 10000,
              );

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

      // Hunger Logic

      // Greedy fluffies get hungry faster, picky eaters slower (Traits.js)
      const traitHunger =
        typeof traitHungerMultiplier === "function" ? traitHungerMultiplier(this) : 1;
      this.hunger -=
        (dt / 450.0 + (dt / 225.0) * (1.0 - this.growth)) *
        debugHungerMultiplier *
        traitHunger *
        (typeof weatherHungerMultiplier === "function" ? weatherHungerMultiplier(this) : 1); // snow (WorldTime.js)

      // Drug Metabolism & Bloodstream Logic
      this.updateMetabolism(dt);
      if (!this.isAlive) return;

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
          this.die(null, `Killed by ${attackerName}`);
        } else {
          this.die(null, "Bled to death");
        }
      }

      // Health Regeneration (Disabled if poisoned or suffering toxoplasmosis)
      if (
        this.health < 100 &&
        this.bleedingTimer <= 0 &&
        !this.isPoisoned &&
        (!this.isToxoplasmosis ||
          (typeof worldSettings !== "undefined" &&
            !worldSettings.toxoplasmosis))
      ) {
        this.health = Math.min(100, this.health + 5 * this.growth * dt);
      }

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
        if (
          typeof worldSettings !== "undefined" &&
          !worldSettings.toxoplasmosis
        ) {
          this.isToxoplasmosis = false;
        } else if (this.isToxoVaccinated) {
          this.isToxoplasmosis = false;
          return;
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

      // Diarrhea logic: Causes a fluffy to void its bowels completely, can also be used for laxative effects.
      if (this.isDiarrhea) {
        if (this.poopStorage <= 0.1) {
          this.isDiarrhea = false;
        }
        if (this.poopStorage > 0.2 && Math.random() < (1 / 3) * dt) {
          this.diarrheaTimer = this.poopStorage * 20;
        }
        if (this.diarrheaTimer > 0 && this.poopStorage > 0) {
          this.diarrheaTimer -= 3 * dt;
          this.poopStorage = Math.max(0, this.poopStorage - 0.3 * dt);
          this.excretePoop(dt);
        }
      }

      // Incontinence logic: Causes a fluffy to involuntarily urinate on the spot, can also be used for diuretics.
      if (this.isIncontinent) {
        if (this.peeStorage <= 0.1) {
          this.isIncontinent = false;
        }
        if (this.peeStorage > 0.2 && Math.random() < (1 / 3) * dt) {
          this.incontinenceTimer = this.peeStorage * 20;
        }
        if (this.incontinenceTimer > 0 && this.peeStorage > 0) {
          this.incontinenceTimer -= 2 * dt;
          this.peeStorage = Math.max(0, this.peeStorage - 0.2 * dt);
          this.excretePee(dt);
        }
      }

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
            this.speak(
              getDialogue([
                "CASTRATION_BAND_PAIN",
                this.tooYoungToSpeak() ? "BABY" : "DEFAULT",
              ]),
            );
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

          if (
            typeof AccessoryItem !== "undefined" &&
            typeof objects !== "undefined"
          ) {
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
            this.speak(
              getDialogue([
                "CASTRATION_BAND_FINISH",
                this.tooYoungToSpeak() ? "BABY" : "DEFAULT",
              ]),
            );
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

        if (
          typeof AccessoryItem !== "undefined" &&
          typeof objects !== "undefined"
        ) {
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

      // Eating / Drinking Logic

      if (this.hunger < 0.6) {
        const isGagged =
          this.accessories &&
          this.accessories.mouth &&
          this.accessories.mouth.id === "mouthgag";
        // Bowl Eating (Not for chirpies)
        if (
          !isGagged &&
          !this.tooYoungToWalk() &&
          this.happiness > WAN_DIE_THRESHOLD && // Depressed fluffies don't eat
          !this.isUnderAphrodisiac() && // Under aphrodisiac males don't eat
          !(this.placedOn instanceof OperatingTable) &&
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
              bowl.scene === this.scene
            ) {
              // Accessibility Check
              if (this.currentCage !== bowl.currentCage) continue;
              // Can't eat through a fence
              if (
                typeof fenceCanReachThing === "function" &&
                !fenceCanReachThing(this, bowl)
              )
                continue;

              const dist = Math.sqrt(
                (this.x - bowl.x) ** 2 + (this.y - bowl.y) ** 2,
              );
              if (dist < 50) {
                if (bowl.eat()) {
                  this.hunger = 1.0;
                  this.initBehavior("EATING");
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

                  if (this.isSmarty()) {
                    if (bowl.foodType === "sketties") {
                      key = ["EAT", "SKETTIES", "SMARTY"];
                    } else if (bowl.foodType === "soylent_brown") {
                      key = ["EAT", "SOYLENT_BROWN"];
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
                  } else if (bowl.foodType === "soylent_brown") {
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
                    this.changeHappiness(HAPPINESS_BONUS_NUMMIES);
                  }
                  this.speak(getDialogue(key, this));
                  break;
                }
              }
            }
          }
        }
      }
      // Physical Incapacitation Overrides (Labor, Severe Depression)
      if (this.avoidStateChangerActions()) {
        if (
          !this.tooYoungToWalk() &&
          this.happiness <= WAN_DIE_THRESHOLD &&
          this.currentStateKey !== "LYING"
        ) {
          this.initBehavior("LYING");
        } else if (
          this.pregnancyTimer <= 0 &&
          this.babiesToBirth > 0 &&
          this.currentStateKey !== "LYING"
        ) {
          this.initBehavior("LYING");
        }
      }

      if (this.tasedTimer > 0) {
        this.tasedTimer -= dt;
        if (this.tasedTimer < 0) this.tasedTimer = 0;
      }

      this.isFrantic = this.calculateIsFrantic();

      // Let the brain decide on desires. Fluffies in the area you're looking
      // at think every frame; elsewhere 10 times a second is plenty (keeps
      // a busy park from slowing the game down)
      if (this.scene === currentScene) {
        this.brain.think(dt);
      } else {
        this._thinkTimer = (this._thinkTimer ?? Math.random() * 0.1) - dt;
        if (this._thinkTimer <= 0) {
          this._thinkTimer += 0.1;
          this.brain.think(dt);
        }
      }

      // Update physical state based on hunger
      const wasCrawling = this.isCrawling;
      this.updateCrawling();
      if (this.isCrawling !== wasCrawling) {
        this.updateSpeed();
      }

      if (this.isCrawling && this.currentStateKey === "SITTING") {
        this.initBehavior("IDLE");
      }

      if (this.growth < 1.0) {
        const wasTooYoungToSpeak = this.tooYoungToSpeak();
        this.growth = Math.min(
          1.0,
          this.growth + (dt / 1680.0) * debugGrowthMultiplier,
        );
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

      this.updateRelationships(dt);
      this.isFrantic = this.calculateIsFrantic();
      this.updateFear(dt);
      this.updateMating(dt);

      // Cannibalism interaction
      if (this.cannibalTarget && !this.isDragging) {
        // Prioritize nearby gibs over horses
        if (
          this.cannibalTarget instanceof Horse &&
          typeof gibs !== "undefined"
        ) {
          let nearestGib = null;
          let minGibDist = Infinity;
          for (const gib of gibs) {
            if (gib.scene === this.scene && gib.freeGib) {
              const d = Math.sqrt(
                (this.x - gib.x) ** 2 + (this.y - gib.y) ** 2,
              );
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
          (target instanceof Gib &&
            !target.shouldDespawn &&
            target.scene === this.scene) ||
          (target instanceof Horse &&
            target.scene === this.scene &&
            target.currentCage === this.currentCage &&
            !target.isDestroyed);

        if (!isStillValid) {
          this.cannibalTarget = null;
        } else {
          const dist = Math.sqrt(
            (this.x - target.x) ** 2 + (this.y - target.y) ** 2,
          );
          const isGagged =
            this.accessories &&
            this.accessories.mouth &&
            this.accessories.mouth.id === "mouthgag";
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

      // Ear Flopping
      if (Math.random() < dt / 15.0) {
        // Random angle avoiding 1/3 pi to 2/3 pi
        this.limbs.targetEarFlopAngle =
          (Math.random() < 0.5
            ? Math.random() / 4
            : 3 / 4 + Math.random() / 4) * Math.PI;
      }
      this.limbs.earFlopValue = lerpAngle(
        this.limbs.earFlopValue || 0,
        this.limbs.targetEarFlopAngle,
        5 * dt,
      );

      // Poop and Pee Storage Accumulation
      if (this.hunger > 0.5 || this.poopStorage > 0.3) {
        this.poopStorage += Math.random() * dt * 0.005 * debugPoopMultiplier;
        this.poopStorage = Math.min(1.0, this.poopStorage);
      }
      this.peeStorage += Math.random() * dt * 0.02 * debugPeeMultiplier;
      this.peeStorage = Math.min(1.0, this.peeStorage);

      // Peeing and Pooping
      if (
        (this.avoidStateChangerActions() ||
          this.placedOn instanceof LitterpalBox) &&
        !this.hasBlockOnBack()
      ) {
        // Pooping logic
        if (
          Math.max(this.poopStorage, this.peeStorage) >
          0.6 + this.pottyTraining * 0.2
        ) {
          this.attemptPoop();
        }
      }

      if (this.isPregnant) {
        // Update stretch
        if (this.pregnancyTimer > 0) {
          this.pregnancyTorsoStretch = Math.max(
            0,
            1.0 - this.pregnancyTimer / pregnancyDuration,
          );
        }

        if (this.pregnancyTimer > 0) {
          this.pregnancyTimer -= dt * debugPregnancyMultiplier;
          if (this.pregnancyTimer <= 0) {
            if (this.hasBlockOnBack()) {
              this.blockOnBack.heldBy = null;
              this.blockOnBack.x = this.x;
              this.blockOnBack.y = this.y;
              this.blockOnBack.groundY = this.y;
              this.blockOnBack = null;
            }
            if (this.babiesToBirth === 0) {
              this.babiesToBirth = Math.floor(Math.random() * 7) + 1;
            }
            if (this.foalViability.length === 0) {
              for (let i = 0; i < this.babiesToBirth; i++) {
                this.foalViability.push(true);
              }
            }

            const birthBed =
              this.claimedBed &&
              this.claimedBed.scene === this.scene &&
              this.claimedBed.currentCage === this.currentCage
                ? this.claimedBed
                : null;
            const distToBed = birthBed
              ? Math.sqrt(
                  (birthBed.x - this.x) ** 2 + (birthBed.y - this.y) ** 2,
                )
              : Infinity;

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
            this.claimedBed &&
            this.claimedBed.scene === this.scene &&
            this.claimedBed.currentCage === this.currentCage
              ? this.claimedBed
              : null;
          const atBed =
            birthBed &&
            Math.sqrt(
              (birthBed.x - this.x) ** 2 + (birthBed.y - this.y) ** 2,
            ) <= 30;
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
            const isViable = this.foalViability[viabilityIdx] !== false;

            this.spawnBaby(isViable);

            // Reduce health per birth
            const healthDamage = isViable ? 20 : 40;
            this.health = Math.max(0, this.health - healthDamage);
            if (this.health <= 0) {
              this.die(null, "Died in childbirth");
            }

            this.babiesToBirth--;
            if (this.babiesToBirth > 0) {
              this.birthIntervalTimer = 3.0; // 3 second delay
            } else {
              this.isPregnant = false;
              this.pregnancyTimer = 0;
              this.pregnancyTorsoStretch = 0;
              this.fatherGenes = null;
              this.foalViability = [];
              this.updateGrowthStats();
            }
          }
        }
      }

      if (this.happiness <= WAN_DIE_THRESHOLD) {
        this.isFrantic = false;
        this.isScared = false;
        this.scaredTimer = 0;
      }

      if (this.scaredTimer >= 0) {
        this.scaredTimer -= dt;
        if (this.scaredTimer <= 0) {
          this.isScared = false;
        }
      }

      if (this.speech.text) {
        this.speech.timer -= dt;
        if (this.speech.timer < 1)
          this.speech.opacity = Math.max(0, this.speech.timer);
        if (this.speech.timer <= 0) {
          this.speech.text = null;
          this.speech.nextTime = Math.random() * 10 + 10;
        }
      }
    } else {
      // Corpse logic: clear speech
      this.speech.text = null;
      this.deathAnim = Math.min(1, this.deathAnim + dt * 4);
    }

    if (this.bloodReactionTimer > 0) {
      this.bloodReactionTimer = Math.max(0, this.bloodReactionTimer - dt);
    }

    this.handleCageContainment();

    if (this.bloodTolerance > 0) {
      this.bloodTolerance = Math.max(0, this.bloodTolerance - 0.001 * dt);
    }

    const lerpFactor = 5.0 * dt;
    const targetConfig = ANIMATION_STATES[this.currentStateKey];
    let targetHeadAngle = targetConfig.headAngle;
    if (this.currentStateKey === "LYING" && this.hunger <= 0.1) {
      targetHeadAngle = (20 * Math.PI) / 180;
    }

    if (this.currentStateKey === "FLUFFY_BITE") {
      const duration = BEHAVIOR_RULES.FLUFFY_BITE.getDuration(this);
      const t = clamp(1.0 - this.stateTimer / duration, 0, 1);
      // Swing up then down
      if (t < 0.3) {
        // Moving up
        const frac = t / 0.3;
        targetHeadAngle = lerpAngle(
          ANIMATION_STATES.IDLE.headAngle,
          targetConfig.headAngle,
          frac,
        );
      } else {
        // Moving down
        const frac = (t - 0.7) / 0.7;
        targetHeadAngle = lerpAngle(
          targetConfig.headAngle,
          ANIMATION_STATES.IDLE.headAngle,
          frac,
        );
      }
      this.anim.headAngle = targetHeadAngle;
    } else {
      this.anim.headAngle = lerpAngle(
        this.anim.headAngle,
        targetHeadAngle,
        lerpFactor,
      );
    }

    if (this.isAlive) {
      if (this.shouldFlail()) {
        this.animPhase += 20.0 * dt;
        if (
          this.currentStateKey === "SITTING" &&
          this.grabbedPart === "torso"
        ) {
          this.animPhase -= 15.0 * dt;
        }
        this.flailAngle = Math.sin(this.animPhase) * 0.8;
      } else {
        this.flailAngle = 0;
      }

      if (
        this.currentStateKey === "DROWNING" &&
        this.expressionOverrideTimer <= 1
      ) {
        this.expressionOverride = "CRYING_SHOCKED";
        this.expressionOverrideTimer = 2.0;
        this.facingRight = Math.random() > 0.5;

        let key = this.tooYoungToSpeak() ? "CHIRPY" : "DEFAULT";
        this.speak(getDialogue(["DROWNING", key], this));

        this.speech.nextTime = 1.0 + Math.random();
      }
    }

    if (this.physics.updateDragging(dt, groundYMin)) {
      return;
    }

    if (this.isAlive) {
      // Mother chasing grabbed baby logic
      if (
        !this.isDragging &&
        !this.placedOn &&
        !this.tooYoungToWalk() &&
        this.canSee()
      ) {
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
              (rels[f.id] === "baby_child" || rels[f.id] === "child"),
          );
          if (grabbedChild) {
            this.setTargetPosition(grabbedChild.x, grabbedChild.y);

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
        this.continuousTasedSmokeTimer =
          (this.continuousTasedSmokeTimer || 0) + dt;
        if (this.continuousTasedSmokeTimer >= CATTLE_PROD_SMOKE_THRESHOLD) {
          this.continuousTasedSmokeTimer -= CATTLE_PROD_SMOKE_THRESHOLD;
          const hitPoint =
            this.tasedPoint ||
            (typeof mouse !== "undefined"
              ? { x: mouse.x, y: mouse.y }
              : { x: this.x, y: this.y });
          const offset = this.getTorsoOffsetFromPoint(
            hitPoint.x,
            hitPoint.y
          );
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
          if (
            this.tasedOverrideTimer === undefined ||
            this.tasedOverrideTimer <= 0
          ) {
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
          const worldPos = this.getWorldPositionFromTorsoOffset(
            offset.x,
            offset.y
          );
          const jitter = (Math.random() - 0.5) * 4 * (this.scale || 1.0);
          poofs.push(
            new SmokePoof(
              worldPos.x + jitter,
              worldPos.y + jitter,
              this.scene,
              CATTLE_PROD_SMOKE_COLOR
            )
          );
        }

        if (sp.timer <= 0) {
          this.smokePoints.splice(i, 1);
        }
      }
    } else {
      this.smokeParticleTimer = 0;
    }

    this.updateLayout();
  }

  consumePuddlesIfNeeded(dt) {
    if (this.currentStateKey === "EATING") {
      let consumed = false;
      if (typeof puddles !== "undefined") {
        for (const puddle of puddles) {
          if (puddle.scene !== this.scene || puddle.points.length === 0)
            continue;

          for (let j = puddle.points.length - 1; j >= 0; j--) {
            const p = puddle.points[j];
            const px = p.x;
            const py = p.y;
            const dPt = Math.sqrt((this.x - px) ** 2 + (this.y - py) ** 2);
            if (dPt < 40) {
              p.scale -= 0.02 * dt;
              if (p.targetScale)
                p.targetScale = Math.min(p.targetScale, p.scale);
              if (p.scale < 0.05) {
                puddle.points.splice(j, 1);
              }
              if (puddle.color == "#5c4033" || "#8a0303") {
                this.hunger = Math.min(1.0, this.hunger + 0.015 * dt);
                this.poopStorage = Math.min(1.0, this.poopStorage + 0.01 * dt);
                if (this.happiness > 0.1) {
                  //prevents wetrooms turning into a wan die-fest
                  this.changeHappiness(HAPPINESS_PENALTY_ATE_BODILY_WASTE * dt);
                }
              }

              this.health = Math.max(0, this.health - 1 * dt);
              if (
                (typeof worldSettings === "undefined" ||
                  worldSettings.toxoplasmosis) &&
                !this.isToxoplasmosis &&
                Math.random() < 0.3 * dt &&
                puddle.color == "#5c4033"
              ) {
                this.isToxoplasmosis = true;
              }
              if (this.health <= 0) {
                this.anatomy.die(null, "Eating bodily waste");
                consumed = true;
              }
            }
          }
        }
      }
      if (!consumed && typeof objects !== "undefined") {
        const litterboxes = objects.filter((o) => o instanceof Litterbox);
        for (const lb of litterboxes) {
          if (
            lb.scene === this.scene &&
            lb.currentCage === this.currentCage &&
            lb.uses > 0
          ) {
            const dLb = Math.sqrt((this.x - lb.x) ** 2 + (this.y - lb.y) ** 2);
            if (dLb < 50) {
              this.eatTimer += dt;
              this.hunger = Math.min(1.0, this.hunger + 0.1 * dt);
              if (this.eatTimer > 1.0) {
                lb.uses--;
                this.eatTimer = 0;
              }
              consumed = true;
            }
          }
        }
      }
    }
  }

  nextStateGivenIdle(dt) {
    if (this.currentStateKey === "ATTEMPTING_EXCRETION") {
      this.litterboxJitterTimer -= dt;
      if (this.litterboxJitterTimer <= 0) {
        this.litterboxJitterOffset =
          (Math.random() - 0.5) * ((20 * Math.PI) / 180);
        this.litterboxJitterTimer = 0.125;
      }
    } else {
      this.litterboxJitterOffset = 0;
    }

    // TV Focus Update
    this.updateTVFocus(dt);

    if (this.stateTimer <= 0) {
      // Capture next state before excrete() can change currentStateKey to BENDING_2
      const next = BEHAVIOR_RULES[this.currentStateKey].getNextState(this);

      if (this.currentStateKey === "ATTEMPTING_EXCRETION") {
        if (this.poopStorage > 0.5) this.excrete("poop");
        if (this.peeStorage > 0.5) this.excrete("pee");
        if (this.tooYoungToSpeak()) {
          this.speak(getDialogue(["POOP", "DONE", "CHIRPY"], this));
        } else {
          this.speak(getDialogue(["POOP", "DONE"], this));
        }
        this.expressionOverride =
          this.happiness > WAN_DIE_THRESHOLD ? "RELIEF" : "MISERABLE";
        this.expressionOverrideTimer = 2.0;
        this.litterboxUsed = null;
      }

      this.initBehavior(next);
    }
  }

  setAnimLerps(dt) {
    const lerpFactor = 5.0 * dt;
    const targetConfig = ANIMATION_STATES[this.currentStateKey];
    this.anim.headBobAmp = lerp(
      this.anim.headBobAmp,
      targetConfig.headBobAmp,
      lerpFactor,
    );
    this.anim.headBobSpeed = lerp(
      this.anim.headBobSpeed,
      targetConfig.headBobSpeed,
      lerpFactor,
    );
    this.anim.yOffset = lerp(
      this.anim.yOffset,
      targetConfig.yOffset || 0,
      lerpFactor,
    );
    this.anim.bodyAngle = lerpAngle(
      this.anim.bodyAngle,
      (targetConfig.bodyAngle || 0) + this.litterboxJitterOffset,
      lerpFactor,
    );
    this.anim.bodyBobAmp = lerp(
      this.anim.bodyBobAmp,
      targetConfig.bodyBobAmp,
      lerpFactor,
    );
    this.anim.bodyBobSpeed = lerp(
      this.anim.bodyBobSpeed,
      targetConfig.bodyBobSpeed,
      lerpFactor,
    );
    this.anim.legSwingAmp = lerp(
      this.anim.legSwingAmp,
      targetConfig.legSwingAmp,
      lerpFactor,
    );
    this.anim.tailAmp = lerp(
      this.anim.tailAmp,
      targetConfig.tailAmp,
      lerpFactor,
    );
    this.anim.tailSpeed = lerp(
      this.anim.tailSpeed,
      targetConfig.tailSpeed,
      lerpFactor,
    );
    const phaseSpeed =
      this.isMovingOrRunning() ||
      this.currentStateKey === "BENDING" ||
      this.currentStateKey === "BENDING_2"
        ? 9.0
        : 2.0;
    this.animPhase += phaseSpeed * dt;
  }

  attemptUseTargetLitterbox() {
    if (!this.litterboxUsed) {
      return false;
    }
    const lx =
      this.litterboxUsed instanceof LitterpalBox
        ? this.litterboxUsed.getSeekingCoords(this).x
        : this.litterboxUsed.x;
    const ly =
      this.litterboxUsed instanceof LitterpalBox
        ? this.litterboxUsed.getSeekingCoords(this).y
        : this.litterboxUsed.y - 50;
    const dx = lx - this.x;
    const dy = ly - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 50) {
      return false;
    }
    this.targetX = null;
    this.targetY = null;

    if (this.litterboxUsed instanceof LitterpalBox) {
      this.x = this.litterboxUsed.getSeekingCoords(this).x;
      this.y = this.litterboxUsed.getSeekingCoords(this).y;
      this.facingRight = false;
    } else {
      this.x = this.litterboxUsed.x;
      this.y = this.litterboxUsed.y - 50;
    }
    this.attemptPoop();

    // Store a walk-away target as a flag so it survives any animation
    // states (e.g. ATTEMPTING_EXCRETION) that fire before the next move.
    // _pickNewTarget() will consume this on the fluffy's next movement decision.
    const walkAwayDist = 180;
    const angle = Math.random() * Math.PI * 2;
    this._pendingWalkAwayX = clamp(
      this.x + Math.cos(angle) * walkAwayDist,
      100,
      sceneW(this.scene) - 100,
    );
    const groundYMax = this.scene === "BACKYARD" ? height - 120 : sceneH(this.scene) - 50;
    this._pendingWalkAwayY = clamp(
      this.y + Math.sin(angle) * walkAwayDist,
      sceneTop(this.scene) + 50,
      groundYMax,
    );

    return true;
  }

  tooFarFromBaby() {
    const rels = relationships[this.id];
    if (!rels) return null;

    for (const [otherId, relation] of Object.entries(rels)) {
      const other = fluffies.find((f) => f.id == otherId);
      if (!other || !other.isAlive || other.scene !== this.scene) continue;

      if (
        relation === "baby_child" &&
        other.tooYoungToWalk() &&
        (this.canSee() || this.canHear())
      ) {
        const dist = Math.sqrt(
          (this.x - other.x) ** 2 + (this.y - other.y) ** 2,
        );
        if (dist > 400) return other;
      }
    }
    return null;
  }

  failStackBlocks(stackTargetBlock) {
    let base = stackTargetBlock;
    while (base && base.stackedOn) {
      base = base.stackedOn;
    }
    let targetY = base
      ? typeof base.getClampedY === "function"
        ? base.getClampedY()
        : base.y
      : this.y;
    base = stackTargetBlock;

    if (this.blockOnBack) {
      this.blockOnBack.heldBy = null;
      this.blockOnBack.vx = (Math.random() - 0.5) * 400;
      this.blockOnBack.vy = -300;
      this.blockOnBack.groundY = targetY;
      this.blockOnBack = null;
    }

    // Make target stack bounce too
    while (base) {
      let bl = base.stackedOn;
      base.stackedOn = null;
      base.vx = (Math.random() - 0.5) * 400;
      base.vy = -300;
      base.groundY = targetY;
      base = bl;
    }
  }

  attemptPoop() {
    if (Math.random() < Math.max(this.poopStorage, this.peeStorage)) {
      let excreteType = this.poopStorage > this.peeStorage ? "poop" : "pee";
      //Determines what the fluffy excretes.
      this.excrete(excreteType);
      this.litterboxUsed = null;
    } else {
      this.initBehavior("ATTEMPTING_EXCRETION");
      this.speak(getDialogue(["POOP", "PUSH"], this));
    }
  }

  excrete(type, amount) {
    if (!type) {
      type = this.poopStorage > this.peeStorage ? "poop" : "pee";
    }
    const isPoop = type === "poop";
    if (amount === undefined) {
      amount = isPoop ? this.poopStorage : this.peeStorage;
    }

    // Check for nearby litterbox
    let nearLitterbox = this.positioning.isCloseToAnyLitterbox();
    let lbIsFull = nearLitterbox ? nearLitterbox.isFull() : false;

    // Reset storage
    if (type === "poop") {
      this.poopStorage = 0;
    } else if (type === "pee") {
      this.peeStorage = 0;
    }

    // Check for LitterpalBox
    if (this.placedOn instanceof LitterpalBox) {
      this.placedOn.use();
      this.goodPoopieTimer = 3.0;
      this.trainedForThisOccurrence = false;
    } else if (!nearLitterbox || lbIsFull) {
      if (nearLitterbox && lbIsFull) {
        this.speak(getDialogue(["POOP", "LITTERBOX_FULL"], this));
        this.goodPoopieTimer = 3.0; // Still a good attempt!
        this.trainedForThisOccurrence = false;
      } else {
        this.badPoopieTimer = 3.0;
        this.trainedForThisOccurrence = false;
      }

      if (
        this.pottyTraining > 0.2 &&
        Math.random() < 0.5 &&
        !lbIsFull &&
        !nearLitterbox &&
        !this.tooYoungToSpeak()
      ) {
        this.speak(getDialogue(["POOP", "BAD"], this));
      }

      const puddleColor = isPoop ? "#5c4033" : "#f1c40f"; // Brown or Yellow
      const torsoWidth = this.layout ? this.layout.torso.w : 100;
      const offsetX =
        (torsoWidth / 2) * (this.facingRight ? -1 : 1) * this.scale;
      const pX = this.x + offsetX;
      const pY = this.getBottomY() - 10;

      // Size based on amount and growth
      const baseTargetScale =
        ((60 * amount) / 200) * Math.max(CHIRPY_THRESHOLD, this.growth);

      addPointToPuddle(
        this.scene,
        pX,
        pY,
        puddleColor,
        5 / 200,
        baseTargetScale,
        0.02,
      );

      if (nearLitterbox && lbIsFull) {
        nearLitterbox.use();
      }
    } else {
      // Success! No puddle created.
      if (
        nearLitterbox instanceof LitterpalBox &&
        nearLitterbox.securedFluffy
      ) {
        // It's a Litterpal!
        this.speak(getDialogue(["LITTERPAL", "USE"]));
        if (
          (typeof worldSettings === "undefined" ||
            worldSettings.toxoplasmosis) &&
          this.isToxoplasmosis &&
          Math.random() < 0.3
        ) {
          nearLitterbox.securedFluffy.isToxoplasmosis = true;
        }
        nearLitterbox.securedFluffy.hunger = Math.min(
          1.0,
          nearLitterbox.securedFluffy.hunger + 0.15,
        );
        nearLitterbox.securedFluffy.speak(
          getDialogue(["LITTERPAL", "USE", "VICTIM"]),
        );
        nearLitterbox.securedFluffy.changeHappiness(
          HAPPINESS_PENALTY_LITTERBOX_VICTIM,
        );
        nearLitterbox.securedFluffy.expressionOverride = "MISERABLE";
        nearLitterbox.securedFluffy.expressionOverrideTimer = 3.0;
        if (this.gender === "male" && Math.random() < 0.3) {
          this.speak(getDialogue(["LITTERPAL", "USE", "MALE"]));
        }
        // Does not fill the box
      } else {
        nearLitterbox.use();
      }
      this.goodPoopieTimer = 3.0;
      this.trainedForThisOccurrence = false;

      if (this.pottyTraining < 1.0) {
        this.pottyTraining = Math.min(1.0, this.pottyTraining + 0.01);
      }
    }

    if (!this.tooYoungToWalk() && this.currentStateKey !== "SLEEPING") {
      this.initBehavior("BENDING_2");
      this.stateTimer = 0.5;
    }

    if (isPoop && Math.random() < 0.5 && !this.speech.text) {
      this.speak(getDialogue(["POOP", "FART"], this));
    }

    this.litterboxJitterOffset = 0;
  }
  excretePoop(dt) {
    const torsoWidth = this.layout ? this.layout.torso.w : 100;
    const offsetX = (torsoWidth / 2) * (this.facingRight ? -1 : 1) * this.scale;
    const pX = this.x + offsetX;
    const pY = this.getBottomY() - 10;
    const puddleColor = "#5c4033";

    // Increment area-based target scale
    const targetAddedAreaPerSec = 0.05;
    const targetScaleInc = Math.sqrt(targetAddedAreaPerSec * dt);

    const addedAreaPerSec = 0.01;
    const scaleInc = Math.sqrt(addedAreaPerSec * dt);

    addPointToPuddle(
      this.scene,
      pX,
      pY,
      puddleColor,
      scaleInc,
      targetScaleInc,
      0.02,
    );
  }
  excretePee(dt) {
    const torsoWidth = this.layout ? this.layout.torso.w : 100;
    const offsetX =
      (torsoWidth / 2) * (this.facingRight ? -0.5 : 0.5) * this.scale;
    const pX = this.x + offsetX;
    const pY = this.getBottomY() - 6;
    const puddleColor = "#f1c40f";

    // Increment area-based target scale
    const targetAddedAreaPerSec = 0.05;
    const targetScaleInc = Math.sqrt(targetAddedAreaPerSec * dt);

    const addedAreaPerSec = 0.01;
    const scaleInc = Math.sqrt(addedAreaPerSec * dt);

    addPointToPuddle(
      this.scene,
      pX,
      pY,
      puddleColor,
      scaleInc,
      targetScaleInc,
      0.02,
    );
  }
  excreteBlood(dt) {
    const pX = this.x;
    const pY = this.getBottomY();
    const puddleColor = "#8a0303";

    // Increment area-based target scale
    const targetAddedAreaPerSec = 0.1;
    const targetScaleInc = Math.sqrt(targetAddedAreaPerSec * dt);

    const addedAreaPerSec = 0.025;
    const scaleInc = Math.sqrt(addedAreaPerSec * dt);

    addPointToPuddle(
      this.scene,
      pX,
      pY,
      puddleColor,
      scaleInc,
      targetScaleInc,
      0.02,
    );
  }

  _startActiveLabor() {
    if (
      this.claimedBed &&
      this.claimedBed.scene === this.scene &&
      this.claimedBed.currentCage === this.currentCage
    ) {
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
  }

  spawnBaby(isViable = true) {
    this.anatomy.spawnBaby(isViable);
  }

  spawnTear() {
    this.anatomy.spawnTear();
  }

  static spawnPrematureBabies(grinder, scene, x, y, data) {
    HorseAnatomy.spawnPrematureBabies(grinder, scene, x, y, data);
  }

  explode(grinder) {
    this.anatomy.explode(grinder);
  }

  // Like hitTest, but for clicks: tests against where the fluffy was drawn
  // on screen last frame. A running fluffy (especially on fast forward, when
  // the game runs several steps per frame) has already moved on from the
  // spot the player clicked; this lines the click up with what they saw.
  hitTestAsSeen(px, py) {
    if (
      !this.isDragging &&
      this._seenFrame !== undefined &&
      typeof renderFrameCount !== "undefined" &&
      renderFrameCount - this._seenFrame <= 1
    ) {
      const dx = this.x - this._seenX;
      const dy = this.y - this._seenY;
      if ((dx || dy) && Math.abs(dx) < 400 && Math.abs(dy) < 400) {
        const hit = this.hitTest(px + dx, py + dy);
        if (hit) return hit;
      }
    }
    const direct = this.hitTest(px, py);
    if (direct) return direct;
    // A little leeway for a moving fluffy
    if (this.isMovingOrRunning && this.isMovingOrRunning()) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const hit = this.hitTest(px + Math.cos(a) * 10, py + Math.sin(a) * 10);
        if (hit) return hit;
      }
    }
    return false;
  }

  hitTest(
    px,
    py,
    multiplier = this.isBeingTased && this.isBeingTased()
      ? CATTLE_PROD_HITBOX_MULTIPLIER
      : 1.0
  ) {
    if (!this.layout) this.updateLayout();
    if (!this.layout) return false;

    // Transform px, py into local space
    // Order must be inverse of Draw: Draw = Translate * Scale * Rotate
    // Local = Rotate^-1 * Scale^-1 * Translate^-1 * World

    const dx = px - this.x,
      dy = py - this.y; // Translate^-1

    const s = this.facingRight ? this.scale : -this.scale;
    let lx = dx / s;
    let ly = dy / this.scale; // Scale^-1

    if (this.layout.globalRotation !== 0) {
      const cos = Math.cos(-this.layout.globalRotation),
        sin = Math.sin(-this.layout.globalRotation);
      const rx = lx * cos - ly * sin;
      const ry = lx * sin + ly * cos;
      lx = rx;
      ly = ry; // Rotate^-1
    }

    ly -= this.layout.bodyY;

    // Helper: check if point is in rotated rect
    const checkRect = (pointX, pointY, rect) => {
      const rdx = pointX - rect.x,
        rdy = pointY - rect.y;
      const cos = Math.cos(-rect.angle),
        sin = Math.sin(-rect.angle);
      const rx = rdx * cos - rdy * sin,
        ry = rdx * sin + rdy * cos;
      // Torso/Head pivot logic differs slightly in draw
      // Torso is drawn at -w/2, -h/2
      // Head pivot is at 0.25w, 0.85h
      let bx = -rect.w / 2,
        by = -rect.h / 2;
      if (rect === this.layout.head) {
        bx = -rect.w * 0.25;
        by = -rect.h * 0.85;
      }
      if (rect === this.layout.tail) {
        bx = -rect.w * 0.8;
        by = -rect.h * 0.1;
      }
      if (this.layout.legs.includes(rect)) {
        bx = -rect.w / 2;
        by = 0;
      }

      let buffer = 0;
      if (this.placedOn) buffer = 15;

      const diffW = rect.w * (multiplier - 1) * 0.5;
      const diffH = rect.h * (multiplier - 1) * 0.5;

      return (
        rx >= bx - buffer - diffW &&
        rx <= bx + rect.w + buffer + diffW &&
        ry >= by - buffer - diffH &&
        ry <= by + rect.h + buffer + diffH
      );
    };

    // 2. Torso (accounting for stretch)
    const torso = this.layout.torso;
    const tdx = lx - torso.x,
      tdy = ly - torso.y;
    const tcos = Math.cos(-torso.angle),
      tsin = Math.sin(-torso.angle);
    const trx = tdx * tcos - tdy * tsin,
      try_ = tdx * tsin + tdy * tcos;

    let tBuffer = 0;
    if (this.placedOn) tBuffer = 15;

    const tDiffW = torso.w * (multiplier - 1) * 0.5;
    const tDiffH = (torso.h + this.layout.stretch) * (multiplier - 1) * 0.5;

    // 1. Legs (Check front-to-back based on facingRight)
    const legOrder = this.facingRight ? [0, 1, 2, 3] : [2, 3, 0, 1];
    for (const i of legOrder) {
      if (this.limbs.legs[i] && checkRect(lx, ly, this.layout.legs[i])) {
        return `leg_${i}`;
      }
    }

    if (
      trx >= -torso.w / 2 - tBuffer - tDiffW &&
      trx <= torso.w / 2 + tBuffer + tDiffW &&
      try_ >= -torso.h / 2 - tBuffer - tDiffH &&
      try_ <= torso.h / 2 + this.layout.stretch + tBuffer + tDiffH
    ) {
      // Check Lumps
      if (this.gender === "male" && this.limbs.lumps) {
        const img = images.special_lumps;
        if (img) {
          const lx = -torso.w * 0.3;
          const ly = torso.h * 0.4 + this.layout.stretch * 0.8;
          const lDiffW = img.width * (multiplier - 1) * 0.5;
          const lDiffH = img.height * (multiplier - 1) * 0.5;
          if (
            trx >= lx - lDiffW &&
            trx <= lx + img.width + lDiffW &&
            try_ >= ly - lDiffH &&
            try_ <= ly + img.height + lDiffH
          ) {
            return "lumps";
          }
        }
      }

      // Check Wings (in torso-local space)
      if (this.layout.wing) {
        const wing = this.layout.wing;
        const wDiffW = wing.w * (multiplier - 1) * 0.5;
        const wDiffH = wing.h * (multiplier - 1) * 0.5;
        if (
          trx >= wing.x - wDiffW &&
          trx <= wing.x + wing.w + wDiffW &&
          try_ >= wing.y - wDiffH &&
          try_ <= wing.y + wing.h + wDiffH
        ) {
          const nearWingStr = this.facingRight ? "rightWing" : "leftWing";
          if (this.limbs[nearWingStr]) return nearWingStr;
        }
      }

      return "torso";
    }

    // 3. Head
    if (checkRect(lx, ly, this.layout.head)) {
      const head = this.layout.head;
      const hdx = lx - head.x,
        hdy = ly - head.y;
      const hcos = Math.cos(-head.angle),
        hsin = Math.sin(-head.angle);
      const hrx = hdx * hcos - hdy * hsin,
        hry = hdx * hsin + hdy * hcos;

      // Check Near Eye
      const nearEyeStr = this.facingRight ? "rightEye" : "leftEye";
      const eyeX = head.w * 0.45,
        eyeY = head.h * -0.325;
      if (
        Math.abs(hrx - eyeX) < 15 * multiplier &&
        Math.abs(hry - eyeY) < 15 * multiplier
      )
        return nearEyeStr;

      // Check Near Ear
      const nearEarStr = this.facingRight ? "rightEar" : "leftEar";
      const earX = -head.w * 0.25 + 10,
        earY = -head.h * 0.85 + 10;
      if (
        Math.abs(hrx - earX) < 20 * multiplier &&
        Math.abs(hry - earY) < 20 * multiplier
      )
        return nearEarStr;

      // Check Horn (in head-pivot-local space, relative to head pivot = hrx/hry origin)
      if (this.layout.horn && this.limbs.horn) {
        const horn = this.layout.horn;
        const hornDiffW = horn.w * (multiplier - 1) * 0.5;
        const hornDiffH = horn.h * (multiplier - 1) * 0.5;
        if (
          hrx >= horn.localX - hornDiffW &&
          hrx <= horn.localX + horn.w + hornDiffW &&
          hry >= horn.localY - hornDiffH &&
          hry <= horn.localY + horn.h + hornDiffH
        ) {
          return "horn";
        }
      }

      return "head";
    }
    // 4. Tail
    if (this.limbs.tail && checkRect(lx, ly, this.layout.tail)) return "tail";

    return null;
  }

  getTorsoOffsetFromPoint(px, py) {
    if (!this.layout) this.updateLayout();
    const dx = px - this.x;
    const dy = py - this.y;
    const s = this.facingRight ? this.scale : -this.scale;
    let lx = dx / s;
    let ly = dy / this.scale;

    const rot = (this.layout && this.layout.globalRotation) || 0;
    if (rot !== 0) {
      const cos = Math.cos(-rot);
      const sin = Math.sin(-rot);
      const rx = lx * cos - ly * sin;
      const ry = lx * sin + ly * cos;
      lx = rx;
      ly = ry;
    }

    const hasBodyY =
      !(
        typeof ImmobilizationBoard !== "undefined" &&
        this.placedOn instanceof ImmobilizationBoard
      ) &&
      !(
        typeof LitterpalBox !== "undefined" &&
        this.placedOn instanceof LitterpalBox
      );
    const bodyY =
      hasBodyY && this.layout && typeof this.layout.bodyY === "number"
        ? this.layout.bodyY
        : 0;
    ly -= bodyY;

    const torso = (this.layout && this.layout.torso) || { x: 0, y: 0, angle: 0 };
    const tdx = lx - (torso.x || 0);
    const tdy = ly - (torso.y || 0);
    const torsoAngle = torso.angle || 0;
    if (torsoAngle !== 0) {
      const tcos = Math.cos(-torsoAngle);
      const tsin = Math.sin(-torsoAngle);
      return {
        x: tdx * tcos - tdy * tsin,
        y: tdx * tsin + tdy * tcos,
      };
    }
    return { x: tdx, y: tdy };
  }

  getLocalOffsetFromTorsoCenter(px, py) {
    return this.getTorsoOffsetFromPoint(px, py);
  }

  getWorldPositionFromTorsoOffset(ox, oy) {
    if (!this.layout) this.updateLayout();
    const torso = (this.layout && this.layout.torso) || { x: 0, y: 0, angle: 0 };
    const torsoAngle = torso.angle || 0;
    let tdx = ox;
    let tdy = oy;
    if (torsoAngle !== 0) {
      const tcos = Math.cos(torsoAngle);
      const tsin = Math.sin(torsoAngle);
      tdx = ox * tcos - oy * tsin;
      tdy = ox * tsin + oy * tcos;
    }

    let lx = (torso.x || 0) + tdx;
    let ly = (torso.y || 0) + tdy;

    const hasBodyY =
      !(
        typeof ImmobilizationBoard !== "undefined" &&
        this.placedOn instanceof ImmobilizationBoard
      ) &&
      !(
        typeof LitterpalBox !== "undefined" &&
        this.placedOn instanceof LitterpalBox
      );
    const bodyY =
      hasBodyY && this.layout && typeof this.layout.bodyY === "number"
        ? this.layout.bodyY
        : 0;
    ly -= bodyY;

    const rot = (this.layout && this.layout.globalRotation) || 0;
    if (rot !== 0) {
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const rx = lx * cos - ly * sin;
      const ry = lx * sin + ly * cos;
      lx = rx;
      ly = ry;
    }

    const s = this.facingRight ? this.scale : -this.scale;
    return {
      x: this.x + lx * s,
      y: this.y + ly * this.scale,
    };
  }

  get smokeTimer() {
    if (!this.smokePoints || this.smokePoints.length === 0) return 0;
    return Math.max(...this.smokePoints.map((sp) => sp.timer || 0));
  }

  set smokeTimer(val) {
    if (val > 0) {
      if (!this.smokePoints) this.smokePoints = [];
      if (this.smokePoints.length > 0) {
        this.smokePoints[0].timer = val;
      } else {
        this.smokePoints.push({
          offset: { x: 0, y: 0 },
          x: 0,
          y: 0,
          timer: val,
        });
      }
    } else {
      this.smokePoints = [];
    }
  }

  get smokeOffset() {
    if (!this.smokePoints || this.smokePoints.length === 0) return null;
    const latest = this.smokePoints[this.smokePoints.length - 1];
    return latest.offset || { x: latest.x || 0, y: latest.y || 0 };
  }

  set smokeOffset(val) {
    if (val) {
      if (!this.smokePoints) this.smokePoints = [];
      if (this.smokePoints.length > 0) {
        const latest = this.smokePoints[this.smokePoints.length - 1];
        latest.offset = { x: val.x, y: val.y };
        latest.x = val.x;
        latest.y = val.y;
      }
    }
  }

  drawDream(ctx) {
    this.renderer.drawDream(ctx);
  }

  draw(ctx, clip = null) {
    if (!clip && this.drowningTimer > 0) {
      clip = { top: 1.0 - this.drowningTimer / 5 };
    }
    // Rotting corpses darken, fade and get flies (Corpses.js)
    const rotting = !this.isAlive && typeof beginCorpseLook === "function" && beginCorpseLook(ctx, this);
    this.renderer.drawOffScreen(ctx, clip);
    if (rotting) {
      ctx.restore();
      drawCorpseFlies(ctx, this);
    }
    if (this.placedOn instanceof ImmobilizationBoard) {
      this.placedOn.renderStrap(ctx, this);
    }
  }

  drawSpeechBubble(ctx) {
    this.renderer.drawSpeechBubble(ctx);
  }

  drawLeg(ctx, x, y, angle) {
    this.renderer.drawLeg(ctx, x, y, angle);
  }

  proposeFriendship(other) {
    if (!other || !other.isAlive || this.speech.timer > 0) return;
    this.speak(getDialogue("PROPOSE_FRIEND", this));

    if (
      worldSettings.colorism &&
      other.canSee() &&
      other.genetics &&
      this.genetics &&
      other.coloristDegree > this.genetics.calculateColorismPerception()
    ) {
      other.speak(getDialogue(["REJECT_FRIEND_COLOR"], other));
      other.expressionOverride = "ANGRY_PUFFED";
      other.expressionOverrideTimer = 3.0;
    } else if (
      worldSettings.alicornIntolerance &&
      other.canSee() &&
      !other.tolerantOfAlicorns() &&
      this.typeVisibleToOthers() === "alicorn"
    ) {
      other.positioning.attemptAlicornFear(this, false);
    } else if (
      other.canHear() &&
      typeof refusesFriendshipFrom === "function" &&
      refusesFriendshipFrom(other, this)
    ) {
      // Holds a grudge (Bonds.js)
      if (!other.tooYoungToSpeak()) other.speak(getDialogue(["BOND", "REFUSE"], other, this));
      other.expressionOverride = "ANGRY_PUFFED";
      other.expressionOverrideTimer = 3.0;
    } else if (other.canHear()) {
      other.acceptFriendship(this);
    }
  }

  acceptFriendship(other) {
    if (!relationships[this.id]) relationships[this.id] = {};
    if (!relationships[other.id]) relationships[other.id] = {};

    relationships[this.id][other.id] = "friend";
    relationships[other.id][this.id] = "friend";

    this.friendshipCooldowns[other.id] = 30;
    other.friendshipCooldowns[this.id] = 30;
    if (typeof onFriendshipMade === "function") onFriendshipMade(this, other);

    if (this.happiness > WAN_DIE_THRESHOLD) {
      this.speak(getDialogue("ACCEPT_FRIEND", this));
    }
  }

  sleepingOrTargetSet() {
    return this.currentStateKey === "SLEEPING" || this.sleepTargetSet;
  }

  isNearWasteSpot(radius = 150) {
    if (typeof objects === "undefined") return false;
    for (const o of objects) {
      if (o.scene !== this.scene) continue;
      if (!(o instanceof LitterpalBox || o instanceof Litterbox)) continue;
      if (Math.sqrt((this.x - o.x) ** 2 + (this.y - o.y) ** 2) < radius)
        return true;
    }
    return false;
  }

  typeVisibleToOthers() {
    let visibleWing = this.limbs.leftWing || this.limbs.rightWing;
    let visibleHorn = this.limbs.horn;

    const hasWingJacket =
      this.accessories &&
      this.accessories["torso"] &&
      this.accessories["torso"].id === "wingjacket";
    if (hasWingJacket) {
      visibleWing = false;
    }

    if (visibleHorn && visibleWing) {
      return "alicorn";
    } else if (visibleHorn) {
      return "unicorn";
    } else if (visibleWing) {
      return "pegasus";
    } else {
      return "earthy";
    }
  }

  attemptHugging(other) {
    if (
      typeof canFluffiesReachEachOther === "function" &&
      other &&
      !canFluffiesReachEachOther(this, other)
    )
      return;
    if (
      !other ||
      !other.isAlive ||
      other.isCrawling ||
      this.isCrawling ||
      !this.avoidStateChangerActions() ||
      !other.avoidStateChangerActions() ||
      other.fearedFluffies.some((ff) => ff.id === this.id) ||
      this.tvFocus ||
      this.isNearWasteSpot() ||
      other.isNearWasteSpot() ||
      other.happiness <= WAN_DIE_THRESHOLD ||
      (typeof keepsApart === "function" && keepsApart(this, other)) // rival herds (Herds.js)
    )
      return;

    const duration = 2 + 4 * Math.random();
    this.initBehavior("HUGGING");
    other.initBehavior("HUGGING");
    if (typeof onFluffiesHugged === "function") onFluffiesHugged(this, other); // Bonds.js
    this.stateTimer = duration;
    other.stateTimer = duration;

    // Position fluffies
    this.facingRight = true;
    other.facingRight = false;

    const myExtents = this.positioning.getSittingExtents();
    const otherExtents = other.positioning.getSittingExtents();
    const myBottomRelY = myExtents.bottom - this.y;
    const otherBottomRelY = otherExtents.bottom - other.y - 5;
    this.y = other.y + (otherBottomRelY - myBottomRelY);

    this.x = other.x - 30 * this.scale - 30 * other.scale;

    // Expressions
    const setHuggingExpression = (f) => {
      if (f.happiness <= WAN_DIE_THRESHOLD) {
        f.expressionOverride = "MISERABLE";
      } else if (f.happiness <= 0.35) {
        f.expressionOverride = "MISERABLE";
        if (!this.tooYoungToSpeak()) {
          f.speak(getDialogue(["HUG", "SAD"], f));
        }
      } else {
        f.expressionOverride = "RELIEF"; // happy eyes + happy mouth
        if (!this.tooYoungToSpeak()) {
          f.speak(getDialogue("HUG", f));
        }
      }
      f.expressionOverrideTimer = duration;
    };

    setHuggingExpression(this);
    setHuggingExpression(other);

    this.changeHappiness(0.075);
    other.changeHappiness(0.075);
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      growth: this.growth,
      gender: this.gender,
      type: this.type,
      facingRight: this.facingRight,
      isAlive: this.isAlive,
      age: this.age,
      scene: this.scene,
      hunger: this.hunger,
      health: this.health,
      happiness: this.happiness,
      cannibalismAcceptance: this.cannibalismAcceptance,
      poopStorage: this.poopStorage,
      peeStorage: this.peeStorage,
      pottyTraining: this.pottyTraining,
      currentStateKey: this.currentStateKey,
      stateTimer: this.stateTimer,
      targetX: this.targetX,
      targetY: this.targetY,
      genes: [...this.genes],
      motherId: this.motherId,
      fatherId: this.fatherId,
      personalities: [...this.personalities],
      adopted: this.adopted,
      traumaMemory: JSON.parse(JSON.stringify(this.traumaMemory)),
      playerTrust: this.playerTrust,
      playerFear: this.playerFear,
      playerMemories: JSON.parse(JSON.stringify(this.playerMemories || [])),
      lastHurtByPlayerAt: this.lastHurtByPlayerAt,
      opinions: { ...(this.opinions || {}) },
      opinionWhy: { ...(this.opinionWhy || {}) },
      isPregnant: this.isPregnant,
      sexuality: this.sexuality || "heterosexual",
      sensitiveBaby: this.sensitiveBaby,
      spayed: this.spayed,
      pregnancyTimer: this.pregnancyTimer,
      babiesToBirth: this.babiesToBirth,
      foalViability: [...this.foalViability],
      limbs: JSON.parse(JSON.stringify(this.limbs)),
      accessories: JSON.parse(JSON.stringify(this.accessories || {})),
      currentCageId: this.currentCage ? this.currentCage.id : null,
      claimedBedId: this.claimedBed ? this.claimedBed.id : null,
      placedOnId: this.placedOn ? this.placedOn.id : null,
      specialHuggiesCooldown: this.specialHuggiesCooldown,
      fearedFluffies: JSON.parse(JSON.stringify(this.fearedFluffies)),
      preferredMilkSources: JSON.parse(
        JSON.stringify(this.preferredMilkSources),
      ),
      isFrantic: this.isFrantic,
      isScared: this.isScared,
      causeOfDeath: this.causeOfDeath,
      deathTimer: this.deathTimer,
      separation: this.separation ? JSON.parse(JSON.stringify(this.separation)) : null,
      traumas: Array.isArray(this.traumas) ? JSON.parse(JSON.stringify(this.traumas)) : [],
      hurtByPlayerAt: this.hurtByPlayerAt ?? null,
      killedByPlayer: !!this.killedByPlayer,
      fromPark: !!this.fromPark,
      settling: !!this.settling,
      settleStart: this.settleStart ?? null,
      lastDesire: this.lastDesire
        ? JSON.parse(JSON.stringify(this.lastDesire))
        : null,
      fatherGenes: this.fatherGenes,
      lactatingTimer: this.lactatingTimer,
      alicornTolerance: this.alicornTolerance,
      coloristDegree: this.coloristDegree,
      herdId: this.herdId,
      isPoisoned: this.isPoisoned,
      poisoned: this.isPoisoned,
      isToxoplasmosis: this.isToxoplasmosis,
      isToxoVaccinated: this.isToxoVaccinated,
      bloodstream: JSON.parse(JSON.stringify(this.bloodstream || {})),
      smokeTimer: this.smokeTimer || 0,
      smokeOffset: this.smokeOffset
        ? { x: this.smokeOffset.x, y: this.smokeOffset.y }
        : null,
      smokePoints: (this.smokePoints || []).map((sp) => ({
        offset: {
          x: sp.offset ? sp.offset.x : sp.x || 0,
          y: sp.offset ? sp.offset.y : sp.y || 0,
        },
        x: sp.offset ? sp.offset.x : sp.x || 0,
        y: sp.offset ? sp.offset.y : sp.y || 0,
        timer: sp.timer || 0,
      })),
    };
  }

  get poisoned() {
    return this.isPoisoned;
  }
  set poisoned(val) {
    this.isPoisoned = val;
    if (val && this.renderer) this.renderer.tinted = null;
  }

  triggerVomit() {
    if (!this.isAlive) return;
    if (!this.avoidStateChangerActions()) return;

    this.initBehavior("VOMITING");
    this.expressionOverride = "MISERABLE";
    this.expressionOverrideTimer = 2.5;

    const phrase = Math.random() < 0.5 ? "*HACK* *GURGLE*" : "*GURGLEBARF*";
    this.speak(phrase);

    let px = this.x;
    let py = this.getBottomY();
    if (this.layout && this.layout.head) {
      const s = this.scale;
      const fx = this.facingRight ? 1 : -1;
      px = this.x + this.layout.head.x * s * fx;
      py = this.y + this.layout.head.y * s + 10;
    }

    if (typeof addPointToPuddle !== "undefined") {
      const vomitColor = "#4b5320"; // Putrid green
      const scale = (10 * this.scale) / 200;
      const targetScale = ((25 + Math.random() * 25) * this.scale) / 200;
      addPointToPuddle(
        this.scene,
        px,
        py,
        vomitColor,
        scale,
        targetScale,
        0.08,
        "vomit",
      );
    }
  }

  static deserialize(data) {
    const horse = new Horse(
      data.growth,
      data.motherId,
      data.scene,
      "earthy", // Placeholder, will be overriden by genes
      data.genes,
      null,
      null,
      data.gender,
    );

    horse.id = data.id;
    horse.alicornTolerance = data.alicornTolerance;
    horse.coloristDegree = data.coloristDegree;
    horse.x = data.x;
    horse.y = data.y;
    horse.facingRight = data.facingRight;
    horse.isAlive = data.isAlive;
    horse.age = data.age;
    horse.hunger = data.hunger;
    horse.health = data.health;
    horse.happiness = data.happiness;
    horse.cannibalismAcceptance = data.cannibalismAcceptance;
    horse.isPoisoned =
      data.isPoisoned !== undefined
        ? data.isPoisoned
        : data.poisoned !== undefined
          ? data.poisoned
          : false;
    horse.poopStorage = data.poopStorage;
    horse.peeStorage = data.peeStorage;
    horse.pottyTraining = data.pottyTraining;
    horse.currentStateKey = data.currentStateKey;
    horse.stateTimer = data.stateTimer;
    horse.targetX = data.targetX;
    horse.targetY = data.targetY;
    horse.fatherId = data.fatherId;
    horse.personalities = data.personalities;
    horse.adopted = data.adopted;
    horse.traumaMemory = data.traumaMemory;
    // Memory and trust (Memory.js); older saves keep the defaults
    if (typeof data.playerTrust === "number") horse.playerTrust = data.playerTrust;
    if (typeof data.playerFear === "number") horse.playerFear = data.playerFear;
    if (Array.isArray(data.playerMemories)) horse.playerMemories = data.playerMemories;
    if (typeof data.lastHurtByPlayerAt === "number") horse.lastHurtByPlayerAt = data.lastHurtByPlayerAt;
    // Bonds and grudges (Bonds.js)
    if (data.opinions && typeof data.opinions === "object") horse.opinions = data.opinions;
    if (data.opinionWhy && typeof data.opinionWhy === "object") horse.opinionWhy = data.opinionWhy;
    horse.isPregnant = data.isPregnant;
    horse.sexuality = data.sexuality || "heterosexual";
    horse.sensitiveBaby = data.sensitiveBaby || false;
    horse.spayed = data.spayed || false;
    horse.pregnancyTimer = data.pregnancyTimer;
    horse.babiesToBirth =
      data.babiesToBirth !== undefined ? data.babiesToBirth : 0;
    horse.foalViability = data.foalViability || [];
    horse.limbs = data.limbs || {
      leftFrontLeg: true,
      rightFrontLeg: true,
      leftBackLeg: true,
      rightBackLeg: true,
      leftEar: true,
      rightEar: true,
      tail: true,
      leftWing: true,
      rightWing: true,
      horn: true,
      specialLumps: true,
      udders: true,
    };
    horse.accessories = data.accessories || {};
    horse.specialHuggiesCooldown = data.specialHuggiesCooldown || 0;
    horse.fearedFluffies = data.fearedFluffies;
    horse.preferredMilkSources = data.preferredMilkSources;
    horse.isFrantic = data.isFrantic;
    horse.isScared = data.isScared;
    horse.causeOfDeath = data.causeOfDeath;
    horse.deathTimer = data.deathTimer || 0;
    horse.separation = data.separation || null;
    horse.traumas = Array.isArray(data.traumas) ? data.traumas : [];
    horse.hurtByPlayerAt = data.hurtByPlayerAt ?? null;
    horse.killedByPlayer = !!data.killedByPlayer;
    horse.fromPark = !!data.fromPark;
    horse.settling = !!data.settling;
    horse.settleStart = data.settleStart ?? null;
    horse.castrationBandTimer =
      data.castrationBandTimer !== undefined
        ? data.castrationBandTimer
        : CASTRATION_BAND_TIMER;
    horse.castrationBandPainTimer =
      data.castrationBandPainTimer !== undefined
        ? data.castrationBandPainTimer
        : 5.0;
    horse.lastDesire = data.lastDesire || null;
    horse.fatherGenes = data.fatherGenes;
    horse.lactatingTimer = data.lactatingTimer;
    horse.herdId = data.herdId !== undefined ? data.herdId : null;
    horse.bloodstream = data.bloodstream
      ? JSON.parse(JSON.stringify(data.bloodstream))
      : {};
    horse.isToxoplasmosis =
      typeof worldSettings === "undefined" || worldSettings.toxoplasmosis
        ? data.isToxoplasmosis || false
        : false;
    horse.isToxoVaccinated = data.isToxoVaccinated || false;
    if (Array.isArray(data.smokePoints)) {
      horse.smokePoints = data.smokePoints.map((sp) => ({
        offset: {
          x: sp.offset ? sp.offset.x : sp.x || 0,
          y: sp.offset ? sp.offset.y : sp.y || 0,
        },
        x: sp.offset ? sp.offset.x : sp.x || 0,
        y: sp.offset ? sp.offset.y : sp.y || 0,
        timer: sp.timer || 0,
      }));
    } else if (data.smokeTimer > 0) {
      const off = data.smokeOffset || { x: 0, y: 0 };
      horse.smokePoints = [
        {
          offset: { x: off.x, y: off.y },
          x: off.x,
          y: off.y,
          timer: data.smokeTimer,
        },
      ];
    } else {
      horse.smokePoints = [];
    }
    horse.updateCrawling();

    // Re-calculate derived values
    horse.renderer.ensureTintedImages();
    return horse;
  }
}
