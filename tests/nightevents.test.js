// Night events in Fluffy Park (NightEvents.js)
const { check, checkEqual } = require("./helpers");

// A herd in the park: a mum, her foal and n other grown mares.
// Everything runs inside one page.evaluate, so the game loop can't move
// anybody in between.
const SETUP = `() => {
  __clearScene("PARK");
  __seedRandom(21);
  herdState = freshHerdState();
  _herdChanged();
  resetNightPredators();
  dayStats = freshDayStats();
  dayStats.day = reportDayIndex();
  changeScene("PARK");
  const m0 = PARK_MEADOWS[0];
  const mk = (growth, mom, x, y, name) => {
    const h = new Horse(growth, mom ? mom.id : null, "PARK", "earthy", null, null, null, "female");
    h.x = x;
    h.y = y;
    h.happiness = 0.6;
    h.hunger = 1;
    h.health = 100;
    fluffyNames[h.id] = name;
    fluffies.push(h);
    return h;
  };
  window.__herd = (n = 2, spread = 40) => {
    const mum = mk(1, null, m0.x, m0.y, "Mum");
    const foal = mk(0.4, mum, m0.x + 30, m0.y + 10, "Foal");
    const others = [];
    for (let i = 0; i < n; i++) others.push(mk(1, null, m0.x - spread * (i + 1), m0.y + 5 * i, "Mare" + i));
    const h = _formHerd([mum, foal, ...others]);
    return { h, mum, foal, others, m0 };
  };
  // Run the fox until it's gone (or 120 seconds)
  window.__runFox = () => {
    for (let t = 0; t < 120 && nightPredators.length; t += 0.05) updateNightEvents(0.05);
  };
}`;

