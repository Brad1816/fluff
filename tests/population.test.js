// Population limits (Population.js) and rent and bills (Bills.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __clearScene("PARK");
  __seedRandom(88);
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH;
  window.__mk = (x, gender = "female", scene = "INDOORS", grumpy = false) => {
    const h = new Horse(1, null, scene, "earthy", null, 0.5, 0.5, gender);
    const i = TRAITS.findIndex((q) => q.key === "temper");
    if (grumpy) for (let k = 0; k < TRAIT_GENES_EACH; k++) h.genes[TRAIT_GENE_START + i * TRAIT_GENES_EACH + k] = 1;
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = scene !== "PARK";
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.happiness = 0.8;
    h.brain.think = () => {};
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "population: a crowded room makes fluffies unhappy and grumpy ones scuffle; the room name says so",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const few = [];
        for (let i = 0; i < 8; i++) few.push(__mk(100 + i * 60));
        out.fine = crowding("INDOORS");
        for (let i = 0; i < 7; i++) few.push(__mk(120 + i * 60, "female", "INDOORS", true));
        out.load = [roomLoad("INDOORS"), roomSpace("INDOORS"), +crowding("INDOORS").toFixed(2)];
        out.lines = crowdedRoomLines();
        const h0 = few[0].happiness;
        let attacks = 0;
        for (const f of few) {
          const orig = f.performAttack.bind(f);
          f.performAttack = (t, intent) => {
            attacks++;
            f.attackCooldown = 5;
            out.intent = intent;
          };
        }
        for (let s = 0; s < 600; s++) {
          timePlayed += 2;
          for (const f of few) f.attackCooldown = Math.max(0, f.attackCooldown - 2);
          populationTicker.fireNext();
          updatePopulation(0);
        }
        out.unhappier = h0 - few[0].happiness;
        out.attacks = attacks;
        // The house room label
        changeScene("INDOORS");
        let err = null;
        try {
          drawHouseNav(ctx);
        } catch (e) {
          err = String(e);
        }
        out.err = err;
        // Foals take half a place; the park has no room limit
        const foal = new Horse(0.3, null, "BACKYARD", "earthy");
        fluffies.push(foal);
        out.foal = roomLoad("BACKYARD");
        out.park = roomSpace("PARK");
        return out;
      }, SETUP);
      checkEqual(r.fine, 0, "8 fluffies: fine");
      checkEqual(JSON.stringify(r.load), JSON.stringify([15, 10, 0.5]), "15 in a room for 10");
      check(r.lines.length === 1 && /Living room: crowded \(15\/10\)/.test(r.lines[0]), `Household line ${r.lines}`);
      check(r.unhappier > 0.1, `unhappier over 20 game minutes ${r.unhappier}`);
      check(r.attacks >= 1, `grumpy ones scuffle (${r.attacks})`);
      checkEqual(r.intent, "CROWDED", "as a crowded scuffle");
      checkEqual(r.err, null, "room label draws");
      checkEqual(r.foal, 0.5, "a foal is half a place");
      checkEqual(r.park, null, "no room limit in the park");
    },
  },
  {
    name: "population: mares rest after a litter; park births follow food",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const mare = __mk(300);
        const stallion = __mk(400, "male");
        mare.triggerPregnancy(stallion);
        out.first = mare.isPregnant;
        mare.anatomy.spawnBaby(true);
        out.birthAt = mare.lastBirthAt === timePlayed;
        mare.isPregnant = false;
        mare.pregnancyTimer = 0;
        mare.babiesToBirth = 0;
        mare.triggerPregnancy(stallion);
        out.resting = [mare.isPregnant, describeBreedingRest(mare)];
        timePlayed += MARE_REST_DAYS * DAY_LENGTH + 10;
        mare.triggerPregnancy(stallion);
        out.after = mare.isPregnant;
        // The park: no food and lots of fluffies - few births; plenty - normal
        for (let i = 0; i < 20; i++) __mk(100 + i * 40, i % 2 ? "male" : "female", "PARK");
        for (let i = objects.length - 1; i >= 0; i--) if (objects[i] instanceof Grass && objects[i].scene === "PARK") objects.splice(i, 1);
        out.hungry = parkBirthFactor();
        for (let i = 0; i < 40; i++) {
          const g = new Grass(200 + i * 30, 700, "PARK", 2);
          objects.push(g);
        }
        out.fed = parkBirthFactor();
        // A wild mare in a hungry park rarely conceives
        for (let i = objects.length - 1; i >= 0; i--) if (objects[i] instanceof Grass && objects[i].scene === "PARK") objects.splice(i, 1);
        let got = 0;
        for (let i = 0; i < 200; i++) {
          const m = __mk(900, "female", "PARK");
          m.triggerPregnancy(stallion);
          if (m.isPregnant) got++;
          fluffies.splice(fluffies.indexOf(m), 1);
        }
        out.wildPregnant = got;
        return out;
      }, SETUP);
      check(r.first, "pregnant the first time");
      check(r.birthAt, "giving birth starts her rest");
      checkEqual(r.resting[0], false, "resting: no new pregnancy");
      check(r.resting[1] && /Resting after her litter/.test(r.resting[1][0]), `shown ${r.resting[1]}`);
      check(r.after, "after about 2 months she can again");
      checkEqual(r.hungry, 0.1, "no food in the park: births drop to a tenth");
      checkEqual(r.fed, 1, "plenty of food: normal");
      check(r.wildPregnant > 5 && r.wildPregnant < 45, `hungry-park conceptions ${r.wildPregnant}/200`);
    },
  },
  {
    name: "bills: a small daily charge for rent, rooms and fluffies; what you can't pay is owed; the day report shows it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        for (let i = 0; i < 6; i++) __mk(100 + i * 80);
        const foal = new Horse(0.3, null, "INDOORS", "earthy");
        foal.adopted = true;
        fluffies.push(foal);
        unlockedRoomsL = 1;
        unlockedRoomsR = 1;
        out.bill = dailyBills();
        money = 500;
        billsOwed = 0;
        out.paid = chargeDailyBills();
        out.money = money;
        money = 20;
        out.short = chargeDailyBills();
        out.moneyShort = money;
        out.text = describeBills(out.short);
        money = 1000;
        out.next = chargeDailyBills();
        out.moneyNext = money;
        // The morning report carries it
        dayStats = freshDayStats();
        dayStats.day = reportDayIndex();
        timePlayed += DAY_LENGTH;
        updateDayReport(1);
        out.report = dayReportShown && dayReportShown.bills;
        let err = null;
        try {
          drawDayReport(ctx);
        } catch (e) {
          err = String(e);
        }
        out.err = err;
        closeDayReport();
        unlockedRoomsL = 0;
        unlockedRoomsR = 0;
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.bill), JSON.stringify({ rent: 20, rooms: 30, fluffies: 33, total: 83 }), "rent + 2 rooms + 6.5 fluffies");
      checkEqual(r.money, 417, "paid from your money");
      checkEqual(r.moneyShort, 0, "all you had");
      checkEqual(r.short.owed, 63, "the rest is owed");
      check(/you owe \$63/.test(r.text), r.text);
      checkEqual(r.moneyNext, 1000 - 83 - 63, "next morning: the bill and what you owed");
      checkEqual(r.next.owed, 0, "debt cleared");
      check(r.report && r.report.total === 83, `on the day report ${JSON.stringify(r.report)}`);
      checkEqual(r.err, null, "the report draws");
    },
  },
];
