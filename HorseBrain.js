class Desire {
  constructor(name) {
    this.name = name;
  }

  // Returns a score from 0 to 100
  evaluate(horse) {
    return 0;
  }

  // Executes the behavior if chosen. Returns true if successful, false if it couldn't be executed.
  execute(horse) {
    return false;
  }
}

// When two desires score the same, the one higher up this list wins
const DESIRE_TIEBREAK = new Map(
  [
    "GrinderFear",
    "AlicornFear",
    "FearedFluffyFear",
    "SprinklerFear",
    "CarFear",
    "CorpseReaction",
    "BloodReaction",
    "SmartyChaseFear",
    "SeekSmartySpecialHuggies",
    "Mate",
    "SeekSpecialFriend",
    "ProposeSpecialFriendship",
    "SmartyCombat",
    "ComplainAboutPuddle",
    "ProposeFriendship",
    "BabbleToFriends",
    "RandomBabble",
    "BystanderInterruptMating",
    "Eat",
    "UseLitterbox",
    "CareForBabies",
    "FeedHungryFoal",
    "Sleep",
    "PlayWithBlocks",
    "PlayWithBall",
    "RunToTV",
    "WatchTV",
    "Wander",
    "Sit",
    "LieDown"
  ].map((name, i) => [name, i]),
);
const _APHRO_DESIRES = new Set(["SeekSmartySpecialHuggies", "GrinderFear", "CarFear", "Wander"]);
function _desireRank(name) {
  const i = DESIRE_TIEBREAK.get(name);
  return i === undefined ? 999 : i;
}

// More desires from other files: classes pushed here are given to every fluffy
const EXTRA_DESIRES = [];
// Other files can rule a desire out for a fluffy for now: (horse, name) =>
// true to skip it (ExterminatorFerals.js: a herd that's seen you doesn't mate)
const DESIRE_VETOES = [];

class HorseBrain {
  constructor(horse) {
    this.horse = horse;
    this.desires = [];
    this.currentDesire = null;

  }

  addDesire(desire) {
    this.desires.push(desire);
  }

  think() {
    if (!this.horse.isAlive) return;
    if (!this.horse.avoidStateChangerActions()) return;
    if (this.horse.placedOn) return;
    if (this.horse.isInLabor()) return;

    // Score all desires (only those that want something are kept: sorting
    // fewer is faster)
    const aphro = this.horse.isUnderAphrodisiac();
    let evaluatedDesires = [];
    const vetoes = DESIRE_VETOES.length ? DESIRE_VETOES : null;
    for (const desire of this.desires) {
      if (vetoes && vetoes.some((v) => v(this.horse, desire.name))) continue;
      let score = desire.evaluate(this.horse);
      if (!(score > 0)) continue;
      // Aphrodisiac override: pause most other desires
      if (aphro && !_APHRO_DESIRES.has(desire.name)) continue;
      // Personality traits make some desires stronger or weaker (Traits.js)
      if (typeof traitDesireMultiplier === "function") {
        score *= traitDesireMultiplier(this.horse, desire.name);
      }
      // ...and so does the feel of the room (Climate.js)
      if (score > 0 && typeof climateDesireMultiplier === "function") {
        score *= climateDesireMultiplier(this.horse, desire.name);
      }

      // Hysteresis
      if (this.currentDesire === desire && score > 0) {
        score *= 1.2; // 20% stickiness bonus
      }
      if (score > 0) evaluatedDesires.push({ desire, score });
    }
    if (aphro && this.currentDesire && !_APHRO_DESIRES.has(this.currentDesire.name)) this.currentDesire = null;

    // Sort desires by score (descending), then by tiebreaker list (ascending index)
    evaluatedDesires.sort((a, b) => (b.score !== a.score ? b.score - a.score : _desireRank(a.desire.name) - _desireRank(b.desire.name)));

    // Try to execute the desires in order until one succeeds
    let executed = false;

    for (let item of evaluatedDesires) {
      if (item.score <= 0) continue;
      if (item.desire.execute(this.horse)) {
        this.currentDesire = item.desire;
        this.horse.lastDesire = {
          desire: item.desire.name,
          value: item.score,
        };
        executed = true;
        break;
      }
    }

    if (!executed) {
      this.currentDesire = null;
      if (evaluatedDesires.length > 0 && evaluatedDesires[0].score > 0) {
        this.horse.lastDesire = {
          desire: evaluatedDesires[0].desire.name,
          value: evaluatedDesires[0].score,
        };
      }
    }
  }

  evaluateLastDesire() {
    const wasAlive = this.horse.isAlive;
    this.horse.isAlive = true;
    let name = "None";
    let score = 0;
    if (this.currentDesire) {
      if (
        this.horse.isUnderAphrodisiac() &&
        this.currentDesire.name !== "SeekSmartySpecialHuggies" &&
        this.currentDesire.name !== "GrinderFear" &&
        this.currentDesire.name !== "CarFear"
      ) {
        name = "None";
        score = 0;
      } else {
        name = this.currentDesire.name;
        score = this.currentDesire.evaluate(this.horse);
      }
    } else {
      let bestScore = -1;
      let bestDesire = null;
      for (const desire of this.desires) {
        if (
          this.horse.isUnderAphrodisiac() &&
          desire.name !== "SeekSmartySpecialHuggies" &&
          desire.name !== "GrinderFear" &&
          desire.name !== "CarFear"
        ) {
          continue;
        }
        const s = desire.evaluate(this.horse);
        if (s > bestScore) {
          bestScore = s;
          bestDesire = desire;
        }
      }
      if (bestDesire && bestScore > 0) {
        name = bestDesire.name;
        score = bestScore;
      }
    }
    this.horse.isAlive = wasAlive;
    return { desire: name, name: name, value: score, score: score };
  }
}

