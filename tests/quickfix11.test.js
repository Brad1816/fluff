// Quick notes (Oct 5, part 2): foals are only yours if mum is; 30 to a
// room; fewer wishes, and Today lists only the aching ones; a dad in a cage
// talks like a dad
const { check, checkEqual } = require("./helpers");
const src = require("fs").readFileSync(__dirname + "/playtest6.test.js", "utf8");
const SETUP = src.match(/const SETUP = `([\s\S]*?)`;/)[1];

module.exports = [
  {
    name: "quickfix11: a stray or a neighbour's mare foaling in your yard or house doesn't give you the foals; your own mare's are yours",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        __clearScene("BACKYARD");
        const out = {};
        const birth = (mum) => {
          const dad = __mk(800, { growth: 1, gender: "male" });
          mum.fatherGenes = dad.genes.slice();
          mum.babyDaddyId = dad.id;
          const before = new Set(fluffies);
          mum.anatomy.spawnBaby(true);
          return fluffies.filter((f) => !before.has(f) && f.motherId === mum.id)[0];
        };
        const stray = __mk(400, { growth: 1, gender: "female", scene: "BACKYARD" });
        stray.adopted = false;
        const sf = birth(stray);
        out.stray = !!sf && sf.adopted === false;
        const mine = __mk(500, { growth: 1, gender: "female", scene: "BACKYARD" });
        mine.adopted = true;
        const mf = birth(mine);
        out.mine = !!mf && mf.adopted === true;
        const nb = __mk(600, { growth: 1, gender: "female", scene: "INDOORS" });
        nb.adopted = false;
        nb.nbOwner = 77;
        const nf = birth(nb);
        out.nb = !!nf && nf.adopted === false && nf.nbOwner === 77;
        // (and the living room doesn't adopt it either)
        for (let i = 0; i < 5; i++) nf.update(0.1);
        out.nbStays = nf.adopted === false;
        return out;
      }, SETUP);
      check(r.stray, "a stray's foal isn't yours");
      check(r.mine, "your mare's foal is yours");
      check(r.nb && r.nbStays, "a neighbour's mare's foal is the neighbour's");
    },
  },
  {
    name: "quickfix11: 30 fluffies to a room; wishes come along less often; Today only lists the aching ones (the rest are one line); a dad in a cage talks like a dad, and doesn't keep shouting he's coming",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        out.room = roomSpace("INDOORS");
        // Wishes: a fluffy with no wish doesn't get one straight away
        const f = __mk(300, { growth: 1 });
        f.wish = null;
        f.wishCooldownUntil = undefined;
        updateWish(f, 2);
        out.notAtOnce = f.wish === null;
        let n = 0;
        for (let i = 0; i < 400 && !f.wish; i++) {
          updateWish(f, DAY_LENGTH / 50);
          n++;
        }
        out.eventually = !!f.wish;
        // Today
        const g = __mk(500, { growth: 1 });
        g.wish = { id: "toy", since: timePlayed, ache: 0 };
        f.wish = { id: "friend", since: timePlayed - (WISH_PATIENCE_DAYS + 1) * DAY_LENGTH, ache: 0.1 };
        _todayCache = null;
        const items = todayItems().map((i) => `${i.level}: ${i.text}`);
        out.aching = items.some((t) => /chance: .* is aching for a wish/.test(t));
        out.quiet = items.some((t) => /info: .* has a wish \(Mind tab\)/.test(t));
        // A dad and his foal through the bars
        const dad = __mk(400, { growth: 1, gender: "male" });
        const foal = __mk(600, { growth: 0.4 });
        setRelationship(dad.id, foal.id, "baby_child");
        setRelationship(foal.id, dad.id, "father");
        out.dadKey = _clRelKey(dad, foal);
        out.foalKey = _clRelKey(foal, dad);
        out.lines = !!(DIALOGUE.CAGE_TALK.INSIDE.BABY_DAD && DIALOGUE.CAGE_TALK.OUTSIDE.DAD && DIALOGUE.DADDEH_COMIN);
        // Caged, he doesn't shout he's coming
        const c = __cage(300);
        __put(dad, c);
        dad.speech.text = null;
        foal.foalCallingMum = () => true;
        dad.canHear = () => true;
        out.noShout = dad.positioning.scoutForBabies() === false;
        return out;
      }, SETUP);
      checkEqual(r.room, 30, "30 to a room");
      check(r.notAtOnce && r.eventually, "a wish comes along, not straight away");
      check(r.aching && r.quiet, "Today: aching wishes listed, the rest one line");
      check(r.dadKey === "BABY_DAD" && r.foalKey === "DAD" && r.lines, "dad lines");
      check(r.noShout, "caged, no 'coming!'");
    },
  },
  {
    name: "quickfix11: \"da towew\" is now \"da go-'way van\" - its stories, nightmares and the magnifying glass; scared ones panic when a buyer knocks",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const lines = JSON.stringify(DIALOGUE.TOWER);
        out.lines = /go-'way van/.test(lines) && !/towew/.test(lines);
        const f = __mk(400, { growth: 1 });
        f.towerFear = 0.8;
        currentScene = "INDOORS";
        out.desc = JSON.stringify(typeof describeComfortWorries === "function" ? describeComfortWorries(f) : "");
        const dreams = DREAM_SOURCES.flatMap((d) => d(f) || []).map((d) => d.text).join(" ");
        out.dream = /go-'way van/.test(dreams) && !/towew/.test(dreams);
        const rnd = Math.random;
        Math.random = () => 0.01;
        f.speech.text = null;
        out.panic = onBuyerAtDoor({ fluffyId: f.id }) === 1 && f.expressionOverride === "CRYING_SHOCKED";
        Math.random = rnd;
        const calm = __mk(500, { growth: 1 });
        calm.towerFear = 0;
        out.calm = calm.expressionOverride !== "CRYING_SHOCKED";
        return out;
      }, SETUP);
      check(r.lines && r.dream, "the van, not the tower");
      check(r.panic && r.calm, "scared ones panic at a knock; calm ones don't");
    },
  },
];
