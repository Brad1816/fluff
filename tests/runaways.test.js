// Runaways, letting go and herd lore (Runaways.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(121);
  storyBook = freshStoryBook();
  _storyIndex = null;
  _gossipPairs = null;
  timePlayed = 3 * DAY_LENGTH;
  window.__mk = (x, scene = "INDOORSL1", gender = "female") => {
    const h = new Horse(1, null, scene, "earthy", null, 0.5, 0.5, gender);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.happiness = 0.6;
    h.playerTrust = 0.5;
    h.playerFear = 0;
    h.brain.think = () => {};
    h.wishCooldownUntil = 1e12;
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "runaways: a Rebel or a frightened, miserable fluffy may slip away to the park - not from the room you're watching; its story goes with it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        changeScene("INDOORS");
        const out = {};
        const rebel = __mk(300);
        fluffyNames[rebel.id] = "Rowan";
        rebel.title = "Rebel";
        const scared = __mk(400);
        scared.playerFear = 0.8;
        scared.happiness = 0.1;
        const broken = __mk(500);
        broken.title = "Broken";
        const fine = __mk(600);
        const watched = __mk(700, "INDOORS");
        watched.title = "Rebel";
        out.chances = [runAwayChance(rebel), runAwayChance(scared), runAwayChance(broken), runAwayChance(fine)];
        _raDayChecked = getDayNumber() - 1;
        const real = Math.random;
        Math.random = () => 0.01;
        runawaysTicker.fireNext();
        updateRunaways(2);
        Math.random = real;
        out.rebel = [rebel.adopted, rebel.scene === PARK_SCENE, rebel.formerPet && rebel.formerPet.how];
        out.watched = watched.adopted;
        out.story = storyOf(rebel).some((e) => e.k === "turning" && /Rowan ran away from home/.test(e.x));
        out.news = dayStats.news.some((n) => /Rowan ran away/.test(n));
        // A Rebel leads
        out.lead = runawayLeaderBonus(rebel);
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.chances), JSON.stringify([0.25, 0.1, 0, 0]), "who might run");
      check(r.rebel[0] === false && r.rebel[1] && r.rebel[2] === "ran away", `ran to the park ${r.rebel}`);
      checkEqual(r.watched, true, "not while you're watching");
      check(r.story && r.news, "story and news");
      checkEqual(r.lead, 0.6, "a Rebel leads");
    },
  },
  {
    name: "runaways: let one go in the park; it tells the wild ones about you (herd lore); you meet it again; it can come home",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        changeScene(PARK_SCENE);
        const f = __mk(400, PARK_SCENE);
        fluffyNames[f.id] = "Clover";
        f.playerTrust = 0.95;
        out.action = releaseActions(f).map((a) => a.name);
        releaseFluffy(f);
        out.wild = [f.adopted, f.formerPet.how];
        // It tells a wild one you're kind
        const w = __mk(500, PARK_SCENE);
        w.adopted = false;
        w.playerTrust = 0.2;
        setRelationship(f.id, w.id, "friend");
        onFluffiesChatted(f, w);
        out.warmed = +(w.playerTrust - 0.2).toFixed(3);
        // Herd lore
        herdState.herds = [{ id: 99, name: "Sunny Meadow", memberIds: [f.id, w.id], leaderId: f.id, color: "#fff" }];
        _herdChanged && _herdChanged();
        out.lore = describeHerdLore(herdState.herds[0]);
        // Seen again
        f.x = camera.x + 400;
        f.y = camera.y + 400;
        uiMessages.length = 0;
        runawaysTicker.fireNext();
        updateRunaways(2);
        out.met = uiMessages.some((m) => /You spot Clover in the park - it was let go today/.test(m.text));
        // Home again
        onFormerPetHome(f);
        f.adopted = true;
        out.home = [f.formerPet, storyOf(f).some((e) => /came home again/.test(e.x || ""))];
        return out;
      }, SETUP);
      checkEqual(r.action.join(), "Let it go", "the action, in the park");
      check(r.wild[0] === false && r.wild[1] === "let go", `wild ${r.wild}`);
      check(r.warmed > 0, `the wild one warms to you ${r.warmed}`);
      checkEqual(r.lore, "they've heard you're kind", "herd lore");
      check(r.met, "you meet it again");
      check(r.home[0] === null && r.home[1], "home again");
    },
  },
];
