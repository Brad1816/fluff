// ---------------------------------------------------------------------------
// The milk stand (players' request, "milkbag"): a mare kept on a stand as a
// living feeder. Fluff Mart, Hardware (MILK_STAND_PRICE).
//
// Set a grown mare down on it and she's strapped in (it's a kind of rack:
// ImmobilizationBoard). While she's on it:
//   - she stays in milk as long as she's fed (lactatingTimer kept up) and
//     her milk comes back fast (a feed every MILK_STAND_REFILL seconds, up to
//     MILK_STAND_MAX), each costing her a little food
//   - ANY foal in the room can drink from her, whenever it likes, three at a
//     time (MILK_STAND_SLOTS) - she can't turn one away, not even an alicorn
//     (HorseFamily.attemptFeedFromMare -> milkStandNurse)
//   - she can't walk to food: the stand's trough feeds her (MILK_STAND_TROUGH
//     portions; right-click / long-press the stand to fill it,
//     MILK_STAND_FILL_COST). An empty trough and she goes hungry, and her
//     milk dries up when she's starving
//   - she's miserable (MILK_STAND_SAD a game hour), and she remembers it
// Take her off by picking her up. Saved: the trough (serialize).
// ---------------------------------------------------------------------------

const MILK_STAND_PRICE = 350;
const MILK_STAND_TROUGH = 12; // portions
const MILK_STAND_FILL_COST = 8;
const MILK_STAND_REFILL = 0.15 * HOUR_LENGTH; // game seconds per feed of milk
const MILK_STAND_MAX = 6;
const MILK_STAND_SLOTS = 3;
const MILK_STAND_SAD = 0.08;
const MILK_STAND_MILK_HUNGER = 0.03; // her hunger per feed made
const milkStandTicker = new Ticker(1);

if (typeof MEMORY_TEXT !== "undefined") MEMORY_TEXT.milk_stand = "Strapped to the milk stand";
if (typeof MEMORY_HARM_TYPES !== "undefined") MEMORY_HARM_TYPES.add("milk_stand");

function drawMilkStandShape(c, x, y, k = 1, portions = 1, inUse = false) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  // Legs and the bed of the stand
  c.fillStyle = "#7d8790";
  c.fillRect(-92, 6, 8, 34);
  c.fillRect(84, 6, 8, 34);
  c.fillStyle = "#a9b3bb";
  c.fillRect(-96, -2, 192, 12);
  c.strokeStyle = "#555e66";
  c.lineWidth = 2;
  c.strokeRect(-96, -2, 192, 12);
  // The frame over her back
  c.strokeStyle = "#555e66";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(-70, -2);
  c.lineTo(-70, -78);
  c.lineTo(50, -78);
  c.lineTo(50, -2);
  c.stroke();
  // The trough at the front (her end)
  c.fillStyle = "#6b5236";
  c.beginPath();
  c.moveTo(-96, -26);
  c.lineTo(-120, -26);
  c.lineTo(-116, -2);
  c.lineTo(-100, -2);
  c.closePath();
  c.fill();
  c.fillStyle = "#c79a5a";
  const fill = Math.max(0, Math.min(1, portions));
  if (fill > 0) c.fillRect(-118, -26 + 22 * (1 - fill), 20, 22 * fill);
  // A milk drop sign
  c.fillStyle = inUse ? "#ffffff" : "#e3e8ec";
  c.beginPath();
  c.moveTo(70, -60);
  c.quadraticCurveTo(80, -46, 70, -40);
  c.quadraticCurveTo(60, -46, 70, -60);
  c.fill();
  c.restore();
}

class MilkStand extends ImmobilizationBoard {
  constructor(scene = "INDOORS") {
    super(scene);
    this.w = 200;
    this.h = 90;
    this.trough = MILK_STAND_TROUGH;
  }
  // Only a grown mare goes on (Horse.onDrop)
  accepts(f) {
    return !!(f && f.isAlive && f.gender === "female" && f.growth >= 1);
  }
  serialize() {
    const d = super.serialize();
    d.classType = "MilkStand";
    d.trough = this.trough;
    return d;
  }
  deserialize(data) {
    super.deserialize(data);
    this.trough = typeof data.trough === "number" ? data.trough : MILK_STAND_TROUGH;
  }
  drawOffScreen(ctx) {
    this.w = 200;
    this.h = 90;
    drawMilkStandShape(ctx, this.x, this.y + 6, 1, this.trough / MILK_STAND_TROUGH, !!this.securedFluffy);
  }
}

function onMilkStand(mare) {
  return !!(mare && typeof MilkStand !== "undefined" && mare.placedOn instanceof MilkStand);
}

