// ---------------------------------------------------------------------------
// Bad smarties desert (lore): a bad smarty (Intelligence.js - a smarty that
// isn't a good one) looks after itself first. When things go wrong for its
// herd it runs and leaves the rest behind - leader or not:
//   - a fox comes (NightEvents.js): it never stands up to it, and often
//     takes the chance to be off (DESERT_FOX)
//   - its herd is losing a war: fewer of them still fighting than the
//     enemy, or it's been hurt (DESERT_WAR, each check)
//   - the herd is starving (wild herds: members' hunger on average under
//     DESERT_HUNGRY) or half of it has the flu (DESERT_HARD, each check)
// Deserting (desertHerd): it leaves without a word to them, runs off, won't
// come back for DESERT_REJOIN_WAIT seconds, and its herd-mates think much
// less of it (DESERT_OPINION). If it led, the herd picks a new leader
// (Herds.js updateHerds). In its story (StoryBook.js "deserted").
// ---------------------------------------------------------------------------

const DESERT_EVERY = 3; // seconds
const DESERT_FOX = 0.5;
const DESERT_WAR = 0.25;
const DESERT_HARD = 0.02;
const DESERT_HUNGRY = 0.2;
const DESERT_WAR_HURT = 50; // health
const DESERT_OPINION = -0.5;
const DESERT_REJOIN_WAIT = 1800;
const desertionTicker = new Ticker(DESERT_EVERY);

function isBadSmarty(f) {
  return !!f && f.isAlive && f.growth >= 1 && typeof f.isSmarty === "function" && f.isSmarty();
}

// NightEvents.js _alarm: a bad smarty never stands up to a fox (it's
// already running from it when this is asked)
function badSmartyFleesFox(f) {
  if (!isBadSmarty(f)) return false;
  const h = typeof herdOf === "function" ? herdOf(f) : null;
  if (h && Math.random() < DESERT_FOX) desertHerd(f, h, "fox");
  return true;
}

// Why it would go right now, or null
function desertReason(f, h) {
  if (!isBadSmarty(f) || !h) return null;
  // Losing a war
  if (typeof atWar === "function" && typeof _hwFighters === "function") {
    const enemy = atWar(f);
    if (enemy) {
      const mine = _hwFighters(h, f.scene).length;
      const theirs = _hwFighters(enemy, f.scene).length;
      if ((theirs > 0 && mine < theirs) || (f.health ?? 100) < DESERT_WAR_HURT) return "war";
    }
  }
  const members = getHerdMembers(h).filter((m) => m !== f && m.isAlive);
  if (!members.length) return null;
  // Starving (a wild herd: yours are your job)
  if (!herdIsYours(h)) {
    const hunger = members.reduce((s, m) => s + (m.hunger ?? 1), 0) / members.length;
    if (hunger < DESERT_HUNGRY) return "hungry";
  }
  // Sick
  if (typeof hasFlu === "function" && members.filter(hasFlu).length * 2 >= members.length && !hasFlu(f)) return "sick";
  return null;
}

function desertHerd(f, h, why) {
  if (!f || !h || !h.memberIds.includes(f.id)) return false;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  const wasLeader = h.leaderId === f.id;
  const left = getHerdMembers(h).filter((m) => m !== f && m.isAlive);
  _leave(h, f, true);
  f._leftHerd = { id: h.id, until: now + DESERT_REJOIN_WAIT };
  f._deserted = { id: h.id, at: now, why };
  if (f._war) f._war = null;
  if (f.currentStateKey !== "SLEEPING") {
    f.speech.nextTime = 0;
    sayIfAwake(f, ["DESERT", "GO", why.toUpperCase()], null, true);
  }
  // Off it goes, away from them (from a fox it's already running)
  const c = why !== "fox" && typeof getHerdCentre === "function" ? getHerdCentre(h, f.scene) : null;
  if (c && !f.currentCage && !f.placedOn && !f.isDragging && typeof f.getRunawayTarget === "function") {
    const t = f.getRunawayTarget(c.x, c.y);
    if (t) {
      f.initBehavior("RUNNING");
      f.setTargetPosition(t.x, t.y);
    }
  }
  // What the rest think of that
  let said = false;
  for (const m of left) {
    if (m.growth < 1 || !(typeof m.canSee !== "function" || m.canSee())) continue;
    if (typeof changeOpinion === "function") changeOpinion(m, f, DESERT_OPINION, "ran off and left the herd");
    if (!said && m.scene === f.scene && m.currentStateKey !== "SLEEPING" && Math.random() < 0.7) {
      said = true;
      sayIfAwake(m, ["DESERT", wasLeader ? "LEFT_BY_LEADER" : "LEFT_BY"], f, true);
    }
  }
  if (typeof recordStory === "function") recordStory("deserted", [f.id, ...left.map((m) => m.id)], { x: getHerdName(h) });
  const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A smarty";
  const what = { fox: "when the fox came", war: "in the middle of a war", hungry: "when food ran short", sick: "when the flu came" }[why] || "";
  _tellPlayer(h, `${name} ${wasLeader ? "led" : "was in"} the ${getHerdName(h)} - and ran off and left them ${what}.`.replace(/ \.$/, "."));
  return true;
}

function updateDesertion(dt) {
  if (!desertionTicker.step(dt) || typeof _herdList !== "function") return;
  for (const h of [..._herdList()]) {
    for (const f of getHerdMembers(h)) {
      const why = desertReason(f, h);
      if (!why) continue;
      if (Math.random() < (why === "war" ? DESERT_WAR : DESERT_HARD)) desertHerd(f, h, why);
      break; // (one at a time)
    }
  }
}
registerSystem("desertion", updateDesertion, 71);
