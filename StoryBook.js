// ---------------------------------------------------------------------------
// The story book (design doc Phase 0, stage 3): one shared record of what
// happens, that every fluffy, family and herd points into. Phase 1 turns it
// into each fluffy's Story tab; for now it records, and the debug view
// (StoryDebug.js) shows it.
//
// storyBook.events (saved, SAVED_GAME_STATE "storyBook"), oldest first:
//   { i: id, t: game seconds, k: kind, w: [fluffy ids - the first is who
//     it's mostly about], s?: scene, h?: herd id, x?: detail (text/number),
//     q?: a line a fluffy said, n?: times (merged repeats) }
// An event is stored once, however many fluffies it involves; storyOf(f)
// finds every event f is in (an index rebuilt on load), and storyOfFamily
// gathers a wider story.
//
// Big events (STORY_KINDS with big: true - births, deaths, names, sales,
// tricks learnt, lessons that stuck, harm from you, shows, scars...) are kept
// for good, even after the fluffy is gone. Harm from you repeated within
// STORY_MERGE_HARM seconds adds to the same event (n).
//
// Small things (brushing, meals from you, play, frights, comfort, being
// attacked...) don't get an event each: they go into one tally per fluffy
// per game day ({ k: "tally", w: [id], d: day, c: { brushed: 3, ... } }).
// Once a game day (compactStory):
//   - day tallies older than a year (12 days) merge into one per fluffy per
//     year (y: year),
//   - a fluffy that's gone (dead, sold, ran off): its tallies merge into
//     one for its whole life (life: true),
//   - if the book is still over STORY_CAP_BYTES (about 20 MB, estimated),
//     year tallies merge into one per fluffy for its whole life (life: true).
// Big events are never merged away or dropped.
// ---------------------------------------------------------------------------

const STORY_CAP_BYTES = 20 * 1024 * 1024;
const STORY_EVENT_BYTES = 90; // rough size of an event in the save
const STORY_MERGE_HARM = 60;

