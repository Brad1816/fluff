// Fixes from the playtest notes (batches 1 and 2): menus pause the game,
// the room headcount, random names, scars' stories, the litterbox lesson,
// relationship map zoom, special friends on the family tree, tools that
// act where they're drawn and stay in your hand, a gentler spray bottle,
// rarer alicorns that are run from (or chased off), evened-out coat
// colours, more strays at the river, mums who come when they're needed,
// and the shelter's two rows of kennels.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(77);
  if (typeof roomClimate !== "undefined") roomClimate = freshRoomClimate();
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 500;
    h.hunger = 1;
    h.happiness = 0.7;
    h.playerTrust = 0.6;
    h.playerFear = 0;
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
  // A spot on its body (the middle of what's drawn)
  window.__body = (f) => {
    const hits = [];
    for (let dy = -120; dy <= 0; dy += 6) for (let dx = -40; dx <= 40; dx += 6) if (f.hitTestAsSeen(f.x + dx, f.y + dy)) hits.push({ x: f.x + dx, y: f.y + dy });
    const cx = hits.reduce((a, h) => a + h.x, 0) / hits.length;
    const cy = hits.reduce((a, h) => a + h.y, 0) / hits.length;
    return hits.reduce((b, h) => (Math.hypot(h.x - cx, h.y - cy) < Math.hypot(b.x - cx, b.y - cy) ? h : b));
  };
  // Click with a held tool at (x, y)
  window.__useTool = (tool, x, y) => {
    if (!objects.includes(tool)) objects.push(tool);
    tool.isDragging = true;
    tool.scene = "INDOORS";
    tool.x = x;
    tool.y = y;
    isGlobalDragging = true;
    mouse.x = x;
    mouse.y = y;
    mouse.rightDown = false;
    return attemptDrop();
  };
}`;

module.exports = [
  {
    name: "playtest: pop-up screens pause the game (not the trick screen); the room's headcount; a random name; scars say where and how",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        out.before = screenPausesGame();
        openRelationshipMap();
        out.open = screenPausesGame();
        const t0 = timePlayed;
        out.t0 = t0;
        closeRelationshipMap();
        out.after = screenPausesGame();
        out.tricksPause = SCREENS.find((s) => s.name === "tricks").pauses;
        // Headcount
        out.none = roomHeadcountText("INDOORS");
        __mk(300);
        __mk(400, { growth: 0.4 });
        __mk(500, { adopted: false });
        out.three = roomHeadcountText("INDOORS");
        // Random names: never one already taken by a fluffy here
        fluffyNames[fluffies[0].id] = RANDOM_NAMES[0];
        const names = new Set();
        for (let i = 0; i < 200; i++) names.add(randomFluffyName([RANDOM_NAMES[1]]));
        out.nameTaken = names.has(RANDOM_NAMES[0]) || names.has(RANDOM_NAMES[1]);
        out.nameCount = names.size;
        // Scars: where it happened, and a made-up story for the unknown
        const f = fluffies[0];
        const known = addScar(f, "ear", "Bitten in a fight with Grub");
        out.known = describeScarOrigin(f, known, 0);
        f.scars.push({ kind: "flank", how: "Hurt", day: 1 });
        out.guess = describeScarOrigin(f, f.scars[1], 1);
        out.guessAgain = describeScarOrigin(f, f.scars[1], 1);
        return out;
      }, SETUP);
      checkEqual(r.before, false, "nothing open: not paused");
      checkEqual(r.open, true, "the relationship map pauses the game");
      checkEqual(r.after, false, "closed again: running");
      checkEqual(r.tricksPause, false, "the trick screen happens live, so it doesn't pause");
      checkEqual(r.none, "No fluffies here", "empty room");
      check(/^3 fluffies here \(1 foal\) · 2 yours/.test(r.three), `headcount: ${r.three}`);
      check(!r.nameTaken && r.nameCount > 20, `random names skip taken ones: ${JSON.stringify(r)}`);
      check(/Bitten in a fight with Grub, in the /.test(r.known), `scar with where: ${r.known}`);
      check(r.guess && r.guess !== "Hurt" && r.guess === r.guessAgain, `a made-up story, the same each time: ${r.guess}`);
    },
  },
  {
    name: "playtest: setting a foal down in the litterbox teaches it (once an hour); one that needs to go goes there",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const lb = new Litterbox("INDOORS");
        lb.x = 600;
        lb.y = 600;
        objects.push(lb);
        const foal = __mk(300, { growth: 0.5 });
        foal.pottyTraining = 0.1;
        foal.poopStorage = 0;
        foal.peeStorage = 0;
        const out = {};
        // Dropped well away from it: nothing
        foal.x = 200;
        foal.y = 500;
        foal.onDrop();
        out.away = foal.pottyTraining;
        // In it
        foal.x = lb.x;
        foal.y = lb.y - 10;
        foal.onDrop();
        out.once = foal.pottyTraining;
        foal.x = lb.x;
        foal.y = lb.y - 10;
        foal.onDrop();
        out.twice = foal.pottyTraining; // (not again this hour)
        // An hour on, needing to go: twice the lesson, and it goes in the box
        timePlayed += HOUR_LENGTH + 1;
        foal.poopStorage = 0.8;
        const uses = lb.uses;
        foal.x = lb.x;
        foal.y = lb.y - 10;
        foal.onDrop();
        out.needs = foal.pottyTraining;
        out.used = lb.uses - uses;
        out.puddles = puddles.filter((p) => p.scene === "INDOORS" && p.points.length).length;
        objects.splice(objects.indexOf(lb), 1);
        out.learn = LITTER_PLACE_LEARN * smartsLearn(foal); // (a clever one gets it sooner)
        return out;
      }, SETUP);
      checkEqual(r.away, 0.1, "dropped elsewhere: no lesson");
      check(Math.abs(r.once - (0.1 + r.learn)) < 1e-9, `in the box: learns ${JSON.stringify(r)}`);
      checkEqual(r.twice, r.once, "not twice in an hour");
      check(r.needs - r.once > r.once - 0.1, `needing to go: a bigger lesson ${JSON.stringify(r)}`);
      checkEqual(r.used, 1, "and it went in the box");
    },
  },
  {
    name: "playtest: the relationship map zooms about the pointer (wheel and buttons), drags about, and fits again",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        for (let i = 0; i < 6; i++) __mk(200 + i * 120);
        changeOpinion(fluffies[0], fluffies[1], 0.9);
        openRelationshipMap();
        const L0 = getRelMapLayout();
        const n0 = L0.nodes.get(fluffies[2].id);
        const at = { x: n0.x, y: n0.y };
        const r0 = n0.r;
        // Wheel up over that fluffy: it stays under the pointer, bigger
        mouse.x = at.x;
        mouse.y = at.y;
        handleRelMapWheel(-100);
        handleRelMapWheel(-100);
        const L1 = getRelMapLayout();
        const n1 = L1.nodes.get(fluffies[2].id);
        const out = { zoom: relMapView.zoom, moved: Math.hypot(n1.x - at.x, n1.y - at.y), bigger: n1.r / r0 };
        out.hover = _relHover(L1) === fluffies[2].id;
        // The + button, then Fit
        const plus = L1.zoomBtns.find((b) => b.id === "in");
        mouse.x = plus.x + 5;
        mouse.y = plus.y + 5;
        handleRelationshipMapClick();
        out.zoom2 = relMapView.zoom;
        // Can't zoom past the most, or out past fitting
        for (let i = 0; i < 20; i++) relMapZoom(2);
        out.max = relMapView.zoom;
        const fit = getRelMapLayout().zoomBtns.find((b) => b.id === "fit");
        mouse.x = fit.x + 5;
        mouse.y = fit.y + 5;
        handleRelationshipMapClick();
        out.fit = [relMapView.zoom, relMapView.x, relMapView.y];
        relMapZoom(0.1);
        out.min = relMapView.zoom;
        closeRelationshipMap();
        out.MAX = REL_ZOOM_MAX;
        return out;
      }, SETUP);
      check(r.zoom > 1.5, `zoomed in: ${r.zoom}`);
      check(r.moved < 1, `the fluffy under the pointer stays put (${r.moved}px)`);
      check(Math.abs(r.bigger - r.zoom) < 0.01, "and is drawn bigger");
      check(r.hover, "still hovering it");
      check(r.zoom2 > r.zoom, "the + button zooms in");
      checkEqual(r.max, r.MAX, "no further than the most");
      checkEqual(JSON.stringify(r.fit), JSON.stringify([1, 0, 0]), "Fit puts it back");
      checkEqual(r.min, 1, "never smaller than fitting");
    },
  },
  {
    name: "playtest: special friends go on the family tree beside each other with a heart; dashed once they split",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const a = __mk(300);
        const b = __mk(400, { gender: "male" });
        fluffyNames[a.id] = "Daisy";
        fluffyNames[b.id] = "Rowan";
        relationships[a.id][b.id] = "special_friend";
        relationships[b.id][a.id] = "special_friend";
        syncFamilyRecords();
        const out = { partners: getFamilyRecord(a.id).partnerIds, back: getFamilyRecord(b.id).partnerIds };
        const L = _buildFamilyTreeLayout(a.id);
        const pn = L.nodes.find((n) => n.partner);
        out.node = pn ? [pn.rec.id === b.id, pn.role, pn.together] : null;
        // Siblings never land on the special friend's spot
        const sibs = L.nodes.filter((n) => n.sibling);
        out.overlap = sibs.some((s) => pn && s.x < pn.x + pn.w && s.x + s.w > pn.x && s.y < pn.y + pn.h && s.y + s.h > pn.y);
        // They split up
        relationships[a.id][b.id] = "friend";
        relationships[b.id][a.id] = "friend";
        syncFamilyRecords();
        const L2 = _buildFamilyTreeLayout(a.id);
        const pn2 = L2.nodes.find((n) => n.partner);
        out.after = pn2 ? [pn2.role, pn2.together] : null;
        // Draws without trouble
        out.drew = !!_renderFamilyTreeCanvas(a.id).canvas;
        out.kept = familyKeepIds().has(String(b.id));
        return out;
      }, SETUP);
      check(r.partners && r.partners.length === 1 && r.back && r.back.length === 1, `in the book both ways: ${JSON.stringify(r)}`);
      checkEqual(JSON.stringify(r.node), JSON.stringify([true, "Special friend", true]), "beside her on the tree");
      checkEqual(r.overlap, false, "no sibling on top of it");
      checkEqual(JSON.stringify(r.after), JSON.stringify(["Ex special friend", false]), "after they split");
      check(r.drew && r.kept, "drawn, and kept in the book");
    },
  },
  {
    name: "playtest: a tool that misses stays in your hand (a tack is put down); tools are drawn with their working end at the pointer",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(700);
        const out = {};
        const stick = new SorryStick("INDOORS");
        const spot = __body(f);
        // A miss, well away from any fluffy
        __useTool(stick, 200, 300);
        out.stickHeld = stick.isDragging && objects.includes(stick) && toolbox.includes(stick);
        // A hit right where the tip is
        const fear0 = f.playerFear;
        __useTool(stick, spot.x, spot.y);
        out.hit = f.playerFear > fear0;
        out.stillHeld = stick.isDragging;
        // A thumbtack that misses is set down on the floor
        unequipCurrentTool();
        const tack = new Thumbtack("INDOORS");
        __useTool(tack, 200, 300);
        out.tackDown = !tack.isDragging;
        // Grips: the stick's and knife's tips, the nozzle, centred sponge
        out.grips = ["sorry_stick", "knife", "spray_bottle", "sponge", "brush", "magnifying_glass", "suture_kit"].every((k) => TOOL_GRIPS[k]);
        // Drawn: the stick's picture is drawn so its tip is at the pointer
        const c = new OffscreenCanvas(400, 400).getContext("2d");
        const calls = [];
        const real = c.drawImage.bind(c);
        c.drawImage = (img, x, y, ...rest) => {
          const m = c.getTransform();
          calls.push({ m, x, y, w: img.width, h: img.height });
          return real(img, x, y, ...rest);
        };
        stick.isDragging = true;
        stick.whackTimer = 0;
        stick.x = 200;
        stick.y = 200;
        stick.drawOffScreen(c);
        const d = calls[0];
        // The picture's top middle (the tip), in canvas coordinates
        const tip = new DOMPoint(d.x + d.w * 0.5, d.y + d.h * 0.02).matrixTransform(d.m);
        out.tip = [Math.round(tip.x), Math.round(tip.y)];
        // Sponge: drawn centred on the pointer
        const sp = new Sponge("INDOORS");
        sp.isDragging = true;
        sp.x = 100;
        sp.y = 100;
        calls.length = 0;
        sp.drawOffScreen(c);
        const s = calls[0];
        const mid = new DOMPoint(s.x + s.w / 2, s.y + s.h / 2).matrixTransform(s.m);
        out.sponge = [Math.round(mid.x), Math.round(mid.y)];
        for (const t of [stick, tack]) {
          const i = objects.indexOf(t);
          if (i >= 0) objects.splice(i, 1);
          const j = toolbox.indexOf(t);
          if (j >= 0) toolbox.splice(j, 1);
        }
        isGlobalDragging = false;
        return out;
      }, SETUP);
      check(r.stickHeld, "a miss: the stick is still in your hand");
      check(r.hit && r.stillHeld, "a hit where it's drawn lands, and it's still held");
      check(r.tackDown, "a tack that misses is set down");
      check(r.grips, "grips for the hand tools");
      checkEqual(JSON.stringify(r.tip), JSON.stringify([200, 200]), "the stick's tip is at the pointer");
      checkEqual(JSON.stringify(r.sponge), JSON.stringify([100, 100]), "the sponge is centred on the pointer");
    },
  },
  {
    name: "playtest: the spray bottle is a telling-off - a little fear, no mess, and a room doesn't turn Fearful over a few squirts",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const target = __mk(640);
        for (let i = 0; i < 8; i++) __mk(150 + i * 130 + (i >= 4 ? 140 : 0), { y: 650 });
        puddles.length = 0;
        const spray = new SprayBottle("INDOORS");
        const out = {};
        const fear0 = fluffies.map((f) => f.playerFear);
        for (let i = 0; i < 6; i++) {
          timePlayed += 20;
          const p = __body(target);
          target.currentStateKey = "IDLE";
          __useTool(spray, p.x, p.y);
        }
        out.victimFear = target.playerFear;
        out.watcherFear = Math.max(...fluffies.slice(1).map((f, i) => f.playerFear - fear0[i + 1]));
        out.mess = puddles.filter((p) => p.scene === "INDOORS" && p.points.length).length;
        out.climate = climateOf("INDOORS").label;
        out.harmStories = (storyBook.events || []).filter((e) => e.k === "harmed" && e.x === MEMORY_TEXT.spray).length;
        // The stick, by contrast
        unequipCurrentTool();
        const target2 = __mk(640, { y: 400 });
        const stick = new SorryStick("INDOORS");
        const p = __body(target2);
        __useTool(stick, p.x, p.y);
        out.stickFear = target2.playerFear;
        for (const t of [spray, stick]) {
          const i = objects.indexOf(t);
          if (i >= 0) objects.splice(i, 1);
        }
        isGlobalDragging = false;
        return out;
      }, SETUP);
      check(r.victimFear > 0 && r.victimFear < 0.3, `six squirts: a little afraid (${r.victimFear})`);
      check(r.watcherFear < 0.05, `those watching hardly mind (${r.watcherFear})`);
      checkEqual(r.mess, 0, "no wetting itself over a squirt of water");
      check(r.climate !== "Fearful" && r.climate !== "Tense", `the room: ${r.climate}`);
      checkEqual(r.harmStories, 0, "not remembered as harm");
      check(r.stickFear > 0.06, `the stick still hurts more (${r.stickFear})`);
    },
  },
  {
    name: "playtest: unicorns and pegasi don't come out alicorns; alicorns are run from on sight, and brave fluffies see them off",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        let ali = 0;
        for (let i = 0; i < 400; i++) {
          const h = new Horse(1, null, "INDOORS", i % 2 ? "pegasus" : "unicorn");
          if (h.type === "alicorn") ali++;
          delete relationships[h.id];
        }
        out.ali = ali;
        let wild = 0;
        for (let i = 0; i < 1500; i++) {
          const h = new Horse(1, null, "INDOORS", "earthy", null, null, null);
          if (h.genetics.getColorName && h.type === "alicorn") wild++;
          delete relationships[h.id];
        }
        out.wild = wild;
        // On sight
        const a = __mk(200, { type: "alicorn" });
        const timid = __mk(600);
        timid.traitShift = { bravery: -2 };
        out.range = alicornFearRange(timid);
        out.seen = timid.positioning.findScaryAlicorn() === a;
        // A grown one isn't really scared of a grown alicorn: it steers clear
        timid.x = 350;
        out.timidStance = alicornStance(timid, a);
        timid.positioning.attemptAlicornFear(a, false);
        out.timidScared = timid.isScared;
        out.timidWalks = timid.currentStateKey;
        // A foal runs
        const little = __mk(380, { growth: 0.5 });
        little.positioning.attemptAlicornFear(a, false);
        out.littleScared = little.isScared;
        // (a brave one only goes for a weak one: hurt, lame or a foal)
        a.health = 55;
        // A brave one goes for it, three blows, then leaves it be
        const brave = __mk(230);
        brave.traitShift = { bravery: 2 };
        out.stance = alicornStance(brave, a);
        const hp = a.health;
        for (let i = 0; i < 5; i++) {
          brave.attackCooldown = 0;
          brave.x = a.x + 30;
          brave.positioning.attemptAlicornFear(a, false);
        }
        out.blows = brave._alicornBlows && brave._alicornBlows.n;
        out.hurt = a.health < hp;
        out.braveScared = brave.isScared;
        out.after = alicornStance(brave, a);
        out.desire = new AlicornFearDesire().evaluate(brave);
        timePlayed += ALICORN_BRAVE_REST + 1;
        out.later = alicornStance(brave, a);
        // A brave foal still runs
        const foal = __mk(260, { growth: 0.5 });
        foal.traitShift = { bravery: 2 };
        out.foal = alicornStance(foal, a);
        out.BLOWS = ALICORN_BRAVE_BLOWS;
        return out;
      }, SETUP);
      checkEqual(r.ali, 0, "400 unicorns and pegasi: no alicorns");
      check(r.wild <= 3, `random fluffies: alicorns very rare (${r.wild} in 1500)`);
      check(r.range >= 400 && r.seen, `run from on sight (${r.range}px)`);
      checkEqual(r.timidStance, "avoid", "a grown timid one steers clear");
      check(!r.timidScared && r.timidWalks === "MOVING", `...walking off, not scared (${r.timidWalks})`);
      check(r.littleScared, "a foal runs");
      checkEqual(r.stance, "attack", "a brave one goes for it");
      checkEqual(r.blows, r.BLOWS, "three blows");
      check(r.hurt && !r.braveScared, "it hurt the alicorn and wasn't scared");
      checkEqual(r.after, "ignore", "then leaves it be");
      checkEqual(r.desire, 0, "and doesn't run either");
      checkEqual(r.later, "attack", "until it's been a while");
      checkEqual(r.foal, "flee", "a foal runs, brave or not");
    },
  },
  {
    name: "playtest: random coats spread over the colours (purple no longer a third of them); more strays at the river",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const t = {};
        for (let i = 0; i < 1500; i++) {
          const h = new Horse(1, null, "INDOORS", "earthy");
          const n = h.genetics.getColorName();
          t[n] = (t[n] || 0) + 1;
          delete relationships[h.id];
        }
        // How purple they look: less green than both red and blue, and colourful
        let purplish = 0;
        const g = new HorseGenetics({ genes: null });
        for (let i = 0; i < 1500; i++) {
          const genes = g.generateRandomGenes(null, null);
          const ch = (s) => genes.slice(s, s + 8).reduce((a, b) => a + b, 0);
          const [rr, gg, bb] = [ch(0), ch(8), ch(16)];
          if (gg + 1 < rr && gg + 1 < bb) purplish++;
        }
        // The river: empty, it gets the next strays
        __clearScene("RIVER");
        const before = currentScene;
        currentScene = "INDOORS";
        feralTimer = 0;
        updateFerals(0.016);
        const river = fluffies.filter((f) => f.scene === "RIVER").length;
        currentScene = before;
        return { t, purplish, river };
      }, SETUP);
      const total = Object.values(r.t).reduce((a, b) => a + b, 0);
      check(r.t.puwpuw / total < 0.11, `purple coats: ${r.t.puwpuw} of ${total} ${JSON.stringify(r.t)}`);
      check(r.purplish / 1500 < 0.22, `purple-looking coats: ${r.purplish} of 1500`);
      check(r.t.wed > 60 && r.t.owange > 40 && r.t.yewwow > 60, `reds, oranges and yellows come up too ${JSON.stringify(r.t)}`);
      check(r.river > 0, "an empty river gets the next strays");
    },
  },
  {
    name: "playtest: a mum comes to her foal when it's in trouble or calls, not just because it wandered off",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(200);
        const foal = __mk(800, { growth: 0.2, mum: mum.id }); // (crawling: a newborn that can't crawl yet she always fetches, Carrying.js)
        relationships[mum.id][foal.id] = "baby_child";
        foal.hunger = 1;
        foal.health = 100;
        const out = {};
        out.content = mum.tooFarFromBaby();
        // Upset
        foal.expressionOverride = "CRYING_SHOCKED";
        foal.expressionOverrideTimer = 3;
        out.crying = mum.tooFarFromBaby() === foal;
        foal.expressionOverrideTimer = 0;
        // Calls for her
        foal._mumCallAt = timePlayed;
        out.calling = mum.tooFarFromBaby() === foal;
        timePlayed += FOAL_CALL_HEARD + 1;
        out.callOver = mum.tooFarFromBaby();
        // Left on its own a while, it calls by itself
        foal._aloneSince = timePlayed - FOAL_LONELY_AFTER - 1;
        let called = false;
        for (let i = 0; i < 400 && !called; i++) {
          timePlayed += 1;
          updateFoalCalls(1);
          called = foal.foalCallingMum();
        }
        out.lonelyCall = called;
        // Hungry: distress
        foal._mumCallAt = undefined;
        foal.hunger = 0.2;
        out.hungry = foal.foalInDistress();
        // Close by: she doesn't need to come
        foal.hunger = 1;
        foal.x = mum.x + 60;
        foal._mumCallAt = timePlayed;
        out.near = mum.tooFarFromBaby();
        return out;
      }, SETUP);
      checkEqual(r.content, null, "a content foal across the room: she stays put");
      check(r.crying, "a crying foal: she comes");
      check(r.calling, "a foal calling: she comes");
      checkEqual(r.callOver, null, "once the call's long over: she doesn't");
      check(r.lonelyCall, "a foal alone a while calls for her");
      check(r.hungry, "a hungry foal is in distress");
      checkEqual(r.near, null, "already beside her: no need");
    },
  },
  {
    name: "playtest: the shelter has 16 kennels (four a side, two high), none overlapping, every one clickable",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const rects = shelterCageRects();
        const k = new ShelterKennels();
        const overlap = rects.some((a, i) => rects.some((b, j) => i !== j && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h + 24 && a.y + a.h + 24 > b.y));
        const rows = [...new Set(rects.map((c) => c.y))].length;
        const hits = rects.map((c, i) => k.cageAt(c.x + c.w / 2, c.y + c.h / 2) === i);
        const onScreen = rects.every((c) => c.x >= 0 && c.x + c.w <= width && c.y + c.h + 24 < height);
        return { n: rects.length, cap: SHELTER_CAGES, overlap, rows, hits, onScreen };
      });
      checkEqual(r.n, 16, "sixteen kennels (playtest 7)");
      checkEqual(r.cap, 16, "room for sixteen");
      checkEqual(r.rows, 2, "in two rows");
      checkEqual(r.overlap, false, "not overlapping (plaques included)");
      check(r.hits.every(Boolean), "each one clicks to itself");
      check(r.onScreen, "all on screen");
    },
  },
];
