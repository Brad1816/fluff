// ---------------------------------------------------------------------------
// Shared memories and parties (design doc Phase 3).
//
// A big moment that several of your fluffies go through together is kept as
// one shared memory with a plain-English name (you can rename it in the
// Memories book, Household):
//   storm   3+ of them frightened by thunder in a day  "The Great Storm of day 14"
//   death   a fluffy dies with 2+ watching            "The night Snowball died"
//           (killed with the grinder:                 "The day the grinder came")
//   fight   6+ blows between 3+ fluffies in an hour   "The fight in the living room"
//   birth   foals born with 2+ watching               "When Daisy's six foals came"
//   show    a first place, with family or friends at home   "Pip's blue ribbon"
//   party   a party you threw (below)                 "Clover's first birthday"
// Everyone who was there joins it (and it goes in their story). Each
// remembers it its own way (view): a storm it was comforted through is "we
// got through it", one it faced alone was "terrifying".
// What it does:
//   - going through it together brings them closer (SM_BOND each pair)
//   - brought back by the next storm: those comforted last time stay calmer
//     (frights x0.8), those left alone panic sooner (x1.25) (Fears.js)
//   - legend: when a fluffy that was there chats with one that wasn't
//     (Gossip.js), it tells it; the book counts who has heard. A foal told
//     of a terrifying storm grows a little afraid of thunder itself.
//   - anniversaries: once a game year (12 days) a sad memory brings grief
//     back to its room (Climate.js), and those who were there go back to the
//     spot for a moment; a happy one lifts their spirits. At most
//     SM_ANNIV_PER_DAY a day (deaths first, then the newest), and a room's grief comes back
//     once a day however many. A newborn lost in its first SM_LITTLE_AGE
//     isn't a house memory.
//
// Parties: a new right-click action ("Throw a party") when there's a reason
// for one - a birthday or a came-home anniversary (a game year), a new
// arrival or a new litter (within a day), or a first place at a show (within
// a day). Treats for everyone in the room (TRICK_TREAT_COST each) and hats
// and streamers (PARTY_COST): they gather round, cheer, the room warms up,
// and it becomes a happy shared memory. One party per occasion.
// ---------------------------------------------------------------------------

const SM_BOND = 0.04;
const SM_WINDOW = HOUR_LENGTH; // a moment's gathering stays open this long
const SM_STORM_MIN = 3;
const SM_FIGHT_HITS = 6;
const SM_FIGHT_FLUFFIES = 3;
const SM_YEAR = typeof DAYS_PER_SEASON === "number" ? DAYS_PER_SEASON * 4 : 12;
const SM_MAX = 200;
const SM_LITTLE_AGE = 2 * (typeof DAY_LENGTH === "number" ? DAY_LENGTH : 1200); // younger foals' deaths aren't a house memory
const SM_ANNIV_PER_DAY = 2; // anniversaries told (and felt) in one day at most
const PARTY_COST = 10;
const PARTY_JOY = 0.08;

function freshSharedMemories() {
  return { list: [], nextId: 1 };
}
let sharedMemories = freshSharedMemories();
let _shmFights = {}; // scene -> { t, hits, who: Set }

