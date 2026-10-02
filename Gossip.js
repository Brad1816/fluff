// ---------------------------------------------------------------------------
// Gossip and family roles (design doc Phase 3).
//
// Fluffies tell each other what they've seen and heard about you. When two
// chat (Bonds.onFluffiesChatted), each passes on its tale to the other:
//   harm  it was hurt by you, or saw you hurt someone (its own memories,
//         Memory.js), or heard about it from another fluffy. A listener
//         that never saw it grows a little afraid of you: GOSSIP_FEAR x the
//         tale's strength, less if it trusts you itself (first-hand matters
//         most), and never more than GOSSIP_FEAR_MAX in all from hearsay.
//   kind  it loves you (trust >= GOSSIP_LOVED, little fear), or heard you're
//         kind. A newcomer (settling in, or here under GOSSIP_NEW_DAYS)
//         listening grows to trust you a little faster (GOSSIP_TRUST, up to
//         GOSSIP_TRUST_MAX in all).
// A tale weakens as it's passed on (GOSSIP_PASS): what the listener then
// tells others is only a share of what it heard, and hearsay fades over a
// few days (GOSSIP_FADE). The same two only gossip once an hour.
// The first time it hears either kind of tale it goes in its story ("Heard
// from Poppy that you hurt Snowball."); the magnifying glass (Mind) says
// what it's heard. (Phase 4: a Rebel's defiance spreads the same way,
// gossipTaleHook.)
//
// Family roles, shown in the magnifying glass (Nature, "Family role"):
//   Matriarch      an old mare with a big family in the house (and she
//                  keeps her room calm, Climate.js)
//   Big sister / big brother   grown, with little brothers or sisters about
//                  (it comforts them when they're scared, Fears.js)
//   Loner          no friends, and not social
// Sleeping piles: see the end of this file.
// ---------------------------------------------------------------------------

const GOSSIP_FEAR = 0.03;
const GOSSIP_FEAR_MAX = 0.15;
const GOSSIP_TRUST = 0.03;
const GOSSIP_TRUST_MAX = 0.15;
const GOSSIP_LOVED = 0.65;
const GOSSIP_NEW_DAYS = 3;
const GOSSIP_PASS = 0.5;
const GOSSIP_FADE = 3 * DAY_LENGTH; // hearsay fades to a third
const GOSSIP_PAIR_GAP = HOUR_LENGTH;
const GOSSIP_SAY = 0.35; // chance it says it out loud
const GOSSIP_TRAIL = 3; // who it heard from, remembered

function _gName(f) {
  return (typeof fluffyNames !== "undefined" && f && fluffyNames[f.id]) || null;
}

function _gossipOf(f, create) {
  let g = f.gossip;
  if (!g || typeof g !== "object") {
    if (!create) return null;
    g = f.gossip = { harm: 0, kind: 0, t: timePlayed, feared: 0, trusted: 0 };
  }
  // Hearsay fades
  const now = timePlayed;
  if (!(now >= g.t)) g.t = now;
  if (now > g.t) {
    const k = Math.exp(-(now - g.t) / GOSSIP_FADE);
    g.harm = (+g.harm || 0) * k;
    g.kind = (+g.kind || 0) * k;
    g.t = now;
  }
  return g;
}

// What it saw for itself: the strongest harm memory it has (recent ones count most)
function _gFirstHandHarm(f) {
  const mems = Array.isArray(f.playerMemories) ? f.playerMemories : [];
  const now = timePlayed;
  let best = 0;
  let about = null;
  for (const m of mems) {
    if (typeof MEMORY_HARM_TYPES === "undefined" || !MEMORY_HARM_TYPES.has(m.type)) continue;
    const age = Math.max(0, now - (m.t || 0));
    const s = (m.type === "witness" ? 0.7 : 1) * Math.exp(-age / (2 * GOSSIP_FADE));
    if (s > best) {
      best = s;
      about = m;
    }
  }
  return { s: best, about };
}

