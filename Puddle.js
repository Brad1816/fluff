// Each puddle is a set of overlapping ellipses ("points") of one type in one
// scene. A point's ellipse has radii PUDDLE_BASE_A/B times its scale.
const PUDDLE_BASE_A = 200;
const PUDDLE_BASE_B = 100;
// Squared ratio of the radii; scaling y by this makes the ellipses circles
const PUDDLE_AXIS_RATIO_SQ =
  (PUDDLE_BASE_A * PUDDLE_BASE_A) / (PUDDLE_BASE_B * PUDDLE_BASE_B);
const PUDDLE_EPS = 0.0001;
const PUDDLE_GRASS_RADIUS = 100; // Grass this close soaks up puddle points
const PUDDLE_GRASS_SOAK_RATE = 0.0017;
const PUDDLE_OUTLINE_WIDTH = 2; // Visible outline thickness, drawn just outside the puddle
const PUDDLE_CACHE_SLACK = 64; // Cache canvases grow in steps of this many px

// evaporationRate: scale lost per second (only for puddles that dry up)
const PUDDLE_TYPES = {
  blood: { color: "#8a0303" },
  poop: { color: "#5c4033" },
  pee: { color: "#f1c40f" },
  vomit: { color: "#4b5320" },
  tears: { color: "rgba(180, 180, 180, 0.25)", evaporationRate: 0.005 },
  water: { color: "rgba(100, 150, 255, 0.3)", evaporationRate: 0.01 },
};

function puddleTypeFromColor(color) {
  for (const [type, def] of Object.entries(PUDDLE_TYPES)) {
    if (def.color === color) return type;
  }
  return null;
}

class Puddle {
  constructor(scene, type) {
    this.scene = scene;
    this.type = type;
    this.points = []; // { x, y, scale, targetScale, growthRate }
    this.isGrowing = true;

    // Rendered image of the puddle, rebuilt only when its points change
    this.cache = null;
    this.cacheX = 0;
    this.cacheY = 0;
    this.cacheW = 0;
    this.cacheH = 0;
    this.dirty = true;
  }

  // Call after changing any point so the cached image is redrawn
  markDirty() {
    this.dirty = true;
  }

  get color() {
    return PUDDLE_TYPES[this.type].color;
  }

  get evaporationRate() {
    return PUDDLE_TYPES[this.type].evaporationRate || 0;
  }

  isEmpty() {
    return this.points.length === 0;
  }

  addPoint(point) {
    this.points.push(point);
    this.markDirty();
  }

  removePointAt(index) {
    this.points.splice(index, 1);
    this.markDirty();
  }

  clear() {
    this.points = [];
    this.markDirty();
  }

  // Shrinks a point by amount and removes it once its scale is at or below 0,
  // or below removeBelow. Its targetScale is either shrunk by the same amount
  // (shrinkTarget) or capped at the new scale so it doesn't regrow.
  // Returns true if the point was removed.
  shrinkPoint(index, amount, removeBelow = 0, shrinkTarget = false) {
    const p = this.points[index];
    p.scale -= amount;
    if (p.targetScale) {
      p.targetScale = shrinkTarget
        ? Math.max(0, p.targetScale - amount)
        : Math.min(p.targetScale, p.scale);
    }
    this.markDirty();
    if (p.scale <= 0 || p.scale < removeBelow) {
      this.removePointAt(index);
      return true;
    }
    return false;
  }

  // Whether (x, y) is inside the point's ellipse, with its scale clamped to
  // at least minScale
  pointContains(p, x, y, minScale = 0) {
    const s = Math.max(minScale, p.scale || 1.0);
    const a = PUDDLE_BASE_A * s;
    const b = PUDDLE_BASE_B * s;
    if (a <= 0 || b <= 0) return false;
    return ((x - p.x) / a) ** 2 + ((y - p.y) / b) ** 2 <= 1;
  }

  // Removes points entirely inside a larger one, passing their target size
  // on to it. Returns true if anything was merged.
  mergeCoveredPoints() {
    let merged = false;
    for (let i = this.points.length - 1; i >= 0; i--) {
      const j = puddlePointIsCovered(this.points, i);
      if (j === -1) continue;
      const p1 = this.points[i];
      const p2 = this.points[j];
      if (p1.targetScale) {
        const s1 = p1.targetScale;
        const s2 = p2.targetScale || p2.scale;
        p2.targetScale = Math.sqrt(s1 * s1 + s2 * s2);
      }
      this.removePointAt(i);
      merged = true;
    }
    return merged;
  }

