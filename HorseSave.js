// ---------------------------------------------------------------------------
// Saving a fluffy (serialize). Loading is Horse.deserialize in Horse.js.
//
// To save something new about a fluffy, add it to SAVED_HORSE_FIELDS below:
// both saving and loading read the list, so it's one line.
//   { name, fallback, clone }
//   name      the property on the fluffy
//   fallback  used when it's missing (old saves); undefined = leave the
//             fluffy's own default alone
//   clone     true for objects/arrays: saved and loaded as a copy
// (The game's original fields are still written out one by one in
// serialize() and Horse.deserialize.)
// (Part of the Horse class, split out of Horse.js: addHorseMethods adds
// these to every fluffy. Loaded right after Horse.js.)
// ---------------------------------------------------------------------------

const SAVED_HORSE_FIELDS = [
  { name: "deathTimer", fallback: 0 }, // Corpses.js
  { name: "notForSale", fallback: false }, // NotForSale.js
  // Mothers and foals (batch 12)
  { name: "knowsSong", fallback: undefined }, // Lullaby.js
  { name: "songHeard", fallback: 0 },
  { name: "runt", fallback: false }, // Runts.js
  { name: "babyLove", fallback: 0 },
  { name: "smellRejected", fallback: null },
  { name: "sniffed", fallback: null, clone: true },
  { name: "badMum", fallback: null, clone: true }, // BadMummah.js
  { name: "takenFromMum", fallback: null },
  { name: "forgotMum", fallback: false }, // FoalLife.js
  { name: "seasonDays", fallback: null, clone: true },
  { name: "cageKnow", fallback: null, clone: true }, // what it knows of cull, sell and breeding cages (CageLife.js)
  { name: "breedTrain", fallback: 0 },
  { name: "sfRefused", fallback: null, clone: true },
  { name: "gluedTo", fallback: null },
  { name: "badMeat", fallback: 0 }, // meals of fluffy eaten (BadMeat.js)
  { name: "wobbles", fallback: null, clone: true },
  { name: "defectGenes", fallback: null, clone: true }, // hidden hereditary defects { dummy, shaky } (Defects.js)
  { name: "sireDefects", fallback: null, clone: true }, // ...the sire's, kept for her litter
  { name: "dnaTested", fallback: false },
  { name: "snitch", fallback: false }, // tells on the others for treats (Snitch.js)
  { name: "hiddenBy", fallback: null }, // hidden by its mum (her id), under this object (Snitch.js)
  { name: "hideSpot", fallback: null }, // the wobbles, caught at { at } (BadMeat.js) // stuck on this glue trap (GlueTrap.js) // special friends you kept it from: id -> until (SpecialFriends.js) // a stud trained to breed in a breeding cage by himself (CageLife.js) // SeasonSense.js: days lived in each season
  { name: "mumApart", fallback: 0 },
  { name: "bullied", fallback: 0 },
  { name: "bullyScore", fallback: 0 },
  { name: "playNice", fallback: 0 },
  { name: "bullyHabit", fallback: 0 },
  { name: "luredBy", fallback: null }, // Lures.js
  { name: "machineFear", fallback: 0 }, // FoalMachine.js
  { name: "refusesMachine", fallback: false },
  { name: "fakeAlicorn", fallback: null, clone: true }, // Trade.js
  { name: "fromMystery", fallback: false },
  { name: "stayLittle", fallback: null, clone: true }, // Tools.js
  { name: "wasForeverFoal", fallback: false },
  { name: "toothless", fallback: false },
  { name: "tongueless", fallback: false },
  { name: "fearedBowls", fallback: null, clone: true },
  { name: "heat", fallback: 0 }, // Heat.js
  { name: "micro", fallback: false }, // Micro.js
  { name: "sbsKnown", fallback: false },
  { name: "separation", fallback: null, clone: true }, // Separation.js
  { name: "traumas", fallback: [], clone: true },
  { name: "hurtByPlayerAt", fallback: null }, // Memory.js
  { name: "killedByPlayer", fallback: false },
  { name: "hasKilled", fallback: 0 }, // Kinship.js
  { name: "babyDaddyId", fallback: null }, // the sire of her litter (HorseAnatomy.spawnBaby)
  { name: "fromPark", fallback: false }, // Wellbeing.js settling in
  { name: "settling", fallback: false },
  { name: "settleStart", fallback: null },
  { name: "lastDesire", fallback: null, clone: true },
  { name: "alicornComfort", fallback: 0 }, // AlicornAcceptance.js
  { name: "missingOwner", fallback: 0 }, // Abandoned.js
  { name: "lostPet", fallback: false }, // NightEvents.js
  { name: "illness", fallback: null, clone: true }, // Illness.js
  { name: "fluImmuneUntil", fallback: 0 },
  { name: "fluVaccinated", fallback: false },
  { name: "vetCheckedAt", fallback: undefined }, // Vet.js
  { name: "vetNote", fallback: null },
  { name: "vetLife", fallback: null },
  { name: "ribbons", fallback: [], clone: true }, // Shows.js
  { name: "groomedAt", fallback: null },
  { name: "pregCare", fallback: null, clone: true }, // Pregnancy.js
  { name: "miscarriageTimer", fallback: null }, // HorseMating.beginMiscarriage
  { name: "prematureGrowth", fallback: 1.0 }, // born early: smaller (Premature.js)
  { name: "bornEarly", fallback: null }, // ...and how early
  { name: "frailLeft", fallback: 0 }, // game seconds still frail (Premature.js)
  { name: "incubatorAlone", fallback: 0 }, // game seconds in the incubator since mum came (Premature.js)
  { name: "recovery", fallback: null, clone: true }, // after surgery (Recovery.js)
  { name: "infection", fallback: null, clone: true },
  { name: "flightSkill", fallback: 0 }, // wing strength (Flight.js)
  { name: "mourning", fallback: null, clone: true }, // missing one who died (MemorialTree.js)
  { name: "pastHerds", fallback: null, clone: true }, // herds it used to be in (Herds.js)
  { name: "smartyKind", fallback: undefined }, // "good" or "bad" (Intelligence.js)
  { name: "limbState", fallback: null, clone: true }, // mangled legs, wings, horn (Injuries.js)
  { name: "alicornIndifferent", fallback: false }, // born not caring about alicorns (AlicornAcceptance.js)
  { name: "deformities", fallback: null, clone: true }, // born deformed: inbred (Inbreeding.js)
  { name: "breedWear", fallback: 0 }, // a sensitive one worn out from breeding (Inbreeding.js)
  { name: "lostFoalAt", fallback: null }, // when she last lost a foal (Fostering.js)
  { name: "fosterMumId", fallback: null }, // the wild mare who took it in
  { name: "litterSize", fallback: null },
  { name: "litterBorn", fallback: null },
  { name: "birthVigor", fallback: null },
  { name: "midwife", fallback: false },
  { name: "pregScan", fallback: null, clone: true },
  { name: "litterCareAt", fallback: null },
  { name: "litterLost", fallback: 0 },
  { name: "bredHere", fallback: null },
  { name: "lastKindnessAt", fallback: null }, // Affection.js
  { name: "affectionToday", fallback: null, clone: true },
  { name: "tricks", fallback: null, clone: true }, // Tricks.js
  { name: "trickTries", fallback: null, clone: true },
  { name: "lessonTries", fallback: null, clone: true }, // Lessons.js
  { name: "smartyReform", fallback: 0 },
  { name: "smartyReformed", fallback: false },
  { name: "fearOfOperatingTable", fallback: false }, // (it remembers the table now; "The table" lesson, Lessons.js)
  { name: "tableCourage", fallback: 0 },
  { name: "bestestId", fallback: null }, // her favourite foal (Favourites.js)
  { name: "mateRule", fallback: null, clone: true }, // told not to mate (MatingRule.js)
  { name: "met", fallback: null, clone: true }, // who it's met (Acquaintance.js)
  { name: "fears", fallback: null, clone: true }, // Fears.js
  { name: "bellLearn", fallback: 0 }, // FeedBot.js
  { name: "feedBotTips", fallback: 0 },
  { name: "lastBirthAt", fallback: null }, // Population.js
  { name: "milestones", fallback: null, clone: true }, // Identity.js
  { name: "lastTurningAt", fallback: undefined },
  { name: "nameCalledAt", fallback: undefined },
  { name: "favouriteCare", fallback: undefined }, // Personality.js
  { name: "favouriteFound", fallback: null },
  { name: "traitShift", fallback: null, clone: true },
  { name: "growthProgress", fallback: null, clone: true },
  { name: "wish", fallback: null, clone: true }, // Wishes.js
  { name: "wishCooldownUntil", fallback: undefined },
  { name: "contentUntil", fallback: undefined },
  { name: "seenPark", fallback: false },
  { name: "hatWishGrantedAt", fallback: undefined },
  { name: "scars", fallback: undefined, clone: true }, // Scars.js
  { name: "gossip", fallback: undefined, clone: true }, // Gossip.js
  { name: "partiesHad", fallback: undefined, clone: true }, // SharedMemories.js
  { name: "careToday", fallback: undefined, clone: true }, // Care.js
  { name: "formerPet", fallback: null, clone: true }, // Runaways.js
  { name: "_learntFromMum", fallback: undefined }, // FamilyLines.js
  { name: "_echoed", fallback: undefined },
  { name: "rescued", fallback: undefined }, // Shelter.js / Inspector.js
  { name: "title", fallback: null }, // Titles.js
  { name: "titleSince", fallback: undefined },
  { name: "titleState", fallback: undefined, clone: true },
  { name: "strain", fallback: 0 },
  { name: "breakLimit", fallback: undefined },
  { name: "conditioned", fallback: undefined, clone: true },
  { name: "trickFear", fallback: undefined, clone: true }, // FearTraining.js
  { name: "_frightsComforted", fallback: undefined },
  { name: "_stormComfortDay", fallback: undefined },
  { name: "diet", fallback: null }, // Diet.js
  { name: "weight", fallback: 0 },
  { name: "tastes", fallback: null, clone: true },
  { name: "recentMeals", fallback: null, clone: true },
  { name: "boredom", fallback: 0 }, // Play.js
  { name: "toyLikes", fallback: null, clone: true },
  { name: "dirt", fallback: 0 }, // Bath.js
  { name: "bathLike", fallback: undefined },
  // Weren't saved before (a reload reset or cured them)
  { name: "castrationBandTimer", fallback: undefined },
  { name: "castrationBandPainTimer", fallback: undefined },
  { name: "isDiarrhea", fallback: false },
  { name: "isIncontinent", fallback: false },
  { name: "affectionNeglect", fallback: null, clone: true }, // Affection.js
  { name: "warmth", fallback: 1 }, // Warmth.js
];

