// The cautery iron: the harsh way to stop bleeding - a burn scar for life
// instead of stitches. And the surgery screen's Stitch / Burn buttons.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["INDOORS", "INDOORSL1"]) __clearScene(s);
  __seedRandom(9);
  closeAllChoices();
  closeSurgery();
  currentScene = "INDOORS";
  window.__mk = (x, opts = {}) => {
    const h = new Horse(1, null, "INDOORS", "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 500;
    h.hunger = 1;
    h.health = 100;
    h.happiness = 0.7;
    h.playerFear = 0;
    h.currentStateKey = "IDLE";
    h.brain.think = () => {};
    fluffies.push(h);
    return h;
  };
  window.__affection = [];
  if (!window.__origGive) window.__origGive = giveAffection;
  giveAffection = (f, kind) => { __affection.push(kind); return __origGive(f, kind); };
}`;

module.exports = [
  {
    name: "cautery: the iron is in the shop, a tool, saved and loaded",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const shop = SPAWN_ACTIONS.find((a) => a.isItem === "cautery_iron");
        const iron = new CauteryIron("INDOORS");
        return {
          price: shop && shop.cost,
          aisle: STORE_AISLES.find((a) => a.items.includes("cautery_iron"))?.id,
          tool: isToolObject(iron),
          name: getToolFullName(iron),
          image: !!getToolImage(iron) && !!images.cautery_iron_hot,
          loaded: createItemFromSave(iron.serialize()) instanceof CauteryIron,
        };
      }, SETUP);
      checkEqual(r.price, 120, "price");
      checkEqual(r.aisle, "surgery", "Surgery & Restraint aisle");
      check(r.tool && r.image, `a toolbox tool with its picture: ${JSON.stringify(r)}`);
      checkEqual(r.name, "Cautery iron", "name");
      check(r.loaded, "saved and loaded");
    },
  },
  {
    name: "cautery: clicking a bleeding fluffy burns it shut - it hurts, it's afraid of you, no thanks, a burn scar for life; the kit's stitches earn thanks",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __mk(400);
        const b = __mk(800);
        const watcher = __mk(1100);
        for (const f of [a, b]) {
          f.update(1 / 60);
          f.bleedingTimer = 10;
        }
        a.lastWound = "leg_1";
        // The iron, in your hand, on a
        const iron = new CauteryIron("INDOORS");
        iron.isDragging = true;
        objects.push(iron);
        isGlobalDragging = true;
        mouse.x = a.x;
        mouse.y = a.y - 10;
        attemptDrop();
        out.stopped = a.bleedingTimer === 0;
        out.health = a.health;
        out.happy = a.happiness < 0.7;
        out.fear = a.playerFear > 0 && watcher.playerFear > 0;
        out.memory = (a.playerMemories || []).some((m) => m.type === "cautery");
        out.scar = scarsOf(a).find((s) => s.kind === "burn");
        out.thanksA = __affection.slice();
        out.ironKept = !!iron && iron.isDragging;
        // A full set of scars: the burn still shows
        const c = __mk(600);
        c.scars = [1, 2, 3, 4, 5].map(() => ({ kind: "flank", how: "x", day: 1 }));
        c.bleedingTimer = 5;
        cauterizeWound(c);
        out.sixth = scarsOf(c).length === 6 && scarsOf(c)[5].kind === "burn" && scarsOf(c)[5].at === "body";
        // Not bleeding: nothing
        const d = __mk(300);
        out.notBleeding = cauterizeWound(d) === false && scarsOf(d).length === 0 && d.health === 100;
        // b gets the kit instead
        __affection.length = 0;
        const kit = new SutureKit("INDOORS");
        out.stitched = sutureWound(b, kit) && b.bleedingTimer === 0 && kit.charges === 3;
        out.thanksB = __affection.slice();
        out.noScarB = !scarsOf(b).some((s) => s.kind === "burn");
        // Drawn on its body without trouble
        a.renderer.ensureTintedImages();
        a.updateLayout();
        a.draw(ctx);
        out.drawn = true;
        out.described = describeScars(a);
        return out;
      }, SETUP);
      check(r.stopped, "the bleeding stops");
      checkEqual(r.health, 100 - 8, "the burn costs some health");
      check(r.happy && r.fear && r.memory, `agony: unhappy, afraid of you, remembers the iron (a witness too): ${JSON.stringify(r)}`);
      check(r.scar && r.scar.at === "leg_1" && /burnt shut/.test(r.scar.how), `a burn scar where the leg was: ${JSON.stringify(r.scar)}`);
      check(!r.thanksA.includes("patched"), `no thanks for the iron: ${r.thanksA}`);
      check(r.ironKept, "the iron stays in your hand");
      check(r.sixth, "a burn shows even with a full set of scars");
      check(r.notBleeding, "on a fluffy that isn't bleeding it does nothing");
      check(r.stitched && r.thanksB.includes("patched") && r.noScarB, `the kit stitches it, it's grateful, no scar: ${JSON.stringify(r)}`);
      check(r.drawn && r.described && /burn scar/i.test(r.described[0]), `drawn and listed in the magnifying glass: ${JSON.stringify(r.described)}`);
    },
  },
  {
    name: "cautery: in the surgery screen a bleeding fluffy gets Stitch and Burn buttons; burning asks first and marks the stump",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        toolbox.push(new CauteryIron("INDOORS"));
        const kit = new SutureKit("INDOORS");
        toolbox.push(kit);
        const f = __mk(600);
        openSurgery(f, new Knife("knife", "INDOORS"));
        surgeryCut("leg_2");
        out.wound = f.lastWound;
        out.bleeding = f.bleedingTimer > 0;
        // The buttons
        const L = surgeryLayout();
        drawSurgery(ctx);
        mouse.x = L.burn.x + 10;
        mouse.y = L.burn.y + 10;
        handleSurgeryClick();
        out.asked = isChoiceOpen() && /Burn/.test(choiceDialog.title);
        pickChoice(0);
        out.burnt = f.bleedingTimer === 0 && scarsOf(f).some((s) => s.kind === "burn" && s.at === "leg_2");
        out.note = surgery.note;
        // Drawing the stump's burn on the chart
        surgery.view = "side";
        surgery.side = "left";
        drawSurgery(ctx);
        out.chartOk = true;
        // Stitch: another cut, stitched from the screen
        surgeryCut("tail");
        mouse.x = L.stitch.x + 10;
        mouse.y = L.stitch.y + 10;
        handleSurgeryClick();
        out.stitched = f.bleedingTimer === 0 && kit.charges === 3 && !isChoiceOpen();
        // No iron: the burn button does nothing
        toolbox.length = 0;
        for (let i = objects.length - 1; i >= 0; i--) if (objects[i] instanceof CauteryIron) objects.splice(i, 1);
        surgeryCut("leftEar");
        out.noIron = askSurgeryBurn() === false;
        return out;
      }, SETUP);
      checkEqual(r.wound, "leg_2", "the cut is where the wound is");
      check(r.bleeding, "it's bleeding");
      check(r.asked, "Burn it shut asks first");
      check(r.burnt && /burnt shut/.test(r.note || ""), `burnt shut, a scar where the leg was: ${JSON.stringify(r)}`);
      check(r.chartOk, "the chart draws the stump's burn");
      check(r.stitched, "Stitch uses the kit straight away");
      check(r.noIron, "no iron, no burning");
    },
  },
  {
    name: "surgery chart: the muzzle has nostrils and a mouth that smiles or frowns with its mood",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(600);
        const shapes = { front: surgeryShapes(f, "front"), side: surgeryShapes(f, "side"), under: surgeryShapes(f, "under") };
        const face = (list) => list.find((s) => s.muzzle);
        const out = {
          front: !!(face(shapes.front).nostrils.length === 2 && face(shapes.front).mouth),
          side: !!(face(shapes.side).nostrils.length === 1 && face(shapes.side).mouth),
          under: !!face(shapes.under).mouth,
        };
        // The mouth bends with its mood
        const strokes = [];
        const c = { save() {}, restore() {}, beginPath() {}, stroke() {}, moveTo() {}, quadraticCurveTo: (cx, cy, x, y) => strokes.push(cy) };
        f.happiness = 0.9;
        _sgDrawMouth(c, f, { x: 200, y: 150, w: 20 });
        f.happiness = 0.1;
        _sgDrawMouth(c, f, { x: 200, y: 150, w: 20 });
        out.smileLower = strokes[0] > strokes[1];
        return out;
      }, SETUP);
      check(r.front && r.side && r.under, `nostrils and a mouth on every view's head: ${JSON.stringify(r)}`);
      check(r.smileLower, "happy: a smile (curving down in the middle); miserable: a frown");
    },
  },
];
