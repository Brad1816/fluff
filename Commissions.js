// ---------------------------------------------------------------------------
// Commissions and regular customers (on top of Orders.js).
//
// COMMISSIONS: a customer asks you to BREED a fluffy for them. There's
// always one on the Bounty Board (a gold border, "Commission"); each stays
// up a day, then a new one takes its place (COMMISSION_EVERY). Alicorn
// commissions only from game day COMMISSION_ALICORN_DAY. FluffList, the website on the Computer, has its
// own exclusive one too, a tier harder and better paid (EXCLUSIVE_*); the
// board never shows it. Every commission needs
// "Bred by you" (born to one of your mares - f.bredHere, set at birth by
// Pregnancy.js onFoalBorn) plus things you breed for (type, coat, pattern,
// size, hidden genes, personality...). You get COMMISSION_DAYS game days to
// deliver (a day more if it has to be grown up), enough to pair, wait out
// the pregnancy and raise a foal. They pay COMMISSION_MULT times a normal
// order: a deposit (COMMISSION_DEPOSIT of it) when you accept, the rest on
// delivery. Give up or run out of time and the deposit goes back, and your
// reputation takes a bigger hit.
//
// REGULAR CUSTOMERS: customerOrders.clients[name] = { filled, missed,
// loyalty, pref }. Filling an order raises that customer's loyalty (more
// if they loved the fluffy); missing or giving one up lowers it. Customers
// you've pleased come back (pickOrderCustomer), and pay more and give you
// longer the more loyal they are (CLIENT_TIERS: Returning +5%, Regular +15%
// and +15% time, Loyal +25% and +25% time). Each customer has a favourite
// type (pref, from their name) that often shows up in their orders.
// Customers you've let down twice won't order again for a few days
// (customerIsUpset, CUSTOMER_SULK_DAYS).
//
// LETTERS: a while after a delivery the customer writes about how the
// fluffy is doing - a tip if they adore it, a complaint (and less loyalty)
// if it's frightened of everything (customerOrders.letters).
// ---------------------------------------------------------------------------

const COMMISSION_ALICORN_DAY = 4; // alicorn commissions from this game day
const COMMISSION_ALICORN_CHANCE = 0.2; // share of type requirements that are alicorns then
const COMMISSION_EVERY = 1; // game days each stays up before a new one replaces it
const EXCLUSIVE_MULT = 3.5; // FluffList exclusives: reward vs a normal order
const EXCLUSIVE_EXTRA_DAYS = 1; // ...and a day longer to deliver
const COMMISSION_DAYS = 4; // game days to deliver (+2 if it must be grown: foals take 2 days to grow up)
const COMMISSION_MULT = 2.5; // reward compared with a normal order
const COMMISSION_DEPOSIT = 0.2; // share of the reward paid when you accept
const COMMISSION_REP_MISSED = 5;
const CLIENT_RETURN_CHANCE = 0.45; // chance an order comes from a customer you've pleased
const CLIENT_TIERS = [
  { loyalty: 6, name: "Loyal", bonus: 0.25, time: 0.25 },
  { loyalty: 3, name: "Regular", bonus: 0.15, time: 0.15 },
  { loyalty: 1, name: "Returning", bonus: 0.05, time: 0 },
];
const COMMISSION_NOTES = [
  "Breed me one - I'll wait for the right fluffy.",
  "Take your time and get it right.",
  "I want one from a proper breeder, not a pet shop.",
  "For my daughter's birthday next week!",
  "I've seen your foals. Breed me one like that.",
  "Money's no object. It has to be exactly this.",
];

// ---- "Bred by you" ----

function isBredByYou(f) {
  if (!f) return false;
  if (f.bredHere === true) return true;
  if (f.bredHere === false) return false;
  // Older saves: born to a mare while she was yours
  return f.motherId !== null && f.motherId !== undefined && !!f.adopted && !f.fromPark && !f.lostPet;
}

ORDER_REQUIREMENTS.bredHere = {
  minLevel: 99, // never picked for ordinary orders
  weight: 0,
  make: () => ({ value: 0 }),
  label: () => "Bred by you",
  matches: (r, f) => isBredByYou(f),
};

// ---- Customers ----

function _clients() {
  if (!customerOrders.clients || typeof customerOrders.clients !== "object") customerOrders.clients = {};
  return customerOrders.clients;
}

// A customer's favourite type, fixed by their name
function customerPref(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ["unicorn", "pegasus", "earthy", "unicorn", "pegasus", null][h % 6];
}

function getClient(name) {
  const all = _clients();
  if (!all[name]) all[name] = { filled: 0, missed: 0, loyalty: 0, pref: customerPref(name) };
  return all[name];
}

function clientTier(name) {
  const c = _clients()[name];
  if (!c) return null;
  return CLIENT_TIERS.find((t) => c.loyalty >= t.loyalty) || null;
}

