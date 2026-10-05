// "Today": what needs you (Today.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "today: gathers what's urgent, the chances and the house into one list; the button counts them; a row takes you to the fluffy",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __seedRandom(161);
        storyBook = freshStoryBook();
        _storyIndex = null;
        roomClimate = freshRoomClimate();
        pressure = freshPressure();
        inspector = freshInspector();
        billsOwed = 0;
        const out = {};
        const mk = (x, n) => {
          const h = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, "female");
          h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
          h.adopted = true;
          h.x = x;
          h.y = 520;
          h.hunger = 1;
          h.happiness = 0.6;
          h.brain.think = () => {};
          h.wishCooldownUntil = 1e12;
          fluffies.push(h);
          fluffyNames[h.id] = n;
          return h;
        };
        out.empty = todayItems().length;
        // (a party line for several at once is one line)
        const a = mk(300, "Wren");
        a.hunger = 0.1;
        const b = mk(500, "Rowan");
        b.wish = { id: "toy", since: timePlayed, ache: 0 };
        const c = mk(700, "Pip");
        c.title = "Broken";
        c.titleState = { healing: 0.9, lovedDays: 0, defends: 0, respect: 0, maxStrain: 10, lastHarm: -1e9, day: getDayNumber() };
        billsOwed = 120;
        pressure.debtDays = 2;
        inspector.warned = getDayNumber();
        for (let i = 0; i < 12; i++) recordStory("attacked", a);
        _todayCache = null;
        const items = todayItems();
        out.items = items.map((i) => [i.level, i.text]);
        out.counts = todayCounts();
        // The panel and the button draw; clicking a row goes to the fluffy
        openToday();
        let err = null;
        try {
          drawToday(ctx);
          drawTodayButton(ctx, 100);
        } catch (e) {
          err = String(e && e.stack);
        }
        out.err = err;
        const L = getTodayLayout();
        const row = L.rows.find((x) => x.item.f === a);
        mouse.x = row.x + 20;
        mouse.y = row.y + 10;
        handleTodayClick();
        out.went = [isTodayOpen(), inspectedFluffy === a];
        inspectedFluffy = null;
        return out;
      });
      checkEqual(r.empty, 0, "nothing needs you in an empty house");
      const text = r.items.map((i) => i.join(": ")).join(" | ");
      check(/urgent: You owe \$120 \(2 days in debt\): the power goes off in 1 day\./.test(text), `debt: ${text}`);
      check(/urgent: The welfare inspector is coming tomorrow/.test(text), `inspector: ${text}`);
      check(/urgent: Wren is starving\./.test(text), `starving: ${text}`);
      check(/info: Rowan has a wish \(Mind tab\)\./.test(text), `wish (a quiet one: one line): ${text}`);
      check(/chance: Pip - Healing: Broken → Survivor \(nearly there\)\./.test(text), `healing: ${text}`);
      check(/info: Living room feels tense: fights/.test(text), `room: ${text}`);
      checkEqual(r.items[0][0], "urgent", "urgent first");
      check(r.counts.urgent >= 3 && r.counts.chance >= 1, `counts ${JSON.stringify(r.counts)}`);
      checkEqual(r.err, null, "draws");
      checkEqual(JSON.stringify(r.went), JSON.stringify([false, true]), "a row goes to the fluffy");
    },
  },
];
