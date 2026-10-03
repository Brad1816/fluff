// ---------------------------------------------------------------------------
// Trade (plan batch 4): the pet-food buyer, fake alicorns, and the mystery
// carrier.
//
// PET-FOOD BUYER ("A reptile shop buyer"): turns up now and then
// (PETFOOD_WEIGHT; more often with a dark name) wanting runts, poor colours,
// the old and the deformed - by weight. Pays a little (PETFOOD_BASE +
// PETFOOD_PER_WEIGHT x how heavy it is), whatever it looks like. Families
// hear of it: your family name drops (PETFOOD_REP) and nobody writes.
//
// FAKE ALICORNS: right-click an earthy, pegasus or unicorn of yours (or the
// Actions button): "Fake alicorn" ($FAKE_ALICORN_COST) - a horn and wings
// glued on. It looks like an alicorn (the other fluffies take it for a
// "munstah" too, if they fear alicorns), and it sells like one... until
// someone notices: a buyer, after the sale (FAKE_FOUND_CHANCE, a day or two
// later: they want their money back, and your family name takes a knock,
// FAKE_REP), the vet (always), or the welfare inspector (a fine). The glue
// comes off in the bath. The wings can't fly (Flight.js goes by its real
// type). Saved: f.fakeAlicorn; fakeAlicornState = { pending }.
//
// MYSTERY CARRIER: on the Computer (FluffList, the Food tab): a sealed
// carrier for a flat MYSTERY_PRICE, delivered with the food (about
// FOOD_DELIVERY_HOURS). Inside: any type (now and then a rare one, very
// rarely an alicorn), any colours, any age - and sometimes a dud: a runt,
// sick, old, or simple-minded.
// ---------------------------------------------------------------------------

const PETFOOD_WEIGHT = 0.6;
const PETFOOD_BASE = 6;
const PETFOOD_PER_WEIGHT = 30;
const PETFOOD_REP = 1;
const FAKE_ALICORN_COST = 40;
const FAKE_FOUND_CHANCE = 0.6;
const FAKE_REP = 3;
const FAKE_INSPECT_FINE = 150;
const MYSTERY_PRICE = 120;
const MYSTERY_DUD = 0.25;

// ---- The pet-food buyer ----

// 0..1: what he's after
function petFoodValue(f) {
  let v = 0;
  if (f.runt) v += 0.5;
  if (typeof isPoopieCoated === "function" && isPoopieCoated(f)) v += 0.35;
  if (Array.isArray(f.deformities) && f.deformities.length) v += 0.3;
  const stage = typeof lifeStage === "function" ? lifeStage(f) : "adult";
  if (stage === "senior" || stage === "elderly") v += 0.4;
  if ((f.health ?? 100) < 60) v += 0.2;
  return Math.min(1, v);
}

// What he pays: by weight (a foal weighs little)
function petFoodPrice(f) {
  const size = Math.max(0.15, Math.min(1, f.growth || 0)) * (1 + 0.6 * (f.weight || 0)) * (f.runt ? 0.7 : 1);
  return Math.round(PETFOOD_BASE + PETFOOD_PER_WEIGHT * size);
}

if (typeof BUYER_KINDS !== "undefined") {
  BUYER_KINDS.push({
    id: "petfood",
    label: "A reptile shop buyer",
    wants: "runts, poor colours and old ones - by weight, for feed",
    budget: 1,
    patience: 1,
    generous: 0.05,
    weight: () => PETFOOD_WEIGHT * (typeof darkRepWeight === "function" ? Math.sqrt(darkRepWeight()) : 1),
    like: (f) => petFoodValue(f),
    flatPrice: (f) => petFoodPrice(f),
  });
}

// Reputation.noteSoldForRep: families hear of it
function notePetFoodSale(f) {
  if (typeof keeperRep === "undefined" || !keeperRep) return;
  keeperRep.family = Math.max(-(typeof REP_MAX === "number" ? REP_MAX : 40), (keeperRep.family || 0) - PETFOOD_REP);
}

// ---- Fake alicorns ----

function freshFakeAlicornState() {
  return { pending: [] };
}
let fakeAlicornState = freshFakeAlicornState();
if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({
    name: "fakeAlicornState",
    get: () => fakeAlicornState,
    set: (v) => (fakeAlicornState = v && typeof v === "object" ? v : freshFakeAlicornState()),
    fresh: () => freshFakeAlicornState(),
  });
}

function canFakeAlicorn(f) {
  return !!f && f.isAlive && f.adopted && f.type !== "alicorn" && !f.fakeAlicorn && f.growth >= 0.3;
}

