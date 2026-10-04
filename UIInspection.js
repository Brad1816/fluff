// ---------------------------------------------------------------------------
// The magnifying glass panel (getFluffyInspectionInfo, drawInspectionModal)
// and renaming a fluffy. Split out of UI.js.
// ---------------------------------------------------------------------------

// "Change name": the naming pop-up (Names.js), with its dice button
// More rows for the magnifying glass from other files: [label, "describeFn"]
// (each describeFn(f) returns [text, tone] or null)
const INSPECT_ROWS = [["Ear tag", "describeWeanTag"]];

function openNameModal(fluffy) {
  if (!fluffy) return;
  namingPopup = { ids: [fluffy.id], kind: "rename", names: [fluffyNames[fluffy.id] || ""], focus: 0 };
}

// ---------------------------------------------------------------------------
// Magnifying glass inspection panel
//
// getFluffyInspectionInfo(f) works out WHAT to show; drawInspectionModal()
// only draws it. To add a new row, push another { label, value, tone } into
// one of the lists below. tone colours the value:
//   "good" = green, "ok" = yellow, "bad" = red, anything else = white.
// ---------------------------------------------------------------------------
const INSPECTION_TONE_COLORS = {
  good: "#7dff8a",
  ok: "#ffe066",
  bad: "#ff6b6b",
};

function describeInspectionHappiness(f) {
  if (f.happiness <= WAN_DIE_THRESHOLD) return ["Looping (wants to die)", "bad"];
  if (f.happiness <= HAPPINESS_MISERABLE_THRESHOLD) return ["Miserable", "bad"];
  if (f.happiness < HAPPINESS_SAD_THRESHOLD) return ["Unhappy", "ok"];
  if (f.happiness > HAPPINESS_HAPPY_THRESHOLD) return ["Happy", "good"];
  return ["Okay", ""];
}

function describeInspectionHunger(f) {
  if (f.hunger > 0.7) return ["Full", "good"];
  if (f.hunger > 0.4) return ["Peckish", ""];
  if (f.hunger > 0.15) return ["Hungry", "ok"];
  return ["Starving", "bad"];
}

function describeInspectionTiredness(f) {
  const t = f.sleepDeprivation || 0;
  if (t < 0.3) return ["Rested", "good"];
  if (t < 0.7) return ["Tired", "ok"];
  return ["Exhausted", "bad"];
}

// pottyTraining goes 0 -> 1. It's also the chance a fluffy bothers to
// look for a litterbox when it needs to go (UseLitterboxDesire).
function describeInspectionPottyTraining(f) {
  const t = f.pottyTraining || 0;
  if (t >= 1) return ["Fully trained", "good"];
  if (t <= 0) return ["Not trained (poops anywhere)", "bad"];
  const pct = Math.round(t * 100);
  return [`Learning (uses box ${pct}% of the time)`, pct >= 50 ? "ok" : "bad"];
}

// calculateColorismPerception() is how nice other fluffies think the coat
// is (judgeCoatColour in globals.js): brown is poopie, greys, black,
// pastels and muddy colours are drab, vivid colours are lovely.
function describeInspectionCoat(f) {
  const key = f.getColorName ? f.getColorName() : "?";
  const word = typeof COLOUR_WORDS !== "undefined" ? COLOUR_WORDS[key] || key : key;
  const colorName = word.charAt(0).toUpperCase() + word.slice(1);
  const p = f.genetics ? f.genetics.calculateColorismPerception() : 1;
  if (p < COAT_POOPIE_LINE) return [`${colorName} - poopie colours!`, "bad"];
  if (p < COAT_DRAB_LINE) return [`${colorName} - a bit drab`, "ok"];
  if (p >= COAT_NICE_LINE) return [`${colorName} - bright, lovely colours`, "good"];
  return [`${colorName} - nice colours`, "good"];
}

// coloristDegree: how harshly this fluffy judges coats (mums reject poopie
// foals; friendship and special friend offers from poopie or drab
// fluffies may be refused).
function describeInspectionColorism(f) {
  const d = f.coloristDegree || 0;
  if (d < 0.2) return ["Doesn't care about colours", "good"];
  if (d < 0.6) return ["A bit picky about colours", "ok"];
  return ["Mean to poopie fluffies", "bad"];
}

function describeInspectionPersonality(f) {
  const list = (f.personalities || []).map((p) =>
    p
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
  );
  if (list.length === 0) return ["Normal", ""];
  const good = typeof isGoodSmarty === "function" && isGoodSmarty(f);
  if (good) return [list.map((p) => (p === "Smarty" ? "Good smarty" : p)).join(", "), "good"];
  const tone = f.isSmarty && f.isSmarty() ? "bad" : "";
  return [list.join(", "), tone];
}

function describeInspectionAge(f) {
  // In game days, with the life stage (Aging.js)
  if (typeof describeAge === "function") return describeAge(f);
  const mins = Math.floor((f.age || 0) / 60);
  const secs = Math.floor((f.age || 0) % 60);
  const time = mins > 0 ? `${mins}m ${secs}s old` : `${secs}s old`;
  if (f.growth < 1) {
    return `Foal, ${Math.floor(f.growth * 100)}% grown (${time})`;
  }
  return `Adult (${time})`;
}

function getInspectionConditions(f) {
  const bad = [];
  const good = [];
  // (only once it shows, or the vet's said: Micro.js)
  if (f.isSensitive && f.isSensitive() && (typeof sbsVisible !== "function" || sbsVisible(f))) bad.push("sensitive baby");
  if (f.isPoisoned) bad.push("poisoned");
  if (f.isToxoplasmosis) bad.push("toxoplasmosis");
  if (f.isDiarrhea) bad.push("diarrhea");
  if (f.isIncontinent) bad.push("incontinent");
  if (f.accessories?.eyes?.id === "blindfold") bad.push("blindfolded");
  if (f.accessories?.ABOVE_LUMPS?.id === "castration_band")
    bad.push("castration band on");
  if (f.isToxoVaccinated) good.push("toxo vaccinated");
  // Fluffy flu (Illness.js)
  const ill = typeof describeIllness === "function" ? describeIllness(f) : null;
  if (ill) bad.push(ill);
  if (f.fluVaccinated) good.push("flu jab");
  return { bad, good };
}

