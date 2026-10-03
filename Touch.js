// ---------------------------------------------------------------------------
// Playing with a finger (phones and tablets).
//
// The game only understands the mouse, so a finger is turned into mouse
// events on the canvas (the rest of the game doesn't know the difference):
//   - tap: a click where you tapped (and the "mouse" stays there, so a tap
//     also shows what hovering would: tooltips, highlights)
//   - press and drag: the mouse button held down while it moves - picking
//     up fluffies and things, the throw tool, panning the park
//   - long press (TOUCH_LONG_PRESS, without moving): a right-click - the
//     menus on fluffies, cages, feeders... A ring grows under your finger
//     to show it's coming.
//   - a swipe over something that scrolls (the chat log, the save list, the
//     help pages): the mouse wheel
//   - two fingers on the relationship map: zoom in and out
// The page itself never scrolls or zooms (touch-action: none).
//
// On a phone (touchMode, globals.js) there's also:
//   - a row of buttons for what only had a key (TouchBar below): Menu
//     (Esc), Sell (Shift), Rotate (R, holding a fence), and More (the map,
//     accounts, names, herds, bed names, full screen)
//   - "Turn your phone sideways" while it's held upright
//   - full screen on the first tap where the phone allows it (Android);
//     on an iPhone, Add to Home Screen does it (manifest.json)
// Naming a fluffy on a phone asks with the phone's keyboard (Names.js).
// ---------------------------------------------------------------------------

const TOUCH_TAP_MOVE = 10; // css px a finger can wobble and still tap
const TOUCH_LONG_PRESS = 500; // ms
const TOUCH_SCROLL_STEP = 28; // css px of swipe per wheel notch
const TOUCH_HELP_STEP = 90; // (the help pages turn a whole page a notch)
const TOUCH_PINCH_STEP = 1.15; // fingers this much further apart: one zoom notch

let _touch = null; // the finger being followed
let _pinch = null; // two fingers on the map
let _touchUsed = false; // a finger has touched the game (fullscreen, hints)

function _touchMouse(type, x, y, button = 0, target = null) {
  const e = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    button,
    buttons: type === "mouseup" ? 0 : button === 2 ? 2 : 1,
    bubbles: true,
    cancelable: true,
    view: window,
  });
  (target || canvas).dispatchEvent(e);
}

function _touchWheel(x, y, deltaY) {
  const e = new WheelEvent("wheel", { clientX: x, clientY: y, deltaY, deltaMode: 0, bubbles: true, cancelable: true, view: window });
  canvas.dispatchEvent(e);
}

// Game position of a screen point
function _touchToGame(x, y) {
  return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
}

// Would a swipe starting here scroll something? (the wheel's jobs)
function touchScrollsAt(x, y) {
  if (touchZoomedScreen()) return "zoom";
  if (typeof helpOpen !== "undefined" && helpOpen) return "help";
  if (typeof showSaveList !== "undefined" && showSaveList) return "list";
  if (typeof showChatLog !== "undefined" && showChatLog) {
    const g = _touchToGame(x, y);
    if (g.x >= 10 && g.x <= 330 && g.y >= 85 && g.y <= 275) return "list"; // (UIChatLog.js panel)
  }
  return null;
}

// ---- The long-press ring ----
let _touchRing = null;
function _ringShow(x, y) {
  if (typeof document === "undefined") return;
  if (!_touchRing) {
    _touchRing = document.createElement("div");
    _touchRing.id = "touch-ring";
    document.body.appendChild(_touchRing);
  }
  const r = _touchRing;
  r.style.transition = "none";
  r.style.left = `${x}px`;
  r.style.top = `${y}px`;
  r.style.opacity = "0";
  r.style.transform = "translate(-50%, -50%) scale(0.3)";
  void r.offsetWidth; // (restart the animation)
  r.style.transition = `transform ${TOUCH_LONG_PRESS - 120}ms linear, opacity 120ms`;
  r.style.opacity = "1";
  r.style.transform = "translate(-50%, -50%) scale(1)";
}
function _ringHide(flash = false, now = false) {
  if (!_touchRing) return;
  // (a finger lifted: gone at once - a slow page could otherwise show the
  // ring fading after a quick tap)
  _touchRing.style.transition = now ? "none" : "opacity 200ms";
  _touchRing.style.opacity = flash ? "0.0" : "0";
}

