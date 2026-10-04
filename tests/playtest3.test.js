// Playtest batch 3: putting a fluffy out (asked first), strays in the
// backyard (asked each time), ordering food on the computer, the lawn
// mower, sleeping until morning, and lessons against fears.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __clearScene("OUTDOORS");
  __clearScene("BACKYARD");
  __seedRandom(31);
  closeAllChoices();
  strayVisits = [];
  strayQuestionsEnabled = true;
  currentScene = "INDOORS";
  transitionPhase = "OFF";
  timePlayed = 3 * DAY_LENGTH + 4 * HOUR_LENGTH;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, opts.scene ?? "INDOORS", "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 500;
    h.hunger = 1;
    h.happiness = 0.7;
    h.playerTrust = opts.trust ?? 0.7;
    h.playerFear = 0;
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "playtest3: setting one of yours down outside asks first - keep it (still in your hand) or put it out (a stray that misses you); carried back in, it's yours again",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(600);
        fluffyNames[f.id] = "Daisy";
        const foal = __mk(500, { growth: 0.2, mum: f.id });
        relationships[f.id][foal.id] = "baby_child";
        const out = {};
        // Indoors: just put down, no question
        f.isDragging = true;
        isGlobalDragging = true;
        attemptDrop();
        out.indoorsAsked = isChoiceOpen();
        out.indoorsDown = !f.isDragging;
        // Carried out of the front door and set down
        f.isDragging = true;
        isGlobalDragging = true;
        changeScene("OUTDOORS");
        mouse.rightDown = false;
        attemptDrop();
        out.asked = isChoiceOpen() && choiceDialog.title;
        out.lines = choiceDialog ? choiceDialog.lines.join(" | ") : "";
        out.stillHeld = f.isDragging;
        pickChoice(1); // Keep her
        out.kept = [f.adopted, f.isDragging];
        attemptDrop();
        pickChoice(0); // Put her out
        out.after = { adopted: f.adopted, held: f.isDragging, scene: f.scene, abandoned: f.personalities.includes("abandoned"), how: f.formerPet && f.formerPet.how, missing: f.missingOwner > 0, trust: f.playerTrust };
        out.story = storyOf(f).some((e) => /put Daisy out/.test(e.x || ""));
        // Back indoors: home again
        f.scene = "INDOORS";
        f._updateAdoptionRoom();
        out.back = [f.adopted, f.formerPet];
        changeScene("INDOORS");
        return out;
      }, SETUP);
      checkEqual(r.indoorsAsked, false, "indoors: no question");
      check(r.indoorsDown, "indoors: just set down");
      checkEqual(r.asked, "Put Daisy out?", "outside: asked first");
      check(/foal stays at home/.test(r.lines) && /miss you/.test(r.lines), `says what it means: ${r.lines}`);
      check(r.stillHeld, "while asking, still in your hand");
      checkEqual(JSON.stringify(r.kept), JSON.stringify([true, true]), "Keep her: still yours, still held");
      check(!r.after.adopted && !r.after.held && r.after.scene === "OUTDOORS", `put out: ${JSON.stringify(r.after)}`);
      check(r.after.abandoned && r.after.how === "put out" && r.after.missing && r.after.trust < 0.7, "abandoned, misses you, trusts you less");
      check(r.story, "in its story");
      checkEqual(JSON.stringify(r.back), JSON.stringify([true, null]), "carried back in: yours again");
    },
  },
  {
    name: "playtest3: right-click 'Put out' at home asks, then it's out of the front door",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(600);
        fluffyNames[f.id] = "Rowan";
        const acts = rightClickActions(f).map((a) => a.key);
        const a = rightClickActions(f).find((x) => x.key === "putout");
        a.run(f);
        const asked = choiceDialog && choiceDialog.title;
        pickChoice(0);
        // Not at home: no such action
        const wild = __mk(300, { adopted: false });
        return { acts, asked, scene: f.scene, adopted: f.adopted, wildActs: putOutActions(wild).length };
      }, SETUP);
      check(r.acts.includes("putout"), `in the right-click menu: ${r.acts}`);
      checkEqual(r.asked, "Put Rowan out?", "asked first");
      checkEqual(r.scene, "OUTDOORS", "out of the front door");
      checkEqual(r.adopted, false, "not yours");
      checkEqual(r.wildActs, 0, "not for ones that aren't yours");
    },
  },
  {
    name: "playtest3: strays that get into the backyard aren't yours - you're asked: keep, shoo, or leave them",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const n0 = fluffies.length;
        spawnFeralGroup("BACKYARD", "single_mom");
        const group = fluffies.slice(n0);
        out.mine = group.map((f) => f.adopted);
        out.waiting = strayVisits.length;
        // Away from home: not asked yet
        currentScene = "OUTDOORS";
        strayTicker.fireNext ? strayTicker.fireNext() : null;
        updateStrays(1.1);
        out.askedAway = isChoiceOpen();
        currentScene = "INDOORS";
        updateStrays(1.1);
        out.asked = choiceDialog && choiceDialog.title;
        out.lines = choiceDialog ? choiceDialog.lines[0] : "";
        pickChoice(0); // Keep them
        out.kept = group.filter((f) => f.isAlive).every((f) => f.adopted);
        // A second lot: shoo
        const n1 = fluffies.length;
        spawnFeralGroup("BACKYARD", "lone");
        const lone = fluffies.slice(n1);
        updateStrays(1.1);
        pickChoice(1);
        out.shooed = lone.every((f) => f.scene === "RIVER" && !f.adopted);
        // A third: leave them
        const n2 = fluffies.length;
        spawnFeralGroup("BACKYARD", "lone");
        const left = fluffies.slice(n2);
        updateStrays(1.1);
        pickChoice(2);
        out.left = left.every((f) => f.scene === "BACKYARD" && !f.adopted);
        out.describe = describeStrays(group);
        return out;
      }, SETUP);
      check(r.mine.length >= 2 && r.mine.every((m) => m === false), `strays aren't yours: ${r.mine}`);
      checkEqual(r.waiting, 1, "waiting for you to decide");
      checkEqual(r.askedAway, false, "not asked while you're out");
      checkEqual(r.asked, "Strays in the backyard", "asked when home");
      check(/got in through the broken fence/.test(r.lines), r.lines);
      check(r.kept, "Keep: yours");
      check(r.shooed, "Shoo: off to the river");
      check(r.left, "Leave: still strays in the backyard");
      check(/and (her|his) /.test(r.describe), `a family: ${r.describe}`);
    },
  },
  {
    name: "playtest3: food ordered on the computer arrives a couple of hours later in your shopping bag (delivery free over $100)",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        shoppingBag.length = 0;
        foodDeliveries = [];
        foodBasket = {};
        money = 1000;
        const out = {};
        openOrdersScreen("board");
        out.boardTabs = _ordersTabs().map((t) => t.id);
        closeOrdersScreen();
        openOrdersScreen("web");
        out.webTabs = _ordersTabs().map((t) => t.id);
        out.foods = onlineFoods().map((a) => a.name);
        setFoodBasket("Kibble", 3);
        out.small = foodBasketTotal();
        setFoodBasket("Fluffy Feast Premium", 1);
        out.big = foodBasketTotal();
        setFoodBasket("Fluffy Feast Premium", 0);
        const d = placeFoodOrder();
        out.money = money;
        out.basketEmpty = Object.keys(foodBasket).length === 0;
        updateFoodDeliveries(1.1);
        out.early = shoppingBag.length;
        timePlayed += FOOD_DELIVERY_HOURS * HOUR_LENGTH + 1;
        updateFoodDeliveries(1.1);
        out.bag = shoppingBag.map((e) => e.name);
        out.pending = foodDeliveries.length;
        // Too poor
        money = 10;
        setFoodBasket("Kibble", 2);
        out.poor = placeFoodOrder();
        // Clicking + on the page
        foodBasket = {};
        const L = foodShopLayout();
        const row = L.rows.find((x) => x.a.name === "Value Kibble");
        handleFoodShopClick({ x: row.plus.x + 2, y: row.plus.y + 2 });
        handleFoodShopClick({ x: row.plus.x + 2, y: row.plus.y + 2 });
        out.clicked = foodBasket["Value Kibble"];
        closeOrdersScreen();
        shoppingBag.length = 0;
        return out;
      }, SETUP);
      check(!r.boardTabs.includes("food") && r.webTabs.includes("food"), `only on the computer: ${r.webTabs}`);
      check(!r.foods.includes("Rat Poison") && r.foods.includes("Kibble") && r.foods.includes("Formula"), `foods: ${r.foods}`);
      checkEqual(JSON.stringify(r.small), JSON.stringify({ goods: 75, fee: 5, total: 80, bags: 3 }), "3 kibble: $75 + $5 delivery");
      checkEqual(r.big.fee, 0, "over $100: free delivery");
      checkEqual(r.money, 920, "paid");
      check(r.basketEmpty, "basket emptied");
      checkEqual(r.early, 0, "not here yet");
      checkEqual(JSON.stringify(r.bag), JSON.stringify(["Kibble", "Kibble", "Kibble"]), "arrived in the shopping bag");
      checkEqual(r.pending, 0, "nothing left on its way");
      checkEqual(r.poor, null, "can't order without the money");
      checkEqual(r.clicked, 2, "the + button");
    },
  },
  {
    name: "playtest3: the lawn mower cuts the long grass it's swept over, and the grass grows back",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const grass = [];
        for (const [x, y] of [[400, 500], [430, 510], [800, 500]]) {
          const g = new Grass(x, y, "OUTDOORS", 2);
          objects.push(g);
          grass.push(g);
        }
        const m = new LawnMower("OUTDOORS");
        objects.push(m);
        m.isDragging = true;
        mouse.x = 410;
        mouse.y = 505;
        m.update(0.2);
        const out = { cut: grass.map((g) => g.growth), total: m.cutTotal };
        grass[0].update(300);
        out.regrown = grass[0].growth;
        out.tool = !!getToolEntry(m) && getToolEntry(m).tool.key;
        out.img = !!mowerImage() && mowerImage().width > 0;
        out.shop = SPAWN_ACTIONS.some((a) => a.isItem === "lawn_mower");
        out.aisle = getStoreAisleForAction(SPAWN_ACTIONS.find((a) => a.isItem === "lawn_mower"));
        const saved = createItemFromSave(m.serialize());
        out.loads = saved instanceof LawnMower;
        // Drawn without trouble, held and set down
        const c = new OffscreenCanvas(200, 200).getContext("2d");
        m.drawOffScreen(c);
        m.isDragging = false;
        m.drawOffScreen(c);
        for (const o of [...grass, m]) objects.splice(objects.indexOf(o), 1);
        return out;
      }, SETUP);
      checkEqual(r.cut[0], 0.15, "the tuft under it is cut");
      checkEqual(r.cut[1], 0.15, "and the one beside it");
      checkEqual(r.cut[2], 2, "one across the garden isn't");
      checkEqual(r.total, 2, "counted");
      check(r.regrown > 0.15, `it grows back (${r.regrown})`);
      checkEqual(r.tool, "lawn_mower", "a tool");
      check(r.img && r.shop && r.loads, "has a picture, is in the shop, saves and loads");
    },
  },
  {
    name: "playtest3: sleeping until morning runs the night (time, the morning report) and only works at home with empty hands",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(500, { growth: 0.5 });
        f.hunger = 0.9;
        // 9 PM
        timePlayed = 4 * DAY_LENGTH + (21 - START_HOUR) * HOUR_LENGTH;
        const day0 = getDayNumber();
        const growth0 = f.growth;
        const out = {};
        currentScene = "OUTDOORS";
        out.outside = sleepRefusal();
        currentScene = "INDOORS";
        isGlobalDragging = true;
        out.holding = sleepRefusal();
        isGlobalDragging = false;
        out.free = sleepRefusal();
        askSleep();
        out.asked = choiceDialog && choiceDialog.title;
        cancelChoice();
        out.notYet = isSleeping();
        const t0 = performance.now();
        dayReportShown = null;
        sleepThroughNight();
        out.ms = Math.round(performance.now() - t0);
        out.hour = gameHour();
        out.day = getDayNumber() - day0;
        out.report = !!dayReportShown;
        out.grew = f.growth > growth0;
        out.awake = !isSleeping();
        closeDayReport();
        // Woken early
        startSleep();
        runSleep(5);
        wakeUp(true);
        out.early = !isSleeping() && gameHour() < SLEEP_WAKE_HOUR + 23;
        return out;
      }, SETUP);
      check(/only sleep at home/.test(r.outside), r.outside);
      check(/Put down/.test(r.holding), r.holding);
      checkEqual(r.free, null, "at home, hands free: fine");
      checkEqual(r.asked, "Sleep until morning?", "asked first");
      checkEqual(r.notYet, false, "Not yet: awake");
      check(Math.abs(r.hour - 6) < 0.01, `up at 6, the report time (${r.hour})`);
      checkEqual(r.day, 1, "the next day");
      check(r.report, "the morning report");
      check(r.grew, "the foal grew overnight");
      check(r.awake && r.early, "awake again");
    },
  },
  {
    name: "playtest3: lessons against fears - Brave works hardest on the worst fear; The table; Trust me (even for one scared of you)",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(500);
        f.fears = { thunder: 0.6, dark: 0.3, bot: 0 };
        getLesson("brave").teach(f);
        out.fears = [f.fears.thunder, f.fears.dark, f.fears.bot];
        // The operating table
        f.fearOfOperatingTable = true;
        out.tableOffered = lessonsFor(f).some((l) => l.key === "table");
        let n = 0;
        while (f.fearOfOperatingTable && n < 4) {
          getLesson("table").teach(f);
          n++;
        }
        out.tableLessons = n;
        out.tableAfter = [f.fearOfOperatingTable, lessonsFor(f).some((l) => l.key === "table")];
        out.saved = savedHorseFields(f).hasOwnProperty("fearOfOperatingTable");
        // Scared of you
        const s = __mk(700);
        s.playerFear = 0.6;
        out.calmOffered = lessonsFor(s).some((l) => l.key === "calm");
        out.otherRefused = lessonRefusal(s, "colours");
        out.calmRefused = lessonRefusal(s, "calm");
        let tries = 0;
        while (s.playerFear >= LESSON_CALM_FROM && tries < 60) {
          timePlayed += DAY_LENGTH;
          giveLesson(s, "calm");
          tries++;
        }
        out.calmAfter = s.playerFear;
        out.tries = tries;
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.fears), JSON.stringify([0.48, 0.26, 0]), "worst fear -0.12, others -0.04");
      check(r.tableOffered, "The table offered");
      checkEqual(r.tableLessons, 4, "four lessons");
      checkEqual(JSON.stringify(r.tableAfter), JSON.stringify([false, false]), "over it");
      check(r.saved, "the table fear is saved now");
      check(r.calmOffered, "Trust me offered");
      checkEqual(r.otherRefused, "scared", "other lessons: too scared");
      checkEqual(r.calmRefused, null, "but Trust me can be given");
      check(r.calmAfter < 0.15 && r.tries > 3, `talked out of it in ${r.tries} days (${r.calmAfter})`);
    },
  },
];
