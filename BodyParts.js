// ---------------------------------------------------------------------------
// Body parts and bodies (plan; players' requests in the author's thread):
//
//   Carry them about   a body part you're holding comes with you to another
//                      room - with the keys, or tapping another room's wall
//                      hint (UI.js) - like anything else you carry.
//   What you bring     a part set down near fluffies frightens them, a head
//                      most (onBodyPartDropped). Family or a special friend
//                      know whose it is: they cry, grieve and remember it,
//                      as on seeing the body. One too young or too simple to
//                      understand death is only puzzled; one used to blood
//                      (bloodTolerance) minds less.
//   Cutting up bodies  the knife or scalpel on a body lying on a table (only
//                      on a table: Brady's rule) takes a part off - the one
//                      you click, if it's still there - as a part you can
//                      pick up. Little blood: it's dead. With nothing left
//                      to take it comes apart into head and torso, as when
//                      it's eaten. Those watching react as to the part.
//   Chirpies and metal a chirpy in earshot of a TV on heavy metal cries,
//                      trembles and crawls to its mum (riding on her back,
//                      it hides its face). A little more used to it each
//                      time (f.metalUsed, saved).
// Parts know whose they were: Gib.ownerId (HorseAnatomy.spawnGib, Surgery).
// ---------------------------------------------------------------------------

const PART_SEE = 340; // px: fluffies this close react to a part set down
const PART_REACT_GAP = 20; // game seconds: one fluffy reacts to parts at most this often
const PART_SAD = { head: 0.12, torso: 0.08, part: 0.05 }; // a stranger's
const PART_GRIEF = { head: 0.25, torso: 0.18, part: 0.12 }; // family's
const PART_CLOSE = ["mother", "father", "baby_child", "child", "dead_baby_child", "dead_mother", "sister", "brother", "special_friend", "forgotten_special_friend"];
const METAL_EARSHOT = 520; // px
const METAL_GET_USED = 0.12; // each time it hears it

if (typeof MEMORY_TEXT !== "undefined") MEMORY_TEXT.body_part = "Shown what was left of one it loved";
if (typeof MEMORY_HARM_TYPES !== "undefined") MEMORY_HARM_TYPES.add("body_part");

function bodyPartKind(g) {
  return g && g.type === "head" ? "head" : g && g.type === "torso" ? "torso" : "part";
}

// Was the part's fluffy close to o? (family, special friend, or a buddy)
function partWasClose(o, ownerId) {
  if (ownerId === null || ownerId === undefined) return false;
  const rel = typeof relationships !== "undefined" && relationships[o.id] ? relationships[o.id][ownerId] : null;
  if (rel && PART_CLOSE.includes(rel)) return true;
  const op = o.opinions ? o.opinions[ownerId] : undefined;
  return typeof op === "number" && typeof OPINION_BUDDY === "number" && op >= OPINION_BUDDY;
}

