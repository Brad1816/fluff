// Lore round: seasons known, longer lives, big litters, two at the teat,
// out of breath, bad smarties desert, the simple don't know death
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD", "PARK"]) __clearScene(s);
  __seedRandom(777);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 6 * DAY_LENGTH + 10 * HOUR_LENGTH;
  herdState = freshHerdState();
  _herdChanged();
  herdWars = [];
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.makeType(opts.type ?? "earthy");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    if (opts.smarty) { h.personalities = [...h.personalities, "smarty"]; h.smartyKind = opts.smarty; }
    // (wits set so smartsOf comes out right: earthy 0 + half its wits)
    const shift = (k, v) => {
      const now = traitValue(h, k) - ((h.traitShift && h.traitShift[k]) || 0);
      h.traitShift = { ...(h.traitShift || {}), [k]: v - now };
    };
    if (typeof opts.smarts === "number") shift("wits", 2 * opts.smarts);
    if (typeof opts.brave === "number") shift("bravery", opts.brave);
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 520;
    h.hunger = opts.hunger ?? 1;
    h.health = 100;
    h.happiness = 0.7;
    h.currentStateKey = "IDLE";
    if (opts.think !== true) h.brain.think = () => {};
    fluffies.push(h);
    return h;
  };
  window.__herd = (list, leader = list[0]) => {
    for (const a of list) for (const b of list) if (a !== b) { meet(a, b); changeOpinion(a, b, 0.9, "test"); }
    const h = { id: herdState.nextId++, name: "Test", leaderId: leader.id, memberIds: list.map((f) => f.id), colorIndex: 0, formedAt: timePlayed };
    herdState.list.push(h);
    _herdChanged();
    return h;
  };
}`;

module.exports = [
  {
    name: "lore: the hot-times are known once lived through, by the old and by the clever; lives run to 8 years",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const young = __mk(300, { smarts: 0 });
        young.age = 3 * DAY_LENGTH;
        const old = __mk(400, { smarts: 0 });
        old.age = 20 * DAY_LENGTH;
        const clever = __mk(500, { smarts: 0.5 });
        clever.age = 3 * DAY_LENGTH;
        const out = { before: [young, old, clever].map((f) => knowsSeason(f, "Summer"))};
        young.seasonDays = { Summer: 2 };
        out.after = knowsSeason(young, "Summer");
        out.life = [SENIOR_DAYS, ELDERLY_DAYS, OLD_AGE_RISK_DAYS, MAX_AGE_DAYS];
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.before), JSON.stringify([false, true, true]), "who knows summer");
      check(r.after, "lived through two days of it: knows it");
      checkEqual(JSON.stringify(r.life), JSON.stringify([48, 72, 78, 96]), "lifespans");
    },
  },
  {
    name: "lore: litters up to 10, and the bigger the litter the likelier a miscarriage",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mare = __mk(300);
        const sire = __mk(400, { gender: "male" });
        mare.litterBorn = 10;
        sire.litterBorn = 10;
        let max = 0;
        for (let i = 0; i < 3000; i++) max = Math.max(max, plannedLitterSize(mare, sire));
        const chance = (n) => {
          mare.babiesToBirth = n;
          mare.pregCare = { sum: 0.7, n: 1 };
          return +bigLitterMiscarriageChance(mare).toFixed(3);
        };
        const out = { max, chances: [chance(3), chance(4), chance(6), chance(10)] };
        // Over a whole pregnancy, a litter of 10 miscarries about a third of the time
        let lost = 0;
        const runs = 200;
        for (let k = 0; k < runs; k++) {
          mare.isPregnant = true;
          mare.babiesToBirth = 10;
          mare.pregnancyTimer = pregnancyDuration;
          mare.miscarriageTimer = null;
          mare.pregCare = { sum: 0, n: 0 };
          for (let t = 0; t < pregnancyDuration; t += PREG_CARE_EVERY) {
            mare.pregCare.sum += 0.7;
            mare.pregCare.n += 1;
            pregnancyCareTicker.fireNext();
            updatePregnancyCare(0);
            if (mare.miscarriageTimer !== null && mare.miscarriageTimer !== undefined) {
              lost++;
              break;
            }
          }
        }
        out.lost = lost / runs;
        mare.isPregnant = false;
        return out;
      }, SETUP);
      checkEqual(r.max, 10, "big-litter lines reach 10, never more");
      checkEqual(r.chances[0], 0, "3: no extra risk");
      checkEqual(r.chances[1], 0, "4: no extra risk");
      check(r.chances[2] > 0.08 && r.chances[2] < 0.14, `6: about 11% (${r.chances[2]})`);
      check(r.chances[3] > r.chances[2] && r.chances[3] < 0.4, `10: about a third (${r.chances[3]})`);
      check(r.lost > 0.2 && r.lost < 0.5, `10-foal pregnancies lost: ${r.lost}`);
    },
  },
  {
    name: "lore: only two foals drink from a mare at a time",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(400);
        mum.lactatingTimer = 500;
        mum.milkCharges = 10;
        mum.happiness = 0.8;
        const kids = [0, 1, 2].map((i) => {
          const k = __mk(380 + i * 10, { growth: 0.2, mum: mum });
          k.motherId = mum.id;
          setRelationship(mum.id, k.id, "baby_child");
          setRelationship(k.id, mum.id, "mother");
          k.hunger = 0.2;
          return k;
        });
        window.__realReject = window.mumRejectsFoalColour;
        mumRejectsFoalColour = () => false;
        const fed = kids.map((k) => k.attemptFeedFromMare(mum));
        const thirdWaits = kids[2].milkCooldown > 0;
        timePlayed += NURSE_TIME + 0.5;
        kids[2].milkCooldown = 0;
        const later = kids[2].attemptFeedFromMare(mum);
        mumRejectsFoalColour = window.__realReject;
        return { fed, thirdWaits, later, nursing: nursingCount(mum) };
      }, SETUP);
      checkEqual(JSON.stringify(r.fed), JSON.stringify([true, true, false]), "two drink, the third waits");
      check(r.thirdWaits, "it waits a moment");
      check(r.later, "its turn comes");
      checkEqual(r.nursing, 1, "one at the teat now");
    },
  },
  {
    name: "lore: running wears a fluffy out - it can only walk until it gets its breath back",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(300);
        f.initBehavior("RUNNING");
        f.currentStateKey = "RUNNING";
        f.updateSpeed();
        const fresh = f.speed;
        let t = 0;
        while (!isWinded(f) && t < 30) {
          staminaTicker.fireNext();
          updateStamina(0);
          timePlayed += STAMINA_EVERY;
          f.currentStateKey = "RUNNING";
          t += STAMINA_EVERY;
        }
        f.updateSpeed();
        const winded = f.speed;
        timePlayed += WINDED_TIME + 0.1;
        f.updateSpeed();
        return { fresh, winded, t, after: f.speed, said: !!(f.speech && f.speech.text) };
      }, SETUP);
      check(r.t >= 5 && r.t <= 9, `ran about 7 seconds before tiring: ${r.t}`);
      check(r.winded < r.fresh * 0.6, `winded: a walk (${r.winded} vs ${r.fresh})`);
      checkEqual(r.after, r.fresh, "breath back, running again");
      check(r.said, "it pants");
    },
  },
  {
    name: "lore: a bad smarty deserts a herd that's losing a war or meets a fox; a good one stays",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const boss = __mk(300, { gender: "male", smarty: "bad", adopted: false, scene: "PARK" });
        const mates = [__mk(340, { adopted: false, scene: "PARK", brave: 0 }), __mk(380, { adopted: false, scene: "PARK", brave: 0 })];
        const h = __herd([boss, ...mates], boss);
        const enemies = [0, 1, 2, 3].map((i) => __mk(600 + i * 20, { gender: "male", adopted: false, scene: "PARK", brave: 0.5 }));
        const e = __herd(enemies);
        startHerdWar(h, e);
        out.reason = desertReason(boss, h);
        for (let i = 0; i < 40 && herdOf(boss); i++) {
          desertionTicker.fireNext();
          updateDesertion(0);
        }
        out.gone = !herdOf(boss);
        out.opinion = getOpinion(mates[0], boss) < 0.6;
        herdState.list = herdState.list.filter((x) => x !== e);
        herdWars = [];
        updateHerds(HERD_UPDATE_EVERY);
        out.newLeader = h.leaderId !== boss.id && mates.some((m) => m.id === h.leaderId);
        out.cantRejoin = _recentlyLeft(boss, h);
        // A good smarty in a losing war stays
        const good = __mk(320, { gender: "male", smarty: "good", adopted: false, scene: "PARK" });
        const h2 = __herd([good, __mk(360, { adopted: false, scene: "PARK" })], good);
        out.goodReason = desertReason(good, h2);
        // A fox: a bad smarty runs and isn't a hero
        const b2 = __mk(500, { gender: "male", smarty: "bad", adopted: false, scene: "PARK" });
        const h3 = __herd([b2, __mk(520, { adopted: false, scene: "PARK" }), __mk(540, { adopted: false, scene: "PARK" })], b2);
        let ran = 0;
        let left = 0;
        for (let i = 0; i < 20; i++) {
          if (!herdOf(b2)) { h3.memberIds.push(b2.id); _herdChanged(); b2._leftHerd = null; }
          if (badSmartyFleesFox(b2)) ran++;
          if (!herdOf(b2)) left++;
        }
        out.fox = [ran, left];
        return out;
      }, SETUP);
      checkEqual(r.reason, "war", "losing the war");
      check(r.gone, "the bad smarty ran off");
      check(r.opinion, "its herd thinks less of it");
      check(r.newLeader, "the herd picks a new leader");
      check(r.cantRejoin, "and won't have it back for a while");
      checkEqual(r.goodReason, null, "a good smarty doesn't desert");
      checkEqual(r.fox[0], 20, "always runs from a fox");
      check(r.fox[1] >= 4 && r.fox[1] <= 16, `often leaves the herd to it: ${r.fox[1]}/20`);
    },
  },
  {
    name: "lore: the young and the simple think a body is asleep; the clever know - even as foals",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const body = __mk(400);
        body.anatomy.die(null, "Starved");
        const foal = __mk(300, { growth: 0.3, smarts: 0 });
        const cleverFoal = __mk(320, { growth: 0.3, smarts: 0.5 });
        const dim = __mk(340, { smarts: -0.5 });
        const normal = __mk(360, { smarts: 0 });
        const out = { mistakes: [foal, cleverFoal, dim, normal].map((f) => mistakesBodyForSleeping(f, body)) };
        // A simple grown fluffy whose special friend dies: puzzled, not grieving yet
        setRelationship(dim.id, body.id, "special_friend");
        out.confused = foalDoesntUnderstand(dim, body, "special_friend");
        out.normalConfused = foalDoesntUnderstand(normal, body, "special_friend");
        // Seeing the body: the simple one isn't frightened
        const h0 = dim.happiness;
        dim.actionHandler.executeCorpseReaction(body);
        out.dimCalm = dim.happiness === h0;
        const h1 = normal.happiness;
        normal.actionHandler.executeCorpseReaction(body);
        out.normalUpset = normal.happiness < h1;
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.mistakes), JSON.stringify([true, false, true, false]), "foal, clever foal, simple adult, ordinary adult");
      check(r.confused, "the simple one doesn't understand its friend is gone");
      check(!r.normalConfused, "an ordinary one does");
      check(r.dimCalm, "no fright for the simple one");
      check(r.normalUpset, "the ordinary one is upset");
    },
  },
];
