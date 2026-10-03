function drawGlassButton(x, y, w, h, text, options = {}) {
  const {
    fontSize = 24,
    borderRadius = 12,
    disabled = false,
    textColor,
    forceNormal = false,
    normalFill = "rgba(0, 0, 0, 0.1)",
    hoverFill = "rgba(255, 255, 255, 0.2)",
    borderColor,
    textOffsetY = 0,
    ctx: c = ctx, // (another canvas to draw on: UIPanels.drawPanelButton passes one)
  } = options;

  const isHovered =
    !disabled &&
    !forceNormal &&
    typeof mouse !== "undefined" &&
    mouse.x >= x &&
    mouse.x <= x + w &&
    mouse.y >= y &&
    mouse.y <= y + h;

  c.save();

  // No backdrop blur requested.

  // 2) Translucent background
  if (disabled) {
    c.fillStyle = "rgba(0, 0, 0, 0.7)";
  } else {
    c.fillStyle = isHovered ? hoverFill : normalFill;
  }

  c.beginPath();
  if (c.roundRect) {
    c.roundRect(x, y, w, h, borderRadius);
  } else {
    c.rect(x, y, w, h);
  }
  c.fill();

  c.strokeStyle =
    borderColor ||
    (isHovered
      ? "rgba(255, 255, 255, 0.9)"
      : disabled
        ? "rgba(255, 255, 255, 0.2)"
        : "rgba(255, 255, 255, 0.5)");
  c.lineWidth = 2;
  c.stroke();

  // Text (most toolbar slots have none: skip the font work)
  if (text === "" || text === null || text === undefined) {
    c.restore();
    return;
  }
  c.fillStyle = disabled ? "rgba(255, 255, 255, 0.4)" : textColor || "white";
  c.font = `bold ${fontSize}px Arial`;
  c.textAlign = "center";
  c.textBaseline = "middle";

  // Text outline
  c.lineWidth = 2;
  c.lineJoin = "round";
  c.strokeStyle = disabled ? "rgba(0, 0, 0, 0.4)" : "black";
  c.strokeText(text, x + w / 2, y + h / 2 + textOffsetY);

  c.fillText(text, x + w / 2, y + h / 2 + textOffsetY);

  c.restore();
}

function drawTitleScreen() {
  // Color Cycling Logic (Pink -> Blue -> Green -> Red)
  // Pink: hsl(330, 70%, 50%)
  // Blue: hsl(210, 70%, 50%)
  // Green: hsl(120, 70%, 50%)
  // Red: hsl(0, 70%, 50%)
  const cycleDuration = 24; // Seconds for full cycle
  const cycleT = (titleBGTimer % cycleDuration) / cycleDuration;

  // Hues: 330 (Pink) -> 210 (Blue) -> 120 (Green) -> 0 (Red)
  let hue;
  if (cycleT < 0.25) {
    // Pink to Blue
    hue = lerp(330, 210, cycleT / 0.25);
  } else if (cycleT < 0.5) {
    // Blue to Green
    hue = lerp(210, 120, (cycleT - 0.25) / 0.25);
  } else if (cycleT < 0.75) {
    // Green to Red
    hue = lerp(120, 0, (cycleT - 0.5) / 0.25);
  } else {
    // Red back to Pink
    // Interpolate towards 330. 0 is also 360.
    hue = lerp(360, 330, (cycleT - 0.75) / 0.25);
  }

  const baseColor = `hsl(${hue}, 40%, 20%)`;
  const checkColor = `hsl(${hue}, 40%, 22%)`;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  // Checkerboard
  const size = 120;
  const scrollSpeed = 30;
  const offset = (titleBGTimer * scrollSpeed) % (size * 2);

  ctx.fillStyle = checkColor;
  for (let y = -size * 2; y < height + size * 2; y += size) {
    for (let x = -size * 2; x < width + size * 2; x += size) {
      if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
        ctx.fillRect(x + offset, y + offset, size, size);
      }
    }
  }

  const titleImg = images[titleImageKey];
  if (titleImg && titleImg.complete) {
    // Stretching Logic
    // Vertical: 12s cycle, +/- 20px
    const vStretch = Math.sin((titleBGTimer * 2 * Math.PI) / 12) * 20;
    // Horizontal: 20s cycle, +/- 20px
    const hStretch = Math.sin((titleBGTimer * 2 * Math.PI) / 20) * 20;

    const dw = titleImg.width + hStretch;
    const dh = titleImg.height + vStretch;

    ctx.drawImage(titleImg, width / 2 - dw / 2, height * 0.3 - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = "white";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Fluffy Industries", width / 2, height * 0.3);
  }

  const btnW = 200;
  const btnH = 60;
  const btnX = width / 2 - btnW / 2;
  const btnY = height * 0.6;

  drawGlassButton(btnX, btnY, btnW, btnH, "New game");

  const loadBtnY = btnY + btnH + 20;
  drawGlassButton(btnX, loadBtnY, btnW, btnH, "Load");

  // Pick up where you left off (Autosave.js)
  const cont = typeof lastSaveInfo === "function" ? lastSaveInfo() : null;
  if (cont) {
    const r = titleContinueRect();
    drawGlassButton(r.x, r.y, r.w, r.h, cont.day ? `Continue (day ${cont.day})` : "Continue", {
      normalFill: "rgba(255, 170, 220, 0.3)",
    });
  }

  // Buy Me a Coffee button (bottom-left)
  const bmacImg = images["bmac"];
  if (bmacImg && bmacImg.complete && bmacImg.naturalWidth > 0) {
    const bmacH = 100;
    const bmacW = bmacImg.width * (bmacH / bmacImg.height);
    const bmacPad = 16;
    const bmacX = bmacPad;
    const bmacY = height - bmacH - bmacPad;

    // Glow on hover
    if (isPointInRect(mouse.x, mouse.y, bmacX, bmacY, bmacW, bmacH)) {
      ctx.save();
      ctx.globalAlpha = 1.0;
      ctx.drawImage(bmacImg, bmacX, bmacY, bmacW, bmacH);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(bmacImg, bmacX, bmacY, bmacW, bmacH);
      ctx.restore();
    }

    // Draw text and arrow
    ctx.save();
    ctx.font = "bold 20px 'Fredoka', 'Comic Sans MS', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const text = "Enjoying the game? Donate or request a new feature!";
    const textX = bmacX + bmacW + 50;
    const textY = bmacY + bmacH / 2;

    // Draw arrow
    ctx.lineWidth = 4;
    ctx.strokeStyle = "black";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    // Arrow line
    ctx.moveTo(textX - 15, textY);
    ctx.lineTo(bmacX + bmacW + 15, textY);
    // Arrowhead
    ctx.lineTo(bmacX + bmacW + 25, textY - 10);
    ctx.moveTo(bmacX + bmacW + 15, textY);
    ctx.lineTo(bmacX + bmacW + 25, textY + 10);
    ctx.stroke();

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw text outline and fill
    ctx.lineWidth = 4;
    ctx.strokeStyle = "black";
    ctx.strokeText(text, textX, textY);
    ctx.fillStyle = "white";
    ctx.fillText(text, textX, textY);
    ctx.restore();
  }
}