function getFluffyInspectionInfo(f) {
  // Unnamed fluffies are shown as "Fluffy (pink unicorn mare)" (Names.js)
  const nameOf = (id, fallback) =>
    id !== null && id !== undefined
      ? typeof fluffyDisplayNameById === "function"
        ? fluffyDisplayNameById(id, fallback)
        : fluffyNames[id] || fallback
      : "Unknown";
  const rels = relationships[f.id] || {};
  const sfId = Object.keys(rels).find((id) => rels[id] === "special_friend");
  const friendCount = Object.values(rels).filter((r) => r === "friend").length;

  const about = [
    { label: "Name", value: typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : fluffyNames[f.id] || "Fluffy" },
    // Named by its old owner (runaways, lost pets) or its breeder (Names.js)
    ...(typeof namedBy === "function" && namedBy(f) && namedBy(f) !== "you" ? [{ label: "Named by", value: namedBy(f) }] : []),
    { label: "Gender", value: f.gender },
    { label: "Type", value: f.type },
    { label: "Age", value: describeInspectionAge(f), tone: typeof describeAgeTone === "function" ? describeAgeTone(f) : "" },
    ...(typeof describeGrowthStage === "function" && describeGrowthStage(f) ? [{ label: "Stage", value: describeGrowthStage(f)[0], tone: describeGrowthStage(f)[1] }] : []), // (Grading.js)
    { label: "Sexuality", value: f.sexuality || "heterosexual" },
  ];
  // Which litter it came from, and how strong a foal (Pregnancy.js)
  const born = typeof describeBirth === "function" ? describeBirth(f) : null;
  if (born && born[0]) about.push({ label: "Born", value: born[0], tone: born[1] });
  // Show ribbons (Shows.js)
  const ribbons = typeof describeRibbons === "function" ? describeRibbons(f) : null;
  if (ribbons) about.push({ label: "Ribbons", value: ribbons, tone: "good" });
  const [persText, persTone] = describeInspectionPersonality(f);
  about.push({ label: "Personality", value: persText, tone: persTone });
  const smarts = typeof describeSmarts === "function" ? describeSmarts(f) : null; // Intelligence.js
  if (smarts) about.push({ label: "Smarts", value: smarts[0], tone: smarts[1] });
  // Inherited personality traits (Traits.js)
  if (typeof describeTraits === "function") {
    about.push({ label: "Traits", value: describeTraits(f) });
    // What its life has done to it, and what it loves most (Personality.js)
    const shifts = typeof describeTraitShifts === "function" ? describeTraitShifts(f) : null;
    if (shifts) about.push({ label: "Life made it", value: shifts });
    const deformed = typeof describeDeformities === "function" ? describeDeformities(f) : null; // Inbreeding.js
    if (deformed) about.push({ label: "Deformities", value: deformed[0], tone: deformed[1] });
    const wear = typeof describeBreedWear === "function" ? describeBreedWear(f) : null; // Inbreeding.js
    if (wear) about.push({ label: "Worn out", value: wear[0], tone: wear[1] });
    const hurt = typeof describeInjuries === "function" ? describeInjuries(f) : null; // Injuries.js
    if (hurt) about.push({ label: "Injuries", value: hurt[0], tone: hurt[1] });
    const scars = typeof describeScars === "function" ? describeScars(f) : null; // Scars.js
    if (scars) about.push({ label: "Scars", value: scars[0], tone: scars[1], tip: scars[2] });
    const role = typeof describeFamilyRole === "function" ? describeFamilyRole(f) : null; // Gossip.js
    if (role) about.push({ label: "Family role", value: role[0], tone: role[1] });
    const bestest = typeof describeBestest === "function" ? describeBestest(f) : null; // Favourites.js
    if (bestest) about.push({ label: "Favourite", value: bestest[0], tone: bestest[1] });
    // Mothers and foals (batch 12)
    const runt = typeof describeRunt === "function" ? describeRunt(f) : null; // Runts.js
    if (runt) about.push({ label: "Runt", value: runt[0], tone: runt[1] });
    const song = typeof describeSong === "function" ? describeSong(f) : null; // Lullaby.js
    if (song) about.push({ label: "Mummah song", value: song[0], tone: song[1] });
    const mothering = typeof describeMothering === "function" ? describeMothering(f) : null; // BadMummah.js
    if (mothering) about.push({ label: "Mothering", value: mothering[0], tone: mothering[1] });
    const smelt = typeof describeSmellRejected === "function" ? describeSmellRejected(f) : null; // Runts.js
    if (smelt) about.push({ label: "Rejected", value: smelt[0], tone: smelt[1] });
    const knowsMum = typeof describeFoalMum === "function" ? describeFoalMum(f) : null; // FoalLife.js
    if (knowsMum) about.push({ label: "Its mum", value: knowsMum[0], tone: knowsMum[1] });
    const bullying = typeof describeBullying === "function" ? describeBullying(f) : null; // FoalLife.js
    if (bullying) about.push({ label: "Bullying", value: bullying[0], tone: bullying[1] });
    const rec = typeof describeRecovery === "function" ? describeRecovery(f) : null; // Recovery.js
    if (rec) about.push({ label: "Surgery", value: rec[0], tone: rec[1] });
    const flight = typeof describeFlight === "function" ? describeFlight(f) : null; // Flight.js
    if (flight) about.push({ label: "Wings", value: flight[0], tone: flight[1] });
    const foster = typeof describeFoster === "function" ? describeFoster(f) : null; // Fostering.js
    if (foster) about.push({ label: "Foster mum", value: foster[0], tone: foster[1] });
    const mourn = typeof describeMourning === "function" ? describeMourning(f) : null; // MemorialTree.js
    if (mourn) about.push({ label: "Mourning", value: mourn[0], tone: mourn[1] });
    const plush = typeof describePlushie === "function" ? describePlushie(f) : null; // Plushie.js
    if (plush) about.push({ label: "Comfort toy", value: plush[0], tone: plush[1] });
    const elder = typeof describeElder === "function" ? describeElder(f) : null; // Elders.js
    if (elder) about.push({ label: "Elder", value: elder[0], tone: elder[1] });
    const incub = typeof describeIncubator === "function" ? describeIncubator(f) : null; // Premature.js
    if (incub) about.push({ label: "Incubator", value: incub[0], tone: incub[1] });
    const atTrainer = typeof describeAutoTraining === "function" ? describeAutoTraining(f) : null; // AutoTrainer.js
    if (atTrainer) about.push({ label: "Training", value: atTrainer, tone: "good" });
    const mare = typeof describeMareRest === "function" ? describeMareRest(f) : null; // Pregnancy.js
    if (mare) about.push({ label: "Resting", value: mare, tone: "ok" });
    const early = typeof describePremature === "function" ? describePremature(f) : null; // Premature.js
    if (early) about.push({ label: "Birth", value: early[0], tone: early[1] });
    const rule = typeof describeMatingRule === "function" ? describeMatingRule(f) : null; // MatingRule.js
    if (rule) about.push({ label: "Mating", value: rule[0], tone: rule[1] });
    const title = typeof describeTitle === "function" ? describeTitle(f) : null; // Titles.js
    if (title) about.push({ label: "Title", value: title[0], tone: title[1] });
    const change = typeof describeTitleProgress === "function" ? describeTitleProgress(f) : null;
    if (change) about.push({ label: "Changing", value: change, tone: /breaking/.test(change) ? "bad" : "" });
    const cond = typeof describeConditioning === "function" ? describeConditioning(f) : null; // Care.js
    if (cond) about.push({ label: "Conditioned", value: cond[0], tone: cond[1] });
    const drilled = typeof describeFearTraining === "function" ? describeFearTraining(f) : null; // FearTraining.js
    if (drilled) about.push({ label: "Drilled", value: drilled[0], tone: drilled[1] });
    const heard = typeof describeGossip === "function" ? describeGossip(f) : null;
    if (heard) about.push({ label: "Heard", value: heard[0], tone: heard[1] });
    const fav = typeof describeFavouriteCare === "function" ? describeFavouriteCare(f) : null;
    if (fav) about.push({ label: "Loves most", value: fav[0], tone: fav[1] });
    const wish = typeof describeWish === "function" ? describeWish(f) : null; // Wishes.js
    if (wish) about.push({ label: "Wishes for", value: wish[0], tone: wish[1] });
  }
  about.push({ label: "Mother", value: nameOf(f.motherId, "Unnamed fluffy") });
  const line = typeof describeLine === "function" ? describeLine(f) : null; // (FamilyLines.js)
  if (line) about.push({ label: "Line", value: line[0], tone: line[1] });
  about.push({ label: "Father", value: nameOf(f.fatherId, "Unnamed fluffy") });
  about.push({
    label: "Special friend",
    value: sfId ? nameOf(sfId, "Fluffy") : "None",
  });
  about.push({ label: "Friends", value: String(friendCount) });
  // Which herd it's in (Herds.js)
  if (f.isAlive && typeof describeHerd === "function") {
    about.push({ label: "Herd", value: describeHerd(f) });
    for (const [label, fn] of [...INSPECT_ROWS, ["Fake alicorn", "describeFakeAlicorn"], ["Mouth", "describeMouth"], ["Kept little", "describeForeverFoal"], ["Dizzy", "describeDizzy"], ["Heat", "describeHeat"], ["Size", "describeMicro"], ["Stuck", "describeGlued"], ["Born with", "describeDefect"], ["Bad meat", "describeBadMeat"], ["Stud", "describeStud"], ["Snitch", "describeSnitch"]]) {
      const r = typeof window[fn] === "function" ? window[fn](f) : null; // (Trade.js, Tools.js)
      if (r) about.push({ label, value: r[0], tone: r[1] });
    }
    const machine = typeof describeFoalMachine === "function" ? describeFoalMachine(f) : null; // FoalMachine.js
    if (machine) about.push({ label: "The machine", value: machine[0], tone: machine[1] });
    const raid = typeof describeRaid === "function" ? describeRaid(f) : null; // Raids.js
    if (raid) about.push({ label: "Raiding", value: raid[0], tone: raid[1] });
    const lured = typeof describeLured === "function" ? describeLured(f) : null; // Lures.js
    if (lured) about.push({ label: "Came for", value: lured[0], tone: lured[1] });
    const job = typeof describeHerdJob === "function" ? describeHerdJob(f) : null; // HerdJobs.js
    if (job) about.push({ label: "Herd job", value: job[0], tone: job[1] });
    const feud = typeof describeHerdFeud === "function" ? describeHerdFeud(f) : null; // HerdWars.js
    if (feud) about.push({ label: "Feud", value: feud[0], tone: feud[1] });
  }
  // Taken away from its herd/family (Separation.js)
  const misses = typeof describeSeparation === "function" ? describeSeparation(f) : null;
  if (misses && f.isAlive) {
    // (makes room by dropping the plain friend count, which Buddies covers)
    const fi = about.findIndex((row) => row.label === "Friends");
    if (fi >= 0) about.splice(fi, 1);
    about.push({ label: "Misses", value: misses, tone: "bad" });
  }
  // Buddies and grudges with other fluffies (Bonds.js)
  if (f.isAlive && typeof describeBuddies === "function") {
    about.push({ label: "Buddies", value: describeBuddies(f), tone: "" });
    const grudges = describeGrudges(f);
    about.push({ label: "Grudges", value: grudges, tone: grudges === "None" ? "" : "bad" });
  }
  // Recent things you did to it (Memory.js)
  if (f.isAlive && typeof describePlayerMemories === "function") {
    about.push({ label: "Remembers", value: describePlayerMemories(f) });
  }
  // Tricks it knows or is learning (Tricks.js)
  if (f.isAlive && f.adopted && typeof describeTricks === "function") {
    const [tText, tTone] = describeTricks(f);
    about.push({ label: "Tricks", value: tText, tone: tTone });
  }
  // Smarty lessons (Lessons.js)
  if (f.isAlive && f.adopted && typeof describeLessons === "function") {
    const ls = describeLessons(f);
    if (ls) about.push({ label: "Lessons", value: ls[0], tone: ls[1] });
  }

  const care = [];
  if (!f.isAlive) {
    care.push({ label: "Cause of death", value: f.causeOfDeath || "Unknown", tone: "bad" });
    care.push({
      label: "Last desire",
      value: f.lastDesire
        ? `${f.lastDesire.desire} (${f.lastDesire.value.toFixed(1)})`
        : "None",
    });
  } else {
    const row = (label, [value, tone]) => care.push({ label, value, tone });
    row("Happiness", describeInspectionHappiness(f));
    row("Hunger", describeInspectionHunger(f));
    const hp = Math.round(f.health);
    care.push({ label: "Health", value: `${hp}/100`, tone: hp > 70 ? "good" : hp > 35 ? "ok" : "bad" });
    row("Sleep", describeInspectionTiredness(f));
  }
  care.push({ label: "Litter trained", value: describeInspectionPottyTraining(f)[0], tone: describeInspectionPottyTraining(f)[1] });
  const [coatText, coatTone] = describeInspectionCoat(f);
  care.push({ label: "Coat", value: coatText, tone: coatTone });
  const tier = typeof describeColourTier === "function" ? describeColourTier(f) : null; // (Grading.js)
  if (tier) care.push({ label: "Colour tier", value: tier[0], tone: tier[1] });
  // A fancy mane (ManePatterns.js)
  const fancyMane = typeof describeManePattern === "function" ? describeManePattern(f) : null;
  if (fancyMane) care.push({ label: "Mane", value: fancyMane, tone: "good" });
  if (typeof worldSettings === "undefined" || worldSettings.colorism) {
    const [cText, cTone] = describeInspectionColorism(f);
    care.push({ label: "Colour views", value: cText, tone: cTone });
  }
  // Resting after a litter (Population.js)
  if (f.isAlive && typeof describeBreedingRest === "function") {
    const rest = describeBreedingRest(f);
    if (rest) care.push({ label: "Breeding", value: rest[0], tone: rest[1] });
  }
  // Fears (Fears.js)
  if (f.isAlive && typeof describeFears === "function") {
    const [fText, fTone] = describeFears(f);
    care.push({ label: "Fears", value: fText, tone: fTone });
    const fr = describeFright(f);
    if (fr) care.push({ label: "Frightened", value: fr[0], tone: fr[1] });
  }
  // Foals copy the grown-ups raising them (Upbringing.js)
  if (typeof describeUpbringing === "function") {
    const up = describeUpbringing(f);
    if (up) care.push({ label: "Growing up", value: up[0], tone: up[1] });
  }
  if (f.gender === "female") {
    care.push({ label: "Spayed", value: f.spayed ? "Yes" : "No" });
    if (f.isAlive) {
      // Due date, how well she's cared for, the vet's scan (Pregnancy.js)
      const [pText, pTone] = typeof describePregnancy === "function" ? describePregnancy(f) : [f.isPregnant ? "Yes" : "No", f.isPregnant ? "ok" : ""];
      care.push({ label: "Pregnant", value: pText, tone: pTone });
    }
  }
  // Dirt and baths (Bath.js)
  if (f.isAlive && f.adopted && typeof describeDirt === "function") {
    const [cText, cTone] = describeDirt(f);
    care.push({ label: "Cleanliness", value: cText, tone: cTone });
    care.push({ label: "Bath time", value: describeBathLike(f), tone: "" });
  }
  // Boredom and favourite toy (Play.js)
  if (f.isAlive && f.adopted && typeof describeBoredom === "function" && !f.tooYoungToWalk()) {
    const [bText, bTone] = describeBoredom(f);
    care.push({ label: "Boredom", value: bText, tone: bTone });
    care.push({ label: "Favourite toy", value: describeFavouriteToy(f), tone: "" });
  }
  // Diet, weight and favourite food (Diet.js)
  if (f.isAlive && typeof describeDiet === "function" && !f.tooYoungToWalk()) {
    const [dText, dTone] = describeDiet(f);
    care.push({ label: "Diet", value: dText, tone: dTone });
    const [wText, wTone] = describeWeight(f);
    care.push({ label: "Weight", value: wText, tone: wTone });
    care.push({ label: "Favourite food", value: describeFavouriteFood(f), tone: "" });
  }
  // Cold (Warmth.js)
  const cold = typeof describeWarmth === "function" ? describeWarmth(f) : null;
  if (cold) care.push({ label: "Warmth", value: cold[0], tone: cold[1] });
  // How it feels about you and what it remembers (Memory.js)
  if (f.isAlive && typeof describePlayerFeeling === "function") {
    const [feel, feelTone] = describePlayerFeeling(f);
    // Hearts (Affection.js)
    const hearts = typeof affectionHeartText === "function" && f.adopted ? affectionHeartText(f) + "  " : "";
    care.push({ label: "Affection", value: hearts + feel, tone: feelTone });
    // A wild fluffy getting used to you (Wellbeing.js)
    const settle = typeof settlingProgress === "function" ? settlingProgress(f) : null;
    if (settle !== null) care.push({ label: "Settling in", value: `${Math.round(settle * 100)}%`, tone: settle > 0.6 ? "ok" : "bad" });
    // Abandoned, still missing its old owner (Abandoned.js)
    const missing = typeof describeMissingOwner === "function" ? describeMissingOwner(f) : null;
    if (missing) care.push({ label: "Old owner", value: missing[0], tone: missing[1] });
    // Getting used to alicorns (AlicornAcceptance.js)
    const ali = typeof describeAlicornFeeling === "function" ? describeAlicornFeeling(f) : null;
    if (ali) care.push({ label: "Alicorns", value: ali[0], tone: ali[1] });
    // Permanent scars from how it was taken (Separation.js)
    const scars = typeof describeTraumas === "function" ? describeTraumas(f) : null;
    if (scars) care.push({ label: "Trauma", value: scars, tone: "bad" });
  }
  const missing = f.getMissingBodyPartsText
    ? f.getMissingBodyPartsText()
    : "none";
  care.push({
    label: "Missing parts",
    value: missing,
    tone: missing && missing !== "none" ? "bad" : "",
  });
  if (f.isAlive) {
    const cond = getInspectionConditions(f);
    const parts = [...cond.bad, ...cond.good];
    care.push({
      label: "Conditions",
      value: parts.length ? parts.join(", ") : "none",
      tone: cond.bad.length ? "bad" : cond.good.length ? "good" : "",
    });
    const hasAcc = Object.keys(f.accessories || {}).length > 0;
    let sellText;
    if (f.notForSale && f.isAlive && f.adopted) sellText = `$${Math.floor(f.calculatePrice() / 2)} (kept: not for sale)`; // (NotForSale.js)
    else if (!f.canBeSold || !f.canBeSold()) sellText = "Can't be sold";
    else if (hasAcc) sellText = "Remove accessories to sell";
    else {
      sellText = `$${Math.floor(f.calculatePrice() / 2)}`;
      // How its temperament changes the price (Wellbeing.js)
      const pct = typeof temperamentPriceText === "function" ? temperamentPriceText(f) : "";
      if (pct) sellText += ` (${describeTemperament(f)[0]} ${pct})`;
    }
    care.push({ label: "Sells for", value: sellText });
  }

  return { about, care };
}