// kind: { big, text(ev, name, other) } - text is plain English for the debug
// view (Phase 1 writes the real chapters)
const STORY_KINDS = {
  born: { big: true, text: (e, n, o) => `${n} was born${o ? ` to ${o}` : ""}.` },
  stillborn: { big: true, text: (e, n, o) => `${o || "A mare"} lost a foal at birth.` },
  died: { big: true, text: (e, n) => `${n} died${e.x ? ` (${String(e.x).toLowerCase()})` : ""}.` },
  arrived: { big: true, text: (e, n) => `${n} came to ${e.x || "you"}.` },
  abandoned: { big: true, text: (e, n) => `${n} was abandoned by its owner.` },
  named: { big: true, text: (e, n) => `Named ${e.x || n}.` },
  sold: { big: true, text: (e, n) => `${n} ${e.x === "sold" ? "was sold" : e.x || "left"}.` },
  trick: { big: true, text: (e, n) => `${n} learnt to ${String(e.x || "do a trick").toLowerCase()}.` },
  lesson_done: { big: true, text: (e, n) => `${n} ${e.x || "learnt its lesson"}.` },
  reformed: { big: true, text: (e, n) => `${n} stopped being a Smarty.` },
  harmed: { big: true, text: (e, n) => `${n}: ${String(e.x || "hurt by you").toLowerCase()}${e.n > 1 ? ` (${e.n} times)` : ""}.` },
  scarred: { big: true, text: (e, n) => `${n} was scarred for life: ${String(e.x || "").toLowerCase()}.` },
  show: { big: true, text: (e, n) => `${n} came ${e.x} at a show.` },
  herd_formed: { big: true, text: (e, n) => `A new herd formed around ${n}: the ${e.x}.` },
  // Phase 1 (LifeStory.js, Identity.js): x is the whole line
  backstory: { big: true, text: (e, n) => `${n}, before you: ${e.x}` },
  turning: { big: true, text: (e) => `Turning point: ${e.x}` },
  fav_found: { big: true, text: (e) => `${e.x}` },
  trait_shift: { big: true, text: (e) => `${e.x}` },
  boarding: { big: true, text: (e) => `${e.x}` },
  injured: { big: true, text: (e, n) => `${n} lost ${e.x}.` },
  fostered: { big: true, text: (e, n, o) => `${n} was taken in by ${o || "a wild mare"}.` }, // (Fostering.js)
  // Phase 2 (Wishes.js, Dreams.js)
  wish_granted: { big: true, text: (e) => `${e.x}` },
  wish_denied: { big: true, text: (e) => `${e.x}` },
  nightmare: { big: false },
  photo: { big: true, text: (e, n) => { const p = typeof photoById === "function" ? photoById(e.x) : null; return `A photo: "${p ? p.caption : n}"`; } }, // (Lives.js)
  after: { big: true, text: (e, n) => `${n}, after leaving you: ${e.x}` }, // (Reputation.js)
  // Phase 3 (Gossip.js, Scars.js)
  shared: { big: true, text: (e, n) => { const m = typeof sharedMemoryById === "function" ? sharedMemoryById(e.x) : null; return `${n} was there for ${m ? m.name : "a moment they all remember"}.`; } },
  scar: { big: true, text: (e, n) => `${n} was left with a ${e.x || "scar"}.` },
  gossip: { big: true, text: (e, n) => `${n}: ${String(e.x || "").replace(/\{obj\}/g, "it").replace(/\{poss\}/g, "its")}` },
  dream: { big: false },
  ill: { big: true, text: (e, n) => `${n} caught ${e.x}.` },
  feedbot_tip: { big: false },
  // Small things (tallies)
  brushed: { big: false },
  held_happy: { big: false },
  fed: { big: false },
  treat: { big: false },
  gift: { big: false },
  toy: { big: false },
  patched: { big: false },
  vet: { big: false },
  praised: { big: false },
  played: { big: false },
  bathed: { big: false },
  fright: { big: false },
  comforted: { big: false },
  attacked: { big: false },
  lesson: { big: false },
  scolded: { big: false }, // (Care.js)
  drilled: { big: false }, // (FearTraining.js)
};

function freshStoryBook() {
  return { events: [], nextId: 1 };
}

let storyBook = freshStoryBook();
let _storyIndex = null; // fluffy id -> [events] (rebuilt when needed)
let _storyIndexBook = null;

function _stNow() {
  return typeof timePlayed === "number" ? Math.round(timePlayed) : 0;
}
// Days start at midnight, same as the clock ("Day 3" here is Day 3 on the clock)
function _stDay() {
  if (typeof getDayNumber === "function") return getDayNumber() - 1;
  return typeof DAY_LENGTH === "number" ? Math.floor(_stNow() / DAY_LENGTH) : 0;
}

// A saved book that isn't a book (bad or very old save): start a fresh one
function _storyBookOk() {
  if (!storyBook || !Array.isArray(storyBook.events)) storyBook = freshStoryBook();
  if (!(storyBook.nextId > 0)) storyBook.nextId = storyBook.events.reduce((m, e) => Math.max(m, e.i || 0), 0) + 1;
}

function _storyIndexFor() {
  _storyBookOk();
  if (_storyIndex && _storyIndexBook === storyBook && _storyIndex._n === storyBook.events.length) return _storyIndex;
  const idx = new Map();
  for (const e of storyBook.events) for (const id of e.w || []) {
    if (!idx.has(id)) idx.set(id, []);
    idx.get(id).push(e);
  }
  idx._n = storyBook.events.length;
  _storyIndex = idx;
  _storyIndexBook = storyBook;
  return idx;
}

