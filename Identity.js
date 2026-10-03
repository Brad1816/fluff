// ---------------------------------------------------------------------------
// Identity (design doc Phase 1): turning points, what fluffies call you and
// each other, and pride in a name.
//
// TURNING POINTS (noteTurningPoint): big moments get a line in the story
// (kind "turning") and, for your fluffies, a one-line message - rare: one
// per fluffy per TURNING_GAP, and TURNING_MIN_GAP between any two. Watched
// every couple of seconds (updateIdentity, f.milestones, saved):
//   first wobbly steps, first words, all grown up (foals born with you),
//   walking up to you on its own (trust reaches TURNING_TRUST), flinching
//   from your hand (fear reaches TURNING_FEAR), going grey (senior).
// Also: getting a name (Names.js / the rename button), a first trick
// (Tricks.js), getting over a fear, losing its mum (HorseAnatomy.die).
//
// WHAT THEY CALL YOU (keeperNameFor, used by getDialogue for your own
// fluffies): "nice mistah" in their lines becomes, by your history:
//   loved (trust >= KEEPER_LOVED, fear low)  your keeper word: "daddeh" or
//                                            "mummah" (keeperWord, saved;
//                                            switch it on the Household
//                                            screen)
//   feared (fear >= KEEPER_FEARED)           "munstah"
//   unsure                                   "nice pewson"
// (Phase 4 adds "owna", said flatly, for Broken ones.) Strays and ferals
// still say "nice mistah". A bare "mistah" becomes the same word for loved
// and feared ones.
//
// WHAT THEY CALL EACH OTHER (fluffyCallsOther, getDialogue's <target>):
// a name always - a name is a fluffy's pride. Family words ("mummah",
// "babbeh"...) as before. A fluffy without a name gets a description from
// what stands out most: "owie" (scarred), "no-see" (blind), "hat", "wingy",
// "pointy", "wingy-pointy", "spotty", "stwipey", "widdwe", "owd", then its
// colour ("pinkie", "bwue"...). "-fwen" only for one it likes; a disliked
// one is "dat wingy one". A poopie-coloured one is "poopie fwuffy" to a
// colourist (only accepting fluffies say "fwen"); a feared alicorn is
// "munstah".
//
// NAME PRIDE: named fluffies now and then say their name proudly
// (NAME_PRIDE lines), and are a little happier when you do something kind
// for them (NAME_CALLED_BONUS, once a game hour: you call them by it).
// Unnamed ones sometimes wish they had one.
// ---------------------------------------------------------------------------

const TURNING_GAP = 1 * HOUR_LENGTH; // per fluffy
const TURNING_MIN_GAP = 20; // game seconds between any two messages
const TURNING_TRUST = 0.6;
const TURNING_FEAR = 0.5;
const KEEPER_LOVED = 0.65;
const KEEPER_FEARED = 0.5;
const NAME_CALLED_BONUS = 0.02;
const NAME_PRIDE_CHANCE = 0.04; // per named fluffy per check (every 30s)

let keeperWord = "daddeh"; // or "mummah" (saved: SAVED_GAME_STATE)
let _lastTurningMsgAt = -Infinity;
const identityTicker = new Ticker(2);
const namePrideTicker = new Ticker(30);

function _idHe(f) {
  return pronouns(f); // (globals.js)
}

// A big moment: into the story, and (rarely) a message. opts.record=false
// when the story already has its own event for it.
function noteTurningPoint(f, text, opts = {}) {
  if (!f || !text) return false;
  if (opts.record !== false && typeof recordStory === "function") recordStory("turning", f, { x: text });
  if (!f.adopted || opts.pop === false) return true;
  const now = timePlayed;
  if (now - _lastTurningMsgAt < TURNING_MIN_GAP) return true;
  if (f.lastTurningAt !== undefined && now - f.lastTurningAt < TURNING_GAP) return true;
  f.lastTurningAt = now;
  _lastTurningMsgAt = now;
  if (typeof addUIMessage === "function") addUIMessage(`✦ ${text}`);
  return true;
}

function _milestonesNow(f) {
  return {
    walk: !f.tooYoungToWalk(),
    talk: !f.tooYoungToSpeak(),
    grown: f.growth >= 1,
    trusted: (f.playerTrust || 0) >= TURNING_TRUST,
    feared: (f.playerFear || 0) >= TURNING_FEAR,
    grey: typeof lifeStage === "function" && ["senior", "elderly"].includes(lifeStage(f)),
  };
}

function checkMilestones(f) {
  const now = _milestonesNow(f);
  if (!f.milestones || typeof f.milestones !== "object") {
    // First look: whatever's already true isn't news
    f.milestones = now;
    return [];
  }
  const m = f.milestones;
  const n = fluffyDisplayName(f);
  const p = _idHe(f);
  const news = [];
  if (now.walk && !m.walk) news.push(`${n} took ${p.poss} first wobbly steps.`);
  if (now.talk && !m.talk) news.push(`${n} said ${p.poss} first words.`);
  if (now.grown && !m.grown) news.push(`${n} is all grown up.`);
  if (now.trusted && !m.trusted) news.push(`${n} walked up to you on ${p.poss} own for the first time.`);
  if (now.feared && !m.feared) news.push(`${n} flinched from your hand for the first time.`);
  if (now.grey && !m.grey) news.push(`${n}'s coat is starting to go grey.`);
  // Milestones only happen once (trust can dip and come back)
  for (const k of Object.keys(now)) if (now[k]) m[k] = true;
  for (const text of news) noteTurningPoint(f, text);
  return news;
}

// ---- What they call you ----

