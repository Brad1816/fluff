// Affection (Affection.js): hearts that go up with kindness and down with neglect
const { check, checkEqual } = require("./helpers");

// Average-personality mares you own, in the living room
const SETUP = `() => {
  __clearScene();
  __seedRandom(12);
  weatherState.until = 1e9;
  weatherState.type = weatherState.target = "clear";
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH; // day 6, summer, 10 am
  window.__mk = (x, scene = "INDOORS") => {
    const h = new Horse(1, null, scene, "earthy", null, null, null, "female");
    for (const t of TRAITS) {
      const i = TRAITS.findIndex((q) => q.key === t.key);
      for (let k = 0; k < TRAIT_GENES_EACH; k++) h.genes[TRAIT_GENE_START + i * TRAIT_GENES_EACH + k] = k < 2 ? 1 : 0;
    }
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.warmth = 1;
    h.happiness = 0.6;
    h.playerTrust = 0.5;
    h.playerFear = 0;
    h.playerMemories = [];
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
  window.__said = [];
  window.__realMsg = window.__realMsg || window.addUIMessage;
  window.addUIMessage = (t) => __said.push(t);
}`;
const TEARDOWN = () => {
  if (window.__realMsg) window.addUIMessage = window.__realMsg;
};

module.exports = [
  {
    name: "affection: brushing counts in full the first 3 times a day, hearts pop up, and you're told when it loves you",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400);
        const gains = [];
        for (let i = 0; i < 5; i++) {
          const t = f.playerTrust;
          onFluffyBrushed(f);
          gains.push(+(f.playerTrust - t).toFixed(3));
          timePlayed += 5;
        }
        const out = { gains, pops: affectionPops.filter((p) => p.id === f.id).length, mem: f.playerMemories[0].text, kind: f.lastKindnessAt };
        // Next day: full again
        timePlayed += DAY_LENGTH;
        const t = f.playerTrust;
        onFluffyBrushed(f);
        out.nextDay = +(f.playerTrust - t).toFixed(3);
        // Crossing into "loves you"
        f.playerTrust = 0.74;
        timePlayed += DAY_LENGTH;
        onFluffyBrushed(f);
        out.level = affectionLevel(f);
        out.msg = __said.find((m) => /loves you now/.test(m)) || null;
        out.hearts = affectionHeartText(f);
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      check(r.gains[0] >= 0.045 && r.gains[1] >= 0.045 && r.gains[2] >= 0.045, `first three in full ${r.gains}`);
      check(r.gains[3] > 0 && r.gains[3] <= 0.011 && r.gains[4] <= 0.011, `after that, a little ${r.gains}`);
      check(r.pops >= 1, "a heart popped up");
      checkEqual(r.mem, "Brushed by you", "remembered");
      check(typeof r.kind === "number", "kindness time noted");
      check(r.nextDay >= 0.045, `the next day counts again ${r.nextDay}`);
      checkEqual(r.level, "loves", "level");
      check(r.msg && /loves you now/.test(r.msg), "you're told");
      checkEqual(r.hearts, "♥♥♥♥♡", "four hearts");
    },
  },
  {
    name: "affection: food, treats, presents, toys, patching up, the vet and a name all count; horrid things don't",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const eater = __mk(300);
        const sleeper = __mk(600);
        sleeper.currentStateKey = "SLEEPING";
        const elsewhere = __mk(300, "INDOORSL1");
        const d = (f, fn) => {
          const t = f.playerTrust;
          fn();
          return +(f.playerTrust - t).toFixed(3);
        };
        const out = {};
        // Filling a bowl for real with the food bag
        const bowl = new Bowl("bowl", "INDOORS");
        bowl.x = 700;
        bowl.y = 500;
        objects.push(bowl);
        const bag = new FoodBag("kibble", "INDOORS");
        bag.amount = 10;
        objects.push(bag);
        const sp = { x: bowl.x, y: bowl.y };
        const oldMouse = { x: mouse.x, y: mouse.y };
        let hit = null;
        for (let dx = -40; dx <= 40 && !hit; dx += 4) for (let dy = -40; dy <= 40 && !hit; dy += 4) if (bowl.hitTest(sp.x + dx, sp.y + dy)) hit = { x: sp.x + dx, y: sp.y + dy };
        mouse.x = hit.x;
        mouse.y = hit.y;
        out.fed = d(eater, () => bag.attemptFill());
        out.sleeperFed = sleeper.playerTrust - 0.5;
        out.elsewhereFed = elsewhere.playerTrust - 0.5;
        timePlayed += 10;
        bowl.food = 0;
        out.fedAgainSoon = d(eater, () => bag.attemptFill());
        mouse.x = oldMouse.x;
        mouse.y = oldMouse.y;
        timePlayed += 200;
        out.treat = d(eater, () => onBowlFilledByYou(bowl, "sketties"));
        // Presents
        const gifted = __mk(900);
        out.gift = d(gifted, () => onAccessoryGiven(gifted, "bow"));
        out.horrid = d(gifted, () => onAccessoryGiven(gifted, "blindfold"));
        out.horridMem = gifted.playerMemories[0].text;
        // Toys near it, not far away
        const ball = new Ball(eater.x + 50, eater.y, "INDOORS");
        objects.push(ball);
        out.toy = d(eater, () => ball.onDrop());
        const far = __mk(1200);
        ball.x = 100;
        out.farToy = d(far, () => ball.onDrop());
        // The vet and naming
        const sick = __mk(500);
        sick.health = 40;
        money = 10000;
        out.vet = d(sick, () => vetTreat(sick));
        delete fluffyNames[sick.id];
        namingPopup = { ids: [sick.id], names: ["Poppy"] };
        out.named = d(sick, () => saveNamingPopup());
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      check(r.fed >= 0.018, `filling its bowl ${r.fed}`);
      checkEqual(r.sleeperFed, 0, "asleep: didn't see");
      checkEqual(r.elsewhereFed, 0, "another room: didn't see");
      checkEqual(r.fedAgainSoon, 0, "not again straight away");
      check(r.treat >= 0.036, `sketties are a treat ${r.treat}`);
      check(r.gift >= 0.055, `a present ${r.gift}`);
      check(r.horrid < -0.04, `a blindfold ${r.horrid}`);
      checkEqual(r.horridMem, "You put something horrid on it", "remembered");
      check(r.toy >= 0.018, `a toy nearby ${r.toy}`);
      checkEqual(r.farToy, 0, "a toy across the room");
      check(r.vet >= 0.045, `the vet made it better ${r.vet}`);
      check(r.named >= 0.045, `a name ${r.named}`);
    },
  },
  {
    name: "affection: going hungry, cold, caged for hours or ignored for days wears it down",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const hungry = __mk(200);
        const cold = __mk(500);
        const caged = __mk(800);
        const ignored = __mk(1100);
        const fine = __mk(1300);
        for (const f of [hungry, cold, caged, ignored, fine]) f.playerTrust = 0.8;
        ignored.lastKindnessAt = timePlayed;
        fine.lastKindnessAt = timePlayed;
        const cage = new Cage("INDOORS");
        caged.currentCage = cage;
        const run = (secs) => {
          for (let i = 0; i < secs / 2; i++) {
            timePlayed += 2;
            hungry.hunger = 0.05;
            cold.warmth = 0.2;
            for (const f of [cold, caged, ignored, fine]) f.hunger = 1;
            fine.lastKindnessAt = timePlayed;
            affectionTicker.fireNext();
            updateAffection(0);
          }
        };
        run(4 * HOUR_LENGTH);
        const after4h = { hungry: hungry.playerTrust, cold: cold.playerTrust, caged: caged.playerTrust, fine: fine.playerTrust };
        run(6 * HOUR_LENGTH);
        const out = {
          after4h,
          hungry: hungry.playerTrust,
          caged: caged.playerTrust,
          hungryMems: hungry.playerMemories.filter((m) => m.text === "You let it go hungry").length,
          coldMem: cold.playerMemories.some((m) => m.text === "You left it in the cold"),
          cagedMem: caged.playerMemories.some((m) => m.text === "Shut in a cage for ages"),
        };
        // Days without anything nice
        run(2 * DAY_LENGTH);
        out.ignored = ignored.playerTrust;
        out.fine = fine.playerTrust;
        out.missed = ignored.playerMemories.some((m) => m.text === "Misses you");
        out.stopMsg = __said.some((m) => /doesn't love you like before/.test(m));
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      check(r.after4h.hungry < 0.8 - 0.07 && r.after4h.hungry > 0.8 - 0.1, `4 hours starving ${r.after4h.hungry}`);
      check(r.after4h.cold < 0.8 - 0.07, `4 hours freezing ${r.after4h.cold}`);
      checkEqual(r.after4h.caged, 0.8, "a few hours in a cage is fine");
      check(r.caged < 0.8, `hours on end in a cage ${r.caged}`);
      checkEqual(r.hungryMems, 1, "remembered once, not every tick");
      check(r.coldMem && r.cagedMem, "cold and cage remembered");
      check(r.ignored < 0.8 && r.ignored >= 0.6, `ignored for days drifts down, not below 0.6 (${r.ignored})`);
      check(r.fine >= 0.8, `looked after: no change ${r.fine}`);
      check(r.missed, "it misses you");
      check(r.stopMsg, "you're told when one stops loving you");
    },
  },
  {
    name: "affection: loved fluffies enjoy brushing more and forgive faster; unloved ones squirm and grumble; shown in the magnifying glass",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const loved = __mk(300);
        loved.playerTrust = 0.9;
        const unloved = __mk(800);
        unloved.playerTrust = 0.1;
        const out = { mult: [brushHappinessMultiplier(loved), brushHappinessMultiplier(unloved)] };
        const h = unloved.happiness;
        unloved._lastPickupReaction = null;
        onFluffyPickedUp(unloved);
        out.squirm = unloved.happiness < h;
        // Forgiving
        const plain = __mk(1200);
        plain.playerTrust = 0.5;
        for (const f of [loved, plain]) {
          f.playerFear = 0.5;
          f.lastHurtByPlayerAt = timePlayed - 1000;
        }
        for (let i = 0; i < 60; i++) {
          updatePlayerMemory(loved, 1);
          updatePlayerMemory(plain, 1);
        }
        out.fear = [loved.playerFear, plain.playerFear];
        // Magnifying glass
        loved.playerFear = 0;
        const tabs = getInspectionTabs(loved);
        const mind = tabs.tabs.find((t) => t.id === "mind");
        const row = mind.cols[0].rows.find((x) => x.label === "Affection");
        out.row = row && row.value;
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      checkEqual(JSON.stringify(r.mult), JSON.stringify([1.5, 0.5]), "brushing happiness");
      check(r.squirm, "an unloved fluffy doesn't want upsies");
      check(r.fear[0] < r.fear[1], `loved fluffies forgive faster ${r.fear}`);
      checkEqual(r.row, "♥♥♥♥❥  Loves you", "Mind tab row");
    },
  },
];
