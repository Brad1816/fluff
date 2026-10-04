// ---------------------------------------------------------------------------
// The toolbox and toolbar, shop item pictures, and buying from the shop
// list (buyShopAction). Split out of UI.js.
// ---------------------------------------------------------------------------

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

// Everything in the toolbox grid: tools, then the shopping bag
// (ShoppingBag.js), split into pages with arrow buttons
function _toolboxGridEntries() {
  const tools =
    typeof getGroupedToolboxEntries === "function"
      ? getGroupedToolboxEntries()
      : typeof toolbox !== "undefined"
        ? toolbox
        : [];
  const bag = typeof getShoppingBagEntries === "function" ? getShoppingBagEntries() : [];
  return [...tools, ...bag];
}

function _toolboxPageSlots(cols, rows) {
  const pages = [];
  const itemsToPlace = _toolboxGridEntries();
  while (itemsToPlace.length > 0) {
    const isFirstPage = pages.length === 0;
    let itemsAllowed = cols * rows;
    if (!isFirstPage) itemsAllowed -= 1; // Prev arrow
    if (itemsToPlace.length > itemsAllowed) itemsAllowed -= 1; // Next arrow
    const pageContent = itemsToPlace.splice(0, itemsAllowed);
    const pageSlots = [];
    if (!isFirstPage) pageSlots.push({ isNav: true, dir: -1, name: "⬅" });
    pageSlots.push(...pageContent);
    if (itemsToPlace.length > 0) pageSlots.push({ isNav: true, dir: 1, name: "➡" });
    pages.push(pageSlots);
  }
  if (pages.length === 0) pages.push([]);
  if (typeof toolboxPage === "undefined") toolboxPage = 0;
  if (toolboxPage >= pages.length) toolboxPage = Math.max(0, pages.length - 1);
  return pages[toolboxPage];
}

// A shopping bag button: the shop picture, tan background, count
function _drawBagButton(ctx, item, bx, by, btnSize) {
  drawGlassButton(bx, by, btnSize, btnSize, "", {
    borderRadius: 6,
    normalFill: "rgba(196, 150, 84, 0.35)",
    hoverFill: "rgba(226, 180, 110, 0.5)",
    borderColor: "rgba(240, 200, 130, 0.8)",
  });
  if (typeof drawShopActionIcon === "function") drawShopActionIcon(ctx, item.action, bx + btnSize / 2, by + btnSize / 2, btnSize - 12);
  if (item.count > 1) {
    ctx.save();
    ctx.font = "bold 9px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const t = String(item.count);
    const tw = ctx.measureText(t).width;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(bx + btnSize - 6 - tw, by + btnSize - 12, tw + 4, 11);
    ctx.fillStyle = "#ffe7b0";
    ctx.fillText(t, bx + btnSize - 4, by + btnSize - 2);
    ctx.restore();
  }
}

