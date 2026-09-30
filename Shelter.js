// ---------------------------------------------------------------------------
// The Fluffy Shelter (was the day care). Through the door in Shelter Alley.
//
//   - Boarding: the desk still boards your own fluffies (UIDayCare.js,
//     dayCareFluffies; the boarding fee is a daily bill, Bills.js).
//   - Adoption: SHELTER_CAGES kennels (ShelterKennels, three either side of
//     the desk) hold strays and fluffies their owners gave up. You can see
//     each one through the bars, but all you can read about it is the plaque
//     under its cage: its name, what it is, roughly how old, where it came
//     from, a line or two from the staff, and its time's-up day. No
//     magnifying glass - adopting is a gamble.
//   - Mostly poopie or drab coats (judgeCoatColour, globals.js) and poor
//     temperaments (grumpy, wary of people, not litter trained, the odd
//     Smarty); now and then a gem (bright coat, gentle nature, or hidden wing
//     or horn genes).
//   - Staff notes are kind about the truth ("Spirited!" for a grumpy one),
//     and now and then just wrong (SHELTER_NOTE_WRONG).
//   - Every morning, fluffies past their time's-up day are gone (news in the
//     day report) and SHELTER_ARRIVALS new ones come in. On its last day a
//     fluffy is half price.
//   - Adopted fluffies come out by the desk as yours, with the name the
//     shelter (or their old owner) gave them; take them home yourself.
// Saved: shelter (SAVED_GAME_STATE). Fees are placeholders for the balance
// pass.
// ---------------------------------------------------------------------------

const SHELTER_SCENE = "DAY_CARE";
const SHELTER_CAGES = 6;
const SHELTER_ARRIVALS = [1, 2]; // new fluffies each morning
const SHELTER_START = 4; // cages filled when you first visit
const SHELTER_STAY_DAYS = [3, 5]; // days until time's up
const SHELTER_ADOPT_FEE = 60; // placeholder
const SHELTER_LAST_DAY_DISCOUNT = 0.5;
const SHELTER_NICE_COAT_CHANCE = 0.12;
const SHELTER_GOOD_NATURE_CHANCE = 0.12;
const SHELTER_HIDDEN_GENES_CHANCE = 0.08;
const SHELTER_SMARTY_CHANCE = 0.08;
const SHELTER_NOTE_WRONG = 0.15;

const SHELTER_NAMES = [
  "Mudpie", "Scruffy", "Patches", "Nugget", "Pickle", "Dusty", "Muffin", "Bean", "Tater", "Pudding",
  "Twig", "Nibbles", "Scraps", "Moss", "Chip", "Smudge", "Crumb", "Tuffet", "Wobble", "Pip",
  "Freckles", "Doodle", "Mopsy", "Sniffles", "Button", "Clover", "Noodle", "Sock", "Gravy", "Pogo",
];

function freshShelter() {
  return { day: null, residents: [], adopted: 0, lost: 0, stocked: false };
}
let shelter = freshShelter();
const shelterTicker = new Ticker(1);
let _shelterPortraits = {};
let shelterCardIndex = null; // the cage whose plaque is open

const _shRand = (range) => range[0] + Math.random() * (range[1] - range[0]);
const _shPick = (list) => list[Math.floor(Math.random() * list.length)];

// ---- Making a resident ----

function _shSetBits(genes, from, count, on) {
  const bits = Array.from({ length: count }, (_, i) => (i < on ? 1 : 0)).sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) genes[from + i] = bits[i];
}

function _shCoatP(genes) {
  const c = (i) => {
    let s = 0;
    for (let k = 0; k < 8; k++) s += genes[i + k];
    return Math.floor(s * 31.875);
  };
  return judgeCoatColour([c(0), c(8), c(16)]).p;
}

function _shGenes(kind) {
  const g = new HorseGenetics({ genes: null });
  let genes;
  if (kind.niceCoat) {
    // A gem: keep rolling for a bright coat
    for (let i = 0; i < 40; i++) {
      genes = g.generateRandomGenes(null, null);
      if (_shCoatP(genes) >= COAT_NICE_LINE) break;
    }
  } else if (Math.random() < 0.72) {
    genes = g.generateRandomGenes(Math.random() * 0.25, Math.random() * 0.6); // near the browns
  } else {
    // Random - usually drab or plain; rolled again if it came out bright
    genes = g.generateRandomGenes(null, null);
    if (_shCoatP(genes) >= COAT_NICE_LINE) genes = g.generateRandomGenes(Math.random() * 0.4, null);
  }
  // Mostly earthies; the odd unicorn or pegasus; now and then an earthy that
  // carries wing or horn genes it doesn't show
  const r = Math.random();
  _shSetBits(genes, 53, 5, r < 0.1 ? 4 + Math.round(Math.random()) : Math.floor(Math.random() * 3));
  _shSetBits(genes, 58, 5, r >= 0.1 && r < 0.2 ? 4 + Math.round(Math.random()) : Math.floor(Math.random() * 3));
  if (kind.hiddenGenes) _shSetBits(genes, Math.random() < 0.5 ? 53 : 58, 5, 3);
  // Temperament genes (Traits.js): usually grumpy and timid; a gem is gentle and social
  if (typeof TRAITS !== "undefined" && typeof TRAIT_GENE_START !== "undefined") {
    const setTrait = (key, on) => {
      const i = TRAITS.findIndex((t) => t.key === key);
      if (i >= 0) _shSetBits(genes, TRAIT_GENE_START + i * TRAIT_GENES_EACH, TRAIT_GENES_EACH, Math.max(0, Math.min(TRAIT_GENES_EACH, on)));
    };
    const n = TRAIT_GENES_EACH;
    if (kind.goodNature) {
      setTrait("temper", Math.floor(Math.random() * 0.3 * n));
      setTrait("social", Math.ceil(n * (0.65 + Math.random() * 0.35)));
    } else {
      setTrait("temper", Math.ceil(n * (0.55 + Math.random() * 0.45)));
      setTrait("bravery", Math.floor(n * Math.random() * 0.6));
    }
  }
  return genes;
}

