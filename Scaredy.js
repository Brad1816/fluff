// ---------------------------------------------------------------------------
// Scaredy poopies: a bad fright and a fluffy wets itself (or worse) where it
// stands.
//
// scaredyMess(f, strength) - strength 0..1, how bad the fright was - is
// called by:
//   - a fright (Fears.js startFright: thunder, the dark, the Fluff-Bot...)
//   - you hurting it (Memory.notePlayerViolence: the stick, the knife...)
//   - a shock (Horse.setShock of 1.5 s or more: seeing a beating, a corpse,
//     being attacked, an alicorn coming at it...)
// The chance grows with the fright and how timid it is (traitValue bravery),
// and how full it is; at most once every SCAREDY_REST. Mostly pee; a big
// fright with a full belly, poop. It's mess (a puddle, a little dirt on it),
// not a misdeed: it isn't scolded for it, and it doesn't undo litter training.
// ---------------------------------------------------------------------------

const SCAREDY_BASE = 0.35; // chance at strength 1, an average fluffy, full bladder
const SCAREDY_REST = 90; // game seconds between accidents
const SCAREDY_POOP_AT = 0.7; // strength for a poop (with some in it)

function scaredyMess(f, strength = 0.5) {
  if (!f || !f.isAlive || f.isDragging || f.placedOn instanceof LitterpalBox) return false;
  if (typeof worldSettings !== "undefined" && worldSettings.scaredyPoopies === false) return false;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  if (f._scaredyAt !== undefined && now - f._scaredyAt < SCAREDY_REST) return false;
  const timid = typeof traitValue === "function" ? -traitValue(f, "bravery") : 0; // -1..1
  const full = Math.max(f.peeStorage || 0, f.poopStorage || 0);
  const chance = SCAREDY_BASE * Math.max(0, Math.min(1, strength)) * (1 + 0.6 * timid) * (0.4 + full);
  if (Math.random() >= chance) return false;
  f._scaredyAt = now;
  const poop = strength >= SCAREDY_POOP_AT && (f.poopStorage || 0) > 0.3 && Math.random() < 0.5;
  const amount = Math.max(0.25, poop ? f.poopStorage : f.peeStorage);
  if (poop) f.poopStorage = 0;
  else f.peeStorage = 0;
  // The puddle, under it (as HorseToilet.excrete, without the scolding)
  const torsoWidth = f.layout ? f.layout.torso.w : 100;
  const offsetX = (torsoWidth / 2) * (f.facingRight ? -1 : 1) * f.scale * (poop ? 1 : 0.5);
  const size = ((60 * amount) / 200) * Math.max(CHIRPY_THRESHOLD, f.growth);
  if (typeof addPointToPuddle === "function") addPointToPuddle(f.scene, f.x + offsetX, f.getBottomY() - 8, poop ? "#5c4033" : "#f1c40f", 5 / 200, size, 0.02);
  if (typeof addDirt === "function") addDirt(f, DIRT_FROM_ACCIDENT * (poop ? 0.8 : 0.3));
  if (poop && typeof fluffySound === "function") fluffySound(f, "shitting");
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function" && Math.random() < 0.6) f.speak(getDialogue(["SCAREDY", poop ? "POOP" : "PEE"], f), true);
  return true;
}
