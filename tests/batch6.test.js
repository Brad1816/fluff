// Batch 6: the incubator and frail early foals (Premature.js, Incubator.js),
// recovery and infection after surgery (Recovery.js), learnt fears of the
// hot iron and of cages (Fears.js), throwing teaching pegasi to fly
// (Flight.js), and your mares fostering your orphans (Fostering.js).
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "INDOORSL1"]) __clearScene(s);
  __seedRandom(23);
  closeAllChoices();
  if (typeof closeSurgery === "function") closeSurgery();
  currentScene = "INDOORS";
  timePlayed = 4 * DAY_LENGTH;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 500;
    h.hunger = 1;
    h.health = 100;
    h.happiness = 0.7;
    h.playerFear = 0;
    h.coloristDegree = 0;
    h.currentStateKey = "IDLE";
    h.brain.think = () => {};
    fluffies.push(h);
    return h;
  };
  window.__cage = (Kind, x, y) => {
    const c = new Kind("INDOORS");
    c.x = x;
    c.y = y;
    c.updateBounds();
    objects.push(c);
    return c;
  };
  window.__drop = (f, c) => {
    f.x = (c.bounds.left + c.bounds.right) / 2;
    f.y = (c.bounds.top + c.bounds.bottom) / 2;
    handleDropping(f);
    return f.currentCage === c;
  };
}`;

module.exports = [
  {
    name: "batch6: the incubator takes up to two foals on milk (not a grown one), keeps them warm and fed, and gets them over being frail twice as fast - not in a power cut",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const shop = SPAWN_ACTIONS.find((a) => a.label === "Incubator" || a.name === "Incubator" || a.isItem === "incubator");
        out.shop = !!shop;
        const inc = __cage(Incubator, 400, 400);
        out.saveBack = createItemFromSave(inc.serialize()) instanceof Incubator;
        const a = __mk(100, { growth: 0.05 });
        const b = __mk(120, { growth: 0.05 });
        const c = __mk(140, { growth: 0.05 });
        const big = __mk(160, { growth: 0.6 });
        out.a = __drop(a, inc);
        out.b = __drop(b, inc);
        out.c = __drop(c, inc); // (full)
        out.big = __drop(big, inc);
        out.cBelow = c.y > inc.bounds.bottom;
        out.noUnhappy = inc.causesUnhappiness() === false;
        // Frail, cold and starving: inside, it's warmed and fed
        a.bornEarly = "very";
        a.frailLeft = 100;
        a.warmth = 0.1;
        a.hunger = 0.05;
        // (and one outside, warm and fed, to compare)
        const out1 = __mk(900, { growth: 0.05 });
        out1.bornEarly = "very";
        out1.frailLeft = 100;
        out1.warmth = 1;
        updatePrematureCare(1);
        out.ratio = (100 - a.frailLeft) / (100 - out1.frailLeft);
        out.warm = a.warmth;
        out.fed = a.hunger;
        out.frail = a.frailLeft;
        out.inDanger = frailInDanger(a);
        out.health = a.health;
        // No power: just a box
        const real = window.powerCut;
        window.powerCut = () => true;
        out.offInside = inIncubator(a);
        window.powerCut = real;
        return out;
      }, SETUP);
      check(r.shop, "the incubator is in the shop");
      check(r.saveBack, "saved and loaded as an incubator");
      check(r.a && r.b, "two foals go in");
      check(!r.c && r.cBelow, `a third is put down beside it: ${JSON.stringify(r)}`);
      check(!r.big, "a grown one doesn't go in");
      check(r.noUnhappy, "a foal doesn't mind it");
      checkEqual(r.warm, 1, "warm inside");
      check(r.fed >= 0.7, `tube-fed: ${r.fed}`);
      check(r.frail < 100 && Math.abs(r.ratio - 2) < 1e-6, `frailty goes twice as fast inside: ${r.ratio}`);
      check(!r.inDanger && r.health === 100, "not in danger inside");
      checkEqual(r.offInside, false, "no power, no incubator");
    },
  },
  {
    name: "batch6: a very premature foal is frail for days - left cold and hungry it weakens and can die; a full-term one isn't frail",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const early = __mk(200, { growth: 0.03 });
        applyPrematureBirth(early, prematureStage(0.5), true);
        out.frailLeft = early.frailLeft;
        out.describe = describePremature(early);
        const fine = __mk(300, { growth: 0.03 });
        out.fineFrail = isFrail(fine);
        // Cold and hungry
        early.warmth = 0.2;
        early.hunger = 0.1;
        early.health = 30;
        out.danger = frailInDanger(early);
        out.warn = typeof getTodayItems === "function" ? null : null;
        for (let t = 0; t < 4 * HOUR_LENGTH && early.isAlive; t++) {
          early.warmth = 0.2;
          early.hunger = 0.1;
          updatePrematureCare(1);
        }
        out.dead = !early.isAlive;
        out.cause = early.deathCause || early.causeOfDeath || null;
        // Kept warm and fed instead: fine
        const kept = __mk(400, { growth: 0.03 });
        applyPrematureBirth(kept, prematureStage(0.5), true);
        kept.health = 30;
        for (let t = 0; t < 4 * HOUR_LENGTH; t++) {
          kept.warmth = 1;
          kept.hunger = 1;
          updatePrematureCare(1);
        }
        out.keptHealth = kept.health;
        return out;
      }, SETUP);
      checkEqual(r.frailLeft, 2 * 1200, "very premature: frail for 2 days");
      check(r.describe && /frail/i.test(r.describe[0]), `the magnifying glass says so: ${JSON.stringify(r.describe)}`);
      checkEqual(r.fineFrail, false, "a full-term foal isn't frail");
      check(r.danger, "cold and hungry: in danger");
      check(r.dead, "left cold and hungry it dies");
      check(!r.cause || /born too early/i.test(r.cause), `of being born too early: ${r.cause}`);
      checkEqual(r.keptHealth, 30, "kept warm and fed, it's fine");
    },
  },
  {
    name: "batch6: after surgery - infection risk by tool and place, stitched halves it, burnt shut ends it, an infection drains health and the vet cures it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(200);
        out.scalpelFloor = startRecovery(f, { type: "scalpel" }).risk;
        f.recovery = null;
        out.knifeFloor = startRecovery(f, { type: "knife" }).risk;
        f.recovery = null;
        f.placedOn = Object.create(OperatingTable.prototype);
        out.knifeTable = startRecovery(f, { type: "knife" }).risk;
        out.scalpelTable2 = (f.recovery = null, startRecovery(f, { type: "scalpel" }), startRecovery(f, { type: "scalpel" }).risk);
        f.placedOn = null;
        out.recovering = isRecovering(f);
        f.recovery = null;
        startRecovery(f, { type: "knife" });
        woundStitched(f);
        out.stitched = f.recovery.risk;
        out.describe = describeRecovery(f);
        // Burnt shut: none
        f.bleedingTimer = 10;
        cauterizeWound(f);
        out.burnt = f.recovery.risk;
        // Sure to go bad: it does, within the recovery
        const g = __mk(400);
        startRecovery(g, { type: "knife" });
        g.recovery.risk = 0.9999;
        for (let t = 0; t < RECOVERY_HOURS * HOUR_LENGTH && !hasInfection(g); t += 5) {
          timePlayed += 5;
          updateRecovery(5);
        }
        out.infected = hasInfection(g);
        out.vet = vetProblems(g).some((p) => p[0] === "infected wound");
        const before = g.health;
        for (let t = 0; t < 100; t += 5) {
          timePlayed += 5;
          updateRecovery(5);
        }
        out.drain = before - g.health;
        out.describeInf = describeRecovery(g);
        cureInfection(g);
        out.cured = !hasInfection(g);
        // An untreated fever can kill
        const h = __mk(600);
        catchInfection(h);
        h.health = 1;
        for (let t = 0; t < 200 && h.isAlive; t += 5) {
          timePlayed += 5;
          updateRecovery(5);
        }
        out.killed = !h.isAlive;
        // Saved
        const saved = JSON.parse(JSON.stringify(g.serialize ? g.serialize() : {}));
        out.savedRec = "recovery" in saved && "infection" in saved;
        return out;
      }, SETUP);
      check(Math.abs(r.scalpelFloor - 0.12) < 1e-9, `scalpel off the table 12%: ${r.scalpelFloor}`);
      check(Math.abs(r.knifeFloor - 0.4) < 1e-9, `knife off the table 40%: ${r.knifeFloor}`);
      check(Math.abs(r.knifeTable - 0.2) < 1e-9, `knife on the table 20%: ${r.knifeTable}`);
      check(Math.abs(r.scalpelTable2 - (1 - 0.97 * 0.97)) < 1e-9, `two cuts add up: ${r.scalpelTable2}`);
      check(r.recovering, "recovering");
      check(Math.abs(r.stitched - 0.2) < 1e-9, `stitched: half: ${r.stitched}`);
      check(r.describe && /infection risk/.test(r.describe[0]), `magnifying glass: ${JSON.stringify(r.describe)}`);
      checkEqual(r.burnt, 0, "burnt shut: no risk");
      check(r.infected, "a likely infection happens");
      check(r.vet, "the vet sees the infected wound");
      check(r.drain > 0, `a fever drains health: ${r.drain}`);
      check(r.describeInf && /Infected/.test(r.describeInf[0]), "the magnifying glass shows the fever");
      check(r.cured, "cured");
      check(r.killed, "an untreated fever can kill");
      check(r.savedRec, "recovery and infection are saved");
    },
  },
  {
    name: "batch6: burnt with the iron, it (and its family watching) fear the iron - and a held iron or running heater frightens it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const victim = __mk(300);
        const mum = __mk(380);
        const stranger = __mk(460);
        setRelationship(mum.id, victim.id, "baby_child");
        out.before = fearOf(victim, "fire");
        out.learntShows = !realFears(victim).some((fe) => fe.key === "fire");
        victim.bleedingTimer = 10;
        cauterizeWound(victim);
        out.victim = fearOf(victim, "fire");
        out.mum = fearOf(mum, "fire");
        out.stranger = fearOf(stranger, "fire");
        out.describe = describeFears(victim)[0];
        // The hot iron in your hand, near it
        victim.currentStateKey = "IDLE";
        victim.fright = null;
        const iron = new CauteryIron("INDOORS");
        iron.isDragging = true;
        iron.x = victim.x + 50;
        iron.y = victim.y;
        objects.push(iron);
        for (let i = 0; i < 30 && !isFrightened(victim); i++) {
          timePlayed += 1;
          updateFears(1);
        }
        out.ironFright = victim.fright && victim.fright.key;
        objects.splice(objects.indexOf(iron), 1);
        // A heater running beside it
        stranger.fright = null;
        stranger.fears = { ...(stranger.fears || {}), fire: 0.9 };
        changeFear(stranger, "fire", 0.9);
        const heater = new Heater("INDOORS");
        heater.x = stranger.x + 40;
        heater.y = stranger.y;
        heater.heating = true;
        objects.push(heater);
        const realUp = window.updateHeating;
        for (let i = 0; i < 300 && !isFrightened(stranger); i++) {
          timePlayed += 1;
          heater.heating = true;
          updateFears(1);
        }
        out.heaterFright = stranger.fright && stranger.fright.key;
        return out;
      }, SETUP);
      checkEqual(r.before, 0, "nobody starts out afraid of the iron");
      check(r.learntShows, "and it isn't listed till learnt");
      check(r.victim >= 0.75, `burnt: terrified: ${r.victim}`);
      check(r.mum >= 0.39 && r.mum < r.victim, `its mum, watching: ${r.mum}`);
      check(r.stranger >= 0.24 && r.stranger < r.mum, `a stranger watching, less: ${r.stranger}`);
      check(/hot iron/i.test(r.describe), `magnifying glass: ${r.describe}`);
      checkEqual(r.ironFright, "fire", "the iron in your hand frightens it");
      checkEqual(r.heaterFright, "fire", "so does a running heater");
    },
  },
  {
    name: "batch6: watching a cull, fluffies dread cages - a cull cage nearby or being put in one frightens them; the Enclosure heals it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const cage = __cage(Cage, 600, 400);
        const doomed = __mk(100);
        const sister = __mk(300, { y: 600 });
        const watcher = __mk(900, { y: 600 });
        setRelationship(sister.id, doomed.id, "sister");
        out.inside = __drop(doomed, cage);
        cage.startCull();
        for (let t = 0; t < 120 && doomed.isAlive; t += 0.25) cage.updateCull(0.25);
        out.doomedDead = !doomed.isAlive;
        out.sister = fearOf(sister, "cages");
        out.watcher = fearOf(watcher, "cages");
        // Let the cage clear, then set it to cull: walking near it frightens
        for (let t = 0; t < 30 && cage.isCulling(); t += 0.25) cage.updateCull(0.25);
        cage.tag = "cull";
        watcher.x = cage.x + 60;
        watcher.y = cage.y + 60;
        for (let i = 0; i < 60 && !isFrightened(watcher); i++) {
          timePlayed += 1;
          updateFears(1);
        }
        out.cullNear = watcher.fright && watcher.fright.key;
        // Put in a plain cage: it panics
        cage.tag = "none";
        sister.fright = null;
        out.sisterIn = __drop(sister, cage);
        out.sisterFright = sister.fright && sister.fright.key;
        // An Enclosure slowly heals it
        const enc = __cage(Enclosure, 300, 300);
        const before = fearOf(watcher, "cages");
        watcher.fright = null;
        watcher.x = 100;
        out.encIn = __drop(watcher, enc);
        out.encFright = !!watcher.fright;
        watcher.fright = null;
        for (let i = 0; i < 4 * HOUR_LENGTH; i++) {
          timePlayed += 1;
          watcher.fright = null;
          updateFears(1);
        }
        out.healed = before - fearOf(watcher, "cages");
        return out;
      }, SETUP);
      check(r.inside && r.doomedDead, `the cull happened: ${JSON.stringify(r)}`);
      check(r.sister >= 0.69, `its sister dreads cages: ${r.sister}`);
      check(r.watcher >= 0.49 && r.watcher < r.sister, `a watcher too, less: ${r.watcher}`);
      checkEqual(r.cullNear, "cages", "a cull cage nearby frightens it");
      check(r.sisterIn && r.sisterFright === "cages", "put in a cage, it panics");
      check(r.encIn && !r.encFright, "the Enclosure doesn't frighten it");
      check(r.healed > 0.09, `and heals the fear: ${r.healed}`);
    },
  },
  {
    name: "batch6: throwing teaches a pegasus to fly - it falls slower, then glides and lands on its feet unhurt, then flies by itself; an earthy doesn't",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const peg = __mk(300, { type: "pegasus" });
        const earthy = __mk(700);
        // Thrown from 300px up, sideways: how long in the air, how hard it lands
        const throwIt = (f) => {
          f.health = 100;
          f.throwStartY = f.y;
          f.y -= 300;
          f.throwFallVx = 200;
          f.throwFallVy = 0;
          f.isFallingFromThrow = true;
          let t = 0;
          let maxVy = 0;
          while (f.isFallingFromThrow && t < 20) {
            f.physics.updateThrowFall(1 / 60);
            maxVy = Math.max(maxVy, f.throwFallVy || 0);
            t += 1 / 60;
          }
          f.x = Math.min(Math.max(f.x, 200), 900);
          return { t, maxVy, hurt: 100 - f.health, state: f.currentStateKey };
        };
        out.first = throwIt(peg);
        out.skill1 = peg.flightSkill;
        for (let i = 0; i < 4; i++) throwIt(peg);
        out.skill5 = peg.flightSkill;
        out.glide = throwIt(peg);
        out.describeGlide = describeFlight(peg);
        out.earthy = throwIt(earthy);
        out.earthySkill = earthy.flightSkill || 0;
        out.earthyDescribe = describeFlight(earthy);
        // Flies by itself: heading far, it takes off and lands there lightly
        peg.flightSkill = 0.9;
        peg.x = 200;
        peg.y = 500;
        peg.currentStateKey = "IDLE";
        out.solo = startSoloFlight(peg, 700, 560);
        let t = 0;
        while (peg.isFallingFromThrow && t < 10) {
          peg.physics.updateThrowFall(1 / 60);
          t += 1 / 60;
        }
        out.landed = { x: Math.round(peg.x), y: Math.round(peg.y), state: peg.currentStateKey, flight: peg._flight };
        out.describeSolo = describeFlight(peg);
        // No wings, no flying
        peg.flightSkill = 0.9;
        const realWings = peg.hasBothWings;
        peg.hasBothWings = () => false;
        out.noWings = startSoloFlight(peg, 100, 500);
        out.noWingsDescribe = describeFlight(peg);
        peg.hasBothWings = realWings;
        return out;
      }, SETUP);
      check(Math.abs(r.skill1 - 0.08) < 1e-9, `a throw teaches it a little: ${r.skill1}`);
      check(r.first.state === "FLUFFY_KNOCKED_DOWN", `at first it lands in a heap: ${JSON.stringify(r.first)}`);
      check(r.skill5 >= 0.39, `five throws: ${r.skill5}`);
      check(r.glide.t > r.first.t * 1.15, `it falls slower now: ${r.first.t.toFixed(2)}s -> ${r.glide.t.toFixed(2)}s`);
      check(r.glide.maxVy <= 480.01, `gliding: its fall is capped: ${r.glide.maxVy}`);
      check(r.glide.hurt === 0 && r.glide.state !== "FLUFFY_KNOCKED_DOWN", `lands on its feet, unhurt: ${JSON.stringify(r.glide)}`);
      check(/Glides/.test(r.describeGlide[0]), `magnifying glass: ${r.describeGlide}`);
      checkEqual(r.earthySkill, 0, "an earthy learns nothing");
      check(r.earthy.hurt > 0, `and still lands hard: ${JSON.stringify(r.earthy)}`);
      checkEqual(r.earthyDescribe, null, "and has no flying line");
      check(r.solo, "a skilled one takes off by itself");
      check(Math.abs(r.landed.x - 700) < 25 && Math.abs(r.landed.y - 560) < 2, `and lands where it was going: ${JSON.stringify(r.landed)}`);
      check(r.landed.state === "IDLE" && !r.landed.flight, `lightly: ${JSON.stringify(r.landed)}`);
      check(/by itself/.test(r.describeSolo[0]), `magnifying glass: ${r.describeSolo}`);
      checkEqual(r.noWings, false, "no wings, no flying");
      check(/Can't fly/.test(r.noWingsDescribe[0]), `magnifying glass: ${r.noWingsDescribe}`);
    },
  },
  {
    name: "batch6: your nursing mare fosters your orphan in the house - a bond for life, and grief when one of them is sold",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const mare = __mk(300);
        mare.traitShift = { temper: -0.6 - traitValue(mare, "temper") };
        const own = __mk(330, { growth: 0.05 });
        own.motherId = mare.id;
        setRelationship(mare.id, own.id, "baby_child");
        mare.lactatingTimer = 500;
        const orphan = __mk(520, { growth: 0.05, gender: "male" });
        orphan.motherId = 9999;
        orphan.hunger = 0.3; // (crying for a mum)
        const wild = __mk(560, { growth: 0.05, adopted: false });
        wild.motherId = 9998;
        out.reason = fosterMumReason(mare);
        out.canYours = canFoster(mare, orphan);
        out.canWild = canFoster(mare, wild);
        const msgs = [];
        const realMsg = window.addUIMessage;
        window.addUIMessage = (m) => msgs.push(m);
        for (let t = 0; t < 60 * 60 && orphan.motherId !== mare.id; t += 0.5) {
          timePlayed += 0.5;
          mare.hunger = 1;
          orphan.hunger = 0.3;
          mare.update(0.5);
          updateFostering(0.5);
        }
        out.taken = orphan.motherId === mare.id;
        out.fosterMum = orphan.fosterMumId === mare.id;
        out.wildLeft = wild.motherId === 9998;
        out.msg = msgs.find((m) => /taken in/.test(m)) || null;
        out.liking = getLiking(orphan, mare);
        out.likingMare = getLiking(mare, orphan);
        out.bonus = fosterLikingBonus(orphan, mare);
        out.describeFoal = describeFoster(orphan);
        out.describeMare = describeFoster(mare);
        // Sold: she grieves
        const happyBefore = mare.happiness;
        noteFluffyLeft(orphan, "sold", 100);
        out.unhappier = happyBefore - mare.happiness;
        out.grieving = mare.lostFoalAt === timePlayed;
        window.addUIMessage = realMsg;
        return out;
      }, SETUP);
      checkEqual(r.reason, "kind", "a gentle mare of yours, nursing her own");
      check(r.canYours, "can take in your orphan");
      checkEqual(r.canWild, false, "not a wild one");
      check(r.taken && r.fosterMum, `takes it in: ${JSON.stringify(r)}`);
      check(r.wildLeft, "the wild orphan is left");
      check(r.msg, "you're told");
      checkEqual(r.bonus, 0.15, "a bond for life");
      check(r.liking >= 0.9 && r.likingMare >= 0.9, `they love each other: ${r.liking}, ${r.likingMare}`);
      check(r.describeFoal && /Taken in by/.test(r.describeFoal[0]), "magnifying glass (foal)");
      check(r.describeMare && /Foster mum to/.test(r.describeMare[0]), "magnifying glass (mare)");
      check(r.unhappier >= 0.29, `sold: she grieves: ${r.unhappier}`);
      check(r.grieving, "and is a grieving mum again");
    },
  },
];
