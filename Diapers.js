// ---------------------------------------------------------------------------
// Diapers (players' request): no mess on the floor - at a price.
//
// A pack of diapers (Fluff Mart, Care & Cleaning, DIAPER_PRICE for
// DIAPER_PACK) is a tool: click a fluffy of yours with it to put one on (or
// to change a dirty one for a fresh one). Right-click / long-press a fluffy
// wearing one: "Change diaper" (a fresh one from your pack, a care action:
// a little affection, "changed") or "Take it off".
//
// Wearing one (f.diaper = { fill, on }, saved):
//   - its poop and pee go in the diaper (HorseToilet.excrete): no puddle,
//     no cage mess - until it's full (fill 1): then it leaks as usual and
//     it's miserable about it
//   - it waddles (DIAPER_SPEED), and it's unhappy in it (DIAPER_SAD a game
//     hour, more the fuller it is), gets dirty from a dirty one, and minds
//     being seen in it ("Nu wike poopie pants...")
//   - a sensitive baby or a foal on milk minds least
// It doesn't learn the litterbox in a diaper.
// ---------------------------------------------------------------------------

const DIAPER_PRICE = 25;
const DIAPER_PACK = 10;
const DIAPER_SPEED = 0.85;
const DIAPER_SAD = 0.03; // a game hour, clean (x3 when full)
const DIAPER_POOP = 0.4; // fill per poop (x amount); pee 0.25
const DIAPER_DIRT = 0.04; // dirt a game hour when full
const diaperTicker = new Ticker(2);

if (typeof AFFECTION_ACTS !== "undefined") AFFECTION_ACTS.changed = { amount: 0.03, perDay: 4 };
if (typeof TOOL_GRIPS !== "undefined") TOOL_GRIPS.diapers = { ax: 0.5, ay: 0.5, turn: 0 };

function makeDiaperImage() {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 46;
  cv.height = 40;
  const c = cv.getContext("2d");
  if (!c) return null;
  const drawOne = (x, y) => {
    c.fillStyle = "#fbfbf6";
    c.strokeStyle = "#8a9aa8";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 26, y);
    c.lineTo(x + 22, y + 10);
    c.quadraticCurveTo(x + 13, y + 22, x + 4, y + 10);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = "#9fd0ff";
    c.fillRect(x + 1, y + 1, 5, 4);
    c.fillRect(x + 20, y + 1, 5, 4);
  };
  drawOne(14, 4);
  drawOne(4, 16);
  return cv;
}

function diaperImage() {
  if (typeof images === "undefined") return null;
  if (!images.diapers) {
    const img = makeDiaperImage();
    if (img) images.diapers = img;
  }
  return images.diapers;
}

class Diapers {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.charges = DIAPER_PACK;
  }
  update() {
    if (this.isDragging) {
      this.x = mouse.x;
      this.y = Math.max(mouse.y, sceneTop(this.scene) + 10);
    }
  }
  // script.js attemptDrop: clicked a fluffy with it
  useOnFluffy(f) {
    if (!f.adopted) {
      if (typeof addUIMessage === "function") addUIMessage("Only on one of yours.");
      return false;
    }
    return putOnDiaper(f, this);
  }
  onDrop() {
    return handleDropping(this);
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  hitTest(px, py) {
    return Math.abs(px - this.x) < 26 && py > this.y - 40 && py < this.y + 6;
  }
  getBottomY() {
    return this.y;
  }
  serialize() {
    return { classType: "Diapers", id: this.id, x: this.x, y: this.y, scene: this.scene, charges: this.charges, currentCageId: null };
  }
  deserialize(data) {
    this.charges = typeof data.charges === "number" ? data.charges : DIAPER_PACK;
  }
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    const img = diaperImage();
    if (!img) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.isDragging) drawHeldTool(ctx, img, "diapers");
    else ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}

function wearsDiaper(f) {
  return !!(f && f.diaper && typeof f.diaper === "object");
}

function diaperFill(f) {
  return wearsDiaper(f) ? Math.max(0, Math.min(1, f.diaper.fill || 0)) : 0;
}

function _diaperPack() {
  return (typeof toolbox !== "undefined" ? toolbox : []).find((t) => t instanceof Diapers && t.charges > 0) || (typeof objects !== "undefined" ? objects.find((o) => o instanceof Diapers && o.isDragging && o.charges > 0) : null) || null;
}

