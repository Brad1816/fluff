// ---------------------------------------------------------------------------
// You, on a pest job (Exterminator.js): a little figure in coveralls and a
// cap, walking the site.
//
// Moving: WASD / the arrow keys; on a phone the stick at the bottom left, or
// tap where to go. Walk off an edge where there's an arrow and you're in the
// next room (whatever you're carrying comes too).
// Grab (E, or the Grab button; or tap the thing):
//   - near a loose fluffy: pick it up (arms full: one grown-up or two foals)
//   - holding some, near a crate: put them in it (EXT_CRATE_MAX)
//   - empty-handed, near a crate: pick the crate up (and what's in it)
//   - carrying a crate, near a fluffy: straight into the crate
//   - at a hay bale, a bush or a crate where something's hiding: flush it out
//   - at the van: load what you're carrying (fluffies, or a crate's worth);
//     with nothing to load, the van asks if you're done (going home ends it)
// Phase 2 adds Q (Tool): the brutal kit.
// The fluffies you hold are carried at your side (f.extHeld); your position
// and what you hold are saved in extState.active.player.
// ---------------------------------------------------------------------------

const EXT_SPEED = 230; // px a second (a running fluffy does about 175)
const EXT_SPEED_CRATE = 170;
const EXT_REACH = 75;
const EXT_ARMS = 1; // grown-ups (a foal is half)
const EXT_CRATE_MAX = 6;
const EXT_CRATES = 2;
const EXT_VAN_REACH = 140;
const EXT_SEARCH_REACH = 80;
const EXT_BAG_MAX = 6;
const EXT_BAG_SLOW = 0.06; // a body
const EXT_BAIT = 3; // bait trays a job
const EXT_TRAPS = 3; // glue traps a job

// The figure (not saved as an object: extState.active.player)
let extPlayer = null; // { scene, x, y, tx, ty, facing, walk, holding: [ids], crate: id }
const _extKeys = { left: false, right: false, up: false, down: false };
let _extStick = { x: 0, y: 0 };

function placeExtPlayer(scene, x, y) {
  extPlayer = { scene, x, y, tx: null, ty: null, facing: 1, walk: 0, holding: [], crate: null, act: null };
  if (_extActive()) _extActive().player = extPlayer;
}
function clearExtPlayer() {
  extPlayer = null;
  _hideExtTouchControls();
}
function _extP() {
  const job = typeof _extActive === "function" ? _extActive() : null;
  if (!job) return null;
  if (!extPlayer && job.player) extPlayer = job.player;
  if (extPlayer && job.player !== extPlayer) job.player = extPlayer;
  return extPlayer;
}
function extOnSite() {
  const p = _extP();
  return !!(p && isJobScene(currentScene));
}

// ---- Crates ----
class TransportCrate extends Cage {
  constructor(scene) {
    super(scene);
    this.scale = 0.62;
    this.isTransportCrate = true;
  }
  causesUnhappiness() {
    return true;
  }
  getSellValue() {
    return 0;
  }
  accepts() {
    return this.getOccupants().length < EXT_CRATE_MAX;
  }
  cycleTag() {}
  serialize() {
    return { ...super.serialize(), classType: "TransportCrate" };
  }
}

function makeExtCrates(scene) {
  for (let i = 0; i < EXT_CRATES; i++) {
    const c = new TransportCrate(scene);
    c.x = extVanSpot().x + 230 + i * 160;
    c.y = extVanSpot().y + 40;
    c.updateBounds();
    objects.push(c);
  }
}
function _extCrates(scene = currentScene) {
  return objects.filter((o) => o instanceof TransportCrate && o.scene === scene);
}
function _extCrateHeld() {
  const p = _extP();
  return p && p.crate != null ? objects.find((o) => o.id === p.crate) || null : null;
}

// ---- Holding fluffies ----
function _extHeld() {
  const p = _extP();
  if (!p) return [];
  return p.holding.map((id) => fluffyById(id)).filter((f) => f && f.isAlive);
}
function _extArmsUsed() {
  return _extHeld().reduce((n, f) => n + (f.growth >= 1 ? 1 : 0.5), 0);
}

function extCanGrab(f) {
  const p = _extP();
  return !!(p && f && f.isAlive && f.scene === p.scene && !f.extHeld && !f.currentCage && !(f.hiddenBy != null) && !f.isDragging);
}

