// ---------------------------------------------------------------------------
// The lawn mower (a tool, Fluff Mart's Hardware aisle): hold it and sweep
// it over long grass in the garden, the river, the backyard or the park.
// Every tuft it passes over is cut down to stubble (MOW_HEIGHT) - tidy, but
// it's grass the fluffies outside can't eat for a while. It grows back as
// grass does (Grass.js: about a step every couple of game hours, faster in
// spring and rain, slowly in winter).
// The picture is drawn here (makeMowerImage), not loaded from a file.
// ---------------------------------------------------------------------------

const MOW_RADIUS = 55; // px around the mower's blades
const MOW_HEIGHT = 0.15; // what's left (grass grows 0 -> 2)
const MOW_EVERY = 0.1; // seconds between cuts while held

function makeMowerImage() {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 46;
  cv.height = 60;
  const c = cv.getContext("2d");
  // Handle (up to the top right)
  c.strokeStyle = "#333";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(16, 40);
  c.lineTo(38, 4);
  c.moveTo(30, 40);
  c.lineTo(44, 10);
  c.stroke();
  c.strokeStyle = "#222";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(36, 5);
  c.lineTo(45, 9);
  c.stroke();
  // Deck
  c.fillStyle = "#c0392b";
  c.strokeStyle = "#5a1a14";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(3, 50);
  c.lineTo(6, 38);
  c.lineTo(36, 36);
  c.lineTo(41, 50);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#e5e5e5";
  c.fillRect(14, 39, 14, 4); // the engine cap
  // Wheels
  c.fillStyle = "#1d1d1d";
  for (const x of [9, 35]) {
    c.beginPath();
    c.arc(x, 52, 6, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#999";
  for (const x of [9, 35]) {
    c.beginPath();
    c.arc(x, 52, 2, 0, Math.PI * 2);
    c.fill();
  }
  return cv;
}

function mowerImage() {
  if (typeof images !== "undefined" && !images.lawn_mower) {
    const img = makeMowerImage();
    if (img) images.lawn_mower = img;
  }
  return typeof images !== "undefined" ? images.lawn_mower : null;
}

// Cut the grass around (x, y). Returns how many tufts it cut.
function mowAround(scene, x, y, r = MOW_RADIUS) {
  if (typeof objects === "undefined" || typeof Grass === "undefined") return 0;
  let cut = 0;
  for (const g of objects) {
    if (!(g instanceof Grass) || g.scene !== scene || g.growth <= MOW_HEIGHT) continue;
    if (Math.hypot(g.x - x, (g.y - y) * 2) > r) continue; // (flat on the ground: half as far up and down)
    g.growth = MOW_HEIGHT;
    g.spawnTimer = 0;
    cut++;
    if (typeof poofs !== "undefined" && typeof Poof !== "undefined" && Math.random() < 0.6) poofs.push(new Poof(g.x + (Math.random() - 0.5) * 20, g.y - 8, scene, "#6abf4b"));
  }
  return cut;
}

class LawnMower {
  constructor(scene = "OUTDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.angle = 0;
    this.mowTimer = 0;
    this.whackTimer = 0;
    this.cutTotal = 0;
  }

  update(dt) {
    if (this.whackTimer > 0) this.whackTimer -= dt;
    if (!this.isDragging) return;
    this.x = mouse.x + this.dragOffset.x;
    this.y = Math.max(mouse.y + this.dragOffset.y, sceneTop(this.scene) + 10);
    this.mowTimer -= dt;
    if (this.mowTimer <= 0) {
      this.mowTimer = MOW_EVERY;
      const n = mowAround(this.scene, this.x, this.y);
      if (n) {
        this.cutTotal += n;
        this.whackTimer = 0.15;
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
    const img = mowerImage();
    if (!img) return false;
    return px >= this.x - img.width / 2 && px <= this.x + img.width / 2 && py >= this.y - img.height && py <= this.y;
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return { classType: "LawnMower", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: this.currentCage ? this.currentCage.id : null };
  }

  deserialize() {}

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = mowerImage();
    if (!img) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.isDragging) {
      // In your hand: the deck on the pointer, buzzing as it cuts
      if (this.whackTimer > 0) ctx.translate((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
      drawHeldTool(ctx, img, "lawn_mower");
      // How far it reaches
      ctx.strokeStyle = "rgba(106, 191, 75, 0.35)";
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, MOW_RADIUS, MOW_RADIUS * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.rotate(this.angle);
      ctx.drawImage(img, -img.width / 2, -img.height);
    }
    ctx.restore();
  }
}

// Make the picture as soon as the page is up, for the shop shelf
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("load", () => mowerImage());
