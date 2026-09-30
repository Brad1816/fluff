// Family lines and the keeper summary (FamilyLines.js, WeekSummary.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(141);
  storyBook = freshStoryBook();
  _storyIndex = null;
  weekStats = freshWeekStats();
  roomClimate = freshRoomClimate();
  timePlayed = 5 * DAY_LENGTH;
  window.__mk = (x, gender = "female", growth = 1, mum = null) => {
    const h = new Horse(growth, mum ? mum.id : null, "INDOORS", "earthy", null, 0.5, 0.5, gender);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.happiness = 0.6;
    h.brain.think = () => {};
    h.wishCooldownUntil = 1e12;
    if (mum) h.motherId = mum.id;
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "family lines: a line earns a name, passes down a trick from mum to foal, and old fears echo",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const gran = __mk(200);
        fluffyNames[gran.id] = "Daisy";
        const mum = __mk(300, "female", 1, gran);
        fluffyNames[mum.id] = "Poppy";
        const foal = __mk(340, "female", 0.4, mum);
        fluffyNames[foal.id] = "Bean";
        for (const f of [gran, mum, foal]) f.traitShift = { temper: -0.9 };
        gran.tricks = { sit: 0.9 };
        mum.tricks = { sit: 0.8 };
        syncFamilyRecords && syncFamilyRecords();
        out.root = lineRootOf(foal.id) === gran.id;
        out.rep = lineReputation(gran.id);
        out.row = describeLine(foal);
        out.tradition = lineTradition(mum);
        for (let d = 0; d < 12 && trickSkill(foal, "sit") < TRICK_KNOWN; d++) {
          timePlayed += DAY_LENGTH;
          familyLinesTicker.fireNext();
          updateFamilyLines(5);
        }
        out.learnt = trickSkill(foal, "sit") >= TRICK_KNOWN;
        out.story = storyOf(foal).filter((e) => e.k === "turning").map((e) => e.x);
        // Echo
        gran.fears = { thunder: 0.6, dark: 0, bot: 0 };
        foal.fears = { thunder: 0.4, dark: 0, bot: 0 };
        familyLinesTicker.fireNext();
        updateFamilyLines(5);
        out.echo = storyOf(foal).some((e) => /afraid of thunder, like her grandmother Daisy/.test(e.x || ""));
        return out;
      }, SETUP);
      check(r.root, "the line goes back to gran");
      check(/famously gentle/.test(r.rep), `reputation ${r.rep}`);
      check(r.row && /^Daisy's line: famously gentle/.test(r.row[0]), `row ${r.row}`);
      checkEqual(r.tradition, "sit", "the tradition");
      check(r.learnt, "mum teaches her foal");
      check(r.story.some((s) => /Bean learnt to sit from her mother, like all of Daisy's line/.test(s)), `story ${r.story}`);
      check(r.echo, "the echo");
    },
  },
  {
    name: "keeper summary: once a week a plain paragraph about who came to love you, new titles, births and the rooms",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __mk(300);
        const b = __mk(400);
        noteWeekLoved(a);
        noteWeekLoved(b);
        noteWeekTitle(a, "Broken");
        for (let i = 0; i < 4; i++) recordStory("attacked", a);
        for (let i = 0; i < 12; i++) recordStory("attacked", b);
        const mkReport = (d, born = []) => ({ dayNumber: d, born, died: [], sold: { count: 0 } });
        const texts = [];
        for (let d = 10; d < 17; d++) texts.push(weekSummaryFor(mkReport(d, d === 11 ? ["Bean"] : [])));
        out.texts = texts;
        out.after = weekStats.loved.length;
        // Drawn in the report
        dayReportShown = { ...mkReport(17), moneyStart: 0, moneyEnd: 0, arrived: [], orders: { count: 0, money: 0 }, news: [], scarred: [], weather: [], wildArrived: 0, wildDied: 0, nightEvents: [], bills: null, season: "Spring", summary: texts[6] };
        let err = null;
        try { drawDayReport(ctx); } catch (e) { err = String(e); }
        out.err = err;
        dayReportShown = null;
        return out;
      }, SETUP);
      check(r.texts.slice(0, 6).every((t) => t === null), "only once a week");
      check(/^This week 2 fluffies grew to love you, 1 became Broken, 1 foal was born, and the living room has been Tense since day 10\.$/.test(r.texts[6]), `summary: ${r.texts[6]}`);
      checkEqual(r.after, 0, "a new week starts");
      checkEqual(r.err, null, "drawn in the report");
    },
  },
];
