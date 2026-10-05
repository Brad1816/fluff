// Quick changes (Oct 5): a stallion's short rest, the auto-trainer and
// caged fluffies, pet-flap strays aren't yours, the breeding bar
const { check, checkEqual } = require("./helpers");
const src = require("fs").readFileSync(__dirname + "/playtest6.test.js", "utf8");
const SETUP = src.match(/const SETUP = `([\s\S]*?)`;/)[1];

module.exports = [
  {
    name: "quickfix10: a stallion only rests a few minutes after breeding; the magnifying glass has a breeding bar (ready, resting, pregnant, too young)",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const m = __mk(500, { growth: 1, gender: "male" });
        const w = __mk(560, { growth: 1, gender: "female" });
        for (const f of [m, w]) {
          f.renderer.ensureTintedImages();
          f.personalities = [];
        }
        m.specialHuggiesCooldown = 0;
        m.x = w.x + 40;
        m.y = w.y;
        out.mated = m.mateWith(w, true, false);
        out.rest = m.specialHuggiesCooldown;
        out.restOk = m.specialHuggiesCooldown > 0 && m.specialHuggiesCooldown <= 10;
        // The bar
        out.resting = breedReadiness(m).text;
        out.restLevel = inspectionVitalLevel(m, "Breeding");
        m.specialHuggiesCooldown = 0;
        out.ready = breedReadiness(m).level === 1 && breedReadiness(m).tone === "good";
        w.isPregnant = true;
        w.pregnancyTimer = pregnancyDuration / 2;
        const p = breedReadiness(w);
        out.preg = /Pregnant/.test(p.text) && p.level > 0 && p.level < 1;
        w.isPregnant = false;
        w.lastBirthAt = timePlayed - 1;
        out.after = /After her litter/.test(breedReadiness(w).text);
        const foal = __mk(600, { growth: 0.4 });
        out.foal = breedReadiness(foal).text === "Too young yet";
        out.vital = INSPECT_VITALS.includes("Breeding");
        return out;
      }, SETUP);
      check(r.restOk, `a short rest (${r.rest}s)`);
      check(r.restLevel !== null && r.restLevel < 1 && /breath/.test(r.resting), "the bar shows him resting");
      check(r.ready && r.preg && r.after && r.foal && r.vital, "ready, pregnant, resting after a litter, too young");
    },
  },
  {
    name: "quickfix10: the auto-trainer trains a caged fluffy - in the cage with it, beside it, in front of it or behind it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        for (const mode of ["inside", "beside", "front", "behind"]) {
          __clearScene();
          __seedRandom(3);
          const c = __cage(500);
          const f = __mk(500, { growth: 1 });
          __put(f, c);
          f.hunger = 1;
          f.health = 100;
          const t = new AutoTrainer("INDOORS");
          const b = c.bounds;
          if (mode === "inside") {
            t.x = b.right - 15;
            t.y = b.bottom - 5;
            t.currentCage = c;
          } else if (mode === "beside") {
            t.x = b.right + 60;
            t.y = b.bottom;
          } else if (mode === "front") {
            t.x = c.x;
            t.y = b.bottom + 120;
          } else {
            t.x = c.x;
            t.y = b.top - 40;
          }
          t.on = true;
          t.tricks = ["sit"];
          t.lessons = [];
          objects.push(t);
          for (let i = 0; i < 8000; i++) {
            updateSimulation(0.05);
            if (!t.session && i % 200 === 0) {
              f._autoTrainAt = undefined;
              autoTrainerTicker.fireNext();
            }
          }
          out[mode] = trickSkill(f, "sit") > 0;
        }
        return out;
      }, SETUP);
      check(r.inside && r.beside && r.front && r.behind, JSON.stringify(r));
    },
  },
  {
    name: "quickfix10: a stray that lets itself in through the pet flap isn't yours (it may wander back out); put it down in the house yourself to keep it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const flap = new PetFlap("INDOORS");
        flap.x = 600;
        flap.y = 400;
        objects.push(flap);
        const s = __mk(600, { growth: 1, adopted: false, scene: "BACKYARD" });
        s.adopted = false;
        s._flapTrip = { to: "in", flapId: flap.id, at: timePlayed, yard: { x: s.x, y: s.y } };
        updatePetFlaps(0.05);
        out.inside = s.scene === "INDOORS" && s._viaFlap === true;
        for (let i = 0; i < 40; i++) s.update(0.05);
        out.notYours = s.adopted === false;
        // You pick it up and put it down
        s.isDragging = true;
        handleDropping(s);
        for (let i = 0; i < 10; i++) s.update(0.05);
        out.yours = s.adopted === true;
        return out;
      }, SETUP);
      check(r.inside, "it gets in");
      check(r.notYours, "it isn't yours just for getting in");
      check(r.yours, "put down by you, it's yours");
    },
  },
];
