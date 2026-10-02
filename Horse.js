const pregnancyDuration = 560; // about 2 weeks (Aging.js: a game day ~ a month)

function areSpecialFriends(id1, id2) {
  if (!relationships[id1] || !relationships[id2]) return false;
  return relationships[id1][id2] === "special_friend";
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
    // A squirt of water: they look round, that's all
    if (weaponType === "spray" && !isTraining) continue;
    // Witnessing potty training (Sorry Stick, spray bottle)
    if (isTraining && (weaponType === "stick" || weaponType === "spray")) {
      // Smarties don't learn from watching (this was the wrong way round:
      // only smarties learned; the brush's witnesses work this way too)
      if (other.isSmarty()) continue;

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

const THINK_EVERY_HERE = 0.05; // seconds between a fluffy's decisions where you're looking
const THINK_EVERY_AWAY = 0.1; // ...and elsewhere

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
    // Doing a trick (Tricks.js)
    if (typeof TrickDesire !== "undefined") this.brain.addDesire(new TrickDesire());
    // Sitting with you, or in a time-out (Care.js)
    if (typeof CareDesire !== "undefined") this.brain.addDesire(new CareDesire());
    // Frightened by thunder, the dark or the Fluff-Bot (Fears.js)
    if (typeof FrightDesire !== "undefined") this.brain.addDesire(new FrightDesire());
    // Chasing the ball in your hand (Play.js)
    if (typeof ChaseHeldBallDesire !== "undefined") this.brain.addDesire(new ChaseHeldBallDesire());
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
    this.bredHere = false; // born to one of your mares (Pregnancy.js onFoalBorn, Commissions.js)
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
    this.alicornComfort = 0; // getting used to alicorns, 0..1 (AlicornAcceptance.js)
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
          mom &&
          mumRejectsFoalColour(mom, this)
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
    const lost = this.anatomy.amputate(part, weapon);
    // A lasting injury goes in its story (LifeStory.js)
    if (lost && typeof recordStory === "function") recordStory("injured", this, { x: lost });
    // Spayed while wishing for foals (Wishes.js)
    if (lost === "spay" && this.wish && this.wish.id === "foal" && typeof denyWish === "function") {
      denyWish(this, "You had her spayed, and she never had the foals she wished for.");
    }
    return lost;
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

    // A newborn that can't crawl yet only wriggles (Carrying.js)
    if (typeof cantCrawlYet === "function" && cantCrawlYet(this)) this.speed = FOAL_WRIGGLE_SPEED;

    if (this.isPregnant) {
      this.speed *= 0.5;
    }

    // Elderly fluffies are slower (Aging.js)
    if (typeof isElderly === "function" && isElderly(this)) {
      this.speed *= 0.75;
    }
    // Chubby and fat fluffies are slower (Diet.js)
    if (typeof weightSpeedMultiplier === "function") this.speed *= weightSpeedMultiplier(this);
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

  getDrugAmount(drug) {
    if (!this.bloodstream || !drug) return 0;
    return this.bloodstream[drug] || 0;
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
    // On its mum's back: drawn just in front of her (Carrying.js)
    if (this._riding && typeof riderBottomY === "function") {
      const r = riderBottomY(this);
      if (r !== null) return r;
    }
    return this.getBottomYStanding();
  }

  getBottomYStanding() {
    if (!this.layout) return this.y;
    return this.positioning.getExtentsForCage().bottom;
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
    // (working out the body's extents is costly: only when it's in a cage)
    if (!this.currentCage) return;

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

    // Set down in a litterbox: a litter-training lesson (HorseToilet)
    if (this.isAlive && typeof this.litterboxDroppedIn === "function") {
      const lb = this.litterboxDroppedIn();
      if (lb) {
        this.placedInLitterbox(lb);
        this.initBehavior("IDLE");
        return;
      }
    }

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

    // Footstep sounds
    this._updateMovementSound(dt);

    if (this.isAlive) {
      this.age += dt;
      // Homeostasis: stabilize at 0.6 over 3 minutes (higher while
      // content after a wish came true, Wishes.js; lower or higher with
      // the feel of the room, Climate.js)
      const settle =
        0.6 +
        (typeof wishHappinessTarget === "function" ? wishHappinessTarget(this) : 0) +
        (typeof climateHappinessTarget === "function" ? climateHappinessTarget(this) : 0) + // the room's feel (Climate.js)
        (typeof fearHappinessTarget === "function" ? fearHappinessTarget(this) : 0); // fear of you (Memory.js)
      this.changeHappiness((settle - this.happiness) * (dt / 180));
    } else {
      this.deathTimer += dt;
    }

    // Colourist mums attacking foals they think are poopie
    this._updateColoristMum(dt);

    this.physics.updateTablePhysics(dt);

    const topWallHeight = sceneTop(this.scene);
    const groundYMin = topWallHeight + 50;

    // Sleep, happiness and other effects of the current state
    this._updateStateEffects(dt);

    if (this.headKnockTimer > 0) {
      this.headKnockTimer -= dt;
    }

    // Looks only (blinking, eyes, wings, dreams, tears): skipped for
    // fluffies in areas you aren't looking at, to save time
    const seen = this.scene === currentScene;

    // Blinking
    if (seen) this._updateBlinking(dt);

    // Pupil movement and twitching
    if (seen) this._updatePupils(dt);

    // Wing flapping
    if (seen) this._updateWings(dt);

    // Dreams while asleep
    if (seen) this._updateDreams(dt);

    if (this.badPoopieTimer > 0) {
      this.badPoopieTimer -= dt;
    }

    if (this.goodPoopieTimer > 0) {
      this.goodPoopieTimer -= dt;
    }

    this.lastPuddleReactionTime += dt;

    // Crying tears
    if (seen) this._updateTears(dt);

    if (this.blockCooldown > 0) {
      this.blockCooldown -= dt;
    }

    // Stacking blocks
    this._updateStacking(dt);

    if (this.birthRotation > 0) {
      this.birthRotation = Math.max(0, this.birthRotation - dt * 2.0);
    }
    if (this.isAlive) {
      this.updateSpeed();
      if (this.ragdollRotation !== 0 && !this.isDragging) {
        this.ragdollRotation = lerpAngle(this.ragdollRotation, 0, 10 * dt);
        if (Math.abs(this.ragdollRotation) < 0.01) this.ragdollRotation = 0;
      }

      // Smarty and aphrodisiac chasing
      this._updateSmartyChase();

      // In the adoption room
      this._updateAdoptionRoom();

      // Tapping at the door to come in (outdoors)
      this._updateDoorTapping(dt);

      // Hunger Logic

      // Hunger, drugs, bleeding, health and healing
      if (this._updateHungerAndHealth(dt)) return;

      // Poisoning, toxoplasmosis, diarrhoea and incontinence
      if (this._updateAilments(dt)) return;

      // Castration band
      this._updateCastrationBand(dt);

      // Eating / Drinking Logic

      // Eating and drinking
      this._updateEating();
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

      // Let the brain decide on desires: 20 times a second in the area
      // you're looking at (quicker than you can see; every step used to be
      // most of a crowded room's cost), 10 elsewhere. Spread out so they
      // don't all think on the same step.
      const thinkEvery = this.scene === currentScene ? THINK_EVERY_HERE : THINK_EVERY_AWAY;
      this._thinkTimer = Math.min(thinkEvery, (this._thinkTimer ?? Math.random() * thinkEvery) - dt);
      if (this._thinkTimer <= 0) {
        this._thinkTimer += thinkEvery;
        this.brain.think(dt);
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

      // Growing up
      this._updateGrowingUp(dt);

      this.updateRelationships(dt);
      this.isFrantic = this.calculateIsFrantic();
      this.updateFear(dt);
      this.updateMating(dt);

      // Cannibalism
      this._updateCannibalism();

      // Ear flopping
      this._updateEarFlop(dt);

      // Filling up and needing to poop and pee
      this._updateToiletNeeds(dt);

      // Pregnancy, labour and birth
      this._updatePregnancy(dt);

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
    // A newborn rides on its mum's back (Carrying.js)
    if (typeof updateRiding === "function") updateRiding(this);

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

    // Flailing and body animation
    this._updateFlailing(dt);

    if (this.physics.updateDragging(dt, groundYMin)) {
      return;
    }

    // Mums chasing after a grabbed baby, then moving and arriving
    this._updateMovementAndMums(dt);

    // Smoke rising from a smoking fluffy
    this._updateSmoke(dt);

    // Body layout for drawing: worked out when it's next drawn (once a
    // frame, not on every step - at 8x that was most of a crowded room's
    // cost). Anything that needs its size (getExtentsForCage) works it out
    // when it asks.
    if (seen) this._layoutDirty = true;
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

  spawnTear() {
    this.anatomy.spawnTear();
  }

  static spawnPrematureBabies(grinder, scene, x, y, data) {
    HorseAnatomy.spawnPrematureBabies(grinder, scene, x, y, data);
  }

  explode(grinder) {
    this.anatomy.explode(grinder);
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
    if (this._layoutDirty || !this.layout) {
      this._layoutDirty = false;
      this.updateLayout();
    }
    if (!clip && this.drowningTimer > 0) {
      clip = { top: 1.0 - this.drowningTimer / 5 };
    }
    // Rotting corpses darken, fade and get flies (Corpses.js); dirty
    // fluffies look it (Bath.js) - both drawn tinted in one go
    const rotting = !this.isAlive && typeof corpseTint === "function" ? corpseTint(this) : null;
    const grubby = !rotting && this.isAlive && typeof dirtTint === "function" ? dirtTint(this) : null;
    // Frightened fluffies tremble (Fears.js)
    const shaking = typeof beginFrightShake === "function" && beginFrightShake(ctx, this);
    const tint = rotting || grubby;
    if (tint && typeof drawFluffyTinted === "function") drawFluffyTinted(ctx, this, clip, tint.tints, tint.alpha);
    else this.renderer.drawOffScreen(ctx, clip);
    if (rotting) drawCorpseFlies(ctx, this);
    if (grubby) drawDirtEffects(ctx, this);
    if (shaking) ctx.restore();
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

  get poisoned() {
    return this.isPoisoned;
  }
  set poisoned(val) {
    this.isPoisoned = val;
    if (val && this.renderer) this.renderer.tinted = null;
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
    // Everything in SAVED_HORSE_FIELDS (HorseSave.js)
    applySavedHorseFields(horse, data);
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
      lumps: horse.gender === "male", // (was "specialLumps", which nothing reads)
      udders: true,
    };
    horse.accessories = data.accessories || {};
    horse.specialHuggiesCooldown = data.specialHuggiesCooldown || 0;
    horse.fearedFluffies = data.fearedFluffies;
    horse.preferredMilkSources = data.preferredMilkSources;
    horse.isFrantic = data.isFrantic;
    horse.isScared = data.isScared;
    horse.causeOfDeath = data.causeOfDeath;
    horse.castrationBandTimer =
      data.castrationBandTimer !== undefined
        ? data.castrationBandTimer
        : CASTRATION_BAND_TIMER;
    horse.castrationBandPainTimer =
      data.castrationBandPainTimer !== undefined
        ? data.castrationBandPainTimer
        : 5.0;
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

// ---------------------------------------------------------------------------
// The Horse class is split over several files (loaded right after this one):
// HorseFamily, HorseTalk, HorseMating, HorseToilet, HorseSocial,
// HorseHitTest, HorseSave, HorseUpdate. Each calls addHorseMethods({...}) to add its
// methods to every fluffy, exactly as if they were written in the class
// (not enumerable, so they don't show up when looping over a fluffy).
// ---------------------------------------------------------------------------
function addHorseMethods(methods) {
  for (const name of Object.keys(methods)) {
    if (Object.prototype.hasOwnProperty.call(Horse.prototype, name)) throw new Error(`Horse.${name} is defined twice`);
    Object.defineProperty(Horse.prototype, name, {
      value: methods[name],
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
}