function _useDiaper(pack) {
  if (!pack) return;
  pack.charges--;
  if (pack.charges <= 0) {
    if (typeof removeToolFromToolbox === "function") removeToolFromToolbox(pack);
    const i = objects.indexOf(pack);
    if (i > -1) objects.splice(i, 1);
  }
}

// On, or a fresh one. Returns true if it did.
function putOnDiaper(f, pack = _diaperPack()) {
  if (!f || !f.isAlive || !f.adopted) return false;
  if (!pack || !(pack.charges > 0)) {
    if (typeof addUIMessage === "function") addUIMessage("You're out of diapers.");
    return false;
  }
  const changing = wearsDiaper(f);
  if (changing && diaperFill(f) < 0.05) {
    if (typeof addUIMessage === "function") addUIMessage("It's still clean.");
    return false;
  }
  _useDiaper(pack);
  f.diaper = { fill: 0, on: typeof timePlayed === "number" ? timePlayed : 0 };
  const talk = !f.tooYoungToSpeak() && typeof getDialogue === "function";
  if (changing) {
    if (typeof giveAffection === "function") giveAffection(f, "changed");
    f.changeHappiness(0.04, "A fresh diaper");
    if (talk) f.speak(getDialogue(["DIAPER", "CHANGED"], f), true);
  } else {
    if (!_diaperDoesntMind(f)) f.changeHappiness(-0.04, "Put in a diaper");
    if (talk) f.speak(getDialogue(["DIAPER", "ON"], f), true);
  }
  return true;
}

function takeOffDiaper(f) {
  if (!wearsDiaper(f)) return false;
  f.diaper = null;
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["DIAPER", "OFF"], f), true);
  return true;
}

function _diaperDoesntMind(f) {
  return (f.isSensitive && f.isSensitive()) || f.growth < 0.3;
}

// HorseToilet.excrete: does the diaper take it? (false once it's full)
function diaperCatches(f, isPoop, amount) {
  if (!wearsDiaper(f)) return false;
  const fill = diaperFill(f);
  if (fill >= 1) {
    f.changeHappiness(-0.04, "A full diaper leaked");
    return false;
  }
  f.diaper.fill = Math.min(1, fill + (isPoop ? DIAPER_POOP : 0.25) * Math.max(0.4, Math.min(1.5, (amount || 0.5) * 2)));
  f.badPoopieTimer = 0;
  f.goodPoopieTimer = 0;
  f.trainedForThisOccurrence = false;
  if (!_diaperDoesntMind(f)) f.changeHappiness(-0.02, "Went in its diaper");
  if (!f.tooYoungToSpeak() && Math.random() < 0.4 && typeof getDialogue === "function") f.speak(getDialogue(["DIAPER", f.diaper.fill >= 1 ? "FULL" : "WENT"], f));
  return true;
}

// HorseToilet.excretePoop/excretePee (the runs, wetting itself): a steady
// trickle soaks in quietly until it's full. True if it took it.
function diaperSoaks(f, isPoop, amount) {
  if (!wearsDiaper(f)) return false;
  const fill = diaperFill(f);
  if (fill >= 1) return false;
  f.diaper.fill = Math.min(1, fill + (isPoop ? DIAPER_POOP : 0.25) * amount);
  return true;
}

// Horse.updateSpeed
function diaperSpeed(f) {
  return wearsDiaper(f) ? DIAPER_SPEED : 1;
}

function updateDiapers(dt) {
  const step = diaperTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const hours = step / HOUR_LENGTH;
  for (const f of fluffies) {
    if (!wearsDiaper(f) || !f.isAlive) continue;
    const fill = diaperFill(f);
    const mind = _diaperDoesntMind(f) ? 0.3 : 1;
    f.changeHappiness(-DIAPER_SAD * (1 + 2 * fill) * mind * hours, fill > 0.6 ? "A dirty diaper" : "In a diaper");
    if (fill > 0.6 && typeof addDirt === "function") addDirt(f, DIAPER_DIRT * fill * hours);
    if (f.scene === currentScene && Math.random() < 0.01 * step && !f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING" && typeof getDialogue === "function") {
      // (the author's itchy complaints too: COMPLAIN, USED)
      let key = fill > 0.6 ? "DIRTY" : "WEARING";
      if (Math.random() < 0.5) key = fill > 0.05 && Math.random() < 0.5 ? "USED" : "COMPLAIN";
      if (!_diaperDoesntMind(f)) {
        f.expressionOverride = "MISERABLE";
        f.expressionOverrideTimer = 3.0;
      }
      f.speak(getDialogue(["DIAPER", key], f));
    }
  }
}
registerSystem("diapers", updateDiapers, 141);

