// Memory and trust (Memory.js)
const { check, checkEqual } = require("./helpers");

const SET_TRAIT = `(h, key, sum) => {
  const i = TRAITS.findIndex((t) => t.key === key);
  for (let k = 0; k < TRAIT_GENES_EACH; k++) h.genes[TRAIT_GENE_START + i * TRAIT_GENES_EACH + k] = k < sum ? 1 : 0;
}`;

// Two mares, average personality, standing apart in the main room
const MAKE_PAIR = `() => {
  __clearScene();
  __seedRandom(6);
  const set = eval(${JSON.stringify(SET_TRAIT)});
  const mk = (x) => {
    const h = new Horse(1, null, "INDOORS", "earthy", null, null, null, "female");
    for (const t of TRAITS) set(h, t.key, 2);
    h.adopted = true;
    h.x = x;
    h.y = 520;
    fluffies.push(h);
    return h;
  };
  return [mk(300), mk(900)];
}`;

module.exports = [
  {
    name: "memory: hurting a fluffy scares it and anyone watching",
    run: async (page) => {
      const r = await page.evaluate(({ makePair, setTrait }) => {
        const set = eval(setTrait);
        const [victim, sister] = eval(makePair)();
        setRelationship(sister.id, victim.id, "sister");
        const trustBefore = victim.playerTrust;
        notifyViolence(victim, false, "stick", false, false);
        const res = {
          victimFear: victim.playerFear,
          trustDropped: victim.playerTrust < trustBefore,
          memory: victim.playerMemories[0] && victim.playerMemories[0].type,
          sisterFear: sister.playerFear,
          sisterMemory: sister.playerMemories[0] && sister.playerMemories[0].type,
        };
        // Traffic isn't the player's fault
        const before = victim.playerFear;
        notifyViolence(victim, false, "car", false, false);
        res.carChanged = victim.playerFear !== before;
        // Brave vs timid
        const [brave, timid] = eval(makePair)();
        set(brave, "bravery", 5);
        set(timid, "bravery", 0);
        notifyViolence(brave, false, "stick", false, false);
        notifyViolence(timid, false, "stick", false, false);
        res.brave = brave.playerFear;
        res.timid = timid.playerFear;
        return res;
      }, { makePair: MAKE_PAIR, setTrait: SET_TRAIT });
      // 0.12 for a stick, give or take a little for its bravery genes
      check(r.victimFear > 0.1 && r.victimFear < 0.15, `victim fear ${r.victimFear}`);
      check(r.trustDropped, "trust didn't drop");
      checkEqual(r.memory, "stick", "victim's memory");
      check(r.sisterFear > 0.07, `sister's fear ${r.sisterFear}`);
      checkEqual(r.sisterMemory, "witness_family", "sister's memory");
      check(!r.carChanged, "being hit by a car made it fear you");
      check(r.brave < r.timid, `brave ${r.brave} vs timid ${r.timid}`);
    },
  },
  {
    name: "memory: fear fades with time (faster if gentle), kindness builds trust",
    run: async (page) => {
      const r = await page.evaluate(({ makePair, setTrait }) => {
        const set = eval(setTrait);
        const [gentle, grumpy] = eval(makePair)();
        set(gentle, "temper", 0);
        set(grumpy, "temper", 5);
        for (const f of [gentle, grumpy]) {
          f.playerFear = 0.5;
          f.lastHurtByPlayerAt = timePlayed;
        }
        // Within the first minute: no fading
        for (let i = 0; i < 30; i++) { timePlayed += 1; updatePlayerMemory(gentle, 1); updatePlayerMemory(grumpy, 1); }
        const early = gentle.playerFear;
        for (let i = 0; i < 300; i++) { timePlayed += 1; updatePlayerMemory(gentle, 1); updatePlayerMemory(grumpy, 1); }
        const res = { early, gentle: gentle.playerFear, grumpy: grumpy.playerFear };
        // Brushing and eating at home build trust
        const [a, b] = eval(makePair)();
        const t0 = a.playerTrust;
        onFluffyBrushed(a);
        res.brushed = a.playerTrust - t0;
        const t1 = b.playerTrust;
        b.currentStateKey = "EATING";
        for (let i = 0; i < 10; i++) updatePlayerMemory(b, 1);
        res.fed = b.playerTrust - t1;
        return res;
      }, { makePair: MAKE_PAIR, setTrait: SET_TRAIT });
      checkEqual(r.early, 0.5, "fear in the first minute");
      check(r.gentle < r.grumpy && r.grumpy < 0.5, `after 5 min: gentle ${r.gentle}, grumpy ${r.grumpy}`);
      check(r.brushed > 0.04, `trust from brushing ${r.brushed}`);
      check(r.fed > 0.03, `trust from 10s of eating ${r.fed}`);
    },
  },
  {
    name: "memory: a scared fluffy backs away from your hand",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate((makePair) => {
        tutorialTimer = 0;
        const [f, other] = eval(makePair)();
        fluffies.splice(fluffies.indexOf(other), 1);
        f.x = 640;
        f.y = 520;
        f.playerFear = 0.9;
        f.lastHurtByPlayerAt = timePlayed;
        window.__f = f;
      }, MAKE_PAIR);
      await page.mouse.move(640, 480);
      const r = await page.evaluate(() => {
        const before = Math.hypot(__f.x - mouse.x, __f.y - mouse.y);
        __fastForward(3);
        return { before, after: Math.hypot(__f.x - mouse.x, __f.y - mouse.y), desire: __f.brain.currentDesire && __f.brain.currentDesire.name };
      });
      check(r.after > r.before + 60, `distance from the hand: ${Math.round(r.before)} -> ${Math.round(r.after)} (${r.desire})`);
    },
  },
  {
    name: "memory: a fluffy that loves you comes to your hand",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate((makePair) => {
        tutorialTimer = 0;
        const [f, other] = eval(makePair)();
        fluffies.splice(fluffies.indexOf(other), 1);
        f.x = 250;
        f.y = 450;
        f.playerTrust = 0.95;
        // It's been a while since it last came over
        const seek = f.brain.desires.find((d) => d.name === "SeekPlayer");
        seek.lastTime = gameTimeMs() - 60000;
        window.__f = f;
      }, MAKE_PAIR);
      await page.mouse.move(1000, 450);
      const r = await page.evaluate(() => {
        const before = Math.hypot(__f.x - mouse.x, __f.y - mouse.y);
        __fastForward(12);
        return { before, after: Math.hypot(__f.x - mouse.x, __f.y - mouse.y) };
      });
      check(r.after < r.before - 250, `distance from the hand: ${Math.round(r.before)} -> ${Math.round(r.after)}`);
    },
  },
  {
    name: "memory: picking up, saving, showing and orders",
    run: async (page) => {
      const r = await page.evaluate(async (makePair) => {
        const [scared, loving] = eval(makePair)();
        scared.playerFear = 0.6;
        loving.playerTrust = 0.9;
        const h0 = scared.happiness;
        const h1 = loving.happiness;
        onFluffyPickedUp(scared);
        onFluffyPickedUp(loving);
        const res = {
          scaredSadder: scared.happiness < h0,
          lovingHappier: loving.happiness > h1,
          feelScared: describePlayerFeeling(scared)[0],
          feelLoving: describePlayerFeeling(loving)[0],
          lines: getFluffyInspectionLines(scared).filter((l) => l.startsWith("Feels about you") || l.startsWith("Remembers")),
          tameOrder: [
            fluffyFitsOrder({ reqs: [{ kind: "tame", value: 250 }] }, loving),
            fluffyFitsOrder({ reqs: [{ kind: "tame", value: 250 }] }, scared),
          ],
        };
        notifyViolence(scared, false, "knife", false, true);
        const want = { fear: scared.playerFear, trust: scared.playerTrust, mem: JSON.stringify(scared.playerMemories) };
        gameState = "PAUSED";
        await saveGame("__automated_test__");
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        gameState = "PAUSED";
        const back = fluffies.find((f) => f.id === scared.id);
        res.saved = back && back.playerFear === want.fear && back.playerTrust === want.trust && JSON.stringify(back.playerMemories) === want.mem;
        return res;
      }, MAKE_PAIR);
      check(r.scaredSadder, "a scared fluffy wasn't upset by being picked up");
      check(r.lovingHappier, "a loving fluffy wasn't happy to be picked up");
      checkEqual(r.feelScared, "Scared of you", "scared fluffy's feeling");
      checkEqual(r.feelLoving, "Loves you", "loving fluffy's feeling");
      checkEqual(r.lines.length, 2, "rows in the inspection panel");
      checkEqual(JSON.stringify(r.tameOrder), JSON.stringify([true, false]), "'friendly with people' order");
      check(r.saved, "trust, fear or memories changed after saving and loading");
    },
  },
];
