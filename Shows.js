// ---------------------------------------------------------------------------
// Fluffy shows: every few days, a show with a theme. Enter one of your
// fluffies, beat the other breeders' entries, win prizes and ribbons.
//
// Where: the "Shows" tab of the orders screen (Bounty Board on Shopping
// Street, FluffList on the Computer - OrderBoard.js).
//
// Schedule: a show every SHOW_EVERY_DAYS game days at SHOW_HOUR (2 PM).
// The next show's theme is picked when the last one ends, so you can
// prepare. Entry costs a fee (refunded if you withdraw before the show).
//
// Themes (SHOW_THEMES): who can enter and how they're judged, from these
// 0-100 parts:
//   coat     colour value (HorseGenetics.calculateColorMultiplier, on a
//            curve: an ordinary coat ~50, a great one 80+)
//   temper   temperament (Wellbeing.js temperamentScore)
//   pattern  spots and stripes that show
//   plus theme extras (trust, litter training, health, type)
// and knocked down for condition: missing body parts, poor health, flu
// showing, the runs. showScore(f, theme) is the judges' view; the Shows tab
// shows it for each of your fluffies, and on the day the judges' mood adds
// a few points either way.
//
// The other entries (SHOW_RIVALS_MIN-MAX) get better with your reputation
// (Orders.js getOrderLevel) - and the supreme championship (from level 3)
// is harder still, with bigger prizes.
//
// Placing 1st/2nd/3rd: prize money, reputation (+3/+2/+1) and a ribbon on
// the fluffy (f.ribbons, saved - HorseSave.js SAVED_HORSE_FIELDS). Ribbons
// raise its price (ribbonPriceMultiplier: +15% a win, +7% a 2nd, +3% a 3rd,
// at most +60%); three wins make it a Champion. Results pop up after a show
// you entered, and go on the morning report either way.
// Saved: showState (SAVED_GAME_STATE).
// ---------------------------------------------------------------------------

const SHOW_EVERY_DAYS = 3;
const SHOW_HOUR = 14;
const SHOW_RIVALS_MIN = 5;
const SHOW_RIVALS_MAX = 7;
const SHOW_CHAMPION_WINS = 3;

const SHOW_THEMES = [
  {
    id: "coat",
    name: "Best Coat",
    about: "The prettiest colours win. Grown-ups only.",
    eligible: (f) => f.growth >= 1,
    score: (p) => 0.75 * p.coat + 0.25 * p.temper,
  },
  {
    id: "patterns",
    name: "Spots & Stripes",
    about: "Only spotted or striped fluffies. The bolder the better.",
    eligible: (f) => _showPattern(f) > 0,
    score: (p) => 0.5 * p.pattern + 0.35 * p.coat + 0.15 * p.temper,
  },
  {
    id: "unicorn",
    name: "Best Unicorn",
    about: "Unicorns only: coat and manners.",
    eligible: (f) => f.type === "unicorn" && !!f.limbs.horn,
    score: (p) => 0.6 * p.coat + 0.4 * p.temper,
  },
  {
    id: "pegasus",
    name: "Best Pegasus",
    about: "Pegasi only: coat and manners.",
    eligible: (f) => f.type === "pegasus" && (f.limbs.leftWing || f.limbs.rightWing),
    score: (p) => 0.6 * p.coat + 0.4 * p.temper,
  },
  {
    id: "friendly",
    name: "Friendliest Fluffy",
    about: "Happy, trusting and unafraid. Looks hardly count.",
    eligible: (f) => !f.tooYoungToWalk(),
    score: (p) => 0.65 * p.temper + 0.25 * p.trust + 0.1 * p.coat,
  },
  {
    id: "foal",
    name: "Best Foal",
    about: "Foals that can walk (not grown up yet).",
    eligible: (f) => f.growth < 1 && !f.tooYoungToWalk(),
    score: (p) => 0.5 * p.coat + 0.3 * p.temper + 0.2 * p.happy,
  },
  {
    id: "oldies",
    name: "Golden Oldies",
    about: "Seniors and elderly fluffies in fine fettle.",
    eligible: (f) => typeof lifeStage === "function" && (lifeStage(f) === "senior" || lifeStage(f) === "elderly"),
    score: (p) => 0.35 * p.coat + 0.35 * p.temper + 0.3 * p.health,
  },
  {
    id: "trained",
    name: "Best Behaved",
    about: "Litter training counts most, then manners.",
    eligible: (f) => f.growth >= 1,
    score: (p) => 0.6 * p.trained + 0.3 * p.temper + 0.1 * p.coat,
  },
  {
    id: "supreme",
    name: "Supreme Championship",
    about: "Everything counts: coat, type, pattern, manners. The best breeders enter.",
    eligible: (f) => f.growth >= 1,
    score: (p) => 0.4 * p.coat + 0.25 * p.temper + 0.15 * p.pattern + 0.2 * p.typeValue,
    minLevel: 3,
    hard: true,
  },
];