function drawPauseMenu() {
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, width, height);

  if (showSaveList) {
    drawSaveList();
    return;
  }

  const btnW = 200;
  const btnH = 60;
  const btnX = width / 2 - btnW / 2;
  const btnYStart = height / 2 - 200;

  // Resume
  drawGlassButton(btnX, btnYStart, btnW, btnH, "Resume");

  // Volume Slider Box
  const sliderY = btnYStart + 80;

  // Handle slider drag
  if (mouse.down && !showSaveList && gameState === "PAUSED") {
    if (
      mouse.x >= btnX + 20 &&
      mouse.x <= btnX + btnW - 20 &&
      mouse.y >= sliderY &&
      mouse.y <= sliderY + btnH
    ) {
      masterVolume = (mouse.x - (btnX + 20)) / (btnW - 40);
      if (masterVolume < 0) masterVolume = 0;
      if (masterVolume > 1) masterVolume = 1;
      try {
        localStorage.setItem("fluffyVolume", String(masterVolume));
      } catch (e) {}
    }
  }

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(btnX, sliderY, btnW, btnH, 12);
  } else {
    ctx.rect(btnX, sliderY, btnW, btnH);
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Volume", width / 2, sliderY + 20);

  // Track
  const trackX = btnX + 20;
  const trackY = sliderY + 40;
  const trackW = btnW - 40;
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(trackX, trackY - 2, trackW, 4, 2);
  } else {
    ctx.rect(trackX, trackY - 2, trackW, 4);
  }
  ctx.fill();

  // Thumb
  const thumbX = trackX + trackW * masterVolume;
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(thumbX, trackY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Mute
  drawGlassButton(
    btnX,
    btnYStart + 160,
    btnW,
    btnH,
    isMuted ? "Unmute" : "Mute",
  );

  // Save
  drawGlassButton(btnX, btnYStart + 240, btnW, btnH, "Save/Load");

  // Title Screen
  drawGlassButton(btnX, btnYStart + 320, btnW, btnH, "Title Screen");

  // What to show: the same switches as the keys (N, H, B) and a phone's ⋯
  for (const t of pauseToggleRects()) drawGlassButton(t.x, t.y, t.w, t.h, t.label());
}

// The pause menu's right-hand column: things otherwise only on a key (or a
// phone's ⋯ menu), as buttons for mouse and finger alike
const PAUSE_TOGGLES = [
  { label: () => `Names: ${showFluffyNames ? "on" : "off"}`, key: "N", run: () => (showFluffyNames = !showFluffyNames) },
  { label: () => `Herds: ${typeof showHerdMarkers !== "undefined" && showHerdMarkers ? "on" : "off"}`, key: "H", run: () => (showHerdMarkers = !showHerdMarkers) },
  { label: () => `Bed names: ${showBedNames ? "on" : "off"}`, key: "B", run: () => (showBedNames = !showBedNames) },
];

function pauseToggleRects() {
  const btnW = 250;
  const btnH = 60;
  const mainX = width / 2 - 100; // (the main column is 200 wide)
  const top = height / 2 - 200;
  // beside the main column, or (on a narrow screen) to its left
  const x = mainX + 200 + 30 + btnW <= width - 8 ? mainX + 230 : Math.max(8, mainX - btnW - 30);
  const touch = typeof touchMode !== "undefined" && touchMode;
  return PAUSE_TOGGLES.map((t, i) => ({ x, y: top + i * 80, w: btnW, h: btnH, run: t.run, label: () => t.label() + (touch || !t.key ? "" : ` (${t.key})`) }));
}

