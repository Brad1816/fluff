// ---------------------------------------------------------------------------
// Eject anywhere (plan, Brady's option B): a cage set to Eject tips its
// contents out where you take it.
//
//   - Tap it (press and let go on the spot): it empties just below, as
//     before (cageTapRelease, from the mouseup in globals.js).
//   - Carry it (drag it with a finger or the mouse) over a grinder, the
//     river, the road, a table or another cage and let go: it lands beside
//     that and tips them onto it, each as if you'd dropped it there by hand
//     (Horse.onDrop): into the grinder one after another, half a second
//     apart (CAGE_TIP_GAP); in the water; in the lanes; one on the table and
//     the rest beside it; moved into the other cage.
//   - Let go over plain floor: it just moves.
//   - Watching it tipped into a grinder frightens those nearby and teaches
//     them to fear cages, like seeing a cull - family most (Fears.js).
//   - While you carry a full Eject cage over something it would tip into,
//     that thing glows (drawCageTipHint), so you can see on a phone where
//     they'll land before you let go.
// A can isn't an Eject cage (FoalInACan has no modes), so it stays as it is.
// ---------------------------------------------------------------------------

const CAGE_TIP_GAP = 0.5; // game seconds between fluffies going into the grinder
const RIVER_WATER_X = 0.25; // the river's water: left of this share of the width (HorsePhysics)
const ROAD_TOP = 320; // the road's lanes (UIScenes.drawRoad)
const ROAD_BOTTOM = 580;

function _ctInRect(x, y, b) {
  return !!b && x > b.left && x < b.right && y > b.top && y < b.bottom;
}

// What an Eject cage let go at (x, y) would tip into: { kind, obj, bounds }
// - kind "grinder", "cage", "table", "river" or "road" - or null
function cageTipTargetAt(cage, x, y) {
  const scene = cage.scene;
  if (typeof objects !== "undefined") {
    for (const o of objects) {
      if (o === cage || o.scene !== scene || o.isDragging) continue;
      if (typeof Grinder !== "undefined" && o instanceof Grinder && _ctInRect(x, y, o.bounds)) return { kind: "grinder", obj: o, bounds: o.bounds };
    }
    for (const o of objects) {
      if (o === cage || o.scene !== scene || o.isDragging) continue;
      if (o instanceof Cage && o.acceptsDroppedItems() && !o.isCulling() && _ctInRect(x, y, o.bounds)) return { kind: "cage", obj: o, bounds: o.bounds };
    }
    for (const o of objects) {
      if (o === cage || o.scene !== scene || o.isDragging) continue;
      if (typeof FluffyTable !== "undefined" && o instanceof FluffyTable && o.bounds && _ctInRect(x, y, o.bounds)) return { kind: "table", obj: o, bounds: o.bounds };
    }
  }
  const w = typeof width === "number" ? width : 1280;
  if (scene === "RIVER" && x < w * RIVER_WATER_X) return { kind: "river", obj: null, bounds: { left: 0, right: w * RIVER_WATER_X, top: (typeof height === "number" ? height : 800) * 0.15, bottom: typeof height === "number" ? height : 800 } };
  if (scene === "ALLEY_ROAD" && y > ROAD_TOP && y < ROAD_BOTTOM) return { kind: "road", obj: null, bounds: { left: 0, right: w, top: ROAD_TOP, bottom: ROAD_BOTTOM } };
  return null;
}

function _ctContents(cage) {
  const out = [];
  if (typeof fluffies !== "undefined") for (const f of fluffies) if (f.currentCage === cage) out.push(f);
  return out;
}

// Set the cage down beside what it tipped into, so it doesn't sit on it
function _ctBeside(cage, t) {
  if (!t.obj || !t.bounds) return;
  cage.updateBounds();
  const w = cage.bounds.right - cage.bounds.left;
  const tb = t.bounds;
  const sw = typeof sceneW === "function" ? sceneW(cage.scene) : typeof width === "number" ? width : 1280;
  const leftX = tb.left - w / 2 - 6;
  const rightX = tb.right + w / 2 + 6;
  const fitsLeft = leftX >= w / 2;
  const fitsRight = rightX <= sw - w / 2;
  // (the side it came from, unless there's no room there)
  let left = cage.x < (tb.left + tb.right) / 2;
  if (left && !fitsLeft && fitsRight) left = false;
  else if (!left && !fitsRight && fitsLeft) left = true;
  const x = Math.max(w / 2, Math.min(sw - w / 2, left ? leftX : rightX));
  const dx = x - cage.x;
  cage.x = x;
  cage.moveContents(dx, 0);
  cage.updateBounds();
}

// One fluffy out of the cage at (x, y), as if dropped there by hand
function _ctDrop(f, x, y, cage) {
  if (cage) cage._tipping = true; // (they don't fall straight back in)
  f.currentCage = null;
  f.isDragging = false;
  f.x = x;
  f.y = y;
  if (f.targetX !== undefined) {
    f.targetX = x;
    f.targetY = y;
  }
  try {
    f.onDrop();
  } finally {
    if (cage) cage._tipping = false;
  }
}

