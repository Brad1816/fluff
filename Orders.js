// ---------------------------------------------------------------------------
// Customer orders.
//
// Customers post orders ("a litter-trained unicorn foal with nice colours")
// on the bounty board on Shopping Street and on FluffList, the website on
// the Computer (a store item). You accept up to ORDER_MAX_ACTIVE at a time;
// each accepted order has a deadline in game time. Deliver by picking one
// of your fluffies that matches every requirement: a courier collects it
// and you're paid the reward.
//
// Reputation goes up for filled orders (more for harder ones) and down for
// missed deadlines or giving up. Higher levels bring more orders, harder
// requirements (alicorns, patterns, hidden carrier genes) and bigger rewards.
//
// Everything is in `customerOrders` (saved in SAVED_GAME_STATE).
// To add a new kind of requirement, add an entry to ORDER_REQUIREMENTS.
// ---------------------------------------------------------------------------

const ORDER_MAX_ACTIVE = 3;
const ORDER_BOARD_LIFETIME = 15 * 60; // game seconds a posted order stays up
const ORDER_POST_INTERVAL = [120, 240]; // game seconds between new orders
const ORDER_REP_LEVELS = [
  { points: 0, name: "Backyard breeder" },
  { points: 5, name: "Known breeder" },
  { points: 15, name: "Trusted breeder" },
  { points: 30, name: "Renowned breeder" },
  { points: 55, name: "Master breeder" },
];
const ORDER_REP_MISSED = 3; // lost when an accepted order runs out of time
const ORDER_REP_GIVE_UP = 2; // lost when you give up an accepted order

function freshCustomerOrders() {
  return {
    posted: [], // on the board, not taken yet
    active: [], // accepted by you, with a deadline
    reputation: 0,
    filled: 0,
    missed: 0,
    nextId: 1,
    postTimer: 0, // first orders appear straight away
  };
}

let customerOrders = freshCustomerOrders();

// ---- Requirements ----
// Each: minLevel (reputation level needed), value (adds to the reward),
// make(rnd, level, taken) -> the requirement's details or null,
// label(req) -> text, matches(req, fluffy) -> true/false.
// `taken` = kinds already in this order (so no clashes).

const ORDER_COAT_COLOURS = ["bwue", "pink", "gween", "puwpuw", "wed", "yewwow", "owange", "gway", "wite", "bwack"];

function _orderGenes(f) {
  return typeof describeGenes === "function" ? describeGenes(f.genes) : null;
}