// Let down twice (loyalty -2 or less): won't order for CUSTOMER_SULK_DAYS
// game days, then gives you another chance (loyalty back to -1)
const CUSTOMER_SULK_DAYS = 3;
function customerIsUpset(name) {
  const c = _clients()[name];
  if (!c || c.loyalty > -2) return false;
  const today = typeof getDayNumber === "function" ? getDayNumber() : 0;
  if (typeof c.upsetDay !== "number") c.upsetDay = today;
  if (today - c.upsetDay >= CUSTOMER_SULK_DAYS) {
    c.loyalty = -1;
    c.upsetDay = null;
    return false;
  }
  return true;
}

// Who's ordering: often someone you've pleased before (Orders.js)
function pickOrderCustomer(rnd = Math.random) {
  const all = _clients();
  const pleased = Object.keys(all).filter((n) => all[n].loyalty >= 1);
  if (pleased.length && rnd() < CLIENT_RETURN_CHANCE) {
    const total = pleased.reduce((s, n) => s + all[n].loyalty, 0);
    let pick = rnd() * total;
    for (const n of pleased) {
      pick -= all[n].loyalty;
      if (pick <= 0) return n;
    }
    return pleased[pleased.length - 1];
  }
  const open = ORDER_CUSTOMERS.filter((n) => !customerIsUpset(n));
  const from = open.length ? open : ORDER_CUSTOMERS;
  return from[Math.floor(rnd() * from.length)];
}

// Loyal customers pay more and give more time
function applyClientBonus(order) {
  const tier = clientTier(order.customer);
  if (!tier) return order;
  order.reward = Math.round((order.reward * (1 + tier.bonus)) / 10) * 10;
  order.timeAllowed = Math.round(order.timeAllowed * (1 + tier.time));
  order.tier = tier.name;
  return order;
}

// Their favourite type in their order (Orders.js makeCustomerOrder)
function customerTypeRequirement(name, level, rnd) {
  const pref = getClientOrPref(name);
  if (!pref || rnd() >= 0.5) return null;
  const values = { earthy: 60, unicorn: 200, pegasus: 200 };
  return { kind: "type", type: pref, value: values[pref] };
}

function getClientOrPref(name) {
  const c = _clients()[name];
  return c ? c.pref : customerPref(name);
}

// After a delivery (Orders.js deliverCustomerOrder)
function noteOrderFilled(order, f, reaction) {
  const c = getClient(order.customer);
  c.filled++;
  c.loyalty += 1 + (reaction && reaction.money > 0 ? 1 : 0);
  // A letter later on, about how it's doing
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  const mood = reaction && reaction.money > 0 ? "delighted" : reaction && reaction.money < 0 ? "upset" : "fine";
  if (mood !== "fine" || Math.random() < 0.5) {
    const letters = customerOrders.letters || (customerOrders.letters = []);
    letters.push({
      at: now + DAY_LENGTH * (0.5 + Math.random() * 0.5),
      customer: order.customer,
      fluffy: typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "the fluffy",
      mood,
      tip: mood === "delighted" ? Math.max(10, Math.round((order.reward * 0.1) / 5) * 5) : 0,
    });
  }
}

// After a missed or given-up order
function noteOrderFailed(order) {
  const c = getClient(order.customer);
  c.missed++;
  c.loyalty -= 1; // twice and they sulk for a while (customerIsUpset)
  // A commission's deposit goes back
  if (order.commission && order.depositPaid) {
    money = Math.max(0, money - order.depositPaid);
    order.depositPaid = 0;
    if (typeof addUIMessage === "function") addUIMessage(`The deposit goes back to ${order.customer}.`);
  }
}

// ---- Commissions ----

function _commissionReqCount(level, rnd) {
  const ranges = [[1, 1], [2, 2], [2, 3], [3, 3], [3, 3]];
  const [lo, hi] = ranges[Math.min(level, 5) - 1];
  return lo + Math.floor(rnd() * (hi - lo + 1));
}

// Things you breed for (the first one always something to do with genes)
const COMMISSION_KINDS = ["type", "coat", "pattern", "size", "carrier", "gender", "trait", "age"];
const COMMISSION_FIRST = ["coat", "pattern", "type"];

// The type a commission asks for: a unicorn or pegasus (a plain earthy
// isn't worth breeding for), sometimes an alicorn from day
// COMMISSION_ALICORN_DAY (whatever your reputation)
function _commissionType(rnd, taken) {
  const day = typeof getDayNumber === "function" ? getDayNumber() : 1;
  const hidden = taken.carrier && taken.carrier.trait; // can't both show and hide it
  if (day >= COMMISSION_ALICORN_DAY && !hidden && rnd() < COMMISSION_ALICORN_CHANCE) return { type: "alicorn", value: 1500 };
  let options = ["unicorn", "pegasus"];
  if (hidden === "wings") options = ["unicorn"];
  if (hidden === "horn") options = ["pegasus"];
  return { type: options[Math.floor(rnd() * options.length)], value: 200 };
}

