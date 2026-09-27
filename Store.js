// ---------------------------------------------------------------------------
// Fluff Mart: the store on Shopping Street.
//
// Garden --(down arrow)--> Shopping Street --(door)--> the store's aisles.
// Every aisle is its own scene ("STORE_FOOD", "STORE_HOME", ...) with
// arrows between them. Things sit on shelves with price tags; click one to
// buy it. World items land on the floor in front of the shelf for you to
// carry home; tools go straight into your toolbox. (buyShopAction in UI.js
// does the actual buying, the same code the debug item menu uses.)
//
// To put a shop item in an aisle, add its `isItem` (from SPAWN_ACTIONS in
// globals.js) to that aisle's `items` list below. Anything not listed shows
// up in an extra "Odds & Ends" aisle, so nothing ever goes missing.
// ---------------------------------------------------------------------------

const FLUFF_MART_NAME = "Fluff Mart";

const STORE_AISLES = [
  {
    id: "food",
    name: "Food & Feeding",
    items: ["food_bag", "bowl", "trough", "feeder", "mega_feeder"],
  },
  {
    id: "home",
    name: "Home & Play",
    items: [
      "bed",
      "litterbox",
      "litterpal_box",
      "cage",
      "fence",
      "fence_gate",
      "sprinkler",
      "ball",
      "block",
      "fluff_tv",
      "golden_statue",
    ],
  },
  {
    id: "care",
    name: "Care & Cleaning",
    items: [
      "magnifying_glass",
      "brush",
      "sponge",
      "spray_bottle",
      "trash_bag",
      "suture_kit",
    ],
  },
  {
    id: "pharmacy",
    name: "Pharmacy",
    items: ["iv_stand", "iv_bag", "syringe"],
  },
  {
    id: "hardware",
    name: "Hardware & Discipline",
    items: [
      "sorry_stick",
      "thumbtack",
      "knife",
      "cattle_prod",
      "scalpel",
      "immobilization_board",
      "operating_table",
      "grinder",
    ],
  },
  {
    id: "fashion",
    name: "Fashion",
    items: ["accessory"],
  },
];

// ---- Aisles and their contents ----

let _storeAislesCache = null;

// The aisles with their shop entries filled in: [{ id, name, scene, actions }]
function getStoreAisles() {
  if (_storeAislesCache && _storeAislesCache.count === SPAWN_ACTIONS.length)
    return _storeAislesCache.aisles;

  const aisles = STORE_AISLES.map((a) => ({
    id: a.id,
    name: a.name,
    scene: "STORE_" + a.id.toUpperCase(),
    actions: SPAWN_ACTIONS.filter((act) => a.items.includes(act.isItem)),
  }));
  const listed = new Set(STORE_AISLES.flatMap((a) => a.items));
  const leftovers = SPAWN_ACTIONS.filter((act) => !listed.has(act.isItem));
  if (leftovers.length > 0) {
    aisles.push({
      id: "misc",
      name: "Odds & Ends",
      scene: "STORE_MISC",
      actions: leftovers,
    });
  }
  _storeAislesCache = { count: SPAWN_ACTIONS.length, aisles };
  return aisles;
}

function isStoreScene(scene) {
  return typeof scene === "string" && scene.startsWith("STORE_");
}

function getStoreAisleForScene(scene) {
  return getStoreAisles().find((a) => a.scene === scene) || null;
}

// Which aisle sells this shop entry
function getStoreAisleForAction(action) {
  return getStoreAisles().find((a) => a.actions.includes(action)) || null;
}

// ---- Scenes ----

SCENES.SHOP_STREET = {
  id: "SHOP_STREET",
  isIndoor: false,
  insidePlayerQuarters: false,
  isOutdoor: true,
  isGrassy: false,
  isAlley: false,
  isAdoptionRoom: false,
  hasRiver: false,
  backgroundTexture: "texture_concrete",
  topWallColor: "#8a4032", // the store's brick front
  spawnFerals: false,
  isShopStreet: true,
};

for (const aisle of getStoreAisles()) {
  SCENES[aisle.scene] = {
    id: aisle.scene,
    isIndoor: true,
    insidePlayerQuarters: false,
    isOutdoor: false,
    isGrassy: false,
    isAlley: false,
    isAdoptionRoom: false,
    hasRiver: false,
    backgroundTexture: "texture_concrete",
    topWallColor: "#e9e1cf",
    spawnFerals: false,
    isStore: true,
  };
}

