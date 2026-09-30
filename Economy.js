// ---------------------------------------------------------------------------
// An economy that scales (new features, #6): costs that grow with you, so
// money trouble can reach a comfortable keeper too.
//
//   Rent reviews   once a week (RENT_REVIEW_DAYS) the landlord looks at what
//                  you've earned over the last week (sales, orders, show
//                  prizes, tips) and sets the rent to RENT_BASE plus
//                  RENT_SHARE of your average day's takings. It can at most
//                  double (plus RENT_RISE_EXTRA) in one go, and comes down
//                  slowly (by RENT_FALL a review at most) - so a big week
//                  followed by a slow one hurts.
//   Rooms          each extra room costs more than the last: BILL_PER_ROOM,
//                  then ROOM_STEP more for each one after.
//   Heating        in autumn and winter, the house itself costs
//                  HEAT_PER_ROOM[season] for each room with fluffies in it,
//                  and the heaters' running costs (Warmth.js) now go on the
//                  morning bill too. Nothing while the power's cut off.
//   Vet plan       at the vet: a daily premium (PLAN_BASE + PLAN_PER_FLUFFY
//                  each, more for elderly ones) and then check-ups are free
//                  and treatment and midwives cost PLAN_SHARE of the price.
//                  It only pays out from the day after you join.
//   Loans          the landlord will lend you money (Accounts): up to three
//                  times last week's takings (at least LOAN_MIN), paid back
//                  with LOAN_INTEREST over LOAN_DAYS mornings on the bill.
//                  One at a time; pay it off early whenever you like.
// All of it shows on the morning bill (Bills.js) and in the Accounts screen:
// click your money (top left) or press K.
// ---------------------------------------------------------------------------

const RENT_BASE = 20;
const RENT_SHARE = 0.12;
const RENT_REVIEW_DAYS = 7;
const RENT_RISE_EXTRA = 20;
const RENT_FALL = 0.15;
const ROOM_STEP = 10;
const HEAT_PER_ROOM = { Autumn: 4, Winter: 12 };
const PLAN_BASE = 10;
const PLAN_PER_FLUFFY = 3;
const PLAN_PER_ELDER = 3;
const PLAN_SHARE = 0.25; // what you still pay for treatment on the plan
const LOAN_MIN = 500;
const LOAN_INTEREST = 0.2;
const LOAN_DAYS = 10;
const LOAN_SIZES = [500, 2000, 5000, 15000];

function freshEconomy() {
  return { rent: RENT_BASE, week: [], today: 0, nextReview: 1 + RENT_REVIEW_DAYS, rentLog: [], plan: null, loan: null, heaterUse: 0, claims: 0 };
}
let economy = freshEconomy();

function _ecOk() {
  if (!economy || typeof economy !== "object") economy = freshEconomy();
  for (const [k, v] of Object.entries(freshEconomy())) if (economy[k] === undefined) economy[k] = v;
  if (!Array.isArray(economy.week)) economy.week = [];
  if (!Array.isArray(economy.rentLog)) economy.rentLog = [];
  return economy;
}
function _ecDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : 1;
}
function _ecFree() {
  return typeof showDebugMenu !== "undefined" && showDebugMenu;
}
function _ecSay(t) {
  if (typeof addUIMessage === "function") addUIMessage(t);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: t });
}

// ---- Income (DayReport.noteDayEvent for sales and orders; Shows; tips) ----
function noteIncome(amount) {
  if (!(amount > 0)) return;
  _ecOk().today += amount;
}

// Last week's takings, and the average day
function weeklyIncome() {
  const e = _ecOk();
  return e.week.reduce((s, x) => s + (x.amount || 0), 0);
}
function averageDailyIncome() {
  const e = _ecOk();
  return e.week.length ? weeklyIncome() / e.week.length : 0;
}

// What the landlord would ask, given last week
function rentTarget() {
  return Math.round(RENT_BASE + RENT_SHARE * averageDailyIncome());
}

function reviewRent() {
  const e = _ecOk();
  const old = e.rent;
  const target = rentTarget();
  let rent = old;
  if (target > old) rent = Math.min(target, old * 2 + RENT_RISE_EXTRA);
  else if (target < old) rent = Math.max(target, Math.round(old * (1 - RENT_FALL)), RENT_BASE);
  rent = Math.max(RENT_BASE, Math.round(rent));
  e.rent = rent;
  e.nextReview = _ecDay() + RENT_REVIEW_DAYS;
  e.rentLog.push({ day: _ecDay(), rent, income: Math.round(weeklyIncome()) });
  if (e.rentLog.length > 12) e.rentLog.shift();
  if (rent > old) _ecSay(`The landlord has seen how well you're doing: rent goes up to $${rent} a day (was $${old}).`);
  else if (rent < old) _ecSay(`A quieter week: the landlord brings the rent down to $${rent} a day (was $${old}).`);
  return rent;
}

