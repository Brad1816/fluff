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
      fluffyNames[fluffy.id] = name;
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
  if (typeof worldSettings === "undefined" || worldSettings.colorism) {
    const [cText, cTone] = describeInspectionColorism(f);
    care.push({ label: "Colour views", value: cText, tone: cTone });
  }
  if (f.gender === "female") {
    care.push({ label: "Spayed", value: f.spayed ? "Yes" : "No" });
    if (f.isAlive) {
      care.push({ label: "Pregnant", value: f.isPregnant ? "Yes" : "No", tone: f.isPregnant ? "ok" : "" });
    }
  }
  // How it feels about you and what it remembers (Memory.js)
  if (f.isAlive && typeof describePlayerFeeling === "function") {
    const [feel, feelTone] = describePlayerFeeling(f);
    care.push({ label: "Feels about you", value: feel, tone: feelTone });
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

function getInspectionModalLayout() {
  const listW = Math.min(820, width - 40);
  const listH = 560;
  const listX = width / 2 - listW / 2;
  const listY = height / 2 - listH / 2;
  const btnW = 170;
  const btnH = 40;
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
  };
}

function drawInspectionColumn(ctx, title, rows, x, y, colW) {
  ctx.textAlign = "left";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "black";

  ctx.font = "bold 20px Arial";
  ctx.fillStyle = "#ffd6f0";
  ctx.strokeText(title, x, y);
  ctx.fillText(title, x, y);
  y += 30;

  const labelW = 130;
  const lineSpacing = 21;
  for (const row of rows) {
    ctx.font = "bold 15px Arial";
    ctx.fillStyle = "#cfcfcf";
    ctx.strokeText(row.label, x, y);
    ctx.fillText(row.label, x, y);

    ctx.font = "bold 15px Arial";
    ctx.fillStyle = INSPECTION_TONE_COLORS[row.tone] || "white";
    const wrapped =
      typeof wrapText === "function"
        ? wrapText(ctx, String(row.value), colW - labelW)
        : [String(row.value)];
    for (const sub of wrapped) {
      ctx.strokeText(sub, x + labelW, y);
      ctx.fillText(sub, x + labelW, y);
      y += lineSpacing;
    }
    y += 3;
  }
}

function drawInspectionModal(ctx) {
  if (!inspectedFluffy) return;
  // drawUI runs twice a frame: into the world buffer (speech bubbles are
  // drawn on top of that afterwards) and then on the screen. Only draw on
  // the screen pass, or bubbles show through the window.
  if (ctx.canvas !== canvas) return;

  // Draw semi-transparent background over everything
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, width, height);

  const L = getInspectionModalLayout();

  // Glass styling via UI's standard
  if (typeof drawGlassButton !== "undefined") {
    drawGlassButton(L.listX, L.listY, L.listW, L.listH, "", {
      forceNormal: true,
      borderRadius: 12,
      normalFill: "rgb(20, 10, 25)",
      hoverFill: "rgba(255, 255, 255, 0.75)",
    });
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(L.listX, L.listY, L.listW, L.listH);
  }

  const titleText = "Fluffy Inspection";
  ctx.fillStyle = "white";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "black";
  ctx.strokeText(titleText, width / 2, L.listY + 38);
  ctx.fillText(titleText, width / 2, L.listY + 38);

  const info = getFluffyInspectionInfo(inspectedFluffy);
  const colW = (L.listW - 60) / 2;
  const colY = L.listY + 80;
  drawInspectionColumn(ctx, "About", info.about, L.listX + 25, colY, colW - 10);
  drawInspectionColumn(
    ctx,
    inspectedFluffy.isAlive ? "Health & care" : "Remains",
    info.care,
    L.listX + 35 + colW,
    colY,
    colW - 10,
  );

  if (typeof drawGlassButton !== "undefined") {
    drawGlassButton(L.nameBtnX, L.btnY, L.btnW, L.btnH, "Change name");
    drawGlassButton(L.treeBtnX, L.btnY, L.btnW, L.btnH, "Family tree");
    drawGlassButton(L.closeBtnX, L.btnY, L.btnW, L.btnH, "Close");
  }
}

function handleInspectionModalClick() {
  if (!inspectedFluffy) return false;

  const L = getInspectionModalLayout();

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
