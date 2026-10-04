// ---------------------------------------------------------------------------
// The exterminator path (opt-in): a separate line of work.
//
// Buy a licence (EXT_LICENCE_PRICE) on the Computer's FluffList, "Pest
// control" tab. Clients then post jobs there (a couple a day, more and
// bigger with a better name: extState.score -> 0-5 stars). Accept one and
// you drive out to the site in your van; your house carries on without you.
//
// A site is made fresh for each job (makeJobSite, from a seed): 3-4 rooms of
// the client's kind (a farm: the yard where the van parks, the barn, a field,
// the coop, the edge of the woods), linked by the edges, with hay bales,
// crates, bushes and logs to hide behind, and a wild herd spread through it
// (mares with foals, a leader). The rooms are scenes "JOB_<id>_<n>"
// (getSceneConfig asks jobSceneConfig); nothing of them is saved but the seed
// and what's changed, and they're deleted when the job ends.
//
// You play it as the exterminator (ExterminatorPlayer.js): walk with WASD /
// the arrow keys, or the joystick / tapping on a phone; E (Grab) picks up a
// fluffy, puts it in a transport crate, picks the crate up, loads the van.
// The herd runs and hides from you (ExterminatorFerals.js).
//
// Going home ends the job (the van, or "Head home"): what you loaded is
// counted - catches go home with you, to the shelter or to the reptile shop -
// you're paid by the head (a bonus for clearing the lot in time) and your
// exterminator name goes up or down. Saved: extState.
// ---------------------------------------------------------------------------

const EXT_LICENCE_PRICE = 1500;
const EXT_SCORE_START = 10;
const EXT_OFFERS_MAX = 3;
const EXT_OFFER_DAYS = 1; // an offer lasts this many days
const EXT_SHELTER_BONUS = 15; // per fluffy handed to the shelter
const EXT_REPTILE_PAY = 20; // per fluffy sold to the reptile shop
const EXT_CLEAR_BONUS = 0.5; // pay x (1 + this) for clearing the lot in time
const EXT_SMARTY_CHANCE = 0.45; // a herd of 3+ grown-ups with no smarty gets one as its boss
const EXT_LATE_CUT = 0.5; // pay x this when you're late
const EXT_DEADLINE_HOURS = [5, 7];

// ---- Clients and their kinds of room ----
// rooms: the kinds a site is made from (the first is where the van parks)
// want: "any", or "humane" (no culling: they're watching) some of the time
// (humaneChance); herd: x the usual size; pet: chance their own fluffy is
// about (f.clientPet - leave it be); likes: which of your names brings them
const EXT_CLIENTS = {
  farmer: {
    name: "Farmer",
    who: ["Farmer Dale", "Farmer Mae", "Old Hendricks", "The Okafor farm", "Farmer Bets", "The Lindqvist farm"],
    rooms: ["yard", "barn", "field", "coop", "woods"],
    perHead: 40,
    humaneChance: 0,
    herd: 1,
    pet: 0,
    likes: "brutal",
    blurb: (n) => `A herd of about ${n} has moved onto the farm - they're eating the feed and scaring the hens. Clear them out.`,
  },
  family: {
    name: "Family",
    who: ["The Parkers", "The Nguyens", "Mrs Abernathy", "The Rossi family", "The Delacroix family", "Mr and Mrs Haddad"],
    rooms: ["garden", "shed", "garage", "deck"],
    perHead: 35,
    humaneChance: 0.6,
    herd: 0.7,
    pet: 0.5,
    likes: "humane",
    blurb: (n, o) => `About ${n} strays are living under our deck and in the shed.${o && o.humane ? " Please don't hurt them - the kids will be watching." : " We just want them gone."}${o && o.pet ? " Our own fluffy's out there too - the one with the collar. Leave her be!" : ""}`,
  },
  store: {
    name: "FluffMart",
    who: ["FluffMart (Elm St)", "FluffMart (Riverside)", "FluffMart (the Mall)"],
    rooms: ["loading", "stockroom", "dumpsters"],
    perHead: 45,
    humaneChance: 0.2,
    herd: 1.2,
    pet: 0,
    likes: "any",
    blurb: (n, o) => `A colony of about ${n} is living in our stockroom and the dumpsters out back. Lots of foals.${o && o.humane ? " Head office says humanely, please." : ""}`,
  },
  city: {
    name: "The city",
    who: ["City Animal Control", "Parks Department", "Sanitation Dept."],
    rooms: ["street", "drain", "playground", "lot"],
    perHead: 30,
    humaneChance: 0.1,
    herd: 1.5,
    pet: 0,
    likes: "brutal",
    blurb: (n) => `A big herd - ${n} or so - has taken over the block. Complaints every night. Whatever it takes.`,
  },
};
const EXT_RARE = {
  mega: { name: "Mega-herd", herd: 2, pay: 1.5, blurb: "It's a mega-herd. Bring help (and crates)." },
  colony: { name: "Foal colony", foals: true, pay: 1.2, blurb: "It's mostly foals - mares everywhere." },
};

// Special requests (now and then, EXT_REQUEST_CHANCE): a rule to keep or a
// goal to meet. Kept or met: EXT_REQUEST_BONUS more pay and a better name.
// A rule broken upsets them (half pay); a goal missed just costs a little
// name.
const EXT_REQUEST_CHANCE = 0.35;
const EXT_REQUEST_BONUS = 0.25;
const EXT_REQUESTS = {
  no_poison: {
    short: "No poison",
    text: "They've got a dog - no poison bait.",
    clients: ["farmer", "family", "city"],
    rule: true,
    broken: (job) => (job.baitUsed || 0) > 0,
    why: "You put poison down",
  },
  foals_alive: {
    short: "Spare the foals",
    text: "The foals are going to good homes - don't hurt the little ones.",
    clients: ["family", "store"],
    notHumane: true,
    rule: true,
    broken: (job) => _extFoalsDead(job) > 0,
    why: "Foals died",
  },
  tidy: {
    short: "No mess",
    text: "We've got people coming - don't leave any bodies lying about.",
    clients: ["family", "store", "city"],
    notHumane: true,
    rule: true,
    broken: (job) => fluffies.some((f) => !f.isAlive && f.jobFeral === job.id && isJobScene(f.scene)),
    why: "You left bodies lying about",
  },
  boss: {
    short: "Get the smarty",
    text: "There's a smarty bossing the rest about - make sure you get that one.",
    clients: ["farmer", "family", "store", "city"],
    rule: false,
    met: (job) => job.bossId != null && !fluffies.some((f) => f.id === job.bossId && f.isAlive && isJobScene(f.scene)),
    why: "The smarty got away",
  },
};