function freshShowState() {
  return { next: null, entryId: null, entryFee: 0, last: null, lastSeen: true, nextId: 1, history: [] };
}

let showState = freshShowState();
const showsTicker = new Ticker(1);

// ---- Judging ----

function _showClamp(v) {
  return Math.max(0, Math.min(100, v));
}

// Spots and stripes that show, 0..100
function _showPattern(f) {
  const d = typeof describeGenes === "function" ? describeGenes(f.genes) : null;
  if (!d) return 0;
  return (d.spots >= 4 ? 50 : 0) + (d.stripes >= 4 ? 50 : 0);
}

function showCoatScore(f) {
  const mult = f.genetics ? f.genetics.calculateColorMultiplier() : 1;
  return _showClamp(22 * Math.log(Math.max(0.01, mult)) - 5);
}

// The parts judges look at, each 0..100
function showParts(f) {
  const type = f.typeVisibleToOthers ? f.typeVisibleToOthers() : f.type;
  return {
    coat: showCoatScore(f),
    temper: (typeof temperamentScore === "function" ? temperamentScore(f) : 0.6) * 100,
    pattern: _showPattern(f),
    trust: (f.playerTrust ?? 0.5) * 100,
    happy: _showClamp((f.happiness ?? 0.6) * 100),
    health: _showClamp(f.health ?? 100),
    trained: (f.pottyTraining || 0) * 100,
    typeValue: { earthy: 30, unicorn: 70, pegasus: 70, alicorn: 100 }[type] ?? 30,
  };
}

// Points off for how it's looking on the day
function showConditionPenalty(f) {
  let p = 0;
  const missing = f.getMissingBodyPartsText ? f.getMissingBodyPartsText() : "none";
  if (missing && missing !== "none") p += 25;
  if ((f.health ?? 100) < 60) p += (60 - f.health) / 2;
  if (typeof fluShowing === "function" && fluShowing(f)) p += 20;
  if (f.isDiarrhea) p += 10;
  return p;
}

function showScore(f, theme) {
  if (!f || !theme) return 0;
  return Math.round(_showClamp(theme.score(showParts(f)) - showConditionPenalty(f)));
}

function canEnterShow(f, theme) {
  return !!(f && theme && f.isAlive && f.adopted && theme.eligible(f));
}

// What the judges said
function showComment(f, theme) {
  const p = showParts(f);
  const good = [];
  const bad = [];
  if (p.coat >= 70) good.push("a lovely coat");
  else if (p.coat < 35) bad.push("a dull coat");
  if (p.temper >= 75) good.push("a sweet nature");
  else if (p.temper < 45) bad.push("nervous in the ring");
  if (p.pattern >= 100) good.push("bold spots and stripes");
  if (theme.id === "trained" && p.trained >= 80) good.push("perfect manners");
  if (showConditionPenalty(f) >= 20) bad.push("not looking its best");
  const parts = [];
  if (good.length) parts.push(`"${good.join(", ")}"`);
  if (bad.length) parts.push(`but ${bad.join(", ")}`);
  return parts.join(" ") || '"a solid entry"';
}

// ---- Schedule, prizes ----

function _showLevel() {
  return typeof getOrderLevel === "function" ? getOrderLevel() : 1;
}

function showPrizes(theme = null, level = _showLevel()) {
  const base = (150 + 75 * level) * (theme && theme.hard ? 3 : 1);
  return [base, Math.round(base * 0.5), Math.round(base * 0.25)].map((v) => Math.round(v / 5) * 5);
}

function showEntryFee(theme = null, level = _showLevel()) {
  return Math.max(10, Math.round((showPrizes(theme, level)[0] * 0.15) / 5) * 5);
}

function getShowTheme(id) {
  return SHOW_THEMES.find((t) => t.id === id) || null;
}

function _pickTheme(level) {
  const pool = SHOW_THEMES.filter((t) => (t.minLevel || 1) <= level && !t.hard);
  if (level >= 3 && Math.random() < 0.25) return SHOW_THEMES.find((t) => t.id === "supreme");
  const last = showState.last && showState.last.themeId;
  const fresh = pool.filter((t) => t.id !== last);
  return fresh[Math.floor(Math.random() * fresh.length)];
}

