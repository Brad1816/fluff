// ---------------------------------------------------------------------------
// Scars (design doc Phase 3): serious injuries leave lasting marks.
//
// f.scars = [{ kind, how, day, where }] (saved; at most SCAR_MAX). Where from:
//   - a fight that draws blood (HorseSocial.performAttack): half the time
//     (SCAR_FIGHT_CHANCE) a bite leaves a torn ear or a scarred flank, a
//     stomp a crooked tail or a scarred flank: "Bitten by Snowball in a
//     fight on day 14"
//   - you (Memory.notePlayerViolence): the knife or scalpel often
//     (SCAR_WEAPON_CHANCE), the prod, stick and tack now and then
// Kinds: torn ear, scarred flank, bald patch, crooked tail, nicked muzzle.
// They never fade. They're drawn on the body (drawScars, HorseRenderer),
// listed in the magnifying glass (Looks, "Scars": hover for how and where;
// one nobody saw gets a likely story, describeScarOrigin), go in its
// story, make it an "owie" to the others (Identity.js), and cost it at
// shows (SCAR_SHOW_PENALTY each) and in price (SCAR_PRICE each, at most
// SCAR_PRICE_MAX).
// ---------------------------------------------------------------------------

const SCAR_MAX = 5;
const SCAR_FIGHT_CHANCE = 0.5;
const SCAR_WEAPON_CHANCE = { knife: 0.6, scalpel: 0.5, cattle_prod: 0.25, stick: 0.12, thumbtack: 0.1, throw: 0.15 };
const SCAR_SHOW_PENALTY = 3;
const SCAR_PRICE = 0.05;
const SCAR_PRICE_MAX = 0.2;

const SCAR_KINDS = {
  ear: { name: "torn ear" },
  flank: { name: "scarred flank" },
  bald: { name: "bald patch" },
  tail: { name: "crooked tail" },
  muzzle: { name: "nicked muzzle" },
  burn: { name: "burn scar" }, // a wound burnt shut (CauteryIron.js): where it was in scar.at
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
  throw: ["tail", "muzzle", "flank"],
};

const SCAR_WEAPON_WORDS = {
  knife: "Cut with the knife",
  scalpel: "Cut with the scalpel",
  cattle_prod: "Burnt by the prod",
  stick: "Beaten with the stick",
  thumbtack: "Stabbed with a tack",
  throw: "Hurt landing when thrown",
};

function scarsOf(f) {
  return f && Array.isArray(f.scars) ? f.scars : [];
}

// Leaves a scar. Returns it (or null: no room left for a new one).
// opts.at: where on the body (a burn: the wound it closed); opts.always:
// it's left even when it already has SCAR_MAX (a burn is never skipped)
function addScar(f, kind, how, opts = {}) {
  if (!f || !f.isAlive || !SCAR_KINDS[kind]) return null;
  if (!Array.isArray(f.scars)) f.scars = [];
  if (f.scars.length >= SCAR_MAX && !opts.always) return null;
  // (a tail it hasn't got can't be crooked)
  if (kind === "tail" && f.limbs && f.limbs.tail === false) kind = "flank";
  const scar = { kind, how: String(how || "Hurt"), day: getDayNumber(), where: _scPlace(f.scene) };
  if (opts.at) scar.at = opts.at;
  f.scars.push(scar);
  const name = SCAR_KINDS[kind].name;
  if (typeof recordStory === "function") recordStory("scar", f, { x: `${name}: ${scar.how.charAt(0).toLowerCase()}${scar.how.slice(1)}` });
  return scar;
}

// Where it happened, in words ("in the living room", "in the park")
function _scPlace(scene) {
  if (!scene) return null;
  if (typeof houseRoomName === "function" && houseRoomName(scene)) return `in the ${houseRoomName(scene).toLowerCase()}`;
  if (scene === "BACKYARD") return "in the backyard";
  if (typeof PARK_SCENE !== "undefined" && scene === PARK_SCENE) return "in the park";
  if (/ALLEY/.test(scene)) return "in Shelter Alley";
  return "outside";
}