function extGrab(f) {
  const p = _extP();
  if (!extCanGrab(f)) return false;
  const crate = _extCrateHeld();
  if (crate) return _extIntoCrate(f, crate);
  const need = f.growth >= 1 ? 1 : 0.5;
  if (_extArmsUsed() + need > EXT_ARMS) {
    if (typeof addUIMessage === "function") addUIMessage("Your arms are full - put them in a crate or the van.");
    return false;
  }
  if (typeof isGluedDown === "function" && isGluedDown(f) && typeof tearOffGlueTrap === "function") tearOffGlueTrap(f);
  f.extHeld = true;
  f.extCling = false;
  p.holding.push(f.id);
  f.targetX = null;
  f.targetY = null;
  if (typeof f.initBehavior === "function") f.initBehavior("IDLE");
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["EXTERMINATOR", "GRABBED"], f), true);
  if (typeof onExtCaught === "function") onExtCaught(f);
  return true;
}

function _extIntoCrate(f, crate) {
  if (!crate.accepts(f)) {
    if (typeof addUIMessage === "function") addUIMessage("That crate's full.");
    return false;
  }
  const p = _extP();
  if (f.extHeld) {
    f.extHeld = false;
    p.holding = p.holding.filter((id) => id !== f.id);
  }
  f.scene = crate.scene;
  f.currentCage = crate;
  crate.updateBounds();
  f.x = crate.x + (Math.random() - 0.5) * (crate.bounds.right - crate.bounds.left - 40);
  f.y = crate.bounds.bottom - 12;
  f.targetX = null;
  f.targetY = null;
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["EXTERMINATOR", "CRATED"], f), true);
  if (typeof onExtCaught === "function") onExtCaught(f);
  return true;
}

// Into the van: counted, off the site
function _extLoad(f) {
  const job = _extActive();
  if (!job || !f) return false;
  if (f.clientPet != null) {
    job.petTaken = true;
    if (typeof addUIMessage === "function") addUIMessage("That's the client's own fluffy!");
  }
  f.extHeld = false;
  f.currentCage = null;
  const data = JSON.parse(JSON.stringify(f.serialize()));
  job.loaded.push(data);
  const i = fluffies.indexOf(f);
  if (i >= 0) fluffies.splice(i, 1);
  return true;
}

