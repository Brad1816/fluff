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

function loadObject(oData) {
  if (oData.scene === "alley_road") {
    oData.scene = "ALLEY_ROAD";
  }
  let obj;
  const objType = oData.classType;
  switch (objType) {
    case "AccessoryItem":
      obj = new AccessoryItem(oData.scene, oData.accessoryId);
      break;
    case "Ball":
      obj = new Ball(oData.x, oData.y, oData.scene);
      break;
    case "Bed":
      obj = new Bed(oData.scene, oData.type || "normal");
      break;
    case "FoodBag":
      obj = new FoodBag(oData.type, oData.scene);
      break;
    case "Litterbox":
      obj = new Litterbox(oData.scene);
      break;
    case "Grinder":
      obj = new Grinder(oData.scene);
      break;
    case "Cage":
      obj = new Cage(oData.scene);
      break;
    case "Enclosure":
      obj = new Enclosure(oData.scene);
      break;
    case "Brush":
      obj = new Brush(oData.scene);
      break;
    case "Sponge":
      obj = new Sponge(oData.scene);
      break;
    case "Knife":
      obj = new Knife(oData.type, oData.scene);
      break;
    case "SutureKit":
      obj = new SutureKit(oData.scene);
      break;
    case "TrashBag":
      obj = new TrashBag(oData.scene);
      break;
    case "SorryStick":
      obj = new SorryStick(oData.scene);
      break;
    case "SprayBottle":
      obj = new SprayBottle(oData.scene);
      break;
    case "MagnifyingGlass":
      obj = new MagnifyingGlass(oData.scene);
      break;
    case "Sprinkler":
      obj = new Sprinkler(oData.scene);
      break;
    case "IVStand":
      obj = new IVStand(oData.scene);
      break;
    case "IVBag":
      obj = new IVBag(oData.scene, oData.type);
      break;
    case "FluffyTable":
      obj = new FluffyTable(oData.scene);
      break;
    case "OperatingTable":
      obj = new OperatingTable(oData.scene);
      break;
    case "ImmobilizationBoard":
      obj = new ImmobilizationBoard(oData.scene);
      break;
    case "LitterpalBox":
      obj = new LitterpalBox(oData.scene);
      break;
    case "Block":
      obj = new Block(oData.x, oData.y, oData.scene);
      break;
    case "GoldenStatue":
      obj = new GoldenStatue(oData.scene);
      break;
    case "FoalVendor":
      obj = new FoalVendor(oData.scene);
      break;
    case "FoalInACan":
      obj = new FoalInACan(oData.scene);
      break;
    case "FluffTV":
      obj = new FluffTV(oData.scene);
      break;
    case "Bowl":
      obj = new Bowl(oData.type, oData.scene);
      break;
    case "Grass":
      obj = new Grass(oData.x, oData.y, oData.scene);
      break;
    case "Thumbtack":
      obj = new Thumbtack(oData.scene);
      break;
    case "Syringe":
      obj = new Syringe(oData.scene);
      break;
    case "CattleProd":
      obj = new CattleProd(oData.scene);
      break;
    case "ThrowTool":
      obj = new ThrowTool(oData.scene);
      break;
    case "DayCareDesk":
      obj = new DayCareDesk(oData.scene);
      break;
    default:
      return;
  }

  if (oData.id !== undefined && oData.id !== null) {
    obj.id = oData.id;
  }
  obj.x = oData.x;
  obj.y = oData.y;
  if (typeof obj.deserialize === "function") {
    obj.deserialize(oData);
  }

  if (obj instanceof Cage) {
    obj.updateBounds();
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

  money = saveData.money;
  timePlayed =
    saveData.timePlayed !== undefined && !isNaN(saveData.timePlayed)
      ? saveData.timePlayed
      : 0;
  nextFluffyId = saveData.nextFluffyId;
  nextObjectId = saveData.nextObjectId;
  unlockedRoomsL = saveData.unlockedRoomsL;
  unlockedRoomsR = saveData.unlockedRoomsR;
  roomsPurchased = saveData.roomsPurchased;
  currentScene = saveData.currentScene;

  fluffyNames = saveData.fluffyNames;
  relationships = saveData.relationships;
  sceneChatLogs = saveData.sceneChatLogs || {};
  dayCareFluffies = saveData.dayCareFluffies || [];
  dayCareFeeTimer =
    saveData.dayCareFeeTimer !== undefined ? saveData.dayCareFeeTimer : 60.0;

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
  puddles.push(...(saveData.puddles || []).map(Puddle.deserialize));

  sellRequestTimer = saveData.sellRequestTimer;
  feralTimer = saveData.feralTimer;
  if (saveData.sceneGrassSpawnTimers) {
    sceneGrassSpawnTimers = saveData.sceneGrassSpawnTimers;
  } else {
    sceneGrassSpawnTimers = {
      RIVER:
        saveData.riverGrassSpawnTimer !== undefined
          ? saveData.riverGrassSpawnTimer
          : GRASS_SPAWN_INTERVAL_NO_GRASS,
      OUTDOORS:
        saveData.outdoorsGrassSpawnTimer !== undefined
          ? saveData.outdoorsGrassSpawnTimer
          : GRASS_SPAWN_INTERVAL_NO_GRASS,
      BACKYARD:
        saveData.backyardGrassSpawnTimer !== undefined
          ? saveData.backyardGrassSpawnTimer
          : GRASS_SPAWN_INTERVAL_NO_GRASS,
    };
  }
  if (saveData.backyardFenceTier !== undefined) {
    backyardFenceTier = saveData.backyardFenceTier;
  } else {
    backyardFenceTier = 0;
  }
  if (saveData.backyardFenceBroken !== undefined) {
    backyardFenceBroken = saveData.backyardFenceBroken;
  } else {
    backyardFenceBroken = false;
  }
  if (saveData.backyardFenceBreakTimer !== undefined) {
    backyardFenceBreakTimer = saveData.backyardFenceBreakTimer;
  } else {
    backyardFenceBreakTimer = 120.0;
  }
  if (saveData.backyardInvasionTimer !== undefined) {
    backyardInvasionTimer = saveData.backyardInvasionTimer;
  } else {
    backyardInvasionTimer = 60.0;
  }
  if (saveData.nextHerdId !== undefined) {
    nextHerdId = saveData.nextHerdId;
  } else {
    nextHerdId = 1;
  }

  if (saveData.alleyBoxSpawnTimer !== undefined) {
    alleyBoxSpawnTimer = saveData.alleyBoxSpawnTimer;
  } else {
    alleyBoxSpawnTimer = 60.0;
  }

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

  // Ensure default ThrowTool exists in toolbox if missing and is prepended to other tools
  if (typeof ThrowTool !== "undefined") {
    const hasThrowTool = toolbox.some((t) => t instanceof ThrowTool);
    if (!hasThrowTool) {
      toolbox.unshift(new ThrowTool());
    } else {
      const idx = toolbox.findIndex((t) => t instanceof ThrowTool);
      if (idx > 0) {
        const [tt] = toolbox.splice(idx, 1);
        toolbox.unshift(tt);
      }
    }
  }
  if (typeof ensureThrowToolPrepended === "function") {
    ensureThrowToolPrepended();
  }

  saveData.objects.sort((a, b) => {
    const getPriority = (item) => {
      const type = item.classType;
      if (type === "Cage" || type === "Enclosure") return -100;
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
  }

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
    money: money,
    timePlayed: timePlayed,
    screenshot: screenshot,
    saveDate: new Date().toLocaleString(),
    nextFluffyId: nextFluffyId,
    nextObjectId: nextObjectId,
    unlockedRoomsL: unlockedRoomsL,
    unlockedRoomsR: unlockedRoomsR,
    roomsPurchased: roomsPurchased,
    currentScene: currentScene,
    fluffyNames: fluffyNames,
    relationships: relationships,
    sceneChatLogs: sceneChatLogs,
    worldSettings: worldSettings.serialize(),
    puddles: puddles.map((p) => p.serialize()),
    sellRequestTimer: sellRequestTimer,
    feralTimer: feralTimer,
    sceneGrassSpawnTimers: sceneGrassSpawnTimers,
    backyardFenceTier: backyardFenceTier,
    backyardFenceBroken: backyardFenceBroken,
    backyardFenceBreakTimer: backyardFenceBreakTimer,
    backyardInvasionTimer: backyardInvasionTimer,
    nextHerdId: nextHerdId,
    alleyBoxSpawnTimer: alleyBoxSpawnTimer,
    dayCareFluffies: dayCareFluffies,
    dayCareFeeTimer: dayCareFeeTimer,
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
