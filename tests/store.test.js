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
    name: "walk to the store, buy kibble and a cage, walk home: kibble in the shopping bag, the cage delivered",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate(() => {
        __clearScene();
        money = 1000;
        tutorialTimer = 0;
        showToolbox = true;
        toolboxPage = 0;
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

      // Buy it off the shelf: into the shopping bag
      await page.mouse.click(kibble.x, kibble.y);
      let s = await state(page);
      checkEqual(s.money, 1000 - 25, "money after buying kibble");
      checkEqual(s.bags.length, 0, "not on the store floor");
      checkEqual(JSON.stringify(await page.evaluate(() => shoppingBag.map((e) => e.name))), JSON.stringify(["Kibble"]), "in the shopping bag");

      // A cage: delivered to the living room straight away
      const cage = await shelfSpot(page, "Cage");
      await page.evaluate((sc) => changeScene(sc), cage.scene);
      await page.mouse.click(cage.x, cage.y);
      const cages = await page.evaluate(() => objects.filter((o) => o instanceof Cage).map((c) => ({ scene: c.scene, dragging: c.isDragging })));
      checkEqual(JSON.stringify(cages), JSON.stringify([{ scene: "INDOORS", dragging: false }]), "the cage is waiting at home");
      checkEqual((await state(page)).money, 1000 - 25 - 150, "money after the cage");

      // Walk home: S (out of the store), S (garden), W (home)
      for (const key of ["KeyS", "KeyS", "KeyW"]) await page.keyboard.press(key);
      checkEqual((await state(page)).scene, "INDOORS", "back home");

      // Take the kibble out of the bag (in the toolbox) and put it down
      const btn = await page.evaluate(() => {
        const L = _toolboxAndToolbarLayout();
        const i = _toolboxGridEntries().findIndex((e) => e.isBag && e.name === "Kibble");
        return { x: L.toolboxX + (i % L.cols) * (L.btnSize + L.btnGap) + L.btnSize / 2, y: L.toolboxY + Math.floor(i / L.cols) * (L.btnSize + L.btnGap) + L.btnSize / 2 };
      });
      await page.mouse.click(btn.x, btn.y);
      checkEqual(JSON.stringify((await state(page)).bags), JSON.stringify([{ scene: "INDOORS", dragging: true }]), "taken out of the bag");
      await page.mouse.move(700, 500);
      await page.mouse.click(700, 500);
      s = await state(page);
      checkEqual(JSON.stringify(s.bags), JSON.stringify([{ scene: "INDOORS", dragging: false }]), "put down at home");
      checkEqual(await page.evaluate(() => shoppingBag.length), 0, "the bag is empty");

      // Pick it up again and click the toolbox: back in the bag, as it was
      await page.evaluate(() => {
        const b = objects.find((o) => o instanceof FoodBag);
        b.amount = 3;
        b.isDragging = true;
        isGlobalDragging = true;
      });
      await page.mouse.click(btn.x, btn.y);
      const packed = await page.evaluate(() => ({ bag: shoppingBag.map((e) => [e.name, e.data && e.data.amount]), world: objects.filter((o) => o instanceof FoodBag).length, dragging: isGlobalDragging }));
      checkEqual(JSON.stringify(packed), JSON.stringify({ bag: [["Kibble", 3]], world: 0, dragging: false }), "packed back into the bag");
      await page.mouse.click(btn.x, btn.y);
      const again = await page.evaluate(() => objects.filter((o) => o instanceof FoodBag).map((b) => [b.amount, b.isDragging]));
      checkEqual(JSON.stringify(again), JSON.stringify([[3, true]]), "comes out half used, as it went in");
      await page.mouse.click(700, 500);
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
    name: "everything bought in the store goes in the bag or is delivered to a clear spot at home",
    run: async (page) => {
      const problems = await page.evaluate(() => {
        const problems = [];
        __clearScene();
        for (const a of SPAWN_ACTIONS.filter((a) => a.isItem && !isToolAction(a))) {
          const aisle = getStoreAisleForAction(a);
          __clearScene(aisle.scene);
          changeScene(aisle.scene);
          money = 1000000;
          const L = getStoreShelfLayout(aisle);
          const slot = L.slots.find((s) => s.action === a);
          mouse.x = slot.iconX;
          mouse.y = slot.iconY;
          const bagBefore = shoppingBag.length;
          const homeBefore = objects.filter((o) => o.scene === "INDOORS").length;
          storeShelfClick();
          const kind = shopDeliveryKind(a);
          if (objects.some((o) => o.scene === aisle.scene)) problems.push(`${a.name}: left in the store`);
          if (kind === "bag" && shoppingBag.length !== bagBefore + 1) problems.push(`${a.name}: not in the bag`);
          if (kind === "deliver") {
            const home = objects.filter((o) => o.scene === "INDOORS");
            const obj = home[home.length - 1];
            if (home.length !== homeBefore + 1) problems.push(`${a.name}: not delivered`);
            else if (obj.isDragging) problems.push(`${a.name}: delivered stuck to the mouse`);
            else if (obj.y < sceneTop("INDOORS") + 60 || obj.y > height - 150 || obj.x < 150 || obj.x > width - 150)
              problems.push(`${a.name}: delivered to an odd spot (${Math.round(obj.x)}, ${Math.round(obj.y)})`);
          }
          if (kind === "carry") problems.push(`${a.name}: still has to be carried`);
          if (isGlobalDragging) problems.push(`${a.name}: left something stuck to the mouse`);
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
  {
    name: "the shopping bag is saved; old saves start with an empty bag",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        shoppingBag.push({ name: "Ball", data: null }, { name: "Kibble", data: { classType: "FoodBag", type: "kibble", amount: 2 } });
        const data = {};
        writeSavedGameState(data);
        const json = JSON.parse(JSON.stringify(data));
        shoppingBag = [];
        readSavedGameState(json);
        const out = { saved: shoppingBag.map((e) => e.name) };
        readSavedGameState({});
        out.old = shoppingBag.length;
        return out;
      });
      checkEqual(JSON.stringify(r.saved), JSON.stringify(["Ball", "Kibble"]), "saved");
      checkEqual(r.old, 0, "old saves");
    },
  },
];