// =======================
// Fear Desires
// =======================

class GrinderFearDesire extends Desire {
  constructor() {
    super("GrinderFear");
  }
  evaluate(horse) {
    if (
      !horse.isAlive ||
      horse.happiness <= WAN_DIE_THRESHOLD ||
      horse.isScared ||
      !horse.avoidStateChangerActions()
    )
      return 0;
    if (horse.hunger <= 0.3 || (!horse.canSee() && !horse.canHear())) return 0;
    if (
      horse.isDragging ||
      horse.placedOn ||
      horse.currentStateKey === "SLEEPING"
    )
      return 0;
    if (horse.isInLabor()) return 0;

    const target = horse.positioning.findScaryGrinder();
    if (target) {
      this.fearTarget = target;
      return 100;
    }
    return 0;
  }
  execute(horse) {
    horse.dropHeldBlock();
    return horse.actionHandler.executeRunawayFear(this.fearTarget, [
      "FEAR",
      "GRINDER",
    ]);
  }
}

class AlicornFearDesire extends Desire {
  constructor() {
    super("AlicornFear");
  }
  evaluate(horse) {
    if (
      !horse.isAlive ||
      horse.happiness <= WAN_DIE_THRESHOLD ||
      horse.isScared ||
      !horse.avoidStateChangerActions()
    )
      return 0;
    if (horse.hunger <= 0.3 || !horse.canSee() || horse.tolerantOfAlicorns())
      return 0;
    if (
      horse.isDragging ||
      horse.placedOn ||
      horse.currentStateKey === "SLEEPING"
    )
      return 0;
    if (horse.isInLabor()) return 0;

    const target = horse.positioning.findScaryAlicorn();
    if (target) {
      // A brave one that's already seen it off leaves it be (AlicornAcceptance.js)
      const stance = typeof alicornStance === "function" ? alicornStance(horse, target) : "flee";
      if (stance === "ignore") return 0;
      this.fearTarget = target;
      return stance === "avoid" ? 60 : 100; // (steering clear isn't panic)
    }
    return 0;
  }
  execute(horse) {
    horse.dropHeldBlock();
    return horse.actionHandler.executeAlicornFear(this.fearTarget);
  }
}

class FearedFluffyDesire extends Desire {
  constructor() {
    super("FearedFluffyFear");
  }
  evaluate(horse) {
    if (
      !horse.isAlive ||
      horse.happiness <= WAN_DIE_THRESHOLD ||
      horse.isScared ||
      !horse.avoidStateChangerActions()
    )
      return 0;
    if (horse.hunger <= 0.3 || !horse.canSee()) return 0;
    if (
      horse.isDragging ||
      horse.placedOn ||
      horse.currentStateKey === "SLEEPING"
    )
      return 0;
    if (horse.isInLabor()) return 0;
    if (!horse.fearedFluffies || horse.fearedFluffies.length === 0) return 0;

    const target = horse.positioning.findScaryFearedFluffy();
    if (target) {
      this.fearTarget = target;
      return 100;
    }
    return 0;
  }
  execute(horse) {
    horse.dropHeldBlock();
    return horse.actionHandler.executeFearedFluffyFear(this.fearTarget);
  }
}

class CarFearDesire extends Desire {
  constructor() {
    super("CarFear");
  }
  evaluate(horse) {
    if (
      !horse.isAlive ||
      horse.happiness <= WAN_DIE_THRESHOLD ||
      horse.isScared ||
      !horse.avoidStateChangerActions()
    )
      return 0;
    if (horse.hunger <= 0.3 || (!horse.canSee() && !horse.canHear())) return 0;
    if (
      horse.isDragging ||
      horse.placedOn ||
      horse.currentStateKey === "SLEEPING"
    )
      return 0;
    if (horse.isInLabor()) return 0;

    const target = horse.positioning.findScaryCar();
    if (target) {
      this.fearTarget = target;
      return 100;
    }
    return 0;
  }
  execute(horse) {
    horse.dropHeldBlock();
    return horse.actionHandler.executeCarFear(this.fearTarget);
  }
}

class SprinklerFearDesire extends Desire {
  constructor() {
    super("SprinklerFear");
  }
  evaluate(horse) {
    if (
      !horse.isAlive ||
      horse.happiness <= WAN_DIE_THRESHOLD ||
      horse.isScared ||
      !horse.avoidStateChangerActions()
    )
      return 0;
    if (horse.hunger <= 0.3 || (!horse.canSee() && !horse.canHear())) return 0;
    if (horse.isDragging || horse.placedOn) return 0;
    if (horse.isInLabor()) return 0;

    const target = horse.positioning.findScarySprinkler();
    if (target) {
      this.fearTarget = target;
      return 100;
    }
    return 0;
  }
  execute(horse) {
    horse.dropHeldBlock();
    return horse.actionHandler.executeRunawayFear(this.fearTarget, [
      "FEAR",
      "SPRINKLER",
    ]);
  }
}

