// Playtest batch 4: mums carry newborns, a mum's "bestest babbeh", the
// no-mating rule, who's met whom, and strays moving between outdoor areas.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["INDOORS", "INDOORSL1", "OUTDOORS", "RIVER", "ALLEY", "ALLEY_ROAD", "ALLEY_DAY_CARE", "BACKYARD"]) __clearScene(s);
  __seedRandom(41);
  closeAllChoices();
  herdState = freshHerdState();
  _herdChanged();
  timePlayed = 3 * DAY_LENGTH + 4 * HOUR_LENGTH;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, opts.scene ?? "INDOORS", opts.type ?? "earthy", opts.genes ?? null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 500;
    h.hunger = opts.hunger ?? 1;
    h.happiness = 0.7;
    h.playerTrust = opts.trust ?? 0.6;
    h.playerFear = 0;
    h.currentStateKey = "IDLE";
    if (opts.mum !== undefined && opts.mum !== null) relationships[opts.mum][h.id] = "baby_child";
    fluffies.push(h);
    return h;
  };
  window.__coat = (f, rgb) => {
    f.colors.body = "rgb(" + rgb.join(", ") + ")";
  };
}`;

module.exports = [
  {
    name: "playtest4: newborns ride on mum's back until they can crawl (about 1.5 weeks); off her back they only wriggle",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(400);
        mum.brain.think = () => {};
        const a = __mk(430, { growth: 0.03, mum: mum.id });
        const b = __mk(450, { growth: 0.05, mum: mum.id });
        const older = __mk(700, { growth: 0.2, mum: mum.id });
        const out = {};
        for (const f of [a, b, older]) updateRiding(f);
        out.riding = [!!a._riding, !!b._riding, !!older._riding];
        // She walks off: they go with her
        mum.x = 900;
        mum.y = 560;
        for (const f of [a, b]) updateRiding(f);
        out.with = [a, b].map((f) => Math.round(Math.hypot(f.x - mum.x, f.y - mum.y)));
        out.above = a.y < mum.y && b.y < mum.y;
        out.drawnAfter = a.getBottomY() > mum.getBottomY();
        // Speeds: a newborn off her back only wriggles; one old enough crawls
        a._riding = null;
        a.updateSpeed();
        older.updateSpeed();
        out.speeds = [a.speed, older.speed];
        out.crawlAt = FOAL_CRAWL_AT;
        out.daysToCrawl = (FOAL_CRAWL_AT * GROW_UP_TIME) / DAY_LENGTH;
        // She fetches a newborn left behind
        a.x = 200;
        a.y = 500;
        out.fetch = mum.tooFarFromBaby() === a;
        // Picked up: they get off (onto the ground)
        updateRiding(a);
        mum.isDragging = true;
        updateRiding(b);
        out.offWhenHeld = !b._riding && Math.abs(b.y - mum.y) < 20;
        mum.isDragging = false;
        // A litter of five: three fit
        const kids = [1, 2, 3, 4].map((i) => __mk(900 + i * 5, { growth: 0.02, mum: mum.id, y: 560 }));
        for (const k of [...kids, b]) updateRiding(k);
        out.maxRiders = ridersOf(mum).length;
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.riding), JSON.stringify([true, true, false]), "the newborns climb on; the older foal crawls");
      check(r.with.every((d) => d < 60) && r.above, `they go where she goes, on top: ${r.with}`);
      check(r.drawnAfter, "drawn in front of her");
      check(r.speeds[0] < r.speeds[1] && r.speeds[0] <= 25, `wriggling ${r.speeds}`);
      check(r.daysToCrawl > 0.25 && r.daysToCrawl < 0.5, `crawls at about 1.5 weeks (${r.daysToCrawl} game days)`);
      check(r.fetch, "she goes back for one left behind");
      check(r.offWhenHeld, "picked up: they get down");
      checkEqual(r.maxRiders, 4, "only so many fit");
    },
  },
  {
    name: "playtest4: only the worst mums have a bestest babbeh - the one most like her; it gets the last milk, the others resent it; never an only child; an ordinary mum feeds a poopie foal last",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(400);
        mum.traitShift = { temper: 2 };
        mum.coloristDegree = 0; // (grumpy, not a colourist: she feeds them all when there's plenty)
        const out = {};
        out.grumpyOnly = bestestOf(mum); // (grumpy alone isn't enough...)
        mum.traumas = [{ type: "violent", text: "x", severity: 1 }]; // (...grumpy and unstable is)
        __coat(mum, [200, 60, 160]);
        mum.colors.mane = "rgb(60, 60, 200)";
        const like = __mk(430, { growth: 0.2, mum: mum.id });
        __coat(like, [205, 65, 150]);
        like.colors.mane = "rgb(60, 60, 200)";
        const unlike = __mk(460, { growth: 0.2, mum: mum.id });
        __coat(unlike, [60, 200, 60]);
        out.best = bestestOf(mum) === like;
        out.labels = [describeBestest(mum)[0], describeBestest(like)[0], describeBestest(unlike)[0]];
        // The last of the milk
        mum.lactatingTimer = 300;
        mum.milkCharges = 1;
        like.hunger = 0.5;
        const op0 = getOpinion(unlike, like);
        out.unlikeFed = unlike.attemptFeedFromMare(mum);
        out.resent = getOpinion(unlike, like) < op0;
        out.likeFed = like.attemptFeedFromMare(mum);
        // Plenty of milk: everyone feeds
        mum.milkCharges = 5;
        like.hunger = 0.5;
        unlike.milkCooldown = 0;
        out.plenty = unlike.attemptFeedFromMare(mum);
        // Resentment just from living with it (mum there to see)
        const op1 = getOpinion(unlike, like);
        bestestTicker.fireNext();
        for (let i = 0; i < 100; i++) updateBestest(HOUR_LENGTH / 20);
        out.slowResent = getOpinion(unlike, like) < op1;
        // A gentle mum doesn't play favourites; an only child is no favourite
        const gentle = __mk(800);
        gentle.traitShift = { temper: -2 };
        gentle.coloristDegree = 0;
        __mk(820, { growth: 0.2, mum: gentle.id });
        __mk(840, { growth: 0.2, mum: gentle.id });
        out.gentle = bestestOf(gentle);
        const lone = __mk(1000);
        lone.traitShift = { temper: 2 };
        __mk(1020, { growth: 0.2, mum: lone.id });
        out.only = bestestOf(lone);
        // An ordinary mum, nearly dry: her poopie foal waits
        const plain = __mk(1200);
        plain.traitShift = { temper: 0.3 - traitValue(plain, "temper") + ((plain.traitShift && plain.traitShift.temper) || 0) };
        plain.coloristDegree = 0;
        const poo = __mk(1220, { growth: 0.2, mum: plain.id });
        const sib = __mk(1240, { growth: 0.2, mum: plain.id });
        const realPoopie = isPoopieCoated;
        isPoopieCoated = (f) => f === poo;
        plain.lactatingTimer = 300;
        plain.milkCharges = 1;
        poo.hunger = 0.5;
        sib.hunger = 0.5;
        out.ordinary = [bestestOf(plain), goodMum(plain), mumSnubsPoopie(plain, poo), mumSnubsPoopie(gentle, poo)];
        isPoopieCoated = realPoopie;
        return out;
      }, SETUP);
      check(r.best, "the foal most like her");
      check(/Favours/.test(r.labels[0]) && r.labels[1] === "Mum's bestest babbeh" && /Not mum's favourite/.test(r.labels[2]), `labels ${r.labels}`);
      checkEqual(r.unlikeFed, false, "the last milk isn't for the others");
      check(r.resent, "and they resent the favourite");
      checkEqual(r.likeFed, true, "the bestest feeds");
      checkEqual(r.plenty, true, "with plenty of milk, everyone feeds");
      check(r.slowResent, "living alongside it, the resentment grows");
      checkEqual(r.gentle, null, "a gentle mum has no favourite");
      checkEqual(r.only, null, "an only child isn't a favourite");
      checkEqual(r.grumpyOnly, null, "grumpy alone: no favourite");
      checkEqual(JSON.stringify(r.ordinary), JSON.stringify([null, false, true, false]), "an ordinary mum: no bestest, but her poopie foal waits");
    },
  },
  {
    name: "playtest4: 'No mating' - most of the time they hold off; a breach can be disciplined, harsher each time, up to spaying or neutering",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        money = 500;
        const stud = __mk(400, { gender: "male" });
        const mare = __mk(440);
        fluffyNames[stud.id] = "Rowan";
        relationships[stud.id][mare.id] = "special_friend";
        relationships[mare.id][stud.id] = "special_friend";
        const out = {};
        out.menu = matingRuleActions(stud).map((a) => a.key);
        setMatingRule(stud, true);
        out.menuOn = matingRuleActions(stud).map((a) => a.key);
        out.obey = ruleObeyChance(stud);
        let held = 0;
        for (let i = 0; i < 200; i++) {
          stud.specialHuggiesCooldown = 0;
          if (ruleStopsMating(stud, mare)) held++;
        }
        out.held = held / 200;
        out.cooldown = stud.specialHuggiesCooldown;
        // He does it anyway
        stud.specialHuggiesCooldown = 0;
        stud.matingState.isMating = true;
        stud.matingState.matingWith = mare;
        stud.matingState.femaleForced = false;
        mare.matingState.isMating = true;
        stud.finishMating();
        out.breach = [stud.mateRule.breaches, breachPending(stud), mare.mateRule ? mare.mateRule.breaches : 0];
        out.discMenu = matingRuleActions(stud).find((a) => a.key === "mate_discipline").sub;
        const steps = [];
        for (let i = 0; i < 3; i++) {
          noteMatingBreach(stud);
          steps.push(disciplineMating(stud));
        }
        out.steps = steps;
        out.obeyLater = ruleObeyChance(stud);
        noteMatingBreach(stud);
        out.last = disciplineMating(stud);
        out.asked = choiceDialog && choiceDialog.title;
        pickChoice(0);
        out.fixed = [stud.limbs.lumps, money, stud.mateRule.on];
        out.menuAfter = matingRuleActions(stud).map((a) => a.key);
        out.row = describeMatingRule(stud)[0];
        // A forced mating isn't his breach
        const m2 = __mk(600, { gender: "male" });
        setMatingRule(m2, true);
        m2.matingState.isMating = true;
        m2.matingState.matingWith = mare;
        m2.matingState.femaleForced = true;
        m2.finishMating();
        out.forced = m2.mateRule.breaches;
        return out;
      }, SETUP);
      check(r.menu.includes("mate_rule") && r.menuOn.includes("mate_allow"), `menu: ${r.menu} / ${r.menuOn}`);
      check(r.held > 0.5 && r.held < 0.98, `holds off most of the time (${r.held}, chance ${r.obey})`);
      check(r.cooldown > 0, "and waits a while");
      checkEqual(JSON.stringify(r.breach), JSON.stringify([1, true, 0]), "his breach (she wasn't told)");
      check(/scold/.test(r.discMenu), r.discMenu);
      checkEqual(JSON.stringify(r.steps), JSON.stringify(["scold", "timeout", "stick"]), "harsher each time");
      check(r.obeyLater > r.obey, "and likelier to obey");
      checkEqual(r.last, "ask", "the last step asks first");
      check(/neutered/.test(r.asked), r.asked);
      checkEqual(JSON.stringify(r.fixed), JSON.stringify([false, 440, false]), "neutered, paid, rule done with");
      check(!r.menuAfter.includes("mate_rule"), "no rule for a neutered stallion");
      check(/broke it 5 times/.test(r.row), r.row);
      checkEqual(r.forced, 0, "forced isn't a breach");
    },
  },
  {
    name: "playtest4: fluffies only know the ones they've met - a relative never met isn't missed, a stranger isn't liked",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const a = __mk(300);
        const b = __mk(500, { scene: "BACKYARD", adopted: false });
        out.strangers = haveMet(a, b);
        // A herd bonus for a stranger is no liking at all
        changeOpinion(b, b, 0);
        out.liking = getLiking(a, b);
        // In the same room they get to know each other
        b.scene = "INDOORS";
        out.together = haveMet(a, b);
        meetTicker.fireNext();
        updateMeetings(2.1);
        b.scene = "BACKYARD";
        out.remember = haveMet(a, b);
        // A sire elsewhere doesn't pine for a foal he's never seen
        const sire = __mk(400, { scene: "INDOORSL1", gender: "male" });
        const foal = __mk(320, { growth: 0.4 });
        relationships[sire.id][foal.id] = "child";
        sire.updateRelationships(1);
        sire.updateRelationships(1);
        out.sire = [sire.perceivedRelationships[foal.id].state, sire.hasMissingRelative()];
        // ...but a mum who knows her foal misses it when it's taken away
        const mum = __mk(360);
        const kid = __mk(380, { growth: 0.4, mum: mum.id });
        mum.updateRelationships(1);
        kid.scene = "INDOORSL1";
        mum.updateRelationships(1);
        out.mum = mum.perceivedRelationships[kid.id].state;
        out.saved = savedHorseFields(a).met && Object.keys(savedHorseFields(a).met).length > 0;
        return out;
      }, SETUP);
      checkEqual(r.strangers, false, "never met");
      checkEqual(r.liking, 0, "no feelings for a stranger");
      checkEqual(r.together, true, "in the same room: they know each other");
      checkEqual(r.remember, true, "and remember after");
      checkEqual(JSON.stringify(r.sire), JSON.stringify(["unmet", false]), "the sire doesn't miss a foal he's never seen");
      checkEqual(r.mum, "lost", "a mum misses the foal she knows");
      check(r.saved, "who it's met is saved");
    },
  },
  {
    name: "playtest4: hungry, crowded-out or bullied strays move to the next outdoor area - never indoors, never yours",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        // Hungry in the alley (no food); grass in the garden
        for (let i = 0; i < 6; i++) objects.push(new Grass(300 + i * 80, 500, "OUTDOORS", 2));
        const s = __mk(600, { scene: "ALLEY", adopted: false, hunger: 0.2 });
        out.why = migrateReason(s);
        out.to = migrateDestination(s, "hungry");
        startMigration(s, out.to, "hungry");
        out.walking = !!s._migrate;
        timePlayed += MIGRATE_WALK_MAX + 1;
        migrateTicker.fireNext();
        updateMigration(1.1);
        out.arrived = [s.scene, s.x > width - 100];
        // Yours never go
        const mine = __mk(600, { scene: "RIVER", hunger: 0.1 });
        out.mine = migrateReason(mine);
        // Not from the backyard
        const by = __mk(600, { scene: "BACKYARD", adopted: false, hunger: 0.1 });
        out.backyard = migrateReason(by);
        // Crowded river: some move on
        for (let i = 0; i < 18; i++) __mk(400 + (i % 6) * 100, { scene: "RIVER", adopted: false, y: 350 + Math.floor(i / 6) * 120 });
        const before = fluffies.filter((f) => f.scene === "RIVER" && !f.adopted).length;
        _migrateClock = MIGRATE_EVERY;
        migrateTicker.fireNext();
        updateMigration(1.1);
        out.leaving = fluffies.filter((f) => f.scene === "RIVER" && f._migrate).length;
        out.before = before;
        out.cap = MIGRATE_CAP.RIVER;
        out.dest = [...new Set(fluffies.filter((f) => f._migrate).map((f) => f._migrate.to))];
        // A herd leader takes the herd
        const lead = __mk(500, { scene: "ALLEY_DAY_CARE", adopted: false });
        const m1 = __mk(540, { scene: "ALLEY_DAY_CARE", adopted: false });
        herdState.list.push({ id: 99, name: "Test", memberIds: [lead.id, m1.id], leaderId: lead.id, colorIndex: 1 });
        _herdChanged();
        out.group = migrateGroup(lead).length;
        return out;
      }, SETUP);
      checkEqual(r.why, "hungry", "hungry, nothing to eat here");
      checkEqual(r.to, "OUTDOORS", "off to where the grass is");
      check(r.walking, "walks to the edge");
      checkEqual(JSON.stringify(r.arrived), JSON.stringify(["OUTDOORS", true]), "turns up at the near side of the garden");
      checkEqual(r.mine, null, "yours stay put");
      checkEqual(r.backyard, null, "not from the backyard");
      check(r.leaving >= r.before - r.cap && r.leaving > 0, `crowded: ${r.leaving} of ${r.before} move on (room for ${r.cap})`);
      check(r.dest.every((d) => ["OUTDOORS"].includes(d)), `only to the garden from the river: ${r.dest}`);
      checkEqual(r.group, 2, "the herd goes together");
    },
  },
];
