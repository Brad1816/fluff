const SCENES = {
  INDOORS: {
    id: "INDOORS",
    isIndoor: true,
    insidePlayerQuarters: true,
    isOutdoor: false,
    isGrassy: false,
    isAlley: false,
    isAdoptionRoom: true,
    hasRiver: false,
    backgroundTexture: "texture_carpet",
    topWallColor: "#444",
    spawnFerals: false,
  },
  OUTDOORS: {
    id: "OUTDOORS",
    isIndoor: false,
    insidePlayerQuarters: false,
    isOutdoor: true,
    isGrassy: true,
    isAlley: false,
    isAdoptionRoom: false,
    hasRiver: false,
    backgroundTexture: "texture_grass",
    topWallColor: "#444",
    spawnFerals: true,
  },
  RIVER: {
    id: "RIVER",
    isIndoor: false,
    insidePlayerQuarters: false,
    isOutdoor: true,
    isGrassy: true,
    isAlley: false,
    isAdoptionRoom: false,
    hasRiver: true,
    backgroundTexture: "texture_grass",
    topWallColor: null,
    spawnFerals: true,
  },
  ALLEY: {
    id: "ALLEY",
    isIndoor: false,
    insidePlayerQuarters: false,
    isOutdoor: true,
    isGrassy: false,
    isAlley: true,
    isAdoptionRoom: false,
    hasRiver: false,
    backgroundTexture: "texture_concrete",
    topWallColor: null,
    spawnFerals: true,
  },
  ALLEY_ROAD: {
    id: "ALLEY_ROAD",
    isIndoor: false,
    insidePlayerQuarters: false,
    isOutdoor: true,
    isGrassy: false,
    isAlley: true,
    isAdoptionRoom: false,
    hasRiver: false,
    backgroundTexture: "texture_concrete",
    topWallColor: null,
    spawnFerals: false,
  },
  BACKYARD: {
    id: "BACKYARD",
    isIndoor: false,
    insidePlayerQuarters: true,
    isOutdoor: true,
    isGrassy: true,
    isAlley: false,
    isAdoptionRoom: false,
    hasRiver: false,
    backgroundTexture: "texture_grass",
    topWallColor: null,
    spawnFerals: false,
  },
  ALLEY_DAY_CARE: {
    id: "ALLEY_DAY_CARE",
    isIndoor: false,
    insidePlayerQuarters: false,
    isOutdoor: true,
    isGrassy: false,
    isAlley: true,
    isAdoptionRoom: false,
    hasRiver: false,
    backgroundTexture: "texture_concrete",
    topWallColor: "#444",
    spawnFerals: true,
  },
  DAY_CARE: {
    id: "DAY_CARE",
    isIndoor: true,
    insidePlayerQuarters: false,
    isOutdoor: false,
    isGrassy: false,
    isAlley: false,
    isAdoptionRoom: false,
    hasRiver: false,
    backgroundTexture: "texture_carpet",
    topWallColor: "#444",
    spawnFerals: false,
  },
};

function getSceneConfig(sceneName) {
  if (!sceneName) return SCENES.INDOORS;
  if (sceneName === "alley_road" || sceneName === "ALLEY_ROAD")
    return SCENES.ALLEY_ROAD;
  if (sceneName === "alley_day_care" || sceneName === "ALLEY_DAY_CARE")
    return SCENES.ALLEY_DAY_CARE;
  if (sceneName === "day_care" || sceneName === "DAY_CARE")
    return SCENES.DAY_CARE;
  if (sceneName.startsWith("INDOORS")) {
    const isMain = sceneName === "INDOORS";
    return {
      id: sceneName,
      isIndoor: true,
      insidePlayerQuarters: true,
      isOutdoor: false,
      isGrassy: false,
      isAlley: false,
      isAdoptionRoom: isMain,
      hasRiver: false,
      backgroundTexture: "texture_carpet",
      topWallColor: "#444",
      spawnFerals: false,
    };
  }
  return SCENES[sceneName] || SCENES.OUTDOORS;
}

function isAlleyScene(sceneName) {
  const s =
    sceneName || (typeof currentScene !== "undefined" ? currentScene : null);
  if (!s) return false;
  const cfg = getSceneConfig(s);
  return cfg ? !!cfg.isAlley : false;
}

function isAlley(sceneName) {
  return isAlleyScene(sceneName);
}

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Capture Game Resolution at startup (Fixed Logical Resolution)
const width = window.innerWidth;
const height = window.innerHeight;

canvas.width = width;
canvas.height = height;

// Scaling State
let scale = 1;
let offsetX = 0;
let offsetY = 0;
const doorRect = { x: 0, y: 0, w: 200, h: 0 };

function resize() {
  const winW = window.innerWidth;
  const winH = window.innerHeight;

  // Maintain aspect ratio
  const scaleX = winW / width;
  const scaleY = winH / height;

  scale = Math.min(scaleX, scaleY);

  const newCanvasW = width * scale;
  const newCanvasH = height * scale;

  offsetX = (winW - newCanvasW) / 2;
  offsetY = (winH - newCanvasH) / 2;

  canvas.style.width = `${newCanvasW}px`;
  canvas.style.height = `${newCanvasH}px`;
  canvas.style.position = "absolute";
  canvas.style.left = `${offsetX}px`;
  canvas.style.top = `${offsetY}px`;

  updateDoorRect();
}

window.addEventListener("resize", resize);
resize();

// Input State
const mouse = { x: 0, y: 0, down: false, rightDown: false };
let isShiftPressed = false;
let shiftSellBlocked = false;

function updateMouse(e) {
  if (!document.hasFocus()) return;
  const clientX = e.clientX;
  const clientY = e.clientY;

  // Transform to Game Space
  mouse.x = (clientX - offsetX) / scale;
  mouse.y = (clientY - offsetY) / scale;
  // Screen position kept separately for the park's camera (Park.js)
  mouse.sx = mouse.x;
  mouse.sy = mouse.y;
}

// Global mouse listeners (Capturing to update state before other listeners)
window.addEventListener(
  "mousedown",
  (e) => {
    if (!document.hasFocus()) return;
    updateMouse(e);
    if (e.button === 0) mouse.down = true;
    if (e.button === 2) mouse.rightDown = true;
  },
  { capture: true },
);

window.addEventListener(
  "mousemove",
  (e) => {
    if (!document.hasFocus()) return;
    updateMouse(e);
  },
  { capture: true },
);

window.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouse.down = false;
  if (e.button === 2) mouse.rightDown = false;
});

window.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (showChatLog && typeof handleChatLogScroll === "function") {
      handleChatLogScroll(e.deltaY);
    }
    if (showSaveList && typeof handleSaveListScroll === "function") {
      handleSaveListScroll(e.deltaY);
    }
  },
  // Needed for preventDefault to work (browsers make wheel listeners
  // "passive" otherwise, and log an error on every scroll)
  { passive: false },
);

window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

window.addEventListener("keyup", (e) => {
  if (e.key === "Shift") {
    isShiftPressed = false;
    shiftSellBlocked = false;
  }
});

window.addEventListener("blur", () => {
  isShiftPressed = false;
  shiftSellBlocked = false;
});

// Global Game State
const recentOutdoorDialogue = []; // { text, time }
let showChatLog = false;
let sceneChatLogs = {}; // scene -> array of { name, text, timestamp }
let chatLogScrollOffset = 0;
let chatLogAutoScroll = true;

function logChatMessage(scene, speakerName, text, color = null) {
  if (!sceneChatLogs[scene]) {
    sceneChatLogs[scene] = [];
  }
  sceneChatLogs[scene].push({
    name: speakerName,
    text: text,
    color: color,
    timestamp: Date.now(),
  });
  if (sceneChatLogs[scene].length > 100) {
    sceneChatLogs[scene].shift();
  }
}
const gibs = [];
const objects = [];
const toolbox = []; // Tools owned by the player
let toolboxPage = 0;
let showToolbox = true;
let showToolbar = true;
let hoveredToolboxItem = null;
const toolbarSlots = [
  { key: "1", tool: null },
  { key: "2", tool: null },
  { key: "3", tool: null },
  { key: "4", tool: null },
  { key: "5", tool: null },
  { key: "6", tool: null },
  { key: "7", tool: null },
  { key: "8", tool: null },
  { key: "9", tool: null },
  { key: "0", tool: null },
];
const fluffies = []; // List of all horses
const cars = [];
let carSpawnTimer = 0;
let alleyBoxSpawnTimer = 60.0;
let isGlobalDragging = false; // Track if any horse is currently being dragged
let bloodCheat = false;
let showFPS = false;
let showFluffyNames = false;
let showBedNames = false;
let showDebugMenu = false;
let debugMenuAction = null;
let debugPairFirst = null;
let debugWatchedFluffyId = null;
let debugWatcherPos = { x: width - 510, y: 160 };
let debugWatcherDragging = false;
let debugWatcherDragOffset = { x: 0, y: 0 };
const debugActionHistory = {}; // fluffyId -> last debug action string
let currentFPS = 0;
let unlockedRoomsL = 0;
let unlockedRoomsR = 0;
let roomsPurchased = 0;
let currentScene = "INDOORS";
let nextFluffyId = 0;
let nextObjectId = 0;
let relationships = {}; // Map<id, Map<otherId, relationshipString>>

let debugHungerMultiplier = 1.0;
let debugPregnancyMultiplier = 1.0;
let debugPoopMultiplier = 1.0;
let debugPeeMultiplier = 1.0;
let debugGrowthMultiplier = 1.0;

const STARTING_MONEY = 250;
let money = STARTING_MONEY;
const poofs = [];
let currentSellRequest = null; // { fluffyId, price, timer, portrait }
let showActionButtons = true;
let itemMenuFilter = "";
let itemMenuPage = 0;
let relCheat = false;

let dayCareFluffies = [];
let dayCareFeeTimer = 60.0;
let dayCareModalOpen = false;
let dayCareBroughtPage = 0;
let dayCareStoredPage = 0;
const DAY_CARE_MOVE_COST = 5000;
const DAY_CARE_RECURRING_FEE_PER_FLUFFY = 50;
const DAY_CARE_FEE_INTERVAL = 60.0;

let gameState = "TITLE";
let titleImageKey = Math.random() < 0.1 ? "title_2" : "title_1";
let titleBGTimer = 0;

let transitionPhase = "OFF";
let transitionTimer = 0;
let preTransitionState = "TITLE_NEW";
let pendingSaveToLoad = null;
let isTransitionLoading = false;

const DEFAULT_SEXUALITY = Object.freeze({
  heterosexual: 90,
  bisexual: 5,
  homosexual: 5,
});
const DEFAULT_SEXUALITY_REGULAR = DEFAULT_SEXUALITY;

function rollSexuality(
  settings = typeof worldSettings !== "undefined" ? worldSettings : null,
) {
  const dist =
    settings && settings.sexuality ? settings.sexuality : DEFAULT_SEXUALITY;
  const hetero = dist.heterosexual !== undefined ? dist.heterosexual : 90;
  const bi = dist.bisexual !== undefined ? dist.bisexual : 5;
  const homo = dist.homosexual !== undefined ? dist.homosexual : 5;
  const total = hetero + bi + homo;
  if (total <= 0) return "heterosexual";

  const roll = Math.random() * total;
  if (roll < hetero) return "heterosexual";
  if (roll < hetero + bi) return "bisexual";
  return "homosexual";
}

