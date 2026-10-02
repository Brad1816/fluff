// Batch 5: the surgery screen. The knife and scalpel open a chart of the
// fluffy from four sides; parts light up and you're asked before a cut.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["INDOORS", "INDOORSL1"]) __clearScene(s);
  __seedRandom(5);
  closeAllChoices();
  closeSurgery();
  currentScene = "INDOORS";
  window.__mk = (x, opts = {}) => {
    const h = new Horse(1, null, "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
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
  // Where in the screen is this part drawn? (a spot on it)
  window.__spot = (id) => {
    const L = surgeryLayout();
    for (let y = L.art.y; y < L.art.y + L.art.h; y += 3)
      for (let x = L.art.x; x < L.art.x + L.art.w; x += 3) if (surgeryPartAt(x, y, L) === id) return { x, y };
    return null;
  };
  // Which parts can be found in a view
  window.__found = (view, side = "right") => {
    surgery.view = view;
    surgery.side = side;
    const L = surgeryLayout();
    const seen = new Set();
    for (let y = L.art.y; y < L.art.y + L.art.h; y += 4)
      for (let x = L.art.x; x < L.art.x + L.art.w; x += 4) {
        const id = surgeryPartAt(x, y, L);
        if (id) seen.add(id);
      }
    return [...seen].sort();
  };
}`;

module.exports = [
  {
    name: "surgery: clicking a fluffy with the knife opens the surgery screen (and pauses) instead of cutting",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(600);
        f.update(1 / 60);
        const knife = new Knife("knife", "INDOORS");
        knife.isDragging = true;
        objects.push(knife);
        isGlobalDragging = true;
        mouse.x = f.x;
        mouse.y = f.y - 10;
        const before = JSON.stringify(f.limbs);
        attemptDrop();
        return {
          open: isSurgeryOpen() && surgery.f === f,
          paused: screenPausesGame(),
          untouched: JSON.stringify(f.limbs) === before && f.health === 100,
          view: surgery && surgery.view,
          tool: surgery && surgery.knife === knife,
        };
      }, SETUP);
      check(r.open && r.tool, `the surgery screen opens for that fluffy: ${JSON.stringify(r)}`);
      check(r.paused, "the game is paused while it's open");
      check(r.untouched, "nothing is cut yet");
      checkEqual(r.view, "side", "it starts on the side view");
    },
  },
  {
    name: "surgery: front, side (both sides), back and underside each show the right parts",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const colt = __mk(400, { type: "alicorn", gender: "male" });
        openSurgery(colt, new Knife("knife", "INDOORS"));
        const out = {};
        out.front = __found("front");
        out.sideR = __found("side", "right");
        out.sideL = __found("side", "left");
        out.back = __found("back");
        out.under = __found("under");
        const mare = __mk(700, { type: "earthy", gender: "female" });
        openSurgery(mare, new Knife("scalpel", "INDOORS"));
        out.mareUnder = __found("under");
        out.mareFront = __found("front");
        return out;
      }, SETUP);
      const has = (list, ids, what) => check(ids.every((i) => list.includes(i)), `${what}: ${list}`);
      const hasnt = (list, ids, what) => check(ids.every((i) => !list.includes(i)), `${what}: ${list}`);
      has(r.front, ["leftEar", "rightEar", "leftEye", "rightEye", "horn", "leftWing", "rightWing", "leg_1", "leg_2", "body"], "front: face, horn, wings, front legs");
      hasnt(r.front, ["leg_0", "leg_3", "lumps"], "front: no back legs or lumps");
      has(r.sideR, ["rightEar", "rightEye", "rightWing", "leg_1", "leg_0", "tail", "horn"], "right side: its right ear, eye, wing, legs");
      hasnt(r.sideR, ["leftEye"], "right side: not its left eye");
      has(r.sideL, ["leftEar", "leftEye", "leftWing", "leg_2", "leg_3"], "left side: its left ones");
      hasnt(r.sideL, ["rightEye"], "left side: not its right eye");
      has(r.back, ["tail", "leg_0", "leg_3", "lumps", "leftWing", "rightWing"], "back: tail, back legs, lumps, wings");
      has(r.under, ["leg_0", "leg_1", "leg_2", "leg_3", "lumps", "tail", "body"], "underside: all four legs, lumps");
      has(r.mareUnder, ["spay", "udders"], "a mare's underside: womb (spay) and udders");
      hasnt(r.mareUnder.concat(r.mareFront), ["lumps", "horn", "leftWing"], "an earthy mare: no lumps, horn or wings");
    },
  },
  {
    name: "surgery: hover lights a part up; a click asks first - Cancel does nothing, yes cuts it; gone parts can't be picked",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(500, { gender: "male" });
        const watcher = __mk(900);
        openSurgery(f, new Knife("knife", "INDOORS"));
        surgery.view = "front";
        const out = {};
        const spot = __spot("leftEar");
        mouse.x = spot.x;
        mouse.y = spot.y;
        drawSurgery(ctx);
        out.hover = surgery.hover;
        // Click it: a question
        handleSurgeryClick();
        out.asked = isChoiceOpen() && /left ear/.test(choiceDialog.title);
        cancelChoice();
        out.afterCancel = f.limbs.leftEar && isSurgeryOpen();
        handleSurgeryClick();
        const gibsBefore = gibs.length;
        pickChoice(0);
        out.cut = !f.limbs.leftEar;
        out.gib = gibs.length > gibsBefore;
        out.bleeding = f.bleedingTimer > 0;
        out.hurt = f.health < 100;
        out.fear = f.playerFear > 0 && watcher.playerFear > 0;
        out.note = surgery.note;
        out.stillOpen = isSurgeryOpen();
        // Gone: no question
        mouse.x = spot.x;
        mouse.y = spot.y;
        handleSurgeryClick();
        out.goneAsks = isChoiceOpen();
        out.goneDirect = askSurgeryCut("leftEar");
        // The list works too
        const L = surgeryLayout();
        const ids = surgeryListParts(f);
        const row = ids.indexOf("tail");
        mouse.x = L.list.x + 20;
        mouse.y = L.list.y + 30 + row * L.list.rowH + 10;
        handleSurgeryClick();
        out.listAsks = isChoiceOpen() && /tail/.test(choiceDialog.title);
        cancelChoice();
        // Esc closes it
        escapeScreens();
        out.closed = !isSurgeryOpen();
        return out;
      }, SETUP);
      checkEqual(r.hover, "leftEar", "the part under the mouse lights up");
      check(r.asked, "clicking it asks first");
      check(r.afterCancel, "Cancel: nothing happens");
      check(r.cut && r.gib, `yes: it's cut off and falls on the floor: ${JSON.stringify(r)}`);
      check(r.bleeding && r.hurt, `with the knife it bleeds and hurts: ${JSON.stringify(r)}`);
      check(r.fear, "it and a fluffy watching remember");
      check(r.stillOpen && /left ear removed/.test(r.note || ""), `the screen stays open and says what happened: ${r.note}`);
      check(!r.goneAsks && r.goneDirect === false, "a part that's gone can't be picked");
      check(r.listAsks, "picking from the parts list asks too");
      check(r.closed, "Esc closes it");
    },
  },
  {
    name: "surgery: the scalpel cuts clean; spaying and neutering from underneath; an operating table's setting is marked planned",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const mare = __mk(400);
        openSurgery(mare, new Knife("scalpel", "INDOORS"));
        surgeryCut("spay");
        out.spayed = mare.spayed;
        out.noBleed = !(mare.bleedingTimer > 0) && mare.health === 100;
        out.spayGone = !surgeryPartPresent(mare, "spay");
        const colt = __mk(700, { gender: "male" });
        openSurgery(colt, new Knife("scalpel", "INDOORS"));
        surgeryCut("lumps");
        out.neutered = !colt.limbs.lumps;
        // On the operating table set to a part
        const table = new OperatingTable("INDOORS");
        objects.push(table);
        const pony = __mk(1000);
        pony.placedOn = table;
        table.categoryIndex = table.categories.indexOf("BACK LEFT LEG");
        openSurgery(pony, new Knife("knife", "INDOORS"), "torso");
        out.planned = surgery.planned;
        out.view = surgery.view;
        out.side = surgery.side;
        out.visible = __found(surgery.view, surgery.side).includes("leg_3");
        return out;
      }, SETUP);
      check(r.spayed && r.spayGone, "spayed from the underside");
      check(r.noBleed, "the scalpel: no bleeding, no harm to health");
      check(r.neutered, "neutered");
      checkEqual(r.planned, "leg_3", "the table's part is marked planned");
      check(r.visible, `and the view shows it: ${JSON.stringify(r)}`);
    },
  },
  {
    name: "surgery: with the real mouse - click a fluffy with the knife, pick a leg on the chart, say yes",
    run: async (page) => {
      const pos = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(640);
        window.__f = f;
        f.update(1 / 60);
        openSurgery(f, new Knife("knife", "INDOORS"));
        return __spot("leg_1");
      }, SETUP);
      check(pos, "found the leg on the chart");
      await page.mouse.move(pos.x + 2, pos.y + 2);
      await page.mouse.click(pos.x + 2, pos.y + 2);
      const asked = await page.evaluate(() => isChoiceOpen() && choiceDialog.title);
      check(/front right leg/.test(asked || ""), `asked: ${asked}`);
      const btn = await page.evaluate(() => {
        const L = choiceLayout();
        const b = L.buttons[0];
        return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      });
      await page.mouse.click(btn.x, btn.y);
      const r = await page.evaluate(() => ({ leg: __f.limbs.legs[1], open: isSurgeryOpen() }));
      check(r.leg === false && r.open, `the leg's gone and the screen's still open: ${JSON.stringify(r)}`);
      await page.keyboard.press("Escape");
      checkEqual(await page.evaluate(() => isSurgeryOpen()), false, "Esc closes it");
    },
  },
];
