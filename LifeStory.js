// ---------------------------------------------------------------------------
// Life stories (design doc Phase 1): the Story tab in the magnifying glass.
//
// It reads the story book (StoryBook.js) and tells a fluffy's life in plain
// English, like a page of a book, in chapters by how old it was:
//   Before you     (a fluffy that came to you: where it came from, its age)
//   Foalhood       born, first steps and words, who raised it
//   Growing up     its first year: lessons, tricks, fears, friends
//   Adult years    litters, shows, losses
//   Old age        from SENIOR_DAYS: going grey, who stayed close
// Big events each get their own line (storyLine). Small things (brushing,
// treats, frights...) are summed per chapter into a sentence or two
// ("You brushed her almost every day and cuddled her often."). Litters are
// one line ("She had a litter of 4: Pip, Bean and two more"), and deaths in
// its close family appear in its story too.
// Fluffy-speak only when quoting a line a fluffy said (e.q).
// ---------------------------------------------------------------------------

const LIFE_CHAPTERS = [
  { id: "before", title: "Before you" },
  { id: "foal", title: "Foalhood" },
  { id: "young", title: "Growing up" },
  { id: "adult", title: "Adult years" },
  { id: "old", title: "Old age" },
];

// The small things you do, as the words of a sentence ("brushed her ...")
const LIFE_KIND_ACTS = {
  brushed: (p) => `brushed ${p.obj}`,
  held_happy: (p) => `cuddled ${p.obj}`,
  fed: (p) => `filled ${p.poss} bowl`,
  treat: (p) => `gave ${p.obj} treats`,
  gift: (p) => `gave ${p.obj} presents`,
  toy: (p) => `brought ${p.obj} toys`,
  played: (p) => `played ball with ${p.obj}`,
  praised: (p) => `praised ${p.obj}`,
  bathed: (p) => `bathed ${p.obj}`,
  patched: (p) => `patched up ${p.poss} wounds`,
  vet: (p) => `took ${p.obj} to the vet`,
};

function storyDayNumber(t) {
  const start = typeof START_HOUR === "number" ? START_HOUR * HOUR_LENGTH : 0;
  return Math.floor(((t || 0) + start) / DAY_LENGTH) + 1;
}

function _lsPronouns(gender) {
  return gender === "male"
    ? { sub: "he", obj: "him", poss: "his", Sub: "He", Poss: "His" }
    : { sub: "she", obj: "her", poss: "her", Sub: "She", Poss: "Her" };
}

function _lsLive(id) {
  return typeof fluffies !== "undefined" ? fluffies.find((x) => x.id === id) || null : null;
}

// "Daisy", or "a pink unicorn mare" for one without a name
function lifeStoryName(id) {
  const n = typeof fluffyNames !== "undefined" ? fluffyNames[id] : null;
  if (n) return n;
  const f = _lsLive(id);
  if (f && typeof describeFluffyLooks === "function") return `a ${describeFluffyLooks(f)}`;
  const rec = typeof getFamilyRecord === "function" ? getFamilyRecord(id) : null;
  if (rec && rec.name) return rec.name;
  if (rec && typeof describeRecordLooks === "function") return `a ${describeRecordLooks(rec)}`;
  return "a fluffy";
}

function _lsCap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function _lsList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// When it was born (game seconds)
function _lsBornAt(f) {
  const rec = typeof getFamilyRecord === "function" ? getFamilyRecord(f.id) : null;
  if (rec && typeof rec.bornAt === "number") return rec.bornAt;
  return (typeof timePlayed === "number" ? timePlayed : 0) - (f.age || 0);
}

function _lsChapterAt(f, t, bornAt, arrivedAt) {
  if (arrivedAt !== null && t <= arrivedAt) return "before";
  const days = (t - bornAt) / DAY_LENGTH;
  if (days < GROW_UP_TIME / DAY_LENGTH) return "foal";
  if (days < DAYS_PER_YEAR) return "young";
  if (days < SENIOR_DAYS) return "adult";
  return "old";
}

