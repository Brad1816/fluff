// ---------------------------------------------------------------------------
// "Today": what needs you (new features, #1). One list of what matters right
// now, from every system, so nothing important hides in a magnifying glass.
//
// Open with the "Today" button (top right, next to Household) or T. The
// button shows how many things are urgent (red) or worth a look (gold).
//
//   Urgent   money owed (and when the power goes off or the bailiffs come),
//            the welfare inspector's visit tomorrow, a fluffy starving,
//            frightened, bleeding or ill, one close to breaking, a Rebel
//            that may run away (or making for the door), a mum that goes
//            for her own foal, your old fluffy's last day at the shelter
//   Chances  a wish you could grant, a reason for a party, a title about to
//            change (healing from Broken, nearly Cherished), a sad or
//            grieving fluffy you could sit with
//   The house  rooms that feel Tense, Fearful or Grieving (and why), crowded
//            rooms, the Feed-Bot, anniversaries today
//
// Click a row to go to that fluffy (its room and its magnifying glass).
// ---------------------------------------------------------------------------

const TODAY_W = 820;
const TODAY_ROW_H = 44;
const TODAY_CACHE_MS = 500;
const GIVING_UP_SOON = 0.15; // happiness: close to "wan die"
const DRIP_WARN_HOURS = 6; // a TPN drip keeping a fluffy alive: warn this long before it runs dry

// The IV stand dripping TPN into this fluffy, if any (IVStand.js)
function ivStandFeeding(f) {
  if (typeof objects === "undefined" || typeof IVStand === "undefined") return null;
  return objects.find((o) => o instanceof IVStand && o.connectedFluffy === f && o.attachedBag && o.attachedBag.type === "tpn") || null;
}

let todayOpen = false;
let todayPage = 0;
let _todayCache = null; // { at, items }

function openToday() {
  todayOpen = true;
  todayPage = 0;
  _todayCache = null;
}
function closeToday() {
  todayOpen = false;
}
function isTodayOpen() {
  return todayOpen;
}

function _tdRoom(scene) {
  if (typeof houseRoomName === "function" && houseRoomName(scene)) return houseRoomName(scene);
  if (scene === "BACKYARD") return "The backyard";
  return typeof householdRoomName === "function" ? householdRoomName(scene) : scene;
}