// What's being carried (a fluffy or a thing - not a tool in your hand)
function touchHeldThing() {
  const notTool = (o) => !(typeof isToolObject === "function" && isToolObject(o));
  if (typeof fluffies !== "undefined") {
    const f = fluffies.find((x) => x.isDragging && !x.heldWithThrowTool);
    if (f) return f;
  }
  if (typeof objects !== "undefined") {
    const o = objects.find((x) => x.isDragging && notTool(x));
    if (o) return o;
  }
  if (typeof gibs !== "undefined") {
    const g = gibs.find((x) => x.isDragging);
    if (g) return g;
  }
  return null;
}

function _touchClearTimers(t) {
  if (t && t.timer) clearTimeout(t.timer);
  if (t && t.ringTimer) clearTimeout(t.ringTimer);
  if (t) t.timer = t.ringTimer = null;
}

// ---- The finger ----

function _onTouchStart(e) {
  if (e.cancelable) e.preventDefault();
  _ringHide();
  _touchUsed = true;
  // A second finger: zooming the relationship map (or ignored)
  if (e.touches.length >= 2) {
    if (_touch) {
      _touchClearTimers(_touch);
      _ringHide();
      if (_touch.mode === "drag") _touchMouse("mouseup", _touch.x, _touch.y, 0, window);
      if (_touch.mode === "long") _touchMouse("mouseup", _touch.x, _touch.y, 2, window);
      _touch.mode = "done";
    }
    if (typeof relMapOpen !== "undefined" && relMapOpen) {
      const [a, b] = [e.touches[0], e.touches[1]];
      _pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1 };
    }
    return;
  }
  const p = e.changedTouches[0];
  const t = { id: p.identifier, x0: p.clientX, y0: p.clientY, x: p.clientX, y: p.clientY, mode: "wait", scroll: touchScrollsAt(p.clientX, p.clientY), acc: 0 };
  _touch = t;
  // The "mouse" goes where the finger is (a held tool follows it; hover shows)
  _touchMouse("mousemove", t.x, t.y, 0, window);
  // Held still: a right-click
  t.ringTimer = setTimeout(() => {
    if (_touch === t && t.mode === "wait" && !touchHeldThing()) _ringShow(t.x, t.y);
  }, 150);
  t.timer = setTimeout(() => {
    if (_touch !== t || t.mode !== "wait") return _ringHide();
    if (touchHeldThing()) return _ringHide(); // (carrying something: a long press is just a press)
    t.mode = "long";
    _ringHide(true);
    if (navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch (err) {}
    }
    _touchMouse("mousedown", t.x, t.y, 2);
  }, TOUCH_LONG_PRESS);
}

function _onTouchMove(e) {
  if (e.cancelable) e.preventDefault();
  // Two fingers on the map: zoom
  if (_pinch && e.touches.length >= 2) {
    const [a, b] = [e.touches[0], e.touches[1]];
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
    const mx = (a.clientX + b.clientX) / 2;
    const my = (a.clientY + b.clientY) / 2;
    _touchMouse("mousemove", mx, my, 0, window);
    while (d / _pinch.d > TOUCH_PINCH_STEP) {
      _touchWheel(mx, my, -100);
      _pinch.d *= TOUCH_PINCH_STEP;
    }
    while (_pinch.d / d > TOUCH_PINCH_STEP) {
      _touchWheel(mx, my, 100);
      _pinch.d /= TOUCH_PINCH_STEP;
    }
    return;
  }
  const t = _touch;
  if (!t || t.mode === "done") return;
  const p = [...e.changedTouches].find((c) => c.identifier === t.id);
  if (!p) return;
  const dy = p.clientY - t.y;
  t.px = t.x;
  t.x = p.clientX;
  t.y = p.clientY;
  if (t.mode === "wait" && Math.hypot(t.x - t.x0, t.y - t.y0) > TOUCH_TAP_MOVE) {
    _touchClearTimers(t);
    _ringHide();
    if (t.scroll) {
      t.mode = "scroll";
    } else if (touchHeldThing()) {
      // Already carrying something (picked up with a tap): it follows the
      // finger, and is put down where it lets go
      t.mode = "carry";
      t.carrying = touchHeldThing();
    } else {
      // A drag: press where the finger came down, then follow it
      t.mode = "drag";
      _touchMouse("mousemove", t.x0, t.y0, 0, window);
      _touchMouse("mousedown", t.x0, t.y0, 0);
      t.carrying = touchHeldThing(); // (picked up just now)
    }
  }
  if (t.mode === "drag" || t.mode === "long" || t.mode === "carry") {
    _touchMouse("mousemove", t.x, t.y, t.mode === "long" ? 2 : 0, window);
  } else if (t.mode === "scroll" && t.scroll === "zoom") {
    // A zoomed screen: drag it about
    touchZoomPan(-(p.clientX - (t.px ?? t.x0)) / scale, -dy / scale);
  } else if (t.mode === "scroll") {
    // Content follows the finger: finger up = scroll down
    const step = t.scroll === "help" ? TOUCH_HELP_STEP : TOUCH_SCROLL_STEP;
    t.acc -= dy;
    while (Math.abs(t.acc) >= step) {
      const dir = Math.sign(t.acc);
      _touchWheel(t.x0, t.y0, dir * 100);
      t.acc -= dir * step;
    }
  }
}

