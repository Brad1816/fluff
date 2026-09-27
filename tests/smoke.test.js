// Basic "does the game work at all" checks.
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "a new game starts and runs for 3 game-minutes without errors",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __seedRandom(1);
        for (let i = 0; i < 6; i++) {
          const h = new Horse(0.2 + i * 0.15, null, "INDOORS", ["earthy", "unicorn", "pegasus"][i % 3]);
          h.x = 300 + i * 120;
          h.y = 450;
          h.adopted = true;
          fluffies.push(h);
        }
        const bowl = new Bowl("trough", "INDOORS");
        bowl.setPosition(640, 600);
        bowl.fill(10, "kibble");
        objects.push(bowl);
        __fastForward(180);
        return { state: gameState, fluffies: fluffies.length };
      });
      checkEqual(r.state, "PLAYING", "game state");
      check(r.fluffies >= 6, "fluffies disappeared");
    },
  },
  {
    name: "saving and loading keeps money, fluffies and items",
    run: async (page) => {
      const r = await page.evaluate(async () => {
        __clearScene();
        money = 12345;
        for (let i = 0; i < 3; i++) {
          const h = new Horse(1, null, "INDOORS", "earthy");
          h.x = 400 + i * 150;
          h.y = 400;
          h.adopted = true;
          fluffies.push(h);
        }
        const bed = new Bed("INDOORS");
        bed.x = 700;
        bed.y = 600;
        objects.push(bed);
        const before = {
          money,
          fluffyIds: fluffies.map((f) => f.id).sort().join(","),
          objects: objects.length,
        };
        await saveGame("__automated_test__");
        money = 0;
        fluffies.length = 0;
        objects.length = 0;
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        return {
          before,
          after: {
            money,
            fluffyIds: fluffies.map((f) => f.id).sort().join(","),
            objects: objects.length,
          },
        };
      });
      checkEqual(r.after.money, r.before.money, "money after load");
      checkEqual(r.after.fluffyIds, r.before.fluffyIds, "fluffies after load");
      checkEqual(r.after.objects, r.before.objects, "number of items after load");
    },
  },
];
