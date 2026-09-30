// Room climate (Climate.js): what happens in a room gives it a feel
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(33);
  storyBook = freshStoryBook();
  _storyIndex = null;
  roomClimate = freshRoomClimate();
  _climateCache = null;
  timePlayed = 4 * DAY_LENGTH + 3 * HOUR_LENGTH;
  window.__mk = (x, scene = "INDOORS", growth = 1) => {
    const h = new Horse(growth, null, scene, "earthy", null, 0.5, 0.5, "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.happiness = 0.5;
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
    name: "climate: kindness makes a room Warm, harshness Fearful, a death Grieving; it fades over days; hover says why",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(300);
        const g = __mk(500);
        out.start = climateOf("INDOORS").label;
        for (let i = 0; i < 6; i++) recordStory("brushed", f);
        for (let i = 0; i < 4; i++) recordStory("played", g);
        const warm = climateOf("INDOORS");
        out.warm = [warm.label, warm.reasons.slice(0, 2)];
        out.happy = climateHappinessTarget(f);
        out.learn = climateLearnMultiplier(f);
        out.play = climateDesireMultiplier(f, "PlayWithBall");
        // Harsh: three hard hits in here
        for (let i = 0; i < 3; i++) recordStory("harmed", g, { x: "hit " + i });
        const fear = climateOf("INDOORS");
        out.fear = [fear.label, fear.reasons[0]];
        out.frightMult = climateFrightMultiplier(f);
        out.fearHappy = climateHappinessTarget(f);
        // Three days later it has mostly faded
        timePlayed += 3 * DAY_LENGTH;
        out.faded = climateOf("INDOORS").label;
        // A death in the next room
        const h = __mk(300, "INDOORSL1");
        recordStory("died", h, { x: "Old age" });
        out.grief = climateOf("INDOORSL1").label;
        // Outside the house it doesn't touch them
        const b = __mk(300, "BACKYARD");
        out.backyard = climateHappinessTarget(b);
        return out;
      }, SETUP);
      checkEqual(r.start, "Calm", "a new room is Calm");
      checkEqual(r.warm[0], "Warm", "brushing and play make it Warm");
      check(r.warm[1].includes("brushing"), `why: ${r.warm[1]}`);
      checkEqual(r.happy, 0.05, "they settle happier");
      checkEqual(r.learn, 1.1, "and learn a little faster");
      check(r.play > 1, "and play more");
      checkEqual(r.fear[0], "Fearful", "hurting them makes it Fearful");
      checkEqual(r.fear[1], "your harshness", "and it says so");
      checkEqual(r.frightMult, 1.2, "frights hit harder");
      check(r.fearHappy < 0, "they settle less happy");
      checkEqual(r.faded, "Calm", "it fades over days");
      checkEqual(r.grief, "Grieving", "a death");
      checkEqual(r.backyard, 0, "only the house rooms");
    },
  },
  {
    name: "climate: a crowded room is Tense, trouble next door makes it Uneasy, an old contented fluffy calms it; the trend arrow",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        for (let i = 0; i < roomSpace("INDOORS") * 2; i++) __mk(100 + i * 40);
        out.crowded = climateOf("INDOORS").label;
        out.crowdWhy = climateOf("INDOORS").reasons;
        fluffies.length = 0;
        _climateCache = null;
        // Fights in the living room: the room next door feels it
        const a = __mk(300);
        for (let i = 0; i < 12; i++) recordStory("attacked", a);
        out.tense = climateOf("INDOORS").label;
        out.next = climateOf("INDOORSR1").label;
        // An old, contented mare in the living room
        const old = __mk(600);
        old.age = 1e9;
        old.happiness = 0.8;
        _climateCache = null;
        out.elder = isElderly(old);
        const calmed = climateOf("INDOORS");
        out.calmed = [calmed.label, calmed.reasons.some((s) => /keeps everyone calm/.test(s))];
        // Trend: kindness after a while shows an up arrow
        timePlayed += CLIMATE_TREND_EVERY + 1;
        climateOf("INDOORS");
        for (let i = 0; i < 20; i++) recordStory("held_happy", a);
        timePlayed += CLIMATE_TREND_EVERY + 1;
        out.trend = climateOf("INDOORS").trend;
        return out;
      }, SETUP);
      checkEqual(r.crowded, "Tense", "crowded is tense");
      check(r.crowdWhy.includes("crowding"), `why: ${r.crowdWhy}`);
      checkEqual(r.tense, "Tense", "fights make it Tense");
      checkEqual(r.next, "Uneasy", "next door is Uneasy");
      check(r.elder, "she's old");
      check(r.calmed[1], "the old mare is in the reasons");
      checkEqual(r.trend, 1, "getting better");
    },
  },
  {
    name: "climate: at the door they run to you in a warm room, go quiet in a tense one, scatter if they fear you; they flinch from your hand",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const love = __mk(300);
        love.playerTrust = 0.9;
        const scared = __mk(700);
        scared.playerFear = 0.7;
        scared.playerTrust = 0.2;
        const meh = __mk(1000);
        for (let i = 0; i < 10; i++) recordStory("brushed", love);
        changeScene("BACKYARD");
        for (const f of fluffies) f.lastSeenPlayerTime = gameTimeMs() - 120000;
        mouse.x = 200;
        mouse.y = 400;
        changeScene("INDOORS");
        out.warm = climateOf("INDOORS").label;
        out.love = [love.currentStateKey, love.expressionOverride];
        out.scared = [scared.currentStateKey, scared.expressionOverride, scared.targetX > 700 || (scared.target && scared.target.x > 700)];
        // A tense room: the unsure one goes quiet
        roomClimate = freshRoomClimate();
        _climateCache = null;
        for (let i = 0; i < 12; i++) recordStory("attacked", meh);
        changeScene("BACKYARD");
        for (const f of fluffies) {
          f.lastSeenPlayerTime = gameTimeMs() - 120000;
          f.initBehavior("IDLE");
          f.expressionOverride = null;
          f.speech && (f.speech.text = "");
        }
        changeScene("INDOORS");
        out.tense = climateOf("INDOORS").label;
        out.meh = meh.expressionOverride;
        // Flinch
        scared.initBehavior("IDLE");
        scared.expressionOverride = null;
        scared._flinchAt = undefined;
        mouse.x = scared.x;
        mouse.y = scared.y - 30;
        climateTicker.fireNext();
        updateClimate(0.3);
        out.flinch = scared.expressionOverride;
        love.expressionOverride = null;
        mouse.x = love.x;
        mouse.y = love.y - 30;
        climateTicker.fireNext();
        updateClimate(0.3);
        out.noFlinch = love.expressionOverride;
        // The label and its hover draw
        let err = null;
        try {
          drawHouseNav(ctx);
          mouse.x = _climateLabelRect.x + 4;
          mouse.y = _climateLabelRect.y + 4;
          drawHouseNav(ctx);
        } catch (e) {
          err = String(e);
        }
        out.err = err;
        return out;
      }, SETUP);
      checkEqual(r.warm, "Warm", "warm room");
      checkEqual(r.love[0], "RUNNING", "the loving one runs to you");
      checkEqual(r.love[1], "GOOD_UPSIES", "happily");
      checkEqual(r.scared[0], "RUNNING", "the frightened one runs");
      checkEqual(r.scared[1], "CRYING_SHOCKED", "scared");
      checkEqual(r.tense, "Tense", "tense room");
      checkEqual(r.meh, "MISERABLE", "the unsure one goes quiet");
      checkEqual(r.flinch, "CRYING_SHOCKED", "a feared hand makes it flinch");
      checkEqual(r.noFlinch, null, "a loved one doesn't");
      checkEqual(r.err, null, "the label and hover draw");
    },
  },
];
