// ---------------------------------------------------------------------------
// The cautery iron (Fluff Mart, Surgery & Restraint, $120): the harsh way
// to stop a fluffy bleeding, instead of the suture kit.
//
// Click a bleeding fluffy with it (or "Burn it shut" in the surgery screen,
// which asks first) and the wound is burnt shut. It never runs out (the kit
// has 4 stitches and costs $1000), but:
//   - it's agony: it screams, loses CAUTERY_HEALTH health and a lot of
//     happiness, and is knocked flat
//   - it's you hurting it: it fears you, remembers "Burnt with the hot
//     iron", and anyone watching is frightened too (Memory.js "cautery")
//   - no thanks for it: unlike stitches, no affection
//   - it leaves a burn scar for life where the wound was (Scars.js "burn",
//     never skipped even with a full set of scars): it shows on its body,
//     goes in its story, and costs it at shows and in price like any scar
// Where the wound was is f.lastWound (Surgery.js knifeCut sets it when a
// part comes off); anything else (a bite, a tack) burns its side.
// The picture is drawn here (makeIronImage): its tip glows when it's in
// your hand.
// ---------------------------------------------------------------------------

const CAUTERY_HEALTH = 8; // health lost to the burn
const CAUTERY_UNHAPPY = 0.2; // happiness lost

function makeIronImage(hot) {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 22;
  cv.height = 70;
  const c = cv.getContext("2d");
  // Tip (top), glowing when hot
  if (hot) {
    const g = c.createRadialGradient(11, 6, 1, 11, 6, 11);
    g.addColorStop(0, "rgba(255, 240, 160, 1)");
    g.addColorStop(0.4, "rgba(255, 120, 30, 0.9)");
    g.addColorStop(1, "rgba(255, 60, 0, 0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 22, 22);
  }
  c.fillStyle = hot ? "#ff7a2a" : "#5b5f66";
  c.beginPath();
  c.moveTo(11, 1);
  c.lineTo(15, 12);
  c.lineTo(7, 12);
  c.closePath();
  c.fill();
  // Shaft
  c.fillStyle = hot ? "#a9665a" : "#9aa1a9";
  c.fillRect(8, 11, 6, 22);
  c.fillStyle = "#c9ced4";
  c.fillRect(6, 31, 10, 4); // collar
  // Wooden handle
  c.fillStyle = "#8a5a32";
  c.strokeStyle = "#4b2f18";
  c.lineWidth = 1.5;
  if (c.roundRect) {
    c.beginPath();
    c.roundRect(4, 35, 14, 33, 5);
    c.fill();
    c.stroke();
  } else {
    c.fillRect(4, 35, 14, 33);
  }
  c.strokeStyle = "rgba(60, 35, 15, 0.5)";
  for (const y of [44, 52, 60]) {
    c.beginPath();
    c.moveTo(5, y);
    c.lineTo(17, y);
    c.stroke();
  }
  return cv;
}

function ironImage(hot = false) {
  if (typeof images === "undefined") return null;
  const key = hot ? "cautery_iron_hot" : "cautery_iron";
  if (!images[key]) {
    const img = makeIronImage(hot);
    if (img) images[key] = img;
  }
  return images[key];
}

// Burn the wound shut. Returns true if it did (only a bleeding fluffy).
function cauterizeWound(f, iron = null) {
  if (!f || !f.isAlive || !(f.bleedingTimer > 0)) return false;
  f.bleedingTimer = 0;
  if (typeof woundBurnt === "function") woundBurnt(f); // (burnt clean: it won't go bad, Recovery.js)
  const at = f.lastWound || "body";
  f.lastWound = null;
  // The burn
  f.health = Math.max(1, f.health - CAUTERY_HEALTH);
  f.changeHappiness(-CAUTERY_UNHAPPY);
  if (typeof playSound === "function") playSound("taser", 0.5, 0.6); // (a hiss)
  if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
    for (let i = 0; i < 4; i++) poofs.push(new Poof(f.x + (Math.random() - 0.5) * 30, f.y - 10 - Math.random() * 20, f.scene, "rgba(170, 170, 170, 0.8)", true));
  }
  // Terrified of the iron from now on - and so are the ones watching (Fears.js)
  if (typeof learnFearOfFire === "function") learnFearOfFire(f);
  // You did it (Memory.js), and it shows for good (Scars.js)
  if (typeof notifyViolence === "function") notifyViolence(f, false, "cautery");
  const day = typeof getDayNumber === "function" ? getDayNumber() : 1;
  if (typeof addScar === "function") addScar(f, "burn", `Wound burnt shut with the hot iron on day ${day}`, { at, always: true });
  f.traumaMemory.push({ type: "burn", timer: 30 + Math.random() * 60 });
  // It screams and goes down
  if (f.tooYoungToSpeak()) f.speak(getDialogue(["CAUTERY", "CHIRPY"], f), true, true);
  else f.speak(getDialogue(["CAUTERY", "DEFAULT"], f), true);
  if (typeof fluffySound === "function") fluffySound(f, "scree");
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 6.0;
  f.initBehavior("FLUFFY_KNOCKED_DOWN");
  f.stateTimer = 0.8;
  if (iron) iron.whackTimer = 0.25;
  return true;
}

class CauteryIron {
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
  }

  update(dt) {
    if (this.whackTimer > 0) this.whackTimer -= dt;
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = Math.max(mouse.y + this.dragOffset.y, sceneTop(this.scene) + 10);
    }
    const img = ironImage(false);
    if (img) handleGenericCageContainment(this, img.width, img.height);
  }

  onDrop() {
    this.angle = Math.random() * Math.PI;
    return handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  hitTest(px, py) {
    const img = ironImage(false);
    if (!img) return false;
    const dx = px - this.x;
    const dy = py - this.y;
    const cos = Math.cos(-this.angle);
    const sin = Math.sin(-this.angle);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return rx >= -img.width / 2 - 4 && rx <= img.width / 2 + 4 && ry >= -img.height && ry <= 0;
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return { classType: "CauteryIron", id: this.id, x: this.x, y: this.y, scene: this.scene, angle: this.angle, currentCageId: this.currentCage ? this.currentCage.id : null };
  }

  deserialize(data) {
    this.angle = data.angle || 0;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = ironImage(this.isDragging);
    if (!img) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.isDragging) {
      // In your hand: the hot tip on the pointer, a wisp of smoke now and then
      drawHeldTool(ctx, img, "cautery_iron", -_toolBump(this.whackTimer, 0.25) * 0.3);
      ctx.restore();
      if (Math.random() < 0.04 && typeof poofs !== "undefined") poofs.push(new Poof(this.x, this.y - 6, this.scene, "rgba(200, 200, 200, 0.5)", true));
      return;
    }
    ctx.rotate(this.angle);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}

// Make the pictures as soon as the page is up, for the shop shelf
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("load", () => {
    ironImage(false);
    ironImage(true);
  });
}