function _shmOk() {
  if (!sharedMemories || typeof sharedMemories !== "object" || !Array.isArray(sharedMemories.list)) sharedMemories = freshSharedMemories();
  if (typeof sharedMemories.nextId !== "number") sharedMemories.nextId = sharedMemories.list.length + 1;
  return sharedMemories;
}
function _shmDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : Math.floor(timePlayed / DAY_LENGTH) + 1;
}
function _shmName(f) {
  if (!f) return null;
  return (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || null;
}
function _shmById(id) {
  return typeof fluffies !== "undefined" ? fluffyById(id) : null;
}
function _shmRoomWords(scene) {
  if (typeof houseRoomName === "function") {
    const n = houseRoomName(scene);
    if (n) return n === "Living room" ? "the living room" : n;
  }
  if (scene === "BACKYARD") return "the backyard";
  if (typeof isCameraScene === "function" && isCameraScene(scene)) return "the park";
  return "the house";
}
const _SHM_NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const _SHM_ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

// Your fluffies awake in the room that could see or hear it
function _shmWatchers(scene, except = []) {
  if (typeof fluffies === "undefined") return [];
  return fluffies.filter(
    (f) =>
      f.isAlive &&
      f.adopted &&
      f.scene === scene &&
      !except.includes(f) &&
      f.currentStateKey !== "SLEEPING" &&
      (typeof f.canSee !== "function" || f.canSee() || f.canHear()),
  );
}

function _shmBond(a, b) {
  if (a === b || !a || !b || typeof changeOpinion !== "function") return;
  changeOpinion(a, b, SM_BOND, "shared");
  changeOpinion(b, a, SM_BOND, "shared");
}

// Make (or add to) a shared memory. who: fluffies. Returns it, or null (not
// enough of them - a memory is only shared by 2+).
function makeSharedMemory(kind, name, who, opts = {}) {
  _shmOk();
  const now = timePlayed;
  const scene = opts.scene || (who[0] && who[0].scene) || null;
  const key = opts.key || kind;
  let m = sharedMemories.list.find((x) => x.key === key && x.kind === kind && now - x.t >= 0 && now - x.t < (opts.window || SM_WINDOW));
  const members = who.filter((f) => f && f.isAlive && f.adopted);
  if (!m) {
    if (members.length < 2) return null;
    m = {
      id: sharedMemories.nextId++,
      kind,
      key,
      name,
      day: _shmDay(),
      t: now,
      s: scene,
      x: opts.x ?? (members[0] ? Math.round(members[0].x) : 0),
      y: opts.y ?? (members[0] ? Math.round(members[0].y) : 0),
      who: [],
      view: {},
      good: !!opts.good,
      heard: [],
    };
    if (opts.about !== undefined) m.about = opts.about;
    sharedMemories.list.push(m);
    if (sharedMemories.list.length > SM_MAX) sharedMemories.list.shift();
  } else if (!m.renamed && name) {
    m.name = name; // (six foals now, not four)
  }
  m.t = Math.max(m.t, now);
  for (const f of members) {
    if (m.who.includes(f.id)) continue;
    for (const id of m.who) _shmBond(f, _shmById(id));
    m.who.push(f.id);
    m.view[f.id] = opts.view ? opts.view(f) : m.good ? "good" : "bad";
    if (typeof recordStory === "function") recordStory("shared", f, { x: m.id });
  }
  return m;
}

function sharedMemoryById(id) {
  return _shmOk().list.find((m) => m.id === id) || null;
}
function sharedMemoriesOf(f) {
  return f ? _shmOk().list.filter((m) => m.who.includes(f.id)) : [];
}

function renameSharedMemory(m, name) {
  const n = String(name || "").trim().slice(0, 60);
  if (!m || !n) return false;
  m.name = n;
  m.renamed = true;
  return true;
}

// ---- What makes one ----

// StoryBook.recordStory: births, first places, deaths
function noteSharedStory(kind, ids, opts = {}) {
  if (kind === "born") {
    const foal = _shmById(ids[0]);
    const mum = _shmById(ids[1]);
    if (!foal || !mum || !mum.adopted) return;
    const watchers = _shmWatchers(mum.scene, [foal, mum]);
    const open = _shmOk().list.find((m) => m.key === `birth:${mum.id}` && timePlayed - m.t < SM_WINDOW);
    if (!open && watchers.length < 2) return;
    const foals = (open ? open.foals || 0 : 0) + 1;
    const n = _shmName(mum);
    const what = foals === 1 ? "foal" : `${_SHM_NUM[foals] || foals} foals`;
    const m = makeSharedMemory("birth", `When ${n ? n + "'s" : "a mare's"} ${what} came`, [mum, ...watchers, foal], { key: `birth:${mum.id}`, good: true });
    if (m) m.foals = foals;
  } else if (kind === "show" && opts.x === "first") {
    const f = _shmById(ids[0]);
    if (!f || !f.adopted) return;
    const rels = typeof relationships !== "undefined" ? relationships[f.id] || {} : {};
    const close = fluffies.filter((o) => o !== f && o.isAlive && o.adopted && (rels[o.id] && rels[o.id] !== "rival" || o.id === f.motherId || o.motherId === f.id) && (typeof haveMet !== "function" || haveMet(f, o)));
    const n = _shmName(f);
    makeSharedMemory("show", `${n ? n + "'s" : "The"} blue ribbon`, [f, ...close], { key: `show:${f.id}:${_shmDay()}`, good: true });
  } else if (kind === "died") {
    const f = _shmById(ids[0]);
    if (!f) return;
    // (a newborn lost in its first days is its mum's grief, not a day the
    // whole house marks every year: those made most rooms Grieving)
    if (f.growth < 0.5 && (f.age || 0) < SM_LITTLE_AGE) return;
    const watchers = _shmWatchers(opts.s || f.scene, [f]);
    if (watchers.length < 2) return;
    const n = _shmName(f);
    const grinder = /grinder/i.test(String(opts.x || "")) || f.deathWeapon === "grinder";
    const night = typeof isNightTime === "function" ? isNightTime() : false;
    const name = grinder ? "The day the grinder came" : `The ${night ? "night" : "day"} ${n || "a fluffy"} died`;
    makeSharedMemory("death", name, watchers, { key: `death:${f.id}`, about: f.id, scene: f.scene, x: f.x, y: f.y });
  }
}

// Fears.startFright (thunder)
function noteStormFright(f) {
  if (!f || !f.adopted) return;
  const day = _shmDay();
  const key = `storm:${day}`;
  const s = (_shmFights._storm && _shmFights._storm.day === day) ? _shmFights._storm : (_shmFights._storm = { day, who: new Set() });
  s.who.add(f.id);
  const open = _shmOk().list.find((m) => m.key === key);
  if (!open && s.who.size < SM_STORM_MIN) return;
  const who = [...s.who].map(_shmById).filter(Boolean);
  const m = makeSharedMemory("storm", `The ${who.length >= 5 ? "Great Storm" : "storm"} of day ${day}`, who, {
    key,
    window: DAY_LENGTH,
    view: (x) => (x._frightsComforted && x._stormComfortDay === day ? "good" : "bad"),
  });
  return m;
}

// Fears.onComfortedByYou: comforted through tonight's storm, it remembers it better
function noteSharedComfort(f) {
  if (!f) return;
  f._stormComfortDay = _shmDay();
  const m = _shmOk().list.find((x) => x.key === `storm:${_shmDay()}`);
  if (m && m.who.includes(f.id)) m.view[f.id] = "good";
}

// HorseSocial.performAttack
function noteSharedFight(attacker, victim) {
  if (!attacker || !victim || (!attacker.adopted && !victim.adopted)) return;
  const scene = victim.scene;
  const now = timePlayed;
  let fg = _shmFights[scene];
  if (!fg || !(now >= fg.t) || now - fg.t > SM_WINDOW) fg = _shmFights[scene] = { t: now, hits: 0, who: new Set() };
  fg.hits++;
  fg.who.add(attacker.id);
  fg.who.add(victim.id);
  if (fg.hits < SM_FIGHT_HITS || fg.who.size < SM_FIGHT_FLUFFIES) return;
  const who = [...fg.who].map(_shmById).filter(Boolean).concat(_shmWatchers(scene));
  makeSharedMemory("fight", `The fight in ${_shmRoomWords(scene)}`, [...new Set(who)], { key: `fight:${scene}:${_shmDay()}`, scene, window: DAY_LENGTH }); // (one a day per room)
}

// ---- What it does ----

// Fears.startFright: remembering the last storm
function sharedMemoryFrightMultiplier(f, key) {
  if (key !== "thunder" || !f) return 1;
  let m = 1;
  for (const s of _shmOk().list) {
    if (s.kind !== "storm" || !s.who.includes(f.id) || s.key === `storm:${_shmDay()}`) continue;
    m = s.view[f.id] === "good" ? Math.min(m, 0.8) : Math.max(m, 1.25);
  }
  return m;
}

// Gossip.onGossipChat: one that was there tells one that wasn't
function shareLegend(from, to) {
  if (!from || !to || typeof from.tooYoungToSpeak === "function" && from.tooYoungToSpeak()) return null;
  for (const m of sharedMemoriesOf(from)) {
    if (m.who.includes(to.id) || m.heard.includes(to.id)) continue;
    m.heard.push(to.id);
    if (m.kind === "storm" && m.view[from.id] === "bad" && to.growth < 1 && typeof changeFear === "function") changeFear(to, "thunder", 0.05);
    if (!m.good && typeof to.changeHappiness === "function") to.changeHappiness(-0.01);
    return m;
  }
  return null;
}

// Once a game year
function _shmAnniversaries() {
  const day = _shmDay();
  const b = _shmOk();
  if (!b.anniv || b.anniv.day !== day) b.anniv = { day, n: 0, grief: {} };
  // (deaths first, then the newest: the ones that matter most)
  const order = b.list.slice().sort((x, y) => (x.kind === "death" ? 0 : 1) - (y.kind === "death" ? 0 : 1) || y.t - x.t);
  for (const m of order) {
    const since = day - m.day;
    if (since < SM_YEAR || since % SM_YEAR !== 0 || m.lastAnniv === day) continue;
    m.lastAnniv = day;
    if (b.anniv.n >= SM_ANNIV_PER_DAY) continue;
    const years = since / SM_YEAR;
    const here = m.who.map(_shmById).filter((f) => f && f.isAlive && f.adopted);
    if (!here.length) continue;
    b.anniv.n++;
    if (typeof addUIMessage === "function") addUIMessage(`${years === 1 ? "A year" : `${_SHM_NUM[years] || years} years`} ago today: ${m.name}.`);
    if (!m.good) {
      // (one room's old grief comes back once a day, however many)
      if (m.s && !b.anniv.grief[m.s] && typeof addRoomClimate === "function") addRoomClimate(m.s, { g: 3 });
      if (m.s) b.anniv.grief[m.s] = true;
      for (const f of here) {
        f.changeHappiness(-0.03);
        // back to the spot, for a moment
        if (f.scene === m.s && f.currentStateKey !== "SLEEPING" && typeof f.setTargetPosition === "function") {
          f.initBehavior("MOVING");
          f.setTargetPosition(m.x + (Math.random() - 0.5) * 80, m.y + (Math.random() - 0.5) * 30);
        }
        if (!f.tooYoungToSpeak() && typeof getDialogue === "function" && Math.random() < 0.5) f.speak(getDialogue(["SHARED", "ANNIV_SAD"], f), true);
      }
    } else {
      if (m.s && typeof addRoomClimate === "function") addRoomClimate(m.s, { w: 2 });
      for (const f of here) {
        f.changeHappiness(0.05);
        if (!f.tooYoungToSpeak() && typeof getDialogue === "function" && Math.random() < 0.5) f.speak(getDialogue(["SHARED", "ANNIV_HAPPY"], f), true);
      }
    }
  }
}

const sharedMemoryTicker = new Ticker(10);
function updateSharedMemories(dt) {
  if (!sharedMemoryTicker.step(dt)) return;
  _shmAnniversaries();
}

// ---- Parties ----

function _shmStoryDay(f, kind) {
  if (typeof storyOf !== "function") return null;
  const e = storyOf(f).find((x) => x.k === kind && x.w[0] === f.id);
  return e ? Math.floor(e.t / DAY_LENGTH) + 1 : null;
}

// Why it could have a party now: { key, name } or null
function partyOccasion(f) {
  if (!f || !f.isAlive || !f.adopted) return null;
  const day = _shmDay();
  const n = _shmName(f) || "Fluffy";
  const out = [];
  const born = _shmStoryDay(f, "born");
  const came = _shmStoryDay(f, "arrived");
  if (born !== null && day > born && (day - born) % SM_YEAR === 0) {
    const y = (day - born) / SM_YEAR;
    out.push({ key: `birthday:${day}`, name: `${n}'s ${_SHM_ORD[y] || y + "th"} birthday` });
  }
  if (came !== null && day > came && (day - came) % SM_YEAR === 0) out.push({ key: `camehome:${day}`, name: `A year since ${n} came home` });
  if (came !== null && day - came <= 1 && born === null) out.push({ key: `welcome:${came}`, name: `${n}'s welcome party` });
  // A new litter (hers)
  const kids = typeof fluffies !== "undefined" ? fluffies.filter((o) => o.isAlive && o.motherId === f.id && _shmStoryDay(o, "born") !== null && day - _shmStoryDay(o, "born") <= 1) : [];
  if (kids.length) out.push({ key: `litter:${_shmStoryDay(kids[0], "born")}`, name: `The party for ${n}'s foals` });
  // A first place
  const win = (f.ribbons || []).find((r) => r.place === 1 && typeof r.day === "number" && day - r.day <= 1);
  if (win) out.push({ key: `show:${win.day}`, name: `${n}'s blue ribbon party` });
  const done = f.partiesHad || [];
  return out.find((o) => !done.includes(o.key)) || null;
}

function partyGuests(f) {
  return typeof fluffies === "undefined" ? [] : fluffies.filter((o) => o.isAlive && o.adopted && o.scene === f.scene && o.currentStateKey !== "SLEEPING");
}

function partyCost(f) {
  return PARTY_COST + (typeof TRICK_TREAT_COST === "number" ? TRICK_TREAT_COST : 2) * partyGuests(f).length;
}

// Right-click row (Tricks.rightClickActions)
function partyActions(f) {
  const o = partyOccasion(f);
  if (!o) return [];
  return [{ key: "party", name: "Throw a party", sub: `$${partyCost(f)}`, run: (x) => throwParty(x) }];
}

function throwParty(f) {
  const o = partyOccasion(f);
  if (!o) return null;
  const cost = partyCost(f);
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && typeof money === "number" && money < cost) {
    if (typeof addUIMessage === "function") addUIMessage(`Not enough money for a party ($${cost}).`);
    return null;
  }
  if (!free && typeof money === "number") money -= cost;
  if (!Array.isArray(f.partiesHad)) f.partiesHad = [];
  f.partiesHad.push(o.key);
  if (f.partiesHad.length > 20) f.partiesHad.shift();
  const guests = partyGuests(f);
  for (const g of guests) {
    g.changeHappiness(PARTY_JOY);
    if (typeof giveAffection === "function") giveAffection(g, "treat");
    if (typeof changeWeight === "function" && typeof WEIGHT_TREAT === "number") changeWeight(g, WEIGHT_TREAT);
    g.expressionOverride = "GOOD_UPSIES";
    g.expressionOverrideTimer = 3;
    if (g !== f && typeof g.setTargetPosition === "function") {
      g.initBehavior("MOVING");
      g.setTargetPosition(f.x + (Math.random() - 0.5) * 220, f.y + (Math.random() - 0.5) * 60);
    }
    if (!g.tooYoungToSpeak() && typeof getDialogue === "function" && Math.random() < 0.6) g.speak(getDialogue(["SHARED", "PARTY"], g, f), true);
  }
  if (typeof addRoomClimate === "function") addRoomClimate(f.scene, { w: 4 });
  // Hats, bunting and confetti (HouseLife.js)
  if (typeof decorateParty === "function") decorateParty(f, guests);
  const m = makeSharedMemory("party", o.name, [f, ...guests.filter((g) => g !== f)], { key: `party:${f.id}:${o.key}`, good: true, scene: f.scene, x: f.x, y: f.y });
  if (typeof addUIMessage === "function") addUIMessage(`${o.name}! Everyone had treats.`);
  if (typeof poofs !== "undefined" && typeof Poof === "function") poofs.push(new Poof(f.x, f.y - 60, f.scene));
  return m || o;
}

