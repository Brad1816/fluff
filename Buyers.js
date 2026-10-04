// ---------------------------------------------------------------------------
// Buyers at the door: who they are, what they want, and haggling.
//
// Every so often (script.js updateMoneyAndRequests) a buyer knocks. Each
// is a BUYER_KINDS type with tastes (like(f), 0..1) and a budget. Better
// reputation (Orders.js getOrderLevel) brings richer kinds more often and
// a little more money all round.
//
// makeSellRequest(candidates): the buyer looks over the fluffies you have
// for sale (the "sell" cage first, as before) and asks about one they like
// (the better it suits them, the likelier). The card says who they are and
// what they're after.
//
// The offer (buyerOffer): its price (calculatePrice - already counting
// colour, type, temperament, age and ribbons) x how it looks on the day
// (buyerConditionFactor: poor health, missing parts, flu showing) x their
// budget x how much they like it. Each buyer also has a most they'd pay
// (maxPay, hidden) and some patience.
//
// "Ask more" (askBuyerForMore): you ask for ASK_MORE_STEP more. Within
// their limit they agree; past it they either offer their last price (and
// won't go higher) or, out of patience, walk off.
// ---------------------------------------------------------------------------

const SELL_CARD_W = 330;
const SELL_CARD_H = 190;
const BUYER_WAIT = 30; // seconds a buyer waits at the door
const ASK_MORE_STEP = 0.2; // ask for 20% more each time

function _showCoat(f) {
  return typeof showCoatScore === "function" ? showCoatScore(f) / 100 : 0.5;
}
function _tame(f) {
  return typeof isFriendlyWithPeople === "function" && isFriendlyWithPeople(f) ? 1 : 0;
}
function _happyLevel(f) {
  return Math.max(0, Math.min(1, f.happiness ?? 0.6));
}
// Knows a trick or two (Tricks.js): 0, 0.5, 1
function _tricksLevel(f) {
  return typeof knownTricks === "function" ? Math.min(1, knownTricks(f).length / 2) : 0;
}
function _hasPattern(f) {
  return f.hasSpots || f.hasStripes ? 1 : 0;
}

// ---- The shady dealer (design doc Phase 4): an early dark-market buyer ----
// Turns up rarely (DARK_MARKET_WEIGHT when he's due; then not again for
// DARK_MARKET_GAP_DAYS). Pays by how obedient and crushed it is (darkValue):
// Broken, tricks drilled in with fear, freezes at the stick, afraid of you.
// Doesn't care about affection, scars or looks (his price ignores them).
// Pays little for a happy, spirited one - families want those. (The full
// dark-market reputation comes later.)
const DARK_MARKET_WEIGHT = 0.35;
const DARK_MARKET_GAP_DAYS = 2;
function freshDarkMarket() {
  return { lastDay: -99, sold: 0 };
}
let darkMarket = freshDarkMarket();

function darkMarketDue() {
  if (!darkMarket || typeof darkMarket !== "object") darkMarket = freshDarkMarket();
  const gap = typeof darkRepGapDays === "function" ? darkRepGapDays() : DARK_MARKET_GAP_DAYS; // (sooner with a dark name, Reputation.js)
  return getDayNumber() - (darkMarket.lastDay ?? -99) >= gap;
}

// 0..1: what the dealer is after
function darkValue(f) {
  let v = 0;
  const title = typeof titleOf === "function" ? titleOf(f) : null;
  if (title === "Broken") v += 0.45;
  if (typeof TRICKS !== "undefined" && typeof fearShare === "function") {
    const drilled = TRICKS.filter((t) => trickSkill(f, t.key) >= TRICK_KNOWN && fearShare(f, t.key) >= 0.5).length;
    v += Math.min(0.36, 0.12 * drilled);
  }
  if (typeof isStickConditioned === "function" && isStickConditioned(f)) v += 0.15;
  v += 0.2 * (f.playerFear || 0);
  if ((f.happiness ?? 0.6) > 0.6) v -= 0.2;
  if (title === "Rebel") v -= 0.3;
  if (title === "Cherished") v -= 0.2;
  return Math.max(0, Math.min(1, v));
}