const fluffySexualitySliderSet = new MutuallyExclusiveSliderSet({
  items: [
    {
      id: "heterosexual",
      label: "Heterosexual",
      value: DEFAULT_SEXUALITY.heterosexual,
    },
    { id: "bisexual", label: "Bisexual", value: DEFAULT_SEXUALITY.bisexual },
    {
      id: "homosexual",
      label: "Homosexual",
      value: DEFAULT_SEXUALITY.homosexual,
    },
  ],
  onChange: (vals) => {
    wsPromptSexuality = { ...vals };
  },
});

function drawWorldSettingsPrompt() {
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.fillRect(0, 0, width, height);

  const listW = 560;
  const listH = 500;
  const listX = width / 2 - listW / 2;
  const listY = height / 2 - listH / 2;

  drawGlassButton(listX, listY, listW, listH, "", {
    forceNormal: true,
    borderRadius: 12,
    normalFill: "rgba(0, 0, 0, 0.5)",
    hoverFill: "rgba(255, 255, 255, 0.75)",
  });

  const titleText = "Headcanon";
  ctx.fillStyle = "white";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "black";
  ctx.strokeText(titleText, width / 2, listY + 38);
  ctx.fillText(titleText, width / 2, listY + 38);

  // Checkbox dimensions and column layout
  const checkW = 30;
  const checkH = 30;
  const col1X = listX + 40;
  const col2X = listX + 260;

  // Checkbox Row 1
  const row1Y = listY + 68;

  // Checkbox 1: Colorism
  drawGlassButton(col1X, row1Y, checkW, checkH, wsPromptColorism ? "✓" : "", {
    borderRadius: 6,
  });
  ctx.fillStyle = "white";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "left";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "black";
  ctx.strokeText("Colorism", col1X + 44, row1Y + 22);
  ctx.fillText("Colorism", col1X + 44, row1Y + 22);

  // Checkbox 2: Alicorn intolerance
  drawGlassButton(col2X, row1Y, checkW, checkH, wsPromptAlicorn ? "✓" : "", {
    borderRadius: 6,
  });
  ctx.strokeText("Alicorn intolerance", col2X + 44, row1Y + 22);
  ctx.fillText("Alicorn intolerance", col2X + 44, row1Y + 22);

  // Checkbox Row 2
  const row2Y = listY + 112;

  // Checkbox 3: Smarties
  drawGlassButton(col1X, row2Y, checkW, checkH, wsPromptSmarties ? "✓" : "", {
    borderRadius: 6,
  });
  ctx.strokeText("Smarties", col1X + 44, row2Y + 22);
  ctx.fillText("Smarties", col1X + 44, row2Y + 22);

  // Checkbox 4: Sensitive Baby Syndrome
  drawGlassButton(col2X, row2Y, checkW, checkH, wsPromptSBS ? "✓" : "", {
    borderRadius: 6,
  });
  ctx.strokeText("Sensitive Baby Syndrome", col2X + 44, row2Y + 22);
  ctx.fillText("Sensitive Baby Syndrome", col2X + 44, row2Y + 22);

  // Checkbox Row 3
  const row3Y = listY + 156;

  // Checkbox 5: Toxoplasmosis
  drawGlassButton(
    col1X,
    row3Y,
    checkW,
    checkH,
    wsPromptToxoplasmosis ? "✓" : "",
    {
      borderRadius: 6,
    },
  );
  ctx.strokeText("Toxoplasmosis", col1X + 44, row3Y + 22);
  ctx.fillText("Toxoplasmosis", col1X + 44, row3Y + 22);

  // Horizontal separator
  const sepY = listY + 202;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(listX + 30, sepY);
  ctx.lineTo(listX + listW - 30, sepY);
  ctx.stroke();

  // Section Title for Sexuality
  ctx.font = "bold 18px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "black";
  ctx.strokeText("Fluffy Sexuality", width / 2, listY + 228);
  ctx.fillText("Fluffy Sexuality", width / 2, listY + 228);

  // Sliders
  const sliderW = 380;
  const sliderX = width / 2 - sliderW / 2;
  const slidersY = listY + 246;
  fluffySexualitySliderSet.setPosition(sliderX, slidersY, sliderW, 12);

  // Dragging frame update
  if (mouse.down) {
    fluffySexualitySliderSet.handleMouseMove(mouse.x, mouse.y);
  } else {
    fluffySexualitySliderSet.handleMouseUp();
  }

  fluffySexualitySliderSet.draw(ctx);

  // Buttons
  const btnW = 150;
  const btnH = 42;
  const btnY = listY + 424;
  const startX = width / 2 - btnW - 12;
  const cancelX = width / 2 + 12;

  drawGlassButton(startX, btnY, btnW, btnH, "Start Game");
  drawGlassButton(cancelX, btnY, btnW, btnH, "Cancel");
}

