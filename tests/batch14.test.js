// Batch 14 (plan batch 4, trade and tools): the pet-food buyer, fake
// alicorns, the mystery carrier, mill production, forever foals, mouth
// surgery, the auto-amputator, spinning, poisoned food, talking to them.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD", "ALLEY"]) __clearScene(s);
  __seedRandom(1414);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 6 * DAY_LENGTH + 10 * HOUR_LENGTH;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 520;
    h.hunger = opts.hunger ?? 1;
    h.health = 100;
    h.happiness = 0.7;
    h.currentStateKey = "IDLE";
    if (opts.think !== true) h.brain.think = () => {};
    if (opts.name) fluffyNames[h.id] = opts.name;
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "batch14: the reptile shop buyer pays by weight for runts and old ones; families hear of it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const k = getBuyerKind("petfood");
        const runt = __mk(400, { growth: 0.5 });
        makeRunt(runt);
        const nice = __mk(500);
        const out = { kind: k.id === "petfood", likesRunt: buyerLikes(k, runt) > buyerLikes(k, nice), cheap: buyerOffer(k, runt).offer < 40 };
        keeperRep.family = 5;
        _saleBuyer = "petfood";
        noteFluffyLeft(runt, "sold", 20);
        out.rep = keeperRep.family;
        return out;
      }, SETUP);
      check(r.kind && r.likesRunt && r.cheap, `the buyer: ${JSON.stringify(r)}`);
      checkEqual(r.rep, 4, "families hear of it");
    },
  },
  {
    name: "batch14: fake alicorn - glued on from the menu, sells like an alicorn, the vet notices, a bath takes it off, a buyer may find out",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400, { name: "Fakey" });
        const before = f.calculatePrice();
        const out = { menu: rightClickActions(f).some((a) => a.key === "fake_alicorn") };
        rightClickActions(f).find((a) => a.key === "fake_alicorn").run(f);
        out.looks = f.typeVisibleToOthers() === "alicorn" && f.limbs.horn && f.limbs.leftWing;
        out.pricey = f.calculatePrice() > before * 10;
        out.row = JSON.stringify(describeFakeAlicorn(f));
        const found = [];
        vetSpotsFake(f, found);
        out.vet = found.length === 1;
        out.inspector = inspectHouse().minor.some((t) => /fake alicorn/.test(t));
        scrubFluffy(f);
        out.off = !f.fakeAlicorn && !f.limbs.horn && f.typeVisibleToOthers() === "earthy";
        // Sold as a fake: found out
        makeFakeAlicorn(f);
        const real = Math.random;
        Math.random = () => 0.1;
        noteFakeAlicornSold(f, 500);
        Math.random = real;
        const m0 = money;
        fakeAlicornState.pending[0].due = getDayNumber();
        _taDaily();
        out.refund = money < m0;
        out.saved = JSON.stringify(f.serialize()).includes('"fakeAlicorn":{');
        return out;
      }, SETUP);
      check(r.menu && r.looks, "glued on from the menu: it looks like an alicorn");
      check(r.pricey, "sells like one");
      check(/Fake alicorn/.test(r.row), `magnifying glass: ${r.row}`);
      check(r.vet && r.inspector, "the vet and the inspector notice");
      check(r.off, "a bath takes it off");
      check(r.refund && r.saved, "a buyer finds out: refund; saved");
    },
  },
  {
    name: "batch14: mystery carrier from the Computer arrives as a fluffy; mill: buzzer, newborns to the incubator, milking",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const n0 = fluffies.length;
        const m0 = money;
        orderMysteryCarrier();
        out.paid = money === m0 - MYSTERY_PRICE && mysteryDeliveries.length === 1;
        mysteryDeliveries[0].due = timePlayed - 1;
        tradeTicker.fireNext();
        updateTrade(0.1);
        out.arrived = fluffies.length === n0 + 1 && fluffies[fluffies.length - 1].fromMystery && fluffies[fluffies.length - 1].adopted;
        // Mill
        millSettings.buzzer = true;
        millSettings.toIncubator = true;
        const mare = __mk(500, { name: "Mama" });
        out.buzz = onLabourStarted(mare);
        const inc = new Incubator("INDOORS");
        inc.x = 800;
        inc.y = 500;
        if (inc.updateBounds) inc.updateBounds();
        objects.push(inc);
        const baby = __mk(510, { growth: 0, mum: mare.id });
        out.toInc = millCollectNewborn(baby, mare) && baby.currentCage === inc;
        out.toggles = PAUSE_TOGGLES.some((t) => /Birth buzzer/.test(t.label()));
        mare.lactatingTimer = 999;
        mare.milkCharges = 3;
        const m1 = money;
        out.menu = rightClickActions(mare).some((a) => a.key === "milk");
        milkMare(mare);
        out.milked = mare.milkCharges === 2 && money === m1 + MILK_PRICE && !canMilk(mare);
        objects.splice(objects.indexOf(inc), 1);
        millSettings = freshMillSettings();
        return out;
      }, SETUP);
      check(r.paid && r.arrived, `mystery carrier: ${JSON.stringify(r)}`);
      check(r.buzz && r.toggles, "the birth buzzer, switched from the pause menu");
      check(r.toInc, "a newborn goes straight to the incubator");
      check(r.menu && r.milked, "milking her: a bottle sold, one less feed");
    },
  },
  {
    name: "batch14: stay little - a dosed foal doesn't grow, is worth more, and grows up confused and timid",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400, { growth: 0.4 });
        const p0 = f.calculatePrice();
        rightClickActions(f).find((a) => a.key === "stay_little").run(f);
        const g0 = f.growth;
        f._updateGrowingUp(200);
        const out = { held: f.growth === g0, dosed: stayLittleActive(f) };
        f.stayLittle.days = 3;
        out.pricier = f.calculatePrice() > p0;
        out.row = JSON.stringify(describeForeverFoal(f));
        // It grows up
        f.stayLittle.until = timePlayed - 1;
        f.growth = 1;
        foreverTicker.fireNext();
        updateForeverFoals(0.1);
        out.confused = f.wasForeverFoal && (f.traitShift || {}).bravery < 0;
        return out;
      }, SETUP);
      check(r.held && r.dosed, "it doesn't grow while dosed");
      check(r.pricier && /Kept little/.test(r.row), `worth more: ${r.row}`);
      check(r.confused, "grows up confused and timid");
    },
  },
  {
    name: "batch14: mouth surgery - pulled teeth make kibble hurt, a cut-out tongue only cries; the auto-amputator takes every limb",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400, { name: "Mouthy", hunger: 0.5 });
        const out = { listed: surgeryListParts(f).includes("teeth") && surgeryListParts(f).includes("tongue") };
        openSurgery(f, new Knife("scalpel", "INDOORS"), null);
        surgeryCut("teeth");
        surgeryCut("tongue");
        closeSurgery();
        out.flags = f.toothless && f.tongueless;
        out.kibble = toothlessRefuses(f, "kibble") && !toothlessRefuses(f, "sketties");
        f.speech.text = "";
        f.speak("Hewwo mistah!", true);
        out.cries = !/Hewwo/.test(f.speech.text || "");
        out.row = JSON.stringify(describeMouth(f));
        // The auto-amputator
        const amp = new AutoAmputator("INDOORS");
        amp.setPosition(700, 520);
        objects.push(amp);
        const g = __mk(650, { type: "alicorn" });
        g.health = 100;
        out.menu = rightClickActions(g).some((a) => a.key === "amputator");
        runAmputator(g, amp);
        out.gone = !g.limbs.legs.some(Boolean) && !g.limbs.horn && !g.limbs.leftWing && !g.limbs.rightWing;
        out.shop = SPAWN_ACTIONS.some((a) => a.isItem === "auto_amputator");
        objects.splice(objects.indexOf(amp), 1);
        return out;
      }, SETUP);
      check(r.listed && r.flags, `teeth and tongue on the chart: ${JSON.stringify(r)}`);
      check(r.kibble, "no teeth: kibble refused (unless really hungry), sketties fine");
      check(r.cries, "no tongue: only cries");
      check(/no teeth/.test(r.row), `magnifying glass: ${r.row}`);
      check(r.menu && r.gone && r.shop, "the auto-amputator takes every leg, wing and the horn");
    },
  },
  {
    name: "batch14: spinning a held fluffy round makes it dizzy; poison mixed into food goes unnoticed, and witnesses fear that bowl",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(500, { name: "Spinny" });
        f.isDragging = true;
        _spin = null;
        const cx = 500;
        const cy = 400;
        for (let i = 0; i <= 3.5 * 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          mouse.x = cx + Math.cos(a) * 80;
          mouse.y = cy + Math.sin(a) * 80;
          updateSpinning(0.016);
        }
        f.isDragging = false;
        const out = { dizzy: isDizzy(f), desire: new DizzyDesire().evaluate(f) > 0 };
        // Poison
        const bowl = new Bowl("bowl", "INDOORS");
        bowl.x = 300;
        bowl.y = 520;
        bowl.fill(5, "kibble");
        objects.push(bowl);
        bowl.fill(2, "rat_poison");
        out.mixed = bowl.poisoned && bowl.foodType === "kibble" && bowl.food === 5;
        const eater = __mk(300, { hunger: 0.3 });
        bowl.eat();
        atePoisonedFood(eater, bowl);
        out.poisoned = eater.isPoisoned;
        const w = __mk(380);
        poisonWitnessed(eater);
        out.fears = fearsBowl(w, bowl);
        out.saved = JSON.stringify(bowl.serialize()).includes('"poisoned":true');
        objects.splice(objects.indexOf(bowl), 1);
        return out;
      }, SETUP);
      check(r.dizzy && r.desire, "spun round: dizzy, staggering");
      check(r.mixed && r.poisoned, "poison mixed into the kibble, eaten unnoticed");
      check(r.fears && r.saved, "a witness fears that bowl; saved");
    },
  },
  {
    name: "batch14: talking - telling it what it did wrong teaches; bad fluffy shames; cruel words hurt; from the menu",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400);
        const out = { menu: rightClickActions(f).some((a) => a.key === "talk") };
        f._accidentAt = timePlayed;
        f.pottyTraining = 0.2;
        out.explain = talkTo(f, "explain");
        out.learned = f.pottyTraining > 0.2;
        f._talkAt = -999;
        const h0 = f.happiness;
        out.bad = talkTo(f, "bad");
        f._talkAt = -999;
        const fear0 = f.playerFear || 0;
        out.cruel = talkTo(f, "cruel");
        out.hurt = f.happiness < h0 - 0.2 && (f.playerFear || 0) > fear0;
        f._talkAt = -999;
        out.opens = openTalk(f) && !!choiceDialog;
        closeAllChoices();
        return out;
      }, SETUP);
      check(r.menu && r.opens, "Talk from the menu, a choice of words");
      check(r.explain === "lesson" && r.learned, "telling it what it did wrong teaches");
      check(r.bad === "shamed" && r.cruel === "hurt" && r.hurt, `harsh words: ${JSON.stringify(r)}`);
    },
  },
];
