// Fences, gates and pen-aware fluffies (Fence.js).
const { check, checkEqual, buildPen } = require("./helpers");

// Put fluffies in and around the pen built by buildPen()
function addFluffies() {
  fluffies.length = 0;
  const types = ["earthy", "unicorn", "pegasus"];
  const inside = [],
    outside = [];
  for (let i = 0; i < 4; i++) {
    const h = new Horse(0.35 + i * 0.2, null, "INDOORS", types[i % 3]);
    h.x = 640 + i * 50;
    h.y = 420 + (i % 2) * 120;
    h.adopted = true;
    fluffies.push(h);
    inside.push(h);
  }
  const spots = [[300, 250], [420, 650], [1050, 250], [1100, 650], [720, 740], [720, 230]];
  for (let i = 0; i < spots.length; i++) {
    const h = new Horse(0.35 + (i % 3) * 0.3, null, "INDOORS", types[i % 3]);
    h.x = spots[i][0];
    h.y = spots[i][1];
    h.adopted = true;
    fluffies.push(h);
    outside.push(h);
  }
  window.__inside = inside;
  window.__outside = outside;
  window.__inPen = (h) =>
    h.scene === "INDOORS" && h.x > 560 && h.x < 880 && h.y + 40 > 360 && h.y + 40 < 680;
}

