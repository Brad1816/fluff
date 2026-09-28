// ---------------------------------------------------------------------------
// Herds: groups of fluffies that all like each other, with a leader.
//
// Built on Bonds.js (getLiking). Every few seconds updateHerds():
//   - forms a herd from 3+ fluffies (not yet in one) that are all
//     connected by mutual liking of HERD_BOND or more; families qualify
//     easily because family members start out liking each other
//   - lets outsiders join (bonded with 2+ members; foals join mum's herd)
//   - lets members who've fallen out leave, replaces a lost leader, and
//     breaks up herds that get too small
//   - makes rival herds that keep bumping into each other dislike each
//     other (the start of herd rivalries)
//
// Members follow their leader around (FollowHerdDesire), herd-mates like
// each other more and members of different herds a bit less (getLiking in
// Bonds.js asks herdLikingBonus). Press H to see herd markers.
//
// Saved in SAVED_GAME_STATE as `herdState` = { list: [herd], nextId }.
// A herd: { id, name, leaderId, memberIds: [], colorIndex, formedAt }.
// The planned park (big scrolling area with competing herds) builds on
// herdOf(), sameHerd(), getHerdLeader() and getHerdCentre().
// ---------------------------------------------------------------------------

const HERD_BOND = 0.45; // mutual liking that counts as "bonded"
const HERD_MIN_SIZE = 3; // to form
const HERD_JOIN_BONDS = 2; // bonds with members needed to join
const HERD_LEAVE_BELOW = 0.05; // average liking of herd-mates below this: leaves
const HERD_FOLLOW_DIST = 220; // members wander at most this far from the leader
const HERD_UPDATE_EVERY = 3; // seconds
const HERD_SAME_BONUS = 0.2; // liking bonus for herd-mates
const HERD_RIVAL_PENALTY = -0.1; // liking penalty for other herds' members
const HERD_MAX_SIZE = 12; // bigger herds split in two
const HERD_SPLIT_WAIT = 120; // seconds between splits of one herd
const HERD_REJOIN_WAIT = 600; // seconds before splitters may rejoin

const HERD_NAMES = [
  "Clover",
  "Buttercup",
  "Thistle",
  "Pebble",
  "Maple",
  "Bramble",
  "Daisy Hill",
  "Muddy Creek",
  "Sunny Meadow",
  "Oak Stump",
  "Dandelion",
  "Willow",
  "Hawthorn",
  "Moss Rock",
  "Pine Cone",
  "Puddle",
  "Hay Bale",
  "Acorn",
  "Mushroom",
  "Tall Grass",
];

const HERD_COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f1c40f",
  "#9b59b6",
  "#e67e22",
  "#1abc9c",
  "#ff6fb5",
  "#95a5a6",
  "#8e5a2b",
];

function freshHerdState() {
  return { list: [], nextId: 1 };
}

let herdState = freshHerdState();
let showHerdMarkers = false;
let _herdTimer = 0;
let _herdIndex = null; // fluffy id -> herd (rebuilt when herds change)
let _herdIndexKey = "";

function _herdList() {
  return (herdState && Array.isArray(herdState.list) && herdState.list) || [];
}

function _rebuildHerdIndex() {
  const key = _herdList()
    .map((h) => h.id + ":" + h.memberIds.join(","))
    .join("|");
  if (_herdIndex && key === _herdIndexKey) return;
  _herdIndex = new Map();
  for (const h of _herdList()) for (const id of h.memberIds) _herdIndex.set(String(id), h);
  _herdIndexKey = key;
}

function _herdChanged() {
  _herdIndex = null;
}

// ---- Lookups (for other code) ----

function herdOf(f) {
  if (!f) return null;
  if (!_herdIndex) _rebuildHerdIndex();
  return _herdIndex.get(String(f.id)) || null;
}

function sameHerd(a, b) {
  const h = herdOf(a);
  return !!h && h === herdOf(b);
}

