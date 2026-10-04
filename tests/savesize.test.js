// Keeping saves small: gone wild fluffies' stories go after STORY_WILD_DAYS, yours stay; chat logs are capped
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "save size: a gone wild fluffy's story goes after a couple of days; a gone pet's stays; chat logs keep CHAT_LOG_KEEP lines",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("INDOORS");
        __clearScene("ALLEY");
        const wild = new Horse(1, null, "ALLEY", "earthy", null, 0.5, 0.5, "female");
        wild.adopted = false;
        fluffies.push(wild);
        const pet = new Horse(1, null, "INDOORS", "earthy", null, 0.5, 0.5, "female");
        pet.adopted = true;
        fluffies.push(pet);
        syncFamilyRecords();
        recordStory("ill", wild, { x: "fluffy flu" });
        recordStory("ill", pet, { x: "fluffy flu" });
        noteFluffyLeft(pet, "sold", 100);
        fluffies.splice(fluffies.indexOf(wild), 1);
        fluffies.splice(fluffies.indexOf(pet), 1);
        syncFamilyRecords();
        const has = (f) => storyBook.events.some((e) => e.w.includes(f.id) && e.k === "ill");
        tidyFamilyRecords();
        const soon = [has(wild), has(pet)];
        timePlayed += (STORY_WILD_DAYS + 0.5) * DAY_LENGTH;
        tidyFamilyRecords();
        const later = [has(wild), has(pet)];
        for (let i = 0; i < CHAT_LOG_KEEP + 30; i++) logChatMessage("ZZTEST", "x", "line " + i);
        const chat = sceneChatLogs.ZZTEST.length;
        delete sceneChatLogs.ZZTEST;
        return { soon, later, chat };
      });
      checkEqual(JSON.stringify(r.soon), JSON.stringify([true, true]), "kept at first");
      checkEqual(JSON.stringify(r.later), JSON.stringify([false, true]), "the wild one's goes, the pet's stays");
      checkEqual(r.chat, 60, "chat log capped");
    },
  },
];
