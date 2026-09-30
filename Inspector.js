// ---------------------------------------------------------------------------
// The inspector, the mill trade, and rescue (design doc Phase 6).
//
// The inspector (the Fluffy Welfare Office): once a game day there's a
// chance of a surprise visit, INSPECT_CHANCE, far higher with a poor name
// with families (Reputation.js) or a dark one, INSPECT_CHANCE_BAD. First a
// warning letter; the visit comes on a later morning. The inspector walks
// through the living room, the rooms either side of it and the backyard -
// not the back rooms beyond, and not inside cages (hiding things is part of
// play). What's seen:
//   serious   a fluffy starving, Broken, or missing a leg, eye or ear
//   minor     scars from you, filthy, terrified of you, a crowded room, a
//             Fearful room
// Score = minor + 3 x serious. Nothing: you pass (families hear, +name).
// Some: a fine (INSPECT_FINE a point, added to your bills if you can't pay).
// A lot (INSPECT_SEIZE_AT+): a fine, and the worst-off fluffies (up to
// INSPECT_SEIZE_MAX) are taken to the shelter, where you could adopt them
// back if you pay.
//
// The mill trade: put fluffies in a "sell" cage and right-click one: "Sell
// the lot" - the pet-shop van takes every one in that cage at
// WHOLESALE_SHARE of its price, whatever it's like (no haggling, no notes
// home). Once a day. More fluffies in less space on cheap food earns more a
// day at less each; the dark market hears of it (Reputation.js).
//
// Rescue and rehab: now and then the shelter has a fluffy taken from a
// dealer (Shelter.js: Broken, scarred, afraid of people). Heal one (or one
// of your own) from Broken to a Survivor or Cherished and families hear of
// it (REHAB_REP), with a goal and a story line.
// ---------------------------------------------------------------------------

const INSPECT_CHANCE = 0.02;
const INSPECT_CHANCE_BAD = 0.25;
const INSPECT_FINE = 30;
const INSPECT_SEIZE_AT = 7;
const INSPECT_SEIZE_MAX = 2;
const WHOLESALE_SHARE = 0.55;
const REHAB_REP = 5;

function freshInspector() {
  return { warned: null, visits: 0, lastDay: -99, wholesaleDay: -99, rehabbed: 0 };
}
let inspector = freshInspector();

function _inOk() {
  if (!inspector || typeof inspector !== "object") inspector = freshInspector();
  for (const [k, v] of Object.entries(freshInspector())) if (inspector[k] === undefined) inspector[k] = v;
  return inspector;
}
function _inDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : 1;
}
function _inName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
}
function _inSay(t) {
  if (typeof addUIMessage === "function") addUIMessage(t);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: t });
}

function _badName() {
  const r = typeof keeperRep !== "undefined" && keeperRep ? keeperRep : { family: 0, dark: 0 };
  return (r.family || 0) <= -6 || (r.dark || 0) >= 10;
}

// The rooms the inspector walks through
function inspectedScenes() {
  return ["INDOORS", "INDOORSL1", "INDOORSR1", "BACKYARD"];
}

// What the inspector sees: { serious: [..], minor: [..], score, worst: [fluffies] }
function inspectHouse() {
  const serious = [];
  const minor = [];
  const worst = new Map();
  const scenes = inspectedScenes();
  const add = (list, f, text, w) => {
    list.push(text);
    if (f) worst.set(f, (worst.get(f) || 0) + w);
  };
  for (const f of typeof fluffies !== "undefined" ? fluffies : []) {
    if (!f.isAlive || !f.adopted || !scenes.includes(f.scene) || f.currentCage) continue;
    const n = _inName(f);
    if (f.hunger < 0.2) add(serious, f, `${n} is starving`, 3);
    if (typeof titleOf === "function" && titleOf(f) === "Broken") add(serious, f, `${n} is broken in spirit`, 3);
    const missing = typeof f.getMissingBodyParts === "function" ? f.getMissingBodyParts() : [];
    if (missing.some((p) => /leg|eye|ear/i.test(String(p)))) add(serious, f, `${n} has been maimed`, 3);
    if ((f.scars || []).some((s) => !/fight/.test(s.how))) add(minor, f, `${n} has scars from you`, 1);
    if ((f.dirt || 0) >= 0.8) add(minor, f, `${n} is filthy`, 1);
    if ((f.playerFear || 0) >= 0.6) add(minor, f, `${n} cowers from people`, 1);
  }
  for (const s of scenes) {
    if (typeof crowding === "function" && crowding(s) > 0.5) add(minor, null, `${typeof houseRoomName === "function" && houseRoomName(s) ? houseRoomName(s) : "The backyard"} is badly overcrowded`, 1);
    if (typeof climateOf === "function" && climateOf(s).label === "Fearful" && (typeof fluffies === "undefined" || fluffies.some((f) => f.adopted && f.isAlive && f.scene === s)))
      add(minor, null, `${typeof houseRoomName === "function" && houseRoomName(s) ? houseRoomName(s) : "The backyard"} is full of frightened fluffies`, 1);
  }
  const ranked = [...worst.entries()].filter(([, w]) => w >= 3).sort((a, b) => b[1] - a[1]).map(([f]) => f);
  return { serious, minor, score: minor.length + 3 * serious.length, worst: ranked };
}

