// Life stories: the Story tab in the magnifying glass (LifeStory.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(41);
  storyBook = freshStoryBook();
  _storyIndex = null;
  timePlayed = 3 * DAY_LENGTH + 2 * HOUR_LENGTH;
  window.__mk = (x, gender = "female", growth = 1) => {
    const h = new Horse(growth, null, "INDOORS", "earthy", null, 0.5, 0.5, gender);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.happiness = 0.8;
    h.brain.think = () => {};
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "life story: chapters in plain English - born, raised, named, small things summed, a litter, a loss",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(300);
        const dad = __mk(400, "male");
        fluffyNames[mum.id] = "Daisy";
        fluffyNames[dad.id] = "Clover";
        mum.triggerPregnancy(dad);
        mum.anatomy.spawnBaby(true);
        const pip = fluffies[fluffies.length - 1];
        mum.anatomy.spawnBaby(true);
        mum.anatomy.spawnBaby(false);
        syncFamilyRecords();
        fluffyNames[pip.id] = "Pip";
        recordStory("named", pip, { x: "Pip" });
        // Foalhood: brushed most days, a fright you comforted
        for (let d = 0; d < 2; d++) {
          giveAffection(pip, "brushed");
          timePlayed += DAY_LENGTH / 2;
        }
        recordStory("fright", pip);
        recordStory("comforted", pip);
        // Grown up: a trick, and dad dies
        timePlayed += 3 * DAY_LENGTH;
        pip.age += 3 * DAY_LENGTH + DAY_LENGTH;
        pip.growth = 1;
        _trLearn(pip, "sit", 0.8);
        dad.die(null, "Old age");
        const pipStory = lifeStoryChapters(pip);
        const mumStory = lifeStoryChapters(mum);
        return {
          pip: pipStory.map((c) => [c.title, c.lines]),
          mum: mumStory.map((c) => [c.title, c.lines]),
        };
      }, SETUP);
      const pipText = JSON.stringify(r.pip);
      const titles = r.pip.map((c) => c[0]);
      check(titles.includes("Foalhood") && titles.includes("Growing up"), `chapters ${titles}`);
      const foal = r.pip.find((c) => c[0] === "Foalhood")[1].join(" ");
      check(/Pip was born on day \d+ to Daisy and Clover\./.test(foal), foal);
      check(/raised by his mum Daisy|raised by her mum Daisy/.test(foal), `raised by: ${foal}`);
      check(/You named (him|her) Pip/.test(foal), `named: ${foal}`);
      check(/You brushed (him|her) (a couple of times|often|almost every day)\./.test(foal), `brushing summed: ${foal}`);
      check(/had a fright, and you comforted (him|her) through it\./.test(foal), `fright: ${foal}`);
      check(/learnt to sit/.test(pipText), "trick");
      check(/(His|Her) dad Clover died of old age on day \d+\./.test(pipText), `loss: ${pipText}`);
      const mumText = JSON.stringify(r.mum);
      check(/She had a litter of 3 on day \d+: Pip and one more; 1 didn't live\./.test(mumText), `litter: ${mumText}`);
      check(!/[a-z]w[a-z]*ie\b|fwuffy/i.test(pipText), "plain English, not fluffy-speak");
    },
  },
  {
    name: "life story: a shelter fluffy's story starts before you; the Story tab draws and turns pages",
    run: async (page) => {
      await page.evaluate((setup) => {
        eval(setup)();
        shelter = freshShelter();
        shelter.stocked = true;
        let res;
        do res = makeShelterResident();
        while (res.origin !== "stray");
        shelter.residents = [res];
        money = 1000;
        const f = adoptShelterResident(res.id);
        // Lots happening, so the story needs more than one page
        for (let d = 0; d < 30; d++) {
          recordStory("turning", f, { x: `Something memorable happened on outing number ${d + 1}, and everyone talked about it for days.` });
        }
        inspectedFluffy = f;
        inspectionTab = "story";
        window.__f = f;
      }, SETUP);
      await page.waitForTimeout(200);
      // (no morning report popping up over it)
      await page.evaluate(() => {
        if (typeof closeDayReport === "function") closeDayReport();
        dayStats.day = reportDayIndex();
      });
      await page.waitForTimeout(100);
      const r1 = await page.evaluate(() => {
        const ch = lifeStoryChapters(__f);
        return { before: (ch.find((c) => c.id === "before") || { lines: [] }).lines, pages: _lifeStoryPages, page: lifeStoryPage };
      });
      const L = await page.evaluate(() => {
        const area = inspectionStoryArea(getInspectionModalLayout());
        return _lsLayout(area).next;
      });
      await page.mouse.click(L.x + L.w / 2, L.y + L.h / 2);
      const after = await page.evaluate(() => ({ page: lifeStoryPage, open: !!inspectedFluffy }));
      check(r1.before.length >= 2, `before you: ${r1.before}`);
      check(/^Found /.test(r1.before[0]), `backstory first: ${r1.before[0]}`);
      check(r1.before.some((l) => /when (she|he) came to you\./.test(l)), `age when it came: ${r1.before}`);
      check(r1.pages > 1, `pages ${r1.pages}`);
      checkEqual(after.page, 1, "Later turns the page");
      check(after.open, "still open");
    },
  },
];
