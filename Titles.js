// ---------------------------------------------------------------------------
// Titles and breaking points (design doc Phase 4).
//
// Patterns in a fluffy's life earn it a title (f.title, saved) that changes
// how it behaves, what it's worth and who wants it:
//
//   Cherished  loved (trust >= CHERISH_TRUST) for CHERISH_DAYS days in a row
//              without being hurt. Confident (frights x0.8), calms its room
//              (Climate.js), families pay more (Buyers.js, price x1.1).
//              Hurt suddenly: it becomes Wary.
//   Wary       a Cherished one you hurt: trust grows slowly (x0.5); after
//              WARY_DAYS without harm it's itself again.
//   Survivor   lived through serious harm (strain once past half its limit,
//              or a scar from you) and came to trust you again (trust >=
//              0.5, strain low); or healed from Broken. Tough but easily
//              startled (frights x1.25), loyal (trust grows x1.2). Loved long
//              enough it becomes Cherished. Never worth more than Cherished.
//   Broken     its spirit crushed: strain reached its breaking point. Numb:
//              happiness held between BROKEN_FLOOR and BROKEN_CEIL (never so
//              low it gives up and starves, never joyful); obeys anything
//              (FearTraining.obeysFromFear); calls you "owna"; dies sooner
//              (old age BROKEN_AGE_DAYS early); dark-market buyers want it.
//              Heals into a Survivor through long patient care (healing:
//              Sit with, praise, comfort, brushing, play, days without harm).
//   Rebel      a strong-willed one (bravery + temper >= REBEL_WILL) that
//              resisted: strain past REBEL_AT of its limit. Won't do as you
//              say (tricks, lessons), and spreads defiance when it chats
//              (Gossip.js: listeners trust you a little less). Can still
//              break, much later (strain past REBEL_BREAK x its limit).
//              Respected (kind care, no harm for a while) it becomes a
//              Guardian.
//   Guardian   stood up for foals or friends in fights GUARDIAN_DEFENDS
//              times (Bonds.js), or a Rebel won round. Steps into fights
//              more often; its foals grow up braver.
//   Spoiled    lots of treats and no lessons: SPOIL_TREATS treats in the
//              last SPOIL_DAYS days and no lesson or scolding. Demanding (a
//              day without a treat sulks it), fussy with tricks (won't
//              without a treat now and then). Lessons and firm care turn it
//              Cherished (if it loves you) or back to itself.
//
// Strain (f.strain) is what harm leaves: each hurt from you (Memory.js)
// STRAIN_HARM (a whack in training STRAIN_TRAINING), seeing it STRAIN_SEEN,
// scoldings, time-outs and strict
// training a little (Care.js, FearTraining.js). It fades each day without
// harm (STRAIN_FADE), faster with kindness. Each fluffy has its own
// breaking point (f.breakLimit): BREAK_BASE plus bravery and temper, plus a
// little luck. Some can take far more than others.
//
// Every title change is a turning point with a story line; the Story tab
// and magnifying glass show the title and any change under way ("Healing:
// Broken -> Survivor (about halfway)"); the Household list shows it. Foals
// of a Guardian grow braver, of a Cherished friendlier, of a Broken one
// more timid (once, Personality.js).
// ---------------------------------------------------------------------------

const CHERISH_TRUST = 0.8;
const CHERISH_DAYS = 5;
const WARY_DAYS = 3;
const BROKEN_FLOOR = 0.12;
const BROKEN_CEIL = 0.35;
const BROKEN_AGE_DAYS = 10;
const REBEL_WILL = 0.4;
const REBEL_AT = 0.6;
const REBEL_BREAK = 1.3;
const GUARDIAN_DEFENDS = 3;
const SPOIL_TREATS = 12;
const SPOIL_DAYS = 3;
const BREAK_BASE = 10;
const STRAIN_HARM = 1;
const STRAIN_SEEN = 0.25;
const STRAIN_FADE = 1; // a day without harm (x1.5 if it trusts you)
const STRAIN_TRAINING = 0.3; // a whack in training (the Sorry Stick, a strict Smack)
const HEAL_CARE = { sat_with: 0.08, praised: 0.02, comforted: 0.03, brushed: 0.02, played: 0.02, held_happy: 0.01 };
const HEAL_DAY = 0.04; // a day without harm
const HEAL_HARM = 0.3; // lost to each hurt
const REBEL_RESPECT = 6; // kind acts to win a Rebel round (no harm for 2 days)