// The tales it has to tell: { harm, kind, firstHand }
function gossipTales(f) {
  const g = _gossipOf(f, false);
  const own = _gFirstHandHarm(f);
  const trust = f.playerTrust || 0;
  const fear = f.playerFear || 0;
  const lovesYou = (f.adopted || f.formerPet) && trust >= GOSSIP_LOVED && fear < 0.3 ? Math.min(1, (trust - 0.5) * 2) : 0;
  let harm = Math.max(own.s, g ? g.harm : 0);
  let kind = Math.max(lovesYou, g ? g.kind : 0);
  if (typeof gossipTaleHook === "function") ({ harm, kind } = gossipTaleHook(f, { harm, kind }));
  return { harm, kind, firstHand: own.s >= (g ? g.harm : 0) && own.s > 0 };
}

function _gIsNewcomer(f) {
  if (f.settling) return true;
  const since = typeof f.adoptedAt === "number" ? f.adoptedAt : null;
  if (since !== null) return timePlayed - since < GOSSIP_NEW_DAYS * DAY_LENGTH;
  // (no record of when: its story knows when it came)
  if (typeof storyOf === "function") {
    const e = storyOf(f).find((x) => x.k === "arrived" && x.w[0] === f.id);
    if (e) return timePlayed - e.t < GOSSIP_NEW_DAYS * DAY_LENGTH;
  }
  return false;
}

// `from` tells `to` what it knows. Returns what was passed on.
function passGossip(from, to) {
  if (!from || !to || from === to || !from.isAlive || !to.isAlive) return null;
  if (typeof from.tooYoungToSpeak === "function" && from.tooYoungToSpeak()) return null;
  const tales = gossipTales(from);
  if (tales.harm < 0.05 && tales.kind < 0.05) return null;
  const out = { harm: 0, kind: 0 };
  let told = null; // what got through, for the relationship map
  const gt = _gossipOf(to, true);
  if (typeof ensurePlayerMemory === "function") ensurePlayerMemory(to);
  // Harm: only news to one that didn't see it itself
  if (tales.harm >= 0.05 && _gFirstHandHarm(to).s < tales.harm * 0.8) {
    const room = Math.max(0, GOSSIP_FEAR_MAX - (gt.feared || 0));
    const amount = Math.min(room, GOSSIP_FEAR * tales.harm * (1 - 0.7 * (to.playerTrust || 0)));
    if (amount > 0) {
      to.playerFear = Math.min(1, (to.playerFear || 0) + amount);
      gt.feared = (gt.feared || 0) + amount;
    }
    const heard = tales.harm * GOSSIP_PASS;
    if (heard > gt.harm) gt.harm = heard;
    out.harm = amount;
    told = "harm";
    // A Rebel stirs them up: they trust you a little less (Titles.js)
    if (typeof titleOf === "function" && titleOf(from) === "Rebel" && to.adopted && titleOf(to) !== "Rebel") {
      const room2 = Math.max(0, 0.1 - (gt.defied || 0));
      const d = Math.min(room2, 0.02);
      if (d > 0) {
        to.playerTrust = Math.max(0, (to.playerTrust || 0) - d);
        gt.defied = (gt.defied || 0) + d;
        out.defiance = d;
      }
    }
    if (!gt.heardHarm) {
      gt.heardHarm = true;
      const about = _gFirstHandHarm(from).about;
      const n = _gName(from);
      const what = about && about.type === "witness" ? "that you hurt a fluffy" : about && about.type === "witness_family" ? "that you hurt {poss} family" : "that you hurt fluffies";
      if (typeof recordStory === "function") recordStory("gossip", to, { x: `Heard from ${n || "another fluffy"} ${what}.` });
    }
  }
  // Kindness: news that settles a newcomer
  // (a newcomer of yours, or a wild one in the park - Runaways.js herd lore)
  if (tales.kind >= 0.05 && ((to.adopted && _gIsNewcomer(to)) || !to.adopted)) {
    const room = Math.max(0, GOSSIP_TRUST_MAX - (gt.trusted || 0));
    const amount = Math.min(room, GOSSIP_TRUST * tales.kind);
    if (amount > 0) {
      if (typeof changePlayerTrust === "function") changePlayerTrust(to, amount);
      else to.playerTrust = Math.min(1, (to.playerTrust || 0) + amount);
      gt.trusted = (gt.trusted || 0) + amount;
      // (and it's less afraid)
      to.playerFear = Math.max(0, (to.playerFear || 0) - amount / 2);
    }
    const heard = tales.kind * GOSSIP_PASS;
    if (heard > gt.kind) gt.kind = heard;
    out.kind = amount;
    if (!told || amount > out.harm) told = "kind";
    if (!gt.heardKind) {
      gt.heardKind = true;
      const n = _gName(from);
      if (typeof recordStory === "function") recordStory("gossip", to, { x: `${n || "Another fluffy"} told {obj} you were kind.` });
    }
  }
  // Who told whom (RelationshipMap.js draws the paths): the last few
  if (told) {
    const trail = Array.isArray(gt.from) ? gt.from.filter((x) => x && x.id !== from.id) : [];
    trail.push({ id: from.id, kind: told, t: timePlayed });
    gt.from = trail.slice(-GOSSIP_TRAIL);
  }
  // Saying it out loud (now and then)
  if ((out.harm > 0 || out.kind > 0) && Math.random() < GOSSIP_SAY && typeof getDialogue === "function" && typeof from.speak === "function") {
    const key = out.harm >= out.kind * 0.5 && out.harm > 0 ? "HARM" : "KIND";
    from.speak(getDialogue(["GOSSIP", key], from, to), true);
  }
  return out;
}

