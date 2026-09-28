// Every fluffy gets its own name (Names.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "names: every fluffy gets a unique name that suits it, and your names are kept",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(11);
        const made = [];
        for (let i = 0; i < 60; i++) {
          const h = new Horse(1, null, "INDOORS", "earthy");
          fluffies.push(h);
          made.push(h);
        }
        const mine = made[0];
        fluffyNames[mine.id] = "Sir Wobbles";
        __fastForward(0.05);
        const names = made.map((f) => fluffyNames[f.id]);
        const themed = made.filter((f) => (NAMES_BY_COLOUR[f.getColorName()] || []).some((n) => fluffyNames[f.id].startsWith(n))).length;
        // A fluffy from an old save with no name gets one when the game runs
        const old = new Horse(1, null, "INDOORS", "earthy");
        fluffies.push(old);
        delete fluffyNames[old.id];
        __fastForward(0.05);
        return {
          allNamed: names.every((n) => typeof n === "string" && n.length > 0),
          unique: new Set(names).size === names.length,
          kept: fluffyNames[mine.id],
          themed,
          numbered: names.filter((n) => / (II|III|IV|V|VI|VII|VIII|IX|X|\d+)$/.test(n)).length,
          oldNamed: !!fluffyNames[old.id],
          sample: names.slice(1, 8),
        };
      });
      check(r.allNamed, "a fluffy has no name");
      check(r.unique, "two living fluffies share a name");
      checkEqual(r.kept, "Sir Wobbles", "your own name for a fluffy");
      check(r.themed >= 20, `names that suit the coat colour: ${r.themed}/60 (${r.sample})`);
      check(r.oldNamed, "a fluffy from an old save wasn't named");
    },
  },
];
