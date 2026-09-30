// Titles and breaking points (Titles.js), and the shady dealer (Buyers.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(99);
  storyBook = freshStoryBook();
  _storyIndex = null;
  roomClimate = freshRoomClimate();
  trainingStyle = "kind";
  darkMarket = freshDarkMarket();
  timePlayed = 2 * DAY_LENGTH;
  window.__mk = (x, gender = "female", traits = {}) => {
    const h = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, gender);
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
    h.traitShift = { bravery: 0, temper: 0, ...traits };
    fluffies.push(h);
    return h;
  };
  window.__day = (n = 1) => { for (let i = 0; i < n; i++) { timePlayed += DAY_LENGTH; titlesTicker.fireNext(); updateTitles(5); } };
  window.__hit = (f, n) => { for (let i = 0; i < n; i++) { timePlayed += 70; notifyViolence(f, false, "stick", false); } };
}`;

module.exports = [
  {
    name: "titles: breaking point - hurt past its limit it breaks: numb, obeys, calls you owna, dies sooner; long patient care heals it into a Survivor",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(300, "female", { bravery: -0.4, temper: -0.2 });
        while (_strongWilled(f)) f.traitShift.temper -= 0.3;
        fluffyNames[f.id] = "Wren";
        out.limit = breakLimitOf(f);
        __hit(f, Math.ceil(out.limit) + 1);
        titlesTicker.fireNext();
        updateTitles(5);
        out.title = titleOf(f);
        f.happiness = 0.9;
        titlesTicker.fireNext();
        updateTitles(5);
        out.numb = f.happiness;
        f.happiness = 0;
        titlesTicker.fireNext();
        updateTitles(5);
        out.floor = f.happiness;
        out.name = keeperNameFor(f);
        out.obeys = obeysFromFear(f);
        f.age = 60 * DAY_LENGTH;
        out.risk = [oldAgeDailyRisk(f) > 0];
        f.title = null;
        out.risk.push(oldAgeDailyRisk(f));
        f.title = "Broken";
        out.story = storyOf(f).some((e) => e.k === "turning" && /Wren broke/.test(e.x));
        out.progress0 = describeTitleProgress(f);
        // Healing: sit with it, praise, days without harm
        for (let d = 0; d < 12 && titleOf(f) === "Broken"; d++) {
          f.happiness = 0.2;
          f._sitWithAt = undefined;
          sitWith(f);
          for (let i = 0; i < SIT_WITH_TIME + 1; i++) { careTicker.fireNext(); updateCare(1); timePlayed += 1; }
          praiseFluffy(f);
          __day();
        }
        out.healed = [titleOf(f), f.strain < out.limit * 0.35];
        out.healedStory = storyOf(f).some((e) => e.k === "turning" && /Broken no more/.test(e.x));
        return out;
      }, SETUP);
      check(r.limit >= 5 && r.limit <= 12, `its own limit ${r.limit}`);
      checkEqual(r.title, "Broken", "broke");
      checkEqual(r.numb, 0.35, "no joy");
      checkEqual(r.floor, 0.12, "but never gives up");
      checkEqual(r.name, "owna", "owna");
      check(r.obeys, "obeys anything");
      check(r.risk[0] && r.risk[1] === 0, `dies sooner ${r.risk}`);
      check(r.story, "a turning point");
      check(/Healing: Broken → Survivor/.test(r.progress0), `progress ${r.progress0}`);
      checkEqual(r.healed[0], "Survivor", "long care heals it");
      check(r.healed[1] && r.healedStory, "strain eased, story told");
    },
  },
  {
    name: "titles: a strong-willed one rebels instead - refuses you, stirs others up; won round it becomes a Guardian",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(300, "male", { bravery: 0.5, temper: 0.4 });
        while (!_strongWilled(f)) f.traitShift.temper += 0.3;
        __hit(f, Math.ceil(breakLimitOf(f) * REBEL_AT) + 1);
        out.title = titleOf(f);
        out.trick = trickRefusal(f, "sit");
        out.lesson = lessonRefusal(f);
        // Stirs up a friend
        const g = __mk(400);
        g.playerTrust = 0.6;
        setRelationship(f.id, g.id, "friend");
        onFluffiesChatted(f, g);
        out.stirred = +(0.6 - g.playerTrust).toFixed(3);
        // Won round
        __day(2);
        for (let i = 0; i < REBEL_RESPECT; i++) praiseFluffy(f) || giveAffection(f, "brushed");
        __day(1);
        for (let i = 0; i < REBEL_RESPECT; i++) giveAffection(f, "brushed");
        __day(1);
        out.won = titleOf(f);
        return out;
      }, SETUP);
      checkEqual(r.title, "Rebel", "rebelled");
      checkEqual(r.trick, "rebel", "won't do tricks");
      checkEqual(r.lesson, "rebel", "won't take lessons");
      check(r.stirred > 0, `stirs others up ${r.stirred}`);
      checkEqual(r.won, "Guardian", "won round");
    },
  },
  {
    name: "titles: Cherished (loved for days) - hurt out of the blue it's Wary; Spoiled with treats; a Guardian from defending; Survivor",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(300);
        f.playerTrust = 0.9;
        __day(CHERISH_DAYS + 1);
        out.cherished = titleOf(f);
        out.price = titlePriceMultiplier(f);
        out.fright = titleFrightMultiplier(f);
        __hit(f, 1);
        out.wary = titleOf(f);
        __day(WARY_DAYS + 1);
        out.back = titleOf(f);
        // Spoiled
        const s = __mk(500);
        for (let d = 0; d < 3; d++) {
          for (let i = 0; i < 5; i++) recordStory("treat", s);
          __day(1);
        }
        out.spoiled = titleOf(s);
        // Guardian
        const g = __mk(700);
        for (let i = 0; i < GUARDIAN_DEFENDS; i++) noteTitleDefend(g);
        out.guardian = titleOf(g);
        // Survivor: hurt badly, then trusts you again
        const v = __mk(900, "female", { bravery: 0.2, temper: -0.5 });
        while (_strongWilled(v)) v.traitShift.temper -= 0.3;
        __hit(v, Math.ceil(breakLimitOf(v) * 0.6));
        out.notYet = titleOf(v);
        v.playerTrust = 0.6;
        __day(8);
        out.survivor = titleOf(v);
        return out;
      }, SETUP);
      checkEqual(r.cherished, "Cherished", "loved for days");
      check(r.price > 1 && r.fright < 1, "worth more, braver");
      checkEqual(r.wary, "Wary", "hurt out of the blue");
      checkEqual(r.back, "Cherished", "itself again");
      checkEqual(r.spoiled, "Spoiled", "all treats, no lessons");
      checkEqual(r.guardian, "Guardian", "stood up for others");
      checkEqual(r.notYet, null, "not broken");
      checkEqual(r.survivor, "Survivor", "a Survivor");
    },
  },
  {
    name: "shady dealer: rare; pays for Broken, drilled, stick-conditioned ones and little for happy ones; ignores looks and scars",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const kind = getBuyerKind("shady");
        const happy = __mk(300);
        happy.happiness = 0.9;
        const broken = __mk(400);
        broken.title = "Broken";
        broken.happiness = 0.3;
        broken.playerFear = 0.7;
        broken.tricks = { sit: 0.9, down: 0.8 };
        broken.trickFear = { sit: 0.8, down: 0.7 };
        broken.conditioned = { stick: 12 };
        out.values = [darkValue(happy), +darkValue(broken).toFixed(2)];
        const o1 = buyerOffer(kind, happy, 1, () => 0.5).offer;
        const o2 = buyerOffer(kind, broken, 1, () => 0.5).offer;
        for (const k of ["ear", "flank", "bald"]) addScar(broken, k, "x");
        const o3 = buyerOffer(kind, broken, 1, () => 0.5).offer;
        out.offers = [o1, o2, o3];
        // Rare: when due, then not for a while
        out.due = darkMarketDue();
        let n = 0;
        for (let i = 0; i < 1000; i++) if (pickBuyerKind(1).id === "shady") n++;
        out.share = n / 1000;
        makeSellRequest([broken], () => 0.999);
        const req = currentSellRequest;
        darkMarket.lastDay = getDayNumber();
        out.after = [darkMarketDue(), pickBuyerKind(1, () => 0.999).id];
        out.family = [buyerLikes(getBuyerKind("family"), broken) < buyerLikes(getBuyerKind("family"), happy)];
        return out;
      }, SETUP);
      check(r.values[0] === 0 && r.values[1] >= 0.9, `values ${r.values}`);
      check(r.offers[1] >= 250 && r.offers[0] <= 60, `offers ${r.offers}`);
      checkEqual(r.offers[2], r.offers[1], "scars don't matter to him");
      check(r.due && r.share > 0.01 && r.share < 0.08, `rare ${r.share}`);
      check(!r.after[0] && r.after[1] !== "shady", `not back straight away ${r.after}`);
      check(r.family[0], "families don't want a Broken one");
    },
  },
];