// Fluffies that don't hug, chat, befriend or sleep together: members of
// different herds, or when one dislikes the other
function keepsApart(a, b) {
  if (!a || !b) return false;
  const ha = herdOf(a);
  const hb = herdOf(b);
  if (ha && hb && ha !== hb) return true;
  return typeof getLiking === "function" && (getLiking(a, b) < 0 || getLiking(b, a) < 0);
}

// Used by getLiking (Bonds.js)
function herdLikingBonus(a, b) {
  const ha = herdOf(a);
  const hb = herdOf(b);
  if (!ha || !hb) return 0;
  return ha === hb ? HERD_SAME_BONUS : HERD_RIVAL_PENALTY;
}

function getHerdMembers(h) {
  return h.memberIds.map((id) => fluffies.find((f) => f.id === id)).filter((f) => f && f.isAlive);
}

function getHerdLeader(h) {
  return fluffies.find((f) => f.id === h.leaderId && f.isAlive) || null;
}

function getHerdName(h) {
  return `${h.name || "Nameless"} herd`;
}

function getHerdLeaderName(h) {
  if (typeof fluffyDisplayNameById === "function") return fluffyDisplayNameById(h.leaderId); // Names.js
  return (typeof fluffyNames !== "undefined" && fluffyNames[h.leaderId]) || "Fluffy";
}

function getHerdColor(h) {
  return HERD_COLORS[(h.colorIndex || 0) % HERD_COLORS.length];
}

// Average position of the herd's members in one scene (null if none there)
function getHerdCentre(h, scene) {
  const here = getHerdMembers(h).filter((f) => f.scene === scene);
  if (!here.length) return null;
  return {
    x: here.reduce((s, f) => s + f.x, 0) / here.length,
    y: here.reduce((s, f) => s + f.y, 0) / here.length,
  };
}

function describeHerd(f) {
  const h = herdOf(f);
  if (!h) return "None";
  const n = h.memberIds.length;
  const who = h.leaderId === f.id ? "leader" : `led by ${getHerdLeaderName(h)}`;
  const land = typeof describeTerritory === "function" ? describeTerritory(h) : "";
  return `${getHerdName(h)} (${who}, ${n} member${n === 1 ? "" : "s"}${land ? `, home: ${land}` : ""})`;
}

// ---- Deciding things ----

function _bonded(a, b) {
  return getLiking(a, b) >= HERD_BOND && getLiking(b, a) >= HERD_BOND;
}

// A deep personal grudge counts even against family (family feeling
// would otherwise cancel it out)
function _dislikesLeader(f, leader) {
  return getLiking(f, leader) <= -0.3 || getOpinion(f, leader) <= -0.5;
}

function _canLead(f) {
  return f.isAlive && f.growth >= 1 && !f.tooYoungToWalk();
}

// Who'd make the best leader: brave, healthy, well liked (smarties push
// themselves forward, as fluffies do)
function herdLeadershipScore(f, members) {
  if (!_canLead(f)) return -Infinity;
  const tv = (k) => (typeof traitValue === "function" ? traitValue(f, k) : 0);
  let score = 1 + 0.8 * tv("bravery") + 0.2 * tv("social") + 0.3 * ((f.health || 100) / 100);
  if (f.isSmarty && f.isSmarty()) score += 0.5;
  for (const m of members) if (m !== f) score += 0.15 * getLiking(m, f);
  return score;
}

function _pickLeader(members) {
  let best = null;
  let bestScore = -Infinity;
  for (const f of members) {
    const s = herdLeadershipScore(f, members);
    if (s > bestScore) {
      bestScore = s;
      best = f;
    }
  }
  return bestScore === -Infinity ? null : best;
}

