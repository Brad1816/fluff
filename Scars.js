// ---------------------------------------------------------------------------
// Scars (design doc Phase 3): serious injuries leave lasting marks.
//
// f.scars = [{ kind, how, day }] (saved; at most SCAR_MAX). Where from:
//   - a fight that draws blood (HorseSocial.performAttack): half the time
//     (SCAR_FIGHT_CHANCE) a bite leaves a torn ear or a scarred flank, a
//     stomp a crooked tail or a scarred flank: "Bitten by Snowball in a
//     fight on day 14"
//   - you (Memory.notePlayerViolence): the knife or scalpel often
//     (SCAR_WEAPON_CHANCE), the prod, stick and tack now and then
// Kinds: torn ear, scarred flank, bald patch, crooked tail, nicked muzzle.
// They never fade. They're drawn on the body (drawScars, HorseRenderer),
// listed in the magnifying glass (Looks, "Scars": hover for how), go in its
// story, make it an "owie" to the others (Identity.js), and cost it at
// shows (SCAR_SHOW_PENALTY each) and in price (SCAR_PRICE each, at most
// SCAR_PRICE_MAX).
// ---------------------------------------------------------------------------

const SCAR_MAX = 5;
const SCAR_FIGHT_CHANCE = 0.5;
const SCAR_WEAPON_CHANCE = { knife: 0.6, scalpel: 0.5, cattle_prod: 0.25, stick: 0.12, thumbtack: 0.1 };
const SCAR_SHOW_PENALTY = 3;
const SCAR_PRICE = 0.05;
const SCAR_PRICE_MAX = 0.2;

const SCAR_KINDS = {
  ear: { name: "torn ear" },
  flank: { name: "scarred flank" },
  bald: { name: "bald patch" },
  tail: { name: "crooked tail" },
  muzzle: { name: "nicked muzzle" },
};

// What each hurt can leave
const SCAR_FROM = {
  FLUFFY_BITE: ["ear", "flank"],
  FLUFFY_JAB: ["flank", "tail"],
  FLUFFY_STOMPIE: ["tail", "flank"],
  knife: ["flank", "muzzle", "ear"],
  scalpel: ["flank", "muzzle"],
  cattle_prod: ["bald"],
  stick: ["bald", "tail"],
  thumbtack: ["bald"],
};

const SCAR_WEAPON_WORDS = {
  knife: "Cut with the knife",
  scalpel: "Cut with the scalpel",
  cattle_prod: "Burnt by the prod",
  stick: "Beaten with the stick",
  thumbtack: "Stabbed with a tack",
};

function scarsOf(f) {
  return f && Array.isArray(f.scars) ? f.scars : [];
}

function _scDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : 1;
}

// Leaves a scar. Returns it (or null: no room left for a new one)
function addScar(f, kind, how) {
  if (!f || !f.isAlive || !SCAR_KINDS[kind]) return null;
  if (!Array.isArray(f.scars)) f.scars = [];
  if (f.scars.length >= SCAR_MAX) return null;
  // (a tail it hasn't got can't be crooked)
  if (kind === "tail" && f.limbs && f.limbs.tail === false) kind = "flank";
  const scar = { kind, how: String(how || "Hurt"), day: _scDay() };
  f.scars.push(scar);
  const name = SCAR_KINDS[kind].name;
  if (typeof recordStory === "function") recordStory("scar", f, { x: `${name}: ${scar.how.charAt(0).toLowerCase()}${scar.how.slice(1)}` });
  return scar;
}

function _scPick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// HorseSocial.performAttack, when it draws blood
function scarFromFight(victim, attacker, move) {
  if (!victim || Math.random() > SCAR_FIGHT_CHANCE) return null;
  const kinds = SCAR_FROM[move] || SCAR_FROM.FLUFFY_JAB;
  const who = typeof fluffyDisplayName === "function" && attacker ? fluffyDisplayName(attacker) : "another fluffy";
  const verb = move === "FLUFFY_BITE" ? "Bitten" : "Stomped on";
  return addScar(victim, _scPick(kinds), `${verb} by ${who} in a fight on day ${_scDay()}`);
}

// Memory.notePlayerViolence: you hurt it
function scarFromYou(victim, weaponType) {
  const p = SCAR_WEAPON_CHANCE[weaponType];
  if (!victim || !p || Math.random() > p) return null;
  return addScar(victim, _scPick(SCAR_FROM[weaponType]), `${SCAR_WEAPON_WORDS[weaponType]} on day ${_scDay()}`);
}

