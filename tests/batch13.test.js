// Batch 13 (plan batch 3, herds): herd jobs, whole-herd raids, luring strays,
// and the Foal-4-Sketties machine.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD", "ALLEY", "RIVER"]) __clearScene(s);
  __seedRandom(1313);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 6 * DAY_LENGTH + 10 * HOUR_LENGTH;
  herdState = freshHerdState();
  _herdChanged();
  raidState = freshRaidState();
  _raidLeaving = [];
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 520;
    h.hunger = opts.hunger ?? 1;
    h.health = 100;
    h.happiness = 0.7;
    h.coloristDegree = 0;
    h.currentStateKey = "IDLE";
    if (opts.traits) h.traitShift = { ...opts.traits };
    if (opts.think !== true) h.brain.think = () => {};
    if (opts.name) fluffyNames[h.id] = opts.name;
    fluffies.push(h);
    return h;
  };
  // A herd of these (they all like each other)
  window.__herd = (list, leader = list[0]) => {
    for (const a of list) for (const b of list) if (a !== b) { meet(a, b); changeOpinion(a, b, 0.9, "test"); }
    const h = { id: herdState.nextId++, name: "Test", leaderId: leader.id, memberIds: list.map((f) => f.id), colorIndex: 0, formedAt: timePlayed };
    herdState.list.push(h);
    _herdChanged();
    return h;
  };
}`;

module.exports = [
  {
    name: "batch13: herd jobs - brave grumpy earthies are toughies, lively ones food-finders, nursing mums none; toughies fight wars and guard first",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const lead = __mk(300, { name: "Lead", gender: "male" });
        const tough = __mk(340, { name: "Tough", traits: { bravery: 1, temper: 0.6 } });
        const tough2 = __mk(360, { name: "Tough2", traits: { bravery: 0.8, temper: 0.5 } });
        const lively = __mk(380, { name: "Lively", type: "pegasus", traits: { energy: 1, social: 0.6, bravery: -0.6 } });
        const timid = __mk(400, { name: "Timid", type: "pegasus", traits: { bravery: -0.4, energy: -0.6, temper: -0.6 } });
        const mum = __mk(420, { name: "Mum", traits: { bravery: 1 } });
        const foal = __mk(430, { growth: 0.2, mum: mum.id });
        const x1 = __mk(440, { type: "pegasus", traits: { bravery: -1, temper: -1, energy: -1, social: -1 } });
        const x2 = __mk(450, { type: "pegasus", traits: { bravery: -1, temper: -1, energy: -1, social: -1 } });
        const h = __herd([lead, tough, tough2, lively, timid, mum, x1, x2]);
        assignHerdJobs(h);
        return {
          jobs: { lead: lead.herdJob, tough: tough.herdJob, tough2: tough2.herdJob, lively: lively.herdJob, mum: mum.herdJob },
          row: JSON.stringify(describeHerdJob(tough)),
          label: herdJobLabel(lively),
          toughFights: herdWarFights(tough, h, "INDOORS"),
          timidOut: !herdWarFights(timid, h, "INDOORS"),
          bonus: herdWarHitBonus(tough) > 0,
          rank: defenderRank(tough) < defenderRank(timid),
        };
      }, SETUP);
      checkEqual(JSON.stringify(r.jobs), JSON.stringify({ lead: "leader", tough: "toughie", tough2: "toughie", lively: "finder", mum: null }), "jobs");
      check(/Toughie/.test(r.row) && r.label === "Nummy finder", `magnifying glass and map: ${r.row} ${r.label}`);
      check(r.toughFights && r.timidOut && r.bonus && r.rank, `wars and guarding: ${JSON.stringify(r)}`);
    },
  },
  {
    name: "batch13: a food-finder fetches a bite and brings it to a hungry nursing mum; a bad smarty's toughie keeps a resentful member in line",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const lead = __mk(300, { name: "Lead", gender: "male" });
        const tough = __mk(340, { traits: { bravery: 1, temper: 0.6 } });
        const finder = __mk(380, { type: "pegasus", traits: { energy: 1, social: 0.6, bravery: -0.8 } });
        const other = __mk(400, { type: "pegasus", traits: { bravery: -0.8 } });
        const mum = __mk(600, { hunger: 0.2 });
        __mk(610, { growth: 0.2, mum: mum.id });
        const h = __herd([lead, tough, finder, other, mum]);
        const bowl = new Bowl("bowl", "INDOORS");
        bowl.x = 450;
        bowl.y = 520;
        bowl.fill(5, "kibble");
        objects.push(bowl);
        assignHerdJobs(h);
        _hjFind(h, finder);
        const out = { task: finder._herdTask && finder._herdTask.kind };
        const d = new HerdJobDesire();
        finder.x = 450;
        d.execute(finder);
        out.bring = finder._herdTask && finder._herdTask.kind;
        finder.x = 600;
        d.execute(finder);
        out.fed = mum.hunger > 0.5;
        // A bad smarty leader: a resentful member gets shoved into line
        lead.personalities = [...lead.personalities, "smarty"];
        lead.smartyKind = "bad";
        changeOpinion(other, lead, -2, "test");
        tough._herdTask = null;
        tough._enforcedAt = undefined;
        _hjEnforce(h, lead);
        out.enforce = tough._herdTask && tough._herdTask.kind;
        tough.x = other.x + 10;
        d.execute(tough);
        out.kept = keptInLine(other);
        out.keptRow = JSON.stringify(describeHerdJob(other));
        objects.splice(objects.indexOf(bowl), 1);
        return out;
      }, SETUP);
      checkEqual(r.task, "fetch", "the finder goes for food");
      checkEqual(r.bring, "bring", "then carries it");
      check(r.fed, "the hungry nursing mum is fed");
      checkEqual(r.enforce, "enforce", "a bad smarty's toughie goes after a resentful member");
      check(r.kept && /kept in line/.test(r.keptRow), `kept in line: ${r.keptRow}`);
    },
  },
  {
    name: "batch13: a toughie goes for anyone who hurts the herd's foal",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const lead = __mk(300);
        const tough = __mk(340, { traits: { bravery: 1, temper: 0.6 } });
        const c = __mk(360);
        const mum = __mk(380);
        const foal = __mk(400, { growth: 0.5, mum: mum.id });
        const h = __herd([lead, tough, c, mum, foal]);
        assignHerdJobs(h);
        const stranger = __mk(420, { gender: "male" });
        const real = Math.random;
        Math.random = () => 0.1;
        stranger.performAttack(foal, "GRUDGE");
        Math.random = real;
        return { task: tough._herdTask && tough._herdTask.kind, target: tough._herdTask && tough._herdTask.id === stranger.id };
      }, SETUP);
      check(r.task === "defend" && r.target, `defends the foal: ${JSON.stringify(r)}`);
    },
  },
  {
    name: "batch13: raids - only with lures out and a weak fence; they come in, fight your fluffies, claim the yard; the chip chases them off to the river; saved",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        backyardFenceTier = 0;
        backyardFenceBroken = false;
        const real = Math.random;
        Math.random = () => 0.0001;
        updateRaids(2);
        out.noLuresNoRaid = !raidActive();
        const bowl = new Bowl("bowl", "BACKYARD");
        bowl.x = 500;
        bowl.y = 500;
        bowl.fill(5, "kibble");
        objects.push(bowl);
        backyardFenceTier = 2;
        updateRaids(2);
        out.fenceKeepsOut = !raidActive();
        backyardFenceTier = 0;
        updateRaids(2);
        Math.random = real;
        out.started = raidActive();
        const R = raiders();
        for (const f of R) f.traitShift = { bravery: 0.5 }; // (raiders with some fight in them)
        out.inYard = R.length >= 4 && R.every((f) => f.scene === "BACKYARD" && !f.adopted);
        const lead = getHerdLeader(herdOf(R[0]));
        out.badLeader = !!(lead && lead.isSmarty());
        out.row = JSON.stringify(describeRaid(R[1]));
        // Your brave fluffy fights them
        const mine = __mk(520, { scene: "BACKYARD", traits: { bravery: 1 } });
        updateRaids(2);
        out.fighting = !!mine._raidTarget;
        // Nobody stands up: they claim it
        mine.health = 10;
        for (let t = 0; t < RAID_CLAIM + 4; t += 2) updateRaids(2);
        out.claimed = !!(raidState.active && raidState.active.claimedAt);
        out.dbg = JSON.stringify({ active: raidState.active, n: raiders().length });
        out.saved = JSON.stringify(buildSaveData(null)).includes('"raidState"');
        // The chip
        currentScene = "BACKYARD";
        const ch = raidChip() || { x: -99, y: -99 };
        mouse.x = ch.x + 5;
        mouse.y = ch.y + 5;
        out.chased = raidChipClick();
        out.over = !raidActive();
        timePlayed += RAID_LEAVE_TIME + 1;
        updateRaids(2);
        out.gone = R.every((f) => f.scene !== "BACKYARD");
        currentScene = "INDOORS";
        objects.splice(objects.indexOf(bowl), 1);
        return out;
      }, SETUP);
      check(r.noLuresNoRaid, "no lures, no raid");
      check(r.fenceKeepsOut, "the best fence keeps them out");
      check(r.started && r.inYard, `a herd raids the backyard: ${JSON.stringify(r)}`);
      check(r.badLeader, "led by a bad smarty");
      check(/Raiding/.test(r.row), `magnifying glass: ${r.row}`);
      check(r.fighting, "your brave fluffy fights them");
      check(r.claimed, `unopposed, they claim the yard ${r.dbg}`);
      check(r.saved, "saved");
      check(r.chased && r.over && r.gone, "the chip chases them off, out of the backyard");
    },
  },
  {
    name: "batch13: lures - what you leave out draws strays and decides who: greedy for sketties, foals for a stuffy, a tame lost pet for good kibble",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        out.none = lureItemsIn("OUTDOORS").length === 0 && lureSpawnWeight("OUTDOORS") === 0;
        const bowl = new Bowl("bowl", "OUTDOORS");
        bowl.x = 400;
        bowl.y = 500;
        bowl.fill(5, "sketties");
        objects.push(bowl);
        const toy = new Plushie("ALLEY");
        toy.x = 400;
        toy.y = 500;
        objects.push(toy);
        out.kinds = [lureItemsIn("OUTDOORS")[0].kind, lureItemsIn("ALLEY")[0].kind];
        out.weight = lureSpawnWeight("OUTDOORS") > 0 && lureSoonerFactor() > 1;
        const real = Math.random;
        Math.random = () => 0.1;
        const plan = lureSpawnPlan("OUTDOORS");
        const plan2 = lureSpawnPlan("ALLEY");
        Math.random = real;
        out.plans = [plan.kind, plan.scenario, plan2.kind, plan2.scenario];
        const n0 = fluffies.length;
        spawnFeralGroup("OUTDOORS", plan.scenario, { lure: plan });
        const greedy = fluffies.slice(n0).find((f) => f.growth >= 1);
        out.greedy = (greedy.traitShift || {}).appetite > 0 && greedy.luredBy === "sketties";
        out.row = JSON.stringify(describeLured(greedy));
        // Good kibble: a lost pet
        bowl.food = 0;
        bowl.foodType = null;
        bowl.fill(5, "premium_kibble");
        const p3 = lureSpawnPlan("OUTDOORS");
        const n1 = fluffies.length;
        spawnFeralGroup("OUTDOORS", p3.scenario, { lure: p3 });
        const pet = fluffies.slice(n1)[0];
        out.pet = pet && pet.lostPet === true && pet.playerTrust >= 0.6;
        objects.splice(objects.indexOf(bowl), 1);
        objects.splice(objects.indexOf(toy), 1);
        return out;
      }, SETUP);
      check(r.none, "nothing out, nothing drawn");
      checkEqual(JSON.stringify(r.kinds), JSON.stringify(["sketties", "stuffy"]), "lures");
      check(r.weight, "lures draw strays there, and sooner");
      check(r.plans[0] === "sketties" && ["lone", "couple"].includes(r.plans[1]) && r.plans[2] === "stuffy" && ["abandoned_baby", "single_mom"].includes(r.plans[3]), `who comes: ${JSON.stringify(r.plans)}`);
      check(r.greedy && /sketties/.test(r.row), `a greedy stray: ${r.row}`);
      check(r.pet, "good kibble draws a tame lost pet");
    },
  },
  {
    name: "batch13: the Foal-4-Sketties machine - a hungry herd trades a foal; it dies inside, a plate comes out; witnesses fear it; good smarties refuse; realising what the sketties are",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        out.shop = SPAWN_ACTIONS.some((a) => a.isItem === "foal_machine") && getStoreAisles().find((a) => a.id === "hardware").actions.some((a) => a.isItem === "foal_machine");
        const m = new FoalMachine("ALLEY");
        m.setPosition(700, 520);
        objects.push(m);
        const before = money;
        stockFoalMachine(m);
        out.stocked = m.plates === FOAL_MACHINE_STOCK && money === before - FOAL_MACHINE_STOCK_COST;
        const lead = __mk(400, { scene: "ALLEY", adopted: false, gender: "male", hunger: 0.2 });
        const mum = __mk(440, { scene: "ALLEY", adopted: false, hunger: 0.2, name: "Mum" });
        const c = __mk(480, { scene: "ALLEY", adopted: false, hunger: 0.2 });
        const foal = __mk(460, { scene: "ALLEY", adopted: false, growth: 0.3, mum: mum.id });
        const runt = __mk(470, { scene: "ALLEY", adopted: false, growth: 0.3, mum: mum.id });
        makeRunt(runt);
        const witness = __mk(650, { scene: "ALLEY", adopted: false, hunger: 0.2 });
        const h = __herd([lead, mum, c, foal, runt, witness]);
        // A good smarty never trades
        lead.personalities = [...lead.personalities, "smarty"];
        lead.smartyKind = "good";
        out.goodRefuses = herdWouldTrade(h, m) === "good leader";
        lead.smartyKind = "bad";
        const plan = herdWouldTrade(h, m);
        out.plan = typeof plan === "object" && plan.foal === runt && plan.parent === mum && plan.forced;
        startFoalTrade(m, h, plan);
        const d = new FoalTradeDesire();
        out.desire = d.evaluate(mum) === 75;
        mum.x = runt.x;
        mum.y = runt.y;
        d.execute(mum);
        out.carrying = m.trade && m.trade.phase === "bring";
        mum.x = m.x - 45;
        mum.y = m.y + 10;
        d.execute(mum);
        out.killed = !runt.isAlive && runt.isDestroyed && /Foal-4-Sketties/.test(runt.causeOfDeath);
        out.count = [m.taken, m.plates];
        const plate = objects.find((o) => o instanceof Bowl && o.fromFoals);
        out.plate = !!plate && plate.foodType === "sketties" && plate.food === FOAL_MACHINE_PLATE;
        out.parentFear = machineFearOf(mum) > 0.5 && mum.lostFoalAt === timePlayed;
        out.witnessFear = machineFearOf(witness) > 0.2;
        out.row = JSON.stringify(describeFoalMachine(mum));
        // Afraid now: they won't come back unless starving
        h._f4sAt = undefined;
        for (const f of [lead, c]) f.machineFear = 0.9;
        out.afraid = herdWouldTrade(h, m) === "afraid";
        // The sketties: the parent realises
        const real = Math.random;
        Math.random = () => 0.1;
        const acc = mum.cannibalismAcceptance || 0;
        const res = onFoalSkettiesEaten(mum, plate);
        Math.random = real;
        out.realised = res === "realised" && mum.refusesMachine && (mum.cannibalismAcceptance || 0) > acc;
        out.refuses = refusesFoalSketties(mum, plate);
        out.told = machineFearOf(c) >= 0.9;
        // One used to eating fluffy doesn't care
        c.cannibalismAcceptance = 0.9;
        c.machineFear = 0.5;
        Math.random = () => 0.01;
        out.dontCare = onFoalSkettiesEaten(c, { foalParentId: null }) === "doesn't care";
        Math.random = real;
        out.saved = JSON.stringify(m.serialize()).includes('"plates"') && JSON.stringify(plate.serialize()).includes('"fromFoals":true');
        objects.splice(objects.indexOf(m), 1);
        objects.splice(objects.indexOf(plate), 1);
        return out;
      }, SETUP);
      check(r.shop && r.stocked, "in the Hardware aisle; stocked for $60");
      check(r.goodRefuses, "a good smarty never trades");
      check(r.plan, "the herd picks the runt; its mum carries it, forced by the bad smarty");
      check(r.desire && r.carrying, "she fetches it and carries it");
      check(r.killed, "it dies inside the machine");
      checkEqual(JSON.stringify(r.count), JSON.stringify([1, 9]), "one taken, one plate used");
      check(r.plate, "a plate of sketties comes out");
      check(r.parentFear && r.witnessFear, `the parent and witnesses fear it: ${r.row}`);
      check(r.afraid, "a frightened herd won't come back unless starving");
      check(r.realised && r.refuses && r.told, "the parent realises, refuses the sketties, tells the herd");
      check(r.dontCare, "one used to eating fluffy doesn't care");
      check(r.saved, "saved");
    },
  },
  {
    name: "batch13: Help covers herd jobs, raids, lures and the machine",
    run: async (page) => {
      const help = await page.evaluate(() => HELP_TOPICS.map((t) => t.lines.join(" ")).join(" "));
      check(/Herd jobs/.test(help) && /raids/.test(help) && /Foal-4-Sketties/.test(help) && /stuffy or toys draw foals/.test(help), "Help");
    },
  },
];
