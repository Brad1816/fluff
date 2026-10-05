// ---------------------------------------------------------------------------
// Maple Lane: your neighbours and their fluffies.
//
// A street of NB_HOUSES houses, left of Shopping Street (NB_SCENE). Each
// house has a neighbour (NB_KINDS: a kind old lady, a family, a careless
// one, a fussy one - three of the four at a time) and a pet or two: real
// fluffies (f.nbOwner = the house's id; not yours, can't be sold), out on
// the lawns by day and indoors at night (NB_HOME_SCENE, not drawn). Their
// owners feed them (by how careful they are).
//
// How a neighbour thinks of you: house.goodwill (-100..100), drifting back
// towards nothing. It moves with:
//   - complaints (by how fussy they are) about your yard: too many out in
//     the backyard, mess, bodies lying about (nbNuisance). Down far enough
//     and someone calls the council: a fine (NB_FINE, once a week at most)
//   - their fluffies visiting your backyard (the careless one's roam most):
//     a visitor plays - and maybe breeds - with yours, and goes home later.
//     Their mare in foal to your stallion: the kind ones are thrilled, the
//     fussy one is furious (NB_KINDS.reactBreed)
//   - pet-sitting: now and then one asks you to look after a pet for a day
//     or two (NB_SIT_*). Bring it back as you got it and you're paid and
//     liked; hurt, it's held against you; dead, never forgiven
//   - hurting their fluffies (they see), killing one (a fine as well),
//     keeping one (they ask for it back)
//   - selling them one: a neighbour may come to your door as a buyer
//     ("neighbour" in BUYER_KINDS) - it goes to live on Maple Lane
// Now and then the careless one moves away and leaves the pets behind (they
// end up in the alley as strays); a new neighbour moves in a few days later.
// Their pets' foals are found homes once they're weaned.
//
// Click a house's door for the neighbour: what they think of you, their
// pets, and anything they're asking. Saved: neighbourState (and the pets as
// fluffies: nbOwner, nbVisit, petSitting).
// ---------------------------------------------------------------------------

const NB_SCENE = "MAPLE_LANE";
const NB_HOME_SCENE = "MAPLE_HOME";
const NB_HOUSES = 3;
const NB_GOODWILL_DRIFT = 0.96; // a morning
const NB_FINE = 150;
const NB_FINE_GAP = 7; // days
const NB_COUNCIL_AT = -60;
const NB_VISIT_HOURS = [9, 18];
const NB_VISIT_LENGTH = [1.5, 4]; // game hours
const NB_SIT_PAY = 45; // a day
const NB_SIT_DAYS = [1, 2];
const NB_REQUEST_CHANCE = 0.35; // a morning, x the kind's sitChance... (see _nbMorning)
const NB_MOVE_GAP = [4, 8]; // days the house stands empty
const NB_FOAL_HOME_AT = 0.5; // growth: their foals are found homes
const NB_CROWD = 8; // more than this out in your backyard bothers them

const NB_KINDS = {
  kind: {
    name: "Kind old lady",
    who: ["Mrs. Pemberton", "Mrs. Abernathy", "Grandma Rosa"],
    blurb: "A kind old lady who spoils her fluffies rotten.",
    pets: [1, 2],
    lines: ["pastel", "white"],
    roam: 0.04,
    care: 1,
    sitChance: 1,
    complain: 0.1,
    buy: 1,
    reactBreed: { theirs: 5, yours: 0 },
    sitPay: 1.2,
    move: 0,
    house: "#f6dfe8",
    roof: "#9c5b6e",
    door: "#7b3f55",
  },
  family: {
    name: "Family",
    who: ["The Okonkwos", "The Harrisons", "The Lindqvists"],
    blurb: "A busy family whose kids love their fluffies - a bit roughly.",
    pets: [1, 2],
    lines: ["spots", "stripes", "pastel"],
    roam: 0.12,
    care: 0.85,
    sitChance: 0.7,
    complain: 0.35,
    buy: 1.5,
    reactBreed: { theirs: 3, yours: 0 },
    sitPay: 1,
    move: 0.005,
    house: "#dfeaf6",
    roof: "#4a6b8a",
    door: "#2f4a63",
  },
  careless: {
    name: "Careless",
    who: ["Dale", "Ricky Boone", "Shawna"],
    blurb: "Lets the fluffies wander and forgets to feed them.",
    pets: [1, 2],
    lines: ["hardy"],
    roam: 0.35,
    care: 0.55,
    sitChance: 0.3,
    complain: 0.15,
    buy: 0.5,
    reactBreed: { theirs: 0, yours: 0 },
    sitPay: 0.7,
    move: 0.04,
    house: "#e8e2cf",
    roof: "#6b6155",
    door: "#5a4a3a",
  },
  fussy: {
    name: "Fussy",
    who: ["Mr. Fenwick", "Mrs. Thistlewood", "Dr. Pryce"],
    blurb: "Fussy and house-proud, with one prize fluffy. Notices everything.",
    pets: [1, 1],
    lines: ["white", "mane"],
    roam: 0.02,
    care: 1,
    sitChance: 0.6,
    complain: 0.6,
    buy: 0.3,
    reactBreed: { theirs: -35, yours: -10 },
    sitPay: 1.7,
    move: 0.005,
    house: "#eef0e6",
    roof: "#3d5a3a",
    door: "#2a3f28",
  },
};