function handleWorldSettingsClick() {
  const listW = 560;
  const listH = 500;
  const listX = width / 2 - listW / 2;
  const listY = height / 2 - listH / 2;

  const col1X = listX + 40;
  const col2X = listX + 260;
  const row1Y = listY + 68;
  const row2Y = listY + 112;
  const row3Y = listY + 156;

  // Sliders click check first
  if (fluffySexualitySliderSet.handleMouseDown(mouse.x, mouse.y)) {
    return;
  }

  // Checkbox 1: Colorism
  if (isPointInRect(mouse.x, mouse.y, col1X - 5, row1Y - 5, 200, 40)) {
    wsPromptColorism = !wsPromptColorism;
    return;
  }

  // Checkbox 2: Alicorn intolerance
  if (isPointInRect(mouse.x, mouse.y, col2X - 5, row1Y - 5, 250, 40)) {
    wsPromptAlicorn = !wsPromptAlicorn;
    return;
  }

  // Checkbox 3: Smarties
  if (isPointInRect(mouse.x, mouse.y, col1X - 5, row2Y - 5, 200, 40)) {
    wsPromptSmarties = !wsPromptSmarties;
    return;
  }

  // Checkbox 4: Sensitive Baby Syndrome
  if (isPointInRect(mouse.x, mouse.y, col2X - 5, row2Y - 5, 290, 40)) {
    wsPromptSBS = !wsPromptSBS;
    return;
  }

  // Checkbox 5: Toxoplasmosis
  if (isPointInRect(mouse.x, mouse.y, col1X - 5, row3Y - 5, 200, 40)) {
    wsPromptToxoplasmosis = !wsPromptToxoplasmosis;
    return;
  }

  // Buttons
  const btnW = 150;
  const btnH = 42;
  const btnY = listY + 424;
  const startX = width / 2 - btnW - 12;
  const cancelX = width / 2 + 12;

  // Start Game click
  if (isPointInRect(mouse.x, mouse.y, startX, btnY, btnW, btnH)) {
    worldSettings = new WorldSettings(
      wsPromptColorism,
      wsPromptAlicorn,
      wsPromptSmarties,
      wsPromptSBS,
      fluffySexualitySliderSet.getValues(),
      wsPromptToxoplasmosis,
    );
    showWorldSettingsPrompt = false;

    preTransitionState = "TITLE_NEW";
    transitionPhase = "IN";
    transitionTimer = 0;

    // A brand new world (globals.js)
    resetGameState();
    return;
  }

  // Cancel click
  if (isPointInRect(mouse.x, mouse.y, cancelX, btnY, btnW, btnH)) {
    showWorldSettingsPrompt = false;
    return;
  }
}

function handleSaveListScroll(deltaY) {
  if (!showSaveList) return;
  const panelW = Math.min(840, width - 40);
  const panelH = Math.min(540, height - 60);
  const panelX = Math.round((width - panelW) / 2);
  const panelY = Math.round((height - panelH) / 2);
  const leftX = panelX + 20;
  const leftW = 310;
  const listStartY = gameState === "TITLE" ? panelY + 102 : panelY + 142;
  const listBottomY = panelY + panelH - 58;
  const listH = listBottomY - listStartY;

  if (
    mouse.x >= panelX &&
    mouse.x <= panelX + panelW &&
    mouse.y >= panelY &&
    mouse.y <= panelY + panelH
  ) {
    const itemH = 44;
    const gap = 4;
    const totalH = (saveList ? saveList.length : 0) * (itemH + gap);
    const maxScroll = Math.max(0, totalH - listH);
    saveListScrollOffset = Math.max(
      0,
      Math.min(maxScroll, saveListScrollOffset + Math.sign(deltaY) * 48),
    );
  }
}

async function selectSave(saveName) {
  selectedSaveName = saveName;
  if (!saveName) {
    selectedSaveData = null;
    selectedSaveImage = null;
    return;
  }

  if (
    typeof savePreviewCache !== "undefined" &&
    savePreviewCache &&
    savePreviewCache.has(saveName)
  ) {
    const cached = savePreviewCache.get(saveName);
    selectedSaveData = cached.data;
    selectedSaveImage = cached.image;
    return;
  }

  try {
    const data = await saveManager.load(saveName);
    if (!data) {
      if (selectedSaveName === saveName) {
        selectedSaveData = null;
        selectedSaveImage = null;
      }
      return;
    }
    let img = null;
    if (data.screenshot) {
      img = new Image();
      img.src = data.screenshot;
    }
    if (typeof savePreviewCache !== "undefined" && savePreviewCache) {
      savePreviewCache.set(saveName, { data: typeof savePreviewOf === "function" ? savePreviewOf(data) : data, image: img });
    }
    if (selectedSaveName === saveName) {
      selectedSaveData = data;
      selectedSaveImage = img;
    }
  } catch (err) {
    console.error("Failed to load save preview for:", saveName, err);
    if (selectedSaveName === saveName) {
      selectedSaveData = null;
      selectedSaveImage = null;
    }
  }
}

async function refreshSaveList() {
  saveList = await saveManager.listSaves();
  const panelW = Math.min(840, width - 40);
  const panelH = Math.min(540, height - 60);
  const panelY = Math.round((height - panelH) / 2);
  const listStartY = gameState === "TITLE" ? panelY + 102 : panelY + 142;
  const listBottomY = panelY + panelH - 58;
  const listH = listBottomY - listStartY;
  const itemH = 44;
  const gap = 4;
  const totalH = (saveList ? saveList.length : 0) * (itemH + gap);
  const maxScroll = Math.max(0, totalH - listH);
  saveListScrollOffset = Math.max(0, Math.min(maxScroll, saveListScrollOffset));

  if (saveList && saveList.length > 0) {
    if (!selectedSaveName || !saveList.includes(selectedSaveName)) {
      selectedSaveName = saveList[0];
    }
  } else {
    selectedSaveName = null;
  }
  await selectSave(selectedSaveName);
}

async function exportSave(saveName) {
  try {
    const data = await saveManager.load(saveName);
    if (!data) {
      alert(`Save "${saveName}" could not be loaded for export.`);
      return;
    }
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = saveName.replace(/[^a-zA-Z0-9_\-]/g, "_");
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to export save:", err);
    alert("An error occurred while exporting the save file.");
  }
}

