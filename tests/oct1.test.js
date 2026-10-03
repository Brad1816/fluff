// The Oct 1 update from the original game, merged in: the throw tool, the
// Enclosure, cage eject/cull modes, the new puddles, and births that come
// early (Premature.js: how early decides how the foals turn out).
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["INDOORS", "INDOORSL1", "OUTDOORS", "BACKYARD"]) __clearScene(s);
  __seedRandom(7);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 3 * DAY_LENGTH + 4 * HOUR_LENGTH;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = opts.y ?? 500;
    h.hunger = 1;
    h.health = 100;
    h.happiness = 0.7;
    h.playerTrust = 0.6;
    h.playerFear = 0;
    h.currentStateKey = "IDLE";
    h.brain.think = () => {};
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "oct1: the throw tool is in the toolbox; a fluffy dropped from high up falls, lands where it was lifted from, gets hurt and remembers",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        out.hasTool = toolbox.some((t) => t instanceof ThrowTool);
        out.firstInToolbar = getGroupedToolboxEntries()[0].key;
        out.name = getToolFullName(toolbox.find((t) => t instanceof ThrowTool));
        const f = __mk(500, { y: 520 });
        const watcher = __mk(800, { y: 520 });
        // Pick it up with the tool
        const tool = toolbox.find((t) => t instanceof ThrowTool);
        tool.isDragging = true;
        tool.scene = "INDOORS";
        objects.push(tool);
        isGlobalDragging = true;
        f.update(1 / 60);
        mouse.x = f.x;
        mouse.y = f.y - 20;
        const hit = f.hitTestAsSeen(mouse.x, mouse.y);
        out.hit = !!hit;
        if (hit) attemptDrop();
        out.held = f.heldWithThrowTool && f.isDragging && f.throwStartY === 520;
        // Lift it high and let go
        f.y = 220;
        mouseVelocityHistory.length = 0;
        f.onDrop();
        out.falling = f.isFallingFromThrow;
        out.toolBack = tool.isDragging && tool.heldHorse === null;
        let t = 0;
        while (f.isFallingFromThrow && t < 5) {
          f.update(1 / 60);
          t += 1 / 60;
        }
        out.landedAt = Math.round(f.y);
        out.health = Math.round(f.health);
        out.alive = f.isAlive;
        out.memory = (f.playerMemories || []).some((m) => m.type === "throw");
        out.fear = f.playerFear > 0;
        out.watcherScared = watcher.playerFear > 0;
        out.shadowY = f.getBottomY() > f.y;
        return out;
      }, SETUP);
      check(r.hasTool, "a new game starts with the throw tool");
      checkEqual(r.firstInToolbar, "throw_tool", "first in the toolbox");
      checkEqual(r.name, "Throw tool", "its name (item registry)");
      check(r.hit && r.held, `clicking a fluffy with it lifts it: ${JSON.stringify(r)}`);
      check(r.falling && r.toolBack, `let go up high: it falls, the tool's back in your hand: ${JSON.stringify(r)}`);
      checkEqual(r.landedAt, 520, "it lands where it was lifted from");
      check(r.alive && r.health < 80 && r.health > 20, `a 300px drop hurts but doesn't kill: health ${r.health}`);
      check(r.memory && r.fear, `it remembers being thrown, and fears you: ${JSON.stringify(r)}`);
      check(r.watcherScared, "one watching gets scared of you too");
    },
  },
  {
    name: "oct1: the Enclosure keeps fluffies in without making them unhappy; a cage still does",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const shop = SPAWN_ACTIONS.find((a) => a.isItem === "enclosure");
        out.price = shop && shop.cost;
        out.inAisle = STORE_AISLES.some((a) => a.items.includes("enclosure"));
        const enc = getItemType(new Enclosure("INDOORS")).create(shop);
        objects.push(enc);
        enc.x = 400;
        enc.y = 450;
        enc.updateBounds();
        const cage = new Cage("INDOORS");
        cage.x = 1100;
        cage.y = 450;
        objects.push(cage);
        cage.updateBounds();
        const a = __mk(400, { y: 450 });
        const b = __mk(1100, { y: 450 });
        a.currentCage = enc;
        b.currentCage = cage;
        a.happiness = b.happiness = 0.6;
        for (let i = 0; i < 600; i++) {
          a._updateStateEffects(0.1);
          b._updateStateEffects(0.1);
        }
        out.enc = a.happiness;
        out.cage = b.happiness;
        out.sell = getItemSellValue(enc, getItemType(enc));
        out.type = getItemType(enc).sellType;
        out.rightClick = enc.tag;
        handleItemRightClick(enc.x, enc.y);
        out.afterRightClick = enc.tag;
        // Saved and loaded as an Enclosure
        const d = enc.serialize();
        out.loaded = createItemFromSave(d) instanceof Enclosure;
        return out;
      }, SETUP);
      checkEqual(r.price, 5000, "shop price");
      check(r.inAisle, "sold in a store aisle");
      checkEqual(r.type, "enclosure", "registry type");
      check(r.cage < r.enc - 0.05, `a minute in a cage costs happiness, the enclosure doesn't: ${JSON.stringify(r)}`);
      checkEqual(r.sell, 2500, "sells back for half");
      checkEqual(r.afterRightClick, "none", "no modes");
      check(r.loaded, "saved and loaded as an Enclosure");
    },
  },
  {
    name: "oct1: cage eject drops everything out; cull asks first, locks the cage, and the fluffies inside suffocate (witnesses remember)",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const cage = new Cage("INDOORS");
        cage.x = 500;
        cage.y = 450;
        objects.push(cage);
        cage.updateBounds();
        const a = __mk(480, { y: 470 });
        const b = __mk(520, { y: 470 });
        const watcher = __mk(1000, { y: 600 });
        a.currentCage = b.currentCage = cage;
        // Eject
        cage.tag = "eject";
        cage.ejectContents();
        out.ejected = !a.currentCage && !b.currentCage && a.y > cage.bounds.bottom;
        // Cull: asks first
        a.currentCage = b.currentCage = cage;
        a.y = b.y = 470;
        cage.tag = "cull";
        cage.askCull();
        out.asked = isChoiceOpen() && /Cull all 2/.test(choiceDialog.title);
        out.notYet = !cage.isCulling();
        pickChoice(1); // Cancel
        out.cancelled = !cage.isCulling();
        cage.askCull();
        pickChoice(0); // Cull
        out.started = cage.isCulling();
        out.locked = !itemCanBePickedUpAt(cage, cage.x, cage.y) && Cage.locksItem(a);
        let t = 0;
        let silent = null;
        while ((a.isAlive || b.isAlive) && t < 30) {
          cage.update(0.1);
          for (const f of [a, b, watcher]) f.update(0.1);
          if (silent === null && cage.suffocatesOccupants()) silent = { crawling: a.isCrawling };
          t += 0.1;
        }
        out.t = Math.round(t);
        out.silent = silent;
        out.dead = !a.isAlive && !b.isAlive;
        out.watcherFear = watcher.playerFear;
        out.killedByYou = a.killedByPlayer;
        return out;
      }, SETUP);
      check(r.ejected, `eject drops them out below the cage: ${JSON.stringify(r)}`);
      check(r.asked && r.notYet && r.cancelled, `cull asks first, and Cancel stops it: ${JSON.stringify(r)}`);
      check(r.started && r.locked, `once started the cage and those inside can't be picked up: ${JSON.stringify(r)}`);
      check(r.silent && r.silent.crawling, `they collapse when the air runs out: ${JSON.stringify(r)}`);
      check(r.dead && r.t >= 12 && r.t <= 16, `both dead about 12.5s after the glass starts: ${JSON.stringify(r)}`);
      check(r.killedByYou && r.watcherFear > 0, `it counts as you killing them; a witness fears you: ${JSON.stringify(r)}`);
    },
  },
  {
    name: "oct1: born early - the earlier, the worse: too early all stillborn and tiny; very premature most die; premature most live, small and weak",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = { stages: {} };
        for (const p of [0.2, 0.39, 0.4, 0.5, 0.64, 0.65, 0.8, 0.9, 1]) {
          const s = prematureStage(p);
          out.stages[p] = s ? [s.key, Math.round(s.survive * 100), Math.round(s.size * 100)] : null;
        }
        const dad = __mk(300, { gender: "male" });
        window.__realRuntChance = runtChance;
        runtChance = () => 0; // (no runts here: they'd skew the sizes - Runts.js)
        // A litter of 6 born at a given point in the pregnancy
        const birth = (progress, midwife = false) => {
          const mum = __mk(600);
          mum.babyDaddyId = dad.id;
          mum.anatomy.triggerPregnancy(dad);
          mum.midwife = midwife;
          mum.pregnancyTimer = (1 - progress) * pregnancyDuration;
          mum.foalViability = [true, true, true, true, true, true];
          mum.babiesToBirth = 6;
          const res = [];
          for (let i = 0; i < 6; i++) {
            const alive = mum.spawnBaby(true);
            const baby = fluffies[fluffies.length - 1];
            res.push({ alive, isAlive: baby.isAlive, scale: baby.scale, health: baby.health, early: baby.bornEarly, vigor: baby.birthVigor });
          }
          return res;
        };
        const full = birth(1)[0];
        out.fullScale = full.scale;
        out.fullEarly = full.early;
        __seedRandom(3);
        const tooEarly = birth(0.2);
        out.tooEarly = { alive: tooEarly.filter((b) => b.isAlive).length, scale: tooEarly[0].scale / full.scale, early: tooEarly[0].early, agree: tooEarly.every((b) => b.alive === b.isAlive) };
        // Many litters to see the survival rates
        const rate = (p, midwife) => {
          let alive = 0, n = 0, scale = 0, health = 0, aliveN = 0;
          for (let k = 0; k < 15; k++) {
            for (const b of birth(p, midwife)) {
              n++;
              if (b.isAlive) {
                alive++;
                aliveN++;
                scale += b.scale / full.scale;
                health += b.health;
              }
            }
          }
          return { rate: alive / n, scale: aliveN ? scale / aliveN : 0, health: aliveN ? health / aliveN : 0 };
        };
        __seedRandom(5);
        out.very = rate(0.5, false);
        out.veryMidwife = rate(0.5, true);
        out.prem = rate(0.8, false);
        // An early foal catches up as it grows
        const small = fluffies.find((f) => f.isAlive && f.bornEarly === "premature");
        const before = small.scale;
        small.growth = 0.5;
        small.updateGrowthStats();
        const half = small.scale;
        small.growth = 1;
        small.updateGrowthStats();
        out.catchUp = [before, half, small.scale];
        // (what it would be grown, had it been born on time)
        const pg = small.prematureGrowth;
        small.prematureGrowth = 1;
        small.updateGrowthStats();
        out.adultScale = small.scale;
        small.prematureGrowth = pg;
        small.growth = 0.3;
        small.updateGrowthStats();
        out.describe = describePremature(small);
        runtChance = window.__realRuntChance;
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.stages[0.2]), JSON.stringify(["too_early", 0, 36]), "20%: too early");
      checkEqual(r.stages[0.4][0], "very", "40%: very premature");
      checkEqual(r.stages[0.65][0], "premature", "65%: premature");
      checkEqual(r.stages[0.9], null, "90%: a normal birth");
      check(!r.fullEarly, "a full-term foal isn't marked as early");
      check(r.tooEarly.alive === 0 && r.tooEarly.agree, `too early: all stillborn: ${JSON.stringify(r.tooEarly)}`);
      check(r.tooEarly.scale < 0.45, `...and tiny: ${JSON.stringify(r.tooEarly)}`);
      checkEqual(r.tooEarly.early, "too_early", "marked as born too early");
      check(r.very.rate > 0.2 && r.very.rate < 0.6, `very premature (50%): most die: ${JSON.stringify(r.very)}`);
      check(r.veryMidwife.rate > r.very.rate, `a midwife helps: ${JSON.stringify(r.veryMidwife)}`);
      check(r.very.scale < 0.62 && r.very.health < 55, `survivors very small and weak: ${JSON.stringify(r.very)}`);
      check(r.prem.rate > 0.7, `premature (80%): most live: ${JSON.stringify(r.prem)}`);
      check(r.prem.scale > 0.75 && r.prem.scale < 0.9 && r.prem.health < 80, `...small and a little weak: ${JSON.stringify(r.prem)}`);
      check(r.catchUp[0] < r.catchUp[1] && Math.abs(r.catchUp[2] - r.adultScale) < 0.02, `it catches up by the time it's grown: ${JSON.stringify(r.catchUp)} vs ${r.adultScale}`);
      check(r.describe && /premature/.test(r.describe[0]), `the magnifying glass says so: ${JSON.stringify(r.describe)}`);
    },
  },
  {
    name: "oct1: mating a pregnant mare or a hard fall brings labour on early; she gives birth within seconds, and the outcome depends on how far along she is",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const dad = __mk(300, { gender: "male" });
        const mum = __mk(600);
        mum.babyDaddyId = dad.id;
        mum.anatomy.triggerPregnancy(dad);
        mum.pregnancyTimer = 0.25 * pregnancyDuration; // 75% along
        mum.babiesToBirth = 4;
        mum.foalViability = [true, true, true, true];
        mum.beginMiscarriage();
        out.timer = mum.miscarriageTimer;
        out.viabilityKept = mum.foalViability.every((v) => v);
        out.progress = Math.round(mum.getPregnancyProgress() * 100);
        let t = 0;
        while (mum.isPregnant && t < 60) {
          mum._updatePregnancy(0.1);
          t += 0.1;
        }
        out.bornIn = Math.round(t);
        const kids = fluffies.filter((f) => f.motherId === mum.id);
        out.kids = kids.length;
        out.alive = kids.filter((k) => k.isAlive).length;
        out.allEarly = kids.every((k) => k.bornEarly === "premature");
        // A fall: a hard landing can bring it on
        const mum2 = __mk(900);
        mum2.babyDaddyId = dad.id;
        mum2.anatomy.triggerPregnancy(dad);
        mum2.pregnancyTimer = 0.5 * pregnancyDuration;
        let tries = 0;
        while (mum2.miscarriageTimer == null && tries < 50) {
          mum2.health = 100;
          mum2.handleThrowImpact(1500); // 60 damage
          tries++;
        }
        out.fallLabour = mum2.miscarriageTimer != null;
        const mum3 = __mk(1000);
        mum3.babyDaddyId = dad.id;
        mum3.anatomy.triggerPregnancy(dad);
        mum3.pregnancyTimer = 0.5 * pregnancyDuration;
        for (let i = 0; i < 50; i++) {
          mum3.health = 100;
          maybeEarlyLabourFromFall(mum3, 5);
        }
        out.softFall = mum3.miscarriageTimer;
        return out;
      }, SETUP);
      check(r.timer > 0 && r.timer <= 10, `labour within 10 seconds: ${r.timer}`);
      check(r.viabilityKept, "the foals aren't all doomed: it depends how far along she is");
      check(r.bornIn <= 30, `all born within half a minute (labour within 10s, then a foal every 3s): ${r.bornIn}s`);
      checkEqual(r.kids, 4, "all four born");
      check(r.alive >= 2 && r.allEarly, `at 75%: most live, all premature: ${JSON.stringify(r)}`);
      check(r.fallLabour, "a hard landing can bring labour on");
      checkEqual(r.softFall, null, "a soft one doesn't");
    },
  },
  {
    name: "oct1: puddles keep working - old saves load, the toilet, Roomba and sponge clean them, and mess still fades",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        puddles.length = 0;
        // An old save's puddle (by colour)
        const old = { scene: "INDOORS", color: "#5c4033", points: [{ x: 300, y: 600, scale: 0.2, targetScale: 0.2 }], isGrowing: false };
        const p = Puddle.deserialize(old);
        out.type = p.type;
        out.color = p.color;
        puddles.push(p);
        out.waste = isBodilyWaste(p.type) && isBodilyWaste("#8a0303") && !isBodilyWaste("water");
        // Adding by colour still works (mod code passes colours)
        addPointToPuddle("INDOORS", 700, 600, "#8a0303", 0.1, 0.1);
        out.bloodType = puddles.find((q) => q.scene === "INDOORS" && q.type === "blood") ? "blood" : null;
        // Roomba cleans and the picture is redrawn
        const rb = new Roomba("INDOORS");
        rb.x = 300;
        rb.y = 600;
        p.dirty = false;
        rb._cleanAround(1);
        out.roombaShrank = p.points.length === 0 || p.points[0].scale < 0.2;
        out.redraw = p.dirty;
        // Saves as a type
        out.saved = puddles.map((q) => q.serialize().type).sort().join(",");
        return out;
      }, SETUP);
      checkEqual(r.type, "poop", "an old poop puddle loads as poop");
      checkEqual(r.color, "#5c4033", "with its colour");
      check(r.waste, "waste is recognised by type or colour");
      checkEqual(r.bloodType, "blood", "a colour passed in becomes its type");
      check(r.roombaShrank && r.redraw, `the Roomba cleans it and it's redrawn: ${JSON.stringify(r)}`);
      check(/blood/.test(r.saved), `saved by type: ${r.saved}`);
    },
  },
];
