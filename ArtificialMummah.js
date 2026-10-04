// ---------------------------------------------------------------------------
// The formula mummah (from a mill story): a fat, legless plush body with a
// row of rubber teats along its belly and a warm tank of formula inside.
// Fluff Mart, Food & Feeding (MUMMAH_PRICE); the mill fit-out has one.
//
// To a foal it's a big feeder (Bowl type "mega_feeder", MUMMAH_TANK feeds),
// so foals still on milk drink from it whenever they're hungry - any number
// at once, and the Feed-Bot tops it up with formula like any feeder. Fill
// it by hand by dropping formula on it (a food bag) like a feeder.
//
// What makes it more than a feeder:
//   - it's warm: foals lying by it (MUMMAH_WARM_NEAR) feel the cold less
//     (EXTRA_WARMTH, MUMMAH_WARM)
//   - it raises them (Upbringing.js UPBRINGING_SOURCES): a foal that's fed
//     from it lately (MUMMAH_RAISED, f.mummahFedAt, saved) learns from it like
//     a mum - and it has no colour hate and no fear of alicorns to teach. With
//     no real mum to tell them about "poopie babbehs" or "munstah babbehs",
//     foals raised on it grow up kind to every colour (unless a real mum is
//     around, pulling the other way)
//   - they call it mummah (its own lines when they drink: MUMMAH_MACHINE)
// Shown in the magnifying glass ("Raised by"). Saved: food (as a Bowl).
// ---------------------------------------------------------------------------

const MUMMAH_PRICE = 500;
const MUMMAH_TANK = 40;
const MUMMAH_RAISED = DAY_LENGTH; // fed from it within the last game day: it's raising the foal
const MUMMAH_RANGE = 500;
const MUMMAH_WARM_NEAR = 110;
const MUMMAH_WARM = 0.6; // x the cold
const MUMMAH_W = 150;
const MUMMAH_H = 84;

// What it "teaches": nothing prejudiced, nothing to fear
const _MUMMAH_VIEWS = { coloristDegree: 0, alicornComfort: 0.85, traitShift: {}, fears: {} };

class ArtificialMummah extends Bowl {
  constructor(scene = "INDOORS") {
    super("mega_feeder", scene);
    this.isMummahMachine = true;
    this.maxFood = MUMMAH_TANK;
  }
  // (a stand-in picture size: hit tests and cage containment use it)
  getImage() {
    return { width: MUMMAH_W, height: MUMMAH_H };
  }
  hitTest(px, py) {
    return px >= this.x - MUMMAH_W / 2 && px <= this.x + MUMMAH_W / 2 && py >= this.y - MUMMAH_H && py <= this.y;
  }
  serialize() {
    return { ...super.serialize(), classType: "ArtificialMummah" };
  }
  deserialize(data) {
    super.deserialize(data);
    this.maxFood = MUMMAH_TANK;
  }
  drawOffScreen(ctx) {
    const drinking = fluffies.filter((f) => f.isAlive && f.scene === this.scene && f.growth < 1 && Math.hypot(f.x - this.x, f.y - this.y) < 70).length;
    drawMummahMachineShape(ctx, this.x, this.y, 1, this.food / this.maxFood, drinking > 0);
  }
}