// ---- Scenes ----
if (typeof SCENES !== "undefined") {
  SCENES[NB_SCENE] = {
    id: NB_SCENE,
    isIndoor: false,
    insidePlayerQuarters: false,
    isOutdoor: true,
    isGrassy: false, // (no wild grass on the lawns: the owners feed them)
    isAlley: false,
    isAdoptionRoom: false,
    hasRiver: false,
    backgroundTexture: "texture_grass",
    topWallColor: null,
    spawnFerals: false,
    noDespawn: true,
    isMapleLane: true,
  };
  SCENES[NB_HOME_SCENE] = {
    id: NB_HOME_SCENE,
    isIndoor: true,
    insidePlayerQuarters: false,
    isOutdoor: false,
    isGrassy: false,
    isAlley: false,
    isAdoptionRoom: false,
    hasRiver: false,
    backgroundTexture: "texture_carpet",
    topWallColor: "#444",
    spawnFerals: false,
    noDespawn: true,
  };
}

// ---- State ----
function freshNeighbourState() {
  return { houses: [], lastDay: null, nextId: 1, finedDay: null, started: false };
}
let neighbourState = freshNeighbourState();
if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({
    name: "neighbourState",
    get: () => neighbourState,
    set: (v) => {
      neighbourState = v && typeof v === "object" ? v : freshNeighbourState();
    },
    fresh: () => freshNeighbourState(),
  });
}

function nbHouse(id) {
  return (neighbourState.houses || []).find((h) => h && h.id === id) || null;
}
function nbHouseAt(slot) {
  return (neighbourState.houses || []).find((h) => h && h.slot === slot) || null;
}
function nbPets(h) {
  if (!h) return [];
  return fluffies.filter((f) => f.nbOwner === h.id && f.isAlive);
}
function nbKindOf(h) {
  return h && !h.vacant ? NB_KINDS[h.kind] : null;
}
function isNbPet(f) {
  return !!(f && f.nbOwner != null && nbHouse(f.nbOwner));
}
function nbName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "it";
}
function _nbNote(h, text) {
  if (!h) return;
  h.notes = [{ day: getDayNumber(), text }, ...(h.notes || [])].slice(0, 6);
}
function _nbTell(h, text, news = true) {
  if (typeof addUIMessage === "function") addUIMessage(text);
  if (news && typeof noteDayEvent === "function") noteDayEvent("news", { text });
  _nbNote(h, text);
}
function nbGoodwill(h, d, why = null) {
  if (!h || h.vacant) return;
  h.goodwill = Math.max(-100, Math.min(100, (h.goodwill || 0) + d));
  if (why) _nbNote(h, why);
}
function nbGoodwillWord(g) {
  if (g >= 50) return "Thinks the world of you";
  if (g >= 20) return "Friendly";
  if (g > -20) return "Neutral";
  if (g > -50) return "Annoyed with you";
  return "Can't stand you";
}

// ---- Moving in and out ----
function _nbPetFor(h, k, rnd = Math.random) {
  if (typeof makeStockListing !== "function" || typeof Horse === "undefined") return null;
  const breeder = { name: h.who, line: k.lines[Math.floor(rnd() * k.lines.length)], about: "" };
  const l = makeStockListing(1, breeder, []);
  if (!l) return null;
  const f = new Horse(1, null, NB_SCENE, "earthy", l.genes.slice(), null, null, l.gender);
  if (typeof setSpawnAge === "function") setSpawnAge(f, 6, 40);
  f.adopted = false;
  f.nbOwner = h.id;
  f.happiness = 0.75;
  f.hunger = 1;
  f.playerTrust = 0.5;
  f.playerFear = 0;
  f.pottyTraining = 0.7;
  if (typeof fluffyNames !== "undefined") fluffyNames[f.id] = l.name;
  _nbLawnSpot(f, h.slot);
  fluffies.push(f);
  return f;
}

function nbMoveIn(slot, kindKey = null) {
  const used = new Set((neighbourState.houses || []).filter((h) => h && !h.vacant).map((h) => h.kind));
  const keys = Object.keys(NB_KINDS).filter((k) => !used.has(k));
  kindKey = kindKey || keys[Math.floor(Math.random() * keys.length)] || "kind";
  const k = NB_KINDS[kindKey];
  const usedNames = new Set((neighbourState.houses || []).map((h) => h && h.who));
  const names = k.who.filter((n) => !usedNames.has(n));
  const h = {
    id: neighbourState.nextId++,
    slot,
    kind: kindKey,
    who: (names.length ? names : k.who)[Math.floor(Math.random() * (names.length || k.who.length))],
    goodwill: 0,
    request: null,
    notes: [],
    movedIn: getDayNumber(),
    vacant: false,
  };
  neighbourState.houses = (neighbourState.houses || []).filter((x) => x.slot !== slot);
  neighbourState.houses.push(h);
  const n = k.pets[0] + Math.floor(Math.random() * (k.pets[1] - k.pets[0] + 1));
  for (let i = 0; i < n; i++) _nbPetFor(h, k);
  return h;
}

function nbMoveOut(h) {
  if (!h || h.vacant) return;
  const k = nbKindOf(h);
  const pets = nbPets(h);
  let left = 0;
  for (const f of pets) {
    if (f.petSitting) continue; // (it's with you: it stays a moment longer)
    if (h.kind === "careless") {
      // Left behind: they end up in the alley
      f.nbOwner = undefined;
      f.nbVisit = undefined;
      f.scene = "ALLEY";
      f.x = 200 + Math.random() * (width - 400);
      f.y = height * 0.65;
      f.formerPet = { how: "dumped", day: getDayNumber(), name: nbName(f) };
      if (typeof f.changeHappiness === "function") f.changeHappiness(-0.2, "Left behind when its owner moved");
      left++;
    } else {
      const i = fluffies.indexOf(f);
      if (i >= 0) fluffies.splice(i, 1);
    }
  }
  const was = h.who;
  const [lo, hi] = NB_MOVE_GAP;
  Object.assign(h, { vacant: true, request: null, until: getDayNumber() + lo + Math.floor(Math.random() * (hi - lo + 1)) });
  _nbTell(h, left ? `${was} has moved away from Maple Lane - and left ${left === 1 ? "a fluffy" : `${left} fluffies`} behind. ${left === 1 ? "It's" : "They're"} wandering the alley now.` : `${was} has moved away from Maple Lane.`);
  return k;
}

