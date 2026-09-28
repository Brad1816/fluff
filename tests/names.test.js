// Fluffies stay "Fluffy" until a human names them (Names.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "names: unnamed fluffies stay unnamed; automatic names from one old build are removed on load",
    run: async (page) => {
      const r = await page.evaluate(async () => {
        __clearScene();
        gameState = "PAUSED";
        const made = [];
        for (let i = 0; i < 8; i++) {
          const h = new Horse(1, null, "INDOORS", "earthy");
          fluffies.push(h);
          made.push(h);
        }
        __fastForward(0.05);
        const res = { unnamed: made.every((f) => !fluffyNames[f.id]) };
        // A save from the build that named everyone
        const auto = ["Rosie", "Pudding", "Pudding II", "Pebble", "Cocoa", "Pip", "Wobble", "Sunny"];
        made.forEach((f, i) => (fluffyNames[f.id] = auto[i]));
        await saveGame("__automated_test__");
        await loadGame("__automated_test__");
        res.cleaned = fluffies.filter((f) => made.some((m) => m.id === f.id)).every((f) => !fluffyNames[f.id]);
        // A normal save where you named some of them: left alone
        fluffyNames[made[0].id] = "Rosie";
        fluffyNames[made[1].id] = "Sir Wobbles";
        await saveGame("__automated_test__");
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        res.kept = [fluffyNames[made[0].id], fluffyNames[made[1].id]];
        gameState = "PLAYING";
        return res;
      });
      check(r.unnamed, "fluffies got names without anyone naming them");
      check(r.cleaned, "automatic names weren't removed");
      checkEqual(JSON.stringify(r.kept), JSON.stringify(["Rosie", "Sir Wobbles"]), "names you gave");
    },
  },
];

