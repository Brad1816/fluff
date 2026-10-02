// Foster mums: a wild mare who lost her own, or a gentle one nursing her
// own, may take in a wild orphan near her (Fostering.js).
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS"]) __clearScene(s);
  __seedRandom(17);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 4 * DAY_LENGTH;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, null, opts.scene ?? "OUTDOORS", "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? false;
    h.x = x;
    h.y = opts.y ?? 500;
    h.hunger = 1;
    h.health = 100;
    h.happiness = 0.7;
    h.coloristDegree = 0;
    h.currentStateKey = "IDLE";
    h.brain.think = () => {};
    if (opts.temper !== undefined) h.traitShift = { temper: opts.temper - traitValue(h, "temper") };
    fluffies.push(h);
    return h;
  };
  // An orphan: its mum's gone
  window.__orphan = (x, opts = {}) => {
    const f = __mk(x, { growth: opts.growth ?? 0.05, gender: "male", ...opts });
    f.motherId = 9999;
    f.hunger = 0.5;
    return f;
  };
  // Run the world (just fostering, and walking) for some game seconds
  window.__run = (secs, movers = []) => {
    for (let t = 0; t < secs; t += 0.5) {
      timePlayed += 0.5;
      for (const m of movers) {
        m.hunger = 1; // (kept fed: this is about fostering, not hunger)
        m.update(0.5);
      }
      updateFostering(0.5);
    }
  };
}`;

module.exports = [
  {
    name: "fostering: a wild mare who lost her foal walks over to an orphan nearby and takes it in - its mum now, her milk comes back",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mare = __mk(300);
        const friend = __mk(150, { gender: "male" });
        setRelationship(mare.id, friend.id, "special_friend");
        setRelationship(friend.id, mare.id, "special_friend");
        // Her foal dies
        const own = __mk(320, { growth: 0.05 });
        own.motherId = mare.id;
        setRelationship(mare.id, own.id, "baby_child");
        own.die(null, "Starved");
        const out = { lost: mare.lostFoalAt === timePlayed, reason: fosterMumReason(mare) };
        mare.lactatingTimer = 0; // (her milk has dried up)
        const orphan = __orphan(560);
        // (until she's taken it in, then a look at her milk)
        for (let s = 0; s < 30 * 60 && orphan.motherId !== mare.id; s += 5) __run(5, [mare]);
        const need = (FOSTER_MAX_GROWTH - orphan.growth) * GROW_UP_TIME;
        out.milkNow = mare.lactatingTimer >= need && mare.milkCharges > 0;
        out.mum = orphan.motherId === mare.id;
        out.rel = relationships[mare.id][orphan.id];
        out.dad = relationships[orphan.id][friend.id];
        out.foster = orphan.fosterMumId === mare.id;
        out.story = storyOf(orphan).some((e) => e.k === "fostered") && storyOf(mare).some((e) => e.k === "fostered");
        out.text = storyEventText(storyOf(orphan).find((e) => e.k === "fostered"));
        out.describe = describeFoster(orphan);
        out.grieving = fosterMumReason(mare);
        // A newborn rides on her back now (Carrying.js)
        mare.hunger = 1; // (hours of walking about in the test: fed)
        mare.updateCrawling();
        orphan.x = mare.x + 20;
        orphan.y = mare.y;
        updateRiding(orphan);
        out.rides = orphan._riding === mare;
        return out;
      }, SETUP);
      check(r.lost && r.reason === "grieving", `losing her foal makes her a grieving mum: ${JSON.stringify(r)}`);
      check(r.mum && r.rel === "baby_child" && r.foster, `she takes the orphan in: ${JSON.stringify(r)}`);
      checkEqual(r.dad, "father", "her special friend is its dad now");
      check(r.milkNow, "her milk comes back for it, and lasts till it's weaned");
      check(r.story && /taken in by/.test(r.text || ""), `in both their stories: ${r.text}`);
      check(r.describe && /Taken in by/.test(r.describe[0]), "the magnifying glass shows it");
      checkEqual(r.grieving, null, "she isn't looking for another (she has one now)");
      check(r.rides, "the newborn rides on her back");
    },
  },
  {
    name: "fostering: a gentle mum nursing her own may take one in; a grumpy one or one with no foals doesn't; not out of range, not yours, not a colour she rejects",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        // Gentle, nursing
        const kind = __mk(300, { temper: -0.6 });
        kind.lactatingTimer = 100000; // (nursing all through the test)
        kind.milkCharges = 5;
        const own = __mk(320, { growth: 0.05 });
        own.motherId = kind.id;
        setRelationship(kind.id, own.id, "baby_child");
        out.kindReason = fosterMumReason(kind);
        // Grumpy, nursing
        const grump = __mk(800, { temper: 0.6 });
        grump.lactatingTimer = 500;
        const g1 = __mk(820, { growth: 0.05 });
        g1.motherId = grump.id;
        setRelationship(grump.id, g1.id, "baby_child");
        out.grumpReason = fosterMumReason(grump);
        // Gentle, no foals
        const lonely = __mk(1100, { temper: -0.6 });
        out.lonelyReason = fosterMumReason(lonely);
        // Orphans: one in range, one far off, one that's yours
        const near = __orphan(460);
        const far = __orphan(1900);
        const yours = __orphan(420, { adopted: true });
        out.canNear = canFoster(kind, near);
        out.canFar = canFoster(kind, far);
        out.canYours = canFoster(kind, yours);
        // A colour-proud mum and a "poopie" foal
        const proud = __mk(400, { temper: -0.6 });
        proud.lostFoalAt = timePlayed;
        const real = window.mumRejectsFoalColour;
        window.mumRejectsFoalColour = (m, f) => m === proud;
        out.canProud = canFoster(proud, near);
        window.mumRejectsFoalColour = real;
        // A tame mare (yours) never fosters
        const tame = __mk(450, { adopted: true });
        tame.lostFoalAt = timePlayed;
        out.tameReason = fosterMumReason(tame);
        // Grief wears off after a few days
        const old = __mk(500);
        old.lostFoalAt = timePlayed - (FOSTER_GRIEF_DAYS + 0.5) * DAY_LENGTH;
        out.oldReason = fosterMumReason(old);
        // Run: the kind mum takes the near one in, nobody takes yours
        for (const f of [grump, lonely, proud, tame, old]) f.scene = "INDOORS";
        __run(40 * 60, [kind]);
        out.nearTaken = near.motherId === kind.id;
        out.yoursLeft = yours.motherId === 9999;
        out.farLeft = far.motherId === 9999;
        out.siblings = relationships[near.id][own.id];
        return out;
      }, SETUP);
      checkEqual(r.kindReason, "kind", "a gentle mum nursing her own");
      checkEqual(r.grumpReason, null, "a grumpy mum: no");
      checkEqual(r.lonelyReason, null, "gentle but no foals (and none lost): no");
      check(r.canNear && !r.canFar, `only one in range: ${JSON.stringify(r)}`);
      check(!r.canYours, "not one of yours");
      check(!r.canProud, "not a foal she'd reject for its colour");
      checkEqual(r.tameReason, null, "your mares don't go fostering");
      checkEqual(r.oldReason, null, "grief wears off after a few days");
      check(r.nearTaken && r.yoursLeft && r.farLeft, `the near orphan is taken in, the others aren't: ${JSON.stringify(r)}`);
      checkEqual(r.siblings, "sister", "her own foal (a filly) is its sister now");
    },
  },
  {
    name: "fostering: it's only now and then - over a game hour a grieving mum near an orphan usually, but not always, goes to it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        let went = 0;
        const n = 40;
        for (let i = 0; i < n; i++) {
          for (const s of ["OUTDOORS"]) __clearScene(s);
          const mare = __mk(300);
          mare.lostFoalAt = timePlayed;
          mare.lactatingTimer = 300;
          __orphan(500);
          for (let t = 0; t < HOUR_LENGTH; t += FOSTER_EVERY) {
            timePlayed += FOSTER_EVERY;
            updateFostering(FOSTER_EVERY);
          }
          if (mare._fostering) went++;
        }
        return { rate: went / n, expected: FOSTER_CHANCE_GRIEVING };
      }, SETUP);
      check(r.rate > 0.25 && r.rate < 0.8, `about half the time in a game hour: ${JSON.stringify(r)}`);
    },
  },
];