// Kept for anything that still wants plain text lines ("Label: value")
function getFluffyInspectionLines(f) {
  const info = getFluffyInspectionInfo(f);
  return [...info.about, ...info.care].map((r) => `${r.label}: ${r.value}`);
}

// ---- The panel: a header, then tabs ----
//
// getFluffyInspectionInfo above builds every row (about / care, as before -
// other code and tests read those). The panel regroups them by label into
// INSPECTION_TABS, each with two columns; the header (portrait, name, type
// and age, sale price, warning chips for anything wrong) shows on every tab.
// The last tab you looked at stays open for the next fluffy.
//
// Overview is a summary: "At a glance" draws the everyday needs as bars, and
// the other column lists what needs you (every red row, from any tab -
// click one to go to its tab) and what's going on right now. The full
// details are on the other tabs. A column too long for the panel pages: the
// "more" button at its foot (or the mouse wheel over it). Hovering a row
// says what it means (INSPECT_ROW_HELP) - and any extra it has (row.tip).
// A row no tab lists yet lands in Work's second column, never lost.

const INSPECT_VITALS = ["Happiness", "Hunger", "Health", "Sleep", "Cleanliness", "Boredom", "Warmth"];
// Shown under "Right now" on the Overview when they're there
const INSPECT_RIGHT_NOW = ["Cause of death", "Last desire", "Doing", "Frightened", "On its mind", "Pregnant", "Birth", "Resting", "Settling in", "Mourning", "Heat", "Wet", "Diaper", "Burn", "Near death", "Tummy", "Dizzy", "Stuck", "Milk stand", "Surgery job", "Growing up"];

