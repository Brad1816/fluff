// Growing old (Aging.js) and abandoned fluffies (Abandoned.js)
const { check, checkEqual } = require("./helpers");

const DAY = 1200;

module.exports = [
  {
    name: "aging: life stages, greying, slower and cheaper when old; elderly mares don't get pregnant",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(21);
        const mk = (days, gender = "female") => {
          const h = new Horse(1, null, "INDOORS", "earthy", genes ? genes.slice() : null, 0.6, 0.6, gender);
          genes = genes || h.genes.slice();
          h.age = days * DAY_LENGTH;
          h.adopted = true;
          h.happiness = 0.6;
          fluffies.push(h);
          return h;
        };
        let genes = null;
        const young = mk(12);
        const senior = mk(52);
        const old = mk(76);
        const foal = new Horse(0.4, null, "INDOORS", "earthy");
        foal.age = 0.4 * GROW_UP_TIME;
        const out = {
          stages: [foal, young, senior, old].map(lifeStage),
          ages: [foal, young, senior, old].map((f) => getFluffyInspectionInfo(f).about.find((x) => x.label === "Age").value),
          grey: [young, senior, old].map((f) => +greyAmount(f).toFixed(2)),
          maneSame: maneColorFor(young) === young.colors.mane,
          maneOld: maneColorFor(old),
          prices: [young, senior, old].map((f) => f.calculatePrice()),
        };
        for (const f of [young, old]) {
          f.currentStateKey = "IDLE";
          f.updateSpeed();
        }
        out.speed = [young.speed, old.speed];
        const dad = mk(5, "male");
        old.triggerPregnancy(dad);
        young.triggerPregnancy(dad);
        out.pregnant = [young.isPregnant, old.isPregnant];
        // Tints are redrawn when a fluffy goes greyer
        agingTicker.fireNext();
        updateAging(0);
        senior.renderer.tinted = { marker: true };
        senior.age = 66 * DAY_LENGTH;
        agingTicker.fireNext();
        updateAging(0);
        out.retinted = senior.renderer.tinted === null;
        return out;
      });
      checkEqual(JSON.stringify(r.stages), JSON.stringify(["foal", "adult", "senior", "elderly"]), "stages");
      check(/^Foal, 40% grown/.test(r.ages[0]), r.ages[0]);
      checkEqual(r.ages[1], "Adult, 1 year old", "adult age");
      checkEqual(r.ages[2], "Senior, 4 years, 4 months old", "senior age");
      checkEqual(r.ages[3], "Elderly, 6 years, 4 months old", "elderly age");
      check(r.grey[0] === 0 && r.grey[1] > 0 && r.grey[2] > r.grey[1], `grey ${r.grey}`);
      check(r.maneSame, "no grey when young");
      const [rr, gg, bb] = r.maneOld.match(/\d+/g).map(Number);
      check(Math.abs(rr - 214) < 60 && Math.abs(gg - 214) < 60 && Math.abs(bb - 214) < 60, `old mane nearly silver ${r.maneOld}`);
      check(r.prices[1] < r.prices[0] && r.prices[2] < r.prices[1], `prices ${r.prices}`);
      check(r.speed[1] < r.speed[0], `speed ${r.speed}`);
      checkEqual(JSON.stringify(r.pregnant), JSON.stringify([true, false]), "young mare pregnant, elderly not");
      check(r.retinted, "redrawn greyer");
    },
  },
  {
    name: "aging: fluffies die of old age - never young, sometimes when old, always by 8 years",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(22);
        const mk = (days) => {
          const h = new Horse(1, null, "INDOORS", "earthy");
          h.age = days * DAY_LENGTH;
          h.adopted = true;
          fluffies.push(h);
          return h;
        };
        const young = Array.from({ length: 10 }, () => mk(62));
        const old = Array.from({ length: 30 }, () => mk(87));
        const ancient = mk(96.5);
        // One game day of checks (ages held still)
        for (let t = 0; t < DAY_LENGTH; t += AGING_TICK) {
          for (const f of fluffies) if (f.isAlive) f.age = f.age; // unchanged
          agingTicker.fireNext();
          updateAging(0);
        }
        return {
          youngDead: young.filter((f) => !f.isAlive).length,
          oldDead: old.filter((f) => !f.isAlive).length,
          ancient: [ancient.isAlive, ancient.causeOfDeath],
          msg: uiMessages.some((m) => /died peacefully of old age/.test(m.text)),
        };
      });
      checkEqual(r.youngDead, 0, "5-year-olds don't die of old age");
      check(r.oldDead >= 2 && r.oldDead <= 16, `7-year-olds dying in a day: ${r.oldDead}/30 (expect ~7)`);
      checkEqual(JSON.stringify(r.ancient), JSON.stringify([false, "Old age"]), "8 years is the limit");
      check(r.msg, "you're told");
    },
  },
  {
    name: "aging: fluffies that turn up already grown have a believable age",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        __seedRandom(23);
        const adults = Array.from({ length: 20 }, () => _makeWild(1, { x: 800, y: 700 }, { personalities: ["true_feral"] }));
        const foal = _makeWild(0.5, { x: 800, y: 700 }, { personalities: [] });
        restockMarket(2);
        const bought = buyStockListing(stockMarket.listings[0].id) || null;
        money = 1e6;
        const b = bought || buyStockListing(stockMarket.listings[0].id);
        return {
          days: adults.map((f) => ageDays(f)),
          foal: foal.age,
          stock: ageDays(b),
        };
      });
      check(Math.min(...r.days) >= 2.4 && Math.max(...r.days) <= 34, `wild adult ages ${Math.min(...r.days)}-${Math.max(...r.days)}`);
      check(Math.abs(r.foal - 0.5 * 2400) < 1, `foal age ${r.foal}`);
      check(r.stock >= 2.5 && r.stock <= 20, `stock age ${r.stock}`);
    },
  },
  {
    name: "abandoned: dumped pets are named, any age, sad until they get over their old owner",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        __seedRandom(24);
        previousOwnerNames = {};
        const out = {};
        const many = Array.from({ length: 60 }, () => _makeWild(1, { x: 800, y: 700 }, { personalities: ["abandoned"] }));
        out.named = many.every((f) => !!fluffyNames[f.id] && namedBy(f) === "its old owner");
        out.stages = many.reduce((acc, f) => ((acc[lifeStage(f)] = (acc[lifeStage(f)] || 0) + 1), acc), {});
        out.missing = [Math.min(...many.map((f) => f.missingOwner)), Math.max(...many.map((f) => f.missingOwner))];
        const young = _makeWild(1, { x: 800, y: 700 }, { personalities: ["abandoned"], youngAbandoned: true });
        out.youngGrowth = young.growth;
        // Outside the house
        let outside = null;
        for (let i = 0; i < 80 && !outside; i++) {
          const before = fluffies.length;
          spawnFeralGroup("OUTDOORS", "lone");
          outside = fluffies.slice(before).find((f) => isAbandoned(f));
        }
        out.outside = outside ? [!!fluffyNames[outside.id], outside.missingOwner > 0] : null;

        // Sad: happiness drifts lower while it misses its owner
        const f = many[0];
        f.missingOwner = 1;
        f.happiness = 0.6;
        for (let t = 0; t < 180; t++) {
          abandonedTicker.fireNext();
          updateAbandoned(0);
        }
        out.sadder = f.happiness;
        out.row = getFluffyInspectionInfo(f).care.find((x) => x.label === "Old owner");
        // Yours and trusting: gets over it; wild: slower
        const mine = many[1];
        const wild = many[2];
        for (const x of [mine, wild]) {
          x.missingOwner = 0.5;
          x.age = 5 * DAY_LENGTH;
        }
        mine.adopted = true;
        mine.playerTrust = 1;
        for (let t = 0; t < 1600; t++) {
          abandonedTicker.fireNext();
          updateAbandoned(0);
        }
        out.mine = mine.missingOwner;
        out.wild = wild.missingOwner;
        out.msg = uiMessages.some((m) => /got over its old owner/.test(m.text));
        out.rowAfter = getFluffyInspectionInfo(mine).care.find((x) => x.label === "Old owner") || null;
        // Saved with the fluffy
        wild.missingOwner = 0.42;
        const copy = Horse.deserialize(JSON.parse(JSON.stringify(wild.serialize())));
        out.saved = copy.missingOwner;
        fluffies.splice(fluffies.indexOf(copy), 1);
        return out;
      });
      check(r.named, "all named by their old owner");
      check((r.stages.adult || 0) > 15 && (r.stages.senior || 0) + (r.stages.elderly || 0) > 15, `ages ${JSON.stringify(r.stages)}`);
      check(r.missing[0] >= 0.7 && r.missing[1] <= 1, `missing ${r.missing}`);
      check(r.youngGrowth >= 0.5 && r.youngGrowth < 1, `young one ${r.youngGrowth}`);
      check(r.outside && r.outside[0] && r.outside[1], `abandoned outside ${JSON.stringify(r.outside)}`);
      check(Math.abs(r.sadder - 0.3) < 0.03, `happiness pulled down to ${r.sadder}`);
      check(r.row && /Misses its old owner/.test(r.row.value), JSON.stringify(r.row));
      checkEqual(r.mine, 0, "yours gets over it");
      check(r.wild > 0.3, `wild one still misses its owner ${r.wild}`);
      check(r.msg, "you're told");
      checkEqual(r.rowAfter, null, "row gone");
      check(Math.abs(r.saved - 0.42) < 1e-9, `saved ${r.saved}`);
    },
  },
];