function _say(f, keys, target) {
  if (f && f.isAlive && !f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING") f.speak(getDialogue(keys, f, target));
}

function _tellPlayer(h, text) {
  // Only about herds with your fluffies in them
  if (getHerdMembers(h).some((f) => f.adopted) && typeof addUIMessage === "function") addUIMessage(text);
}

function _formHerd(members) {
  const leader = _pickLeader(members);
  if (!leader) return null;
  const used = new Set(_herdList().map((h) => h.colorIndex));
  let colorIndex = 0;
  while (used.has(colorIndex) && colorIndex < HERD_COLORS.length) colorIndex++;
  const taken = new Set(_herdList().map((x) => x.name));
  const free = HERD_NAMES.filter((n) => !taken.has(n));
  const name = free.length
    ? free[Math.floor(Math.random() * free.length)]
    : `${HERD_NAMES[Math.floor(Math.random() * HERD_NAMES.length)]} ${herdState.nextId}`;
  const h = {
    id: herdState.nextId++,
    name,
    leaderId: leader.id,
    memberIds: members.map((f) => f.id),
    colorIndex: colorIndex % HERD_COLORS.length,
    formedAt: typeof timePlayed === "number" ? timePlayed : 0,
  };
  herdState.list.push(h);
  _herdChanged();
  _say(leader, ["HERD", "NEW_HERD"]);
  _tellPlayer(h, `A new herd formed: the ${getHerdName(h)}, led by ${getHerdLeaderName(h)} (${members.length})`);
  // Morning report (DayReport.js)
  if (typeof noteDayEvent === "function" && (leader.scene === "PARK" || members.some((f) => f.adopted)))
    noteDayEvent("news", {
      text: `A new herd formed${leader.scene === "PARK" ? " in the park" : ""}: the ${getHerdName(h)}.`,
    });
  return h;
}

function _join(h, f) {
  if (h.memberIds.includes(f.id)) return;
  h.memberIds.push(f.id);
  _herdChanged();
  _say(f, ["HERD", "JOIN"], getHerdLeader(h));
}

function _leave(h, f, quietly = false) {
  h.memberIds = h.memberIds.filter((id) => id !== f.id);
  _herdChanged();
  if (!quietly) _say(f, ["HERD", "LEFT"], getHerdLeader(h));
}

// ---- Every simulation step (script.js); works every few seconds ----

function updateHerds(dt) {
  if (!herdState || !Array.isArray(herdState.list)) herdState = freshHerdState();
  _herdTimer -= dt;
  if (_herdTimer > 0) return;
  const step = HERD_UPDATE_EVERY - _herdTimer;
  _herdTimer = HERD_UPDATE_EVERY;
  if (typeof getLiking !== "function") return;

  const alive = new Map(fluffies.filter((f) => f.isAlive).map((f) => [f.id, f]));

  // 1. Tidy up: lost members, leaders, members who've fallen out
  for (const h of [..._herdList()]) {
    const before = h.memberIds.length;
    h.memberIds = h.memberIds.filter((id) => alive.has(id));
    if (h.memberIds.length !== before) _herdChanged();

    let members = getHerdMembers(h);
    for (const f of members) {
      if (f.growth < 1 || members.length < 2) continue; // foals stay with mum
      const others = members.filter((m) => m !== f);
      const avg = others.reduce((s, m) => s + getLiking(f, m), 0) / others.length;
      const leader = getHerdLeader(h);
      const hatesLeader = leader && leader !== f && _dislikesLeader(f, leader);
      if (avg < HERD_LEAVE_BELOW || hatesLeader) _leave(h, f);
    }
    members = getHerdMembers(h);

    if (members.length < 2) {
      herdState.list = herdState.list.filter((x) => x !== h);
      _herdChanged();
      continue;
    }
    if (!members.some((f) => f.id === h.leaderId && _canLead(f))) {
      const leader = _pickLeader(members);
      if (leader) {
        h.leaderId = leader.id;
        _say(leader, ["HERD", "NEW_LEADER"]);
        _tellPlayer(h, `The ${getHerdName(h)} has a new leader: ${getHerdLeaderName(h)}.`);
      }
    }
    _maybeSplit(h);
  }

  const unherded = [...alive.values()].filter((f) => !herdOf(f));

  // 2. Foals go with mum's herd; others join a herd they've bonded with
  for (const f of unherded) {
    const mum = f.growth < 1 ? alive.get(f.motherId) : null;
    if (mum && herdOf(mum)) {
      _join(herdOf(mum), f);
      continue;
    }
    let best = null;
    let bestBonds = 0;
    for (const h of _herdList()) {
      const leader = getHerdLeader(h);
      if (leader && _dislikesLeader(f, leader)) continue; // won't follow that one
      if (_recentlyLeft(f, h)) continue; // split off not long ago
      const bonds = getHerdMembers(h).filter((m) => m.scene === f.scene && _bonded(f, m)).length;
      if (bonds > bestBonds) {
        bestBonds = bonds;
        best = h;
      }
    }
    if (best && bestBonds >= HERD_JOIN_BONDS) _join(best, f);
  }

  // 3. New herds from bonded groups of fluffies that aren't in one
  const loose = [...alive.values()].filter((f) => !herdOf(f));
  const byScene = {};
  for (const f of loose) (byScene[f.scene] = byScene[f.scene] || []).push(f);
  for (const scene in byScene) {
    const list = byScene[scene];
    const seen = new Set();
    for (const start of list) {
      if (seen.has(start)) continue;
      // Everyone connected to `start` through bonds
      const group = [];
      const queue = [start];
      seen.add(start);
      while (queue.length) {
        const f = queue.shift();
        group.push(f);
        for (const g of list) {
          if (!seen.has(g) && _bonded(f, g)) {
            seen.add(g);
            queue.push(g);
          }
        }
      }
      if (group.length >= HERD_MIN_SIZE) _formHerd(group);
    }
  }

  // 4. Rival herds that keep meeting grow to dislike each other
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  rebuildFluffyGrid();
  forEachNearbyPair(150, (a, b) => {
    if (!herdOf(a) || !herdOf(b) || sameHerd(a, b)) return;
    if (typeof changeOpinion === "function") {
      // Slowly: about 8 minutes of close contact to really dislike
      changeOpinion(a, b, -0.0006 * step, "rival herd");
      changeOpinion(b, a, -0.0006 * step, "rival herd");
    }
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      if (!x._lastStrangerLine || now - x._lastStrangerLine > 40) {
        x._lastStrangerLine = now;
        if (Math.random() < 0.3) _say(x, ["HERD", "STRANGER"], y);
      }
    }
  });
}

