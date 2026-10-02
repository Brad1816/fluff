// ---------------------------------------------------------------------------
// Lasting injuries from being thrown.
//
// A hard landing (Horse.handleThrowImpact) can do more than bruise: the
// harder the throw, the likelier (THROW_INJURY_PER_SPEED, at most
// THROW_INJURY_MAX) that a leg, a wing or the horn is mangled for good -
// f.limbState[part] = "mangled" (saved), part one of leg_0..leg_3,
// leftWing, rightWing, horn. Strong wings soften it like the fall (Flight.js
// wingDamageFactor).
//   - A mangled leg is drawn bent and bruised; it walks slower (each counts
//     as half a missing leg, Horse.updateSpeed).
//   - A mangled wing droops, torn: it can't flap any more (Flight.js canFly).
//   - A broken horn is a jagged stump.
//   - It sells for less (MANGLED_PRICE each), and it's in its story.
// It never heals; cutting the limb off (surgery) ends it, of course.
// The magnifying glass lists them ("Injuries").
// ---------------------------------------------------------------------------

const THROW_INJURY_PER_SPEED = 1 / 3500; // chance per px/s over the hurting speed (a fair throw ~1 in 8)
const THROW_INJURY_MAX = 0.3;
const MANGLED_PRICE = 0.85;
const LIMB_PART_WORDS = {
  leg_0: "a front leg",
  leg_1: "a front leg",
  leg_2: "a back leg",
  leg_3: "a back leg",
  leftWing: "its left wing",
  rightWing: "its right wing",
  horn: "its horn",
};

function isMangled(f, part) {
  return !!(f && f.limbState && f.limbState[part] === "mangled");
}

function mangledParts(f) {
  if (!f || !f.limbState) return [];
  return Object.keys(f.limbState).filter((k) => f.limbState[k] === "mangled" && _partStillThere(f, k));
}

function _partStillThere(f, part) {
  if (!f.limbs) return false;
  if (part.startsWith("leg_")) return !!f.limbs.legs[parseInt(part.slice(4), 10)];
  return !!f.limbs[part];
}

function mangledLegCount(f) {
  return mangledParts(f).filter((p) => p.startsWith("leg_")).length;
}

// Surgery took the part off: nothing left to be mangled (HorseAnatomy.amputate)
function forgetMangled(f, part) {
  if (f && f.limbState && part) delete f.limbState[part];
}

// Horse.handleThrowImpact: a chance of lasting harm. Returns the part or null.
function injureFromThrow(f, speed, minSpeed) {
  if (!f || !f.isAlive || !f.limbs) return null;
  const soften = typeof wingDamageFactor === "function" ? wingDamageFactor(f) : 1;
  const chance = Math.min(THROW_INJURY_MAX, Math.max(0, speed - minSpeed) * THROW_INJURY_PER_SPEED) * soften;
  if (!(Math.random() < chance)) return null;
  // What could break: legs most often
  const options = [];
  for (let i = 0; i < 4; i++) if (f.limbs.legs[i] && !isMangled(f, `leg_${i}`)) options.push([`leg_${i}`, 3]);
  for (const w of ["leftWing", "rightWing"]) if (f.limbs[w] && !isMangled(f, w)) options.push([w, 2]);
  if (f.limbs.horn && !isMangled(f, "horn")) options.push(["horn", 2]);
  if (!options.length) return null;
  let r = Math.random() * options.reduce((s, o) => s + o[1], 0);
  let part = options[0][0];
  for (const [p, w] of options) {
    r -= w;
    if (r <= 0) {
      part = p;
      break;
    }
  }
  if (!f.limbState || typeof f.limbState !== "object") f.limbState = {};
  f.limbState[part] = "mangled";
  const name = fluffyDisplayName(f);
  const what = LIMB_PART_WORDS[part] || part;
  const text = part === "horn" ? `${name}'s horn snapped on landing` : `${name} mangled ${what} landing`;
  if (f.adopted && typeof addUIMessage === "function") addUIMessage(`${text}. It won't ever be right again.`);
  if (typeof recordStory === "function") recordStory("scarred", f, { x: part === "horn" ? "a broken horn from being thrown" : `${what.replace(/^its /, "")} mangled when thrown` });
  if (typeof noteTitleHarm === "function") noteTitleHarm(f, 2, "mangled"); // (Titles.js)
  if (typeof recordFluffy === "function") recordFluffy(f);
  return part;
}

