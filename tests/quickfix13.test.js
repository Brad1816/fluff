// Playtest notes (Oct 5, evening): smarty foals and enfies, the Fluff-Bot,
// Space to pause, smarts, Today, the planner, how far toxoplasmosis has got (a
// percentage, shorter pregnancies and Foal-B-Gone, bodies indoors, a mum
// seeing her foal die, blocks, and skipping ahead faster
const { check, checkEqual } = require("./helpers");
const src = require("fs").readFileSync(__dirname + "/playtest6.test.js", "utf8");
const SETUP = src.match(/const SETUP = `([\s\S]*?)`;/)[1];

module.exports = [
  {
    name: "quickfix13: a smarty foal never asks for enfies (a grown one does); the Fluff-Bot - a timid fluffy soon gets used to it, and it leaves a frightened fluffy's mess for later",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const foal = __mk(300, { growth: 0.5, gender: "male" });
        const adult = __mk(400, { growth: 1, gender: "male" });
        let foalEnfies = 0;
        let adultEnfies = 0;
        for (let i = 0; i < 300; i++) {
          if (/enfie/i.test(getDialogue(["HELLO", "PLAYER", "SMARTY"], foal))) foalEnfies++;
          if (/enfie/i.test(getDialogue(["HELLO", "PLAYER", "SMARTY"], adult))) adultEnfies++;
          if (/enfie/i.test(getDialogue(["PERSONALITY", "SMARTY"], foal))) foalEnfies++;
        }
        out.foal = foalEnfies;
        out.adult = adultEnfies;
        // The Fluff-Bot
        const timid = __mk(500, { growth: 1 });
        timid.traits = timid.traits || {};
        fearsOf(timid).bot = 0.6;
        const bot = new Roomba("INDOORS");
        bot.setPosition(520, 520);
        objects.push(bot);
        let frights = 0;
        for (let i = 0; i < 6; i++) {
          timid.fright = null;
          timid._frightAt = {};
          if (reactToRoomba(timid, bot) === "frightened") frights++;
        }
        out.fearAfter = fearOf(timid, "bot");
        // One that isn't scared of it, just timid: used to it in a few bumps
        const shy = __mk(560, { growth: 1 });
        fearsOf(shy).bot = 0;
        for (let i = 0; i < 4; i++) reactToRoomba(shy, bot);
        out.used = shy.botUsed;
        // A frightened fluffy's mess: not straight away
        puddles.length = 0;
        addPointToPuddle("INDOORS", 900, 560, "pee", 0.2, 0.2);
        const scared = __mk(905, { y: 560, growth: 0.3 });
        scared.fright = { key: "bot", until: timePlayed + 30 };
        out.leftAlone = bot._nearestMess() === null;
        scared.fright = null;
        bot._bumped = {};
        out.later = !!bot._nearestMess();
        objects.splice(objects.indexOf(bot), 1);
        return out;
      }, SETUP);
      checkEqual(r.foal, 0, "a smarty foal never asks for enfies");
      check(r.adult > 0, "a grown smarty still does");
      check(r.fearAfter < 0.35, `used to the bot after a few bumps (fear ${r.fearAfter})`);
      check(r.used > 0.9, "and used to it as a timid fluffy");
      check(r.leftAlone && r.later, "it leaves a frightened fluffy's mess, then comes back for it");
    },
  },
  {
    name: "quickfix13: Space pauses and unpauses; smarts aren't in steps of ten; Today puts the sad ones and the aching wishes on one line each; the inspection header spells out the gender",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        gameState = "PLAYING";
        transitionPhase = "OFF";
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " }));
        out.paused = gameState === "PAUSED";
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " }));
        out.playing = gameState === "PLAYING";
        // Smarts: a spread within the breed
        const scores = [];
        const realTrait = window.traitValue;
        window.traitValue = () => 0; // (average wits: just the breed and its own difference)
        for (let i = 0; i < 12; i++) {
          const f = __mk(100 + i * 40, { growth: 1 });
          scores.push(smartsScore(f));
        }
        window.traitValue = realTrait;
        out.distinct = new Set(scores).size;
        out.notTens = scores.filter((n) => n % 10 !== 0).length;
        out.range = Math.max(...scores) - Math.min(...scores);
        // Today
        for (const f of fluffies.slice()) if (f.scene === "INDOORS") fluffies.splice(fluffies.indexOf(f), 1);
        const sad = [];
        for (let i = 0; i < 5; i++) {
          const f = __mk(100 + i * 60, { growth: 1 });
          f.happiness = 0.25;
          sad.push(f);
        }
        _todayCache = null;
        const lines = todayItems().map((i) => i.text);
        out.sadLines = lines.filter((t) => /sad/i.test(t)).length;
        out.sadText = lines.find((t) => /sad/i.test(t)) || "";
        return out;
      }, SETUP);
      check(r.paused && r.playing, "Space: pause, then carry on");
      check(r.distinct >= 6 && r.notTens >= 6, `smarts spread out (${r.distinct} different, ${r.notTens} not a multiple of 10)`);
      check(r.range <= 24, `but still about the breed's average (a spread of ${r.range})`);
      checkEqual(r.sadLines, 1, "the sad ones: one line");
      check(/and \d more|, /.test(r.sadText), "naming a few: " + r.sadText);
    },
  },
  {
    name: "quickfix13: the planner counts every fluffy that can have foals (a young alicorn too), best chance first; toxoplasmosis shows how far along it is (a percentage to death); pregnancy is back to 300; Foal-B-Gone ends a pregnancy, all stillborn",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        for (const f of fluffies.slice()) if (f.adopted) fluffies.splice(fluffies.indexOf(f), 1);
        const mare = __mk(300, { growth: 1, gender: "female" });
        const stud = __mk(400, { growth: 1, gender: "male" });
        const ali = __mk(500, { growth: 0.5, gender: "male", type: "alicorn" });
        genePlan = { type: "alicorn" };
        _planJob = null;
        const J = runGenePlan();
        out.pairs = J.pairs.length;
        const rows = _planRows();
        out.top = rows.length ? fluffyDisplayNameById(rows[0].dad.id) === fluffyDisplayNameById(ali.id) : false;
        out.young = rows.length ? rows[0].young : false;
        out.sorted = rows.every((x, i) => i === 0 || rows[i - 1].chance >= x.chance);
        genePlan = {};
        // Toxoplasmosis: how far along, in the magnifying glass
        const sick = __mk(600, { growth: 1 });
        sick.isToxoplasmosis = true;
        sick.isToxoVaccinated = false;
        sick.health = 38;
        const row = describeToxo(sick);
        out.toxoText = row ? row[0] : "";
        out.toxoShown = (getFluffyInspectionInfo(sick).about || []).some((a) => a.label === "Toxoplasmosis");
        sick.isToxoplasmosis = false;
        out.toxoGone = describeToxo(sick) === null;
        // Pregnancy
        out.duration = pregnancyDuration;
        mare.triggerPregnancy(stud);
        out.pregnant = mare.isPregnant;
        mare.pregnancyTimer = pregnancyDuration * 0.1; // (nearly due: these would live)
        mare.bloodstream = { abortifacient: 20 };
        const before = new Set(fluffies);
        for (let i = 0; i < 400 && (mare.isPregnant || fluffies.length === before.size); i++) mare.update(0.1);
        const born = fluffies.filter((f) => !before.has(f) && f.motherId === mare.id);
        out.born = born.length;
        out.allStill = born.length > 0 && born.every((f) => !f.isAlive);
        out.over = !mare.isPregnant;
        return out;
      }, SETUP);
      checkEqual(r.pairs, 2, "both stallions, the young alicorn too");
      check(r.top && r.young, "the young alicorn's pair is the best, marked not grown yet");
      check(r.sorted, "best chance first");
      check(/^62% of the way to death/.test(r.toxoText) && r.toxoShown && r.toxoGone, "toxoplasmosis: " + r.toxoText);
      checkEqual(r.duration, 300, "pregnancy: 300");
      check(r.pregnant && r.over && r.allStill, `Foal-B-Gone: the litter comes stillborn (${r.born})`);
    },
  },
  {
    name: "quickfix13: indoors a clever fluffy asks you to take a body away (it doesn't drag it to the wall); a foal dying in front of its mum - she cries out and runs to it; drowning is a real death",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __mk(300, { growth: 1 });
        const b = __mk(380, { growth: 1 });
        const body = __mk(600, { growth: 0.3 });
        _formHerd([a, b]);
        const realSmarts = window.smartsOf;
        window.smartsOf = (f) => (f === a ? 0.9 : 0);
        body.die(null, "Illness");
        body.deathTimer = 1e6;
        _hwBodyCare();
        window.smartsOf = realSmarts;
        out.noCarry = !a._body && !b._body && !body._carriedBy;
        out.told = body._bodyTold === true;
        // A mum sees her foal die
        const mum = __mk(700, { growth: 1, gender: "female" });
        const foal = __mk(760, { growth: 0.3 });
        foal.motherId = mum.id;
        relationships[mum.id] = relationships[mum.id] || {};
        relationships[mum.id][foal.id] = "baby_child";
        mum.canSee = () => true;
        mum.happiness = 0.8;
        foal.die(null, "Illness");
        out.mumSad = mum.happiness < 0.7;
        out.mumSpoke = !!(mum.speech && mum.speech.text);
        out.mumRuns = mum.isMovingOrRunning() && Math.abs(mum.targetX - foal.x) < 80;
        // Drowning
        const swim = __mk(100, { growth: 0.3, scene: "RIVER", y: 500 });
        swim.x = 50;
        for (let i = 0; i < 80 && !swim.isDestroyed; i++) swim.physics.updateRiverDrowning(0.1);
        out.drowned = swim.isDestroyed && swim.causeOfDeath === "Drowned";
        return out;
      }, SETUP);
      check(r.noCarry && r.told, "indoors: it asks you");
      check(r.mumSad && r.mumSpoke && r.mumRuns, "mum sees it: cries out, sad, runs to it");
      check(r.drowned, "drowned: a real death");
    },
  },
  {
    name: "quickfix13: blocks - it walks to a block's side, sits, lifts it and puts it on its back, then stacks it, without turning to and fro; skipping ahead takes bigger steps in a busy house, and big steps don't send anything flying",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        for (const o of objects.filter((o) => o instanceof Block)) objects.splice(objects.indexOf(o), 1);
        const b1 = new Block(500, 520, "INDOORS");
        const b2 = new Block(800, 540, "INDOORS");
        objects.push(b1, b2);
        const f = __mk(300, { think: true, growth: 0.6 });
        f.ballCooldown = 999;
        let flips = 0;
        let last = f.facingRight;
        let lifted = false;
        let onBack = false;
        let stacked = false;
        for (let i = 0; i < 900; i++) {
          f.update(1 / 30);
          b1.update(1 / 30);
          b2.update(1 / 30);
          if (f.facingRight !== last) {
            flips++;
            last = f.facingRight;
          }
          if (f._blockLift) lifted = true;
          if (f.blockOnBack) onBack = true;
          if (b1.stackedOn || b2.stackedOn) stacked = true;
        }
        out.flips = flips;
        out.lifted = lifted && onBack;
        out.stacked = stacked;
        // Skipping: the step grows in a busy house, and stays sane
        for (let i = 0; i < 25; i++) __mk(100 + i * 40, { think: true, growth: 1, y: 420 + (i * 31) % 250 });
        const st = { from: timePlayed, until: timePlayed + 6 * HOUR_LENGTH, realStart: performance.now(), targetMs: 500, msPerStep: 8 };
        out.bigStep = sleepStepNow(st);
        for (let i = 0; i < 300; i++) updateSimulation(1.0);
        const bad = fluffies.filter((g) => g.isAlive && (!isFinite(g.x) || !isFinite(g.y) || Math.abs(g.y) > 3000 || Math.abs(g.x) > 5000));
        out.bad = bad.length;
        out.anim = fluffies.every((g) => !g.anim || Math.abs(g.anim.yOffset || 0) < 1000);
        return out;
      }, SETUP);
      check(r.lifted, "it lifts the block onto its back");
      check(r.stacked, "and stacks it");
      check(r.flips <= 8, `without turning to and fro (${r.flips} turns in 30 seconds)`);
      check(r.bigStep > 0.3, `a busy house skips in bigger steps (${r.bigStep})`);
      checkEqual(r.bad, 0, "nobody flies off in big steps");
      check(r.anim, "their animations stay sane");
    },
  },
];
