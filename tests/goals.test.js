// Breeder goals (Goals.js) and the balance tweak for wild fluffies
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "goals: met goals pay once, count over the whole game, and are saved",
    run: async (page) => {
      const r = await page.evaluate(async () => {
        __clearScene();
        __seedRandom(2);
        goalsState = freshGoalsState();
        customerOrders = freshCustomerOrders();
        money = 0;
        const res = {};
        // Name one of your fluffies
        const f = new Horse(1, null, "INDOORS", "earthy", null, null, null, "female");
        f.adopted = true;
        fluffies.push(f);
        fluffyNames[f.id] = "Daisy";
        updateGoals(2);
        res.afterName = money;
        updateGoals(2);
        res.paidOnce = money;
        // Sales count up over time
        for (let i = 0; i < 10; i++) noteDayEvent("sold", { money: i === 9 ? 1200 : 50 });
        updateGoals(2);
        res.afterSales = money;
        res.done = Object.keys(goalsState.done).sort();
        // Saved
        gameState = "PAUSED";
        const want = JSON.stringify(goalsState);
        await saveGame("__automated_test__");
        goalsState = freshGoalsState();
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        gameState = "PLAYING";
        res.saved = JSON.stringify(goalsState) === want;
        res.news = dayStats.news.filter((n) => n.startsWith("Goal complete")).length;
        return res;
      });
      checkEqual(r.afterName, 50, "reward for naming a fluffy");
      checkEqual(r.paidOnce, 50, "money after checking again");
      checkEqual(r.afterSales, 50 + 300 + 500, "rewards for 10 sales and a $1,000 sale");
      checkEqual(JSON.stringify(r.done), JSON.stringify(["big_sale", "name_one", "sell_10"]), "goals done");
      check(r.saved, "goals weren't saved");
      check(r.news >= 3, `goal news in the morning report: ${r.news}`);
    },
  },
  {
    name: "goals: breeding goals notice special foals born at home",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        goalsState = freshGoalsState();
        const mk = (type, gender, mom = null) => {
          const h = new Horse(mom ? 0 : 1, mom ? mom.id : null, "INDOORS", type, null, null, null, gender);
          h.type = type;
          h.adopted = true;
          fluffies.push(h);
          return h;
        };
        const mum = mk("earthy", "female");
        const dad = mk("earthy", "male");
        const foal = mk("unicorn", "female", mum);
        foal.type = "unicorn";
        foal.fatherId = dad.id;
        updateGoals(2);
        const hidden = isGoalDone("hidden_genes");
        const grand = mk("earthy", "female", foal);
        updateGoals(2);
        return { hidden, three: isGoalDone("three_gens"), alicorn: isGoalDone("alicorn") };
      });
      check(r.hidden, "unicorn from two earthy parents not noticed");
      check(r.three, "three generations not noticed");
      check(!r.alicorn, "alicorn goal done without an alicorn");
    },
  },
  {
    name: "goals: the Goals button and G key open the list",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate(() => {
        tutorialTimer = 0;
        goalsOpen = false;
      });
      const b = await page.evaluate(() => getGoalsButtonRect(100));
      await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
      const opened = await page.evaluate(() => isGoalsOpen() && isAnyScreenOpen());
      await page.keyboard.press("KeyG");
      const closedByG = await page.evaluate(() => !isGoalsOpen());
      await page.keyboard.press("KeyG");
      const openedByG = await page.evaluate(() => isGoalsOpen());
      await page.keyboard.press("Escape");
      const closedByEsc = await page.evaluate(() => !isGoalsOpen());
      check(opened, "button didn't open the list");
      check(closedByG && openedByG, "G didn't toggle the list");
      check(closedByEsc, "Esc didn't close the list");
    },
  },
  {
    name: "balance: fluffies fresh from the park are wary, so they're worth less until they settle in",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        const group = spawnParkGroup("friends");
        return group.map((f) => ({ trust: f.playerTrust, fear: f.playerFear, mult: temperamentMultiplier(f) }));
      });
      check(r.every((x) => x.trust <= 0.3 && x.fear >= 0.1), `trust/fear: ${JSON.stringify(r)}`);
      check(r.every((x) => x.mult < 0.95), `temperament: ${r.map((x) => x.mult.toFixed(2))}`);
    },
  },
];
