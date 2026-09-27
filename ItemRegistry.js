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
//   onRightClick(obj)
//              Optional. What right-clicking it does (e.g. change the TV
//              channel). Return false to let the click go to whatever is
//              behind it instead.
//   onRightClickHeld(obj)
//              Optional. What right-clicking does while you're carrying it.
//   icon       Optional. The image key for its shop button (default: the
//              shop `isItem` name), or a function(action) returning one.
//   drawIcon(ctx, btnSize)
//              Optional. Draws the shop button picture instead of an image.
//   inCage     Optional. Can it be dropped into a cage? "yes" (default),
//              "never" (dropping it in a cage leaves it outside the cage),
//              or "ignore" (dropping never changes its cage).
//
// ---- Tools ----------------------------------------------------------------
// Tools (stick, brush, knife, syringe...) live in the toolbox instead of the
// world. Their entries also have a `tool` section:
//   className    The class name saved in save files, e.g. "Knife"
//   create(scene, from)
//                Makes a new one. `from` is the shop action or save data.
//   key          Which kind of tool it is (you can only own one of each,
//                unless `multi`). A string, or function(tool).
//   name, fullName, desc
//                Short name (toolbar), full name and description (tooltip).
//                Strings, or function(tool).
//   image(tool)  Its picture in the toolbox/toolbar.
//   toolbarKey   Which number key (toolbar slot) it goes in by default
//   multi        true = you can own several (thumbtacks, IV bags...)
//   punishment   true = used to discipline fluffies (stick, spray, tack)
//   punishmentToolbar
//                true = shares the "discipline" toolbar slot
//   placeableInWorld
//                true = can be put down in the world (tack, IV bag)
//   onlyIf(obj), dataOnlyIf(data), matchData(data), matchesAction(tool, action)
//                Optional extra conditions (see the IV bag and knives).
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
    icon: "baby_feeder",
    hitTest: imageHit(bowlImage),
    sellable: true,
    create: (a, sx, sy) => atSpot(new Bowl("feeder", currentScene), sx, sy),
  },
  {
    sellType: "mega_feeder",
    is: (o) => o instanceof Bowl && o.type === "mega_feeder",
    icon: "mega_baby_feeder",
    hitTest: imageHit(bowlImage),
    sellable: true,
    create: (a, sx, sy) =>
      atSpot(new Bowl("mega_feeder", currentScene), sx, sy),
  },
  {
    sellType: "bag",
    shopItem: "food_bag",
    is: (o) => o instanceof FoodBag,
    icon: "food_bag",
    inCage: "never",
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
    icon: "fluff_tv_off",
    hitTest: imageHit("fluff_tv_off"),
    sellable: true,
    onRightClick: (tv) => tv.nextChannel(),
    create: (a, sx, sy) => atSpot(new FluffTV(currentScene), sx, sy),
  },
  {
    sellType: "gene_lab", // GeneLab.js
    is: (o) => typeof GeneLab !== "undefined" && o instanceof GeneLab,
    drawIcon: (ctx, btnSize) => drawGeneLabIcon(ctx, btnSize),
    inCage: "never",
    sellable: true,
    onRightClick: () => openGeneLab(),
    create: (a, sx, sy) => atSpot(new GeneLab(currentScene), sx, sy),
  },
  {
    sellType: "computer", // OrderBoard.js: FluffList customer orders
    is: (o) => typeof Computer !== "undefined" && o instanceof Computer,
    drawIcon: (ctx, btnSize) => drawComputerIcon(ctx, btnSize),
    inCage: "never",
    sellable: true,
    onRightClick: () => openOrdersScreen("web"),
    create: (a, sx, sy) => atSpot(new Computer(currentScene), sx, sy),
  },
  {
    sellType: "fence",
    is: (o) => typeof Fence !== "undefined" && o instanceof Fence && !o.isGate,
    drawIcon: (ctx, btnSize) => drawFenceIcon(ctx, btnSize),
    inCage: "never",
    sellable: true,
    onRightClick: (fence) => fence.rotate(),
    onRightClickHeld: (fence) => fence.rotate(),
    create: () => createHeldFence(false),
    poofAtMouse: true,
  },
  {
    sellType: "fence_gate",
    is: (o) => typeof Fence !== "undefined" && o instanceof Fence && o.isGate,
    drawIcon: (ctx, btnSize) => drawGateIcon(ctx, btnSize),
    inCage: "never",
    sellable: true,
    onRightClick: (gate) => gate.toggleGate(),
    onRightClickHeld: (gate) => gate.rotate(),
    create: () => createHeldFence(true),
    poofAtMouse: true,
  },

  // ---- Containers and equipment ----
  {
    sellType: "cage",
    is: (o) => o instanceof Cage,
    inCage: "ignore", // cages can't go in cages
    hitTest: imageHit("cage", "center"),
    sellable: true,
    onRightClick: (cage) => cage.cycleTag(), // none / breeding / sell
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
    inCage: "never",
    sellable: true,
    create: () => centered(new LitterpalBox(currentScene)),
  },
  {
    sellType: "grinder",
    is: (o) => o instanceof Grinder,
    inCage: "never",
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
    inCage: "never",
    sellable: true,
    // choose which body part the table amputates
    onRightClick: (table) => table.cycleCategory(),
    create: () => centered(new OperatingTable(currentScene)),
  },
  {
    sellType: "immobilization_board",
    is: (o) => o instanceof ImmobilizationBoard,
    inCage: "never",
    sellable: true,
    create: () => centered(new ImmobilizationBoard(currentScene)),
  },
  {
    sellType: "sprinkler",
    is: (o) => o instanceof Sprinkler,
    icon: "sprinkler_off",
    inCage: "never",
    sellable: true,
    onRightClick: (s) => {
      s.isOn = !s.isOn;
    },
    create: () => centered(new Sprinkler(currentScene)),
  },
  {
    sellType: "iv_stand",
    is: (o) => o instanceof IVStand,
    inCage: "never",
    sellable: true,
    // Take the IV bag off the stand and put it back in the toolbox
    onRightClick: (stand) => {
      if (stand.attachedBag) {
        const bag = stand.attachedBag;
        bag.attachedTo = null;
        stand.attachedBag = null;
        stand.connectedFluffy = null;
        stand.isConnecting = false;
        bag.x = mouse.x;
        bag.y = mouse.y;
        if (typeof addToolToToolbox === "function") addToolToToolbox(bag);
        poofs.push(new Poof(bag.x, bag.y, currentScene));
      }
    },
    create: () => centered(new IVStand(currentScene)),
  },

  // ---- Toys ----
  {
    sellType: "ball",
    is: (o) => o instanceof Ball,
    icon: "ball_normal",
    sellable: true,
    create: (a, sx, sy) => new Ball(sx, sy, currentScene),
  },
  {
    sellType: "block",
    is: (o) => o instanceof Block,
    icon: "block_p",
    sellable: true,
    create: (a, sx, sy) => new Block(sx, sy, currentScene),
  },
  {
    sellType: "accessory",
    is: (o) => o instanceof AccessoryItem,
    icon: (action) => {
      const def =
        typeof ACCESSORY_DB !== "undefined" ? ACCESSORY_DB[action.accessoryId] : null;
      return def ? def.imageKey : null;
    },
    sellable: true,
    create: (a, sx, sy) => {
      const obj = new AccessoryItem(currentScene, a.accessoryId);
      obj.x = sx;
      obj.y = sy;
      return obj;
    },
  },

  // ---- Tools (bought into the toolbox, but can be sold if in the world) ----
  {
    sellType: "stick",
    shopItem: "sorry_stick",
    is: (o) => o instanceof SorryStick,
    inCage: "never",
    sellable: true,
    tool: {
      className: "SorryStick",
      create: (scene) => new SorryStick(scene),
      key: "sorry_stick",
      toolbarKey: "3",
      name: "Stick",
      fullName: "Sorry Stick",
      desc: "Click fluffies with it to whack them.",
      image: () => images.sorry_stick,
      punishment: true,
      punishmentToolbar: true,
    },
  },
  {
    sellType: "spray_bottle",
    is: (o) => o instanceof SprayBottle,
    inCage: "never",
    sellable: true,
    tool: {
      className: "SprayBottle",
      create: (scene) => new SprayBottle(scene),
      key: "spray_bottle",
      toolbarKey: "3",
      name: "Spray",
      fullName: "Spray Bottle",
      desc: "Spray fluffies to discipline them.",
      image: () => images.spray_bottle,
      punishment: true,
      punishmentToolbar: true,
    },
  },
  {
    sellType: "brush",
    is: (o) => o instanceof Brush,
    inCage: "never",
    sellable: true,
    tool: {
      className: "Brush",
      create: (scene) => new Brush(scene),
      key: "brush",
      toolbarKey: "2",
      name: "Brush",
      desc: "Brush fluffies to reward them for good behavior.",
      image: () => images.brush,
    },
  },
  {
    sellType: "knife",
    is: (o) => o instanceof Knife && o.type === "knife",
    inCage: "never",
    sellable: true,
    tool: {
      className: "Knife",
      matchData: (d) => (d.type || "knife") !== "scalpel",
      create: (scene) => new Knife("knife", scene),
      key: "knife",
      toolbarKey: "5",
      name: "Knife",
      desc: "Used for amputation.",
      image: () => images.knife,
    },
  },
  {
    sellType: "scalpel",
    is: (o) => o instanceof Knife && o.type === "scalpel",
    inCage: "never",
    sellable: true,
    tool: {
      className: "Knife",
      matchData: (d) => d.type === "scalpel",
      create: (scene) => new Knife("scalpel", scene),
      key: "scalpel",
      toolbarKey: "8",
      name: "Scalpel",
      desc: "Medical amputation without bleeding.",
      image: () => images.scalpel || images.knife,
    },
  },
  {
    sellType: "suture_kit",
    is: (o) => o instanceof SutureKit,
    inCage: "never",
    sellable: true,
    usedUp: (o) => 1 - (o.charges || 0) / 4,
    tool: {
      className: "SutureKit",
      create: (scene) => new SutureKit(scene),
      key: "suture_kit",
      toolbarKey: "6",
      name: "Suture",
      fullName: (t) => `Suture Kit (${t.charges ?? 4} uses left)`,
      desc: (t) =>
        `Stops blood loss in amputated fluffies. ${t.charges ?? 4} uses left.`,
      image: () => images.suture_kit,
      multi: true,
    },
  },
  {
    sellType: "trash_bag",
    is: (o) => typeof TrashBag !== "undefined" && o instanceof TrashBag,
    icon: "trash_bag_empty",
    inCage: "never",
    sellable: true,
    usedUp: (o) => Math.min(5, o.fillAmount || 0) / 5,
    tool: {
      className: "TrashBag",
      create: (scene) => new TrashBag(scene),
      key: "trash_bag",
      toolbarKey: "7",
      name: "Trash",
      fullName: (t) =>
        `Trash Bag (${Math.round((Math.min(5, t.fillAmount || 0) / 5) * 100)}% full)`,
      desc: "Auto-picks up corpses/parts. Drop into grinder to dispose.",
      image: (t) =>
        typeof t.getCurrentImage === "function"
          ? t.getCurrentImage()
          : images.trash_bag_empty,
      multi: true,
    },
  },
  {
    sellType: "sponge",
    is: (o) => o instanceof Sponge,
    inCage: "never",
    sellable: true,
    tool: {
      className: "Sponge",
      create: (scene) => new Sponge(scene),
      key: "sponge",
      toolbarKey: "1",
      name: "Sponge",
      desc: "Clean messes by holding this over them.",
      image: () => images.sponge,
    },
  },
  {
    sellType: "magnifying_glass",
    is: (o) => o instanceof MagnifyingGlass,
    inCage: "never",
    sellable: true,
    tool: {
      className: "MagnifyingGlass",
      create: (scene) => new MagnifyingGlass(scene),
      key: "magnifying_glass",
      toolbarKey: "4",
      name: "Glass",
      fullName: "Magnifying Glass",
      desc: "Click on a fluffy to inspect and rename.",
      image: () => images.magnifying_glass,
    },
  },
  {
    sellType: "thumbtack",
    is: (o) => typeof Thumbtack !== "undefined" && o instanceof Thumbtack,
    inCage: "never",
    sellable: true,
    onRightClick: (tack) => putBackInToolbox(tack),
    tool: {
      className: "Thumbtack",
      create: (scene) => new Thumbtack(scene),
      key: "thumbtack",
      toolbarKey: "3",
      name: "Tack",
      fullName: "Thumbtack",
      desc: "Can poke fluffies causing pain and minor bleeding.",
      image: () => images.thumbtack,
      multi: true,
      punishment: true,
      placeableInWorld: true,
    },
  },
  {
    sellType: "syringe",
    is: (o) => typeof Syringe !== "undefined" && o instanceof Syringe,
    inCage: "never",
    sellable: true,
    tool: {
      className: "Syringe",
      create: (scene) => new Syringe(scene),
      key: "syringe",
      toolbarKey: "9",
      name: "Syringe",
      fullName: (t) =>
        t.fluidType
          ? `Syringe (${t.fluidType.toUpperCase()}: ${Math.round(t.fluidAmount)}u)`
          : "Syringe (Empty)",
      desc: "Click an IV bag to draw fluid, click fluffy to inject.",
      image: () => images.syringe,
    },
  },
  {
    sellType: "cattle_prod",
    is: (o) => typeof CattleProd !== "undefined" && o instanceof CattleProd,
    inCage: "never",
    sellable: true,
    tool: {
      className: "CattleProd",
      create: (scene) => new CattleProd(scene),
      key: "cattle_prod",
      toolbarKey: "0",
      name: "Prod",
      fullName: "Cattle Prod",
      desc: "Electrocutes fluffies while grabbed and holding mouse down.",
      image: () => images.cattle_prod,
    },
  },
  {
    sellType: "iv_bag",
    is: (o) => o instanceof IVBag,
    inCage: "never",
    sellable: true,
    // A loose bag goes back in the toolbox (one on a stand: see the stand)
    onRightClick: (bag) => (bag.attachedTo ? false : putBackInToolbox(bag)),
    tool: {
      className: "IVBag",
      // Only a loose bag counts as a tool (not one hung on an IV stand)
      onlyIf: (bag) => !bag.attachedTo,
      dataOnlyIf: (d) => d.attachedToId == null,
      matchesAction: (bag, action) => bag.type === action.bagType,
      create: (scene, from) =>
        new IVBag(scene, (from && (from.bagType || from.type)) || "tpn"),
      key: (bag) => "iv_bag_" + (bag.type || "tpn"),
      name: (bag) => (bag.type || "tpn").toUpperCase(),
      fullName: (bag) => `IV Bag (${(bag.type || "tpn").toUpperCase()})`,
      desc: (bag) =>
        `Bag of ${(bag.type || "tpn").toUpperCase()} solution for IV stand delivery.`,
      image: (bag) => {
        if (bag.tintedSprite && bag.tintedSprite.width > 0) return bag.tintedSprite;
        if (typeof bag.createTintedSprite === "function") {
          bag.createTintedSprite();
          if (bag.tintedSprite && bag.tintedSprite.width > 0) return bag.tintedSprite;
        }
        return images.iv_bag;
      },
      multi: true,
      placeableInWorld: true,
    },
    onSell: (bag) => {
      if (bag.attachedTo) bag.attachedTo.attachedBag = null;
    },
  },

  // ---- Not sellable, but can be picked up ----
  {
    sellType: "foal_in_a_can",
    is: (o) => o instanceof FoalInACan,
    inCage: "ignore",
    onRightClick: (can) => can.freeFoal(), // let the foal out
    hitTest: (o, x, y) => {
      const bw = images.foal_in_a_can ? images.foal_in_a_can.width : 60;
      const bh = images.foal_in_a_can ? images.foal_in_a_can.height : 70;
      return isPointInRect(x, y, o.x - bw / 2, o.y - bh, bw, bh);
    },
  },
  {
    // Plain table (the Table and Rack above are special kinds of this)
    sellType: "fluffy_table",
    is: (o) => o instanceof FluffyTable,
    inCage: "never",
  },
];