function scheduleNextShow(fromDay = typeof getDayNumber === "function" ? getDayNumber() : 1) {
  const level = _showLevel();
  const theme = _pickTheme(level);
  showState.next = {
    id: showState.nextId++,
    day: fromDay,
    themeId: theme.id,
    prizes: showPrizes(theme, level),
    fee: showEntryFee(theme, level),
    level,
  };
  showState.entryId = null;
  showState.entryFee = 0;
}

function _showTime(show) {
  // Game time (timePlayed) when a show starts
  return (show.day - 1) * DAY_LENGTH + (SHOW_HOUR - START_HOUR) * HOUR_LENGTH;
}

function describeShowTime(show) {
  const h = SHOW_HOUR % 12 || 12;
  return `Day ${show.day}, ${h}:00 ${SHOW_HOUR >= 12 ? "PM" : "AM"}`;
}

function enterShow(f) {
  const show = showState.next;
  const theme = show && getShowTheme(show.themeId);
  if (!canEnterShow(f, theme)) return false;
  if (showState.entryId !== null) withdrawFromShow();
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < show.fee) {
    if (typeof addUIMessage === "function") addUIMessage(`The entry fee is $${show.fee}.`);
    return false;
  }
  if (!free) money -= show.fee;
  showState.entryId = f.id;
  showState.entryFee = free ? 0 : show.fee;
  return true;
}

function withdrawFromShow() {
  if (showState.entryId === null) return false;
  money += showState.entryFee || 0;
  showState.entryId = null;
  showState.entryFee = 0;
  return true;
}

// Other breeders' entries
function _showRivals(theme, level) {
  const n = SHOW_RIVALS_MIN + Math.floor(Math.random() * (SHOW_RIVALS_MAX - SHOW_RIVALS_MIN + 1));
  const mean = 38 + 7 * level + (theme.hard ? 12 : 0);
  const breeders = (typeof STOCK_BREEDERS !== "undefined" ? STOCK_BREEDERS.map((b) => b.name) : ["Rosewood Fluffies"]).sort(() => Math.random() - 0.5);
  const names = typeof STOCK_NAMES !== "undefined" ? STOCK_NAMES.slice().sort(() => Math.random() - 0.5) : ["Bella"];
  const out = [];
  for (let i = 0; i < n; i++) {
    // Roughly bell-shaped around the mean
    const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 20;
    out.push({ name: `${names[i % names.length]} (${breeders[i % breeders.length]})`, score: Math.round(_showClamp(mean + spread)) });
  }
  return out;
}

function _placeText(n) {
  return ["1st", "2nd", "3rd"][n - 1] || `${n}th`;
}

// Hold the show now
function runShow() {
  const show = showState.next;
  if (!show) return null;
  const theme = getShowTheme(show.themeId);
  const rivals = _showRivals(theme, show.level || _showLevel());
  const entrants = rivals.map((r) => ({ ...r, you: false }));
  let yours = null;
  const f = showState.entryId !== null ? fluffies.find((x) => x.id === showState.entryId) : null;
  let note = null;
  if (showState.entryId !== null) {
    if (canEnterShow(f, theme)) {
      const mood = (Math.random() - 0.5) * 8; // the judges' mood on the day
      yours = {
        name: typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Your fluffy",
        score: Math.round(_showClamp(showScore(f, theme) + mood)),
        you: true,
        id: f.id,
        comment: showComment(f, theme),
      };
      entrants.push(yours);
    } else note = "Your entry couldn't take part (it's gone, or can't enter any more). The fee isn't refunded.";
  }
  entrants.sort((a, b) => b.score - a.score || (a.you ? -1 : 1));
  entrants.forEach((e, i) => (e.place = i + 1));

  const result = {
    showId: show.id,
    day: show.day,
    themeId: theme.id,
    themeName: theme.name,
    placings: entrants,
    yourPlace: yours ? yours.place : null,
    prize: 0,
    note,
  };
  if (yours && yours.place <= 3) {
    const prize = show.prizes[yours.place - 1];
    result.prize = prize;
    if (!(typeof showDebugMenu !== "undefined" && showDebugMenu)) money += prize;
    if (typeof customerOrders !== "undefined" && customerOrders) {
      const before = getOrderLevel();
      customerOrders.reputation += 4 - yours.place;
      const after = getOrderLevel();
      if (after > before && typeof addUIMessage === "function")
        addUIMessage(`Reputation up: you're now a ${ORDER_REP_LEVELS[after - 1].name}!`);
    }
    if (!Array.isArray(f.ribbons)) f.ribbons = [];
    f.ribbons.push({ place: yours.place, show: theme.name, day: show.day });
    if (typeof noteGoalEvent === "function") noteGoalEvent("showPlace", { place: yours.place });
  }
  showState.last = result;
  showState.lastSeen = !yours && !note;
  showState.history = [...(showState.history || []), { day: show.day, theme: theme.name, place: result.yourPlace }].slice(-20);

  const winner = entrants[0];
  const text = yours
    ? `${theme.name} show: ${yours.name} came ${_placeText(yours.place)} of ${entrants.length}${result.prize ? ` and won $${result.prize.toLocaleString()}` : ""}.`
    : `The ${theme.name} show was won by ${winner.name}.`;
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text });
  if (yours && typeof addUIMessage === "function") addUIMessage(text);

  scheduleNextShow(show.day + SHOW_EVERY_DAYS);
  return result;
}

