// Batch 7: the flight perch (and flyers over the fence), mum and the
// incubator, aftercare (bandages, taking it easy, setbacks), facing fears,
// foster family touches, and the phone's zoomed screens and save sending.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD"]) __clearScene(s);
  __seedRandom(31);
  closeAllChoices();
  if (typeof closeSurgery === "function") closeSurgery();
  currentScene = "INDOORS";
  timePlayed = 4 * DAY_LENGTH;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 520;
    h.hunger = 1;
    h.health = 100;
    h.happiness = 0.7;
    h.playerFear = 0;
    h.playerTrust = opts.trust ?? 0.3;
    h.coloristDegree = 0;
    h.currentStateKey = "IDLE";
    h.brain.think = () => {};
    fluffies.push(h);
    return h;
  };
  window.__run = (secs, movers) => {
    for (let t = 0; t < secs; t += 0.1) {
      timePlayed += 0.1;
      for (const m of movers) { m.hunger = 1; m.update(0.1); }
      updatePerches(0.1);
    }
  };
}`;

module.exports = [
  {
    name: "batch7: the flight perch - in the shop, saved; a pegasus near it goes over and hops, learning a little, then rests; an earthy doesn't; a skilled flyer that wants to leave flutters over the backyard fence",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const shop = SPAWN_ACTIONS.find((a) => a.isItem === "perch");
        out.shop = !!shop && STORE_AISLES.some((a) => a.items.includes("perch"));
        const perch = new Perch("INDOORS");
        perch.x = 800;
        perch.y = 520;
        objects.push(perch);
        out.saved = createItemFromSave(perch.serialize()) instanceof Perch;
        out.sellable = !!findSellableItemAt(perch.x, perch.y - 40);
        const peg = __mk(600, { type: "pegasus" });
        const earthy = __mk(650);
        // Make it go now
        const real = Math.random;
        Math.random = () => 0;
        perchTicker.fireNext && perchTicker.fireNext();
        updatePerches(2);
        Math.random = real;
        out.going = !!peg._perch;
        out.earthyGoing = !!earthy._perch;
        out.describe = describeFlight(peg)[0];
        __run(60, [peg]);
        out.skill = peg.flightSkill;
        out.done = !peg._perch && peg._perchRest > timePlayed;
        out.near = Math.abs(peg.x - perch.x) < 120;
        out.state = peg.currentStateKey;
        out.hurt = 100 - peg.health;
        // Over the fence: a Rebel flyer in the backyard
        const rebel = __mk(400, { type: "pegasus", scene: "BACKYARD" });
        rebel.flightSkill = 0.9;
        rebel.currentStateKey = "IDLE";
        const realTitle = window.titleOf;
        window.titleOf = (f) => (f === rebel ? "Rebel" : realTitle(f));
        const happy = __mk(500, { type: "pegasus", scene: "BACKYARD" });
        happy.flightSkill = 0.9;
        Math.random = () => 0;
        perchTicker.fireNext && perchTicker.fireNext();
        updatePerches(2);
        Math.random = real;
        window.titleOf = realTitle;
        out.flewOff = rebel.scene === PARK_SCENE && !rebel.adopted;
        out.happyStays = happy.scene === "BACKYARD" && happy.adopted;
        return out;
      }, SETUP);
      check(r.shop && r.saved && r.sellable, `in the shop, saved, sellable: ${JSON.stringify(r)}`);
      check(r.going && !r.earthyGoing, "a pegasus goes to practise, an earthy doesn't");
      check(/Practising/.test(r.describe), `magnifying glass: ${r.describe}`);
      check(Math.abs(r.skill - 4 * 0.012) < 1e-6, `four hops, a little each: ${r.skill}`);
      check(r.done && r.near, `then it rests: ${JSON.stringify(r)}`);
      checkEqual(r.hurt, 0, "never hurt");
      check(r.flewOff, "a Rebel flyer flutters over the backyard fence");
      check(r.happyStays, "a happy one stays");
    },
  },
  {
    name: "batch7: mum and the incubator - her visits keep the bond; too long without one and she may not know it (no milk); she goes over by herself; early-born adults catch the flu more easily",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const inc = new Incubator("INDOORS");
        inc.x = 900;
        inc.y = 450;
        inc.updateBounds();
        objects.push(inc);
        const mum = __mk(200);
        mum.lactatingTimer = 1000;
        mum.milkCharges = 5;
        const foal = __mk(900, { growth: 0.05 });
        foal.motherId = mum.id;
        setRelationship(mum.id, foal.id, "baby_child");
        foal.bornEarly = "very";
        foal.frailLeft = 5 * HOUR_LENGTH;
        foal.x = inc.x;
        foal.y = inc.y;
        handleDropping(foal);
        out.inside = foal.currentCage === inc;
        for (let i = 0; i < 3 * HOUR_LENGTH; i++) updatePrematureCare(1);
        out.alone = Math.round(foal.incubatorAlone);
        // She comes to the glass: the clock resets
        mum.x = inc.x - 90;
        mum.y = inc.y + 30;
        updatePrematureCare(1);
        out.afterVisit = foal.incubatorAlone;
        // Away again for a long time, then out: she doesn't know it
        mum.x = 200;
        mum.y = 520;
        for (let i = 0; i < 12 * HOUR_LENGTH; i++) updatePrematureCare(1);
        out.describe = describeIncubator(foal)[0];
        const real = Math.random;
        Math.random = () => 0;
        foal.currentCage = null;
        foal.x = 300;
        updatePrematureCare(1);
        Math.random = real;
        out.forgot = mumForgotFoal(mum, foal);
        foal.hunger = 0.2;
        foal.milkCooldown = 0;
        const before = mum.milkCharges;
        foal.attemptFeedFromMare(mum);
        out.fed = mum.milkCharges < before;
        // A visit just in time keeps it: another foal
        const foal2 = __mk(900, { growth: 0.05 });
        foal2.motherId = mum.id;
        foal2.x = inc.x;
        foal2.y = inc.y;
        handleDropping(foal2);
        for (let i = 0; i < 12 * HOUR_LENGTH; i++) updatePrematureCare(1);
        // She goes over by herself
        Math.random = () => 0;
        incubatorVisitTicker.fireNext && incubatorVisitTicker.fireNext();
        updateIncubatorVisits(3);
        Math.random = real;
        out.visitJob = !!mum._incVisit;
        for (let t = 0; t < 40 && !(mum._incVisit && mum._incVisit.arrived); t += 0.1) {
          timePlayed += 0.1;
          mum.update(0.1);
          updateIncubatorVisits(0.1);
        }
        out.arrived = !!(mum._incVisit && mum._incVisit.arrived);
        updatePrematureCare(1);
        out.alone2 = foal2.incubatorAlone;
        // Early-born grown-ups
        const grown = __mk(100);
        grown.bornEarly = "very";
        out.flu = [earlyBornFlu(grown), earlyBornFlu(mum)];
        out.grownDescribe = describePremature(grown);
        return out;
      }, SETUP);
      check(r.inside, "in the incubator");
      check(Math.abs(r.alone - 3 * 50) <= 2, `time without mum adds up: ${r.alone}`);
      checkEqual(r.afterVisit, 0, "her visit resets it");
      check(/mum hasn't visited/.test(r.describe), `the magnifying glass says so: ${r.describe}`);
      check(r.forgot, "out after so long: she doesn't know it");
      checkEqual(r.fed, false, "and won't nurse it");
      check(r.visitJob && r.arrived, `she goes over by herself: ${JSON.stringify(r)}`);
      checkEqual(r.alone2, 0, "and that counts as a visit");
      checkEqual(JSON.stringify(r.flu), JSON.stringify([1.6, 1]), "born very early: catches the flu more easily");
      check(r.grownDescribe && /flu/.test(r.grownDescribe[0]), `grown up: ${JSON.stringify(r.grownDescribe)}`);
    },
  },
  {
    name: "batch7: aftercare - bandages halve the risk once it's stopped bleeding (not before, not without a wound), run out; recovering fluffies are slower; a knock sets it back",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        out.shop = SPAWN_ACTIONS.some((a) => a.isItem === "bandages") && STORE_AISLES.some((a) => a.items.includes("bandages"));
        const roll = new Bandages("INDOORS");
        out.saved = createToolFromData({ ...roll.serialize(), charges: 2 }).charges === 2;
        const f = __mk(400);
        out.notWounded = applyBandage(f, roll);
        startRecovery(f, { type: "knife" });
        f.bleedingTimer = 5;
        out.bleeding = applyBandage(f, roll);
        f.bleedingTimer = 0;
        const risk = f.recovery.risk;
        out.applied = applyBandage(f, roll);
        out.halved = Math.abs(f.recovery.risk - risk * 0.5) < 1e-9;
        out.twice = applyBandage(f, roll);
        out.left = roll.charges;
        out.describe = describeRecovery(f)[0];
        // Slower while healing
        const g = __mk(600);
        g.updateSpeed();
        const normal = g.speed;
        f.updateSpeed();
        out.slow = f.speed / normal;
        // A hard landing: a setback
        const r0 = f.recovery.risk;
        const u0 = f.recovery.until;
        f.handleThrowImpact(700);
        out.setback = [f.recovery.risk > r0, f.recovery.until - u0];
        // Used up
        roll.charges = 1;
        toolbox.push(roll);
        const h = __mk(800);
        startRecovery(h, { type: "scalpel" });
        applyBandage(h, roll);
        out.gone = !toolbox.includes(roll);
        return out;
      }, SETUP);
      check(r.shop && r.saved, "in the shop, saved with its wraps");
      checkEqual(r.notWounded, false, "no fresh wound: nothing to bandage");
      checkEqual(r.bleeding, false, "still bleeding: stitch or burn it first");
      check(r.applied && r.halved, "wrapped: half the risk");
      checkEqual(r.twice, false, "already bandaged");
      checkEqual(r.left, 5, "one wrap used");
      check(/bandaged/.test(r.describe), `magnifying glass: ${r.describe}`);
      check(Math.abs(r.slow - 0.7) < 0.01, `slower while healing: ${r.slow}`);
      check(r.setback[0] && r.setback[1] === 3 * 50, `a hard landing sets it back: ${JSON.stringify(r.setback)}`);
      check(r.gone, "the last wrap: the roll is gone");
    },
  },
  {
    name: "batch7: facing fears - in the right-click menu for a scared fluffy; gently, a little once a day (more if it trusts you); forced, a lot or it backfires, and it remembers",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const f = __mk(400);
        fearsOf(f);
        f.fears.dark = 0.6;
        f.fears.thunder = 0;
        f.fears.bot = 0;
        out.menu = rightClickActions(f).map((a) => a.key).filter((k) => /fear/.test(k));
        out.gentle = faceFearGently(f);
        out.after = fearOf(f, "dark");
        out.again = faceFearGently(f);
        out.menuAfter = rightClickActions(f).some((a) => /fear/.test(a.key));
        // Trusting: more
        const t = __mk(500, { trust: 0.8 });
        fearsOf(t);
        t.fears.dark = 0.6;
        t.fears.thunder = 0;
        t.fears.bot = 0;
        faceFearGently(t);
        out.trusting = fearOf(t, "dark");
        // Forced: works
        const real = Math.random;
        const a = __mk(600);
        fearsOf(a);
        Object.assign(a.fears, { dark: 0.6, thunder: 0, bot: 0 });
        Math.random = () => 0;
        out.forced = forceFaceFear(a);
        Math.random = real;
        out.forcedFear = fearOf(a, "dark");
        out.remembers = (a.playerMemories || []).some((m) => m.type === "forced_fear");
        out.feared = a.playerFear > 0;
        // Forced: backfires
        const b = __mk(700);
        fearsOf(b);
        Object.assign(b.fears, { dark: 0.6, thunder: 0, bot: 0 });
        Math.random = () => 0.99;
        out.backfire = forceFaceFear(b);
        Math.random = real;
        out.backfireFear = fearOf(b, "dark");
        out.panics = isFrightened(b);
        // Nothing to fear: no menu
        const c = __mk(800);
        fearsOf(c);
        for (const k of Object.keys(c.fears)) c.fears[k] = 0;
        out.none = rightClickActions(c).some((x) => /fear/.test(x.key));
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.menu), JSON.stringify(["facefear", "forcefear"]), "both in the menu");
      check(r.gentle && Math.abs(r.after - 0.53) < 1e-6, `gently: a little: ${r.after}`);
      check(!r.again && !r.menuAfter, "once a day");
      check(Math.abs(r.trusting - (0.6 - 0.07 * 1.4)) < 0.002, `more if it trusts you: ${r.trusting}`);
      check(r.forced === "worked" && Math.abs(r.forcedFear - 0.35) < 1e-6, `forced: a big step: ${JSON.stringify(r)}`);
      check(r.remembers && r.feared, "and it remembers you made it");
      check(r.backfire === "backfired" && Math.abs(r.backfireFear - 0.75) < 1e-6 && r.panics, `or it backfires: ${JSON.stringify(r)}`);
      checkEqual(r.none, false, "nothing to fear: not in the menu");
    },
  },
  {
    name: "batch7: foster family - an orphan taken in (fostered or let drink) has a foster mum; her foals take to it; the family tree shows her with a dotted line",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const birth = __mk(100);
        const orphan = __mk(200, { growth: 0.05, gender: "male" });
        orphan.motherId = birth.id;
        recordFluffy(birth);
        recordFluffy(orphan);
        birth.die(null, "test");
        const mare = __mk(300);
        const own = __mk(320, { growth: 0.05 });
        own.motherId = mare.id;
        setRelationship(mare.id, own.id, "baby_child");
        takeInFoal(mare, orphan);
        out.foster = orphan.fosterMumId === mare.id;
        out.sib = [getOpinion(own, orphan), getOpinion(orphan, own)];
        syncFamilyRecords();
        recordFluffy(orphan);
        const rec = getFamilyRecord(orphan.id);
        out.birthMum = rec.motherId === birth.id;
        out.recFoster = rec.fosterMotherId === mare.id;
        const L = _buildFamilyTreeLayout(orphan.id);
        out.card = L.nodes.some((n) => n.role === "Foster mum" && n.rec && n.rec.id === mare.id);
        out.dashed = L.lines.some((l) => l.dashed);
        openFamilyTree(orphan.id);
        out.drawn = true;
        closeFamilyTree();
        return out;
      }, SETUP);
      check(r.foster, "it has a foster mum");
      check(r.sib[0] >= 0.19 && r.sib[1] >= 0.19, `her foal and the newcomer take to each other: ${r.sib}`);
      check(r.birthMum && r.recFoster, `the records keep its birth mum and its foster mum: ${JSON.stringify(r)}`);
      check(r.card && r.dashed, "the family tree shows her, with a dotted line");
    },
  },
  {
    name: "batch7: on a phone the magnifying glass opens zoomed in - taps land where they look, a drag moves it; Send my save makes the save file",
    run: async (page) => {
      const url = page.url().split("?")[0] + "?mobile=1";
      const browser = page.context().browser();
      const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      try {
        await p.goto(url);
        await p.waitForFunction(() => typeof gameState !== "undefined" && gameState === "TITLE", null, { timeout: 30000 });
        await p.evaluate(() => {
          worldSettings = new WorldSettings(true, true, true, true, fluffySexualitySliderSet.getValues(), true);
          preTransitionState = "TITLE_NEW";
          transitionPhase = "IN";
          transitionTimer = 0;
        });
        await p.waitForFunction(() => gameState === "PLAYING" && transitionPhase === "OFF", null, { timeout: 20000 });
        const z = await p.evaluate(() => {
          namingPopupsEnabled = false;
          closeDayReport();
          const f = new Horse(1, null, currentScene, "earthy", null, 0.6, 0.6, "female");
          f.adopted = true;
          f.x = 500;
          f.y = 450;
          fluffies.push(f);
          window.__f = f;
          openInspectionModal(f);
          return true;
        }).then(async () => {
          await p.waitForTimeout(300);
          return p.evaluate(() => ({ factor: touchZoomFactor(), zoomed: !!touchZoomedScreen(), view: { ...touchZoomView } }));
        });
        check(z.factor > 1.2 && z.zoomed, `zoomed: ${JSON.stringify(z)}`);
        check(z.view.y === 0 && z.view.x > 0, `opens at the top, in the middle: ${JSON.stringify(z.view)}`);
        await p.waitForTimeout(200);
        // Drag up: it moves
        await p.evaluate(() => {
          const T = (type, x, y) => {
            const t = new Touch({ identifier: 0, target: canvas, clientX: x, clientY: y });
            canvas.dispatchEvent(new TouchEvent(type, { touches: type === "touchend" ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }));
          };
          T("touchstart", 400, 300);
          for (let i = 1; i <= 8; i++) T("touchmove", 400, 300 - i * 20);
          T("touchend", 400, 140);
        });
        const moved = await p.evaluate(() => ({ y: touchZoomView.y, open: !!inspectedFluffy }));
        check(moved.y > 50 && moved.open, `a drag moves it (and doesn't close it): ${JSON.stringify(moved)}`);
        // Tap Close where it's drawn: closes
        const pt = await p.evaluate(() => {
          const L = getInspectionModalLayout();
          const z = touchZoomFactor();
          const gx = (L.closeBtnX + L.btnW / 2) * z - touchZoomView.x;
          const gy = (L.btnY + L.btnH / 2) * z - touchZoomView.y;
          return { x: gx * scale + offsetX, y: gy * scale + offsetY, onScreen: gy > 0 && gy < height };
        });
        if (!pt.onScreen) {
          await p.evaluate(() => touchZoomPan(0, 9999));
        }
        const pt2 = await p.evaluate(() => {
          const L = getInspectionModalLayout();
          const z = touchZoomFactor();
          return { x: ((L.closeBtnX + L.btnW / 2) * z - touchZoomView.x) * scale + offsetX, y: ((L.btnY + L.btnH / 2) * z - touchZoomView.y) * scale + offsetY };
        });
        await p.touchscreen.tap(pt2.x, pt2.y);
        await p.waitForTimeout(200);
        const closed = await p.evaluate(() => !inspectedFluffy);
        check(closed, "tapping Close where it's drawn closes it");
        // Send my save: a file with the game in it
        const dl = p.waitForEvent("download", { timeout: 5000 }).catch(() => null);
        const how = await p.evaluate(() => shareCurrentGame());
        const d = await dl;
        check(how === "downloaded" || how === "shared", `sent: ${how}`);
        if (how === "downloaded") {
          check(d && /fluffy-industries-day-\d+\.json/.test(d.suggestedFilename()), "downloaded as a save file");
          const fs = require("fs");
          const pth = await d.path();
          const data = JSON.parse(fs.readFileSync(pth, "utf8"));
          check(Array.isArray(data.fluffies) && data.fluffies.length >= 1 && data.saveFormatVersion, "with the game in it");
        }
        check(!errors.length, `no errors: ${errors.slice(0, 3).join(" | ")}`);
      } finally {
        await ctx.close();
      }
    },
  },
];
