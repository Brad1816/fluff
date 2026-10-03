// ---------------------------------------------------------------------------
// Whole-herd raids on your backyard.
//
// When: from day RAID_FROM_DAY, at most once every RAID_GAP days, and only
// while something of yours is left out in the backyard to draw them: food
// in a bowl, a stuffy, a bed, a toy (lureItemsIn, Lures.js). The more is
// out, the likelier (YARD_RAID_CHANCE a game hour, x the lures, up to 3). The
// best fence (tier 2, with its gate) keeps them out.
// Who: a wild herd (not the park's: those keep to their meadows), led by a
// bad smarty if there is one; if no wild herd will do, a hungry one turns
// up from the street (RAID_NEW_SIZE, with a bad smarty at its head).
// What: they come in through the gate, hungry, and eat whatever's there -
// bowls, grass. Your grown fluffies in the backyard fight back (toughies
// first and hardest; the timid keep out while there are toughies,
// HerdJobs.js), and so do the raiders. If nobody stands up to them for
// RAID_CLAIM they claim the backyard: they shove your fluffies about while
// they stay. A raid ends when one side has no fighters left, after
// YARD_RAID_MAX, or when you chase them off: in the backyard, the "Chase off"
// chip at the top (click or tap). They leave through the gate for the river,
// and their herd bears yours a grudge (HerdWars.js feud).
// You're told when one starts (wherever you are), and the morning report
// says how it went. Saved: raidState = { active, lastAt }.
// ---------------------------------------------------------------------------

const RAID_FROM_DAY = 3;
const RAID_GAP = 2 * DAY_LENGTH;
const YARD_RAID_CHANCE = 0.015; // a game hour, for each lure (up to 3)
const RAID_CLAIM = 2 * HOUR_LENGTH;
const YARD_RAID_MAX = 6 * HOUR_LENGTH;
const RAID_NEW_SIZE = [4, 7];
const RAID_LEAVE_TIME = 10; // game seconds to reach the gate before they're gone
const RAID_FEUD = 0.8;
const RAID_SHOVE_EVERY = 6; // game seconds, a claimed backyard
const RAID_FIGHT_HEALTH = 35;
const raidTicker = new Ticker(1);

function freshRaidState() {
  return { active: null, lastAt: null };
}
let raidState = freshRaidState();
let _raidLeaving = []; // [{ id, until }] on their way out (not saved)

if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({
    name: "raidState",
    get: () => raidState,
    set: (v) => (raidState = v && typeof v === "object" ? v : freshRaidState()),
    fresh: () => freshRaidState(),
  });
}

function _rdHerd() {
  const a = raidState.active;
  return a && typeof herdState !== "undefined" ? (herdState.list || []).find((h) => h.id === a.herdId) || null : null;
}

// Who came in (kept on the raid, so a raider who falls out with the herd -
// or a herd that breaks up mid-raid - still leaves when it ends)
function _rdIds() {
  const a = raidState.active;
  if (!a) return [];
  if (Array.isArray(a.ids)) return a.ids;
  const h = _rdHerd(); // (raids from before the ids were kept)
  return h ? getHerdMembers(h).map((f) => f.id) : [];
}
function _rdIsRaider(f) {
  return !!f && _rdIds().includes(f.id);
}

// The raiders still in the backyard
function raiders() {
  const ids = _rdIds();
  if (!ids.length) return [];
  return fluffies.filter((f) => ids.includes(f.id) && f.isAlive && f.scene === "BACKYARD" && !_raidLeaving.some((l) => l.id === f.id));
}

function raidActive() {
  return !!raidState.active;
}

function _rdGate() {
  return { x: width / 2, y: height - 40 };
}

function _rdTell(text) {
  if (typeof addUIMessage === "function") addUIMessage(text);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text });
}

function _rdFenceKeepsOut() {
  return typeof backyardFenceTier !== "undefined" && backyardFenceTier >= 2 && !backyardFenceBroken;
}

// A wild herd to raid with: led by a bad smarty if possible
function pickRaidHerd() {
  if (typeof herdState === "undefined" || !herdState) return null;
  const cands = (herdState.list || []).filter((h) => {
    if (typeof herdIsYours === "function" && herdIsYours(h)) return false;
    const m = getHerdMembers(h).filter((f) => f.growth >= 1 && !f.currentCage && !f.placedOn && !f.isDragging);
    if (m.length < 3) return false;
    return !m.some((f) => f.scene === (typeof PARK_SCENE !== "undefined" ? PARK_SCENE : "PARK") || f.scene === "BACKYARD");
  });
  if (!cands.length) return null;
  const bad = cands.filter((h) => {
    const l = getHerdLeader(h);
    return l && l.isSmarty && l.isSmarty();
  });
  const list = bad.length ? bad : cands;
  return list[Math.floor(Math.random() * list.length)];
}

