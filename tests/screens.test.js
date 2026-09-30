// The pop-up screen list (Screens.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "screens: every screen is on the list; Esc closes the top one; loading closes them all",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        const f = new Horse(1, null, "INDOORS", "earthy");
        f.adopted = true;
        fluffies.push(f);
        const out = { names: SCREENS.map((s) => s.name) };
        out.none = anyScreenOpen();
        // Family tree (it had no Esc before), with goals on top
        openFamilyTree(f.id);
        openGoals();
        out.bothOpen = [isFamilyTreeOpen(), isGoalsOpen(), isAnyScreenOpen()];
        out.esc1 = escapeScreens();
        out.after1 = [isFamilyTreeOpen(), isGoalsOpen()];
        escapeScreens();
        out.after2 = [isFamilyTreeOpen(), anyScreenOpen()];
        // Clicks go to the top screen only
        openGeneLab();
        openVet();
        mouse.x = -5;
        mouse.y = -5; // outside: the vet closes, the Gene Lab stays
        clickScreens();
        out.click = [isVetOpen(), isGeneLabOpen()];
        // Reset (new game / load) closes everything
        openHelp();
        openRecords();
        inspectedFluffy = f;
        resetScreens();
        out.reset = anyScreenOpen();
        let threw = false;
        try {
          registerScreen({ name: "goals", isOpen: () => false, close() {} });
        } catch (e) {
          threw = true;
        }
        out.duplicate = threw;
        return out;
      });
      for (const n of ["inspection", "familyTree", "geneLab", "orders", "dayCare", "shelterCard", "goals", "help", "records", "vet", "showResults", "dayReport", "naming"])
        check(r.names.includes(n), `${n} on the list: ${r.names}`);
      checkEqual(r.none, false, "none open at the start");
      checkEqual(JSON.stringify(r.bothOpen), JSON.stringify([true, true, true]), "both open");
      checkEqual(r.esc1, true, "Esc used");
      checkEqual(JSON.stringify(r.after1), JSON.stringify([true, false]), "goals (on top) closed first");
      checkEqual(JSON.stringify(r.after2), JSON.stringify([false, false]), "then the family tree");
      checkEqual(JSON.stringify(r.click), JSON.stringify([false, true]), "click only reached the top screen");
      checkEqual(r.reset, false, "reset closes everything");
      checkEqual(r.duplicate, true, "a name can't be used twice");
    },
  },
  {
    name: "systems: every update is on the list, in order",
    run: async (page) => {
      const r = await page.evaluate(() => SYSTEMS.map((s) => [s.name, s.order]));
      const want = [
        "familyRecords", "storyBook", "identity", "personality", "wishes", "bonds", "herds", "territory", "worldTime", "separation", "naming", "settling", "goals",
        "dayReport", "nightEvents", "alicornAcceptance", "aging", "abandoned", "illness", "corpses", "orders",
        "stockMarket", "shelter", "shows", "pregnancy", "upbringing", "fears", "population", "affection", "tricks", "diet", "play", "warmth", "bath",
      ];
      const names = r.map((x) => x[0]);
      for (const n of want) check(names.includes(n), `${n} is registered: ${names}`);
      const orders = r.map((x) => x[1]);
      check(orders.every((o, i) => i === 0 || o >= orders[i - 1]), `run in order ${JSON.stringify(r)}`);
    },
  },
];
