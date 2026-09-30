// ---------------------------------------------------------------------------
// Story debug view (design doc Phase 0, stage 3): see what the story book
// (StoryBook.js) has recorded, for balancing and checking. Press J.
//
// Tabs:
//   Fluffy  every event the chosen fluffy is in, newest first (tallies too)
//   Family  its family's shared story (storyOfFamily)
//   Book    the whole book: size against the cap, counts by kind
// The side column shows the fluffy's room: crowding (Population.js), and
// placeholders for climate (phase 3) and titles (phase 4).
// Prev / Next pick another of your fluffies (it starts on the one in the
// magnifying glass, or the first of yours). "Compact" runs compactStory now.
// ---------------------------------------------------------------------------

let storyDebugOpen = false;
let storyDebugTab = "fluffy"; // fluffy | family | book
let storyDebugId = null;
let storyDebugPage = 0;
const SD_ROWS = 16;

function _sdCandidates() {
  const mine = fluffies.filter((f) => f.adopted && f.isAlive);
  return mine.length ? mine : fluffies.filter((f) => f.isAlive);
}

function openStoryDebug() {
  storyDebugOpen = true;
  storyDebugPage = 0;
  const pick = (typeof inspectedFluffy !== "undefined" && inspectedFluffy) || _sdCandidates()[0] || null;
  storyDebugId = pick ? pick.id : null;
}
function closeStoryDebug() {
  storyDebugOpen = false;
}
function isStoryDebugOpen() {
  return storyDebugOpen;
}

function _sdFluffy() {
  return fluffies.find((f) => f.id === storyDebugId) || null;
}

function _sdLines() {
  if (storyDebugTab === "book") {
    const t = storyTotals();
    const lines = [
      `Events: ${t.events} (${t.big} big, ${t.tallies} tallies holding ${t.talliedActs} small acts)`,
      `Size: about ${(t.bytes / 1024).toFixed(1)} KB of ${(STORY_CAP_BYTES / 1024 / 1024).toFixed(0)} MB`,
      "",
      "By kind:",
    ];
    for (const [k, v] of Object.entries(t.kinds).sort((a, b) => b[1] - a[1])) lines.push(`  ${k}: ${v}`);
    return lines;
  }
  const id = storyDebugId;
  if (id === null) return ["No fluffy chosen."];
  const events = storyDebugTab === "family" ? storyOfFamily(id) : storyOf(id);
  if (!events.length) return ["Nothing recorded yet."];
  return events
    .slice()
    .reverse()
    .map((e) => (e.k === "tally" ? storyEventText(e) : `Day ${Math.floor(e.t / DAY_LENGTH) + 1}  ${storyEventText(e)}`));
}

function getStoryDebugLayout() {
  const w = Math.min(1000, width - 30);
  const h = Math.min(640, height - 30);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  const tabs = ["fluffy", "family", "book"].map((id, i) => ({ id, x: x + 24 + i * 118, y: y + 58, w: 110, h: 30, label: id[0].toUpperCase() + id.slice(1) }));
  return {
    x,
    y,
    w,
    h,
    tabs,
    listX: x + 24,
    listY: y + 108,
    listW: w - 330,
    prev: { x: x + w - 290, y: y + 58, w: 60, h: 30 },
    next: { x: x + w - 224, y: y + 58, w: 60, h: 30 },
    compact: { x: x + w - 158, y: y + 58, w: 134, h: 30 },
    up: { x: x + 24, y: y + h - 46, w: 50, h: 32 },
    down: { x: x + 80, y: y + h - 46, w: 50, h: 32 },
    close: { x: x + w - 150, y: y + h - 46, w: 130, h: 32 },
  };
}

