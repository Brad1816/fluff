// ---------------------------------------------------------------------------
// Breeding records: every litter you've bred and how each parent is doing.
//
// Open with the "Records" button (after Goals) or L. Two tabs:
//   Litters  newest first: the day, mum x dad, and each foal with what became
//            of it (alive and how old, sold and for how much, died and why)
//   Parents  every mare and stallion that has had foals with you: status and
//            age, litters, foals, how many sold and for how much in all,
//            best sale, rare foals (unicorns, pegasi, alicorns, spots,
//            stripes) and, for mares, breeding days left before they're too
//            old (Aging.js ELDERLY_DAYS). Sorted by money earned.
// Click a row to open that fluffy's family tree.
//
// Everything comes from the family record book (FamilyTree.js
// fluffyRecords): rec.bred (born at home to your mare), rec.soldFor (price
// when sold, noteFluffyLeft), rec.age, rec.bornAt, parents and status. A
// litter is foals of one mum born within LITTER_WINDOW seconds.
// ---------------------------------------------------------------------------

const LITTER_WINDOW = 300; // seconds between the first and last foal of a litter
const BR_W = 1000;
const BR_ROW_H = { litters: 70, parents: 46 };

let recordsOpen = false;
let recordsTab = "litters"; // "litters" | "parents"
let recordsPage = 0;

// ---- Working out the records ----

function _brDay(seconds) {
  return Math.floor(((seconds || 0) + START_HOUR * HOUR_LENGTH) / DAY_LENGTH) + 1;
}

function _brAgeDays(rec) {
  return Math.floor((rec.age || 0) / DAY_LENGTH);
}

function _brRare(rec) {
  const out = [];
  if (rec.type && rec.type !== "earthy") out.push(rec.type);
  if (typeof stockVisibleFeatures === "function" && Array.isArray(rec.genes)) out.push(...stockVisibleFeatures(rec.genes));
  return out;
}

// What became of a foal: [text, tone]
function describeFoalOutcome(rec) {
  const s = rec.status;
  if (s === "alive") return [`alive, ${_brAgeDays(rec)}d`, "good"];
  if (s === "sold") return [rec.soldFor ? `sold $${rec.soldFor.toLocaleString()}` : "sold", "money"];
  if (s === "dead") {
    const cause = rec.causeOfDeath === "Old age" ? "old age" : rec.causeOfDeath ? rec.causeOfDeath.toLowerCase() : "died";
    return [`died (${cause})`, "bad"];
  }
  if (s === "day care") return ["at day care", ""];
  if (s === "taken") return ["taken by dogs", "bad"];
  return [s || "gone", ""];
}

let _brCache = null;
let _brCacheAt = 0;

// (worked out at most twice a second while the screen is open)
function computeBreedingRecords(fresh = false) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!fresh && _brCache && now - _brCacheAt < 500) return _brCache;
  _brCache = _computeBreedingRecords();
  _brCacheAt = now;
  return _brCache;
}

