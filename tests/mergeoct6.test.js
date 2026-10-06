// The author's Oct 2-6 update, merged: the blowtorch and fire, the can as a
// little cage, a mum behind bars, diapers (ours, with the author's art and
// lines), cars smashing things left in the road
const { check, checkEqual } = require("./helpers");
const src = require("fs").readFileSync(__dirname + "/playtest6.test.js", "utf8");
const SETUP = src.match(/const SETUP = `([\s\S]*?)`;/)[1];

module.exports = [
  {
    name: "merge oct6: the blowtorch is a tool in the shop that sells back for half, and it saves",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const t = new Blowtorch("INDOORS");
        const entry = getToolEntry(t);
        const action = SPAWN_ACTIONS.find((a) => a.isItem === "blowtorch");
        const aisle = STORE_AISLES.find((a) => a.items.includes("blowtorch"));
        const saved = JSON.parse(JSON.stringify(t.serialize()));
        const back = SAVED_CLASSES[saved.classType] ? SAVED_CLASSES[saved.classType](saved) : null;
        return {
          tool: !!entry && entry.sellType,
          isTool: isToolObject(t),
          price: action && action.cost,
          aisle: aisle && aisle.id,
          sell: getItemSellValue(t, getItemType(t)),
          back: back && back.constructor.name,
        };
      }, SETUP);
      checkEqual(r.tool, "blowtorch", "it has its own item entry");
      check(r.isTool, "it's a tool");
      checkEqual(r.price, 5000, "in the shop at 5000");
      checkEqual(r.aisle, "hardware", "on the hardware aisle");
      checkEqual(r.sell, 2500, "sells back for half");
      checkEqual(r.back, "Blowtorch", "comes back after a save");
    },
  },
  {
    name: "merge oct6: fire burns, spreads, is remembered as you, a soaking puts it out, and it's saved",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(500, { growth: 1 });
        // The flame held on it
        const t = new Blowtorch("INDOORS");
        objects.push(t);
        t.isDragging = true;
        const tip = () => t.getFlameTip();
        // put the flame tip on the fluffy's middle
        const box = f.positioning.getExtentsForCage();
        mouse.x = (box.left + box.right) / 2 + BLOWTORCH_FLAME_LENGTH + (images.blowtorch ? images.blowtorch.width / 2 : 20);
        mouse.y = (box.top + box.bottom) / 2 - BLOWTORCH_NOZZLE_OFFSET_Y + (images.blowtorch ? images.blowtorch.height / 2 : 35);
        t.dragOffset = { x: 0, y: 0 };
        mouse.down = true;
        mouse.rightDown = false;
        for (let i = 0; i < 10; i++) t.update(0.05);
        mouse.down = false;
        t.isDragging = false;
        objects.splice(objects.indexOf(t), 1);
        out.tipOn = !!f.hitTest(tip().x, tip().y);
        out.lit = f.isOnFire;
        out.memory = (f.playerMemories || [])[0] && f.playerMemories[0].type;
        // Spreads to the one beside it
        const near = __mk(530, { growth: 1 });
        for (let i = 0; i < 40 && !near.isOnFire; i++) f.updateFire(0.1);
        out.spread = near.isOnFire;
        // Saved burning
        const data = JSON.parse(JSON.stringify(f.serialize()));
        out.savedFire = data.isOnFire === true && data.fireElapsed > 0;
        // A soaking puts it out
        near.wet = 1;
        near.updateFire(0.1);
        out.soaked = !near.isOnFire;
        // Left burning, it dies of it
        for (let i = 0; i < 200 && f.isAlive; i++) f.updateFire(0.1);
        out.died = !f.isAlive;
        return out;
      }, SETUP);
      check(r.tipOn, "the flame tip was on it");
      check(r.lit, "held on it, the flame sets it alight");
      checkEqual(r.memory, "blowtorch", "it remembers you set it on fire");
      check(r.spread, "the fire spreads to a fluffy beside it");
      check(r.savedFire, "a burning fluffy is saved burning");
      check(r.soaked, "soaked, it goes out");
      check(r.died, "left burning, it dies");
    },
  },
  {
    name: "merge oct6: a foal in a can is a little cage - its own item, right-click frees it, no cage life or scoop drops",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const can = new FoalInACan("INDOORS");
        can.x = 600;
        can.y = 560;
        objects.push(can);
        can.updateBounds();
        const foal = __mk(600, { growth: 0.1, y: 540 });
        foal.currentCage = can;
        const out = {
          type: getItemType(can).sellType,
          cageType: getItemType(new Cage("INDOORS")).sellType,
          messy: messyCage(can),
          sellable: isItemSellable(getItemType(can)),
          scoop: _scoopCageAt(600, can.getHitRect().y + can.getHitRect().h / 2),
        };
        const r2 = can.getHitRect();
        out.hit = itemHitTest(can, r2.x + r2.w / 2, r2.y + r2.h / 2);
        getItemType(can).onRightClick(can);
        out.freed = foal.currentCage === null && !objects.includes(can);
        return out;
      }, SETUP);
      checkEqual(r.type, "foal_in_a_can", "a can is a can, not a cage");
      checkEqual(r.cageType, "cage", "a cage is still a cage");
      check(!r.messy, "no cage mess in a can");
      check(!r.sellable, "a can can't be sold");
      checkEqual(r.scoop, null, "the scoop doesn't drop fluffies into a can");
      check(r.hit, "clicking the can hits it");
      check(r.freed, "right-click lets the foal out");
    },
  },
  {
    name: "merge oct6: a mum kept from her foal by bars is hit hard, but never down to looping",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(500, { growth: 1 });
        mum.happiness = 0.5;
        const cage = new Cage("INDOORS");
        cage.x = 500;
        cage.y = 480;
        objects.push(cage);
        mum.currentCage = cage;
        const foal = __mk(700, { growth: 0.1 });
        const before = mum.happiness;
        let low = 1;
        for (let i = 0; i < 300; i++) {
          mum.nextBarrierNurseTime = 0;
          mum.failToNurseBehindBarrier(foal);
          mum.barrierHurt(HAPPINESS_PENALTY_BARRIER_TALK, "test");
          low = Math.min(low, mum.happiness);
        }
        return { before, low, floor: WAN_DIE_THRESHOLD, behind: mum.isBehindBarrierFrom(foal) };
      }, SETUP);
      check(r.behind, "the bars are between them");
      check(r.low < r.before - 0.2, `it hits her hard (${r.before} -> ${r.low})`);
      check(r.low > r.floor, `but never down to looping (${r.low} > ${r.floor})`);
    },
  },
  {
    name: "merge oct6: diapers - no special huggies in one, the runs soak in, the author's art, no second (accessory) diaper",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const stallion = __mk(500, { growth: 1, gender: "male" });
        const mare = __mk(560, { growth: 1, gender: "female" });
        mare.diaper = { fill: 0, on: 0 };
        stallion.specialHuggiesCooldown = 0;
        out.mated = stallion.mateWith(mare);
        out.cooldown = stallion.specialHuggiesCooldown > 0;
        // The runs, soaking in quietly
        puddles.length = 0;
        const h0 = mare.happiness;
        for (let i = 0; i < 10; i++) mare.excretePoop(0.1);
        out.fill = mare.diaper.fill;
        out.puddles = puddles.length;
        out.quiet = Math.abs(mare.happiness - h0) < 1e-9;
        // Full: it leaks
        mare.diaper.fill = 1;
        mare.excretePoop(0.1);
        out.leaks = puddles.length > 0;
        out.noAccessory = !ACCESSORY_DB.diaper && !SPAWN_ACTIONS.some((a) => a.isItem === "accessory" && a.accessoryId === "diaper");
        // Drawn with the author's picture, without errors
        const c = document.createElement("canvas").getContext("2d");
        try {
          mare.draw(c);
          out.drawn = true;
        } catch (e) {
          out.drawn = String(e);
        }
        return out;
      }, SETUP);
      check(!r.mated, "a diapered mare can't be mated");
      check(r.cooldown, "he gives up for a while");
      check(r.fill > 0 && r.puddles === 0, `the runs go in the diaper (fill ${r.fill}, ${r.puddles} puddles)`);
      check(r.quiet, "a steady trickle doesn't nag happiness every frame");
      check(r.leaks, "a full one leaks");
      check(r.noAccessory, "only one kind of diaper in the shop");
      checkEqual(r.drawn, true, "a diapered fluffy draws");
    },
  },
  {
    name: "merge oct6: a car smashing a cage in the road lets the fluffy out; extra rooms don't adopt strays",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        __clearScene("ALLEY_ROAD");
        const cage = new Cage("ALLEY_ROAD");
        cage.x = 400;
        cage.y = 500;
        objects.push(cage);
        const f = __mk(400, { scene: "ALLEY_ROAD", adopted: false });
        f.currentCage = cage;
        destroyObjectHitByCar(cage);
        return {
          freed: f.currentCage === null,
          gone: cage.shouldDespawn,
          main: getSceneConfig("INDOORS").isAdoptionRoom,
          extra: getSceneConfig("INDOORS_2").isAdoptionRoom,
        };
      }, SETUP);
      check(r.freed, "the smashed cage lets it out");
      check(r.gone, "the cage is gone");
      check(r.main, "the main room adopts strays");
      check(!r.extra, "an extra room doesn't");
    },
  },
  {
    name: "merge oct6: holding the cattle prod on one spot keeps it smoking without piling up smoke spots",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(500, { growth: 1 });
        f.health = 1e9;
        f.tasedTimer = 100;
        f.tasedPoint = { x: f.x, y: f.y - 20 };
        for (let i = 0; i < 200; i++) {
          f.tasedTimer = 100;
          f.update(0.05);
          if (!f.isAlive) break;
        }
        return { spots: (f.smokePoints || []).length };
      }, SETUP);
      check(r.spots >= 1 && r.spots <= 3, `one spot, refreshed (${r.spots})`);
    },
  },
];