// A hungry herd from the street, with a bad smarty at its head
function spawnRaidHerd() {
  const n = RAID_NEW_SIZE[0] + Math.floor(Math.random() * (RAID_NEW_SIZE[1] - RAID_NEW_SIZE[0] + 1));
  const out = [];
  for (let i = 0; i < n; i++) {
    const smarty = i === 0;
    const h = new Horse(1, null, "BACKYARD", smarty ? "earthy" : ["earthy", "earthy", "pegasus", "unicorn"][Math.floor(Math.random() * 4)], null, Math.random(), Math.random(), smarty ? "male" : undefined);
    h.adopted = false;
    h.personalities = (h.personalities || []).filter((p) => p !== "smarty");
    if (smarty) {
      h.personalities = [...h.personalities, "smarty"];
      h.smartyKind = "bad";
    } else if (typeof rollSmartyKind === "function") rollSmartyKind(h);
    h.playerTrust = typeof TRUST_START_FERAL === "number" ? TRUST_START_FERAL : 0.35;
    fluffies.push(h);
    out.push(h);
  }
  // They've come a long way together
  for (const a of out)
    for (const b of out) {
      if (a === b) continue;
      if (typeof meet === "function") meet(a, b);
      if (typeof changeOpinion === "function") changeOpinion(a, b, 0.6, "travelled together");
    }
  const h = typeof _formHerd === "function" ? _formHerd(out) : null;
  if (h) h.leaderId = out[0].id;
  return h;
}

function _rdLures() {
  return typeof lureItemsIn === "function" ? lureItemsIn("BACKYARD").length : 0;
}

// They come in through the gate
function startYardRaid(h = null) {
  if (raidActive()) return null;
  h = h || pickRaidHerd() || spawnRaidHerd();
  if (!h) return null;
  const g = _rdGate();
  const top = (typeof sceneTop === "function" ? sceneTop("BACKYARD") : height * 0.15) + 60;
  const members = getHerdMembers(h).filter((f) => !f.currentCage && !f.placedOn && !f.isDragging);
  for (const f of members) {
    f.scene = "BACKYARD";
    f.x = g.x + (Math.random() - 0.5) * 80;
    f.y = g.y - Math.random() * 20;
    f.hunger = Math.min(f.hunger ?? 1, 0.35);
    f._herdTask = null;
    if (!f.tooYoungToWalk()) {
      f.initBehavior("MOVING");
      f.setTargetPosition(80 + Math.random() * (width - 160), top + Math.random() * (height - top - 140));
    }
  }
  raidState.active = { herdId: h.id, ids: members.map((f) => f.id), at: timePlayed, claimedAt: null, quiet: 0, shoveAt: 0 };
  raidState.lastAt = timePlayed;
  const lead = getHerdLeader(h);
  if (lead && !lead.tooYoungToSpeak()) lead.speak(getDialogue(["RAID", "START"], lead), true);
  _rdTell(`The ${getHerdName(h)} is raiding your backyard!${currentScene === "BACKYARD" ? "" : " (Go to the backyard to chase them off.)"}`);
  return raidState.active;
}

