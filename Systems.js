// ---------------------------------------------------------------------------
// Game systems: things that update every simulation step (herds, weather,
// flu, ageing...). Each registers itself at the end of its own file:
//
//   registerSystem("illness", updateIllness, 150);
//
// and script.js updateSimulation calls updateSystems(dt), which runs them
// in order (lowest first). The order numbers so far:
//   10 family records, 20 bonds, 30 herds, 40 territory, 50 world time,
//   60 separation, 70 naming pop-ups, 80 settling in, 90 goals,
//   100 morning report, 110 night events, 120 alicorn acceptance,
//   125 pregnancy care, 130 ageing, 135 affection, 136 tricks, 137 diet,
//   138 play, 140 abandoned pets, 141 fears, 142 population, 143 room
//   climate, 144 sleeping piles, 145 warmth, 150 flu, 160 corpses,
//   170 orders, 180 breeders' market, 190 shows
//
// Ticker: "do this every N seconds" without hand-written timers.
//
//   const illnessTicker = new Ticker(5);
//   function updateIllness(dt) {
//     const step = illnessTicker.step(dt); // 0, or seconds since last time
//     if (!step) return;
//     ...
//   }
//
// The first call is due straight away. ticker.fireNext() makes the next
// call due (tests use it to run a system right now).
// ---------------------------------------------------------------------------

class Ticker {
  constructor(every) {
    this.every = every;
    this.left = 0;
  }

  // Seconds since it last fired (at least `every`) when it's due, else 0
  step(dt) {
    this.left -= dt;
    if (this.left > 0) return 0;
    const step = this.every - this.left;
    this.left = this.every;
    return step;
  }

  fireNext() {
    this.left = 0;
  }
}

const SYSTEMS = [];

function registerSystem(name, update, order = 500) {
  if (SYSTEMS.some((s) => s.name === name)) throw new Error(`System "${name}" registered twice`);
  SYSTEMS.push({ name, update, order });
  SYSTEMS.sort((a, b) => a.order - b.order);
}

function updateSystems(dt) {
  for (const s of SYSTEMS) s.update(dt);
}