// A visit: what happens
function inspectorVisit() {
  const I = _inOk();
  I.visits++;
  I.lastDay = _inDay();
  I.warned = null;
  const r = inspectHouse();
  const out = { ...r, fine: 0, seized: [] };
  if (r.score === 0) {
    _inSay("The welfare inspector came round, and found nothing wrong.");
    if (typeof keeperRep !== "undefined" && keeperRep) keeperRep.family = Math.min(40, (keeperRep.family || 0) + 2);
    return out;
  }
  out.fine = INSPECT_FINE * r.score;
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free) {
    const paid = Math.min(money, out.fine);
    money -= paid;
    if (out.fine > paid && typeof billsOwed === "number") billsOwed += out.fine - paid;
  }
  const what = [...r.serious, ...r.minor].slice(0, 3).join("; ");
  _inSay(`The welfare inspector fined you $${out.fine.toLocaleString()}: ${what}${r.serious.length + r.minor.length > 3 ? ", and more" : ""}.`);
  if (r.score >= INSPECT_SEIZE_AT) {
    for (const f of r.worst.slice(0, INSPECT_SEIZE_MAX)) {
      out.seized.push(f);
      seizeFluffy(f);
    }
  }
  return out;
}

// Taken to the shelter (or away, if there's no room there)
function seizeFluffy(f) {
  const n = _inName(f);
  if (typeof recordStory === "function") recordStory("turning", f, { x: `${n} was taken away by the welfare inspector.` });
  let res = null;
  if (typeof giveUpToShelter === "function" && typeof canGiveUpToShelter === "function" && canGiveUpToShelter()) {
    res = giveUpToShelter(f);
    if (res) {
      res.origin = "seized";
      res.backstory = "Taken from a keeper by the welfare inspector";
    }
  }
  if (!res) {
    if (typeof noteFluffyLeft === "function") noteFluffyLeft(f, "taken by the inspector");
    const i = fluffies.indexOf(f);
    if (i > -1) fluffies.splice(i, 1);
  }
  _inSay(`The inspector took ${n} away${res ? " to the shelter" : ""}.`);
  return res;
}

// Each morning: maybe a letter, maybe a visit
function _inMorning() {
  const I = _inOk();
  const day = _inDay();
  if (I.warned !== null && day > I.warned) return inspectorVisit();
  const chance = _badName() ? INSPECT_CHANCE_BAD : INSPECT_CHANCE;
  if (I.warned === null && day - I.lastDay > 2 && Math.random() < chance) {
    I.warned = day;
    _inSay(_badName() ? "A letter from the Fluffy Welfare Office: they've had complaints, and an inspector will call." : "A letter from the Fluffy Welfare Office: a routine inspection is due.");
  }
  return null;
}

// ---- The mill trade ----

function _sellCageMates(f) {
  if (!f || !f.currentCage || f.currentCage.tag !== "sell") return [];
  return fluffies.filter((o) => o.isAlive && o.adopted && o.currentCage === f.currentCage && !o.isDragging);
}

function wholesaleActions(f) {
  const I = _inOk();
  const lot = _sellCageMates(f);
  if (lot.length < 2 || I.wholesaleDay === _inDay()) return [];
  const total = lot.reduce((s, o) => s + Math.round(o.calculatePrice() * WHOLESALE_SHARE), 0);
  return [{ key: "wholesale", name: "Sell the lot", sub: `${lot.length} for $${total}`, harsh: true, run: (x) => sellWholesale(x) }];
}

function sellWholesale(f) {
  const I = _inOk();
  const lot = _sellCageMates(f);
  if (!lot.length) return 0;
  I.wholesaleDay = _inDay();
  let total = 0;
  for (const o of lot) {
    const price = Math.round(o.calculatePrice() * WHOLESALE_SHARE);
    total += price;
    if (typeof _saleBuyer !== "undefined") _saleBuyer = "wholesale";
    if (typeof noteFluffyLeft === "function") noteFluffyLeft(o, "sold", price);
    if (typeof noteDayEvent === "function") noteDayEvent("sold", { money: price });
    const i = fluffies.indexOf(o);
    if (i > -1) fluffies.splice(i, 1);
  }
  if (!(typeof showDebugMenu !== "undefined" && showDebugMenu)) money += total;
  if (typeof keeperRep !== "undefined" && keeperRep) keeperRep.dark = Math.min(40, (keeperRep.dark || 0) + Math.floor(lot.length / 3));
  if (typeof addUIMessage === "function") addUIMessage(`The pet-shop van took ${lot.length} fluffies for $${total.toLocaleString()}.`);
  return total;
}

// ---- Rescue and rehab (Titles.setTitle) ----
function noteRehab(f, from, to) {
  if (from !== "Broken" || (to !== "Survivor" && to !== "Cherished")) return;
  const I = _inOk();
  I.rehabbed++;
  if (typeof keeperRep !== "undefined" && keeperRep) keeperRep.family = Math.min(40, (keeperRep.family || 0) + REHAB_REP);
  const n = _inName(f);
  _inSay(`${n} has come back from being Broken. Word gets round: families hear you rehabilitate fluffies.`);
  if (typeof noteGoalEvent === "function") noteGoalEvent("rehab", {});
}

const inspectorTicker = new Ticker(10);
let _inCheckedDay = null;
function updateInspector(dt) {
  if (!inspectorTicker.step(dt)) return;
  const day = _inDay();
  if (_inCheckedDay === day) return;
  const first = _inCheckedDay === null;
  _inCheckedDay = day;
  if (!first) _inMorning();
}

registerSystem("inspector", updateInspector, 176);
