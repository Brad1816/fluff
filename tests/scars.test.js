// Scars (Scars.js): serious injuries leave lasting marks
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(55);
  storyBook = freshStoryBook();
  _storyIndex = null;
  roomClimate = freshRoomClimate();
  window.__mk = (x, gender = "female") => {
    const h = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, gender);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.health = 100;
    h.brain.think = () => {};
    h.wishCooldownUntil = 1e12;
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "scars: a bloody fight or your knife can leave a scar - it says how, goes in its story, never more than 5",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __mk(300, "male");
        fluffyNames[a.id] = "Snowball";
        const b = __mk(360);
        const real = Math.random;
        Math.random = () => 0.01; // draws blood, scars, a bite
        a.performAttack(b, "GRUDGE");
        Math.random = real;
        out.fight = scarsOf(b).map((s) => [s.kind, s.how]);
        out.story = storyOf(b).filter((e) => e.k === "scar").map((e) => e.x);
        // A bully's shove never does
        const c = __mk(420);
        Math.random = () => 0.01;
        a.performAttack(c, "BULLY");
        Math.random = real;
        out.shove = scarsOf(c).length;
        // Your knife
        Math.random = () => 0.01;
        notePlayerViolence(c, false, "knife", false, false);
        // ...but not the sorry stick in training
        const d = __mk(480);
        notePlayerViolence(d, false, "stick", true, false);
        Math.random = real;
        out.knife = scarsOf(c).map((s) => s.how);
        out.training = scarsOf(d).length;
        for (let i = 0; i < 10; i++) addScar(c, "flank", "Test");
        out.max = scarsOf(c).length;
        out.line = describeScars(c);
        out.owie = fluffyCallsOther(a, c);
        return out;
      }, SETUP);
      checkEqual(r.fight.length, 1, "one scar");
      checkEqual(r.fight[0][0], "ear", "a bite tears an ear");
      check(/^Bitten by Snowball in a fight on day \d+$/.test(r.fight[0][1]), `how: ${r.fight[0][1]}`);
      check(r.story.some((s) => /^torn ear: bitten by Snowball/.test(s)), `story ${r.story}`);
      checkEqual(r.shove, 0, "a shove doesn't scar");
      check(r.knife.length === 1 && /^Cut with the knife on day \d+$/.test(r.knife[0]), `knife ${r.knife}`);
      checkEqual(r.training, 0, "training doesn't scar");
      checkEqual(r.max, 5, "at most 5");
      check(r.line && r.line[2].length === 5 && /: Cut with the knife/.test(r.line[2][0]), `hover lines ${r.line && r.line[2]}`);
      check(/owie/.test(r.owie), `the others call it owie: ${r.owie}`);
    },
  },
  {
    name: "scars: cost it at shows and in price; drawn on the body; the magnifying glass shows them with how on hover",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400);
        const theme = SHOW_THEMES[0];
        const s0 = showScore(f, theme);
        const p0 = f.genetics.calculatePrice ? f.genetics.calculatePrice() : null;
        for (const k of ["ear", "flank", "bald", "tail", "muzzle"]) addScar(f, k, "Test " + k);
        const out = { show: s0 - showScore(f, theme), price: scarPriceMultiplier(f), comment: showComment(f, theme) };
        let err = null;
        try {
          f.facingRight = true;
          f.draw(ctx);
          f.facingRight = false;
          f.draw(ctx);
          inspectedFluffy = f;
          inspectionTab = "looks";
          drawInspectionModal(ctx);
        } catch (e) {
          err = String(e && e.stack);
        }
        out.err = err;
        const tabs = getInspectionTabs(f);
        const row = tabs.tabs.find((t) => t.id === "looks").cols[0].rows.find((x) => x.label === "Scars");
        out.row = row && [row.value, row.tip.length];
        return out;
      }, SETUP);
      check(r.show >= 12 && r.show <= 16, `a show costs ${r.show}`);
      checkEqual(r.price, 0.8, "price at most -20%");
      check(/badly scarred/.test(r.comment), `judges ${r.comment}`);
      checkEqual(r.err, null, "draws");
      check(r.row && /^Torn ear, scarred flank, bald patch/.test(r.row[0]) && r.row[1] === 5, `row ${r.row}`);
    },
  },
];
