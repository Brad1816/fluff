// Tricks and training (Tricks.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(21);
  if (typeof closeTrickUI === "function") closeTrickUI();
  weatherState.until = 1e9;
  weatherState.type = weatherState.target = "clear";
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH;
  window.__mk = (x, trust = 0.5, growth = 1) => {
    const h = new Horse(growth, null, "INDOORS", "earthy", null, 0.5, 0.5, "female");
    for (const t of TRAITS) {
      const i = TRAITS.findIndex((q) => q.key === t.key);
      for (let k = 0; k < TRAIT_GENES_EACH; k++) h.genes[TRAIT_GENE_START + i * TRAIT_GENES_EACH + k] = k < 2 ? 1 : 0;
    }
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.warmth = 1;
    h.happiness = 0.8;
    h.playerTrust = trust;
    h.playerFear = 0;
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
  window.__said = [];
  window.__realMsg = window.__realMsg || window.addUIMessage;
  window.addUIMessage = (t) => __said.push(t);
}`;
const TEARDOWN = () => {
  if (window.__realMsg) window.addUIMessage = window.__realMsg;
  if (typeof closeTrickUI === "function") closeTrickUI();
};

module.exports = [
  {
    name: "tricks: rewarding a trick teaches it; a fluffy that loves you learns about twice as fast; 10 tries a day",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const loved = __mk(300, 0.9);
        const unloved = __mk(900, 0.1);
        const out = { rate: [trickLearnRate(loved), trickLearnRate(unloved)], chance0: trickChance(loved, "sit") };
        // Train "sit" with treats until it's had enough for today
        const train = (f) => {
          let res = [];
          money = 1000;
          for (let i = 0; i < 12; i++) {
            const got = tryTrick(f, "sit");
            res.push(got);
            if (got === "done") rewardTrick(f, "treat", "sit");
          }
          return res;
        };
        const lovedRes = train(loved);
        out.spent = 1000 - money;
        const unlovedRes = train(unloved);
        out.lovedSkill = trickSkill(loved, "sit");
        out.unlovedSkill = trickSkill(unloved, "sit");
        out.lovedTired = lovedRes.slice(10);
        out.lovedTries = lovedRes.slice(0, 10).filter((x) => x === "done" || x === "failed").length;
        out.refused = unlovedRes.filter((x) => x === "refused").length;
        // Keep training over a few days until it knows it
        for (let d = 0; d < 4 && trickSkill(loved, "sit") < TRICK_KNOWN; d++) {
          timePlayed += DAY_LENGTH;
          train(loved);
        }
        out.known = knownTricks(loved);
        out.msg = __said.find((m) => /knows "Sit" now/.test(m)) || null;
        out.chanceKnown = trickChance(loved, "sit");
        // A Smarty never; a scared one won't
        const smarty = __mk(600, 0.9);
        smarty.personalities = ["smarty"];
        out.smarty = typeof smarty.isSmarty === "function" && smarty.isSmarty() ? tryTrick(smarty, "sit") : "smarty";
        const scared = __mk(700, 0.5);
        scared.playerFear = 0.6;
        out.scared = tryTrick(scared, "sit");
        // Unrewarded: hardly anything
        const lazy = __mk(800, 0.9);
        lazy.tricks = { bow: 0.9 };
        const before = trickSkill(lazy, "bow");
        tryTrick(lazy, "bow");
        out.unrewarded = trickSkill(lazy, "bow") - before;
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      check(r.rate[0] > r.rate[1] * 1.8, `learn rate ${r.rate}`);
      check(r.chance0 < 0.2, `a new trick rarely works at first ${r.chance0}`);
      checkEqual(JSON.stringify(r.lovedTired), JSON.stringify(["tired", "tired"]), "had enough after 10");
      checkEqual(r.lovedTries, 10, "10 goes");
      check(r.lovedSkill > r.unlovedSkill, `the loved one learnt more ${r.lovedSkill} vs ${r.unlovedSkill}`);
      check(r.refused >= 1, `a fluffy that doesn't like you refuses sometimes (${r.refused})`);
      check(r.spent > 0 && r.spent % 2 === 0, `treats cost money ($${r.spent})`);
      check(r.known.includes("sit"), `learnt it within a few days ${r.known}`);
      check(r.msg, "you're told when it knows it");
      check(r.chanceKnown > 0.7, `a known trick usually works ${r.chanceKnown}`);
      checkEqual(r.smarty, "smarty", "Smarties don't");
      checkEqual(r.scared, "scared", "scared fluffies won't");
      check(r.unrewarded <= 0.011, `an unrewarded success teaches almost nothing ${r.unrewarded}`);
    },
  },
  {
    name: "tricks: it really sits, dances and comes to where you point; foals watching pick it up",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400, 0.9);
        f.tricks = { sit: 1, dance: 1, come: 1 };
        const foal = __mk(700, 0.6, 0.6);
        const out = {};
        __seedRandom(3);
        out.sit = tryTrick(f, "sit");
        __fastForward(1.5);
        out.sitState = f.currentStateKey;
        __fastForward(4);
        out.after = !!f.trickNow;
        out.foalSit = trickSkill(foal, "sit");
        // Dance: turns around
        const faces = new Set();
        __seedRandom(8);
        tryTrick(f, "dance");
        for (let i = 0; i < 30; i++) {
          __fastForward(0.1);
          faces.add(f.facingRight);
        }
        out.danced = faces.size;
        __fastForward(3);
        // Come
        tryTrick(f, "come", { x: 1000, y: 600 });
        out.path = [];
        for (let i = 0; i < 12; i++) { __fastForward(1); out.path.push([Math.round(f.x), Math.round(f.y), f.currentStateKey, !!f.trickNow, f.targetX && Math.round(f.targetX)]); }
        out.came = Math.min(...out.path.map((p) => Math.round(Math.hypot(p[0] - 1000, p[1] - 600))));
        out.waited = out.path.filter((p) => p[2] === "SITTING" && Math.hypot(p[0] - 1000, p[1] - 600) < 80).length;
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      checkEqual(r.sit, "done", "did it");
      checkEqual(r.sitState, "SITTING", "sitting");
      checkEqual(r.after, false, "then carries on");
      check(r.foalSit > 0, `the foal watched and learnt a bit ${r.foalSit}`);
      checkEqual(r.danced, 2, "turned around while dancing");
      check(r.came < 80, `came over (${r.came}px away) ${JSON.stringify(r.path)}`);
      check(r.waited >= 2, `and sat there a moment ${JSON.stringify(r.path)}`);
    },
  },
  {
    name: "tricks: right-click menu, reward buttons, and missing the moment",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const spot = await page.evaluate((setup) => {
        eval(setup)();
        changeScene("INDOORS");
        const f = __mk(640, 0.9);
        f.y = 560;
        f.tricks = { bow: 1 };
        window.__f = f;
        for (let dy = -120; dy <= 0; dy += 6) for (let dx = -40; dx <= 40; dx += 6) if (f.hitTestAsSeen(f.x + dx, f.y + dy)) return { x: f.x + dx, y: f.y + dy };
        return null;
      }, SETUP);
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      check(spot, "found the fluffy on screen");
      await page.mouse.click(spot.x, spot.y, { button: "right" });
      const menu = await page.evaluate(() => {
        const L = getTrickMenuLayout();
        return { phase: trickUI && trickUI.phase, chips: L && L.chips.map((c) => c.key), bow: L && L.chips.find((c) => c.key === "bow") };
      });
      checkEqual(menu.phase, "menu", "right-click opens the trick menu");
      checkEqual(JSON.stringify(menu.chips), JSON.stringify(["come", "sit", "down", "bow", "dance", "wave", "fetch"]), "tricks");
      // (it always gets it right here, whatever the random numbers do)
      await page.evaluate(() => {
        window.__realChance = window.__realChance || window.trickChance;
        window.trickChance = () => 1;
      });
      await page.mouse.click(menu.bow.x + 20, menu.bow.y + 10);
      const reward = await page.evaluate(() => {
        const L = getTrickMenuLayout();
        return { phase: trickUI && trickUI.phase, praise: L && L.chips.find((c) => c.key === "praise") };
      });
      checkEqual(reward.phase, "reward", "it did it: reward buttons");
      await page.evaluate(() => {
        __f.tricks.bow = 0.5;
        window.__trust = __f.playerTrust;
      });
      await page.mouse.click(reward.praise.x + 20, reward.praise.y + 10);
      const after = await page.evaluate(() => ({ open: !!trickUI, bow: trickSkill(__f, "bow"), trust: __f.playerTrust - __trust }));
      checkEqual(after.open, false, "closed");
      check(after.bow > 0.55, `praise taught it ${after.bow}`);
      check(after.trust > 0, "and it liked being praised");
      // Missing the moment
      const missed = await page.evaluate(() => {
        __f.tricks.sit = 1;
        __f.trickTries = null;
        __seedRandom(5);
        _trAsk(__f, "sit");
        const phase = trickUI && trickUI.phase;
        const s = trickSkill(__f, "sit");
        timePlayed += TRICK_REWARD_WINDOW + 1;
        updateTricks(0);
        return { phase, open: !!trickUI, s };
      });
      checkEqual(missed.phase, "reward", "reward buttons again");
      checkEqual(missed.open, false, "gone after a few seconds");
      await page.evaluate(TEARDOWN);
      await page.evaluate(() => {
        if (window.__realChance) window.trickChance = window.__realChance;
      });
    },
  },
  {
    name: "tricks: worth more, score at shows, wanted by families and orders, a goal, and on the magnifying glass",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const plain = __mk(300, 0.9);
        const clever = __mk(800, 0.9);
        clever.genes = plain.genes.slice();
        clever.processGenes();
        plain.processGenes();
        clever.tricks = { sit: 1, bow: 0.9, dance: 0.75, wave: 0.3 };
        const T = (id) => SHOW_THEMES.find((t) => t.id === id);
        const fam = BUYER_KINDS.find((k) => k.id === "family");
        const order = { reqs: [{ kind: "tricks", n: 2, value: 250 }] };
        goalsState.done = {};
        updateGoals(0);
        goalsTicker.fireNext();
        updateGoals(0);
        return {
          known: knownTricks(clever),
          price: [plain.genetics.calculatePrice(), clever.genetics.calculatePrice()],
          coat: [showScore(plain, T("coat")), showScore(clever, T("coat"))],
          trickShow: [showScore(plain, T("tricks")), showScore(clever, T("tricks"))],
          family: [fam.like(plain), fam.like(clever)],
          order: [fluffyFitsOrder(order, plain), fluffyFitsOrder(order, clever)],
          goal: !!goalsState.done.tricks_3,
          row: describeTricks(clever)[0],
          plainRow: describeTricks(plain)[0],
        };
      }, SETUP);
      await page.evaluate(TEARDOWN);
      checkEqual(JSON.stringify(r.known), JSON.stringify(["sit", "bow", "dance"]), "knows three");
      check(r.price[1] > r.price[0] * 1.1, `worth more ${r.price}`);
      checkEqual(r.coat[1] - r.coat[0], 6, "+2 a trick at any show");
      check(r.trickShow[1] > r.trickShow[0] + 40, `Trick Show ${r.trickShow}`);
      check(r.family[1] > r.family[0], `families like it ${r.family}`);
      checkEqual(JSON.stringify(r.order), JSON.stringify([false, true]), "'knows 2 tricks' order");
      check(r.goal, "goal met");
      checkEqual(r.row, "Sit ✓ · Bow ✓ · Dance ✓ · Wave 30%", "magnifying glass");
      checkEqual(r.plainRow, "None yet (right-click it to train)", "none yet");
    },
  },
];
