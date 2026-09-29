function updatePuddles(dt) {
  const baseA = 200;
  const baseB = 100;
  const R = (baseA * baseA) / (baseB * baseB);
  const EPS = 0.0001;

  // Wake up puddles that are near any grass
  if (typeof objects !== "undefined") {
    const grasses = objects.filter((o) => o instanceof Grass);
    if (grasses.length > 0) {
      puddles.forEach((puddle) => {
        if (!puddle.isGrowing) {
          // The whole park is lawn, so everything soaks in there
          if (puddle.scene === "PARK") {
            if (puddle.points.length) puddle.isGrowing = true;
            return;
          }
          const nearGrass = puddle.points.some((p) =>
            grasses.some(
              (g) =>
                g.scene === puddle.scene &&
                Math.sqrt((p.x - g.x) ** 2 + (p.y - g.y) ** 2) <= 100,
            ),
          );
          if (nearGrass) puddle.isGrowing = true;
        }
      });
    }
  }

  puddles.forEach((puddle) => {
    if (!puddle.isGrowing) return;

    let hasGrowth = false;

    // 1. Merge overlapping points
    for (let i = puddle.points.length - 1; i >= 0; i--) {
      const p1 = puddle.points[i];
      const s1 = p1.scale || 1.0;
      const a1 = baseA * s1;

      for (let j = 0; j < puddle.points.length; j++) {
        if (i === j) continue;
        const p2 = puddle.points[j];
        const s2 = p2.scale || 1.0;

        // Only merge into larger or equal (with index check for equal)
        if (s2 < s1) continue;
        if (s2 === s1 && j < i) continue;

        const a2 = baseA * s2;
        const d = Math.sqrt(
          Math.pow(p1.x - p2.x, 2) + R * Math.pow(p1.y - p2.y, 2),
        );

        // If p1 is entirely inside p2
        if (d + a1 <= a2 + EPS) {
          // Add size to larger puddle (transfer targetScale)
          if (p1.targetScale) {
            const s1 = p1.targetScale;
            const s2 = p2.targetScale || p2.scale;
            p2.targetScale = Math.sqrt(s1 * s1 + s2 * s2);
          }
          puddle.points.splice(i, 1);
          hasGrowth = true;
          break;
        }
      }
    }

    // 2. Growth and Evaporation logic
    for (let i = puddle.points.length - 1; i >= 0; i--) {
      const p = puddle.points[i];

      // Check if near any grass
      let nearGrass = puddle.scene === "PARK"; // lawn everywhere in the park
      if (!nearGrass && typeof objects !== "undefined") {
        nearGrass = objects.some(
          (o) =>
            o instanceof Grass &&
            o.scene === puddle.scene &&
            Math.sqrt((p.x - o.x) ** 2 + (p.y - o.y) ** 2) <= 100,
        );
      }

      if (nearGrass) {
        const rate = 0.0017 * dt;
        p.scale -= rate;
        if (p.targetScale) p.targetScale -= rate;
        if (p.scale <= 0) {
          puddle.points.splice(i, 1);
        }
        hasGrowth = true;
      } else {
        if (p.targetScale && p.scale < p.targetScale) {
          p.scale = Math.min(
            p.targetScale,
            p.scale + (p.growthRate || 0.05) * dt,
          );
          hasGrowth = true;
        }

        // Evaporation for tear puddles
        if (puddle.color === "rgba(180, 180, 180, 0.25)") {
          p.scale -= 0.005 * dt;
          if (p.targetScale) p.targetScale -= 0.005 * dt;
          if (p.scale <= 0) {
            puddle.points.splice(i, 1);
          }
          hasGrowth = true;
        }

        // Evaporation for water puddles
        if (puddle.color === "rgba(100, 150, 255, 0.3)") {
          p.scale -= 0.01 * dt;
          if (p.targetScale) p.targetScale -= 0.01 * dt;
          if (p.scale <= 0) {
            puddle.points.splice(i, 1);
          }
          hasGrowth = true;
        }
      }
    }

    if (!hasGrowth) puddle.isGrowing = false;
  });

  fadeMess(dt);
}

