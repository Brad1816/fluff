// ---------------------------------------------------------------------------
// Fluffy names.
//
// Fluffies are just "Fluffy" until a human names them (the magnifying
// glass "Change name" button). For a short while a build of the game gave
// every fluffy an automatic name; cleanUpAutoNames() takes those back out
// of saves made with that build, so those fluffies are "Fluffy" again.
//
// It only acts on a save where every fluffy has a name (the tell-tale sign
// of that build - normally lots of fluffies are unnamed), and only removes
// names from its lists (e.g. "Rosie", "Pudding II").
// ---------------------------------------------------------------------------

const NAMES_BY_COLOUR = {
  pink: ["Rosie", "Bubblegum", "Blossom", "Petal", "Candy", "Strawberry", "Primrose", "Cupcake", "Peony", "Taffy"],
  wed: ["Cherry", "Ruby", "Poppy", "Pepper", "Apple", "Radish", "Scarlet", "Cranberry", "Rhubarb", "Paprika"],
  owange: [
    "Pumpkin",
    "Ginger",
    "Peaches",
    "Marmalade",
    "Apricot",
    "Tangerine",
    "Carrot",
    "Saffron",
    "Sunset",
    "Clementine",
  ],
  yewwow: ["Sunny", "Lemon", "Honey", "Buttercup", "Daisy", "Custard", "Dandelion", "Goldie", "Banana", "Butterscotch"],
  gween: ["Clover", "Sprout", "Pickle", "Kiwi", "Moss", "Minty", "Basil", "Pistachio", "Fern", "Lime"],
  bwue: ["Bluebell", "Skye", "Puddle", "Blueberry", "Cornflower", "Denim", "Brook", "Splash", "Periwinkle", "Rain"],
  puwpuw: ["Plum", "Lilac", "Violet", "Grape", "Lavender", "Jam", "Heather", "Iris", "Mulberry", "Thistle"],
  gway: ["Pebble", "Smokey", "Ash", "Misty", "Silver", "Dusty", "Slate", "Pewter", "Cloud", "Flint"],
  wite: ["Snowdrop", "Marshmallow", "Cotton", "Frosty", "Pearl", "Sugar", "Coconut", "Daisy", "Blizzard", "Meringue"],
  bwack: ["Licorice", "Midnight", "Shadow", "Coal", "Raven", "Inky", "Pepper", "Soot", "Onyx", "Eclipse"],
  bwown: ["Cocoa", "Biscuit", "Fudge", "Toffee", "Nutmeg", "Hazel", "Muffin", "Pretzel", "Acorn", "Waffles"],
};

const GENERAL_NAMES = [
  "Pip",
  "Pippin",
  "Button",
  "Bumble",
  "Noodle",
  "Dumpling",
  "Pudding",
  "Nibbles",
  "Wiggles",
  "Doodle",
  "Gumdrop",
  "Jellybean",
  "Sprinkles",
  "Twinkle",
  "Puff",
  "Fluffers",
  "Snuggles",
  "Tater",
  "Nugget",
  "Bonbon",
  "Cricket",
  "Gizmo",
  "Ziggy",
  "Hopper",
  "Midge",
  "Mittens",
  "Pixie",
  "Quill",
  "Tinsel",
  "Wobble",
  "Bean",
  "Chip",
  "Figgy",
  "Lolly",
  "Mopsy",
  "Nubbin",
  "Popcorn",
  "Scooter",
  "Sniffles",
  "Tootsie",
];

function _isAutoName(n) {
  if (typeof n !== "string") return false;
  const base = n.replace(/ (II|III|IV|V|VI|VII|VIII|IX|X|\d+)$/, "");
  if (GENERAL_NAMES.includes(base)) return true;
  return Object.values(NAMES_BY_COLOUR).some((list) => list.includes(base));
}

// Persistence.js loadGame, after the fluffies are loaded. Returns how many
// names were removed.
function cleanUpAutoNames() {
  if (typeof fluffies === "undefined" || typeof fluffyNames === "undefined") return 0;
  if (fluffies.length < 5) return 0;
  const allNamed = fluffies.every((f) => !!fluffyNames[f.id]);
  if (!allNamed) return 0;
  const auto = fluffies.filter((f) => _isAutoName(fluffyNames[f.id]));
  if (auto.length < fluffies.length * 0.8) return 0; // looks like names you chose
  for (const f of auto) delete fluffyNames[f.id];
  return auto.length;
}

