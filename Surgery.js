// ---------------------------------------------------------------------------
// Surgery: the knife and scalpel open a close-up of the fluffy.
//
// Click a fluffy with the knife or scalpel and the game pauses on a chart of
// it, drawn in its own colours, from four sides (SURGERY_VIEWS): Front,
// Side (flip it to see the other side), Back and Underside. Each view shows
// the parts you can see from there. Hover over a part (or its name in the
// list) and it lights up; click it and you're asked first ("Cut off Daisy's
// left ear?"). Parts already gone are shown as a grey outline and can't be
// picked. "Body" is a stab with the knife (a cut with the scalpel), as before.
//
// The cut itself is the knife's old one (knifeCut): bleeding with the
// knife, a clean cut with the scalpel, the body part falls on the floor,
// the fluffy and anyone watching remember it was you (Memory.js), and so on.
// On an operating table set to a part, that part is marked "planned".
// The view stays open after a cut so you can do more, or Close (Esc).
// ---------------------------------------------------------------------------

const SURGERY_VIEWS = ["front", "side", "back", "under"];
const SURGERY_VIEW_NAMES = { front: "Front", side: "Side", back: "Back", under: "Underside" };
const SURGERY_BOX = { w: 400, h: 320 }; // the drawing's own size (scaled to fit)

// Every part: what it's called, what amputate() calls it, whether it's there
const SURGERY_PARTS = {
  leftEar: { label: "Left ear", has: (f) => !!f.limbs.leftEar },
  rightEar: { label: "Right ear", has: (f) => !!f.limbs.rightEar },
  leftEye: { label: "Left eye", has: (f) => !!f.limbs.leftEye },
  rightEye: { label: "Right eye", has: (f) => !!f.limbs.rightEye },
  horn: { label: "Horn", has: (f) => !!f.limbs.horn, only: (f) => f.type === "unicorn" || f.type === "alicorn" },
  leftWing: { label: "Left wing", has: (f) => !!f.limbs.leftWing, only: (f) => f.type === "pegasus" || f.type === "alicorn" },
  rightWing: { label: "Right wing", has: (f) => !!f.limbs.rightWing, only: (f) => f.type === "pegasus" || f.type === "alicorn" },
  leg_1: { label: "Front right leg", has: (f) => !!f.limbs.legs[1] },
  leg_2: { label: "Front left leg", has: (f) => !!f.limbs.legs[2] },
  leg_0: { label: "Back right leg", has: (f) => !!f.limbs.legs[0] },
  leg_3: { label: "Back left leg", has: (f) => !!f.limbs.legs[3] },
  tail: { label: "Tail", has: (f) => !!f.limbs.tail },
  lumps: { label: "Lumps (neuter)", has: (f) => !!f.limbs.lumps, only: (f) => f.gender === "male" },
  udders: { label: "Udders", has: (f) => !!f.limbs.udders, only: (f) => f.gender === "female" },
  spay: { label: "Womb (spay)", has: (f) => !f.spayed, only: (f) => f.gender === "female" },
  body: { label: "Body", has: () => true },
};

// The operating table's categories (OperatingTable.js), as parts
const SURGERY_TABLE_PARTS = {
  "FRONT RIGHT LEG": "leg_1",
  "FRONT LEFT LEG": "leg_2",
  "BACK RIGHT LEG": "leg_0",
  "BACK LEFT LEG": "leg_3",
  TAIL: "tail",
  "LEFT EAR": "leftEar",
  "RIGHT EAR": "rightEar",
  "LEFT EYE": "leftEye",
  "RIGHT EYE": "rightEye",
  "LEFT WING": "leftWing",
  "RIGHT WING": "rightWing",
  HORN: "horn",
};

let surgery = null; // { f, knife, view, side: "right"|"left", hover, planned, note }
let _sgHitCtx = null;

function isSurgeryOpen() {
  return !!(surgery && surgery.f);
}

function surgeryPartLabel(id, f) {
  if (id === "body") return surgery && surgery.knife && surgery.knife.type === "scalpel" ? "Body (cut)" : "Body (stab)";
  return (SURGERY_PARTS[id] && SURGERY_PARTS[id].label) || id;
}

// Does this fluffy have this kind of part at all (a wing on an earthy: no)?
function surgeryPartExists(f, id) {
  const p = SURGERY_PARTS[id];
  return !!p && (!p.only || p.only(f));
}

function surgeryPartPresent(f, id) {
  return surgeryPartExists(f, id) && SURGERY_PARTS[id].has(f);
}

// The world click (script.js): which view to start on for the part clicked
function _sgStartView(part) {
  if (part === "lumps" || part === "special_lumps" || part === "udders" || part === "horse_udders") return "under";
  return "side";
}

function openSurgery(f, knife, clickedPart = null) {
  if (!f || !knife) return false;
  let planned = null;
  if (typeof OperatingTable !== "undefined" && f.placedOn instanceof OperatingTable) {
    const cat = f.placedOn.category;
    planned = cat === "SPAYNEUTER" ? (f.gender === "female" ? "spay" : "lumps") : SURGERY_TABLE_PARTS[cat] || null;
  }
  surgery = {
    f,
    knife,
    view: planned ? surgeryViewFor(planned) : _sgStartView(clickedPart),
    // (the side you're looking at in the room)
    side: f.facingRight ? "right" : "left",
    hover: null,
    planned,
    note: null,
  };
  if (planned && (planned.endsWith("Ear") || planned.endsWith("Eye") || planned.endsWith("Wing") || planned.startsWith("leg_"))) {
    surgery.side = /^(left|leg_2|leg_3)/.test(planned) || planned === "leg_2" || planned === "leg_3" ? "left" : "right";
  }
  return true;
}

function closeSurgery() {
  surgery = null;
}

// A view that shows this part
function surgeryViewFor(id) {
  if (id === "spay" || id === "udders") return "under";
  if (id === "lumps") return "under";
  if (id === "horn") return "front";
  return "side";
}

// ---- Colours ----

function _sgRgb(str, fallback = [200, 200, 200]) {
  const m = String(str || "").match(/\d+(\.\d+)?/g);
  return m && m.length >= 3 ? m.slice(0, 3).map(Number) : fallback;
}