class CorpseReactionDesire extends Desire {
  constructor() {
    super("CorpseReaction");
  }
  evaluate(horse) {
    if (
      !horse.isAlive ||
      horse.happiness <= WAN_DIE_THRESHOLD ||
      horse.isScared ||
      !horse.avoidStateChangerActions()
    )
      return 0;
    if (horse.isStacking) return 0;
    if (horse.hunger <= 0.3 || !horse.canSee() || horse.isSmarty()) return 0;
    if (horse.bloodReactionTimer > 0 || Math.random() < horse.bloodTolerance)
      return 0;
    if (
      horse.isDragging ||
      horse.placedOn ||
      horse.currentStateKey === "SLEEPING"
    )
      return 0;
    if (horse.isInLabor()) return 0;

    const target = horse.positioning.findScaryCorpse();
    if (target) {
      this.fearTarget = target;
      return 100; // Will execute once, setting bloodReactionTimer > 0, thus evaluating to 0 on next frame
    }
    return 0;
  }
  execute(horse) {
    return horse.actionHandler.executeCorpseReaction(this.fearTarget);
  }
}

class BloodReactionDesire extends Desire {
  constructor() {
    super("BloodReaction");
  }
  evaluate(horse) {
    if (
      !horse.isAlive ||
      horse.happiness <= WAN_DIE_THRESHOLD ||
      horse.isScared ||
      !horse.avoidStateChangerActions()
    )
      return 0;
    if (horse.isStacking) return 0;
    if (horse.hunger <= 0.3 || !horse.canSee() || horse.isSmarty()) return 0;
    if (
      horse.bloodReactionTimer > 0 ||
      horse.cannibalismAcceptance > 0 ||
      Math.random() < horse.bloodTolerance
    )
      return 0;
    if (
      horse.isDragging ||
      horse.placedOn ||
      horse.currentStateKey === "SLEEPING"
    )
      return 0;
    if (horse.isInLabor()) return 0;

    const target = horse.positioning.findScaryBlood();
    if (target) {
      this.fearTarget = target;
      return 100;
    }
    return 0;
  }
  execute(horse) {
    return horse.actionHandler.executeBloodReaction(this.fearTarget);
  }
}

class SmartyChaseFearDesire extends Desire {
  constructor() {
    super("SmartyChaseFear");
  }
  evaluate(horse) {
    if (
      !horse.isAlive ||
      horse.happiness <= WAN_DIE_THRESHOLD ||
      horse.isScared ||
      !horse.avoidStateChangerActions()
    )
      return 0;
    if (!horse.canSee()) return 0;
    if (horse.isDragging || horse.placedOn) return 0;
    if (horse.isInLabor()) return 0;

    const target = horse.positioning.findChasingSmarty();
    if (target) {
      this.fearTarget = target;
      return 100;
    }
    return 0;
  }
  execute(horse) {
    horse.dropHeldBlock();
    return horse.actionHandler.executeSmartyChaseFear(this.fearTarget);
  }
}

// =======================
// Specific Desires
// =======================

// Foals up to this size still drink formula or milk when there's nothing to eat
const FEEDER_WEAN_GROWTH = 0.55;

class EatDesire extends Desire {
  constructor() {
    super("Eat");
  }
  evaluate(horse) {
    if (horse.isUnderAphrodisiac()) return 0;
    if (horse.isStacking) return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD) return 0;
    if (horse.tooYoungToWalk()) {
      if (horse.milkCooldown > 0) return 0;
      if (horse.hunger >= 0.85) return 0;
      return 80;
    } else {
      if (horse.hunger >= 0.6) return 0; // Not hungry

      let score = 25 + ((0.6 - horse.hunger) / 0.6) * 75;

      const canniThreshold = 0.25 + 0.3 * horse.cannibalismAcceptance;
      if (horse.hunger < canniThreshold) {
        score += 20 * horse.cannibalismAcceptance;
      }
      return score;
    }
  }
  execute(horse) {
    if (horse.tooYoungToWalk()) {
      return horse.actionHandler.executeChirpyBabyMilk();
    } else {
      if (horse.positioning.scoutForHunger()) {
        return true;
      }
      // A foal that's just started walking still drinks: with no food to eat
      // it goes to a feeder or a mare's milk (caged foals starved beside a
      // full feeder once they could walk)
      if (horse.growth < FEEDER_WEAN_GROWTH && horse.milkCooldown <= 0 && horse.actionHandler.executeChirpyBabyMilk()) {
        return true;
      }

      if (horse.hunger < 0.3) {
        if (horse.positioning.scoutForFallbackHunger()) {
          return true;
        }
      }

      const canniThreshold = 0.25 + 0.3 * horse.cannibalismAcceptance;
      if (horse.hunger < canniThreshold) {
        if (horse.positioning.scoutForCannibalism()) {
          return true;
        }
      }

      return false;
    }
  }
}