function _shAge(f) {
  const days = typeof ageDays === "function" ? ageDays(f) : (f.age || 0) / DAY_LENGTH;
  if (days < 1) return "a few weeks old";
  const months = Math.round(days);
  if (months < DAYS_PER_YEAR) return months <= 1 ? "about a month old" : `about ${months} months old`;
  const y = Math.round(days / DAYS_PER_YEAR);
  return y <= 1 ? "about a year old" : `about ${y} years old`;
}

function _shTrait(f, key) {
  return typeof traitValue === "function" ? traitValue(f, key) : 0;
}

// The staff's notes: kind about the truth, and sometimes just wrong
const SHELTER_NOTES = {
  grumpy: ["Spirited!", "Has a big personality", "Needs an experienced owner"],
  gentle: ["Sweet and gentle", "Loves a cuddle"],
  timid: ["A little shy", "Takes time to warm up"],
  brave: ["Bold and curious"],
  loner: ["Enjoys its own company"],
  social: ["Gets on with everyone"],
  messy: ["Still learning the litterbox"],
  tidy: ["Litter trained!"],
  smarty: ["Very confident!", "Knows what it wants"],
  wary: ["Nervous around people"],
  any: ["Looking for a forever home!", "A real character!", "Staff favourite!", "Ready for a fresh start"],
};

function _shNotes(f) {
  const truth = [];
  const temper = _shTrait(f, "temper");
  if (f.isSmarty && f.isSmarty()) truth.push("smarty");
  if (temper > 0.3) truth.push("grumpy");
  else if (temper < -0.3) truth.push("gentle");
  const brave = _shTrait(f, "bravery");
  if (brave < -0.3) truth.push("timid");
  else if (brave > 0.4) truth.push("brave");
  const social = _shTrait(f, "social");
  if (social < -0.4) truth.push("loner");
  else if (social > 0.4) truth.push("social");
  if ((f.playerFear || 0) > 0.25 || (f.playerTrust || 0) < 0.2) truth.push("wary");
  if ((f.pottyTraining || 0) < 0.25) truth.push("messy");
  else if ((f.pottyTraining || 0) > 0.7) truth.push("tidy");
  const notes = [];
  const kinds = truth.sort(() => Math.random() - 0.5);
  for (let i = 0; i < 2; i++) {
    let kind;
    if (Math.random() < SHELTER_NOTE_WRONG) kind = _shPick(["gentle", "social", "tidy", "brave"]);
    else kind = kinds[i] || "any";
    const text = _shPick(SHELTER_NOTES[kind]);
    if (!notes.includes(text)) notes.push(text);
  }
  return notes;
}

function makeShelterResident(dayNumber = typeof getDayNumber === "function" ? getDayNumber() : 1) {
  const kind = {
    niceCoat: Math.random() < SHELTER_NICE_COAT_CHANCE,
    goodNature: Math.random() < SHELTER_GOOD_NATURE_CHANCE,
    hiddenGenes: Math.random() < SHELTER_HIDDEN_GENES_CHANCE,
  };
  const origin = _shPick(["stray", "stray", "surrendered", "surrendered", "born"]);
  const gender = Math.random() < 0.5 ? "female" : "male";
  const growth = origin === "born" ? 0.35 + Math.random() * 0.4 : Math.random() < 0.85 ? 1 : 0.6 + Math.random() * 0.35;
  const h = new Horse(growth, null, SHELTER_SCENE, "earthy", _shGenes(kind), null, null, gender);
  if (typeof relationships !== "undefined") delete relationships[h.id];
  // Old, young, anything in between (days: a game day is about a month)
  if (typeof setSpawnAge === "function") setSpawnAge(h, 3, origin === "surrendered" ? 60 : 36);
  // How it's been treated
  h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
  if (!kind.goodNature && growth >= 1 && Math.random() < SHELTER_SMARTY_CHANCE) h.personalities.push("smarty");
  h.hunger = 0.7 + Math.random() * 0.3;
  h.happiness = kind.goodNature ? 0.55 + Math.random() * 0.2 : 0.3 + Math.random() * 0.25;
  h.playerTrust = kind.goodNature ? 0.4 + Math.random() * 0.2 : 0.08 + Math.random() * 0.25;
  h.playerFear = kind.goodNature ? 0 : Math.random() < 0.5 ? Math.random() * 0.4 : 0;
  h.pottyTraining = origin === "surrendered" ? Math.random() * 0.8 : Math.random() * 0.3;
  h.sensitiveBaby = false;
  // A name: the shelter's, or its old owner's
  const used = new Set([
    ...Object.values(typeof fluffyNames !== "undefined" ? fluffyNames : {}),
    ...shelter.residents.map((r) => r.name),
  ]);
  const pool =
    origin === "surrendered" && typeof OWNER_NAMES !== "undefined"
      ? [...(OWNER_NAMES[gender] || []), ...OWNER_NAMES.any]
      : SHELTER_NAMES;
  const fresh = pool.filter((n) => !used.has(n));
  const name = _shPick(fresh.length ? fresh : pool);
  // Given up by an owner: many miss them (Abandoned.js)
  if (origin === "surrendered" && Math.random() < 0.7) {
    h.personalities.push("abandoned");
    h._abandonedSetUp = true;
    h.missingOwner = 0.5 + Math.random() * 0.4;
  }
  const data = h.serialize();
  data.type = h.type;
  return {
    id: h.id,
    data,
    name,
    origin,
    notes: _shNotes(h),
    backstory: _shBackstory(origin, h),
    arrivedDay: dayNumber,
    timesUpDay: dayNumber + Math.round(_shRand(SHELTER_STAY_DAYS)),
    type: h.type,
    gender,
    grown: growth >= 1,
    ageText: _shAge(h),
  };
}