// Right-click helper: put a tool lying in the world back in the toolbox
function putBackInToolbox(tool) {
  if (typeof addToolToToolbox === "function") addToolToToolbox(tool);
  poofs.push(new Poof(tool.x, tool.y, currentScene));
}

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
  GeneLab: (d) => new GeneLab(d.scene),
  Computer: (d) => new Computer(d.scene),
  Bowl: (d) => new Bowl(d.type, d.scene),
  Grass: (d) => new Grass(d.x, d.y, d.scene),
  BerryBush: (d) => new BerryBush(d.x, d.y, d.scene),
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

// Right-click: returns true if something handled the click.
// First anything being carried, then the front-most item under the mouse.
function handleItemRightClick(x, y) {
  for (const obj of objects) {
    if (!obj.isDragging) continue;
    const entry = getItemType(obj);
    if (entry && entry.onRightClickHeld) {
      entry.onRightClickHeld(obj);
      return true;
    }
  }
  const candidates = [];
  for (const obj of objects) {
    if (obj.scene !== currentScene || obj.isDragging) continue;
    const entry = getItemType(obj);
    if (!entry || !entry.onRightClick) continue;
    if (itemHitTest(obj, x, y)) candidates.push({ obj, entry });
  }
  candidates.sort((a, b) => b.obj.getBottomY() - a.obj.getBottomY());
  for (const { obj, entry } of candidates) {
    if (entry.onRightClick(obj) !== false) return true;
  }
  return false;
}

