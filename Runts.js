// ---------------------------------------------------------------------------
// Runts, and a mum turning a foal away because it "nu smeww pwetty".
//
// RUNTS: a living foal can be born a runt (f.runt, saved): RUNT_BASE, more
// in a big litter (RUNT_PER_FOAL for each foal over 3), between kin
// (RUNT_PER_KIN x relatedness) and after a hard pregnancy (RUNT_POOR_CARE x
// how poor her care was). A runt is smaller (RUNT_SIZE as a newborn,
// RUNT_SIZE_GROWN grown), weaker (born at most RUNT_HEALTH health, a weaker
// start), grows slower (RUNT_GROWTH) and sells for less (RUNT_PRICE).
//
// THE SMELL: when one of her foals first drinks from her - and again if it
// falls ill - a mum sniffs it. A runt, a deformed foal (Inbreeding.js) or a
// sick one (Illness.js flu) can smell wrong to her, and she turns it away:
// no milk from her from then on (it's a "rejected_baby", as when she
// doesn't know it after the incubator), and she may shove it. It cries for
// her and goes hungry unless a foster mum, a feeder or the Feed-Bot feeds
// it; a mum like that counts as gone, so a foster mum may take it in
// (Fostering.js). How likely (smellRejectChance): SMELL_BASE for each
// thing wrong with it, more for a grumpy mum, half again for one who never
// learned the mummah song (Lullaby.js), less for a mum on her last chance
// (BadMummah.js) - and none at all once she's had the "All babies" lesson.
//
// THE LESSON: "All babies" (Lessons row: a mare expecting or with foals,
// or one who's slipped before, who hasn't had it all yet): each lesson that sinks in is a step (LESSON_BABIES) towards loving
// every foal whatever it smells like (f.babyLove, saved). Every step makes
// her less likely to turn one away; at 100% she never does, and takes back
// any foal of hers she turned away that's still on her (and still hers).
// Shown in the magnifying glass (Looks: "Runt"; Family: "Rejected").
// ---------------------------------------------------------------------------

const RUNT_BASE = 0.06;
const RUNT_PER_FOAL = 0.02;
const RUNT_PER_KIN = 0.2;
const RUNT_POOR_CARE = 0.12;
const RUNT_MAX = 0.4;
const RUNT_SIZE = 0.72;
const RUNT_SIZE_GROWN = 0.88;
const RUNT_HEALTH = 70;
const RUNT_GROWTH = 0.85;
const RUNT_PRICE = 0.7;
const SMELL_BASE = 0.3;
const SMELL_WEIGHT = { runt: 1, deformed: 1.2, sick: 0.7 };
const LESSON_BABIES = 0.2;

// ---- Runts ----

function runtChance(mum, dad) {
  let p = RUNT_BASE;
  const litter = (mum && mum.litterSize) || 0;
  if (litter > 3) p += RUNT_PER_FOAL * (litter - 3);
  if (typeof kinOf === "function" && mum && dad) p += RUNT_PER_KIN * kinOf(mum, dad);
  const care = mum && typeof mum.litterCareAt === "number" ? mum.litterCareAt : 0.7;
  p += RUNT_POOR_CARE * Math.max(0, 0.7 - care) / 0.7;
  return Math.max(0, Math.min(RUNT_MAX, p));
}

// HorseAnatomy.spawnBaby, a living foal: a runt?
function rollRunt(baby, mum, dad) {
  // Born here: it has to learn the mummah song (Lullaby.js)
  baby.knowsSong = false;
  if (Math.random() >= runtChance(mum, dad)) return false;
  makeRunt(baby);
  if (mum && mum.adopted && typeof addUIMessage === "function") addUIMessage(`One of ${typeof fluffyDisplayName === "function" ? fluffyDisplayName(mum) : "your mare"}'s foals is a runt: small and weak.`);
  return true;
}

function makeRunt(f) {
  f.runt = true;
  f.birthVigor = Math.max(0.7, (f.birthVigor ?? 1) * 0.85);
  f.health = Math.min(f.health ?? 100, RUNT_HEALTH);
  if (typeof f.updateGrowthStats === "function") f.updateGrowthStats();
}

// Horse.updateGrowthStats: how much smaller it is
function runtScale(f) {
  if (!f || !f.runt) return 1;
  const g = Math.max(0, Math.min(1, f.growth || 0));
  return RUNT_SIZE + (RUNT_SIZE_GROWN - RUNT_SIZE) * g;
}

// Pregnancy.foalGrowthRate
function runtGrowthRate(f) {
  return f && f.runt ? RUNT_GROWTH : 1;
}

// HorseGenetics price
function runtPriceMultiplier(f) {
  return f && f.runt ? RUNT_PRICE : 1;
}

// ---- The smell ----

// What's wrong with it that she might smell: ["runt", "deformed", "sick"]
function smellFaults(f) {
  const out = [];
  if (!f) return out;
  if (f.runt) out.push("runt");
  if (Array.isArray(f.deformities) && f.deformities.length) out.push("deformed");
  if (typeof hasFlu === "function" && hasFlu(f)) out.push("sick");
  return out;
}

function babyLoveOf(m) {
  return Math.max(0, Math.min(1, (m && m.babyLove) || 0));
}

function smellRejectChance(m, f, faults = smellFaults(f)) {
  if (!faults.length) return 0;
  let p = 0;
  for (const k of faults) p += SMELL_BASE * (SMELL_WEIGHT[k] || 1);
  const temper = typeof traitValue === "function" ? traitValue(m, "temper") : 0;
  p *= 1 + 0.6 * temper;
  if (typeof knowsSong === "function" && !knowsSong(m)) p *= 1.5; // (a poorer mother)
  p *= 1 - babyLoveOf(m);
  return Math.max(0, Math.min(0.9, p));
}

