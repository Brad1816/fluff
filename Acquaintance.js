// ---------------------------------------------------------------------------
// Who's met whom. A fluffy only knows the fluffies it has actually been
// around: in the same room (in the park, within MEET_RANGE) and able to see
// or hear them, both not asleep. Family isn't known by magic either - a
// stallion doesn't pine for a foal he's never set eyes on, and the house
// fluffies don't know the strays that got into the backyard.
//
// f.met = { id: 1, ... } (saved; old saves start from whoever it already
// has feelings about). haveMet(a, b) is used to keep these to fluffies it
// knows: missing a relative (HorseFamily.updateRelationships), liking (Bonds
// getLiking: none for a stranger), a mum's grief for a foal killed
// elsewhere, wishes about others, shared show memories, dreams, herd
// chatter, and the blame for family killed (Separation.js).
// Gone fluffies are dropped from the list once a day (pruneMet) unless the
// family book still knows them.
// ---------------------------------------------------------------------------

const MEET_EVERY = 2; // seconds between looks round
const MEET_RANGE = 600; // px, in the park (a house room or garden: anywhere in it)
const meetTicker = new Ticker(MEET_EVERY);
let _metPrunedDay = null;

function metOf(f) {
  if (!f.met || typeof f.met !== "object") {
    f.met = {};
    // (an old save: it knows whoever it already has feelings about)
    if (f.opinions) for (const id of Object.keys(f.opinions)) f.met[id] = 1;
  }
  return f.met;
}

// (together in a room right now counts: they can see each other)
function haveMet(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.scene === b.scene && a.scene !== undefined) {
    // (the park's big: near enough to see)
    if (!(typeof isCameraScene === "function" && isCameraScene(a.scene))) return true;
    if (Math.hypot(a.x - b.x, a.y - b.y) <= MEET_RANGE) return true;
  }
  if (metOf(a)[b.id] || metOf(b)[a.id]) return true;
  // Herd-mates know each other
  if (typeof herdOf === "function") {
    const h = herdOf(a);
    if (h && h === herdOf(b)) return true;
  }
  return false;
}

function meet(a, b) {
  if (!a || !b || a === b) return;
  metOf(a)[b.id] = 1;
  metOf(b)[a.id] = 1;
}

function _canTakeIn(f) {
  return f.isAlive && f.currentStateKey !== "SLEEPING" && (f.canSee() || f.canHear());
}

function updateMeetings(dt) {
  if (!meetTicker.step(dt) || typeof fluffies === "undefined") return;
  const byScene = new Map();
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    if (!byScene.has(f.scene)) byScene.set(f.scene, []);
    byScene.get(f.scene).push(f);
  }
  for (const [scene, list] of byScene) {
    if (list.length < 2) continue;
    const wide = typeof isCameraScene === "function" && isCameraScene(scene);
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const aOk = _canTakeIn(a);
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!aOk && !_canTakeIn(b)) continue;
        if (wide && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > MEET_RANGE * 1.4) continue;
        if (a.met && a.met[b.id] && b.met && b.met[a.id]) continue;
        meet(a, b);
      }
    }
  }
  // Once a day: forget the ids of the long gone
  const day = typeof getDayNumber === "function" ? getDayNumber() : 0;
  if (_metPrunedDay !== day) {
    _metPrunedDay = day;
    pruneMet();
  }
}
registerSystem("meetings", updateMeetings, 58);

function pruneMet() {
  const here = new Set(fluffies.map((f) => String(f.id)));
  for (const d of typeof dayCareFluffies !== "undefined" ? dayCareFluffies : []) here.add(String(d.id));
  const known = (id) => here.has(id) || (typeof fluffyRecords !== "undefined" && fluffyRecords[id]);
  let n = 0;
  for (const f of fluffies) {
    if (!f.met) continue;
    for (const id of Object.keys(f.met)) {
      if (!known(id)) {
        delete f.met[id];
        n++;
      }
    }
  }
  return n;
}
