// Park bug fixes: items can be moved anywhere in the park, and clicks on
// moving fluffies line up with where they were drawn (Horse.hitTestAsSeen)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "park bugs: tables, cages and other big items can be dragged across the whole park",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        changeScene("PARK");
        const res = {};
        const make = {
          FluffyTable: () => new FluffyTable("PARK"),
          OperatingTable: () => new OperatingTable("PARK"),
          Cage: () => new Cage("PARK"),
          Grinder: () => new Grinder("PARK"),
          IVStand: () => new IVStand("PARK"),
          Knife: () => new Knife("knife", "PARK"),
        };
        for (const [name, mk] of Object.entries(make)) {
          const o = mk();
          o.scene = "PARK";
          objects.push(o);
          o.isDragging = true;
          o.dragOffset = { x: 0, y: 0 };
          mouse.x = PARK_W - 700;
          mouse.y = PARK_H - 500;
          o.update(0.016);
          res[name] = [Math.round(o.x), Math.round(o.y)];
          o.isDragging = false;
        }
        // Indoors they still stop at the screen edge
        const t = new FluffyTable("INDOORS");
        objects.push(t);
        t.isDragging = true;
        t.dragOffset = { x: 0, y: 0 };
        mouse.x = 3000;
        mouse.y = 3000;
        t.update(0.016);
        res.indoors = [Math.round(t.x), Math.round(t.y)];
        t.isDragging = false;
        res.W = PARK_W;
        res.H = PARK_H;
        res.screen = [width, height];
        return res;
      });
      for (const name of ["FluffyTable", "OperatingTable", "Cage", "Grinder", "IVStand", "Knife"]) {
        const [x, y] = r[name];
        check(x > r.screen[0] && y > r.screen[1], `${name} stopped at ${x}, ${y} (should reach ${r.W - 700}, ${r.H - 500})`);
      }
      check(r.indoors[0] <= r.screen[0] && r.indoors[1] <= r.screen[1], `indoors table left the screen: ${r.indoors}`);
    },
  },
  {
    name: "park bugs: clicking a running fluffy where it was drawn still hits it",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        changeScene("PARK");
        const f = new Horse(1, null, "PARK", "earthy", null, null, null, "female");
        f.x = 1500;
        f.y = 900;
        fluffies.push(f);
        f.updateLayout();
        // Find a spot on it, as drawn
        let spot = null;
        for (let dy = -40; dy < 0 && !spot; dy += 3)
          for (let dx = -20; dx < 20; dx += 3)
            if (f.hitTest(f.x + dx, f.y + dy)) {
              spot = { x: f.x + dx, y: f.y + dy };
              break;
            }
        // Drawn this frame...
        f._seenX = f.x;
        f._seenY = f.y;
        f._seenFrame = renderFrameCount;
        // ...then the game runs on (fast forward) before the click lands
        f.x += 60;
        f.initBehavior("MOVING");
        f.setTargetPosition(f.x + 800, f.y);
        const res = {
          plain: !!f.hitTest(spot.x, spot.y),
          asSeen: !!f.hitTestAsSeen(spot.x, spot.y),
        };
        // A stale drawing (many frames ago) isn't used
        f._seenFrame = renderFrameCount - 5;
        res.stale = !!f.hitTestAsSeen(spot.x, spot.y);
        // Leeway: just off the edge of a moving fluffy
        f._seenFrame = undefined;
        let edge = null;
        const sy = spot.y;
        for (let dx = 0; dx < 120; dx += 1) if (!f.hitTest(spot.x + 60 + dx, sy)) { edge = spot.x + 60 + dx + 6; break; }
        res.leewayMoving = !!f.hitTestAsSeen(edge, sy);
        f.initBehavior("IDLE");
        res.leewayIdle = !!f.hitTestAsSeen(edge, sy);
        return res;
      });
      check(!r.plain, "test setup: the plain hit test should miss");
      check(r.asSeen, "a click where the fluffy was drawn missed");
      check(!r.stale, "an old drawing position was used");
      check(r.leewayMoving, "no leeway for a moving fluffy");
      check(!r.leewayIdle, "a standing fluffy shouldn't get leeway");
    },
  },
];