// HorseGenetics price
function mangledPriceMultiplier(f) {
  return Math.pow(MANGLED_PRICE, mangledParts(f).length);
}

// Magnifying glass: [text, tone] or null
function describeInjuries(f) {
  const parts = mangledParts(f);
  if (!parts.length) return null;
  const words = parts.map((p) => {
    if (p === "horn") return "broken horn";
    if (p === "leftWing" || p === "rightWing") return `mangled ${p === "leftWing" ? "left" : "right"} wing (can't flap)`;
    return `mangled ${LIMB_PART_WORDS[p].replace(/^a /, "")}`;
  });
  return [`${words.join(", ")} - for good`, "bad"];
}

// ---- Drawing (HorseRenderer) ----

// Draw a leg with drawPart, bent at an odd angle and a bit short
function drawMangledLeg(drawPart, img, rect, ctx) {
  const a = rect.angle;
  const h = rect.h;
  rect.angle = a + 0.32;
  rect.h = h * 0.84;
  drawPart(img, rect);
  // A swollen, bruised knee and a crooked line
  ctx.save();
  ctx.translate(rect.x, rect.y);
  ctx.rotate(rect.angle);
  const w = rect.w;
  ctx.fillStyle = "rgba(95, 40, 90, 0.6)";
  ctx.beginPath();
  ctx.ellipse(0, rect.h * 0.5, w * 0.42, rect.h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(60, 20, 30, 0.75)";
  ctx.lineWidth = Math.max(1, w * 0.07);
  ctx.beginPath();
  ctx.moveTo(-w * 0.28, rect.h * 0.42);
  ctx.lineTo(w * 0.05, rect.h * 0.52);
  ctx.lineTo(-w * 0.12, rect.h * 0.6);
  ctx.lineTo(w * 0.25, rect.h * 0.66);
  ctx.stroke();
  ctx.restore();
  rect.angle = a;
  rect.h = h;
}

// The wing: drooping and torn (ctx is already at the wing's anchor, scaled)
function drawMangledWing(ctx, wingImg, yAnchorFrac) {
  const wingW = wingImg.width;
  const wingH = wingImg.height;
  ctx.save();
  ctx.rotate(0.85); // hangs down
  ctx.scale(0.85, 0.8);
  ctx.drawImage(wingImg, 0, -wingH * yAnchorFrac);
  // Torn, bloodied edges
  ctx.strokeStyle = "rgba(70, 25, 30, 0.8)";
  ctx.lineWidth = Math.max(1.5, wingW * 0.03);
  ctx.beginPath();
  const y0 = -wingH * yAnchorFrac;
  for (let i = 0; i < 3; i++) {
    const x = wingW * (0.45 + i * 0.17);
    ctx.moveTo(x, y0 + wingH * 0.2);
    ctx.lineTo(x - wingW * 0.06, y0 + wingH * 0.45);
    ctx.lineTo(x + wingW * 0.03, y0 + wingH * 0.6);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(120, 20, 25, 0.35)";
  ctx.beginPath();
  ctx.ellipse(wingW * 0.2, y0 + wingH * 0.75, wingW * 0.12, wingH * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// The horn: only its stump, with a jagged top (draws at x, y like drawImage)
function drawBrokenHorn(ctx, hornImg, x, y) {
  const w = hornImg.width;
  const h = hornImg.height;
  const cut = h * 0.55; // the top 55% is gone
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 2, y + cut, w + 4, h - cut + 2);
  ctx.clip();
  ctx.drawImage(hornImg, x, y);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "rgba(70, 50, 40, 0.85)";
  ctx.lineWidth = Math.max(1, w * 0.08);
  ctx.beginPath();
  const n = 4;
  for (let i = 0; i <= n; i++) {
    const px = x + w * 0.15 + (w * 0.7 * i) / n;
    const py = y + cut + (i % 2 ? h * 0.06 : 0);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}
