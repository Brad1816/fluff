// ---------------------------------------------------------------------------
// ItemRegistry.js - one place that describes every kind of item.
//
// Before this file existed, adding an item meant copying the same kind of
// code into many places (the sell tooltip, shift-click selling, picking
// things up, buying from the shop, loading saves). Now each item is described
// once, below, and those places all ask this registry.
//
// Must be loaded AFTER all the item class files and BEFORE UI.js.
//
// ---- Adding a new item ----------------------------------------------------
// 1. Write the class (see GoldenStatue.js or Fence.js) and add its <script>
//    tag to index.html (before this file).
// 2. Add a shop entry to SPAWN_ACTIONS in globals.js with isItem: "my_thing".
// 3. Add ONE entry to ITEM_TYPES below and ONE line to SAVED_CLASSES.
// That's it: buying, selling, the sell tooltip, picking up and saving/
// loading all work from that.
//
// ---- What an ITEM_TYPES entry can have ------------------------------------
//   sellType   Name for this kind of item. Also the shop `isItem` it came
//              from, unless `shopItem` says otherwise.
//   is(obj)    true if `obj` is this kind of item.
//   hitTest(obj, x, y)
//              Is the point (x, y) on the item? Optional: defaults to the
//              item's own obj.hitTest(x, y). Helpers: imageHit(), bedHit.
//   canPickUp(obj)
//              Optional. Return false to stop it being picked up right now.
//   sellable   true = can be sold with shift-click, for HALF the shop price
//              (looked up in SPAWN_ACTIONS, so it follows price changes).
//              Leave it out and the item can't be sold.
//   usedUp(obj)
//              Optional, for things that get used up: 0 = like new ... 1 =
//              all used. The sell price goes down to match.
//   sellValue(obj)
//              Optional: a custom sell price that replaces the half-price rule.
//   onSell(obj)
//              Optional clean-up when it's sold (e.g. unclaim a bed).
//   shopItem   Optional: the SPAWN_ACTIONS `isItem` if it's not `sellType`.
//   create(action, sx, sy)
//              Optional. Makes a new one when bought from the shop and
//              returns it. (sx, sy) is a random spot near the middle of the
//              screen. Items without `create` can't be bought as world items.
//   afterCreate(obj)
//              Optional. Runs after the new item is added to the world.
//   poofAtMouse
//              Optional. true = the purchase "poof" appears at the mouse.
//
// Note: tools (stick, brush, knife, syringe...) are bought into the toolbox
// by createToolFromAction() in globals.js, not by `create` here.
// ---------------------------------------------------------------------------

// Hit test against an image drawn centred on obj.x. anchor "bottom" means the
// image sits on obj.y (most items); "center" means it's centred on obj.y.
function imageHit(imageKey, anchor = "bottom") {
  return (obj, x, y) => {
    const img =
      typeof imageKey === "function" ? imageKey(obj) : images[imageKey];
    if (!img) return false;
    const w = img.width;
    const h = img.height;
    const top = anchor === "center" ? obj.y - h / 2 : obj.y - h;
    return isPointInRect(x, y, obj.x - w / 2, top, w, h);
  };
}

function bowlImage(obj) {
  if (obj.type === "feeder") return images.baby_feeder;
  if (obj.type === "trough") return images.trough;
  if (obj.type === "mega_feeder") return images.mega_baby_feeder;
  return images.kibble_bowl || images.bowl;
}

// Items bought and placed in the middle of the screen
function centered(obj) {
  obj.x = width / 2;
  obj.y = height / 2;
  return obj;
}
// Items bought and placed at the random spot near the middle
function atSpot(obj, sx, sy) {
  obj.setPosition(sx, sy);
  return obj;
}