const TITLE_TEXT = {
  Cherished: "Cherished - confident and calm; families pay more",
  Wary: "Wary - was hurt out of the blue; trusts slowly again",
  Survivor: "Survivor - lived through harm; startles easily, very loyal",
  Broken: "Broken - obeys anything, feels nothing",
  Rebel: "Rebel - won't obey you, and stirs up the others",
  Guardian: "Guardian - stands up for foals and friends",
  Spoiled: "Spoiled - demanding and fussy",
};

function _tiNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}
function _tiDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : Math.floor(_tiNow() / DAY_LENGTH) + 1;
}
function _tiName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Your fluffy";
}
function _tiTrait(f, k) {
  return typeof traitValue === "function" ? traitValue(f, k) : 0;
}
function _tiState(f) {
  if (!f.titleState || typeof f.titleState !== "object") f.titleState = { lovedDays: 0, defends: 0, respect: 0, healing: 0, maxStrain: 0, lastHarm: -1e9, day: _tiDay() };
  return f.titleState;
}

function titleOf(f) {
  return f && typeof f.title === "string" ? f.title : null;
}

// Its own breaking point
function breakLimitOf(f) {
  if (typeof f.breakLimit !== "number") {
    f.breakLimit = Math.round((BREAK_BASE + 5 * _tiTrait(f, "bravery") + 3 * Math.max(0, _tiTrait(f, "temper")) + (Math.random() - 0.5) * 4) * 10) / 10;
    f.breakLimit = Math.max(5, f.breakLimit);
  }
  return f.breakLimit;
}

function _strongWilled(f) {
  return _tiTrait(f, "bravery") + _tiTrait(f, "temper") >= REBEL_WILL;
}

function setTitle(f, title, why) {
  const before = titleOf(f);
  if (before === title) return false;
  f.title = title;
  f.titleSince = _tiNow();
  const st = _tiState(f);
  st.healing = 0;
  st.respect = 0;
  const n = _tiName(f);
  const line =
    why ||
    (title
      ? {
          Cherished: `${n} became Cherished: sure of your love.`,
          Wary: `${n} became Wary: you hurt ${f.gender === "male" ? "him" : "her"} out of the blue.`,
          Survivor: `${n} became a Survivor.`,
          Broken: `${n} broke. Something in ${f.gender === "male" ? "him" : "her"} went quiet.`,
          Rebel: `${n} became a Rebel: ${f.gender === "male" ? "he" : "she"} won't take it any more.`,
          Guardian: `${n} became a Guardian.`,
          Spoiled: `${n} became Spoiled.`,
        }[title]
      : `${n} is ${before === "Wary" ? "sure of you again" : "no longer " + before}.`);
  if (typeof noteTurningPoint === "function") noteTurningPoint(f, line);
  else if (typeof recordStory === "function") recordStory("turning", f, { x: line });
  if (title === "Broken" && typeof fluffySound === "function") fluffySound(f, "sad");
  if (typeof noteWeekTitle === "function") noteWeekTitle(f, title); // (WeekSummary.js)
  if (typeof noteRehab === "function") noteRehab(f, before, title); // healed from Broken (Inspector.js)
  return true;
}

// ---- What feeds it ----