// Foals of this herd dead: culled, or died on site (poison, traps...)
function _extFoalsDead(job) {
  let n = job.foalsKilled || 0;
  for (const f of fluffies) if (!f.isAlive && f.jobFeral === job.id && isJobScene(f.scene) && f.growth < 1 && !f._extCounted) n++;
  return n;
}

// Kept/met (true), broken/missed (false), or null (no request)
function extRequestResult(job) {
  const r = job && EXT_REQUESTS[job.request];
  if (!r) return null;
  return r.rule ? !r.broken(job) : !!r.met(job);
}

const EXT_ROOM_KINDS = {
  yard: { name: "Farmyard", outdoor: true, texture: "texture_grass", wall: null, props: [["hay", 1, 2], ["crate", 1, 2], ["trough", 0, 1]] },
  barn: { name: "Barn", outdoor: false, texture: "texture_concrete", wall: "#6b4426", floor: "rgba(214, 178, 96, 0.55)", props: [["hay", 3, 5], ["crate", 1, 2]] },
  field: { name: "Field", outdoor: true, texture: "texture_grass", wall: null, props: [["hay", 1, 3], ["bush", 1, 2]] },
  coop: { name: "Hen coop", outdoor: false, texture: "texture_concrete", wall: "#8a6a44", floor: "rgba(196, 160, 100, 0.5)", props: [["crate", 2, 3], ["hay", 1, 2]] },
  woods: { name: "Edge of the woods", outdoor: true, texture: "texture_grass", wall: null, floor: "rgba(40, 70, 30, 0.25)", props: [["bush", 2, 4], ["log", 1, 2]] },
  garden: { name: "Back garden", outdoor: true, texture: "texture_grass", wall: null, props: [["bush", 2, 3], ["flowerbed", 1, 2], ["bin", 0, 1]] },
  shed: { name: "Garden shed", outdoor: false, texture: "texture_concrete", wall: "#7a5a3a", floor: "rgba(150, 110, 70, 0.4)", props: [["shelf", 1, 2], ["crate", 1, 2]] },
  garage: { name: "Garage", outdoor: false, texture: "texture_concrete", wall: "#8f969c", props: [["car", 1, 1], ["shelf", 1, 2], ["bin", 1, 1]] },
  deck: { name: "Under the deck", outdoor: true, texture: "texture_grass", wall: "#7c5a38", floor: "rgba(20, 15, 10, 0.35)", props: [["crate", 1, 2], ["log", 1, 1]] },
  loading: { name: "Loading bay", outdoor: true, texture: "texture_concrete", wall: "#9aa0a6", props: [["pallet", 2, 3], ["crate", 1, 2]] },
  stockroom: { name: "Stockroom", outdoor: false, texture: "texture_concrete", wall: "#b9b2a4", props: [["shelf", 3, 4], ["crate", 1, 2]] },
  dumpsters: { name: "Behind the store", outdoor: true, texture: "texture_concrete", wall: "#7f5d4c", props: [["dumpster", 2, 3], ["bin", 1, 2]] },
  street: { name: "The street", outdoor: true, texture: "texture_concrete", wall: "#6d6f72", props: [["bin", 2, 3], ["bush", 0, 1], ["car", 0, 1]] },
  drain: { name: "Storm drain", outdoor: false, texture: "texture_concrete", wall: "#4b5157", floor: "rgba(10, 20, 30, 0.35)", props: [["pipe", 2, 3], ["crate", 0, 1]] },
  playground: { name: "Playground", outdoor: true, texture: "texture_grass", wall: null, floor: "rgba(220, 200, 140, 0.25)", props: [["slide", 1, 1], ["bush", 1, 2], ["bin", 0, 1]] },
  lot: { name: "Empty lot", outdoor: true, texture: "texture_concrete", wall: null, floor: "rgba(110, 120, 70, 0.3)", props: [["dumpster", 0, 1], ["pallet", 1, 2], ["bush", 1, 2]] },
};

// ---- State ----
function freshExtState() {
  return { licensed: false, score: EXT_SCORE_START, humane: 0, brutal: 0, jobsDone: 0, offers: [], offersDay: -1, nextId: 1, active: null };
}
let extState = freshExtState();
if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({
    name: "extState",
    get: () => extState,
    set: (v) => {
      extState = v && typeof v === "object" ? v : freshExtState();
      _jobSites.clear(); // (made again from the seed when asked)
      return extState;
    },
    fresh: () => freshExtState(),
  });
}
function _ext() {
  if (!extState || typeof extState !== "object") extState = freshExtState();
  for (const [k, v] of Object.entries(freshExtState())) if (extState[k] === undefined) extState[k] = v;
  if (!Array.isArray(extState.offers)) extState.offers = [];
  return extState;
}

// (read without filling anything in: a save keeps exactly what it had)
function _extR() {
  return extState && typeof extState === "object" ? extState : {};
}
function _extActive() {
  return _extR().active || null;
}

function extStars() {
  return Math.max(0, Math.min(5, Math.floor((_extR().score ?? EXT_SCORE_START) / 20)));
}
function extStarText() {
  const n = extStars();
  return "★".repeat(n) + "☆".repeat(5 - n);
}
function extLicensed() {
  return !!_extR().licensed;
}

function buyExtLicence() {
  const s = _ext();
  if (s.licensed) return false;
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < EXT_LICENCE_PRICE) {
    if (typeof addUIMessage === "function") addUIMessage(`An exterminator's licence costs $${EXT_LICENCE_PRICE}.`);
    return false;
  }
  if (!free) money -= EXT_LICENCE_PRICE;
  s.licensed = true;
  s.offersDay = -1;
  refreshExtOffers();
  if (typeof addUIMessage === "function") addUIMessage("You're a licensed exterminator. Jobs will be posted on FluffList's Pest control tab.");
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: "You got an exterminator's licence." });
  return true;
}

// ---- A seeded random number maker (sites come out the same from a seed) ----
function extRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---- Offers ----
// Which clients call: your name leans them (humane work brings families,
// culling brings farms and the city); the city and stores want some stars
function _extClientWeights() {
  const s = _extR();
  const stars = extStars();
  const total = (s.humane || 0) + (s.brutal || 0);
  const humaneShare = total ? (s.humane || 0) / total : 0.5;
  const w = {};
  for (const [k, c] of Object.entries(EXT_CLIENTS)) {
    let x = 1;
    if (c.likes === "humane") x *= 0.5 + humaneShare;
    if (c.likes === "brutal") x *= 1.5 - humaneShare;
    if (k === "store" && stars < 1) x *= 0.3;
    if (k === "city" && stars < 2) x *= 0.2;
    w[k] = x;
  }
  return w;
}

