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
//              With no grown fluffies left to take, the landlord writes the
//              debt off instead (and the rent goes back to the start).
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
  return _prOk().debtDays >= POWER_CUT_DAY && typeof billsOwed === "number" && billsOwed > 0;
}

// Pay what you owe now (Accounts): the power comes back at once
function payDebtNow() {
  if (!(typeof billsOwed === "number" && billsOwed > 0) || !(money > 0)) return 0;
  const paid = Math.min(money, billsOwed);
  money -= paid;
  billsOwed -= paid;
  const p = _prOk();
  if (billsOwed <= 0) {
    billsOwed = 0;
    if (p.debtDays >= POWER_CUT_DAY && typeof addUIMessage === "function") addUIMessage("The debt's paid. The power's back on.");
    p.debtDays = 0;
  } else if (typeof addUIMessage === "function") addUIMessage(`You paid $${paid.toLocaleString()}. You still owe $${billsOwed.toLocaleString()}.`);
  return paid;
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
    if (p.debtDays === 1) say(`A final notice: you owe $${owed.toLocaleString()}. Pay it off before things get worse. (The landlord can lend you money: click your money, top left.)`);
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
  if (!grown.length) {
    // Nothing left to take (the long test games: a keeper who'd lost them
    // all owed more every day, for ever): the landlord writes it off, so
    // there's a way back (strays from the park, the shelter)
    // (foals aren't taken, so with only foals left there's nothing either)
    if (billsOwed > 0) {
      const owed = billsOwed;
      billsOwed = 0;
      _prOk().debtDays = 0;
      if (typeof economy !== "undefined" && economy && typeof RENT_BASE === "number") economy.rent = RENT_BASE;
      const t = `The bailiffs found nothing to take. The landlord writes off the $${owed.toLocaleString()} you owed and puts the rent back to $${typeof RENT_BASE === "number" ? RENT_BASE : 20}: a fresh start.`;
      if (typeof addUIMessage === "function") addUIMessage(t);
      if (typeof noteDayEvent === "function") noteDayEvent("news", { text: t });
    }
    return null;
  }
  const price = (f) => (typeof f.calculatePrice === "function" ? f.calculatePrice() : 50);
  grown.sort((a, b) => price(b) - price(a));
  // The cheapest one that covers the debt, or the dearest if none does
  const covers = grown.filter((g) => Math.round(price(g) * BAILIFF_SHARE) >= billsOwed);
  const f = covers.length ? covers[covers.length - 1] : grown[0];
  const worth = Math.round(price(f) * BAILIFF_SHARE);
  const n = _prName(f);
  // ...and any change comes back to you
  const change = Math.max(0, worth - billsOwed);
  billsOwed = Math.max(0, billsOwed - worth);
  if (change > 0 && !(typeof showDebugMenu !== "undefined" && showDebugMenu)) money += change;
  if (billsOwed <= 0) _prOk().debtDays = 0;
  if (typeof recordStory === "function") recordStory("turning", f, { x: `${n} was taken by the bailiffs for your debts.` });
  if (typeof noteFluffyLeft === "function") noteFluffyLeft(f, "taken by the bailiffs");
  const i = fluffies.indexOf(f);
  if (i > -1) fluffies.splice(i, 1);
  const t = `The bailiffs took ${n} for $${worth.toLocaleString()} of what you owe.${billsOwed > 0 ? ` You still owe $${billsOwed.toLocaleString()}.` : change > 0 ? ` They gave you $${change.toLocaleString()} change.` : ""}`;
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
  if (powerCut()) {
    if (typeof addUIMessage === "function") addUIMessage(`The vet needs $${amount}, and won't give credit while you're this far behind.`);
    return false;
  }
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
