// Herds holding and fighting over meadows in Fluffy Park (Territory.js)
const { check, checkEqual } = require("./helpers");

// All mares in the park. __family(n, x, y, name): a mum and n grown daughters
const SETUP = `() => {
  __clearScene("PARK");
  __seedRandom(33);
  herdState = freshHerdState();
  _herdChanged();
  changeScene("PARK");
  const mare = (mom, x, y, name) => {
    const h = new Horse(1, mom ? mom.id : null, "PARK", "earthy", null, null, null, "female");
    h.x = x;
    h.y = y;
    h.happiness = 0.8;
    h.hunger = 1;
    fluffyNames[h.id] = name;
    fluffies.push(h);
    return h;
  };
  window.__family = (n, x, y, name) => {
    const mum = mare(null, x, y, name + "Mum");
    const kids = [];
    for (let i = 0; i < n; i++) kids.push(mare(mum, x + 30 * (i + 1), y + 10 * i, name + "Kid" + i));
    return [mum, ...kids];
  };
  window.__loner = (x, y, name) => mare(null, x, y, name);
  window.__herds = () => { _herdTimer = 0; updateHerds(3); };
  window.__territory = (seconds = 2) => {
    for (let s = 0; s < seconds; s += 2) { _territoryTimer = 0; updateTerritories(0); } // one 2s tick each
  };
}`;