class UseLitterboxDesire extends Desire {
  constructor() {
    super("UseLitterbox");
  }
  evaluate(horse) {
    if (horse.isStacking || horse.isSmarty()) return 0;
    const needsToGo = Math.max(horse.poopStorage, horse.peeStorage);
    if (needsToGo < 0.5) return 0;
    if (horse.isScared) return 0;
    if (typeof wobblesShowing === "function" && wobblesShowing(horse)) return 0; // (the wobbles: it can't find it - BadMeat.js)
    if (typeof missesLitterbox === "function" && missesLitterbox(horse)) return 0; // (shaky legs - Defects.js)
    if (Math.random() > horse.pottyTraining) return 0;
    return ((needsToGo - 0.5) / 0.5) * 100;
  }
  execute(horse) {
    if (
      horse.litterboxUsed &&
      (horse.currentStateKey === "MOVING" ||
        horse.currentStateKey === "RUNNING")
    )
      return true;
    return horse.positioning.scoutForLitterbox();
  }
}

class CareForBabiesDesire extends Desire {
  constructor() {
    super("CareForBabies");
    this.lastCalledTime = 0;
  }
  evaluate(horse) {
    if (horse.isScared || horse.isStacking) return 0;
    let timeSince =
      (gameTimeMs() - this.lastCalledTime) / 1000;
    if (timeSince < 0.5) return 0;
    if (horse.speech.text) return 0; // Currently speaking
    if (horse.growth < 1.0) return 0; // Not adult
    if (horse.gender !== "female") return 0; // Only moms
    if (typeof mumAway === "function" && mumAway(horse)) return 0; // (time away, BadMummah.js)

    const rels =
      typeof relationships !== "undefined" ? relationships[horse.id] : null;
    if (!rels) return 0;

    let hasBaby = false;
    for (const [otherId, relation] of Object.entries(rels)) {
      if (relation === "baby_child") {
        const other = fluffyById(otherId);
        if (other && other.isAlive && other.scene === horse.scene) {
          hasBaby = true;
          break;
        }
      }
    }

    if (!hasBaby) return 0;

    return 85;
  }
  execute(horse) {
    this.lastCalledTime =
      gameTimeMs();
    return horse.positioning.scoutForBabies();
  }
}

class FeedHungryFoalDesire extends Desire {
  constructor() {
    super("FeedHungryFoal");
  }
  evaluate(horse) {
    if (horse.isScared || horse.isStacking) return 0;
    if (horse.lactatingTimer <= 0 || horse.milkCharges <= 0) return 0;
    if (typeof mumAway === "function" && mumAway(horse)) return 0; // (time away from her foals, BadMummah.js)
    if (!horse.positioning.scoutForHungryFoal()) return 0;
    return 90; // High priority fixed score, let execute find a hungry foal
  }
  execute(horse) {
    return horse.positioning.scoutForHungryFoal();
  }
}

class SleepDesire extends Desire {
  constructor() {
    super("Sleep");
  }
  evaluate(horse) {
    if (
      horse.isFrantic ||
      horse.isScared ||
      horse.isStacking ||
      horse.isDragging ||
      !horse.isAlive ||
      horse.bleedingTimer > 0 ||
      horse.hunger < 0.5 ||
      horse.happiness <= WAN_DIE_THRESHOLD
    )
      return 0;

    if (horse.currentStateKey === "SLEEPING") {
      // Stay asleep until well rested (sleepDeprivation drops near 0)
      if (horse.sleepDeprivation < 0.05) {
        return 0; // Wake up
      }
      return 80; // Stay asleep
    }

    if (
      horse.sleepDeprivation > 0.8 ||
      (horse.tooYoungToWalk() && horse.sleepDeprivation > 0.2) ||
      (horse.isPregnant && horse.hunger > 0.6 && horse.sleepDeprivation > 0.2)
    ) {
      return 80;
    }
    // Night time: bed time comes sooner (WorldTime.js)
    if (
      typeof isNightTime === "function" &&
      isNightTime() &&
      horse.hunger > 0.5 &&
      horse.sleepDeprivation > 0.35
    ) {
      return 60;
    }
    if (
      horse.hunger > 0.5 &&
      horse.happiness > WAN_DIE_THRESHOLD &&
      horse.sleepDeprivation > 0.5
    ) {
      let val = 25 + (horse.sleepDeprivation - 0.2) * 50;
      return val;
    }
    return 0;
  }
  execute(horse) {
    if (horse.currentStateKey === "SLEEPING") {
      return true; // Already asleep, just keep doing it
    }
    return horse.positioning.scoutForSleep();
  }
}

