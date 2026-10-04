// ---------------------------------------------------------------------------
// Getting shopping home: deliveries and the shopping bag.
//
// What happens when you buy something at Fluff Mart (Store.js
// storeShelfClick -> buyFromStore):
//   - Tools go into the toolbox (as before).
//   - Small things (SHOPPING_BAG_TYPES: food bags, bowls, baby feeders,
//     balls, blocks, litterboxes, accessories) go into your shopping bag,
//     which shows in the toolbox after the tools (tan buttons with a count).
//     Click one to take it out: it's stuck to the mouse, click to put it
//     down, like anything you carry.
//   - Everything else (cages, troughs, feeders, beds, fences, the TV, the
//     Gene Lab...) is delivered: it's waiting in your living room (INDOORS)
//     straight away (deliverShopAction).
//
// Carrying a small thing and clicking the open toolbox packs it back into
// the bag (packIntoShoppingBag), exactly as it was (a half-eaten bag of
// kibble stays half eaten) - handy for moving things between rooms.
//
// shoppingBag: [{ name, data }] - name is the shop entry (SPAWN_ACTIONS
// name, for its picture), data the saved item (null = new from the shop).
// Saved: shoppingBag (SAVED_GAME_STATE).
// ---------------------------------------------------------------------------

const SHOPPING_BAG_TYPES = ["bag", "bowl", "feeder", "ball", "block", "litterbox", "accessory", "night_light", "repair_kit"];
const DELIVERY_SCENE = "INDOORS";

// Where deliveries go (playtest 7): your choice of room - the "Deliver to"
// chip in Fluff Mart and on the computer's Items tab cycles through your
// rooms and the backyard. Saved: deliveryRoom (SAVED_GAME_STATE).
let deliveryRoom = DELIVERY_SCENE;
if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({
    name: "deliveryRoom",
    get: () => deliveryRoom,
    set: (v) => (deliveryRoom = typeof v === "string" ? v : DELIVERY_SCENE),
    fresh: () => DELIVERY_SCENE,
  });
}

function deliveryRooms() {
  const out = [DELIVERY_SCENE];
  const L = typeof unlockedRoomsL === "number" ? unlockedRoomsL : 0;
  const R = typeof unlockedRoomsR === "number" ? unlockedRoomsR : 0;
  for (let i = 1; i <= L; i++) out.push(`INDOORSL${i}`);
  for (let i = 1; i <= R; i++) out.push(`INDOORSR${i}`);
  out.push("BACKYARD");
  return out;
}

function deliveryScene() {
  return deliveryRooms().includes(deliveryRoom) ? deliveryRoom : DELIVERY_SCENE;
}

function deliveryRoomName(scene = deliveryScene()) {
  if (scene === "BACKYARD") return "the backyard";
  if (scene === DELIVERY_SCENE) return "your living room";
  return (typeof houseRoomName === "function" && houseRoomName(scene)) || "your house";
}

function cycleDeliveryRoom(dir = 1) {
  const rooms = deliveryRooms();
  const i = Math.max(0, rooms.indexOf(deliveryScene()));
  deliveryRoom = rooms[(i + dir + rooms.length) % rooms.length];
  return deliveryRoom;
}

// The "Deliver to" chip: { x, y, w, h, label }
function deliveryChipLabel() {
  const n = deliveryRoomName();
  return `Deliver to: ${n.charAt(0).toUpperCase() + n.slice(1)} \u25B8`;
}

let shoppingBag = [];

// "tool" | "bag" | "deliver" | "carry" (anything else, e.g. a fluffy)
function shopDeliveryKind(action) {
  if (typeof isToolAction === "function" && isToolAction(action)) return "tool";
  const type = typeof getItemTypeForAction === "function" ? getItemTypeForAction(action) : null;
  if (!type) return "carry";
  return SHOPPING_BAG_TYPES.includes(type.sellType) ? "bag" : "deliver";
}

// ---- Buying (Store.js) ----

// Buy from a store shelf. Returns what happened: "tool", "bag", "deliver",
// "carry", or null if it wasn't bought. (sx, sy): the store floor spot, for
// things still carried by hand.
function buyFromStore(action, sx, sy) {
  const kind = shopDeliveryKind(action);
  if (kind === "tool" || kind === "carry") {
    return buyShopAction(action, sx, sy, { exactSpot: true }) ? kind : null;
  }
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < action.cost) {
    addUIMessage("Not enough money!");
    return null;
  }
  if (kind === "bag") {
    if (!free) money -= action.cost;
    shoppingBag.push({ name: action.name, data: null });
    if (typeof poofs !== "undefined") poofs.push(new Poof(mouse.x, mouse.y, currentScene));
    return "bag";
  }
  return deliverShopAction(action) ? "deliver" : null;
}