// What it's up to (the Overview's "Right now")
const DOING_WORDS = {
  Eat: "Looking for food", Sleep: "Off to bed", Wander: "Wandering about", Sit: "Sitting", LieDown: "Lying down",
  UseLitterbox: "Off to the litterbox", WatchTV: "Watching TV", RunToTV: "Running to the TV", PlayWithBall: "Playing with a ball",
  PlayWithBlocks: "Playing with blocks", ChaseHeldBall: "Chasing the ball", CareForBabies: "Looking after its foals",
  FeedHungryFoal: "Feeding a hungry foal", SeekPlayer: "Coming to you", FleePlayer: "Keeping away from you", Fright: "Frightened",
  FollowHerd: "Following its herd", SeekBuddy: "Looking for a friend", SeekSpecialFriend: "Looking for its special friend",
  Mate: "Looking for a mate", Trick: "Doing a trick", Job: "Working", HerdJob: "Doing its herd job", Shelter: "Taking shelter",
  Heat: "Trying to cool down", Dizzy: "Dizzy", BabbleToFriends: "Chatting", RandomBabble: "Chatting to itself", CorpseReaction: "Upset by a body",
};
function describeDoing(f) {
  if (!f || !f.isAlive) return null;
  if (f.currentStateKey === "SLEEPING") return ["Asleep", ""];
  if (f.isDragging) return ["Being carried", ""];
  const d = f.brain && f.brain.currentDesire;
  if (!d || !d.name) return null;
  const words = DOING_WORDS[d.name] || d.name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  return [words, ""];
}
INSPECT_ROWS.push(["Doing", "describeDoing"]);

// The Overview's "Who it is" (under the bars)
const INSPECT_WHO = ["Personality", "Smarts", "Title", "Wishes for", "Loves most", "Tricks", "Favourite toy"];