function _computeBreedingRecords() {
  if (typeof syncFamilyRecords === "function") syncFamilyRecords();
  const bred = Object.values(typeof fluffyRecords !== "undefined" ? fluffyRecords : {}).filter((r) => r.bred);

  // Litters: by mum, split where births are far apart
  const byMum = {};
  for (const r of bred) (byMum[r.motherId] = byMum[r.motherId] || []).push(r);
  const litters = [];
  for (const mumId in byMum) {
    const foals = byMum[mumId].sort((a, b) => (a.bornAt || 0) - (b.bornAt || 0));
    let cur = null;
    for (const f of foals) {
      if (!cur || (f.bornAt || 0) - cur.bornAt > LITTER_WINDOW) {
        cur = { mumId: foals[0].motherId, bornAt: f.bornAt || 0, foals: [] };
        litters.push(cur);
      }
      cur.foals.push(f);
    }
  }
  for (const l of litters) {
    const dads = [...new Set(l.foals.map((f) => f.fatherId).filter((d) => d !== null && d !== undefined))];
    l.dadIds = dads;
    l.day = _brDay(l.bornAt);
    l.earned = l.foals.reduce((s, f) => s + (f.soldFor || 0), 0);
  }
  litters.sort((a, b) => b.bornAt - a.bornAt);

  // Parents
  const parents = {};
  const parent = (id) => {
    if (id === null || id === undefined) return null;
    if (!parents[id]) parents[id] = { id, litters: 0, foals: 0, sold: 0, earned: 0, best: 0, rare: 0, alive: 0 };
    return parents[id];
  };
  for (const l of litters) {
    const ids = [l.mumId, ...l.dadIds];
    for (const id of ids) {
      const p = parent(id);
      if (!p) continue;
      p.litters++;
      const theirs = id === l.mumId ? l.foals : l.foals.filter((f) => f.fatherId === id);
      for (const f of theirs) {
        p.foals++;
        if (f.status === "sold") {
          p.sold++;
          p.earned += f.soldFor || 0;
          p.best = Math.max(p.best, f.soldFor || 0);
        }
        if (f.status === "alive") p.alive++;
        if (_brRare(f).length) p.rare++;
      }
    }
  }
  const parentList = Object.values(parents).map((p) => {
    const rec = getFamilyRecord(p.id) || { id: p.id };
    const live = fluffies.find((x) => x.id == p.id);
    p.rec = rec;
    p.gender = rec.gender;
    p.status = live && live.isAlive ? "alive" : rec.status || "gone";
    p.ageDays = live ? Math.floor(ageDays(live)) : _brAgeDays(rec);
    p.stage = live && live.isAlive && typeof lifeStage === "function" ? lifeStage(live) : null;
    // Breeding days left (mares, alive): until elderly
    p.daysLeft =
      p.gender === "female" && p.status === "alive" && typeof ELDERLY_DAYS === "number"
        ? Math.max(0, Math.floor(ELDERLY_DAYS - (live ? ageDays(live) : 0)))
        : null;
    return p;
  });
  parentList.sort((a, b) => b.earned - a.earned || b.foals - a.foals);

  const totals = {
    litters: litters.length,
    foals: bred.length,
    sold: bred.filter((r) => r.status === "sold").length,
    earned: bred.reduce((s, r) => s + (r.status === "sold" ? r.soldFor || 0 : 0), 0),
    alive: bred.filter((r) => r.status === "alive").length,
    died: bred.filter((r) => r.status === "dead").length,
  };
  return { litters, parents: parentList, totals };
}

// ---- The screen (screen pass only) ----

function openRecords() {
  recordsOpen = true;
  recordsPage = 0;
  _brCache = null;
}
function closeRecords() {
  recordsOpen = false;
}
function isRecordsOpen() {
  return recordsOpen;
}

function getRecordsLayout(data = computeBreedingRecords()) {
  const w = Math.min(BR_W, width - 30);
  const h = Math.min(660, height - 30);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  // (parents have column headings above the list)
  const top = recordsTab === "parents" ? 150 : 112;
  const listTop = y + top;
  const rowH = BR_ROW_H[recordsTab];
  const perPage = Math.max(1, Math.floor((h - top - 60) / rowH));
  const items = recordsTab === "litters" ? data.litters : data.parents;
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  recordsPage = Math.max(0, Math.min(pages - 1, recordsPage));
  const rows = items.slice(recordsPage * perPage, (recordsPage + 1) * perPage).map((item, i) => ({
    item,
    x: x + 20,
    y: listTop + i * rowH,
    w: w - 40,
    h: rowH - 6,
  }));
  return {
    x,
    y,
    w,
    h,
    rows,
    pages,
    tabs: [
      { id: "litters", x: x + 24, y: y + 60, w: 120, h: 32, label: "Litters" },
      { id: "parents", x: x + 152, y: y + 60, w: 120, h: 32, label: "Parents" },
    ],
    prev: { x: x + 24, y: y + h - 46, w: 50, h: 32 },
    next: { x: x + 80, y: y + h - 46, w: 50, h: 32 },
    close: { x: x + w - 150, y: y + h - 46, w: 130, h: 32 },
  };
}