// ---------------------------------------------------------------------------
// Telling unnamed fluffies apart: "Fluffy (pink unicorn mare)".
// Only the game's screens use this (magnifying glass, family tree, herds,
// reports, chat log, name tags); fluffies themselves still say "fwuffy".
// ---------------------------------------------------------------------------

const COLOUR_WORDS = {
  pink: "pink",
  wed: "red",
  owange: "orange",
  yewwow: "yellow",
  gween: "green",
  bwue: "blue",
  puwpuw: "purple",
  gway: "grey",
  wite: "white",
  bwack: "black",
  bwown: "brown",
};

function _ageGenderWord(gender, growth, tiny) {
  if (tiny) return "foal";
  if ((growth ?? 1) < 1) return gender === "male" ? "colt" : "filly";
  return gender === "male" ? "stallion" : "mare";
}

// "pink unicorn mare"
function describeFluffyLooks(f) {
  if (!f) return "fluffy";
  let colour = "";
  try {
    colour = COLOUR_WORDS[f.getColorName ? f.getColorName() : ""] || "";
  } catch (e) {
    colour = "";
  }
  const tiny = f.tooYoungToWalk ? f.tooYoungToWalk() : (f.growth ?? 1) < 0.1;
  const words = [colour, f.type || "", _ageGenderWord(f.gender, f.growth, tiny)].filter(Boolean);
  return words.join(" ");
}

// Same for a family record (a fluffy that's gone)
function describeRecordLooks(rec) {
  if (!rec) return "fluffy";
  const coat = typeof describeRecordCoat === "function" ? describeRecordCoat(rec).name : "";
  const words = [COLOUR_WORDS[coat] || "", rec.type || "", _ageGenderWord(rec.gender, rec.growth, false)].filter(
    Boolean,
  );
  return words.join(" ");
}

// "Daisy", or "Fluffy (pink unicorn mare)" if nobody has named it
function fluffyDisplayName(f) {
  if (!f) return "Fluffy";
  const n = typeof fluffyNames !== "undefined" ? fluffyNames[f.id] : null;
  return n || `Fluffy (${describeFluffyLooks(f)})`;
}

// By id: a fluffy that's here, else its family record, else plain "Fluffy"
function fluffyDisplayNameById(id, fallback = "Fluffy") {
  if (id === null || id === undefined) return fallback;
  const n = typeof fluffyNames !== "undefined" ? fluffyNames[id] : null;
  if (n) return n;
  const f = typeof fluffies !== "undefined" ? fluffies.find((x) => x.id == id) : null;
  if (f) return fluffyDisplayName(f);
  const rec = typeof getFamilyRecord === "function" ? getFamilyRecord(id) : null;
  if (rec) return rec.name || `Fluffy (${describeRecordLooks(rec)})`;
  return fallback;
}

// ---------------------------------------------------------------------------
// Naming new fluffies: when a fluffy becomes yours (born to one of yours,
// bought, or brought home) a short pop-up offers to name it. A litter gets
// one pop-up with a box for each foal (shown once the mum has finished
// giving birth). Skip it and they stay "Fluffy" - you can name them later
// with the magnifying glass.
//
// updateNamingPopups() (script.js, once a second) watches for fluffies that
// have just become adopted and haven't got a name, and queues them.
// Typing goes into the focused box (the pop-up takes the keyboard while
// it's open). Enter / Tab go to the next box; Enter on the last saves.
// ---------------------------------------------------------------------------

const NAMING_MAX_LEN = 20;
let namingQueue = []; // [{ ids: [...], kind: "litter" | "single", mumId }]
let namingPopup = null; // { ids, kind, mumId, names: [], focus }
let _namingKnown = null; // ids of your fluffies we've already seen
let _namingTimer = 0;
const _pendingLitters = {}; // mumId -> [ids]

function isNamingPopupOpen() {
  return !!namingPopup;
}

function _namingCandidates() {
  return fluffies.filter((f) => f.adopted && f.isAlive);
}

