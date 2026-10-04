// The rival breeder (Rival.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene("INDOORS");
  __clearScene("ALLEY");
  __seedRandom(808);
  closeAllChoices();
  rivalState = freshRivalState();
  rivalPanelOpen = false;
  currentScene = "INDOORS";
  timePlayed = 4 * DAY_LENGTH + 9 * HOUR_LENGTH;
  money = 20000;
  window.__morning = () => {
    timePlayed += DAY_LENGTH;
    updateRival(3.1);
  };
}`;

module.exports = [
  {
    name: "rival: a breeder opens on Shopping Street (a random kind); its window has stock you can buy; saved and loaded; the shop front and the look inside draw",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        updateRival(3.1);
        out.open = rivalOpen() && !!RIVAL_KINDS[rivalState.kind] && !!rivalState.shop;
        out.stock = rivalState.stock.length;
        out.markup = rivalState.stock.every((l) => l.price > 0 && l.rival);
        // Buy one
        const l = rivalState.stock[0];
        const m0 = money;
        const s0 = rivalState.score;
        const f = buyFromRival(l.id);
        out.bought = !!f && f.adopted && money === m0 - l.price && !rivalState.stock.includes(l) && rivalState.score === Math.min(100, s0 + 1);
        // Save and load
        const st = SAVED_GAME_STATE.find((s) => s.name === "rivalState");
        const data = JSON.parse(JSON.stringify(st.get()));
        st.set(data);
        out.loaded = rivalState.shop === data.shop && rivalState.stock.length === data.stock.length;
        // Draw
        let err = null;
        try {
          currentScene = "SHOP_STREET";
          drawRivalShop(ctx);
          rivalPanelOpen = true;
          drawRivalPanel(ctx);
          rivalState.sale = { until: timePlayed + 100, war: true };
          drawRivalShop(ctx);
          rivalState.closing = { until: getDayNumber() + 2 };
          drawRivalShop(ctx);
          drawRivalPanel(ctx);
          rivalState.closing = null;
          rivalState.closedUntil = getDayNumber() + 5;
          drawRivalShop(ctx);
          drawRivalPanel(ctx);
          rivalState.closedUntil = null;
          rivalPanelOpen = false;
          currentScene = "INDOORS";
        } catch (e) {
          err = String(e && e.stack);
        }
        out.err = err;
        return out;
      }, SETUP);
      check(r.open, "it opens");
      checkEqual(r.stock, 3, "three in the window");
      check(r.markup && r.bought, "you can buy from it");
      check(r.loaded, "saved and loaded");
      checkEqual(r.err, null, "it draws");
    },
  },
  {
    name: "rival: its champion enters every show - beat it and its name drops, lose and it rises; orders it's after: left on the board it takes them, taken it races you (no mark against you if it wins)",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        openRival("show");
        const out = {};
        const theme = SHOW_THEMES[0];
        out.entered = _showRivals(theme, 2).some((e) => e.rival && e.name.includes(rivalState.shop));
        rivalState.score = 50;
        onRivalShowResult([{ rival: true, place: 3, name: "x" }], { you: true, place: 1 });
        out.beat = rivalState.score === 50 - RIVAL_SHOW_BEAT && rivalState.beaten === 1;
        onRivalShowResult([{ rival: true, place: 1, name: "x" }], { you: true, place: 2 });
        out.lost = rivalState.score === 50 - RIVAL_SHOW_BEAT + RIVAL_SHOW_LOSE;
        // Orders
        customerOrders.posted = [];
        customerOrders.active = [];
        const rnd = Math.random;
        Math.random = () => 0;
        const a = makeCustomerOrder();
        customerOrders.posted.push(a);
        onOrderPostedForRival(a);
        const b = makeCustomerOrder();
        customerOrders.posted.push(b);
        onOrderPostedForRival(b);
        Math.random = rnd;
        out.marked = !!(a.rival && b.rival);
        // b: you take it
        acceptCustomerOrder(b.id);
        // a: left on the board - it takes it
        const s0 = rivalState.score;
        timePlayed = a.rival.takeAt + 1;
        _rvOrders();
        out.took = !customerOrders.posted.includes(a) && rivalState.score === s0 + RIVAL_ORDER_LOSE;
        out.raceDue = b.rival.due != null && b.rival.due < b.dueAt;
        // Beat it to b
        const s1 = rivalState.score;
        onOrderFilledForRival(b);
        out.beatOrder = rivalState.score === s1 - RIVAL_ORDER_BEAT;
        // Another race, lost: the order goes, no "missed"
        Math.random = () => 0;
        const c = makeCustomerOrder();
        customerOrders.posted.push(c);
        onOrderPostedForRival(c);
        Math.random = rnd;
        acceptCustomerOrder(c.id);
        _rvOrders();
        const missed0 = customerOrders.missed;
        const rep0 = customerOrders.reputation;
        timePlayed = c.rival.due + 1;
        _rvOrders();
        out.raceLost = !customerOrders.active.includes(c) && customerOrders.missed === missed0 && customerOrders.reputation === rep0;
        // Any other order you fill is trade it didn't get
        const s2 = rivalState.score;
        onOrderFilledForRival({ customer: "x" });
        out.trade = rivalState.score === s2 - RIVAL_ORDER_TRADE;
        return out;
      }, SETUP);
      check(r.entered, "its champion is in the show");
      check(r.beat && r.lost, "beat it: down; lose: up");
      check(r.marked, "it goes after orders");
      check(r.took, "left on the board, it takes them");
      check(r.raceDue && r.beatOrder, "taken, you race it - and can beat it");
      check(r.raceLost, "it gets there first: the order goes, no mark against you");
      check(r.trade, "every order you fill hurts it");
    },
  },
  {
    name: "rival: schemes - a sale (fewer buyers), a price war (lower offers), a smear (families think less of you, unless they like you), a mill's dump in the alley; take one in and report it (once)",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        openRival("mill");
        const out = {};
        pressure.market = "normal";
        rivalState.score = 50;
        const rate0 = marketBuyerRate();
        rivalScheme("sale");
        out.sale = Math.abs(marketBuyerRate() - rate0 * 0.7) < 1e-9 && marketOfferMultiplier() < 1;
        timePlayed += DAY_LENGTH + 1;
        out.saleEnds = marketBuyerRate() === rate0;
        // A big name costs you buyers anyway
        rivalState.score = 100;
        out.bigName = marketBuyerRate() < rate0;
        rivalState.score = 50;
        // Smear
        keeperRep.family = 5;
        rivalScheme("smear");
        out.smear = keeperRep.family === 2;
        keeperRep.family = 25;
        rivalScheme("smear");
        out.shrug = keeperRep.family === 25;
        // Dump
        const dumped = rivalDump(3);
        out.dumped = dumped.length === 3 && dumped.every((f) => f.scene === "ALLEY" && !f.adopted && f.rivalDump === rivalState.shop);
        out.noProof = reportRival() === false && !rivalState.reported;
        dumped[0].adopted = true;
        const s0 = rivalState.score;
        out.report = reportRival() === true && rivalState.score === s0 - RIVAL_REPORT;
        out.once = reportRival() === false;
        // Letters
        out.letter = rivalScheme("letter") === "letter" && rivalState.news.length > 0;
        return out;
      }, SETUP);
      check(r.sale && r.saleEnds, "a sale: fewer buyers and lower offers, for a day");
      check(r.bigName, "a big name takes some buyers");
      check(r.smear && r.shrug, "a smear works unless families like you");
      check(r.dumped, "the mill dumps rejects in the alley");
      check(r.noProof && r.report && r.once, "report it with proof, once");
      check(r.letter, "letters");
    },
  },
  {
    name: "rival: sink its name for three mornings and it holds a half-price closing-down sale, then shuts (what's left goes to the shelter); a new one (another kind) opens weeks later",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        openRival("boutique");
        const out = {};
        const shop = rivalState.shop;
        const full = rivalState.stock.map((l) => l.basePrice);
        for (let i = 0; i < RIVAL_CLOSE_DAYS; i++) {
          rivalState.score = 2;
          __morning();
        }
        out.closing = !!rivalState.closing;
        out.half = rivalState.stock.length > 0 && rivalState.stock.every((l) => Math.abs(l.price - Math.round((l.basePrice * 0.5) / 10) * 10) < 1);
        const shelter0 = shelter && shelter.residents ? shelter.residents.length : 0;
        for (let i = 0; i <= RIVAL_SALE_DAYS; i++) __morning();
        out.shut = !rivalOpen() && rivalState.closedUntil != null && rivalState.past.some((p) => p.shop === shop);
        out.shelter = shelter && shelter.residents ? shelter.residents.length >= shelter0 : true;
        let n = 0;
        while (!rivalOpen() && n++ < 40) __morning();
        out.reopened = rivalOpen() && rivalState.kind !== "boutique" && rivalState.shop !== shop;
        out.days = n;
        return out;
      }, SETUP);
      check(r.closing && r.half, "closing down: half price");
      check(r.shut && r.shelter, "then it shuts");
      check(r.reopened && r.days >= 20, `a new kind of rival opens weeks later (${r.days} days)`);
    },
  },
];
