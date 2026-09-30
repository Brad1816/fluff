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
      checkEqual(topic, "Day, night & weather", "topic after clicking the third tab");
      check(closed, "Esc didn't close help");
      check(f1 && f1Closed, "F1 didn't toggle help");
    },
  },
  {
    name: "help: every topic is reachable in the list, long ones are paged, nothing overflows",
    run: async (page) => {
      const r = await page.evaluate(() => {
        openHelp(0);
        const out = { topics: HELP_TOPICS.length, reached: new Set(), overflow: [], lost: [], pages: {} };
        // Scroll the list with the arrows until the end, clicking every visible tab
        for (let guard = 0; guard < 40; guard++) {
          const L = getHelpLayout();
          L.tabs.forEach((t, i) => {
            if (!t) return;
            mouse.x = t.x + 10;
            mouse.y = t.y + 8;
            handleHelpClick();
            if (helpTopic === i) out.reached.add(i);
          });
          if (!L.down) break;
          const before = helpTopicScroll;
          mouse.x = L.down.x + 5;
          mouse.y = L.down.y + 5;
          handleHelpClick();
          if (helpTopicScroll === before) break;
        }
        out.reached = out.reached.size;
        // Pages: each fits, and together they hold every line
        const maxH = helpTextHeight();
        for (const t of HELP_TOPICS) {
          const pages = helpPages(t, maxH);
          out.pages[t.title] = pages.length;
          for (const p of pages) {
            const h = p.reduce((s, l) => s + (l === "" ? 10 : l.startsWith("# ") ? 26 : 22), 0);
            if (h > maxH) out.overflow.push(`${t.title}: ${h}`);
          }
          const kept = pages.flat().filter((l) => l !== "");
          const all = t.lines.filter((l) => l !== "");
          if (kept.join("|") !== all.join("|")) out.lost.push(t.title);
        }
        // More / Back buttons and the keys
        openHelp(HELP_TOPICS.findIndex((t) => t.title === "Feelings, fears & wishes"));
        const L = getHelpLayout();
        mouse.x = L.next.x + 5;
        mouse.y = L.next.y + 5;
        handleHelpClick();
        out.afterNext = helpPage;
        handleHelpKey("ArrowRight");
        out.afterKey = helpPage;
        handleHelpKey("ArrowLeft");
        mouse.x = L.prev.x + 5;
        mouse.y = L.prev.y + 5;
        handleHelpClick();
        out.back = helpPage;
        handleHelpKey("ArrowDown");
        out.nextTopic = [HELP_TOPICS[helpTopic].title, helpPage];
        // Opening a topic by name scrolls it into view
        openHelpAt("Money trouble");
        const i = helpTopic;
        out.named = [HELP_TOPICS[i].title, !!getHelpLayout().tabs[i]];
        closeHelp();
        return out;
      });
      checkEqual(r.reached, r.topics, "topics reachable by scrolling the list");
      check(r.topics >= 15, `topics: ${r.topics}`);
      check(!r.overflow.length, `pages too tall: ${r.overflow}`);
      check(!r.lost.length, `lines lost in paging: ${r.lost}`);
      check(r.pages["Feelings, fears & wishes"] >= 3, `pages: ${JSON.stringify(r.pages)}`);
      checkEqual(r.afterNext, 1, "More turns the page");
      checkEqual(r.afterKey, 2, "right arrow turns the page");
      checkEqual(r.back, 0, "left arrow and Back go back");
      checkEqual(JSON.stringify(r.nextTopic), JSON.stringify(["Tricks, lessons & care", 0]), "down arrow goes to the next topic, first page");
      checkEqual(JSON.stringify(r.named), JSON.stringify(["Money trouble", true]), "opened by name, in view");
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
