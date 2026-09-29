// Getting around the house with keys, not floor arrows (UIScenes.js houseNav)
const { check, checkEqual } = require("./helpers");

const state = (page) => page.evaluate(() => ({ scene: currentScene, money, L: unlockedRoomsL, R: unlockedRoomsR, bought: roomsPurchased }));

module.exports = [
  {
    name: "house: no arrows on the floor; the keys and wall hints go between rooms",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate(() => {
        __clearScene();
        changeScene("INDOORS");
        money = 60000;
        unlockedRoomsL = 1;
        unlockedRoomsR = 0;
        roomsPurchased = 1;
      });
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const r = await page.evaluate(() => {
        const portals = getScenePortals("INDOORS");
        return {
          keyOnly: portals.filter((p) => p.keyOnly).map((p) => p.type).sort(),
          door: portals.some((p) => p.type === "door" && !p.keyOnly),
          chips: houseNavChips("INDOORS").map((c) => c.label),
          onWall: houseNavChips("INDOORS").every((c) => c.y + c.h <= sceneTop("INDOORS")),
          garden: getScenePortals("OUTDOORS").some((p) => p.keyOnly),
        };
      });
      checkEqual(JSON.stringify(r.keyOnly), JSON.stringify(["arrow_down", "arrow_left", "arrow_right"]), "house arrows are keys only");
      check(r.door, "the front door is still there");
      checkEqual(JSON.stringify(r.chips), JSON.stringify(["◀ A  Room L1", "S ▼ Backyard", "Buy a room $50,000  D ▶"]), "wall hints");
      check(r.onWall, "the hints are on the wall, not the floor");
      checkEqual(r.garden, false, "the garden keeps its arrows");

      // Clicking where the left arrow used to be does nothing
      await page.mouse.click(50, 400);
      checkEqual((await state(page)).scene, "INDOORS", "no arrow at the left edge");

      // Arrow keys and WASD move between rooms
      await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      checkEqual((await state(page)).scene, "INDOORSL1", "left arrow key");
      await page.keyboard.press("KeyD");
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      checkEqual((await state(page)).scene, "INDOORS", "D back to the living room");

      // Towards a room you don't own: asks first, buys on the second press
      await page.keyboard.press("ArrowRight");
      let s = await state(page);
      check(s.scene === "INDOORS" && s.money === 60000 && s.R === 0, `first press only asks ${JSON.stringify(s)}`);
      const asked = await page.evaluate(() => uiMessages.some((m) => /Press D again to buy new quarters for \$50,000/.test(m.text)));
      check(asked, "tells you the price and to press again");
      await page.keyboard.press("ArrowRight");
      s = await state(page);
      checkEqual(JSON.stringify([s.money, s.R, s.bought]), JSON.stringify([10000, 1, 2]), "second press buys it");
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      checkEqual((await state(page)).scene, "INDOORSR1", "then walks into it");

      // The wall hints can be clicked
      const chip = await page.evaluate(() => {
        const c = houseNavChips().find((x) => x.portal.target === "INDOORS");
        return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
      });
      await page.mouse.click(chip.x, chip.y);
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      checkEqual((await state(page)).scene, "INDOORS", "clicking a hint");

      // S / down arrow: the backyard; W / up: back in
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      checkEqual((await state(page)).scene, "BACKYARD", "down arrow key to the backyard");
      await page.keyboard.press("KeyW");
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      checkEqual((await state(page)).scene, "INDOORS", "W back in");
    },
  },
  {
    name: "house: things dropped at the edges stay in the room; carried things come along with the keys",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const r = await page.evaluate(() => {
        __clearScene();
        __clearScene("INDOORSL1");
        changeScene("INDOORS");
        unlockedRoomsL = 1;
        roomsPurchased = Math.max(1, roomsPurchased);
        const ball = new Ball(40, height / 2, "INDOORS");
        objects.push(ball);
        ball.isDragging = true;
        isGlobalDragging = true;
        mouse.x = 40;
        mouse.y = height / 2;
        mouse.rightDown = false;
        return { dropped: attemptDrop(), id: ball.id };
      });
      const after = await page.evaluate((id) => {
        const b = objects.find((o) => o.id === id);
        return { scene: b.scene, dragging: b.isDragging };
      }, r.id);
      checkEqual(after.scene, "INDOORS", "dropped at the left edge: still in the living room");
      // Carry it with the arrow key
      await page.evaluate((id) => {
        const b = objects.find((o) => o.id === id);
        b.isDragging = true;
        isGlobalDragging = true;
      }, r.id);
      await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const carried = await page.evaluate((id) => ({ scene: currentScene, ball: objects.find((o) => o.id === id).scene }), r.id);
      checkEqual(JSON.stringify(carried), JSON.stringify({ scene: "INDOORSL1", ball: "INDOORSL1" }), "carried into the next room");
      await page.evaluate((id) => {
        const b = objects.find((o) => o.id === id);
        b.isDragging = false;
        isGlobalDragging = false;
        changeScene("INDOORS");
      }, r.id);
    },
  },
];
