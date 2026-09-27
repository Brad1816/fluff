// ---------------------------------------------------------------------------
// Fluffy Park: one big area, much larger than the screen, that you look
// around with a camera. River --(left arrow)--> Park.
//
// Looking around: drag the grass, use the mouse wheel / trackpad, or hold
// WASD / the arrow keys. The map in the corner shows the whole park; click
// or drag on it to jump. Carrying something to a screen edge scrolls too.
//
// How the camera works (only in the park; everywhere else it's at 0,0 and
// nothing changes):
//   - things in the park have "world" positions (0..PARK_W, 0..PARK_H);
//     the screen shows the part from camera.x/camera.y
//   - the mouse has two positions: mouse.sx/sy on the screen, and mouse.x/y
//     which is switched between screen and world with mouseToWorld() /
//     mouseToScreen(). Game logic (picking up, dragging, tools) runs with
//     world positions; buttons and windows with screen positions. The switch
//     points are in script.js (animate/render) and UI.js (mousedown).
//   - sceneW / sceneH / sceneTop give an area's size, so fluffies wander,
//     flee and follow across the whole park, not just one screen.
// ---------------------------------------------------------------------------

const PARK_SCENE = "PARK";
const PARK_W = Math.round(width * 3);
const PARK_H = Math.round(height * 2.4);
const PARK_TOP = 40; // no back wall in the park, just a small margin

const camera = { x: 0, y: 0 };
let _parkPan = null; // dragging the grass or the map
const _parkKeys = {};

SCENES[PARK_SCENE] = {
  id: PARK_SCENE,
  isIndoor: false,
  insidePlayerQuarters: false,
  isOutdoor: true,
  isGrassy: false,
  isAlley: false,
  isAdoptionRoom: false,
  hasRiver: false,
  backgroundTexture: "texture_grass",
  topWallColor: null,
  spawnFerals: false,
  isPark: true,
};

function isCameraScene(scene) {
  return scene === PARK_SCENE;
}

// Size of an area (the park is bigger than the screen)
function sceneW(scene) {
  return isCameraScene(scene) ? PARK_W : width;
}
function sceneH(scene) {
  return isCameraScene(scene) ? PARK_H : height;
}
// Where the floor starts (below the back wall in most areas)
function sceneTop(scene) {
  return isCameraScene(scene) ? PARK_TOP : height * 0.15;
}

// ---- Mouse: screen vs world ----

function mouseToWorld() {
  if (isCameraScene(currentScene) && mouse.sx !== undefined) {
    mouse.x = mouse.sx + camera.x;
    mouse.y = mouse.sy + camera.y;
  }
}

function mouseToScreen() {
  if (isCameraScene(currentScene) && mouse.sx !== undefined) {
    mouse.x = mouse.sx;
    mouse.y = mouse.sy;
  }
}

// The mouse on the screen, whatever mode it's in
function screenMouse() {
  if (isCameraScene(currentScene) && mouse.sx !== undefined) return { x: mouse.sx, y: mouse.sy };
  return { x: mouse.x, y: mouse.y };
}

// ---- Camera ----

function clampCamera() {
  camera.x = clamp(camera.x, 0, Math.max(0, PARK_W - width));
  camera.y = clamp(camera.y, 0, Math.max(0, PARK_H - height));
}

function centreCameraOn(x, y) {
  camera.x = x - width / 2;
  camera.y = y - height / 2;
  clampCamera();
}

// When you arrive in the park (changeScene in globals.js)
function onEnterScene(newScene, oldScene) {
  if (!isCameraScene(newScene) || isCameraScene(oldScene)) return;
  // From the river you come in on the right-hand side
  camera.x = PARK_W - width;
  camera.y = (PARK_H - height) / 2;
  clampCamera();
}

function _parkScreenOpen() {
  return typeof isAnyScreenOpen === "function" && isAnyScreenOpen();
}

// Every frame (script.js animate): keys, and edge-scrolling while carrying
function updateParkCamera(dt) {
  if (!isCameraScene(currentScene) || gameState !== "PLAYING") return;
  const speed = 700 * dt;
  if (!_parkScreenOpen()) {
    if (_parkKeys.left) camera.x -= speed;
    if (_parkKeys.right) camera.x += speed;
    if (_parkKeys.up) camera.y -= speed;
    if (_parkKeys.down) camera.y += speed;
    // Carrying something to the edge of the screen scrolls
    if (isGlobalDragging && mouse.sx !== undefined) {
      const edge = 40;
      if (mouse.sx < edge) camera.x -= speed;
      if (mouse.sx > width - edge) camera.x += speed;
      if (mouse.sy < edge) camera.y -= speed;
      if (mouse.sy > height - edge) camera.y += speed;
    }
  }
  clampCamera();
}