// ---- Big herds split ----

function _recentlyLeft(f, h) {
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  return !!f._leftHerd && f._leftHerd.id === h.id && f._leftHerd.until > now;
}

// A herd over HERD_MAX_SIZE splits: its best would-be leader (other than the
// current one) leaves with the members who like it more than the leader,
// plus foals whose mums go. They start a herd of their own (and will need
// land of their own in the park: Territory.js).
function _maybeSplit(h) {
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  const members = getHerdMembers(h);
  if (members.length <= HERD_MAX_SIZE) return;
  if (now - (h.splitAt ?? h.formedAt ?? 0) < HERD_SPLIT_WAIT) return;
  const leader = getHerdLeader(h);
  const adults = members.filter((f) => f !== leader && _canLead(f));
  if (adults.length < 3) return;
  let rival = null;
  let bestScore = -Infinity;
  for (const f of adults) {
    const s = herdLeadershipScore(f, members);
    if (s > bestScore) {
      bestScore = s;
      rival = f;
    }
  }
  const half = Math.floor(members.length / 2);
  const group = new Set([rival]);
  // Grown-ups who'd rather follow the new one
  const byPreference = adults
    .filter((f) => f !== rival)
    .map((f) => [f, getLiking(f, rival) - (leader ? getLiking(f, leader) : 0)])
    .sort((a, b) => b[1] - a[1]);
  for (const [f, pref] of byPreference) {
    if (group.size >= half) break;
    if (pref > 0 || group.size < 3) group.add(f);
  }
  // Foals go with their mums
  for (const f of members) {
    if (f.growth < 1 && [...group].some((g) => g.id === f.motherId)) group.add(f);
  }
  const leaving = [...group];
  if (leaving.length < 3 || members.length - leaving.length < 2) return;
  h.memberIds = h.memberIds.filter((id) => !group.has(members.find((m) => m.id === id)));
  h.splitAt = now;
  _herdChanged();
  for (const f of leaving) f._leftHerd = { id: h.id, until: now + HERD_REJOIN_WAIT };
  const nh = _formHerd(leaving);
  if (nh) {
    nh.leaderId = rival.id;
    nh.splitAt = now;
    const text = `${getHerdLeaderName(nh)} led ${leaving.length - 1} others away from the ${getHerdName(h)}: they're the ${getHerdName(nh)} now.`;
    _tellPlayer(h, text);
    _tellPlayer(nh, text);
    if (
      typeof _parkNews === "function" &&
      !getHerdMembers(h)
        .concat(leaving)
        .some((f) => f.adopted)
    )
      _parkNews(text);
    if (typeof noteDayEvent === "function") noteDayEvent("news", { text }); // morning report
  }
}