// [{ level: "urgent"|"chance"|"info", text, f? }]
function todayItems() {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  if (_todayCache && now - _todayCache.at < TODAY_CACHE_MS) return _todayCache.items;
  const items = [];
  const add = (level, text, f = null, open = null) => items.push({ level, text, f, open });
  const accounts = typeof openAccounts === "function" ? openAccounts : null;
  const own = typeof fluffies !== "undefined" ? fluffies.filter((f) => f.isAlive && f.adopted) : [];

  // ---- Urgent ----
  if (typeof pressure !== "undefined" && pressure && pressure.debtDays > 0 && typeof billsOwed === "number" && billsOwed > 0) {
    const d = pressure.debtDays;
    const next =
      typeof powerCut === "function" && powerCut()
        ? d >= BAILIFF_DAY - 1
          ? "the bailiffs are coming"
          : "the power's cut off"
        : `the power goes off in ${POWER_CUT_DAY - d} day${POWER_CUT_DAY - d === 1 ? "" : "s"}`;
    add("urgent", `You owe $${billsOwed.toLocaleString()} (${d} day${d === 1 ? "" : "s"} in debt): ${next}.`, null, accounts);
  } else if (typeof billsOwed === "number" && billsOwed > 0) {
    add("urgent", `You owe $${billsOwed.toLocaleString()}. It comes out of tomorrow's money first.`, null, accounts);
  }
  // Tomorrow's bill more than you've got (Bills.js, Economy.js)
  if (typeof dailyBills === "function" && typeof money === "number" && !(billsOwed > 0)) {
    const bt = dailyBills().total;
    if (bt > money) add("urgent", `Tomorrow morning's bill ($${bt.toLocaleString()}) is more than you have.`, null, accounts);
  }
  // Raiders in the backyard (ParkOutings.js)
  if (typeof isRaiding === "function" && isRaiding()) add("urgent", "Raiders from the park are in the backyard: go out there and they'll scatter.");
  if (typeof inspector !== "undefined" && inspector && inspector.warned !== null && inspector.warned !== undefined) {
    add("urgent", "The welfare inspector is coming tomorrow morning. (They don't look in back rooms or cages.)");
  }
  for (const f of own) {
    const n = fluffyDisplayName(f);
    if (f.hunger < 0.25) add("urgent", `${n} is starving.`, f);
    // "Wan die": it's given up and won't eat (for good); close to it
    if (f.happiness <= WAN_DIE_THRESHOLD) {
      const drip = typeof ivStandFeeding === "function" ? ivStandFeeding(f) : null; // (only looked for when it matters)
      if (!drip) add("urgent", `${n} has given up ("wan die") and won't eat. A TPN drip (IV stand) keeps it alive.`, f);
      else {
        // On a drip: is it about to run dry?
        const hoursLeft = drip.dripSecondsLeft() / (typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50);
        const refills = drip.autoRefill && (typeof showDebugMenu !== "undefined" && showDebugMenu || money >= ivBagPrice("tpn"));
        if (!refills && hoursLeft < DRIP_WARN_HOURS)
          add("urgent", hoursLeft <= 0 ? `${n}'s TPN drip is empty - it can't eat by itself.` : `${n}'s TPN drip runs dry in about ${Math.max(1, Math.round(hoursLeft))} game hour${Math.round(hoursLeft) === 1 ? "" : "s"} - it can't eat by itself.${drip.autoRefill ? " (Not enough money for auto-refill.)" : ""}`, f);
      }
    }
    else if (f.happiness < GIVING_UP_SOON) add("urgent", `${n} is close to giving up - cheer it up before it stops eating.`, f);
    if (typeof isFrightened === "function" && isFrightened(f)) add("urgent", `${n} is frightened - pick it up or sit with it.`, f);
    if (f.bleedingTimer > 0) add("urgent", `${n} is bleeding.`, f);
    // Born early and frail, cold or hungry (Premature.js)
    if (typeof frailInDanger === "function" && frailInDanger(f)) add("urgent", `${n} was born early and is frail - keep it warm and fed (an incubator helps).`, f);
    const ill = typeof vetProblems === "function" ? vetProblems(f).map((p) => p[0]) : [];
    if (ill.length && (typeof fluShowing !== "function" || fluShowing(f) || ill.some((x) => x !== "Fluffy flu"))) add("urgent", `${n} needs the vet: ${ill.join(", ").toLowerCase()}.`, f);
    if (typeof breakLimitOf === "function" && typeof titleOf === "function") {
      const t = titleOf(f);
      if (t !== "Broken" && (f.strain || 0) >= breakLimitOf(f) * (t === "Rebel" ? REBEL_BREAK : 0.75)) add("urgent", `${n} is close to breaking.`, f);
      if (typeof isBolting === "function" && isBolting(f)) add("urgent", `${n} is making for the door! Pick it up or comfort it.`, f);
      else if (t === "Rebel") add("urgent", `${n} is a Rebel and may run away.`, f);
      else if (typeof runAwayChance === "function" && runAwayChance(f) > 0) add("urgent", `${n} is miserable and frightened of you: it may run away.`, f);
    }
  }
  // Mums that turn on their own foals (the colourism and alicorn world
  // settings): the commonest way foals die at home in the long test games
  for (const f of own) {
    if (!(f.growth < 1) || f.motherId === null || f.motherId === undefined) continue;
    const mum = fluffies.find((m) => m.id === f.motherId && m.isAlive);
    if (!mum || mum.scene !== f.scene || mum.currentCage !== f.currentCage) continue;
    const colour = typeof mumRejectsFoalColour === "function" && mumRejectsFoalColour(mum, f);
    const alicorn =
      !colour &&
      typeof worldSettings !== "undefined" &&
      worldSettings.alicornIntolerance &&
      typeof f.typeVisibleToOthers === "function" &&
      f.typeVisibleToOthers() === "alicorn" &&
      typeof mum.tolerantOfAlicorns === "function" &&
      !mum.tolerantOfAlicorns();
    if (colour || alicorn) add("urgent", `${fluffyDisplayName(mum)} goes for ${fluffyDisplayName(f)} over ${colour ? "its coat colour" : "being an alicorn"} - keep them apart.`, f);
  }
  if (typeof shelter !== "undefined" && shelter && Array.isArray(shelter.residents) && typeof shelterDaysLeft === "function") {
    for (const r of shelter.residents) if (r.byYou && shelterDaysLeft(r) <= 0) add("urgent", `It's ${r.name}'s last day at the shelter.`);
  }

  // ---- Chances ----
  const parties = [];
  const quietWishes = [];
  for (const f of own) {
    const n = fluffyDisplayName(f);
    const wish = typeof wishText === "function" ? wishText(f) : null;
    // Only the ones aching for their wish (or promised it) get a line; the
    // rest are one line together (Wishes.js)
    const aching = wish && f.wish && (typeof _wDays === "function" ? _wDays(f.wish) >= WISH_PATIENCE_DAYS : false);
    if (wish && (aching || f.wish.promisedAt !== undefined)) add("chance", `${n} is aching for a wish: ${wish.charAt(0).toLowerCase()}${wish.slice(1)}.`, f);
    else if (wish) quietWishes.push(f);
    const party = typeof partyOccasion === "function" ? partyOccasion(f) : null;
    if (party) parties.push({ f, name: party.name });
    const change = typeof describeTitleProgress === "function" ? describeTitleProgress(f) : null;
    if (change && !/breaking/.test(change) && (/Healing|Winning/.test(change) || /most of the way|nearly there/.test(change))) add("chance", `${n} - ${change}.`, f);
    const why = typeof needsSitWith === "function" ? needsSitWith(f) : null;
    if (why && why !== "frightened" && why !== "broken") add("chance", `${n} is ${why} - you could sit with it.`, f);
  }
  if (quietWishes.length) add("info", quietWishes.length === 1 ? `${fluffyDisplayName(quietWishes[0])} has a wish (Mind tab).` : `${quietWishes.length} fluffies have wishes (Mind tab in the magnifying glass).`, quietWishes[0]);
  // (several reasons for a party: one line)
  if (parties.length <= 2) for (const p of parties) add("chance", `A reason for a party: ${p.name}.`, p.f);
  else add("chance", `Reasons for a party: ${parties[0].name}, ${parties[1].name} and ${parties.length - 2} more.`, parties[0].f);

  // ---- The house ----
  const scenes = [...new Set(own.map((f) => f.scene))];
  for (const s of scenes) {
    if (typeof climateOf !== "function" || (typeof getSceneConfig === "function" && !getSceneConfig(s).insidePlayerQuarters)) continue;
    const c = climateOf(s);
    if (["Tense", "Fearful", "Grieving"].includes(c.label)) add("info", `${_tdRoom(s)} feels ${c.label.toLowerCase()}${c.reasons.length ? `: ${c.reasons.slice(0, 2).join(", ")}` : ""}.`);
  }
  if (typeof crowdedRoomLines === "function") for (const l of crowdedRoomLines()) add("info", `${l}.`);
  if (typeof feedBotStatusLines === "function") for (const l of feedBotStatusLines()) add("info", `${l}.`);
  if (typeof sharedMemories !== "undefined" && sharedMemories && Array.isArray(sharedMemories.list) && typeof getDayNumber === "function") {
    const day = getDayNumber();
    const year = typeof SM_YEAR === "number" ? SM_YEAR : 12;
    for (const m of sharedMemories.list) if (day > m.day && (day - m.day) % year === 0) add("info", `A year ago today: ${m.name}.`);
  }

  const order = { urgent: 0, chance: 1, info: 2 };
  items.sort((a, b) => order[a.level] - order[b.level]);
  _todayCache = { at: now, items };
  return items;
}