// Bonds.onFluffiesChatted
function onGossipChat(a, b) {
  if (!a || !b) return;
  const now = timePlayed;
  const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
  if (!_gossipPairs) _gossipPairs = new Map();
  const last = _gossipPairs.get(key);
  if (last !== undefined && now >= last && now - last < GOSSIP_PAIR_GAP) return;
  _gossipPairs.set(key, now);
  if (_gossipPairs.size > 2000) _gossipPairs.clear();
  passGossip(a, b);
  passGossip(b, a);
  // ...and the moments one was there for and the other wasn't (SharedMemories.js)
  if (typeof shareLegend === "function") {
    shareLegend(a, b);
    shareLegend(b, a);
  }
}
let _gossipPairs = null;

// The magnifying glass (Mind): what it's heard about you
function describeGossip(f) {
  const g = _gossipOf(f, false);
  if (!g) return null;
  const parts = [];
  if (g.heardHarm && (g.feared || 0) > 0.005) parts.push("that you hurt fluffies");
  if (g.heardKind && (g.trusted || 0) > 0.005) parts.push("that you're kind");
  if (!parts.length) return null;
  const tone = g.heardHarm && !g.heardKind ? "bad" : g.heardKind && !g.heardHarm ? "good" : "";
  return [`Heard ${parts.join(", and ")}`, tone];
}

// ---- Family roles ----

function _gRel(a, b) {
  return typeof relationships !== "undefined" && relationships[a.id] ? relationships[a.id][b.id] : undefined;
}

// Everyone alive in the house descended from f (children, grandchildren...)
function _gDescendants(f) {
  const kids = new Map();
  for (const o of fluffies) {
    if (o.motherId !== null && o.motherId !== undefined) {
      if (!kids.has(o.motherId)) kids.set(o.motherId, []);
      kids.get(o.motherId).push(o);
    }
    if (o.fatherId !== null && o.fatherId !== undefined && o.fatherId !== o.motherId) {
      if (!kids.has(o.fatherId)) kids.set(o.fatherId, []);
      kids.get(o.fatherId).push(o);
    }
  }
  const seen = new Set();
  const todo = [f.id];
  let n = 0;
  while (todo.length) {
    const id = todo.pop();
    for (const k of kids.get(id) || []) {
      if (seen.has(k.id)) continue;
      seen.add(k.id);
      if (k.isAlive) n++;
      todo.push(k.id);
    }
  }
  return n;
}

