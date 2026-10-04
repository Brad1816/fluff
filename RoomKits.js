// ---------------------------------------------------------------------------
// Room kits (playtest 6): pay once and a room of yours is fitted out for a
// job - everything from Fluff Mart for it, set out in a sensible layout.
//
// The "Fit out" chip on the room's wall (next to its name; the house rooms,
// not the backyard) asks which kit, then shows what's in it and the price -
// the shop prices less ROOM_KIT_DISCOUNT. Pay, and it all appears in the
// room straight away:
//   cages along the back wall, side by side (tags set, their bowls,
//   feeders, litterboxes and beds inside), and everything else along the
//   front. Tools go in your toolbox.
// Anything already in the room stays where it is (the new things are put
// down round it - tidy up first if you want the neat layout).
//
// Kits: ROOM_KITS. Each cage: { kind: "Cage" | "Incubator", tag, inside: [shop
// names] }; floor: [shop names]; tools: [shop names].
// ---------------------------------------------------------------------------

const ROOM_KIT_DISCOUNT = 0.1;

const ROOM_KITS = [
  {
    key: "mill",
    name: "Mill",
    title: "Breeding mill",
    blurb: "Eight cages in two rows (six breeding, a sale cage and an incubator), each with a bowl, water and a litterbox; a Feed-Bot and sacks of value kibble to load it, a Fluff-Bot for the litterboxes, and two Auto-Trainers by the cages - it nearly runs itself.",
    cages: [
      { kind: "Cage", tag: "breeding", row: 0, inside: ["Bowl", "Water bowl", "Litterbox"] },
      { kind: "Cage", tag: "breeding", row: 0, inside: ["Bowl", "Water bowl", "Litterbox"] },
      { kind: "Cage", tag: "breeding", row: 0, inside: ["Bowl", "Water bowl", "Litterbox"] },
      { kind: "Cage", tag: "breeding", row: 0, inside: ["Bowl", "Water bowl", "Litterbox"] },
      { kind: "Cage", tag: "breeding", row: 1, inside: ["Bowl", "Water bowl", "Litterbox"] },
      { kind: "Cage", tag: "breeding", row: 1, inside: ["Bowl", "Water bowl", "Litterbox"] },
      { kind: "Cage", tag: "sell", row: 1, inside: ["Bowl", "Water bowl"] },
      { kind: "Incubator", tag: "none", row: 1, inside: [] },
    ],
    // (an Auto-Trainer at each end of the front row, beside the cages)
    beside: ["Auto-Trainer", "Auto-Trainer"],
    floor: ["Feed-Bot", "Fluff-Bot", "Value Kibble", "Value Kibble", "Value Kibble", "Value Kibble"],
  },
  {
    key: "family",
    name: "Family",
    title: "Family room",
    blurb: "Beds, bowls, water, kibble, balls, blocks, a plushie, litterboxes and a night light - a room to live in.",
    floor: ["Bed", "Bed", "Bowl", "Bowl", "Water bowl", "Kibble", "Kibble", "Ball", "Ball", "Block", "Block", "Plushie", "Litterbox", "Litterbox", "Night Light"],
  },
  {
    key: "nursery",
    name: "Nursery",
    title: "Nursery",
    blurb: "An incubator, a soft cage with a bed and a feeder, formula, plushies, a ball, a heater, a night light, water and a litterbox.",
    cages: [
      { kind: "Incubator", tag: "none", inside: [] },
      { kind: "Cage", tag: "none", inside: ["Bed", "Feeder", "Plushie"] },
    ],
    floor: ["Formula", "Formula", "Plushie", "Ball", "Heater", "Night Light", "Water bowl", "Bowl", "Litterbox"],
  },
  {
    key: "clinic",
    name: "Clinic",
    title: "Clinic",
    blurb: "An operating table, a rack, a recovery cage with a bed and water, kibble, and bandages for your toolbox.",
    cages: [{ kind: "Cage", tag: "none", inside: ["Bed", "Water bowl", "Bowl"] }],
    floor: ["Table", "Rack", "Kibble"],
    tools: ["Bandages"],
  },
];

function _kitAction(name) {
  return SPAWN_ACTIONS.find((a) => a.name === name) || null;
}

// Every shop name in a kit (with repeats)
function roomKitNames(kit) {
  const names = [];
  for (const c of kit.cages || []) {
    names.push(c.kind === "Incubator" ? "Incubator" : "Cage");
    names.push(...c.inside);
  }
  names.push(...(kit.beside || []), ...(kit.floor || []), ...(kit.tools || []));
  return names;
}

