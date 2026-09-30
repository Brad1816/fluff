const DB_NAME = "FluffyIndustriesSaves";
const STORE_NAME = "saves";
const DB_VERSION = 1;

class SaveManager {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  async save(slotName, data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, slotName);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async load(slotName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(slotName);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async listSaves() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async delete(slotName) {
    await this.init();
    if (typeof savePreviewCache !== "undefined" && savePreviewCache) {
      savePreviewCache.delete(slotName);
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(slotName);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }
}

const saveManager = new SaveManager();

// ---------------------------------------------------------------------------
// Game-wide state that is SAVED, and what it starts as in a new game.
//
// This one list is used by saveGame, loadGame and "New game", so anything
// added here is saved, loaded (with the fresh value for older saves that
// don't have it), and reset for a new game automatically.
//
//   name   key in the save file
//   get    read the current value      set    change it
//   fresh  its value in a brand new game
//   load   optional: custom loading (e.g. for old save formats)
// (The things with their own saving code - fluffies, objects, gibs, tools,
// puddles, world settings - are handled separately in saveGame/loadGame.)
// ---------------------------------------------------------------------------
const SAVED_GAME_STATE = [
  { name: "money", get: () => money, set: (v) => (money = v), fresh: () => STARTING_MONEY },
  {
    name: "timePlayed",
    get: () => timePlayed,
    set: (v) => (timePlayed = v),
    fresh: () => 0,
    load: (d) => (d.timePlayed !== undefined && !isNaN(d.timePlayed) ? d.timePlayed : 0),
  },
  { name: "nextFluffyId", get: () => nextFluffyId, set: (v) => (nextFluffyId = v), fresh: () => 0 },
  { name: "nextObjectId", get: () => nextObjectId, set: (v) => (nextObjectId = v), fresh: () => 0 },
  { name: "storyBook", get: () => storyBook, set: (v) => { storyBook = v && typeof v === "object" ? v : freshStoryBook(); _storyIndex = null; }, fresh: () => freshStoryBook() }, // StoryBook.js
  { name: "billsOwed", get: () => billsOwed, set: (v) => (billsOwed = v || 0), fresh: () => 0 }, // Bills.js
  { name: "unlockedRoomsL", get: () => unlockedRoomsL, set: (v) => (unlockedRoomsL = v), fresh: () => 0 },
  { name: "unlockedRoomsR", get: () => unlockedRoomsR, set: (v) => (unlockedRoomsR = v), fresh: () => 0 },
  { name: "roomsPurchased", get: () => roomsPurchased, set: (v) => (roomsPurchased = v), fresh: () => 0 },
  { name: "currentScene", get: () => currentScene, set: (v) => (currentScene = v), fresh: () => "INDOORS" },
  { name: "fluffyNames", get: () => fluffyNames, set: (v) => (fluffyNames = v), fresh: () => ({}) },
  { name: "relationships", get: () => relationships, set: (v) => (relationships = v), fresh: () => ({}) },
  {
    name: "goalsState", // breeder goals done, and counts they need (Goals.js)
    get: () => goalsState,
    set: (v) => (goalsState = v), // missing fields are filled in by updateGoals
    fresh: () => freshGoalsState(),
  },
  {
    name: "dayStats", // what happened today, for the morning report (DayReport.js)
    get: () => dayStats,
    set: (v) => (dayStats = v), // missing fields are filled in by updateDayReport
    fresh: () => freshDayStats(),
  },
  {
    name: "previousOwnerNames", // names runaways and lost pets came with (Names.js)
    get: () => previousOwnerNames,
    set: (v) => (previousOwnerNames = v && typeof v === "object" ? v : {}),
    fresh: () => ({}),
  },
  {
    name: "stockMarket", // breeders' market listings (StockMarket.js)
    get: () => stockMarket,
    set: (v) => (stockMarket = v), // missing fields are filled in by updateStockMarket
    fresh: () => freshStockMarket(),
  },
  {
    name: "heatingState", // today's heating bill (Warmth.js)
    get: () => heatingState,
    set: (v) => (heatingState = v && typeof v === "object" ? v : freshHeatingState()),
    fresh: () => freshHeatingState(),
  },
  {
    name: "shoppingBag", // small things bought and not yet put down (ShoppingBag.js)
    get: () => shoppingBag,
    set: (v) => (shoppingBag = Array.isArray(v) ? v : []),
    fresh: () => [],
  },
  {
    name: "showState", // fluffy shows: the next show, your entry, results (Shows.js)
    get: () => showState,
    set: (v) => (showState = v), // missing fields are filled in by updateShows
    fresh: () => freshShowState(),
  },
  {
    name: "nightEvents", // tonight's planned park events (NightEvents.js)
    get: () => nightEvents,
    set: (v) => (nightEvents = v), // missing fields are filled in by updateNightEvents
    fresh: () => freshNightEvents(),
  },
  {
    name: "weatherState", // weather and snow on the ground (WorldTime.js)
    get: () => weatherState,
    set: (v) => (weatherState = v), // missing fields are filled in by updateWorldTime
    fresh: () => freshWeatherState(),
  },
  {
    name: "herdState", // herds and their leaders (Herds.js)
    get: () => herdState,
    set: (v) => {
      herdState = v;
      if (typeof _herdChanged === "function") _herdChanged();
    },
    fresh: () => freshHerdState(),
  },
  {
    name: "customerOrders", // bounty board / FluffList orders and reputation (Orders.js)
    get: () => customerOrders,
    set: (v) => (customerOrders = v),
    fresh: () => freshCustomerOrders(),
  },
  {
    name: "fluffyRecords", // the family record book (FamilyTree.js)
    get: () => (syncFamilyRecords(), fluffyRecords),
    set: (v) => (fluffyRecords = v),
    fresh: () => ({}),
  },
  { name: "sceneChatLogs", get: () => sceneChatLogs, set: (v) => (sceneChatLogs = v), fresh: () => ({}) },
  { name: "sellRequestTimer", get: () => sellRequestTimer, set: (v) => (sellRequestTimer = v), fresh: () => sellRequestAverage },
  { name: "feralTimer", get: () => feralTimer, set: (v) => (feralTimer = v), fresh: () => 0 },
  {
    name: "sceneGrassSpawnTimers",
    get: () => sceneGrassSpawnTimers,
    set: (v) => (sceneGrassSpawnTimers = v),
    fresh: () => ({ RIVER: 15.0, OUTDOORS: 15.0, BACKYARD: 15.0 }),
    // Old saves stored one timer per scene under different names
    load: (d) =>
      d.sceneGrassSpawnTimers || {
        RIVER: d.riverGrassSpawnTimer ?? GRASS_SPAWN_INTERVAL_NO_GRASS,
        OUTDOORS: d.outdoorsGrassSpawnTimer ?? GRASS_SPAWN_INTERVAL_NO_GRASS,
        BACKYARD: d.backyardGrassSpawnTimer ?? GRASS_SPAWN_INTERVAL_NO_GRASS,
      },
  },
  { name: "backyardFenceTier", get: () => backyardFenceTier, set: (v) => (backyardFenceTier = v), fresh: () => 0 },
  { name: "backyardFenceBroken", get: () => backyardFenceBroken, set: (v) => (backyardFenceBroken = v), fresh: () => false },
  { name: "backyardFenceBreakTimer", get: () => backyardFenceBreakTimer, set: (v) => (backyardFenceBreakTimer = v), fresh: () => 120.0 },
  { name: "backyardInvasionTimer", get: () => backyardInvasionTimer, set: (v) => (backyardInvasionTimer = v), fresh: () => 60.0 },
  { name: "nextHerdId", get: () => nextHerdId, set: (v) => (nextHerdId = v), fresh: () => 1 },
  { name: "alleyBoxSpawnTimer", get: () => alleyBoxSpawnTimer, set: (v) => (alleyBoxSpawnTimer = v), fresh: () => 60.0 },
  { name: "dayCareFluffies", get: () => dayCareFluffies, set: (v) => (dayCareFluffies = v), fresh: () => [] },
  { name: "keeperWord", get: () => keeperWord, set: (v) => (keeperWord = typeof v === "string" ? v : "daddeh"), fresh: () => "daddeh" }, // Identity.js
  { name: "roomClimate", get: () => roomClimate, set: (v) => { roomClimate = v && typeof v === "object" ? v : freshRoomClimate(); _climateCache = null; }, fresh: () => freshRoomClimate() }, // Climate.js
  { name: "sharedMemories", get: () => sharedMemories, set: (v) => (sharedMemories = v && typeof v === "object" ? v : freshSharedMemories()), fresh: () => freshSharedMemories() }, // SharedMemories.js
  { name: "inspector", get: () => inspector, set: (v) => (inspector = v && typeof v === "object" ? v : freshInspector()), fresh: () => freshInspector() }, // Inspector.js
  { name: "outings", get: () => outings, set: (v) => (outings = v && typeof v === "object" ? v : freshOutings()), fresh: () => freshOutings() }, // ParkOutings.js
  { name: "economy", get: () => economy, set: (v) => (economy = v && typeof v === "object" ? v : freshEconomy()), fresh: () => freshEconomy() }, // Economy.js
  { name: "pressure", get: () => pressure, set: (v) => (pressure = v && typeof v === "object" ? v : freshPressure()), fresh: () => freshPressure() }, // Pressure.js
  { name: "weekStats", get: () => weekStats, set: (v) => (weekStats = v && typeof v === "object" ? v : freshWeekStats()), fresh: () => freshWeekStats() }, // WeekSummary.js
  { name: "livesBook", get: () => livesBook, set: (v) => (livesBook = v && typeof v === "object" ? v : freshLivesBook()), fresh: () => freshLivesBook() }, // Lives.js
  { name: "keeperRep", get: () => keeperRep, set: (v) => (keeperRep = v && typeof v === "object" ? v : freshKeeperRep()), fresh: () => freshKeeperRep() }, // Reputation.js
  { name: "darkMarket", get: () => darkMarket, set: (v) => (darkMarket = v && typeof v === "object" ? v : freshDarkMarket()), fresh: () => freshDarkMarket() }, // Buyers.js
  { name: "trainingStyle", get: () => trainingStyle, set: (v) => (trainingStyle = v), fresh: () => "kind" }, // FearTraining.js
  { name: "shelter", get: () => shelter, set: (v) => { shelter = v && typeof v === "object" ? v : freshShelter(); _shelterPortraits = {}; }, fresh: () => freshShelter() }, // Shelter.js
];

// Things that are NOT saved but belong to one game, so they're cleared when
// a game is started or loaded (open windows, cars, the current sell offer...)
function resetTemporaryGameState() {
  currentSellRequest = null;
  // A raid on the backyard doesn't carry over (ParkOutings.js)
  if (typeof _raid !== "undefined") _raid = null;
  // Party bunting and confetti (HouseLife.js)
  if (typeof partyDecor !== "undefined") partyDecor = {};
  if (typeof _confetti !== "undefined") _confetti = [];
  gibs.length = 0;
  cars.length = 0;
  carSpawnTimer = 0;
  showChatLog = false;
  if (typeof gameSpeed !== "undefined") gameSpeed = 1;
  if (typeof resetNightPredators === "function") resetNightPredators();
  // Every pop-up screen closed (Screens.js)
  if (typeof resetScreens === "function") resetScreens();
  // Things timed on the game clock, which just jumped (FluffySounds.js, Affection.js)
  if (typeof resetFluffySounds === "function") resetFluffySounds();
  if (typeof affectionPops !== "undefined") affectionPops = [];
}

// Everything in SAVED_GAME_STATE back to how a new game starts
function resetSavedGameState() {
  for (const field of SAVED_GAME_STATE) field.set(field.fresh());
}

function writeSavedGameState(saveData) {
  for (const field of SAVED_GAME_STATE) saveData[field.name] = field.get();
}

function readSavedGameState(saveData) {
  for (const field of SAVED_GAME_STATE) {
    let value = field.load ? field.load(saveData) : saveData[field.name];
    if (value === undefined || value === null) value = field.fresh();
    field.set(value);
  }
}

function loadObject(oData) {
  if (oData.scene === "alley_road") {
    oData.scene = "ALLEY_ROAD";
  }
  // How to re-create each kind of object is listed in ItemRegistry.js
  const obj = createItemFromSave(oData);
  if (!obj) return;

  if (oData.id !== undefined && oData.id !== null) {
    obj.id = oData.id;
  }
  obj.x = oData.x;
  obj.y = oData.y;
  if (typeof obj.deserialize === "function") {
    obj.deserialize(oData);
  }

  // Generic cage linking
  if (oData.currentCageId != null) {
    obj.currentCage = objects.find((o) => o.id === oData.currentCageId);
  }

  // Specialized linking
  if (obj instanceof Block) {
    if (oData.stackedOnId != null) {
      obj.stackedOn = objects.find((o) => o.id === oData.stackedOnId);
    }
    if (oData.heldById !== undefined && oData.heldById !== null) {
      obj.heldBy = fluffies.find((f) => f.id === oData.heldById);
    }
  } else if (obj instanceof IVBag) {
    if (oData.attachedToId != null) {
      obj.attachedTo = objects.find((o) => o.id === oData.attachedToId);
      if (obj.attachedTo) {
        obj.attachedTo.attachedBag = obj;
      }
    }
  }
  objects.push(obj);
}

async function loadGame(slotName) {
  const saveData = await saveManager.load(slotName);
  if (!saveData) {
    alert("Save file not found!");
    return;
  }

  // Version 10 Migration: Update "alley_road" scene references to "ALLEY_ROAD"
  if (!saveData.saveFormatVersion || saveData.saveFormatVersion <= 9) {
    if (saveData.currentScene === "alley_road") {
      saveData.currentScene = "ALLEY_ROAD";
    }
    if (saveData.sceneChatLogs && saveData.sceneChatLogs["alley_road"]) {
      if (!saveData.sceneChatLogs["ALLEY_ROAD"]) {
        saveData.sceneChatLogs["ALLEY_ROAD"] = [];
      }
      saveData.sceneChatLogs["ALLEY_ROAD"].push(
        ...saveData.sceneChatLogs["alley_road"],
      );
      delete saveData.sceneChatLogs["alley_road"];
    }
    if (saveData.puddles) {
      for (const p of saveData.puddles) {
        if (p.scene === "alley_road") {
          p.scene = "ALLEY_ROAD";
        }
      }
    }
    if (saveData.objects) {
      for (const o of saveData.objects) {
        if (o.scene === "alley_road") {
          o.scene = "ALLEY_ROAD";
        }
      }
    }
    if (saveData.fluffies) {
      for (const f of saveData.fluffies) {
        if (f.scene === "alley_road") {
          f.scene = "ALLEY_ROAD";
        }
      }
    }
    if (saveData.gibs) {
      for (const g of saveData.gibs) {
        if (g.scene === "alley_road") {
          g.scene = "ALLEY_ROAD";
        }
      }
    }
  }

  // Money, timers, rooms bought, names... (SAVED_GAME_STATE above)
  readSavedGameState(saveData);
  resetTemporaryGameState();

  if (
    saveData.saveFormatVersion === undefined ||
    saveData.saveFormatVersion <= 3
  ) {
    worldSettings = new WorldSettings(true, true, true, true, null, true);
  } else {
    worldSettings = WorldSettings.deserialize(saveData.worldSettings);
    if (saveData.saveFormatVersion <= 4) {
      worldSettings.smarties = true;
    }
    if (saveData.saveFormatVersion <= 5) {
      worldSettings.sbs = true;
    }
    if (
      saveData.saveFormatVersion <= 11 ||
      worldSettings.toxoplasmosis === undefined
    ) {
      worldSettings.toxoplasmosis = true;
    }
  }

  // Version 11 Migration: Fallback to default values for sexuality chances if not present
  if (
    saveData.saveFormatVersion === undefined ||
    saveData.saveFormatVersion <= 10 ||
    !worldSettings.sexuality
  ) {
    if (
      !worldSettings.sexuality ||
      typeof worldSettings.sexuality !== "object"
    ) {
      worldSettings.sexuality = { ...DEFAULT_SEXUALITY };
    } else {
      worldSettings.sexuality = {
        heterosexual:
          worldSettings.sexuality.heterosexual !== undefined
            ? worldSettings.sexuality.heterosexual
            : DEFAULT_SEXUALITY.heterosexual,
        bisexual:
          worldSettings.sexuality.bisexual !== undefined
            ? worldSettings.sexuality.bisexual
            : DEFAULT_SEXUALITY.bisexual,
        homosexual:
          worldSettings.sexuality.homosexual !== undefined
            ? worldSettings.sexuality.homosexual
            : DEFAULT_SEXUALITY.homosexual,
      };
    }
  }

  puddles.length = 0;
  puddles.push(...saveData.puddles);

  fluffies.length = 0;
  objects.length = 0;
  gibs.length = 0;
  cars.length = 0;
  carSpawnTimer = 0;

  const getBlockDepth = (id, allObjects) => {
    const d = allObjects.find((o) => o.id === id);
    if (d && (d.classType === "Block" || d.type === "Block") && d.stackedOnId) {
      return 1 + getBlockDepth(d.stackedOnId, allObjects);
    }
    return 0;
  };

  toolbox.length = 0;
  toolbarSlots.forEach((s) => (s.tool = null));
  showToolbox = true;
  showToolbar = true;

  // Version 14 Migration: Move all existing tool objects from saveData.objects into toolbox
  if (!saveData.saveFormatVersion || saveData.saveFormatVersion <= 13) {
    const remainingObjects = [];
    for (const oData of saveData.objects) {
      if (typeof isToolData === "function" && isToolData(oData)) {
        const tool = createToolFromData(oData);
        if (tool) {
          if (
            typeof isMultiPurchaseTool === "function" &&
            !isMultiPurchaseTool(tool)
          ) {
            const key =
              typeof getToolTypeKey === "function"
                ? getToolTypeKey(tool)
                : null;
            const alreadyExists =
              key !== null &&
              toolbox.some(
                (existing) =>
                  typeof getToolTypeKey === "function" &&
                  getToolTypeKey(existing) === key,
              );
            if (alreadyExists) {
              // Delete duplicate non-multi-purchase tool
              continue;
            }
          }
          toolbox.push(tool);
        }
      } else {
        remainingObjects.push(oData);
      }
    }
    saveData.objects = remainingObjects;
    if (typeof initDefaultToolbar === "function") {
      initDefaultToolbar();
    }
  } else {
    if (Array.isArray(saveData.toolbox)) {
      for (const tData of saveData.toolbox) {
        const tool = createToolFromData(tData);
        if (tool) {
          if (
            typeof isMultiPurchaseTool === "function" &&
            !isMultiPurchaseTool(tool)
          ) {
            const key =
              typeof getToolTypeKey === "function"
                ? getToolTypeKey(tool)
                : null;
            const alreadyExists =
              key !== null &&
              toolbox.some(
                (existing) =>
                  typeof getToolTypeKey === "function" &&
                  getToolTypeKey(existing) === key,
              );
            if (alreadyExists) {
              continue;
            }
          }
          toolbox.push(tool);
        }
      }
    }
    if (saveData.toolbarSlots && typeof restoreToolbarSlots === "function") {
      restoreToolbarSlots(saveData.toolbarSlots);
    } else if (typeof initDefaultToolbar === "function") {
      initDefaultToolbar();
    }
    if (saveData.showToolbox !== undefined) {
      showToolbox = saveData.showToolbox;
    } else if (saveData.showToolbar !== undefined) {
      showToolbox = saveData.showToolbar;
    } else {
      showToolbox = true;
    }
    showToolbar = true;
  }

  saveData.objects.sort((a, b) => {
    const getPriority = (item) => {
      const type = item.classType;
      if (type === "Cage") return -100;
      if (type === "IVStand") return -50;
      if (type === "Block") return getBlockDepth(item.id, saveData.objects);
      return 0;
    };
    return getPriority(a) - getPriority(b);
  });

  let ivStandLinks = {};

  // Load objects
  for (const oData of saveData.objects) {
    loadObject(oData);
    if (oData.classType === "IVStand" && oData.connectedFluffyId != null) {
      if (ivStandLinks[oData.connectedFluffyId] == null) {
        ivStandLinks[oData.connectedFluffyId] = [];
      }
      ivStandLinks[oData.connectedFluffyId].push(oData.id);
    }
  }

  // Load fluffies
  for (const fData of saveData.fluffies) {
    const f = Horse.deserialize(fData);

    if (
      f.genes &&
      f.genes.length < 103 &&
      (!saveData.saveFormatVersion || saveData.saveFormatVersion <= 8)
    ) {
      if (f.genes.length < 95) {
        if (f.genes.length < 87) {
          if (f.genes.length < 84) {
            while (f.genes.length < 79) {
              f.genes.push(Math.random() < 0.5 ? 0 : 1);
            }
            for (let k = 0; k < 4; k++) f.genes.push(0);
            f.genes.push(Math.floor(Math.random() * 256));
          }
          while (f.genes.length < 87) {
            f.genes.push(Math.floor(Math.random() * 256));
          }
        }
        // Extend from 87 to 95 for stripes compatibility
        while (f.genes.length < 91) {
          f.genes.push(0);
        }
        f.genes.push(Math.floor(Math.random() * 256)); // Stripe seed (91)
        while (f.genes.length < 95) {
          f.genes.push(Math.floor(Math.random() * 256)); // Stripe RGB (92-94)
        }
      }
      // Extend from 95 to 103 for gradient compatibility
      while (f.genes.length < 99) {
        f.genes.push(0); // Gradient presence genes (95-98) set to 0
      }
      f.genes.push(128 + Math.floor(Math.random() * 128)); // Gradient intensity/seed (99) with min 128
      while (f.genes.length < 103) {
        f.genes.push(Math.floor(Math.random() * 256)); // Gradient RGB (100-102)
      }
      f.processGenes();
    }

    if (!saveData.saveFormatVersion || saveData.saveFormatVersion === 0) {
      if (f.type === "pegasus" || f.type === "alicorn") {
        f.limbs.leftWing = true;
        f.limbs.rightWing = true;
      }

      if (f.type === "unicorn" || f.type === "alicorn") {
        f.limbs.horn = true;
      }
    }

    if (saveData.saveFormatVersion === 1 || saveData.saveFormatVersion === 2) {
      if (f.coloristDegree === undefined) {
        f.coloristDegree = f.genetics.calculateColorismPerception();
      }

      if (f.alicornTolerance === undefined) {
        f.alicornTolerance = f.type === "alicorn";
      }
    }

    if (f.isPoisoned === undefined) {
      f.isPoisoned = fData.isPoisoned || fData.poisoned || false;
    }
    if (!f.bloodstream) {
      f.bloodstream = {};
    }
    if (!f.sexuality) {
      f.sexuality = "heterosexual";
    }

    fluffies.push(f);

    if (fData.currentCageId != null) {
      f.currentCage = objects.find((obj) => obj.id === fData.currentCageId);
    }
    if (fData.placedOnId != null) {
      f.placedOn = objects.find((obj) => obj.id === fData.placedOnId);
      if (f.placedOn) f.placedOn.securedFluffy = f;
    }
    if (fData.claimedBedId !== undefined && fData.claimedBedId !== null) {
      f.claimedBed = objects.find((obj) => obj.id === fData.claimedBedId);
    }
    if (ivStandLinks[f.id] != null) {
      for (const ivStandId of ivStandLinks[f.id]) {
        let ivStand = objects.find((obj) => obj.id === ivStandId);
        if (ivStand) {
          ivStand.connectedFluffy = f;
        }
      }
    }
  }

  // Load gibs
  if (saveData.gibs) {
    for (const gData of saveData.gibs) {
      const g = Gib.deserialize(gData);
      if (gData.grinderId !== undefined && gData.grinderId !== null) {
        g.grinder = objects.find((o) => o.id === gData.grinderId);
      }
      gibs.push(g);
    }
  }

  // Ensure a FoalVendor exists in the Alley scene
  if (typeof FoalVendor !== "undefined") {
    const hasVendor = objects.some((o) => o instanceof FoalVendor);
    if (!hasVendor) {
      objects.push(new FoalVendor("ALLEY"));
    }
  }

  // Ensure a DayCareDesk exists in the Day Care scene
  if (typeof DayCareDesk !== "undefined") {
    const hasDesk = objects.some((o) => o instanceof DayCareDesk);
    if (!hasDesk) {
      objects.push(new DayCareDesk("DAY_CARE"));
    }
  }  // ...and the shelter's kennels (Shelter.js)
  if (typeof ShelterKennels !== "undefined" && !objects.some((o) => o instanceof ShelterKennels)) {
    objects.push(new ShelterKennels("DAY_CARE"));
  }


  // Undo the automatic names from one earlier build (Names.js)
  if (typeof cleanUpAutoNames === "function") cleanUpAutoNames();
  // Runaways from before they came with names (Names.js)
  if (typeof nameFormerPets === "function") nameFormerPets();

  // Fluffy Park food (saves from before the park had any)
  if (typeof setupParkLife === "function") setupParkLife(false);

  console.log("Game loaded successfully!");
}

const saveFormatVersion = 14;
if (typeof window !== "undefined") {
  window.saveFormatVersion = saveFormatVersion;
}

async function saveGame(slotName) {
  let screenshot = currentPauseScreenshot;
  if (!screenshot && typeof capturePauseScreenshot === "function") {
    screenshot = capturePauseScreenshot();
  }

  const saveData = {
    screenshot: screenshot,
    saveDate: new Date().toLocaleString(),
    worldSettings: worldSettings.serialize(),
    puddles: puddles,
    toolbox: (typeof toolbox !== "undefined" ? toolbox : []).map((t) =>
      typeof t.serialize === "function"
        ? t.serialize()
        : { classType: t.constructor.name, id: t.id },
    ),
    toolbarSlots:
      typeof serializeToolbarSlots === "function"
        ? serializeToolbarSlots()
        : [],
    showToolbox: typeof showToolbox !== "undefined" ? showToolbox : true,
    showToolbar: true,
    fluffies: fluffies.map((f) => f.serialize()),
    objects: objects
      .filter((o) => {
        if (typeof toolbox !== "undefined" && toolbox.includes(o)) {
          return false;
        }
        if (typeof isToolObject === "function" && isToolObject(o)) {
          if (
            typeof isPlaceableWorldTool === "function" &&
            isPlaceableWorldTool(o)
          ) {
            return true;
          }
          return false;
        }
        return true;
      })
      .map((o) => o.serialize()),
    gibs: gibs.map((g) => g.serialize()),
    saveFormatVersion: saveFormatVersion,
  };

  // Money, timers, rooms bought, names... (SAVED_GAME_STATE above)
  writeSavedGameState(saveData);

  await saveManager.save(slotName, saveData);

  if (typeof savePreviewCache !== "undefined" && savePreviewCache) {
    let img = null;
    if (screenshot) {
      img = new Image();
      img.src = screenshot;
    }
    savePreviewCache.set(slotName, { data: saveData, image: img });
  }

  console.log("Game saved successfully!");
}