// script.js via Systems.js (works once a second)
function updateShows(dt) {
  if (!showsTicker.step(dt)) return;
  if (!showState || typeof showState !== "object") showState = freshShowState();
  for (const [k, v] of Object.entries(freshShowState())) if (showState[k] === undefined) showState[k] = v;
  if (!showState.next) {
    // First show: tomorrow (or today, if it's still early)
    const today = getDayNumber();
    scheduleNextShow(gameHour() < SHOW_HOUR - 4 ? today : today + 1);
  }
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  if (now >= _showTime(showState.next)) runShow();
}

// ---- Ribbons ----

function ribbonCounts(f) {
  const r = Array.isArray(f && f.ribbons) ? f.ribbons : [];
  return { first: r.filter((x) => x.place === 1).length, second: r.filter((x) => x.place === 2).length, third: r.filter((x) => x.place === 3).length };
}

function isChampion(f) {
  return ribbonCounts(f).first >= SHOW_CHAMPION_WINS;
}

// HorseGenetics.calculatePrice
function ribbonPriceMultiplier(f) {
  const c = ribbonCounts(f);
  return 1 + Math.min(0.6, 0.15 * c.first + 0.07 * c.second + 0.03 * c.third);
}

// Magnifying glass: "Champion - 3 wins, 1 second" or null
function describeRibbons(f) {
  const c = ribbonCounts(f);
  if (!c.first && !c.second && !c.third) return null;
  const parts = [];
  if (c.first) parts.push(`${c.first} win${c.first === 1 ? "" : "s"}`);
  if (c.second) parts.push(`${c.second} second${c.second === 1 ? "" : "s"}`);
  if (c.third) parts.push(`${c.third} third${c.third === 1 ? "" : "s"}`);
  return `${isChampion(f) ? "Champion - " : ""}${parts.join(", ")}`;
}

// ---- The Shows tab (inside the orders screen, OrderBoard.js) ----

let showsPage = 0;
const SHOW_ROWS = 7;

function _showCandidates(theme) {
  return fluffies
    .filter((f) => canEnterShow(f, theme))
    .map((f) => ({ f, score: showScore(f, theme) }))
    .sort((a, b) => b.score - a.score);
}

function showsLayout() {
  const show = showState.next;
  const theme = show && getShowTheme(show.themeId);
  const list = theme ? _showCandidates(theme) : [];
  const pages = Math.max(1, Math.ceil(list.length / SHOW_ROWS));
  showsPage = Math.max(0, Math.min(pages - 1, showsPage));
  const rows = list.slice(showsPage * SHOW_ROWS, (showsPage + 1) * SHOW_ROWS).map((c, i) => {
    const y = 250 + i * 52;
    return { ...c, x: 20, y, w: 700, h: 46, enter: { x: 20 + 700 - 120, y: y + 8, w: 108, h: 30, label: "Enter" } };
  });
  return {
    show,
    theme,
    rows,
    pages,
    withdraw: { x: 600, y: 180, w: 108, h: 30, label: "Withdraw", color: "#8a8a8a", hover: "#666" },
    prev: { x: 20, y: OS_H - 70, w: 50, h: 30, label: "▲" },
    next: { x: 80, y: OS_H - 70, w: 50, h: 30, label: "▼" },
  };
}