function importSave() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.style.display = "none";

  fileInput.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        alert("Failed to parse JSON file: Invalid JSON format.");
        return;
      }

      if (!data || typeof data !== "object") {
        alert("Invalid save file: Content is not a JSON object.");
        return;
      }

      if (!Array.isArray(data.fluffies) || !Array.isArray(data.objects)) {
        alert("Invalid save file: Missing required fluffy or object data.");
        return;
      }

      let defaultName = file.name.replace(/\.[^/.]+$/, "").trim();
      if (!defaultName) defaultName = "Imported Save";

      let saveName = prompt("Enter name for the imported save:", defaultName);
      if (!saveName || !saveName.trim()) return;
      saveName = saveName.trim();

      if (saveList && saveList.includes(saveName)) {
        if (
          !confirm(`A save named "${saveName}" already exists. Overwrite it?`)
        ) {
          return;
        }
      }

      await saveManager.save(saveName, data);

      if (typeof savePreviewCache !== "undefined" && savePreviewCache) {
        let img = null;
        if (data.screenshot) {
          img = new Image();
          img.src = data.screenshot;
        }
        savePreviewCache.set(saveName, { data: typeof savePreviewOf === "function" ? savePreviewOf(data) : data, image: img });
      }

      selectedSaveName = saveName;
      await refreshSaveList();
      await selectSave(saveName);
    } catch (err) {
      console.error("Failed to import save:", err);
      alert("An error occurred while importing the save file.");
    } finally {
      if (fileInput.parentNode) {
        fileInput.parentNode.removeChild(fileInput);
      }
    }
  };

  document.body.appendChild(fileInput);
  fileInput.click();
}

