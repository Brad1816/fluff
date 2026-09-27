// Checks for every item in the shop: buying, selling, picking up, saving.
// These use the item registry (ItemRegistry.js), so a new item added there
// is automatically tested too.
const { check } = require("./helpers");

// Code that runs inside the game page, shared by the tests below
const PAGE_HELPERS = () => {
  // Click a shop button, exactly like the player would
  window.__buy = (action) => {
    itemMenuFilter = action.name;
    itemMenuPage = 0;
    const list = SPAWN_ACTIONS.filter((a) =>
      a.name.toLowerCase().startsWith(action.name.toLowerCase()),
    );
    const i = list.indexOf(action);
    mouse.x = 30 + (i % 7) * 45;
    mouse.y = 140 + Math.floor(i / 7) * 45;
    mouse.rightDown = false;
    actionButtonsClick();
    itemMenuFilter = "";
  };
  // Shop entries that are world items (not tools, not fluffies)
  window.__worldActions = () =>
    SPAWN_ACTIONS.filter((a) => a.isItem && !isToolAction(a));
  // One placed example of every shop item (world items and tools)
  window.__makeEverything = () => {
    const made = [];
    for (const a of SPAWN_ACTIONS.filter((a) => a.isItem)) {
      let obj = isToolAction(a) ? createToolFromAction(a) : null;
      if (!obj) {
        const entry = getItemTypeForAction(a);
        if (!entry) continue;
        obj = entry.create(a, 640, 450);
        obj.isDragging = false;
        isGlobalDragging = false;
      }
      obj.scene = "INDOORS";
      if (obj.setPosition) obj.setPosition(640, 450);
      else {
        obj.x = 640;
        obj.y = 450;
      }
      if (obj instanceof FoodBag) obj.amount = 5; // a full bag
      if (obj.update) obj.update(0.001);
      made.push({ action: a, obj });
    }
    return made;
  };
  // Find a spot to click on an item (scanning around it)
  window.__findClickSpot = (obj, test) => {
    for (let dy = -150; dy <= 90; dy += 4) {
      for (let dx = -150; dx <= 150; dx += 4) {
        if (test(obj.x + dx, obj.y + dy)) return { x: obj.x + dx, y: obj.y + dy };
      }
    }
    return null;
  };
};

module.exports = [
  {
    name: "every world item in the shop has a registry entry and can be bought",
    run: async (page) => {
      await page.evaluate(PAGE_HELPERS);
      const problems = await page.evaluate(() => {
        const problems = [];
        for (const a of __worldActions()) {
          __clearScene();
          money = 1000000;
          if (!getItemTypeForAction(a)) {
            problems.push(`${a.name}: no entry in ItemRegistry.js`);
            continue;
          }
          __buy(a);
          const made = objects.filter((o) => o.scene === "INDOORS");
          const spent = 1000000 - money;
          if (spent !== a.cost) problems.push(`${a.name}: cost $${spent}, shop says $${a.cost}`);
          if (made.length !== 1) {
            problems.push(`${a.name}: made ${made.length} items`);
            continue;
          }
          const entry = getItemType(made[0]);
          if (!entry || (entry.shopItem || entry.sellType) !== a.isItem)
            problems.push(`${a.name}: made the wrong kind of item`);
        }
        return problems;
      });
      check(problems.length === 0, problems.join("; "));
    },
  },
  {
    name: "tools bought from the shop go into the toolbox",
    run: async (page) => {
      await page.evaluate(PAGE_HELPERS);
      const problems = await page.evaluate(() => {
        const problems = [];
        for (const a of SPAWN_ACTIONS.filter((a) => isToolAction(a))) {
          money = 1000000;
          const before = toolbox.length;
          __buy(a);
          if (1000000 - money !== a.cost) problems.push(`${a.name}: cost $${1000000 - money}, shop says $${a.cost}`);
          if (toolbox.length !== before + 1) problems.push(`${a.name}: not added to toolbox`);
        }
        return problems;
      });
      check(problems.length === 0, problems.join("; "));
    },
  },
  {
    name: "every item sells for half its shop price (shift + click)",
    run: async (page) => {
      await page.evaluate(PAGE_HELPERS);
      const problems = await page.evaluate(() => {
        const problems = [];
        fluffies.length = 0;
        for (const { action, obj } of __makeEverything()) {
          __clearScene();
          objects.push(obj);
          const spot = __findClickSpot(obj, (x, y) => {
            const found = findSellableItemAt(x, y);
            return found && found.item === obj;
          });
          if (!spot) {
            problems.push(`${action.name}: nowhere to click to sell it`);
            continue;
          }
          money = 0;
          isShiftPressed = true;
          shiftSellBlocked = false;
          mouse.x = spot.x;
          mouse.y = spot.y;
          mouse.rightDown = false;
          sellModeClick();
          isShiftPressed = false;
          const expected = Math.floor(action.cost / 2);
          if (money !== expected) problems.push(`${action.name}: sold for $${money}, expected $${expected}`);
          if (objects.includes(obj)) problems.push(`${action.name}: still there after selling`);
        }
        return problems;
      });
      check(problems.length === 0, problems.join("; "));
    },
  },
  {
    name: "every world item can be picked up by clicking it",
    run: async (page) => {
      await page.evaluate(PAGE_HELPERS);
      const problems = await page.evaluate(() => {
        const problems = [];
        fluffies.length = 0;
        for (const { action, obj } of __makeEverything()) {
          if (isToolAction(action)) continue; // tools are picked up from the toolbox
          __clearScene();
          objects.push(obj);
          // (not the IV stand's top, which starts an IV connection instead)
          const spot = __findClickSpot(
            obj,
            (x, y) =>
              itemCanBePickedUpAt(obj, x, y) &&
              !(obj.hitTestTop && obj.hitTestTop(x, y)),
          );
          if (!spot) {
            problems.push(`${action.name}: nowhere to click to pick it up`);
            continue;
          }
          mouse.x = spot.x;
          mouse.y = spot.y;
          canvas.dispatchEvent(
            new MouseEvent("mousedown", { clientX: spot.x, clientY: spot.y, button: 0, bubbles: true }),
          );
          if (!obj.isDragging) problems.push(`${action.name}: clicking it didn't pick it up`);
          obj.isDragging = false;
          isGlobalDragging = false;
        }
        return problems;
      });
      check(problems.length === 0, problems.join("; "));
    },
  },
  {
    name: "every item comes back the same after saving and loading",
    run: async (page) => {
      await page.evaluate(PAGE_HELPERS);
      const problems = await page.evaluate(() => {
        const problems = [];
        __clearScene();
        for (const { action, obj } of __makeEverything()) {
          const data = JSON.parse(JSON.stringify(obj.serialize()));
          const before = JSON.stringify(data);
          if (!SAVED_CLASSES[data.classType]) {
            problems.push(`${action.name}: ${data.classType} missing from SAVED_CLASSES`);
            continue;
          }
          const countBefore = objects.length;
          loadObject(data);
          const loaded = objects[objects.length - 1];
          if (objects.length !== countBefore + 1) {
            problems.push(`${action.name}: didn't load`);
            continue;
          }
          const after = JSON.stringify(loaded.serialize());
          if (after !== before) problems.push(`${action.name}: changed after loading`);
        }
        return problems;
      });
      check(problems.length === 0, problems.join("; "));
    },
  },
];
