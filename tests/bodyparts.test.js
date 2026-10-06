// Body parts and bodies (BodyParts.js): carried between rooms, fluffies
// react to what you bring (family grieve, a foal is only puzzled), the knife
// cuts up a body on a table, chirpies are frightened by heavy metal
const { check, checkEqual } = require("./helpers");
const src = require("fs").readFileSync(__dirname + "/playtest6.test.js", "utf8");
const SETUP = src.match(/const SETUP = `([\s\S]*?)`;/)[1];

module.exports = [
  {
    name: "body parts: a held part comes along to another room (keys or a room's wall hint); set down, family grieve and remember, a stranger is frightened (a head most), a foal is puzzled; saved with whose it was",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const victim = __mk(300, { name: "Pip" });
        const mum = __mk(500, { name: "Clover", gender: "female" });
        victim.motherId = mum.id;
        setRelationship(mum.id, victim.id, "baby_child");
        setRelationship(victim.id, mum.id, "mother");
        const stranger = __mk(560, { name: "Moss" });
        const foal = __mk(620, { growth: 0.15, type: "pegasus" });
        victim.renderer.ensureTintedImages();
        victim.die(null, "Test");
        const leg = victim.anatomy.spawnGib("leg");
        out.owner = leg.ownerId === victim.id;
        // Held, to another room by keys
        leg.freeGib = true;
        leg.isDragging = true;
        isGlobalDragging = true;
        changeScene("BACKYARD");
        out.carried = leg.scene === "BACKYARD";
        changeScene("INDOORS");
        // Saved: whose it was
        const data = leg.serialize();
        out.saved = Gib.deserialize(JSON.parse(JSON.stringify(data))).ownerId === victim.id;
        // Set down near them
        leg.isDragging = false;
        isGlobalDragging = false;
        leg.x = 560;
        leg.y = 520;
        const h0 = { mum: mum.happiness, stranger: stranger.happiness, foal: foal.happiness };
        __seedRandom(3);
        stranger.bloodTolerance = 0;
        leg.onDrop();
        out.mumGrief = mum.happiness < h0.mum - 0.1 && (mum.playerMemories || []).some((m) => m.type === "body_part");
        out.strangerScared = stranger.happiness < h0.stranger;
        out.foalPuzzled = understandsDeath(foal) || (!foal.isScared && foal.happiness >= h0.foal - 1e-9);
        // A head is worse
        const s2 = __mk(700, { name: "Bean" });
        s2.bloodTolerance = 0;
        const head = victim.anatomy.spawnGib("head");
        head.x = 700;
        head.y = 520;
        const s2h = s2.happiness;
        stranger._partSeenAt = -Infinity;
        const sh = stranger.happiness;
        reactToBodyPart(s2, head);
        out.headWorse = s2h - s2.happiness > PART_SAD.part;
        return out;
      }, SETUP);
      check(r.owner, "a part knows whose it was");
      check(r.carried, "held, it comes to another room");
      check(r.saved, "saved with whose it was");
      check(r.mumGrief, "its mum grieves and remembers it was you");
      check(r.strangerScared, "a stranger is frightened");
      check(r.foalPuzzled, "a little foal is only puzzled");
      check(r.headWorse, "a head is the worst");
    },
  },
  {
    name: "body parts: the knife cuts up a body only on a table - a part each time, the one you click if it's there - and it comes apart into head and torso at the end",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const body = __mk(500, { growth: 1 });
        body.renderer.ensureTintedImages();
        body.die(null, "Test");
        const knife = new Knife("knife", "INDOORS");
        // On the floor: not here
        const n0 = gibs.length;
        cutBody(body, knife);
        out.floor = gibs.length === n0;
        // On a table
        const table = new OperatingTable("INDOORS");
        table.x = 500;
        table.y = 560;
        objects.push(table);
        table.update(0);
        body.x = table.x;
        body.y = table.y;
        body.updateLayout();
        body.onDrop();
        out.onTable = bodyOnTable(body);
        const g1 = cutBody(body, knife, "tail");
        out.tailFirst = !!g1 && g1.length === 1 && body.limbs.tail === false;
        let guard = 0;
        while (!body.isDestroyed && guard++ < 20) cutBody(body, knife);
        out.apart = body.isDestroyed;
        out.headAndTorso = gibs.filter((g) => g.ownerId === body.id && (g.type === "head" || g.type === "torso")).length === 2;
        out.cuts = gibs.filter((g) => g.ownerId === body.id).length;
        objects.splice(objects.indexOf(table), 1);
        return out;
      }, SETUP);
      check(r.floor, "not on the floor");
      check(r.onTable, "a body can go on the table");
      check(r.tailFirst, "the part you click comes off");
      check(r.apart, "with nothing left it comes apart");
      check(r.headAndTorso, "into a head and a torso");
      check(r.cuts >= 6, `a part each cut (${r.cuts})`);
    },
  },
  {
    name: "body parts: chirpies in earshot of heavy metal cry, tremble and go to mum - a little more used to it each time",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const mum = __mk(300, { gender: "female" });
        const chirpy = __mk(600, { growth: 0.1 });
        chirpy.motherId = mum.id;
        const tv = new FluffTV("INDOORS");
        tv.x = 650;
        tv.y = 480;
        objects.push(tv);
        tv.channel = "HEAVY_METAL";
        __seedRandom(1);
        const n = chirpiesHearMetal(tv);
        out.scared = n === 1 && chirpy.isScared;
        out.toMum = Math.abs(chirpy.targetX - mum.x) < 60;
        out.trembles = beginFrightShake(document.createElement("canvas").getContext("2d"), chirpy);
        let reacted = 0;
        for (let i = 0; i < 12; i++) reacted += chirpiesHearMetal(tv);
        out.usedTo = chirpy.metalUsed;
        out.fewer = reacted < 12;
        objects.splice(objects.indexOf(tv), 1);
        return out;
      }, SETUP);
      check(r.scared, "a chirpy is frightened by it");
      check(r.toMum, "it crawls to its mum");
      check(r.trembles, "it trembles");
      check(r.usedTo > 0.5 && r.fewer, `it gets used to it (${r.usedTo})`);
    },
  },
];