// Shows.showScore
function scarShowPenalty(f) {
  return scarsOf(f).length * SCAR_SHOW_PENALTY;
}

// HorseGenetics price
function scarPriceMultiplier(f) {
  return 1 - Math.min(SCAR_PRICE_MAX, scarsOf(f).length * SCAR_PRICE);
}

// Magnifying glass: ["Torn ear, scarred flank", "bad", hover lines]
function describeScars(f) {
  const s = scarsOf(f);
  if (!s.length) return null;
  const names = s.map((x) => (SCAR_KINDS[x.kind] || { name: x.kind }).name);
  const text = names.join(", ");
  return [text.charAt(0).toUpperCase() + text.slice(1), "", s.map((x) => { const n = (SCAR_KINDS[x.kind] || { name: x.kind }).name; return `${n.charAt(0).toUpperCase() + n.slice(1)}: ${x.how}`; })];
}

// ---- Drawing (HorseRenderer: after the torso, the head and the tail) ----
// In the part's own frame, as drawPart sets it up
const SCAR_PINK = "rgba(200, 120, 130, 0.85)";

function drawScars(ctx, renderer, part) {
  const f = renderer && renderer.horse;
  const scars = scarsOf(f);
  if (!scars.length || !renderer.layout) return;
  const L = renderer.layout;
  const rect = L[part];
  if (!rect) return;
  const has = (k) => scars.filter((s) => s.kind === k).length;
  ctx.save();
  ctx.translate(rect.x, rect.y);
  ctx.rotate(rect.angle);
  ctx.lineCap = "round";
  if (part === "torso") {
    const w = rect.w;
    const h = rect.h;
    const flank = has("flank");
    for (let i = 0; i < flank; i++) {
      // a couple of pale slashes on its side
      const x = -w * 0.12 + i * w * 0.14;
      const y = -h * 0.05 + (i % 2) * h * 0.08;
      ctx.strokeStyle = SCAR_PINK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.07, y - h * 0.08);
      ctx.lineTo(x + w * 0.07, y + h * 0.1);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let t = -2; t <= 2; t++) {
        const sx = x + (t / 2) * w * 0.06;
        const sy = y + (t / 2) * h * 0.08;
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy + 4);
        ctx.lineTo(sx + 4, sy - 4);
        ctx.stroke();
      }
    }
    if (has("bald")) {
      ctx.fillStyle = "rgba(235, 190, 180, 0.8)";
      ctx.beginPath();
      ctx.ellipse(w * 0.12, -h * 0.25, w * 0.08, h * 0.1, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (part === "head") {
    const hs = typeof renderer.getHeadScale === "function" ? renderer.getHeadScale() : 1;
    ctx.scale(hs, hs);
    const ox = -rect.w * 0.25;
    const oy = -rect.h * 0.85;
    if (has("ear")) {
      // a notch out of the ear
      ctx.fillStyle = "rgba(90, 40, 50, 0.9)";
      const ex = ox + rect.w * 0.22;
      const ey = oy + rect.h * 0.17;
      ctx.beginPath();
      ctx.moveTo(ex - 6, ey - 5);
      ctx.lineTo(ex + 2, ey + 3);
      ctx.lineTo(ex + 6, ey - 7);
      ctx.closePath();
      ctx.fill();
    }
    if (has("muzzle")) {
      ctx.strokeStyle = SCAR_PINK;
      ctx.lineWidth = 2.5;
      const mx = ox + rect.w * 0.87;
      const my = oy + rect.h * 0.72;
      ctx.beginPath();
      ctx.moveTo(mx - 7, my - 6);
      ctx.lineTo(mx + 6, my + 6);
      ctx.stroke();
    }
  } else if (part === "tail" && has("tail")) {
    // a kink near the tip
    const ox = -rect.w * 0.8;
    const oy = -rect.h * 0.1;
    ctx.strokeStyle = "rgba(80, 50, 50, 0.7)";
    ctx.lineWidth = 3;
    const tx = ox + rect.w * 0.3;
    const ty = oy + rect.h * 0.55;
    ctx.beginPath();
    ctx.moveTo(tx - 6, ty - 6);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx - 6, ty + 6);
    ctx.stroke();
  }
  ctx.restore();
}