// A likely story for a scar nobody saw happen (from before it was yours,
// or an old save): the same one every time for the same scar
const SCAR_GUESSES = {
  ear: ["Torn in a scrap with a stray, before it was yours", "Caught on a wire fence, long ago", "Bitten by a jealous herd-mate in the park"],
  flank: ["Raked by a cat's claws, before it was yours", "Grazed on a broken fence, long ago", "A dog's bite, from its life outside"],
  bald: ["Fur rubbed away in a too-small box, before it was yours", "A burn from something hot, long ago", "Pulled out in a fight over food"],
  tail: ["Shut in a door, before it was yours", "Stepped on in a crowded pen, long ago", "Bent in a fall, from its life outside"],
  muzzle: ["Nipped by its mum as a foal", "Cut on a sharp tin can, before it was yours", "A scratch from a cornered rat, long ago"],
};
function _scGuess(f, scar, i) {
  const list = SCAR_GUESSES[scar.kind] || ["Hurt, before it was yours"];
  const seed = Math.abs(((f && f.id) || 0) * 31 + i * 7 + (scar.kind || "").length);
  return list[seed % list.length];
}

// "Bitten by Snowball in a fight on day 14, in the living room"
function describeScarOrigin(f, scar, i = 0) {
  if (!scar.how || scar.how === "Hurt") return _scGuess(f, scar, i);
  return scar.where ? `${scar.how}, ${scar.where}` : scar.how;
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
  return addScar(victim, _scPick(kinds), `${verb} by ${who} in a fight on day ${getDayNumber()}`);
}

// Memory.notePlayerViolence: you hurt it
function scarFromYou(victim, weaponType) {
  const p = SCAR_WEAPON_CHANCE[weaponType];
  if (!victim || !p || Math.random() > p) return null;
  return addScar(victim, _scPick(SCAR_FROM[weaponType]), `${SCAR_WEAPON_WORDS[weaponType]} on day ${getDayNumber()}`);
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
  return [`${text.charAt(0).toUpperCase() + text.slice(1)} (hover for how)`, "", s.map((x, i) => { const n = (SCAR_KINDS[x.kind] || { name: x.kind }).name; return `${n.charAt(0).toUpperCase() + n.slice(1)}: ${describeScarOrigin(f, x, i)}`; })];
}

// ---- Drawing (HorseRenderer: after the torso, the head and the tail) ----
// In the part's own frame, as drawPart sets it up
const SCAR_PINK = "rgba(200, 120, 130, 0.85)";

function drawScars(ctx, renderer, part, layout = renderer && renderer.layout) {
  const f = renderer && renderer.horse;
  const scars = scarsOf(f);
  if (!scars.length || !layout) return;
  const L = layout;
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
    for (const b of scars) if (b.kind === "burn" && !_scOnHead(b.at)) _scDrawBurn(ctx, _scBurnSpot(b.at, w, h), Math.min(w, h) * 0.13);
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
    for (const b of scars) {
      if (b.kind !== "burn" || !_scOnHead(b.at)) continue;
      // by the ear, the eye or the horn it was
      const spot = /Ear$/.test(b.at) ? [0.22, 0.2] : /Eye$/.test(b.at) ? [0.62, 0.42] : [0.45, 0.08];
      _scDrawBurn(ctx, [ox + rect.w * spot[0], oy + rect.h * spot[1]], rect.w * 0.09);
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

// ---- Burn scars (CauteryIron.js) ----

function _scOnHead(at) {
  return /Ear$|Eye$|^horn$/.test(at || "");
}

// Where on the body (torso-local, facing right) a burnt-shut wound is
function _scBurnSpot(at, w, h) {
  if (at === "leg_1" || at === "leg_2") return [w * 0.24, h * 0.36];
  if (at === "leg_0" || at === "leg_3") return [-w * 0.26, h * 0.36];
  if (at === "tail") return [-w * 0.42, -h * 0.18];
  if (/Wing$/.test(at || "")) return [-w * 0.04, -h * 0.34];
  if (at === "lumps" || at === "udders" || at === "spay") return [-w * 0.08, h * 0.38];
  return [w * 0.05, h * 0.05];
}

// A shiny, puckered patch: dark in the middle, pale round the edge
function _scDrawBurn(ctx, [x, y], r) {
  ctx.save();
  ctx.fillStyle = "rgba(225, 160, 150, 0.85)";
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rr = r * (1 + 0.22 * Math.sin(i * 2.7));
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(130, 50, 45, 0.8)";
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.55, r * 0.4, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 230, 225, 0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x - r * 0.15, y - r * 0.1, r * 0.3, Math.PI * 1.1, Math.PI * 1.7);
  ctx.stroke();
  ctx.restore();
}
