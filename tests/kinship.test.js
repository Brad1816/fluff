// Family and breeding (Kinship.js)
const { check, checkEqual } = require("./helpers");

// A family: grandma, mum, dad (unrelated), two foals, a half-sibling, a
// cousin, and a stranger. All grown (for mating), all yours.
const SETUP = `() => {
  __clearScene();
  window.__kin = (gender, mum = null, dad = null, name = "") => {
    const f = new Horse(1, null, "INDOORS", "earthy", null, 0.6, 0.6, gender);
    f.adopted = true;
    f.x = 300 + fluffies.length * 60;
    f.y = 450;
    f.hunger = 1;
    f.happiness = 0.8;
    f.sexuality = "heterosexual";
    f.personalities = f.personalities.filter((p) => p !== "smarty");
    f.motherId = mum ? mum.id : null;
    f.fatherId = dad ? dad.id : null;
    fluffies.push(f);
    if (name) fluffyNames[f.id] = name;
    recordFluffy(f);
    return f;
  };
  const gran = __kin("female", null, null, "Gran");
  const granDad = __kin("male", null, null, "GranDad");
  const mum = __kin("female", gran, granDad, "Mum");
  const aunt = __kin("female", gran, granDad, "Aunt");
  const dad = __kin("male", null, null, "Dad");
  const other = __kin("male", null, null, "Other");
  const son = __kin("male", mum, dad, "Son");
  const daughter = __kin("female", mum, dad, "Daughter");
  const half = __kin("male", mum, other, "Half");
  const uncleBy = __kin("male", null, null, "AuntsMate");
  const cousin = __kin("male", aunt, uncleBy, "Cousin");
  const stranger = __kin("male", null, null, "Stranger");
  window.__fam = { gran, granDad, mum, aunt, dad, other, son, daughter, half, cousin, stranger };
}`;