// Its first chapter (the Story tab, LifeStory.js)
const SHELTER_BACKSTORIES = {
  stray: [
    "Found alone in the rain behind the shops",
    "Found living under a bench in the park",
    "Found shivering in a cardboard box by the road",
    "Found hiding under a parked car, very hungry",
    "Brought in by a kind stranger who found {obj} in an alley",
  ],
  surrendered: [
    "Given up by an owner who moved away",
    "Given up when {poss} owner's new baby came",
    "Given up by an owner who said it was too much work",
    "Given up by a family whose children lost interest",
    "Given up after {poss} owner could no longer afford {obj}",
  ],
  born: ["Born at the shelter to a mother nobody adopted", "Born at the shelter, the smallest of {poss} litter"],
};
function _shBackstory(origin, h) {
  const list = SHELTER_BACKSTORIES[origin] || SHELTER_BACKSTORIES.stray;
  const male = h.gender === "male";
  return _shPick(list).replace(/\{poss\}/g, male ? "his" : "her").replace(/\{obj\}/g, male ? "him" : "her");
}

// ---- Every morning: time's up, new arrivals ----

function shelterDaysLeft(r) {
  const today = typeof getDayNumber === "function" ? getDayNumber() : 1;
  return r.timesUpDay - today;
}

function shelterFee(r) {
  const fee = SHELTER_ADOPT_FEE * (shelterDaysLeft(r) <= 0 ? SHELTER_LAST_DAY_DISCOUNT : 1);
  return Math.round(fee);
}

function shelterNewDay() {
  const today = typeof getDayNumber === "function" ? getDayNumber() : 1;
  // Time's up
  for (let i = shelter.residents.length - 1; i >= 0; i--) {
    const r = shelter.residents[i];
    if (r.timesUpDay >= today) continue;
    shelter.residents.splice(i, 1);
    shelter.lost = (shelter.lost || 0) + 1;
    _shelterTimeRanOut(r);
    if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `Time ran out for ${r.name} at the shelter.` });
  }
  // New arrivals
  const want = shelter.stocked ? Math.round(_shRand(SHELTER_ARRIVALS)) : SHELTER_START;
  shelter.stocked = true;
  for (let i = 0; i < want && shelter.residents.length < SHELTER_CAGES; i++) {
    shelter.residents.push(makeShelterResident(today));
  }
  _shelterPortraits = {};
}

// Runs every simulation step (Systems.js); works once a second
function updateShelter(dt) {
  if (!shelter || typeof shelter !== "object") shelter = freshShelter();
  for (const [k, v] of Object.entries(freshShelter())) if (shelter[k] === undefined) shelter[k] = v;
  if (!Array.isArray(shelter.residents)) shelter.residents = [];
  if (!shelterTicker.step(dt)) return;
  const day = typeof reportDayIndex === "function" ? reportDayIndex() : 0;
  if (shelter.day !== day) {
    shelter.day = day;
    shelterNewDay();
  }
  // They grow up and get older while they wait
  for (const r of shelter.residents) {
    r.data.age = (r.data.age || 0) + 1;
    if (r.data.growth < 1) r.data.growth = Math.min(1, r.data.growth + 1 / GROW_UP_TIME);
  }
}

// ---- Adopting ----