function _lsFamily(f) {
  const rec = (typeof getFamilyRecord === "function" && getFamilyRecord(f.id)) || {};
  const mum = rec.motherId ?? f.motherId ?? null;
  const dad = rec.fatherId ?? f.fatherId ?? null;
  const rel = new Map(); // id -> "mum" | "dad" | "foal" | "brother" | "sister" | "special friend"
  if (mum !== null) rel.set(mum, "mum");
  if (dad !== null) rel.set(dad, "dad");
  if (typeof getFamilyChildren === "function") for (const c of getFamilyChildren(f.id)) rel.set(c.id, "foal");
  if (typeof fluffies !== "undefined") for (const x of fluffies) if (x.motherId === f.id || x.fatherId === f.id) rel.set(x.id, "foal");
  if (typeof getFamilySiblings === "function") {
    for (const s of getFamilySiblings(f.id)) if (!rel.has(s.rec.id)) rel.set(s.rec.id, s.rec.gender === "male" ? "brother" : "sister");
  }
  const rels = typeof relationships !== "undefined" ? relationships[f.id] || {} : {};
  for (const [id, r] of Object.entries(rels)) if (r === "special_friend") rel.set(+id, "special friend");
  return { mum, dad, rel };
}

function _lsDeath(cause, p) {
  const c = String(cause || "");
  if (/^old age/i.test(c)) return "died of old age";
  if (/starved/i.test(c)) return "starved to death";
  if (/childbirth/i.test(c)) return "died giving birth";
  if (/^killed by /i.test(c)) return `was killed by ${c.slice(10)}`;
  if (/^killed with /i.test(c)) return `was ${c.toLowerCase()}`;
  if (/^time ran out/i.test(c)) return "was put down at the shelter when nobody adopted " + p.obj;
  if (!c) return "died";
  return `died (${c.toLowerCase()})`;
}

const _LS_HARM = {
  "Hit with the stick": "was hit with the stick",
  "Poked with a tack": "was poked with a tack",
  "Shocked with the prod": "was shocked with the prod",
  "Cut with a knife": "was cut with a knife",
  "Cut with a scalpel": "was cut with a scalpel",
  "Saw the grinder": "saw the grinder",
  "Saw you hurt a fluffy": "saw you hurt another fluffy",
  "Saw you hurt its family": "saw you hurt its family",
  "Stick potty training": "was potty trained with the stick",
  "Saw you take its family away": "saw you take its family away",
  "Taken from its herd and family": "was taken from its herd and family",
  "Taken from its mum": "was taken from its mum",
};

// One big event as a line of its story, from f's side (null: leave it out)
function storyLine(e, f, fam = null) {
  const p = _lsPronouns(f.gender);
  const me = f.id;
  const day = `on day ${storyDayNumber(e.t)}`;
  const Name = _lsCap(lifeStoryName(me));
  const quote = e.q ? ` "${e.q}"` : "";
  switch (e.k) {
    case "born":
      if (e.w[0] !== me) return null; // (litters: lifeStoryChapters)
      {
        const mum = e.w[1] !== undefined && e.w[1] !== null ? lifeStoryName(e.w[1]) : null;
        const dad = e.w[2] !== undefined && e.w[2] !== null ? lifeStoryName(e.w[2]) : null;
        const to = mum ? ` to ${mum}${dad ? ` and ${dad}` : ""}` : "";
        return `${Name} was born ${day}${to}.`;
      }
    case "died":
      if (e.w[0] === me) return `${p.Sub} ${_lsDeath(e.x, p)} ${day}.`;
      {
        const who = fam && fam.rel.get(e.w[0]);
        if (!who) return null;
        return `${p.Poss} ${who} ${lifeStoryName(e.w[0])} ${_lsDeath(e.x, _lsPronouns((_lsLive(e.w[0]) || {}).gender))} ${day}.`;
      }
    case "arrived":
      return `${p.Sub} came to ${e.x || "you"} ${day}.`;
    case "backstory":
      return e.x ? `${_lsCap(String(e.x).replace(/\.$/, ""))}.` : null;
    case "abandoned":
      return `${p.Sub} was abandoned by ${p.poss} owner.`;
    case "named":
      return `You named ${p.obj} ${e.x || lifeStoryName(me)} ${day}.`;
    case "sold":
      if (e.x === "sold") return `You sold ${p.obj} ${day}.`;
      if (e.x === "given up") return `You gave ${p.obj} up to the shelter ${day}.`;
      if (e.x === "taken") return `${p.Sub} was taken by dogs ${day}.`;
      return `${p.Sub} left ${day}${e.x ? ` (${e.x})` : ""}.`;
    case "trick":
      return `${p.Sub} learnt to ${String(e.x || "do a trick").toLowerCase()} ${day}.`;
    case "lesson_done":
      return `${p.Sub} ${e.x || "learnt a lesson"}.`;
    case "reformed":
      return `${p.Sub} stopped being a Smarty.`;
    case "harmed": {
      const what = _LS_HARM[e.x] || `was hurt by you (${String(e.x || "").toLowerCase()})`;
      return `${p.Sub} ${what}${e.n > 1 ? ` (${e.n} times)` : ""} ${day}.`;
    }
    case "scarred":
      return `${p.Sub} was scarred for life: ${String(e.x || "").toLowerCase()}.`;
    case "show":
      return `${p.Sub} came ${e.x} at a show ${day}.`;
    case "herd_formed":
      if (e.w[0] === me) return `A new herd formed around ${p.obj}: the ${e.x}.`;
      return `${p.Sub} joined the ${e.x} when it formed.`;
    case "injured":
      if (e.x === "spay") return `${p.Sub} was spayed ${day}.`;
      return `${p.Sub} lost ${_lsPart(e.x, p)} ${day}.`;
    case "wish_granted":
    case "wish_denied":
      return e.x || null;
    case "ill":
      return `${p.Sub} caught ${e.x || "something"} ${day}.`;
    case "turning":
    case "fav_found":
    case "trait_shift":
    case "boarding":
      return e.x ? `${e.x}${quote}` : null;
    default:
      return null;
  }
}

