// ---------------------------------------------------------------------------
// Sleep until morning: skip to SLEEP_WAKE_HOUR tomorrow.
//
// The moon button next to the speed buttons (home only, nothing in your
// hand) asks first, then the night goes by as fast as the computer can
// manage: the game really runs (in bigger steps, SLEEP_STEP, and as many
// as fit in SLEEP_BUDGET_MS a frame), so fluffies eat, sleep, grow up,
// give birth, fall out and fall ill as they would. You see the room dim
// and the clock spin; "Wake up" (or Esc) stops it early. The morning
// report comes up at 6 as usual, so you can see what went on.
// Nothing else asks you anything while you sleep (it's a screen that
// holds the normal clock still, Screens.js; this file runs the game on).
// ---------------------------------------------------------------------------

const SLEEP_WAKE_HOUR = 7;
// Game seconds a step. Bigger steps would be quicker, but a fluffy decides
// what to do at most once a step: at 0.25 the test houses had about half
// the fights, illness and deaths of a normal night; at 0.1 (how often
// fluffies in other rooms think anyway) it came out the same.
const SLEEP_STEP = 0.1;
const SLEEP_BUDGET_MS = 100; // real time a frame spent sleeping...
const SLEEP_DRAW_EVERY_MS = 250; // ...and the room's only drawn this often (drawing is slow on some computers)
let _sleepDrawnAt = 0;

// script.js animate: draw this frame? (always, unless asleep)
function sleepWantsDraw() {
  if (!sleepState) return true;
  const now = performance.now();
  if (now - _sleepDrawnAt < SLEEP_DRAW_EVERY_MS) return false;
  _sleepDrawnAt = now;
  return true;
}

let sleepState = null; // { from, until }

function isSleeping() {
  return !!sleepState;
}

// Game seconds until SLEEP_WAKE_HOUR tomorrow (or later today, before then)
function secondsToMorning() {
  const h = typeof gameHour === "function" ? gameHour() : 0;
  let hours = SLEEP_WAKE_HOUR - h;
  if (hours <= 0.05) hours += 24;
  return hours * HOUR_LENGTH;
}

// Why you can't sleep now, or null
function sleepRefusal() {
  if (typeof gameState !== "undefined" && gameState !== "PLAYING") return "not playing";
  if (typeof transitionPhase !== "undefined" && transitionPhase !== "OFF") return "busy";
  if (typeof getSceneConfig === "function" && !getSceneConfig(currentScene).insidePlayerQuarters) return "You can only sleep at home.";
  if (typeof isGlobalDragging !== "undefined" && isGlobalDragging) return "Put down what you're holding first.";
  if (sleepState) return "already";
  return null;
}

// Skip ahead: the same as sleeping, just for a set time, anywhere (the moon
// button offers +1, +6 and +12 hours; away from home only these)
const SKIP_CHOICES = [1, 6, 12]; // game hours

// Why you can't skip ahead now, or null
function skipRefusal() {
  const why = sleepRefusal();
  return why === "You can only sleep at home." ? null : why;
}

function startSkip(hours) {
  if (skipRefusal()) return false;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  sleepState = { from: now, until: now + hours * HOUR_LENGTH, skip: hours };
  if (typeof setGameSpeed === "function") setGameSpeed(1);
  return true;
}

function _skipButtons() {
  return SKIP_CHOICES.map((h) => ({ label: `+${h} hour${h === 1 ? "" : "s"}`, kind: "ok", run: () => startSkip(h) }));
}

function askSleep() {
  const why = sleepRefusal();
  if (why === "You can only sleep at home." && !skipRefusal()) {
    // Away from home: you can still skip ahead
    openChoice({
      title: "Skip ahead?",
      lines: ["Time runs on, fast: they eat, sleep, grow and squabble as usual. (You can only sleep until morning at home.)"],
      buttons: [..._skipButtons(), { label: "Cancel", cancel: true, run: () => {} }],
    });
    return true;
  }
  if (why) {
    if (why.length > 12 && typeof addUIMessage === "function") addUIMessage(why);
    return false;
  }
  const secs = secondsToMorning();
  const hrs = Math.round(secs / HOUR_LENGTH);
  const day = typeof getDayNumber === "function" ? getDayNumber() + (typeof gameHour === "function" && gameHour() >= SLEEP_WAKE_HOUR ? 1 : 0) : "";
  openChoice({
    title: "Sleep until morning?",
    lines: [
      `Skip to ${SLEEP_WAKE_HOUR} AM on Day ${day} (${hrs} hour${hrs === 1 ? "" : "s"}).`,
      "Everything carries on while you sleep: they eat, sleep, grow, have foals and squabble. The morning report tells you what happened.",
      "Or just skip ahead a few hours.",
    ],
    buttons: [
      { label: "Sleep", kind: "ok", run: () => startSleep() },
      ..._skipButtons(),
      { label: "Not yet", cancel: true, run: () => {} },
    ],
  });
  return true;
}

