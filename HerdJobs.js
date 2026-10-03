// ---------------------------------------------------------------------------
// Herd jobs: every grown member of a herd (3 or more) gets a job from its
// traits. Worked out afresh every HERD_JOB_EVERY (not saved).
//
//   leader       the herd's leader
//   toughie      brave, grumpy, strong - earthies most of all (toughieScore).
//                About a third of the herd (at least one). Toughies:
//                  - do the fighting in a herd war: they always join in and
//                    hit harder, and while a herd has two or more of them
//                    its timid members keep out of it (HerdWars.js)
//                  - guard: they're the first sent after intruders on the
//                    herd's meadow (Territory.js), and they chase off
//                    anyone who hurts one of the herd's foals (always under
//                    a good smarty leader, half the time otherwise)
//                  - under a bad smarty leader, enforce: a member who
//                    resents him gets a shove ("Smawty say!") and is kept
//                    in line (it won't walk out on the herd for a while,
//                    KEPT_IN_LINE) - unhappier for it
//   food-finder  lively and friendly (finderScore). About a third. When
//                one's fed and someone in the herd needs it - a nursing
//                mum, a sick or hurt member - it fetches a bite (grass, or
//                a bowl's food) and brings it to them (FINDER_GIVES of
//                their hunger). Every FINDER_REST; twice as often under a
//                good smarty leader. A bad smarty leader takes it for
//                himself when he's peckish.
//   (none)       the rest: nursing mums, the sick and hurt, the sensitive
//                and anyone left over.
// Shown in the magnifying glass (Family, "Herd job") and on the
// relationship map (under its name).
// ---------------------------------------------------------------------------

const HERD_JOB_EVERY = 5; // game seconds
const HERD_JOB_SHARE = 1 / 3;
const FINDER_REST = 1.5 * HOUR_LENGTH;
const FINDER_GIVES = 0.35;
const FINDER_NEEDY = 0.5; // hunger under this: needs feeding
const FINDER_RANGE = 900; // px to food or the one in need
const TOUGHIE_DEFEND_CHANCE = 0.5;
const ENFORCE_RESENT = -0.3; // opinion of a bad leader under this: shoved into line
const ENFORCE_REST = 3 * HOUR_LENGTH; // per toughie
const KEPT_IN_LINE = DAY_LENGTH;
const herdJobTicker = new Ticker(HERD_JOB_EVERY);

const HERD_JOB_WORDS = {
  leader: ["Leader", "leads the herd"],
  toughie: ["Toughie", "guards the herd and does its fighting"],
  finder: ["Food-finder", "brings food to nursing mums and the sick"],
};

function _hjTrait(f, k) {
  return typeof traitValue === "function" ? traitValue(f, k) : 0;
}
function _hjName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Fluffy";
}

function toughieScore(f) {
  const breed = { earthy: 0.3, unicorn: 0, pegasus: -0.2, alicorn: 0.2 }[f.type] ?? 0;
  return _hjTrait(f, "bravery") + 0.5 * _hjTrait(f, "temper") + breed + 0.2 * ((f.health ?? 100) / 100) + (f.gender === "male" ? 0.1 : 0);
}

function finderScore(f) {
  return _hjTrait(f, "energy") + 0.4 * _hjTrait(f, "social");
}

// Nursing her foals, or sick or hurt: looked after, not working
function _hjCaredFor(f) {
  if (f.health < 50 || (typeof hasFlu === "function" && hasFlu(f))) return true;
  if (f.gender === "female" && typeof litterOf === "function" && litterOf(f).some((k) => k.growth < 0.6)) return true;
  return false;
}

function _hjCanWork(f) {
  return f.isAlive && f.growth >= 1 && !(f.isSensitive && f.isSensitive()) && !_hjCaredFor(f);
}

