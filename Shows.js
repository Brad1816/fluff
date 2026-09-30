// ---------------------------------------------------------------------------
// Fluffy shows: every few days, a show with a theme. Enter one of your
// fluffies, beat the other breeders' entries, win prizes and ribbons.
//
// Where: the "Shows" tab of the orders screen (Bounty Board on Shopping
// Street, FluffList on the Computer - OrderBoard.js), or click the Show Hall
// on Shopping Street (drawShowHall / showHallClick).
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
// at most +60%); three wins make it a Champion. After a show you entered
// you watch it in the ring (the parade, the judges' scores, the podium -
// drawShowResults), and it goes on the morning report either way.
//
// Grooming: brushing a fluffy (script.js -> onFluffyGroomed) within a game
// day before the show gives SHOW_GROOM_BONUS points (f.groomedAt, saved).
// Saved: showState (SAVED_GAME_STATE).
// ---------------------------------------------------------------------------

const SHOW_EVERY_DAYS = 3;
const SHOW_HOUR = 14;
const SHOW_RIVALS_MIN = 5;
const SHOW_RIVALS_MAX = 7;
const SHOW_CHAMPION_WINS = 3;
const SHOW_GROOM_BONUS = 5; // points for being brushed within a day of the show

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
    id: "tricks",
    name: "Trick Show",
    about: "Show off! Its three best tricks count most, then manners.",
    eligible: (f) => !f.tooYoungToWalk(),
    score: (p) => 0.7 * p.tricks + 0.2 * p.temper + 0.1 * p.happy,
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
    tricks: typeof trickShowScore === "function" ? trickShowScore(f) : 0,
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

// ---- Grooming (the brush) ----

function _showNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}

// Brushed within the last game day
function isFreshlyGroomed(f) {
  if (!f || typeof f.groomedAt !== "number") return false;
  const since = _showNow() - f.groomedAt;
  return since >= 0 && since <= DAY_LENGTH;
}

// Brushing (script.js)
function onFluffyGroomed(f) {
  if (!f) return;
  const was = isFreshlyGroomed(f);
  f.groomedAt = _showNow();
  if (!was && showState && showState.entryId === f.id && typeof addUIMessage === "function") {
    const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Your fluffy";
    addUIMessage(`${name} is groomed for the show (+${SHOW_GROOM_BONUS} points for a day).`);
  }
}

function showScore(f, theme) {
  if (!f || !theme) return 0;
  const groomed = isFreshlyGroomed(f) ? SHOW_GROOM_BONUS : 0;
  // Every show: a few points for each trick it knows (up to 3, Tricks.js)
  const tricks = typeof knownTricks === "function" && theme.id !== "tricks" ? Math.min(3, knownTricks(f).length) * TRICK_SHOW_BONUS : 0;
  // Diet and weight: a glossy, trim fluffy shows better (Diet.js)
  const diet =
    (typeof dietShowBonus === "function" ? dietShowBonus(f) : 0) +
    (typeof boredomShowBonus === "function" ? boredomShowBonus(f) : 0) - // Play.js
    (typeof dirtShowPenalty === "function" ? dirtShowPenalty(f) : 0); // a dirty coat (Bath.js)
  return Math.round(_showClamp(theme.score(showParts(f)) - showConditionPenalty(f) + groomed + tricks + diet));
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
  if (isFreshlyGroomed(f)) good.push("beautifully groomed");
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
  const breeders = (typeof STOCK_BREEDERS !== "undefined" ? STOCK_BREEDERS.slice() : [{ name: "Rosewood Fluffies", line: "pastel" }]).sort(
    () => Math.random() - 0.5,
  );
  const names = typeof STOCK_NAMES !== "undefined" ? STOCK_NAMES.slice().sort(() => Math.random() - 0.5) : ["Bella"];
  const out = [];
  for (let i = 0; i < n; i++) {
    // Roughly bell-shaped around the mean
    const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 20;
    const breeder = breeders[i % breeders.length];
    out.push({
      name: `${names[i % names.length]} (${breeder.name})`,
      score: Math.round(_showClamp(mean + spread)),
      ..._showRivalLooks(theme, breeder, i, level),
    });
  }
  return out;
}

