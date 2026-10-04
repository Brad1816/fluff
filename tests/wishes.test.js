// Wishes (Wishes.js) and dreams (Dreams.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(71);
  storyBook = freshStoryBook();
  _storyIndex = null;
  goalsState = freshGoalsState();
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH;
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
    h.brain.think = () => {};
    h.wishCooldownUntil = 1e12; // no wishes of their own during the test
    fluffies.push(h);
    return h;
  };
  window.__wish = (f, id, extra = {}) => {
    f.wish = { id, since: timePlayed, ache: 0, ...extra };
    if (WISHES[id].start && extra.target === undefined) WISHES[id].start(f, f.wish);
    return f.wish;
  };
}`;

module.exports = [
  {
    name: "wishes: a wish comes true - a happy story line, a turning point, joy and contentment; a goal counts it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(300, "female", 0.6);
        fluffyNames[f.id] = "Poppy";
        __wish(f, "toy");
        const out = { text: wishText(f), row: describeWish(f) };
        const h0 = f.happiness;
        giveAffection(f, "toy");
        out.joy = f.happiness - h0;
        out.wish = f.wish;
        out.content = describeWish(f);
        out.story = storyOf(f).filter((e) => e.k === "wish_granted").map((e) => e.x);
        out.goal = goalsState.stats.wishes;
        out.settle = wishHappinessTarget(f);
        // A trick it wished to learn
        __wish(f, "trick");
        _trLearn(f, "sit", 1);
        updateWish(f, 2);
        out.trick = f.wish === null && storyOf(f).some((e) => e.k === "wish_granted" && /learnt a trick/.test(e.x));
        return out;
      }, SETUP);
      checkEqual(r.text, "A toy of its own", "the wish");
      checkEqual(r.row[1], "ok", "shown, not yet aching");
      check(r.joy >= 0.19, `joy ${r.joy}`);
      checkEqual(r.wish, null, "wish done");
      checkEqual(r.content[1], "good", "content for a while");
      check(r.story.length === 1 && /Her wish came true: a toy of her own\./.test(r.story[0]), `story ${r.story}`);
      checkEqual(r.goal, 1, "counted for the goals");
      checkEqual(r.settle, 0.1, "its happiness settles higher while content");
      check(r.trick, "a trick wish comes true when it learns one");
    },
  },
  {
    name: "wishes: ignored, it aches and then gives up; denied (you sell the one it wanted, take its hat) it's remembered as harsh",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(300);
        fluffyNames[f.id] = "Ivy";
        __wish(f, "park");
        f.wish.since -= (WISH_PATIENCE_DAYS + 0.5) * DAY_LENGTH;
        f.happiness = 0.6;
        for (let i = 0; i < 30; i++) updateWish(f, HOUR_LENGTH / 5);
        out.ached = +(0.6 - f.happiness).toFixed(3);
        out.aching = describeWish(f);
        f.wish.since -= WISH_GIVE_UP_DAYS * DAY_LENGTH;
        updateWish(f, 2);
        out.gaveUp = storyOf(f).filter((e) => e.k === "wish_denied").map((e) => e.x);
        // Denied: you sell the one it wished was its special friend
        const g = __mk(400, "male");
        fluffyNames[g.id] = "Rowan";
        __wish(f, "specialFriend", { target: g.id });
        const t0 = f.playerTrust;
        noteFluffyLeft(g, "sold");
        fluffies.splice(fluffies.indexOf(g), 1);
        out.denied = storyOf(f).filter((e) => e.k === "wish_denied").map((e) => e.x);
        out.trustLost = +(t0 - f.playerTrust).toFixed(2);
        out.memory = (f.playerMemories || []).map((m) => m.type);
        // A hat: given, then taken straight back
        const h = __mk(500);
        f.wishCooldownUntil = 0;
        __wish(h, "hat", { target: f.id });
        h.accessories = h.accessories || {};
        h.accessories.head = { id: "fez" };
        updateWish(h, 2);
        out.hatGranted = h.wish === null;
        delete h.accessories.head;
        noteWishEvent(h, "hatOff");
        out.hat = storyOf(h).filter((e) => e.k === "wish_denied").map((e) => e.x);
        return out;
      }, SETUP);
      check(r.ached > 0.04 && r.ached <= 0.07, `aching over 6 game hours: ${r.ached}`);
      check(/aching/.test(r.aching[0]) && r.aching[1] === "bad", `shown as aching ${r.aching}`);
      check(r.gaveUp.some((s) => /She gave up wishing for see the park|She gave up wishing for/.test(s)), `gave up ${r.gaveUp}`);
      check(r.denied.some((s) => /You sold Rowan, the special friend she wished for\./.test(s)), `denied ${r.denied}`);
      check(r.trustLost >= 0.09, `trust lost ${r.trustLost}`);
      check(r.memory.includes("wish_denied"), `remembered ${r.memory}`);
      check(r.hatGranted, "the hat granted the wish");
      check(r.hat.some((s) => /You took away the hat she had wished for\./.test(s)), `hat ${r.hat}`);
    },
  },
  {
    name: "wishes: promising a wish makes it try harder - break the promise and it's remembered; the right-click menu offers it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(300, "male");
        fluffyNames[f.id] = "Pip";
        __wish(f, "park");
        const before = trickChance(f, "sit");
        trickUI = { phase: "menu", id: f.id, section: "care" };
        changeScene("INDOORS");
        const L = getTrickMenuLayout();
        const chip = L && L.chips.find((c) => c.action && c.action.key === "promise");
        trickUI = null;
        promiseWish(f);
        const after = trickChance(f, "sit");
        const t0 = f.playerTrust;
        timePlayed += (WISH_PROMISE_DAYS + 0.1) * DAY_LENGTH;
        updateWish(f, 2);
        return {
          chip: !!chip,
          boost: +(after / before).toFixed(2),
          broken: f.wish && f.wish.broken,
          trust: +(t0 - f.playerTrust).toFixed(2),
          memory: (f.playerMemories || []).map((m) => m.type),
          story: storyOf(f).filter((e) => e.k === "wish_denied" || e.k === "turning").map((e) => e.x),
        };
      }, SETUP);
      check(r.chip, "Promise wish is in the right-click menu");
      check(Math.abs(r.boost - 1.3) < 0.02 || r.boost > 1.2, `tries harder ${r.boost}`);
      check(r.broken, "promise broken");
      check(r.trust >= 0.11, `trusts you less ${r.trust}`);
      check(r.memory.includes("broken_promise"), `remembered ${r.memory}`);
      check(r.story.some((s) => /You promised him to see the park if he was good\./.test(s)), `promise ${r.story}`);
      check(r.story.some((s) => /You promised him to see the park, and it never came\./.test(s)), `broken ${r.story}`);
    },
  },
  {
    name: "dreams: sleeping fluffies dream their story - good dreams heal a little, nightmares can wake them frightened (with limits)",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(300);
        fluffyNames[f.id] = "Wren";
        for (let i = 0; i < 6; i++) giveAffection(f, "played");
        for (let i = 0; i < 3; i++) {
          timePlayed += 100;
          rememberPlayerEvent(f, "stick");
        }
        const mat = dreamMaterial(f);
        const out = { good: mat.filter((d) => d.good).length, bad: mat.filter((d) => !d.good).length };
        // Good dreams: a little happier, worst fear eases, capped per day
        f.fears = { thunder: 0.6, dark: 0, bot: 0 };
        f.happiness = 0.5;
        for (let i = 0; i < 20; i++) goodDream(f);
        out.healed = [+(f.happiness - 0.5).toFixed(2), f.fears.thunder];
        // Nightmares: wake frightened, at most 2 a day, rested between
        f.currentStateKey = "SLEEPING";
        wakeFromNightmare(f);
        out.fright = f.fright && f.fright.key;
        out.frightText = describeFright(f);
        out.comforted = onComfortedByYou(f, "held");
        let woke = 0;
        const realRandom = Math.random;
        Math.random = () => 0;
        // (same day: only the daily limit, not the rest between them)
        for (let i = 0; i < 10; i++) {
          f.fright = null;
          f._lastNightmareAt = undefined;
          badDream(f);
          if (f._lastNightmareAt !== undefined) woke++;
        }
        Math.random = realRandom;
        out.woke = woke;
        out.tally = storyOf(f).filter((e) => e.k === "tally").reduce((a, e) => a + (e.c.nightmare || 0), 0);
        // The bubble draws
        f.currentDream = { story: true, good: false, icon: null, text: "Nu owwies!" };
        let err = null;
        try {
          drawStoryDream(ctx, f);
          f.currentDream = { story: true, good: true, icon: "ball", text: "Pway baww..." };
          drawStoryDream(ctx, f);
        } catch (e) {
          err = String(e);
        }
        out.err = err;
        return out;
      }, SETUP);
      check(r.good >= 1 && r.bad >= 1, `its story gives it both: ${r.good} good, ${r.bad} bad`);
      checkEqual(r.healed[0], 0.1, "good dreams heal at most 0.1 a day");
      check(r.healed[1] < 0.6, `worst fear eases ${r.healed[1]}`);
      checkEqual(r.fright, "nightmare", "woke frightened");
      check(r.frightText && /bad dream/.test(r.frightText[0]), `shown ${r.frightText}`);
      check(r.comforted, "a cuddle comforts it");
      checkEqual(r.woke, 2, "no more than 2 nightmares a day");
      check(r.tally >= 1, "nightmares go in its story");
      checkEqual(r.err, null, "dream bubbles draw");
    },
  },
];
