// ---------------------------------------------------------------------------
// Grading a fluffy (plan: growth stage, colour tiers, weaning tags).
//
// GROWTH STAGE (magnifying glass, next to its age): Chirpy (a newborn,
// peeping), Talkie (talking, still crawling), Walkie (walking, not grown)
// or Adult - so a small grown fluffy isn't taken for a foal. (By the game's
// own steps: CHIRPY_THRESHOLD, WALKY_THRESHOLD.)
//
// COLOUR TIER (magnifying glass, "Colour tier"): 1 to 4 from how nice its
// coat is (the coat score buyers and colourists use, judgeCoatColour):
//   1 prized (bright, lovely)   2 good   3 drab   4 poopie (off-putting)
// Price: on top of the coat's own value, TIER_PRICE (x1.1 .. x0.75). Orders
// ask for "colour tier 1" or "tier 1 or 2" (Orders.js coat). A tier 4 (or a
// "feed" tag) is what the reptile shop buyer comes for - cheap, and it's
// gone (Buyers.js "reptile").
//
// WEANING TAGS: right-click a foal of yours that's weaned (WEAN_TAG_GROWTH
// grown or more, no tag yet), "Weaning tag": the test (how it takes being
// handled - its temper, trust, health, coat, any defects) suggests one, and
// you pick:
//   Breeder  kept or sold for breeding: x1.2 (show and mill buyers like it)
//   Pet      a gentle one for a home: x1.1 (families and kids like it)
//   Feed     cheap stock: x0.5, and the reptile shop wants it
// The tag shows in the magnifying glass and is in its ear for good.
// Saved: f.weanTag.
// ---------------------------------------------------------------------------

const WEAN_TAG_GROWTH = 0.45;
const TIER_PRICE = { 1: 1.1, 2: 1, 3: 0.95, 4: 0.75 };
const WEAN_TAG_PRICE = { breeder: 1.2, pet: 1.1, feed: 0.5 };
const WEAN_TAG_WORDS = { breeder: "Breeder", pet: "Pet", feed: "Feed" };
const REPTILE_PAY = [12, 25]; // a foal .. grown, before the usual budget

// ---- Growth stage ----
function growthStage(f) {
  if (!f) return "";
  if (f.growth >= 1) return "Adult";
  if (f.growth < CHIRPY_THRESHOLD) return "Chirpy";
  if (f.growth < WALKY_THRESHOLD) return "Talkie";
  return "Walkie";
}

function describeGrowthStage(f) {
  const s = growthStage(f);
  const why = { Chirpy: "peeping, can't walk yet", Talkie: "talking, still crawling", Walkie: "walking, still growing", Adult: "fully grown" }[s];
  return s ? [`${s} (${why})`, s === "Adult" ? "" : "ok"] : null;
}

// ---- Colour tiers ----
function coatScore(f) {
  if (!f || !f.genetics || typeof f.genetics.calculateColorismPerception !== "function") return 0.75;
  return f.genetics.calculateColorismPerception();
}

function colourTier(f) {
  const p = coatScore(f);
  if (p >= COAT_NICE_LINE) return 1;
  if (p >= COAT_DRAB_LINE) return 2;
  if (p >= COAT_POOPIE_LINE) return 3;
  return 4;
}

const TIER_WORDS = { 1: "prized", 2: "good", 3: "drab", 4: "poopie - off-putting" };
function describeColourTier(f) {
  const t = colourTier(f);
  return [`Tier ${t} (${TIER_WORDS[t]})`, t <= 2 ? "good" : t === 3 ? "ok" : "bad"];
}

// ---- Weaning tags ----
function canWeanTag(f) {
  return !!(f && f.isAlive && f.adopted && !f.weanTag && f.growth >= WEAN_TAG_GROWTH);
}

// The test: how it takes being handled. Returns "breeder" | "pet" | "feed"
function weanTest(f) {
  let feed = 0;
  if (colourTier(f) === 4) feed += 2;
  if (Array.isArray(f.deformities) && f.deformities.length) feed += 1.5;
  if (f.runt) feed += 1;
  if ((f.health ?? 100) < 60) feed += 1;
  if (typeof hasDefect === "function" && hasDefect(f)) feed += 1;
  if (feed >= 2) return "feed";
  const temper = typeof traitValue === "function" ? traitValue(f, "temper") : 0;
  const trust = f.playerTrust ?? 0.5;
  // A calm, trusting foal makes a pet; a sturdy one with a good coat, a breeder
  if (trust >= 0.55 && temper < 0.2) return colourTier(f) === 1 && f.type !== "earthy" ? "breeder" : "pet";
  return colourTier(f) <= 2 ? "breeder" : "pet";
}