// What a rival looks like in the ring: genes from its breeder's line (the
// stock market's), made to fit the theme
function _showRivalLooks(theme, breeder, i, level) {
  const looks = { genes: null, growth: 1, gender: Math.random() < 0.5 ? "female" : "male" };
  if (theme.id === "foal") looks.growth = 0.35 + Math.random() * 0.4;
  if (typeof _lineGrandparent !== "function") return looks;
  let line = breeder.line;
  if (theme.id === "unicorn") line = "horn";
  else if (theme.id === "pegasus") line = "wings";
  else if (theme.id === "patterns") line = i % 2 ? "stripes" : "spots";
  try {
    looks.genes = _lineGrandparent(line, true, Math.min(0.9, 0.65 + level * 0.04));
  } catch (e) {
    looks.genes = null;
  }
  return looks;
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
        genes: Array.isArray(f.genes) ? f.genes.slice() : null,
        growth: f.growth,
        gender: f.gender,
      };
      entrants.push(yours);
    } else note = "Your entry couldn't take part (it's gone, or can't enter any more). The fee isn't refunded.";
  }
  // The order they walk into the ring (yours somewhere in the line)
  if (yours) {
    const at = Math.floor(Math.random() * entrants.length);
    entrants.splice(entrants.indexOf(yours), 1);
    entrants.splice(at, 0, yours);
  }
  entrants.forEach((e, i) => (e.order = i));
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
    if (typeof recordStory === "function") recordStory("show", f, { x: ["", "first", "second", "third"][yours.place] || `number ${yours.place}` });
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
    replay: { x: 1004, y: 92, w: 122, h: 28, label: "Watch again" },
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
  _osText(c, `Brushed within a day: +${SHOW_GROOM_BONUS} · each trick it knows: +${typeof TRICK_SHOW_BONUS === "number" ? TRICK_SHOW_BONUS : 2}`, 720, 242, headColor, "italic 12px Arial", "right");
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
  if (canReplayShow()) _osButton(c, L.replay, m, theme);
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
  if (canReplayShow() && _osIn(m, L.replay)) {
    replayShow();
    return true;
  }
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

// ---- In the ring (after a show you entered) ----
//
// A pop-up screen that plays the show out in real time (not game time):
// the entrants parade round the ring, line up, the judges reveal each
// score from last place to first, then the top three stand on the podium
// with their ribbons. "Skip" jumps to the end; the button closes it.

const RING_PARADE = 5; // seconds of parading
const RING_REVEAL = 0.6; // seconds between each score
const RING_PODIUM = 0.9; // seconds to walk to the podium

let _ring = { showId: null, start: 0, fluffies: {}, portraits: {} };

function isShowResultsOpen() {
  return !!(showState && showState.last && !showState.lastSeen);
}

function closeShowResults() {
  if (showState) showState.lastSeen = true;
  _ring.showId = null;
  _ring.portraits = {};
}

// The last show can be watched again if it was yours and has looks saved
function canReplayShow() {
  const r = showState && showState.last;
  return !!(r && r.yourPlace && r.placings.some((e) => !e.you && Array.isArray(e.genes)));
}

function replayShow() {
  if (!canReplayShow()) return false;
  showState.lastSeen = false;
  _ring.showId = null; // start from the beginning
  if (typeof closeOrdersScreen === "function") closeOrdersScreen();
  return true;
}

