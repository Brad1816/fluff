// Strict (fear-based) training (FearTraining.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(88);
  storyBook = freshStoryBook();
  _storyIndex = null;
  roomClimate = freshRoomClimate();
  trainingStyle = "kind";
  trickUI = null;
  timePlayed = 2 * DAY_LENGTH;
  window.__mk = (x, gender = "female") => {
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
    h.traitShift = { energy: 0 };
    fluffies.push(h);
    return h;
  };
  // Train "sit" for n sessions (days), each: ask up to 10 times, reward or punish every try
  window.__train = (f, style, maxDays = 40) => {
    trainingStyle = style;
    while (_strongWilled(f)) f.traitShift.temper = (f.traitShift.temper || 0) - 0.3;
    for (let day = 1; day <= maxDays; day++) {
      timePlayed += DAY_LENGTH;
      titlesTicker.fireNext();
      updateTitles(5);
      for (let i = 0; i < TRICK_TRIES_PER_DAY; i++) {
        f.trickNow = null;
        const res = tryTrick(f, "sit");
        if (res === "done") {
          if (style === "strict") fearNod(f, "sit");
          else rewardTrick(f, "treat", "sit");
        } else if (res === "failed" && style === "strict") fearPunish(f, "sit", i % 2 ? "smack" : "scold");
        if (trickSkill(f, "sit") >= TRICK_KNOWN) return day * 10 + i;
      }
    }
    return 999;
  };
}`;

module.exports = [
  {
    name: "strict training: a complete path - it learns (about 1.5x the sessions), it sticks, done instantly and joylessly; it costs trust, happiness and calm",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        money = 100000;
        const out = {};
        // average over a few fluffies
        let kind = 0;
        let strict = 0;
        const N = 6;
        for (let i = 0; i < N; i++) {
          const a = __mk(200 + i * 10);
          kind += __train(a, "kind");
          const b = __mk(600 + i * 10);
          strict += __train(b, "strict");
          if (i === 0) {
            out.a = [a.playerTrust, a.happiness];
            out.b = [+b.playerTrust.toFixed(2), +b.happiness.toFixed(2), +b.playerFear.toFixed(2), fearShare(b, "sit")];
            window.__b = b;
            window.__a = a;
          }
        }
        out.ratio = +(strict / kind).toFixed(2);
        out.raw = [kind / N, strict / N];
        // Performance, in kind mode later: never refuses, reliable, joyless
        trainingStyle = "kind";
        const b = __b;
        b.playerFear = 0.6;
        out.refusal = trickRefusal(b, "sit");
        out.chance = +trickChance(b, "sit").toFixed(2);
        b.trickNow = null;
        let res = tryTrick(b, "sit");
        for (let i = 0; i < 4 && res !== "done"; i++) {
          b.trickNow = null;
          res = tryTrick(b, "sit");
        }
        out.joyless = [res, b.expressionOverride];
        out.show = [trickShowScore(__a), trickShowScore(b)];
        out.drilled = describeFearTraining(b);
        out.tally = storyOf(b).filter((e) => e.k === "tally").reduce((s, e) => s + (e.c.drilled || 0), 0);
        out.room = climateOf("INDOORS").label;
        return out;
      }, SETUP);
      check(r.ratio >= 1.2 && r.ratio <= 2.2, `strict takes about 1.5x the sessions: ${r.ratio} ${r.raw}`);
      check(r.b[0] < r.a[0] && r.b[2] > 0, `it costs trust and adds fear: ${r.b} vs ${r.a}`);
      check(r.b[3] >= 0.5, `learnt mostly through fear ${r.b[3]}`);
      checkEqual(r.refusal, null, "never refuses, even scared");
      check(r.chance >= 0.8, `reliable ${r.chance}`);
      check(r.joyless[0] === "done" && r.joyless[1] === "MISERABLE", `joyless ${r.joyless}`);
      check(r.show[1] < r.show[0], `the judges mark it down ${r.show}`);
      check(r.drilled && /Sit/.test(r.drilled[0]), `shown ${r.drilled}`);
      check(r.tally > 0, "in its story");
      check(r.room === "Tense" || r.room === "Fearful" || r.room === "Uneasy", `the room feels it: ${r.room}`);
    },
  },
  {
    name: "strict training: the style switch and punish chips in the menu; strict lessons work through fear but views soften by half",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(400);
        changeScene("INDOORS");
        trickUI = { phase: "menu", id: f.id };
        const L = getTrickMenuLayout();
        const style = L.chips.find((c) => c.key === "style");
        mouse.x = style.x + 5;
        mouse.y = style.y + 5;
        handleTrickClick();
        out.style = trainingStyle;
        // A wrong try: punish chips
        f.tricks = { sit: 0 };
        Math.random = (() => { const r = Math.random; return () => 0.99; })();
        _trAsk(f, "sit");
        out.phase = trickUI && trickUI.phase;
        const P = getTrickMenuLayout();
        out.chips = P.chips.map((c) => c.key);
        let err = null;
        try { drawTrickUI(ctx); } catch (e) { err = String(e); }
        out.err = err;
        const smack = P.chips.find((c) => c.key === "smack");
        mouse.x = smack.x + 5;
        mouse.y = smack.y + 5;
        handleTrickClick();
        out.after = [trickSkill(f, "sit") > 0, trickUI, (f.playerMemories || []).map((m) => m.type)];
        __seedRandom(5);
        // Strict lesson: a scared colourist listens, but half as much
        worldSettings.colorism = true;
        const g = __mk(700);
        g.coloristDegree = 0.8;
        g.playerFear = 0.6;
        g.playerTrust = 0.1;
        let n = 0;
        for (let i = 0; i < 3; i++) if (giveLesson(g, "colours") === "learnt") n++;
        out.lesson = [n, +g.coloristDegree.toFixed(2)];
        return out;
      }, SETUP);
      checkEqual(r.style, "strict", "switched to strict");
      checkEqual(r.phase, "punish", "a wrong try can be punished");
      checkEqual(r.chips.join(), "scold,smack", "scold or smack");
      checkEqual(r.err, null, "draws");
      check(r.after[0] && r.after[1] === null && r.after[2].includes("training"), `punished ${JSON.stringify(r.after)}`);
      check(r.lesson[0] >= 1, `a scared one listens ${r.lesson}`);
      checkEqual(r.lesson[1], +(0.8 - r.lesson[0] * 0.04).toFixed(2), "views soften by half");
    },
  },
];
