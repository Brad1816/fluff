// ---------------------------------------------------------------------------
// Pressure (design doc Phase 6): money troubles that bite.
//
// Debt (billsOwed, Bills.js): every morning you still owe money counts as a
// day in debt (pressure.debtDays):
//   day 1      a final notice
//   day 3+     the power's cut off: heaters don't work (Warmth.js) until
//              it's paid
//   day 5+     the bailiffs come: they take your most valuable grown fluffy
//              and put what it's worth (BAILIFF_SHARE of its price) towards
//              the debt. Every other day after that while you still owe.
// Paying it all off ends it (the power comes back).
//
// Slow and busy days: each morning the market has a mood (pressure.market):
// a slow day (SLOW_CHANCE, more in winter) brings half as many buyers and
// offers SLOW_OFFER of the usual; a busy day (BUSY_CHANCE) half as many again
// and a little more money. The morning report says so.
//
// The vet on credit: can't afford a treatment? Click it again and the vet
// treats it now and adds the bill (plus VET_CREDIT_FEE) to what you owe - a
// kind keeper's dilemma: the treatment, or the rent.
// ---------------------------------------------------------------------------

const BAILIFF_DAY = 5;
const POWER_CUT_DAY = 3;
const BAILIFF_SHARE = 0.6;
const SLOW_CHANCE = 0.15;
const SLOW_CHANCE_WINTER = 0.3;
const BUSY_CHANCE = 0.1;
const SLOW_OFFER = 0.85;
const BUSY_OFFER = 1.05;
const VET_CREDIT_FEE = 0.25;

function freshPressure() {
  return { debtDays: 0, market: "normal", marketDay: null };
}
let pressure = freshPressure();
let _vetCreditAsk = null; // { amount, at } (real time)

function _prOk() {
  if (!pressure || typeof pressure !== "object") pressure = freshPressure();
  if (typeof pressure.debtDays !== "number") pressure.debtDays = 0;
  return pressure;
}
function _prName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
}

function powerCut() {
  return _prOk().debtDays >= POWER_CUT_DAY;
}

// Bills.chargeDailyBills, each morning after paying what it could
function notePressureMorning(owed) {
  const p = _prOk();
  const say = (t) => {
    if (typeof addUIMessage === "function") addUIMessage(t);
    if (typeof noteDayEvent === "function") noteDayEvent("news", { text: t });
  };
  if (owed > 0) {
    p.debtDays++;
    if (p.debtDays === 1) say(`A final notice: you owe $${owed.toLocaleString()}. Pay it off before things get worse.`);
    if (p.debtDays === POWER_CUT_DAY) say("The power's been cut off until you pay what you owe. The heaters are cold.");
    if (p.debtDays >= BAILIFF_DAY && (p.debtDays - BAILIFF_DAY) % 2 === 0) sendBailiffs();
  } else {
    if (p.debtDays >= POWER_CUT_DAY) say("The debt's paid. The power's back on.");
    p.debtDays = 0;
  }
  _rollMarket();
}

// Take the most valuable grown fluffy towards the debt
function sendBailiffs() {
  if (typeof fluffies === "undefined") return null;
  const grown = fluffies.filter((f) => f.isAlive && f.adopted && f.growth >= 1 && !f.isDragging);
  if (!grown.length) return null;
  const price = (f) => (typeof f.calculatePrice === "function" ? f.calculatePrice() : 50);
  grown.sort((a, b) => price(b) - price(a));
  const f = grown[0];
  const worth = Math.round(price(f) * BAILIFF_SHARE);
  const n = _prName(f);
  billsOwed = Math.max(0, billsOwed - worth);
  if (typeof recordStory === "function") recordStory("turning", f, { x: `${n} was taken by the bailiffs for your debts.` });
  if (typeof noteFluffyLeft === "function") noteFluffyLeft(f, "taken by the bailiffs");
  const i = fluffies.indexOf(f);
  if (i > -1) fluffies.splice(i, 1);
  const t = `The bailiffs took ${n} for $${worth.toLocaleString()} of what you owe.${billsOwed > 0 ? ` You still owe $${billsOwed.toLocaleString()}.` : ""}`;
  if (typeof addUIMessage === "function") addUIMessage(t);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: t });
  return f;
}

// ---- The market's mood ----

function _rollMarket() {
  const p = _prOk();
  const day = typeof getDayNumber === "function" ? getDayNumber() : 1;
  if (p.marketDay === day) return;
  p.marketDay = day;
  const winter = typeof getSeason === "function" && /winter/i.test(String(getSeason()));
  const r = Math.random();
  const slow = winter ? SLOW_CHANCE_WINTER : SLOW_CHANCE;
  p.market = r < slow ? "slow" : r < slow + BUSY_CHANCE ? "busy" : "normal";
  if (p.market !== "normal" && typeof noteDayEvent === "function")
    noteDayEvent("news", { text: p.market === "slow" ? "A slow day for sales: few buyers about." : "Buyers are out in force today." });
}

// script.js: how fast the next buyer comes
function marketBuyerRate() {
  const m = _prOk().market;
  return m === "slow" ? 0.5 : m === "busy" ? 1.5 : 1;
}
// Buyers.buyerOffer
function marketOfferMultiplier() {
  const m = _prOk().market;
  return m === "slow" ? SLOW_OFFER : m === "busy" ? BUSY_OFFER : 1;
}

// ---- The vet on credit (Vet._vetPay) ----
// true: treat now, pay later
function vetOnCredit(amount) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (_vetCreditAsk && _vetCreditAsk.amount === amount && now - _vetCreditAsk.at < 8000) {
    _vetCreditAsk = null;
    const due = Math.round(amount * (1 + VET_CREDIT_FEE));
    billsOwed = (billsOwed || 0) + due;
    if (typeof addUIMessage === "function") addUIMessage(`On credit: $${due} added to what you owe.`);
    return true;
  }
  _vetCreditAsk = { amount, at: now };
  if (typeof addUIMessage === "function") addUIMessage(`The vet needs $${amount}. Click again to pay later, on credit (+${Math.round(VET_CREDIT_FEE * 100)}%).`);
  return false;
}

function describePressure() {
  const p = _prOk();
  const parts = [];
  if (p.debtDays > 0) parts.push(`${p.debtDays} day${p.debtDays === 1 ? "" : "s"} in debt${powerCut() ? ", power cut" : ""}`);
  if (p.market === "slow") parts.push("a slow day for sales");
  if (p.market === "busy") parts.push("a busy day for sales");
  return parts.join(" · ");
}
