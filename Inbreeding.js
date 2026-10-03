// ---------------------------------------------------------------------------
// Inbreeding, and breeding sensitive babies.
//
// INBREEDING. Breeding close kin (Kinship.js relatedness) is a lazy path, not
// a dead end:
//   - Stillbirths: a foal whose parents share a bad gene pair (the miscarry
//     genes, HorseAnatomy.triggerPregnancy) is normally born dead. When its
//     parents are kin (relatedness >= INBRED_KIN), it pulls through
//     INBRED_PULL_THROUGH of the time - alive, but always deformed.
//   - Deformities (f.deformities, saved): any foal of kin may be born with
//     some (DEFORM_PER_KIN x relatedness, so a brother and sister's foals
//     about half the time, cousins' rarely; sometimes two):
//       dim         simple-minded: 20 points less clever (Intelligence.js)
//       crooked     a crooked leg (or wing, or horn): drawn bent, slower;
//                   a crooked wing can't flap (Injuries.js limbState "crooked")
//       sickly      catches illness twice as easily (Illness.js)
//       odd         not right in the head: says strange things, stares at
//                   nothing, and isn't put off mating kin (Kinship.js)
//     Each takes DEFORM_PRICE off its price. The magnifying glass lists
//     them ("Deformities").
//
// SENSITIVE BABIES (Horse.isSensitive): it runs in families. Born to a
// sensitive mum, SB_FROM_MUM; to a sensitive dad, SB_FROM_DAD (both: both);
// times 4 for each matching miscarry gene pair, as before. A sensitive
// fluffy can be bred - in a breeding cage, it can't manage by itself - but
// it wears it out: each time, its health can only get back to so much
// (f.breedWear, saved: the cap is 100 - SB_WEAR_HEALTH x wear) and it heals
// back SB_WEAR_HEAL a day. Too worn (SB_TOO_WORN) and it can't be bred.
// ---------------------------------------------------------------------------

const INBRED_KIN = 0.125; // cousins (0.125), half-siblings (0.25), siblings and parents (0.5)
const INBRED_PULL_THROUGH = 0.6;
const DEFORM_PER_KIN = 1.0; // chance of a deformity = this x relatedness
const DEFORM_PRICE = 0.85;
const DEFORMITIES = {
  dim: { name: "Simple-minded", weight: 3 },
  crooked: { name: "Crooked", weight: 3 },
  sickly: { name: "Sickly", weight: 2 },
  odd: { name: "Odd (not right in the head)", weight: 2 },
};
const SB_BASE = 0.04;
const SB_FROM_MUM = 0.35;
const SB_FROM_DAD = 0.3;
const SB_WEAR_PER_BREED = 0.35;
const SB_WEAR_HEALTH = 60;
const SB_WEAR_HEAL = 0.2; // a game day
const SB_TOO_WORN = 0.75;
const inbreedingTicker = new Ticker(5);

function kinOf(a, b) {
  return typeof relatedness === "function" && a && b ? relatedness(a, b) : 0;
}

function hasDeformity(f, key) {
  return !!(f && Array.isArray(f.deformities) && f.deformities.includes(key));
}

// HorseAnatomy.triggerPregnancy: a foal with a bad gene pair - does it pull
// through? (only foals of kin)
function inbredPullsThrough(mum, dad) {
  return kinOf(mum, dad) >= INBRED_KIN && Math.random() < INBRED_PULL_THROUGH;
}

// HorseAnatomy.spawnBaby: a living foal of these parents - any deformities?
// flawed: it pulled through a bad gene pair (then at least one)
function rollDeformities(baby, mum, dad, flawed = false) {
  const kin = kinOf(mum, dad);
  if (!flawed && kin < INBRED_KIN) return [];
  let n = 0;
  if (flawed) n = 1;
  else if (Math.random() < DEFORM_PER_KIN * kin) n = 1;
  if (n && Math.random() < kin) n = 2;
  const out = [];
  for (let k = 0; k < n; k++) {
    const keys = Object.keys(DEFORMITIES).filter((x) => !out.includes(x));
    let r = Math.random() * keys.reduce((s, x) => s + DEFORMITIES[x].weight, 0);
    let pick = keys[0];
    for (const x of keys) {
      r -= DEFORMITIES[x].weight;
      if (r <= 0) {
        pick = x;
        break;
      }
    }
    out.push(pick);
  }
  if (!out.length) return out;
  baby.deformities = out;
  if (out.includes("crooked")) _crookedPart(baby);
  if (out.includes("odd") && !baby.personalities.includes("odd")) baby.personalities = [...baby.personalities, "odd"];
  if (mum && mum.adopted && typeof addUIMessage === "function") {
    const names = out.map((k) => DEFORMITIES[k].name.toLowerCase().replace(/ \(.*\)/, ""));
    addUIMessage(`A foal was born ${names.join(" and ")} - its parents are too closely related.`);
  }
  return out;
}