const ITEM_TYPES = [
  // ---- Food and feeding ----
  {
    sellType: "bowl",
    is: (o) =>
      o instanceof Bowl &&
      o.type !== "trough" &&
      o.type !== "feeder" &&
      o.type !== "mega_feeder",
    hitTest: imageHit(bowlImage),
    sellable: true,
    create: (a, sx, sy) => atSpot(new Bowl("bowl", currentScene), sx, sy),
  },
  {
    sellType: "trough",
    is: (o) => o instanceof Bowl && o.type === "trough",
    hitTest: imageHit(bowlImage),
    sellable: true,
    create: (a, sx, sy) => atSpot(new Bowl("trough", currentScene), sx, sy),
  },
  {
    sellType: "feeder",
    is: (o) => o instanceof Bowl && o.type === "feeder",
    hitTest: imageHit(bowlImage),
    sellable: true,
    create: (a, sx, sy) => atSpot(new Bowl("feeder", currentScene), sx, sy),
  },
  {
    sellType: "mega_feeder",
    is: (o) => o instanceof Bowl && o.type === "mega_feeder",
    hitTest: imageHit(bowlImage),
    sellable: true,
    create: (a, sx, sy) =>
      atSpot(new Bowl("mega_feeder", currentScene), sx, sy),
  },
  {
    sellType: "bag",
    shopItem: "food_bag",
    is: (o) => o instanceof FoodBag,
    hitTest: imageHit("food_bag"),
    sellable: true,
    // Only a full bag can be sold back
    usedUp: (o) => (o.amount === 5 ? 0 : 1),
    create: (a, sx, sy) =>
      atSpot(new FoodBag(a.foodType, currentScene), sx, sy),
    afterCreate: (bag) => bag.combineWithNearby(),
  },

  // ---- Furniture ----
  {
    sellType: "bed",
    is: (o) => o instanceof Bed,
    hitTest: (o, x, y) => {
      const bw = images.bed ? images.bed.width : BED_WIDTH;
      const bh = images.bed ? images.bed.height : BED_HEIGHT;
      return isPointInRect(x, y, o.x - bw / 2, o.y - bh, bw, bh);
    },
    sellable: true,
    onSell: (bed) => {
      for (const id of bed.claimants) {
        const f = fluffies.find((f) => f.id === id);
        if (f) f.claimedBed = null;
      }
    },
    create: () => centered(new Bed(currentScene)),
  },
  {
    sellType: "statue",
    shopItem: "golden_statue",
    is: (o) => o instanceof GoldenStatue,
    hitTest: imageHit("golden_statue"),
    sellable: true,
    create: (a, sx, sy) => atSpot(new GoldenStatue(currentScene), sx, sy),
  },
  {
    sellType: "fluff_tv",
    is: (o) => o instanceof FluffTV,
    hitTest: imageHit("fluff_tv_off"),
    sellable: true,
    create: (a, sx, sy) => atSpot(new FluffTV(currentScene), sx, sy),
  },
  {
    sellType: "fence",
    is: (o) => typeof Fence !== "undefined" && o instanceof Fence && !o.isGate,
    sellable: true,
    create: () => createHeldFence(false),
    poofAtMouse: true,
  },
  {
    sellType: "fence_gate",
    is: (o) => typeof Fence !== "undefined" && o instanceof Fence && o.isGate,
    sellable: true,
    create: () => createHeldFence(true),
    poofAtMouse: true,
  },

  // ---- Containers and equipment ----
  {
    sellType: "cage",
    is: (o) => o instanceof Cage,
    hitTest: imageHit("cage", "center"),
    sellable: true,
    create: () => centered(new Cage(currentScene)),
  },
  {
    sellType: "litterbox",
    is: (o) => o instanceof Litterbox,
    hitTest: imageHit("litterbox"),
    sellable: true,
    create: () => centered(new Litterbox(currentScene)),
  },
  {
    sellType: "litterpal_box",
    is: (o) => o instanceof LitterpalBox,
    sellable: true,
    create: () => centered(new LitterpalBox(currentScene)),
  },
  {
    sellType: "grinder",
    is: (o) => o instanceof Grinder,
    hitTest: (o, x, y) => {
      const g = o.bounds;
      return isPointInRect(x, y, g.left, g.top, g.right - g.left, g.bottom - g.top);
    },
    canPickUp: (o) => o.currentSpeed <= 0, // not while it's running
    sellable: true,
    create: () => centered(new Grinder(currentScene)),
  },
  {
    sellType: "operating_table",
    is: (o) => o instanceof OperatingTable,
    sellable: true,
    create: () => centered(new OperatingTable(currentScene)),
  },
  {
    sellType: "immobilization_board",
    is: (o) => o instanceof ImmobilizationBoard,
    sellable: true,
    create: () => centered(new ImmobilizationBoard(currentScene)),
  },
  {
    sellType: "sprinkler",
    is: (o) => o instanceof Sprinkler,
    sellable: true,
    create: () => centered(new Sprinkler(currentScene)),
  },
  {
    sellType: "iv_stand",
    is: (o) => o instanceof IVStand,
    sellable: true,
    create: () => centered(new IVStand(currentScene)),
  },

  // ---- Toys ----
  {
    sellType: "ball",
    is: (o) => o instanceof Ball,
    sellable: true,
    create: (a, sx, sy) => new Ball(sx, sy, currentScene),
  },
  {
    sellType: "block",
    is: (o) => o instanceof Block,
    sellable: true,
    create: (a, sx, sy) => new Block(sx, sy, currentScene),
  },
  {
    sellType: "accessory",
    is: (o) => o instanceof AccessoryItem,
    sellable: true,
    create: (a, sx, sy) => {
      const obj = new AccessoryItem(currentScene, a.accessoryId);
      obj.x = sx;
      obj.y = sy;
      return obj;
    },
  },

  // ---- Tools (bought into the toolbox, but can be sold if in the world) ----
  { sellType: "stick", shopItem: "sorry_stick", is: (o) => o instanceof SorryStick, sellable: true },
  { sellType: "spray_bottle", is: (o) => o instanceof SprayBottle, sellable: true },
  { sellType: "brush", is: (o) => o instanceof Brush, sellable: true },
  { sellType: "knife", is: (o) => o instanceof Knife && o.type === "knife", sellable: true },
  { sellType: "scalpel", is: (o) => o instanceof Knife && o.type === "scalpel", sellable: true },
  { sellType: "suture_kit", is: (o) => o instanceof SutureKit, sellable: true,
    usedUp: (o) => 1 - (o.charges || 0) / 4 },
  { sellType: "trash_bag", is: (o) => typeof TrashBag !== "undefined" && o instanceof TrashBag, sellable: true,
    usedUp: (o) => Math.min(5, o.fillAmount || 0) / 5 },
  { sellType: "sponge", is: (o) => o instanceof Sponge, sellable: true },
  { sellType: "magnifying_glass", is: (o) => o instanceof MagnifyingGlass, sellable: true },
  { sellType: "thumbtack", is: (o) => typeof Thumbtack !== "undefined" && o instanceof Thumbtack, sellable: true },
  { sellType: "syringe", is: (o) => typeof Syringe !== "undefined" && o instanceof Syringe, sellable: true },
  { sellType: "cattle_prod", is: (o) => typeof CattleProd !== "undefined" && o instanceof CattleProd, sellable: true },
  {
    sellType: "iv_bag",
    is: (o) => o instanceof IVBag,
    sellable: true,
    onSell: (bag) => {
      if (bag.attachedTo) bag.attachedTo.attachedBag = null;
    },
  },

  // ---- Not sellable, but can be picked up ----
  {
    sellType: "foal_in_a_can",
    is: (o) => o instanceof FoalInACan,
    hitTest: (o, x, y) => {
      const bw = images.foal_in_a_can ? images.foal_in_a_can.width : 60;
      const bh = images.foal_in_a_can ? images.foal_in_a_can.height : 70;
      return isPointInRect(x, y, o.x - bw / 2, o.y - bh, bw, bh);
    },
  },
];

