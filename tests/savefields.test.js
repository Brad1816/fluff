// The list of saved fluffy fields (HorseSave.js SAVED_HORSE_FIELDS)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "save fields: everything on the list comes back after saving; old saves get the fallbacks",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        const f = new Horse(1, null, "INDOORS", "earthy");
        fluffies.push(f);
        const values = {
          deathTimer: 12, notForSale: true, knowsSong: true, songHeard: 2, runt: true, babyLove: 0.4, smellRejected: "runt", sniffed: ["runt"], badMum: { on: true, slips: 2, strikes: 1, step: 1 }, takenFromMum: 7, forgotMum: true, mumApart: 300, bullied: 2, bullyScore: 1.5, separation: { grief: 0.4 }, traumas: [{ type: "violent" }], hurtByPlayerAt: 99,
          killedByPlayer: true, hasKilled: 2, babyDaddyId: 42, fromPark: true, settling: true, settleStart: 0.7, lastDesire: { desire: "Eat" },
          alicornComfort: 0.3, missingOwner: 0.6, lostPet: true, illness: { type: "flu", t: 50, known: true },
          fluImmuneUntil: 1234, fluVaccinated: true, vetCheckedAt: 77, vetNote: "fine", vetLife: "young",
          ribbons: [{ place: 1, show: "Best Coat", day: 4 }], groomedAt: 321,
          pregCare: { sum: 3, n: 4 }, miscarriageTimer: 7, prematureGrowth: 0.6, bornEarly: "very", frailLeft: 77, incubatorAlone: 66, recovery: { until: 999, risk: 0.2 }, infection: { t: 5 }, flightSkill: 0.44, mourning: { id: 3, name: "Pip", until: 999, visited: false }, pastHerds: [{ id: 4, name: "the Oak herd", day: 2, wild: true }], smartyKind: "good", limbState: { leg_1: "mangled", horn: "mangled" }, alicornIndifferent: true, deformities: ["dim", "odd"], breedWear: 0.4, lostFoalAt: 321, fosterMumId: 12, litterSize: 5, litterBorn: 6, birthVigor: 0.9, midwife: true,
          pregScan: { count: 5, at: 10 }, litterCareAt: 0.8, litterLost: 1, bredHere: true, warmth: 0.4,
          lastKindnessAt: 555, affectionToday: { day: 3, n: { brushed: 2 }, at: { brushed: 500 } },
          tricks: { sit: 0.8, bow: 0.2 }, trickTries: { day: 3, n: 4 }, lessonTries: { day: 3, n: 2 }, smartyReform: 0.3, smartyReformed: true, fearOfOperatingTable: true, tableCourage: 0.5, bestestId: 42, mateRule: { on: true, breaches: 2, strikes: 1, pendingAt: 9 }, met: { 7: 1, 8: 1 }, fears: { thunder: 0.6, dark: 0, bot: 0.2 }, bellLearn: 0.4, feedBotTips: 2, lastBirthAt: 1234,
          milestones: { walk: true, talk: false }, lastTurningAt: 88, nameCalledAt: 66,
          favouriteCare: "treat", favouriteFound: 4, traitShift: { bravery: 0.2 }, growthProgress: { comforted: 3 },
          wish: { id: "toy", since: 5, ache: 0 }, wishCooldownUntil: 77, contentUntil: 99, seenPark: true, hatWishGrantedAt: 44, scars: [{ kind: "ear", how: "Bitten", day: 3 }], gossip: { harm: 0.3, kind: 0, t: 5, feared: 0.02, trusted: 0 }, partiesHad: ["welcome:3"], careToday: { day: 2, praise: 1 }, formerPet: { how: "ran away", day: 3, name: "Rowan" }, _learntFromMum: "sit", _echoed: true, rescued: true, title: "Survivor", titleSince: 9, titleState: { lovedDays: 2 }, strain: 3.5, breakLimit: 11, conditioned: { brush: 3 }, trickFear: { sit: 0.2 }, _frightsComforted: 2, _stormComfortDay: 4,
          diet: 0.83, weight: 0.4, tastes: { kibble: -0.5 }, recentMeals: ["premium_kibble", "kibble"],
          boredom: 0.45, toyLikes: { ball: 0.9 }, dirt: 0.6, bathLike: -0.3,
          castrationBandTimer: 42, castrationBandPainTimer: 3, isDiarrhea: true, isIncontinent: true,
          affectionNeglect: { day: 2, seen: { hungry: true } },
        };
        Object.assign(f, values);
        const missing = SAVED_HORSE_FIELDS.map((x) => x.name).filter((n) => !(n in values));
        const copy = Horse.deserialize(JSON.parse(JSON.stringify(f.serialize())));
        const wrong = Object.keys(values).filter((k) => JSON.stringify(copy[k]) !== JSON.stringify(values[k]));
        // A copy, not the same object
        const shared = copy.illness === f.illness;
        // Old save: none of these fields
        const data = JSON.parse(JSON.stringify(f.serialize()));
        for (const x of SAVED_HORSE_FIELDS) delete data[x.name];
        const old = Horse.deserialize(data);
        const fallbacks = SAVED_HORSE_FIELDS.filter((x) => x.fallback !== undefined)
          .filter((x) => JSON.stringify(old[x.name]) !== JSON.stringify(x.fallback))
          .map((x) => x.name);
        for (const h of [copy, old]) {
          const i = fluffies.indexOf(h);
          if (i >= 0) fluffies.splice(i, 1);
        }
        return { missing, wrong, shared, fallbacks, vetChecked: old.vetCheckedAt };
      });
      checkEqual(r.missing.length, 0, `fields the test doesn't set: ${r.missing}`);
      checkEqual(r.wrong.length, 0, `fields that didn't come back: ${r.wrong}`);
      checkEqual(r.shared, false, "loaded objects are copies");
      checkEqual(r.fallbacks.length, 0, `old save fallbacks wrong for: ${r.fallbacks}`);
      checkEqual(r.vetChecked, undefined, "never checked stays undefined");
    },
  },
];