// ---- The Memories book (Household) ----

let memoriesBookOpen = false;
let memoriesBookPage = 0;
let memoriesBookTab = "moments"; // "moments" | "lives" | "photos" (Lives.js draws the last two)
const MB_PER_PAGE = 5;

function openMemoriesBook() {
  memoriesBookOpen = true;
  memoriesBookPage = 0;
  memoriesBookTab = "moments";
  if (typeof livesReading !== "undefined") livesReading = null;
}
function closeMemoriesBook() {
  memoriesBookOpen = false;
}

// Plain-English lines for one memory
function sharedMemoryLines(m) {
  const names = m.who.map((id) => (typeof fluffyNames !== "undefined" && fluffyNames[id]) || null);
  const named = names.filter(Boolean);
  const others = names.length - Math.min(3, named.length);
  let who = named.slice(0, 3).join(", ");
  if (!who) who = `${names.length} fluffies`;
  else if (others > 0) who += ` and ${others} other${others === 1 ? "" : "s"}`;
  const alive = m.who.filter((id) => {
    const f = _shmById(id);
    return f && f.isAlive;
  }).length;
  const lines = [`Day ${m.day}, ${_shmRoomWords(m.s)} · ${who}${alive < m.who.length ? ` (${m.who.length - alive} gone now)` : ""}`];
  if (m.kind === "storm") {
    const good = m.who.filter((id) => m.view[id] === "good").length;
    const bad = m.who.length - good;
    const parts = [];
    if (good) parts.push(`${good} remember${good === 1 ? "s" : ""} getting through it together`);
    if (bad) parts.push(`${bad} remember${bad === 1 ? "s" : ""} it as terrifying`);
    lines.push(parts.join("; ") + ".");
  } else {
    lines.push(m.good ? "A happy memory." : "A sad memory.");
  }
  if (m.heard.length) lines[1] += ` ${m.heard.length} more heard about it from them.`;
  return lines;
}

