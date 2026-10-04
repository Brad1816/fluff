// ---------------------------------------------------------------------------
// More buyers at the door (plan round 8). Each is a BUYER_KINDS type
// (Buyers.js), so they knock, ask about one they like and haggle like the
// others.
//
//   lab         "A research lab": wants the ones nobody else does - a
//               sensitive baby, a defect (dummy, shaky), a deformity, a runt.
//               Only comes when you have one. Pays a flat LAB_PAY; it's led
//               away to a van and never heard of again. Families hear of it
//               (keeperRep.family -LAB_REP), it doesn't write.
//   carehome    "A care home": wants a calm, gentle grown-up for the
//               residents (low temper, friendly with people, happy). Pays
//               well for the right one and writes often.
//   parent      "A worried parent": a gentle one for a nervous child - low
//               temper, not a smarty, not frightened of people. Turns down
//               a biter (likes it near zero).
//   influencer  "An influencer": pays over the odds for a cute, colourful
//               foal (budget INFLU_BUDGET) - lots of views, your name goes up
//               a little with families (INFLU_REP). Then, INFLU_DUMP_DAYS
//               later, it gets "rehomed": the fluffy turns up in the park as
//               a stray under the new name they gave it (f.formerPet,
//               how "dumped"), with everything it remembers. You're told.
//               Bring it home through the adoption room if you like.
// Saved: moreBuyersState { dumps: [{ due, data, name, oldName }] }.
// ---------------------------------------------------------------------------

const LAB_PAY = [45, 90]; // a foal .. grown
const LAB_REP = 1;
const LAB_WEIGHT = 0.7;
const CAREHOME_WEIGHT = 0.9;
const PARENT_WEIGHT = 1.1;
const INFLU_WEIGHT = 0.5;
const INFLU_BUDGET = 1.6;
const INFLU_REP = 1;
const INFLU_DUMP_DAYS = 7;
const INFLU_NAMES = ["Sprinkles", "Boba", "Mochi", "Cupcake", "Glitter", "Pudding", "Bambi", "Cookie", "Peaches", "Nugget"];
const moreBuyersTicker = new Ticker(5);

function freshMoreBuyersState() {
  return { dumps: [] };
}
let moreBuyersState = freshMoreBuyersState();
if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({
    name: "moreBuyersState",
    get: () => moreBuyersState,
    set: (v) => (moreBuyersState = v && typeof v === "object" ? v : freshMoreBuyersState()),
    fresh: () => freshMoreBuyersState(),
  });
}
function _mbState() {
  if (!moreBuyersState || typeof moreBuyersState !== "object") moreBuyersState = freshMoreBuyersState();
  if (!Array.isArray(moreBuyersState.dumps)) moreBuyersState.dumps = [];
  return moreBuyersState;
}

function _mbTrait(f, k) {
  return typeof traitValue === "function" ? traitValue(f, k) : 0;
}

// ---- What each wants ----
// 0..1: how much of a "lab case" it is
function labValue(f) {
  if (!f || !f.isAlive) return 0;
  let v = 0;
  if (f.sensitiveBaby) v += 0.6;
  if (typeof hasDefect === "function" && (hasDefect(f, "dummy") || hasDefect(f, "shaky"))) v += 0.5;
  if (Array.isArray(f.deformities) && f.deformities.length) v += 0.4;
  if (f.runt) v += 0.3;
  if (f.toothless || f.tongueless) v += 0.2;
  return Math.min(1, v);
}

function isLabCase(f) {
  return labValue(f) >= 0.3;
}

function careHomeLike(f) {
  if (!f || !f.isAlive) return 0;
  const calm = (1 - _mbTrait(f, "temper")) / 2; // 0..1, calm high
  const tame = typeof _tame === "function" ? _tame(f) : 0.5;
  const happy = Math.max(0, Math.min(1, f.happiness ?? 0.6));
  const grown = f.growth >= 1 ? 1 : 0.2;
  const smarty = f.isSmarty && f.isSmarty() ? -0.3 : 0;
  return 0.35 * calm + 0.3 * tame + 0.15 * happy + 0.2 * grown + smarty;
}

function parentLike(f) {
  if (!f || !f.isAlive) return 0;
  const temper = _mbTrait(f, "temper");
  if (temper > 0.5 || (f.isSmarty && f.isSmarty())) return 0.02; // (not near a child)
  const calm = (1 - temper) / 2;
  const unafraid = 1 - Math.min(1, f.playerFear || 0);
  const tame = typeof _tame === "function" ? _tame(f) : 0.5;
  return 0.45 * calm + 0.3 * tame + 0.25 * unafraid;
}

function influencerLike(f) {
  if (!f || !f.isAlive) return 0;
  const foal = f.growth < 1 ? 1 : 0.2;
  const coat = typeof _showCoat === "function" ? _showCoat(f) : 0.5;
  const pattern = f.hasSpots || f.hasStripes ? 1 : 0;
  const fancy = f.type !== "earthy" ? 1 : 0;
  return 0.4 * foal + 0.3 * coat + 0.15 * pattern + 0.15 * fancy;
}

