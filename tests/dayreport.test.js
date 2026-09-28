// Temperament affects value (Wellbeing.js) and the morning report (DayReport.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "temperament: happy, trusting fluffies are worth more; scared or scarred ones less",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(4);
        let genes = null;
        const mk = (happy, trust, fear) => {
          const h = new Horse(1, null, "INDOORS", "earthy", genes ? genes.slice() : null, 0.5, 0.5, "female");
          genes = genes || h.genes.slice();
          h.adopted = true;
          h.pottyTraining = 0;
          h.happiness = happy;
          h.playerTrust = trust;
          h.playerFear = fear;
          fluffies.push(h);
          return h;
        };
        const ordinary = mk(0.6, 0.5, 0);
        const lovely = mk(0.95, 0.95, 0);
        const scared = mk(0.35, 0.15, 0.8);
        const scarred = mk(0.6, 0.5, 0);
        scarred.traumas = [{ type: "violent", text: "Hurt, then taken by force", severity: 0.5, blames: true }];
        const row = (f) => getFluffyInspectionInfo(f).care.find((x) => x.label === "Sells for").value;
        return {
          mult: [ordinary, lovely, scared, scarred].map((f) => +temperamentMultiplier(f).toFixed(2)),
          labels: [ordinary, lovely, scared, scarred].map((f) => describeTemperament(f)[0]),
          prices: [ordinary, lovely, scared, scarred].map((f) => f.calculatePrice()),
          rowLovely: row(lovely),
          rowOrdinary: row(ordinary),
        };
      });
      const [o, l, s, t] = r.mult;
      check(o > 0.9 && o < 1.1, `ordinary multiplier ${o}`);
      check(l >= 1.2, `lovely multiplier ${l}`);
      check(s <= 0.65 && t < o, `scared ${s}, scarred ${t}`);
      check(r.prices[1] > r.prices[0] && r.prices[0] > r.prices[3] && r.prices[3] > r.prices[2], `prices ${r.prices}`);
      checkEqual(r.labels[1], "Delightful pet", "lovely label");
      checkEqual(r.labels[2], "Damaged", "scared label");
      check(/Delightful pet \+\d+%/.test(r.rowLovely), `Sells for row: ${r.rowLovely}`);
      check(!/%/.test(r.rowOrdinary), `ordinary row shouldn't show a change: ${r.rowOrdinary}`);
    },
  },
  {
    name: "temperament: customers tip for delightful fluffies, pay less for damaged ones, and some want no trauma",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(6);
        customerOrders = freshCustomerOrders();
        const mk = (happy, trust, fear) => {
          const h = new Horse(1, null, "INDOORS", "earthy", null, null, null, "female");
          h.adopted = true;
          h.happiness = happy;
          h.playerTrust = trust;
          h.playerFear = fear;
          fluffies.push(h);
          return h;
        };
        const deliver = (f) => {
          const o = makeCustomerOrder(1);
          o.reqs = [{ kind: "gender", gender: "female", value: 60 }];
          o.reward = 1000;
          customerOrders.posted.push(o);
          acceptCustomerOrder(o.id);
          money = 0;
          const rep0 = customerOrders.reputation;
          deliverCustomerOrder(o.id, f.id);
          return { money, rep: customerOrders.reputation - rep0 };
        };
        const lovely = deliver(mk(0.95, 0.95, 0));
        const ordinary = deliver(mk(0.6, 0.5, 0));
        const damaged = deliver(mk(0.3, 0.1, 0.9));
        const calm = mk(0.6, 0.5, 0);
        const hurt = mk(0.6, 0.5, 0);
        hurt.traumas = [{ type: "violent", severity: 0.5, blames: true, text: "x" }];
        const req = { kind: "untroubled", value: 300 };
        return {
          lovely,
          ordinary,
          damaged,
          untroubled: [ORDER_REQUIREMENTS.untroubled.matches(req, calm), ORDER_REQUIREMENTS.untroubled.matches(req, hurt)],
          label: ORDER_REQUIREMENTS.untroubled.label(req),
        };
      });
      check(r.lovely.money > 1000, `paid for a delightful fluffy: ${r.lovely.money}`);
      checkEqual(r.ordinary.money, 1000, "paid for an ordinary fluffy");
      check(r.damaged.money < 1000, `paid for a damaged fluffy: ${r.damaged.money}`);
      check(r.damaged.rep < r.lovely.rep || r.lovely.rep === 1, `reputation: lovely ${r.lovely.rep}, damaged ${r.damaged.rep}`);
      checkEqual(JSON.stringify(r.untroubled), JSON.stringify([true, false]), "no-trauma requirement");
      check(r.label.includes("trauma"), `label: ${r.label}`);
    },
  },
  {
    name: "day report: a day's births, deaths, sales, orders and park news show up the next morning",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(9);
        gameState = "PAUSED";
        timePlayed = 0;
        money = 500;
        dayStats = freshDayStats();
        dayReportShown = null;
        const mk = (name, mom) => {
          const h = new Horse(mom ? 0 : 1, mom ? mom.id : null, "INDOORS", "earthy", null, null, null, "female");
          h.adopted = true;
          fluffyNames[h.id] = name;
          fluffies.push(h);
          return h;
        };
        const mum = mk("Daisy");
        const old = mk("Grandma");
        updateDayReport(1.1); // day starts
        const res = { startDay: dayStats.day };
        mk("Pip", mum); // born
        old.die(null, "Old age");
        noteDayEvent("sold", { money: 120 });
        noteDayEvent("order", { money: 900 });
        noteDayEvent("news", { text: "The Clover herd drove the Maple herd out of Daisy Bank!" });
        money += 1020;
        updateDayReport(1.1);
        res.noReportYet = dayReportShown === null;
        // Morning (6:00 on day 2 = 22 game hours after the 8:00 start)
        timePlayed = 22 * HOUR_LENGTH + 5;
        setGameSpeed(8);
        updateDayReport(1.1);
        res.report = dayReportShown;
        res.speed = gameSpeed;
        res.newDay = dayStats.day;
        res.freshBorn = dayStats.born.length;
        res.open = isAnyScreenOpen();
        gameState = "PLAYING";
        return res;
      });
      checkEqual(r.startDay, 0, "first report day");
      check(r.noReportYet, "report shown before morning");
      check(r.report, "no report in the morning");
      checkEqual(r.report.dayNumber, 1, "report day number");
      checkEqual(r.report.moneyEnd - r.report.moneyStart, 1020, "money change");
      checkEqual(JSON.stringify(r.report.born), JSON.stringify(["Pip"]), "born");
      check(r.report.died.length === 1 && r.report.died[0].startsWith("Grandma"), `died: ${r.report.died}`);
      checkEqual(r.report.sold.count, 1, "sold");
      checkEqual(r.report.orders.money, 900, "order money");
      checkEqual(r.report.news.length, 1, "news");
      checkEqual(r.speed, 1, "fast forward stops for the report");
      checkEqual(r.newDay, 1, "new day started");
      checkEqual(r.freshBorn, 0, "new day starts empty");
      check(r.open, "report should count as an open screen");
      // Close it with the button
      const btn = await page.evaluate(() => getDayReportLayout().btn);
      await page.mouse.click(btn.x + btn.w / 2, btn.y + btn.h / 2);
      checkEqual(await page.evaluate(() => dayReportShown), null, "report after clicking Start the day");
    },
  },
];