class BystanderInterruptMatingDesire extends Desire {
  constructor() {
    super("BystanderInterruptMating");
  }
  evaluate(horse) {
    if (horse.isScared || horse.isStacking) return 0;
    if (
      horse.gender !== "male" ||
      !horse.isAlive ||
      horse.tooYoungToWalk() ||
      horse.isSmarty()
    )
      return 0;

    let interruptibleMatingExists =
      typeof fluffies !== "undefined" &&
      fluffies.some(
        (f) =>
          f !== horse &&
          f.scene === horse.scene &&
          f.currentCage === horse.currentCage &&
          f.matingState &&
          f.matingState.isMating &&
          f.matingState.interruptible &&
          f.gender === "male",
      );

    if (!interruptibleMatingExists) return 0;

    return 100;
  }
  execute(horse) {
    return horse.positioning.bystanderAttemptInterruptMating();
  }
}
class RunToTVDesire extends Desire {
  constructor() {
    super("RunToTV");
  }
  evaluate(horse) {
    if (
      !horse.isAlive ||
      horse.happiness <= WAN_DIE_THRESHOLD ||
      horse.isScared ||
      horse.isFrantic ||
      horse.isStacking ||
      !horse.avoidStateChangerActions()
    )
      return 0;
    if (horse.sleepingOrTargetSet()) return 0;
    if (horse.hunger < 0.5) return 0;

    // If already near a TV and stopped, WatchTVDesire takes over
    if (horse.findNearbyTV() && !horse.isMovingOrRunning()) return 0;
    if (horse.isMovingOrRunning()) return 0;

    // Check if there is ANY TV in the scene
    if (typeof objects === "undefined") return 0;
    const anyTV = objects.find(
      (o) =>
        o instanceof FluffTV &&
        o.channel !== "OFF" &&
        o.scene === horse.scene &&
        o.currentCage === horse.currentCage,
    );
    if (!anyTV) return 0;

    return 35; // RunToTV is slightly lower priority than WatchTV (40)
  }
  execute(horse) {
    return horse.positioning.scoutForTV();
  }
}

class WatchTVDesire extends Desire {
  constructor() {
    super("WatchTV");
  }
  evaluate(horse) {
    if (
      !horse.isAlive ||
      horse.happiness <= WAN_DIE_THRESHOLD ||
      horse.isScared ||
      horse.isFrantic ||
      horse.isStacking ||
      !horse.avoidStateChangerActions()
    )
      return 0;
    if (horse.hunger < 0.5) return 0;
    if (horse.isMovingOrRunning()) return 0;
    if (horse.sleepingOrTargetSet()) return 0;
    if (horse.tooYoungToWalk()) return 0;

    const tv = horse.findNearbyTV();
    if (tv) {
      return 40; // High priority once arrived
    }
    return 0;
  }
  execute(horse) {
    if (!isFocusingState(horse.currentStateKey)) {
      const tv = horse.findNearbyTV();
      if (tv) horse.startWatchingTV(tv);
    }
    return true;
  }
}

class PlayWithBallDesire extends Desire {
  constructor() {
    super("PlayWithBall");
  }
  evaluate(horse) {
    if (horse.isScared || horse.isStacking) return 0;
    if (horse.isFrantic) return 0;
    if (
      horse.isDragging ||
      horse.ballCooldown > 0 ||
      !horse.canSee() ||
      !canRun(horse)
    )
      return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD) return 0;
    if (horse.sleepingOrTargetSet()) return 0;

    let hasBall =
      typeof objects !== "undefined" &&
      objects.some(
        (o) =>
          o instanceof Ball &&
          o.scene === horse.scene &&
          horse.currentCage === o.currentCage,
      );
    if (!hasBall) return 0;

    // Bored fluffies want to play more (Play.js)
    return 30 + (typeof playDesireBonus === "function" ? playDesireBonus(horse) : 0);
  }
  execute(horse) {
    return horse.positioning.scoutForBall();
  }
}

class PlayWithBlocksDesire extends Desire {
  constructor() {
    super("PlayWithBlocks");
  }
  evaluate(horse) {
    if (horse.isScared) return 0;
    if (horse.isFrantic) return 0;
    if (
      horse.isDragging ||
      !horse.canSee() ||
      horse.blockCooldown > 0 ||
      !horse.limbs.legs[1] ||
      !horse.limbs.legs[2]
    )
      return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD) return 0;
    if (horse.sleepingOrTargetSet()) return 0;
    if (horse.hasBlockOnBack() || horse.isStacking || horse._blockLift) return 95; // MUST finish tower!

    let hasBlock =
      typeof objects !== "undefined" &&
      objects.some(
        (o) =>
          o instanceof Block &&
          o.scene === horse.scene &&
          o.currentCage === horse.currentCage &&
          !o.heldBy &&
          horse.positioning.canReachBlock(o),
      );
    if (!hasBlock) return 0;

    return 30 + (typeof playDesireBonus === "function" ? playDesireBonus(horse) : 0);
  }
  execute(horse) {
    return horse.positioning.scoutForBlock();
  }
}

class SeekSmartySpecialHuggiesDesire extends Desire {
  constructor() {
    super("SeekSmartySpecialHuggies");
  }
  evaluate(horse) {
    if (horse.isScared || horse.isStacking) return 0;
    if (horse.sleepingOrTargetSet()) return 0;
    if (horse.gender !== "male" || horse.growth < 1.0) return 0;
    if (horse.specialHuggiesCooldown > 0) return 0;
    if (!horse.isSmarty() && !horse.isUnderAphrodisiac()) return 0;
    // Smarties only go looking every few hours (SmartyMood.js)
    if (!horse.isUnderAphrodisiac() && typeof smartyReadyForEnfies === "function" && !smartyReadyForEnfies(horse)) return 0;
    if (
      (!horse.isUnderAphrodisiac() && horse.isFrantic) ||
      horse.attackCooldown > 0 ||
      !horse.canSee() ||
      !horse.limbs.lumps
    )
      return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD) return 0;

