// Play and boredom (Play.js), and Fetch (Tricks.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __clearScene(PARK_SCENE);
  __seedRandom(44);
  if (typeof closeTrickUI === "function") closeTrickUI();
  weatherState.until = 1e9;
  weatherState.type = weatherState.target = "clear";
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH;
  window.__setTrait = (h, key, sum) => {
    const i = TRAITS.findIndex((q) => q.key === key);
    for (let k = 0; k < TRAIT_GENES_EACH; k++) h.genes[TRAIT_GENE_START + i * TRAIT_GENES_EACH + k] = k < sum ? 1 : 0;
  };
  window.__mk = (x, scene = "INDOORS", y = 520) => {
    const h = new Horse(1, null, scene, "earthy", null, 0.5, 0.5, "female");
    for (const t of TRAITS) __setTrait(h, t.key, 2);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = y;
    h.hunger = 1;
    h.warmth = 1;
    h.happiness = 0.7;
    h.playerTrust = 0.6;
    h.boredom = 0;
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
  window.__run = (secs) => {
    for (let i = 0; i < secs / 2; i++) {
      timePlayed += 2;
      for (const f of fluffies) f.hunger = 1;
      playTicker.fireNext();
      updatePlay(0);
    }
  };
  window.__said = [];
  window.__realMsg = window.__realMsg || window.addUIMessage;
  window.addUIMessage = (t) => __said.push(t);
}`;
const TEARDOWN = () => {
  if (window.__realMsg) window.addUIMessage = window.__realMsg;
};

module.exports = [
  {
    name: "play: boredom builds up with nothing to do - faster if playful, slower with a friend, and the park cures it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const plain = __mk(200);
        const playful = __mk(500);
        __setTrait(playful, "energy", TRAIT_GENES_EACH);
        const lazy = __mk(800);
        __setTrait(lazy, "energy", 0);
        const pal1 = __mk(300, "INDOORSL1");
        const pal2 = __mk(600, "INDOORSL1");
        if (!relationships[pal1.id]) relationships[pal1.id] = {};
        relationships[pal1.id][pal2.id] = "friend";
        const park = __mk(900, PARK_SCENE, 1200);
        park.boredom = 0.8;
        const sleepy = __mk(1100);
        sleepy.currentStateKey = "SLEEPING";
        __run(4 * HOUR_LENGTH);
        for (const f of fluffies) if (f !== sleepy) f.currentStateKey = "IDLE";
        const four = { plain: plain.boredom, playful: playful.boredom, lazy: lazy.boredom, friend: pal1.boredom, park: park.boredom, asleep: sleepy.boredom };
        __run(4 * HOUR_LENGTH);
        return {
          four,
          eight: plain.boredom,
          level: describeBoredom(plain),
          warn: getInspectionTabs(plain).warnings.some((w) => /Boredom/.test(w)),
          bonus: playDesireBonus(plain),
        };
      }, SETUP);
      await page.evaluate(TEARDOWN);
      check(r.four.plain > 0.4 && r.four.plain < 0.52, `4 hours alone ${r.four.plain}`);
      check(r.four.playful > r.four.plain && r.four.plain > r.four.lazy, `playful ${r.four.playful} > plain > lazy ${r.four.lazy}`);
      check(r.four.friend < r.four.plain, `a friend helps ${r.four.friend}`);
      check(r.four.park < 0.8, `the park is exciting ${r.four.park}`);
      checkEqual(r.four.asleep, 0, "not while asleep");
      check(r.eight >= 0.85, `a whole day of nothing ${r.eight}`);
      checkEqual(r.level[0], "Very bored - needs to play", "magnifying glass");
      check(r.warn, "warning chip");
      check(r.bonus >= 34, `wants to play much more ${r.bonus}`);
    },
  },
  {
    name: "play: kicking a ball cures boredom (its favourite toy more); waving a ball in your hand is a game with you",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400);
        f.boredom = 0.8;
        f.toyLikes = { ball: 0.1, block: 0.9, tv: 0.2 };
        const g = __mk(900);
        g.boredom = 0.8;
        g.toyLikes = { ball: 0.9, block: 0.1, tv: 0.2 };
        onFluffyPlayed(f, "ball");
        onFluffyPlayed(g, "ball");
        const out = { plainKick: 0.8 - f.boredom, favKick: 0.8 - g.boredom, favs: [favouriteToy(f), favouriteToy(g)] };
        // A real ball on the floor: a bored fluffy goes and kicks it
        f.boredom = 0.8;
        const ball = new Ball(600, 540, "INDOORS");
        objects.push(ball);
        g.scene = "INDOORSL1"; // out of the way
        g.boredom = 0;
        for (let i = 0; i < 15 && f.boredom >= 0.8; i++) __fastForward(1);
        out.kicked = 0.8 - f.boredom;
        // Waving a ball in your hand
        objects.splice(objects.indexOf(ball), 1);
        const held = new Ball(900, 480, "INDOORS");
        objects.push(held);
        held.isDragging = true;
        g.boredom = 0.6;
        g.scene = "INDOORS";
        f.scene = "INDOORSL1";
        g.x = 700;
        g.y = 520;
        g.initBehavior("IDLE");
        const t0 = g.playerTrust;
        g.weight = 0.5;
        for (let i = 0; i < 12 && !g._playedWithYouAt; i++) {
          __fastForward(0.5);
          held.x = 900;
          held.y = 480;
        }
        out.played = !!g._playedWithYouAt;
        out.boredAfter = g.boredom;
        out.trust = g.playerTrust - t0;
        out.weight = g.weight;
        held.isDragging = false;
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      check(Math.abs(r.plainKick - 0.25) < 0.01, `a kick ${r.plainKick}`);
      check(Math.abs(r.favKick - 0.375) < 0.01, `favourite toy counts more ${r.favKick}`);
      checkEqual(JSON.stringify(r.favs), JSON.stringify(["block", "ball"]), "favourite toys");
      check(r.kicked >= 0.2, `went and kicked the ball ${r.kicked}`);
      check(r.played, "chased the ball in your hand");
      check(r.boredAfter < 0.3, `and cheered up ${r.boredAfter}`);
      check(r.trust > 0.02, `and loves you a bit more ${r.trust}`);
      check(r.weight < 0.5, `and burnt a bit off ${r.weight}`);
    },
  },
  {
    name: "play: a very bored fluffy knocks over food or picks on others",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(400);
        f.boredom = 0.9;
        const bowl = new Bowl("bowl", "INDOORS");
        bowl.x = 600;
        bowl.y = 560;
        bowl.food = 5;
        bowl.foodType = "kibble";
        objects.push(bowl);
        const out = { first: boredMischief(f), bowl: bowl.food, msg: __said.some((m) => /knocked a bowl/.test(m)) };
        const victim = __mk(600);
        const h0 = victim.happiness;
        out.second = boredMischief(f);
        out.victimSadder = victim.happiness < h0;
        out.msg2 = __said.some((m) => /picking on/.test(m));
        // It happens by itself every few minutes
        const g = __mk(900);
        g.boredom = 0.95;
        bowl.food = 5;
        bowl.foodType = "kibble";
        victim.x = 2000;
        __said.length = 0;
        __run(10 * 60);
        out.byItself = __said.length;
        out.unhappier = g.happiness < 0.7;
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      checkEqual(r.first, "bowl", "knocked the bowl over");
      checkEqual(r.bowl, 0, "food gone");
      check(r.msg, "you're told");
      checkEqual(r.second, "pick", "then picked on another");
      check(r.victimSadder && r.msg2, "which upset it");
      check(r.byItself >= 1, `mischief happens by itself (${r.byItself})`);
      check(r.unhappier, "very bored fluffies get unhappy");
    },
  },
  {
    name: "play: Fetch - runs to the ball and brings it back; no ball, no fetch",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(300);
        f.playerTrust = 0.9;
        f.tricks = { fetch: 1 };
        f.boredom = 0.5;
        const out = { noBall: tryTrick(f, "fetch") };
        const ball = new Ball(1000, 560, "INDOORS");
        objects.push(ball);
        __seedRandom(2);
        out.res = tryTrick(f, "fetch");
        const path = [];
        let carried = false;
        for (let i = 0; i < 30 && f.trickNow; i++) {
          __fastForward(0.5);
          if (ball.carriedBy === f.id) carried = true;
          path.push([Math.round(ball.x), Math.round(f.x)]);
        }
        out.carried = carried;
        out.ballBack = Math.round(Math.abs(ball.x - 300));
        out.dropped = !ball.carriedBy;
        out.bored = f.boredom;
        out.path = path.slice(-3);
        return out;
      }, SETUP);
      await page.evaluate(TEARDOWN);
      checkEqual(r.noBall, "noball", "no ball to fetch");
      checkEqual(r.res, "done", "went for it");
      check(r.carried, "carried it");
      check(r.ballBack < 120, `brought it back (${r.ballBack}px off) ${JSON.stringify(r.path)}`);
      check(r.dropped, "and let go");
      check(r.bored < 0.4, `fun ${r.bored}`);
    },
  },
];
