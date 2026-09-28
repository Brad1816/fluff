// ---------------------------------------------------------------------------
// End-of-day report: every morning at 6:00 a card sums up the day before.
//
// A "report day" runs from 6:00 AM to 6:00 AM (WorldTime.js clock). While
// it runs, dayStats collects:
//   - money at the start (the card shows the change)
//   - your fluffies born, bought or brought in, and those that died (found by
//     comparing your adopted fluffies once a second)
//   - fluffies sold and orders filled, with the money (noteDayEvent calls in
//     UI.js / Orders.js)
//   - park news: herds splitting, meadows changing hands, new wild groups,
//     wild deaths (Territory.js, Herds.js, ParkLife.js)
//   - fluffies left scarred for life (Separation.js)
//   - what happened in the park overnight (NightEvents.js), shown as
//     "Last night in the park" in green (good) or red (bad)
//   - the weather it had
// At 6:00 the finished day becomes dayReportShown (the card opens; fast
// forward drops back to 1x) and a new day starts. Close it with the button,
// Esc or Enter. Everything is saved (dayStats in SAVED_GAME_STATE).
// ---------------------------------------------------------------------------

const REPORT_HOUR = 6;
const REPORT_NEWS_MAX = 8;

function freshDayStats() {
  return {
    day: null, // report-day index (null = start counting on the next tick)
    moneyStart: 0,
    born: [],
    arrived: [],
    died: [],
    sold: { count: 0, money: 0 },
    orders: { count: 0, money: 0 },
    news: [],
    scarred: [],
    weather: [],
    wildArrived: 0,
    wildBorn: 0,
    wildDied: 0,
    nightEvents: [], // { good, text } (NightEvents.js)
    known: [], // ids of your living fluffies
  };
}

let dayStats = freshDayStats();
let dayReportShown = null; // the finished report on screen, or null
let _dayReportTimer = 0;

function reportDayIndex() {
  const t = (typeof timePlayed === "number" ? timePlayed : 0) + (START_HOUR - REPORT_HOUR) * HOUR_LENGTH;
  return Math.floor(t / DAY_LENGTH);
}

