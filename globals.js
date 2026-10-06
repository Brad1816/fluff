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
    return {
      id: sceneName,
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

function sceneHasWall(sceneName) {
  const s =
    sceneName || (typeof currentScene !== "undefined" ? currentScene : null);
  if (!s) return true;
  const cfg = getSceneConfig(s);
  return !!(cfg && cfg.topWallColor);
}

function isIndoorScene(sceneName) {
  const s =
    sceneName || (typeof currentScene !== "undefined" ? currentScene : null);
  if (!s) return true;
  const cfg = getSceneConfig(s);
  return cfg ? !!cfg.isIndoor : true;
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

const mouseVelocityHistory = [];

function updateMouse(e) {
  if (!document.hasFocus()) return;
  const clientX = e.clientX;
  const clientY = e.clientY;

  // Transform to Game Space
  mouse.x = (clientX - offsetX) / scale;
  mouse.y = (clientY - offsetY) / scale;

  const now =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  mouseVelocityHistory.push({ x: mouse.x, y: mouse.y, time: now });

  while (
    mouseVelocityHistory.length > 1 &&
    now - mouseVelocityHistory[0].time > 100
  ) {
    mouseVelocityHistory.shift();
  }
}

function getMouseVelocity() {
  const now =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  while (
    mouseVelocityHistory.length > 1 &&
    now - mouseVelocityHistory[0].time > 100
  ) {
    mouseVelocityHistory.shift();
  }

  if (mouseVelocityHistory.length < 2) {
    return { vx: 0, vy: 0 };
  }

  const latest = mouseVelocityHistory[mouseVelocityHistory.length - 1];
  // If no mouse movement within the last 60ms, user stopped moving before release
  if (now - latest.time > 60) {
    return { vx: 0, vy: 0 };
  }

  // Find sample up to ~80ms ago for smooth velocity calculation
  let oldest = mouseVelocityHistory[0];
  for (let i = 0; i < mouseVelocityHistory.length - 1; i++) {
    if (latest.time - mouseVelocityHistory[i].time <= 80) {
      oldest = mouseVelocityHistory[i];
      break;
    }
  }

  const dt = (latest.time - oldest.time) / 1000.0;
  if (dt <= 0.005) {
    return { vx: 0, vy: 0 };
  }

  let vx = (latest.x - oldest.x) / dt;
  let vy = (latest.y - oldest.y) / dt;

  const MAX_SPEED = 2500;
  vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, vx));
  vy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, vy));

  return { vx, vy };
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
  if (e.button === 0) {
    updateMouse(e);
    mouse.down = false;
    if (typeof fluffies !== "undefined") {
      for (const f of fluffies) {
        if (f.isDragging && f.heldWithThrowTool) {
          f.onDrop();
        }
      }
    }
  }
  if (e.button === 2) mouse.rightDown = false;
});

window.addEventListener("blur", () => {
  mouse.down = false;
  mouse.rightDown = false;
  mouseVelocityHistory.length = 0;
  if (typeof fluffies !== "undefined") {
    for (const f of fluffies) {
      if (f.isDragging && f.heldWithThrowTool) {
        f.onDrop();
      }
    }
  }
});

window.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (showChatLog && typeof handleChatLogScroll === "function") {
    handleChatLogScroll(e.deltaY);
  }
  if (showSaveList && typeof handleSaveListScroll === "function") {
    handleSaveListScroll(e.deltaY);
  }
});

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

