// ---------------------------------------------------------------------------
// The hot-times and the cold-times (lore): fluffies call summer the
// "hawt-times" and winter the "cowd-times" - once they know them. A fluffy
// knows a season once it has lived through some of it (SEASON_KNOW_DAYS days,
// counted in f.seasonDays, saved; anything a year old has), or straight away if it's clever
// (SEASON_SMART, Intelligence.js smartsOf). One that's never known it is
// puzzled when it comes: "Wai bwight-baww su meanie nao??".
//
// When summer or winter starts, the fluffies say so, now and then, in
// whichever way they understand it; their hot and cold complaints (Heat.js,
// Warmth.js) sometimes name the season too (seasonLine).
// ---------------------------------------------------------------------------

const SEASON_KNOW_DAYS = 2;
const SEASON_SMART = 0.35;
const SEASON_TALK_CHANCE = 0.5; // each awake fluffy when the season turns

function _ssSeason() {
  return typeof getSeason === "function" ? getSeason() : "Spring";
}

// Does it know this season (lived through it, or clever enough)?
function knowsSeason(f, season = _ssSeason()) {
  if (!f) return false;
  if (((f.seasonDays && f.seasonDays[season]) || 0) >= SEASON_KNOW_DAYS) return true;
  // (a year old or more: it has been through them all)
  if (typeof ageDays === "function" && typeof DAYS_PER_YEAR === "number" && ageDays(f) >= DAYS_PER_YEAR) return true;
  return typeof smartsOf === "function" && smartsOf(f) >= SEASON_SMART;
}

// "HOT" | "COLD" -> a line about the season, in what it knows - or null
// (only in summer/winter, and only for a hot complaint in summer or a cold
// one in winter)
function seasonLine(f, kind) {
  const s = _ssSeason();
  if (!f || f.tooYoungToSpeak() || typeof getDialogue !== "function") return null;
  if ((kind === "HOT" && s !== "Summer") || (kind === "COLD" && s !== "Winter")) return null;
  return getDialogue(["SEASON", kind, knowsSeason(f, s) ? "KNOWN" : "NEW"], f);
}

// Once a day: a day lived in this season; and when summer or winter begins,
// they say so
let _ssDay = null;
let _ssSeen = null;
function updateSeasonSense() {
  if (typeof fluffies === "undefined" || typeof getDayNumber !== "function") return;
  const day = getDayNumber();
  if (_ssDay === day) return;
  const first = _ssDay === null;
  _ssDay = day;
  const s = _ssSeason();
  const turned = !first && _ssSeen !== null && _ssSeen !== s;
  _ssSeen = s;
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    if (!first) {
      if (!f.seasonDays || typeof f.seasonDays !== "object") f.seasonDays = {};
      f.seasonDays[s] = (f.seasonDays[s] || 0) + 1;
    }
    if (turned && (s === "Summer" || s === "Winter") && Math.random() < SEASON_TALK_CHANCE) {
      const line = seasonLine(f, s === "Summer" ? "HOT" : "COLD");
      if (line && f.currentStateKey !== "SLEEPING") f.speak(line);
    }
  }
}
registerSystem("seasonSense", updateSeasonSense, 51);
