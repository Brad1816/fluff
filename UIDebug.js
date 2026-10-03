// ---------------------------------------------------------------------------
// Debug mode: debug actions on fluffies, the watcher panel and the debug
// menu. Split out of UI.js.
// ---------------------------------------------------------------------------

function applyImmediateDebugAction(action) {
  switch (action) {
    case "clean_all":
      for (const puddle of puddles) {
        puddle.clear();
      }
      gibs.length = 0;
      for (const f of fluffies) {
        if (!f.isAlive) f.isDestroyed = true;
      }
      addDebugMessage("All waste, gibs, and corpses cleared.");
      break;
  }
}

function applyDebugAction(f) {
  if (debugMenuAction && debugMenuAction !== "watch") {
    debugActionHistory[f.id] = debugMenuAction;
  }
  switch (debugMenuAction) {
    case "hungry":
      f.hunger = 0.1;
      debugMenuAction = null;
      break;
    case "breed":
      if (f.growth < 1.0) {
        addUIMessage("Select an adult fluffy!");
      } else if (f.gender === "female") {
        f.isPregnant = true;
        f.pregnancyTimer = pregnancyDuration * 0.1;
        f.babiesToBirth = Math.floor(Math.random() * 7) + 1;
        f.fatherGenes = [...f.genes];
        f.foalViability = Array(f.babiesToBirth).fill(true);
        f.lactatingTimer = 900;
        f.milkCharges = 5;
        debugMenuAction = null;
      } else {
        f.specialHuggiesCooldown = 0;
        debugMenuAction = null;
      }
      break;
    case "wan_die":
      f.happiness = WAN_DIE_THRESHOLD;
      debugMenuAction = null;
      break;
    case "neutral":
      f.happiness = 0.6;
      f.hunger = 0.7;
      f.poopStorage = 0;
      f.peeStorage = 0;
      f.sleepDeprivation = 0;
      f.cannibalismAcceptance = 0;
      f.isFrantic = false;
      f.isScared = false;
      f.traumaMemory = [];
      f.fearedFluffies = [];
      f.counterattack = { fluffy: null, timer: 0 };
      f.expressionOverride = null;
      f.expressionOverrideTimer = 0;
      f.speech.text = null;
      f.speech.timer = 0;
      f.isPregnant = false;
      f.pregnancyTimer = 0;
      f.pregnancyTorsoStretch = 0;
      f.babiesToBirth = 0;
      f.fatherGenes = null;
      f.foalViability = [];
      f.lactatingTimer = 0;
      f.milkCharges = 0;
      debugMenuAction = null;
      break;
    case "forget":
      for (const id in f.perceivedRelationships) {
        if (f.perceivedRelationships[id].state === "lost") {
          f.perceivedRelationships[id].state = "forgotten";
          f.perceivedRelationships[id].timer = 999;
        }
      }
      f.traumaMemory = [];
      f.fearedFluffies = [];
      f.isFrantic = false;
      f.isScared = false;
      f.counterattack = { fluffy: null, timer: 0 };
      f.speech.text = null;
      f.speech.timer = 0;
      addDebugMessage("Fluffy forgot grief, fears, and trauma.");
      debugMenuAction = null;
      break;
    case "cannibal":
      f.cannibalismAcceptance = 1.0;
      f.hunger = 0.2;
      debugMenuAction = null;
      break;
    case "bathroom":
      // 0.65: above the litterbox-seek threshold (0.4 at max training)
      // but below the emergency excretion threshold (0.8 at max training)
      f.poopStorage = 0.65;
      f.peeStorage = 0.65;
      // Open the stick-training window (normally set only by floor excretion)
      f.badPoopieTimer = 3.0;
      f.trainedForThisOccurrence = false;
      debugMenuAction = null;
      break;
    case "smarty":
      if (f.isSmarty()) {
        f.personalities = f.personalities.filter((p) => p !== "smarty");
      } else {
        f.personalities = [...f.personalities, "smarty"];
      }
      debugMenuAction = null;
      break;
    case "alicorn":
      f.alicornTolerance = !f.alicornTolerance;
      debugMenuAction = null;
      break;
    case "sleeping":
      f.sleepDeprivation = 1.0;
      debugMenuAction = null;
      break;
    case "watch":
      debugWatchedFluffyId = f.id;
      debugMenuAction = null;
      break;
    case "pair":
      if (!debugPairFirst) {
        debugPairFirst = f.id;
      } else {
        if (debugPairFirst === f.id) {
          addDebugMessage("Select a different fluffy!");
          return;
        }
        const f1 = fluffyById(debugPairFirst);
        if (f1 && f1 !== f) {
          relationships[f1.id][f.id] = "special_friend";
          relationships[f.id][f1.id] = "special_friend";
          const name1 = fluffyNames[f1.id] || "Fluffy";
          const name2 = fluffyNames[f.id] || "Fluffy";
          addDebugMessage(`${name1} and ${name2} are now paired`);
        }
        debugMenuAction = null;
        debugPairFirst = null;
      }
      break;
    case "revive":
      if (f.isAlive) {
        return;
      }
      f.isAlive = true;
      f.health = 100;
      f.deathAnim = 0;
      f.deathSnapshot = null;
      f.deathTimer = 0;
      f.causeOfDeath = null;
      f.deathWeapon = null;
      f.bleedingTimer = 0;
      f.continuousTasedTimer = 0;
      f.continuousTasedSmokeTimer = 0;
      f.expressionOverride = null;
      f.expressionOverrideTimer = 0;
      f.speech.text = null;
      f.speech.timer = 0;
      f.chaseTarget = null;
      f.cannibalTarget = null;
      f.counterattack = { fluffy: null, timer: 0 };
      if (f.hunger <= 0.1) f.hunger = 0.7;
      if (f.happiness <= WAN_DIE_THRESHOLD) f.happiness = 0.6;
      f.currentStateKey = "IDLE";
      if (typeof f.updateCrawling === "function") f.updateCrawling();
      if (typeof f.updateLayout === "function") f.updateLayout();
      debugMenuAction = null;
      break;
  }
}

