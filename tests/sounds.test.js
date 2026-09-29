// Fluffy voice sounds (FluffySounds.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "sounds: faces, dying, pooping and newborns make the right noises, not too often, only in your room",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const r = await page.evaluate(() => {
        __clearScene();
        changeScene("INDOORS");
        const played = [];
        const real = window.playSound;
        window.playSound = (key, vol, pitch) => {
          played.push(key);
          return null;
        };
        try {
          const mk = (x, growth = 1, scene = "INDOORS") => {
            const h = new Horse(growth, null, scene, "earthy", null, 0.5, 0.5, "female");
            h.adopted = true;
            h.x = x;
            h.y = 500;
            fluffies.push(h);
            return h;
          };
          const a = mk(300);
          const foal = mk(600, 0.3);
          const away = mk(300, 1, "INDOORSL1");
          const face = (f, e) => {
            f.expressionOverride = e;
            f.expressionOverrideTimer = 2;
            onFluffyExpression(f);
          };
          const out = {};
          // (a second of game time between checks, so the room isn't "busy")
          const take = () => {
            timePlayed += 1;
            return played.splice(0, played.length);
          };
          face(a, "GOOD_UPSIES");
          out.happy = take();
          face(a, "GOOD_UPSIES");
          out.again = take();
          face(foal, "GOOD_UPSIES");
          out.foalHappy = take();
          face(away, "ANGRY_PUFFED");
          out.away = take();
          face(a, "ANGRY_PUFFED");
          face(foal, "CRYING_SHOCKED");
          out.angryScree = take();
          a.excrete("poop", 0.5);
          out.poop = take();
          a.anatomy.die(null, "test");
          foal.anatomy.die(null, "test");
          out.death = take();
          // Every voice clip in the sound list is used somewhere now
          const used = new Set();
          for (const d of Object.values(FLUFFY_SOUNDS)) {
            if (d.adult) used.add(d.adult);
            if (d.foal) used.add(d.foal);
          }
          out.unused = Object.keys(soundSources).filter((k) => /^(fluffy|foal)_/.test(k) && !/^foal_chirp/.test(k) && k !== "fluffy_move" && !used.has(k));
          return out;
        } finally {
          window.playSound = real;
        }
      });
      checkEqual(JSON.stringify(r.happy), JSON.stringify(["fluffy_happy"]), "happy face");
      checkEqual(r.again.length, 0, "not again straight away");
      checkEqual(JSON.stringify(r.foalHappy), JSON.stringify(["foal_peep"]), "foals peep");
      checkEqual(r.away.length, 0, "not from another room");
      checkEqual(JSON.stringify(r.angryScree), JSON.stringify(["fluffy_angry", "foal_scree"]), "angry and a foal's scree");
      checkEqual(JSON.stringify(r.poop), JSON.stringify(["fluffy_shitting"]), "pooping");
      checkEqual(JSON.stringify(r.death), JSON.stringify(["fluffy_death", "foal_death"]), "dying");
      checkEqual(r.unused.length, 0, `unused voice clips: ${r.unused}`);
    },
  },
];