// "leftEar" -> "an ear"
function _lsPart(part, p) {
  const s = String(part || "");
  if (/ear/i.test(s)) return "an ear";
  if (/eye/i.test(s)) return "an eye";
  if (/wing/i.test(s)) return "a wing";
  if (/leg/i.test(s)) return "a leg";
  if (/horn/i.test(s)) return `${p.poss} horn`;
  if (/tail/i.test(s)) return `${p.poss} tail`;
  if (/lumps/i.test(s)) return `${p.poss} lumps`;
  if (/mane/i.test(s)) return `${p.poss} mane`;
  return s.replace(/([A-Z])/g, " $1").toLowerCase().trim() || "something";
}

function _lsFreq(n, days) {
  const per = n / Math.max(1, days);
  if (per >= 0.8) return "almost every day";
  if (per >= 0.3) return "often";
  if (n >= 4) return "now and then";
  if (n >= 2) return "a couple of times";
  return "once";
}

// A chapter's small things, summed into a sentence or two
function _lsTallyLines(c, days, p) {
  const out = [];
  const acts = [];
  for (const [k, words] of Object.entries(LIFE_KIND_ACTS)) {
    if (c[k]) acts.push(`${words(p)} ${_lsFreq(c[k], days)}`);
  }
  if (acts.length) out.push(`You ${_lsList(acts)}.`);
  if (c.fright) {
    const n = c.fright;
    const comforted = Math.min(n, c.comforted || 0);
    out.push(
      `${p.Sub} had ${n === 1 ? "a fright" : `${n} frights`}${comforted ? `, and you comforted ${p.obj} through ${comforted === n ? (n === 1 ? "it" : "all of them") : `${comforted} of them`}` : ""}.`,
    );
  } else if (c.comforted) out.push(`You comforted ${p.obj} ${_lsFreq(c.comforted, days)}.`);
  if (c.lesson) out.push(`${p.Sub} had ${c.lesson === 1 ? "a lesson" : `${c.lesson} lessons`}.`);
  if (c.attacked) out.push(`Other fluffies went for ${p.obj} ${_lsFreq(c.attacked, days)}.`);
  if (c.nightmare) out.push(`${p.Sub} had ${c.nightmare === 1 ? "a nightmare" : `${c.nightmare} nightmares`} that woke ${p.obj}.`);
  if (c.feedbot_tip) out.push(`${p.Sub} knocked the Feed-Bot over ${c.feedbot_tip === 1 ? "once" : `${c.feedbot_tip} times`}.`);
  return out;
}

