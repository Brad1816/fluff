// Shared memories and parties (SharedMemories.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(66);
  storyBook = freshStoryBook();
  _storyIndex = null;
  roomClimate = freshRoomClimate();
  sharedMemories = freshSharedMemories();
  _shmFights = {};
  _gossipPairs = null;
  money = 1000;
  window.__mk = (x, gender = "female", growth = 1) => {
    const h = new Horse(growth, null, "INDOORS", "earthy", null, 0.5, 0.5, gender);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.happiness = 0.5;
    h.playerTrust = 0.5;
    h.brain.think = () => {};
    h.wishCooldownUntil = 1e12;
    h.fears = { thunder: 0.6, dark: 0, bot: 0 };
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "shared memories: a storm they went through together - each remembers it its way; the next storm; they bond; a legend for those not there",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __mk(300);
        const b = __mk(400, "male");
        const c = __mk(500);
        fluffyNames[a.id] = "Poppy";
        const like0 = getLiking(a, c);
        for (const f of [a, b, c]) startFright(f, "thunder");
        onComfortedByYou(a, "held");
        const m = sharedMemoriesOf(a)[0];
        out.m = m && [m.kind, m.name, m.who.length, m.view[a.id], m.view[b.id]];
        out.bond = +(getLiking(a, c) - like0).toFixed(2);
        out.line = storyOf(a).filter((e) => e.k === "shared").length;
        // A day later: the next storm
        timePlayed += DAY_LENGTH;
        out.mult = [sharedMemoryFrightMultiplier(a, "thunder"), sharedMemoryFrightMultiplier(b, "thunder"), sharedMemoryFrightMultiplier(a, "dark")];
        // A foal that wasn't there hears about it from b (who faced it alone)
        const foal = __mk(600, "female", 0.4);
        const t0 = fearOf(foal, "thunder");
        setRelationship(b.id, foal.id, "friend");
        onFluffiesChatted(b, foal);
        out.heard = m.heard.includes(foal.id);
        out.foalFear = +(fearOf(foal, "thunder") - t0).toFixed(2);
        out.lines = sharedMemoryLines(m);
        renameSharedMemory(m, "The Big Boomies");
        out.renamed = m.name;
        return out;
      }, SETUP);
      check(r.m && r.m[0] === "storm" && /^The storm of day \d+$/.test(r.m[1]) && r.m[2] === 3, `memory ${r.m}`);
      checkEqual(r.m[3], "good", "comforted: we got through it");
      checkEqual(r.m[4], "bad", "alone: terrifying");
      check(r.bond >= 0.04, `closer ${r.bond}`);
      checkEqual(r.line, 1, "in its story");
      checkEqual(JSON.stringify(r.mult), JSON.stringify([0.8, 1.25, 1]), "the next storm");
      check(r.heard, "the foal heard the legend");
      check(r.foalFear > 0, `and fears thunder a little ${r.foalFear}`);
      check(/1 remembers getting through it together; 2 remember it as terrifying\. 1 more heard/.test(r.lines[1]), `lines ${r.lines}`);
      checkEqual(r.renamed, "The Big Boomies", "renamed");
    },
  },
  {
    name: "shared memories: a death many saw, a big fight, a birth watched, a first place; anniversaries a year on",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __mk(300);
        const b = __mk(400, "male");
        const c = __mk(500);
        const d = __mk(600);
        fluffyNames[d.id] = "Snowball";
        d.die(null, "Old age");
        const death = sharedMemoriesOf(a).find((m) => m.kind === "death");
        out.death = death && [death.name, death.who.length, death.good];
        // A big fight
        for (let i = 0; i < 6; i++) (i % 2 ? a : b).performAttack(i < 3 ? c : a, "GRUDGE");
        const fight = sharedMemoriesOf(c).find((m) => m.kind === "fight");
        out.fight = fight && fight.name;
        // A birth
        fluffyNames[a.id] = "Daisy";
        for (let i = 0; i < 3; i++) {
          const foal = __mk(320 + i * 10, "female", 0.1);
          foal.motherId = a.id;
          recordStory("born", [foal.id, a.id, b.id]);
        }
        const birth = sharedMemoriesOf(a).find((m) => m.kind === "birth");
        out.birth = birth && [birth.name, birth.who.length, birth.good];
        // First place
        fluffyNames[c.id] = "Pip";
        setRelationship(c.id, b.id, "friend");
        recordStory("show", c, { x: "first" });
        out.show = (sharedMemoriesOf(c).find((m) => m.kind === "show") || {}).name;
        // A year on: the death comes back
        const h0 = b.happiness;
        timePlayed += SM_YEAR * DAY_LENGTH;
        sharedMemoryTicker.fireNext();
        updateSharedMemories(1);
        out.anniv = death.lastAnniv === getDayNumber();
        out.sadder = uiMessages.some((m) => /A year ago today: The (day|night) Snowball died\./.test(m.text || m));
        out.grief = climateOf("INDOORS").label;
        return out;
      }, SETUP);
      check(r.death && /^The (day|night) Snowball died$/.test(r.death[0]) && r.death[1] === 3 && !r.death[2], `death ${r.death}`);
      checkEqual(r.fight, "The fight in the living room", "a big fight");
      check(r.birth && r.birth[0] === "When Daisy's three foals came" && r.birth[2], `birth ${r.birth}`);
      checkEqual(r.show, "Pip's blue ribbon", "a first place");
      check(r.anniv && r.sadder, "the anniversary is remembered");
      checkEqual(r.grief, "Grieving", "the room grieves again");
    },
  },
  {
    name: "parties: only with a reason; the room gathers, eats treats, warms; a happy shared memory; once per occasion; the book shows it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(300);
        const g = __mk(500, "male");
        fluffyNames[f.id] = "Clover";
        out.none = partyActions(f).length;
        recordStory("arrived", f, { x: "you" });
        const acts = partyActions(f);
        out.action = acts[0] && [acts[0].name, acts[0].sub];
        const m0 = money;
        const h0 = g.happiness;
        const m = throwParty(f);
        out.cost = m0 - money;
        out.joy = +(g.happiness - h0).toFixed(2);
        out.memory = m && [m.kind, m.name, m.good, m.who.length];
        out.warm = climateOf("INDOORS").label;
        out.again = partyActions(f).length;
        // The book
        openMemoriesBook();
        let err = null;
        try {
          drawMemoriesBook(ctx);
        } catch (e) {
          err = String(e);
        }
        out.err = err;
        out.open = anyScreenOpen();
        closeMemoriesBook();
        // A birthday a year after it was born here
        const kid = __mk(700, "female", 0.5);
        fluffyNames[kid.id] = "Bean";
        recordStory("born", [kid.id, f.id, g.id]);
        timePlayed += 2 * DAY_LENGTH;
        out.noBirthday = partyOccasion(kid);
        timePlayed += (SM_YEAR - 2) * DAY_LENGTH;
        out.birthday = (partyOccasion(kid) || {}).name;
        return out;
      }, SETUP);
      checkEqual(r.none, 0, "no reason, no party");
      check(r.action && r.action[0] === "Throw a party" && r.action[1] === "$14", `action ${r.action}`);
      checkEqual(r.cost, 14, "treats and hats");
      check(r.joy >= 0.08, `joy ${r.joy}`);
      check(r.memory && r.memory[0] === "party" && r.memory[1] === "Clover's welcome party" && r.memory[2] && r.memory[3] === 2, `memory ${r.memory}`);
      checkEqual(r.warm, "Warm", "the room warms");
      checkEqual(r.again, 0, "once per occasion");
      checkEqual(r.err, null, "the book draws");
      checkEqual(r.open, true, "the book is a screen");
      checkEqual(r.noBirthday, null, "not its birthday yet");
      checkEqual(r.birthday, "Bean's first birthday", "a birthday");
    },
  },
];
