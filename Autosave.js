// ---------------------------------------------------------------------------
// Autosave, and Continue on the title screen.
//
// The game saves by itself (to the "Autosave" slot):
//   - every morning (a new game day)
//   - whenever you switch away from it (another app, another tab, the
//     phone locking) - so a phone closing the game in the background
//     doesn't lose your fluffies
//   - every AUTOSAVE_EVERY real minutes while you play
// Each morning's save first moves the last one to "Autosave (earlier)", so
// there's always one to go back to. Never more often than AUTOSAVE_GAP
// real seconds, and never mid-transition or on the title screen.
// The last save made (yours or the autosave: Persistence.js saveGame) is
// remembered on this device (localStorage), and the title screen offers
// "Continue (day N)" to pick up from it (menu.js).
// ---------------------------------------------------------------------------

const AUTOSAVE_SLOT = "Autosave";
const AUTOSAVE_BACKUP = "Autosave (earlier)";
const AUTOSAVE_EVERY = 5; // real minutes
const AUTOSAVE_GAP = 20; // real seconds between autosaves at most
let autosaveEnabled = !(typeof navigator !== "undefined" && navigator.webdriver); // (off under test automation; a test can switch it on)
let _autosaveLast = 0;
let _autosaveDay = null;
let _autosaveBusy = false;
const autosaveTicker = new Ticker(5);

function _asCanSave() {
  return (
    autosaveEnabled &&
    !_autosaveBusy &&
    typeof gameState !== "undefined" &&
    (gameState === "PLAYING" || gameState === "PAUSED") &&
    (typeof transitionPhase === "undefined" || transitionPhase === "OFF") &&
    typeof saveGame === "function"
  );
}

// Save now (rotate: keep the last one as the earlier backup first)
async function autosaveNow(why = "", rotate = false) {
  if (!_asCanSave()) return false;
  const now = Date.now();
  if (now - _autosaveLast < AUTOSAVE_GAP * 1000) return false;
  _autosaveLast = now;
  _autosaveBusy = true;
  try {
    if (rotate) {
      const prev = await saveManager.load(AUTOSAVE_SLOT).catch(() => null);
      if (prev) await saveManager.save(AUTOSAVE_BACKUP, prev);
    }
    await saveGame(AUTOSAVE_SLOT);
    return true;
  } catch (e) {
    console.error("Autosave failed:", e);
    return false;
  } finally {
    _autosaveBusy = false;
  }
}

// Persistence.js saveGame: remember the last save on this device
function noteLastSave(slot) {
  try {
    const day = typeof getDayNumber === "function" ? getDayNumber() : null;
    localStorage.setItem("fluffyLastSave", JSON.stringify({ slot, day, at: Date.now() }));
  } catch (e) {}
}

// The title screen's Continue: { slot, day } or null
function lastSaveInfo() {
  try {
    const v = JSON.parse(localStorage.getItem("fluffyLastSave") || "null");
    return v && v.slot ? v : null;
  } catch (e) {
    return null;
  }
}

function continueLastGame() {
  const info = lastSaveInfo();
  if (!info || transitionPhase !== "OFF") return false;
  pendingSaveToLoad = info.slot;
  preTransitionState = "TITLE_LOADING";
  transitionPhase = "IN";
  transitionTimer = 0;
  return true;
}

// Every few seconds: a new morning, or time for a regular save
function updateAutosave(dt) {
  if (!autosaveTicker.step(dt)) return;
  const day = typeof getDayNumber === "function" ? getDayNumber() : null;
  if (_autosaveDay === null) {
    _autosaveDay = day;
    return;
  }
  if (day !== _autosaveDay) {
    _autosaveDay = day;
    autosaveNow("morning", true);
    return;
  }
  if (Date.now() - _autosaveLast > AUTOSAVE_EVERY * 60 * 1000 && _autosaveLast > 0) autosaveNow("regular");
  if (_autosaveLast === 0) _autosaveLast = Date.now(); // (the first regular one comes AUTOSAVE_EVERY after starting)
}
registerSystem("autosave", updateAutosave, 990);

// A new game or a loaded one: start counting days from here (Persistence.js)
function resetAutosaveClock() {
  _autosaveDay = null;
  _autosaveLast = Date.now();
}

// Switching away: save now (phones close games in the background)
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      _autosaveLast = 0; // (don't hold this one back)
      autosaveNow("hidden");
    }
  });
  window.addEventListener("pagehide", () => {
    _autosaveLast = 0;
    autosaveNow("pagehide");
  });
}
