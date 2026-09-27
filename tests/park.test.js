// Fluffy Park (Park.js): the big area you look around with a camera
const { check, checkEqual } = require("./helpers");

const cam = (page) => page.evaluate(() => ({ scene: currentScene, x: Math.round(camera.x), y: Math.round(camera.y) }));

// A fluffy at a world position in the park; returns its id
const putFluffy = (page, x, y, name) =>
  page.evaluate(
    ({ x, y, name }) => {
      const f = new Horse(1, null, "PARK", "earthy", null, null, null, "female");
      f.x = x;
      f.y = y;
      fluffies.push(f);
      fluffyNames[f.id] = name;
      return f.id;
    },
    { x, y, name },
  );

// Where to click on a fluffy, in screen positions (it may have walked a bit)
const clickSpot = (page, id) =>
  page.evaluate((id) => {
    const f = fluffies.find((f) => f.id === id);
    for (let dy = -60; dy < 10; dy += 3)
      for (let dx = -40; dx < 40; dx += 3)
        if (f.hitTest(f.x + dx, f.y + dy)) return { x: f.x + dx - camera.x, y: f.y + dy - camera.y };
    return null;
  }, id);

module.exports = [
  {
    name: "park: walk in from the river, look around, walk out",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate(() => {
        __clearScene();
        tutorialTimer = 0;
        changeScene("RIVER");
      });
      await page.mouse.click(50, 400); // the river's left arrow
      let c = await cam(page);
      checkEqual(c.scene, "PARK", "after the river's left arrow");
      const size = await page.evaluate(() => ({ maxX: PARK_W - width, maxY: PARK_H - height }));
      checkEqual(c.x, size.maxX, "camera starts at the right-hand side");

      // Drag the grass right by 200: the view moves left by 200
      await page.mouse.move(700, 350);
      await page.mouse.down();
      await page.mouse.move(900, 350, { steps: 5 });
      await page.mouse.up();
      const afterDrag = await cam(page);
      checkEqual(afterDrag.x, c.x - 200, "camera after dragging the grass");

      // Mouse wheel scrolls
      await page.mouse.wheel(0, 250);
      await page.waitForTimeout(50);
      const afterWheel = await cam(page);
      checkEqual(afterWheel.y, Math.min(size.maxY, afterDrag.y + 250), "camera after the mouse wheel");

      // Keys scroll (and don't take you out of the park)
      await page.keyboard.down("KeyA");
      await page.waitForTimeout(400);
      await page.keyboard.up("KeyA");
      const afterKey = await cam(page);
      check(afterKey.scene === "PARK" && afterKey.x < afterWheel.x - 100, `after holding A: ${JSON.stringify(afterKey)}`);

      // The map: click its top-left corner to jump there; the view can't go past the edge
      const mm = await page.evaluate(() => getParkMinimapRect());
      await page.mouse.click(mm.x + 2, mm.y + 2);
      c = await cam(page);
      checkEqual(JSON.stringify([c.x, c.y]), JSON.stringify([0, 0]), "camera after clicking the map's corner");

      // Out through the exit arrow
      await page.mouse.click(1230, 400);
      checkEqual((await cam(page)).scene, "RIVER", "after the park's exit arrow");
    },
  },
  {
    name: "park: clicking picks up the right fluffy after scrolling, and it drops where you click",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate(() => {
        __clearScene();
        tutorialTimer = 0;
        changeScene("PARK");
      });
      const id = await putFluffy(page, 1500, 900, "Scrolly");
      // Look at that part of the park
      await page.evaluate(() => centreCameraOn(1500, 900));
      const spot = await clickSpot(page, id);
      check(spot, "fluffy isn't on screen");
      await page.mouse.click(spot.x, spot.y);
      check(await page.evaluate((id) => fluffies.find((f) => f.id === id).isDragging, id), "the fluffy wasn't picked up");
      // Drop it 300px to the right (screen) = 300px to the right in the park
      await page.mouse.move(spot.x + 300, spot.y, { steps: 5 });
      await page.mouse.click(spot.x + 300, spot.y);
      const r = await page.evaluate((id) => {
        const f = fluffies.find((f) => f.id === id);
        return { dragging: f.isDragging, x: f.x };
      }, id);
      check(!r.dragging, "still carrying it");
      check(r.x > 1650 && r.x < 1950, `dropped at x ${Math.round(r.x)} (expected about 1800)`);
    },
  },
  {
    name: "park: carrying a fluffy out through the exit takes you both",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate(() => {
        __clearScene();
        tutorialTimer = 0;
        changeScene("PARK");
        camera.x = PARK_W - width;
        camera.y = 0;
      });
      const id = await putFluffy(page, 0, 0, "Carried");
      await page.evaluate((id) => {
        const f = fluffies.find((f) => f.id === id);
        f.x = camera.x + 900;
        f.y = camera.y + 500;
      }, id);
      const spot = await clickSpot(page, id);
      await page.mouse.click(spot.x, spot.y);
      await page.mouse.move(1230, 400, { steps: 5 });
      await page.mouse.click(1230, 400);
      const r = await page.evaluate((id) => {
        const f = fluffies.find((f) => f.id === id);
        return { scene: currentScene, fScene: f.scene, x: f.x, y: f.y };
      }, id);
      checkEqual(r.scene, "RIVER", "where you are");
      checkEqual(r.fScene, "RIVER", "where the fluffy is");
      check(r.x < 1280 && r.y < 800, `fluffy is on the river's screen: ${Math.round(r.x)}, ${Math.round(r.y)}`);
    },
  },
  {
    name: "park: fluffies use the whole park, other areas are unchanged",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(3);
        const f = new Horse(1, null, "PARK", "earthy", null, null, null, "female");
        f.x = PARK_W - 300;
        f.y = PARK_H - 300;
        fluffies.push(f);
        const run = f.positioning.getRunawayTarget(f.x - 50, f.y - 50);
        let maxX = 0;
        let maxY = 0;
        for (let i = 0; i < 50; i++) {
          f.positioning._pickNewTarget();
          maxX = Math.max(maxX, f.targetX);
          maxY = Math.max(maxY, f.targetY);
        }
        // Somewhere with fences in the park: the pen map covers the whole park
        const fence = new Fence("PARK", "h");
        fence.x = PARK_W - 400;
        fence.y = PARK_H - 400;
        fence.snapToGrid();
        objects.push(fence);
        prepareFenceCollisions(); // the game does this every frame
        const map = getPenMap("PARK");
        // Indoors the mouse isn't touched by the camera
        changeScene("INDOORS");
        mouse.x = 123;
        mouse.y = 456;
        camera.x = 999;
        mouseToWorld();
        const indoorsMouse = [mouse.x, mouse.y];
        camera.x = 0;
        return {
          run,
          maxX,
          maxY,
          fenceKept: fence.x > width,
          mapW: map && map.w,
          indoorsMouse,
          indoorW: sceneW("INDOORS"),
          W: PARK_W,
          H: PARK_H,
          screenW: width,
        };
      });
      check(r.run.x > r.screenW && r.run.x <= r.W - 100, `run-away target x ${Math.round(r.run.x)}`);
      check(r.maxX > r.screenW, `wander targets stay on one screen (max x ${Math.round(r.maxX)})`);
      check(r.maxX <= r.W && r.maxY <= r.H, "wander target outside the park");
      check(r.fenceKept, "a fence far out in the park got pulled back onto the first screen");
      checkEqual(r.mapW, r.W, "pen map width in the park");
      checkEqual(JSON.stringify(r.indoorsMouse), JSON.stringify([123, 456]), "mouse indoors");
      checkEqual(r.indoorW, r.screenW, "size of an ordinary area");
    },
  },
];

