// ---------------------------------------------------------------------------
// Personality traits.
//
// Every fluffy has five traits, each decided by 5 genes (0 or 1) stored
// after the older genes (from index TRAIT_GENE_START = 103). Foals get
// each gene from one parent or the other, like the rest of the genes, so
// temperament runs in families and the Gene Lab can predict it.
//
//   gene sum 0-1 -> the "low" label   (e.g. Timid)
//   gene sum 2-3 -> no label (average)
//   gene sum 4-5 -> the "high" label  (e.g. Brave)
//
// traitValue() turns the sum into -1 .. +1 (0 = average), and the effects
// below scale with it, so an average fluffy behaves exactly as before.
//
// To add a trait: add it to TRAITS (its genes go after the last one's),
// then give it effects in TRAIT_DESIRE_EFFECTS and/or somewhere in the code
// with traitValue(horse, "key"), and lines in DIALOGUE.TRAIT (dialogue.js).
// ---------------------------------------------------------------------------

const TRAIT_GENE_START = 103;
const TRAIT_GENES_EACH = 5;

const TRAITS = [
  { key: "bravery", high: "Brave", low: "Timid", highCode: "BRAVE", lowCode: "TIMID" },
  { key: "social", high: "Social", low: "Loner", highCode: "SOCIAL", lowCode: "LONER" },
  { key: "appetite", high: "Greedy", low: "Picky eater", highCode: "GREEDY", lowCode: "PICKY" },
  { key: "energy", high: "Playful", low: "Lazy", highCode: "PLAYFUL", lowCode: "LAZY" },
  { key: "temper", high: "Grumpy", low: "Gentle", highCode: "GRUMPY", lowCode: "GENTLE" },
  { key: "wits", high: "Clever", low: "Dim", highCode: "CLEVER", lowCode: "DIM" }, // (Intelligence.js)
];

const TRAIT_GENE_TOTAL = TRAIT_GENE_START + TRAITS.length * TRAIT_GENES_EACH;

// How traits change what fluffies want to do. For each desire (names from
// HorseBrain.js): [trait, strength]. The desire's score is multiplied by
// 1 + strength x traitValue, e.g. ["bravery", -0.5]: a very brave fluffy
// (+1) feels that fear at half strength, a very timid one (-1) at 1.5x.
const TRAIT_DESIRE_EFFECTS = {
  GrinderFear: [["bravery", -0.5]],
  AlicornFear: [["bravery", -0.5]],
  FearedFluffyFear: [["bravery", -0.5]],
  CarFear: [["bravery", -0.5]],
  SprinklerFear: [["bravery", -0.5]],
  CorpseReaction: [["bravery", -0.4]],
  BloodReaction: [["bravery", -0.4]],
  SmartyChaseFear: [["bravery", -0.5]],
  BabbleToFriends: [["social", 0.5]],
  RandomBabble: [["social", 0.3]],
  ProposeFriendship: [["social", 0.6]],
  ProposeSpecialFriendship: [["social", 0.3]],
  SeekSpecialFriend: [["social", 0.3]],
  Eat: [["appetite", 0.35]],
  PlayWithBall: [["energy", 0.6]],
  PlayWithBlocks: [["energy", 0.6]],
  RunToTV: [["energy", 0.3]],
  Wander: [["energy", 0.4]],
  Sit: [["energy", -0.5]],
  LieDown: [["energy", -0.5]],
  ComplainAboutPuddle: [["temper", 0.6]],
  SmartyCombat: [["temper", 0.5]],
};

// Make sure a gene list has trait genes (older fluffies/saves don't).
// Only touches lists that already have all the older genes.
function ensureTraitGenes(genes) {
  if (!Array.isArray(genes) || genes.length < TRAIT_GENE_START) return genes;
  while (genes.length < TRAIT_GENE_TOTAL) genes.push(Math.random() < 0.5 ? 0 : 1);
  return genes;
}

function _traitGenes(x) {
  return Array.isArray(x) ? x : x && x.genes;
}