function _onTouchEnd(e) {
  if (e.cancelable) e.preventDefault();
  _ringHide(false, true); // (whatever happens next, the ring goes)
  if (_pinch && e.touches.length < 2) _pinch = null;
  const t = _touch;
  if (!t) return;
  const p = [...e.changedTouches].find((c) => c.identifier === t.id);
  if (!p) return;
  _touchClearTimers(t);
  _ringHide(false, true);
  _touch = null;
  const cancelled = e.type === "touchcancel";
  if (t.mode === "drag" || t.mode === "carry") {
    _touchMouse("mousemove", t.x, t.y, 0, window);
    if (t.mode === "drag") _touchMouse("mouseup", t.x, t.y, 0, window);
    // Let go of what the finger was carrying: put it down there (the game
    // picks up with one click and puts down with the next)
    if (!cancelled && t.carrying && touchHeldThing() === t.carrying) {
      _touchMouse("mousedown", t.x, t.y, 0);
      _touchMouse("mouseup", t.x, t.y, 0, window);
    }
  } else if (t.mode === "long") {
    _touchMouse("mouseup", t.x, t.y, 2, window);
  } else if (t.mode === "wait" && !cancelled) {
    // A tap: a click (inside the tap itself, so sound and full screen are allowed)
    _touchMouse("mousedown", t.x0, t.y0, 0);
    _touchMouse("mouseup", t.x0, t.y0, 0, window);
    if (typeof resumeAudioContext === "function") resumeAudioContext();
    touchTryFullscreen();
  }
}

// ---- Full screen (Android; an iPhone needs Add to Home Screen) ----
let _fullscreenAsked = false;
function isStandaloneApp() {
  try {
    return !!((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) || navigator.standalone);
  } catch (e) {
    return false;
  }
}
function touchTryFullscreen(force = false) {
  if (!touchMode || isStandaloneApp() || document.fullscreenElement) return false;
  if (_fullscreenAsked && !force) return false;
  _fullscreenAsked = true;
  const el = document.documentElement;
  if (!el.requestFullscreen) return false;
  try {
    const go = el.requestFullscreen({ navigationUI: "hide" });
    if (go && go.then) {
      go.then(() => {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {});
      }).catch(() => {});
    }
    return true;
  } catch (err) {
    return false;
  }
}

