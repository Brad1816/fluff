// Checks for every item in the shop: buying, selling, picking up, saving.
// These use the item registry (ItemRegistry.js), so a new item added there
// is automatically tested too.
const { check } = require("./helpers");

// Code that runs inside the game page, shared by the tests below
const PAGE_HELPERS = () => {
  // Walk into the right store aisle and click the shelf, like the player would
  window.__buy = (action) => {
    const aisle = getStoreAisleForAction(action);
    const slot = getStoreShelfLayout(aisle).slots.find((s) => s.action === action);
    changeScene(aisle.scene);
    mouse.x = slot.iconX;
    mouse.y = slot.iconY;
    mouse.rightDown = false;
    storeShelfClick();
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
          __clearScene(getStoreAisleForAction(a).scene);
          money = 1000000;
          if (!getItemTypeForAction(a)) {
            problems.push(`${a.name}: no entry in ItemRegistry.js`);
            continue;
          }
          __buy(a);
          const made = objects.filter((o) => o.scene === currentScene);
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
    name: "right-clicking items does their action",
    run: async (page) => {
      await page.evaluate(PAGE_HELPERS);
      const problems = await page.evaluate(() => {
        const problems = [];
        fluffies.length = 0;
        const rightClick = (obj) => {
          const spot = __findClickSpot(obj, (x, y) => itemHitTest(obj, x, y));
          mouse.x = spot.x;
          mouse.y = spot.y;
          mouse.rightDown = true;
          canvas.dispatchEvent(
            new MouseEvent("mousedown", { clientX: spot.x, clientY: spot.y, button: 2, bubbles: true }),
          );
          mouse.rightDown = false;
        };
        const place = (obj) => {
          __clearScene();
          obj.x = 640;
          obj.y = 450;
          if (obj instanceof Fence) obj.setPosition(640, 450);
          objects.push(obj);
          obj.update(0.001);
          return obj;
        };
        const cage = place(new Cage("INDOORS"));
        rightClick(cage);
        if (cage.tag !== "breeding") problems.push(`cage tag is "${cage.tag}", expected "breeding"`);
        const tv = place(new FluffTV("INDOORS"));
        const ch = JSON.stringify(tv.serialize());
        rightClick(tv);
        if (JSON.stringify(tv.serialize()) === ch) problems.push("TV channel didn't change");
        const sprinkler = place(new Sprinkler("INDOORS"));
        const wasOn = sprinkler.isOn;
        rightClick(sprinkler);
        if (sprinkler.isOn === wasOn) problems.push("sprinkler didn't switch");
        const gate = place(new Fence("INDOORS", "h", true));
        rightClick(gate);
        if (!gate.isOpen) problems.push("gate didn't open");
        const fence = place(new Fence("INDOORS", "h"));
        rightClick(fence);
        if (fence.orientation !== "v") problems.push("fence didn't turn");
        toolbox.length = 0;
        const tack = place(new Thumbtack("INDOORS"));
        rightClick(tack);
        if (!toolbox.includes(tack)) problems.push("thumbtack didn't go back in the toolbox");
        return problems;
      });
      check(problems.length === 0, problems.join("; "));
    },
  },
  {
    name: "only the right items can be dropped into a cage",
    run: async (page) => {
      const problems = await page.evaluate(() => {
        const problems = [];
        const cases = [
          ["Bowl", () => new Bowl("bowl", "INDOORS"), true],
          ["Bed", () => new Bed("INDOORS"), true],
          ["Ball", () => new Ball(0, 0, "INDOORS"), true],
          ["Crown", () => new AccessoryItem("INDOORS", "crown"), true],
          ["Grinder", () => new Grinder("INDOORS"), false],
          ["Table", () => new OperatingTable("INDOORS"), false],
          ["IV stand", () => new IVStand("INDOORS"), false],
          ["Sprinkler", () => new Sprinkler("INDOORS"), false],
          ["Food bag", () => new FoodBag("kibble", "INDOORS"), false],
          ["Fence", () => new Fence("INDOORS", "h"), false],
        ];
        for (const [name, make, shouldGoIn] of cases) {
          __clearScene();
          const cage = new Cage("INDOORS");
          cage.x = 640;
          cage.y = 450;
          objects.push(cage);
          cage.update(0.001);
          const obj = make();
          obj.x = cage.x;
          obj.y = cage.y;
          objects.push(obj);
          obj.isDragging = true;
          mouse.x = 640;
          mouse.y = 450;
          obj.onDrop();
          const inCage = obj.currentCage === cage;
          if (inCage !== shouldGoIn)
            problems.push(`${name}: ${inCage ? "went into" : "didn't go into"} the cage`);
        }
        return problems;
      });
      check(problems.length === 0, problems.join("; "));
    },
  },
  {
    name: "every shop button has a picture",
    run: async (page) => {
      const missing = await page.evaluate(() =>
        SPAWN_ACTIONS.filter((a) => a.isItem)
          .filter((a) => {
            const icon = getShopIcon(a);
            return !icon.draw && !(icon.imageKey && images[icon.imageKey]);
          })
          .map((a) => a.name),
      );
      check(missing.length === 0, "no picture for: " + missing.join(", "));
    },
  },
  {
    name: "tools: names, pictures, saving, and default toolbar slots",
    run: async (page) => {
      const problems = await page.evaluate(() => {
        const problems = [];
        toolbox.length = 0;
        for (const a of SPAWN_ACTIONS.filter((a) => isToolAction(a))) {
          const tool = createToolFromAction(a);
          if (!tool) {
            problems.push(`${a.name}: couldn't be made`);
            continue;
          }
          if (!isToolObject(tool)) problems.push(`${a.name}: not treated as a tool`);
          if (!matchesToolAction(tool, a)) problems.push(`${a.name}: doesn't match its shop entry`);
          if (!getToolName(tool) || getToolName(tool) === "Tool") problems.push(`${a.name}: no name`);
          if (!getToolDesc(tool)) problems.push(`${a.name}: no description`);
          if (!getToolImage(tool)) problems.push(`${a.name}: no picture`);
          const data = JSON.parse(JSON.stringify(tool.serialize()));
          if (!isToolData(data)) problems.push(`${a.name}: save data not seen as a tool`);
          const back = createToolFromData(data);
          if (!back || JSON.stringify(back.serialize()) !== JSON.stringify(data))
            problems.push(`${a.name}: changed after saving and loading`);
          toolbox.push(tool);
        }
        // Tooltips show how much is left
        const kit = new SutureKit("INDOORS");
        kit.charges = 2;
        if (!getToolFullName(kit).includes("2 uses left"))
          problems.push(`suture kit tooltip: "${getToolFullName(kit)}"`);
        // Default number keys
        initDefaultToolbar();
        const slots = Object.fromEntries(
          toolbarSlots.map((s) => [s.key, s.tool ? getToolTypeKey(s.tool) : null]),
        );
        const expected = { 1: "sponge", 2: "brush", 4: "magnifying_glass", 5: "knife", 8: "scalpel", 9: "syringe", 0: "cattle_prod" };
        for (const [k, v] of Object.entries(expected)) {
          if (slots[k] !== v) problems.push(`toolbar key ${k} has ${slots[k]}, expected ${v}`);
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