// ---- Where things are on the lane ----
function nbHouseRect(slot) {
  const top = height * 0.03;
  const gap = 24;
  const w = Math.min(340, (width - 140 - gap * (NB_HOUSES - 1)) / NB_HOUSES);
  const total = w * NB_HOUSES + gap * (NB_HOUSES - 1);
  const x0 = (width - total) / 2;
  return { x: x0 + slot * (w + gap), y: top, w, h: height * 0.36 };
}
function nbDoorRect(slot) {
  const r = nbHouseRect(slot);
  const dw = Math.min(54, r.w * 0.2);
  return { x: r.x + r.w / 2 - dw / 2, y: r.y + r.h - 88, w: dw, h: 88 };
}
function _nbLawnSpot(f, slot) {
  const r = nbHouseRect(slot);
  f.scene = NB_SCENE;
  f.x = r.x + 40 + Math.random() * (r.w - 80);
  f.y = height * 0.5 + Math.random() * (height * 0.2);
  f.targetX = null;
  f.targetY = null;
}

// ---- Your yard, as they see it ----
function nbNuisance() {
  const out = fluffies.filter((f) => f.isAlive && f.adopted && f.scene === "BACKYARD").length;
  const bodies = fluffies.filter((f) => !f.isAlive && (f.scene === "BACKYARD" || f.scene === "OUTDOORS")).length;
  let mess = 0;
  if (typeof puddles !== "undefined") for (const p of puddles) if (p.scene === "BACKYARD" || p.scene === "OUTDOORS") mess += (p.points || []).length;
  const parts = [
    { why: "how many fluffies you keep out in the yard", v: Math.max(0, out - NB_CROWD) * 0.12 },
    { why: "the bodies lying about your yard", v: bodies * 0.5 },
    { why: "the mess and the smell from your yard", v: Math.max(0, mess - 30) * 0.01 },
  ];
  const total = parts.reduce((a, p) => a + p.v, 0);
  const worst = parts.slice().sort((a, b) => b.v - a.v)[0];
  return { total, why: worst.why };
}

// ---- A morning on Maple Lane ----
function _nbMorning() {
  const day = getDayNumber();
  const lvl = typeof getOrderLevel === "function" ? getOrderLevel() : 1;
  for (let slot = 0; slot < NB_HOUSES; slot++) {
    const h = nbHouseAt(slot);
    if (!h) {
      nbMoveIn(slot);
      continue;
    }
    if (h.vacant) {
      if (day >= (h.until || 0)) {
        const nh = nbMoveIn(slot);
        _nbTell(nh, `${nh.who} moved into Maple Lane. ${NB_KINDS[nh.kind].blurb}`);
      }
      continue;
    }
    const k = nbKindOf(h);
    h.goodwill = Math.round((h.goodwill || 0) * NB_GOODWILL_DRIFT * 10) / 10;
    // An old request lapses
    if (h.request && h.request.kind === "sit" && !h.request.accepted && day > h.request.day) h.request = null;
    // Complaints
    const nz = nbNuisance();
    if (nz.total > 0.5 && Math.random() < k.complain) {
      nbGoodwill(h, -Math.round(4 + nz.total * 4));
      _nbTell(h, `${h.who} complained about ${nz.why}.`);
    }
    // Asking a favour: look after a pet
    const pets = nbPets(h).filter((f) => f.growth >= 0.5 && !f.petSitting && !f.adopted);
    if (!h.request && pets.length && h.goodwill > -30 && Math.random() < NB_REQUEST_CHANCE * k.sitChance * 0.5) {
      const pet = pets[Math.floor(Math.random() * pets.length)];
      const days = NB_SIT_DAYS[0] + Math.floor(Math.random() * (NB_SIT_DAYS[1] - NB_SIT_DAYS[0] + 1));
      h.request = { kind: "sit", petId: pet.id, days, pay: Math.round((NB_SIT_PAY * days * k.sitPay * (1 + 0.1 * (lvl - 1))) / 5) * 5, day };
      _nbTell(h, `${h.who} is going away for ${days === 1 ? "a day" : `${days} days`} - could you look after ${nbName(pet)}? ($${h.request.pay}; knock on their door on Maple Lane)`, false);
    }
    // Moving away
    if (k.move && Math.random() < k.move && !nbPets(h).some((f) => f.petSitting)) {
      nbMoveOut(h);
      continue;
    }
  }
  // Council
  const worst = (neighbourState.houses || []).filter((h) => !h.vacant).sort((a, b) => a.goodwill - b.goodwill)[0];
  if (worst && worst.goodwill <= NB_COUNCIL_AT && (neighbourState.finedDay == null || day - neighbourState.finedDay >= NB_FINE_GAP)) {
    neighbourState.finedDay = day;
    if (!(typeof showDebugMenu !== "undefined" && showDebugMenu)) money -= NB_FINE;
    if (typeof noteSpending === "function") noteSpending(NB_FINE);
    _nbTell(worst, `${worst.who} called the council on you. A $${NB_FINE} fine for being a nuisance neighbour.`);
  }
}

