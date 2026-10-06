// ---------------------------------------------------------------------------
// Intelligence ("smarts"), and good and bad smarties.
//
// smartsOf(f), -1 (very dim) .. +1 (brilliant) - shown as 0-100
// (smartsScore: 50 + 50 x smartsOf) - is made of:
//   - its breed (BREED_SMARTS): on average earthies 50, pegasi 35,
//     unicorns 60, alicorns 90 - each one a little either side of that
//     (BREED_SMARTS_SPREAD)
//   - its own wits: an inherited trait (Traits.js "wits": Clever / Dim),
//     up to WITS_WEIGHT either way (+-25 points)
//   - being a smarty (SMARTY_SMARTS): smarties are a little brighter than
//     the rest of their breed - a good smarty more so. A pegasus smarty is
//     still no genius.
//   - simple-minded (an inbred deformity, Inbreeding.js): -20
// It changes how fast it learns from you (smartsLearn): tricks, lessons,
// strict training, litter training, and what a telling-off teaches it.
//
// Smarties (stallions only, Horse.js) are bad or good (f.smartyKind, saved;
// rolled when one is born or found - rollSmartyKind, GOOD_SMARTY_CHANCE -
// so bad ones far outnumber good ones; a cleverer breed has more good ones).
//   Bad smarty (f.isSmarty()): everything smarties have always done - a
//     bully, quick to fight, too good for tricks or the litterbox - and it
//     NEVER tolerates a poopie coat (not even family: it shuns, shoves and
//     fights them, whatever the room's colourism). As a herd leader it leads
//     its herd to ruin: bossy and harsh, its herd grows unhappy, falls out
//     with it and with each other, and breaks apart.
//   Good smarty (isGoodSmarty): cleverer still, and kind. It acts like any
//     good fluffy, makes a cautious, careful leader (others want it to lead),
//     and its herd is calmer - fewer frights - and happier.
// ---------------------------------------------------------------------------

const BREED_SMARTS = { alicorn: 0.8, unicorn: 0.2, earthy: 0, pegasus: -0.3 }; // (90, 60, 50, 35 out of 100)
const SMARTY_SMARTS = { bad: 0.16, good: 0.3 }; // (+8, +15)
const WITS_WEIGHT = 0.5; // (+-25)
const DIM_SMARTS = 0.4; // simple-minded (-20)
const GOOD_SMARTY_CHANCE = { alicorn: 0.25, unicorn: 0.12, earthy: 0.1, pegasus: 0.06 };
const BAD_LEADER_GLOOM = 0.012; // happiness a game hour, each member
const BAD_LEADER_RESENT = 0.03; // opinion of the leader a game hour
const BAD_LEADER_STRIFE = 0.01; // opinion of each other a game hour
const GOOD_LEADER_CHEER = 0.006; // happiness a game hour
const GOOD_LEADER_CALM = 0.35; // of frights that never happen with it nearby
const GOOD_LEADER_NEAR = 300; // px
const smartsTicker = new Ticker(3);

function _breedOf(f) {
  return (f && (f.type || (f.genetics && f.genetics.type))) || "earthy";
}

function isGoodSmarty(f) {
  if (!f || !Array.isArray(f.personalities) || !f.personalities.includes("smarty")) return false;
  if (typeof worldSettings !== "undefined" && worldSettings.smarties === false) return false;
  return f.smartyKind === "good";
}

// A new smarty (born, spawned, found): good or bad?
function rollSmartyKind(f) {
  if (!f || !Array.isArray(f.personalities) || !f.personalities.includes("smarty")) return;
  const chance = GOOD_SMARTY_CHANCE[_breedOf(f)] ?? 0.1;
  f.smartyKind = Math.random() < chance ? "good" : "bad";
}

// Each one's own little difference within its breed (playtest: smarts came
// out in steps of 10): +- this much, fixed for that fluffy (from its id, so
// nothing to save)
const BREED_SMARTS_SPREAD = { alicorn: 0.12, unicorn: 0.2, earthy: 0.24, pegasus: 0.2 }; // (+-6, 10, 12, 10 points)
function _smartsJitter(f) {
  let h = (Number(f.id) || 0) * 2654435761;
  h = ((h ^ (h >>> 15)) * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h / 4294967295) * 2 - 1; // -1..1
}