// opts.exclusive: a FluffList exclusive - a tier harder (one more
// requirement, up to 3), better paid, a day longer
function makeCommission(level = getOrderLevel(), rnd = Math.random, opts = {}) {
  const exclusive = !!opts.exclusive;
  if (exclusive) level = Math.min(5, level + 1);
  const customer = pickOrderCustomer(rnd);
  const reqs = [];
  const taken = {};
  const want = Math.min(3, _commissionReqCount(level, rnd) + (exclusive ? 1 : 0));
  let tries = 0;
  while (reqs.length < want && tries++ < 60) {
    const pool = (reqs.length === 0 ? COMMISSION_FIRST : COMMISSION_KINDS).filter(
      (k) => !taken[k] && ORDER_REQUIREMENTS[k] && ORDER_REQUIREMENTS[k].minLevel <= level,
    );
    if (!pool.length) break;
    const kind = pool[Math.floor(rnd() * pool.length)];
    const made = kind === "type" ? _commissionType(rnd, taken) : ORDER_REQUIREMENTS[kind].make(rnd, level, taken);
    if (!made) {
      taken[kind] = { skipped: true };
      continue;
    }
    const req = { kind, ...made };
    taken[kind] = req;
    reqs.push(req);
  }
  reqs.push({ kind: "bredHere", value: 0 });
  const valueSum = reqs.reduce((s, r) => s + (r.value || 0), 0);
  const n = reqs.length - 1;
  const base = (100 + valueSum) * (1 + 0.3 * (level - 1)) * (1 + 0.15 * Math.max(0, n - 1));
  const reward = Math.round((base * (exclusive ? EXCLUSIVE_MULT : COMMISSION_MULT)) / 10) * 10;
  const grown = reqs.some((r) => r.kind === "age" && !r.foal);
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  const order = {
    id: customerOrders.nextId++,
    customer,
    note: COMMISSION_NOTES[Math.floor(rnd() * COMMISSION_NOTES.length)],
    reqs,
    reward,
    level,
    commission: true,
    source: exclusive ? "web" : "board", // web: only on FluffList
    deposit: Math.round((reward * COMMISSION_DEPOSIT) / 10) * 10,
    depositPaid: 0,
    postedAt: now,
    leavesAt: now + DAY_LENGTH,
    timeAllowed: (COMMISSION_DAYS + (grown ? 2 : 0) + (exclusive ? EXCLUSIVE_EXTRA_DAYS : 0)) * DAY_LENGTH,
    dueAt: null,
  };
  return applyClientBonus(order);
}

function ownsComputer() {
  return typeof Computer !== "undefined" && objects.some((x) => x instanceof Computer);
}

// Orders.js updateCustomerOrders: one commission on the board and one
// exclusive on FluffList, each replaced by a new one a day after it went up
function updateCommissions(now) {
  const o = customerOrders;
  // (older saves kept a single time here)
  if (!o.nextCommissionAt || typeof o.nextCommissionAt !== "object") o.nextCommissionAt = { board: 0, web: 0 };
  for (const source of ["board", "web"]) {
    const up = o.posted.some((x) => x.commission && (x.source || "board") === source);
    if (up || now < (o.nextCommissionAt[source] || 0)) continue;
    o.posted.unshift(makeCommission(getOrderLevel(), Math.random, { exclusive: source === "web" }));
    o.nextCommissionAt[source] = now + COMMISSION_EVERY * DAY_LENGTH;
    if (typeof addUIMessage === "function") {
      if (source === "board") addUIMessage("A new commission is on the Bounty Board: a customer wants a fluffy bred for them.");
      else if (ownsComputer()) addUIMessage("FluffList: a new exclusive commission has been posted.");
    }
  }
  // Letters from past customers
  const letters = o.letters || (o.letters = []);
  for (let i = letters.length - 1; i >= 0; i--) {
    const l = letters[i];
    if (now < l.at) continue;
    letters.splice(i, 1);
    deliverCustomerLetter(l);
  }
}

function deliverCustomerLetter(l) {
  let text;
  if (l.mood === "delighted") {
    text = `Letter from ${l.customer}: "${l.fluffy} is a joy - thank you! Here's a little extra." +$${l.tip}`;
    if (!(typeof showDebugMenu !== "undefined" && showDebugMenu)) money += l.tip;
    if (typeof noteIncome === "function") noteIncome(l.tip); // (Economy.js)
  } else if (l.mood === "upset") {
    text = `Letter from ${l.customer}: "${l.fluffy} is scared of everything. I expected better."`;
    getClient(l.customer).loyalty -= 1;
  } else {
    text = `Letter from ${l.customer}: "${l.fluffy} has settled in nicely."`;
  }
  if (typeof addUIMessage === "function") addUIMessage(text);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text });
}

// "3 days 4 h" in game time
function formatDaysLeft(seconds) {
  const s = Math.max(0, seconds);
  const days = Math.floor(s / DAY_LENGTH);
  const hours = Math.floor((s - days * DAY_LENGTH) / HOUR_LENGTH);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}${hours ? ` ${hours} h` : ""}`;
  if (hours >= 1) return `${hours} h`;
  return formatOrderTime(s);
}

// "★ Regular +15%" for the card, or ""
function describeClientBadge(name) {
  const t = clientTier(name);
  if (!t) return "";
  return `★ ${t.name} +${Math.round(t.bonus * 100)}%`;
}
