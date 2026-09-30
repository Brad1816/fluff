// ---------------------------------------------------------------------------
// Family stories (design doc Phase 5): a line of fluffies builds a name.
//
// A line is everyone descended from the same first known mother
// (lineRootOf, through the family records). With LINE_MIN of them alive and
// yours, what they're like together becomes the line's reputation
// (lineReputation): "Daisy's line is famously gentle and clever". Shown in
// the magnifying glass (Family, "Line").
//
// Traditions: when a mare and her own mother both know a trick, it's the
// line's tradition. Her foals learn it from her while they're little (the
// two of them in the same room): TRADITION_LEARN a day, and a story line
// when it sticks ("Bean learnt to sit from her mother, like all of Daisy's
// line").
// Echoes: a foal that grows the same fear as its grandmother gets a line in
// its story: "Afraid of thunder, like her grandmother Daisy."
// ---------------------------------------------------------------------------

const LINE_MIN = 3;
const LINE_DEPTH = 8;
const TRADITION_LEARN = 0.08;

function _flRec(id) {
  return typeof getFamilyRecord === "function" ? getFamilyRecord(id) : null;
}
function _flMum(id) {
  const rec = _flRec(id);
  if (rec && rec.motherId !== null && rec.motherId !== undefined) return rec.motherId;
  const f = typeof fluffies !== "undefined" ? fluffies.find((x) => x.id === id) : null;
  return f && f.motherId !== null && f.motherId !== undefined ? f.motherId : null;
}
function _flName(id) {
  if (typeof fluffyNames !== "undefined" && fluffyNames[id]) return fluffyNames[id];
  const rec = _flRec(id);
  return rec && typeof getFamilyName === "function" ? getFamilyName(rec) : "a fluffy";
}

// The first mother we know of
function lineRootOf(id) {
  let cur = id;
  for (let i = 0; i < LINE_DEPTH; i++) {
    const m = _flMum(cur);
    if (m === null || m === undefined) break;
    cur = m;
  }
  return cur;
}

// Your living fluffies in this line
function lineMembers(root) {
  if (typeof fluffies === "undefined") return [];
  return fluffies.filter((f) => f.isAlive && f.adopted && lineRootOf(f.id) === root);
}

// "famously gentle and clever" (or null)
function lineReputation(root) {
  const m = lineMembers(root);
  if (m.length < LINE_MIN) return null;
  const tv = (f, k) => (typeof traitValue === "function" ? traitValue(f, k) : 0);
  const avg = (k) => m.reduce((s, f) => s + tv(f, k), 0) / m.length;
  const out = [];
  const temper = avg("temper");
  const brave = avg("bravery");
  const social = avg("social");
  if (temper <= -0.25) out.push("famously gentle");
  else if (temper >= 0.3) out.push("known for its tempers");
  if (brave >= 0.25) out.push("brave");
  else if (brave <= -0.25) out.push("timid");
  if (social >= 0.25) out.push("friendly");
  if (typeof knownTricks === "function" && m.filter((f) => knownTricks(f).length).length >= m.length / 2) out.push("clever");
  if (m.filter((f) => f.isSmarty && f.isSmarty()).length >= m.length / 3) out.push("has a Smarty streak");
  if (!out.length) return null;
  const two = out.slice(0, 2);
  return two.length === 2 ? `${two[0]} and ${two[1]}` : two[0];
}

function describeLine(f) {
  if (!f) return null;
  const root = lineRootOf(f.id);
  if (root === f.id && !lineMembers(root).some((o) => o !== f)) return null;
  const n = _flName(root);
  const rep = lineReputation(root);
  const count = lineMembers(root).length;
  return [`${n}'s line${rep ? `: ${rep}` : ""} (${count} with you)`, rep && /gentle|clever|brave|friendly/.test(rep) ? "good" : ""];
}

// ---- Traditions ----

// The trick a mare's line passes down (she and her mother both know it)
function lineTradition(mare) {
  if (!mare || typeof knownTricks !== "function") return null;
  const mine = knownTricks(mare);
  if (!mine.length) return null;
  const mumId = _flMum(mare.id);
  const mum = mumId !== null && typeof fluffies !== "undefined" ? fluffies.find((x) => x.id === mumId) : null;
  // (her mother taught it to her: alive or not, if she knew it)
  const theirs = mum ? knownTricks(mum) : mare._learntFromMum ? [mare._learntFromMum] : [];
  return mine.find((k) => theirs.includes(k)) || (mare._learntFromMum && mine.includes(mare._learntFromMum) ? mare._learntFromMum : null);
}

function _flTeach(foal) {
  if (!(foal.growth < 1) || foal.tooYoungToWalk() || !foal.adopted) return;
  const mum = typeof fluffies !== "undefined" ? fluffies.find((x) => x.id === foal.motherId && x.isAlive) : null;
  if (!mum || mum.scene !== foal.scene) return;
  const key = lineTradition(mum);
  if (!key || typeof trickSkill !== "function" || trickSkill(foal, key) >= TRICK_KNOWN) return;
  const before = trickSkill(foal, key);
  if (typeof _trLearn === "function") _trLearn(foal, key, TRADITION_LEARN);
  if (before < TRICK_KNOWN && trickSkill(foal, key) >= TRICK_KNOWN) {
    foal._learntFromMum = key;
    const root = lineRootOf(foal.id);
    const he = foal.gender === "male" ? "his" : "her";
    if (typeof recordStory === "function") recordStory("turning", foal, { x: `${_flName(foal.id)} learnt to ${getTrick(key).name.toLowerCase()} from ${he} mother, like all of ${_flName(root)}'s line.` });
  }
}

// ---- Echoes ----

function _flEcho(f) {
  if (!f.adopted || f._echoed || typeof realFears !== "function") return;
  const mumId = _flMum(f.id);
  const granId = mumId !== null ? _flMum(mumId) : null;
  if (granId === null || granId === undefined) return;
  const gran = typeof fluffies !== "undefined" ? fluffies.find((x) => x.id === granId) : null;
  if (!gran) return;
  const hers = realFears(gran).map((x) => x.key);
  const mine = realFears(f).find((x) => hers.includes(x.key));
  if (!mine) return;
  f._echoed = true;
  const he = f.gender === "male" ? "his" : "her";
  if (typeof recordStory === "function") recordStory("turning", f, { x: `${_flName(f.id)} is afraid of ${mine.name}, like ${he} grandmother ${_flName(granId)}.` });
}

const familyLinesTicker = new Ticker(5);
let _flDay = null;
function updateFamilyLines(dt) {
  if (!familyLinesTicker.step(dt) || typeof fluffies === "undefined") return;
  const day = typeof getDayNumber === "function" ? getDayNumber() : 1;
  const newDay = _flDay !== day;
  _flDay = day;
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    if (newDay) _flTeach(f);
    _flEcho(f);
  }
}

registerSystem("familyLines", updateFamilyLines, 133);
