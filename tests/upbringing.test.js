// Upbringing (Upbringing.js): foals copy the views of whoever raises them
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(44);
  worldSettings.colorism = true;
  worldSettings.alicornIntolerance = true;
  window.__mk = (x, growth = 1, motherId = null) => {
    const h = new Horse(growth, motherId, "INDOORS", "earthy", null, 0.5, 0.5, "female");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.coloristDegree = 0.5;
    h.alicornComfort = 0;
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "upbringing: a foal raised by a prejudiced mum grows up prejudiced; a trained mum raises a tolerant one",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        // Two households, far apart
        const meanMum = __mk(200);
        meanMum.coloristDegree = 0.95;
        const kindMum = __mk(2000);
        kindMum.coloristDegree = 0;
        kindMum.scene = "BACKYARD";
        const a = __mk(260, 0.2, meanMum.id);
        const b = __mk(2060, 0.2, kindMum.id);
        b.scene = "BACKYARD";
        a.coloristDegree = b.coloristDegree = 0.5;
        const out = { row: describeUpbringing(a), rowKind: describeUpbringing(b), who: upbringingInfluences(a).map((i) => i.who) };
        // A whole foalhood (about 1680 seconds)
        for (let s = 0; s < 1680; s++) {
          applyUpbringing(a, 1);
          applyUpbringing(b, 1);
        }
        out.a = a.coloristDegree;
        out.b = b.coloristDegree;
        // Grown up: stops copying
        a.growth = 1;
        const before = a.coloristDegree;
        applyUpbringing(a, 100);
        out.grown = a.coloristDegree - before;
        out.grownRow = describeUpbringing(a);
        // Colorism off: colour views aren't copied
        worldSettings.colorism = false;
        const c = __mk(300, 0.2, meanMum.id);
        c.coloristDegree = 0.1;
        applyUpbringing(c, 500);
        out.off = c.coloristDegree;
        worldSettings.colorism = true;
        // Away from mum (another room): nobody to learn from
        const d = __mk(300, 0.2, meanMum.id);
        d.scene = "BACKYARD";
        d.x = 5000;
        d.coloristDegree = 0.1;
        applyUpbringing(d, 500);
        out.away = d.coloristDegree;
        out.awayRow = describeUpbringing(d);
        return out;
      }, SETUP);
      check(r.a > 0.8, `raised by a prejudiced mum: ${r.a}`);
      check(r.b < 0.15, `raised by a tolerant mum: ${r.b}`);
      checkEqual(JSON.stringify(r.who), JSON.stringify(["mum"]), "learns from mum");
      check(/Mum/.test(r.row[0]) && r.row[1] === "bad", `row ${r.row}`);
      check(r.rowKind[1] === "good", `row ${r.rowKind}`);
      checkEqual(r.grown, 0, "grown-ups don't copy");
      checkEqual(r.grownRow, null, "no row once grown");
      checkEqual(r.off, 0.1, "colorism off: not copied");
      checkEqual(r.away, 0.1, "nobody around: nothing copied");
      check(/No grown-ups/.test(r.awayRow[0]), `row ${r.awayRow}`);
    },
  },
  {
    name: "upbringing: foals of a mum who accepts alicorns accept them too; the system runs by itself",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(200);
        acceptAlicorns(mum);
        const foal = __mk(260, 0.2, mum.id);
        foal.alicornComfort = 0;
        for (let s = 0; s < 1680 && getAlicornComfort(foal) < 1; s++) applyUpbringing(foal, 1);
        const out = { comfort: getAlicornComfort(foal), tolerant: !!(foal.tolerantOfAlicorns && foal.tolerantOfAlicorns()) };
        // The system (1s ticker) copies colour views over time
        const mean = __mk(800);
        mean.coloristDegree = 1;
        const kid = __mk(850, 0.2, mean.id);
        kid.coloristDegree = 0;
        for (let i = 0; i < 100; i++) updateUpbringing(1);
        out.ticked = kid.coloristDegree;
        return out;
      }, SETUP);
      checkEqual(r.comfort, 1, "fully comfortable");
      check(r.tolerant, "accepts alicorns");
      check(r.ticked > 0.05 && r.ticked < 0.2, `copies a little at a time ${r.ticked}`);
    },
  },
];