    const target = horse.isUnderAphrodisiac()
      ? horse.positioning.findAphrodisiacMateTarget()
      : horse.positioning.findSmartyMateTarget();
    if (target) {
      this.target = target;
      return horse.isUnderAphrodisiac() ? 100 : 85;
    }
    return 0;
  }
  execute(horse) {
    if (!this.target || !placedOnValidForSpecialHuggies(this.target.placedOn))
      return false;
    horse.chaseTarget = this.target;
    horse.chaseReason = "MATING";
    return true;
  }
}

class SeekSpecialFriendDesire extends Desire {
  constructor() {
    super("SeekSpecialFriend");
    this.lastCalledTime =
      gameTimeMs();
  }
  evaluate(horse) {
    if (horse.isScared || horse.isStacking) return 0;
    if (horse.sleepingOrTargetSet()) return 0;
    if (horse.specialHuggiesCooldown > 0) return 0;
    if (horse.gender !== "male") return 0;
    if (horse.growth < 1.0) return 0;
    if (horse.isSmarty()) return 0; // Smarties don't do this
    if (horse.happiness <= WAN_DIE_THRESHOLD) return 0;

    let timeSince =
      (gameTimeMs() - this.lastCalledTime) / 1000;
    if (timeSince < 0.5) return 0;

    const friend = horse.positioning.findSpecialFriend(false);
    if (friend && !friend.isPregnant) {
      const dist = Math.sqrt(
        (horse.x - friend.x) ** 2 + (horse.y - friend.y) ** 2,
      );
      if (dist >= 50) {
        this.target = friend;
        return 80;
      }
    }
    return 0;
  }
  execute(horse) {
    if (!this.target || this.target.isPregnant) return false;
    this.lastCalledTime =
      gameTimeMs();
    horse.initBehavior("MOVING");
    const targetPos = this.target.getWorldPosition();
    horse.setTargetPosition(targetPos.x, targetPos.y);
    return true;
  }
}

class MateDesire extends Desire {
  constructor() {
    super("Mate");
    this.lastCalledTime =
      gameTimeMs();
  }
  evaluate(horse) {
    if (horse.isScared || horse.isStacking) return 0;
    if (horse.sleepingOrTargetSet()) return 0;
    if (
      horse.gender !== "male" ||
      horse.specialHuggiesCooldown > 0 ||
      horse.growth < 1.0
    )
      return 0;
    if (horse.isSmarty()) return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD) return 0;

    let timeSince =
      (gameTimeMs() - this.lastCalledTime) / 1000;
    if (timeSince < 0.5) return 0;

    const friend = horse.positioning.findSpecialFriend();
    if (
      friend &&
      placedOnValidForSpecialHuggies(friend.placedOn) &&
      canFluffiesMate(horse, friend, false)
    ) {
      const dist = Math.sqrt(
        (horse.x - friend.x) ** 2 + (horse.y - friend.y) ** 2,
      );
      if (dist < 50 && !horse.isNearWasteSpot() && !friend.isNearWasteSpot()) {
        // Told not to (MatingRule.js): it may hold off
        if (typeof ruleStopsMating === "function" && ruleStopsMating(horse, friend)) return 0;
        this.target = friend;
        return 95; // Higher than Seek
      }
    }
    return 0;
  }
  execute(horse) {
    if (!this.target || !placedOnValidForSpecialHuggies(this.target.placedOn))
      return false;
    this.lastCalledTime =
      gameTimeMs();
    return horse.actionHandler.executeMateWithSpecialFriend(this.target);
  }
}

class ProposeSpecialFriendshipDesire extends Desire {
  constructor() {
    super("ProposeSpecialFriendship");
  }
  evaluate(horse) {
    if (horse.isScared || horse.isStacking) return 0;
    if (horse.sleepingOrTargetSet()) return 0;
    if (horse.growth < 1.0) return 0;
    if (horse.gender === "male" && horse.specialHuggiesCooldown > 0) return 0;
    if (horse.gender === "female" && horse.isPregnant) return 0;
    if (horse.isSmarty()) return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD) return 0;
    if (horse.isMovingOrRunning() || horse.hunger < 0.5) {
      return 0;
    }

    const rels =
      typeof relationships !== "undefined" ? relationships[horse.id] : null;
    const hasSpecialFriend = Object.keys(rels || {}).some(
      (id) => rels[id] === "special_friend",
    );
    if (hasSpecialFriend) return 0;

    const friend = horse.positioning.findCompatibleFriendToPropose();
    if (friend) {
      this.target = friend;
      return 80;
    }
    return 0;
  }
  execute(horse) {
    return horse.actionHandler.executeProposeToFriend(this.target);
  }
}

