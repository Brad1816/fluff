// ---------------------------------------------------------------------------
// Temperament: how a fluffy's upbringing affects what it's worth.
//
// Customers pay more for a happy fluffy that trusts people, and less for a
// frightened or traumatised one. temperamentScore() mixes:
//   happiness (35%), trust in you (35%), not being afraid of you (30%),
//   minus half its permanent trauma (Separation.js)
// and temperamentMultiplier() turns that into a price multiplier from
// TEMPERAMENT_MIN (0.4x) to TEMPERAMENT_MAX (1.3x). An ordinary fluffy
// (a bit happy, middling trust, not scared) comes out at about 1x, so prices
// only move for fluffies you've raised well - or badly.
//
// Used by:
//   - HorseGenetics.calculatePrice (selling, the sell cage, buyers at the
//     door) - so the magnifying glass "Sells for" line shows it too
//   - Orders.js: customers tip for a delightful fluffy and pay less (and
//     think less of you) for a damaged one; some orders want "No lasting
//     trauma"
// ---------------------------------------------------------------------------

const TEMPERAMENT_MIN = 0.4;
const TEMPERAMENT_MAX = 1.3;

const TEMPERAMENT_LABELS = [
  // [lowest multiplier, label, tone]
  [1.2, "Delightful pet", "good"],
  [1.07, "Good-natured", "good"],
  [0.9, "Ordinary", ""],
  [0.7, "Nervous", "ok"],
  [0, "Damaged", "bad"],
];

function temperamentScore(f) {
  if (!f || !f.isAlive) return 0;
  const happy = typeof f.happiness === "number" ? f.happiness : 0.6;
  const trust = typeof f.playerTrust === "number" ? f.playerTrust : 0.5;
  const fear = typeof f.playerFear === "number" ? f.playerFear : 0;
  const scars = typeof traumaLoad === "function" ? traumaLoad(f) : 0;
  return Math.max(0, Math.min(1, 0.35 * happy + 0.35 * trust + 0.3 * (1 - fear) - 0.5 * scars));
}

function temperamentMultiplier(f) {
  if (!f || !f.isAlive) return 1;
  return Math.max(TEMPERAMENT_MIN, Math.min(TEMPERAMENT_MAX, 0.4 + 0.9 * temperamentScore(f)));
}

// ["Good-natured", "good"]
function describeTemperament(f) {
  const m = temperamentMultiplier(f);
  for (const [min, label, tone] of TEMPERAMENT_LABELS) if (m >= min) return [label, tone];
  return ["Damaged", "bad"];
}

// "+15%" / "-40%" / "" (for ordinary)
function temperamentPriceText(f) {
  const m = temperamentMultiplier(f);
  const pct = Math.round((m - 1) * 100);
  if (Math.abs(pct) < 5) return "";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

// No permanent trauma and not grieving (for orders)
function isUntroubled(f) {
  const scars = typeof traumaLoad === "function" ? traumaLoad(f) : 0;
  const grieving = f.separation && f.separation.grief > 0.2;
  return scars === 0 && !grieving;
}

// Orders.js: what the customer does about the fluffy's temperament.
// Returns { money, repFactor, message }
function orderTemperamentReaction(f, reward) {
  const m = temperamentMultiplier(f);
  if (m >= 1.15) {
    const tip = Math.round(reward * (m - 1));
    return { money: tip, repFactor: 1, message: `The customer adores how friendly it is: +$${tip} tip!` };
  }
  if (m < 0.85) {
    const cut = Math.round(reward * (1 - m) * 0.6);
    return {
      money: -cut,
      repFactor: m < 0.7 ? 0.5 : 1,
      message: `The customer isn't happy with how scared it is: -$${cut}.`,
    };
  }
  return { money: 0, repFactor: 1, message: null };
}

// ---------------------------------------------------------------------------
// Settling in: a wild fluffy brought home from the park starts wary
// (Nervous). As good care raises its trust and eases its fear, it settles
// in; the magnifying glass shows "Settling in: 40%" until its temperament
// reaches Ordinary (SETTLED_AT), then you get a message and the line goes.
// ---------------------------------------------------------------------------

const SETTLED_AT = 0.95;
let _settleTimer = 0;

function startSettlingIn(f) {
  if (!f || f.settling) return;
  const m = temperamentMultiplier(f);
  if (m >= SETTLED_AT) return;
  f.settling = true;
  f.settleStart = m;
}

// 0..1, or null if it isn't settling in
function settlingProgress(f) {
  if (!f || !f.settling) return null;
  const start = Math.min(f.settleStart ?? 0.7, SETTLED_AT - 0.05);
  return Math.max(0, Math.min(1, (temperamentMultiplier(f) - start) / (SETTLED_AT - start)));
}

// script.js updateSimulation; checks every 2 seconds
function updateSettling(dt) {
  _settleTimer -= dt;
  if (_settleTimer > 0) return;
  _settleTimer = 2;
  for (const f of fluffies) {
    if (!f.settling) continue;
    if (!f.isAlive || !f.adopted) {
      if (!f.isAlive) f.settling = false;
      continue;
    }
    if (temperamentMultiplier(f) >= SETTLED_AT) {
      f.settling = false;
      const who = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
      if (typeof addUIMessage === "function") addUIMessage(`${who} has settled in with you.`);
    }
  }
}
