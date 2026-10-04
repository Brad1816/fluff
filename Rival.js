// ---------------------------------------------------------------------------
// The rival breeder: a shop on Shopping Street that competes with you.
//
// From day RIVAL_START_DAY a rival opens (rivalState). Which kind is picked
// at random (RIVAL_KINDS) - each leans on different tricks:
//   boutique  slick, pretty and pricey; sales and advertising
//   mill      cheap and nasty: price wars, and the rejects get dumped
//   show      a snooty show breeder: a strong champion at every show
//
// His name (rivalState.score, 0-100) drifts back towards his kind's usual
// level each day (RIVAL_DRIFT) and moves with how the two of you do:
//   - shows: his champion enters every show (Shows.js _showRivals,
//     rivalShowEntrant). Beat it: his name drops (RIVAL_SHOW_BEAT); lose to
//     it: it rises
//   - orders: he goes after some of the board's orders too (order.rival).
//     Leave one on the board and he takes it; take it yourself and he's
//     racing you - deliver before he does (rival.due) to beat him, or he
//     fills it first (the order just goes - no mark against you)
//   - every order you fill is trade he didn't get (RIVAL_ORDER_TRADE)
//   - his schemes, about every other day (RIVAL_SCHEME_CHANCE, weighted by
//     kind): a sale (fewer buyers knock: rivalBuyerRate), a price war (the
//     mill: buyers offer less: rivalOfferMultiplier), a smear (your name
//     with families drops - unless they like you), a snooty letter, or -
//     the mill - rejects dumped in the alley before dawn (f.rivalDump)
//   - take one of his dumped fluffies in and you have proof: report him
//     to the inspector from his shop (once per rival; RIVAL_REPORT)
// A big name costs you buyers even without a sale (rivalBuyerRate).
//
// His shop window shows a few of his fluffies (stock-market listings at his
// markup); buying from him helps him a little. Sink his name below
// RIVAL_CLOSE_AT for RIVAL_CLOSE_DAYS mornings and he holds a closing-down
// sale (half price, RIVAL_SALE_DAYS), then shuts; what's left goes to the
// shelter, and a new rival (another kind) opens RIVAL_GONE_DAYS later.
//
// Saved: rivalState. Shown: his shop front on Shopping Street (click it).
// ---------------------------------------------------------------------------

const RIVAL_START_DAY = 3;
const RIVAL_DRIFT = 0.1; // of the way back to his usual level, each morning
const RIVAL_SCHEME_CHANCE = 0.5; // a morning
const RIVAL_SNIPE_CHANCE = 0.3; // an order posted on the board: he's after it too
const RIVAL_ORDER_TRADE = 1; // his name, - each order you fill
const RIVAL_SHOW_BEAT = 6;
const RIVAL_SHOW_LOSE = 3;
const RIVAL_ORDER_BEAT = 5;
const RIVAL_ORDER_LOSE = 3;
const RIVAL_REPORT = 20;
const RIVAL_CLOSE_AT = 12;
const RIVAL_CLOSE_DAYS = 3;
const RIVAL_SALE_DAYS = 2;
const RIVAL_GONE_DAYS = [20, 30];
const RIVAL_NEWS_KEEP = 8;
const RIVAL_STOCK = 3;

const RIVAL_KINDS = {
  boutique: {
    name: "Boutique",
    shops: ["Pampered Paws", "Fluffington's", "The Velvet Hoof"],
    owners: ["Chad Ellison", "Brittany Vance", "Marcus Hale"],
    blurb: "A slick boutique: pretty, pricey fluffies and a lot of advertising.",
    sign: "#c2185b",
    awning: ["#f8bbd0", "#ffffff"],
    lines: ["pastel", "mane"],
    level: 1,
    markup: 1.25,
    usual: 50,
    showBonus: 0,
    schemes: { sale: 4, smear: 2, letter: 2, dump: 0.3 },
  },
  mill: {
    name: "Mill",
    shops: ["Bargain Fluff Barn", "FluffFarm Direct", "Cheap Cheeps"],
    owners: ["Del Garrity", "Ronnie Sykes", "Barb Kowalski"],
    blurb: "A cheap mill: lots of fluffies, low prices, no questions - and the rejects end up somewhere.",
    sign: "#8d6e63",
    awning: ["#ffcc80", "#6d4c41"],
    lines: ["hardy"],
    level: 0,
    markup: 0.55,
    usual: 45,
    showBonus: -10,
    schemes: { sale: 3, dump: 4, smear: 1, letter: 0.5 },
  },
  show: {
    name: "Show breeder",
    shops: ["Silverline Stud", "Regal Fluff Kennels", "Ashcombe Champions"],
    owners: ["Lady Ashcombe", "Percival Strand", "Honoria Blythe"],
    blurb: "A snooty show breeder: champions, ribbons and opinions.",
    sign: "#4a148c",
    awning: ["#b39ddb", "#ffffff"],
    lines: ["white", "horn", "mane"],
    level: 2,
    markup: 1.6,
    usual: 55,
    showBonus: 12,
    schemes: { letter: 3, smear: 2, sale: 0.5 },
  },
};

