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

const BUYER_KINDS = [
  {
    id: "family",
    label: "A young family",
    wants: "a friendly fluffy for the kids",
    budget: 1.0,
    patience: 2,
    generous: 0.25,
    weight: (lvl) => 3,
    like: (f) => 0.4 * _tame(f) + 0.25 * _happyLevel(f) + 0.15 * (f.growth < 1 ? 1 : 0) + 0.2 * _tricksLevel(f),
  },
  {
    id: "kid",
    label: "A kid with pocket money",
    wants: "a cute foal",
    budget: 0.6,
    patience: 1,
    generous: 0.1,
    weight: (lvl) => 2,
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
];

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
  const base = f.calculatePrice() * buyerConditionFactor(f) * kind.budget * wealth;
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
  if (i > -1) {
    if (!showDebugMenu) money += req.price;
    if (typeof noteDayEvent === "function") noteDayEvent("sold", { money: req.price });
    if (typeof noteFluffyLeft === "function") noteFluffyLeft(fluffies[i], "sold", req.price);
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
