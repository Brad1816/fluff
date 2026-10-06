const pregnancyDuration = 300; // about a week: back to the original length (playtest: 560 was too long a wait for a game)

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
        other.pottyTraining + (0.05 + Math.random() * 0.05) * 0.25 * (typeof smartsLearn === "function" ? smartsLearn(other) : 1),
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
    other.changeHappiness(HAPPINESS_PENALTY_WITNESS_VIOLENCE, "Saw you hurt one");
    other.speak(getDialogue([key1, key2, key3], other, victim));
  }
}

const THINK_EVERY_HERE = 0.05; // seconds between a fluffy's decisions where you're looking
const THINK_EVERY_AWAY = 0.2; // ...and elsewhere (speed-up: they still eat, sleep, breed and grow on time)

// True while Horse.deserialize builds a fluffy from a save (see the constructor)
let horseBeingLoaded = false;

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
    const wasSmarty = Array.isArray(this._personalities) && this._personalities.includes("smarty");
    if (this.gender === "female") {
      this._personalities = unique.filter((p) => p !== "smarty");
    } else {
      this._personalities = unique;
    }
    // Made a smarty (or not one any more): good or bad is decided afresh -
    // rollSmartyKind where one is born or found; left alone, it's a bad one
    if (wasSmarty !== this._personalities.includes("smarty") && typeof horseBeingLoaded !== "undefined" && !horseBeingLoaded) this.smartyKind = undefined;
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
    // (a good smarty is clever and kind: it doesn't act like one - Intelligence.js)
    return this.personalities.includes("smarty") && this.smartyKind !== "good";
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
    // Mums and foals (batch 12): time away from her foals (BadMummah.js),
    // wandering off, a dead mum, bullying (FoalLife.js)
    if (typeof MumAwayDesire !== "undefined") this.brain.addDesire(new MumAwayDesire());
    if (typeof FoalLifeDesire !== "undefined") this.brain.addDesire(new FoalLifeDesire());
    // A herd job: fetching food for the needy, guarding, keeping in line (HerdJobs.js)
    if (typeof HerdJobDesire !== "undefined") this.brain.addDesire(new HerdJobDesire());
    // Carrying a foal to the Foal-4-Sketties machine (FoalMachine.js)
    if (typeof FoalTradeDesire !== "undefined") this.brain.addDesire(new FoalTradeDesire());
    // More from other files (Jobs.js...)
    if (typeof EXTRA_DESIRES !== "undefined") for (const D of EXTRA_DESIRES) this.brain.addDesire(new D());
    // Dizzy from being spun round (Tools.js)
    if (typeof DizzyDesire !== "undefined") this.brain.addDesire(new DizzyDesire());
    // Too hot: shade, water, a fan (Heat.js)
    if (typeof HeatDesire !== "undefined") this.brain.addDesire(new HeatDesire());
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
    // (Loading a save: Horse.deserialize sets the real id and the saved
    // relationships, so don't use up an id or write family links for one)
    this.id = horseBeingLoaded ? -1 : nextFluffyId++;
    this.age = 0;
    this.motherId = motherId;
    this.fatherId = null;
    if (!horseBeingLoaded) relationships[this.id] = {};
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
    this.isOnFire = false;
    this.fireElapsed = 0; // Seconds since catching fire
    this.fireScreamTimer = 0;
    this.fireSmokeTimer = 0;
    this.fireEmberTimer = 0;
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
    // The throw tool (ThrowTool.js, HorsePhysics.updateThrowFall)
    this.heldWithThrowTool = false;
    this.wasHeldHigh = false;
    this.isFallingFromThrow = false;
    this.throwFallVx = 0;
    this.throwFallVy = 0;
    this.throwStartY = null; // where it was lifted from (it lands back there)
    this.throwShadowY = null;
    this.throwTool = null;
    this.ballCooldown = 0; // (rests a while after playing with a ball)

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
    this.miscarriageTimer = null; // Counts down to an early (non-viable) birth; null when not miscarrying
    this.prematureGrowth = 1.0; // Pregnancy progress at birth (1 = full term); shrinks premature babies
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
    this.shownDream = null; // Dream currently drawn in the bubble (lags currentDream while animating)
    this.dreamBubbleProgress = 0; // 0 = hidden, 1 = fully shown
    this.dreamPulsePhase = 0;
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
    this.wantsUpsies = false; // Sitting and reaching up at a nearby cursor
    this.upsiesWigglePhase = 0;
    this.hugSwayPhase = 0; // Drives arm swaying while hugging
    this.bloodTolerance = 0;
    this.bloodReactionTimer = 0;
    this.lastPuddleReactionTime = 0;
    this.pupilOffset = { x: 0, y: 0 };
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
    this.coloristDegree = Math.floor(
      this.genetics.calculateColorismPerception(),
    );
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
    // A few simply don't care about alicorns (AlicornAcceptance.js; ones
    // found in the park or the shelter are rolled where they're made)
    if (motherId !== null && !horseBeingLoaded && typeof rollAlicornIndifference === "function") rollAlicornIndifference(this);
    // A foal born a smarty: good or bad? (Intelligence.js; ones found in the
    // park or the shelter are rolled where they're made)
    if (motherId !== null && !horseBeingLoaded && typeof rollSmartyKind === "function") rollSmartyKind(this);

    if (motherId !== null && !horseBeingLoaded) {
      relationships[this.id][motherId] = "mother";
      if (relationships[motherId]) {
        const mom = fluffyById(motherId);
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

  // Where the horse is in the world, at ground level. While it's held by the
  // throw tool or falling from a throw, that's the spot below it it was
  // lifted from, not its literal (mid-air) x/y.
  getWorldPosition() {
    const airborne =
      (this.heldWithThrowTool || this.isFallingFromThrow) &&
      typeof this.throwStartY === "number";
    return { x: this.x, y: airborne ? this.throwStartY : this.y };
  }

  setTargetPosition(x, y) {
    // Never into the wall (a block on its back, a toy dropped against the
    // wall...): the nearest spot on the floor instead
    if (typeof y === "number" && typeof sceneTop === "function" && !this.placedOn && !this.currentCage && !this.heldWithThrowTool) y = Math.max(y, sceneTop(this.scene) + 50);
    if (typeof x === "number" && typeof sceneW === "function") x = Math.max(20, Math.min(sceneW(this.scene) - 20, x));
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

  // Made as a given type with random genes (a can, a shop): the random wing
  // and horn genes could make an "earthy" a pegasus or unicorn. Make it the
  // type it was sold as.
  makeType(type) {
    if (!type || this.type === type) return;
    this.setGenesFromType(type);
    if (type === "earthy") for (let i = 53; i <= 62; i++) this.genes[i] = 0;
    this.processGenes();
    this.limbs.horn = this.type === "unicorn" || this.type === "alicorn";
    this.limbs.leftWing = this.limbs.rightWing = this.type === "pegasus" || this.type === "alicorn";
    if (this.type === "alicorn") this.alicornTolerance = true;
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
    this.renderer.drawSnapshot(ctx, x, y, size);
  }

  // The same, drawn once into a picture that's reused for maxAgeMs (for panels
  // that show a portrait every frame: drawing the whole body each time is slow)
  drawPortraitCached(ctx, x, y, size, maxAgeMs = 500) {
    if (typeof OffscreenCanvas === "undefined") return this.drawPortrait(ctx, x, y, size);
    const k = typeof renderScale === "number" && renderScale > 0 ? renderScale : 1;
    const key = `${size}@${k}`;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!this._portraitCache) this._portraitCache = new Map();
    let e = this._portraitCache.get(key);
    if (!e || now - e.at > maxAgeMs || now < e.at) {
      const side = Math.ceil(size * 2 * k);
      const canvas = e && e.canvas.width === side ? e.canvas : new OffscreenCanvas(side, side);
      const c = canvas.getContext("2d");
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, side, side);
      c.scale(k, k);
      try {
        this.drawPortrait(c, size, size * 1.2, size);
      } catch (err) {
        return this.drawPortrait(ctx, x, y, size);
      }
      if (this._portraitCache.size > 6) this._portraitCache.clear();
      e = { at: now, canvas };
      this._portraitCache.set(key, e);
    }
    ctx.drawImage(e.canvas, x - size, y - size * 1.2, size * 2, size * 2);
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
    // A real shock (not the little one of being held): it may wet itself (Scaredy.js)
    if (duration >= 1.5 && typeof scaredyMess === "function") scaredyMess(this, Math.min(1, duration / 3));
  }

  // cause: a few words for the Mood tab (Mood.js), e.g. "Hungry"
  changeHappiness(amount, cause = null) {
    const oldHappiness = this.happiness;
    let newHappiness = clamp(this.happiness + amount, 0, 1);

    // If happiness is below or equal to WAN_DIE_THRESHOLD, it never goes above it
    if (oldHappiness <= WAN_DIE_THRESHOLD && newHappiness > WAN_DIE_THRESHOLD) {
      newHappiness = WAN_DIE_THRESHOLD;
    }

    this.happiness = newHappiness;
    if (amount && typeof noteMood === "function") noteMood(this, cause, newHappiness - oldHappiness, amount);
  }

  // Separated by a cage, enclosure or can (one of them is shut in one, and
  // they aren't in the same one)
  isBehindBarrierFrom(other) {
    return (
      this.currentCage !== other.currentCage &&
      (this.currentCage instanceof Cage || other.currentCage instanceof Cage)
    );
  }

  // A mare who can't reach her hungry foal through a cage to nurse it
  failToNurseBehindBarrier(foal) {
    const now =
      typeof performance !== "undefined" ? performance.now() / 1000 : 0;
    if (now < (this.nextBarrierNurseTime || 0)) return;
    this.nextBarrierNurseTime = now + BARRIER_NURSE_COOLDOWN;

    this.barrierHurt(HAPPINESS_PENALTY_BARRIER_NURSE, "Can't feed her foals");
    if (this.happiness > WAN_DIE_THRESHOLD && !this.tooYoungToSpeak()) {
      this.expressionOverride = "CRYING_SHOCKED";
      this.expressionOverrideTimer = 3.0;
      this.speak(getDialogue(["GIVE_MILKIES", "BEHIND_BARRIER"], this, foal));
    }
  }

  // A mum kept from her foals by bars: it hits her hard, but never so hard
  // she gives up ("looping": WAN_DIE_THRESHOLD) - Brady's rule
  barrierHurt(amount, cause) {
    const floor = WAN_DIE_THRESHOLD + BARRIER_HAPPINESS_FLOOR;
    if (this.happiness <= floor) return;
    this.changeHappiness(Math.max(amount, floor - this.happiness), cause);
  }

  igniteFire() {
    if (!this.isAlive || this.isOnFire) return;
    this.isOnFire = true;
    this.fireElapsed = 0;
    this.fireScreamTimer = 0;
    this.fireSmokeTimer = 0;
    this.isFrantic = true;
  }

  // Put out by the sprinkler or spray bottle
  extinguishFire() {
    if (!this.isOnFire) return;
    this.isOnFire = false;
    this.fireElapsed = 0;
    if (this.isAlive) this.isFrantic = this.calculateIsFrantic();
    if (typeof poofs !== "undefined") {
      poofs.push(new Poof(this.x, this.y - 20 * this.scale, this.scene));
    }
  }

  // Burning: screams, panics, smokes, spreads to fluffies close by in the
  // same cage, and dies FIRE_DEATH_TIME seconds after catching fire
  updateFire(dt) {
    if (!this.isOnFire) return;
    // Soaked (a bath, the sprinkler, rain: WetFur.js) puts it out
    if ((this.wet || 0) > 0.3) {
      this.extinguishFire();
      return;
    }
    this.fireElapsed += dt;
    this.health = Math.min(
      this.health,
      100 * (1 - this.fireElapsed / FIRE_DEATH_TIME),
    );
    if (this.fireElapsed >= FIRE_DEATH_TIME) {
      this.die("fire", "Burned to death");
      return;
    }

    this.isFrantic = true;
    this.expressionOverride = "CRYING_SHOCKED";
    this.expressionOverrideTimer = Math.max(this.expressionOverrideTimer, 0.5);

    this.fireScreamTimer -= dt;
    if (this.fireScreamTimer <= 0) {
      this.fireScreamTimer = 1.2 + Math.random() * 0.8;
      const key = this.tooYoungToSpeak() ? "BABY" : "DEFAULT";
      this.speak(getDialogue(["BURNING", key], this), true, true);
    }

    // Run about in a panic
    if (
      !this.isMovingOrRunning() &&
      !this.isDragging &&
      !this.placedOn &&
      this.avoidStateChangerActions()
    ) {
      this.positioning.pickNewTarget();
      this.initBehavior(canRun(this) ? "RUNNING" : "MOVING");
    }

    // Orange fire puffs and grey smoke rising off the body
    if (typeof poofs !== "undefined") {
      const e = this.positioning.getExtentsForCage();
      const puffAt = (color) =>
        new SmokePoof(
          e.left + Math.random() * (e.right - e.left),
          e.top + (e.bottom - e.top) * (0.2 + Math.random() * 0.4),
          this.scene,
          color,
        );
      this.fireEmberTimer -= dt;
      if (this.fireEmberTimer <= 0) {
        this.fireEmberTimer = FIRE_PARTICLE_INTERVAL;
        poofs.push(puffAt(FIRE_PARTICLE_COLOR));
      }
      this.fireSmokeTimer -= dt;
      if (this.fireSmokeTimer <= 0) {
        this.fireSmokeTimer = SMOKE_PARTICLE_FREQUENCY;
        poofs.push(puffAt(CATTLE_PROD_SMOKE_COLOR));
      }
    }

    // Spread to fluffies close by in the same cage (or both outside one)
    const spreadChance = 1 - Math.exp(-FIRE_SPREAD_RATE * dt);
    for (const f of fluffies) {
      if (
        f === this ||
        !f.isAlive ||
        f.isOnFire ||
        f.scene !== this.scene ||
        f.currentCage !== this.currentCage
      )
        continue;
      if (
        Math.hypot(f.x - this.x, f.y - this.y) < FIRE_SPREAD_DISTANCE &&
        Math.random() < spreadChance
      ) {
        f.igniteFire();
      }
    }
  }

  // The diaper it's wearing (our own Diapers.js: f.diaper { fill }), or null
  getDiaper() {
    return typeof wearsDiaper === "function" && wearsDiaper(this) ? this.diaper : null;
  }

  hasUsedDiaper() {
    return !!this.getDiaper() && (typeof diaperFill === "function" ? diaperFill(this) : this.diaper.fill || 0) > 0;
  }

  // Catches excretion in a diaper if one is worn and not yet full.
  // Returns true if it was caught (so no puddle is made).
  absorbIntoDiaper(amount, isPoop = true) {
    return typeof diaperCatches === "function" && !!this.getDiaper() && diaperCatches(this, isPoop, amount);
  }

  // A stallion's special huggies blocked by a diaper (his own, or his
  // partner's when lineKey is "PARTNER_DIAPER")
  refuseMatingInDiaper(lineKey = "CANT_MATE") {
    this.specialHuggiesCooldown = Math.max(
      this.specialHuggiesCooldown || 0,
      DIAPER_MATE_LINE_COOLDOWN,
    );
    if (this.happiness > WAN_DIE_THRESHOLD && !this.tooYoungToSpeak()) {
      this.expressionOverride = "MISERABLE";
      this.expressionOverrideTimer = 3.0;
      this.speak(getDialogue(["DIAPER", lineKey], this));
    }
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
    if (this.happiness === WAN_DIE_THRESHOLD) return false;
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

  // Flies when thrown (ThrowTool.js): both wings, and no wing jacket
  hasBothWings() {
    if (this.type !== "pegasus" && this.type !== "alicorn") return false;
    if (!this.limbs || !this.limbs.leftWing || !this.limbs.rightWing) return false;
    if (this.accessories && this.accessories.torso && this.accessories.torso.id === "wingjacket") return false;
    return true;
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
    if (this._blockLift && typeof endBlockLift === "function") endBlockLift(this, false);
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
    for (const obj of objectsOfType(FluffTV)) {
      if (
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
          // (in front of it, or watching from a cage)
          if (obj.channel !== "OFF" && (this.y > obj.y || obj.currentCage != null)) {
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
        if (isFocusingState(this.currentStateKey)) {
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

    // Racked fluffies can't choose to watch (their brain doesn't run
    // while strapped down), so they watch any TV in view
    if (
      this.placedOn &&
      this.hunger >= 0.5 &&
      !this.isScared &&
      !this.isFrantic
    ) {
      const tv = this.findNearbyTV();
      if (tv) this.startWatchingTV(tv);
    }
  }

  // Fluffies that can't sit up (racked, too weak or missing legs) watch
  // lying down
  getTVFocusState() {
    return this.isCrawling ? "FOCUSING_LYING" : "FOCUSING";
  }

  startWatchingTV(tv) {
    if (!this.placedOn) this.facingRight = tv.x > this.x;
    this.tvFocus = { tv: tv, timer: 30 + Math.random() * 30 };
    this.initBehavior(this.getTVFocusState());
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
      // (out of breath: only a walk - Stamina.js)
      this.speed = (typeof runWindedSpeed === "function" && runWindedSpeed(this)) || 175;
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
    // Close to giving birth, or just after: she hardly moves (Pregnancy.js)
    if (typeof mareRestSpeed === "function") this.speed *= mareRestSpeed(this);

    // Elderly fluffies are slower (Aging.js)
    if (typeof isElderly === "function" && isElderly(this)) {
      this.speed *= 0.75;
    }
    // Chubby and fat fluffies are slower (Diet.js)
    if (typeof weightSpeedMultiplier === "function") this.speed *= weightSpeedMultiplier(this);
    // The wobbles from eating fluffy (BadMeat.js)
    if (typeof wobbleSpeed === "function") this.speed *= wobbleSpeed(this);
    // Shaky legs, from birth (Defects.js)
    if (typeof defectSpeed === "function") this.speed *= defectSpeed(this);
    // Taking it easy after surgery, or with a fever (Bandages.js)
    if (typeof recoverySpeed === "function") this.speed *= recoverySpeed(this);
    // Waddling in a diaper (Diapers.js); a burn healing (Handling.js)
    if (typeof diaperSpeed === "function") this.speed *= diaperSpeed(this);
    if (typeof burnSpeed === "function") this.speed *= burnSpeed(this);
    if (typeof listlessSpeed === "function") this.speed *= listlessSpeed(this); // (a room breaking down: Comfort.js)
    if (typeof frozenSpeed === "function") this.speed *= frozenSpeed(this); // (frozen to the ground: Wild.js)
    if (this.limbs === undefined) {
      return;
    }
    let limbsMissing = this.getLimbsMissing();
    this.speed /= 1 + limbsMissing;
    // A mangled leg: half as bad as none (Injuries.js)
    if (typeof mangledLegCount === "function") this.speed /= 1 + 0.5 * mangledLegCount(this);
    if (this.isSensitive() && !(typeof cantCrawlYet === "function" && cantCrawlYet(this))) {
      this.speed /= 4; // (a sensitive foal wriggles at a newborn's pace: Carrying.js)
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
      (this.accessories.mouth.id === "mouthgag" || this.accessories.mouth.id === "muzzle")
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
    // Premature babies start smaller and catch up as they grow
    this.scale *= lerp(this.prematureGrowth == null ? 1 : this.prematureGrowth, 1.0, this.growth);
    // A runt stays small (Runts.js)
    if (this.runt && typeof runtScale === "function") this.scale *= runtScale(this);
    // Born wild, generations on: smaller (Wild.js)
    if (this.wildGen && typeof wildGenScale === "function") this.scale *= wildGenScale(this);
    // A microfluff is tiny (Micro.js)
    if (this.micro && typeof microScale === "function") {
      this.scale *= microScale(this);
      if (typeof MICRO_MIN_SCALE === "number") this.scale = Math.max(MICRO_MIN_SCALE, this.scale);
    }
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
      // a mangled leg won't take its weight: it drags itself (Injuries.js)
      (typeof mangledLegCount === "function" && mangledLegCount(this) > 0) ||
      drugOverdoseCrawling ||
      (this.isBeingTased && this.isBeingTased()) ||
      // gasping for air in a culling cage (Cage.js)
      (this.currentCage instanceof Cage && this.currentCage.suffocatesOccupants());
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
    // (the bite's puff is in performAttack now: nothing through cage bars)
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
    // Up in the air (ThrowTool.js): sorted by the spot below it, where its shadow is
    if ((this.heldWithThrowTool || this.isFallingFromThrow) && typeof this.throwShadowY === "number" && !isNaN(this.throwShadowY)) {
      return this.throwShadowY;
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
        this.positioning.canReachBlock(b) &&
        !b.getStackedAbove() &&
        !b.isDragging &&
        b.isStill(),
    );
    if (targetBlock) {
      this.blockTarget = true;
      this.initBehavior("MOVING");
      // Beside it, on the side it's coming from (not on top of it: it turned
      // round and round trying to reach the middle - playtest)
      const side = this.x <= targetBlock.x ? -1 : 1;
      this.setTargetPosition(targetBlock.x + side * BLOCK_STAND_OFF, targetBlock.currentCage ? this.y : targetBlock.y);
      this.constrainTargetToCage();
    } else {
      // find block stack to knock over
      targetBlock = sceneBlocks.find(
        (b) =>
          !b.heldBy &&
          !b.stackedOn &&
          !fluffies.some((f) => f.blockTarget && f.targetX === b.x) &&
          this.positioning.canReachBlock(b) &&
          !b.isDragging &&
          b.isStill(),
      );
      if (targetBlock) {
        this.blockTowerKnockOverTarget = true;
        this.initBehavior("MOVING");
        this.setTargetPosition(targetBlock.x, targetBlock.currentCage ? this.y : targetBlock.y);
        this.constrainTargetToCage();
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
        // (an incubator's floor is the top of its base: Incubator.js)
        const floor = typeof this.currentCage.floorOffset === "function" ? this.currentCage.floorOffset() : CAGE_FLOOR_OFFSET;
        let y = b.bottom - localBottom - floor;
        // (never far from where it'd stand: with long steps - skipping
        // ahead, Sleep.js - its pose could feed back on itself and send it
        // flying off, a little further each step, until the game froze)
        const st = this.positioning._standCache;
        if (st && isFinite(st.b)) {
          const yStand = b.bottom - st.b - floor;
          const slack = 60 * (this.scale || 0.5) + 10;
          y = Math.max(yStand - slack, Math.min(yStand + slack, y));
        }
        if (isFinite(y)) this.y = y;
        this.x = clamp(this.x, b.left - localLeft, b.right - localRight);
      }
    }
  }

  updateLayout() {
    this.renderer.updateLayout();
  }

  attemptLockIntoTable(table) {
    // Its own place for it (the hook: Handling.js)
    if (typeof table.lockPosition === "function") {
      table.securedFluffy = this;
      table.lockPosition(this);
      return;
    }
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

  // Landing hard after being thrown (HorsePhysics.updateThrowFall): hurts
  // in proportion to the speed. Returns the damage.
  handleThrowImpact(speed) {
    if (typeof speed !== "number" || isNaN(speed)) return;
    // A pegasus's wings break the fall (Flight.js): it takes a harder landing to hurt it, and hurts less
    const minSpeed = typeof wingImpactThreshold === "function" ? wingImpactThreshold(this, THROW_IMPACT_MIN_SPEED) : THROW_IMPACT_MIN_SPEED;
    // (a microfluff breaks from lower down, and worse: Micro.js)
    const micro = typeof microImpactFactor === "function" ? microImpactFactor(this) : 1;
    if (speed * Math.sqrt(micro) < minSpeed) return;

    const damage = speed * THROW_IMPACT_DAMAGE_FACTOR * (typeof wingDamageFactor === "function" ? wingDamageFactor(this) : 1) * micro;
    this.health = Math.max(0, this.health - damage);

    const vol = Math.min(1.0, Math.max(0.4, speed / 1500));
    const pitch = Math.max(
      0.7,
      1.2 - (Math.abs(this.scale) || 0.5) * 0.4 * (1 + Math.random()),
    );
    playSound("thud", vol, pitch);

    this.expressionOverride = "CRYING_SHOCKED";
    this.expressionOverrideTimer = 2.0;

    const line = getDialogue(
      ["THROW_IMPACT", this.tooYoungToSpeak() ? "CHIRPY" : "DEFAULT"],
      this,
    );
    const s = Math.abs(this.scale * Math.min(damage, 100));
    if (this.isAlive) {
      addPointToPuddle(this.scene, this.x, this.y, "blood", s / 200, (3 * s) / 200, 0.05);
    }
    if (this.health <= 0) {
      this.die("throw", "Killed by a hard landing when thrown");
    } else if (this.isAlive) {
      // It knows who threw it, and so do the ones watching (Memory.js)
      if (typeof notifyViolence === "function") notifyViolence(this, false, "throw");
      // A pregnant mare may go into labour early (Premature.js)
      if (typeof maybeEarlyLabourFromFall === "function") maybeEarlyLabourFromFall(this, damage);
      // Healing from surgery: a setback (Bandages.js)
      if (typeof recoverySetback === "function") recoverySetback(this);
      // Something may be broken for good (Injuries.js)
      if (typeof injureFromThrow === "function") injureFromThrow(this, speed, minSpeed);
      this.speak(line, true, true);
      this.initBehavior("FLUFFY_KNOCKED_DOWN");
    }
    return damage;
  }

  // Let go of while held up with the throw tool: it falls, or flies off
  // with the mouse's speed (HorsePhysics.updateThrowFall), and the tool
  // goes back in your hand
  _dropFromThrowTool() {
    this.heldWithThrowTool = false;
    this.wasHeldHigh = false;
    this.isDragging = false;
    this.despawnProtectionTimer = 10;
    if (!this.isAlive) {
      this.layout.globalRotation = 0;
      this.ragdollRotation = 0;
      this.layout.torso.angle = 0;
    }
    if (this.throwTool) {
      this.throwTool.heldHorse = null;
      this.throwTool.isDragging = true;
      this.throwTool.dragOffset = { x: 0, y: 0 };
      this.throwTool.scene = currentScene;
      this.throwTool.x = mouse.x;
      this.throwTool.y = mouse.y;
      if (!objects.includes(this.throwTool)) objects.push(this.throwTool);
      isGlobalDragging = true;
    }
    const mouseVel = getMouseVelocity();
    this.throwFallVx = mouseVel.vx;
    this.throwFallVy = mouseVel.vy;

    const isLifted = typeof this.throwStartY === "number" && this.y < this.throwStartY - 0.5;
    const hasUpwardVelocity = this.throwFallVy < -10;
    const hasDownwardVelocity = this.throwFallVy > THROW_IMPACT_MIN_SPEED;
    const hasHorizontalVelocity = Math.abs(this.throwFallVx) > 10;

    if (
      typeof this.throwStartY === "number" &&
      (isLifted || hasUpwardVelocity || hasDownwardVelocity || hasHorizontalVelocity)
    ) {
      this.isFallingFromThrow = true;
      if (this.isAlive && (isLifted || hasUpwardVelocity)) {
        const isWinged = this.hasBothWings();
        const isChirpy = this.tooYoungToSpeak();
        this.expressionOverride = isWinged ? "GOOD_UPSIES" : "CRYING_SHOCKED";
        this.expressionOverrideTimer = 2.0;
        if (this.happiness > WAN_DIE_THRESHOLD) {
          const dropLine = getDialogue(["THROW_DROPPED", isChirpy ? "CHIRPY" : isWinged ? "WINGED" : "DEFAULT"], this);
          if (dropLine) {
            this.speak(dropLine, false, isChirpy);
            if (this.speech) this.speech.nextTime = 1.0 + Math.random();
          }
        }
      }
    } else {
      this.isFallingFromThrow = false;
      this.throwFallVx = 0;
      this.throwFallVy = 0;
      this.vx = 0;
      this.vy = 0;
      this.throwStartY = null;
      this.throwShadowY = null;
      if (this.isAlive) this.initBehavior("IDLE");
    }
  }

  onDrop() {
    if (this.heldWithThrowTool) {
      this._dropFromThrowTool();
      return;
    }
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

    // Something else that takes it (the hook, the hot plate: Handling.js)
    if (typeof objects !== "undefined") {
      for (const o of objects) {
        if (!this.currentCage && typeof o.catchesFluffy === "function" && o.scene === this.scene && o.catchesFluffy(this)) {
          if (o.holdsFluffy) {
            this.placedOn = o;
            this.attemptLockIntoTable(o);
          }
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
          !board.securedFluffy &&
          (typeof board.accepts !== "function" || board.accepts(this)) // (the milk stand: grown mares only)
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
    if (this.notForSale) return false; // (kept: NotForSale.js)
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

    // (higher while held up with the throw tool)
    const groundYMin = this.physics.getGroundYMin();

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

    // Flying through the air after a throw: nothing else until it lands
    if (this.physics.updateThrowFall(dt)) {
      this.updateLayout();
      return;
    }

    if (this.isAlive) {
      // (speed-up) worked out a few times a second, or when what it's doing
      // changes - not every step
      this._speedTimer = (this._speedTimer || 0) - dt;
      if (this._speedTimer <= 0 || this._speedFor !== this.currentStateKey) {
        this._speedTimer = 0.25;
        this._speedFor = this.currentStateKey;
        this.updateSpeed();
      }
      if (this.ragdollRotation !== 0 && !this.isDragging) {
        this.ragdollRotation = lerpAngle(this.ragdollRotation, 0, smoothStep(10, dt));
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
        } else if (this.isInLabor() && this.currentStateKey !== "LYING") {
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
      if (this.isCrawling && this.currentStateKey === "FOCUSING") {
        this.currentStateKey = "FOCUSING_LYING";
      }

      // Growing up
      this._updateGrowingUp(dt);
      this.ballCooldown = Math.max(0, (this.ballCooldown || 0) - dt);

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

    const lerpFactor = smoothStep(5.0, dt); // (stable at any step: Sleep.js skips in big ones)
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
    const lerpFactor = smoothStep(5.0, dt); // (stable at any step: Sleep.js skips in big ones)
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

  drawShadow(ctx) {
    if (this.renderer) this.renderer.drawShadow(ctx);
  }

  // Splashing and bubbles while it goes under (the river)
  drowningSplashes() {
    if (this.drowningTimer > 1 && this.isAlive && this.happiness !== WAN_DIE_THRESHOLD) {
      this.soundTimer = (this.soundTimer || 0) - (0.025 - this.growth / 100);
      if (this.soundTimer <= 0) {
        this.soundTimer = 0.35;
        playSound("splashing", Math.max(0.1, this.growth / 5), 1.6 - 0.6 * this.growth + Math.random() * 0.2);
      }
      this.bubbleTimer = (this.bubbleTimer || 0) - 0.016;
      if (this.bubbleTimer <= 0) {
        this.bubbleTimer = 0.01;
        if (this.scene) {
          poofs.push(
            new Poof(
              this.x + ((this.facingRight ? 1 : -1.5) + Math.random() * 0.5) * Math.max(20, 40 * this.growth),
              this.y + Math.random() * 10,
              this.scene,
              ["#ffffff59", "#1e90ff"][Math.floor(Math.random() * 2)],
              false,
              Math.max(0.2, this.growth * 0.5),
            ),
          );
        }
      }
    }
  }

  draw(ctx, clip = null) {
    // Covered with leaves by its herd: just the mound (Wild.js)
    if (this.buried && !this.isAlive && typeof drawLeafMound === "function") {
      drawLeafMound(ctx, this);
      return;
    }
    if (this._layoutDirty || !this.layout) {
      this._layoutDirty = false;
      this.updateLayout();
    }
    // Going under: bobs half under, then sinks (drowningTimer runs 1 to 5)
    if (!clip && this.drowningTimer > 0) {
      const drowningEffect = Math.max(0, Math.min(1.0, (this.drowningTimer - 1.0) / 4.0));
      let progress = 0;
      if (drowningEffect < 0.1) {
        progress = (drowningEffect / 0.1) * 0.5;
      } else if (drowningEffect < 0.9) {
        progress = 0.5;
        this.drowningSplashes();
      } else {
        progress = 0.5 + ((drowningEffect - 0.9) / 0.1) * 0.6;
      }
      clip = { top: 1.0 - progress };
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
    if (this.wet > 0.05 && typeof drawWetDrips === "function") drawWetDrips(ctx, this); // (WetFur.js)
    if (shaking) ctx.restore();
    if (this.placedOn instanceof ImmobilizationBoard) {
      this.placedOn.renderStrap(ctx, this);
    }
  }

  drawSpeechBubble(ctx) {
    this.renderer.drawSpeechBubble(ctx);
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
    let horse;
    horseBeingLoaded = true;
    try {
      horse = new Horse(
        data.growth,
        data.motherId,
        data.scene,
        "earthy", // Placeholder, will be overriden by genes
        data.genes,
        null,
        null,
        data.gender,
      );
    } finally {
      horseBeingLoaded = false;
    }

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
    horse.smartyKind = data.smartyKind; // (setting personalities clears it)
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
    // (a save from when pregnancy was longer: no more than a whole one left)
    if (typeof horse.pregnancyTimer === "number" && horse.pregnancyTimer > pregnancyDuration) horse.pregnancyTimer = pregnancyDuration;
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
    horse.isOnFire = !!data.isOnFire && horse.isAlive;
    horse.fireElapsed = data.fireElapsed || 0;
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
    horse.updateGrowthStats(); // (size, including a premature baby's smallness; and crawling)

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