// script.js updateSimulation
function updateNamingPopups(dt) {
  _namingTimer -= dt;
  if (_namingTimer > 0) return;
  _namingTimer = 1;
  // First look (new game, loaded save): everything already here is known
  if (!_namingKnown) {
    _namingKnown = new Set(_namingCandidates().map((f) => f.id));
    return;
  }
  for (const f of _namingCandidates()) {
    if (_namingKnown.has(f.id)) continue;
    _namingKnown.add(f.id);
    // Brought home from the park (Goals.js)
    if (f.fromPark && typeof noteGoalEvent === "function") noteGoalEvent("broughtHome");
    // ...and starts settling in (Wellbeing.js)
    if (f.fromPark && typeof startSettlingIn === "function") startSettlingIn(f);
    if (fluffyNames[f.id]) continue; // already has a name
    const newborn = f.motherId !== null && f.motherId !== undefined && f.growth < 0.1;
    if (newborn) {
      (_pendingLitters[f.motherId] = _pendingLitters[f.motherId] || []).push(f.id);
    } else {
      namingQueue.push({ ids: [f.id], kind: "single" });
    }
  }
  // A litter is ready once its mum has finished (or isn't giving birth)
  for (const mumId of Object.keys(_pendingLitters)) {
    const mum = fluffies.find((m) => m.id == mumId);
    if (mum && mum.isAlive && mum.babiesToBirth > 0) continue;
    const ids = _pendingLitters[mumId].filter((id) => fluffies.some((f) => f.id === id && f.isAlive));
    delete _pendingLitters[mumId];
    if (ids.length) namingQueue.push({ ids, kind: ids.length > 1 ? "litter" : "single", mumId: Number(mumId) });
    if (typeof noteGoalEvent === "function") noteGoalEvent("litter"); // Goals.js
  }
  // Show the next one
  if (!namingPopup && namingQueue.length && transitionPhase === "OFF") {
    const next = namingQueue.shift();
    const ids = next.ids.filter((id) => fluffies.some((f) => f.id === id && f.isAlive) && !fluffyNames[id]);
    if (ids.length) {
      namingPopup = { ...next, ids, names: ids.map(() => ""), focus: 0 };
      if (typeof setGameSpeed === "function") setGameSpeed(1);
    }
  }
}

// Forget what we've seen (new game / load): nothing already there pops up
function resetNamingPopups() {
  namingQueue = [];
  namingPopup = null;
  _namingKnown = null;
  for (const k of Object.keys(_pendingLitters)) delete _pendingLitters[k];
}

function saveNamingPopup() {
  if (!namingPopup) return;
  namingPopup.ids.forEach((id, i) => {
    const n = (namingPopup.names[i] || "").trim();
    if (n) fluffyNames[id] = n;
  });
  namingPopup = null;
}

function skipNamingPopup() {
  namingPopup = null;
}

// ---- Layout and drawing (screen pass only) ----

function getNamingLayout() {
  const n = namingPopup ? namingPopup.ids.length : 1;
  const rowH = 64;
  const w = 580;
  const h = 130 + n * rowH + 70;
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(Math.max(10, height / 2 - h / 2));
  const rows = [];
  for (let i = 0; i < n; i++) {
    const ry = y + 96 + i * rowH;
    rows.push({ y: ry, box: { x: x + 250, y: ry + 12, w: 300, h: 36 } });
  }
  const by = y + h - 56;
  return {
    x,
    y,
    w,
    h,
    rows,
    save: { x: x + w / 2 + 10, y: by, w: 170, h: 40 },
    skip: { x: x + w / 2 - 180, y: by, w: 170, h: 40 },
  };
}