// A free-ish spot on the floor of the room it's going to
function _deliverySpot(scene = deliveryScene()) {
  const top = (typeof sceneTop === "function" ? sceneTop(scene) : height * 0.15) + 110;
  const bottom = height - 190; // above the toolbar
  const here = objects.filter((o) => o.scene === scene);
  let best = { x: width / 2, y: (top + bottom) / 2 };
  let bestGap = -1;
  for (let i = 0; i < 40; i++) {
    const x = 220 + Math.random() * Math.max(10, width - 440);
    const y = top + Math.random() * Math.max(10, bottom - top);
    let gap = Infinity;
    for (const o of here) gap = Math.min(gap, Math.hypot(o.x - x, (o.y - y) * 1.5));
    if (gap > bestGap) {
      bestGap = gap;
      best = { x, y };
    }
  }
  return best;
}

// Pay for it and put it in the room deliveries go to. Returns the item or
// null. opts.paid: already paid for (an order from the computer).
function deliverShopAction(action, opts = {}) {
  const type = getItemTypeForAction(action);
  if (!type) return null;
  const free = opts.paid || (typeof showDebugMenu !== "undefined" && showDebugMenu);
  if (!free && money < action.cost) return null;
  const DELIVERY_SCENE = opts.scene || deliveryScene(); // (shadows the default on purpose)
  const spot = _deliverySpot(DELIVERY_SCENE);
  // Made "in" the living room, so everything about it belongs there
  const wasScene = currentScene;
  const wasDragging = isGlobalDragging;
  let obj;
  try {
    currentScene = DELIVERY_SCENE;
    obj = type.create(action, spot.x, spot.y);
  } finally {
    currentScene = wasScene;
  }
  if (!obj) return null;
  if (!free) money -= action.cost;
  obj.scene = DELIVERY_SCENE;
  obj.isDragging = false; // fences are made stuck to the mouse
  isGlobalDragging = wasDragging;
  if (typeof obj.setPosition === "function") obj.setPosition(spot.x, spot.y);
  else {
    obj.x = spot.x;
    obj.y = spot.y;
  }
  objects.push(obj);
  if (type.afterCreate && type.sellType !== "fence" && type.sellType !== "fence_gate") type.afterCreate(obj);
  if (typeof poofs !== "undefined") poofs.push(new Poof(obj.x, obj.y, DELIVERY_SCENE));
  return obj;
}

// ---- The bag ----

function _shopActionByName(name) {
  return SPAWN_ACTIONS.find((a) => a.name === name) || null;
}

// The shop entry an item came from (for its picture and name)
function shopActionForItem(obj) {
  const entry = getItemType(obj);
  if (!entry) return null;
  if (typeof AccessoryItem !== "undefined" && obj instanceof AccessoryItem)
    return SPAWN_ACTIONS.find((a) => a.isItem === "accessory" && a.accessoryId === obj.accessoryId) || null;
  const key = entry.shopItem || entry.sellType;
  return (
    SPAWN_ACTIONS.find((a) => {
      if (a.isItem !== key) return false;
      if (a.isItem === "food_bag") return a.foodType === obj.type;
      return true;
    }) || null
  );
}

function canPackIntoShoppingBag(obj) {
  if (!obj || !objects.includes(obj)) return false;
  const entry = getItemType(obj);
  return !!(entry && SHOPPING_BAG_TYPES.includes(entry.sellType) && shopActionForItem(obj));
}

// Put something you're carrying (or anything small) back in the bag
function packIntoShoppingBag(obj) {
  if (!canPackIntoShoppingBag(obj)) return false;
  const action = shopActionForItem(obj);
  obj.isDragging = false;
  obj.currentCage = null;
  if (obj.stackedOn) obj.stackedOn = null;
  if (obj.heldBy) obj.heldBy = null;
  const data = typeof obj.serialize === "function" ? JSON.parse(JSON.stringify(obj.serialize())) : null;
  if (data) {
    data.currentCageId = null;
    data.stackedOnId = null;
    data.heldById = null;
  }
  // Anything stacked on it drops
  for (const o of objects) if (o.stackedOn === obj) o.stackedOn = null;
  objects.splice(objects.indexOf(obj), 1);
  shoppingBag.push({ name: action.name, data });
  if (objects.every((o) => !o.isDragging) && fluffies.every((f) => !f.isDragging)) isGlobalDragging = false;
  return true;
}

// The bag's buttons in the toolbox: one per kind, with a count
function getShoppingBagEntries() {
  const groups = new Map();
  for (const e of shoppingBag) {
    if (!groups.has(e.name)) groups.set(e.name, 0);
    groups.set(e.name, groups.get(e.name) + 1);
  }
  const out = [];
  for (const [name, count] of groups) {
    const action = _shopActionByName(name);
    if (action) out.push({ isBag: true, key: `bag:${name}`, name, action, count });
  }
  return out;
}