// ---------------------------------------------------------------------------
// Mess fades by itself, and rain washes it away outside.
//   Poop, pee and sick slowly dry up and fade (MESS_FADE: how much of a
//   puddle's size goes per game day - a normal poop is gone in about a day
//   indoors, pee sooner). Outside it goes twice as fast.
//   Rain (and storms) outside wash poop, pee, sick and blood away within a
//   minute or so at full strength (RAIN_WASH per second x rain amount).
//   Blood doesn't fade by itself indoors - it needs the sponge (or rain).
// ---------------------------------------------------------------------------
const MESS_COLORS = { "#5c4033": "poop", "#f1c40f": "pee", "#4b5320": "vomit", "#8a0303": "blood" };
const MESS_FADE = { poop: 0.6, pee: 1.5, vomit: 0.9, blood: 0 }; // size per game day
const RAIN_WASH = 0.02; // size per second in full rain

function _messOutdoor(scene) {
  const cfg = typeof getSceneConfig === "function" ? getSceneConfig(scene) : null;
  return !!(cfg && cfg.isOutdoor);
}

function fadeMess(dt) {
  const day = typeof DAY_LENGTH === "number" ? DAY_LENGTH : 1200;
  const rain = typeof rainAmount === "function" ? rainAmount() : 0;
  for (const puddle of puddles) {
    const kind = MESS_COLORS[puddle.color];
    if (!kind || !puddle.points.length) continue;
    const outdoor = _messOutdoor(puddle.scene);
    let rate = (MESS_FADE[kind] / day) * (outdoor ? 2 : 1);
    if (outdoor && rain > 0) rate += RAIN_WASH * rain;
    if (rate <= 0) continue;
    const step = rate * dt;
    for (let i = puddle.points.length - 1; i >= 0; i--) {
      const p = puddle.points[i];
      p.scale -= step;
      if (p.targetScale) p.targetScale = Math.max(0, p.targetScale - step);
      if (p.scale <= 0.005) puddle.points.splice(i, 1);
    }
  }
}

function addPointToPuddle(
  scene,
  x,
  y,
  color,
  scale,
  targetScale,
  growthRate = 0.05,
  type = null,
) {
  let puddle = puddles.find((p) => p.scene === scene && p.color === color);
  if (!puddle) {
    const pType = type || (color === "#4b5320" ? "vomit" : "general");
    puddle = { scene, color, type: pType, points: [], isGrowing: true };
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
    puddle.points.push({ x, y, scale, targetScale, growthRate });
  }
  puddle.isGrowing = true;
}

