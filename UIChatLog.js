// ---------------------------------------------------------------------------
// The chat log panel. Split out of UI.js.
// ---------------------------------------------------------------------------

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
