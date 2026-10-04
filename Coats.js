// ---------------------------------------------------------------------------
// Coats (plan round 8): clippers, long-haired coats, and toxoplasmosis you
// can see in the eyes.
//
// CLIPPERS (Fluff Mart, Care & Cleaning, CLIPPER_PRICE, a tool): click a
// fluffy of yours to shave its rear (nothing sticks there: a quarter of the
// dirt from accidents), click again to shave it all over. Shaved
// (f.shaved = { kind, at }, saved): embarrassed, the others giggle, and it
// feels the cold (all over: x SHAVE_COLD exposure; but cooler in summer).
// The fur grows back over SHAVE_GROW. Shaving a long coat takes its mats
// off and shows its real weight.
//
// LONG-HAIRED COATS (f.longCoat, saved; LONG_COAT_WILD of strays, and
// inherited: both parents LONG_COAT_BOTH, one LONG_COAT_ONE, else
// LONG_COAT_NEW): a long coat overheats in summer (x LONG_COAT_HOT), and
// mats without brushing (f.matted, saved, MAT_PER_DAY a day; a brush takes
// MAT_BRUSH off): matted, it's uncomfortable, sadder and worth less. The
// fluff hides weight loss: the weight reads a step heavy (Diet.js) until
// it's shaved. Drawn with extra tufts.
//
// TOXOPLASMOSIS IN THE EYES: an infected fluffy's eye whites turn brownish -
// unless "Toxo eyes: hidden" is set in the pause menu (toxoEyesHidden,
// saved).
// ---------------------------------------------------------------------------

const CLIPPER_PRICE = 45;
const SHAVE_GROW = 3 * DAY_LENGTH;
const SHAVE_COLD = 1.45;
const LONG_COAT_WILD = 0.12;
const LONG_COAT_BOTH = 0.8;
const LONG_COAT_ONE = 0.4;
const LONG_COAT_NEW = 0.04;
const LONG_COAT_HOT = 1.4;
const MAT_PER_DAY = 0.3;
const MAT_BRUSH = 0.35;
const coatsTicker = new Ticker(3);

if (typeof TOOL_GRIPS !== "undefined") TOOL_GRIPS.clippers = { ax: 0.5, ay: 0.1, turn: 0 };
if (typeof MEMORY_TEXT !== "undefined") MEMORY_TEXT.shaved = "Shaved";

let toxoEyesHidden = false;
if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({ name: "toxoEyesHidden", get: () => toxoEyesHidden, set: (v) => (toxoEyesHidden = !!v), fresh: () => false });
}
if (typeof PAUSE_TOGGLES !== "undefined") {
  PAUSE_TOGGLES.push({ label: () => `Toxo eyes: ${toxoEyesHidden ? "hidden" : "shown"}`, run: () => (toxoEyesHidden = !toxoEyesHidden) });
}

// HorseRenderer: brownish eye whites
function toxoEyesShow(f) {
  return !toxoEyesHidden && !!(f && f.isToxoplasmosis) && (typeof worldSettings === "undefined" || worldSettings.toxoplasmosis !== false);
}

function _coSay(f, keys, target = null, force = true) {
  if (f && f.isAlive && !f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(keys, f, target), force);
}

// ---- Shaving ----
function shavedKind(f) {
  if (!f || !f.shaved || typeof f.shaved.at !== "number") return null;
  if (timePlayed - f.shaved.at >= SHAVE_GROW || timePlayed < f.shaved.at) return null;
  return f.shaved.kind;
}

function shaveFluffy(f) {
  if (!f || !f.isAlive || !f.adopted) return false;
  const was = shavedKind(f);
  const kind = was ? "all" : "rear";
  if (was === "all") {
    if (typeof addUIMessage === "function") addUIMessage("There's nothing left to shave.");
    return false;
  }
  f.shaved = { kind, at: timePlayed };
  if (kind === "all") f.matted = 0;
  f.changeHappiness(kind === "all" ? -0.1 : -0.05, kind === "all" ? "Shaved all over" : "Its rear shaved");
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 2.5;
  _coSay(f, ["SHAVED", kind === "all" ? "ALL" : "REAR"]);
  if (typeof rememberPlayerEvent === "function") rememberPlayerEvent(f, "shaved");
  // The others giggle
  for (const o of fluffies) {
    if (o === f || !o.isAlive || o.scene !== f.scene || !o.canSee() || Math.hypot(o.x - f.x, o.y - f.y) > 300) continue;
    if (Math.random() < 0.5) {
      _coSay(o, ["SHAVED", "GIGGLE"], f);
      break;
    }
  }
  if (f.renderer) f.renderer.tinted = null;
  return true;
}