function smartsOf(f) {
  if (!f) return 0;
  let s = BREED_SMARTS[_breedOf(f)] ?? 0;
  s += (BREED_SMARTS_SPREAD[_breedOf(f)] ?? 0.2) * _smartsJitter(f);
  if (typeof traitValue === "function") s += WITS_WEIGHT * traitValue(f, "wits");
  if (typeof hasDeformity === "function" && hasDeformity(f, "dim")) s -= DIM_SMARTS; // simple-minded (Inbreeding.js)
  if (isGoodSmarty(f)) s += SMARTY_SMARTS.good;
  else if (f.isSmarty && f.isSmarty()) s += SMARTY_SMARTS.bad;
  return Math.max(-1, Math.min(1, s));
}

// How fast it learns from you: x0.45 (very dim) .. x1.55 (brilliant)
function smartsLearn(f) {
  return Math.max(0.45, Math.min(1.55, 1 + 0.5 * smartsOf(f)));
}

// 0-100 (50 an average earthy)
function smartsScore(f) {
  return Math.round(50 + 50 * smartsOf(f));
}

// Magnifying glass: [text, tone]
function describeSmarts(f) {
  const n = smartsScore(f);
  const pct = Math.round((smartsLearn(f) - 1) * 100);
  const learn = pct === 0 ? "learns at a normal pace" : `learns ${Math.abs(pct)}% ${pct > 0 ? "faster" : "slower"}`;
  return [`${n}/100: ${learn}`, n >= 65 ? "good" : n <= 25 ? "bad" : ""];
}

// A poopie (brown) coat - what a bad smarty can't stand
function isPoopieCoated(f) {
  if (typeof worldSettings !== "undefined" && worldSettings.colorism === false) return false;
  if (!f || !f.genetics || typeof f.genetics.calculateColorismPerception !== "function") return false;
  return f.genetics.calculateColorismPerception() < COAT_POOPIE_LINE;
}

// ---- Leaders ----

function _herdLeaderOf(f) {
  const h = typeof herdOf === "function" ? herdOf(f) : null;
  if (!h || typeof getHerdLeader !== "function") return null;
  const lead = getHerdLeader(h);
  return lead && lead.isAlive ? lead : null;
}

// Fears.js: a good smarty leading its herd nearby keeps a level head - some
// frights never happen
function goodLeaderCalms(f) {
  const lead = _herdLeaderOf(f);
  if (!lead || lead === f || !isGoodSmarty(lead) || lead.scene !== f.scene) return false;
  if (Math.hypot(lead.x - f.x, lead.y - f.y) > GOOD_LEADER_NEAR) return false;
  return Math.random() < GOOD_LEADER_CALM;
}

function updateSmartLeaders(dt) {
  const step = smartsTicker.step(dt);
  if (!step || typeof herdState === "undefined" || !herdState || !Array.isArray(herdState.list)) return;
  const hours = step / HOUR_LENGTH;
  for (const h of herdState.list) {
    const lead = typeof getHerdLeader === "function" ? getHerdLeader(h) : null;
    if (!lead || !lead.isAlive) continue;
    const members = getHerdMembers(h).filter((m) => m !== lead && m.isAlive);
    if (!members.length) continue;
    if (lead.isSmarty && lead.isSmarty()) {
      // Leading them to ruin: bossy and harsh
      for (const m of members) {
        if (m.happiness > WAN_DIE_THRESHOLD + 0.15) m.changeHappiness(-BAD_LEADER_GLOOM * hours, "Bossy leader");
        if (typeof changeOpinion === "function") {
          changeOpinion(m, lead, -BAD_LEADER_RESENT * hours, "bossy leader");
          const other = members[Math.floor(Math.random() * members.length)];
          if (other && other !== m) changeOpinion(m, other, -BAD_LEADER_STRIFE * hours, "squabbles");
        }
      }
    } else if (isGoodSmarty(lead)) {
      for (const m of members) {
        if (m.happiness < 0.9) m.changeHappiness(GOOD_LEADER_CHEER * hours, "A good leader");
        if (typeof changeOpinion === "function") changeOpinion(m, lead, 0.01 * hours, "a good leader");
      }
    }
  }
}
registerSystem("smartLeaders", updateSmartLeaders, 131);
