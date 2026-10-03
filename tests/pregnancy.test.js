// Pregnancy and foal care (Pregnancy.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(31);
  window.__mk = (gender = "female", opts = {}) => {
    const h = new Horse(opts.growth ?? 1, null, "INDOORS", "earthy", null, 0.5, 0.5, gender);
    h.x = 400 + fluffies.length * 40;
    h.y = 450;
    h.hunger = 1;
    h.happiness = 0.8;
    h.health = 100;
    h.adopted = true;
    if (typeof setSpawnAge === "function") setSpawnAge(h, 5, 6);
    fluffies.push(h);
    return h;
  };
  window.__mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
}`;

module.exports = [
  {
    name: "pregnancy: litter size runs in families, and seniors have fewer",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mare = __mk();
        const sire = __mk("male");
        const sample = (bornIn, sireBornIn = null) => {
          mare.litterBorn = bornIn;
          sire.litterBorn = sireBornIn;
          const out = [];
          for (let i = 0; i < 2000; i++) out.push(plannedLitterSize(mare, sire));
          return out;
        };
        const unknown = sample(null);
        const big = sample(7, 7);
        const small = sample(1, 1);
        const mixed = sample(7, 1);
        mare.litterBorn = null;
        sire.litterBorn = null;
        mare.age = (SENIOR_DAYS + 1) * DAY_LENGTH;
        const senior = [];
        for (let i = 0; i < 2000; i++) senior.push(plannedLitterSize(mare, sire));
        const all = [...unknown, ...big, ...small, ...senior];
        return {
          unknown: __mean(unknown),
          big: __mean(big),
          small: __mean(small),
          mixed: __mean(mixed),
          senior: __mean(senior),
          min: Math.min(...all),
          max: Math.max(...all),
          sevens: unknown.filter((n) => n === 7).length / unknown.length,
        };
      }, SETUP);
      check(Math.abs(r.unknown - 4) < 0.2, `no family history: about 4 (${r.unknown})`);
      check(r.big > 5.2 && r.big < 5.8, `from big litters: about 5.5 (${r.big})`);
      check(r.small > 2.3 && r.small < 2.9, `from small litters: about 2.5 (${r.small})`);
      check(Math.abs(r.mixed - 4) < 0.25, `one of each: about 4 (${r.mixed})`);
      check(r.senior < r.unknown - 0.7, `seniors have fewer (${r.senior})`);
      check(r.min === 1 && r.max === 7, `1 to 7 (${r.min}-${r.max})`);
      check(r.sevens < 0.08, `seven foals is rare now (${r.sevens})`);
    },
  },
  {
    name: "pregnancy: care is tracked while she's pregnant; the vet scans and books a midwife",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const good = __mk();
        const bad = __mk();
        const dad = __mk("male");
        good.anatomy.triggerPregnancy(dad);
        bad.anatomy.triggerPregnancy(dad);
        bad.hunger = 0.05;
        bad.happiness = 0.2;
        bad.health = 50;
        bad.playerFear = 0.8;
        for (let i = 0; i < 30; i++) {
          pregnancyCareTicker.fireNext();
          updatePregnancyCare(0);
        }
        const out = {
          good: pregnancyCareScore(good),
          bad: pregnancyCareScore(bad),
          goodRow: describePregnancy(good),
          badRow: describePregnancy(bad),
          notPregnant: describePregnancy(dad),
        };
        // The vet
        money = 1000;
        bad.babiesToBirth = 6;
        vetCheckUp(bad);
        out.scan = bad.pregScan && bad.pregScan.count;
        out.note = bad.vetNote;
        out.row = describePregnancy(bad)[0];
        out.jab = vetJab(bad); // no jabs while pregnant
        out.midwife = vetMidwife(bad);
        out.again = vetMidwife(bad);
        out.money = money;
        return out;
      }, SETUP);
      check(r.good > 0.85, `well looked after ${r.good}`);
      check(r.bad < 0.4, `neglected ${r.bad}`);
      check(/^Due in \d+ min · care: Great$/.test(r.goodRow[0]) && r.goodRow[1] === "good", JSON.stringify(r.goodRow));
      check(/care: Poor/.test(r.badRow[0]) && r.badRow[1] === "bad", JSON.stringify(r.badRow));
      checkEqual(r.notPregnant[0], "No", "not pregnant");
      checkEqual(r.scan, 6, "the scan counts the foals");
      check(/expecting 6 foals/.test(r.note) && /risky/.test(r.note) && /midwife/.test(r.note), r.note);
      check(/expecting 6/.test(r.row), r.row);
      checkEqual(r.jab, false, "no jab while pregnant");
      check(r.midwife && !r.again, "midwife booked once");
      checkEqual(r.money, 1000 - 20 - 60, "check-up $20 + midwife $60");
    },
  },
  {
    name: "pregnancy: poor care loses foals and causes stillbirths; births cost less with care, a midwife keeps her alive",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mare = __mk();
        const trial = (care) => {
          let born = 0;
          let alive = 0;
          for (let i = 0; i < 400; i++) {
            mare.babiesToBirth = 5;
            mare.foalViability = [true, true, true, true, true];
            mare.pregCare = { sum: care, n: 1 };
            onLabourStarts(mare);
            born += mare.babiesToBirth;
            alive += mare.foalViability.filter(Boolean).length;
          }
          return { born: born / 400, alive: alive / 400 };
        };
        const out = { great: trial(0.9), fair: trial(0.55), poor: trial(0.2) };
        mare.litterCareAt = 1;
        out.costGreat = birthHealthCost(mare, true);
        mare.litterCareAt = 0;
        out.costNone = birthHealthCost(mare, true);
        out.costStill = birthHealthCost(mare, false);
        mare.midwife = true;
        out.costMidwife = birthHealthCost(mare, true);
        mare.health = 12;
        mare.litterCareAt = 0;
        const died = applyBirthHealthCost(mare, false);
        out.midwifeSaves = { died, health: mare.health };
        mare.midwife = false;
        mare.health = 12;
        out.noMidwife = applyBirthHealthCost(mare, false);
        return out;
      }, SETUP);
      checkEqual(r.great.born, 5, "great care keeps them all");
      checkEqual(r.great.alive, 5, "and all alive");
      check(r.fair.born < 5 && r.fair.born > 4.4, `fair care loses a few (${r.fair.born})`);
      check(r.fair.alive === r.fair.born, "fair care: no extra stillbirths");
      check(r.poor.born < 4, `poor care loses more (${r.poor.born})`);
      check(r.poor.alive < r.poor.born * 0.9, `and more stillbirths (${r.poor.alive} of ${r.poor.born})`);
      check(Math.abs(r.costGreat - 15) < 1e-9 && Math.abs(r.costNone - 25) < 1e-9, `per birth ${r.costGreat} / ${r.costNone}`);
      check(Math.abs(r.costStill - 50) < 1e-9, `stillbirth x2 ${r.costStill}`);
      check(Math.abs(r.costMidwife - 12.5) < 1e-9, `midwife halves it ${r.costMidwife}`);
      check(!r.midwifeSaves.died && r.midwifeSaves.health === 10, `midwife keeps her alive ${JSON.stringify(r.midwifeSaves)}`);
      checkEqual(r.noMidwife, true, "without one she can die");
    },
  },
  {
    name: "pregnancy: a real birth - foals remember their litter, care sets how strong they are and how fast they grow",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk();
        const dad = __mk("male");
        mum.anatomy.triggerPregnancy(dad);
        mum.babiesToBirth = 3;
        mum.foalViability = [true, true, true];
        mum.pregCare = { sum: 0.95, n: 1 };
        mum.midwife = true;
        mum.pregnancyTimer = 0.1;
        const said = [];
        const realMsg = window.addUIMessage;
        window.addUIMessage = (t) => {
          said.push(t);
          realMsg(t);
        };
        try {
          __fastForward(20);
        } finally {
          window.addUIMessage = realMsg;
        }
        const foals = fluffies.filter((f) => f.motherId === mum.id);
        const out = {
          n: foals.length,
          litterBorn: foals.map((f) => f.litterBorn),
          vigor: foals.filter((f) => !f.runt).map((f) => f.birthVigor), // (a runt is born weaker: Runts.js)
          done: !mum.isPregnant,
          msg: said.find((t) => /had \d foal/.test(t)),
          midwifeAfter: mum.midwife,
          mumHealth: mum.health,
          born: describeBirth(foals.find((f) => !f.runt) || foals[0]), // (not a runt: Runts.js)
        };
        // A weak foal from a hard pregnancy
        const weakMum = __mk();
        weakMum.litterSize = 4;
        weakMum.litterCareAt = 0.1;
        const weak = new Horse(0, weakMum.id, "INDOORS", "earthy", null, 0.5, 0.5, "female");
        onFoalBorn(weakMum, weak, true);
        out.weak = { vigor: weak.birthVigor, health: weak.health, row: describeBirth(weak) };
        // Growth: strong and fed vs weak and hungry
        const strong = foals.find((f) => !f.runt) || foals[0];
        strong.hunger = 1;
        weak.hunger = 0.05;
        out.rates = { strong: foalGrowthRate(strong), weak: foalGrowthRate(weak), adult: foalGrowthRate(mum), none: foalGrowthRate({ growth: 0.5, hunger: 0.5 }) };
        return out;
      }, SETUP);
      checkEqual(r.n, 3, "three foals");
      checkEqual(JSON.stringify(r.litterBorn), JSON.stringify([3, 3, 3]), "each knows its litter size");
      check(r.vigor.every((v) => v >= 1.1), `strong foals from great care ${r.vigor}`);
      check(r.done, "she's finished");
      check(/had 3 foals\. She was well looked after/.test(r.msg || ""), `message: ${r.msg}`);
      checkEqual(r.midwifeAfter, false, "the midwife goes home");
      check(r.mumHealth > 100 - 3 * 15, `midwife and care: little health lost (${r.mumHealth})`);
      checkEqual(JSON.stringify(r.born), JSON.stringify(["one of 3, strong", "good"]), "magnifying glass");
      check(r.weak.vigor < 0.85 && r.weak.health <= 85, `weak foal ${JSON.stringify(r.weak)}`);
      check(/weak/.test(r.weak.row[0]) && r.weak.row[1] === "bad", JSON.stringify(r.weak.row));
      check(r.rates.strong > 1.1 && r.rates.weak < 0.45, `growth rates ${JSON.stringify(r.rates)}`);
      checkEqual(r.rates.adult, 1, "adults don't grow");
      checkEqual(r.rates.none, 1, "an ordinary fed foal grows at the usual speed");
    },
  },
  {
    name: "pregnancy: stick training - ordinary fluffies learn from watching, smarties don't",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const victim = __mk();
        const watcher = __mk();
        const smarty = __mk("male");
        smarty.personalities = ["smarty"];
        watcher.pottyTraining = 0;
        smarty.pottyTraining = 0;
        notifyViolence(victim, false, "stick", true);
        return { watcher: watcher.pottyTraining, smarty: smarty.pottyTraining, has: typeof notifyViolence };
      }, SETUP);
      checkEqual(r.has, "function", "notifyViolence exists");
      check(r.watcher > 0, `an ordinary fluffy learned by watching (${r.watcher})`);
      checkEqual(r.smarty, 0, "a smarty didn't");
    },
  },
];
