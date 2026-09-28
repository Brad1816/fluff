// Fluffies taken away from their herd / family / friends (Separation.js),
// and the park's new place next to the day care alley
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "separation: carrying a fluffy away from its family upsets it, grief grows, reunion fixes it",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const ids = await page.evaluate(() => {
        __clearScene("PARK");
        __clearScene("ALLEY_DAY_CARE");
        __seedRandom(8);
        worldSettings.colorism = false;
        worldSettings.alicornIntolerance = false; // mums always love their foals here
        tutorialTimer = 0;
        herdState = freshHerdState();
        _herdChanged();
        changeScene("PARK");
        camera.x = 0;
        camera.y = 0;
        const mk = (x, y, mom) => {
          const h = new Horse(1, mom ? mom.id : null, "PARK", "earthy", null, null, null, "female");
          h.x = x;
          h.y = y;
          h.hunger = 1;
          h.happiness = 0.8;
          fluffies.push(h);
          return h;
        };
        const mum = mk(700, 450);
        const kid = mk(900, 500, mum);
        mk(760, 470, mum); // a sister
        mum.initBehavior("IDLE");
        return { mum: mum.id, kid: kid.id };
      });
      // Pick the daughter up and carry her out through the park's exit
      const spot = await page.evaluate((id) => {
        const f = fluffies.find((f) => f.id === id);
        for (let dy = -60; dy < 10; dy += 3)
          for (let dx = -40; dx < 40; dx += 3)
            if (f.hitTest(f.x + dx, f.y + dy)) return { x: f.x + dx - camera.x, y: f.y + dy - camera.y };
        return null;
      }, ids.kid);
      await page.mouse.click(spot.x, spot.y);
      await page.mouse.move(50, 400, { steps: 5 });
      await page.mouse.click(50, 400);
      const r = await page.evaluate(({ mum, kid }) => {
        gameState = "PAUSED";
        const k = fluffies.find((f) => f.id === kid);
        const m = fluffies.find((f) => f.id === mum);
        const res = {
          scene: k.scene,
          hasSep: !!k.separation,
          bond: k.separation && k.separation.bond,
          mumSaw: m.playerMemories.some((x) => x.type === "took_family"),
          fear0: k.playerFear,
        };
        // Two game minutes apart
        for (let i = 0; i < 130; i++) updateSeparations(1);
        res.grief = k.separation.grief;
        res.traumatised = k.separation.traumatised;
        res.memory = k.playerMemories.some((x) => x.type === "taken_away");
        res.fear1 = k.playerFear;
        res.missesRow = getFluffyInspectionInfo(k).about.find((row) => row.label === "Misses");
        // Saved with the game (as data on the fluffy)
        res.saved = JSON.stringify(k.serialize().separation) === JSON.stringify(k.separation);
        // Bring her back to mum
        const happyBefore = k.happiness;
        k.scene = "PARK";
        k.x = m.x + 60;
        k.y = m.y;
        updateSeparations(1);
        res.cleared = k.separation === null;
        res.happier = k.happiness > happyBefore;
        gameState = "PLAYING";
        return res;
      }, ids);
      checkEqual(r.scene, "ALLEY_DAY_CARE", "where she was carried to");
      check(r.hasSep, "no separation recorded");
      check(r.bond >= 0.75, `bond with mum and sister: ${r.bond}`);
      check(r.mumSaw, "mum didn't see it happen");
      check(r.grief >= 0.5 && r.traumatised && r.memory, `grief ${r.grief}, traumatised ${r.traumatised}`);
      check(r.fear1 > r.fear0, "not more afraid of you after being taken away");
      check(r.missesRow && /Mum|a lot|terribly/.test(r.missesRow.value), `Misses row: ${JSON.stringify(r.missesRow)}`);
      check(r.saved, "separation isn't saved");
      check(r.cleared && r.happier, "reunion didn't help");
    },
  },
  {
    name: "separation: loners don't mind, quick trips don't traumatise, foals feel it most",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        worldSettings.colorism = false;
        worldSettings.alicornIntolerance = false;
        herdState = freshHerdState();
        _herdChanged();
        const mk = (x, mom, growth = 1) => {
          const h = new Horse(growth, mom ? mom.id : null, "PARK", "earthy", null, null, null, "female");
          h.x = x;
          h.y = 500;
          h.happiness = 0.8;
          fluffies.push(h);
          return h;
        };
        const loner = mk(300);
        mk(900); // a stranger
        loner.scene = "INDOORS";
        onFluffyTakenAway(loner, "PARK");
        const res = { loner: loner.separation };
        const mum = mk(1500);
        const foal = mk(1550, mum, 0.4);
        const adult = mk(1600, mum);
        foal.scene = "INDOORS";
        adult.scene = "INDOORS";
        onFluffyTakenAway(foal, "PARK");
        onFluffyTakenAway(adult, "PARK");
        res.foalBond = foal.separation.bond;
        res.adultBond = adult.separation.bond;
        // A 10 second trip, then back
        for (let i = 0; i < 10; i++) updateSeparations(1);
        res.quickGrief = adult.separation.grief;
        res.quickTrauma = adult.separation.traumatised;
        return res;
      });
      checkEqual(r.loner, undefined, "a loner's separation");
      check(r.foalBond > r.adultBond, `foal ${r.foalBond} vs grown-up ${r.adultBond}`);
      check(r.quickGrief < 0.15 && !r.quickTrauma, `after 10 seconds: grief ${r.quickGrief}`);
    },
  },
  {
    name: "park: the way in is from the day care alley, not the river",
    run: async (page) => {
      const r = await page.evaluate(() => ({
        alley: getScenePortals("ALLEY_DAY_CARE").some((p) => p.target === "PARK" && p.type === "arrow_right"),
        river: getScenePortals("RIVER").some((p) => p.target === "PARK"),
        exit: getScenePortals("PARK").map((p) => p.type + ":" + p.target),
      }));
      check(r.alley, "no right arrow from the day care alley to the park");
      check(!r.river, "the river still leads to the park");
      checkEqual(JSON.stringify(r.exit), JSON.stringify(["arrow_left:ALLEY_DAY_CARE"]), "park exits");
    },
  },
  {
    name: "separation: tiny foals forget; how a fluffy was taken decides if the trauma is for life",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        __clearScene("INDOORS");
        __seedRandom(5);
        worldSettings.colorism = false;
        worldSettings.alicornIntolerance = false;
        herdState = freshHerdState();
        _herdChanged();
        gameState = "PAUSED";
        let x = 200;
        const mk = (mom, growth = 1, gender = "female") => {
          const h = new Horse(growth, mom ? mom.id : null, "PARK", "earthy", null, null, null, gender);
          h.x = x;
          h.y = 500;
          x += 40;
          h.happiness = 0.8;
          fluffies.push(h);
          return h;
        };
        const take = (f) => {
          f.scene = "INDOORS";
          onFluffyTakenAway(f, "PARK");
        };
        const tick = (n) => {
          for (let i = 0; i < n; i++) {
            updateSeparations(1);
            updatePlayerMemory(fluffies[0], 0); // keep the function warm
            for (const f of fluffies) updatePlayerMemory(f, 1);
            timePlayed += 1;
          }
        };
        const res = {};
        // 1. A tiny foal: cries, but no memory, trauma or fear, and gets over it
        const m1 = mk(null);
        const tiny = mk(m1, 0.2);
        const fear0 = tiny.playerFear;
        take(tiny);
        res.tinyYoung = tiny.separation && tiny.separation.young;
        tick(700);
        res.tinyCleared = tiny.separation === null;
        res.tinyScars = (tiny.traumas || []).length;
        res.tinyMemories = tiny.playerMemories.filter((m) => m.type.startsWith("taken")).length;
        res.tinyFear = tiny.playerFear - fear0;
        // 2. Hurt, then taken: scarred for life and never loses its fear of you
        const m2 = mk(null);
        const hurt = mk(m2);
        notePlayerViolence(hurt, false, "stick", false, false);
        take(hurt);
        res.violent = (hurt.traumas || []).map((t) => t.type);
        tick(3000); // fear fades normally over time...
        res.violentFear = hurt.playerFear;
        // 3. Mum killed by you, then taken
        const m3 = mk(null);
        const orphanK = mk(m3);
        mk(m3); // a sister left behind
        notePlayerViolence(m3, true, "knife", false, false);
        m3.die("knife");
        take(orphanK);
        res.killed = (orphanK.traumas || []).map((t) => t.type);
        // 4. Mum starved (not you), then taken: sad for life, but no blame
        const m4 = mk(null);
        const orphan = mk(m4);
        m4.die(null, "Starved to death");
        const orphanFear0 = orphan.playerFear;
        take(orphan);
        res.orphan = (orphan.traumas || []).map((t) => t.type + ":" + t.blames);
        tick(5);
        res.orphanFear = orphan.playerFear - orphanFear0;
        // 5. Peacefully taken grown-up: grieves, but no permanent scar
        const m5 = mk(null);
        const calm = mk(m5);
        mk(m5);
        take(calm);
        tick(200);
        res.calmGrief = calm.separation && calm.separation.traumatised;
        res.calmScars = (calm.traumas || []).length;
        // 6. Peacefully taken foal old enough to remember, mum alive: mild scar
        const m6 = mk(null);
        const foal = mk(m6, 0.6);
        take(foal);
        tick(200);
        res.foal = (foal.traumas || []).map((t) => t.type);
        res.foalRow = getFluffyInspectionInfo(foal).care.find((row) => row.label === "Trauma");
        res.saved = JSON.stringify(foal.serialize().traumas) === JSON.stringify(foal.traumas);
        gameState = "PLAYING";
        return res;
      });
      check(r.tinyYoung, "tiny foal not marked too young to remember");
      check(r.tinyCleared && r.tinyScars === 0 && r.tinyMemories === 0, `tiny foal: cleared ${r.tinyCleared}, scars ${r.tinyScars}, memories ${r.tinyMemories}`);
      check(r.tinyFear <= 0.001, `tiny foal's fear went up by ${r.tinyFear}`);
      checkEqual(JSON.stringify(r.violent), JSON.stringify(["violent"]), "hurt then taken");
      check(r.violentFear >= 0.24, `fear of you long after a violent taking: ${r.violentFear}`);
      checkEqual(JSON.stringify(r.killed), JSON.stringify(["family_killed"]), "mum killed then taken");
      checkEqual(JSON.stringify(r.orphan), JSON.stringify(["orphaned:false"]), "orphan");
      check(r.orphanFear <= 0.001, `orphan blames you: fear +${r.orphanFear}`);
      check(r.calmGrief && r.calmScars === 0, `peaceful grown-up: traumatised ${r.calmGrief}, permanent scars ${r.calmScars}`);
      checkEqual(JSON.stringify(r.foal), JSON.stringify(["torn_from_mum"]), "peaceful foal old enough to remember");
      check(r.foalRow && r.foalRow.value.includes("mum"), `Trauma row: ${JSON.stringify(r.foalRow)}`);
      check(r.saved, "traumas aren't saved");
    },
  },
];
