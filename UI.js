// UI.js - the main screen drawing (drawUI), which windows are open
// (isAnyScreenOpen), the top-left buttons and all mouse clicks.
//
// Other parts of the screen live in their own files (loaded just before
// this one, see index.html): UIMessages, UIToolbox, UISelling, UIDebug,
// UIInspection, UIDayCare, UIChatLog, UIScenes.

// "12 fluffies here (3 foals) · room for 10" - bottom right of the screen
function roomHeadcountText(scene = currentScene) {
  if (typeof fluffies === "undefined") return "";
  const here = fluffies.filter((f) => f.isAlive && f.scene === scene);
  if (!here.length) return "No fluffies here";
  const foals = here.filter((f) => f.growth < 1).length;
  const yours = here.filter((f) => f.adopted).length;
  let t = `${here.length} ${here.length === 1 ? "fluffy" : "fluffies"} here`;
  if (foals) t += ` (${foals} ${foals === 1 ? "foal" : "foals"})`;
  if (yours && yours < here.length) t += ` · ${yours} yours`;
  const space = typeof roomSpace === "function" ? roomSpace(scene) : 0;
  if (space && typeof playerQuartersAndNotBackyard === "function" && playerQuartersAndNotBackyard(scene)) t += ` · room for ${space}`;
  return t;
}

