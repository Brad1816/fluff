// How fluffies judge coat colours (judgeCoatColour and friends, globals.js):
// only browns are poopie; drab colours are shunned more than bright ones.
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "colours: only brown and brown-adjacent coats are poopie; greys, black and pastels are drab; vivid colours are lovely",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const band = (rgb) => {
          const p = judgeCoatColour(rgb).p;
          return p < COAT_POOPIE_LINE ? "poopie" : p < COAT_DRAB_LINE ? "drab" : p >= COAT_NICE_LINE ? "bright" : "fine";
        };
        const all = [0, 31, 63, 95, 127, 159, 191, 223, 255];
        let poopieCount = 0;
        const notBrown = [];
        for (const a of all) for (const b of all) for (const c of all) {
          if (band([a, b, c]) !== "poopie") continue;
          poopieCount++;
          const n = HorseGenetics.prototype.getColorName.call({ horse: { colors: { body: `rgb(${a}, ${b}, ${c})` } } });
          if (!["bwown", "owange", "yewwow", "wed", "gway"].includes(n)) notBrown.push(`${a},${b},${c} ${n}`);
        }
        return {
          browns: [[63, 31, 0], [127, 63, 31], [159, 127, 95], [127, 95, 63]].map(band),
          drab: [[0, 0, 0], [127, 127, 127], [255, 223, 223], [63, 0, 0], [95, 63, 95]].map(band),
          bright: [[255, 0, 0], [0, 127, 255], [255, 95, 191], [0, 223, 0], [255, 223, 0]].map(band),
          poopieCount,
          notBrown,
        };
      });
      checkEqual(r.browns.join(), "poopie,poopie,poopie,poopie", "browns and tan are poopie");
      checkEqual(r.drab.join(), "drab,drab,drab,drab,drab", "black, grey, pastel pink, maroon, dull purple are drab (not poopie)");
      checkEqual(r.bright.join(), "bright,bright,bright,bright,bright", "red, blue, pink, green, yellow are bright");
      check(r.poopieCount > 15 && r.poopieCount < 45, `a few dozen of the 729 coat colours are poopie (${r.poopieCount})`);
      checkEqual(r.notBrown.join("; "), "", "every poopie colour is a brown, rust, tan or dark olive");
    },
  },
  {
    name: "colours: a colourist mum attacks a brown foal but tolerates a drab one; colourists shun drab fluffies more than bright ones",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(12);
        const coat = (h, rgb) => {
          for (let c = 0; c < 3; c++) {
            const n = Math.round(rgb[c] / 31.875);
            for (let i = 0; i < 8; i++) h.genes[c * 8 + i] = i < n ? 1 : 0;
          }
          h.processGenes();
        };
        const mk = (growth, rgb, x, mumId = null) => {
          const h = new Horse(growth, mumId, "INDOORS", "earthy", null, 0.5, 0.5, "female");
          coat(h, rgb);
          h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
          h.adopted = true;
          h.x = x;
          h.y = 520;
          h.brain.think = () => {};
          fluffies.push(h);
          return h;
        };
        const mum = mk(1, [255, 0, 0], 400);
        mum.coloristDegree = 1;
        const brownFoal = mk(0.02, [127, 63, 31], 440, mum.id);
        const greyFoal = mk(0.02, [127, 127, 127], 360, mum.id);
        const out = {
          rejects: [mumRejectsFoalColour(mum, brownFoal), mumRejectsFoalColour(mum, greyFoal)],
        };
        // She goes for the brown foal, not the grey one
        let hits = [];
        const orig = mum.performAttack.bind(mum);
        mum.performAttack = (t, intent) => hits.push([t.id, intent]);
        for (let i = 0; i < 5; i++) {
          mum.attackCooldown = 0;
          mum._updateColoristMum();
        }
        out.hits = hits.map((h) => (h[0] === brownFoal.id ? "brown" : h[0] === greyFoal.id ? "grey" : "?") + ":" + h[1]);
        mum.performAttack = orig;
        // Shunning: poopie > drab > bright; none with colourism off
        const judge = mum;
        const bright = mk(1, [0, 127, 255], 700);
        const drab = mk(1, [127, 127, 127], 760);
        const brownAdult = mk(1, [127, 63, 31], 820);
        out.shun = [brownAdult, drab, bright].map((f) => +colourShunChance(judge, f).toFixed(2));
        worldSettings.colorism = false;
        out.off = [colourShunChance(judge, brownAdult), mumRejectsFoalColour(mum, brownFoal)];
        worldSettings.colorism = true;
        return out;
      });
      checkEqual(JSON.stringify(r.rejects), JSON.stringify([true, false]), "rejects the brown foal only");
      check(r.hits.length >= 1 && r.hits.every((h) => h === "brown:COLOR"), `attacks ${r.hits}`);
      check(r.shun[0] === 1 && r.shun[1] > 0.3 && r.shun[1] < 1 && r.shun[2] < 0.1, `shun chances poopie/drab/bright ${r.shun}`);
      checkEqual(JSON.stringify(r.off), JSON.stringify([0, false]), "colourism off: nothing");
    },
  },
];