function isSexuallyAttractedTo(source, target) {
  if (!source || !target) return false;
  const sex = source.sexuality || "heterosexual";
  if (sex === "bisexual") return true;
  if (sex === "homosexual") return source.gender === target.gender;
  // heterosexual
  return source.gender !== target.gender;
}

function canFluffiesMate(initiator, receiver, isForced = false) {
  if (!initiator || !receiver) return false;
  // Two mares will never mate under any circumstances
  if (initiator.gender === "female" && receiver.gender === "female")
    return false;
  // Initiator must be sexually attracted to receiver
  if (!isSexuallyAttractedTo(initiator, receiver)) return false;
  // If consensual, receiver must also be sexually attracted to initiator
  if (!isForced && !isSexuallyAttractedTo(receiver, initiator)) return false;
  return true;
}

function placedOnValidForSpecialHuggies(placedOn) {
  if (!placedOn) return true;
  if (
    typeof ImmobilizationBoard !== "undefined" &&
    placedOn instanceof ImmobilizationBoard
  ) {
    return true;
  }
  return false;
}

const CRAWLING_HEALTH_THRESHOLD = 40;

function isTooWeakToFightBack(fluffy) {
  if (!fluffy || !fluffy.isAlive) return true;
  if (!fluffy.canSee()) return true;
  if (fluffy.getLimbsMissing() >= 2) {
    return true;
  }

  return (
    typeof fluffy.health === "number" &&
    fluffy.health < CRAWLING_HEALTH_THRESHOLD
  );
}

function canFightBack(fluffy) {
  if (!fluffy || !fluffy.isAlive) return false;
  if (isTooWeakToFightBack(fluffy)) return false;
  const wanDieThreshold =
    typeof WAN_DIE_THRESHOLD !== "undefined" ? WAN_DIE_THRESHOLD : 0.0;
  if (
    typeof fluffy.happiness === "number" &&
    fluffy.happiness <= wanDieThreshold
  )
    return false;
  return true;
}

const DRUG_COLORS = {
  tpn: "#add8e6", // Light Blue
  prolactin: "#ffb6c1", // Pink
  growth_hormone: "#90ee90", // Light Green
  aphrodisiac: "#ff69b4", // Hot Pink
  het: "#4a90e2", // Blue
  bit: "#9b59b6", // Purple
  hot: "#ff4081", // Hot Pink
  toxo_vaccine: "#5555aa", // Blue
  laxative: "#5c4033", //brown
  diuretic: "#f1c40f", //yellow
};

function getDrugColor(drugType, defaultColor = "#ffffff") {
  if (typeof DRUG_COLORS !== "undefined" && DRUG_COLORS[drugType]) {
    return DRUG_COLORS[drugType];
  }
  if (
    typeof DRUG_METABOLISM !== "undefined" &&
    DRUG_METABOLISM[drugType]?.color
  ) {
    return DRUG_METABOLISM[drugType].color;
  }
  return defaultColor;
}