// [{ id, title, lines: [text] }] - only chapters with something in them
function lifeStoryChapters(f) {
  if (!f || typeof storyOf !== "function") return [];
  const p = _lsPronouns(f.gender);
  const bornAt = _lsBornAt(f);
  const fam = _lsFamily(f);
  const mine = storyOf(f);
  const arrived = mine.find((e) => e.k === "arrived" && e.w[0] === f.id);
  const arrivedAt = arrived ? arrived.t : null;
  const chapters = new Map(LIFE_CHAPTERS.map((c) => [c.id, { ...c, items: [], tally: {}, days: new Set() }]));
  const add = (t, text, ch = null) => {
    if (!text) return;
    chapters.get(ch || _lsChapterAt(f, t, bornAt, arrivedAt)).items.push({ t, text });
  };

  // Litters it had (or fathered): one line per litter
  const litters = [];
  for (const e of mine) {
    if ((e.k !== "born" && e.k !== "stillborn") || e.w[0] === f.id) continue;
    const role = e.w[1] === f.id ? "mum" : e.w[2] === f.id ? "dad" : null;
    if (!role) continue;
    let l = litters.find((x) => x.role === role && Math.abs(x.t - e.t) < 180);
    if (!l) litters.push((l = { role, t: e.t, foals: [], lost: 0 }));
    if (e.k === "born") l.foals.push(e.w[0]);
    else l.lost++;
  }
  for (const l of litters) {
    const n = l.foals.length + l.lost;
    const named = l.foals.filter((id) => typeof fluffyNames !== "undefined" && fluffyNames[id]).map((id) => fluffyNames[id]);
    const rest = l.foals.length - named.length;
    const names = [...named];
    if (rest) names.push(rest === 1 ? (named.length ? "one more" : "one foal") : `${rest} more`);
    const lost = l.lost ? `${l.foals.length ? "; " : ""}${l.lost === n ? (n === 1 ? "it didn't live" : "none of them lived") : `${l.lost} didn't live`}` : "";
    const who = l.foals.length ? `: ${_lsList(names)}` : "";
    const verb = l.role === "mum" ? `${p.Sub} had` : `${p.Sub} fathered`;
    add(l.t, `${verb} ${n === 1 ? "a foal" : `a litter of ${n}`} on day ${storyDayNumber(l.t)}${who}${lost}.`);
  }

  for (const e of mine) {
    if (e.k === "tally") {
      const ch = e.d !== undefined ? _lsChapterAt(f, e.t, bornAt, arrivedAt) : e.life ? "adult" : _lsChapterAt(f, e.t, bornAt, arrivedAt);
      const c = chapters.get(ch);
      for (const [k, v] of Object.entries(e.c)) c.tally[k] = (c.tally[k] || 0) + v;
      c.days.add(e.d !== undefined ? e.d : `y${e.y}`);
      continue;
    }
    if (e.k === "backstory") {
      add(e.t - 1, storyLine(e, f, fam), "before"); // (first, before its age and "came to you")
      continue;
    }
    add(e.t, storyLine(e, f, fam));
  }
  // Deaths in its close family (they're in their own stories)
  if (typeof storyBook !== "undefined") {
    for (const [id] of fam.rel) {
      for (const e of storyOf(id)) {
        if (e.k === "died" && e.w[0] === id && e.t >= bornAt) add(e.t, storyLine(e, f, fam));
      }
    }
  }
  // Who raised it; how old it was when it came to you
  const foal = chapters.get("foal");
  if (!arrived && fam.mum !== null && foal.items.length) {
    const rec = (typeof getFamilyRecord === "function" && getFamilyRecord(f.id)) || {};
    const foster = rec.fosterMotherId ?? null;
    const raiser = foster !== null ? `${lifeStoryName(foster)}, who took ${p.obj} in,` : `${p.poss} mum ${lifeStoryName(fam.mum)}`;
    foal.items.push({ t: bornAt + 1, text: `${p.Sub} was raised by ${raiser}.` });
  }
  if (arrived && typeof fluffyAgeText === "function") {
    const days = (arrived.t - bornAt) / DAY_LENGTH;
    const age = days < 1 ? "a newborn" : fluffyAgeText(days) + " old";
    chapters.get("before").items.push({ t: arrived.t - 0.5, text: `${p.Sub} was ${age} when ${p.sub} came to you.` });
  }

  // How many days each chapter has lasted so far (for "almost every day")
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  const ageNow = (now - bornAt) / DAY_LENGTH;
  const since = arrivedAt !== null ? (arrivedAt - bornAt) / DAY_LENGTH : 0;
  const span = {
    before: 1,
    foal: [0, GROW_UP_TIME / DAY_LENGTH],
    young: [GROW_UP_TIME / DAY_LENGTH, DAYS_PER_YEAR],
    adult: [DAYS_PER_YEAR, SENIOR_DAYS],
    old: [SENIOR_DAYS, Infinity],
  };
  const daysIn = (id) => {
    const r = span[id];
    if (!Array.isArray(r)) return r;
    return Math.max(1, Math.min(r[1], ageNow) - Math.max(r[0], since));
  };
  const out = [];
  for (const c of chapters.values()) {
    c.items.sort((a, b) => a.t - b.t);
    const lines = c.items.map((x) => x.text);
    lines.push(..._lsTallyLines(c.tally, Math.max(c.days.size, daysIn(c.id)), p));
    if (lines.length) out.push({ id: c.id, title: c.title, lines });
  }
  return out;
}

