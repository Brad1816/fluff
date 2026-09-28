// Fast forward (GameSpeed.js) and where fluffies sleep (Bonds.js sleepBuddyScore)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "speed: the fast-forward buttons and F key speed up the game clock",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate(() => {
        __clearScene();
        tutorialTimer = 0;
      });
      const layout = await page.evaluate(() => getGameSpeedLayout(100).buttons);
      const b4 = layout.find((b) => b.speed === 4);
      await page.mouse.click(b4.x + b4.w / 2, b4.y + b4.h / 2);
      checkEqual(await page.evaluate(() => gameSpeed), 4, "speed after clicking 4x");
      const rate = await page.evaluate(async () => {
        const t0 = timePlayed;
        const r0 = performance.now();
        await new Promise((res) => setTimeout(res, 1500));
        return (timePlayed - t0) / ((performance.now() - r0) / 1000);
      });
      check(rate > 3.2 && rate < 4.6, `game seconds per real second at 4x: ${rate.toFixed(2)}`);
      await page.keyboard.press("KeyF");
      checkEqual(await page.evaluate(() => gameSpeed), 8, "speed after pressing F");
      await page.keyboard.press("KeyF");
      checkEqual(await page.evaluate(() => gameSpeed), 1, "F wraps back to 1x");
      // Loading a game goes back to 1x
      const afterLoad = await page.evaluate(async () => {
        setGameSpeed(8);
        gameState = "PAUSED";
        await saveGame("__automated_test__");
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        gameState = "PLAYING";
        return gameSpeed;
      });
      checkEqual(afterLoad, 1, "speed after loading");
      checkEqual(await page.evaluate(() => formatGameClock(3725)), "1:02:05", "clock text");
    },
  },
  {
    name: "sleep: in the park fluffies sleep with their own herd, not the nearest pile",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        __seedRandom(4);
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
        _herdTimer = 0;
        updateHerds(3);
        for (const f of [...red, ...blue]) f.initBehavior("SLEEPING");
        // A tired blue fluffy right next to the red pile
        const tired = blue[2];
        tired.initBehavior("IDLE");
        tired.x = 1100;
        tired.y = 820;
        tired.positioning.scoutForSleep();
        const tiredTarget = { x: tired.targetX, y: tired.targetY, set: tired.sleepTargetSet };
        // A loner far from everyone just lies down where it is
        const loner = mk(300, 300);
        loner.positioning.scoutForSleep();
        const lonerState = loner.currentStateKey;
        // Indoors nothing changes: go to the nearest sleeper
        const a = new Horse(1, null, "INDOORS", "earthy", null, null, null, "female");
        const b = new Horse(1, null, "INDOORS", "earthy", null, null, null, "female");
        a.x = 300;
        a.y = 500;
        b.x = 700;
        b.y = 500;
        fluffies.push(a, b);
        b.initBehavior("SLEEPING");
        a.positioning.scoutForSleep();
        return {
          herds: herdState.list.length,
          tiredTarget,
          lonerState,
          indoorsTarget: a.targetX,
          rivalScore: sleepBuddyScore(tired, red[0], 50),
        };
      });
      checkEqual(r.herds, 2, "herds");
      check(r.tiredTarget.set && r.tiredTarget.x > 2400, `tired blue fluffy heads to x ${Math.round(r.tiredTarget.x)}`);
      checkEqual(r.rivalScore, null, "a rival herd's pile");
      checkEqual(r.lonerState, "SLEEPING", "a loner far from anyone sleeps where it is");
      check(r.indoorsTarget > 600 && r.indoorsTarget < 800, `indoors goes to the other sleeper: x ${Math.round(r.indoorsTarget)}`);
    },
  },
];