function drawShowsPage(c, theme, m) {
  const headColor = ordersScreenMode === "board" ? "#fbe7b5" : theme.cardText;
  const L = showsLayout();
  if (!L.show) {
    _osText(c, "The next show will be announced soon.", 20, 140, headColor, "15px Arial");
    return;
  }
  const t = L.theme;
  // The next show
  c.fillStyle = theme.card;
  _osRR(c, 20, 84, 700, 140, 8);
  c.fill();
  _osText(c, `Next show: ${t.name}`, 36, 114, theme.cardText, "bold 20px Arial");
  _osText(c, describeShowTime(L.show), 700, 114, theme.sub, "bold 14px Arial", "right");
  _osText(c, t.about, 36, 138, theme.sub, "italic 13px Arial");
  const [p1, p2, p3] = L.show.prizes;
  _osText(c, `Prizes: 1st $${p1.toLocaleString()} · 2nd $${p2.toLocaleString()} · 3rd $${p3.toLocaleString()} · plus reputation and a ribbon`, 36, 162, theme.cardText, "13px Arial");
  _osText(c, `Entry fee $${L.show.fee}${t.hard ? " · The best breeders enter this one" : ""}`, 36, 184, theme.cardText, "bold 13px Arial");
  const entry = showState.entryId !== null ? fluffies.find((f) => f.id === showState.entryId) : null;
  if (entry) {
    _osText(c, `Entered: ${fluffyDisplayName(entry)} (judges' view ${showScore(entry, t)})`, 36, 208, "#1e8a3a", "bold 14px Arial");
    _osButton(c, L.withdraw, m, theme);
  } else _osText(c, "Not entered yet: pick one of your fluffies below.", 36, 208, theme.sub, "13px Arial");

  // Your fluffies that can enter
  _osText(c, "Your fluffies that can enter (judges' view out of 100)", 20, 242, headColor, "bold 15px Arial");
  if (!L.rows.length) _osText(c, "None of yours can enter this one.", 20, 280, headColor, "14px Arial");
  for (const r of L.rows) {
    c.fillStyle = theme.card;
    _osRR(c, r.x, r.y, r.w, r.h, 8);
    c.fill();
    const p = typeof _ordersPortrait === "function" ? _ordersPortrait(r.f, 42) : null;
    if (p) c.drawImage(p, r.x + 4, r.y + 2);
    _osText(c, fitText(c, fluffyDisplayName(r.f), 250), r.x + 54, r.y + 20, theme.cardText, "bold 14px Arial");
    _osText(c, fitText(c, showComment(r.f, t), 300), r.x + 54, r.y + 38, theme.sub, "italic 12px Arial");
    // Score bar
    c.fillStyle = "rgba(0,0,0,0.12)";
    c.fillRect(r.x + 380, r.y + 17, 150, 12);
    c.fillStyle = r.score >= 70 ? "#1e8a3a" : r.score >= 45 ? "#d4a017" : "#c0392b";
    c.fillRect(r.x + 380, r.y + 17, 1.5 * r.score, 12);
    _osText(c, String(r.score), r.x + 540, r.y + 28, theme.cardText, "bold 14px Arial");
    const isEntry = showState.entryId === r.f.id;
    _osButton(c, { ...r.enter, label: isEntry ? "Entered" : `Enter $${L.show.fee}` }, m, theme, isEntry);
  }
  if (L.pages > 1) {
    _osButton(c, L.prev, m, theme, showsPage === 0);
    _osButton(c, L.next, m, theme, showsPage >= L.pages - 1);
  }

  // Right side: last show and your ribbons
  const rx = 750;
  c.fillStyle = theme.card;
  _osRR(c, rx, 84, 390, 560, 8);
  c.fill();
  _osText(c, "Last show", rx + 16, 112, theme.cardText, "bold 17px Arial");
  const last = showState.last;
  let y = 136;
  if (!last) _osText(c, "No shows yet.", rx + 16, y, theme.sub, "13px Arial");
  else {
    _osText(c, `${last.themeName} (day ${last.day})`, rx + 16, y, theme.sub, "13px Arial");
    y += 22;
    for (const e of last.placings.slice(0, 8)) {
      _osText(c, `${_placeText(e.place)}`, rx + 16, y, e.place <= 3 ? "#b8860b" : theme.sub, "bold 13px Arial");
      _osText(c, fitText(c, e.name, 250), rx + 56, y, e.you ? "#1e8a3a" : theme.cardText, e.you ? "bold 13px Arial" : "13px Arial");
      _osText(c, String(e.score), rx + 370, y, theme.sub, "13px Arial", "right");
      y += 19;
    }
  }
  y += 18;
  _osText(c, "Your ribbon winners", rx + 16, y, theme.cardText, "bold 15px Arial");
  y += 22;
  const winners = fluffies.filter((f) => f.adopted && f.isAlive && describeRibbons(f));
  if (!winners.length) _osText(c, "None yet.", rx + 16, y, theme.sub, "13px Arial");
  for (const f of winners.slice(0, 8)) {
    _osText(c, fitText(c, `${fluffyDisplayName(f)}: ${describeRibbons(f)}`, 360), rx + 16, y, theme.cardText, "13px Arial");
    y += 19;
  }
}

