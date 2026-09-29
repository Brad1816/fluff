// ---------------------------------------------------------------------------
// The magnifying glass panel (getFluffyInspectionInfo, drawInspectionModal)
// and renaming a fluffy. Split out of UI.js.
// ---------------------------------------------------------------------------

function openNameModal(fluffy) {
  let newName = prompt("Enter new name:", fluffyNames[fluffy.id] || "");
  if (newName !== null) {
    let name = newName.trim().replace(/[^a-zA-Z0-9-]/g, "");
    if (name.length > 0) {
      name = name.charAt(0).toUpperCase() + name.slice(1);
      const first = !fluffyNames[fluffy.id];
      fluffyNames[fluffy.id] = name;
      if (first && typeof giveAffection === "function") giveAffection(fluffy, "named");
      const key = fluffy.tooYoungToSpeak() ? ["NAME", "CHIRPY"] : ["NAME"];
      fluffy.speak(getDialogue(key, fluffy));
    }
  }
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

// calculateColorismPerception() is how far the coat is from the "poopie"
// colours (POOPIE_ANCHORS in globals.js: poopie brown, drab green).
// 0 = poopie coloured, 1 = nowhere near.
function describeInspectionCoat(f) {
  const colorName = f.getColorName ? f.getColorName() : "?";
  const p = f.genetics ? f.genetics.calculateColorismPerception() : 1;
  if (p < 0.5) return [`${colorName} - poopie colours!`, "bad"];
  if (p < 0.9) return [`${colorName} - a bit drab`, "ok"];
  return [`${colorName} - nice colours`, "good"];
}

// coloristDegree: how harshly this fluffy judges poopie-coloured fluffies
// (mums may reject foals, special friend offers may be refused).
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
  if (f.isSensitive && f.isSensitive()) bad.push("sensitive baby");
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
  // Inherited personality traits (Traits.js)
  if (typeof describeTraits === "function") {
    about.push({ label: "Traits", value: describeTraits(f) });
  }
  about.push({ label: "Mother", value: nameOf(f.motherId, "Unnamed fluffy") });
  about.push({ label: "Father", value: nameOf(f.fatherId, "Unnamed fluffy") });
  about.push({
    label: "Special friend",
    value: sfId ? nameOf(sfId, "Fluffy") : "None",
  });
  about.push({ label: "Friends", value: String(friendCount) });
  // Which herd it's in (Herds.js)
  if (f.isAlive && typeof describeHerd === "function") {
    about.push({ label: "Herd", value: describeHerd(f) });
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
  // A fancy mane (ManePatterns.js)
  const fancyMane = typeof describeManePattern === "function" ? describeManePattern(f) : null;
  if (fancyMane) care.push({ label: "Mane", value: fancyMane, tone: "good" });
  if (typeof worldSettings === "undefined" || worldSettings.colorism) {
    const [cText, cTone] = describeInspectionColorism(f);
    care.push({ label: "Colour views", value: cText, tone: cTone });
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
    if (!f.canBeSold || !f.canBeSold()) sellText = "Can't be sold";
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

const INSPECTION_TABS = [
  {
    id: "overview",
    name: "Overview",
    cols: [
      { title: "Wellbeing", rows: ["Happiness", "Hunger", "Health", "Sleep", "Boredom", "Cleanliness", "Warmth", "Pregnant", "Spayed"] },
      { title: "Care", rows: ["Cause of death", "Last desire", "Diet", "Weight", "Litter trained", "Conditions", "Missing parts", "Settling in", "Sells for"] },
    ],
  },
  {
    id: "family",
    name: "Family & friends",
    cols: [
      { title: "Family", rows: ["Mother", "Father", "Born", "Named by", "Herd"] },
      { title: "Friends", rows: ["Special friend", "Friends", "Buddies", "Grudges", "Misses"] },
    ],
  },
  {
    id: "looks",
    name: "Looks & nature",
    cols: [
      { title: "Looks", rows: ["Gender", "Type", "Age", "Coat", "Mane", "Ribbons"] },
      { title: "Nature", rows: ["Personality", "Traits", "Favourite food", "Favourite toy", "Bath time", "Sexuality", "Colour views"] },
    ],
  },
  {
    id: "mind",
    name: "Mind",
    cols: [
      { title: "You and it", rows: ["Affection", "Tricks", "Remembers", "Old owner"] },
      { title: "Worries", rows: ["Trauma", "Alicorns"] },
    ],
  },
];
let inspectionTab = "overview";

// { tabs: [{ id, name, cols: [{ title, rows }], bad }], warnings, rows }
function getInspectionTabs(f) {
  const info = getFluffyInspectionInfo(f);
  const all = [...info.about, ...info.care];
  const byLabel = {};
  for (const r of all) byLabel[r.label] = r;
  const used = new Set(["Name"]);
  const tabs = INSPECTION_TABS.map((t) => ({
    id: t.id,
    name: t.name,
    cols: t.cols.map((c) => ({
      title: c.title,
      rows: c.rows.filter((l) => byLabel[l]).map((l) => (used.add(l), byLabel[l])),
    })),
  }));
  // Anything new that isn't sorted into a tab yet: Overview
  const extra = all.filter((r) => !used.has(r.label));
  if (extra.length) tabs[0].cols[1].rows.push(...extra);
  for (const t of tabs) t.bad = t.cols.some((c) => c.rows.some((r) => r.tone === "bad"));
  // Warnings for the header: the worst things, from any tab
  const warn = [];
  const short = { Affection: null, Conditions: null, "Missing parts": "Missing", "Cause of death": null, Grudges: null };
  // Things about its nature, not its needs: they stay red in their tab but don't shout in the header
  const notUrgent = new Set(["Grudges", "Cause of death", "Litter trained", "Colour views"]);
  for (const r of all) {
    if (r.tone !== "bad" || notUrgent.has(r.label)) continue;
    const label = r.label in short ? short[r.label] : r.label;
    const value = String(r.value).replace(/[♥❥♡]/g, "").trim(); // no hearts in a chip
    warn.push(label ? `${label}: ${value}` : value);
  }
  return { tabs, warnings: warn, rows: byLabel };
}

function getInspectionModalLayout() {
  const listW = Math.min(860, width - 40);
  const listH = Math.min(600, height - 30);
  const listX = width / 2 - listW / 2;
  const listY = height / 2 - listH / 2;
  const btnW = 170;
  const btnH = 40;
  const tabY = listY + 138;
  const tabW = (listW - 40 - 3 * 8) / 4;
  return {
    listX,
    listY,
    listW,
    listH,
    btnW,
    btnH,
    nameBtnX: listX + 20,
    treeBtnX: listX + listW / 2 - btnW / 2,
    closeBtnX: listX + listW - btnW - 20,
    btnY: listY + listH - 60,
    tabs: INSPECTION_TABS.map((t, i) => ({ id: t.id, x: listX + 20 + i * (tabW + 8), y: tabY, w: tabW, h: 34 })),
    contentY: tabY + 70,
  };
}

function drawInspectionColumn(ctx, title, rows, x, y, colW, maxY = Infinity) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 17px Arial";
  ctx.fillStyle = "#ffd6f0";
  ctx.fillText(title, x, y);
  y += 28;
  if (!rows.length) {
    ctx.font = "italic 14px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("Nothing to show", x, y);
    return;
  }
  const labelW = 132;
  const lineSpacing = 20;
  for (const row of rows) {
    if (y > maxY) break;
    ctx.font = "14px Arial";
    ctx.fillStyle = "#b8b8c8";
    ctx.fillText(row.label, x, y);
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = INSPECTION_TONE_COLORS[row.tone] || "white";
    const wrapped = typeof wrapText === "function" ? wrapText(ctx, String(row.value), colW - labelW) : [String(row.value)];
    for (const sub of wrapped) {
      ctx.fillText(sub, x + labelW, y);
      y += lineSpacing;
    }
    y += 5;
  }
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
  ctx.fillText(t, x + 8, y + 12);
  ctx.textBaseline = "alphabetic";
  return w;
}

function drawInspectionModal(ctx) {
  if (!inspectedFluffy) return;
  // Screen pass only (speech bubbles would show through otherwise)
  if (ctx.canvas !== canvas) return;
  const f = inspectedFluffy;
  const L = getInspectionModalLayout();
  const data = getInspectionTabs(f);
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
  if (typeof f.drawPortrait === "function") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, 104, 104);
    ctx.clip();
    try {
      f.drawPortrait(ctx, px + 46, py + 62, 81);
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
  const maxX = L.listX + L.listW - 24;
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
    ctx.font = on ? "bold 15px Arial" : "15px Arial";
    ctx.fillStyle = on ? "white" : "#d8d0e8";
    ctx.fillText(tab.name, t.x + t.w / 2, t.y + t.h / 2 + 1);
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

  // The tab's two columns
  const tab = data.tabs.find((x) => x.id === inspectionTab) || data.tabs[0];
  const colW = (L.listW - 60) / 2;
  const maxY = L.btnY - 14;
  tab.cols.forEach((col, i) => {
    drawInspectionColumn(ctx, col.title, col.rows, L.listX + 25 + i * (colW + 20), L.contentY, colW - 10, maxY);
  });

  if (typeof drawGlassButton !== "undefined") {
    drawGlassButton(L.nameBtnX, L.btnY, L.btnW, L.btnH, "Change name");
    drawGlassButton(L.treeBtnX, L.btnY, L.btnW, L.btnH, "Family tree");
    drawGlassButton(L.closeBtnX, L.btnY, L.btnW, L.btnH, "Close");
  }
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

  if (isPointInRect(mouse.x, mouse.y, L.nameBtnX, L.btnY, L.btnW, L.btnH)) {
    const f = inspectedFluffy;
    inspectedFluffy = null;
    openNameModal(f);
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

// Pop-up screen list (Screens.js)
registerScreen({
  name: "inspection",
  layer: 5,
  isOpen: () => typeof inspectedFluffy !== "undefined" && inspectedFluffy !== null,
  close: () => (inspectedFluffy = null),
  draw: (c) => drawInspectionModal(c),
  click: () => handleInspectionModalClick(),
});