// Returns the new fluffy, or null (can't afford / not there)
function adoptShelterResident(id) {
  const idx = shelter.residents.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const r = shelter.residents[idx];
  const fee = shelterFee(r);
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < fee) {
    if (typeof addUIMessage === "function") addUIMessage(`You need $${fee.toLocaleString()} to adopt ${r.name}.`);
    return null;
  }
  if (!free) money -= fee;
  shelter.residents.splice(idx, 1);
  shelter.adopted = (shelter.adopted || 0) + 1;

  const data = JSON.parse(JSON.stringify(r.data));
  data.scene = SHELTER_SCENE;
  const desk = objects.find((o) => typeof DayCareDesk !== "undefined" && o instanceof DayCareDesk && o.scene === SHELTER_SCENE);
  data.x = width / 2 + (Math.random() * 120 - 60);
  data.y = desk ? desk.y + 60 + Math.random() * 40 : height * 0.55;
  const f = Horse.deserialize(data);
  f.scene = SHELTER_SCENE;
  f.adopted = true;
  f.arrivedFrom = "the shelter"; // (StoryBook: "came to you from the shelter")
  // (its relationships entry was dropped while it sat in a kennel)
  if (typeof relationships !== "undefined" && !relationships[f.id]) relationships[f.id] = {};
  fluffies.push(f);
  fluffyNames[f.id] = r.name;
  if (r.origin === "surrendered" && typeof previousOwnerNames !== "undefined") previousOwnerNames[f.id] = r.name;
  else {
    if (!shelter.named || typeof shelter.named !== "object") shelter.named = {};
    shelter.named[f.id] = r.name;
  }
  // Its first chapter, then "came to you from the shelter"
  if (typeof recordStory === "function" && r.backstory) recordStory("backstory", f, { x: r.backstory });
  if (typeof recordFluffy === "function") {
    const rec = recordFluffy(f);
    if (rec) rec.boughtFrom = "the Fluffy Shelter";
  }
  if (typeof poofs !== "undefined" && typeof Poof !== "undefined") poofs.push(new Poof(f.x, f.y, f.scene));
  if (typeof addUIMessage === "function") addUIMessage(`You adopted ${r.name} ($${fee}). Take ${f.gender === "female" ? "her" : "him"} home!`);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `You adopted ${r.name} from the shelter.` });
  _shelterPortraits = {};
  return f;
}

// ---- Giving one of yours up ----
// Instead of selling or dumping it: it goes into a kennel for someone else
// to adopt, with the usual time's-up day. It counts as leaving you (its
// story says so, and family at home miss it). If its time runs out, its
// story gets a last chapter. The shelter must have a free kennel.

const SHELTER_GIVE_UP_STAY = [4, 6];

function canGiveUpToShelter() {
  return shelter.residents.length < SHELTER_CAGES;
}

// Returns the new resident, or null (full / not yours)
function giveUpToShelter(f) {
  if (!f || !f.isAlive || !f.adopted) return null;
  if (!canGiveUpToShelter()) {
    if (typeof addUIMessage === "function") addUIMessage("The shelter has no free kennel today.");
    return null;
  }
  const today = typeof getDayNumber === "function" ? getDayNumber() : 1;
  if (typeof noteFluffyLeft === "function") noteFluffyLeft(f, "given up");
  if (f.isDragging) {
    isGlobalDragging = false;
    f.isDragging = false;
  }
  f.currentCage = null;
  f.placedOn = null;
  f.claimedBed = null;
  const i = fluffies.indexOf(f);
  if (i >= 0) fluffies.splice(i, 1);
  // It misses you, more the more it loved you (Abandoned.js)
  if (!f.personalities.includes("abandoned")) f.personalities.push("abandoned");
  f._abandonedSetUp = true;
  f.missingOwner = Math.max(0.3, Math.min(1, (f.playerTrust || 0) + 0.2));
  f.adopted = false;
  const data = f.serialize();
  data.type = f.type;
  const name = (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || _shPick(SHELTER_NAMES);
  const r = {
    id: f.id,
    data,
    name,
    origin: "surrendered",
    byYou: true,
    notes: _shNotes(f),
    arrivedDay: today,
    timesUpDay: today + Math.round(_shRand(SHELTER_GIVE_UP_STAY)),
    type: f.type,
    gender: f.gender,
    grown: f.growth >= 1,
    ageText: _shAge(f),
  };
  shelter.residents.push(r);
  _shelterPortraits = {};
  if (typeof addUIMessage === "function") addUIMessage(`You gave ${name} up to the shelter.`);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `You gave ${name} up to the shelter.` });
  return r;
}

// Time ran out for one you gave up: the last chapter of its story
function _shelterTimeRanOut(r) {
  if (!r.byYou) return;
  if (typeof recordStory === "function") recordStory("died", r.id, { x: "Time ran out at the shelter" });
  const rec = typeof getFamilyRecord === "function" ? getFamilyRecord(r.id) : null;
  if (rec) {
    rec.status = "dead";
    rec.causeOfDeath = "Put down at the shelter";
  }
}

// ---- Boarding (the desk; UIDayCare.js) ----
// Fed and kept safe, but lonely: happiness slowly drifts down
// (BOARD_LONELY_PER_DAY, not below BOARD_LONELY_FLOOR). It keeps ageing and
// can die of old age (you're told). Picking it up keeps its mood; a stay of
// a day or more goes in its story.
const BOARD_LONELY_PER_DAY = 0.05;
const BOARD_LONELY_FLOOR = 0.25;