// Shop button picture: { imageKey } or { draw(ctx, btnSize) }
function getShopIcon(action) {
  const entry = ITEM_TYPES.find(
    (e) => (e.shopItem || e.sellType) === action.isItem,
  );
  if (entry && entry.drawIcon) return { draw: entry.drawIcon };
  if (entry && entry.icon) {
    return {
      imageKey: typeof entry.icon === "function" ? entry.icon(action) : entry.icon,
    };
  }
  return { imageKey: action.isItem };
}

// ---- Tool lookups (used by the toolbox code in globals.js) ----

// The registry entry for a tool object, or null if it isn't a tool
function getToolEntry(obj) {
  if (!obj) return null;
  const entry = getItemType(obj);
  return entry && entry.tool ? entry : null;
}

// The registry entry for saved tool data ({ classType: "Knife", ... })
function getToolEntryForData(data) {
  if (!data) return null;
  return (
    ITEM_TYPES.find(
      (e) =>
        e.tool &&
        e.tool.className === data.classType &&
        (!e.tool.matchData || e.tool.matchData(data)),
    ) || null
  );
}

// The registry entry for a tool in the shop
function getToolEntryForAction(action) {
  if (!action || !action.isItem) return null;
  return (
    ITEM_TYPES.find(
      (e) => e.tool && (e.shopItem || e.sellType) === action.isItem,
    ) || null
  );
}

// Read a tool field that may be a plain value or a function(tool)
function toolField(entry, field, tool) {
  const v = entry.tool[field];
  return typeof v === "function" ? v(tool) : v;
}

// Dropping an item: "yes", "never" or "ignore" (see `inCage` at the top)
function itemCageRule(obj) {
  const entry = getItemType(obj);
  return (entry && entry.inCage) || "yes";
}

// Re-create an object from save data (or null if the class is unknown)
function createItemFromSave(data) {
  const make = SAVED_CLASSES[data.classType];
  return make ? make(data) : null;
}