// ---- Life in the park (ParkLife.js) ----
module.exports.push(
  {
    name: "park life: a new game has berry bushes, meadow grass and wild families",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const inPark = objects.filter((o) => o.scene === "PARK");
        const bushes = inPark.filter((o) => o instanceof BerryBush);
        const grass = inPark.filter((o) => o instanceof Grass && !(o instanceof BerryBush));
        const wild = fluffies.filter((f) => isParkWild(f));
        return {
          bushes: bushes.length,
          grass: grass.length,
          grassOutside: grass.filter((g) => !inParkMeadow(g.x, g.y)).length,
          wild: wild.length,
          inside: wild.every((f) => f.x > 0 && f.x < PARK_W && f.y > PARK_TOP && f.y < PARK_H),
          meadows: PARK_MEADOWS.length,
        };
      });
      checkEqual(r.bushes, 12, "berry bushes");
      checkEqual(r.meadows, 7, "meadows");
      check(r.grass >= 7 * 5, `grass tufts in the park: ${r.grass}`);
      checkEqual(r.grassOutside, 0, "grass outside the meadows");
      check(r.wild >= 5, `wild fluffies at the start: ${r.wild}`);
      check(r.inside, "a wild fluffy is outside the park");
    },
  },
  {
    name: "park life: berry bushes are eaten and grow back; meadows regrow; they survive saving",
    run: async (page) => {
      const r = await page.evaluate(async () => {
        __clearScene("PARK");
        gameState = "PAUSED";
        const bush = new BerryBush(1000, 800, "PARK", 2);
        objects.push(bush);
        const res = {};
        res.eat1 = bush.eat();
        res.eat2 = bush.eat();
        res.eat3 = bush.eat();
        res.empty = !bush.hasFood();
        res.stillThere = !bush.isDestroyed;
        for (let i = 0; i < 60; i++) bush.update(1);
        res.regrew = bush.berries;
        for (let i = 0; i < 600; i++) bush.update(1);
        res.max = bush.berries;
        // Meadows grow grass back after being grazed bare
        for (let i = 0; i < 40; i++) updateParkLife(1);
        const m = PARK_MEADOWS[0];
        res.tufts = objects.filter(
          (o) => o instanceof Grass && !(o instanceof BerryBush) && o.scene === "PARK" &&
            ((o.x - m.x) / m.rx) ** 2 + ((o.y - m.y) / m.ry) ** 2 <= 1,
        ).length;
        for (let i = 0; i < 400; i++) updateParkLife(1);
        res.tuftsLater = objects.filter(
          (o) => o instanceof Grass && !(o instanceof BerryBush) && o.scene === "PARK" && inParkMeadow(o.x, o.y),
        ).length;
        // Save and load
        bush.growth = 3;
        await saveGame("__automated_test__");
        objects.length = 0;
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        gameState = "PAUSED";
        const back = objects.find((o) => o instanceof BerryBush && Math.round(o.x) === 1000 && Math.round(o.y) === 800);
        res.back = back ? back.berries : null;
        res.bushesAfter = objects.filter((o) => o instanceof BerryBush).length;
        return res;
      });
      check(r.eat1 && r.eat2 && !r.eat3, "a bush with 2 berries should feed exactly twice");
      check(r.empty && r.stillThere, "an empty bush should stay, just empty");
      checkEqual(r.regrew, 1, "berries after a minute");
      checkEqual(r.max, 5, "berries after a long time");
      check(r.tufts >= 5, `tufts in a grazed-bare meadow after 40s: ${r.tufts}`);
      check(r.tuftsLater <= 7 * 10, `meadows don't overfill: ${r.tuftsLater}`);
      checkEqual(r.back, 3, "berries after loading");
      checkEqual(r.bushesAfter, 1, "bushes after loading (no extra ones added when the park has some)");
    },
  },
  {
    name: "park life: a hungry fluffy picks nearby food over berries across the park, and eats",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        __seedRandom(5);
        const f = new Horse(1, null, "PARK", "earthy", null, null, null, "female");
        f.x = 600;
        f.y = 600;
        f.hunger = 0.3;
        fluffies.push(f);
        const nearGrass = new Grass(750, 600, "PARK", 2);
        const farBush = new BerryBush(2600, 1500, "PARK", 5);
        const nearBush = new BerryBush(600, 820, "PARK", 5);
        objects.push(nearGrass, farBush);
        f.positioning.scoutForHunger();
        const pickedWithoutBush = [f.targetX, f.targetY];
        objects.push(nearBush);
        f.positioning.scoutForHunger();
        const pickedWithBush = [f.targetX, f.targetY];
        __fastForward(20);
        return { pickedWithoutBush, pickedWithBush, hunger: f.hunger, nearBerries: nearBush.berries };
      });
      checkEqual(JSON.stringify(r.pickedWithoutBush), JSON.stringify([750, 600]), "grass close by beats berries far away");
      checkEqual(JSON.stringify(r.pickedWithBush), JSON.stringify([600, 820]), "berries a bit further beat grass");
      check(r.hunger > 0.9, `hunger after 20s: ${r.hunger.toFixed(2)}`);
      check(r.nearBerries < 5, "the nearby bush wasn't eaten from");
    },
  },
  {
    name: "park life: wild groups wander in at the edge, make herds, and stay (dogs don't take them)",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        __seedRandom(9);
        herdState = freshHerdState();
        _herdChanged();
        parkLife.enabled = true;
        parkLife.spawnTimer = 0;
        changeScene("INDOORS");
        const res = {};
        const fam = spawnParkGroup("family");
        res.famSize = fam.length;
        res.atEdge = fam.every(
          (f) => f.x < 250 || f.x > PARK_W - 250 || f.y < PARK_TOP + 250 || f.y > PARK_H - 250,
        );
        res.kidsHaveDad = fam.slice(2).every((k) => k.fatherId === fam[1].id && k.motherId === fam[0].id);
        updateHerds(3);
        res.famHerd = !!herdOf(fam[0]) && fam.every((f) => herdOf(f) === herdOf(fam[0]));
        // The park fills up over a few minutes
        for (let i = 0; i < 8 * 60; i++) {
          updateParkLife(1);
          updateFerals(1); // the dog clean-up
        }
        res.wild = countParkWild();
        // Crowded: fluffies wander off while you're away
        for (let i = 0; i < 12; i++) spawnParkGroup("friends");
        res.crowded = countParkWild();
        for (let i = 0; i < 20 * 60; i++) updateParkLife(1);
        res.afterTrim = countParkWild();
        parkLife.enabled = false;
        return res;
      });
      check(r.famSize >= 3, `family size ${r.famSize}`);
      check(r.atEdge, "family didn't arrive at the edge of the park");
      check(r.kidsHaveDad, "foals don't know their mum and dad");
      check(r.famHerd, "the family didn't make a herd");
      check(r.wild >= 16 && r.wild <= 30, `wild fluffies after 8 minutes: ${r.wild}`);
      check(r.crowded > 30, `crowded: ${r.crowded}`);
      check(r.afterTrim <= 30 && r.afterTrim >= 25, `after a crowded park thins out: ${r.afterTrim}`);
    },
  },
);
