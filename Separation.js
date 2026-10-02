// ---------------------------------------------------------------------------
// Separation: fluffies taken away from their herd, family or friends.
//
// When you carry a fluffy out of an area (through an arrow or door,
// globals.js handleDropping), onFluffyTakenAway() looks at who it leaves
// behind there: its mum, foals, special friend, brothers and sisters, herd-
// mates and buddies. The closer they are to it, the bigger the bond.
//
//   - Straight away: it cries out, and those left behind who see it happen
//     are upset and a little scared of you.
//   - While it stays apart, its grief grows towards the size of the bond
//     over GRIEF_BUILD seconds (so a quick trip through a doorway barely
//     matters). Grief drags its happiness down and it talks about missing
//     them.
//   - If the grief gets deep (TRAUMA_AT), it's traumatised: it remembers
//     you took it away (fear up, trust down), once per separation. Foals
//     taken from their mum feel it most.
//   - Bring it back (within REUNITE_DIST of one of them) and it's
//     overjoyed; the grief goes.
//   - Otherwise it slowly gets over it (GRIEF_FADE after the first while),
//     and in the end stops belonging to a herd it was taken from.
//
// Saved on the fluffy as f.separation = { ids, names, bond, grief, since,
// traumatised, herdId, how, young }.
//
// TOO YOUNG TO REMEMBER: foals under REMEMBER_GROWTH still cry and miss
// mum for a little while, but get over it quickly and keep no memory,
// trauma or fear of you from it.
//
// HOW IT WAS TAKEN decides whether it leaves a permanent scar (f.traumas,
// saved; see addTrauma / PERMANENT_TRAUMA):
//   - "family_killed": you killed one of its family (mum, dad, foal, brother,
//     sister, special friend) shortly before - permanent, blames you most
//   - "violent": you hurt it or its family shortly before - permanent,
//     blames you
//   - "orphaned": its mum (or both parents) had died, not by your hand -
//     permanent sadness, but it doesn't blame you
//   - "peaceful": nothing like that. Grown-ups get over it (the grief and
//     the one-off memory above). A foal old enough to remember, torn from a
//     living mum and left to grieve deeply, keeps a mild permanent scar.
// A permanent trauma lowers its happiness a little for good, keeps its fear
// of you from ever fading below a floor (and trust below a ceiling) if it
// blames you, and gives it nightmares now and then.
// ---------------------------------------------------------------------------

const GRIEF_BUILD = 120; // game seconds to reach full grief
const GRIEF_HOLD = 600; // grief doesn't start fading for this long
const GRIEF_FADE = 1800; // then fades over this long
const TRAUMA_AT = 0.5;
const REUNITE_DIST = 300;
const REMEMBER_GROWTH = 0.35; // younger foals won't remember being taken
const RECENT_VIOLENCE = 180; // game seconds: "shortly before"
const FAMILY_RELATIONS = ["mother", "father", "baby_child", "child", "brother", "sister", "special_friend"];

const PERMANENT_TRAUMA = {
  family_killed: { text: "Saw its family killed, then taken", severity: 0.8, blames: true },
  violent: { text: "Hurt, then taken by force", severity: 0.5, blames: true },
  orphaned: { text: "Lost its parents", severity: 0.35, blames: false },
  torn_from_mum: { text: "Torn away from its mum", severity: 0.3, blames: true },
};

const BOND_WEIGHT = {
  mother: 1,
  baby_child: 1,
  child: 0.7,
  special_friend: 0.9,
  father: 0.6,
  brother: 0.6,
  sister: 0.6,
};

const separationTicker = new Ticker(1);

function _relationTo(a, b) {
  const r = typeof relationships !== "undefined" && relationships[a.id] && relationships[a.id][b.id];
  return r || null;
}

