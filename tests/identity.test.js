// Identity (Identity.js): what fluffies call you and each other, turning
// points, pride in a name
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(51);
  storyBook = freshStoryBook();
  _storyIndex = null;
  keeperWord = "daddeh";
  timePlayed = 3 * DAY_LENGTH + 2 * HOUR_LENGTH;
  window.__mk = (x, gender = "female", growth = 1, type = "earthy") => {
    const h = new Horse(growth, null, "INDOORS", type, null, 0.5, 0.5, gender);
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
    name: "identity: your fluffies call you daddeh (or mummah), nice pewson or munstah by how you've treated them; strays say nice mistah",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(300);
        const line = "Pwease nice mistah! Mistah wub <speaker>? Mistah fence, wet go!";
        const say = () => applyKeeperName(line, f);
        const out = {};
        f.playerTrust = 0.9;
        f.playerFear = 0;
        out.loved = say();
        toggleKeeperWord();
        out.mummah = say();
        toggleKeeperWord();
        f.playerTrust = 0.4;
        out.unsure = say();
        f.playerFear = 0.7;
        f.playerTrust = 0.2;
        out.feared = say();
        f.adopted = false;
        out.stray = say();
        f.adopted = true;
        f.playerTrust = 0.9;
        f.playerFear = 0;
        out.upper = applyKeeperName("PWEEZE NICE MISTAH!!", f);
        // Through getDialogue
        DIALOGUE.__IDTEST = ["Hewwo nice mistah!"];
        out.dialogue = getDialogue(["__IDTEST"], f);
        delete DIALOGUE.__IDTEST;
        return out;
      }, SETUP);
      checkEqual(r.loved, "Pwease daddeh! Daddeh wub <speaker>? Mistah fence, wet go!", "loved");
      checkEqual(r.mummah, "Pwease mummah! Mummah wub <speaker>? Mistah fence, wet go!", "mummah");
      checkEqual(r.unsure, "Pwease nice pewson! Mistah wub <speaker>? Mistah fence, wet go!", "unsure");
      checkEqual(r.feared, "Pwease munstah! Munstah wub <speaker>? Mistah fence, wet go!", "feared");
      checkEqual(r.stray, "Pwease nice mistah! Mistah wub <speaker>? Mistah fence, wet go!", "a stray");
      checkEqual(r.upper, "PWEEZE DADDEH!!", "shouted");
      checkEqual(r.dialogue, "Hewwo daddeh!", "in getDialogue");
    },
  },
  {
    name: "identity: fluffies use each other's names; unnamed ones get a description - fwen if liked, poopie or munstah from those who look down on them",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const coat = (h, rgb) => {
          for (let c = 0; c < 3; c++) {
            const n = Math.round(rgb[c] / 31.875);
            for (let i = 0; i < 8; i++) h.genes[c * 8 + i] = i < n ? 1 : 0;
          }
          h.processGenes();
        };
        const a = __mk(300);
        const peg = __mk(400, "male", 1, "pegasus");
        coat(peg, [0, 127, 255]);
        const out = {};
        fluffyNames[peg.id] = "Sky";
        DIALOGUE.__IDTEST = ["Hi <target>!"];
        out.named = getDialogue(["__IDTEST"], a, peg);
        delete fluffyNames[peg.id];
        out.neutral = fluffyCallsOther(a, peg);
        setRelationship(a.id, peg.id, "friend");
        out.liked = fluffyCallsOther(a, peg);
        out.inLine = getDialogue(["__IDTEST"], a, peg);
        setRelationship(a.id, peg.id, null);
        if (!a.opinions) a.opinions = {};
        a.opinions[peg.id] = -0.8;
        out.disliked = fluffyCallsOther(a, peg);
        // Poopie: colourists say so; accepting ones don't
        const mud = __mk(500);
        coat(mud, [127, 63, 31]);
        a.coloristDegree = 0.9;
        out.poopie = fluffyCallsOther(a, mud);
        a.coloristDegree = 0;
        out.accepting = fluffyCallsOther(a, mud);
        // A feared alicorn
        const ali = __mk(600, "female", 1, "alicorn");
        worldSettings.alicornIntolerance = true;
        a.alicornComfort = 0;
        const tolerant = a.tolerantOfAlicorns();
        out.alicorn = tolerant ? "munstah" : fluffyCallsOther(a, ali);
        // A foal
        const foal = __mk(700, "female", 0.4);
        coat(foal, [255, 95, 191]);
        foal.hasSpots = foal.hasStripes = false;
        out.foal = fluffyCallsOther(a, foal);
        delete DIALOGUE.__IDTEST;
        return out;
      }, SETUP);
      check(/Hi SKY!/i.test(r.named), `its name: ${r.named}`);
      checkEqual(r.neutral, "wingy fwuffy", "a stranger");
      checkEqual(r.liked, "wingy-fwen", "one it likes");
      check(/wingy-fwen/i.test(r.inLine), `in a line: ${r.inLine}`);
      checkEqual(r.disliked, "dat wingy one", "one it dislikes");
      checkEqual(r.poopie, "poopie fwuffy", "a colourist on a brown coat");
      check(r.accepting !== "poopie fwuffy", `accepting: ${r.accepting}`);
      checkEqual(r.alicorn, "munstah", "a feared alicorn");
      checkEqual(r.foal, "widdwe fwuffy", "a foal");
    },
  },
  {
    name: "identity: turning points - first steps and words, walking up to you, a name - go in the story, with rare messages",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const msgs = [];
        const realMsg = window.addUIMessage;
        window.addUIMessage = (t) => msgs.push(t);
        const pip = __mk(300, "male", 0.01);
        fluffyNames[pip.id] = "Pip";
        pip.playerTrust = 0.3;
        checkMilestones(pip); // first look: nothing new
        const before = msgs.length;
        pip.growth = Math.min(CHIRPY_THRESHOLD, WALKY_THRESHOLD) + 0.01;
        checkMilestones(pip);
        timePlayed += 2 * HOUR_LENGTH;
        pip.growth = Math.max(CHIRPY_THRESHOLD, WALKY_THRESHOLD) + 0.02;
        checkMilestones(pip);
        timePlayed += 2 * HOUR_LENGTH;
        pip.playerTrust = 0.7;
        checkMilestones(pip);
        // Again straight away: no second message for a while
        pip.growth = 1;
        checkMilestones(pip);
        const story = storyOf(pip).filter((e) => e.k === "turning").map((e) => e.x);
        // Kindness to a named fluffy: a little happier, once an hour
        pip.happiness = 0.5;
        giveAffection(pip, "brushed");
        const h1 = pip.happiness;
        giveAffection(pip, "held_happy");
        const h2 = pip.happiness;
        window.addUIMessage = realMsg;
        return { before, msgs, story, h1, h2 };
      }, SETUP);
      checkEqual(r.before, 0, "the first look isn't news");
      check(r.story.some((s) => /Pip took his first wobbly steps/.test(s)), `steps ${r.story}`);
      check(r.story.some((s) => /Pip said his first words/.test(s)), `words ${r.story}`);
      check(r.story.some((s) => /walked up to you on his own/.test(s)), `trust ${r.story}`);
      check(r.story.some((s) => /all grown up/.test(s)), `grown ${r.story}`);
      check(r.msgs.filter((m) => m.startsWith("✦")).length === 3, `three messages, the fourth held back: ${r.msgs}`);
      check(r.h1 >= 0.5 + 0.02 - 0.001, `called by name ${r.h1}`);
    },
  },
];