const INSPECTION_TABS = [
  {
    id: "overview",
    name: "Overview",
    cols: [
      { title: "At a glance", rows: INSPECT_VITALS },
      { title: "Right now", rows: INSPECT_RIGHT_NOW },
    ],
  },
  // What's making it happy or unhappy (Mood.js)
  { id: "mood", name: "Mood", cols: [] },
  {
    id: "body",
    name: "Body",
    cols: [
      { title: "Health", rows: ["Conditions", "Missing parts", "Injuries", "Near death", "Burn", "Tummy", "Surgery", "Spayed", "Worn out", "Wings", "Mouth", "Size", "Kept little", "Born with", "Bad meat", "Dizzy", "Stuck", "Elder", "Incubator", "Wild"] },
      { title: "Daily care", rows: ["Diet", "Weight", "Favourite food", "Resting", "Litter trained", "Bath time", "Wet", "Diaper", "Heat", "Coat length", "Favourite toy", "Comfort toy"] },
    ],
  },
  {
    id: "family",
    name: "Family",
    cols: [
      { title: "Family", rows: ["Mother", "Father", "Foster mum", "Its mum", "Rejected", "Mothering", "Mummah song", "Line", "Born", "Named by", "Came for", "Mourning", "Herd", "Herd job", "Raiding", "Feud"] },
      { title: "Friends", rows: ["Special friend", "Friends", "Buddies", "Grudges", "Bullying", "Misses"] },
    ],
  },
  {
    id: "looks",
    name: "Nature",
    cols: [
      { title: "Looks", rows: ["Gender", "Type", "Age", "Stage", "Coat", "Mane", "Colour tier", "Runt", "Fake alicorn", "Deformities", "Scars", "Ribbons"] },
      { title: "Nature", rows: ["Personality", "Traits", "Smarts", "Life made it", "Family role", "Favourite", "Sexuality", "Colour views", "Fears", "Growing up"] },
    ],
  },
  {
    id: "mind",
    name: "Mind",
    cols: [
      { title: "You and it", rows: ["Affection", "Title", "Changing", "Wishes for", "Loves most", "Tricks", "Training", "Drilled", "Lessons", "Conditioned", "Remembers", "Heard", "Old owner", "Settling in"] },
      { title: "Worries", rows: ["Frightened", "On its mind", "Trauma", "Alicorns", "The machine", "Snitch"] },
    ],
  },
  {
    id: "work",
    name: "Work",
    cols: [
      { title: "Breeding", rows: ["Breeding", "Pregnant", "Birth", "Mating", "Stud"] },
      { title: "Money & jobs", rows: ["Sells for", "Ear tag", "Job", "Milk stand", "Surgery job", "Cause of death", "Last desire"] },
    ],
  },
  // Its life, told like a book (LifeStory.js)
  { id: "story", name: "Story", cols: [] },
];
let inspectionTab = "overview";

// What each row means (the hover tip)
const INSPECT_ROW_HELP = {
  Happiness: "Wears down with hunger, cages and loneliness; knocks on top can tip it over.",
  Hunger: "Fill a bowl it can reach. Starving ones lose health.",
  Health: "Out of 100. The vet treats most things.",
  Sleep: "Tired fluffies are grumpy; a bed (and lights out) helps.",
  Cleanliness: "A bath (sponge) or a lick from mum. Filthy ones catch things.",
  Boredom: "Toys, tricks, the TV, the park and other fluffies.",
  Warmth: "Heaters, beds, huddling and a long coat keep it warm.",
  Affection: "Hearts: what you've done for it lately. More hearts, more upsies.",
  Smarts: "0-100: how fast it learns tricks and lessons.",
  Traits: "Born with these; life shifts them a little.",
  Personality: "How it acts with others.",
  Fears: "Calm it, sit with it, or face the fear with it (the right-click menu).",
  Title: "Earned from how it's been treated - and it changes how it acts.",
  "Sells for": "What a buyer would start at; condition and taste change the offer.",
  "Colour tier": "How its colour sells: 1 is the best, 4 a poopie coat.",
  "Litter trained": "Praise it after it uses the box; it gets better.",
  Breeding: "Whether it can breed now, and how worn out it is.",
  Grudges: "Fluffies it holds a grudge against.",
  Friends: "Who it likes best.",
  Scars: "Hover for how each one happened.",
  Weight: "Kibble and treats fatten, play and the park slim it.",
  Diet: "What it's been eating lately.",
  "Coat length": "Long coats are warm, mat over the days and hide weight.",
  Wild: "Born wild: smaller and rougher each generation.",
  Tummy: "Hot peppers or a rock. The vet clears a blockage.",
  "On its mind": "Something it's carrying around - a story, a lie, the lights.",
  Trauma: "Hard things it's lived through. Kindness slowly helps.",
};

// { tabs: [{ id, name, cols: [{ title, rows }], bad }], warnings, rows, needs }
function getInspectionTabs(f) {
  const info = getFluffyInspectionInfo(f);
  const all = [...info.about, ...info.care];
  const byLabel = {};
  for (const r of all) byLabel[r.label] = r;
  const used = new Set(["Name"]);
  const tabOf = {};
  const tabs = INSPECTION_TABS.map((t) => ({
    id: t.id,
    name: t.name,
    cols: t.cols.map((c) => ({
      title: c.title,
      rows: c.rows.filter((l) => byLabel[l]).map((l) => (used.add(l), t.id !== "overview" && !tabOf[l] && (tabOf[l] = t.id), byLabel[l])),
    })),
  }));
  // Anything new that isn't sorted into a tab yet: Work's second column
  const extra = all.filter((r) => !used.has(r.label));
  const work = tabs.find((t) => t.id === "work");
  if (extra.length && work) {
    work.cols[1].rows.push(...extra);
    for (const r of extra) tabOf[r.label] = "work";
  }
  for (const t of tabs) t.bad = t.cols.some((c) => c.rows.some((r) => r.tone === "bad"));
  // Warnings for the header: the worst things, from any tab
  const warn = [];
  const needs = [];
  const short = { Affection: null, Conditions: null, "Missing parts": "Missing", "Cause of death": null, Grudges: null };
  // Things about its nature, not its needs: they stay red in their tab but don't shout in the header
  const notUrgent = new Set(["Personality", "Coat", "Colour tier", "Alicorns", "Runt", "Mummah song", "Bullying", "Grudges", "Cause of death", "Litter trained", "Colour views", "Growing up", "Fears", "Title", "Changing", "Conditioned", "Drilled", "Heard", "Scars", "Family role", "Wings", "Smarts", "Injuries", "Deformities"]);
  for (const r of all) {
    if (r.tone !== "bad" || notUrgent.has(r.label)) continue;
    const label = r.label in short ? short[r.label] : r.label;
    const value = String(r.value).replace(/[♥❥♡]/g, "").trim(); // no hearts in a chip
    warn.push(label ? `${label}: ${value}` : value);
    needs.push({ ...r, jump: tabOf[r.label] || null });
  }
  // The everyday needs first (a starving fluffy shouldn't hide behind a scar)
  const rank = (t) => {
    const i = INSPECT_VITALS.indexOf(String(t).split(":")[0]);
    return i < 0 ? 99 : i;
  };
  warn.sort((a, b) => rank(a) - rank(b));
  needs.sort((a, b) => rank(a.label) - rank(b.label));
  // The Overview's second column: what needs you, then what's going on
  const ov = tabs[0];
  ov.needs = needs;
  return { tabs, warnings: warn, rows: byLabel, needs };
}

// Paging the columns: first row shown, by "tab:col"; reset for a new fluffy
let inspectionScroll = {};
let _inspScrollFor = null;
let _inspPagers = []; // [{ x, y, w, h, key, dir }] where the more/back buttons are
let _inspColRects = []; // [{ x, y, w, h, key, rows }] for the wheel
let _inspJumps = []; // [{ x, y, w, h, tab }] Overview rows that go to their tab

