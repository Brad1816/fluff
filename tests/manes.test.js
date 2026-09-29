// Fancy manes (ManePatterns.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(61);
  window.__mk = (kind = null, gender = "female", colour = [240, 80, 160]) => {
    const h = new Horse(1, null, "INDOORS", "earthy", null, 0.6, 0.6, gender);
    const s = MANE_GENE_START;
    for (let b = 0; b < 4; b++) h.genes[s + b] = kind ? 1 : 0;
    h.genes[s + 4] = kind === "tipped" ? 1 : kind === "rainbow" ? 2 : 0;
    h.genes[s + 5] = kind === "rainbow" ? 1 : 0;
    h.genes[s + 6] = kind === "rainbow" ? 1 : 0;
    [h.genes[s + 7], h.genes[s + 8], h.genes[s + 9]] = colour;
    h.genetics.processGenes();
    h.renderer.tinted = null;
    h.adopted = true;
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "manes: most fluffies are plain; fancy manes rare, rainbow very rare",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const N = 20000;
        const c = { fancy: 0, rainbow: 0, streaked: 0, tipped: 0 };
        // Plain fluffies: gradient, spots, stripes and fancy manes all rare
        let plainish = 0;
        let gradient = 0;
        for (let i = 0; i < 2000; i++) {
          const h = new Horse(1, null, "INDOORS", "earthy", null, 0.6, 0.6, "female");
          if (h.hasGradient) gradient++;
          if (!h.hasGradient && !h.hasSpots && !h.hasStripes && !h.manePattern) plainish++;
          if (relationships[h.id]) delete relationships[h.id];
        }
        c.gradientShare = gradient / 2000;
        c.plainShare = plainish / 2000;
        for (let i = 0; i < N; i++) {
          const p = manePatternOfGenes(HorseGenetics.prototype.generateRandomGenes.call({ horse: {} }));
          if (!p) continue;
          c.fancy++;
          c[p.kind]++;
        }
        for (const k of ["fancy", "rainbow", "streaked", "tipped"]) c[k] /= N;
        const len = HorseGenetics.prototype.generateRandomGenes.call({ horse: {} }).length;
        return { ...c, len };
      }, SETUP);
      check(r.fancy > 0.045 && r.fancy < 0.08, `about 1 in 16 have a fancy mane (${r.fancy})`);
      check(r.rainbow > 0.001 && r.rainbow < 0.01, `rainbow about 1 in 200 (${r.rainbow})`);
      check(r.streaked > r.tipped && r.tipped > r.rainbow, `streaked commonest, rainbow rarest ${JSON.stringify(r)}`);
      checkEqual(r.len, 139, "gene count");
      check(r.gradientShare < 0.1, `gradients are rare now (${r.gradientShare})`);
      check(r.plainShare > 0.65, `most fluffies are plain (${r.plainShare})`);
    },
  },
  {
    name: "manes: inherited like spots; old fluffies stay plain; saved with the genes",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const breed = (a, b) => {
          const c = { plain: 0, streaked: 0, tipped: 0, rainbow: 0 };
          for (let i = 0; i < 1000; i++) {
            const p = manePatternOfGenes(a.genetics.combineGenes(b.genes));
            c[p ? p.kind : "plain"]++;
          }
          return c;
        };
        const s1 = __mk("streaked");
        const s2 = __mk("streaked", "male");
        const r1 = __mk("rainbow");
        const r2 = __mk("rainbow", "male");
        const plain = __mk(null, "male");
        const out = { ss: breed(s1, s2), rr: breed(r1, r2), sp: breed(s1, plain) };
        // A fluffy from before fancy manes (128 genes)
        const old = new Horse(1, null, "INDOORS", "earthy", s1.genes.slice(0, 128), 0.6, 0.6, "female");
        out.old = { pattern: old.manePattern, len: old.genes.length };
        out.oldFoals = breed(old, plain).plain;
        // Saved and loaded
        const copy = Horse.deserialize(JSON.parse(JSON.stringify(r1.serialize())));
        out.saved = copy.manePattern && copy.manePattern.kind;
        fluffies.splice(fluffies.indexOf(copy), 1);
        return out;
      }, SETUP);
      checkEqual(r.ss.streaked, 1000, "two streaked parents: all streaked");
      checkEqual(r.rr.rainbow, 1000, "two rainbow parents: all rainbow");
      check(r.sp.plain > 850, `streaked x plain: mostly plain ${JSON.stringify(r.sp)}`);
      check(r.sp.plain < 1000, "but it can come through (it's carried)");
      checkEqual(r.old.pattern, null, "an older fluffy has a plain mane");
      checkEqual(r.old.len, 139, "its genes are filled in");
      checkEqual(r.oldFoals, 1000, "and its foals with a plain fluffy are plain");
      checkEqual(r.saved, "rainbow", "kept after saving");
    },
  },
  {
    name: "manes: worth more, shown in the magnifying glass, family tree and Gene Lab",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const plain = __mk(null);
        const streak = __mk("streaked");
        streak.genes = plain.genes.slice();
        const s = MANE_GENE_START;
        for (let b = 0; b < 4; b++) streak.genes[s + b] = 1;
        streak.genes[s + 4] = 0;
        streak.genetics.processGenes();
        const rain = __mk("rainbow");
        rain.genes = streak.genes.slice();
        rain.genes[s + 4] = 2;
        rain.genes[s + 5] = 1;
        rain.genes[s + 6] = 1;
        rain.genetics.processGenes();
        const tipped = __mk("tipped", "female", [30, 30, 200]);
        const out = {
          price: [plain.calculatePrice(), streak.calculatePrice(), rain.calculatePrice()],
          text: [describeManePattern(plain), describeManePattern(streak), describeManePattern(rain), describeManePattern(tipped)],
          tree: describeGenes(rain.genes),
        };
        const d = describeGenes(streak.genes);
        out.treeStreak = { fancy: d.maneFancy, kind: d.manePattern && d.manePattern.kind };
        const lab = computeLitterPrediction(streak.genes, streak.genes, 1);
        out.lab = lab.pct.fancyMane;
        const labPlain = computeLitterPrediction(plain.genes, plain.genes, 1);
        out.labPlain = labPlain.pct.fancyMane;
        // Magnifying glass row
        out.stock = stockVisibleFeatures(rain.genes);
        return out;
      }, SETUP);
      check(Math.abs(r.price[1] / r.price[0] - 1.3) < 0.05, `streaked +30% (${r.price})`);
      check(Math.abs(r.price[2] / r.price[0] - 2) < 0.1, `rainbow x2 (${r.price})`);
      checkEqual(r.text[0], null, "plain: no row");
      check(/^Streaked \(\w+ streaks\)$/.test(r.text[1]), r.text[1]);
      checkEqual(r.text[2], "Rainbow (very rare)", "rainbow");
      check(/^Tipped \(\w+ tips\)$/.test(r.text[3]), r.text[3]);
      checkEqual(JSON.stringify(r.treeStreak), JSON.stringify({ fancy: 4, kind: "streaked" }), "family tree genes");
      checkEqual(r.lab, 1, "Gene Lab: two streaked parents, every foal fancy");
      checkEqual(r.labPlain, 0, "two plain ones: none");
      check(r.stock.includes("rainbow mane"), `stock card ${r.stock}`);
    },
  },
  {
    name: "manes: drawn on the mane and tail; greyer with age; Prism Stables sells them",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const sum = (canvas) => {
          const d = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
          let s = 0;
          for (let i = 0; i < d.length; i += 4) s += d[i] * 3 + d[i + 1] * 7 + d[i + 2] * 11;
          return s;
        };
        const plain = __mk(null, "female", [30, 30, 200]);
        const out = {};
        plain.renderer.ensureTintedImages();
        out.plain = [sum(plain.renderer.tinted.mane), sum(plain.renderer.tinted.tail)];
        for (const kind of ["streaked", "tipped", "rainbow"]) {
          const f = __mk(kind, "female", [30, 30, 200]);
          f.genes = plain.genes.slice();
          const s = MANE_GENE_START;
          for (let b = 0; b < 4; b++) f.genes[s + b] = 1;
          f.genes[s + 4] = kind === "tipped" ? 1 : kind === "rainbow" ? 2 : 0;
          f.genes[s + 5] = f.genes[s + 6] = kind === "rainbow" ? 1 : 0;
          f.genetics.processGenes();
          f.renderer.tinted = null;
          f.renderer.ensureTintedImages();
          out[kind] = [sum(f.renderer.tinted.mane), sum(f.renderer.tinted.tail)];
          if (kind === "streaked") {
            f.age = (ELDERLY_DAYS + 2) * DAY_LENGTH;
            f.renderer.tinted = null;
            f.renderer.ensureTintedImages();
            out.old = sum(f.renderer.tinted.mane);
          }
        }
        // Prism Stables
        let fancy = 0;
        const prism = STOCK_BREEDERS.find((b) => b.line === "mane");
        for (let i = 0; i < 60; i++) {
          const l = makeStockListing(3, prism);
          if (l && manePatternOfGenes(l.genes)) fancy++;
        }
        out.prism = { fancy, min: prism.minLevel };
        return out;
      }, SETUP);
      for (const k of ["streaked", "tipped", "rainbow"]) {
        check(r[k][0] !== r.plain[0], `${k} changes the mane`);
        check(r[k][1] !== r.plain[1], `${k} changes the tail`);
      }
      check(r.old !== r.streaked[0], "greys with age");
      checkEqual(r.prism.min, 3, "Prism Stables from Trusted breeder");
      check(r.prism.fancy > 25, `Prism Stables sells mostly fancy manes (${r.prism.fancy} of 60)`);
    },
  },
];
