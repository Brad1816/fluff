// First-time hints (Hints.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "hints: a first-time card shows once, waits behind screens, opens its help page, and can be turned off",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        hintsActive = true;
        tutorialTimer = 0;
        resetHints();
        setHintsOn(true);
        const out = {};
        // Nothing new yet in an empty house by day
        weatherState.until = 1e9;
        out.none = nextDueHint() && nextDueHint().key;
        // A pregnant fluffy
        const f = new Horse(1, null, "INDOORS", "earthy", null, 0.6, 0.6, "female");
        f.adopted = true;
        fluffies.push(f);
        f.isPregnant = true;
        updateHints(2.1);
        out.shown = currentHint && currentHint.key;
        out.topic = currentHint && currentHint.topic;
        out.inHelp = HELP_TOPICS.some((t) => t.title === out.topic);
        // Clicking "Read more" opens that help page
        const c = document.querySelector("canvas").getContext("2d");
        drawHints(c);
        const L = getHintLayout(c);
        mouse.x = L.help.x + 5;
        mouse.y = L.help.y + 5;
        out.used = hintClick();
        out.helpOpen = isHelpOpen();
        out.helpTopic = HELP_TOPICS[helpTopic].title;
        // While a screen is open: no new card
        f.isPregnant = false;
        f.scars = [{ kind: "ear", how: "fight" }];
        updateHints(2.1);
        out.behindScreen = !!currentHint;
        closeHelp();
        updateHints(2.1);
        out.scar = currentHint && currentHint.key;
        // It goes by itself
        updateHints(20);
        out.gone = !currentHint;
        // Seen ones don't come back
        f.isPregnant = true;
        updateHints(2.1);
        out.again = currentHint ? currentHint.key : null;
        // Remembered for the player (browser storage)
        out.stored = JSON.parse(localStorage.getItem(HINTS_STORE) || "{}");
        // Turned off: nothing shows
        currentHint = null;
        setHintsOn(false);
        f.wish = { id: Object.keys(WISHES)[0], since: 0, ache: 0 };
        f.hunger = 1;
        updateHints(2.1);
        out.off = !!currentHint;
        // Every hint points at a real help page
        out.badTopics = HINTS.filter((h) => !HELP_TOPICS.some((t) => t.title === h.topic)).map((h) => h.key);
        setHintsOn(true);
        resetHints();
        hintsActive = false;
        return out;
      });
      checkEqual(r.none, null, "nothing due in an empty house");
      checkEqual(r.shown, "pregnant", "hint for the first pregnancy");
      check(r.inHelp, `topic ${r.topic} is a help page`);
      check(r.used && r.helpOpen, "Read more opened help");
      checkEqual(r.helpTopic, "Pregnancy & foals", "at the right page");
      checkEqual(r.behindScreen, false, "no card while help is open");
      checkEqual(r.scar, "scar", "next hint once help closed");
      check(r.gone, "card went by itself");
      checkEqual(r.again, null, "a seen hint doesn't come back");
      check(r.stored.seen && r.stored.seen.pregnant && r.stored.seen.scar, `stored: ${JSON.stringify(r.stored)}`);
      checkEqual(r.off, false, "no cards once turned off");
      checkEqual(JSON.stringify(r.badTopics), "[]", "hints with a missing help page");
    },
  },
  {
    name: "hints: the help screen's switch and the card's buttons",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const r = await page.evaluate(() => {
        hintsActive = true;
        tutorialTimer = 0;
        resetHints();
        setHintsOn(true);
        const out = {};
        // Hints switch in the help screen
        openHelp(0);
        const L = getHelpLayout();
        mouse.x = L.hints.x + 5;
        mouse.y = L.hints.y + 5;
        handleHelpClick();
        out.offFromHelp = !hintsOn();
        handleHelpClick();
        out.onAgain = hintsOn();
        closeHelp();
        // The card's x closes it; "No more hints" turns them off
        showHint("test1", "Just a test hint.", null);
        const c = document.querySelector("canvas").getContext("2d");
        let H = getHintLayout(c);
        out.noHelpButton = !H.help;
        mouse.x = H.close.x + 5;
        mouse.y = H.close.y + 5;
        hintClick();
        out.closed = !currentHint;
        showHint("test2", "Another test hint.", "Keys");
        H = getHintLayout(c);
        mouse.x = H.off.x + 5;
        mouse.y = H.off.y + 5;
        hintClick();
        out.offFromCard = !hintsOn() && !currentHint;
        // A click away from the card isn't swallowed
        setHintsOn(true);
        showHint("test3", "One more.", "Keys");
        mouse.x = 50;
        mouse.y = 400;
        out.passThrough = !hintClick();
        resetHints();
        hintsActive = false;
        return out;
      });
      check(r.offFromHelp && r.onAgain, "help screen switch");
      check(r.noHelpButton, "no Read more without a topic");
      check(r.closed, "x closed the card");
      check(r.offFromCard, "No more hints turned them off");
      check(r.passThrough, "click elsewhere reached the game");
    },
  },
];