function makeExtOffer(rnd = Math.random, clientKey = null) {
  const s = _ext();
  const stars = extStars();
  if (!clientKey) {
    const w = _extClientWeights();
    let pick = rnd() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const [k, x] of Object.entries(w)) {
      pick -= x;
      if (pick <= 0) {
        clientKey = k;
        break;
      }
    }
    clientKey = clientKey || "farmer";
  }
  const client = EXT_CLIENTS[clientKey];
  // Now and then something special (more often with a good name)
  const rare = rnd() < 0.06 + stars * 0.03 ? (rnd() < 0.5 ? "mega" : "colony") : null;
  const herd = Math.round((5 + Math.floor(rnd() * 4) + stars * 2) * client.herd * (rare ? EXT_RARE[rare].herd || 1 : 1));
  const hours = EXT_DEADLINE_HOURS[0] + Math.floor(rnd() * (EXT_DEADLINE_HOURS[1] - EXT_DEADLINE_HOURS[0] + 1)) + (rare === "mega" ? 3 : 0);
  const offer = {
    id: s.nextId++,
    client: clientKey,
    who: client.who[Math.floor(rnd() * client.who.length)],
    herd: Math.max(3, herd),
    rooms: Math.min(client.rooms.length, 3 + (rnd() < 0.5 + stars * 0.08 ? 1 : 0)),
    hours,
    perHead: Math.round(client.perHead * (1 + 0.1 * stars) * (rare ? EXT_RARE[rare].pay : 1)),
    humane: rnd() < client.humaneChance,
    pet: rnd() < client.pet,
    rare,
    seed: Math.floor(rnd() * 2147483647) + 1,
    until: getDayNumber() + EXT_OFFER_DAYS,
    request: null,
  };
  if (rnd() < EXT_REQUEST_CHANCE) {
    const keys = Object.keys(EXT_REQUESTS).filter((k) => EXT_REQUESTS[k].clients.includes(clientKey) && !(EXT_REQUESTS[k].notHumane && offer.humane));
    if (keys.length) offer.request = keys[Math.floor(rnd() * keys.length)];
  }
  return offer;
}

function extOfferBlurb(o) {
  const c = EXT_CLIENTS[o.client] || EXT_CLIENTS.farmer;
  const req = EXT_REQUESTS[o.request];
  return c.blurb(o.herd, o) + (o.rare ? ` ${EXT_RARE[o.rare].blurb}` : "") + (req ? ` ${req.text}` : "");
}

function refreshExtOffers() {
  const s = _ext();
  if (!s.licensed) return;
  const day = getDayNumber();
  s.offers = s.offers.filter((o) => o.until >= day);
  if (s.offersDay === day) return;
  s.offersDay = day;
  const n = 1 + (Math.random() < 0.4 + 0.1 * extStars() ? 1 : 0);
  for (let i = 0; i < n && s.offers.length < EXT_OFFERS_MAX; i++) s.offers.push(makeExtOffer());
}

// ---- Sites ----
const _jobSites = new Map(); // jobId -> site (made from the seed)

// { id, rooms: [{ scene, kind, gx, gy, links: { left, right, up, down }, props: [{ kind, x, y }] }] }
function makeJobSite(job) {
  const rnd = extRng(job.seed);
  const client = EXT_CLIENTS[job.client] || EXT_CLIENTS.farmer;
  const kinds = [client.rooms[0]];
  const pool = client.rooms.slice(1);
  while (kinds.length < job.rooms && pool.length) kinds.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  // Lay them out on a little grid, each joined to one already placed
  const rooms = [];
  const at = new Map();
  const dirs = [
    ["left", -1, 0, "right"],
    ["right", 1, 0, "left"],
    ["up", 0, -1, "down"],
    ["down", 0, 1, "up"],
  ];
  kinds.forEach((kind, i) => {
    let gx = 0;
    let gy = 0;
    let from = null;
    if (i > 0) {
      for (let tries = 0; tries < 40; tries++) {
        const base = rooms[Math.floor(rnd() * rooms.length)];
        const d = dirs[Math.floor(rnd() * dirs.length)];
        const nx = base.gx + d[1];
        const ny = base.gy + d[2];
        if (at.has(`${nx},${ny}`)) continue;
        gx = nx;
        gy = ny;
        from = { base, d };
        break;
      }
      if (!from) {
        // (boxed in: off to the right of the last)
        const base = rooms[rooms.length - 1];
        gx = base.gx + 1;
        gy = base.gy;
        while (at.has(`${gx},${gy}`)) gx++;
        from = { base, d: dirs[1] };
      }
    }
    const room = { scene: `JOB_${job.id}_${i}`, kind, gx, gy, links: {}, props: [] };
    if (from) {
      from.base.links[from.d[0]] = room.scene;
      room.links[from.d[3]] = from.base.scene;
    }
    rooms.push(room);
    at.set(`${gx},${gy}`, room);
  });
  // Neighbours side by side are joined too
  for (const r of rooms) {
    for (const d of dirs) {
      const n = at.get(`${r.gx + d[1]},${r.gy + d[2]}`);
      if (n && !r.links[d[0]]) {
        r.links[d[0]] = n.scene;
        n.links[d[3]] = r.scene;
      }
    }
  }
  // Things to hide behind
  for (const r of rooms) {
    const def = EXT_ROOM_KINDS[r.kind];
    const top = height * 0.15;
    for (const [kind, lo, hi] of def.props) {
      const n = lo + Math.floor(rnd() * (hi - lo + 1));
      for (let i = 0; i < n; i++) {
        r.props.push({ kind, x: 170 + rnd() * (width - 340), y: top + 120 + rnd() * (height - top - 260) });
      }
    }
  }
  return { id: job.id, rooms };
}

function jobSite(jobId = _extActive() && _extActive().id) {
  if (jobId == null) return null;
  let site = _jobSites.get(jobId);
  if (!site) {
    const job = _extActive() && _extActive().id === jobId ? _extActive() : null;
    if (!job) return null;
    site = makeJobSite(job);
    _jobSites.set(jobId, site);
  }
  return site;
}

function isJobScene(scene) {
  return typeof scene === "string" && scene.startsWith("JOB_");
}

function jobRoomOf(scene) {
  if (!isJobScene(scene)) return null;
  const site = jobSite();
  return site ? site.rooms.find((r) => r.scene === scene) || null : null;
}

