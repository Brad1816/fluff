// Fluffy shows (Shows.js)
const { check, checkEqual } = require("./helpers");

// A clean scene, the clock at day 1 9 AM, and a helper to make fluffies
const SETUP = `() => {
  __clearScene();
  __seedRandom(21);
  timePlayed = 1 * HOUR_LENGTH; // day 1, 9 AM
  showState = freshShowState();
  customerOrders = freshCustomerOrders();
  goalsState = freshGoalsState();
  money = 10000;
  window.__mk = (opts = {}) => {
    const h = new Horse(opts.growth ?? 1, null, "INDOORS", opts.type || "earthy", null, 0.5, 0.5, opts.gender || "female");
    h.x = 400 + fluffies.length * 30;
    h.y = 450;
    h.hunger = 1;
    h.happiness = 0.8;
    h.playerTrust = 0.7;
    h.adopted = true;
    fluffies.push(h);
    return h;
  };
  window.__show = (themeId, level = 1) => {
    const t = getShowTheme(themeId);
    showState.next = { id: showState.nextId++, day: getDayNumber(), themeId, prizes: showPrizes(t, level), fee: showEntryFee(t, level), level };
    showState.entryId = null;
    showState.entryFee = 0;
  };
}`;

module.exports = [
  {
    name: "shows: who can enter, and the judges prefer better coats and healthier fluffies",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const adult = __mk();
        const foal = __mk({ growth: 0.5 });
        const uni = __mk({ type: "unicorn" });
        const baby = __mk({ growth: 0.05 });
        const T = (id) => getShowTheme(id);
        const out = {
          adultCoat: canEnterShow(adult, T("coat")),
          foalCoat: canEnterShow(foal, T("coat")),
          foalFoal: canEnterShow(foal, T("foal")),
          adultFoal: canEnterShow(adult, T("foal")),
          babyFoal: canEnterShow(baby, T("foal")),
          uniUni: canEnterShow(uni, T("unicorn")),
          adultUni: canEnterShow(adult, T("unicorn")),
        };
        // Wild (not yours) can't enter
        adult.adopted = false;
        out.wild = canEnterShow(adult, T("coat"));
        adult.adopted = true;
        // Coat score follows the colour price multiplier
        const pairs = [];
        for (let i = 0; i < 25; i++) {
          const f = __mk();
          pairs.push([f.genetics.calculateColorMultiplier(), showCoatScore(f)]);
        }
        pairs.sort((a, b) => a[0] - b[0]);
        out.coatOrdered = pairs.every((p, i) => i === 0 || p[1] >= pairs[i - 1][1]);
        out.coatRange = [pairs[0][1], pairs[pairs.length - 1][1]];
        // Poor health costs points
        const healthy = showScore(adult, T("coat"));
        adult.health = 30;
        out.sickDrop = healthy - showScore(adult, T("coat"));
        adult.health = 100;
        // Scores are 0..100 for every theme
        out.bad = [];
        for (const t of SHOW_THEMES)
          for (const f of fluffies) {
            const s = showScore(f, t);
            if (!(s >= 0 && s <= 100)) out.bad.push(`${t.id}:${s}`);
          }
        out.comment = showComment(adult, T("coat"));
        return out;
      }, SETUP);
      check(r.adultCoat && !r.foalCoat, "Best Coat is for grown-ups");
      check(r.foalFoal && !r.adultFoal && !r.babyFoal, "Best Foal is for walking foals");
      check(r.uniUni && !r.adultUni, "Best Unicorn is for unicorns");
      check(!r.wild, "only your own fluffies");
      check(r.coatOrdered, "a pricier coat never scores lower");
      check(r.coatRange[1] - r.coatRange[0] > 20, `coat scores spread out ${r.coatRange}`);
      check(r.sickDrop >= 10, `poor health costs points (${r.sickDrop})`);
      checkEqual(r.bad.length, 0, `scores out of range ${r.bad}`);
      check(/^"|^but/.test(r.comment), `judges' comment ${r.comment}`);
    },
  },
  {
    name: "shows: entering costs a fee, withdrawing refunds it",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const a = __mk();
        const b = __mk();
        const foal = __mk({ growth: 0.5 });
        __show("coat", 2);
        const fee = showState.next.fee;
        const out = { fee, prizes: showState.next.prizes };
        out.foal = enterShow(foal); // not eligible
        out.a = enterShow(a);
        out.moneyA = money;
        out.b = enterShow(b); // swaps the entry, refunding the first
        out.moneyB = money;
        out.entry = showState.entryId === b.id;
        withdrawFromShow();
        out.moneyW = money;
        out.none = showState.entryId === null;
        money = 5;
        out.broke = enterShow(a);
        out.supremePrizes = showPrizes(getShowTheme("supreme"), 3);
        out.level3Prizes = showPrizes(getShowTheme("coat"), 3);
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.prizes), JSON.stringify([300, 150, 75]), "level 2 prizes");
      checkEqual(r.fee, 45, "entry fee (15% of first prize)");
      checkEqual(r.foal, false, "a foal can't enter Best Coat");
      check(r.a && r.moneyA === 10000 - r.fee, `paid the fee ${r.moneyA}`);
      check(r.b && r.moneyB === 10000 - r.fee && r.entry, "switching entries refunds the first fee");
      checkEqual(r.moneyW, 10000, "withdrawing refunds");
      check(r.none, "no entry after withdrawing");
      checkEqual(r.broke, false, "can't enter without the fee");
      checkEqual(r.supremePrizes[0], r.level3Prizes[0] * 3, "supreme championship pays three times as much");
    },
  },
  {
    name: "shows: winning pays a prize, reputation and a ribbon; three wins make a champion",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk();
        const realScore = window.showScore;
        const priceBefore = f.genetics.calculatePrice();
        const out = { runs: [] };
        try {
          window.showScore = () => 100; // a sure winner
          for (let i = 0; i < 3; i++) {
            __show("coat", 1);
            const m0 = money;
            const rep0 = customerOrders.reputation;
            enterShow(f);
            const res = runShow();
            out.runs.push({ place: res.yourPlace, got: money - m0, fee: res.prize ? showState.last.prize : 0, rep: customerOrders.reputation - rep0, n: res.placings.length });
            if (i === 0) {
              out.popup = isShowResultsOpen();
              out.anyOpen = anyScreenOpen();
              out.afterWin = { price: f.genetics.calculatePrice(), row: describeRibbons(f), champ: isChampion(f), goal: goalsState.stats.showWins };
              closeShowResults();
              out.closed = !isShowResultsOpen();
            }
          }
          out.champ = { champ: isChampion(f), row: describeRibbons(f), price: f.genetics.calculatePrice(), mult: ribbonPriceMultiplier(f) };
          // Lots of ribbons: capped
          for (let i = 0; i < 10; i++) f.ribbons.push({ place: 1, show: "Best Coat", day: 1 });
          out.cap = ribbonPriceMultiplier(f);
          // A hopeless entry comes last and wins nothing
          window.showScore = () => 0;
          __show("coat", 1);
          const m0 = money;
          enterShow(f);
          const res = runShow();
          out.lose = { place: res.yourPlace, n: res.placings.length, lost: m0 - money, popup: isShowResultsOpen() };
          // Nobody entered: no pop-up, still news
          closeShowResults();
          __show("coat", 1);
          runShow();
          out.quiet = !isShowResultsOpen();
          // The entry was sold before the show: fee lost, a note
          __show("coat", 1);
          const g = __mk();
          enterShow(g);
          fluffies.splice(fluffies.indexOf(g), 1);
          out.gone = runShow().note;
        } finally {
          window.showScore = realScore;
        }
        out.priceBefore = priceBefore;
        updateGoals(0);
        goalsTicker.fireNext();
        updateGoals(0);
        out.goals = { win: isGoalDone("show_win"), champion: isGoalDone("champion") };
        return out;
      }, SETUP);
      for (const run of r.runs) {
        checkEqual(run.place, 1, "first place");
        checkEqual(run.got, 225 - 35, "won $225 (level 1), less the $35 fee");
        checkEqual(run.rep, 3, "reputation +3");
        check(run.n >= 6 && run.n <= 8, `5-7 rivals plus yours: ${run.n}`);
      }
      check(r.popup && r.anyOpen && r.closed, "results pop up and close");
      check(Math.abs(r.afterWin.price - r.priceBefore * 1.15) <= 1, `one win: +15% price (${r.priceBefore} -> ${r.afterWin.price})`); // (prices are whole dollars)
      checkEqual(r.afterWin.row, "1 win", "ribbons row");
      checkEqual(r.afterWin.champ, false, "not a champion after one win");
      checkEqual(r.afterWin.goal, 1, "counted for goals");
      checkEqual(r.champ.champ, true, "champion after three wins");
      checkEqual(r.champ.row, "Champion - 3 wins", "champion row");
      check(Math.abs(r.champ.mult - 1.45) < 1e-9, `three wins +45% ${r.champ.mult}`);
      check(Math.abs(r.cap - 1.6) < 1e-9, `at most +60% ${r.cap}`);
      check(r.lose.place === r.lose.n && r.lose.lost === 35 && r.lose.popup, `losing: last, fee lost, results shown ${JSON.stringify(r.lose)}`);
      check(r.quiet, "no pop-up when you didn't enter");
      check(/couldn't take part/.test(r.gone || ""), `entry gone: ${r.gone}`);
      check(r.goals.win && r.goals.champion, `goals ${JSON.stringify(r.goals)}`);
    },
  },
  {
    name: "shows: every 3 days at 2 PM, themes vary, the supreme championship needs reputation",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        showsTicker.fireNext();
        updateShows(0);
        out.first = { day: showState.next.day, when: describeShowTime(showState.next) };
        // After 10 AM the first show is tomorrow
        showState = freshShowState();
        timePlayed = 4 * HOUR_LENGTH; // noon
        showsTicker.fireNext();
        updateShows(0);
        out.late = showState.next.day;
        // It happens at 2 PM on its day
        timePlayed = DAY_LENGTH + 5.9 * HOUR_LENGTH; // day 2, 1:54 PM
        showsTicker.fireNext();
        updateShows(0);
        out.before = showState.last;
        timePlayed = DAY_LENGTH + 6 * HOUR_LENGTH + 1;
        showsTicker.fireNext();
        updateShows(0);
        out.ran = showState.last && showState.last.day;
        out.nextDay = showState.next.day;
        // Themes
        let repeats = 0;
        const seen = {};
        for (let lvl of [1, 3]) {
          for (let i = 0; i < 200; i++) {
            const prev = showState.next && showState.next.themeId;
            showState.last = { themeId: prev };
            customerOrders.reputation = lvl === 1 ? 0 : 1e4;
            scheduleNextShow(1);
            const id = showState.next.themeId;
            if (id === prev && id !== "supreme") repeats++;
            seen[`${lvl}:${id}`] = (seen[`${lvl}:${id}`] || 0) + 1;
          }
        }
        out.repeats = repeats;
        out.seen = seen;
        // Old save without showState
        readSavedGameState({});
        out.fresh = showState.next === null && Array.isArray(showState.history);
        return out;
      }, SETUP);
      checkEqual(r.first.day, 1, "first show today when it's early");
      checkEqual(r.first.when, "Day 1, 2:00 PM", "time");
      checkEqual(r.late, 2, "first show tomorrow when it's late");
      checkEqual(r.before, null, "not before 2 PM");
      checkEqual(r.ran, 2, "held on day 2");
      checkEqual(r.nextDay, 5, "next one 3 days later");
      checkEqual(r.repeats, 0, "never the same theme twice in a row");
      check(!r.seen["1:supreme"], "no supreme championship at level 1");
      check(r.seen["3:supreme"] > 20 && r.seen["3:supreme"] < 80, `sometimes at level 3+: ${r.seen["3:supreme"]}`);
      for (const t of ["coat", "patterns", "unicorn", "pegasus", "friendly", "foal", "oldies", "trained"])
        check(r.seen[`1:${t}`] > 0, `theme ${t} comes up`);
      check(r.fresh, "old saves start fresh");
    },
  },
  {
    name: "shows: saved with the game; the Shows tab and results pop-up work with the mouse",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const a = __mk();
        __mk();
        __show("friendly", 1);
        // Saved
        const data = {};
        writeSavedGameState(data);
        const json = JSON.parse(JSON.stringify(data));
        showState = freshShowState();
        readSavedGameState(json);
        const out = { saved: showState.next && showState.next.themeId };
        // The tab
        openOrdersScreen("web");
        const { s, ox, oy } = _osOrigin();
        const clickAt = (b) => {
          mouse.x = ox + (b.x + b.w / 2) * s;
          mouse.y = oy + (b.y + b.h / 2) * s;
          return clickScreens ? clickScreens() : handleOrdersScreenClick();
        };
        clickAt(_ordersTabs().find((t) => t.id === "shows"));
        out.tab = ordersTab;
        const draw = () => {
          try {
            drawOrdersScreen(ctx);
            return true;
          } catch (e) {
            return e.message;
          }
        };
        out.drew = draw();
        const L = showsLayout();
        out.rows = L.rows.length;
        const m0 = money;
        clickAt(L.rows[0].enter);
        out.entered = showState.entryId === L.rows[0].f.id && money === m0 - showState.next.fee;
        out.drew2 = draw();
        clickAt(showsLayout().withdraw);
        out.withdrawn = showState.entryId === null && money === m0;
        clickAt(showsLayout().rows[0].enter);
        ordersTab = "orders";
        closeOrdersScreen();
        // The results pop-up
        runShow();
        out.popup = isShowResultsOpen();
        try {
          drawScreens(ctx);
          out.drewPopup = true;
        } catch (e) {
          out.drewPopup = e.message;
        }
        const P = getShowResultsLayout();
        mouse.x = P.ok.x + 5;
        mouse.y = P.ok.y + 5;
        clickScreens(); // first click skips to the end of the show
        out.skipped = isShowResultsOpen() && isShowRingFinished();
        clickScreens();
        out.closed = !isShowResultsOpen();
        // Magnifying glass row
        a.ribbons = [{ place: 2, show: "Best Coat", day: 1 }];
        out.row = describeRibbons(a);
        return out;
      }, SETUP);
      checkEqual(r.saved, "friendly", "the next show is saved");
      checkEqual(r.tab, "shows", "tab");
      checkEqual(r.drew, true, "draws");
      checkEqual(r.rows, 2, "both fluffies listed");
      check(r.entered, "entered with a click");
      checkEqual(r.drew2, true, "draws with an entry");
      check(r.withdrawn, "withdrawn with a click");
      check(r.popup, "results pop up");
      checkEqual(r.drewPopup, true, "pop-up draws");
      check(r.skipped, "Skip jumps to the end");
      check(r.closed, "closed with the button");
      checkEqual(r.row, "1 second", "ribbons row");
    },
  },
  {
    name: "shows: brushing grooms a fluffy for a day: +5 with the judges",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk();
        f.health = 100;
        const t = getShowTheme("coat");
        __show("coat", 1);
        enterShow(f);
        const before = showScore(f, t);
        uiMessages.length = 0;
        onFluffyGroomed(f);
        const out = {
          before,
          after: showScore(f, t),
          comment: showComment(f, t),
          msg: uiMessages.some((m) => /groomed for the show/.test(m.text || m)),
        };
        uiMessages.length = 0;
        onFluffyGroomed(f); // again: no second message
        out.msg2 = uiMessages.some((m) => /groomed for the show/.test(m.text || m));
        timePlayed += DAY_LENGTH + 1;
        out.later = showScore(f, t);
        return out;
      }, SETUP);
      checkEqual(r.after - r.before, 5, `groomed +5 (${r.before} -> ${r.after})`);
      check(/beautifully groomed/.test(r.comment), r.comment);
      check(r.msg, "tells you your entry is groomed");
      check(!r.msg2, "only once");
      checkEqual(r.later, r.before, "wears off after a day");
    },
  },
  {
    name: "shows: the ring - rivals have looks, parade order, replay; the Show Hall on Shopping Street",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk();
        __show("unicorn", 2);
        const uni = __mk({ type: "unicorn" });
        f.type = "earthy";
        enterShow(uni);
        const res = runShow();
        const rivals = res.placings.filter((e) => !e.you);
        const out = {
          looks: rivals.every((e) => Array.isArray(e.genes)),
          unicorns: rivals.filter((e) => stockTypeOfGenes(e.genes) === "unicorn" || stockTypeOfGenes(e.genes) === "alicorn").length,
          n: rivals.length,
          orders: res.placings.map((e) => e.order).sort((a, b) => a - b).join(","),
          open: isShowResultsOpen(),
          finished: isShowRingFinished(),
        };
        // Drawing every stage
        out.draws = [];
        for (const at of [0, 2, 5.5, 7, 12, 40]) {
          _ringTime();
          _ring.start = _ringClock() - at;
          try {
            drawShowResults(ctx);
            out.draws.push(true);
          } catch (e) {
            out.draws.push(e.message);
          }
        }
        closeShowResults();
        out.canReplay = canReplayShow();
        openOrdersScreen("web");
        ordersTab = "shows";
        const { s, ox, oy } = _osOrigin();
        const b = showsLayout().replay;
        mouse.x = ox + (b.x + b.w / 2) * s;
        mouse.y = oy + (b.y + b.h / 2) * s;
        clickScreens();
        out.replaying = isShowResultsOpen() && !isShowRingFinished() && !ordersScreenMode;
        closeShowResults();
        // The Show Hall
        changeScene("SHOP_STREET");
        const H = getShowHallRect();
        mouse.x = H.x + H.w / 2;
        mouse.y = H.y + H.h / 2;
        try {
          drawShowHall(ctx);
          out.hallDrew = true;
        } catch (e) {
          out.hallDrew = e.message;
        }
        ordersTab = "orders";
        out.hallClick = showHallClick();
        out.hallTab = ordersTab;
        out.hallMode = ordersScreenMode;
        closeOrdersScreen();
        // Overlaps nothing else on the street
        const rects = [getVetClinicRect(), getBountyBoardRect()];
        out.overlap = rects.some((o) => !(o.x + o.w < H.x || H.x + H.w < o.x || o.y + o.h < H.y - 44 || H.y + H.h < o.y - 34));
        // The way back to the garden is at the bottom now
        const back = getScenePortals("SHOP_STREET").find((p) => p.target === "OUTDOORS");
        out.back = back && { type: back.type, bottom: back.y > height / 2 };
        out.noUp = !getScenePortals("SHOP_STREET").some((p) => p.type === "arrow_up");
        changeScene("INDOORS");
        mouse.x = H.x + H.w / 2;
        mouse.y = H.y + H.h / 2;
        out.notHome = showHallClick();
        return out;
      }, SETUP);
      check(r.looks, "every rival has looks");
      check(r.unicorns >= r.n - 1, `rivals in Best Unicorn are unicorns: ${r.unicorns}/${r.n}`);
      checkEqual(r.orders, Array.from({ length: r.n + 1 }, (_, i) => i).join(","), "everyone has a place in the parade");
      check(r.open && !r.finished, "the show plays out");
      checkEqual(JSON.stringify(r.draws), JSON.stringify([true, true, true, true, true, true]), "draws at every stage");
      check(r.canReplay && r.replaying, "watch it again from the Shows tab");
      checkEqual(r.hallDrew, true, "the hall draws");
      check(r.hallClick && r.hallTab === "shows" && r.hallMode === "board", "clicking the hall opens the Shows tab");
      checkEqual(r.overlap, false, "the hall doesn't overlap the vet or the board");
      checkEqual(JSON.stringify(r.back), JSON.stringify({ type: "arrow_down", bottom: true }), "back to the garden at the bottom");
      check(r.noUp, "no arrow at the top any more");
      checkEqual(r.notHome, false, "the hall is only on Shopping Street");
    },
  },
];