function drawStoryDebug(c) {
  if (!storyDebugOpen) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const L = getStoryDebugLayout();
  const f = _sdFluffy();
  c.save();
  drawScreenPanel(c, L, { theme: "pink" });
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.fillStyle = "#ffd6f0";
  c.font = "bold 22px Arial";
  const who = storyDebugId !== null && typeof fluffyDisplayNameById === "function" ? fluffyDisplayNameById(storyDebugId) : "";
  c.fillText(fitText(c, `Story debug${who && storyDebugTab !== "book" ? ` · ${who}` : ""}`, L.w - 60), L.x + 24, L.y + 38);
  for (const t of L.tabs) {
    drawGlassButton(t.x, t.y, t.w, t.h, t.label, { fontSize: 13, borderRadius: 8, normalFill: t.id === storyDebugTab ? "rgba(255, 170, 220, 0.35)" : "rgba(0,0,0,0.15)" });
  }
  drawGlassButton(L.prev.x, L.prev.y, L.prev.w, L.prev.h, "◀", { fontSize: 13, borderRadius: 8 });
  drawGlassButton(L.next.x, L.next.y, L.next.w, L.next.h, "▶", { fontSize: 13, borderRadius: 8 });
  drawGlassButton(L.compact.x, L.compact.y, L.compact.w, L.compact.h, "Compact now", { fontSize: 13, borderRadius: 8 });

  // The list
  const lines = _sdLines();
  const pages = Math.max(1, Math.ceil(lines.length / SD_ROWS));
  storyDebugPage = Math.max(0, Math.min(pages - 1, storyDebugPage));
  c.font = "13px Arial";
  lines.slice(storyDebugPage * SD_ROWS, (storyDebugPage + 1) * SD_ROWS).forEach((line, i) => {
    c.fillStyle = /small things:/.test(line) && storyDebugTab !== "book" ? "rgba(255,255,255,0.6)" : "white";
    c.fillText(fitText(c, line, L.listW), L.listX, L.listY + i * 26);
  });

  // Side column: the room and what's coming
  const sx = L.x + L.w - 290;
  let sy = L.listY;
  const side = (label, value, colour) => {
    c.font = "bold 12px Arial";
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillText(label, sx, sy);
    c.font = "13px Arial";
    c.fillStyle = colour || "white";
    c.fillText(fitText(c, String(value), 266), sx, sy + 18);
    sy += 46;
  };
  if (f) {
    const room = typeof householdRoomName === "function" ? householdRoomName(f.scene) : f.scene;
    side("Room", room);
    const space = typeof roomSpace === "function" ? roomSpace(f.scene) : null;
    if (space) {
      const over = crowding(f.scene);
      side("Crowding", `${roomLoad(f.scene)}/${space}${over > 0 ? ` (${Math.round(over * 100)}% over)` : ""}`, over > 0 ? "#ff8a80" : null);
    }
    side("Room climate", "not yet (phase 3)", "rgba(255,255,255,0.5)");
    side("Title", "not yet (phase 4)", "rgba(255,255,255,0.5)");
    side("Its events", `${storyOf(f).length} (family ${storyOfFamily(f).length})`);
    side("Age", typeof describeAge === "function" ? describeAge(f) : "");
  }
  const t = storyTotals();
  side("Story book", `${t.events} events, ~${(t.bytes / 1024).toFixed(1)} KB`);

  if (pages > 1) {
    drawGlassButton(L.up.x, L.up.y, L.up.w, L.up.h, "▲", { fontSize: 14, borderRadius: 8 });
    drawGlassButton(L.down.x, L.down.y, L.down.w, L.down.h, "▼", { fontSize: 14, borderRadius: 8 });
    c.font = "13px Arial";
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.fillText(`${storyDebugPage + 1} / ${pages}`, L.down.x + L.down.w + 12, L.down.y + 21);
  }
  drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 15, borderRadius: 10 });
  c.restore();
}

function handleStoryDebugClick() {
  if (!storyDebugOpen) return false;
  const L = getStoryDebugLayout();
  const hit = (b) => isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h);
  if (hit(L.close) || !hit(L)) {
    closeStoryDebug();
    return true;
  }
  for (const t of L.tabs) {
    if (hit(t)) {
      storyDebugTab = t.id;
      storyDebugPage = 0;
      return true;
    }
  }
  const list = _sdCandidates();
  const i = list.findIndex((f) => f.id === storyDebugId);
  if (hit(L.prev) && list.length) {
    storyDebugId = list[(i - 1 + list.length) % list.length].id;
    storyDebugPage = 0;
    return true;
  }
  if (hit(L.next) && list.length) {
    storyDebugId = list[(i + 1) % list.length].id;
    storyDebugPage = 0;
    return true;
  }
  if (hit(L.compact)) {
    compactStory();
    return true;
  }
  if (hit(L.up)) {
    storyDebugPage = Math.max(0, storyDebugPage - 1);
    return true;
  }
  if (hit(L.down)) {
    storyDebugPage++;
    return true;
  }
  return true;
}

registerScreen({
  name: "storyDebug",
  layer: 23,
  isOpen: () => storyDebugOpen,
  close: () => closeStoryDebug(),
  draw: (c) => drawStoryDebug(c),
  click: () => handleStoryDebugClick(),
});