if (typeof canvas !== "undefined" && canvas.addEventListener) {
  canvas.addEventListener("touchstart", _onTouchStart, { passive: false });
  canvas.addEventListener("touchmove", _onTouchMove, { passive: false });
  canvas.addEventListener("touchend", _onTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", _onTouchEnd, { passive: false });
}

// ---------------------------------------------------------------------------
// Bigger screens on a phone: the magnifying glass, Today and Household are
// drawn zoomed in (TOUCH_ZOOM_SCREENS, so their writing is a readable size)
// and dragged about with a finger to see the rest. Taps land where they
// look: the "mouse" is mapped into the zoomed picture while they draw and
// while they're clicked.
// ---------------------------------------------------------------------------
const TOUCH_ZOOM_SCREENS = ["inspection", "today", "household"];
const TOUCH_ZOOM_MAX = 1.5;
const touchZoomView = { x: 0, y: 0 };

// How much to zoom: enough that its writing is about as big as on a computer
function touchZoomFactor() {
  if (!touchMode) return 1;
  return Math.max(1, Math.min(TOUCH_ZOOM_MAX, 0.95 / (scale || 1)));
}

// The zoomed screen on top (not one under another screen: a drag on that is its own)
function touchZoomedScreen() {
  if (!touchMode || touchZoomFactor() <= 1 || typeof SCREENS === "undefined") return null;
  const open = SCREENS.filter((s) => _screenOpen(s));
  const top = open[open.length - 1];
  return top && top._touchZoom ? top : null;
}

function _clampZoomView() {
  const z = touchZoomFactor();
  touchZoomView.x = Math.max(0, Math.min(width * z - width, touchZoomView.x));
  touchZoomView.y = Math.max(0, Math.min(height * z - height, touchZoomView.y));
}

function touchZoomPan(dx, dy) {
  touchZoomView.x += dx;
  touchZoomView.y += dy;
  _clampZoomView();
}

// Run fn with the mouse where it is in the zoomed picture
function _inZoom(fn) {
  const z = touchZoomFactor();
  const mx = mouse.x;
  const my = mouse.y;
  mouse.x = (mx + touchZoomView.x) / z;
  mouse.y = (my + touchZoomView.y) / z;
  try {
    return fn(z);
  } finally {
    mouse.x = mx;
    mouse.y = my;
  }
}

function _zoomWrap(s) {
  if (s._touchZoom) return;
  s._touchZoom = true;
  const draw = s.draw;
  const click = s.click;
  s.draw = (c) => {
    const open = _screenOpen(s);
    if (open && !s._zoomWasOpen) {
      // Just opened: the top, in the middle
      const z = touchZoomFactor();
      touchZoomView.x = (width * z - width) / 2;
      touchZoomView.y = 0;
    }
    s._zoomWasOpen = open;
    if (!open || touchZoomFactor() <= 1 || !draw) return draw ? draw(c) : undefined;
    return _inZoom((z) => {
      c.save();
      c.translate(-touchZoomView.x, -touchZoomView.y);
      c.scale(z, z);
      try {
        return draw(c);
      } finally {
        c.restore();
        _drawZoomHint(c);
      }
    });
  };
  if (click) {
    s.click = () => {
      if (!_screenOpen(s) || touchZoomFactor() <= 1) return click();
      return _inZoom(() => click());
    };
  }
}

// A little "drag to see more" under the picture's edge, while there's more
function _drawZoomHint(c) {
  const z = touchZoomFactor();
  const more = touchZoomView.y < height * z - height - 4;
  if (!more) return;
  c.save();
  c.fillStyle = "rgba(0, 0, 0, 0.55)";
  const w = 190;
  if (c.roundRect) {
    c.beginPath();
    c.roundRect(width / 2 - w / 2, height - 30, w, 24, 12);
    c.fill();
  } else c.fillRect(width / 2 - w / 2, height - 30, w, 24);
  c.fillStyle = "white";
  c.font = "bold 13px Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("\u2195 drag to see more", width / 2, height - 18);
  c.restore();
}

function setupTouchZoom() {
  if (!touchMode || typeof SCREENS === "undefined") return;
  for (const s of SCREENS) if (TOUCH_ZOOM_SCREENS.includes(s.name)) _zoomWrap(s);
}

// ---- Sending your game to another device ----
// More > "Send my save": the game as it is now, as a file, through the
// phone's share sheet (Messages, email, AirDrop, Drive...) - or downloaded
// where sharing files isn't possible. On the other device: Save/Load >
// Import save from file.
async function shareCurrentGame() {
  if (typeof buildSaveData !== "function") return false;
  let data;
  try {
    data = buildSaveData(typeof capturePauseScreenshot === "function" ? capturePauseScreenshot() : null);
  } catch (e) {
    console.error("Couldn't make the save to send:", e);
    if (typeof addUIMessage === "function") addUIMessage("Sorry - the save couldn't be made.");
    return false;
  }
  const day = typeof getDayNumber === "function" ? getDayNumber() : 1;
  const fileName = `fluffy-industries-day-${day}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  let file = null;
  try {
    file = new File([blob], fileName, { type: "application/json" });
  } catch (e) {}
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: "Fluffy Industries save", text: `My fluffies, day ${day}` });
      return "shared";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return false; // (you closed the share sheet)
  }
  // No sharing here: download it instead
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  if (typeof addUIMessage === "function") addUIMessage(`Saved as ${fileName} in your downloads. On the other device: Save/Load > Import save from file.`);
  return "downloaded";
}

// ---------------------------------------------------------------------------
// The touch bar: buttons for what only had a key
// ---------------------------------------------------------------------------

// Press a key, as if on a keyboard (the game's own key handlers do the rest)
function touchKey(code, key = code) {
  const ev = new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true });
  window.dispatchEvent(ev);
  window.dispatchEvent(new KeyboardEvent("keyup", { code, key, bubbles: true, cancelable: true }));
}

// Faster drawing on a slow phone: one canvas pixel per game pixel (remembered)
function setTouchLowRes(on) {
  touchLowRes = !!on;
  try {
    localStorage.setItem("fluffyLowRes", touchLowRes ? "1" : "0");
  } catch (e) {}
  if (typeof resize === "function") resize();
}

// A phone too slow for sharp drawing: after a while playing, if frames
// are coming slowly, switch to faster drawing once (and say so)
let _fpsWatch = { frames: [], last: 0, done: false };
function _touchWatchSpeed(t) {
  const w = _fpsWatch;
  if (w.done || touchLowRes || renderScale <= 1) return;
  const playing = typeof gameState !== "undefined" && gameState === "PLAYING" && document.visibilityState !== "hidden";
  if (playing && w.last) {
    const dt = t - w.last;
    if (dt < 1000) w.frames.push(dt); // (not a pause or a hidden tab)
  }
  w.last = t;
  if (w.frames.length >= 300) {
    const sorted = w.frames.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    w.frames = [];
    if (median > 45) {
      w.done = true;
      setTouchLowRes(true);
      if (typeof addUIMessage === "function") addUIMessage("Drawing less sharp to keep the game smooth (\u22EF > Sharper drawing to change it back).");
    }
  }
}
function _touchSpeedLoop(t) {
  _touchWatchSpeed(t);
  if (!_fpsWatch.done && !touchLowRes) requestAnimationFrame(_touchSpeedLoop);
}

// Sell mode (Shift on a computer): stays on till you turn it off
let touchSellMode = false;
function setTouchSellMode(on) {
  touchSellMode = !!on;
  isShiftPressed = touchSellMode;
  shiftSellBlocked = false;
  _touchSellPick = null;
  _touchBarRefresh();
}

// A tap in sell mode: the first tap on something shows its price, a
// second tap on it sells it (no selling by accident). UISelling.js.
let _touchSellPick = null;
function touchSellConfirm(item, msg = null) {
  if (!touchSellMode) return true;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (_touchSellPick && _touchSellPick.item === item && now - _touchSellPick.at < 4000) {
    _touchSellPick = null;
    return true;
  }
  _touchSellPick = { item, at: now };
  if (typeof addUIMessage === "function") addUIMessage(msg || "Tap it again to sell it.");
  return false;
}

const TOUCH_MORE = [
  { label: "Who's who (map)", run: () => touchKey("KeyM", "m") },
  { label: "Accounts", run: () => touchKey("KeyK", "k") },
  { label: "Goals", run: () => touchKey("KeyG", "g") },
  { label: "Breeding records", run: () => touchKey("KeyL", "l") },
  { label: "Names on/off", run: () => touchKey("KeyN", "n") },
  { label: "Herds on/off", run: () => touchKey("KeyH", "h") },
  { label: "Bed names on/off", run: () => touchKey("KeyB", "b") },
  { label: "Help", run: () => touchKey("F1", "F1") },
  { label: "Send my save to another device", run: () => shareCurrentGame() },
  { label: () => (touchLowRes ? "Sharper drawing" : "Faster drawing (less sharp)"), run: () => setTouchLowRes(!touchLowRes) },
  { label: "Full screen", run: () => touchTryFullscreen(true), show: () => !isStandaloneApp() && !!document.documentElement.requestFullscreen && !document.fullscreenElement },
];

let _touchBar = null;
let _touchMoreBox = null;

function _tbButton(label, title, onTap) {
  const b = document.createElement("button");
  b.className = "tb-btn";
  b.textContent = label;
  b.title = title;
  b.setAttribute("aria-label", title);
  // (on touchend, not click: no 300ms wait, and it never reaches the canvas;
  // a finger that slid off it - scrolling the More list - doesn't press it)
  let down = null;
  const fire = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    if (e.type === "touchend") {
      const p = e.changedTouches && e.changedTouches[0];
      const moved = down && p ? Math.hypot(p.clientX - down.x, p.clientY - down.y) : 0;
      down = null;
      if (moved > TOUCH_TAP_MOVE) return;
    }
    onTap();
  };
  b.addEventListener("touchend", fire, { passive: false });
  b.addEventListener("click", fire);
  b.addEventListener(
    "touchstart",
    (e) => {
      e.stopPropagation();
      const p = e.touches && e.touches[0];
      down = p ? { x: p.clientX, y: p.clientY } : null;
    },
    { passive: true },
  );
  return b;
}

function _heldFence() {
  return typeof Fence !== "undefined" && typeof objects !== "undefined" && objects.some((o) => o instanceof Fence && o.isDragging);
}

function _touchBarRefresh() {
  if (!_touch) _ringHide(); // (no finger down: no ring, whatever happened)
  if (!_touchBar) return;
  const playing = typeof gameState !== "undefined" && gameState === "PLAYING";
  _touchBar.style.display = playing || gameState === "PAUSED" ? "flex" : "none";
  const q = (k) => _touchBar.querySelector(`[data-k="${k}"]`);
  q("sell").classList.toggle("on", touchSellMode);
  q("sell").style.display = playing ? "" : "none";
  q("more").style.display = playing ? "" : "none";
  q("rotate").style.display = playing && _heldFence() ? "" : "none";
  q("menu").textContent = playing && !(typeof isAnyScreenOpen === "function" && isAnyScreenOpen()) && !_heldTool() ? "☰" : "✕";
  if (!playing && _touchMoreBox) _touchMoreBox.style.display = "none";
  // Sell mode ends if the game leaves play
  if (!playing && touchSellMode) setTouchSellMode(false);
  if (touchSellMode) isShiftPressed = true;
}

function _heldTool() {
  return typeof objects !== "undefined" && typeof isToolObject === "function" && objects.some((o) => o.isDragging && isToolObject(o));
}

function _touchMoreToggle() {
  if (!_touchMoreBox) return;
  const open = _touchMoreBox.style.display !== "none";
  if (open) {
    _touchMoreBox.style.display = "none";
    return;
  }
  _touchMoreBox.innerHTML = "";
  for (const item of TOUCH_MORE) {
    if (item.show && !item.show()) continue;
    const label = typeof item.label === "function" ? item.label() : item.label;
    const b = _tbButton(label, label, () => {
      _touchMoreBox.style.display = "none";
      item.run();
    });
    b.className = "tb-item";
    _touchMoreBox.appendChild(b);
  }
  _touchMoreBox.style.display = "flex";
}

function buildTouchBar() {
  if (_touchBar || typeof document === "undefined") return;
  const bar = document.createElement("div");
  bar.id = "touch-bar";
  const add = (k, label, title, fn) => {
    const b = _tbButton(label, title, fn);
    b.dataset.k = k;
    bar.appendChild(b);
  };
  add("menu", "☰", "Menu / back (Esc)", () => {
    if (_touchMoreBox) _touchMoreBox.style.display = "none";
    touchKey("Escape", "Escape");
  });
  add("sell", "$", "Sell mode (Shift): tap something twice to sell it", () => setTouchSellMode(!touchSellMode));
  add("rotate", "↻", "Turn the fence (R)", () => touchKey("KeyR", "r"));
  add("more", "⋯", "More", _touchMoreToggle);
  document.body.appendChild(bar);
  const more = document.createElement("div");
  more.id = "touch-more";
  more.style.display = "none";
  document.body.appendChild(more);
  _touchBar = bar;
  _touchMoreBox = more;
  setInterval(_touchBarRefresh, 250);
  _touchBarRefresh();
}

// ---- Words: what the game says to do with a mouse, said for a finger ----
// (every bit of text the game draws goes through fillText / strokeText /
// measureText: on a phone, "right-click" reads "long-press", "click" reads
// "tap", and so on, in the measuring and the drawing alike)
const TOUCH_WORDS = [
  [/\b([Rr])ight[- ]?click(s|ed|ing)?\b/g, (m, r, e) => (r === "R" ? "Long-press" : "long-press") + (e === "s" ? "es" : e === "ed" ? "ed" : e === "ing" ? "ing" : "")],
  [/\b([Ss])hift[- +]*click(s|ed|ing)?\b/g, (m, s0) => (s0 === "S" ? "Sell mode ($) + tap" : "sell mode ($) + tap")],
  [/\b([Dd])ouble[- ]click(s|ed|ing)?\b/g, (m, d) => (d === "D" ? "Double-tap" : "double-tap")],
  [/\b([Cc])lick(s|ed|ing)?\b/g, (m, c, e) => (c === "C" ? "Tap" : "tap") + (e === "s" ? "s" : e === "ed" ? "ped" : e === "ing" ? "ping" : "")],
  [/\b([Hh])over(ing|s)?( over)?\b/g, (m, h) => (h === "H" ? "Tap" : "tap")],
  [/\bthe mouse wheel\b/g, () => "a swipe"],
  [/\bScroll to zoom\b/g, () => "Pinch to zoom"],
  [/\(Esc\)/g, () => "(\u2715)"],
];
const _touchWordCache = new Map();
function touchWords(text) {
  if (typeof text !== "string" || !/[Cc]lick|[Hh]over|Esc|wheel|Scroll to zoom/.test(text)) return text;
  let out = _touchWordCache.get(text);
  if (out !== undefined) return out;
  out = text;
  for (const [re, fn] of TOUCH_WORDS) out = out.replace(re, fn);
  if (_touchWordCache.size > 4000) _touchWordCache.clear();
  _touchWordCache.set(text, out);
  return out;
}
function _touchWordsOn(proto) {
  if (!proto || proto._touchWords) return;
  proto._touchWords = true;
  for (const name of ["fillText", "strokeText", "measureText"]) {
    const orig = proto[name];
    if (typeof orig !== "function") continue;
    proto[name] = function (text, ...rest) {
      return orig.call(this, touchWords(text), ...rest);
    };
  }
}
if (touchMode && typeof CanvasRenderingContext2D !== "undefined") {
  _touchWordsOn(CanvasRenderingContext2D.prototype);
  if (typeof OffscreenCanvasRenderingContext2D !== "undefined") _touchWordsOn(OffscreenCanvasRenderingContext2D.prototype);
}

// ---- Held upright: turn it sideways ----
let _rotateNote = null;
function _touchOrientation() {
  if (!touchMode || typeof document === "undefined") return;
  if (!_rotateNote) {
    _rotateNote = document.createElement("div");
    _rotateNote.id = "rotate-note";
    _rotateNote.innerHTML = '<div class="rn-phone"></div><div>Turn your phone sideways to play</div>';
    document.body.appendChild(_rotateNote);
  }
  _rotateNote.style.display = window.innerHeight > window.innerWidth ? "flex" : "none";
}

if (typeof window !== "undefined" && window.addEventListener && touchMode) {
  document.documentElement.classList.add("touch");
  const start = () => {
    buildTouchBar();
    _touchOrientation();
    setupTouchZoom();
    requestAnimationFrame(_touchSpeedLoop);
  };
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", start);
  else start();
  window.addEventListener("resize", _touchOrientation);
  window.addEventListener("orientationchange", () => setTimeout(() => {
    _touchOrientation();
    if (typeof resize === "function") resize();
  }, 200));
}
