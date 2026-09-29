// Warmth and heating (Warmth.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __clearScene(PARK_SCENE);
  __seedRandom(71);
  weatherState.until = 1e9;
  window.__setTime = (day, hour, weather = "clear") => {
    timePlayed = (day - 1) * DAY_LENGTH + (hour - START_HOUR) * HOUR_LENGTH;
    weatherState.type = weather;
    weatherState.target = weather;
    weatherState.intensity = 1;
  };
  window.__mk = (scene, x, y, growth = 1) => {
    const h = new Horse(growth, null, scene, "earthy", null, 0.6, 0.6, "female");
    h.adopted = true;
    h.x = x;
    h.y = y;
    h.hunger = 1;
    h.happiness = 0.8;
    h.health = 100;
    h.warmth = 1;
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
  // n seconds of the warmth system only (nobody moves)
  window.__run = (n) => {
    for (let i = 0; i < n; i++) {
      warmthTicker.fireNext();
      updateWarmth(0);
    }
  };
}`;

module.exports = [
  {
    name: "warmth: how cold each place is, by season, night and weather",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const at = (day, hour, weather) => {
          __setTime(day, hour, weather);
          return {
            park: +placeColdness(PARK_SCENE).toFixed(2),
            house: +placeColdness("INDOORS").toFixed(2),
            shop: placeColdness(getStoreAisles()[0].scene),
            label: describeTemperature("INDOORS"),
            outLabel: describeTemperature(PARK_SCENE),
          };
        };
        // Spring days 1-4, summer 5-8, autumn 9-12, winter 13-16
        return { summerDay: at(6, 13), winterDay: at(14, 13), winterSnowNight: at(14, 23, "snow"), autumnNight: at(10, 23) };
      }, SETUP);
      check(r.summerDay.park === 0 && r.summerDay.house === 0, `summer is warm ${JSON.stringify(r.summerDay)}`);
      check(r.winterDay.park >= 0.65 && r.winterDay.park <= 0.75, `winter day outside ${r.winterDay.park}`);
      check(r.winterSnowNight.park >= 0.95, `snowy winter night outside ${r.winterSnowNight.park}`);
      check(r.winterSnowNight.house > 0.3 && r.winterSnowNight.house < 0.5, `the house is only chilly ${r.winterSnowNight.house}`);
      checkEqual(r.winterSnowNight.shop, 0, "the shop is heated");
      checkEqual(r.winterSnowNight.outLabel, "Freezing", "top bar outside");
      checkEqual(r.winterSnowNight.label, "Cold", "top bar in the house");
      check(r.autumnNight.park > 0.4 && r.autumnNight.park < 0.6, `autumn nights are cold outside ${r.autumnNight.park}`);
    },
  },
  {
    name: "warmth: a snowy winter night in the park - a lone foal freezes, a huddled herd gets through",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        __setTime(14, 21, "snow");
        const foal = __mk(PARK_SCENE, 400, 1200, 0.3);
        const lone = __mk(PARK_SCENE, 900, 1200);
        const herd = [__mk(PARK_SCENE, 1500, 1200), __mk(PARK_SCENE, 1530, 1210), __mk(PARK_SCENE, 1515, 1225)];
        const scarfed = __mk(PARK_SCENE, 2200, 1200);
        scarfed.accessories = { neck: { id: "scarf" } };
        const exposure = { foal: warmthExposure(foal), lone: warmthExposure(lone), herd: warmthExposure(herd[0]), scarf: warmthExposure(scarfed) };
        const said = [];
        const realMsg = window.addUIMessage;
        window.addUIMessage = (t) => said.push(t);
        try {
          __run(9 * HOUR_LENGTH); // 9 pm to 6 am
        } finally {
          window.addUIMessage = realMsg;
        }
        return {
          exposure,
          foal: { alive: foal.isAlive, cause: foal.deathCause || foal.causeOfDeath || null },
          lone: { alive: lone.isAlive, health: Math.round(lone.health), warmth: +lone.warmth.toFixed(2) },
          herd: herd.map((f) => ({ alive: f.isAlive, health: Math.round(f.health), warmth: +f.warmth.toFixed(2) })),
          scarf: { health: Math.round(scarfed.health), warmth: +scarfed.warmth.toFixed(2) },
          msg: said.some((t) => /froze to death/.test(t)),
          row: describeWarmth(lone),
          hunger: coldHungerMultiplier(lone),
        };
      }, SETUP);
      check(r.exposure.foal > r.exposure.lone, `foals feel it more ${JSON.stringify(r.exposure)}`);
      check(r.exposure.herd < r.exposure.lone * 0.6, "huddling helps");
      check(r.exposure.scarf < r.exposure.lone, "a scarf helps");
      checkEqual(r.foal.alive, false, "a lone foal froze");
      check(r.msg, "you're told");
      check(r.lone.alive && r.lone.health < 90, `a lone adult gets through, hurt ${JSON.stringify(r.lone)}`);
      check(r.herd.every((f) => f.alive && f.health === 100 && f.warmth > 0.3), `the huddled herd gets through ${JSON.stringify(r.herd)}`);
      check(r.scarf.health > r.lone.health, `a scarf saves health ${JSON.stringify(r.scarf)}`);
      check(r.row && /Freezing/.test(r.row[0]), `magnifying glass ${JSON.stringify(r.row)}`);
      check(r.hunger > 1.3, `cold makes it hungrier ${r.hunger}`);
    },
  },
  {
    name: "warmth: an unheated house is chilly in winter; a heater fixes it, runs only when cold, and costs money",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        heatingState = freshHeatingState();
        __setTime(14, 12, "snow");
        const adult = __mk("INDOORS", 400, 450);
        const foal = __mk("INDOORS", 900, 450, 0.3);
        __run(6 * HOUR_LENGTH);
        const out = { cold: { adult: +adult.warmth.toFixed(2), adultHealth: Math.round(adult.health), foal: +foal.warmth.toFixed(2) } };
        // A heater in the room
        const h = new Heater("INDOORS");
        h.setPosition(640, 600);
        objects.push(h);
        money = 1000;
        heatingState.day = getDayNumber();
        __run(6 * HOUR_LENGTH);
        out.heated = { adult: +adult.warmth.toFixed(2), foal: +foal.warmth.toFixed(2), coldAt: coldAt(foal), label: describeTemperature("INDOORS") };
        out.bill6h = 1000 - money;
        // Off: no bill
        h.on = false;
        const m0 = money;
        __run(2 * HOUR_LENGTH);
        out.offBill = m0 - money;
        h.on = true;
        // Summer: no bill
        __setTime(6, 12);
        const m1 = money;
        __run(2 * HOUR_LENGTH);
        out.summerBill = m1 - money;
        // Next day: yesterday's bill in the news
        const said = [];
        const realMsg = window.addUIMessage;
        window.addUIMessage = (t) => said.push(t);
        try {
          __setTime(14, 23, "snow");
          heatingState.day = 14;
          heatingState.today = 7;
          __setTime(15, 9, "snow");
          __run(1);
        } finally {
          window.addUIMessage = realMsg;
        }
        out.news = said.find((t) => /Heating bill yesterday/.test(t)) || null;
        // Saved
        const copy = loadObjectCopy(h);
        out.saved = copy;
        return out;

        function loadObjectCopy(obj) {
          const data = JSON.parse(JSON.stringify(obj.serialize()));
          data.on = false;
          const before = objects.length;
          loadObject(data);
          const o = objects[objects.length - 1];
          const res = { cls: o.constructor.name, on: o.on, added: objects.length === before + 1 };
          objects.pop();
          return res;
        }
      }, SETUP);
      check(r.cold.adult < 0.8 && r.cold.adult >= 0.5, `an unheated winter house: adults a bit cold ${r.cold.adult}`);
      checkEqual(r.cold.adultHealth, 100, "but not hurt");
      check(r.cold.foal < r.cold.adult, `foals colder ${r.cold.foal}`);
      check(r.heated.adult > 0.95 && r.heated.foal > 0.95, `a heater warms everyone in the room ${JSON.stringify(r.heated)}`);
      checkEqual(r.heated.coldAt, 0, "no cold with the heater on");
      checkEqual(r.heated.label, "Heated", "top bar");
      check(r.bill6h >= 6 && r.bill6h <= 9, `about $30 a day: $${r.bill6h} for 6 hours`);
      checkEqual(r.offBill, 0, "switched off: free");
      checkEqual(r.summerBill, 0, "summer: it doesn't run");
      checkEqual(r.news, "Heating bill yesterday: $7.", "the morning news");
      checkEqual(JSON.stringify(r.saved), JSON.stringify({ cls: "Heater", on: false, added: true }), "saved");
    },
  },
  {
    name: "warmth: the heater is on the Fluff Mart shelves, delivered, and right-click switches it off",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const action = SPAWN_ACTIONS.find((a) => a.name === "Heater");
        const out = { aisle: getStoreAisleForAction(action) && getStoreAisleForAction(action).name, kind: shopDeliveryKind(action), cost: action.cost };
        money = 1000;
        const before = objects.filter((o) => o instanceof Heater).length;
        buyFromStore(action, 500, 500);
        const h = objects.filter((o) => o instanceof Heater);
        out.delivered = h.length === before + 1 && h[h.length - 1].scene === "INDOORS";
        const entry = getItemType(h[h.length - 1]);
        entry.onRightClick(h[h.length - 1]);
        out.off = !h[h.length - 1].on;
        out.sell = getItemSellValue(h[h.length - 1], entry);
        return out;
      }, SETUP);
      checkEqual(r.aisle, "Home & Play", "aisle");
      checkEqual(r.kind, "deliver", "delivered home");
      check(r.delivered, "it's in the living room");
      check(r.off, "right-click turns it off");
      checkEqual(r.sell, r.cost / 2, "sells for half");
    },
  },
];
