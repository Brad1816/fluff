// Balance pass from the long simulated games: one fight counts once, fear
// lasts and weighs on mood, who runs away, nothing freezes the game
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  storyBook = freshStoryBook();
  _storyIndex = null;
  window.__bl = (x = 400, gender = "female") => {
    const f = new Horse(1, null, "INDOORS", "earthy", null, 0.6, 0.6, gender);
    f.adopted = true;
    f.x = x;
    f.y = 450;
    f.hunger = 1;
    f.happiness = 0.6;
    f.personalities = f.personalities.filter((p) => p !== "smarty");
    fluffies.push(f);
    return f;
  };
}`;

module.exports = [
  {
    name: "balance: a scuffle is one fight in the story (blows and hitting back don't each count); a new one later counts again",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const a = __bl(400);
        const b = __bl(450);
        const tally = () => (storyOf(b).find((e) => e.k === "tally") || { c: {} }).c.attacked || 0;
        for (let i = 0; i < 6; i++) {
          a.performAttack(b, "BULLY");
          b.performAttack(a, "RETALIATION");
          timePlayed += 3;
        }
        const one = tally();
        const theirs = (storyOf(a).find((e) => e.k === "tally") || { c: {} }).c.attacked || 0;
        timePlayed += 3 * HOUR_LENGTH;
        a.performAttack(b, "BULLY");
        return { one, theirs, two: tally() };
      }, SETUP);
      checkEqual(r.one, 1, "six blows: one fight");
      checkEqual(r.theirs, 0, "hitting back isn't a fight of its own");
      checkEqual(r.two, 2, "a new fight hours later counts");
    },
  },
  {
    name: "balance: fear of you fades over a day or two, not hours, and keeps a frightened fluffy from settling content",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __bl();
        f.playerFear = 0.6;
        f.lastHurtByPlayerAt = timePlayed;
        f.traitShift = {};
        const startFear = f.playerFear;
        for (let i = 0; i < HOUR_LENGTH * 6; i++) {
          timePlayed += 1;
          updatePlayerMemory(f, 1);
        }
        const sixHours = +f.playerFear.toFixed(2);
        const settle = fearHappinessTarget(f);
        f.adopted = false;
        const wild = fearHappinessTarget(f);
        return { startFear, sixHours, settle: +settle.toFixed(3), wild };
      }, SETUP);
      check(r.sixHours > 0.45 && r.sixHours < r.startFear, `six hours on: ${r.sixHours}`);
      check(r.settle < -0.05, `fear lowers where happiness settles: ${r.settle}`);
      checkEqual(r.wild, 0, "only at home (yours)");
    },
  },
  {
    name: "balance: a fluffy that fears you and has lost all trust may run, even fed and content; one that only fears you a little won't",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const a = __bl();
        a.playerFear = 0.6;
        a.playerTrust = 0.05;
        a.happiness = 0.9;
        const b = __bl(600);
        b.playerFear = 0.3;
        b.playerTrust = 0.05;
        b.happiness = 0.1;
        return [runAwayChance(a), runAwayChance(b)];
      }, SETUP);
      checkEqual(JSON.stringify(r), JSON.stringify([0.06, 0]), "who might run");
    },
  },
  {
    name: "balance: a fox nobody stands up to doesn't crash the game; a broken system doesn't stop the others",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene(PARK_SCENE);
        const out = {};
        const v = new Horse(0.5, null, PARK_SCENE, "earthy");
        v.x = 600;
        v.y = 600;
        fluffies.push(v);
        const fox = new NightPredator(v, { herd: null, label: "a group of wild fluffies" });
        fox.alerted.add(12345); // (someone screamed, nobody came)
        const real = Math.random;
        Math.random = () => 0.001;
        try {
          fox._resolve(v);
          out.ok = true;
        } catch (e) {
          out.ok = String(e);
        }
        Math.random = real;
        // A system that throws: the rest still run
        let after = 0;
        SYSTEMS.push({ name: "__boom", update: () => { throw new Error("boom"); }, order: 0 });
        SYSTEMS.push({ name: "__after", update: () => { after++; }, order: 1 });
        SYSTEMS.sort((a, b) => a.order - b.order);
        const realErr = console.error;
        console.error = () => {};
        try {
          updateSystems(0.01);
          out.threw = false;
        } catch (e) {
          out.threw = true;
        }
        console.error = realErr;
        SYSTEMS.splice(SYSTEMS.findIndex((s) => s.name === "__boom"), 1);
        SYSTEMS.splice(SYSTEMS.findIndex((s) => s.name === "__after"), 1);
        out.after = after;
        return out;
      });
      checkEqual(r.ok, true, "the fox is put off");
      checkEqual(r.threw, false, "the error is caught");
      checkEqual(r.after, 1, "the next system still ran");
    },
  },
  {
    name: "balance: Today warns when a mum keeps going for her own foal (coat colour), until they're apart",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __bl(400);
        fluffyNames[mum.id] = "Hazel";
        const foal = new Horse(0.3, null, "INDOORS", "earthy", null, 0.6, 0.6, "male");
        foal.adopted = true;
        foal.motherId = mum.id;
        fluffies.push(foal);
        fluffyNames[foal.id] = "Nib";
        const real = window.mumRejectsFoalColour;
        window.mumRejectsFoalColour = (m, f) => m === mum && f === foal;
        _todayCache = null;
        const together = todayItems().some((i) => /Hazel goes for Nib over its coat colour/.test(i.text));
        foal.scene = "BACKYARD";
        _todayCache = null;
        const apart = todayItems().some((i) => /goes for Nib/.test(i.text));
        window.mumRejectsFoalColour = real;
        return { together, apart };
      }, SETUP);
      check(r.together, "warned while they're together");
      checkEqual(r.apart, false, "not once they're apart");
    },
  },
  {
    name: "balance: two that can't stand each other scuffle now and then, not all day",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const a = __bl(400, "male");
        const b = __bl(450, "male");
        a.traitShift = {};
        a.traits = Object.assign({}, a.traits || {}, { temper: 1, bravery: 1 });
        const realTrait = window.traitValue;
        window.traitValue = (f, k) => (f === a ? 1 : realTrait(f, k));
        changeOpinion(a, b, -1);
        let n = 0;
        const realPA = a.performAttack;
        a.performAttack = () => n++;
        const realRandom = Math.random;
        Math.random = () => 0; // (it would if it could: only the rest holds it back)
        for (let i = 0; i < 600; i++) {
          timePlayed += 1;
          a.attackCooldown = 0;
          _grudgeNear(a, b, timePlayed, 1);
        }
        Math.random = realRandom;
        a.performAttack = realPA;
        window.traitValue = realTrait;
        return n;
      }, SETUP);
      checkEqual(r, 3, "one every four game hours at most (600 s = 12 hours)");
    },
  },
  {
    name: "balance: the Feed-Bot gives formula to a newborn its mum turns away, not to one she's feeding",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const bot = new FeedBot("INDOORS");
        bot.setPosition(640, 560);
        bot.load("formula", 10);
        const mum = __bl(400);
        mum.lactatingTimer = 1000;
        const foal = new Horse(0.02, null, "INDOORS", "earthy", null, 0.6, 0.6, "male");
        foal.adopted = true;
        foal.motherId = mum.id;
        foal.hunger = 0.3;
        foal.x = 450;
        foal.y = 450;
        fluffies.push(foal);
        const fed = bot._orphans().includes(foal);
        const real = window.mumRejectsFoalColour;
        window.mumRejectsFoalColour = (m, f) => m === mum && f === foal;
        const turnedAway = bot._orphans().includes(foal);
        window.mumRejectsFoalColour = real;
        // Mum feeding it, but it's starving (a big litter): formula too
        foal.hunger = 0.1;
        const starving = bot._orphans().includes(foal);
        return { tooYoung: foal.tooYoungToWalk(), fed, turnedAway, starving };
      }, SETUP);
      check(r.tooYoung, "a newborn");
      checkEqual(r.fed, false, "mum's feeding it");
      checkEqual(r.turnedAway, true, "mum turns it away: formula");
      checkEqual(r.starving, true, "starving anyway: formula");
    },
  },
  {
    name: "balance: selling grieves the room by the family and friends left behind there; a grown one less than a foal",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        roomClimate = freshRoomClimate();
        _climateCache = null;
        const g = () => +(((roomClimate.INDOORS || {}).g) || 0).toFixed(2);
        // Nobody close in the room: no grief
        const loner = __bl(300);
        recordStory("sold", loner, { x: "sold" });
        const none = g();
        // A grown one with mum and a sister here
        const mum = __bl(400);
        const sis = __bl(500);
        const kid = __bl(600);
        setRelationship(mum.id, kid.id, "child");
        setRelationship(sis.id, kid.id, "sister");
        recordStory("sold", kid, { x: "sold" });
        const grown = g();
        // A foal with the same family
        roomClimate = freshRoomClimate();
        const foal = new Horse(0.4, null, "INDOORS", "earthy", null, 0.6, 0.6, "male");
        foal.adopted = true;
        fluffies.push(foal);
        setRelationship(mum.id, foal.id, "child");
        setRelationship(sis.id, foal.id, "brother");
        recordStory("sold", foal, { x: "sold" });
        return { none, grown, foal: g() };
      }, SETUP);
      checkEqual(r.none, 0, "nobody left to miss it");
      checkEqual(r.grown, 0.9, "grown: 60% of a full sale");
      checkEqual(r.foal, 1.5, "a foal taken: full");
    },
  },
  {
    name: "balance: a newborn lost in its first days isn't a house memory; at most two anniversaries a day; one park memory a season",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        sharedMemories = freshSharedMemories();
        const out = {};
        const a = __bl(300);
        const b = __bl(350);
        const c = __bl(400);
        const baby = new Horse(0.05, null, "INDOORS", "earthy", null, 0.6, 0.6, "male");
        baby.adopted = true;
        baby.x = 380;
        baby.y = 450;
        fluffies.push(baby);
        baby.die(null, "Killed by a fluffy");
        out.newborn = sharedMemories.list.filter((m) => m.kind === "death").length;
        // Five sad memories the same day: two told a year on
        for (let i = 0; i < 5; i++) makeSharedMemory("death", "Loss " + i, [a, b, c], { key: "loss" + i, about: 9000 + i });
        timePlayed += SM_YEAR * DAY_LENGTH;
        uiMessages.length = 0;
        sharedMemoryTicker.fireNext();
        updateSharedMemories(1);
        out.told = uiMessages.filter((m) => /ago today: Loss/.test(m.text || m)).length;
        // Day outs: two in one season make one memory
        sharedMemories = freshSharedMemories();
        for (let i = 0; i < 2; i++) {
          outings = freshOutings();
          startOuting("INDOORS");
          outings.outing.start = timePlayed - 3 * 60;
          endOuting("home");
          timePlayed += 100;
        }
        out.outings = sharedMemories.list.filter((m) => /day out at the park/.test(m.name)).length;
        return out;
      }, SETUP);
      checkEqual(r.newborn, 0, "a newborn's death: no house memory");
      checkEqual(r.told, 2, "two anniversaries a day at most");
      checkEqual(r.outings, 1, "one day-out memory a season");
    },
  },
  {
    name: "balance: with no fluffies left, the bailiffs write the debt off instead of it growing for ever",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        for (const f of fluffies.slice()) if (f.adopted) fluffies.splice(fluffies.indexOf(f), 1);
        billsOwed = 120;
        pressure.debtDays = 5;
        economy.rent = 80;
        uiMessages.length = 0;
        sendBailiffs();
        const out = { owed: billsOwed, days: pressure.debtDays, rent: economy.rent, said: uiMessages.some((m) => /writes off the \$120/.test(m.text || m)) };
        // With a foal still at home: no write-off (it isn't taken either)
        const foal = new Horse(0.4, null, "INDOORS", "earthy");
        foal.adopted = true;
        fluffies.push(foal);
        billsOwed = 50;
        sendBailiffs();
        out.withFoal = billsOwed;
        billsOwed = 0;
        pressure.debtDays = 0;
        return out;
      }, SETUP);
      checkEqual(JSON.stringify([r.owed, r.days, r.rent, r.said]), JSON.stringify([0, 0, 20, true]), "written off");
      checkEqual(r.withFoal, 50, "a foal at home: still owed");
    },
  },
  {
    name: "balance: once a fluffy's gone, its day-by-day small things fold into one life tally (the big events stay)",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const gone = __bl(300);
        const here = __bl(500);
        for (let d = 0; d < 3; d++) {
          recordStory("brushed", gone);
          recordStory("brushed", here);
          timePlayed += DAY_LENGTH;
        }
        recordStory("named", gone, { x: "Bramble" });
        fluffies.splice(fluffies.indexOf(gone), 1);
        compactStory();
        const g = storyBook.events.filter((e) => e.w[0] === gone.id);
        const h = storyBook.events.filter((e) => e.w[0] === here.id && e.k === "tally");
        return { gTallies: g.filter((e) => e.k === "tally").map((e) => [!!e.life, e.c.brushed]), gNamed: g.some((e) => e.k === "named"), hTallies: h.length };
      }, SETUP);
      checkEqual(JSON.stringify(r.gTallies), JSON.stringify([[true, 3]]), "one life tally");
      check(r.gNamed, "big events stay");
      checkEqual(r.hTallies, 3, "one still here keeps its days");
    },
  },
  {
    name: "balance: a mum lashing out at her own rejected foal waits a while between blows; other fights don't",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __bl(400);
        const foal = new Horse(0.2, null, "INDOORS", "earthy", null, 0.6, 0.6, "male");
        foal.adopted = true;
        foal.motherId = mum.id;
        foal.x = 420;
        foal.y = 450;
        fluffies.push(foal);
        mum.performAttack(foal, "COLOR");
        const lash = mum.attackCooldown;
        const other = __bl(500);
        other.performAttack(mum, "GRUDGE");
        return { lash, other: other.attackCooldown };
      }, SETUP);
      checkEqual(r.lash, 12, "a mum and her rejected foal");
      checkEqual(r.other, 1.5, "an ordinary fight");
    },
  },
  {
    name: "balance: on an outing, a hungry foal or a newborn its mum turns away stays home (by the Feed-Bot)",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const r = await page.evaluate((setup) => {
        eval(setup)();
        __clearScene(PARK_SCENE);
        outings = freshOutings();
        changeScene("INDOORS");
        const mum = __bl(300);
        const baby = new Horse(0.02, null, "INDOORS", "earthy", null, 0.6, 0.6, "male");
        baby.adopted = true;
        baby.motherId = mum.id;
        baby.hunger = 1;
        fluffies.push(baby);
        const hungry = new Horse(0.5, null, "INDOORS", "earthy", null, 0.6, 0.6, "female");
        hungry.adopted = true;
        hungry.hunger = 0.2;
        hungry.x = 600;
        hungry.y = 450;
        fluffies.push(hungry);
        const real = window.mumRejectsFoalColour;
        window.mumRejectsFoalColour = (m, f) => m === mum && f === baby;
        startOuting("INDOORS");
        window.mumRejectsFoalColour = real;
        const out = { mum: mum.scene, baby: baby.scene, hungry: hungry.scene };
        endOuting("home");
        changeScene("INDOORS");
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r), JSON.stringify({ mum: "PARK", baby: "INDOORS", hungry: "INDOORS" }), "who went");
    },
  },
  {
    name: "balance: hunger and a cage wear happiness down to a fifth, not to the edge of giving up; Today warns before and after",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const cage = new Cage("INDOORS");
        cage.x = 600;
        cage.y = 450;
        objects.push(cage);
        cage.update(0);
        const f = __bl(600);
        f.y = cage.bounds.bottom - 40;
        f.currentCage = cage;
        f.brain.think = () => {};
        f.happiness = 0.3;
        for (let i = 0; i < 600; i++) {
          f.hunger = 0.3;
          f.update(1);
        }
        const out = { worn: +f.happiness.toFixed(3) };
        objects.splice(objects.indexOf(cage), 1);
        f.currentCage = null;
        fluffyNames[f.id] = "Moth";
        f.happiness = 0.1;
        _todayCache = null;
        out.close = todayItems().some((i) => /Moth is close to giving up/.test(i.text));
        f.happiness = 0;
        _todayCache = null;
        out.gone = todayItems().some((i) => /Moth has given up/.test(i.text));
        return out;
      }, SETUP);
      check(r.worn >= 0.199 && r.worn < 0.35, `worn down to about a fifth: ${r.worn}`);
      check(r.close, "close to giving up: warned");
      check(r.gone, "given up: warned");
    },
  },
  {
    name: "balance: a hungry fluffy in a cage eats from a bowl set by the bars",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const cage = new Cage("INDOORS");
        cage.x = 600;
        cage.y = 450;
        objects.push(cage);
        cage.update(0);
        const bowl = new Bowl("bowl", "INDOORS");
        bowl.x = cage.bounds.right - 5;
        bowl.y = cage.bounds.bottom - 20;
        bowl.currentCage = cage;
        objects.push(bowl);
        bowl.update && bowl.update(0.01);
        bowl.fill(5, "kibble");
        const f = __bl(cage.x - 60);
        f.y = cage.bounds.bottom - 40;
        f.currentCage = cage;
        f.hunger = 0.15;
        let ate = false;
        for (let i = 0; i < 60 * 90 && !ate; i++) {
          updateSimulation(1 / 60);
          if (f.hunger > 0.5) ate = true;
        }
        const out = { ate, food: bowl.food, gap: Math.round(Math.abs(f.x - bowl.x)) };
        objects.splice(objects.indexOf(bowl), 1);
        objects.splice(objects.indexOf(cage), 1);
        return out;
      }, SETUP);
      check(r.ate, `it ate (bowl ${r.food}, ${r.gap}px apart)`);
    },
  },
];
