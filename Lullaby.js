// ---------------------------------------------------------------------------
// The mummah song: a mare sings to her foals.
//
// When: at bedtime (once an evening, SONG_EVENING_FROM to midnight) when
// she has foals still on her (baby_child) near her and awake, and any time
// one of them is frightened (thunder, the dark...) - at most once every
// SONG_FRIGHT_REST.
// What it does, for each of her foals that hears it (in the room, within
// SONG_NEAR, with ears):
//   - a fright ends there and then, and the fear of it eases a little
//   - in the evening, sleepy: it settles down to sleep soon
//   - a little happier (and so is she)
//   - for the rest of the night thunder and the dark often don't frighten
//     it at all (SONG_SOOTHES; Fears.startFright asks lullabySoothes)
// Learning it: a foal that hears it SONG_LEARN_AT times knows it
// (f.knowsSong). A mare who never learned it can't sing to her own foals -
// a poorer mother: her foals have no song, and she's quicker to turn a
// foal away for its smell (Runts.js). Fluffies that come from outside (the
// shop, strays, the park) mostly know it (SONG_KNOWN_OUTSIDE); foals born
// here have to hear it. A gag stops her singing.
// Shown in the magnifying glass (Family, "Mummah song") and the Story tab
// ("learned mummah's song").
// Saved: f.knowsSong, f.songHeard.
// ---------------------------------------------------------------------------

const SONG_NEAR = 260; // px
const SONG_FRIGHT_REST = 30; // game seconds
const SONG_EVENING_FROM = 20; // hour
const SONG_LEARN_AT = 3;
const SONG_KNOWN_OUTSIDE = 0.85;
const SONG_SOOTHES = 0.6; // chance a thunderclap or the dark doesn't frighten a foal sung to tonight
const SONG_SOOTHE_TIME = 8 * HOUR_LENGTH;
const SONG_SLEEPY = 0.3; // sleepDeprivation it's brought up to (foals sleep from 0.2)
const lullabyTicker = new Ticker(2);

// Does it know the song? (A grown fluffy from outside: mostly)
function knowsSong(f) {
  if (!f) return false;
  if (f.knowsSong === true) return true;
  if (f.knowsSong === false) return false;
  if (f.growth < 1) return false; // (still learning)
  f.knowsSong = Math.random() < SONG_KNOWN_OUTSIDE;
  return f.knowsSong;
}

function _lbGagged(m) {
  return !!(m.accessories && m.accessories.mouth && m.accessories.mouth.id === "mouthgag");
}

// Could she sing right now?
function canSingLullaby(m) {
  if (!m || !m.isAlive || m.gender !== "female" || m.growth < 1) return false;
  if (m.currentStateKey === "SLEEPING" || m.isDragging || m.happiness <= WAN_DIE_THRESHOLD) return false;
  if (_lbGagged(m) || m.tooYoungToSpeak()) return false;
  if (typeof mumAway === "function" && mumAway(m)) return false; // (time away from her foals, BadMummah.js)
  return knowsSong(m);
}

// Her foals still on her, near enough to hear her
function _lbListeners(m) {
  const rels = relationships[m.id] || {};
  const out = [];
  for (const f of fluffies) {
    if (!f.isAlive || f === m || f.scene !== m.scene || rels[f.id] !== "baby_child") continue;
    if (!f.canHear() || Math.hypot(f.x - m.x, f.y - m.y) > SONG_NEAR) continue;
    if (f.currentCage !== m.currentCage) continue;
    out.push(f);
  }
  return out;
}

// She sings. why: "bedtime" or "fright". Returns how many foals heard it.
function singLullaby(m, why = "bedtime") {
  const foals = _lbListeners(m);
  if (!foals.length) return 0;
  const now = timePlayed;
  m._songAt = now;
  if (why === "fright") m._songFrightAt = now;
  m.speak(getDialogue(["MUMMAH_SONG", "SING"], m), true);
  m.changeHappiness(0.02, "Sang to her foals");
  if (typeof noteGoodDeed === "function") noteGoodDeed(m, "sang"); // (Care.js: praise)
  const evening = why === "bedtime";
  for (const f of foals) {
    // A fright ends
    if (typeof isFrightened === "function" && isFrightened(f)) {
      const key = endFright(f); // (Fears.js)
      if (typeof changeFear === "function") changeFear(f, key, -FEAR_COMFORT * 0.5);
      f.expressionOverride = "RELIEF";
      f.expressionOverrideTimer = 2;
    }
    f.songAt = now;
    f.changeHappiness(0.02, "Mummah sang");
    if (evening && f.currentStateKey !== "SLEEPING") f.sleepDeprivation = Math.max(f.sleepDeprivation || 0, SONG_SLEEPY);
    // Learning it
    if (!knowsSong(f) && f.knowsSong !== true) {
      f.songHeard = (f.songHeard || 0) + 1;
      if (f.songHeard >= SONG_LEARN_AT) {
        f.knowsSong = true;
        if (typeof recordStory === "function") recordStory("turning", f, { x: `${typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "It"} learned mummah's song.` });
      }
    }
    if (f.currentStateKey !== "SLEEPING" && !f.tooYoungToSpeak() && Math.random() < 0.4) f.speak(getDialogue(["MUMMAH_SONG", "FOAL"], f, m));
  }
  return foals.length;
}

// Fears.startFright: sung to tonight, thunder and the dark often pass it by
function lullabySoothes(f, key) {
  if (key !== "thunder" && key !== "dark") return false;
  if (typeof f.songAt !== "number" || timePlayed < f.songAt || timePlayed - f.songAt > SONG_SOOTHE_TIME) return false;
  return Math.random() < SONG_SOOTHES;
}

function updateLullabies(dt) {
  if (!lullabyTicker.step(dt) || typeof fluffies === "undefined") return;
  const now = timePlayed;
  const hour = typeof gameHour === "function" ? gameHour() : 12;
  const evening = hour >= SONG_EVENING_FROM;
  for (const m of fluffies) {
    if (m.gender !== "female" || m.growth < 1 || !m.isAlive) continue;
    if (!canSingLullaby(m)) continue;
    const foals = _lbListeners(m);
    if (!foals.length) continue;
    const scared = foals.some((f) => typeof isFrightened === "function" && isFrightened(f));
    if (scared && !(typeof m._songFrightAt === "number" && now >= m._songFrightAt && now - m._songFrightAt < SONG_FRIGHT_REST)) {
      singLullaby(m, "fright");
      continue;
    }
    if (evening && foals.some((f) => f.currentStateKey !== "SLEEPING") && !(typeof m._songAt === "number" && now >= m._songAt && now - m._songAt < 6 * HOUR_LENGTH)) {
      singLullaby(m, "bedtime");
    }
  }
}
registerSystem("lullabies", updateLullabies, 63);

// Magnifying glass: [text, tone] or null
function describeSong(f) {
  if (!f || !f.isAlive) return null;
  if (f.growth < 1) {
    if (f.knowsSong === true) return ["Knows mummah's song", "good"];
    const n = f.songHeard || 0;
    return n ? [`Learning mummah's song (heard it ${n} of ${SONG_LEARN_AT} times)`, "ok"] : null;
  }
  if (f.gender !== "female") return null;
  return knowsSong(f) ? ["Knows the mummah song", "good"] : ["Never learned the mummah song: can't sing her foals to sleep", "bad"];
}
