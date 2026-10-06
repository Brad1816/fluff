// ---------------------------------------------------------------------------
// Herd feuds and wars, and the dead: sickness from rotting bodies, and the
// clever herds that carry them away.
//
// FEUDS (h.feuds = { otherHerdId: level }, saved with the herds): bad blood
// between two rival herds (Herds.js rivalHerds) builds up when one drives the
// other off its meadow (Territory.js _takeOver: FEUD_TAKEOVER), when their
// members fight (Bonds.noteFluffyAttack: FEUD_FIGHT) or kill (FEUD_KILL), and
// a little whenever they rub along side by side. It fades FEUD_FADE a day.
//
// WARS: two herds with a feud of WAR_AT or more, in the same place, can go
// to war (WAR_CHANCE a game hour, not within WAR_REST of the last one): for
// up to WAR_TIME their grown, fit members charge the nearest enemy and fight
// (performAttack), the fierce harder; the timid, the hurt (under
// WAR_RETREAT_HEALTH) and foals keep out of it. Fights feed the feud, so a
// war tends to come back. It ends early when a side is down to one fighter.
// The morning report and your messages (for your herds, or in the park news)
// say so.
//
// THE DEAD: a body rotting (Corpses.js corpseRot) makes fluffies near it ill
// (Illness.js flu; BODY_SICK a game hour at full rot, within BODY_SICK_NEAR).
// A herd with a clever head (its cleverest grown member's smarts, Intelligence.js,
// of BODY_SMARTS or more) sees to it: that one carries the body well away
// from the herd (to the far edge of the area) and leaves it there. In your
// house or yard there's nowhere to take it: it asks you to (once a body).
// Dimmer herds leave it lying - and catch what it carries.
// ---------------------------------------------------------------------------

const FEUD_TAKEOVER = 1.0;
const FEUD_FIGHT = 0.08;
const FEUD_KILL = 0.6;
const FEUD_RUB = 0.02; // a game hour, side by side
const FEUD_FADE = 0.15; // a game day
const WAR_AT = 1.0;
const WAR_CHANCE = 0.25; // a game hour
const WAR_TIME = 50; // game seconds (about a game hour)
const WAR_REST = 8; // game hours between wars of the same two
const WAR_RETREAT_HEALTH = 35;
const WAR_REACH = 60;
const BODY_SICK = 0.2; // a game hour, at full rot
const BODY_SICK_NEAR = 170;
const BODY_SMARTS = 0.2;
const BODY_CARE_NEAR = 520; // px from the herd's middle: their business
const herdWarTicker = new Ticker(1);
let herdWars = []; // [{ a, b, until, started }] - not saved (a war is short)

function _hwHerds() {
  return typeof herdState !== "undefined" && herdState && Array.isArray(herdState.list) ? herdState.list : [];
}
function _hwHerd(id) {
  return _hwHerds().find((h) => h.id === id) || null;
}

function feudLevel(a, b) {
  if (!a || !b || a === b) return 0;
  return Math.max((a.feuds && a.feuds[b.id]) || 0, (b.feuds && b.feuds[a.id]) || 0);
}

function noteHerdFeud(a, b, amount) {
  if (!a || !b || a === b || !(amount > 0)) return;
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    if (!x.feuds || typeof x.feuds !== "object") x.feuds = {};
    x.feuds[y.id] = Math.min(5, (x.feuds[y.id] || 0) + amount);
  }
}

// Bonds.noteFluffyAttack: a fight between herds feeds the feud
function noteHerdFight(attacker, victim) {
  if (typeof rivalHerds !== "function" || !rivalHerds(attacker, victim)) return;
  // (called before the blow lands: one that this will kill counts as a killing)
  noteHerdFeud(herdOf(attacker), herdOf(victim), victim.isAlive && victim.health > 10 ? FEUD_FIGHT : FEUD_KILL);
}

function warBetween(a, b) {
  return herdWars.find((w) => (w.a === a.id && w.b === b.id) || (w.a === b.id && w.b === a.id)) || null;
}

