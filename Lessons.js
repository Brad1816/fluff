// ---------------------------------------------------------------------------
// Lessons: talking a fluffy out of bad ideas.
//
// RIGHT-CLICK one of your fluffies: under the tricks there's a row of
// lessons. Only the ones it needs show up:
//   - "Colours"   (World Colorism on, and it looks down on poopie-coloured
//                  fluffies): each lesson that sinks in lowers its colour
//                  prejudice (f.coloristDegree) by LESSON_COLOURS. A mare
//                  talked out of it stops attacking her poopie foals.
//   - "Alicorns"  (World Alicorn Intolerance on, and it's still scared of
//                  "munstahs"): comfort + LESSON_ALICORNS (AlicornAcceptance)
//   - "Litter"    (not fully litter trained): + LESSON_LITTER
//   - "Be good"   (Smarties only): very hard. Each lesson only sinks in
//                  about a fifth as often (LESSON_SMARTY_CHANCE) and moves
//                  it LESSON_SMARTY_STEP towards reformed (f.smartyReform,
//                  saved). At 1 it gives up being a Smarty for good. A
//                  lesson that doesn't sink in can make a Smarty dig its
//                  hooves in (LESSON_SMARTY_SLIP). Expect weeks of it,
//                  and a Smarty that doesn't like you may never get there.
//
// LESSON_TRIES_PER_DAY lessons a day per fluffy (all kinds together - they
// have short attention spans). Whether one sinks in (lessonChance):
// affection most (a fluffy that loves you listens ~3x as often as one that
// doesn't like you), foals are easier to teach and the elderly set in their
// ways, and a hungry or miserable fluffy doesn't listen. Asleep or scared of
// you: no lesson.
//
// The other way: Fluff TV's Play Time channel has "all colours are friends"
// shows that lower colour prejudice in whoever's watching (FluffTV.js).
//
// Shown in the magnifying glass (Mind tab, "Lessons").
// ---------------------------------------------------------------------------

const LESSON_TRIES_PER_DAY = 3;
const LESSON_COLOURS = 0.08;
const LESSON_ALICORNS = 0.07;
const LESSON_LITTER = 0.07;
const LESSON_SMARTY_CHANCE = 0.2; // x the normal chance
const LESSON_SMARTY_STEP = 0.1;
const LESSON_SMARTY_SLIP = 0.02; // lost when a Smarty lesson fails (1 time in 4)

const LESSONS = [
  {
    key: "colours",
    name: "Colours",
    applies: (f) => typeof worldSettings !== "undefined" && !!worldSettings.colorism && (f.coloristDegree || 0) > 0.01,
    progress: (f) => 1 - Math.max(0, Math.min(1, f.coloristDegree || 0)),
    teach: (f) => {
      f.coloristDegree = Math.max(0, (f.coloristDegree || 0) - LESSON_COLOURS);
      return f.coloristDegree <= 0.01;
    },
    doneMsg: (n) => `${n} doesn't care about colours any more! ✓`,
  },
  {
    key: "alicorns",
    name: "Alicorns",
    applies: (f) =>
      typeof _alicornIntoleranceOn === "function" &&
      _alicornIntoleranceOn() &&
      typeof getAlicornComfort === "function" &&
      getAlicornComfort(f) < 1 &&
      !(f.typeVisibleToOthers && f.typeVisibleToOthers() === "alicorn"),
    progress: (f) => (typeof getAlicornComfort === "function" ? getAlicornComfort(f) : 1),
    teach: (f) => {
      if (typeof addAlicornComfort === "function") addAlicornComfort(f, LESSON_ALICORNS);
      return getAlicornComfort(f) >= 1;
    },
    doneMsg: null, // (AlicornAcceptance says so itself)
  },
  {
    key: "litter",
    name: "Litter",
    applies: (f) => (f.pottyTraining || 0) < 0.999,
    progress: (f) => Math.max(0, Math.min(1, f.pottyTraining || 0)),
    teach: (f) => {
      f.pottyTraining = Math.min(1, (f.pottyTraining || 0) + LESSON_LITTER);
      return f.pottyTraining >= 0.999;
    },
    doneMsg: (n) => `${n} is litter trained! ✓`,
  },
  {
    key: "smarty",
    name: "Be good",
    applies: (f) => !!(f.isSmarty && f.isSmarty()),
    progress: (f) => Math.max(0, Math.min(1, f.smartyReform || 0)),
    teach: (f) => {
      f.smartyReform = Math.min(1, (f.smartyReform || 0) + LESSON_SMARTY_STEP);
      if (f.smartyReform >= 1) {
        reformSmarty(f);
        return true;
      }
      return false;
    },
    doneMsg: (n) => `${n} isn't a Smarty any more! ✓`,
  },
];

function getLesson(key) {
  return LESSONS.find((l) => l.key === key) || null;
}

// The lessons this fluffy could do with
function lessonsFor(f) {
  if (!f || !f.isAlive || !f.adopted) return [];
  return LESSONS.filter((l) => l.applies(f));
}

function lessonTriesLeft(f) {
  const d = _trDay();
  if (!f.lessonTries || f.lessonTries.day !== d) return LESSON_TRIES_PER_DAY;
  return Math.max(0, LESSON_TRIES_PER_DAY - f.lessonTries.n);
}

