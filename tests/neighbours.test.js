// Maple Lane: the neighbours and their fluffies (Neighbours.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["INDOORS", "BACKYARD", "ALLEY", "MAPLE_LANE", "MAPLE_HOME"]) __clearScene(s);
  __seedRandom(2024);
  closeAllChoices();
  neighbourState = freshNeighbourState();
  nbPanelSlot = null;
  currentScene = "INDOORS";
  timePlayed = 4 * DAY_LENGTH + 5 * HOUR_LENGTH;
  money = 5000;
  updateNeighbours(2.1);
  window.__house = (kind) => {
    const h = neighbourState.houses[0];
    for (const f of nbPets(h)) fluffies.splice(fluffies.indexOf(f), 1);
    const nh = nbMoveIn(0, kind);
    return nh;
  };
}`;

module.exports = [
  {
    name: "neighbours: three houses on Maple Lane, each with a neighbour (different kinds) and their own fluffies - out on the lawns by day, indoors at night; saved and loaded; the lane and a neighbour's door draw",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const hs = neighbourState.houses;
        out.houses = hs.length;
        out.kinds = new Set(hs.map((h) => h.kind)).size;
        const pets = hs.flatMap((h) => nbPets(h));
        out.pets = pets.length >= 3 && pets.every((f) => !f.adopted && f.scene === "MAPLE_LANE" && !f.canBeSold());
        out.portals = getScenePortals("SHOP_STREET").some((p) => p.target === "MAPLE_LANE") && getScenePortals("MAPLE_LANE").some((p) => p.target === "SHOP_STREET");
        // Night: in; morning: out
        timePlayed = 4 * DAY_LENGTH + 16 * HOUR_LENGTH; // (late evening)
        updateNeighbours(2.1);
        out.night = pets.every((f) => f.scene === "MAPLE_HOME" || f.nbVisit);
        timePlayed = 5 * DAY_LENGTH + 4 * HOUR_LENGTH;
        updateNeighbours(2.1);
        out.morning = pets.every((f) => f.scene === "MAPLE_LANE" || f.nbVisit);
        // Fed by their owners
        pets[0].hunger = 0.1;
        for (let i = 0; i < 30; i++) updateNeighbours(2.1);
        out.fed = pets[0].hunger > 0.3;
        // Save and load
        const st = SAVED_GAME_STATE.find((s) => s.name === "neighbourState");
        const data = JSON.parse(JSON.stringify(st.get()));
        st.set(data);
        out.loaded = neighbourState.houses.length === 3 && neighbourState.houses[0].who === data.houses[0].who;
        const f2 = Horse.deserialize(JSON.parse(JSON.stringify(pets[0].serialize())));
        out.petLoaded = f2.nbOwner === pets[0].nbOwner;
        let err = null;
        try {
          currentScene = "MAPLE_LANE";
          drawMapleLane(ctx);
          nbPanelSlot = 0;
          drawNeighbourPanel(ctx);
          neighbourState.houses[0].request = { kind: "return", petId: pets[0].id, day: 1 };
          drawNeighbourPanel(ctx);
          nbPanelSlot = null;
          currentScene = "INDOORS";
        } catch (e) {
          err = String(e && e.stack);
        }
        out.err = err;
        return out;
      }, SETUP);
      checkEqual(r.houses, 3, "three houses");
      checkEqual(r.kinds, 3, "three different neighbours");
      check(r.pets, "their fluffies are theirs, on the lawns");
      check(r.portals, "Shopping Street <-> Maple Lane");
      check(r.night && r.morning, "in at night, out in the morning");
      check(r.fed, "their owners feed them");
      check(r.loaded && r.petLoaded, "saved and loaded");
      checkEqual(r.err, null, "it draws");
    },
  },
  {
    name: "neighbours: their fluffies wander into your backyard and go home later; their mare in foal to your stallion - the kind one's thrilled, the fussy one's furious",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const h = __house("careless");
        const f = nbPets(h)[0];
        _nbVisitStarts(h, f);
        out.visiting = f.scene === "BACKYARD" && !!f.nbVisit;
        timePlayed = f.nbVisit.until + 1;
        updateNeighbours(2.1);
        out.home = f.scene === "MAPLE_LANE" && !f.nbVisit;
        // Breeding
        const stud = new Horse(1, null, "BACKYARD", "earthy", null, 0.6, 0.6, "male");
        stud.adopted = true;
        fluffies.push(stud);
        const fussy = __house("fussy");
        const mare = nbPets(fussy)[0];
        mare.gender = "female";
        fussy.goodwill = 0;
        onNeighbourMating(mare, stud);
        out.fussy = fussy.goodwill === NB_KINDS.fussy.reactBreed.theirs;
        const kind = __house("kind");
        const mare2 = nbPets(kind)[0];
        kind.goodwill = 0;
        onNeighbourMating(mare2, stud);
        out.kind = kind.goodwill === NB_KINDS.kind.reactBreed.theirs;
        return out;
      }, SETUP);
      check(r.visiting && r.home, "a visit, then home");
      check(r.fussy && r.kind, "breeding reactions");
    },
  },
  {
    name: "neighbours: pet-sitting - accept, it comes to your house; back in fine shape: paid and liked; hurt: no pay and held against you; dead: never forgiven",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const h = __house("kind");
        const f = nbPets(h)[0];
        h.request = { kind: "sit", petId: f.id, days: 1, pay: 100, day: getDayNumber() };
        out.accepted = nbAcceptSit(h) && f.scene === "INDOORS" && !!f.petSitting;
        const m0 = money;
        h.goodwill = 0;
        timePlayed = f.petSitting.until + 1;
        updateNeighbours(2.1);
        out.fine = money === m0 + 100 && h.goodwill > 0 && f.scene === "MAPLE_LANE" && !f.petSitting;
        // Hurt this time
        h.request = { kind: "sit", petId: f.id, days: 1, pay: 100, day: getDayNumber() };
        nbAcceptSit(h);
        f.health = (f.petSitting.health ?? 100) - 40;
        const m1 = money;
        h.goodwill = 0;
        const res = nbEndSit(h, f);
        out.hurt = res.pay === 0 && money === m1 && h.goodwill === -30;
        // Dead
        h.request = { kind: "sit", petId: f.id, days: 1, pay: 100, day: getDayNumber() };
        nbAcceptSit(h);
        h.goodwill = 0;
        f.die(null, "Illness");
        updateNeighbours(2.1);
        out.dead = h.goodwill === -60 && !fluffies.includes(f);
        return out;
      }, SETUP);
      check(r.accepted, "it comes to your house");
      check(r.fine, "back in fine shape: paid and liked");
      check(r.hurt, "hurt: no pay, held against you");
      check(r.dead, "dead: never forgiven");
    },
  },
  {
    name: "neighbours: complaints about your yard, and the council's fine; keeping one of theirs (give it back or keep it); selling them one; the careless one moves away and leaves the pets in the alley, and someone new moves in",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const h = __house("fussy");
        // A crowded backyard
        for (let i = 0; i < 15; i++) {
          const f = new Horse(1, null, "BACKYARD", "earthy");
          f.adopted = true;
          fluffies.push(f);
        }
        out.nuisance = nbNuisance().total > 0.5;
        h.goodwill = 0;
        const rnd = Math.random;
        Math.random = () => 0.05;
        timePlayed += DAY_LENGTH;
        updateNeighbours(2.1);
        Math.random = rnd;
        out.complained = h.goodwill < 0 && h.notes.some((n) => /complained/.test(n.text));
        // The council
        h.goodwill = -80;
        const m0 = money;
        neighbourState.finedDay = null;
        timePlayed += DAY_LENGTH;
        updateNeighbours(2.1);
        out.fined = money === m0 - NB_FINE;
        const m1 = money;
        timePlayed += DAY_LENGTH;
        updateNeighbours(2.1);
        out.onceAWeek = money === m1;
        // Keeping one of theirs
        h.goodwill = 0;
        h.request = null;
        const pet = nbPets(h)[0];
        pet.adopted = true;
        updateNeighbours(2.1);
        out.asks = h.request && h.request.kind === "return";
        nbReturnPet(h);
        out.back = !pet.adopted && pet.scene === "MAPLE_LANE";
        pet.adopted = true;
        updateNeighbours(2.1);
        nbKeepPet(h);
        out.kept = pet.nbOwner == null && h.goodwill <= -40;
        // Selling them one
        const kind = __house("kind");
        kind.goodwill = 10;
        const mine = new Horse(1, null, "INDOORS", "earthy");
        mine.adopted = true;
        fluffies.push(mine);
        const k = getBuyerKind("neighbour");
        out.buyer = !!k && k.weight(1) > 0 && /Maple Lane/.test(k.label);
        currentSellRequest = { fluffyId: mine.id, fluffy: mine, price: 300, buyer: "neighbour", maxPay: 300 };
        acceptSellRequest();
        out.sold = fluffies.includes(mine) && !mine.adopted && mine.nbOwner === kind.id && mine.scene === "MAPLE_LANE";
        // Moving away
        const dale = __house("careless");
        const dpets = nbPets(dale);
        nbMoveOut(dale);
        out.left = dpets.length > 0 && dpets.every((f) => f.scene === "ALLEY" && f.nbOwner == null && f.formerPet && f.formerPet.how === "dumped");
        out.vacant = dale.vacant === true;
        let n = 0;
        while (nbHouseAt(dale.slot).vacant && n++ < 12) {
          timePlayed += DAY_LENGTH;
          updateNeighbours(2.1);
        }
        out.newcomer = !nbHouseAt(dale.slot).vacant && nbPets(nbHouseAt(dale.slot)).length > 0;
        return out;
      }, SETUP);
      check(r.nuisance && r.complained, "complaints about a crowded yard");
      check(r.fined && r.onceAWeek, "the council fines you - once a week at most");
      check(r.asks && r.back && r.kept, "keeping one of theirs");
      check(r.buyer && r.sold, "a neighbour buys one: it lives on Maple Lane");
      check(r.left && r.vacant && r.newcomer, "moving away, and someone new");
    },
  },
];