function setWeanTag(f, tag) {
  if (!canWeanTag(f) || !WEAN_TAG_WORDS[tag]) return false;
  f.weanTag = tag;
  if (typeof recordStory === "function") recordStory("tagged", f, { x: `${WEAN_TAG_WORDS[tag].toLowerCase()} stock` });
  // Being handled and tagged: a little fright, more for a timid one
  if (typeof changePlayerFear === "function") changePlayerFear(f, 0.02);
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["WEAN_TAG"], f), true);
  if (typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(f)} is tagged: ${WEAN_TAG_WORDS[tag]}.`);
  return true;
}

function askWeanTag(f) {
  if (!canWeanTag(f) || typeof openChoice !== "function") return false;
  const test = weanTest(f);
  const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "It";
  openChoice({
    title: `Weaning tag for ${name}`,
    lines: [
      `The test says: ${WEAN_TAG_WORDS[test]}.`,
      "Breeder x1.2 · Pet x1.1 · Feed x0.5 (the reptile shop wants feed stock). It's for good.",
    ],
    buttons: [
      ...["breeder", "pet", "feed"].map((t) => ({ label: WEAN_TAG_WORDS[t] + (t === test ? " ✓" : ""), kind: t === test ? "ok" : t === "feed" ? "danger" : undefined, run: () => setWeanTag(f, t) })),
      { label: "Not now", cancel: true, run: () => {} },
    ],
  });
  return true;
}

function describeWeanTag(f) {
  if (!f || !f.weanTag) return null;
  return [`${WEAN_TAG_WORDS[f.weanTag] || f.weanTag} (ear tag)`, f.weanTag === "feed" ? "bad" : "good"];
}

function gradingActions(f) {
  if (!canWeanTag(f)) return [];
  return [{ key: "wean_tag", name: "Weaning tag", sub: `test: ${WEAN_TAG_WORDS[weanTest(f)]}`, run: (x) => askWeanTag(x) }];
}
if (typeof FLUFFY_ACTION_SOURCES !== "undefined") FLUFFY_ACTION_SOURCES.push(gradingActions);

// HorseGenetics.calculatePrice
function gradePriceMultiplier(f) {
  let k = TIER_PRICE[colourTier(f)] || 1;
  if (f && f.weanTag && WEAN_TAG_PRICE[f.weanTag]) k *= WEAN_TAG_PRICE[f.weanTag];
  return k;
}

if (typeof PRICE_MULTIPLIERS !== "undefined") PRICE_MULTIPLIERS.push(gradePriceMultiplier);

// ---- The reptile shop (Buyers.js) ----
function reptileStock(f) {
  return !!(f && f.isAlive && (colourTier(f) === 4 || f.weanTag === "feed"));
}

if (typeof BUYER_KINDS !== "undefined") {
  BUYER_KINDS.push({
    id: "reptile",
    label: "A reptile shop",
    wants: "cheap feeder stock - poopie coats, feed tags",
    budget: 1,
    patience: 1,
    generous: 0.05,
    // (only comes when you have some)
    weight: () => (typeof fluffies !== "undefined" && fluffies.some((f) => f.adopted && !f.notForSale && reptileStock(f)) ? 0.9 : 0),
    like: (f) => (reptileStock(f) ? 1 : 0.02),
    flatPrice: (f) => REPTILE_PAY[0] + (REPTILE_PAY[1] - REPTILE_PAY[0]) * Math.min(1, f.growth || 0),
  });
  // Families, kids and show breeders take note of the tag
  const tagLike = { family: "pet", kid: "pet", show: "breeder", farmer: "breeder" };
  for (const k of BUYER_KINDS) {
    const want = tagLike[k.id];
    if (!want || k._tagWrapped) continue;
    const base = k.like;
    k.like = (f) => base(f) + (f && f.weanTag === want ? 0.15 : f && f.weanTag === "feed" ? -0.2 : 0);
    k._tagWrapped = true;
  }
}

// ---- Orders: colour tiers (Orders.js coat) ----
if (typeof ORDER_REQUIREMENTS !== "undefined" && ORDER_REQUIREMENTS.coat) {
  const coat = ORDER_REQUIREMENTS.coat;
  const make = coat.make;
  coat.make = (rnd, level, taken) => {
    const r = make(rnd, level, taken);
    if (r.nice && level >= 2 && rnd() < 0.35) return { tier: 1, value: 320 };
    return r;
  };
  const label = coat.label;
  coat.label = (r) => (r.tier === 1 ? "Colour tier 1 (prized coat)" : r.nice ? "Colour tier 1 or 2 (not poopie or drab)" : label(r));
  const matches = coat.matches;
  coat.matches = (r, f) => (r.tier === 1 ? colourTier(f) === 1 : matches(r, f));
}
