// Herds (Herds.js)
const { check, checkEqual } = require("./helpers");

// All mares (no smarties to start fights). Returns ids.
// family(n, x): a mum and n grown daughters; loner(x): a stranger
const SETUP = `() => {
  __clearScene();
  __seedRandom(21);
  herdState = freshHerdState();
  _herdChanged();
  const mare = (mom, x, name) => {
    const h = new Horse(1, mom ? mom.id : null, "INDOORS", "earthy", null, null, null, "female");
    h.adopted = true;
    h.x = x;
    h.y = 480;
    h.happiness = 0.8;
    fluffyNames[h.id] = name;
    fluffies.push(h);
    return h;
  };
  window.__family = (n, x, name) => {
    const mum = mare(null, x, name + "Mum");
    const kids = [];
    for (let i = 0; i < n; i++) kids.push(mare(mum, x + 40 * (i + 1), name + "Kid" + i));
    return [mum, ...kids];
  };
  window.__loner = (x, name) => mare(null, x, name);
  window.__tick = (seconds = 3) => {
    for (let s = 0; s < seconds; s += 3) updateHerds(3);
  };
}`;

module.exports = [
  {
    name: "herds: a family forms a herd with a grown-up leader and a name",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const fam = __family(3, 300, "Red");
        const loner = __loner(1000, "Lone");
        __tick();
        const h = herdOf(fam[0]);
        return {
          herds: herdState.list.length,
          size: h && h.memberIds.length,
          allIn: fam.every((f) => herdOf(f) === h),
          lonerIn: !!herdOf(loner),
          leaderIsFamily: h && fam.some((f) => f.id === h.leaderId),
          name: h && getHerdName(h),
          describe: describeHerd(fam[1]),
        };
      }, SETUP);
      checkEqual(r.herds, 1, "herds formed");
      checkEqual(r.size, 4, "herd size");
      check(r.allIn, "not all the family is in the herd");
      check(!r.lonerIn, "a stranger far away joined");
      check(r.leaderIsFamily, "leader isn't one of the family");
      check(/ herd$/.test(r.name), `herd name: ${r.name}`);
      check(r.describe.includes("led by"), `description: ${r.describe}`);
    },
  },
  {
    name: "herds: newborns join mum's herd, friends of 2+ members join too",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const fam = __family(3, 300, "Red");
        __tick();
        const h = herdOf(fam[0]);
        // A foal is born to one of the daughters
        const foal = new Horse(0, fam[1].id, "INDOORS");
        foal.adopted = true;
        fluffies.push(foal);
        // A stranger who gets on well with two of them
        const pal = __loner(500, "Pal");
        for (const f of [fam[1], fam[2]]) {
          pal.opinions[f.id] = 0.6;
          f.opinions[pal.id] = 0.6;
        }
        const other = __loner(520, "Other"); // likes only one of them
        other.opinions[fam[3].id] = 0.6;
        fam[3].opinions[other.id] = 0.6;
        __tick();
        return { foal: herdOf(foal) === h, pal: herdOf(pal) === h, other: herdOf(other) === h, size: h.memberIds.length };
      }, SETUP);
      check(r.foal, "the foal didn't join mum's herd");
      check(r.pal, "a fluffy bonded with two members didn't join");
      check(!r.other, "a fluffy bonded with only one member joined");
      checkEqual(r.size, 6, "herd size");
    },
  },
  {
    name: "herds: members who hate the leader leave; lost leaders are replaced; tiny herds break up",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const fam = __family(3, 300, "Red");
        __tick();
        const h = herdOf(fam[0]);
        const res = {};
        // One daughter comes to hate the leader
        const leader = getHerdLeader(h);
        const rebel = fam.find((f) => f !== leader);
        rebel.opinions[leader.id] = -0.9;
        __tick();
        res.rebelLeft = herdOf(rebel) !== h;
        // The leader dies: someone else takes over
        leader.die(null, "test");
        __tick();
        const newLeader = getHerdLeader(h);
        res.newLeader = !!newLeader && newLeader !== leader && h.memberIds.includes(newLeader.id);
        // Everyone but one leaves: the herd breaks up
        for (const f of getHerdMembers(h).slice(1)) f.die(null, "test");
        __tick();
        res.herdsLeft = herdState.list.length;
        return res;
      }, SETUP);
      check(r.rebelLeft, "a member who hates the leader stayed");
      check(r.newLeader, "no new leader after the old one died");
      checkEqual(r.herdsLeft, 0, "herds after all but one member died");
    },
  },
  {
    name: "herds: herd-mates like each other more, rival herds grow apart",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const red = __family(2, 200, "Red");
        const blue = __family(2, 900, "Blue");
        // (wild herds: under your roof they don't keep apart - batch9 test)
        for (const f of [...red, ...blue]) f.adopted = false;
        __tick();
        const res = {
          twoHerds: herdOf(red[0]) && herdOf(blue[0]) && herdOf(red[0]) !== herdOf(blue[0]),
          mateBonus: herdLikingBonus(red[0], red[1]),
          rivalPenalty: herdLikingBonus(red[0], blue[0]),
        };
        // Put a red and a blue fluffy side by side for 10 game minutes
        red[2].x = 600;
        blue[2].x = 660;
        red[2].y = blue[2].y = 500;
        for (let s = 0; s < 600; s++) updateSocialBonds(1);
        for (let s = 0; s < 600; s += 3) updateHerds(3);
        res.opinion = getOpinion(red[2], blue[2]);
        res.why = red[2].opinionWhy[blue[2].id];
        return res;
      }, SETUP);
      check(r.twoHerds, "two families didn't make two herds");
      checkEqual(r.mateBonus, 0.2, "herd-mate bonus");
      checkEqual(r.rivalPenalty, -0.1, "rival herd penalty");
      check(r.opinion <= -0.3, `rivals side by side for 10 min: ${r.opinion.toFixed(2)}`);
      checkEqual(r.why, "rival herd", "reason for the dislike");
    },
  },
  {
    name: "herds: members catch up with their leader",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const fam = __family(2, 300, "Red");
        __tick();
        const h = herdOf(fam[0]);
        const leader = getHerdLeader(h);
        const straggler = fam.find((f) => f !== leader);
        leader.x = 250;
        straggler.x = 1050;
        leader.update = () => {}; // leader stays put
        const before = Math.abs(straggler.x - leader.x);
        __fastForward(12);
        return { before, after: Math.abs(straggler.x - leader.x) };
      }, SETUP);
      check(r.after < r.before - 400, `distance to leader: ${Math.round(r.before)} -> ${Math.round(r.after)}`);
    },
  },
  {
    name: "herds survive saving and loading",
    run: async (page) => {
      const r = await page.evaluate(async (setup) => {
        eval(setup)();
        const fam = __family(3, 300, "Red");
        __tick();
        const want = JSON.stringify(herdState);
        gameState = "PAUSED";
        await saveGame("__automated_test__");
        herdState = freshHerdState();
        _herdChanged();
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        gameState = "PAUSED";
        const back = fluffies.find((f) => f.id === fam[1].id);
        return { same: JSON.stringify(herdState) === want, found: !!herdOf(back) };
      }, SETUP);
      check(r.same, "herds changed after saving and loading");
      check(r.found, "herdOf doesn't work after loading");
    },
  },
];
