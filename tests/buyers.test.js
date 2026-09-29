// Buyers at the door (Buyers.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(51);
  customerOrders = freshCustomerOrders();
  currentSellRequest = null;
  tutorialTimer = 0;
  money = 1000;
  window.__mk = (opts = {}) => {
    const h = new Horse(opts.growth ?? 1, null, "INDOORS", opts.type || "earthy", null, 0.5, 0.5, opts.gender || "female");
    h.adopted = true;
    h.happiness = 0.8;
    h.hunger = 1;
    h.health = 100;
    h.x = 500 + fluffies.length * 30;
    h.y = 450;
    fluffies.push(h);
    return h;
  };
  window.__count = (fn, n) => {
    const c = {};
    for (let i = 0; i < n; i++) {
      const k = fn();
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  };
}`;

module.exports = [
  {
    name: "buyers: richer buyers come with a better reputation",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        return { l1: __count(() => pickBuyerKind(1).id, 2000), l5: __count(() => pickBuyerKind(5).id, 2000) };
      }, SETUP);
      check(!r.l1.show, "no show breeders at the start");
      check(r.l5.show > 100, `show breeders later (${r.l5.show})`);
      check(r.l5.collector > r.l1.collector * 1.8, `more collectors later (${r.l1.collector} -> ${r.l5.collector})`);
      check(r.l1.family > 0 && r.l1.kid > 0 && r.l1.bargain > 0 && r.l1.farmer > 0, JSON.stringify(r.l1));
    },
  },
  {
    name: "buyers: they ask about the fluffy that suits them",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const uni = __mk({ type: "unicorn" });
        const plain = __mk();
        const foal = __mk({ growth: 0.4 });
        const pickedBy = (kindId) =>
          __count(() => {
            const kind = getBuyerKind(kindId);
            const real = window.pickBuyerKind;
            window.pickBuyerKind = () => kind;
            try {
              const req = makeSellRequest([uni, plain, foal]);
              return req.fluffyId === uni.id ? "uni" : req.fluffyId === foal.id ? "foal" : "plain";
            } finally {
              window.pickBuyerKind = real;
            }
          }, 600);
        // A collector choosing from a mixed bunch
        const pool = [];
        for (let i = 0; i < 8; i++) pool.push(__mk({ type: ["unicorn", "pegasus", "earthy", "earthy"][i % 4] }));
        const col = getBuyerKind("collector");
        const byLike = pool.slice().sort((a, b) => buyerLikes(col, b) - buyerLikes(col, a));
        const best = byLike[0];
        const worst = byLike[byLike.length - 1];
        const real = window.pickBuyerKind;
        window.pickBuyerKind = () => col;
        const picks = { best: 0, worst: 0 };
        try {
          for (let i = 0; i < 1500; i++) {
            const req = makeSellRequest(pool);
            if (req.fluffyId === best.id) picks.best++;
            if (req.fluffyId === worst.id) picks.worst++;
          }
        } finally {
          window.pickBuyerKind = real;
        }
        const collector = { ...picks, likeBest: buyerLikes(col, best), likeWorst: buyerLikes(col, worst) };
        return { collector, kid: pickedBy("kid"), farmer: pickedBy("farmer") };
      }, SETUP);
      check(r.collector.best > r.collector.worst * 2, `a collector goes for the one it likes most ${JSON.stringify(r.collector)}`);
      check(r.kid.foal > (r.kid.plain || 0) * 2, `a kid goes for the foal ${JSON.stringify(r.kid)}`);
      check((r.farmer.plain || 0) > (r.farmer.uni || 0), `a farmer goes for the grown earthy ${JSON.stringify(r.farmer)}`);
    },
  },
  {
    name: "buyers: offers follow the price, the buyer's budget and liking, and how it looks on the day",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk({ type: "unicorn" });
        const price = f.calculatePrice();
        const offer = (kindId) => buyerOffer(getBuyerKind(kindId), f, 1, () => 0.5);
        const out = { price, collector: offer("collector"), kid: offer("kid"), bargain: offer("bargain") };
        out.healthy = buyerConditionFactor(f);
        f.health = 35;
        out.hurt = buyerConditionFactor(f);
        f.health = 100;
        f.illness = { type: "flu", t: 400, known: true };
        out.flu = typeof fluShowing === "function" && fluShowing(f) ? buyerConditionFactor(f) : null;
        f.illness = null;
        out.rich = buyerOffer(getBuyerKind("family"), f, 5, () => 0.5).offer / buyerOffer(getBuyerKind("family"), f, 1, () => 0.5).offer;
        return out;
      }, SETUP);
      check(r.collector.offer > r.kid.offer * 1.8, `collector pays much more than a kid (${r.collector.offer} vs ${r.kid.offer})`);
      check(r.bargain.offer < r.price, `a bargain hunter offers under price (${r.bargain.offer} < ${r.price})`);
      check(r.collector.maxPay > r.collector.offer, "room to haggle");
      checkEqual(r.healthy, 1, "healthy: full price");
      check(r.hurt < 0.8, `poor health lowers it (${r.hurt})`);
      if (r.flu !== null) check(r.flu <= 0.5, `flu halves it (${r.flu})`);
      check(r.rich > 1.2, `better reputation, richer buyers (${r.rich})`);
    },
  },
  {
    name: "buyers: asking for more - they agree, make a final offer, or walk off",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk();
        const make = (price, maxPay, patience) => ({ fluffyId: f.id, fluffy: f, price, maxPay, like: 0.5, buyer: "family", patience, final: false, asks: 0, timer: 5, said: null });
        const out = {};
        currentSellRequest = make(100, 200, 2);
        out.agree = [askBuyerForMore(currentSellRequest, () => 0.9), currentSellRequest.price, currentSellRequest.said, currentSellRequest.timer >= 12];
        currentSellRequest = make(100, 110, 2);
        out.final = [askBuyerForMore(currentSellRequest, () => 0.9), currentSellRequest.price, currentSellRequest.final];
        out.again = askBuyerForMore(currentSellRequest, () => 0.9); // no more after the final offer
        currentSellRequest = make(100, 110, 0);
        out.left = [askBuyerForMore(currentSellRequest, () => 0.9), currentSellRequest];
        currentSellRequest = make(100, 110, 3);
        out.putOff = [askBuyerForMore(currentSellRequest, () => 0.1), currentSellRequest];
        // Sell at the haggled price
        currentSellRequest = make(100, 200, 2);
        askBuyerForMore(currentSellRequest, () => 0.9);
        acceptSellRequest();
        out.sold = { money, gone: !fluffies.includes(f), cleared: currentSellRequest === null };
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.agree), JSON.stringify(["agreed", 120, '"Alright, $120."', true]), "agree to 20% more");
      checkEqual(JSON.stringify(r.final), JSON.stringify(["final", 110, true]), "their limit: a final offer");
      checkEqual(r.again, null, "nothing more after a final offer");
      checkEqual(JSON.stringify(r.left), JSON.stringify(["left", null]), "out of patience: they leave");
      checkEqual(JSON.stringify(r.putOff), JSON.stringify(["left", null]), "sometimes just put off");
      checkEqual(JSON.stringify(r.sold), JSON.stringify({ money: 1120, gone: true, cleared: true }), "sold for the new price");
    },
  },
  {
    name: "buyers: a buyer arrives by themselves, and the card's buttons work with the mouse",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        changeScene("INDOORS");
        const a = __mk({ type: "pegasus" });
        __mk();
        sellRequestTimer = 0;
        updateMoneyAndRequests(0.016);
        const req = currentSellRequest;
        const out = { arrived: !!req, kind: req && !!getBuyerKind(req.buyer), price: req && req.price > 0 };
        let drew = true;
        try {
          drawSellRequest(ctx);
        } catch (e) {
          drew = e.message;
        }
        out.drew = drew;
        const L = sellRequestLayout();
        const click = (b) => {
          mouse.x = b.x + b.w / 2;
          mouse.y = b.y + b.h / 2;
          return sellRequestClick();
        };
        req.maxPay = req.price * 10;
        const before = req.price;
        click(L.ask);
        out.asked = currentSellRequest && currentSellRequest.price > before;
        click(L.reject);
        out.rejected = currentSellRequest === null;
        currentSellRequest = makeSellRequest([a]);
        const price = currentSellRequest.price;
        const m0 = money;
        click(L.accept);
        out.sold = money - m0 === price && !fluffies.includes(a);
        // Not at home: no card
        currentSellRequest = makeSellRequest(fluffies.filter((f) => f.isAlive));
        changeScene("OUTDOORS");
        mouse.x = L.accept.x + 5;
        mouse.y = L.accept.y + 5;
        out.away = sellRequestClick();
        changeScene("INDOORS");
        return out;
      }, SETUP);
      check(r.arrived && r.kind && r.price, `a buyer arrived ${JSON.stringify(r)}`);
      checkEqual(r.drew, true, "the card draws");
      check(r.asked, "Ask more raised the price");
      check(r.rejected, "No thanks sends them away");
      check(r.sold, "Sell sells");
      checkEqual(r.away, false, "no buyer card away from home");
    },
  },
];