const BUYER_KINDS = [
  {
    id: "family",
    label: "A young family",
    wants: "a friendly fluffy for the kids",
    budget: 1.0,
    patience: 2,
    generous: 0.25,
    weight: (lvl) => 3 * (typeof familyRepWeight === "function" ? familyRepWeight() : 1), // (your name with families, Reputation.js)
    // (a Cherished one most of all, a Broken one not at all - Titles.js)
    like: (f) =>
      0.4 * _tame(f) + 0.25 * _happyLevel(f) + 0.15 * (f.growth < 1 ? 1 : 0) + 0.2 * _tricksLevel(f) +
      (typeof titleOf === "function" ? { Cherished: 0.2, Broken: -0.4, Rebel: -0.2 }[titleOf(f)] || 0 : 0),
  },
  {
    id: "kid",
    label: "A kid with pocket money",
    wants: "a cute foal",
    budget: 0.6,
    patience: 1,
    generous: 0.1,
    weight: (lvl) => 2 * (typeof familyRepWeight === "function" ? familyRepWeight() : 1),
    like: (f) => 0.5 * (f.growth < 1 ? 1 : 0) + 0.3 * _happyLevel(f) + 0.2 * _tricksLevel(f),
  },
  {
    id: "bargain",
    label: "A bargain hunter",
    wants: "a cheap fluffy",
    budget: 0.8,
    patience: 3,
    generous: 0.1,
    weight: (lvl) => 2,
    like: (f) => 0.5,
  },
  {
    id: "farmer",
    label: "A farmer",
    wants: "a sturdy grown earthy",
    budget: 0.9,
    patience: 2,
    generous: 0.2,
    weight: (lvl) => 1.5,
    like: (f) => 0.4 * (f.type === "earthy" ? 1 : 0) + 0.3 * (f.growth >= 1 ? 1 : 0) + 0.3 * Math.min(1, (f.health ?? 100) / 100),
  },
  {
    id: "collector",
    label: "A collector",
    wants: "rare colours and types",
    budget: 1.35,
    patience: 1,
    generous: 0.35,
    weight: (lvl) => 0.5 + 0.6 * lvl,
    like: (f) => 0.55 * _showCoat(f) + 0.2 * _hasPattern(f) + 0.25 * (f.type !== "earthy" ? 1 : 0),
  },
  {
    id: "shady",
    label: "A shady dealer",
    wants: "an obedient one - no questions asked",
    budget: 1,
    patience: 1,
    generous: 0.2,
    dark: true,
    weight: (lvl) => (darkMarketDue() ? DARK_MARKET_WEIGHT * (typeof darkRepWeight === "function" ? darkRepWeight() : 1) : 0),
    like: (f) => darkValue(f),
    flatPrice: (f) => (40 + 260 * darkValue(f)) * (typeof darkRepPay === "function" ? darkRepPay() : 1), // (no looks, no affection, no scars)
  },
  {
    id: "show",
    label: "A show breeder",
    wants: "a prize winner with a lovely coat",
    budget: 1.3,
    patience: 2,
    generous: 0.3,
    minLevel: 3,
    weight: (lvl) => 0.8 * (lvl - 2),
    like: (f) => {
      const r = typeof ribbonCounts === "function" ? ribbonCounts(f) : { first: 0, second: 0, third: 0 };
      const ribbons = r.first + r.second + r.third > 0 ? 1 : 0;
      return 0.45 * ribbons + 0.45 * _showCoat(f) + 0.1 * (f.growth >= 1 ? 1 : 0);
    },
  },
  {
    // A biology teacher (from "Science Class with Smarty"): only ever for a
    // body or a fluffy that's dying, never picked at random - see
    // makeDissectionRequest. Takes it away; nothing is shown.
    id: "teacher",
    label: "A biology teacher",
    wants: "a dead or dying fluffy, for a class",
    budget: 1,
    patience: 1,
    generous: 0.1,
    weight: () => 0,
    like: () => 0.5,
    flatPrice: (f) => (f.isAlive ? DISSECT_PAY[1] : DISSECT_PAY[0]),
  },
];

// ---- The biology teacher ----
const DISSECT_CHANCE = 0.3; // when a buyer's due and there's a body or a dying fluffy
const DISSECT_PAY = [20, 30]; // a body, a dying one
const DISSECT_DYING_HEALTH = 20;

function _dissectable(f) {
  if (!f || f.isDragging || f.isDestroyed || !f.adopted) return false;
  if (typeof getSceneConfig !== "function" || !getSceneConfig(f.scene).insidePlayerQuarters) return false;
  if (!f.isAlive) return true;
  if (f.notForSale) return false;
  return (f.health ?? 100) < DISSECT_DYING_HEALTH || (typeof wobblesShowing === "function" && wobblesShowing(f));
}

