// Food and diet (Diet.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(33);
  weatherState.until = 1e9;
  weatherState.type = weatherState.target = "clear";
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH;
  window.__setTrait = (h, key, sum) => {
    const i = TRAITS.findIndex((q) => q.key === key);
    for (let k = 0; k < TRAIT_GENES_EACH; k++) h.genes[traitGeneStart(i) + k] = k < sum ? 1 : 0;
  };
  window.__mk = (x, y = 520, growth = 1) => {
    const h = new Horse(growth, null, "INDOORS", "earthy", null, 0.5, 0.5, "female");
    for (const t of TRAITS) __setTrait(h, t.key, 2);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = y;
    h.hunger = 1;
    h.warmth = 1;
    h.happiness = 0.6;
    h.health = 100;
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
  window.__bowl = (x, y, type, food = 5) => {
    const b = new Bowl("bowl", "INDOORS");
    b.x = x;
    b.y = y;
    b.food = food;
    b.foodType = type;
    objects.push(b);
    return b;
  };
}`;

module.exports = [
  {
    name: "diet: four kibble brands on the shelf; premium loved, plain kibble divides them, Scrapz mostly refused; picky vs greedy",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const bag = (n) => {
          const a = SPAWN_ACTIONS.find((x) => x.name === n);
          return a && { cost: a.cost, type: a.foodType, aisle: getStoreAisleForAction(a).name };
        };
        const out = {
          bags: ["Fluffy Feast Premium", "Kibble", "Value Kibble", "Scrapz"].map(bag),
        };
        const many = [];
        for (let i = 0; i < 40; i++) many.push(__mk(100 + i * 20));
        const tastes = (type) => many.map((f) => tasteFor(f, type));
        const prem = tastes("premium_kibble");
        const kib = tastes("kibble");
        const scrap = tastes("scrap_kibble");
        out.premLiked = prem.filter((t) => t > 0.2).length;
        out.kibLikes = kib.filter((t) => t > 0.3).length;
        out.kibDislikes = kib.filter((t) => t < -0.3).length;
        out.scrapRefused = many.filter((f) => refusesFood(f, "scrap_kibble")).length;
        out.stable = tasteFor(many[0], "kibble") === kib[0];
        out.favs = new Set(many.map((f) => favouriteFood(f))).size;
        // Same fluffy, picky vs greedy
        const p = __mk(500);
        p.tastes = { value_kibble: 0 };
        __setTrait(p, "appetite", 0);
        const picky = tasteFor(p, "value_kibble");
        __setTrait(p, "appetite", TRAIT_GENES_EACH);
        const greedy = tasteFor(p, "value_kibble");
        out.pickyGreedy = [picky, greedy];
        // A fussy one gives in before it would eat mess off the floor (0.3), or when it's miserable
        const fussy = __mk(700);
        fussy.tastes = { kibble: -1 };
        fussy.happiness = 0.8;
        fussy.hunger = 0.5;
        const at50 = refusesFood(fussy, "kibble");
        fussy.hunger = 0.32;
        const at32 = refusesFood(fussy, "kibble");
        fussy.hunger = 0.8;
        fussy.happiness = 0.1;
        const miserable = refusesFood(fussy, "kibble");
        out.fussy = [at50, at32, miserable];
        return out;
      }, SETUP);
      checkEqual(
        JSON.stringify(r.bags),
        JSON.stringify([
          { cost: 80, type: "premium_kibble", aisle: "Food & Feeding" },
          { cost: 25, type: "kibble", aisle: "Food & Feeding" },
          { cost: 10, type: "value_kibble", aisle: "Food & Feeding" },
          { cost: 3, type: "scrap_kibble", aisle: "Food & Feeding" },
        ]),
        "bags",
      );
      check(r.premLiked >= 36, `premium: nearly all like it (${r.premLiked}/40)`);
      check(r.kibLikes >= 5 && r.kibDislikes >= 5, `plain kibble: some like (${r.kibLikes}), some don't (${r.kibDislikes})`);
      checkEqual(JSON.stringify(r.fussy), JSON.stringify([true, false, false]), "a fussy eater gives in when hungry (before eating mess) or miserable");
      check(r.scrapRefused >= 25, `Scrapz: most won't eat it unless starving (${r.scrapRefused}/40)`);
      check(r.stable, "a fluffy's taste stays the same");
      check(r.favs >= 2, `favourite foods differ (${r.favs} kinds)`);
      check(r.pickyGreedy[0] < r.pickyGreedy[1] - 0.2, `picky dislikes it more than greedy ${r.pickyGreedy}`);
    },
  },
  {
    name: "diet: a hungry fluffy picks premium over Scrapz; Scrapz only when starving - not filling, and it hurts",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(640, 520);
        f.tastes = { premium_kibble: 0, scrap_kibble: 0 };
        const prem = __bowl(400, 560, "premium_kibble");
        const scrap = __bowl(880, 560, "scrap_kibble");
        f.hunger = 0.4;
        const h0 = f.happiness;
        for (let i = 0; i < 12 && prem.food === 5; i++) __fastForward(1);
        const out = { premEaten: 5 - prem.food, scrapEaten: 5 - scrap.food, hunger: +f.hunger.toFixed(2), happier: f.happiness > h0, diet: f.diet, meals: (f.recentMeals || []).slice() };
        // Only Scrapz: not hungry enough to put up with it
        objects.splice(objects.indexOf(prem), 1);
        f.hunger = 0.4;
        f._foodGrumbleAt = null;
        f.x = 640;
        f.initBehavior("IDLE");
        const said = [];
        const realSpeak = f.speak.bind(f);
        f.speak = (t, ...a) => {
          said.push(t);
          return realSpeak(t, ...a);
        };
        __fastForward(6);
        out.refusedScrap = scrap.food === 5;
        out.grumbled = typeof f._foodGrumbleAt === "number" && said.length > 0;
        // Starving: eats it
        f.hunger = 0.2;
        f.health = 100;
        for (let i = 0; i < 25 && scrap.food === 5; i++) {
          f.hunger = 0.2;
          __fastForward(1);
        }
        out.ateScrap = scrap.food < 5;
        out.scrapHunger = +f.hunger.toFixed(2);
        // Each Scrapz meal hurts a little
        const g = __mk(300);
        onFluffyAte(g, "scrap_kibble");
        out.scrapHealth = g.health;
        return out;
      }, SETUP);
      checkEqual(r.premEaten, 1, "ate the premium");
      checkEqual(r.scrapEaten, 0, "not the Scrapz");
      checkEqual(r.hunger, 1, "full");
      check(r.happier, "enjoyed it");
      check(r.diet > 0.6, `diet went up ${r.diet}`);
      checkEqual(JSON.stringify(r.meals), JSON.stringify(["premium_kibble"]), "remembered");
      check(r.refusedScrap, "wouldn't eat Scrapz when only a bit hungry");
      check(r.grumbled, "and said so");
      check(r.ateScrap, "ate it when starving");
      check(r.scrapHunger <= 0.7, `Scrapz isn't filling ${r.scrapHunger}`);
      check(r.scrapHealth < 100, `and it hurts ${r.scrapHealth}`);
    },
  },
  {
    name: "diet: good food means shinier show coats, higher prices, faster foals and better health; poor food the opposite",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const good = __mk(300);
        const poor = __mk(900);
        poor.genes = good.genes.slice();
        poor.processGenes();
        good.processGenes();
        for (let i = 0; i < 30; i++) {
          onFluffyAte(good, "premium_kibble");
          onFluffyAte(poor, "value_kibble");
        }
        const T = SHOW_THEMES.find((t) => t.id === "coat");
        const foalG = __mk(500, 520, 0.5);
        const foalP = __mk(700, 520, 0.5);
        foalG.diet = good.diet;
        foalP.diet = 0.2;
        const out = {
          diets: [good.diet, poor.diet],
          show: [showScore(good, T), showScore(poor, T)],
          price: [good.genetics.calculatePrice(), poor.genetics.calculatePrice()],
          growth: [foalGrowthRate(foalG), foalGrowthRate(foalP)],
          rows: [describeDiet(good), describeDiet(poor)],
        };
        // Health over a few hours
        good.health = 80;
        poor.diet = 0.2;
        poor.health = 80;
        for (let i = 0; i < (4 * HOUR_LENGTH) / 2; i++) {
          dietTicker.fireNext();
          updateDiet(0);
        }
        out.health = [Math.round(good.health), Math.round(poor.health)];
        out.poorRow = describeDiet(poor);
        return out;
      }, SETUP);
      check(r.diets[0] > 0.9 && r.diets[1] < 0.5, `diets ${r.diets}`);
      check(r.show[0] >= r.show[1] + 8, `show coat ${r.show}`);
      check(r.price[0] > r.price[1] * 1.1, `price ${r.price}`);
      check(r.growth[0] > r.growth[1] * 1.2, `foal growth ${r.growth}`);
      checkEqual(r.rows[0][0], "Excellent (mostly premium kibble)", "good diet row");
      check(/^(Fair|Poor)/.test(r.rows[1][0]), `poor diet row ${r.rows[1]}`);
      check(r.health[0] > 80 && r.health[1] < 80, `health ${r.health}`);
      checkEqual(r.poorRow[0].split(" ")[0], "Malnourished", "malnourished");
    },
  },
  {
    name: "diet: sketties and treats make a fluffy chubby, then fat and slow; it burns off again",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400);
        f.updateSpeed();
        const speed0 = f.speed;
        const levels = [];
        for (let i = 0; i < 14; i++) {
          onFluffyAte(f, "sketties");
          levels.push(weightLevel(f));
        }
        const out = {
          chubbyAt: levels.indexOf("chubby") + 1,
          fatAt: levels.indexOf("fat") + 1,
          slower: f.speed / speed0,
          belly: weightBelly(f),
          row: describeWeight(f)[0],
          warn: getInspectionTabs(f).warnings.some((w) => /Weight/.test(w)),
          show: dietShowBonus(f),
        };
        // Treats from training add up too
        const t = __mk(800);
        t.tricks = { sit: 1 };
        money = 100;
        for (let i = 0; i < 5; i++) rewardTrick(t, "treat", "sit");
        out.treatWeight = +t.weight.toFixed(3);
        // Burns off over a couple of days
        for (let i = 0; i < DAY_LENGTH; i++) {
          dietTicker.fireNext();
          updateDiet(0);
        }
        out.after = weightLevel(f);
        out.speedBack = f.speed / speed0;
        return out;
      }, SETUP);
      check(r.chubbyAt >= 4 && r.chubbyAt <= 8, `chubby after ${r.chubbyAt} sketties meals`);
      check(r.fatAt >= 8 && r.fatAt <= 12, `fat after ${r.fatAt}`);
      check(Math.abs(r.slower - 0.7) < 0.01, `fat fluffies are slower ${r.slower}`);
      check(r.belly > 0.5, `rounder belly ${r.belly}`);
      checkEqual(r.row, "Fat - too many sketties", "weight row");
      check(r.warn, "warning on the magnifying glass");
      check(r.show <= -10, `shows ${r.show}`);
      check(Math.abs(r.treatWeight - 0.075) < 0.001, `treats ${r.treatWeight}`);
      check(r.after !== "fat", `it burns off (${r.after})`);
      check(r.speedBack > 0.8, `and speeds back up ${r.speedBack}`);
    },
  },
  {
    name: "diet: Scrapz replaces Soylent Brown - the grinder makes it, old saves convert; sketties cost $120",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const g = new Grinder("INDOORS");
        objects.push(g);
        const before = objects.filter((o) => o instanceof FoodBag).length;
        g.addGrowth(1);
        const bags = objects.filter((o) => o instanceof FoodBag);
        const made = bags.length > before ? bags[bags.length - 1].type : null;
        // An old save's Soylent Brown
        const oldBag = new FoodBag("soylent_brown", "INDOORS");
        const oldBowl = new Bowl("bowl", "INDOORS");
        oldBowl.deserialize({ food: 3, foodType: "soylent_brown" });
        return {
          made,
          oldBag: oldBag.type,
          oldBowl: oldBowl.foodType,
          shop: SPAWN_ACTIONS.filter((a) => a.isItem === "food_bag").map((a) => [a.name, a.cost]),
          scrapzDesc: /ground-up fluffies/.test(SPAWN_ACTIONS.find((a) => a.name === "Scrapz").desc),
        };
      }, SETUP);
      checkEqual(r.made, "scrap_kibble", "the grinder makes Scrapz");
      checkEqual(r.oldBag, "scrap_kibble", "old Soylent bag");
      checkEqual(r.oldBowl, "scrap_kibble", "old Soylent bowl");
      checkEqual(
        JSON.stringify(r.shop),
        JSON.stringify([["Fluffy Feast Premium", 80], ["Kibble", 25], ["Value Kibble", 10], ["Scrapz", 3], ["Rat Poison", 50], ["Sketty", 120], ["Formula", 100], ["Hot Peppers", 15]]),
        "food on the shelf",
      );
      check(r.scrapzDesc, "Scrapz says what it's made of");
    },
  },
];
