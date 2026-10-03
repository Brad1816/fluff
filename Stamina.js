// ---------------------------------------------------------------------------
// Out of breath (lore): fluffies aren't built for running. A fluffy running
// flat out uses up its breath (f._breath, 1 = fresh; not saved) in about
// RUN_BREATH_TIME seconds - sooner if it's old or chubby - and is then
// winded for WINDED_TIME seconds: it can only plod along at a walk
// (runWindedSpeed, Horse.updateSpeed), huffing and puffing. Breath comes
// back in about BREATH_RECOVER_TIME seconds of not running (or plodding). Running also
// makes it sleepy a little faster (RUN_SLEEPY).
// ---------------------------------------------------------------------------

const RUN_BREATH_TIME = 7; // seconds of running, fresh to empty
const BREATH_RECOVER_TIME = 10; // seconds of not running, empty to fresh
const WINDED_TIME = 5; // seconds it can only walk
const WINDED_SPEED = 90; // (a walk is 100, a run 175)
const RUN_SLEEPY = 1 / 300; // sleepiness per second of running, on top
const STAMINA_EVERY = 0.25;
const staminaTicker = new Ticker(STAMINA_EVERY);

function isWinded(f) {
  return !!f && f._windedUntil !== undefined && typeof timePlayed === "number" && f._windedUntil > timePlayed;
}

// Horse.updateSpeed: the running speed it can manage right now
function runWindedSpeed(f) {
  return isWinded(f) ? WINDED_SPEED : null;
}

// How fast it runs out of breath, x
function breathDrainRate(f) {
  let r = 1;
  if (typeof isElderly === "function" && isElderly(f)) r *= 1.4;
  else if (typeof lifeStage === "function" && lifeStage(f) === "senior") r *= 1.15;
  if (typeof weightSpeedMultiplier === "function") r /= Math.max(0.4, weightSpeedMultiplier(f));
  if (f.isPregnant) r *= 1.3;
  return r;
}

function updateStamina(dt) {
  const step = staminaTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    if (f._breath === undefined) f._breath = 1;
    const running = f.currentStateKey === "RUNNING" && !f.isDragging && !f.placedOn && !f.isCrawling;
    if (running && !isWinded(f)) {
      f._breath -= (step / RUN_BREATH_TIME) * breathDrainRate(f);
      f.sleepDeprivation = Math.min(1, (f.sleepDeprivation || 0) + step * RUN_SLEEPY);
      if (f._breath <= 0) {
        f._breath = 0;
        f._windedUntil = now + WINDED_TIME;
        if (f.currentStateKey !== "SLEEPING" && (!f.speech || !f.speech.text) && typeof getDialogue === "function")
          f.speak(getDialogue(["RUN_TIRED", f.tooYoungToSpeak() ? "CHIRPY" : "DEFAULT"], f));
      }
    } else {
      // (catching its breath: winded, or not running)
      f._breath = Math.min(1, f._breath + step / BREATH_RECOVER_TIME);
    }
  }
}
registerSystem("stamina", updateStamina, 52);