function drawSaveList() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, width, height);

  const panelW = Math.min(840, width - 40);
  const panelH = Math.min(540, height - 60);
  const panelX = Math.round((width - panelW) / 2);
  const panelY = Math.round((height - panelH) / 2);

  // Outer dialog window
  drawGlassButton(panelX, panelY, panelW, panelH, "", {
    forceNormal: true,
    borderRadius: 12,
    normalFill: "rgba(16, 20, 26, 0.95)",
    hoverFill: "rgba(16, 20, 26, 0.95)",
    borderColor: "rgba(80, 95, 115, 0.7)",
  });

  // Title text
  const titleText = gameState === "TITLE" ? "Load game" : "Save/load game";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
  ctx.strokeText(titleText, panelX + 24, panelY + 30);
  ctx.fillText(titleText, panelX + 24, panelY + 30);

  // Divider
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + 20, panelY + 48);
  ctx.lineTo(panelX + panelW - 20, panelY + 48);
  ctx.stroke();

  // --- Left Column ---
  const leftX = panelX + 20;
  const leftW = 310;
  const btnH = 34;
  let listStartY;

  if (gameState !== "TITLE") {
    const newSaveY = panelY + 60;
    drawGlassButton(leftX, newSaveY, leftW, btnH, "+ New save", {
      borderRadius: 6,
      fontSize: 15,
    });
    const importY = newSaveY + btnH + 6;
    drawGlassButton(leftX, importY, leftW, btnH, "Import save from file", {
      borderRadius: 6,
      fontSize: 15,
    });
    listStartY = importY + btnH + 8;
  } else {
    const importY = panelY + 60;
    drawGlassButton(leftX, importY, leftW, btnH, "Import save from file", {
      borderRadius: 6,
      fontSize: 15,
    });
    listStartY = importY + btnH + 8;
  }

  const listBottomY = panelY + panelH - 58;
  const listH = listBottomY - listStartY;

  // Left List Container
  ctx.fillStyle = "rgba(8, 10, 14, 0.6)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(leftX, listStartY, leftW, listH, 6);
  else ctx.rect(leftX, listStartY, leftW, listH);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Clipped scroll area
  ctx.save();
  ctx.beginPath();
  ctx.rect(leftX, listStartY, leftW, listH);
  ctx.clip();

  const itemH = 44;
  const gap = 4;
  const hasScrollbar = (saveList ? saveList.length : 0) * (itemH + gap) > listH;
  const itemW = hasScrollbar ? leftW - 14 : leftW - 8;

  if (!saveList || saveList.length === 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "italic 15px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "No save files found",
      leftX + leftW / 2,
      listStartY + listH / 2,
    );
  } else {
    for (let i = 0; i < saveList.length; i++) {
      const saveName = saveList[i];
      const itemX = leftX + 4;
      const itemY = listStartY + 4 - saveListScrollOffset + i * (itemH + gap);

      if (
        itemY + itemH >= listStartY - 20 &&
        itemY <= listStartY + listH + 20
      ) {
        const isSelected = saveName === selectedSaveName;
        const isHovered = isPointInRect(
          mouse.x,
          mouse.y,
          itemX,
          itemY,
          itemW,
          itemH,
        );

        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(itemX, itemY, itemW, itemH, 4);
        else ctx.rect(itemX, itemY, itemW, itemH);

        if (isSelected) {
          ctx.fillStyle = "rgba(240, 173, 78, 0.3)";
          ctx.fill();
          ctx.strokeStyle = "#f0ad4e";
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (isHovered) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.fillStyle = isSelected ? "#ffffff" : "#cccccc";
        ctx.font = isSelected ? "bold 15px Arial" : "15px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        let displayTitle = saveName;
        const maxTextW = itemW - 20;
        if (ctx.measureText(displayTitle).width > maxTextW) {
          while (
            displayTitle.length > 3 &&
            ctx.measureText(displayTitle + "...").width > maxTextW
          ) {
            displayTitle = displayTitle.slice(0, -1);
          }
          displayTitle += "...";
        }
        ctx.fillText(displayTitle, itemX + 10, itemY + itemH / 2);
      }
    }
  }
  ctx.restore();

  // Scrollbar
  const totalH = (saveList ? saveList.length : 0) * (itemH + gap);
  if (totalH > listH) {
    const barX = leftX + leftW - 7;
    const barW = 5;
    const thumbH = Math.max(20, Math.round((listH / totalH) * listH));
    const thumbY =
      listStartY +
      Math.round((saveListScrollOffset / (totalH - listH)) * (listH - thumbH));
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(barX, listStartY, barW, listH);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(barX, thumbY, barW, thumbH, 2);
    else ctx.fillRect(barX, thumbY, barW, thumbH);
    ctx.fill();
  }

  // --- Right Column ---
  const rightX = leftX + leftW + 20;
  const rightW = panelX + panelW - 20 - rightX;
  const prevX = rightX;
  const prevY = panelY + 60;
  const prevW = rightW;
  const prevH = Math.min(230, Math.round(prevW * (9 / 16)));

  // Screenshot Container
  ctx.fillStyle = "rgba(8, 10, 14, 0.8)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(prevX, prevY, prevW, prevH, 6);
  else ctx.rect(prevX, prevY, prevW, prevH);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (
    selectedSaveImage &&
    selectedSaveImage.complete &&
    selectedSaveImage.naturalWidth > 0
  ) {
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(prevX, prevY, prevW, prevH, 6);
    else ctx.rect(prevX, prevY, prevW, prevH);
    ctx.clip();
    ctx.drawImage(selectedSaveImage, prevX, prevY, prevW, prevH);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "italic 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      selectedSaveName ? "No Screenshot Available" : "No Save Selected",
      prevX + prevW / 2,
      prevY + prevH / 2,
    );
  }

  // Details box below screenshot
  const infoY = prevY + prevH + 10;
  const infoH = panelY + panelH - 58 - infoY;

  ctx.fillStyle = "rgba(8, 10, 14, 0.6)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(rightX, infoY, rightW, infoH, 6);
  else ctx.rect(rightX, infoY, rightW, infoH);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (selectedSaveData) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(selectedSaveName || "Unnamed", rightX + 16, infoY + 22);

    ctx.font = "14px Arial";
    const lineSpacing = 22;
    let curY = infoY + 46;

    // Row 1: Time Played
    ctx.fillStyle = "#999999";
    ctx.fillText("Time played:", rightX + 16, curY);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      formatTimePlayed(selectedSaveData.timePlayed || 0),
      rightX + 115,
      curY,
    );
    curY += lineSpacing;

    // Row 2: Date
    ctx.fillStyle = "#999999";
    ctx.fillText("Saved at:", rightX + 16, curY);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(selectedSaveData.saveDate || "Unknown", rightX + 115, curY);
    curY += lineSpacing;

    // Row 4: Money
    ctx.fillStyle = "#999999";
    ctx.fillText("Money:", rightX + 16, curY);
    ctx.fillStyle = "#5cb85c";
    const moneyVal =
      selectedSaveData.money !== undefined
        ? Math.floor(selectedSaveData.money).toLocaleString()
        : "0";
    ctx.fillText("$" + moneyVal, rightX + 115, curY);
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "italic 15px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "Select a save file to view details",
      rightX + rightW / 2,
      infoY + infoH / 2,
    );
  }

  // --- Bottom Buttons ---
  const backW = 95;
  const backH = 36;
  const backX = panelX + 20;
  const backY = panelY + panelH - 46;
  drawGlassButton(backX, backY, backW, backH, "Back", {
    borderRadius: 6,
    fontSize: 15,
  });

  const loadW = 95;
  const loadH = 36;
  const loadX = panelX + panelW - 20 - loadW;
  const loadY = panelY + panelH - 46;
  drawGlassButton(loadX, loadY, loadW, loadH, "Load", {
    borderRadius: 6,
    fontSize: 15,
    disabled: !selectedSaveName,
  });

  const btnSpacing = 8;

  if (gameState !== "TITLE") {
    const saveBtnW = 90;
    const saveBtnX = loadX - btnSpacing - saveBtnW;
    drawGlassButton(saveBtnX, loadY, saveBtnW, loadH, "Save", {
      borderRadius: 6,
      fontSize: 15,
      disabled: !selectedSaveName,
    });

    const exportBtnW = 90;
    const exportBtnX = saveBtnX - btnSpacing - exportBtnW;
    drawGlassButton(exportBtnX, loadY, exportBtnW, loadH, "Export", {
      borderRadius: 6,
      fontSize: 15,
      disabled: !selectedSaveName,
    });

    const delBtnW = 85;
    const delBtnX = exportBtnX - btnSpacing - delBtnW;
    drawGlassButton(delBtnX, loadY, delBtnW, loadH, "Delete", {
      borderRadius: 6,
      fontSize: 15,
      disabled: !selectedSaveName,
      normalFill: "rgba(180, 40, 40, 0.3)",
      hoverFill: "rgba(220, 60, 60, 0.6)",
    });
  } else {
    const exportBtnW = 90;
    const exportBtnX = loadX - btnSpacing - exportBtnW;
    drawGlassButton(exportBtnX, loadY, exportBtnW, loadH, "Export", {
      borderRadius: 6,
      fontSize: 15,
      disabled: !selectedSaveName,
    });

    const delBtnW = 85;
    const delBtnX = exportBtnX - btnSpacing - delBtnW;
    drawGlassButton(delBtnX, loadY, delBtnW, loadH, "Delete", {
      borderRadius: 6,
      fontSize: 15,
      disabled: !selectedSaveName,
      normalFill: "rgba(180, 40, 40, 0.3)",
      hoverFill: "rgba(220, 60, 60, 0.6)",
    });
  }
}

