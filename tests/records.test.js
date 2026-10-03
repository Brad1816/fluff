// Breeding records (BreedingRecords.js)
const { check, checkEqual } = require("./helpers");

const ELDERLY = 72; // Aging.js ELDERLY_DAYS

module.exports = [
  {
    name: "records: litters, what became of each foal, and what each parent earned",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(31);
        fluffyRecords = {};
        const mk = (growth, mum, gender, name) => {
          const h = new Horse(growth, mum ? mum.id : null, "INDOORS", "earthy", null, null, null, gender);
          h.adopted = true;
          h.age = growth >= 1 ? 6 * DAY_LENGTH : 0;
          if (name) fluffyNames[h.id] = name;
          fluffies.push(h);
          return h;
        };
        const mum = mk(1, null, "female", "Daisy");
        const dad = mk(1, null, "male", "Buster");
        syncFamilyRecords();
        const litter = (n) => {
          const out = [];
          for (let i = 0; i < n; i++) {
            const f = mk(0, mum, i % 2 ? "male" : "female");
            f.fatherId = dad.id;
            out.push(f);
          }
          syncFamilyRecords();
          return out;
        };
        const first = litter(3);
        timePlayed += 2000;
        const second = litter(2);
        // One sold for $300, one died
        noteFluffyLeft(first[0], "sold", 300);
        fluffies.splice(fluffies.indexOf(first[0]), 1);
        first[1].anatomy.die(null, "Starved");
        // Not bred by you: a wild foal of a known mum, and bought stock
        const wildFoal = new Horse(0, mum.id, "PARK", "earthy");
        fluffies.push(wildFoal);
        restockMarket(1);
        money = 1e6;
        const bought = buyStockListing(stockMarket.listings[0].id);
        timePlayed += 10;
        syncFamilyRecords();

        const data = computeBreedingRecords(true);
        const pm = data.parents.find((p) => p.id === mum.id);
        const pd = data.parents.find((p) => p.id === dad.id);
        // An old save's record: guessed
        const legacy = { id: 99999, motherId: mum.id, fatherId: null, bornAt: 50, status: "sold", genes: mum.genes.slice(), gender: "female" };
        fluffyRecords[99999] = legacy;
        syncFamilyRecords();
        return {
          litters: data.litters.map((l) => [l.day, l.foals.length, l.mumId === mum.id, l.dadIds.join()]),
          newestFirst: data.litters[0].bornAt > data.litters[1].bornAt,
          totals: data.totals,
          mum: pm && { litters: pm.litters, foals: pm.foals, sold: pm.sold, earned: pm.earned, best: pm.best, daysLeft: pm.daysLeft },
          dad: pd && { foals: pd.foals, earned: pd.earned, daysLeft: pd.daysLeft },
          outcomes: [first[0], first[1], first[2]].map((f) => describeFoalOutcome(getFamilyRecord(f.id))[0]),
          wildBred: getFamilyRecord(wildFoal.id) ? getFamilyRecord(wildFoal.id).bred : "no record",
          boughtBred: getFamilyRecord(bought.id).bred,
          legacy: legacy.bred,
          dadId: String(dad.id),
        };
      });
      checkEqual(r.litters.length, 2, "litters");
      check(r.newestFirst, "newest first");
      checkEqual(r.litters[0][1], 2, "second litter size");
      checkEqual(r.litters[1][1], 3, "first litter size");
      check(r.litters.every((l) => l[2] && l[3] === r.dadId), JSON.stringify(r.litters));
      checkEqual(r.totals.foals, 5, "foals bred");
      checkEqual(r.totals.sold, 1, "sold");
      checkEqual(r.totals.earned, 300, "earned");
      checkEqual(r.totals.died, 1, "died");
      checkEqual(JSON.stringify(r.mum), JSON.stringify({ litters: 2, foals: 5, sold: 1, earned: 300, best: 300, daysLeft: ELDERLY - 6 }), "mum");
      check(r.dad && r.dad.foals === 5 && r.dad.earned === 300 && r.dad.daysLeft === null, JSON.stringify(r.dad));
      checkEqual(r.outcomes[0], "sold $300", "sold foal");
      checkEqual(r.outcomes[1], "died (starved)", "dead foal");
      check(/^alive, (newborn|\d+wk)$/.test(r.outcomes[2]), r.outcomes[2]);
      check(r.wildBred === false || r.wildBred === "no record", `wild foal isn't yours: ${r.wildBred}`);
      checkEqual(r.boughtBred, false, "bought stock isn't bred by you");
      checkEqual(r.legacy, true, "old saves: guessed");
    },
  },
  {
    name: "records: the screen opens (L), switches tabs, pages, and a click opens the family tree",
    run: async (page) => {
      await page.evaluate(() => {
        __clearScene();
        __seedRandom(32);
        fluffyRecords = {};
        const mum = new Horse(1, null, "INDOORS", "earthy", null, null, null, "female");
        mum.adopted = true;
        fluffies.push(mum);
        syncFamilyRecords();
        for (let l = 0; l < 12; l++) {
          timePlayed += 1000;
          const f = new Horse(0, mum.id, "INDOORS", "earthy");
          f.adopted = true;
          fluffies.push(f);
          syncFamilyRecords();
        }
        window.__mumId = mum.id;
      });
      await page.keyboard.press("l");
      const r = await page.evaluate(() => {
        const out = { open: isRecordsOpen() };
        let drew = true;
        const draw = () => {
          try {
            drawBreedingRecords(ctx);
          } catch (e) {
            drew = e.message;
          }
        };
        draw();
        const clickAt = (b) => {
          mouse.x = b.x + b.w / 2;
          mouse.y = b.y + b.h / 2;
          return handleRecordsClick();
        };
        let L = getRecordsLayout(computeBreedingRecords(true));
        out.pages = L.pages;
        out.rows = L.rows.length;
        clickAt(L.next);
        out.page = recordsPage;
        clickAt(L.tabs[1]);
        out.tab = recordsTab;
        draw();
        L = getRecordsLayout(computeBreedingRecords(true));
        out.parentRows = L.rows.length;
        clickAt(L.rows[0]);
        out.afterClick = { records: isRecordsOpen(), tree: familyTreeFocusId === window.__mumId };
        closeFamilyTree();
        out.drew = drew;
        return out;
      });
      check(r.open, "L opens it");
      check(r.pages >= 2 && r.rows > 0, `pages ${r.pages}, rows ${r.rows}`);
      checkEqual(r.page, 1, "next page");
      checkEqual(r.tab, "parents", "tab");
      checkEqual(r.parentRows, 1, "one parent");
      checkEqual(JSON.stringify(r.afterClick), JSON.stringify({ records: false, tree: true }), "row opens the family tree");
      checkEqual(r.drew, true, "draws");
    },
  },
];
