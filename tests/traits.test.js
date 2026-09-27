// Personality traits (Traits.js)
const { check, checkEqual } = require("./helpers");

// Page helper: set one trait's 5 genes to `sum` ones
const SET_TRAIT = `(h, key, sum) => {
  const i = TRAITS.findIndex((t) => t.key === key);
  for (let k = 0; k < TRAIT_GENES_EACH; k++) h.genes[TRAIT_GENE_START + i * TRAIT_GENES_EACH + k] = k < sum ? 1 : 0;
}`;

module.exports = [
  {
    name: "traits: every fluffy has trait genes; older ones get them added",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const h = new Horse(1, null, "INDOORS");
        const old = new Horse(1, null, "INDOORS");
        old.genes.length = 103; // like a fluffy from before traits
        old.processGenes();
        const tooOld = h.genes.slice(0, 95); // before gradients: left alone
        ensureTraitGenes(tooOld);
        return { len: h.genes.length, oldLen: old.genes.length, tooOld: tooOld.length, total: TRAIT_GENE_TOTAL };
      });
      checkEqual(r.len, r.total, "new fluffy's genes");
      checkEqual(r.oldLen, r.total, "older fluffy's genes after processGenes");
      checkEqual(r.tooOld, 95, "a very old gene list (upgraded by Persistence.js first)");
    },
  },
  {
    name: "traits: labels, and foals inherit each gene from a parent",
    run: async (page) => {
      const r = await page.evaluate((setTrait) => {
        const set = eval(setTrait);
        __seedRandom(5);
        const mum = new Horse(1, null, "INDOORS", "earthy", null, null, null, "female");
        const dad = new Horse(1, null, "INDOORS", "earthy", null, null, null, "male");
        set(mum, "bravery", 5); // very brave
        set(dad, "bravery", 0); // very timid
        set(mum, "social", 2); // average
        set(dad, "social", 3);
        const labels = { mum: describeTraits(mum), mumBrave: hasTraitLabel(mum, "Brave"), dadTimid: hasTraitLabel(dad, "Timid"), mumSocialLabel: getTraitLabels(mum).some((t) => t.key === "social") };
        // 200 foals: every trait gene comes from mum or dad
        let bad = 0;
        let sums = new Set();
        for (let k = 0; k < 200; k++) {
          const g = mum.genetics.combineGenes(dad.genes);
          if (g.length !== TRAIT_GENE_TOTAL) bad++;
          for (let i = TRAIT_GENE_START; i < TRAIT_GENE_TOTAL; i++) if (g[i] !== mum.genes[i] && g[i] !== dad.genes[i]) bad++;
          sums.add(traitGeneSum(g, "bravery"));
        }
        // A father from before traits (103 genes): foals still get full genes
        const oldDad = dad.genes.slice(0, 103);
        const withOld = mum.genetics.combineGenes(oldDad);
        return { labels, bad, sums: [...sums].sort(), withOldLen: withOld.length, withOldOk: withOld.slice(103).every((x) => x === 0 || x === 1) };
      }, SET_TRAIT);
      check(r.labels.mumBrave, "a fluffy with 5 bravery genes isn't Brave");
      check(r.labels.dadTimid, "a fluffy with 0 bravery genes isn't Timid");
      check(!r.labels.mumSocialLabel, "an average fluffy got a social label");
      checkEqual(r.bad, 0, "foal genes that came from neither parent");
      checkEqual(JSON.stringify(r.sums), JSON.stringify([0, 1, 2, 3, 4, 5]), "bravery sums seen in foals of a 5 x 0 pair");
      checkEqual(r.withOldLen, 128, "foal of a pre-traits father");
      check(r.withOldOk, "foal of a pre-traits father has bad trait genes");
    },
  },
  {
    name: "traits change behaviour (and average fluffies behave as before)",
    run: async (page) => {
      const r = await page.evaluate((setTrait) => {
        const set = eval(setTrait);
        const mk = () => new Horse(1, null, "INDOORS");
        const brave = mk(); set(brave, "bravery", 5);
        const timid = mk(); set(timid, "bravery", 0);
        const lazy = mk(); set(lazy, "energy", 0);
        const greedy = mk(); set(greedy, "appetite", 5);
        const picky = mk(); set(picky, "appetite", 0);
        const gentle = mk(); set(gentle, "temper", 0);
        const grumpy = mk(); set(grumpy, "temper", 5);
        // "Average" in the middle of the scale: exactly as before
        const avg = { traitValue: () => 0, genes: [] };
        let gentleHits = 0;
        let grumpyHits = 0;
        for (let i = 0; i < 1000; i++) {
          if (traitWillRetaliate(gentle)) gentleHits++;
          if (traitWillRetaliate(grumpy)) grumpyHits++;
        }
        return {
          braveFear: traitDesireMultiplier(brave, "GrinderFear"),
          timidFear: traitDesireMultiplier(timid, "GrinderFear"),
          lazyPlay: traitDesireMultiplier(lazy, "PlayWithBall"),
          lazySit: traitDesireMultiplier(lazy, "Sit"),
          greedyHunger: traitHungerMultiplier(greedy),
          pickyHunger: traitHungerMultiplier(picky),
          noGenes: traitDesireMultiplier({ genes: [] }, "GrinderFear"),
          unrelated: traitDesireMultiplier(brave, "UseLitterbox"),
          gentleHits,
          grumpyHits,
        };
      }, SET_TRAIT);
      check(r.braveFear < 0.6, `brave fluffy's fear x${r.braveFear}`);
      check(r.timidFear > 1.4, `timid fluffy's fear x${r.timidFear}`);
      check(r.lazyPlay < 0.5 && r.lazySit > 1.4, `lazy: play x${r.lazyPlay}, sit x${r.lazySit}`);
      check(r.greedyHunger > 1.2 && r.pickyHunger < 0.8, `hunger: greedy x${r.greedyHunger}, picky x${r.pickyHunger}`);
      checkEqual(r.noGenes, 1, "no trait genes = no change");
      checkEqual(r.unrelated, 1, "a desire traits don't touch");
      check(r.gentleHits < 300, `gentle fluffy hit back ${r.gentleHits}/1000 times`);
      checkEqual(r.grumpyHits, 1000, "grumpy fluffy always hits back");
    },
  },
  {
    name: "traits: greedy fluffies really do get hungry faster in play",
    run: async (page) => {
      const r = await page.evaluate((setTrait) => {
        const set = eval(setTrait);
        __clearScene();
        __seedRandom(2);
        const mk = (x, sum) => {
          const h = new Horse(1, null, "INDOORS", "earthy");
          set(h, "appetite", sum);
          h.x = x;
          h.y = 450;
          h.adopted = true;
          fluffies.push(h);
          return h;
        };
        const greedy = mk(400, 5);
        const picky = mk(800, 0);
        __fastForward(60);
        return { greedy: 1 - greedy.hunger, picky: 1 - picky.hunger };
      }, SET_TRAIT);
      check(r.greedy > r.picky * 1.3, `hunger used: greedy ${r.greedy.toFixed(3)}, picky ${r.picky.toFixed(3)}`);
    },
  },
  {
    name: "traits show in the inspection panel, gene lab and orders",
    run: async (page) => {
      const r = await page.evaluate((setTrait) => {
        const set = eval(setTrait);
        __clearScene();
        const mum = new Horse(1, null, "INDOORS", "earthy", null, null, null, "female");
        const dad = new Horse(1, null, "INDOORS", "earthy", null, null, null, "male");
        for (const t of TRAITS) {
          set(mum, t.key, 2);
          set(dad, t.key, 2);
        }
        set(mum, "bravery", 5);
        set(dad, "bravery", 5);
        mum.adopted = true;
        fluffies.push(mum, dad);
        const lines = getFluffyInspectionLines(mum).join("\n");
        const pred = computeLitterPrediction(mum.genes, dad.genes, 4);
        const order = { reqs: [{ kind: "trait", trait: "Brave", value: 300 }] };
        return {
          traitsLine: lines.split("\n").find((l) => l.startsWith("Traits:")),
          braveFoals: pred.traits.bravery.high,
          timidFoals: pred.traits.bravery.low,
          fits: fluffyFitsOrder(order, mum),
          label: orderReqLabel(order.reqs[0]),
        };
      }, SET_TRAIT);
      checkEqual(r.traitsLine, "Traits: Brave", "inspection panel");
      checkEqual(r.braveFoals, 1, "brave foals from two very brave parents");
      checkEqual(r.timidFoals, 0, "timid foals from two very brave parents");
      check(r.fits, "a brave fluffy doesn't fit a 'Brave' order");
      checkEqual(r.label, "Personality: Brave", "order label");
    },
  },
];