// One fluffy seeing a part. Returns "grief", "fright", "puzzled" or null.
function reactToBodyPart(o, g) {
  if (!o || !o.isAlive || o.isDragging || o.currentStateKey === "SLEEPING" || !o.canSee()) return null;
  if (o.happiness <= WAN_DIE_THRESHOLD) return null;
  const now = timePlayed;
  if (now - (o._partSeenAt ?? -Infinity) < PART_REACT_GAP) return null;
  o._partSeenAt = now;
  const kind = bodyPartKind(g);
  const owner = g.ownerId != null ? fluffyById(g.ownerId) : null;
  const talk = !o.tooYoungToSpeak();
  // Too young or too simple to understand death: only puzzled
  if (typeof understandsDeath === "function" && !understandsDeath(o)) {
    if (talk && Math.random() < 0.7) o.speak(getDialogue(["PARTS", "PUZZLED"], o, owner));
    return "puzzled";
  }
  // Family and friends know whose it is
  if (partWasClose(o, g.ownerId) && !(owner && typeof shrugsOffAlicornDeath === "function" && shrugsOffAlicornDeath(o, owner))) {
    o.changeHappiness(-PART_GRIEF[kind], `Saw what was left of ${typeof fluffyDisplayNameById === "function" ? fluffyDisplayNameById(g.ownerId, "a loved one") : "a loved one"}`);
    o.expressionOverride = "CRYING_SHOCKED";
    o.expressionOverrideTimer = 5;
    o.setShock(3);
    o.bloodReactionTimer = Math.max(o.bloodReactionTimer || 0, 8);
    if (talk) o.speak(getDialogue(["PARTS", kind === "head" ? "GRIEF_HEAD" : "GRIEF"], o, owner), true);
    // ...and remembers who brought it
    if (typeof rememberPlayerEvent === "function") rememberPlayerEvent(o, "body_part");
    if (typeof changePlayerFear === "function") changePlayerFear(o, kind === "head" ? 0.08 : 0.04);
    if (o.traumaMemory) o.traumaMemory.push({ type: "body_part", timer: 30 + Math.random() * 60 });
    return "grief";
  }
  // Anyone else: frightened (less so if it's used to blood)
  const used = Math.max(0, Math.min(1, o.bloodTolerance || 0));
  if (Math.random() < used * 0.8) return null;
  o.changeHappiness(-PART_SAD[kind] * (1 - used), "Saw a body part");
  o.setShock(kind === "head" ? 3 : 2);
  o.isScared = true;
  o.scaredTimer = Math.max(o.scaredTimer || 0, kind === "head" ? 5 : 3);
  o.bloodReactionTimer = Math.max(o.bloodReactionTimer || 0, 5);
  if (talk && Math.random() < 0.8) o.speak(getDialogue(["PARTS", kind === "head" ? "SCARED_HEAD" : "SCARED"], o, owner));
  if (o.positioning && typeof o.positioning.getRunawayTarget === "function" && !o.placedOn && !o.currentCage) {
    const away = o.positioning.getRunawayTarget(g.x, g.y);
    o.initBehavior(typeof canRun === "function" && canRun(o) ? "RUNNING" : "MOVING");
    o.setTargetPosition(away.x, away.y);
  }
  return "fright";
}

// Gib.onDrop (and a part cut off a body): those near it react
function onBodyPartDropped(g) {
  if (!g || g.grinder || typeof fluffies === "undefined") return 0;
  let n = 0;
  for (const o of fluffies) {
    if (o.scene !== g.scene || o.id === g.ownerId) continue;
    if (Math.hypot(o.x - g.x, o.y - g.y) > PART_SEE) continue;
    if (reactToBodyPart(o, g)) n++;
  }
  return n;
}

// ---- Cutting up a body (the knife or scalpel: script.js attemptDrop) ----

const _CUT_ORDER = ["leg_0", "leg_1", "leg_2", "leg_3", "tail", "leftEar", "rightEar", "special_lumps", "horse_udders"];

function _cutAvailable(body) {
  const l = body.limbs || {};
  return _CUT_ORDER.filter((p) => {
    if (p === "tail") return l.tail;
    if (p === "special_lumps") return l.lumps;
    if (p === "horse_udders") return l.udders;
    if (p === "leftEar") return l.leftEar;
    if (p === "rightEar") return l.rightEar;
    if (p.startsWith("leg_")) return l.legs && l.legs[parseInt(p.slice(4), 10)];
    return false;
  });
}

function bodyOnTable(body) {
  return !!(body && body.placedOn && typeof FluffyTable !== "undefined" && body.placedOn instanceof FluffyTable);
}

// The body under (x, y) in this area, or null
function bodyAt(scene, x, y) {
  if (typeof fluffies === "undefined") return null;
  for (let i = fluffies.length - 1; i >= 0; i--) {
    const f = fluffies[i];
    if (f.isAlive || f.isDestroyed || f.buried || f.scene !== scene) continue;
    if (f.hitTestAsSeen(x, y)) return f;
  }
  return null;
}