function _storyAdd(e) {
  storyBook.events.push(e);
  if (_storyIndex && _storyIndexBook === storyBook) {
    for (const id of e.w || []) {
      if (!_storyIndex.has(id)) _storyIndex.set(id, []);
      _storyIndex.get(id).push(e);
    }
    _storyIndex._n = storyBook.events.length;
  }
  return e;
}

function _idOf(x) {
  if (x === null || x === undefined) return null;
  return typeof x === "object" ? x.id : x;
}

// Write something into the story. who: a fluffy or id, or a list (the first
// is who it's mostly about). opts: { x, q, s }. Returns the event (or the
// tally for small kinds).
function recordStory(kind, who, opts = {}) {
  _storyBookOk();
  const def = STORY_KINDS[kind];
  const ids = (Array.isArray(who) ? who : [who]).map(_idOf).filter((v) => v !== null && v !== undefined);
  if (!def || !ids.length) return null;
  const now = _stNow();
  // What happens to it slowly changes who it is (Personality.js)
  if (typeof noteGrowthEvent === "function" && (kind === "comforted" || kind === "harmed" || kind === "played" || kind === "attacked")) {
    const who = typeof fluffies !== "undefined" ? fluffies.find((x) => x.id === ids[0]) : null;
    if (who) noteGrowthEvent(who, kind, opts);
  }
  // The room's feel (Climate.js)
  if (typeof noteClimateStory === "function") noteClimateStory(kind, ids, opts);
  if (typeof noteTitleStory === "function" && kind === "harmed") noteTitleStory(kind, ids, opts); // strain (Titles.js)
  // Big moments they went through together (SharedMemories.js)
  if (typeof noteSharedStory === "function" && (kind === "born" || kind === "show" || kind === "died")) noteSharedStory(kind, ids, opts);
  if (!def.big) return _tally(ids[0], kind);
  // Harm from you, again soon: add to the last one
  if (kind === "harmed") {
    const mine = _storyIndexFor().get(ids[0]) || [];
    const last = mine[mine.length - 1];
    if (last && last.k === "harmed" && last.x === opts.x && now - last.t < STORY_MERGE_HARM) {
      last.n = (last.n || 1) + 1;
      last.t = now;
      return last;
    }
  }
  const e = { i: storyBook.nextId++, t: now, k: kind, w: ids };
  const main = typeof fluffies !== "undefined" ? fluffies.find((f) => f.id === ids[0]) : null;
  const scene = opts.s || (main && main.scene);
  if (scene) e.s = scene;
  if (main && typeof herdOf === "function") {
    const h = herdOf(main);
    if (h) e.h = h.id;
  }
  if (opts.x !== undefined && opts.x !== null) e.x = opts.x;
  if (opts.q) e.q = String(opts.q).slice(0, 160);
  return _storyAdd(e);
}

// One tally per fluffy per game day
function _tally(id, kind) {
  const day = _stDay();
  const mine = _storyIndexFor().get(id) || [];
  let t = null;
  for (let i = mine.length - 1; i >= 0 && i >= mine.length - 12; i--) {
    if (mine[i].k === "tally" && mine[i].d === day) {
      t = mine[i];
      break;
    }
  }
  if (!t) t = _storyAdd({ i: storyBook.nextId++, t: _stNow(), k: "tally", w: [id], d: day, c: {} });
  t.c[kind] = (t.c[kind] || 0) + 1;
  return t;
}

// ---- Reading it ----

// Everything this fluffy (or id) is in, oldest first
function storyOf(f) {
  const id = _idOf(f);
  return (_storyIndexFor().get(id) || []).slice();
}

