// Mum behind bars (MumBars.js): she waits by the bars, frets, calls and
// begs, the foal answers, it weighs on her (never down to looping), and
// she's glad when they're back together
const { check, checkEqual } = require("./helpers");
const src = require("fs").readFileSync(__dirname + "/playtest6.test.js", "utf8");
const SETUP = src.match(/const SETUP = `([\s\S]*?)`;/)[1];

module.exports = [
  {
    name: "mum behind bars: a hungry foal in a cage - she goes to the side of it and sits there, talks, it answers; it weighs on her but never to looping; let out, she's glad and feeds it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const mum = __mk(250, { growth: 1, gender: "female", y: 520 });
        mum.lactatingTimer = 9999;
        mum.milkCharges = 10;
        const foal = __mk(700, { growth: 0.3, y: 520 });
        foal.motherId = mum.id;
        setRelationship(mum.id, foal.id, "baby_child");
        setRelationship(foal.id, mum.id, "mother");
        const cage = new Cage("INDOORS");
        cage.x = 700;
        cage.y = 480;
        objects.push(cage);
        cage.updateBounds();
        foal.currentCage = cage;
        foal.hunger = 0.2;
        out.kind = barsKind(mum, foal);
        // The system notices
        barsTicker.fireNext();
        updateMumBars(1);
        out.noticed = !!mum._bars && mum._bars.foalId === foal.id;
        // She doesn't pace up to feed it
        out.noScout = !mum.positioning.scoutForHungryFoal();
        // Her desire takes her beside the cage
        const d = mum.brain.desires.find((x) => x.name === "WaitByBars");
        out.score = d.evaluate(mum);
        d.execute(mum);
        const spot = barsSpot(mum, foal);
        out.spotOutside = spot.x < cage.bounds.left;
        mum.x = spot.x;
        mum.y = spot.y;
        mum.initBehavior("IDLE");
        d.execute(mum);
        out.sits = mum.currentStateKey === "SITTING" && mum.facingRight;
        // Talks (once a minute), and the foal answers
        mum._barsLine = {};
        const said = barsTalk(mum, foal, "bars");
        out.said = said;
        out.again = barsTalk(mum, foal, "bars");
        timePlayed += 2;
        _barsAnswer(foal);
        out.foalSaid = foal.speech.text;
        // Weighs on her - never to looping
        mum.happiness = 0.6;
        for (let i = 0; i < 200; i++) {
          barsTicker.fireNext();
          updateMumBars(HOUR_LENGTH / 4);
        }
        out.low = mum.happiness;
        out.floor = WAN_DIE_THRESHOLD;
        // Let out: glad
        foal.currentCage = null;
        foal.x = mum.x + 50;
        const h0 = mum.happiness;
        barsTicker.fireNext();
        updateMumBars(1);
        out.glad = mum.happiness > h0 && !mum._bars;
        objects.splice(objects.indexOf(cage), 1);
        return out;
      }, SETUP);
      checkEqual(r.kind, "bars", "a cage is bars");
      check(r.noticed, "she notices her foal's out of reach");
      check(r.noScout, "she doesn't walk up to feed it and walk off again");
      check(r.score > 45, `waiting by the bars beats wandering (${r.score})`);
      check(r.spotOutside, "she waits at the side of the cage");
      check(r.sits, "and sits there, facing it");
      checkEqual(r.said, "CANT_FEED", "a hungry foal: she can't feed it");
      check(r.again === false, "not again straight away");
      check(!!r.foalSaid, `the foal answers ("${r.foalSaid}")`);
      check(r.low < 0.3, `it hits her hard (${r.low})`);
      check(r.low > r.floor, `but never to looping (${r.low} > ${r.floor})`);
      check(r.glad, "back together, she's glad");
    },
  },
  {
    name: "mum behind bars: an incubator is glass (a chirpy only cries); a dad frets less; a mum who's given up doesn't come",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const mum = __mk(250, { growth: 1, gender: "female" });
        const dad = __mk(300, { growth: 1, gender: "male" });
        const foal = __mk(700, { growth: 0.05 });
        foal.motherId = mum.id;
        foal.fatherId = dad.id;
        const inc = new Incubator("INDOORS");
        inc.x = 700;
        inc.y = 500;
        objects.push(inc);
        inc.updateBounds();
        foal.currentCage = inc;
        foal.hunger = 0.1;
        out.kind = barsKind(mum, foal);
        mum._barsLine = {};
        barsTalk(mum, foal, "glass");
        timePlayed += 2;
        _barsAnswer(foal);
        out.cry = /peep|cheep/i.test(foal.speech.text || "");
        // Dad: half as hard
        mum.happiness = dad.happiness = 0.7;
        for (let i = 0; i < 4; i++) {
          barsTicker.fireNext();
          updateMumBars(HOUR_LENGTH);
        }
        out.mumDrop = 0.7 - mum.happiness;
        out.dadDrop = 0.7 - dad.happiness;
        out.dadScore = dad.brain.desires.find((x) => x.name === "WaitByBars").evaluate(dad);
        // Given up
        mum.happiness = WAN_DIE_THRESHOLD - 0.01;
        barsTicker.fireNext();
        updateMumBars(1);
        out.givenUp = !mum._bars && mum.brain.desires.find((x) => x.name === "WaitByBars").evaluate(mum) === 0;
        mum.lactatingTimer = 999;
        mum.milkCharges = 5;
        out.noFeedRun = mum.brain.desires.find((x) => x.name === "FeedHungryFoal").evaluate(mum) === 0;
        objects.splice(objects.indexOf(inc), 1);
        return out;
      }, SETUP);
      checkEqual(r.kind, "glass", "an incubator is glass");
      check(r.cry, "a chirpy only cries back");
      check(r.dadDrop > 0 && r.dadDrop < r.mumDrop, `a dad frets less (${r.dadDrop} < ${r.mumDrop})`);
      check(r.dadScore > 0, "a dad waits by it too");
      check(r.givenUp, "a mum who's given up doesn't come");
      check(r.noFeedRun, "...or run to feed it");
    },
  },
];