function _savedCopy(v) {
  return v === null || v === undefined ? v : JSON.parse(JSON.stringify(v));
}

// { name: value } for everything in SAVED_HORSE_FIELDS
function savedHorseFields(f) {
  const out = {};
  for (const fld of SAVED_HORSE_FIELDS) {
    let v = f[fld.name];
    if (v === undefined) v = fld.fallback;
    if (v === undefined) continue;
    out[fld.name] = fld.clone ? _savedCopy(v) : v;
  }
  return out;
}

// Horse.deserialize: put them back (fallbacks for old saves)
function applySavedHorseFields(f, data) {
  for (const fld of SAVED_HORSE_FIELDS) {
    const v = data[fld.name];
    if (v === undefined || v === null) {
      if (fld.fallback !== undefined) f[fld.name] = fld.clone ? _savedCopy(fld.fallback) : fld.fallback;
    } else f[fld.name] = fld.clone ? _savedCopy(v) : v;
  }
}

addHorseMethods({
  serialize() {
    return {
      ...savedHorseFields(this), // SAVED_HORSE_FIELDS above
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
      preferredMilkSources: JSON.parse(JSON.stringify(this.preferredMilkSources)),
      isFrantic: this.isFrantic,
      isScared: this.isScared,
      causeOfDeath: this.causeOfDeath,
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
      smokeOffset: this.smokeOffset ? { x: this.smokeOffset.x, y: this.smokeOffset.y } : null,
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
  },
});