// How attached `f` is to `other` (0 = not at all)
function attachmentTo(f, other) {
  let w = 0;
  const rel = _relationTo(f, other);
  if (rel && BOND_WEIGHT[rel]) w = BOND_WEIGHT[rel];
  if (typeof sameHerd === "function" && sameHerd(f, other)) w = Math.max(w, 0.4);
  if (typeof getLiking === "function" && typeof OPINION_BUDDY !== "undefined" && getLiking(f, other) >= OPINION_BUDDY)
    w = Math.max(w, 0.45);
  if (typeof keepsApart === "function" && keepsApart(f, other)) w = 0;
  return w;
}

// Who `f` leaves behind in `scene`, and how big the bond is (0..1)
function bondsLeftBehind(f, scene) {
  const left = [];
  let bond = 0;
  for (const o of fluffies) {
    if (o === f || !o.isAlive || o.scene !== scene) continue;
    const w = attachmentTo(f, o);
    if (w <= 0) continue;
    left.push({ f: o, w });
    bond += w;
  }
  left.sort((a, b) => b.w - a.w);
  // Foals need their mum most of all; grown-ups cope a bit better
  if (f.growth < 1 && left.some((l) => _relationTo(f, l.f) === "mother")) bond += 0.3;
  bond = Math.min(1, bond) * (f.growth < 1 ? 1 : 0.8);
  return { left, bond };
}