const puddles = []; // Puddle instances, created on demand by addPointToPuddle

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
      const now = Date.now();
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

  if (typeof gibs !== "undefined") {
    for (const gib of gibs) {
      if (gib.isDragging) {
        gib.scene = newScene;
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
      }
    }
  }

  currentScene = newScene;
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

  if (
    typeof isPlaceableWorldTool === "function" &&
    isPlaceableWorldTool(item)
  ) {
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

  // Cage assignment: assign item to cage if it's dropped inside one
  if (typeof objects !== "undefined") {
    // Exclusion list: grinders, tables, and cages themselves (cannot be in another cage)
    if (typeof Grinder !== "undefined" && item instanceof Grinder) {
      item.currentCage = null;
    } else if (typeof IVStand !== "undefined" && item instanceof IVStand) {
      item.currentCage = null;
    } else if (typeof IVBag !== "undefined" && item instanceof IVBag) {
      item.currentCage = null;
    } else if (
      typeof FluffyTable !== "undefined" &&
      item instanceof FluffyTable
    ) {
      item.currentCage = null;
    } else if (typeof Cage !== "undefined" && item instanceof Cage) {
      // Do nothing, cages (and cans) don't go inside other cages
    } else if (
      (typeof Knife !== "undefined" && item instanceof Knife) ||
      (typeof SutureKit !== "undefined" && item instanceof SutureKit) ||
      (typeof TrashBag !== "undefined" && item instanceof TrashBag) ||
      (typeof SorryStick !== "undefined" && item instanceof SorryStick) ||
      (typeof SprayBottle !== "undefined" && item instanceof SprayBottle) ||
      (typeof Sponge !== "undefined" && item instanceof Sponge) ||
      (typeof Brush !== "undefined" && item instanceof Brush) ||
      (typeof FoodBag !== "undefined" && item instanceof FoodBag) ||
      (typeof MagnifyingGlass !== "undefined" &&
        item instanceof MagnifyingGlass) ||
      (typeof Sprinkler !== "undefined" && item instanceof Sprinkler) ||
      (typeof Thumbtack !== "undefined" && item instanceof Thumbtack) ||
      (typeof Syringe !== "undefined" && item instanceof Syringe) ||
      (typeof CattleProd !== "undefined" && item instanceof CattleProd) ||
      (typeof Blowtorch !== "undefined" && item instanceof Blowtorch)
    ) {
      item.currentCage = null;
    } else {
      item.currentCage = null;
      const cages = objects.filter(
        (o) =>
          o instanceof Cage &&
          o.scene === item.scene &&
          o.acceptsDroppedItems(),
      );
      for (const cage of cages) {
        const b = cage.bounds;
        if (
          item.x > b.left &&
          item.x < b.right &&
          item.y > b.top &&
          item.y < b.bottom
        ) {
          if (cage.isCulling()) {
            // Sealed off: push the item out below the cage instead
            item.y = Math.min(height - 10, b.bottom + 10);
            break;
          }
          item.currentCage = cage;
          break;
        }
      }
    }
  }

  if (
    item.currentCage &&
    ((typeof Sponge !== "undefined" && item instanceof Sponge) ||
      (typeof SorryStick !== "undefined" && item instanceof SorryStick) ||
      (typeof SutureKit !== "undefined" && item instanceof SutureKit) ||
      (typeof TrashBag !== "undefined" && item instanceof TrashBag) ||
      (typeof Brush !== "undefined" && item instanceof Brush) ||
      (typeof Knife !== "undefined" && item instanceof Knife))
  ) {
    item.angle = 0;
  }

  const topWallHeight = height * 0.15;
  const groundYMin = topWallHeight + 50;

  if (typeof getScenePortals !== "undefined") {
    const portals = getScenePortals(item.scene);
    for (const p of portals) {
      if (p.locked) continue;
      if (isPointInRect(mouse.x, mouse.y, p.x, p.y, p.w, p.h)) {
        item.scene = p.target;
        if (p.type === "door") item.y = Math.max(item.y, groundYMin);
        if (p.type === "arrow_left") item.x = width - 100;
        if (p.type === "arrow_right") item.x = 100;
        if (p.type === "arrow_down") item.y = groundYMin + 20;
        if (p.type === "arrow_up") item.y = height - 120;
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

// bounds (optional): { left, right, top } limits for obj.x / obj.y instead of
// the screen edges. The floor is always obj.groundY.
function handleBouncingPhysics(obj, dt, bounds = null) {
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
    if (Math.abs(obj.vy) < 10) obj.vy = 0;
    if (Math.abs(obj.vx) < 10) obj.vx = 0;
  }

  // Wall Bouncing
  const margin = 20;
  const left = bounds ? bounds.left : margin;
  const right = bounds ? bounds.right : width - margin;
  if (obj.x < left) {
    obj.x = left;
    obj.vx = -obj.vx * 0.7;
  } else if (obj.x > right) {
    obj.x = right;
    obj.vx = -obj.vx * 0.7;
  }

  // Ceiling Bouncing
  if (bounds && bounds.top !== undefined && obj.y < bounds.top) {
    obj.y = bounds.top;
    if (obj.vy < 0) obj.vy = -obj.vy * 0.5;
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
  kibble: 3,
  rat_poison: 3,
  grass: 2,
  formula: 3,
  soylent_brown: 1,
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
const FIRE_DEATH_TIME = 15; // Seconds a fluffy survives being on fire
const FIRE_PARTICLE_INTERVAL = 0.08; // Seconds between orange fire puffs on a burning fluffy
const FIRE_PARTICLE_COLOR = "rgba(255, 120, 0, 0.75)";
const FIRE_SPREAD_DISTANCE = 70; // Fluffies this close (same cage) can catch fire
const FIRE_SPREAD_RATE = 1.0; // Chance per second (roughly) of catching it while that close
const BLOWTORCH_FLAME_LENGTH = 45; // px from nozzle to flame tip
const BLOWTORCH_NOZZLE_OFFSET_Y = 11; // Nozzle is this far down from the image's top-left
const BLOWTORCH_IGNITE_TIME = 0.3; // Seconds the flame must touch a fluffy to set it alight
const CATTLE_PROD_SMOKE_SPOT_RADIUS = 10; // Prod hits this close reuse the same smoke spot
const CATTLE_PROD_SMOKE_COLOR = "rgba(60, 60, 60, 0.5)"; // Dark grey translucent
const CATTLE_PROD_BASE_DAMAGE = 3.0;
const CATTLE_PROD_GROWTH_FACTOR_BASE = 3.0;

// Dream bubble
const DREAM_BUBBLE_ANIM_TIME = 0.4; // Seconds for the bubble to pop in or out
const DREAM_BUBBLE_PULSE_PERIOD = 3.2; // Seconds per in/out pulse while dreaming
const DREAM_BUBBLE_PULSE_AMOUNT = 0.07; // Pulse size as a fraction of bubble size
const DREAM_BUBBLE_REFERENCE_SCALE = 0.5; // Fluffy scale at which the bubble is drawn at 1x

// Cage
const CAGE_TAG_COLORS = {
  breeding: "#E91E63",
  sell: "#4CAF50",
  eject: "#FF9800",
  cull: "#607D8B",
};
const CAGE_FLOOR_OFFSET = 10; // How far above the cage's bottom edge caged fluffies stand
const CAGE_CLICK_THRESHOLD = 5; // Max mouse travel (px) for a press to count as a click
const CAGE_EJECT_OFFSET_Y = 30; // How far below the cage ejected contents land
const CAGE_GLASS_EXTEND_TIME = 2.5; // Seconds for glass pane to slide down
const CAGE_CULL_SEAL_DELAY = 12.0; // Seconds glass stays sealed before retracting
const CAGE_CULL_PANIC_TIME = 6.0; // Seconds into the seal that fluffies stop crying out
const CAGE_CULL_DEATH_TIME = 10.0; // Seconds into the seal that fluffies die
const CAGE_CULL_SPEECH_INTERVAL = 1.0; // Seconds between panicked lines
const CAGE_CULL_SMOKE_INTERVAL = 0.15; // Seconds between smoke bursts
const CAGE_CULL_SMOKE_COLOR = "rgba(200, 200, 200, 0.8)";
const CAGE_GLASS_RETRACT_TIME = 2.5; // Seconds for glass pane to slide back up

const THUMBTACK_COOLDOWN = 1.5;
const THUMBTACK_STEP_COOLDOWN = 1.5;
const HAPPINESS_PENALTY_BABBEH_GRABBED = -0.0125;
const HAPPINESS_PENALTY_BAD_UPSIES = -0.025;
const HAPPINESS_PENALTY_WITNESS_VIOLENCE = -0.00625;
const HAPPINESS_PENALTY_LOST_RELATIVE = -0.025;
const HAPPINESS_PENALTY_BARRIER_TALK = -0.02; // Mummah talking to her foal through a cage
const HAPPINESS_PENALTY_BARRIER_NURSE = -0.05; // Mummah unable to nurse her foal through a cage
const BARRIER_NURSE_DISTANCE = 150; // How close mummah gets before realising she can't reach
const BARRIER_NURSE_COOLDOWN = 8; // Seconds between failed nursing attempts
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
const MISCARRIAGE_LABOR_DELAY = 10; // Seconds from a miscarriage starting until labor
const PREMATURE_BIRTH_MIN_PROGRESS = 0.25; // Births earlier than this in a pregnancy leave no body

// Color Valuation Anchors
const POOPIE_ANCHORS = [
  [63, 31, 0], // Poopie Brown
  [31, 63, 0], // Drab Green
];

const MAX_COLOR_DIST = Math.sqrt(255 ** 2 + 255 ** 2 + 255 ** 2);

// How much a fluffy's colorist degree must exceed another's color score before
// it rejects them, so near-identical colors (e.g. a 1.0 mare and her 0.98
// foal) are tolerated
const COLORISM_SLACK = 0.05;

// Whether colorist rejects other because of other's body color
function fluffyColoristAgainstOtherFluffy(colorist, other) {
  if (typeof worldSettings === "undefined" || !worldSettings.colorism) {
    return false;
  }
  if (!colorist || !other || !other.genetics) return false;
  return (
    colorist.coloristDegree - other.genetics.calculateColorismPerception() >
    COLORISM_SLACK
  );
}

const DIAPER_CAPACITY = 2.0; // Excretion a diaper holds (a full poop or pee is 1)
const DIAPER_COMPLAIN_MIN_INTERVAL = 8; // Seconds between diaper complaints
const DIAPER_COMPLAIN_MAX_INTERVAL = 15;
const HAPPINESS_PENALTY_DIAPER_ITCH = -0.01; // Each time the diaper irritates them
const DIAPER_MATE_LINE_COOLDOWN = 10; // Seconds a diapered stallion waits before trying again

// Image for an accessory, accounting for e.g. a used or full diaper
function getAccessoryImageKey(accDef, data) {
  const fill = (data && data.fill) || 0;
  if (accDef.fullImageKey && fill >= DIAPER_CAPACITY) {
    return accDef.fullImageKey;
  }
  if (accDef.usedImageKey && fill > 0) return accDef.usedImageKey;
  return accDef.imageKey;
}

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
  diaper: {
    id: "diaper",
    name: "Diaper",
    cost: 1000,
    slot: "diaper",
    imageKey: "accessory_diaper",
    usedImageKey: "accessory_diaper_used", // Shown once partly filled
    fullImageKey: "accessory_diaper_full", // Shown once filled to DIAPER_CAPACITY
    canColor: false,
    layer: "OVER_BODY",
    offsetX: -55, // Over the rear of the torso
    offsetY: 5,
    scale: 1.0,
    descOverride:
      "Holds a certain amount of fluffy excrement but irritates the wearer.",
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
    name: "Soylent Brown",
    desc: "Cheapest food, fluffies hate it. Hover over a bowl/trough while holding the bag.",
    cost: 5,
    isItem: "food_bag",
    foodType: "soylent_brown",
    priority: 1,
  },
  {
    name: "Kibble",
    desc: "Bag of basic food. Hover over a bowl/trough while holding the bag.",
    cost: 25,
    isItem: "food_bag",
    foodType: "kibble",
    priority: 2,
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
    desc: "Fluffies love this junk. Hover over a bowl/trough while holding the bag.",
    cost: 300,
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
    desc: "Drop fluffies in to trap them inside the cage. Right click the cage to switch modes.\n\nBreeding mode allows forcibly breeding caged fluffies by sorry-sticking the stallion.\n\nSell mode will allow caged fluffies to be prioritized for sale offers.\n\nDouble clicking in eject mode will instantly remove all contents of the cage.\n\nDouble clicking in cull mode creates a vacuum in the cage which causes all fluffies inside to slowly and painfully suffocate.",
    cost: 150,
    isItem: "cage",
  },
  {
    name: "Enclosure",
    desc: "A roomy enclosure. Drop fluffies in to keep them inside. Unlike a cage, fluffies don't get sad from being kept in it.",
    cost: 5000,
    isItem: "enclosure",
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
    desc: "A vaccine against the toxoplasma gondii parasite, which is found in animal feces.",
    cost: 5000,
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
    name: "Blowtorch",
    desc: "Burns fluffies \u2014 fluffies can spread the fire to other fluffies as well.",
    cost: 5000,
    isItem: "blowtorch",
  },
  {
    name: "Bed",
    desc: "Fluffies will seek this out when sleeping. A couple will share a bed, and the second spot is reserved for the claimant's special friend.",
    cost: 75,
    isItem: "bed",
  },
  {
    name: "FluffTV",
    desc: "Can play programming to teach or torture your fluffies. Right click TV to change the channel.",
    cost: 2000,
    isItem: "fluff_tv",
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

const punishmentTools = ["SorryStick", "SprayBottle", "Thumbtack"];

function isPunishmentTool(o) {
  if (!o) return false;
  const name = o.constructor ? o.constructor.name : o.classType;
  if (punishmentTools.includes(name) || punishmentTools.includes(o.classType))
    return true;
  return (
    (typeof SorryStick !== "undefined" && o instanceof SorryStick) ||
    (typeof SprayBottle !== "undefined" && o instanceof SprayBottle) ||
    (typeof Thumbtack !== "undefined" && o instanceof Thumbtack)
  );
}

// While the thumbtack works as a stick, it shouldn't occupy the toolbar since it has a non-stick purpose as well
const punishmentToolsForToolbarPurposes = ["SorryStick", "SprayBottle"];

function isPunishmentToolForToolbarPurposes(o) {
  if (!o) return false;
  const name = o.constructor ? o.constructor.name : o.classType;
  if (
    punishmentToolsForToolbarPurposes.includes(name) ||
    punishmentToolsForToolbarPurposes.includes(o.classType)
  )
    return true;
  return (
    (typeof SorryStick !== "undefined" && o instanceof SorryStick) ||
    (typeof SprayBottle !== "undefined" && o instanceof SprayBottle)
  );
}

function isPlaceableWorldTool(obj) {
  if (!obj) return false;
  return (
    (typeof Thumbtack !== "undefined" && obj instanceof Thumbtack) ||
    (typeof IVBag !== "undefined" && obj instanceof IVBag)
  );
}

function isToolObject(obj) {
  if (!obj) return false;
  return (
    (typeof Sponge !== "undefined" && obj instanceof Sponge) ||
    (typeof Brush !== "undefined" && obj instanceof Brush) ||
    (typeof Knife !== "undefined" && obj instanceof Knife) ||
    (typeof SutureKit !== "undefined" && obj instanceof SutureKit) ||
    (typeof TrashBag !== "undefined" && obj instanceof TrashBag) ||
    (typeof SorryStick !== "undefined" && obj instanceof SorryStick) ||
    (typeof SprayBottle !== "undefined" && obj instanceof SprayBottle) ||
    (typeof MagnifyingGlass !== "undefined" &&
      obj instanceof MagnifyingGlass) ||
    (typeof Thumbtack !== "undefined" && obj instanceof Thumbtack) ||
    (typeof Syringe !== "undefined" && obj instanceof Syringe) ||
    (typeof CattleProd !== "undefined" && obj instanceof CattleProd) ||
    (typeof Blowtorch !== "undefined" && obj instanceof Blowtorch) ||
    (typeof ThrowTool !== "undefined" && obj instanceof ThrowTool) ||
    (typeof IVBag !== "undefined" && obj instanceof IVBag && !obj.attachedTo)
  );
}

function isToolData(oData) {
  if (!oData) return false;
  const type = oData.classType;
  if (
    [
      "Sponge",
      "Brush",
      "Knife",
      "SutureKit",
      "TrashBag",
      "SorryStick",
      "SprayBottle",
      "MagnifyingGlass",
      "Thumbtack",
      "Syringe",
      "CattleProd",
      "Blowtorch",
      "ThrowTool",
    ].includes(type)
  ) {
    return true;
  }
  if (type === "IVBag" && oData.attachedToId == null) {
    return true;
  }
  return false;
}

function isToolAction(action) {
  if (!action || !action.isItem) return false;
  return [
    "sponge",
    "brush",
    "sorry_stick",
    "spray_bottle",
    "magnifying_glass",
    "knife",
    "scalpel",
    "suture_kit",
    "trash_bag",
    "thumbtack",
    "syringe",
    "cattle_prod",
    "blowtorch",
    "iv_bag",
  ].includes(action.isItem);
}

function isMultiPurchaseToolAction(action) {
  if (!action || !action.isItem) return false;
  return (
    action.isItem === "iv_bag" ||
    action.isItem === "thumbtack" ||
    action.isItem === "suture_kit" ||
    action.isItem === "trash_bag"
  );
}

function isMultiPurchaseTool(tool) {
  if (!tool) return false;
  if (typeof IVBag !== "undefined" && tool instanceof IVBag) return true;
  if (typeof Thumbtack !== "undefined" && tool instanceof Thumbtack)
    return true;
  if (typeof SutureKit !== "undefined" && tool instanceof SutureKit)
    return true;
  if (typeof TrashBag !== "undefined" && tool instanceof TrashBag) return true;
  return false;
}

function getToolTypeKey(tool) {
  if (!tool) return null;
  if (typeof Sponge !== "undefined" && tool instanceof Sponge) return "sponge";
  if (typeof Brush !== "undefined" && tool instanceof Brush) return "brush";
  if (typeof SorryStick !== "undefined" && tool instanceof SorryStick)
    return "sorry_stick";
  if (typeof SprayBottle !== "undefined" && tool instanceof SprayBottle)
    return "spray_bottle";
  if (typeof MagnifyingGlass !== "undefined" && tool instanceof MagnifyingGlass)
    return "magnifying_glass";
  if (typeof Knife !== "undefined" && tool instanceof Knife) {
    return tool.type === "scalpel" ? "scalpel" : "knife";
  }
  if (typeof SutureKit !== "undefined" && tool instanceof SutureKit)
    return "suture_kit";
  if (typeof TrashBag !== "undefined" && tool instanceof TrashBag)
    return "trash_bag";
  if (typeof Thumbtack !== "undefined" && tool instanceof Thumbtack)
    return "thumbtack";
  if (typeof Syringe !== "undefined" && tool instanceof Syringe)
    return "syringe";
  if (typeof CattleProd !== "undefined" && tool instanceof CattleProd)
    return "cattle_prod";
  if (typeof Blowtorch !== "undefined" && tool instanceof Blowtorch)
    return "blowtorch";
  if (typeof ThrowTool !== "undefined" && tool instanceof ThrowTool)
    return "throw_tool";
  if (typeof IVBag !== "undefined" && tool instanceof IVBag) {
    return "iv_bag_" + (tool.type || "tpn");
  }
  return tool.classType || tool.constructor?.name || null;
}

function matchesToolAction(tool, action) {
  if (!tool || !action) return false;
  switch (action.isItem) {
    case "sponge":
      return typeof Sponge !== "undefined" && tool instanceof Sponge;
    case "brush":
      return typeof Brush !== "undefined" && tool instanceof Brush;
    case "sorry_stick":
      return typeof SorryStick !== "undefined" && tool instanceof SorryStick;
    case "spray_bottle":
      return typeof SprayBottle !== "undefined" && tool instanceof SprayBottle;
    case "magnifying_glass":
      return (
        typeof MagnifyingGlass !== "undefined" &&
        tool instanceof MagnifyingGlass
      );
    case "knife":
      return (
        typeof Knife !== "undefined" &&
        tool instanceof Knife &&
        tool.type === "knife"
      );
    case "scalpel":
      return (
        typeof Knife !== "undefined" &&
        tool instanceof Knife &&
        tool.type === "scalpel"
      );
    case "suture_kit":
      return typeof SutureKit !== "undefined" && tool instanceof SutureKit;
    case "trash_bag":
      return typeof TrashBag !== "undefined" && tool instanceof TrashBag;
    case "thumbtack":
      return typeof Thumbtack !== "undefined" && tool instanceof Thumbtack;
    case "syringe":
      return typeof Syringe !== "undefined" && tool instanceof Syringe;
    case "cattle_prod":
      return typeof CattleProd !== "undefined" && tool instanceof CattleProd;
    case "blowtorch":
      return typeof Blowtorch !== "undefined" && tool instanceof Blowtorch;
    case "iv_bag":
      return (
        typeof IVBag !== "undefined" &&
        tool instanceof IVBag &&
        tool.type === action.bagType
      );
    default:
      return false;
  }
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

function createToolFromAction(action) {
  const scene = typeof currentScene !== "undefined" ? currentScene : "INDOORS";
  switch (action.isItem) {
    case "sponge":
      return new Sponge(scene);
    case "brush":
      return new Brush(scene);
    case "sorry_stick":
      return new SorryStick(scene);
    case "spray_bottle":
      return new SprayBottle(scene);
    case "magnifying_glass":
      return new MagnifyingGlass(scene);
    case "knife":
      return new Knife("knife", scene);
    case "scalpel":
      return new Knife("scalpel", scene);
    case "suture_kit":
      return new SutureKit(scene);
    case "trash_bag":
      return new TrashBag(scene);
    case "thumbtack":
      return new Thumbtack(scene);
    case "syringe":
      return new Syringe(scene);
    case "cattle_prod":
      return new CattleProd(scene);
    case "blowtorch":
      return new Blowtorch(scene);
    case "iv_bag":
      return new IVBag(scene, action.bagType);
    default:
      return null;
  }
}

function createToolFromData(oData) {
  if (!oData) return null;
  const type = oData.classType;
  const scene =
    oData.scene ||
    (typeof currentScene !== "undefined" ? currentScene : "INDOORS");
  let tool = null;
  switch (type) {
    case "Sponge":
      tool = new Sponge(scene);
      break;
    case "Brush":
      tool = new Brush(scene);
      break;
    case "SorryStick":
      tool = new SorryStick(scene);
      break;
    case "SprayBottle":
      tool = new SprayBottle(scene);
      break;
    case "MagnifyingGlass":
      tool = new MagnifyingGlass(scene);
      break;
    case "Knife":
      tool = new Knife(oData.type || "knife", scene);
      break;
    case "SutureKit":
      tool = new SutureKit(scene);
      break;
    case "TrashBag":
      tool = new TrashBag(scene);
      break;
    case "Thumbtack":
      tool = new Thumbtack(scene);
      break;
    case "Syringe":
      tool = new Syringe(scene);
      break;
    case "CattleProd":
      tool = new CattleProd(scene);
      break;
    case "Blowtorch":
      tool = new Blowtorch(scene);
      break;
    case "ThrowTool":
      tool = new ThrowTool(scene);
      break;
    case "IVBag":
      tool = new IVBag(scene, oData.type || "tpn");
      break;
    default:
      return null;
  }
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

function ensureThrowToolPrepended() {
  if (typeof toolbox === "undefined" || !Array.isArray(toolbox)) return;
  if (typeof ThrowTool === "undefined") return;
  const idx = toolbox.findIndex((t) => t instanceof ThrowTool);
  if (idx > 0) {
    const [tool] = toolbox.splice(idx, 1);
    toolbox.unshift(tool);
  } else if (idx === -1) {
    toolbox.unshift(new ThrowTool());
  }
}

function getGroupedToolboxEntries() {
  ensureThrowToolPrepended();
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

  const throwIdx = entries.findIndex(
    (e) =>
      e.key === "throw_tool" ||
      (typeof ThrowTool !== "undefined" && e.tool instanceof ThrowTool),
  );
  if (throwIdx > 0) {
    const [throwEntry] = entries.splice(throwIdx, 1);
    entries.unshift(throwEntry);
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
    if (typeof ThrowTool !== "undefined" && tool instanceof ThrowTool) {
      toolbox.unshift(tool);
    } else {
      toolbox.push(tool);
    }
  }
  if (typeof ensureThrowToolPrepended === "function") {
    ensureThrowToolPrepended();
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
  const grabbedFluffy = fluffies.find((f) => f.isDragging);
  if (grabbedFluffy) {
    grabbedFluffy.onDrop();
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
  if (tool.heldHorse) {
    const h = tool.heldHorse;
    tool.heldHorse = null;
    if (typeof h.onDrop === "function") {
      h.onDrop();
    }
  }
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
        if (o.heldHorse) {
          const h = o.heldHorse;
          o.heldHorse = null;
          if (typeof h.onDrop === "function") {
            h.onDrop();
          }
        }
        o.isDragging = false;
        objects.splice(i, 1);
      }
    }
  }
  if (typeof isGlobalDragging !== "undefined") {
    isGlobalDragging = false;
  }
}

function getToolName(tool) {
  if (!tool) return "";
  if (typeof Sponge !== "undefined" && tool instanceof Sponge) return "Sponge";
  if (typeof Brush !== "undefined" && tool instanceof Brush) return "Brush";
  if (typeof SorryStick !== "undefined" && tool instanceof SorryStick)
    return "Stick";
  if (typeof SprayBottle !== "undefined" && tool instanceof SprayBottle)
    return "Spray";
  if (typeof Thumbtack !== "undefined" && tool instanceof Thumbtack)
    return "Tack";
  if (typeof MagnifyingGlass !== "undefined" && tool instanceof MagnifyingGlass)
    return "Glass";
  if (typeof Knife !== "undefined" && tool instanceof Knife) {
    return tool.type === "scalpel" ? "Scalpel" : "Knife";
  }
  if (typeof SutureKit !== "undefined" && tool instanceof SutureKit)
    return "Suture";
  if (typeof TrashBag !== "undefined" && tool instanceof TrashBag)
    return "Trash";
  if (typeof Syringe !== "undefined" && tool instanceof Syringe)
    return "Syringe";
  if (typeof CattleProd !== "undefined" && tool instanceof CattleProd)
    return "Prod";
  if (typeof Blowtorch !== "undefined" && tool instanceof Blowtorch)
    return "Torch";
  if (typeof ThrowTool !== "undefined" && tool instanceof ThrowTool)
    return "Throw";
  if (typeof IVBag !== "undefined" && tool instanceof IVBag) {
    return (tool.type || "tpn").toUpperCase();
  }
  return tool.name || "Tool";
}

function getToolFullName(tool) {
  if (!tool) return "";
  if (typeof Sponge !== "undefined" && tool instanceof Sponge) return "Sponge";
  if (typeof Brush !== "undefined" && tool instanceof Brush) return "Brush";
  if (typeof SorryStick !== "undefined" && tool instanceof SorryStick)
    return "Sorry stick";
  if (typeof SprayBottle !== "undefined" && tool instanceof SprayBottle)
    return "Spray bottle";
  if (typeof Thumbtack !== "undefined" && tool instanceof Thumbtack)
    return "Thumbtack";
  if (typeof MagnifyingGlass !== "undefined" && tool instanceof MagnifyingGlass)
    return "Magnifying glass";
  if (typeof Knife !== "undefined" && tool instanceof Knife) {
    return tool.type === "scalpel" ? "Scalpel" : "Knife";
  }
  if (typeof SutureKit !== "undefined" && tool instanceof SutureKit) {
    return `Suture kit (${tool.usesLeft ?? 4} uses left)`;
  }
  if (typeof TrashBag !== "undefined" && tool instanceof TrashBag) {
    const count = tool.items ? tool.items.length : 0;
    return `Trash bag (${count} items)`;
  }
  if (typeof Syringe !== "undefined" && tool instanceof Syringe) {
    return tool.fluidType
      ? `Syringe (${tool.fluidType.toUpperCase()}: ${Math.round(tool.fluidAmount)}u)`
      : "Syringe (empty)";
  }
  if (typeof CattleProd !== "undefined" && tool instanceof CattleProd)
    return "Cattle prod";
  if (typeof Blowtorch !== "undefined" && tool instanceof Blowtorch)
    return "Blowtorch";
  if (typeof ThrowTool !== "undefined" && tool instanceof ThrowTool)
    return "Throw tool";
  if (typeof IVBag !== "undefined" && tool instanceof IVBag) {
    return `IV bag (${(tool.type || "tpn").toUpperCase()})`;
  }
  return tool.name || "Tool";
}

function getToolDesc(tool) {
  if (!tool) return "";
  if (typeof Sponge !== "undefined" && tool instanceof Sponge)
    return "Clean messes by holding this over them.";
  if (typeof Brush !== "undefined" && tool instanceof Brush)
    return "Brush fluffies to reward them for good behavior.";
  if (typeof SorryStick !== "undefined" && tool instanceof SorryStick)
    return "Click fluffies with it to whack them.";
  if (typeof SprayBottle !== "undefined" && tool instanceof SprayBottle)
    return "Spray fluffies to discipline them.";
  if (typeof Thumbtack !== "undefined" && tool instanceof Thumbtack)
    return "Can poke fluffies causing pain and minor bleeding.";
  if (typeof MagnifyingGlass !== "undefined" && tool instanceof MagnifyingGlass)
    return "Click on a fluffy to inspect and rename.";
  if (typeof Knife !== "undefined" && tool instanceof Knife) {
    return tool.type === "scalpel"
      ? "Medical amputation without bleeding."
      : "Used for amputation.";
  }
  if (typeof SutureKit !== "undefined" && tool instanceof SutureKit)
    return `Stops blood loss in amputated fluffies. ${tool.usesLeft ?? 4} uses left.`;
  if (typeof TrashBag !== "undefined" && tool instanceof TrashBag)
    return "Auto-picks up corpses/parts. Drop into grinder to dispose.";
  if (typeof Syringe !== "undefined" && tool instanceof Syringe)
    return "Click an IV bag to draw fluid, click fluffy to inject.";
  if (typeof CattleProd !== "undefined" && tool instanceof CattleProd)
    return "Electrocutes fluffies while grabbed and holding mouse down.";
  if (typeof Blowtorch !== "undefined" && tool instanceof Blowtorch)
    return "Hold mouse down to fire. Hold the flame on a fluffy to set it alight. Lit fluffies can be extinguished with the spray bottle, river, or sprinkler.";
  if (typeof ThrowTool !== "undefined" && tool instanceof ThrowTool)
    return "Drag fluffies with this tool to lift them up and release to throw.";
  if (typeof IVBag !== "undefined" && tool instanceof IVBag)
    return `Bag of ${(tool.type || "tpn").toUpperCase()} solution for IV stand delivery.`;
  return "";
}

function isDrawableImage(img) {
  if (!img) return false;
  if (
    (typeof HTMLCanvasElement !== "undefined" &&
      img instanceof HTMLCanvasElement) ||
    (typeof OffscreenCanvas !== "undefined" &&
      img instanceof OffscreenCanvas) ||
    (img.getContext && typeof img.getContext === "function")
  ) {
    return img.width > 0 && img.height > 0;
  }
  return !!(
    img.complete &&
    (img.naturalWidth === undefined || img.naturalWidth > 0)
  );
}

function getToolImage(tool) {
  if (!tool || typeof images === "undefined") return null;
  if (typeof Sponge !== "undefined" && tool instanceof Sponge)
    return images.sponge;
  if (typeof Brush !== "undefined" && tool instanceof Brush)
    return images.brush;
  if (typeof SorryStick !== "undefined" && tool instanceof SorryStick)
    return images.sorry_stick;
  if (typeof SprayBottle !== "undefined" && tool instanceof SprayBottle)
    return images.spray_bottle;
  if (typeof Thumbtack !== "undefined" && tool instanceof Thumbtack)
    return images.thumbtack;
  if (typeof MagnifyingGlass !== "undefined" && tool instanceof MagnifyingGlass)
    return images.magnifying_glass;
  if (typeof Knife !== "undefined" && tool instanceof Knife)
    return images[tool.type] || images.knife;
  if (typeof SutureKit !== "undefined" && tool instanceof SutureKit)
    return images.suture_kit;
  if (typeof TrashBag !== "undefined" && tool instanceof TrashBag) {
    return typeof tool.getCurrentImage === "function"
      ? tool.getCurrentImage()
      : images.trash_bag_empty;
  }
  if (typeof Syringe !== "undefined" && tool instanceof Syringe)
    return images.syringe;
  if (typeof CattleProd !== "undefined" && tool instanceof CattleProd)
    return images.cattle_prod;
  if (typeof Blowtorch !== "undefined" && tool instanceof Blowtorch)
    return images.blowtorch;
  if (typeof ThrowTool !== "undefined" && tool instanceof ThrowTool) {
    return images.throw_tool_unheld;
  }
  if (typeof IVBag !== "undefined" && tool instanceof IVBag) {
    if (tool.tintedSprite && tool.tintedSprite.width > 0)
      return tool.tintedSprite;
    if (typeof tool.createTintedSprite === "function") {
      tool.createTintedSprite();
      if (tool.tintedSprite && tool.tintedSprite.width > 0)
        return tool.tintedSprite;
    }
    return images.iv_bag;
  }
  return null;
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
  const preferredKeys = [
    {
      key: "1",
      check: (t) => typeof Sponge !== "undefined" && t instanceof Sponge,
    },
    {
      key: "2",
      check: (t) => typeof Brush !== "undefined" && t instanceof Brush,
    },
    {
      key: "3",
      check: (t) =>
        (typeof SorryStick !== "undefined" && t instanceof SorryStick) ||
        (typeof SprayBottle !== "undefined" && t instanceof SprayBottle) ||
        (typeof Thumbtack !== "undefined" && t instanceof Thumbtack),
    },
    {
      key: "4",
      check: (t) =>
        typeof MagnifyingGlass !== "undefined" && t instanceof MagnifyingGlass,
    },
    {
      key: "5",
      check: (t) =>
        typeof Knife !== "undefined" &&
        t instanceof Knife &&
        t.type === "knife",
    },
    {
      key: "6",
      check: (t) => typeof SutureKit !== "undefined" && t instanceof SutureKit,
    },
    {
      key: "7",
      check: (t) => typeof TrashBag !== "undefined" && t instanceof TrashBag,
    },
    {
      key: "8",
      check: (t) =>
        typeof Knife !== "undefined" &&
        t instanceof Knife &&
        t.type === "scalpel",
    },
    {
      key: "9",
      check: (t) => typeof Syringe !== "undefined" && t instanceof Syringe,
    },
    {
      key: "0",
      check: (t) =>
        typeof CattleProd !== "undefined" && t instanceof CattleProd,
    },
  ];
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

const TOOL_SLOTS = [
  {
    key: "1",
    check: (o) => o instanceof Sponge,
    getImage: () => images.sponge,
    name: "Sponge",
  },
  {
    key: "2",
    check: (o) => o instanceof Brush,
    getImage: () => images.brush,
    name: "Brush",
  },
  {
    key: "3",
    check: (o) => isPunishmentToolForToolbarPurposes(o),
    getImage: (o) => {
      if (typeof Thumbtack !== "undefined" && o instanceof Thumbtack)
        return images.thumbtack;
      if (typeof SprayBottle !== "undefined" && o instanceof SprayBottle)
        return images.spray_bottle;
      if (typeof SorryStick !== "undefined" && o instanceof SorryStick)
        return images.sorry_stick;
      if (typeof objects !== "undefined") {
        const found = objects.find((x) => isPunishmentTool(x));
        if (typeof Thumbtack !== "undefined" && found instanceof Thumbtack)
          return images.thumbtack;
        if (typeof SprayBottle !== "undefined" && found instanceof SprayBottle)
          return images.spray_bottle;
      }
      return images.sorry_stick;
    },
    name: "Discipline",
  },
  {
    key: "4",
    check: (o) => o instanceof MagnifyingGlass,
    getImage: () => images.magnifying_glass,
    name: "Glass",
  },
  {
    key: "5",
    check: (o) =>
      o instanceof Knife &&
      (o.type === "scalpel" ||
        !objects.some((x) => x instanceof Knife && x.type === "scalpel")),
    getImage: (o) => images[o.type],
    name: "Knife",
  },
  {
    key: "6",
    check: (o) => o instanceof SutureKit,
    getImage: () => images.suture_kit,
    name: "Suture",
  },
  {
    key: "7",
    check: (o) => typeof TrashBag !== "undefined" && o instanceof TrashBag,
    getImage: (o) =>
      o && o.getCurrentImage ? o.getCurrentImage() : images.trash_bag_empty,
    name: "Bag",
  },
  {
    key: "8",
    check: (o) =>
      o instanceof Knife &&
      o.type === "knife" &&
      objects.some((x) => x instanceof Knife && x.type === "scalpel"),
    getImage: (o) => images[o.type],
    name: "Knife",
  },
  {
    key: "9",
    check: (o) => typeof Syringe !== "undefined" && o instanceof Syringe,
    getImage: () => images.syringe,
    name: "Syringe",
  },
];

let grabbedToolIDs = [];
let grabbedToolSlotKey = null;

function handleToolbarToolGrab(slot) {
  if (typeof objects === "undefined") return;

  const allInstances = objects.filter((o) => slot.check(o));
  if (allInstances.length === 0) return;

  // Don't hijack while carrying a fluffy
  if (typeof fluffies !== "undefined" && fluffies.some((f) => f.isDragging))
    return;

  // Reset if a different kind of tool is grabbed
  if (grabbedToolSlotKey !== slot.key) {
    grabbedToolSlotKey = slot.key;
    grabbedToolIDs = [];
  }

  // If only 1 instance exists total and we are currently dragging it, drop it (toggle behavior)
  if (allInstances.length === 1 && allInstances[0].isDragging) {
    allInstances[0].onDrop();
    if (typeof isGlobalDragging !== "undefined") isGlobalDragging = false;
    grabbedToolIDs = [];
    return;
  }

  // Check for a different instance via list (prefer current scene, then any scene)
  let nextTool =
    allInstances.find(
      (o) => !grabbedToolIDs.includes(o.id) && o.scene === currentScene,
    ) || allInstances.find((o) => !grabbedToolIDs.includes(o.id));

  // If there are no instances left in the list, empty the list and start over
  if (!nextTool) {
    grabbedToolIDs = [];
    nextTool =
      allInstances.find((o) => o.scene === currentScene) || allInstances[0];
  }

  if (nextTool) {
    // Drop whatever tool or object is currently held
    const held = objects.find((o) => o.isDragging);
    if (held) {
      held.onDrop();
    }

    nextTool.isDragging = true;
    nextTool.dragOffset = { x: 0, y: 0 };
    nextTool.scene = currentScene;
    if (typeof isGlobalDragging !== "undefined") isGlobalDragging = true;

    // Populate list with ID of tool when grabbed
    if (!grabbedToolIDs.includes(nextTool.id)) {
      grabbedToolIDs.push(nextTool.id);
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

// Fluffy Shadow Constants
const HORSE_SHADOW_BASE_RADIUS_X = 90.0;
const HORSE_SHADOW_BASE_RADIUS_Y = 30.0;
const HORSE_SHADOW_ALPHA = 0.25;

// Throw Tool Constants
const THROW_IMPACT_DAMAGE_FACTOR = 0.04;
const THROW_IMPACT_MIN_SPEED = 500.0;
const THROW_HIGH_ALTITUDE_THRESHOLD = 150.0;

function resetGameState(customWorldSettings = null) {
  if (
    customWorldSettings &&
    typeof WorldSettings !== "undefined" &&
    customWorldSettings instanceof WorldSettings
  ) {
    worldSettings = customWorldSettings;
  }

  // 1. Core progression & economy
  money = typeof STARTING_MONEY !== "undefined" ? STARTING_MONEY : 250;
  timePlayed = 0;
  nextFluffyId = 0;
  nextObjectId = 0;
  unlockedRoomsL = 0;
  unlockedRoomsR = 0;
  roomsPurchased = 0;
  currentScene = "INDOORS";

  // 2. Backyard & fence states
  backyardFenceTier = 0;
  backyardFenceBroken = false;
  backyardFenceBreakTimer = 120.0;
  backyardInvasionTimer = 60.0;
  nextHerdId = 1;

  // 3. Timers & world simulation states
  if (typeof sellRequestAverage !== "undefined") {
    sellRequestTimer = sellRequestAverage;
  } else if (typeof sellRequestTimer !== "undefined") {
    sellRequestTimer = 120.0;
  }
  if (typeof feralTimer !== "undefined") feralTimer = 0;
  if (typeof feralDespawnTimer !== "undefined") feralDespawnTimer = 30.0;
  if (typeof tutorialTimer !== "undefined") tutorialTimer = 10.0;
  alleyBoxSpawnTimer = 60.0;
  carSpawnTimer = 0;
  sceneGrassSpawnTimers = {
    RIVER: 15.0,
    OUTDOORS: 15.0,
    BACKYARD: 15.0,
  };

  // 4. Dialogue, chat logs, & relationships
  fluffyNames = {};
  relationships = {};
  sceneChatLogs = {};
  showChatLog = false;
  chatLogScrollOffset = 0;
  chatLogAutoScroll = true;
  if (
    typeof recentOutdoorDialogue !== "undefined" &&
    Array.isArray(recentOutdoorDialogue)
  ) {
    recentOutdoorDialogue.length = 0;
  }

  // 5. Clear active sound loops from existing objects/tools before wiping
  const allExistingItems = [
    ...(typeof objects !== "undefined" && Array.isArray(objects)
      ? objects
      : []),
    ...(typeof toolbox !== "undefined" && Array.isArray(toolbox)
      ? toolbox
      : []),
  ];
  for (const item of allExistingItems) {
    if (item && typeof item.stopTaserSound === "function") {
      item.stopTaserSound();
    }
  }

  // 6. Clear entity & object collections
  fluffies.length = 0;
  objects.length = 0;
  gibs.length = 0;
  puddles.length = 0;
  poofs.length = 0;
  cars.length = 0;
  waterRipples.length = 0;
  rippleTimer = 0;

  // 7. Toolbox, toolbar, and dragging state
  if (typeof toolbox !== "undefined") {
    toolbox.length = 0;
    if (typeof ThrowTool !== "undefined") {
      toolbox.unshift(new ThrowTool());
    }
    if (typeof ensureThrowToolPrepended === "function") {
      ensureThrowToolPrepended();
    }
  }
  toolboxPage = 0;
  showToolbox = true;
  showToolbar = true;
  hoveredToolboxItem = null;
  if (typeof toolbarSlots !== "undefined" && Array.isArray(toolbarSlots)) {
    for (const slot of toolbarSlots) {
      slot.tool = null;
    }
  }
  if (typeof initDefaultToolbar === "function") {
    initDefaultToolbar();
  }
  if (typeof grabbedToolIDs !== "undefined" && Array.isArray(grabbedToolIDs)) {
    grabbedToolIDs.length = 0;
  }
  grabbedToolSlotKey = null;
  isGlobalDragging = false;

  // 8. Day Care state
  dayCareFluffies = [];
  dayCareFeeTimer = 60.0;
  dayCareModalOpen = false;
  dayCareBroughtPage = 0;
  dayCareStoredPage = 0;

  // 9. UI, inspector, pause screenshot, and messages
  currentSellRequest = null;
  if (typeof inspectedFluffy !== "undefined") {
    inspectedFluffy = null;
  }
  currentPauseScreenshot = null;
  doorMessages.length = 0;
  uiMessages.length = 0;
  debugMessages.length = 0;
  debugWatchedFluffyId = null;
  debugPairFirst = null;
  if (typeof debugActionHistory !== "undefined") {
    for (const k in debugActionHistory) {
      delete debugActionHistory[k];
    }
  }
  itemMenuFilter = "";
  itemMenuPage = 0;
  isShiftPressed = false;
  shiftSellBlocked = false;
  if (typeof mouse !== "undefined") {
    mouse.down = false;
    mouse.rightDown = false;
  }

  // 10. Default stationary scene objects
  if (typeof FoalVendor !== "undefined") {
    objects.push(new FoalVendor("ALLEY"));
  }
  if (typeof DayCareDesk !== "undefined") {
    objects.push(new DayCareDesk("DAY_CARE"));
  }

  // 11. Initial grasses per grassy scene
  if (typeof SCENES !== "undefined" && typeof Grass !== "undefined") {
    for (const sceneKey in SCENES) {
      const config = SCENES[sceneKey];
      if (config && config.isGrassy) {
        for (let i = 0; i < 100; i++) {
          const x = 50 + Math.random() * (width - 100);
          const y = height * 0.15 + 50 + Math.random() * (height * 0.85 - 100);
          const growth = 0.5 + Math.random() * 1.5;

          let spawnX = x;
          if (
            config.hasRiver &&
            typeof images !== "undefined" &&
            images.grass
          ) {
            spawnX =
              width * 0.25 +
              images.grass.width +
              Math.random() * (width * 0.75 - 100);
          }

          const grass = new Grass(spawnX, y, config.id, growth);
          objects.push(grass);
          if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
            poofs.push(new Poof(spawnX, y, config.id, "green"));
          }
        }
      }
    }
  }
}

if (typeof window !== "undefined") {
  window.resetGameState = resetGameState;
}
