// ---------------------------------------------------------------------------
// Intelligence ("smarts"), and good and bad smarties.
//
// smartsOf(f), -1 (very dim) .. +1 (brilliant), is made of:
//   - its breed (BREED_SMARTS): alicorns are the cleverest, then unicorns;
//     earthies are average and pegasi the dimmest
//   - its own wits: an inherited trait (Traits.js "wits": Clever / Dim)
//   - being a smarty (SMARTY_SMARTS): smarties are a little brighter than
//     most - a good smarty more so. A smarty is only as clever as its breed
//     lets it be: a pegasus smarty is still no genius.
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

const BREED_SMARTS = { alicorn: 0.45, unicorn: 0.15, earthy: 0, pegasus: -0.25 };
const SMARTY_SMARTS = { bad: 0.25, good: 0.45 };
const WITS_WEIGHT = 0.35;
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

function smartsOf(f) {
  if (!f) return 0;
  let s = BREED_SMARTS[_breedOf(f)] ?? 0;
  if (typeof traitValue === "function") s += WITS_WEIGHT * traitValue(f, "wits");
  if (typeof hasDeformity === "function" && hasDeformity(f, "dim")) s -= 0.35; // simple-minded (Inbreeding.js)
  if (isGoodSmarty(f)) s += SMARTY_SMARTS.good;
  else if (f.isSmarty && f.isSmarty()) s += SMARTY_SMARTS.bad;
  return Math.max(-1, Math.min(1, s));
}

// How fast it learns from you: x0.45 (very dim) .. x1.55 (brilliant)
function smartsLearn(f) {
  return Math.max(0.45, Math.min(1.55, 1 + 0.5 * smartsOf(f)));
}

function smartsWord(v) {
  if (v >= 0.6) return "Brilliant";
  if (v >= 0.25) return "Bright";
  if (v > -0.15) return "Average";
  if (v > -0.45) return "Slow";
  return "Very dim";
}

// Magnifying glass: [text, tone]
function describeSmarts(f) {
  const v = smartsOf(f);
  const why = [];
  const breed = _breedOf(f);
  if (breed === "alicorn") why.push("alicorns are clever");
  else if (breed === "unicorn") why.push("unicorns are bright");
  else if (breed === "pegasus") why.push("pegasi are dim");
  if (isGoodSmarty(f)) why.push("a good smarty");
  else if (f.isSmarty && f.isSmarty()) why.push("a smarty");
  const pct = Math.round((smartsLearn(f) - 1) * 100);
  const learn = pct === 0 ? "learns at a normal pace" : `learns ${Math.abs(pct)}% ${pct > 0 ? "faster" : "slower"}`;
  return [`${smartsWord(v)}${why.length ? ` (${why.join(", ")})` : ""}: ${learn}`, v >= 0.25 ? "good" : v <= -0.45 ? "bad" : ""];
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