module.exports = [
  {
    name: "fluffies can't walk through a closed pen (either way)",
    run: async (page) => {
      await page.evaluate(buildPen, {});
      const r = await page.evaluate((addFluffiesSrc) => {
        eval("(" + addFluffiesSrc + ")")();
        __seedRandom(3);
        const bowl = new Bowl("trough", "INDOORS");
        bowl.setPosition(1100, 500);
        bowl.fill(10, "sketties");
        objects.push(bowl);
        let escapes = 0;
        for (let s = 0; s < 60 * 240; s++) {
          updateSimulation(1 / 60);
          for (const h of __inside) if (h.isAlive && !__inPen(h)) escapes++;
          for (const h of __outside) if (h.isAlive && __inPen(h)) escapes++;
        }
        return { escapes };
      }, addFluffies.toString());
      checkEqual(r.escapes, 0, "frames where a fluffy was on the wrong side");
    },
  },
  {
    name: "the fence itself stops fluffies that walk straight at it",
    run: async (page) => {
      await page.evaluate(buildPen, {});
      const r = await page.evaluate((addFluffiesSrc) => {
        eval("(" + addFluffiesSrc + ")")();
        __seedRandom(7);
        // Switch off the pen-aware walking so fluffies really try to cross;
        // only the fence collision is left to stop them.
        const steer = getFenceSteerPoint;
        window.getFenceSteerPoint = () => null;
        let escapes = 0;
        for (let s = 0; s < 60 * 90; s++) {
          if (s % 120 === 0) {
            // Every 2 seconds, send everyone to a spot on the other side
            for (const h of __inside) {
              h.initBehavior("MOVING");
              h.setTargetPosition(h.x < 720 ? 300 : 1100, h.y + (Math.random() - 0.5) * 300);
            }
            for (const h of __outside) {
              h.initBehavior("MOVING");
              h.setTargetPosition(720, 480);
            }
          }
          updateSimulation(1 / 60);
          for (const h of __inside) if (h.isAlive && !__inPen(h)) escapes++;
          for (const h of __outside) if (h.isAlive && __inPen(h)) escapes++;
        }
        window.getFenceSteerPoint = steer;
        return { escapes };
      }, addFluffies.toString());
      checkEqual(r.escapes, 0, "frames where a fluffy was on the wrong side");
    },
  },
  {
    name: "penned fluffies don't bump into the fence trying to reach food outside",
    run: async (page) => {
      // A few different random starts, since this problem only shows up
      // now and then (e.g. a fluffy aiming for a spot too close to the fence)
      for (const seed of [4, 8, 14]) {
        await page.evaluate(() => {
          for (let i = objects.length - 1; i >= 0; i--) {
            if (objects[i].scene === "INDOORS") objects.splice(i, 1);
          }
        });
        await page.evaluate(buildPen, {});
        const r = await page.evaluate((seed) => {
          __seedRandom(seed);
          fluffies.length = 0;
          const penned = [];
          for (let i = 0; i < 5; i++) {
            const h = new Horse(0.4 + i * 0.15, null, "INDOORS", "earthy");
            h.x = 640 + i * 40;
            h.y = 420 + (i % 3) * 70;
            h.adopted = true;
            h.hunger = 0.4;
            fluffies.push(h);
            penned.push(h);
          }
          const bowl = new Bowl("trough", "INDOORS");
          bowl.setPosition(1100, 560);
          bowl.fill(10, "sketties");
          objects.push(bowl);
          let bumps = 0;
          const original = resolveFenceCollision;
          window.resolveFenceCollision = (h) => {
            const x = h.x,
              y = h.y;
            original(h);
            if (penned.includes(h) && (x !== h.x || y !== h.y)) bumps++;
          };
          __fastForward(180);
          window.resolveFenceCollision = original;
          return { bumps, food: bowl.food };
        }, seed);
        checkEqual(r.bumps, 0, `times penned fluffies walked into the fence (start ${seed})`);
        checkEqual(r.food, 10, `food eaten through the fence (start ${seed})`);
      }
    },
  },
  {
    name: "fluffies walk out through an open gate to reach food",
    run: async (page) => {
      await page.evaluate(buildPen, { withGate: true, gateOpen: false });
      const r = await page.evaluate(() => {
        __seedRandom(5);
        fluffies.length = 0;
        const a = new Horse(1.0, null, "INDOORS", "earthy");
        a.x = 700;
        a.y = 480;
        a.adopted = true;
        a.hunger = 0.3;
        fluffies.push(a);
        const bowl = new Bowl("trough", "INDOORS");
        bowl.setPosition(1100, 560);
        bowl.fill(10, "kibble");
        objects.push(bowl);
        __fastForward(30);
        const foodWhileClosed = bowl.food;
        objects.find((o) => o instanceof Fence && o.isGate).toggleGate();
        __fastForward(60);
        return { foodWhileClosed, foodAfterOpen: bowl.food };
      });
      checkEqual(r.foodWhileClosed, 10, "food eaten while the gate was closed");
      check(r.foodAfterOpen < 10, "the fluffy never got to the food after the gate opened");
    },
  },
  {
    name: "friends split up by a pen get sad, and happy when reunited",
    run: async (page) => {
      await page.evaluate(buildPen, { withGate: true, gateOpen: false });
      const r = await page.evaluate(() => {
        __seedRandom(6);
        fluffies.length = 0;
        const a = new Horse(1.0, null, "INDOORS", "earthy");
        a.x = 700;
        a.y = 480;
        a.adopted = true;
        const b = new Horse(1.0, null, "INDOORS", "unicorn");
        b.x = 300;
        b.y = 300;
        b.adopted = true;
        fluffies.push(a, b);
        setRelationship(a.id, b.id, "friend");
        setRelationship(b.id, a.id, "friend");
        const lines = [];
        const speak = Horse.prototype.speak;
        Horse.prototype.speak = function (t, ...rest) {
          lines.push(t);
          return speak.call(this, t, ...rest);
        };
        const happyBefore = a.happiness;
        __fastForward(45);
        const happyPenned = a.happiness;
        const sadLines = lines.length;
        objects.find((o) => o instanceof Fence && o.isGate).toggleGate();
        __fastForward(5);
        Horse.prototype.speak = speak;
        return {
          happyBefore,
          happyPenned,
          happyAfter: a.happiness,
          saidSad: sadLines > 0,
        };
      });
      check(r.saidSad, "no sad lines while separated");
      check(r.happyPenned < r.happyBefore, "penned fluffy didn't get any sadder");
      check(r.happyAfter > r.happyPenned, "no happiness boost after reuniting");
    },
  },
  {
    name: "fences and gates can be bought, placed, turned, opened and sold",
    run: async (page) => {
      await page.evaluate(() => {
        money = 1000;
        fluffies.forEach((f) => (f.scene = "OUTDOORS"));
        __clearScene();
      });
      // Buy a piece at the store (it sticks to the mouse) and carry it home:
      // S = out of the store, S = back to the garden, W = in the front door
      const buyAndCarryHome = async (name) => {
        const spot = await page.evaluate((name) => {
          const action = SPAWN_ACTIONS.find((a) => a.name === name);
          const aisle = getStoreAisleForAction(action);
          const slot = getStoreShelfLayout(aisle).slots.find((s) => s.action === action);
          changeScene(aisle.scene);
          return { x: slot.iconX, y: slot.iconY };
        }, name);
        await page.mouse.move(spot.x, spot.y);
        await page.mouse.click(spot.x, spot.y);
        for (const key of ["KeyS", "KeyS", "KeyW"]) await page.keyboard.press(key);
      };
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await buyAndCarryHome("Fence");
      await page.mouse.move(680, 372);
      await page.mouse.click(680, 372);
      // Buy a gate, turn it with R, place it
      await buyAndCarryHome("Gate");
      await page.mouse.move(960, 412);
      await page.keyboard.press("KeyR");
      await page.mouse.move(961, 412);
      await page.mouse.click(961, 412);
      let r = await page.evaluate(() => ({
        money,
        pieces: objects.filter((o) => o instanceof Fence).map((f) => [f.isGate, f.orientation, f.isDragging]),
      }));
      checkEqual(r.money, 1000 - 40 - 100, "money after buying");
      checkEqual(JSON.stringify(r.pieces), JSON.stringify([[false, "h", false], [true, "v", false]]), "pieces placed");
      // Right-click: the fence turns, the gate opens
      await page.mouse.click(680, 370, { button: "right" });
      await page.mouse.click(960, 440, { button: "right" });
      r = await page.evaluate(() => objects.filter((o) => o instanceof Fence).map((f) => [f.orientation, f.isOpen]));
      checkEqual(JSON.stringify(r), JSON.stringify([["v", false], ["v", true]]), "after right-clicking");
      // Shift-click sells the gate for half price
      await page.keyboard.down("Shift");
      await page.mouse.click(960, 440);
      await page.keyboard.up("Shift");
      r = await page.evaluate(() => ({ money, left: objects.filter((o) => o instanceof Fence).length }));
      checkEqual(r.money, 1000 - 40 - 100 + 50, "money after selling the gate");
      checkEqual(r.left, 1, "pieces left");
    },
  },
];
