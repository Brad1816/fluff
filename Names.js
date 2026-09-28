// ---------------------------------------------------------------------------
// Every fluffy gets a name of its own.
//
// Fluffies used to be "Fluffy" or "Unnamed fluffy" until you named them,
// which made the herds, the family tree and the morning report hard to
// follow. Now each fluffy is given a name when it appears (born, bought,
// wandering into the park, loaded from an old save):
//   - usually one that suits its coat colour (a pink fluffy might be Rosie
//     or Bubblegum, a grey one Pebble or Smokey), sometimes a general one
//   - never the same as a fluffy that's alive now: repeats get a number
//     ("Pudding II", "Pudding III")
// You can still rename any fluffy with the magnifying glass; your names are
// kept. Names live in fluffyNames (already saved with the game).
// ---------------------------------------------------------------------------

const NAMES_BY_COLOUR = {
  pink: ["Rosie", "Bubblegum", "Blossom", "Petal", "Candy", "Strawberry", "Primrose", "Cupcake", "Peony", "Taffy"],
  wed: ["Cherry", "Ruby", "Poppy", "Pepper", "Apple", "Radish", "Scarlet", "Cranberry", "Rhubarb", "Paprika"],
  owange: ["Pumpkin", "Ginger", "Peaches", "Marmalade", "Apricot", "Tangerine", "Carrot", "Saffron", "Sunset", "Clementine"],
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
  "Pip", "Pippin", "Button", "Bumble", "Noodle", "Dumpling", "Pudding", "Nibbles", "Wiggles", "Doodle",
  "Gumdrop", "Jellybean", "Sprinkles", "Twinkle", "Puff", "Fluffers", "Snuggles", "Tater", "Nugget", "Bonbon",
  "Cricket", "Gizmo", "Ziggy", "Hopper", "Midge", "Mittens", "Pixie", "Quill", "Tinsel", "Wobble",
  "Bean", "Chip", "Figgy", "Lolly", "Mopsy", "Nubbin", "Popcorn", "Scooter", "Sniffles", "Tootsie",
];

const _ROMAN = ["", "", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function _namesInUse() {
  const used = new Set();
  if (typeof fluffies === "undefined" || typeof fluffyNames === "undefined") return used;
  for (const f of fluffies) {
    const n = fluffyNames[f.id];
    if (n && f.isAlive) used.add(n);
  }
  return used;
}

// A new name for fluffy `f` (doesn't store it)
function pickFluffyName(f, used = _namesInUse()) {
  let colour = null;
  try {
    colour = f && f.getColorName ? f.getColorName() : null;
  } catch (e) {
    colour = null;
  }
  const themed = NAMES_BY_COLOUR[colour];
  const pool = themed && Math.random() < 0.65 ? themed : GENERAL_NAMES;
  // Try a few free names first
  for (let i = 0; i < 12; i++) {
    const n = pool[Math.floor(Math.random() * pool.length)];
    if (!used.has(n)) return n;
  }
  // All taken: number one of them
  const base = pool[Math.floor(Math.random() * pool.length)];
  for (let k = 2; k < 1000; k++) {
    const n = `${base} ${k < _ROMAN.length ? _ROMAN[k] : k}`;
    if (!used.has(n)) return n;
  }
  return `${base} ${f ? f.id : ""}`.trim();
}

// Give `f` a name if it hasn't got one
function ensureFluffyName(f) {
  if (!f || typeof fluffyNames === "undefined" || f.id === undefined) return null;
  if (!fluffyNames[f.id]) fluffyNames[f.id] = pickFluffyName(f);
  return fluffyNames[f.id];
}

// script.js updateSimulation: anyone still without a name gets one
// (new arrivals, old saves). Cheap: only looks at fluffies without one.
function updateFluffyNames() {
  if (typeof fluffies === "undefined" || typeof fluffyNames === "undefined") return;
  let used = null;
  for (const f of fluffies) {
    if (fluffyNames[f.id]) continue;
    used = used || _namesInUse();
    const n = pickFluffyName(f, used);
    fluffyNames[f.id] = n;
    used.add(n);
  }
}