  // Grows points toward their target size, lets nearby grass soak them up
  // and evaporates drying puddle types. Returns true if any point changed.
  updatePoints(dt, grasses) {
    let changed = false;
    const evaporationRate = this.evaporationRate;
    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i];

      if (grasses.length > 0 && isNearAnyGrass(grasses, p.x, p.y)) {
        const rate = PUDDLE_GRASS_SOAK_RATE * dt;
        p.scale -= rate;
        if (p.targetScale) p.targetScale -= rate;
        if (p.scale <= 0) this.removePointAt(i);
        changed = true;
        continue;
      }

      if (p.targetScale && p.scale < p.targetScale) {
        p.scale = Math.min(
          p.targetScale,
          p.scale + (p.growthRate || 0.05) * dt,
        );
        changed = true;
      }

      if (evaporationRate > 0) {
        p.scale -= evaporationRate * dt;
        if (p.targetScale) p.targetScale -= evaporationRate * dt;
        if (p.scale <= 0) this.removePointAt(i);
        changed = true;
      }
    }
    return changed;
  }

  draw(ctx) {
    if (this.dirty) this.rebuildCache();
    if (!this.cache || this.cacheW === 0) return;
    ctx.drawImage(
      this.cache,
      0,
      0,
      this.cacheW,
      this.cacheH,
      this.cacheX,
      this.cacheY,
      this.cacheW,
      this.cacheH,
    );
  }

  // Draws the union of all the points' ellipses with a black outline around
  // the outside only: stroke every ellipse, erase everything inside the union
  // (removing the strokes where ellipses overlap), then fill the union once.
  rebuildCache() {
    this.dirty = false;
    const visible = this.points.filter(
      (p, i) => puddlePointIsCovered(this.points, i) === -1,
    );
    if (visible.length === 0) {
      this.cacheW = this.cacheH = 0;
      return;
    }

    const pad = PUDDLE_OUTLINE_WIDTH + 1;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const path = new Path2D();
    for (const p of visible) {
      const s = p.scale || 1.0;
      const a = PUDDLE_BASE_A * s;
      const b = PUDDLE_BASE_B * s;
      if (a <= 0 || b <= 0) continue;
      minX = Math.min(minX, p.x - a);
      maxX = Math.max(maxX, p.x + a);
      minY = Math.min(minY, p.y - b);
      maxY = Math.max(maxY, p.y + b);
      path.moveTo(p.x + a, p.y);
      path.ellipse(p.x, p.y, a, b, 0, 0, Math.PI * 2);
    }
    if (minX === Infinity) {
      this.cacheW = this.cacheH = 0;
      return;
    }

    this.cacheX = Math.floor(minX) - pad;
    this.cacheY = Math.floor(minY) - pad;
    this.cacheW = Math.ceil(maxX) + pad - this.cacheX;
    this.cacheH = Math.ceil(maxY) + pad - this.cacheY;

    // Reuse the canvas while it's big enough, growing it in steps so a
    // growing puddle doesn't reallocate every frame
    if (
      !this.cache ||
      this.cache.width < this.cacheW ||
      this.cache.height < this.cacheH
    ) {
      const roundUp = (v) =>
        Math.ceil(v / PUDDLE_CACHE_SLACK) * PUDDLE_CACHE_SLACK;
      this.cache = new OffscreenCanvas(roundUp(this.cacheW), roundUp(this.cacheH));
    }

    const c = this.cache.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, this.cacheW, this.cacheH);
    c.translate(-this.cacheX, -this.cacheY);

    // Stroke is centered on the edge, so double it to leave the full
    // outline width outside once the inside is erased
    c.strokeStyle = "black";
    c.lineWidth = PUDDLE_OUTLINE_WIDTH * 2;
    c.stroke(path);

    c.globalCompositeOperation = "destination-out";
    c.fill(path);

    c.globalCompositeOperation = "source-over";
    c.fillStyle = this.color;
    c.fill(path);
  }

  serialize() {
    return {
      scene: this.scene,
      type: this.type,
      points: this.points.map((p) => ({ ...p })),
      isGrowing: this.isGrowing,
    };
  }

  static deserialize(data) {
    // Older saves identify puddles by color
    const type = PUDDLE_TYPES[data.type]
      ? data.type
      : puddleTypeFromColor(data.color) || "blood";
    const puddle = new Puddle(data.scene, type);
    puddle.points = (data.points || []).map((p) => ({ ...p }));
    puddle.isGrowing = data.isGrowing !== false;
    return puddle;
  }
}