const RIVAL_LETTERS = {
  boutique: [
    "A glossy flyer through your door: \"%SHOP% - because your fluffy deserves better than a backyard.\"",
    "%OWNER% waves from across the street, sunglasses on. \"Love what you're doing! Very... homemade.\"",
    "\"%SHOP%: 20% off for anyone who brings in a fluffy from a certain other breeder.\"",
  ],
  mill: [
    "A note under your door: \"Why pay more? %SHOP% - fluffies by the dozen.\"",
    "%OWNER% leans on your fence. \"You're doing it the hard way, pal. Volume. That's the trick.\"",
    "\"%SHOP%: buy two, get a third free. No refunds.\"",
  ],
  show: [
    "A letter on thick cream paper: \"%OWNER% wonders whether you've considered a different hobby.\"",
    "\"%SHOP% notes, with regret, that some breeders will enter anything with four legs.\"",
    "%OWNER% sniffs as you pass. \"Ribbons are earned, darling, not hoped for.\"",
  ],
};

function freshRivalState() {
  return {
    kind: null,
    shop: null,
    owner: null,
    score: 50,
    champion: null,
    stock: [],
    lastDay: null,
    sale: null, // { until, war }
    lowDays: 0,
    closing: null, // { until } (closing-down sale)
    closedUntil: null, // day the next one opens
    past: [], // kinds and shops already seen
    reported: false,
    beaten: 0,
    lost: 0,
    news: [],
  };
}
let rivalState = freshRivalState();

if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({
    name: "rivalState",
    get: () => rivalState,
    set: (v) => {
      rivalState = v && typeof v === "object" ? v : freshRivalState();
    },
    fresh: () => freshRivalState(),
  });
}

// (read only)
function rivalOpen() {
  return !!(rivalState && rivalState.kind && !(rivalState.closedUntil != null));
}
function rivalKind() {
  return rivalOpen() ? RIVAL_KINDS[rivalState.kind] : null;
}

function _rvSay(text) {
  if (!rivalState.news) rivalState.news = [];
  rivalState.news.unshift({ day: getDayNumber(), text });
  rivalState.news.length = Math.min(rivalState.news.length, RIVAL_NEWS_KEEP);
}
function _rvTell(text, news = true) {
  if (typeof addUIMessage === "function") addUIMessage(text);
  if (news && typeof noteDayEvent === "function") noteDayEvent("news", { text });
  _rvSay(text);
}
function _rvScore(d) {
  rivalState.score = Math.max(0, Math.min(100, (rivalState.score || 0) + d));
}
function _rvPoss(name) {
  if (/'s$/i.test(name)) return name; // (Fluffington's adverts)
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}
function _rvPick(list, rnd = Math.random) {
  return list[Math.floor(rnd() * list.length)];
}

// ---- Opening and closing ----
function openRival(kindKey = null) {
  const past = (rivalState.past || []).map((p) => p.kind);
  if (!kindKey) {
    const keys = Object.keys(RIVAL_KINDS);
    const fresh = keys.filter((k) => past[past.length - 1] !== k);
    kindKey = _rvPick(fresh.length ? fresh : keys);
  }
  const k = RIVAL_KINDS[kindKey];
  const usedShops = new Set((rivalState.past || []).map((p) => p.shop));
  const shops = k.shops.filter((s) => !usedShops.has(s));
  const keep = { past: rivalState.past || [] };
  rivalState = freshRivalState();
  rivalState.past = keep.past;
  rivalState.kind = kindKey;
  rivalState.shop = _rvPick(shops.length ? shops : k.shops);
  rivalState.owner = _rvPick(k.owners);
  rivalState.score = k.usual;
  rivalState.openedDay = getDayNumber();
  rivalState.lastDay = getDayNumber();
  rivalState.champion = { name: _rvPick(typeof STOCK_NAMES !== "undefined" ? STOCK_NAMES : ["Duchess"]), wins: 0 };
  restockRival();
  _rvTell(`A new breeder has opened on Shopping Street: ${rivalState.shop} (${rivalState.owner}). ${k.blurb}`);
  return rivalState;
}