function getMemoriesBookLayout() {
  const w = Math.min(780, width - 30);
  const h = Math.min(600, height - 30);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  const list = _shmOk().list.slice().reverse();
  const pages = Math.max(1, Math.ceil(list.length / MB_PER_PAGE));
  memoriesBookPage = Math.max(0, Math.min(pages - 1, memoriesBookPage));
  const rows = list.slice(memoriesBookPage * MB_PER_PAGE, (memoriesBookPage + 1) * MB_PER_PAGE).map((m, i) => {
    const ry = y + 80 + i * 92;
    return { m, x: x + 24, y: ry, w: w - 48, h: 84, rename: { x: x + w - 24 - 90, y: ry + 10, w: 80, h: 28 } };
  });
  return {
    x,
    y,
    w,
    h,
    rows,
    pages,
    total: list.length,
    prev: { x: x + 24, y: y + h - 50, w: 50, h: 32 },
    next: { x: x + 80, y: y + h - 50, w: 50, h: 32 },
    close: { x: x + w - 150, y: y + h - 50, w: 130, h: 32 },
    tabs: ["moments", "lives", "photos"].map((id, i) => ({ id, x: x + w - 24 - (3 - i) * 96 + 6, y: y + 22, w: 90, h: 28, label: { moments: "Moments", lives: "Lives", photos: "Photos" }[id] })),
  };
}

