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
    name: "batch6: a very premature foal is frail for hours - left cold and hungry it weakens and can die; a full-term one isn't frail",
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
      checkEqual(r.frailLeft, 0.6 * 1200, "very premature: frail for most of its time on milk");
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
    name: "batch6: a pegasus can't fly, but its wings break a fall - it's hurt less than an earthy, more so as its wings get stronger with each throw; strong wings land it on its feet from a small fall; it never takes off by itself",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const peg = __mk(300, { type: "pegasus" });
        const earthy = __mk(700);
        // Thrown from (up) px up, sideways: how hard it lands
        const throwIt = (f, up) => {
          f.health = 100;
          f.currentStateKey = "IDLE";
          f.throwStartY = f.y;
          f.y -= up;
          f.throwFallVx = 200;
          f.throwFallVy = 0;
          f.isFallingFromThrow = true;
          let t = 0;
          while (f.isFallingFromThrow && t < 20) {
            f.physics.updateThrowFall(1 / 60);
            t += 1 / 60;
          }
          f.x = Math.min(Math.max(f.x, 200), 900);
          return { t: +t.toFixed(2), hurt: +(100 - f.health).toFixed(1), state: f.currentStateKey };
        };
        out.earthyHigh = throwIt(earthy, 300);
        out.pegHigh = throwIt(peg, 300);
        out.skill1 = peg.flightSkill;
        peg.flightSkill = 1;
        out.strongHigh = throwIt(peg, 300);
        out.earthyLow = throwIt(earthy, 100);
        out.strongLow = throwIt(peg, 100);
        out.describeStrong = describeFlight(peg);
        out.earthyDescribe = describeFlight(earthy);
        out.earthySkill = earthy.flightSkill || 0;
        // It never flies
        out.noFlying = typeof startSoloFlight === "undefined" && typeof glideSpeed === "undefined" && !SYSTEMS.some((x) => x.name === "flight");
        // No wings
        const realWings = peg.hasBothWings;
        peg.hasBothWings = () => false;
        out.noWings = describeFlight(peg);
        out.noWingsHigh = throwIt(peg, 300);
        peg.hasBothWings = realWings;
        return out;
      }, SETUP);
      check(r.pegHigh.hurt < r.earthyHigh.hurt && r.pegHigh.hurt > 0, `a high fall: a pegasus is hurt less than an earthy: ${JSON.stringify(r)}`);
      check(Math.abs(r.skill1 - 0.05) < 1e-9, `each throw makes its wings a little stronger: ${r.skill1}`);
      check(r.strongHigh.hurt < r.pegHigh.hurt / 1.5, `strong wings: hurt far less: ${JSON.stringify(r.strongHigh)}`);
      check(r.earthyLow.hurt > 0 && r.earthyLow.state === "FLUFFY_KNOCKED_DOWN", `a small fall hurts an earthy: ${JSON.stringify(r.earthyLow)}`);
      check(r.strongLow.hurt === 0 && r.strongLow.state === "IDLE", `strong wings: on its feet, unhurt: ${JSON.stringify(r.strongLow)}`);
      check(/Very strong/.test(r.describeStrong[0]), `magnifying glass: ${r.describeStrong}`);
      checkEqual(r.earthyDescribe, null, "an earthy has no wings line");
      checkEqual(r.earthySkill, 0, "and nothing to build up");
      check(r.noFlying, "nothing takes off or glides");
      check(/Can't flap/.test(r.noWings[0]) && r.noWingsHigh.hurt >= r.earthyHigh.hurt - 0.5, `no wings: no help: ${JSON.stringify(r)}`);
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
  {
    name: "batch6: a foal that outgrows the incubator climbs out; a fluffy caught by hand in mid-air (thrown or hopping) is held, not still falling",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const inc = __cage(Incubator, 400, 400);
        const foal = __mk(100, { growth: 0.2 });
        out.in = __drop(foal, inc);
        foal.growth = INCUBATOR_MAX_GROWTH + 0.01;
        updatePrematureCare(1.5);
        out.out = foal.currentCage === null && foal.y > inc.bounds.bottom;
        // Thrown, then grabbed by hand
        const peg = __mk(600, { type: "pegasus" });
        peg.throwStartY = peg.y;
        peg.y -= 250;
        peg.throwFallVx = 300;
        peg.isFallingFromThrow = true;
        peg.physics.updateThrowFall(1 / 60);
        peg.isDragging = true;
        out.fallingAfterGrab = peg.physics.updateThrowFall(1 / 60);
        out.cleared = !peg.isFallingFromThrow && peg.throwStartY === null && !peg._flight;
        peg.isDragging = false;
        // A flutter hop, then caught
        peg.y = 500;
        peg.currentStateKey = "IDLE";
        perchHop(peg, null);
        out.solo = peg.isFallingFromThrow;
        peg.physics.updateThrowFall(1 / 60);
        peg.isDragging = true;
        peg.physics.updateThrowFall(1 / 60);
        out.soloCleared = !peg.isFallingFromThrow && !peg._flight;
        peg.isDragging = false;
        return out;
      }, SETUP);
      check(r.in && r.out, `outgrown: put out beside it: ${JSON.stringify(r)}`);
      checkEqual(r.fallingAfterGrab, false, "caught: no longer falling");
      check(r.cleared, "and its throw is over");
      check(r.solo && r.soloCleared, `caught mid-hop too: ${JSON.stringify(r)}`);
    },
  },
];