function _rvCloseDown() {
  const k = rivalKind();
  const shop = rivalState.shop;
  // What's left goes to the shelter
  let n = 0;
  for (const l of rivalState.stock || []) {
    if (typeof giveUpToShelter !== "function" || typeof canGiveUpToShelter !== "function" || !canGiveUpToShelter()) break;
    const f = _rvMakeFluffy(l, typeof SHELTER_SCENE !== "undefined" ? SHELTER_SCENE : "DAY_CARE");
    if (!f) continue;
    fluffies.push(f);
    if (giveUpToShelter(f, { stray: true })) n++;
    else {
      const i = fluffies.indexOf(f);
      if (i >= 0) fluffies.splice(i, 1);
    }
  }
  rivalState.past = [...(rivalState.past || []), { kind: rivalState.kind, shop, day: getDayNumber() }].slice(-6);
  rivalState.stock = [];
  rivalState.closing = null;
  rivalState.sale = null;
  const [lo, hi] = RIVAL_GONE_DAYS;
  rivalState.closedUntil = getDayNumber() + lo + Math.floor(Math.random() * (hi - lo + 1));
  _rvTell(`${shop} has shut for good.${n ? ` Its last ${n === 1 ? "fluffy went" : `${n} fluffies went`} to the shelter.` : ""} The street's yours - for now.`);
  if (typeof customerOrders !== "undefined" && customerOrders) customerOrders.reputation += 3;
  if (typeof noteGoalEvent === "function") noteGoalEvent("rivalClosed", { kind: k ? k.name : "" });
}

// ---- His stock (the window) ----
function _rvListing(k, price = 1) {
  if (typeof makeStockListing !== "function") return null;
  const lvl = Math.max(1, Math.min(5, (typeof getOrderLevel === "function" ? getOrderLevel() : 1) + k.level));
  const breeder = { name: rivalState.shop, line: _rvPick(k.lines), about: k.blurb };
  const l = makeStockListing(lvl, breeder, (rivalState.stock || []).map((x) => x.name));
  if (!l) return null;
  l.rival = true;
  l.basePrice = Math.max(50, Math.round((l.price * k.markup) / 10) * 10);
  l.price = Math.round((l.basePrice * price) / 10) * 10;
  return l;
}
function restockRival() {
  const k = rivalKind();
  if (!k) return;
  const half = rivalState.closing ? 0.5 : 1;
  const list = [];
  for (let i = 0; list.length < RIVAL_STOCK && i < RIVAL_STOCK * 3; i++) {
    const l = _rvListing(k, half);
    if (l) list.push(l);
  }
  rivalState.stock = list;
}

function _rvMakeFluffy(l, scene) {
  if (typeof Horse === "undefined" || !l) return null;
  const f = new Horse(l.growth, null, scene, "earthy", l.genes.slice(), null, null, l.gender);
  if (typeof _raisedByBreeder === "function") _raisedByBreeder(f, l);
  if (typeof setSpawnAge === "function") setSpawnAge(f, 2.5, 20);
  if (typeof fluffyNames !== "undefined") fluffyNames[f.id] = l.name;
  f.x = (typeof sceneW === "function" ? sceneW(scene) : width) * (0.35 + Math.random() * 0.3);
  f.y = height * 0.7;
  return f;
}

// Buy one of his (the stock market's buying, his price)
function buyFromRival(id) {
  const i = (rivalState.stock || []).findIndex((l) => l.id === id);
  if (i < 0 || typeof buyStockListing !== "function") return null;
  const l = rivalState.stock[i];
  stockMarket.listings.push(l);
  const f = buyStockListing(l.id);
  if (!f) {
    const j = stockMarket.listings.indexOf(l);
    if (j >= 0) stockMarket.listings.splice(j, 1);
    return null;
  }
  rivalState.stock.splice(i, 1);
  _rvScore(1);
  _rvSay(`You bought ${l.name} from ${rivalState.shop}.`);
  return f;
}

// ---- What he does to the market (Pressure.js) ----
function rivalBuyerRate() {
  if (!rivalOpen()) return 1;
  const big = 1 - Math.max(0, (rivalState.score || 0) - 50) / 250; // (a big name takes some of your buyers)
  const sale = rivalState.sale && timePlayed < rivalState.sale.until ? 0.7 : 1;
  return big * sale;
}
function rivalOfferMultiplier() {
  if (!rivalOpen()) return 1;
  return rivalState.sale && rivalState.sale.war && timePlayed < rivalState.sale.until ? 0.85 : 1;
}

