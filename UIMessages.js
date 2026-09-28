// ---------------------------------------------------------------------------
// Messages on screen: the message list (addUIMessage), debug messages,
// door knocks and TV captions. Split out of UI.js.
// ---------------------------------------------------------------------------

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
