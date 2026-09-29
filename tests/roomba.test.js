// The Fluff-Bot robot vacuum (Roomba.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "roomba: bought and delivered; cleans mess in its own room, goes back to its dock; right-click switches it off; saved",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        __clearScene("INDOORSL1");
        puddles.length = 0;
        const action = SPAWN_ACTIONS.find((a) => a.name === "Fluff-Bot");
        const out = { aisle: getStoreAisleForAction(action).name, kind: shopDeliveryKind(action), cost: action.cost };
        money = 1000;
        buyFromStore(action, 500, 500);
        const bot = objects.find((o) => o instanceof Roomba);
        out.delivered = !!bot && bot.scene === "INDOORS";
        bot.setPosition(200, 650);
        // Mess here and in another room
        addPointToPuddle("INDOORS", 900, 520, "#5c4033", 0.5, 0.5, 0.02);
        addPointToPuddle("INDOORS", 600, 400, "#f1c40f", 0.3, 0.3, 0.02);
        addPointToPuddle("INDOORSL1", 500, 500, "#5c4033", 0.5, 0.5, 0.02);
        const size = (scene) => puddles.filter((p) => p.scene === scene).reduce((a, p) => a + p.points.reduce((b, x) => b + x.scale, 0), 0);
        const states = new Set();
        for (let i = 0; i < 40 * 20; i++) {
          bot.update(1 / 20);
          states.add(bot.state);
          if (bot.state === "docked" && i > 20) break;
        }
        out.here = +size("INDOORS").toFixed(3);
        out.other = +size("INDOORSL1").toFixed(3);
        out.states = [...states].sort();
        out.home = Math.round(Math.hypot(bot.x - 200, bot.y - 650));
        // Off: doesn't move
        const entry = getItemType(bot);
        entry.onRightClick(bot);
        addPointToPuddle("INDOORS", 900, 520, "#5c4033", 0.5, 0.5, 0.02);
        const x0 = bot.x;
        for (let i = 0; i < 40; i++) bot.update(1 / 20);
        out.off = [bot.on, bot.x === x0];
        // Saved
        const data = JSON.parse(JSON.stringify(bot.serialize()));
        const before = objects.length;
        loadObject(data);
        const copy = objects[objects.length - 1];
        out.saved = { cls: copy.constructor.name, on: copy.on, home: [copy.homeX, copy.homeY], added: objects.length === before + 1 };
        objects.pop();
        out.sell = getItemSellValue(bot, entry);
        puddles.length = 0;
        return out;
      });
      checkEqual(r.aisle, "Home & Play", "on the Home & Play shelf");
      checkEqual(r.kind, "deliver", "delivered");
      checkEqual(r.cost, 250, "price");
      check(r.delivered, "it's in the living room");
      checkEqual(r.here, 0, "cleaned up all the mess in its room");
      check(r.other > 0.4, `left the other room alone ${r.other}`);
      checkEqual(JSON.stringify(r.states), JSON.stringify(["cleaning", "docked", "homing"]), "cleaned, drove home, docked");
      check(r.home < 10, `back at its dock (${r.home}px)`);
      checkEqual(JSON.stringify(r.off), JSON.stringify([false, true]), "switched off: stays put");
      checkEqual(JSON.stringify(r.saved), JSON.stringify({ cls: "Roomba", on: false, home: [200, 650], added: true }), "saved");
      checkEqual(r.sell, 125, "sells for half");
    },
  },
  {
    name: "roomba: timid fluffies get a fright when it bumps them, brave ones think it's fun",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        const mk = (bravery) => {
          const h = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, "female");
          const set = (key, sum) => {
            const i = TRAITS.findIndex((q) => q.key === key);
            for (let k = 0; k < TRAIT_GENES_EACH; k++) h.genes[TRAIT_GENE_START + i * TRAIT_GENES_EACH + k] = k < sum ? 1 : 0;
          };
          set("bravery", bravery);
          set("energy", 2);
          h.adopted = true;
          h.x = 500;
          h.y = 500;
          fluffies.push(h);
          return h;
        };
        const bot = new Roomba("INDOORS");
        bot.setPosition(500, 500);
        const timid = mk(0);
        const brave = mk(TRAIT_GENES_EACH);
        return [reactToRoomba(timid, bot), reactToRoomba(brave, bot), timid.expressionOverride, brave.expressionOverride];
      });
      checkEqual(JSON.stringify(r), JSON.stringify(["scared", "fun", "CRYING_SHOCKED", "GOOD_UPSIES"]), "reactions");
    },
  },
];