function _fluffyLabel(f) {
  // "Daisy" or "Fluffy (pink unicorn mare)" (Names.js)
  if (typeof fluffyDisplayName === "function") return fluffyDisplayName(f);
  return (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || "Fluffy";
}

function _pushNews(text) {
  if (!text) return;
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (dayStats.news.includes(text)) return;
  dayStats.news.push(text);
  if (dayStats.news.length > REPORT_NEWS_MAX) dayStats.news.shift();
}

// Called from around the game when something worth reporting happens
function noteDayEvent(kind, info = {}) {
  if (!dayStats || typeof dayStats !== "object") dayStats = freshDayStats();
  switch (kind) {
    case "sold":
      dayStats.sold.count++;
      dayStats.sold.money += info.money || 0;
      if (typeof noteGoalEvent === "function") noteGoalEvent("sold", info); // Goals.js
      break;
    case "order":
      dayStats.orders.count++;
      dayStats.orders.money += info.money || 0;
      break;
    case "news":
      _pushNews(info.text);
      break;
    case "scarred":
      if (info.name && !dayStats.scarred.includes(info.name)) dayStats.scarred.push(info.name);
      break;
    case "wildArrived":
      dayStats.wildArrived += info.count || 1;
      break;
  }
}

function _startDay(index) {
  const known = fluffies.filter((f) => f.adopted && f.isAlive).map((f) => f.id);
  dayStats = freshDayStats();
  dayStats.day = index;
  dayStats.moneyStart = typeof money === "number" ? money : 0;
  dayStats.known = known;
  if (typeof weatherState !== "undefined" && weatherState.type) dayStats.weather = [weatherState.type];
}

function _finishDay() {
  const s = dayStats;
  return {
    dayNumber: s.day + 1, // day 1 is the first
    moneyStart: s.moneyStart,
    moneyEnd: typeof money === "number" ? money : 0,
    born: s.born.slice(),
    arrived: s.arrived.slice(),
    died: s.died.slice(),
    sold: { ...s.sold },
    orders: { ...s.orders },
    news: s.news.slice(),
    scarred: s.scarred.slice(),
    weather: s.weather.slice(),
    wildArrived: s.wildArrived,
    wildBorn: s.wildBorn || 0,
    wildDied: s.wildDied,
    nightEvents: (s.nightEvents || []).map((e) => ({ ...e })),
    season: typeof getSeason === "function" ? getSeason() : "",
  };
}

// script.js updateSimulation; works once a second
function updateDayReport(dt) {
  if (!dayStats || typeof dayStats !== "object") dayStats = freshDayStats();
  for (const [k, v] of Object.entries(freshDayStats())) if (dayStats[k] === undefined) dayStats[k] = v;
  _dayReportTimer -= dt;
  if (_dayReportTimer > 0) return;
  _dayReportTimer = 1;

  const index = reportDayIndex();
  if (dayStats.day === null) _startDay(index);

  // Your fluffies: new ones and ones that died
  const known = new Set(dayStats.known);
  const now = [];
  for (const f of fluffies) {
    if (!f.adopted) continue;
    if (f.isAlive) {
      now.push(f.id);
      if (!known.has(f.id)) {
        if (f.motherId !== null && f.motherId !== undefined && f.growth < 0.1) dayStats.born.push(_fluffyLabel(f));
        else dayStats.arrived.push(_fluffyLabel(f));
      }
    } else if (known.has(f.id)) {
      dayStats.died.push(`${_fluffyLabel(f)}${f.causeOfDeath ? ` (${f.causeOfDeath.toLowerCase()})` : ""}`);
    }
  }
  // Wild park fluffies born or died since the last check
  for (const f of fluffies) {
    if (f.adopted || f.scene !== "PARK") continue;
    if (!f.isAlive && !f._dayCountedDeath) {
      f._dayCountedDeath = true;
      dayStats.wildDied++;
    }
    if (!f._dayCountedBirth) {
      f._dayCountedBirth = true;
      if (f.motherId !== null && f.motherId !== undefined && f.growth < 0.1) dayStats.wildBorn = (dayStats.wildBorn || 0) + 1;
    }
  }
  dayStats.known = now;
  if (typeof weatherState !== "undefined" && weatherState.type && !dayStats.weather.includes(weatherState.type))
    dayStats.weather.push(weatherState.type);

  // Morning: show yesterday, start today
  if (index > dayStats.day) {
    dayReportShown = _finishDay();
    if (typeof setGameSpeed === "function") setGameSpeed(1);
    _startDay(index);
  }
}

function closeDayReport() {
  dayReportShown = null;
}

function isDayReportOpen() {
  return !!dayReportShown;
}

// ---- Drawing (screen pass only) ----

const DR_W = 620;
const DR_H = 500;
const DR_NIGHT_ROWS = 3; // room for last night's park events

function getDayReportLayout() {
  const x = Math.round(width / 2 - DR_W / 2);
  const n = dayReportShown && dayReportShown.nightEvents ? Math.min(DR_NIGHT_ROWS, dayReportShown.nightEvents.length) : 0;
  const h = DR_H + (n ? 30 + n * 20 : 0);
  const y = Math.round(Math.max(8, height / 2 - h / 2));
  return { x, y, w: DR_W, h, btn: { x: x + DR_W / 2 - 90, y: y + h - 58, w: 180, h: 40 } };
}

function _listText(list, max = 4) {
  if (!list.length) return "none";
  // Unnamed fluffies are counted rather than listed
  const unnamed = list.filter((x) => x === "unnamed" || x.startsWith("unnamed ")).length;
  if (unnamed) {
    const named = list.filter((x) => !(x === "unnamed" || x.startsWith("unnamed ")));
    list = [...named, `${unnamed} unnamed`];
  }
  const shown = list.slice(0, max).join(", ");
  return list.length > max ? `${shown} and ${list.length - max} more` : shown;
}

function _money(n) {
  const sign = n < 0 ? "-" : "+";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

function drawDayReport(c) {
  const r = dayReportShown;
  if (!r) return;
  if (typeof ctx !== "undefined" && c !== ctx) return; // screen pass only
  const L = getDayReportLayout();
  c.save();
  c.globalAlpha = 1;
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

  c.textBaseline = "alphabetic";
  c.textAlign = "center";
  c.fillStyle = "#ffd6f0";
  c.font = "bold 26px Arial";
  c.fillText(`Day ${r.dayNumber} is over`, L.x + L.w / 2, L.y + 42);
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.font = "14px Arial";
  const weather = r.weather.map((w) => (typeof WEATHER_NAMES !== "undefined" && WEATHER_NAMES[w]) || w).join(", ");
  c.fillText(`${r.season}${weather ? " · " + weather : ""}`, L.x + L.w / 2, L.y + 64);

  const delta = r.moneyEnd - r.moneyStart;
  const rows = [
    [
      "Money",
      `${_money(delta)}  (now $${Math.round(r.moneyEnd).toLocaleString()})`,
      delta >= 0 ? "#9fe0a8" : "#ff8a80",
    ],
    ["Sold", r.sold.count ? `${r.sold.count} fluffies for $${r.sold.money.toLocaleString()}` : "none", null],
    ["Orders filled", r.orders.count ? `${r.orders.count} for $${r.orders.money.toLocaleString()}` : "none", null],
    ["Born", _listText(r.born), r.born.length ? "#9fe0a8" : null],
    ["New arrivals", _listText(r.arrived), null],
    ["Died", _listText(r.died, 3), r.died.length ? "#ff8a80" : null],
    ["Scarred for life", _listText(r.scarred), r.scarred.length ? "#ff8a80" : null],
    ["Fluffy Park", `${r.wildArrived} wild fluffies arrived, ${r.wildBorn || 0} born, ${r.wildDied} died`, null],
  ];
  let y = L.y + 104;
  c.textAlign = "left";
  for (const [label, value, color] of rows) {
    c.font = "bold 15px Arial";
    c.fillStyle = "rgba(255,255,255,0.65)";
    c.fillText(label, L.x + 30, y);
    c.font = "15px Arial";
    c.fillStyle = color || "white";
    c.fillText(_fit(c, value, L.w - 210), L.x + 180, y);
    y += 26;
  }

  // Last night in the park (NightEvents.js)
  const night = (r.nightEvents || []).slice(-DR_NIGHT_ROWS);
  if (night.length) {
    y += 6;
    c.font = "bold 15px Arial";
    c.fillStyle = "#ffd6f0";
    c.fillText("Last night in the park", L.x + 30, y);
    y += 22;
    c.font = "14px Arial";
    for (const e of night) {
      c.fillStyle = e.good ? "#9fe0a8" : "#ff8a80";
      c.fillText((e.good ? "▲ " : "▼ ") + _fit(c, e.text, L.w - 76), L.x + 34, y);
      y += 20;
    }
  }

  // Park news
  y += 6;
  c.font = "bold 15px Arial";
  c.fillStyle = "#ffd6f0";
  c.fillText("News", L.x + 30, y);
  y += 22;
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.85)";
  const news = r.news.length ? r.news.slice(-5) : ["A quiet day."];
  for (const n of news) {
    c.fillText("• " + _fit(c, n, L.w - 70), L.x + 34, y);
    y += 20;
  }

  if (typeof drawGlassButton === "function") {
    drawGlassButton(L.btn.x, L.btn.y, L.btn.w, L.btn.h, "Start the day", { fontSize: 17, borderRadius: 10 });
  }
  c.restore();
}

// Shorten text to fit a width
function _fit(c, text, maxW) {
  if (c.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 3 && c.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

// Mouse down (screen positions): any click on the card's button closes it;
// clicks elsewhere are swallowed while it's open
function handleDayReportClick() {
  if (!dayReportShown) return false;
  const L = getDayReportLayout();
  if (isPointInRect(mouse.x, mouse.y, L.btn.x, L.btn.y, L.btn.w, L.btn.h)) closeDayReport();
  return true;
}