class ProposeFriendshipDesire extends Desire {
  constructor() {
    super("ProposeFriendship");
  }
  evaluate(horse) {
    if (horse.sleepingOrTargetSet() || horse.isStacking) return 0;
    if (
      !horse.isAlive ||
      !horse.canSee() ||
      horse.tooYoungToSpeak() ||
      horse.happiness <= WAN_DIE_THRESHOLD ||
      horse.speech.timer > 0 ||
      horse.isScared ||
      horse.isFrantic ||
      horse.isSmarty() ||
      horse.isMovingOrRunning() ||
      horse.hunger < 0.5 ||
      !horse.avoidStateChangerActions()
    ) {
      return 0;
    }
    return 35;
  }
  execute(horse) {
    return horse.actionHandler.executeProposeFriendship();
  }
}

class BabbleToFriendsDesire extends Desire {
  constructor() {
    super("BabbleToFriends");
  }
  evaluate(horse) {
    if (horse.sleepingOrTargetSet() || horse.isStacking) return 0;
    if (
      !horse.isAlive ||
      horse.isDragging ||
      horse.currentStateKey === "SLEEPING" ||
      horse.isScared ||
      horse.happiness <= WAN_DIE_THRESHOLD
    ) {
      return 0;
    }
    if (
      horse.lastBabbleTime &&
      gameTimeMs() - horse.lastBabbleTime < 2000 + Math.random() * 3000
    ) {
      return 0;
    }
    return 32;
  }
  execute(horse) {
    horse.lastBabbleTime = gameTimeMs();
    return horse.actionHandler.executeBabbleToFriends();
  }
}

class RandomBabbleDesire extends Desire {
  constructor() {
    super("RandomBabble");
    this.lastCalledTime =
      gameTimeMs() - Math.random() * 5 * 1000;
  }
  evaluate(horse) {
    if (horse.sleepingOrTargetSet() || horse.isStacking) return 0;
    if (
      !horse.isAlive ||
      horse.isDragging ||
      horse.currentStateKey === "SLEEPING" ||
      isFocusingState(horse.currentStateKey) ||
      !horse.canBabble()
    ) {
      return 0;
    }
    let timeSince =
      (gameTimeMs() - this.lastCalledTime) / 1000;
    if (timeSince < 15) return 0;
    let intensity = Math.min(1, (timeSince - 15) / 15);
    return intensity * 33;
  }
  execute(horse) {
    this.lastCalledTime =
      gameTimeMs() - Math.random() * 5 * 1000;
    return horse.randomBabble();
  }
}

// Smarties fight when provoked or in a bad mood, and otherwise just bully
// now and then - never their own herd, family or friends (SmartyMood.js)
class SmartyCombatDesire extends Desire {
  constructor() {
    super("SmartyCombat");
  }
  evaluate(horse) {
    this.target = null;
    if (horse.sleepingOrTargetSet() || horse.isStacking) return 0;
    if (!horse.isAlive || !horse.isSmarty() || horse.growth < 1.0) return 0;
    if (horse.isFrantic || !horse.canSee() || horse.attackCooldown > 0) return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD) return 0;

    const fight = smartyFightTarget(horse);
    // (a straight stallion picks fights with other stallions; anyone
    // fights whoever provoked it)
    if (fight && (smartyProvokedBy(horse, fight) || (horse.gender === "male" && horse.sexuality === "heterosexual"))) {
      this.target = fight;
      this.reason = "ATTACK";
      return 90;
    }
    const bully = smartyBullyTarget(horse);
    if (bully) {
      this.target = bully;
      this.reason = "BULLY";
      return 60;
    }
    return 0;
  }
  execute(horse) {
    const target = this.target;
    if (!target || !target.isAlive) return false;
    if (horse.chaseTarget !== target) {
      horse.chaseTarget = target;
      horse.chaseReason = this.reason;
      target.speech.nextTime = 0;
      horse.speech.nextTime = this.reason === "BULLY" ? 1 : 0;
      horse.initBehavior("RUNNING");
    }
    return true;
  }
}

class ComplainAboutPuddleDesire extends Desire {
  constructor() {
    super("ComplainAboutPuddle");
  }
  evaluate(horse) {
    if (horse.sleepingOrTargetSet() || horse.isStacking) return 0;
    if (
      !horse.isAlive ||
      !horse.adopted ||
      horse.tooYoungToSpeak() ||
      horse.currentStateKey === "SLEEPING"
    )
      return 0;
    if (horse.lastPuddleReactionTime <= 30 || horse.speech.text) return 0;
    if (typeof puddles === "undefined") return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD) return 0;
    if (horse.isScared) return 0;

    return 45; // High enough to interrupt idle and playing, they really hate puddles
  }
  execute(horse) {
    return horse.actionHandler.executeComplainAboutPuddle();
  }
}

class WanderDesire extends Desire {
  constructor() {
    super("Wander");
    this.targetTime = 5 + Math.random() * 15;
    this.lastCalledTime =
      gameTimeMs() - Math.random() * this.targetTime * 1000;
  }
  evaluate(horse) {
    if (horse.isScared || horse.isStacking) return 0;
    if (horse.sleepingOrTargetSet()) return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD) return 0;
    if (typeof mareResting === "function" && mareResting(horse)) return 0; // (Pregnancy.js)
    let score = 0;
    if (!horse.isMovingOrRunning() && horse.isFrantic) {
      score = 40;
    } else {
      let timeSince =
        (gameTimeMs() - this.lastCalledTime) / 1000;
      if (timeSince >= this.targetTime) {
        score = 45;
      }
    }