// Take one out (the last one packed): it's stuck to the mouse
function takeFromShoppingBag(name) {
  let idx = -1;
  for (let i = shoppingBag.length - 1; i >= 0; i--)
    if (shoppingBag[i].name === name) {
      idx = i;
      break;
    }
  if (idx < 0) return null;
  // Put down any tool you're holding first; can't take out while carrying
  if (typeof unequipCurrentTool === "function") unequipCurrentTool();
  if (objects.some((o) => o.isDragging) || fluffies.some((f) => f.isDragging)) return null;
  const e = shoppingBag[idx];
  let obj = null;
  if (e.data) {
    const before = objects.length;
    loadObject({ ...e.data, scene: currentScene, x: mouse.x, y: mouse.y });
    obj = objects.length > before ? objects[objects.length - 1] : null;
  } else {
    const action = _shopActionByName(e.name);
    const type = action && getItemTypeForAction(action);
    if (type) {
      obj = type.create(action, mouse.x, mouse.y);
      if (obj) objects.push(obj);
    }
  }
  if (!obj) return null;
  shoppingBag.splice(idx, 1);
  obj.scene = currentScene;
  if (typeof obj.setPosition === "function") obj.setPosition(mouse.x, mouse.y);
  else {
    obj.x = mouse.x;
    obj.y = mouse.y;
  }
  obj.isDragging = true;
  obj.dragOffset = { x: 0, y: 0 };
  isGlobalDragging = true;
  return obj;
}

// ---- Taking them all out (playtest 6) ----
// Shift-click a bag button (long-press on a phone): one comes out stuck to
// the mouse as usual, and when you put it down the rest of that kind are
// laid out in a row beside it (in the same cage, if it went in one).
const BAG_ALL_GAP = 36; // px between them
const BAG_ALL_ROW = 8; // a row
let bagAllPending = null; // { obj, name }

function takeAllFromShoppingBag(name) {
  const obj = takeFromShoppingBag(name);
  if (!obj) return null;
  obj._noShiftSell = true; // (shift's still down: putting it down mustn't sell it - UISelling.js)
  bagAllPending = shoppingBag.some((e) => e.name === name) ? { obj, name } : null;
  return obj;
}

// Lay the rest out beside the one just put down. Returns how many.
function layOutBagRest(first, name) {
  const rest = shoppingBag.filter((e) => e.name === name).length;
  if (!rest) return 0;
  const cage = first.currentCage && typeof Cage !== "undefined" && first.currentCage instanceof Cage ? first.currentCage : null;
  const b = cage ? cage.bounds : null;
  const wasScene = currentScene;
  const wasMouse = { x: mouse.x, y: mouse.y };
  const wasDragging = isGlobalDragging;
  let n = 0;
  try {
    currentScene = first.scene;
    for (let i = 0; i < rest; i++) {
      const k = i + 1;
      const side = k % 2 ? 1 : -1;
      const step = Math.ceil(k / 2);
      const row = Math.floor(i / BAG_ALL_ROW);
      let x = first.x + side * ((step - 1) % Math.ceil(BAG_ALL_ROW / 2) + 1) * BAG_ALL_GAP;
      let y = first.y - row * 26;
      if (b) {
        x = clamp(x, b.left + 16, b.right - 16);
        y = clamp(y, b.top + 16, b.bottom - 4);
      } else {
        x = clamp(x, 30, width - 30);
        y = Math.max(y, (typeof sceneTop === "function" ? sceneTop(first.scene) : 0) + 20);
      }
      mouse.x = x;
      mouse.y = y;
      const obj = takeFromShoppingBag(name);
      if (!obj) break;
      obj.scene = first.scene;
      if (typeof obj.onDrop === "function") obj.onDrop();
      else obj.isDragging = false;
      obj.isDragging = false;
      n++;
    }
  } finally {
    currentScene = wasScene;
    mouse.x = wasMouse.x;
    mouse.y = wasMouse.y;
  }
  isGlobalDragging = wasDragging && (objects.some((o) => o.isDragging) || fluffies.some((f) => f.isDragging));
  return n;
}

// Every step: has the first one been put down yet?
function updateBagAll() {
  // Put down: shift-click can sell it again
  for (const o of objects) if (o._noShiftSell && !o.isDragging) delete o._noShiftSell;
  if (!bagAllPending) return;
  const { obj, name } = bagAllPending;
  if (!objects.includes(obj)) {
    bagAllPending = null; // (packed back, or gone)
    return;
  }
  if (obj.isDragging) return;
  bagAllPending = null;
  layOutBagRest(obj, name);
}
if (typeof registerSystem === "function") registerSystem("bag all", updateBagAll, 3);

// What you're carrying that could go in the bag
function carriedPackableItem() {
  return objects.find((o) => o.isDragging && canPackIntoShoppingBag(o)) || null;
}
