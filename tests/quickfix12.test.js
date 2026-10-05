// From the author's thread (Oct 5): foals in a side room couldn't be sold;
// strays that come over the backyard fence counted as yours; a foal's
// severed head had a grown mane; cars missed thrown fluffies, drove through
// pools of blood without touching them, and boxes turned up across the road
const { check, checkEqual } = require("./helpers");
const src = require("fs").readFileSync(__dirname + "/playtest6.test.js", "utf8");
const SETUP = src.match(/const SETUP = `([\s\S]*?)`;/)[1];

module.exports = [
  {
    name: "quickfix12: strays spawned in the backyard aren't yours; a foal of yours in a side room is yours (and can be sold); a stray's foal there isn't",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        __clearScene("BACKYARD");
        __clearScene("INDOORSL1");
        const out = {};
        const before = new Set(fluffies);
        spawnFeralGroup("BACKYARD");
        const ferals = fluffies.filter((f) => !before.has(f) && f.scene === "BACKYARD");
        out.ferals = ferals.length > 0 && ferals.every((f) => !f.adopted && !f.canBeSold());
        for (const f of ferals) fluffies.splice(fluffies.indexOf(f), 1);
        // A side room: your mare's foal from an older save (not marked yours)
        const mum = __mk(300, { scene: "INDOORSL1" });
        const foal = __mk(340, { scene: "INDOORSL1", growth: 0.1, mum: mum.id });
        foal.motherId = mum.id;
        foal.adopted = false;
        for (let i = 0; i < 3; i++) foal.update(0.1);
        out.mine = foal.adopted === true && foal.canBeSold();
        // A stray's foal stays the stray's
        const stray = __mk(500, { scene: "INDOORSL1", adopted: false });
        const sf = __mk(540, { scene: "INDOORSL1", growth: 0.1 });
        sf.motherId = stray.id;
        sf.adopted = false;
        for (let i = 0; i < 3; i++) sf.update(0.1);
        out.strays = sf.adopted === false;
        return out;
      }, SETUP);
      check(r.ferals, "backyard strays are wild");
      check(r.mine, "your mare's foal in a side room is yours to sell");
      check(r.strays, "a stray's foal isn't");
    },
  },
  {
    name: "quickfix12: a foal's severed head has a foal's mane (none for a newborn), kept through a save; it still draws",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const foal = __mk(300, { growth: 0.05 });
        const adult = __mk(500, { growth: 1 });
        for (const f of [foal, adult]) f.renderer && f.renderer.ensureTintedImages && f.renderer.ensureTintedImages();
        foal.tinted = foal.tinted || foal.renderer.tinted;
        adult.tinted = adult.tinted || adult.renderer.tinted;
        const fg = foal.anatomy.spawnGib("head");
        const ag = adult.anatomy.spawnGib("head");
        out.have = !!fg && !!ag;
        if (!out.have) return out;
        out.foalMane = fg.maneScale;
        out.adultMane = ag.maneScale;
        const back = Gib.deserialize(JSON.parse(JSON.stringify(fg.serialize())));
        out.saved = Math.abs(back.maneScale - fg.maneScale) < 1e-9;
        const back2 = Gib.deserialize(JSON.parse(JSON.stringify(ag.serialize())));
        out.saved2 = back2.maneScale === 1;
        let err = null;
        try {
          fg.renderFaceSprite();
          ag.renderFaceSprite();
        } catch (e) {
          err = String(e && e.stack);
        }
        out.err = err;
        return out;
      }, SETUP);
      check(r.have, "head gibs");
      check(r.foalMane < 0.2, "a newborn's head: next to no mane (" + r.foalMane + ")");
      checkEqual(r.adultMane, 1, "a grown one's: all of it");
      check(r.saved && r.saved2, "saved");
      checkEqual(r.err, null, "draws");
    },
  },
  {
    name: "quickfix12: the road - a fluffy thrown into a passing car is hit; cars wear down the pools they drive through (not the one they just made); no boxes across the lanes",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        __clearScene("ALLEY_ROAD");
        const out = {};
        const realScene = currentScene;
        currentScene = "ALLEY_ROAD";
        cars.length = 0;
        puddles.length = 0;
        carSpawnTimer = 999;
        citySweep.swept = citySweep.warned = getDayNumber(); // (not the street cleaners)
        // In the air over the lower lane, landing back on the pavement
        const f = __mk(700, { scene: "ALLEY_ROAD", y: 480 });
        f.isFallingFromThrow = true;
        f.throwStartY = 600;
        f.throwFallVx = 0;
        f.throwFallVy = -50;
        // An old pool in the lane
        addPointToPuddle("ALLEY_ROAD", 300, 470, "blood", 0.6, 0.6);
        const pool = puddles.find((p) => p.scene === "ALLEY_ROAD");
        const s0 = pool.points[0].scale;
        const car = new Car("ALLEY_ROAD");
        car.direction = "left-to-right";
        car.x = -600;
        car.vx = 1200;
        car.y = 340;
        cars.push(car);
        let hitAt = null;
        for (let t = 0; t < 120 && hitAt === null; t++) {
          f.isFallingFromThrow = true; // (held up there for the test)
          f.y = 480;
          f.throwFallVy = -50;
          updateSimulation(1 / 60);
          if (!f.isAlive) hitAt = t;
        }
        out.hit = hitAt !== null;
        for (let t = 0; t < 120; t++) updateSimulation(1 / 60);
        const left = pool.points.find((p) => Math.abs(p.x - 300) < 3);
        out.worn = !left || left.scale < s0 - 0.05;
        out.wornBy = left ? +(s0 - left.scale).toFixed(3) : "gone";
        // The blood from the hit is still there, and on the ground
        out.fresh = puddles.some((p) => p.type === "blood" && p.points.some((q) => Math.abs(q.x - 700) < 120 && q.y > 560));
        cars.length = 0;
        currentScene = realScene;
        // Boxes: never on the road
        for (const o of objects.filter((o) => o instanceof Bed && o.type === "cardboard_box")) objects.splice(objects.indexOf(o), 1);
        for (let i = 0; i < 60; i++) {
          alleyBoxSpawnTimer = 0;
          updateSimulation(1 / 60);
        }
        const boxes = objects.filter((o) => o instanceof Bed && o.type === "cardboard_box");
        out.boxes = boxes.length > 0 && !boxes.some((b) => b.scene === "ALLEY_ROAD");
        return out;
      }, SETUP);
      check(r.hit, "thrown into the car: hit");
      check(r.worn, "the old pool is worn down (" + r.wornBy + ")");
      check(r.fresh, "the new one is there, on the ground under where it flew");
      check(r.boxes, "boxes, but not on the road");
    },
  },
];
