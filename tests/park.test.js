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