// How to re-create each class when loading a save (the rest of the saved
// data is then filled in by the object's own deserialize()).
const SAVED_CLASSES = {
  AccessoryItem: (d) => new AccessoryItem(d.scene, d.accessoryId),
  Ball: (d) => new Ball(d.x, d.y, d.scene),
  Bed: (d) => new Bed(d.scene, d.type || "normal"),
  FoodBag: (d) => new FoodBag(d.type, d.scene),
  Litterbox: (d) => new Litterbox(d.scene),
  Grinder: (d) => new Grinder(d.scene),
  Cage: (d) => new Cage(d.scene),
  Brush: (d) => new Brush(d.scene),
  Sponge: (d) => new Sponge(d.scene),
  Knife: (d) => new Knife(d.type, d.scene),
  SutureKit: (d) => new SutureKit(d.scene),
  TrashBag: (d) => new TrashBag(d.scene),
  SorryStick: (d) => new SorryStick(d.scene),
  SprayBottle: (d) => new SprayBottle(d.scene),
  MagnifyingGlass: (d) => new MagnifyingGlass(d.scene),
  Sprinkler: (d) => new Sprinkler(d.scene),
  IVStand: (d) => new IVStand(d.scene),
  IVBag: (d) => new IVBag(d.scene, d.type),
  FluffyTable: (d) => new FluffyTable(d.scene),
  OperatingTable: (d) => new OperatingTable(d.scene),
  ImmobilizationBoard: (d) => new ImmobilizationBoard(d.scene),
  LitterpalBox: (d) => new LitterpalBox(d.scene),
  Block: (d) => new Block(d.x, d.y, d.scene),
  GoldenStatue: (d) => new GoldenStatue(d.scene),
  Fence: (d) => new Fence(d.scene, d.orientation, d.isGate),
  FoalVendor: (d) => new FoalVendor(d.scene),
  FoalInACan: (d) => new FoalInACan(d.scene),
  FluffTV: (d) => new FluffTV(d.scene),
  Bowl: (d) => new Bowl(d.type, d.scene),
  Grass: (d) => new Grass(d.x, d.y, d.scene),
  Thumbtack: (d) => new Thumbtack(d.scene),
  Syringe: (d) => new Syringe(d.scene),
  CattleProd: (d) => new CattleProd(d.scene),
  DayCareDesk: (d) => new DayCareDesk(d.scene),
};