// ---- Shows (Shows.js) ----
function rivalShowEntrant(theme, level) {
  const k = rivalKind();
  if (!k || !rivalState.champion) return null;
  const mean = 38 + 7 * level + (theme.hard ? 12 : 0) + k.showBonus + ((rivalState.score || 50) - 50) / 5;
  const spread = (Math.random() + Math.random() - 1) * 12;
  const looks = typeof _showRivalLooks === "function" ? _showRivalLooks(theme, { name: rivalState.shop, line: _rvPick(k.lines) }, 0, level) : {};
  return {
    name: `${rivalState.champion.name} (${rivalState.shop})`,
    score: Math.round(typeof _showClamp === "function" ? _showClamp(mean + spread) : mean + spread),
    rival: true,
    ...looks,
  };
}
function onRivalShowResult(entrants, yours) {
  const his = (entrants || []).find((e) => e.rival);
  if (!his || !rivalOpen()) return;
  if (his.place === 1) rivalState.champion.wins = (rivalState.champion.wins || 0) + 1;
  if (!yours) {
    if (his.place === 1) {
      _rvScore(RIVAL_SHOW_LOSE);
      _rvSay(`${his.name} won the show.`);
    }
    return;
  }
  if (yours.place < his.place) {
    _rvScore(-RIVAL_SHOW_BEAT);
    rivalState.beaten = (rivalState.beaten || 0) + 1;
    _rvTell(`You beat ${_rvPoss(rivalState.shop)} ${rivalState.champion.name} at the show!`, false);
  } else {
    _rvScore(RIVAL_SHOW_LOSE);
    rivalState.lost = (rivalState.lost || 0) + 1;
    _rvTell(`${_rvPoss(rivalState.shop)} ${rivalState.champion.name} placed above yours at the show.`, false);
  }
}

// ---- Orders (Orders.js) ----
// A newly posted order: he may be after it too
function onOrderPostedForRival(order) {
  if (!rivalOpen() || !order || order.commission || rivalState.closing) return;
  if (Math.random() >= RIVAL_SNIPE_CHANCE) return;
  const now = timePlayed;
  const left = Math.max(60, (order.leavesAt || now + 600) - now);
  order.rival = { shop: rivalState.shop, takeAt: now + left * (0.45 + Math.random() * 0.3) };
}
// You delivered it
function onOrderFilledForRival(order) {
  if (!rivalOpen()) return;
  if (order && order.rival && order.rival.shop === rivalState.shop) {
    _rvScore(-RIVAL_ORDER_BEAT);
    rivalState.beaten = (rivalState.beaten || 0) + 1;
    if (typeof customerOrders !== "undefined") customerOrders.reputation += 1;
    _rvTell(`You beat ${rivalState.shop} to ${order.customer}'s order!`, false);
  } else _rvScore(-RIVAL_ORDER_TRADE);
}
// (every few seconds) He takes the ones you left, and races you for the rest
function _rvOrders() {
  if (typeof customerOrders === "undefined" || !customerOrders) return;
  const now = timePlayed;
  const o = customerOrders;
  for (let i = o.posted.length - 1; i >= 0; i--) {
    const order = o.posted[i];
    if (!order.rival || order.rival.shop !== rivalState.shop || now < order.rival.takeAt) continue;
    o.posted.splice(i, 1);
    _rvScore(RIVAL_ORDER_LOSE);
    rivalState.lost = (rivalState.lost || 0) + 1;
    _rvTell(`${rivalState.shop} filled ${order.customer}'s order.`, false);
  }
  for (let i = o.active.length - 1; i >= 0; i--) {
    const order = o.active[i];
    if (!order.rival || order.rival.shop !== rivalState.shop || order.dueAt == null) continue;
    if (order.rival.due == null) order.rival.due = order.dueAt - (order.timeAllowed || 0) * 0.35;
    if (now < order.rival.due) continue;
    o.active.splice(i, 1);
    _rvScore(RIVAL_ORDER_LOSE);
    rivalState.lost = (rivalState.lost || 0) + 1;
    _rvTell(`${rivalState.shop} got to ${order.customer} first - the order's gone (no mark against you).`, false);
  }
}

