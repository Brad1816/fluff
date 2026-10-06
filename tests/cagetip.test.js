// Eject anywhere (CageTip.js, option B): a tap empties an Eject cage below;
// carried over a grinder, the river, the road, a table or a cage and let
// go, it tips them in; over plain floor it just moves
const { check, checkEqual } = require("./helpers");
const src = require("fs").readFileSync(__dirname + "/playtest6.test.js", "utf8");
const SETUP = src.match(/const SETUP = `([\s\S]*?)`;/)[1];

const TIP_SETUP = `() => {
  window.__ejectCage = (x, n, scene = "INDOORS") => {
    const cage = new Cage(scene);
    cage.x = x;
    cage.y = 450;
    cage.tag = "eject";
    objects.push(cage);
    cage.update(0);
    cage.updateBounds();
    const inside = [];
    for (let i = 0; i < n; i++) {
      const f = __mk(x - 20 + i * 20, { scene, y: cage.bounds.bottom - 30 });
      f.currentCage = cage;
      inside.push(f);
    }
    return { cage, inside };
  };
  // Carry it to (x, y) and let go there
  window.__carryTo = (cage, x, y) => {
    cage.isDragging = true;
    cage.pressPos = { x: cage.x, y: cage.y };
    const dx = x - cage.x, dy = y - cage.y;
    cage.x = x; cage.y = y; cage.moveContents(dx, dy);
    mouse.x = x; mouse.y = y;
    cage.isDragging = false;
    cage.onDrop();
  };
}`;

