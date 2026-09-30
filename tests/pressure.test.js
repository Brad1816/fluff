// Pressure: debt, the market, the vet on credit (Pressure.js); the inspector,
// the mill trade and rescue (Inspector.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(151);
  storyBook = freshStoryBook();
  _storyIndex = null;
  pressure = freshPressure();
  inspector = freshInspector();
  keeperRep = freshKeeperRep();
  roomClimate = freshRoomClimate();
  billsOwed = 0;
  timePlayed = 4 * DAY_LENGTH;
  window.__mk = (x, scene = "INDOORS", gender = "female") => {
    const h = new Horse(1, null, scene, "earthy", null, 0.5, 0.5, gender);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.happiness = 0.6;
    h.playerTrust = 0.5;
    h.playerFear = 0;
    h.brain.think = () => {};
    h.wishCooldownUntil = 1e12;
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "pressure: days in debt bring a final notice, a power cut (cold heaters), then the bailiffs take your most valuable fluffy",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const cheap = __mk(300);
        const dear = __mk(500);
        dear.calculatePrice = () => 400;
        cheap.calculatePrice = () => 50;
        money = 0;
        billsOwed = 300;
        const heater = new Heater("INDOORS");
        objects.push(heater);
        const days = [];
        for (let d = 1; d <= 5; d++) {
          timePlayed += DAY_LENGTH;
          chargeDailyBills();
          days.push([pressure.debtDays, powerCut(), heatersIn ? heatersIn("INDOORS").length : null]);
        }
        out.days = days;
        out.gone = !fluffies.includes(dear) && fluffies.includes(cheap);
        out.owed = billsOwed;
        out.story = storyOf(dear).some((e) => /taken by the bailiffs/.test(e.x || ""));
        money = 10000;
        timePlayed += DAY_LENGTH;
        chargeDailyBills();
        out.after = [pressure.debtDays, powerCut()];
        return out;
      }, SETUP);
      check(r.days[0][0] === 1 && !r.days[0][1], `day 1 ${r.days[0]}`);
      check(r.days[2][1], `power cut by day 3 ${r.days[2]}`);
      check(r.gone, "the bailiffs took the valuable one");
      check(r.owed < 300 + 5 * 100, `debt went down ${r.owed}`);
      check(r.story, "in its story");
      checkEqual(JSON.stringify(r.after), JSON.stringify([0, false]), "paid off: power back");
    },
  },
  {
    name: "pressure: slow days bring fewer buyers and lower offers; the vet treats on credit with a second click",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        pressure.market = "slow";
        out.slow = [marketBuyerRate(), marketOfferMultiplier()];
        const f = __mk(300);
        const kind = getBuyerKind("family");
        const o1 = buyerOffer(kind, f, 1, () => 0.5).offer;
        pressure.market = "normal";
        const o2 = buyerOffer(kind, f, 1, () => 0.5).offer;
        out.offers = [o1, o2];
        // The vet
        money = 5;
        f.isDiarrhea = true;
        const price = vetTreatmentPrice(f);
        out.first = vetTreat(f);
        out.second = vetTreat(f);
        out.owed = billsOwed;
        out.price = price;
        out.cured = !f.isDiarrhea;
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.slow), JSON.stringify([0.5, 0.85]), "a slow day");
      check(r.offers[0] < r.offers[1], `lower offers ${r.offers}`);
      check(!r.first && r.second && r.cured, "treated on the second click");
      checkEqual(r.owed, Math.round(r.price * 1.25), "on credit, with a fee");
    },
  },
  {
    name: "inspector: a letter, then a visit - passes a good house; fines and seizes from a bad one; can't see back rooms or cages",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        money = 1000;
        const good = __mk(300);
        out.clean = inspectHouse().score;
        const v1 = inspectorVisit();
        out.passed = [v1.score, keeperRep.family];
        // A bad house
        const a = __mk(400);
        a.hunger = 0.1;
        a.title = "Broken";
        const b = __mk(500);
        b.hunger = 0.1;
        b.playerFear = 0.8;
        b.dirt = 0.9;
        const hidden = __mk(600, "INDOORSL2");
        hidden.hunger = 0.05;
        const caged = __mk(700);
        caged.hunger = 0.05;
        caged.currentCage = { tag: "hide" };
        const seen = inspectHouse();
        out.seen = [seen.serious.length, seen.minor.length, seen.score];
        out.hiddenSeen = seen.serious.some((s) => new RegExp(fluffyDisplayName(hidden)).test(s));
        const m0 = money;
        const v2 = inspectorVisit();
        out.fine = [v2.fine, m0 - money];
        out.seized = v2.seized.map((f) => f === a || f === b);
        out.shelter = shelter.residents.filter((x) => x.origin === "seized").length;
        // The letter comes first
        inspector = freshInspector();
        keeperRep.family = -20;
        const real = Math.random;
        Math.random = () => 0.01;
        _inMorning();
        Math.random = real;
        out.letter = inspector.warned !== null;
        return out;
      }, SETUP);
      checkEqual(r.clean, 0, "a good house is clean");
      check(r.passed[0] === 0 && r.passed[1] === 2, `passed ${r.passed}`);
      check(r.seen[0] >= 3 && r.seen[1] >= 2, `seen ${r.seen}`);
      checkEqual(r.hiddenSeen, false, "not the back room");
      check(r.fine[0] === 30 * r.seen[2] && r.fine[1] === r.fine[0], `fined ${r.fine}`);
      check(r.seized.length >= 1 && r.seized.every((x) => x), `seized the worst ${r.seized}`);
      check(r.shelter >= 1, "taken to the shelter");
      check(r.letter, "a warning letter first");
    },
  },
  {
    name: "mill trade and rescue: sell a cage-full wholesale once a day; dealer-rescued fluffies at the shelter; healing one is rewarded",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        money = 0;
        const cage = { tag: "sell" };
        const lot = [__mk(300), __mk(340), __mk(380)];
        for (const f of lot) {
          f.currentCage = cage;
          f.calculatePrice = () => 100;
        }
        const act = wholesaleActions(lot[0]);
        out.act = act.map((a) => [a.name, a.sub]);
        sellWholesale(lot[0]);
        out.sold = [money, lot.every((f) => !fluffies.includes(f)), keeperRep.dark];
        out.again = wholesaleActions(__mk(400)).length;
        // Dealer rescues at the shelter
        let dealer = 0;
        let resident = null;
        for (let i = 0; i < 200; i++) {
          const x = makeShelterResident();
          if (x.origin === "dealer") {
            dealer++;
            resident = resident || x;
          }
        }
        out.dealer = dealer;
        out.resident = resident && [resident.data.title, resident.notes[0], shelterPlaqueLines(resident).origin];
        // Healing one
        const h = __mk(500);
        h.title = "Broken";
        const rep = keeperRep.family;
        setTitle(h, "Survivor");
        out.rehab = [keeperRep.family - rep, goalsState.stats.rehabs];
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.act), JSON.stringify([["Sell the lot", "3 for $165"]]), "the offer");
      check(r.sold[0] === 165 && r.sold[1] && r.sold[2] === 1, `sold ${r.sold}`);
      checkEqual(r.again, 0, "once a day");
      check(r.dealer >= 8 && r.dealer <= 40, `now and then ${r.dealer}`);
      check(r.resident && r.resident[0] === "Broken" && /dealer/.test(r.resident[1]) && /dealer/.test(r.resident[2]), `resident ${r.resident}`);
      check(r.rehab[0] === 5 && r.rehab[1] === 1, `rewarded ${r.rehab}`);
    },
  },
];
