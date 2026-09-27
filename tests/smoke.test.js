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
  {
    name: "everything in SAVED_GAME_STATE survives saving and loading",
    run: async (page) => {
      const problems = await page.evaluate(async () => {
        gameState = "PAUSED"; // stop the clock while we check
        // Give every field a made-up value that isn't its new-game value
        const values = {};
        SAVED_GAME_STATE.forEach((field, i) => {
          const fresh = field.fresh();
          let v;
          if (typeof fresh === "number") v = fresh + 100 + i;
          else if (typeof fresh === "boolean") v = !fresh;
          else if (typeof fresh === "string") v = "BACKYARD";
          else if (Array.isArray(fresh)) v = [{ id: 99, growth: 0.5, age: 1 }];
          else v = { test: i };
          field.set(v);
          values[field.name] = JSON.stringify(v);
        });
        fluffies.length = 0;
        objects.length = 0;
        await saveGame("__automated_test__");
        resetSavedGameState();
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        gameState = "PAUSED";
        // Loading re-creates the saved items, which moves the "next id"
        // counters on and adds entries to relationships - that's expected.
        const loose = ["nextFluffyId", "nextObjectId", "relationships"];
        const problems = [];
        for (const f of SAVED_GAME_STATE) {
          const got = f.get();
          const want = JSON.parse(values[f.name]);
          if (f.name === "relationships") {
            if (got.test !== want.test) problems.push("relationships lost");
          } else if (loose.includes(f.name)) {
            if (!(got >= want)) problems.push(`${f.name}: ${got} (expected at least ${want})`);
          } else if (JSON.stringify(got) !== values[f.name]) {
            problems.push(`${f.name}: ${JSON.stringify(got)} (expected ${values[f.name]})`);
          }
        }
        return problems;
      });
      check(problems.length === 0, problems.join("; "));
    },
  },
  {
    name: "starting a new game after playing resets everything",
    run: async (page) => {
      const problems = await page.evaluate(() => {
        // Mess everything up, as if we'd played a while
        money = 99999;
        backyardFenceTier = 2;
        backyardFenceBroken = true;
        nextHerdId = 50;
        roomsPurchased = 3;
        const h = new Horse(1, null, "INDOORS", "earthy");
        fluffies.push(h);
        currentSellRequest = { fluffyId: h.id, price: 10, timer: 20, fluffy: h };
        gibs.push(new Gib("leg", "#aa8866", "INDOORS", "part", 640, 450));
        // Press "Start Game" on the new-game screen
        showWorldSettingsPrompt = true;
        gameState = "TITLE";
        mouse.x = 553;
        mouse.y = 594;
        handleWorldSettingsClick();
        gameState = "PAUSED";
        // (new games add the vendor, desk and grass, so nextObjectId moves on)
        const problems = SAVED_GAME_STATE.filter(
          (f) =>
            f.name !== "nextObjectId" &&
            JSON.stringify(f.get()) !== JSON.stringify(f.fresh()),
        ).map((f) => `${f.name} is ${JSON.stringify(f.get())}`);
        if (fluffies.length) problems.push(`${fluffies.length} fluffies left over`);
        if (gibs.length) problems.push(`${gibs.length} body parts left over`);
        if (currentSellRequest) problems.push("old sell offer still showing");
        return problems;
      });
      check(problems.length === 0, problems.join("; "));
    },
  },
];
