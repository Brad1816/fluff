// Lives and photos in the Memories book (Lives.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(131);
  storyBook = freshStoryBook();
  _storyIndex = null;
  livesBook = freshLivesBook();
  sharedMemories = freshSharedMemories();
  timePlayed = 5 * DAY_LENGTH;
  window.__mk = (x, gender = "female") => {
    const h = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, gender);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.happiness = 0.6;
    h.brain.think = () => {};
    h.wishCooldownUntil = 1e12;
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "lives: when one of yours dies its story closes with an epilogue in the Memories book; you can reread it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        changeScene("INDOORS");
        const out = {};
        const f = __mk(300);
        fluffyNames[f.id] = "Wren";
        const g = __mk(420, "male");
        fluffyNames[g.id] = "Rowan";
        f.age = 30 * DAY_LENGTH;
        f.tricks = { sit: 0.9, fetch: 0.8 };
        f.title = "Cherished";
        recordStory("brushed", f);
        f.die(null, "Old age");
        const life = livesBook.lives[0];
        out.life = life && [life.name, life.title, life.epilogue];
        // Reading it in the book
        openMemoriesBook();
        memoriesBookTab = "lives";
        const L = getMemoriesBookLayout();
        let err = null;
        try {
          drawMemoriesBook(ctx);
          const V = _livesLayout(L);
          mouse.x = V.rows[0].read.x + 5;
          mouse.y = V.rows[0].read.y + 5;
          handleMemoriesBookClick();
          out.reading = livesReading;
          drawMemoriesBook(ctx);
          out.chapters = lifeStoryChapters(_lifeStub(life)).map((c) => c.title);
        } catch (e) {
          err = String(e && e.stack);
        }
        out.err = err;
        closeMemoriesBook();
        // Wild ones don't go in
        const w = __mk(600);
        w.adopted = false;
        w.die(null, "Old age");
        out.count = livesBook.lives.length;
        return out;
      }, SETUP);
      check(r.life && r.life[0] === "Wren" && r.life[1] === "Cherished", `life ${r.life}`);
      check(/Wren lived 2 years/.test(r.life[2]) && /was Cherished to the end/.test(r.life[2]) && /sit and fetch/.test(r.life[2]) && /old age/.test(r.life[2]) && /with Rowan beside her/.test(r.life[2]), `epilogue: ${r.life[2]}`);
      checkEqual(r.err, null, "the book draws");
      check(r.reading !== null && r.reading !== undefined, "reading it");
      check(r.chapters.length >= 1, `its chapters ${r.chapters}`);
      checkEqual(r.count, 1, "only your own");
    },
  },
  {
    name: "photos: a right-click photo with a caption of what it's doing goes in its story and the book; kept to a limit",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        changeScene("INDOORS");
        const out = {};
        const f = __mk(300);
        fluffyNames[f.id] = "Wren";
        const g = __mk(360, "male");
        fluffyNames[g.id] = "Rowan";
        f.currentStateKey = "SLEEPING";
        g.currentStateKey = "SLEEPING";
        out.action = photoActions(f).map((a) => a.name);
        const p = takePhoto(f);
        out.photo = [p.caption, !!p.data && p.data.startsWith("data:image/jpeg")];
        out.rest = photoActions(f).length;
        out.story = lifeStoryChapters(f).some((c) => c.lines.some((l) => /You took a photo: "Wren asleep in a pile with Rowan"/.test(l)));
        for (let i = 0; i < PHOTO_MAX + 5; i++) {
          f._photoAt = undefined;
          takePhoto(f);
        }
        out.kept = livesBook.photos.length;
        openMemoriesBook();
        memoriesBookTab = "photos";
        let err = null;
        try { drawMemoriesBook(ctx); } catch (e) { err = String(e); }
        out.err = err;
        closeMemoriesBook();
        return out;
      }, SETUP);
      checkEqual(r.action.join(), "Take a photo", "the action");
      checkEqual(r.photo[0], "Wren asleep in a pile with Rowan", "caption");
      check(r.photo[1], "a picture");
      checkEqual(r.rest, 0, "not again straight away");
      check(r.story, "in its story");
      checkEqual(r.kept, 40, "kept to a limit");
      checkEqual(r.err, null, "the book draws");
    },
  },
];
