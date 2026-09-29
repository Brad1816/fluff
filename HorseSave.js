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
  { name: "separation", fallback: null, clone: true }, // Separation.js
  { name: "traumas", fallback: [], clone: true },
  { name: "hurtByPlayerAt", fallback: null }, // Memory.js
  { name: "killedByPlayer", fallback: false },
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
  { name: "diet", fallback: null }, // Diet.js
  { name: "weight", fallback: 0 },
  { name: "tastes", fallback: null, clone: true },
  { name: "recentMeals", fallback: null, clone: true },
  { name: "boredom", fallback: 0 }, // Play.js
  { name: "toyLikes", fallback: null, clone: true },
  { name: "warmth", fallback: 1 }, // Warmth.js // Commissions.js (null = an old save: worked out from the mother)
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
