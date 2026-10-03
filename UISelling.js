// ---------------------------------------------------------------------------
// Selling: the buyer at the door (sell request card) and shift + click
// selling (sellModeClick). Split out of UI.js.
// ---------------------------------------------------------------------------

function getSellRequestY() {
  const h = typeof SELL_CARD_H === "number" ? SELL_CARD_H : 160;
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

// The buyer at the door (Buyers.js): who they are, what they're after,
// the fluffy they want and their offer, with Accept / Ask more / No
function drawSellRequest(ctx) {
  const req = currentSellRequest;
  if (!req || !getSceneConfig(currentScene).insidePlayerQuarters) return;
  const L = sellRequestLayout();
  const kind = getBuyerKind(req.buyer);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
  fillRoundRect(ctx, L.x, L.y, L.w, L.h, 10);
  ctx.strokeStyle = "gold";
  ctx.lineWidth = 2;
  ctx.stroke();
  // Portrait
  if (req.fluffy && typeof req.fluffy.drawPortrait === "function") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.x + 6, L.y + 30, 100, 100);
    ctx.clip();
    req.fluffy.drawPortrait(ctx, L.x + 6 + 50, L.y + 30 + 58, 80);
    ctx.restore();
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "gold";
  ctx.font = "bold 15px Arial";
  ctx.fillText(fitText(ctx, `${kind.label} is at the door`, L.w - 20), L.x + 10, L.y + 21);
  const tx = L.x + 112;
  const tw = L.w - 122;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "italic 12px Arial";
  ctx.fillText(fitText(ctx, `Wants ${kind.wants}`, tw), tx, L.y + 42);
  ctx.fillStyle = "white";
  ctx.font = "bold 14px Arial";
  const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(req.fluffy) : fluffyNames[req.fluffyId] || "Fluffy";
  ctx.fillText(fitText(ctx, name, tw), tx, L.y + 62);
  ctx.fillStyle = req.like >= 0.75 ? "#9fe0a8" : "rgba(255,255,255,0.75)";
  ctx.font = "12px Arial";
  ctx.fillText(describeBuyerInterest(req), tx, L.y + 79);
  ctx.fillStyle = "#9fe0a8";
  ctx.font = "bold 22px Arial";
  ctx.fillText(`$${req.price.toLocaleString()}`, tx, L.y + 106);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.ceil(req.timer)}s`, L.x + L.w - 10, L.y + 21);
  if (req.said) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffe7b0";
    ctx.font = "italic 12px Arial";
    ctx.fillText(fitText(ctx, req.said, L.w - 20), L.x + 10, L.y + L.h - 50);
  }
  // Buttons
  const button = (b, label, colour, enabled = true) => {
    ctx.globalAlpha = enabled ? 1 : 0.4;
    ctx.fillStyle = colour;
    fillRoundRect(ctx, b.x, b.y, b.w, b.h, 6);
    ctx.fillStyle = "white";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
  };
  button(L.accept, "Sell", "#4CAF50");
  button(L.ask, req.final ? "Final offer" : `Ask $${askMorePrice(req).toLocaleString()}`, "#e08a1e", !req.final);
  button(L.reject, "No thanks", "#c0392b");
  ctx.restore();
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

  // On a phone: tap once to see the price, again to sell (Touch.js)
  // (a fluffy wearing something: the first thing to go is what it's wearing)
  const dressed = bestType === "fluffy" && bestItem && Object.keys(bestItem.accessories || {}).length > 0;
  if (bestItem && typeof touchSellConfirm === "function" && !touchSellConfirm(bestItem, dressed ? "Tap it again to take off what it's wearing." : null)) return true;

  if (bestItem) {
    if (bestType === "fluffy") {
      const accKeys = Object.keys(bestItem.accessories || {});
      if (accKeys.length > 0) {
        // Remove one accessory (the first one found)
        const slotToRemove = accKeys[0];
        const accData = bestItem.accessories[slotToRemove];
        delete bestItem.accessories[slotToRemove];
        if (slotToRemove === "head" && typeof noteWishEvent === "function") noteWishEvent(bestItem, "hatOff"); // (Wishes.js)

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
        // (kept from sale: say so - NotForSale.js)
        if (typeof isKeptFromSale === "function" && isKeptFromSale(bestItem) && bestItem.isAlive) {
          sayKeptFromSale(bestItem);
          return true;
        }
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
      const itemValue = getItemSellValue(bestItem, bestEntry);
      money += itemValue;
      if (typeof noteIncome === "function") noteIncome(itemValue); // (Economy.js: net takings)
      if (bestEntry.onSell) bestEntry.onSell(bestItem);
      poofs.push(new Poof(bestItem.x, bestItem.y - 20, bestItem.scene));
    } else if (bestType === "fluffy") {
      if (bestItem.isDragging) isGlobalDragging = false;
      money += Math.floor(bestItem.calculatePrice() / 2);
      if (typeof noteDayEvent === "function") noteDayEvent("sold", { money: Math.floor(bestItem.calculatePrice() / 2) });
      if (typeof _saleBuyer !== "undefined") _saleBuyer = "shop"; // (Reputation.js)
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