// Hand out the jobs in one herd
function assignHerdJobs(h) {
  const members = getHerdMembers(h);
  const lead = getHerdLeader(h);
  for (const m of members) m.herdJob = null;
  if (lead) lead.herdJob = "leader";
  if (members.length < HERD_MIN_SIZE) return;
  const pool = members.filter((m) => m !== lead && _hjCanWork(m));
  if (!pool.length) return;
  const n = Math.max(1, Math.round(pool.length * HERD_JOB_SHARE));
  const tough = pool
    .map((m) => [m, toughieScore(m)])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
  for (const [m] of tough) m.herdJob = "toughie";
  const rest = pool.filter((m) => !m.herdJob);
  const find = rest
    .map((m) => [m, finderScore(m)])
    .filter(([, s]) => s > -0.3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
  for (const [m] of find) m.herdJob = "finder";
}

function herdJobOf(f) {
  return (f && f.isAlive && herdOf(f) && f.herdJob) || null;
}

// The herd's toughies in a place
function herdToughies(h, scene) {
  return getHerdMembers(h).filter((m) => m.herdJob === "toughie" && m.scene === scene && m.isAlive);
}

// ---- Wars (HerdWars.js) ----

// Does it fight in this war? (the timid keep out while there are toughies)
function herdWarFights(f, h, scene) {
  if (f.herdJob === "toughie") return true;
  if (_hjTrait(f, "bravery") <= -0.5) return false;
  if (herdToughies(h, scene).length >= 2 && _hjTrait(f, "bravery") < 0.3) return false;
  return true;
}

// How likely a swing lands
function herdWarHitBonus(f) {
  return f.herdJob === "toughie" ? 0.25 : 0;
}

// Territory.js: toughies first after intruders
function defenderRank(f) {
  return f.herdJob === "toughie" ? 0 : 1;
}

// ---- Guarding the foals ----

// HorseSocial.performAttack: someone hurt one of the herd's foals - a toughie goes for them
function noteHerdFoalAttacked(attacker, foal, intent) {
  if (!attacker || !foal || foal.growth >= 1 || intent === "RETALIATION" || intent === "WAR") return;
  const h = herdOf(foal);
  if (!h || herdOf(attacker) === h) return;
  const lead = getHerdLeader(h);
  const good = typeof isGoodSmarty === "function" && lead && isGoodSmarty(lead);
  if (!good && Math.random() >= TOUGHIE_DEFEND_CHANCE) return;
  const t = herdToughies(h, foal.scene)
    .filter((m) => !m._herdTask && !m.isDragging && !m.currentCage && Math.hypot(m.x - foal.x, m.y - foal.y) < 600)
    .sort((a, b) => Math.hypot(a.x - foal.x, a.y - foal.y) - Math.hypot(b.x - foal.x, b.y - foal.y))[0];
  if (!t) return;
  t._herdTask = { kind: "defend", id: attacker.id, at: timePlayed };
  if (!t.tooYoungToSpeak()) t.speak(getDialogue(["HERD_JOB", "DEFEND"], t, attacker), true);
}

// ---- Enforcing (a bad smarty leader) ----

function keptInLine(f) {
  return !!f && typeof f._keptInLine === "number" && timePlayed >= f._keptInLine - KEPT_IN_LINE - 1 && timePlayed < f._keptInLine;
}

function _hjEnforce(h, lead) {
  if (!(lead.isSmarty && lead.isSmarty()) || typeof getOpinion !== "function") return;
  const now = timePlayed;
  for (const t of herdToughies(h, lead.scene)) {
    if (t._herdTask || (typeof t._enforcedAt === "number" && now >= t._enforcedAt && now - t._enforcedAt < ENFORCE_REST)) continue;
    const m = getHerdMembers(h).find(
      (x) => x !== t && x !== lead && x.scene === t.scene && x.growth >= 1 && !keptInLine(x) && getOpinion(x, lead) <= ENFORCE_RESENT && Math.hypot(x.x - t.x, x.y - t.y) < 700,
    );
    if (!m) continue;
    t._enforcedAt = now;
    t._herdTask = { kind: "enforce", id: m.id, at: now };
    if (!t.tooYoungToSpeak()) t.speak(getDialogue(["HERD_JOB", "ENFORCE"], t, m), true);
  }
}

function _hjEnforced(t, m) {
  if (typeof t.performAttack === "function") t.performAttack(m, "BULLY");
  m._keptInLine = timePlayed + KEPT_IN_LINE;
  m.changeHappiness(-0.05, "Kept in line by a toughie");
  if (!m.tooYoungToSpeak()) m.speak(getDialogue(["HERD_JOB", "ENFORCED"], m), true);
}

// ---- Food-finders ----

// Who in the herd needs food brought (the neediest first); a bad smarty
// leader first of all when he's peckish
function _hjNeedy(h, finder) {
  const lead = getHerdLeader(h);
  const here = (m) => m && m.isAlive && m !== finder && m.scene === finder.scene && Math.hypot(m.x - finder.x, m.y - finder.y) < FINDER_RANGE;
  if (lead && lead.isSmarty && lead.isSmarty() && here(lead) && lead.hunger < 0.7) return lead;
  return (
    getHerdMembers(h)
      .filter((m) => here(m) && m.growth >= 1 && _hjCaredFor(m) && m.hunger < FINDER_NEEDY && !m.currentCage)
      .sort((a, b) => a.hunger - b.hunger)[0] || null
  );
}

// The nearest bite of food: grass, or a bowl with food (not formula)
function _hjFood(f) {
  if (typeof objects === "undefined") return null;
  let best = null;
  let bd = FINDER_RANGE;
  for (const o of objects) {
    if (o.scene !== f.scene || o.isDestroyed || o.isDragging || o.currentCage !== f.currentCage) continue;
    const isGrass = typeof Grass !== "undefined" && o instanceof Grass;
    const isBowl = typeof Bowl !== "undefined" && o instanceof Bowl && o.foodType !== "formula";
    if (!(isGrass || isBowl) || !o.hasFood()) continue;
    const d = Math.hypot(o.x - f.x, o.y - f.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

function _hjFind(h, f) {
  const now = timePlayed;
  const lead = getHerdLeader(h);
  const rest = FINDER_REST * (typeof isGoodSmarty === "function" && lead && isGoodSmarty(lead) ? 0.5 : 1);
  if (f._herdTask || f.hunger < 0.5 || f.currentCage || f.currentStateKey === "SLEEPING") return;
  if (typeof f._foundAt === "number" && now >= f._foundAt && now - f._foundAt < rest) return;
  const needy = _hjNeedy(h, f);
  if (!needy) return;
  const food = _hjFood(f);
  if (!food) return;
  f._foundAt = now;
  f._herdTask = { kind: "fetch", food: food.id, id: needy.id, at: now };
}

// It took a bite to carry; now it brings it
function _hjGive(f, m) {
  m.hunger = Math.min(1, (m.hunger || 0) + FINDER_GIVES);
  m.changeHappiness(0.02, "A herd-mate brought food");
  if (typeof changeOpinion === "function") changeOpinion(m, f, 0.05, "brought me food");
  if (!f.tooYoungToSpeak()) f.speak(getDialogue(["HERD_JOB", m.isSmarty && m.isSmarty() && m === getHerdLeader(herdOf(f)) ? "FEED_LEADER" : "FEED"], f, m), true);
  if (typeof noteGoodDeed === "function") noteGoodDeed(f, "shared");
}

// ---- Every few seconds ----

function updateHerdJobs(dt) {
  if (!herdJobTicker.step(dt) || typeof herdState === "undefined" || !herdState || !Array.isArray(herdState.list)) return;
  for (const h of herdState.list) {
    assignHerdJobs(h);
    const lead = getHerdLeader(h);
    if (lead) _hjEnforce(h, lead);
    for (const f of getHerdMembers(h)) if (f.herdJob === "finder") _hjFind(h, f);
  }
  // Tasks that have run too long
  for (const f of fluffies) if (f._herdTask && (timePlayed - f._herdTask.at > 60 || timePlayed < f._herdTask.at || !f.isAlive)) f._herdTask = null;
}
registerSystem("herdJobs", updateHerdJobs, 133);

class HerdJobDesire extends Desire {
  constructor() {
    super("HerdJob");
  }
  _target(h) {
    const t = h._herdTask;
    if (!t || !h.isAlive || h.isDragging || h.placedOn || h.currentCage) return null;
    if (t.kind === "fetch") {
      const food = typeof objects !== "undefined" ? objects.find((o) => o.id === t.food) : null;
      if (!food || food.isDestroyed || food.scene !== h.scene || !food.hasFood()) return null;
      return food;
    }
    const f = fluffies.find((x) => x.id === t.id);
    if (!f || !f.isAlive || f.scene !== h.scene || f.isDragging) return null;
    return f;
  }
  evaluate(h) {
    if (!h._herdTask) return 0;
    if (!this._target(h)) {
      h._herdTask = null;
      return 0;
    }
    return h._herdTask.kind === "defend" ? 70 : 55;
  }
  execute(h) {
    const t = h._herdTask;
    const target = this._target(h);
    if (!t || !target) return false;
    const d = Math.hypot(target.x - h.x, target.y - h.y);
    const reach = t.kind === "fetch" ? 40 : 55;
    if (d > reach) {
      if (!h.isMovingOrRunning()) h.initBehavior(t.kind === "defend" || t.kind === "enforce" ? "RUNNING" : "MOVING");
      h.setTargetPosition(target.x, target.y);
      return true;
    }
    if (t.kind === "fetch") {
      if (target.eat()) {
        t.kind = "bring";
        t.at = timePlayed;
        if (!h.tooYoungToSpeak() && Math.random() < 0.5) h.speak(getDialogue(["HERD_JOB", "FETCH"], h), true);
      } else h._herdTask = null;
      return true;
    }
    h._herdTask = null;
    if (t.kind === "bring") _hjGive(h, target);
    else if (t.kind === "enforce") _hjEnforced(h, target);
    else if (t.kind === "defend" && h.attackCooldown <= 0 && typeof h.performAttack === "function") h.performAttack(target, "TERRITORY");
    return true;
  }
}

// Magnifying glass: [text, tone] or null
function describeHerdJob(f) {
  const j = herdJobOf(f);
  const kept = keptInLine(f) && !!herdOf(f);
  if ((!j || !HERD_JOB_WORDS[j]) && !kept) return null;
  const lead = getHerdLeader(herdOf(f));
  let text = j && HERD_JOB_WORDS[j] ? `${HERD_JOB_WORDS[j][0]}: ${HERD_JOB_WORDS[j][1]}` : "No job";
  if (j === "toughie" && lead && lead.isSmarty && lead.isSmarty()) text += " (and keeps the others in line for its smarty)";
  if (kept) return [`${text} - kept in line by a toughie`, "bad"];
  return [text, ""];
}

// Relationship map: a word under its name
function herdJobLabel(f) {
  const j = herdJobOf(f);
  return j && j !== "leader" ? HERD_JOB_WORDS[j][0] : null;
}