// ---- Every couple of seconds ----
const nbTicker = new Ticker(2);
function updateNeighbours(dt) {
  if (!nbTicker.step(dt)) return;
  if (!neighbourState || typeof neighbourState !== "object") neighbourState = freshNeighbourState();
  const day = getDayNumber();
  if (neighbourState.lastDay !== day) {
    neighbourState.lastDay = day;
    _nbMorning();
  }
  const hour = typeof gameHour === "function" ? gameHour() : 12;
  const night = hour >= 20 || hour < 7;
  const visitTime = hour >= NB_VISIT_HOURS[0] && hour < NB_VISIT_HOURS[1];
  for (const f of fluffies) {
    if (f.nbOwner == null) continue;
    const h = nbHouse(f.nbOwner);
    if (!h || h.vacant) {
      f.nbOwner = undefined;
      continue;
    }
    const k = nbKindOf(h);
    if (!f.isAlive) {
      _nbPetDied(h, f);
      continue;
    }
    // Hurt by you, and they saw (or heard about it)
    if (typeof f.hurtByPlayerAt === "number" && f._nbHurtSeen !== f.hurtByPlayerAt) {
      f._nbHurtSeen = f.hurtByPlayerAt;
      nbGoodwill(h, -15);
      _nbTell(h, `${h.who} heard you hurt ${nbName(f)}. They're not happy.`);
    }
    // Kept as yours
    if (f.adopted) {
      if (!h.request || h.request.kind !== "return") {
        h.request = { kind: "return", petId: f.id, day };
        _nbTell(h, `${h.who} is looking for ${nbName(f)} - and thinks you might have it.`, false);
      }
      continue;
    }
    if (f.petSitting) {
      _nbSitting(h, f);
      continue;
    }
    if (f.isDragging || f.currentCage) continue;
    // Foals found homes once they're weaned
    if (f.growth >= NB_FOAL_HOME_AT && f.growth < 1 && f._nbBorn) {
      const i = fluffies.indexOf(f);
      if (i >= 0) fluffies.splice(i, 1);
      _nbNote(h, `${h.who} found a home for ${nbName(f)}.`);
      continue;
    }
    // Visiting you
    if (f.nbVisit) {
      if (timePlayed >= f.nbVisit.until || night) _nbVisitEnds(h, f);
      continue;
    }
    // Night in, morning out
    if (night && f.scene === NB_SCENE) {
      f.scene = NB_HOME_SCENE;
      f.targetX = null;
      f.targetY = null;
    } else if (!night && f.scene === NB_HOME_SCENE) _nbLawnSpot(f, h.slot);
    // (on the lawns, not up the house fronts)
    if (f.scene === NB_SCENE && !f.isDragging) f.y = Math.max(height * 0.42, Math.min(height * 0.72, f.y));
    // Fed at home (as well as their owner remembers)
    if (f.scene === NB_SCENE || f.scene === NB_HOME_SCENE) {
      if (f.hunger < k.care) f.hunger = Math.min(1, f.hunger + 0.02);
      if (typeof f.thirst === "number" && f.thirst < k.care) f.thirst = Math.min(1, f.thirst + 0.02);
    }
    // Off over the fence to see yours
    if (visitTime && f.scene === NB_SCENE && f.growth >= 0.6 && Math.random() < (k.roam * 2) / HOUR_LENGTH) _nbVisitStarts(h, f); // (about k.roam visits an hour)
  }
  // Foals born on the lane are the neighbour's
  for (const f of fluffies) {
    if (f.nbOwner != null || f.adopted || !f.isAlive || f.motherId == null) continue;
    if (f.scene !== NB_SCENE && f.scene !== NB_HOME_SCENE) continue;
    const mum = fluffyById(f.motherId);
    if (mum && mum.nbOwner != null) {
      f.nbOwner = mum.nbOwner;
      f._nbBorn = true;
    }
  }
}
registerSystem("neighbours", updateNeighbours, 173);

function _nbVisitStarts(h, f) {
  const left = Math.random() < 0.5;
  f.scene = "BACKYARD";
  f.x = left ? 70 : width - 70;
  f.y = height * 0.55 + Math.random() * height * 0.2;
  f.targetX = width / 2 + (Math.random() - 0.5) * 300;
  f.targetY = f.y;
  const [lo, hi] = NB_VISIT_LENGTH;
  f.nbVisit = { until: timePlayed + (lo + Math.random() * (hi - lo)) * HOUR_LENGTH };
  if (typeof addUIMessage === "function") addUIMessage(`${h.who}'s ${nbName(f)} has wandered into your backyard.`);
  return true;
}
function _nbVisitEnds(h, f) {
  if (f.isDragging || f.currentCage) return false;
  f.nbVisit = undefined;
  if (f.scene === "BACKYARD" && currentScene === "BACKYARD" && typeof addUIMessage === "function") addUIMessage(`${nbName(f)} has gone home to ${h.who}.`);
  _nbLawnSpot(f, h.slot);
  return true;
}

