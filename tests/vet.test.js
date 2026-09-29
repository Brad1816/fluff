// Fluffy flu (Illness.js) and the vet (Vet.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(41);
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, null, "INDOORS", "earthy", null, null, null, "female");
    h.x = x;
    h.y = 450;
    h.adopted = true;
    h.health = 100;
    h.hunger = 1;
    if (opts.days !== undefined) h.age = opts.days * DAY_LENGTH;
    fluffies.push(h);
    return h;
  };
  window.__tick = (seconds) => {
    for (let t = 0; t < seconds; t += ILLNESS_TICK) {
      illnessTicker.fireNext();
      updateIllness(0);
    }
  };
}`;

module.exports = [
  {
    name: "flu: hidden at first, then sick; spreads to those nearby but not through cages or fences; immune after",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const sick = __mk(400);
        const near = Array.from({ length: 4 }, (_, i) => __mk(430 + i * 20));
        const far = __mk(1100);
        const jabbed = __mk(420);
        jabbed.fluVaccinated = true;
        // One in a cage right next to it
        const cage = new Cage(410, 470, "INDOORS");
        objects.push(cage);
        const caged = __mk(410);
        caged.currentCage = cage;
        catchFlu(sick);
        const out = {
          hidden: [hasFlu(sick), fluShowing(sick), fluKnown(sick), describeIllness(sick)],
        };
        __tick(FLU_HIDDEN + 5);
        out.showing = [fluShowing(sick), describeIllness(sick)];
        out.msg = uiMessages.some((m) => /has Fluffy flu/.test(m.text));
        __tick(600);
        out.spread = near.filter(hasFlu).length;
        out.far = hasFlu(far);
        out.jabbed = hasFlu(jabbed);
        out.caged = hasFlu(caged);
        out.hurt = sick.health < 90;
        // Healing stops while it shows
        sick.health = 50;
        sick.update(1);
        out.noHeal = sick.health <= 50.5;
        // Gets better and is immune
        __tick(FLU_LENGTH);
        out.better = hasFlu(sick);
        out.immune = !canCatchFlu(sick);
        out.row = getInspectionConditions(near.find(hasFlu) || sick).bad;
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.hidden), JSON.stringify([true, false, false, null]), "hidden at first");
      checkEqual(JSON.stringify(r.showing), JSON.stringify([true, "Fluffy flu"]), "then it shows");
      check(r.msg, "you're told");
      check(r.spread >= 2, `spread to ${r.spread}/4 nearby`);
      checkEqual(r.far, false, "far away");
      checkEqual(r.jabbed, false, "jabbed");
      checkEqual(r.caged, false, "caged");
      check(r.hurt, "loses health");
      check(r.noHeal, "doesn't heal while sick");
      checkEqual(r.better, false, "better in the end");
      check(r.immune, "immune after");
    },
  },
  {
    name: "flu: frail fluffies can die of it; strong ones get through it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const strong = __mk(400, { days: 5 });
        const old = __mk(1000, { days: 30 });
        old.age = 30 * DAY_LENGTH;
        catchFlu(strong, FLU_HIDDEN);
        catchFlu(old, FLU_HIDDEN);
        __tick(FLU_LENGTH);
        return { strong: [strong.isAlive, Math.round(strong.health)], old: [old.isAlive, old.causeOfDeath] };
      }, SETUP);
      check(r.strong[0] && r.strong[1] > 20, `strong one ${r.strong}`);
      checkEqual(JSON.stringify(r.old), JSON.stringify([false, "Fluffy flu"]), "elderly one without treatment");
    },
  },
  {
    name: "vet: check-up finds hidden flu and tells an old fluffy's time; treatment cures; jabs protect; costs money",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        money = 1000;
        const a = __mk(400, { days: 6 });
        const old = __mk(700, { days: 30 });
        catchFlu(a); // hidden
        const out = { before: vetCondition(a)[0] };
        vetCheckUp(a);
        vetCheckUp(old);
        out.found = [fluKnown(a), vetCondition(a)[0], old.vetLife];
        out.moneyAfterChecks = money;
        out.price = vetTreatmentPrice(a);
        a.isPoisoned = true;
        a.health = 40;
        out.priceMore = vetTreatmentPrice(a);
        vetTreat(a);
        out.treated = [hasFlu(a), a.isPoisoned, a.health, canCatchFlu(a)];
        out.moneyAfterTreat = money;
        vetJab(old);
        out.jab = [old.fluVaccinated, old.isToxoVaccinated, money];
        money = 5;
        const poor = vetCheckUp(old);
        out.poor = [poor, money];
        // The screen
        money = 1000;
        openVet();
        let drew = true;
        try {
          drawVet(ctx);
        } catch (e) {
          drew = e.message;
        }
        const L = getVetLayout();
        const click = (b) => {
          mouse.x = b.x + b.w / 2;
          mouse.y = b.y + b.h / 2;
          return handleVetClick();
        };
        const row = L.rows.find((x) => x.f === a);
        click(L.jabAll);
        out.allJabbed = fluffies.filter((f) => f.adopted).every((f) => f.fluVaccinated);
        click(L.close);
        out.closed = !isVetOpen();
        out.drew = drew;
        // The clinic on Shopping Street opens it
        changeScene("SHOP_STREET");
        const b = getVetClinicRect();
        mouse.x = b.x + 20;
        mouse.y = b.y + 20;
        out.clinic = vetClinicClick() && isVetOpen();
        closeVet();
        // Saved with the fluffy
        catchFlu(__mk(900));
        const sickOne = fluffies[fluffies.length - 1];
        sickOne.illness.t = 123;
        const copy = Horse.deserialize(JSON.parse(JSON.stringify(sickOne.serialize())));
        out.saved = [copy.illness && copy.illness.t, Horse.deserialize(JSON.parse(JSON.stringify(old.serialize()))).fluVaccinated];
        return out;
      }, SETUP);
      check(/Looks well/.test(r.before), `before: ${r.before}`);
      check(r.found[0], "check-up finds hidden flu");
      check(/Fluffy flu/.test(r.found[1]), r.found[1]);
      check(/about \d+ days left|any day/.test(r.found[2]), `old fluffy note: ${r.found[2]}`);
      checkEqual(r.moneyAfterChecks, 960, "two check-ups");
      checkEqual(r.price, 90, "flu treatment");
      checkEqual(r.priceMore, 190, "flu + poison + hurt");
      checkEqual(JSON.stringify(r.treated), JSON.stringify([false, false, 100, false]), "cured, healed, immune");
      checkEqual(r.moneyAfterTreat, 770, "paid for treatment");
      checkEqual(JSON.stringify(r.jab), JSON.stringify([true, true, 670]), "flu and toxo jabs");
      checkEqual(JSON.stringify(r.poor), JSON.stringify([false, 5]), "can't pay");
      check(r.allJabbed, "jab everyone");
      check(r.closed, "closes");
      checkEqual(r.drew, true, "draws");
      check(r.clinic, "clicking the clinic opens it");
      checkEqual(JSON.stringify(r.saved), JSON.stringify([123, true]), "saved");
    },
  },
  {
    name: "vet: toxoplasmosis - the vet cures it, and the toxo jab stops it taking hold",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(5);
        const mk = (x) => {
          const h = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, "female");
          h.adopted = true;
          h.x = x;
          h.y = 500;
          fluffies.push(h);
          return h;
        };
        money = 1000;
        const sick = mk(300);
        sick.isToxoplasmosis = true;
        const out = { problem: vetCondition(sick)[0], price: vetTreatmentPrice(sick) };
        vetTreat(sick);
        out.cured = !sick.isToxoplasmosis;
        // Jabbed: catching it again doesn't stick
        const j = mk(700);
        out.jabPrice = vetJabPrice(j);
        vetJab(j);
        out.jabbed = [j.fluVaccinated, j.isToxoVaccinated, vetJabPrice(j), vetCanJab(j)];
        j.isToxoplasmosis = true;
        const h0 = j.health;
        __fastForward(2);
        out.jabbedClears = !j.isToxoplasmosis && j.health >= h0 - 1;
        // Not jabbed: it hurts
        const u = mk(1000);
        u.isToxoplasmosis = true;
        u.health = 100;
        __fastForward(5);
        out.unjabbedHurt = u.isToxoplasmosis && u.health < 100;
        // Only the flu jab when toxoplasmosis is switched off
        const was = worldSettings.toxoplasmosis;
        worldSettings.toxoplasmosis = false;
        out.offPrice = vetJabPrice(mk(1200));
        worldSettings.toxoplasmosis = was;
        return out;
      });
      check(/toxoplasmosis/.test(r.problem), `the vet sees it ${r.problem}`);
      check(r.price >= 100, `treatment price ${r.price}`);
      check(r.cured, "treatment cures it");
      checkEqual(r.jabPrice, 100, "flu $40 + toxo $60");
      checkEqual(JSON.stringify(r.jabbed), JSON.stringify([true, true, 0, false]), "both jabs, nothing left to give");
      check(r.jabbedClears, "a jabbed fluffy shakes it off");
      check(r.unjabbedHurt, "an unjabbed one is hurt by it");
      checkEqual(r.offPrice, 40, "toxo off in world settings: flu jab only");
    },
  },
];
