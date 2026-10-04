// Playtest round 5: spray price, waking at 6, trauma wording, the Fluff-Bot
// and litterboxes, the morning report fitting, herd talk after taking one
// in, cages (wider, calmer, talking through bars, parties, knowing what a
// cage is for, trained studs), special friends, worst mums, tiny micros
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["OUTDOORS", "INDOORS", "BACKYARD", "PARK"]) __clearScene(s);
  __seedRandom(5150);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 6 * DAY_LENGTH + 10 * HOUR_LENGTH;
  herdState = freshHerdState();
  _herdChanged();
  roomClimate = freshRoomClimate();
  _climateCache = null;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, opts.scene ?? "INDOORS", opts.type ?? "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.makeType(opts.type ?? "earthy");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = opts.y ?? 520;
    h.hunger = 1;
    h.health = 100;
    h.happiness = 0.7;
    h.coloristDegree = 0;
    h.currentStateKey = "IDLE";
    if (opts.think !== true) h.brain.think = () => {};
    if (opts.name) fluffyNames[h.id] = opts.name;
    fluffies.push(h);
    return h;
  };
  window.__cage = (x, tag = "none") => {
    const c = new Cage("INDOORS");
    c.x = x;
    c.y = 480;
    c.tag = tag;
    c.updateBounds();
    objects.push(c);
    return c;
  };
  window.__put = (f, c) => {
    f.currentCage = c;
    f.x = c.x;
    f.y = c.bounds.bottom - 20;
  };
  window.__said = (f) => (f.speech && f.speech.text) || "";
}`;

module.exports = [
  {
    name: "playtest5: the spray costs the same as the stick; sleep wakes you at 6; a lasting trauma says trauma, a real scar says scars",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const cost = (key) => SPAWN_ACTIONS.find((i) => i.isItem === key).cost;
        const out = { prices: [cost("sorry_stick"), cost("spray_bottle")], wake: SLEEP_WAKE_HOUR };
        const f = __mk(400);
        recordStory("scarred", f, { x: "taken from its mum" });
        const g = __mk(500);
        recordStory("scarred", g, { x: "a leg mangled when thrown", phys: true });
        const why = roomClimate.INDOORS.why;
        out.why = [!!why.trauma, !!why.scarred, CLIMATE_REASON.trauma];
        return out;
      }, SETUP);
      checkEqual(r.prices[0], r.prices[1], "same price");
      checkEqual(r.wake, 6, "6 AM, the report time");
      checkEqual(JSON.stringify(r.why), JSON.stringify([true, true, "trauma"]), "trauma and scars told apart");
    },
  },
  {
    name: "playtest5: the morning report wraps long park news and fits the screen",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const long = "A fox prowled around the Clover Meadow herd for most of the night, took the weakest foal, and the herd's leader ran off and left them all behind.";
        dayReportShown = {
          dayNumber: 3, season: "Spring", weather: [], moneyStart: 0, moneyEnd: 10, bills: null, sold: { count: 0 }, orders: { count: 0 },
          born: [], arrived: [], died: [], scarred: [], wildArrived: 0, wildDied: 0,
          nightEvents: [{ text: long, good: false }, { text: long, good: false }, { text: "Quiet.", good: true }],
          news: ["one", "two", "three", "four", "five"], summary: "A long week. ".repeat(20),
        };
        const L = getDayReportLayout();
        const lines = _drNightLines(dayReportShown);
        const out = { lines: lines.length, full: lines.map((l) => l.text).join(" ").includes("behind"), fits: L.y + L.h <= height + 1, h: L.h, height };
        dayReportShown = null;
        return out;
      });
      check(r.lines >= 5, `long events wrap onto a second line: ${r.lines}`);
      check(r.full, "the end of the line is there, not cut off");
      check(r.fits, `the card fits: ${r.h} in ${r.height}`);
    },
  },
  {
    name: "playtest5: a foal left wild when its mum's taken in doesn't keep 'joining' her herd; a herd with no leader in sight doesn't name one",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const mum = __mk(300);
        const a = __mk(350);
        const b = __mk(400);
        for (const x of [mum, a, b]) for (const y of [mum, a, b]) if (x !== y) changeOpinion(x, y, 0.9, "test");
        herdState.list.push({ id: 91, name: "Home", leaderId: a.id, memberIds: [mum.id, a.id, b.id], colorIndex: 0 });
        _herdChanged();
        const foal = __mk(320, { growth: 0.3, adopted: false, scene: "PARK" });
        foal.motherId = mum.id;
        foal.tooYoungToSpeak = () => false;
        let joins = 0;
        const realJoin = _join;
        _join = (h, f) => {
          if (f === foal) joins++;
          return realJoin(h, f);
        };
        for (let i = 0; i < 10; i++) updateHerds(HERD_UPDATE_EVERY);
        _join = realJoin;
        // Leaderless lines have no name in them
        const alone = JSON.stringify(DIALOGUE.HERD.FOLLOW_NEAR.ALONE) + JSON.stringify(DIALOGUE.HERD.FOLLOW.ALONE) + JSON.stringify(DIALOGUE.HERD.JOIN_ALONE);
        return { joins, inHerd: !!herdOf(foal), alone };
      }, SETUP);
      checkEqual(r.joins, 0, "never joins");
      checkEqual(r.inHerd, false, "stays out of it");
      check(!/<[Tt]arget>/.test(r.alone), "no <target> in the leaderless lines");
    },
  },
  {
    name: "playtest5: cages are wider; caged fluffies shuffle a little instead of pacing; they talk through the bars and miss the party",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const c = __cage(600);
        const out = { wide: +((c.bounds.right - c.bounds.left) / images.cage.width).toFixed(2) };
        const f = __mk(600, { name: "Inside" });
        __put(f, c);
        // Random walks stay short
        let maxStep = 0;
        for (let i = 0; i < 30; i++) {
          f.x = c.x;
          f.targetX = null;
          f.positioning.pickNewTarget();
          maxStep = Math.max(maxStep, Math.abs(f.targetX - c.x));
        }
        out.maxStep = Math.round(maxStep);
        // A friend outside, close by: they talk
        const g = __mk(c.bounds.right + 60, { name: "Outside" });
        setRelationship(f.id, g.id, "friend");
        setRelationship(g.id, f.id, "friend");
        f.x = c.x;
        const realR = Math.random;
        Math.random = () => 0.01;
        for (let i = 0; i < 4; i++) {
          cageLifeTicker.fireNext();
          updateCageLife(0);
          timePlayed += 1;
        }
        Math.random = realR;
        out.talk = [f._cageTalkAt !== undefined, g._cageReply === null || g._cageReply === undefined ? "answered" : "waiting"];
        out.touch = [cageTogether(f, g), canFluffiesReachEachOther(f, g)];
        // A party for the one outside: the caged one isn't there, and minds
        const realOcc = partyOccasion;
        partyOccasion = () => ({ key: "t", name: "Test party" });
        money = 1000;
        const h0 = f.happiness;
        f.currentStateKey = "IDLE";
        throwParty(g);
        partyOccasion = realOcc;
        out.party = [partyGuests(g).includes(f), f.happiness < h0];
        return out;
      }, SETUP);
      check(r.wide > 1.15, `wider than its picture: ${r.wide}`);
      check(r.maxStep <= 61, `short shuffles: ${r.maxStep}px`);
      check(r.talk[0], "the caged one called out");
      checkEqual(r.talk[1], "answered", "and its friend answered");
      checkEqual(JSON.stringify(r.touch), JSON.stringify([false, false]), "but they can't touch");
      checkEqual(JSON.stringify(r.party), JSON.stringify([false, true]), "not at the party, and sad about it");
    },
  },
  {
    name: "playtest5: a fluffy that knows what a cull or sell cage is reacts when put in one; a trained stud breeds in a breeding cage without the stick",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        const cull = __cage(300, "cull");
        const sell = __cage(800, "sell");
        const a = __mk(150);
        const b = __mk(150);
        a.cageKnow = { cull: true };
        b.cageKnow = {};
        for (const f of [a, b]) {
          cageLifeTicker.fireNext();
          updateCageLife(0);
        }
        const h0 = a.happiness;
        __put(a, cull);
        __put(b, sell);
        cageLifeTicker.fireNext();
        updateCageLife(0);
        out.cull = [__said(a), a.happiness < h0, isFrightened(a)];
        out.sellNew = __said(b);
        // Seeing a cull teaches it
        const w = __mk(600);
        w.cageKnow = {};
        noteCullSeen(cull);
        out.learnt = knowsCage(w, "cull");
        // Training a stud: four times with the stick, then by himself
        const breed = __cage(1100, "breeding");
        const stud = __mk(1100, { gender: "male", name: "Stud" });
        const mare = __mk(1100, { name: "Mare" });
        __put(stud, breed);
        __put(mare, breed);
        for (let i = 0; i < 4; i++) noteBredInCage(stud, mare, true);
        stud.renderer.ensureTintedImages(); // (drawn once, as in the game)
        mare.renderer.ensureTintedImages();
        out.trained = isTrainedStud(stud);
        let bred = false;
        for (let i = 0; i < 40 && !bred; i++) {
          timePlayed += 1;
          cageLifeTicker.fireNext();
          updateCageLife(0);
          bred = !!(stud.matingState && stud.matingState.isMating);
        }
        out.bred = bred;
        return out;
      }, SETUP);
      check(/SCAWY|foweba|HEWP|gwass/i.test(r.cull[0]), `knows the cull cage: "${r.cull[0]}"`);
      check(r.cull[1] && r.cull[2], "and is frightened");
      check(r.sellNew.length > 0, `a new one wonders about the sell cage: "${r.sellNew}"`);
      check(r.learnt, "seeing a cull teaches what the glass is");
      check(r.trained, "trained after a few times");
      check(r.bred, "breeds by himself in the breeding cage");
    },
  },
  {
    name: "playtest5: two of yours wanting to be special friends ask you; kept apart, they don't ask again; a special friend stands up for its partner and minds it being bred",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        gameState = "PLAYING";
        const a = __mk(400, { gender: "male", name: "Bolt" });
        const b = __mk(450, { name: "Daisy" });
        let accepted = 0;
        proposeSpecialFriends(a, b, () => accepted++);
        out.asked = isChoiceOpen() && /special friends/.test(choiceDialog.title);
        cancelChoice();
        out.refused = [sfRefused(a, b), sfRefused(b, a), accepted, (relationships[a.id] || {})[b.id] || null];
        // Not watching (another room): they just decide
        const c = __mk(400, { gender: "male", scene: "BACKYARD" });
        const d = __mk(450, { scene: "BACKYARD" });
        proposeSpecialFriends(c, d, () => accepted++);
        out.unseen = [isChoiceOpen(), accepted, relationships[c.id][d.id]];
        // A partner hurt by a fluffy: its special friend speaks up
        const bully = __mk(500, { scene: "BACKYARD" });
        d.performAttack = d.performAttack.bind(d);
        onSpecialFriendHarmed(d, bully);
        out.harmed = [__said(c).length > 0, getOpinion(c, bully) < 0];
        // Bred by someone else
        timePlayed += 100;
        const other = __mk(520, { gender: "male", scene: "BACKYARD" });
        c.speech.text = null;
        onSpecialFriendBred(other, d, false);
        out.bred = [__said(c).length > 0, getOpinion(c, other) < 0];
        return out;
      }, SETUP);
      check(r.asked, "you're asked");
      checkEqual(JSON.stringify(r.refused), JSON.stringify([true, true, 0, null]), "kept apart: no bond, and they won't ask for a while");
      checkEqual(JSON.stringify(r.unseen), JSON.stringify([false, 1, "special_friend"]), "where you're not looking, they decide");
      checkEqual(JSON.stringify(r.harmed), JSON.stringify([true, true]), "stands up for its partner");
      checkEqual(JSON.stringify(r.bred), JSON.stringify([true, true]), "minds its partner bred by another");
    },
  },
];