// Harm: from Memory (harm memories), Care (scold, time-out), FearTraining
function noteTitleHarm(f, amount, why) {
  if (!f || !f.adopted || !f.isAlive) return;
  const st = _tiState(f);
  f.strain = Math.min(60, (f.strain || 0) + amount);
  st.maxStrain = Math.max(st.maxStrain || 0, f.strain);
  st.lastHarm = _tiNow();
  st.healing = Math.max(0, (st.healing || 0) - HEAL_HARM * Math.min(1, amount));
  st.respect = 0;
  st.lovedDays = 0;
  // Hurt out of the blue
  if (titleOf(f) === "Cherished" && amount >= STRAIN_HARM * 0.9) setTitle(f, "Wary");
  _tiCheck(f);
}

// StoryBook: harm memories
function noteTitleStory(kind, ids, opts = {}) {
  if (kind !== "harmed") return;
  const f = typeof fluffies !== "undefined" ? fluffies.find((x) => x.id === ids[0]) : null;
  if (!f) return;
  const seen = typeof MEMORY_TEXT !== "undefined" && (opts.x === MEMORY_TEXT.witness || opts.x === MEMORY_TEXT.witness_family);
  const training = typeof MEMORY_TEXT !== "undefined" && opts.x === MEMORY_TEXT.training;
  noteTitleHarm(f, seen ? STRAIN_SEEN : training ? STRAIN_TRAINING : STRAIN_HARM, seen ? "saw" : "hurt");
}

// Kindness (Care.js, Affection via giveAffection)
function noteTitleCare(f, kind) {
  if (!f || !f.adopted) return;
  const st = _tiState(f);
  const h = HEAL_CARE[kind] || 0.01;
  if (titleOf(f) === "Broken") st.healing = Math.min(1, (st.healing || 0) + h);
  if (titleOf(f) === "Rebel") st.respect = (st.respect || 0) + 1;
  f.strain = Math.max(0, (f.strain || 0) - 0.05);
  if (kind === "treat") st.lastTreat = _tiNow();
  if ((kind === "lesson" || kind === "scolded") && titleOf(f) === "Spoiled") st.firm = (st.firm || 0) + 1;
}

// Bonds.noteFluffyAttack: it stepped in to defend one it cares for
function noteTitleDefend(f) {
  if (!f || !f.adopted) return;
  const st = _tiState(f);
  st.defends = (st.defends || 0) + 1;
  if (st.defends >= GUARDIAN_DEFENDS && !titleOf(f)) setTitle(f, "Guardian");
}

// ---- Effects ----

// Fears.startFright
function titleFrightMultiplier(f) {
  const t = titleOf(f);
  return t === "Cherished" || t === "Guardian" ? 0.8 : t === "Survivor" ? 1.25 : 1;
}

// Memory.changePlayerTrust (gains only)
function titleTrustMultiplier(f) {
  const t = titleOf(f);
  return t === "Survivor" ? 1.2 : t === "Wary" ? 0.5 : t === "Broken" ? 0.7 : 1;
}

// Tricks/Lessons: a Rebel won't do as you say (a Spoiled one sometimes)
// ("rebel", "spoiled" or null)
function titleRefusesYou(f) {
  const t = titleOf(f);
  if (t === "Rebel") return "rebel";
  if (t === "Spoiled") {
    const st = _tiState(f);
    return !(typeof st.lastTreat === "number" && _tiNow() - st.lastTreat < HOUR_LENGTH) && Math.random() < 0.35 ? "spoiled" : null;
  }
  return null;
}

// HorseGenetics price
function titlePriceMultiplier(f) {
  const t = titleOf(f);
  return t === "Cherished" ? 1.1 : t === "Survivor" ? 1.05 : t === "Broken" ? 0.8 : t === "Spoiled" ? 0.95 : 1;
}

// Aging: Broken ones die sooner
function titleAgeExtraDays(f) {
  return titleOf(f) === "Broken" ? BROKEN_AGE_DAYS : 0;
}

// Identity.keeperNameFor
function keeperNameOverride(f) {
  return titleOf(f) === "Broken" ? "owna" : null;
}

