// The exterminator path (Exterminator.js, ExterminatorPlayer.js, ExterminatorFerals.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["INDOORS", "BACKYARD"]) __clearScene(s);
  for (let i = fluffies.length - 1; i >= 0; i--) if (isJobScene(fluffies[i].scene)) fluffies.splice(i, 1);
  for (let i = objects.length - 1; i >= 0; i--) if (isJobScene(objects[i].scene)) objects.splice(i, 1);
  __seedRandom(4545);
  closeAllChoices();
  extState = freshExtState();
  clearExtPlayer();
  currentScene = "INDOORS";
  timePlayed = 3 * DAY_LENGTH + 9 * HOUR_LENGTH;
  money = 10000;
}`;

module.exports = [
  {
    name: "exterminator: a licence brings jobs; taking one makes a 3-4 room site with a herd; the rooms are their own scenes, linked both ways, kept from despawning",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = { before: extState.offers.length };
        out.licence = buyExtLicence();
        out.paid = money === 10000 - EXT_LICENCE_PRICE;
        out.offers = extState.offers.length;
        const o = extState.offers[0];
        o.request = null;
        out.accepted = acceptExtOffer(o.id);
        const job = extState.active;
        const site = jobSite();
        out.rooms = site.rooms.length;
        out.want = o.rooms;
        out.scene = currentScene === site.rooms[0].scene;
        const cfg = getSceneConfig(site.rooms[1].scene);
        out.cfg = [cfg.isJobSite, cfg.noDespawn, cfg.spawnFerals, cfg.insidePlayerQuarters];
        // Links go both ways
        out.links = site.rooms.every((rm) => Object.entries(rm.links).every(([d, to]) => {
          const back = { left: "right", right: "left", up: "down", down: "up" }[d];
          const other = site.rooms.find((x) => x.scene === to);
          return other && other.links[back] === rm.scene;
        }));
        // All reachable from the yard
        const seen = new Set([site.rooms[0].scene]);
        const todo = [site.rooms[0]];
        while (todo.length) {
          const rm = todo.pop();
          for (const to of Object.values(rm.links)) if (!seen.has(to)) {
            seen.add(to);
            todo.push(site.rooms.find((x) => x.scene === to));
          }
        }
        out.reachable = seen.size === site.rooms.length;
        out.herd = jobHerdLeft(job).length;
        out.herdWant = job.herd;
        out.portals = getScenePortals(site.rooms[0].scene).length >= 1;
        out.sameAgain = JSON.stringify(makeJobSite(job).rooms.map((x) => [x.kind, x.gx, x.gy])) === JSON.stringify(site.rooms.map((x) => [x.kind, x.gx, x.gy]));
        return out;
      }, SETUP);
      check(r.licence && r.paid && r.offers >= 1, "the licence brings jobs");
      check(r.accepted && r.scene, "taking a job drives you there");
      check(r.rooms === r.want && r.rooms >= 3 && r.rooms <= 4, `rooms ${r.rooms}`);
      checkEqual(JSON.stringify(r.cfg), JSON.stringify([true, true, false, false]), "a job room's settings");
      check(r.links && r.reachable && r.portals, "rooms joined both ways, all reachable");
      checkEqual(r.herd, r.herdWant, "the whole herd is there");
      check(r.sameAgain, "the same seed makes the same site");
    },
  },
  {
    name: "exterminator: you grab a fluffy, crate it, carry the crate to the van and load it; the herd runs and hides (search flushes it out); going home pays, takes the catch to the shelter and clears the site",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        buyExtLicence();
        extState.offers[0].request = null;
        acceptExtOffer(extState.offers[0].id);
        const job = extState.active;
        const site = jobSite();
        const yard = site.rooms[0].scene;
        const out = {};
        // Bring two of the herd to the yard
        const herd = jobHerdLeft(job);
        const a = herd.find((f) => f.growth >= 1);
        const b = herd.find((f) => f !== a);
        for (const f of [a, b]) {
          f.scene = yard;
          f.brain.think = () => {};
        }
        a.x = 700;
        a.y = 500;
        b.x = 1000;
        b.y = 520;
        extPlayer.scene = yard;
        extPlayer.x = 690;
        extPlayer.y = 530;
        out.action = extGrabAction() && extGrabAction().kind;
        out.grab = extDoGrab();
        out.held = a.extHeld;
        // To a crate
        const crate = _extCrates(yard)[0];
        extPlayer.x = crate.x - 40;
        extPlayer.y = crate.y + 20;
        out.crateAction = extGrabAction().kind;
        extDoGrab();
        out.inCrate = a.currentCage === crate;
        // Pick the crate up and walk it to the van
        extPlayer.holding = [];
        out.lift = extGrabAction().kind;
        extDoGrab();
        const v = extVanSpot();
        extPlayer.x = v.x + 60;
        extPlayer.y = v.y;
        updateExtPlayer(0.016);
        out.carried = Math.abs(crate.x - (extPlayer.x + extPlayer.facing * 70)) < 2 && a.currentCage === crate;
        out.loadAction = extGrabAction().kind;
        extDoGrab();
        out.loaded = job.loaded.length;
        out.gone = !fluffies.includes(a);
        // The other one runs from you, or hides
        const d = new ExtFeralDesire();
        extPlayer.x = b.x - 100;
        extPlayer.y = b.y + 30;
        out.fleeScore = d.evaluate(b);
        // Hide it behind a prop and flush it out
        const room = jobRoomOf(yard);
        room.props.push({ kind: "hay", x: 1100, y: 600 });
        extHide(b, room.props[room.props.length - 1]);
        out.hidden = b.hiddenBy != null && !extCanGrab(b);
        extPlayer.x = 1100;
        extPlayer.y = 590;
        out.search = extGrabAction().kind;
        extDoGrab();
        out.flushed = b.hiddenBy == null;
        // Home: to the shelter
        const m0 = money;
        const score0 = extState.score;
        const res = finishExtJob("shelter");
        out.paid = money - m0;
        out.expect = job.perHead + EXT_SHELTER_BONUS;
        out.score = extState.score - score0;
        out.cleared = !fluffies.some((f) => isJobScene(f.scene)) && !objects.some((o) => isJobScene(o.scene));
        out.home = currentScene === "INDOORS" && !extState.active && !extOnSite();
        return out;
      }, SETUP);
      checkEqual(r.action, "grab", "Grab offers the fluffy");
      check(r.grab && r.held, "grabbed");
      check(r.crateAction === "crate_in" && r.inCrate, "into the crate");
      check(r.lift === "crate_lift" && r.carried, "the crate is carried, with it inside");
      check(r.loadAction === "load_crate" && r.loaded === 1 && r.gone, "loaded in the van");
      check(r.fleeScore > 0, "the herd runs from you");
      check(r.hidden && r.search === "search" && r.flushed, "hiding, and flushed out");
      checkEqual(r.paid, r.expect, "paid by the head, plus the shelter's bonus");
      check(r.cleared && r.home, "the site's gone and you're home");
    },
  },
  {
    name: "exterminator: saved and loaded mid-job (the site comes back from the seed); bringing the catch home adopts it; the Pest control page draws",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        buyExtLicence();
        extState.offers[0].request = null;
        acceptExtOffer(extState.offers[0].id);
        const job = extState.active;
        const out = {};
        const st = SAVED_GAME_STATE.find((s) => s.name === "extState");
        const data = JSON.parse(JSON.stringify(st.get()));
        const scene = jobSite().rooms[1].scene;
        st.set(data);
        _jobConfigs.clear();
        out.cfg = getSceneConfig(scene).isJobSite === true;
        out.siteBack = jobSite().rooms.length === data.active.rooms;
        extAfterLoad();
        out.player = !!extPlayer && extPlayer.scene === jobSite().rooms[0].scene;
        // Catch one and bring it home
        const f = jobHerdLeft(extState.active)[0];
        _extLoad(f);
        const res = finishExtJob("home");
        out.kept = res.kept.length === 1 && res.kept[0].adopted && res.kept[0].scene === "BACKYARD";
        let err = null;
        try {
          openOrdersScreen("web");
          ordersTab = "pest";
          drawOrdersScreen(ctx);
          closeOrdersScreen();
        } catch (e) {
          err = String(e);
        }
        out.err = err;
        return out;
      }, SETUP);
      check(r.cfg && r.siteBack, "the site comes back after loading");
      check(r.player, "you're back on site");
      check(r.kept, "brought home: yours now, in the backyard");
      checkEqual(r.err, null, "the Pest control page draws");
    },
  },
  {
    name: "exterminator: the brutal kit - cull, bag the body, load the bag; bait and glue traps go down; culling on a humane job angers the client (half pay), killing their own fluffy costs you; a mum who sees it goes for you",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        buyExtLicence();
        const o = makeExtOffer(Math.random, "family");
        o.humane = true;
        o.pet = true;
        o.herd = 6;
        o.request = null;
        extState.offers.push(o);
        acceptExtOffer(o.id);
        const job = extState.active;
        const yard = jobSite().rooms[0].scene;
        const out = {};
        const herd = jobHerdLeft(job);
        const kid = herd.find((f) => f.growth < 1 && f.motherId);
        const mum = fluffyById(kid.motherId);
        for (const f of [kid, mum]) {
          f.scene = yard;
          f.brain.think = () => {};
          f.canSee = () => true;
        }
        kid.x = 700;
        kid.y = 520;
        mum.x = 900;
        mum.y = 520;
        extPlayer.scene = yard;
        extPlayer.x = 700;
        extPlayer.y = 540;
        out.tool = extToolAction().kind;
        out.cull = extUseTool();
        out.dead = !kid.isAlive;
        out.killed = job.killed;
        out.angry = job.angry === true;
        out.rage = typeof mum._extRage === "number" && _extFighter(mum);
        // Bag it
        out.bagAction = extToolAction().kind;
        extUseTool();
        out.bag = extPlayer.bag;
        out.bodyGone = !fluffies.includes(kid);
        // Slower with a full bag
        // Bait and a trap, somewhere empty
        extPlayer.x = 300;
        extPlayer.y = 700;
        const before = objects.length;
        out.place = extToolAction().kind;
        extUseTool();
        out.bait = objects.some((b) => b.extBait && b.scene === yard && b.food > 0);
        extSwitchKit();
        extUseTool();
        out.trap = objects.some((t) => typeof GlueTrap !== "undefined" && t instanceof GlueTrap && t.scene === yard);
        out.placed = objects.length - before;
        // The client's pet
        const pet = fluffyById(job.petId);
        pet.scene = yard;
        pet.x = 500;
        pet.y = 600;
        extPlayer.x = 500;
        extPlayer.y = 620;
        extCull(pet);
        out.petKilled = job.petKilled === true;
        // Load the bag at the van
        const v = extVanSpot();
        extPlayer.x = v.x + 40;
        extPlayer.y = v.y;
        out.loadBag = extGrabAction().kind;
        extDoGrab();
        out.bodies = job.bodies;
        const score0 = extState.score;
        const res = finishExtJob("shelter");
        out.pay = res.pay;
        out.expect = Math.round(1 * job.perHead * 0.5);
        out.dScore = res.dScore;
        return out;
      }, SETUP);
      check(r.tool === "cull" && r.cull && r.dead && r.killed === 1, "culled");
      check(r.angry, "a humane job: the client's upset");
      check(r.rage, "the mum saw - she's out for you");
      check(r.bagAction === "bag" && r.bag === 1 && r.bodyGone, "bagged");
      check(r.place === "place" && r.bait && r.trap && r.placed === 2, "bait and a glue trap down");
      check(r.petKilled, "their own fluffy");
      check(r.loadBag === "load_bag" && r.bodies === 1, "the bag goes in the van");
      checkEqual(r.pay, r.expect, "half pay for upsetting them (the pet isn't counted)");
      check(r.dScore < -10, `your name suffers (${r.dScore})`);
    },
  },
  {
    name: "exterminator: the herd fights back (no harm to you) - fighters run at you and kick; some cling to your legs and slow you until they drop off or you grab them; a smarty marches out and orders the rest at you; a killing breaks them",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        buyExtLicence();
        const o = makeExtOffer(Math.random, "farmer");
        o.herd = 6;
        o.request = null;
        extState.offers.push(o);
        acceptExtOffer(o.id);
        const job = extState.active;
        const yard = jobSite().rooms[0].scene;
        const out = {};
        const grown = jobHerdLeft(job).filter((f) => f.growth >= 1);
        for (const f of grown) f.personalities = (f.personalities || []).filter((p) => p !== "smarty");
        const all = jobHerdLeft(job);
        while (all.filter((f) => f.growth >= 1).length < 4) all.find((f) => f.growth < 1).growth = 1;
        const big = all.filter((f) => f.growth >= 1);
        for (const f of big) f.personalities = (f.personalities || []).filter((p) => p !== "smarty");
        const [a, b] = big;
        const boss = big.find((f) => f !== a && f !== b && f.gender === "male") || big[2];
        boss.gender = "male";
        const timid = (f) => {
          f._extRage = undefined;
          f._extRally = undefined;
          f.traits = f.traits || {};
        };
        for (const f of [a, b, boss]) {
          f.scene = yard;
          f.brain.think = () => {};
          f.canSee = () => true;
          f.health = 100;
          timid(f);
        }
        extPlayer.scene = yard;
        extPlayer.x = 700;
        extPlayer.y = 540;
        // A mum in a rage (as if she'd seen her foal taken)
        a._extRage = timePlayed;
        a.x = 900;
        a.y = 530;
        const d = new ExtFeralDesire();
        out.score = d.evaluate(a);
        out.mode = d.mode;
        d.execute(a);
        out.runs = a.targetX != null && Math.abs(a.targetX - extPlayer.x) < 60;
        // At your boots: kicks
        a.x = extPlayer.x - 40;
        a.y = _extFootY(a, extPlayer.y + 4);
        const rnd = Math.random;
        Math.random = () => 0.9; // (no cling this time)
        out.score2 = d.evaluate(a);
        d.execute(a);
        Math.random = rnd;
        out.kick = ["FLUFFY_JAB", "FLUFFY_STOMPIE", "FLUFFY_BITE"].includes(a.currentStateKey);
        out.bumped = extPlayer.bumped > 0;
        out.cooldown = extHitPlayer(a, extPlayer) === false;
        // Clinging
        a._extHitAt = -99;
        Math.random = () => 0.1;
        extHitPlayer(a, extPlayer);
        Math.random = rnd;
        out.cling = a.extCling === true;
        out.slow = extClingSlow();
        out.noDesire = d.evaluate(a) === 99 && d.mode === "busy";
        const x0 = extPlayer.x;
        extPlayer.x += 200;
        updateExtClingers();
        out.follows = Math.abs(a.x - extPlayer.x) < 70 && Math.abs(a.y - _extFootY(a, extPlayer.y - 2)) < 2;
        // Walking slower with it on
        const px = extPlayer.x;
        extPlayer.tx = px + 500;
        extPlayer.ty = extPlayer.y;
        updateExtPlayer(0.1);
        out.speed = (extPlayer.x - px) / 0.1;
        out.expectSpeed = EXT_SPEED * 0.8;
        extPlayer.tx = null;
        // Grab it off
        out.grabKind = extGrabAction().kind;
        extDoGrab();
        out.offLeg = !a.extCling && a.extHeld;
        // Hands full: another one's shaken off
        const c2 = b;
        c2._extHitAt = -99;
        c2.x = extPlayer.x + 30;
        Math.random = () => 0.1;
        extHitPlayer(c2, extPlayer);
        Math.random = rnd;
        out.shake = c2.extCling && extGrabAction().kind === "shake" && extDoGrab() && !c2.extCling;
        c2._extHitAt = -99;
        // Another clings and lets go in time
        b._extRage = timePlayed;
        b.x = extPlayer.x + 30;
        b.y = extPlayer.y;
        Math.random = () => 0.1;
        extHitPlayer(b, extPlayer);
        Math.random = rnd;
        out.bCling = b.extCling === true;
        timePlayed += EXT_CLING_TIME + 1;
        updateExtFerals(1.1);
        out.bOff = !b.extCling && extClingSlow() === 1;
        // A smarty: out in front of you with its speech, ordering the herd at you
        boss.personalities = [...(boss.personalities || []), "smarty"];
        boss.smartyKind = "bad";
        boss._extRage = undefined;
        boss.x = extPlayer.x + EXT_FRONT_DIST;
        boss.y = _extFootY(boss, extPlayer.y + 6);
        const others = jobHerdLeft(job).filter((f) => f !== boss && f.growth >= 1 && f.scene === yard && !f.extHeld);
        for (const f of others) f._extRally = undefined;
        out.smartyScore = d.evaluate(boss);
        out.smartyMode = d.mode;
        d.execute(boss);
        out.rallied = others.length > 0 && others.every((f) => f._extRally === timePlayed);
        out.smartyStays = boss.targetX == null;
        // From further off it marches out to meet you
        boss.x = extPlayer.x + 330;
        d.evaluate(boss);
        d.execute(boss);
        out.marches = d.mode === "front" && boss.targetX != null && Math.abs(boss.targetX - (extPlayer.x + EXT_FRONT_DIST)) < 5;
        boss.x = extPlayer.x + EXT_FRONT_DIST;
        // Kill one in front of them: the game's over - the rallied break, the smarty hides
        const rallied = others.find((f) => f !== a && f !== b && f.isAlive && !f.extHeld) || b;
        rallied._extRage = undefined;
        rallied._extRally = timePlayed;
        out.wasFighter = _extFighter(rallied);
        const victim = jobHerdLeft(job).find((f) => f !== boss && f !== rallied && f !== a && f !== b && f.scene === yard) || jobHerdLeft(job).find((f) => f !== boss && f !== rallied);
        victim.scene = yard;
        victim.x = boss.x - 40;
        victim.y = boss.y;
        rallied.x = boss.x - 80;
        rallied.y = boss.y;
        rallied.canSee = () => true;
        extCull(victim);
        out.broken = !_extFighter(rallied);
        d.evaluate(boss);
        out.smartyRuns = boss._extPanic != null && (d.mode === "flee" || d.mode === "hide");
        // Its herd gets a new smarty a little later
        rallied.gender = "male";
        boss.die("test", "Test");
        onExtCaught(boss, true);
        timePlayed += EXT_VACUUM_TIME + 1;
        updateExtFerals(1.1);
        out.newSmarty = jobHerdLeft(job).some((f) => f.isSmarty() && f !== boss);
        // A gagged fighter never bites
        a.extHeld = false;
        extPlayer.holding = [];
        a.accessories = { ...(a.accessories || {}), mouth: { id: "muzzle" } };
        let bites = 0;
        for (let i = 0; i < 20; i++) {
          a._extHitAt = -99;
          a.extCling = false;
          Math.random = () => 0.05 + (i % 10) * 0.001;
          extHitPlayer(a, extPlayer);
          Math.random = rnd;
          if (a.currentStateKey === "FLUFFY_BITE") bites++;
          a.extCling = false;
        }
        out.bites = bites;
        return out;
      }, SETUP);
      check(r.score > 90 && r.mode === "fight" && r.runs, "a raging mum runs at you");
      check(r.score2 > 90 && r.kick && r.bumped, "and kicks at your boots");
      check(r.cooldown, "not every frame");
      check(r.cling && Math.abs(r.slow - 0.8) < 1e-9 && r.noDesire && r.follows, "one clings to your leg (nothing else on its mind) and comes along");
      check(Math.abs(r.speed - r.expectSpeed) < 2, `you're slowed (${r.speed} vs ${r.expectSpeed})`);
      check(r.grabKind === "grab" && r.offLeg, "grabbed off your leg");
      check(r.shake, "hands full: shaken off");
      check(r.bCling && r.bOff, "one lets go in time");
      check(r.smartyScore > 90 && r.smartyMode === "front" && r.rallied && r.smartyStays, `the smarty makes its speech and orders the herd at you ${JSON.stringify([r.smartyScore, r.smartyMode, r.rallied, r.smartyStays])}`);
      check(r.marches, "it marches out to meet you");
      check(r.wasFighter && r.broken, "kill one in front of them and the rallied break");
      check(r.smartyRuns, "and the smarty hides");
      check(r.newSmarty, "a new smarty steps up");
      checkEqual(r.bites, 0, "a muzzled one can't bite");
    },
  },
  {
    name: "exterminator: every client makes its own kind of site; every room kind draws at PC and phone size; humane-only offers and client pets show in the offer",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        buyExtLicence();
        const out = { kinds: {}, errs: [] };
        const seen = new Set();
        for (const key of Object.keys(EXT_CLIENTS)) {
          for (let n = 0; n < 4; n++) {
            const o = makeExtOffer(Math.random, key);
            out.blurbs = (out.blurbs || 0) + (extOfferBlurb(o).length > 10 ? 1 : 0);
            const site = makeJobSite(o);
            out.kinds[key] = out.kinds[key] || new Set();
            for (const rm of site.rooms) {
              out.kinds[key].add(rm.kind);
              seen.add(rm.kind);
              const ok = EXT_CLIENTS[key].rooms.includes(rm.kind);
              if (!ok) out.errs.push(`${key}:${rm.kind}`);
            }
          }
        }
        // Draw every kind of room
        const job = makeExtOffer(Math.random, "farmer");
        extState.offers.push(job);
        acceptExtOffer(job.id);
        const site = jobSite();
        const drawErrs = [];
        for (const kind of Object.keys(EXT_ROOM_KINDS)) {
          site.rooms[1].kind = kind;
          try {
            changeScene(site.rooms[1].scene);
            drawJobScenery(ctx);
            for (const p of site.rooms[1].props) drawExtProp(ctx, p);
          } catch (e) {
            drawErrs.push(kind + ": " + e);
          }
        }
        out.drawErrs = drawErrs;
        out.allKinds = Object.keys(EXT_ROOM_KINDS).length;
        out.seen = seen.size;
        for (const k of Object.keys(out.kinds)) out.kinds[k] = out.kinds[k].size;
        return out;
      }, SETUP);
      checkEqual(r.errs.length, 0, "rooms come from the client's own kinds: " + r.errs.join(","));
      check(Object.values(r.kinds).every((n) => n >= 3), "each client has a few room kinds");
      check(r.seen >= r.allKinds - 2, `most room kinds come up (${r.seen}/${r.allKinds})`);
      checkEqual(r.drawErrs.join("; "), "", "every room kind draws");
    },
  },
  {
    name: "exterminator: special requests - no poison, spare the foals, no mess, get the smarty: kept or met pays a quarter more, a broken rule upsets them; humane jobs never ask for the brutal-only ones",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        buyExtLicence();
        const start = (client, req, humane = false) => {
          if (extState.active) finishExtJob("shelter");
          const o = makeExtOffer(Math.random, client);
          o.request = req;
          o.humane = humane;
          o.pet = false;
          o.herd = 6;
          extState.offers.push(o);
          acceptExtOffer(o.id);
          return extState.active;
        };
        const yardOf = () => jobSite().rooms[0].scene;
        const near = (f) => {
          f.scene = yardOf();
          extPlayer.scene = f.scene;
          extPlayer.x = f.x;
          extPlayer.y = f.y + 20;
        };
        const out = {};
        // No poison
        let job = start("farmer", "no_poison");
        out.blurb = extOfferBlurb(job).includes(EXT_REQUESTS.no_poison.text);
        out.np0 = extRequestResult(job);
        extPlayer.x = 300;
        extPlayer.y = 700;
        extPlayer.kit = "bait";
        extUseTool();
        out.np1 = extRequestResult(job);
        let f = jobHerdLeft(job)[0];
        _extLoad(f);
        let res = finishExtJob("shelter");
        out.npPay = res.pay === Math.round(job.perHead * 0.5) && res.request === false;
        // Get the smarty
        job = start("city", "boss");
        const boss = fluffyById(job.bossId);
        out.boss = !!boss && boss.isSmarty();
        out.b0 = extRequestResult(job);
        near(boss);
        extCull(boss);
        out.b1 = extRequestResult(job);
        // (and bag it, so it's no mess)
        res = finishExtJob("shelter");
        out.bPay = res.pay === Math.round(job.perHead * 0) || res.request === true;
        out.bReq = res.request;
        // No mess
        job = start("store", "tidy");
        f = jobHerdLeft(job).find((x) => x.growth >= 1);
        for (const x of jobHerdLeft(job)) if (x !== f) x.scene = jobSite().rooms[1].scene;
        near(f);
        extCull(f);
        out.t0 = extRequestResult(job);
        extUseTool(); // bag it
        out.t1 = extRequestResult(job);
        const v = extVanSpot();
        extPlayer.scene = yardOf();
        extPlayer.x = v.x + 40;
        extPlayer.y = v.y;
        extDoGrab();
        res = finishExtJob("shelter");
        out.tPay = res.pay === Math.round(job.perHead * 1.25) && res.request === true;
        // Spare the foals
        job = start("family", "foals_alive");
        f = jobHerdLeft(job).find((x) => x.growth < 1);
        out.f0 = extRequestResult(job);
        near(f);
        extCull(f);
        out.f1 = extRequestResult(job);
        finishExtJob("shelter");
        // Humane jobs: never the brutal-only requests
        let bad = 0;
        for (let i = 0; i < 300; i++) {
          const o = makeExtOffer(Math.random, "family");
          if (o.humane && (o.request === "foals_alive" || o.request === "tidy")) bad++;
          if (o.request && !EXT_REQUESTS[o.request].clients.includes("family")) bad++;
        }
        out.bad = bad;
        return out;
      }, SETUP);
      check(r.blurb, "the request is in the offer");
      check(r.np0 === true && r.np1 === false && r.npPay, "no poison: bait breaks it - half pay");
      check(r.boss && r.b0 === false && r.b1 === true && r.bReq === true, "the smarty's got: met");
      check(r.t0 === false && r.t1 === true && r.tPay, "no mess: a body on the ground breaks it until it's bagged; kept pays a quarter more");
      check(r.f0 === true && r.f1 === false, "spare the foals: a culled foal breaks it");
      checkEqual(r.bad, 0, "requests fit the client and the job");
    },
  },
  {
    name: "exterminator: a herd lives its life (mating and all) until it notices you - seen across the room, or one warns the rest; then mating stops, no courting or play, foals keep to mum; it doesn't forget, and word gets round the herd",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        buyExtLicence();
        const o = makeExtOffer(Math.random, "farmer");
        o.herd = 8;
        o.request = null;
        extState.offers.push(o);
        acceptExtOffer(o.id);
        const job = extState.active;
        const site = jobSite();
        const room = site.rooms[1].scene;
        const out = {};
        const herd = jobHerdLeft(job);
        for (const f of herd) {
          f.scene = room;
          f.brain.think = () => {};
          f.canSee = () => true;
          f._extAware = undefined;
          f.x = 1100;
          f.y = 600;
        }
        const grown = herd.filter((f) => f.growth >= 1);
        const [m, w] = [grown[0], grown[1]];
        m.matingState.isMating = true;
        m.matingState.matingWith = w;
        w.matingState.isMating = true;
        w.matingState.matingWith = m;
        const veto = (f, n) => DESIRE_VETOES.some((v) => v(f, n));
        // You're in another room: they carry on
        extPlayer.scene = site.rooms[0].scene;
        updateExtFerals(1.1);
        out.carryOn = m.matingState.isMating && !extAware(m) && !veto(m, "Mate") && !veto(m, "PlayWithBall");
        // You walk in, across the room
        _extMoveTo(room, 1100 - 480, 620);
        extPlayer.x = 1100 - 480;
        updateExtFerals(1.1);
        out.aware = herd.every((f) => extAware(f));
        out.stopped = !m.matingState.isMating && !w.matingState.isMating;
        out.vetoed = veto(m, "Mate") && veto(w, "ProposeSpecialFriendship") && veto(m, "PlayWithBall") && veto(m, "SeekPlayer") && !veto(m, "Eat");
        // Not the client's pet, not your own fluffies
        out.notOthers = !veto(fluffies.find((f) => !f.jobFeral && f.scene === "INDOORS") || { jobFeral: null, scene: "INDOORS" }, "Mate");
        // A foal strays from mum: back it goes
        const foal = herd.find((f) => f.growth < 1 && f.motherId);
        const mum = fluffyById(foal.motherId);
        mum.x = 1150;
        foal.x = 900;
        foal.y = 640;
        const d = new ExtFeralDesire();
        out.toMum = d.evaluate(foal) > 0 && d.mode === "to_mum";
        // A warning reaches ones that didn't see you
        const far = herd.find((f) => f !== m && f !== foal && f !== mum);
        far._extAware = undefined;
        far.x = m.x + 420;
        far.y = m.y;
        onExtCaught(m);
        out.heard = extAware(far);
        // Gone a while: they don't forget
        extPlayer.scene = site.rooms[0].scene;
        timePlayed += 600;
        updateExtFerals(1.1);
        out.remember = herd.every((f) => extAware(f)) && veto(m, "Mate");
        // Word gets round: one in another room that never saw you knows soon after
        const other = herd.find((f) => f !== m && f !== w && f !== foal && f !== mum && f !== far);
        other.scene = site.rooms[2].scene;
        other._extAware = undefined;
        job.wordOut = false;
        job.seenAt = timePlayed;
        updateExtFerals(1.1);
        out.notYet = !extAware(other);
        timePlayed += EXT_WORD_TIME + 1;
        updateExtFerals(1.1);
        out.word = extAware(other);
        return out;
      }, SETUP);
      check(r.carryOn, "unseen: the herd carries on as normal");
      check(r.aware && r.stopped, "seen: they all know, and the mating stops");
      check(r.vetoed, "no courting, play or begging - eating's fine");
      check(r.notOthers, "only the job's herd");
      check(r.toMum, "a foal keeps to its mum");
      check(r.heard, "a cry reaches the others");
      check(r.remember, "once you've shown yourself, they don't forget");
      check(r.notYet && r.word, "word gets round the whole herd");
    },
  },
  {
    name: "exterminator: cornered ones plead (beg, cover their eyes, dance, ask you to be daddy); a clever gentle mare holds out her foal - take it and she thanks you; hold one and Ask - it points to the rest (a smarty won't say); you hear an unaware herd next door, not one lying low",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        buyExtLicence();
        const o = makeExtOffer(Math.random, "farmer");
        o.herd = 9;
        o.request = null;
        extState.offers.push(o);
        acceptExtOffer(o.id);
        const job = extState.active;
        const site = jobSite();
        const yard = site.rooms[0].scene;
        const out = {};
        const herd = jobHerdLeft(job);
        for (const f of herd) {
          f.brain.think = () => {};
          f.canSee = () => true;
          f.personalities = (f.personalities || []).filter((x) => x !== "smarty");
        }
        const d = new ExtFeralDesire();
        const rnd = Math.random;
        // Sounds: the herd next door doesn't know you're here - you hear it
        const next = Object.values(site.rooms[0].links)[0];
        for (const f of herd) {
          f.scene = next;
          f._extAware = undefined;
          f.currentStateKey = "IDLE";
        }
        extPlayer.scene = yard;
        out.hear = extRoomSounds(yard).some((h) => h.scene === next && h.kind === "babbling");
        // Once they know and lie low, nothing
        for (const f of herd) {
          f._extAware = timePlayed;
          f.jobHide = { prop: 0 };
          f.hiddenBy = -1;
        }
        out.quiet = !extRoomSounds(yard).some((h) => h.scene === next);
        for (const f of herd) extUnhide(f);
        // Cornered: pleads
        const g = herd.find((f) => f.growth >= 1);
        g.scene = yard;
        g.x = 700;
        g.y = 500;
        g._extRage = undefined;
        g.traits = g.traits || {};
        extPlayer.x = 700;
        extPlayer.y = 560;
        const tvOld = traitValue;
        traitValue = (f, k) => (k === "bravery" || k === "temper" ? -0.5 : tvOld(f, k));
        Math.random = () => 0.1;
        g._extPleading = null;
        g._extPleadStyle = null;
        g._extPleadRoll = undefined;
        out.pleadScore = d.evaluate(g);
        out.plead = d.mode;
        d.execute(g);
        Math.random = rnd;
        out.style = g._extPleading;
        out.sits = g.currentStateKey === "SITTING" || g.currentStateKey === "MOVING" || g.currentStateKey.startsWith("FLUFFY_") || g.currentStateKey === "IDLE";
        // Back off and it runs
        extPlayer.x = 700 + 200;
        d.evaluate(g);
        out.offPlead = d.mode !== "plead" && g._extPleading == null;
        // A clever, gentle mare holds out her foal
        const foal = herd.find((f) => f.growth < 1 && f.motherId);
        const mum = fluffyById(foal.motherId);
        mum.scene = foal.scene = yard;
        mum.x = 400;
        mum.y = 600;
        foal.x = 440;
        foal.y = 620;
        traitValue = (f, k) => (f === mum && k === "wits" ? 0.6 : f === mum && (k === "temper" || k === "bravery") ? -0.4 : tvOld(f, k));
        extPlayer.x = 400 + 160;
        extPlayer.y = 640;
        out.offerScore = d.evaluate(mum);
        out.offer = d.mode;
        d.execute(mum);
        out.offered = foal._extOffered === true && d.evaluate(foal) > 0 && d.mode === "offered";
        // Take it: she thanks you, no rage
        extPlayer.x = foal.x;
        extPlayer.y = foal.y + 20;
        extGrab(foal);
        out.noRage = mum._extRage == null;
        traitValue = tvOld;
        // Ask: it points to where most of the rest are
        const rooms = site.rooms.map((x) => x.scene);
        const far = rooms[rooms.length - 1];
        for (const f of herd) if (f !== foal && f !== mum && f !== g) f.scene = far;
        traitValue = (f, k) => (k === "bravery" || k === "temper" ? -0.5 : tvOld(f, k));
        extPlayer.holding = [];
        foal.extHeld = false;
        const teller = g;
        extPlayer.x = teller.x;
        extPlayer.y = teller.y + 20;
        extGrab(teller);
        out.askKind = extGrabAction().kind;
        extDoGrab();
        out.points = extPlayer.tip && extPlayer.tip.scene === far;
        out.askedOnce = extGrabAction() == null || extGrabAction().kind !== "ask";
        traitValue = tvOld;
        // A smarty won't say
        const sm = herd.find((f) => f.growth >= 1 && f !== g && f !== mum);
        sm.gender = "male";
        sm.personalities = [...(sm.personalities || []), "smarty"];
        sm.smartyKind = "bad";
        out.refuse = extAsk(sm).refused === true;
        return out;
      }, SETUP);
      check(r.hear && r.quiet, "you hear an unaware herd next door; one lying low is silent");
      check(r.pleadScore > 90 && r.plead === "plead" && ["beg", "cover", "dance", "daddy", "hug"].includes(r.style) && r.sits, `cornered, it pleads (${r.style})`);
      check(r.offPlead, "back off and it stops");
      check(r.offerScore > 90 && r.offer === "offer" && r.offered, "a gentle mare holds out her foal " + JSON.stringify([r.offerScore, r.offer, r.offered]));
      check(r.noRage, "take it: no rage");
      check(r.askKind === "ask" && r.points && r.askedOnce, "asked, it points to the rest");
      check(r.refuse, "a smarty won't tell");
    },
  },
];
