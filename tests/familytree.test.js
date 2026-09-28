// The family record book and family tree screen (FamilyTree.js)
const { check, checkEqual } = require("./helpers");

// Makes a small family: grandma+grandpa -> mum; mum+dad -> 2 foals
const MAKE_FAMILY = () => {
  __clearScene();
  __seedRandom(4);
  const mk = (name, gender, mom = null, dad = null, growth = 1) => {
    const h = new Horse(growth, mom ? mom.id : null, "INDOORS", "earthy", null, null, null, gender);
    if (dad) h.fatherId = dad.id;
    h.adopted = true;
    h.x = 300 + fluffies.length * 90;
    h.y = 450;
    fluffyNames[h.id] = name;
    fluffies.push(h);
    return h;
  };
  const gma = mk("Gran", "female");
  const gpa = mk("Gramps", "male");
  const mum = mk("Mum", "female", gma, gpa);
  const dad = mk("Dad", "male");
  const kid1 = mk("Kid1", "female", mum, dad, 0.5);
  const kid2 = mk("Kid2", "male", mum, dad, 0.5);
  syncFamilyRecords();
  return { gma: gma.id, gpa: gpa.id, mum: mum.id, dad: dad.id, kid1: kid1.id, kid2: kid2.id };
};

module.exports = [
  {
    name: "the record book remembers fluffies that die, are sold or leave",
    run: async (page) => {
      const r = await page.evaluate((make) => {
        const ids = eval("(" + make + ")")();
        const byId = (id) => fluffies.find((f) => f.id === id);
        // Gramps dies and his body is bagged; Dad is sold; Gran wanders off
        byId(ids.gpa).die();
        syncFamilyRecords();
        fluffies.splice(fluffies.indexOf(byId(ids.gpa)), 1);
        noteFluffyLeft(byId(ids.dad), "sold");
        fluffies.splice(fluffies.indexOf(byId(ids.dad)), 1);
        fluffies.splice(fluffies.indexOf(byId(ids.gma)), 1);
        syncFamilyRecords();
        const rec = (id) => getFamilyRecord(id);
        return {
          ids,
          gpa: rec(ids.gpa).status,
          dad: rec(ids.dad).status,
          gma: rec(ids.gma).status,
          kid1Parents: [rec(ids.kid1).motherId, rec(ids.kid1).fatherId],
          mumParents: [rec(ids.mum).motherId, rec(ids.mum).fatherId],
          kids: getFamilyChildren(ids.mum).map((r) => r.id),
          sibs: getFamilySiblings(ids.kid1).map((s) => [s.rec.id, s.full]),
          hasGenes: Array.isArray(rec(ids.dad).genes) && rec(ids.dad).genes.length >= 71,
        };
      }, MAKE_FAMILY.toString());
      checkEqual(r.gpa, "dead", "Gramps");
      checkEqual(r.dad, "sold", "Dad");
      checkEqual(r.gma, "gone", "Gran");
      checkEqual(JSON.stringify(r.kid1Parents), JSON.stringify([r.ids.mum, r.ids.dad]), "Kid1's parents");
      checkEqual(JSON.stringify(r.mumParents), JSON.stringify([r.ids.gma, r.ids.gpa]), "Mum's parents");
      checkEqual(JSON.stringify(r.kids), JSON.stringify([r.ids.kid1, r.ids.kid2]), "Mum's foals");
      checkEqual(JSON.stringify(r.sibs), JSON.stringify([[r.ids.kid2, true]]), "Kid1's siblings");
      check(r.hasGenes, "Dad's genes weren't kept");
    },
  },
  {
    name: "a foal adopted by another mare keeps its birth mother",
    run: async (page) => {
      const r = await page.evaluate((make) => {
        const ids = eval("(" + make + ")")();
        const kid = fluffies.find((f) => f.id === ids.kid1);
        kid.motherId = ids.gma; // Gran adopts Kid1 (what attemptAdoption does)
        syncFamilyRecords();
        const rec = getFamilyRecord(ids.kid1);
        return { ids, mother: rec.motherId, foster: rec.fosterMotherId };
      }, MAKE_FAMILY.toString());
      checkEqual(r.mother, r.ids.mum, "birth mother");
      checkEqual(r.foster, r.ids.gma, "foster mother");
    },
  },
  {
    name: "the record book survives saving and loading",
    run: async (page) => {
      const r = await page.evaluate(async (make) => {
        const ids = eval("(" + make + ")")();
        const dad = fluffies.find((f) => f.id === ids.dad);
        noteFluffyLeft(dad, "sold");
        fluffies.splice(fluffies.indexOf(dad), 1);
        await saveGame("__automated_test__");
        fluffyRecords = {};
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        return { ids, dad: getFamilyRecord(ids.dad), kid: getFamilyRecord(ids.kid2) };
      }, MAKE_FAMILY.toString());
      check(r.dad, "Dad's record was lost");
      checkEqual(r.dad.status, "sold", "Dad's status after loading");
      checkEqual(r.kid.fatherId, r.ids.dad, "Kid2's father after loading");
    },
  },
  {
    name: "family tree: open from the magnifying glass, click around, close",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const ids = await page.evaluate((make) => {
        tutorialTimer = 0;
        const ids = eval("(" + make + ")")();
        openInspectionModal(fluffies.find((f) => f.id === ids.kid1));
        return ids;
      }, MAKE_FAMILY.toString());
      const before = await page.evaluate(() => ({ next: nextFluffyId, rels: Object.keys(relationships).length }));

      // "Family tree" button in the inspection panel
      const btn = await page.evaluate(() => {
        const L = getInspectionModalLayout();
        return { x: L.treeBtnX + L.btnW / 2, y: L.btnY + L.btnH / 2 };
      });
      await page.mouse.click(btn.x, btn.y);
      checkEqual(await page.evaluate(() => familyTreeFocusId), ids.kid1, "tree opened on Kid1");
      await page.waitForTimeout(100); // let it draw a frame (portraits)

      // Click the Mother card -> the tree moves to Mum
      const cardPos = (role) =>
        page.evaluate((role) => {
          const n = _getFamilyTreeCache().nodes.find((n) => n.role === role);
          const { s, ox, oy } = _ftOrigin();
          return { x: ox + (n.x + 10 + n.w / 2) * s, y: oy + (n.y + n.h / 2) * s };
        }, role);
      let p = await cardPos("Mother");
      await page.mouse.click(p.x, p.y);
      checkEqual(await page.evaluate(() => familyTreeFocusId), ids.mum, "after clicking Mother");
      const mumTree = await page.evaluate(() =>
        _getFamilyTreeCache().nodes.filter((n) => n.rec && !n.rec.missing).map((n) => n.role + ":" + n.rec.id),
      );
      check(mumTree.includes("Mother:" + ids.gma), "Gran isn't shown as Mum's mother");
      check(mumTree.includes("Foal:" + ids.kid1) && mumTree.includes("Foal:" + ids.kid2), "Mum's foals aren't shown");

      // Back -> Kid1 again, then Close
      const btnPos = (key) =>
        page.evaluate((key) => {
          const b = FT_BUTTONS[key];
          const { s, ox, oy } = _ftOrigin();
          return { x: ox + (b.x + b.w / 2) * s, y: oy + (b.y + b.h / 2) * s };
        }, key);
      p = await btnPos("back");
      await page.mouse.click(p.x, p.y);
      checkEqual(await page.evaluate(() => familyTreeFocusId), ids.kid1, "after Back");
      check(await page.evaluate(() => isAnyScreenOpen()), "the game doesn't know a screen is open");
      p = await btnPos("close");
      await page.mouse.click(p.x, p.y);
      checkEqual(await page.evaluate(() => familyTreeFocusId), null, "after Close");

      // Drawing portraits of past fluffies mustn't use up ids or add relationships
      const after = await page.evaluate(() => ({ next: nextFluffyId, rels: Object.keys(relationships).length }));
      checkEqual(JSON.stringify(after), JSON.stringify(before), "ids/relationships after drawing the tree");
    },
  },
  {
    name: "genetics panel reads carriers from the genes",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const genes = new Array(103).fill(0);
        genes[53] = genes[54] = genes[55] = 1; // 3 of 5 wing genes: a carrier
        for (let i = 58; i < 63; i++) genes[i] = 1; // 5 of 5 horn genes: has a horn
        genes[95] = genes[96] = 1; // 2 of 4 gradient genes: shows
        const g = describeGenes(genes);
        return {
          wings: [g.wings, _geneVerdict(g.wings, 4)[0]],
          horn: [g.horn, _geneVerdict(g.horn, 4)[0]],
          gradient: [g.gradient, _geneVerdict(g.gradient, 2)[0]],
          spots: [g.spots, _geneVerdict(g.spots, 4)[0]],
        };
      });
      checkEqual(JSON.stringify(r.wings), JSON.stringify([3, "carrier"]), "wings");
      checkEqual(JSON.stringify(r.horn), JSON.stringify([5, "shows"]), "horn");
      checkEqual(JSON.stringify(r.gradient), JSON.stringify([2, "shows"]), "gradient");
      checkEqual(JSON.stringify(r.spots), JSON.stringify([0, "none"]), "spots");
    },
  },
  {
    name: "a mare that spawned with foals has them in her family tree (park family, alley single mum)",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        __seedRandom(8);
        fluffyRecords = {};
        // A wild family in the park: open the mum's tree without taking her home
        const group = spawnParkGroup("single_mom", { x: 800, y: 700 });
        const mum = group.find((f) => f.growth >= 1);
        const foals = group.filter((f) => f !== mum).map((f) => f.id);
        openFamilyTree(mum.id);
        const wildKids = getFamilyChildren(mum.id).map((x) => x.id);
        const sibOfFoal = getFamilySiblings(foals[0]).map((x) => x.rec.id);
        closeFamilyTree();

        // Take only the mum home: her foals still show up
        fluffyRecords = {};
        mum.adopted = true;
        syncFamilyRecords();
        const homeKids = getFamilyChildren(mum.id).map((x) => x.id);

        // A single mum turning up outside (script.js spawnFeralGroup)
        fluffyRecords = {};
        const before = fluffies.length;
        spawnFeralGroup("OUTDOORS", "single_mom");
        const spawned = fluffies.slice(before);
        const mare = spawned.find((f) => f.growth >= 1);
        const babies = spawned.filter((f) => f !== mare).map((f) => f.id);
        openFamilyTree(mare.id);
        const alleyKids = getFamilyChildren(mare.id).map((x) => x.id);
        closeFamilyTree();
        return { foals, wildKids, sibOfFoal, homeKids, babies, alleyKids };
      });
      const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
      check(r.foals.length > 0, "the park mum should have foals");
      check(same(r.wildKids, r.foals), `wild mum's tree: ${r.wildKids} vs ${r.foals}`);
      check(r.foals.length < 2 || r.sibOfFoal.length === r.foals.length - 1, `siblings ${r.sibOfFoal}`);
      check(same(r.homeKids, r.foals), `mum taken home: ${r.homeKids} vs ${r.foals}`);
      check(r.babies.length > 0 && same(r.alleyKids, r.babies), `alley mum: ${r.alleyKids} vs ${r.babies}`);
    },
  },
];
