// Batch 8: autosave and Continue, playing offline, the memorial tree, the
// comfort plushie, and wise elders. (Pegasi not flying: batch6/batch7 tests.)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD"]) __clearScene(s);
  __seedRandom(41);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 4 * DAY_LENGTH;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 520;
    h.hunger = 1;
    h.health = 100;
    h.happiness = 0.6;
    h.currentStateKey = "IDLE";
    h.brain.think = () => {};
    if (opts.name) fluffyNames[h.id] = opts.name;
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "batch8: autosave - saves to Autosave, keeps the one before each morning, saves on switching away; Continue on the title screen picks it up",
    fresh: true,
    run: async (page) => {
      const r = await page.evaluate(async (setup) => {
        eval(setup)();
        const out = {};
        autosaveEnabled = true;
        gameState = "PLAYING";
        transitionPhase = "OFF";
        __mk(400, { name: "Daisy" });
        _autosaveLast = 0;
        out.saved = await autosaveNow("test");
        out.slot = !!(await saveManager.load(AUTOSAVE_SLOT));
        out.last = lastSaveInfo();
        // Too soon after: held back
        out.tooSoon = await autosaveNow("test");
        // A new morning: the last one is kept as the earlier one
        _autosaveLast = 0;
        out.morning = await autosaveNow("morning", true);
        out.backup = !!(await saveManager.load(AUTOSAVE_BACKUP));
        // Switching away saves
        await saveManager.delete(AUTOSAVE_SLOT);
        Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
        await new Promise((res) => setTimeout(res, 400));
        delete document.visibilityState;
        out.onHide = !!(await saveManager.load(AUTOSAVE_SLOT));
        // Not on the title screen
        gameState = "TITLE";
        _autosaveLast = 0;
        out.titleSave = await autosaveNow("test");
        autosaveEnabled = false;
        return out;
      }, SETUP);
      check(r.saved && r.slot, `saved to Autosave: ${JSON.stringify(r)}`);
      checkEqual(r.last && r.last.slot, "Autosave", "remembered as the last save");
      checkEqual(r.tooSoon, false, "not again straight away");
      check(r.morning && r.backup, "each morning keeps the one before");
      check(r.onHide, "switching away saves");
      checkEqual(r.titleSave, false, "never from the title screen");
      // Continue: the button is there, and loads it
      await page.evaluate(() => {
        fluffies.length = 0;
        showSaveList = false;
        showWorldSettingsPrompt = false;
        gameState = "TITLE";
        transitionPhase = "OFF";
      });
      await page.waitForTimeout(200);
      const cont = await page.evaluate(() => {
        const r = titleContinueRect();
        mouse.x = r.x + r.w / 2;
        mouse.y = r.y + r.h / 2;
        handleTitleScreenClick();
        return { pending: pendingSaveToLoad, phase: transitionPhase };
      });
      checkEqual(cont.pending, "Autosave", "Continue loads the last save");
      await page.waitForFunction(() => gameState === "PLAYING" && transitionPhase === "OFF", null, { timeout: 20000 });
      const back = await page.evaluate(() => fluffies.some((f) => fluffyNames[f.id] === "Daisy"));
      check(back, "and the game is back");
    },
  },
  {
    name: "batch8: playing offline - on a website the game's files are kept, and it opens again with no internet",
    run: async (page) => {
      const url = page.url().split("?")[0];
      const browser = page.context().browser();
      const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, serviceWorkers: "allow" });
      await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
      const p = await ctx.newPage();
      try {
        await p.goto(url);
        await p.waitForFunction(() => typeof gameState !== "undefined" && gameState === "TITLE", null, { timeout: 30000 });
        await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 });
        await p.evaluate(() => keepEverythingOffline());
        // Wait for the keep to fill
        await p.waitForFunction(
          async () => {
            const keys = await (await caches.open("fluffy-industries-v1")).keys();
            return keys.length > 150;
          },
          null,
          { timeout: 30000, polling: 500 },
        );
        await ctx.setOffline(true);
        await p.reload();
        await p.waitForFunction(() => typeof gameState !== "undefined" && gameState === "TITLE", null, { timeout: 30000 });
        const ok = await p.evaluate(() => typeof fluffies !== "undefined" && typeof Touch !== "undefined" && images && Object.keys(images).length > 20);
        check(ok, "the game opened again offline, pictures and all");
      } finally {
        await ctx.close();
      }
    },
  },
  {
    name: "batch8: the memorial tree - one of yours who dies goes on the plaque; family and friends mourn; a visit to the tree comforts and eases it; read by long-press; saved",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        memorialPlaque = [];
        out.shop = SPAWN_ACTIONS.some((a) => a.isItem === "memorial_tree") && STORE_AISLES.some((a) => a.items.includes("memorial_tree"));
        const mum = __mk(200, { name: "Clover" });
        const pip = __mk(300, { growth: 0.5, name: "Pip" });
        pip.motherId = mum.id;
        setRelationship(mum.id, pip.id, "baby_child");
        setRelationship(pip.id, mum.id, "mother");
        const friend = __mk(400, { name: "Bean" });
        changeOpinion(friend, pip, 0.7);
        const stranger = __mk(500, { name: "Moss" });
        const wild = __mk(600, { adopted: false });
        pip.die(null, "Fell off the table");
        wild.die(null, "Old age");
        // A stillborn foal isn't on the plaque, and its mum doesn't mourn it there
        const mare = __mk(100, { name: "Poppy" });
        const still = __mk(700, { growth: 0.2, name: "Tiny" });
        still.motherId = mare.id;
        setRelationship(mare.id, still.id, "baby_child");
        still.die(null, "Born non-viable");
        out.stillMourn = isMourning(mare);
        out.plaque = memorialPlaque.map((e) => [e.name, e.cause]);
        out.mourners = [mum, friend, stranger].map((f) => isMourning(f));
        out.describe = describeMourning(mum);
        // A tree in the room; she goes to it
        const tree = new MemorialTree("INDOORS");
        tree.x = 800;
        tree.y = 500;
        objects.push(tree);
        const left = mum.mourning.until - timePlayed;
        const real = Math.random;
        Math.random = () => 0;
        memorialTicker.fireNext && memorialTicker.fireNext();
        updateMemorial(3);
        Math.random = real;
        out.going = !!mum._memVisit;
        const h0 = mum.happiness;
        for (let t = 0; t < 40 && !(mum._memVisit && mum._memVisit.arrived); t += 0.1) {
          timePlayed += 0.1;
          mum.update(0.1);
          updateMemorial(0.1);
        }
        out.arrived = !!(mum._memVisit && mum._memVisit.arrived);
        out.eased = mum.mourning.until - timePlayed < left * 0.8;
        out.cheered = mum.happiness > h0;
        // Read it
        const entry = ITEM_TYPES.find((e) => e.sellType === "memorial_tree");
        entry.onRightClick(tree);
        out.open = memorialOpen;
        closeMemorial();
        // Saved
        const field = SAVED_GAME_STATE.find((e) => e.name === "memorialPlaque");
        out.saved = JSON.stringify(field.get()) === JSON.stringify(memorialPlaque);
        out.treeSaved = createItemFromSave(tree.serialize()) instanceof MemorialTree;
        return out;
      }, SETUP);
      check(r.shop, "in the shop");
      check(r.plaque.length === 1 && r.plaque[0][0] === "Pip" && /table/.test(r.plaque[0][1]), `yours on the plaque, not a wild one or a stillborn: ${JSON.stringify(r.plaque)}`);
      checkEqual(JSON.stringify(r.mourners), JSON.stringify([true, true, false]), "its mum and its friend mourn, a stranger doesn't");
      check(r.describe && /Missing Pip/.test(r.describe[0]), `magnifying glass: ${JSON.stringify(r.describe)}`);
      check(r.going && r.arrived, "she goes and sits by the tree");
      check(r.eased && r.cheered, "it comforts her and eases her grief");
      check(!r.stillMourn, "a stillborn isn't mourned at the tree");
      check(r.open, "long-press: the plaque");
      check(r.saved && r.treeSaved, "saved");
    },
  },
  {
    name: "batch8: the plushie - sleeping beside it, a fluffy grows attached; with it near, frights come less and it runs to it; apart it misses it; it passes to a foal",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        out.shop = SPAWN_ACTIONS.some((a) => a.isItem === "plushie");
        const toy = new Plushie("INDOORS");
        toy.x = 400;
        toy.y = 520;
        objects.push(toy);
        const f = __mk(420, { name: "Daisy" });
        f.currentStateKey = "SLEEPING";
        for (let t = 0; t < 4 * HOUR_LENGTH; t += 3) {
          plushieTicker.fireNext && plushieTicker.fireNext();
          updatePlushies(3);
        }
        out.owner = toy.ownerId === f.id;
        out.describe = describePlushie(f);
        f.currentStateKey = "IDLE";
        // Frights: half don't happen
        fearsOf(f);
        f.fears.thunder = 0.8;
        const real = Math.random;
        Math.random = () => 0.1;
        out.resisted = startFright(f, "thunder") === false;
        Math.random = real;
        // Nobody to run to: the plushie
        out.comforter = frightComforter(f) === toy;
        // Apart for long: misses it
        toy.scene = "BACKYARD";
        const h0 = f.happiness;
        for (let t = 0; t < 6 * HOUR_LENGTH; t += 3) {
          timePlayed += 3;
          plushieTicker.fireNext && plushieTicker.fireNext();
          updatePlushies(3);
        }
        out.missing = f._plushieMissing;
        out.sadder = f.happiness < h0;
        toy.scene = "INDOORS";
        plushieTicker.fireNext && plushieTicker.fireNext();
        updatePlushies(3);
        out.back = !f._plushieMissing;
        // Saved with its owner
        const copy = createItemFromSave(toy.serialize());
        copy.deserialize(toy.serialize());
        out.saved = copy.ownerId === f.id;
        // Its owner dies: to her youngest foal
        const foal = __mk(300, { growth: 0.2, name: "Tiny" });
        foal.motherId = f.id;
        f.die(null, "test");
        out.heir = toy.ownerId === foal.id;
        return out;
      }, SETUP);
      check(r.shop, "in the shop");
      check(r.owner, "sleeping beside it, it's its own");
      check(r.describe && /plushie/i.test(r.describe[0]), `magnifying glass: ${JSON.stringify(r.describe)}`);
      check(r.resisted, "with it near, a fright doesn't happen (half the time)");
      check(r.comforter, "nobody else about: it runs to its plushie");
      check(r.missing && r.sadder, "apart for long, it misses it");
      check(r.back, "back again: all better");
      check(r.saved, "saved with its owner");
      check(r.heir, "its owner gone, it goes to her foal");
    },
  },
  {
    name: "batch8: wise elders - a foal near an elder of its family grows braver; a frightened foal runs to an old fluffy if its mum isn't there",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const gran = __mk(300, { name: "Gran" });
        gran.age = (ELDERLY_DAYS + 2) * DAY_LENGTH;
        const mum = __mk(900, { scene: "BACKYARD", name: "Clover" });
        mum.motherId = gran.id;
        const foal = __mk(360, { growth: 0.4, name: "Pip" });
        foal.motherId = mum.id;
        for (const x of [gran, mum, foal]) recordFluffy(x);
        _kinCache && _kinCache.clear && _kinCache.clear();
        out.elder = isWiseElder(gran);
        out.related = relatedness(foal, gran);
        fearsOf(foal);
        foal.fears.dark = 0.5;
        out.describe = describeElder(foal);
        for (let t = 0; t < 5 * HOUR_LENGTH; t += 5) {
          eldersTicker.fireNext && eldersTicker.fireNext();
          updateElders(5);
        }
        out.braver = fearOf(foal, "dark");
        // Frightened, mum's in another room: runs to gran
        out.comforter = frightComforter(foal) === gran;
        // A young adult isn't an elder
        const young = __mk(500);
        young.age = 20 * DAY_LENGTH;
        out.youngElder = isWiseElder(young);
        return out;
      }, SETUP);
      check(r.elder && r.related >= 0.2, `gran is a wise elder of the family: ${JSON.stringify(r)}`);
      check(r.describe && /courage from Gran/.test(r.describe[0]), `magnifying glass: ${JSON.stringify(r.describe)}`);
      check(r.braver < 0.5 - 0.1, `near gran it grows braver: ${r.braver}`);
      check(r.comforter, "frightened, it runs to gran");
      checkEqual(r.youngElder, false, "a young grown-up isn't an elder");
    },
  },
];