// HorseToilet: nothing sticks to a shaved rear
function accidentDirtFactor(f) {
  return shavedKind(f) ? 0.25 : 1;
}

// ---- Long coats ----
function hasLongCoat(f) {
  if (!f) return false;
  if (f.longCoat == null) f.longCoat = Math.random() < LONG_COAT_WILD;
  return !!f.longCoat;
}

function onBabyBornHooks(mare, baby) {
  const dad = baby.fatherId != null ? fluffyById(baby.fatherId) : null;
  const dadRec = !dad && baby.fatherId != null && typeof getFamilyRecord === "function" ? getFamilyRecord(baby.fatherId) : null;
  const mumLong = hasLongCoat(mare);
  const dadLong = dad ? hasLongCoat(dad) : !!((dadRec && dadRec.longCoat) || mare.sireLongCoat);
  baby.longCoat = Math.random() < (mumLong && dadLong ? LONG_COAT_BOTH : mumLong || dadLong ? LONG_COAT_ONE : LONG_COAT_NEW);
  if (typeof onWildBirth === "function") onWildBirth(mare, baby); // (Wild.js)
}

function mattedness(f) {
  return hasLongCoat(f) && shavedKind(f) !== "all" ? Math.max(0, Math.min(1, f.matted || 0)) : 0;
}

// Diet.describeWeight: the fluff hides weight loss
function coatWeightLevel(f, level) {
  if (!hasLongCoat(f) || shavedKind(f) === "all") return level;
  return level === "trim" ? "chubby" : "fat";
}

function coatPriceMultiplier(f) {
  return 1 - 0.25 * mattedness(f) - (shavedKind(f) === "all" ? 0.1 : 0);
}
if (typeof PRICE_MULTIPLIERS !== "undefined") PRICE_MULTIPLIERS.push(coatPriceMultiplier);

if (typeof EXTRA_WARMTH !== "undefined") {
  EXTRA_WARMTH.push((f) => {
    const s = shavedKind(f);
    if (s === "all") return SHAVE_COLD;
    if (s === "rear") return 1.05;
    return hasLongCoat(f) ? 0.85 : 1; // (a long coat keeps it warmer in winter)
  });
}
if (typeof EXTRA_HEAT !== "undefined") {
  EXTRA_HEAT.push((f) => (shavedKind(f) === "all" ? 0.7 : hasLongCoat(f) ? LONG_COAT_HOT : 1));
}

// Memory.onFluffyBrushed: the brush works the mats out
function brushOutMats(f) {
  if (!f || !(f.matted > 0)) return false;
  f.matted = Math.max(0, f.matted - MAT_BRUSH);
  return true;
}

function updateCoats(dt) {
  const step = coatsTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const hours = step / HOUR_LENGTH;
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    if (f.shaved && !shavedKind(f)) {
      f.shaved = null;
      if (f.renderer) f.renderer.tinted = null;
    }
    if (hasLongCoat(f) && shavedKind(f) !== "all") {
      f.matted = Math.min(1, (f.matted || 0) + (MAT_PER_DAY * step) / DAY_LENGTH);
      if (f.matted > 0.5 && f.adopted) f.changeHappiness(-0.03 * hours * f.matted, "A matted coat");
    }
    if (shavedKind(f) && f.adopted && f.scene === currentScene && Math.random() < 0.004 * step) _coSay(f, ["SHAVED", "SHY"], null, false);
  }
}
registerSystem("coats", updateCoats, 139.2);

