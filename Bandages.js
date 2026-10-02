// ---------------------------------------------------------------------------
// Aftercare (Recovery.js): bandages, limping, and setbacks.
//
// Bandages (Fluff Mart, Care & Cleaning, $30, BANDAGE_USES wraps): click a
// fluffy recovering from surgery (not still bleeding - stitch it or burn it
// shut first) and its wound is wrapped: what's left of the infection risk
// is halved again (BANDAGE_RISK), it's grateful, and it shows (a white wrap
// round its middle) till it's healed.
// Taking it easy: a fluffy recovering from surgery moves slower
// (RECOVERY_SLOW), more so with a fever.
// Setbacks (recoverySetback): knocked about while it's healing - hit by
// another fluffy, or a hard landing (thrown) - the wound opens a little:
// more risk (SETBACK_RISK) and a longer recovery (SETBACK_HOURS).
// The picture of the roll is drawn here (makeBandageImage).
// ---------------------------------------------------------------------------

const BANDAGE_USES = 6;
const BANDAGE_RISK = 0.5;
const BANDAGE_PRICE = 30;
const RECOVERY_SLOW = 0.7; // speed, x, while recovering
const INFECTION_SLOW = 0.55; // ...and with a fever
const SETBACK_RISK = 0.08; // added to what's left
const SETBACK_HOURS = 3;

function makeBandageImage() {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 46;
  cv.height = 40;
  const c = cv.getContext("2d");
  c.lineWidth = 2;
  c.strokeStyle = "#8b8178";
  // The tail unrolled
  c.fillStyle = "#f6f2ea";
  c.beginPath();
  c.moveTo(24, 28);
  c.quadraticCurveTo(34, 36, 44, 30);
  c.lineTo(44, 38);
  c.quadraticCurveTo(32, 40, 22, 36);
  c.closePath();
  c.fill();
  c.stroke();
  // The roll
  c.beginPath();
  c.ellipse(18, 20, 15, 15, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = "#e5ddd0";
  c.beginPath();
  c.ellipse(18, 20, 6, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // A red cross
  c.fillStyle = "#e0413a";
  c.fillRect(30, 6, 12, 4);
  c.fillRect(34, 2, 4, 12);
  return cv;
}

function bandageImage() {
  if (typeof images === "undefined") return null;
  if (!images.bandages) {
    const img = makeBandageImage();
    if (img) images.bandages = img;
  }
  return images.bandages;
}

// Wrap its wound. Returns true if it did (a message says why not).
function applyBandage(f, roll = null) {
  const say = (m) => typeof addUIMessage === "function" && addUIMessage(m);
  if (!f || !f.isAlive) return false;
  if (f.bleedingTimer > 0) {
    say("It's still bleeding - stitch it or burn it shut first.");
    return false;
  }
  if (!(typeof isRecovering === "function" && isRecovering(f))) {
    say(typeof hasInfection === "function" && hasInfection(f) ? "The wound's already infected - it needs the vet now." : "It hasn't a fresh wound to bandage.");
    return false;
  }
  if (f.recovery.bandaged) {
    say("It's already bandaged.");
    return false;
  }
  if (roll && !(roll.charges > 0)) return false;
  f.recovery.bandaged = true;
  f.recovery.risk *= BANDAGE_RISK;
  if (typeof giveAffection === "function") giveAffection(f, "patched");
  if (roll) {
    roll.whackTimer = 0.2;
    roll.charges--;
    if (roll.charges <= 0) {
      if (typeof removeToolFromToolbox === "function") removeToolFromToolbox(roll);
      const i = objects.indexOf(roll);
      if (i > -1) objects.splice(i, 1);
      if (typeof poofs !== "undefined" && typeof Poof !== "undefined") poofs.push(new Poof(roll.x, roll.y, roll.scene));
    }
  }
  return true;
}

// Horse.updateSpeed: taking it easy while it heals
function recoverySpeed(f) {
  if (typeof hasInfection === "function" && hasInfection(f)) return INFECTION_SLOW;
  return typeof isRecovering === "function" && isRecovering(f) ? RECOVERY_SLOW : 1;
}

// Knocked about while healing (Horse.performAttack's target, a hard landing)
function recoverySetback(f) {
  if (!(typeof isRecovering === "function" && isRecovering(f))) return false;
  f.recovery.risk = Math.min(0.9, f.recovery.risk + SETBACK_RISK * (f.recovery.bandaged ? 0.5 : 1));
  f.recovery.until += SETBACK_HOURS * HOUR_LENGTH;
  f.recovery.setbacks = (f.recovery.setbacks || 0) + 1;
  return true;
}

// HorseRenderer: a white wrap round its middle while it's bandaged
function drawBandage(ctx, renderer, layout) {
  const f = renderer && renderer.horse;
  if (!f || !f.isAlive || !f.recovery || !f.recovery.bandaged || !layout || !layout.torso) return;
  const r = layout.torso;
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.angle || 0);
  const w = r.w;
  const h = r.h;
  ctx.fillStyle = "rgba(250, 247, 240, 0.95)";
  ctx.strokeStyle = "rgba(140, 130, 120, 0.8)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-w * 0.1, -h * 0.42, w * 0.2, h * 0.84, 4);
  else ctx.rect(-w * 0.1, -h * 0.42, w * 0.2, h * 0.84);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(170, 160, 150, 0.6)";
  for (let i = 1; i < 4; i++) {
    const x = -w * 0.1 + (i * w * 0.2) / 4;
    ctx.beginPath();
    ctx.moveTo(x, -h * 0.4);
    ctx.lineTo(x + w * 0.03, h * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

class Bandages {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.angle = 0;
    this.whackTimer = 0;
    this.charges = BANDAGE_USES;
  }

  update(dt) {
    if (this.whackTimer > 0) this.whackTimer -= dt;
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = Math.max(mouse.y + this.dragOffset.y, sceneTop(this.scene) + 10);
    }
    const img = bandageImage();
    if (img) handleGenericCageContainment(this, img.width, img.height);
  }

  onDrop() {
    this.angle = (Math.random() - 0.5) * 0.6;
    return handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  hitTest(px, py) {
    const img = bandageImage();
    if (!img) return false;
    return px >= this.x - img.width / 2 - 4 && px <= this.x + img.width / 2 + 4 && py >= this.y - img.height - 4 && py <= this.y + 4;
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return { classType: "Bandages", id: this.id, x: this.x, y: this.y, scene: this.scene, charges: this.charges, currentCageId: this.currentCage ? this.currentCage.id : null };
  }

  deserialize(data) {
    this.charges = typeof data.charges === "number" ? data.charges : BANDAGE_USES;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = bandageImage();
    if (!img) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.isDragging) {
      drawHeldTool(ctx, img, "bandages", -_toolBump(this.whackTimer, 0.2) * 0.3);
      ctx.restore();
      return;
    }
    ctx.rotate(this.angle);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}

if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({
    name: "Bandages",
    desc: `Wrap a fluffy's wound after surgery (once it's stopped bleeding): it's half as likely to get infected, and grateful. ${BANDAGE_USES} wraps.`,
    cost: BANDAGE_PRICE,
    isItem: "bandages",
  });
}

// Make the picture as soon as the page is up, for the shop shelf
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("load", () => bandageImage());
