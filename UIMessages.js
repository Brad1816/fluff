// ---------------------------------------------------------------------------
// Messages on screen: the message list (addUIMessage), debug messages,
// door knocks and TV captions. Split out of UI.js.
// ---------------------------------------------------------------------------

function addUIMessage(text) {
  uiMessages.push({ text: text, timer: 5.0, opacity: 1.0 });
}

// Where messages go: top middle, just below the top bar and the wall, so
// they're clear of the money, clock and buttons in the top left
const UI_MESSAGE_MAX = 5; // newest ones shown at once
const UI_MESSAGE_WIDTH = 620;

function uiMessageLayout() {
  return { cx: width / 2, top: Math.round(height * 0.15) + 10, maxW: Math.min(UI_MESSAGE_WIDTH, width - 40) };
}

function _wrapMessage(c, text, maxW) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (line && c.measureText(test).width > maxW) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawUIMessages(ctx) {
  if (uiMessages.length === 0) return;
  const L = uiMessageLayout();
  ctx.save();
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let y = L.top;
  for (const msg of uiMessages.slice(-UI_MESSAGE_MAX)) {
    const lines = _wrapMessage(ctx, msg.text, L.maxW - 28);
    const w = Math.min(L.maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28);
    const h = lines.length * 18 + 10;
    const a = Math.max(0, Math.min(1, msg.opacity ?? 1));
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(20, 22, 32, 0.82)";
    if (typeof fillRoundRect === "function") fillRoundRect(ctx, L.cx - w / 2, y, w, h, 10);
    else ctx.fillRect(L.cx - w / 2, y, w, h);
    ctx.strokeStyle = "rgba(255, 214, 240, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "white";
    lines.forEach((l, i) => ctx.fillText(l, L.cx, y + 14 + i * 18));
    y += h + 6;
  }
  ctx.restore();
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
