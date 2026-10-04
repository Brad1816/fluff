// ---------------------------------------------------------------------------
// The mop (plan): a wider-reaching sponge that doesn't scare fluffies.
//
// Fluff Mart, Care & Cleaning (MOP_PRICE), a tool. Hold it and sweep it over
// mess: everything within MOP_REACH of the mop head is cleaned at once
// (puddles, spilled food, a messy cage), faster than the sponge. It never
// bathes a fluffy - you can mop right round them and nobody minds.
// (Litterboxes still want the sponge or the Fluff-Bot.)
// ---------------------------------------------------------------------------

const MOP_PRICE = 40;
const MOP_REACH = 70; // px round the mop head
const MOP_SCRUB = 0.15; // a puddle point's size taken off a sweep

if (typeof TOOL_GRIPS !== "undefined") TOOL_GRIPS.mop = { ax: 0.5, ay: 0.92, turn: 0 };

function makeMopImage() {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 44;
  cv.height = 96;
  const c = cv.getContext("2d");
  if (!c) return null;
  // The handle
  c.fillStyle = "#b88a52";
  c.fillRect(20, 0, 5, 70);
  c.strokeStyle = "#7a5a32";
  c.lineWidth = 1;
  c.strokeRect(20, 0, 5, 70);
  // The head
  c.fillStyle = "#6c7a89";
  c.fillRect(8, 66, 29, 8);
  c.strokeRect(8, 66, 29, 8);
  // Strings
  c.strokeStyle = "#e9e4d8";
  c.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const x = 9 + i * 3.8;
    c.beginPath();
    c.moveTo(x, 74);
    c.quadraticCurveTo(x + (i % 2 ? 3 : -3), 84, x + (i - 3.5) * 1.2, 95);
    c.stroke();
  }
  return cv;
}

function mopImage() {
  if (typeof images === "undefined") return null;
  if (!images.mop) {
    const img = makeMopImage();
    if (img) images.mop = img;
  }
  return images.mop;
}

class Mop {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.angle = 0;
    this.cleanTimer = 0;
    this.whackTimer = 0;
  }

  update(dt) {
    if (this.whackTimer > 0) this.whackTimer -= dt;
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = Math.max(mouse.y + this.dragOffset.y, sceneTop(this.scene) + 10);
      this.cleanTimer -= dt;
      if (this.cleanTimer <= 0 && mopClean(this)) {
        this.cleanTimer = 0.2;
        this.whackTimer = 0.2;
      }
    }
  }

  onDrop() {
    this.angle = (Math.random() - 0.5) * 0.4;
    return handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  hitTest(px, py) {
    const img = mopImage();
    if (!img) return Math.hypot(px - this.x, py - this.y) < 30;
    return px >= this.x - img.width / 2 - 4 && px <= this.x + img.width / 2 + 4 && py >= this.y - img.height && py <= this.y + 4;
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return { classType: "Mop", id: this.id, x: this.x, y: this.y, scene: this.scene, angle: this.angle, currentCageId: this.currentCage ? this.currentCage.id : null };
  }

  deserialize(data) {
    this.angle = data.angle || 0;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = mopImage();
    if (!img) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.isDragging) {
      // Its reach, faintly
      ctx.strokeStyle = "rgba(180, 220, 255, 0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, MOP_REACH, MOP_REACH * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      drawHeldTool(ctx, img, "mop", (typeof _toolBump === "function" ? _toolBump(this.whackTimer) : 0) * 0.25);
      ctx.restore();
      return;
    }
    ctx.rotate(this.angle);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}

// Clean everything under the mop head. True if it cleaned anything.
function mopClean(mop) {
  let any = false;
  if (typeof puddles !== "undefined") {
    for (const p of puddles) {
      if (p.scene !== mop.scene) continue;
      for (let j = p.points.length - 1; j >= 0; j--) {
        const pt = p.points[j];
        if (Math.hypot(pt.x - mop.x, (pt.y - mop.y) * 2) > MOP_REACH) continue;
        p.shrinkPoint(j, MOP_SCRUB, 0.1);
        any = true;
      }
    }
  }
  if (typeof objects !== "undefined") {
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      // Spilled food on the floor (FeedBot.js)
      if (o.scene === mop.scene && typeof Bowl !== "undefined" && o instanceof Bowl && o.type === "spill" && !o.isDragging && Math.hypot(o.x - mop.x, (o.y - mop.y) * 2) <= MOP_REACH) {
        objects.splice(i, 1);
        any = true;
      }
    }
    // A messy cage: twice the sponge's wipe (CageLife.js)
    if (typeof cleanCageMess === "function" && cleanCageMess(mop.x, mop.y, mop.scene)) {
      cleanCageMess(mop.x, mop.y, mop.scene);
      any = true;
    }
  }
  return any;
}

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({ name: "Mop", desc: "Cleans a wide patch of mess at once - puddles, spills, a messy cage - and never gives anyone a bath, so nobody's scared of it.", cost: MOP_PRICE, isItem: "mop" });
}
if (typeof STORE_AISLES !== "undefined") {
  const care = STORE_AISLES.find((a) => a.id === "care");
  if (care && !care.items.includes("mop")) care.items.splice(care.items.indexOf("sponge") + 1, 0, "mop");
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push({
    sellType: "mop",
    is: (o) => o instanceof Mop,
    inCage: "never",
    sellable: true,
    icon: "mop", // (drawn at load, below)
    tool: {
      className: "Mop",
      create: (scene) => new Mop(scene),
      key: "mop",
      name: "Mop",
      desc: "Sweep it over mess to clean a wide patch at once. It never bathes anyone, so nobody's scared of it.",
      image: () => mopImage(),
    },
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.Mop = (d) => new Mop(d.scene);
mopImage(); // (the shop button's picture)