function updateBoarders(dt) {
  if (typeof dayCareFluffies === "undefined" || !Array.isArray(dayCareFluffies)) return;
  for (let i = dayCareFluffies.length - 1; i >= 0; i--) {
    const d = dayCareFluffies[i];
    if (typeof d.happiness === "number" && d.happiness > BOARD_LONELY_FLOOR) {
      d.happiness = Math.max(BOARD_LONELY_FLOOR, d.happiness - (BOARD_LONELY_PER_DAY * dt) / DAY_LENGTH);
    }
    if (d.boardedAt === undefined) d.boardedAt = typeof timePlayed === "number" ? timePlayed : 0;
    // Old age
    const days = (d.age || 0) / DAY_LENGTH;
    if ((d.growth === undefined || d.growth >= 1) && days >= OLD_AGE_RISK_DAYS) {
      const risk = days >= MAX_AGE_DAYS ? 1 : Math.min(1, ((days - OLD_AGE_RISK_DAYS) / (MAX_AGE_DAYS - OLD_AGE_RISK_DAYS)) ** 2);
      if (Math.random() < (risk * dt) / DAY_LENGTH || days >= MAX_AGE_DAYS) {
        dayCareFluffies.splice(i, 1);
        const name = d.name || (typeof fluffyDisplayNameById === "function" ? fluffyDisplayNameById(d.id) : "A fluffy");
        if (typeof recordStory === "function") recordStory("died", d.id, { x: "Old age" });
        const rec = typeof getFamilyRecord === "function" ? getFamilyRecord(d.id) : null;
        if (rec) {
          rec.status = "dead";
          rec.causeOfDeath = "Old age (while boarded)";
        }
        if (typeof addUIMessage === "function") addUIMessage(`${name} died peacefully of old age while boarded at the shelter.`);
        if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `${name} died of old age while boarded at the shelter.` });
      }
    }
  }
}

// Picked up: a line in its story for a stay of a day or more
function onBoarderPickedUp(horse, data) {
  const since = data && typeof data.boardedAt === "number" ? data.boardedAt : null;
  if (since === null || typeof recordStory !== "function") return;
  const days = ((typeof timePlayed === "number" ? timePlayed : 0) - since) / DAY_LENGTH;
  if (days < 1) return;
  const long = typeof fluffyAgeText === "function" ? fluffyAgeText(days) : `${Math.round(days)} days`;
  const who = horse.gender === "male" ? "He" : "She";
  recordStory("boarding", horse, { x: `${who} spent ${long} boarded at the shelter.` });
}

// ---- The kennels (an object in the shelter room, like the desk) ----

function shelterCageRects() {
  const deskHalf = 170;
  const margin = 30;
  const gap = 12;
  const side = width / 2 - deskHalf - margin;
  const w = Math.min(130, Math.floor((side - gap * 2) / 3));
  const h = Math.round(w * 0.85);
  const y = Math.round(height * 0.15) + 60;
  const rects = [];
  for (let i = 0; i < 3; i++) rects.push({ x: margin + i * (w + gap), y, w, h });
  for (let i = 0; i < 3; i++) rects.push({ x: width - margin - (3 - i) * w - (2 - i) * gap, y, w, h });
  return rects;
}

function _shPortrait(r, size) {
  const key = r.id + ":" + size + ":" + (r.data.growth >= 1 ? 1 : Math.round(r.data.growth * 10));
  if (_shelterPortraits[key] === undefined) {
    let canvasOut = null;
    try {
      const h = new Horse(r.data.growth, null, SHELTER_SCENE, "earthy", r.data.genes.slice(), null, null, r.gender);
      if (typeof relationships !== "undefined") delete relationships[h.id];
      canvasOut = typeof drawFluffyPortraitCanvas === "function" ? drawFluffyPortraitCanvas(h, size) : null;
    } catch (e) {
      canvasOut = null;
    }
    _shelterPortraits[key] = canvasOut;
  }
  return _shelterPortraits[key];
}

class ShelterKennels {
  constructor(scene = SHELTER_SCENE) {
    this.id = nextObjectId++;
    this.scene = scene;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.updatePosition();
  }
  updatePosition() {
    const rects = shelterCageRects();
    this.x = width / 2;
    this.y = rects[0].y + rects[0].h + 22; // bottom of the plaques
  }
  update() {
    this.updatePosition();
  }
  onDrop() {}
  setPosition() {
    this.updatePosition();
  }
  getBottomY() {
    return this.y;
  }
  // Which cage (0-5) is at this point, or -1 (the plaque counts)
  cageAt(px, py) {
    const rects = shelterCageRects();
    for (let i = 0; i < rects.length; i++) {
      const c = rects[i];
      if (isPointInRect(px, py, c.x, c.y, c.w, c.h + 24)) return i;
    }
    return -1;
  }
  hitTest(px, py) {
    return this.cageAt(px, py) >= 0;
  }
  serialize() {
    return { classType: "ShelterKennels", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: null };
  }
  deserialize() {}
  draw(ctx) {
    const rects = shelterCageRects();
    ctx.save();
    for (let i = 0; i < rects.length; i++) {
      const c = rects[i];
      const r = shelter.residents[i] || null;
      // Back of the kennel
      ctx.fillStyle = "#3b3530";
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = "#5a4f45";
      ctx.fillRect(c.x, c.y + c.h - 12, c.w, 12); // the floor of it
      if (r) {
        const size = Math.round(c.h * 0.95);
        const p = _shPortrait(r, size);
        if (p) ctx.drawImage(p, c.x + (c.w - size) / 2, c.y + c.h - size + 4);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "italic 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Empty", c.x + c.w / 2, c.y + c.h / 2);
      }
      // Bars
      ctx.strokeStyle = "#9aa3a8";
      ctx.lineWidth = 3;
      for (let bx = c.x + 8; bx < c.x + c.w - 4; bx += 14) {
        ctx.beginPath();
        ctx.moveTo(bx, c.y + 2);
        ctx.lineTo(bx, c.y + c.h - 2);
        ctx.stroke();
      }
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#6e777c";
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      // The plaque
      const py = c.y + c.h + 2;
      ctx.fillStyle = r && shelterDaysLeft(r) <= 0 ? "#b0413e" : "#c9a84c";
      ctx.fillRect(c.x + 8, py, c.w - 16, 20);
      ctx.strokeStyle = "#5c4a1c";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c.x + 8, py, c.w - 16, 20);
      ctx.fillStyle = "#1e1a10";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      const label = r ? (shelterDaysLeft(r) <= 0 ? `${r.name} · last day` : r.name) : "—";
      ctx.fillText(typeof fitText === "function" ? fitText(ctx, label, c.w - 20) : label, c.x + c.w / 2, py + 14);
    }
    ctx.restore();
  }
  drawOffScreen(ctx) {
    this.draw(ctx);
  }
}