// ---- The Story tab (drawn inside the magnifying glass, UIInspection.js) ----

let lifeStoryPage = 0;
let _lifeStoryPages = 1;

function _lsLayout(area) {
  return {
    prev: { x: area.x + area.w - 196, y: area.y + area.h - 30, w: 90, h: 28 },
    next: { x: area.x + area.w - 96, y: area.y + area.h - 30, w: 90, h: 28 },
  };
}

// Lines laid out for the area: [{ text, font, colour, gap }] per page
function _lsPages(ctx, f, area) {
  const chapters = lifeStoryChapters(f);
  const rows = [];
  if (!chapters.length) rows.push({ text: "Nothing has happened yet. Its story starts now.", font: "italic 15px Georgia, serif", colour: "rgba(255,255,255,0.6)", h: 22 });
  for (const c of chapters) {
    rows.push({ text: c.title, font: "bold 17px Georgia, serif", colour: "#ffd6f0", h: 26, heading: true });
    ctx.font = "15px Georgia, serif";
    for (const line of c.lines) {
      const wrapped = typeof wrapText === "function" ? wrapText(ctx, line, area.w - 10) : [line];
      wrapped.forEach((w, i) => rows.push({ text: w, font: "15px Georgia, serif", colour: "#f1ecf7", h: i === wrapped.length - 1 ? 25 : 20 }));
    }
    rows.push({ text: "", h: 6 });
  }
  const pages = [[]];
  let y = 0;
  const maxH = area.h - 40;
  for (const r of rows) {
    if (y + r.h > maxH && pages[pages.length - 1].length) {
      pages.push([]);
      y = 0;
      if (!r.text) continue;
    }
    pages[pages.length - 1].push(r);
    y += r.h;
  }
  return pages;
}

function drawLifeStoryTab(ctx, f, area) {
  const pages = _lsPages(ctx, f, area);
  _lifeStoryPages = pages.length;
  lifeStoryPage = Math.max(0, Math.min(pages.length - 1, lifeStoryPage));
  let y = area.y;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (const r of pages[lifeStoryPage]) {
    if (r.text) {
      ctx.font = r.font;
      ctx.fillStyle = r.colour;
      ctx.fillText(r.text, area.x, y + 14);
    }
    y += r.h;
  }
  if (pages.length > 1) {
    const L = _lsLayout(area);
    drawGlassButton(L.prev.x, L.prev.y, L.prev.w, L.prev.h, "◀ Earlier", { fontSize: 12, borderRadius: 8, disabled: lifeStoryPage <= 0 });
    drawGlassButton(L.next.x, L.next.y, L.next.w, L.next.h, "Later ▶", { fontSize: 12, borderRadius: 8, disabled: lifeStoryPage >= pages.length - 1 });
    ctx.font = "12px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textAlign = "right";
    ctx.fillText(`Page ${lifeStoryPage + 1} of ${pages.length}`, L.prev.x - 10, L.prev.y + 18);
    ctx.textAlign = "left";
  }
}

// true if the click was on the page buttons
function handleLifeStoryClick(area) {
  if (_lifeStoryPages <= 1) return false;
  const L = _lsLayout(area);
  if (isPointInRect(mouse.x, mouse.y, L.prev.x, L.prev.y, L.prev.w, L.prev.h)) {
    lifeStoryPage = Math.max(0, lifeStoryPage - 1);
    return true;
  }
  if (isPointInRect(mouse.x, mouse.y, L.next.x, L.next.y, L.next.w, L.next.h)) {
    lifeStoryPage = Math.min(_lifeStoryPages - 1, lifeStoryPage + 1);
    return true;
  }
  return false;
}