// ---- Members stay near their leader ----

class FollowHerdDesire extends Desire {
  constructor() {
    super("FollowHerd");
    this.lastTime = -Infinity;
  }
  evaluate(horse) {
    if (!horse.isAlive || horse.isDragging || horse.placedOn || horse.isScared || horse.isStacking) return 0;
    if (horse.sleepingOrTargetSet() || horse.tooYoungToWalk() || !horse.canSee()) return 0;
    if (horse.happiness <= WAN_DIE_THRESHOLD || horse.hunger < 0.35) return 0;
    if (gameTimeMs() - this.lastTime < 6000) return 0;
    const h = herdOf(horse);
    if (!h || h.leaderId === horse.id) return 0;
    const leader = getHerdLeader(h);
    let target = leader && leader.scene === horse.scene ? leader : getHerdCentre(h, horse.scene);
    if (!target) return 0;
    if (
      leader &&
      target === leader &&
      typeof canFluffiesReachEachOther === "function" &&
      !canFluffiesReachEachOther(horse, leader)
    )
      return 0;
    if (Math.hypot(target.x - horse.x, target.y - horse.y) < HERD_FOLLOW_DIST) return 0;
    this.target = { x: target.x, y: target.y };
    return 47; // above an idle wander, so the herd moves together
  }
  execute(horse) {
    this.lastTime = gameTimeMs();
    const t = this.target;
    if (!t) return false;
    const angle = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 60;
    horse.initBehavior("MOVING");
    horse.setTargetPosition(
      clamp(t.x + Math.cos(angle) * r, 40, sceneW(horse.scene) - 40),
      t.y + Math.sin(angle) * r * 0.5,
    );
    if (Math.random() < 0.15) _say(horse, ["HERD", "FOLLOW"], getHerdLeader(herdOf(horse)));
    return true;
  }
}

// ---- Markers (press H), drawn with the speech bubbles (script.js) ----

function drawHerdMarker(c, f) {
  if (!showHerdMarkers || !f.isAlive) return;
  const h = herdOf(f);
  if (!h) return;
  const x = f.x;
  const y = f.y + 45 * Math.sqrt(f.scale * 2.0) + (showFluffyNames ? 30 : 6);
  c.save();
  c.beginPath();
  c.arc(x, y, h.leaderId === f.id ? 10 : 7, 0, Math.PI * 2);
  c.fillStyle = getHerdColor(h);
  c.fill();
  c.strokeStyle = "white";
  c.lineWidth = 2;
  c.stroke();
  if (h.leaderId === f.id) {
    c.fillStyle = "white";
    c.font = "bold 12px Arial";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("★", x, y + 1);
  }
  c.restore();
}