function _brDot(c, x, y, rec) {
  const col = typeof _geneRGB === "function" && Array.isArray(rec.genes) ? _geneRGB(rec.genes, 0) : "#ccc";
  c.fillStyle = col;
  c.beginPath();
  c.arc(x, y, 7, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(0,0,0,0.5)";
  c.lineWidth = 1;
  c.stroke();
}

function _brName(id) {
  if (id === null || id === undefined) return "Unknown";
  return typeof fluffyDisplayNameById === "function" ? fluffyDisplayNameById(id) : getFamilyName(getFamilyRecord(id));
}

function _brFit(c, text, maxW) {
  if (c.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 2 && c.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

const _BR_TONES = { good: "#9fe0a8", bad: "#ff8a80", money: "#f7d774", "": "rgba(255,255,255,0.8)" };

function _drawLitterRow(c, r) {
  const l = r.item;
  c.textAlign = "left";
  c.font = "bold 14px Arial";
  c.fillStyle = "#ffd6f0";
  c.fillText(`Day ${l.day}`, r.x + 12, r.y + 22);
  c.font = "bold 14px Arial";
  c.fillStyle = "white";
  const dads = l.dadIds.length ? l.dadIds.map(_brName).join(" / ") : "unknown dad";
  c.fillText(_brFit(c, `${_brName(l.mumId)} × ${dads}`, r.w - 330), r.x + 80, r.y + 22);
  c.textAlign = "right";
  c.font = "13px Arial";
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.fillText(
    `${l.foals.length} foal${l.foals.length === 1 ? "" : "s"}${l.earned ? ` · earned $${l.earned.toLocaleString()}` : ""}`,
    r.x + r.w - 12,
    r.y + 22,
  );
  // Foals
  c.textAlign = "left";
  const chipW = Math.floor((r.w - 24) / 5);
  l.foals.slice(0, 5).forEach((f, i) => {
    const cx = r.x + 12 + i * chipW;
    const cy = r.y + 46;
    _brDot(c, cx + 8, cy - 4, f);
    const [out, tone] = describeFoalOutcome(f);
    const rare = _brRare(f);
    c.font = "12px Arial";
    c.fillStyle = "white";
    const name = (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || f.name || (f.gender === "male" ? "colt" : "filly");
    c.fillText(_brFit(c, `${name}${rare.length ? " ★" : ""}`, chipW - 26), cx + 20, cy - 8);
    c.fillStyle = _BR_TONES[tone] || _BR_TONES[""];
    c.fillText(_brFit(c, out, chipW - 26), cx + 20, cy + 8);
  });
  if (l.foals.length > 5) {
    c.textAlign = "right";
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillText(`+${l.foals.length - 5} more`, r.x + r.w - 12, r.y + 58);
  }
}

const BR_PARENT_COLS = [
  ["Parent", 0],
  ["Status", 230],
  ["Litters", 380],
  ["Foals", 450],
  ["Sold", 515],
  ["Earned", 580],
  ["Best sale", 670],
  ["Rare", 760],
  ["Breeding left", 820],
];

function _drawParentRow(c, r) {
  const p = r.item;
  const col = (i) => r.x + 12 + BR_PARENT_COLS[i][1] * ((r.w - 24) / 940);
  c.textAlign = "left";
  _brDot(c, col(0) + 7, r.y + 20, p.rec);
  c.font = "bold 14px Arial";
  c.fillStyle = "white";
  c.fillText(_brFit(c, `${p.gender === "male" ? "♂" : "♀"} ${_brName(p.id)}`, col(1) - col(0) - 30), col(0) + 20, r.y + 25);
  c.font = "13px Arial";
  let status;
  let tone = "";
  if (p.status === "alive") {
    status = `${p.stage ? p.stage.charAt(0).toUpperCase() + p.stage.slice(1) : "Alive"}, ${p.ageDays}d`;
    tone = p.stage === "elderly" ? "bad" : "good";
  } else {
    status = typeof FAMILY_STATUS_TEXT !== "undefined" ? FAMILY_STATUS_TEXT[p.status] || p.status : p.status;
    tone = p.status === "dead" ? "bad" : "";
  }
  c.fillStyle = _BR_TONES[tone];
  c.fillText(_brFit(c, status, col(2) - col(1) - 8), col(1), r.y + 25);
  c.fillStyle = "rgba(255,255,255,0.9)";
  c.fillText(String(p.litters), col(2), r.y + 25);
  c.fillText(String(p.foals), col(3), r.y + 25);
  c.fillText(String(p.sold), col(4), r.y + 25);
  c.fillStyle = _BR_TONES.money;
  c.fillText(p.earned ? `$${p.earned.toLocaleString()}` : "-", col(5), r.y + 25);
  c.fillText(p.best ? `$${p.best.toLocaleString()}` : "-", col(6), r.y + 25);
  c.fillStyle = p.rare ? "#9fd8ff" : "rgba(255,255,255,0.5)";
  c.fillText(p.rare ? `★ ${p.rare}` : "-", col(7), r.y + 25);
  if (p.daysLeft !== null) {
    c.fillStyle = p.daysLeft <= 3 ? _BR_TONES.bad : _BR_TONES[""];
    c.fillText(p.daysLeft > 0 ? `${p.daysLeft} days` : "too old", col(8), r.y + 25);
  } else {
    c.fillStyle = "rgba(255,255,255,0.4)";
    c.fillText(p.gender === "male" && p.status === "alive" ? "any time" : "-", col(8), r.y + 25);
  }
}

function drawBreedingRecords(c) {
  if (!recordsOpen) return;
  if (typeof ctx !== "undefined" && c !== ctx) return; // screen pass only
  const data = computeBreedingRecords();
  const L = getRecordsLayout(data);
  c.save();
  c.globalAlpha = 1;
  c.textBaseline = "alphabetic";
  c.fillStyle = "rgba(0,0,0,0.55)";
  c.fillRect(0, 0, width, height);
  c.fillStyle = "#1f2433";
  c.strokeStyle = "rgba(255, 214, 240, 0.8)";
  c.lineWidth = 3;
  c.beginPath();
  if (c.roundRect) c.roundRect(L.x, L.y, L.w, L.h, 16);
  else c.rect(L.x, L.y, L.w, L.h);
  c.fill();
  c.stroke();

  c.textAlign = "left";
  c.fillStyle = "#ffd6f0";
  c.font = "bold 24px Arial";
  c.fillText("Breeding records", L.x + 24, L.y + 40);
  const t = data.totals;
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.75)";
  c.textAlign = "right";
  c.fillText(
    `${t.litters} litters · ${t.foals} foals · ${t.alive} with you · ${t.sold} sold for $${t.earned.toLocaleString()} · ${t.died} died`,
    L.x + L.w - 24,
    L.y + 40,
  );

  for (const tab of L.tabs) {
    const on = tab.id === recordsTab;
    if (typeof drawGlassButton === "function")
      drawGlassButton(tab.x, tab.y, tab.w, tab.h, tab.label, {
        fontSize: 14,
        borderRadius: 8,
        normalFill: on ? "rgba(255, 170, 220, 0.35)" : "rgba(0, 0, 0, 0.15)",
      });
  }
  c.textAlign = "left";
  c.font = "12px Arial";
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.fillText(
    recordsTab === "litters"
      ? "Newest first. ★ = unicorn, pegasus, alicorn, spots or stripes. Click a litter to see mum's family tree."
      : "Everyone you've bred from, best earners first. Breeding left: days until a mare is too old. Click for the family tree.",
    L.x + 290,
    L.y + 81,
  );

  // Column headings (parents)
  if (recordsTab === "parents") {
    c.font = "bold 12px Arial";
    c.fillStyle = "rgba(255,255,255,0.6)";
    const w = L.w - 40;
    for (const [label, off] of BR_PARENT_COLS) c.fillText(label, L.x + 32 + (label === "Parent" ? 20 : 0) + off * ((w - 24) / 940), L.y + 138);
  }

  if (!L.rows.length) {
    c.textAlign = "center";
    c.font = "15px Arial";
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.fillText("No litters yet. Foals born to your mares at home show up here.", L.x + L.w / 2, L.y + 220);
  }
  for (const r of L.rows) {
    const over = isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h);
    c.fillStyle = over ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)";
    c.beginPath();
    if (c.roundRect) c.roundRect(r.x, r.y, r.w, r.h, 8);
    else c.rect(r.x, r.y, r.w, r.h);
    c.fill();
    if (recordsTab === "litters") _drawLitterRow(c, r);
    else _drawParentRow(c, r);
  }

  if (typeof drawGlassButton === "function") {
    if (L.pages > 1) {
      drawGlassButton(L.prev.x, L.prev.y, L.prev.w, L.prev.h, "▲", { fontSize: 14, borderRadius: 8 });
      drawGlassButton(L.next.x, L.next.y, L.next.w, L.next.h, "▼", { fontSize: 14, borderRadius: 8 });
      c.textAlign = "left";
      c.font = "13px Arial";
      c.fillStyle = "rgba(255,255,255,0.7)";
      c.fillText(`${recordsPage + 1} / ${L.pages}`, L.next.x + L.next.w + 12, L.next.y + 21);
    }
    drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 15, borderRadius: 10 });
  }
  c.restore();
}