function getInspectionModalLayout() {
  const listW = Math.min(860, width - 40);
  const listH = Math.min(600, height - 30);
  const listX = width / 2 - listW / 2;
  const listY = height / 2 - listH / 2;
  const btnW = Math.min(170, (listW - 40 - 3 * 12) / 4); // (four of them, narrower on a small screen)
  const btnH = 40;
  const tabY = listY + 138;
  const tabW = (listW - 40 - (INSPECTION_TABS.length - 1) * 6) / INSPECTION_TABS.length;
  return {
    listX,
    listY,
    listW,
    listH,
    btnW,
    btnH,
    // Change name | Actions | Family tree | Close, spread evenly
    nameBtnX: listX + 20,
    actionsBtnX: listX + 20 + (listW - 40 - btnW) / 3,
    treeBtnX: listX + 20 + ((listW - 40 - btnW) * 2) / 3,
    closeBtnX: listX + listW - btnW - 20,
    btnY: listY + listH - 60,
    tabs: INSPECTION_TABS.map((t, i) => ({ id: t.id, x: listX + 20 + i * (tabW + 6), y: tabY, w: tabW, h: 34 })),
    contentY: tabY + 70,
  };
}

// How tall a row is drawn (wrapped)
function _inspRowHeight(ctx, row, colW, labelW) {
  ctx.font = "bold 14px Arial";
  const n = typeof wrapText === "function" ? wrapText(ctx, String(row.value), colW - labelW).length : 1;
  return n * 20 + 5;
}

function drawInspectionColumn(ctx, title, rows, x, y, colW, maxY = Infinity, key = null, opts = {}) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 17px Arial";
  ctx.fillStyle = "#ffd6f0";
  ctx.fillText(title, x, y);
  const titleY = y;
  y += 28;
  if (!rows.length) {
    ctx.font = "italic 14px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(opts.empty || "Nothing to show", x, y);
    return y;
  }
  const labelW = opts.labelW || 132;
  const lineSpacing = 20;
  // Paging
  let start = key ? Math.max(0, Math.min(rows.length - 1, inspectionScroll[key] || 0)) : 0;
  if (key) _inspColRects.push({ x, y: titleY - 18, w: colW, h: maxY - titleY + 18, key, rows: rows.length });
  const footH = 26;
  let drawn = 0;
  let i = start;
  for (; i < rows.length; i++) {
    const row = rows[i];
    const h = _inspRowHeight(ctx, row, colW - (row.jump && opts.jumps ? 56 : 0), labelW);
    const last = i === rows.length - 1;
    if (y - 15 + h > maxY - (last ? 0 : footH) && drawn > 0) break;
    const top = y - 15;
    const hover = typeof mouse !== "undefined" && mouse.x >= x - 4 && mouse.x <= x + colW && mouse.y >= top && mouse.y < top + h - 2;
    if (hover) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      if (typeof fillRoundRect === "function") fillRoundRect(ctx, x - 4, top - 2, colW + 4, h, 6);
    }
    ctx.font = "14px Arial";
    ctx.fillStyle = "#b8b8c8";
    ctx.fillText(typeof fitText === "function" ? fitText(ctx, row.label, labelW - 6) : row.label, x, y);
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = INSPECTION_TONE_COLORS[row.tone] || "white";
    const valW = colW - labelW - (row.jump && opts.jumps ? 56 : 0);
    const wrapped = typeof wrapText === "function" ? wrapText(ctx, String(row.value), valW) : [String(row.value)];
    for (const sub of wrapped) {
      ctx.fillText(sub, x + labelW, y);
      y += lineSpacing;
    }
    // An Overview row that goes to its tab
    if (row.jump && opts.jumps) {
      _inspJumps.push({ x: x - 4, y: top - 2, w: colW + 4, h, tab: row.jump });
      ctx.font = "11px Arial";
      ctx.fillStyle = "rgba(255, 214, 240, 0.55)";
      ctx.textAlign = "right";
      const tn = (INSPECTION_TABS.find((t) => t.id === row.jump) || {}).name || "";
      ctx.fillText(`${tn} ›`, x + colW, top + 12);
      ctx.textAlign = "left";
    }
    // What it means, and any more it has to say (Scars.js: how each one happened)
    if (hover) {
      const help = INSPECT_ROW_HELP[row.label];
      const tip = [...(row.tip || [])];
      if (wrapped.length > 3) tip.unshift(...wrapped.slice(0, 6));
      if (help) tip.push(help);
      if (tip.length) _inspectionTip = tip;
    }
    y += 5;
    drawn++;
  }
  // More below / back to the top
  if (key && (i < rows.length || start > 0)) {
    const more = rows.length - i;
    const by = maxY - footH + 4;
    const bw = 120;
    if (more > 0) {
      _inspPagers.push({ x, y: by, w: bw, h: 22, key, dir: i - start });
      _inspPagerButton(ctx, x, by, bw, `▼ ${more} more`);
    }
    if (start > 0) {
      const bx = more > 0 ? x + bw + 8 : x;
      _inspPagers.push({ x: bx, y: by, w: 90, h: 22, key, dir: -start });
      _inspPagerButton(ctx, bx, by, 90, "▲ Top");
    }
  }
  return y;
}

function _inspPagerButton(ctx, x, y, w, text) {
  const hover = typeof mouse !== "undefined" && isPointInRect(mouse.x, mouse.y, x, y, w, 22);
  ctx.fillStyle = hover ? "rgba(255, 170, 220, 0.4)" : "rgba(255,255,255,0.1)";
  if (typeof fillRoundRect === "function") fillRoundRect(ctx, x, y, w, 22, 11);
  ctx.font = "bold 12px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + 12);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// The Overview's bars: 0..1 for each everyday need (null: not shown)
function inspectionVitalLevel(f, label) {
  const c = (v) => Math.max(0, Math.min(1, v));
  switch (label) {
    case "Happiness":
      return c(f.happiness ?? 0.5);
    case "Hunger":
      return c(f.hunger ?? 1);
    case "Health":
      return c((f.health ?? 100) / 100);
    case "Sleep":
      return c(1 - (f.sleepDeprivation || 0));
    case "Cleanliness":
      return c(1 - (f.dirt || 0));
    case "Boredom":
      return c(1 - (f.boredom || 0));
    case "Warmth":
      return c(f.warmth ?? 1);
  }
  return null;
}

function drawInspectionVitals(ctx, f, rows, x, y, colW) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 17px Arial";
  ctx.fillStyle = "#ffd6f0";
  ctx.fillText("At a glance", x, y);
  y += 26;
  const labelW = 96;
  const barW = Math.max(60, Math.min(150, colW - labelW - 150));
  for (const row of rows) {
    const lvl = inspectionVitalLevel(f, row.label);
    const top = y - 14;
    const hover = typeof mouse !== "undefined" && mouse.x >= x - 4 && mouse.x <= x + colW && mouse.y >= top && mouse.y < top + 28;
    if (hover) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      if (typeof fillRoundRect === "function") fillRoundRect(ctx, x - 4, top - 3, colW + 4, 28, 6);
      const help = INSPECT_ROW_HELP[row.label];
      _inspectionTip = [`${row.label}: ${row.value}`, ...(help ? [help] : [])];
    }
    ctx.font = "14px Arial";
    ctx.fillStyle = "#b8b8c8";
    ctx.fillText(row.label, x, y);
    const col = INSPECTION_TONE_COLORS[row.tone] || "#c9a6ff";
    if (lvl !== null) {
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      if (typeof fillRoundRect === "function") fillRoundRect(ctx, x + labelW, y - 11, barW, 12, 6);
      ctx.fillStyle = col;
      if (typeof fillRoundRect === "function" && lvl > 0.02) fillRoundRect(ctx, x + labelW, y - 11, Math.max(6, barW * lvl), 12, 6);
    }
    ctx.font = "bold 13px Arial";
    ctx.fillStyle = col;
    const vx = x + labelW + (lvl !== null ? barW + 10 : 0);
    const v = String(row.value);
    ctx.fillText(typeof fitText === "function" ? fitText(ctx, v, x + colW - vx) : v, vx, y);
    y += 28;
  }
  return y;
}