// Its family's shared story: it, its parents, brothers and sisters, and
// foals (from the family record book, FamilyTree.js)
function storyOfFamily(f) {
  const id = _idOf(f);
  const ids = new Set([id]);
  let rec = typeof getFamilyRecord === "function" ? getFamilyRecord(id) : null;
  // (the family book syncs once a second; a fluffy just born may not be in it yet)
  const live = typeof fluffies !== "undefined" ? fluffies.find((x) => x.id === id) : null;
  if (!rec && live) rec = { motherId: live.motherId ?? null, fatherId: live.fatherId ?? null };
  if (live && typeof fluffies !== "undefined")
    for (const x of fluffies) if (x.motherId === id || x.fatherId === id) ids.add(x.id);
  if (rec) {
    if (rec.motherId !== null && rec.motherId !== undefined) ids.add(rec.motherId);
    if (rec.fatherId !== null && rec.fatherId !== undefined) ids.add(rec.fatherId);
  }
  if (typeof getFamilyChildren === "function") for (const c of getFamilyChildren(id)) ids.add(c.id);
  if (typeof fluffyRecords !== "undefined" && rec) {
    for (const r of Object.values(fluffyRecords)) {
      if (r.id === id) continue;
      if ((rec.motherId != null && r.motherId === rec.motherId) || (rec.fatherId != null && r.fatherId === rec.fatherId)) ids.add(r.id);
    }
  }
  const idx = _storyIndexFor();
  const seen = new Set();
  const out = [];
  for (const x of ids) for (const e of idx.get(x) || []) {
    if (seen.has(e.i) || e.k === "tally") continue;
    seen.add(e.i);
    out.push(e);
  }
  return out.sort((a, b) => a.t - b.t || a.i - b.i);
}

function storyTotals() {
  _storyBookOk();
  let big = 0;
  let tallies = 0;
  let talliedActs = 0;
  const kinds = {};
  for (const e of storyBook.events) {
    if (e.k === "tally") {
      tallies++;
      for (const v of Object.values(e.c)) talliedActs += v;
    } else big++;
    kinds[e.k] = (kinds[e.k] || 0) + 1;
  }
  return { events: storyBook.events.length, big, tallies, talliedActs, kinds, bytes: storySizeEstimate() };
}

function storySizeEstimate() {
  _storyBookOk();
  let n = 0;
  for (const e of storyBook.events) n += STORY_EVENT_BYTES + (e.q ? e.q.length : 0) + (e.c ? Object.keys(e.c).length * 14 : 0) + (e.w.length - 1) * 6;
  return n;
}

// Plain English line for an event (debug view; Phase 1 does it properly)
function storyEventText(e) {
  const name = (id) =>
    typeof fluffyDisplayNameById === "function"
      ? fluffyDisplayNameById(id)
      : typeof getFamilyName === "function"
        ? getFamilyName(getFamilyRecord(id))
        : `#${id}`;
  if (e.k === "tally") {
    const span = e.life ? "Over its life" : e.y !== undefined ? `Year ${e.y + 1}` : `Day ${e.d + 1}`;
    const parts = Object.entries(e.c).map(([k, v]) => `${k.replace("_", " ")} x${v}`);
    return `${span}, small things: ${parts.join(", ")}`;
  }
  const def = STORY_KINDS[e.k];
  const other = e.w.length > 1 ? name(e.w[1]) : null;
  const base = def && def.text ? def.text(e, name(e.w[0]), other) : `${e.k} ${name(e.w[0])}`;
  return e.q ? `${base} "${e.q}"` : base;
}

// ---- Keeping it a sensible size ----