// Takes one part off a body on a table. Returns the part's gib(s), or null.
function cutBody(body, knife, clickedPart = null) {
  if (!body || body.isAlive || body.isDestroyed || !bodyOnTable(body)) return null;
  if (body.renderer && typeof body.renderer.ensureTintedImages === "function") body.renderer.ensureTintedImages();
  if (typeof playSound === "function") playSound("knife");
  const avail = _cutAvailable(body);
  const out = [];
  if (avail.length) {
    let part = avail[0];
    if (clickedPart) {
      const c = String(clickedPart);
      const hit = avail.find((p) => p === c || (c.startsWith("leg") && p.startsWith("leg") && c.slice(-1) === p.slice(-1)) || (c.includes("Ear") && p === c) || (c === "lumps" && p === "special_lumps") || (c === "udders" && p === "horse_udders"));
      if (hit) part = hit;
    }
    body.anatomy.amputate(part, knife || { type: "scalpel" });
    body.bleedingTimer = 0; // (it's dead)
    let gibType = "part";
    if (part.startsWith("leg")) gibType = "leg";
    else if (part === "special_lumps") gibType = "special_lumps";
    else if (part === "horse_udders") gibType = "horse_udders";
    else if (part === "tail") gibType = "tail";
    else if (part.includes("Ear")) gibType = "ear";
    const g = body.anatomy.spawnGib(gibType);
    if (g) out.push(g);
  } else {
    // Nothing left to take: it comes apart
    const h = body.anatomy.spawnGib("head");
    const t = body.anatomy.spawnGib("torso");
    if (h) out.push(h);
    if (t) out.push(t);
    body.isDestroyed = true;
    if (body.placedOn && body.placedOn.securedFluffy === body) body.placedOn.securedFluffy = null;
    body.placedOn = null;
  }
  // A little blood
  if (typeof addPointToPuddle === "function") addPointToPuddle(body.scene, body.x, body.getBottomY ? body.getBottomY() : body.y, "blood", 2 / 200, 10 / 200);
  if (typeof poofs !== "undefined" && typeof Poof !== "undefined") poofs.push(new Poof(body.x, body.y, body.scene, "#8a0303"));
  for (const g of out) {
    g.ownerId = body.id;
    onBodyPartDropped(g);
  }
  return out;
}

// script.js: the knife or scalpel clicked on a body. True if it was one.
function cutBodyAt(knife, x, y) {
  const body = bodyAt(knife.scene, x, y);
  if (!body) return false;
  if (!bodyOnTable(body)) {
    if (typeof addUIMessage === "function") addUIMessage("Put the body on a table to cut it up.");
    return true;
  }
  const part = body.hitTestAsSeen(x, y);
  cutBody(body, knife, typeof part === "string" ? part : null);
  return true;
}

// ---- Chirpies and heavy metal (FluffTV._triggerFocusReactions) ----

function chirpiesHearMetal(tv) {
  if (!tv || typeof fluffies === "undefined") return 0;
  let n = 0;
  for (const f of fluffies) {
    if (!f.isAlive || f.scene !== tv.scene || !f.tooYoungToSpeak() || f.currentStateKey === "SLEEPING") continue;
    if (typeof f.canHear === "function" && !f.canHear()) continue;
    if (Math.hypot(f.x - tv.x, f.y - tv.y) > METAL_EARSHOT) continue;
    const used = Math.max(0, Math.min(1, f.metalUsed || 0));
    f.metalUsed = Math.min(1, used + METAL_GET_USED);
    if (Math.random() < used) continue; // (used to it now)
    n++;
    f.speak(getDialogue(["PARTS", "METAL_CHIRPY"], f), true, true);
    f.expressionOverride = "CRYING_SHOCKED";
    f.expressionOverrideTimer = 4;
    f.isScared = true;
    f.scaredTimer = Math.max(f.scaredTimer || 0, 4);
    f._trembleUntil = timePlayed + 4;
    if (f._riding) continue; // (on mum's back: it hides its face in her fluff)
    const mum = f.motherId != null ? fluffyById(f.motherId) : null;
    if (mum && mum.isAlive && mum.scene === f.scene && !mum.currentCage === !f.currentCage && !f.placedOn && !f.isDragging) {
      f.initBehavior("MOVING");
      f.setTargetPosition(mum.x + (mum.x > f.x ? -25 : 25), mum.y);
      if (typeof f.constrainTargetToCage === "function") f.constrainTargetToCage();
    }
  }
  return n;
}
