// ---------------------------------------------------------------------------
// The keeper summary (design doc Phase 5): once a game week (every
// WEEK_DAYS mornings) the day report has one plain-English paragraph about
// the week: "This week 3 fluffies grew to love you, 1 became Broken, and
// the backyard has been Tense since day 12." It never judges; it only says
// what happened.
//
// weekStats (saved) collects it: who came to love you (Affection.js), new
// titles (Titles.js), births, deaths and sales (each morning's report),
// runaways (Runaways.js), and the feel of each room each morning
// (Climate.js).
// ---------------------------------------------------------------------------

const WEEK_DAYS = 7;

function freshWeekStats() {
  return { startDay: null, loved: [], titles: {}, born: 0, died: 0, sold: 0, ranAway: 0, rooms: {} };
}
let weekStats = freshWeekStats();

function _wkOk() {
  if (!weekStats || typeof weekStats !== "object") weekStats = freshWeekStats();
  for (const [k, v] of Object.entries(freshWeekStats())) if (weekStats[k] === undefined || (typeof v === "object" && v !== null && typeof weekStats[k] !== "object")) weekStats[k] = v;
  return weekStats;
}

// Affection.onAffectionChanged: it grew to love you
function noteWeekLoved(f) {
  const w = _wkOk();
  if (!w.loved.includes(f.id)) w.loved.push(f.id);
}

// Titles.setTitle
function noteWeekTitle(f, title) {
  if (!title) return;
  const w = _wkOk();
  if (!Array.isArray(w.titles[title])) w.titles[title] = [];
  if (!w.titles[title].includes(f.id)) w.titles[title].push(f.id);
}

function noteWeekRanAway() {
  _wkOk().ranAway++;
}

// Each morning (DayReport): add up the day, note the rooms, and every
// WEEK_DAYS days return the paragraph (or null)
function weekSummaryFor(report) {
  const w = _wkOk();
  const day = report.dayNumber;
  if (w.startDay === null) w.startDay = day;
  w.born += report.born.length;
  w.died += report.died.length;
  w.sold += report.sold.count || 0;
  // The rooms this morning
  if (typeof climateOf === "function" && typeof fluffies !== "undefined") {
    const scenes = [...new Set(fluffies.filter((f) => f.isAlive && f.adopted).map((f) => f.scene))];
    for (const s of scenes) {
      if (typeof getSceneConfig === "function" && !getSceneConfig(s).insidePlayerQuarters) continue;
      const label = climateOf(s).label;
      const r = w.rooms[s] && typeof w.rooms[s] === "object" ? w.rooms[s] : (w.rooms[s] = { label, since: day });
      if (r.label !== label) {
        r.label = label;
        r.since = day;
      }
    }
  }
  if (day - w.startDay + 1 < WEEK_DAYS) return null;
  const text = weekParagraph(w, day);
  weekStats = freshWeekStats();
  weekStats.startDay = day + 1;
  weekStats.rooms = w.rooms; // (rooms carry on)
  return text;
}

function _wkRoom(scene) {
  if (scene === "BACKYARD") return "the backyard";
  const n = typeof houseRoomName === "function" ? houseRoomName(scene) : "";
  return n ? (n === "Living room" ? "the living room" : n) : "a room";
}

function weekParagraph(w, day) {
  const parts = [];
  const n = (k, one, many) => (k === 1 ? `1 ${one}` : `${k} ${many}`);
  if (w.loved.length) parts.push(`${n(w.loved.length, "fluffy", "fluffies")} grew to love you`);
  for (const [title, ids] of Object.entries(w.titles)) {
    if (!ids.length) continue;
    const one = { Rebel: "became a Rebel", Survivor: "became a Survivor", Guardian: "became a Guardian", Wary: "grew wary of you" };
    const many = { Rebel: "became Rebels", Survivor: "became Survivors", Guardian: "became Guardians", Wary: "grew wary of you" };
    parts.push(`${ids.length} ${(ids.length === 1 ? one : many)[title] || `became ${title}`}`);
  }
  if (w.born) parts.push(`${n(w.born, "foal was", "foals were")} born`);
  if (w.died) parts.push(`${n(w.died, "fluffy", "fluffies")} died`);
  if (w.sold) parts.push(`you sold ${n(w.sold, "fluffy", "fluffies")}`);
  if (w.ranAway) parts.push(`${n(w.ranAway, "fluffy", "fluffies")} ran away`);
  const rooms = Object.entries(w.rooms)
    .filter(([, r]) => r && r.label !== "Calm" && day - r.since >= 2)
    .map(([s, r]) => `${_wkRoom(s)} has been ${r.label} since day ${r.since}`);
  parts.push(...rooms.slice(0, 2));
  if (!parts.length) return "This week was quiet.";
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  return `This week ${list}.`;
}