const DEBUG_WATCHER_W = 255;
const DEBUG_WATCHER_HEADER_H = 30; // matches toggleBtnH
const DEBUG_WATCHER_NAME_H = 22; // dedicated name row
const DEBUG_WATCHER_ROW_H = 18; // matches visual weight of menu buttons
const DEBUG_WATCHER_STAT_ROWS = 8;
const DEBUG_WATCHER_INFO_ROWS = 12;
const DEBUG_WATCHER_H =
  DEBUG_WATCHER_HEADER_H +
  DEBUG_WATCHER_NAME_H +
  DEBUG_WATCHER_STAT_ROWS * DEBUG_WATCHER_ROW_H +
  DEBUG_WATCHER_INFO_ROWS * DEBUG_WATCHER_ROW_H +
  8;

function debugWatcherHitTest() {
  if (!debugWatchedFluffyId) return false;
  return isPointInRect(
    mouse.x,
    mouse.y,
    debugWatcherPos.x,
    debugWatcherPos.y,
    DEBUG_WATCHER_W,
    DEBUG_WATCHER_H,
  );
}

function handleDebugWatcherMousedown() {
  if (!debugWatchedFluffyId) return false;
  const px = debugWatcherPos.x,
    py = debugWatcherPos.y;

  // Close button (matches draw: closeX = px + W - 28, closeY = py + 4, size 22)
  if (
    isPointInRect(mouse.x, mouse.y, px + DEBUG_WATCHER_W - 28, py + 4, 22, 22)
  ) {
    debugWatchedFluffyId = null;
    return true;
  }
  // Header drag
  if (
    isPointInRect(
      mouse.x,
      mouse.y,
      px,
      py,
      DEBUG_WATCHER_W,
      DEBUG_WATCHER_HEADER_H,
    )
  ) {
    debugWatcherDragging = true;
    debugWatcherDragOffset.x = mouse.x - px;
    debugWatcherDragOffset.y = mouse.y - py;
    return true;
  }
  // Consume any click on the panel body
  if (debugWatcherHitTest()) return true;
  return false;
}