function _sepSay(f, key, target = null) {
  if (f && f.isAlive && !f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING" && typeof getDialogue === "function")
    f.speak(getDialogue(["SEPARATION", key], f, target), true);
}

function _sepName(f) {
  if (typeof fluffyDisplayName === "function") return fluffyDisplayName(f); // Names.js
  return (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || "Fluffy";
}

// Old enough to remember this?
function remembersBeingTaken(f) {
  return f.growth >= REMEMBER_GROWTH;
}

function _family(f) {
  const rels = typeof relationships !== "undefined" ? relationships[f.id] : null;
  if (!rels) return [];
  return fluffies.filter((o) => o !== f && FAMILY_RELATIONS.includes(rels[o.id]));
}

function _isDeadParent(id) {
  if (id === null || id === undefined) return null; // unknown
  const p = fluffies.find((o) => o.id == id);
  if (p) return !p.isAlive;
  const rec = typeof fluffyRecords !== "undefined" ? fluffyRecords[id] : null;
  return rec ? rec.status === "dead" : null;
}

// How was `f` taken? "family_killed" | "violent" | "orphaned" | "peaceful"
function howTaken(f, fromScene = f.scene) {
  const now = timePlayed;
  const recent = (t) => typeof t === "number" && now - t < RECENT_VIOLENCE;
  const fam = _family(f);
  if (fam.some((o) => !o.isAlive && o.killedByPlayer && (o.deathTimer || 0) < RECENT_VIOLENCE && o.scene === fromScene)) return "family_killed"; // (killed where it was: it saw)
  if (recent(f.hurtByPlayerAt) || fam.some((o) => o.isAlive && recent(o.hurtByPlayerAt))) return "violent";
  const mumDead = _isDeadParent(f.motherId);
  const dadDead = _isDeadParent(f.fatherId);
  if (mumDead === true && dadDead !== false) return "orphaned";
  return "peaceful";
}

// A permanent scar (once per kind; a worse one of the same kind replaces it)
function addTrauma(f, type) {
  const def = PERMANENT_TRAUMA[type];
  if (!def || !f || !remembersBeingTaken(f)) return false;
  if (!Array.isArray(f.traumas)) f.traumas = [];
  if (f.traumas.some((t) => t.type === type)) return false;
  f.traumas.push({ type, text: def.text, severity: def.severity, blames: def.blames, at: timePlayed });
  if (typeof recordStory === "function") recordStory("scarred", f, { x: def.text });
  if (typeof noteDayEvent === "function") noteDayEvent("scarred", { name: _sepName(f) }); // morning report
  if (def.blames) {
    if (typeof changePlayerFear === "function") changePlayerFear(f, 0.3 * def.severity);
    if (typeof changePlayerTrust === "function") changePlayerTrust(f, -0.3 * def.severity);
  }
  f.changeHappiness(-0.15 * def.severity);
  return true;
}

function traumaLoad(f, blamesOnly = false) {
  if (!f || !Array.isArray(f.traumas)) return 0;
  return Math.min(
    1,
    f.traumas.filter((t) => !blamesOnly || t.blames).reduce((s, t) => s + t.severity, 0),
  );
}

// Magnifying glass: "Lost its parents; Hurt, then taken by force" or null
function describeTraumas(f) {
  if (!f || !Array.isArray(f.traumas) || !f.traumas.length) return null;
  return f.traumas.map((t) => t.text).join("; ");
}

// globals.js handleDropping: you just carried `f` from `fromScene` somewhere else
function onFluffyTakenAway(f, fromScene) {
  if (!f || !f.isAlive || !fromScene || f.scene === fromScene) return;
  // Taken out of the park: a wild-born fluffy (Goals.js, and remembered)
  if (fromScene === "PARK" && !f.adopted) f.fromPark = true;
  // Already missing someone: keep that separation going
  if (f.separation && f.separation.ids && f.separation.ids.length) return;
  const how = howTaken(f, fromScene);
  const young = !remembersBeingTaken(f);
  // Some ways of being taken leave a scar for life (not on tiny foals)
  if (!young && how !== "peaceful") addTrauma(f, how);
  const { left, bond } = bondsLeftBehind(f, fromScene);
  if (bond < 0.2) return;
  const top = left.slice(0, 4);
  const h = typeof herdOf === "function" ? herdOf(f) : null;
  f.separation = {
    ids: top.map((l) => l.f.id),
    names: top.map((l) => _sepName(l.f)),
    bond,
    grief: 0,
    since: timePlayed,
    traumatised: false,
    herdId: h && top.some((l) => herdOf(l.f) === h) ? h.id : null,
    how,
    young,
  };
  // Crying out as it's carried off
  f.changeHappiness(-0.05 * bond);
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 3;
  _sepSay(f, f.growth < 1 ? "TAKEN_FOAL" : "TAKEN", top[0].f);
  // Those left behind who saw it
  for (const { f: o } of left) {
    if (o.currentStateKey === "SLEEPING" || !o.canSee()) continue;
    const w = attachmentTo(o, f);
    if (w <= 0) continue;
    o.changeHappiness(-0.08 * w);
    // (tiny foals won't remember who did it)
    if (remembersBeingTaken(o)) {
      if (typeof changePlayerFear === "function") changePlayerFear(o, 0.08 * w);
      if (typeof rememberPlayerEvent === "function" && w >= 0.6) rememberPlayerEvent(o, "took_family");
    }
    if (Math.random() < 0.6) _sepSay(o, "LEFT_BEHIND", f);
  }
}

// Is someone it misses close by?
function _reunited(f) {
  const s = f.separation;
  for (const o of fluffies) {
    if (!o.isAlive || o.scene !== f.scene || !s.ids.includes(o.id)) continue;
    if (Math.hypot(o.x - f.x, o.y - f.y) < REUNITE_DIST) return o;
  }
  return null;
}

function _anyAlive(s) {
  return fluffies.some((o) => o.isAlive && s.ids.includes(o.id));
}

// script.js updateSimulation; works once a second
function updateSeparations(dt) {
  const step = separationTicker.step(dt); // seconds since last time, or 0 (Systems.js)
  if (!step) return;
  const now = timePlayed;
  for (const f of fluffies) {
    if (f.isAlive && Array.isArray(f.traumas) && f.traumas.length) _traumaEffects(f, step);
  }
  for (const f of fluffies) {
    const s = f.separation;
    if (!s) continue;
    if (!f.isAlive || !Array.isArray(s.ids)) {
      f.separation = null;
      continue;
    }
    // Back together
    const found = _reunited(f);
    if (found) {
      if (s.grief > 0.15) {
        f.changeHappiness(0.1 + 0.1 * s.grief);
        _sepSay(f, "REUNITED", found);
        if (found.canSee() && Math.random() < 0.7) _sepSay(found, "REUNITED", f);
      }
      f.separation = null;
      continue;
    }
    const apart = now - s.since;
    // Tiny foals get over it much sooner
    const hold = s.young ? GRIEF_HOLD / 5 : GRIEF_HOLD;
    if (apart < hold && _anyAlive(s)) {
      s.grief = Math.min(s.bond, s.grief + (s.bond * step) / GRIEF_BUILD);
    } else {
      s.grief = Math.max(0, s.grief - step / (s.young ? GRIEF_FADE / 5 : GRIEF_FADE));
    }
    // Missing them hurts
    if (s.grief > 0.05 && f.happiness > WAN_DIE_THRESHOLD + 0.05) f.changeHappiness(-0.0012 * s.grief * step);
    if (s.grief > 0.2 && Math.random() < 0.01 * s.grief * step) _sepSay(f, f.growth < 1 ? "MISS_FOAL" : "MISS");
    // Deep grief: it blames you
    if (!s.traumatised && !s.young && s.grief >= TRAUMA_AT) {
      s.traumatised = true;
      if (typeof changePlayerFear === "function") changePlayerFear(f, 0.2 * s.grief);
      if (typeof changePlayerTrust === "function") changePlayerTrust(f, -0.2 * s.grief);
      if (typeof rememberPlayerEvent === "function")
        rememberPlayerEvent(f, f.growth < 1 ? "taken_from_mum" : "taken_away");
      f.changeHappiness(-0.1);
      // A foal torn from its living mum carries it for life
      if (s.how === "peaceful" && f.growth < 1 && s.ids.includes(f.motherId) && _isDeadParent(f.motherId) === false)
        addTrauma(f, "torn_from_mum");
    }
    // Got over it
    if (apart > hold && s.grief <= 0) {
      // It's not part of that herd any more
      if (s.herdId !== null && typeof herdOf === "function") {
        const h = herdOf(f);
        if (h && h.id === s.herdId && typeof _leave === "function") _leave(h, f, true);
      }
      f.separation = null;
    }
  }
}

// Permanent scars, once a second
function _traumaEffects(f, step) {
  const load = traumaLoad(f);
  const blame = traumaLoad(f, true);
  if (f.happiness > WAN_DIE_THRESHOLD + 0.05) f.changeHappiness(-0.0004 * load * step);
  if (blame > 0 && typeof ensurePlayerMemory === "function") {
    ensurePlayerMemory(f);
    f.playerFear = Math.max(f.playerFear, 0.5 * blame);
    f.playerTrust = Math.min(f.playerTrust, 1 - 0.6 * blame);
  }
  // Nightmares
  if (f.currentStateKey === "SLEEPING" && Math.random() < 0.004 * load * step) {
    f.expressionOverride = "CRYING_SHOCKED";
    f.expressionOverrideTimer = 2.5;
    f.changeHappiness(-0.02);
    if (!f.tooYoungToSpeak() && typeof getDialogue === "function")
      f.speak(getDialogue(["SEPARATION", "NIGHTMARE"], f), true);
  }
}

// Magnifying glass: "Misses Daisy, Clover (a lot)" or null
function describeSeparation(f) {
  const s = f && f.separation;
  if (!s || s.grief < 0.05 || !s.names) return null;
  const how = s.grief > 0.6 ? "terribly" : s.grief > 0.3 ? "a lot" : "a little";
  const who = s.names.slice(0, 2).join(", ") + (s.names.length > 2 ? "..." : "");
  return `${who} (${how})`;
}

// Runs every simulation step (Systems.js)
registerSystem("separation", updateSeparations, 60);
