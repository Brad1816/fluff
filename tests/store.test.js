// Fluff Mart (Store.js): the shopping street, the aisles and buying things.
const { check, checkEqual } = require("./helpers");

// Where the thing called `name` sits on the shelves: { scene, x, y }
const shelfSpot = (page, name) =>
  page.evaluate((name) => {
    const action = SPAWN_ACTIONS.find((a) => a.name === name);
    const aisle = getStoreAisleForAction(action);
    const slot = getStoreShelfLayout(aisle).slots.find((s) => s.action === action);
    return { scene: aisle.scene, x: slot.iconX, y: slot.iconY };
  }, name);

const state = (page) =>
  page.evaluate(() => ({
    scene: currentScene,
    money,
    toolbox: toolbox.length,
    bags: objects
      .filter((o) => o instanceof FoodBag)
      .map((b) => ({ scene: b.scene, dragging: b.isDragging })),
  }));

module.exports = [
  {
    name: "every shop item is on a shelf exactly once, and each aisle fits",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const problems = [];
        for (const a of SPAWN_ACTIONS) {
          const aisles = getStoreAisles().filter((x) => x.actions.includes(a));
          if (aisles.length !== 1) problems.push(`${a.name} is in ${aisles.length} aisles`);
        }
        for (const aisle of getStoreAisles()) {
          const L = getStoreShelfLayout(aisle);
          for (const s of L.slots) {
            if (s.y + s.h > L.unitBottom + 1) problems.push(`${s.action.name} is below the shelves`);
            if (s.x < 0 || s.x + s.w > width) problems.push(`${s.action.name} is off screen`);
          }
          if (!getSceneConfig(aisle.scene).isStore) problems.push(`${aisle.scene} has no scene`);
        }
        return problems;
      });
      check(r.length === 0, r.join("; "));
    },
  },
  {
    name: "walk to the store, buy kibble, carry it home with WASD",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate(() => {
        __clearScene();
        money = 1000;
        tutorialTimer = 0;
      });
      const door = await page.evaluate(() => ({
        x: doorRect.x + doorRect.w / 2,
        y: doorRect.y + doorRect.h / 2,
      }));

      // Front door -> garden -> down to the street -> in the store door
      await page.mouse.click(door.x, door.y);
      checkEqual((await state(page)).scene, "OUTDOORS", "after the front door");
      await page.mouse.click(640, 770);
      checkEqual((await state(page)).scene, "SHOP_STREET", "after the garden's down arrow");
      await page.mouse.click(door.x, door.y);
      const kibble = await shelfSpot(page, "Kibble");
      checkEqual((await state(page)).scene, kibble.scene, "after the store door");

      // Buy it off the shelf
      await page.mouse.click(kibble.x, kibble.y);
      let s = await state(page);
      checkEqual(s.money, 1000 - 25, "money after buying kibble");
      checkEqual(JSON.stringify(s.bags), JSON.stringify([{ scene: kibble.scene, dragging: false }]), "the bag is on the store floor");

      // Pick it up and walk home: S (out of the store), S (garden - the
      // street's way back is at the bottom), W (home)
      const spot = await page.evaluate(() => {
        const b = objects.find((o) => o instanceof FoodBag);
        // Straight up from its bottom, away from the edges
        for (let dy = -10; dy > -80; dy -= 2)
          if (itemCanBePickedUpAt(b, b.x, b.y + dy) && !getStoreSlotAt(currentScene, b.x, b.y + dy))
            return { x: Math.round(b.x), y: Math.round(b.y + dy) };
        return null;
      });
      check(spot, "couldn't find the bag to click");
      await page.mouse.click(spot.x, spot.y);
      checkEqual(JSON.stringify((await state(page)).bags), JSON.stringify([{ scene: kibble.scene, dragging: true }]), "picked up the bag");
      for (const key of ["KeyS", "KeyS", "KeyW"]) await page.keyboard.press(key);
      await page.mouse.move(700, 500);
      await page.mouse.click(700, 500);
      s = await state(page);
      checkEqual(s.scene, "INDOORS", "back home");
      checkEqual(JSON.stringify(s.bags), JSON.stringify([{ scene: "INDOORS", dragging: false }]), "the bag came home");
    },
  },
  {
    name: "tools go to the toolbox, no money means no sale",
    run: async (page) => {
      await page.evaluate(() => {
        __clearScene();
        money = 60;
      });
      const brush = await shelfSpot(page, "Brush");
      await page.evaluate((sc) => changeScene(sc), brush.scene);
      await page.mouse.click(brush.x, brush.y);
      let s = await state(page);
      checkEqual(s.money, 10, "money after the $50 brush");
      checkEqual(s.toolbox, 1, "brush in the toolbox");

      // Only $10 left: the $25 kibble can't be bought
      const kibble = await shelfSpot(page, "Kibble");
      await page.evaluate((sc) => changeScene(sc), kibble.scene);
      await page.mouse.click(kibble.x, kibble.y);
      s = await state(page);
      checkEqual(s.money, 10, "money after trying to buy kibble");
      checkEqual(s.bags.length, 0, "no bag appeared");
    },
  },
  {
    name: "everything bought in the store lands on the floor, not on the shelves",
    run: async (page) => {
      const problems = await page.evaluate(() => {
        const problems = [];
        for (const a of SPAWN_ACTIONS.filter((a) => a.isItem && !isToolAction(a))) {
          const aisle = getStoreAisleForAction(a);
          __clearScene(aisle.scene);
          changeScene(aisle.scene);
          money = 1000000;
          const L = getStoreShelfLayout(aisle);
          const slot = L.slots.find((s) => s.action === a);
          mouse.x = slot.iconX;
          mouse.y = slot.iconY;
          storeShelfClick();
          const obj = objects.find((o) => o.scene === aisle.scene);
          if (!obj) problems.push(`${a.name}: nothing appeared`);
          else if (!obj.isDragging && obj.y < L.unitBottom)
            problems.push(`${a.name}: landed on the shelves (y ${Math.round(obj.y)})`);
          if (obj && obj.isDragging) obj.isDragging = false;
          isGlobalDragging = false;
        }
        return problems;
      });
      check(problems.length === 0, problems.join("; "));
    },
  },
  {
    name: "the old item menu only works in debug mode",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        money = 1000;
        showActionButtons = true;
        itemMenuFilter = "";
        itemMenuPage = 0;
        // First button in the menu (Soylent Brown)
        mouse.x = 30;
        mouse.y = 140;
        const before = objects.length;
        const normal = actionButtonsClick();
        const normalItems = objects.length - before;
        showDebugMenu = true;
        actionButtonsClick();
        const debugItems = objects.length - before;
        showDebugMenu = false;
        return { normal, normalItems, debugItems, money };
      });
      checkEqual(r.normal, false, "menu click in normal play");
      checkEqual(r.normalItems, 0, "items from the menu in normal play");
      checkEqual(r.debugItems, 1, "items from the menu in debug mode");
      checkEqual(r.money, 1000, "debug mode spawning is free");
    },
  },
];
