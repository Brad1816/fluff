// The house you can see (HouseLife.js): room tint, drooping ears, huddles,
// sleeping heaps, party hats and bunting
const { check, checkEqual } = require("./helpers");

// A grown, adopted fluffy in the living room
const MAKE = `() => {
  window.__hl = (x, y = 450, gender = "female") => {
    const f = new Horse(1, null, "INDOORS", "earthy", null, 0.6, 0.6, gender);
    f.adopted = true;
    f.x = x;
    f.y = y;
    f.hunger = 1;
    f.happiness = 0.7;
    fluffies.push(f);
    return f;
  };
}`;

module.exports = [
  {
    name: "house life: ears droop when sad, grieving, frightened or Broken, and perk up again",
    run: async (page) => {
      const r = await page.evaluate((make) => {
        eval(make)();
        __clearScene();
        const f = __hl(400);
        const out = {};
        out.happy = earDroopAngle(f);
        f.happiness = 0.2;
        out.sad = earDroopAngle(f);
        f.happiness = 0.02;
        out.verySad = earDroopAngle(f);
        f.happiness = 0.7;
        f.separation = { grief: 0.5 };
        out.grief = earDroopAngle(f);
        f.separation = null;
        f.scaredTimer = 3;
        out.scared = earDroopAngle(f);
        f.scaredTimer = 0;
        f.title = "Broken";
        out.broken = typeof titleOf === "function" && titleOf(f) === "Broken" ? earDroopAngle(f) : "no title";
        f.title = null;
        // The ears really go there, and come back
        f.happiness = 0.05;
        for (let i = 0; i < 60; i++) f._updateEarFlop(1 / 30);
        out.hung = +f.limbs.earFlopValue.toFixed(2);
        f.happiness = 0.8;
        for (let i = 0; i < 90; i++) f._updateEarFlop(1 / 30);
        out.back = +Math.abs(f.limbs.earFlopValue).toFixed(2);
        out.asleep = (() => {
          f.happiness = 0.05;
          f.currentStateKey = "SLEEPING";
          return earDroopAngle(f);
        })();
        return out;
      }, MAKE);
      checkEqual(r.happy, null, "a happy fluffy's ears do as they like");
      check(r.sad < -0.5 && r.sad > -1.2, `sad: ${r.sad}`);
      check(r.verySad < r.sad, `sadder, lower: ${r.verySad} vs ${r.sad}`);
      check(r.grief <= -1.1, `grieving: ${r.grief}`);
      check(r.scared <= -1.25, `frightened: ears pinned ${r.scared}`);
      check(r.broken === "no title" || r.broken <= -1.1, `Broken: ${r.broken}`);
      check(r.hung < -0.9, `ears hung back: ${r.hung}`);
      check(r.back < 0.8, `ears came back up: ${r.back}`);
      checkEqual(r.asleep, null, "asleep: left alone");
    },
  },
  {
    name: "house life: the room's feel tints it, at once on walking in and fading as it changes",
    run: async (page) => {
      const r = await page.evaluate((make) => {
        eval(make)();
        __clearScene();
        __hl(400);
        const out = {};
        roomClimate = freshRoomClimate();
        _climateCache = null;
        addRoomClimate("INDOORS", { w: 10 });
        _tint.scene = null;
        out.enter = { ...roomTintWeights("INDOORS", 0) };
        // It turns Fearful: warmth fades out, fear fades in
        roomClimate = freshRoomClimate();
        _climateCache = null;
        addRoomClimate("INDOORS", { f: 12 });
        out.label = climateOf("INDOORS").label;
        const mid = roomTintWeights("INDOORS", 0.5);
        out.mid = { warm: +(mid.Warm || 0).toFixed(2), fear: +(mid.Fearful || 0).toFixed(2) };
        for (let i = 0; i < 10; i++) roomTintWeights("INDOORS", 0.5);
        out.end = { ...roomTintWeights("INDOORS", 0) };
        // Not a house room: nothing
        _tint.scene = null;
        out.street = Object.keys(roomTintWeights("SHOPPING_STREET", 0)).length;
        // Drawing works for every feel
        const c = document.createElement("canvas").getContext("2d");
        out.drawErr = null;
        try {
          for (const k of Object.keys(ROOM_TINTS)) {
            _tint = { scene: currentScene, w: { [k]: 1 } };
            drawRoomTint(c);
          }
        } catch (e) {
          out.drawErr = e.message;
        }
        roomClimate = freshRoomClimate();
        _climateCache = null;
        return out;
      }, MAKE);
      checkEqual(JSON.stringify(r.enter), JSON.stringify({ Warm: 1 }), "walking into a warm room");
      checkEqual(r.label, "Fearful", "room turned Fearful");
      check(r.mid.warm > 0 && r.mid.warm < 1 && r.mid.fear > 0 && r.mid.fear < 1, `half way: ${JSON.stringify(r.mid)}`);
      checkEqual(JSON.stringify(r.end), JSON.stringify({ Fearful: 1 }), "after a few seconds");
      checkEqual(r.street, 0, "no tint outside the house");
      checkEqual(r.drawErr, null, "drawing the tints");
    },
  },
  {
    name: "house life: in a tense room fluffies huddle with a friend and take comfort; not in a calm one",
    run: async (page) => {
      const r = await page.evaluate((make) => {
        eval(make)();
        __clearScene();
        __seedRandom(7);
        const a = __hl(250);
        const b = __hl(900, 450, "male");
        const stranger = __hl(600, 650);
        changeOpinion(a, b, 0.9);
        changeOpinion(b, a, 0.9);
        const out = {};
        // Calm: nobody huddles
        roomClimate = freshRoomClimate();
        _climateCache = null;
        for (const f of [a, b, stranger]) f.initBehavior("IDLE");
        for (let i = 0; i < 10; i++) updateHuddles(HUDDLE_CHECK);
        out.calm = [a, b, stranger].filter((f) => f._huddle).length;
        // Tense
        addRoomClimate("INDOORS", { t: 12 });
        out.label = climateOf("INDOORS").label;
        out.partner = huddlePartner(a) === b;
        out.strangerPartner = huddlePartner(stranger);
        for (let i = 0; i < 10 && !a._huddle && !b._huddle; i++) {
          a.initBehavior("IDLE");
          b.initBehavior("IDLE");
          updateHuddles(HUDDLE_CHECK);
        }
        out.started = !!(a._huddle || b._huddle);
        out.stranger = !!stranger._huddle;
        const d0 = Math.hypot(a.x - b.x, a.y - b.y);
        const h0 = a.happiness + b.happiness;
        let dMin = d0;
        for (let t = 0; t < 30; t++) {
          __fastForward(1);
          dMin = Math.min(dMin, Math.hypot(a.x - b.x, a.y - b.y));
        }
        out.closer = [Math.round(d0), Math.round(dMin)];
        // Comfort once together: park them side by side and let it tick
        a.x = b.x - 45;
        a.y = b.y;
        const who = a._huddle ? a : b;
        who._huddle = { with: (who === a ? b : a).id, until: timePlayed + 100 };
        who.happiness = 0.5;
        updateHuddles(HUDDLE_CHECK);
        out.comfort = +(who.happiness - 0.5).toFixed(4);
        // The room calms: the huddle ends
        roomClimate = freshRoomClimate();
        _climateCache = null;
        updateHuddles(HUDDLE_CHECK);
        out.ended = !who._huddle;
        void h0;
        return out;
      }, MAKE);
      checkEqual(r.calm, 0, "no huddles in a calm room");
      checkEqual(r.label, "Tense", "room is tense");
      check(r.partner, "a friend is the one to huddle with");
      checkEqual(r.strangerPartner, null, "nobody for the stranger");
      check(r.started, "a huddle started");
      check(!r.stranger, "the stranger doesn't huddle");
      check(r.closer[1] <= 120, `moved together: ${r.closer}`);
      check(r.comfort > 0, `comfort: ${r.comfort}`);
      check(r.ended, "huddle ended when the room calmed");
    },
  },
  {
    name: "house life: friends asleep near each other shuffle into a heap; strangers don't; a foal tucks in by mum",
    run: async (page) => {
      const r = await page.evaluate((make) => {
        eval(make)();
        __clearScene();
        const a = __hl(400);
        const b = __hl(500, 470);
        const c = __hl(580, 450);
        const s = __hl(900, 450); // a stranger, too far anyway
        const s2 = __hl(1000, 450); // a stranger close by
        for (const x of [a, b, c]) for (const y of [a, b, c]) if (x !== y) changeOpinion(x, y, 0.9);
        const all = [a, b, c, s, s2];
        for (const f of all) {
          f.sleepDeprivation = 1;
          f.initBehavior("SLEEPING");
        }
        const d = (p, q) => Math.round(Math.hypot(p.x - q.x, p.y - q.y));
        const out = { before: [d(a, b), d(b, c), d(s, s2)] };
        for (let i = 0; i < 40; i++) {
          for (const f of all) f.currentStateKey = "SLEEPING";
          updateSleepHeaps(0.5);
        }
        out.after = [d(a, b), d(b, c), d(s, s2)];
        _heapCache = null; // (kept for a moment, for drawing)
        out.heaps = sleepHeaps("INDOORS").map((h) => h.length);
        out.facing = c._pileWith ? (fluffies.find((x) => x.id === c._pileWith).x > c.x) === c.facingRight : "no buddy";
        // A foal and its mum
        __clearScene();
        const mum = __hl(400);
        const foal = __hl(500, 450);
        foal.growth = 0.4;
        foal.motherId = mum.id;
        for (const f of [mum, foal]) {
          f.sleepDeprivation = 1;
          f.initBehavior("SLEEPING");
        }
        for (let i = 0; i < 40; i++) {
          mum.currentStateKey = foal.currentStateKey = "SLEEPING";
          updateSleepHeaps(0.5);
        }
        out.foal = d(mum, foal);
        // Drawing the heap glow
        const cv = document.createElement("canvas").getContext("2d");
        out.drawErr = null;
        try {
          drawSleepHeapShadows(cv);
        } catch (e) {
          out.drawErr = e.message;
        }
        return out;
      }, MAKE);
      check(r.after[0] <= 46 && r.after[0] < r.before[0], `a and b snuggled: ${r.before} -> ${r.after}`);
      check(r.after[1] <= 46, `b and c snuggled: ${r.after}`);
      checkEqual(r.after[2], r.before[2], "strangers stay where they are");
      checkEqual(JSON.stringify(r.heaps), "[3]", "one heap of three");
      checkEqual(r.facing, true, "facing its buddy");
      check(r.foal <= 30, `foal tucked in by mum: ${r.foal}`);
      checkEqual(r.drawErr, null, "drawing the heap");
    },
  },
  {
    name: "house life: a party puts hats on the guests, bunting on the wall and confetti in the air, then it's tidied away",
    run: async (page) => {
      const r = await page.evaluate((make) => {
        eval(make)();
        __clearScene();
        partyDecor = {};
        _confetti = [];
        const f = __hl(400);
        const g = __hl(600, 450, "male");
        const h = __hl(800);
        h.accessories = { head: { id: Object.keys(ACCESSORY_DB)[0] } }; // already has a hat on
        recordStory("arrived", f, { x: "you" });
        const out = {};
        out.party = !!throwParty(f);
        out.hats = [hasPartyHat(f), hasPartyHat(g), hasPartyHat(h)];
        out.bunting = !!partyDecor.INDOORS;
        out.confetti = _confetti.length;
        // Drawn without trouble
        const c = document.createElement("canvas").getContext("2d");
        out.drawErr = null;
        try {
          drawPartyBunting(c);
          drawConfetti(c);
          f.renderer.drawOffScreen(c);
        } catch (e) {
          out.drawErr = e.message;
        }
        // Confetti falls, and is gone in a few seconds
        const y0 = _confetti[0].y;
        updatePartyDecor(0.5);
        out.falls = _confetti.length && _confetti[0].y > y0;
        timePlayed += PARTY_CONFETTI_TIME + 1;
        updatePartyDecor(0.1);
        out.confettiAfter = _confetti.length;
        // Hats come off after a couple of hours, the bunting after three
        timePlayed += PARTY_HAT_TIME * HOUR_LENGTH;
        updatePartyDecor(0.1);
        out.hatsAfter = [hasPartyHat(f), !!f.partyHat];
        out.buntingStill = !!partyDecor.INDOORS;
        timePlayed += PARTY_BUNTING_TIME * HOUR_LENGTH;
        updatePartyDecor(0.1);
        out.buntingAfter = !!partyDecor.INDOORS;
        return out;
      }, MAKE);
      check(r.party, "party thrown");
      checkEqual(JSON.stringify(r.hats), JSON.stringify([true, true, false]), "hats on (not over a hat)");
      check(r.bunting, "bunting up");
      check(r.confetti >= 50, `confetti: ${r.confetti}`);
      checkEqual(r.drawErr, null, "drawing");
      check(r.falls, "confetti falls");
      checkEqual(r.confettiAfter, 0, "confetti gone");
      checkEqual(JSON.stringify(r.hatsAfter), JSON.stringify([false, false]), "hats off");
      check(r.buntingStill, "bunting still up after the hats");
      check(!r.buntingAfter, "bunting down later");
    },
  },
];