function roomKitPrice(kit) {
  let sum = 0;
  for (const n of roomKitNames(kit)) {
    const a = _kitAction(n);
    if (a) sum += a.cost || 0;
  }
  return Math.round((sum * (1 - ROOM_KIT_DISCOUNT)) / 10) * 10;
}

function canFitOutRoom(scene) {
  return typeof playerQuartersAndNotBackyard === "function" ? playerQuartersAndNotBackyard(scene) : !!getSceneConfig(scene).insidePlayerQuarters;
}

// Make a shop thing and put it down at (x, y) in the room
function _kitPlace(action, scene, x, y) {
  if (typeof isToolAction === "function" && isToolAction(action)) {
    const tool = typeof createToolFromAction === "function" ? createToolFromAction(action) : null;
    if (tool && typeof addToolToToolbox === "function") addToolToToolbox(tool);
    return tool;
  }
  const type = getItemTypeForAction(action);
  if (!type) return null;
  const wasScene = currentScene;
  const wasDragging = isGlobalDragging;
  let obj;
  try {
    currentScene = scene;
    obj = type.create(action, x, y);
  } finally {
    currentScene = wasScene;
  }
  if (!obj) {
    isGlobalDragging = wasDragging;
    return null;
  }
  obj.scene = scene;
  obj.isDragging = false;
  if (typeof obj.setPosition === "function") obj.setPosition(x, y);
  else {
    obj.x = x;
    obj.y = y;
  }
  if (!objects.includes(obj)) objects.push(obj);
  if (type.afterCreate && type.sellType !== "fence" && type.sellType !== "fence_gate") type.afterCreate(obj);
  if (typeof Cage !== "undefined" && obj instanceof Cage) {
    if (typeof obj.updateBounds === "function") obj.updateBounds();
  } else if (typeof handleDropping === "function") handleDropping(obj); // (into the cage it's in)
  isGlobalDragging = wasDragging;
  return obj;
}

