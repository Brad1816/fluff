// Runaways, letting go and herd lore (Runaways.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(121);
  storyBook = freshStoryBook();
  _storyIndex = null;
  _gossipPairs = null;
  timePlayed = 3 * DAY_LENGTH + 3 * HOUR_LENGTH; // (11:00: runaways go in the daytime)
  for (const f of fluffies) f._bolt = null;
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
    name: "runaways: a Rebel or a frightened, miserable fluffy makes for the door; unseen, it's gone when time's up; its story goes with it",
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
        out.chances = [runAwayChance(rebel), runAwayChance(scared), runAwayChance(broken), runAwayChance(fine)];
        // Not at night
        const t0 = timePlayed;
        timePlayed = 3 * DAY_LENGTH + 15 * HOUR_LENGTH; // 23:00
        _raDayChecked = getDayNumber() - 1;
        const real = Math.random;
        Math.random = () => 0.01;
        runawaysTicker.fireNext();
        updateRunaways(2);
        out.night = !!rebel._bolt;
        timePlayed = t0;
        _raDayChecked = getDayNumber() - 1;
        uiMessages.length = 0;
        runawaysTicker.fireNext();
        updateRunaways(2);
        Math.random = real;
        out.bolting = [isBolting(rebel), rebel.adopted, uiMessages.some((m) => /Rowan is making for the door/.test(m.text))];
        _todayCache = null;
        out.today = todayItems().some((i) => /Rowan is making for the door/.test(i.text));
        // Out of sight in a side room: gone when time's up
        timePlayed += BOLT_HOURS * HOUR_LENGTH + 1;
        updateRunaways(0.1);
        out.rebel = [rebel.adopted, rebel.scene === PARK_SCENE, rebel.formerPet && rebel.formerPet.how];
        out.story = storyOf(rebel).some((e) => e.k === "turning" && /Rowan ran away from home/.test(e.x));
        out.news = dayStats.news.some((n) => /Rowan tried to run away/.test(n)) && dayStats.news.some((n) => /Rowan ran away/.test(n));
        // A Rebel leads
        out.lead = runawayLeaderBonus(rebel);
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.chances), JSON.stringify([0.25, 0.1, 0, 0]), "who might run");
      checkEqual(r.night, false, "not in the night");
      checkEqual(JSON.stringify(r.bolting), JSON.stringify([true, true, true]), "making for the door, still yours, you're told");
      check(r.today, "on Today");
      check(r.rebel[0] === false && r.rebel[1] && r.rebel[2] === "ran away", `ran to the park ${r.rebel}`);
      check(r.story && r.news, "story and news");
      checkEqual(r.lead, 0.6, "a Rebel leads");
    },
  },
  {
    name: "runaways: in the room you're watching it walks (through the house) to the front door and out; picking it up or a kind word stops it",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        changeScene("INDOORSL1");
        currentScene = "INDOORSL1";
        const a = __mk(500, "INDOORSL1");
        a.title = "Rebel";
        startBolt(a);
        // It walks to the side of the room nearest home, then through to the main room
        let steps = 0;
        while (a.scene === "INDOORSL1" && steps++ < 60 * 120) updateSimulation(1 / 60);
        out.throughHouse = a.scene;
        out.stillYours = a.adopted;
        currentScene = "INDOORS";
        steps = 0;
        while (a.adopted && steps++ < 60 * 200) updateSimulation(1 / 60);
        out.out = [a.adopted, a.scene === PARK_SCENE, a.formerPet && a.formerPet.how];
        // Picked up: stays
        const b = __mk(300, "INDOORS");
        b.title = "Rebel";
        startBolt(b);
        b.isDragging = true;
        updateRunaways(1 / 60);
        b.isDragging = false;
        out.held = [!!b._bolt, b.adopted];
        // A kind word: stays
        const c = __mk(700, "INDOORS");
        c.title = "Rebel";
        startBolt(c);
        timePlayed += 5;
        giveAffection(c, "brushed");
        updateRunaways(1 / 60);
        out.kind = [!!c._bolt, c.adopted];
        return out;
      }, SETUP);
      checkEqual(r.throughHouse, "INDOORS", "through to the main room");
      check(r.stillYours, "still yours on the way");
      check(r.out[0] === false && r.out[1], `out of the front door ${r.out}`);
      checkEqual(JSON.stringify(r.held), JSON.stringify([false, true]), "picked up: it stays");
      checkEqual(JSON.stringify(r.kind), JSON.stringify([false, true]), "a kind word: it stays");
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
