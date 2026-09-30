// ---------------------------------------------------------------------------
// Rent and bills (design doc Phase 0, stage 2): a small daily charge so
// money doesn't just pile up. Phase 6 makes this harsher later.
//
// Every morning (with the day report, DayReport.js) you pay for the day
// before (dailyBills):
//   rent      BILL_RENT, plus BILL_PER_ROOM for each extra room you've bought
//   upkeep    BILL_PER_FLUFFY for each of your fluffies (a foal is half)
//   boarding  DAY_CARE_RECURRING_FEE_PER_FLUFFY for each one boarding at the
//             shelter (Shelter.js)
// Anything you can't pay is owed (billsOwed, saved) and taken first from
// the next mornings' money. The day report shows the bill, and what you owe.
// Nothing bad happens yet when you owe money; that's for phase 6.
// Free while the debug menu is open (like everything else).
// ---------------------------------------------------------------------------

const BILL_RENT = 20;
const BILL_PER_ROOM = 15;
const BILL_PER_FLUFFY = 5;

let billsOwed = 0;

function _billsRooms() {
  const l = typeof unlockedRoomsL === "number" ? unlockedRoomsL : 0;
  const r = typeof unlockedRoomsR === "number" ? unlockedRoomsR : 0;
  return l + r;
}

function _billsFluffies() {
  let n = 0;
  for (const f of fluffies) if (f.isAlive && f.adopted) n += f.growth < 1 ? 0.5 : 1;
  return n;
}

// { rent, rooms, fluffies, boarding?, total }
function dailyBills() {
  const rent = BILL_RENT;
  const rooms = BILL_PER_ROOM * _billsRooms();
  const pets = Math.round(BILL_PER_FLUFFY * _billsFluffies());
  const bill = { rent, rooms, fluffies: pets, total: rent + rooms + pets };
  // Fluffies boarding at the shelter (UIDayCare.js)
  const boarders = typeof dayCareFluffies !== "undefined" && Array.isArray(dayCareFluffies) ? dayCareFluffies.length : 0;
  if (boarders > 0) {
    bill.boarding = boarders * DAY_CARE_RECURRING_FEE_PER_FLUFFY;
    bill.total += bill.boarding;
  }
  return bill;
}

// Every morning (DayReport.js, before the day's card is made).
// Returns { total, paid, owed } for the card.
function chargeDailyBills() {
  const bill = dailyBills();
  if (typeof showDebugMenu !== "undefined" && showDebugMenu) return { ...bill, paid: 0, owed: billsOwed, free: true };
  const due = bill.total + billsOwed;
  const paid = Math.max(0, Math.min(money, due));
  money -= paid;
  billsOwed = due - paid;
  if (billsOwed > 0 && typeof addUIMessage === "function") {
    addUIMessage(`You couldn't pay all the bills. You owe $${billsOwed.toLocaleString()}.`);
  }
  return { ...bill, paid, owed: billsOwed };
}

// Day report row text
function describeBills(b) {
  if (!b) return null;
  if (b.free) return `$${b.total} (free: debug)`;
  const parts = [`rent $${b.rent}`];
  if (b.rooms) parts.push(`rooms $${b.rooms}`);
  if (b.fluffies) parts.push(`fluffies $${b.fluffies}`);
  if (b.boarding) parts.push(`boarding $${b.boarding}`);
  let t = `-$${b.total.toLocaleString()} (${parts.join(", ")})`;
  if (b.owed > 0) t += ` · you owe $${b.owed.toLocaleString()}`;
  return t;
}
