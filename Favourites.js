// ---------------------------------------------------------------------------
// "Bestest babbeh": a grumpy or stuck-up mum picks a favourite.
//
// A mare with a litter of two or more foals still on milk picks one
// "bestest babbeh" (bestestOf) if she's grumpy (temper trait at least
// BESTEST_TEMPER) or looks down on others' colours (coloristDegree at
// least BESTEST_COLORIST). Her bestest is the foal that looks most like
// her or her special friend (the sire if she hasn't one): closest coat
// colour, same kind (pegasus, unicorn...), mane colour (resemblance).
// An only child is never a favourite - there's no one to favour it over.
//
// What it means:
//   - Milk: when she's down to BESTEST_HOLD_BACK feed and her bestest is
//     hungry, she keeps it for her bestest and turns the others away
//     ("Miwkies am fow bestest babbeh!") - unless one is really hungry
//     (BESTEST_GIVES_IN). She feeds it first when it's hungry. It gets a
//     little happier for every feed.
//   - The others resent it: their liking for it drops a little every hour
//     they share a room (BESTEST_RESENT_PER_HOUR), and more each time
//     they're turned away from the milk. That lasts after they've grown up.
//   - She coos over it now and then; they grumble.
// It ends when the litter is weaned (baby_child -> child). Shown in the
// magnifying glass (Family: "Mum's bestest babbeh" / "Not mum's favourite").
// Saved: the mum's bestestId.
// ---------------------------------------------------------------------------

const BESTEST_TEMPER = 0.3;
const BESTEST_COLORIST = 0.5;
const BESTEST_HOLD_BACK = 1; // milk feeds kept for her bestest (when it's hungry)
const BESTEST_GIVES_IN = 0.3; // ...but a foal this hungry she feeds anyway
const BESTEST_RESENT_PER_HOUR = 0.012; // the others' liking for it, an hour together
const BESTEST_RESENT_DENIED = 0.05; // ...and each time they're turned away
const BESTEST_TALK_CHANCE = 0.02; // a second: coos and grumbles
const bestestTicker = new Ticker(5);

// Is she the sort to pick a favourite?
function favouringMum(m) {
  if (!m || !m.isAlive || m.gender !== "female" || m.growth < 1) return false;
  return traitValue(m, "temper") >= BESTEST_TEMPER || (m.coloristDegree || 0) >= BESTEST_COLORIST;
}

// Her foals still on milk (anywhere)
function litterOf(m) {
  const rels = typeof relationships !== "undefined" ? relationships[m.id] : null;
  if (!rels) return [];
  const out = [];
  for (const [id, rel] of Object.entries(rels)) {
    if (rel !== "baby_child") continue;
    const f = fluffies.find((x) => String(x.id) === id);
    if (f && f.isAlive) out.push(f);
  }
  return out;
}