module.exports = [
  {
    name: "night: a fox goes for the foal and kills it when nobody stands up to it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const realBrave = window._brave;
        window._brave = () => false;
        try {
          const { h, foal, mum, others } = __herd(2);
          // Nobody close enough to help
          for (const f of [mum, ...others]) f.x = foal.x - 600;
          const text = runNightEvent("fox", h.id);
          const fox = nightPredators[0];
          const target = fox && fox.victimId === foal.id;
          __runFox();
          return {
            text,
            target,
            alive: foal.isAlive,
            cause: foal.causeOfDeath,
            left: nightPredators.length,
            night: dayStats.nightEvents,
          };
        } finally {
          window._brave = realBrave;
        }
      }, SETUP);
      checkEqual(r.text, "", "the fox reports later");
      check(r.target, "the fox should go for the foal");
      checkEqual(r.alive, false, "foal alive");
      checkEqual(r.cause, "Killed by a fox", "cause of death");
      checkEqual(r.left, 0, "foxes left in the park");
      checkEqual(r.night.length, 1, "night events on the report");
      checkEqual(r.night[0].good, false, "it's bad news");
      check(/fox came in the night and killed/.test(r.night[0].text), r.night[0].text);
    },
  },
  {
    name: "night: brave herd-mates can drive the fox off",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const realBrave = window._brave;
        const realRandom = Math.random;
        window._brave = (f) => f.growth >= 1;
        try {
          const { h, foal } = __herd(4, 30);
          runNightEvent("fox", h.id);
          Math.random = () => 0.1; // well inside the 70% chance with 4+ defenders
          __runFox();
          return { alive: foal.isAlive, night: dayStats.nightEvents };
        } finally {
          window._brave = realBrave;
          Math.random = realRandom;
        }
      }, SETUP);
      checkEqual(r.alive, true, "foal alive");
      checkEqual(r.night.length, 1, "night events");
      checkEqual(r.night[0].good, true, "good news");
      check(/drove it off/.test(r.night[0].text), r.night[0].text);
    },
  },
  {
    name: "night: clicking the fox scares it off, and the herd trusts you more",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const { h, foal, mum } = __herd(1);
        runNightEvent("fox", h.id);
        const fox = nightPredators[0];
        fox.x = foal.x - 150;
        fox.y = foal.y;
        const trustBefore = mum.playerTrust;
        mouse.x = fox.x;
        mouse.y = fox.y - 15;
        const clicked = handleNightPredatorClick();
        const state = fox.state;
        __runFox();
        return {
          clicked,
          state,
          alive: foal.isAlive,
          trustUp: mum.playerTrust > trustBefore,
          night: dayStats.nightEvents,
        };
      }, SETUP);
      checkEqual(r.clicked, true, "click handled");
      checkEqual(r.state, "flee", "fox state");
      checkEqual(r.alive, true, "foal alive");
      check(r.trustUp, "trust should go up");
      check(r.night.length === 1 && r.night[0].good && /You chased off a fox/.test(r.night[0].text), JSON.stringify(r.night));
    },
  },
  {
    name: "night: the other events do what they say and go on the morning report",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const { h, foal, mum, others, m0 } = __herd(3);
        const members = () => getHerdMembers(h);
        const out = {};
        const avg = (k) => members().reduce((s, f) => s + (f[k] ?? 0), 0) / members().length;

        const health0 = avg("health");
        out.sickness = runNightEvent("sickness", h.id);
        out.sick = avg("health") < health0 - 5;

        for (const f of members()) f.health = 60;
        const happy0 = avg("happiness");
        out.snuggle = runNightEvent("snuggle", h.id);
        out.snuggled = avg("happiness") > happy0 && avg("health") > 60 && getOpinion(mum, others[0]) > 0;

        const size0 = members().length;
        out.newcomers = runNightEvent("newcomers", h.id);
        out.joined = members().length > size0;

        const idx = PARK_MEADOWS.indexOf(m0);
        for (const t of _meadowTufts(m0)) t.growth = 0;
        out.bumper = runNightEvent("bumper", h.id);
        out.full = _meadowTufts(m0).length >= MEADOW_MAX_TUFTS && _meadowTufts(m0).every((t) => t.growth >= 2);

        out.stampede = runNightEvent("stampede", h.id);
        out.trampled = _meadowTufts(m0).every((t) => t.growth <= 0.1);

        const wild0 = countParkWild();
        out.lostPet = runNightEvent("lost_pet", h.id);
        const pet = fluffies.find((f) => f.lostPet);
        out.pet = !!pet && pet.playerTrust >= 0.65 && countParkWild() === wild0 + 1 && !pet.personalities.includes("true_feral");

        out.quarrel = runNightEvent("quarrel", h.id);
        out.fellOut = members().some((a) => members().some((b) => a !== b && getOpinion(a, b) < 0));

        for (const f of members()) f.health = 100;
        out.cold = runNightEvent("cold", h.id);
        out.foalHurt = !foal.isAlive || foal.health < 100;

        out.night = dayStats.nightEvents;
        return out;
      }, SETUP);
      check(r.sick, `sickness: ${r.sickness}`);
      check(r.snuggled, `snuggle: ${r.snuggle}`);
      check(r.joined, `newcomers: ${r.newcomers}`);
      check(r.full, `bumper: ${r.bumper}`);
      check(r.trampled, `stampede: ${r.stampede}`);
      check(r.pet, `lost pet: ${r.lostPet}`);
      check(r.fellOut, `quarrel: ${r.quarrel}`);
      check(r.foalHurt, `cold: ${r.cold}`);
      for (const k of ["sickness", "snuggle", "newcomers", "bumper", "stampede", "lostPet", "quarrel", "cold"])
        check(typeof r[k] === "string" && r[k].length > 10, `${k} text: ${r[k]}`);
      // The report keeps the last few, marked good or bad
      check(r.night.length === 5, `report keeps 5, got ${r.night.length}`);
      const last = r.night[r.night.length - 1];
      checkEqual(last.good, false, "cold is bad news");
    },
  },
  {
    name: "night: events are planned after dark, happen before dawn, and show on the morning report",
    run: async (page) => {
      const r = await page.evaluate(async (setup) => {
        eval(setup)();
        __herd(3);
        const was = parkLife.enabled;
        const realRandom = Math.random;
        const out = {};
        try {
          parkLife.enabled = true;
          nightEvents = freshNightEvents();
          // 22:00 on day 3
          timePlayed = DAY_LENGTH * 3 + (22 - START_HOUR) * HOUR_LENGTH;
          out.hour = Math.round(gameHour());
          Math.random = () => 0.05; // always an event, and a second one
          nightTicker.fireNext();
          updateNightEvents(0.016);
          Math.random = realRandom;
          out.planned = nightEvents.planned.map((p) => p.at);
          out.inNight = out.planned.every((at) => at > timePlayed && at < timePlayed + 7 * HOUR_LENGTH);
          // Planning again the same night does nothing
          nightTicker.fireNext();
          updateNightEvents(0.016);
          out.sameNight = nightEvents.planned.length === out.planned.length;
          // Dawn: everything planned has happened
          timePlayed = Math.max(...out.planned) + 1;
          dayStats.nightEvents = [];
          nightTicker.fireNext();
          updateNightEvents(0.016);
          __runFox();
          out.left = nightEvents.planned.length;
          out.happened = dayStats.nightEvents.length;
          out.used = (nightEvents.used || []).length;
          // Saved and loaded
          gameState = "PAUSED";
          nightEvents.planned = [{ at: 12345 }];
          await saveGame("__automated_test__");
          nightEvents = freshNightEvents();
          await loadGame("__automated_test__");
          out.loaded = nightEvents.planned.length === 1 && nightEvents.planned[0].at === 12345;
          nightEvents = freshNightEvents();
        } finally {
          parkLife.enabled = was;
          Math.random = realRandom;
          gameState = "PLAYING";
        }
        // The morning report shows them
        dayReportShown = null;
        dayStats.nightEvents = [
          { good: true, text: "A bumper crop" },
          { good: false, text: "A fox came" },
        ];
        const plain = getDayReportLayout().h;
        dayReportShown = _finishDay();
        const withNight = getDayReportLayout().h;
        let drew = true;
        try {
          drawDayReport(ctx);
        } catch (e) {
          drew = e.message;
        }
        out.report = { plain, withNight, copied: dayReportShown.nightEvents.length, drew };
        dayReportShown = null;
        return out;
      }, SETUP);
      checkEqual(r.hour, 22, "clock");
      checkEqual(r.planned.length, 2, "events planned");
      check(r.inNight, "planned times should be before dawn");
      check(r.sameNight, "shouldn't plan twice in one night");
      checkEqual(r.left, 0, "planned left");
      check(r.used === 2 && r.happened >= 1, `used ${r.used}, reported ${r.happened}`);
      check(r.loaded, "planned events should be saved");
      checkEqual(r.report.copied, 2, "report copies night events");
      check(r.report.withNight > r.report.plain, "report grows to fit");
      checkEqual(r.report.drew, true, "report draws");
    },
  },
];
