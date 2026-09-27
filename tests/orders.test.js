// Customer orders (Orders.js) and where you see them (OrderBoard.js).
// The Computer item's buying/selling/saving is covered by items.test.js.
const { check, checkEqual } = require("./helpers");

// Seeded random function for making orders, shared by the tests
const SEEDED = `(() => { let s = 12345; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()`;

module.exports = [
  {
    name: "orders: requirements follow the reputation level",
    run: async (page) => {
      const r = await page.evaluate((seeded) => {
        const rnd = eval(seeded);
        const problems = [];
        const gated = { pattern: 2, trait: 2, size: 3, carrier: 4 };
        const avg = {};
        for (let level = 1; level <= 5; level++) {
          let total = 0;
          for (let i = 0; i < 200; i++) {
            const o = makeCustomerOrder(level, rnd);
            total += o.reward;
            const kinds = o.reqs.map((q) => q.kind);
            if (new Set(kinds).size !== kinds.length) problems.push(`L${level}: repeated requirement ${kinds}`);
            if (!o.reqs.length) problems.push(`L${level}: empty order`);
            for (const q of o.reqs) {
              if (gated[q.kind] && level < gated[q.kind]) problems.push(`L${level}: ${q.kind} too early`);
              if (q.kind === "type" && q.type === "alicorn" && level < 3) problems.push(`L${level}: alicorn too early`);
              if (q.kind === "coat" && q.colour && level < 2) problems.push(`L${level}: coat colour too early`);
              if (!orderReqLabel(q)) problems.push(`L${level}: ${q.kind} has no label`);
            }
            // Carrying wings/horn can't go with a type that shows it
            const type = o.reqs.find((q) => q.kind === "type");
            const carrier = o.reqs.find((q) => q.kind === "carrier");
            if (type && carrier) {
              const shows = { wings: ["pegasus", "alicorn"], horn: ["unicorn", "alicorn"] }[carrier.trait];
              if (shows.includes(type.type)) problems.push(`L${level}: ${type.type} can't carry hidden ${carrier.trait}`);
            }
          }
          avg[level] = total / 200;
        }
        return { problems: [...new Set(problems)].slice(0, 8), avg };
      }, SEEDED);
      check(r.problems.length === 0, r.problems.join("; "));
      for (let l = 2; l <= 5; l++) check(r.avg[l] > r.avg[l - 1], `level ${l} doesn't pay more than level ${l - 1}: ${JSON.stringify(r.avg)}`);
    },
  },
  {
    name: "orders: accept, deliver the right fluffy, get paid",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(3);
        customerOrders = freshCustomerOrders();
        money = 100;
        const mk = (type, gender, trained) => {
          const h = new Horse(1, null, "INDOORS", type, null, null, null, gender);
          h.adopted = true;
          h.pottyTraining = trained;
          fluffies.push(h);
          return h;
        };
        const right = mk("unicorn", "female", 1);
        const wrong = mk("unicorn", "female", 0);
        const o = makeCustomerOrder(1);
        o.reqs = [
          { kind: "trained", full: true, value: 600 },
          { kind: "gender", gender: "female", value: 60 },
        ];
        o.reward = 900;
        customerOrders.posted.push(o);
        const res = {};
        res.accepted = acceptCustomerOrder(o.id);
        res.dueSet = customerOrders.active[0] && customerOrders.active[0].dueAt > timePlayed;
        res.wrongRefused = !deliverCustomerOrder(o.id, wrong.id);
        res.moneyAfterWrong = money;
        res.fits = countFluffiesForOrder(o);
        res.delivered = deliverCustomerOrder(o.id, right.id);
        res.money = money;
        res.rep = customerOrders.reputation;
        res.gone = !fluffies.includes(right);
        res.stillHere = fluffies.includes(wrong);
        res.record = getFamilyRecord(right.id) && getFamilyRecord(right.id).status;
        res.active = customerOrders.active.length;
        // Only 3 at a time
        for (let i = 0; i < 4; i++) customerOrders.posted.push(makeCustomerOrder(1));
        res.accepts = customerOrders.posted.slice().map((p) => acceptCustomerOrder(p.id));
        return res;
      });
      check(r.accepted && r.dueSet, "accepting didn't set a deadline");
      check(r.wrongRefused, "a fluffy that doesn't fit was accepted");
      checkEqual(r.moneyAfterWrong, 100, "money after the wrong fluffy");
      checkEqual(r.fits, 1, "fluffies that fit");
      check(r.delivered, "the right fluffy wasn't accepted");
      checkEqual(r.money, 1000, "money after delivering");
      checkEqual(r.rep, 2, "reputation (one point per requirement)");
      check(r.gone && r.stillHere, "the wrong fluffy left, or the right one stayed");
      checkEqual(r.record, "sold", "family record");
      checkEqual(JSON.stringify(r.accepts), JSON.stringify([true, true, true, false]), "accepting a 4th order");
    },
  },
  {
    name: "orders: deadlines, leaving the board, and new orders over time",
    run: async (page) => {
      const r = await page.evaluate(() => {
        customerOrders = freshCustomerOrders();
        customerOrders.reputation = 10;
        timePlayed = 1000;
        updateCustomerOrders(0.016); // first orders go up straight away
        const firstPosted = customerOrders.posted.length;
        const o = customerOrders.posted[0];
        acceptCustomerOrder(o.id);
        const due = o.dueAt;
        // Let the accepted order run out
        timePlayed = due + 1;
        updateCustomerOrders(0.016);
        const afterMiss = { rep: customerOrders.reputation, missed: customerOrders.missed, active: customerOrders.active.length };
        // The others leave the board after their time
        timePlayed = 1000 + ORDER_BOARD_LIFETIME + 5;
        customerOrders.postTimer = 9999;
        updateCustomerOrders(0.016);
        const leftBoard = customerOrders.posted.length;
        // New ones arrive every few minutes, up to the board's limit
        for (let t = 0; t < 60 * 30; t += 1) {
          timePlayed += 1;
          updateCustomerOrders(1);
          if (customerOrders.postTimer > 9000) customerOrders.postTimer = 0;
        }
        return { firstPosted, afterMiss, leftBoard, later: customerOrders.posted.length, max: _orderMaxPosted() };
      });
      checkEqual(r.firstPosted, 3, "orders at the start");
      checkEqual(r.afterMiss.rep, 7, "reputation after a missed order");
      checkEqual(r.afterMiss.missed, 1, "missed count");
      checkEqual(r.afterMiss.active, 0, "accepted orders after the deadline");
      checkEqual(r.leftBoard, 0, "posted orders after they expire");
      check(r.later > 0 && r.later <= r.max, `orders on the board later: ${r.later} (max ${r.max})`);
    },
  },
  {
    name: "orders and reputation survive saving and loading",
    run: async (page) => {
      const r = await page.evaluate(async () => {
        gameState = "PAUSED"; // stop the clock so no new orders appear meanwhile
        customerOrders = freshCustomerOrders();
        customerOrders.reputation = 21;
        customerOrders.posted.push(makeCustomerOrder(3));
        customerOrders.posted.push(makeCustomerOrder(3));
        acceptCustomerOrder(customerOrders.posted[0].id);
        const before = JSON.stringify(customerOrders);
        await saveGame("__automated_test__");
        customerOrders = freshCustomerOrders();
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        gameState = "PAUSED";
        return { same: JSON.stringify(customerOrders) === before, level: getOrderLevel() };
      });
      check(r.same, "orders changed after saving and loading");
      checkEqual(r.level, 3, "reputation level after loading");
    },
  },
  {
    name: "bounty board and computer open the orders screen",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate(() => {
        __clearScene();
        tutorialTimer = 0;
        customerOrders = freshCustomerOrders();
        customerOrders.posted.push(makeCustomerOrder(1));
        customerOrders.postTimer = 9999;
        changeScene("SHOP_STREET");
      });
      const board = await page.evaluate(() => {
        const b = getBountyBoardRect();
        return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      });
      await page.mouse.click(board.x, board.y);
      checkEqual(await page.evaluate(() => ordersScreenMode), "board", "after clicking the board");
      check(await page.evaluate(() => isAnyScreenOpen()), "the game doesn't know a screen is open");

      // Accept with a real click
      const acc = await page.evaluate(() => {
        const b = _ordersLayout().posted[0].accept;
        const { s, ox, oy } = _osOrigin();
        return { x: ox + (b.x + b.w / 2) * s, y: oy + (b.y + b.h / 2) * s };
      });
      await page.mouse.click(acc.x, acc.y);
      checkEqual(await page.evaluate(() => customerOrders.active.length), 1, "accepted orders");

      const close = await page.evaluate(() => {
        const b = _ordersLayout().close;
        const { s, ox, oy } = _osOrigin();
        return { x: ox + (b.x + b.w / 2) * s, y: oy + (b.y + b.h / 2) * s };
      });
      await page.mouse.click(close.x, close.y);
      checkEqual(await page.evaluate(() => ordersScreenMode), null, "after Close");

      // Computer at home: right-click opens FluffList
      await page.evaluate(() => {
        changeScene("INDOORS");
        const c = new Computer("INDOORS");
        c.setPosition(900, 450);
        objects.push(c);
      });
      await page.mouse.click(900, 410, { button: "right" });
      checkEqual(await page.evaluate(() => ordersScreenMode), "web", "after right-clicking the computer");
      await page.evaluate(() => closeOrdersScreen());
    },
  },
];