// ---- Breeding (HorseAnatomy.triggerPregnancy) ----
function onNeighbourMating(mother, father) {
  if (!mother || !father) return;
  const theirsM = mother.nbOwner != null ? nbHouse(mother.nbOwner) : null;
  const theirsF = father.nbOwner != null ? nbHouse(father.nbOwner) : null;
  if (theirsM && !theirsF && father.adopted) {
    const k = nbKindOf(theirsM);
    const d = k ? k.reactBreed.theirs : 0;
    nbGoodwill(theirsM, d);
    const text =
      d > 0
        ? `${theirsM.who}'s ${nbName(mother)} is in foal to your ${nbName(father)} - and ${theirsM.who} is thrilled!`
        : d < 0
          ? `${theirsM.who}'s ${nbName(mother)} is in foal to your ${nbName(father)}. ${theirsM.who} is furious.`
          : `${theirsM.who}'s ${nbName(mother)} is in foal to your ${nbName(father)}. ${theirsM.who} shrugs.`;
    _nbTell(theirsM, text);
  } else if (theirsF && !theirsM && mother.adopted) {
    const k = nbKindOf(theirsF);
    const d = k ? k.reactBreed.yours : 0;
    if (d) nbGoodwill(theirsF, d);
    _nbTell(theirsF, d < 0 ? `Your ${nbName(mother)} is in foal to ${theirsF.who}'s ${nbName(father)}. ${theirsF.who} is offended - "a pedigree like that!"` : `Your ${nbName(mother)} is in foal to ${theirsF.who}'s ${nbName(father)}.`);
  }
}

// ---- Pet-sitting ----
function nbAcceptSit(h) {
  const r = h && h.request;
  if (!r || r.kind !== "sit" || r.accepted) return false;
  const f = fluffyById(r.petId);
  if (!f || !f.isAlive || f.nbOwner !== h.id) {
    h.request = null;
    return false;
  }
  r.accepted = true;
  f.nbVisit = undefined;
  f.petSitting = {
    house: h.id,
    until: timePlayed + r.days * DAY_LENGTH,
    pay: r.pay,
    health: f.health ?? 100,
    scars: Array.isArray(f.scars) ? f.scars.length : 0,
  };
  f.scene = "INDOORS";
  f.x = width / 2 + (Math.random() - 0.5) * 200;
  f.y = height * 0.65;
  f.targetX = null;
  f.targetY = null;
  _nbTell(h, `You're looking after ${h.who}'s ${nbName(f)} for ${r.days === 1 ? "a day" : `${r.days} days`}. It's in your house.`, false);
  return true;
}
function nbDeclineRequest(h) {
  if (!h || !h.request) return;
  if (h.request.kind === "sit" && !h.request.accepted) nbGoodwill(h, -1);
  h.request = null;
}
function _nbSitting(h, f) {
  const s = f.petSitting;
  if (timePlayed < s.until) return;
  if (f.isDragging) return;
  nbEndSit(h, f);
}
// They come back for it: how is it?
function nbEndSit(h, f) {
  const s = f.petSitting;
  if (!s) return null;
  const hurt = (s.health ?? 100) - (f.health ?? 100);
  const newScars = (Array.isArray(f.scars) ? f.scars.length : 0) - (s.scars || 0);
  const hungry = (f.hunger ?? 1) < 0.3;
  const sad = (f.happiness ?? 1) < 0.35;
  let pay = s.pay;
  let d = 12;
  let how = "is delighted - it's in fine shape";
  if (hurt > 30 || newScars > 0) {
    pay = 0;
    d = -30;
    how = "is horrified - it's been hurt";
  } else if (hurt > 10 || hungry || sad) {
    pay = Math.round(pay * 0.5);
    d = -5;
    how = hungry ? "isn't impressed - it's half-starved" : sad ? "isn't impressed - it's miserable" : "isn't impressed - it's a bit worse for wear";
  }
  if (f.isPregnant && f.babyDaddyId != null) {
    const dad = fluffyById(f.babyDaddyId);
    if (dad && dad.adopted) {
      const k = nbKindOf(h);
      d += k ? k.reactBreed.theirs : 0;
      how += ", and it's in foal";
    }
  }
  if (pay && !(typeof showDebugMenu !== "undefined" && showDebugMenu)) money += pay;
  if (pay && typeof noteIncome === "function") noteIncome(pay);
  nbGoodwill(h, d);
  f.petSitting = undefined;
  if (h.request && h.request.kind === "sit") h.request = null;
  _nbLawnSpot(f, h.slot);
  // (any foals she had while she was with you go home with her)
  for (const o of fluffies) if (o.nbOwner === h.id && o.motherId === f.id && o.isAlive && !o.petSitting && o.scene !== NB_SCENE && o.scene !== NB_HOME_SCENE) _nbLawnSpot(o, h.slot);
  _nbTell(h, `${h.who} came back for ${nbName(f)} and ${how}.${pay ? ` Paid $${pay}.` : ""}`);
  return { pay, d };
}

// ---- Losing one ----
function _nbPetDied(h, f) {
  if (f._nbMourned) return;
  f._nbMourned = true;
  const byYou = !!f.killedByPlayer;
  const yours = !!f.petSitting;
  if (byYou) {
    nbGoodwill(h, -80);
    if (!(typeof showDebugMenu !== "undefined" && showDebugMenu)) money -= NB_FINE * 2;
    _nbTell(h, `${h.who} found out you killed ${nbName(f)}. The police came round: a $${NB_FINE * 2} fine.`);
  } else if (yours) {
    nbGoodwill(h, -60);
    _nbTell(h, `${nbName(f)} died while you were looking after it. ${h.who} will never forgive you.`);
  } else _nbNote(h, `${h.who} lost ${nbName(f)}.`);
  f.petSitting = undefined;
  if (h.request && h.request.petId === f.id) h.request = null;
  // (they take the body away)
  if (f.scene === NB_SCENE || f.scene === NB_HOME_SCENE || yours || f.scene === "BACKYARD") {
    const i = fluffies.indexOf(f);
    if (i >= 0) fluffies.splice(i, 1);
  }
}