function _extNear(list, x, y, reach) {
  let best = null;
  let bd = reach;
  for (const o of list) {
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

function _extAtVan(p = _extP()) {
  const site = jobSite();
  if (!p || !site || p.scene !== site.rooms[0].scene) return false;
  const v = extVanSpot();
  return Math.hypot(p.x - v.x, p.y - v.y) < EXT_VAN_REACH + 40;
}

// What Grab would do here: { kind, target, label } or null
function extGrabAction() {
  const p = _extP();
  if (!p) return null;
  const held = _extHeld();
  const crate = _extCrateHeld();
  if (_extAtVan(p)) {
    if (p.bag) return { kind: "load_bag", label: `Load the bodies (${p.bag})` };
    if (held.length) return { kind: "load_held", label: "Load the van" };
    if (crate) return { kind: "load_crate", label: crate.getOccupants().length ? "Load the crate" : "Put the crate back", target: crate };
  }
  // Something hiding where you're standing
  const hid = typeof extHiddenNear === "function" ? extHiddenNear(p.scene, p.x, p.y, EXT_SEARCH_REACH) : null;
  if (hid) return { kind: "search", label: "Search", target: hid };
  // One hanging off your leg comes first: grab it - or with your hands full,
  // shake it off
  const clinger = typeof _extClingers === "function" ? _extNear(_extClingers(p), p.x, p.y - 20, EXT_REACH * 2) : null;
  if (clinger) {
    if (crate || _extArmsUsed() + (clinger.growth >= 1 ? 1 : 0.5) <= EXT_ARMS) return { kind: "grab", label: crate ? "Into the crate" : "Pull it off", target: clinger };
    return { kind: "shake", label: "Shake it off", target: clinger };
  }
  const loose = fluffies.filter((f) => extCanGrab(f) && f.isAlive);
  const f = _extNear(loose, p.x, p.y - 20, EXT_REACH);
  if (f && (crate || _extArmsUsed() + (f.growth >= 1 ? 1 : 0.5) <= EXT_ARMS)) return { kind: "grab", label: crate ? "Into the crate" : "Grab", target: f };
  const near = _extNear(_extCrates(p.scene).filter((c) => c !== crate), p.x, p.y, EXT_REACH + 30);
  if (near && held.length) return { kind: "crate_in", label: "Into the crate", target: near };
  if (near && !crate && !held.length) return { kind: "crate_lift", label: "Pick up the crate", target: near };
  if (crate) return { kind: "crate_down", label: "Put the crate down", target: crate };
  if (_extAtVan(p)) return { kind: "home", label: "Done? (van)" };
  if (held.length === 1 && typeof extCanAsk === "function" && extCanAsk(held[0])) return { kind: "ask", label: "Ask where the rest are", target: held[0] };
  if (f) return { kind: "full", label: "Arms full", target: f };
  return null;
}

function extDoGrab() {
  const a = extGrabAction();
  const p = _extP();
  if (!a || !p) return false;
  if (a.kind === "grab") return extGrab(a.target);
  if (a.kind === "ask") return !!(typeof extAsk === "function" && extAsk(a.target));
  if (a.kind === "shake") {
    p.bumped = 0.3;
    return typeof extUncling === "function" ? extUncling(a.target, true) : false;
  }
  if (a.kind === "search") return typeof extFlushOut === "function" ? extFlushOut(a.target) : false;
  if (a.kind === "crate_in") {
    for (const f of _extHeld()) _extIntoCrate(f, a.target);
    return true;
  }
  if (a.kind === "crate_lift") {
    p.crate = a.target.id;
    return true;
  }
  if (a.kind === "crate_down") {
    p.crate = null;
    return true;
  }
  if (a.kind === "load_bag") {
    const job = _extActive();
    job.bodies = (job.bodies || 0) + p.bag;
    p.bag = 0;
    _extLoadedMsg();
    return true;
  }
  if (a.kind === "load_held") {
    for (const f of _extHeld()) _extLoad(f);
    p.holding = [];
    _extLoadedMsg();
    return true;
  }
  if (a.kind === "load_crate") {
    for (const f of a.target.getOccupants()) _extLoad(f);
    p.crate = null;
    const v = extVanSpot();
    a.target.x = v.x + 230 + (_extCrates(a.target.scene).indexOf(a.target) % 2) * 160;
    a.target.y = v.y + 40;
    a.target.updateBounds();
    _extLoadedMsg();
    return true;
  }
  if (a.kind === "home") {
    if (typeof askEndExtJob === "function") askEndExtJob();
    return true;
  }
  return false;
}

function _extLoadedMsg() {
  const p = extJobProgress();
  if (p && typeof addUIMessage === "function") addUIMessage(`In the van: ${p.caught} caught${p.bodies ? `, ${p.bodies} bodies` : ""}. ${p.left} left on the site.`);
}

// ---- The tool (Q): the brutal kit ----
// Near a loose fluffy: cull it. Near a body: into the bag. Nothing near: put
// down bait (rat poison in a tray) or a glue trap - C (or Kit) switches.
function extToolAction() {
  const p = _extP();
  if (!p) return null;
  const job = _extActive();
  const live = fluffies.filter((f) => f.isAlive && f.scene === p.scene && !f.extHeld && !(f.hiddenBy != null) && !(f.currentCage && !f.currentCage.isTransportCrate));
  const f = _extNear(live, p.x, p.y - 20, EXT_REACH + 10);
  if (f) return { kind: "cull", label: "Cull", target: f };
  const dead = fluffies.filter((o) => !o.isAlive && o.scene === p.scene && !o.isDragging);
  const body = _extNear(dead, p.x, p.y - 10, EXT_REACH + 10);
  if (body) return p.bag >= EXT_BAG_MAX ? { kind: "bag_full", label: "Bag's full" } : { kind: "bag", label: "Bag it", target: body };
  const kit = p.kit || "bait";
  const left = kit === "bait" ? EXT_BAIT - (job.baitUsed || 0) : EXT_TRAPS - (job.trapsUsed || 0);
  if (left > 0) return { kind: "place", label: kit === "bait" ? `Put down bait (${left})` : `Put down a glue trap (${left})`, kit };
  return { kind: "none", label: kit === "bait" ? "No bait left" : "No traps left" };
}

function extUseTool() {
  const a = extToolAction();
  const p = _extP();
  const job = _extActive();
  if (!a || !p || !job) return false;
  if (a.kind === "cull") return extCull(a.target);
  if (a.kind === "bag") {
    const i = fluffies.indexOf(a.target);
    if (i >= 0) fluffies.splice(i, 1);
    if (a.target.clientPet != null) job.petKilled = true;
    if (a.target.growth < 1 && a.target.jobFeral === job.id && !a.target._extCounted) job.foalsKilled = (job.foalsKilled || 0) + 1;
    p.bag = (p.bag || 0) + 1;
    return true;
  }
  if (a.kind === "place") {
    if (a.kit === "bait") {
      const b = new Bowl("bowl", p.scene);
      b.x = p.x + p.facing * 40;
      b.y = p.y + 4;
      b.fill(3, "rat_poison");
      b.extBait = true;
      objects.push(b);
      job.baitUsed = (job.baitUsed || 0) + 1;
    } else if (typeof GlueTrap !== "undefined") {
      const t = new GlueTrap(p.scene);
      t.setPosition(p.x + p.facing * 50, p.y + 4);
      objects.push(t);
      job.trapsUsed = (job.trapsUsed || 0) + 1;
    }
    return true;
  }
  if (typeof addUIMessage === "function" && a.label) addUIMessage(a.label + ".");
  return false;
}

function extSwitchKit() {
  const p = _extP();
  if (!p) return;
  p.kit = (p.kit || "bait") === "bait" ? "trap" : "bait";
  if (typeof addUIMessage === "function") addUIMessage(p.kit === "bait" ? "Kit: poison bait." : "Kit: glue traps.");
}

function extCull(f) {
  const p = _extP();
  const job = _extActive();
  if (!f || !f.isAlive || !p || !job) return false;
  p.swing = 0.35;
  p.facing = f.x > p.x ? 1 : -1;
  if (typeof isGluedDown === "function" && isGluedDown(f) && typeof _glueRelease === "function") _glueRelease(f);
  f.extCling = false;
  f.die("exterminator", "Exterminated");
  job.killed = (job.killed || 0) + 1;
  if (f.growth < 1) {
    job.foalsKilled = (job.foalsKilled || 0) + 1;
    f._extCounted = true;
  }
  if (typeof addPointToPuddle === "function") addPointToPuddle(f.scene, f.x, f.y, "#8a0303", 0.1, 0.25, 0.7);
  if (typeof playSound === "function") playSound("amputation", 0.4);
  if (job.humane && !job.angry) {
    job.angry = true;
    if (typeof addUIMessage === "function") addUIMessage(`${job.who} asked you not to hurt them...`);
  }
  if (f.clientPet != null) {
    job.petKilled = true;
    if (typeof addUIMessage === "function") addUIMessage("That was the client's own fluffy!");
  }
  if (typeof onExtCaught === "function") onExtCaught(f, true);
  return true;
}

// ---- Moving ----
function _extMoveTo(scene, x, y) {
  const p = _extP();
  const old = p.scene;
  // (whatever's hanging off your legs comes too)
  for (const f of fluffies) if (f.extCling && f.isAlive && f.scene === old) f.scene = scene;
  p.scene = scene;
  p.x = x;
  p.y = y;
  p.tx = null;
  p.ty = null;
  for (const f of _extHeld()) {
    f.scene = scene;
    f.x = x;
    f.y = y;
  }
  const crate = _extCrateHeld();
  if (crate) {
    for (const f of crate.getOccupants()) f.scene = scene;
    crate.scene = scene;
  }
  if (old !== scene && currentScene === old) changeScene(scene);
}

function updateExtPlayer(dt) {
  const p = _extP();
  if (!p) {
    _hideExtTouchControls();
    return;
  }
  if (!isJobScene(currentScene)) {
    _hideExtTouchControls();
    return;
  }
  if (currentScene !== p.scene) p.scene = currentScene;
  _showExtTouchControls();
  if (typeof screenPausesGame === "function" && screenPausesGame()) return;
  if (typeof gameState !== "undefined" && gameState !== "PLAYING") return;
  // Which way
  let vx = (_extKeys.right ? 1 : 0) - (_extKeys.left ? 1 : 0) + _extStick.x;
  let vy = (_extKeys.down ? 1 : 0) - (_extKeys.up ? 1 : 0) + _extStick.y;
  if (vx || vy) {
    p.tx = null;
    p.ty = null;
  } else if (p.tx != null) {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) {
      p.tx = null;
      p.ty = null;
      // Arrived where you tapped: do what you tapped for
      if (p.act) {
        const act = p.act;
        p.act = null;
        if (act === "grab") extDoGrab();
      }
    } else {
      vx = dx / d;
      vy = dy / d;
    }
  }
  const len = Math.hypot(vx, vy);
  const clinging = (typeof extClingSlow === "function" ? extClingSlow() : 1) * Math.max(0.6, 1 - EXT_BAG_SLOW * (p.bag || 0));
  const speed = (_extCrateHeld() ? EXT_SPEED_CRATE : EXT_SPEED) * clinging;
  if (len > 0.05) {
    const k = Math.min(1, len);
    p.x += (vx / len) * speed * k * dt;
    p.y += (vy / len) * speed * k * dt;
    if (Math.abs(vx) > 0.1) p.facing = vx > 0 ? 1 : -1;
    p.walk += dt * 9;
  } else p.walk = 0;
  if (p.swing > 0) p.swing -= dt;
  if (p.bumped > 0) p.bumped -= dt;
  // Off an edge where there's a way through
  const room = jobRoomOf(p.scene);
  const top = height * 0.15;
  if (room) {
    if (p.x < 30 && room.links.left && Math.abs(p.y - height / 2) < 160) return _extMoveTo(room.links.left, width - 90, p.y);
    if (p.x > width - 30 && room.links.right && Math.abs(p.y - height / 2) < 160) return _extMoveTo(room.links.right, 90, p.y);
    if (p.y < top + 60 && room.links.up && Math.abs(p.x - width / 2) < 160) return _extMoveTo(room.links.up, p.x, height - 120);
    if (p.y > height - 30 && room.links.down && Math.abs(p.x - width / 2) < 160) return _extMoveTo(room.links.down, p.x, top + 110);
  }
  p.x = Math.max(28, Math.min(width - 28, p.x));
  p.y = Math.max(top + 60, Math.min(height - 24, p.y));
  // What you carry comes with you
  const held = _extHeld();
  held.forEach((f, i) => {
    f.scene = p.scene;
    f.x = p.x + p.facing * (30 + i * 16);
    f.y = p.y - 46; // (in your arms: drawn in front of you, script.js)
    f.targetX = null;
    f.targetY = null;
    if (f.isMovingOrRunning && f.isMovingOrRunning()) f.initBehavior("IDLE");
  });
  p.holding = held.map((f) => f.id);
  const crate = _extCrateHeld();
  if (crate) {
    const nx = p.x + p.facing * 70;
    const ny = p.y - 4;
    const dx = nx - crate.x;
    const dy = ny - crate.y;
    crate.scene = p.scene;
    crate.x = nx;
    crate.y = ny;
    crate.moveContents(dx, dy);
    crate.updateBounds();
  }
}
registerSystem("extPlayer", updateExtPlayer, 189);

// ---- Drawing the figure (script.js, with the room's things) ----
function drawExtPlayer(c) {
  const p = _extP();
  if (!p || p.scene !== currentScene) return;
  const swing = Math.sin(p.walk) * 0.5;
  c.save();
  c.translate(p.x, p.y);
  // (a fluffy kicking at your boots: a little wobble, nothing more)
  if (p.bumped > 0) c.rotate(Math.sin(p.bumped * 60) * 0.04);
  c.scale(p.facing, 1);
  // Shadow
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.beginPath();
  c.ellipse(0, 2, 30, 8, 0, 0, Math.PI * 2);
  c.fill();
  // Legs (boots)
  c.strokeStyle = "#4b5a32";
  c.lineWidth = 12;
  c.lineCap = "round";
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(s * 9, -62);
    c.lineTo(s * 9 + Math.sin(swing * s) * 18, -10);
    c.stroke();
    c.fillStyle = "#3a2a1c";
    c.fillRect(s * 9 + Math.sin(swing * s) * 18 - 9, -12, 20, 10);
  }
  // Coveralls
  c.fillStyle = "#6b7d3e";
  c.strokeStyle = "#3f4a24";
  c.lineWidth = 2.5;
  c.beginPath();
  c.roundRect ? c.roundRect(-22, -130, 44, 74, 10) : c.rect(-22, -130, 44, 74);
  c.fill();
  c.stroke();
  c.fillStyle = "#d7c94a";
  c.fillRect(-22, -92, 44, 6);
  // Arms
  c.strokeStyle = "#6b7d3e";
  c.lineWidth = 10;
  c.beginPath();
  c.moveTo(14, -120);
  c.lineTo(32 + (p.swing > 0 ? 20 : 0), -90 - (_extHeld().length ? 20 : 0) + (p.swing > 0 ? 40 : 0));
  c.moveTo(-14, -120);
  c.lineTo(-28 - swing * 10, -78);
  c.stroke();
  // Head and cap
  c.fillStyle = "#e9c3a0";
  c.beginPath();
  c.arc(0, -146, 17, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#c0392b";
  c.beginPath();
  c.arc(0, -152, 17, Math.PI, 0);
  c.fill();
  c.fillRect(4, -156, 22, 6);
  c.fillStyle = "#222";
  c.beginPath();
  c.arc(8, -146, 2.2, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// What Grab would do, over your head
function drawExtPlayerHud(c) {
  const p = _extP();
  if (!p || p.scene !== currentScene) return;
  const a = extGrabAction();
  const t = extToolAction();
  const touch = typeof touchMode !== "undefined" && touchMode;
  const parts = [];
  if (a && a.kind !== "full") parts.push((touch ? "Grab: " : "E: ") + a.label);
  if (t && (t.kind === "cull" || t.kind === "bag" || t.kind === "bag_full")) parts.push((touch ? "Tool: " : "Q: ") + t.label);
  if (!parts.length) return;
  const label = parts.join("   ");
  c.save();
  c.font = "bold 13px Arial";
  const w = c.measureText(label).width + 16;
  c.fillStyle = "rgba(20, 16, 30, 0.85)";
  if (typeof fillRoundRect === "function") fillRoundRect(c, p.x - w / 2, p.y - 196, w, 22, 9);
  c.fillStyle = "white";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(label, p.x, p.y - 185);
  c.restore();
}

// The job panel at the top (screen pass)
function drawExtJobPanel(c) {
  if (!extOnSite()) return;
  const job = _extActive();
  const p = extJobProgress(job);
  const left = Math.max(0, job.due - timePlayed);
  const hrs = Math.floor(left / HOUR_LENGTH);
  const mins = Math.floor(((left % HOUR_LENGTH) / HOUR_LENGTH) * 60);
  const req = typeof EXT_REQUESTS !== "undefined" && EXT_REQUESTS[job.request];
  const reqOk = req ? extRequestResult(job) : null;
  const lines = [
    `${job.who} · ${jobRoomName(currentScene)}`,
    `Dealt with ${p.caught + p.bodies}/${job.herd} · ${p.left} loose · ${p.late ? "LATE" : `${hrs}h ${String(mins).padStart(2, "0")}m left`}`,
  ];
  if (req) lines.push(`Request: ${req.short} - ${reqOk ? (req.rule ? "kept so far" : "done!") : req.rule ? "BROKEN" : "not yet"}`);
  // What you can hear next door, and where a fluffy pointed
  const arrows = { left: "\u2190", right: "\u2192", up: "\u2191", down: "\u2193" };
  const heard = typeof extRoomSounds === "function" ? extRoomSounds(currentScene) : [];
  const extra = [];
  if (heard.length) extra.push("You hear " + heard.map((h) => `${h.kind} ${arrows[h.dir] || ""} ${h.name}`).join(", "));
  const me = _extP();
  if (me && me.tip && timePlayed - me.tip.at < HOUR_LENGTH) extra.push(`It pointed: ${jobRoomName(me.tip.scene)}`);
  const x = 10;
  const y = 104;
  const boxH0 = 12 + lines.length * 18;
  const boxH = boxH0 + extra.length * 18;
  c.save();
  c.font = "bold 13px Arial";
  const w = Math.max(...lines.concat(extra).map((l) => c.measureText(l).width)) + 20;
  c.fillStyle = "rgba(20, 16, 30, 0.8)";
  if (typeof fillRoundRect === "function") fillRoundRect(c, x, y, w, boxH, 10);
  c.fillStyle = "white";
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillText(lines[0], x + 10, y + 14);
  c.font = "12px Arial";
  c.fillStyle = p.late ? "#ff8a8a" : "#e8e0f4";
  c.fillText(lines[1], x + 10, y + 34);
  if (req) {
    c.fillStyle = reqOk ? "#9be89b" : req.rule ? "#ff8a8a" : "#ffd38a";
    c.fillText(lines[2], x + 10, y + 52);
  }
  extra.forEach((t, i) => {
    c.fillStyle = "#bfe3ff";
    c.fillText(t, x + 10, y + boxH0 + 4 + i * 18);
  });
  // Head home
  const b = extHomeButton();
  c.fillStyle = isPointInRect(mouse.sx ?? mouse.x, mouse.sy ?? mouse.y, b.x, b.y, b.w, b.h) ? "rgba(190, 60, 60, 0.95)" : "rgba(150, 40, 45, 0.9)";
  if (typeof fillRoundRect === "function") fillRoundRect(c, b.x, b.y, b.w, b.h, 9);
  c.fillStyle = "white";
  c.font = "bold 13px Arial";
  c.textAlign = "center";
  c.fillText("Head home", b.x + b.w / 2, b.y + b.h / 2 + 1);
  c.font = "12px Arial";
  c.textAlign = "left";
  c.fillStyle = "rgba(255,255,255,0.75)";
  let ly = y + boxH + 14;
  if (!(typeof touchMode !== "undefined" && touchMode)) {
    c.fillText(`WASD / arrows: walk · E: grab · Q: tool (${(_extP().kit || "bait") === "bait" ? "bait" : "glue traps"}) · C: switch kit · click: walk there`, x + 2, ly);
    ly += 18;
  }
  if (_extP().bag) {
    c.fillText(`Body bag: ${_extP().bag}/${EXT_BAG_MAX}`, x + 2, ly);
    ly += 18;
  }
  const cling = typeof _extClingers === "function" ? _extClingers().length : 0;
  if (cling) {
    c.fillStyle = "#ffd38a";
    c.fillText(`${cling} hanging off your legs - you're slowed (Grab one off)`, x + 2, ly);
  }
  c.restore();
}
function extHomeButton() {
  return { x: width - 130, y: 104, w: 110, h: 30 };
}

// ---- Input ----
// UI.js mousedown (screen and world): on a site, a click walks you there
// (or to what you clicked, and does it). True if handled.
function extSiteClick() {
  if (!extOnSite()) return false;
  const p = _extP();
  const sm = typeof screenMouse === "function" ? screenMouse() : mouse;
  const b = extHomeButton();
  if (isPointInRect(sm.x, sm.y, b.x, b.y, b.w, b.h)) {
    askEndExtJob();
    return true;
  }
  if (mouse.rightDown) return true;
  const x = mouse.x;
  const y = mouse.y;
  // A fluffy, a crate or the van: go there and Grab
  const f = fluffies.find((o) => o.scene === p.scene && o.isAlive && !o.extHeld && o.hiddenBy == null && o.hitTestAsSeen && o.hitTestAsSeen(x, y));
  const crate = _extCrates(p.scene).find((o) => o.bounds && x >= o.bounds.left && x <= o.bounds.right && y >= o.bounds.top && y <= o.bounds.bottom);
  const v = extVanSpot();
  const van = jobSite() && p.scene === jobSite().rooms[0].scene && Math.abs(x - v.x) < 120 && y > v.y - 120 && y < v.y + 10;
  const near = (tx, ty) => Math.hypot(tx - p.x, ty - p.y) < EXT_REACH;
  if (f || crate || van) {
    const tx = f ? f.x : crate ? crate.x : v.x + 120;
    const ty = f ? f.y + 10 : crate ? crate.y + 20 : v.y;
    if (near(tx, ty)) {
      extDoGrab();
    } else {
      p.tx = tx;
      p.ty = ty;
      p.act = "grab";
    }
    return true;
  }
  p.tx = x;
  p.ty = y;
  p.act = null;
  return true;
}

// script.js keydown: on a site WASD walks (not through the room arrows)
function extKeyDown(e) {
  if (!extOnSite()) return false;
  const k = e.key && e.key.toLowerCase();
  const map = { a: "left", arrowleft: "left", d: "right", arrowright: "right", w: "up", arrowup: "up", s: "down", arrowdown: "down" };
  if (map[k]) {
    _extKeys[map[k]] = true;
    return true;
  }
  if (k === "e") {
    if (!e.repeat) extDoGrab();
    return true;
  }
  if (k === "q") {
    if (!e.repeat) extUseTool();
    return true;
  }
  if (k === "c") {
    if (!e.repeat) extSwitchKit();
    return true;
  }
  return false;
}
if (typeof window !== "undefined") {
  window.addEventListener("keyup", (e) => {
    const k = e.key && e.key.toLowerCase();
    const map = { a: "left", arrowleft: "left", d: "right", arrowright: "right", w: "up", arrowup: "up", s: "down", arrowdown: "down" };
    if (map[k]) _extKeys[map[k]] = false;
  });
  window.addEventListener("blur", () => {
    for (const k in _extKeys) _extKeys[k] = false;
    _extStick = { x: 0, y: 0 };
  });
}

// ---- Phone: a stick and buttons (DOM, so they keep their own finger) ----
let _extTouchEl = null;
function _buildExtTouchControls() {
  if (_extTouchEl || typeof document === "undefined" || !document.body) return _extTouchEl;
  const wrap = document.createElement("div");
  wrap.id = "ext-touch";
  wrap.style.cssText = "position:fixed;left:0;right:0;bottom:0;height:0;z-index:30;pointer-events:none;display:none;";
  const stick = document.createElement("div");
  stick.style.cssText = "position:fixed;left:18px;bottom:18px;width:130px;height:130px;border-radius:50%;background:rgba(20,16,30,0.35);border:2px solid rgba(255,255,255,0.35);pointer-events:auto;touch-action:none;";
  const knob = document.createElement("div");
  knob.style.cssText = "position:absolute;left:40px;top:40px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.75);";
  stick.appendChild(knob);
  let id = null;
  const setFrom = (t) => {
    const r = stick.getBoundingClientRect();
    let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      dx /= l;
      dy /= l;
    }
    _extStick = { x: Math.abs(dx) < 0.15 ? 0 : dx, y: Math.abs(dy) < 0.15 ? 0 : dy };
    knob.style.left = `${40 + dx * 40}px`;
    knob.style.top = `${40 + dy * 40}px`;
  };
  const stop = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };
  stick.addEventListener("touchstart", (e) => {
    stop(e);
    const t = e.changedTouches[0];
    id = t.identifier;
    setFrom(t);
  }, { passive: false });
  stick.addEventListener("touchmove", (e) => {
    stop(e);
    for (const t of e.changedTouches) if (t.identifier === id) setFrom(t);
  }, { passive: false });
  const end = (e) => {
    stop(e);
    for (const t of e.changedTouches) if (t.identifier === id) {
      id = null;
      _extStick = { x: 0, y: 0 };
      knob.style.left = "40px";
      knob.style.top = "40px";
    }
  };
  stick.addEventListener("touchend", end, { passive: false });
  stick.addEventListener("touchcancel", end, { passive: false });
  const btn = (label, right, bottom, fn) => {
    const b = document.createElement("div");
    b.textContent = label;
    b.style.cssText = `position:fixed;right:${right}px;bottom:${bottom}px;min-width:76px;height:56px;padding:0 10px;border-radius:28px;background:rgba(20,16,30,0.7);color:white;font:bold 16px Arial;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;border:2px solid rgba(255,255,255,0.4);`;
    b.addEventListener("touchstart", (e) => {
      stop(e);
      fn();
    }, { passive: false });
    b.addEventListener("mousedown", (e) => {
      stop(e);
      fn();
    });
    return b;
  };
  wrap.appendChild(stick);
  wrap.appendChild(btn("Grab", 84, 26, () => extDoGrab()));
  wrap.appendChild(btn("Tool", 84, 96, () => extUseTool()));
  wrap.appendChild(btn("Kit", 84, 166, () => extSwitchKit()));
  document.body.appendChild(wrap);
  _extTouchEl = wrap;
  return wrap;
}
function _showExtTouchControls() {
  if (!(typeof touchMode !== "undefined" && touchMode)) return;
  const el = _buildExtTouchControls();
  if (el && el.style.display !== "block") el.style.display = "block";
}
function _hideExtTouchControls() {
  if (_extTouchEl && _extTouchEl.style.display !== "none") _extTouchEl.style.display = "none";
  _extStick = { x: 0, y: 0 };
}

// ---- Loading a save mid-job ----
// (held fluffies put down; hidden ones out: their hiding places are made again)
function extAfterLoad() {
  const job = _extActive();
  extPlayer = job && job.player ? job.player : null;
  if (extPlayer) {
    extPlayer.holding = [];
    extPlayer.crate = null;
    extPlayer.tx = null;
    extPlayer.ty = null;
  }
  for (const f of fluffies) {
    f.extHeld = false;
    if (f.jobHide) {
      f.jobHide = null;
      f.hiddenBy = null;
      f.hideSpot = null;
    }
  }
}

if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.unshift({
    sellType: "transport_crate",
    is: (o) => o instanceof TransportCrate,
    hitTest: (o, x, y) => !!o.bounds && x >= o.bounds.left && x <= o.bounds.right && y >= o.bounds.top && y <= o.bounds.bottom,
    canPickUp: () => false,
    sellable: false,
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.TransportCrate = (d) => new TransportCrate(d.scene);