function _sgShade(str, k) {
  const [r, g, b] = _sgRgb(str);
  const f = (v) => Math.round(Math.max(0, Math.min(255, k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

function _sgColours(f) {
  const coat = (f.colors && f.colors.body) || "rgb(230, 220, 200)";
  const mane = typeof maneColorFor === "function" ? maneColorFor(f) : (f.colors && f.colors.mane) || "rgb(200, 120, 160)";
  return {
    coat,
    coatDark: _sgShade(coat, -0.18),
    coatLight: _sgShade(coat, 0.25),
    belly: _sgShade(coat, 0.35),
    hoof: _sgShade(coat, -0.45),
    mane,
    maneDark: _sgShade(mane, -0.2),
    eye: (f.colors && f.colors.pupil) || "rgb(60, 40, 80)",
    wing: _sgShade(coat, 0.12),
    pink: "rgb(240, 160, 180)",
    line: "#2a2230",
  };
}

// ---- Shapes (in the 400 x 320 drawing) ----

function _sgEllipse(cx, cy, rx, ry, rot = 0) {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  return p;
}

function _sgRound(x, y, w, h, r) {
  const p = new Path2D();
  if (p.roundRect) p.roundRect(x, y, w, h, r);
  else p.rect(x, y, w, h);
  return p;
}

function _sgPoly(pts) {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
}

// Several shapes as one (outlined together)
function _sgUnion(...paths) {
  const p = new Path2D();
  for (const q of paths) p.addPath(q);
  return p;
}

// Lots of round puffs: a tail, a mane
function _sgPuffs(circles) {
  const p = new Path2D();
  for (const [x, y, r] of circles) {
    p.moveTo(x + r, y);
    p.arc(x, y, r, 0, Math.PI * 2);
  }
  return p;
}

// A wing: a fan of rounded feathers from (x, y), pointing at angle a
function _sgWing(x, y, a, len, spread, mirror = false) {
  const p = new Path2D();
  const n = 4;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const ang = a + (mirror ? -1 : 1) * (t - 0.5) * spread;
    const l = len * (1 - 0.18 * t);
    const tx = x + Math.cos(ang) * l;
    const ty = y + Math.sin(ang) * l;
    const w = 13 - 2 * t;
    const nx = -Math.sin(ang) * w;
    const ny = Math.cos(ang) * w;
    p.moveTo(x + nx, y + ny);
    p.quadraticCurveTo(tx + nx * 1.4, ty + ny * 1.4, tx, ty);
    p.quadraticCurveTo(tx - nx * 1.4, ty - ny * 1.4, x - nx, y - ny);
    p.closePath();
  }
  return p;
}

// A limb from (x1, y1) to (x2, y2), w wide, rounded at both ends
function _sgCapsule(x1, y1, x2, y2, w) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = new Path2D();
  p.arc(x1, y1, w / 2, a + Math.PI / 2, a - Math.PI / 2);
  p.arc(x2, y2, w / 2, a - Math.PI / 2, a + Math.PI / 2);
  p.closePath();
  return p;
}

function _sgLeg(x, top, bottom, w = 36) {
  return _sgRound(x - w / 2, top, w, bottom - top, w / 2.4);
}

function _sgHoof(x, bottom, w = 36) {
  return _sgRound(x - w / 2, bottom - 13, w, 13, 6);
}

// ---- The views: a list of shapes, back to front ----
// Each: { id (a SURGERY_PARTS key, or null for looks only), path, fill,
//         extra(c) for details drawn on top }

function surgeryShapes(f, view, side = "right") {
  const C = _sgColours(f);
  const S = [];
  const add = (id, path, fill, opts = {}) => S.push({ id, path, fill, key: `${view}|${side}|${id}|${S.length}`, ...opts });
  const winged = surgeryPartExists(f, "leftWing");
  const horned = surgeryPartExists(f, "horn");
  const male = f.gender === "male";

  if (view === "side") {
    // Drawn facing right; the near side is the right one (flip: mirrored)
    const near = side;
    const far = side === "right" ? "left" : "right";
    const L = (s) => (s === "right" ? { front: "leg_1", back: "leg_0" } : { front: "leg_2", back: "leg_3" });
    // Far legs, behind
    add(L(far).back, _sgLeg(166, 200, 284, 32), C.coatDark, { hoof: _sgHoof(166, 284, 32), dim: true });
    add(L(far).front, _sgLeg(284, 200, 284, 32), C.coatDark, { hoof: _sgHoof(284, 284, 32), dim: true });
    // Far ear
    add(far + "Ear", _sgPoly([[312, 70], [334, 22], [346, 74]]), C.coatDark, { dim: true, inner: _sgPoly([[322, 66], [334, 34], [339, 68]]) });
    // Tail
    add("tail", _sgPuffs([[98, 150, 26], [74, 168, 24], [62, 196, 22], [80, 220, 18], [104, 132, 16]]), C.mane);
    // Far wing peeking over the back
    if (winged) add(far + "Wing", _sgWing(196, 132, -2.35, 70, 0.7, true), _sgShade(C.wing, -0.15), { dim: true });
    // Body
    add("body", _sgEllipse(200, 185, 96, 64), C.coat, { belly: _sgEllipse(205, 214, 64, 28) });
    // Lumps / udders, just showing under the belly
    if (male) add("lumps", _sgPuffs([[178, 247, 11], [190, 249, 10]]), C.pink);
    else add("udders", _sgPuffs([[178, 246, 8], [192, 247, 8]]), C.pink);
    // Near legs
    add(L(near).back, _sgLeg(138, 205, 290), C.coat, { hoof: _sgHoof(138, 290) });
    add(L(near).front, _sgLeg(258, 205, 290), C.coat, { hoof: _sgHoof(258, 290) });
    // Near wing, folded on its side
    if (winged) add(near + "Wing", _sgWing(186, 160, -2.75, 82, 0.55, true), C.wing);
    // Neck, and the mane down it (looks only)
    add(null, _sgEllipse(272, 150, 38, 48, -0.5), C.coat);
    add(null, _sgPuffs([[262, 92, 22], [250, 118, 20], [244, 144, 16], [280, 70, 20]]), C.mane);
    // Head
    // Head and muzzle in one outline; nostril and mouth on the muzzle
    add(null, _sgUnion(_sgEllipse(300, 120, 58, 54), _sgEllipse(340, 140, 30, 22, 0.15)), C.coat, {
      muzzle: _sgEllipse(342, 141, 25, 17, 0.15),
      nostrils: [[361, 134, 3.2, 2.2]],
      mouth: { x: 354, y: 152, w: 16, side: true },
    });
    // Horn
    if (horned) add("horn", _sgPoly([[300, 70], [330, 6], [322, 72]]), "rgb(250, 235, 180)", { spiral: [[300, 70], [330, 6], [322, 72]] });
    // Near ear
    add(near + "Ear", _sgPoly([[270, 76], [276, 18], [306, 64]]), C.coat, { inner: _sgPoly([[280, 68], [279, 32], [298, 62]]) });
    // Forelock
    add(null, _sgPuffs([[292, 70, 16], [276, 82, 14]]), C.mane);
    // Near eye
    add(near + "Eye", _sgEllipse(322, 112, 13, 17), "white", { iris: _sgEllipse(326, 114, 8, 11) });
  } else if (view === "front") {
    // Facing you: its left is on your right
    if (winged) {
      add("rightWing", _sgWing(140, 170, -2.6, 92, 0.8), C.wing);
      add("leftWing", _sgWing(260, 170, -0.54, 92, 0.8, true), C.wing);
    }
    add("tail", _sgPuffs([[300, 230, 20], [312, 252, 16]]), C.mane, { dim: true });
    add("body", _sgEllipse(200, 205, 82, 62), C.coat, { belly: _sgEllipse(200, 222, 46, 34) });
    add("leg_1", _sgLeg(166, 222, 294), C.coat, { hoof: _sgHoof(166, 294) });
    add("leg_2", _sgLeg(234, 222, 294), C.coat, { hoof: _sgHoof(234, 294) });
    add("rightEar", _sgPoly([[138, 92], [128, 26], [178, 66]]), C.coat, { inner: _sgPoly([[144, 82], [137, 42], [168, 66]]) });
    add("leftEar", _sgPoly([[262, 92], [272, 26], [222, 66]]), C.coat, { inner: _sgPoly([[256, 82], [263, 42], [232, 66]]) });
    add(null, _sgEllipse(200, 116, 66, 58), C.coat, {
      muzzle: _sgEllipse(200, 147, 32, 20),
      nostrils: [[189, 142, 3.5, 2.5], [211, 142, 3.5, 2.5]],
      mouth: { x: 200, y: 157, w: 22 },
    });
    if (horned) add("horn", _sgPoly([[188, 64], [200, 0], [212, 64]]), "rgb(250, 235, 180)", { spiral: [[188, 64], [200, 0], [212, 64]] });
    add(null, _sgPuffs([[184, 66, 16], [200, 60, 16], [216, 66, 16]]), C.mane);
    add("rightEye", _sgEllipse(174, 112, 14, 18), "white", { iris: _sgEllipse(176, 115, 8, 11) });
    add("leftEye", _sgEllipse(226, 112, 14, 18), "white", { iris: _sgEllipse(224, 115, 8, 11) });
  } else if (view === "back") {
    // From behind: its left is on your left
    add(null, _sgEllipse(200, 96, 54, 46), C.coat);
    add(null, _sgPuffs([[176, 80, 22], [200, 72, 24], [224, 80, 22], [200, 104, 22]]), C.mane);
    if (horned) add("horn", _sgPoly([[192, 52], [200, 10], [208, 52]]), "rgb(250, 235, 180)", { dim: true });
    add("leftEar", _sgPoly([[150, 92], [140, 34], [184, 70]]), C.coatDark);
    add("rightEar", _sgPoly([[250, 92], [260, 34], [216, 70]]), C.coatDark);
    add("body", _sgEllipse(200, 192, 88, 66), C.coat);
    add("leg_3", _sgLeg(162, 216, 294), C.coat, { hoof: _sgHoof(162, 294) });
    add("leg_0", _sgLeg(238, 216, 294), C.coat, { hoof: _sgHoof(238, 294) });
    if (male) add("lumps", _sgPuffs([[192, 254, 11], [208, 254, 11]]), C.pink);
    add("tail", _sgPuffs([[200, 150, 30], [188, 180, 24], [212, 188, 22], [200, 212, 20]]), C.mane);
    if (winged) {
      add("leftWing", _sgWing(158, 152, -2.5, 96, 0.8), C.wing);
      add("rightWing", _sgWing(242, 152, -0.64, 96, 0.8, true), C.wing);
    }
  } else if (view === "under") {
    // From underneath, head at the top: its left is on your right. The
    // legs are nearest you, so they're drawn over the belly.
    if (winged) {
      add("rightWing", _sgWing(152, 112, -2.9, 92, 0.7), C.wing);
      add("leftWing", _sgWing(248, 112, -0.24, 92, 0.7, true), C.wing);
    }
    add("rightEar", _sgPoly([[168, 36], [142, 2], [182, 22]]), C.coatDark);
    add("leftEar", _sgPoly([[232, 36], [258, 2], [218, 22]]), C.coatDark);
    add(null, _sgEllipse(200, 46, 42, 34), C.coat, { muzzle: _sgEllipse(200, 30, 22, 13), mouth: { x: 200, y: 22, w: 18, chin: true } });
    add("tail", _sgPuffs([[200, 284, 18], [186, 296, 13], [214, 296, 13]]), C.mane);
    add("body", _sgEllipse(200, 162, 72, 104), C.coat);
    if (!male) add("spay", _sgEllipse(200, 166, 38, 50), C.belly, { scarIfGone: true });
    else add(null, _sgEllipse(200, 166, 38, 50), C.belly);
    if (male) add("lumps", _sgPuffs([[190, 240, 12], [210, 240, 12]]), C.pink);
    else add("udders", _sgPuffs([[188, 228, 7], [212, 228, 7], [188, 245, 6], [212, 245, 6]]), C.pink);
    const leg = (id, x1, y1, x2, y2) => add(id, _sgCapsule(x1, y1, x2, y2, 30), C.coat, { hoofSole: _sgEllipse(x2, y2, 12, 12) });
    leg("leg_1", 160, 100, 112, 84);
    leg("leg_2", 240, 100, 288, 84);
    leg("leg_0", 160, 226, 114, 248);
    leg("leg_3", 240, 226, 286, 248);
  }
  return S.filter((s) => !s.id || surgeryPartExists(f, s.id));
}

// ---- Layout ----

function surgeryLayout() {
  const w = Math.min(1000, width - 30);
  const h = Math.min(660, height - 30);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  const listW = Math.min(300, Math.round(w * 0.32));
  const rowH = h < 620 ? 24 : 27; // (room for the Stitch / Burn buttons under the list)
  const art = { x: x + 20, y: y + 104, w: w - listW - 60, h: h - 180 };
  const scale = Math.min((art.w - 20) / SURGERY_BOX.w, (art.h - 44) / SURGERY_BOX.h); // (room for the caption)
  const ox = art.x + (art.w - SURGERY_BOX.w * scale) / 2;
  const oy = art.y + 8 + (art.h - 44 - SURGERY_BOX.h * scale) / 2;
  const tabs = SURGERY_VIEWS.map((v, i) => ({ v, x: x + 20 + i * 112, y: y + 56, w: 104, h: 34 }));
  const flip = { x: x + 20 + 4 * 112 + 12, y: y + 56, w: 110, h: 34 };
  const list = { x: x + w - listW - 20, y: y + 104, w: listW, rowH };
  const close = { x: x + w - 150, y: y + h - 56, w: 130, h: 40 };
  // While it's bleeding: stitch it, or burn it shut
  const stitch = { x: list.x - 6, y: close.y - 48, w: Math.floor(listW / 2) - 2, h: 38 };
  const burn = { x: stitch.x + stitch.w + 8, y: close.y - 48, w: Math.floor(listW / 2) - 2, h: 38 };
  return { x, y, w, h, art, scale, ox, oy, tabs, flip, list, close, burn, stitch };
}

// Parts listed beside the drawing: the ones this fluffy has (or had)
function surgeryListParts(f) {
  return Object.keys(SURGERY_PARTS).filter((id) => surgeryPartExists(f, id));
}

// Which part is under the mouse (in the drawing)
function surgeryPartAt(mx, my, L = surgeryLayout()) {
  if (!surgery) return null;
  const lx = (mx - L.ox) / L.scale;
  let ly = (my - L.oy) / L.scale;
  let x = lx;
  if (surgery.view === "side" && surgery.side === "left") x = SURGERY_BOX.w - lx; // (mirrored)
  if (x < 0 || x > SURGERY_BOX.w || ly < 0 || ly > SURGERY_BOX.h) return null;
  if (!_sgHitCtx) _sgHitCtx = (typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(4, 4) : document.createElement("canvas")).getContext("2d");
  const shapes = surgeryShapes(surgery.f, surgery.view, surgery.side);
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (!_sgHitCtx.isPointInPath(s.path, x, ly)) continue;
    if (!s.id) continue; // (looks only: the head, the mane... keep looking behind)
    return s.id;
  }
  return null;
}

function surgeryListRowAt(mx, my, L = surgeryLayout()) {
  if (!surgery) return null;
  const ids = surgeryListParts(surgery.f);
  const top = L.list.y + 30;
  const i = Math.floor((my - top) / L.list.rowH);
  if (mx < L.list.x || mx > L.list.x + L.list.w || i < 0 || i >= ids.length) return null;
  return ids[i];
}

// Your suture kit (with stitches left) and cautery iron, if you've got them
function _sgOwned(cls, ok = () => true) {
  if (typeof cls === "undefined" || !cls) return null;
  const all = [...(typeof toolbox !== "undefined" ? toolbox : []), ...(typeof objects !== "undefined" ? objects : [])];
  return all.find((t) => t instanceof cls && ok(t)) || null;
}

function surgeryKit() {
  return _sgOwned(typeof SutureKit !== "undefined" ? SutureKit : null, (k) => k.charges > 0);
}

function surgeryIron() {
  return _sgOwned(typeof CauteryIron !== "undefined" ? CauteryIron : null);
}

// ---- Drawing ----

function drawSurgery(c) {
  if (!isSurgeryOpen()) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const f = surgery.f;
  const L = surgeryLayout();
  // What the mouse is over (the drawing, or the list)
  surgery.hover = surgeryPartAt(mouse.x, mouse.y, L) || surgeryListRowAt(mouse.x, mouse.y, L);

  c.save();
  drawScreenPanel(c, L, { theme: "green" });
  const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Fluffy";
  const tool = surgery.knife.type === "scalpel" ? "Scalpel" : "Knife";
  drawPanelTitle(c, `Surgery: ${name}`, L, { theme: "green" });
  c.font = "15px Arial";
  c.fillStyle = "rgba(255,255,255,0.75)";
  c.textAlign = "right";
  c.fillText(`${tool} in hand`, L.x + L.w - 24, L.y + 38);

  // View tabs
  for (const t of L.tabs) drawPanelButton(t, SURGERY_VIEW_NAMES[t.v], { on: surgery.view === t.v, ctx: c });
  if (surgery.view === "side") drawPanelButton(L.flip, surgery.side === "right" ? "Right side ⇄" : "Left side ⇄", { ctx: c });

  // The chart
  fillRoundRect(c, L.art.x, L.art.y, L.art.w, L.art.h, 12, "rgba(230, 245, 240, 0.08)");
  c.save();
  c.beginPath();
  c.rect(L.art.x, L.art.y, L.art.w, L.art.h);
  c.clip();
  // Grid, like a vet's chart
  c.strokeStyle = "rgba(160, 230, 200, 0.08)";
  c.lineWidth = 1;
  for (let gx = L.art.x; gx < L.art.x + L.art.w; gx += 24) {
    c.beginPath();
    c.moveTo(gx, L.art.y);
    c.lineTo(gx, L.art.y + L.art.h);
    c.stroke();
  }
  for (let gy = L.art.y; gy < L.art.y + L.art.h; gy += 24) {
    c.beginPath();
    c.moveTo(L.art.x, gy);
    c.lineTo(L.art.x + L.art.w, gy);
    c.stroke();
  }
  c.translate(L.ox, L.oy);
  c.scale(L.scale, L.scale);
  if (surgery.view === "side" && surgery.side === "left") {
    c.translate(SURGERY_BOX.w, 0);
    c.scale(-1, 1);
  }
  _sgDrawShapes(c, f, surgeryShapes(f, surgery.view, surgery.side));
  c.restore();
  // Which way round
  c.font = "13px Arial";
  c.textAlign = "left";
  c.fillStyle = "rgba(200, 255, 230, 0.6)";
  const caption = {
    front: "From the front: its left is on your right",
    side: `Its ${surgery.side} side`,
    back: "From behind: its left is on your left",
    under: "From underneath, head at the top: its left is on your right",
  }[surgery.view];
  c.fillText(caption, L.art.x + 10, L.art.y + L.art.h - 10);

  // The hovered part's name, by the mouse
  if (surgery.hover && isPointInRect(mouse.x, mouse.y, L.art.x, L.art.y, L.art.w, L.art.h)) {
    const present = surgeryPartPresent(f, surgery.hover);
    const t = surgeryPartLabel(surgery.hover, f) + (present ? " - click to cut" : " (gone)");
    c.font = "bold 14px Arial";
    const tw = c.measureText(t).width + 16;
    const tx = Math.min(mouse.x + 14, L.art.x + L.art.w - tw - 4);
    const ty = Math.max(mouse.y - 30, L.art.y + 4);
    fillRoundRect(c, tx, ty, tw, 24, 6, present ? "rgba(20, 60, 60, 0.92)" : "rgba(60, 60, 60, 0.92)");
    c.fillStyle = present ? "#9ff0e8" : "#bbb";
    c.textAlign = "left";
    c.fillText(t, tx + 8, ty + 17);
  }

  // Parts list
  c.font = "bold 15px Arial";
  c.fillStyle = "#9ff0c8";
  c.textAlign = "left";
  c.fillText("Parts", L.list.x, L.list.y + 16);
  const ids = surgeryListParts(f);
  ids.forEach((id, i) => {
    const ry = L.list.y + 30 + i * L.list.rowH;
    const present = surgeryPartPresent(f, id);
    const hov = surgery.hover === id;
    if (hov) fillRoundRect(c, L.list.x - 6, ry, L.list.w, L.list.rowH - 3, 6, present ? "rgba(110, 240, 220, 0.18)" : "rgba(255,255,255,0.06)");
    c.font = "14px Arial";
    c.fillStyle = present ? (hov ? "#d8fff8" : "rgba(255,255,255,0.88)") : "rgba(255,255,255,0.35)";
    c.fillText(surgeryPartLabel(id, f), L.list.x + 4, ry + 18);
    c.textAlign = "right";
    c.font = "12px Arial";
    c.fillStyle = present ? (surgery.planned === id ? "#ffd27a" : "rgba(160, 240, 200, 0.7)") : "rgba(255,255,255,0.35)";
    c.fillText(present ? (surgery.planned === id ? "planned" : "") : id === "spay" ? "done" : "gone", L.list.x + L.list.w - 12, ry + 18);
    c.textAlign = "left";
  });

  // Health, what the tool does, the last cut
  const iy = L.y + L.h - 62;
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.85)";
  const hp = Math.max(0, Math.round(f.health));
  c.fillText(f.isAlive ? `Health ${hp}` : "Dead", L.x + 24, iy);
  fillRoundRect(c, L.x + 110, iy - 12, 160, 12, 6, "rgba(255,255,255,0.12)");
  if (f.isAlive) fillRoundRect(c, L.x + 110, iy - 12, 160 * Math.min(1, hp / 100), 12, 6, hp > 50 ? "#6fd39a" : hp > 25 ? "#e8c35a" : "#e06a6a");
  c.fillStyle = "rgba(255,255,255,0.6)";
  c.font = "13px Arial";
  const toolNote =
    surgery.knife.type === "scalpel"
      ? "Scalpel: a clean cut - no bleeding, no harm to its health."
      : "Knife: it bleeds and it hurts its health. Have the suture kit ready.";
  const onTable = typeof OperatingTable !== "undefined" && f.placedOn instanceof OperatingTable;
  c.fillText(toolNote + (onTable ? "" : "  (Not on an operating table.)"), L.x + 24, iy + 22);
  if (surgery.note) {
    c.fillStyle = "#ffd6a0";
    c.font = "bold 14px Arial";
    c.fillText(fitText(c, surgery.note, L.w - 220), L.x + 24, iy + 44);
  }
  // Bleeding: stitch it or burn it shut
  if (f.isAlive && f.bleedingTimer > 0) {
    c.font = "bold 14px Arial";
    c.fillStyle = "#ff7a7a";
    c.textAlign = "left";
    c.fillText("Bleeding!", L.x + 290, iy);
    const kit = surgeryKit();
    const iron = surgeryIron();
    drawPanelButton(L.stitch, kit ? `Stitch (${kit.charges} left)` : "Stitch (no kit)", { ctx: c, enabled: !!kit, fontSize: 13 });
    drawPanelButton(L.burn, iron ? "Burn it shut" : "Burn (no iron)", { ctx: c, enabled: !!iron, fontSize: 13 });
  }
  drawPanelButton(L.close, "Close", { ctx: c });
  c.restore();
}

