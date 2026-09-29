// Commissions and regular customers (Commissions.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(41);
  customerOrders = freshCustomerOrders();
  money = 1000;
  timePlayed = 0;
  window.__mk = (opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, "INDOORS", opts.type || "earthy", null, 0.5, 0.5, opts.gender || "female");
    h.adopted = true;
    h.happiness = 0.8;
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "commissions: bred to order, pay well, give days, no plain earthies",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = { problems: [], ratio: [] };
        for (let level = 1; level <= 5; level++) {
          for (let i = 0; i < 100; i++) {
            const c = makeCommission(level);
            const kinds = c.reqs.map((q) => q.kind);
            if (kinds[kinds.length - 1] !== "bredHere") out.problems.push("no Bred by you");
            if (new Set(kinds).size !== kinds.length) out.problems.push(`repeat ${kinds}`);
            if (!["coat", "pattern", "type"].includes(kinds[0])) out.problems.push(`first is ${kinds[0]}`);
            if (c.reqs.some((q) => q.kind === "type" && q.type === "earthy")) out.problems.push("plain earthy");
            if (c.reqs.some((q) => q.type === "alicorn")) out.problems.push("alicorn on day 1");
            if (c.timeAllowed < COMMISSION_DAYS * DAY_LENGTH) out.problems.push("too little time");
            if (c.deposit !== Math.round((c.reward * 0.2) / 10) * 10) out.problems.push("deposit");
            if (!c.commission || c.leavesAt !== DAY_LENGTH) out.problems.push("board time");
          }
        }
        out.sample = makeCommission(2);
        out.labels = out.sample.reqs.map(orderReqLabel);
        return { problems: [...new Set(out.problems)], labels: out.labels, reward: out.sample.reward };
      }, SETUP);
      checkEqual(r.problems.length, 0, r.problems.join("; "));
      checkEqual(r.labels[r.labels.length - 1], "Bred by you", "label");
      check(r.reward >= 500, `a level 2 commission pays well ($${r.reward})`);
    },
  },
  {
    name: "commissions: deposit on accepting, only your own foals count, the rest on delivery; giving up returns the deposit",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const make = () => {
          const c = makeCommission(1);
          c.reqs = [{ kind: "gender", gender: "female", value: 60 }, { kind: "bredHere", value: 0 }];
          c.reward = 1000;
          c.deposit = 200;
          customerOrders.posted.push(c);
          return c;
        };
        const c = make();
        acceptCustomerOrder(c.id);
        out.afterAccept = money;
        // A bought mare doesn't count; one born to your mare does
        const bought = __mk();
        const mum = __mk();
        const foal = __mk({ mum: mum.id, growth: 0.3 });
        foal.bredHere = true;
        out.bought = fluffyFitsOrder(c, bought);
        out.foal = fluffyFitsOrder(c, foal);
        out.refused = deliverCustomerOrder(c.id, bought.id);
        out.sent = deliverCustomerOrder(c.id, foal.id);
        out.afterDeliver = money;
        out.client = JSON.parse(JSON.stringify(getClient(c.customer)));
        // Give one up: the deposit goes back
        const c2 = make();
        acceptCustomerOrder(c2.id);
        const rep = (customerOrders.reputation = 20);
        const before = money;
        giveUpCustomerOrder(c2.id);
        out.giveUp = { money: before - money, rep: rep - customerOrders.reputation };
        // Run out of time
        const c3 = make();
        acceptCustomerOrder(c3.id);
        const m3 = money;
        timePlayed = c3.dueAt + 1;
        updateCustomerOrders(0);
        out.missed = { money: m3 - money, gone: !customerOrders.active.includes(c3) };
        // Old saves: a foal born to a mare you had
        const old = __mk({ mum: mum.id });
        old.bredHere = null;
        const wild = __mk({ mum: mum.id });
        wild.bredHere = null;
        wild.fromPark = true;
        out.oldSave = [isBredByYou(old), isBredByYou(wild), isBredByYou(__mk())];
        out.repLoss = COMMISSION_REP_MISSED;
        return out;
      }, SETUP);
      checkEqual(r.afterAccept, 1200, "deposit paid on accepting");
      checkEqual(r.bought, false, "a bought mare isn't bred by you");
      checkEqual(r.foal, true, "your mare's foal is");
      checkEqual(r.refused, false, "can't send the wrong one");
      checkEqual(r.sent, true, "delivered");
      check(r.afterDeliver >= 1200 + 800 - 1 && r.afterDeliver <= 1200 + 800 + 400, `the rest paid (${r.afterDeliver})`);
      check(r.client.filled === 1 && r.client.loyalty >= 1, `customer remembers ${JSON.stringify(r.client)}`);
      checkEqual(r.giveUp.money, 200, "giving up returns the deposit");
      checkEqual(r.giveUp.rep, r.repLoss, "bigger reputation hit");
      check(r.repLoss > 2, `commissions cost more reputation (${r.repLoss})`);
      check(r.missed.gone && r.missed.money === 200, `missed: deposit back ${JSON.stringify(r.missed)}`);
      checkEqual(JSON.stringify(r.oldSave), JSON.stringify([true, false, false]), "old saves");
    },
  },
  {
    name: "commissions: foals born to your mares are bred by you; bought and wild ones aren't",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk();
        const baby = new Horse(0, mum.id, "INDOORS", "earthy", null, 0.5, 0.5, "female");
        mum.litterSize = 2;
        onFoalBorn(mum, baby, true);
        const wildMum = __mk();
        wildMum.adopted = false;
        const wildBaby = new Horse(0, wildMum.id, "INDOORS", "earthy", null, 0.5, 0.5, "female");
        onFoalBorn(wildMum, wildBaby, true);
        const fresh = new Horse(1, null, "INDOORS", "earthy");
        const copy = Horse.deserialize(JSON.parse(JSON.stringify(baby.serialize())));
        fluffies.splice(fluffies.indexOf(copy), 1);
        return { baby: isBredByYou(baby), wild: isBredByYou(wildBaby), fresh: isBredByYou(fresh), saved: copy.bredHere };
      }, SETUP);
      checkEqual(r.baby, true, "your mare's foal");
      checkEqual(r.wild, false, "a wild mare's foal");
      checkEqual(r.fresh, false, "a new fluffy");
      checkEqual(r.saved, true, "saved");
    },
  },
  {
    name: "customers: pleased customers come back, pay more and give more time; letters; upset ones stay away",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const c = getClient("Farmer Oats");
        c.loyalty = 3;
        // How often orders come from them
        let theirs = 0;
        for (let i = 0; i < 400; i++) if (pickOrderCustomer() === "Farmer Oats") theirs++;
        out.share = theirs / 400;
        out.tier = clientTier("Farmer Oats").name;
        out.badge = describeClientBadge("Farmer Oats");
        // Same order, as a regular
        const plain = { customer: "Nobody", reward: 1000, timeAllowed: 1000 };
        const reg = applyClientBonus({ customer: "Farmer Oats", reward: 1000, timeAllowed: 1000 });
        out.bonus = [applyClientBonus(plain).reward, reg.reward, reg.timeAllowed];
        c.loyalty = 6;
        out.loyal = applyClientBonus({ customer: "Farmer Oats", reward: 1000, timeAllowed: 1000 }).reward;
        // Their favourite type turns up in their orders
        const pref = customerPref("Farmer Oats");
        let withPref = 0;
        let orders = 0;
        for (let i = 0; i < 300; i++) {
          const o = makeCustomerOrder(2);
          if (o.customer !== "Farmer Oats") continue;
          orders++;
          if (o.reqs.some((q) => q.kind === "type" && q.type === pref)) withPref++;
        }
        out.pref = { pref, share: orders ? withPref / orders : null };
        // Upset customers stop ordering
        const u = getClient("Mr. Grimsby");
        u.loyalty = -2;
        let grim = 0;
        for (let i = 0; i < 400; i++) if (pickOrderCustomer() === "Mr. Grimsby") grim++;
        out.grim = grim;
        // Letters
        const said = [];
        const realMsg = window.addUIMessage;
        window.addUIMessage = (t) => said.push(t);
        try {
          customerOrders.letters = [
            { at: 10, customer: "Farmer Oats", fluffy: "Bella", mood: "delighted", tip: 40 },
            { at: 10, customer: "Mr. Grimsby", fluffy: "Pip", mood: "upset", tip: 0 },
            { at: 99999, customer: "Farmer Oats", fluffy: "Later", mood: "fine", tip: 0 },
          ];
          const m0 = money;
          timePlayed = 20;
          customerOrders.nextCommissionAt = 1e9;
          updateCustomerOrders(0);
          out.letters = { said: said.filter((t) => /^Letter/.test(t)), tip: money - m0, left: customerOrders.letters.length, grimLoyalty: getClient("Mr. Grimsby").loyalty };
        } finally {
          window.addUIMessage = realMsg;
        }
        return out;
      }, SETUP);
      check(r.share > 0.3 && r.share < 0.6, `a regular places many of the orders (${r.share})`);
      checkEqual(r.tier, "Regular", "tier");
      checkEqual(r.badge, "★ Regular +15%", "badge");
      checkEqual(JSON.stringify(r.bonus), JSON.stringify([1000, 1150, 1150]), "Regular: +15% money and time");
      checkEqual(r.loyal, 1250, "Loyal: +25%");
      if (r.pref.pref && r.pref.share !== null) check(r.pref.share > 0.4, `favourite type in their orders ${JSON.stringify(r.pref)}`);
      checkEqual(r.grim, 0, "an upset customer doesn't order");
      checkEqual(r.letters.said.length, 2, `two letters arrived: ${r.letters.said}`);
      checkEqual(r.letters.tip, 40, "a tip with the happy one");
      checkEqual(r.letters.left, 1, "the later one waits");
      checkEqual(r.letters.grimLoyalty, -3, "a complaint costs loyalty");
    },
  },
  {
    name: "commissions: one on the board and one FluffList exclusive from the start, each replaced daily; saved; the board draws",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        customerOrders.postTimer = 1e9; // no ordinary orders
        customerOrders.reputation = 6; // Known breeder (level 2)
        const count = () => ({
          board: customerOrders.posted.filter((o) => o.commission && o.source === "board").length,
          web: customerOrders.posted.filter((o) => o.commission && o.source === "web").length,
        });
        const at = (t) => {
          timePlayed = t;
          updateCustomerOrders(0);
          return count();
        };
        const out = {};
        out.day3 = at(0); // straight away
        out.day4 = at(DAY_LENGTH * 3.1); // a day or two later: still one of each
        const first = customerOrders.posted.find((o) => o.source === "board").id;
        out.sameDay = at(DAY_LENGTH * 3.5);
        out.nextDay = at(DAY_LENGTH * 4.2); // the day's up: new ones
        out.replaced = !customerOrders.posted.some((o) => o.id === first);
        // Accepting one doesn't stop tomorrow's
        const b = customerOrders.posted.find((o) => o.source === "board");
        acceptCustomerOrder(b.id);
        out.afterAccept = count().board;
        out.tomorrow = at(DAY_LENGTH * 5.3).board;
        // Board vs FluffList
        openOrdersScreen("board");
        out.boardShows = ordersList("posted").filter((o) => o.commission).map((o) => o.source);
        openOrdersScreen("web");
        out.webShows = ordersList("posted").filter((o) => o.commission).map((o) => o.source).sort();
        closeOrdersScreen();
        // Saved
        const data = {};
        writeSavedGameState(data);
        const json = JSON.parse(JSON.stringify(data));
        customerOrders = freshCustomerOrders();
        readSavedGameState(json);
        out.saved = customerOrders.posted.some((o) => o.source === "web" && o.reqs.some((q) => q.kind === "bredHere"));
        // Draws in both places
        getClient(customerOrders.posted[0].customer).loyalty = 3;
        out.drew = [];
        for (const mode of ["board", "web"]) {
          openOrdersScreen(mode);
          ordersTab = "orders";
          try {
            drawOrdersScreen(ctx);
            out.drew.push(true);
          } catch (e) {
            out.drew.push(e.message);
          }
          closeOrdersScreen();
        }
        out.days = formatDaysLeft(DAY_LENGTH * 2 + HOUR_LENGTH * 3);
        out.hours = formatDaysLeft(HOUR_LENGTH * 5);
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.day3), JSON.stringify({ board: 1, web: 1 }), "one of each from the start");
      checkEqual(JSON.stringify(r.day4), JSON.stringify({ board: 1, web: 1 }), "one of each later");
      checkEqual(JSON.stringify(r.sameDay), JSON.stringify({ board: 1, web: 1 }), "still one of each");
      checkEqual(JSON.stringify(r.nextDay), JSON.stringify({ board: 1, web: 1 }), "a day later");
      check(r.replaced, "the old one was replaced by a new one");
      checkEqual(r.afterAccept, 0, "accepted: off the board");
      checkEqual(r.tomorrow, 1, "a new one the next day");
      checkEqual(JSON.stringify(r.boardShows), JSON.stringify(["board"]), "the Bounty Board doesn't show the exclusive");
      checkEqual(JSON.stringify(r.webShows), JSON.stringify(["board", "web"]), "FluffList shows both");
      check(r.saved, "saved with the game");
      checkEqual(JSON.stringify(r.drew), JSON.stringify([true, true]), "draws");
      checkEqual(r.days, "2 days 3 h", "days left");
      checkEqual(r.hours, "5 h", "hours left");
    },
  },
  {
    name: "commissions: FluffList exclusives are a tier harder, pay more and give a day longer; alicorn commissions from day 4",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
        const normal = [];
        const excl = [];
        const reqN = [];
        const reqE = [];
        const alicorn = { early: 0, late: 0 };
        for (let i = 0; i < 300; i++) {
          const n = makeCommission(2);
          const e = makeCommission(2, Math.random, { exclusive: true });
          normal.push(n.reward);
          excl.push(e.reward);
          reqN.push(n.reqs.length);
          reqE.push(e.reqs.length);
          if (i === 0) Object.assign(alicorn, { eLevel: e.level, source: [n.source, e.source] });
          alicorn.eTime = Math.min(alicorn.eTime ?? Infinity, e.timeAllowed);
          alicorn.nTime = Math.min(alicorn.nTime ?? Infinity, n.timeAllowed);
          // Day 3 vs day 4, at the lowest reputation
          timePlayed = DAY_LENGTH * 2.5;
          if (makeCommission(1, Math.random, { exclusive: true }).reqs.some((q) => q.type === "alicorn") || makeCommission(1).reqs.some((q) => q.type === "alicorn")) alicorn.early++;
          timePlayed = DAY_LENGTH * 3.1;
          if (makeCommission(1).reqs.some((q) => q.type === "alicorn")) alicorn.late++;
          timePlayed = 0;
        }
        return { normal: avg(normal), excl: avg(excl), reqN: avg(reqN), reqE: avg(reqE), maxE: Math.max(...reqE), alicorn };
      }, SETUP);
      check(r.excl > r.normal * 1.8, `exclusives pay more ($${Math.round(r.excl)} vs $${Math.round(r.normal)})`);
      check(r.reqE > r.reqN, `more requirements (${r.reqE} vs ${r.reqN})`);
      check(r.maxE <= 4, "at most 3 plus Bred by you");
      checkEqual(r.alicorn.eLevel, 3, "a tier up");
      check(r.alicorn.eTime > r.alicorn.nTime, `a day longer (${r.alicorn.eTime} vs ${r.alicorn.nTime})`);
      checkEqual(JSON.stringify(r.alicorn.source), JSON.stringify(["board", "web"]), "sources");
      checkEqual(r.alicorn.early, 0, "no alicorn commissions before day 4");
      check(r.alicorn.late > 5, `alicorn commissions from day 4, even at the lowest reputation (${r.alicorn.late} of 300)`);
    },
  },
];
