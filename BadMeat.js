// ---------------------------------------------------------------------------
// Bad meat: the wobbles (from "This Old Mill" / "Rainbow Acres": a mill shut
// down for feeding ground-up fluffies back to its stock).
//
// Every meal of fluffy - the Foal-4-Sketties machine's meatballs, a body, a
// scrap (FoalMachine.onFoalSkettiesEaten, HorseAnatomy.eatCorpse / eatGib) -
// adds to f.badMeat (saved). From BAD_MEAT_SAFE meals on, each one more has
// a BAD_MEAT_CATCH chance of the wobbles (f.wobbles, saved: { at }):
//   - hidden for WOBBLE_HIDDEN game seconds (no sign at all; the vet can't
//     find it either)
//   - then the wobbles show: it walks slower (wobbleSpeed, Horse.updateSpeed),
//     stumbles and falls now and then, can't find the litterbox, says odd
//     things (WOBBLES lines) - the vet and the welfare inspector see it
//   - after WOBBLE_SHOWING more it dies of it. Nothing cures it.
// ---------------------------------------------------------------------------

const BAD_MEAT_SAFE = 5; // meals of fluffy before it can catch it
const BAD_MEAT_CATCH = 0.2; // each meal after that
const WOBBLE_HIDDEN = 2 * 1200; // game seconds (2 game days)
const WOBBLE_SHOWING = 2 * 1200; // ...then this long wobbling before it dies
const WOBBLE_SPEED = 0.55;
const WOBBLE_FALL = 0.04; // a second: a stumble
const badMeatTicker = new Ticker(1);

function _bmNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}

// A meal of fluffy
function noteAteFluffyMeat(f) {
  if (!f || !f.isAlive) return;
  f.badMeat = (f.badMeat || 0) + 1;
  if (f.wobbles || f.badMeat <= BAD_MEAT_SAFE) return;
  if (Math.random() < BAD_MEAT_CATCH) f.wobbles = { at: _bmNow() };
}

function wobblesShowing(f) {
  return !!(f && f.wobbles && _bmNow() - f.wobbles.at >= WOBBLE_HIDDEN);
}

// Horse.updateSpeed
function wobbleSpeed(f) {
  return wobblesShowing(f) ? WOBBLE_SPEED : 1;
}

function updateBadMeat(dt) {
  const step = badMeatTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const now = _bmNow();
  for (const f of fluffies) {
    if (!f.isAlive || !f.wobbles) continue;
    if (now < f.wobbles.at) f.wobbles.at = now; // (the clock went back)
    const t = now - f.wobbles.at;
    if (t < WOBBLE_HIDDEN) continue;
    if (t >= WOBBLE_HIDDEN + WOBBLE_SHOWING) {
      f.anatomy.die(null, "The wobbles (bad meat)");
      if (f.adopted && typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(f)} died of the wobbles - from eating fluffy.`);
      continue;
    }
    if (!f._wobbleSeen) {
      f._wobbleSeen = true;
      if (f.adopted && typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(f)} has started to wobble and stumble...`);
    }
    if (f.isDragging || f.placedOn || f.currentStateKey === "SLEEPING") continue;
    if (Math.random() < WOBBLE_FALL * step) {
      if (f.currentStateKey !== "FLUFFY_KNOCKED_DOWN" && typeof f.initBehavior === "function") f.initBehavior("FLUFFY_KNOCKED_DOWN");
      if (!f.tooYoungToSpeak() && Math.random() < 0.5) f.speak(getDialogue(["WOBBLES", "FALL"], f));
    } else if (!f.tooYoungToSpeak() && Math.random() < 0.01 * step && (!f.speech || !f.speech.text)) f.speak(getDialogue(["WOBBLES", "ODD"], f));
  }
}
registerSystem("badMeat", updateBadMeat, 152);

// Magnifying glass: [text, tone] (only once it shows)
function describeBadMeat(f) {
  if (!wobblesShowing(f)) return null;
  return ["The wobbles: a wasting disease from eating fluffy - nothing cures it", "bad"];
}
