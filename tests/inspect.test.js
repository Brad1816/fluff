// The magnifying glass inspection panel
const { check } = require("./helpers");

const SHOTS = process.env.INSPECT_SHOTS; // set to a folder to save screenshots

module.exports = [
  {
    name: "inspection panel shows litter training and poopie colours",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(7);
        // bodyQuality 0 = coat right on a "poopie" colour
        const poopie = new Horse(1, null, "INDOORS", "earthy", null, 0, 0, "female");
        poopie.x = 500; poopie.y = 450; poopie.adopted = true;
        poopie.pottyTraining = 0;
        const nice = new Horse(0.4, null, "INDOORS", "unicorn", null, 1, 1, "male");
        nice.x = 700; nice.y = 450; nice.adopted = true;
        nice.pottyTraining = 1;
        nice.personalities = ["smarty"];
        fluffyNames[poopie.id] = "Mudpie";
        fluffyNames[nice.id] = "Sparkle";
        fluffies.push(poopie, nice);
        const text = (f) => getFluffyInspectionLines(f).join("\n");
        return { poopie: text(poopie), nice: text(nice), pid: poopie.id, nid: nice.id };
      });
      check(/Litter trained: Not trained/.test(r.poopie), "untrained not shown:\n" + r.poopie);
      check(/Coat: .*poopie colours/.test(r.poopie), "poopie coat not shown:\n" + r.poopie);
      check(/Litter trained: Fully trained/.test(r.nice), "trained not shown:\n" + r.nice);
      check(/Coat: .*nice colours/.test(r.nice), "nice coat not shown:\n" + r.nice);
      check(/Personality: Smarty/.test(r.nice), "smarty not shown:\n" + r.nice);
      check(/Age: Foal, 40% grown/.test(r.nice), "foal age wrong:\n" + r.nice);

      // Open it for real, draw a frame, and make sure nothing throws
      if (SHOTS) await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      for (const [id, file] of [[r.pid, "poopie"], [r.nid, "nice"]]) {
        await page.evaluate((id) => {
          openInspectionModal(fluffies.find((f) => f.id === id));
          drawInspectionModal(ctx);
        }, id);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/inspect_${file}.png` });
      }
      await page.evaluate(() => { inspectedFluffy = null; });
    },
  },
];
