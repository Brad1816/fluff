// ---------------------------------------------------------------------------
// The Mood tab (magnifying glass): what's making a fluffy happy or unhappy,
// a bit like RimWorld's mood list.
//
// Every change to its happiness (Horse.changeHappiness) can name a cause
// ("Hungry", "Played", "Scolded"...). noteMood keeps a running total for each
// cause that fades away over MOOD_MEMORY (so it shows what's been going on
// lately, the recent things counting most); changes nobody named go under
// "Other things". The tab shows:
//   - its mood as a bar (0-100), the "wan die" zone, and a marker for where
//     it's heading - its settled mood: 60, plus or minus the lasting things
//     (a wish come true, the feel of the room - Climate.js, fear of you -
//     Memory.js)
//   - Lasting: those settled-mood things, in mood points
//   - Lately: the causes, biggest first, in mood points (happiness x 100)
// Nothing here is saved: it fills up again as the fluffy lives.
// ---------------------------------------------------------------------------

const MOOD_MEMORY = 2 * HOUR_LENGTH; // a feeling's weight fades by e in this long
const MOOD_SHOW_MIN = 0.4; // mood points: smaller ones aren't listed

function noteMood(f, cause, delta, amount) {
  if (!f || !amount) return;
  const key = cause || "Other things";
  const now = timePlayed;
  if (!f._moodLog || typeof f._moodLog !== "object") f._moodLog = {};
  const e = f._moodLog[key] || (f._moodLog[key] = { v: 0, t: now });
  const age = Math.max(0, now - e.t);
  e.v = e.v * Math.exp(-age / MOOD_MEMORY) + amount;
  e.t = now;
}

// { mood, settle, lasting: [{ label, points }], lately: [{ label, points }] }
function moodFactors(f) {
  const now = timePlayed;
  const lasting = [];
  const add = (label, v) => {
    if (Math.abs(v) >= 0.004) lasting.push({ label, points: v * 100 });
  };
  const wish = typeof wishHappinessTarget === "function" ? wishHappinessTarget(f) : 0;
  add(wish >= 0 ? "Content: a wish came true" : "A wish still aching", wish);
  const room = typeof climateHappinessTarget === "function" ? climateHappinessTarget(f) : 0;
  if (room && typeof climateOf === "function") add(`The room feels ${climateOf(f.scene).label.toLowerCase()}`, room);
  const fear = typeof fearHappinessTarget === "function" ? fearHappinessTarget(f) : 0;
  add("Afraid of you", fear);
  const settle = 0.6 + wish + room + fear;
  const lately = [];
  for (const [label, e] of Object.entries(f._moodLog || {})) {
    const v = e.v * Math.exp(-Math.max(0, now - e.t) / MOOD_MEMORY);
    if (Math.abs(v * 100) >= MOOD_SHOW_MIN) lately.push({ label, points: v * 100 });
    else if (now - e.t > 6 * MOOD_MEMORY) delete f._moodLog[label]; // (long forgotten)
  }
  lately.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  return { mood: f.happiness, settle: Math.max(0, Math.min(1, settle)), lasting, lately };
}

function _moodColour(v) {
  if (v <= WAN_DIE_THRESHOLD) return "#b02a37";
  if (v <= HAPPINESS_MISERABLE_THRESHOLD) return "#e0574f";
  if (v < HAPPINESS_SAD_THRESHOLD) return "#e8a33d";
  if (v > HAPPINESS_HAPPY_THRESHOLD) return "#5cc97a";
  return "#c9c25a";
}

function _moodRows(c, rows, x, y, w, maxY, empty) {
  if (!rows.length) {
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.font = "italic 14px Arial";
    c.fillText(empty, x, y);
    return y + 22;
  }
  const big = Math.max(5, ...rows.map((r) => Math.abs(r.points)));
  for (const r of rows) {
    if (y > maxY) break;
    const good = r.points > 0;
    c.font = "14px Arial";
    c.textAlign = "left";
    c.fillStyle = "rgba(255,255,255,0.9)";
    let label = r.label;
    while (label.length > 3 && c.measureText(label).width > w - 150) label = label.slice(0, -2);
    if (label !== r.label) label += "…";
    c.fillText(label, x, y);
    // a little bar, and the number
    const bw = Math.max(2, (Math.abs(r.points) / big) * 70);
    c.fillStyle = good ? "rgba(92, 201, 122, 0.85)" : "rgba(224, 87, 79, 0.85)";
    c.fillRect(x + w - 128, y - 10, bw, 10);
    c.textAlign = "right";
    c.font = "bold 14px Arial";
    c.fillStyle = good ? "#7dff8a" : "#ff8a80";
    const n = Math.abs(r.points) >= 10 ? Math.round(r.points) : Math.round(r.points * 10) / 10;
    c.fillText(`${good ? "+" : "−"}${Math.abs(n)}`, x + w, y);
    y += 22;
  }
  return y;
}

// The tab itself (UIInspection.js), drawn in area {x, y, w, h}
function drawMoodTab(c, f, area) {
  const M = moodFactors(f);
  c.save();
  c.textBaseline = "alphabetic";
  const x = area.x;
  let y = area.y + 30;
  const word = typeof describeInspectionHappiness === "function" ? describeInspectionHappiness(f)[0] : "";
  c.textAlign = "left";
  c.font = "bold 18px Arial";
  c.fillStyle = "#ffd6f0";
  c.fillText(`Mood ${Math.round(M.mood * 100)} · ${word}`, x, y);
  // The bar
  y += 16;
  const bw = area.w;
  const bh = 22;
  c.fillStyle = "rgba(255,255,255,0.08)";
  roundRectPath(c, x, y, bw, bh, 8);
  c.fill();
  c.fillStyle = "rgba(176, 42, 55, 0.35)"; // the "wan die" zone
  c.fillRect(x, y, bw * WAN_DIE_THRESHOLD, bh);
  c.fillStyle = _moodColour(M.mood);
  roundRectPath(c, x, y, Math.max(8, bw * M.mood), bh, 8);
  c.fill();
  // Where it's heading
  const sx = x + bw * M.settle;
  c.fillStyle = "white";
  c.beginPath();
  c.moveTo(sx, y + bh + 2);
  c.lineTo(sx - 7, y + bh + 12);
  c.lineTo(sx + 7, y + bh + 12);
  c.closePath();
  c.fill();
  c.font = "12px Arial";
  c.textAlign = sx > x + bw - 160 ? "right" : "left";
  c.fillStyle = "rgba(255,255,255,0.75)";
  c.fillText(`settles at ${Math.round(M.settle * 100)}`, sx + (c.textAlign === "right" ? -10 : 10), y + bh + 13);
  c.textAlign = "left";
  y += bh + 40;
  // Two lists side by side
  const colW = (bw - 30) / 2;
  const maxY = area.y + area.h - 10;
  c.font = "bold 15px Arial";
  c.fillStyle = "#ffe066";
  c.fillText("Lasting", x, y);
  c.fillText("Lately (fades over a few hours)", x + colW + 30, y);
  c.font = "12px Arial";
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.fillText("where its mood settles", x, y + 16);
  c.fillText("what's raised or lowered it", x + colW + 30, y + 16);
  _moodRows(c, M.lasting, x, y + 42, colW, maxY, "Nothing lasting: it settles at 60.");
  _moodRows(c, M.lately, x + colW + 30, y + 42, colW, maxY, "Nothing much lately.");
  c.restore();
}