function keeperNameFor(f) {
  if (!f || !f.adopted) return null;
  if (typeof keeperNameOverride === "function") {
    const o = keeperNameOverride(f); // (Phase 4: "owna" for Broken ones)
    if (o) return o;
  }
  const fear = f.playerFear || 0;
  const trust = f.playerTrust || 0;
  if (fear >= KEEPER_FEARED && fear >= trust * 0.8) return "munstah";
  if (trust >= KEEPER_LOVED && fear < 0.3) return keeperWord === "mummah" ? "mummah" : "daddeh";
  return "nice pewson";
}

function _idMatchCase(word, like) {
  if (like === like.toUpperCase() && like !== like.toLowerCase()) return word.toUpperCase();
  if (like[0] === like[0].toUpperCase()) return word.charAt(0).toUpperCase() + word.slice(1);
  return word;
}

// getDialogue: a line from one of your fluffies, with "mistah" swapped
function applyKeeperName(text, speaker) {
  const name = keeperNameFor(speaker);
  if (!name || typeof text !== "string" || !/mistah/i.test(text)) return text;
  // "nice mistah" -> the whole name
  text = text.replace(/nice mistah(?! fence)/gi, (m) => _idMatchCase(name, m));
  // a bare "mistah": only when it's a word they'd use for you
  const bare = name === "nice pewson" ? null : name;
  if (bare) text = text.replace(/\bmistah\b(?! fence)/gi, (m) => _idMatchCase(bare, m));
  return text;
}

function toggleKeeperWord() {
  keeperWord = keeperWord === "mummah" ? "daddeh" : "mummah";
  return keeperWord;
}

// ---- What they call each other ----

const _ID_COLOUR_WORD = {
  pink: "pinkie", wed: "wed", owange: "owange", yewwow: "yewwow", gween: "gween", bwue: "bwue",
  puwpuw: "puwpuw", bwown: "bwown", bwack: "bwack", wite: "wite", gway: "gway",
};

function _idDescriptor(target) {
  // (Phase 3's scars count here too)
  if ((typeof target.getMissingBodyParts === "function" && target.getMissingBodyParts().length) || (Array.isArray(target.scars) && target.scars.length)) return "owie";
  if (typeof target.canSee === "function" && !(target.limbs && (target.limbs.leftEye || target.limbs.rightEye))) return "no-see";
  if (target.accessories && target.accessories.head) return "hat";
  const type = typeof target.typeVisibleToOthers === "function" ? target.typeVisibleToOthers() : target.type;
  if (type === "alicorn") return "wingy-pointy";
  if (type === "pegasus") return "wingy";
  if (type === "unicorn") return "pointy";
  if (target.hasSpots) return "spotty";
  if (target.hasStripes) return "stwipey";
  if (target.growth < 1) return "widdwe";
  if (typeof lifeStage === "function" && lifeStage(target) === "elderly") return "owd";
  const colour = typeof target.getColorName === "function" ? target.getColorName() : null;
  return _ID_COLOUR_WORD[colour] || "odda";
}

// How speaker talks about target (lower case); null = use the usual
function fluffyCallsOther(speaker, target) {
  if (!speaker || !target) return null;
  if (typeof fluffyNames !== "undefined" && fluffyNames[target.id]) return null; // its name, always
  // A feared alicorn
  if (
    typeof worldSettings !== "undefined" &&
    worldSettings.alicornIntolerance &&
    typeof target.typeVisibleToOthers === "function" &&
    target.typeVisibleToOthers() === "alicorn" &&
    typeof speaker.tolerantOfAlicorns === "function" &&
    !speaker.tolerantOfAlicorns()
  )
    return "munstah";
  // Poopie coats: "fwen" only from those who accept them
  const p = target.genetics ? target.genetics.calculateColorismPerception() : 1;
  const colourist = typeof worldSettings === "undefined" || worldSettings.colorism;
  if (colourist && p < COAT_POOPIE_LINE && (speaker.coloristDegree || 0) > 0.2) return "poopie fwuffy";
  const desc = _idDescriptor(target);
  const liking = typeof getLiking === "function" ? getLiking(speaker, target) : 0;
  if (liking >= 0.2) return `${desc}-fwen`;
  if (liking <= -0.3) return `dat ${desc} one`;
  return `${desc} fwuffy`;
}

// ---- Pride in a name ----

function onKindnessToNamed(f) {
  if (!f || typeof fluffyNames === "undefined" || !fluffyNames[f.id]) return;
  const now = timePlayed;
  if (f.nameCalledAt !== undefined && now - f.nameCalledAt < HOUR_LENGTH) return;
  f.nameCalledAt = now;
  f.changeHappiness(NAME_CALLED_BONUS);
}

function _idCanChat(f) {
  return (
    f.isAlive &&
    f.adopted &&
    !f.tooYoungToSpeak() &&
    f.currentStateKey !== "SLEEPING" &&
    !(f.speech && f.speech.timer > 0) &&
    f.happiness > 0.45
  );
}

function updateNamePride() {
  if (typeof fluffies === "undefined") return;
  for (const f of fluffies) {
    if (f.scene !== currentScene || !_idCanChat(f) || Math.random() > NAME_PRIDE_CHANCE) continue;
    const named = typeof fluffyNames !== "undefined" && fluffyNames[f.id];
    f.speak(getDialogue(named ? ["NAME_PRIDE"] : ["NAME_WISH"], f));
    break; // one at a time
  }
}

// ---- Every couple of seconds ----

function updateIdentity(dt) {
  if (namePrideTicker.step(dt)) updateNamePride();
  if (!identityTicker.step(dt)) return;
  if (typeof fluffies === "undefined") return;
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted) continue;
    checkMilestones(f);
  }
}

registerSystem("identity", updateIdentity, 16);