// script.js, a buyer due: now and then it's the teacher
function makeDissectionRequest(rnd = Math.random) {
  const list = fluffies.filter(_dissectable);
  if (!list.length || rnd() >= DISSECT_CHANCE) return null;
  const target = list[Math.floor(rnd() * list.length)];
  const kind = getBuyerKind("teacher");
  const { offer, maxPay } = buyerOffer(kind, target, _buyerLevel(), rnd);
  return { fluffyId: target.id, fluffy: target, price: offer, maxPay, like: 0.5, buyer: "teacher", patience: kind.patience, final: false, asks: 0, timer: BUYER_WAIT, said: null };
}

function _buyerLevel() {
  return typeof getOrderLevel === "function" ? getOrderLevel() : 1;
}

function getBuyerKind(id) {
  return BUYER_KINDS.find((k) => k.id === id) || BUYER_KINDS[0];
}

function pickBuyerKind(level = _buyerLevel(), rnd = Math.random) {
  const kinds = BUYER_KINDS.filter((k) => (k.minLevel || 1) <= level);
  const weights = kinds.map((k) => Math.max(0, k.weight(level)));
  let pick = rnd() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < kinds.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return kinds[i];
  }
  return kinds[kinds.length - 1];
}

// How it looks on the day: 1 = fine
function buyerConditionFactor(f) {
  let k = 1;
  const hp = f.health ?? 100;
  if (hp < 70) k *= 0.5 + (0.5 * hp) / 70;
  const missing = f.getMissingBodyParts ? f.getMissingBodyParts().length : 0;
  if (missing > 0) k *= Math.max(0.3, 1 - 0.25 * missing);
  if (typeof fluShowing === "function" && fluShowing(f)) k *= 0.5;
  if (f.isDiarrhea) k *= 0.85;
  return k;
}

function buyerLikes(kind, f) {
  try {
    return Math.max(0, Math.min(1, kind.like(f)));
  } catch (e) {
    return 0.5;
  }
}

// What they'd offer, and the most they'd pay
function buyerOffer(kind, f, level = _buyerLevel(), rnd = Math.random) {
  const like = buyerLikes(kind, f);
  const wealth = 1 + 0.06 * (level - 1);
  const fam = (kind.id === "family" || kind.id === "kid") && typeof familyRepBudget === "function" ? familyRepBudget() : 1;
  const market = typeof marketOfferMultiplier === "function" ? marketOfferMultiplier() : 1; // (Pressure.js)
  const base = (kind.flatPrice ? kind.flatPrice(f) : f.calculatePrice() * buyerConditionFactor(f)) * kind.budget * wealth * fam * market;
  const offer = Math.max(5, Math.round((base * (0.85 + 0.3 * like)) / 5) * 5);
  const maxPay = Math.max(offer, Math.round((offer * (1 + kind.generous * (0.4 + 0.6 * like) + 0.1 * rnd())) / 5) * 5);
  return { offer, maxPay, like };
}

// script.js: a buyer arrives. candidates: fluffies for sale
function makeSellRequest(candidates, rnd = Math.random) {
  if (!candidates || !candidates.length) return null;
  const level = _buyerLevel();
  const kind = pickBuyerKind(level, rnd);
  // The one they ask about: likelier the more they like it
  const scored = candidates.map((f) => ({ f, w: 0.05 + buyerLikes(kind, f) ** 2 }));
  let pick = rnd() * scored.reduce((s, x) => s + x.w, 0);
  let target = scored[scored.length - 1].f;
  for (const x of scored) {
    pick -= x.w;
    if (pick <= 0) {
      target = x.f;
      break;
    }
  }
  const { offer, maxPay, like } = buyerOffer(kind, target, level, rnd);
  if (kind.dark) darkMarket.lastDay = getDayNumber(); // (he won't be back for a while)
  return {
    fluffyId: target.id,
    fluffy: target, // for drawing
    price: offer,
    maxPay,
    like,
    buyer: kind.id,
    patience: kind.patience,
    final: false,
    asks: 0,
    timer: BUYER_WAIT,
    said: null, // the buyer's last reply
  };
}