// A crooked leg - or, on a pegasus or unicorn, sometimes the wing or horn
function _crookedPart(f) {
  const opts = ["leg_0", "leg_1", "leg_2", "leg_3"];
  if (f.limbs && f.limbs.leftWing) opts.push("leftWing");
  if (f.limbs && f.limbs.horn) opts.push("horn");
  const part = opts[Math.floor(Math.random() * opts.length)];
  if (!f.limbState || typeof f.limbState !== "object") f.limbState = {};
  f.limbState[part] = "crooked";
}

function deformityPriceMultiplier(f) {
  return Math.pow(DEFORM_PRICE, Array.isArray(f.deformities) ? f.deformities.length : 0);
}

// Magnifying glass: [text, tone] or null
function describeDeformities(f) {
  if (!Array.isArray(f.deformities) || !f.deformities.length) return null;
  const parts = f.deformities.map((k) => {
    if (k === "crooked") {
      const p = Object.keys(f.limbState || {}).find((x) => f.limbState[x] === "crooked");
      return p === "horn" ? "a crooked horn" : p === "leftWing" || p === "rightWing" ? "a crooked wing (can't flap)" : "a crooked leg";
    }
    return (DEFORMITIES[k] || { name: k }).name.toLowerCase();
  });
  return [`Born ${parts.join(", ")} (inbred)`, "bad"];
}

// HorseTalk randomBabble: an odd one says odd things now and then
function oddBabble(f) {
  if (!hasDeformity(f, "odd") || f.tooYoungToSpeak() || Math.random() > 0.2) return null;
  if (Math.random() < 0.3) {
    // ...or just stares at nothing for a bit
    if (f.currentStateKey === "IDLE") {
      f.initBehavior("SITTING");
      f.stateTimer = 4;
    }
  }
  return getDialogue("ODD", f);
}

// ---- Sensitive babies ----

// HorseAnatomy.spawnBaby: how likely this foal is to be born sensitive
function sensitiveBirthChance(mum, dad, babyGenes) {
  let chance = SB_BASE;
  if (mum && mum.isSensitive && mum.isSensitive()) chance += SB_FROM_MUM;
  if (dad && dad.isSensitive && dad.isSensitive()) chance += SB_FROM_DAD;
  if (babyGenes) {
    if (babyGenes[65] === babyGenes[66]) chance *= 4;
    if (babyGenes[67] === babyGenes[68]) chance *= 4;
    if (babyGenes[69] === babyGenes[70]) chance *= 4;
  }
  return Math.min(0.95, chance);
}

function sensitiveCanBreed(f) {
  return !!(f && f.isSensitive && f.isSensitive() && (f.breedWear || 0) < SB_TOO_WORN && f.health >= 50);
}

// HorseMating.finishMating: a sensitive one bred - it wears it out
function noteSensitiveBred(f) {
  if (!f || !f.isSensitive || !f.isSensitive()) return;
  f.breedWear = Math.min(1, (f.breedWear || 0) + SB_WEAR_PER_BREED);
  f.health = Math.min(f.health, healthCapOf(f));
}

// The most its health can get back to (HorseUpdate healing)
function healthCapOf(f) {
  return 100 - SB_WEAR_HEALTH * Math.max(0, Math.min(1, (f && f.breedWear) || 0));
}

function describeBreedWear(f) {
  if (!(f.breedWear > 0.01)) return null;
  return [`Worn out from breeding: health up to ${Math.round(healthCapOf(f))}${(f.breedWear || 0) >= SB_TOO_WORN ? " (too worn to breed)" : ""}`, f.breedWear >= SB_TOO_WORN ? "bad" : "ok"];
}

function updateInbreeding(dt) {
  const step = inbreedingTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  for (const f of fluffies) {
    if (!(f.breedWear > 0) || !f.isAlive) continue;
    f.breedWear = Math.max(0, f.breedWear - (SB_WEAR_HEAL * step) / DAY_LENGTH);
  }
}
registerSystem("inbreeding", updateInbreeding, 127);
