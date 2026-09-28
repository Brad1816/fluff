// Fluffies getting used to alicorns (AlicornAcceptance.js)
const { check, checkEqual } = require("./helpers");

// An alicorn and helpers to make fluffies near it. Only the acceptance
// tick runs (no brains), so nobody moves.
const SETUP = `() => {
  __clearScene();
  __seedRandom(5);
  worldSettings.alicornIntolerance = true;
  const ali = new Horse(1, null, "INDOORS", "alicorn", null, null, null, "male");
  ali.x = 300;
  ali.y = 450;
  fluffies.push(ali);
  let genes = null;
  window.__ali = ali;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ? opts.mum.id : null, "INDOORS", "earthy", genes ? genes.slice() : null, 0.5, 0.5, "female");
    genes = genes || h.genes.slice();
    h.x = x;
    h.y = 450;
    h.hunger = 1;
    h.happiness = 0.7;
    h.adopted = true;
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
  window.__tick = (seconds) => {
    for (let i = 0; i < seconds; i++) {
      _alicornTick = 0;
      updateAlicornAcceptance(0); // one 1-second tick
    }
  };
}`;

module.exports = [
  {
    name: "alicorns: time near a calm alicorn slowly turns fear into acceptance",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(650);
        const start = { c: getAlicornComfort(f), range: alicornFearRange(f), row: describeAlicornFeeling(f)[0] };
        __tick(600);
        const early = getAlicornComfort(f);
        __tick(2400);
        const mid = { c: getAlicornComfort(f), range: alicornFearRange(f), row: describeAlicornFeeling(f)[0] };
        let t = 3000;
        while (!f.tolerantOfAlicorns() && t < 60000) {
          __tick(500);
          t += 500;
        }
        const far = __mk(1200); // too far away to see it
        __tick(300);
        return {
          start,
          early,
          mid,
          t,
          tolerant: f.tolerantOfAlicorns(),
          row: describeAlicornFeeling(f)[0],
          msg: uiMessages.some((m) => /isn't scared of alicorns/.test(m.text || m)),
          far: getAlicornComfort(far),
          aliRow: describeAlicornFeeling(__ali),
        };
      }, SETUP);
      checkEqual(r.start.c, 0, "starts afraid");
      checkEqual(r.start.row, "Afraid", "row at start");
      check(r.early < 0.1, `hardly any change after 10 minutes: ${r.early}`);
      check(r.mid.c > 0.15 && r.mid.c < 0.4, `comfort after 50 minutes ${r.mid.c}`);
      check(r.mid.range < r.start.range, `fear range shrinks ${r.start.range} -> ${r.mid.range}`);
      check(/Getting used to them \(\d+%\)/.test(r.mid.row), r.mid.row);
      check(r.tolerant, "should accept alicorns in the end");
      check(r.t >= 8000 && r.t <= 25000, `took ${r.t} seconds (about 10 game days of seeing it)`);
      checkEqual(r.row, "Accepts them", "row at the end");
      check(r.msg, "should tell you");
      checkEqual(r.far, 0, "too far away to learn");
      checkEqual(r.aliRow, null, "no row for the alicorn itself");
    },
  },
  {
    name: "alicorns: friends who accept them, foals and cages speed it up; smarties are slow",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const alone = __mk(650);
        const withFriend = __mk(640);
        const friend = __mk(660);
        friend.alicornTolerance = true;
        setRelationship(withFriend.id, friend.id, "friend");
        setRelationship(friend.id, withFriend.id, "friend");
        const foal = __mk(630, { growth: 0.2 });
        const smarty = __mk(620);
        smarty.gender = "male"; // only stallions can be smarties
        smarty.personalities = ["smarty"];
        const rate = (f) => alicornAcceptanceRate(f, __ali);
        const base = rate(alone);
        const out = { base, friend: rate(withFriend), foal: rate(foal), smarty: rate(smarty) };
        __ali.currentCage = {}; // pretend it's caged
        out.caged = rate(alone);
        __ali.currentCage = null;
        return out;
      }, SETUP);
      check(r.friend > r.base * 1.2 && r.friend < r.base * 1.6, `friend ${r.friend} vs ${r.base}`);
      check(r.caged > r.base * 1.15 && r.caged < r.base * 1.3, `caged ${r.caged} vs ${r.base}`);
      check(r.smarty < r.base * 0.2, `smarty ${r.smarty} vs ${r.base}`);
      check(r.foal > r.base * 1.8 && r.foal < r.base * 2.5, `foal ${r.foal} vs ${r.base}`);
    },
  },
  {
    name: "alicorns: holding a trusting fluffy close introduces them; attacks set them back",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const held = __mk(420);
        held.isDragging = true;
        held.playerTrust = 0.8;
        const wary = __mk(430);
        wary.isDragging = true;
        wary.playerTrust = 0.6; // not enough
        __tick(900);
        const out = { held: getAlicornComfort(held), wary: getAlicornComfort(wary) };
        held.isDragging = wary.isDragging = false;
        // Kept apart, it forgets
        const forgetful = __mk(420);
        forgetful.alicornComfort = 0.5;
        forgetful.x = 1250; // out of sight
        __tick(1500);
        out.forgot = forgetful.alicornComfort;
        // An alicorn attack: the victim loses a lot, one watching a little
        const victim = __mk(350);
        const watcher = __mk(420);
        victim.alicornComfort = 0.6;
        watcher.alicornComfort = 0.6;
        victim.wasAttackedBy(__ali);
        out.victim = victim.alicornComfort;
        out.watcher = watcher.alicornComfort;
        // Saved with the fluffy
        const copy = Horse.deserialize(JSON.parse(JSON.stringify(watcher.serialize())));
        out.saved = copy.alicornComfort;
        fluffies.splice(fluffies.indexOf(copy), 1);
        return out;
      }, SETUP);
      check(r.held >= 0.5 && r.held < 0.75, `held close for 15 minutes ${r.held}`);
      check(r.wary < 0.15, `a fluffy that doesn't trust you enough gets no introduction ${r.wary}`);
      check(Math.abs(r.forgot - 0.25) < 0.01, `forgets when kept apart ${r.forgot}`);
      check(Math.abs(r.victim - 0.1) < 0.01, `victim ${r.victim}`);
      check(Math.abs(r.watcher - 0.4) < 0.01, `watcher ${r.watcher}`);
      check(Math.abs(r.saved - r.watcher) < 1e-9, `saved ${r.saved}`);
    },
  },
  {
    name: "alicorns: a mum gets used to her alicorn foal and takes it back",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        fluffies.splice(fluffies.indexOf(__ali), 1);
        const mum = __mk(400);
        const foal = new Horse(0.1, mum.id, "INDOORS", "alicorn", null, null, null, "female");
        foal.x = 450;
        foal.y = 450;
        fluffies.push(foal);
        const before = relationships[mum.id][foal.id];
        let t = 0;
        while (!mum.tolerantOfAlicorns() && t < 30000) {
          __tick(500);
          t += 500;
        }
        return { before, after: relationships[mum.id][foal.id], t, tolerant: mum.tolerantOfAlicorns() };
      }, SETUP);
      checkEqual(r.before, "estranged_child", "turned away at first");
      check(r.tolerant && r.t >= 3000 && r.t <= 12000, `mum accepted after ${r.t}s`);
      checkEqual(r.after, "baby_child", "her baby again");
    },
  },
  {
    name: "alicorns: nothing changes with alicorn intolerance off",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        worldSettings.alicornIntolerance = false;
        const f = __mk(600);
        __tick(300);
        const out = { c: f.alicornComfort, row: describeAlicornFeeling(f) };
        worldSettings.alicornIntolerance = true;
        return out;
      }, SETUP);
      checkEqual(r.c, 0, "comfort");
      checkEqual(r.row, null, "no row");
    },
  },
];
