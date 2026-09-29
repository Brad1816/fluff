// Household overview (Household.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "household: lists your fluffies with what they need, neediest first; click goes to the fluffy",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(66);
        inspectedFluffy = null;
        const mk = (x, scene = "INDOORS") => {
          const h = new Horse(1, null, scene, "earthy", null, 0.5, 0.5, "female");
          h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
          h.adopted = true;
          h.x = x;
          h.y = 520;
          h.hunger = 1;
          h.warmth = 1;
          h.happiness = 0.8;
          h.health = 100;
          h.playerTrust = 0.8;
          h.pottyTraining = 1;
          h.coloristDegree = 0;
          h.alicornComfort = 1;
          h.fears = { thunder: 0, dark: 0, bot: 0 };
          fluffies.push(h);
          return h;
        };
        const fine = mk(300);
        fluffyNames[fine.id] = "Aaa";
        const hungry = mk(500);
        fluffyNames[hungry.id] = "Bbb";
        hungry.hunger = 0.03;
        const scared = mk(700, "BACKYARD");
        fluffyNames[scared.id] = "Ccc";
        scared.fears.thunder = 0.9;
        scared.pottyTraining = 0.2;
        startFright(scared, "thunder");
        scared.fright.until = timePlayed + 100;
        const wild = new Horse(1, null, "INDOORS", "earthy");
        wild.adopted = false;
        fluffies.push(wild);

        openHousehold();
        const d = computeHousehold();
        const out = {
          total: d.total,
          needing: d.needing,
          order: d.rows.map((x) => fluffyNames[x.f.id]),
          words: Object.fromEntries(d.rows.map((x) => [fluffyNames[x.f.id], x.words])),
          lessons: d.rows.find((x) => x.f === scared).lessons,
          room: d.rows.find((x) => x.f === scared).room,
        };
        // Needs tab
        householdTab = "needs";
        out.needsRows = getHouseholdLayout(computeHousehold()).rows.length;
        householdTab = "all";
        // Drawing doesn't throw (and shows the hover line)
        let err = null;
        try {
          const L = getHouseholdLayout();
          mouse.x = L.rows[0].x + 100;
          mouse.y = L.rows[0].y + 10;
          drawHousehold(ctx);
        } catch (e) {
          err = String(e);
        }
        out.err = err;
        // Click the frightened one in the backyard
        const L = getHouseholdLayout();
        const row = L.rows.find((x) => x.item.f === scared);
        mouse.x = row.x + 100;
        mouse.y = row.y + 10;
        handleHouseholdClick();
        out.after = { open: isHouseholdOpen(), scene: currentScene, inspected: inspectedFluffy === scared };
        inspectedFluffy = null;
        changeScene("INDOORS");
        return out;
      });
      checkEqual(r.total, 3, "only your fluffies");
      checkEqual(r.needing, 2, "two need something");
      checkEqual(r.order[2], "Aaa", `the one that's fine comes last ${r.order}`);
      check(r.words.Bbb.includes("Hungry"), `hungry ${r.words.Bbb}`);
      check(r.words.Ccc.includes("Frightened"), `frightened ${r.words.Ccc}`);
      checkEqual(r.words.Aaa.length, 0, `fine ${r.words.Aaa}`);
      check(r.lessons.includes("Litter") && r.lessons.includes("Brave"), `lessons ${r.lessons}`);
      checkEqual(r.room, "Backyard", "where it is");
      checkEqual(r.needsRows, 2, "Needs something tab");
      checkEqual(r.err, null, "draws");
      checkEqual(JSON.stringify(r.after), JSON.stringify({ open: false, scene: "BACKYARD", inspected: true }), "goes to it");
    },
  },
  {
    name: "household: O key and the top bar button open it",
    run: async (page) => {
      await page.evaluate(() => {
        __clearScene();
        closeHousehold();
      });
      await page.keyboard.press("o");
      const byKey = await page.evaluate(() => isHouseholdOpen());
      await page.keyboard.press("o");
      const closed = await page.evaluate(() => isHouseholdOpen());
      // The button sits between Records and "?", and clicking it opens the screen
      const b = await page.evaluate(() => {
        const right = 100; // (where the Chat Log button ends; UI.js works it out)
        const out = { h: getHouseholdButtonRect(right), r: getRecordsButtonRect(right), q: getHelpButtonRect(right) };
        mouse.x = out.h.x + out.h.w / 2;
        mouse.y = out.h.y + out.h.h / 2;
        gameSpeedClick(right);
        out.opened = isHouseholdOpen();
        closeHousehold();
        return out;
      });
      const byClick = b.opened;
      checkEqual(byKey, true, "O opens it");
      checkEqual(closed, false, "O again closes it");
      // Top right, clear of the front door (the middle of the top bar) and the "?" button
      check(b.h.x > b.q.x + b.q.w && b.h.x > 760 && b.h.x + b.h.w <= 1280, `button place ${JSON.stringify(b)}`);
      checkEqual(byClick, true, "the Household button opens it");
    },
  },
];