function startSleep() {
  if (sleepRefusal()) return false;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  sleepState = { from: now, until: now + secondsToMorning() };
  if (typeof setGameSpeed === "function") setGameSpeed(1);
  return true;
}

function wakeUp(early = false) {
  if (!sleepState) return false;
  const skipped = sleepState.skip;
  sleepState = null;
  if (typeof addUIMessage === "function") addUIMessage(early ? (skipped ? "You stopped skipping ahead." : "You got up early.") : skipped ? `${skipped} hour${skipped === 1 ? "" : "s"} later...` : "Good morning!");
  return true;
}

// script.js animate(), every frame: run the night on
function runSleep(budgetMs = SLEEP_BUDGET_MS) {
  if (!sleepState) return false;
  if (typeof gameState !== "undefined" && gameState !== "PLAYING") return false;
  const deadline = performance.now() + budgetMs;
  while (timePlayed < sleepState.until - 1e-6 && performance.now() < deadline) {
    updateSimulation(Math.min(SLEEP_STEP, sleepState.until - timePlayed));
    if (!sleepState) return true; // (woken by something)
  }
  if (timePlayed >= sleepState.until - 1e-6) wakeUp(false);
  return true;
}

// Sleep the whole night in one go (tests)
function sleepThroughNight() {
  if (!startSleep()) return false;
  while (sleepState) runSleep(1e9);
  return true;
}

// ---- The button (top bar, after the speed buttons, GameSpeed.js) ----

function drawSleepButton(b) {
  if (typeof drawGlassButton !== "function") return;
  drawGlassButton(b.x, b.y, b.w, b.h, "☾", { fontSize: 17, borderRadius: 8, normalFill: sleepState ? "rgba(120, 140, 255, 0.5)" : "rgba(0, 0, 0, 0.1)" });
  if (isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h) && !sleepState) {
    ctx.save();
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "black";
    ctx.fillStyle = "white";
    ctx.strokeText("Sleep / skip ahead", b.x + b.w / 2, b.y + b.h + 30);
    ctx.fillText("Sleep / skip ahead", b.x + b.w / 2, b.y + b.h + 30);
    ctx.restore();
  }
}

// ---- While you sleep ----

function sleepLayout() {
  const w = 360;
  const h = 150;
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  return { x, y, w, h, wake: { x: x + w / 2 - 70, y: y + h - 48, w: 140, h: 34 } };
}

function drawSleep(c) {
  if (!sleepState) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const L = sleepLayout();
  c.save();
  c.fillStyle = "rgba(10, 14, 40, 0.55)";
  c.fillRect(0, 0, width, height);
  fillRoundRect(c, L.x, L.y, L.w, L.h, 16, "rgba(20, 24, 52, 0.92)");
  c.strokeStyle = "rgba(170, 180, 255, 0.7)";
  c.lineWidth = 2;
  c.stroke();
  c.textAlign = "center";
  c.fillStyle = "#cfd6ff";
  c.font = "bold 22px Arial";
  c.fillText(sleepState.skip ? "\u23e9  Skipping ahead..." : "☾  Zzz...", L.x + L.w / 2, L.y + 36);
  c.font = "15px Arial";
  c.fillStyle = "white";
  c.fillText(typeof describeWorldTime === "function" ? describeWorldTime() : "", L.x + L.w / 2, L.y + 62);
  const p = Math.max(0, Math.min(1, (timePlayed - sleepState.from) / Math.max(1, sleepState.until - sleepState.from)));
  fillRoundRect(c, L.x + 30, L.y + 76, L.w - 60, 8, 4, "rgba(255,255,255,0.15)");
  fillRoundRect(c, L.x + 30, L.y + 76, (L.w - 60) * p, 8, 4, "#9fb0ff");
  c.restore();
  drawGlassButton(L.wake.x, L.wake.y, L.wake.w, L.wake.h, sleepState.skip ? "Stop" : "Wake up", { fontSize: 15, borderRadius: 9 });
}

function handleSleepClick() {
  if (!sleepState) return false;
  const b = sleepLayout().wake;
  if (isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h)) wakeUp(true);
  return true;
}

registerScreen({
  name: "sleep",
  layer: 35,
  isOpen: () => isSleeping(),
  close: () => wakeUp(true),
  draw: (c) => drawSleep(c),
  click: () => handleSleepClick(),
  reset: () => {
    sleepState = null;
  },
});
