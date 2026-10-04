// ---------------------------------------------------------------------------
// The city's street cleaning: a weekly reset for the alley (from "Keep our
// streets tidy").
//
// Every SWEEP_EVERY_DAYS days, at SWEEP_HOUR in the morning, a city crew
// clears the alley (the alley and the road beside it - not the day care):
//   - every stray there, alive or dead, is taken away (off screen)
//   - the mess goes: puddles, food on the ground, rubbish
// Fluffies of yours there are left alone (they're somebody's - but they're
// shaken by it). The day before, you're told it's coming (SWEEP_WARN_HOUR),
// so you can take in any strays you want first. The morning report lists
// what was taken (DayReport news).
// Saved (Persistence.js): citySweep { warned, swept } - the days it last did each.
// ---------------------------------------------------------------------------

const SWEEP_EVERY_DAYS = 7;
const SWEEP_HOUR = 5; // before the morning report
const SWEEP_WARN_HOUR = 9; // the day before
const SWEEP_SCENES = ["ALLEY", "ALLEY_ROAD"];

function freshCitySweep() {
  return { warned: null, swept: null };
}
let citySweep = freshCitySweep();
const citySweepTicker = new Ticker(5);

function _sweepDay(day) {
  return day > 0 && day % SWEEP_EVERY_DAYS === 0;
}

// Days until the next sweep (0 = today, before it's happened)
function daysToSweep() {
  const day = typeof getDayNumber === "function" ? getDayNumber() : 1;
  const h = typeof gameHour === "function" ? gameHour() : 12;
  let d = day;
  if (_sweepDay(d) && h >= SWEEP_HOUR) d++;
  while (!_sweepDay(d)) d++;
  return d - day;
}

function runCitySweep() {
  const taken = [];
  for (let i = fluffies.length - 1; i >= 0; i--) {
    const f = fluffies[i];
    if (!SWEEP_SCENES.includes(f.scene) || f.adopted || f.isDragging) continue;
    taken.push(f);
    if (typeof noteFluffyLeft === "function") noteFluffyLeft(f, "taken");
    fluffies.splice(i, 1);
  }
  // Yours that were there: left, but frightened
  for (const f of fluffies) {
    if (!f.isAlive || !SWEEP_SCENES.includes(f.scene) || !f.adopted) continue;
    f.changeHappiness(-0.05, "The street cleaners came");
  }
  // The mess
  if (typeof puddles !== "undefined") {
    for (let i = puddles.length - 1; i >= 0; i--) if (SWEEP_SCENES.includes(puddles[i].scene)) puddles.splice(i, 1);
  }
  if (typeof objects !== "undefined") {
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (!SWEEP_SCENES.includes(o.scene) || o.isDragging) continue;
      const mess = (typeof FoodSpill !== "undefined" && o instanceof FoodSpill) || (typeof Gib !== "undefined" && o instanceof Gib);
      if (mess) objects.splice(i, 1);
    }
  }
  const alive = taken.filter((f) => f.isAlive).length;
  const dead = taken.length - alive;
  let text = "The city's street cleaners came through the alley";
  if (taken.length) text += ` and took ${alive ? `${alive} stray${alive === 1 ? "" : "s"}` : ""}${alive && dead ? " and " : ""}${dead ? `${dead} bod${dead === 1 ? "y" : "ies"}` : ""} away.`;
  else text += ". There was nothing to take.";
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text });
  return taken.length;
}

function updateCitySweep(dt) {
  if (!citySweepTicker.step(dt) || typeof getDayNumber !== "function") return;
  if (!citySweep || typeof citySweep !== "object") citySweep = freshCitySweep();
  const day = getDayNumber();
  const h = gameHour();
  if (_sweepDay(day + 1) && h >= SWEEP_WARN_HOUR && citySweep.warned !== day) {
    citySweep.warned = day;
    const strays = fluffies.filter((f) => SWEEP_SCENES.includes(f.scene) && !f.adopted && f.isAlive).length;
    if (typeof addUIMessage === "function")
      addUIMessage(`City notice: street cleaning in the alley tomorrow morning. Strays left there will be taken away${strays ? ` (${strays} there now)` : ""}.`);
  }
  if (_sweepDay(day) && h >= SWEEP_HOUR && citySweep.swept !== day) {
    citySweep.swept = day;
    runCitySweep();
  }
}
registerSystem("citySweep", updateCitySweep, 140);