// globals.js getSceneConfig: a job room
const _jobConfigs = new Map();
function jobSceneConfig(scene) {
  const known = _jobConfigs.get(scene);
  if (known) return known;
  const room = jobRoomOf(scene);
  const def = EXT_ROOM_KINDS[(room && room.kind) || "yard"];
  const cfg = {
    id: scene,
    isIndoor: !def.outdoor,
    insidePlayerQuarters: false,
    isOutdoor: def.outdoor,
    isGrassy: false,
    isAlley: false,
    isAdoptionRoom: false,
    hasRiver: false,
    backgroundTexture: def.texture,
    topWallColor: def.wall,
    spawnFerals: false,
    isJobSite: true,
    noDespawn: true,
  };
  if (room) _jobConfigs.set(scene, cfg);
  return cfg;
}

function jobRoomName(scene) {
  const room = jobRoomOf(scene);
  return room ? EXT_ROOM_KINDS[room.kind].name : "The job";
}

// UIScenes.getScenePortals: arrows at the edges to the rooms next door
function getJobPortals(scene) {
  if (!isJobScene(scene)) return null;
  const room = jobRoomOf(scene);
  if (!room) return [];
  const out = [];
  if (room.links.left) out.push({ type: "arrow_left", x: 20, y: height / 2 - 40, w: 60, h: 80, target: room.links.left, label: jobRoomName(room.links.left), job: true });
  if (room.links.right) out.push({ type: "arrow_right", x: width - 80, y: height / 2 - 40, w: 60, h: 80, target: room.links.right, label: jobRoomName(room.links.right), job: true });
  if (room.links.up) out.push({ type: "arrow_up", x: width / 2 - 40, y: height * 0.15 + 8, w: 80, h: 60, target: room.links.up, label: jobRoomName(room.links.up), job: true });
  if (room.links.down) out.push({ type: "arrow_down", x: width / 2 - 40, y: height - 80, w: 80, h: 60, target: room.links.down, label: jobRoomName(room.links.down), job: true });
  return out;
}

// ---- Drawing a room (script.js, after the background) ----
function drawJobScenery(c) {
  if (!isJobScene(currentScene)) return;
  const room = jobRoomOf(currentScene);
  if (!room) return;
  const def = EXT_ROOM_KINDS[room.kind];
  const top = height * 0.15;
  c.save();
  if (def.floor) {
    c.fillStyle = def.floor;
    c.fillRect(0, top, width, height - top);
  }
  _drawExtRoomWall(c, room.kind, top);
  if (room.kind === "barn" || room.kind === "coop") {
    // Plank wall
    c.strokeStyle = "rgba(40, 20, 8, 0.45)";
    c.lineWidth = 2;
    for (let x = 0; x < width; x += 46) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, top);
      c.stroke();
    }
    if (room.kind === "coop") {
      // Chicken wire
      c.strokeStyle = "rgba(220,220,220,0.35)";
      c.lineWidth = 1;
      for (let x = -top; x < width; x += 18) {
        c.beginPath();
        c.moveTo(x, top);
        c.lineTo(x + top, 0);
        c.moveTo(x, 0);
        c.lineTo(x + top, top);
        c.stroke();
      }
    }
  } else if (EXT_FENCED.has(room.kind)) {
    // A fence or a treeline along the top
    if (room.kind === "woods") {
      for (let x = 20; x < width; x += 95) drawExtTree(c, x + ((x * 7) % 30), top + 30, 1);
    } else {
      c.fillStyle = "#8a6a44";
      c.fillRect(0, top + 8, width, 6);
      c.fillRect(0, top + 26, width, 6);
      for (let x = 10; x < width; x += 80) c.fillRect(x, top - 6, 8, 46);
    }
    if (room.kind === "field") {
      c.strokeStyle = "rgba(90, 70, 30, 0.25)";
      c.lineWidth = 6;
      for (let y = top + 80; y < height - 40; y += 55) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(width, y + 10);
        c.stroke();
      }
    }
  }
  // The van, in the yard
  if (room === jobSite().rooms[0]) drawExtVan(c, extVanSpot().x, extVanSpot().y, 1);
  for (const p of room.props) drawExtProp(c, p);
  c.restore();
}

const EXT_FENCED = new Set(["yard", "field", "woods", "garden", "playground"]);

// The top of each other kind of room
function _drawExtRoomWall(c, kind, top) {
  c.save();
  if (kind === "shed") {
    c.strokeStyle = "rgba(40, 20, 8, 0.45)";
    c.lineWidth = 2;
    for (let x = 0; x < width; x += 38) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, top);
      c.stroke();
    }
    // Tools on hooks
    c.strokeStyle = "#3a3a3a";
    c.lineWidth = 4;
    for (let x = 120; x < width; x += 260) {
      c.beginPath();
      c.moveTo(x, top * 0.2);
      c.lineTo(x, top * 0.9);
      c.moveTo(x + 40, top * 0.2);
      c.lineTo(x + 40, top * 0.75);
      c.stroke();
    }
  } else if (kind === "garage") {
    c.fillStyle = "#c8cdd2";
    c.fillRect(width / 2 - 260, top * 0.15, 520, top * 0.85);
    c.strokeStyle = "#7d858c";
    c.lineWidth = 2;
    for (let y = top * 0.15; y < top; y += 14) {
      c.beginPath();
      c.moveTo(width / 2 - 260, y);
      c.lineTo(width / 2 + 260, y);
      c.stroke();
    }
    c.fillStyle = "rgba(0,0,0,0.15)";
    c.fillRect(0, top, width, 10);
  } else if (kind === "deck") {
    // Deck boards overhead, lattice at the back
    c.fillStyle = "#7c5a38";
    c.fillRect(0, 0, width, top);
    c.strokeStyle = "rgba(60, 40, 20, 0.6)";
    c.lineWidth = 3;
    for (let x = -top; x < width; x += 26) {
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(x + top, 0);
      c.moveTo(x, 0);
      c.lineTo(x + top, top);
      c.stroke();
    }
  } else if (kind === "loading") {
    c.fillStyle = "#5e6368";
    c.fillRect(0, 0, width, top);
    c.fillStyle = "#e5c22b";
    for (let x = 0; x < width; x += 60) c.fillRect(x, top - 10, 30, 10);
    c.fillStyle = "#3f4347";
    c.fillRect(width / 2 - 200, top * 0.1, 400, top * 0.8);
  } else if (kind === "stockroom") {
    c.fillStyle = "#8a7b62";
    for (let x = 30; x < width - 120; x += 220) {
      c.fillRect(x, top * 0.15, 160, 8);
      c.fillRect(x, top * 0.55, 160, 8);
      c.fillStyle = "#b9895a";
      for (let b = 0; b < 4; b++) c.fillRect(x + 8 + b * 38, top * 0.15 - 22, 30, 22);
      c.fillStyle = "#8a7b62";
    }
  } else if (kind === "dumpsters" || kind === "street") {
    c.fillStyle = kind === "street" ? "#7d7f84" : "#7f5d4c";
    c.fillRect(0, 0, width, top);
    c.fillStyle = "rgba(0,0,0,0.18)";
    for (let x = 40; x < width; x += 160) c.fillRect(x, top * 0.25, 70, top * 0.5);
  } else if (kind === "drain") {
    c.fillStyle = "#2f3438";
    c.beginPath();
    c.ellipse(width / 2, top, 300, top * 0.95, 0, Math.PI, 0);
    c.fill();
    c.fillStyle = "rgba(80, 120, 150, 0.35)";
    c.fillRect(0, height * 0.55, width, 30);
  }
  c.restore();
}

