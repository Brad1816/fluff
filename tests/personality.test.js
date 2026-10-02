// Personality (Personality.js): what each fluffy loves most, and how its
// life changes who it is
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(61);
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
    h.happiness = 0.6;
    h.playerTrust = 0.3;
    h.playerFear = 0;
    h.brain.think = () => {};
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "personality: each fluffy loves one kind of care most - it counts extra, and finding it goes in the story",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(300);
        fluffyNames[f.id] = "Tansy";
        f.favouriteCare = "brushed";
        const out = { before: describeFavouriteCare(f) };
        const t0 = f.playerTrust;
        giveAffection(f, "treat");
        out.treat = f.playerTrust - t0;
        const t1 = f.playerTrust;
        giveAffection(f, "brushed");
        out.brush = f.playerTrust - t1;
        out.after = describeFavouriteCare(f);
        out.story = storyOf(f).filter((e) => e.k === "fav_found").map((e) => e.x);
        // The same fluffy, brushing not its favourite, then its favourite
        const g = __mk(400, "male");
        g.favouriteCare = "gift";
        const b0 = g.playerTrust;
        giveAffection(g, "brushed");
        out.plainBrush = g.playerTrust - b0;
        g.favouriteCare = "brushed";
        const b1 = g.playerTrust;
        giveAffection(g, "brushed");
        out.favBrush = g.playerTrust - b1;
        return out;
      }, SETUP);
      check(/Not found yet/.test(r.before[0]), `before: ${r.before}`);
      check(r.favBrush > r.plainBrush * 1.4, `favourite counts extra: ${r.favBrush} vs ${r.plainBrush}`);
      checkEqual(r.after[0], "Being brushed", "shown once found");
      check(r.story.length === 1 && /She was never much for treats, but she'd melt when you brushed her\./.test(r.story[0]), `story: ${r.story}`);
    },
  },
  {
    name: "personality: comfort, harm, hunger, love and fears overcome shift traits a step at a time, noted in the story; foals pick up some",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(300);
        fluffyNames[f.id] = "Moss";
        for (let i = 0; i < GROW_COMFORTS; i++) recordStory("comforted", f);
        for (let i = 0; i < GROW_HARMS; i++) {
          timePlayed += 100;
          rememberPlayerEvent(f, "stick");
        }
        out.afterComfortHarm = { ...f.traitShift };
        // Hungry for two days
        f.hunger = 0.1;
        for (let i = 0; i < (GROW_HUNGRY_DAYS * DAY_LENGTH) / 5 + 2; i++) updatePersonality(5);
        f.hunger = 1;
        out.greedier = f.traitShift.appetite;
        // A fear it gets over
        f.fears = { thunder: 0.6, dark: 0, bot: 0 };
        for (const fe of FEARS) if (fe.key !== "thunder") f.fears[fe.key] = 0;
        if (f.growthProgress) f.growthProgress.fears = {}; // (only thunder: not a fear it was born with, too)
        timePlayed += DAY_LENGTH;
        updatePersonality(5);
        f.fears.thunder = 0;
        timePlayed += DAY_LENGTH;
        updatePersonality(5);
        out.braver = f.traitShift.bravery;
        out.story = storyOf(f).filter((e) => e.k === "trait_shift").map((e) => e.x);
        out.words = describeTraitShifts(f);
        // Traits include the shift
        out.value = [traitValue(f.genes, "appetite"), traitValue(f, "appetite")];
        // A rule stops after a few steps
        for (let i = 0; i < 10 * GROW_COMFORTS; i++) recordStory("comforted", f);
        out.calmCap = f.traitShift.temper;
        // A foal copies some of its mum's shifts while growing up
        const foal = __mk(500, "female", 0.3);
        foal.motherId = f.id;
        foal.traitShift = {};
        for (let i = 0; i < 400; i++) applyUpbringing(foal, 10);
        out.foal = foal.traitShift.temper || 0;
        return out;
      }, SETUP);
      checkEqual(r.afterComfortHarm.temper, -0.1, "comforted through frights: calmer");
      checkEqual(r.afterComfortHarm.bravery, -0.1, "hurt again and again: more timid");
      checkEqual(r.greedier, 0.1, "hungry for days: greedier");
      checkEqual(r.braver, 0, "got over thunder: braver (back from -0.1)");
      check(r.story.some((s) => /Getting over her fear of thunder made Moss braver\./.test(s)), `story ${r.story}`);
      check(r.story.some((s) => /comforted through so many frights made Moss calmer/.test(s)), `story ${r.story}`);
      check(/Calmer/.test(r.words) && /greedier/.test(r.words), `words: ${r.words}`);
      check(Math.abs(r.value[1] - r.value[0] - 0.1) < 0.001 || r.value[1] === 1, `trait value includes the shift ${r.value}`);
      checkEqual(r.calmCap, -0.3, "a rule moves a trait at most 3 times");
      check(r.foal < -0.05 && r.foal > -0.15, `foal picks up about a third: ${r.foal}`);
    },
  },
];
