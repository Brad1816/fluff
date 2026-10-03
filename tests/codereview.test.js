// Fixes from the code review after batch 15: bugs found reading the code.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD", "ALLEY", "RIVER"]) __clearScene(s);
  __seedRandom(4242);
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
    if (opts.think !== true) h.brain.think = () => {};
    fluffies.push(h);
    return h;
  };
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
    name: "codereview: a foal that forgot its mum takes to a foster; two dead relatives don't keep it confused for ever",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(300);
        const foal = __mk(340, { growth: 0.2, mum });
        foal.motherId = mum.id;
        foalForgetsMum(foal, mum);
        const out = { forgot: foal.forgotMum === true };
        const mare = __mk(500);
        takeInFoal(mare, foal);
        out.fostered = foal.motherId === mare.id && !foal.forgotMum && !mumDisowned(foal);
        // Two dead relatives in the room
        const kid = __mk(600, { growth: 0.2 });
        const deadMum = __mk(640);
        const deadSis = __mk(680, { growth: 0.2 });
        deadMum.die(null, "Test");
        deadSis.die(null, "Test");
        const start = timePlayed;
        let still = 0;
        for (let t = 0; t < 400; t++) {
          timePlayed = start + t * 5;
          const a = foalDoesntUnderstand(kid, deadMum, "mother");
          const b = foalDoesntUnderstand(kid, deadSis, "sister");
          if (a || b) still = t * 5;
        }
        out.endsBy = still;
        out.limit = CONFUSED_TIME;
        return out;
      }, SETUP);
      check(r.forgot && r.fostered, `fostering a foal that forgot its mum gives it a new mum it knows: ${JSON.stringify(r)}`);
      check(r.endsBy > 0 && r.endsBy <= r.limit + 5, `the confusion still ends (${r.endsBy}s, limit ${r.limit}s)`);
    },
  },
  {
    name: "codereview: milking isn't a sale; the last bite of a poisoned bowl poisons; empty machine plates are plain bowls",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const m = __mk(300);
        m.lactatingTimer = 100;
        m.milkCharges = 3;
        const sold0 = dayStats.sold.count;
        const goal0 = goalsState.stats.sold;
        const money0 = money;
        out.milked = milkMare(m);
        out.notSold = dayStats.sold.count === sold0 && goalsState.stats.sold === goal0;
        out.paid = money > money0 || (typeof showDebugMenu !== "undefined" && showDebugMenu);
        // Poison in the last portion
        const f = __mk(500, { hunger: 0.3 });
        const bowl = new Bowl("bowl", "INDOORS");
        bowl.x = 505;
        bowl.y = 520;
        bowl.food = 1;
        bowl.foodType = "kibble";
        bowl.poisoned = true;
        objects.push(bowl);
        f._updateEating();
        out.ate = bowl.food === 0;
        out.poisoned = !!f.isPoisoned;
        objects.splice(objects.indexOf(bowl), 1);
        // A machine plate, emptied
        const plate = new Bowl("bowl", "INDOORS");
        plate.food = 1;
        plate.foodType = "sketties";
        plate.fromFoals = true;
        plate.foalParentId = 99;
        plate.eat();
        out.plate = !plate.fromFoals && plate.foalParentId === null && plate.lastBite.fromFoals === true;
        return out;
      }, SETUP);
      check(r.milked && r.notSold && r.paid, `milk pays but isn't counted as a fluffy sold: ${JSON.stringify(r)}`);
      check(r.ate && r.poisoned, "the last bite of a poisoned bowl still poisons");
      check(r.plate, "an emptied plate forgets it held foal sketties");
    },
  },
  {
    name: "codereview: herd jobs and raids survive fluffies leaving the herd",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        // A finder bringing food after it left the herd
        const smarty = __mk(300, { adopted: false, scene: "ALLEY" });
        const finder = __mk(340, { adopted: false, scene: "ALLEY" });
        smarty.hunger = 0.2;
        try {
          _hjGive(finder, smarty);
          out.give = true;
        } catch (e) {
          out.give = String(e);
        }
        finder.herdJob = "toughie";
        herdJobTicker.fireNext();
        updateHerdJobs(1);
        out.jobCleared = finder.herdJob === null;
        // Raiders whose herd breaks up mid-raid still leave
        const a = __mk(400, { adopted: false, scene: "ALLEY" });
        const b = __mk(440, { adopted: false, scene: "ALLEY" });
        const c = __mk(480, { adopted: false, scene: "ALLEY" });
        const h = __herd([a, b, c]);
        startYardRaid(h);
        out.in = raiders().length;
        herdState.list = herdState.list.filter((x) => x !== h);
        _herdChanged();
        out.stillRaiders = raiders().length;
        endYardRaid("left");
        out.leaving = _raidLeaving.length;
        return out;
      }, SETUP);
      checkEqual(r.give, true, "bringing food without a herd doesn't crash");
      check(r.jobCleared, "a fluffy out of a herd loses its herd job");
      check(r.in === 3 && r.stillRaiders === 3 && r.leaving === 3, `raiders leave even when their herd broke up: ${JSON.stringify(r)}`);
    },
  },
  {
    name: "codereview: making up with the stuffy isn't a misdeed; year tallies aren't recent; washing off a fake horn doesn't regrow a real one; time away ends with her coming back",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const bully = __mk(300, { growth: 0.4 });
        bully.bullyScore = 2;
        bullyMakesUpWithStuffy(bully);
        out.notMisdeed = recentMisdeed(bully) !== "bully";
        // A year-old tally
        const f = __mk(400);
        _storyAdd({ i: storyBook.nextId++, t: _stNow(), k: "tally", w: [f.id], y: 0, c: { treat: 50 } });
        out.recent = _tiRecentTally(f, 3).treat || 0;
        // Fake alicorn on a unicorn whose horn is then cut off
        const u = __mk(500, { type: "unicorn" });
        u.limbs.horn = true;
        money = Math.max(money, 1000);
        makeFakeAlicorn(u);
        u.limbs.horn = false;
        removeFakeAlicorn(u, "bath");
        out.horn = u.limbs.horn;
        out.wings = u.limbs.leftWing || u.limbs.rightWing;
        // Time away
        const m = __mk(600);
        const b = badMumOf(m);
        b.awayUntil = timePlayed - 1;
        out.notAway = !mumAway(m);
        out.untouched = typeof b.awayUntil === "number";
        m.speech = { text: "" };
        badMummahTicker.fireNext();
        updateBadMummahs(1);
        out.back = b.awayUntil === null;
        return out;
      }, SETUP);
      check(r.notMisdeed, "the stuffy isn't scolded as bullying");
      checkEqual(r.recent, 0, "a year's treats aren't counted as recent");
      check(r.horn === false && r.wings === false, `the cut-off horn stays gone: ${JSON.stringify(r)}`);
      check(r.notAway && r.untouched && r.back, `asking whether she's away doesn't end it - the ticker does: ${JSON.stringify(r)}`);
    },
  },
  {
    name: "codereview: one fluffy's update going wrong doesn't stop the others",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const bad = __mk(300);
        const good = __mk(500);
        bad.update = () => {
          throw new Error("test failure");
        };
        let ran = false;
        const real = good.update.bind(good);
        good.update = (dt) => {
          ran = true;
          return real(dt);
        };
        const ce = console.error;
        console.error = () => {};
        let threw = false;
        try {
          updateSimulation(1 / 60);
        } catch (e) {
          threw = String(e);
        }
        console.error = ce;
        fluffies.splice(fluffies.indexOf(bad), 1);
        return { ran, threw };
      }, SETUP);
      checkEqual(r.threw, false, "the step carries on");
      check(r.ran, "the other fluffy still updates");
    },
  },
  {
    name: "codereview: a sleeping fluffy doesn't get to know the room; awake ones do; tickers don't all fire together",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const a = __mk(300);
        const b = __mk(400);
        a.met = {};
        b.met = {};
        b.currentStateKey = "SLEEPING";
        const out = { sleepingKnows: haveMet(a, b) };
        meetTicker.fireNext();
        updateMeetings(1);
        out.sleepingMet = !!(a.met[b.id] || b.met[a.id]);
        b.currentStateKey = "IDLE";
        out.awakeKnows = haveMet(a, b);
        meetTicker.fireNext();
        updateMeetings(1);
        out.awakeMet = !!(a.met[b.id] && b.met[a.id]);
        // Tickers made one after another start at different points
        const t = [new Ticker(1), new Ticker(1), new Ticker(1), new Ticker(1)].map((x) => +x.left.toFixed(2));
        out.spread = new Set(t).size === 4;
        return out;
      }, SETUP);
      check(!r.sleepingKnows && !r.sleepingMet, `asleep: not met (${JSON.stringify(r)})`);
      check(r.awakeKnows && r.awakeMet, "awake: they meet");
      check(r.spread, "tickers spread out");
    },
  },
  {
    name: "codereview: thread bugs - bars stop reaching, cars hit the cage not what's in it, sensitive birth lines, tiny mess, renaming saves, fostered foals stay yours",
    run: async (page) => {
      const r = await page.evaluate(async (setup) => {
        eval(setup)();
        const out = {};
        // Bars: a mare outside can't reach a foal in an enclosure
        const enc = new Enclosure("INDOORS");
        enc.x = 700;
        enc.y = 520;
        enc.updateBounds();
        objects.push(enc);
        const mare = __mk(600);
        const foal = __mk(700, { growth: 0.2 });
        foal.currentCage = enc;
        out.reachOut = canFluffiesReachEachOther(mare, foal);
        const mate = __mk(710, { growth: 0.2 });
        mate.currentCage = enc;
        out.reachIn = canFluffiesReachEachOther(foal, mate);
        objects.splice(objects.indexOf(enc), 1);
        // Cars: a cage beside the road keeps them safe; one on the road doesn't
        cars.length = 0;
        const realScene = currentScene;
        currentScene = "ALLEY_ROAD";
        const side = new Cage("ALLEY_ROAD");
        side.x = 400;
        side.y = 330;
        side.updateBounds();
        const road = new Cage("ALLEY_ROAD");
        road.x = 900;
        road.y = 470;
        road.updateBounds();
        objects.push(side, road);
        const safe = __mk(400, { scene: "ALLEY_ROAD", growth: 0.2, y: side.getBottomY() + 60 });
        safe.currentCage = side;
        const doomed = __mk(900, { scene: "ALLEY_ROAD", y: road.getBottomY() - 5 });
        doomed.currentCage = road;
        carSpawnTimer = 999;
        const car = new Car("ALLEY_ROAD");
        car.direction = "left-to-right";
        car.x = -600;
        car.vx = 1200;
        car.y = 340;
        cars.push(car);
        for (let t = 0; t < 120; t++) {
          safe.y = side.getBottomY() + 60; // (its feet poke into the lane)
          updateSimulation(1 / 60);
        }
        out.safe = safe.isAlive;
        out.doomed = !doomed.isAlive;
        cars.length = 0;
        objects.splice(objects.indexOf(side), 1);
        objects.splice(objects.indexOf(road), 1);
        currentScene = realScene;
        // A sensitive mare in labour has her own words
        const sm = __mk(300);
        sm.isSensitive = () => true;
        out.sensitiveLine = getDialogue(sm.isSensitive() ? ["SENSITIVE", "BIRTH_PAIN"] : ["BIRTH", "PAIN"], sm);
        // A newborn's mess is a newborn's size
        const big = __mk(200);
        const tiny = __mk(260, { growth: 0 });
        out.mess = [+big.messSize().toFixed(2), +tiny.messSize().toFixed(2)];
        // Fostered by a wild mare in your room: still yours
        const wild = __mk(400, { adopted: false });
        const orphan = __mk(420, { growth: 0.1 });
        takeInFoal(wild, orphan);
        out.stillYours = orphan.adopted === true && orphan.canBeSold();
        // Renaming a save
        await saveManager.save("__ren_a__", { fluffies: [], objects: [], x: 1 });
        const realPrompt = window.prompt;
        window.prompt = () => "__ren_b__";
        await renameSave("__ren_a__");
        window.prompt = realPrompt;
        const names = await saveManager.listSaves();
        out.renamed = names.includes("__ren_b__") && !names.includes("__ren_a__");
        await saveManager.delete("__ren_b__");
        return out;
      }, SETUP);
      check(r.reachOut === false && r.reachIn === true, `bars: ${JSON.stringify(r)}`);
      check(r.safe && r.doomed, `cars hit the cage where it stands: ${JSON.stringify(r)}`);
      check(/sensitib|SENSITIB|mummah/i.test(r.sensitiveLine), `sensitive labour line: ${r.sensitiveLine}`);
      check(r.mess[1] < r.mess[0] * 0.5, `tiny mess: ${r.mess}`);
      check(r.stillYours, "a fostered foal in your room stays yours");
      check(r.renamed, "a save can be renamed");
    },
  },
];