// ---- Schemes ----
function rivalScheme(key = null) {
  const k = rivalKind();
  if (!k) return null;
  if (!key) {
    const w = Object.entries(k.schemes);
    let pick = Math.random() * w.reduce((a, [, x]) => a + x, 0);
    for (const [s, x] of w) {
      pick -= x;
      if (pick <= 0) {
        key = s;
        break;
      }
    }
    key = key || w[0][0];
  }
  const shop = rivalState.shop;
  if (key === "sale") {
    const war = rivalState.kind === "mill";
    rivalState.sale = { until: timePlayed + DAY_LENGTH, war };
    _rvTell(war ? `${shop} has slashed its prices. Buyers will knock less today, and offer less.` : `${shop} is having a big sale today. Fewer buyers will knock.`);
  } else if (key === "smear") {
    const fam = typeof keeperRep !== "undefined" && keeperRep ? keeperRep.family || 0 : 0;
    if (fam >= 20) _rvTell(`${shop} put a nasty review of you online. Nobody believed it.`);
    else {
      if (typeof keeperRep !== "undefined" && keeperRep) keeperRep.family = Math.max(-(typeof REP_MAX !== "undefined" ? REP_MAX : 40), fam - 3);
      _rvTell(`A nasty review of you went up online. It reads a lot like ${_rvPoss(shop)} adverts. Families think a bit less of you.`);
    }
  } else if (key === "letter") {
    const t = _rvPick(RIVAL_LETTERS[rivalState.kind] || RIVAL_LETTERS.boutique).replace("%SHOP%", shop).replace("%OWNER%", rivalState.owner);
    _rvTell(t);
  } else if (key === "dump") {
    rivalDump();
  }
  return key;
}

// The mill's rejects, left in the alley before dawn
function rivalDump(n = 2 + Math.floor(Math.random() * 2)) {
  const k = rivalKind();
  if (!k) return [];
  const scene = "ALLEY";
  const out = [];
  for (let i = 0; i < n; i++) {
    const l = _rvListing(RIVAL_KINDS.mill);
    if (!l) continue;
    const f = _rvMakeFluffy(l, scene);
    if (!f) continue;
    f.adopted = false;
    f.rivalDump = rivalState.shop;
    f.formerPet = { how: "dumped", day: getDayNumber(), name: l.name };
    f.hunger = 0.35 + Math.random() * 0.2;
    f.happiness = 0.35;
    f.pottyTraining = 0;
    f.x = 200 + Math.random() * ((typeof sceneW === "function" ? sceneW(scene) : width) - 400);
    f.y = height * 0.6 + Math.random() * 80;
    fluffies.push(f);
    if (typeof recordStory === "function") recordStory("turning", f, { x: `${l.name} was dumped in the alley by ${rivalState.shop}.` });
    out.push(f);
  }
  if (out.length) _rvTell(`Someone saw a ${rivalState.shop} van in the alley before dawn. ${out.length} sorry-looking fluffies are wandering there now.`);
  return out;
}

// ---- Reporting him ----
function rivalEvidence() {
  if (!rivalOpen()) return null;
  return fluffies.find((f) => f.isAlive && f.adopted && f.rivalDump === rivalState.shop) || null;
}
function reportRival() {
  if (!rivalOpen() || rivalState.reported) return false;
  const proof = rivalEvidence();
  if (!proof) {
    if (typeof addUIMessage === "function") addUIMessage("You'd need proof - one of his dumped fluffies, taken in.");
    return false;
  }
  rivalState.reported = true;
  _rvScore(-RIVAL_REPORT);
  const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(proof) : "it";
  _rvTell(`You reported ${rivalState.shop} for dumping, with ${name} as proof. The inspector fined them - it's in the paper.`);
  return true;
}

// ---- Every few seconds ----
const rivalTicker = new Ticker(3);
function updateRival(dt) {
  if (!rivalTicker.step(dt)) return;
  if (!rivalState || typeof rivalState !== "object") rivalState = freshRivalState();
  const day = getDayNumber();
  // Closed: a new one opens in time
  if (rivalState.closedUntil != null) {
    if (day >= rivalState.closedUntil) openRival();
    return;
  }
  if (!rivalState.kind) {
    if (day >= RIVAL_START_DAY) openRival();
    return;
  }
  _rvOrders();
  if (rivalState.lastDay === day) return;
  // ---- A new morning ----
  rivalState.lastDay = day;
  const k = rivalKind();
  // Closing down
  if (rivalState.closing) {
    if (day >= rivalState.closing.until) return _rvCloseDown();
    restockRival();
    return;
  }
  _rvScore((k.usual - rivalState.score) * RIVAL_DRIFT + (Math.random() - 0.5) * 3);
  if (rivalState.score < RIVAL_CLOSE_AT) rivalState.lowDays = (rivalState.lowDays || 0) + 1;
  else rivalState.lowDays = 0;
  if (rivalState.lowDays >= RIVAL_CLOSE_DAYS) {
    rivalState.closing = { until: day + RIVAL_SALE_DAYS };
    restockRival();
    _rvTell(`${rivalState.shop} is closing down! Everything in the window is half price for ${RIVAL_SALE_DAYS} days.`);
    return;
  }
  restockRival();
  if (Math.random() < RIVAL_SCHEME_CHANCE) rivalScheme();
}
registerSystem("rival", updateRival, 172);