// Mouse down (screen positions); swallows clicks while open
function handleRecordsClick() {
  if (!recordsOpen) return false;
  const L = getRecordsLayout();
  const hit = (b) => isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h);
  if (hit(L.close) || !hit(L)) {
    closeRecords();
    return true;
  }
  for (const t of L.tabs) {
    if (hit(t)) {
      recordsTab = t.id;
      recordsPage = 0;
      return true;
    }
  }
  if (L.pages > 1 && hit(L.prev)) {
    recordsPage = Math.max(0, recordsPage - 1);
    return true;
  }
  if (L.pages > 1 && hit(L.next)) {
    recordsPage = Math.min(L.pages - 1, recordsPage + 1);
    return true;
  }
  for (const r of L.rows) {
    if (!hit(r)) continue;
    const id = recordsTab === "litters" ? r.item.mumId : r.item.id;
    if (id !== null && id !== undefined && typeof openFamilyTree === "function" && getFamilyRecord(id)) {
      closeRecords();
      openFamilyTree(id);
    }
    return true;
  }
  return true;
}

// Pop-up screen list (Screens.js)
registerScreen({
  name: "records",
  layer: 22,
  isOpen: () => recordsOpen,
  close: () => closeRecords(),
  draw: (c) => drawBreedingRecords(c),
  click: () => handleRecordsClick(),
});
