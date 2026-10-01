// The Feed-Bot (FeedBot.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(77);
  weatherState.until = 1e9;
  weatherState.type = weatherState.target = "clear";
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH;
  window.__said = [];
  window.__realMsg = window.__realMsg || window.addUIMessage;
  window.addUIMessage = (t) => __said.push(t);
  window.__bot = (x = 200, y = 600) => {
    const b = new FeedBot("INDOORS");
    b.setPosition(x, y);
    objects.push(b);
    return b;
  };
  window.__bowl = (x, y, type = "bowl") => {
    const b = new Bowl(type, "INDOORS");
    b.setPosition(x, y);
    objects.push(b);
    return b;
  };
  window.__run = (bot, secs) => {
    for (let i = 0; i < secs * 30; i++) {
      bot.update(1 / 30);
      timePlayed += 1 / 30;
    }
  };
  window.__mk = (x, growth = 1, gender = "female") => {
    const h = new Horse(growth, null, "INDOORS", "earthy", null, 0.5, 0.5, gender);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 560;
    h.hunger = 1;
    h.happiness = 0.8;
    h.brain.think = () => {};
    fluffies.push(h);
    return h;
  };
}`;
const TEARDOWN = () => {
  if (window.__realMsg) window.addUIMessage = window.__realMsg;
};

module.exports = [
  {
    name: "feedbot: pour a bag in, it fills bowls by mode (keep full, small portions, mealtimes with a bell) and goes home",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const bot = __bot(200, 600);
        const bowl = __bowl(800, 500);
        const out = {};
        // A food bag held over it pours in
        const bag = new FoodBag("kibble", "INDOORS");
        objects.push(bag);
        mouse.x = bot.x;
        mouse.y = bot.y - 30;
        let pours = 0;
        while (bag.amount > 0 && pours < 20 && bag.attemptFill()) pours++;
        out.loaded = [bot.portions(), bag.amount, pours];
        // Keep full
        __run(bot, 30);
        out.full = [bowl.food, bowl.foodType, bot.portions()];
        __run(bot, 30);
        out.home = [Math.round(Math.hypot(bot.x - 200, bot.y - 600)), bot.state];
        // Small portions: an empty bowl gets half
        bowl.food = 0;
        bot.mode = "small";
        __run(bot, 30);
        out.small = bowl.food;
        // Mealtimes: nothing until the bell
        bowl.food = 0;
        bot.mode = "meals";
        const day = Math.floor(timePlayed / DAY_LENGTH);
        timePlayed = day * DAY_LENGTH + (7.5 - START_HOUR) * HOUR_LENGTH;
        bot._lastHour = null;
        const f = __mk(500);
        __run(bot, 10);
        out.beforeMeal = bowl.food;
        timePlayed = day * DAY_LENGTH + (8.1 - START_HOUR) * HOUR_LENGTH;
        __run(bot, 30);
        out.afterMeal = [bowl.food, f.bellLearn];
        // Off: stays put
        bowl.food = 0;
        bot.mode = "off";
        __run(bot, 20);
        out.off = bowl.food;
        // Right-click cycles the mode
        bot.mode = "full";
        bot.rightClick();
        out.mode = bot.mode;
        // Saved and loaded
        const data = JSON.parse(JSON.stringify(bot.serialize()));
        const copy = SAVED_CLASSES.FeedBot(data);
        copy.deserialize(data);
        out.saved = [copy.portions() === bot.portions(), copy.mode, copy.homeX];
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      checkEqual(JSON.stringify(r.loaded), JSON.stringify([25, 0, 5]), "a bag (25 portions) poured in");
      checkEqual(r.full[0], 5, `bowl filled ${r.full}`);
      checkEqual(r.full[1], "kibble", "with what's loaded");
      checkEqual(r.full[2], 20, "hopper down by 5");
      check(r.home[0] < 10 && r.home[1] === "docked", `back at its dock ${r.home}`);
      checkEqual(r.small, 3, "small portions: half a bowl");
      checkEqual(r.beforeMeal, 0, "mealtimes: nothing before the bell");
      checkEqual(r.afterMeal[0], 5, `filled at breakfast ${r.afterMeal}`);
      check(r.afterMeal[1] > 0, "the fluffy heard the bell");
      checkEqual(r.off, 0, "off: nothing");
      checkEqual(r.mode, "meals", "right-click changes mode");
      checkEqual(JSON.stringify(r.saved), JSON.stringify([true, "meals", 200]), "saves");
    },
  },
  {
    name: "feedbot: formula for feeders and orphaned newborns; its meals give no affection",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const bot = __bot(200, 600);
        bot.load("formula", 20);
        bot.load("kibble", 10);
        const out = { tank: [bot.formula, bot.portions()] };
        const feeder = __bowl(900, 500, "feeder");
        const orphan = __mk(600, 0.05);
        orphan.hunger = 0.2;
        const trust0 = [];
        const adult = __mk(820);
        adult.playerTrust = 0.5;
        adult.hunger = 0.4;
        const bowl = __bowl(840, 520);
        __run(bot, 60);
        out.orphan = orphan.hunger;
        out.feeder = [feeder.food, feeder.foodType];
        out.formulaLeft = bot.formula;
        out.bowl = bowl.food;
        out.trust = adult.playerTrust;
        out.fedToday = (adult.affectionToday && adult.affectionToday.n && adult.affectionToday.n.fed) || 0;
        // With a nursing mum in the room, it leaves the foal to her
        const mum = __mk(300);
        mum.lactatingTimer = 500;
        const foal = __mk(320, 0.05);
        foal.motherId = mum.id;
        foal.hunger = 0.35; // (hungry, not starving: a starving one gets formula anyway)
        __run(bot, 30);
        out.mumsFoal = foal.hunger;
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      checkEqual(JSON.stringify(r.tank), JSON.stringify([20, 10]), "formula in its own tank");
      checkEqual(r.orphan, 1, "the orphan was fed");
      checkEqual(JSON.stringify(r.feeder), JSON.stringify([5, "formula"]), "the feeder topped up with formula");
      check(r.formulaLeft < 20, "formula used");
      checkEqual(r.bowl, 5, "and the bowl");
      checkEqual(r.fedToday, 0, "no affection for the Feed-Bot's meals");
      check(r.mumsFoal < 0.4, `a foal with a nursing mum is left to her (${r.mumsFoal})`);
    },
  },
  {
    name: "feedbot: rowdy fluffies knock it over, it spills, you stand it up; broken ones need a kit or repairs",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const bot = __bot(400, 600);
        bot.load("kibble", 40);
        const out = {};
        // A calm fluffy never does; a rowdy one does sooner or later
        const calm = __mk(410);
        calm.boredom = 0;
        calm.hunger = 1;
        for (let i = 0; i < TRAITS.length; i++) for (let k = 0; k < TRAIT_GENES_EACH; k++) calm.genes[TRAIT_GENE_START + i * TRAIT_GENES_EACH + k] = 0;
        out.calmRowdy = feedBotRowdiness(calm);
        for (let i = 0; i < 6000 && bot.state !== "tipped" && bot.state !== "broken"; i++) bot._checkTipping();
        out.calmTipped = bot.state === "tipped" || bot.state === "broken";
        calm.x = 5000;
        const rowdy = __mk(410, 1, "male");
        rowdy.boredom = 1;
        rowdy.hunger = 0.2;
        out.rowdy = feedBotRowdiness(rowdy);
        let checks = 0;
        const realRandom = Math.random;
        for (; checks < 20000 && bot.state !== "tipped" && bot.state !== "broken"; checks++) bot._checkTipping();
        out.checks = checks;
        out.state = bot.state;
        out.tips = rowdy.feedBotTips;
        out.spill = objects.filter((o) => o instanceof FoodSpill).map((s) => s.food)[0] || 0;
        out.msg = __said.some((m) => /knocked over the Feed-Bot/.test(m));
        out.status = feedBotStatusLines();
        // Stand it up (forced to a plain tip)
        bot.state = "tipped";
        bot.rightClick();
        out.standing = bot.state;
        // Broken: send for repair
        bot.state = "broken";
        money = 100;
        bot.rightClick();
        out.sent = [bot.state, money];
        out.hidden = bot.hitTest(bot.x, bot.y - 20);
        timePlayed += DAY_LENGTH;
        bot.update(1 / 30);
        out.back = bot.state;
        // Broken again: a Repair Kit held over it fixes it and is used up
        bot.state = "broken";
        const kit = new RepairKit("INDOORS");
        objects.push(kit);
        kit.isDragging = true;
        mouse.x = bot.x;
        mouse.y = bot.y - 10;
        kit.update(1 / 30);
        out.kit = [bot.state, objects.includes(kit)];
        // The Fluff-Bot hoovers up the spill
        const spill = objects.find((o) => o instanceof FoodSpill);
        if (spill) {
          const rb = new Roomba("INDOORS");
          rb.setPosition(spill.x - 200, spill.y);
          objects.push(rb);
          for (let i = 0; i < 60 * 30 && objects.includes(spill); i++) {
            rb.update(1 / 30);
            spill.update(1 / 30);
          }
          out.cleaned = !objects.includes(spill);
        }
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      checkEqual(r.calmRowdy, 0, "a calm, fed fluffy isn't rowdy");
      checkEqual(r.calmTipped, false, "and never tips it");
      check(r.rowdy > 1, `a bored, hungry, energetic fluffy is ${r.rowdy}`);
      check(r.state === "tipped" || r.state === "broken", `it knocked it over (after ${r.checks} seconds nearby)`);
      checkEqual(r.tips, 1, "and it's remembered");
      check(r.spill > 0, "food spilt");
      check(r.msg, "you're told");
      check(r.status.length === 1 && /tipped over|broken/.test(r.status[0]), `Household shows it ${r.status}`);
      checkEqual(r.standing, "docked", "right-click stands it up");
      checkEqual(JSON.stringify(r.sent), JSON.stringify(["away", 20]), "sent for repair for $80");
      checkEqual(r.hidden, false, "gone while away");
      checkEqual(r.back, "docked", "back the next day");
      checkEqual(JSON.stringify(r.kit), JSON.stringify(["docked", false]), "a Repair Kit fixes it and is used up");
      checkEqual(r.cleaned, true, "the Fluff-Bot cleans up the spill");
    },
  },
];