// For the top-bar button: { urgent, chance }
function todayCounts() {
  const items = todayItems();
  return { urgent: items.filter((i) => i.level === "urgent").length, chance: items.filter((i) => i.level === "chance").length };
}

function getTodayLayout(items = todayItems()) {
  const w = Math.min(TODAY_W, width - 30);
  const h = Math.min(600, height - 30);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  const perPage = Math.max(1, Math.floor((h - 120) / TODAY_ROW_H));
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  todayPage = Math.max(0, Math.min(pages - 1, todayPage));
  const rows = items.slice(todayPage * perPage, (todayPage + 1) * perPage).map((item, i) => ({ item, x: x + 20, y: y + 70 + i * TODAY_ROW_H, w: w - 40, h: TODAY_ROW_H - 6 }));
  return {
    x,
    y,
    w,
    h,
    rows,
    pages,
    prev: { x: x + 24, y: y + h - 46, w: 50, h: 32 },
    next: { x: x + 80, y: y + h - 46, w: 50, h: 32 },
    close: { x: x + w - 150, y: y + h - 46, w: 130, h: 32 },
  };
}

const TODAY_COLOURS = {
  urgent: { chip: "rgba(200, 60, 70, 0.9)", word: "Urgent" },
  chance: { chip: "rgba(200, 150, 40, 0.9)", word: "Chance" },
  info: { chip: "rgba(70, 110, 160, 0.9)", word: "House" },
};