// ---- The plaque card (click a kennel) ----

function openShelterCard(i) {
  if (!shelter.residents[i]) return false;
  shelterCardIndex = i;
  return true;
}
function closeShelterCard() {
  shelterCardIndex = null;
}
function isShelterCardOpen() {
  return shelterCardIndex !== null && !!shelter.residents[shelterCardIndex];
}

function shelterCardLayout() {
  const w = Math.min(560, width - 40);
  const h = 420;
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  return {
    x,
    y,
    w,
    h,
    adopt: { x: x + w - 330, y: y + h - 58, w: 180, h: 40 },
    close: { x: x + w - 140, y: y + h - 58, w: 116, h: 40 },
  };
}

// The plaque, as lines of plain English
function shelterPlaqueLines(r) {
  const what = `${r.gender === "female" ? (r.grown ? "Mare" : "Filly") : r.grown ? "Stallion" : "Colt"}, ${r.type}, ${r.ageText}`;
  const origin = { stray: "Found as a stray", surrendered: "Given up by its owner", born: "Born here at the shelter" }[r.origin] || "";
  const left = shelterDaysLeft(r);
  const timesUp = left <= 0 ? `Time's up: today (Day ${r.timesUpDay}) - half price` : `Time's up: Day ${r.timesUpDay} (${left} day${left === 1 ? "" : "s"} left)`;
  return { what, origin, notes: r.notes.map((n) => `"${n}"`), timesUp };
}

function drawShelterCard(c) {
  if (!isShelterCardOpen()) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const r = shelter.residents[shelterCardIndex];
  const L = shelterCardLayout();
  c.save();
  drawScreenPanel(c, L, { theme: "pink" });
  // Portrait in its kennel
  const px = L.x + 24,
    py = L.y + 24,
    ps = 170;
  c.fillStyle = "#3b3530";
  c.fillRect(px, py, ps, ps);
  const p = _shPortrait(r, ps);
  if (p) c.drawImage(p, px, py);
  c.strokeStyle = "#9aa3a8";
  c.lineWidth = 3;
  for (let bx = px + 10; bx < px + ps - 4; bx += 18) {
    c.beginPath();
    c.moveTo(bx, py);
    c.lineTo(bx, py + ps);
    c.stroke();
  }
  // The plaque
  const lines = shelterPlaqueLines(r);
  const tx = px + ps + 24;
  const tw = L.x + L.w - 24 - tx;
  c.fillStyle = "#c9a84c";
  c.fillRect(tx - 10, py - 4, tw + 20, 250);
  c.strokeStyle = "#5c4a1c";
  c.lineWidth = 2;
  c.strokeRect(tx - 10, py - 4, tw + 20, 250);
  c.fillStyle = "#1e1a10";
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.font = "bold 24px Georgia, serif";
  c.fillText(fitText(c, r.name, tw), tx, py + 26);
  c.font = "15px Georgia, serif";
  let yy = py + 54;
  for (const line of [lines.what, lines.origin]) {
    c.fillText(fitText(c, line, tw), tx, yy);
    yy += 22;
  }
  c.font = "italic 15px Georgia, serif";
  yy += 6;
  for (const n of lines.notes) {
    c.fillText(fitText(c, n, tw), tx, yy);
    yy += 22;
  }
  c.font = "bold 14px Georgia, serif";
  c.fillStyle = shelterDaysLeft(r) <= 0 ? "#8a1c16" : "#1e1a10";
  c.fillText(fitText(c, lines.timesUp, tw), tx, py + 232);
  // What you can't know
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.font = "13px Arial";
  c.fillText("The plaque is all you get to read. What it's really like, you'll find out at home.", L.x + 24, L.y + L.h - 78);
  const fee = shelterFee(r);
  const afford = (typeof showDebugMenu !== "undefined" && showDebugMenu) || money >= fee;
  drawGlassButton(L.adopt.x, L.adopt.y, L.adopt.w, L.adopt.h, `Adopt ($${fee})`, { fontSize: 15, borderRadius: 10, disabled: !afford });
  drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 15, borderRadius: 10 });
  c.restore();
}