function makeFakeAlicorn(f) {
  if (!canFakeAlicorn(f)) return false;
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < FAKE_ALICORN_COST) {
    if (typeof addUIMessage === "function") addUIMessage(`Not enough money ($${FAKE_ALICORN_COST}).`);
    return false;
  }
  if (!free) money -= FAKE_ALICORN_COST;
  f.fakeAlicorn = { had: { horn: !!f.limbs.horn, leftWing: !!f.limbs.leftWing, rightWing: !!f.limbs.rightWing } };
  f.limbs.horn = true;
  f.limbs.leftWing = true;
  f.limbs.rightWing = true;
  if (f.renderer) f.renderer.tinted = null; // (drawn again with them)
  f.changeHappiness(-0.04, "Horn and wings glued on");
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["FAKE_ALICORN", "GLUED"], f), true);
  if (typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(f)} has a horn and wings glued on. It'll pass for an alicorn - for a while.`);
  return true;
}

// The glue comes off (the bath; the vet)
function removeFakeAlicorn(f, how = "bath") {
  if (!f || !f.fakeAlicorn) return false;
  const had = f.fakeAlicorn.had || {};
  // Only the glued-on parts come off (a real one cut off meanwhile stays gone)
  for (const k of ["horn", "leftWing", "rightWing"]) if (!had[k]) f.limbs[k] = false;
  f.fakeAlicorn = null;
  if (f.renderer) f.renderer.tinted = null;
  if (typeof addUIMessage === "function" && f.adopted) addUIMessage(how === "bath" ? `The glued-on horn and wings came off ${fluffyDisplayName(f)} in the bath.` : `The vet peeled the horn and wings off ${fluffyDisplayName(f)}.`);
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["FAKE_ALICORN", "OFF"], f), true);
  return true;
}

// HorseGenetics.calculatePrice: it sells like an alicorn
function fakeAlicornPriceMultiplier(f) {
  if (!f || !f.fakeAlicorn || f.type === "alicorn") return 1;
  const base = f.type === "pegasus" || f.type === "unicorn" ? 2 : 1;
  return 30 / base;
}

// FamilyTree.noteFluffyLeft (sold): a buyer may find out
function noteFakeAlicornSold(f, price) {
  if (!f || !f.fakeAlicorn || Math.random() >= FAKE_FOUND_CHANCE) return;
  const st = fakeAlicornState && Array.isArray(fakeAlicornState.pending) ? fakeAlicornState : (fakeAlicornState = freshFakeAlicornState());
  st.pending.push({ due: getDayNumber() + 1 + Math.floor(Math.random() * 2), price: Math.round(price || 0), name: fluffyDisplayName(f) });
}

function _taDaily() {
  const st = fakeAlicornState;
  if (!st || !Array.isArray(st.pending) || !st.pending.length) return;
  const day = getDayNumber();
  const due = st.pending.filter((p) => p.due <= day);
  st.pending = st.pending.filter((p) => p.due > day);
  for (const p of due) {
    const refund = Math.round(p.price * 0.9);
    money -= refund;
    if (typeof keeperRep !== "undefined" && keeperRep) keeperRep.family = Math.max(-40, (keeperRep.family || 0) - FAKE_REP);
    const text = `A buyer found out "${p.name}" was no alicorn - the horn and wings were glued on. You refunded $${refund}, and word gets around.`;
    if (typeof addUIMessage === "function") addUIMessage(text);
    if (typeof noteDayEvent === "function") noteDayEvent("news", { text });
  }
}

// Vet.vetCheckUp: the vet always notices
function vetSpotsFake(f, found) {
  if (!f || !f.fakeAlicorn) return;
  found.push("the horn and wings are glued on");
}

// Inspector.inspectHouse
function inspectorSpotsFake(f) {
  return !!(f && f.fakeAlicorn);
}

// ---- The mystery carrier ----

let mysteryDeliveries = []; // [{ due }]
if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({
    name: "mysteryDeliveries",
    get: () => mysteryDeliveries,
    set: (v) => (mysteryDeliveries = Array.isArray(v) ? v : []),
    fresh: () => [],
  });
}

function orderMysteryCarrier() {
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < MYSTERY_PRICE) {
    if (typeof addUIMessage === "function") addUIMessage("Not enough money for the mystery carrier!");
    return null;
  }
  if (!free) money -= MYSTERY_PRICE;
  const d = { due: timePlayed + (typeof FOOD_DELIVERY_HOURS === "number" ? FOOD_DELIVERY_HOURS : 2) * HOUR_LENGTH };
  mysteryDeliveries.push(d);
  if (typeof addUIMessage === "function") addUIMessage(`Ordered a mystery carrier for $${MYSTERY_PRICE}. It'll be here in about ${typeof FOOD_DELIVERY_HOURS === "number" ? FOOD_DELIVERY_HOURS : 2} hours.`);
  return d;
}