module.exports.push(
  {
    name: "names: unnamed fluffies are shown by their looks on the game's screens",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        const f = new Horse(1, null, "INDOORS", "unicorn", null, null, null, "female");
        const foal = new Horse(0.5, null, "INDOORS", "earthy", null, null, null, "male");
        fluffies.push(f, foal);
        const res = {
          unnamed: fluffyDisplayName(f),
          foal: fluffyDisplayName(foal),
          row: getFluffyInspectionInfo(f).about.find((x) => x.label === "Name").value,
          speech: f.getName(),
        };
        fluffyNames[f.id] = "Daisy";
        res.named = fluffyDisplayName(f);
        return res;
      });
      check(/^Fluffy \((pink|red|orange|yellow|green|blue|purple|grey|white|black|brown) \w+ mare\)$/.test(r.unnamed), `unnamed: ${r.unnamed}`);
      check(/ colt\)$/.test(r.foal), `foal: ${r.foal}`);
      checkEqual(r.row, r.unnamed, "magnifying glass name row");
      checkEqual(r.speech, "Fluffy", "what fluffies call it");
      checkEqual(r.named, "Daisy", "named fluffy");
    },
  },
  {
    name: "names: a fluffy you bring home gets a naming pop-up; typing (with spaces) doesn't set off game keys",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const dialogs = [];
      page.on("dialog", async (d) => {
        dialogs.push(d.message());
        await d.dismiss();
      });
      const id = await page.evaluate(() => {
        __clearScene();
        tutorialTimer = 0;
        namingPopupsEnabled = true;
        resetNamingPopups();
        updateNamingPopups(2); // takes stock of what's already yours
        const f = new Horse(1, null, "PARK", "earthy", null, null, null, "female");
        fluffies.push(f);
        f.adopted = false;
        updateNamingPopups(2);
        const before = isNamingPopupOpen();
        // Brought home
        f.scene = "INDOORS";
        f.adopted = true;
        setGameSpeed(4);
        updateNamingPopups(2);
        window.__res = { before, open: isNamingPopupOpen(), speed: gameSpeed, showN: showFluffyNames };
        return f.id;
      });
      await page.keyboard.type("Pip Squeak");
      await page.keyboard.press("Enter");
      const r = await page.evaluate((id) => ({ ...window.__res, name: fluffyNames[id], open: isNamingPopupOpen(), openBefore: window.__res.open, showN: showFluffyNames, showNBefore: window.__res.showN }), id);
      check(!r.before, "pop-up for a wild fluffy");
      check(r.openBefore, "no pop-up when it became yours");
      checkEqual(r.speed, 1, "fast forward stops for the pop-up");
      checkEqual(r.name, "Pip Squeak", "name typed in");
      check(!r.open, "pop-up still open after Enter");
      checkEqual(dialogs.length, 0, "the space key opened the cheat box");
      checkEqual(r.showN, r.showNBefore, "typing N toggled name tags");
    },
  },
  {
    name: "names: a litter gets one pop-up once mum has finished; blank boxes stay Fluffy",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const ids = await page.evaluate(() => {
        __clearScene();
        tutorialTimer = 0;
        namingPopupsEnabled = true;
        resetNamingPopups();
        const mum = new Horse(1, null, "INDOORS", "earthy", null, null, null, "female");
        mum.adopted = true;
        fluffies.push(mum);
        updateNamingPopups(2);
        mum.babiesToBirth = 1; // still giving birth
        const foals = [];
        for (let i = 0; i < 3; i++) {
          const b = new Horse(0, mum.id, "INDOORS", "earthy");
          b.adopted = true;
          fluffies.push(b);
          foals.push(b);
        }
        updateNamingPopups(2);
        window.__during = isNamingPopupOpen();
        mum.babiesToBirth = 0;
        updateNamingPopups(2);
        return { foals: foals.map((f) => f.id), kind: namingPopup && namingPopup.kind, count: namingPopup && namingPopup.ids.length };
      });
      await page.keyboard.type("Bean");
      await page.keyboard.press("Tab");
      await page.keyboard.type("Sprout");
      const save = await page.evaluate(() => getNamingLayout().save);
      await page.mouse.click(save.x + save.w / 2, save.y + save.h / 2);
      const r = await page.evaluate((ids) => ({ during: window.__during, names: ids.map((id) => fluffyNames[id] || null), open: isNamingPopupOpen() }), ids.foals);
      check(!r.during, "pop-up while mum was still giving birth");
      checkEqual(ids.kind, "litter", "pop-up kind");
      checkEqual(ids.count, 3, "foals in the pop-up");
      checkEqual(JSON.stringify(r.names), JSON.stringify(["Bean", "Sprout", null]), "names after saving");
      check(!r.open, "pop-up still open");
    },
  },
  {
    name: "names: runaways and lost pets keep the name their old owner gave them",
    run: async (page) => {
      const r = await page.evaluate(async () => {
        __clearScene("PARK");
        __seedRandom(15);
        previousOwnerNames = {};
        const out = {};
        const allOwner = [...OWNER_NAMES.female, ...OWNER_NAMES.male, ...OWNER_NAMES.any];
        out.clash = allOwner.filter((n) => _isAutoName(n));
        // In the park
        const runaway = _makeWild(1, { x: 800, y: 700 }, { personalities: ["runaway"], gender: "male" });
        const feral = _makeWild(1, { x: 800, y: 700 }, { personalities: ["true_feral"] });
        out.runaway = fluffyNames[runaway.id];
        out.maleName = OWNER_NAMES.male.includes(out.runaway) || OWNER_NAMES.any.includes(out.runaway);
        out.feral = fluffyNames[feral.id] || null;
        out.by = namedBy(runaway);
        out.row = getFluffyInspectionInfo(runaway).about.find((x) => x.label === "Named by");
        out.rowFeral = getFluffyInspectionInfo(feral).about.find((x) => x.label === "Named by") || null;
        // Outside the house (script.js)
        let outside = null;
        for (let i = 0; i < 60 && !outside; i++) {
          const before = fluffies.length;
          spawnFeralGroup("OUTDOORS", "lone");
          outside = fluffies.slice(before).find((f) => f.personalities.includes("runaway"));
        }
        out.outside = outside ? fluffyNames[outside.id] : "none spawned";
        // A lost pet in the night (NightEvents.js)
        herdState = freshHerdState();
        _herdChanged();
        runNightEvent("lost_pet");
        const pet = fluffies.find((f) => f.lostPet);
        out.pet = pet ? fluffyNames[pet.id] : null;
        // Clear the name: it isn't given back
        delete fluffyNames[runaway.id];
        giveOwnerName(runaway);
        out.cleared = fluffyNames[runaway.id] || null;
        // The goal waits for a name you give
        fluffyNames[runaway.id] = previousOwnerNames[runaway.id];
        runaway.adopted = true;
        goalsState = freshGoalsState();
        goalsTicker.fireNext();
        updateGoals(0);
        out.goalOwner = isGoalDone("name_one");
        fluffyNames[runaway.id] = "Mine";
        goalsTicker.fireNext();
        updateGoals(0);
        out.goalMine = isGoalDone("name_one");
        out.byMine = namedBy(runaway);
        // Runaways in an older save get their names when it's loaded
        const old = _makeWild(1, { x: 900, y: 700 }, { personalities: ["runaway"] });
        delete fluffyNames[old.id];
        delete previousOwnerNames[old.id];
        gameState = "PAUSED";
        await saveGame("__automated_test__");
        await loadGame("__automated_test__");
        gameState = "PLAYING";
        out.loaded = fluffyNames[old.id] || null;
        out.keptMap = previousOwnerNames[outside ? outside.id : -1] === out.outside;
        return out;
      });
      checkEqual(r.clash.length, 0, `owner names that look like old automatic names: ${r.clash}`);
      check(!!r.runaway && r.maleName, `runaway stallion's name: ${r.runaway}`);
      checkEqual(r.feral, null, "true ferals have no name");
      checkEqual(r.by, "its old owner", "named by");
      check(r.row && r.row.value === "its old owner", JSON.stringify(r.row));
      checkEqual(r.rowFeral, null, "no row for an unnamed fluffy");
      check(r.outside && r.outside !== "none spawned", `runaway outside: ${r.outside}`);
      check(!!r.pet, "lost pet named");
      checkEqual(r.cleared, null, "a cleared name isn't given back");
      checkEqual(r.goalOwner, false, "an old owner's name doesn't count for the goal");
      checkEqual(r.goalMine, true, "your name does");
      checkEqual(r.byMine, "you", "named by you now");
      check(!!r.loaded, "runaway from an old save gets a name on loading");
      check(r.keptMap, "which names came from owners is saved");
    },
  },
);