async function handleSaveListClick() {
  if (typeof transitionPhase !== "undefined" && transitionPhase !== "OFF")
    return;

  const panelW = Math.min(840, width - 40);
  const panelH = Math.min(540, height - 60);
  const panelX = Math.round((width - panelW) / 2);
  const panelY = Math.round((height - panelH) / 2);

  const leftX = panelX + 20;
  const leftW = 310;
  const btnH = 34;
  let listStartY;

  if (gameState !== "TITLE") {
    const newSaveY = panelY + 60;
    const importY = newSaveY + btnH + 6;

    // Check "+ New Save" button click
    if (isPointInRect(mouse.x, mouse.y, leftX, newSaveY, leftW, btnH)) {
      const saveName = prompt("Enter save name:");
      if (saveName && saveName.trim()) {
        const trimmed = saveName.trim();
        const existingSaves =
          saveList && saveList.length > 0
            ? saveList
            : await saveManager.listSaves();
        if (existingSaves && existingSaves.includes(trimmed)) {
          if (
            !confirm(`A save named "${trimmed}" already exists. Overwrite it?`)
          ) {
            return;
          }
        }
        await saveGame(trimmed);
        selectedSaveName = trimmed;
        await refreshSaveList();
        await selectSave(trimmed);
      }
      return;
    }

    // Check "Import Save" button click
    if (isPointInRect(mouse.x, mouse.y, leftX, importY, leftW, btnH)) {
      importSave();
      return;
    }

    listStartY = importY + btnH + 8;
  } else {
    const importY = panelY + 60;

    // Check "Import Save" button click
    if (isPointInRect(mouse.x, mouse.y, leftX, importY, leftW, btnH)) {
      importSave();
      return;
    }

    listStartY = importY + btnH + 8;
  }

  const listBottomY = panelY + panelH - 58;
  const listH = listBottomY - listStartY;

  // Bottom buttons coordinates
  const backW = 95;
  const backH = 36;
  const backX = panelX + 20;
  const loadY = panelY + panelH - 46;

  const loadW = 95;
  const loadH = 36;
  const loadX = panelX + panelW - 20 - loadW;

  const btnSpacing = 8;
  const saveBtnW = 90;
  const saveBtnX = loadX - btnSpacing - saveBtnW;

  const exportBtnW = 90;
  const exportBtnX =
    gameState !== "TITLE"
      ? saveBtnX - btnSpacing - exportBtnW
      : loadX - btnSpacing - exportBtnW;

  const delBtnW = 85;
  const delBtnX = exportBtnX - btnSpacing - delBtnW;

  // 1. Back button
  if (isPointInRect(mouse.x, mouse.y, backX, loadY, backW, backH)) {
    showSaveList = false;
    return;
  }

  // 2. Load button (in the bottom right of the panel)
  if (isPointInRect(mouse.x, mouse.y, loadX, loadY, loadW, loadH)) {
    if (selectedSaveName && transitionPhase === "OFF") {
      pendingSaveToLoad = selectedSaveName;
      preTransitionState =
        gameState === "TITLE" ? "TITLE_LOADING" : "PAUSE_LOADING";
      transitionPhase = "IN";
      transitionTimer = 0;
      showSaveList = false;
    }
    return;
  }

  // 3. Save / Overwrite button (only when paused)
  if (
    gameState !== "TITLE" &&
    isPointInRect(mouse.x, mouse.y, saveBtnX, loadY, saveBtnW, loadH)
  ) {
    if (selectedSaveName) {
      if (confirm(`Overwrite save "${selectedSaveName}"?`)) {
        await saveGame(selectedSaveName);
        await refreshSaveList();
        await selectSave(selectedSaveName);
      }
    }
    return;
  }

  // 4. Export button
  if (isPointInRect(mouse.x, mouse.y, exportBtnX, loadY, exportBtnW, loadH)) {
    if (selectedSaveName) {
      exportSave(selectedSaveName);
    }
    return;
  }

  // 5. Delete button
  if (isPointInRect(mouse.x, mouse.y, delBtnX, loadY, delBtnW, loadH)) {
    if (selectedSaveName) {
      if (confirm(`Delete save "${selectedSaveName}"?`)) {
        await saveManager.delete(selectedSaveName);
        selectedSaveName = null;
        await refreshSaveList();
      }
    }
    return;
  }

  // 6. Left column scrolling list items
  if (isPointInRect(mouse.x, mouse.y, leftX, listStartY, leftW, listH)) {
    const itemH = 44;
    const gap = 4;
    const clickRelY = mouse.y - listStartY + saveListScrollOffset;
    const itemIdx = Math.floor(clickRelY / (itemH + gap));
    if (itemIdx >= 0 && saveList && itemIdx < saveList.length) {
      const clickedSave = saveList[itemIdx];
      if (isShiftPressed) {
        if (confirm(`Delete save "${clickedSave}"?`)) {
          await saveManager.delete(clickedSave);
          if (selectedSaveName === clickedSave) {
            selectedSaveName = null;
          }
          await refreshSaveList();
        }
        return;
      }
      await selectSave(clickedSave);
      return;
    }
  }
}