const ORDER_REQUIREMENTS = {
  type: {
    minLevel: 1,
    weight: 3,
    make: (rnd, level, taken) => {
      let options = [["earthy", 60], ["unicorn", 200], ["pegasus", 200]];
      if (level >= 3) options.push(["alicorn", 1500]);
      // Can't both carry hidden wings/horn and show them
      const hidden = taken.carrier && taken.carrier.trait;
      if (hidden === "wings") options = options.filter(([t]) => t !== "pegasus" && t !== "alicorn");
      if (hidden === "horn") options = options.filter(([t]) => t !== "unicorn" && t !== "alicorn");
      const [type, value] = options[Math.floor(rnd() * options.length)];
      return { type, value };
    },
    label: (r) => `${r.type === "earthy" ? "An" : "A"} ${r.type}`,
    matches: (r, f) => f.type === r.type,
  },
  gender: {
    minLevel: 1,
    weight: 2,
    make: (rnd) => ({ gender: rnd() < 0.5 ? "female" : "male", value: 60 }),
    label: (r) => (r.gender === "female" ? "Female (mare)" : "Male (stallion)"),
    matches: (r, f) => f.gender === r.gender,
  },
  age: {
    minLevel: 1,
    weight: 2,
    make: (rnd) => (rnd() < 0.5 ? { foal: true, value: 120 } : { foal: false, value: 40 }),
    label: (r) => (r.foal ? "Still a foal" : "Fully grown"),
    matches: (r, f) => (r.foal ? f.growth < 1 : f.growth >= 1),
  },
  coat: {
    minLevel: 1,
    weight: 2,
    make: (rnd, level) => {
      if (level >= 2 && rnd() < 0.5) {
        const colour = ORDER_COAT_COLOURS[Math.floor(rnd() * ORDER_COAT_COLOURS.length)];
        return { colour, value: 300 };
      }
      return { nice: true, value: 200 };
    },
    label: (r) => (r.colour ? `Coat colour: ${r.colour}` : "Nice coat colours (not poopie or drab)"),
    matches: (r, f) =>
      r.colour
        ? f.getColorName && f.getColorName() === r.colour
        : f.genetics && f.genetics.calculateColorismPerception() >= 0.9,
  },
  pattern: {
    minLevel: 2,
    weight: 1,
    make: (rnd) => ({ pattern: ["spots", "stripes", "gradient"][Math.floor(rnd() * 3)], value: 350 }),
    label: (r) => `Has ${r.pattern}`,
    matches: (r, f) =>
      r.pattern === "spots" ? !!f.hasSpots : r.pattern === "stripes" ? !!f.hasStripes : !!f.hasGradient,
  },
  trained: {
    minLevel: 1,
    weight: 2,
    make: (rnd, level) => (level >= 2 && rnd() < 0.6 ? { full: true, value: 600 } : { full: false, value: 250 }),
    label: (r) => (r.full ? "Fully litter trained" : "At least half litter trained"),
    matches: (r, f) => (f.pottyTraining || 0) >= (r.full ? 0.999 : 0.5),
  },
  happy: {
    minLevel: 1,
    weight: 1,
    make: () => ({ value: 150 }),
    label: () => "Happy",
    matches: (r, f) => f.happiness > HAPPINESS_HAPPY_THRESHOLD,
  },
  noSmarty: {
    minLevel: 1,
    weight: 1,
    make: () => ({ value: 80 }),
    label: () => "Not a smarty",
    matches: (r, f) => !(f.isSmarty && f.isSmarty()),
  },
  whole: {
    minLevel: 1,
    weight: 1,
    make: () => ({ value: 100 }),
    label: () => "No missing body parts",
    matches: (r, f) => !f.getMissingBodyParts || f.getMissingBodyParts().length === 0,
  },
  size: {
    minLevel: 3,
    weight: 1,
    make: (rnd) => ({ big: rnd() < 0.5, value: 300 }),
    label: (r) => (r.big ? "Big (size genes)" : "Small (size genes)"),
    matches: (r, f) => {
      const g = _orderGenes(f);
      return !!g && (r.big ? g.size >= 2 : g.size <= -2);
    },
  },
  trait: {
    // Personality traits (Traits.js)
    minLevel: 2,
    weight: 1.5,
    make: (rnd) => {
      const options = ["Brave", "Social", "Playful", "Gentle", "Picky eater"];
      return { trait: options[Math.floor(rnd() * options.length)], value: 300 };
    },
    label: (r) => `Personality: ${r.trait}`,
    matches: (r, f) => typeof hasTraitLabel === "function" && hasTraitLabel(f, r.trait),
  },
  carrier: {
    minLevel: 4,
    weight: 1,
    make: (rnd, level, taken) => {
      // Carrying wings means not having them, so skip if the type has them
      const t = taken.type && taken.type.type;
      const options = [];
      if (!t || t === "earthy" || t === "unicorn") options.push("wings");
      if (!t || t === "earthy" || t === "pegasus") options.push("horn");
      if (!options.length) return null;
      return { trait: options[Math.floor(rnd() * options.length)], value: 700 };
    },
    label: (r) => `Carries hidden ${r.trait === "wings" ? "wing" : "horn"} genes`,
    matches: (r, f) => {
      const g = _orderGenes(f);
      return !!g && (r.trait === "wings" ? g.wings === 3 : g.horn === 3);
    },
  },
};

const ORDER_CUSTOMERS = [
  "Mrs. Pennywhistle", "Dr. Hoofington", "Old Man Barley", "Little Suzie", "Mr. Grimsby",
  "The Petal Twins", "Professor Quill", "Aunt Marigold", "Captain Bramble", "Ms. Tinsel",
  "Farmer Oats", "Lady Featherby", "Coach Rumble", "Nana Dumpling", "Sir Reginald",
];
const ORDER_NOTES = [
  "It's a birthday present!",
  "My old one ran away...",
  "For my show stable.",
  "My kids have been begging for one.",
  "Need it for breeding.",
  "Will pay well for the right one!",
  "Must be exactly as described.",
  "For my grandmother's farm.",
  "Looking for a companion for my other fluffy.",
  "I've heard you're the best breeder in town.",
];

