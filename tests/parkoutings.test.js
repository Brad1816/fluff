// Park outings (ParkOutings.js)
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene();
  __clearScene("PARK");
  __clearScene("BACKYARD");
  outings = freshOutings();
  if (typeof _raid !== "undefined") _raid = null;
  herdState = freshHerdState();
  _herdChanged();
  window.__po = (scene = "INDOORS", x = 400, gender = "female", growth = 1) => {
    const f = new Horse(growth, null, scene, "earthy", null, 0.6, 0.6, gender);
    f.adopted = true;
    f.x = x;
    f.y = 450;
    f.hunger = 1;
    f.happiness = 0.5;
    fluffies.push(f);
    return f;
  };
}`;

module.exports = [
  {
    name: "park outings: take the room to the park, they play and stay near, Home time brings them back with a memory",
    run: async (page) => {
      await page.waitForFunction(() => transitionPhase === "OFF", null, { timeout: 15000 });
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        changeScene("INDOORS");
        const a = __po("INDOORS", 300);
        const b = __po("INDOORS", 500, "male");
        const baby = __po("INDOORS", 600, "female", 0.05); // can't walk: stays
        const other = __po("INDOORS", 700);
        other.scene = "BACKYARD"; // another room: stays
        out.actions = outingActions(a).map((x) => [x.name, x.sub]);
        a.boredom = 0.8;
        const h0 = a.happiness;
        out.started = startOuting("INDOORS");
        out.scene = currentScene;
        out.where = [a.scene, b.scene, baby.scene, other.scene];
        out.again = outingActions(a).length;
        // A few game minutes in the park
        for (let i = 0; i < 180; i++) updateParkOutings(1);
        timePlayed += 180;
        out.happier = a.happiness > h0;
        out.lessBored = a.boredom < 0.8;
        out.seenPark = a.seenPark === true;
        // Strays too far: comes back
        b.x = camera.x + width / 2 + 2000;
        b.initBehavior("IDLE");
        b._outingSlipChecked = true;
        updateParkOutings(1);
        out.comesBack = ["MOVING", "RUNNING"].includes(b.currentStateKey) && Math.abs(b.targetX - (camera.x + width / 2)) < 400;
        // The banner, and Home time
        const B = getOutingBanner();
        out.banner = !!B;
        mouse.x = B.home.x + 5;
        mouse.y = B.home.y + 5;
        const mems0 = sharedMemories.list.length;
        out.clicked = outingBannerClick();
        out.home = [currentScene, a.scene, b.scene, onOuting()];
        out.memory = sharedMemories.list.length > mems0;
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.actions), JSON.stringify([["Park outing", "all 2 in here"]]), "right-click: everyone who can walk in this room");
      check(r.started, "started");
      checkEqual(r.scene, "PARK", "you went too");
      checkEqual(JSON.stringify(r.where), JSON.stringify(["PARK", "PARK", "INDOORS", "BACKYARD"]), "who came");
      checkEqual(r.again, 0, "one outing at a time");
      check(r.happier && r.lessBored && r.seenPark, `played: ${JSON.stringify(r)}`);
      check(r.comesBack, "a stray comes back");
      check(r.banner && r.clicked, "Home time");
      checkEqual(JSON.stringify(r.home), JSON.stringify(["INDOORS", "INDOORS", "INDOORS", false]), "everyone home");
      check(r.memory, "a shared memory of the day out");
    },
  },
  {
    name: "park outings: leaving the park ends it; a Rebel may slip away; old friends meet again; a trusting former pet comes home",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        changeScene("INDOORS");
        const a = __po("INDOORS", 300);
        const rebel = __po("INDOORS", 400, "male");
        rebel.title = "Rebel";
        startOuting("INDOORS");
        // The Rebel wanders off and slips away (forced)
        const realRandom = Math.random;
        Math.random = () => 0;
        rebel.x = camera.x + width / 2 + 2000;
        rebel.initBehavior("IDLE");
        updateParkOutings(1);
        Math.random = realRandom;
        out.slipped = !rebel.adopted && rebel.formerPet && rebel.formerPet.how === "ran away";
        // An old friend
        const old = __po("PARK", a.x + 100, "male");
        old.y = a.y;
        old.adopted = false;
        old.formerPet = { how: "ran away", day: 1, name: "Rowan" };
        changeOpinion(a, old, 0.8);
        const h0 = a.happiness;
        updateParkOutings(1);
        out.reunion = a.happiness > h0 && old.formerPet.reunionDay === getDayNumber();
        // Bring it home: needs trust
        old.playerTrust = 0.1;
        out.refused = bringFormerPetHome(old);
        old.playerTrust = 0.8;
        old.playerFear = 0;
        out.brought = bringFormerPetHome(old);
        out.adopted = old.adopted && !old.formerPet;
        // Walk out of the park: everyone comes home
        changeScene("SHELTER_ALLEY" in SCENES ? "SHELTER_ALLEY" : "INDOORS");
        updateParkOutings(1);
        out.after = [a.scene, old.scene, onOuting(), rebel.scene];
        changeScene("INDOORS");
        return out;
      }, SETUP);
      check(r.slipped, "the Rebel slipped away");
      check(r.reunion, "old friends met again");
      checkEqual(r.refused, false, "a former pet that doesn't trust you won't come");
      check(r.brought && r.adopted, "a trusting one comes home");
      checkEqual(JSON.stringify(r.after), JSON.stringify(["INDOORS", "INDOORS", false, "PARK"]), "walked home when you left (the runaway stays)");
    },
  },
  {
    name: "park outings: herds that heard you're kind come to say hello; herds that heard you hurt fluffies keep away",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        changeScene("PARK");
        camera.x = 0;
        camera.y = 0;
        const out = {};
        const mk = (x) => {
          const f = __po("PARK", x);
          f.adopted = false;
          f.y = 400;
          return f;
        };
        const kind = [mk(300), mk(360), mk(420)];
        herdState.list.push({ id: 51, name: "Kind", memberIds: kind.map((f) => f.id), leaderId: kind[0].id, colorIndex: 1 });
        for (const f of kind) f.playerTrust = 0.9;
        const scared = [mk(width / 2 + 40), mk(width / 2 + 80), mk(width / 2 - 60)];
        herdState.list.push({ id: 52, name: "Scared", memberIds: scared.map((f) => f.id), leaderId: scared[0].id, colorIndex: 2 });
        for (const f of scared) {
          f.playerFear = 0.9;
          f.playerTrust = 0;
          f.y = height / 2 + 60;
        }
        _herdChanged();
        out.lore = [describeHerdLore(herdState.list[0]), describeHerdLore(herdState.list[1])];
        for (const f of [...kind, ...scared]) f.initBehavior("IDLE");
        const t0 = kind.map((f) => f.playerTrust);
        updateParkOutings(1);
        out.greeter = kind.some((f) => ["MOVING", "RUNNING"].includes(f.currentStateKey) && Math.abs(f.targetX - width / 2) < 200);
        out.trust = kind.some((f, i) => f.playerTrust > t0[i]);
        out.fled = scared.filter((f) => f.currentStateKey === "RUNNING").length;
        changeScene("INDOORS");
        return out;
      }, SETUP);
      checkEqual(JSON.stringify(r.lore), JSON.stringify(["they've heard you're kind", "they've heard you hurt fluffies"]), "lore");
      check(r.greeter, "someone comes over to say hello");
      check(r.trust, "and trusts you a little more");
      check(r.fled >= 2, `the wary herd keeps away: ${r.fled}`);
    },
  },
  {
    name: "park outings: a Rebel's herd raids the backyard at night, fights, may take a miserable one; you scatter them",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        changeScene("INDOORS");
        const out = {};
        const mkWild = (x) => {
          const f = __po("PARK", x, "male");
          f.adopted = false;
          return f;
        };
        const boss = mkWild(500);
        boss.title = "Rebel";
        boss.formerPet = { how: "ran away", day: 1, name: "Rowan" };
        const gang = [boss, mkWild(560), mkWild(620)];
        herdState.list.push({ id: 61, name: "Raid", memberIds: gang.map((f) => f.id), leaderId: boss.id, colorIndex: 3 });
        _herdChanged();
        out.herd = raidingHerd() && raidingHerd().leader === boss;
        // Yours in the backyard
        const sad = __po("BACKYARD", 400);
        sad.happiness = 0.1;
        const fine = __po("BACKYARD", 600, "male");
        fine.happiness = 0.9;
        const raid = startRaid(true);
        out.raid = !!raid && gang.every((f) => f.scene === "BACKYARD");
        _todayCache = null;
        out.today = todayItems().some((i) => /Raiders/.test(i.text));
        for (let i = 0; i < 20; i++) updateParkOutings(1);
        // Morning: they go home; the miserable one may go with them
        const realRandom = Math.random;
        Math.random = () => 0;
        _raid.until = 0;
        updateParkOutings(1);
        Math.random = realRandom;
        out.back = gang.every((f) => f.scene === "PARK" && !f.raiding);
        out.sadLeft = !sad.adopted;
        out.fineStayed = fine.adopted && fine.scene === "BACKYARD";
        // Another raid: you come out, they scatter
        startRaid(true);
        changeScene("BACKYARD");
        updateParkOutings(1);
        timePlayed += 6;
        updateParkOutings(1);
        out.scattered = !isRaiding() && gang.every((f) => f.scene === "PARK");
        changeScene("INDOORS");
        // No Rebel leader, no raids
        boss.title = null;
        boss.formerPet = null;
        out.noHerd = raidingHerd();
        return out;
      }, SETUP);
      check(r.herd, "the Rebel's herd");
      check(r.raid, "they got into the backyard");
      check(r.today, "Today says so");
      check(r.back, "back to the park by morning");
      check(r.sadLeft, "the miserable one went with them");
      check(r.fineStayed, "the happy one stayed");
      check(r.scattered, "you scattered them");
      checkEqual(r.noHerd, null, "no raiding herd without a Rebel or bad lore");
    },
  },
];