function atWar(f) {
  const h = typeof herdOf === "function" ? herdOf(f) : null;
  if (!h) return null;
  const w = herdWars.find((x) => x.a === h.id || x.b === h.id);
  return w ? _hwHerd(w.a === h.id ? w.b : w.a) : null;
}

function _hwFighters(h, scene) {
  return getHerdMembers(h).filter(
    (f) =>
      f.isAlive &&
      f.scene === scene &&
      f.growth >= 1 &&
      f.health >= WAR_RETREAT_HEALTH &&
      !f.isDragging &&
      !f.currentCage &&
      !f.placedOn &&
      !(f.isSensitive && f.isSensitive()) &&
      // (toughies always; the timid keep out while there are toughies: HerdJobs.js)
      (typeof herdWarFights === "function" ? herdWarFights(f, h, scene) : typeof traitValue !== "function" || traitValue(f, "bravery") > -0.5),
  );
}

function _hwSceneOf(h) {
  const m = getHerdMembers(h).filter((f) => f.isAlive);
  if (!m.length) return null;
  const counts = {};
  for (const f of m) counts[f.scene] = (counts[f.scene] || 0) + 1;
  return Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0];
}

function _hwTell(a, b, text) {
  const mine = [a, b].some((h) => getHerdMembers(h).some((f) => f.adopted));
  if (mine && typeof addUIMessage === "function") addUIMessage(text);
  else if (typeof _parkNews === "function") _parkNews(text);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text });
}

function startHerdWar(a, b) {
  if (warBetween(a, b)) return null;
  const w = { a: a.id, b: b.id, until: timePlayed + WAR_TIME, started: timePlayed };
  herdWars.push(w);
  a._lastWar = b._lastWar = timePlayed;
  _hwTell(a, b, `The ${getHerdName(a)} and the ${getHerdName(b)} are at war!`);
  for (const h of [a, b]) {
    const lead = getHerdLeader(h);
    if (lead && !lead.tooYoungToSpeak() && typeof getDialogue === "function") lead.speak(getDialogue(["HERD", "WAR"], lead), true);
  }
  return w;
}

function _endWar(w, why) {
  herdWars = herdWars.filter((x) => x !== w);
  const a = _hwHerd(w.a);
  const b = _hwHerd(w.b);
  for (const f of fluffies) if (f._war) f._war = null;
  if (a && b) _hwTell(a, b, why === "routed" ? `The war between the ${getHerdName(a)} and the ${getHerdName(b)} is over: one side has had enough.` : `The ${getHerdName(a)} and the ${getHerdName(b)} have stopped fighting - for now.`);
}

// Each fighter: run at the nearest enemy and hit it
function _hwFight(w, dt) {
  const a = _hwHerd(w.a);
  const b = _hwHerd(w.b);
  if (!a || !b) return _endWar(w, "gone");
  const scene = _hwSceneOf(a);
  if (!scene || scene !== _hwSceneOf(b)) return _endWar(w, "apart");
  const A = _hwFighters(a, scene);
  const B = _hwFighters(b, scene);
  if (A.length < 1 || B.length < 1 || timePlayed > w.until) return _endWar(w, A.length < 1 || B.length < 1 ? "routed" : "time");
  // (fighters look for someone to hit five times a second, not every frame)
  if (w._acc !== undefined && w._acc + dt < 0.2) {
    w._acc += dt;
    return;
  }
  w._acc = 0;
  for (const [mine, theirs] of [
    [A, B],
    [B, A],
  ]) {
    for (const f of mine) {
      let best = null;
      let bd = Infinity;
      for (const e of theirs) {
        const d = Math.hypot(e.x - f.x, e.y - f.y);
        if (d < bd && (typeof canFluffiesReachEachOther !== "function" || canFluffiesReachEachOther(f, e))) {
          bd = d;
          best = e;
        }
      }
      if (!best) continue;
      f._war = { id: best.id }; // (who it's after: the tests look)
      if (f.currentStateKey === "SLEEPING") f.initBehavior("IDLE");
      if (bd > WAR_REACH) {
        if (!f.isMovingOrRunning()) f.initBehavior("RUNNING");
        f.setTargetPosition(best.x + (best.x < f.x ? 35 : -35), best.y);
      } else if (f.attackCooldown <= 0) {
        f.facingRight = best.x > f.x;
        const temper = typeof traitValue === "function" ? traitValue(f, "temper") : 0;
        const bonus = typeof herdWarHitBonus === "function" ? herdWarHitBonus(f) : 0; // (a toughie hits harder)
        if (Math.random() < 0.5 + 0.3 * temper + bonus) f.performAttack(best, "WAR");
        f.attackCooldown = Math.max(f.attackCooldown || 0, 1.2 + Math.random());
      }
    }
  }
}

