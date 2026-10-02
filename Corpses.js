// ---------------------------------------------------------------------------
// Corpses rot and eventually disappear, so the screen doesn't fill up.
//
// Uses the fluffy's deathTimer (game seconds since it died; saved), so it
// follows the game clock and fast forward.
//   0 .. ROT_START          looks as it did
//   ROT_START .. ROT_FULL   slowly darkens and goes brown/green; flies arrive
//   ROT_FULL .. ROT_GONE    fades away
//   ROT_GONE                removed (with a little puff)
// A corpse you're holding, or one on a table/board (placedOn), doesn't go
// until you put it down. Corpses in the other areas were already cleared
// away by the dog clean-up (script.js updateFerals); this also covers the
// area you're in and your own rooms.
// ---------------------------------------------------------------------------

const ROT_START = 240; // 4 game minutes
const ROT_FULL = 600; // 10
const ROT_GONE = 780; // 13

const corpsesTicker = new Ticker(1);

// 0 = fresh, 1 = fully rotten
function corpseRot(f) {
  if (!f || f.isAlive) return 0;
  return Math.max(0, Math.min(1, ((f.deathTimer || 0) - ROT_START) / (ROT_FULL - ROT_START)));
}

// 1 = solid, 0 = gone
function corpseFade(f) {
  if (!f || f.isAlive) return 1;
  return Math.max(0, Math.min(1, 1 - ((f.deathTimer || 0) - ROT_FULL) / (ROT_GONE - ROT_FULL)));
}

function corpseKeptForNow(f) {
  return f.isDragging || !!f.placedOn;
}

// script.js updateSimulation; checks once a second
function updateCorpses(dt) {
  if (!corpsesTicker.step(dt)) return; // every 1s (Systems.js)
  for (let i = fluffies.length - 1; i >= 0; i--) {
    const f = fluffies[i];
    if (f.isAlive || (f.deathTimer || 0) < ROT_GONE || corpseKeptForNow(f)) continue;
    fluffies.splice(i, 1);
    if (typeof inspectedFluffy !== "undefined" && inspectedFluffy === f) inspectedFluffy = null;
    if (typeof poofs !== "undefined" && typeof Poof !== "undefined")
      poofs.push(new Poof(f.x, f.y - 20, f.scene, "#6b5b3e"));
  }
}

// The same, drawn cheaply (Bath.js drawFluffyTinted): { tints, alpha } or null
function corpseTint(f) {
  const rot = corpseRot(f);
  if (rot <= 0) return null;
  const fade = corpseKeptForNow(f) ? Math.max(0.35, corpseFade(f)) : corpseFade(f);
  return { tints: [["rgb(96, 100, 52)", 0.55 * rot], ["rgb(0, 0, 0)", 0.35 * rot]], alpha: fade };
}

// Flies buzzing over a rotting corpse (drawn after it)
function drawCorpseFlies(c, f) {
  const rot = corpseRot(f);
  if (rot <= 0.15 || corpseFade(f) < 0.3) return;
  const n = Math.round(2 + rot * 4);
  const t = typeof timePlayed === "number" ? timePlayed : 0;
  c.save();
  c.fillStyle = "rgba(20, 20, 20, 0.85)";
  for (let i = 0; i < n; i++) {
    const a = t * (2.5 + i * 0.7) + i * 1.9 + f.id;
    const x = f.x + Math.cos(a) * (18 + (i % 3) * 9);
    const y = f.y - 35 + Math.sin(a * 1.3) * 10 - (i % 2) * 12;
    c.beginPath();
    c.arc(x, y, 1.8, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// Runs every simulation step (Systems.js)
registerSystem("corpses", updateCorpses, 160);
