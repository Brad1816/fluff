// UI.js - Handles UI rendering and messaging

function addUIMessage(text) {
  uiMessages.push({ text: text, timer: 5.0, opacity: 1.0 });
}

function updateUIMessages(dt) {
  for (let i = uiMessages.length - 1; i >= 0; i--) {
    const msg = uiMessages[i];
    msg.timer -= dt;
    msg.opacity = Math.max(0, msg.timer / 1.0);
    if (msg.timer <= 0) uiMessages.splice(i, 1);
  }
}

function drawUIMessages(ctx) {
  if (uiMessages.length === 0) return;
  ctx.save();
  ctx.font = "14px Arial";
  ctx.textAlign = "left";
  uiMessages.forEach((msg, i) => {
    ctx.fillStyle = `rgba(255, 255, 255, ${msg.opacity})`;
    ctx.fillText(msg.text, 20, 40 + i * 20);
  });
  ctx.restore();
}

function buyMenuSprite(ctx, action, btnSize) {
  if (action.isItem === "safe_room") {
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(-15, -15, 30, 30);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(-15, -15, 30, 30);
  } else if (action.isItem === "water_bowl") {
    ctx.fillStyle = "#66ccff";
    ctx.beginPath();
    ctx.arc(0, 5, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (action.isItem === "suture_kit") {
    ctx.fillStyle = "#ff6666";
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-2, -8, 4, 16);
    ctx.fillRect(-8, -2, 16, 4);
  } else if (action.isItem === "trash_bag") {
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(0, 5, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.fillRect(-3, -10, 6, 8);
  } else if (action.isItem === "litterpal_box") {
    ctx.fillStyle = "#c2b280";
    ctx.fillRect(-12, -12, 24, 24);
    ctx.strokeStyle = "#555";
    ctx.strokeRect(-12, -12, 24, 24);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(0, -2, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (action.isItem === "block") {
    ctx.fillStyle = "#ffcccc";
    ctx.fillRect(-12, -12, 24, 24);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(-12, -12, 24, 24);
    ctx.fillStyle = "#000";
    ctx.font = "14px Arial";
    ctx.fillText("B", -5, 5);
  } else if (action.isItem === "iv_stand") {
    ctx.fillStyle = "#ccc";
    ctx.fillRect(-2, -15, 4, 30);
    ctx.fillRect(-10, 15, 20, 4);
    ctx.fillRect(-10, -15, 20, 2);
  } else if (action.isItem === "iv_bag") {
    ctx.fillStyle =
      typeof getDrugColor === "function"
        ? getDrugColor(action.bagType, "#ffe6f2")
        : DRUG_COLORS?.[action.bagType] || "#ffe6f2";
    ctx.fillRect(-8, -10, 16, 20);
    ctx.strokeStyle = "#999";
    ctx.strokeRect(-8, -10, 16, 20);
  } else if (action.isItem === "syringe") {
    ctx.fillStyle = "#ccc";
    ctx.fillRect(-1, -12, 2, 24);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-4, -4, 8, 12);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(-4, -4, 8, 12);
  } else if (action.isItem === "cattle_prod") {
    ctx.fillStyle = "#8b4513";
    ctx.fillRect(-2, -15, 4, 30);
    ctx.fillStyle = "#aaa";
    ctx.fillRect(-3, -15, 6, 8);
  } else if (action.isItem === "immobilization_board") {
    ctx.fillStyle = "#d2b48c";
    ctx.fillRect(-15, -10, 30, 20);
    ctx.fillStyle = "#8b4513";
    ctx.fillRect(-10, -10, 4, 20);
    ctx.fillRect(6, -10, 4, 20);
  } else {
    // Fallback default box
    ctx.fillStyle = "#aaa";
    ctx.fillRect(-10, -10, 20, 20);
    ctx.strokeStyle = "#333";
    ctx.strokeRect(-10, -10, 20, 20);
  }
}

function getSellRequestY() {
  const h = 160;
  const margin = 10;
  const isToolboxShown = typeof showToolbox === "undefined" || showToolbox;
  const layout =
    typeof _toolboxAndToolbarLayout === "function"
      ? _toolboxAndToolbarLayout()
      : null;
  const topOfBottomUI = layout
    ? isToolboxShown
      ? layout.toolboxY
      : layout.toggleBtnY
    : height - (52 + 16 + 5 + 22 + (isToolboxShown ? 133 : 0));

  let y = topOfBottomUI - margin - h;
  if (typeof tutorialTimer !== "undefined" && tutorialTimer > 0) {
    const tutorialLinesCount = 7;
    const tutorialHeight = tutorialLinesCount * 20 + 20;
    y -= tutorialHeight + margin;
  }
  return y;
}

function drawSellRequest(ctx) {
  if (!currentSellRequest || !getSceneConfig(currentScene).insidePlayerQuarters)
    return;
  const w = 300;
  const h = 160;

  // Use OffscreenCanvas specifically for this section
  const osCanvas = new OffscreenCanvas(w, h);
  const osCtx = osCanvas.getContext("2d");

  osCtx.fillStyle = "rgba(0, 0, 0, 0.8)";
  osCtx.fillRect(0, 0, w, h);
  osCtx.strokeStyle = "gold";
  osCtx.lineWidth = 3;
  osCtx.fillRect(0, 0, w, h);

  const xOffset = 225;

  osCtx.fillStyle = "white";
  osCtx.font = "bold 16px Arial";
  osCtx.textAlign = "center";
  let offset = 25;
  osCtx.fillText("Sale offer!", xOffset, offset);

  // Draw portrait
  if (
    currentSellRequest.fluffy &&
    typeof currentSellRequest.fluffy.drawPortrait === "function"
  ) {
    currentSellRequest.fluffy.drawPortrait(osCtx, 85, 80, 100);
  }

  osCtx.font = "14px Arial";
  offset += 25;
  osCtx.fillText(
    `Name: ${fluffyNames[currentSellRequest.fluffy.id] ?? "Fluffy"}`,
    xOffset,
    offset,
  );
  offset += 25;
  osCtx.fillText(`Price: $${currentSellRequest.price}`, xOffset, offset);
  offset += 25;
  osCtx.fillText(
    `Time: ${Math.ceil(currentSellRequest.timer)}s`,
    xOffset,
    offset,
  );

  // Buttons
  const btnW = 80;
  const btnH = 30;
  const btnY = h - 40;
  const acceptX = w / 2 - 85;
  const rejectX = w / 2 + 5;

  // Accept Button
  osCtx.fillStyle = "#4CAF50";
  osCtx.fillRect(acceptX, btnY, btnW, btnH);
  osCtx.fillStyle = "white";
  osCtx.font = "bold 14px Arial";
  osCtx.textAlign = "center";
  osCtx.textBaseline = "middle";
  osCtx.fillText("Accept", acceptX + btnW / 2, btnY + btnH / 2);

  // Reject Button
  osCtx.fillStyle = "#f44336";
  osCtx.fillRect(rejectX, btnY, btnW, btnH);
  osCtx.fillStyle = "white";
  osCtx.textAlign = "center";
  osCtx.textBaseline = "middle";
  osCtx.fillText("Reject", rejectX + btnW / 2, btnY + btnH / 2);

  // Blit back to main context
  const margin = 10;
  const x = margin;
  const y = getSellRequestY();
  ctx.drawImage(osCanvas, x, y);
}

function _toolboxAndToolbarLayout() {
  const startX = 12;

  // Toolbar dimensions: 10 slots (keys 1-9, 0)
  const slotSize = 52;
  const slotGap = 6;
  const labelH = 16;
  const toolbarW = 10 * slotSize + 9 * slotGap;
  const toolbarH = slotSize;
  const toolbarBoxY = height - 12 - toolbarH;
  const toolbarLabelY = toolbarBoxY - labelH;

  // Toggle toolbox button dimensions (between toolbox and toolbar)
  const toggleBtnW = 100;
  const toggleBtnH = 22;
  const toggleBtnX = startX;
  const toggleBtnY = toolbarLabelY - 5 - toggleBtnH;

  // Toolbox dimensions: 8 columns x 3 rows = 24 buttons
  const btnSize = 39;
  const btnGap = 5;
  const cols = 8;
  const rows = 3;
  const toolboxW = cols * btnSize + (cols - 1) * btnGap;
  const toolboxH = rows * btnSize + (rows - 1) * btnGap;
  const toolboxX = startX;
  const toolboxY = toggleBtnY - 6 - toolboxH;

  return {
    startX,
    slotSize,
    slotGap,
    labelH,
    toolbarW,
    toolbarH,
    toolbarBoxY,
    toolbarLabelY,
    toggleBtnW,
    toggleBtnH,
    toggleBtnX,
    toggleBtnY,
    btnSize,
    btnGap,
    cols,
    rows,
    toolboxW,
    toolboxH,
    toolboxX,
    toolboxY,
  };
}

function drawToolBadge(ctx, tool, x, y, size, countOverride) {
  if (!tool) return;
  let badgeText = null;
  let badgeColor = "#ffffff";
  let badgeBg = "rgba(0, 0, 0, 0.75)";

  const isMulti =
    typeof isMultiPurchaseTool === "function" && isMultiPurchaseTool(tool);

  if (isMulti) {
    const count =
      countOverride !== undefined
        ? countOverride
        : typeof getToolCountInToolbox === "function"
          ? getToolCountInToolbox(tool)
          : 1;

    if (typeof IVBag !== "undefined" && tool instanceof IVBag) {
      const drug = (tool.type || "TPN").substring(0, 3).toUpperCase();
      badgeText = count > 1 ? `${drug}:${count}` : drug;
      badgeColor =
        typeof getDrugColor === "function"
          ? getDrugColor(tool.type, "#ffffff")
          : "#ffffff";
    } else {
      badgeText = `${count}`;
      if (typeof SutureKit !== "undefined" && tool instanceof SutureKit) {
        badgeColor = "#ff9999";
      } else if (typeof TrashBag !== "undefined" && tool instanceof TrashBag) {
        badgeColor = "#ffff99";
      } else if (typeof Thumbtack !== "undefined" && tool instanceof Thumbtack) {
        badgeColor = "#ffffff";
      }
    }
  } else if (typeof Syringe !== "undefined" && tool instanceof Syringe) {
    if (tool.fluidType) {
      badgeText = tool.fluidType.substring(0, 3).toUpperCase();
      badgeColor =
        typeof getDrugColor === "function"
          ? getDrugColor(tool.fluidType, "#66d9ff")
          : "#66d9ff";
    }
  }

  if (badgeText) {
    ctx.save();
    ctx.font = "bold 9px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const tw = ctx.measureText(badgeText).width;
    const pad = 2;
    const bx = x + size - 2;
    const by = y + size - 2;
    ctx.fillStyle = badgeBg;
    ctx.fillRect(bx - tw - pad * 2, by - 10, tw + pad * 2, 11);
    ctx.fillStyle = badgeColor;
    ctx.fillText(badgeText, bx - pad, by);
    ctx.restore();
  }
}

function drawToolboxAndToolbar(ctx) {
  const layout = _toolboxAndToolbarLayout();
  const {
    startX,
    slotSize,
    slotGap,
    labelH,
    toolbarBoxY,
    toolbarLabelY,
    toggleBtnW,
    toggleBtnH,
    toggleBtnX,
    toggleBtnY,
    btnSize,
    btnGap,
    cols,
    rows,
    toolboxX,
    toolboxY,
  } = layout;

  hoveredToolboxItem = null;
  let hoveredTool = null;
  let hoveredIsToolbox = false;
  const isToolboxShown = typeof showToolbox === "undefined" || showToolbox;

  // 1. Draw Toolbox (8x3 grid)
  if (isToolboxShown) {
    const pages = [];
    const groupedEntries =
      typeof getGroupedToolboxEntries === "function"
        ? getGroupedToolboxEntries()
        : typeof toolbox !== "undefined"
          ? toolbox
          : [];
    let itemsToPlace = [...groupedEntries];

    while (itemsToPlace.length > 0) {
      let isFirstPage = pages.length === 0;
      let itemsAllowed = cols * rows; // 24

      if (!isFirstPage) itemsAllowed -= 1; // Prev arrow
      if (itemsToPlace.length > itemsAllowed) itemsAllowed -= 1; // Next arrow

      const pageContent = itemsToPlace.splice(0, itemsAllowed);

      let pageSlots = [];
      if (!isFirstPage) pageSlots.push({ isNav: true, dir: -1, name: "⬅" });
      pageSlots.push(...pageContent);
      if (itemsToPlace.length > 0)
        pageSlots.push({ isNav: true, dir: 1, name: "➡" });

      pages.push(pageSlots);
    }
    if (pages.length === 0) pages.push([]);
    if (typeof toolboxPage === "undefined") toolboxPage = 0;
    if (toolboxPage >= pages.length) toolboxPage = Math.max(0, pages.length - 1);

    const currentSlots = pages[toolboxPage];

    for (let i = 0; i < cols * rows; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = toolboxX + col * (btnSize + btnGap);
      const by = toolboxY + row * (btnSize + btnGap);

      if (i < currentSlots.length) {
        const item = currentSlots[i];
        if (item.isNav) {
          drawGlassButton(bx, by, btnSize, btnSize, item.name, {
            fontSize: 16,
            borderRadius: 6,
            normalFill: "rgba(0, 0, 0, 0.25)",
          });
          if (isPointInRect(mouse.x, mouse.y, bx, by, btnSize, btnSize)) {
            hoveredToolboxItem = item;
          }
        } else {
          const tool = item.tool || item;
          const isActive = item.items
            ? item.items.some((t) => t.isDragging)
            : tool.isDragging;
          drawGlassButton(bx, by, btnSize, btnSize, "", {
            borderRadius: 6,
            normalFill: isActive
              ? "rgba(255, 215, 0, 0.25)"
              : "rgba(0, 0, 0, 0.2)",
            hoverFill: isActive
              ? "rgba(255, 215, 0, 0.35)"
              : "rgba(255, 255, 255, 0.25)",
            borderColor: isActive ? "#ffd700" : undefined,
          });

          const img = getToolImage(tool);
          if (typeof isDrawableImage === "function" ? isDrawableImage(img) : (img && (img.complete || img.width > 0))) {
            const inset = 6;
            const maxW = btnSize - inset * 2;
            const maxH = btnSize - inset * 2;
            const scale = Math.min(maxW / img.width, maxH / img.height);
            const dw = img.width * scale;
            const dh = img.height * scale;
            ctx.drawImage(
              img,
              bx + (btnSize - dw) / 2,
              by + (btnSize - dh) / 2,
              dw,
              dh,
            );
          }

          drawToolBadge(ctx, tool, bx, by, btnSize, item.count);

          if (isPointInRect(mouse.x, mouse.y, bx, by, btnSize, btnSize)) {
            hoveredToolboxItem = item;
            hoveredTool = tool;
            hoveredIsToolbox = true;
          }
        }
      } else {
        // Empty grid slot placeholder
        drawGlassButton(bx, by, btnSize, btnSize, "", {
          borderRadius: 6,
          normalFill: "rgba(0, 0, 0, 0.08)",
          borderColor: "rgba(255, 255, 255, 0.08)",
        });
      }
    }
  }

  // 2. Draw Hide / Show Toolbox Button
  const toggleText = isToolboxShown ? "Hide toolbox" : "Show toolbox";
  drawGlassButton(toggleBtnX, toggleBtnY, toggleBtnW, toggleBtnH, toggleText, {
    fontSize: 11,
    borderRadius: 6,
  });

  // 3. Draw Toolbar (always shown)
  if (typeof toolbarSlots !== "undefined") {
    toolbarSlots.forEach((slot, i) => {
      const x = startX + i * (slotSize + slotGap);
      const isActive = slot.tool && slot.tool.isDragging;

      // Key label above the box
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isActive ? "#ffd700" : "#aaaaaa";
      ctx.fillText(slot.key, x + slotSize / 2, toolbarLabelY + labelH / 2);

      // Slot button
      drawGlassButton(x, toolbarBoxY, slotSize, slotSize, "", {
        borderRadius: 8,
        normalFill: isActive
          ? "rgba(255, 215, 0, 0.25)"
          : "rgba(0, 0, 0, 0.2)",
        hoverFill: isActive
          ? "rgba(255, 215, 0, 0.35)"
          : "rgba(255, 255, 255, 0.25)",
        borderColor: isActive ? "#ffd700" : undefined,
      });

      if (slot.tool) {
        const img = getToolImage(slot.tool);
        if (typeof isDrawableImage === "function" ? isDrawableImage(img) : (img && (img.complete || img.width > 0))) {
          const inset = 8;
          const maxW = slotSize - inset * 2;
          const maxH = slotSize - inset * 2;
          const scale = Math.min(maxW / img.width, maxH / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          ctx.drawImage(
            img,
            x + (slotSize - dw) / 2,
            toolbarBoxY + (slotSize - dh) / 2,
            dw,
            dh,
          );
        }

        drawToolBadge(ctx, slot.tool, x, toolbarBoxY, slotSize);

        if (
          isPointInRect(mouse.x, mouse.y, x, toolbarBoxY, slotSize, slotSize)
        ) {
          if (!hoveredTool) {
            hoveredTool = slot.tool;
            hoveredIsToolbox = false;
          }
        }
      }
    });
  }

  // 4. Tooltip for hovered tool
  if (hoveredTool && !hoveredTool.isNav) {
    ctx.font = "bold 12px Arial";
    const padding = 10;
    const maxTextWidth = 260;
    const titleText = getToolFullName(hoveredTool);
    const descText = getToolDesc(hoveredTool);
    const hintText = hoveredIsToolbox
      ? "(Press 0-9 to assign to toolbar)"
      : null;

    const lines = [titleText];
    if (hoveredIsToolbox && hoveredToolboxItem && hoveredToolboxItem.count > 1) {
      lines.push(`Count in toolbox: ${hoveredToolboxItem.count}`);
    }
    if (descText) {
      lines.push(...wrapText(ctx, descText, maxTextWidth));
    }
    if (hintText) {
      lines.push(hintText);
    }

    let maxWidth = 0;
    for (let l of lines) {
      maxWidth = Math.max(maxWidth, ctx.measureText(l).width);
    }

    const lineHeight = 16;
    const tw = maxWidth + padding * 2;
    const th = lines.length * lineHeight + padding * 2;
    const tx = clamp(mouse.x + 10, 0, width - tw - 10);
    const ty = clamp(mouse.y - th - 10, 0, height - th - 10);

    drawGlassButton(tx, ty, tw, th, "", {
      forceNormal: true,
      borderRadius: 8,
      normalFill: "rgba(0, 0, 0, 0.75)",
    });

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    lines.forEach((line, idx) => {
      const ly = ty + padding + idx * lineHeight;
      ctx.strokeStyle = "black";
      ctx.strokeText(line, tx + padding, ly);
      if (idx === 0) {
        ctx.fillStyle = "gold";
      } else if (line === hintText) {
        ctx.fillStyle = "#88ccff";
      } else {
        ctx.fillStyle = "white";
      }
      ctx.fillText(line, tx + padding, ly);
    });
  }
}

function toolboxAndToolbarClick() {
  const layout = _toolboxAndToolbarLayout();
  const {
    startX,
    slotSize,
    slotGap,
    toolbarBoxY,
    toggleBtnW,
    toggleBtnH,
    toggleBtnX,
    toggleBtnY,
    btnSize,
    btnGap,
    cols,
    rows,
    toolboxX,
    toolboxY,
    toolboxW,
    toolboxH,
  } = layout;

  const isToolboxShown = typeof showToolbox === "undefined" || showToolbox;

  // 1. Toggle Toolbox Button
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
    showToolbox = !isToolboxShown;
    return true;
  }

  // 2. Toolbox buttons (only if toolbox is shown)
  if (isToolboxShown) {
    const pages = [];
    const groupedEntries =
      typeof getGroupedToolboxEntries === "function"
        ? getGroupedToolboxEntries()
        : typeof toolbox !== "undefined"
          ? toolbox
          : [];
    let itemsToPlace = [...groupedEntries];
    while (itemsToPlace.length > 0) {
      let isFirstPage = pages.length === 0;
      let itemsAllowed = cols * rows;
      if (!isFirstPage) itemsAllowed -= 1;
      if (itemsToPlace.length > itemsAllowed) itemsAllowed -= 1;
      const pageContent = itemsToPlace.splice(0, itemsAllowed);
      let pageSlots = [];
      if (!isFirstPage) pageSlots.push({ isNav: true, dir: -1, name: "⬅" });
      pageSlots.push(...pageContent);
      if (itemsToPlace.length > 0)
        pageSlots.push({ isNav: true, dir: 1, name: "➡" });
      pages.push(pageSlots);
    }
    if (pages.length === 0) pages.push([]);
    if (typeof toolboxPage === "undefined") toolboxPage = 0;
    if (toolboxPage >= pages.length) toolboxPage = Math.max(0, pages.length - 1);
    const currentSlots = pages[toolboxPage];

    for (let i = 0; i < currentSlots.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = toolboxX + col * (btnSize + btnGap);
      const by = toolboxY + row * (btnSize + btnGap);

      if (isPointInRect(mouse.x, mouse.y, bx, by, btnSize, btnSize)) {
        const item = currentSlots[i];
        if (item.isNav) {
          toolboxPage += item.dir;
          return true;
        }
        if (typeof swapOrEquipTool === "function") {
          swapOrEquipTool(item.tool || item);
        } else {
          equipTool(item.tool || item);
        }
        return true;
      }
    }

    // If clicking anywhere on the toolbox bounds, absorb click
    if (isPointInRect(mouse.x, mouse.y, toolboxX, toolboxY, toolboxW, toolboxH)) {
      return true;
    }
  }

  // 3. Toolbar slots (always active)
  if (typeof toolbarSlots !== "undefined") {
    for (let i = 0; i < toolbarSlots.length; i++) {
      const slot = toolbarSlots[i];
      const x = startX + i * (slotSize + slotGap);
      if (isPointInRect(mouse.x, mouse.y, x, toolbarBoxY, slotSize, slotSize)) {
        if (slot.tool) {
          if (typeof swapOrEquipTool === "function") {
            swapOrEquipTool(slot.tool);
          } else {
            equipTool(slot.tool);
          }
        }
        return true;
      }
    }
  }

  return false;
}

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

function applyImmediateDebugAction(action) {
  switch (action) {
    case "clean_all":
      for (const puddle of puddles) {
        puddle.points = [];
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
        const f1 = fluffies.find((x) => x.id === debugPairFirst);
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
  const f = fluffies.find((x) => x.id === debugWatchedFluffyId);
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

function addDebugMessage(text) {
  debugMessages.push({
    text: text,
    timer: 3.0,
    opacity: 1.0,
  });
}

function addDoorMessage(text, portalType = "door") {
  // Find portal position
  const portals = getScenePortals("INDOORS"); // Assume messages are seen from indoors
  let targetX = width / 2;
  let targetY = height * 0.15;

  // Default to main door
  if (portalType === "door") {
    targetX = doorRect.x + doorRect.w + 20;
    targetY = doorRect.y + doorRect.h / 2;
  }

  // Add random offset so they don't stack perfectly
  targetY += (Math.random() - 0.5) * 50;

  doorMessages.push({
    text: text,
    x: targetX,
    y: targetY,
    timer: 3.0,
    opacity: 1.0,
  });
}

function drawTVMessages(ctx) {
  for (const obj of objects) {
    if (!(obj instanceof FluffTV)) {
      continue;
    }

    if (obj.scene !== currentScene) {
      continue;
    }

    if (!obj.msg) {
      continue;
    }

    const padding = 10;
    const maxWidth = 250;
    ctx.font = "16px Arial";

    const lines = wrapText(ctx, obj.msg.text, maxWidth - padding * 2);

    let maxLineWidth = 0;
    for (const line of lines) {
      maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
    }

    const bubbleW = maxLineWidth + padding * 2;
    const lineHeight = 20;
    const bubbleH = lines.length * lineHeight + padding;
    const bx = obj.x - bubbleW / 2;
    const by = obj.y - 120 - (bubbleH - 30);

    ctx.save();
    ctx.globalAlpha = obj.msg.opacity;
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, bubbleW, bubbleH, 10);
    } else {
      ctx.rect(bx, by, bubbleW, bubbleH);
    }
    ctx.fill();
    ctx.stroke();

    // Tail pointing to door (approx left)
    ctx.beginPath();
    ctx.moveTo(obj.x - 5, by + bubbleH);
    ctx.lineTo(obj.x + 5, by + bubbleH);
    ctx.lineTo(obj.x, by + bubbleH + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    lines.forEach((line, i) => {
      ctx.fillText(line, bx + padding, by + padding + i * lineHeight);
    });

    ctx.restore();
  }
}

function drawDoorMessages(ctx) {
  if (!getSceneConfig(currentScene).isAdoptionRoom) return;

  for (const msg of doorMessages) {
    const padding = 10;
    const maxWidth = 250;
    ctx.font = "16px Arial";

    const lines = wrapText(ctx, msg.text, maxWidth - padding * 2);

    let maxLineWidth = 0;
    for (const line of lines) {
      maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
    }

    const bubbleW = maxLineWidth + padding * 2;
    const lineHeight = 20;
    const bubbleH = lines.length * lineHeight + padding;

    ctx.save();
    ctx.globalAlpha = msg.opacity;
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(msg.x, msg.y, bubbleW, bubbleH, 10);
    } else {
      ctx.rect(msg.x, msg.y, bubbleW, bubbleH); // Fallback
    }
    ctx.fill();
    ctx.stroke();

    // Tail pointing to door (approx left)
    ctx.beginPath();
    ctx.moveTo(msg.x, msg.y + bubbleH / 2 - 5);
    ctx.lineTo(msg.x - 10, msg.y + bubbleH / 2);
    ctx.lineTo(msg.x, msg.y + bubbleH / 2 + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    lines.forEach((line, i) => {
      ctx.fillText(line, msg.x + padding, msg.y + padding / 2 + i * lineHeight);
    });

    ctx.restore();
  }
}

function drawUI(ctx) {
  // Money Top Left
  ctx.fillStyle = "gold";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "black";
  const moneyText = `$${money}`;
  ctx.strokeText(moneyText, 10, 10 + 20);
  ctx.fillText(moneyText, 10, 10 + 20);

  if (showDebugMenu) {
    ctx.fillStyle = "#e74c3c";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "right";
    const debugText = "(Money Locked - Debug Mode)";
    ctx.strokeText(debugText, width - 10, 10 + 20);
    ctx.fillText(debugText, width - 10, 10 + 20);

    // Reset textAlign for future drawing
    ctx.textAlign = "left";
  }

  if (showFPS) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(170, 10, 80, 40);
    ctx.fillStyle = "white";
    ctx.font = "bold 16px Arial";
    ctx.textBaseline = "middle";
    ctx.fillText(`FPS: ${currentFPS}`, 180, 10 + 20);
  }

  // Toggle Button
  const toggleBtnW = 90;
  const toggleBtnH = 30;
  const toggleBtnX = 10;
  const toggleBtnY = 50;

  // The item menu is only there in debug mode (see isItemMenuAvailable)
  const menuAvailable = isItemMenuAvailable();
  if (menuAvailable) {
    const text = showActionButtons ? "Hide Menu" : "Show Menu";
    drawGlassButton(toggleBtnX, toggleBtnY, toggleBtnW, toggleBtnH, text, {
      fontSize: 14,
      borderRadius: 8,
    });
  }

  // Chat Log Button (takes the menu button's place when there's no menu)
  const chatLogBtnW = 90;
  const chatLogBtnH = 30;
  const chatLogBtnX = menuAvailable ? toggleBtnX + toggleBtnW + 5 : toggleBtnX;
  const chatLogBtnY = toggleBtnY;

  drawGlassButton(
    chatLogBtnX,
    chatLogBtnY,
    chatLogBtnW,
    chatLogBtnH,
    "Chat Log",
    {
      fontSize: 14,
      borderRadius: 8,
      normalFill: showChatLog ? "rgba(0, 150, 255, 0.4)" : "rgba(0, 0, 0, 0.1)",
      borderColor: showChatLog ? "rgba(100, 200, 255, 0.9)" : undefined,
    },
  );

  if (showActionButtons && menuAvailable) {
    // Filter Button
    const filterBtnW = 200;
    const filterBtnH = 30;
    const filterBtnX = 10;
    const filterBtnY = toggleBtnY + toggleBtnH + 5;

    const filterText = itemMenuFilter
      ? `Filtering: ${itemMenuFilter}`
      : "Filter items by name...";
    drawGlassButton(
      filterBtnX,
      filterBtnY,
      filterBtnW,
      filterBtnH,
      filterText,
      {
        fontSize: 12,
        borderRadius: 8,
      },
    );

    // Action Buttons
    const btnSize = 40;
    const btnPadding = 5;
    const startX = 10;
    const startY = filterBtnY + filterBtnH + btnPadding;
    const cols = 7;

    let hoveredAction = null;

    const filteredActions = itemMenuFilter
      ? SPAWN_ACTIONS.filter((a) =>
          a.name.toLowerCase().startsWith(itemMenuFilter.toLowerCase()),
        )
      : SPAWN_ACTIONS;

    const pages = [];
    let itemsToPlace = [...filteredActions];

    while (itemsToPlace.length > 0) {
      let isFirstPage = pages.length === 0;
      let itemsAllowed = 21;

      if (!isFirstPage) itemsAllowed -= 1; // Prev
      if (itemsToPlace.length > itemsAllowed) itemsAllowed -= 1; // Next

      const pageContent = itemsToPlace.splice(0, itemsAllowed);

      let pageSlots = [];
      if (!isFirstPage) pageSlots.push({ isNav: true, dir: -1, name: "⬅" });
      pageSlots.push(...pageContent);
      if (itemsToPlace.length > 0)
        pageSlots.push({ isNav: true, dir: 1, name: "➡" });

      pages.push(pageSlots);
    }
    if (pages.length === 0) pages.push([]);
    if (itemMenuPage >= pages.length)
      itemMenuPage = Math.max(0, pages.length - 1);

    const currentSlots = pages[itemMenuPage];

    currentSlots.forEach((action, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = startX + col * (btnSize + btnPadding);
      const by = startY + row * (btnSize + btnPadding);

      if (action.isNav) {
        drawGlassButton(bx, by, btnSize, btnSize, action.name, {
          fontSize: 20,
          borderRadius: 8,
        });
      } else {
        // Simple name abbreviation if too long
        let name = action.name;
        if (name.length > 7) name = name.substring(0, 6) + ".";

        const isAlreadyOwned =
          typeof isToolAlreadyOwned === "function" &&
          isToolAlreadyOwned(action);
        const disabled =
          (!showDebugMenu && money < action.cost) || isAlreadyOwned;
        drawGlassButton(bx, by, btnSize, btnSize, name, {
          fontSize: 10,
          borderRadius: 8,
          disabled: disabled,
          textOffsetY: 12,
        });

        // Shop button picture (ItemRegistry.js: `icon` / `drawIcon`)
        drawShopActionIcon(
          ctx,
          action,
          bx + btnSize / 2,
          by + btnSize * 0.4,
          btnSize * 0.5,
          disabled,
        );

        if (isPointInRect(mouse.x, mouse.y, bx, by, btnSize, btnSize)) {
          hoveredAction = action;
        }
      }
    });

    if (hoveredAction) {
      drawShopTooltip(ctx, hoveredAction);
    }
  } else if (showChatLog) {
    drawChatLogPanel(ctx, toggleBtnY + toggleBtnH + 5);
  }

  // Tutorial Prompt Bottom Left (placed above toolbox)
  if (tutorialTimer > 0) {
    ctx.font = "14px Arial";
    const lines = [
      "• Press ESC to pause/save the game.",
      "• Click a fluffy or item to drag it. Click again to release it.",
      "• While dragging a fluffy, click on the door/arrow or press WASD to move it to the other side.",
      "• Shift click a placed item or a Fluffy to sell it.",
      "• Buy supplies at Fluff Mart: out the front door, then down to Shopping Street.",
      "• Press N to toggle Fluffy names, B for bed owners, H to show herds.",
      "• Press 0-9 to select a tool while you have it in your inventory.",
    ];

    // Calculate dynamic width and height
    const padding = 10;
    const textWidth = Math.min(
      600,
      Math.max(...lines.map((l) => ctx.measureText(l).width)) + padding * 2,
    );
    const textHeight = lines.length * 20 + padding * 2;

    const margin = 10;
    const x = margin;
    const layout =
      typeof _toolboxAndToolbarLayout === "function"
        ? _toolboxAndToolbarLayout()
        : null;
    const isToolboxShown = typeof showToolbox === "undefined" || showToolbox;
    const topOfBottomUI = layout
      ? isToolboxShown
        ? layout.toolboxY
        : layout.toggleBtnY
      : height - 240;
    const y = Math.max(margin, topOfBottomUI - margin - textHeight);

    drawGlassButton(x, y, textWidth, textHeight, "", {
      forceNormal: true,
      borderRadius: 8,
      normalFill: "rgba(0, 0, 0, 0.5)",
      hoverFill: "rgba(255, 255, 255, 0.75)",
    });

    ctx.textAlign = "left";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    lines.forEach((line, i) => {
      ctx.strokeStyle = "black";
      ctx.strokeText(line, x + padding, y + 20 + i * 20);
      ctx.fillStyle = "white";
      ctx.fillText(line, x + padding, y + 20 + i * 20);
    });
  }

  // Sell Request drawn later so it renders on top of tool indicators

  // Sell Mode Tooltip
  if (isShiftPressed) {
    let sellPrice = 0;
    let showSellTooltip = false;
    let sellTooltipText = "";

    // Find best Item (Highest Y = Front-most) - see ItemRegistry.js
    let bestItem = null;
    let maxY = -Infinity;
    let bestType = null;
    let bestEntry = null;

    const sellable = findSellableItemAt(mouse.x, mouse.y);
    if (sellable) {
      bestItem = sellable.item;
      bestEntry = sellable.entry;
      bestType = sellable.entry.sellType;
      maxY = bestItem.getBottomY();
    }

    // Check Fluffies
    for (const f of fluffies) {
      if (f.scene !== currentScene) continue;
      if (f.hitTest(mouse.x, mouse.y)) {
        const y = f.getBottomY();
        if (y > maxY) {
          maxY = y;
          bestItem = f;
          bestType = "fluffy";
        }
      }
    }

    if (bestItem) {
      if (bestType === "fluffy") {
        const hasAcc = Object.keys(bestItem.accessories || {}).length > 0;
        if (hasAcc) {
          sellTooltipText = "Remove accessory";
        } else if (
          typeof shiftSellBlocked !== "undefined" &&
          shiftSellBlocked
        ) {
          bestItem = null; // Blocked until shift is released
        } else if (
          bestItem.canBeSold() &&
          getSceneConfig(currentScene).insidePlayerQuarters
        ) {
          sellPrice = Math.floor(bestItem.calculatePrice() / 2);
          sellTooltipText = `Sell: $${sellPrice}`;
        } else {
          bestItem = null; // Can't sell unadopted, dead, or equipped fluffies
        }
      } else if (getSceneConfig(currentScene).insidePlayerQuarters) {
        // What you'd actually get for it (ItemRegistry.js)
        sellPrice = getItemSellValue(bestItem, bestEntry);
      }
      if (bestItem) showSellTooltip = true;
    }

    if (showSellTooltip) {
      const text = sellTooltipText || `Sell: $${sellPrice}`;
      ctx.font = "bold 14px Arial";
      const tw = ctx.measureText(text).width + 10;
      const th = 24;
      const tx = clamp(mouse.x + 15, 0, width - tw - 5);
      const ty = clamp(mouse.y, 0, height);

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(tx, ty, tw, th);
      ctx.strokeStyle = "gold";
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, ty, tw, th);

      ctx.fillStyle = "gold";
      ctx.textAlign = "center";
      ctx.fillText(text, tx + tw / 2, ty + th / 2);
    }
  }

  // Backyard Fence Upgrade/Repair Tooltip
  if (
    currentScene === "BACKYARD" &&
    (backyardFenceTier < 2 || backyardFenceBroken) &&
    !isGlobalDragging
  ) {
    const fenceImg =
      images[
        backyardFenceTier === 0
          ? "crummy_fence_post"
          : backyardFenceTier === 1
            ? "fence_post"
            : "reinforced_fence_post"
      ];
    const postH =
      fenceImg && fenceImg.complete && fenceImg.width > 0
        ? fenceImg.height
        : 120;

    if (mouse.y >= height - postH && mouse.y <= height) {
      let cost = 0;
      let tooltipText = "";
      if (backyardFenceBroken) {
        cost =
          backyardFenceTier === 0 ? 500 : backyardFenceTier === 1 ? 5000 : 0;
        tooltipText = cost > 0 ? `Repair fence: $${cost}` : "Repair fence";
      } else {
        cost = backyardFenceTier === 0 ? 150000 : 300000;
        tooltipText = `Upgrade fence: $${cost}`;
      }

      ctx.font = "bold 14px Arial";
      const padding = 10;
      const tw = ctx.measureText(tooltipText).width + padding * 2;
      const th = 30;
      const tx = clamp(mouse.x + 10, 0, width - tw - 10);
      const ty = clamp(mouse.y - 40, 0, height - th - 10); // place above cursor

      drawGlassButton(tx, ty, tw, th, "", {
        forceNormal: true,
        borderRadius: 8,
        normalFill: "rgba(0, 0, 0, 0.7)",
        hoverFill: "rgba(255, 255, 255, 0.75)",
      });

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "black";
      ctx.strokeText(tooltipText, tx + padding, ty + th / 2);
      ctx.fillStyle = showDebugMenu || money >= cost ? "gold" : "#ff4d4d";
      ctx.fillText(tooltipText, tx + padding, ty + th / 2);
    }
  }

  // Foal Vending Machine Hover Tooltip
  if (currentScene === "ALLEY" && !isGlobalDragging) {
    const vendor = objects.find((o) => o instanceof FoalVendor);
    if (vendor) {
      const img = images.foal_vendor;
      let bw = 80,
        bh = 120;
      if (img && img.complete && img.width > 0) {
        bw = img.width;
        bh = img.height;
      }
      if (
        isPointInRect(
          mouse.x,
          mouse.y,
          vendor.x - bw / 2,
          vendor.y - bh,
          bw,
          bh,
        )
      ) {
        const cost = 250;
        const tooltipText = `Foal Vending Machine: $${cost}`;
        ctx.font = "bold 14px Arial";
        const padding = 10;
        const tw = ctx.measureText(tooltipText).width + padding * 2;
        const th = 30;
        const tx = clamp(mouse.x + 10, 0, width - tw - 10);
        const ty = clamp(mouse.y - 40, 0, height - th - 10); // place above cursor

        drawGlassButton(tx, ty, tw, th, "", {
          forceNormal: true,
          borderRadius: 8,
          normalFill: "rgba(0, 0, 0, 0.7)",
          hoverFill: "rgba(255, 255, 255, 0.75)",
        });

        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "black";
        ctx.strokeText(tooltipText, tx + padding, ty + th / 2);
        ctx.fillStyle = showDebugMenu || money >= cost ? "gold" : "#ff4d4d";
        ctx.fillText(tooltipText, tx + padding, ty + th / 2);
      }
    }
  }

  // Foal in a Can Hover Tooltip
  if (!isGlobalDragging) {
    for (const obj of objects) {
      if (obj instanceof FoalInACan && obj.scene === currentScene) {
        const img = images.foal_in_a_can;
        let bw = 60,
          bh = 70;
        if (img && img.complete && img.width > 0) {
          bw = img.width;
          bh = img.height;
        }
        if (
          isPointInRect(mouse.x, mouse.y, obj.x - bw / 2, obj.y - bh, bw, bh)
        ) {
          const tooltipText = `Right click to extract foal (Formula: ${obj.formulaCharges})`;
          ctx.font = "bold 14px Arial";
          const padding = 10;
          const tw = ctx.measureText(tooltipText).width + padding * 2;
          const th = 30;
          const tx = clamp(mouse.x + 10, 0, width - tw - 10);
          const ty = clamp(mouse.y - 40, 0, height - th - 10);

          drawGlassButton(tx, ty, tw, th, "", {
            forceNormal: true,
            borderRadius: 8,
            normalFill: "rgba(0, 0, 0, 0.7)",
            hoverFill: "rgba(255, 255, 255, 0.75)",
          });

          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.lineWidth = 2;
          ctx.lineJoin = "round";
          ctx.strokeStyle = "black";
          ctx.strokeText(tooltipText, tx + padding, ty + th / 2);
          ctx.fillStyle = "gold";
          ctx.fillText(tooltipText, tx + padding, ty + th / 2);
          break;
        }
      }
    }
  }

  // Day Care Desk Hover Tooltip
  if (currentScene === "DAY_CARE" && !isGlobalDragging && !dayCareModalOpen) {
    const desk = objects.find(
      (o) => typeof DayCareDesk !== "undefined" && o instanceof DayCareDesk,
    );
    if (desk) {
      const img = images.day_care_desk;
      let bw = 200,
        bh = 150;
      if (img && img.complete && img.width > 0) {
        bw = img.width;
        bh = img.height;
      }
      if (
        isPointInRect(mouse.x, mouse.y, desk.x - bw / 2, desk.y - bh, bw, bh)
      ) {
        const tooltipText = "Day Care Desk (Click to Manage)";
        ctx.font = "bold 14px Arial";
        const padding = 10;
        const tw = ctx.measureText(tooltipText).width + padding * 2;
        const th = 30;
        const tx = clamp(mouse.x + 10, 0, width - tw - 10);
        const ty = clamp(mouse.y - 40, 0, height - th - 10);

        if (typeof drawGlassButton !== "undefined") {
          drawGlassButton(tx, ty, tw, th, "", {
            forceNormal: true,
            borderRadius: 8,
            normalFill: "rgba(0, 0, 0, 0.7)",
            hoverFill: "rgba(255, 255, 255, 0.75)",
          });
        }

        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "black";
        ctx.strokeText(tooltipText, tx + padding, ty + th / 2);
        ctx.fillStyle = "gold";
        ctx.fillText(tooltipText, tx + padding, ty + th / 2);
      }
    }
  }

  drawToolboxAndToolbar(ctx);
  drawSellRequest(ctx);
  drawDebugMenu();
  drawUIMessages(ctx);
  drawDebugWatcher();
  drawInspectionModal(ctx);
  if (typeof drawFamilyTree === "function") drawFamilyTree(ctx);
  if (typeof drawGeneLab === "function") drawGeneLab(ctx);
  if (typeof drawOrdersHud === "function") drawOrdersHud(ctx);
  if (typeof drawOrdersScreen === "function") drawOrdersScreen(ctx);
  drawDayCareModal(ctx);
}

let inspectedFluffy = null;

function isAnyScreenOpen() {
  if (typeof dayCareModalOpen !== "undefined" && dayCareModalOpen) return true;
  if (typeof inspectedFluffy !== "undefined" && inspectedFluffy !== null)
    return true;
  if (typeof isFamilyTreeOpen === "function" && isFamilyTreeOpen()) return true;
  if (typeof isGeneLabOpen === "function" && isGeneLabOpen()) return true;
  if (typeof isOrdersScreenOpen === "function" && isOrdersScreenOpen()) return true;
  return false;
}
window.isAnyScreenOpen = isAnyScreenOpen;

function openInspectionModal(fluffy) {
  inspectedFluffy = fluffy;
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
  const nameOf = (id, fallback) =>
    id !== null && id !== undefined ? fluffyNames[id] || fallback : "Unknown";
  const rels = relationships[f.id] || {};
  const sfId = Object.keys(rels).find((id) => rels[id] === "special_friend");
  const friendCount = Object.values(rels).filter((r) => r === "friend").length;

  const about = [
    { label: "Name", value: fluffyNames[f.id] || "Fluffy" },
    { label: "Gender", value: f.gender },
    { label: "Type", value: f.type },
    { label: "Age", value: describeInspectionAge(f) },
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
    value: sfId ? fluffyNames[sfId] || "Unnamed fluffy" : "None",
  });
  about.push({ label: "Friends", value: String(friendCount) });
  // Which herd it's in (Herds.js)
  if (f.isAlive && typeof describeHerd === "function") {
    about.push({ label: "Herd", value: describeHerd(f) });
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
    else sellText = `$${Math.floor(f.calculatePrice() / 2)}`;
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

function drawDayCareModal(ctx) {
  if (!dayCareModalOpen) return;
  if (ctx.canvas !== canvas) return; // screen pass only (see drawInspectionModal)

  // Semi-transparent backdrop
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, width, height);

  const modalW = 760;
  const modalH = 540;
  const modalX = Math.floor(width / 2 - modalW / 2);
  const modalY = Math.floor(height / 2 - modalH / 2);

  if (typeof drawGlassButton !== "undefined") {
    drawGlassButton(modalX, modalY, modalW, modalH, "", {
      forceNormal: true,
      borderRadius: 16,
      normalFill: "rgb(18, 22, 28)",
      hoverFill: "rgba(255, 255, 255, 0.75)",
    });
  } else {
    ctx.fillStyle = "rgba(18, 22, 28, 0.9)";
    ctx.fillRect(modalX, modalY, modalW, modalH);
  }

  // Title
  const titleText = "Fluffy Day Care";
  ctx.fillStyle = "white";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "black";
  ctx.strokeText(titleText, width / 2, modalY + 38);
  ctx.fillText(titleText, width / 2, modalY + 38);

  // Subtitle info
  ctx.font = "bold 13px Arial";
  ctx.textAlign = "center";
  const subText = `Deposit / Withdraw: $${DAY_CARE_MOVE_COST.toLocaleString()} | Boarding: $${DAY_CARE_RECURRING_FEE_PER_FLUFFY}/min per fluffy | Money: $${money.toLocaleString()}`;
  ctx.fillStyle = "#ffdd55";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.strokeText(subText, width / 2, modalY + 64);
  ctx.fillText(subText, width / 2, modalY + 64);

  const colW = 340;
  const col1X = modalX + 25;
  const col2X = modalX + modalW - colW - 25;
  const colY = modalY + 84;

  const broughtFluffies = fluffies.filter(
    (f) => f.scene === "DAY_CARE" && f.adopted && f.isAlive,
  );

  const PAGE_SIZE = 5;
  const maxBroughtPages = Math.max(
    1,
    Math.ceil(broughtFluffies.length / PAGE_SIZE),
  );
  const maxStoredPages = Math.max(
    1,
    Math.ceil(dayCareFluffies.length / PAGE_SIZE),
  );

  if (dayCareBroughtPage >= maxBroughtPages)
    dayCareBroughtPage = maxBroughtPages - 1;
  if (dayCareStoredPage >= maxStoredPages)
    dayCareStoredPage = maxStoredPages - 1;
  if (dayCareBroughtPage < 0) dayCareBroughtPage = 0;
  if (dayCareStoredPage < 0) dayCareStoredPage = 0;

  // --- Column 1: Brought Fluffies ---
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  const col1Title = `Brought Fluffies (${broughtFluffies.length})`;
  ctx.strokeText(col1Title, col1X, colY + 14);
  ctx.fillText(col1Title, col1X, colY + 14);

  ctx.font = "12px Arial";
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText("Adopted fluffies present in room", col1X, colY + 30);

  const listStartY = colY + 40;
  const itemH = 50;
  const itemGap = 6;

  if (broughtFluffies.length === 0) {
    ctx.font = "italic 14px Arial";
    ctx.fillStyle = "#888888";
    ctx.textAlign = "center";
    ctx.fillText(
      "No adopted fluffies brought here.",
      col1X + colW / 2,
      listStartY + 55,
    );
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "gold";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.strokeText(
      "(Note: fluffies are adopted by bringing them",
      col1X + colW / 2,
      listStartY + 85,
    );
    ctx.fillText(
      "(Note: fluffies are adopted by bringing them",
      col1X + colW / 2,
      listStartY + 85,
    );
    ctx.strokeText(
      "into your indoor quarters)",
      col1X + colW / 2,
      listStartY + 105,
    );
    ctx.fillText(
      "into your indoor quarters)",
      col1X + colW / 2,
      listStartY + 105,
    );
  } else {
    const startIdx = dayCareBroughtPage * PAGE_SIZE;
    for (let i = 0; i < PAGE_SIZE; i++) {
      const idx = startIdx + i;
      if (idx >= broughtFluffies.length) break;
      const f = broughtFluffies[idx];
      const itemY = listStartY + i * (itemH + itemGap);
      const name =
        typeof fluffyNames !== "undefined" && fluffyNames[f.id]
          ? fluffyNames[f.id]
          : "Fluffy #" + f.id;
      const color = f.colors && f.colors.body ? f.colors.body : "#ffffff";
      const stage =
        f.growth < 0.25
          ? "Chirpy"
          : f.growth < 0.5
            ? "Talkie"
            : f.growth < 1.0
              ? "Foal"
              : "Adult";
      const info = `${stage} ${f.gender} ${f.type}`;

      const canAfford = showDebugMenu || money >= DAY_CARE_MOVE_COST;
      if (typeof drawGlassButton !== "undefined") {
        drawGlassButton(col1X, itemY, colW, itemH, "", {
          borderRadius: 8,
          normalFill: "rgba(255, 255, 255, 0.08)",
          hoverFill: canAfford
            ? "rgba(60, 140, 60, 0.35)"
            : "rgba(140, 60, 60, 0.35)",
        });
      }

      // Swatch
      ctx.beginPath();
      ctx.arc(col1X + 18, itemY + itemH / 2, 9, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "black";
      ctx.stroke();

      // Info
      ctx.textAlign = "left";
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.strokeText(name, col1X + 34, itemY + 20);
      ctx.fillText(name, col1X + 34, itemY + 20);

      ctx.font = "12px Arial";
      ctx.fillStyle = "#bbbbbb";
      ctx.fillText(info, col1X + 34, itemY + 38);

      // Action Tag
      ctx.textAlign = "right";
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = canAfford ? "#88ff88" : "#ff8888";
      ctx.strokeText("Deposit →", col1X + colW - 10, itemY + 20);
      ctx.fillText("Deposit →", col1X + colW - 10, itemY + 20);

      ctx.font = "11px Arial";
      ctx.fillStyle = "#888888";
      ctx.fillText(`-$${DAY_CARE_MOVE_COST}`, col1X + colW - 10, itemY + 36);
    }
  }

  // --- Column 2: Day Care Fluffies ---
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  const col2Title = `Day Care Fluffies (${dayCareFluffies.length})`;
  ctx.strokeText(col2Title, col2X, colY + 14);
  ctx.fillText(col2Title, col2X, colY + 14);

  ctx.font = "12px Arial";
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText("Fluffies boarded in day care", col2X, colY + 30);

  if (dayCareFluffies.length === 0) {
    ctx.font = "italic 14px Arial";
    ctx.fillStyle = "#888888";
    ctx.textAlign = "center";
    ctx.fillText(
      "No fluffies currently boarded.",
      col2X + colW / 2,
      listStartY + 70,
    );
  } else {
    const startIdx = dayCareStoredPage * PAGE_SIZE;
    for (let i = 0; i < PAGE_SIZE; i++) {
      const idx = startIdx + i;
      if (idx >= dayCareFluffies.length) break;
      const data = dayCareFluffies[idx];
      const itemY = listStartY + i * (itemH + itemGap);
      const name =
        typeof fluffyNames !== "undefined" && fluffyNames[data.id]
          ? fluffyNames[data.id]
          : data.name || "Fluffy #" + data.id;
      const color = data.bodyColor || "#ffffff";
      const growth = data.growth !== undefined ? data.growth : 1.0;
      const stage =
        growth < 0.25
          ? "Chirpy"
          : growth < 0.5
            ? "Talkie"
            : growth < 1.0
              ? "Foal"
              : "Adult";
      let type = data.type;
      if (!type && data.genes) {
        const wingCount =
          (data.genes[53] || 0) +
          (data.genes[54] || 0) +
          (data.genes[55] || 0) +
          (data.genes[56] || 0) +
          (data.genes[57] || 0);
        const hornCount =
          (data.genes[58] || 0) +
          (data.genes[59] || 0) +
          (data.genes[60] || 0) +
          (data.genes[61] || 0) +
          (data.genes[62] || 0);
        if (wingCount >= 4 && hornCount >= 4) type = "alicorn";
        else if (wingCount >= 4) type = "pegasus";
        else if (hornCount >= 4) type = "unicorn";
        else type = "earthy";
      }
      type = type || "earthy";
      const info = `${stage} ${data.gender} ${type}`;

      const canAfford = showDebugMenu || money >= DAY_CARE_MOVE_COST;
      if (typeof drawGlassButton !== "undefined") {
        drawGlassButton(col2X, itemY, colW, itemH, "", {
          borderRadius: 8,
          normalFill: "rgba(255, 255, 255, 0.08)",
          hoverFill: canAfford
            ? "rgba(60, 60, 140, 0.35)"
            : "rgba(140, 60, 60, 0.35)",
        });
      }

      // Swatch
      ctx.beginPath();
      ctx.arc(col2X + 18, itemY + itemH / 2, 9, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "black";
      ctx.stroke();

      // Info
      ctx.textAlign = "left";
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.strokeText(name, col2X + 34, itemY + 20);
      ctx.fillText(name, col2X + 34, itemY + 20);

      ctx.font = "12px Arial";
      ctx.fillStyle = "#bbbbbb";
      ctx.fillText(info, col2X + 34, itemY + 38);

      // Action Tag
      ctx.textAlign = "right";
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = canAfford ? "#88ccff" : "#ff8888";
      ctx.strokeText("← Withdraw", col2X + colW - 10, itemY + 20);
      ctx.fillText("← Withdraw", col2X + colW - 10, itemY + 20);

      ctx.font = "11px Arial";
      ctx.fillStyle = "#888888";
      ctx.fillText(`-$${DAY_CARE_MOVE_COST}`, col2X + colW - 10, itemY + 36);
    }
  }

  // Pagination Row
  const pageRowY = listStartY + PAGE_SIZE * (itemH + itemGap) + 4;
  const pageBtnW = 68;
  const pageBtnH = 26;

  // Col 1 pagination
  if (maxBroughtPages > 1) {
    if (typeof drawGlassButton !== "undefined") {
      drawGlassButton(col1X, pageRowY, pageBtnW, pageBtnH, "< Prev", {
        fontSize: 12,
        disabled: dayCareBroughtPage <= 0,
      });
      drawGlassButton(
        col1X + colW - pageBtnW,
        pageRowY,
        pageBtnW,
        pageBtnH,
        "Next >",
        {
          fontSize: 12,
          disabled: dayCareBroughtPage >= maxBroughtPages - 1,
        },
      );
    }
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#cccccc";
    ctx.fillText(
      `${dayCareBroughtPage + 1} / ${maxBroughtPages}`,
      col1X + colW / 2,
      pageRowY + 17,
    );
  }

  // Col 2 pagination
  if (maxStoredPages > 1) {
    if (typeof drawGlassButton !== "undefined") {
      drawGlassButton(col2X, pageRowY, pageBtnW, pageBtnH, "< Prev", {
        fontSize: 12,
        disabled: dayCareStoredPage <= 0,
      });
      drawGlassButton(
        col2X + colW - pageBtnW,
        pageRowY,
        pageBtnW,
        pageBtnH,
        "Next >",
        {
          fontSize: 12,
          disabled: dayCareStoredPage >= maxStoredPages - 1,
        },
      );
    }
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#cccccc";
    ctx.fillText(
      `${dayCareStoredPage + 1} / ${maxStoredPages}`,
      col2X + colW / 2,
      pageRowY + 17,
    );
  }

  // Close Button coordinates
  const closeBtnW = 140;
  const closeBtnH = 38;
  const closeBtnX = modalX + modalW / 2 - closeBtnW / 2;
  const closeBtnY = modalY + modalH - 52;

  // Close Button
  if (typeof drawGlassButton !== "undefined") {
    drawGlassButton(closeBtnX, closeBtnY, closeBtnW, closeBtnH, "Close");
  }
}

function handleDayCareModalClick() {
  if (!dayCareModalOpen) return false;

  const modalW = 760;
  const modalH = 540;
  const modalX = Math.floor(width / 2 - modalW / 2);
  const modalY = Math.floor(height / 2 - modalH / 2);

  const colW = 340;
  const col1X = modalX + 25;
  const col2X = modalX + modalW - colW - 25;
  const colY = modalY + 84;
  const listStartY = colY + 40;
  const itemH = 50;
  const itemGap = 6;
  const PAGE_SIZE = 5;

  const closeBtnW = 140;
  const closeBtnH = 38;
  const closeBtnX = modalX + modalW / 2 - closeBtnW / 2;
  const closeBtnY = modalY + modalH - 52;

  // 1. Close button click
  if (
    isPointInRect(mouse.x, mouse.y, closeBtnX, closeBtnY, closeBtnW, closeBtnH)
  ) {
    dayCareModalOpen = false;
    return true;
  }

  const broughtFluffies = fluffies.filter(
    (f) => f.scene === "DAY_CARE" && f.adopted && f.isAlive,
  );
  const maxBroughtPages = Math.max(
    1,
    Math.ceil(broughtFluffies.length / PAGE_SIZE),
  );
  const maxStoredPages = Math.max(
    1,
    Math.ceil(dayCareFluffies.length / PAGE_SIZE),
  );

  const pageRowY = listStartY + PAGE_SIZE * (itemH + itemGap) + 4;
  const pageBtnW = 68;
  const pageBtnH = 26;

  // 2. Col 1 Pagination
  if (maxBroughtPages > 1) {
    if (isPointInRect(mouse.x, mouse.y, col1X, pageRowY, pageBtnW, pageBtnH)) {
      if (dayCareBroughtPage > 0) dayCareBroughtPage--;
      return true;
    }
    if (
      isPointInRect(
        mouse.x,
        mouse.y,
        col1X + colW - pageBtnW,
        pageRowY,
        pageBtnW,
        pageBtnH,
      )
    ) {
      if (dayCareBroughtPage < maxBroughtPages - 1) dayCareBroughtPage++;
      return true;
    }
  }

  // 3. Col 2 Pagination
  if (maxStoredPages > 1) {
    if (isPointInRect(mouse.x, mouse.y, col2X, pageRowY, pageBtnW, pageBtnH)) {
      if (dayCareStoredPage > 0) dayCareStoredPage--;
      return true;
    }
    if (
      isPointInRect(
        mouse.x,
        mouse.y,
        col2X + colW - pageBtnW,
        pageRowY,
        pageBtnW,
        pageBtnH,
      )
    ) {
      if (dayCareStoredPage < maxStoredPages - 1) dayCareStoredPage++;
      return true;
    }
  }

  // 4. Col 1 Item Click (Brought -> Day Care)
  const startBroughtIdx = dayCareBroughtPage * PAGE_SIZE;
  for (let i = 0; i < PAGE_SIZE; i++) {
    const idx = startBroughtIdx + i;
    if (idx >= broughtFluffies.length) break;
    const itemY = listStartY + i * (itemH + itemGap);
    if (isPointInRect(mouse.x, mouse.y, col1X, itemY, colW, itemH)) {
      if (!showDebugMenu && money < DAY_CARE_MOVE_COST) {
        if (typeof addUIMessage !== "undefined") {
          addUIMessage(
            `Not enough money! Requires $${DAY_CARE_MOVE_COST.toLocaleString()}.`,
          );
        }
        return true;
      }
      const f = broughtFluffies[idx];
      if (!f.adopted) {
        if (typeof addUIMessage !== "undefined") {
          addUIMessage("Only adopted fluffies can be placed in day care!");
        }
        return true;
      }

      // Detach any attachments/dragging
      if (f.isDragging) {
        isGlobalDragging = false;
        f.isDragging = false;
      }
      if (f.currentCage) f.currentCage = null;
      if (f.claimedBed) f.claimedBed = null;
      if (f.placedOn) f.placedOn = null;

      // Remove from world
      const fIndex = fluffies.indexOf(f);
      if (fIndex !== -1) fluffies.splice(fIndex, 1);

      // Serialize & store
      const data = f.serialize();
      data.type = f.type;
      data.hunger = 1.0;
      data.happiness = 0.5;
      data.scene = "DAY_CARE";
      data.bodyColor = f.colors && f.colors.body ? f.colors.body : "#ffffff";
      data.name =
        typeof fluffyNames !== "undefined" && fluffyNames[f.id]
          ? fluffyNames[f.id]
          : "Fluffy";
      dayCareFluffies.push(data);

      if (!showDebugMenu) {
        money = Math.max(0, money - DAY_CARE_MOVE_COST);
      }

      if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
        poofs.push(new Poof(f.x, f.y, "DAY_CARE"));
      }

      if (typeof addUIMessage !== "undefined") {
        addUIMessage(
          `Placed ${data.name} into Day Care (-$${DAY_CARE_MOVE_COST.toLocaleString()})`,
        );
      }
      return true;
    }
  }

  // 5. Col 2 Item Click (Day Care -> Brought)
  const startStoredIdx = dayCareStoredPage * PAGE_SIZE;
  for (let i = 0; i < PAGE_SIZE; i++) {
    const idx = startStoredIdx + i;
    if (idx >= dayCareFluffies.length) break;
    const itemY = listStartY + i * (itemH + itemGap);
    if (isPointInRect(mouse.x, mouse.y, col2X, itemY, colW, itemH)) {
      if (!showDebugMenu && money < DAY_CARE_MOVE_COST) {
        if (typeof addUIMessage !== "undefined") {
          addUIMessage(
            `Not enough money! Requires $${DAY_CARE_MOVE_COST.toLocaleString()}.`,
          );
        }
        return true;
      }

      const data = dayCareFluffies.splice(idx, 1)[0];
      data.hunger = 1.0;
      data.happiness = 0.5;
      data.scene = "DAY_CARE";
      data.x = width / 2 + (Math.random() * 80 - 40);
      const desk = objects.find(
        (o) =>
          typeof DayCareDesk !== "undefined" &&
          o instanceof DayCareDesk &&
          o.scene === "DAY_CARE",
      );
      data.y = desk ? desk.y + 40 + Math.random() * 30 : height * 0.15 + 200;

      const horse = Horse.deserialize(data);
      horse.hunger = 1.0;
      horse.happiness = 0.5;
      horse.scene = "DAY_CARE";
      horse.adopted = true;
      fluffies.push(horse);

      if (typeof fluffyNames !== "undefined" && data.name) {
        fluffyNames[horse.id] = data.name;
      }

      if (!showDebugMenu) {
        money = Math.max(0, money - DAY_CARE_MOVE_COST);
      }

      if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
        poofs.push(new Poof(horse.x, horse.y, "DAY_CARE"));
      }

      const hName =
        typeof fluffyNames !== "undefined" && fluffyNames[horse.id]
          ? fluffyNames[horse.id]
          : "Fluffy";
      if (typeof addUIMessage !== "undefined") {
        addUIMessage(
          `Retrieved ${hName} from Day Care (-$${DAY_CARE_MOVE_COST.toLocaleString()})`,
        );
      }
      return true;
    }
  }

  // 6. Absorb click within modal
  if (isPointInRect(mouse.x, mouse.y, modalX, modalY, modalW, modalH)) {
    return true;
  }

  // 7. Click outside closes modal
  dayCareModalOpen = false;
  return true;
}

function sellModeClick() {
  if (mouse.rightDown || !isShiftPressed || dayCareModalOpen) return false;
  // Find best Item (Highest Y = Front-most) - see ItemRegistry.js
  let bestItem = null;
  let maxY = -Infinity;
  let bestType = null;
  let bestEntry = null;

  const sellable = findSellableItemAt(mouse.x, mouse.y);
  if (sellable) {
    bestItem = sellable.item;
    bestEntry = sellable.entry;
    bestType = sellable.entry.sellType;
    maxY = bestItem.getBottomY();
  }

  // Check Fluffies
  for (const f of fluffies) {
    if (f.scene !== currentScene) continue;
    if (f.hitTest(mouse.x, mouse.y)) {
      const y = f.getBottomY();
      if (y > maxY) {
        maxY = y;
        bestItem = f;
        bestType = "fluffy";
      }
    }
  }

  if (bestItem) {
    if (bestType === "fluffy") {
      const accKeys = Object.keys(bestItem.accessories || {});
      if (accKeys.length > 0) {
        // Remove one accessory (the first one found)
        const slotToRemove = accKeys[0];
        const accData = bestItem.accessories[slotToRemove];
        delete bestItem.accessories[slotToRemove];

        // Spawn the accessory back into the world
        const droppedAcc = new AccessoryItem(currentScene, accData.id);
        droppedAcc.x = bestItem.x;
        droppedAcc.y = bestItem.y - 20;
        droppedAcc.color = accData.color;
        objects.push(droppedAcc);

        if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
          poofs.push(new Poof(droppedAcc.x, droppedAcc.y, currentScene));
        }

        if (typeof shiftSellBlocked !== "undefined") {
          shiftSellBlocked = true;
        }

        return true; // Stop here, don't sell the fluffy
      } else if (typeof shiftSellBlocked !== "undefined" && shiftSellBlocked) {
        return true; // Block selling, eat click
      } else if (!bestItem.canBeSold()) {
        return; // Can't sell unadopted fluffies, corpses, or equipped fluffies
      } else if (!getSceneConfig(currentScene).insidePlayerQuarters) {
        return true; // Must be inside player quarters to sell fluffies
      }
    }

    if (bestType !== "fluffy") {
      if (!getSceneConfig(currentScene).insidePlayerQuarters) return true;
      const idx = objects.indexOf(bestItem);
      if (idx > -1) objects.splice(idx, 1);
    }

    const moneyBeforeSell = showDebugMenu ? money : null;

    if (bestType !== "fluffy" && bestEntry) {
      // Items: price and any clean-up come from ItemRegistry.js
      if (bestItem.isDragging) isGlobalDragging = false;
      money += getItemSellValue(bestItem, bestEntry);
      if (bestEntry.onSell) bestEntry.onSell(bestItem);
      poofs.push(new Poof(bestItem.x, bestItem.y - 20, bestItem.scene));
    } else if (bestType === "fluffy") {
      if (bestItem.isDragging) isGlobalDragging = false;
      money += Math.floor(bestItem.calculatePrice() / 2);
      if (typeof noteFluffyLeft === "function") noteFluffyLeft(bestItem, "sold");
      poofs.push(new Poof(bestItem.x, bestItem.y, bestItem.scene));
      const idx = fluffies.indexOf(bestItem);
      if (idx > -1) fluffies.splice(idx, 1);
    }

    if (
      typeof removeToolFromToolbox === "function" &&
      typeof isToolObject === "function" &&
      isToolObject(bestItem)
    ) {
      removeToolFromToolbox(bestItem);
    }

    if (moneyBeforeSell !== null) money = moneyBeforeSell;
    return true; // Handled
  }

  return false;
}

function wrapChatText(ctx, namePrefix, text, maxWidth) {
  ctx.font = "12px Arial";
  const paragraphs = text.split("\n");
  const lines = [];

  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p];
    const lineText = p === 0 ? namePrefix + para : "  " + para;
    const words = lineText.split(" ");
    let currentLine = "";

    for (let w = 0; w < words.length; w++) {
      const testLine = currentLine ? currentLine + " " + words[w] : words[w];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine !== "") {
        lines.push(currentLine);
        currentLine = words[w];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  return lines.length > 0 ? lines : [namePrefix + text];
}

function handleChatLogScroll(deltaY) {
  if (!showChatLog) return;
  const panelX = 10;
  const panelY = 85;
  const panelW = 320;
  const panelH = 190;

  if (
    typeof mouse !== "undefined" &&
    mouse.x >= panelX &&
    mouse.x <= panelX + panelW &&
    mouse.y >= panelY &&
    mouse.y <= panelY + panelH
  ) {
    const scrollAmount = Math.sign(deltaY) * 24;
    chatLogScrollOffset += scrollAmount;

    if (scrollAmount < 0) {
      chatLogAutoScroll = false;
    }

    const logs = sceneChatLogs[currentScene] || [];
    const canvas = document.getElementById("canvas");
    const tempCtx = canvas ? canvas.getContext("2d") : null;
    if (tempCtx) {
      tempCtx.font = "12px Arial";
      let totalHeight = 0;
      const clipW = panelW - 24;
      for (let i = 0; i < logs.length; i++) {
        const entry = logs[i];
        const lines = wrapChatText(
          tempCtx,
          `${entry.name}: `,
          entry.text,
          clipW - 8,
        );
        totalHeight += lines.length * 16 + 6;
      }
      const clipH = panelH - 16;
      const maxScroll = Math.max(0, totalHeight - clipH);
      if (chatLogScrollOffset >= maxScroll - 2) {
        chatLogAutoScroll = true;
      }
      chatLogScrollOffset = Math.min(
        Math.max(0, chatLogScrollOffset),
        maxScroll,
      );
    }
  }
}

function drawChatLogPanel(ctx, panelY) {
  const panelX = 10;
  const panelW = 320;
  const panelH = 190;

  drawGlassButton(panelX, panelY, panelW, panelH, "", {
    borderRadius: 10,
    forceNormal: true,
  });

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Content Clip Area
  const clipX = panelX + 8;
  const clipY = panelY + 8;
  const clipW = panelW - 24;
  const clipH = panelH - 16;

  ctx.beginPath();
  ctx.rect(clipX, clipY, clipW + 4, clipH);
  ctx.clip();

  const logs = sceneChatLogs[currentScene] || [];

  if (logs.length === 0) {
    ctx.font = "italic 12px Arial";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText("No messages in this scene.", clipX + 4, clipY + 4);
  } else {
    ctx.font = "12px Arial";
    const lineHeight = 16;
    const msgPadding = 6;
    const formattedEntries = [];

    let totalHeight = 0;
    for (let i = 0; i < logs.length; i++) {
      const entry = logs[i];
      const namePrefix = `${entry.name}: `;
      const lines = wrapChatText(ctx, namePrefix, entry.text, clipW - 8);
      formattedEntries.push({ name: entry.name, lines, color: entry.color });
      totalHeight += lines.length * lineHeight + msgPadding;
    }

    const maxScroll = Math.max(0, totalHeight - clipH);

    if (chatLogAutoScroll) {
      chatLogScrollOffset = maxScroll;
    } else {
      chatLogScrollOffset = Math.min(
        Math.max(0, chatLogScrollOffset),
        maxScroll,
      );
    }

    let currY = clipY - chatLogScrollOffset;

    for (let i = 0; i < formattedEntries.length; i++) {
      const item = formattedEntries[i];
      const msgHeight = item.lines.length * lineHeight + msgPadding;

      if (currY + msgHeight >= clipY && currY <= clipY + clipH) {
        for (let l = 0; l < item.lines.length; l++) {
          const lineY = currY + l * lineHeight;
          if (lineY >= clipY - lineHeight && lineY <= clipY + clipH) {
            const line = item.lines[l];
            if (l === 0) {
              const prefix = `${item.name}: `;
              ctx.font = "bold 12px Arial";
              ctx.fillStyle = item.color || "#66d9ff";
              ctx.fillText(prefix, clipX + 4, lineY);

              const nameWidth = ctx.measureText(prefix).width;
              ctx.font = "12px Arial";
              ctx.fillStyle = "#ffffff";
              ctx.fillText(
                line.substring(prefix.length),
                clipX + 4 + nameWidth,
                lineY,
              );
            } else {
              ctx.font = "12px Arial";
              ctx.fillStyle = "#ffffff";
              ctx.fillText(line, clipX + 16, lineY);
            }
          }
        }
      }
      currY += msgHeight;
    }

    if (totalHeight > clipH) {
      ctx.restore();
      ctx.save();
      const trackX = panelX + panelW - 10;
      const trackY = clipY;
      const trackH = clipH;

      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(trackX, trackY, 4, trackH);

      const thumbH = Math.max(15, (clipH / totalHeight) * trackH);
      const thumbY =
        trackY + (chatLogScrollOffset / maxScroll) * (trackH - thumbH);

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(trackX, thumbY, 4, thumbH);
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Buying something from the shop list (SPAWN_ACTIONS in globals.js).
// Used by the store shelves (Store.js) and the debug-mode item menu.
//   Tools go into the toolbox. World items are made at (sx, sy) in the
//   current scene (options.exactSpot: even items that normally appear in
//   the middle of the room). Returns the thing bought, or null.
//   With the debug menu on, everything is free.
// ---------------------------------------------------------------------------
function buyShopAction(action, sx, sy, options = {}) {
  const free = showDebugMenu;
  const say = (msg) => {
    if (options.quiet !== true && typeof addUIMessage === "function")
      addUIMessage(msg);
  };

  if (typeof isToolAction === "function" && isToolAction(action)) {
    if (typeof isToolAlreadyOwned === "function" && isToolAlreadyOwned(action)) {
      say("You already own this tool.");
      return null;
    }
    if (!free && money < action.cost) {
      say("Not enough money!");
      return null;
    }
    const tool = createToolFromAction(action);
    if (!tool) return null;
    if (!free) money -= action.cost;
    addToolToToolbox(tool);
    return tool;
  }

  if (!free && money < action.cost) {
    say("Not enough money!");
    return null;
  }

  // World items are described in ItemRegistry.js
  const itemType = getItemTypeForAction(action);
  if (itemType) {
    if (!free) money -= action.cost;
    const obj = itemType.create(action, sx, sy);
    objects.push(obj);
    if (itemType.afterCreate) itemType.afterCreate(obj);
    // Some items normally appear in the middle of the room; the store wants
    // everything at (sx, sy) on the floor (unless it's stuck to the mouse)
    if (options.exactSpot && !obj.isDragging) {
      if (typeof obj.setPosition === "function") obj.setPosition(sx, sy);
      else {
        obj.x = sx;
        obj.y = sy;
      }
    }
    const px = itemType.poofAtMouse ? mouse.x : obj.x;
    const py = itemType.poofAtMouse ? mouse.y : obj.y;
    poofs.push(new Poof(px, py, currentScene));
    return obj;
  }

  // Anything else in the shop is a fluffy
  if (!free) money -= action.cost;
  const h = new Horse(action.growth, null, currentScene, action.type);
  h.x = sx;
  h.y = sy;
  fluffies.push(h);
  poofs.push(new Poof(sx, sy, currentScene));
  return h;
}

// The item menu in the top left is only for the debug menu now; in normal
// play things are bought at the store (Store.js).
function isItemMenuAvailable() {
  return showDebugMenu;
}

// Shop picture for an action, centred on (cx, cy), fitting in a box
// size wide and sizeH tall (square if sizeH is left out)
function drawShopActionIcon(c, action, cx, cy, size, disabled = false, sizeH = size) {
  const shopIcon = getShopIcon(action);
  const imgKey = shopIcon.imageKey;
  c.save();
  if (disabled) c.globalAlpha = 0.3;
  if (
    imgKey &&
    typeof images !== "undefined" &&
    images[imgKey] &&
    images[imgKey].complete &&
    images[imgKey].width > 0
  ) {
    const img = images[imgKey];
    const scale = Math.min(size / img.width, sizeH / img.height);
    c.translate(cx, cy);
    c.scale(scale, scale);
    c.drawImage(img, -img.width / 2, -img.height / 2);
  } else {
    // Drawn icons are made for a 40px button (about 30px across)
    c.translate(cx, cy);
    const k = Math.min(size, sizeH) / 30;
    c.scale(k, k);
    if (shopIcon.draw) shopIcon.draw(c, 40);
    else buyMenuSprite(c, action, 40);
  }
  c.restore();
}

// The description + price box shown when hovering a shop item
function drawShopTooltip(c, action, extraLines = []) {
  c.font = "bold 12px Arial";
  const padding = 10;
  const maxTextWidth = 250;
  const lines = wrapText(c, action.desc || action.name, maxTextWidth);
  if (typeof isToolAlreadyOwned === "function" && isToolAlreadyOwned(action)) {
    lines.push("(Already owned)");
  }
  lines.push(...extraLines);

  let descWidth = 0;
  lines.forEach((line) => {
    descWidth = Math.max(descWidth, c.measureText(line).width);
  });

  const costText = `Cost: $${action.cost}`;
  const costWidth = c.measureText(costText).width;
  const textWidth = Math.max(descWidth, costWidth);

  const lineHeight = 16;
  const tw = textWidth + padding * 2;
  const th = lines.length * lineHeight + 40;
  const tx = clamp(mouse.x + 10, 0, width - tw - 10);
  const ty = clamp(mouse.y + 10, 0, height - th - 10);

  drawGlassButton(tx, ty, tw, th, "", {
    forceNormal: true,
    borderRadius: 8,
    normalFill: "rgba(0, 0, 0, 0.5)",
    hoverFill: "rgba(255, 255, 255, 0.75)",
  });

  c.textAlign = "left";
  c.lineWidth = 2;
  c.lineJoin = "round";

  lines.forEach((line, i) => {
    c.strokeStyle = "black";
    c.strokeText(line, tx + padding, ty + 20 + i * lineHeight);
    c.fillStyle = "white";
    c.fillText(line, tx + padding, ty + 20 + i * lineHeight);
  });

  const costY = ty + 20 + lines.length * lineHeight + 10;
  c.strokeStyle = "black";
  c.strokeText(costText, tx + padding, costY);
  c.fillStyle = "gold";
  c.fillText(costText, tx + padding, costY);
}

function actionButtonsClick() {
  const toggleBtnW = 90;
  const toggleBtnH = 30;
  const toggleBtnX = 10;
  const toggleBtnY = 50;

  const menuAvailable = isItemMenuAvailable();
  const chatLogBtnW = 90;
  const chatLogBtnH = 30;
  const chatLogBtnX = menuAvailable ? toggleBtnX + toggleBtnW + 5 : toggleBtnX;
  const chatLogBtnY = toggleBtnY;

  if (
    menuAvailable &&
    isPointInRect(
      mouse.x,
      mouse.y,
      toggleBtnX,
      toggleBtnY,
      toggleBtnW,
      toggleBtnH,
    )
  ) {
    showActionButtons = !showActionButtons;
    if (showActionButtons) {
      showChatLog = false;
    }
    return true;
  }

  if (
    isPointInRect(
      mouse.x,
      mouse.y,
      chatLogBtnX,
      chatLogBtnY,
      chatLogBtnW,
      chatLogBtnH,
    )
  ) {
    if (showChatLog) {
      showChatLog = false;
    } else {
      showActionButtons = false;
      showChatLog = true;
      chatLogAutoScroll = true;
    }
    return true;
  }

  if (showChatLog) {
    const panelX = 10;
    const panelY = toggleBtnY + toggleBtnH + 5;
    const panelW = 320;
    const panelH = 190;
    if (isPointInRect(mouse.x, mouse.y, panelX, panelY, panelW, panelH)) {
      return true;
    }
  }

  if (showActionButtons && menuAvailable) {
    // Check Filter Button click
    const filterBtnW = 200;
    const filterBtnH = 30;
    const filterBtnX = 10;
    const filterBtnY = toggleBtnY + toggleBtnH + 5;

    if (
      isPointInRect(
        mouse.x,
        mouse.y,
        filterBtnX,
        filterBtnY,
        filterBtnW,
        filterBtnH,
      )
    ) {
      const input = prompt(
        "Enter filter text (leave empty to clear):",
        itemMenuFilter,
      );
      if (input !== null) {
        itemMenuFilter = input.trim();
        itemMenuPage = 0;
      }
      return true;
    }

    const btnSize = 40;
    const btnPadding = 5;
    const startX = 10;
    const startY = filterBtnY + filterBtnH + btnPadding;
    const cols = 7;

    const filteredActions = itemMenuFilter
      ? SPAWN_ACTIONS.filter((a) =>
          a.name.toLowerCase().startsWith(itemMenuFilter.toLowerCase()),
        )
      : SPAWN_ACTIONS;

    const pages = [];
    let itemsToPlace = [...filteredActions];

    while (itemsToPlace.length > 0) {
      let isFirstPage = pages.length === 0;
      let itemsAllowed = 21;

      if (!isFirstPage) itemsAllowed -= 1; // Prev
      if (itemsToPlace.length > itemsAllowed) itemsAllowed -= 1; // Next

      const pageContent = itemsToPlace.splice(0, itemsAllowed);

      let pageSlots = [];
      if (!isFirstPage) pageSlots.push({ isNav: true, dir: -1, name: "⬅" });
      pageSlots.push(...pageContent);
      if (itemsToPlace.length > 0)
        pageSlots.push({ isNav: true, dir: 1, name: "➡" });

      pages.push(pageSlots);
    }
    if (pages.length === 0) pages.push([]);
    if (itemMenuPage >= pages.length)
      itemMenuPage = Math.max(0, pages.length - 1);

    const currentSlots = pages[itemMenuPage];

    for (let i = 0; i < currentSlots.length; i++) {
      const action = currentSlots[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = startX + col * (btnSize + btnPadding);
      const by = startY + row * (btnSize + btnPadding);

      if (isPointInRect(mouse.x, mouse.y, bx, by, btnSize, btnSize)) {
        if (action.isNav) {
          itemMenuPage += action.dir;
          return true;
        }

        const sx = width / 2 + (Math.random() - 0.5) * 200;
        const sy = height / 2 + (Math.random() - 0.5) * 100;
        buyShopAction(action, sx, sy);
        return true;
      }
    }
  }
  return false;
}

// Input State - Door Interaction
// Use 'mousedown' on canvas to detect clicks, mouse pos is already updated by globals
canvas.addEventListener("mousedown", (e) => {
  resumeAudioContext();

  if (gameState === "TITLE") {
    handleTitleScreenClick();
    return;
  }

  if (gameState === "PAUSED") {
    handlePauseMenuClick();
    return;
  }

  if (typeof handleFamilyTreeClick === "function" && handleFamilyTreeClick()) {
    return;
  }

  if (typeof handleGeneLabClick === "function" && handleGeneLabClick()) {
    return;
  }

  if (typeof handleOrdersScreenClick === "function" && handleOrdersScreenClick()) {
    return;
  }

  if (handleInspectionModalClick()) {
    return;
  }

  if (handleDayCareModalClick()) {
    return;
  }

  // Sell Request Accept/Reject (checked first so it is never blocked by other UI)
  if (currentSellRequest && getSceneConfig(currentScene).insidePlayerQuarters) {
    const _srW = 300,
      _srH = 160,
      _srMargin = 10;
    const _srX = _srMargin;
    const _srY = getSellRequestY();
    const _btnW = 80,
      _btnH = 30;
    const _btnY = _srY + _srH - 40;
    const _acceptX = _srX + _srW / 2 - 85;
    const _rejectX = _srX + _srW / 2 + 5;
    if (isPointInRect(mouse.x, mouse.y, _acceptX, _btnY, _btnW, _btnH)) {
      const victimIdx = fluffies.findIndex(
        (f) => f.id === currentSellRequest.fluffyId,
      );
      if (victimIdx > -1) {
        if (!showDebugMenu) money += currentSellRequest.price;
        if (typeof noteFluffyLeft === "function") noteFluffyLeft(fluffies[victimIdx], "sold");
        fluffies.splice(victimIdx, 1);
      }
      currentSellRequest = null;
      return;
    }
    if (isPointInRect(mouse.x, mouse.y, _rejectX, _btnY, _btnW, _btnH)) {
      currentSellRequest = null;
      return;
    }
  }

  // Toolbox and Toolbar Click
  if (toolboxAndToolbarClick()) {
    return;
  }

  // 0. Check Sell Mode (Shift Click)
  if (sellModeClick()) {
    return;
  }

  // 1. If already dragging something, drop it

  if (attemptDrop()) {
    return;
  }

  // 2. Check Action Buttons
  if (actionButtonsClick()) {
    return;
  }

  if (handleDebugWatcherMousedown()) {
    return;
  }

  if (debugMenuClick()) {
    return;
  }

  // Buying from a store shelf (Store.js)
  if (typeof storeShelfClick === "function" && storeShelfClick()) {
    return;
  }

  // The bounty board on Shopping Street (OrderBoard.js)
  if (typeof bountyBoardClick === "function" && bountyBoardClick()) {
    return;
  }

  // 3. Check Sell Request Click
  if (currentSellRequest && getSceneConfig(currentScene).insidePlayerQuarters) {
    const w = 300;
    const h = 160;
    const margin = 10;
    const x = margin;
    const y = height - margin - h;

    const btnW = 80;
    const btnH = 30;
    const btnY = y + h - 40;
    const acceptX = x + w / 2 - 85;
    const rejectX = x + w / 2 + 5;

    // Check Accept
    if (isPointInRect(mouse.x, mouse.y, acceptX, btnY, btnW, btnH)) {
      const victimIdx = fluffies.findIndex(
        (f) => f.id === currentSellRequest.fluffyId,
      );
      if (victimIdx > -1) {
        if (!showDebugMenu) money += currentSellRequest.price;
        if (typeof noteFluffyLeft === "function") noteFluffyLeft(fluffies[victimIdx], "sold");
        fluffies.splice(victimIdx, 1);
        currentSellRequest = null;
        return;
      }
    }
    // Check Reject
    if (isPointInRect(mouse.x, mouse.y, rejectX, btnY, btnW, btnH)) {
      currentSellRequest = null;
      return;
    }
  }

  // 3. Right Click: each item's right-click action is in ItemRegistry.js
  // (cage tags, TV channels, sprinkler on/off, gates, turning fences...)
  if (mouse.rightDown) {
    if (handleItemRightClick(mouse.x, mouse.y)) {
      mouse.rightDown = false; // only once per click
      return;
    }
  }

  if (mouse.rightDown) {
    return;
  }

  // 4. Try picking up something
  // Check if any IVStand is in connecting mode
  let connectingStand = null;
  for (const obj of objects) {
    if (obj instanceof IVStand && obj.isConnecting) {
      connectingStand = obj;
      break;
    }
  }

  // Check for IVStand top click
  for (const obj of objects) {
    if (
      obj instanceof IVStand &&
      obj.scene === currentScene &&
      obj.hitTestTop(mouse.x, mouse.y)
    ) {
      if (isGlobalDragging) return; // Cannot start connection while dragging

      if (obj.attachedBag) {
        obj.isConnecting = !obj.isConnecting;
        // Clear other stands
        for (const other of objects) {
          if (other !== obj && other instanceof IVStand)
            other.isConnecting = false;
        }
      } else {
        // Cannot connect without a bag
        addUIMessage("IV Stand requires an IV Bag to start connection.");
      }
      return;
    }
  }

  // Debug menu fluffy click intercept
  if (debugMenuAction && !mouse.rightDown && !isGlobalDragging) {
    for (let i = fluffies.length - 1; i >= 0; i--) {
      const f = fluffies[i];
      if (f.scene !== currentScene) continue;
      if (f.hitTest(mouse.x, mouse.y)) {
        applyDebugAction(f);
        return;
      }
    }
  }

  // Check Fluffies
  for (let i = fluffies.length - 1; i >= 0; i--) {
    const f = fluffies[i];
    if (f.scene !== currentScene) {
      continue;
    }
    if (f.currentCage && f.currentCage instanceof FoalInACan) {
      continue;
    }
    const hitPart = f.hitTest(mouse.x, mouse.y);
    if (!hitPart) {
      continue;
    }
    if (connectingStand) {
      const top = connectingStand.getTopPoint();
      const dx = f.x - top.x;
      const dy = f.y - 10 - top.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= connectingStand.maxCordLength) {
        connectingStand.connectedFluffy = f;
        connectingStand.isConnecting = false;
      }
      return;
    }

    f.grabbedPart = hitPart;

    if (f.tooYoungToWalk() && f.isAlive) {
      f.speak(getDialogue("BABY_PEEP", f), false, true);
      // Notify mother
      const mom = fluffies.find(
        (m) => m.id === f.motherId && m.scene === f.scene && m.isAlive,
      );
      if (
        mom &&
        mom.canSee() &&
        relationships[mom.id][f.id] !== "estranged_child"
      ) {
        mom.setShock(3.0);
        mom.changeHappiness(HAPPINESS_PENALTY_BABBEH_GRABBED);
        mom.speak(
          getDialogue(
            mom.adopted
              ? ["UPSIES", "WITNESS_BABY"]
              : ["UPSIES", "WITNESS_BABY", "FERAL"],
            mom,
          ),
        );
        let targetX = f.x + (Math.random() - 0.5) * 100;
        let targetY = f.y + (Math.random() - 0.5) * 50;
        mom.setTargetPosition(targetX, targetY);
        mom.initBehavior("MOVING");
      }
    } else if (hitPart === "torso") {
      let key = f.adopted ? ["UPSIES"] : ["UPSIES", "FERAL"];
      f.speak(getDialogue(key, f));
      if (f.happiness > WAN_DIE_THRESHOLD) {
        f.changeHappiness(HAPPINESS_BONUS_UPSIES);
        f.expressionOverride = "GOOD_UPSIES";
        f.expressionOverrideTimer = 2.0;
      }
    } else {
      let key = f.adopted ? ["UPSIES", "BAD"] : ["UPSIES", "BAD", "FERAL"];
      f.speak(getDialogue(key, f));
      f.changeHappiness(HAPPINESS_PENALTY_BAD_UPSIES);
      f.expressionOverride = null;
      f.expressionOverrideTimer = 0;
    }
    if (f.grabbedPart !== "torso") {
      f.anim.bodyAngle = 0;
    }
    f.interruptMating();

    cancelPendingConnections();
    f.isDragging = true;
    // Scared fluffies panic, trusting ones like it (Memory.js)
    if (typeof onFluffyPickedUp === "function") onFluffyPickedUp(f);
    isGlobalDragging = true;
    if (f.placedOn) {
      f.placedOn.releaseFluffy();
      f.placedOn = null;
    }
    f.dragOffset.x = f.x - mouse.x;
    f.dragOffset.y = f.y - mouse.y;
    return;
  }

  let notCages = objects.filter((o) => !(o instanceof Cage));
  let cages = objects.filter((o) => o instanceof Cage);
  let objsToTest = [...cages, ...notCages];
  // Check Objects
  for (let i = objsToTest.length - 1; i >= 0; i--) {
    const obj = objsToTest[i];

    if (obj.scene !== currentScene) continue;

    let bw = 0,
      bh = 0;

    if (obj instanceof FoalVendor) {
      const img = images.foal_vendor;
      let hitVendor = false;
      if (img && img.complete && img.width > 0) {
        bw = img.width;
        bh = img.height;
        hitVendor = isPointInRect(
          mouse.x,
          mouse.y,
          obj.x - bw / 2,
          obj.y - bh,
          bw,
          bh,
        );
      } else {
        hitVendor = isPointInRect(
          mouse.x,
          mouse.y,
          obj.x - 40,
          obj.y - 120,
          80,
          120,
        );
      }
      if (hitVendor) {
        const cost = 250;
        if (showDebugMenu || money >= cost) {
          if (!showDebugMenu) money -= cost;

          const can = new FoalInACan(obj.scene);
          can.x = obj.x;
          can.y = obj.y + 70;
          objects.push(can);

          const r = Math.random();
          let spawnType = "earthy";
          if (r < 0.05) spawnType = "alicorn";
          else if (r < 0.35) spawnType = "unicorn";
          else if (r < 0.65) spawnType = "pegasus";
          else spawnType = "earthy";

          const baby = new Horse(0.0, null, obj.scene, spawnType);
          baby.x = can.x;
          baby.y = can.y - 3;
          baby.currentCage = can;
          baby.personalities = ["mill_baby"];
          fluffies.push(baby);

          if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
            poofs.push(new Poof(can.x, can.y - 20, obj.scene, "green"));
          }

          addUIMessage("Purchased foal-in-a-can!");
        } else {
          addUIMessage("Not enough money!");
        }
        return;
      }
    }

    if (typeof DayCareDesk !== "undefined" && obj instanceof DayCareDesk) {
      if (obj.hitTest(mouse.x, mouse.y)) {
        dayCareModalOpen = true;
        dayCareBroughtPage = 0;
        dayCareStoredPage = 0;
        return;
      }
      continue;
    }

    // Is the click on this item, and can it be picked up? (ItemRegistry.js)
    const hit = itemCanBePickedUpAt(obj, mouse.x, mouse.y);

    if (hit) {
      if (
        (typeof Thumbtack !== "undefined" && obj instanceof Thumbtack) ||
        (typeof IVBag !== "undefined" &&
          obj instanceof IVBag &&
          !obj.attachedTo)
      ) {
        if (typeof addToolToToolbox === "function") {
          addToolToToolbox(obj);
        }
        if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
          poofs.push(new Poof(obj.x, obj.y, currentScene));
        }
        return;
      }

      cancelPendingConnections();
      obj.isDragging = true;
      isGlobalDragging = true;
      let img = null;
      if (obj instanceof Knife) img = images.knife;
      else if (obj instanceof SutureKit) img = images.suture_kit;
      else if (typeof TrashBag !== "undefined" && obj instanceof TrashBag)
        img = obj.getCurrentImage();
      else if (obj instanceof Sponge) img = images.sponge;
      else if (obj instanceof SorryStick) img = images.sorry_stick;
      else if (obj instanceof SprayBottle) img = images.spray_bottle;
      else if (obj instanceof Brush) img = images.brush;
      else if (obj instanceof MagnifyingGlass) img = images.magnifying_glass;
      else if (typeof Thumbtack !== "undefined" && obj instanceof Thumbtack)
        img = images.thumbtack;
      else if (typeof Syringe !== "undefined" && obj instanceof Syringe)
        img = images.syringe;
      else if (typeof CattleProd !== "undefined" && obj instanceof CattleProd)
        img = images.cattle_prod;

      if (
        (typeof Thumbtack !== "undefined" && obj instanceof Thumbtack) ||
        (typeof Syringe !== "undefined" && obj instanceof Syringe) ||
        (typeof CattleProd !== "undefined" && obj instanceof CattleProd)
      ) {
        obj.dragOffset.x = 0;
        obj.dragOffset.y = 0;
      } else if (img) {
        obj.dragOffset.x = 0;
        obj.dragOffset.y = img ? img.height * 0.2 : 0;
      } else {
        obj.dragOffset.x = obj.x - mouse.x;
        obj.dragOffset.y = obj.y - mouse.y;
      }

      return;
    }
  }

  // Check Gibs
  for (const gib of gibs) {
    if (gib.scene !== currentScene) continue;
    if (!gib.freeGib) {
      continue;
    }
    if (gib.hitTest(mouse.x, mouse.y)) {
      cancelPendingConnections();
      gib.isDragging = true;
      isGlobalDragging = true;
      gib.dragOffset.x = gib.x - mouse.x;
      gib.dragOffset.y = gib.y - mouse.y;
      return;
    }
  }

  // Check Backyard Fence Click
  if (currentScene === "BACKYARD") {
    const fenceImg =
      images[
        backyardFenceTier === 0
          ? "crummy_fence_post"
          : backyardFenceTier === 1
            ? "fence_post"
            : "reinforced_fence_post"
      ];
    const postH =
      fenceImg && fenceImg.complete && fenceImg.width > 0
        ? fenceImg.height
        : 120;

    if (mouse.y >= height - postH && mouse.y <= height) {
      if (backyardFenceBroken) {
        const repairCost =
          backyardFenceTier === 0 ? 500 : backyardFenceTier === 1 ? 5000 : 0;
        if (showDebugMenu || money >= repairCost) {
          if (!showDebugMenu) money -= repairCost;
          backyardFenceBroken = false;
          backyardFenceBreakTimer =
            backyardFenceTier === 0
              ? 120.0
              : backyardFenceTier === 1
                ? 600.0
                : 120.0;
          addUIMessage("Fence repaired!");

          // Spawn poof particles on each fence
          const postW =
            fenceImg && fenceImg.complete && fenceImg.width > 0
              ? fenceImg.width
              : 40;
          const startX = (width - postW) / 2;
          const step = postW - 1;

          // Poofs to the right
          for (let x = startX; x < width; x += step) {
            if (typeof Poof !== "undefined" && typeof poofs !== "undefined") {
              poofs.push(
                new Poof(
                  x + postW / 2,
                  height - postH / 2,
                  "BACKYARD",
                  "green",
                ),
              );
            }
          }
          // Poofs to the left
          for (let x = startX - step; x + postW > 0; x -= step) {
            if (typeof Poof !== "undefined" && typeof poofs !== "undefined") {
              poofs.push(
                new Poof(
                  x + postW / 2,
                  height - postH / 2,
                  "BACKYARD",
                  "green",
                ),
              );
            }
          }
        } else {
          addUIMessage("Not enough money to repair!");
        }
      } else if (backyardFenceTier < 2) {
        const cost = backyardFenceTier === 0 ? 150000 : 300000;
        if (showDebugMenu || money >= cost) {
          if (!showDebugMenu) money -= cost;
          backyardFenceTier++;
          backyardFenceBreakTimer =
            backyardFenceTier === 0
              ? 120.0
              : backyardFenceTier === 1
                ? 600.0
                : 120.0;
          addUIMessage("Fence upgraded!");

          // Spawn poof particles on each fence
          const postW =
            fenceImg && fenceImg.complete && fenceImg.width > 0
              ? fenceImg.width
              : 40;
          const startX = (width - postW) / 2;
          const step = postW - 1;

          // Poofs to the right
          for (let x = startX; x < width; x += step) {
            if (typeof Poof !== "undefined" && typeof poofs !== "undefined") {
              poofs.push(
                new Poof(
                  x + postW / 2,
                  height - postH / 2,
                  "BACKYARD",
                  "green",
                ),
              );
            }
          }
          // Poofs to the left
          for (let x = startX - step; x + postW > 0; x -= step) {
            if (typeof Poof !== "undefined" && typeof poofs !== "undefined") {
              poofs.push(
                new Poof(
                  x + postW / 2,
                  height - postH / 2,
                  "BACKYARD",
                  "green",
                ),
              );
            }
          }
        } else {
          addUIMessage("Not enough money!");
        }
      }
      return;
    }
  }

  // Check Portal Click
  const portals = getScenePortals(currentScene);
  for (const p of portals) {
    if (isPointInRect(mouse.x, mouse.y, p.x, p.y, p.w, p.h)) {
      if (p.locked) {
        if (money >= p.cost) {
          money -= p.cost;
          roomsPurchased++;
          if (p.dir === "L") unlockedRoomsL++;
          else unlockedRoomsR++;
          addUIMessage("New quarters purchased!");
          poofs.push(new Poof(p.x + p.w / 2, p.y + p.h / 2, currentScene));
        } else {
          addUIMessage("Not enough money!");
        }
      } else {
        changeScene(p.target);
      }
      return;
    }
  }
});

window.addEventListener("resize", () => {
  resize();
});

function playerQuartersAndNotBackyard(scene) {
  return getSceneConfig(scene).insidePlayerQuarters && scene !== "BACKYARD";
}

function getScenePortals(scene) {
  const portals = [];

  // The shopping street and store aisles are set up in Store.js
  if (typeof getStorePortals === "function") {
    const storePortals = getStorePortals(scene);
    if (storePortals) return storePortals;
  }

  // Indoor Expansion Logic
  if (scene && playerQuartersAndNotBackyard(scene)) {
    let isMain = scene === "INDOORS";
    let dir = scene.startsWith("INDOORSL")
      ? "L"
      : scene.startsWith("INDOORSR")
        ? "R"
        : "CENTER";
    let depth = isMain ? 0 : parseInt(scene.substring(8));

    // Door to outside only in main room
    if (isMain) {
      portals.push({
        type: "door",
        x: doorRect.x,
        y: doorRect.y,
        w: doorRect.w,
        h: doorRect.h,
        target: "OUTDOORS",
        label: "Click to leave",
      });
      // Down Arrow to Backyard
      portals.push({
        type: "arrow_down",
        x: width / 2 - 40,
        y: height - 80,
        w: 80,
        h: 60,
        target: "BACKYARD",
        label: "To Backyard",
      });
    }

    // Left Arrow
    let leftTarget = null;
    if (dir === "R") {
      leftTarget = depth === 1 ? "INDOORS" : `INDOORSR${depth - 1}`;
    } else {
      leftTarget = `INDOORSL${depth + 1}`;
    }

    const canBuyMore = roomsPurchased < 5;
    const leftUnlocked = dir === "R" || depth < unlockedRoomsL;

    if (leftUnlocked || canBuyMore) {
      const cost = 25000 * (roomsPurchased + 1);
      portals.push({
        type: "arrow_left",
        x: 20,
        y: height / 2 - 40,
        w: 60,
        h: 80,
        target: leftTarget,
        label: leftUnlocked
          ? "To next room"
          : `Purchase new quarters: $${cost}`,
        locked: !leftUnlocked,
        cost: cost,
        dir: "L",
      });
    }

    // Right Arrow
    let rightTarget = null;
    if (dir === "L") {
      rightTarget = depth === 1 ? "INDOORS" : `INDOORSL${depth - 1}`;
    } else {
      rightTarget = `INDOORSR${depth + 1}`;
    }

    const rightUnlocked = dir === "L" || depth < unlockedRoomsR;

    if (rightUnlocked || canBuyMore) {
      const cost = 25000 * (roomsPurchased + 1);
      portals.push({
        type: "arrow_right",
        x: width - 80,
        y: height / 2 - 40,
        w: 60,
        h: 80,
        target: rightTarget,
        label: rightUnlocked
          ? "To next room"
          : `Purchase new quarters: $${cost}`,
        locked: !rightUnlocked,
        cost: cost,
        dir: "R",
      });
    }
  } else if (scene === "OUTDOORS") {
    // Main Door back to Indoors
    portals.push({
      type: "door",
      x: doorRect.x,
      y: doorRect.y,
      w: doorRect.w,
      h: doorRect.h,
      target: "INDOORS",
      label: "Enter industry quarters",
    });
    // Left Arrow -> RIVER
    portals.push({
      type: "arrow_left",
      x: 20,
      y: height / 2 - 40,
      w: 60,
      h: 80,
      target: "RIVER",
      label: "To River",
    });
    // Right Arrow -> ALLEY
    portals.push({
      type: "arrow_right",
      x: width - 80,
      y: height / 2 - 40,
      w: 60,
      h: 80,
      target: "ALLEY",
      label: "To Alley",
    });
    // Down Arrow -> SHOP_STREET (the store, Store.js)
    portals.push({
      type: "arrow_down",
      x: width / 2 - 40,
      y: height - 80,
      w: 80,
      h: 60,
      target: "SHOP_STREET",
      label: "To Shopping Street",
    });
  } else if (scene === "RIVER") {
    // Right Arrow -> OUTDOORS
    portals.push({
      type: "arrow_right",
      x: width - 80,
      y: height / 2 - 40,
      w: 60,
      h: 80,
      target: "OUTDOORS",
      label: "Back to Garden",
    });
  } else if (scene === "ALLEY") {
    // Left Arrow -> OUTDOORS
    portals.push({
      type: "arrow_left",
      x: 20,
      y: height / 2 - 40,
      w: 60,
      h: 80,
      target: "OUTDOORS",
      label: "Back to Garden",
    });
    // Down Arrow -> ALLEY_ROAD
    portals.push({
      type: "arrow_down",
      x: width / 2 - 40,
      y: height - 80,
      w: 80,
      h: 60,
      target: "ALLEY_ROAD",
      label: "To Road",
    });
    // Right Arrow -> ALLEY_DAY_CARE
    portals.push({
      type: "arrow_right",
      x: width - 80,
      y: height / 2 - 40,
      w: 60,
      h: 80,
      target: "ALLEY_DAY_CARE",
      label: "To Day Care Alley",
    });
  } else if (scene === "ALLEY_DAY_CARE") {
    // Main Door to Day Care
    portals.push({
      type: "door",
      x: doorRect.x,
      y: doorRect.y,
      w: doorRect.w,
      h: doorRect.h,
      target: "DAY_CARE",
      label: "Enter day care",
    });
    // Left Arrow -> ALLEY
    portals.push({
      type: "arrow_left",
      x: 20,
      y: height / 2 - 40,
      w: 60,
      h: 80,
      target: "ALLEY",
      label: "Back to Alley",
    });
  } else if (scene === "DAY_CARE") {
    // Down Arrow -> ALLEY_DAY_CARE
    portals.push({
      type: "arrow_down",
      x: width / 2 - 40,
      y: height - 80,
      w: 80,
      h: 60,
      target: "ALLEY_DAY_CARE",
      label: "Return to Alley",
    });
  } else if (scene === "ALLEY_ROAD") {
    // Up Arrow -> ALLEY
    portals.push({
      type: "arrow_up",
      x: width / 2 - 40,
      y: 20,
      w: 80,
      h: 60,
      target: "ALLEY",
      label: "Back to Alley",
    });
  } else if (scene === "BACKYARD") {
    // Up Arrow -> INDOORS
    portals.push({
      type: "arrow_up",
      x: width / 2 - 40,
      y: 20,
      w: 80,
      h: 60,
      target: "INDOORS",
      label: "To Quarters",
    });
  }
  return portals;
}

function drawBackground(c = ctx) {
  const config = getSceneConfig(currentScene);
  const img = images[config.backgroundTexture];
  if (img && img.width > 0) {
    const pattern = c.createPattern(img, "repeat");
    c.fillStyle = pattern;
    c.fillRect(0, 0, width, height);
  }
}

function drawForegroundBackground(ctx) {
  const config = getSceneConfig(currentScene);
  if (config.topWallColor) {
    const topWallH = height * 0.15;
    ctx.fillStyle = config.topWallColor;
    ctx.fillRect(0, 0, width, topWallH);
  }
  if (config.hasRiver) {
    // Draw Lake on left
    ctx.fillStyle = "#1E90FF";
    ctx.fillRect(0, 0, width * 0.25, height);

    // Add some "water" detail
    ctx.fillStyle = "#87CEEB";
    for (const r of waterRipples) {
      ctx.fillRect(r.x, r.y, 10, 2);
    }
  }
}

function drawRoad(ctx) {
  if (currentScene === "ALLEY_ROAD") {
    // Draw asphalt road band
    const roadY = 320;
    const roadH = 260; // from 320 to 580

    // 1. Asphalt body
    ctx.fillStyle = "#2d2d2d";
    ctx.fillRect(0, roadY, width, roadH);

    // 2. Top and Bottom solid shoulder lines (white/light grey)
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(0, roadY + 2);
    ctx.lineTo(width, roadY + 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, roadY + roadH - 2);
    ctx.lineTo(width, roadY + roadH - 2);
    ctx.stroke();

    // 3. Center dashed lane divider line (yellow)
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 3;
    ctx.setLineDash([30, 20]);
    ctx.beginPath();
    ctx.moveTo(0, roadY + roadH / 2);
    ctx.lineTo(width, roadY + roadH / 2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash
  }
}

function drawBackyardFence(ctx) {
  if (currentScene !== "BACKYARD") return;
  const oldAlpha = ctx.globalAlpha;
  ctx.globalAlpha = 0.8;

  let imgKey = "crummy_fence_post";
  if (backyardFenceTier === 1) imgKey = "fence_post";
  else if (backyardFenceTier === 2) imgKey = "reinforced_fence_post";

  const fenceImg = images[imgKey];
  if (fenceImg && fenceImg.complete && fenceImg.width > 0) {
    const postW = fenceImg.width;
    const postH = fenceImg.height;
    const y = height - postH;
    const startX = (width - postW) / 2;
    const step = postW - 1;

    // Tile rightwards with 1 pixel overlap
    for (let x = startX; x < width; x += step) {
      let imgToDraw = fenceImg;
      if (x === startX && backyardFenceTier === 2) {
        // For the third tier, the center is always the gate
        imgToDraw = images.reinforced_fence_post_gate || fenceImg;
      } else if (backyardFenceBroken) {
        if (x === startX) {
          // Delete/skip center piece for crummy and normal
          continue;
        } else if (x === startX + step) {
          // Adjacent right segment
          if (backyardFenceTier === 0) {
            imgToDraw = images.crummy_fence_post_damaged || fenceImg;
          } else if (backyardFenceTier === 1) {
            imgToDraw = images.fence_post_damaged || fenceImg;
          }
        }
      }
      if (imgToDraw && imgToDraw.complete) {
        ctx.drawImage(imgToDraw, x, y, postW, postH);
      }
    }
    // Tile leftwards with 1 pixel overlap
    for (let x = startX - step; x + postW > 0; x -= step) {
      let imgToDraw = fenceImg;
      let shouldFlip = false;
      if (backyardFenceBroken) {
        if (x === startX - step) {
          // Adjacent left segment
          if (backyardFenceTier === 0) {
            imgToDraw = images.crummy_fence_post_damaged || fenceImg;
            shouldFlip = true;
          } else if (backyardFenceTier === 1) {
            imgToDraw = images.fence_post_damaged || fenceImg;
            shouldFlip = true;
          }
        }
      }
      if (imgToDraw && imgToDraw.complete) {
        if (shouldFlip) {
          ctx.save();
          ctx.translate(x + postW, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(imgToDraw, 0, y, postW, postH);
          ctx.restore();
        } else {
          ctx.drawImage(imgToDraw, x, y, postW, postH);
        }
      }
    }
  }

  ctx.globalAlpha = oldAlpha;
}

function drawDoorBackground(ctx) {
  const portals = getScenePortals(currentScene);
  const p = portals.find((p) => p.type === "door");
  if (p) {
    if (images.door && images.door.complete) {
      ctx.drawImage(images.door, p.x, p.y, p.w, p.h);
    } else {
      // Fallback door
      ctx.fillStyle = "#8B4513"; // SaddleBrown
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "gold";
      ctx.beginPath();
      ctx.arc(p.x + p.w - 15, p.y + p.h / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
  }
}

function drawPortals() {
  const portals = getScenePortals(currentScene);
  for (const p of portals) {
    if (p.type === "door" || p.type.startsWith("arrow")) {
      ctx.fillStyle = p.locked
        ? "rgba(100, 100, 100, 0.5)"
        : "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      if (p.type === "arrow_left") {
        ctx.moveTo(p.x + p.w, p.y);
        ctx.lineTo(p.x, p.y + p.h / 2);
        ctx.lineTo(p.x + p.w, p.y + p.h);
      } else if (p.type === "arrow_right") {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.w, p.y + p.h / 2);
        ctx.lineTo(p.x, p.y + p.h);
      } else if (p.type === "arrow_down") {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.w, p.y);
        ctx.lineTo(p.x + p.w / 2, p.y + p.h);
      } else if (p.type === "arrow_up") {
        ctx.moveTo(p.x, p.y + p.h);
        ctx.lineTo(p.x + p.w, p.y + p.h);
        ctx.lineTo(p.x + p.w / 2, p.y);
      } else if (p.type === "door") {
        // Draw up arrow for door, same size as others (60x80)
        const aw = 80;
        const ah = 60;
        const ax = p.x + (p.w - aw) / 2;
        const ay = p.y + (p.h - ah) / 2;
        ctx.moveTo(ax, ay + ah);
        ctx.lineTo(ax + aw / 2, ay);
        ctx.lineTo(ax + aw, ay + ah);
      }
      ctx.fill();

      // Hover effect
      if (isPointInRect(mouse.x, mouse.y, p.x, p.y, p.w, p.h)) {
        ctx.fillStyle = "white";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        const tw = ctx.measureText(p.label).width;
        const tx = clamp(p.x + p.w / 2, tw / 2 + 5, width - tw / 2 - 5);
        const ty = p.type === "arrow_down" ? p.y - 15 : p.y + p.h + 20;
        ctx.fillText(p.label, tx, ty);
      }
    }
  }
}

function cancelPendingConnections() {
  for (const obj of objects) {
    if (obj instanceof IVStand) {
      obj.isConnecting = false;
    }
  }
}

function updateDoorMessages(dt) {
  for (let i = doorMessages.length - 1; i >= 0; i--) {
    const msg = doorMessages[i];
    msg.timer -= dt;
    if (msg.timer < 1.0) {
      msg.opacity = Math.max(0, msg.timer);
    }
    if (msg.timer <= 0) {
      doorMessages.splice(i, 1);
    }
  }
}