function describeCoatLength(f) {
  const s = shavedKind(f);
  if (s) {
    const d = Math.ceil((f.shaved.at + SHAVE_GROW - timePlayed) / DAY_LENGTH);
    return [`Shaved ${s === "all" ? "all over" : "at the back"} (grows back in ${d} day${d === 1 ? "" : "s"})`, "ok"];
  }
  if (!hasLongCoat(f)) return null;
  const m = mattedness(f);
  return [`Long-haired${m > 0.66 ? " - badly matted" : m > 0.33 ? " - getting matted" : ""} (brush it; hot in summer; hides its weight)`, m > 0.33 ? "bad" : ""];
}
if (typeof INSPECT_ROWS !== "undefined") INSPECT_ROWS.push(["Coat length", "describeCoatLength"]);

// HorseRenderer (torso overlays): a shaved patch, or long tufts
function drawCoatExtras(ctx, renderer, layout) {
  const f = renderer && renderer.horse;
  if (!f || !layout || !layout.torso) return;
  const s = shavedKind(f);
  const r = layout.torso;
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.angle || 0);
  if (s) {
    ctx.fillStyle = "rgba(255, 196, 196, 0.55)";
    ctx.beginPath();
    if (s === "all") ctx.ellipse(0, r.h * 0.1, r.w * 0.42, r.h * 0.38, 0, 0, Math.PI * 2);
    else ctx.ellipse(-r.w * 0.32, r.h * 0.15, r.w * 0.16, r.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (hasLongCoat(f)) {
    const body = (f.colors && f.colors.body) || "#ddd";
    ctx.fillStyle = body;
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    const m = mattedness(f);
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = -r.w * 0.42 + t * r.w * 0.84;
      const y = r.h * 0.42 + (i % 2) * 3;
      ctx.beginPath();
      ctx.ellipse(x, y, r.w * 0.07, r.h * (0.1 + 0.05 * m), (i % 3 - 1) * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---- The clippers ----
class Clippers {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }
  update() {
    if (this.isDragging) {
      this.x = mouse.x;
      this.y = mouse.y;
    }
  }
  useOnFluffy(f) {
    if (!f.adopted) {
      if (typeof addUIMessage === "function") addUIMessage("Only one of yours.");
      return false;
    }
    if (typeof playSound === "function") playSound("taser", 0.12, 2);
    return shaveFluffy(f);
  }
  onDrop() {
    return handleDropping(this);
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  hitTest(px, py) {
    return Math.abs(px - this.x) < 16 && py > this.y - 40 && py < this.y + 6;
  }
  getBottomY() {
    return this.y;
  }
  serialize() {
    return { classType: "Clippers", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: null };
  }
  deserialize() {}
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    const img = clipperImage();
    if (!img) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.isDragging) drawHeldTool(ctx, img, "clippers");
    else ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}

function clipperImage() {
  if (typeof images === "undefined") return null;
  if (images.clippers) return images.clippers;
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 26;
  cv.height = 50;
  const c = cv.getContext("2d");
  if (!c) return null;
  c.fillStyle = "#c9ccd0";
  c.fillRect(3, 0, 20, 6);
  c.fillStyle = "#555";
  for (let x = 4; x < 23; x += 3) c.fillRect(x, 0, 1, 6);
  c.fillStyle = "#3a6ea5";
  c.beginPath();
  if (c.roundRect) c.roundRect(4, 6, 18, 42, 7);
  else c.rect(4, 6, 18, 42);
  c.fill();
  c.fillStyle = "#e9eef3";
  c.fillRect(10, 18, 6, 10);
  images.clippers = cv;
  return cv;
}

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({ name: "Clippers", desc: "Click a fluffy of yours to shave its rear (nothing sticks), again to shave it all over. It's embarrassed and feels the cold; the fur grows back in a few days. Takes the mats out of a long coat.", cost: CLIPPER_PRICE, isItem: "clippers" });
}
if (typeof STORE_AISLES !== "undefined") {
  const care = STORE_AISLES.find((a) => a.id === "care");
  if (care && !care.items.includes("clippers")) care.items.push("clippers");
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push({
    sellType: "clippers",
    is: (o) => o instanceof Clippers,
    inCage: "never",
    sellable: true,
    icon: "clippers",
    tool: {
      className: "Clippers",
      create: (scene) => new Clippers(scene),
      key: "clippers",
      name: "Clippers",
      desc: "Click a fluffy of yours: shave its rear, then all over. The fur grows back in a few days.",
      image: () => clipperImage(),
    },
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.Clippers = (d) => new Clippers(d.scene);
clipperImage();
