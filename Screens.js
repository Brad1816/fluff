// ---------------------------------------------------------------------------
// Pop-up screens: one list, so a new screen is one registerScreen() call.
//
// Each screen (goals, help, records, the vet, the family tree...) registers
// itself at the end of its own file:
//
//   registerScreen({
//     name: "goals",
//     layer: 20,                 // higher = drawn on top, and clicked first
//     isOpen: () => goalsOpen,
//     close: () => closeGoals(),
//     draw: (c) => drawGoals(c), // screen pass (UI.js drawUI)
//     click: () => handleGoalsClick(), // mouse down, screen positions;
//                                      // return true if it used the click
//     escape: true,              // Esc closes it (default true)
//     reset: () => ...,          // on new game / load (default: close)
//     pauses: false,             // the game keeps running while it's open
//                                // (default: it pauses - menus stop time)
//   });
//
// and the game uses the list for:
//   drawScreens(c)       UI.js drawUI: every screen, bottom layer first
//   anyScreenOpen()      UI.js isAnyScreenOpen (stops clicks on the world,
//                        fluffies coming to your hand...)
//   clickScreens()       UI.js mousedown: top screen first
//   escapeScreens()      script.js Escape: closes the top open screen
//   resetScreens()       Persistence.js resetTemporaryGameState
//
// Layers so far: 5 magnifying glass, 6 trick menu, 10 family tree, 11 Gene Lab,
// 12 orders screen, 13 shelter boarding, 14 shelter plaque, 20 goals, 21 help, 22 breeding records,
// 23 vet, 24 surgery, 29 show results, 30 morning report, 31 naming pop-up.
// ---------------------------------------------------------------------------

const SCREENS = [];

function registerScreen(screen) {
  if (!screen || !screen.name) throw new Error("registerScreen needs a name");
  if (SCREENS.some((s) => s.name === screen.name)) throw new Error(`Screen "${screen.name}" registered twice`);
  SCREENS.push({ layer: 0, escape: true, ...screen });
  SCREENS.sort((a, b) => a.layer - b.layer);
}

function _screenOpen(s) {
  try {
    return !!s.isOpen();
  } catch (e) {
    return false;
  }
}

function drawScreens(c) {
  for (const s of SCREENS) if (s.draw) s.draw(c);
}

function anyScreenOpen() {
  return SCREENS.some(_screenOpen);
}

// Is an open menu holding time still? (script.js animate, GameSpeed.js)
function screenPausesGame() {
  return SCREENS.some((s) => s.pauses !== false && _screenOpen(s));
}

// Top screen first; true if one used the click
function clickScreens() {
  for (let i = SCREENS.length - 1; i >= 0; i--) {
    const s = SCREENS[i];
    if (s.click && s.click()) return true;
  }
  return false;
}

// Close the top open screen that Esc closes; true if one did
function escapeScreens() {
  for (let i = SCREENS.length - 1; i >= 0; i--) {
    const s = SCREENS[i];
    if (s.escape && _screenOpen(s)) {
      s.close();
      return true;
    }
  }
  return false;
}

function resetScreens() {
  for (const s of SCREENS) {
    if (s.reset) s.reset();
    else if (_screenOpen(s)) s.close();
  }
}