// Stars for a name of 0-100
function rivalStars(score = rivalState.score) {
  const n = Math.max(1, Math.min(5, Math.ceil((score || 0) / 20)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}
function yourStarsVsRival() {
  const lvl = typeof getOrderLevel === "function" ? getOrderLevel() : 1;
  return "★".repeat(lvl) + "☆".repeat(5 - lvl);
}

// ---------------------------------------------------------------------------
// His shop front on Shopping Street (Store.js drawStoreScenery), and the
// look inside (a screen: his window, his name against yours, the news, and
// reporting him).
// ---------------------------------------------------------------------------

function getRivalShopRect() {
  const top = height * 0.15;
  const right = width - 560 - 30; // (the show hall's left edge, less a gap)
  const x = 430;
  return { x, y: top + 120, w: Math.max(150, Math.min(260, right - x)), h: 170 };
}
function _isOverRivalShop(px, py) {
  if (currentScene !== "SHOP_STREET") return false;
  const b = getRivalShopRect();
  return px >= b.x && px <= b.x + b.w && py >= b.y - 30 && py <= b.y + b.h;
}

function drawRivalShop(c) {
  if (currentScene !== "SHOP_STREET") return;
  const b = getRivalShopRect();
  const k = rivalState && rivalState.kind ? RIVAL_KINDS[rivalState.kind] : null;
  const closed = !k || rivalState.closedUntil != null;
  c.save();
  // Shadow, walls
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.fillRect(b.x + 6, b.y + b.h - 4, b.w - 4, 10);
  c.fillStyle = closed ? "#8a8178" : "#efe6da";
  c.fillRect(b.x, b.y, b.w, b.h);
  c.strokeStyle = "rgba(0,0,0,0.35)";
  c.lineWidth = 2;
  c.strokeRect(b.x, b.y, b.w, b.h);
  // Sign
  c.fillStyle = closed ? "#5d5650" : k.sign;
  c.fillRect(b.x - 6, b.y - 30, b.w + 12, 32);
  c.fillStyle = "white";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = "bold 16px Arial";
  c.fillText(fitText(c, closed ? (rivalState && rivalState.closedUntil != null ? "CLOSED" : "TO LET") : rivalState.shop.toUpperCase(), b.w), b.x + b.w / 2, b.y - 14);
  // Awning
  if (!closed) {
    const n = Math.max(4, Math.round(b.w / 26));
    const sw = b.w / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = k.awning[i % 2];
      c.beginPath();
      c.moveTo(b.x + i * sw, b.y + 2);
      c.lineTo(b.x + (i + 1) * sw, b.y + 2);
      c.lineTo(b.x + (i + 1) * sw, b.y + 18);
      c.quadraticCurveTo(b.x + (i + 0.5) * sw, b.y + 28, b.x + i * sw, b.y + 18);
      c.fill();
    }
  }
  // Window (his fluffies) and door
  const wx = b.x + 12;
  const wy = b.y + 36;
  const ww = b.w - 70;
  const wh = b.h - 52;
  c.fillStyle = closed ? "#6d645c" : "#cfe8f5";
  c.fillRect(wx, wy, ww, wh);
  c.strokeStyle = "#4e4037";
  c.lineWidth = 3;
  c.strokeRect(wx, wy, ww, wh);
  if (!closed) {
    const stock = (rivalState.stock || []).slice(0, 3);
    const sz = Math.min(64, (ww - 8) / Math.max(1, stock.length));
    stock.forEach((l, i) => {
      const p = typeof _stockPortrait === "function" ? _stockPortrait(l, 64) : null;
      if (p) c.drawImage(p, wx + 4 + i * sz, wy + wh - sz - 4, sz, sz);
    });
  } else {
    // Boarded up
    c.strokeStyle = "#a1887f";
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(wx + 6, wy + 10);
    c.lineTo(wx + ww - 6, wy + wh - 10);
    c.moveTo(wx + ww - 6, wy + 10);
    c.lineTo(wx + 6, wy + wh - 10);
    c.stroke();
  }
  c.fillStyle = closed ? "#5d4037" : "#6d4c41";
  c.fillRect(b.x + b.w - 50, b.y + 46, 38, b.h - 46);
  c.fillStyle = "#ffd54f";
  c.beginPath();
  c.arc(b.x + b.w - 20, b.y + b.h / 2 + 30, 3, 0, Math.PI * 2);
  c.fill();
  // Banners
  const banner = (text, colour) => {
    c.save();
    c.translate(wx + ww / 2, wy + 20);
    c.rotate(-0.12);
    c.fillStyle = colour;
    c.fillRect(-ww / 2 + 6, -12, ww - 12, 24);
    c.fillStyle = "white";
    c.font = "bold 14px Arial";
    c.fillText(fitText(c, text, ww - 20), 0, 1);
    c.restore();
  };
  if (!closed && rivalState.closing) banner("CLOSING DOWN!", "#d32f2f");
  else if (!closed && rivalState.sale && timePlayed < rivalState.sale.until) banner(rivalState.sale.war ? "PRICES SLASHED!" : "BIG SALE!", "#e53935");
  // Hover hint
  if (_isOverRivalShop(mouse.x, mouse.y) && !isGlobalDragging) {
    c.fillStyle = "rgba(0,0,0,0.7)";
    c.fillRect(b.x + b.w / 2 - 90, b.y + b.h + 8, 180, 24);
    c.fillStyle = "white";
    c.font = "13px Arial";
    c.fillText(closed ? "Click to look" : "Click to look inside", b.x + b.w / 2, b.y + b.h + 20);
  }
  c.restore();
}

// ---- The look inside ----
let rivalPanelOpen = false;
let _rvUI = { buy: [], report: null, close: null };

function rivalShopClick() {
  if (isGlobalDragging || !_isOverRivalShop(mouse.x, mouse.y)) return false;
  rivalPanelOpen = true;
  return true;
}
function closeRivalPanel() {
  rivalPanelOpen = false;
}

function _rvLayout() {
  const w = Math.min(780, width - 40);
  const h = Math.min(420, height - 40);
  return { x: Math.round(width / 2 - w / 2), y: Math.round(height / 2 - h / 2), w, h };
}

function _rvButton(c, r, label, on, colour = "#2e7d32") {
  const over = on && isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h);
  fillRoundRect(c, r.x, r.y, r.w, r.h, 8, on ? (over ? "#43a047" : colour) : "rgba(120,120,120,0.6)");
  c.fillStyle = "white";
  c.font = "bold 13px Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(fitText(c, label, r.w - 10), r.x + r.w / 2, r.y + r.h / 2 + 1);
}

