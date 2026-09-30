// The relationship map (RelationshipMap.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  herdState = freshHerdState();
  _herdChanged();
  window.__rm = (name, x, y = 450, gender = "female", growth = 1) => {
    const f = new Horse(growth, null, "INDOORS", "earthy", null, 0.6, 0.6, gender);
    f.adopted = true;
    f.x = x;
    f.y = y;
    f.hunger = 1;
    f.happiness = 0.7;
    fluffyNames[f.id] = name;
    fluffies.push(f);
    return f;
  };
  window.__pal = (a, b, v = 0.9) => {
    changeOpinion(a, b, v);
    changeOpinion(b, a, v);
  };
}`;

module.exports = [
  {
    name: "relationship map: herds, families and loners in groups; love, family, grudges, fear, gossip and You lines",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __rm("Daisy", 200);
        const kid = __rm("Pip", 260, 450, "male", 0.5);
        kid.motherId = mum.id;
        const a = __rm("Clover", 600);
        const b = __rm("Rowan", 650, 450, "male");
        const c = __rm("Fern", 700);
        const grub = __rm("Grub", 1000, 450, "male");
        // A herd of three
        herdState.list.push({ id: 77, name: "Test", memberIds: [a.id, b.id, c.id], leaderId: a.id, colorIndex: 1 });
        _herdChanged();
        __pal(a, b);
        relationships[a.id] = relationships[a.id] || {};
        relationships[a.id][b.id] = "special_friend";
        changeOpinion(c, a, 0.7); // one way
        changeOpinion(grub, c, -0.8, "attacked it");
        changeOpinion(c, grub, -0.5, "attacked it");
        changeOpinion(mum, grub, -0.4, "a bully"); // one-sided
        kid.fearedFluffies = [{ id: grub.id, timer: 100 }];
        // Real gossip: Clover loves you and tells Fern... (Fern's new)
        a.playerTrust = 0.95;
        a.playerFear = 0;
        c.settling = true;
        passGossip(a, c);
        grub.playerFear = 0.8;
        grub.playerTrust = 0.1;
        const people = relMapPeople();
        const groups = relMapGroups(people).map((g) => [g.key.split(":")[0], g.members.map((m) => fluffyNames[m.id]).join(",")]);
        const edges = relMapEdges(people).map((e) => [e.kind, fluffyNames[e.a.id], e.b ? fluffyNames[e.b.id] : "you", e.mutual, e.note]);
        const d = relMapDetails(c, { people, groups: relMapGroups(people), edges: relMapEdges(people) });
        return { groups, edges, trail: c.gossip && c.gossip.from, details: d.map((x) => [x.head, x.lines.join("; ")]) };
      }, SETUP);
      const has = (kind, a, b, test = () => true) => r.edges.some((e) => e[0] === kind && e[1] === a && e[2] === b && test(e));
      checkEqual(JSON.stringify(r.groups), JSON.stringify([["herd", "Clover,Rowan,Fern"], ["line", "Daisy,Pip"], ["alone", "Grub"]]), "groups");
      check(has("love", "Clover", "Rowan", (e) => e[3] && e[4] === "special friends"), `special friends: ${JSON.stringify(r.edges)}`);
      check(has("love", "Fern", "Clover", (e) => !e[3]), "one-way love, from Fern to Clover");
      check(has("family", "Daisy", "Pip", (e) => e[4] === "mum"), "mum and foal");
      check(!has("love", "Daisy", "Pip") && !has("love", "Pip", "Daisy"), "ordinary family love isn't drawn twice");
      check(has("grudge", "Grub", "Fern", (e) => e[3] && e[4] === "fights") || has("grudge", "Fern", "Grub", (e) => e[3] && e[4] === "fights"), "fights");
      check(has("grudge", "Daisy", "Grub", (e) => !e[3]), "one-sided grudge");
      check(has("fear", "Pip", "Grub"), "Pip is scared of Grub");
      check(r.trail && r.trail.length === 1, `gossip trail: ${JSON.stringify(r.trail)}`);
      check(has("gossip", "Clover", "Fern", (e) => /kind/.test(e[4])), "gossip path from Clover to Fern");
      check(has("you", "Clover", "you", (e) => e[4] === "trusts you"), "Clover trusts you");
      check(has("you", "Grub", "you", (e) => e[4] === "afraid of you"), "Grub is afraid of you");
      const heads = r.details.map((x) => x[0]);
      check(heads.includes("Loves") && heads.includes("Grudges") && heads.includes("Gossip"), `Fern's details: ${JSON.stringify(r.details)}`);
    },
  },
  {
    name: "relationship map: M and Household open it; chips, picking a fluffy, Show me, Esc; every node fits in the box",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __rm("Clover", 300);
        const b = __rm("Rowan", 500);
        __pal(a, b);
        return out;
      }, SETUP);
      await page.keyboard.press("KeyM");
      const opened = await page.evaluate(() => isRelationshipMapOpen() && isAnyScreenOpen());
      // Toggle a chip, pick a fluffy
      const pos = await page.evaluate(() => {
        const L = getRelMapLayout();
        const n = [...L.nodes.values()].find((x) => fluffyNames[x.f.id] === "Rowan");
        const chip = L.chips.find((c) => c.id === "love");
        return { n: { x: n.x, y: n.y }, chip: { x: chip.x + 10, y: chip.y + 10 } };
      });
      await page.mouse.click(pos.chip.x, pos.chip.y);
      const loveOff = await page.evaluate(() => relMapFilters.love === false);
      await page.mouse.click(pos.chip.x, pos.chip.y);
      await page.mouse.click(pos.n.x, pos.n.y);
      const sel = await page.evaluate(() => fluffyNames[relMapSel]);
      const show = await page.evaluate(() => getRelMapLayout().showMe);
      await page.mouse.click(show.x + 10, show.y + 10);
      const went = await page.evaluate(() => [isRelationshipMapOpen(), inspectedFluffy && fluffyNames[inspectedFluffy.id]]);
      await page.evaluate(() => {
        inspectedFluffy = null;
      });
      // Household button, then Esc
      await page.evaluate(() => openHousehold());
      const hb = await page.evaluate(() => getHouseholdLayout().relations);
      await page.mouse.click(hb.x + 10, hb.y + 10);
      const fromHousehold = await page.evaluate(() => isRelationshipMapOpen() && !isHouseholdOpen());
      await page.keyboard.press("Escape");
      const closed = await page.evaluate(() => !isRelationshipMapOpen());
      // Fits: 1, 7 and 40 fluffies, in several groups; drawing works
      const fit = await page.evaluate(() => {
        const res = [];
        for (const n of [1, 7, 40]) {
          __clearScene();
          herdState = freshHerdState();
          _herdChanged();
          const made = [];
          for (let i = 0; i < n; i++) {
            const f = __rm("F" + i, 100 + (i % 10) * 100);
            if (i % 3 && made.length) f.motherId = made[Math.floor(i / 3) * 3 % made.length].id;
            made.push(f);
          }
          openRelationshipMap();
          _relCache = null;
          const L = getRelMapLayout();
          const G = L.graph;
          const out = [...L.nodes.values()].filter((p) => p.x - p.r < G.x || p.x + p.r > G.x + G.w || p.y - p.r < G.y || p.y + p.r > G.y + G.h).length;
          let err = null;
          try {
            drawRelationshipMap(ctx);
          } catch (e) {
            err = e.message;
          }
          res.push([n, L.nodes.size, out, err]);
          closeRelationshipMap();
        }
        return res;
      });
      check(opened, "M opened it");
      check(loveOff, "chip switched Love off");
      checkEqual(sel, "Rowan", "picked Rowan");
      checkEqual(JSON.stringify(went), JSON.stringify([false, "Rowan"]), "Show me went to Rowan");
      check(fromHousehold, "opened from Household");
      check(closed, "Esc closed it");
      for (const [n, size, out, err] of fit) {
        checkEqual(size, n, `all ${n} on the map`);
        checkEqual(out, 0, `nodes outside the box with ${n}`);
        checkEqual(err, null, `drawing with ${n}`);
      }
    },
  },
];