function handleShelterCardClick() {
  if (!isShelterCardOpen()) return false;
  const L = shelterCardLayout();
  const hit = (b) => isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h);
  if (hit(L.adopt)) {
    const r = shelter.residents[shelterCardIndex];
    if (adoptShelterResident(r.id)) closeShelterCard();
    return true;
  }
  if (hit(L.close) || !hit(L)) closeShelterCard();
  return true;
}

// ---- The front of the building, in Shelter Alley ----
// A brick front with the big sign beside the door (clear of the top bar's
// buttons), a sidewalk with paw prints to the door, an "Adopt" A-frame, a
// notice board that lists who's on their last day, and an after-hours drop
// box. All drawn behind everything else, like Fluff Mart's front (Store.js).

const SHELTER_FRONT_SCENE = "ALLEY_DAY_CARE";

function _shRound(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function _shPaw(c, x, y, s, colour) {
  c.fillStyle = colour;
  c.beginPath();
  c.ellipse(x, y + s * 0.25, s * 0.42, s * 0.34, 0, 0, Math.PI * 2);
  c.fill();
  for (const [dx, dy] of [[-0.42, -0.2], [-0.15, -0.45], [0.15, -0.45], [0.42, -0.2]]) {
    c.beginPath();
    c.ellipse(x + dx * s, y + dy * s, s * 0.14, s * 0.18, 0, 0, Math.PI * 2);
    c.fill();
  }
}

// Where things stand (also used by the tests)
function shelterFrontLayout() {
  const wallH = height * 0.15;
  const signX = doorRect.x + doorRect.w + 24;
  const signR = width - 130; // clear of the Household button
  return {
    wallH,
    sign: { x: signX, y: 6, w: Math.max(200, signR - signX), h: wallH - 16 },
    walk: { y: wallH, h: 64 },
    aframe: { x: doorRect.x + doorRect.w + 30, y: wallH + 70, w: 120, h: 118 },
    board: { x: doorRect.x - 250, y: wallH + 18, w: 210, h: 150 },
    dropBox: { x: width - 250, y: wallH + 40, w: 96, h: 112 },
  };
}

function shelterLastDayNames() {
  return (shelter && Array.isArray(shelter.residents) ? shelter.residents : []).filter((r) => shelterDaysLeft(r) <= 0).map((r) => r.name);
}

function drawShelterFront(c) {
  if (currentScene !== SHELTER_FRONT_SCENE) return;
  const L = shelterFrontLayout();
  c.save();
  // Brick front
  c.fillStyle = "#8c5a44";
  c.fillRect(0, 0, width, L.wallH);
  c.strokeStyle = "rgba(0,0,0,0.2)";
  c.lineWidth = 1;
  for (let y = 0, row = 0; y < L.wallH; y += 12, row++) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(width, y);
    c.stroke();
    for (let x = row % 2 ? 0 : 18; x < width; x += 36) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y + 12);
      c.stroke();
    }
  }
  // A lit window left of the door (below the top bar's buttons), with
  // little faces at the glass
  const winY = L.wallH - 36;
  for (const wx of [doorRect.x - 120]) {
    if (wx < 0 || wx + 90 > width) continue;
    c.fillStyle = "#f3d98b";
    c.fillRect(wx, winY, 90, 30);
    c.fillStyle = "rgba(90,70,40,0.45)";
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(wx + 18 + i * 27, winY + 26, 9, Math.PI, 0);
      c.fill();
    }
    c.strokeStyle = "#4a3326";
    c.lineWidth = 3;
    c.strokeRect(wx, winY, 90, 30);
    c.beginPath();
    c.moveTo(wx + 45, winY);
    c.lineTo(wx + 45, winY + 30);
    c.stroke();
  }
  // The sign
  const S = L.sign;
  c.fillStyle = "#2f5d50";
  _shRound(c, S.x, S.y, S.w, S.h, 10);
  c.fill();
  c.strokeStyle = "#f4e3b5";
  c.lineWidth = 3;
  c.stroke();
  _shPaw(c, S.x + 34, S.y + S.h * 0.46, Math.min(34, S.h * 0.5), "#f4e3b5");
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "#f4e3b5";
  c.font = `bold ${Math.round(Math.min(34, S.h * 0.36))}px Georgia, serif`;
  c.fillText("FLUFFY SHELTER", S.x + (S.w + 50) / 2, S.y + S.h * 0.36);
  c.fillStyle = "white";
  c.font = `${Math.round(Math.min(14, S.h * 0.16))}px Arial`;
  c.fillText("Adoptions · Boarding · Strays taken in", S.x + (S.w + 50) / 2, S.y + S.h * 0.74);

  // Sidewalk, curb, and paw prints to the door
  c.fillStyle = "#a9a49a";
  c.fillRect(0, L.walk.y, width, L.walk.h);
  c.strokeStyle = "rgba(0,0,0,0.15)";
  for (let x = 0; x < width; x += 64) {
    c.beginPath();
    c.moveTo(x, L.walk.y);
    c.lineTo(x, L.walk.y + L.walk.h);
    c.stroke();
  }
  c.fillStyle = "#86817a";
  c.fillRect(0, L.walk.y + L.walk.h, width, 6);
  for (let i = 0; i < 4; i++) {
    const px = width / 2 + (i % 2 ? 14 : -14);
    _shPaw(c, px, L.walk.y + L.walk.h + 60 - i * 26, 12, "rgba(70,60,50,0.35)");
  }

  // "Adopt" A-frame by the door
  const A = L.aframe;
  c.fillStyle = "#5b3b27";
  c.beginPath();
  c.moveTo(A.x + 10, A.y + A.h);
  c.lineTo(A.x + A.w / 2, A.y - 6);
  c.lineTo(A.x + A.w - 10, A.y + A.h);
  c.lineWidth = 5;
  c.strokeStyle = "#5b3b27";
  c.stroke();
  c.fillStyle = "#26302b";
  _shRound(c, A.x, A.y, A.w, A.h - 22, 6);
  c.fill();
  c.strokeStyle = "#5b3b27";
  c.lineWidth = 4;
  c.stroke();
  c.fillStyle = "white";
  c.font = "bold 17px Arial";
  c.fillText("ADOPT", A.x + A.w / 2, A.y + 20);
  c.fillText("A FLUFFY!", A.x + A.w / 2, A.y + 40);
  c.fillStyle = "#f7d774";
  c.font = "12px Arial";
  c.fillText(`from $${SHELTER_ADOPT_FEE}`, A.x + A.w / 2, A.y + 60);
  c.fillStyle = "#ff9d8a";
  c.fillText("last day: half price", A.x + A.w / 2, A.y + 78);

  // Notice board on posts
  const B = L.board;
  if (B.x > 10) {
    c.fillStyle = "#6b4a2f";
    c.fillRect(B.x + 16, B.y + B.h, 8, 40);
    c.fillRect(B.x + B.w - 24, B.y + B.h, 8, 40);
    c.fillStyle = "#c49a64";
    c.fillRect(B.x, B.y, B.w, B.h);
    c.strokeStyle = "#6b4a2f";
    c.lineWidth = 5;
    c.strokeRect(B.x, B.y, B.w, B.h);
    c.fillStyle = "#3a2a1a";
    c.font = "bold 13px Arial";
    c.fillText("NOTICES", B.x + B.w / 2, B.y + 14);
    // Pinned notes: who's on their last day, and a couple of others
    const last = shelterLastDayNames();
    const notes = [
      { t: last.length ? ["LAST DAY TODAY:", ...last.slice(0, 3)] : ["No one's time", "is up today"], bg: last.length ? "#ffe0dc" : "#f5f1e6", x: B.x + 8, y: B.y + 26, w: 104, h: 62 },
      { t: ["Found a stray?", "Bring it in."], bg: "#fff6c8", x: B.x + 118, y: B.y + 30, w: 84, h: 44 },
      { t: ["Adopt, don't", "breed!"], bg: "#dff0ff", x: B.x + 20, y: B.y + 96, w: 84, h: 44 },
      { t: [`${shelter && shelter.residents ? shelter.residents.length : 0} waiting`, "for a home"], bg: "#e3f5dc", x: B.x + 116, y: B.y + 88, w: 84, h: 44 },
    ];
    for (const n of notes) {
      c.fillStyle = n.bg;
      c.fillRect(n.x, n.y, n.w, n.h);
      c.fillStyle = "#c0392b";
      c.beginPath();
      c.arc(n.x + n.w / 2, n.y + 4, 3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#2a2118";
      c.font = "11px Arial";
      n.t.forEach((line, i) => c.fillText(fitText(c, line, n.w - 6), n.x + n.w / 2, n.y + 16 + i * 13));
    }
  }

  // After-hours drop box
  const D = L.dropBox;
  if (D.x > L.aframe.x + L.aframe.w + 20) {
    c.fillStyle = "#44535e";
    c.fillRect(D.x, D.y, D.w, D.h);
    c.fillStyle = "#1c2328";
    c.fillRect(D.x + 14, D.y + 16, D.w - 28, 12); // the slot
    c.strokeStyle = "#2a343b";
    c.lineWidth = 3;
    c.strokeRect(D.x, D.y, D.w, D.h);
    c.fillStyle = "white";
    c.font = "bold 11px Arial";
    c.fillText("AFTER-HOURS", D.x + D.w / 2, D.y + 50);
    c.fillText("DROP BOX", D.x + D.w / 2, D.y + 64);
    c.font = "10px Arial";
    c.fillStyle = "#c9d3d9";
    c.fillText("No questions", D.x + D.w / 2, D.y + 84);
    c.fillText("asked", D.x + D.w / 2, D.y + 97);
  }
  c.textBaseline = "alphabetic";
  c.restore();
}

registerScreen({
  name: "shelterCard",
  layer: 14,
  isOpen: () => isShelterCardOpen(),
  close: () => closeShelterCard(),
  draw: (c) => drawShelterCard(c),
  click: () => handleShelterCardClick(),
  reset: () => closeShelterCard(),
});

registerSystem("shelter", updateShelter, 182);
