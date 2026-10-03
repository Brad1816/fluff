// ---------------------------------------------------------------------------
// The big ones (plan batch 5): microfluffs, sensitive babies in stages, and
// the close-up on the operating table.
//
// MICROFLUFFS (f.micro, saved): a tiny breed - MICRO_SCALE the size, so a
// grown micro is about as big as an ordinary foal halfway grown, and its
// own foals are far smaller still (a newborn micro is a quarter of its
// mum's size). They eat a fraction (MICRO_HUNGER), several fit in a cage,
// and they're very fragile: a fall hurts them MICRO_FRAGILE times as much
// (from lower down too), and so does a blow from a bigger fluffy. They feel
// the heat more. Rare in the park (MICRO_PARK_CHANCE of a new group is all
// micro), they sell for MICRO_PRICE x to collectors, who love them.
// Micros only breed with micros (microBreedingMismatch: canFluffiesMate
// says no, and so does the breeding cage), and their foals are micro too.
// Shown in the magnifying glass (Looks, "Size").
//
// SENSITIVE BABIES IN STAGES: a sensitive baby (Inbreeding.js) is born
// looking like any other foal. The swelling shows on its head (the puffed
// cheeks, eyes that stay shut) around when other foals say their first
// words (SBS_HEAD_AT grown), and on its neck and belly once they'd be
// talking properly (SBS_NECK_AT). The vet can tell early. Until it shows,
// the magnifying glass doesn't say (sbsVisible).
//
// THE CLOSE-UP (the surgery chart, Surgery.js): the fluffy's face up close
// beside the chart - its look as you work and what it says - and it reacts
// to each part as it goes (SURGERY_PAIN lines by part).
// ---------------------------------------------------------------------------

const MICRO_SCALE = 0.6; // (a grown micro: about an ordinary foal halfway grown)
const MICRO_HUNGER = 0.35;
const MICRO_FRAGILE = 3;
const MICRO_BLOW = 2.5;
const MICRO_PARK_CHANCE = 0.04;
const MICRO_PRICE = 2.5;
const SBS_HEAD_AT = WALKY_THRESHOLD;
const SBS_NECK_AT = 0.6;

// ---- Microfluffs ----

function isMicro(f) {
  return !!(f && f.micro);
}

// Horse.updateGrowthStats
function microScale(f) {
  return isMicro(f) ? MICRO_SCALE : 1;
}

// HorseUpdate hunger
function microHungerMultiplier(f) {
  return isMicro(f) ? MICRO_HUNGER : 1;
}

// Horse.handleThrowImpact: lower threshold, more damage
function microImpactFactor(f) {
  return isMicro(f) ? MICRO_FRAGILE : 1;
}

// HorseSocial.performAttack: a blow hurts it more
function microBlowFactor(target) {
  return isMicro(target) ? MICRO_BLOW : 1;
}

function microPriceMultiplier(f) {
  return isMicro(f) ? MICRO_PRICE : 1;
}

// globals.canFluffiesMate: a micro and an ordinary fluffy can't breed
// (one's the size of the other's foal)
function microBreedingMismatch(a, b) {
  return !!a && !!b && isMicro(a) !== isMicro(b);
}

// HorseAnatomy.spawnBaby: a micro mum's foals are micro (micros only breed
// with micros; a litter from before that rule goes by its mum)
function microInherit(baby, mum, dad) {
  if (!isMicro(mum)) return false;
  baby.micro = true;
  if (typeof baby.updateGrowthStats === "function") baby.updateGrowthStats();
  return true;
}

function makeMicro(f) {
  f.micro = true;
  if (typeof f.updateGrowthStats === "function") f.updateGrowthStats();
  return f;
}

// ParkLife.spawnParkGroup: now and then a whole group is micro
function maybeMicroGroup(group) {
  if (!Array.isArray(group) || !group.length || Math.random() >= MICRO_PARK_CHANCE) return false;
  for (const f of group) makeMicro(f);
  return true;
}

function describeMicro(f) {
  return isMicro(f) ? ["Microfluff: tiny and fragile (collectors love them)", "good"] : null;
}

// Collectors love a micro (Buyers.js)
if (typeof BUYER_KINDS !== "undefined") {
  const col = BUYER_KINDS.find((k) => k.id === "collector");
  if (col) {
    const like = col.like;
    col.like = (f) => Math.min(1, like(f) + (isMicro(f) ? 0.4 : 0));
  }
}

// ---- Sensitive babies in stages ----

// 0: looks like any foal, 1: the head shows, 2: the neck and belly too
function sbsStage(f) {
  if (!f || !(f.isSensitive && f.isSensitive())) return 0;
  if (f.growth < SBS_HEAD_AT) return 0;
  if (f.growth < SBS_NECK_AT) return 1;
  return 2;
}

// HorseRenderer: which of the signs to draw
function sbsShows(f, part) {
  const s = sbsStage(f);
  if (part === "head") return s >= 1;
  return s >= 2; // neck, body
}