    if (score > 0 && !horse.canSee()) {
      score /= 4;
    }

    if (score > 0 && horse.isCrawling) {
      score /= 4;
    }

    return score;
  }
  execute(horse) {
    this.lastCalledTime =
      gameTimeMs();
    this.targetTime = 5 + Math.random() * 15;
    // In a cage there's nowhere to go: it shuffles now and then rather than
    // pacing wall to wall (CAGE_WANDER_*)
    if (horse.currentCage) {
      this.targetTime = CAGE_WANDER_REST[0] + Math.random() * (CAGE_WANDER_REST[1] - CAGE_WANDER_REST[0]);
      if (Math.random() >= CAGE_WANDER_CHANCE || horse.isMovingOrRunning()) return true;
      const lim = horse.positioning.getCageLimits();
      const tx = clamp(horse.x + (Math.random() - 0.5) * 2 * CAGE_WANDER_STEP, lim.minX, lim.maxX);
      if (Math.abs(tx - horse.x) < 12) return true;
      horse.initBehavior("MOVING");
      horse.setTargetPosition(tx, horse.y);
      horse.constrainTargetToCage();
      return true;
    }
    let magX = Math.random() * 1000 + 150;
    let magY = Math.random() * 1000 + 150;
    if (!horse.canSee()) {
      magX /= 5;
      magY /= 5;
    }
    if (!horse.isMovingOrRunning()) {
      const angle = Math.random() * Math.PI * 2;
      // (area size: the park is bigger than the screen, Park.js)
      const x = clamp(horse.x + Math.cos(angle) * magX, 100, sceneW(horse.scene) - 100);
      const y = clamp(
        horse.y + Math.sin(angle) * magY,
        sceneTop(horse.scene) + 50,
        sceneH(horse.scene) - 50,
      );
      // Pens (Fence.js): pick somewhere this fluffy can actually walk to
      let tx = x,
        ty = y;
      if (
        typeof sceneHasFences === "function" &&
        sceneHasFences(horse.scene) &&
        !canFluffyReach(horse, tx, ty)
      ) {
        let found = false;
        for (let i = 0; i < 12 && !found; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = 60 + Math.random() * 300;
          tx = clamp(horse.x + Math.cos(a) * d, 100, sceneW(horse.scene) - 100);
          ty = clamp(horse.y + Math.sin(a) * d, sceneTop(horse.scene) + 50, sceneH(horse.scene) - 50);
          found = canFluffyReach(horse, tx, ty);
        }
        if (!found) return true; // nowhere to go right now; just stay
      }
      horse.initBehavior("MOVING");
      horse.setTargetPosition(tx, ty);
      // Keep caged fluffies wandering inside their cage
      horse.constrainTargetToCage();
    }
    return true;
  }
}

class SitDesire extends Desire {
  constructor() {
    super("Sit");
    this.targetTime = 5 + Math.random() * 15;
    this.lastCalledTime =
      gameTimeMs() - Math.random() * this.targetTime * 1000;
  }
  evaluate(horse) {
    if (horse.sleepingOrTargetSet() || horse.isStacking) return 0;
    if (horse.isFrantic) return 0;
    if (horse.isScared) return 0;
    if (
      horse.isCrawling ||
      horse.isDragging ||
      !horse.isAlive ||
      horse.tooYoungToWalk() ||
      horse.isPregnant ||
      !horse.limbs.legs[1] ||
      !horse.limbs.legs[2]
    )
      return 0;
    if (horse.isMovingOrRunning()) return 0;
    if (horse.currentStateKey !== "IDLE") return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD) return 0;

    let timeSince =
      (gameTimeMs() - this.lastCalledTime) / 1000;
    if (timeSince < this.targetTime) return 0;
    return 45;
  }
  execute(horse) {
    this.lastCalledTime =
      gameTimeMs();
    this.targetTime = 5 + Math.random() * 15;
    if (horse.currentStateKey !== "SITTING") {
      horse.initBehavior("SITTING");
    }
    return true;
  }
}

class LieDownDesire extends Desire {
  constructor() {
    super("LieDown");
    this.targetTime = 5 + Math.random() * 15;
    this.lastCalledTime =
      gameTimeMs() - Math.random() * this.targetTime * 1000;
  }
  evaluate(horse) {
    if (horse.sleepingOrTargetSet() || horse.isStacking) return 0;
    let timeSince =
      (gameTimeMs() - this.lastCalledTime) / 1000;
    if (timeSince < this.targetTime) return 0;

    if (horse.happiness <= WAN_DIE_THRESHOLD) return 100;
    if (horse.isScared) return 0;
    if (horse.isFrantic) return 0;
    if (horse.isDragging || !horse.isAlive || horse.growth < 1.0) return 0;
    if (horse.currentStateKey !== "IDLE") return 0;
    if (horse.isMovingOrRunning()) return 0;

    return 45;
  }
  execute(horse) {
    this.lastCalledTime =
      gameTimeMs();
    this.targetTime = 5 + Math.random() * 15;
    if (horse.currentStateKey !== "LYING") {
      horse.initBehavior("LYING");
    }
    return true;
  }
}