// Arrows and doors (called from getScenePortals in UI.js).
// Returns null for scenes that aren't part of the store.
function getStorePortals(scene) {
  if (scene === "SHOP_STREET") {
    return [
      {
        type: "arrow_up",
        x: width - 100,
        y: 20,
        w: 80,
        h: 60,
        target: "OUTDOORS",
        label: "Back to Garden",
      },
      {
        type: "door",
        x: doorRect.x,
        y: doorRect.y,
        w: doorRect.w,
        h: doorRect.h,
        target: getStoreAisles()[0].scene,
        label: `Enter ${FLUFF_MART_NAME}`,
      },
    ];
  }

  if (!isStoreScene(scene)) return null;
  const aisles = getStoreAisles();
  const i = aisles.findIndex((a) => a.scene === scene);
  if (i < 0) return null;

  const portals = [];
  if (i > 0) {
    portals.push({
      type: "arrow_left",
      x: 20,
      y: height / 2 - 40,
      w: 60,
      h: 80,
      target: aisles[i - 1].scene,
      label: `To aisle ${i}: ${aisles[i - 1].name}`,
    });
  }
  if (i < aisles.length - 1) {
    portals.push({
      type: "arrow_right",
      x: width - 80,
      y: height / 2 - 40,
      w: 60,
      h: 80,
      target: aisles[i + 1].scene,
      label: `To aisle ${i + 2}: ${aisles[i + 1].name}`,
    });
  }
  portals.push({
    type: "arrow_down",
    x: width / 2 - 40,
    y: height - 80,
    w: 80,
    h: 60,
    target: "SHOP_STREET",
    label: "Exit to Shopping Street",
  });
  return portals;
}

// ---- Shelf layout ----

// Where every item sits in an aisle. Each slot:
//   { action, x, y, w, h (click area), iconX, iconY, iconW, iconH, plankY }
function getStoreShelfLayout(aisle) {
  const topWall = height * 0.15;
  const left = 110;
  const right = width - 110;
  const unitTop = topWall + 14;
  const rows = 3;
  const rowH = clamp((height * 0.42) / rows, 80, 115);
  const n = aisle.actions.length;
  const cols = Math.max(4, Math.ceil(n / rows));
  const slotW = (right - left) / cols;

  const slots = aisle.actions.map((action, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = left + col * slotW;
    const y = unitTop + row * rowH;
    return {
      action,
      x,
      y,
      w: slotW,
      h: rowH,
      iconX: x + slotW / 2,
      iconY: y + rowH * 0.36,
      iconW: Math.min(slotW * 0.7, 150),
      iconH: rowH * 0.5,
      plankY: y + rowH * 0.62,
    };
  });

  return {
    left,
    right,
    unitTop,
    rows,
    rowH,
    unitBottom: unitTop + rows * rowH + 6,
    slots,
  };
}

function getStoreSlotAt(scene, px, py) {
  const aisle = getStoreAisleForScene(scene);
  if (!aisle) return null;
  const layout = getStoreShelfLayout(aisle);
  return (
    layout.slots.find((s) =>
      isPointInRect(px, py, s.x + 4, s.y + 4, s.w - 8, s.h - 8),
    ) || null
  );
}

// ---- Buying ----

let storeCarryTipShown = false;

// Click on a shelf item: buy it. Called from the mousedown handler (UI.js).
function storeShelfClick() {
  if (!isStoreScene(currentScene) || isGlobalDragging) return false;
  const slot = getStoreSlotAt(currentScene, mouse.x, mouse.y);
  if (!slot) return false;

  const aisle = getStoreAisleForScene(currentScene);
  const layout = getStoreShelfLayout(aisle);
  // Lands on the floor in front of its shelf
  const sx = clamp(slot.iconX + (Math.random() - 0.5) * 60, 60, width - 60);
  const sy = clamp(
    layout.unitBottom + 40 + Math.random() * 30,
    layout.unitBottom + 30,
    height - 110,
  );

  const action = slot.action;
  const bought = buyShopAction(action, sx, sy, { exactSpot: true });
  if (!bought) return true;

  if (isToolAction(action)) {
    addUIMessage(`${action.name} added to your toolbox.`);
  } else if (!storeCarryTipShown) {
    addUIMessage("Bought! Pick it up and walk it home with WASD.");
    storeCarryTipShown = true;
  } else {
    addUIMessage(`Bought ${action.name}.`);
  }
  return true;
}

// ---- Drawing ----

// Drawn behind everything else in the scene (called from script.js)
function drawStoreScenery(c) {
  if (currentScene === "SHOP_STREET") {
    drawShopStreet(c);
  } else if (isStoreScene(currentScene)) {
    const aisle = getStoreAisleForScene(currentScene);
    if (aisle) drawStoreAisle(c, aisle);
  }
}

