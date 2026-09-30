// Gossip and family roles (Gossip.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(44);
  storyBook = freshStoryBook();
  _storyIndex = null;
  roomClimate = freshRoomClimate();
  _gossipPairs = null;
  timePlayed = 6 * DAY_LENGTH + 2 * HOUR_LENGTH;
  window.__mk = (x, gender = "female", growth = 1) => {
    const h = new Horse(growth, null, "INDOORS", "earthy", null, 0.5, 0.5, gender);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.happiness = 0.5;
    h.playerTrust = 0.5;
    h.playerFear = 0;
    h.playerMemories = [];
    h.brain.think = () => {};
    h.wishCooldownUntil = 1e12;
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "gossip: a fluffy that saw you hurt someone tells its friends; they fear you a little, less as it's passed on; capped; once an hour",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const w = __mk(300);
        fluffyNames[w.id] = "Poppy";
        const b = __mk(400, "male");
        const c = __mk(500);
        rememberPlayerEvent(w, "witness");
        out.tales = gossipTales(w);
        onFluffiesChatted(w, b);
        out.b = +b.playerFear.toFixed(4);
        out.bStory = storyOf(b).filter((e) => e.k === "gossip").map((e) => e.x);
        // Again within the hour: nothing
        onFluffiesChatted(w, b);
        out.again = +b.playerFear.toFixed(4);
        // b passes it on to c: weaker
        onFluffiesChatted(b, c);
        out.c = +c.playerFear.toFixed(4);
        // Lots of tellers: capped
        const d = __mk(600);
        for (let i = 0; i < 40; i++) {
          const t = __mk(700);
          rememberPlayerEvent(t, "stick");
          onFluffiesChatted(t, d);
        }
        out.capped = +d.playerFear.toFixed(3);
        out.heard = describeGossip(d);
        // One that saw it for itself isn't told
        const e = __mk(800);
        rememberPlayerEvent(e, "witness");
        const f0 = e.playerFear;
        onFluffiesChatted(w, e);
        out.sawIt = e.playerFear - f0;
        return out;
      }, SETUP);
      check(r.tales.harm >= 0.6 && r.tales.firstHand, `a first-hand tale ${JSON.stringify(r.tales)}`);
      check(r.b > 0.005 && r.b < 0.03, `the friend fears you a little ${r.b}`);
      check(r.bStory.some((s) => /Heard from Poppy that you hurt a fluffy\./.test(s)), `story ${r.bStory}`);
      checkEqual(r.again, r.b, "not again within the hour");
      check(r.c > 0 && r.c < r.b, `weaker second-hand ${r.c} < ${r.b}`);
      check(r.capped <= 0.15 + 1e-6 && r.capped >= 0.14, `capped ${r.capped}`);
      check(r.heard && /hurt fluffies/.test(r.heard[0]) && r.heard[1] === "bad", `shown ${r.heard}`);
      checkEqual(r.sawIt, 0, "first-hand matters most");
    },
  },
  {
    name: "gossip: a fluffy that loves you tells a newcomer you're kind - it settles faster; old hands aren't swayed",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const love = __mk(300);
        fluffyNames[love.id] = "Clover";
        love.playerTrust = 0.9;
        const nu = __mk(400, "male");
        nu.playerTrust = 0.2;
        nu.playerFear = 0.2;
        nu.settling = true;
        const old = __mk(500);
        onFluffiesChatted(love, nu);
        onFluffiesChatted(love, old);
        out.nuTrust = +(nu.playerTrust - 0.2).toFixed(3);
        out.nuFear = +(0.2 - nu.playerFear).toFixed(3);
        out.oldTrust = +(old.playerTrust - 0.5).toFixed(3);
        out.story = storyOf(nu).filter((e) => e.k === "gossip").map((e) => e.x);
        out.heard = describeGossip(nu);
        return out;
      }, SETUP);
      check(r.nuTrust > 0.01, `the newcomer trusts you more ${r.nuTrust}`);
      check(r.nuFear > 0, "and fears you less");
      checkEqual(r.oldTrust, 0, "an old hand isn't swayed");
      check(r.story.some((s) => /Clover told \{obj\} you were kind\./.test(s)), `story ${r.story}`);
      check(r.heard && r.heard[1] === "good", `shown ${r.heard}`);
    },
  },
  {
    name: "family roles: matriarch, big sister/brother, loner",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const gran = __mk(200);
        gran.age = 1e9;
        const mum = __mk(300);
        mum.motherId = gran.id;
        const kids = [];
        for (let i = 0; i < 3; i++) {
          const k = __mk(400 + i * 50, i ? "female" : "male", i ? 0.4 : 1);
          k.motherId = mum.id;
          kids.push(k);
        }
        const loner = __mk(900, "male");
        loner.traitShift = { social: -0.6 };
        relationships[loner.id] = {};
        return {
          gran: familyRoleOf(gran),
          big: familyRoleOf(kids[0]),
          small: familyRoleOf(kids[1]),
          loner: familyRoleOf(loner),
          row: describeFamilyRole(gran),
        };
      }, SETUP);
      checkEqual(r.gran, "Matriarch", "gran");
      checkEqual(r.big, "Big brother", "the grown son");
      checkEqual(r.small, null, "the little ones");
      checkEqual(r.loner, "Loner", "loner");
      check(/calm/.test(r.row[0]), `row ${r.row}`);
    },
  },
  {
    name: "sleeping piles: sleeping beside a friend or mum wakes it happier; a social one alone wakes a bit down",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const a = __mk(300);
        const b = __mk(360);
        setRelationship(a.id, b.id, "friend");
        setRelationship(b.id, a.id, "friend");
        const c = __mk(1000);
        c.traitShift = { social: 0.6 };
        relationships[c.id] = {};
        for (const f of [a, b, c]) f.initBehavior("SLEEPING");
        for (let i = 0; i < 10; i++) {
          sleepPileTicker.fireNext();
          updateSleepPiles(5);
        }
        const h = [a.happiness, c.happiness];
        for (const f of [a, b, c]) f.initBehavior("IDLE");
        sleepPileTicker.fireNext();
        updateSleepPiles(5);
        return { friend: +(a.happiness - h[0]).toFixed(3), alone: +(c.happiness - h[1]).toFixed(3), cleared: a._sleepCompany };
      }, SETUP);
      checkEqual(r.friend, 0.03, "woke happier beside a friend");
      checkEqual(r.alone, -0.02, "a social one alone wakes down");
      checkEqual(r.cleared, null, "the night is over");
    },
  },
];