let _inspectionTip = null;
function _drawInspectionTip(ctx) {
  const lines = _inspectionTip;
  _inspectionTip = null;
  if (!lines || !lines.length) return;
  ctx.save();
  ctx.font = "13px Arial";
  const w = Math.min(width - 20, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18);
  const h = lines.length * 18 + 10;
  const x = Math.max(10, Math.min(width - w - 10, mouse.x + 14));
  const y = Math.max(10, Math.min(height - h - 10, mouse.y + 16));
  ctx.fillStyle = "rgba(10, 6, 16, 0.94)";
  if (typeof fillRoundRect === "function") fillRoundRect(ctx, x, y, w, h, 8);
  else ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, x + 9, y + 6 + i * 18));
  ctx.restore();
}

function _inspectionChip(ctx, x, y, text, colour, maxW) {
  ctx.font = "bold 12px Arial";
  const t = typeof fitText === "function" ? fitText(ctx, text, maxW - 16) : text;
  const w = ctx.measureText(t).width + 16;
  ctx.fillStyle = colour;
  if (typeof fillRoundRect === "function") fillRoundRect(ctx, x, y, w, 22, 11);
  else ctx.fillRect(x, y, w, 22);
  ctx.fillStyle = "white";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left"; // (the price above leaves it right-aligned for a wild one)
  ctx.fillText(t, x + 8, y + 12);
  ctx.textBaseline = "alphabetic";
  return w;
}

// Where the Story tab's text goes
let _inspectionStoryFor = null;
function inspectionStoryArea(L) {
  const y = L.contentY - 22;
  return { x: L.listX + 30, y, w: L.listW - 60, h: L.btnY - 10 - y };
}

let _inspData = null;
function drawInspectionModal(ctx) {
  if (!inspectedFluffy) return;
  // Screen pass only (speech bubbles would show through otherwise)
  if (ctx.canvas !== canvas) return;
  const f = inspectedFluffy;
  const L = getInspectionModalLayout();
  // (the rows are worked out a few times a second, not every frame)
  const nowMs = performance.now();
  if (!_inspData || _inspData.f !== f || nowMs - _inspData.at > 250 || nowMs < _inspData.at) _inspData = { f, at: nowMs, data: getInspectionTabs(f) };
  const data = _inspData.data;
  if (!data.tabs.some((t) => t.id === inspectionTab)) inspectionTab = "overview";

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, width, height);
  if (typeof drawScreenPanel === "function") {
    drawScreenPanel(ctx, { x: L.listX, y: L.listY, w: L.listW, h: L.listH }, { fill: "rgb(22, 14, 30)", dim: 0 });
  } else {
    ctx.fillStyle = "rgb(20, 10, 25)";
    ctx.fillRect(L.listX, L.listY, L.listW, L.listH);
  }

  // Header: portrait, name, type and age, price, warnings
  const px = L.listX + 20;
  const py = L.listY + 18;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  if (typeof fillRoundRect === "function") fillRoundRect(ctx, px, py, 104, 104, 12);
  if (typeof f.drawPortraitCached === "function") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, 104, 104);
    ctx.clip();
    try {
      f.drawPortraitCached(ctx, px + 46, py + 62, 81);
    } catch (e) {
      // (portrait not ready)
    }
    ctx.restore();
  }
  const hx = px + 124;
  const name = data.rows.Name ? String(data.rows.Name.value) : "Fluffy";
  ctx.textAlign = "left";
  ctx.font = "bold 24px Arial";
  ctx.fillStyle = "white";
  ctx.fillText(typeof fitText === "function" ? fitText(ctx, name, L.listW - 330) : name, hx, py + 30);
  const sym = f.gender === "male" ? "♂" : "♀";
  const age = data.rows.Age ? data.rows.Age.value : "";
  ctx.font = "15px Arial";
  ctx.fillStyle = "#cfc6e0";
  ctx.fillText(`${sym} ${f.type}${f.isAlive ? "" : " · dead"} · ${age}`, hx, py + 54);
  // Price, top right
  const sells = data.rows["Sells for"];
  if (sells) {
    ctx.textAlign = "right";
    ctx.font = "13px Arial";
    ctx.fillStyle = "#b8b8c8";
    ctx.fillText("Sells for", L.listX + L.listW - 24, py + 14);
    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#9fe0a8";
    const priceText = String(sells.value).split(" (")[0];
    ctx.fillText(priceText, L.listX + L.listW - 24, py + 38);
  }
  // Affection hearts under the price (Affection.js)
  if (f.isAlive && f.adopted && typeof affectionHeartText === "function") {
    ctx.textAlign = "right";
    ctx.font = "20px Arial";
    ctx.fillStyle = "#ff6f9a";
    ctx.fillText(affectionHeartText(f), L.listX + L.listW - 24, py + 64);
    ctx.textAlign = "left";
  }
  // Warning chips (or "Doing fine")
  let cx = hx;
  const chipY = py + 72;
  const keepBtn = typeof inspectionKeepButton === "function" ? inspectionKeepButton(f, L) : null; // NotForSale.js
  const maxX = keepBtn ? keepBtn.x - 8 : L.listX + L.listW - 24;
  if (keepBtn) drawInspectionKeepButton(ctx, f, L);
  if (!data.warnings.length) {
    _inspectionChip(ctx, cx, chipY, f.isAlive ? "✓ Doing fine" : "Remains", f.isAlive ? "rgba(60, 150, 90, 0.8)" : "rgba(90,90,90,0.8)", 200);
  } else {
    for (const w of data.warnings.slice(0, 4)) {
      if (cx > maxX - 60) break;
      cx += _inspectionChip(ctx, cx, chipY, "⚠ " + w, "rgba(190, 60, 60, 0.85)", Math.min(260, maxX - cx)) + 6;
    }
  }

  // Tabs
  for (const t of L.tabs) {
    const tab = data.tabs.find((x) => x.id === t.id);
    const on = t.id === inspectionTab;
    const hover = isPointInRect(mouse.x, mouse.y, t.x, t.y, t.w, t.h);
    ctx.fillStyle = on ? "rgba(255, 170, 220, 0.35)" : hover ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)";
    if (typeof fillRoundRect === "function") fillRoundRect(ctx, t.x, t.y, t.w, t.h, 8);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = on ? "bold 14px Arial" : "14px Arial";
    ctx.fillStyle = on ? "white" : "#d8d0e8";
    ctx.fillText(typeof fitText === "function" ? fitText(ctx, tab.name, t.w - 14) : tab.name, t.x + t.w / 2, t.y + t.h / 2 + 1);
    if (tab.bad) {
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath();
      ctx.arc(t.x + t.w - 12, t.y + 10, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textBaseline = "alphabetic";
  }
  ctx.strokeStyle = "rgba(255, 214, 240, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L.listX + 20, L.tabs[0].y + 44);
  ctx.lineTo(L.listX + L.listW - 20, L.tabs[0].y + 44);
  ctx.stroke();

  // The tab's two columns (or its story, LifeStory.js)
  const tab = data.tabs.find((x) => x.id === inspectionTab) || data.tabs[0];
  const colW = (L.listW - 60) / 2;
  const maxY = L.btnY - 14;
  if (tab.id === "story" && typeof drawLifeStoryTab === "function") {
    if (_inspectionStoryFor !== f.id) {
      _inspectionStoryFor = f.id;
      lifeStoryPage = 0;
    }
    drawLifeStoryTab(ctx, f, inspectionStoryArea(L));
  }
  if (tab.id === "mood" && typeof drawMoodTab === "function") drawMoodTab(ctx, f, inspectionStoryArea(L));
  if (_inspScrollFor !== f.id) {
    _inspScrollFor = f.id;
    inspectionScroll = {};
  }
  _inspPagers = [];
  _inspColRects = [];
  _inspJumps = [];
  if (tab.id === "overview") {
    const x0 = L.listX + 25;
    const x1 = L.listX + 25 + colW + 20;
    // Left: the everyday needs as bars (alive), or what happened
    if (f.isAlive) {
      const vy = drawInspectionVitals(ctx, f, tab.cols[0].rows, x0, L.contentY, colW - 10);
      // ...and who it is, in a few words (the rest on the other tabs)
      const who = INSPECT_WHO.map((l) => data.rows[l]).filter(Boolean);
      if (who.length && vy + 60 < maxY) drawInspectionColumn(ctx, "Who it is", who, x0, vy + 14, colW - 10, maxY, "overview:who");
    }
    else drawInspectionColumn(ctx, "What happened", tab.cols[1].rows, x0, L.contentY, colW - 10, maxY, "overview:0");
    // Right: what needs you (click: its tab), then what's going on
    const rn = f.isAlive ? tab.cols[1].rows.filter((r) => !/^(no|none|-|nothing)$/i.test(String(r.value).trim())) : [];
    const list = [...(tab.needs || []).map((r) => ({ ...r })), ...rn.filter((r) => !(tab.needs || []).some((n) => n.label === r.label))];
    drawInspectionColumn(ctx, (tab.needs || []).length ? `Needs you (${tab.needs.length})` : "Right now", list, x1, L.contentY, colW - 10, maxY, "overview:1", { jumps: true, empty: f.isAlive ? "Nothing needs you right now" : "" });
  } else {
    tab.cols.forEach((col, i) => {
      drawInspectionColumn(ctx, col.title, col.rows, L.listX + 25 + i * (colW + 20), L.contentY, colW - 10, maxY, `${tab.id}:${i}`);
    });
  }

  if (typeof drawGlassButton !== "undefined") {
    drawGlassButton(L.nameBtnX, L.btnY, L.btnW, L.btnH, "Change name");
    // Everything right-click (or a long press) offers, for those who'd
    // rather tap a button: praise, scold, Forget herd... (Tricks.js)
    // (a wild one: who it gets on with, among the wild ones - RelationshipMap.js)
    drawGlassButton(L.actionsBtnX, L.btnY, L.btnW, L.btnH, f.adopted || !f.isAlive ? "Actions" : "Who's who");
    drawGlassButton(L.treeBtnX, L.btnY, L.btnW, L.btnH, "Family tree");
    drawGlassButton(L.closeBtnX, L.btnY, L.btnW, L.btnH, "Close");
  }
  _drawInspectionTip(ctx);
  ctx.restore();
}

