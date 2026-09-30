// ---------------------------------------------------------------------------
// Household: every fluffy you own on one screen, and what each one needs.
//
// Open with the "Household" button (after Records) or O. One row per living
// fluffy of yours:
//   - portrait, name, ♂/♀, life stage, and which room it's in
//   - affection hearts (Affection.js)
//   - "needs" chips: the same warnings the magnifying glass shows in its
//     header (UIInspection.js getInspectionTabs), in a word or two -
//     Hungry, Unhappy, Hurt, Tired, Bored, Dirty, Cold, Frightened, ...
//   - lessons it could do with (Lessons.js lessonsFor)
// Fluffies that need something come first (most needs first), then everyone
// else by name. Tabs: "Everyone" / "Needs something". Click a row to go to
// that fluffy's room (if it's in your house or backyard) and open its
// magnifying glass.
// ---------------------------------------------------------------------------

const HH_W = 1000;
const HH_ROW_H = 62;

let householdOpen = false;
let householdTab = "all"; // "all" | "needs"
let householdPage = 0;

function openHousehold() {
  _hhCache = null;
  householdOpen = true;
  householdPage = 0;
}
function closeHousehold() {
  householdOpen = false;
}
function isHouseholdOpen() {
  return householdOpen;
}

// Warning labels -> a word or two for the chips
const HH_NEED_WORDS = {
  Happiness: "Unhappy",
  Hunger: "Hungry",
  Health: "Hurt",
  Sleep: "Tired",
  Boredom: "Bored",
  Cleanliness: "Dirty",
  Warmth: "Cold",
  Frightened: "Frightened",
  Diet: "Poor diet",
  Weight: "Weight",
  Alicorns: "Scared of alicorns",
  Affection: "Unloved",
  Missing: "Missing parts",
};

// Red in the magnifying glass but not something to see to (it's how it is)
const HH_NOT_NEEDS = new Set(["Coat", "Alicorns"]);

// ["Hungry", "Dirty", ...] and the full warnings
function householdNeeds(f) {
  let warnings = [];
  try {
    warnings = typeof getInspectionTabs === "function" ? getInspectionTabs(f).warnings : [];
  } catch (e) {
    warnings = [];
  }
  warnings = warnings.filter((w) => !HH_NOT_NEEDS.has(w.split(":")[0].trim()));
  const words = [];
  for (const w of warnings) {
    const i = w.indexOf(":");
    const label = i >= 0 ? w.slice(0, i).trim() : null;
    const word = label ? HH_NEED_WORDS[label] || label : w;
    if (!words.includes(word)) words.push(word);
  }
  return { words, warnings };
}

function householdRoomName(scene) {
  const room = typeof houseRoomName === "function" ? houseRoomName(scene) : "";
  if (room) return room;
  const named = { BACKYARD: "Backyard", PARK: "Fluffy Park" };
  if (named[scene]) return named[scene];
  return String(scene || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (ch) => ch.toUpperCase());
}

// Can you walk there with the room buttons (your house and backyard)?
function _hhReachable(scene) {
  if (scene === "BACKYARD") return true;
  return typeof playerQuartersAndNotBackyard === "function" && playerQuartersAndNotBackyard(scene);
}

function _hhName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Fluffy";
}

// (worked out at most every HH_CACHE_MS of real time while it's open)
const HH_CACHE_MS = 400;
let _hhCache = null;

// Rows: [{ f, words, warnings, lessons, room }]
function computeHousehold() {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (_hhCache && now - _hhCache.at < HH_CACHE_MS && _hhCache.n === fluffies.length) return _hhCache.data;
  const data = _computeHousehold();
  _hhCache = { at: now, n: fluffies.length, data };
  return data;
}

function _computeHousehold() {
  const mine = fluffies.filter((f) => f.isAlive && f.adopted);
  const rows = mine.map((f) => {
    const n = householdNeeds(f);
    return {
      f,
      words: n.words,
      warnings: n.warnings,
      lessons: typeof lessonsFor === "function" ? lessonsFor(f).map((l) => l.name) : [],
      room: householdRoomName(f.scene),
    };
  });
  rows.sort((a, b) => b.words.length - a.words.length || _hhName(a.f).localeCompare(_hhName(b.f)));
  return {
    rows,
    total: rows.length,
    needing: rows.filter((r) => r.words.length).length,
  };
}