if (typeof BUYER_KINDS !== "undefined") {
  BUYER_KINDS.push(
    {
      id: "lab",
      label: "A research lab",
      wants: "sensitive, defective or deformed ones - for study",
      budget: 1,
      patience: 1,
      generous: 0.05,
      weight: () => (typeof fluffies !== "undefined" && fluffies.some((f) => f.adopted && !f.notForSale && isLabCase(f)) ? LAB_WEIGHT : 0),
      like: (f) => (isLabCase(f) ? labValue(f) : 0.02),
      flatPrice: (f) => LAB_PAY[0] + (LAB_PAY[1] - LAB_PAY[0]) * Math.min(1, f.growth || 0),
    },
    {
      id: "carehome",
      label: "A care home",
      wants: "a calm, gentle grown-up for the residents",
      budget: 1.15,
      patience: 2,
      generous: 0.25,
      weight: (lvl) => CAREHOME_WEIGHT * (typeof familyRepWeight === "function" ? familyRepWeight() : 1),
      like: careHomeLike,
    },
    {
      id: "parent",
      label: "A worried parent",
      wants: "a gentle one for a nervous child - no biters",
      budget: 1,
      patience: 2,
      generous: 0.2,
      weight: (lvl) => PARENT_WEIGHT * (typeof familyRepWeight === "function" ? familyRepWeight() : 1),
      like: parentLike,
    },
    {
      id: "influencer",
      label: "An influencer",
      wants: "a cute, colourful foal for the camera",
      budget: INFLU_BUDGET,
      patience: 1,
      generous: 0.3,
      minLevel: 2,
      weight: () => INFLU_WEIGHT,
      like: influencerLike,
    },
  );
}

// Reputation.js NOTE_CHANCE / writeOwnerNote: who writes
if (typeof NOTE_CHANCE !== "undefined") {
  NOTE_CHANCE.carehome = 0.75;
  NOTE_CHANCE.parent = 0.7;
  NOTE_CHANCE.lab = 0;
  NOTE_CHANCE.influencer = 0;
}

// Reputation.noteSoldForRep: true = handled here (no note)
function onMoreBuyerSale(f, buyer) {
  if (buyer === "lab") {
    if (typeof keeperRep !== "undefined" && keeperRep) keeperRep.family = Math.max(-(typeof REP_MAX === "number" ? REP_MAX : 40), (keeperRep.family || 0) - LAB_REP);
    if (typeof recordStory === "function") recordStory("turning", f, { x: `${fluffyDisplayName(f)} was taken away by a research lab.` });
    if (typeof addUIMessage === "function") addUIMessage("A van takes it away. You don't hear about it again.");
    return true;
  }
  if (buyer === "influencer") {
    noteInfluencerSale(f);
    return true;
  }
  return false;
}

// ---- The influencer ----
function noteInfluencerSale(f) {
  const st = _mbState();
  const oldName = (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || null;
  const name = INFLU_NAMES[Math.floor(Math.random() * INFLU_NAMES.length)];
  let data = null;
  try {
    data = JSON.parse(JSON.stringify(f.serialize()));
  } catch (e) {
    data = null;
  }
  if (!data) return;
  data.currentCageId = null;
  data.placedOnId = null;
  data.claimedBedId = null;
  data.accessories = {};
  st.dumps.push({ due: getDayNumber() + INFLU_DUMP_DAYS, data, name, oldName });
  if (st.dumps.length > 12) st.dumps.shift();
  if (typeof keeperRep !== "undefined" && keeperRep) keeperRep.family = Math.min(typeof REP_MAX === "number" ? REP_MAX : 40, (keeperRep.family || 0) + INFLU_REP);
  if (typeof addUIMessage === "function") addUIMessage(`"OMG meet ${name}!!" - your fluffy's first video already has thousands of views.`);
}

// A week on: dumped in the park under its new name
function dumpInfluencerFluffy(d) {
  if (!d || !d.data || typeof Horse === "undefined") return null;
  if (typeof fluffies !== "undefined" && fluffies.some((o) => o.id === d.data.id)) return null; // (somehow still here)
  const data = JSON.parse(JSON.stringify(d.data));
  const scene = typeof PARK_SCENE !== "undefined" ? PARK_SCENE : "PARK";
  const at = typeof _parkEdgeSpot === "function" ? _parkEdgeSpot() : { x: 400, y: 600 };
  data.scene = scene;
  data.x = at.x;
  data.y = at.y;
  data.adopted = false;
  data.currentStateKey = "IDLE";
  const f = Horse.deserialize(data);
  if (!f) return null;
  if (typeof relationships !== "undefined" && !relationships[f.id]) relationships[f.id] = {};
  if (!fluffies.includes(f)) fluffies.push(f);
  if (typeof fluffyNames !== "undefined") fluffyNames[f.id] = d.name;
  f.formerPet = { how: "dumped", day: getDayNumber(), name: d.name };
  f.adopted = false;
  f.changeHappiness(-0.15, "Dumped in the park");
  if (typeof f.initBehavior === "function") f.initBehavior("IDLE");
  const was = d.oldName ? ` (your ${d.oldName})` : "";
  if (typeof addUIMessage === "function") addUIMessage(`The influencer "rehomed" ${d.name}${was}. It was left in the park.`);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `${d.name} was dumped in the park` });
  if (typeof recordStory === "function") recordStory("turning", f, { x: `${d.name} was dumped in the park by the influencer who bought it.` });
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["INFLUENCER", "DUMPED"], f), true);
  return f;
}

function updateMoreBuyers(dt) {
  if (!moreBuyersTicker.step(dt)) return;
  const st = _mbState();
  if (!st.dumps.length) return;
  const day = getDayNumber();
  const due = st.dumps.filter((d) => day >= d.due);
  if (!due.length) return;
  st.dumps = st.dumps.filter((d) => day < d.due);
  for (const d of due) dumpInfluencerFluffy(d);
}
registerSystem("moreBuyers", updateMoreBuyers, 186);

