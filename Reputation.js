// ---------------------------------------------------------------------------
// Beyond the house, part 1 (design doc Phase 5): notes from new owners and
// your two reputations.
//
// When one of your fluffies is sold (FamilyTree.noteFluffyLeft), what it was
// like is written down (its profile: tricks, title, fears, temper, how it
// felt about people). A day to three later its new owners may send a note
// (NOTE_CHANCE; a pet shop rarely writes, the shady dealer never does):
//   praise     "Pip learned to fetch, the kids adore him"
//   complaint  "Pip bit our son", "cries all night, scared of the dark"
// The note arrives as a message and in the morning report, and goes in the
// fluffy's story ("After it left you: ...").
//
// Two reputations (keeperRep, saved):
//   families   praise +REP_PRAISE, complaints -REP_COMPLAINT (a bite more).
//              Families and kids knock more often and pay a little more with
//              a good name, less with a bad one (Buyers.js).
//   dark       selling to the shady dealer +REP_DARK_SALE (more for Broken or
//              drilled ones). He comes more often and pays more; families
//              hear about it (a dark name puts them off). Hard to top both.
// Shown in the Household screen.
// ---------------------------------------------------------------------------

const NOTE_CHANCE = { family: 0.75, kid: 0.7, farmer: 0.5, collector: 0.4, show: 0.6, bargain: 0.35, order: 0.6, shop: 0.2, wholesale: 0 };
const REP_PRAISE = 2;
const REP_COMPLAINT = 2;
const REP_BITE = 3;
const REP_DARK_SALE = 3;
const REP_MAX = 40;
const REP_NOTES_KEPT = 30;

function freshKeeperRep() {
  return { family: 0, dark: 0, pending: [], notes: [] };
}
let keeperRep = freshKeeperRep();
let _saleBuyer = null; // who's buying right now (set around noteFluffyLeft)

function _krOk() {
  if (!keeperRep || typeof keeperRep !== "object") keeperRep = freshKeeperRep();
  for (const [k, v] of Object.entries(freshKeeperRep())) if (keeperRep[k] === undefined || typeof keeperRep[k] !== typeof v) keeperRep[k] = v;
  if (!Array.isArray(keeperRep.pending)) keeperRep.pending = [];
  if (!Array.isArray(keeperRep.notes)) keeperRep.notes = [];
  return keeperRep;
}