// Whether inner's ellipse lies entirely inside outer's
function puddleEllipseContains(outer, inner) {
  const a1 = PUDDLE_BASE_A * (inner.scale || 1.0);
  const a2 = PUDDLE_BASE_A * (outer.scale || 1.0);
  const d = Math.sqrt(
    (inner.x - outer.x) ** 2 + PUDDLE_AXIS_RATIO_SQ * (inner.y - outer.y) ** 2,
  );
  return d + a1 <= a2 + PUDDLE_EPS;
}

// Whether p1 should be dropped because another point fully covers it. Equal
// sized duplicates only drop the later one so one of them survives.
function puddlePointIsCovered(points, i) {
  const p1 = points[i];
  const s1 = p1.scale || 1.0;
  for (let j = 0; j < points.length; j++) {
    if (i === j) continue;
    const s2 = points[j].scale || 1.0;
    if (s2 < s1) continue;
    if (s2 === s1 && j < i) continue;
    if (puddleEllipseContains(points[j], p1)) return j;
  }
  return -1;
}

function findPuddle(scene, type) {
  return puddles.find((p) => p.scene === scene && p.type === type);
}

// Grass objects grouped by scene, gathered once per update
function getGrassByScene() {
  const byScene = new Map();
  if (typeof objects === "undefined") return byScene;
  for (const o of objects) {
    if (!(o instanceof Grass)) continue;
    let list = byScene.get(o.scene);
    if (!list) {
      list = [];
      byScene.set(o.scene, list);
    }
    list.push(o);
  }
  return byScene;
}

function isNearAnyGrass(grasses, x, y) {
  const r2 = PUDDLE_GRASS_RADIUS * PUDDLE_GRASS_RADIUS;
  return grasses.some((g) => (x - g.x) ** 2 + (y - g.y) ** 2 <= r2);
}

function updatePuddles(dt) {
  const grassByScene = getGrassByScene();
  const noGrass = [];

  for (const puddle of puddles) {
    const grasses = grassByScene.get(puddle.scene) || noGrass;

    // Idle puddles only need updating again once grass is near them
    if (!puddle.isGrowing) {
      if (
        grasses.length === 0 ||
        !puddle.points.some((p) => isNearAnyGrass(grasses, p.x, p.y))
      ) {
        continue;
      }
      puddle.isGrowing = true;
    }

    const merged = puddle.mergeCoveredPoints();
    const changed = puddle.updatePoints(dt, grasses);
    if (merged || changed) puddle.markDirty();
    else puddle.isGrowing = false;
  }
}

function addPointToPuddle(
  scene,
  x,
  y,
  type,
  scale,
  targetScale,
  growthRate = 0.05,
) {
  let puddle = findPuddle(scene, type);
  if (!puddle) {
    puddle = new Puddle(scene, type);
    puddles.push(puddle);
  }

  const existingPoint = puddle.points.find(
    (pt) => Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2) < 5,
  );

  if (existingPoint) {
    const currentTarget = existingPoint.targetScale || existingPoint.scale;
    existingPoint.targetScale = Math.min(
      1,
      Math.sqrt(currentTarget * currentTarget + targetScale * targetScale),
    );
    existingPoint.scale = Math.min(
      existingPoint.targetScale,
      Math.sqrt(existingPoint.scale * existingPoint.scale + scale * scale),
    );
  } else {
    puddle.addPoint({ x, y, scale, targetScale, growthRate });
  }
  puddle.isGrowing = true;
  puddle.markDirty();
}

function renderPuddles(ctx) {
  for (const puddle of puddles) {
    if (puddle.scene === currentScene) puddle.draw(ctx);
  }
}
