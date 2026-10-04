// Batch 10 (playtest observations): volume, room space, slower grass, mess
// and rot; alicorn stances, indifference and grief; the Mood tab; family tree
// -> relationships; the breeding cage; tap-to-cull; stick scars; mower and
// foals; skipping ahead; inbreeding and deformities; sensitive breeding; the
// gene planner; the shelter drop box; shop icons; sensitive foals riding;
// herd feuds, wars and rotting bodies.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD"]) __clearScene(s);
  __seedRandom(101);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 4 * DAY_LENGTH;
  herdState = freshHerdState();
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 520;
    h.hunger = 1;
    h.health = 100;
    h.happiness = 0.6;
    h.currentStateKey = "IDLE";
    h.brain.think = () => {};
    h.alicornIndifferent = false;
    if (opts.name) fluffyNames[h.id] = opts.name;
    fluffies.push(h);
    return h;
  };
  window.__herd = (members, leader) => {
    const h = { id: herdState.nextId++, name: "Oak" + herdState.nextId, leaderId: (leader || members[0]).id, memberIds: members.map((m) => m.id), colorIndex: 0, formedAt: 0 };
    herdState.list.push(h);
    _herdChanged();
    return h;
  };
}`;

module.exports = [
  {
    name: "batch10: quieter by default, roomier rooms, slower grass, mess that lasts, quicker rot",
    run: async (page) => {
      const r = await page.evaluate(() => ({
        vol: masterVolume,
        house: ROOM_SPACE.house,
        yard: ROOM_SPACE.BACKYARD,
        regrow: GRASS_REGROW,
        poop: MESS_FADE.poop,
        rain: RAIN_WASH,
        rot: [ROT_START, ROT_FULL, ROT_GONE],
      }));
      check(r.vol <= 0.2 + 1e-9, `volume starts at 20%: ${r.vol}`);
      check(r.house >= 20 && r.yard >= 30, `room space: house ${r.house}, yard ${r.yard}`);
      check(r.regrow >= 200, `grass regrows slower: ${r.regrow}`);
      check(r.poop <= 0.3 && r.rain <= 0.005, `poop fades slowly (${r.poop}), rain washes slowly (${r.rain})`);
      check(r.rot[2] <= 720, `rots away within ~14 hours: ${r.rot}`);
    },
  },
  {
    name: "batch10: alicorns - grown fluffies steer clear, the fierce go for a weak one, foals flee; a few don't care; no grief for a dead one",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        worldSettings.alicornIntolerance = true;
        const a = __mk(400, { type: "alicorn", name: "Sky" });
        const calm = __mk(500, { name: "Calm" });
        calm.traitShift = { bravery: -0.2, temper: -0.5 };
        const out = { near: alicornStance(calm, a) };
        calm.x = 400 + ALICORN_AVOID_NEAR + 100;
        out.far = alicornStance(calm, a);
        const foal = __mk(450, { growth: 0.4 });
        out.foal = alicornStance(foal, a);
        const fierce = __mk(480, { name: "Fierce" });
        fierce.traitShift = { bravery: 1 };
        out.fierceVsGrown = alicornStance(fierce, a);
        a.health = 40;
        out.fierceVsHurt = alicornStance(fierce, a);
        // Indifference: about 1 in 12
        let n = 0;
        for (let i = 0; i < 2000; i++) {
          const f = { type: "earthy", alicornTolerance: false };
          rollAlicornIndifference(f);
          if (f.alicornIndifferent) n++;
        }
        out.indifferent = n / 2000;
        const g = { type: "earthy", alicornTolerance: true, alicornIndifferent: true, tolerantOfAlicorns: () => true };
        out.row = describeAlicornFeeling(g);
        // Grief
        a.die(null, "test");
        out.shrug = shrugsOffAlicornDeath(calm, a);
        const plain = __mk(300);
        plain.die(null, "test");
        out.shrugPlain = shrugsOffAlicornDeath(calm, plain);
        return out;
      }, SETUP);
      checkEqual(r.near, "avoid", "a calm grown fluffy near a grown alicorn steers clear");
      checkEqual(r.far, "ignore", "far off it ignores it");
      checkEqual(r.foal, "flee", "a foal runs");
      checkEqual(r.fierceVsGrown, "avoid", "a fierce one leaves a healthy grown alicorn alone");
      checkEqual(r.fierceVsHurt, "attack", "a fierce one goes for a hurt alicorn");
      check(r.indifferent > 0.05 && r.indifferent < 0.11, `about 8% don't care: ${r.indifferent}`);
      check(r.row && /Doesn't care/.test(r.row[0]), `row: ${r.row}`);
      check(r.shrug && !r.shrugPlain, "a dead alicorn isn't grieved, a dead earthy is");
    },
  },
  {
    name: "batch10: the Mood tab lists what raised and lowered its mood, and draws",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400, { name: "Daisy" });
        f.changeHappiness(-0.1, "Hungry");
        f.changeHappiness(0.05, "Played");
        f.changeHappiness(0.02);
        const M = moodFactors(f);
        const cv = document.createElement("canvas");
        cv.width = 900;
        cv.height = 600;
        let err = null;
        try {
          drawMoodTab(cv.getContext("2d"), f, { x: 20, y: 20, w: 800, h: 500 });
        } catch (e) {
          err = String(e);
        }
        return { lately: M.lately.map((x) => [x.label, Math.round(x.points)]), settle: M.settle, err, tab: INSPECTION_TABS.some((t) => t.id === "mood") };
      }, SETUP);
      const get = (k) => (r.lately.find((x) => x[0] === k) || [])[1];
      checkEqual(get("Hungry"), -10, "hungry -10");
      checkEqual(get("Played"), 5, "played +5");
      checkEqual(get("Other things"), 2, "unnamed changes go under Other things");
      check(!r.err, `draws: ${r.err}`);
      check(r.tab, "there's a Mood tab");
    },
  },
  {
    name: "batch10: family tree -> relationships; tapping a cull cage asks; the stick only scars from a beating",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400, { name: "Daisy" });
        openFamilyTree(f.id);
        familyTreeToRelationships();
        const out = { map: relMapOpen, sel: relMapSel === f.id };
        closeRelationshipMap();
        // Cull cage
        const cage = new Cage("INDOORS");
        cage.x = 600;
        cage.y = 450;
        cage.tag = "cull";
        objects.push(cage);
        cage.update(0);
        const g = __mk(600);
        g.y = cage.bounds.bottom - 40;
        g.currentCage = cage;
        out.emptyTap = new Cage("INDOORS").tapAction();
        out.tap = cage.tapAction();
        out.asked = isChoiceOpen();
        closeAllChoices();
        objects.splice(objects.indexOf(cage), 1);
        // Stick scars
        const s = __mk(300);
        const beat = [];
        for (let i = 0; i < 4; i++) {
          beat.push(_stickBeating(s));
          timePlayed += 5;
        }
        const t = __mk(320);
        const spaced = [];
        for (let i = 0; i < 6; i++) {
          spaced.push(_stickBeating(t));
          timePlayed += 30;
        }
        out.beat = beat;
        out.spaced = spaced;
        return out;
      }, SETUP);
      check(r.map && r.sel, "the Relationships button opens the map on that fluffy");
      check(!r.emptyTap && r.tap && r.asked, "an empty cage is just picked up; a full cull cage asks on a tap");
      checkEqual(JSON.stringify(r.beat), "[false,false,false,true]", "4 hits in one go is a beating");
      check(!r.spaced.some(Boolean), "whacks spaced out never scar");
    },
  },
  {
    name: "batch10: the breeding cage - a fit pair breeds; with a problem it says why instead of hurting him",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = __mk(400, { gender: "male", name: "Bo" });
        const mare = __mk(420, { name: "Sue" });
        const out = { none: forcedBreedingProblem(m, mare) };
        mare.isPregnant = true;
        out.preg = forcedBreedingProblem(m, mare);
        mare.isPregnant = false;
        m.specialHuggiesCooldown = 30;
        out.cool = forcedBreedingProblem(m, mare);
        m.specialHuggiesCooldown = 0;
        out.noMare = forcedBreedingProblem(m, null);
        // End to end, in a breeding cage
        const cage = new Cage("INDOORS");
        cage.x = 600;
        cage.y = 450;
        cage.tag = "breeding";
        objects.push(cage);
        cage.update(0);
        let pregnant = 0;
        let mated = 0;
        let eligible = 0;
        for (let k = 0; k < 6; k++) {
          const bo = __mk(580, { gender: "male" });
          const su = __mk(620);
          for (const f of [bo, su]) {
            f.y = cage.bounds.bottom - 40;
            f.currentCage = cage;
          }
          bo.update(0.01);
          su.update(0.01);
          if (forcedBreedingProblem(bo, su)) {
            // (a stallion not into mares can't be made to: the cage says so instead)
            for (const f of [bo, su]) fluffies.splice(fluffies.indexOf(f), 1);
            continue;
          }
          eligible++;
          if (bo.mateWith(su, true, true)) mated++;
          for (let i = 0; i < 120; i++) {
            bo.update(0.1);
            su.update(0.1);
          }
          if (su.isPregnant) pregnant++;
          for (const f of [bo, su]) fluffies.splice(fluffies.indexOf(f), 1);
        }
        objects.splice(objects.indexOf(cage), 1);
        out.mated = mated;
        out.eligible = eligible;
        out.pregnant = pregnant;
        return out;
      }, SETUP);
      checkEqual(r.none, null, "a fit pair has no problem");
      check(/pregnant/.test(r.preg), r.preg);
      check(/rest/.test(r.cool), r.cool);
      check(/no grown mare/.test(r.noMare), r.noMare);
      check(r.eligible >= 4 && r.mated === r.eligible && r.pregnant >= r.eligible / 2, `forced in the cage: mated ${r.mated}/${r.eligible}, pregnant ${r.pregnant}`);
    },
  },
  {
    name: "batch10: the mower shreds small foals, not bigger ones; skip ahead 1/6/12 hours",
    run: async (page) => {
      // (skipping ahead waits for a scene fade to finish: Sleep.js "busy")
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const r = await page.evaluate((setup) => {
        eval(setup)();
        currentScene = "OUTDOORS";
        const tiny = __mk(400, { growth: 0.3, scene: "OUTDOORS" });
        const big = __mk(410, { growth: 0.7, scene: "OUTDOORS" });
        const n = mowFoalsAround("OUTDOORS", 400, 520);
        const out = { n, tiny: tiny.isAlive, big: big.isAlive, cause: tiny.causeOfDeath || tiny.deathCause || "" };
        currentScene = "INDOORS";
        out.refuse = skipRefusal();
        out.started = startSkip(6);
        out.until = sleepState ? (sleepState.until - timePlayed) / HOUR_LENGTH : null;
        out.skip = sleepState && sleepState.skip;
        wakeUp(true);
        out.choices = SKIP_CHOICES;
        return out;
      }, SETUP);
      check(r.n === 1 && !r.tiny && r.big, `one small foal mowed (${r.n}), the bigger one fine`);
      check(r.started && Math.abs(r.until - 6) < 0.01 && r.skip === 6, `skip 6 hours: ${JSON.stringify(r)}`);
      checkEqual(JSON.stringify(r.choices), "[1,6,12]", "skip choices");
    },
  },
  {
    name: "batch10: inbred foals - deformities about half the time for siblings, never for strangers; stillborns pull through deformed",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const gm = __mk(100);
        const gd = __mk(150, { gender: "male" });
        const sis = __mk(200);
        const bro = __mk(250, { gender: "male" });
        sis.motherId = bro.motherId = gm.id;
        sis.fatherId = bro.fatherId = gd.id;
        const stranger = __mk(300, { gender: "male" });
        const kin = relatedness(sis, bro);
        let deformed = 0;
        let strangers = 0;
        let flawedAll = true;
        const kinds = {};
        for (let i = 0; i < 400; i++) {
          const b = { personalities: [], limbs: {}, limbState: {} };
          if (rollDeformities(b, sis, bro).length) deformed++;
          for (const k of b.deformities || []) kinds[k] = (kinds[k] || 0) + 1;
          const c = { personalities: [], limbs: {}, limbState: {} };
          if (rollDeformities(c, sis, stranger).length) strangers++;
          const fl = { personalities: [], limbs: {}, limbState: {} };
          if (!rollDeformities(fl, sis, stranger, true).length) flawedAll = false;
        }
        let pulled = 0;
        for (let i = 0; i < 1000; i++) if (inbredPullsThrough(sis, bro)) pulled++;
        let pulledStr = 0;
        for (let i = 0; i < 200; i++) if (inbredPullsThrough(sis, stranger)) pulledStr++;
        // A deformed fluffy: cheaper, dim is dimmer, sickly, odd
        const f = __mk(500);
        const s0 = smartsOf(f);
        f.deformities = ["dim", "crooked"];
        f.limbState = { leg_1: "crooked" };
        return {
          kin,
          deformed: deformed / 400,
          strangers,
          flawedAll,
          kinds,
          pulled: pulled / 1000,
          pulledStr,
          price: deformityPriceMultiplier(f),
          dimmer: +(s0 - smartsOf(f)).toFixed(2),
          row: describeDeformities(f),
          mangled: mangledLegCount(f) === 1,
        };
      }, SETUP);
      checkEqual(r.kin, 0.5, "siblings are 50% related");
      check(r.deformed > 0.35 && r.deformed < 0.65, `siblings' foals deformed about half the time: ${r.deformed}`);
      checkEqual(r.strangers, 0, "strangers' foals never");
      check(r.flawedAll, "a foal that pulled through a bad gene pair is always deformed");
      check(Object.keys(r.kinds).length === 4, `all four kinds turn up: ${JSON.stringify(r.kinds)}`);
      check(r.pulled > 0.5 && r.pulled < 0.7 && r.pulledStr === 0, `pull through: kin ${r.pulled}, strangers ${r.pulledStr}`);
      check(Math.abs(r.price - 0.85 * 0.85) < 1e-6, `price x${r.price}`);
      checkEqual(r.dimmer, 0.4, "simple-minded is less clever");
      check(r.row && /crooked leg/.test(r.row[0]) && r.mangled, `row: ${r.row}`);
    },
  },
  {
    name: "batch10: sensitive babies run in families; breeding one wears it out, and it heals slowly",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        worldSettings.sbs = true;
        const mum = __mk(300);
        const dad = __mk(350, { gender: "male" });
        const genes = new Array(200).fill(0).map((_, i) => i % 2);
        const plain = sensitiveBirthChance(mum, dad, genes);
        mum.sensitiveBaby = true;
        const fromMum = sensitiveBirthChance(mum, dad, genes);
        dad.sensitiveBaby = true;
        const both = sensitiveBirthChance(mum, dad, genes);
        const out = { plain, fromMum, both, canBreed: sensitiveCanBreed(mum) };
        noteSensitiveBred(mum);
        out.cap1 = healthCapOf(mum);
        out.health1 = mum.health;
        noteSensitiveBred(mum);
        noteSensitiveBred(mum);
        out.canBreedWorn = sensitiveCanBreed(mum);
        out.row = describeBreedWear(mum);
        const w0 = mum.breedWear;
        for (let i = 0; i < DAY_LENGTH; i++) updateInbreeding(1);
        out.healed = +(w0 - mum.breedWear).toFixed(3);
        // A sensitive foal rides on mum until grown
        const sb = __mk(320, { growth: 0.6 });
        sb.sensitiveBaby = true;
        out.rides = cantCrawlYet(sb);
        sb.sensitiveBaby = false;
        out.ridesPlain = cantCrawlYet(sb);
        return out;
      }, SETUP);
      check(r.plain < 0.1 && r.fromMum > 0.35 && r.both > r.fromMum, `chances: ${r.plain} / ${r.fromMum} / ${r.both}`);
      check(r.canBreed, "a fresh sensitive mare can be bred");
      check(Math.abs(r.cap1 - 79) < 0.01 && r.health1 <= 79.01, `one litter: health up to ${r.cap1} (${r.health1})`);
      check(!r.canBreedWorn && r.row && /too worn/.test(r.row[0]), `worn out: ${r.row}`);
      check(Math.abs(r.healed - 0.2) < 0.01, `heals 0.2 a day: ${r.healed}`);
      check(r.rides && !r.ridesPlain, "a sensitive foal rides on mum; a plain 0.6 one walks");
    },
  },
  {
    name: "batch10: the gene planner finds who you have and the best pairs",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = __mk(300, { type: "unicorn" });
        const d = __mk(350, { type: "unicorn", gender: "male" });
        const e = __mk(400, { type: "earthy", gender: "male" });
        genePlan = { type: "unicorn" };
        const J = runGenePlan();
        const best = _planRows()[0];
        const out = {
          have: J.have.map((f) => f.id).sort(),
          ids: [m.id, d.id].sort(),
          pairs: J.pairs.length,
          bestDad: best && best.dad.id === d.id,
          bestChance: best && best.chance,
          match: genesMatchPlan(m.genes, { type: "unicorn" }),
          noMatch: genesMatchPlan(e.genes, { type: "unicorn" }),
        };
        genePlan = {};
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.have), JSON.stringify(r.ids), "have now: the two unicorns");
      checkEqual(r.pairs, 2, "one mare x two stallions");
      check(r.bestDad && r.bestChance > 0.3, `the unicorn stallion is the best pair: ${r.bestChance}`);
      check(r.match && !r.noMatch, "genesMatchPlan");
    },
  },
  {
    name: "batch10: the shelter drop box takes a stray straight in; one of yours asks first",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        shelter = freshShelter();
        const before = shelter.residents.length;
        const stray = __mk(300, { adopted: false });
        const took = dropInShelterBox(stray);
        const out = { took, gone: !fluffies.includes(stray), added: shelter.residents.length - before };
        const mine = __mk(300, { name: "Pip" });
        out.mineTook = dropInShelterBox(mine);
        out.mineStill = fluffies.includes(mine);
        out.mineAsked = isChoiceOpen();
        closeAllChoices();
        return out;
      }, SETUP);
      check(r.took && r.gone && r.added === 1, `stray in: ${JSON.stringify(r)}`);
      check(r.mineTook && r.mineStill && r.mineAsked, "one of yours waits for you to say yes");
    },
  },
  {
    name: "batch10: shop shelves show the drawn icons (mower, incubator) instead of grey boxes",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const out = {};
        for (const a of SPAWN_ACTIONS) {
          const k = a.isItem;
          if (!/mower|incubator/i.test(k || "")) continue;
          const cv = document.createElement("canvas");
          cv.width = cv.height = 80;
          const c = cv.getContext("2d");
          drawShopActionIcon(c, a, 40, 40, 64);
          const d = c.getImageData(0, 0, 80, 80).data;
          const colours = new Set();
          for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) colours.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`);
          out[k] = colours.size;
        }
        return out;
      });
      check(Object.keys(r).length >= 2, `found: ${JSON.stringify(r)}`);
      for (const [k, n] of Object.entries(r)) check(n > 6, `${k}: ${n} colours drawn`);
    },
  },
  {
    name: "batch10: herd feuds build to war - fighters charge; a rotting body spreads flu; a clever herd carries it away",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        currentScene = "OUTDOORS";
        const A = [0, 1, 2].map((i) => __mk(200 + i * 30, { scene: "OUTDOORS", adopted: false }));
        const B = [0, 1, 2].map((i) => __mk(800 + i * 30, { scene: "OUTDOORS", adopted: false }));
        for (const f of [...A, ...B]) f.traitShift = { bravery: 0.5 };
        const ha = __herd(A);
        const hb = __herd(B);
        const out = { rivals: rivalHerds(A[0], B[0]) };
        noteHerdFight(A[0], B[0]);
        out.afterFight = +feudLevel(ha, hb).toFixed(2);
        noteHerdFeud(ha, hb, FEUD_TAKEOVER);
        out.row = describeHerdFeud(A[1]);
        const w = startHerdWar(ha, hb);
        out.war = !!w && !!atWar(A[0]);
        updateHerdWars(0.1);
        out.charging = A.filter((f) => f._war).length;
        out.running = A.filter((f) => f.currentStateKey === "RUNNING").length;
        // End it
        w.until = timePlayed - 1;
        updateHerdWars(0.1);
        out.over = !herdWars.length;
        // Bodies
        const dead = B[2];
        dead.die(null, "test");
        dead.deathTimer = ROT_FULL;
        const near = B[1];
        near.x = dead.x + 40;
        near.illness = null;
        let sick = false;
        for (let i = 0; i < 40 && !sick; i++) {
          _hwBodySickness(HOUR_LENGTH);
          sick = hasFlu(near);
        }
        out.sick = sick;
        // A clever herd (alicorns are the cleverest breed)
        for (const f of B) f.traitShift = { wits: 1 };
        const minder = _hwBodyMinder(hb);
        out.minder = minder ? minder.id : null;
        _hwBodyCare();
        out.job = !!(minder && minder._body && minder._body.id === dead.id);
        const startX = dead.x;
        for (let i = 0; i < 400 && minder._body; i++) {
          minder.update(0.1);
          _hwCarry(0.1);
        }
        out.moved = Math.round(Math.abs(dead.x - startX));
        out.done = !minder._body && !!dead._movedAway;
        return out;
      }, SETUP);
      check(r.rivals, "two wild herds are rivals");
      check(r.afterFight > 0.05, `a fight starts a feud: ${r.afterFight}`);
      check(r.row && /feud/.test(r.row[0]), `row: ${r.row}`);
      check(r.war, "war starts");
      check(r.charging >= 2 && r.running >= 1, `fighters charge: ${r.charging} picked a foe, ${r.running} running`);
      check(r.over, "the war ends when its time is up");
      check(r.sick, "a fluffy next to a rotting body catches the flu");
      check(r.minder && r.job, "the clever one takes the body");
      check(r.moved > 200 && r.done, `carried it away: ${r.moved}px, done ${r.done}`);
    },
  },
  {
    name: "batch10: the wits genes don't overlap the fancy-mane genes",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const i = TRAITS.findIndex((t) => t.key === "wits");
        return { wits: traitGeneStart(i), total: TRAIT_GENE_TOTAL, others: TRAITS.map((_, k) => traitGeneStart(k)) };
      });
      checkEqual(r.wits, 139, "wits genes start at 139");
      check(r.others.slice(0, -1).every((s) => s + 5 <= 128), `others below the mane genes: ${r.others}`);
      checkEqual(r.total, 144, "total");
    },
  },
  {
    name: "batch10: the magnifying glass's Actions button opens the right-click menu (Forget herd and all); the menu's switches",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const a = __mk(400, { name: "Ash" });
        const b = __mk(600, { name: "Bea" });
        __herd([a, b], b);
        inspectedFluffy = a;
        const L = getInspectionModalLayout();
        mouse.x = L.actionsBtnX + L.btnW / 2;
        mouse.y = L.btnY + L.btnH / 2;
        handleInspectionModalClick();
        const out = { menu: trickUI && trickUI.phase, closed: inspectedFluffy === null };
        const chip = getTrickMenuLayout().chips.find((c) => c.action && c.action.key === "forgetherd");
        out.chip = !!chip;
        if (chip) chip.action.run(a);
        out.herd = herdOf(a) ? herdOf(a).name : null;
        closeTrickUI();
        // A foal: just its other actions (Not for sale...: playtest 6)
        const foal = __mk(500, { growth: 0.05 });
        out.foal = openFluffyActions(foal);
        out.foalOnly = !!(trickUI && trickUI.actionsOnly);
        closeTrickUI();
        // Pause menu switches
        const before = showFluffyNames;
        const t = pauseToggleRects()[0];
        gameState = "PAUSED";
        transitionPhase = "OFF";
        mouse.x = t.x + 5;
        mouse.y = t.y + 5;
        handlePauseMenuClick();
        out.names = showFluffyNames !== before;
        out.dbg = { t, tp: transitionPhase, sl: showSaveList, w: width };
        showFluffyNames = before;
        gameState = "PLAYING";
        return out;
      }, SETUP);
      check(r.menu === "menu" && r.closed, `Actions opens the menu: ${JSON.stringify(r)}`);
      check(r.chip && r.herd === null, `Forget herd is there and works: ${JSON.stringify(r)}`);
      check(r.foal === true && r.foalOnly, "a newborn's menu has just its other actions");
      check(r.names, `the pause menu's Names switch works ${JSON.stringify(r.dbg)}`);
    },
  },
  {
    name: "batch10: smarts 0-100 by breed (earthy 50, pegasus 35, unicorn 60, alicorn 90), no breed words; the map shows wild fluffies too",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mk = (t) => {
          const f = __mk(300, { type: t });
          f.traitShift = { wits: 0 };
          const w = traitGeneStart(TRAITS.findIndex((x) => x.key === "wits"));
          for (let i = 0; i < TRAIT_GENES_EACH; i++) f.genes[w + i] = i < 2.5 ? 1 : 0;
          f.traitShift = { wits: -traitValue(f.genes, "wits") }; // (exactly average)
          f.type = t; // (an "earthy" with random genes can come out with a horn)
          return f;
        };
        const out = { scores: ["earthy", "pegasus", "unicorn", "alicorn"].map((t) => smartsScore(mk(t))) };
        const peg = mk("pegasus");
        out.text = describeSmarts(peg)[0];
        const g = traitValue(peg.genes, "wits");
        peg.traitShift = { wits: 1 - g };
        out.clever = smartsScore(peg);
        peg.traitShift = { wits: -1 - g };
        out.dim = smartsScore(peg);
        // Wild ones on the map
        const w1 = __mk(300, { scene: "OUTDOORS", adopted: false });
        const w2 = __mk(400, { scene: "OUTDOORS", adopted: false });
        changeOpinion(w1, w2, 0.7, "played");
        openRelationshipMap(w1);
        out.wild = relMapScope.wild && relMapPeople().every((f) => !f.adopted) && relMapPeople().length === 2;
        out.sel = relMapSel === w1.id;
        out.edges = relMapData().edges.length;
        setRelMapScope(false);
        out.yours = relMapPeople().every((f) => f.adopted);
        closeRelationshipMap();
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.scores), "[50,35,60,90]", "breed averages");
      check(/^35\/100: learns/.test(r.text) && !/dim|pegasi/.test(r.text), r.text);
      check(r.clever === 60 && r.dim === 10, `wits move it 25 either way: ${r.clever} / ${r.dim}`);
      check(r.wild && r.sel && r.edges >= 1, `wild map: ${JSON.stringify(r)}`);
      check(r.yours, "back to yours");
    },
  },
];
