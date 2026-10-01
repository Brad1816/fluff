// Getting dirty and bath time (Bath.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __clearScene("BACKYARD");
  __seedRandom(55);
  puddles.length = 0;
  weatherState.until = 1e9;
  weatherState.type = weatherState.target = "clear";
  weatherState.intensity = 0;
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH;
  window.__mk = (x, scene = "INDOORS") => {
    const h = new Horse(1, null, scene, "earthy", null, 0.5, 0.5, "female");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 500;
    h.hunger = 1;
    h.happiness = 0.6;
    h.playerTrust = 0.6;
    h.playerFear = 0;
    h.dirt = 0;
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
  window.__run = (secs) => {
    for (let i = 0; i < secs; i++) {
      timePlayed += 1;
      bathTicker.fireNext();
      updateBath(0);
    }
  };
}`;

module.exports = [
  {
    name: "bath: fluffies get dirty standing in mess, pooping on the floor, out in the rain, and slowly just living",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const inMess = __mk(300);
        const indoors = __mk(900);
        const outside = __mk(500, "BACKYARD");
        const wild = __mk(1200);
        wild.adopted = false;
        addPointToPuddle("INDOORS", 300, inMess.getBottomY(), "#5c4033", 0.5, 0.5, 0.02);
        addPointToPuddle("INDOORS", 1200, wild.getBottomY(), "#5c4033", 0.5, 0.5, 0.02);
        __run(10);
        const out = { mess: +inMess.dirt.toFixed(2), wild: wild.dirt, indoors10s: indoors.dirt };
        puddles.length = 0;
        // A day of nothing
        indoors.dirt = 0;
        __run(DAY_LENGTH);
        out.day = +indoors.dirt.toFixed(2);
        out.dayOutside = +outside.dirt.toFixed(2);
        // Rain
        outside.dirt = 0;
        weatherState.type = weatherState.target = "rain";
        weatherState.intensity = 1;
        __run(4 * HOUR_LENGTH);
        out.rain = +outside.dirt.toFixed(2);
        weatherState.type = weatherState.target = "clear";
        weatherState.intensity = 0;
        // Pooping on the floor
        const p = __mk(700);
        p.pottyTraining = 0;
        p.excrete("poop", 0.6);
        out.accident = +p.dirt.toFixed(3);
        out.levels = [0, 0.3, 0.6, 0.9].map((d) => {
          p.dirt = d;
          return dirtLevel(p);
        });
        return out;
      }, SETUP);
      check(r.mess >= 0.035, `standing in poop for 10s ${r.mess}`);
      checkEqual(r.wild, 0, "wild fluffies aren't tracked");
      check(r.indoors10s < 0.01, `10s of nothing: barely ${r.indoors10s}`);
      check(r.day > 0.06 && r.day < 0.1, `a day of just living ${r.day}`);
      check(r.dayOutside > r.day, `outside is grubbier ${r.dayOutside}`);
      check(r.rain > 0.4, `4 hours out in the rain: muddy ${r.rain}`);
      check(r.accident > 0.005, `pooped on the floor ${r.accident}`);
      checkEqual(JSON.stringify(r.levels), JSON.stringify(["clean", "grubby", "dirty", "filthy"]), "levels");
    },
  },
  {
    name: "bath: the sponge washes a fluffy - one that loves baths enjoys it, one that hates them screams but gets used to it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const lover = __mk(300);
        lover.bathLike = 0.8;
        lover.dirt = 0.9;
        const hater = __mk(900);
        hater.bathLike = -0.9;
        hater.dirt = 0.9;
        const sponge = new Sponge("INDOORS");
        objects.push(sponge);
        const aim = (f) => {
          // The middle of the body, so a rub stays on it
          const hits = [];
          for (let dy = -120; dy <= 0; dy += 6) for (let dx = -40; dx <= 40; dx += 6) if (f.hitTestAsSeen(f.x + dx, f.y + dy)) hits.push({ x: f.x + dx, y: f.y + dy });
          if (!hits.length) return null;
          const cx = hits.reduce((a, h) => a + h.x, 0) / hits.length;
          const cy = hits.reduce((a, h) => a + h.y, 0) / hits.length;
          return hits.reduce((b, h) => (Math.hypot(h.x - cx, h.y - cy) < Math.hypot(b.x - cx, b.y - cy) ? h : b));
        };
        const bathe = (f, rubs) => {
          const p = aim(f);
          sponge._scrub = null;
          // Rub it back and forth first (a real scrub, not a swipe)
          // (between two spots that are both on its body)
          const q = [[12, 0], [-12, 0], [0, 12], [0, -12], [6, 0], [-6, 0], [0, 6], [0, -6]]
            .map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))
            .find((o) => f.hitTestAsSeen(o.x, o.y));
          for (let i = 0; i < 24; i++) {
            const o = i % 2 ? q : p;
            sponge.x = o.x;
            sponge.y = o.y;
            sponge.attemptClean();
          }
          sponge.x = p.x;
          sponge.y = p.y;
          for (let i = 0; i < rubs; i++) sponge.attemptClean();
        };
        const t0 = lover.playerTrust;
        const h0 = lover.happiness;
        bathe(lover, 12);
        const out = { loverDirt: lover.dirt, loverTrust: lover.playerTrust - t0, loverHappier: lover.happiness > h0, loverFace: lover.expressionOverride };
        const hh = hater.happiness;
        bathe(hater, 3);
        out.hater = { face: hater.expressionOverride, sadder: hater.happiness < hh, fear: hater.playerFear, like: hater.bathLike };
        // More baths: it comes round
        for (let i = 0; i < 12; i++) {
          timePlayed += BATH_SESSION + 1;
          hater.dirt = 0.5;
          bathe(hater, 2);
        }
        out.haterLater = [hater.bathLike, describeBathLike(hater), hater.expressionOverride];
        // The sponge still cleans the floor when there's no fluffy
        addPointToPuddle("INDOORS", 600, 700, "#5c4033", 0.5, 0.5, 0.02);
        sponge.x = 600;
        sponge.y = 700;
        out.floor = sponge.attemptClean();
        puddles.length = 0;
        objects.splice(objects.indexOf(sponge), 1);
        return out;
      }, SETUP);
      checkEqual(r.loverDirt, 0, "12 rubs: squeaky clean");
      check(r.loverTrust > 0.02 && r.loverHappier, `loved it ${JSON.stringify(r)}`);
      checkEqual(r.loverFace, "GOOD_UPSIES", "happy face");
      checkEqual(r.hater.face, "CRYING_SHOCKED", "the hater screams");
      check(r.hater.sadder && r.hater.fear > 0, "and it's upsetting");
      check(r.hater.like > -0.9, "but it gets a bit more used to it");
      check(r.haterLater[0] >= 0, `after a dozen baths it doesn't mind ${r.haterLater}`);
      checkEqual(r.haterLater[2], "GOOD_UPSIES", "and even enjoys it");
      check(r.floor, "the sponge still cleans the floor");
    },
  },
  {
    name: "bath: a sponge swept straight past a fluffy doesn't start a bath - only rubbing back and forth does",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(500);
        f.bathLike = -0.9;
        f.dirt = 0.9;
        const sponge = new Sponge("INDOORS");
        let p = null;
        for (let dy = -120; dy <= 0 && !p; dy += 6) if (f.hitTestAsSeen(f.x, f.y + dy)) p = { x: f.x, y: f.y + dy };
        // One straight swipe across it, left to right
        for (let dx = -30; dx <= 30; dx += 10) {
          sponge.x = p.x + dx;
          sponge.y = p.y;
          sponge.attemptClean();
        }
        const out = { swipeDirt: f.dirt, swipeFear: f.playerFear, swipeBath: f._bathAt };
        // Now a proper scrub
        for (let i = 0; i < 8; i++) {
          sponge.x = p.x + (i % 2 ? 25 : -25);
          sponge.attemptClean();
        }
        out.scrubDirt = f.dirt;
        return out;
      }, SETUP);
      checkEqual(r.swipeDirt, 0.9, "a swipe past doesn't wash it");
      checkEqual(r.swipeFear, 0, "or frighten it");
      check(r.swipeBath === undefined, "no bath started");
      check(r.scrubDirt < 0.9, `rubbing back and forth does ${JSON.stringify(r)}`);
    },
  },
  {
    name: "bath: dirty fluffies look it, score less at shows, sell for less; filthy ones are miserable and smelly",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const clean = __mk(300);
        const filthy = __mk(700);
        filthy.genes = clean.genes.slice();
        filthy.processGenes();
        clean.processGenes();
        filthy.dirt = 1;
        const T = SHOW_THEMES.find((t) => t.id === "coat");
        const c = document.createElement("canvas").getContext("2d");
        const out = {
          show: [showScore(clean, T), showScore(filthy, T)],
          price: [clean.genetics.calculatePrice(), filthy.genetics.calculatePrice()],
          looks: [beginDirtLook(c, clean), beginDirtLook(c, filthy)],
          filter: c.filter,
          row: describeDirt(filthy),
          warn: getInspectionTabs(filthy).warnings.some((w) => /Cleanliness/.test(w)),
        };
        c.restore();
        const said = [];
        for (const f of [clean, filthy]) {
          const real = f.speak.bind(f);
          f.speak = (t, ...a) => {
            said.push(t);
            return real(t, ...a);
          };
        }
        const h0 = filthy.happiness;
        changeScene("INDOORS");
        __run(10 * 60);
        out.sadder = filthy.happiness < h0;
        out.talk = said.length;
        return out;
      }, SETUP);
      check(r.show[0] - r.show[1] >= 14, `shows ${r.show}`);
      check(r.price[1] < r.price[0] * 0.85, `price ${r.price}`);
      checkEqual(JSON.stringify(r.looks), JSON.stringify([false, true]), "only the dirty one is drawn darker");
      check(/sepia/.test(r.filter), `filter ${r.filter}`);
      checkEqual(r.row[0], "Filthy - needs a bath", "magnifying glass");
      check(r.warn, "warning chip");
      check(r.sadder, "filthy fluffies get unhappy");
      check(r.talk >= 1, `someone mentions the smell (${r.talk})`);
    },
  },
];