function drawDebugWatcher() {
  // Update drag
  if (debugWatcherDragging) {
    if (mouse.down) {
      debugWatcherPos.x = clamp(
        mouse.x - debugWatcherDragOffset.x,
        0,
        width - DEBUG_WATCHER_W,
      );
      debugWatcherPos.y = clamp(
        mouse.y - debugWatcherDragOffset.y,
        0,
        height - DEBUG_WATCHER_H,
      );
    } else {
      debugWatcherDragging = false;
    }
  }

  if (debugWatchedFluffyId === null || debugWatchedFluffyId === undefined)
    return;
  const f = fluffyById(debugWatchedFluffyId);
  if (!f) {
    debugWatchedFluffyId = null;
    return;
  }

  const px = debugWatcherPos.x,
    py = debugWatcherPos.y;
  const W = DEBUG_WATCHER_W;

  // Panel background — same fill as debug buttons
  ctx.fillStyle = "#555";
  ctx.fillRect(px, py, W, DEBUG_WATCHER_H);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, W, DEBUG_WATCHER_H);

  // Header row — "Watch" label + close button, matches toggle button style
  ctx.fillStyle = "white";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Watch", px + W / 2, py + DEBUG_WATCHER_HEADER_H / 2);

  // Close button — same button style as debug actions
  const closeX = px + W - 28,
    closeY = py + 4,
    closeS = 22;
  ctx.fillStyle = "#555";
  ctx.fillRect(closeX, closeY, closeS, closeS);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 1;
  ctx.strokeRect(closeX, closeY, closeS, closeS);
  ctx.fillStyle = "white";
  ctx.font = "10px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("×", closeX + closeS / 2, closeY + closeS / 2);

  // Name row — white stroke separator above, fluffy name bold and centered
  const nameY = py + DEBUG_WATCHER_HEADER_H;
  ctx.strokeStyle = "white";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, nameY);
  ctx.lineTo(px + W, nameY);
  ctx.stroke();
  const watchName = fluffyNames[f.id] || "Fluffy";
  ctx.fillStyle = "white";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(watchName, px + W / 2, nameY + 15);

  // Stat rows — start below name row
  const statRows = [
    { label: "Happiness", value: f.happiness, color: "#e74c3c" },
    { label: "Hunger", value: f.hunger, color: "#e67e22" },
    {
      label: "Health",
      value: f.health / 100,
      color: "#2ecc71",
      text: Math.round(f.health) + "/100",
    },
    { label: "Sleep Dep", value: f.sleepDeprivation, color: "#9b59b6" },
    { label: "Poop", value: f.poopStorage, color: "#795548" },
    { label: "Pee", value: f.peeStorage, color: "#f1c40f" },
    { label: "Potty Trn", value: f.pottyTraining, color: "#27ae60" },
    { label: "Colorism", value: f.coloristDegree, color: "#e74c3c" },
  ];
  const statsY = nameY + DEBUG_WATCHER_NAME_H;
  const barX = px + 70;
  const barW = W - 76 - 36;
  statRows.forEach(({ label, value, color, text }, i) => {
    const ry = statsY + i * DEBUG_WATCHER_ROW_H;
    // Row separator
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, ry);
    ctx.lineTo(px + W, ry);
    ctx.stroke();
    // Label
    ctx.font = "10px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "white";
    ctx.fillText(label, px + 5, ry + 13);
    // Bar background
    ctx.fillStyle = "#333";
    ctx.fillRect(barX, ry + 4, barW, 10);
    // Bar fill
    ctx.fillStyle = color;
    ctx.fillRect(barX, ry + 4, barW * clamp(value, 0, 1), 10);
    // Value
    ctx.textAlign = "right";
    ctx.fillStyle = "white";
    ctx.fillText(text ?? value.toFixed(2), px + W - 4, ry + 13);
  });

  // Info rows (state, frantic, last debug)
  const infoY = statsY + DEBUG_WATCHER_STAT_ROWS * DEBUG_WATCHER_ROW_H;
  ctx.strokeStyle = "white";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, infoY);
  ctx.lineTo(px + W, infoY);
  ctx.stroke();

  const breedLabel = f.gender === "female" ? "Pregnancy" : "Breed";
  let breedValue, breedColor;
  if (f.gender === "female") {
    if (f.isPregnant) {
      const pct = Math.round((1 - f.pregnancyTimer / pregnancyDuration) * 100);
      breedValue = `${f.babiesToBirth} bab${f.babiesToBirth === 1 ? "y" : "ies"} (${pct}%)`;
      breedColor = "#f39c12";
    } else {
      breedValue = "none";
      breedColor = "white";
    }
  } else {
    if (f.specialHuggiesCooldown > 0) {
      breedValue = `cd: ${f.specialHuggiesCooldown.toFixed(1)}s`;
      breedColor = "#e74c3c";
    } else {
      breedValue = "ready";
      breedColor = "#2ecc71";
    }
  }
  const lactatSecs = Math.ceil(f.lactatingTimer || 0);
  const lactatValue =
    f.gender === "female"
      ? lactatSecs > 0
        ? `${lactatSecs}s`
        : "none"
      : "N/A";
  const lactatColor =
    lactatSecs > 0 ? "#3498db" : f.gender === "female" ? "#e74c3c" : "#888";
  const milkValue = f.gender === "female" ? `${f.milkCharges || 0}/5` : "N/A";
  const milkColor =
    f.gender === "female"
      ? (f.milkCharges || 0) > 0
        ? "#2ecc71"
        : "#e74c3c"
      : "#888";

  const sfId = Object.keys(relationships[f.id] || {}).find(
    (id) => relationships[f.id][id] === "special_friend",
  );
  const sfName = sfId ? fluffyNames[sfId] || `#${sfId}` : "none";
  const sfColor = sfId ? "#ff69b4" : "#888";

  const lastDesireObj =
    f.lastDesire || (f.brain ? f.brain.evaluateLastDesire() : null);
  const desireName = lastDesireObj
    ? lastDesireObj.desire || lastDesireObj.name || "None"
    : "None";
  const desireMagVal =
    lastDesireObj && lastDesireObj.value !== undefined
      ? lastDesireObj.value
      : lastDesireObj && lastDesireObj.score !== undefined
        ? lastDesireObj.score
        : 0;
  const desireMagStr = desireMagVal > 0 ? desireMagVal.toFixed(1) : "0.0";

  const infoRows = [
    { label: "State", value: f.currentStateKey, valueColor: "white" },
    { label: "Last Desire", value: desireName, valueColor: "#f39c12" },
    { label: "Desire Mag", value: desireMagStr, valueColor: "#f39c12" },
    {
      label: "Frantic",
      value: f.isFrantic ? "yes" : "no",
      valueColor: f.isFrantic ? "#e74c3c" : "#2ecc71",
    },
    {
      label: "Scared",
      value: f.isScared ? "yes" : "no",
      valueColor: f.isScared ? "#e74c3c" : "#2ecc71",
    },
    { label: breedLabel, value: breedValue, valueColor: breedColor },
    { label: "Lactation", value: lactatValue, valueColor: lactatColor },
    { label: "Milk", value: milkValue, valueColor: milkColor },
    { label: "Sp. Friend", value: sfName, valueColor: sfColor },
    {
      label: "Alicorn Tolerant",
      value: f.tolerantOfAlicorns() || f.alicornTolerance ? "yes" : "no",
      valueColor:
        f.tolerantOfAlicorns() || f.alicornTolerance ? "#2ecc71" : "#e74c3c",
    },
    {
      label: "Sensitive Baby",
      value: f.sensitiveBaby ? "yes" : "no",
      valueColor: f.sensitiveBaby ? "#e74c3c" : "#2ecc71",
    },
    {
      label: "Last debug",
      value: debugActionHistory[f.id] || "—",
      valueColor: "gold",
    },
  ];

  infoRows.forEach(({ label, value, valueColor }, i) => {
    const ry = infoY + i * DEBUG_WATCHER_ROW_H;
    if (i > 0) {
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, ry);
      ctx.lineTo(px + W, ry);
      ctx.stroke();
    }
    ctx.font = "10px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "white";
    ctx.fillText(label, px + 5, ry + 13);
    ctx.textAlign = "right";
    ctx.fillStyle = valueColor;
    ctx.fillText(value, px + W - 4, ry + 13);
  });
}