// ---- Kept one: give it back, or keep it ----
function nbReturnPet(h) {
  const r = h && h.request;
  if (!r || r.kind !== "return") return false;
  const f = fluffyById(r.petId);
  if (f && f.isAlive) {
    f.adopted = false;
    f.notForSale = false;
    _nbLawnSpot(f, h.slot);
  }
  h.request = null;
  nbGoodwill(h, -5);
  _nbTell(h, `You gave ${f ? nbName(f) : "it"} back to ${h.who}. They're cool with you.`, false);
  return true;
}
function nbKeepPet(h) {
  const r = h && h.request;
  if (!r || r.kind !== "return") return false;
  const f = fluffyById(r.petId);
  if (f) f.nbOwner = undefined;
  h.request = null;
  nbGoodwill(h, -40);
  _nbTell(h, `You kept ${f ? nbName(f) : "it"}. ${h.who} won't forget it.`);
  return true;
}

// ---- Selling them one (a buyer at your door) ----
function _nbBuyerHouse() {
  return (neighbourState.houses || []).filter((h) => !h.vacant && h.goodwill >= 0 && nbPets(h).length < 3).sort((a, b) => b.goodwill - a.goodwill)[0] || null;
}
if (typeof BUYER_KINDS !== "undefined") {
  BUYER_KINDS.push({
    id: "neighbour",
    get label() {
      const h = _nbBuyerHouse();
      return h ? `${h.who} from Maple Lane` : "A neighbour";
    },
    wants: "a sweet pet for the house",
    budget: 1.05,
    patience: 2,
    generous: 0.2,
    weight: () => {
      const h = _nbBuyerHouse();
      return h ? 0.4 * NB_KINDS[h.kind].buy * (1 + Math.max(0, h.goodwill) / 50) : 0;
    },
    like: (f) => (f.isAlive ? Math.max(0.1, Math.min(1, 0.3 + (f.happiness ?? 0.5) * 0.5 + (f.playerTrust ?? 0.5) * 0.3)) : 0),
  });
}
// Buyers.acceptSellRequest: true if it went to Maple Lane
function onSoldToNeighbour(f, req) {
  if (!f || !req || req.buyer !== "neighbour") return false;
  const h = _nbBuyerHouse();
  if (!h) return false;
  f.adopted = false;
  f.notForSale = false;
  f.nbOwner = h.id;
  f.nbVisit = undefined;
  if (f.isDragging) {
    f.isDragging = false;
    if (typeof isGlobalDragging !== "undefined") isGlobalDragging = false;
  }
  f.currentCage = null;
  _nbLawnSpot(f, h.slot);
  nbGoodwill(h, 8);
  _nbTell(h, `${nbName(f)} has gone to live with ${h.who} on Maple Lane. You can visit.`, false);
  return true;
}

// ---- Getting there (UIScenes.js) ----
function getMapleLanePortals(scene) {
  if (scene !== NB_SCENE) return null;
  return [
    {
      type: "arrow_right",
      x: width - 80,
      y: height / 2 - 40,
      w: 60,
      h: 80,
      target: "SHOP_STREET",
      label: "To Shopping Street",
    },
  ];
}

// ---- Drawing the lane (script.js, with the scenery) ----
function drawMapleLane(c) {
  if (currentScene !== NB_SCENE) return;
  c.save();
  // Sky behind the houses
  const g = c.createLinearGradient(0, 0, 0, height * 0.4);
  g.addColorStop(0, "#9fd3f5");
  g.addColorStop(1, "#d8eef9");
  c.fillStyle = g;
  c.fillRect(0, 0, width, height * 0.4);
  // Pavement and road
  c.fillStyle = "#c9c4bb";
  c.fillRect(0, height * 0.8, width, height * 0.06);
  c.fillStyle = "#55595e";
  c.fillRect(0, height * 0.86, width, height * 0.14);
  c.strokeStyle = "#f2d64b";
  c.lineWidth = 4;
  c.setLineDash([30, 24]);
  c.beginPath();
  c.moveTo(0, height * 0.93);
  c.lineTo(width, height * 0.93);
  c.stroke();
  c.setLineDash([]);
  for (let slot = 0; slot < NB_HOUSES; slot++) _nbDrawHouse(c, slot);
  // Street sign
  c.fillStyle = "#2e7d32";
  c.fillRect(24, height * 0.42, 130, 30);
  c.fillStyle = "white";
  c.font = "bold 15px Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("Maple Lane", 89, height * 0.42 + 15);
  c.fillStyle = "#555";
  c.fillRect(86, height * 0.42 + 30, 6, height * 0.1);
  c.restore();
}