function getDrugRgba(drugType, alpha = 0.8, defaultRgba = null) {
  const hex = getDrugColor(drugType, null);
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) {
    return defaultRgba || `rgba(255, 255, 255, ${alpha})`;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const THERAPY_DRUGS = ["het", "bit", "hot"];

function removeOtherTherapyDrugs(horse, currentDrug) {
  if (!horse || !horse.bloodstream) return;
  for (const d of THERAPY_DRUGS) {
    if (d !== currentDrug) {
      delete horse.bloodstream[d];
    }
  }
  if (typeof horse.updateCrawling === "function") {
    horse.updateCrawling();
  }
}

const DRUG_METABOLISM = {
  tpn: {
    rate: 1.0 / 1.5, // ~0.667 units/sec (matching previous 1 charge / 1.5s)
    color: DRUG_COLORS.tpn,
    onApplication: (horse, amount) => {},
    effect: (horse, amount) => {
      const hungerPerUnit = 0.01 + 0.02 * (1.0 - horse.growth);
      horse.hunger = Math.min(1.0, horse.hunger + amount * hungerPerUnit);
    },
  },
  prolactin: {
    rate: 0.2, // 0.2 units/sec (matching previous 1 charge / 5s)
    color: DRUG_COLORS.prolactin,
    onApplication: (horse, amount) => {},
    effect: (horse, amount) => {
      if (horse.gender === "female") {
        horse.lactatingTimer = Math.min(
          900,
          horse.lactatingTimer + amount * 5.0,
        );
      }
    },
  },
  growth_hormone: {
    rate: 0.2,
    color: DRUG_COLORS.growth_hormone,
    onApplication: (horse, amount) => {},
    effect: (horse, amount) => {
      if (horse.growth < 1.0) {
        horse.growth = Math.min(1.0, horse.growth + amount * 0.005);
      }
    },
  },
  aphrodisiac: {
    rate: 20.0 / 60.0, // 20 units in 1 minute = ~0.333 units/sec
    color: DRUG_COLORS.aphrodisiac,
    onApplication: (horse, amount) => {},
    effect: (horse, amount) => {
      // Behavioral effects occur dynamically while present in bloodstream
    },
  },
  het: {
    rate: 0.2,
    color: DRUG_COLORS.het,
    isTherapy: true,
    onApplication: (horse, amount) => {
      removeOtherTherapyDrugs(horse, "het");
    },
    effect: (horse, amount) => {
      if (horse.sexuality !== "heterosexual") {
        horse.sexuality = "heterosexual";
      }
    },
  },
  bit: {
    rate: 0.2,
    color: DRUG_COLORS.bit,
    isTherapy: true,
    onApplication: (horse, amount) => {
      removeOtherTherapyDrugs(horse, "bit");
    },
    effect: (horse, amount) => {
      if (horse.sexuality !== "bisexual") {
        horse.sexuality = "bisexual";
      }
    },
  },
  hot: {
    rate: 0.2,
    color: DRUG_COLORS.hot,
    isTherapy: true,
    onApplication: (horse, amount) => {
      removeOtherTherapyDrugs(horse, "hot");
    },
    effect: (horse, amount) => {
      if (horse.sexuality !== "homosexual") {
        horse.sexuality = "homosexual";
      }
    },
  },
  toxo_vaccine: {
    rate: 20,
    color: DRUG_COLORS.toxo_vaccine,
    onApplication: (horse, amount) => {},
    effect: (horse, amount) => {
      horse.isToxoVaccinated = true;
    },
  },
  toxo_parasite: {
    rate: 20,
    color: DRUG_COLORS.toxo_vaccine,
    onApplication: (horse, amount) => {},
    effect: (horse, amount) => {
      if (typeof worldSettings === "undefined" || worldSettings.toxoplasmosis) {
        horse.isToxoplasmosis = true;
      }
    },
  },
  laxative: {
    rate: 20 / 10,
    color: DRUG_COLORS.laxative,
    onApplication: (horse, amount) => {},
    effect: (horse, amount) => {
      horse.isDiarrhea = true;
    },
  },
  diuretic: {
    rate: 20 / 10,
    color: DRUG_COLORS.diuretic,
    onApplication: (horse, amount) => {},
    effect: (horse, amount) => {
      horse.isIncontinent = true;
    },
  },
};

let showSaveList = false;
let selectedSaveName = null;
let selectedSaveData = null;
let selectedSaveImage = null;
let saveListScrollOffset = 0;
let savePreviewCache = new Map();
let currentPauseScreenshot = null;
let timePlayed = 0;

// The game clock in milliseconds. Use this (not performance.now() or
// Date.now()) for anything that should follow game time: it stops when the
// game is paused and would speed up with a game-speed setting.
function gameTimeMs() {
  return timePlayed * 1000;
}

function formatTimePlayed(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const total = Math.floor(totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function capturePauseScreenshot() {
  try {
    const mainCanvas =
      document.getElementById("canvas") ||
      (typeof canvas !== "undefined" ? canvas : null);
    if (!mainCanvas || mainCanvas.width === 0 || mainCanvas.height === 0)
      return null;
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 400;
    thumbCanvas.height =
      Math.round(400 * (mainCanvas.height / mainCanvas.width)) || 225;
    const tCtx = thumbCanvas.getContext("2d");
    tCtx.imageSmoothingEnabled = true;
    tCtx.imageSmoothingQuality = "medium";
    tCtx.drawImage(mainCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    currentPauseScreenshot = thumbCanvas.toDataURL("image/jpeg", 0.75);
    return currentPauseScreenshot;
  } catch (err) {
    console.error("Failed to capture pause screenshot:", err);
    return null;
  }
}

let showWorldSettingsPrompt = false;
let wsPromptColorism = true;
let wsPromptAlicorn = true;
let wsPromptSmarties = true;
let wsPromptSBS = true;
let wsPromptToxoplasmosis = true;
let wsPromptSexuality = { ...DEFAULT_SEXUALITY };
let wsPromptSexualityRegular = wsPromptSexuality;
let saveList = [];

const puddles = [
  {
    scene: "INDOORS",
    points: [],
    color: "#8a0303",
  },
];

let waterRipples = [];
let rippleTimer = 0;
const GRASS_SPAWN_INTERVAL_HAS_GRASS = 400.0;
const GRASS_SPAWN_INTERVAL_NO_GRASS = 120.0;
let sceneGrassSpawnTimers = {
  RIVER: 15.0,
  OUTDOORS: 15.0,
  BACKYARD: 15.0,
};
let backyardFenceTier = 0;
let backyardFenceBroken = false;
let backyardFenceBreakTimer = 120.0;
let backyardInvasionTimer = 60.0;
let nextHerdId = 1;
const doorMessages = []; // { text, x, y, timer, opacity, targetPortal }
const uiMessages = []; // { text, timer, opacity }
const debugMessages = []; // { text, timer, opacity } — shown top-right near debug menu
let fluffyNames = {}; // ID -> Name

function updateDoorRect() {
  doorRect.x = width / 2 - doorRect.w / 2;
  doorRect.y = 0;
  doorRect.h = height * 0.15; // 15% top wall
}
updateDoorRect();

window.addEventListener("keydown", (e) => {
  if (!document.hasFocus()) return;
  if (e.key === "Shift") isShiftPressed = true;
});

// --- Utils ---
function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}

function lerpAngle(start, end, t) {
  let diff = end - start;
  // Normalize to -PI to PI
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return start + diff * t;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function isPointInRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

function changeScene(newScene) {
  if (typeof getSceneConfig !== "undefined") {
    const isPlayerQuarters = getSceneConfig(newScene).insidePlayerQuarters;
    if (
      isPlayerQuarters &&
      typeof fluffies !== "undefined" &&
      typeof getDialogue !== "undefined"
    ) {
      const now = gameTimeMs();
      for (const f of fluffies) {
        if (
          f.isAlive &&
          f.scene === newScene &&
          !f.tooYoungToSpeak() &&
          f.currentStateKey !== "SLEEPING" &&
          (f.canSee() || f.canHear())
        ) {
          const timeAway = (now - f.lastSeenPlayerTime) / 1000;
          if (timeAway > 60) {
            f.speak(getDialogue("RETURN_HOME_REMARK", f));
          }
        }
      }
    }
  }

  // Move whatever is grabbed with current cursor/dragging to the new scene
  if (typeof fluffies !== "undefined") {
    for (const f of fluffies) {
      if (f.isDragging) {
        f.scene = newScene;
      }
    }
  }
  if (typeof objects !== "undefined") {
    for (const o of objects) {
      if (o.isDragging) {
        o.scene = newScene;
        if (typeof Cage !== "undefined" && o instanceof Cage) {
          const syncScene = (item) => {
            if (item.currentCage === o) {
              item.scene = newScene;
            }
          };
          if (typeof fluffies !== "undefined") fluffies.forEach(syncScene);
          if (typeof objects !== "undefined") objects.forEach(syncScene);
        }
        if (typeof FoalInACan !== "undefined" && o instanceof FoalInACan) {
          if (typeof fluffies !== "undefined") {
            const foal = fluffies.find((f) => f.currentCage === o);
            if (foal) {
              foal.scene = newScene;
            }
          }
        }
      }
    }
  }

  const oldScene = currentScene;
  currentScene = newScene;
  // Park camera starts where you walk in (Park.js)
  if (typeof onEnterScene === "function") onEnterScene(newScene, oldScene);
}

function wrapText(ctx, text, maxWidth) {
  if (!text) return [""];
  const paragraphs = text.split("\n");
  const lines = [];

  for (const paragraph of paragraphs) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(" ");
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
  }
  return lines;
}

function getSimpleRelationship(rel) {
  if (
    rel === "child" ||
    rel === "baby_child" ||
    rel === "estranged_child" ||
    rel === "dead_baby_child"
  ) {
    rel = "baby";
  } else if (rel === "forgotten_special_friend") {
    rel = "special_friend";
  }
  return rel;
}

function setRelationship(id1, id2, rel) {
  if (!relationships[id1]) relationships[id1] = {};
  relationships[id1][id2] = rel;
}

function handleDropping(item) {
  item.isDragging = false;
  isGlobalDragging = false;

  if (typeof isPlaceableWorldTool === "function" && isPlaceableWorldTool(item)) {
    if (typeof removeToolFromToolbox === "function") {
      removeToolFromToolbox(item, true);
    }
    item.currentCage = null;
    return;
  }

  if (typeof isToolObject === "function" && isToolObject(item)) {
    const idx = objects.indexOf(item);
    if (idx !== -1) {
      objects.splice(idx, 1);
    }
    return;
  }

  // Cage assignment: assign item to cage if it's dropped inside one.
  // Which items can go in cages is set by `inCage` in ItemRegistry.js.
  if (typeof objects !== "undefined") {
    const rule =
      typeof itemCageRule === "function" ? itemCageRule(item) : "yes";
    if (rule === "never") {
      item.currentCage = null;
    } else if (rule === "yes") {
      item.currentCage = null;
      const cages = objects.filter(
        (o) => o instanceof Cage && o.scene === item.scene,
      );
      for (const cage of cages) {
        const b = cage.bounds;
        if (
          item.x > b.left &&
          item.x < b.right &&
          item.y > b.top &&
          item.y < b.bottom
        ) {
          item.currentCage = cage;
          break;
        }
      }
    }
  }

  if (typeof getScenePortals !== "undefined") {
    const portals = getScenePortals(item.scene);
    // Portals are on the screen, so compare with the screen mouse (Park.js)
    const sm = typeof screenMouse === "function" ? screenMouse() : mouse;
    for (const p of portals) {
      if (p.locked || p.keyOnly) continue; // (house rooms: no arrows on the floor)
      if (isPointInRect(sm.x, sm.y, p.x, p.y, p.w, p.h)) {
        const leavingPark = typeof isCameraScene === "function" && isCameraScene(item.scene);
        const t = p.target;
        const tw = typeof sceneW === "function" ? sceneW(t) : width;
        const th = typeof sceneH === "function" ? sceneH(t) : height;
        const groundYMin = (typeof sceneTop === "function" ? sceneTop(t) : height * 0.15) + 50;
        const fromScene = item.scene;
        item.scene = t;
        // Taken away from its herd / family / friends (Separation.js)
        if (typeof onFluffyTakenAway === "function" && typeof Horse !== "undefined" && item instanceof Horse)
          onFluffyTakenAway(item, fromScene);
        if (p.type === "door") item.y = Math.max(item.y, groundYMin);
        if (p.type === "arrow_left") item.x = tw - 100;
        if (p.type === "arrow_right") item.x = 100;
        if (p.type === "arrow_down") item.y = groundYMin + 20;
        if (p.type === "arrow_up") item.y = th - 120;
        if (p.arriveAt === "bottom") item.y = th - 120;
        // Park positions can be far outside a normal screen
        if (leavingPark || (typeof isCameraScene === "function" && isCameraScene(t))) {
          item.x = clamp(item.x, 60, tw - 60);
          item.y = clamp(item.y, groundYMin, th - 60);
        }
        // Leaving the park: you go too, so the camera doesn't get left behind
        if (leavingPark) changeScene(t);
        return true; // Transitioned
      }
    }
  }
  return false; // No transition
}

function handleGenericCageContainment(item, width, height) {
  if (item.isDragging) return;

  if (
    item.currentCage &&
    (typeof objects === "undefined" ||
      !objects.includes(item.currentCage) ||
      item.currentCage.scene !== item.scene)
  ) {
    item.currentCage = null;
  }

  if (item.currentCage) {
    const b = item.currentCage.bounds;
    const halfW = width / 2;
    // Force Y to cage bottom
    item.y = b.bottom - 20;
    item.x = clamp(item.x, b.left + halfW, b.right - halfW);
  }
}

function handleBouncingPhysics(obj, dt) {
  // Gravity
  const gravity = 800;
  obj.vy = (obj.vy || 0) + gravity * dt;

  obj.x += (obj.vx || 0) * dt;
  obj.y += (obj.vy || 0) * dt;

  // Ground Collision
  if (obj.y >= obj.groundY) {
    obj.y = obj.groundY;
    obj.vy = -obj.vy * 0.5; // Bounce
    obj.vx *= 0.95; // Friction
    // (settles even with bigger time steps, so the ball counts as still)
    if (Math.abs(obj.vy) < Math.max(10, gravity * dt * 1.5)) obj.vy = 0;
    if (Math.abs(obj.vx) < 10) obj.vx = 0;
  }

  // Wall Bouncing
  const margin = 20;
  if (obj.x < margin) {
    obj.x = margin;
    obj.vx = -obj.vx * 0.7;
  } else if (obj.x > sceneW(obj.scene) - margin) {
    obj.x = sceneW(obj.scene) - margin;
    obj.vx = -obj.vx * 0.7;
  }
}

function calculateTrashBagGrowthValue(obj) {
  if (typeof Gib !== "undefined" && obj instanceof Gib) {
    return obj.growthValue || 0;
  }
  if (typeof Horse !== "undefined" && obj instanceof Horse) {
    let total = 0;
    const g = obj.growth || 1.0;
    // torso
    total += 0.375 * (1 + (obj.pregnancyTorsoStretch || 0));
    // head
    total += 0.1;
    // tail
    if (obj.limbs && obj.limbs.tail) total += 0.05;
    // legs
    if (obj.limbs && obj.limbs.legs) {
      for (let i = 0; i < 4; i++) {
        if (obj.limbs.legs[i]) total += 0.1;
      }
    }
    // ears
    if (obj.limbs && (obj.limbs.leftEar || obj.limbs.rightEar)) {
      if (obj.limbs.leftEar) total += 0.025;
      if (obj.limbs.rightEar) total += 0.025;
    }
    // lumps
    if (obj.gender === "male" && obj.limbs && obj.limbs.lumps) total += 0.025;
    // udders
    if (obj.gender === "female" && obj.limbs && obj.limbs.udders)
      total += 0.025;
    // horn / wing
    if (obj.type === "unicorn" || obj.type === "alicorn") {
      if (obj.limbs && obj.limbs.horn) total += 0.025;
    }
    if (obj.type === "pegasus" || obj.type === "alicorn") {
      if (obj.limbs && (obj.limbs.leftWing || obj.limbs.rightWing)) {
        if (obj.limbs.leftWing) total += 0.025;
        if (obj.limbs.rightWing) total += 0.025;
      }
    }
    return total * g;
  }
  return 0;
}

function makeSeededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function tintImage(
  img,
  color,
  spotsConfig = null,
  stripesConfig = null,
  gradientConfig = null,
) {
  // Create a temporary canvas
  const buffer = document.createElement("canvas");
  buffer.width = img.width;
  buffer.height = img.height;
  const bx = buffer.getContext("2d");

  // Draw original
  bx.drawImage(img, 0, 0);

  // Tint using multiply
  bx.globalCompositeOperation = "multiply";
  if (gradientConfig && gradientConfig.color) {
    const grad = bx.createLinearGradient(0, 0, buffer.width, buffer.height);
    const t =
      gradientConfig.intensity !== undefined ? gradientConfig.intensity : 0.5;
    const startStop = Math.max(0.0, Math.min(0.9, 0.8 - t * 0.8));
    grad.addColorStop(0, color);
    grad.addColorStop(startStop, color);
    grad.addColorStop(1, gradientConfig.color);
    bx.fillStyle = grad;
  } else {
    bx.fillStyle = color;
  }
  bx.fillRect(0, 0, buffer.width, buffer.height);

  // Mask to original alpha
  bx.globalCompositeOperation = "destination-in";
  bx.drawImage(img, 0, 0);

  let needsPostProcessing = false;

  // Draw spots if configured on top of tinted and masked buffer using source-atop
  if (spotsConfig && spotsConfig.color) {
    needsPostProcessing = true;
    bx.globalCompositeOperation = "source-atop";
    bx.fillStyle = spotsConfig.color;

    const rand = makeSeededRandom(spotsConfig.seed || 0);
    let numClusters = 4 + Math.floor(rand() * 4); // 4-7 clusters for torso
    let defaultBaseRadius = 16;
    if (spotsConfig.isHead) {
      numClusters = 2 + Math.floor(rand() * 2); // 2-3 clusters for head
      defaultBaseRadius = 10;
    } else if (spotsConfig.isLeg) {
      numClusters = 2 + Math.floor(rand() * 2); // 2-3 clusters for legs/ears/chin
      defaultBaseRadius = 10;
    }

    const w = buffer.width;
    const h = buffer.height;

    const getSpatialVariance = (x, y) => {
      const frequency = 0.08;
      const wave = Math.sin(x * frequency) * Math.cos(y * frequency);
      return wave * 0.1; // -10% to +10%
    };

    for (let c = 0; c < numClusters; c++) {
      const cx = rand() * w;
      const cy = rand() * h;
      const baseRadius =
        defaultBaseRadius * 0.7 + rand() * (defaultBaseRadius * 0.6);

      const numCircles = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < numCircles; i++) {
        const angle = rand() * Math.PI * 2;
        const dist = rand() * baseRadius * 0.5;
        const xi = cx + Math.cos(angle) * dist;
        const yi = cy + Math.sin(angle) * dist;

        const variance = getSpatialVariance(xi, yi);
        const finalRadius = baseRadius * (1.0 + variance);

        bx.beginPath();
        bx.arc(xi, yi, finalRadius, 0, Math.PI * 2);
        bx.fill();
      }
    }
  }

  // Draw tiger-like stripes if configured
  if (stripesConfig && stripesConfig.color) {
    needsPostProcessing = true;
    bx.globalCompositeOperation = "source-atop";
    bx.fillStyle = stripesConfig.color;

    const rand = makeSeededRandom(stripesConfig.seed || 0);
    let numStripes = 5 + Math.floor(rand() * 4); // 5-8 stripes for torso
    let maxThickness = 8 + rand() * 6; // 8-14 pixels wide
    if (stripesConfig.isHead) {
      numStripes = 3 + Math.floor(rand() * 2); // 3-4 stripes for head
      maxThickness = 5 + rand() * 5; // 5-10 pixels wide
    } else if (stripesConfig.isLeg) {
      numStripes = 2 + Math.floor(rand() * 2); // 2-3 stripes for legs/ears/chin
      maxThickness = 3.5 + rand() * 3.5; // 3.5-7 pixels wide
    }

    const w = buffer.width;
    const h = buffer.height;

    for (let s = 0; s < numStripes; s++) {
      const t = (s + 0.5) / numStripes;
      const xBase = t * w + (rand() - 0.5) * ((w / numStripes) * 0.5);

      const freq = 0.05 + rand() * 0.05;
      const amp = 3 + rand() * 5;
      const phase = rand() * Math.PI * 2;

      bx.beginPath();

      const leftPoints = [];
      const rightPoints = [];
      const steps = 10;
      for (let step = 0; step <= steps; step++) {
        const y = (step / steps) * h;
        const xCenter = xBase + Math.sin(y * freq + phase) * amp;
        const thickness = maxThickness * Math.sin((step / steps) * Math.PI);

        leftPoints.push({ x: xCenter - thickness / 2, y: y });
        rightPoints.push({ x: xCenter + thickness / 2, y: y });
      }

      bx.moveTo(leftPoints[0].x, leftPoints[0].y);
      for (let step = 1; step <= steps; step++) {
        bx.lineTo(leftPoints[step].x, leftPoints[step].y);
      }

      for (let step = steps; step >= 0; step--) {
        bx.lineTo(rightPoints[step].x, rightPoints[step].y);
      }

      bx.closePath();
      bx.fill();
    }
  }

  if (needsPostProcessing) {
    // Re-apply original outlines and shading by multiplying with the original image again
    bx.globalCompositeOperation = "multiply";
    bx.drawImage(img, 0, 0);

    // Final mask to preserve transparency cleanly
    bx.globalCompositeOperation = "destination-in";
    bx.drawImage(img, 0, 0);
  }

  return buffer;
}

function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Pastel/Vibrant color generator for nicer horses
function getRandomFluffyColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 70%)`;
}

function getRandomPupilColor() {
  const colors = [
    "black",
    "#3e2723", // Dark Brown
    "#d7ccc8", // Light Brown
    "darkgreen",
    "lightgreen",
    "darkred",
    "#ff8a80", // Light Red
    "darkblue",
    "lightblue",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

const LACTATING_CHARGE_INCREASE_TIMER = 10;

const CAN_FORMULA_MAX = 2;

const headKnockTime = 0.25;
const MANE_LAYER_THRESHOLD = 1.0;

// Castration Band Timer Constant
const CASTRATION_BAND_TIMER = 180.0;

// Bed Constants
const CARDBOARD_BOX_SLEEP_OFFSET = -20;

// Happiness Constants
const WAN_DIE_THRESHOLD = 0.0;
const HAPPINESS_MISERABLE_THRESHOLD = 0.25;
const HAPPINESS_SAD_THRESHOLD = 0.4;
const HAPPINESS_HAPPY_THRESHOLD = 0.7;
const HAPPINESS_BONUS_SLEEP_BED = 0.04;
const HAPPINESS_BONUS_SLEEP_BOX = 0.015;
const HAPPINESS_BONUS_FAMILY_BABBLE = 0.1;
const HAPPINESS_BONUS_MATE_SUCCESS = 0.15;
const HAPPINESS_BONUS_PROPOSAL_ACCEPT = 0.4;
const HAPPINESS_BONUS_SKETTIES = 0.1;
const HAPPINESS_BONUS_NUMMIES = 0.05;

// Food Priorities (High to Low: Sketties > Kibble/Rat Poison/Grass/Formula > Soylent Brown)
const FOOD_PRIORITIES = {
  sketties: 4,
  premium_kibble: 3.5,
  kibble: 3,
  value_kibble: 2.5,
  scrap_kibble: 1.5,
  rat_poison: 3,
  grass: 2,
  formula: 3,
};

function getFoodPriority(foodType) {
  if (!foodType) return 2;
  return FOOD_PRIORITIES[foodType] !== undefined
    ? FOOD_PRIORITIES[foodType]
    : 2;
}
const HAPPINESS_BONUS_PLAY = 0.05;
const HAPPINESS_BONUS_BRUSH = 0.1;
const HAPPINESS_BONUS_UPSIES = 0.05;

const HAPPINESS_PENALTY_LITTERBOX_VICTIM = -0.05;
const HAPPINESS_PENALTY_STICK_WHACK = -0.0125;
const HAPPINESS_PENALTY_AMPUTATION = -0.1;
const HAPPINESS_PENALTY_THUMBTACK_PRICK = HAPPINESS_PENALTY_AMPUTATION / 2;
const HAPPINESS_PENALTY_CATTLE_PROD = -1.0 / 15.0; // Drops from 1 to 0 in 15 seconds
const CATTLE_PROD_OVERRIDE_DURATION = 0.35;
const CATTLE_PROD_HITBOX_MULTIPLIER = 1.5;
const CATTLE_PROD_USE_ANIMATION_DURATION = 0.05;
const CATTLE_PROD_SMOKE_THRESHOLD = 2.0; // Prod used for more than 2 seconds in a row
const CATTLE_PROD_SMOKE_DURATION = 5.0; // Sets horse smokeTimer to 5s
const SMOKE_PARTICLE_FREQUENCY = 0.25; // Spawns smoke poof every 0.25s
const CATTLE_PROD_SMOKE_COLOR = "rgba(60, 60, 60, 0.5)"; // Dark grey translucent
const CATTLE_PROD_BASE_DAMAGE = 3.0;
const CATTLE_PROD_GROWTH_FACTOR_BASE = 3.0;

const THUMBTACK_COOLDOWN = 1.5;
const THUMBTACK_STEP_COOLDOWN = 1.5;
const HAPPINESS_PENALTY_BABBEH_GRABBED = -0.0125;
const HAPPINESS_PENALTY_BAD_UPSIES = -0.025;
const HAPPINESS_PENALTY_WITNESS_VIOLENCE = -0.00625;
const HAPPINESS_PENALTY_LOST_RELATIVE = -0.025;
const HAPPINESS_PENALTY_TRAUMA_MISCARRIAGE = -0.05;
const HAPPINESS_PENALTY_DIRTY_PUDDLE = -0.02;
const HAPPINESS_PENALTY_MATE_FORCED_MARE = -0.1;
const HAPPINESS_PENALTY_MATE_BAD_ENFIES = -0.1;
const HAPPINESS_PENALTY_CANT_HUG = -0.05;
const HAPPINESS_PENALTY_BLOOD_FEAR = -0.025;
const HAPPINESS_PENALTY_CORPSE_FEAR_GENERAL = -0.025;
const HAPPINESS_PENALTY_CORPSE_FEAR_RELATION = -0.05;
const HAPPINESS_PENALTY_ATE_BODILY_WASTE = -0.002;

// notifyViolence penalties
const HAPPINESS_PENALTY_CHILD_ATTACKED_DEAD = -0.1;
const HAPPINESS_PENALTY_CHILD_ATTACKED_HURT = -0.00625;
const HAPPINESS_PENALTY_PARENT_ATTACKED_DEAD = -0.125;
const HAPPINESS_PENALTY_PARENT_ATTACKED_HURT = -0.00625;
const HAPPINESS_PENALTY_SPESHOW_FWEN_ATTACKED_DEAD = -0.1;
const HAPPINESS_PENALTY_SPESHOW_FWEN_ATTACKED_HURT = -0.00625;
const HAPPINESS_PENALTY_SIBLING_ATTACKED_DEAD = -0.1;
const HAPPINESS_PENALTY_SIBLING_ATTACKED_HURT = -0.00625;

const FULL_SPEECH_THRESHOLD = 0.35;
const WALKY_THRESHOLD = 0.3;
const CHIRPY_THRESHOLD = 0.15;

// Color Valuation Anchors
const POOPIE_ANCHORS = [
  [63, 31, 0], // Poopie Brown
  [31, 63, 0], // Drab Green
];

const MAX_COLOR_DIST = Math.sqrt(255 ** 2 + 255 ** 2 + 255 ** 2);

const ACCESSORY_DB = {
  fez: {
    id: "fez",
    name: "Fez",
    cost: 500,
    slot: "head",
    imageKey: "accessory_fez",
    canColor: true,
    layer: "OVER_HEAD",
    offsetX: -7,
    offsetY: -60,
    scale: 1.0,
  },
  duncehat: {
    id: "duncehat",
    name: "Dunce hat",
    cost: 300,
    slot: "head",
    imageKey: "accessory_duncehat",
    canColor: false,
    layer: "OVER_HEAD",
    offsetX: -7,
    offsetY: -80,
    scale: 1.0,
  },
  tophat: {
    id: "tophat",
    name: "Top hat",
    cost: 800,
    slot: "head",
    imageKey: "accessory_tophat",
    canColor: true,
    layer: "OVER_HEAD",
    offsetX: -7,
    offsetY: -70,
    scale: 1.0,
  },
  bow: {
    id: "bow",
    name: "Bow",
    cost: 200,
    slot: "head",
    imageKey: "accessory_bow",
    canColor: true,
    layer: "OVER_HEAD",
    offsetX: 0,
    offsetY: -20,
    scale: 1.0,
  },
  kippah: {
    id: "kippah",
    name: "Kippah",
    cost: 200,
    slot: "head",
    imageKey: "accessory_kippah",
    canColor: true,
    layer: "OVER_HEAD",
    offsetX: -7,
    offsetY: -60,
    scale: 1.0,
  },
  scarf: {
    id: "scarf",
    name: "Scarf",
    cost: 250,
    slot: "neck",
    imageKey: "accessory_scarf",
    canColor: true,
    layer: "UNDER_HEAD",
    offsetX: 25,
    offsetY: -5,
    scale: 1.0,
  },
  blindfold: {
    id: "blindfold",
    name: "Blindfold",
    cost: 150,
    slot: "eyes",
    imageKey: "accessory_blindfold",
    canColor: true,
    layer: "OVER_HEAD",
    offsetX: 10,
    offsetY: 0,
    scale: 1.0,
    descOverride:
      "Accessory that blinds fluffy. Drop onto a fluffy to equip. Shift-click the fluffy to unequip. Accessories prevent fluffies from being sold.",
  },
  glasses: {
    id: "glasses",
    name: "Glasses",
    cost: 200,
    slot: "eyes",
    imageKey: "accessory_glasses",
    canColor: false,
    layer: "OVER_HEAD",
    offsetX: 10,
    offsetY: 0,
    scale: 1.0,
  },
  sunglasses: {
    id: "sunglasses",
    name: "Sunglasses",
    cost: 300,
    slot: "eyes",
    imageKey: "accessory_sunglasses",
    canColor: false,
    layer: "OVER_HEAD",
    offsetX: 10,
    offsetY: 0,
    scale: 1.0,
  },
  wingjacket: {
    id: "wingjacket",
    name: "Wingjacket",
    cost: 600,
    slot: "torso",
    imageKey: "accessory_wingjacket",
    canColor: true,
    layer: "OVER_BODY",
    offsetX: 0,
    offsetY: 0,
    scale: 1.0,
    descOverride:
      "Accessory that hides wings of fluffy. Drop onto a fluffy to equip. Shift-click the fluffy to unequip. Accessories prevent fluffies from being sold.",
  },
  mouthgag: {
    id: "mouthgag",
    name: "Mouth gag",
    cost: 400,
    slot: "mouth",
    imageKey: "accessory_mouthgag",
    canColor: true,
    layer: "OVER_CHEEKS",
    offsetX: 12,
    offsetY: 50,
    scale: 1.0,
    descOverride:
      "Accessory that prevents fluffy babbling, biting and eating. Drop onto a fluffy to equip. Shift-click the fluffy to unequip. Accessories prevent fluffies from being sold.",
  },
  crown: {
    id: "crown",
    name: "Crown",
    cost: 1000,
    slot: "head",
    imageKey: "accessory_crown",
    canColor: false,
    layer: "OVER_HEAD",
    offsetX: 0,
    offsetY: -70,
    scale: 1.0,
  },
  partyhat: {
    id: "partyhat",
    name: "Party hat",
    cost: 400,
    slot: "head",
    imageKey: "accessory_partyhat",
    canColor: true,
    layer: "OVER_HEAD",
    offsetX: 0,
    offsetY: -70,
    scale: 1.0,
  },
  castration_band: {
    id: "castration_band",
    name: "Castration Band",
    cost: 200,
    slot: "ABOVE_LUMPS",
    imageKey: "castration_band",
    canColor: true,
    layer: "ABOVE_LUMPS",
    offsetX: 0,
    offsetY: 0,
    scale: 1.0,
    descOverride:
      "Eventually separates a stallion from his special lumps. Drop onto an unneutered stallion to equip. Shift-click to unequip.",
  },
};

const SPAWN_ACTIONS = [
  {
    name: "Fluffy Feast Premium",
    desc: "Top-shelf kibble. Very nutritious and nearly every fluffy loves it: shinier coats, healthier fluffies. Hover over a bowl/trough while holding the bag.",
    cost: 80,
    isItem: "food_bag",
    foodType: "premium_kibble",
    priority: 3,
  },
  {
    name: "Kibble",
    desc: "Ordinary kibble. Decent food; some fluffies like it, some don't. Hover over a bowl/trough while holding the bag.",
    cost: 25,
    isItem: "food_bag",
    foodType: "kibble",
    priority: 2,
  },
  {
    name: "Value Kibble",
    desc: "Cheap kibble. Bland and not very nutritious, and they're hungry again sooner. Hover over a bowl/trough while holding the bag.",
    cost: 10,
    isItem: "food_bag",
    foodType: "value_kibble",
    priority: 2,
  },
  {
    name: "Scrapz",
    desc: "Rock-bottom kibble, made from ground-up fluffies. Barely food: not filling, most fluffies hate it, and it can make them ill. Hover over a bowl/trough while holding the bag.",
    cost: 3,
    isItem: "food_bag",
    foodType: "scrap_kibble",
    priority: 1,
  },
  {
    name: "Rat Poison",
    desc: "Toxic poison. Fluffies that eat this will vomit to death. Hover over a bowl/trough while holding the bag.",
    cost: 50,
    isItem: "food_bag",
    foodType: "rat_poison",
    priority: 2,
  },
  {
    name: "Sketty",
    desc: "Fluffies' favourite junk food. Makes them very happy, but it isn't very nutritious and too much makes them fat. Hover over a bowl/trough while holding the bag.",
    cost: 120,
    isItem: "food_bag",
    foodType: "sketties",
    priority: 3,
  },
  {
    name: "Bowl",
    desc: "Used to feed weaned fluffies.",
    cost: 15,
    isItem: "bowl",
  },
  {
    name: "Trough",
    desc: "A large feeder. Holds 5x food.",
    cost: 500,
    isItem: "trough",
  },
  {
    name: "Formula",
    desc: "Bag of baby food. Click on a feeder while holding the bag.",
    cost: 100,
    isItem: "food_bag",
    foodType: "formula",
  },
  {
    name: "Feeder",
    desc: "Used to feed unweaned fluffies with formula.",
    cost: 100,
    isItem: "feeder",
  },
  {
    name: "Mega feeder",
    desc: "Stores 5x formula.",
    cost: 800,
    isItem: "mega_feeder",
  },
  {
    name: "Magnifier",
    desc: "Use to inspect fluffies and change their names. Click on a fluffy with the magnifying glass to open the info panel.",
    cost: 100,
    isItem: "magnifying_glass",
  },
  {
    name: "Stick",
    desc: "Click fluffies with it to whack them.",
    cost: 50,
    isItem: "sorry_stick",
  },
  {
    name: "Spray bottle",
    desc: "Spray fluffies to discipline them.",
    cost: 150,
    isItem: "spray_bottle",
  },
  {
    name: "Brush",
    desc: "Brush fluffies to reward them for good behavior.",
    cost: 50,
    isItem: "brush",
  },
  {
    name: "Knife",
    desc: "Used for amputation.",
    cost: 50,
    isItem: "knife",
  },
  {
    name: "Scalpel",
    desc: "Amputation with this will not make fluffies bleed.\n\nAfter the second Finno-Korean hyperwar, medical steel has become extremely scarce.",
    cost: 25000,
    isItem: "scalpel",
  },
  {
    name: "Suture kit",
    desc: "Used to stop blood loss in amputated fluffies. 4 uses.",
    cost: 1000,
    isItem: "suture_kit",
  },
  {
    name: "Trash bag",
    desc: "When grabbed will auto pickup fluffy corpses or parts nearby. Click into a grinder to dispose (consumes the bag).",
    cost: 100,
    isItem: "trash_bag",
  },
  {
    name: "Ball",
    desc: "Fluffies love this toy.",
    cost: 20,
    isItem: "ball",
  },
  {
    name: "Sponge",
    desc: "Clean messes by holding this over them.",
    cost: 10,
    isItem: "sponge",
  },
  {
    name: "Thumbtack",
    desc: "Can poke fluffies causing pain and minor bleeding with this. Fluffies that run into it will also be poked similarly.",
    cost: 10,
    isItem: "thumbtack",
  },
  {
    name: "Block",
    desc: "Fluffies will stack these up.",
    cost: 20,
    isItem: "block",
  },
  {
    name: "Grinder",
    desc: "Drop fluffies in to mulch them.",
    cost: 2500,
    isItem: "grinder",
  },
  {
    name: "Cage",
    desc: "Drop fluffies in to trap them inside the cage. Right click the cage to switch modes.\n\nBreeding mode allows forcibly breeding caged fluffies by sorry-sticking the stallion.\n\nSell mode will allow caged fluffies to be prioritized for sale offers.",
    cost: 150,
    isItem: "cage",
  },
  {
    name: "Litterbox",
    desc: "Fluffies won't make a mess if they use this. Once placed, sorry stick fluffies that make bad poopies to potty train them.",
    cost: 20,
    isItem: "litterbox",
  },
  {
    name: "LPal",
    desc: "A litterpal box kit.\nClick the kit with a fluffy old enough to talk to create the box.\nThe box will break if the fluffy in it is too big.\nThe fluffy itself shits into the outtake which needs regular cleaning.",
    cost: 750,
    isItem: "litterpal_box",
  },
  {
    name: "Table",
    desc: "Used to hold fluffies in place while amputating. Right click the table to override amputation to a specific part.",
    cost: 1000,
    isItem: "operating_table",
  },
  {
    name: "Rack",
    desc: "Fluffies will not be able to move on this board, but can still eat and feed foals.",
    cost: 250,
    isItem: "immobilization_board",
  },
  {
    name: "Sprinkler",
    desc: "Will automatically clean poop/pee puddles but will scare fluffies when switched on. Right clicking it will toggle it on/off.",
    cost: 1000,
    isItem: "sprinkler",
  },
  {
    name: "IV stand",
    desc: "Allows administration of various fluids to fluffies. Click the top section with an IV bag, then click the top section to start a connection, then click on a fluffy to complete it.\n\nIV stands will ensure a constant 10 units of a drug are in the fluffy's bloodstream at all times.",
    cost: 3000,
    isItem: "iv_stand",
  },
  {
    name: "TPN",
    desc: "Fluffies hooked to this will receive enough nutrients to stay alive indefinitely.",
    cost: 200,
    isItem: "iv_bag",
    bagType: "tpn",
  },
  {
    name: "Prolactin",
    desc: "Female fluffies hooked to this will lactate indefinitely.",
    cost: 500,
    isItem: "iv_bag",
    bagType: "prolactin",
  },
  {
    name: "HeT",
    desc: "Heterosexual therapy: the sexuality of the treated fluffy to heterosexual.",
    cost: 2000,
    isItem: "iv_bag",
    bagType: "het",
  },
  {
    name: "BiT",
    desc: "Bisexual therapy: adjusts the sexuality of the treated fluffy to bisexual.",
    cost: 2000,
    isItem: "iv_bag",
    bagType: "bit",
  },
  {
    name: "HoT",
    desc: "Homosexual therapy: adjusts the sexuality of the treated fluffy to homosexual.",
    cost: 2000,
    isItem: "iv_bag",
    bagType: "hot",
  },
  {
    name: "Tvx",
    desc: "A vaccine against the toxoplasma gondii parasite, which is found in animal feces. (Or have the vet do it: $60 a fluffy.)",
    cost: 250,
    isItem: "iv_bag",
    bagType: "toxo_vaccine",
  },
  {
    name: "Tpr",
    desc: "A bag of solution that contains the toxoplasma gondii parasite, will infect a fluffy with toxoplasmosis.",
    cost: 1500,
    isItem: "iv_bag",
    bagType: "toxo_parasite",
  },
  {
    name: "Laxative",
    desc: "A solution that forces a fluffy to immediately void its bowels. Manufacturer recommends restraining the fluffy prior to injection.",
    cost: 500,
    isItem: "iv_bag",
    bagType: "laxative",
  },
  {
    name: "Diuretic",
    desc: "A solution that forces a fluffy to immediately urinate. Manufacturer recommends purchasing a mop.",
    cost: 500,
    isItem: "iv_bag",
    bagType: "diuretic",
  },
  {
    name: "Aphrodisiac",
    desc: "An aphrodisiac for male fluffies. Induces intense mating urges and seeking of bad enfies.",
    cost: 1000,
    isItem: "iv_bag",
    bagType: "aphrodisiac",
  },
  {
    name: "Syringe",
    desc: "Used for manual application of IV bag drugs. Click an IV bag to draw 20 units, and click a fluffy to apply.\n\nFluffies slowly metabolize the drug. Fluffies with >50 units of any drug in their bloodstream will die.",
    cost: 100,
    isItem: "syringe",
  },
  {
    name: "Cattle prod",
    desc: "Electrocutes fluffies while grabbed and holding mouse down. Fluffies will eventually start smoking out and die from electrocution.",
    cost: 1500,
    isItem: "cattle_prod",
  },
  {
    name: "Bed",
    desc: "Fluffies will seek this out when sleeping. A couple will share a bed, and the second spot is reserved for the claimant's special friend.",
    cost: 75,
    isItem: "bed",
  },
  {
    name: "Fence",
    desc: "A piece of fence for building pens. Fluffies can't walk through it, but you can still carry them over it.\n\nAfter buying, click to place it. Right click (or press R while holding it) to turn it. Pieces snap together.",
    cost: 40,
    isItem: "fence",
  },
  {
    name: "Gate",
    desc: "A fence piece that opens. Right click it to open or close it. Fluffies will walk through an open gate, and wait by a closed one.\n\nTo turn it, pick it up and press R.",
    cost: 100,
    isItem: "fence_gate",
  },
  {
    name: "FluffTV",
    desc: "Can play programming to teach or torture your fluffies. Right click TV to change the channel.",
    cost: 2000,
    isItem: "fluff_tv",
  },
  {
    name: "Gene Lab",
    desc: "Predicts what two of your fluffies' foals could be like: type, patterns, coat colours, size and how many will be born alive. Right-click it to use.",
    cost: 3000,
    isItem: "gene_lab",
  },
  {
    name: "Computer",
    desc: "Browse FluffList from home: see customer orders, accept them and deliver fluffies without walking to the bounty board. Right-click it to use.",
    cost: 1500,
    isItem: "computer",
  },
];

const DEBUG_ACTIONS = [
  {
    name: "Hungry",
    desc: "Set hunger to near-starvation.",
    action: "hungry",
  },
  {
    name: "Breed",
    desc: "Males: reset breeding cooldown. Females: make near-ready to give birth with lactation.",
    action: "breed",
  },
  {
    name: "Wan Die",
    desc: "Drop a fluffy to minimum happiness.",
    action: "wan_die",
  },
  {
    name: "Neutral",
    desc: "Reset all stat levels (hunger, happiness, waste, sleep, fear) to comfortable mid-values.",
    action: "neutral",
  },
  {
    name: "Forget",
    desc: "Clear grief and searching — fluffy forgets about missing/dead relatives and loses fears.",
    action: "forget",
  },
  {
    name: "Cannibal",
    desc: "Give a fluffy full cannibalism acceptance.",
    action: "cannibal",
  },
  {
    name: "Bathroom",
    desc: "Fill a fluffy's waste storage. Untrained fluffies poop on the floor; trained ones seek a box.",
    action: "bathroom",
  },
  { name: "Smarty", desc: "Toggle Smarty personality.", action: "smarty" },
  { name: "Alicorn", desc: "Toggle Alicorn tolerance.", action: "alicorn" },
  {
    name: "Pair",
    desc: "Click a male and a female (either order) to make special friends.",
    action: "pair",
  },
  {
    name: "Tired",
    desc: "Max sleep deprivation so fluffy urgently seeks sleep.",
    action: "sleeping",
  },
  {
    name: "Clean",
    desc: "Remove all puddles (waste, blood), body parts, and corpses from every scene.",
    action: "clean_all",
    immediate: true,
  },
  {
    name: "Revive",
    desc: "Click a dead fluffy to bring it back to life with 100 health.",
    action: "revive",
  },
  {
    name: "Watch",
    desc: "Click a fluffy to open a live stat panel showing their values and current state.",
    action: "watch",
  },
];

// ---- What each tool is -----------------------------------------------------
// Everything about individual tools (names, pictures, which ones can be
// owned more than once...) is described in ItemRegistry.js (the `tool`
// section of each tool's entry). These functions just look it up.

// Stick, spray bottle, thumbtack. Also works on saved tool data.
function isPunishmentTool(o) {
  if (!o) return false;
  const entry = getToolEntry(o) || (o.classType ? getToolEntryForData(o) : null);
  return !!(entry && entry.tool.punishment);
}

// Stick and spray bottle share the "discipline" toolbar slot
function isPunishmentToolForToolbarPurposes(o) {
  if (!o) return false;
  const entry = getToolEntry(o) || (o.classType ? getToolEntryForData(o) : null);
  return !!(entry && entry.tool.punishmentToolbar);
}

// Tools that can be put down in the world (thumbtack, IV bag)
function isPlaceableWorldTool(obj) {
  const entry = getToolEntry(obj);
  return !!(entry && entry.tool.placeableInWorld);
}

function isToolObject(obj) {
  const entry = getToolEntry(obj);
  return !!(entry && (!entry.tool.onlyIf || entry.tool.onlyIf(obj)));
}

// Is this saved data a tool? ({ classType: "Knife", ... })
function isToolData(oData) {
  const entry = getToolEntryForData(oData);
  return !!(entry && (!entry.tool.dataOnlyIf || entry.tool.dataOnlyIf(oData)));
}

// Is this shop entry a tool?
function isToolAction(action) {
  return !!getToolEntryForAction(action);
}

// Can you own more than one of these? (shop entry / tool)
function isMultiPurchaseToolAction(action) {
  const entry = getToolEntryForAction(action);
  return !!(entry && entry.tool.multi);
}

function isMultiPurchaseTool(tool) {
  const entry = getToolEntry(tool);
  return !!(entry && entry.tool.multi);
}

// Which kind of tool this is (e.g. "knife", "iv_bag_tpn")
function getToolTypeKey(tool) {
  if (!tool) return null;
  const entry = getToolEntry(tool);
  if (entry) return toolField(entry, "key", tool);
  return tool.classType || tool.constructor?.name || null;
}

// Is this tool the thing that shop entry sells?
function matchesToolAction(tool, action) {
  if (!tool || !action) return false;
  const entry = getToolEntry(tool);
  if (!entry || entry !== getToolEntryForAction(action)) return false;
  return !entry.tool.matchesAction || entry.tool.matchesAction(tool, action);
}

function isToolAlreadyOwned(action) {
  if (!isToolAction(action) || isMultiPurchaseToolAction(action)) {
    return false;
  }
  return (
    toolbox.some((tool) => matchesToolAction(tool, action)) ||
    (typeof objects !== "undefined" &&
      objects.some(
        (obj) => isToolObject(obj) && matchesToolAction(obj, action),
      ))
  );
}

// A new tool bought from the shop
function createToolFromAction(action) {
  const entry = getToolEntryForAction(action);
  if (!entry) return null;
  const scene = typeof currentScene !== "undefined" ? currentScene : "INDOORS";
  return entry.tool.create(scene, action);
}

// A tool loaded from a save
function createToolFromData(oData) {
  const entry = getToolEntryForData(oData);
  if (!entry) return null;
  const scene =
    oData.scene ||
    (typeof currentScene !== "undefined" ? currentScene : "INDOORS");
  const tool = entry.tool.create(scene, oData);
  if (oData.id !== undefined && oData.id !== null) {
    tool.id = oData.id;
  }
  if (typeof tool.deserialize === "function") {
    tool.deserialize(oData);
  }
  tool.isDragging = false;
  return tool;
}

function getToolCountInToolbox(tool) {
  if (!tool || typeof toolbox === "undefined") return 0;
  const key =
    typeof getToolTypeKey === "function" ? getToolTypeKey(tool) : null;
  if (!key) return 1;
  return toolbox.filter(
    (t) => typeof getToolTypeKey === "function" && getToolTypeKey(t) === key,
  ).length;
}

function getGroupedToolboxEntries() {
  const currentToolbox = typeof toolbox !== "undefined" ? toolbox : [];
  const groups = new Map();

  for (const tool of currentToolbox) {
    const key =
      typeof getToolTypeKey === "function"
        ? getToolTypeKey(tool)
        : tool.classType || tool.constructor.name;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(tool);
  }

  const entries = [];
  for (const [key, items] of groups.entries()) {
    const activeItem = items.find((t) => t.isDragging);
    const representative = activeItem || items[0];

    entries.push({
      key: key,
      tool: representative,
      items: items,
      count: items.length,
      isMulti:
        typeof isMultiPurchaseTool === "function"
          ? isMultiPurchaseTool(representative)
          : items.length > 1,
    });
  }

  return entries;
}

function swapOrEquipTool(tool) {
  if (!tool) return;
  const key =
    typeof getToolTypeKey === "function" ? getToolTypeKey(tool) : null;
  const itemsOfKind =
    typeof toolbox !== "undefined" && key
      ? toolbox.filter(
          (t) =>
            typeof getToolTypeKey === "function" && getToolTypeKey(t) === key,
        )
      : [tool];

  if (itemsOfKind.length === 0) return;

  // Single item of this kind: toggle behavior
  if (itemsOfKind.length === 1) {
    equipTool(itemsOfKind[0]);
    return;
  }

  // Multiple items of this kind: swap through them!
  const currentIdx = itemsOfKind.findIndex((t) => t.isDragging);
  if (currentIdx === -1) {
    // None dragging: equip the first one (or the given tool)
    const target = itemsOfKind.includes(tool) ? tool : itemsOfKind[0];
    equipTool(target);
  } else {
    // Already dragging: cycle to next item of same kind
    const nextIdx = (currentIdx + 1) % itemsOfKind.length;
    const nextTool = itemsOfKind[nextIdx];

    // Unequip currently dragging tool without clearing global dragging state
    const currentTool = itemsOfKind[currentIdx];
    currentTool.isDragging = false;
    if (typeof objects !== "undefined") {
      const idx = objects.indexOf(currentTool);
      if (idx !== -1) objects.splice(idx, 1);
    }

    // Equip next tool
    nextTool.isDragging = true;
    nextTool.dragOffset = { x: 0, y: 0 };
    if (typeof currentScene !== "undefined") nextTool.scene = currentScene;
    if (typeof mouse !== "undefined") {
      nextTool.x = mouse.x;
      nextTool.y = mouse.y;
    }
    if (typeof objects !== "undefined" && !objects.includes(nextTool)) {
      objects.push(nextTool);
    }
    if (typeof isGlobalDragging !== "undefined") {
      isGlobalDragging = true;
    }

    // Update toolbar slots assigned to this kind
    if (typeof toolbarSlots !== "undefined") {
      for (const slot of toolbarSlots) {
        if (
          slot.tool &&
          typeof getToolTypeKey === "function" &&
          getToolTypeKey(slot.tool) === key
        ) {
          slot.tool = nextTool;
        }
      }
    }

    if (typeof addUIMessage === "function") {
      addUIMessage(
        `Swapped to ${getToolFullName(nextTool)} (${nextIdx + 1}/${itemsOfKind.length})`,
      );
    }
  }
}

function addToolToToolbox(tool) {
  if (!tool) return;
  tool.isDragging = false;
  if (typeof Thumbtack !== "undefined" && tool instanceof Thumbtack) {
    tool.angle = 0;
    if (tool.steppedHorses) tool.steppedHorses.clear();
  }
  if (typeof IVBag !== "undefined" && tool instanceof IVBag) {
    tool.attachedTo = null;
  }
  if (!toolbox.includes(tool)) {
    toolbox.push(tool);
  }
  if (typeof objects !== "undefined") {
    const idx = objects.indexOf(tool);
    if (idx !== -1) objects.splice(idx, 1);
  }
  if (
    typeof isGlobalDragging !== "undefined" &&
    typeof objects !== "undefined" &&
    objects.every((o) => !o.isDragging)
  ) {
    isGlobalDragging = false;
  }
  const typeKey =
    typeof getToolTypeKey === "function" ? getToolTypeKey(tool) : null;
  const alreadyInToolbar =
    typeKey &&
    toolbarSlots.some(
      (s) =>
        s.tool &&
        typeof getToolTypeKey === "function" &&
        getToolTypeKey(s.tool) === typeKey,
    );
  if (!alreadyInToolbar) {
    const emptySlot = toolbarSlots.find((s) => s.tool === null);
    if (emptySlot) {
      emptySlot.tool = tool;
    }
  }
}

function removeToolFromToolbox(tool, keepInWorld = false) {
  if (!tool) return;
  const idx = toolbox.indexOf(tool);
  if (idx !== -1) {
    toolbox.splice(idx, 1);
  }
  const typeKey =
    typeof getToolTypeKey === "function" ? getToolTypeKey(tool) : null;
  const nextOfSameKind = typeKey
    ? toolbox.find(
        (t) =>
          typeof getToolTypeKey === "function" && getToolTypeKey(t) === typeKey,
      )
    : null;

  for (const slot of toolbarSlots) {
    if (slot.tool === tool) {
      slot.tool = nextOfSameKind || null;
    }
  }
  if (!keepInWorld && tool.isDragging) {
    tool.isDragging = false;
    if (typeof objects !== "undefined") {
      const oIdx = objects.indexOf(tool);
      if (oIdx !== -1) objects.splice(oIdx, 1);
    }
    if (typeof isGlobalDragging !== "undefined") {
      isGlobalDragging = false;
    }
  }
}

function equipTool(tool) {
  if (!tool) return;
  if (tool.isDragging) {
    unequipTool(tool);
    return;
  }
  unequipCurrentTool();

  tool.isDragging = true;
  tool.dragOffset = { x: 0, y: 0 };
  if (typeof currentScene !== "undefined") tool.scene = currentScene;
  if (typeof mouse !== "undefined") {
    tool.x = mouse.x;
    tool.y = mouse.y;
  }
  if (typeof objects !== "undefined" && !objects.includes(tool)) {
    objects.push(tool);
  }
  if (typeof isGlobalDragging !== "undefined") {
    isGlobalDragging = true;
  }
}

function unequipTool(tool) {
  if (!tool) return;
  tool.isDragging = false;
  if (typeof objects !== "undefined") {
    const idx = objects.indexOf(tool);
    if (idx !== -1) {
      objects.splice(idx, 1);
    }
  }
  if (typeof isGlobalDragging !== "undefined") {
    isGlobalDragging = false;
  }
}

function unequipCurrentTool() {
  if (typeof objects !== "undefined") {
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (o.isDragging && isToolObject(o)) {
        o.isDragging = false;
        objects.splice(i, 1);
      }
    }
  }
  if (typeof isGlobalDragging !== "undefined") {
    isGlobalDragging = false;
  }
}

// Short name (toolbar), full name and description (tooltip)
function getToolName(tool) {
  if (!tool) return "";
  const entry = getToolEntry(tool);
  return (entry && toolField(entry, "name", tool)) || tool.name || "Tool";
}

function getToolFullName(tool) {
  if (!tool) return "";
  const entry = getToolEntry(tool);
  if (!entry) return tool.name || "Tool";
  return toolField(entry, "fullName", tool) || toolField(entry, "name", tool);
}

function getToolDesc(tool) {
  if (!tool) return "";
  const entry = getToolEntry(tool);
  return (entry && toolField(entry, "desc", tool)) || "";
}

function isDrawableImage(img) {
  if (!img) return false;
  if (
    (typeof HTMLCanvasElement !== "undefined" && img instanceof HTMLCanvasElement) ||
    (typeof OffscreenCanvas !== "undefined" && img instanceof OffscreenCanvas) ||
    (img.getContext && typeof img.getContext === "function")
  ) {
    return img.width > 0 && img.height > 0;
  }
  return !!(
    img.complete &&
    (img.naturalWidth === undefined || img.naturalWidth > 0)
  );
}

// The tool's picture in the toolbox/toolbar
function getToolImage(tool) {
  if (!tool || typeof images === "undefined") return null;
  const entry = getToolEntry(tool);
  return entry && entry.tool.image ? entry.tool.image(tool) : null;
}

function serializeToolbarSlots() {
  return toolbarSlots.map((slot) => {
    let toolIndex = -1;
    if (slot.tool) {
      toolIndex = toolbox.indexOf(slot.tool);
    }
    return {
      key: slot.key,
      toolIndex: toolIndex,
      toolId: slot.tool ? slot.tool.id : null,
      toolClass: slot.tool
        ? slot.tool.constructor.name || slot.tool.classType
        : null,
      toolType: slot.tool ? slot.tool.type || null : null,
    };
  });
}

function restoreToolbarSlots(savedSlots) {
  if (!Array.isArray(savedSlots)) {
    initDefaultToolbar();
    return;
  }
  for (const sData of savedSlots) {
    const slot = toolbarSlots.find((s) => s.key === sData.key);
    if (!slot) continue;
    let foundTool = null;
    if (
      sData.toolIndex !== undefined &&
      sData.toolIndex >= 0 &&
      sData.toolIndex < toolbox.length
    ) {
      foundTool = toolbox[sData.toolIndex];
    } else if (sData.toolId != null) {
      foundTool = toolbox.find((t) => t.id === sData.toolId);
    } else if (sData.toolClass) {
      foundTool = toolbox.find((t) => {
        const cName = t.constructor.name || t.classType;
        if (cName !== sData.toolClass) return false;
        if (sData.toolType) return t.type === sData.toolType;
        return true;
      });
    }
    slot.tool = foundTool || null;
  }
}

function initDefaultToolbar() {
  for (const slot of toolbarSlots) {
    slot.tool = null;
  }
  // Which slot each tool prefers is `toolbarKey` in ItemRegistry.js
  const preferredKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map(
    (key) => ({
      key,
      check: (t) => {
        const entry = getToolEntry(t);
        return !!(entry && entry.tool.toolbarKey === key);
      },
    }),
  );
  const assigned = new Set();
  const assignedKinds = new Set();
  for (const pref of preferredKeys) {
    const found = toolbox.find(
      (t) =>
        !assigned.has(t) &&
        !assignedKinds.has(
          typeof getToolTypeKey === "function" ? getToolTypeKey(t) : null,
        ) &&
        pref.check(t),
    );
    if (found) {
      const slot = toolbarSlots.find((s) => s.key === pref.key);
      if (slot) {
        slot.tool = found;
        assigned.add(found);
        if (typeof getToolTypeKey === "function") {
          assignedKinds.add(getToolTypeKey(found));
        }
      }
    }
  }
  for (const tool of toolbox) {
    const key =
      typeof getToolTypeKey === "function" ? getToolTypeKey(tool) : null;
    if (!assigned.has(tool) && (!key || !assignedKinds.has(key))) {
      const emptySlot = toolbarSlots.find((s) => s.tool === null);
      if (emptySlot) {
        emptySlot.tool = tool;
        assigned.add(tool);
        if (key) assignedKinds.add(key);
      }
    }
  }
}

class SliderWidget {
  constructor({
    x = 0,
    y = 0,
    width = 200,
    height = 34,
    min = 0,
    max = 100,
    value = 0,
    step = 1,
    label = "",
    valueFormatter = null,
    onChange = null,
  } = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.min = min;
    this.max = max;
    this.step = step;
    this.label = label;
    this.valueFormatter = valueFormatter || ((v) => `${Math.round(v)}%`);
    this.onChange = onChange;
    this.isDragging = false;
    this.setValue(value);
  }

  setValue(val) {
    const clamped = Math.max(this.min, Math.min(this.max, val));
    if (this.step && this.step > 0) {
      this.value =
        Math.round((clamped - this.min) / this.step) * this.step + this.min;
    } else {
      this.value = clamped;
    }
    if (this.step >= 1) {
      this.value = Math.round(this.value);
    }
    return this.value;
  }

  getValue() {
    return this.value;
  }

  getRatio() {
    const span = this.max - this.min;
    if (span <= 0) return 0;
    return Math.max(0, Math.min(1, (this.value - this.min) / span));
  }

  setPosition(x, y, width = this.width, height = this.height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  getTrackBounds() {
    return {
      trackX: this.x,
      trackY: this.y + 24,
      trackW: this.width,
      trackH: 4,
    };
  }

  containsPoint(mx, my) {
    return (
      mx >= this.x - 5 &&
      mx <= this.x + this.width + 5 &&
      my >= this.y &&
      my <= this.y + this.height + 6
    );
  }

  handleMouseDown(mx, my) {
    if (this.containsPoint(mx, my)) {
      this.isDragging = true;
      const track = this.getTrackBounds();
      const ratio = Math.max(
        0,
        Math.min(1, (mx - track.trackX) / track.trackW),
      );
      this.setValue(this.min + ratio * (this.max - this.min));
      if (typeof this.onChange === "function") {
        this.onChange(this.value);
      }
      return true;
    }
    return false;
  }

  handleMouseMove(mx, my) {
    if (!this.isDragging) return false;
    const track = this.getTrackBounds();
    const ratio = Math.max(0, Math.min(1, (mx - track.trackX) / track.trackW));
    this.setValue(this.min + ratio * (this.max - this.min));
    if (typeof this.onChange === "function") {
      this.onChange(this.value);
    }
    return true;
  }

  handleMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      return true;
    }
    return false;
  }

  draw(ctx) {
    ctx.save();
    const track = this.getTrackBounds();

    if (this.label || this.valueFormatter) {
      ctx.fillStyle = "white";
      ctx.font = "bold 15px Arial";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "black";

      if (this.label) {
        ctx.textAlign = "left";
        ctx.strokeText(this.label, this.x, this.y + 13);
        ctx.fillText(this.label, this.x, this.y + 13);
      }

      if (this.valueFormatter) {
        const valStr = this.valueFormatter(this.value);
        ctx.textAlign = "right";
        ctx.strokeText(valStr, this.x + this.width, this.y + 13);
        ctx.fillText(valStr, this.x + this.width, this.y + 13);
      }
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(
        track.trackX,
        track.trackY - track.trackH / 2,
        track.trackW,
        track.trackH,
        track.trackH / 2,
      );
    } else {
      ctx.rect(
        track.trackX,
        track.trackY - track.trackH / 2,
        track.trackW,
        track.trackH,
      );
    }
    ctx.fill();

    const ratio = this.getRatio();
    const fillW = Math.max(0, track.trackW * ratio);
    if (fillW > 0) {
      ctx.fillStyle = "rgba(100, 180, 255, 0.75)";
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(
          track.trackX,
          track.trackY - track.trackH / 2,
          fillW,
          track.trackH,
          track.trackH / 2,
        );
      } else {
        ctx.rect(
          track.trackX,
          track.trackY - track.trackH / 2,
          fillW,
          track.trackH,
        );
      }
      ctx.fill();
    }

    const thumbX = track.trackX + track.trackW * ratio;
    ctx.fillStyle = this.isDragging ? "#ffffff" : "#e0e0e0";
    ctx.beginPath();
    ctx.arc(thumbX, track.trackY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }
}

class MutuallyExclusiveSliderSet {
  constructor({
    items = [],
    totalSum = 100,
    x = 0,
    y = 0,
    width = 200,
    sliderHeight = 34,
    spacing = 10,
    onChange = null,
  } = {}) {
    this.totalSum = totalSum;
    this.x = x;
    this.y = y;
    this.width = width;
    this.sliderHeight = sliderHeight;
    this.spacing = spacing;
    this.onChange = onChange;
    this.activeSliderIndex = -1;

    this.items = items.map((it) => ({
      id: it.id,
      label: it.label || it.id,
      value: Math.round(it.value !== undefined ? it.value : 0),
    }));

    this.sliders = this.items.map((item, idx) => {
      const sw = new SliderWidget({
        x: this.x,
        y: this.y + idx * (this.sliderHeight + this.spacing),
        width: this.width,
        height: this.sliderHeight,
        min: 0,
        max: this.totalSum,
        value: item.value,
        step: 1,
        label: item.label,
        onChange: (newVal) => {
          this.setValue(idx, newVal);
        },
      });
      sw.id = item.id;
      return sw;
    });

    this.normalize();
  }

  normalize() {
    if (this.items.length === 0) return;
    let sum = this.items.reduce((acc, it) => acc + it.value, 0);
    let diff = this.totalSum - sum;
    if (diff === 0) return;

    if (diff > 0) {
      while (diff > 0) {
        let eligible = this.items.filter((it) => it.value < this.totalSum);
        if (eligible.length === 0) break;
        eligible.sort((a, b) => a.value - b.value);
        for (const it of eligible) {
          if (diff <= 0) break;
          it.value += 1;
          diff -= 1;
        }
      }
    } else {
      let toSub = -diff;
      while (toSub > 0) {
        let eligible = this.items.filter((it) => it.value > 0);
        if (eligible.length === 0) break;
        eligible.sort((a, b) => b.value - a.value);
        for (const it of eligible) {
          if (toSub <= 0) break;
          it.value -= 1;
          toSub -= 1;
        }
      }
    }
    this.syncSliders();
  }

  syncSliders() {
    for (let i = 0; i < this.items.length; i++) {
      if (this.sliders[i]) {
        this.sliders[i].value = this.items[i].value;
      }
    }
  }

  getValues() {
    const res = {};
    for (const it of this.items) {
      res[it.id] = it.value;
    }
    return res;
  }

  setValues(valObj) {
    if (!valObj) return;
    for (const it of this.items) {
      if (valObj[it.id] !== undefined) {
        it.value = Math.round(valObj[it.id]);
      }
    }
    this.normalize();
    this.syncSliders();
    if (typeof this.onChange === "function") {
      this.onChange(this.getValues());
    }
  }

  setValue(index, targetVal) {
    if (index < 0 || index >= this.items.length) return;
    targetVal = Math.round(Math.max(0, Math.min(this.totalSum, targetVal)));
    const currentVal = this.items[index].value;
    let diff = targetVal - currentVal;
    if (diff === 0) return;

    if (diff > 0) {
      while (diff > 0) {
        const others = [];
        for (let i = 0; i < this.items.length; i++) {
          if (i !== index && this.items[i].value > 0) {
            others.push(i);
          }
        }
        if (others.length === 0) break;

        const share = Math.floor(diff / others.length);
        if (share > 0) {
          for (const i of others) {
            const reduceBy = Math.min(this.items[i].value, share);
            this.items[i].value -= reduceBy;
            diff -= reduceBy;
          }
        } else {
          others.sort((a, b) => this.items[b].value - this.items[a].value);
          for (const i of others) {
            if (diff <= 0) break;
            if (this.items[i].value > 0) {
              this.items[i].value -= 1;
              diff -= 1;
            }
          }
        }
      }
      this.items[index].value =
        this.totalSum -
        this.items.reduce(
          (acc, it, idx) => (idx !== index ? acc + it.value : acc),
          0,
        );
    } else {
      let toAdd = -diff;
      while (toAdd > 0) {
        const others = [];
        for (let i = 0; i < this.items.length; i++) {
          if (i !== index && this.items[i].value < this.totalSum) {
            others.push(i);
          }
        }
        if (others.length === 0) break;

        const share = Math.floor(toAdd / others.length);
        if (share > 0) {
          for (const i of others) {
            const addBy = Math.min(this.totalSum - this.items[i].value, share);
            this.items[i].value += addBy;
            toAdd -= addBy;
          }
        } else {
          others.sort((a, b) => this.items[a].value - this.items[b].value);
          for (const i of others) {
            if (toAdd <= 0) break;
            if (this.items[i].value < this.totalSum) {
              this.items[i].value += 1;
              toAdd -= 1;
            }
          }
        }
      }
      this.items[index].value =
        this.totalSum -
        this.items.reduce(
          (acc, it, idx) => (idx !== index ? acc + it.value : acc),
          0,
        );
    }

    this.syncSliders();

    if (typeof this.onChange === "function") {
      this.onChange(this.getValues());
    }
  }

  setPosition(x, y, width = this.width, spacing = this.spacing) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.spacing = spacing;
    for (let i = 0; i < this.sliders.length; i++) {
      this.sliders[i].setPosition(
        this.x,
        this.y + i * (this.sliderHeight + this.spacing),
        this.width,
        this.sliderHeight,
      );
    }
  }

  handleMouseDown(mx, my) {
    for (let i = 0; i < this.sliders.length; i++) {
      if (this.sliders[i].handleMouseDown(mx, my)) {
        this.activeSliderIndex = i;
        return true;
      }
    }
    return false;
  }

  handleMouseMove(mx, my) {
    if (this.activeSliderIndex !== -1 && this.sliders[this.activeSliderIndex]) {
      return this.sliders[this.activeSliderIndex].handleMouseMove(mx, my);
    }
    return false;
  }

  handleMouseUp() {
    let handled = false;
    if (this.activeSliderIndex !== -1 && this.sliders[this.activeSliderIndex]) {
      handled = this.sliders[this.activeSliderIndex].handleMouseUp();
      this.activeSliderIndex = -1;
    }
    for (const slider of this.sliders) {
      if (slider.isDragging) {
        slider.handleMouseUp();
        handled = true;
      }
    }
    return handled;
  }

  draw(ctx) {
    for (const slider of this.sliders) {
      slider.draw(ctx);
    }
  }
}

class WorldSettings {
  constructor(
    colorism = true,
    alicornIntolerance = true,
    smarties = true,
    sbs = true,
    sexuality = null,
    toxoplasmosis = true,
  ) {
    this.colorism = colorism;
    this.alicornIntolerance = alicornIntolerance;
    this.smarties = smarties;
    this.sbs = sbs;
    const baseSexuality =
      sexuality && typeof sexuality === "object"
        ? sexuality
        : DEFAULT_SEXUALITY;
    this.sexuality = {
      heterosexual:
        baseSexuality.heterosexual !== undefined
          ? baseSexuality.heterosexual
          : DEFAULT_SEXUALITY.heterosexual,
      bisexual:
        baseSexuality.bisexual !== undefined
          ? baseSexuality.bisexual
          : DEFAULT_SEXUALITY.bisexual,
      homosexual:
        baseSexuality.homosexual !== undefined
          ? baseSexuality.homosexual
          : DEFAULT_SEXUALITY.homosexual,
    };
    this.toxoplasmosis = toxoplasmosis !== undefined ? toxoplasmosis : true;
  }

  get sexualityRegular() {
    return this.sexuality;
  }

  set sexualityRegular(val) {
    this.sexuality = val;
  }

  serialize() {
    return {
      colorism: this.colorism,
      alicornIntolerance: this.alicornIntolerance,
      smarties: this.smarties,
      sbs: this.sbs,
      sexuality: { ...this.sexuality },
      toxoplasmosis: this.toxoplasmosis,
    };
  }

  static deserialize(data) {
    if (!data) return new WorldSettings();
    const sex = data.sexuality || data.sexualityRegular || null;
    return new WorldSettings(
      data.colorism !== undefined ? data.colorism : true,
      data.alicornIntolerance !== undefined ? data.alicornIntolerance : true,
      data.smarties !== undefined ? data.smarties : true,
      data.sbs !== undefined ? data.sbs : true,
      sex,
      data.toxoplasmosis !== undefined ? data.toxoplasmosis : true,
    );
  }
}

let worldSettings = new WorldSettings();

Object.values(ACCESSORY_DB).forEach((acc) => {
  SPAWN_ACTIONS.push({
    name: acc.name,
    desc:
      acc.descOverride ||
      "Cosmetic accessory. Drop onto a fluffy to equip. Shift-click the fluffy to unequip. Accessories prevent fluffies from being sold.",
    cost: acc.cost,
    isItem: "accessory",
    accessoryId: acc.id,
  });
});

SPAWN_ACTIONS.push({
  name: "Statue",
  desc: "Does nothing.",
  cost: 50000,
  isItem: "golden_statue",
});

function getExpressionConfig(expr, isAlive = true) {
  let config = {
    eye: "normal",
    pupilSize: 1.0,
    mouth: "neutral",
    cheek: "normal",
  };

  if (!isAlive) {
    config.mouth = "sad";
    config.cheek = null;
    return config;
  }

  switch (expr) {
    case "HAPPY":
      config.eye = "normal";
      config.mouth = "happy";
      config.cheek = "normal";
      break;
    case "RELIEF":
      config.eye = "happy";
      config.mouth = "happy";
      config.cheek = "normal";
      break;
    case "GOOD_UPSIES":
      config.eye = "happy";
      config.mouth = "happy";
      config.cheek = "normal";
      break;
    case "BAD_UPSIES":
      config.eye = "pained";
      config.mouth = "sad";
      config.cheek = "normal";
      break;
    case "BOWEL_MOVEMENT":
      config.eye = "pained";
      config.mouth = "neutral";
      config.cheek = "puffed";
      break;
    case "SAD":
      config.eye = "normal";
      config.mouth = "sad";
      config.cheek = "normal";
      break;
    case "MISERABLE":
      config.eye = "sad";
      config.mouth = "sad";
      config.cheek = "normal";
      break;
    case "FOCUSING":
      config.eye = "normal";
      config.mouth = "shock";
      config.cheek = "normal";
      break;
    case "SHOCKED":
      config.eye = "normal";
      config.pupilSize = 0.5;
      config.mouth = "shock";
      config.cheek = "normal";
      break;
    case "CRYING_SHOCKED":
      config.eye = "normal";
      config.pupilSize = 0.5;
      config.mouth = "shock";
      config.cheek = "normal";
      break;
    case "DISGUSTED":
      config.eye = "normal";
      config.mouth = "sad";
      config.cheek = "normal";
      break;
    case "ANGRY":
      config.eye = "angry";
      config.mouth = "sad";
      config.cheek = "normal";
      break;
    case "ANGRY_PUFFED":
      config.eye = "angry";
      config.mouth = "sad";
      config.cheek = "puffed";
      break;
    case "SMUG":
      config.eye = "angry";
      config.mouth = "happy";
      config.cheek = "normal";
      break;
    case "ATTEMPTING_EXCRETION":
      config.eye = "pained";
      config.mouth = "neutral";
      config.cheek = "normal";
      break;
    case "NEUTRAL":
    default:
      config.eye = "normal";
      config.mouth = "neutral";
      config.cheek = "normal";
      break;
  }

  return config;
}
