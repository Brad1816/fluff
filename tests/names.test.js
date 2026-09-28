// Fluffies stay "Fluffy" until a human names them (Names.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "names: unnamed fluffies stay unnamed; automatic names from one old build are removed on load",
    run: async (page) => {
      const r = await page.evaluate(async () => {
        __clearScene();
        gameState = "PAUSED";
        const made = [];
        for (let i = 0; i < 8; i++) {
          const h = new Horse(1, null, "INDOORS", "earthy");
          fluffies.push(h);
          made.push(h);
        }
        __fastForward(0.05);
        const res = { unnamed: made.every((f) => !fluffyNames[f.id]) };
        // A save from the build that named everyone
        const auto = ["Rosie", "Pudding", "Pudding II", "Pebble", "Cocoa", "Pip", "Wobble", "Sunny"];
        made.forEach((f, i) => (fluffyNames[f.id] = auto[i]));
        await saveGame("__automated_test__");
        await loadGame("__automated_test__");
        res.cleaned = fluffies.filter((f) => made.some((m) => m.id === f.id)).every((f) => !fluffyNames[f.id]);
        // A normal save where you named some of them: left alone
        fluffyNames[made[0].id] = "Rosie";
        fluffyNames[made[1].id] = "Sir Wobbles";
        await saveGame("__automated_test__");
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        res.kept = [fluffyNames[made[0].id], fluffyNames[made[1].id]];
        gameState = "PLAYING";
        return res;
      });
      check(r.unnamed, "fluffies got names without anyone naming them");
      check(r.cleaned, "automatic names weren't removed");
      checkEqual(JSON.stringify(r.kept), JSON.stringify(["Rosie", "Sir Wobbles"]), "names you gave");
    },
  },
];