function extVanSpot() {
  return { x: 150, y: height - 150 };
}

function drawExtTree(c, x, y, k) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.fillStyle = "#5b3d22";
  c.fillRect(-8, -10, 16, 50);
  c.fillStyle = "#2f6b2a";
  c.beginPath();
  c.arc(0, -30, 38, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#3d8236";
  c.beginPath();
  c.arc(-14, -40, 22, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawExtProp(c, p) {
  c.save();
  c.translate(p.x, p.y);
  if (p.kind === "hay") {
    c.fillStyle = "#d8b45a";
    c.strokeStyle = "#9c7a2e";
    c.lineWidth = 2;
    c.fillRect(-46, -50, 92, 50);
    c.strokeRect(-46, -50, 92, 50);
    c.strokeStyle = "#7a5a1e";
    c.beginPath();
    c.moveTo(-20, -50);
    c.lineTo(-20, 0);
    c.moveTo(20, -50);
    c.lineTo(20, 0);
    c.stroke();
  } else if (p.kind === "crate") {
    c.fillStyle = "#a07848";
    c.strokeStyle = "#5e4022";
    c.lineWidth = 3;
    c.fillRect(-36, -60, 72, 60);
    c.strokeRect(-36, -60, 72, 60);
    c.beginPath();
    c.moveTo(-36, -60);
    c.lineTo(36, 0);
    c.moveTo(36, -60);
    c.lineTo(-36, 0);
    c.stroke();
  } else if (p.kind === "bush") {
    c.fillStyle = "#3f7a34";
    for (const [dx, dy, r] of [
      [-26, -22, 26],
      [0, -34, 30],
      [26, -22, 26],
      [0, -14, 28],
    ]) {
      c.beginPath();
      c.arc(dx, dy, r, 0, Math.PI * 2);
      c.fill();
    }
  } else if (p.kind === "log") {
    c.fillStyle = "#6e4a2a";
    c.fillRect(-60, -26, 120, 26);
    c.fillStyle = "#c79a64";
    c.beginPath();
    c.ellipse(60, -13, 9, 13, 0, 0, Math.PI * 2);
    c.fill();
  } else if (p.kind === "flowerbed") {
    c.fillStyle = "#6b4a2a";
    c.fillRect(-60, -18, 120, 18);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = ["#e84a6f", "#f2c14e", "#9b6ee8"][i % 3];
      c.beginPath();
      c.arc(-50 + i * 20, -26, 8, 0, Math.PI * 2);
      c.fill();
    }
  } else if (p.kind === "bin") {
    c.fillStyle = "#3c6e3c";
    c.fillRect(-24, -64, 48, 64);
    c.fillStyle = "#2e552e";
    c.fillRect(-28, -70, 56, 10);
  } else if (p.kind === "shelf") {
    c.fillStyle = "#7a6a52";
    c.fillRect(-60, -110, 6, 110);
    c.fillRect(54, -110, 6, 110);
    for (const y of [-108, -70, -32]) c.fillRect(-60, y, 120, 6);
    c.fillStyle = "#b9895a";
    for (const y of [-130, -92, -54]) for (let b = 0; b < 3; b++) c.fillRect(-50 + b * 36, y, 28, 22);
  } else if (p.kind === "car") {
    c.fillStyle = "#4a6fa5";
    c.fillRect(-110, -60, 220, 46);
    c.fillRect(-60, -92, 120, 34);
    c.fillStyle = "#cfe6f5";
    c.fillRect(-50, -86, 45, 24);
    c.fillRect(5, -86, 45, 24);
    c.fillStyle = "#222";
    for (const wx of [-70, 70]) {
      c.beginPath();
      c.arc(wx, -12, 16, 0, Math.PI * 2);
      c.fill();
    }
  } else if (p.kind === "pallet") {
    c.fillStyle = "#c9a26b";
    for (let i = 0; i < 3; i++) c.fillRect(-55, -26 + i * 8, 110, 5);
    c.fillStyle = "#a07848";
    c.fillRect(-55, -12, 12, 12);
    c.fillRect(-6, -12, 12, 12);
    c.fillRect(43, -12, 12, 12);
  } else if (p.kind === "dumpster") {
    c.fillStyle = "#2f6b4f";
    c.fillRect(-80, -80, 160, 80);
    c.fillStyle = "#23523c";
    c.fillRect(-84, -90, 168, 14);
    c.fillStyle = "#222";
    c.fillRect(-70, -6, 14, 8);
    c.fillRect(56, -6, 14, 8);
  } else if (p.kind === "pipe") {
    c.fillStyle = "#6f777e";
    c.beginPath();
    c.ellipse(0, -30, 44, 34, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#1e2226";
    c.beginPath();
    c.ellipse(0, -30, 30, 22, 0, 0, Math.PI * 2);
    c.fill();
  } else if (p.kind === "slide") {
    c.strokeStyle = "#d9534f";
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(-70, 0);
    c.lineTo(-70, -110);
    c.moveTo(-40, 0);
    c.lineTo(-40, -110);
    c.stroke();
    c.fillStyle = "#f0ad4e";
    c.beginPath();
    c.moveTo(-40, -110);
    c.lineTo(80, -6);
    c.lineTo(80, 4);
    c.lineTo(-40, -96);
    c.fill();
  } else if (p.kind === "trough") {
    c.fillStyle = "#7d8790";
    c.fillRect(-50, -26, 100, 26);
    c.fillStyle = "#5aa0d0";
    c.fillRect(-44, -22, 88, 8);
  }
  c.restore();
}

function drawExtVan(c, x, y, k) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath();
  c.ellipse(0, 4, 120, 14, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#e9ecef";
  c.strokeStyle = "#5b6470";
  c.lineWidth = 3;
  c.fillRect(-110, -110, 170, 106);
  c.strokeRect(-110, -110, 170, 106);
  c.fillRect(60, -80, 56, 76);
  c.strokeRect(60, -80, 56, 76);
  c.fillStyle = "#9fd0ee";
  c.fillRect(72, -72, 34, 26);
  c.fillStyle = "#c0392b";
  c.font = "bold 15px Arial";
  c.textAlign = "center";
  c.fillText("PEST CONTROL", -25, -60);
  c.fillStyle = "#333";
  for (const wx of [-70, 80]) {
    c.beginPath();
    c.arc(wx, -2, 16, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// ---- Starting and ending a job ----
function acceptExtOffer(id) {
  const s = _ext();
  if (s.active) {
    if (typeof addUIMessage === "function") addUIMessage("Finish the job you're on first.");
    return false;
  }
  const i = s.offers.findIndex((o) => o.id === id);
  if (i < 0) return false;
  const offer = s.offers.splice(i, 1)[0];
  startExtJob(offer);
  return true;
}

function startExtJob(offer) {
  const s = _ext();
  // (anything you're carrying stays at home)
  for (const f of fluffies) if (f.isDragging && typeof f.onDrop === "function") f.onDrop();
  for (const o of objects) if (o.isDragging && typeof o.onDrop === "function") o.onDrop();
  if (typeof isGlobalDragging !== "undefined") isGlobalDragging = false;
  s.active = {
    ...offer,
    startedAt: timePlayed,
    due: timePlayed + offer.hours * HOUR_LENGTH,
    loaded: [], // serialized fluffies caught and in the van
    bodies: 0, // bodies bagged and in the van
    killed: 0,
    homeScene: currentScene,
    player: null,
  };
  _jobConfigs.clear();
  const site = jobSite(s.active.id);
  spawnJobHerd(s.active, site);
  if (typeof placeExtPlayer === "function") placeExtPlayer(site.rooms[0].scene, extVanSpot().x + 160, extVanSpot().y - 10);
  if (typeof makeExtCrates === "function") makeExtCrates(site.rooms[0].scene);
  changeScene(site.rooms[0].scene);
  if (typeof addUIMessage === "function") addUIMessage(`${offer.who}: "${extOfferBlurb(offer)}"`);
  return s.active;
}

// The herd: spread through the rooms, most of it in one or two
function spawnJobHerd(job, site) {
  const rnd = extRng(job.seed ^ 0x5bd1e995);
  const out = [];
  const rooms = site.rooms;
  const home = rooms[1 + Math.floor(rnd() * (rooms.length - 1))] || rooms[0];
  const make = (growth, gender, scene, mum = null) => {
    const r = rnd();
    const type = r < 0.15 ? "unicorn" : r < 0.3 ? "pegasus" : "earthy";
    const f = new Horse(growth, mum ? mum.id : null, scene, type, null, rnd(), rnd(), gender);
    f.makeType(type);
    f.adopted = false;
    f.jobFeral = job.id;
    f.hunger = 0.3 + rnd() * 0.5; // (hungry enough to go for bait)
    f.playerTrust = 0.1;
    f.playerFear = 0.3 + rnd() * 0.3;
    f.x = 160 + rnd() * (width - 320);
    f.y = height * 0.15 + 140 + rnd() * (height * 0.85 - 280);
    if (mum) {
      f.motherId = mum.id;
      f.x = mum.x + (rnd() - 0.5) * 60;
      f.y = mum.y + 20;
      if (typeof relationships !== "undefined") {
        relationships[mum.id] = relationships[mum.id] || {};
        relationships[mum.id][f.id] = "baby_child";
        relationships[f.id] = relationships[f.id] || {};
        relationships[f.id][mum.id] = "mother";
      }
    }
    fluffies.push(f);
    out.push(f);
    return f;
  };
  let left = job.herd;
  while (left > 0) {
    const scene = rnd() < 0.65 ? home.scene : rooms[Math.floor(rnd() * rooms.length)].scene;
    const roll = rnd();
    const colony = job.rare === "colony";
    if (roll < (colony ? 0.85 : 0.45) && left >= 2) {
      // A mare and her foals
      const mum = make(1, "female", scene);
      left--;
      const kids = Math.min(left, colony ? 2 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 3));
      for (let k = 0; k < kids; k++) make(0.15 + rnd() * 0.4, rnd() < 0.5 ? "male" : "female", scene, mum);
      left -= kids;
    } else {
      make(1, rnd() < 0.5 ? "male" : "female", scene);
      left--;
    }
  }
  // They know each other: one herd
  for (let i = 0; i < out.length; i++)
    for (let j = i + 1; j < out.length; j++) {
      if (typeof meet === "function") meet(out[i], out[j]);
      if (typeof changeOpinion === "function") {
        changeOpinion(out[i], out[j], 0.6, "herd");
        changeOpinion(out[j], out[i], 0.6, "herd");
      }
    }
  let grown = out.filter((f) => f.growth >= 1);
  // A bigger herd often has a smarty in charge (it orders the rest at you).
  // (Only a stallion can be one: asked for and none about, one turns up.)
  let boss = grown.find((f) => f.isSmarty && f.isSmarty()) || null;
  if (!boss && (job.request === "boss" || (grown.length >= 3 && rnd() < EXT_SMARTY_CHANCE))) {
    boss = grown.find((f) => f.gender === "male") || null;
    if (!boss && job.request === "boss") {
      boss = make(1, "male", home.scene);
      job.herd += 1;
      grown = out.filter((f) => f.growth >= 1);
    }
    if (boss) {
      boss.personalities = [...(boss.personalities || []).filter((p) => p !== "smarty"), "smarty"];
      boss.smartyKind = "bad"; // (the bossy kind)
    }
  }
  if (typeof _formHerd === "function") {
    const h = _formHerd(out);
    if (h && grown.length) h.leaderId = (boss || grown[0]).id;
  }
  job.bossId = boss ? boss.id : null;
  job.herdIds = out.map((f) => f.id);
  // The client's own fluffy, out there too (leave it be)
  if (job.pet) {
    const scene = rooms[Math.floor(rnd() * Math.min(2, rooms.length))].scene;
    const pet = new Horse(1, null, scene, "earthy", null, rnd(), rnd(), "female");
    pet.makeType("earthy");
    pet.adopted = false;
    pet.clientPet = job.id;
    pet.playerTrust = 0.6;
    pet.playerFear = 0;
    pet.hunger = 1;
    pet.x = 300 + rnd() * (width - 600);
    pet.y = height * 0.55 + rnd() * 120;
    pet.accessories = { ...(pet.accessories || {}), neck: { id: "scarf", color: "hsl(350, 80%, 55%)" } };
    pet.personalities = (pet.personalities || []).filter((p) => p !== "smarty");
    fluffies.push(pet);
    // (it lives here: the herd knows it and leaves it be)
    for (const f of out) {
      if (typeof meet === "function") meet(pet, f);
      if (typeof changeOpinion === "function") {
        changeOpinion(pet, f, 0.4, "neighbour");
        changeOpinion(f, pet, 0.4, "neighbour");
      }
    }
    if (typeof fluffyNames !== "undefined") fluffyNames[pet.id] = ["Biscuit", "Daisy", "Princess", "Muffin", "Button"][Math.floor(rnd() * 5)];
    job.petId = pet.id;
  }
  return out;
}

// What's left of the herd on the site
function jobHerdLeft(job = _extActive()) {
  if (!job) return [];
  return fluffies.filter((f) => f.jobFeral === job.id && f.isAlive && isJobScene(f.scene));
}

function extJobProgress(job = _extActive()) {
  if (!job) return null;
  const caught = (job.loaded || []).filter((d) => !d.clientPet).length;
  const bodies = job.bodies || 0;
  const left = jobHerdLeft(job).length;
  return { caught, bodies, left, total: job.herd, late: timePlayed > job.due };
}

// Going home: the job's over. fate: what happens to the ones you caught
function finishExtJob(fate = "home") {
  const s = _ext();
  const job = s.active;
  if (!job) return null;
  const p = extJobProgress(job);
  const done = p.caught + p.bodies;
  const cleared = p.left === 0;
  let pay = done * job.perHead;
  if (cleared && !p.late) pay = Math.round(pay * (1 + EXT_CLEAR_BONUS));
  if (p.late) pay = Math.round(pay * EXT_LATE_CUT);
  // Culling on a humane job, or their own fluffy hurt or taken: half pay, and word gets round
  const req = EXT_REQUESTS[job.request];
  const reqOk = extRequestResult(job);
  if (reqOk) pay = Math.round(pay * (1 + EXT_REQUEST_BONUS));
  const upset = !!(job.angry || job.petKilled || job.petTaken || (req && req.rule && reqOk === false));
  if (upset) pay = Math.round(pay * 0.5);
  // The ones you caught
  let extra = 0;
  const kept = [];
  for (const data of job.loaded || []) {
    if (data.clientPet) continue; // (theirs: they take it back, unhappily)
    if (fate === "shelter") extra += EXT_SHELTER_BONUS;
    else if (fate === "reptile") extra += EXT_REPTILE_PAY;
    else {
      const f = _extUnpack(data);
      if (f) kept.push(f);
    }
  }
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free) money += pay + extra;
  // Your name as an exterminator
  const frac = job.herd > 0 ? done / job.herd : 0;
  let dScore = cleared ? 8 : frac >= 0.5 ? 3 : -4;
  if (p.late) dScore -= 3;
  if (job.angry) dScore -= 6;
  if (job.petKilled) dScore -= 10;
  else if (job.petTaken) dScore -= 5;
  if (reqOk === true) dScore += 2;
  else if (reqOk === false) dScore -= req.rule ? 4 : 1;
  s.score = Math.max(0, Math.min(100, (s.score || 0) + dScore));
  s.humane += p.caught;
  s.brutal += p.bodies;
  s.jobsDone += 1;
  // Tidy the site away
  _clearJobSite(job);
  const back = job.homeScene && !isJobScene(job.homeScene) ? job.homeScene : "INDOORS";
  s.active = null;
  _jobSites.delete(job.id);
  _jobConfigs.clear();
  if (typeof clearExtPlayer === "function") clearExtPlayer();
  changeScene(back);
  const where = fate === "shelter" ? "to the shelter" : fate === "reptile" ? "to the reptile shop" : "home with you";
  const reqLine = reqOk === true ? ` ${req.short}: done (+${Math.round(EXT_REQUEST_BONUS * 100)}%).` : reqOk === false ? ` ${req.why}!` : "";
  const why = (job.petKilled ? " You killed their fluffy!" : job.petTaken ? " You took their fluffy!" : job.angry ? " They asked you not to hurt them." : "") + reqLine;
  const line = `${job.who}: ${cleared ? "all cleared" : `${done} of ${job.herd} dealt with`}${p.late ? " (late)" : ""}.${why} Paid $${pay}${extra ? ` + $${extra}` : ""}. ${p.caught ? `${p.caught} caught, ${where}. ` : ""}Exterminator: ${extStarText()}`;
  if (typeof addUIMessage === "function") addUIMessage(line);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `Pest job for ${job.who}: ${line.split(": ").slice(1).join(": ")}`, money: pay + extra });
  return { pay, extra, kept, cleared, late: p.late, dScore, request: reqOk };
}

function _extUnpack(data) {
  try {
    const d = JSON.parse(JSON.stringify(data));
    const dest = "BACKYARD";
    d.scene = dest;
    d.x = width / 2 + (Math.random() - 0.5) * 300;
    d.y = height * 0.6 + (Math.random() - 0.5) * 100;
    d.currentCageId = null;
    d.placedOnId = null;
    d.claimedBedId = null;
    d.adopted = true;
    const f = Horse.deserialize(d);
    f.scene = dest;
    f.adopted = true;
    f.jobFeral = undefined;
    f.hiddenBy = null;
    f.hideSpot = null;
    f.jobHide = null;
    f.arrivedFrom = "a pest job";
    if (typeof relationships !== "undefined" && !relationships[f.id]) relationships[f.id] = {};
    if (!fluffies.includes(f)) fluffies.push(f);
    return f;
  } catch (e) {
    return null;
  }
}

function _clearJobSite(job) {
  for (let i = fluffies.length - 1; i >= 0; i--) if (isJobScene(fluffies[i].scene)) fluffies.splice(i, 1);
  for (let i = objects.length - 1; i >= 0; i--) if (isJobScene(objects[i].scene)) objects.splice(i, 1);
  if (typeof gibs !== "undefined") for (let i = gibs.length - 1; i >= 0; i--) if (isJobScene(gibs[i].scene)) gibs.splice(i, 1);
  if (typeof puddles !== "undefined") for (let i = puddles.length - 1; i >= 0; i--) if (isJobScene(puddles[i].scene)) puddles.splice(i, 1);
  if (typeof sceneChatLogs !== "undefined") for (const k of Object.keys(sceneChatLogs)) if (isJobScene(k)) delete sceneChatLogs[k];
  if (typeof herdState !== "undefined" && herdState && Array.isArray(herdState.list)) {
    const ids = new Set(job.herdIds || []);
    herdState.list = herdState.list.filter((h) => !h.memberIds.every((id) => ids.has(id)));
    if (typeof _herdChanged === "function") _herdChanged();
  }
}

// Asked when you head home: what to do with the catch
function askEndExtJob() {
  const job = _ext().active;
  if (!job) return;
  const p = extJobProgress(job);
  const lines = [
    `${p.caught} caught, ${p.bodies} bodies in the van, ${p.left} still loose.${p.left ? " Going home ends the job." : ""}`,
    p.late ? "You're past the deadline: half pay." : p.left === 0 ? "All clear - you'll get the bonus." : "",
    job.request && EXT_REQUESTS[job.request] ? `Their request - ${EXT_REQUESTS[job.request].short}: ${extRequestResult(job) ? "done" : EXT_REQUESTS[job.request].rule ? "broken" : "not yet"}.` : "",
  ].filter(Boolean);
  const buttons = [];
  if (p.caught) {
    buttons.push({ label: "Bring them home", run: () => finishExtJob("home") });
    buttons.push({ label: `Shelter (+$${EXT_SHELTER_BONUS} each)`, run: () => finishExtJob("shelter") });
    buttons.push({ label: `Reptile shop ($${EXT_REPTILE_PAY} each)`, kind: "danger", run: () => finishExtJob("reptile") });
  } else buttons.push({ label: "Head home", run: () => finishExtJob("home") });
  buttons.push({ label: "Keep working", cancel: true, run: () => {} });
  if (typeof openChoice === "function") openChoice({ title: `Done at ${job.who}'s?`, lines, buttons });
  else finishExtJob("home");
}

// ---- Every few seconds ----
const extTicker = new Ticker(2);
function updateExterminator(dt) {
  if (!extTicker.step(dt)) return;
  if (!_extR().licensed && !_extR().active) return;
  const s = _ext();
  if (s.licensed && !s.active) refreshExtOffers();
  const job = s.active;
  if (job && !job._warned && timePlayed > job.due - HOUR_LENGTH && timePlayed < job.due) {
    job._warned = true;
    if (typeof addUIMessage === "function") addUIMessage(`${job.who} calls: "An hour left - are you nearly done?"`);
  }
}
registerSystem("exterminator", updateExterminator, 188);

// ---- FluffList's Pest control tab (OrderBoard.js) ----
function _extCards() {
  const s = _ext();
  return s.offers.slice(0, EXT_OFFERS_MAX).map((o, i) => ({ o, x: 20 + i * 375, y: 150, w: 360, h: 260, accept: { x: 20 + i * 375 + 20, y: 150 + 205, w: 160, h: 38, label: "Take the job" } }));
}

function drawPestControlPage(c, theme, m) {
  const s = _ext();
  const text = (t, x, y, col = theme.cardText, font = "14px Arial", align = "left") => canvasText(c, t, x, y, col, font, align);
  if (!s.licensed) {
    text("Pest control", 20, 110, theme.cardText, "bold 20px Arial");
    text("Clients post jobs here: ferals on a farm, in a garden, behind a store. You drive out, catch them (or worse),", 20, 145);
    text("and you're paid by the head. Your exterminator name is your own - separate from your other names.", 20, 167);
    const b = { x: 20, y: 200, w: 300, h: 44, label: `Buy a licence ($${EXT_LICENCE_PRICE})` };
    _osButton(c, b, m, theme, money < EXT_LICENCE_PRICE);
    return;
  }
  text(`Pest control - you: ${extStarText()}  (${s.jobsDone} jobs · ${s.humane} caught · ${s.brutal} culled)`, 20, 110, theme.cardText, "bold 18px Arial");
  if (s.active) {
    const p = extJobProgress(s.active);
    text(`On a job for ${s.active.who}: ${p.caught + p.bodies}/${s.active.herd} dealt with. Head home from the van to finish it.`, 20, 140);
    return;
  }
  const cards = _extCards();
  if (!cards.length) text("No jobs posted right now. Clients post new ones every morning.", 20, 145);
  for (const card of cards) {
    const o = card.o;
    c.fillStyle = theme.card || "rgba(255,255,255,0.9)";
    c.fillRect(card.x, card.y, card.w, card.h);
    text(`${EXT_CLIENTS[o.client].name}: ${o.who}`, card.x + 16, card.y + 30, theme.cardText, "bold 16px Arial");
    c.font = "14px Arial";
    const lines = typeof wrapText === "function" ? wrapText(c, extOfferBlurb(o), card.w - 32) : [extOfferBlurb(o)];
    lines.slice(0, 4).forEach((l, i) => text(l, card.x + 16, card.y + 58 + i * 19));
    if (o.humane || o.rare) text([o.humane ? "Humane only" : "", o.rare ? EXT_RARE[o.rare].name : ""].filter(Boolean).join(" · "), card.x + card.w - 16, card.y + 30, o.humane ? "#2f7d4a" : "#a0522d", "bold 13px Arial", "right");
    text(`About ${o.herd} ferals · ${o.rooms} areas · ${o.hours} hours`, card.x + 16, card.y + 150);
    text(`$${o.perHead} a head (+${Math.round(EXT_CLEAR_BONUS * 100)}% to clear them all in time)`, card.x + 16, card.y + 172);
    text(`Posted until day ${o.until}`, card.x + 16, card.y + 194, "rgba(100,100,100,0.9)", "12px Arial");
    _osButton(c, card.accept, m, theme);
  }
}

function handlePestControlClick(m) {
  const s = _ext();
  if (!s.licensed) {
    if (_osIn(m, { x: 20, y: 200, w: 300, h: 44 })) {
      buyExtLicence();
      return true;
    }
    return false;
  }
  if (s.active) return false;
  for (const card of _extCards()) {
    if (_osIn(m, card.accept)) {
      const o = card.o;
      if (typeof openChoice === "function") {
        openChoice({
          title: `Drive out to ${o.who}'s now?`,
          lines: ["Your house carries on while you're gone.", "Walk with WASD / the arrow keys (or the stick and tapping on a phone). E (Grab) picks a fluffy up and puts it in a crate; load the crates in the van. Going home ends the job."],
          buttons: [
            {
              label: "Go now",
              run: () => {
                if (typeof closeOrdersScreen === "function") closeOrdersScreen();
                acceptExtOffer(o.id);
              },
            },
            { label: "Not yet", cancel: true, run: () => {} },
          ],
        });
      } else acceptExtOffer(o.id);
      return true;
    }
  }
  return false;
}