function handlePauseMenuClick() {
  if (typeof transitionPhase !== "undefined" && transitionPhase !== "OFF")
    return;
  if (showSaveList) {
    handleSaveListClick();
    return;
  }

  const btnW = 200;
  const btnH = 60;
  const btnX = width / 2 - btnW / 2;
  const btnYStart = height / 2 - 200;

  // We no longer iterate an array since volume slider is in the middle.

  // Resume
  if (isPointInRect(mouse.x, mouse.y, btnX, btnYStart, btnW, btnH)) {
    gameState = "PLAYING";
  }

  // Mute
  if (isPointInRect(mouse.x, mouse.y, btnX, btnYStart + 160, btnW, btnH)) {
    toggleMute();
  }

  // Save
  if (isPointInRect(mouse.x, mouse.y, btnX, btnYStart + 240, btnW, btnH)) {
    refreshSaveList();
    showSaveList = true;
  }

  for (const t of pauseToggleRects()) {
    if (isPointInRect(mouse.x, mouse.y, t.x, t.y, t.w, t.h)) {
      t.run();
      return;
    }
  }

  // Title Screen
  if (isPointInRect(mouse.x, mouse.y, btnX, btnYStart + 320, btnW, btnH)) {
    if (transitionPhase === "OFF") {
      preTransitionState = "PLAYING";
      transitionPhase = "IN";
      transitionTimer = 0;
    }
  }
}

// The Continue button: under Load, or beside it on a short screen (a phone)
function titleContinueRect() {
  const btnW = 200;
  const btnH = 60;
  const btnX = width / 2 - btnW / 2;
  const loadBtnY = height * 0.6 + btnH + 20;
  if (height < 700) return { x: btnX + btnW + 20, y: loadBtnY, w: btnW + 60, h: btnH };
  return { x: btnX - 30, y: loadBtnY + btnH + 20, w: btnW + 60, h: btnH };
}

function handleTitleScreenClick() {
  if (typeof transitionPhase !== "undefined" && transitionPhase !== "OFF")
    return;
  if (showSaveList) {
    handleSaveListClick();
    return;
  }
  if (showWorldSettingsPrompt) {
    handleWorldSettingsClick();
    return;
  }

  const btnW = 200;
  const btnH = 60;
  const btnX = width / 2 - btnW / 2;
  const btnY = height * 0.6;
  const loadBtnY = btnY + btnH + 20;

  if (isPointInRect(mouse.x, mouse.y, btnX, btnY, btnW, btnH)) {
    if (transitionPhase === "OFF") {
      wsPromptColorism = true;
      wsPromptAlicorn = true;
      wsPromptSmarties = true;
      wsPromptSBS = true;
      wsPromptToxoplasmosis = true;
      wsPromptSexuality = { ...DEFAULT_SEXUALITY };
      fluffySexualitySliderSet.setValues(wsPromptSexuality);
      showWorldSettingsPrompt = true;
    }
  } else if (isPointInRect(mouse.x, mouse.y, btnX, loadBtnY, btnW, btnH)) {
    refreshSaveList();
    showSaveList = true;
  } else if (
    typeof lastSaveInfo === "function" &&
    lastSaveInfo() &&
    isPointInRect(mouse.x, mouse.y, titleContinueRect().x, titleContinueRect().y, titleContinueRect().w, titleContinueRect().h)
  ) {
    continueLastGame(); // (Autosave.js)
  } else {
    // Buy Me a Coffee button
    const bmacImg = images["bmac"];
    if (bmacImg && bmacImg.complete && bmacImg.naturalWidth > 0) {
      const bmacH = 100;
      const bmacW = bmacImg.width * (bmacH / bmacImg.height);
      const bmacPad = 16;
      const bmacX = bmacPad;
      const bmacY = height - bmacH - bmacPad;
      if (isPointInRect(mouse.x, mouse.y, bmacX, bmacY, bmacW, bmacH)) {
        window.open("https://buymeacoffee.com/fluffy.industries", "_blank");
      }
    }
  }
}

function drawTransition() {
  if (transitionPhase === "OFF") return;

  const duration = 1.0;
  const gridSize = 100;
  const staggerAmount = 0.5; // Total time offset across the screen

  ctx.fillStyle = "black";
  const cols = Math.ceil(width / gridSize) + 1;
  const rows = Math.ceil(height / gridSize) + 1;

  // Maximum distance for staggering
  const maxDist = cols + rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * gridSize + gridSize / 2;
      const y = r * gridSize + gridSize / 2;

      // Normalize distance for staggering (0 to 1)
      const dist = (c + r) / maxDist;
      const delay = dist * staggerAmount;

      // Adjust timer per square
      let squareTimer = transitionTimer - delay;
      let size;
      let rotation = 0;

      if (transitionPhase === "IN") {
        const t = clamp(squareTimer / duration, 0, 1);
        const easeT = -t * t + 2 * t;
        size = easeT * gridSize;
        rotation = easeT * (Math.PI / 2);
      } else if (transitionPhase === "WAIT") {
        size = gridSize;
        rotation = Math.PI / 2;
      } else {
        // OUT
        const t = clamp(squareTimer / duration, 0, 1);
        const easeT = -t * t + 2 * t;
        size = (1 - easeT) * gridSize;
        rotation = Math.PI / 2 + easeT * (Math.PI / 2);
      }

      if (size > 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.fillRect(-size / 2, -size / 2, size + 1, size + 1);
        ctx.restore();
      }
    }
  }
}