// HorseFamily.attemptFeedFromMare, her own foal about to drink: does she
// sniff it and turn it away? (once for each new thing wrong with it)
function mumSniffsFoal(m, f) {
  if (!m || !f || f.motherId !== m.id || m.currentStateKey === "SLEEPING") return false;
  const faults = smellFaults(f);
  const fresh = faults.filter((k) => !(Array.isArray(f.sniffed) && f.sniffed.includes(k)));
  if (!fresh.length) return false;
  f.sniffed = [...(Array.isArray(f.sniffed) ? f.sniffed : []), ...fresh];
  if (Math.random() >= smellRejectChance(m, f, fresh)) return false;
  // On her last chance she may hold herself back (BadMummah.js)
  if (typeof mumHoldsBack === "function" && mumHoldsBack(m, f)) return false;
  rejectBySmell(m, f, fresh[0]);
  return true;
}

function rejectBySmell(m, f, why = "runt") {
  setRelationship(m.id, f.id, "rejected_baby");
  f.smellRejected = why;
  f.milkCooldown = 3;
  f.changeHappiness(-0.1, "Mummah turned it away");
  if (m.happiness > WAN_DIE_THRESHOLD) m.speak(getDialogue(["SMELL", "REJECT"], m, f), true);
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 2.5;
  // ...and maybe a shove (it never kills)
  if (Math.random() < 0.5 && m.attackCooldown <= 0 && typeof m.performAttack === "function") m.performAttack(f, "BULLY");
  if (typeof noteMumMisdeed === "function") noteMumMisdeed(m, f, "rejected"); // (Care.js, BadMummah.js)
  const nm = (x) => (typeof fluffyDisplayName === "function" ? fluffyDisplayName(x) : "a fluffy");
  if ((m.adopted || f.adopted) && typeof addUIMessage === "function")
    addUIMessage(`${nm(m)} sniffed ${nm(f)} and turned it away ("nu smeww pwetty") - she won't nurse it. A feeder, the Feed-Bot or a foster mum will have to.`);
  if (typeof recordStory === "function") recordStory("turning", f, { x: `${nm(m)} sniffed ${nm(f)} and turned it away: it didn't smell right to her.` });
  return true;
}

// ---- Mums who won't (or can't) nurse a foal ----

// Its mum's alive but she won't nurse it: she turned it away, it was taken
// from her (BadMummah.js), or it doesn't know her any more (FoalLife.js)
function mumDisowned(f) {
  if (!f || f.motherId === null || f.motherId === undefined) return false;
  if (f.forgotMum) return true;
  const mum = typeof fluffies !== "undefined" ? fluffies.find((m) => m.id === f.motherId) : null;
  if (!mum || !mum.isAlive) return false;
  const rel = (relationships[mum.id] || {})[f.id];
  return rel === "rejected_baby" || rel === "estranged_child" || (rel === "child" && f.growth < 1);
}

// HorseActionHandler.executeChirpyBabyMilk: skip her and look elsewhere
function mumWontNurse(mum, f) {
  return mumDisowned(f) || (typeof mumAway === "function" && mumAway(mum));
}

// ---- The lesson ----

LESSONS.push({
  key: "babies",
  name: "All babies",
  // (a mare expecting, with foals, or who's started on it or slipped before)
  applies: (f) =>
    f.gender === "female" &&
    f.growth >= 1 &&
    !f.spayed &&
    babyLoveOf(f) < 0.999 &&
    (f.isPregnant || babyLoveOf(f) > 0 || (f.badMum && f.badMum.slips > 0) || (typeof litterOf === "function" && litterOf(f).length > 0)),
  progress: (f) => babyLoveOf(f),
  teach: (f) => {
    f.babyLove = Math.min(1, babyLoveOf(f) + LESSON_BABIES);
    if (f.babyLove < 0.999) return false;
    takeBackRejected(f);
    return true;
  },
  doneMsg: (n) => `${n} will love all her babies now, whatever they smell like! ✓`,
});

// She takes back the foals of hers she turned away (still on her)
function takeBackRejected(m) {
  const rels = relationships[m.id] || {};
  let n = 0;
  for (const f of fluffies) {
    if (!f.isAlive || f.motherId !== m.id || f.growth >= 1 || rels[f.id] !== "rejected_baby" || !f.smellRejected) continue;
    setRelationship(m.id, f.id, "baby_child");
    f.smellRejected = null;
    n++;
  }
  if (n && m.adopted && typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(m)} takes back the foal${n === 1 ? "" : "s"} she turned away.`);
  return n;
}

// ---- Magnifying glass ----

function describeRunt(f) {
  if (!f || !f.runt) return null;
  return [f.growth < 1 ? "Runt: small, weak, grows slower" : "Born a runt: small", "bad"];
}

function describeSmellRejected(f) {
  if (!f || !f.isAlive || !f.smellRejected) return null;
  const mum = typeof mumOf === "function" ? mumOf(f) : null;
  if (!mum || !mum.isAlive || (relationships[mum.id] || {})[f.id] !== "rejected_baby") return null;
  const why = { runt: "a runt", deformed: "deformed", sick: "it was sick" }[f.smellRejected] || "?";
  return [`Mum turned it away: it didn't smell right (${why})`, "bad"];
}
