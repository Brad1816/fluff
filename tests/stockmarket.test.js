// The breeders' market (StockMarket.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "stock market: what's on offer depends on your reputation",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __seedRandom(11);
        const types = (level, mornings) => {
          const seen = {};
          let counts = [];
          for (let i = 0; i < mornings; i++) {
            restockMarket(level);
            counts.push(stockMarket.listings.length);
            for (const l of stockMarket.listings) seen[l.type] = (seen[l.type] || 0) + 1;
          }
          return { seen, counts: [Math.min(...counts), Math.max(...counts)] };
        };
        return { l1: types(1, 20), l2: types(2, 20), l3: types(3, 40), l4: types(4, 60) };
      });
      checkEqual(JSON.stringify(Object.keys(r.l1.seen)), JSON.stringify(["earthy"]), "level 1 sells earthies only");
      checkEqual(JSON.stringify(r.l1.counts), JSON.stringify([3, 3]), "level 1 listings");
      check(r.l2.seen.unicorn > 0 && r.l2.seen.pegasus > 0, `level 2 has unicorns and pegasi ${JSON.stringify(r.l2.seen)}`);
      checkEqual(JSON.stringify(r.l2.counts), JSON.stringify([4, 4]), "level 2 listings");
      check(!r.l3.seen.alicorn, "no alicorns before level 4");
      check(r.l4.seen.alicorn > 0 && r.l4.seen.alicorn < 20, `level 4 sometimes has an alicorn: ${r.l4.seen.alicorn} in 60 mornings`);
      checkEqual(JSON.stringify(r.l4.counts), JSON.stringify([6, 6]), "level 4 listings");
    },
  },
  {
    name: "stock market: a real pedigree, priced well above what it sells for",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __seedRandom(12);
        const out = { bad: [], ratio: [] };
        for (let n = 0; n < 30; n++) {
          const l = makeStockListing(3);
          // Every colour gene came from mum or dad, and theirs from their parents
          for (let i = 0; i < 48; i++) {
            if (l.genes[i] !== l.mum.genes[i] && l.genes[i] !== l.dad.genes[i]) out.bad.push(`foal ${i}`);
            const [gm, gd] = [l.grand[0].genes[i], l.grand[1].genes[i]];
            if (l.mum.genes[i] !== gm && l.mum.genes[i] !== gd) out.bad.push(`mum ${i}`);
          }
          const f = stockDisplayFluffy(l);
          out.ratio.push(l.price / Math.max(1, f.calculatePrice()));
          if (stockTypeOfGenes(l.genes) !== l.type || f.type !== l.type) out.bad.push(`type ${l.type} ${f.type}`);
        }
        // A spotted line really passes on spots
        let spotted = 0;
        for (let n = 0; n < 40; n++) {
          const l = makeStockListing(1, STOCK_BREEDERS.find((b) => b.line === "spots"));
          if (describeGenes(l.genes).spots >= 2) spotted++;
        }
        out.spotted = spotted;
        // A white line makes pale and white coats
        let pale = 0;
        for (let n = 0; n < 40; n++) {
          const l = makeStockListing(1, STOCK_BREEDERS.find((b) => b.line === "white"));
          if (l.genes.slice(0, 24).reduce((a, g) => a + g, 0) >= 19) pale++;
        }
        out.pale = pale;
        // No two listings share a name
        restockMarket(5);
        out.names = stockMarket.listings.map((x) => x.name);
        out.minRatio = Math.min(...out.ratio);
        return out;
      });
      checkEqual(r.bad.length, 0, `pedigree genes ${r.bad.slice(0, 5)}`);
      check(r.minRatio >= 2, `price at least twice the sale price (lowest ${r.minRatio.toFixed(2)}x)`);
      check(r.spotted >= 30, `spotted line carries spots: ${r.spotted}/40`);
      check(r.pale >= 30, `white line makes pale coats: ${r.pale}/40`);
      checkEqual(new Set(r.names).size, r.names.length, `names ${r.names}`);
    },
  },
  {
    name: "stock market: buying brings the fluffy home with its pedigree; can't buy without the money",
    run: async (page) => {
      const r = await page.evaluate(async () => {
        __clearScene();
        __seedRandom(13);
        restockMarket(2);
        const l = stockMarket.listings.find((x) => x.type !== "earthy") || stockMarket.listings[0];
        const out = { count: stockMarket.listings.length, type: l.type };
        money = l.price - 1;
        out.poor = buyStockListing(l.id);
        out.moneyAfterFail = money;
        money = l.price + 10;
        const f = buyStockListing(l.id);
        out.money = money;
        out.left = stockMarket.listings.length;
        out.f = f && { adopted: f.adopted, scene: f.scene, name: fluffyNames[f.id], type: f.type, horn: !!f.limbs.horn, wings: !!f.limbs.leftWing, inList: fluffies.includes(f), genes: JSON.stringify(f.genes) === JSON.stringify(l.genes) };
        out.temper = describeTemperament(f)[0];
        // The breeder's name doesn't complete the "name a fluffy" goal
        goalsState = freshGoalsState();
        goalsTicker.fireNext();
        updateGoals(0);
        out.goalBefore = isGoalDone("name_one");
        fluffyNames[f.id] = "Mine";
        goalsTicker.fireNext();
        updateGoals(0);
        out.goalAfter = isGoalDone("name_one");
        const rec = getFamilyRecord(f.id);
        const mum = getFamilyRecord(rec.motherId);
        const dad = getFamilyRecord(rec.fatherId);
        const gran = getFamilyRecord(mum.motherId);
        out.ped = { mum: mum && mum.name, mumStatus: mum && mum.status, dad: dad && dad.name, gran: gran && gran.name, kids: getFamilyChildren(mum.id).map((x) => x.id).includes(f.id), from: rec.boughtFrom };
        out.statusText = FAMILY_STATUS_TEXT[mum.status];
        let treeOk = true;
        try {
          openFamilyTree(f.id);
          drawFamilyTree(ctx);
          closeFamilyTree();
        } catch (e) {
          treeOk = e.message;
        }
        out.treeOk = treeOk;
        // Saved and loaded: listings and the pedigree
        gameState = "PAUSED";
        const listingsBefore = JSON.stringify(stockMarket.listings.map((x) => [x.id, x.price]));
        await saveGame("__automated_test__");
        stockMarket = freshStockMarket();
        fluffyRecords = {};
        await loadGame("__automated_test__");
        gameState = "PLAYING";
        out.savedListings = JSON.stringify(stockMarket.listings.map((x) => [x.id, x.price])) === listingsBefore;
        const g2 = getFamilyRecord(getFamilyRecord(f.id).motherId);
        out.savedPedigree = !!g2 && g2.status === "breeder";
        return out;
      });
      checkEqual(r.poor, null, "can't buy without the money");
      check(r.moneyAfterFail >= 0, "money untouched");
      checkEqual(r.money, 10, "paid");
      checkEqual(r.goalBefore, false, "breeder's name isn't yours");
      checkEqual(r.goalAfter, true, "renaming it counts");
      checkEqual(r.left, r.count - 1, "listing gone");
      check(r.f && r.f.adopted && r.f.inList && r.f.scene === "INDOORS" && r.f.genes, JSON.stringify(r.f));
      check(!!r.f.name, "named by its breeder");
      checkEqual(r.f.type, r.type, "type");
      if (r.type === "unicorn") check(r.f.horn, "unicorn has a horn");
      if (r.type === "pegasus") check(r.f.wings, "pegasus has wings");
      check(["Good-natured", "Ordinary", "Delightful pet"].includes(r.temper), `raised well: ${r.temper}`);
      check(r.ped.mum && r.ped.dad && r.ped.gran, `pedigree ${JSON.stringify(r.ped)}`);
      checkEqual(r.ped.mumStatus, "breeder", "parents stay with the breeder");
      check(r.ped.kids, "mum's record lists the foal");
      checkEqual(r.statusText, "With its breeder", "status text");
      checkEqual(r.treeOk, true, "family tree draws");
      check(r.savedListings, "listings saved");
      check(r.savedPedigree, "pedigree saved");
    },
  },
  {
    name: "stock market: restocks every morning; the Breeding stock tab shows it and buys with a click",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(14);
        const out = {};
        stockMarket = freshStockMarket();
        stockTicker.fireNext();
        updateStockMarket(0);
        const first = stockMarket.listings.map((l) => l.id);
        stockTicker.fireNext();
        updateStockMarket(0);
        out.sameDay = JSON.stringify(stockMarket.listings.map((l) => l.id)) === JSON.stringify(first);
        timePlayed += DAY_LENGTH;
        stockTicker.fireNext();
        updateStockMarket(0);
        out.nextDay = stockMarket.listings.length > 0 && !stockMarket.listings.some((l) => first.includes(l.id));

        // The screen
        money = 1e6;
        openOrdersScreen("web");
        const { s, ox, oy } = _osOrigin();
        const clickAt = (b) => {
          mouse.x = ox + (b.x + b.w / 2) * s;
          mouse.y = oy + (b.y + b.h / 2) * s;
          return handleOrdersScreenClick();
        };
        const tab = _ordersTabs().find((t) => t.id === "stock");
        clickAt(tab);
        out.tab = ordersTab;
        let drew = true;
        try {
          drawOrdersScreen(ctx);
        } catch (e) {
          drew = e.message;
        }
        out.drew = drew;
        const before = fluffies.length;
        const card = stockMarketLayout()[0];
        clickAt(card.buy);
        out.bought = fluffies.length === before + 1;
        // Back to orders
        clickAt(_ordersTabs().find((t) => t.id === "orders"));
        out.back = ordersTab;
        try {
          drawOrdersScreen(ctx);
        } catch (e) {
          out.drew = e.message;
        }
        closeOrdersScreen();
        return out;
      });
      check(r.sameDay, "same stock during the day");
      check(r.nextDay, "new stock the next morning");
      checkEqual(r.tab, "stock", "tab");
      checkEqual(r.drew, true, "draws");
      check(r.bought, "bought with a click");
      checkEqual(r.back, "orders", "back to orders");
    },
  },
];
