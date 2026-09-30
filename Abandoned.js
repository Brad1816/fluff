// ---------------------------------------------------------------------------
// Abandoned fluffies: pets whose owner dumped them when they were older.
//
// Personality "abandoned" (shown as "Abandoned"). Unlike an abandoned baby,
// they're anything from a half-grown foal to elderly, they had an owner so
// they come with a name (Names.js isFormerPet / giveOwnerName), and they
// miss that owner: f.missingOwner (0..1, saved) starts at 0.7-1.
//
// While they miss their owner their happiness settles lower (at full
// missing, about 0.3 instead of 0.6), so they look sad, sell for less
// (Wellbeing.js temperament) and now and then ask where their old daddeh
// went. It fades over ABANDON_GRIEF_DAYS (5 game days) - faster once
// they're yours, the more they trust you (x1-2); slower in the wild (x0.5)
// and for elderly ones (x0.6). When it's gone they've got over it (a
// message and a line if they're yours).
//
// Where they come from: script.js spawnFeralGroup (one of the backstories
// for fluffies turning up outside) and ParkLife.js (some park arrivals).
// setupAbandoned() gives them their age, name and feelings.
// The magnifying glass shows "Misses its old owner (70%)".
// ---------------------------------------------------------------------------

const ABANDON_GRIEF_DAYS = 5;
const ABANDONED_TICK = 1;

const abandonedTicker = new Ticker(ABANDONED_TICK);

function isAbandoned(f) {
  return !!f && Array.isArray(f.personalities) && f.personalities.includes("abandoned");
}

// Call when an abandoned fluffy is made (after its personalities are set).
// A grown-up or an old one (45% of them senior or elderly).
function setupAbandoned(f) {
  if (!isAbandoned(f) || f._abandonedSetUp) return;
  f._abandonedSetUp = true;
  if (typeof setSpawnAge === "function") {
    if (f.growth >= 1) {
      if (Math.random() < 0.55) setSpawnAge(f, 3, SENIOR_DAYS - 1);
      else setSpawnAge(f, SENIOR_DAYS, OLD_AGE_RISK_DAYS + 3);
    } else setSpawnAge(f);
  }
  f.missingOwner = 0.7 + Math.random() * 0.3;
  if (typeof recordStory === "function") recordStory("abandoned", f);
  // Used to people: not scared of them, but not sure of them either
  f.playerTrust = 0.45;
  f.playerFear = 0.05;
  if (typeof giveOwnerName === "function") giveOwnerName(f);
}

// A lone one might have been dumped half grown (not used for mums, mates
// or families, which have to be grown up)
function makeYoungAbandoned(f) {
  if (!isAbandoned(f)) return;
  f.growth = 0.5 + Math.random() * 0.45;
  if (typeof f.updateGrowthStats === "function") f.updateGrowthStats();
  if (typeof setSpawnAge === "function") setSpawnAge(f);
}

function _abandonedName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
}

// Magnifying glass row: [text, tone] or null
function describeMissingOwner(f) {
  if (!f || !(f.missingOwner > 0)) return null;
  const pct = Math.max(1, Math.round(f.missingOwner * 100));
  return [`Misses its old owner (${pct}%)`, f.missingOwner > 0.5 ? "bad" : "ok"];
}

// How fast it gets over it (per second)
function abandonedRecoveryRate(f) {
  let r = 1 / (ABANDON_GRIEF_DAYS * DAY_LENGTH);
  if (f.adopted) r *= 1 + Math.max(0, Math.min(1, f.playerTrust ?? 0.5));
  else r *= 0.5;
  if (typeof isElderly === "function" && isElderly(f)) r *= 0.6;
  return r;
}

// script.js updateSimulation (works once a second)
function updateAbandoned(dt) {
  const step = abandonedTicker.step(dt); // seconds since last time, or 0 (Systems.js)
  if (!step) return;
  for (const f of fluffies) {
    if (!f.isAlive || !(f.missingOwner > 0)) continue;
    // Happiness settles lower: shifts the 0.6 it drifts to (Horse.update)
    // down to 0.6 - 0.3 x missing
    if (f.happiness > WAN_DIE_THRESHOLD + 0.1) f.changeHappiness(((-0.3 * f.missingOwner) / 180) * step);
    // Now and then it asks after its old owner
    if (f.currentStateKey !== "SLEEPING" && !f.tooYoungToSpeak() && Math.random() < 0.004 * step)
      f.speak(getDialogue(["ABANDONED", "MISS"], f));
    f.missingOwner = Math.max(0, f.missingOwner - abandonedRecoveryRate(f) * step);
    if (f.missingOwner <= 0) {
      f.missingOwner = 0;
      f.changeHappiness(0.1);
      if (!f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING") f.speak(getDialogue(["ABANDONED", "OVER_IT"], f));
      if (f.adopted) {
        const text = `${_abandonedName(f)} has got over its old owner.`;
        if (typeof addUIMessage === "function") addUIMessage(text);
        if (typeof noteDayEvent === "function") noteDayEvent("news", { text });
      }
    }
  }
}

// Runs every simulation step (Systems.js)
registerSystem("abandoned", updateAbandoned, 140);