function drawToday(c) {
  if (!todayOpen) return;
  if (typeof ctx !== "undefined" && c !== ctx) return; // screen pass only
  const items = todayItems();
  const L = getTodayLayout(items);
  c.save();
  if (typeof drawScreenPanel === "function") drawScreenPanel(c, L, { theme: "pink" });
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.fillStyle = "#ffd6f0";
  c.font = "bold 24px Arial";
  c.fillText("Today", L.x + 24, L.y + 40);
  const n = todayCounts();
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.75)";
  c.textAlign = "right";
  c.fillText(items.length ? `${n.urgent} urgent · ${n.chance} chance${n.chance === 1 ? "" : "s"}` : "", L.x + L.w - 24, L.y + 40);
  c.textAlign = "left";
  if (!items.length) {
    c.font = "italic 16px Arial";
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillText("Nothing needs you right now. Everyone's fine.", L.x + 24, L.y + 100);
  }
  for (const r of L.rows) {
    const col = TODAY_COLOURS[r.item.level];
    const hover = typeof mouse !== "undefined" && isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h) && r.item.f;
    fillRoundRect(c, r.x, r.y, r.w, r.h, 8, hover ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)");
    // the level chip
    c.font = "bold 12px Arial";
    fillRoundRect(c, r.x + 10, r.y + r.h / 2 - 10, 64, 20, 9, col.chip);
    c.fillStyle = "white";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(col.word, r.x + 42, r.y + r.h / 2 + 1);
    c.textAlign = "left";
    c.font = "14px Arial";
    c.fillStyle = "white";
    c.fillText(fitText(c, r.item.text, r.w - 150), r.x + 86, r.y + r.h / 2 + 1);
    if (r.item.f) {
      c.fillStyle = hover ? "#ffd6f0" : "rgba(255,255,255,0.55)";
      c.textAlign = "right";
      c.fillText("Go ▶", r.x + r.w - 12, r.y + r.h / 2 + 1);
      c.textAlign = "left";
    }
    c.textBaseline = "alphabetic";
  }
  if (L.pages > 1) {
    drawGlassButton(L.prev.x, L.prev.y, L.prev.w, L.prev.h, "◀", { fontSize: 15, borderRadius: 10 });
    drawGlassButton(L.next.x, L.next.y, L.next.w, L.next.h, "▶", { fontSize: 15, borderRadius: 10 });
    c.font = "13px Arial";
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.fillText(`${todayPage + 1} / ${L.pages}`, L.next.x + L.next.w + 12, L.next.y + 21);
  }
  drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 15, borderRadius: 10 });
  c.restore();
}

function handleTodayClick() {
  if (!todayOpen) return false;
  const L = getTodayLayout();
  const hit = (b) => isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h);
  if (hit(L.close) || !hit(L)) {
    closeToday();
    return true;
  }
  if (L.pages > 1 && hit(L.prev)) {
    todayPage = Math.max(0, todayPage - 1);
    return true;
  }
  if (L.pages > 1 && hit(L.next)) {
    todayPage = Math.min(L.pages - 1, todayPage + 1);
    return true;
  }
  for (const r of L.rows) {
    // Money rows: the accounts (Economy.js)
    if (hit(r) && typeof r.item.open === "function") {
      closeToday();
      r.item.open();
      return true;
    }
    if (hit(r) && r.item.f && r.item.f.isAlive) {
      closeToday();
      if (typeof goToFluffy === "function") goToFluffy(r.item.f);
      return true;
    }
  }
  return true;
}

// ---- The top-bar button (GameSpeed.js) ----
function getTodayButtonRect(chatLogRight) {
  const ob = typeof getHouseholdButtonRect === "function" ? getHouseholdButtonRect(chatLogRight) : { x: width - 112, y: 49, h: 32 };
  const w = typeof topBarWidths === "function" ? topBarWidths(chatLogRight).today : 96;
  return { x: ob.x - w - 6, y: ob.y, w, h: ob.h };
}

function drawTodayButton(c, chatLogRight) {
  const b = getTodayButtonRect(chatLogRight);
  drawGlassButton(b.x, b.y, b.w, b.h, "Today", { fontSize: 13, borderRadius: 8, normalFill: todayOpen ? "rgba(255, 170, 220, 0.35)" : "rgba(0, 0, 0, 0.1)" });
  const n = todayCounts();
  const count = n.urgent || n.chance;
  if (!count) return;
  const cx = b.x + b.w - 6;
  const cy = b.y + 4;
  c.save();
  c.fillStyle = n.urgent ? "#e04b5a" : "#d9a531";
  c.beginPath();
  c.arc(cx, cy, 10, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "white";
  c.font = "bold 11px Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(count > 9 ? "9+" : String(count), cx, cy + 1);
  c.restore();
}

function todayButtonClick(chatLogRight) {
  const b = getTodayButtonRect(chatLogRight);
  if (!isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h)) return false;
  if (todayOpen) closeToday();
  else openToday();
  return true;
}

registerScreen({
  name: "today",
  layer: 22,
  isOpen: () => todayOpen,
  close: () => closeToday(),
  draw: (c) => drawToday(c),
  click: () => handleTodayClick(),
  reset: () => closeToday(),
});
