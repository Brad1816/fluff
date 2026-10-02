// ---------------------------------------------------------------------------
// Getting over a fear (Fears.js), two ways - right-click one of yours that's
// scared of something (thunder, the dark, the Fluff-Bot, the hot iron,
// cages), awake and not in a fright:
//   - Face its fear, gently (kind): you show it the thing from a safe
//     distance with a treat and a cuddle. Its worst fear shrinks a little
//     (EXPOSE_GENTLE; more if it trusts you), once a day (EXPOSE_REST).
//   - Force it (harsh): you hold it right up to it. Most of the time
//     (FORCE_WORKS) the fear shrinks a lot (EXPOSE_FORCE) - but it's
//     miserable, and it remembers you did it (Memory.js "forced_fear": more
//     fear of you, less trust). Otherwise it backfires: the fear gets worse
//     (FORCE_BACKFIRE) and it panics. Once a day too.
// Getting a fear down below "a bit" (FEAR_MIN) goes in its story.
// The Brave lesson (Lessons.js) and comforting it in a fright still work
// as before.
// ---------------------------------------------------------------------------

const EXPOSE_GENTLE = 0.07;
const EXPOSE_TRUST_BONUS = 1.4; // x, when it trusts you (playerTrust 0.5+)
const EXPOSE_FORCE = 0.25;
const FORCE_WORKS = 0.6;
const FORCE_BACKFIRE = 0.15;
const EXPOSE_REST = 1; // game days between goes

function _exNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}

// The fear it'd face: its worst
function worstFear(f) {
  if (typeof realFears !== "function") return null;
  const list = realFears(f);
  return list.length ? list[0] : null;
}

function canFaceFear(f) {
  if (!f || !f.isAlive || !f.adopted || f.tooYoungToWalk() || f.currentStateKey === "SLEEPING") return false;
  if (typeof isFrightened === "function" && isFrightened(f)) return false;
  if (typeof f._exposedAt === "number" && _exNow() - f._exposedAt < EXPOSE_REST * DAY_LENGTH && _exNow() >= f._exposedAt) return false;
  return !!worstFear(f);
}

function _exName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "It";
}

function _exOver(f, fe, before) {
  if (before >= FEAR_MIN && fearOf(f, fe.key) < FEAR_MIN && typeof recordStory === "function") recordStory("turning", f, { x: `${_exName(f)} got over ${fe.name === "the dark" ? "its fear of the dark" : `its fear of ${fe.name}`}.` });
}

// Kind: a little, safely
function faceFearGently(f) {
  if (!canFaceFear(f)) return false;
  const fe = worstFear(f);
  const before = fearOf(f, fe.key);
  const k = (f.playerTrust || 0) >= 0.5 ? EXPOSE_TRUST_BONUS : 1;
  changeFear(f, fe.key, -EXPOSE_GENTLE * k);
  f._exposedAt = _exNow();
  if (typeof giveAffection === "function") giveAffection(f, "treat"); // (a treat and a cuddle)
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["FACE_FEAR", "GENTLE"], f), true);
  _exOver(f, fe, before);
  return true;
}

// Harsh: a lot, or worse
function forceFaceFear(f) {
  if (!canFaceFear(f)) return false;
  const fe = worstFear(f);
  const before = fearOf(f, fe.key);
  f._exposedAt = _exNow();
  f.changeHappiness(-0.12);
  if (typeof rememberPlayerEvent === "function") rememberPlayerEvent(f, "forced_fear");
  if (typeof changePlayerFear === "function") changePlayerFear(f, 0.06);
  if (typeof changePlayerTrust === "function") changePlayerTrust(f, -0.05);
  if (Math.random() < FORCE_WORKS) {
    changeFear(f, fe.key, -EXPOSE_FORCE);
    if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["FACE_FEAR", "FORCED"], f), true);
    _exOver(f, fe, before);
    return "worked";
  }
  changeFear(f, fe.key, FORCE_BACKFIRE);
  if (typeof startFright === "function") {
    f._frightAt = f._frightAt || {};
    delete f._frightAt[fe.key]; // (it panics now, whatever)
    startFright(f, fe.key);
  }
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["FACE_FEAR", "BACKFIRE"], f), true);
  if (f.adopted && typeof addUIMessage === "function") addUIMessage(`${_exName(f)} panicked - forcing it made its fear of ${fe.name} worse.`);
  return "backfired";
}

// Right-click menu (Tricks.js rightClickActions)
function fearActions(f) {
  if (!canFaceFear(f)) return [];
  const fe = worstFear(f);
  return [
    { key: "facefear", name: "Face its fear", sub: `gently: ${fe.name}`, run: (x) => faceFearGently(x) },
    { key: "forcefear", name: "Force it", sub: "harsh: may backfire", harsh: true, run: (x) => forceFaceFear(x) },
  ];
}