function _nbDrawHouse(c, slot) {
  const r = nbHouseRect(slot);
  const h = nbHouseAt(slot);
  const k = nbKindOf(h);
  const wall = k ? k.house : "#ddd6cc";
  const roof = k ? k.roof : "#7a7068";
  const door = k ? k.door : "#6b5b4b";
  // Roof
  c.fillStyle = roof;
  c.beginPath();
  c.moveTo(r.x - 12, r.y + r.h * 0.38);
  c.lineTo(r.x + r.w / 2, r.y);
  c.lineTo(r.x + r.w + 12, r.y + r.h * 0.38);
  c.closePath();
  c.fill();
  // Walls
  c.fillStyle = wall;
  c.fillRect(r.x, r.y + r.h * 0.36, r.w, r.h * 0.64);
  c.strokeStyle = "rgba(0,0,0,0.25)";
  c.lineWidth = 2;
  c.strokeRect(r.x, r.y + r.h * 0.36, r.w, r.h * 0.64);
  // Windows
  const wy = r.y + r.h * 0.46;
  const ww = Math.min(60, r.w * 0.2);
  for (const wx of [r.x + r.w * 0.12, r.x + r.w * 0.88 - ww]) {
    c.fillStyle = k && typeof nightAmount === "function" && nightAmount() > 0.5 ? "#ffe9a8" : "#bfe1f3";
    c.fillRect(wx, wy, ww, ww * 0.8);
    c.strokeStyle = "#fff";
    c.lineWidth = 3;
    c.strokeRect(wx, wy, ww, ww * 0.8);
  }
  // Door
  const d = nbDoorRect(slot);
  c.fillStyle = door;
  c.fillRect(d.x, d.y, d.w, d.h);
  c.fillStyle = "#ffd54f";
  c.beginPath();
  c.arc(d.x + d.w - 9, d.y + d.h / 2, 3, 0, Math.PI * 2);
  c.fill();
  // Name plate / for sale
  c.textAlign = "center";
  c.textBaseline = "middle";
  if (k) {
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fillRect(r.x + r.w / 2 - 80, r.y + r.h * 0.38, 160, 20);
    c.fillStyle = "#333";
    c.font = "bold 12px Arial";
    c.fillText(fitText(c, `No. ${slot + 1} - ${h.who}`, 154), r.x + r.w / 2, r.y + r.h * 0.38 + 10);
    // Something to ask: a note on the door
    if (h.request) {
      c.fillStyle = "#fff8c4";
      c.fillRect(d.x + 6, d.y + 14, d.w - 12, 18);
      c.fillStyle = "#b71c1c";
      c.font = "bold 13px Arial";
      c.fillText("!", d.x + d.w / 2, d.y + 23);
    }
  } else {
    c.fillStyle = "#c62828";
    c.fillRect(r.x + r.w - 90, r.y + r.h - 70, 80, 34);
    c.fillStyle = "white";
    c.font = "bold 13px Arial";
    c.fillText("FOR SALE", r.x + r.w - 50, r.y + r.h - 53);
  }
  // Picket fence along the lawn's front
  c.fillStyle = "#fbfbf6";
  const fy = height * 0.74;
  for (let x = r.x; x < r.x + r.w; x += 16) {
    c.fillRect(x, fy, 9, 26);
    c.beginPath();
    c.moveTo(x, fy);
    c.lineTo(x + 4.5, fy - 6);
    c.lineTo(x + 9, fy);
    c.fill();
  }
  c.fillRect(r.x, fy + 8, r.w, 5);
  // Hover hint
  if (_nbOverDoor(slot, mouse.x, mouse.y) && !isGlobalDragging) {
    c.fillStyle = "rgba(0,0,0,0.7)";
    c.fillRect(d.x + d.w / 2 - 70, d.y - 30, 140, 22);
    c.fillStyle = "white";
    c.font = "13px Arial";
    c.fillText(k ? "Knock" : "Nobody lives here", d.x + d.w / 2, d.y - 19);
  }
}

function _nbOverDoor(slot, px, py) {
  if (currentScene !== NB_SCENE) return false;
  const d = nbDoorRect(slot);
  return px >= d.x - 6 && px <= d.x + d.w + 6 && py >= d.y && py <= d.y + d.h;
}

// ---- Knocking: the neighbour's panel ----
let nbPanelSlot = null;
let _nbUI = { buttons: [] };
const _nbPortraits = new Map();

function nbDoorClick() {
  if (currentScene !== NB_SCENE || isGlobalDragging) return false;
  for (let slot = 0; slot < NB_HOUSES; slot++) {
    if (!_nbOverDoor(slot, mouse.x, mouse.y)) continue;
    const h = nbHouseAt(slot);
    if (!h || h.vacant) {
      if (typeof addUIMessage === "function") addUIMessage("Nobody lives here right now.");
      return true;
    }
    nbPanelSlot = slot;
    _nbPortraits.clear();
    return true;
  }
  return false;
}
function closeNeighbourPanel() {
  nbPanelSlot = null;
}
function _nbLayout() {
  const w = Math.min(700, width - 40);
  const h = Math.min(430, height - 40);
  return { x: Math.round(width / 2 - w / 2), y: Math.round(height / 2 - h / 2), w, h };
}
function _nbPortrait(f, size) {
  const key = f.id + ":" + size;
  if (!_nbPortraits.has(key)) _nbPortraits.set(key, typeof drawFluffyPortraitCanvas === "function" ? drawFluffyPortraitCanvas(f, size) : null);
  return _nbPortraits.get(key);
}
function _nbBtn(c, r, label, colour = "#2e7d32") {
  const over = isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h);
  fillRoundRect(c, r.x, r.y, r.w, r.h, 8, over ? "#43a047" : colour);
  c.fillStyle = "white";
  c.font = "bold 13px Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(fitText(c, label, r.w - 10), r.x + r.w / 2, r.y + r.h / 2 + 1);
  _nbUI.buttons.push(r);
}
function _nbStatus(f) {
  if (f.petSitting) return "With you (pet-sitting)";
  if (f.adopted) return "With you - not yours!";
  if (f.nbVisit) return "Visiting your backyard";
  if (f.scene === NB_HOME_SCENE) return "Indoors";
  if (f.scene === NB_SCENE) return "Out on the lawn";
  return "Out and about";
}

