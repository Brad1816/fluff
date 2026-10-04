// Batch 15 (plan batch 5, the big ones): summer heat, microfluffs,
// sensitive babies in stages, the surgery close-up.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD"]) __clearScene(s);
  __seedRandom(1515);
  closeAllChoices();
  currentScene = "INDOORS";
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
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "batch15: summer heat - hot outside in the afternoon, not at night or indoors with a fan; heatstroke kills; water and fans help",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const realSeason = getSeason;
        const realHour = gameHour;
        getSeason = () => "Summer";
        gameHour = () => 15;
        out.outdoor = placeHeat("BACKYARD") > 0.7;
        out.indoor = placeHeat("INDOORS") > 0 && placeHeat("INDOORS") < 0.5;
        gameHour = () => 2;
        out.night = placeHeat("BACKYARD") === 0;
        gameHour = () => 15;
        const fan = new Fan("INDOORS");
        fan.setPosition(300, 520);
        objects.push(fan);
        const f = __mk(400);
        out.fanCools = heatAt(f) === 0;
        objects.splice(objects.indexOf(fan), 1);
        // A foal out in the heat
        const foal = __mk(500, { scene: "BACKYARD", growth: 0.4 });
        for (let t = 0; t < 600; t++) {
          heatTicker.fireNext();
          updateHeat(1);
        }
        out.hot = foal.heat > HEATSTROKE;
        out.hurt = foal.health < 100;
        out.row = JSON.stringify(describeHeat(foal));
        // Water cools
        const wb = new WaterBowl("BACKYARD");
        wb.setPosition(560, 520);
        objects.push(wb);
        const adult = __mk(520, { scene: "BACKYARD" });
        adult.heat = 0.7;
        const d = new HeatDesire();
        out.wantsRelief = d.evaluate(adult) > 0;
        adult.x = 560;
        d.spot = { x: 560, y: 520, kind: "water" };
        d.execute(adult);
        out.drank = adult.heat < 0.5;
        objects.splice(objects.indexOf(wb), 1);
        // Heatstroke kills
        foal.health = 0.1;
        heatTicker.fireNext();
        updateHeat(1);
        out.died = !foal.isAlive && foal.causeOfDeath === "Heatstroke";
        out.shop = SPAWN_ACTIONS.some((a) => a.isItem === "fan") && SPAWN_ACTIONS.some((a) => a.isItem === "water_bowl");
        getSeason = realSeason;
        gameHour = realHour;
        out.notSummer = placeHeat("BACKYARD") === 0 || getSeason() === "Summer";
        return out;
      }, SETUP);
      check(r.outdoor && r.indoor && r.night, `heat by place and hour: ${JSON.stringify(r)}`);
      check(r.fanCools, "a fan cools the room");
      check(r.hot && r.hurt && /Heatstroke/.test(r.row), "a foal out in the afternoon sun gets heatstroke");
      check(r.wantsRelief && r.drank, "a hot fluffy looks for water and drinks");
      check(r.died, "heatstroke can kill");
      check(r.shop && r.notSummer, "fans and water bowls in the shop");
    },
  },
  {
    name: "batch15: microfluffs - a grown one is newborn-sized, its foals far smaller; eat less, fragile, pricey; only breed with micros",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const a = __mk(300);
        const b = __mk(400);
        const p0 = b.calculatePrice();
        makeMicro(b);
        const foal = __mk(250, { growth: 0 });
        const out = { ratio: +(b.scale / foal.scale).toFixed(2), adultRatio: +(b.scale / a.scale).toFixed(2), eats: microHungerMultiplier(b) < 0.5, pricey: b.calculatePrice() > p0 * 2 };
        b.health = 100;
        b.handleThrowImpact(THROW_IMPACT_MIN_SPEED * 0.8);
        out.fragile = b.health < 100;
        const dad = __mk(500, { gender: "male" });
        makeMicro(dad);
        const baby = __mk(320, { growth: 0 });
        out.breedsTrue = microInherit(baby, b, dad) && baby.micro;
        out.babyRatio = +(baby.scale / b.scale).toFixed(2);
        // Not with an ordinary fluffy, either way round, even forced
        const stallion = __mk(600, { gender: "male" });
        out.noMix = !canFluffiesMate(stallion, b, true) && !canFluffiesMate(dad, a, true) && microBreedingMismatch(stallion, b) && !microBreedingMismatch(dad, b);
        out.cage = forcedBreedingProblem(stallion, b) || "";
        const col = getBuyerKind("collector");
        out.collector = buyerLikes(col, b) > buyerLikes(col, a);
        out.row = JSON.stringify(describeMicro(b));
        out.saved = JSON.stringify(b.serialize()).includes('"micro":true');
        return out;
      }, SETUP);
      check(r.ratio > 0.9 && r.ratio < 1.5, `a grown micro is about an ordinary newborn's size: ${JSON.stringify(r)}`);
      check(r.adultRatio > 0.2 && r.adultRatio < 0.4, `about a quarter to a third of a grown fluffy: ${r.adultRatio}`);
      check(r.babyRatio < 0.4, "its newborn is far smaller than it");
      check(r.eats && r.pricey, "eats little, pricey");
      check(r.fragile, "a fall that wouldn't hurt a normal fluffy hurts a micro");
      check(r.breedsTrue && r.collector, "breeds true; collectors love them");
      check(r.noMix && /microfluff/.test(r.cage), `micros and ordinary fluffies can't breed: ${r.cage}`);
      check(/Microfluff/.test(r.row) && r.saved, "magnifying glass; saved");
    },
  },
  {
    name: "batch15: a sensitive baby looks normal at first, the head shows later, then the neck; the vet can tell early",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        worldSettings.sbs = true;
        const f = __mk(400, { growth: 0.1 });
        f.sensitiveBaby = true;
        const out = { s0: sbsStage(f), hidden: !getInspectionConditions(f).bad.includes("sensitive baby") };
        const found = [];
        vetSpotsSbs(f, found);
        out.vet = found.length === 1 && getInspectionConditions(f).bad.includes("sensitive baby");
        f.growth = 0.4;
        out.s1 = [sbsStage(f), sbsShows(f, "head"), sbsShows(f, "neck")];
        f.growth = 0.7;
        out.s2 = [sbsStage(f), sbsShows(f, "neck"), sbsShows(f, "body")];
        return out;
      }, SETUP);
      checkEqual(r.s0, 0, "born looking normal");
      check(r.hidden && r.vet, "the magnifying glass doesn't tell - the vet can");
      checkEqual(JSON.stringify(r.s1), JSON.stringify([1, true, false]), "then the head");
      checkEqual(JSON.stringify(r.s2), JSON.stringify([2, true, true]), "then the neck and belly");
    },
  },
  {
    name: "batch15: the surgery close-up shows its face and what it says, part by part",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400);
        openSurgery(f, new Knife("scalpel", "INDOORS"), null);
        surgeryCut("tail");
        const said = f.speech.text || "";
        let drew = true;
        try {
          drawSurgery(ctx);
        } catch (e) {
          drew = String(e);
        }
        closeSurgery();
        return { said, drew };
      }, SETUP);
      check(r.said.length > 0, `it says something: "${r.said}"`);
      checkEqual(r.drew, true, "the close-up draws");
    },
  },
];
