// ---------------------------------------------------------------------------
// Spatial grid: a quick way to find the fluffies near a spot.
//
// Checking every fluffy against every other fluffy gets slow when a big park
// holds dozens of them (40 fluffies = 780 pairs, 80 = 3160). The grid sorts
// fluffies into squares of FLUFFY_GRID_CELL px per area, so "who's within
// 150px of here?" only looks at the few squares around that spot.
//
// Positions are copied when the grid is built, so call rebuildFluffyGrid()
// before a batch of lookups (Bonds.js, Herds.js and Territory.js do this at
// the start of each of their ticks).
// ---------------------------------------------------------------------------

const FLUFFY_GRID_CELL = 200;
const _fluffyGrid = new Map(); // "scene|cx|cy" -> [fluffy]

function _gridKey(scene, cx, cy) {
  return scene + "|" + cx + "|" + cy;
}

function rebuildFluffyGrid() {
  _fluffyGrid.clear();
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    const k = _gridKey(f.scene, Math.floor(f.x / FLUFFY_GRID_CELL), Math.floor(f.y / FLUFFY_GRID_CELL));
    let list = _fluffyGrid.get(k);
    if (!list) _fluffyGrid.set(k, (list = []));
    list.push(f);
  }
}

// Living fluffies in `scene` within `r` px of (x, y) (as of the last rebuild)
function fluffiesNear(scene, x, y, r) {
  const out = [];
  // (a fluffy somewhere impossible mustn't send this round forever)
  if (!isFinite(x) || !isFinite(y) || !isFinite(r) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6 || r > 1e5) return out;
  const c0 = Math.floor((x - r) / FLUFFY_GRID_CELL);
  const c1 = Math.floor((x + r) / FLUFFY_GRID_CELL);
  const r0 = Math.floor((y - r) / FLUFFY_GRID_CELL);
  const r1 = Math.floor((y + r) / FLUFFY_GRID_CELL);
  const r2 = r * r;
  for (let cx = c0; cx <= c1; cx++) {
    for (let cy = r0; cy <= r1; cy++) {
      const list = _fluffyGrid.get(_gridKey(scene, cx, cy));
      if (!list) continue;
      for (const f of list) {
        const dx = f.x - x;
        const dy = f.y - y;
        if (dx * dx + dy * dy <= r2 && f.isAlive) out.push(f);
      }
    }
  }
  return out;
}

// Every pair of living fluffies in the same area within `r` px of each other,
// each pair once: calls fn(a, b)
function forEachNearbyPair(r, fn) {
  for (const list of _fluffyGrid.values()) {
    for (const a of list) {
      for (const b of fluffiesNear(a.scene, a.x, a.y, r)) {
        if (b.id > a.id) fn(a, b);
      }
    }
  }
}