function diaperActions(f) {
  if (!f || !f.isAlive || !f.adopted || !wearsDiaper(f)) return [];
  const out = [];
  const pack = _diaperPack();
  out.push({ key: "change_diaper", name: "Change diaper", sub: pack ? `${Math.round(diaperFill(f) * 100)}% full · ${pack.charges} left` : "no diapers left", run: (x) => putOnDiaper(x) });
  out.push({ key: "diaper_off", name: "Take diaper off", sub: "no more diaper", run: (x) => takeOffDiaper(x) });
  return out;
}
if (typeof FLUFFY_ACTION_SOURCES !== "undefined") FLUFFY_ACTION_SOURCES.push(diaperActions);

function describeDiaper(f) {
  if (!wearsDiaper(f)) return null;
  const fill = diaperFill(f);
  return [fill >= 1 ? "Full - leaking" : fill > 0.6 ? "Dirty - needs changing" : fill > 0.05 ? "Used" : "Clean", fill > 0.6 ? "bad" : "ok"];
}
if (typeof INSPECT_ROWS !== "undefined") INSPECT_ROWS.push(["Diaper", "describeDiaper"]);

// HorseRenderer (torso overlays): the diaper round its back end
function drawDiaperOn(ctx, renderer, layout) {
  const f = renderer && renderer.horse;
  if (!wearsDiaper(f) || !layout || !layout.torso) return;
  const r = layout.torso;
  const w = r.w;
  const h = r.h;
  const fill = diaperFill(f);
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.angle || 0);
  // The drawn diaper (assets/diaper*.png): over the rear of the torso
  const key = fill >= 1 ? "accessory_diaper_full" : fill > 0 ? "accessory_diaper_used" : "accessory_diaper";
  const img = typeof images !== "undefined" ? images[key] || images.accessory_diaper : null;
  if (img && img.complete && img.width) {
    ctx.drawImage(img, -55 - img.width / 2, 5 - img.height / 2);
    ctx.restore();
    return;
  }
  ctx.fillStyle = fill > 0.6 ? "rgba(236, 222, 180, 0.97)" : "rgba(252, 252, 247, 0.97)";
  ctx.strokeStyle = "rgba(120, 135, 150, 0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const x0 = -w * 0.5;
  const x1 = -w * 0.12;
  const y0 = -h * 0.05;
  const y1 = h * 0.48;
  if (ctx.roundRect) ctx.roundRect(x0, y0, x1 - x0, y1 - y0, Math.min(10, h * 0.2));
  else ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.fill();
  ctx.stroke();
  // The tabs
  ctx.fillStyle = "rgba(150, 200, 255, 0.95)";
  ctx.fillRect(x1 - w * 0.06, y0 + h * 0.06, w * 0.05, h * 0.12);
  ctx.restore();
}

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({ name: "Diapers", desc: `A pack of ${DIAPER_PACK}. Click a fluffy of yours to put one on: no mess on the floor, but it waddles about unhappy until you change it (right-click: Change diaper).`, cost: DIAPER_PRICE, isItem: "diapers" });
}
if (typeof STORE_AISLES !== "undefined") {
  const care = STORE_AISLES.find((a) => a.id === "care");
  if (care && !care.items.includes("diapers")) care.items.push("diapers");
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push({
    sellType: "diapers",
    is: (o) => o instanceof Diapers,
    inCage: "never",
    sellable: true,
    usedUp: (o) => 1 - (o.charges || 0) / DIAPER_PACK,
    icon: "diapers", // (drawn at load, below)
    tool: {
      className: "Diapers",
      create: (scene) => new Diapers(scene),
      key: "diapers",
      name: "Diapers",
      fullName: (t) => `Diapers (${t.charges ?? DIAPER_PACK} left)`,
      desc: (t) => `Click a fluffy of yours to put a diaper on, or change a dirty one. ${t.charges ?? DIAPER_PACK} left.`,
      image: () => diaperImage(),
      multi: true,
    },
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.Diapers = (d) => new Diapers(d.scene);
diaperImage();