// ---- The dead ----

function _hwBodies(scene) {
  return fluffies.filter((f) => !f.isAlive && f.scene === scene && !f.isDestroyed && !f.isDragging && !f.placedOn && !f.currentCage);
}

// Rotting bodies make those near them ill
function _hwBodySickness(step) {
  if (typeof catchFlu !== "function" || typeof corpseRot !== "function") return;
  const hours = step / HOUR_LENGTH;
  const bodies = fluffies.filter((f) => !f.isAlive && !f.isDestroyed && corpseRot(f) > 0.15);
  for (const body of bodies) {
    const rot = corpseRot(body);
    for (const o of fluffies) {
      if (!o.isAlive || o.scene !== body.scene || o.currentCage !== body.currentCage) continue;
      if (Math.hypot(o.x - body.x, o.y - body.y) > BODY_SICK_NEAR) continue;
      if (typeof canCatchFlu === "function" && !canCatchFlu(o)) continue;
      const sickly = typeof hasDeformity === "function" && hasDeformity(o, "sickly") ? 2 : 1;
      if (Math.random() < 1 - Math.pow(1 - BODY_SICK * rot * sickly, hours)) {
        catchFlu(o);
        o._sickFromBody = body.id;
      }
    }
  }
}

// The cleverest grown member of a herd, if it's clever enough to deal with bodies
function _hwBodyMinder(h) {
  if (typeof smartsOf !== "function") return null;
  const m = getHerdMembers(h).filter((f) => f.isAlive && f.growth >= 1 && f.health >= 50 && !f.currentCage && !f.placedOn && !f.isDragging && !(f.isSensitive && f.isSensitive()));
  let best = null;
  for (const f of m) if (smartsOf(f) >= BODY_SMARTS && (!best || smartsOf(f) > smartsOf(best))) best = f;
  return best;
}

// Clever herds take bodies away from where they live
function _hwBodyCare() {
  for (const h of _hwHerds()) {
    const minder = _hwBodyMinder(h);
    if (!minder || minder._body) continue;
    const scene = minder.scene;
    const centre = typeof getHerdCentre === "function" ? getHerdCentre(h, scene) : { x: minder.x, y: minder.y };
    if (!centre) continue;
    const body = _hwBodies(scene)
      .filter((b) => !b._carriedBy && Math.hypot(b.x - centre.x, b.y - centre.y) < BODY_CARE_NEAR && (corpseRot(b) > 0 || (typeof bodyConfusesFoals === "function" && bodyConfusesFoals(b))))
      .sort((p, q) => Math.hypot(p.x - minder.x, p.y - minder.y) - Math.hypot(q.x - minder.x, q.y - minder.y))[0];
    if (!body) continue;
    // In your house or yard there's nowhere to take it (playtest: they
    // dragged foals' bodies to the wall and left them there): it asks you to
    // instead, once for each body
    if (getSceneConfig(scene).insidePlayerQuarters) {
      if (body._bodyTold) continue;
      body._bodyTold = true;
      if (!minder.tooYoungToSpeak()) minder.speak(getDialogue(["HERD", "BODY_TELL"], minder, body), true);
      if (minder.adopted && typeof addUIMessage === "function" && typeof fluffyDisplayName === "function") addUIMessage(`${fluffyDisplayName(minder)} wants you to take ${fluffyDisplayName(body)}'s body away.`);
      continue;
    }
    // Far edge of the area, away from the herd
    const W = typeof sceneW === "function" ? sceneW(scene) : width;
    const toX = centre.x < W / 2 ? W - 60 : 60;
    minder._body = { id: body.id, to: { x: toX, y: body.y }, at: timePlayed, got: false };
    body._carriedBy = minder.id;
    if (!minder.tooYoungToSpeak() && typeof getDialogue === "function") minder.speak(getDialogue(["HERD", "BODY"], minder), true);
  }
}

