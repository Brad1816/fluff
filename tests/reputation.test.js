// Notes from new owners and your two reputations (Reputation.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(111);
  storyBook = freshStoryBook();
  _storyIndex = null;
  keeperRep = freshKeeperRep();
  darkMarket = freshDarkMarket();
  timePlayed = 3 * DAY_LENGTH;
  window.__mk = (x, gender = "female") => {
    const h = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, gender);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.happiness = 0.7;
    h.playerTrust = 0.8;
    h.playerFear = 0;
    h.brain.think = () => {};
    h.wishCooldownUntil = 1e12;
    h.traitShift = { temper: -0.5 };
    fluffies.push(h);
    return h;
  };
  window.__sell = (f, buyer) => {
    _saleBuyer = buyer;
    noteFluffyLeft(f, "sold", 100);
    fluffies.splice(fluffies.indexOf(f), 1);
  };
  window.__days = (n) => { for (let i = 0; i < n; i++) { timePlayed += DAY_LENGTH; reputationTicker.fireNext(); updateReputation(10); } };
}`;

module.exports = [
  {
    name: "reputation: new owners write - praise for a loved, clever fluffy, complaints for a scared or biting one; families hear of it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const realRandom = Math.random;
        Math.random = () => 0.01; // (they always write)
        const good = __mk(300, "male");
        fluffyNames[good.id] = "Pip";
        good.tricks = { fetch: 0.9 };
        __sell(good, "family");
        const bad = __mk(400);
        fluffyNames[bad.id] = "Ivy";
        bad.playerFear = 0.7;
        bad.playerTrust = 0.1;
        bad.happiness = 0.2;
        bad.traitShift = { temper: 0.8 };
        __sell(bad, "family");
        Math.random = realRandom;
        out.pending = keeperRep.pending.length;
        __days(4);
        out.notes = keeperRep.notes.map((n) => [n.good, n.text, n.from]);
        out.family = keeperRep.family;
        out.story = storyOf(good.id).filter((e) => e.k === "after").map((e) => e.x);
        out.rep = describeReputations();
        return out;
      }, SETUP);
      checkEqual(r.pending, 2, "two notes on the way");
      checkEqual(r.notes.length, 2, "both arrived");
      const pip = r.notes.find((n) => /Pip/.test(n[1]));
      const ivy = r.notes.find((n) => /Ivy/.test(n[1]));
      check(pip && pip[0] && /fetch|gentle|settled|friends/.test(pip[1]) && pip[2] === "Pip's new owners", `praise ${pip}`);
      check(ivy && !ivy[0] && /bit|hides/.test(ivy[1]), `complaint ${ivy}`);
      check(r.family <= 0, `families heard both ${r.family}`);
      check(r.story.length === 1, `in its story ${r.story}`);
      check(r.rep.family && r.rep.dark === "Unknown", `shown ${JSON.stringify(r.rep)}`);
    },
  },
  {
    name: "reputation: a good name brings more families; a dark name brings the dealer back sooner and puts families off",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const share = (id) => {
          let n = 0;
          for (let i = 0; i < 2000; i++) if (pickBuyerKind(1).id === id) n++;
          return n / 2000;
        };
        out.fam0 = share("family");
        keeperRep.family = 30;
        out.fam1 = share("family");
        // Selling to the dealer
        const b = __mk(300);
        b.title = "Broken";
        __sell(b, "shady");
        out.dark = keeperRep.dark;
        keeperRep.dark = 12;
        out.fam2 = share("family");
        darkMarket.lastDay = getDayNumber() - 1;
        out.dueSoon = darkMarketDue();
        out.words = describeReputations();
        return out;
      }, SETUP);
      check(r.fam1 > r.fam0 * 1.15, `more families ${r.fam0} -> ${r.fam1}`);
      checkEqual(r.dark, 4, "the dealer remembers");
      check(r.fam2 < r.fam1, `a dark name puts them off ${r.fam2}`);
      check(r.dueSoon, "he comes back sooner");
      check(r.words.family === "Excellent" && r.words.dark === "Trusted", `words ${JSON.stringify(r.words)}`);
    },
  },
];
