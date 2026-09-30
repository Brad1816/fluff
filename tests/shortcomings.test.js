// Fixes for the shortcomings left after the review: passive trust, rent on
// net takings, witnessing weighs less and fades, one day counter, the top
// bar on small windows, the save tidy-up
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __clearScene("BACKYARD");
  storyBook = freshStoryBook();
  _storyIndex = null;
  fluffyRecords = {};
  _kinCache = new Map();
  window.__sc = (scene = "INDOORS", x = 400, gender = "female") => {
    const f = new Horse(1, null, scene, "earthy", null, 0.6, 0.6, gender);
    f.adopted = true;
    f.x = x;
    f.y = 450;
    f.hunger = 1;
    f.happiness = 0.6;
    f.personalities = f.personalities.filter((p) => p !== "smarty");
    fluffies.push(f);
    return f;
  };
}`;

module.exports = [
  {
    name: "shortcomings: being fed takes trust only as far as liking you (and a Feed-Bot meal not at all); rent follows takings less stock bought",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __sc();
        f.playerTrust = 0.5;
        f.playerFear = 0;
        f.recentMeals = [];
        f.currentStateKey = "EATING";
        f._mealFromYou = true;
        for (let i = 0; i < 400; i++) updatePlayerMemory(f, 1);
        out.fedByYou = +f.playerTrust.toFixed(3);
        const g = __sc("INDOORS", 600);
        g.playerTrust = 0.5;
        g.playerFear = 0;
        g.recentMeals = [];
        g.currentStateKey = "EATING";
        g._mealFromYou = false;
        g.happiness = 0.2;
        for (let i = 0; i < 400; i++) updatePlayerMemory(g, 1);
        out.feedBot = +g.playerTrust.toFixed(3);
        // Care still goes further
        f.currentStateKey = "IDLE";
        giveAffection(f, "brushed");
        out.brushed = f.playerTrust > 0.6;
        // Net takings
        economy = freshEconomy();
        noteIncome(500);
        noteSpending(200);
        out.today = economy.today;
        noteSpending(1000);
        out.negative = economy.today;
        economy.week = [{ day: 1, amount: -700 }];
        out.target = rentTarget() === RENT_BASE;
        return out;
      }, SETUP);
      checkEqual(r.fedByYou, 0.6, "fed by you: up to liking you");
      checkEqual(r.feedBot, 0.5, "the Feed-Bot's meals don't make it trust you");
      check(r.brushed, "care goes further");
      checkEqual(r.today, 300, "takings less stock bought");
      checkEqual(r.negative, -700, "a day of buying");
      check(r.target, "a losing week doesn't lower the rent below base");
    },
  },
  {
    name: "shortcomings: seeing harm counts a third and harm fades from dreams over a year; the story book and the clock agree on the day",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __sc();
        a.growthProgress = {};
        noteGrowthEvent(a, "harmed", { x: MEMORY_TEXT.witness });
        out.witnessed = +a.growthProgress.harmed.toFixed(3);
        noteGrowthEvent(a, "harmed", {});
        out.both = +a.growthProgress.harmed.toFixed(3);
        // Dreams: fresh harm is dream material; a year on it's half as strong
        const b = __sc("INDOORS", 600);
        timePlayed = 30 * DAY_LENGTH;
        recordStory("harmed", b, { x: "Hit with a stick" });
        const fresh = dreamMaterial(b).find((m) => m.harm);
        timePlayed += 3 * 12 * DAY_LENGTH;
        const old = dreamMaterial(b).find((m) => m.harm);
        out.dreams = [!!fresh, fresh ? fresh.weight : 0, old ? old.weight : 0];
        // Only saw it: a third
        const c = __sc("INDOORS", 800);
        recordStory("harmed", c, { x: MEMORY_TEXT.witness });
        const seen = dreamMaterial(c).find((m) => m.harm);
        out.seen = seen ? seen.weight : 0;
        out.freshW = fresh ? fresh.weight : 0;
        // Day counter: at 02:00 on Day 6 the story book says Day 6 too
        timePlayed = 4 * DAY_LENGTH + 18 * HOUR_LENGTH; // (starts at 08:00)
        out.clock = [getDayNumber(), Math.floor(gameHour())];
        storyBook = freshStoryBook();
        _storyIndex = null;
        recordStory("brushed", b);
        const tally = storyOf(b).find((e) => e.k === "tally");
        out.storyDay = tally.d + 1;
        out.titleTally = _tiRecentTally(b, 1).brushed || 0;
        return out;
      }, SETUP);
      checkEqual(r.witnessed, 0.333, "seen: a third");
      checkEqual(r.both, 1.333, "and felt: whole");
      check(r.dreams[0] && r.dreams[1] > 0, "fresh harm in its dreams");
      check(r.dreams[2] < r.dreams[1], `older harm weighs less ${r.dreams}`);
      check(r.seen > 0 && r.seen < r.freshW / 2, `only seeing it weighs a third: ${r.seen} vs ${r.freshW}`);
      checkEqual(JSON.stringify(r.clock), JSON.stringify([6, 2]), "Day 6, 2am");
      checkEqual(r.storyDay, 6, "the story book's day");
      checkEqual(r.titleTally, 1, "today's tally counts as today for titles");
    },
  },
  {
    name: "shortcomings: the save tidy-up drops long-gone wild fluffies and their old stories, keeps yours and your family",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        timePlayed = 40 * DAY_LENGTH;
        const mine = __sc();
        const rec = (id, o) => (fluffyRecords[id] = { id, name: null, motherId: null, fatherId: null, fosterMotherId: null, status: "gone", genes: null, ...o });
        recordFluffy(mine);
        // Ancestors 1..4 generations up; the fourth is beyond keeping
        rec(9001, { status: "dead" });
        rec(9002, { status: "dead", motherId: 9001 });
        rec(9003, { status: "dead", motherId: 9002 });
        rec(9004, { status: "dead", motherId: 9003 });
        mine.motherId = 9004;
        fluffyRecords[mine.id].motherId = 9004;
        // A sold one of yours, long ago
        rec(9100, { status: "sold", mine: true });
        // A foal of yours born in the park, dead since
        rec(9101, { status: "dead", motherId: 9100 });
        // Its foal (your old fluffy's grandfoal), wild and gone
        rec(9102, { status: "dead", motherId: 9101 });
        // A wild one still alive in the park
        const wild = __sc("INDOORS", 700);
        wild.adopted = false;
        rec(wild.id, { status: "alive" });
        // Stories: an old one about the gone grandfoal, a new one, and yours
        const t0 = timePlayed;
        timePlayed = t0 - 20 * DAY_LENGTH;
        storyBook.events.push({ i: 101, t: timePlayed, k: "born", w: [9102] });
        storyBook.events.push({ i: 102, t: timePlayed, k: "born", w: [9100] });
        timePlayed = t0;
        storyBook.events.push({ i: 103, t: timePlayed - DAY_LENGTH, k: "died", w: [9102] });
        _storyIndex = null;
        const dropped = tidyFamilyRecords();
        out.dropped = dropped;
        out.kept = [9001, 9002, 9003, 9004, 9100, 9101, 9102, mine.id, wild.id].map((id) => !!fluffyRecords[id]);
        out.story = storyBook.events.map((e) => e.i).filter((i) => i > 100);
        // Old saves (no "mine" on records): nothing old is lost
        fluffyRecords = {};
        rec(9200, { status: "dead" });
        rec(9201, { status: "breeder" });
        tidyFamilyRecords();
        out.migrated = [!!fluffyRecords[9200], fluffyRecords[9200] && fluffyRecords[9200].mine];
        // The save list keeps a little preview, not the whole save
        out.preview = Object.keys(savePreviewOf({ timePlayed: 5, saveDate: "x", money: 3, fluffies: [1, 2, 3], storyBook: {} })).sort().join();
        return out;
      }, SETUP);
      checkEqual(r.dropped, 2, "dropped: the far ancestor and the wild grandfoal");
      checkEqual(JSON.stringify(r.kept), JSON.stringify([false, true, true, true, true, true, false, true, true]), "who's kept");
      checkEqual(JSON.stringify(r.story), JSON.stringify([102, 103]), "old wild stories go, recent and yours stay");
      checkEqual(JSON.stringify(r.migrated), JSON.stringify([true, true]), "an old save keeps its book");
      checkEqual(r.preview, "money,saveDate,timePlayed", "preview only");
    },
  },
  {
    name: "shortcomings: on a narrow window the top bar's buttons never overlap",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const out = [];
        for (const right of [100, 200, 280]) {
          const rects = [getGameSpeedLayout(right).buttons.slice(-1)[0], getGoalsButtonRect(right), getRecordsButtonRect(right), getHelpButtonRect(right), getTodayButtonRect(right), getHouseholdButtonRect(right)];
          let ok = true;
          for (let i = 1; i < rects.length; i++) if (rects[i].x < rects[i - 1].x + rects[i - 1].w) ok = false;
          out.push([right, ok, topBarSqueeze(right)]);
        }
        return out;
      });
      // (the test window is 1280 wide: roomy at 100, squeezed further right)
      checkEqual(r[0][2], 0, "room for everything");
      for (const [right, ok, sq] of r) if (sq < 2 || right < 280) check(ok, `no overlap with the chat log ending at ${right}`);
    },
  },
];