function _storeRoundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawShopStreet(c) {
  const wallH = height * 0.15;

  // Bricks
  c.strokeStyle = "rgba(0,0,0,0.18)";
  c.lineWidth = 1;
  for (let y = 0, r = 0; y < wallH; y += 14, r++) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(width, y);
    c.stroke();
    for (let x = r % 2 ? 0 : 20; x < width; x += 40) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y + 14);
      c.stroke();
    }
  }

  // Sidewalk along the shop front
  c.fillStyle = "#b9b4aa";
  c.fillRect(0, wallH, width, 70);
  c.strokeStyle = "rgba(0,0,0,0.15)";
  for (let x = 0; x < width; x += 70) {
    c.beginPath();
    c.moveTo(x, wallH);
    c.lineTo(x, wallH + 70);
    c.stroke();
  }
  c.fillStyle = "#8f8a80";
  c.fillRect(0, wallH + 70, width, 6); // curb

  // Striped awning along the bottom of the wall
  const awnY = wallH - 18;
  for (let x = 0, i = 0; x < width; x += 30, i++) {
    c.fillStyle = i % 2 ? "#ffffff" : "#d9534f";
    c.fillRect(x, awnY, 30, 18);
  }

  // Sign board on the left (clear of the money and chat log buttons)
  const signX = 120;
  const signW = Math.max(160, doorRect.x - signX - 40);
  const signY = 10;
  const signH = awnY - 18;
  c.fillStyle = "#2e4a62";
  _storeRoundRect(c, signX, signY, signW, signH, 8);
  c.fill();
  c.strokeStyle = "#f7d774";
  c.lineWidth = 3;
  c.stroke();
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "#f7d774";
  c.font = `bold ${Math.round(Math.min(40, signH * 0.45))}px Arial`;
  c.fillText(FLUFF_MART_NAME.toUpperCase(), signX + signW / 2, signY + signH * 0.42);
  c.fillStyle = "white";
  c.font = `${Math.round(Math.min(15, signH * 0.2))}px Arial`;
  c.fillText(
    "Everything for your fluffies",
    signX + signW / 2,
    signY + signH * 0.8,
  );

  // Shop window on the right, with some stock showing
  const winX = doorRect.x + doorRect.w + 40;
  const winW = width - winX - 130; // room for the "Back to Garden" arrow
  const winY = 10;
  const winH = awnY - 16;
  if (winW > 60) {
    c.fillStyle = "#bfe3f2";
    c.fillRect(winX, winY, winW, winH);
    c.fillStyle = "rgba(120, 85, 50, 0.8)";
    c.fillRect(winX, winY + winH * 0.62, winW, 5);
    const show = SPAWN_ACTIONS.filter((a) =>
      ["bed", "ball", "fluff_tv", "food_bag", "block", "accessory"].includes(
        a.isItem,
      ),
    ).slice(0, Math.max(1, Math.floor(winW / 55)));
    show.forEach((a, i) => {
      drawShopActionIcon(
        c,
        a,
        winX + (i + 0.5) * (winW / show.length),
        winY + winH * 0.4,
        Math.min(34, winH * 0.45),
      );
    });
    c.strokeStyle = "#5b3a24";
    c.lineWidth = 4;
    c.strokeRect(winX, winY, winW, winH);
    c.beginPath();
    c.moveTo(winX + winW / 2, winY);
    c.lineTo(winX + winW / 2, winY + winH);
    c.stroke();
  }
  c.textBaseline = "alphabetic";
}

