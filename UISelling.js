// ---------------------------------------------------------------------------
// Selling: the buyer at the door (sell request card) and shift + click
// selling (sellModeClick). Split out of UI.js.
// ---------------------------------------------------------------------------

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
    if (f.hitTestAsSeen(mouse.x, mouse.y)) {
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
      if (typeof noteDayEvent === "function") noteDayEvent("sold", { money: Math.floor(bestItem.calculatePrice() / 2) });
      if (typeof noteFluffyLeft === "function") noteFluffyLeft(bestItem, "sold", Math.floor(bestItem.calculatePrice() / 2));
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