// A small mouth: a smile, a flat line or a frown with its mood
// (side: just the corner of it; chin: the seam seen from below)
function _sgDrawMouth(c, f, m) {
  const mood = f.isAlive ? f.happiness : 0;
  const bend = mood > 0.55 ? 1 : mood > 0.3 ? 0.3 : -0.8; // + smile, - frown
  c.save();
  c.strokeStyle = "rgba(60, 35, 45, 0.9)";
  c.lineWidth = 2.2;
  c.lineCap = "round";
  c.beginPath();
  if (m.chin) {
    c.moveTo(m.x - m.w / 2, m.y);
    c.quadraticCurveTo(m.x, m.y + 4, m.x + m.w / 2, m.y);
  } else if (m.side) {
    // from the front of the muzzle back to the corner
    c.moveTo(m.x + m.w / 2, m.y - 1);
    c.quadraticCurveTo(m.x, m.y + 2, m.x - m.w / 2, m.y - 3 * bend);
  } else {
    c.moveTo(m.x - m.w / 2, m.y - 3 * bend);
    c.quadraticCurveTo(m.x, m.y + 5 * bend, m.x + m.w / 2, m.y - 3 * bend);
  }
  c.stroke();
  c.restore();
}

function _sgDrawShapes(c, f, shapes) {
  const C = _sgColours(f);
  const hover = surgery ? surgery.hover : null;
  const planned = surgery ? surgery.planned : null;
  c.lineJoin = "round";
  for (const s of shapes) {
    const gone = s.id && !surgeryPartPresent(f, s.id);
    c.save();
    if (gone) {
      if (s.scarIfGone) {
        // Spayed: a neat stitched line
        c.fillStyle = s.fill;
        c.fill(s.path);
        c.strokeStyle = "rgba(150, 60, 70, 0.8)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(200, 140);
        c.lineTo(200, 192);
        for (let y = 144; y < 192; y += 8) {
          c.moveTo(195, y);
          c.lineTo(205, y + 3);
        }
        c.stroke();
      } else {
        c.setLineDash([6, 5]);
        c.strokeStyle = "rgba(255, 255, 255, 0.35)";
        c.lineWidth = 2;
        c.stroke(s.path);
        // Burnt shut where it came off (CauteryIron.js)
        if (typeof _scDrawBurn === "function" && scarsOf(f).some((b) => b.kind === "burn" && b.at === s.id)) {
          c.setLineDash([]);
          _scDrawBurn(c, _sgStump(s), 11);
        }
      }
      c.restore();
      continue;
    }
    const lit = s.id && (s.id === hover || s.id === planned);
    if (s.dim) c.globalAlpha = 0.85;
    // Outline first, twice as thick, then the fill on top: only the outside
    // edge shows (one outline round a tail of puffs, a fan of feathers).
    // Lit up (under the mouse, or planned on the table): a glowing edge.
    c.save();
    if (lit) {
      c.globalAlpha = 1;
      c.shadowColor = s.id === hover ? "rgba(90, 255, 230, 0.95)" : "rgba(255, 200, 90, 0.9)";
      c.shadowBlur = 18;
      c.strokeStyle = s.id === hover ? "#7ffff0" : "#ffd27a";
      c.lineWidth = 10;
    } else {
      c.strokeStyle = C.line;
      c.lineWidth = 6;
    }
    c.stroke(s.path);
    c.restore();
    c.fillStyle = s.fill;
    c.fill(s.path);
    if (s.belly) {
      c.fillStyle = C.belly;
      c.globalAlpha = 0.45;
      c.fill(s.belly);
      c.globalAlpha = s.dim ? 0.85 : 1;
    }
    if (s.hoof) {
      c.fillStyle = C.hoof;
      c.fill(s.hoof);
    }
    if (s.hoofSole) {
      c.fillStyle = C.hoof;
      c.fill(s.hoofSole);
      c.strokeStyle = C.line;
      c.lineWidth = 2;
      c.stroke(s.hoofSole);
    }
    if (s.inner) {
      c.fillStyle = C.pink;
      c.fill(s.inner);
    }
    if (s.muzzle) {
      c.fillStyle = C.coatLight;
      c.globalAlpha = (s.dim ? 0.85 : 1) * 0.7;
      c.fill(s.muzzle);
      c.globalAlpha = s.dim ? 0.85 : 1;
    }
    if (s.nostrils) {
      c.fillStyle = "rgba(60, 35, 45, 0.85)";
      for (const [nx, ny, rx, ry] of s.nostrils) {
        c.beginPath();
        c.ellipse(nx, ny, rx, ry, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (s.mouth) _sgDrawMouth(c, f, s.mouth);
    if (s.iris) {
      c.fillStyle = C.eye;
      c.fill(s.iris);
    }
    if (s.spiral) {
      const [a, tip, b] = s.spiral;
      c.strokeStyle = "rgba(180, 150, 90, 0.8)";
      c.lineWidth = 1.5;
      for (let t = 0.2; t < 0.95; t += 0.18) {
        c.beginPath();
        c.moveTo(a[0] + (tip[0] - a[0]) * t, a[1] + (tip[1] - a[1]) * t);
        c.lineTo(b[0] + (tip[0] - b[0]) * (t + 0.08), b[1] + (tip[1] - b[1]) * (t + 0.08));
        c.stroke();
      }
    }
    if (s.id === hover) {
      c.fillStyle = "rgba(120, 255, 235, 0.22)";
      c.fill(s.path);
    }
    c.restore();
  }
}

// Where a part joins the body: the middle of its top end (a leg's top)
// or its middle (an ear seen from behind...). Worked out once per shape.
const _sgStumpCache = new Map();
function _sgStump(shape) {
  const key = shape.key;
  if (key && _sgStumpCache.has(key)) return _sgStumpCache.get(key);
  if (!_sgHitCtx) _sgHitCtx = (typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(4, 4) : document.createElement("canvas")).getContext("2d");
  const pts = [];
  for (let y = 0; y < SURGERY_BOX.h; y += 5) for (let x = 0; x < SURGERY_BOX.w; x += 5) if (_sgHitCtx.isPointInPath(shape.path, x, y)) pts.push([x, y]);
  let spot = [SURGERY_BOX.w / 2, SURGERY_BOX.h / 2];
  if (pts.length) {
    const ys = pts.map((p) => p[1]);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const legish = /^leg_/.test(shape.id) && bottom - top > 40;
    const use = legish ? pts.filter((p) => p[1] <= top + (bottom - top) * 0.25) : pts;
    spot = [use.reduce((a, p) => a + p[0], 0) / use.length, use.reduce((a, p) => a + p[1], 0) / use.length];
  }
  if (key) _sgStumpCache.set(key, spot);
  return spot;
}

// ---- Clicks ----

function handleSurgeryClick() {
  if (!isSurgeryOpen()) return false;
  const L = surgeryLayout();
  const mx = mouse.x;
  const my = mouse.y;
  if (isPointInRect(mx, my, L.close.x, L.close.y, L.close.w, L.close.h)) {
    closeSurgery();
    return true;
  }
  for (const t of L.tabs) {
    if (isPointInRect(mx, my, t.x, t.y, t.w, t.h)) {
      surgery.view = t.v;
      return true;
    }
  }
  if (surgery.f.isAlive && surgery.f.bleedingTimer > 0) {
    if (isPointInRect(mx, my, L.stitch.x, L.stitch.y, L.stitch.w, L.stitch.h)) {
      surgeryStitch();
      return true;
    }
    if (isPointInRect(mx, my, L.burn.x, L.burn.y, L.burn.w, L.burn.h)) {
      askSurgeryBurn();
      return true;
    }
  }
  if (surgery.view === "side" && isPointInRect(mx, my, L.flip.x, L.flip.y, L.flip.w, L.flip.h)) {
    surgery.side = surgery.side === "right" ? "left" : "right";
    return true;
  }
  const id = surgeryPartAt(mx, my, L) || surgeryListRowAt(mx, my, L);
  if (id) askSurgeryCut(id);
  return true; // (it's a full screen: clicks go nowhere else)
}

// Stitch the wound with your suture kit (SutureKit.js)
function surgeryStitch() {
  if (!isSurgeryOpen()) return false;
  const kit = surgeryKit();
  const f = surgery.f;
  if (!kit || !sutureWound(f, kit)) return false;
  surgery.note = `${typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "It"}: stitched up.`;
  return true;
}

// Burn it shut with the iron - asked first: it's agony and leaves a scar
function askSurgeryBurn() {
  if (!isSurgeryOpen()) return false;
  const f = surgery.f;
  const iron = surgeryIron();
  if (!iron || !(f.bleedingTimer > 0)) return false;
  const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "the fluffy";
  openChoice({
    title: `Burn ${name}'s wound shut?`,
    lines: ["The hot iron stops the bleeding for good - but it's agony, and it leaves a burn scar for life.", "It'll remember who did it."],
    buttons: [
      { label: "Burn it shut", kind: "danger", run: () => surgeryBurn() },
      { label: "Cancel", cancel: true, run: () => {} },
    ],
  });
  return true;
}

function surgeryBurn() {
  if (!isSurgeryOpen()) return false;
  const f = surgery.f;
  const iron = surgeryIron();
  if (!iron || !cauterizeWound(f, iron)) return false;
  surgery.note = `${typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "It"}: burnt shut. It'll carry the scar for life.`;
  return true;
}

// Asked first (Choices.js)
function askSurgeryCut(id) {
  if (!isSurgeryOpen()) return false;
  const f = surgery.f;
  if (!f.isAlive || !surgeryPartPresent(f, id)) return false;
  const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "the fluffy";
  const scalpel = surgery.knife.type === "scalpel";
  const part = surgeryPartLabel(id, f).replace(/ \(.*\)$/, "").toLowerCase();
  let title;
  if (id === "body") title = scalpel ? `Cut ${name}?` : `Stab ${name}?`;
  else if (id === "spay") title = `Spay ${name}?`;
  else if (id === "lumps") title = `Neuter ${name}?`;
  else title = `Cut off ${name}'s ${part}?`;
  const lines = [];
  if (id === "body") lines.push(scalpel ? "It hurts, but nothing comes off." : "It hurts and bleeds; too many and it dies.");
  else lines.push(scalpel ? "A clean cut with the scalpel: no bleeding." : "With the knife it bleeds, and hurts its health.");
  lines.push("It'll remember you did it, and so will any fluffy watching.");
  openChoice({
    title,
    lines,
    buttons: [
      { label: id === "body" ? (scalpel ? "Cut" : "Stab") : id === "spay" ? "Spay" : id === "lumps" ? "Neuter" : "Cut it off", kind: "danger", run: () => surgeryCut(id) },
      { label: "Cancel", cancel: true, run: () => {} },
    ],
  });
  return true;
}

// Do it (the knife's cut, script.js used to do this in place)
function surgeryCut(id) {
  if (!isSurgeryOpen()) return false;
  const f = surgery.f;
  if (!f.isAlive || !surgeryPartPresent(f, id)) return false;
  const before = surgeryPartPresent(f, id);
  knifeCut(f, id === "body" ? "torso" : id, surgery.knife);
  surgery.knife.whackTimer = 0.2;
  const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "It";
  if (!f.isAlive) surgery.note = `${name} died.`;
  else if (id === "body") surgery.note = surgery.knife.type === "scalpel" ? `${name} is cut.` : `${name} is stabbed and bleeding.`;
  else if (before && !surgeryPartPresent(f, id)) {
    const what = id === "spay" ? "spayed" : id === "lumps" ? "neutered" : `${surgeryPartLabel(id, f).toLowerCase()} removed`;
    surgery.note = `${name}: ${what}.` + (surgery.knife.type === "scalpel" ? "" : " It's bleeding - stitch it with the suture kit.");
  }
  if (surgery.planned === id) surgery.planned = null;
  return true;
}

// The cut: what the knife has always done to the part it hit (the body:
// "torso", a stab). Moved here from script.js so the surgery screen can
// use it.
function knifeCut(f, hitPart, knife) {
  // (its coloured pictures, for the part that falls off: made when it's
  // first drawn, so not yet for one in a room you haven't looked at)
  if (f.renderer && typeof f.renderer.ensureTintedImages === "function") f.renderer.ensureTintedImages();
  playSound("knife");
  // Create blood puddle
  const pX = f.x;
  const pY = f.getBottomY();
  if (knife.type !== "scalpel") {
    addPointToPuddle(f.scene, pX, pY, "blood", 5 / 200, 25 / 200);
  }
  // Amputate!
  playSound("knife");
  const amputated = f.amputate(hitPart, knife);
  // (where the wound is, for a burn if it's cauterized: CauteryIron.js)
  f.lastWound = amputated || "body";
  f.changeHappiness(HAPPINESS_PENALTY_AMPUTATION);

  notifyViolence(f, false, knife.type, false, !!amputated);

  // Calculate health damage
  if (knife.type !== "scalpel") {
    let damage = 100 / (2 + 14 * f.growth);
    if (amputated) damage *= 2;
    f.health -= damage;
  }

    if (amputated) {
      if (amputated === "lumps") {
        if (f.tooYoungToSpeak()) {
          f.speak(getDialogue(["AMPUTATION", "CHIRPY"], f));
        } else {
          f.speak(getDialogue(["AMPUTATION", "LUMPS"], f));
        }
        f.traumaMemory.push({
          type: "lumps",
          timer: 30 + Math.random() * 60,
        });
      } else {
        if (f.tooYoungToSpeak()) {
          f.speak(getDialogue(["AMPUTATION", "CHIRPY"], f));
        } else {
          f.speak(getDialogue(["AMPUTATION", "DEFAULT"], f));
        }
        if (amputated.startsWith("leg")) {
          f.traumaMemory.push({
            type: "legs",
            timer: 30 + Math.random() * 60,
          });
        }
      }

      // Spawn Gib
      // Assuming tinted images exist since we hit tested

      let gibImg = null;

      if (amputated === "head" || amputated === "ears")
        gibImg = f.tinted.ear;
      let gibGrowth = 0;
      if (amputated === "tail") {
        gibImg = f.tinted.tail;
        gibGrowth = 0.1 * f.growth;
      } else if (amputated.startsWith("leg")) {
        gibImg = f.tinted.leg;
        gibGrowth = 0.1 * f.growth;
      } else if (amputated === "lumps") {
        gibImg = f.tinted.special_lumps;
        gibGrowth = 0.025 * f.growth;
      } else if (amputated === "udders") {
        gibImg = f.tinted.udders;
        gibGrowth = 0.025 * f.growth;
      } else if (
        amputated.startsWith("rightEar") ||
        amputated.startsWith("leftEar")
      ) {
        gibImg = f.tinted.ear;
        gibGrowth = 0.025 * f.growth;
      } else if (amputated === "horn") {
        gibImg = f.tinted.horn;
        gibGrowth = 0.025 * f.growth;
      } else if (
        amputated === "leftWing" ||
        amputated === "rightWing"
      ) {
        gibImg = f.tinted.wing;
        gibGrowth = 0.05 * f.growth;
      }

      if (gibImg) {
        playSound("amputation");
        const partKey = amputated.includes("head")
          ? "head"
          : amputated.includes("torso")
            ? "torso"
            : amputated.includes("tail")
              ? "tail"
              : amputated.includes("Ear")
                ? "ear"
                : amputated.includes("leg")
                  ? "leg"
                  : amputated.includes("lumps")
                    ? "special_lumps"
                    : amputated.includes("udders")
                      ? "horse_udders"
                      : amputated === "horn"
                        ? "horn"
                        : amputated === "leftWing" ||
                            amputated === "rightWing"
                          ? "wing"
                          : "part";
        let spotsConfig = null;
        if (f.hasSpots) {
          const baseConfig = {
            color: f.colors.spots,
            seed: f.spotPatternSeed,
          };
          if (partKey === "head") {
            spotsConfig = {
              ...baseConfig,
              seed: baseConfig.seed + 13,
              isHead: true,
            };
          } else if (partKey === "torso") {
            spotsConfig = baseConfig;
          } else if (partKey === "ear") {
            spotsConfig = {
              ...baseConfig,
              seed: baseConfig.seed + 47,
              isLeg: true,
            };
          } else if (partKey === "leg") {
            spotsConfig = {
              ...baseConfig,
              seed: baseConfig.seed + 29,
              isLeg: true,
            };
          } else if (partKey === "sbs_double_chin") {
            spotsConfig = {
              ...baseConfig,
              seed: baseConfig.seed + 71,
              isLeg: true,
            };
          }
        }

        let stripesConfig = null;
        if (f.hasStripes) {
          const baseConfig = {
            color: f.colors.stripes,
            seed: f.stripePatternSeed,
          };
          if (partKey === "head") {
            stripesConfig = {
              ...baseConfig,
              seed: baseConfig.seed + 13,
              isHead: true,
            };
          } else if (partKey === "torso") {
            stripesConfig = baseConfig;
          } else if (partKey === "ear") {
            stripesConfig = {
              ...baseConfig,
              seed: baseConfig.seed + 47,
              isLeg: true,
            };
          } else if (partKey === "leg") {
            stripesConfig = {
              ...baseConfig,
              seed: baseConfig.seed + 29,
              isLeg: true,
            };
          } else if (partKey === "sbs_double_chin") {
            stripesConfig = {
              ...baseConfig,
              seed: baseConfig.seed + 71,
              isLeg: true,
            };
          }
        }

        let faceData = null;
        if (partKey === "head") {
          let activeExp = "NEUTRAL";
          if (f.expressionOverride && f.expressionOverrideTimer > 0) {
            activeExp = f.expressionOverride;
          } else if (f.expression) {
            activeExp = f.expression;
          } else if (!f.isAlive) {
            activeExp = "SAD";
          }

          faceData = {
            expression: activeExp,
            eyeColor: f.colors ? f.colors.pupil : "black",
            maneType: f.maneType !== undefined ? f.maneType : 0,
            maneColor: f.colors ? f.colors.mane : null,
            gradientConfig: f.hasGradient
              ? {
                  color: f.colors.gradient,
                  intensity: f.gradientIntensity,
                }
              : null,
            hasHorn: !!(f.limbs && f.limbs.horn),
            hornSizeFactor: f.hornSizeFactor || 1.0,
          };
        }

        const gib = new Gib(
          partKey,
          f.colors.body,
          f.scene,
          partKey,
          f.x,
          f.y,
          null, // No grinder
          {
            left: 0,
            right: width,
            top: 0,
            bottom: f.y + f.tinted.torso.height * 0.5,
            isGrinder: false,
          },
          f.scale,
          gibGrowth,
          null,
          spotsConfig,
          gibImg,
          stripesConfig,
          faceData,
        );
        gibs.push(gib);
      }

      // Visual effects

      for (let k = 0; k < 5; k++) {
        poofs.push(
          new Poof(
            f.x + (Math.random() - 0.5) * 50,
            f.y + (Math.random() - 0.5) * 50,
            f.scene,
          ),
        );
      }
    } else {
      // Standard hit if no amputation possible (already gone or torso)

      if (f.tooYoungToSpeak()) {
        f.speak(getDialogue(["HURT", "CHIRPY"], f));
      } else {
        f.speak(getDialogue("HURT", f));
      }
    }

    f.excrete("poop");
    f.excrete("pee");

    if (f.health <= 0) {
      f.die(knife.type);
    } else {
      f.expressionOverride = "CRYING_SHOCKED";
      f.expressionOverrideTimer = 6.0;
      f.initBehavior("FLUFFY_KNOCKED_DOWN");
      f.stateTimer = 0.5;
    }
}

registerScreen({
  name: "surgery",
  layer: 24,
  isOpen: () => isSurgeryOpen(),
  close: () => closeSurgery(),
  draw: (c) => drawSurgery(c),
  click: () => handleSurgeryClick(),
  reset: () => closeSurgery(),
});