// What it was like when it left
function saleProfile(f) {
  const tv = (k) => (typeof traitValue === "function" ? traitValue(f, k) : 0);
  const known = typeof knownTricks === "function" ? knownTricks(f) : [];
  const fears = typeof realFears === "function" ? realFears(f) : [];
  return {
    id: f.id,
    name: (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || null,
    male: f.gender === "male",
    foal: f.growth < 1,
    tricks: known.map((k) => (typeof getTrick === "function" && getTrick(k) ? getTrick(k).name.toLowerCase() : k)),
    drilled: known.filter((k) => typeof fearShare === "function" && fearShare(f, k) >= 0.5).length,
    title: typeof titleOf === "function" ? titleOf(f) : null,
    fears: fears.map((x) => (typeof x === "string" ? x : x.key || x.name)).filter(Boolean),
    temper: tv("temper"),
    social: tv("social"),
    trust: f.playerTrust || 0,
    fear: f.playerFear || 0,
    smarty: !!(f.isSmarty && f.isSmarty()),
    happy: f.happiness ?? 0.5,
  };
}

// FamilyTree.noteFluffyLeft
function noteSoldForRep(f, reason) {
  if (!f || reason !== "sold" || !f.adopted) return;
  const r = _krOk();
  const buyer = _saleBuyer || "shop";
  _saleBuyer = null;
  const p = saleProfile(f);
  if (buyer === "shady") {
    r.dark = Math.min(REP_MAX, r.dark + REP_DARK_SALE + (p.title === "Broken" ? 1 : 0) + (p.drilled ? 1 : 0));
    return;
  }
  if (Math.random() > (NOTE_CHANCE[buyer] ?? 0.4)) return;
  r.pending.push({ due: getDayNumber() + 1 + Math.floor(Math.random() * 3), buyer, p });
  if (r.pending.length > 40) r.pending.shift();
}

// The note they write: { text, good, bite }
function writeOwnerNote(p, buyer) {
  const n = p.name || "The fluffy you sold us";
  const he = p.male ? "he" : "she";
  const him = p.male ? "him" : "her";
  const who = { family: "the kids", kid: "I", farmer: "the farmhands", collector: "our guests", show: "the judges", order: "the family", shop: "the customers", bargain: "we" }[buyer] || "we";
  const bad = [];
  const good = [];
  if (p.title === "Broken") bad.push({ text: `${n} doesn't play at all. ${he.charAt(0).toUpperCase() + he.slice(1)} just stares at the wall.`, w: 3 });
  if (p.title === "Rebel") bad.push({ text: `${n} won't listen to anyone and keeps trying to get out.`, w: 3 });
  if (p.smarty || p.temper > 0.35) bad.push({ text: `${n} bit our son. We're thinking about sending ${him} back.`, w: 2, bite: true });
  if (p.fear >= 0.5) bad.push({ text: `${n} hides and shakes whenever anyone comes near.`, w: 2 });
  if (p.drilled) bad.push({ text: `${n} does ${p.male ? "his" : "her"} tricks, but trembles the whole time. Is that normal?`, w: 1.5 });
  if (p.fears.length) {
    const what = { thunder: "storms", dark: "the dark", bot: "the robot vacuum" }[p.fears[0]] || p.fears[0];
    bad.push({ text: `${n} cries all night - scared of ${what}.`, w: 1 });
  }
  if (p.tricks.length) good.push({ text: `${n} learned to ${p.tricks[Math.floor(Math.random() * p.tricks.length)]} for us, and ${who} adore ${him}!`, w: 2 });
  if (p.title === "Cherished" || p.trust >= 0.7) good.push({ text: `${n} is so gentle. ${he.charAt(0).toUpperCase() + he.slice(1)} follows ${who === "I" ? "me" : who} everywhere.`, w: 2 });
  if (p.title === "Guardian") good.push({ text: `${n} watches over the little ones like a hawk. Wonderful fluffy.`, w: 2 });
  if (p.social > 0.3) good.push({ text: `${n} has made friends with every fluffy in the street.`, w: 1 });
  if (p.happy >= 0.6) good.push({ text: `${n} settled in straight away. Thank you!`, w: 1 });
  if (!good.length && !bad.length) good.push({ text: `${n} is doing fine. Thanks again.`, w: 1 });
  // Weighted pick: problems speak louder
  const badW = bad.reduce((s, x) => s + x.w, 0);
  const goodW = good.reduce((s, x) => s + x.w, 0);
  const pickFrom = (list) => {
    let r = Math.random() * list.reduce((s, x) => s + x.w, 0);
    for (const x of list) if ((r -= x.w) <= 0) return x;
    return list[list.length - 1];
  };
  const isBad = bad.length && Math.random() < badW / (badW + goodW * 0.8);
  const x = pickFrom(isBad ? bad : good);
  return { text: x.text, good: !isBad, bite: !!x.bite };
}

// Once a game day: notes that are due arrive (one or two)
function _deliverNotes() {
  const r = _krOk();
  const day = getDayNumber();
  let sent = 0;
  for (const item of r.pending.slice()) {
    if (item.due > day || sent >= 2) continue;
    r.pending.splice(r.pending.indexOf(item), 1);
    sent++;
    const note = writeOwnerNote(item.p, item.buyer);
    r.family = Math.max(-REP_MAX, Math.min(REP_MAX, r.family + (note.good ? REP_PRAISE : -(note.bite ? REP_BITE : REP_COMPLAINT))));
    const from = item.p.name ? `${item.p.name}'s new owners` : "a new owner";
    r.notes.push({ day, text: note.text, good: note.good, from, id: item.p.id });
    if (r.notes.length > REP_NOTES_KEPT) r.notes.shift();
    if (typeof addUIMessage === "function") addUIMessage(`A note from ${from}: "${note.text}"`);
    if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `A note from ${from}: "${note.text}"` });
    if (typeof recordStory === "function") recordStory("after", item.p.id, { x: note.text });
  }
}

// ---- Effects (Buyers.js) ----

// Families and kids: how often they come
function familyRepWeight() {
  const r = _krOk();
  const m = 1 + r.family / 40 - (r.dark >= 10 ? 0.25 : r.dark >= 3 ? 0.1 : 0);
  return Math.max(0.5, Math.min(1.6, m));
}
// ...and how much they bring
function familyRepBudget() {
  return 1 + Math.max(-0.15, Math.min(0.15, _krOk().family / 200));
}
function darkRepWeight() {
  return 1 + _krOk().dark / 15;
}
function darkRepGapDays() {
  return _krOk().dark >= 10 ? 1 : 2;
}
function darkRepPay() {
  return 1 + Math.min(0.3, _krOk().dark / 100);
}

function _repWord(v, dark) {
  if (dark) return v >= 20 ? "Notorious" : v >= 10 ? "Trusted" : v >= 3 ? "Known" : "Unknown";
  return v >= 15 ? "Excellent" : v >= 3 ? "Good" : v > -3 ? "Unknown" : v > -10 ? "Mixed" : "Poor";
}
// "Families: Good · Dark market: Known"
function describeReputations() {
  const r = _krOk();
  return { family: _repWord(r.family, false), dark: _repWord(r.dark, true), familyValue: r.family, darkValue: r.dark };
}

const reputationTicker = new Ticker(10);
let _repDay = null;
function updateReputation(dt) {
  if (!reputationTicker.step(dt)) return;
  const day = getDayNumber();
  if (_repDay === day) return;
  _repDay = day;
  _deliverNotes();
}

registerSystem("reputation", updateReputation, 175);