// Each morning, before the bill (Bills.chargeDailyBills)
function economyMorning() {
  const e = _ecOk();
  const day = _ecDay();
  if (e.lastMorning === day) return;
  e.lastMorning = day;
  e.week.push({ day: day - 1, amount: Math.round(e.today) });
  while (e.week.length > RENT_REVIEW_DAYS) e.week.shift();
  e.today = 0;
  if (day >= e.nextReview) reviewRent();
}

// ---- Rooms ----
function roomsBill(n) {
  let t = 0;
  for (let i = 0; i < n; i++) t += (typeof BILL_PER_ROOM === "number" ? BILL_PER_ROOM : 15) + ROOM_STEP * i;
  return t;
}

// ---- Heating ----
function _ecRoomsInUse() {
  if (typeof fluffies === "undefined") return 0;
  const rooms = new Set();
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted) continue;
    if (typeof houseRoomName === "function" && houseRoomName(f.scene)) rooms.add(f.scene);
  }
  return rooms.size;
}
function houseHeatingToday() {
  if (typeof powerCut === "function" && powerCut()) return 0;
  const season = typeof getSeason === "function" ? getSeason() : "Spring";
  return (HEAT_PER_ROOM[season] || 0) * _ecRoomsInUse();
}
// Warmth.js: heaters' running costs go on the bill
function addHeaterUse(dollars) {
  if (dollars > 0) _ecOk().heaterUse += dollars;
}

// ---- The vet plan ----
function onVetPlan() {
  return !!_ecOk().plan;
}
function planCovers() {
  const p = _ecOk().plan;
  return !!p && _ecDay() > p.since;
}
function planPremium() {
  if (typeof fluffies === "undefined") return PLAN_BASE;
  let n = 0;
  let old = 0;
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted) continue;
    n++;
    if (typeof lifeStage === "function" && lifeStage(f) === "elderly") old++;
  }
  return PLAN_BASE + PLAN_PER_FLUFFY * n + PLAN_PER_ELDER * old;
}
function joinVetPlan() {
  const e = _ecOk();
  if (e.plan) return false;
  e.plan = { since: _ecDay() };
  _ecSay(`You joined the FluffVet plan: $${planPremium()} a day with the bills. It covers you from tomorrow.`);
  return true;
}
function leaveVetPlan() {
  const e = _ecOk();
  if (!e.plan) return false;
  e.plan = null;
  _ecSay("You left the FluffVet plan.");
  return true;
}
// Vet.js: what a visit really costs you
function vetPlanPrice(price, kind = "treat") {
  if (!planCovers()) return price;
  if (kind === "check") return 0;
  return Math.round(price * PLAN_SHARE);
}
function noteVetClaim(full, paid) {
  if (full > paid) _ecOk().claims += full - paid;
}

// ---- Loans ----
function loanLimit() {
  return Math.max(LOAN_MIN, Math.round(3 * weeklyIncome()));
}
function loanOffers() {
  if (_ecOk().loan) return [];
  const lim = loanLimit();
  return LOAN_SIZES.filter((a) => a <= lim);
}
function takeLoan(amount) {
  const e = _ecOk();
  if (e.loan || !loanOffers().includes(amount)) return false;
  const total = Math.round(amount * (1 + LOAN_INTEREST));
  e.loan = { amount, total, left: total, perDay: Math.ceil(total / LOAN_DAYS), day: _ecDay() };
  if (!_ecFree()) money += amount;
  _ecSay(`The landlord lent you $${amount.toLocaleString()}. You'll pay back $${total.toLocaleString()} over ${LOAN_DAYS} days with the bills.`);
  return true;
}
function repayLoan() {
  const e = _ecOk();
  if (!e.loan) return false;
  const left = e.loan.left;
  if (!_ecFree()) {
    if (money < left) {
      if (typeof addUIMessage === "function") addUIMessage(`You need $${left.toLocaleString()} to pay the loan off.`);
      return false;
    }
    money -= left;
  }
  e.loan = null;
  _ecSay("You paid the landlord's loan off.");
  return true;
}
function loanPaymentToday() {
  const l = _ecOk().loan;
  return l ? Math.min(l.left, l.perDay) : 0;
}