function renderPuddles(ctx) {
  const baseA = 200;
  const baseB = 100;
  const R = (baseA * baseA) / (baseB * baseB);
  const EPS = 0.0001;

  puddles.forEach((puddle) => {
    if (puddle.scene !== currentScene) return;

    // Pre-filter: remove ellipses that are entirely contained within another larger one
    const activePoints = puddle.points.filter((p1, i) => {
      const s1 = p1.scale || 1.0;
      const a1 = baseA * s1;
      return !puddle.points.some((p2, j) => {
        if (i === j) return false;
        const s2 = p2.scale || 1.0;
        if (s2 < s1) return false;
        // Equal size: only remove one to avoid removing both
        if (s2 === s1 && j < i) return false;

        const a2 = baseA * s2;
        const d = Math.sqrt(
          Math.pow(p1.x - p2.x, 2) + R * Math.pow(p1.y - p2.y, 2),
        );
        return d + a1 <= a2 + EPS;
      });
    });

    ctx.save();

    ctx.fillStyle = puddle.color;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;

    // 1. Fill the union
    ctx.beginPath();
    activePoints.forEach((p) => {
      const scale = p.scale || 1.0;
      const a = baseA * scale;
      const b = baseB * scale;
      ctx.moveTo(p.x + a, p.y);
      ctx.ellipse(p.x, p.y, a, b, 0, 0, Math.PI * 2);
    });
    ctx.fill();

    // 2. Stroke the boundary
    ctx.beginPath();
    activePoints.forEach((p1, i) => {
      const s1 = p1.scale || 1.0;
      const a1 = baseA * s1;
      const b1 = baseB * s1;
      let intersections = [];

      activePoints.forEach((p2, j) => {
        if (i === j) return;
        const s2 = p2.scale || 1.0;
        const a2 = baseA * s2;

        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

        const A_val = -2 * dx;
        const B_val = -2 * R * dy;
        const C_val =
          p1.x * p1.x -
          p2.x * p2.x +
          R * (p1.y * p1.y - p2.y * p2.y) -
          a1 * a1 +
          a2 * a2;

        const checkAndPush = (px, py) => {
          // USER REQUEST: check if points lie within any other ellipses. If so, remove.
          let insideOther = false;
          for (let k = 0; k < activePoints.length; k++) {
            if (k === i || k === j) continue;
            const pk = activePoints[k];
            const sk = pk.scale || 1.0;
            const ak = baseA * sk;
            const bk = baseB * sk;
            const val =
              Math.pow((px - pk.x) / ak, 2) + Math.pow((py - pk.y) / bk, 2);
            if (val < 1.0 - EPS) {
              insideOther = true;
              break;
            }
          }
          if (!insideOther) {
            intersections.push(Math.atan2((py - p1.y) / b1, (px - p1.x) / a1));
          }
        };

        if (Math.abs(B_val) > 0.01) {
          const k = -A_val / B_val;
          const m = -C_val / B_val;
          const dy1 = m - p1.y;
          const p_quad = 1 + R * k * k;
          const q_quad = -2 * p1.x + 2 * R * k * dy1;
          const r_quad = p1.x * p1.x + R * dy1 * dy1 - a1 * a1;
          const det = q_quad * q_quad - 4 * p_quad * r_quad;
          if (det >= 0) {
            const sqrtDet = Math.sqrt(det);
            checkAndPush(
              (-q_quad + sqrtDet) / (2 * p_quad),
              k * ((-q_quad + sqrtDet) / (2 * p_quad)) + m,
            );
            checkAndPush(
              (-q_quad - sqrtDet) / (2 * p_quad),
              k * ((-q_quad - sqrtDet) / (2 * p_quad)) + m,
            );
          }
        } else {
          const x = -C_val / A_val;
          const rhs = a1 * a1 * (1 - Math.pow((x - p1.x) / a1, 2));
          if (rhs >= 0) {
            const sqrtRhs = Math.sqrt(rhs / R);
            checkAndPush(x, p1.y + sqrtRhs);
            checkAndPush(x, p1.y - sqrtRhs);
          }
        }
      });

      if (intersections.length === 0) {
        let inside = false;
        for (let j = 0; j < activePoints.length; j++) {
          if (i === j) continue;
          const p2 = activePoints[j];
          const s2 = p2.scale || 1.0;
          const val =
            Math.pow((p1.x - p2.x) / (baseA * s2), 2) +
            Math.pow((p1.y - p2.y) / (baseB * s2), 2);
          if (val < 1.0 - EPS) {
            inside = true;
            break;
          }
        }
        if (!inside) {
          ctx.moveTo(p1.x + a1, p1.y);
          ctx.ellipse(p1.x, p1.y, a1, b1, 0, 0, Math.PI * 2);
        }
      } else {
        intersections.sort((a, b) => a - b);
        let unique = [];
        for (let k = 0; k < intersections.length; k++) {
          if (k === 0 || intersections[k] - intersections[k - 1] > 0.001) {
            unique.push(intersections[k]);
          }
        }

        for (let k = 0; k < unique.length; k++) {
          const start = unique[k];
          const end = unique[(k + 1) % unique.length];
          let diff = end - start;
          if (diff <= 0) diff += 2 * Math.PI;

          const mid = start + diff / 2;
          const mx = p1.x + a1 * Math.cos(mid);
          const my = p1.y + b1 * Math.sin(mid);

          let inside = false;
          for (let j = 0; j < activePoints.length; j++) {
            if (i === j) continue;
            const p2 = activePoints[j];
            const s2 = p2.scale || 1.0;
            const val =
              Math.pow((mx - p2.x) / (baseA * s2), 2) +
              Math.pow((my - p2.y) / (baseB * s2), 2);
            if (val < 1.0 - EPS) {
              inside = true;
              break;
            }
          }

          if (!inside) {
            const sx = p1.x + a1 * Math.cos(start);
            const sy = p1.y + b1 * Math.sin(start);
            ctx.moveTo(sx, sy);
            ctx.ellipse(p1.x, p1.y, a1, b1, 0, start, end);
          }
        }
      }
    });
    ctx.stroke();

    ctx.restore();
  });
}