// ---- Reputation ----

function getOrderLevel(points = customerOrders.reputation) {
  let level = 1;
  ORDER_REP_LEVELS.forEach((l, i) => {
    if (points >= l.points) level = i + 1;
  });
  return level;
}

function getOrderLevelInfo() {
  const level = getOrderLevel();
  const cur = ORDER_REP_LEVELS[level - 1];
  const next = ORDER_REP_LEVELS[level] || null;
  return { level, name: cur.name, points: customerOrders.reputation, from: cur.points, to: next ? next.points : null };
}

function _orderMaxPosted(level = getOrderLevel()) {
  return 3 + Math.floor(level / 2);
}

// ---- Making orders ----

function _orderReqCount(level, rnd) {
  const ranges = [[1, 2], [2, 2], [2, 3], [3, 3], [3, 4]];
  const [lo, hi] = ranges[Math.min(level, 5) - 1];
  return lo + Math.floor(rnd() * (hi - lo + 1));
}

// A new order for this reputation level. rnd: random function (tests pass
// a seeded one; the game uses Math.random).
function makeCustomerOrder(level = getOrderLevel(), rnd = Math.random) {
  const want = _orderReqCount(level, rnd);
  const reqs = [];
  const taken = {};
  let tries = 0;
  while (reqs.length < want && tries++ < 50) {
    const kinds = Object.keys(ORDER_REQUIREMENTS).filter(
      (k) => !taken[k] && ORDER_REQUIREMENTS[k].minLevel <= level,
    );
    if (!kinds.length) break;
    const total = kinds.reduce((s, k) => s + ORDER_REQUIREMENTS[k].weight, 0);
    let pick = rnd() * total;
    let kind = kinds[kinds.length - 1];
    for (const k of kinds) {
      pick -= ORDER_REQUIREMENTS[k].weight;
      if (pick <= 0) {
        kind = k;
        break;
      }
    }
    const made = ORDER_REQUIREMENTS[kind].make(rnd, level, taken);
    if (!made) {
      taken[kind] = { skipped: true };
      continue;
    }
    const req = { kind, ...made };
    taken[kind] = req;
    reqs.push(req);
  }
  const valueSum = reqs.reduce((s, r) => s + (r.value || 0), 0);
  const reward =
    Math.round(((100 + valueSum) * (1 + 0.3 * (level - 1)) * (1 + 0.15 * (reqs.length - 1))) / 10) * 10;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  return {
    id: customerOrders.nextId++,
    customer: ORDER_CUSTOMERS[Math.floor(rnd() * ORDER_CUSTOMERS.length)],
    note: ORDER_NOTES[Math.floor(rnd() * ORDER_NOTES.length)],
    reqs,
    reward,
    level,
    postedAt: now,
    leavesAt: now + ORDER_BOARD_LIFETIME,
    timeAllowed: 600 + 300 * reqs.length, // once accepted: 15-35 game minutes
    dueAt: null,
  };
}

function orderReqLabel(req) {
  const def = ORDER_REQUIREMENTS[req.kind];
  return def ? def.label(req) : req.kind;
}

function orderReqMatches(req, f) {
  const def = ORDER_REQUIREMENTS[req.kind];
  try {
    return !!(def && def.matches(req, f));
  } catch (e) {
    return false;
  }
}

// Can this fluffy be sent for this order? (yours, alive, meets everything)
function fluffyFitsOrder(order, f) {
  return !!f && f.isAlive && f.adopted && order.reqs.every((r) => orderReqMatches(r, f));
}

function orderCandidates(order) {
  return fluffies.filter((f) => f.isAlive && f.adopted);
}

function countFluffiesForOrder(order) {
  return orderCandidates(order).filter((f) => fluffyFitsOrder(order, f)).length;
}

// ---- Actions ----