function _rgb(str) {
  const m = String(str || "").match(/\d+/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}

// 0..1: how much foal looks like ref
function resemblance(foal, ref) {
  if (!foal || !ref || !foal.colors || !ref.colors) return 0;
  const a = _rgb(foal.colors.body);
  const b = _rgb(ref.colors.body);
  const coat = 1 - Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 441.7;
  const ma = _rgb(foal.colors.mane);
  const mb = _rgb(ref.colors.mane);
  const mane = 1 - Math.hypot(ma[0] - mb[0], ma[1] - mb[1], ma[2] - mb[2]) / 441.7;
  return coat * 0.65 + mane * 0.25 + (foal.type === ref.type ? 0.1 : 0);
}

function _bPartner(m) {
  const rels = relationships[m.id] || {};
  const id = Object.keys(rels).find((k) => rels[k] === "special_friend");
  if (id !== undefined) return fluffies.find((x) => String(x.id) === id) || null;
  return null;
}

// Which of the litter she'd pick
function pickBestest(m, litter = litterOf(m)) {
  if (litter.length < 2) return null;
  const partner = _bPartner(m) || fluffies.find((x) => litter[0].fatherId !== null && x.id === litter[0].fatherId) || null;
  let best = null;
  let bestScore = -1;
  for (const f of litter) {
    const s = Math.max(resemblance(f, m), partner ? resemblance(f, partner) : 0);
    if (s > bestScore) {
      bestScore = s;
      best = f;
    }
  }
  return best;
}

// Her bestest babbeh, or null (picks one the first time it's asked)
function bestestOf(m) {
  if (!favouringMum(m)) return null;
  const litter = litterOf(m);
  if (litter.length < 2) {
    if (!litter.length) m.bestestId = null;
    return null;
  }
  let f = m.bestestId !== null && m.bestestId !== undefined ? litter.find((x) => x.id === m.bestestId) : null;
  if (!f) {
    f = pickBestest(m, litter);
    m.bestestId = f ? f.id : null;
    if (f && m.scene === f.scene && !m.tooYoungToSpeak() && m.currentStateKey !== "SLEEPING") m.speak(getDialogue(["BESTEST", "CHOSEN"], m, f), true);
  }
  return f;
}

function mumOf(f) {
  if (!f || f.motherId === null || f.motherId === undefined) return null;
  return fluffies.find((m) => m.id === f.motherId) || null;
}

// HorseFamily.attemptFeedFromMare: does she turn this foal away to keep the
// milk for her bestest?
function bestestHoldsBack(mare, foal) {
  if (!mare || !foal || foal.motherId !== mare.id) return false;
  const best = bestestOf(mare);
  if (!best || best === foal) return false;
  return mare.milkCharges <= BESTEST_HOLD_BACK && best.hunger < 0.6 && foal.hunger > BESTEST_GIVES_IN;
}

// ...and when she does
function noteTurnedAway(mare, foal) {
  const best = bestestOf(mare);
  if (!best) return;
  if (typeof changeOpinion === "function") changeOpinion(foal, best, -BESTEST_RESENT_DENIED, "mum's favourite");
  foal.changeHappiness(-0.03);
  if (mare.happiness > WAN_DIE_THRESHOLD) mare.speak(getDialogue(["BESTEST", "SAVE_MILK"], mare, foal));
}

// ...and when her bestest feeds
function noteBestestFed(mare, foal) {
  if (bestestOf(mare) !== foal) return;
  foal.changeHappiness(0.02);
  if (Math.random() < 0.3 && mare.happiness > WAN_DIE_THRESHOLD) mare.speak(getDialogue(["BESTEST", "FEED"], mare, foal));
}

// Magnifying glass: [text, tone] or null
function describeBestest(f) {
  if (!f) return null;
  if (f.gender === "female" && f.growth >= 1) {
    const b = bestestOf(f);
    if (b) return [`Favours ${typeof fluffyDisplayName === "function" ? fluffyDisplayName(b) : "one foal"} ("bestest babbeh")`, "bad"];
    return null;
  }
  const mum = mumOf(f);
  const b = mum ? bestestOf(mum) : null;
  if (!b) return null;
  if (b === f) return ["Mum's bestest babbeh", "good"];
  return [`Not mum's favourite (${typeof fluffyDisplayName === "function" ? fluffyDisplayName(b) : "a sibling"} is)`, "bad"];
}

// Every few seconds: the others resent it; she coos, they grumble
function updateBestest(dt) {
  const step = bestestTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  for (const m of fluffies) {
    if (!m.isAlive || m.gender !== "female" || m.growth < 1 || !favouringMum(m)) continue;
    const best = bestestOf(m);
    if (!best) continue;
    for (const sib of litterOf(m)) {
      if (sib === best || sib.scene !== best.scene || sib.scene !== m.scene || sib.currentStateKey === "SLEEPING") continue;
      if (typeof changeOpinion === "function") changeOpinion(sib, best, -(BESTEST_RESENT_PER_HOUR * step) / HOUR_LENGTH);
      if (!sib.tooYoungToSpeak() && Math.random() < BESTEST_TALK_CHANCE * step * 0.5 && (!sib.speech || !sib.speech.text)) sib.speak(getDialogue(["BESTEST", "RESENT"], sib, best));
    }
    if (m.scene === best.scene && m.currentStateKey !== "SLEEPING" && Math.random() < BESTEST_TALK_CHANCE * step * 0.5 && (!m.speech || !m.speech.text))
      m.speak(getDialogue(["BESTEST", "COO"], m, best));
  }
}
registerSystem("bestest", updateBestest, 62);
