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
        // A clear bright blue coat (genes 0-23: 8 red, 8 green, 8 blue bits)
        for (let i = 0; i < 24; i++) nice.genes[i] = i >= 16 ? 1 : i >= 8 && i < 12 ? 1 : 0;
        nice.processGenes();
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
  {
    name: "inspection report: tabs sort every row, warnings only for urgent things, clicking a tab switches",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(9);
        const f = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, "female");
        f.x = 500; f.y = 450; f.adopted = true;
        fluffies.push(f);
        f.pottyTraining = 0;
        f.hunger = 0.05;
        const data = getInspectionTabs(f);
        const info = getFluffyInspectionInfo(f);
        const inTabs = new Set();
        for (const t of data.tabs) for (const c of t.cols) for (const row of c.rows) inTabs.add(row.label);
        const missing = [...info.about, ...info.care].map((x) => x.label).filter((l) => l !== "Name" && !inTabs.has(l));
        inspectionTab = "overview";
        inspectedFluffy = f;
        const L = getInspectionModalLayout();
        const tab = L.tabs ? L.tabs[3] : null;
        return {
          missing,
          ids: data.tabs.map((t) => t.id),
          hungerWarn: data.warnings.some((w) => /Hunger/i.test(w)),
          litterWarn: data.warnings.some((w) => /Litter/i.test(w)),
          tab: tab && { x: tab.x + tab.w / 2, y: tab.y + tab.h / 2 },
        };
      });
      check(r.missing.length === 0, `every row is on a tab ${JSON.stringify(r.missing)}`);
      check(r.ids.length === 4, `four tabs ${JSON.stringify(r.ids)}`);
      check(r.hungerWarn, "a starving fluffy gets a header warning");
      check(!r.litterWarn, "litter training is not a header warning");
      if (r.tab) {
        await page.mouse.click(r.tab.x, r.tab.y);
        const now = await page.evaluate(() => inspectionTab);
        check(now === r.ids[3], `clicking the 4th tab opens it (${now})`);
      }
      await page.evaluate(() => { inspectedFluffy = null; inspectionTab = "overview"; });
    },
  },
];
