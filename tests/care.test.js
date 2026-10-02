// Care actions and conditioning (Care.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(77);
  storyBook = freshStoryBook();
  _storyIndex = null;
  roomClimate = freshRoomClimate();
  timePlayed = 3 * DAY_LENGTH + ((19 - START_HOUR + 24) % 24) * HOUR_LENGTH;
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
    h.wishCooldownUntil = 1e12;
    fluffies.push(h);
    return h;
  };
  window.__tick = (s) => { for (let i = 0; i < s; i++) { careTicker.fireNext(); updateCare(1); timePlayed += 1; } };
}`;

module.exports = [
  {
    name: "care: Sit with a sad or grieving fluffy - it sits by you, cheers up, grief eases, trusts you more; only when it needs it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(300);
        out.none = careActions(f).map((a) => a.key);
        f.happiness = 0.2;
        f.separation = { grief: 0.5, ids: [], names: [], bond: 0.5 };
        const acts = careActions(f);
        out.offer = acts.find((a) => a.key === "sitwith");
        const t0 = f.playerTrust;
        out.sat = sitWith(f);
        out.desire = new CareDesire().evaluate(f);
        __tick(SIT_WITH_TIME + 1);
        out.joy = +(f.happiness - 0.2).toFixed(2);
        out.grief = +f.separation.grief.toFixed(2);
        out.trust = +(f.playerTrust - t0).toFixed(3);
        out.done = f.sitWith;
        out.again = careActions(f).some((a) => a.key === "sitwith");
        return { ...out, offer: out.offer && [out.offer.name, out.offer.sub] };
      }, SETUP);
      check(!r.none.includes("sitwith"), `not offered to a content one ${r.none}`);
      check(r.offer && r.offer[0] === "Sit with" && r.offer[1] === "grieving", `offered ${r.offer}`);
      check(r.sat && r.desire > 0, "it stays by you");
      check(r.joy >= 0.1, `cheers up ${r.joy}`);
      checkEqual(r.grief, 0.2, "grief eases");
      check(r.trust >= 0.04, `trust ${r.trust}`);
      checkEqual(r.done, null, "then it's over");
      checkEqual(r.again, false, "not again straight away");
    },
  },
  {
    name: "care: Praise is quick free affection, 3 a day; Scold stops a fight and teaches, but costs; Time-out puts it in a corner",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(300);
        const t0 = f.playerTrust;
        let n = 0;
        for (let i = 0; i < 5; i++) if (praiseFluffy(f)) n++;
        out.praised = [n, +(f.playerTrust - t0).toFixed(3), careActions(f).some((a) => a.key === "praise")];
        // A fight
        const a = __mk(500, "male");
        const b = __mk(560);
        a.performAttack(b, "GRUDGE");
        a.chaseTarget = b;
        a.chaseReason = "GRUDGE";
        const sc = careActions(a).find((x) => x.key === "scold");
        out.scoldSub = sc && sc.sub;
        const ta = a.playerTrust;
        out.scold = scoldFluffy(a);
        out.stopped = a.chaseTarget === null;
        out.cost = [+(ta - a.playerTrust).toFixed(3), a.playerFear > 0];
        // For nothing: twice as unkind
        const c = __mk(700);
        const tc = c.playerTrust;
        out.nothing = [scoldFluffy(c), +(tc - c.playerTrust).toFixed(3)];
        // An accident
        const d = __mk(800);
        d.pottyTraining = 0.3;
        d._accidentAt = timePlayed - 5;
        out.accident = [scoldFluffy(d), +(d.pottyTraining - 0.3).toFixed(2)];
        out.tally = storyOf(a).filter((e) => e.k === "tally").reduce((s, e) => s + (e.c.scolded || 0), 0);
        // Time-out
        b.chaseTarget = a;
        timeOut(a);
        out.timeout = [inTimeOut(a), b.chaseTarget, new CareDesire().evaluate(a), a.timeOut.x];
        __tick(TIME_OUT_TIME + 1);
        out.over = inTimeOut(a);
        out.memory = (a.playerMemories || []).map((m) => m.type);
        return out;
      }, SETUP);
      checkEqual(r.praised[0], 3, "three a day");
      check(r.praised[1] > 0.02, `affection ${r.praised[1]}`);
      checkEqual(r.praised[2], false, "not offered when used up");
      checkEqual(r.scoldSub, "for fighting", "it knows what for");
      checkEqual(r.scold, "fight", "scolded for fighting");
      check(r.stopped, "the fight stops");
      check(r.cost[0] >= 0.01 && r.cost[0] < 0.03 && r.cost[1], `it costs a little: ${r.cost}`);
      check(r.nothing[0] === "nothing" && r.nothing[1] >= 0.04, `for nothing ${r.nothing}`);
      check(r.accident[0] === "accident" && r.accident[1] > 0.02 && r.accident[1] < 0.08, `the mess ${r.accident}`); // (0.05, more or less with its smarts)
      check(r.tally >= 1, "in its story");
      check(r.timeout[0] && r.timeout[1] === null && r.timeout[2] === 80 && r.timeout[3] === 70, `time-out ${r.timeout}`);
      checkEqual(r.over, false, "and over");
      check(r.memory.includes("time_out"), `remembered ${r.memory}`);
    },
  },
  {
    name: "conditioning: a bedtime brush calms, food from you brings them running, the stick makes them freeze",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(300);
        f.fears = { thunder: 0.5, dark: 0, bot: 0 };
        for (let i = 0; i < CONDITION_AT; i++) noteConditionBrush(f);
        out.brush = f.fears.thunder < 0.5;
        // Food
        const g = __mk(900);
        g.hunger = 0.4;
        const bowl = new Bowl("bowl", "INDOORS");
        bowl.x = 300;
        bowl.y = 520;
        objects.push(bowl);
        for (let i = 0; i < CONDITION_AT; i++) {
          timePlayed += 61;
          noteConditionFeed(bowl);
        }
        out.run = g.currentStateKey;
        // The stick
        const s = __mk(600);
        for (let i = 0; i < CONDITION_AT; i++) noteConditionStick(s);
        const stick = new SorryStick("INDOORS");
        stick.isDragging = true;
        objects.push(stick);
        mouse.x = s.x;
        mouse.y = s.y;
        out.frozen = stickHeldNear(s);
        out.text = describeConditioning(s);
        out.brushText = describeConditioning(f);
        return out;
      }, SETUP);
      check(r.brush, "the bedtime brush eases its fears");
      checkEqual(r.run, "RUNNING", "comes running for food");
      check(r.frozen, "freezes at the stick");
      check(r.text && /stick/.test(r.text[0]) && r.text[1] === "bad", `shown ${r.text}`);
      check(r.brushText && /bedtime brush/.test(r.brushText[0]), `shown ${r.brushText}`);
    },
  },
];