// What they think of it, for the card
function describeBuyerInterest(req) {
  if (req.like >= 0.75) return "Loves this one!";
  if (req.like >= 0.5) return "Likes this one";
  return "Might take this one";
}

function askMorePrice(req) {
  return Math.round((req.price * (1 + ASK_MORE_STEP)) / 5) * 5;
}

// "Ask more": returns "agreed" | "final" | "left"
function askBuyerForMore(req = currentSellRequest, rnd = Math.random) {
  if (!req || req.final) return null;
  const want = askMorePrice(req);
  req.asks++;
  req.timer = Math.max(req.timer, 12);
  if (want <= req.maxPay) {
    req.price = want;
    req.said = `"Alright, $${want}."`;
    if (want === req.maxPay) req.final = true;
    return "agreed";
  }
  req.patience--;
  // Out of patience, or just put off: they leave
  if (req.patience < 0 || rnd() < 0.25) {
    const kind = getBuyerKind(req.buyer);
    if (typeof addUIMessage === "function") addUIMessage(`${kind.label} walked off: "Too much for me."`);
    currentSellRequest = null;
    return "left";
  }
  req.price = req.maxPay;
  req.final = true;
  req.said = `"$${req.maxPay}, and that's my final offer."`;
  return "final";
}

function acceptSellRequest() {
  const req = currentSellRequest;
  if (!req) return false;
  const i = fluffies.findIndex((f) => f.id === req.fluffyId);
  // (it has to still be sellable: no accessories on, not being carried)
  // (the teacher takes a body or a dying one: no other checks but carrying)
  if (i > -1 && req.buyer === "teacher" && fluffies[i].isDragging) {
    if (typeof addUIMessage === "function") addUIMessage("Put it down first.");
    return false;
  }
  if (i > -1 && req.buyer !== "teacher" && (!fluffies[i].canBeSold() || fluffies[i].isDragging)) {
    if (typeof addUIMessage === "function") addUIMessage(fluffies[i].isDragging ? "Put it down first." : "Take its accessories off first.");
    return false;
  }
  if (i > -1) {
    if (!showDebugMenu) money += req.price;
    if (typeof noteDayEvent === "function") noteDayEvent("sold", { money: req.price });
    if (typeof _saleBuyer !== "undefined") _saleBuyer = req.buyer; // (Reputation.js)
    if (typeof noteFluffyLeft === "function") noteFluffyLeft(fluffies[i], fluffies[i].isAlive ? "sold" : "taken", req.price);
    if (typeof noteSoldFromCage === "function") noteSoldFromCage(fluffies[i]); // (CageLife.js: the others saw)
    if (getBuyerKind(req.buyer).dark) {
      darkMarket.sold = (darkMarket.sold || 0) + 1;
      if (typeof recordStory === "function") recordStory("turning", fluffies[i], { x: `${typeof fluffyDisplayName === "function" ? fluffyDisplayName(fluffies[i]) : "It"} was sold to a shady dealer.` });
      if (typeof addUIMessage === "function") addUIMessage("The dealer leads it away without a word.");
    }
    fluffies.splice(i, 1);
  }
  currentSellRequest = null;
  return true;
}

// ---- The card (UISelling.js draws it) ----

function sellRequestLayout() {
  const x = 10;
  const y = getSellRequestY();
  const bw = 96;
  const bh = 30;
  const by = y + SELL_CARD_H - 40;
  return {
    x,
    y,
    w: SELL_CARD_W,
    h: SELL_CARD_H,
    accept: { x: x + 10, y: by, w: bw, h: bh },
    ask: { x: x + 10 + bw + 7, y: by, w: bw + 10, h: bh },
    reject: { x: x + 10 + 2 * bw + 24, y: by, w: 90, h: bh },
  };
}

// Mouse down (UI.js): the card's buttons
function sellRequestClick() {
  if (!currentSellRequest || !getSceneConfig(currentScene).insidePlayerQuarters) return false;
  const L = sellRequestLayout();
  const hit = (b) => isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h);
  if (hit(L.accept)) {
    acceptSellRequest();
    return true;
  }
  if (hit(L.ask)) {
    if (!currentSellRequest.final) askBuyerForMore();
    return true;
  }
  if (hit(L.reject)) {
    currentSellRequest = null;
    return true;
  }
  return isPointInRect(mouse.x, mouse.y, L.x, L.y, L.w, L.h);
}
