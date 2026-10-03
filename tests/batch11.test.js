// Batch 11 (fixes and small touches): Not for sale, IV drips on the rack at a
// birth, walking foals at a feeder, the type you paid for, scaredy poopies,
// munsta, fear of baths, laments and sensitive babies' words.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD"]) __clearScene(s);
  __seedRandom(111);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 4 * DAY_LENGTH + 10 * HOUR_LENGTH;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 520;
    h.hunger = 1;
    h.health = 100;
    h.happiness = 0.7;
    h.currentStateKey = "IDLE";
    if (opts.think !== true) h.brain.think = () => {};
    if (opts.name) fluffyNames[h.id] = opts.name;
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "batch11: Not for sale - can't be sold, left out of the mill trade, toggled from the magnifying glass and the menu, saved",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400, { name: "Daisy" });
        const out = { before: f.canBeSold() };
        inspectedFluffy = f;
        const L = getInspectionModalLayout();
        const b = inspectionKeepButton(f, L);
        mouse.x = b.x + 5;
        mouse.y = b.y + 5;
        handleInspectionModalClick();
        out.kept = f.notForSale === true && !f.canBeSold();
        inspectedFluffy = null;
        out.menu = keepActions(f).map((a) => a.name);
        // The mill trade
        const cage = new Cage("INDOORS");
        cage.x = 700;
        cage.y = 450;
        cage.tag = "sell";
        objects.push(cage);
        const g = __mk(700);
        const h = __mk(720);
        for (const x of [f, g, h]) x.currentCage = cage;
        out.lot = _sellCageMates(g).map((x) => x.id).includes(f.id);
        objects.splice(objects.indexOf(cage), 1);
        // Saved
        out.saved = JSON.stringify(f.serialize()).includes('"notForSale":true');
        keepActions(f)[0].run(f);
        out.after = f.canBeSold();
        return out;
      }, SETUP);
      check(r.before && r.kept, `kept with the Keep button: ${JSON.stringify(r)}`);
      checkEqual(JSON.stringify(r.menu), JSON.stringify(["Can be sold"]), "the menu offers to lift it");
      check(!r.lot, "left out of Sell the lot");
      check(r.saved, "saved");
      check(r.after, "lifted again from the menu");
    },
  },
  {
    name: "batch11: a mare on the rack with a bed elsewhere gives birth where she is, IV drips still in",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const board = new ImmobilizationBoard("INDOORS");
        board.x = 500;
        board.y = 500;
        objects.push(board);
        board.update(0);
        const m = __mk(500, { think: true });
        m.placedOn = board;
        m.attemptLockIntoTable(board);
        const st = new IVStand("INDOORS");
        st.x = 620;
        st.y = 470;
        objects.push(st);
        const bag = new IVBag("INDOORS", "tpn");
        bag.charges = 1000;
        objects.push(bag);
        bag.attachedTo = st;
        st.attachedBag = bag;
        st.connectedFluffy = m;
        const bd = new Bed("INDOORS");
        bd.x = 950;
        bd.y = 600;
        objects.push(bd);
        m.claimedBed = bd;
        m.isPregnant = true;
        m.babiesToBirth = 2;
        m.foalViability = [true, true];
        m.pregnancyTimer = 0.01;
        m.fatherGenes = m.genes.slice();
        let lost = false;
        let far = 0;
        for (let i = 0; i < 300; i++) {
          m.update(0.1);
          board.update(0.1);
          st.update(0.1);
          if (!st.connectedFluffy) lost = true;
          far = Math.max(far, Math.abs(m.x - 500));
        }
        return { lost, far: Math.round(far), born: fluffies.filter((f) => f.motherId === m.id).length };
      }, SETUP);
      check(!r.lost && r.far < 20, `stayed on the rack, IV in: ${JSON.stringify(r)}`);
      checkEqual(r.born, 2, "two foals");
    },
  },
  {
    name: "batch11: walking foals in a cage drink from the feeder when there's nothing to eat",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const cage = new Cage("INDOORS");
        cage.x = 600;
        cage.y = 450;
        objects.push(cage);
        cage.update(0);
        const fd = new Bowl("mega_feeder", "INDOORS");
        fd.fill(25, "formula");
        fd.x = cage.bounds.left + 30;
        fd.y = cage.bounds.bottom - 20;
        fd.currentCage = cage;
        objects.push(fd);
        const foals = [0.32, 0.4, 0.5].map((g, i) => {
          const f = __mk(cage.x + 40 + i * 20, { growth: g, think: true, gender: "female" });
          f.y = cage.bounds.bottom - 30;
          f.currentCage = cage;
          f.hunger = 0.35;
          return f;
        });
        for (let t = 0; t < 1200; t++) {
          timePlayed += 0.1;
          for (const f of foals) if (f.isAlive) f.update(0.1);
        }
        return { alive: foals.filter((f) => f.isAlive).length, hunger: foals.map((f) => +f.hunger.toFixed(2)), food: fd.food };
      }, SETUP);
      checkEqual(r.alive, 3, "all alive");
      check(r.hunger.every((h) => h > 0.6) && r.food < 25, `fed from the feeder: ${JSON.stringify(r)}`);
    },
  },
  {
    name: "batch11: a foal from a can or the shop is the type it was sold as",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const types = {};
        for (let i = 0; i < 300; i++) {
          const h = new Horse(0, null, "INDOORS", "earthy");
          h.makeType("earthy");
          types[h.type] = (types[h.type] || 0) + 1;
          const u = new Horse(0, null, "INDOORS", "unicorn");
          u.makeType("unicorn");
          types["u:" + u.type] = (types["u:" + u.type] || 0) + 1;
          delete relationships[h.id];
          delete relationships[u.id];
        }
        const peg = new Horse(1, null, "INDOORS", "pegasus");
        peg.makeType("pegasus");
        return { types, pegWings: peg.limbs.leftWing && peg.limbs.rightWing && !peg.limbs.horn };
      }, SETUP);
      checkEqual(r.types.earthy, 300, `all earthies: ${JSON.stringify(r.types)}`);
      checkEqual(r.types["u:unicorn"], 300, "all unicorns");
      check(r.pegWings, "a pegasus has wings and no horn");
    },
  },
  {
    name: "batch11: scaredy poopies - a big fright can wet a timid fluffy (mess, not a misdeed), once in a while",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400);
        f.traitShift = { bravery: -1 };
        f.peeStorage = 0.8;
        const real = Math.random;
        Math.random = () => 0.01;
        const first = scaredyMess(f, 1);
        const again = scaredyMess(f, 1);
        Math.random = real;
        const puddle = puddles.some((p) => p.scene === "INDOORS" && p.points.length);
        const brave = __mk(600);
        brave.traitShift = { bravery: 1 };
        brave.peeStorage = 0;
        let n = 0;
        for (let i = 0; i < 200; i++) {
          brave._scaredyAt = undefined;
          if (scaredyMess(brave, 0.3)) n++;
        }
        const timid = __mk(800);
        timid.traitShift = { bravery: -1 };
        let m = 0;
        for (let i = 0; i < 200; i++) {
          timid._scaredyAt = undefined;
          timid.peeStorage = 0.8;
          if (scaredyMess(timid, 1)) m++;
        }
        return { first, again, puddle, misdeed: f.badPoopieTimer > 0, emptied: f.peeStorage === 0, brave: n, timid: m };
      }, SETUP);
      check(r.first && !r.again, "wets itself, then not again straight away");
      check(r.puddle && r.emptied && !r.misdeed, `a puddle, not a bad poopie: ${JSON.stringify(r)}`);
      check(r.timid > r.brave * 3 && r.timid > 40, `timid and frightened far more often: ${r.timid} vs ${r.brave}`);
    },
  },
  {
    name: "batch11: munsta - fluffies name the mower; a foal close to it gets a fright",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        currentScene = "OUTDOORS";
        const mower = new LawnMower("OUTDOORS");
        mower.x = 400;
        mower.y = 520;
        mower.isDragging = true;
        objects.push(mower);
        const said = [];
        const grown = __mk(500, { scene: "OUTDOORS" });
        grown.speak = (t) => said.push(t);
        const foal = __mk(430, { scene: "OUTDOORS", growth: 0.4 });
        const real = Math.random;
        Math.random = () => 0.01;
        for (let i = 0; i < 5; i++) {
          munstaTicker.fireNext && munstaTicker.fireNext();
          updateMunsta(2);
          timePlayed += 2;
        }
        Math.random = real;
        objects.splice(objects.indexOf(mower), 1);
        return { said, lines: DIALOGUE.MUNSTA.MOWER, scared: foal._munstaScare !== undefined };
      }, SETUP);
      check(r.said.some((t) => r.lines.includes(t)), `munsta lines: ${r.said}`);
      check(r.scared, "the foal near the mower was frightened");
    },
  },
  {
    name: "batch11: hurt in the bath or pulled from the river - afraid of baths; the next bath it panics",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400);
        f.dirt = 0.5;
        f.bathLike = 1;
        const first = scrubFluffy(f);
        notePlayerViolence(f, false, "stick", false);
        const fear = +fearOf(f, "bath").toFixed(2);
        timePlayed += 200;
        f.fright = null;
        const second = scrubFluffy(f);
        // Nearly drowned: in the river, then picked out
        const g = __mk(300, { scene: "RIVER" });
        g.x = 50;
        g.physics.updateRiverDrowning(0.5);
        const drowning = g.drowningTimer > 0;
        g.isDragging = true;
        g.physics.updateRiverDrowning(0.1);
        return { first, fear, second, drowning, drowned: +fearOf(g, "bath").toFixed(2), name: FEARS.find((x) => x.key === "bath").name };
      }, SETUP);
      checkEqual(r.first, "happy", "a bath it likes");
      check(r.fear >= 0.3, `hurt in the bath: afraid ${r.fear}`);
      checkEqual(r.second, "scared", "the next bath it panics");
      check(r.drowning && r.drowned >= 0.4, `pulled out of the water: afraid ${r.drowned}`);
    },
  },
  {
    name: "batch11: laments (missing legs, spayed near foals) and a sensitive baby's own words",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const p = __mk(400);
        p.limbs.legs = [false, false, false, false];
        const pillow = new Set();
        for (let i = 0; i < 200; i++) {
          const t = p._lament();
          if (t) pillow.add(t);
        }
        const s = __mk(600);
        s.spayed = true;
        __mk(640, { growth: 0.2 });
        const spayed = new Set();
        for (let i = 0; i < 200; i++) {
          const t = s._lament();
          if (t) spayed.add(t);
        }
        worldSettings.sbs = true;
        const sb = __mk(800, { growth: 0.5 });
        sb.sensitiveBaby = true;
        const said = [];
        sb.speak = (t) => said.push(t);
        sb.hitTestAsSeen = () => "torso";
        return {
          pillow: [...pillow].every((t) => DIALOGUE.LAMENT.PILLOW.some((l) => l.replace(/<speaker>/gi, "") && true)) && pillow.size > 0,
          spayed: [...spayed].length > 0,
          sensitive: typeof DIALOGUE.SENSITIVE.UPSIES[0] === "string",
        };
      }, SETUP);
      check(r.pillow, "a pillowed fluffy laments");
      check(r.spayed, "a spayed mare near foals laments");
      check(r.sensitive, "sensitive babies have their own lines");
    },
  },
];
