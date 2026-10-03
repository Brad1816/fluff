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
];
