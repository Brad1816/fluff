// ---------------------------------------------------------------------------
// Areas: the arrows/doors between them (getScenePortals) and drawing
// each area's background, road, fences and doors. Split out of UI.js.
// ---------------------------------------------------------------------------

function playerQuartersAndNotBackyard(scene) {
  return getSceneConfig(scene).insidePlayerQuarters && scene !== "BACKYARD";
}

function getScenePortals(scene) {
  const portals = [];

  // Fluffy Park (Park.js): its only exit is back to the shelter alley
  if (typeof isCameraScene === "function" && isCameraScene(scene)) {
    return [
      {
        type: "arrow_left",
        x: 20,
        y: height / 2 - 40,
        w: 60,
        h: 80,
        target: "ALLEY_DAY_CARE",
        label: "Back to Shelter Alley",
      },
    ];
  }

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
      // Down to the Backyard (S / down arrow key, or the wall hint)
      portals.push({
        type: "arrow_down",
        x: width / 2 - 40,
        y: height - 80,
        w: 80,
        h: 60,
        target: "BACKYARD",
        label: "Backyard",
        keyOnly: true,
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
        keyOnly: true, // no arrow on the floor: A / left arrow key (houseNav)
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
        keyOnly: true, // D / right arrow key (houseNav)
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
      label: "To Shelter Alley",
    });
  } else if (scene === "ALLEY_DAY_CARE") {
    // Main door to the shelter (Shelter.js; the scene is still "DAY_CARE")
    portals.push({
      type: "door",
      x: doorRect.x,
      y: doorRect.y,
      w: doorRect.w,
      h: doorRect.h,
      target: "DAY_CARE",
      label: "Enter the shelter",
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
    // Right Arrow -> PARK (Park.js)
    if (typeof PARK_SCENE !== "undefined") {
      portals.push({
        type: "arrow_right",
        x: width - 80,
        y: height / 2 - 40,
        w: 60,
        h: 80,
        target: PARK_SCENE,
        label: "To Fluffy Park",
      });
    }
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

// The floor texture, drawn once per area (and window size) and reused:
// making the pattern and filling the screen every frame was slow
const _backgroundCache = {};

function _backgroundFor(scene, img) {
  const key = `${scene}:${width}x${height}`;
  let bg = _backgroundCache[key];
  if (!bg || bg.img !== img) {
    const canvas = new OffscreenCanvas(width, height);
    const bc = canvas.getContext("2d");
    bc.fillStyle = bc.createPattern(img, "repeat");
    bc.fillRect(0, 0, width, height);
    bg = _backgroundCache[key] = { canvas, img };
  }
  return bg.canvas;
}

let _parkPattern = null;
let _parkPatternImg = null;

function drawBackground(c = ctx) {
  const config = getSceneConfig(currentScene);
  const img = images[config.backgroundTexture];
  if (img && img.width > 0) {
    // In the park the camera is applied, so fill the part being looked at
    if (typeof isCameraScene === "function" && isCameraScene(currentScene)) {
      if (_parkPatternImg !== img) {
        _parkPattern = c.createPattern(img, "repeat");
        _parkPatternImg = img;
      }
      c.fillStyle = _parkPattern;
      c.fillRect(camera.x, camera.y, width, height);
    } else {
      c.drawImage(_backgroundFor(currentScene, img), 0, 0);
    }
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
    if (p.keyOnly) continue; // the house: keys and the wall hints instead
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

// ---------------------------------------------------------------------------
// Getting around the house without arrows on the floor.
//
// In the house rooms (the living room and the bought rooms either side) the
// left/right/down arrows are keyOnly portals: not drawn, not clicked, not a
// drop target, so the whole floor is usable. You move with WASD or the arrow
// keys (script.js keydown), and a strip of small hints on the wall shows
// where each key goes; the hints can be clicked too.
// A room you haven't bought: the first key press says the price, a second
// press within a few seconds buys it (clicking its hint buys it at once).
// ---------------------------------------------------------------------------

const HOUSE_KEYS = { arrow_left: "A", arrow_down: "S", arrow_right: "D" };
let _pendingRoomBuy = null; // { dir, until } (real time)

function houseRoomName(scene) {
  if (scene === "INDOORS") return "Living room";
  if (typeof scene !== "string") return "";
  const m = scene.match(/^INDOORS([LR])(\d+)$/);
  return m ? `Room ${m[1]}${m[2]}` : "";
}

function _houseNavLabel(p) {
  const key = HOUSE_KEYS[p.type];
  if (p.type === "arrow_down") return `S ▼ ${p.label}`;
  const where = p.locked ? `Buy a room $${p.cost.toLocaleString()}` : houseRoomName(p.target);
  return p.type === "arrow_left" ? `◀ ${key}  ${where}` : `${where}  ${key} ▶`;
}

// The hint chips on the wall: [{ x, y, w, h, label, portal }]
function houseNavChips(scene = currentScene) {
  if (!playerQuartersAndNotBackyard(scene)) return [];
  const order = ["arrow_left", "arrow_down", "arrow_right"];
  const portals = getScenePortals(scene)
    .filter((p) => p.keyOnly)
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  if (!portals.length) return [];
  const wallBottom = typeof sceneTop === "function" ? sceneTop(scene) : height * 0.15;
  const h = 24;
  const y = Math.max(4, wallBottom - h - 8);
  const c = ctx;
  c.save();
  c.font = "bold 12px Arial";
  const widths = portals.map((p) => c.measureText(_houseNavLabel(p)).width + 18);
  c.restore();
  let x = width - 12 - widths.reduce((s, w) => s + w + 6, -6);
  return portals.map((p, i) => {
    const chip = { x, y, w: widths[i], h, label: _houseNavLabel(p), portal: p };
    x += widths[i] + 6;
    return chip;
  });
}

function drawHouseNav(c) {
  const chips = houseNavChips();
  if (!chips.length) return;
  c.save();
  c.globalAlpha = 1;
  // Which room this is
  const first = chips[0];
  c.font = "bold 12px Arial";
  c.textAlign = "right";
  c.textBaseline = "middle";
  c.fillStyle = "rgba(255,255,255,0.75)";
  let roomLabel = houseRoomName(currentScene);
  // Too many fluffies in here (Population.js)
  if (typeof crowding === "function" && crowding(currentScene) > 0) {
    roomLabel += ` · crowded ${Math.round(roomLoad(currentScene))}/${roomSpace(currentScene)}`;
    c.fillStyle = "#ff8a80";
  }
  // How the room feels (Climate.js), then its name
  let right = first.x - 10;
  if (typeof drawClimateLabel === "function") right -= drawClimateLabel(c, right, first.y + first.h / 2) + 8;
  c.font = "bold 12px Arial";
  c.textAlign = "right";
  c.textBaseline = "middle";
  c.fillText(roomLabel + " ·", right, first.y + first.h / 2);
  for (const chip of chips) {
    const hover = isPointInRect(mouse.x, mouse.y, chip.x, chip.y, chip.w, chip.h);
    const p = chip.portal;
    const pending = _pendingRoomBuy && _pendingRoomBuy.dir === p.dir && p.locked && performance.now() < _pendingRoomBuy.until;
    c.fillStyle = pending ? "rgba(247, 215, 116, 0.85)" : hover ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.45)";
    if (typeof fillRoundRect === "function") fillRoundRect(c, chip.x, chip.y, chip.w, chip.h, 12);
    else c.fillRect(chip.x, chip.y, chip.w, chip.h);
    c.fillStyle = pending ? "#3a2a1a" : p.locked ? (money >= p.cost || showDebugMenu ? "#f7d774" : "#ff9a8a") : "white";
    c.textAlign = "center";
    c.fillText(chip.label, chip.x + chip.w / 2, chip.y + chip.h / 2 + 1);
  }
  c.restore();
}

// Buy the room behind a locked portal. Returns true if bought.
function buyRoomPortal(p) {
  if (!p || !p.locked) return false;
  if (!showDebugMenu && money < p.cost) {
    addUIMessage("Not enough money!");
    return false;
  }
  if (!showDebugMenu) money -= p.cost;
  roomsPurchased++;
  if (p.dir === "L") unlockedRoomsL++;
  else unlockedRoomsR++;
  _pendingRoomBuy = null;
  addUIMessage("New quarters purchased!");
  poofs.push(new Poof(p.dir === "L" ? 60 : width - 60, height / 2, currentScene));
  return true;
}

// A key towards a room you don't own: first press asks, second buys
function houseKeyTowardsLocked(p) {
  const now = performance.now();
  if (_pendingRoomBuy && _pendingRoomBuy.dir === p.dir && now < _pendingRoomBuy.until) return buyRoomPortal(p);
  _pendingRoomBuy = { dir: p.dir, until: now + 4000 };
  const key = HOUSE_KEYS[p.type];
  addUIMessage(`Press ${key} again to buy new quarters for $${p.cost.toLocaleString()}.`);
  return false;
}

// Mouse down (UI.js): the wall hints
function houseNavClick() {
  for (const chip of houseNavChips()) {
    if (!isPointInRect(mouse.x, mouse.y, chip.x, chip.y, chip.w, chip.h)) continue;
    if (chip.portal.locked) buyRoomPortal(chip.portal);
    else changeScene(chip.portal.target);
    return true;
  }
  return false;
}