// ---------------------------------------------------------------------------
// Lookups used by the rest of the game
// ---------------------------------------------------------------------------

// The registry entry describing this object, or null
function getItemType(obj) {
  for (const entry of ITEM_TYPES) {
    if (entry.is(obj)) return entry;
  }
  return null;
}

// Is the point (x, y) on this object?
function itemHitTest(obj, x, y) {
  const entry = getItemType(obj);
  if (entry && entry.hitTest) return entry.hitTest(obj, x, y);
  return typeof obj.hitTest === "function" ? !!obj.hitTest(x, y) : false;
}

// Can this object be picked up with a click at (x, y) right now?
function itemCanBePickedUpAt(obj, x, y) {
  const entry = getItemType(obj);
  if (entry && entry.canPickUp && !entry.canPickUp(obj)) return false;
  return itemHitTest(obj, x, y);
}

// The shop price of this item (0 if it isn't in the shop)
function getItemShopPrice(obj, entry) {
  if (obj instanceof AccessoryItem) {
    const def =
      typeof ACCESSORY_DB !== "undefined" ? ACCESSORY_DB[obj.accessoryId] : null;
    return def ? def.cost : 0;
  }
  const key = entry.shopItem || entry.sellType;
  const action = SPAWN_ACTIONS.find((a) => {
    if (a.isItem !== key) return false;
    if (a.isItem === "food_bag") return a.foodType === obj.type;
    if (a.isItem === "iv_bag") return a.bagType === obj.type;
    return true;
  });
  return action ? action.cost : 0;
}

// Money you get for selling this item: half its shop price, less if it's
// partly used up (or the entry's own sellValue if it has one)
function getItemSellValue(obj, entry) {
  if (!entry) return 0;
  if (entry.sellValue) return entry.sellValue(obj);
  let value = getItemShopPrice(obj, entry) / 2;
  if (entry.usedUp) value *= 1 - clamp(entry.usedUp(obj), 0, 1);
  return Math.floor(value);
}

function isItemSellable(entry) {
  return !!(entry && (entry.sellable || entry.sellValue));
}

// The front-most sellable item in the current scene at (x, y):
// { item, entry } or null. (Front-most = lowest on screen.)
function findSellableItemAt(x, y) {
  let best = null;
  let maxY = -Infinity;
  for (const obj of objects) {
    if (obj.scene !== currentScene) continue;
    const entry = getItemType(obj);
    if (!isItemSellable(entry)) continue;
    if (!itemHitTest(obj, x, y)) continue;
    const bottom = obj.getBottomY();
    if (bottom > maxY) {
      maxY = bottom;
      best = { item: obj, entry };
    }
  }
  return best;
}

// The registry entry for a shop action, if it's a world item we can create
function getItemTypeForAction(action) {
  return (
    ITEM_TYPES.find(
      (e) => e.create && (e.shopItem || e.sellType) === action.isItem,
    ) || null
  );
}

// Re-create an object from save data (or null if the class is unknown)
function createItemFromSave(data) {
  const make = SAVED_CLASSES[data.classType];
  return make ? make(data) : null;
}