// What's inside
function openMysteryCarrier(scene = "INDOORS") {
  const r = Math.random();
  const type = r < 0.01 ? "alicorn" : r < 0.2 ? "unicorn" : r < 0.4 ? "pegasus" : "earthy";
  const age = Math.random();
  const growth = age < 0.3 ? 0.2 + Math.random() * 0.5 : 1;
  const q = () => (Math.random() < 0.15 ? 0.85 + Math.random() * 0.15 : Math.random());
  const f = new Horse(growth, null, scene, type, null, q(), q());
  if (typeof f.makeType === "function") f.makeType(type);
  f.personalities = (f.personalities || []).filter((p) => p !== "smarty");
  f.adopted = true;
  f.x = 300 + Math.random() * (width - 600);
  f.y = height * 0.6;
  fluffies.push(f);
  if (typeof setSpawnAge === "function") setSpawnAge(f);
  let dud = null;
  if (Math.random() < MYSTERY_DUD) {
    dud = ["runt", "sick", "old", "dim"][Math.floor(Math.random() * 4)];
    if (dud === "runt" && typeof makeRunt === "function") makeRunt(f);
    else if (dud === "sick" && typeof catchFlu === "function") catchFlu(f);
    else if (dud === "old" && growth >= 1) f.age = Math.max(f.age || 0, (SENIOR_DAYS + 4) * DAY_LENGTH);
    else if (dud === "dim") f.deformities = [...(Array.isArray(f.deformities) ? f.deformities : []), "dim"];
  }
  f.fromMystery = true;
  const what = `${type === "alicorn" ? "an" : "a"} ${type}${growth < 1 ? " foal" : ""}`;
  const dudText = { runt: " - a runt", sick: " - and it's sick", old: " - an old one", dim: " - a simple-minded one" }[dud] || "";
  if (typeof addUIMessage === "function") addUIMessage(`Your mystery carrier arrived: ${what}${dudText}${type === "alicorn" ? " - an alicorn! Lucky you!" : ""}.`);
  return f;
}

let _taLastDay = null;
const tradeTicker = new Ticker(2);
function updateTrade(dt) {
  if (!tradeTicker.step(dt)) return;
  const now = timePlayed;
  if (mysteryDeliveries.length) {
    const due = mysteryDeliveries.filter((d) => d.due <= now);
    if (due.length) {
      mysteryDeliveries = mysteryDeliveries.filter((d) => d.due > now);
      for (const d of due) openMysteryCarrier("INDOORS");
    }
  }
  const day = getDayNumber();
  if (_taLastDay !== day) {
    _taLastDay = day;
    _taDaily();
  }
}
registerSystem("trade", updateTrade, 137);

// The Computer's Food tab: the carrier's card (OnlineShop.js draws and clicks it)
function mysteryCardLayout() {
  const n = typeof onlineFoods === "function" ? onlineFoods().length : 5;
  const y = 90 + n * 76;
  return { x: 20, y, w: 700, h: 68, buy: { x: 20 + 540, y: y + 18, w: 134, h: 32, label: `Buy $${MYSTERY_PRICE}` } };
}

function drawMysteryCard(c, theme, m) {
  const L = mysteryCardLayout();
  c.fillStyle = theme.card;
  roundRectPath(c, L.x, L.y, L.w, L.h, 8);
  c.fill();
  canvasText(c, "Mystery carrier", L.x + 16, L.y + 26, theme.cardText, "bold 16px Arial");
  canvasText(c, `$${MYSTERY_PRICE}, sealed`, L.x + 16, L.y + 48, theme.sub, "13px Arial");
  canvasText(c, `Any type, colour or age - sometimes rare, sometimes a dud.${mysteryDeliveries.length ? ` (${mysteryDeliveries.length} on its way)` : ""}`, L.x + 140, L.y + 48, theme.sub, "italic 12px Arial");
  if (typeof _osButton === "function") _osButton(c, L.buy, m, theme, money < MYSTERY_PRICE && !(typeof showDebugMenu !== "undefined" && showDebugMenu));
}

function handleMysteryCardClick(m) {
  const L = mysteryCardLayout();
  if (typeof _osIn === "function" && _osIn(m, L.buy)) {
    orderMysteryCarrier();
    return true;
  }
  return false;
}

// ---- Right-click ----

function tradeActions(f) {
  const out = [];
  if (canFakeAlicorn(f)) out.push({ key: "fake_alicorn", name: "Fake alicorn", sub: `glue on $${FAKE_ALICORN_COST}`, harsh: true, run: (x) => makeFakeAlicorn(x) });
  return out;
}

// Magnifying glass: [text, tone] or null
function describeFakeAlicorn(f) {
  if (!f || !f.fakeAlicorn) return null;
  return ["Fake alicorn: horn and wings glued on (sells high until someone notices; comes off in the bath)", "bad"];
}