function drawRoomHeadcount(c) {
  if (typeof gameState !== "undefined" && gameState !== "PLAYING" && gameState !== "PAUSED") return;
  const t = roomHeadcountText();
  if (!t) return;
  c.save();
  c.font = "bold 13px Arial";
  c.textAlign = "right";
  c.textBaseline = "middle";
  const w = c.measureText(t).width + 16;
  const x = width - 10;
  const y = height - 18;
  c.fillStyle = "rgba(0, 0, 0, 0.45)";
  if (c.roundRect) {
    c.beginPath();
    c.roundRect(x - w, y - 11, w, 22, 8);
    c.fill();
  } else c.fillRect(x - w, y - 11, w, 22);
  const crowded = typeof crowding === "function" && crowding(currentScene) > 0;
  c.fillStyle = crowded ? "#ff8a80" : "white";
  c.fillText(t, x - 8, y + 1);
  c.restore();
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
  // Click it for the accounts (Economy.js); what you owe beside it
  if (typeof getMoneyRect === "function") {
    const mr = getMoneyRect();
    const over = isPointInRect(mouse.x, mouse.y, mr.x, mr.y, mr.w, mr.h) && !isAnyScreenOpen();
    if (over) {
      ctx.fillRect(10, 10 + 32, mr.w - 12, 2);
      ctx.font = "12px Arial";
      ctx.fillStyle = "white";
      ctx.strokeText("Accounts (K)", mr.x + mr.w + 8, 10 + 20);
      ctx.fillText("Accounts (K)", mr.x + mr.w + 8, 10 + 20);
    } else if (typeof billsOwed === "number" && billsOwed > 0) {
      ctx.font = "bold 13px Arial";
      ctx.fillStyle = "#ff8a80";
      const t = `owe $${billsOwed.toLocaleString()}`;
      ctx.strokeText(t, mr.x + mr.w + 8, 10 + 20);
      ctx.fillText(t, mr.x + mr.w + 8, 10 + 20);
    }
  }

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
  // Game clock and fast-forward buttons (GameSpeed.js)
  if (typeof drawGameSpeed === "function") drawGameSpeed(chatLogBtnX + chatLogBtnW);

  // How many fluffies are in this room (bottom right)
  drawRoomHeadcount(ctx);

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
      "• WASD or the arrow keys move between rooms, taking what you're holding.",
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

    // (things in the world are at world positions: in the park, add the camera)
    const wx = mouse.x + (typeof isCameraScene === "function" && isCameraScene(currentScene) && typeof camera !== "undefined" ? camera.x : 0);
    const wy = mouse.y + (typeof isCameraScene === "function" && isCameraScene(currentScene) && typeof camera !== "undefined" ? camera.y : 0);
    const sellable = findSellableItemAt(wx, wy);
    if (sellable) {
      bestItem = sellable.item;
      bestEntry = sellable.entry;
      bestType = sellable.entry.sellType;
      maxY = bestItem.getBottomY();
    }

    // Check Fluffies
    for (const f of fluffies) {
      if (f.scene !== currentScene) continue;
      if (f.hitTestAsSeen(wx, wy)) {
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
    const vendor = objectsOfType(FoalVendor)[0];
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
    for (const obj of objectsOfType(FoalInACan)) {
      if (obj.scene === currentScene) {
        const img = images.foal_in_a_can;
        let bw = 60,
          bh = 70;
        if (img && img.complete && img.width > 0) {
          bw = img.width;
          bh = img.height;
        }
        const camX = typeof isCameraScene === "function" && isCameraScene(currentScene) && typeof camera !== "undefined" ? camera.x : 0;
        const camY = typeof isCameraScene === "function" && isCameraScene(currentScene) && typeof camera !== "undefined" ? camera.y : 0;
        if (
          isPointInRect(mouse.x + camX, mouse.y + camY, obj.x - bw / 2, obj.y - bh, bw, bh)
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
    const desk = typeof DayCareDesk !== "undefined" ? objectsOfType(DayCareDesk)[0] : null;
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
        const tooltipText = "Shelter desk: board your fluffies (click)";
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
  if (typeof drawClimateTooltip === "function") drawClimateTooltip(ctx); // (on top of the messages, Climate.js)
  drawDebugWatcher();
  if (typeof drawOrdersHud === "function") drawOrdersHud(ctx);
  if (typeof drawExtJobPanel === "function") drawExtJobPanel(ctx); // on a pest job (ExterminatorPlayer.js)
  if (typeof drawItemHoverHint === "function") drawItemHoverHint(ctx); // what right-click does (ItemRegistry.js)
  // Every pop-up screen, bottom layer first (Screens.js)
  drawScreens(ctx);
  if (typeof drawOutingBanner === "function") drawOutingBanner(ctx); // (ParkOutings.js)
  if (typeof drawHints === "function") drawHints(ctx); // first-time hints (Hints.js)
  if (typeof drawPhotoFlash === "function") drawPhotoFlash(ctx); // Snap! (Lives.js)
}

let inspectedFluffy = null;

// Is any pop-up screen open? (Screens.js has the list)
function isAnyScreenOpen() {
  return anyScreenOpen();
}
window.isAnyScreenOpen = isAnyScreenOpen;

function openInspectionModal(fluffy) {
  inspectedFluffy = fluffy;
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

  // Fast-forward buttons (GameSpeed.js)
  if (typeof gameSpeedClick === "function" && gameSpeedClick(chatLogBtnX + chatLogBtnW)) return true;

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

  // The middle button does nothing
  if (e.button === 1) return;
  // A right-click never presses a button on a pop-up screen (no loans or
  // jabs by accident). The right-click menu just makes way for another
  // fluffy's; any other open screen ignores it.
  if (e.button === 2 && typeof SCREENS !== "undefined") {
    const open = SCREENS.filter((s) => _screenOpen(s));
    if (open.length && open.every((s) => s.name === "tricks")) {
      if (typeof closeTrickUI === "function") closeTrickUI();
    } else if (open.length) return;
  }

  // Pop-up screens, top one first (Screens.js)
  if (clickScreens()) {
    return;
  }
  // A first-time hint card (Hints.js)
  if (typeof hintClick === "function" && hintClick()) {
    return;
  }
  // Your money: the accounts (Economy.js)
  if (typeof moneyClick === "function" && moneyClick()) {
    return;
  }
  // "Home time" on a park outing (ParkOutings.js)
  if (typeof outingBannerClick === "function" && outingBannerClick()) {
    return;
  }

  // The buyer at the door: Sell / Ask more / No thanks (Buyers.js)
  if (typeof sellRequestClick === "function" && sellRequestClick()) {
    return;
  }

  // Toolbox and Toolbar Click
  if (toolboxAndToolbarClick()) {
    return;
  }

  // The park's map in the corner (Park.js)
  if (typeof parkMinimapClick === "function" && parkMinimapClick()) {
    return;
  }

  // In the park, what's below works with world positions (Park.js)
  if (typeof mouseToWorld === "function") mouseToWorld();

  // Click a fox in the park to scare it off (NightEvents.js)
  if (typeof handleNightPredatorClick === "function" && handleNightPredatorClick()) {
    return;
  }
  // Click a stray dog to chase it off (Dogs.js)
  if (typeof handleStrayDogClick === "function" && handleStrayDogClick()) {
    return;
  }

  // 0. Check Sell Mode (Shift Click)
  if (sellModeClick()) {
    return;
  }

  // Holding something and tapping another room's wall hint: go there,
  // carrying it (as WASD does) - a body part, a fluffy, a tool... (UIScenes.js)
  if (isGlobalDragging && !mouse.rightDown && typeof houseNavChipAt === "function") {
    const sm = typeof screenMouse === "function" ? screenMouse() : mouse;
    const chip = houseNavChipAt(sm.x, sm.y);
    if (chip) {
      changeScene(chip.portal.target);
      return;
    }
  }

  // 1. If already dragging something, drop it

  if (attemptDrop()) {
    return;
  }

  // Buttons and menus: screen positions again
  if (typeof mouseToScreen === "function") mouseToScreen();

  // 2. Check Action Buttons
  if (actionButtonsClick()) {
    return;
  }

  // On a pest job: clicks walk you about (ExterminatorPlayer.js)
  if (typeof extSiteClick === "function" && extSiteClick()) {
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
  // The vet's clinic on Shopping Street (Vet.js)
  if (typeof vetClinicClick === "function" && vetClinicClick()) {
    return;
  }
  // The show hall on Shopping Street (Shows.js)
  if (typeof showHallClick === "function" && showHallClick()) {
    return;
  }
  // The rival breeder's shop (Rival.js)
  if (typeof rivalShopClick === "function" && rivalShopClick()) {
    return;
  }
  // A neighbour's door on Maple Lane (Neighbours.js)
  if (typeof nbDoorClick === "function" && nbDoorClick()) {
    return;
  }

  // Things in the world: world positions (Park.js)
  if (typeof mouseToWorld === "function") mouseToWorld();

  // 3. Right Click: each item's right-click action is in ItemRegistry.js
  // (cage tags, TV channels, sprinkler on/off, gates, turning fences...)
  if (mouse.rightDown) {
    // Right-clicking one of your fluffies: train a trick (Tricks.js) - first,
    // so one standing in a cage (or in front of anything) gets its menu
    if (typeof trickRightClick === "function" && trickRightClick()) {
      mouse.rightDown = false;
      return;
    }
    if (handleItemRightClick(mouse.x, mouse.y)) {
      mouse.rightDown = false; // only once per click
      return;
    }
    // ...or one you lost, in the park: bring it home (ParkOutings.js)
    if (typeof formerPetRightClick === "function" && formerPetRightClick()) {
      mouse.rightDown = false;
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
      if (f.hitTestAsSeen(mouse.x, mouse.y)) {
        applyDebugAction(f);
        return;
      }
    }
  }

  // A foal in the shelter's playpen: adopt it? (Shelter.js)
  if (typeof shelterPenClick === "function" && !isGlobalDragging && shelterPenClick()) return;

  // Check Fluffies
  for (let i = fluffies.length - 1; i >= 0; i--) {
    const f = fluffies[i];
    if (f.scene !== currentScene) {
      continue;
    }
    if (f.currentCage && f.currentCage instanceof FoalInACan) {
      continue;
    }
    // (sealed in a culling cage)
    if (Cage.locksItem(f)) {
      continue;
    }
    const hitPart = f.hitTestAsSeen(mouse.x, mouse.y);
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
        (relationships[mom.id] || {})[f.id] !== "estranged_child"
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
        const foalPos = f.getWorldPosition();
        let targetX = foalPos.x + (Math.random() - 0.5) * 100;
        let targetY = foalPos.y + (Math.random() - 0.5) * 50;
        mom.setTargetPosition(targetX, targetY);
        mom.initBehavior("MOVING");
      }
    } else if (f.isSensitive() && f.growth >= CHIRPY_THRESHOLD) {
      // A sensitive baby: every upsies hurts (its own few words)
      f.speak(getDialogue(["SENSITIVE", "UPSIES"], f), false, true);
      f.changeHappiness(HAPPINESS_PENALTY_BAD_UPSIES * 0.5, "Picked up (it hurts)");
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
          if (r < 0.002) spawnType = "alicorn"; // extremely rare (1 in 500)
          else if (r < 0.35) spawnType = "unicorn";
          else if (r < 0.65) spawnType = "pegasus";
          else spawnType = "earthy";

          const baby = new Horse(0.0, null, obj.scene, spawnType);
          baby.makeType(spawnType); // (the roll above decides it: 1 alicorn in 500)
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

    // The shelter's kennels: read a plaque (Shelter.js)
    if (typeof ShelterKennels !== "undefined" && obj instanceof ShelterKennels) {
      const cage = obj.cageAt(mouse.x, mouse.y);
      if (cage >= 0) {
        openShelterCard(cage);
        return;
      }
      continue;
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

      // A cull or eject cage with fluffies in: a tap does its job (Cage.js)
      if (typeof Cage !== "undefined" && obj instanceof Cage && typeof obj.tapAction === "function" && obj.tapAction()) return;
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
        (typeof CattleProd !== "undefined" && obj instanceof CattleProd) ||
        (typeof Blowtorch !== "undefined" && obj instanceof Blowtorch)
      ) {
        obj.dragOffset.x = 0;
        obj.dragOffset.y = 0;
      } else if (img) {
        obj.dragOffset.x = 0;
        // A tool: its working end on the pointer (TOOL_GRIPS, globals.js)
        obj.dragOffset.y = typeof isToolObject === "function" && isToolObject(obj) ? 0 : img.height * 0.2;
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

  // Arrows and doors are on the screen (Park.js)
  if (typeof mouseToScreen === "function") mouseToScreen();

  // The house's wall hints: other rooms, the backyard (UIScenes.js)
  if (typeof houseNavClick === "function" && houseNavClick()) return;
  // Chase raiders out of the backyard (Raids.js)
  if (typeof raidChipClick === "function" && raidChipClick()) return;

  // Check Portal Click
  const portals = getScenePortals(currentScene);
  for (const p of portals) {
    if (p.keyOnly) continue; // house rooms: keys and wall hints instead
    if (isPointInRect(mouse.x, mouse.y, p.x, p.y, p.w, p.h)) {
      if (p.locked) {
        buyRoomPortal(p);
      } else {
        changeScene(p.target);
      }
      return;
    }
  }

  // Clicked on nothing in the park: drag the view (Park.js)
  if (typeof startParkPan === "function") startParkPan();
});

window.addEventListener("resize", () => {
  resize();
});
