// Fixes from the whole-project review (bugs found across the game)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __clearScene("PARK");
  __clearScene("BACKYARD");
  herdState = freshHerdState();
  _herdChanged();
  outings = freshOutings();
  window.__rv = (scene = "INDOORS", x = 400, gender = "female", growth = 1) => {
    const f = new Horse(growth, null, scene, "earthy", null, 0.6, 0.6, gender);
    f.adopted = true;
    f.x = x;
    f.y = 450;
    f.hunger = 1;
    f.happiness = 0.6;
    f.personalities = f.personalities.filter((p) => p !== "smarty");
    fluffies.push(f);
    return f;
  };
}`;

module.exports = [
  {
    name: "review: spam care doesn't heal or warm past the daily allowance; praise heals once; Cherished slips to Wary; one fight, one defend",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __rv();
        f.title = "Broken";
        f.titleState = null;
        for (let i = 0; i < 50; i++) giveAffection(f, "brushed");
        out.healing = +(_tiState(f).healing || 0).toFixed(3);
        // Praise: one heal each
        const g = __rv("INDOORS", 600);
        g.title = "Broken";
        g.titleState = null;
        praiseFluffy(g);
        out.praiseHeal = +(_tiState(g).healing || 0).toFixed(3);
        // Cherished but no longer trusted
        const c = __rv("INDOORS", 800);
        c.title = "Cherished";
        c.playerTrust = 0.3;
        _tiDaily(c);
        out.cherished = titleOf(c);
        // Defending: three blows in one fight count once
        const d = __rv("INDOORS", 300);
        d.titleState = null;
        const victim = { id: 12345 };
        for (let i = 0; i < 3; i++) noteTitleDefend(d, victim);
        out.defends = _tiState(d).defends;
        return out;
      }, SETUP);
      check(r.healing <= 0.07, `50 brushes heal no more than the daily allowance: ${r.healing}`);
      checkEqual(r.praiseHeal, 0.02, "praise heals once");
      checkEqual(r.cherished, "Wary", "Cherished that's lost your trust");
      checkEqual(r.defends, 1, "one fight, one defend");
    },
  },
  {
    name: "review: nothing sends a strapped-down, caged or time-out fluffy walking; a pregnant mare keeps her foal wish",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __rv("INDOORS", 200);
        const b = __rv("INDOORS", 900, "male");
        changeOpinion(a, b, 0.9);
        a.placedOn = { fake: true };
        out.placed = canBeMovedExternally(a);
        a.placedOn = null;
        a.timeOut = { until: timePlayed + 30, x: 10, y: 10 };
        out.timeOut = canBeMovedExternally(a);
        a.timeOut = null;
        out.free = canBeMovedExternally(a);
        // A huddle in a tense room doesn't move a strapped one
        roomClimate = freshRoomClimate();
        _climateCache = null;
        addRoomClimate("INDOORS", { t: 12 });
        a.placedOn = { fake: true };
        a.initBehavior("IDLE");
        for (let i = 0; i < 10; i++) updateHuddles(HUDDLE_CHECK);
        out.huddled = !!a._huddle;
        a.placedOn = null;
        roomClimate = freshRoomClimate();
        _climateCache = null;
        // The foal wish survives her getting pregnant
        const m = __rv("INDOORS", 500);
        m.wish = { id: "foal", since: timePlayed, ache: 0 };
        m.isPregnant = true;
        updateWishes(3);
        out.wish = m.wish && m.wish.id;
        m.isPregnant = false;
        return out;
      }, SETUP);
      checkEqual(r.placed, false, "strapped down");
      checkEqual(r.timeOut, false, "in time-out");
      checkEqual(r.free, true, "free to go");
      checkEqual(r.huddled, false, "no huddle for the strapped one");
      checkEqual(r.wish, "foal", "the wish waits for the birth");
    },
  },
  {
    name: "review: a foal's dad is the sire (saved); bought stock's made-up ancestors still count as family",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const grandad = __rv("INDOORS", 200, "male");
        const mum = __rv("INDOORS", 300, "female");
        mum.fatherId = grandad.id;
        const sire = __rv("INDOORS", 400, "male");
        mum.babyDaddyId = sire.id;
        mum.fatherGenes = [...sire.genes];
        mum.anatomy.spawnBaby(true);
        const baby = fluffies.find((x) => x.motherId === mum.id);
        out.dad = [baby.fatherId === sire.id, (relationships[baby.id] || {})[sire.id], (relationships[baby.id] || {})[grandad.id] || null];
        // Saved
        const data = JSON.parse(JSON.stringify(mum.serialize()));
        out.saved = data.babyDaddyId === sire.id;
        // Ancestors with bigger ids than the fluffy (like bought stock)
        const kid = __rv("INDOORS", 600);
        const anc = __rv("INDOORS", 700);
        kid.motherId = anc.id; // (anc has the bigger id)
        recordFluffy(kid);
        recordFluffy(anc);
        _kinCache = new Map();
        out.stock = relatedness(kid, anc);
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.dad), JSON.stringify([true, "father", null]), "the sire is the father, not mum's own dad");
      check(r.saved, "the sire is saved with her");
      checkEqual(r.stock, 0.5, "a mother with a bigger id is still the mother");
    },
  },
  {
    name: "review: your fluffies and the park's don't share herds; a raid is saved, fights only up close and a few at most",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        // A herd of yours; one runs away (goes wild): it leaves the herd
        const hs = [__rv("INDOORS", 300), __rv("INDOORS", 350), __rv("INDOORS", 400)];
        for (const a of hs) for (const b of hs) if (a !== b) changeOpinion(a, b, 0.9);
        herdState.list.push({ id: 71, name: "Home", memberIds: hs.map((f) => f.id), leaderId: hs[0].id, colorIndex: 1 });
        _herdChanged();
        hs[2].adopted = false;
        hs[2].formerPet = { how: "ran away", day: 1 };
        updateHerds(3);
        out.left = !herdOf(hs[2]) || herdOf(hs[2]).id !== 71;
        out.stayed = herdOf(hs[0]) && herdOf(hs[0]).id === 71;
        // A raid: saved in outings, and fights are capped
        const boss = __rv("PARK", 500, "male");
        boss.adopted = false;
        boss.title = "Rebel";
        boss.formerPet = { how: "ran away", day: 1, name: "Rowan" };
        const gang = [boss, __rv("PARK", 560, "male"), __rv("PARK", 620, "male")];
        for (const g of gang) g.adopted = false;
        herdState.list.push({ id: 72, name: "Raid", memberIds: gang.map((f) => f.id), leaderId: boss.id, colorIndex: 2 });
        _herdChanged();
        const mine = __rv("BACKYARD", 100);
        mine.x = gang[0].x;
        startRaid(true);
        out.saved = !!(outings.raid && outings.raid.ids.length === 3);
        // Saved and loaded (JSON), it's still there to end in the morning
        outings = JSON.parse(JSON.stringify(outings));
        out.afterLoad = isRaiding();
        // Put everyone right on top of one of yours: at most RAID_HITS blows
        for (let i = 0; i < 200; i++) {
          for (const g of gang) {
            g.x = mine.x + 10;
            g.y = mine.y;
            g.attackCooldown = 0;
          }
          mine.health = 100;
          updateParkOutings(1);
        }
        out.hits = outings.raid ? outings.raid.hits : "ended";
        _raid.until = 0;
        updateParkOutings(1);
        out.ended = !isRaiding() && gang.every((f) => f.scene === "PARK");
        return out;
      }, SETUP);
      check(r.left, "the runaway left your herd");
      check(r.stayed, "the rest stayed");
      check(r.saved, "the raid is in the saved state");
      check(r.afterLoad, "still raiding after a load");
      check(r.hits === "ended" || r.hits <= 6, `blows landed: ${r.hits}`);
      check(r.ended, "raiders go home in the morning");
    },
  },
  {
    name: "review: little foals come on an outing with mum; right-clicks don't press buttons on screens; M from the magnifying glass",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        changeScene("INDOORS");
        const mum = __rv("INDOORS", 300);
        const baby = __rv("INDOORS", 350, "male", 0.05);
        baby.motherId = mum.id;
        startOuting("INDOORS");
        out.babyCame = baby.scene === "PARK";
        endOuting("home");
        changeScene("INDOORS");
        out.babyHome = baby.scene === "INDOORS";
        // Accounts open: a right-click on Borrow does nothing
        economy = freshEconomy();
        economy.week = [{ day: 1, amount: 1000 }];
        openAccounts();
        return out;
      }, SETUP);
      const L = await page.evaluate(() => getAccountsLayout());
      const o = L.offers[0];
      await page.mouse.click(o.x + 10, o.y + 10, { button: "right" });
      const loanRight = await page.evaluate(() => [isAccountsOpen(), !!economy.loan]);
      await page.evaluate(() => closeAccounts());
      // M with a magnifying glass open: the map, with that fluffy picked
      await page.evaluate(() => {
        inspectedFluffy = fluffies[0];
      });
      await page.keyboard.press("KeyM");
      const m = await page.evaluate(() => {
        const res = [isRelationshipMapOpen(), relMapSel === fluffies[0].id, inspectedFluffy];
        closeRelationshipMap();
        return res;
      });
      check(r.babyCame, "the little foal came with mum");
      check(r.babyHome, "and came home");
      checkEqual(JSON.stringify(loanRight), JSON.stringify([true, false]), "right-click: no loan, still open");
      checkEqual(JSON.stringify(m), JSON.stringify([true, true, null]), "M from the magnifying glass");
    },
  },
];