function handleInspectionModalClick() {
  if (!inspectedFluffy) return false;

  const L = getInspectionModalLayout();

  // Tabs
  for (const t of L.tabs) {
    if (isPointInRect(mouse.x, mouse.y, t.x, t.y, t.w, t.h)) {
      inspectionTab = t.id;
      return true;
    }
  }
  // Paging a long column; an Overview row going to its tab
  for (const p of _inspPagers) {
    if (isPointInRect(mouse.x, mouse.y, p.x, p.y, p.w, p.h)) {
      inspectionScroll[p.key] = Math.max(0, (inspectionScroll[p.key] || 0) + p.dir);
      return true;
    }
  }
  for (const j of _inspJumps) {
    if (isPointInRect(mouse.x, mouse.y, j.x, j.y, j.w, j.h)) {
      inspectionTab = j.tab;
      return true;
    }
  }
  // The Keep (not for sale) button by the price (NotForSale.js)
  if (typeof clickInspectionKeepButton === "function" && clickInspectionKeepButton(inspectedFluffy, L)) return true;
  // Turning the Story tab's pages (LifeStory.js)
  if (inspectionTab === "story" && typeof handleLifeStoryClick === "function" && handleLifeStoryClick(inspectionStoryArea(L))) return true;

  if (isPointInRect(mouse.x, mouse.y, L.nameBtnX, L.btnY, L.btnW, L.btnH)) {
    const f = inspectedFluffy;
    inspectedFluffy = null;
    openNameModal(f);
    return true;
  }
  if (isPointInRect(mouse.x, mouse.y, L.actionsBtnX, L.btnY, L.btnW, L.btnH)) {
    const f = inspectedFluffy;
    if (f.isAlive && !f.adopted && typeof openRelationshipMap === "function") {
      inspectedFluffy = null;
      openRelationshipMap(f);
    } else if (typeof openFluffyActions === "function" && openFluffyActions(f)) inspectedFluffy = null;
    return true;
  }
  if (isPointInRect(mouse.x, mouse.y, L.treeBtnX, L.btnY, L.btnW, L.btnH)) {
    const f = inspectedFluffy;
    inspectedFluffy = null;
    openFamilyTree(f.id); // FamilyTree.js
    return true;
  }
  if (isPointInRect(mouse.x, mouse.y, L.closeBtnX, L.btnY, L.btnW, L.btnH)) {
    inspectedFluffy = null;
    return true;
  }

  // Absorb clicks on the modal background
  if (isPointInRect(mouse.x, mouse.y, L.listX, L.listY, L.listW, L.listH)) {
    return true;
  }

  // Clicking outside closes the modal
  inspectedFluffy = null;
  return true;
}

// The mouse wheel over a long column (globals.js)
function handleInspectionScroll(deltaY) {
  if (typeof inspectedFluffy === "undefined" || !inspectedFluffy || !deltaY) return false;
  const c = _inspColRects.find((r) => isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h));
  if (!c) return false;
  const step = deltaY > 0 ? 1 : -1;
  inspectionScroll[c.key] = Math.max(0, Math.min(c.rows - 1, (inspectionScroll[c.key] || 0) + step));
  return true;
}

// Pop-up screen list (Screens.js)
registerScreen({
  name: "inspection", // (pauses the game while you read, like the other screens)
  layer: 5,
  isOpen: () => typeof inspectedFluffy !== "undefined" && inspectedFluffy !== null,
  close: () => (inspectedFluffy = null),
  draw: (c) => drawInspectionModal(c),
  click: () => handleInspectionModalClick(),
});
