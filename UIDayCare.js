// ---------------------------------------------------------------------------
// The shelter's boarding window (the desk; was the day care). Split out of
// UI.js. Adopting from the kennels is Shelter.js.
// ---------------------------------------------------------------------------

// The small "Give up" button on one of your fluffies' rows
function dayCareGiveUpRect(col1X, colW, itemY) {
  return { x: col1X + colW - 150, y: itemY + 12, w: 62, h: 26 };
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
  const titleText = "Shelter Boarding";
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
  const subText = `Drop off / pick up: $${DAY_CARE_MOVE_COST.toLocaleString()} | Boarding: $${DAY_CARE_RECURRING_FEE_PER_FLUFFY} a day each (with the bills) | Money: $${money.toLocaleString()}`;
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
  const col1Title = `Your fluffies here (${broughtFluffies.length})`;
  ctx.strokeText(col1Title, col1X, colY + 14);
  ctx.fillText(col1Title, col1X, colY + 14);

  ctx.font = "12px Arial";
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText("Yours, in this room: click to board", col1X, colY + 30);

  const listStartY = colY + 40;
  const itemH = 50;
  const itemGap = 6;

  if (broughtFluffies.length === 0) {
    ctx.font = "italic 14px Arial";
    ctx.fillStyle = "#888888";
    ctx.textAlign = "center";
    ctx.fillText(
      "Bring your fluffies in to board them.",
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

      // "Give up" to the shelter (Shelter.js)
      if (typeof giveUpToShelter === "function") {
        const gb = dayCareGiveUpRect(col1X, colW, itemY);
        drawGlassButton(gb.x, gb.y, gb.w, gb.h, "Give up", { fontSize: 11, borderRadius: 6, disabled: !canGiveUpToShelter() });
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
      ctx.strokeText("Board →", col1X + colW - 10, itemY + 20);
      ctx.fillText("Board →", col1X + colW - 10, itemY + 20);

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
  const col2Title = `Boarding (${dayCareFluffies.length})`;
  ctx.strokeText(col2Title, col2X, colY + 14);
  ctx.fillText(col2Title, col2X, colY + 14);

  ctx.font = "12px Arial";
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText("Click to pick one up", col2X, colY + 30);

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
      ctx.strokeText("← Pick up", col2X + colW - 10, itemY + 20);
      ctx.fillText("← Pick up", col2X + colW - 10, itemY + 20);

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
    // Give it up to the shelter
    const gb = dayCareGiveUpRect(col1X, colW, itemY);
    if (typeof giveUpToShelter === "function" && isPointInRect(mouse.x, mouse.y, gb.x, gb.y, gb.w, gb.h)) {
      giveUpToShelter(broughtFluffies[idx]);
      return true;
    }
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
          addUIMessage("Only your own fluffies can be boarded!");
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
      data.scene = "DAY_CARE";
      data.boardedAt = typeof timePlayed === "number" ? timePlayed : 0; // (Shelter.js: its story, lonely days)
      data.bodyColor = f.colors && f.colors.body ? f.colors.body : "#ffffff";
      // (null if nobody named it, so it doesn't come back named "Fluffy")
      data.name = typeof fluffyNames !== "undefined" && fluffyNames[f.id] ? fluffyNames[f.id] : null;
      dayCareFluffies.push(data);

      if (!showDebugMenu) {
        money = Math.max(0, money - DAY_CARE_MOVE_COST);
      }

      if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
        poofs.push(new Poof(f.x, f.y, "DAY_CARE"));
      }

      if (typeof addUIMessage !== "undefined") {
        addUIMessage(
          `${data.name || "Your fluffy"} is boarding at the shelter (-$${DAY_CARE_MOVE_COST.toLocaleString()})`,
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
      // (it keeps the mood it's in: lonely after a long stay, Shelter.js)
      if (typeof data.happiness !== "number") horse.happiness = 0.5;
      horse.scene = "DAY_CARE";
      horse.adopted = true;
      fluffies.push(horse);
      if (typeof onBoarderPickedUp === "function") onBoarderPickedUp(horse, data);
      // Loved ones at home are glad it's back
      if (typeof getLiking === "function") {
        for (const o of fluffies) if (o !== horse && o.isAlive && o.adopted && getLiking(o, horse) >= 0.3) o.changeHappiness(0.05);
      }

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
          `Picked up ${hName} from boarding (-$${DAY_CARE_MOVE_COST.toLocaleString()})`,
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

// Pop-up screen list (Screens.js)
registerScreen({
  name: "dayCare",
  layer: 13,
  isOpen: () => !!dayCareModalOpen,
  close: () => (dayCareModalOpen = false),
  draw: (c) => drawDayCareModal(c),
  click: () => handleDayCareModalClick(),
  reset: () => {
    dayCareModalOpen = false;
    dayCareBroughtPage = 0;
    dayCareStoredPage = 0;
  },
});