function getHouseholdLayout(data = computeHousehold()) {
  const w = Math.min(HH_W, width - 30);
  const h = Math.min(660, height - 30);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  const listTop = y + 142;
  const items = householdTab === "needs" ? data.rows.filter((r) => r.words.length) : data.rows;
  const perPage = Math.max(1, Math.floor((h - 142 - 60) / HH_ROW_H));
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  householdPage = Math.max(0, Math.min(pages - 1, householdPage));
  const rows = items.slice(householdPage * perPage, (householdPage + 1) * perPage).map((item, i) => ({
    item,
    x: x + 20,
    y: listTop + i * HH_ROW_H,
    w: w - 40,
    h: HH_ROW_H - 6,
  }));
  return {
    x,
    y,
    w,
    h,
    rows,
    pages,
    items,
    tabs: [
      { id: "all", x: x + 24, y: y + 60, w: 130, h: 32, label: `Everyone (${data.total})` },
      { id: "needs", x: x + 162, y: y + 60, w: 190, h: 32, label: `Needs something (${data.needing})` },
    ],
    prev: { x: x + 24, y: y + h - 46, w: 50, h: 32 },
    next: { x: x + 80, y: y + h - 46, w: 50, h: 32 },
    close: { x: x + w - 150, y: y + h - 46, w: 130, h: 32 },
  };
}

const HH_COLS = { name: 70, room: 330, hearts: 470, needs: 580 };

function _hhChip(c, x, y, text, bad) {
  c.font = "bold 12px Arial";
  const w = c.measureText(text).width + 16;
  fillRoundRect(c, x, y - 10, w, 20, 9, bad ? "rgba(200, 60, 70, 0.85)" : "rgba(60, 130, 120, 0.8)");
  c.fillStyle = "white";
  c.textAlign = "left";
  c.fillText(text, x + 8, y + 1);
  return w;
}

function _drawHouseholdRow(c, r, over) {
  const { f, words, lessons, room, warnings } = r.item;
  // Portrait
  c.save();
  fillRoundRect(c, r.x + 8, r.y + 4, 48, 48, 8, "rgba(255,255,255,0.06)");
  c.beginPath();
  c.rect(r.x + 8, r.y + 4, 48, 48);
  c.clip();
  try {
    if (typeof f.drawPortrait === "function") f.drawPortrait(c, r.x + 30, r.y + 34, 38);
  } catch (e) {
    // (portrait not ready)
  }
  c.restore();
  const col = (k) => r.x + HH_COLS[k] * ((r.w - 24) / 940);
  // Name and stage
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.font = "bold 15px Arial";
  c.fillStyle = "white";
  c.fillText(fitText(c, `${f.gender === "male" ? "♂" : "♀"} ${_hhName(f)}`, col("room") - col("name") - 10), col("name"), r.y + 24);
  c.font = "12px Arial";
  c.fillStyle = "rgba(255,255,255,0.6)";
  const stage = typeof lifeStage === "function" ? lifeStage(f) : "";
  const extra = [];
  if (stage) extra.push(stage.charAt(0).toUpperCase() + stage.slice(1));
  if (f.type) extra.push(f.type);
  if (f.pregnancyTimer > 0) extra.push("pregnant");
  c.fillText(fitText(c, extra.join(" · "), col("room") - col("name") - 10), col("name"), r.y + 42);
  // Room
  c.font = "13px Arial";
  c.fillStyle = f.scene === currentScene ? "#ffd6f0" : "rgba(255,255,255,0.85)";
  c.fillText(fitText(c, room + (f.scene === currentScene ? " (here)" : ""), col("hearts") - col("room") - 8), col("room"), r.y + 33);
  // Hearts
  c.font = "15px Arial";
  c.fillStyle = "#ff8fbf";
  const hearts = typeof affectionHeartText === "function" ? affectionHeartText(f) : "";
  c.fillText(hearts, col("hearts"), r.y + 33);
  // Needs chips, then lessons
  let x = col("needs");
  const maxX = r.x + r.w - 10;
  c.textBaseline = "middle";
  if (!words.length) {
    c.font = "13px Arial";
    c.fillStyle = "#9fe0a8";
    c.fillText("All good ✓", x, r.y + 20);
  }
  let shown = 0;
  for (const word of words) {
    c.font = "bold 12px Arial";
    if (x + c.measureText(word).width + 16 > maxX - 40) break;
    x += _hhChip(c, x, r.y + 20, word, true) + 6;
    shown++;
  }
  if (shown < words.length) {
    c.font = "12px Arial";
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.fillText(`+${words.length - shown}`, x, r.y + 20);
  }
  if (lessons.length) {
    c.font = "12px Arial";
    c.fillStyle = "#7fe0d0";
    c.fillText(fitText(c, `Lessons: ${lessons.join(", ")}`, maxX - col("needs")), col("needs"), r.y + 42);
  }
  c.textBaseline = "alphabetic";
  return over && warnings.length ? warnings.join(" · ") : null;
}