// Gossip: a Rebel spreads defiance
function gossipTaleHook(f, tales) {
  if (titleOf(f) === "Rebel") return { harm: Math.max(tales.harm, 0.6), kind: 0 };
  return tales;
}

// Climate: a Cherished fluffy calms the room too
function titleCalmsRoom(f) {
  return titleOf(f) === "Cherished";
}

// ---- Checks ----

function _tiCheck(f) {
  const t = titleOf(f);
  const st = _tiState(f);
  const limit = breakLimitOf(f);
  const strain = f.strain || 0;
  // Breaking
  if (t !== "Broken") {
    if (t === "Rebel") {
      if (strain >= limit * REBEL_BREAK) return setTitle(f, "Broken");
    } else if (_strongWilled(f) && strain >= limit * REBEL_AT) {
      return setTitle(f, "Rebel");
    } else if (strain >= limit) {
      return setTitle(f, "Broken");
    }
  }
  return false;
}

// Once a game day (and on changes)
function _tiDaily(f) {
  const st = _tiState(f);
  const now = _tiNow();
  const harmedToday = now - (st.lastHarm ?? -1e9) < DAY_LENGTH;
  const t = titleOf(f);
  if (!harmedToday) {
    f.strain = Math.max(0, (f.strain || 0) - STRAIN_FADE * ((f.playerTrust || 0) >= 0.5 ? 1.5 : 1));
    if (t === "Broken") st.healing = Math.min(1, (st.healing || 0) + HEAL_DAY);
  }
  if ((f.playerTrust || 0) >= CHERISH_TRUST && !harmedToday) st.lovedDays = (st.lovedDays || 0) + 1;
  else if ((f.playerTrust || 0) < CHERISH_TRUST - 0.1) st.lovedDays = 0;
  // Spoiled: treats in the last few days, and no lessons or scoldings
  // (checked as a new day starts: the last few whole days)
  const tally = _tiRecentTally(f, SPOIL_DAYS + 1);
  // Spoiled demands: a day without a treat, it sulks
  if (t === "Spoiled" && !(tally.yesterday.treat > 0)) {
    f.changeHappiness(-0.05);
    f.expressionOverride = "ANGRY_PUFFED";
    f.expressionOverrideTimer = 2;
  }
  // Changes
  if (t === "Broken") {
    if (st.healing >= 1) {
      f.strain = Math.min(f.strain || 0, breakLimitOf(f) * 0.3);
      return setTitle(f, "Survivor", `${_tiName(f)} healed. Broken no more: a Survivor.`);
    }
    return false;
  }
  if (t === "Rebel") {
    if ((st.respect || 0) >= REBEL_RESPECT && now - (st.lastHarm ?? -1e9) >= 2 * DAY_LENGTH) return setTitle(f, "Guardian", `${_tiName(f)} was won round: a Rebel no more, a Guardian.`);
    return false;
  }
  if (t === "Wary") {
    if (now - (st.lastHarm ?? -1e9) >= WARY_DAYS * DAY_LENGTH) return setTitle(f, (f.playerTrust || 0) >= CHERISH_TRUST ? "Cherished" : null);
    return false;
  }
  if (t === "Spoiled") {
    if ((st.firm || 0) >= 4 && (tally.treat || 0) < SPOIL_TREATS / 2) return setTitle(f, (f.playerTrust || 0) >= CHERISH_TRUST ? "Cherished" : null, `${_tiName(f)} isn't spoiled any more: lessons and a firm hand did it.`);
    return false;
  }
  if (!t || t === "Survivor") {
    if ((tally.treat || 0) >= SPOIL_TREATS && !tally.lesson && !tally.scolded && !tally.drilled && !t) return setTitle(f, "Spoiled");
    if (st.lovedDays >= (t === "Survivor" ? CHERISH_DAYS + 3 : CHERISH_DAYS)) return setTitle(f, "Cherished");
    const scarredByYou = (f.scars || []).some((s) => !/fight/.test(s.how));
    if (!t && ((st.maxStrain || 0) >= breakLimitOf(f) * 0.5 || scarredByYou) && (f.playerTrust || 0) >= 0.5 && (f.strain || 0) < breakLimitOf(f) * 0.25)
      return setTitle(f, "Survivor", `${_tiName(f)} lived through it, and trusts you again: a Survivor.`);
  }
  return false;
}