function drawToolboxAndToolbar(ctx) {
  if (typeof isJobScene === "function" && isJobScene(currentScene)) return; // (your kit instead, on a pest job)
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
  let hoveredBagItem = null;
  let hoveredTool = null;
  let hoveredIsToolbox = false;
  const isToolboxShown = typeof showToolbox === "undefined" || showToolbox;

  // 1. Draw Toolbox (8x3 grid)
  if (isToolboxShown) {
    const currentSlots = _toolboxPageSlots(cols, rows);

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
        } else if (item.isBag) {
          _drawBagButton(ctx, item, bx, by, btnSize);
          if (isPointInRect(mouse.x, mouse.y, bx, by, btnSize, btnSize)) {
            hoveredToolboxItem = item;
            hoveredBagItem = item;
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

  // Carrying something small: the toolbox takes it
  const packable = isToolboxShown && typeof carriedPackableItem === "function" ? carriedPackableItem() : null;
  if (packable) {
    const { toolboxW, toolboxH } = layout;
    ctx.save();
    ctx.strokeStyle = "rgba(240, 200, 130, 0.95)";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(toolboxX - 4, toolboxY - 4, toolboxW + 8, toolboxH + 8);
    ctx.setLineDash([]);
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#ffe7b0";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    const label = "Click here to put it in your shopping bag";
    ctx.strokeText(label, toolboxX, toolboxY - 8);
    ctx.fillText(label, toolboxX, toolboxY - 8);
    ctx.restore();
  }

  // Tooltip for a shopping bag button
  if (hoveredBagItem && !hoveredTool) {
    const lines = [
      hoveredBagItem.action.name,
      `In your shopping bag${hoveredBagItem.count > 1 ? `: ${hoveredBagItem.count}` : ""}`,
      "Click to take it out, then click to put it down.",
    ];
    if (hoveredBagItem.count > 1) lines.push("Shift-click (or long-press) to take them all out.");
    ctx.font = "bold 12px Arial";
    const padding = 10;
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padding * 2;
    const th = lines.length * 16 + padding * 2;
    const tx = clamp(mouse.x + 10, 0, width - tw - 10);
    const ty = clamp(mouse.y - th - 10, 0, height - th - 10);
    drawGlassButton(tx, ty, tw, th, "", { forceNormal: true, borderRadius: 8, normalFill: "rgba(0, 0, 0, 0.75)" });
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lines.forEach((line, idx) => {
      ctx.fillStyle = idx === 0 ? "gold" : idx >= 2 ? "#88ccff" : "white";
      ctx.fillText(line, tx + padding, ty + padding + idx * 16);
    });
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
  if (typeof isJobScene === "function" && isJobScene(currentScene)) return false;
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
    // Carrying something small: clicking the toolbox packs it (ShoppingBag.js)
    const packable = typeof carriedPackableItem === "function" ? carriedPackableItem() : null;
    if (packable && isPointInRect(mouse.x, mouse.y, toolboxX - 4, toolboxY - 4, toolboxW + 8, toolboxH + 8)) {
      const action = shopActionForItem(packable);
      packIntoShoppingBag(packable);
      if (typeof addUIMessage === "function") addUIMessage(`${action ? action.name : "It"} put in your shopping bag.`);
      return true;
    }
    const currentSlots = _toolboxPageSlots(cols, rows);

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
        if (item.isBag) {
          // Shift-click (a long press on a phone): all of that kind (ShoppingBag.js)
          const all = (mouse.rightDown || (typeof isShiftPressed !== "undefined" && isShiftPressed)) && item.count > 1;
          const shift = typeof isShiftPressed !== "undefined" && isShiftPressed;
          let got = null;
          if (all && typeof takeAllFromShoppingBag === "function") got = takeAllFromShoppingBag(item.name);
          else if (typeof takeFromShoppingBag === "function") got = takeFromShoppingBag(item.name);
          if (got && shift) got._noShiftSell = true; // (the click that puts it down mustn't sell it)
          return true;
        }
        // Right-click (a long press on a phone): onto the number row, or off it
        if (mouse.rightDown && typeof toolbarSlots !== "undefined") {
          toggleToolOnToolbar(item.tool || item);
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
        // Right-click (long press): empty the slot
        if (mouse.rightDown) {
          slot.tool = null;
          return true;
        }
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

// A tool onto the number row (the first empty slot), or off it if it's
// there already. (A computer can also hover it and press a number.)
function toggleToolOnToolbar(tool) {
  if (!tool || typeof toolbarSlots === "undefined") return false;
  const at = toolbarSlots.find((s) => s.tool === tool);
  if (at) {
    at.tool = null;
    return true;
  }
  const free = toolbarSlots.find((s) => !s.tool);
  if (!free) {
    if (typeof addUIMessage === "function") addUIMessage(`The number row is full - ${typeof touchMode !== "undefined" && touchMode ? "long-press" : "right-click"} a slot to empty it.`);
    return false;
  }
  free.tool = tool;
  return true;
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
  h.makeType(action.type); // (the type you paid for)
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

const _shopTints = new Map();
function _tintedShopImage(key, img, filter) {
  const k = `${key}|${filter}`;
  let t = _shopTints.get(k);
  if (t && t.src === img) return t.canvas;
  if (typeof OffscreenCanvas === "undefined") return img;
  const canvas = new OffscreenCanvas(img.width, img.height);
  const c = canvas.getContext("2d");
  c.filter = filter;
  c.drawImage(img, 0, 0);
  _shopTints.set(k, { src: img, canvas });
  return canvas;
}

// Shop picture for an action, centred on (cx, cy), fitting in a box
// size wide and sizeH tall (square if sizeH is left out)
function drawShopActionIcon(c, action, cx, cy, size, disabled = false, sizeH = size) {
  const shopIcon = getShopIcon(action);
  const imgKey = shopIcon.imageKey;
  c.save();
  // Kibble brands: tinted bags (Diet.js)
  const brand = action.foodType && typeof FOODS !== "undefined" ? FOODS[action.foodType] : null;
  if (disabled) c.globalAlpha = 0.3;
  // (a loaded picture, or one drawn at start-up on a canvas - the mower,
  // incubator, bandages... - which has no .complete: globals.js isDrawableImage)
  const pic = imgKey && typeof images !== "undefined" ? images[imgKey] : null;
  const drawable = pic && (typeof isDrawableImage === "function" ? isDrawableImage(pic) : pic.complete) && pic.width > 0;
  if (brand && brand.filter && !drawable) c.filter = brand.filter;
  if (drawable) {
    // (a tinted bag is tinted once and kept: a canvas filter every frame is slow on phones)
    const img = brand && brand.filter ? _tintedShopImage(imgKey, pic, brand.filter) : images[imgKey];
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