// ---- The bill (Bills.dailyBills) ----
// Extra lines: { heating, plan, loan }
function economyBillLines() {
  const e = _ecOk();
  const lines = {};
  const heating = houseHeatingToday() + Math.round(e.heaterUse);
  if (heating > 0) lines.heating = heating;
  if (e.plan) lines.plan = planPremium();
  const loan = loanPaymentToday();
  if (loan > 0) lines.loan = loan;
  return lines;
}
// After the morning's bill is charged (whatever was paid, it's on the bill:
// what couldn't be paid is owed)
function economyBillCharged() {
  const e = _ecOk();
  e.heaterUse = 0;
  if (e.loan) {
    e.loan.left -= loanPaymentToday();
    if (e.loan.left <= 0) {
      e.loan = null;
      _ecSay("That's the landlord's loan paid back.");
    }
  }
}

// ---- The Accounts screen ----

let accountsOpen = false;
function openAccounts() {
  accountsOpen = true;
}
function closeAccounts() {
  accountsOpen = false;
}
function isAccountsOpen() {
  return accountsOpen;
}

function getMoneyRect() {
  const text = `$${typeof money === "number" ? money : 0}`;
  let w = 80;
  if (typeof ctx !== "undefined" && ctx) {
    ctx.save();
    ctx.font = "bold 20px Arial";
    w = ctx.measureText(text).width;
    ctx.restore();
  }
  return { x: 6, y: 14, w: w + 12, h: 32 };
}

function getAccountsLayout() {
  const w = Math.min(860, width - 30);
  const h = Math.min(600, height - 30);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  const col2 = x + w / 2 + 10;
  const offers = loanOffers().map((a, i) => ({ amount: a, x: col2 + (i % 2) * 190, y: y + 380 + Math.floor(i / 2) * 42, w: 180, h: 34 }));
  const e = _ecOk();
  return {
    x,
    y,
    w,
    h,
    col2,
    offers,
    repay: e.loan ? { x: col2, y: y + 380, w: 240, h: 34 } : null,
    plan: { x: col2, y: y + 230, w: 240, h: 34 },
    close: { x: x + w - 150, y: y + h - 50, w: 130, h: 36 },
  };
}

