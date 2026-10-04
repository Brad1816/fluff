// ---------------------------------------------------------------------------
// Fluffies with each other: attacks, friendships and hugs.
// (Part of the Horse class, split out of Horse.js: addHorseMethods adds
// these to every fluffy. Loaded right after Horse.js.)
// ---------------------------------------------------------------------------

const MUM_LASH_REST = 12; // seconds between a mum's blows at her own rejected foal
const FIGHT_NOTE_GAP = 2 * (typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50);

// Is this a new fight (not more blows in the one going on)?
function _newFight(attacker, target) {
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  if (!attacker._fightsWith || typeof attacker._fightsWith !== "object") attacker._fightsWith = {};
  const last = attacker._fightsWith[target.id];
  attacker._fightsWith[target.id] = now;
  const theirs = target._fightsWith && target._fightsWith[attacker.id];
  if (typeof last === "number" && now - last >= 0 && now - last < FIGHT_NOTE_GAP) return false;
  if (typeof theirs === "number" && now - theirs >= 0 && now - theirs < FIGHT_NOTE_GAP) return false; // (they started it, just now)
  return true;
}

addHorseMethods({
  wasAttackedBy(attacker) {
    if (!this.isAlive || !attacker || !attacker.isAlive) return;

    // An alicorn hurting someone scares the ones still getting used to them (AlicornAcceptance.js)
    if (typeof noteAlicornAttack === "function") noteAlicornAttack(attacker, this);
    this.lastAttackerId = attacker.id;
    this.lastAttackTimer = 5.0; // 5 seconds window for "Killed by"

    const isMaleOnMaleMatingFight =
      attacker.gender === "male" &&
      this.gender === "male" &&
      !isSexuallyAttractedTo(this, attacker) &&
      (attacker.chaseReason === "MATING" ||
        (typeof attacker.isUnderAphrodisiac === "function" && attacker.isUnderAphrodisiac()));

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
      (typeof WAN_DIE_THRESHOLD !== "undefined" && this.happiness <= WAN_DIE_THRESHOLD)
    )
      return;

    // 60% chance to retaliate
    if (Math.random() < 0.6) {
      this.counterattack.fluffy = attacker;
      this.counterattack.timer = 0.5 + Math.random() * 0.5; // 0.5s to 1.0s
    }
  },

  performAttack(target, intent = "SMARTY_VIOLENCE") {
    if (!target || !target.isAlive) return;
    // Can't reach them through a fence
    if (typeof canFluffiesReachEachOther === "function" && !canFluffiesReachEachOther(this, target)) return;

    // (the target reacts once, below: reacting twice made hitting back far
    // more likely than the 60% it's meant to be, and fights ran on)
    this._lastAttackAt = typeof timePlayed === "number" ? timePlayed : 0; // (Care.js: scold for fighting)
    // One fight is one fight: the story (and the room's feel, the victim's
    // dreams, how timid it grows) hears of it once per attacker and victim
    // per FIGHT_NOTE_GAP, and hitting back is part of the same fight
    if (intent !== "RETALIATION" && typeof recordStory === "function" && _newFight(this, target)) recordStory("attacked", target);
    if (intent !== "RETALIATION" && typeof onSpecialFriendHarmed === "function") onSpecialFriendHarmed(target, this); // (SpecialFriends.js)
    // A Smarty someone starts on is provoked; hitting back doesn't count (SmartyMood.js)
    if (target.isSmarty() && intent !== "RETALIATION" && typeof noteSmartyProvoked === "function") noteSmartyProvoked(target, this);

    // Face the target
    this.facingRight = target.x > this.x;
    target.facingRight = target.x < this.x;

    // Choose attack: STAB or STOMP
    const arr = [];
    const isGagged = this.accessories && this.accessories.mouth && this.accessories.mouth.id === "mouthgag";
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
    // A grown fluffy hurting a foal (a mum her own: a slip) (Care.js)
    if (typeof noteFoalAttacked === "function") noteFoalAttacked(this, target, intent);
    // ...and a toughie of the foal's herd goes for them (HerdJobs.js)
    if (typeof noteHerdFoalAttacked === "function") noteHerdFoalAttacked(this, target, intent);
    if (typeof noteSharedFight === "function") noteSharedFight(this, target); // a big fight they'll remember (SharedMemories.js)
    if (intent === "BULLY") {
      // A Smarty's shove (SmartyMood.js): stings, never kills
      target.health = Math.min(target.health, Math.max(SMARTY_BULLY_FLOOR, target.health - SMARTY_BULLY_DAMAGE));
    } else {
      target.health -= 10 * (typeof microBlowFactor === "function" ? microBlowFactor(target) : 1); // (a microfluff: Micro.js)
    }
    // Knocked about while it heals: a setback (Bandages.js)
    if (typeof recoverySetback === "function") recoverySetback(target);
    if (target.health <= 0) {
      const attackerName =
        typeof fluffyDisplayName === "function" ? fluffyDisplayName(this) : fluffyNames[this.id] || "Fluffy";
      target.die(null, `Killed by ${attackerName}`);
    } else {
      target.initBehavior("FLUFFY_KNOCKED_DOWN");
      target.setShock(1.0);
    }

    if (!target.tooYoungToSpeak()) {
      if (intent === "SMARTY_VIOLENCE") {
        target.speak(getDialogue(["HURT", "SMARTY"], target));
      } else if (intent === "RETALIATION" || intent === "GRUDGE" || intent === "TERRITORY" || intent === "WAR" || intent === "CROWDED" || intent === "BULLY") {
        target.speak(getDialogue(["HURT"], this));
      } else {
        target.speak(getDialogue(["HURT", "ALICORN_BABY"], target));
      }
    }

    // Cooldown for the attacker so they don't spam attack
    this.attackCooldown = 1.5;
    // A mum turning on her own foal (its colour, an alicorn) lashes out now
    // and then rather than every second and a half: still deadly if nobody
    // steps in, but there's time to see it (Today warns) and part them
    if (target.motherId === this.id && (intent === "COLOR" || intent === false)) this.attackCooldown = MUM_LASH_REST;
    if (this.chaseReason !== "MATING" && Math.random() < 0.25) {
      this.chaseTarget = null;
    }
    // (a shove, or a Smarty that isn't in a foul mood, doesn't draw blood)
    const mild = intent === "BULLY" || (intent === "SMARTY_VIOLENCE" && this.isSmarty() && typeof smartyInBadMood === "function" && !smartyInBadMood(this));
    if (!mild && Math.random() < 0.15) {
      target.bleedingTimer = 5;
      // (and it may scar, Scars.js)
      if (typeof scarFromFight === "function") scarFromFight(target, this, behavior);
    }
    target.attackCooldown = 5.0;
    target.chaseTarget = null;
  },

  proposeFriendship(other) {
    if (!other || !other.isAlive || this.speech.timer > 0) return;
    this.speak(getDialogue("PROPOSE_FRIEND", this));

    if (
      other.canSee() &&
      this.genetics &&
      Math.random() < colourShunChance(other, this)
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
    } else if (other.canHear() && typeof refusesFriendshipFrom === "function" && refusesFriendshipFrom(other, this)) {
      // Holds a grudge (Bonds.js)
      if (!other.tooYoungToSpeak()) other.speak(getDialogue(["BOND", "REFUSE"], other, this));
      other.expressionOverride = "ANGRY_PUFFED";
      other.expressionOverrideTimer = 3.0;
    } else if (other.canHear()) {
      other.acceptFriendship(this);
    }
  },

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
  },

  attemptHugging(other) {
    if (typeof canFluffiesReachEachOther === "function" && other && !canFluffiesReachEachOther(this, other)) return;
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

    this.changeHappiness(0.075, "Hugs");
    other.changeHappiness(0.075, "Hugs");
  },
});
