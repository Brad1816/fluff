// The Gene Lab (GeneLab.js). Buying, selling, picking up and saving it are
// covered by items.test.js, like every other shop item.
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "gene lab predictions follow the inheritance rules",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const realRandom = Math.random;
        const base = () => {
          const g = new Array(103).fill(0);
          // miscarriage genes: all different numbers, so every foal lives
          [65, 66, 67, 68, 69, 70].forEach((i, k) => (g[i] = k));
          return g;
        };
        // Both parents have all 5 wing genes: every foal gets wings
        const winged = base();
        for (let i = 53; i < 58; i++) winged[i] = 1;
        const allWings = computeLitterPrediction(winged, winged.slice(), 1);
        // Neither has any: no foal gets wings
        const none = computeLitterPrediction(base(), base(), 2);
        // One has 5 wing genes, the other 0: every foal gets roughly half
        // (0-5 of them), so some show wings and some are carriers
        const mixed = computeLitterPrediction(winged, base(), 3);

        // Born alive: with the same miscarriage genes on both sides the
        // chance drops (each pair: 1 - matches/4)
        const same = base();
        const dadSame = base();
        const aliveSame = geneLabViability(same, dadSame);
        const aliveDifferent = geneLabViability(same, (() => { const g = base(); [65, 66, 67, 68, 69, 70].forEach((i, k) => (g[i] = k + 10)); return g; })());

        return {
          allWings: allWings.pct.pegasus + allWings.pct.alicorn,
          none: none.pct.pegasus + none.pct.alicorn + none.pct.wingCarrier,
          mixedShows: mixed.pct.pegasus,
          mixedCarrier: mixed.pct.wingCarrier,
          aliveSame,
          aliveDifferent,
          examples: geneLabExampleFoals(mixed, 7).length,
          randomRestored: Math.random === realRandom,
        };
      });
      checkEqual(r.allWings, 1, "wings when both parents have them");
      checkEqual(r.none, 0, "wings when neither has any");
      check(r.mixedShows > 0.05 && r.mixedShows < 0.5, `wings shown for a 5+0 pair: ${r.mixedShows}`);
      check(r.mixedCarrier > 0.1 && r.mixedCarrier < 0.5, `wing carriers for a 5+0 pair: ${r.mixedCarrier}`);
      checkEqual(r.aliveDifferent, 1, "born alive with no shared miscarriage genes");
      // each pair: same numbers in the same slots = 2 of 4 combinations match
      checkEqual(r.aliveSame, 0.125, "born alive when both parents have identical miscarriage genes");
      checkEqual(r.examples, 7, "example foals");
      check(r.randomRestored, "the lab didn't give the game back its random numbers");
    },
  },
  {
    name: "gene lab: right-click it, pick parents, see a prediction, close",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const ids = await page.evaluate(() => {
        __clearScene();
        __seedRandom(8);
        tutorialTimer = 0;
        const mk = (name, gender) => {
          const h = new Horse(1, null, "INDOORS", "earthy", null, null, null, gender);
          h.adopted = true;
          h.x = 250 + fluffies.length * 150;
          h.y = 620;
          fluffyNames[h.id] = name;
          fluffies.push(h);
          return h;
        };
        const mum = mk("Mum", "female");
        const dad = mk("Dad", "male");
        const lab = new GeneLab("INDOORS");
        lab.setPosition(640, 420);
        objects.push(lab);
        return { mum: mum.id, dad: dad.id };
      });

      await page.mouse.click(640, 380, { button: "right" });
      check(await page.evaluate(() => isGeneLabOpen()), "right-clicking the lab didn't open it");
      check(await page.evaluate(() => isAnyScreenOpen()), "the game doesn't know a screen is open");

      const rowPos = (gender, idx) =>
        page.evaluate(({ gender, idx }) => {
          const r = _geneLabVisibleRows(gender)[idx];
          const { s, ox, oy } = _glOrigin();
          return { x: ox + (r.x + r.w / 2) * s, y: oy + (r.y + r.h / 2) * s };
        }, { gender, idx });
      let p = await rowPos("female", 0);
      await page.mouse.click(p.x, p.y);
      p = await rowPos("male", 0);
      await page.mouse.click(p.x, p.y);
      const chosen = await page.evaluate(() => {
        const pred = _geneLabPrediction();
        return { m: geneLabMotherId, f: geneLabFatherId, has: !!pred, total: pred ? Object.values(pred.result.pct).length : 0 };
      });
      checkEqual(chosen.m, ids.mum, "mother picked");
      checkEqual(chosen.f, ids.dad, "father picked");
      check(chosen.has, "no prediction shown");
      await page.waitForTimeout(100); // draw a frame with the example foals

      // Drawing example foals mustn't use up fluffy ids
      const nextBefore = await page.evaluate(() => nextFluffyId);
      await page.waitForTimeout(100);
      checkEqual(await page.evaluate(() => nextFluffyId), nextBefore, "fluffy ids after drawing");

      const close = await page.evaluate(() => {
        const b = GL_BUTTONS.close;
        const { s, ox, oy } = _glOrigin();
        return { x: ox + (b.x + b.w / 2) * s, y: oy + (b.y + b.h / 2) * s };
      });
      await page.mouse.click(close.x, close.y);
      check(!(await page.evaluate(() => isGeneLabOpen())), "Close didn't close it");
    },
  },
  {
    name: "gene lab shows a pregnant mare's current litter",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(9);
        const mum = new Horse(1, null, "INDOORS", "earthy", null, null, null, "female");
        const dad = new Horse(1, null, "INDOORS", "earthy", null, null, null, "male");
        [mum, dad].forEach((h) => { h.adopted = true; fluffies.push(h); });
        mum.anatomy.triggerPregnancy(dad);
        openGeneLab();
        // Pick her like a click on her row would
        mouse.x = -1000; // (not used; call the same code as a click)
        geneLabMotherId = null;
        const row = _geneLabVisibleRows("female")[0];
        const { s, ox, oy } = _glOrigin();
        mouse.x = ox + (row.x + 5) * s;
        mouse.y = oy + (row.y + 5) * s;
        handleGeneLabClick();
        const firstDadRow = _geneLabVisibleRows("male")[0];
        const pred = _geneLabPrediction();
        closeGeneLab();
        return { father: geneLabFatherId, firstRow: firstDadRow.id, pregnancy: pred && pred.pair.pregnancy };
      });
      checkEqual(r.father, "PREGNANCY", "father chosen automatically");
      checkEqual(r.firstRow, "PREGNANCY", "first father row");
      checkEqual(r.pregnancy, true, "prediction is for her pregnancy");
    },
  },
  {
    name: "gene lab warns when the two are related",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        const mk = (gender, mom = null, dad = null) => {
          const h = new Horse(1, mom ? mom.id : null, "INDOORS", "earthy", null, null, null, gender);
          if (dad) h.fatherId = dad.id;
          h.adopted = true;
          fluffies.push(h);
          return h;
        };
        const mum = mk("female");
        const dad = mk("male");
        const sis = mk("female", mum, dad);
        const bro = mk("male", mum, dad);
        const half = mk("male", mum);
        const stranger = mk("male");
        syncFamilyRecords();
        return {
          sibs: describeFamilyRelation(sis.id, bro.id),
          half: describeFamilyRelation(sis.id, half.id),
          parent: describeFamilyRelation(mum.id, bro.id),
          none: describeFamilyRelation(sis.id, stranger.id),
        };
      });
      checkEqual(r.sibs, "brother and sister", "full siblings");
      checkEqual(r.half, "half-siblings", "half siblings");
      checkEqual(r.parent, "parent and foal", "parent");
      checkEqual(r.none, null, "strangers");
    },
  },
];
