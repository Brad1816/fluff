// Approved ideas from the stories: pet flap (and a sturdier fence), glue
// traps, stray dogs, the weekly street sweep, who'd eat another fluffy, bad
// meat, hereditary defects, snitches and hidden foals, the biology teacher
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD", "PARK", "ALLEY", "ALLEY_ROAD"]) __clearScene(s);
  __seedRandom(4040);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 6 * DAY_LENGTH + 10 * HOUR_LENGTH;
  herdState = freshHerdState();
  _herdChanged();
  money = 1000;
  uiMessages.length = 0;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.makeType(opts.type ?? "earthy");
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
    if (opts.name) fluffyNames[h.id] = opts.name;
    if (typeof opts.temper === "number") h.traitShift = { ...(h.traitShift || {}), temper: opts.temper - traitValue(h, "temper") + ((h.traitShift && h.traitShift.temper) || 0) };
    fluffies.push(h);
    return h;
  };
  window.__msg = (re) => uiMessages.some((m) => re.test(m.text));
}`;

module.exports = [
  {
    name: "ideas: the fence breaks once in days now; a pet flap lets yours out and back, and strays in when it's unlocked",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = { fence: [FENCE_BREAK_EVERY, FENCE_BREAK_CHANCE[0]] };
        const flap = new PetFlap("INDOORS");
        flap.setPosition(300, 520);
        objects.push(flap);
        const f = __mk(320, { name: "Out" });
        f.boredom = 0;
        const real = Math.random;
        timePlayed = 6 * DAY_LENGTH + 10 * HOUR_LENGTH; // (10 AM)
        Math.random = () => 0.001;
        petFlapTicker.fireNext();
        updatePetFlaps(0);
        Math.random = real;
        out.trip = !!f._flapTrip;
        updatePetFlaps(0); // (it's right by the flap: through)
        out.outside = f.scene;
        // A stray in the yard, flap unlocked: in it comes
        const stray = __mk(400, { scene: "BACKYARD", adopted: false });
        Math.random = () => 0.001;
        petFlapTicker.fireNext();
        updatePetFlaps(0);
        Math.random = real;
        const t = stray._flapTrip;
        if (t) {
          stray.x = t.yard.x;
          stray.y = t.yard.y;
        }
        updatePetFlaps(0);
        out.strayIn = stray.scene;
        // Locked: nobody through
        flap.locked = true;
        const g = __mk(320, { name: "Stuck" });
        Math.random = () => 0.001;
        petFlapTicker.fireNext();
        updatePetFlaps(0);
        Math.random = real;
        updatePetFlaps(0);
        out.locked = g.scene;
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.fence), JSON.stringify([1200, 0.25]), "a roll a day, 1 in 4");
      check(r.trip, "it heads for the flap on a fine day");
      checkEqual(r.outside, "BACKYARD", "and goes out into the yard");
      checkEqual(r.strayIn, "INDOORS", "a stray comes in through an unlocked flap");
      checkEqual(r.locked, "INDOORS", "locked: nobody goes through");
    },
  },
  {
    name: "ideas: a glue trap catches whatever walks on it; picking it up tears it free (and hurts), oil frees it gently",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const trap = new GlueTrap("INDOORS");
        trap.setPosition(500, 520);
        objects.push(trap);
        const f = __mk(505);
        updateGlueTraps(0.1);
        out.stuck = isGluedDown(f) && trap.stuck() === f;
        f.initBehavior("MOVING");
        f.setTargetPosition(900, 520);
        updateGlueTraps(0.1);
        out.still = f.x === trap.x && !f.isMovingOrRunning();
        const h0 = f.health;
        tearOffGlueTrap(f);
        out.torn = [!isGluedDown(f), f.health < h0, !objects.includes(trap)];
        // Oil
        const t2 = new GlueTrap("INDOORS");
        t2.setPosition(200, 520);
        objects.push(t2);
        const g = __mk(200);
        updateGlueTraps(0.1);
        const m0 = money;
        const h1 = g.health;
        oilGlueTrap(t2);
        out.oiled = [!isGluedDown(g), g.health === h1, money === m0 - GLUE_OIL_COST, !objects.includes(t2)];
        return out;
      }, SETUP);
      check(r.stuck, "caught");
      check(r.still, "can't move");
      checkEqual(JSON.stringify(r.torn), JSON.stringify([true, true, true]), "torn free, hurt, trap spent");
      checkEqual(JSON.stringify(r.oiled), JSON.stringify([true, true, true, true]), "oil frees it unhurt");
    },
  },
  {
    name: "ideas: a stray dog in the alley - everyone runs, a mum grabs one foal and leaves the rest, a foal it catches dies; you can chase it off",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const mum = __mk(500, { scene: "ALLEY", adopted: false });
        const k1 = __mk(520, { scene: "ALLEY", adopted: false, growth: 0.3 });
        const k2 = __mk(540, { scene: "ALLEY", adopted: false, growth: 0.3 });
        for (const k of [k1, k2]) {
          k.motherId = mum.id;
          setRelationship(mum.id, k.id, "baby_child");
          setRelationship(k.id, mum.id, "mother");
        }
        const dog = spawnStrayDog("ALLEY");
        dog.x = 600;
        dog.y = 520;
        dog._alarm();
        const carried = [k1, k2].filter((k) => k._dogCarry);
        out.carried = carried.length;
        const left = [k1, k2].find((k) => !k._dogCarry);
        out.leftSad = left.happiness < 0.7;
        // The dog catches the one left behind
        dog.targetId = left.id;
        dog.x = left.x;
        dog.y = left.y;
        dog.biteRest = 0;
        dog.update(0.05);
        out.bitten = !left.isAlive && left.causeOfDeath === "Killed by a dog";
        // Another dog: clicked away
        const d2 = spawnStrayDog("ALLEY");
        out.chased = d2.scareOff() && d2.state === "leave";
        resetStrayDogs();
        return out;
      }, SETUP);
      checkEqual(r.carried, 1, "she carries just one");
      check(r.leftSad, "the one left behind is frightened and sad");
      check(r.bitten, "a small foal doesn't survive a bite");
      check(r.chased, "a click chases it off");
    },
  },
  {
    name: "ideas: the street sweep - warned the day before, then strays in the alley are taken and yours left",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        citySweep = freshCitySweep();
        const stray = __mk(400, { scene: "ALLEY", adopted: false });
        const body = __mk(450, { scene: "ALLEY", adopted: false });
        body.anatomy.die(null, "Starved");
        const mine = __mk(500, { scene: "ALLEY", adopted: true });
        const out = {};
        // Day 6, 9 AM: the notice
        timePlayed = (6 - 1) * DAY_LENGTH + (9 - START_HOUR) * HOUR_LENGTH;
        out.day = [getDayNumber(), Math.floor(gameHour())];
        citySweepTicker.fireNext();
        updateCitySweep(0);
        out.warned = __msg(/street cleaning/);
        // Day 7, 5 AM: the sweep
        timePlayed = (7 - 1) * DAY_LENGTH + (5 - START_HOUR) * HOUR_LENGTH;
        out.day2 = [getDayNumber(), Math.floor(gameHour())];
        citySweepTicker.fireNext();
        updateCitySweep(0);
        out.gone = [!fluffies.includes(stray), !fluffies.includes(body), fluffies.includes(mine)];
        return out;
      }, SETUP);
      check(r.warned, `warned the day before (${r.day})`);
      checkEqual(JSON.stringify(r.gone), JSON.stringify([true, true, true]), `strays and bodies taken, yours left (${r.day2})`);
    },
  },
  {
    name: "ideas: a good fluffy never eats another, however hungry; a nasty starving one may - the weakest first",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const good = __mk(300, { temper: -0.5, hunger: 0.05 });
        const nasty = __mk(600, { temper: 1, hunger: 0.05 });
        const big = __mk(700);
        const foal = __mk(900, { growth: 0.3 });
        const out = { caps: [cannibalCapacity(good), +cannibalCapacity(nasty).toFixed(2)] };
        const real = Math.random;
        Math.random = () => 0.01;
        out.good = good.positioning.scoutForCannibalism();
        out.nasty = nasty.positioning.scoutForCannibalism();
        Math.random = real;
        out.target = nasty.cannibalTarget === foal ? "foal" : nasty.cannibalTarget === big ? "big" : String(nasty.cannibalTarget);
        return out;
      }, SETUP);
      checkEqual(r.caps[0], 0, "no capacity in a good one");
      check(r.caps[1] >= 0.45, `a nasty one has it in it: ${r.caps[1]}`);
      checkEqual(r.good, false, "the good one won't");
      check(r.nasty, "the nasty one does");
      checkEqual(r.target, "foal", "the weakest it can reach");
    },
  },
  {
    name: "ideas: bad meat - enough meals of fluffy bring the wobbles: hidden, then slow and stumbling, then death",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400);
        const real = Math.random;
        Math.random = () => 0.01;
        for (let i = 0; i < BAD_MEAT_SAFE + 1; i++) noteAteFluffyMeat(f);
        Math.random = real;
        const out = { caught: !!f.wobbles, hidden: !wobblesShowing(f) };
        f.currentStateKey = "IDLE";
        f.updateSpeed();
        const s0 = f.speed;
        timePlayed += WOBBLE_HIDDEN + 1;
        out.showing = wobblesShowing(f);
        f.updateSpeed();
        out.slower = f.speed < s0;
        out.row = describeBadMeat(f) ? describeBadMeat(f)[0] : null;
        timePlayed += WOBBLE_SHOWING;
        badMeatTicker.fireNext();
        updateBadMeat(0);
        out.dead = [f.isAlive, f.causeOfDeath];
        return out;
      }, SETUP);
      check(r.caught && r.hidden, "caught, but nothing shows yet");
      check(r.showing && r.slower, "then it wobbles, slower");
      check(/wobbles/.test(r.row), "the magnifying glass says so");
      checkEqual(JSON.stringify(r.dead), JSON.stringify([false, "The wobbles (bad meat)"]), "and it dies of it");
    },
  },
  {
    name: "ideas: hereditary defects - two carriers can have a dummy foal that can't nurse; a DNA test shows carriers and the vet warns of the odds",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(400);
        const dad = __mk(450, { gender: "male" });
        mum.defectGenes = { dummy: 1, shaky: 0 };
        dad.defectGenes = { dummy: 1, shaky: 0 };
        noteSireDefects(mum, dad);
        const baby = __mk(420, { growth: 0.05 });
        const real = Math.random;
        Math.random = () => 0.1; // (both pass it on)
        inheritDefects(baby, mum);
        Math.random = real;
        const out = { dummy: hasDefect(baby, "dummy"), dim: hasDeformity(baby, "dim") };
        mum.lactatingTimer = 300;
        mum.milkCharges = 5;
        baby.motherId = mum.id;
        setRelationship(mum.id, baby.id, "baby_child");
        setRelationship(baby.id, mum.id, "mother");
        baby.hunger = 0.2;
        out.nurse = baby.attemptFeedFromMare(mum);
        out.before = describeDefect(mum);
        dnaTest(mum);
        dnaTest(dad);
        out.after = describeDefect(mum)[0];
        out.risk = pairAdvice(mum, dad).defect;
        return out;
      }, SETUP);
      check(r.dummy && r.dim, "a dummy foal, simple-minded");
      checkEqual(r.nurse, false, "it can't nurse");
      checkEqual(r.before, null, "a carrier doesn't show before the test");
      check(/Carrier/.test(r.after), `after the test: ${r.after}`);
      check(r.risk && Math.abs(r.risk.p - 0.25) < 0.001, `the vet warns: 1 in 4 (${JSON.stringify(r.risk)})`);
    },
  },
  {
    name: "ideas: a mum who's seen a cull hides her deformed foal; it can't be seen or clicked; a snitch tells, for a treat, and is disliked for it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(400, { name: "Mum" });
        mum.cageKnow = { cull: true };
        const foal = __mk(420, { growth: 0.1, name: "Pip" });
        foal.deformities = ["stubby"];
        foal.motherId = mum.id;
        setRelationship(mum.id, foal.id, "baby_child");
        setRelationship(foal.id, mum.id, "mother");
        const bed = new Bed("INDOORS");
        bed.setPosition ? bed.setPosition(700, 520) : ((bed.x = 700), (bed.y = 520));
        objects.push(bed);
        const real = Math.random;
        Math.random = () => 0.01;
        _maybeHide();
        Math.random = real;
        const out = { hidden: isHiddenFoal(foal), click: foal.hitTestAsSeen(foal.x, foal.y - 10) };
        const s = __mk(500, { name: "Tattle" });
        setSnitch(s, true);
        const op0 = getOpinion(mum, s);
        const m0 = money;
        out.told = snitchTells(s);
        out.after = [isHiddenFoal(foal), money < m0, getOpinion(mum, s) < op0];
        return out;
      }, SETUP);
      check(r.hidden, "hidden under the bed");
      checkEqual(r.click, false, "can't be clicked");
      checkEqual(r.told, "HIDDEN", "the snitch tells");
      checkEqual(JSON.stringify(r.after), JSON.stringify([false, true, true]), "found, a treat paid, mum hates the snitch");
    },
  },
  {
    name: "ideas: the biology teacher comes for a body (never a healthy fluffy) and takes it away",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const fit = __mk(300);
        const out = { none: makeDissectionRequest(() => 0) };
        const body = __mk(400, { name: "Gone" });
        body.anatomy.die(null, "Starved");
        const req = makeDissectionRequest(() => 0);
        out.req = req && [req.buyer, req.fluffyId === body.id, req.price];
        currentSellRequest = req;
        const m0 = money;
        out.accepted = acceptSellRequest();
        out.after = [fluffies.includes(body), money - m0, fluffies.includes(fit)];
        return out;
      }, SETUP);
      checkEqual(r.none, null, "no body, no dying one: no teacher");
      checkEqual(JSON.stringify(r.req.slice(0, 2)), JSON.stringify(["teacher", true]), "comes for the body");
      check(r.accepted, "accepted");
      check(!r.after[0] && r.after[1] > 0 && r.after[2], `taken away, paid (${r.after[1]}), the healthy one stays`);
    },
  },
];