// "Matriarch", "Big sister", "Big brother", "Loner" or null
function familyRoleOf(f) {
  if (!f || !f.isAlive || typeof fluffies === "undefined") return null;
  if (f.gender === "female" && typeof isElderly === "function" && isElderly(f) && _gDescendants(f) >= 4) return "Matriarch";
  if (f.growth >= 1) {
    const little = fluffies.filter(
      (o) => o !== f && o.isAlive && o.growth < 1 && ((o.motherId !== null && o.motherId !== undefined && o.motherId === f.motherId) || /sister|brother|sibling/.test(String(_gRel(f, o) || ""))),
    );
    if (little.length) return f.gender === "female" ? "Big sister" : "Big brother";
  }
  const rels = typeof relationships !== "undefined" ? relationships[f.id] || {} : {};
  const friends = Object.values(rels).filter((r) => r === "friend" || r === "special_friend").length;
  const social = typeof traitValue === "function" ? traitValue(f, "social") : 0;
  if (f.growth >= 1 && !friends && social < -0.2) return "Loner";
  return null;
}

function describeFamilyRole(f) {
  const role = familyRoleOf(f);
  if (!role) return null;
  const text = {
    Matriarch: "Matriarch - her calm settles the room",
    "Big sister": "Big sister - looks after the little ones",
    "Big brother": "Big brother - looks after the little ones",
    Loner: "On its own - no friends in the house",
  }[role];
  return [text, role === "Loner" ? "" : "good"];
}

// ---- Sleeping piles ----
// Who curls up with whom already shows how they get on (HorsePositioning
// scoutForSleep, Bonds.sleepBuddyScore: mum and foals, herd-mates and
// friends together). Now it matters too: one that slept most of the night
// beside family or a friend wakes happier (SLEEP_WITH_FRIEND); a social one
// that slept alone wakes a bit down (SLEEP_ALONE). Only your fluffies, and
// only a proper sleep (SLEEP_MIN_TICKS checks).
const SLEEP_WITH_FRIEND = 0.03;
const SLEEP_ALONE = -0.02;
const SLEEP_NEAR = 110;
const SLEEP_MIN_TICKS = 6; // x 5 seconds
const SLEEP_CLOSE = new Set(["mother", "father", "child", "baby_child", "sister", "brother", "friend", "special_friend"]);

function _sleepsBesideFriend(f) {
  for (const o of fluffies) {
    if (o === f || !o.isAlive || o.scene !== f.scene || o.currentStateKey !== "SLEEPING") continue;
    if (Math.hypot(o.x - f.x, o.y - f.y) > SLEEP_NEAR) continue;
    const rel = _gRel(f, o);
    if (SLEEP_CLOSE.has(rel) || o.id === f.motherId || f.id === o.motherId) return true;
    if (typeof getLiking === "function" && getLiking(f, o) >= 0.25) return true;
  }
  return false;
}

// It just woke up: how was the night?
function onFluffyWoke(f) {
  const s = f._sleepCompany;
  f._sleepCompany = null;
  if (!s || s.ticks < SLEEP_MIN_TICKS || !f.isAlive || !f.adopted) return null;
  if (s.friend >= s.ticks / 2) {
    f.changeHappiness(SLEEP_WITH_FRIEND);
    return "friend";
  }
  const social = typeof traitValue === "function" ? traitValue(f, "social") : 0;
  if (s.friend === 0 && social > 0.2) {
    f.changeHappiness(SLEEP_ALONE);
    return "alone";
  }
  return null;
}

const sleepPileTicker = new Ticker(5);
function updateSleepPiles(dt) {
  if (!sleepPileTicker.step(dt) || typeof fluffies === "undefined") return;
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted) continue;
    if (f.currentStateKey === "SLEEPING") {
      if (!f._sleepCompany) f._sleepCompany = { ticks: 0, friend: 0 };
      f._sleepCompany.ticks++;
      if (_sleepsBesideFriend(f)) f._sleepCompany.friend++;
    } else if (f._sleepCompany) {
      onFluffyWoke(f);
    }
  }
}

registerSystem("sleepPiles", updateSleepPiles, 144);
