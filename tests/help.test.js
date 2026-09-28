// "How it works" help (Help.js) and settling in (Wellbeing.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "help: the ? button and F1 open it, topics switch, Esc closes",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate(() => {
        tutorialTimer = 0;
        helpOpen = false;
        helpTopic = 0;
      });
      const b = await page.evaluate(() => getHelpButtonRect(100));
      await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
      const opened = await page.evaluate(() => isHelpOpen() && isAnyScreenOpen());
      const tab = await page.evaluate(() => getHelpLayout().tabs[2]);
      await page.mouse.click(tab.x + 20, tab.y + 10);
      const topic = await page.evaluate(() => HELP_TOPICS[helpTopic].title);
      await page.keyboard.press("Escape");
      const closed = await page.evaluate(() => !isHelpOpen());
      await page.keyboard.press("F1");
      const f1 = await page.evaluate(() => isHelpOpen());
      await page.keyboard.press("F1");
      const f1Closed = await page.evaluate(() => !isHelpOpen());
      check(opened, "? button didn't open help");
      checkEqual(topic, "Fluffy Park", "topic after clicking the third tab");
      check(closed, "Esc didn't close help");
      check(f1 && f1Closed, "F1 didn't toggle help");
    },
  },
  {
    name: "settling in: a wild fluffy brought home shows progress and settles with good care",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __clearScene("PARK");
        namingPopupsEnabled = true;
        resetNamingPopups();
        updateNamingPopups(2);
        const [f] = spawnParkGroup("loner");
        f.happiness = 0.5; // a wary, so-so wild fluffy
        f.playerTrust = 0.2;
        f.playerFear = 0.15;
        f.fromPark = true;
        f.scene = "INDOORS";
        f.adopted = true;
        fluffyNames[f.id] = "Wildy"; // no naming pop-up in the way
        updateNamingPopups(2);
        const res = { settling: f.settling, start: settlingProgress(f) };
        res.row = getFluffyInspectionInfo(f).care.find((x) => x.label === "Settling in");
        // Good care over time
        f.playerTrust = 0.9;
        f.playerFear = 0;
        f.happiness = 0.9;
        res.mid = settlingProgress(f);
        updateSettling(3);
        res.after = f.settling;
        res.rowAfter = !!getFluffyInspectionInfo(f).care.find((x) => x.label === "Settling in");
        return res;
      });
      check(r.settling, "not settling in after being brought home");
      check(r.start < 0.2, `progress at the start: ${r.start}`);
      check(r.row && /%$/.test(r.row.value), `magnifying glass row: ${JSON.stringify(r.row)}`);
      checkEqual(r.mid, 1, "progress once trusting and happy");
      check(!r.after && !r.rowAfter, "still settling in after settling");
    },
  },
];