// HorseFamily.attemptFeedFromMare: true/false for a mare on the stand, null otherwise
function milkStandNurse(mare, foal) {
  if (!onMilkStand(mare)) return null;
  if (!mare.isAlive || mare.scene !== foal.scene || foal.currentCage) return false;
  if (typeof cantNurse === "function" && cantNurse(foal)) {
    foal.milkCooldown = 3.0;
    return false;
  }
  if (!(mare.milkCharges > 0) || !(mare.lactatingTimer > 0)) {
    foal.milkCooldown = 3.0;
    return false;
  }
  // Three at a time
  if (mare._nursing) {
    const now = typeof timePlayed === "number" ? timePlayed : 0;
    const on = Object.entries(mare._nursing).filter(([id, t]) => t > now && String(foal.id) !== id).length;
    if (on >= MILK_STAND_SLOTS) {
      foal.milkCooldown = 1.5;
      return false;
    }
  }
  mare.milkCharges--;
  foal.hunger = 1.0;
  if (typeof startNursing === "function") startNursing(mare, foal);
  if (typeof foal.addPreferredMilkSource === "function") foal.addPreferredMilkSource(mare.id, "HORSE");
  if (typeof getDialogue === "function") {
    foal.speak(getDialogue("DRINK_MILKIES", foal, mare), false, true);
    if (Math.random() < 0.3 && mare.happiness > WAN_DIE_THRESHOLD && mare.canSee()) mare.speak(getDialogue(["MILK_STAND", foal.motherId === mare.id ? "OWN" : "FOAL"], mare, foal));
  }
  return true;
}

// Fill the trough (right-click / long-press)
function fillMilkStand(stand) {
  if (!stand) return false;
  if (stand.trough >= MILK_STAND_TROUGH) {
    if (typeof addUIMessage === "function") addUIMessage("The stand's trough is full.");
    return true;
  }
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < MILK_STAND_FILL_COST) {
    if (typeof addUIMessage === "function") addUIMessage(`Filling it costs $${MILK_STAND_FILL_COST}.`);
    return true;
  }
  if (!free) money -= MILK_STAND_FILL_COST;
  stand.trough = MILK_STAND_TROUGH;
  if (typeof addUIMessage === "function") addUIMessage(`Trough filled ($${MILK_STAND_FILL_COST}).`);
  return true;
}

function updateMilkStands(dt) {
  const step = milkStandTicker.step(dt);
  if (!step || typeof objects === "undefined") return;
  const hours = step / HOUR_LENGTH;
  for (const s of objects) {
    if (!(s instanceof MilkStand)) continue;
    const m = s.securedFluffy;
    if (!m || !m.isAlive || m.placedOn !== s) continue;
    // Strapped on: she remembers it (once)
    if (!m._standSince) {
      m._standSince = timePlayed;
      if (typeof rememberPlayerEvent === "function") rememberPlayerEvent(m, "milk_stand");
      if (typeof changePlayerFear === "function") changePlayerFear(m, 0.04);
      if (!m.tooYoungToSpeak() && typeof getDialogue === "function") m.speak(getDialogue(["MILK_STAND", "ON"], m), true);
    }
    // The trough feeds her
    if (m.hunger < 0.75 && s.trough > 0) {
      s.trough--;
      m.hunger = Math.min(1, m.hunger + 0.35);
    }
    // In milk while she's fed; the milk comes back fast
    if (m.hunger > 0.2) {
      m.lactatingTimer = Math.max(m.lactatingTimer || 0, 120);
      m._standMilk = (m._standMilk || 0) + step;
      while (m._standMilk >= MILK_STAND_REFILL) {
        m._standMilk -= MILK_STAND_REFILL;
        if ((m.milkCharges || 0) < MILK_STAND_MAX && m.hunger > 0.4) {
          m.milkCharges = (m.milkCharges || 0) + 1;
          m.hunger = Math.max(0, m.hunger - MILK_STAND_MILK_HUNGER);
        }
      }
    }
    m.changeHappiness(-MILK_STAND_SAD * hours, "On the milk stand");
    if (m.scene === currentScene && Math.random() < 0.01 * step && !m.tooYoungToSpeak() && m.currentStateKey !== "SLEEPING" && typeof getDialogue === "function") {
      m.speak(getDialogue(["MILK_STAND", s.trough > 0 ? "SAD" : "HUNGRY"], m));
    }
  }
  // Off the stand: forget it was on
  for (const f of typeof fluffies !== "undefined" ? fluffies : []) if (f._standSince && !onMilkStand(f)) f._standSince = null;
}
registerSystem("milkStands", updateMilkStands, 126);

function describeMilkStand(f) {
  if (!onMilkStand(f)) return null;
  return [`On the milk stand · ${f.milkCharges || 0} feeds of milk · trough ${f.placedOn.trough}/${MILK_STAND_TROUGH}`, "bad"];
}
if (typeof INSPECT_ROWS !== "undefined") INSPECT_ROWS.push(["Milk stand", "describeMilkStand"]);

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({ name: "Milk stand", desc: "Strap a grown mare onto it: she's kept in milk and any foal in the room can drink from her, any time - she can't refuse. She can't walk to food: right-click to fill its trough. She hates it.", cost: MILK_STAND_PRICE, isItem: "milk_stand" });
}
if (typeof STORE_AISLES !== "undefined") {
  const hw = STORE_AISLES.find((a) => a.id === "hardware");
  if (hw && !hw.items.includes("milk_stand")) hw.items.splice(hw.items.indexOf("immobilization_board") + 1, 0, "milk_stand");
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push({
    sellType: "milk_stand",
    is: (o) => o instanceof MilkStand,
    inCage: "never",
    sellable: true,
    hitTest: (o, x, y) => isPointInRect(x, y, o.x - 120, o.y - 80, 230, 120),
    create: () => centered(new MilkStand(currentScene)),
    drawIcon: (ctx) => drawMilkStandShape(ctx, 3, 9, 0.17, 1, false),
    onRightClick: (o) => fillMilkStand(o),
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.MilkStand = (d) => new MilkStand(d.scene);