function compactStory(force = false) {
  _storyBookOk();
  const day = _stDay();
  const perYear = typeof DAYS_PER_YEAR === "number" ? DAYS_PER_YEAR : 12;
  let changed = false;
  // Day tallies older than a year -> one per fluffy per year
  const keep = [];
  const years = new Map();
  for (const e of storyBook.events) {
    if (e.k === "tally" && e.d !== undefined && e.y === undefined && !e.life && day - e.d >= perYear) {
      const y = Math.floor(e.d / perYear);
      const key = `${e.w[0]}:${y}`;
      let t = years.get(key);
      if (!t) {
        t = { i: e.i, t: e.t, k: "tally", w: [e.w[0]], y, c: {} };
        years.set(key, t);
        keep.push(t);
      }
      for (const [k, v] of Object.entries(e.c)) t.c[k] = (t.c[k] || 0) + v;
      changed = true;
    } else keep.push(e);
  }
  // Merge into existing year tallies of the same fluffy and year
  if (changed) {
    const seen = new Map();
    const out = [];
    for (const e of keep) {
      if (e.k === "tally" && e.y !== undefined && !e.life) {
        const key = `${e.w[0]}:${e.y}`;
        const prev = seen.get(key);
        if (prev) {
          for (const [k, v] of Object.entries(e.c)) prev.c[k] = (prev.c[k] || 0) + v;
          continue;
        }
        seen.set(key, e);
      }
      out.push(e);
    }
    storyBook.events = out;
  }
  // Fluffies that are gone (died, sold, ran off): their small things merge
  // into one tally for their whole life - nobody needs them day by day any
  // more, and a busy house's book (and save) grew by hundreds of them
  if (typeof fluffies !== "undefined") {
    const here = new Set(fluffies.map((f) => f.id));
    if (typeof dayCareFluffies !== "undefined") for (const d of dayCareFluffies) here.add(d.id);
    const lives = new Map();
    const out = [];
    let merged = false;
    for (const e of storyBook.events) {
      if (e.k === "tally" && !here.has(e.w[0]) && (e.y !== undefined || e.life || (e.d !== undefined && day - e.d >= 1))) {
        let t = lives.get(e.w[0]);
        if (!t) {
          t = e.life ? e : { i: e.i, t: e.t, k: "tally", w: [e.w[0]], life: true, c: {} };
          lives.set(e.w[0], t);
          out.push(t);
          if (t === e) continue;
        }
        for (const [k, v] of Object.entries(e.c)) t.c[k] = (t.c[k] || 0) + v;
        merged = true;
      } else out.push(e);
    }
    if (merged) {
      storyBook.events = out;
      changed = true;
    }
  }
  // Still too big: year tallies -> one per fluffy for life
  if (force || storySizeEstimate() > STORY_CAP_BYTES) {
    const lives = new Map();
    const out = [];
    for (const e of storyBook.events) {
      if (e.k === "tally" && (e.y !== undefined || e.life)) {
        let t = lives.get(e.w[0]);
        if (!t) {
          t = { i: e.i, t: e.t, k: "tally", w: [e.w[0]], life: true, c: {} };
          lives.set(e.w[0], t);
          out.push(t);
        }
        for (const [k, v] of Object.entries(e.c)) t.c[k] = (t.c[k] || 0) + v;
        changed = true;
      } else out.push(e);
    }
    storyBook.events = out;
  }
  if (changed) _storyIndex = null;
  return changed;
}

// Events older than a game year that are only about fluffies nobody keeps
// (wild ones long gone: FamilyTree.js tidyFamilyRecords). Returns how many went.
function pruneOldStory(keepIds) {
  _storyBookOk();
  const yearT = (typeof DAYS_PER_YEAR === "number" ? DAYS_PER_YEAR : 12) * (typeof DAY_LENGTH === "number" ? DAY_LENGTH : 1200);
  const cutoff = _stNow() - yearT;
  const before = storyBook.events.length;
  storyBook.events = storyBook.events.filter((e) => e.t >= cutoff || !Array.isArray(e.w) || e.w.some((id) => keepIds.has(String(id))));
  const gone = before - storyBook.events.length;
  if (gone) _storyIndex = null;
  return gone;
}

const storyTicker = new Ticker(60);
let _storyLastCompactDay = null;
function updateStoryBook(dt) {
  if (!storyTicker.step(dt)) return;
  _storyBookOk();
  const day = _stDay();
  if (_storyLastCompactDay !== day) {
    _storyLastCompactDay = day;
    compactStory();
  }
}
registerSystem("storyBook", updateStoryBook, 15);
