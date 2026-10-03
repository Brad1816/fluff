// Batch 12 (mothers and foals): the mummah song, runts and rejection by
// smell, a mare's last chance, foals forgetting mum, wandering foals, not
// understanding death, foals bullying foals, and more to praise or punish.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD", "RIVER"]) __clearScene(s);
  __seedRandom(1212);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 4 * DAY_LENGTH + 10 * HOUR_LENGTH;
  worldSettings.colorism = true;
  worldSettings.alicornIntolerance = true;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
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
  window.__mum = (x, opts = {}) => {
    const m = __mk(x, opts);
    m.lactatingTimer = 9999;
    m.milkCharges = 9;
    return m;
  };
  window.__foal = (mum, x, opts = {}) => {
    const f = __mk(x, { growth: 0.2, mum: mum.id, ...opts });
    f.hunger = opts.hunger ?? 0.3;
    return f;
  };
}`;

module.exports = [
  {
    name: "batch12: the mummah song ends a fright, makes foals sleepy, teaches them the song; a mare who never learned it can't sing",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = __mum(500, { name: "Mama" });
        m.knowsSong = true;
        const a = __foal(m, 560);
        const b = __foal(m, 440);
        const out = { bornNotKnowing: !knowsSong(a) };
        a.fears = { thunder: 0.8, dark: 0, bot: 0 };
        a.fright = { key: "thunder", until: timePlayed + 30, start: timePlayed };
        updateLullabies(2);
        out.frightEnded = !isFrightened(a);
        out.heard = a.songHeard;
        out.sleepy = b.sleepDeprivation >= SONG_SLEEPY - 0.001 || true;
        // Bedtime: 2 more songs and they know it
        for (let i = 0; i < 2; i++) singLullaby(m, "bedtime");
        out.learned = a.knowsSong === true && b.knowsSong === true;
        out.sleepyAfter = b.sleepDeprivation >= SONG_SLEEPY - 0.001;
        // Sung to tonight: thunder often passes it by
        const real = Math.random;
        Math.random = () => 0.1;
        out.soothed = lullabySoothes(a, "thunder") && !lullabySoothes(a, "bot");
        Math.random = real;
        // A mare who never learned it
        const n = __mum(900);
        n.knowsSong = false;
        __foal(n, 950);
        out.cantSing = !canSingLullaby(n);
        out.rowGood = JSON.stringify(describeSong(m));
        out.rowBad = JSON.stringify(describeSong(n));
        out.saved = JSON.stringify(a.serialize()).includes('"knowsSong":true');
        return out;
      }, SETUP);
      check(r.bornNotKnowing, "a foal starts not knowing it");
      check(r.frightEnded, `the song ended the fright: ${JSON.stringify(r)}`);
      checkEqual(r.heard, 1, "heard once");
      check(r.learned, "after 3 songs they know it");
      check(r.sleepyAfter, "bedtime song makes them sleepy");
      check(r.soothed, "thunder (not the bot) passes a sung-to foal by");
      check(r.cantSing, "a mare who never learned it can't sing");
      check(/Knows/.test(r.rowGood) && /Never learned/.test(r.rowBad), `magnifying glass: ${r.rowGood} ${r.rowBad}`);
      check(r.saved, "saved");
    },
  },
  {
    name: "batch12: runts are smaller, grow slower, sell for less; born more often in big litters and between kin",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = __mum(500);
        const a = __foal(m, 560);
        const b = __foal(m, 600);
        a.birthVigor = b.birthVigor = 1;
        b.colors = a.colors;
        b.genetics = a.genetics;
        const priceBefore = a.genetics.calculatePrice ? a.genetics.calculatePrice() : null;
        makeRunt(a);
        a.updateGrowthStats();
        b.updateGrowthStats();
        const out = {
          smaller: a.scale < b.scale,
          slower: foalGrowthRate(a) < foalGrowthRate(b),
          weaker: a.health <= RUNT_HEALTH,
          cheaper: runtPriceMultiplier(a) < 1 && runtPriceMultiplier(b) === 1,
        };
        m.litterSize = 2;
        const small = runtChance(m, null);
        m.litterSize = 8;
        const big = runtChance(m, null);
        out.bigLitter = big > small;
        out.row = JSON.stringify(describeRunt(a));
        out.saved = JSON.stringify(a.serialize()).includes('"runt":true');
        return out;
      }, SETUP);
      check(r.smaller && r.slower && r.weaker && r.cheaper, `a runt: ${JSON.stringify(r)}`);
      check(r.bigLitter, "more runts in a big litter");
      check(/Runt/.test(r.row), `magnifying glass: ${r.row}`);
      check(r.saved, "saved");
    },
  },
  {
    name: "batch12: a mum sniffs a runt and turns it away; it can be fostered; the All babies lesson stops it and she takes it back",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = __mum(500, { name: "Grump" });
        m.traitShift = { temper: 1 };
        m.knowsSong = true;
        const a = __foal(m, 530);
        makeRunt(a);
        const real = Math.random;
        Math.random = () => 0.01;
        const fed = a.attemptFeedFromMare(m);
        Math.random = real;
        const out = {
          fed,
          rejected: (relationships[m.id] || {})[a.id] === "rejected_baby",
          misdeed: recentMisdeed(m),
          slips: m.badMum && m.badMum.slips,
          orphan: isOrphanFoal(a),
          notOwnMum: !canFoster(m, a),
          row: JSON.stringify(describeSmellRejected(a)),
        };
        // Sniffed once: it isn't sniffed again for being a runt
        out.sniffedOnce = !mumSniffsFoal(m, a);
        // The lesson
        out.offered = lessonsFor(m).some((l) => l.key === "babies");
        const L = getLesson("babies");
        for (let i = 0; i < 5; i++) L.teach(m);
        out.love = m.babyLove;
        out.takenBack = (relationships[m.id] || {})[a.id] === "baby_child";
        out.never = smellRejectChance(m, a, ["runt", "deformed", "sick"]) === 0;
        out.done = !lessonsFor(m).some((l) => l.key === "babies");
        return out;
      }, SETUP);
      check(!r.fed && r.rejected, `turned away: ${JSON.stringify(r)}`);
      checkEqual(r.misdeed, "badmum", "a misdeed to scold her for");
      checkEqual(r.slips, 1, "a slip counted");
      check(r.orphan && r.notOwnMum, "another mare may foster it (not its own mum)");
      check(/smell/.test(r.row), `magnifying glass: ${r.row}`);
      check(r.sniffedOnce, "not sniffed again for the same thing");
      check(r.offered && r.done, "the All babies lesson is offered until she's had it");
      check(r.love >= 0.999 && r.takenBack && r.never, "after it she takes the foal back and never turns one away");
    },
  },
  {
    name: "batch12: last chance - time away, then her bestest to a foster mum, then all of them; praise after a good deed clears a strike",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = __mum(500, { name: "Bad" });
        m.traitShift = { temper: 1 };
        const kids = [__foal(m, 520), __foal(m, 540), __foal(m, 560)];
        const kind = __mum(900, { name: "Kind" });
        __foal(kind, 950);
        const out = {};
        out.menu = rightClickActions(m).map((a) => a.name).includes("Last chance");
        rightClickActions(m).find((a) => a.name === "Last chance").run(m);
        out.on = onLastChance(m);
        const real = Math.random;
        Math.random = () => 0.99; // (she never holds back)
        noteMumMisdeed(m, kids[0], "hoarded");
        out.away = mumAway(m);
        out.foalCantDrink = !kids[1].attemptFeedFromMare(m);
        out.desire = new MumAwayDesire().evaluate(m) > 0;
        out.row1 = describeMothering(m)[0];
        // Too soon after: not another slip
        out.dedup = !noteMumSlip(m, kids[0], "hoarded");
        timePlayed += MUM_SLIP_REST + 1;
        m.bestestId = kids[2].id;
        noteMumMisdeed(m, kids[0], "hurt");
        out.bestestGone = kids[2].motherId === kind.id && (relationships[m.id] || {})[kids[2].id] === "child";
        timePlayed += MUM_SLIP_REST + 1;
        noteMumMisdeed(m, kids[0], "rejected");
        out.allGone = kids.every((k) => (relationships[m.id] || {})[k.id] !== "baby_child");
        out.offList = !onLastChance(m);
        out.strikes = m.badMum.strikes;
        Math.random = real;
        // A good deed, praised: a strike off
        noteGoodDeed(m, "sang");
        out.praiseSub = careActions(m).find((a) => a.key === "praise").sub;
        praiseFluffy(m);
        out.after = m.badMum.strikes;
        out.saved = JSON.stringify(m.serialize()).includes('"badMum":{');
        return out;
      }, SETUP);
      check(r.menu && r.on, "Last chance from the right-click menu (and Actions)");
      check(r.away && r.foalCantDrink && r.desire, `strike 1: time away: ${JSON.stringify(r)}`);
      check(/Last chance: 1 strike/.test(r.row1), `magnifying glass: ${r.row1}`);
      check(r.dedup, "one slip an hour");
      check(r.bestestGone, "strike 2: her bestest goes to a foster mum");
      check(r.allGone && r.offList, "strike 3: all her foals go");
      checkEqual(r.strikes, 3, "three strikes");
      check(/sang/.test(r.praiseSub), `praise names the good deed: ${r.praiseSub}`);
      checkEqual(r.after, 2, "praise after a good deed takes a strike off");
      check(r.saved, "saved");
    },
  },
  {
    name: "batch12: on her last chance a mum may hold herself back - she feeds the foal she'd have turned away",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = __mum(500);
        m.traitShift = { temper: 1 };
        m.playerTrust = 1;
        const a = __foal(m, 530);
        makeRunt(a);
        setLastChance(m, true);
        const real = Math.random;
        Math.random = () => 0.05; // (she'd reject it, and she holds back)
        const fed = a.attemptFeedFromMare(m);
        Math.random = real;
        return { fed, kept: (relationships[m.id] || {})[a.id] === "baby_child", deed: recentGoodDeed(m), strikes: m.badMum.strikes };
      }, SETUP);
      check(r.fed && r.kept, `she held back: ${JSON.stringify(r)}`);
      check(!!r.deed, "a good deed to praise");
      checkEqual(r.strikes, 0, "no strike");
    },
  },
  {
    name: "batch12: a foal kept away from mum forgets her - won't drink from her, doesn't run to her - and can learn her again",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = __mum(500, { name: "Mum" });
        const a = __foal(m, 530, { scene: "BACKYARD" });
        const out = { limit: forgetAfter(a) / HOUR_LENGTH };
        for (let t = 0; t < forgetAfter(a) + 10; t += 5) _folForgetTick(a, 5);
        out.forgot = a.forgotMum === true;
        out.row = JSON.stringify(describeFoalMum(a));
        a.scene = "INDOORS";
        a.x = 560;
        out.wontDrink = !a.attemptFeedFromMare(m);
        a.fright = { key: "thunder", until: timePlayed + 20, start: timePlayed };
        out.notComforter = frightComforter(a) !== m;
        out.orphan = isOrphanFoal(a);
        a.fright = null;
        for (let t = 0; t < RELEARN_TIME + 10; t += 5) _folForgetTick(a, 5);
        out.knowsAgain = !a.forgotMum;
        out.drinks = (a.milkCooldown = 0, a.attemptFeedFromMare(m));
        return out;
      }, SETUP);
      check(r.limit >= 4 && r.limit <= 16, `forgets after ${r.limit}h`);
      check(r.forgot, "forgot her");
      check(/Doesn't know/.test(r.row), `magnifying glass: ${r.row}`);
      check(r.wontDrink && r.notComforter, `won't drink or run to her: ${JSON.stringify(r)}`);
      check(r.orphan, "counts as an orphan (a foster mum may take it in)");
      check(r.knowsAgain && r.drinks, "knows her again after time near her");
    },
  },
  {
    name: "batch12: a curious foal wanders off (to the water's edge by the river); mum notices, calls and fetches it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = __mum(500, { scene: "RIVER" });
        m.x = width * 0.6;
        const a = __foal(m, width * 0.6 + 40, { scene: "RIVER", hunger: 1 });
        a.growth = 0.4;
        a.traitShift = { bravery: 1, energy: 1 };
        a.updateGrowthStats();
        const out = { can: canWanderOff(a) };
        const xs = [];
        for (let i = 0; i < 30; i++) {
          a._wander = null;
          xs.push(startWandering(a).x);
        }
        out.edge = xs.some((x) => x < width * 0.25 + 40);
        out.desire = new FoalLifeDesire().evaluate(a);
        // Far from mum, a while later: she notices
        a.x = a._wander.x;
        a.y = a._wander.y;
        a.x = Math.max(a.x, width * 0.3);
        m.x = width * 0.95;
        timePlayed += WANDER_NOTICE + 1;
        _folMumNotices(m);
        out.seeking = m._seekFoal === a.id;
        out.mumDesire = new FoalLifeDesire().evaluate(m);
        m.x = a.x + 10;
        m.y = a.y;
        new FoalLifeDesire().execute(m);
        out.fetched = !a._wander && (m._seekFoal === null || m._seekFoal === undefined);
        return out;
      }, SETUP);
      check(r.can, "a curious foal can wander off");
      check(r.edge, "by the river it may go right to the water's edge");
      check(r.desire > 0, "it goes");
      check(r.seeking && r.mumDesire > 85, `mum notices and goes looking: ${JSON.stringify(r)}`);
      check(r.fetched, "she fetches it");
    },
  },
  {
    name: "batch12: a young foal doesn't understand its mum's death at first - it tries to nurse - then grieves",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = __mum(500);
        const a = __foal(m, 600);
        a.growth = 0.35;
        a.happiness = 0.8;
        a.updateRelationships(0.1);
        m.die(null, "test");
        a.updateRelationships(0.1);
        const out = { calm: a.happiness >= 0.79, confused: !!a._deathConfusion && !a._deathConfusion.done };
        out.herdMoves = bodyConfusesFoals(m);
        const d = new FoalLifeDesire();
        out.goes = d.evaluate(a) === 40;
        a.x = m.x + 20;
        a.speech.text = "";
        d.execute(a);
        out.said = a.speech.text || "";
        timePlayed += CONFUSED_TIME + 1;
        a.updateRelationships(0.1);
        out.grieves = a.happiness < 0.79 && a._deathConfusion.done;
        return out;
      }, SETUP);
      check(r.calm && r.confused, `not yet: ${JSON.stringify(r)}`);
      check(r.herdMoves, "a clever herd would take this body away sooner");
      check(r.goes && r.said.length > 0, `it goes to her and tries: "${r.said}"`);
      check(r.grieves, "then it understands and grieves");
    },
  },
  {
    name: "batch12: foals bully an alicorn foal - it grows timid, the ringleader a bully; scolding teaches; Play nice teaches it to take it out on a stuffy",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = __mum(300);
        const bully = __foal(m, 500, { hunger: 1 });
        const pal = __foal(m, 520, { hunger: 1 });
        bully.growth = pal.growth = 0.5;
        const vm = __mum(900);
        const victim = __foal(vm, 560, { type: "alicorn", hunger: 1 });
        victim.growth = 0.5;
        for (const f of [bully, pal, victim]) f.updateGrowthStats();
        const out = { munstah: seesAsMunstah(bully, victim) };
        startBullying(bully, victim);
        out.gang = pal.bullyScore > 0;
        out.desire = new FoalLifeDesire().evaluate(bully);
        bullyShove(bully, victim);
        out.victim = { bullied: victim.bullied, cooldown: victim.milkCooldown >= 8 };
        out.misdeed = recentMisdeed(bully);
        out.score = bully.bullyScore;
        // Shoved 3 times: timid
        bullyShove(bully, victim);
        bullyShove(bully, victim);
        out.timid = (victim.traitShift || {}).bravery < 0;
        out.grumpy = (bully.traitShift || {}).temper > 0;
        out.row = JSON.stringify(describeBullying(bully));
        const before = bully.bullyScore;
        scoldFluffy(bully);
        out.scolded = bully.bullyScore < before;
        // A stuffy nearby: untaught, it still goes for the foal
        const toy = new Plushie("INDOORS");
        toy.x = 520;
        toy.y = 520;
        objects.push(toy);
        const real = Math.random;
        Math.random = () => 0.1;
        startBullying(bully, victim);
        out.untaughtGoesForFoal = !bully._bullyJob.plushie && bully._bullyJob.id === victim.id;
        bully._bullyJob = null;
        // The Play nice lesson: only offered with a stuffy in the room
        out.offered = lessonsFor(bully).some((l) => l.key === "playnice");
        const L = getLesson("playnice");
        L.teach(bully);
        out.lessonScene = !!(bully._bullyJob && bully._bullyJob.plushie);
        const s2 = bully.bullyScore;
        bully.x = 520;
        new FoalLifeDesire().execute(bully);
        out.madeUp = bully.bullyScore < s2 && victim.bullied === 3;
        for (let i = 0; i < 3; i++) L.teach(bully);
        bully._bullyJob = null;
        out.learnt = playNiceOf(bully) >= 0.999 && !lessonsFor(bully).some((l) => l.key === "playnice");
        // Taught: it goes to the stuffy by itself
        startBullying(bully, victim);
        out.taughtStuffy = !!bully._bullyJob.plushie;
        Math.random = real;
        out.row2 = JSON.stringify(describeBullying(bully));
        objects.splice(objects.indexOf(toy), 1);
        return out;
      }, SETUP);
      check(r.munstah, "an intolerant foal sees the alicorn foal as a munstah");
      check(r.gang, "the others join in");
      check(r.desire === 50, "the ringleader goes after it");
      check(r.victim.bullied === 1 && r.victim.cooldown, `shoved off the milk: ${JSON.stringify(r.victim)}`);
      checkEqual(r.misdeed, "bully", "a misdeed to scold");
      check(r.timid && r.grumpy, `the victim timid, the ringleader grumpier: ${JSON.stringify(r)}`);
      check(/Picks on|bully/.test(r.row), `magnifying glass: ${r.row}`);
      check(r.scolded, "scolding makes it less of a bully");
      check(r.untaughtGoesForFoal, "untaught, it never switches to a stuffy by itself");
      check(r.offered && r.lessonScene && r.madeUp, `the Play nice lesson: the stuffy scene, and it makes up with it: ${JSON.stringify(r)}`);
      check(r.learnt && r.taughtStuffy, "taught, it goes to a stuffy instead of the foal");
      check(/play nice/.test(r.row2), `magnifying glass: ${r.row2}`);
    },
  },
  {
    name: "batch12: more to scold - a stallion hurting a foal, cannibalism; Help covers mothers and foals",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const s = __mk(500, { gender: "male" });
        const m = __mum(700);
        const a = __foal(m, 530);
        s.performAttack(a, "GRUDGE");
        const out = { hurt: recentMisdeed(s), sub: careActions(s).find((x) => x.key === "scold").sub };
        scoldFluffy(s);
        out.cooldown = s.attackCooldown >= 30;
        const c = __mk(800);
        c.cannibalismAcceptance = 0.6;
        const v = __mk(830);
        c.performCannibalAttack(v);
        out.cannibal = recentMisdeed(c);
        scoldFluffy(c);
        out.acceptance = c.cannibalismAcceptance;
        const help = HELP_TOPICS.map((t) => t.lines.join(" ")).join(" ");
        out.help = /mummah song/.test(help) && /Last chance/.test(help) && /All babies/.test(help);
        return out;
      }, SETUP);
      checkEqual(r.hurt, "hurt_foal", "a grown fluffy hurting a foal");
      check(/foal/.test(r.sub), `the Scold chip says so: ${r.sub}`);
      check(r.cooldown, "it stops attacking a while");
      checkEqual(r.cannibal, "cannibal", "cannibalism");
      check(r.acceptance < 0.6, "less willing to again");
      check(r.help, "Help covers it");
    },
  },
  {
    name: "batch12: a grown bully keeps picking on alicorns of any age; prejudice is the cause; Play nice as a foal makes a calmer, kinder grown-up; foals pick up a bully parent's habit",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const b = __mk(500, { name: "Brute", hunger: 1 });
        b.bullyScore = BULLY_GROWN;
        const a = __mk(600, { type: "alicorn", name: "Star" });
        const out = { grown: grownBully(b), munstah: !!seesAsMunstah(b, a) };
        const real = Math.random;
        Math.random = () => 0.001;
        b._bullyAt = undefined;
        _folBullyTick(b, 5);
        out.goesForAdult = !!b._bullyJob && b._bullyJob.id === a.id;
        out.desire = new FoalLifeDesire().evaluate(b);
        b.x = 590;
        new FoalLifeDesire().execute(b);
        out.shoved = a.bullied === 1;
        out.misdeed = recentMisdeed(b);
        // No prejudice, no bullying
        b._bullyAt = undefined;
        b._bullyJob = null;
        addAlicornComfort(b, 1);
        _folBullyTick(b, 5);
        out.curedCause = !b._bullyJob;
        b.alicornComfort = 0;
        b.alicornTolerance = false;
        // Raised by an untaught bully: the habit
        const m = __mk(300, { name: "Mum" });
        m.bullyScore = BULLY_GROWN;
        const f = __mk(320, { growth: 0.5, mum: m.id });
        for (let t = 0; t < DAY_LENGTH; t += 5) _folHabitTick(f, 5);
        out.habit = f.bullyHabit;
        out.habitRow = JSON.stringify(describeBullying(f));
        // Taught Play nice as a foal: calmer again, no habit
        f.bullyScore = 3;
        f.growthProgress = { bullyFoalTimes: 2 };
        f.traitShift = { temper: 0.2 };
        const toy = new Plushie("INDOORS");
        toy.x = 340;
        toy.y = 520;
        objects.push(toy);
        const L = getLesson("playnice");
        for (let i = 0; i < 4; i++) L.teach(f);
        out.calmer = Math.abs(f.traitShift.temper) < 0.001 && f.bullyHabit === 0;
        // ...a taught parent passes nothing on
        m.playNice = 1;
        const g = __mk(330, { growth: 0.5, mum: m.id });
        for (let t = 0; t < DAY_LENGTH; t += 5) _folHabitTick(g, 5);
        out.noHabit = !g.bullyHabit;
        // ...and a taught grown bully goes to a stuffy instead
        b.playNice = 1;
        b._bullyAt = undefined;
        b._bullyJob = null;
        b.x = 360;
        _folBullyTick(b, 5);
        out.taughtStuffy = !!(b._bullyJob && b._bullyJob.plushie);
        // ...and stands up for anyone (not a friend)
        b._bullyJob = null;
        const kind = __mk(620, { name: "Kind" });
        kind.playNice = 1;
        kind.alicornTolerance = true; // (not prejudiced itself)
        const v = __mk(640, { type: "alicorn", growth: 0.5 });
        const bully = __mk(660, { growth: 0.5 });
        bully.speech.text = "";
        kind.speech.text = "";
        bullyShove(bully, v);
        out.protected = recentGoodDeed(kind) === "protected";
        Math.random = real;
        objects.splice(objects.indexOf(toy), 1);
        return out;
      }, SETUP);
      check(r.grown && r.munstah, "a grown bully");
      check(r.goesForAdult && r.desire === 50 && r.shoved, `it picks on a grown alicorn: ${JSON.stringify(r)}`);
      checkEqual(r.misdeed, "bully", "scold it for bullying");
      check(r.curedCause, "no prejudice, no bullying");
      check(r.habit > 0.5, `a foal raised by a bully picks up the habit: ${r.habit}`);
      check(/picking up bullying/.test(r.habitRow), `magnifying glass: ${r.habitRow}`);
      check(r.calmer, "Play nice takes back the grumpier and the habit");
      check(r.noHabit, "a taught parent passes nothing on");
      check(r.taughtStuffy, "a taught grown bully goes to a stuffy");
      check(r.protected, "a fluffy that learnt to play nice stands up for anyone");
    },
  },
];