// Cage.onDrop: carried over something and let go. True if it tipped.
function tipCageAt(cage, x, y) {
  if (!cage || cage.tag !== "eject" || (cage.isCulling && cage.isCulling())) return false;
  const t = cageTipTargetAt(cage, x, y);
  const inside = _ctContents(cage);
  if (!t || !inside.length) return false;
  _ctBeside(cage, t);
  if (typeof poofs !== "undefined" && typeof Poof !== "undefined") poofs.push(new Poof(x, y, cage.scene));
  if (t.kind === "grinder") {
    // In they go, one after another
    cage._tipQueue = { ids: inside.map((f) => f.id), grinderId: t.obj.id, wait: 0 };
    if (typeof learnFearOfCages === "function") learnFearOfCages(cage, inside);
    for (const o of fluffies) {
      if (!o.isAlive || o.scene !== cage.scene || o.currentCage === cage || o.currentStateKey === "SLEEPING" || !o.canSee()) continue;
      if (Math.hypot(o.x - x, o.y - y) > 450) continue;
      o.setShock(2.5);
      if (typeof startFright === "function" && typeof fearOf === "function" && fearOf(o, "cages") >= (typeof FEAR_MIN === "number" ? FEAR_MIN : 0.3)) startFright(o, "cages");
    }
    return true;
  }
  inside.forEach((f, i) => {
    let px = x + (i ? (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 28 : 0);
    let py = y;
    if (t.kind === "table") {
      // One on the table, the rest beside it
      if (i > 0) {
        // (on the side away from the cage)
        const tb = t.bounds;
        const cageRight = cage.x > (tb.left + tb.right) / 2;
        px = cageRight ? tb.left - 30 - (i - 1) * 36 : tb.right + 30 + (i - 1) * 36;
        py = tb.bottom + 10;
      }
    } else if (t.kind === "cage") {
      const tb = t.bounds;
      px = Math.max(tb.left + 20, Math.min(tb.right - 20, px));
      py = Math.max(tb.top + 30, Math.min(tb.bottom - 10, py));
    }
    _ctDrop(f, px, py, cage);
  });
  return true;
}

// Cage.update: the next one into the grinder
function updateCageTip(cage, dt) {
  const q = cage._tipQueue;
  if (!q) return;
  q.wait -= dt;
  if (q.wait > 0) return;
  q.wait = CAGE_TIP_GAP;
  const g = typeof objects !== "undefined" ? objects.find((o) => o.id === q.grinderId) : null;
  let f = null;
  while (q.ids.length && !f) {
    const c = fluffyById(q.ids.shift());
    if (c && c.currentCage === cage && !c.isDestroyed) f = c;
  }
  if (!f || !g || g.scene !== cage.scene) {
    if (!q.ids.length || !g) cage._tipQueue = null;
    return;
  }
  const b = g.bounds;
  _ctDrop(f, (b.left + b.right) / 2, (b.top + b.bottom) / 2, cage);
  if (!q.ids.length) cage._tipQueue = null;
}

// globals.js mouseup: an Eject cage pressed and let go on the spot was a
// tap - put it back and empty it below, as before. (Dragged, it stays in
// your hand; it's put down - and tips - with the next tap or click.)
function cageTapRelease() {
  if (typeof objects === "undefined") return;
  for (const o of objects) {
    if (!(o instanceof Cage) || !o._ejectPress) continue;
    const p = o._ejectPress;
    o._ejectPress = null;
    if (!o.isDragging) continue;
    if (Math.hypot(mouse.x - p.x, mouse.y - p.y) >= CAGE_CLICK_THRESHOLD) continue;
    const dx = p.cx - o.x;
    const dy = p.cy - o.y;
    o.x = p.cx;
    o.y = p.cy;
    o.moveContents(dx, dy);
    o.isDragging = false;
    o.wasDragging = false;
    if (typeof isGlobalDragging !== "undefined") isGlobalDragging = false;
    o.updateBounds();
    o.ejectContents();
  }
}

// script.js render: what a carried full Eject cage would tip into glows
function drawCageTipHint(ctx) {
  if (typeof objects === "undefined") return;
  const cage = objects.find((o) => o instanceof Cage && o.isDragging && o.tag === "eject" && o.scene === currentScene);
  if (!cage || !_ctContents(cage).length) return;
  const t = cageTipTargetAt(cage, mouse.x, mouse.y);
  if (!t || !t.bounds) return;
  const b = t.bounds;
  const pulse = 0.55 + 0.35 * Math.sin((typeof performance !== "undefined" ? performance.now() : 0) / 160);
  ctx.save();
  ctx.strokeStyle = t.kind === "grinder" ? `rgba(255, 80, 60, ${pulse})` : `rgba(255, 230, 90, ${pulse})`;
  ctx.lineWidth = 5;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 14;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(b.left - 4, b.top - 4, b.right - b.left + 8, b.bottom - b.top + 8, 10);
    ctx.stroke();
  } else ctx.strokeRect(b.left - 4, b.top - 4, b.right - b.left + 8, b.bottom - b.top + 8);
  ctx.restore();
}
