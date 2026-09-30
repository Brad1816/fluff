// The story book (StoryBook.js) and its debug view (StoryDebug.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(99);
  storyBook = freshStoryBook();
  _storyIndex = null;
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH;
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
    name: "storybook: big events are stored once and shared; names, tricks, births and deaths are recorded",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(300);
        const dad = __mk(400, "male");
        fluffyNames[mum.id] = "Daisy";
        recordStory("named", mum, { x: "Daisy" });
        mum.triggerPregnancy(dad);
        mum.anatomy.spawnBaby(true);
        const foal = fluffies[fluffies.length - 1];
        mum.anatomy.spawnBaby(false);
        const out = {};
        const mumStory = storyOf(mum);
        const foalStory = storyOf(foal);
        out.kinds = mumStory.map((e) => e.k);
        out.shared = mumStory.find((e) => e.k === "born") === foalStory.find((e) => e.k === "born");
        out.bornText = storyEventText(foalStory.find((e) => e.k === "born"));
        out.dadIn = storyOf(dad).some((e) => e.k === "born");
        // Trick learnt
        _trLearn(mum, "sit", 0.8);
        out.trick = storyOf(mum).some((e) => e.k === "trick" && e.x === "Sit");
        // Death, with the cause
        dad.die(null, "Old age");
        const died = storyOf(dad).find((e) => e.k === "died");
        out.died = died && storyEventText(died);
        // The family story includes the parents' and the foal's events
        out.family = storyOfFamily(foal).map((e) => e.k);
        return out;
      }, SETUP);
      check(r.kinds.includes("named") && r.kinds.includes("born") && r.kinds.includes("stillborn"), `mum's story ${r.kinds}`);
      check(r.shared, "the birth is one event in both stories");
      check(/was born to Daisy/.test(r.bornText), r.bornText);
      check(r.dadIn, "dad is in it too");
      check(r.trick, "tricks learnt");
      check(r.died && /died \(old age\)/.test(r.died), `death ${r.died}`);
      check(r.family.includes("died") && r.family.includes("named"), `family story ${r.family}`);
    },
  },
  {
    name: "storybook: small things become daily tallies; old tallies merge by year, then for life; harm from you merges; it saves",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(300);
        const out = {};
        for (let i = 0; i < 3; i++) giveAffection(f, "brushed");
        giveAffection(f, "treat");
        giveAffection(f, "played");
        recordStory("fright", f);
        let tallies = storyOf(f).filter((e) => e.k === "tally");
        out.day1 = [tallies.length, tallies[0].c.brushed, tallies[0].c.fright];
        // Another day, another tally
        timePlayed += DAY_LENGTH;
        giveAffection(f, "brushed");
        out.twoDays = storyOf(f).filter((e) => e.k === "tally").length;
        // Harm from you, twice in a minute: one event, twice
        rememberPlayerEvent(f, "stick");
        timePlayed += 10;
        rememberPlayerEvent(f, "stick");
        const harm = storyOf(f).filter((e) => e.k === "harmed");
        out.harm = [harm.length, harm[0].n];
        recordStory("named", f, { x: "Pip" });
        // A year and a bit later: the day tallies merge into one for that year
        timePlayed += 14 * DAY_LENGTH;
        compactStory();
        tallies = storyOf(f).filter((e) => e.k === "tally");
        out.year = [tallies.length, tallies[0].y, tallies[0].c.brushed];
        // Over the cap: one for its whole life; big events stay
        compactStory(true);
        tallies = storyOf(f).filter((e) => e.k === "tally");
        out.life = [tallies.length, !!tallies[0].life, tallies[0].c.brushed];
        out.bigKept = storyOf(f).filter((e) => e.k !== "tally").map((e) => e.k);
        // Saving and loading
        const save = {};
        writeSavedGameState(save);
        const copy = JSON.parse(JSON.stringify(save));
        storyBook = freshStoryBook();
        _storyIndex = null;
        readSavedGameState(copy);
        out.loaded = storyOf(f).map((e) => e.k);
        out.size = storyTotals().bytes > 0;
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.day1), JSON.stringify([1, 3, 1]), "one tally for the day: brushed x3, fright x1");
      checkEqual(r.twoDays, 2, "a new day, a new tally");
      checkEqual(JSON.stringify(r.harm), JSON.stringify([1, 2]), "two hits in a minute: one event, twice (and treats and play aren't harm)");
      checkEqual(JSON.stringify(r.year), JSON.stringify([1, 0, 4]), "merged into one tally for the year");
      checkEqual(JSON.stringify(r.life), JSON.stringify([1, true, 4]), "over the cap: one tally for life");
      check(r.bigKept.includes("harmed") && r.bigKept.includes("named"), `big events kept ${r.bigKept}`);
      check(r.loaded.includes("named") && r.loaded.includes("tally"), `saved and loaded ${r.loaded}`);
      check(r.size, "size estimate");
    },
  },
  {
    name: "storybook: the debug view opens with J (for the fluffy in the magnifying glass) and draws every tab",
    run: async (page) => {
      await page.evaluate((setup) => {
        eval(setup)();
        const a = __mk(300);
        const b = __mk(500);
        fluffyNames[b.id] = "Bee";
        recordStory("named", b, { x: "Bee" });
        giveAffection(b, "brushed");
        inspectedFluffy = b;
        window.__b = b;
      }, SETUP);
      await page.keyboard.press("j");
      const r = await page.evaluate(() => {
        const out = { open: isStoryDebugOpen(), picked: storyDebugId === __b.id, inspection: inspectedFluffy };
        let err = null;
        try {
          for (const t of ["fluffy", "family", "book"]) {
            storyDebugTab = t;
            drawStoryDebug(ctx);
          }
        } catch (e) {
          err = String(e);
        }
        out.err = err;
        storyDebugTab = "fluffy";
        out.lines = _sdLines();
        closeStoryDebug();
        return out;
      });
      check(r.open, "J opens it");
      check(r.picked, "on the fluffy from the magnifying glass");
      checkEqual(r.err, null, "every tab draws");
      check(r.lines.some((l) => /Named Bee/.test(l)) && r.lines.some((l) => /brushed x1/.test(l)), `lines ${r.lines}`);
    },
  },
];
