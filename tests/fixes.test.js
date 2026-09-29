// Bugs fixed in the clean-up pass (September 2026)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "fixes: fluffies only eat bodily waste off the floor - not water or tears",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        puddles.length = 0;
        const mk = (x) => {
          const h = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, "female");
          h.adopted = true;
          h.x = x;
          h.y = 500;
          h.health = 100;
          h.hunger = 0.2;
          fluffies.push(h);
          return h;
        };
        const onWater = mk(300);
        const onPoop = mk(800);
        addPointToPuddle("INDOORS", 300, 500, "rgba(100, 150, 255, 0.3)", 0.5, 0.5, 0.02);
        addPointToPuddle("INDOORS", 300, 500, "rgba(180, 180, 180, 0.25)", 0.5, 0.5, 0.02);
        addPointToPuddle("INDOORS", 800, 500, "#5c4033", 0.5, 0.5, 0.02);
        for (const f of [onWater, onPoop]) f.currentStateKey = "EATING";
        for (let i = 0; i < 20; i++) {
          onWater.currentStateKey = onPoop.currentStateKey = "EATING";
          onWater.consumePuddlesIfNeeded(0.1);
          onPoop.consumePuddlesIfNeeded(0.1);
        }
        const out = {
          water: [+onWater.hunger.toFixed(2), Math.round(onWater.health)],
          poop: [+onPoop.hunger.toFixed(2), Math.round(onPoop.health)],
          waste: [isBodilyWaste("#5c4033"), isBodilyWaste("#f1c40f"), isBodilyWaste("rgba(100, 150, 255, 0.3)")],
        };
        puddles.length = 0;
        return out;
      });
      checkEqual(JSON.stringify(r.water), JSON.stringify([0.2, 100]), "water and tears aren't food and don't hurt");
      check(r.poop[0] > 0.2 && r.poop[1] < 100, `poop is (hunger ${r.poop[0]}, health ${r.poop[1]})`);
      checkEqual(JSON.stringify(r.waste), JSON.stringify([true, true, false]), "isBodilyWaste");
    },
  },
  {
    name: "fixes: a ball isn't stuck 'carried' after the fetching fluffy is gone",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        const h = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, "female");
        h.adopted = true;
        h.x = 300;
        h.y = 500;
        fluffies.push(h);
        const ball = new Ball(600, 520, "INDOORS");
        objects.push(ball);
        ball.carriedBy = 999999; // a fluffy that's been sold
        const out = { free: fetchableBall(h) === ball, cleared: ball.carriedBy === null };
        // A fluffy really fetching it keeps it
        h.trickNow = { key: "fetch", until: 1e9 };
        ball.carriedBy = h.id;
        out.stillCarried = isBallCarried(ball);
        h.trickNow = null;
        return out;
      });
      check(r.free && r.cleared, "the ball is free again");
      check(r.stillCarried, "but not while it's really being carried");
    },
  },
  {
    name: "fixes: a customer let down twice sulks for a few days, then orders again",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const c = getClient("Mrs. Test");
        c.loyalty = 0;
        noteOrderFailed({ customer: "Mrs. Test" });
        const once = customerIsUpset("Mrs. Test");
        noteOrderFailed({ customer: "Mrs. Test" });
        const twice = customerIsUpset("Mrs. Test");
        const t0 = timePlayed;
        timePlayed += CUSTOMER_SULK_DAYS * DAY_LENGTH + 10;
        const later = customerIsUpset("Mrs. Test");
        const loyalty = c.loyalty;
        timePlayed = t0;
        delete customerOrders.clients["Mrs. Test"];
        return { once, twice, later, loyalty };
      });
      checkEqual(r.once, false, "once: still orders");
      checkEqual(r.twice, true, "twice: sulks");
      checkEqual(r.later, false, "a few days later: another chance");
      checkEqual(r.loyalty, -1, "on thin ice");
    },
  },
  {
    name: "fixes: a fluffy walking somewhere it can never reach gives up instead of walking forever",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        const h = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, "female");
        h.adopted = true;
        h.x = 400;
        h.y = 500;
        h.hunger = 1;
        fluffies.push(h);
        h.brain.think = () => {}; // just the walking
        h.initBehavior("MOVING");
        h.setTargetPosition(900, 520);
        // Something in the way: it walks but gets nowhere
        h.updateSpeed = () => {};
        h.speed = 0;
        let state = [];
        for (let i = 0; i < 40; i++) {
          __fastForward(1);
          state.push(h.currentStateKey);
        }
        return { gaveUp: state.indexOf("IDLE"), last: state[state.length - 1] };
      });
      check(r.gaveUp > 15 && r.gaveUp <= 30, `gave up after ${r.gaveUp}s`);
    },
  },
];