function drawAccounts(c) {
  if (!accountsOpen) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const L = getAccountsLayout();
  const e = _ecOk();
  c.save();
  drawScreenPanel(c, L, { theme: "green", dim: 0.5 });
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.fillStyle = "#9ff0c8";
  c.font = "bold 24px Arial";
  c.fillText("Accounts", L.x + 24, L.y + 40);
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.75)";
  c.fillText(`Money $${money.toLocaleString()}${billsOwed > 0 ? `   ·   you owe $${billsOwed.toLocaleString()}` : ""}`, L.x + 150, L.y + 40);

  const head = (t, x, y) => {
    c.fillStyle = "#f7d774";
    c.font = "bold 16px Arial";
    c.fillText(t, x, y);
  };
  const row = (label, value, x, y, tone) => {
    c.font = "14px Arial";
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.fillText(label, x, y);
    c.textAlign = "right";
    c.fillStyle = tone === "bad" ? "#ff8a80" : tone === "good" ? "#9fe0a8" : "white";
    c.fillText(value, x + L.w / 2 - 60, y);
    c.textAlign = "left";
  };
  // Tomorrow morning's bill
  const x1 = L.x + 28;
  let y = L.y + 84;
  head("Tomorrow morning's bill", x1, y);
  y += 26;
  const b = typeof dailyBills === "function" ? dailyBills() : { total: 0 };
  const lines = [
    ["Rent", b.rent],
    ["Extra rooms", b.rooms],
    ["Your fluffies", b.fluffies],
    ["Boarding at the shelter", b.boarding],
    ["Heating", b.heating],
    ["Vet plan", b.plan],
    ["Loan repayment", b.loan],
  ];
  for (const [label, v] of lines) {
    if (!v) continue;
    row(label, `$${v.toLocaleString()}`, x1, y);
    y += 22;
  }
  if (billsOwed > 0) {
    row("Still owed from before", `$${billsOwed.toLocaleString()}`, x1, y, "bad");
    y += 22;
  }
  c.fillStyle = "rgba(255,255,255,0.25)";
  c.fillRect(x1, y - 12, L.w / 2 - 60, 1);
  y += 6;
  c.font = "bold 15px Arial";
  row("Total", `$${(b.total + (billsOwed || 0)).toLocaleString()}`, x1, y, b.total + billsOwed > money ? "bad" : null);
  y += 40;
  // Rent
  head("Rent", x1, y);
  y += 24;
  row("Last week's takings", `$${Math.round(weeklyIncome()).toLocaleString()}`, x1, y);
  y += 22;
  row("So far today", `$${Math.round(e.today).toLocaleString()}`, x1, y);
  y += 22;
  row("Next rent review", `day ${e.nextReview}`, x1, y);
  y += 22;
  const t = rentTarget();
  row("The landlord would ask", `$${t} a day`, x1, y, t > e.rent ? "bad" : t < e.rent ? "good" : null);
  y += 26;
  c.font = "12px Arial";
  c.fillStyle = "rgba(255,255,255,0.55)";
  for (const line of [
    `Rent is $${RENT_BASE} plus ${Math.round(RENT_SHARE * 100)}% of an average day's takings last week.`,
    "It rises fast after a good week and falls slowly after a bad one.",
    "Each extra room costs more than the one before; heating in autumn",
    "and winter depends on how many rooms your fluffies are in.",
  ]) {
    c.fillText(line, x1, y);
    y += 16;
  }

  // Vet plan
  const x2 = L.col2;
  y = L.y + 84;
  head("FluffVet plan", x2, y);
  y += 24;
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.85)";
  const planLines = e.plan
    ? [`You're on the plan: $${planPremium()} a day.`, planCovers() ? "Check-ups are free; treatment and midwives" : "It covers you from tomorrow.", planCovers() ? `cost ${Math.round(PLAN_SHARE * 100)}% of the price. Saved so far: $${Math.round(e.claims).toLocaleString()}.` : ""]
    : [`$${planPremium()} a day for all your fluffies (more for`, "elderly ones). Check-ups free; treatment and", `midwives ${Math.round(PLAN_SHARE * 100)}% of the price, from the day after joining.`];
  for (const line of planLines.filter(Boolean)) {
    c.fillText(line, x2, y);
    y += 20;
  }
  drawGlassButton(L.plan.x, L.plan.y, L.plan.w, L.plan.h, e.plan ? "Leave the plan" : `Join ($${planPremium()} a day)`, { fontSize: 14, borderRadius: 9 });

  // Loans
  y = L.y + 300;
  head("The landlord's loans", x2, y);
  y += 24;
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.85)";
  if (e.loan) {
    c.fillText(`You borrowed $${e.loan.amount.toLocaleString()}: $${e.loan.left.toLocaleString()} left to pay,`, x2, y);
    c.fillText(`$${e.loan.perDay.toLocaleString()} a morning with the bills.`, x2, y + 20);
    drawGlassButton(L.repay.x, L.repay.y, L.repay.w, L.repay.h, `Pay it all off ($${e.loan.left.toLocaleString()})`, { fontSize: 14, borderRadius: 9 });
  } else {
    c.fillText(`Pay back ${Math.round(LOAN_INTEREST * 100)}% more over ${LOAN_DAYS} mornings, with the bills.`, x2, y);
    c.fillText(`He'll lend up to $${loanLimit().toLocaleString()} (3 x last week's takings).`, x2, y + 20);
    for (const o of L.offers) drawGlassButton(o.x, o.y, o.w, o.h, `Borrow $${o.amount.toLocaleString()}`, { fontSize: 14, borderRadius: 9 });
  }
  drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 16, borderRadius: 10 });
  c.restore();
}

function handleAccountsClick() {
  if (!accountsOpen) return false;
  const L = getAccountsLayout();
  const hit = (r) => r && isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h);
  if (hit(L.close) || !hit(L)) {
    closeAccounts();
    return true;
  }
  if (hit(L.plan)) {
    if (onVetPlan()) leaveVetPlan();
    else joinVetPlan();
    return true;
  }
  if (hit(L.repay)) {
    repayLoan();
    return true;
  }
  for (const o of L.offers) {
    if (hit(o)) {
      takeLoan(o.amount);
      return true;
    }
  }
  return true;
}

// UI.js mousedown: clicking your money opens the accounts
function moneyClick() {
  const r = getMoneyRect();
  if (!isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h)) return false;
  if (typeof isAnyScreenOpen === "function" && isAnyScreenOpen()) return false;
  openAccounts();
  return true;
}

registerScreen({
  name: "accounts",
  layer: 26,
  isOpen: () => accountsOpen,
  close: () => closeAccounts(),
  draw: (c) => drawAccounts(c),
  click: () => handleAccountsClick(),
});