const _PARK_KEYMAP = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
};

window.addEventListener("keydown", (e) => {
  const dir = _PARK_KEYMAP[e.code];
  if (dir && isCameraScene(currentScene)) {
    _parkKeys[dir] = true;
    if (e.code.startsWith("Arrow")) e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  const dir = _PARK_KEYMAP[e.code];
  if (dir) _parkKeys[dir] = false;
});
window.addEventListener("blur", () => {
  for (const k in _parkKeys) _parkKeys[k] = false;
});

window.addEventListener(
  "wheel",
  (e) => {
    if (!isCameraScene(currentScene) || gameState !== "PLAYING" || _parkScreenOpen()) return;
    if (showChatLog) return; // the chat log scrolls instead
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
    camera.x += dx;
    camera.y += dy;
    clampCamera();
  },
  { passive: true },
);

// ---- Dragging the grass / the map ----

// Called at the very end of the mousedown handler (UI.js): the click didn't
// hit anything, so start dragging the view
function startParkPan() {
  if (!isCameraScene(currentScene) || mouse.rightDown || isGlobalDragging) return false;
  const m = screenMouse();
  _parkPan = { kind: "ground", sx: m.x, sy: m.y, camX: camera.x, camY: camera.y };
  return true;
}

window.addEventListener("mousemove", () => {
  if (!_parkPan || !isCameraScene(currentScene)) return;
  const m = screenMouse();
  if (_parkPan.kind === "ground") {
    camera.x = _parkPan.camX - (m.x - _parkPan.sx);
    camera.y = _parkPan.camY - (m.y - _parkPan.sy);
    clampCamera();
  } else if (_parkPan.kind === "map") {
    _jumpToMapPoint(m.x, m.y);
  }
});
window.addEventListener("mouseup", () => {
  _parkPan = null;
});

// ---- The map in the corner ----

function getParkMinimapRect() {
  const w = 220;
  const h = Math.round((w * PARK_H) / PARK_W);
  return { x: width - w - 14, y: height - h - 54, w, h };
}

function _jumpToMapPoint(px, py) {
  const r = getParkMinimapRect();
  const wx = ((px - r.x) / r.w) * PARK_W;
  const wy = ((py - r.y) / r.h) * PARK_H;
  centreCameraOn(wx, wy);
}

// Mousedown (UI.js, screen positions): click / drag on the map
function parkMinimapClick() {
  if (!isCameraScene(currentScene) || isGlobalDragging) return false;
  const m = screenMouse();
  const r = getParkMinimapRect();
  if (!isPointInRect(m.x, m.y, r.x, r.y, r.w, r.h)) return false;
  _jumpToMapPoint(m.x, m.y);
  _parkPan = { kind: "map" };
  return true;
}

// ---- Scenery (drawn behind everything, in world positions) ----

const PARK_SCENERY = (() => {
  let s = 20240927;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const items = [];
  const place = (kind, n, pad) => {
    for (let i = 0; i < n; i++) {
      items.push({
        kind,
        x: pad + rnd() * (PARK_W - pad * 2),
        y: PARK_TOP + pad + rnd() * (PARK_H - PARK_TOP - pad * 2),
        size: 0.7 + rnd() * 0.6,
        hue: rnd(),
      });
    }
  };
  place("tree", 28, 120);
  place("rock", 18, 80);
  place("flowers", 26, 60);
  items.sort((a, b) => a.y - b.y);
  return items;
})();

function _drawParkTree(c, t) {
  const s = t.size;
  c.fillStyle = "rgba(0,0,0,0.18)";
  c.beginPath();
  c.ellipse(t.x, t.y + 4, 46 * s, 14 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#6b4a2b";
  c.fillRect(t.x - 8 * s, t.y - 60 * s, 16 * s, 62 * s);
  const greens = ["#2f7d32", "#388e3c", "#2e6b30"];
  const blobs = [
    [0, -95, 42],
    [-30, -75, 32],
    [30, -78, 34],
    [0, -120, 30],
  ];
  blobs.forEach(([dx, dy, r], i) => {
    c.fillStyle = greens[(i + Math.floor(t.hue * 3)) % greens.length];
    c.beginPath();
    c.arc(t.x + dx * s, t.y + dy * s, r * s, 0, Math.PI * 2);
    c.fill();
  });
}

function _drawParkRock(c, r) {
  const s = r.size;
  c.fillStyle = "rgba(0,0,0,0.15)";
  c.beginPath();
  c.ellipse(r.x, r.y + 3, 26 * s, 7 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = r.hue > 0.5 ? "#8d8d8d" : "#9e9a92";
  c.beginPath();
  c.ellipse(r.x, r.y - 8 * s, 24 * s, 15 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.2)";
  c.beginPath();
  c.ellipse(r.x - 7 * s, r.y - 14 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2);
  c.fill();
}

function _drawParkFlowers(c, f) {
  const cols = ["#ff8ad8", "#ffe066", "#ffffff", "#b39dff"];
  const col = cols[Math.floor(f.hue * cols.length) % cols.length];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + f.hue * 6;
    const d = (i % 3) * 9 * f.size + 4;
    c.fillStyle = col;
    c.beginPath();
    c.arc(f.x + Math.cos(a) * d * 1.6, f.y + Math.sin(a) * d * 0.7, 3.2, 0, Math.PI * 2);
    c.fill();
  }
}

// script.js render, after the background, with the camera applied
function drawParkScenery(c) {
  if (!isCameraScene(currentScene)) return;
  if (typeof drawParkMeadows === "function") drawParkMeadows(c);
  const x0 = camera.x - 200;
  const x1 = camera.x + width + 200;
  const y0 = camera.y - 200;
  const y1 = camera.y + height + 200;
  for (const it of PARK_SCENERY) {
    if (it.x < x0 || it.x > x1 || it.y < y0 || it.y > y1) continue;
    if (it.kind === "tree") _drawParkTree(c, it);
    else if (it.kind === "rock") _drawParkRock(c, it);
    else _drawParkFlowers(c, it);
  }
  // Hedge along the edges of the park
  c.fillStyle = "#2e5e2f";
  const hedge = 22;
  c.fillRect(0, 0, PARK_W, hedge);
  c.fillRect(0, PARK_H - hedge, PARK_W, hedge);
  c.fillRect(0, 0, hedge, PARK_H);
  c.fillRect(PARK_W - hedge, 0, hedge, PARK_H);
}

// Is a world position roughly on screen? (for skipping far-away drawing)
function isOnParkScreen(x, y, pad = 300) {
  return x > camera.x - pad && x < camera.x + width + pad && y > camera.y - pad && y < camera.y + height + pad;
}

// ---- Screen overlay: title and map (screen positions) ----

function drawParkHud(c) {
  if (!isCameraScene(currentScene) || (typeof isAnyScreenOpen === "function" && isAnyScreenOpen())) return;
  c.save();
  c.globalAlpha = 1;
  c.textBaseline = "alphabetic";

  // Title
  const title = "Fluffy Park";
  const hint = "Drag the grass, scroll, or WASD / arrow keys to look around";
  c.font = "bold 20px Arial";
  const tw = Math.max(c.measureText(title).width, 0);
  c.font = "12px Arial";
  const hw = c.measureText(hint).width;
  const pw = Math.max(tw, hw) + 30;
  c.fillStyle = "rgba(0,0,0,0.45)";
  c.fillRect(width / 2 - pw / 2, 8, pw, 48);
  c.textAlign = "center";
  c.fillStyle = "white";
  c.font = "bold 20px Arial";
  c.fillText(title, width / 2, 30);
  c.font = "12px Arial";
  c.fillStyle = "rgba(255,255,255,0.8)";
  c.fillText(hint, width / 2, 48);

  // Map
  const r = getParkMinimapRect();
  c.fillStyle = "rgba(20, 50, 20, 0.85)";
  c.fillRect(r.x, r.y, r.w, r.h);
  const sx = r.w / PARK_W;
  const sy = r.h / PARK_H;
  if (typeof drawParkLifeOnMap === "function") drawParkLifeOnMap(c, r);
  c.fillStyle = "rgba(20, 90, 25, 0.9)";
  for (const it of PARK_SCENERY) {
    if (it.kind !== "tree") continue;
    c.beginPath();
    c.arc(r.x + it.x * sx, r.y + it.y * sy, 3, 0, Math.PI * 2);
    c.fill();
  }
  for (const f of fluffies) {
    if (f.scene !== PARK_SCENE) continue;
    const h = typeof herdOf === "function" ? herdOf(f) : null;
    c.fillStyle = !f.isAlive ? "#555" : h ? getHerdColor(h) : f.adopted ? "#ffffff" : "#d8c9a0";
    c.beginPath();
    c.arc(r.x + f.x * sx, r.y + f.y * sy, f.growth < 1 ? 2 : 3, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = "white";
  c.lineWidth = 1.5;
  c.strokeRect(r.x + camera.x * sx, r.y + camera.y * sy, width * sx, height * sy);
  c.strokeStyle = "rgba(255,255,255,0.6)";
  c.strokeRect(r.x, r.y, r.w, r.h);
  c.fillStyle = "rgba(255,255,255,0.75)";
  c.font = "11px Arial";
  c.textAlign = "right";
  c.fillText("Park map: click to jump", r.x + r.w, r.y - 5);
  c.restore();
}