function _hwCarry(dt) {
  for (const f of fluffies) {
    const job = f._body;
    if (!job) continue;
    const body = fluffyById(job.id);
    const quit = () => {
      if (body) body._carriedBy = null;
      f._body = null;
    };
    if (!body || body.isAlive || body.isDragging || body.scene !== f.scene || !f.isAlive || f.isDragging || f.currentCage || timePlayed - job.at > 120) {
      quit();
      continue;
    }
    if (!job.got) {
      if (Math.hypot(body.x - f.x, body.y - f.y) > 45) {
        if (!f.isMovingOrRunning()) f.initBehavior("MOVING");
        f.setTargetPosition(body.x, body.y);
        continue;
      }
      job.got = true;
    }
    // Dragging it along behind
    body.x = f.x + (f.facingRight ? -35 : 35);
    body.y = f.y + 4;
    if (Math.hypot(job.to.x - f.x, job.to.y - f.y) > 30) {
      if (!f.isMovingOrRunning()) f.initBehavior("MOVING");
      f.setTargetPosition(job.to.x, job.to.y);
    } else {
      quit();
      body._movedAway = true;
      f.initBehavior("IDLE");
    }
  }
}

function updateHerdWars(dt) {
  if (typeof fluffies === "undefined" || typeof getHerdMembers !== "function") return;
  for (const w of [...herdWars]) _hwFight(w, dt);
  _hwCarry(dt);
  const step = herdWarTicker.step(dt);
  if (!step) return;
  const hours = step / HOUR_LENGTH;
  const herds = _hwHerds();
  // Feuds fade; rubbing along feeds them; wars break out
  for (const h of herds) {
    if (!h.feuds) continue;
    for (const id of Object.keys(h.feuds)) {
      h.feuds[id] = Math.max(0, h.feuds[id] - (FEUD_FADE * step) / DAY_LENGTH);
      if (!h.feuds[id] || !_hwHerd(Number(id))) delete h.feuds[id];
    }
  }
  for (let i = 0; i < herds.length; i++) {
    for (let j = i + 1; j < herds.length; j++) {
      const a = herds[i];
      const b = herds[j];
      const la = getHerdLeader(a);
      const lb = getHerdLeader(b);
      if (!la || !lb || !rivalHerds(la, lb)) continue;
      const scene = _hwSceneOf(a);
      if (!scene || scene !== _hwSceneOf(b)) continue;
      noteHerdFeud(a, b, FEUD_RUB * hours);
      if (feudLevel(a, b) < WAR_AT || warBetween(a, b)) continue;
      if ((a._lastWar && timePlayed - a._lastWar < WAR_REST * HOUR_LENGTH) || (b._lastWar && timePlayed - b._lastWar < WAR_REST * HOUR_LENGTH)) continue;
      if (_hwFighters(a, scene).length < 2 || _hwFighters(b, scene).length < 2) continue;
      if (Math.random() < 1 - Math.pow(1 - WAR_CHANCE, hours)) startHerdWar(a, b);
    }
  }
  _hwBodySickness(step);
  _hwBodyCare();
}
registerSystem("herdWars", updateHerdWars, 141);

// Magnifying glass: [text, tone] or null
function describeHerdFeud(f) {
  const h = typeof herdOf === "function" ? herdOf(f) : null;
  if (!h) return null;
  const enemy = atWar(f);
  if (enemy) return [`At war with the ${getHerdName(enemy)}`, "bad"];
  let worst = null;
  let lv = 0;
  for (const [id, v] of Object.entries(h.feuds || {})) {
    if (v > lv) {
      lv = v;
      worst = _hwHerd(Number(id));
    }
  }
  if (!worst || lv < 0.4) return null;
  return [`Its herd has a feud with the ${getHerdName(worst)}${lv >= WAR_AT ? " (could mean war)" : ""}`, "ok"];
}
