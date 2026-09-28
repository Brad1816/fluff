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
