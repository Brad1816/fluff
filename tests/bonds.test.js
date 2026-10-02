// Bonds and grudges between fluffies (Bonds.js)
const { check, checkEqual } = require("./helpers");

// Mares with average traits (no smarties, nobody unusually brave or grumpy)
const MAKE = `(n, xs) => {
  __clearScene();
  __seedRandom(12);
  const out = [];
  for (let i = 0; i < n; i++) {
    const h = new Horse(1, null, "INDOORS", "earthy", null, null, null, "female");
    const set = (key, sum) => {
      const k = TRAITS.findIndex((t) => t.key === key);
      for (let g = 0; g < TRAIT_GENES_EACH; g++) h.genes[traitGeneStart(k) + g] = g < sum ? 1 : 0;
    };
    for (const t of TRAITS) set(t.key, 3);
    h.adopted = true;
    h.happiness = 0.8;
    h.x = xs[i];
    h.y = 480;
    fluffyNames[h.id] = "F" + i;
    fluffies.push(h);
    out.push(h);
  }
  return out;
}`;

module.exports = [
  {
    name: "bonds: fluffies that spend time together become friends by themselves",
    run: async (page) => {
      const r = await page.evaluate((make) => {
        const [a, b, far] = eval(make)(3, [500, 580, 1100]);
        // 8 game minutes side by side (positions held still)
        for (let s = 0; s < 480; s++) updateSocialBonds(1);
        return {
          ab: getOpinion(a, b),
          ba: getOpinion(b, a),
          rel: relationships[a.id] && relationships[a.id][b.id],
          far: getOpinion(a, far),
          buddies: describeBuddies(a),
        };
      }, MAKE);
      check(r.ab >= 0.5 && r.ba >= 0.5, `opinions after 8 min together: ${r.ab.toFixed(2)}, ${r.ba.toFixed(2)}`);
      checkEqual(r.rel, "friend", "relationship");
      checkEqual(r.far, 0, "opinion of a fluffy far away");
      checkEqual(r.buddies, "F1", "buddies shown");
    },
  },
  {
    name: "bonds: attacks make grudges, and witnesses side with their buddy",
    run: async (page) => {
      const r = await page.evaluate((make) => {
        const [bully, victim, pal, stranger] = eval(make)(4, [500, 560, 620, 700]);
        // pal adores the victim
        victim.opinions = {};
        pal.opinions[victim.id] = 0.8;
        bully.performAttack(victim, "SMARTY_VIOLENCE");
        const res = {
          victim: getOpinion(victim, bully),
          why: victim.opinionWhy[bully.id],
          pal: getOpinion(pal, bully),
          stranger: getOpinion(stranger, bully),
          grudges: describeGrudges(victim),
        };
        // A buddy right next to it jumps in (half the time): try a few
        let defended = 0;
        for (let i = 0; i < 20; i++) {
          victim.health = 100;
          pal.counterattack.fluffy = null;
          pal.x = bully.x + 60;
          bully.attackCooldown = 0;
          noteFluffyAttack(bully, victim, "SMARTY_VIOLENCE");
          if (pal.counterattack.fluffy === bully) defended++;
        }
        res.defended = defended;
        return res;
      }, MAKE);
      check(r.victim <= -0.3, `victim's opinion of the bully ${r.victim}`);
      checkEqual(r.why, "attacked it", "reason remembered");
      check(r.pal <= -0.14, `buddy's opinion of the bully ${r.pal}`);
      check(r.stranger < 0 && r.stranger > r.pal, `bystander's opinion ${r.stranger}`);
      check(r.grudges.startsWith("F0 (attacked it)"), `grudges shown: ${r.grudges}`);
      check(r.defended > 3 && r.defended < 17, `buddy defended ${r.defended}/20 times`);
    },
  },
  {
    name: "bonds: grudges block friendship, make fluffies keep apart, and fade",
    run: async (page) => {
      const r = await page.evaluate((make) => {
        const [a, b] = eval(make)(2, [500, 560]);
        a.opinions[b.id] = -0.7;
        b.speech.timer = 0;
        b.proposeFriendship(a); // a refuses
        const refused = !(relationships[a.id] && relationships[a.id][b.id]);
        const avoid = a.brain.desires.find((d) => d.name === "AvoidGrudge").evaluate(a);
        const hBefore = a.happiness;
        updateSocialBonds(1);
        const unhappier = a.happiness < hBefore;
        // Far apart for 20 minutes: the grudge fades
        b.x = 1200;
        const before = getOpinion(a, b);
        for (let s = 0; s < 1200; s++) updateSocialBonds(1);
        return { refused, avoid, unhappier, before, after: getOpinion(a, b) };
      }, MAKE);
      check(r.refused, "a fluffy became friends with someone it holds a grudge against");
      check(r.avoid > 0, "no urge to walk away from the grudge");
      check(r.unhappier, "being near a grudge didn't bother it");
      check(r.after > r.before + 0.15 && r.after < 0, `grudge fading: ${r.before.toFixed(2)} -> ${r.after.toFixed(2)}`);
    },
  },
  {
    name: "bonds: a fluffy walks over to its buddy",
    run: async (page) => {
      const r = await page.evaluate((make) => {
        const [a, b] = eval(make)(2, [250, 1050]);
        a.opinions[b.id] = 0.9;
        b.opinions[a.id] = 0.9;
        const seek = a.brain.desires.find((d) => d.name === "SeekBuddy");
        seek.lastTime = gameTimeMs() - 60000;
        // Keep b in place so we measure a's walk
        b.update = () => {};
        const before = Math.abs(a.x - b.x);
        __fastForward(10);
        return { before, after: Math.abs(a.x - b.x) };
      }, MAKE);
      check(r.after < r.before - 300, `distance to buddy: ${Math.round(r.before)} -> ${Math.round(r.after)}`);
    },
  },
  {
    name: "bonds and grudges survive saving and loading",
    run: async (page) => {
      const r = await page.evaluate(async (make) => {
        const [a, b] = eval(make)(2, [400, 900]);
        a.opinions[b.id] = 0.62;
        a.opinionWhy[b.id] = "hugs";
        b.opinions[a.id] = -0.45;
        b.opinionWhy[a.id] = "attacked it";
        const want = JSON.stringify([a.opinions, a.opinionWhy, b.opinions, b.opinionWhy]);
        gameState = "PAUSED";
        await saveGame("__automated_test__");
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        gameState = "PAUSED";
        const A = fluffies.find((f) => f.id === a.id);
        const B = fluffies.find((f) => f.id === b.id);
        return { same: JSON.stringify([A.opinions, A.opinionWhy, B.opinions, B.opinionWhy]) === want };
      }, MAKE);
      check(r.same, "opinions changed after saving and loading");
    },
  },
];
