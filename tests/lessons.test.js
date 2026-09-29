// Lessons (Lessons.js): colours, alicorns, litter, and reforming Smarties
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(33);
  if (typeof closeTrickUI === "function") closeTrickUI();
  worldSettings.colorism = true;
  worldSettings.alicornIntolerance = true;
  worldSettings.smarties = true;
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH;
  window.__mk = (x, trust = 0.5, gender = "female") => {
    const h = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, gender);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.warmth = 1;
    h.happiness = 0.8;
    h.playerTrust = trust;
    h.playerFear = 0;
    h.pottyTraining = 1;
    h.coloristDegree = 0;
    h.alicornComfort = 1;
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
  window.__said = [];
  window.__realMsg = window.__realMsg || window.addUIMessage;
  window.addUIMessage = (t) => __said.push(t);
}`;
const TEARDOWN = () => {
  if (window.__realMsg) window.addUIMessage = window.__realMsg;
  if (typeof closeTrickUI === "function") closeTrickUI();
};

module.exports = [
  {
    name: "lessons: colour lessons talk a fluffy out of colorism; one that loves you listens more; 3 a day",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const loved = __mk(300, 0.9);
        const unloved = __mk(900, 0.1);
        loved.coloristDegree = unloved.coloristDegree = 0.9;
        const out = {
          applies: lessonsFor(loved).map((l) => l.key),
          chance: [lessonChance(loved, "colours"), lessonChance(unloved, "colours")],
        };
        const day = (f) => {
          const res = [];
          for (let i = 0; i < 4; i++) res.push(giveLesson(f, "colours"));
          return res;
        };
        out.firstDay = day(loved);
        day(unloved);
        for (let d = 0; d < 6; d++) {
          timePlayed += DAY_LENGTH;
          day(loved);
          day(unloved);
        }
        out.after = [loved.coloristDegree, unloved.coloristDegree];
        // Keep going until it's cured
        for (let d = 0; d < 20 && lessonsFor(loved).some((l) => l.key === "colours"); d++) {
          timePlayed += DAY_LENGTH;
          day(loved);
        }
        out.cured = loved.coloristDegree;
        out.curedApplies = lessonsFor(loved).map((l) => l.key);
        out.msg = __said.find((m) => /doesn't care about colours/.test(m)) || null;
        // World Colorism off: no colour lesson
        worldSettings.colorism = false;
        out.off = lessonsFor(unloved).map((l) => l.key);
        worldSettings.colorism = true;
        // Litter and alicorns show up when needed
        const messy = __mk(600, 0.9);
        messy.pottyTraining = 0.2;
        messy.alicornComfort = 0.3;
        out.messy = lessonsFor(messy).map((l) => l.key);
        const p0 = messy.pottyTraining;
        const a0 = messy.alicornComfort;
        for (let i = 0; i < 3; i++) giveLesson(messy, "litter");
        timePlayed += DAY_LENGTH;
        for (let i = 0; i < 3; i++) giveLesson(messy, "alicorns");
        out.litter = messy.pottyTraining - p0;
        out.alicorn = messy.alicornComfort - a0;
        // Scared or asleep: no lesson
        const scared = __mk(700, 0.5);
        scared.coloristDegree = 0.8;
        scared.playerFear = 0.6;
        out.scared = giveLesson(scared, "colours");
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      checkEqual(JSON.stringify(r.applies), JSON.stringify(["colours"]), "only the lesson it needs");
      check(r.chance[0] > r.chance[1] * 2.5, `loved listens more ${r.chance}`);
      checkEqual(r.firstDay[3], "tired", "3 lessons a day");
      check(r.after[0] < 0.6, `colour views came down ${r.after[0]}`);
      check(r.after[0] < r.after[1], `more than the one that doesn't like you ${r.after}`);
      check(r.cured <= 0.01, `cured eventually ${r.cured}`);
      check(!r.curedApplies.includes("colours"), "no more colour lessons once cured");
      check(r.msg, "you're told");
      check(!r.off.includes("colours"), "no colour lessons with World Colorism off");
      checkEqual(JSON.stringify(r.messy), JSON.stringify(["alicorns", "litter"]), "alicorn and litter lessons");
      check(r.litter > 0.05, `litter lessons work ${r.litter}`);
      check(r.alicorn > 0.05, `alicorn lessons work ${r.alicorn}`);
      checkEqual(r.scared, "scared", "a scared fluffy won't listen");
    },
  },
  {
    name: "lessons: a Smarty can be reformed, but it's very hard; then it does tricks",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const s = __mk(400, 0.9, "male");
        s.personalities = ["smarty"];
        const out = {
          isSmarty: s.isSmarty(),
          applies: lessonsFor(s).map((l) => l.key),
          chance: lessonChance(s, "smarty"),
          normal: lessonChance(s, "colours"),
          trickBefore: tryTrick(s, "sit"),
        };
        let days = 0;
        while (s.isSmarty() && days < 200) {
          timePlayed += DAY_LENGTH;
          days++;
          for (let i = 0; i < 3; i++) giveLesson(s, "smarty");
          s.hunger = 1;
          s.happiness = 0.8;
        }
        out.days = days;
        out.reformed = !s.isSmarty();
        out.personalities = s.personalities;
        out.flag = s.smartyReformed;
        out.msg = __said.find((m) => /isn't a Smarty any more/.test(m)) || null;
        out.applies2 = lessonsFor(s).map((l) => l.key);
        out.trickAfter = trickRefusal(s);
        out.row = describeLessons(s);
        // One that doesn't like you: after 3 weeks it's still a Smarty
        const grump = __mk(800, 0.1, "male");
        grump.personalities = ["smarty"];
        for (let d = 0; d < 21; d++) {
          timePlayed += DAY_LENGTH;
          for (let i = 0; i < 3; i++) giveLesson(grump, "smarty");
        }
        out.grump = [grump.isSmarty(), grump.smartyReform];
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      check(r.isSmarty, "it's a Smarty");
      check(r.applies.includes("smarty"), "Be good lesson offered");
      check(r.chance < r.normal * 0.3, `much harder than other lessons ${r.chance} vs ${r.normal}`);
      checkEqual(r.trickBefore, "smarty", "no tricks while a Smarty");
      check(r.reformed, `reformed in the end (${r.days} days)`);
      check(r.days >= 10, `but it took a long time: ${r.days} days`);
      check(!r.personalities.includes("smarty"), "not a smarty personality any more");
      check(r.flag && r.msg, "remembered and you're told");
      check(!r.applies2.includes("smarty"), "no more Be good lessons");
      checkEqual(r.trickAfter, null, "and it'll learn tricks now");
      check(r.row && /reformed/.test(r.row[0]), `magnifying glass says so: ${r.row}`);
      check(r.grump[0], `one that doesn't like you is still a Smarty after 3 weeks (${r.grump[1]})`);
    },
  },
  {
    name: "lessons: they show in the right-click menu and clicking one gives the lesson; TV reform works",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(500, 0.9);
        f.coloristDegree = 0.7;
        f.pottyTraining = 0.4;
        trickUI = { phase: "menu", id: f.id };
        const L = getTrickMenuLayout();
        const lessons = L.chips.filter((c) => c.lesson);
        const tricks = L.chips.filter((c) => !c.lesson);
        const out = { keys: lessons.map((c) => c.key), below: lessons.every((c) => c.y > tricks[0].y + tricks[0].h) };
        window.__realLC = window.__realLC || window.lessonChance;
        window.lessonChance = () => 1;
        const ch = lessons[0];
        mouse.x = mouse.sx = ch.x + 20;
        mouse.y = mouse.sy = ch.y + 10;
        handleTrickClick();
        window.lessonChance = window.__realLC;
        out.closed = !trickUI;
        out.degree = f.coloristDegree;
        out.said = __said.slice();
        // Drawing it doesn't throw
        trickUI = { phase: "menu", id: f.id };
        drawTrickUI(ctx);
        closeTrickUI();
        // The Fluff TV torture channel's reform keeps personalities a list
        const s = __mk(800, 0.5, "male");
        s.personalities = ["smarty"];
        s.coloristDegree = 0.2;
        reformSmarty(s);
        out.tv = [Array.isArray(s.personalities), s.isSmarty()];
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      checkEqual(JSON.stringify(r.keys), JSON.stringify(["lesson:colours", "lesson:litter"]), "colour and litter lessons");
      check(r.below, "a row under the tricks");
      check(r.closed, "menu closes");
      check(Math.abs(r.degree - 0.62) < 0.001, `the lesson worked ${r.degree}`);
      check(r.said.some((m) => /listened/.test(m)), `told ${r.said}`);
      checkEqual(JSON.stringify(r.tv), JSON.stringify([true, false]), "reformed properly");
    },
  },
];
