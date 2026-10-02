// ---------------------------------------------------------------------------
// Wise elders: old fluffies (senior or elderly, Aging.js) steady the young.
//   - A frightened foal runs to an elder in the room if its mum isn't there
//     (Fears.js frightComforter), and calms twice as fast beside one.
//   - Courage: a foal that spends time near an elder of its family
//     (grandma, great-uncle... relatedness ELDER_FAMILY, Kinship.js) loses a
//     little of its fears (ELDER_COURAGE a game hour, each fear) - the
//     other side of foals picking up the fears of whoever raises them
//     (Upbringing.js). It goes in the foal's story the first time.
// The magnifying glass shows it for a foal ("Elder: learning courage
// from ...").
// ---------------------------------------------------------------------------

const ELDER_NEAR = 170; // px
const ELDER_COURAGE = 0.03; // each fear, a game hour
const ELDER_FAMILY = 0.2; // relatedness that counts as family
const eldersTicker = new Ticker(5);

function isWiseElder(o) {
  if (!o || !o.isAlive || o.growth < 1 || typeof lifeStage !== "function") return false;
  const st = lifeStage(o);
  if (st !== "senior" && st !== "elderly") return false;
  if (o.currentStateKey === "SLEEPING" || (typeof isFrightened === "function" && isFrightened(o))) return false;
  return true;
}

// The family elder near this foal (or null)
function elderTeaching(f) {
  if (!f || !f.isAlive || !(f.growth < 1) || typeof fluffies === "undefined") return null;
  let best = null;
  let bd = ELDER_NEAR;
  for (const o of fluffies) {
    if (o === f || o.scene !== f.scene || !isWiseElder(o)) continue;
    const d = Math.hypot(o.x - f.x, o.y - f.y);
    if (d >= bd) continue;
    if (!(typeof relatedness === "function" && relatedness(f, o) >= ELDER_FAMILY)) continue;
    bd = d;
    best = o;
  }
  return best;
}

// Magnifying glass: [text, tone] or null
function describeElder(f) {
  const e = elderTeaching(f);
  if (!e) return null;
  const n = typeof fluffyDisplayName === "function" ? fluffyDisplayName(e) : "an elder";
  return [`Learning courage from ${n}`, "good"];
}

function updateElders(dt) {
  const step = eldersTicker.step(dt);
  if (!step || typeof fluffies === "undefined" || typeof FEARS === "undefined") return;
  for (const f of fluffies) {
    if (!f.isAlive || !(f.growth < 1) || f.tooYoungToWalk && f.tooYoungToWalk() && f.growth < 0.05) continue;
    const e = elderTeaching(f);
    if (!e) continue;
    let eased = 0;
    for (const fe of FEARS) {
      const v = fearOf(f, fe.key);
      if (v <= 0) continue;
      changeFear(f, fe.key, (-ELDER_COURAGE * step) / HOUR_LENGTH);
      eased += v - fearOf(f, fe.key);
    }
    if (eased > 0 && !f._elderCourage && typeof recordStory === "function") {
      f._elderCourage = true;
      const n = (x) => (typeof fluffyDisplayName === "function" ? fluffyDisplayName(x) : "an elder");
      recordStory("turning", f, { x: `${n(f)} learned to be braver from old ${n(e)}.` });
    }
  }
}
registerSystem("elders", updateElders, 133);
