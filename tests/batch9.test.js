// Batch 9 (playtest fixes): trick reward lines, the magnifying glass pauses,
// gentler scolding and spray, resting mares, the Feed-Bot and litterboxes,
// a plushie's owner, all of a fluffy's ties, herds under your roof,
// intelligence and good/bad smarties, walking on the spot, throw injuries,
// and the Auto-Trainer.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD"]) __clearScene(s);
  __seedRandom(91);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 4 * DAY_LENGTH;
  herdState = freshHerdState();
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 520;
    h.hunger = 1;
    h.health = 100;
    h.happiness = 0.6;
    h.currentStateKey = "IDLE";
    h.brain.think = () => {};
    if (opts.name) fluffyNames[h.id] = opts.name;
    fluffies.push(h);
    return h;
  };
  window.__herd = (members, leader) => {
    const h = { id: herdState.nextId++, name: "Oak" + herdState.nextId, leaderId: (leader || members[0]).id, memberIds: members.map((m) => m.id), colorIndex: 0, formedAt: 0 };
    herdState.list.push(h);
    _herdChanged();
    return h;
  };
}`;

module.exports = [
  {
    name: "batch9: praise gets a praise line, a treat a treat line; the magnifying glass pauses the game",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400, { name: "Daisy" });
        const said = [];
        f.speak = (t) => said.push(t);
        money = 1000;
        for (let i = 0; i < 40; i++) rewardTrick(f, "praise", "sit");
        const praise = said.slice();
        said.length = 0;
        for (let i = 0; i < 40; i++) rewardTrick(f, "treat", "sit");
        inspectedFluffy = f;
        const paused = screenPausesGame();
        inspectedFluffy = null;
        return { praise, treat: said.slice(), paused, treatLines: DIALOGUE.TRICK.TREAT };
      }, SETUP);
      check(r.praise.length && !r.praise.some((t) => /tweat|nummy/i.test(t)), `praise lines: ${[...new Set(r.praise)].join(" | ")}`);
      check(r.treat.length && r.treat.every((t) => /tweat/i.test(t)), `treat lines: ${[...new Set(r.treat)].join(" | ")}`);
      check(r.paused, "the magnifying glass pauses the game");
    },
  },
  {
    name: "batch9: scolding is a small thing; the spray bottle isn't harm (no gossip) unless overused",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400);
        f.strain = 0;
        f._mischiefAt = timePlayed;
        const t0 = f.playerTrust;
        scoldFluffy(f);
        const out = { strain: f.strain, trustLost: +(t0 - f.playerTrust).toFixed(3) };
        const g = __mk(600);
        g.playerMemories = [];
        for (let i = 0; i < 4; i++) {
          timePlayed += 70;
          notePlayerViolence(g, false, "spray", true);
        }
        out.after4 = g.playerMemories.map((m) => m.type);
        out.harm4 = _gFirstHandHarm(g).s;
        timePlayed += 70;
        notePlayerViolence(g, false, "spray", true);
        out.after5 = g.playerMemories[0].type;
        out.harm5 = _gFirstHandHarm(g).s;
        return out;
      }, SETUP);
      check(r.strain <= 0.31, `scolding strain ${r.strain} (a stick hit is 1)`);
      check(r.trustLost <= 0.031, `trust lost ${r.trustLost}`);
      check(r.after4.every((t) => t === "spray") && r.harm4 === 0, `4 sprays: just tellings-off (${r.after4})`);
      check(r.after5 === "sprayed_lots" && r.harm5 > 0, `the 5th in a day is harm (${r.after5}, ${r.harm5})`);
    },
  },
  {
    name: "batch9: a mare near her time, and just after foaling, hardly moves and lies down",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const m = __mk(400);
        m.updateSpeed();
        const normal = m.speed;
        m.isPregnant = true;
        m.pregnancyTimer = pregnancyDuration * 0.5;
        m.updateSpeed();
        const early = m.speed;
        m.pregnancyTimer = pregnancyDuration * 0.1;
        m.updateSpeed();
        const late = m.speed;
        const wander = new WanderDesire();
        wander.lastCalledTime = -1e9;
        const wanderLate = wander.evaluate(m);
        m.currentStateKey = "IDLE";
        const real = Math.random;
        Math.random = () => 0.1;
        mareRestTicker.fireNext && mareRestTicker.fireNext();
        updateMareRest(3);
        Math.random = real;
        const lay = m.currentStateKey;
        m.isPregnant = false;
        m.lastBirthAt = timePlayed - HOUR_LENGTH;
        const afterBirth = mareResting(m);
        m.lastBirthAt = timePlayed - 4 * HOUR_LENGTH;
        const later = mareResting(m);
        return { normal, early, late, wanderLate, lay, afterBirth, later, text: describeMareRest(Object.assign(m, { lastBirthAt: timePlayed })) };
      }, SETUP);
      check(r.late < r.early * 0.5 && r.late < r.normal * 0.2, `speed ${r.normal} -> ${r.early} -> ${r.late}`);
      checkEqual(r.wanderLate, 0, "doesn't wander");
      checkEqual(r.lay, "LYING", "lies down");
      check(r.afterBirth && !r.later, "rests for a few hours after the birth");
      check(/birth/.test(r.text || ""), `magnifying glass: ${r.text}`);
    },
  },
  {
    name: "batch9: the Feed-Bot empties a litterbox; an owned plushie shows whose it is",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const bot = new FeedBot("INDOORS");
        bot.setPosition(300, 560);
        objects.push(bot);
        const box = new Litterbox("INDOORS");
        box.x = 700;
        box.y = 560;
        box.uses = 12;
        objects.push(box);
        for (let i = 0; i < 600 && box.uses > 0; i++) bot.update(1 / 20);
        const f = __mk(400, { name: "Daisy" });
        const p = new Plushie("INDOORS");
        p.x = 500;
        p.y = 560;
        objects.push(p);
        const before = plushieOwnerTag(p);
        p.ownerId = f.id;
        return { uses: box.uses, before, after: plushieOwnerTag(p) };
      }, SETUP);
      checkEqual(r.uses, 0, "the Feed-Bot cleaned the litterbox");
      checkEqual(r.before, null, "nobody's yet");
      checkEqual(r.after, "Daisy's", "Daisy's plushie");
    },
  },
  {
    name: "batch9: under your roof, herds don't keep apart; Forget herd leaves it (friends kept); All its ties lists the wild ones and old herds",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const a = __mk(300, { name: "Ash" });
        const b = __mk(400, { name: "Bea" });
        const c = __mk(500, { name: "Cob" });
        const d = __mk(600, { name: "Dot" });
        __herd([a, b]);
        __herd([c, d]);
        const out = { indoorsApart: keepsApart(a, c), indoorsRival: rivalHerds(a, c) };
        // In the park, wild herds still keep apart
        const w1 = __mk(300, { scene: "OUTDOORS", adopted: false, name: "Wil" });
        const w2 = __mk(400, { scene: "OUTDOORS", adopted: false });
        const w3 = __mk(500, { scene: "OUTDOORS", adopted: false });
        const w4 = __mk(600, { scene: "OUTDOORS", adopted: false });
        __herd([w1, w2]);
        __herd([w3, w4]);
        out.wildRival = rivalHerds(w1, w3);
        // Forget herd
        changeOpinion(c, d, 0.6, "hugs");
        out.action = herdActions(c).map((x) => x.name);
        forgetHerd(c);
        out.herdAfter = !!herdOf(c);
        out.pastHerds = (c.pastHerds || []).map((p) => p.name);
        out.keptFriend = getOpinion(c, d);
        // All its ties: a wild friend from the park, family, an old herd
        changeOpinion(c, w1, 0.5, "played in the park");
        c.motherId = a.id;
        const T = allTiesOf(c);
        out.here = T.here.map((x) => x.name + ": " + x.text);
        out.away = T.away.map((x) => x.name + ": " + x.text + " [" + x.where + "]");
        out.past = T.pastHerds;
        openRelationshipMap(c);
        relMapSel = c.id;
        relMapAll = { id: c.id, page: 0 };
        let err = null;
        try {
          drawRelationshipMap(ctx);
        } catch (e) {
          err = e.message;
        }
        closeRelationshipMap();
        out.err = err;
        return out;
      }, SETUP);
      check(!r.indoorsApart && !r.indoorsRival, "your herds can be friends");
      check(r.wildRival, "wild herds are still rivals");
      checkEqual(JSON.stringify(r.action), JSON.stringify(["Forget herd"]), "right-click: Forget herd");
      check(!r.herdAfter && r.pastHerds.length === 1, `left its herd, remembered: ${r.pastHerds}`);
      check(r.keptFriend >= 0.5, "kept its friend");
      check(r.here.some((x) => /^Ash: Mum/.test(x)) && r.here.some((x) => /^Dot: .*adores/.test(x)), `here: ${r.here.join(" | ")}`);
      check(r.away.some((x) => /^Wil: likes .*\[wild/.test(x)), `elsewhere: ${r.away.join(" | ")}`);
      check(r.past.length === 1, `old herds: ${r.past}`);
      checkEqual(r.err, null, "the list draws");
    },
  },
  {
    name: "batch9: smarts - alicorn > unicorn > earthy > pegasus; good smarties are cleverer, kind and calm their herd; bad ones never tolerate a poopie coat and sour their herd",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mk = (type) => {
          const f = __mk(400, { type, gender: "male" });
          f.traitShift = { wits: 0 };
          // neutral wits genes
          for (let i = 0; i < TRAIT_GENES_EACH; i++) f.genes[traitGeneStart(TRAITS.findIndex((t) => t.key === "wits")) + i] = i < 2.5 ? 1 : 0;
          return f;
        };
        const types = ["alicorn", "unicorn", "earthy", "pegasus"].map((t) => {
          const f = mk(t);
          return { t, smarts: +smartsOf(f).toFixed(2), learn: +smartsLearn(f).toFixed(2), rate: +trickLearnRate(f).toFixed(3) };
        });
        const bad = mk("earthy");
        bad.personalities = ["smarty"];
        const good = mk("earthy");
        good.personalities = ["smarty"];
        good.smartyKind = "good";
        const peg = mk("pegasus");
        peg.personalities = ["smarty"];
        const out = {
          types,
          bad: { isSmarty: bad.isSmarty(), good: isGoodSmarty(bad), smarts: smartsOf(bad) },
          good: { isSmarty: good.isSmarty(), good: isGoodSmarty(good), smarts: smartsOf(good), refuses: trickRefusal(good, "sit") },
          pegSmarty: smartsOf(peg),
          badRefuses: trickRefusal(bad, "sit"),
        };
        // A poopie-coated brother: never tolerated
        const bro = mk("earthy");
        bro.motherId = 77;
        bad.motherId = 77;
        const realP = bro.genetics.calculateColorismPerception;
        out.broTolerated = smartyTolerates(bad, bro);
        bro.genetics.calculateColorismPerception = () => 0.1;
        out.poopieTolerated = smartyTolerates(bad, bro);
        out.poopieShun = colourShunChance(bad, bro);
        bro.genetics.calculateColorismPerception = realP;
        // Leading: a bad smarty sours its herd, a good one cheers and calms
        const m1 = mk("earthy");
        const m2 = mk("earthy");
        __herd([bad, m1], bad);
        __herd([good, m2], good);
        const o1 = getOpinion(m1, bad);
        const o2 = getOpinion(m2, good);
        m1.happiness = m2.happiness = 0.6;
        for (let i = 0; i < 20; i++) {
          smartsTicker.fireNext && smartsTicker.fireNext();
          updateSmartLeaders(3 * HOUR_LENGTH / 20);
        }
        out.badLed = { opinion: +(getOpinion(m1, bad) - o1).toFixed(3), happy: +(m1.happiness - 0.6).toFixed(3) };
        out.goodLed = { opinion: +(getOpinion(m2, good) - o2).toFixed(3), happy: +(m2.happiness - 0.6).toFixed(3) };
        let calmed = 0;
        for (let i = 0; i < 200; i++) if (goodLeaderCalms(m2)) calmed++;
        out.calmed = calmed;
        out.leaderScore = [herdLeadershipScore(good, [good, m2]), herdLeadershipScore(m2, [good, m2])];
        out.describe = describeSmarts(good)[0];
        // Breeds have their smarties
        const kinds = { good: 0, bad: 0 };
        for (let i = 0; i < 400; i++) {
          const f = { personalities: ["smarty"], type: "alicorn" };
          rollSmartyKind(f);
          kinds[f.smartyKind]++;
        }
        out.kinds = kinds;
        return out;
      }, SETUP);
      const s = Object.fromEntries(r.types.map((x) => [x.t, x]));
      check(s.alicorn.smarts > s.unicorn.smarts && s.unicorn.smarts > s.earthy.smarts && s.earthy.smarts > s.pegasus.smarts, `smarts by breed: ${JSON.stringify(r.types)}`);
      check(s.alicorn.learn > s.pegasus.learn * 1.3 && s.alicorn.rate > s.pegasus.rate, "clever ones learn tricks faster");
      check(r.bad.isSmarty && !r.bad.good, "a bad smarty is a smarty");
      check(!r.good.isSmarty && r.good.good && r.good.smarts > r.bad.smarts, `a good smarty is cleverer (${r.good.smarts} > ${r.bad.smarts}) and doesn't act like one`);
      check(r.good.refuses !== "smarty" && r.badRefuses === "smarty", "a good smarty does tricks");
      check(r.pegSmarty < s.earthy.smarts + 0.05, `a pegasus smarty is still dim-ish (${r.pegSmarty})`);
      check(r.broTolerated && !r.poopieTolerated && r.poopieShun === 1, "family tolerated - unless it's poopie");
      check(r.badLed.opinion < -0.05 && r.badLed.happy < -0.02, `a bad smarty's herd sours: ${JSON.stringify(r.badLed)}`);
      check(r.goodLed.opinion > 0 && r.goodLed.happy > 0, `a good smarty's herd is happier: ${JSON.stringify(r.goodLed)}`);
      check(r.calmed > 40 && r.calmed < 110, `fewer frights near a good leader (${r.calmed}/200)`);
      check(r.leaderScore[0] > r.leaderScore[1], "a good smarty is picked to lead");
      check(/good smarty/.test(r.describe), r.describe);
      check(r.kinds.bad > r.kinds.good && r.kinds.good > 50, `alicorn smarties: ${JSON.stringify(r.kinds)}`);
    },
  },
  {
    name: "batch9: no walking on the spot - a target in the wall is moved to the floor, and a fluffy that can't get anywhere stops",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400, { y: 560 });
        f.setTargetPosition(400, sceneTop("INDOORS") - 40);
        const clampedY = f.targetY;
        // Something in the way: it can't move at all
        f.setTargetPosition(900, 560);
        f.initBehavior("MOVING");
        f.updateSpeed();
        const realSteer = getFenceSteerPoint;
        window.getFenceSteerPoint = (h) => ({ x: h.x, y: h.y });
        let t = 0;
        while (t < 3 && f.isMovingOrRunning()) {
          f.actionHandler.checkArrivals(1 / 20);
          timePlayed += 1 / 20;
          t += 1 / 20;
        }
        window.getFenceSteerPoint = realSteer;
        // Pushed back every frame (a cage side, a wall): it stops too
        const g = __mk(300, { y: 560 });
        g.initBehavior("MOVING");
        g.setTargetPosition(520, 560);
        g.updateSpeed();
        let t2 = 0;
        while (t2 < 3 && g.isMovingOrRunning()) {
          g.actionHandler.checkArrivals(1 / 20);
          g.x = 300; // (pushed back)
          timePlayed += 1 / 20;
          t2 += 1 / 20;
        }
        return { clampedY, floor: sceneTop("INDOORS") + 50, stoppedAfter: +t.toFixed(2), state: f.currentStateKey, pushedStop: +t2.toFixed(2), pushedState: g.currentStateKey };
      }, SETUP);
      check(r.clampedY >= r.floor, `target moved out of the wall (${r.clampedY} >= ${r.floor})`);
      check(r.stoppedAfter < 2 && r.state !== "MOVING", `stopped after ${r.stoppedAfter}s (${r.state})`);
      check(r.pushedStop < 2 && !/MOVING|RUNNING/.test(r.pushedState), `pushed back: stopped after ${r.pushedStop}s (${r.pushedState})`);
    },
  },
  {
    name: "batch9: a hard throw can mangle a leg, a wing or the horn for good: drawn, slower, can't flap, cheaper, saved",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400, { type: "alicorn", name: "Sky" });
        f.updateSpeed();
        const speed0 = f.speed;
        const price0 = f.genetics.calculatePrice ? f.genetics.calculatePrice() : null;
        const real = Math.random;
        const soft = injureFromThrow(f, THROW_IMPACT_MIN_SPEED + 10, THROW_IMPACT_MIN_SPEED);
        Math.random = () => 0;
        const p1 = injureFromThrow(f, 2500, THROW_IMPACT_MIN_SPEED); // (0: the first option, a leg)
        Math.random = real;
        f.limbState.leftWing = "mangled";
        f.limbState.horn = "mangled";
        f.updateSpeed();
        const out = { soft, p1, slower: f.speed < speed0, canFly: canFly(f), parts: mangledParts(f), describe: describeInjuries(f)[0] };
        out.cheaper = price0 === null || f.genetics.calculatePrice() < price0;
        // Drawn without trouble, facing both ways
        let err = null;
        try {
          for (const right of [true, false]) {
            f.facingRight = right;
            f.draw(ctx);
          }
        } catch (e) {
          err = e.message;
        }
        out.err = err;
        const copy = Horse.deserialize(JSON.parse(JSON.stringify(f.serialize())));
        out.saved = mangledParts(copy);
        // Cut off: nothing left to be mangled
        f.anatomy.amputate("leg_0");
        out.afterCut = mangledParts(f);
        return out;
      }, SETUP);
      checkEqual(r.soft, null, "a gentle landing doesn't");
      checkEqual(r.p1, "leg_0", "a hard one can");
      check(r.slower && !r.canFly && r.cheaper, `slower, can't flap, cheaper (${JSON.stringify(r)})`);
      check(/front leg/.test(r.describe) && /wing/.test(r.describe) && /horn/.test(r.describe), r.describe);
      checkEqual(r.err, null, "drawn");
      checkEqual(JSON.stringify(r.saved.sort()), JSON.stringify(r.parts.sort()), "saved");
      check(!r.afterCut.includes("leg_0"), "an amputated leg isn't mangled any more");
    },
  },
  {
    name: "batch9: the Auto-Trainer calls a fluffy over and trains what you picked (slower than you, no love); its settings save",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        money = 1000;
        const t = new AutoTrainer("INDOORS");
        t.setPosition(700, 560);
        objects.push(t);
        t.tricks = ["sit", "bow"];
        t.reward = "treat";
        const f = __mk(300, { name: "Daisy" });
        f.playerTrust = 0.8;
        const trust0 = f.playerTrust;
        f.brain.think = () => {};
        const real = Math.random;
        Math.random = () => 0.01;
        autoTrainerTicker.fireNext && autoTrainerTicker.fireNext();
        updateAutoTrainers(HOUR_LENGTH);
        Math.random = real;
        const called = !!t.session && t.session.fluffyId === f.id;
        for (let i = 0; i < 1200 && t.session; i++) {
          timePlayed += 0.05;
          f.update(0.05);
          updateTricks(0.05);
          updateAutoTrainers(0.05);
        }
        const out = {
          called,
          done: !t.session,
          near: Math.abs(f.x - t.x) < 140,
          skill: (f.tricks && (f.tricks.sit || 0) + (f.tricks.bow || 0)) || 0,
          tries: f.trickTries ? f.trickTries.n : 0,
          spent: 1000 - money,
          trustSame: Math.abs(f.playerTrust - trust0) < 0.001,
          again: null,
        };
        // Not again straight away
        Math.random = () => 0.01;
        autoTrainerTicker.fireNext && autoTrainerTicker.fireNext();
        updateAutoTrainers(HOUR_LENGTH);
        Math.random = real;
        out.again = !!t.session;
        // The settings screen
        openAutoTrainer(t);
        const L = getAutoTrainerLayout();
        const lessonChip = L.chips.find((c) => c.kind === "lesson");
        mouse.x = lessonChip.x + 5;
        mouse.y = lessonChip.y + 5;
        handleAutoTrainerClick();
        let err = null;
        try {
          drawAutoTrainerScreen(ctx);
        } catch (e) {
          err = e.message;
        }
        out.lessons = t.lessons.slice();
        out.pauses = screenPausesGame();
        closeAutoTrainer();
        out.err = err;
        const data = JSON.parse(JSON.stringify(t.serialize()));
        const copy = createItemFromSave(data);
        copy.deserialize(data);
        out.saved = { tricks: copy.tricks, lessons: copy.lessons, reward: copy.reward, on: copy.on };
        out.shop = SPAWN_ACTIONS.some((a) => a.isItem === "auto_trainer") && STORE_AISLES.some((a) => a.items.includes("auto_trainer"));
        return out;
      }, SETUP);
      check(r.called && r.done && r.near, `called over and trained (${JSON.stringify(r)})`);
      check(r.tries >= 1 && r.tries <= 3, `${r.tries} goes`);
      check(r.skill > 0, `learnt a little (${r.skill})`);
      check(r.trustSame, "no love from a machine");
      check(!r.again, "not again straight away");
      check(r.lessons.length === 1 && r.pauses && !r.err, `set up: ${r.lessons} ${r.err}`);
      check(r.saved.tricks.join() === "sit,bow" && r.saved.reward === "treat" && r.saved.lessons.length === 1, `saved ${JSON.stringify(r.saved)}`);
      check(r.shop, "in the shop");
    },
  },
];