function _ringClock() {
  return (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
}

// Seconds since the ring opened (starts it if it's a new show)
function _ringTime() {
  const r = showState.last;
  if (_ring.showId !== r.showId) {
    _ring = { showId: r.showId, start: _ringClock(), portraits: {} };
  }
  return _ringClock() - _ring.start;
}

function _ringTimes(r) {
  const n = r.placings.length;
  const hasLooks = r.placings.some((e) => Array.isArray(e.genes));
  const judge = hasLooks ? RING_PARADE + 1 : 0;
  const podium = judge + n * RING_REVEAL + 0.4;
  return { judge, podium, end: podium + RING_PODIUM, hasLooks };
}

function skipShowRing() {
  if (!isShowResultsOpen()) return;
  _ringTime();
  _ring.start = _ringClock() - _ringTimes(showState.last).end - 1;
}

function isShowRingFinished() {
  if (!isShowResultsOpen()) return true;
  return _ringTime() >= _ringTimes(showState.last).end;
}

function _ringPortrait(e, size) {
  const key = `${e.order}:${size}`;
  if (_ring.portraits[key] !== undefined) return _ring.portraits[key];
  let h = e.you ? fluffies.find((f) => f.id === e.id && f.isAlive) : null;
  if (!h && Array.isArray(e.genes) && typeof makeStandInFluffy === "function")
    h = makeStandInFluffy(e.genes, { growth: e.growth ?? 1, gender: e.gender });
  _ring.portraits[key] = h && typeof drawFluffyPortraitCanvas === "function" ? drawFluffyPortraitCanvas(h, size) : null;
  return _ring.portraits[key];
}

function getShowResultsLayout() {
  const w = Math.min(980, width - 30);
  const h = Math.min(620, height - 30);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  const listW = 290;
  const ring = { cx: x + (w - listW) / 2 + 6, cy: y + h * 0.56, rx: (w - listW) / 2 - 36, ry: h * 0.3 };
  return {
    x,
    y,
    w,
    h,
    ring,
    list: { x: x + w - listW, y: y + 70, w: listW - 20 },
    ok: { x: x + w - listW + (listW - 20) / 2 - 80, y: y + h - 56, w: 160, h: 38 },
  };
}

function _lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// Where entrant e stands at time t
function _ringSpot(e, n, t, R, T) {
  const lineX = R.cx - R.rx * 0.78 + ((e.order + 0.5) * (R.rx * 1.56)) / n;
  const lineY = R.cy + R.ry * 0.28;
  let x = lineX;
  let y = lineY;
  if (T.hasLooks && t < T.judge) {
    // Round the ring, one after another, then over to the line
    const u = t * 0.75 - e.order * 0.5;
    if (u < 0) return null; // not in yet
    const px = R.cx - R.rx * 0.8 * Math.cos(u);
    const py = R.cy + R.ry * 0.62 * Math.sin(u) - Math.abs(Math.sin(t * 7 + e.order)) * 6;
    const k = (t - (T.judge - 1)) / 1;
    x = _lerp(px, lineX, k);
    y = _lerp(py, lineY, k);
  }
  if (t >= T.podium && e.place <= 3) {
    const k = (t - T.podium) / RING_PODIUM;
    const px = R.cx + [0, -110, 110][e.place - 1];
    const py = R.cy - R.ry * 0.12 - [40, 18, 6][e.place - 1];
    x = _lerp(lineX, px, k);
    y = _lerp(lineY, py, k);
  }
  return { x, y };
}

function _drawRosette(c, x, y, place) {
  const col = ["#2f6fd6", "#d63a3a", "#e6c229"][place - 1] || "#999";
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(x - 7, y + 4);
  c.lineTo(x - 11, y + 24);
  c.lineTo(x - 4, y + 19);
  c.lineTo(x, y + 26);
  c.lineTo(x + 4, y + 19);
  c.lineTo(x + 11, y + 24);
  c.lineTo(x + 7, y + 4);
  c.fill();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    c.beginPath();
    c.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 5, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "white";
  c.beginPath();
  c.arc(x, y, 7, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = col;
  c.font = "bold 9px Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(String(place), x, y + 1);
  c.textBaseline = "alphabetic";
}

function _drawRing(c, L, r, t, T) {
  const R = L.ring;
  const n = r.placings.length;
  // Seats and the ring
  c.fillStyle = "#3a2f4a";
  c.beginPath();
  c.ellipse(R.cx, R.cy, R.rx + 26, R.ry + 26, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#e3c99a";
  c.beginPath();
  c.ellipse(R.cx, R.cy, R.rx, R.ry, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "white";
  c.lineWidth = 4;
  c.stroke();
  c.strokeStyle = "rgba(160,120,70,0.35)";
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(R.cx, R.cy, R.rx * 0.8, R.ry * 0.62, 0, 0, Math.PI * 2);
  c.stroke();
  // Bunting
  for (let i = 0; i < 18; i++) {
    const a = Math.PI + (i / 17) * Math.PI;
    c.fillStyle = ["#ff7eb6", "#7ec8ff", "#ffe066", "#8fe39a"][i % 4];
    const bx = R.cx + Math.cos(a) * (R.rx + 14);
    const by = R.cy + Math.sin(a) * (R.ry + 14);
    c.beginPath();
    c.moveTo(bx - 6, by - 4);
    c.lineTo(bx + 6, by - 4);
    c.lineTo(bx, by + 7);
    c.fill();
  }
  // Judges' table
  const jx = R.cx - 90;
  const jy = R.cy - R.ry - 4;
  c.fillStyle = "#6b4a2b";
  c.fillRect(jx, jy, 180, 26);
  c.fillStyle = "#f4ead5";
  c.font = "bold 12px Arial";
  c.textAlign = "center";
  c.fillText("JUDGES", R.cx, jy + 17);
  for (let i = 0; i < 3; i++) {
    c.fillStyle = ["#caa27a", "#8d6b4f", "#e0bfa0"][i];
    c.beginPath();
    c.arc(jx + 35 + i * 55, jy - 8, 10, 0, Math.PI * 2);
    c.fill();
  }

  // Podium
  if (t >= T.podium) {
    const a = Math.min(1, (t - T.podium) / 0.4);
    c.globalAlpha = a;
    for (const [dx, hgt, label] of [
      [-110, 26, "2"],
      [0, 44, "1"],
      [110, 16, "3"],
    ]) {
      const top = R.cy - R.ry * 0.12 + 28 - hgt;
      c.fillStyle = "#f4f4f4";
      c.fillRect(R.cx + dx - 45, top, 90, hgt + 10);
      c.fillStyle = "#b8860b";
      c.font = "bold 14px Arial";
      c.textAlign = "center";
      c.fillText(label, R.cx + dx, top + hgt / 2 + 10);
    }
    c.globalAlpha = 1;
  }

  // The entrants (back to front)
  const size = Math.round(Math.min(78, (R.rx * 1.5) / n));
  const spots = r.placings
    .map((e) => ({ e, p: _ringSpot(e, n, t, R, T) }))
    .filter((s) => s.p)
    .sort((a, b) => a.p.y - b.p.y);
  for (const { e, p } of spots) {
    const fade = t >= T.podium + RING_PODIUM && e.place > 3 ? 0.45 : 1;
    c.globalAlpha = fade;
    c.fillStyle = "rgba(0,0,0,0.18)";
    c.beginPath();
    c.ellipse(p.x, p.y + size * 0.42, size * 0.36, 6, 0, 0, Math.PI * 2);
    c.fill();
    const img = _ringPortrait(e, size);
    if (img) c.drawImage(img, p.x - size / 2, p.y - size / 2);
    else {
      c.fillStyle = "#f2d0e4";
      c.beginPath();
      c.arc(p.x, p.y, size * 0.3, 0, Math.PI * 2);
      c.fill();
    }
    if (e.you) {
      c.fillStyle = "#1e8a3a";
      c.font = "bold 12px Arial";
      c.textAlign = "center";
      c.fillText("▼ YOURS", p.x, p.y - size / 2 - 4);
    }
    // Score, once revealed (last place first)
    const revealAt = T.judge + (n - e.place) * RING_REVEAL;
    if (t >= revealAt && t < T.podium) {
      c.fillStyle = e.place <= 3 ? "#b8860b" : "#5a4a3a";
      c.font = "bold 15px Arial";
      c.textAlign = "center";
      c.fillText(`${_placeText(e.place)} · ${e.score}`, p.x, p.y + size / 2 + 16);
    }
    if (t >= T.podium + RING_PODIUM * 0.8 && e.place <= 3) _drawRosette(c, p.x + size * 0.32, p.y - size * 0.1, e.place);
    c.globalAlpha = 1;
  }

  // Confetti for a top-three finish
  const you = r.placings.find((e) => e.you);
  if (you && you.place <= 3 && t >= T.podium) {
    for (let i = 0; i < 40; i++) {
      const sx = R.cx - R.rx + ((i * 97) % (R.rx * 2));
      const fall = ((t - T.podium) * (60 + (i % 5) * 18) + i * 23) % (R.ry * 2 + 60);
      c.fillStyle = ["#ff7eb6", "#7ec8ff", "#ffe066", "#8fe39a", "#ffffff"][i % 5];
      c.fillRect(sx + Math.sin(t * 3 + i) * 8, R.cy - R.ry - 30 + fall, 5, 8);
    }
  }
}

function drawShowResults(c) {
  if (!isShowResultsOpen()) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const r = showState.last;
  const L = getShowResultsLayout();
  const t = _ringTime();
  const T = _ringTimes(r);
  const done = t >= T.end;
  c.save();
  drawScreenPanel(c, L);
  const you = r.placings.find((e) => e.you);
  let title = `${r.themeName} · day ${r.day}`;
  if (done && you) title = you.place === 1 ? "You won!" : you.place <= 3 ? `${_placeText(you.place)} place!` : `${_placeText(you.place)} place`;
  else if (t < T.judge) title = `${r.themeName}: the parade`;
  else if (t < T.podium) title = `${r.themeName}: the judges' scores`;
  drawPanelTitle(c, title, L);
  c.textAlign = "left";
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.fillText(done ? `${r.themeName} · day ${r.day} · the Show Hall` : "The Show Hall, Shopping Street", L.x + 24, L.y + 62);

  _drawRing(c, L, r, t, T);

  // Placings revealed so far
  const Ls = L.list;
  c.font = "bold 16px Arial";
  c.fillStyle = "#ffd6f0";
  c.textAlign = "left";
  c.fillText("Placings", Ls.x, Ls.y + 10);
  let y = Ls.y + 38;
  const shown = r.placings.filter((e) => t >= T.judge + (r.placings.length - e.place) * RING_REVEAL);
  for (const e of shown.slice(0, 8)) {
    c.font = e.you ? "bold 14px Arial" : "14px Arial";
    c.fillStyle = e.place <= 3 ? "#f7d774" : "rgba(255,255,255,0.7)";
    c.textAlign = "left";
    c.fillText(_placeText(e.place), Ls.x, y);
    c.fillStyle = e.you ? "#9fe0a8" : "white";
    c.fillText(fitText(c, e.name, Ls.w - 80), Ls.x + 40, y);
    c.textAlign = "right";
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.fillText(String(e.score), Ls.x + Ls.w, y);
    y += 22;
  }
  if (done) {
    y += 10;
    c.textAlign = "left";
    c.font = "13px Arial";
    const lines = [];
    if (you) lines.push(["white", `The judges said: ${you.comment}`]);
    if (you && r.prize) lines.push(["#9fe0a8", `Prize: $${r.prize.toLocaleString()}, reputation +${4 - you.place}, and a ribbon.`]);
    if (r.note) lines.push(["#ff8a80", r.note]);
    for (const [col, text] of lines) {
      c.fillStyle = col;
      for (const line of _wrapText(c, text, Ls.w)) {
        c.fillText(line, Ls.x, y);
        y += 18;
      }
      y += 4;
    }
  }
  drawPanelButton(L.ok, done ? (you && you.place <= 3 ? "Nice!" : "OK") : "Skip", { fontSize: 16 });
  c.restore();
}

function _wrapText(c, text, maxW) {
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

function handleShowResultsClick() {
  if (!isShowResultsOpen()) return false;
  const L = getShowResultsLayout();
  if (isPointInRect(mouse.x, mouse.y, L.ok.x, L.ok.y, L.ok.w, L.ok.h)) {
    if (isShowRingFinished()) closeShowResults();
    else skipShowRing();
  }
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

// ---- The Show Hall on Shopping Street ----

function getShowHallRect() {
  return { x: width - 560, y: height * 0.15 + 335, w: 380, h: 160 };
}

function _isOverShowHall(px, py) {
  if (currentScene !== "SHOP_STREET") return false;
  const b = getShowHallRect();
  return px >= b.x - 12 && px <= b.x + b.w + 12 && py >= b.y - 44 && py <= b.y + b.h;
}

// Store.js drawStoreScenery
function drawShowHall(c) {
  if (currentScene !== "SHOP_STREET") return;
  const b = getShowHallRect();
  c.save();
  c.textBaseline = "alphabetic";
  // Shadow
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.beginPath();
  c.ellipse(b.x + b.w / 2, b.y + b.h + 4, b.w / 2 + 12, 9, 0, 0, Math.PI * 2);
  c.fill();
  // Front
  c.fillStyle = "#fbefe0";
  c.fillRect(b.x, b.y, b.w, b.h);
  c.strokeStyle = "#c9a878";
  c.lineWidth = 3;
  c.strokeRect(b.x, b.y, b.w, b.h);
  // Columns
  c.fillStyle = "#efe0c8";
  for (const cx of [b.x + 14, b.x + b.w - 34]) {
    c.fillRect(cx, b.y + 8, 20, b.h - 8);
    c.strokeStyle = "#d8c3a0";
    c.strokeRect(cx, b.y + 8, 20, b.h - 8);
  }
  // Roof sign
  c.fillStyle = "#7a3b8f";
  c.fillRect(b.x - 12, b.y - 44, b.w + 24, 44);
  c.fillStyle = "#ffe066";
  c.font = "bold 20px Arial";
  c.textAlign = "center";
  c.fillText("★ FLUFFY SHOW HALL ★", b.x + b.w / 2, b.y - 15);
  // Bunting under the sign
  for (let i = 0; i < 16; i++) {
    const fx = b.x + 6 + i * ((b.w - 12) / 16);
    c.fillStyle = ["#ff7eb6", "#7ec8ff", "#ffe066", "#8fe39a"][i % 4];
    c.beginPath();
    c.moveTo(fx, b.y + 2);
    c.lineTo(fx + (b.w - 12) / 16, b.y + 2);
    c.lineTo(fx + (b.w - 12) / 32, b.y + 16);
    c.fill();
  }
  // Arched door
  const dw = 70;
  const dx = b.x + b.w - 54 - dw;
  const dy = b.y + 50;
  c.fillStyle = "#8b5a3c";
  c.beginPath();
  c.moveTo(dx, b.y + b.h);
  c.lineTo(dx, dy + dw / 2);
  c.arc(dx + dw / 2, dy + dw / 2, dw / 2, Math.PI, 0);
  c.lineTo(dx + dw, b.y + b.h);
  c.fill();
  c.fillStyle = "#f7d774";
  c.beginPath();
  c.arc(dx + dw - 12, dy + 70, 4, 0, Math.PI * 2);
  c.fill();
  // Poster: the next show
  const px = b.x + 48;
  const py = b.y + 26;
  const pw = dx - px - 16;
  c.fillStyle = "white";
  c.fillRect(px, py, pw, b.h - 40);
  c.strokeStyle = "#7a3b8f";
  c.lineWidth = 2;
  c.strokeRect(px, py, pw, b.h - 40);
  const show = showState && showState.next;
  const theme = show && getShowTheme(show.themeId);
  c.textAlign = "center";
  c.fillStyle = "#7a3b8f";
  c.font = "bold 12px Arial";
  c.fillText("NEXT SHOW", px + pw / 2, py + 20);
  c.fillStyle = "#3a2a1a";
  c.font = "bold 15px Arial";
  c.fillText(fitText(c, theme ? theme.name : "Coming soon", pw - 12), px + pw / 2, py + 44);
  c.font = "12px Arial";
  if (show) c.fillText(describeShowTime(show), px + pw / 2, py + 64);
  const entry = show && showState.entryId !== null ? fluffies.find((f) => f.id === showState.entryId) : null;
  c.fillStyle = entry ? "#1e8a3a" : "#7a6a55";
  c.font = entry ? "bold 12px Arial" : "italic 12px Arial";
  c.fillText(fitText(c, entry ? `Entered: ${fluffyDisplayName(entry)}` : "Click to enter", pw - 12), px + pw / 2, py + 90);
  // Hover hint
  if (_isOverShowHall(mouse.x, mouse.y) && !isGlobalDragging) {
    c.fillStyle = "rgba(0,0,0,0.7)";
    c.fillRect(b.x + b.w / 2 - 90, b.y + b.h + 12, 180, 24);
    c.fillStyle = "white";
    c.font = "13px Arial";
    c.fillText("Click for the shows", b.x + b.w / 2, b.y + b.h + 29);
  }
  c.restore();
}

// Mouse down (UI.js), like the vet
function showHallClick() {
  if (isGlobalDragging || !_isOverShowHall(mouse.x, mouse.y)) return false;
  if (typeof openOrdersScreen !== "function") return false;
  openOrdersScreen("board");
  ordersTab = "shows";
  return true;
}

registerSystem("shows", updateShows, 190);