// They leave through the gate, for the river
function endYardRaid(why = "left") {
  const h = _rdHerd();
  const a = raidState.active;
  const ids = _rdIds();
  raidState.active = null;
  if (!a) return;
  const g = _rdGate();
  for (const f of fluffies.filter((x) => (ids.includes(x.id) || (h && herdOf(x) === h)) && x.scene === "BACKYARD" && x.isAlive)) {
    _raidLeaving.push({ id: f.id, until: timePlayed + RAID_LEAVE_TIME });
    f.chaseTarget = null;
    f._raidTarget = null;
    if (!f.tooYoungToWalk() && !f.isDragging) {
      f.initBehavior("RUNNING");
      f.setTargetPosition(g.x, g.y);
    }
  }
  const lead = h ? getHerdLeader(h) : null;
  if (lead && lead.scene === "BACKYARD" && !lead.tooYoungToSpeak()) lead.speak(getDialogue(["RAID", why === "chased" ? "CHASED" : why === "beaten" ? "BEATEN" : "LEAVE"], lead), true);
  const hn = h ? getHerdName(h) : "raiders";
  // A grudge against your herd
  const mine = fluffies.find((f) => f.adopted && f.isAlive && herdOf(f) && herdIsYours(herdOf(f)));
  if (h && mine && typeof noteHerdFeud === "function") noteHerdFeud(h, herdOf(mine), RAID_FEUD);
  _rdTell(
    {
      chased: `You chased the ${hn} out of the backyard.`,
      beaten: `Your fluffies drove the ${hn} out of the backyard!`,
      won: `The ${hn} beat your fluffies and ate the backyard bare before leaving.`,
      left: `The ${hn} has left the backyard${a.claimedAt ? " they'd claimed" : ""}.`,
    }[why] || `The ${hn} has left the backyard.`,
  );
}

function chaseOffRaid() {
  if (!raidActive()) return false;
  for (const f of raiders()) if (!f.tooYoungToSpeak() && Math.random() < 0.4) f.speak(getDialogue(["RAID", "CHASED"], f));
  endYardRaid("chased");
  return true;
}

// Your fluffies who'll fight for the backyard
function raidDefenders() {
  const mine = fluffies.filter(
    (f) => f.isAlive && f.adopted && f.scene === "BACKYARD" && f.growth >= 1 && f.health >= RAID_FIGHT_HEALTH && !f.isDragging && !f.currentCage && !f.placedOn && !(f.isSensitive && f.isSensitive()),
  );
  return mine.filter((f) => {
    const h = herdOf(f);
    if (h && typeof herdWarFights === "function") return herdWarFights(f, h, "BACKYARD");
    return (typeof traitValue === "function" ? traitValue(f, "bravery") : 0) > -0.3;
  });
}

// The raiders who fight (they came looking for it: all but the very timid, and always the leader)
function _rdFighters(list) {
  const h = _rdHerd();
  const lead = h ? getHerdLeader(h) : null;
  return list.filter((f) => f.growth >= 1 && f.health >= RAID_FIGHT_HEALTH && !f.isDragging && !(f.isSensitive && f.isSensitive()) && (f === lead || f.herdJob === "toughie" || (typeof traitValue === "function" ? traitValue(f, "bravery") : 0) > -0.7));
}