module.exports = [
  {
    name: "eject anywhere: a tap still empties it below; let go over plain floor it just moves; with the real mouse a click empties it",
    run: async (page) => {
      const r = await page.evaluate(([setup, tip]) => {
        eval(setup)();
        eval(tip)();
        const out = {};
        // A tap: picked up and let go on the spot
        let { cage, inside } = __ejectCage(500, 2);
        mouse.x = cage.x;
        mouse.y = cage.y;
        out.pickedUp = cage.tapAction() === false;
        cage.isDragging = true;
        cageTapRelease();
        out.tapEmptied = inside.every((f) => f.currentCage === null) && !cage.isDragging;
        objects.splice(objects.indexOf(cage), 1);
        // Carried to plain floor: moved, still inside
        ({ cage, inside } = __ejectCage(300, 2));
        __carryTo(cage, 900, 420);
        out.moved = Math.abs(cage.x - 900) < 60 && inside.every((f) => f.currentCage === cage);
        objects.splice(objects.indexOf(cage), 1);
        return out;
      }, [SETUP, TIP_SETUP]);
      check(r.pickedUp, "pressing a full Eject cage picks it up");
      check(r.tapEmptied, "a tap on the spot empties it below");
      check(r.moved, "let go over plain floor, it just moves");
    },
  },
  {
    name: "eject anywhere: over a grinder they go in one by one and those watching learn to fear cages; over a table one goes on it and the rest beside; over a cage they move in; the river; the road; what it would tip into glows",
    run: async (page) => {
      const r = await page.evaluate(([setup, tip]) => {
        eval(setup)();
        eval(tip)();
        const out = {};
        // Grinder
        const g = new Grinder("INDOORS");
        g.x = 900;
        g.y = 500;
        objects.push(g);
        g.update(0);
        let { cage, inside } = __ejectCage(300, 3);
        const watcher = __mk(1100, { y: 520 });
        const fear0 = fearOf(watcher, "cages");
        // While carried over it, it glows (no errors drawing)
        cage.isDragging = true;
        mouse.x = (g.bounds.left + g.bounds.right) / 2;
        mouse.y = (g.bounds.top + g.bounds.bottom) / 2;
        out.glowTarget = cageTipTargetAt(cage, mouse.x, mouse.y)?.kind;
        const c2 = document.createElement("canvas").getContext("2d");
        drawCageTipHint(c2);
        cage.isDragging = false;
        __carryTo(cage, mouse.x, mouse.y);
        out.beside = cage.bounds.right <= g.bounds.left + 2 || cage.bounds.left >= g.bounds.right - 2;
        out.dbg = [cage.bounds.left, cage.bounds.right, g.bounds.left, g.bounds.right, cage.x];
        out.queued = !!cage._tipQueue;
        const gone = [];
        for (let i = 0; i < 40; i++) {
          cage.update(0.05);
          gone.push(inside.filter((f) => !f.isAlive || f.isDestroyed).length);
        }
        out.oneByOne = gone[0] <= 1 && gone[gone.length - 1] === 3 && gone.some((n) => n === 2);
        out.feared = fearOf(watcher, "cages") > fear0;
        objects.splice(objects.indexOf(cage), 1);
        objects.splice(objects.indexOf(g), 1);
        // Table
        const table = new OperatingTable("INDOORS");
        table.x = 700;
        table.y = 520;
        objects.push(table);
        if (table.update) table.update(0);
        if (table.updateBounds) table.updateBounds();
        ({ cage, inside } = __ejectCage(300, 3));
        const tc = { x: (table.bounds.left + table.bounds.right) / 2, y: (table.bounds.top + table.bounds.bottom) / 2 };
        __carryTo(cage, tc.x, tc.y);
        out.onTable = inside.filter((f) => f.placedOn === table).length;
        out.allOut = inside.every((f) => f.currentCage === null);
        objects.splice(objects.indexOf(cage), 1);
        objects.splice(objects.indexOf(table), 1);
        // Another cage
        const other = new Cage("INDOORS");
        other.x = 900;
        other.y = 450;
        objects.push(other);
        other.update(0);
        other.updateBounds();
        ({ cage, inside } = __ejectCage(300, 2));
        __carryTo(cage, other.x, other.y);
        out.intoCage = inside.every((f) => f.currentCage === other);
        objects.splice(objects.indexOf(cage), 1);
        objects.splice(objects.indexOf(other), 1);
        // The river
        __clearScene("RIVER");
        ({ cage, inside } = __ejectCage(700, 1, "RIVER"));
        __carryTo(cage, width * 0.1, 500);
        const fr = inside[0];
        for (let i = 0; i < 5; i++) fr.physics.updateRiverDrowning(0.1);
        out.river = fr.currentCage === null && fr.drowningTimer > 0;
        objects.splice(objects.indexOf(cage), 1);
        // The road
        __clearScene("ALLEY_ROAD");
        ({ cage, inside } = __ejectCage(700, 1, "ALLEY_ROAD"));
        cage.y = 250;
        cage.updateBounds();
        out.roadTarget = cageTipTargetAt(cage, 500, 450)?.kind;
        __carryTo(cage, 500, 450);
        out.road = inside[0].currentCage === null && inside[0].y > 320;
        objects.splice(objects.indexOf(cage), 1);
        return out;
      }, [SETUP, TIP_SETUP]);
      checkEqual(r.glowTarget, "grinder", "carried over the grinder, the grinder is the target (and glows)");
      check(r.beside, "the cage lands beside the grinder " + JSON.stringify(r.dbg));
      check(r.queued && r.oneByOne, "they go in one after another");
      check(r.feared, "a fluffy watching learns to fear cages");
      checkEqual(r.onTable, 1, "one goes on the table");
      check(r.allOut, "the rest are out beside it");
      check(r.intoCage, "over another cage they're moved into it");
      check(r.river, "over the river they're in the water");
      checkEqual(r.roadTarget, "road", "the road is a target");
      check(r.road, "over the road they're in the lanes");
    },
  },
  {
    name: "eject anywhere: with the real mouse - a click on a full Eject cage empties it; press, drag over the grinder, let go and click: they go in",
    run: async (page) => {
      const pos = await page.evaluate(([setup, tip]) => {
        eval(setup)();
        eval(tip)();
        gameState = "PLAYING";
        if (typeof transitionPhase !== "undefined") transitionPhase = "OFF";
        isGlobalDragging = false;
        if (typeof tutorialTimer !== "undefined") tutorialTimer = 0; // (the tips box)
        const { cage, inside } = __ejectCage(800, 2);
        window.__tc = { cage, inside };
        return { x: cage.x + 30, y: cage.bounds.top + 20 }; // (the bars, not a fluffy)
      }, [SETUP, TIP_SETUP]);
      await page.waitForTimeout(300);
      await page.mouse.move(pos.x, pos.y);
      await page.mouse.click(pos.x, pos.y);
      await page.waitForTimeout(100);
      const r1 = await page.evaluate(() => ({ out: __tc.inside.every((f) => f.currentCage === null), held: __tc.cage.isDragging }));
      check(r1.out && !r1.held, `a click empties it below (${JSON.stringify(r1)})`);
      const p2 = await page.evaluate(() => {
        objects.splice(objects.indexOf(__tc.cage), 1);
        const { cage, inside } = __ejectCage(700, 2);
        const g = new Grinder("INDOORS");
        g.x = 1050;
        g.y = 520;
        objects.push(g);
        g.update(0);
        window.__tc = { cage, inside, g };
        return { x: cage.x + 30, y: cage.bounds.top + 20, gx: (g.bounds.left + g.bounds.right) / 2, gy: (g.bounds.top + g.bounds.bottom) / 2 };
      });
      await page.mouse.move(p2.x, p2.y);
      await page.mouse.down();
      await page.waitForTimeout(50);
      await page.mouse.move(p2.gx, p2.gy, { steps: 8 });
      await page.waitForTimeout(50);
      await page.mouse.up();
      await page.waitForTimeout(50);
      const held = await page.evaluate(() => __tc.cage.isDragging);
      await page.mouse.click(p2.gx, p2.gy);
      const r2 = await page.evaluate(() => {
        const queued = !!__tc.cage._tipQueue;
        for (let i = 0; i < 60; i++) __tc.cage.update(0.05);
        return { queued, dead: __tc.inside.filter((f) => !f.isAlive || f.isDestroyed).length };
      });
      check(held, "dragged, it stays in hand until the next click");
      check(r2.queued, "let go over the grinder, it tips");
      checkEqual(r2.dead, 2, "both go in");
    },
  },
];