function _debugMenuLayout() {
  const btnSize = 40;
  const btnPadding = 5;
  const cols = 5;
  const toggleBtnW = 80;
  const toggleBtnH = 30;
  const toggleBtnY = 60;
  const startX = width - cols * (btnSize + btnPadding) + btnPadding - 10;
  const toggleBtnX = width - toggleBtnW - 10;
  const startY = toggleBtnY + toggleBtnH + btnPadding;
  return {
    btnSize,
    btnPadding,
    cols,
    toggleBtnW,
    toggleBtnH,
    toggleBtnX,
    toggleBtnY,
    startX,
    startY,
  };
}

function drawDebugMenu() {
  if (!showDebugMenu) return;
  const {
    btnSize,
    btnPadding,
    cols,
    toggleBtnW,
    toggleBtnH,
    toggleBtnX,
    toggleBtnY,
    startX,
    startY,
  } = _debugMenuLayout();

  // Toggle button
  ctx.fillStyle = "#555";
  ctx.fillRect(toggleBtnX, toggleBtnY, toggleBtnW, toggleBtnH);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 1;
  ctx.strokeRect(toggleBtnX, toggleBtnY, toggleBtnW, toggleBtnH);
  ctx.fillStyle = "white";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "Debug",
    toggleBtnX + toggleBtnW / 2,
    toggleBtnY + toggleBtnH / 2,
  );

  let hoveredAction = null;

  DEBUG_ACTIONS.forEach((action, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const bx = startX + col * (btnSize + btnPadding);
    const by = startY + row * (btnSize + btnPadding);

    const isActive = debugMenuAction === action.action;
    ctx.fillStyle = "#555";
    ctx.fillRect(bx, by, btnSize, btnSize);
    ctx.strokeStyle = isActive ? "gold" : "white";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, btnSize, btnSize);

    ctx.fillStyle = isActive ? "gold" : "white";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let name = action.name;
    if (name.length > 7) name = name.substring(0, 6) + ".";
    ctx.fillText(name, bx + btnSize / 2, by + btnSize / 2);

    if (isPointInRect(mouse.x, mouse.y, bx, by, btnSize, btnSize))
      hoveredAction = action;
  });

  // Debug messages — stacked above, right-aligned, to the left of the button grid
  if (debugMessages.length > 0) {
    ctx.save();
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "right";
    const msgX = startX - 12;
    debugMessages.forEach((msg, i) => {
      const msgY = startY + i * 22;
      ctx.globalAlpha = msg.opacity;
      ctx.fillStyle = "black";
      ctx.fillText(msg.text, msgX + 2, msgY + 2);
      ctx.fillStyle = "white";
      ctx.fillText(msg.text, msgX, msgY);
    });
    ctx.restore();
  }

  if (hoveredAction) {
    ctx.font = "bold 12px Arial";
    const padding = 10;
    const maxTextWidth = 250;
    const lines = wrapText(ctx, hoveredAction.desc, maxTextWidth);

    let descWidth = 0;
    lines.forEach((line) => {
      descWidth = Math.max(descWidth, ctx.measureText(line).width);
    });

    const lineHeight = 16;
    const tw = descWidth + padding * 2;
    const th = lines.length * lineHeight + padding * 2;
    const tx = clamp(mouse.x + 10, 0, width - tw - 10);
    const ty = clamp(mouse.y + 10, 0, height - th - 10);

    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(tx, ty, tw, th);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.strokeRect(tx, ty, tw, th);

    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    lines.forEach((line, i) =>
      ctx.fillText(line, tx + padding, ty + 20 + i * lineHeight),
    );
  }
}

function debugMenuClick() {
  if (!showDebugMenu) return false;
  const {
    btnSize,
    btnPadding,
    cols,
    toggleBtnW,
    toggleBtnH,
    toggleBtnX,
    toggleBtnY,
    startX,
    startY,
  } = _debugMenuLayout();

  if (
    isPointInRect(
      mouse.x,
      mouse.y,
      toggleBtnX,
      toggleBtnY,
      toggleBtnW,
      toggleBtnH,
    )
  ) {
    showDebugMenu = false;
    debugMenuAction = null;
    debugPairFirst = null;
    return true;
  }

  for (let i = 0; i < DEBUG_ACTIONS.length; i++) {
    const action = DEBUG_ACTIONS[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const bx = startX + col * (btnSize + btnPadding);
    const by = startY + row * (btnSize + btnPadding);

    if (isPointInRect(mouse.x, mouse.y, bx, by, btnSize, btnSize)) {
      if (action.immediate) {
        applyImmediateDebugAction(action.action);
        return true;
      }
      if (debugMenuAction === action.action) {
        debugMenuAction = null;
        debugPairFirst = null;
      } else {
        debugMenuAction = action.action;
        debugPairFirst = null;
      }
      return true;
    }
  }

  return false;
}