function drawMemoriesBook(c) {
  if (!memoriesBookOpen) return;
  const L = getMemoriesBookLayout();
  c.save();
  c.fillStyle = "rgba(0,0,0,0.6)";
  c.fillRect(0, 0, width, height);
  if (typeof drawScreenPanel === "function") drawScreenPanel(c, { x: L.x, y: L.y, w: L.w, h: L.h }, { fill: "rgb(40, 28, 22)", dim: 0 });
  else {
    c.fillStyle = "rgb(40, 28, 22)";
    c.fillRect(L.x, L.y, L.w, L.h);
  }
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.font = "bold 24px Georgia";
  c.fillStyle = "#f5e3c8";
  c.fillText("Memories book", L.x + 24, L.y + 44);
  // Tabs (Lives.js: the lives you've had in your care, and the photos)
  if (typeof drawBookLives === "function") {
    for (const t of L.tabs) {
      drawGlassButton(t.x, t.y, t.w, t.h, t.label, { fontSize: 13, borderRadius: 8, normalFill: t.id === memoriesBookTab ? "rgba(255, 220, 150, 0.35)" : "rgba(0,0,0,0.2)" });
    }
    if (memoriesBookTab === "lives") {
      drawBookLives(c, L);
      c.restore();
      return;
    }
    if (memoriesBookTab === "photos") {
      drawBookPhotos(c, L);
      c.restore();
      return;
    }
  }
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.font = "italic 13px Georgia";
  c.fillStyle = "rgba(245,227,200,0.7)";
  c.fillText("The moments your fluffies went through together", L.x + 24, L.y + 64);
  if (!L.rows.length) {
    c.font = "italic 16px Georgia";
    c.fillStyle = "rgba(245,227,200,0.6)";
    c.fillText("Nothing yet. Storms, births, parties and hard days will be kept here.", L.x + 24, L.y + 120);
  }
  for (const r of L.rows) {
    const m = r.m;
    c.fillStyle = m.good ? "rgba(255, 220, 150, 0.1)" : "rgba(150, 170, 220, 0.1)";
    if (typeof fillRoundRect === "function") fillRoundRect(c, r.x, r.y, r.w, r.h, 10);
    else c.fillRect(r.x, r.y, r.w, r.h);
    c.font = "bold 18px Georgia";
    c.fillStyle = m.good ? "#ffd98a" : "#c9d6ff";
    c.fillText(`${m.good ? "✦" : "☁"} ${typeof fitText === "function" ? fitText(c, m.name, r.w - 140) : m.name}`, r.x + 14, r.y + 28);
    c.font = "14px Georgia";
    c.fillStyle = "#eadcc8";
    const lines = sharedMemoryLines(m);
    lines.forEach((l, i) => c.fillText(typeof fitText === "function" ? fitText(c, l, r.w - 28) : l, r.x + 14, r.y + 52 + i * 20));
    if (typeof drawGlassButton === "function") drawGlassButton(r.rename.x, r.rename.y, r.rename.w, r.rename.h, "Rename", { fontSize: 13, borderRadius: 8 });
  }
  if (L.pages > 1 && typeof drawGlassButton === "function") {
    drawGlassButton(L.prev.x, L.prev.y, L.prev.w, L.prev.h, "◀", { fontSize: 15, borderRadius: 10 });
    drawGlassButton(L.next.x, L.next.y, L.next.w, L.next.h, "▶", { fontSize: 15, borderRadius: 10 });
    c.font = "13px Arial";
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.fillText(`${memoriesBookPage + 1} / ${L.pages}`, L.next.x + L.next.w + 12, L.next.y + 21);
  }
  if (typeof drawGlassButton === "function") drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 15, borderRadius: 10 });
  c.restore();
}