// How likely a lesson sinks in this time
function lessonChance(f, key) {
  const lvl = typeof affectionLevel === "function" ? affectionLevel(f) : "unsure";
  let p = { adores: 0.85, loves: 0.8, likes: 0.65, unsure: 0.45, dislikes: 0.25 }[lvl] ?? 0.45;
  const stage = typeof lifeStage === "function" ? lifeStage(f) : "adult";
  if (stage === "foal") p *= 1.2;
  else if (stage === "elderly") p *= 0.75;
  if (f.hunger < 0.3) p *= 0.7;
  if (f.happiness < 0.3) p *= 0.7;
  if (key === "smarty") p *= LESSON_SMARTY_CHANCE;
  return Math.max(0.02, Math.min(0.95, p));
}

function lessonRefusal(f) {
  if (!canLearnTricks(f)) return "can't";
  if (f.currentStateKey === "SLEEPING") return "asleep";
  if ((f.playerFear || 0) >= 0.45) return "scared";
  if (lessonTriesLeft(f) <= 0) return "tired";
  return null;
}

function _lsSay(f, key) {
  if (!f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING") f.speak(getDialogue(["LESSON", key], f), true);
}

// Give it a lesson. Returns "learnt", "didn't", "done" (and it's cured), or
// why it didn't happen.
function giveLesson(f, key) {
  const lesson = getLesson(key);
  if (!lesson || !f) return "can't";
  if (!lesson.applies(f)) return "not needed";
  const why = lessonRefusal(f);
  if (why) {
    if (why === "tired") _lsSay(f, "TIRED");
    else if (why === "scared" && !f.tooYoungToSpeak()) f.speak(getDialogue(["TRUST", "FLEE"], f), true);
    return why;
  }
  const d = _trDay();
  if (!f.lessonTries || f.lessonTries.day !== d) f.lessonTries = { day: d, n: 0 };
  f.lessonTries.n++;
  const smarty = key === "smarty";
  if (Math.random() < lessonChance(f, key)) {
    // Sits and listens
    if (typeof startTrick === "function" && !f.trickNow && !f.currentCage && !f.placedOn) startTrick(f, "sit", null, 3);
    f.expressionOverride = "GOOD_UPSIES";
    f.expressionOverrideTimer = 2;
    const cured = lesson.teach(f);
    _lsSay(f, smarty ? "SMARTY_LISTENS" : key.toUpperCase());
    if (cured) {
      if (lesson.doneMsg && typeof addUIMessage === "function") addUIMessage(lesson.doneMsg(_trName(f)));
      return "done";
    }
    return "learnt";
  }
  // Didn't sink in
  if (smarty) {
    f.expressionOverride = "ANGRY_PUFFED";
    f.expressionOverrideTimer = 1.5;
    if (Math.random() < 0.25) f.smartyReform = Math.max(0, (f.smartyReform || 0) - LESSON_SMARTY_SLIP);
    _lsSay(f, "SMARTY_REFUSES");
  } else {
    f.expressionOverride = "SHOCKED";
    f.expressionOverrideTimer = 1.5;
    _lsSay(f, key === "colours" ? "COLOURS_NO" : "NOT_LISTENING");
  }
  return "didn't";
}

// Stops being a Smarty for good (lessons, or the Fluff TV torture channel)
function reformSmarty(f) {
  const list = Array.isArray(f.personalities) ? f.personalities : [];
  f.personalities = list.filter((p) => p !== "smarty");
  f.smartyReform = 1;
  f.smartyReformed = true;
}

// Magnifying glass row: [text, tone] or null
function describeLessons(f) {
  const parts = [];
  for (const l of lessonsFor(f)) {
    if (l.key === "smarty") parts.push(`Be good ${Math.round(l.progress(f) * 100)}%`);
  }
  if (f.smartyReformed) parts.push("Was a Smarty - reformed");
  if (!parts.length) return null;
  return [parts.join(" · "), f.smartyReformed ? "good" : "ok"];
}

// ---- Right-click menu (drawn and clicked by Tricks.js) ----

function drawLessonChip(c, f, ch, hover) {
  const p = ch.lesson.progress(f);
  fillRoundRect(c, ch.x, ch.y, ch.w, ch.h, 10, hover ? "rgba(40, 150, 140, 0.95)" : "rgba(20, 70, 70, 0.9)");
  c.fillStyle = "white";
  c.font = "bold 14px Arial";
  c.fillText(ch.lesson.name, ch.x + ch.w / 2, ch.y + 13);
  c.font = "11px Arial";
  c.fillStyle = "#bfe8e2";
  c.fillText(`${Math.round(p * 100)}%`, ch.x + ch.w / 2, ch.y + 28);
  c.fillStyle = "rgba(255,255,255,0.15)";
  c.fillRect(ch.x + 8, ch.y + ch.h - 4, ch.w - 16, 2);
  c.fillStyle = "#7fe0d0";
  c.fillRect(ch.x + 8, ch.y + ch.h - 4, (ch.w - 16) * p, 2);
}

function lessonResultMessage(f, res, key) {
  const n = _trName(f);
  return (
    {
      asleep: `${n} is asleep.`,
      tired: `${n} has had enough lessons for today.`,
      scared: `${n} is too scared of you to listen.`,
      learnt: key === "smarty" ? `${n} listened... this time.` : `${n} listened.`,
      "didn't": key === "smarty" ? `${n} won't listen to a dummeh.` : `${n} didn't take it in.`,
    }[res] || null
  );
}