// Fit the room out. Returns the things made (or null if it couldn't).
function fitOutRoom(kitKey, scene = currentScene, pay = true) {
  const kit = ROOM_KITS.find((k) => k.key === kitKey);
  if (!kit || !canFitOutRoom(scene)) return null;
  const price = roomKitPrice(kit);
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (pay && !free && money < price) {
    if (typeof addUIMessage === "function") addUIMessage(`Not enough money ($${price.toLocaleString()}).`);
    return null;
  }
  const made = [];
  const top = (typeof sceneTop === "function" ? sceneTop(scene) : height * 0.15) + 30;
  const bottom = height - 190; // (above the toolbar)
  // Cages along the back, side by side
  const cages = [];
  for (const spec of kit.cages || []) {
    const a = _kitAction(spec.kind === "Incubator" ? "Incubator" : "Cage");
    const cage = a && _kitPlace(a, scene, width / 2, top + 150);
    if (!cage) continue;
    if (spec.tag && "tag" in cage) cage.tag = spec.tag;
    cages.push({ cage, spec });
    made.push(cage);
  }
  const rows = [];
  for (const c of cages) (rows[c.spec.row || 0] = rows[c.spec.row || 0] || []).push(c);
  let rowTop = top;
  for (const row of rows.filter(Boolean)) {
    const widths = row.map(({ cage }) => cage.bounds.right - cage.bounds.left);
    const total = widths.reduce((s, w) => s + w, 0);
    let x = Math.max(20, width / 2 - total / 2);
    let rowBottom = rowTop;
    row.forEach(({ cage }, i) => {
      const h = cage.bounds.bottom - cage.bounds.top;
      // (an incubator is shorter: it sits on the same floor as the cages)
      const tallest = Math.max(...row.map(({ cage: c }) => c.bounds.bottom - c.bounds.top));
      const cx = x + widths[i] / 2;
      const cy = rowTop + tallest - h / 2;
      if (cage.setPosition) cage.setPosition(cx, cy);
      else {
        cage.x = cx;
        cage.y = cy;
      }
      cage.updateBounds();
      rowBottom = Math.max(rowBottom, cage.bounds.bottom);
      x += widths[i];
    });
    row.bottom = rowBottom;
    row.left = Math.max(20, width / 2 - total / 2);
    row.right = row.left + total;
    rowTop = rowBottom + 8;
  }
  // What goes in each
  for (const { cage, spec } of cages) {
    const b = cage.bounds;
    const n = spec.inside.length;
    spec.inside.forEach((name, i) => {
      const a = _kitAction(name);
      if (!a) return;
      const ix = b.left + ((i + 1) * (b.right - b.left)) / (n + 1);
      const obj = _kitPlace(a, scene, ix, b.bottom - 14);
      if (obj) made.push(obj);
    });
  }
  // Machines beside the front row's ends
  const front = rows.filter(Boolean).slice(-1)[0];
  (kit.beside || []).forEach((name, i) => {
    const a = _kitAction(name);
    if (!a || !front) return;
    const x = i % 2 === 0 ? Math.max(40, front.left - 55) : Math.min(width - 40, front.right + 55);
    const obj = _kitPlace(a, scene, x, front.bottom);
    if (obj) made.push(obj);
  });
  // Everything else along the front (two rows if it's a lot)
  const floor = kit.floor || [];
  const perRow = Math.max(1, Math.min(floor.length, Math.floor((width - 120) / 80)));
  const backRowY = cages.length ? Math.min(bottom - 40, Math.max(...cages.map(({ cage }) => cage.bounds.bottom)) + 60) : top + (bottom - top) * 0.45;
  floor.forEach((name, i) => {
    const a = _kitAction(name);
    if (!a) return;
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, floor.length - row * perRow);
    const col = i % perRow;
    const x = width / 2 + (col - (inRow - 1) / 2) * Math.min(110, (width - 120) / inRow);
    const y = row === 0 ? (floor.length > perRow ? backRowY : (backRowY + bottom) / 2) : Math.min(bottom, backRowY + row * 90);
    const obj = _kitPlace(a, scene, x, y);
    if (obj) made.push(obj);
  });
  // A Feed-Bot comes loaded with the kit's food (what doesn't fit stays in its bags)
  const bot = made.find((o) => typeof FeedBot !== "undefined" && o instanceof FeedBot);
  if (bot && typeof bot.load === "function") {
    for (const bag of made.filter((o) => typeof FoodBag !== "undefined" && o instanceof FoodBag && objects.includes(o))) {
      const n = bot.load(bag.type, bag.amount);
      bag.amount -= n;
      if (bag.amount <= 0) {
        objects.splice(objects.indexOf(bag), 1);
        made.splice(made.indexOf(bag), 1);
      }
    }
  }
  for (const name of kit.tools || []) {
    const a = _kitAction(name);
    const t = a && _kitPlace(a, scene, 0, 0);
    if (t) made.push(t);
  }
  if (pay && !free) money -= price;
  if (typeof poofs !== "undefined" && typeof Poof !== "undefined") for (const o of made) if (o.scene === scene) poofs.push(new Poof(o.x, o.y, scene));
  if (typeof addUIMessage === "function") addUIMessage(`${houseRoomName(scene) || "The room"} is fitted out as a ${kit.title.toLowerCase()}.`);
  return made;
}

// ---- Asking ----

function askFitOutRoom(scene = currentScene) {
  if (!canFitOutRoom(scene) || typeof openChoice !== "function") return false;
  const room = (typeof houseRoomName === "function" && houseRoomName(scene)) || "this room";
  openChoice({
    title: `Fit out ${room}`,
    lines: [
      "Pay once and everything for the job is set out in here.",
      ...ROOM_KITS.map((k) => `${k.title}: $${roomKitPrice(k).toLocaleString()}`),
    ],
    buttons: [
      ...ROOM_KITS.map((k) => ({ label: k.name, run: () => askRoomKit(k.key, scene) })),
      { label: "Cancel", cancel: true, run: () => {} },
    ],
  });
  return true;
}

function askRoomKit(key, scene = currentScene) {
  const kit = ROOM_KITS.find((k) => k.key === key);
  if (!kit) return false;
  const price = roomKitPrice(kit);
  const room = (typeof houseRoomName === "function" && houseRoomName(scene)) || "this room";
  const busy = objects.some((o) => o.scene === scene && !(typeof isToolObject === "function" && isToolObject(o)));
  openChoice({
    title: `${kit.title} - $${price.toLocaleString()}`,
    lines: [
      kit.blurb,
      `${Math.round(ROOM_KIT_DISCOUNT * 100)}% less than buying it all one by one.`,
      ...(busy ? [`What's in ${room} already stays put.`] : []),
    ],
    buttons: [
      { label: `Pay $${price.toLocaleString()}`, kind: "ok", run: () => fitOutRoom(key, scene) },
      { label: "Back", cancel: true, run: () => askFitOutRoom(scene) },
    ],
  });
  return true;
}