function drawNamingPopup(c) {
  if (!namingPopup) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const p = namingPopup;
  const L = getNamingLayout();
  c.save();
  c.globalAlpha = 1;
  c.fillStyle = "rgba(0,0,0,0.5)";
  c.fillRect(0, 0, width, height);
  c.fillStyle = "#1f2433";
  c.strokeStyle = "rgba(255, 214, 240, 0.8)";
  c.lineWidth = 3;
  c.beginPath();
  if (c.roundRect) c.roundRect(L.x, L.y, L.w, L.h, 16);
  else c.rect(L.x, L.y, L.w, L.h);
  c.fill();
  c.stroke();

  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  c.fillStyle = "#ffd6f0";
  c.font = "bold 22px Arial";
  const mum = p.mumId !== undefined ? fluffies.find((f) => f.id === p.mumId) : null;
  const title =
    p.kind === "litter"
      ? `${mum ? fluffyDisplayName(mum) : "Your fluffy"} had ${p.ids.length} foals!`
      : "A new fluffy is yours!";
  c.fillText(title.length > 44 ? title.slice(0, 43) + "…" : title, L.x + L.w / 2, L.y + 40);
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.font = "14px Arial";
  c.fillText(
    p.kind === "litter" ? 'Give them names, or leave them as "Fluffy".' : 'Give it a name, or leave it as "Fluffy".',
    L.x + L.w / 2,
    L.y + 66,
  );

  p.ids.forEach((id, i) => {
    const f = fluffies.find((x) => x.id === id);
    const row = L.rows[i];
    if (f && f.drawPortrait) {
      try {
        f.drawPortrait(c, L.x + 50, row.y + 34, Math.min(170, 60 / (0.25 + 0.75 * Math.min(1, f.growth || 0)))); // foals drawn bigger
      } catch (e) {
        /* portrait is only decoration */
      }
    }
    c.textAlign = "left";
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.font = "13px Arial";
    const looks = f ? describeFluffyLooks(f) : "";
    c.fillText(looks.length > 22 ? looks.slice(0, 21) + "…" : looks, L.x + 106, row.y + 35);
    // Name box
    const b = row.box;
    const focused = p.focus === i;
    c.fillStyle = focused ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)";
    c.strokeStyle = focused ? "#ffd6f0" : "rgba(255,255,255,0.35)";
    c.lineWidth = 2;
    c.beginPath();
    if (c.roundRect) c.roundRect(b.x, b.y, b.w, b.h, 8);
    else c.rect(b.x, b.y, b.w, b.h);
    c.fill();
    c.stroke();
    c.font = "16px Arial";
    c.textBaseline = "middle";
    const text = p.names[i];
    if (text) {
      c.fillStyle = "white";
      c.fillText(text, b.x + 10, b.y + b.h / 2);
    } else {
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.fillText("Fluffy", b.x + 10, b.y + b.h / 2);
    }
    // Blinking cursor
    if (focused && Math.floor(performance.now() / 500) % 2 === 0) {
      const tw = text ? c.measureText(text).width : 0;
      c.fillStyle = "white";
      c.fillRect(b.x + 11 + tw, b.y + 9, 2, b.h - 18);
    }
    c.textBaseline = "alphabetic";
  });

  if (typeof drawGlassButton === "function") {
    drawGlassButton(L.skip.x, L.skip.y, L.skip.w, L.skip.h, 'Leave as "Fluffy"', { fontSize: 15, borderRadius: 10 });
    drawGlassButton(L.save.x, L.save.y, L.save.w, L.save.h, p.kind === "litter" ? "Save names" : "Save name", {
      fontSize: 15,
      borderRadius: 10,
      normalFill: "rgba(255, 170, 220, 0.25)",
    });
  }
  c.restore();
}

// Mouse down (screen positions); swallows clicks while open
function handleNamingClick() {
  if (!namingPopup) return false;
  const L = getNamingLayout();
  const hit = (r) => isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h);
  if (hit(L.save)) saveNamingPopup();
  else if (hit(L.skip)) skipNamingPopup();
  else {
    L.rows.forEach((row, i) => {
      if (hit(row.box)) namingPopup.focus = i;
    });
  }
  return true;
}

// Keyboard (capture phase, so game keys and cheats don't see the typing)
function handleNamingKey(e) {
  if (!namingPopup) return false;
  const p = namingPopup;
  const i = p.focus;
  if (e.key === "Escape") {
    skipNamingPopup();
  } else if (e.key === "Enter" || e.key === "Tab") {
    if (e.key === "Enter" && (i >= p.ids.length - 1 || e.ctrlKey)) saveNamingPopup();
    else p.focus = (i + (e.shiftKey ? p.ids.length - 1 : 1)) % p.ids.length;
  } else if (e.key === "ArrowDown") {
    p.focus = Math.min(p.ids.length - 1, i + 1);
  } else if (e.key === "ArrowUp") {
    p.focus = Math.max(0, i - 1);
  } else if (e.key === "Backspace") {
    p.names[i] = p.names[i].slice(0, -1);
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    if (p.names[i].length < NAMING_MAX_LEN) p.names[i] += e.key;
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  return true;
}

if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (e) => {
      if (namingPopup) handleNamingKey(e);
    },
    true,
  );
}