function drawMummahMachineShape(c, x, y, k = 1, full = 1, busy = false) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  // The warming pad under it
  c.fillStyle = "rgba(255, 150, 90, 0.35)";
  c.beginPath();
  c.ellipse(0, -4, 78, 12, 0, 0, Math.PI * 2);
  c.fill();
  // The fat plush body
  c.fillStyle = "#f2d6c4";
  c.strokeStyle = "#a07a66";
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(0, -36, 70, 32, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // A head of sorts, with stitched eyes
  c.beginPath();
  c.ellipse(-62, -58, 22, 18, -0.3, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.strokeStyle = "#5b4033";
  c.lineWidth = 2;
  for (const ex of [-70, -58]) {
    c.beginPath();
    c.moveTo(ex - 3, -62);
    c.lineTo(ex + 3, -58);
    c.moveTo(ex + 3, -62);
    c.lineTo(ex - 3, -58);
    c.stroke();
  }
  // The tank window on its back
  c.fillStyle = "rgba(255,255,255,0.6)";
  c.fillRect(-10, -66, 46, 12);
  c.fillStyle = "#fffaf0";
  c.fillRect(-10, -66, 46 * Math.max(0, Math.min(1, full)), 12);
  c.strokeStyle = "#a07a66";
  c.strokeRect(-10, -66, 46, 12);
  // A row of rubber teats along the belly
  c.fillStyle = busy ? "#e48aa0" : "#d98fa0";
  for (let i = 0; i < 6; i++) {
    const tx = -44 + i * 18;
    c.beginPath();
    c.ellipse(tx, -6, 4, 6, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// Upbringing.js: it raises the foals that drink from it
const UPBRINGING_SOURCES = [];
function mummahRaising(f) {
  return !!(f && typeof f.mummahFedAt === "number" && timePlayed - f.mummahFedAt < MUMMAH_RAISED && timePlayed >= f.mummahFedAt);
}
function mummahMachineFor(f) {
  return objects.find((o) => o instanceof ArtificialMummah && o.scene === f.scene && o.currentCage === f.currentCage && Math.hypot(o.x - f.x, o.y - f.y) < MUMMAH_RANGE) || null;
}
UPBRINGING_SOURCES.push((f) => {
  if (!mummahRaising(f) || !mummahMachineFor(f)) return [];
  if (!_MUMMAH_VIEWS.fears.thunder && typeof FEARS !== "undefined") for (const fe of FEARS) _MUMMAH_VIEWS.fears[fe.key] = 0;
  return [{ f: _MUMMAH_VIEWS, weight: 1, who: "machine" }];
});

// HorseActionHandler: a foal drank from a feeder. True if it said its own line.
function onFeederDrink(f, feeder) {
  if (!feeder || !feeder.isMummahMachine) return false;
  f.mummahFedAt = timePlayed;
  if (f.tooYoungToSpeak() || typeof getDialogue !== "function") return true;
  f.speak(getDialogue(["MUMMAH_MACHINE", "DRINK"], f));
  return true;
}

// Warm to lie by
if (typeof EXTRA_WARMTH !== "undefined") {
  EXTRA_WARMTH.push((f) => {
    if (!f || f.growth >= 1) return 1;
    const m = objects.find((o) => o instanceof ArtificialMummah && o.scene === f.scene && o.currentCage === f.currentCage && Math.hypot(o.x - f.x, o.y - 8 - f.y) < MUMMAH_WARM_NEAR);
    return m ? MUMMAH_WARM : 1;
  });
}

function describeMummahRaised(f) {
  if (!f || !f.isAlive || !mummahRaising(f)) return null;
  return [f.growth < 1 ? "The formula mummah - no colour hate to learn" : "The formula mummah", f.growth < 1 ? "good" : ""];
}
if (typeof INSPECT_ROWS !== "undefined") INSPECT_ROWS.push(["Raised by", "describeMummahRaised"]);

// ---- Shop, registry, the mill kit ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({
    name: "Formula mummah",
    desc: "A fat plush body with a row of teats and a warm formula tank: foals drink from it whenever they like, as many as like at once (the Feed-Bot keeps it topped up). It raises them, too - with no real mum to teach them, they grow up kind to every colour.",
    cost: MUMMAH_PRICE,
    isItem: "mummah_machine",
    priority: 1,
  });
}
if (typeof STORE_AISLES !== "undefined") {
  const food = STORE_AISLES.find((a) => a.id === "food");
  if (food && !food.items.includes("mummah_machine")) food.items.push("mummah_machine");
}
if (typeof ITEM_TYPES !== "undefined") {
  // (before the mega feeder's entry, which it would otherwise match)
  const i = ITEM_TYPES.findIndex((e) => e.sellType === "mega_feeder");
  ITEM_TYPES.splice(i >= 0 ? i : ITEM_TYPES.length, 0, {
    sellType: "mummah_machine",
    is: (o) => o instanceof ArtificialMummah,
    hitTest: (o, x, y) => o.hitTest(x, y),
    drawIcon: (ctx, size) => drawMummahMachineShape(ctx, 0, size * 0.25, size / 180, 1, false),
    sellable: true,
    create: (a, sx, sy) => atSpot(new ArtificialMummah(currentScene), sx, sy),
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.ArtificialMummah = (d) => new ArtificialMummah(d.scene);
if (typeof ROOM_KITS !== "undefined") {
  const mill = ROOM_KITS.find((k) => k.key === "mill");
  if (mill && !mill.floor.includes("Formula mummah")) mill.floor.push("Formula mummah");
}