function handleMemoriesBookClick() {
  if (!memoriesBookOpen) return false;
  const L = getMemoriesBookLayout();
  const hit = (b) => isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h);
  if (hit(L.close) || !hit(L)) {
    closeMemoriesBook();
    return true;
  }
  if (typeof drawBookLives === "function") {
    for (const t of L.tabs) {
      if (hit(t)) {
        memoriesBookTab = t.id;
        memoriesBookPage = 0;
        if (typeof livesReading !== "undefined") livesReading = null;
        return true;
      }
    }
    if (memoriesBookTab === "lives") return handleBookLivesClick(L);
    if (memoriesBookTab === "photos") return handleBookPhotosClick(L);
  }
  if (L.pages > 1 && hit(L.prev)) {
    memoriesBookPage = Math.max(0, memoriesBookPage - 1);
    return true;
  }
  if (L.pages > 1 && hit(L.next)) {
    memoriesBookPage = Math.min(L.pages - 1, memoriesBookPage + 1);
    return true;
  }
  for (const r of L.rows) {
    if (hit(r.rename)) {
      const name = typeof prompt === "function" ? prompt("Name this memory:", r.m.name) : null;
      if (name !== null && name !== undefined) renameSharedMemory(r.m, name);
      return true;
    }
  }
  return true;
}

registerScreen({
  name: "memoriesBook",
  layer: 24,
  isOpen: () => memoriesBookOpen,
  close: () => closeMemoriesBook(),
  draw: (c) => drawMemoriesBook(c),
  click: () => handleMemoriesBookClick(),
  reset: () => closeMemoriesBook(),
});

registerSystem("sharedMemories", updateSharedMemories, 146);