module.exports = [
  {
    name: "kinship: how related - parents, siblings, half-siblings, grandparents, aunts, cousins, strangers",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const F = __fam;
        const pct = (a, b) => Math.round(relatedness(a, b) * 1000) / 10;
        return {
          parent: pct(F.mum, F.son),
          sibs: pct(F.son, F.daughter),
          half: pct(F.daughter, F.half),
          gran: pct(F.gran, F.daughter),
          aunt: pct(F.aunt, F.son),
          cousin: pct(F.cousin, F.daughter),
          stranger: pct(F.stranger, F.daughter),
          close: [isCloseKin(F.son, F.daughter), isCloseKin(F.cousin, F.daughter), isCloseKin(F.stranger, F.daughter)],
          words: describeKinship(F.daughter, F.half),
        };
      }, SETUP);
      checkEqual(r.parent, 50, "mum and son");
      checkEqual(r.sibs, 50, "brother and sister");
      checkEqual(r.half, 25, "half-siblings");
      checkEqual(r.gran, 25, "grandmother");
      checkEqual(r.aunt, 25, "aunt");
      checkEqual(r.cousin, 12.5, "cousins");
      checkEqual(r.stranger, 0, "a stranger");
      checkEqual(JSON.stringify(r.close), JSON.stringify([true, false, false]), "close family: siblings yes, cousins no");
      checkEqual(r.words, "half-siblings (25% related)", "in words");
    },
  },
  {
    name: "kinship: close family won't mate or pair up - unless forced, or something's wrong with them",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const F = __fam;
        const out = {};
        // The rule itself
        out.consent = kinBlocksMating(F.son, F.daughter);
        out.cousins = kinBlocksMating(F.cousin, F.daughter);
        out.stranger = kinBlocksMating(F.stranger, F.daughter);
        out.youMade = kinBlocksMating(F.son, F.daughter, true, true);
        out.normalForcing = kinBlocksMating(F.son, F.daughter, false, true);
        F.son.hasKilled = 1;
        out.killerForcing = kinBlocksMating(F.son, F.daughter, false, true);
        out.killerConsent = kinBlocksMating(F.son, F.daughter); // she's fine: no
        F.son.hasKilled = 0;
        F.son.title = "Broken";
        F.daughter.isToxoplasmosis = true;
        out.bothWrong = kinBlocksMating(F.son, F.daughter);
        out.reasons = [notRightInTheHead(F.son), notRightInTheHead(F.daughter), notRightInTheHead(F.stranger)];
        F.son.title = null;
        F.daughter.isToxoplasmosis = false;
        // In the game: mateWith refuses, and says why now and then
        F.son.specialHuggiesCooldown = 0;
        F.son.x = F.daughter.x + 40;
        F.son.y = F.daughter.y;
        out.mated = F.son.mateWith(F.daughter);
        out.cooldown = F.son.specialHuggiesCooldown > 0;
        F.stranger.specialHuggiesCooldown = 0;
        F.stranger.renderer.ensureTintedImages();
        F.stranger.x = F.daughter.x + 40;
        out.strangerMated = F.stranger.mateWith(F.daughter);
        F.stranger.interruptMating && F.stranger.interruptMating();
        // Pairing up: not with close family
        out.romance = [kinBlocksRomance(F.son, F.daughter), kinBlocksRomance(F.cousin, F.daughter)];
        return out;
      }, SETUP);
      checkEqual(r.consent, true, "brother and sister won't");
      checkEqual(r.cousins, false, "cousins can");
      checkEqual(r.stranger, false, "strangers can");
      checkEqual(r.youMade, false, "you can make them");
      checkEqual(r.normalForcing, true, "an ordinary fluffy won't force its sister");
      checkEqual(r.killerForcing, false, "a killer would");
      checkEqual(r.killerConsent, true, "but she won't agree to it");
      checkEqual(r.bothWrong, false, "two that aren't right in the head might");
      checkEqual(JSON.stringify(r.reasons), JSON.stringify(["Broken", "toxoplasmosis has got to its brain", null]), "reasons");
      checkEqual(r.mated, false, "mateWith refused");
      check(r.cooldown, "and he gives up for a while");
      checkEqual(r.strangerMated, true, "a stranger can");
      checkEqual(JSON.stringify(r.romance), JSON.stringify([true, false]), "no pairing up with close family");
    },
  },
  {
    name: "kinship: a fluffy that kills another is marked a killer (and saved)",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        const a = new Horse(1, null, "INDOORS", "earthy", null, 0.6, 0.6, "male");
        const b = new Horse(1, null, "INDOORS", "earthy", null, 0.6, 0.6, "female");
        a.adopted = b.adopted = true;
        a.personalities = a.personalities.filter((p) => p !== "smarty"); // (not a Smarty already)
        fluffies.push(a, b);
        b.lastAttackerId = a.id;
        b.lastAttackTimer = 5;
        b.health = 0;
        b.update(1 / 60);
        return { dead: !b.isAlive, killer: a.hasKilled, why: notRightInTheHead(a) };
      });
      check(r.dead, "died");
      checkEqual(r.killer, 1, "marked");
      checkEqual(r.why, "a killer", "and not right in the head");
    },
  },
  {
    name: "kinship: the vet's breeding advice - verdicts, best matches, the advice screen; the Gene Lab and family tree show it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const F = __fam;
        const out = {};
        const brief = (a) => ({ verdict: a.verdict, willMate: a.willMate, r: a.r, alive: +a.alive.toFixed(2) });
        out.sibs = brief(pairAdvice(F.daughter, F.son));
        out.cousin = brief(pairAdvice(F.daughter, F.cousin));
        out.stranger = brief(pairAdvice(F.daughter, F.stranger));
        out.best = bestMatches(F.daughter, 3).map((b) => fluffyNames[b.f.id]);
        // The screen
        openVet();
        let L = getVetLayout();
        mouse.x = L.advice.x + 5;
        mouse.y = L.advice.y + 5;
        handleVetClick();
        out.on = vetAdviceOn;
        L = getVetLayout();
        const row = L.rows.find((x) => x.f === F.daughter) || null;
        if (!row) {
          // (on another page)
          vetAdvicePick = F.daughter.id;
        } else {
          mouse.x = row.jab.x + 5;
          mouse.y = row.jab.y + 5;
          handleVetClick();
        }
        out.pick = vetAdvicePick === F.daughter.id;
        out.drawErr = null;
        try {
          drawVet(ctx);
        } catch (e) {
          out.drawErr = e.message;
        }
        // Treating isn't possible from advice mode rows
        mouse.x = L.advice.x + 5;
        mouse.y = L.advice.y + 5;
        handleVetClick();
        out.off = !vetAdviceOn && vetAdvicePick === null;
        closeVet();
        // Gene Lab and family tree draw with it
        out.treeErr = null;
        try {
          openFamilyTree(F.daughter.id);
          drawFamilyTree(ctx);
          drawFamilyGeneticsPanel(ctx, getFamilyRecord(F.half.id), 800, 70, 300);
          closeFamilyTree();
          geneLabMotherId = F.daughter.id;
          geneLabFatherId = F.son.id;
          openGeneLab();
          geneLabMotherId = F.daughter.id;
          geneLabFatherId = F.son.id;
          drawGeneLab(ctx);
          closeGeneLab();
        } catch (e) {
          out.treeErr = e.message;
        }
        return out;
      }, SETUP);
      checkEqual(r.sibs.verdict, "Too closely related", "siblings");
      checkEqual(r.sibs.willMate, false, "and they won't");
      checkEqual(r.cousin.verdict.startsWith("Fair") || r.cousin.verdict.startsWith("Poor"), true, `cousins: ${r.cousin.verdict}`);
      check(r.stranger.r === 0 && r.stranger.willMate, `stranger: ${JSON.stringify(r.stranger)}`);
      check(!r.best.includes("Son") && !r.best.includes("Half") && !r.best.includes("Dad"), `best matches skip close family: ${r.best}`);
      check(r.best.length >= 2, `best matches: ${r.best}`);
      check(r.on, "advice mode on");
      check(r.pick, "picked the daughter");
      checkEqual(r.drawErr, null, "the vet screen draws");
      check(r.off, "advice mode off again");
      checkEqual(r.treeErr, null, "family tree and Gene Lab draw");
    },
  },
];