module.exports = [
  {
    name: "territory: herds claim the nearest free meadow, and keep it after saving",
    run: async (page) => {
      const r = await page.evaluate(async (setup) => {
        eval(setup)();
        const m0 = PARK_MEADOWS[0];
        const red = __family(2, m0.x, m0.y, "Red");
        const blue = __family(2, m0.x + 60, m0.y + 40, "Blue"); // same spot
        __herds();
        __territory();
        const hr = herdOf(red[0]);
        const hb = herdOf(blue[0]);
        const res = { red: hr.territory, blue: hb.territory, describe: describeHerd(red[1]) };
        gameState = "PAUSED";
        await saveGame("__automated_test__");
        herdState = freshHerdState();
        _herdChanged();
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        gameState = "PAUSED";
        const back = fluffies.find((f) => f.id === red[0].id);
        res.afterLoad = herdOf(back) && herdOf(back).territory;
        return res;
      }, SETUP);
      checkEqual(r.red === 0 || r.blue === 0, true, "one herd holds the meadow they're standing in");
      check(r.red !== null && r.blue !== null && r.red !== r.blue, `both herds have their own meadow: ${r.red}, ${r.blue}`);
      check(r.describe.includes("home:"), `herd description: ${r.describe}`);
      checkEqual(r.afterLoad, r.red, "red's meadow after loading");
    },
  },
  {
    name: "territory: a bigger herd that stays in a meadow long enough takes it over",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = PARK_MEADOWS[2];
        const small = __family(2, m.x, m.y, "Small");
        __herds();
        __territory();
        const hs = herdOf(small[0]);
        const res = { claimed: hs.territory === 2 };
        // A bigger herd walks in (and nobody moves: we only run the territory code)
        const big = __family(4, m.x - 80, m.y + 20, "Big");
        __herds();
        const hb = herdOf(big[0]);
        hb.territory = 6; // they have a home elsewhere, but want this one
        __territory(10);
        res.notYet = hs.territory === 2;
        __territory(14);
        res.small = hs.territory;
        res.big = hb.territory;
        res.grudge = getOpinion(small[0], big[0]);
        res.why = small[0].opinionWhy[big[0].id];
        return res;
      }, SETUP);
      check(r.claimed, "the small herd didn't claim its meadow");
      check(r.notYet, "took over too quickly");
      checkEqual(r.big, 2, "big herd's meadow");
      check(r.small !== 2, "small herd still holds the meadow");
      check(r.grudge <= -0.15, `losers' opinion of the winners: ${r.grudge}`);
      checkEqual(r.why, "took its meadow", "why they're upset");
    },
  },
  {
    name: "territory: owners chase an intruder out",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = PARK_MEADOWS[3];
        const fam = __family(3, m.x, m.y, "Home");
        __herds();
        __territory();
        const h = herdOf(fam[0]);
        const stranger = __loner(m.x + 100, m.y + 30, "Stranger");
        // Make sure nobody's too timid, and the stranger doesn't stand its ground
        const oldTv = traitValue;
        traitValue = () => 0;
        __territory();
        const chasers = fam.filter((f) => f._defend && f._defend.id === stranger.id).length;
        __fastForward(25);
        traitValue = oldTv;
        return {
          held: h.territory === 3,
          chasers,
          wasChased: !!stranger._chasedOff || !inTerritoryZone(3, stranger.x, stranger.y),
          outside: !inTerritoryZone(3, stranger.x, stranger.y),
          alive: stranger.isAlive,
          friends: fam.some((f) => getLiking(stranger, f) >= 0.45),
        };
      }, SETUP);
      check(r.held, "herd didn't hold the meadow");
      checkEqual(r.chasers, 1, "fluffies sent after a lone intruder");
      check(r.outside, "the intruder is still inside after 25s");
      check(!r.friends, "the herd made friends with the fluffy it was chasing off");
    },
  },
  {
    name: "territory: hungry fluffies eat at home and avoid other herds' food",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m1 = PARK_MEADOWS[1];
        const m4 = PARK_MEADOWS[4];
        const home = __family(2, m1.x, m1.y, "Home");
        const other = __family(2, m4.x, m4.y, "Other");
        __herds();
        herdOf(home[0]).territory = 1;
        herdOf(other[0]).territory = 4;
        const own = new Grass(m1.x, m1.y, "PARK", 2);
        const theirs = new Grass(m4.x, m4.y, "PARK", 2);
        const f = home[1];
        f.hunger = 0.5;
        const res = { own: territoryFoodBias(f, own), theirs: territoryFoodBias(f, theirs) };
        f.hunger = 0.1;
        res.starving = territoryFoodBias(f, theirs);
        return res;
      }, SETUP);
      checkEqual(r.own, -150, "own land");
      checkEqual(r.theirs, 450, "another herd's land");
      checkEqual(r.starving, 150, "another herd's land when starving");
    },
  },
  {
    name: "territory: a herd that gets too big splits, and the new herd looks for land",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = PARK_MEADOWS[0];
        const a = __family(6, m.x, m.y, "A");
        const b = __family(6, m.x + 50, m.y + 50, "B");
        __herds();
        // Merge them into one big herd (as if they'd bonded over time)
        const h = herdOf(a[0]);
        const hb = herdOf(b[0]);
        for (const f of b) if (!h.memberIds.includes(f.id)) h.memberIds.push(f.id);
        herdState.list = herdState.list.filter((x) => x !== hb);
        _herdChanged();
        h.formedAt = -1000;
        const before = h.memberIds.length;
        __herds();
        const after = h.memberIds.length;
        const others = herdState.list.filter((x) => x !== h);
        const nh = others[0];
        const res = { before, after, herds: herdState.list.length, newSize: nh ? nh.memberIds.length : 0 };
        // They don't just walk back in
        __herds();
        __herds();
        res.stillSplit = herdState.list.length === 2;
        __territory();
        res.bothHaveLand = herdState.list.every((x) => x.territory !== null);
        return res;
      }, SETUP);
      checkEqual(r.before, 14, "size before");
      checkEqual(r.herds, 2, "herds after splitting");
      check(r.after >= 2 && r.newSize >= 3 && r.after + r.newSize === 14, `sizes: ${r.after} + ${r.newSize}`);
      check(r.stillSplit, "the split-off group rejoined straight away");
      check(r.bothHaveLand, "both herds should find a meadow");
    },
  },
];
