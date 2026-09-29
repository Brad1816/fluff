// Mess fades over time, and rain washes it away outside (Puddle.js fadeMess)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "mess: poop and pee fade by themselves, faster outside; rain washes it away outside only",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        puddles.length = 0;
        weatherState.until = 1e9;
        const clear = () => {
          weatherState.type = weatherState.target = "clear";
          weatherState.intensity = 0;
        };
        const rain = () => {
          weatherState.type = weatherState.target = "rain";
          weatherState.intensity = 1;
        };
        const size = (scene, color) => {
          const p = puddles.find((q) => q.scene === scene && q.color === color);
          return p ? +p.points.reduce((a, x) => a + x.scale, 0).toFixed(3) : 0;
        };
        const run = (secs) => {
          for (let i = 0; i < secs; i++) fadeMess(1);
        };
        const poop = (scene) => addPointToPuddle(scene, 500, 500, "#5c4033", 0.6, 0.6, 0.02);
        clear();
        poop("INDOORS");
        poop("BACKYARD");
        addPointToPuddle("INDOORS", 800, 500, "#f1c40f", 0.6, 0.6, 0.02);
        addPointToPuddle("INDOORS", 900, 500, "#8a0303", 0.3, 0.3, 0.02);
        addPointToPuddle("INDOORS", 300, 500, "rgba(180, 180, 180, 0.25)", 0.3, 0.3, 0.02);
        const out = { start: [size("INDOORS", "#5c4033"), size("BACKYARD", "#5c4033")] };
        run(DAY_LENGTH / 2);
        out.halfDay = { inPoop: size("INDOORS", "#5c4033"), outPoop: size("BACKYARD", "#5c4033"), pee: size("INDOORS", "#f1c40f"), blood: size("INDOORS", "#8a0303"), tears: size("INDOORS", "rgba(180, 180, 180, 0.25)") };
        run(DAY_LENGTH / 2 + 10);
        out.day = size("INDOORS", "#5c4033");
        // Rain: washes the backyard, not the living room
        puddles.length = 0;
        poop("INDOORS");
        poop("BACKYARD");
        addPointToPuddle("BACKYARD", 700, 500, "#8a0303", 0.4, 0.4, 0.02);
        rain();
        run(40);
        out.rain = { inside: size("INDOORS", "#5c4033"), outside: size("BACKYARD", "#5c4033"), blood: size("BACKYARD", "#8a0303") };
        clear();
        out.parkOutdoor = _messOutdoor(PARK_SCENE);
        // It runs every frame with the other puddle updates
        puddles.length = 0;
        poop("INDOORS");
        const before = size("INDOORS", "#5c4033");
        __fastForward(20);
        out.live = before - size("INDOORS", "#5c4033");
        puddles.length = 0;
        return out;
      });
      checkEqual(JSON.stringify(r.start), JSON.stringify([0.6, 0.6]), "a poop each");
      check(Math.abs(r.halfDay.inPoop - 0.3) < 0.02, `indoors: half gone in half a day ${r.halfDay.inPoop}`);
      checkEqual(r.halfDay.outPoop, 0, "outside: gone in half a day");
      checkEqual(r.halfDay.pee, 0, "pee dries up sooner");
      checkEqual(r.halfDay.blood, 0.3, "blood indoors needs the sponge");
      checkEqual(r.halfDay.tears, 0.3, "tears aren't mess (they evaporate on their own, as before)");
      checkEqual(r.day, 0, "indoor poop gone within a day");
      check(Math.abs(r.rain.inside - 0.58) < 0.005, `rain doesn't reach indoors ${r.rain.inside}`);
      checkEqual(r.rain.outside, 0, "rain washed the backyard");
      checkEqual(r.rain.blood, 0, "and the blood");
      check(r.parkOutdoor, "the park counts as outside");
      check(r.live > 0, "fades during normal play");
    },
  },
];