function drawStoreAisle(c, aisle) {
  const wallH = height * 0.15;

  // Shiny tiled floor
  const tile = 64;
  for (let y = wallH, r = 0; y < height; y += tile, r++) {
    for (let x = 0, k = 0; x < width; x += tile, k++) {
      c.fillStyle = (r + k) % 2 ? "#e6e1d6" : "#f3efe6";
      c.fillRect(x, y, tile, tile);
    }
  }
  c.fillStyle = "#b8ad97"; // skirting board
  c.fillRect(0, wallH - 6, width, 6);

  // Aisle sign
  const aisles = getStoreAisles();
  const n = aisles.indexOf(aisle) + 1;
  const title = `Aisle ${n}: ${aisle.name}`;
  c.font = "bold 26px Arial";
  const tw = c.measureText(title).width + 50;
  const signX = width / 2 - tw / 2;
  const signY = 12;
  const signH = wallH * 0.48;
  c.fillStyle = "#2e4a62";
  _storeRoundRect(c, signX, signY, tw, signH, 8);
  c.fill();
  c.strokeStyle = "#f7d774";
  c.lineWidth = 3;
  c.stroke();
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "white";
  c.fillText(title, width / 2, signY + signH / 2 + 1);
  c.fillStyle = "#6d6352";
  c.font = "bold 14px Arial";
  c.fillText(
    `${FLUFF_MART_NAME} - click something to buy it, then carry it home`,
    width / 2,
    signY + signH + (wallH - 6 - signY - signH) / 2,
  );

  // Shelving unit
  const L = getStoreShelfLayout(aisle);
  const ux = L.left - 14;
  const uw = L.right - L.left + 28;
  c.fillStyle = "#7a5a3c";
  c.fillRect(ux, L.unitTop, uw, L.unitBottom - L.unitTop);
  c.fillStyle = "rgba(0,0,0,0.15)";
  c.fillRect(ux + 12, L.unitTop + 6, uw - 24, L.unitBottom - L.unitTop - 12);
  c.fillStyle = "#5c4029"; // side posts
  c.fillRect(ux, L.unitTop, 12, L.unitBottom - L.unitTop + 10);
  c.fillRect(ux + uw - 12, L.unitTop, 12, L.unitBottom - L.unitTop + 10);
  for (let r = 0; r < L.rows; r++) {
    const py = L.unitTop + r * L.rowH + L.rowH * 0.62;
    c.fillStyle = "#c99f6c";
    c.fillRect(ux + 6, py, uw - 12, 9);
    c.fillStyle = "#9c7648";
    c.fillRect(ux + 6, py + 9, uw - 12, 4);
  }
  // Floor shadow under the unit
  c.fillStyle = "rgba(0,0,0,0.12)";
  c.fillRect(ux, L.unitBottom + 10, uw, 8);

  // Stock and price tags
  for (const s of L.slots) {
    const a = s.action;
    const owned =
      typeof isToolAlreadyOwned === "function" && isToolAlreadyOwned(a);
    const canAfford = showDebugMenu || money >= a.cost;
    drawShopActionIcon(c, a, s.iconX, s.iconY, s.iconW, owned, s.iconH);

    const tagW = Math.min(s.w - 14, 130);
    const tagH = 30;
    const tagX = s.iconX - tagW / 2;
    const tagY = s.plankY + 16;
    c.fillStyle = "#fffdf5";
    _storeRoundRect(c, tagX, tagY, tagW, tagH, 4);
    c.fill();
    c.strokeStyle = "#b5a88c";
    c.lineWidth = 1;
    c.stroke();

    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#333";
    c.font = "bold 11px Arial";
    let name = a.name;
    while (name.length > 3 && c.measureText(name).width > tagW - 8)
      name = name.slice(0, -2) + ".";
    c.fillText(name, s.iconX, tagY + 9);
    c.font = "bold 12px Arial";
    if (owned) {
      c.fillStyle = "#888";
      c.fillText("Owned", s.iconX, tagY + 22);
    } else {
      c.fillStyle = canAfford ? "#1e8a3a" : "#c0392b";
      c.fillText(`$${a.cost}`, s.iconX, tagY + 22);
    }
  }
  c.textBaseline = "alphabetic";
}

// Hover highlight + description, drawn on top (called from script.js)
function drawStoreOverlay(c) {
  if (!isStoreScene(currentScene) || isGlobalDragging) return;
  if (typeof isAnyScreenOpen === "function" && isAnyScreenOpen()) return;
  const slot = getStoreSlotAt(currentScene, mouse.x, mouse.y);
  if (!slot) return;

  c.save();
  c.fillStyle = "rgba(255, 255, 255, 0.18)";
  c.strokeStyle = "rgba(255, 255, 255, 0.9)";
  c.lineWidth = 2;
  _storeRoundRect(c, slot.x + 4, slot.y + 4, slot.w - 8, slot.h - 8, 8);
  c.fill();
  c.stroke();
  c.restore();

  const a = slot.action;
  const owned =
    typeof isToolAlreadyOwned === "function" && isToolAlreadyOwned(a);
  let status;
  if (owned) status = "You already have one.";
  else if (!showDebugMenu && money < a.cost) status = "You can't afford this yet.";
  else if (isToolAction(a)) status = "Click to buy. Goes straight to your toolbox.";
  else status = "Click to buy, then carry it home.";
  drawShopTooltip(c, a, ["", status]);
}
