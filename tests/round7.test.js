// Playtest 7 and the plan round: the Foal-4-Sketties machine drawing hungry
// families while you're away, blocks in cages, shorter rest, the shelter's
// 16 kennels and playpen, growth stages, colour tiers, weaning tags, the
// mop, wet fur, diapers, the milk stand, working fluffies and surgery jobs
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD", "PARK", "ALLEY", "DAY_CARE"]) __clearScene(s);
  __seedRandom(7070);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 6 * DAY_LENGTH + 10 * HOUR_LENGTH;
  isGlobalDragging = false;
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
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "round7: a stocked Foal-4-Sketties machine draws hungry families to its place while you're away, and they wait by it; mares rest less long",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = new FoalMachine("ALLEY");
        m.x = 900;
        m.y = 500;
        objects.push(m);
        const out = { weightEmpty: machineLureWeight("ALLEY"), rest: MARE_REST_DAYS };
        m.plates = 10;
        out.weight = machineLureWeight("ALLEY");
        let plan = null;
        for (let i = 0; i < 20 && !plan; i++) plan = machineLurePlan("ALLEY");
        out.plan = plan && plan.kind;
        const before = fluffies.length;
        spawnFeralGroup("ALLEY", plan.scenario, { lure: plan });
        const fam = fluffies.slice(before);
        const mum = fam.find((f) => f.growth >= 1);
        out.n = fam.length;
        out.hungry = mum.hunger < FOAL_MACHINE_HUNGRY;
        out.near = fam.every((f) => Math.abs(f.x - m.x) < 400);
        out.herd = !!herdOf(mum) && fam.every((f) => herdOf(f) === herdOf(mum));
        out.held = heldByMachineLure(mum);
        out.noMigrate = !canMigrate(mum);
        const plan2 = herdWouldTrade(herdOf(mum), m);
        out.trade = typeof plan2 === "object" ? "would" : plan2;
        m.plates = 0;
        out.letGo = !heldByMachineLure(mum);
        return out;
      }, SETUP);
      checkEqual(r.weightEmpty, 0, "an empty machine draws nobody");
      check(r.weight > 0, "a stocked one does");
      checkEqual(r.plan, "machine", "a hungry family");
      check(r.n >= 2 && r.hungry && r.near, `a hungry mum and foals near it: ${JSON.stringify(r)}`);
      check(r.herd, "a little herd of their own");
      check(r.held && r.noMigrate, "they stay (no despawning, no wandering off)");
      checkEqual(r.trade, "would", "they'd trade");
      check(r.letGo, "once it's empty they can go");
      check(r.rest < 2, `mares rest less (${r.rest} days)`);
    },
  },
  {
    name: "round7: a caged fluffy can reach blocks on its cage floor",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const c = new Cage("INDOORS");
        c.x = 600;
        c.y = 450;
        c.updateBounds();
        objects.push(c);
        const f = __mk(600);
        f.currentCage = c;
        f.y = c.bounds.bottom - 20;
        const b = new Block(640, c.bounds.bottom - 8, "INDOORS");
        b.currentCage = c;
        objects.push(b);
        f.x = 620;
        return { reach: f.positioning.canReachBlock(b), near: f.actionHandler._nearBlock(b) };
      }, SETUP);
      check(r.reach, "it can reach the block");
      check(r.near, "close enough to pick it up");
    },
  },
  {
    name: "round7: the shelter has 16 kennels and a playpen of foals you can adopt by tapping",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        for (let i = fluffies.length - 1; i >= 0; i--) if (fluffies[i].shelterFoal) fluffies.splice(i, 1);
        for (let i = objects.length - 1; i >= 0; i--) if (objects[i] instanceof ShelterPlaypen) objects.splice(i, 1);
        const rects = shelterCageRects();
        let overlap = false;
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlap = true;
        }
        updateShelter(2);
        const foals = shelterPenFoals();
        const pen = shelterPen();
        const out = { kennels: rects.length, overlap, onScreen: rects.every((c) => c.x >= 0 && c.x + c.w <= width), foals: foals.length, inPen: foals.every((f) => f.currentCage === pen), locked: foals.every((f) => Cage.locksItem(f)), penPick: itemCanBePickedUpAt(pen, pen.x, pen.y) };
        // Tap one
        currentScene = "DAY_CARE";
        const f = foals[0];
        let tapped = null;
        for (let dy = 0; dy < 50 && !tapped; dy += 2) tapped = shelterPenFoalAt(f.x, f.y - dy);
        out.tapped = !!tapped;
        money = 500;
        const showDebug = showDebugMenu;
        showDebugMenu = false;
        const got = adoptShelterPenFoal(f);
        showDebugMenu = showDebug;
        out.adopted = !!got && f.adopted && !f.currentCage && !f.shelterFoal && !!fluffyNames[f.id] && money === 500 - SHELTER_PEN_FEE;
        // The next morning: a grown one finds a home, and the pen fills up again
        const g = shelterPenFoals()[0];
        g.growth = 0.7;
        refillShelterPen();
        out.after = shelterPenFoals().length;
        out.goneGrown = !fluffies.includes(g);
        currentScene = "INDOORS";
        return out;
      }, SETUP);
      checkEqual(r.kennels, 16, "sixteen kennels");
      check(!r.overlap && r.onScreen, "none overlapping, all on screen");
      checkEqual(r.foals, 3, "three foals in the playpen");
      check(r.inPen && r.locked, "in the pen; you can't just pick them up");
      check(!r.penPick, "the pen stays put");
      check(r.tapped, "a tap finds the foal");
      check(r.adopted, "adopted: yours, out of the pen, named, paid");
      checkEqual(r.after, 3, "the pen fills again");
      check(r.goneGrown, "a grown one found a home");
    },
  },
  {
    name: "round7: growth stages, colour tiers (price, orders, the reptile shop) and weaning tags",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const stages = [0.1, 0.2, 0.6, 1].map((g) => growthStage(__mk(300, { growth: g })));
        const f = __mk(400);
        const p0 = f.calculatePrice();
        const t = colourTier(f);
        const out = { stages, tierOk: [1, 2, 3, 4].includes(t), describe: describeColourTier(f)[0] };
        // Tiers follow the coat score
        const real = f.genetics.calculateColorismPerception;
        const at = (p) => {
          f.genetics.calculateColorismPerception = () => p;
          return colourTier(f);
        };
        out.tiers = [at(0.9), at(0.75), at(0.5), at(0.2)];
        f.genetics.calculateColorismPerception = real;
        // Weaning tags
        const foal = __mk(500, { growth: 0.5 });
        out.canTag = canWeanTag(foal);
        out.test = weanTest(foal);
        const before = foal.calculatePrice();
        setWeanTag(foal, "feed");
        out.cheaper = foal.calculatePrice() < before;
        out.tagged = foal.weanTag === "feed" && !canWeanTag(foal);
        out.inMenu = rightClickActions(__mk(560, { growth: 0.5 })).some((a) => a.key === "wean_tag");
        // The reptile shop wants feed stock
        const rep = getBuyerKind("reptile");
        out.reptile = rep.id === "reptile" && rep.weight() > 0 && buyerLikes(rep, foal) > 0.9 && buyerLikes(rep, __mk(600, { growth: 1 })) < 0.5;
        // Orders know tiers
        const label = ORDER_REQUIREMENTS.coat.label({ tier: 1 });
        out.order = /tier 1/i.test(label) && ORDER_REQUIREMENTS.coat.matches({ tier: 1 }, f) === (colourTier(f) === 1);
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.stages), JSON.stringify(["Chirpy", "Talkie", "Walkie", "Adult"]), "stages");
      checkEqual(JSON.stringify(r.tiers), JSON.stringify([1, 2, 3, 4]), "tiers by coat");
      check(r.tierOk && /Tier/.test(r.describe), "shown");
      check(r.canTag && ["breeder", "pet", "feed"].includes(r.test), `a weaned foal can be tagged (test: ${r.test})`);
      check(r.tagged && r.cheaper, "feed: cheaper, for good");
      check(r.inMenu, "in the right-click menu");
      check(r.reptile, "the reptile shop comes for feed stock");
      check(r.order, "orders ask for tiers");
    },
  },
  {
    name: "round7: the mop cleans a wide patch and never bathes anyone; a bath leaves a fluffy wet - towelled, dried or pegged",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        puddles.length = 0;
        addPointToPuddle("INDOORS", 500, 520, "poop", 0.3, 0.3);
        addPointToPuddle("INDOORS", 550, 525, "pee", 0.3, 0.3);
        addPointToPuddle("INDOORS", 900, 520, "poop", 0.3, 0.3);
        const f = __mk(520);
        f.dirt = 0.5;
        const mop = new Mop("INDOORS");
        mop.x = 520;
        mop.y = 520;
        for (let i = 0; i < 4; i++) mopClean(mop);
        const left = puddles.reduce((n, p) => n + p.points.filter((pt) => pt.scene !== "x").length, 0);
        const out = { left, dirt: f.dirt, tool: isToolObject(mop), shop: SPAWN_ACTIONS.some((a) => a.isItem === "mop") };
        // Wet
        const e0 = warmthExposure(f);
        scrubFluffy(f);
        out.wet = f.wet;
        out.colder = warmthExposure(f) > e0;
        out.menu = rightClickActions(f).some((a) => a.key === "dry");
        towelFluffy(f);
        out.towelled = f.wet < 0.5;
        f.wet = 1;
        for (let i = 0; i < 400; i++) updateWetFur(1);
        out.dried = f.wet === 0;
        f.wet = 1;
        const fear = f.playerFear || 0;
        pegFluffy(f);
        out.pegged = !!f._pegged && (f.playerFear || 0) > fear && (f.playerMemories || []).some((m) => m.type === "pegged");
        return out;
      }, SETUP);
      checkEqual(r.left, 1, "the two under the mop gone, the far one left");
      checkEqual(r.dirt, 0.5, "nobody bathed");
      check(r.tool && r.shop, "a tool in the shop");
      checkEqual(r.wet, 1, "soaked after a bath");
      check(r.colder, "the cold bites harder");
      check(r.menu && r.towelled, "towel it from the menu");
      check(r.dried, "dries by itself");
      check(r.pegged, "pegged: frightened, and it remembers");
    },
  },
  {
    name: "round7: diapers catch the mess until they're full, slow it down, and get changed",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        puddles.length = 0;
        const f = __mk(500);
        const pack = new Diapers("INDOORS");
        toolbox.push(pack);
        const out = { put: putOnDiaper(f, pack), charges: pack.charges };
        f.updateSpeed && f.updateSpeed();
        const slow = diaperSpeed(f);
        f.poopStorage = 0.6;
        f.excrete("poop", 0.6);
        out.noPuddle = puddles.every((p) => p.points.length === 0);
        out.fill = diaperFill(f);
        for (let i = 0; i < 6; i++) f.excrete("poop", 0.6);
        out.full = diaperFill(f) >= 1;
        out.leaked = puddles.some((p) => p.points.length > 0);
        out.slow = slow < 1;
        out.changeMenu = rightClickActions(f).some((a) => a.key === "change_diaper");
        out.changed = putOnDiaper(f) && diaperFill(f) === 0 && pack.charges === out.charges - 1;
        out.off = takeOffDiaper(f) && !wearsDiaper(f);
        toolbox.splice(toolbox.indexOf(pack), 1);
        return out;
      }, SETUP);
      check(r.put, "put on");
      check(r.noPuddle && r.fill > 0, "no puddle - it's in the diaper");
      check(r.full && r.leaked, "full: it leaks");
      check(r.slow, "it waddles");
      check(r.changeMenu && r.changed, "changed from the menu (one from the pack)");
      check(r.off, "taken off");
    },
  },
  {
    name: "round7: a mare on the milk stand feeds any foal, can't refuse, is fed from its trough and hates it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const stand = new MilkStand("INDOORS");
        stand.x = 600;
        stand.y = 500;
        objects.push(stand);
        stand.update(0.01);
        const stallion = __mk(stand.x, { gender: "male", y: stand.y });
        stallion.onDrop();
        const out = { stallionOff: stallion.placedOn !== stand };
        const mare = __mk(stand.x, { y: stand.y });
        mare.onDrop();
        out.on = mare.placedOn === stand && onMilkStand(mare);
        mare.hunger = 0.6;
        const happy = mare.happiness;
        for (let i = 0; i < 30; i++) updateMilkStands(1);
        out.lactating = mare.lactatingTimer > 0 && mare.milkCharges > 0;
        out.ate = stand.trough < MILK_STAND_TROUGH;
        out.sadder = mare.happiness < happy;
        // Someone else's foal - an alicorn even - drinks
        const foal = __mk(stand.x + 30, { growth: 0.1, type: "alicorn", y: stand.y + 20 });
        foal.hunger = 0.2;
        out.drank = foal.attemptFeedFromMare(mare) && foal.hunger === 1;
        out.fill = fillMilkStand(stand) && stand.trough === MILK_STAND_TROUGH;
        out.shop = SPAWN_ACTIONS.some((a) => a.isItem === "milk_stand") && getItemType(stand).sellType === "milk_stand";
        return out;
      }, SETUP);
      check(r.stallionOff, "only mares go on");
      check(r.on, "strapped on");
      check(r.lactating && r.ate, "kept in milk, fed from the trough");
      check(r.sadder, "she hates it");
      check(r.drank, "any foal drinks, no refusing");
      check(r.fill && r.shop, "refill it; in the shop");
    },
  },
  {
    name: "round7: working fluffies - a cleaner tidies mess, a foal-sitter comforts a frightened foal, and they learn by doing",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        puddles.length = 0;
        const w = __mk(400);
        const out = { can: canHaveJob(w), menu: rightClickActions(w).some((a) => a.key === "job") };
        setJob(w, "cleaner");
        addPointToPuddle("INDOORS", 450, 525, "poop", 0.3, 0.3);
        const task = findJobTask(w);
        out.found = !!task && task.kind === "cleaner";
        const size = task.pt.scale;
        __seedRandom(1);
        doJobTask(w, task);
        out.cleaned = !puddles[0].points.includes(task.pt) || task.pt.scale < size;
        out.learnt = jobSkill(w) > 0;
        // Foal-sitter
        const s = __mk(700);
        setJob(s, "sitter");
        const k = __mk(760, { growth: 0.2 });
        k.fright = { key: "thunder", until: timePlayed + 30 };
        const t2 = findJobTask(s);
        out.sitTask = !!t2 && t2.foalId === k.id;
        s.job.skill = 1;
        doJobTask(s, t2);
        out.comforted = !isFrightened(k);
        const p0 = s.calculatePrice();
        s.job.skill = 0.5;
        out.trainedWorth = p0 > s.calculatePrice();
        return out;
      }, SETUP);
      check(r.can && r.menu, "a grown, clever enough fluffy can have a job");
      check(r.found && r.cleaned && r.learnt, "the cleaner finds and tidies mess, and learns");
      check(r.sitTask && r.comforted, "the sitter comforts the frightened foal");
      check(r.trainedWorth, "a trained worker is worth more");
    },
  },
  {
    name: "round7: surgery jobs - a client's fluffy dropped off, paid for a clean job, a botch costs your name, late means no pay",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        surgeryJobs = freshSurgeryJobs();
        const table = new OperatingTable("INDOORS");
        objects.push(table);
        const out = { table: hasOperatingTable() };
        // A clean neuter
        let f = acceptSurgeryJob({ id: 1, kind: "lumps", client: "Dana", pet: "Buttons", gender: "male", pay: 120 });
        out.client = !!f && !f.adopted && f.clientJob && fluffyNames[f.id] === "Buttons" && f.gender === "male";
        const m0 = money;
        f.limbs.lumps = null;
        f.bleedingTimer = 0;
        surgeryJobTicker.fireNext();
        updateSurgeryJobs(2);
        out.paid = money - m0;
        out.gone = !fluffies.includes(f) && !surgeryJobs.active;
        // A botch: an ear off as well
        const rep0 = customerOrders.reputation;
        f = acceptSurgeryJob({ id: 2, kind: "tail", client: "Priya", pet: "Mopsy", gender: "female", pay: 90 });
        f.limbs.tail = null;
        f.limbs.leftEar = null;
        f.bleedingTimer = 0;
        surgeryJobTicker.fireNext();
        updateSurgeryJobs(2);
        out.botched = customerOrders.reputation < rep0 || rep0 === 0;
        out.botchCount = surgeryJobs.botched;
        // Late
        f = acceptSurgeryJob({ id: 3, kind: "spay", client: "Mrs. Pell", pet: "Rosie", gender: "female", pay: 160 });
        const m1 = money;
        timePlayed += 3 * DAY_LENGTH;
        surgeryJobTicker.fireNext();
        updateSurgeryJobs(2);
        out.late = !surgeryJobs.active && money === m1 && !fluffies.includes(f);
        objects.splice(objects.indexOf(table), 1);
        return out;
      }, SETUP);
      check(r.table, "with an operating table");
      check(r.client, "the client's fluffy, named, not yours");
      checkEqual(r.paid, 120, "paid in full for a clean job on a healthy fluffy");
      check(r.gone, "collected");
      check(r.botched && r.botchCount === 1, "the botch counted against you");
      check(r.late, "late: collected, no pay");
    },
  },
];