function _rdFight(A, B) {
  for (const [mine, theirs] of [
    [A, B],
    [B, A],
  ]) {
    for (const f of mine) {
      let best = null;
      let bd = Infinity;
      for (const e of theirs) {
        const d = Math.hypot(e.x - f.x, e.y - f.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (!best) continue;
      f._raidTarget = best.id;
      if (f.currentStateKey === "SLEEPING") f.initBehavior("IDLE");
      if (bd > 60) {
        if (!f.isMovingOrRunning()) f.initBehavior("RUNNING");
        f.setTargetPosition(best.x + (best.x < f.x ? 35 : -35), best.y);
      } else if (f.attackCooldown <= 0) {
        f.facingRight = best.x > f.x;
        const bonus = typeof herdWarHitBonus === "function" ? herdWarHitBonus(f) : 0;
        if (Math.random() < 0.5 + bonus) f.performAttack(best, "TERRITORY");
        f.attackCooldown = Math.max(f.attackCooldown || 0, 1.2 + Math.random());
      }
    }
  }
}

function updateRaids(dt) {
  const step = raidTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const now = timePlayed;
  // Those on their way out
  if (_raidLeaving.length) {
    const g = _rdGate();
    _raidLeaving = _raidLeaving.filter((l) => {
      const f = fluffyById(l.id);
      if (!f || !f.isAlive || f.scene !== "BACKYARD" || f.isDragging || f.adopted) return false;
      if (now >= l.until || Math.hypot(f.x - g.x, f.y - g.y) < 50) {
        f.scene = typeof STRAY_SHOO_SCENE !== "undefined" ? STRAY_SHOO_SCENE : "RIVER";
        f.x = width * 0.5 + Math.random() * width * 0.3;
        f.y = height * 0.6 + Math.random() * height * 0.2;
        f._raidTarget = null;
        return false;
      }
      return true;
    });
  }
  const a = raidState.active;
  if (!a) {
    // A new one?
    if (typeof getDayNumber === "function" && getDayNumber() < RAID_FROM_DAY) return;
    if (_rdFenceKeepsOut()) return;
    if (typeof raidState.lastAt === "number" && now >= raidState.lastAt && now - raidState.lastAt < RAID_GAP) return;
    const lures = Math.min(3, _rdLures());
    if (!lures) return;
    if (Math.random() < YARD_RAID_CHANCE * lures * (step / HOUR_LENGTH)) startYardRaid();
    return;
  }
  const R = raiders();
  if (!R.length || now < a.at) return endYardRaid("left");
  const D = raidDefenders();
  const RF = _rdFighters(R);
  if (D.length && RF.length) {
    a.quiet = 0;
    _rdFight(D, RF);
  } else {
    for (const f of [...D, ...R]) f._raidTarget = null;
    if (!RF.length && D.length) return endYardRaid("beaten");
    // Nobody standing up to them: they claim it
    a.quiet += step;
    if (!a.claimedAt && a.quiet >= RAID_CLAIM) {
      a.claimedAt = now;
      const h = _rdHerd();
      const lead = h && getHerdLeader(h);
      if (lead && lead.scene === "BACKYARD" && !lead.tooYoungToSpeak()) lead.speak(getDialogue(["RAID", "CLAIM"], lead), true);
      _rdTell(`The ${h ? getHerdName(h) : "raiders"} has claimed your backyard! Chase them off from the backyard.`);
    }
    if (a.claimedAt && now - (a.shoveAt || 0) >= RAID_SHOVE_EVERY) {
      a.shoveAt = now;
      const mine = fluffies.filter((f) => f.isAlive && f.adopted && f.scene === "BACKYARD" && !f.isDragging);
      const bully = RF[Math.floor(Math.random() * RF.length)];
      if (bully && mine.length && bully.attackCooldown <= 0) {
        const v = mine.sort((p, q) => Math.hypot(p.x - bully.x, p.y - bully.y) - Math.hypot(q.x - bully.x, q.y - bully.y))[0];
        if (Math.hypot(v.x - bully.x, v.y - bully.y) < 300) {
          bully.performAttack(v, "BULLY");
          if (!bully.tooYoungToSpeak()) bully.speak(getDialogue(["RAID", "SHOVE"], bully, v));
        }
      }
    }
  }
  // (time's up: still fighting it out, or they'd claimed it, they just go)
  if (now - a.at >= YARD_RAID_MAX) endYardRaid(D.length && !RF.length ? "beaten" : a.claimedAt || (D.length && RF.length) ? "left" : "won");
}
registerSystem("raids", updateRaids, 134);

// ---- The chip (click or tap): chase them off ----

function raidChip() {
  if (!raidActive() || currentScene !== "BACKYARD") return null;
  const h = _rdHerd();
  const label = `Chase off the ${h ? getHerdName(h) : "raiders"}`;
  ctx.save();
  ctx.font = "bold 14px Arial";
  const w = ctx.measureText(label).width + 28;
  ctx.restore();
  return { x: width / 2 - w / 2, y: 88, w, h: 30, label };
}

function drawRaidChip(c) {
  const ch = raidChip();
  if (!ch) return;
  const hover = isPointInRect(mouse.x, mouse.y, ch.x, ch.y, ch.w, ch.h);
  c.save();
  c.fillStyle = hover ? "rgba(200, 50, 40, 0.95)" : "rgba(160, 30, 30, 0.85)";
  if (typeof fillRoundRect === "function") fillRoundRect(c, ch.x, ch.y, ch.w, ch.h, 14);
  else c.fillRect(ch.x, ch.y, ch.w, ch.h);
  c.fillStyle = "white";
  c.font = "bold 14px Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(ch.label, ch.x + ch.w / 2, ch.y + ch.h / 2 + 1);
  c.restore();
}

// UI.js mouse down (a tap too)
function raidChipClick() {
  const ch = raidChip();
  if (!ch || !isPointInRect(mouse.x, mouse.y, ch.x, ch.y, ch.w, ch.h)) return false;
  return chaseOffRaid();
}

// Magnifying glass (Family, "Raiding"): [text, tone] or null
function describeRaid(f) {
  if (!raidActive() || f.scene !== "BACKYARD") return null;
  if (_rdIsRaider(f)) return [`Raiding your backyard${raidState.active.claimedAt ? " (claimed it)" : ""}`, "bad"];
  if (f.adopted && f._raidTarget) return ["Fighting off raiders", "ok"];
  return null;
}