function drawNeighbourPanel(c) {
  if (nbPanelSlot === null) return;
  const h = nbHouseAt(nbPanelSlot);
  if (!h || h.vacant) {
    nbPanelSlot = null;
    return;
  }
  const k = nbKindOf(h);
  const L = _nbLayout();
  drawScreenPanel(c, L);
  _nbUI = { buttons: [] };
  _nbBtn(c, { x: L.x + L.w - 44, y: L.y + 10, w: 34, h: 30, act: "close" }, "✕", "#8e3b3b");
  const x = L.x + 22;
  let y = L.y + 34;
  canvasText(c, fitText(c, `${h.who} (No. ${h.slot + 1})`, L.w - 90), x, y, "#ffd6f0", "bold 22px Arial");
  y += 22;
  canvasText(c, fitText(c, k.blurb, L.w - 44), x, y, "#b9b0c9", "italic 13px Arial");
  y += 26;
  // Goodwill
  const gw = Math.min(260, L.w - 220);
  canvasText(c, nbGoodwillWord(h.goodwill || 0), x, y, "#e8e0f4", "bold 14px Arial");
  fillRoundRect(c, x + 190, y - 11, gw, 12, 6, "rgba(255,255,255,0.15)");
  const t = ((h.goodwill || 0) + 100) / 200;
  fillRoundRect(c, x + 190, y - 11, Math.max(6, gw * t), 12, 6, t >= 0.6 ? "#66bb6a" : t >= 0.4 ? "#ffd54f" : "#ef5350");
  y += 18;
  // Their fluffies
  const pets = nbPets(h);
  pets.slice(0, 3).forEach((f, i) => {
    const cx = x + i * 150;
    fillRoundRect(c, cx, y, 140, 132, 10, "rgba(255,255,255,0.75)");
    const p = _nbPortrait(f, 76);
    if (p) c.drawImage(p, cx + 32, y + 4, 76, 76);
    canvasText(c, fitText(c, nbName(f), 130), cx + 70, y + 96, "#222", "bold 13px Arial", "center");
    canvasText(c, fitText(c, _nbStatus(f), 130), cx + 70, y + 116, "#555", "11px Arial", "center");
  });
  if (!pets.length) canvasText(c, "No fluffies just now.", x, y + 20, "#b9b0c9", "italic 13px Arial");
  // Notes
  const nx = x + 3 * 150;
  const nw = L.x + L.w - 22 - nx;
  if (nw > 110) {
    canvasText(c, "Lately", nx, y + 12, "#ffd6f0", "bold 13px Arial");
    let ny = y + 30;
    for (const n of (h.notes || []).slice(0, 5)) {
      c.font = "12px Arial";
      let line = "";
      let lines = 0;
      for (const wd of n.text.split(" ")) {
        const tt = line ? line + " " + wd : wd;
        if (c.measureText(tt).width > nw && line) {
          canvasText(c, line, nx, ny, "#cfc6dd", "12px Arial");
          ny += 14;
          line = wd;
          if (++lines >= 2) break;
        } else line = tt;
      }
      if (lines < 2 && line) {
        canvasText(c, line, nx, ny, "#cfc6dd", "12px Arial");
        ny += 14;
      }
      ny += 4;
      if (ny > y + 140) break;
    }
  }
  y += 150;
  // What they're asking
  const r = h.request;
  if (r) {
    const pet = fluffyById(r.petId);
    let text = "";
    if (r.kind === "sit" && !r.accepted) text = `"Could you look after ${pet ? nbName(pet) : "my fluffy"} for ${r.days === 1 ? "a day" : `${r.days} days`}? I'll pay $${r.pay}."`;
    else if (r.kind === "sit") text = `"Thank you for looking after ${pet ? nbName(pet) : "my fluffy"}! Back soon."`;
    else if (r.kind === "return") text = `"Have you got my ${pet ? nbName(pet) : "fluffy"}? I want it back."`;
    canvasText(c, fitText(c, text, L.w - 44), x, y, "#fff3b0", "italic 14px Arial");
    y += 16;
    if (r.kind === "sit" && !r.accepted) {
      _nbBtn(c, { x, y, w: 170, h: 32, act: "sit" }, "Yes, I'll look after it");
      _nbBtn(c, { x: x + 180, y, w: 120, h: 32, act: "decline" }, "Sorry, no", "#6d4c41");
    } else if (r.kind === "return") {
      _nbBtn(c, { x, y, w: 150, h: 32, act: "return" }, "Give it back");
      _nbBtn(c, { x: x + 160, y, w: 120, h: 32, act: "keep" }, "Keep it", "#b71c1c");
    }
  } else canvasText(c, "Nothing to ask you today.", x, y, "#b9b0c9", "italic 13px Arial");
}

function handleNeighbourPanelClick() {
  if (nbPanelSlot === null) return false;
  const h = nbHouseAt(nbPanelSlot);
  const b = _nbUI.buttons.find((r) => isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h));
  if (b) {
    if (b.act === "close") closeNeighbourPanel();
    else if (b.act === "sit") nbAcceptSit(h);
    else if (b.act === "decline") nbDeclineRequest(h);
    else if (b.act === "return") nbReturnPet(h);
    else if (b.act === "keep") nbKeepPet(h);
    return true;
  }
  const L = _nbLayout();
  if (!isPointInRect(mouse.x, mouse.y, L.x, L.y, L.w, L.h)) closeNeighbourPanel();
  return true;
}

if (typeof registerScreen === "function")
  registerScreen({
    name: "neighbour",
    layer: 16,
    isOpen: () => nbPanelSlot !== null,
    close: () => closeNeighbourPanel(),
    draw: (c) => drawNeighbourPanel(c),
    click: () => handleNeighbourPanelClick(),
  });

// The magnifying glass: whose it is
function describeNbOwner(f) {
  if (!f || f.nbOwner == null) return null;
  const h = nbHouse(f.nbOwner);
  if (!h || h.vacant) return null;
  return [`${h.who}'s (Maple Lane, No. ${h.slot + 1})${f.petSitting ? " - you're looking after it" : ""}`, ""];
}
if (typeof INSPECT_ROWS !== "undefined") INSPECT_ROWS.push(["Belongs to", "describeNbOwner"]);