function drawHousehold(c) {
  if (!householdOpen) return;
  if (typeof ctx !== "undefined" && c !== ctx) return; // screen pass only
  const data = computeHousehold();
  const L = getHouseholdLayout(data);
  c.save();
  drawScreenPanel(c, L, { theme: "pink" });

  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.fillStyle = "#ffd6f0";
  c.font = "bold 24px Arial";
  c.fillText("Household", L.x + 24, L.y + 40);
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.75)";
  c.textAlign = "right";
  c.fillText(
    data.total ? `${data.total} fluff${data.total === 1 ? "y" : "ies"} · ${data.needing ? `${data.needing} need${data.needing === 1 ? "s" : ""} something` : "everyone's fine"}` : "",
    L.x + L.w - 24,
    L.y + 40,
  );
  for (const tab of L.tabs) {
    const on = tab.id === householdTab;
    drawGlassButton(tab.x, tab.y, tab.w, tab.h, tab.label, {
      fontSize: 14,
      borderRadius: 8,
      normalFill: on ? "rgba(255, 170, 220, 0.35)" : "rgba(0, 0, 0, 0.15)",
    });
  }
  c.textAlign = "left";
  c.font = "12px Arial";
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.fillText("Click a fluffy to go to it and open its magnifying glass.", L.x + 370, L.y + 81);
  // Helpers that need you (FeedBot.js)
  const bots = (typeof crowdedRoomLines === "function" ? crowdedRoomLines() : []).concat(typeof feedBotStatusLines === "function" ? feedBotStatusLines() : []);
  if (bots.length) {
    c.textAlign = "right";
    c.font = "bold 12px Arial";
    c.fillStyle = "#ffb3b3";
    c.fillText(fitText(c, "⚠ " + bots.join(" · "), 460), L.x + L.w - 24, L.y + 104);
    c.textAlign = "left";
  }
  // Column headings
  c.font = "bold 12px Arial";
  c.fillStyle = "rgba(255,255,255,0.6)";
  const colX = (k) => L.x + 20 + HH_COLS[k] * ((L.w - 40 - 24) / 940);
  c.fillText("Fluffy", colX("name"), L.y + 130);
  c.fillText("Where", colX("room"), L.y + 130);
  c.fillText("Affection", colX("hearts"), L.y + 130);
  c.fillText("Needs", colX("needs"), L.y + 130);

  if (!L.rows.length) {
    c.textAlign = "center";
    c.font = "15px Arial";
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.fillText(
      data.total ? "Nobody needs anything right now. ✓" : "You don't have any fluffies yet.",
      L.x + L.w / 2,
      L.y + 220,
    );
  }
  let hoverText = null;
  for (const r of L.rows) {
    const over = isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h);
    c.fillStyle = over ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)";
    fillRoundRect(c, r.x, r.y, r.w, r.h, 8);
    const t = _drawHouseholdRow(c, r, over);
    if (t) hoverText = t;
  }
  // The full warnings of the row under the mouse
  if (hoverText) {
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.font = "13px Arial";
    c.fillStyle = "#ffb3b3";
    const left = L.pages > 1 ? L.next.x + L.next.w + 70 : L.x + 24;
    c.fillText(fitText(c, hoverText, L.close.x - left - 16), left, L.close.y + L.close.h / 2);
    c.textBaseline = "alphabetic";
  }
  if (L.pages > 1) {
    drawGlassButton(L.prev.x, L.prev.y, L.prev.w, L.prev.h, "▲", { fontSize: 14, borderRadius: 8 });
    drawGlassButton(L.next.x, L.next.y, L.next.w, L.next.h, "▼", { fontSize: 14, borderRadius: 8 });
    c.textAlign = "left";
    c.font = "13px Arial";
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.fillText(`${householdPage + 1} / ${L.pages}`, L.next.x + L.next.w + 12, L.next.y + 21);
  }
  drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 15, borderRadius: 10 });
  c.restore();
}

// Go to a fluffy: its room (if you can walk there) and its magnifying glass
function goToFluffy(f) {
  if (!f) return false;
  closeHousehold();
  if (f.scene !== currentScene && _hhReachable(f.scene) && typeof changeScene === "function") changeScene(f.scene);
  inspectedFluffy = f;
  inspectionTab = "overview";
  return true;
}

// Mouse down (screen positions); swallows clicks while open
function handleHouseholdClick() {
  if (!householdOpen) return false;
  const L = getHouseholdLayout();
  const hit = (b) => isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h);
  if (hit(L.close) || !hit(L)) {
    closeHousehold();
    return true;
  }
  for (const t of L.tabs) {
    if (hit(t)) {
      householdTab = t.id;
      householdPage = 0;
      return true;
    }
  }
  if (L.pages > 1 && hit(L.prev)) {
    householdPage = Math.max(0, householdPage - 1);
    return true;
  }
  if (L.pages > 1 && hit(L.next)) {
    householdPage = Math.min(L.pages - 1, householdPage + 1);
    return true;
  }
  for (const r of L.rows) {
    if (hit(r)) {
      goToFluffy(r.item.f);
      return true;
    }
  }
  return true;
}

registerScreen({
  name: "household",
  layer: 22,
  isOpen: () => householdOpen,
  close: () => closeHousehold(),
  draw: (c) => drawHousehold(c),
  click: () => handleHouseholdClick(),
});