function acceptCustomerOrder(orderId) {
  const i = customerOrders.posted.findIndex((o) => o.id === orderId);
  if (i < 0) return false;
  if (customerOrders.active.length >= ORDER_MAX_ACTIVE) {
    if (typeof addUIMessage === "function") addUIMessage(`You can only take ${ORDER_MAX_ACTIVE} orders at a time.`);
    return false;
  }
  const order = customerOrders.posted.splice(i, 1)[0];
  order.dueAt = (typeof timePlayed === "number" ? timePlayed : 0) + order.timeAllowed;
  customerOrders.active.push(order);
  return true;
}

function giveUpCustomerOrder(orderId) {
  const i = customerOrders.active.findIndex((o) => o.id === orderId);
  if (i < 0) return false;
  customerOrders.active.splice(i, 1);
  customerOrders.reputation = Math.max(0, customerOrders.reputation - ORDER_REP_GIVE_UP);
  if (typeof addUIMessage === "function") addUIMessage(`Order given up. Reputation -${ORDER_REP_GIVE_UP}.`);
  return true;
}

// Send a fluffy for an order. Returns true if it went.
function deliverCustomerOrder(orderId, fluffyId) {
  const i = customerOrders.active.findIndex((o) => o.id === orderId);
  if (i < 0) return false;
  const order = customerOrders.active[i];
  const f = fluffies.find((x) => x.id === fluffyId);
  if (!fluffyFitsOrder(order, f)) return false;

  const before = getOrderLevel();
  customerOrders.active.splice(i, 1);
  customerOrders.filled++;
  customerOrders.reputation += order.reqs.length;
  if (!showDebugMenu) money += order.reward;

  // The courier takes the fluffy away (like selling it)
  if (typeof noteFluffyLeft === "function") noteFluffyLeft(f, "sold");
  if (f.isDragging) {
    f.isDragging = false;
    isGlobalDragging = false;
  }
  if (typeof poofs !== "undefined" && typeof Poof !== "undefined") poofs.push(new Poof(f.x, f.y, f.scene));
  const idx = fluffies.indexOf(f);
  if (idx > -1) fluffies.splice(idx, 1);

  if (typeof addUIMessage === "function") {
    addUIMessage(`Order filled for ${order.customer}! +$${order.reward}`);
    const after = getOrderLevel();
    if (after > before) addUIMessage(`Reputation up: you're now a ${ORDER_REP_LEVELS[after - 1].name}!`);
  }
  return true;
}

// ---- Every simulation step (script.js) ----

function updateCustomerOrders(dt) {
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  // Fill in anything missing (e.g. a save from a version without some field)
  const fresh = freshCustomerOrders();
  for (const key in fresh) {
    if (customerOrders[key] === undefined || customerOrders[key] === null) customerOrders[key] = fresh[key];
  }
  const o = customerOrders;

  // Unaccepted orders leave the board after a while
  o.posted = o.posted.filter((order) => order.leavesAt > now);

  // Accepted orders that run out of time
  for (let i = o.active.length - 1; i >= 0; i--) {
    const order = o.active[i];
    if (order.dueAt !== null && now >= order.dueAt) {
      o.active.splice(i, 1);
      o.missed++;
      o.reputation = Math.max(0, o.reputation - ORDER_REP_MISSED);
      if (typeof addUIMessage === "function")
        addUIMessage(`Missed ${order.customer}'s order. Reputation -${ORDER_REP_MISSED}.`);
    } else if (order.dueAt !== null && !order.warned && order.dueAt - now < 180) {
      order.warned = true;
      if (typeof addUIMessage === "function") addUIMessage(`${order.customer}'s order is due in 3 minutes!`);
    }
  }

  // New orders
  o.postTimer -= dt;
  if (o.postTimer <= 0) {
    const [lo, hi] = ORDER_POST_INTERVAL;
    o.postTimer = lo + Math.random() * (hi - lo);
    const max = _orderMaxPosted();
    // Top the board up; at the very start post a few at once
    const toPost = o.posted.length === 0 && o.filled === 0 && o.active.length === 0 ? 3 : 1;
    for (let k = 0; k < toPost && o.posted.length < max; k++) {
      o.posted.push(makeCustomerOrder());
    }
  }
}

// "in 12 min" / "in 40 s"
function formatOrderTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  if (s >= 60) return `${Math.floor(s / 60)} min`;
  return `${s} s`;
}