function drawRivalPanel(c) {
  if (!rivalPanelOpen) return;
  const L = _rvLayout();
  drawScreenPanel(c, L);
  _rvUI = { buy: [], report: null, close: { x: L.x + L.w - 44, y: L.y + 10, w: 34, h: 30 } };
  _rvButton(c, _rvUI.close, "✕", true, "#8e3b3b");
  const x = L.x + 22;
  let y = L.y + 34;
  const k = rivalState.kind ? RIVAL_KINDS[rivalState.kind] : null;
  if (!k || rivalState.closedUntil != null) {
    canvasText(c, rivalState.closedUntil != null ? "Boarded up" : "An empty shop", x, y, "#ffd6f0", "bold 22px Arial");
    y += 30;
    const days = rivalState.closedUntil != null ? Math.max(0, rivalState.closedUntil - getDayNumber()) : Math.max(0, RIVAL_START_DAY - getDayNumber());
    canvasText(c, rivalState.closedUntil != null ? `The last breeder here shut down. A sign says someone new is moving in${days ? ` in about ${days} day${days === 1 ? "" : "s"}` : " soon"}.` : `"To let." Somebody will take it soon${days ? ` (in about ${days} day${days === 1 ? "" : "s"})` : ""}.`, x, y, "#e8e0f4", "14px Arial");
    return;
  }
  canvasText(c, fitText(c, rivalState.shop, L.w - 90), x, y, "#ffd6f0", "bold 24px Arial");
  fillRoundRect(c, x, y + 9, Math.min(L.w - 90, 220), 3, 2, k.awning[0]);
  y += 22;
  canvasText(c, fitText(c, `${rivalState.owner} · ${k.blurb}`, L.w - 44), x, y, "#b9b0c9", "italic 13px Arial");
  y += 28;
  canvasText(c, `Their name: ${rivalStars()}`, x, y, "#ffe082", "bold 15px Arial");
  canvasText(c, `Yours: ${yourStarsVsRival()}`, x + 250, y, "#9ff0c8", "bold 15px Arial");
  y += 20;
  const champ = rivalState.champion ? `Champion: ${rivalState.champion.name}${rivalState.champion.wins ? ` (${rivalState.champion.wins} show win${rivalState.champion.wins === 1 ? "" : "s"})` : ""}` : "";
  canvasText(c, fitText(c, `${champ}${champ ? " · " : ""}You've beaten them ${rivalState.beaten || 0} time${rivalState.beaten === 1 ? "" : "s"}, they've beaten you ${rivalState.lost || 0}`, L.w - 44), x, y, "#cfc6dd", "13px Arial");
  y += 18;
  const status = rivalState.closing
    ? "CLOSING DOWN: everything half price."
    : rivalState.sale && timePlayed < rivalState.sale.until
      ? rivalState.sale.war
        ? "Prices slashed today: fewer buyers, lower offers."
        : "A big sale today: fewer buyers will knock."
      : (rivalState.score || 0) < RIVAL_CLOSE_AT + 8
        ? "Business looks slow. A few more knocks and they might close."
        : "";
  if (status) canvasText(c, status, x, y, "#ff8a80", "bold 13px Arial");
  y += 14;
  // The window
  const stock = rivalState.stock || [];
  const cw = Math.min(170, (L.w - 44 - 20) / 3);
  const ch = 190;
  stock.slice(0, 3).forEach((l, i) => {
    const cx = x + i * (cw + 10);
    fillRoundRect(c, cx, y, cw, ch, 10, "rgba(255,255,255,0.75)");
    const p = typeof _stockPortrait === "function" ? _stockPortrait(l, 90) : null;
    if (p) c.drawImage(p, cx + cw / 2 - 45, y + 6, 90, 90);
    canvasText(c, fitText(c, l.name, cw - 12), cx + cw / 2, y + 112, "#222", "bold 14px Arial", "center");
    canvasText(c, fitText(c, `${l.type || ""} ${l.gender === "male" ? "♂" : "♀"}`, cw - 12), cx + cw / 2, y + 130, "#555", "12px Arial", "center");
    canvasText(c, `$${l.price.toLocaleString()}`, cx + cw / 2, y + 150, "#1e8a3a", "bold 15px Arial", "center");
    const r = { x: cx + 10, y: y + ch - 34, w: cw - 20, h: 26, id: l.id };
    _rvButton(c, r, "Buy", money >= l.price || (typeof showDebugMenu !== "undefined" && showDebugMenu));
    _rvUI.buy.push(r);
  });
  if (!stock.length) canvasText(c, "The window's empty today.", x, y + 30, "#b9b0c9", "italic 13px Arial");
  // News
  const nx = x + 3 * (cw + 10);
  const nw = L.x + L.w - 22 - nx;
  if (nw > 120) {
    canvasText(c, "Lately", nx, y + 14, "#ffd6f0", "bold 14px Arial");
    let ny = y + 34;
    for (const n of (rivalState.news || []).slice(0, 7)) {
      c.font = "12px Arial";
      const words = n.text.split(" ");
      let line = "";
      let lines = 0;
      for (const wd of words) {
        const t = line ? line + " " + wd : wd;
        if (c.measureText(t).width > nw && line) {
          canvasText(c, line, nx, ny, "#cfc6dd", "12px Arial");
          ny += 15;
          line = wd;
          if (++lines >= 3) break;
        } else line = t;
      }
      if (lines < 3 && line) {
        canvasText(c, line, nx, ny, "#cfc6dd", "12px Arial");
        ny += 15;
      }
      ny += 5;
      if (ny > y + ch + 40) break;
    }
  }
  // Reporting
  const ry = Math.min(L.y + L.h - 46, y + ch + 16);
  const proof = rivalEvidence();
  const r = { x, y: ry, w: Math.min(300, L.w - 44), h: 32 };
  if (rivalState.reported) canvasText(c, "You've reported them once already.", x, ry + 20, "#b9b0c9", "italic 13px Arial");
  else {
    _rvButton(c, r, proof ? "Report them to the inspector" : "Report them (you need proof)", !!proof, "#b71c1c");
    _rvUI.report = r;
    if (!proof && r.x + r.w + 12 < L.x + L.w - 20)
      canvasText(c, fitText(c, "Proof: one of their dumped fluffies, taken in.", L.x + L.w - 22 - (r.x + r.w + 12)), r.x + r.w + 12, ry + 20, "#b9b0c9", "italic 12px Arial");
  }
}

function handleRivalPanelClick() {
  if (!rivalPanelOpen) return false;
  const m = mouse;
  const hit = (r) => r && isPointInRect(m.x, m.y, r.x, r.y, r.w, r.h);
  if (hit(_rvUI.close)) {
    closeRivalPanel();
    return true;
  }
  for (const r of _rvUI.buy) if (hit(r)) {
    buyFromRival(r.id);
    return true;
  }
  if (hit(_rvUI.report)) {
    reportRival();
    return true;
  }
  const L = _rvLayout();
  if (!isPointInRect(m.x, m.y, L.x, L.y, L.w, L.h)) closeRivalPanel();
  return true;
}

if (typeof registerScreen === "function")
  registerScreen({
    name: "rival",
    layer: 15,
    isOpen: () => rivalPanelOpen,
    close: () => closeRivalPanel(),
    draw: (c) => drawRivalPanel(c),
    click: () => handleRivalPanelClick(),
  });