// Treats, lessons etc. over the last few days (story tallies)
function _tiRecentTally(f, days) {
  const out = { yesterday: {} };
  if (typeof storyOf !== "function") return out;
  const day = Math.floor(_tiNow() / DAY_LENGTH);
  for (const e of storyOf(f)) {
    if (e.k !== "tally" || e.w[0] !== f.id || day - e.d >= days) continue;
    for (const [k, v] of Object.entries(e.c)) out[k] = (out[k] || 0) + v;
    if (e.d === day - 1) Object.assign(out.yesterday, e.c);
  }
  return out;
}

// Foals take after a titled mum or dad (once each)
function _tiUpbringing(f) {
  if (!(f.growth < 1) || !f.adopted) return;
  const st = _tiState(f);
  if (st.raised) return;
  const parents = fluffies.filter((o) => o.isAlive && (o.id === f.motherId || o.id === f.fatherId) && o.scene === f.scene);
  const rule = parents.some((p) => titleOf(p) === "Guardian") ? "raisedBrave" : parents.some((p) => titleOf(p) === "Broken") ? "raisedBroken" : parents.some((p) => titleOf(p) === "Cherished") ? "raisedLoved" : null;
  if (!rule) return;
  // most of a foalhood with them
  st.raisedTime = (st.raisedTime || 0) + 5;
  if (st.raisedTime < DAY_LENGTH * 1.5) return;
  st.raised = true;
  if (typeof shiftTrait === "function") shiftTrait(f, rule);
}

// Broken: numb
function _tiNumb(f) {
  if (titleOf(f) !== "Broken") return;
  if (f.happiness > BROKEN_CEIL) f.happiness = BROKEN_CEIL;
  if (f.happiness < BROKEN_FLOOR) f.happiness = BROKEN_FLOOR;
}

// Magnifying glass: [text, tone] and the change under way
function describeTitle(f) {
  const t = titleOf(f);
  if (!t) return null;
  return [TITLE_TEXT[t] || t, t === "Broken" || t === "Rebel" || t === "Wary" ? "bad" : t === "Spoiled" ? "ok" : "good"];
}

function describeTitleProgress(f) {
  const t = titleOf(f);
  if (!f || !f.adopted) return null;
  const st = _tiState(f);
  const words = (x) => (x < 0.25 ? "just begun" : x < 0.45 ? "about a third" : x < 0.6 ? "about halfway" : x < 0.85 ? "most of the way" : "nearly there");
  if (t === "Broken") return `Healing: Broken → Survivor (${words(st.healing || 0)})`;
  if (t === "Rebel") return `Winning it round: Rebel → Guardian (${words(Math.min(1, (st.respect || 0) / REBEL_RESPECT))})`;
  if (!t || t === "Survivor") {
    const need = t === "Survivor" ? CHERISH_DAYS + 3 : CHERISH_DAYS;
    if ((st.lovedDays || 0) > 0) return `${t || "Loved"} → Cherished (${words((st.lovedDays || 0) / need)})`;
    const limit = breakLimitOf(f);
    if ((f.strain || 0) >= limit * 0.5) return `Close to breaking (${words((f.strain || 0) / limit)})`;
  }
  return null;
}

const titlesTicker = new Ticker(5);
function updateTitles(dt) {
  const step = titlesTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const day = _tiDay();
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted) continue;
    _tiNumb(f);
    _tiUpbringing(f);
    const st = _tiState(f);
    if (st.day !== day) {
      st.day = day;
      _tiDaily(f);
    }
  }
}

registerSystem("titles", updateTitles, 19);
