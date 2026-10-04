// ---------------------------------------------------------------------------
// Who would eat another fluffy (playtest decision): starving fluffies may
// turn to it if driven to - and only if they have it in them. A good
// fluffy never would.
//
// cannibalCapacity(f), 0..1: nothing for a good-natured fluffy (even
// temper, not a bad smarty, not broken by what's happened to it); more for
// a nasty temper (CANNIBAL_TEMPER), a bad smarty, a Broken one, lasting
// trauma; plus whatever it's learnt to accept (f.cannibalismAcceptance - the
// Foal-4-Sketties machine, or eating before). Used by
// HorsePositioning.scoutForCannibalism, when it's starving (EatDesire):
//   - the dead (bodies, scraps) need CANNIBAL_DEAD capacity
//   - the living need CANNIBAL_LIVE capacity and real starvation (hunger
//     under CANNIBAL_LIVE_HUNGER); it goes for the weakest it can reach
//   - each time, it only "chooses" to with a chance of its capacity
// ---------------------------------------------------------------------------

const CANNIBAL_TEMPER = 0.5; // capacity per point of temper above 0
const CANNIBAL_DEAD = 0.2;
const CANNIBAL_LIVE = 0.45;
const CANNIBAL_LIVE_HUNGER = 0.12;

function cannibalCapacity(f) {
  if (!f) return 0;
  const learnt = Math.max(0, Math.min(1, f.cannibalismAcceptance || 0));
  const temper = typeof traitValue === "function" ? traitValue(f, "temper") : 0;
  const badSmarty = typeof f.isSmarty === "function" && f.isSmarty();
  const broken = typeof titleOf === "function" && titleOf(f) === "Broken";
  const traumas = Array.isArray(f.traumas) ? f.traumas.length : 0;
  let cap = Math.max(0, temper) * CANNIBAL_TEMPER * 2 + (badSmarty ? 0.4 : 0) + (broken ? 0.2 : 0) + Math.min(0.2, 0.1 * traumas);
  // A good fluffy never would (unless it's been made to accept it)
  if (temper <= 0 && !badSmarty && !broken && !traumas) cap = 0;
  return Math.max(0, Math.min(1, cap + learnt));
}

// scoutForCannibalism: would it, right now? ("dead" or "live")
function willEatOthers(f, kind) {
  const cap = cannibalCapacity(f);
  if (cap <= 0) return false;
  if (kind === "live" && (cap < CANNIBAL_LIVE || f.hunger >= CANNIBAL_LIVE_HUNGER)) return false;
  if (kind === "dead" && cap < CANNIBAL_DEAD) return false;
  return Math.random() < cap;
}
