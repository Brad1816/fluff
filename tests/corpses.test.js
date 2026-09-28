// Corpses rot away (Corpses.js) and rival herds keep apart (Herds.js keepsApart)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "corpses: rot, fade and disappear with game time (not while you hold one)",
    run: async (page) => {
      const r = await page.evaluate(async () => {
        __clearScene();
        const mk = () => {
          const h = new Horse(1, null, "INDOORS", "earthy");
          h.x = 500;
          h.y = 500;
          fluffies.push(h);
          h.die(null, "test");
          return h;
        };
        const a = mk();
        const held = mk();
        held.isDragging = true;
        const res = {};
        __fastForward(ROT_START - 10);
        res.freshRot = corpseRot(a);
        __fastForward(200);
        res.midRot = corpseRot(a);
        // Saving keeps how long it's been dead
        gameState = "PAUSED";
        const want = a.deathTimer;
        await saveGame("__automated_test__");
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        const back = fluffies.find((f) => f.id === a.id);
        res.savedTimer = Math.abs(back.deathTimer - want) < 1;
        fluffies.find((f) => f.id === held.id).isDragging = true; // still holding it
        gameState = "PLAYING";
        __fastForward(ROT_GONE - ROT_START - 190 + 5);
        res.aGone = !fluffies.some((f) => f.id === a.id);
        const h2 = fluffies.find((f) => f.id === held.id);
        res.heldKept = !!h2;
        h2.isDragging = false;
        __fastForward(2);
        res.heldGoneAfterDrop = !fluffies.some((f) => f.id === held.id);
        // Drawing a rotting corpse works (and puts the canvas back as it was)
        const c = mk();
        c.deathTimer = ROT_FULL + 60;
        const ctx2 = document.createElement("canvas").getContext("2d");
        c.draw(ctx2);
        res.filterAfter = ctx2.filter;
        res.alphaAfter = ctx2.globalAlpha;
        return res;
      });
      checkEqual(r.freshRot, 0, "rot before it starts");
      check(r.midRot > 0.2 && r.midRot < 1, `rot part way: ${r.midRot}`);
      check(r.savedTimer, "time since death wasn't saved");
      check(r.aGone, "corpse still there after it should have rotted away");
      check(r.heldKept, "a corpse you're holding disappeared");
      check(r.heldGoneAfterDrop, "the held corpse stayed after being put down");
      checkEqual(r.filterAfter, "none", "canvas filter after drawing");
      checkEqual(r.alphaAfter, 1, "canvas alpha after drawing");
    },
  },
  {
    name: "rival herds: no hugs, chats, friends or shared beds across herds",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        __seedRandom(12);
        herdState = freshHerdState();
        _herdChanged();
        changeScene("INDOORS");
        const mk = (x, y, mom) => {
          const h = new Horse(1, mom ? mom.id : null, "PARK", "earthy", null, null, null, "female");
          h.x = x;
          h.y = y;
          h.hunger = 1;
          h.happiness = 0.8;
          fluffies.push(h);
          return h;
        };
        const fam = (x, y) => {
          const m = mk(x, y);
          return [m, mk(x + 40, y, m), mk(x + 80, y + 20, m)];
        };
        const red = fam(1000, 800);
        const blue = fam(2600, 1500);
        herdsTicker.fireNext();
        updateHerds(3);
        // Old friends from before, now in rival herds
        setRelationship(red[1].id, blue[1].id, "friend");
        setRelationship(blue[1].id, red[1].id, "friend");
        blue[1].x = red[1].x + 30;
        blue[1].y = red[1].y;
        const res = {
          apart: keepsApart(red[1], blue[1]),
          mates: keepsApart(red[1], red[2]),
          refuses: refusesFriendshipFrom(red[2], blue[2]),
        };
        red[1].initBehavior("IDLE");
        blue[1].initBehavior("IDLE");
        red[1].attemptHugging(blue[1]);
        res.hugged = red[1].currentStateKey === "HUGGING";
        // Tired right next to a rival: walks away (to its leader) before sleeping
        const lead = getHerdLeader(herdOf(blue[1]));
        blue[1].sleepDeprivation = 1;
        blue[1].positioning.scoutForSleep();
        res.sleepMoved = blue[1].sleepTargetSet && blue[1].currentStateKey !== "SLEEPING";
        res.towardLeader = Math.hypot(blue[1].targetX - lead.x, blue[1].targetY - lead.y) < 120;
        return res;
      });
      check(r.apart, "rival herd members should keep apart");
      check(!r.mates, "herd-mates shouldn't keep apart");
      check(r.refuses, "rival herds made friends");
      check(!r.hugged, "rival herd members hugged");
      check(r.sleepMoved, "fell asleep right next to a rival");
      check(r.towardLeader, "didn't head back to its own herd to sleep");
    },
  },
];
