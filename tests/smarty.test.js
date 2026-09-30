// Smarty moods (SmartyMood.js): bullies that leave their own alone, fight
// only when provoked or in a bad mood, and seek enfies less often.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __seedRandom(31);
  timePlayed = 5 * DAY_LENGTH + 2 * HOUR_LENGTH;
  window.__mk = (x, gender = "male", opts = {}) => {
    const h = new Horse(1, opts.mum ?? null, "INDOORS", "earthy", null, 0.5, 0.5, gender);
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    if (opts.smarty) h.personalities.push("smarty");
    h.sexuality = "heterosexual";
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.happiness = opts.happy ?? 0.9;
    h.health = 100;
    h.brain.think = () => {};
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "smarty: in a good mood it only bullies now and then, never its own family or herd, and a shove can't kill",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const s = __mk(300, "male", { smarty: true });
        const brother = __mk(340, "male", { mum: 999 });
        s.motherId = 999;
        const herdMate = __mk(360);
        herdMate.herdId = s.herdId = 77;
        const stranger = __mk(420);
        const desire = new SmartyCombatDesire();
        const out = {};
        out.tolerates = [smartyTolerates(s, brother), smartyTolerates(s, herdMate), smartyTolerates(s, stranger)];
        out.fightGood = smartyFightTarget(s);
        // Not time to bully yet
        s.smartyNextBullyAt = timePlayed + HOUR_LENGTH;
        out.early = desire.evaluate(s);
        timePlayed += 2 * HOUR_LENGTH;
        out.score = desire.evaluate(s);
        out.pick = desire.target && desire.target.id === stranger.id;
        out.reason = desire.reason;
        // The shove: a little, never below the floor
        stranger.health = 100;
        s.performAttack(stranger, "BULLY");
        out.afterShove = stranger.health;
        stranger.health = SMARTY_BULLY_FLOOR + 1;
        for (let i = 0; i < 5; i++) {
          s.attackCooldown = 0;
          s.performAttack(stranger, "BULLY");
        }
        out.floor = [stranger.health, stranger.isAlive];
        // Going through the chase: shove once, then leave it
        stranger.health = 100;
        s.chaseTarget = stranger;
        s.chaseReason = "BULLY";
        s.x = stranger.x - 20;
        s.attackCooldown = 0;
        s._updateSmartyChase();
        out.chaseDone = [s.chaseTarget, stranger.health < 100, s.smartyNextBullyAt > timePlayed];
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.tolerates), JSON.stringify([true, true, false]), "family and herd tolerated, stranger not");
      checkEqual(r.fightGood, null, "no fights in a good mood");
      checkEqual(r.early, 0, "not bullying all the time");
      checkEqual(r.score, 60, "bullies now and then");
      check(r.pick && r.reason === "BULLY", "picks on the stranger");
      checkEqual(r.afterShove, 100 - 4, "a shove stings");
      checkEqual(JSON.stringify(r.floor), JSON.stringify([30, true]), "shoves never take it below 30");
      check(r.chaseDone[0] === null && r.chaseDone[1] && r.chaseDone[2], `one shove then off ${JSON.stringify(r.chaseDone)}`);
    },
  },
  {
    name: "smarty: it fights when provoked or in a bad mood, spares its own, and stops once they're hurt unless it's in a foul mood",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const s = __mk(300, "male", { smarty: true });
        const friend = __mk(330);
        setRelationship(s.id, friend.id, "friend");
        const stranger = __mk(420);
        const out = {};
        // Hit by the stranger: provoked, even in a good mood
        stranger.performAttack(s, "GRUDGE");
        out.provoked = [smartyProvokedBy(s, stranger), smartyFightTarget(s) === stranger];
        // Once it's hurt, a good-mood Smarty lets it go
        stranger.health = 35;
        out.stopsGood = smartyStopsFighting(s, stranger);
        // A fresh quarrel ends after a few hits, even if they're barely hurt
        const pest = __mk(260);
        pest.performAttack(s, "GRUDGE");
        const hitsTaken = [];
        for (let i = 0; i < 6 && !smartyStopsFighting(s, pest); i++) {
          pest.health = 100;
          smartyLandedHit(s, pest);
          hitsTaken.push(i);
        }
        out.pointHits = hitsTaken.length;
        fluffies.splice(fluffies.indexOf(pest), 1);
        // ...and that quarrel is settled, even with a grudge
        if (!s.opinions) s.opinions = {};
        s.opinions[stranger.id] = -0.9;
        out.settled = smartyProvokedBy(s, stranger);
        // Hitting back after it started it isn't a new provocation
        const other = __mk(500);
        s.smartyProvokerId = null;
        other.performAttack(s, "RETALIATION");
        out.hitBack = smartyProvokedBy(s, other);
        // A good-mood Smarty draws no blood
        let bled = 0;
        for (let i = 0; i < 40; i++) {
          other.health = 100;
          other.bleedingTimer = 0;
          s.attackCooldown = 0;
          s.performAttack(other, "SMARTY_VIOLENCE");
          if (other.bleedingTimer > 0) bled++;
        }
        out.bled = bled;
        fluffies.splice(fluffies.indexOf(other), 1);
        // A while later it has calmed down
        stranger.health = 100;
        timePlayed += SMARTY_PROVOKED_TIME + 5;
        if (s.opinions) s.opinions[stranger.id] = 0;
        out.calm = smartyFightTarget(s);
        // Bad mood: goes for a stallion it doesn't know, never its friend
        s.happiness = 0.2;
        out.bad = smartyFightTarget(s) === stranger;
        friend.x = 305;
        stranger.x = 700;
        out.notFriend = smartyFightTarget(s) === stranger;
        // ...and a foul-mooded one keeps going when they're hurt
        stranger.health = 35;
        out.stopsBad = smartyStopsFighting(s, stranger);
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.provoked), JSON.stringify([true, true]), "provoked: fights back");
      check(r.stopsGood, "good mood: stops once the other is hurt");
      checkEqual(r.pointHits, 3, "makes its point in 3 hits, then stops");
      checkEqual(r.settled, false, "made its point: the quarrel is settled for a while");
      checkEqual(r.hitBack, false, "being hit back isn't a provocation");
      checkEqual(r.bled, 0, "no bleeding from a good-mood Smarty");
      checkEqual(r.calm, null, "calmed down: no fight");
      check(r.bad, "bad mood: picks a fight");
      check(r.notFriend, "never with its friend, even when it's closer");
      checkEqual(r.stopsBad, false, "foul mood: keeps going");
    },
  },
  {
    name: "smarty: enfies every few hours at most, and pregnant mares only when there's no other mare about",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const s = __mk(300, "male", { smarty: true });
        s.specialHuggiesCooldown = 0;
        const pregnant = __mk(330, "female");
        pregnant.isPregnant = true;
        const other = __mk(800, "female");
        const out = {};
        out.prefers = s.positioning.findSmartyMateTarget() === other;
        other.isPregnant = true;
        other.x = 900;
        out.onlyPregnant = s.positioning.findSmartyMateTarget() === pregnant;
        other.isPregnant = false;
        const desire = new SeekSmartySpecialHuggiesDesire();
        out.ready = desire.evaluate(s) > 0;
        smartyDidEnfies(s);
        out.after = desire.evaluate(s);
        timePlayed += 1.5 * HOUR_LENGTH;
        out.soon = desire.evaluate(s);
        timePlayed += 4 * HOUR_LENGTH;
        out.later = desire.evaluate(s) > 0;
        // A mare scared of it runs whenever she sees it, but one fright
        // can't wear her down to nothing
        other.fearedFluffies = [{ id: s.id, timer: 300, reason: "BAD_ENFIES" }];
        other.happiness = 0.6;
        for (let i = 0; i < 60; i++) other.actionHandler.executeFearedFluffyFear(s);
        out.fearLoss = +(0.6 - other.happiness).toFixed(3);
        return out;
      }, SETUP);
      check(r.prefers, "goes past a nearer pregnant mare for another one");
      check(r.onlyPregnant, "a pregnant mare only when no other is free");
      check(r.ready, "looks for enfies to start with");
      checkEqual(r.after, 0, "not straight after");
      checkEqual(r.soon, 0, "not within a couple of hours");
      check(r.later, "again after a few hours");
      checkEqual(r.fearLoss, 0.15, "running from him 60 times costs 0.15 happiness at most");
    },
  },
];
