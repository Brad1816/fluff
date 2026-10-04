// The formula mummah and the bite muzzle
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  for (const s of ["INDOORS", "BACKYARD"]) __clearScene(s);
  __seedRandom(9090);
  closeAllChoices();
  currentScene = "INDOORS";
  timePlayed = 6 * DAY_LENGTH + 10 * HOUR_LENGTH;
  window.__mk = (x, opts = {}) => {
    const h = new Horse(opts.growth ?? 1, opts.mum ?? null, "INDOORS", "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.makeType("earthy");
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    h.adopted = true;
    h.x = x;
    h.y = 520;
    h.hunger = 1;
    h.health = 100;
    h.happiness = 0.7;
    h.renderer.ensureTintedImages();
    fluffies.push(h);
    return h;
  };
}`;

module.exports = [
  {
    name: "round9: the formula mummah - foals drink from it (the Feed-Bot fills it like a feeder), it keeps them warm, and it raises them kind to every colour; saved; in the shop and the mill kit",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        worldSettings.colorism = true;
        const m = new ArtificialMummah("INDOORS");
        m.x = 600;
        m.y = 520;
        objects.push(m);
        const out = { type: getItemType(m) && getItemType(m).sellType, fill: m.fill(40, "formula"), noKibble: !m.fill(5, "kibble") };
        const foal = __mk(620, { growth: 0.2 });
        foal.hunger = 0.2;
        foal.coloristDegree = 0.9;
        // It drinks
        for (let i = 0; i < 300 && foal.hunger < 0.9; i++) {
          timePlayed += 0.1;
          foal.update(0.1);
        }
        out.drank = foal.hunger >= 0.9;
        out.fedAt = typeof foal.mummahFedAt === "number";
        out.tank = m.food;
        // It's raising it: colour hate fades
        out.influence = upbringingInfluences(foal).some((i) => i.who === "machine");
        for (let s = 0; s < 200; s++) applyUpbringing(foal, 30);
        out.colorist = foal.coloristDegree;
        out.row = describeMummahRaised(foal);
        out.upRow = describeUpbringing(foal);
        // Warm
        foal.x = 600;
        foal.y = 528;
        out.warm = EXTRA_WARMTH.reduce((k, fn) => k * (fn(foal) || 1), 1);
        // Saved and loaded
        const data = JSON.parse(JSON.stringify(m.serialize()));
        const copy = SAVED_CLASSES[data.classType](data);
        copy.deserialize(data);
        out.saved = copy instanceof ArtificialMummah && copy.food === m.food && copy.maxFood === MUMMAH_TANK;
        out.shop = SPAWN_ACTIONS.some((a) => a.isItem === "mummah_machine");
        out.kit = ROOM_KITS.find((k) => k.key === "mill").floor.includes("Formula mummah");
        out.feedbot = typeof FeedBot !== "undefined";
        return out;
      }, SETUP);
      checkEqual(r.type, "mummah_machine", "its own item type");
      check(r.fill && r.noKibble, "takes formula, not kibble");
      check(r.drank && r.fedAt && r.tank < 40, "a foal drinks from it");
      check(r.influence && r.colorist < 0.2, `it raises the foal kind to colours (${r.colorist})`);
      check(r.row && r.upRow && /formula mummah/.test(r.upRow[0]), `shown: ${r.row} / ${r.upRow}`);
      check(r.warm < 1, "warm to lie by");
      check(r.saved, "saved and loaded");
      check(r.shop && r.kit, "in the shop and the mill fit-out");
    },
  },
  {
    name: "round9: the bite muzzle - no bites (a strapped-down or legless mare can't hurt a foal at all), it still eats and talks; shown; in the shop",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        out.shop = SPAWN_ACTIONS.some((a) => a.isItem === "accessory" && a.accessoryId === "muzzle");
        const mare = __mk(500);
        const foal = __mk(540, { growth: 0.3 });
        mare.accessories = { mouth: { id: "muzzle" } };
        mare.limbs.legs = mare.limbs.legs.map(() => false);
        mare.updateCrawling();
        const hp = foal.health;
        for (let i = 0; i < 10; i++) {
          mare.attackCooldown = 0;
          mare.performAttack(foal, "COLOR");
        }
        out.noHurt = foal.health === hp;
        out.canTalk = mare.canTalk();
        // A free mare with legs: kicks and stomps, never bites
        const m2 = __mk(700);
        m2.accessories = { mouth: { id: "muzzle" } };
        const seen = new Set();
        for (let i = 0; i < 30; i++) {
          m2.attackCooldown = 0;
          m2.performAttack(__mk(720, { growth: 0.5 }), "BULLY");
          seen.add(m2.currentStateKey);
        }
        out.bites = seen.has("FLUFFY_BITE");
        out.cond = getInspectionConditions(mare).bad.some((x) => /muzzle/.test(x));
        return out;
      }, SETUP);
      check(r.shop, "in the shop");
      check(r.noHurt, "a legless, muzzled mare can't hurt a foal");
      check(r.canTalk, "it can still talk");
      check(!r.bites, "a muzzled fluffy never bites");
      check(r.cond, "shown in the magnifying glass");
    },
  },
];
