// Fears (Fears.js): thunder, the dark, the Fluff-Bot; comfort, night lights
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(55);
  if (typeof closeTrickUI === "function") closeTrickUI();
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH;
  // brave: 1 (all brave genes), -1 (all timid), 0 (middle)
  window.__mk = (x, brave = 0, growth = 1, motherId = null) => {
    const h = new Horse(growth, motherId, "INDOORS", "earthy", null, 0.5, 0.5, "female");
    const i = TRAITS.findIndex((q) => q.key === "bravery");
    for (let k = 0; k < TRAIT_GENES_EACH; k++) {
      h.genes[TRAIT_GENE_START + i * TRAIT_GENES_EACH + k] = brave > 0 ? 1 : brave < 0 ? 0 : k < TRAIT_GENES_EACH / 2 ? 1 : 0;
    }
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.warmth = 1;
    h.happiness = 0.8;
    h.playerTrust = 0.8;
    h.playerFear = 0;
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
  window.__realNight = window.__realNight || window.nightAmount;
}`;
const TEARDOWN = () => {
  if (window.__realNight) window.nightAmount = window.__realNight;
};

module.exports = [
  {
    name: "fears: timid fluffies are scared of more; thunder frightens them; a cuddle helps, crying alone makes it worse",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const count = (brave) => {
          let n = 0;
          for (let i = 0; i < 60; i++) {
            const f = __mk(100, brave);
            n += realFears(f).length;
            fluffies.splice(fluffies.indexOf(f), 1);
          }
          return n;
        };
        const out = { timid: count(-1), brave: count(1) };
        // Thunder: indoors only strong fears; outside any
        const mild = __mk(300);
        mild.fears = { thunder: 0.25, dark: 0, bot: 0 };
        const bad = __mk(500);
        bad.fears = { thunder: 0.9, dark: 0, bot: 0 };
        bad.currentStateKey = "SLEEPING";
        onThunder();
        out.indoor = [isFrightened(mild), isFrightened(bad)];
        out.wokeUp = bad.currentStateKey !== "SLEEPING";
        out.row = describeFright(bad);
        // A cuddle
        const before = fearOf(bad, "thunder");
        onFluffyPickedUp(bad);
        out.cuddled = [isFrightened(bad), fearOf(bad, "thunder") - before];
        // Left alone to cry it out
        startFright(mild, "thunder");
        const m0 = fearOf(mild, "thunder");
        for (let s = 0; s < 60 && isFrightened(mild); s++) {
          timePlayed += 1;
          updateFears(1);
        }
        out.alone = [isFrightened(mild), fearOf(mild, "thunder") - m0];
        // Brushing works too
        startFright(mild, "thunder");
        onFluffyBrushed(mild);
        out.brushed = isFrightened(mild);
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      check(r.timid > r.brave * 2, `timid fluffies have more fears ${r.timid} vs ${r.brave}`);
      checkEqual(JSON.stringify(r.indoor), JSON.stringify([false, true]), "indoors only a strong fear of thunder counts");
      check(r.wokeUp, "thunder wakes a scared fluffy");
      check(r.row && /Thunder - cuddle/.test(r.row[0]) && r.row[1] === "bad", `shown ${r.row}`);
      checkEqual(r.cuddled[0], false, "a cuddle ends the fright");
      check(r.cuddled[1] < -0.05, `and shrinks the fear ${r.cuddled[1]}`);
      checkEqual(r.alone[0], false, "a fright wears off");
      check(r.alone[1] > 0.01, `crying alone makes it worse ${r.alone[1]}`);
      checkEqual(r.brushed, false, "brushing comforts too");
    },
  },
  {
    name: "fears: the dark frightens at night unless there's a night light; the Fluff-Bot; mum calms her foal",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        window.nightAmount = () => 1;
        const f = __mk(300);
        f.fears = { thunder: 0, dark: 0.9, bot: 0 };
        let frights = 0;
        for (let s = 0; s < 1200; s++) {
          timePlayed += 1;
          updateFears(1);
          if (isFrightened(f)) {
            frights++;
            f.fright = null;
          }
        }
        const out = { dark: frights };
        // Night light
        const lamp = new NightLight("INDOORS");
        lamp.setPosition(600, 520);
        objects.push(lamp);
        frights = 0;
        for (let s = 0; s < 1200; s++) {
          timePlayed += 1;
          updateFears(1);
          if (isFrightened(f)) {
            frights++;
            f.fright = null;
          }
        }
        out.lit = frights;
        out.saved = JSON.stringify(lamp.serialize());
        lamp.on = false;
        out.off = isDarkFor(f);
        window.nightAmount = window.__realNight;
        // Fluff-Bot: a brave fluffy scared of it still gets a fright
        const g = __mk(700, 1);
        g.fears = { thunder: 0, dark: 0, bot: 0.8 };
        const bot = new Roomba("INDOORS");
        bot.setPosition(720, 520);
        out.bump = reactToRoomba(g, bot);
        // A foal runs to mum; with mum next to it, it calms twice as fast
        const mum = __mk(200);
        mum.fears = { thunder: 0, dark: 0, bot: 0 };
        const foal = __mk(900, 0, 0.5, mum.id);
        foal.fears = { thunder: 0.8, dark: 0, bot: 0 };
        startFright(foal, "thunder");
        out.comforter = frightComforter(foal) === mum;
        const d = new FrightDesire();
        out.score = d.evaluate(foal);
        d.execute(foal);
        out.ran = [foal.currentStateKey, foal.targetX !== undefined ? Math.round(Math.abs(foal.targetX - mum.x)) : null];
        foal.x = mum.x + 40;
        foal.y = mum.y;
        const until = foal.fright.until;
        timePlayed += 1;
        updateFears(1);
        out.faster = until - (foal.fright ? foal.fright.until : 0);
        // No one about: cowers
        const lonely = __mk(1200);
        lonely.fears = { thunder: 0.8, dark: 0, bot: 0 };
        lonely.scene = "BACKYARD";
        startFright(lonely, "thunder");
        new FrightDesire().execute(lonely);
        out.cower = lonely.currentStateKey;
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      check(r.dark >= 1, `frightened in the dark (${r.dark} times in an hour)`);
      checkEqual(r.lit, 0, "not with a night light on");
      check(/NightLight/.test(r.saved), "night light saves");
      checkEqual(r.off, true, "switched off: dark again");
      checkEqual(r.bump, "frightened", "a Fluff-Bot bump frightens one scared of it, however brave");
      check(r.comforter, "a foal's comforter is mum");
      check(r.score > 70, `fright beats wandering and tricks ${r.score}`);
      check(/MOVING|RUNNING/.test(r.ran[0]), `runs to mum ${r.ran}`);
      check(r.faster >= 1, `mum close by calms it faster ${r.faster}`);
      checkEqual(r.cower, "LYING", "on its own it cowers");
    },
  },
  {
    name: "fears: the Brave lesson shrinks them; foals pick up mum's fears; shown in the magnifying glass",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(300);
        f.fears = { thunder: 0.5, dark: 0.3, bot: 0 };
        const out = { applies: lessonsFor(f).map((l) => l.key).includes("brave"), row: describeFears(f) };
        window.__realLC = window.__realLC || window.lessonChance;
        window.lessonChance = () => 1;
        giveLesson(f, "brave");
        out.after = [fearOf(f, "thunder"), fearOf(f, "dark"), fearOf(f, "bot")];
        for (let d = 0; d < 5; d++) {
          timePlayed += DAY_LENGTH;
          for (let i = 0; i < 3; i++) giveLesson(f, "brave");
        }
        window.lessonChance = window.__realLC;
        out.cured = [realFears(f).length, lessonsFor(f).map((l) => l.key).includes("brave"), describeFears(f)];
        // Upbringing
        const mum = __mk(600);
        mum.fears = { thunder: 1, dark: 0, bot: 0 };
        const foal = __mk(650, 0, 0.3, mum.id);
        foal.fears = { thunder: 0, dark: 0, bot: 0 };
        for (let s = 0; s < 1680; s++) applyUpbringing(foal, 1);
        out.foal = fearOf(foal, "thunder");
        // Magnifying glass draws with a frightened fluffy
        startFright(mum, "thunder");
        inspectedFluffy = mum;
        let err = null;
        try {
          for (const t of ["overview", "looks"]) {
            inspectionTab = t;
            drawInspectionModal(ctx);
          }
        } catch (e) {
          err = String(e);
        }
        inspectedFluffy = null;
        out.err = err;
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      check(r.applies, "Brave lesson offered");
      check(/Thunder \(scared\)/.test(r.row[0]) && /dark \(a bit\)/.test(r.row[0]), `fears row ${r.row}`);
      check(Math.abs(r.after[0] - 0.44) < 0.001 && Math.abs(r.after[1] - 0.24) < 0.001 && r.after[2] === 0, `each fear down ${r.after}`);
      checkEqual(r.cured[0], 0, "not scared any more");
      checkEqual(r.cured[1], false, "no more Brave lessons");
      checkEqual(r.cured[2][1], "good", "row says so");
      check(r.foal > 0.7, `a foal raised by a mum terrified of thunder is scared too ${r.foal}`);
      checkEqual(r.err, null, "magnifying glass draws");
    },
  },
];
