// The Fluffy Shelter (Shelter.js): kennels of fluffies to adopt from their
// plaques alone, time's-up days, and boarding your own (a daily bill).
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "shelter: cages fill each morning with mostly poopie or drab, wary fluffies; the odd gem; plaques say only what the staff write",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __seedRandom(21);
        const out = {};
        shelter = freshShelter();
        shelterNewDay();
        out.first = shelter.residents.length;
        shelterNewDay();
        out.second = shelter.residents.length;
        for (let i = 0; i < 5; i++) shelterNewDay();
        out.cap = shelter.residents.length <= SHELTER_CAGES;
        // A big sample
        const many = [];
        for (let i = 0; i < 200; i++) many.push(makeShelterResident());
        const coat = (m) => _shCoatP(m.data.genes);
        out.poorCoat = many.filter((m) => coat(m) < COAT_DRAB_LINE).length / many.length;
        out.niceCoat = many.filter((m) => coat(m) >= COAT_NICE_LINE).length / many.length;
        out.trust = many.reduce((a, m) => a + m.data.playerTrust, 0) / many.length;
        out.smarties = many.filter((m) => (m.data.personalities || []).includes("smarty")).length;
        out.grumpy = many.filter((m) => traitValue(m.data.genes, "temper") > 0.3).length / many.length;
        out.earthy = many.filter((m) => m.type === "earthy").length / many.length;
        out.notes = many.every((m) => m.notes.length >= 1 && m.notes.length <= 2);
        const lines = shelterPlaqueLines(many[0]);
        out.plaque = [lines.what, lines.origin, ...lines.notes, lines.timesUp];
        // Residents aren't out in the world (no magnifying glass on them)
        out.notInWorld = shelter.residents.every((s) => !fluffies.some((f) => f.id === s.id));
        return out;
      });
      checkEqual(r.first, 10, "the first morning fills 10 cages");
      check(r.second > r.first && r.second <= r.first + 2, `a morning brings 1-2 more (${r.first} -> ${r.second})`);
      check(r.cap, "never more than 6");
      check(r.poorCoat > 0.6, `mostly poopie or drab coats (${r.poorCoat})`);
      check(r.niceCoat > 0.04 && r.niceCoat < 0.3, `now and then a bright coat (${r.niceCoat})`);
      check(r.trust < 0.35, `wary of people (${r.trust})`);
      check(r.smarties >= 1 && r.smarties < 40, `the odd Smarty (${r.smarties}/200)`);
      check(r.grumpy > 0.5, `mostly grumpy (${r.grumpy})`);
      check(r.earthy > 0.6, `mostly earthies (${r.earthy})`);
      check(r.notes, "one or two staff notes each");
      check(r.plaque.length >= 4 && /old/.test(r.plaque[0]) && /Time's up/.test(r.plaque[r.plaque.length - 1]), `plaque ${r.plaque}`);
      check(r.notInWorld, "they're only on plaques until adopted");
    },
  },
  {
    name: "shelter: time's up - gone the next morning (in the day report); half price on the last day",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __seedRandom(22);
        shelter = freshShelter();
        shelter.stocked = true;
        dayStats = freshDayStats();
        const today = getDayNumber();
        const a = makeShelterResident();
        a.timesUpDay = today - 1;
        const b = makeShelterResident();
        b.timesUpDay = today;
        const c = makeShelterResident();
        c.timesUpDay = today + 2;
        shelter.residents = [a, b, c];
        const fees = [shelterFee(b), shelterFee(c)];
        shelterNewDay();
        return {
          left: shelter.residents.map((x) => x.id),
          ids: [a.id, b.id, c.id],
          news: dayStats.news.map((n) => n.text || n),
          fees,
          lost: shelter.lost,
          nameA: a.name,
        };
      });
      check(!r.left.includes(r.ids[0]), "past its day: gone");
      check(r.left.includes(r.ids[1]) && r.left.includes(r.ids[2]), "last day and later: still there");
      check(r.news.some((n) => /Time ran out for (one fluffy|\d+ fluffies) at the shelter/.test(n)), `news (counted, not named: it wasn't yours) ${r.news}`);
      checkEqual(JSON.stringify(r.fees), JSON.stringify([30, 60]), "half price on its last day");
      checkEqual(r.lost, 1, "counted");
    },
  },
  {
    name: "shelter: click a kennel to read its plaque and adopt; it comes out by the desk as yours, named by the shelter, in its story",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate(() => {
        __clearScene("DAY_CARE");
        __seedRandom(23);
        if (!objects.some((o) => o instanceof ShelterKennels)) objects.push(new ShelterKennels("DAY_CARE"));
        if (!objects.some((o) => o instanceof DayCareDesk)) objects.push(new DayCareDesk("DAY_CARE"));
        shelter = freshShelter();
        shelter.stocked = true;
        shelter.day = reportDayIndex();
        let r;
        do r = makeShelterResident();
        while (r.origin === "surrendered");
        shelter.residents = [r];
        storyBook = freshStoryBook();
        _storyIndex = null;
        money = 20;
        changeScene("DAY_CARE");
      });
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const cage = await page.evaluate(() => shelterCageRects()[0]);
      await page.mouse.click(cage.x + cage.w / 2, cage.y + cage.h / 2);
      const open = await page.evaluate(() => isShelterCardOpen());
      let L = await page.evaluate(() => shelterCardLayout());
      // Too poor
      await page.mouse.click(L.adopt.x + L.adopt.w / 2, L.adopt.y + L.adopt.h / 2);
      const poor = await page.evaluate(() => ({ still: shelter.residents.length, open: isShelterCardOpen() }));
      await page.evaluate(() => (money = 500));
      await page.mouse.click(L.adopt.x + L.adopt.w / 2, L.adopt.y + L.adopt.h / 2);
      const r = await page.evaluate(() => {
        const f = fluffies[fluffies.length - 1];
        syncFamilyRecords();
        return {
          money,
          left: shelter.residents.length,
          open: isShelterCardOpen(),
          adopted: f.adopted,
          scene: f.scene,
          name: fluffyNames[f.id],
          by: namedBy(f),
          story: storyOf(f).map((e) => storyEventText(e)),
          adoptedCount: shelter.adopted,
          rels: !!relationships[f.id],
        };
      });
      check(open, "clicking a kennel opens its plaque");
      checkEqual(poor.still, 1, "can't adopt without the fee");
      checkEqual(r.money, 500 - 60, "paid the fee");
      checkEqual(r.left, 0, "the kennel is empty");
      checkEqual(r.open, false, "card closes");
      check(r.adopted && r.scene === "DAY_CARE", "yours, by the desk");
      check(!!r.name && r.by === "the shelter", `named by the shelter (${r.name}, ${r.by})`);
      check(r.story.some((t) => /came to you from the shelter/.test(t)), `story ${r.story}`);
      checkEqual(r.adoptedCount, 1, "counted");
      check(r.rels, "it has a relationships entry like any fluffy");
    },
  },
  {
    name: "shelter: boarding your own is a daily bill; the room draws with its kennels, and the front with its signs",
    run: async (page) => {
      const r = await page.evaluate(() => {
        const saved = dayCareFluffies;
        dayCareFluffies = [{ id: 1 }, { id: 2 }];
        const bill = dailyBills();
        const text = describeBills({ ...bill, paid: bill.total, owed: 0 });
        dayCareFluffies = saved;
        let err = null;
        try {
          const k = new ShelterKennels("DAY_CARE");
          k.draw(ctx);
          if (shelter.residents[0]) {
            shelterCardIndex = 0;
            drawShelterCard(ctx);
            closeShelterCard();
          }
        } catch (e) {
          err = String(e);
        }
        // The front of the building in Shelter Alley
        const was = currentScene;
        currentScene = "ALLEY_DAY_CARE";
        const r0 = makeShelterResident();
        r0.timesUpDay = getDayNumber();
        const keep = shelter.residents;
        shelter.residents = [r0];
        let frontErr = null;
        try {
          drawShelterFront(ctx);
        } catch (e) {
          frontErr = String(e);
        }
        const lastDay = shelterLastDayNames();
        shelter.residents = keep;
        currentScene = was;
        return { boarding: bill.boarding, text, err, frontErr, lastDay, name0: r0.name };
      });
      checkEqual(r.boarding, 60, "two boarders a day");
      check(/boarding \$60/.test(r.text), r.text);
      checkEqual(r.err, null, "draws");
      checkEqual(r.frontErr, null, "the shelter front draws");
      checkEqual(JSON.stringify(r.lastDay), JSON.stringify([r.name0]), "the notice board lists who's on their last day");
    },
  },
  {
    name: "shelter: give one of yours up - it goes in a kennel, its story says so, and a last chapter if time runs out",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      await page.evaluate(() => {
        __clearScene("DAY_CARE");
        __seedRandom(24);
        shelter = freshShelter();
        shelter.stocked = true;
        shelter.day = reportDayIndex();
        storyBook = freshStoryBook();
        _storyIndex = null;
        const f = new Horse(1, null, "DAY_CARE", "earthy", null, 0.5, 0.5, "female");
        f.adopted = true;
        f.playerTrust = 0.8;
        f.x = 640;
        f.y = 600;
        f.brain.think = () => {};
        fluffies.push(f);
        fluffyNames[f.id] = "Hazel";
        syncFamilyRecords();
        window.__f = f;
        changeScene("DAY_CARE");
        dayCareModalOpen = true;
      });
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const gb = await page.evaluate(() => {
        const modalW = 760, modalH = 540;
        const modalX = Math.floor(width / 2 - modalW / 2);
        const modalY = Math.floor(height / 2 - modalH / 2);
        return dayCareGiveUpRect(modalX + 25, 340, modalY + 84 + 40);
      });
      await page.mouse.click(gb.x + gb.w / 2, gb.y + gb.h / 2);
      const r = await page.evaluate(() => {
        const f = __f;
        const res = shelter.residents.find((x) => x.id === f.id);
        const out = {
          gone: !fluffies.includes(f),
          res: res && { byYou: res.byYou, name: res.name, origin: res.origin },
          missing: res && res.data.missingOwner,
        };
        out.story = lifeStoryChapters(f).flatMap((c) => c.lines);
        // Nobody adopts her
        res.timesUpDay = getDayNumber() - 1;
        shelterNewDay();
        out.after = lifeStoryChapters(f).flatMap((c) => c.lines);
        out.rec = getFamilyRecord(f.id) && getFamilyRecord(f.id).status;
        return out;
      });
      check(r.gone, "no longer in your house");
      check(r.res && r.res.byYou && r.res.name === "Hazel" && r.res.origin === "surrendered", `in a kennel ${JSON.stringify(r.res)}`);
      check(r.missing >= 0.9, `misses you, who she loved (${r.missing})`);
      check(r.story.some((l) => /You gave her up to the shelter on day \d+\./.test(l)), `story ${r.story}`);
      check(r.after.some((l) => /was put down at the shelter when nobody adopted her/.test(l)), `last chapter ${r.after}`);
      checkEqual(r.rec, "dead", "family book");
    },
  },
  {
    name: "shelter: boarders get lonely, keep their mood when picked up, can die of old age there, and a long stay goes in the story",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("DAY_CARE");
        __seedRandom(25);
        storyBook = freshStoryBook();
        _storyIndex = null;
        const f = new Horse(1, null, "DAY_CARE", "earthy", null, 0.5, 0.5, "male");
        f.adopted = true;
        f.happiness = 0.9;
        const data = f.serialize();
        data.type = f.type;
        data.happiness = 0.9;
        data.boardedAt = timePlayed;
        data.name = "Bram";
        const saved = dayCareFluffies;
        dayCareFluffies = [data];
        for (let i = 0; i < 20; i++) updateBoarders(DAY_LENGTH / 10);
        const out = { mood: +data.happiness.toFixed(2) };
        // Picked up two days later
        timePlayed += 2 * DAY_LENGTH;
        const h = Horse.deserialize(data);
        onBoarderPickedUp(h, data);
        out.story = storyOf(h).filter((e) => e.k === "boarding").map((e) => e.x);
        // A very old one
        const old = { ...data, id: 999001, name: "Gramps", age: (MAX_AGE_DAYS + 1) * DAY_LENGTH, growth: 1 };
        dayCareFluffies = [old];
        dayStats = freshDayStats();
        updateBoarders(1);
        out.oldGone = dayCareFluffies.length === 0;
        out.news = dayStats.news.map((n) => n.text || n);
        dayCareFluffies = saved;
        return out;
      });
      checkEqual(r.mood, 0.8, "a little lonelier after two days");
      check(r.story.length === 1 && /He spent 2 months boarded at the shelter\./.test(r.story[0]), `story ${r.story}`);
      check(r.oldGone && r.news.some((n) => /Gramps died of old age while boarded/.test(n)), `old age ${r.news}`);
    },
  },
];