function handleShowsClick(m) {
  const L = showsLayout();
  if (showState.entryId !== null && _osIn(m, L.withdraw)) {
    withdrawFromShow();
    return true;
  }
  if (L.pages > 1 && _osIn(m, L.prev)) {
    showsPage = Math.max(0, showsPage - 1);
    return true;
  }
  if (L.pages > 1 && _osIn(m, L.next)) {
    showsPage = Math.min(L.pages - 1, showsPage + 1);
    return true;
  }
  for (const r of L.rows) {
    if (_osIn(m, r.enter)) {
      if (showState.entryId !== r.f.id) enterShow(r.f);
      return true;
    }
  }
  return false;
}

// ---- Results pop-up (after a show you entered) ----

function isShowResultsOpen() {
  return !!(showState && showState.last && !showState.lastSeen);
}

function closeShowResults() {
  if (showState) showState.lastSeen = true;
}

function getShowResultsLayout() {
  const n = showState && showState.last ? Math.min(8, showState.last.placings.length) : 8;
  const w = 560;
  const h = 200 + n * 24;
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  return { x, y, w, h, ok: { x: x + w / 2 - 80, y: y + h - 54, w: 160, h: 36 } };
}

function drawShowResults(c) {
  if (!isShowResultsOpen()) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const r = showState.last;
  const L = getShowResultsLayout();
  c.save();
  drawScreenPanel(c, L);
  const you = r.placings.find((e) => e.you);
  const title = !you ? "Show results" : you.place === 1 ? "You won!" : you.place <= 3 ? `${_placeText(you.place)} place!` : `${_placeText(you.place)} place`;
  drawPanelTitle(c, title, L, { align: "center" });
  c.textAlign = "center";
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.75)";
  c.fillText(`${r.themeName} · day ${r.day}`, L.x + L.w / 2, L.y + 64);
  let y = L.y + 100;
  c.textAlign = "left";
  for (const e of r.placings.slice(0, 8)) {
    c.font = e.you ? "bold 15px Arial" : "15px Arial";
    c.fillStyle = e.place <= 3 ? "#f7d774" : "rgba(255,255,255,0.7)";
    c.fillText(_placeText(e.place), L.x + 40, y);
    c.fillStyle = e.you ? "#9fe0a8" : "white";
    c.fillText(fitText(c, e.name, 330), L.x + 90, y);
    c.textAlign = "right";
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.fillText(String(e.score), L.x + L.w - 40, y);
    c.textAlign = "left";
    y += 24;
  }
  y += 8;
  c.font = "14px Arial";
  c.fillStyle = "white";
  if (you) {
    c.fillText(fitText(c, `The judges said: ${you.comment}`, L.w - 80), L.x + 40, y);
    y += 22;
    if (r.prize) {
      c.fillStyle = "#9fe0a8";
      c.fillText(`Prize: $${r.prize.toLocaleString()}, reputation +${4 - you.place}, and a ribbon.`, L.x + 40, y);
    }
  }
  if (r.note) {
    c.fillStyle = "#ff8a80";
    c.fillText(fitText(c, r.note, L.w - 80), L.x + 40, y);
  }
  drawPanelButton(L.ok, you && you.place <= 3 ? "Nice!" : "OK", { fontSize: 16 });
  c.restore();
}

function handleShowResultsClick() {
  if (!isShowResultsOpen()) return false;
  const L = getShowResultsLayout();
  if (isPointInRect(mouse.x, mouse.y, L.ok.x, L.ok.y, L.ok.w, L.ok.h)) closeShowResults();
  return true;
}

registerScreen({
  name: "showResults",
  layer: 29,
  isOpen: () => isShowResultsOpen(),
  close: () => closeShowResults(),
  draw: (c) => drawShowResults(c),
  click: () => handleShowResultsClick(),
  reset: () => {},
});

registerSystem("shows", updateShows, 190);
