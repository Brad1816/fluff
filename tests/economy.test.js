// An economy that scales (Economy.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  economy = freshEconomy();
  billsOwed = 0;
  pressure = freshPressure();
  unlockedRoomsL = 0;
  unlockedRoomsR = 0;
  window.__ec = (x, growth = 1) => {
    const f = new Horse(growth, null, "INDOORS", "earthy", null, 0.6, 0.6, "female");
    f.adopted = true;
    f.x = x;
    f.y = 450;
    f.hunger = 1;
    fluffies.push(f);
    return f;
  };
}`;

module.exports = [
  {
    name: "economy: takings are counted; the weekly rent review follows them, rising fast and falling slowly",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        noteDayEvent("sold", { money: 700 });
        noteDayEvent("order", { money: 300 });
        noteIncome(-50); // (ignored)
        out.today = economy.today;
        // A week of good takings: 5,000 a day
        economy.week = Array.from({ length: 7 }, (_, i) => ({ day: i + 1, amount: 5000 }));
        out.target = rentTarget();
        out.first = reviewRent();
        out.second = reviewRent();
        // A dead week: it only comes down 15% a review
        economy.week = Array.from({ length: 7 }, (_, i) => ({ day: i + 1, amount: 0 }));
        out.fall = reviewRent();
        // The morning: yesterday's takings join the week; the review is on its day
        economy = freshEconomy();
        economy.today = 1234;
        economy.nextReview = getDayNumber();
        economy.lastMorning = null;
        economyMorning();
        out.week = economy.week.map((x) => x.amount);
        out.reviewed = economy.rentLog.length;
        out.next = economy.nextReview - getDayNumber();
        economyMorning(); // (twice in one morning: nothing)
        out.weekAgain = economy.week.length;
        out.bill = dailyBills().rent === economy.rent;
        return out;
      }, SETUP);
      checkEqual(r.today, 1000, "sales and orders counted");
      checkEqual(r.target, 620, "$20 + 12% of $5,000");
      checkEqual(r.first, 60, "at most double + $20 in one review");
      checkEqual(r.second, 140, "then again");
      checkEqual(r.fall, 80, "falls half way to what the landlord would ask (at least 15%)");
      checkEqual(JSON.stringify(r.week), "[1234]", "yesterday's takings");
      checkEqual(r.reviewed, 0, "no review until there's a full week of takings");
      checkEqual(r.weekAgain, 1, "only once a morning");
      check(r.bill, "the bill uses it");
    },
  },
  {
    name: "economy: each extra room costs more; heating in autumn and winter by rooms in use, plus the heaters, none in a power cut",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        out.rooms = [roomsBill(0), roomsBill(1), roomsBill(3)];
        __ec(300);
        const b = __ec(400);
        b.scene = "BACKYARD"; // not a room you heat
        const season = window.getSeason;
        try {
          window.getSeason = () => "Spring";
          out.spring = houseHeatingRate();
          window.getSeason = () => "Winter";
          out.winter = houseHeatingRate();
          // It adds up over the day: half a winter day in one room is $6
          economy.houseHeat = 0;
          for (let t = 0; t < DAY_LENGTH / 2; t += 5) updateEconomy(5);
          out.half = houseHeatingToday();
          addHeaterUse(9);
          money = 5000;
          out.billHeat = dailyBills().heating;
          economy.lastMorning = getDayNumber();
          chargeDailyBills();
          out.after = [economy.heaterUse, houseHeatingToday()];
          pressure.debtDays = POWER_CUT_DAY;
          billsOwed = 10;
          out.cut = houseHeatingRate();
          pressure.debtDays = 0;
          billsOwed = 0;
        } finally {
          window.getSeason = season;
        }
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.rooms), JSON.stringify([0, 15, 75]), "rooms: 15, 25, 35...");
      checkEqual(r.spring, 0, "no heating in spring");
      checkEqual(r.winter, 12, "one room in use, winter");
      check(r.half >= 6 && r.half <= 7, `half a winter day, one room: ${r.half}`);
      checkEqual(r.billHeat, r.half + 9, "house + heaters on the bill");
      checkEqual(JSON.stringify(r.after), "[0,0]", "charged once");
      checkEqual(r.cut, 0, "power cut: no heating bill");
    },
  },
  {
    name: "economy: the vet plan costs a premium a day and covers visits from the next day",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __ec(300);
        __ec(400);
        f.health = 50;
        money = 5000;
        out.premium = planPremium();
        joinVetPlan();
        out.billPlan = dailyBills().plan;
        // Same day: full price
        const full = vetTreatmentPrice(f);
        let m = money;
        vetTreat(f);
        out.sameDay = [m - money, full];
        // Next day: a quarter; check-up free
        economy.plan.since = getDayNumber() - 1;
        f.health = 50;
        const full2 = vetTreatmentPrice(f);
        m = money;
        vetTreat(f);
        out.covered = [m - money, Math.round(full2 * PLAN_SHARE)];
        m = money;
        vetCheckUp(f);
        out.check = m - money;
        out.claims = economy.claims;
        // Jabs aren't covered
        m = money;
        vetJab(f);
        out.jab = m - money;
        leaveVetPlan();
        out.left = [onVetPlan(), dailyBills().plan || 0];
        return out;
      }, SETUP);
      checkEqual(r.premium, 16, "$10 + $3 a fluffy");
      checkEqual(r.billPlan, 16, "on the bill");
      checkEqual(r.sameDay[0], r.sameDay[1], "joining today doesn't cover today");
      checkEqual(r.covered[0], r.covered[1], "a quarter of the price from tomorrow");
      checkEqual(r.check, 0, "check-ups free");
      check(r.claims > 0, `saved: ${r.claims}`);
      check(r.jab > 0, "jabs cost as before");
      checkEqual(JSON.stringify(r.left), JSON.stringify([false, 0]), "left the plan");
    },
  },
  {
    name: "economy: the landlord's loans - offers by takings, paid back on the bill, paid off early, one at a time",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        out.poor = loanOffers();
        economy.week = [{ day: 1, amount: 1000 }];
        out.offers = loanOffers();
        money = 100;
        out.took = takeLoan(2000);
        out.money = money;
        out.second = takeLoan(500);
        out.loan = { ...economy.loan };
        out.billLoan = dailyBills().loan;
        economy.lastMorning = getDayNumber(); // (no review this morning)
        money = 10000;
        chargeDailyBills();
        out.left = economy.loan.left;
        // Pay it off early
        money = 100;
        out.cantPay = repayLoan();
        money = 10000;
        out.paid = repayLoan();
        out.after = [economy.loan, money];
        // The last payments end it
        takeLoan(500);
        economy.loan.left = 30;
        chargeDailyBills();
        out.ended = economy.loan;
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.poor), "[500]", "at least $500 on offer");
      checkEqual(JSON.stringify(r.offers), JSON.stringify([500, 2000]), "up to 3x last week's takings");
      check(r.took, "took the loan");
      checkEqual(r.money, 2100, "money in hand");
      checkEqual(r.second, false, "one at a time");
      checkEqual(JSON.stringify(r.loan), JSON.stringify({ amount: 2000, total: 2400, left: 2400, perDay: 240, day: r.loan.day }), "20% over 10 days");
      checkEqual(r.billLoan, 240, "on the bill");
      checkEqual(r.left, 2160, "a payment made");
      checkEqual(r.cantPay, false, "can't pay it off without the money");
      check(r.paid, "paid off early");
      checkEqual(JSON.stringify(r.after), JSON.stringify([null, 10000 - 2160]), "cleared");
      checkEqual(r.ended, null, "the last payment ends it");
    },
  },
  {
    name: "economy: the accounts - clicking your money or K opens them; join the plan and borrow there; Today's debt row goes there",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate((setup) => {
        eval(setup)();
        money = 300;
        economy.week = [{ day: 1, amount: 1000 }];
      }, SETUP);
      const mr = await page.evaluate(() => getMoneyRect());
      await page.mouse.click(mr.x + 10, mr.y + 12);
      const opened = await page.evaluate(() => isAccountsOpen());
      const L = await page.evaluate(() => getAccountsLayout());
      await page.mouse.click(L.plan.x + 10, L.plan.y + 10);
      const plan = await page.evaluate(() => onVetPlan());
      const borrow = L.offers.find((o) => o.amount === 2000);
      await page.mouse.click(borrow.x + 10, borrow.y + 10);
      const loan = await page.evaluate(() => [economy.loan && economy.loan.amount, money]);
      const drawErr = await page.evaluate(() => {
        try {
          drawAccounts(ctx);
          return null;
        } catch (e) {
          return e.message;
        }
      });
      await page.keyboard.press("Escape");
      const closed = await page.evaluate(() => !isAccountsOpen());
      await page.keyboard.press("KeyK");
      const k = await page.evaluate(() => isAccountsOpen());
      await page.keyboard.press("KeyK");
      // Today: the debt row opens the accounts
      const today = await page.evaluate(() => {
        billsOwed = 50;
        openToday();
        _todayCache = null;
        const T = getTodayLayout();
        const row = T.rows.find((x) => /You owe/.test(x.item.text));
        return row ? { x: row.x + 20, y: row.y + 10 } : null;
      });
      if (today) await page.mouse.click(today.x, today.y);
      const fromToday = await page.evaluate(() => {
        const r = isAccountsOpen() && !isTodayOpen();
        closeAccounts();
        billsOwed = 0;
        leaveVetPlan();
        economy = freshEconomy();
        return r;
      });
      check(opened, "clicking your money opened the accounts");
      check(plan, "joined the plan");
      checkEqual(JSON.stringify(loan), JSON.stringify([2000, 2290]), "borrowed $2,000 (after the plan's first $10)");
      checkEqual(drawErr, null, "drawing");
      check(closed, "Esc closed it");
      check(k, "K opened it");
      check(today, "a debt row in Today");
      check(fromToday, "the debt row opened the accounts");
    },
  },
  {
    name: "economy: review fixes - deposits owed back, the power returns when the debt's paid, bailiffs give change, debug mode stays out of it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        // A commission given up with no money: the deposit is owed, not free
        money = 0;
        billsOwed = 0;
        noteOrderFailed({ customer: "Test", commission: true, depositPaid: 800 });
        out.owedDeposit = billsOwed;
        // Power cut, then pay it off during the day
        pressure.debtDays = POWER_CUT_DAY;
        out.cut = powerCut();
        money = 1000;
        out.paid = payDebtNow();
        out.after = [powerCut(), pressure.debtDays, billsOwed, money];
        // Bailiffs: the cheapest fluffy that covers it, and change back
        const a = __ec(300);
        const b = __ec(500);
        a.calculatePrice = () => 100;
        b.calculatePrice = () => 1000;
        billsOwed = 40;
        money = 0;
        pressure.debtDays = 5;
        sendBailiffs();
        out.took = [fluffies.includes(a), fluffies.includes(b)];
        out.change = money;
        out.cleared = [billsOwed, pressure.debtDays];
        // Debug mode: no income counted, no loan, no heater bill
        showDebugMenu = true;
        try {
          economy.today = 0;
          noteIncome(500);
          out.debugIncome = economy.today;
          economy.week = [{ day: 1, amount: 1000 }];
          out.debugLoan = takeLoan(500);
          addHeaterUse(9);
          out.debugHeat = economy.heaterUse;
        } finally {
          showDebugMenu = false;
        }
        return out;
      }, SETUP);
      checkEqual(r.owedDeposit, 800, "the deposit you couldn't pay back is owed");
      check(r.cut, "power cut while owing");
      checkEqual(JSON.stringify(r.after), JSON.stringify([false, 0, 0, 200]), "paid off in the day: power back at once");
      checkEqual(JSON.stringify(r.took), JSON.stringify([false, true]), "took the one that covered it");
      checkEqual(r.change, 20, "and gave the change back ($60 - $40)");
      checkEqual(JSON.stringify(r.cleared), "[0,0]", "debt cleared, days reset");
      checkEqual(r.debugIncome, 0, "no takings counted in debug");
      checkEqual(r.debugLoan, false, "no loans in debug");
      checkEqual(r.debugHeat, 0, "no heater bill in debug");
    },
  },
];
