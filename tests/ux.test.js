// The tidier menus (review after round 8): the right-click menu's sections,
// the magnifying glass's Overview, paging and row help, item right-click
// hints, the pause menu's switches on a short screen, the store's aisles
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["INDOORS", "BACKYARD", "PARK"]) __clearScene(s);
  __seedRandom(4242);
  closeAllChoices();
  currentScene = "INDOORS";
  isGlobalDragging = false;
  trickUI = null;
  inspectedFluffy = null;
  window.__mk = (x, growth = 1) => {
    const h = new Horse(growth, null, "INDOORS", "earthy", null, 0.6, 0.6, "female");
    h.makeType("earthy");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.brain.think = () => {};
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "ux: the right-click menu shows one section at a time - Train, Lessons, then actions sorted into groups; clicking a section switches; every action has a group",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(600);
        trickUI = { phase: "menu", id: f.id };
        const L = getTrickMenuLayout();
        const out = { sections: L.sections.map((s) => s.id), first: L.section, tricks: L.chips.filter((c) => c.trick).length, actions: L.chips.filter((c) => c.action).length };
        const care = L.chips.find((c) => c.section && c.section.id === "care");
        mouse.x = mouse.sx = care.x + 5;
        mouse.y = mouse.sy = care.y + 5;
        handleTrickClick();
        const L2 = getTrickMenuLayout();
        out.now = L2.section;
        out.careActions = L2.chips.filter((c) => c.action).map((c) => actionGroupOf(c.action));
        out.noTricks = !L2.chips.some((c) => c.trick);
        out.caption = trickMenuCaption(L2.chips.find((c) => c.action));
        // Every action anyone offers has a proper group
        const keys = new Set();
        for (const g of [__mk(300), __mk(400, 0.4)]) for (const a of rightClickActions(g)) keys.add(a.key);
        out.unsorted = [...keys].filter((k) => actionGroupOf({ key: k }) === "more");
        // Remembered for next time
        closeTrickUI();
        trickUI = { phase: "menu", id: f.id };
        out.remembered = getTrickMenuLayout().section;
        drawTrickUI(ctx);
        closeTrickUI();
        lastTrickSection = "train";
        return out;
      }, SETUP);
      check(r.sections[0] === "train" && r.sections.includes("care"), `sections ${r.sections}`);
      check(r.first === "train" && r.tricks === 7 && r.actions === 0, "it opens on the tricks, alone");
      check(r.now === "care" && r.careActions.length > 0 && r.careActions.every((g) => g === "care") && r.noTricks, "Care shows just the care actions");
      check(r.caption && r.caption.includes(":"), `a caption says what it does: ${r.caption}`);
      checkEqual(r.unsorted.length, 0, `actions with no group: ${r.unsorted}`);
      checkEqual(r.remembered, "care", "the last section opens next time");
    },
  },
  {
    name: "ux: the magnifying glass - an Overview with bars and what needs you (click: its tab), long columns page instead of cutting rows off, rows explain themselves",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(600);
        f.hunger = 0.03;
        f.burned = { until: timePlayed + 500 };
        inspectedFluffy = f;
        inspectionTab = "overview";
        drawInspectionModal(ctx);
        const data = getInspectionTabs(f);
        const out = {
          needs: data.needs.map((n) => [n.label, n.jump]),
          firstWarn: data.warnings[0],
          vital: inspectionVitalLevel(f, "Hunger"),
        };
        // Click the Burn row: off to the Body tab
        const j = _inspJumps.find((x) => x.tab === "body");
        if (j) {
          mouse.x = j.x + 10;
          mouse.y = j.y + 6;
          handleInspectionModalClick();
        }
        out.tab = inspectionTab;
        // A column with too many rows for the panel pages
        const rows = [];
        for (let i = 0; i < 40; i++) rows.push({ label: "Row " + i, value: "value " + i, tone: "" });
        _inspPagers = [];
        inspectionScroll = {};
        drawInspectionColumn(ctx, "Test", rows, 100, 300, 300, 600, "test:0");
        out.pager = _inspPagers.find((p) => p.key === "test:0");
        if (out.pager) {
          mouse.x = out.pager.x + 5;
          mouse.y = out.pager.y + 5;
          handleInspectionModalClick();
        }
        out.scrolled = inspectionScroll["test:0"] || 0;
        // Help on hover
        _inspectionTip = null;
        mouse.x = 110;
        mouse.y = 300 + 28 - 5;
        drawInspectionColumn(ctx, "Test", [{ label: "Smarts", value: "50/100", tone: "" }], 100, 300, 300, 600, null);
        out.tip = _inspectionTip;
        _inspectionTip = null;
        // Every tab draws
        let err = null;
        for (const t of INSPECTION_TABS) {
          try {
            inspectionTab = t.id;
            drawInspectionModal(ctx);
          } catch (e) {
            err = t.id + ": " + e;
          }
        }
        out.err = err;
        inspectedFluffy = null;
        inspectionTab = "overview";
        return out;
      }, SETUP);
      check(r.needs.some((n) => n[0] === "Burn" && n[1] === "body"), `needs list: ${JSON.stringify(r.needs)}`);
      check(/^Hunger/.test(r.firstWarn), `the everyday needs come first in the header: ${r.firstWarn}`);
      check(r.vital < 0.1, "the hunger bar is nearly empty");
      checkEqual(r.tab, "body", "clicking a need opens its tab");
      check(r.pager && r.scrolled > 0, "a long column pages");
      check(r.tip && r.tip.some((t) => /learns/.test(t)), `the row explains itself: ${r.tip}`);
      checkEqual(r.err, null, "every tab draws");
    },
  },
  {
    name: "ux: items say what right-click does; the pause menu's switches stay on a short screen; no store aisle is crammed",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const h = new Heater("INDOORS");
        const out = { heater: itemRightClickHint(h) };
        // (lots of switches: still all on screen)
        const n0 = PAUSE_TOGGLES.length;
        for (let i = 0; i < 8; i++) PAUSE_TOGGLES.push({ label: () => "Test switch " + i, run: () => {} });
        const rects = pauseToggleRects();
        out.fits = rects.every((t) => t.y + t.h <= height && t.h >= 20);
        PAUSE_TOGGLES.length = n0;
        out.biggest = Math.max(...getStoreAisles().map((a) => a.actions.length));
        return out;
      }, SETUP);
      check(/switch/.test(r.heater || ""), `heater hint: ${r.heater}`);
      check(r.fits, "pause switches fit");
      check(r.biggest <= 18, `the fullest aisle has ${r.biggest}`);
    },
  },
];