// 0..5, or null if these genes don't have the trait
function traitGeneSum(horseOrGenes, key) {
  const genes = _traitGenes(horseOrGenes);
  const i = TRAITS.findIndex((t) => t.key === key);
  if (!genes || i < 0) return null;
  const start = TRAIT_GENE_START + i * TRAIT_GENES_EACH;
  if (genes.length < start + TRAIT_GENES_EACH) return null;
  let sum = 0;
  for (let k = 0; k < TRAIT_GENES_EACH; k++) sum += genes[start + k] ? 1 : 0;
  return sum;
}

// -1 (very low) .. 0 (average) .. +1 (very high). For a fluffy (not just
// genes), what its life has done to it counts too (Personality.js)
function traitValue(horseOrGenes, key) {
  const sum = traitGeneSum(horseOrGenes, key);
  if (sum === null) return 0;
  const v = (sum - TRAIT_GENES_EACH / 2) / (TRAIT_GENES_EACH / 2);
  const shift = !Array.isArray(horseOrGenes) && horseOrGenes && horseOrGenes.traitShift ? horseOrGenes.traitShift[key] || 0 : 0;
  return Math.max(-1, Math.min(1, v + shift));
}

// The labels a fluffy shows: [{ key, label, code, high }]
function getTraitLabels(horseOrGenes) {
  const out = [];
  for (const t of TRAITS) {
    const sum = traitGeneSum(horseOrGenes, t.key);
    if (sum === null) continue;
    // (genes 4 of 5 = 0.6; a fluffy's life can push it over, Personality.js)
    const v = traitValue(horseOrGenes, t.key);
    if (v >= 0.59) out.push({ key: t.key, label: t.high, code: t.highCode, high: true });
    else if (v <= -0.59) out.push({ key: t.key, label: t.low, code: t.lowCode, high: false });
  }
  return out;
}

function hasTraitLabel(horseOrGenes, label) {
  return getTraitLabels(horseOrGenes).some((t) => t.label === label);
}

// "Brave, Greedy" / "Easygoing (no strong traits)" / "Unknown"
function describeTraits(horseOrGenes) {
  const genes = _traitGenes(horseOrGenes);
  if (!genes || genes.length < TRAIT_GENE_TOTAL) return "Unknown";
  const labels = getTraitLabels(horseOrGenes).map((t) => t.label);
  return labels.length ? labels.join(", ") : "Easygoing (no strong traits)";
}

// ---- Effects (called from the game code) ----

// HorseBrain.think: multiply a desire's score
function traitDesireMultiplier(horse, desireName) {
  const effects = TRAIT_DESIRE_EFFECTS[desireName];
  if (!effects) return 1;
  let m = 1;
  for (const [key, strength] of effects) m *= 1 + strength * traitValue(horse, key);
  return Math.max(0.1, m);
}

// Horse.update: greedy fluffies get hungry faster, picky eaters slower
function traitHungerMultiplier(horse) {
  return 1 + 0.25 * traitValue(horse, "appetite");
}

// Fence.js pen feelings: social fluffies mind being split up more
function traitLonelinessMultiplier(horse) {
  return 1 + 0.5 * traitValue(horse, "social");
}

// Horse.update counterattacks: gentle fluffies often don't hit back.
// Average or grumpy: always (as before); very gentle: 1 in 5.
function traitWillRetaliate(horse) {
  const temper = traitValue(horse, "temper");
  if (temper >= 0) return true;
  return Math.random() < 1 + 0.8 * temper;
}

// Horse.babbleText: sometimes say something that shows a trait
function getTraitBabble(horse) {
  const labels = getTraitLabels(horse);
  if (!labels.length || typeof DIALOGUE === "undefined" || !DIALOGUE.TRAIT) return null;
  const t = labels[Math.floor(Math.random() * labels.length)];
  if (!DIALOGUE.TRAIT[t.code]) return null;
  return getDialogue(["TRAIT", t.code], horse);
}
