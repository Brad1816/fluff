// The redundancy clean-up: loading a save doesn't make phantom family links,
// and the bad-memory lines the original game wrote (TRAUMA) are now said.
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "cleanup: loading a save keeps fluffy ids and family links exactly as saved (no phantom foals or used-up ids)",
    run: async (page) => {
      const r = await page.evaluate(async () => {
        __clearScene("INDOORS");
        const mum = new Horse(1, null, "INDOORS", "earthy", null, 0.6, 0.6, "female");
        fluffies.push(mum);
        const a = new Horse(0.5, mum.id, "INDOORS", "earthy", null, 0.6, 0.6, "male");
        fluffies.push(a);
        const b = new Horse(0.5, mum.id, "INDOORS", "earthy", null, 0.6, 0.6, "female");
        fluffies.push(b);
        const before = { next: nextFluffyId, rel: JSON.stringify(relationships) };
        gameState = "PAUSED";
        await saveGame("__automated_test__");
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        gameState = "PAUSED";
        return { before, after: { next: nextFluffyId, rel: JSON.stringify(relationships) }, ids: fluffies.map((f) => f.id) };
      });
      checkEqual(r.after.next, r.before.next, "the next fluffy id is what was saved");
      check(r.after.rel === r.before.rel, `family links unchanged: ${r.before.rel.length} vs ${r.after.rel.length} chars`);
      check(!r.ids.includes(-1), "every fluffy got its saved id");
    },
  },
  {
    name: "cleanup: after a miscarriage (or losing legs) a fluffy talks about it for a few days, then the memory fades; repeats don't pile up",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("INDOORS");
        __seedRandom(7);
        const f = new Horse(1, null, "INDOORS", "earthy", null, 0.6, 0.6, "female");
        f.adopted = true;
        f.happiness = 0.7;
        f.hunger = 1;
        f.health = 100;
        fluffies.push(f);
        const said = [];
        f.speak = (t) => said.push(t);
        f.traumaMemory = [
          { type: "miscarriage", timer: 50 },
          { type: "miscarriage", timer: 60 },
          { type: "burn", timer: 40 },
        ];
        for (let i = 0; i < 400; i++) f.randomBabble();
        const lines = DIALOGUE.TRAUMA.MISCARRIAGE;
        const out = { talked: said.filter((t) => lines.includes(t)).length, kept: f.traumaMemory.map((t) => t.type).sort() };
        timePlayed += 4 * DAY_LENGTH;
        said.length = 0;
        for (let i = 0; i < 400; i++) f.randomBabble();
        out.after = said.filter((t) => lines.includes(t)).length;
        out.left = f.traumaMemory.length;
        return out;
      });
      check(r.talked > 3, `it talks about the lost foals: ${r.talked} times`);
      checkEqual(JSON.stringify(r.kept), JSON.stringify(["burn", "miscarriage"]), "one memory of each kind");
      checkEqual(r.after, 0, "days later it's stopped");
      checkEqual(r.left, 0, "and the memory has faded");
    },
  },
];
