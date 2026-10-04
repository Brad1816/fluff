// Playtest round 6: wild eating talk, party hats, cages that snap together,
// taking a whole stack out of the bag, the alicorn goal, foals starving by
// a feeder, foals' Not for sale, cage mess and litterboxes, right-clicking
// and training caged fluffies, toys in cages, the gene planner's patterns,
// stock tags, the yard through the pet flap, the sprinkler, the scoop,
// mangled legs, and room kits
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD", "PARK"]) __clearScene(s);
  __seedRandom(6060);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 6 * DAY_LENGTH + 10 * HOUR_LENGTH;
  isGlobalDragging = false;
  scoopCarry = [];
  scoopBox = null;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.makeType(opts.type ?? "earthy");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 520;
    h.hunger = 1;
    h.health = 100;
    h.happiness = 0.7;
    h.coloristDegree = 0;
    h.currentStateKey = "IDLE";
    if (opts.think !== true) h.brain.think = () => {};
    if (opts.name) fluffyNames[h.id] = opts.name;
    fluffies.push(h);
    return h;
  };
  window.__cage = (x, tag = "none", scene = "INDOORS") => {
    const c = new Cage(scene);
    c.x = x;
    c.y = 480;
    c.tag = tag;
    c.updateBounds();
    objects.push(c);
    return c;
  };
  window.__put = (f, c) => {
    f.currentCage = c;
    f.x = c.x;
    f.y = c.bounds.bottom - 20;
  };
}`;

module.exports = [
  {
    name: "playtest6: wild fluffies eat without thanking an owner; party hats come off sooner; a dropped cage snaps flush beside another",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const wild = (DIALOGUE.EAT && DIALOGUE.EAT.WILD) || {};
        const lines = JSON.stringify(wild);
        const a = __cage(400);
        const b = __cage(400 + (a.bounds.right - a.bounds.left) + 20); // a little gap
        b.y += 10;
        b.updateBounds();
        b.pressPos = { x: -999, y: -999 };
        b.onDrop();
        return { hasWild: lines.length > 20, owner: /mummah gib|tank yu|nice mistah|nyu daddeh/i.test(lines), hat: PARTY_HAT_TIME, bunting: PARTY_BUNTING_TIME, gap: Math.round(b.bounds.left - a.bounds.right), level: Math.round(b.bounds.bottom - a.bounds.bottom) };
      }, SETUP);
      check(r.hasWild, "wild eating lines exist");
      check(!r.owner, "no thanking an owner");
      check(r.hat < 1 && r.bunting <= 1, `hats ${r.hat}h, bunting ${r.bunting}h`);
      checkEqual(r.gap, 0, "flush");
      checkEqual(r.level, 0, "level");
    },
  },
  {
    name: "playtest6: shift-click takes all of a kind out of the bag - put the first down and the rest are laid out beside it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        shoppingBag = [];
        for (let i = 0; i < 6; i++) shoppingBag.push({ name: "Kibble", data: null });
        for (let i = 0; i < 4; i++) shoppingBag.push({ name: "Bowl", data: null });
        mouse.x = 500;
        mouse.y = 560;
        const first = takeAllFromShoppingBag("Kibble");
        const held = !!(first && first.isDragging);
        const one = first.amount;
        first.onDrop();
        updateBagAll();
        const bags = objects.filter((o) => o instanceof FoodBag && o.scene === "INDOORS");
        const food = bags.reduce((s, b) => s + b.amount, 0);
        mouse.x = 700;
        const b1 = takeAllFromShoppingBag("Bowl");
        b1.onDrop();
        updateBagAll();
        const bowls = objects.filter((o) => o instanceof Bowl && o.scene === "INDOORS");
        return { held, food: Math.round(food / one), left: shoppingBag.length, notDragging: [...bags, ...bowls].every((o) => !o.isDragging), bowls: bowls.length, spread: new Set(bowls.map((o) => Math.round(o.x))).size };
      }, SETUP);
      check(r.held, "the first is in your hand");
      checkEqual(r.food, 6, "all six bags' worth of kibble out (piled into one, as bags do)");
      checkEqual(r.left, 0, "the bag's empty");
      check(r.notDragging, "all put down");
      checkEqual(r.bowls, 4, "four bowls");
      checkEqual(r.spread, 4, "side by side");
    },
  },
  {
    name: "playtest6: an alicorn you brought home doesn't count as bred; a foal refused by a mare tries the feeder instead of starving; a foal's menu still has Not for sale",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(300, { type: "alicorn" });
        const wildFoal = __mk(360, { type: "alicorn", growth: 0.5 });
        wildFoal.motherId = mum.id;
        wildFoal.bredHere = false;
        const bred = __mk(380, { type: "alicorn", growth: 0.5 });
        bred.motherId = mum.id;
        bred.bredHere = true;
        const out = { brought: _bornAtHome(wildFoal), bred: _bornAtHome(bred) };
        // Refused: it doesn't keep going back to her
        const foal = __mk(420, { growth: 0.1 });
        const mare = __mk(440);
        foal._milkNo = { [mare.id]: timePlayed + MILK_REFUSED_WAIT };
        out.refused = foal.actionHandler._milkRefused(mare);
        out.waitOk = MILK_REFUSED_WAIT > 0;
        // A foal too little for tricks: right-click still opens its actions
        const little = __mk(600, { growth: 0.2 });
        mouse.x = little.x;
        mouse.y = little.y - 8;
        let hitY = null;
        for (let dy = 0; dy <= 40 && hitY === null; dy += 2) if (little.hitTestAsSeen(little.x, little.y - dy)) hitY = little.y - dy;
        mouse.y = hitY ?? little.y - 8;
        trickUI = null;
        out.opened = trickRightClick();
        out.ui = trickUI && trickUI.actionsOnly;
        out.nfs = rightClickActions(little).some((a) => /sale/i.test(a.name));
        trickUI = null;
        return out;
      }, SETUP);
      checkEqual(r.brought, false, "brought home: not bred here");
      checkEqual(r.bred, true, "born to your mare: bred here");
      check(r.refused && r.waitOk, "the refusing mare is skipped for a while");
      check(r.opened && r.ui, "its menu opens (actions only)");
      check(r.nfs, "Not for sale is in it");
    },
  },
  {
    name: "playtest6: an accident in a cage stays in the cage and upsets it; a litterbox in there teaches it; floor mess under a cage doesn't dirty it; the sprinkler washes caged fluffies",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const c = __cage(500);
        const f = __mk(500);
        __put(f, c);
        const puddlesBefore = typeof puddles !== "undefined" ? puddles.length : 0;
        const happy = f.happiness;
        f.poopStorage = 0.6;
        f.excrete("poop", 0.6);
        const out = { mess: c.mess || 0, sadder: f.happiness < happy, puddles: (typeof puddles !== "undefined" ? puddles.length : 0) - puddlesBefore };
        // With a box in the cage it learns
        const box = new Litterbox(500, c.bounds.bottom - 10, "INDOORS");
        box.scene = "INDOORS";
        box.currentCage = c;
        objects.push(box);
        f.pottyTraining = 0;
        cageMessFrom(f, true, 0.5);
        out.learnt = f.pottyTraining > 0;
        out.floorMess = cagedFromFloorMess(f);
        // The sprinkler washes it
        f.dirt = 0.5;
        const s = new Sprinkler("INDOORS");
        s.x = 500;
        s.y = c.bounds.bottom;
        s.isOn = true;
        s.on = true;
        objects.push(s);
        for (let i = 0; i < 30; i++) s.update(0.5);
        out.dirt = f.dirt;
        return out;
      }, SETUP);
      check(r.mess > 0, `the cage is messy (${r.mess})`);
      check(r.sadder, "it's upset");
      check(r.puddles <= 0, "no floor puddle");
      check(r.learnt, "the box in the cage teaches it");
      check(r.floorMess, "floor mess under the cage doesn't count");
      check(r.dirt < 0.5, `washed (${r.dirt})`);
    },
  },
  {
    name: "playtest6: a caged fluffy can be right-clicked (not the cage) and the auto-trainer works through the bars",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const c = __cage(500);
        const f = __mk(500, { growth: 1 });
        __put(f, c);
        let hitY = null;
        for (let dy = 0; dy <= 60 && hitY === null; dy += 2) if (f.hitTestAsSeen(f.x, f.y - dy)) hitY = f.y - dy;
        mouse.x = f.x;
        mouse.y = hitY;
        trickUI = null;
        const tagBefore = c.tag;
        // The mousedown's right-click order: the fluffy first
        const opened = trickRightClick();
        const out = { opened, id: trickUI && trickUI.id === f.id, tag: c.tag === tagBefore };
        trickUI = null;
        const t = new AutoTrainer("INDOORS");
        t.x = c.bounds.right + 60;
        t.y = c.bounds.bottom;
        objects.push(t);
        out.canTrain = _atCanTrain(f);
        out.bars = _atThroughBars(t, f);
        return out;
      }, SETUP);
      check(r.opened && r.id, "its own menu");
      check(r.tag, "the cage's tag didn't change");
      check(r.canTrain, "a caged fluffy can be trained");
      check(r.bars, "through the bars from beside the cage");
    },
  },
  {
    name: "playtest6: the gene planner takes all three patterns; stock tags give no affection",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        genePlan = {};
        for (const p of ["spots", "stripes", "gradient"]) togglePlanChip("pattern", p);
        const out = { plan: JSON.stringify(genePlan.pattern) };
        togglePlanChip("pattern", "stripes");
        out.after = JSON.stringify(genePlan.pattern);
        genePlan = {};
        // Tags
        const stud = __mk(400, { gender: "male" });
        const mare = __mk(460);
        const foal = __mk(480, { growth: 0.2, gender: "male" });
        foal.motherId = mare.id;
        delete fluffyNames[stud.id];
        delete fluffyNames[mare.id];
        fluffyNames[999999] = "Stallion-04";
        const tags = [stockTagFor(stud), stockTagFor(mare), stockTagFor(foal)];
        delete fluffyNames[999999];
        const aff = (g) => (typeof affectionOf === "function" ? affectionOf(g) : g.affection || 0);
        const before = aff(stud);
        namingPopup = { ids: [stud.id, mare.id], kind: "litter", names: ["", ""], focus: 0 };
        tagAllInPopup();
        out.popup = [...namingPopup.names];
        saveNamingPopup();
        out.names = [fluffyNames[stud.id], fluffyNames[mare.id]];
        out.noLove = aff(stud) === before;
        out.isTag = [isStockTag("Milkbag-12"), isStockTag("Daisy"), isStockTag("Stud-3")];
        return { ...out, tags };
      }, SETUP);
      checkEqual(r.plan, JSON.stringify(["spots", "stripes", "gradient"]), "all three");
      checkEqual(r.after, JSON.stringify(["spots", "gradient"]), "tap again clears one");
      checkEqual(r.tags[0], "Stallion-05", "the next stallion number");
      checkEqual(r.tags[1], "Milkbag-01", "a nursing mare");
      checkEqual(r.tags[2], "Colt-01", "a colt");
      check(r.popup.every((n) => /-\d\d$/.test(n)), `tag all: ${r.popup}`);
      checkEqual(r.names[0], r.popup[0], "saved");
      check(r.noLove, "no affection for a tag");
      checkEqual(JSON.stringify(r.isTag), JSON.stringify([true, false, true]), "tags told from names");
    },
  },
  {
    name: "playtest6: a fluffy out in the yard through the pet flap isn't missed as lost; mangled legs crawl",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(400);
        const kid = __mk(450, { growth: 0.6 });
        kid.motherId = mum.id;
        relationships[mum.id] = relationships[mum.id] || {};
        relationships[mum.id][kid.id] = "child";
        relationships[kid.id] = relationships[kid.id] || {};
        relationships[kid.id][mum.id] = "mother";
        mum.perceivedRelationships = {};
        mum.updateRelationships(0.1);
        const flap = new PetFlap("INDOORS");
        flap.x = 600;
        flap.y = 500;
        objects.push(flap);
        _flapRooms = null;
        kid.scene = "BACKYARD";
        mum.updateRelationships(1);
        const withFlap = mum.perceivedRelationships[kid.id] && mum.perceivedRelationships[kid.id].state;
        objects.splice(objects.indexOf(flap), 1);
        _flapRooms = null;
        mum.updateRelationships(1);
        const without = mum.perceivedRelationships[kid.id] && mum.perceivedRelationships[kid.id].state;
        kid.scene = "INDOORS";
        // Mangled legs
        const hurt = __mk(700);
        hurt.limbState = { leg_0: "mangled" };
        hurt.updateCrawling();
        return { withFlap, without, crawl: !!hurt.isCrawling };
      }, SETUP);
      checkEqual(r.withFlap, "current", "out through the flap: still home");
      checkEqual(r.without, "lost", "no flap: taken away");
      check(r.crawl, "a mangled leg: it crawls");
    },
  },
  {
    name: "playtest6: the scoop lifts a litter out of a cage in one go and sets them all down",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        ensureThrowToolPrepended();
        const scoop = toolbox.find((t) => t instanceof Scoop);
        const out = { inToolbox: !!scoop, picture: !!getToolImage(scoop), name: getToolName(scoop) };
        const c = __cage(500);
        const mum = __mk(470);
        __put(mum, c);
        const foals = [0, 1, 2, 3].map((i) => {
          const k = __mk(440 + i * 30, { growth: 0.05 });
          k.motherId = mum.id;
          __put(k, c);
          k.x = 440 + i * 30;
          return k;
        });
        equipTool(scoop);
        // Drag a box round the foals (not their mum, further back)
        mum.y = c.bounds.top + 30;
        mouse.x = 425;
        mouse.y = c.bounds.bottom - 50;
        mouse.rightDown = false;
        out.started = attemptDrop();
        mouse.x = 545;
        mouse.y = c.bounds.bottom + 5;
        scoopMouseUp();
        out.carried = scoopCarried().length;
        out.mumLeft = !mum.isDragging;
        // Carry them out and set them down on the floor
        mouse.x = 900;
        mouse.y = 600;
        for (const f of foals) f.physics && f.physics.update ? null : null;
        out.dropped = attemptDrop();
        out.down = foals.every((f) => !f.isDragging);
        out.outOfCage = foals.every((f) => f.currentCage !== c);
        out.stillHolding = !!heldScoop();
        out.near = foals.every((f) => Math.abs(f.x - 900) < 80);
        unequipCurrentTool();
        return out;
      }, SETUP);
      check(r.inToolbox && r.picture, "everyone has a scoop, with a picture");
      checkEqual(r.name, "Scoop", "named");
      check(r.started, "the box starts");
      checkEqual(r.carried, 4, "all four foals");
      check(r.mumLeft, "mum wasn't in the box");
      check(r.dropped && r.down, "set down with a click");
      check(r.outOfCage, "out of the cage");
      check(r.near, "where you clicked");
      check(r.stillHolding, "the scoop's still in your hand");
    },
  },
  {
    name: "playtest6: a room kit fits a room out for its job (a mill: cages tagged, feeders inside) and costs less than buying it all",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const wasDebug = showDebugMenu;
        showDebugMenu = false;
        money = 100000;
        const kit = ROOM_KITS.find((k) => k.key === "mill");
        const full = roomKitNames(kit).reduce((s, n) => s + SPAWN_ACTIONS.find((a) => a.name === n).cost, 0);
        const price = roomKitPrice(kit);
        const made = fitOutRoom("mill", "INDOORS");
        const cages = made.filter((o) => o instanceof Cage);
        const feeders = made.filter((o) => o.constructor.name === "Bowl" || /feeder/i.test(getItemType(o)?.sellType || ""));
        const out = {
          price,
          full,
          paid: 100000 - money,
          cages: cages.length,
          tags: cages.map((c) => c.tag).sort().join(","),
          feedersInCages: feeders.filter((o) => cages.includes(o.currentCage)).length,
          onScreen: made.filter((o) => o.scene === "INDOORS").every((o) => o.x > 0 && o.x < width && o.y > 0 && o.y < height),
          overlap: cages.length > 1 && Math.round(cages[1].bounds.left - cages[0].bounds.right),
          backyard: canFitOutRoom("BACKYARD"),
          kits: ROOM_KITS.every((k) => roomKitNames(k).every((n) => SPAWN_ACTIONS.some((a) => a.name === n))),
        };
        // Each other kit can be made too
        for (const k of ["family", "nursery", "clinic"]) {
          __clearScene("INDOORS");
          out[k] = (fitOutRoom(k, "INDOORS") || []).length;
        }
        showDebugMenu = wasDebug;
        return out;
      }, SETUP);
      check(r.kits, "every kit item is in the shop");
      check(r.price < r.full, `cheaper: $${r.price} vs $${r.full}`);
      checkEqual(r.paid, r.price, "paid the kit price");
      checkEqual(r.cages, 3, "three cages");
      checkEqual(r.tags, "breeding,breeding,sell", "tagged");
      checkEqual(r.feedersInCages, 3, "a feeder in each cage");
      checkEqual(r.overlap, 0, "side by side");
      check(r.onScreen, "all on screen");
      checkEqual(r.backyard, false, "rooms of the house only");
      check(r.family > 10 && r.nursery > 8 && r.clinic > 4, `the other kits: ${r.family}, ${r.nursery}, ${r.clinic}`);
    },
  },
];
