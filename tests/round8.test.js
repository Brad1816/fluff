// Plan round 8: handling (shaking, the wall hook, the hook pole, the hot
// plate, the defibrillator, the lethal drug), hot peppers and the rock
// eater, the blankie, the lights, "at da vet", da towew, the last straw,
// crowding collapse, the clippers and long coats, the wild (frozen down,
// wild generations, burying, the noisy alley herd, the bin fence) and the
// new buyers (the lab, the care home, the parent, the influencer)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD", "PARK", "ALLEY", "DAY_CARE"]) __clearScene(s);
  __seedRandom(8080);
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
  // The next time the clock reads hour h
  window.__atHour = (h) => {
    let t = Math.floor(_clockSeconds() / DAY_LENGTH) * DAY_LENGTH + h * HOUR_LENGTH - START_HOUR * HOUR_LENGTH;
    while (t <= timePlayed) t += DAY_LENGTH;
    timePlayed = t;
  };
  window.__obj = (o, x, y) => {
    o.x = x;
    o.y = y;
    objects.push(o);
    return o;
  };
}`;

module.exports = [
  {
    name: "round8: shaking makes a fluffy dizzy; the wall hook holds one (it suffers, those who see learn to fear the hook); the hook pole drags out a hider",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __mk(300);
        const h0 = a.happiness;
        shakeFluffy(a);
        out.dizzy = a.dizzyUntil > timePlayed;
        out.sadder = a.happiness < h0;
        // The hook
        const hook = __obj(new WallHook("INDOORS"), 600, 300);
        const b = __mk(605, { y: 360 });
        const w = __mk(800);
        w.canSee = () => true;
        out.catches = hook.catchesFluffy(b);
        b.placedOn = hook;
        hook.securedFluffy = b;
        hook.lockPosition(b);
        out.locked = Math.abs(b.x - hook.x) < 1;
        const hp = b.health;
        const hh = b.happiness;
        for (let i = 0; i < 20; i++) {
          timePlayed += 60;
          updateHandling(60);
        }
        out.hurt = b.health < hp;
        out.sad = b.happiness < hh;
        out.hooked = hookedOn(b);
        out.fear = fearOf(w, "hook");
        hook.releaseFluffy();
        out.released = !hookedOn(b);
        // The pole
        const c = __mk(200, { growth: 0.2 });
        const hp2 = c.health;
        poleDragOut(c);
        out.poleHurt = c.health < hp2;
        return out;
      }, SETUP);
      check(r.dizzy && r.sadder, "shaken: dizzy and sadder");
      check(r.catches && r.locked, "the hook catches one set down by it and holds it there");
      check(r.hurt && r.sad && r.hooked, "hanging hurts it and makes it miserable");
      check(r.fear > 0, `a fluffy that saw it fears the hook (${r.fear})`);
      check(r.released, "taken off the hook");
      check(r.poleHurt, "the hook pole hurts");
    },
  },
  {
    name: "round8: the hot plate burns (a scar, fear of fire, slower); the defibrillator brings back one just gone but not too late; the lethal drug puts it to sleep",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const plate = __obj(new HotPlate("INDOORS"), 500, 520);
        plate.on = true;
        const a = __mk(500);
        const hp = a.health;
        out.burnt = burnOnHotPlate(a, plate);
        out.hurt = a.health < hp;
        out.burned = isBurned(a);
        out.scar = (a.scars || []).some((s) => s.kind === "burn");
        out.fire = fearOf(a, "fire");
        out.slow = burnSpeed(a) < 1;
        out.vet = vetProblems(a).some((p) => /burn/i.test(p[0] || p.name || String(p)));
        // Defib
        const d = __mk(700);
        d.die(null, "Test");
        d.deathTimer = 3;
        out.canDefib = canDefibrillate(d);
        __seedRandom(1);
        let ok = false;
        for (let i = 0; i < 10 && !ok; i++) {
          timePlayed += 5;
          ok = useDefibrillator(d, null);
          if (!ok) d.deathTimer = 3;
        }
        out.revived = d.isAlive && !!d.nearDeath;
        const late = __mk(800);
        late.die(null, "Test");
        late.deathTimer = DEFIB_WINDOW + 5;
        out.tooLate = !canDefibrillate(late);
        // Lethal
        const l = __mk(900);
        l.administerDrug("lethal", 10);
        out.lethalAt = typeof l._lethalAt === "number";
        for (let i = 0; i < 12; i++) {
          timePlayed += 1;
          updateHandling(1);
        }
        out.dead = !l.isAlive;
        out.cause = l.causeOfDeath;
        return out;
      }, SETUP);
      check(r.burnt && r.hurt && r.burned, "burnt on the hot plate");
      check(r.scar, "a burn scar");
      check(r.fire > 0, "it learns to fear fire");
      check(r.slow, "slower while it heals");
      check(r.vet, "the vet can dress a burn");
      check(r.canDefib && r.revived, "the defibrillator brings it back");
      check(r.tooLate, "too late after the window");
      check(r.lethalAt && r.dead, `the lethal drug (${r.cause})`);
    },
  },
  {
    name: "round8: hot peppers burn and make it fear that bowl; a dim fluffy eats a block and may get a blockage the vet clears",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const bowl = { id: 9191, x: 100, y: 520 };
        const a = __mk(120);
        onAteSpecial(a, "hot_peppers", bowl);
        out.burning = pepperBurning(a);
        out.fears = (a.fearedBowls || []).includes(9191);
        out.food = !!FOODS.hot_peppers;
        out.shop = SPAWN_ACTIONS.some((s) => s.foodType === "hot_peppers");
        const dim = __mk(400);
        dim.deformities = ["dim"];
        out.rockEater = isRockEater(dim);
        const block = new Block("INDOORS");
        block.x = 420;
        block.y = 520;
        objects.push(block);
        __seedRandom(3);
        let stuck = false;
        for (let i = 0; i < 40 && !stuck; i++) {
          dim.blockage = null;
          eatRock(dim, null);
          stuck = hasBlockage(dim);
        }
        out.stuck = stuck;
        out.vet = vetProblems(dim).some((p) => /rock|block/i.test(p[0] || p.name || String(p)));
        vetTreat(dim);
        out.cleared = !hasBlockage(dim);
        dim.blockage = null;
        eatRock(dim, block);
        out.blockGone = !objects.includes(block);
        return out;
      }, SETUP);
      check(r.food && r.shop, "hot peppers are a food in the shop");
      check(r.burning && r.fears, "they burn, and it fears the bowl");
      check(r.rockEater, "a dim one eats rocks");
      check(r.stuck && r.vet, "sometimes a blockage, which the vet sees");
      check(r.cleared, "the vet clears it");
      check(r.blockGone, "the block it ate is gone");
    },
  },
  {
    name: "round8: the blankie soothes a foal apart from its mum, taking a soiled one away is 'bad poopies'; lights left on halve rest; the vet lie holds then breaks",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const mum = __mk(300, { scene: "BACKYARD" });
        const foal = __mk(500, { growth: 0.3, mum: mum.id });
        foal.motherId = mum.id;
        foal.canSee = () => true;
        const b = __obj(new Blankie("INDOORS"), 520, 520);
        b.smellOf = mum.id;
        out.comforts = blankieComforts(foal) === b;
        b.soiled = true;
        out.badPoopies = blankieTakenAway(b) && foal.badPoopies === 1;
        // Lights
        out.off = lightsAlwaysOn("INDOORS");
        toggleLights("INDOORS");
        out.on = lightsAlwaysOn("INDOORS");
        __atHour(1); // (night)
        out.rest = lightsRestFactor(foal);
        toggleLights("INDOORS");
        // The vet lie
        const m2 = __mk(700);
        const lost = __mk(100, { growth: 0.2, mum: m2.id, scene: "BACKYARD" });
        relationships[m2.id] = relationships[m2.id] || {};
        relationships[m2.id][lost.id] = "baby_child";
        m2.perceivedRelationships = m2.perceivedRelationships || {};
        m2.perceivedRelationships[lost.id] = { state: "lost" };
        fluffies.splice(fluffies.indexOf(lost), 1);
        out.told = tellVetLie(m2);
        out.believes = believesAtVet(m2, lost.id);
        out.state = m2.perceivedRelationships[lost.id].state;
        const h0 = m2.happiness;
        timePlayed += VET_LIE_DAYS * DAY_LENGTH + 10;
        for (let i = 0; i < 4; i++) updateComfort(2);
        out.foundOut = !vetLieActive(m2) && m2.happiness < h0;
        out.lostAgain = m2.perceivedRelationships[lost.id].state;
        return out;
      }, SETUP);
      check(r.comforts, "her blankie soothes the foal");
      check(r.badPoopies, "taking the soiled blankie: bad poopies");
      check(!r.off && r.on, "the lights chip toggles");
      check(r.rest < 1, `lights on at night: less rest (${r.rest})`);
      check(r.told && r.believes && r.state === "current", "she believes her foal is at the vet");
      check(r.foundOut && r.lostAgain === "lost", "she works it out after a while");
    },
  },
  {
    name: "round8: a gentle fluffy picked on too often snaps; fluffies taken away start tower stories; a room crowded for a day breaks down",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const v = __mk(300, { growth: 0.6 });
        const bully = __mk(340, { growth: 0.6 });
        v.traitShift = { temper: -1 };
        let snapped = false;
        let n = 0;
        for (; n < 10 && !snapped; n++) snapped = lastStrawPressure(v, bully);
        out.snapped = snapped;
        out.n = n;
        out.need = LAST_STRAW;
        out.bullyHurt = bully.health < 100;
        // Tower
        const a = __mk(500);
        const gone = __mk(560);
        a.met = { [gone.id]: 1 };
        gone.met = { [a.id]: 1 };
        _towerCheck();
        fluffies.splice(fluffies.indexOf(gone), 1);
        _towerCheck();
        out.tower = a.towerFear || 0;
        // Collapse
        comfortState.collapse.INDOORS = COLLAPSE_HOURS + 1;
        out.collapsed = roomCollapsed("INDOORS");
        const even = __mk(700);
        if (even.id % 2) even.id += 1;
        out.listless = isListless(even);
        out.slow = listlessSpeed(even);
        delete comfortState.collapse.INDOORS;
        return out;
      }, SETUP);
      check(r.snapped && r.n === r.need, `the last straw on the ${r.n}th time`);
      check(r.bullyHurt, "the bully is hurt");
      check(r.tower > 0, "room-mates hear about the tower");
      check(r.collapsed && r.listless && r.slow < 1, "a collapsed room: listless grown-ups");
    },
  },
  {
    name: "round8: clippers shave the rear then all over (cold, cleaner); long coats run in families, hide weight and mat; wild generations shrink",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __mk(300);
        a.longCoat = true;
        a.matted = 0.8;
        out.priceMatted = coatPriceMultiplier(a);
        out.weight = coatWeightLevel(a, "trim");
        shaveFluffy(a);
        out.rear = shavedKind(a);
        out.dirt = accidentDirtFactor(a);
        shaveFluffy(a);
        out.all = shavedKind(a);
        out.matAfter = a.matted;
        out.weightShaved = coatWeightLevel(a, "trim");
        timePlayed += SHAVE_GROW + 10;
        out.grown = shavedKind(a);
        // Inheritance
        const mum = __mk(500);
        const dad = __mk(560, { gender: "male" });
        mum.longCoat = true;
        dad.longCoat = true;
        let long = 0;
        for (let i = 0; i < 40; i++) {
          const baby = __mk(520, { growth: 0.1 });
          baby.fatherId = dad.id;
          onBabyBornHooks(mum, baby);
          if (baby.longCoat) long++;
          fluffies.splice(fluffies.indexOf(baby), 1);
        }
        out.long = long;
        // Wild generations
        const wild = __mk(700, { adopted: false, scene: "PARK" });
        wild.wildGen = 2;
        const pup = __mk(720, { growth: 0.1, adopted: false, scene: "PARK" });
        onWildBirth(wild, pup);
        out.gen = pup.wildGen;
        out.scale = wildGenScale(pup);
        out.price = wildGenPrice(pup);
        const pet = __mk(800, { adopted: false, scene: "PARK" });
        pet.formerPet = { how: "ran away", day: 1 };
        out.collar = hasCollarMark(pet);
        return out;
      }, SETUP);
      check(r.priceMatted < 1, "matted coats sell for less");
      check(r.weight === "chubby", "a long coat hides how thin it is");
      check(r.rear === "rear" && r.dirt < 1, "first the rear, and nothing sticks");
      check(r.all === "all" && r.matAfter === 0, "then all over, mats gone");
      check(r.weightShaved === "trim", "shaved: you can see its weight");
      check(r.grown === null, "it grows back");
      check(r.long >= 25, `two long-coated parents: mostly long-coated foals (${r.long}/40)`);
      check(r.gen === 3 && r.scale < 1 && r.price < 1, "wild generations: smaller, cheaper");
      check(r.collar, "a former pet has a collar mark");
    },
  },
  {
    name: "round8: frozen to the ground (can't move, freed with a tear); bodies outdoors get buried by kin; the noisy alley herd and the bin fence",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __mk(300, { scene: "PARK", adopted: false });
        a.frozenDown = { at: timePlayed };
        a.updateSpeed();
        out.speed = a.speed;
        freeFrozen(a, true);
        out.free = !isFrozenDown(a);
        out.tear = a.health < 100;
        // Burying
        const kin = __mk(500, { scene: "PARK", adopted: false });
        const body = __mk(540, { scene: "PARK", adopted: false });
        relationships[body.id] = relationships[body.id] || {};
        relationships[body.id][kin.id] = "sibling";
        body.die(null, "Test");
        body.deathTimer = BURY_AFTER + 5;
        for (let i = 0; i < 60 && !body.buried; i++) _buryTick(5);
        out.buried = !!body.buried;
        // Noisy herd
        const members = [];
        for (let i = 0; i < NOISY_HERD; i++) members.push(__mk(100 + i * 60, { scene: "ALLEY", adopted: false }));
        const h = _formHerd(members);
        out.herd = !!h;
        out.noisy = !!_noisyHerd();
        __atHour(2);
        wildState.checkedNight = -1;
        _noiseTick();
        timePlayed += 7 * HOUR_LENGTH;
        _noiseTick();
        out.choice = !!choiceDialog;
        closeAllChoices();
        money = 1000;
        const n = callPestControl();
        out.cleared = n >= NOISY_HERD && !fluffies.some((f) => f.scene === "ALLEY" && !f.adopted);
        // Bin fence
        const w0 = lureSpawnWeight("ALLEY");
        __obj(new BinFence("ALLEY"), 400, 520);
        out.fenced = binFenceIn("ALLEY");
        out.fewer = lureSpawnWeight("ALLEY") < w0;
        return out;
      }, SETUP);
      checkEqual(r.speed, 0, "frozen: can't move");
      check(r.free && r.tear, "pulled free, with a tear");
      check(r.buried, "kin bury a body under leaves");
      check(r.herd && r.noisy, "a big herd in the alley is noisy");
      check(r.choice, "the neighbours complain in the morning");
      check(r.cleared, "pest control clears the alley");
      check(r.fenced && r.fewer, "a bin fence keeps strays away");
    },
  },
  {
    name: "round8: new buyers - the lab only for lab cases, the parent turns down a biter, the care home wants calm grown-ups, the influencer dumps it in the park a week later",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const lab = getBuyerKind("lab");
        const ok = __mk(300);
        out.labNone = lab.weight(1);
        const sb = __mk(400, { growth: 0.3 });
        sb.sensitiveBaby = true;
        out.labCase = isLabCase(sb);
        out.labSome = lab.weight(1);
        const parent = getBuyerKind("parent");
        const biter = __mk(500);
        biter.traitShift = { temper: 1 };
        const gentle = __mk(550);
        gentle.traitShift = { temper: -1 };
        gentle.playerTrust = 1;
        out.parentBiter = buyerLikes(parent, biter);
        out.parentGentle = buyerLikes(parent, gentle);
        const care = getBuyerKind("carehome");
        out.careGentle = buyerLikes(care, gentle);
        out.careFoal = buyerLikes(care, sb);
        // Influencer
        const f = __mk(600, { growth: 0.4 });
        fluffyNames[f.id] = "Rowan";
        const id = f.id;
        const rep0 = keeperRep.family || 0;
        _saleBuyer = "influencer";
        noteFluffyLeft(f, "sold", 200);
        fluffies.splice(fluffies.indexOf(f), 1);
        out.rep = (keeperRep.family || 0) - rep0;
        out.queued = moreBuyersState.dumps.length;
        timePlayed += (INFLU_DUMP_DAYS + 1) * DAY_LENGTH;
        updateMoreBuyers(10);
        const back = fluffies.find((o) => o.id === id);
        out.back = !!back;
        out.park = back && back.scene === PARK_SCENE;
        out.wild = back && !back.adopted;
        out.how = back && back.formerPet && back.formerPet.how;
        out.newName = back && fluffyNames[id] !== "Rowan" && INFLU_NAMES.includes(fluffyNames[id]);
        out.left = moreBuyersState.dumps.length;
        // Saved and loaded
        const st = SAVED_GAME_STATE.find((s) => s.name === "moreBuyersState");
        out.saved = !!st;
        return out;
      }, SETUP);
      checkEqual(r.labNone, 0, "no lab without a lab case");
      check(r.labCase && r.labSome > 0, "a sensitive baby brings the lab");
      check(r.parentBiter < 0.1 && r.parentGentle > 0.5, `the parent: no biters (${r.parentBiter}), a gentle one yes (${r.parentGentle})`);
      check(r.careGentle > r.careFoal, "the care home prefers a calm grown-up");
      check(r.rep > 0 && r.queued === 1, "the influencer: a little fame, and a dump coming");
      check(r.back && r.park && r.wild && r.how === "dumped", "a week later it's a stray in the park");
      check(r.newName, "under the name they gave it");
      checkEqual(r.left, 0, "done with");
      check(r.saved, "saved");
    },
  },
  {
    name: "round8 review fixes: brought back = off the plaque and nobody mourns; the vet dresses a burn once; a stacked block isn't eaten; a runaway isn't a tower story",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __mk(300);
        const friend = __mk(360);
        a.die(null, "Test");
        friend.mourning = { id: a.id, name: "x", until: timePlayed + 999, visited: false };
        livesBook.lives.push({ id: a.id, name: "x" });
        a.deathTimer = 2;
        reviveFluffy(a);
        out.plaque = livesBook.lives.some((l) => l.id === a.id);
        out.mourning = !!friend.mourning;
        // Burn: charged once
        money = 5000;
        a.burned = { until: timePlayed + 500 };
        const p1 = vetProblems(a).some((p) => /burn/.test(p[0] || p.name || String(p)));
        vetTreat(a);
        out.burnOnce = p1 && !vetProblems(a).some((p) => /burn/.test(p[0] || p.name || String(p)));
        // Stacked blocks are safe
        const dim = __mk(500);
        dim.deformities = ["dim"];
        const b1 = new Block("INDOORS");
        b1.x = 510; b1.y = 520;
        const b2 = new Block("INDOORS");
        b2.x = 510; b2.y = 500;
        b2.stackedOn = b1;
        objects.push(b1, b2);
        for (let i = 0; i < 200; i++) updateTummy(HOUR_LENGTH);
        out.stack = objects.includes(b1) && objects.includes(b2);
        // A runaway: no tower stories
        const c = __mk(700);
        const d = __mk(740);
        c.met = { [d.id]: 1 };
        _towerCheck();
        d.adopted = false;
        d.formerPet = { how: "ran away", day: 1 };
        _towerCheck();
        out.tower = c.towerFear || 0;
        return out;
      }, SETUP);
      check(!r.plaque && !r.mourning, "revived: off the plaque, nobody mourning");
      check(r.burnOnce, "the vet dresses a burn once");
      check(r.stack, "a stacked block isn't eaten");
      checkEqual(r.tower, 0, "a runaway isn't a tower story");
    },
  },
];