// Can you tell by looking? (or the vet told you)
function sbsVisible(f) {
  return sbsStage(f) >= 1 || !!(f && f.sbsKnown);
}

// The renderer's pictures change with the stage
const sbsTicker = new Ticker(3);
function updateSbsStages(dt) {
  if (!sbsTicker.step(dt) || typeof fluffies === "undefined") return;
  for (const f of fluffies) {
    if (!f.isAlive || !f.sensitiveBaby) continue;
    const s = sbsStage(f);
    if (f._sbsStage !== s) {
      const was = f._sbsStage;
      f._sbsStage = s;
      if (f.renderer) f.renderer.tinted = null;
      if (was !== undefined && s === 1 && f.adopted && typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(f)}'s head is swelling: it's a sensitive baby.`);
    }
  }
}
registerSystem("sbsStages", updateSbsStages, 142);

// Vet.vetCheckUp: the vet can tell early
function vetSpotsSbs(f, found) {
  if (!f || !(f.isSensitive && f.isSensitive()) || sbsStage(f) >= 1) return;
  f.sbsKnown = true;
  found.push("early signs of a sensitive baby - it'll show soon");
}

// ---- The close-up ----

const SURGERY_PAIN = {
  leg: ["NU! NU WEGGIES! Pwease!", "Weggie huwties! Huwties!", "*SCREE* <Speaker> nu can wawk!"],
  wing: ["Wingies! Nu take wingies!", "*SCREE* Pwetty wingies!", "Huu huu... wingies..."],
  horn: ["Pointy! Nu! <Speaker> pointy!", "*SCREE* Head huwties!", "Huu... speshuw pointy..."],
  ear: ["Nu heaw nao! Huwties!", "*SCREE* Eaw-pway!", "Owie owie owie!"],
  eye: ["Dawk! Evewyfin' dawk!", "*SCREE* <Speaker> nu see!", "Huu huu... wan see..."],
  tail: ["Tail! Nu tail!", "Huwties! Bum huwties!", "*sob* Fwuffy tail..."],
  other: ["Huwties! Huwties! Make stop!", "*SCREE*", "Pwease mistah! Nu mowe!", "Wai mistah huwt <speaker>?"],
};
let _cuPortrait = null; // { id, at, canvas }

// Surgery.surgeryCut (via onMouthSurgery): it reacts to the part
function surgeryPainLine(f, id) {
  if (!f || !f.isAlive || id === "teeth" || id === "tongue") return null;
  const kind = /leg/.test(id) ? "leg" : /Wing/.test(id) ? "wing" : id === "horn" ? "horn" : /Ear/.test(id) ? "ear" : /Eye/.test(id) ? "eye" : id === "tail" ? "tail" : "other";
  const list = SURGERY_PAIN[kind];
  const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Fluffy";
  let line = list[Math.floor(Math.random() * list.length)].replace(/<Speaker>/g, name).replace(/<speaker>/g, name);
  if (f.tooYoungToSpeak()) line = "*SCREE* *peep peep*";
  f.speak(line, true, true);
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 3;
  _cuPortrait = null; // (redraw its face)
  return line;
}

// Surgery.drawSurgery: its face, up close, and what it's saying
function drawSurgeryCloseUp(c, f, L) {
  if (!f || typeof drawFluffyPortraitCanvas !== "function") return;
  const size = 104;
  const now = performance.now();
  if (!_cuPortrait || _cuPortrait.id !== f.id || now - _cuPortrait.at > 500) _cuPortrait = { id: f.id, at: now, canvas: drawFluffyPortraitCanvas(f, size) };
  const x = L.art.x + L.art.w - size - 12;
  const y = L.art.y + 10;
  fillRoundRect(c, x - 6, y - 6, size + 12, size + 34, 10, "rgba(10, 30, 28, 0.85)");
  if (_cuPortrait.canvas) c.drawImage(_cuPortrait.canvas, x, y, size, (size * _cuPortrait.canvas.height) / (_cuPortrait.canvas.width || 1));
  c.font = "bold 11px Arial";
  c.textAlign = "center";
  c.fillStyle = !f.isAlive ? "#bbb" : f.health < 30 ? "#ff8a80" : "#9ff0c8";
  const mood = !f.isAlive ? "Dead" : f.bleedingTimer > 0 ? "Bleeding, in pain" : f.happiness < 0.25 ? "Terrified" : f.happiness < 0.5 ? "Scared" : "Calm";
  c.fillText(mood, x + size / 2, y + size + 20);
  const said = f.speech && f.speech.text ? String(f.speech.text) : "";
  if (said) {
    c.font = "italic 13px Arial";
    c.fillStyle = "#ffe9c8";
    c.textAlign = "right";
    const t = typeof fitText === "function" ? fitText(c, `"${said}"`, L.art.w - size - 50) : `"${said}"`;
    c.fillText(t, x - 14, y + 18);
  }
  c.textAlign = "left";
}
