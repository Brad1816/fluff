// ---------------------------------------------------------------------------
// "Munsta": what fluffies call the machines they don't understand.
//
// Now and then a fluffy near a working machine says what it thinks of it:
// the lawn mower in your hand ("vroom-vroom munsta"), a car on the road, the
// Feed-Bot or the Fluff-Bot driving about, the grinder spinning. A foal (or a
// timid fluffy) close to the mower or a car gets a real fright, and may wet
// itself (Scaredy.js). One line per fluffy every MUNSTA_TALK_REST, and only
// a few at once.
// ---------------------------------------------------------------------------

const MUNSTA_NEAR = 230; // px
const MUNSTA_TALK_REST = 45; // game seconds, per fluffy
const MUNSTA_SCARE_NEAR = 120;
const munstaTicker = new Ticker(1.5);

// The machines working in a scene: [{ kind, x, y }]
function _workingMachines(scene) {
  const out = [];
  if (typeof objects !== "undefined") {
    for (const o of objects) {
      if (o.scene !== scene) continue;
      if (typeof LawnMower !== "undefined" && o instanceof LawnMower && o.isDragging) out.push({ kind: "MOWER", x: o.x, y: o.y });
      else if (typeof FeedBot !== "undefined" && o instanceof FeedBot && o.state === "driving") out.push({ kind: "FEEDBOT", x: o.x, y: o.y });
      else if (typeof Roomba !== "undefined" && o instanceof Roomba && (o.state === "cleaning" || o.state === "homing")) out.push({ kind: "ROOMBA", x: o.x, y: o.y });
      else if (typeof Grinder !== "undefined" && o instanceof Grinder && o.currentSpeed > 1) out.push({ kind: "GRINDER", x: o.x, y: o.y });
    }
  }
  if (typeof cars !== "undefined") for (const c of cars) if (c.scene === scene && !c.isDestroyed) out.push({ kind: "CAR", x: c.x, y: c.y });
  return out;
}

function updateMunsta(dt) {
  if (!munstaTicker.step(dt) || typeof fluffies === "undefined") return;
  const now = timePlayed;
  const scenes = new Set(fluffies.filter((f) => f.isAlive).map((f) => f.scene));
  for (const scene of scenes) {
    const machines = _workingMachines(scene);
    if (!machines.length) continue;
    let spoken = 0;
    for (const f of fluffies) {
      if (!f.isAlive || f.scene !== scene || f.isDragging || f.currentStateKey === "SLEEPING") continue;
      let near = null;
      let nd = Infinity;
      for (const m of machines) {
        const d = Math.hypot(m.x - f.x, (m.y - f.y) * 1.5);
        if (d < nd) {
          nd = d;
          near = m;
        }
      }
      if (!near || nd > MUNSTA_NEAR) continue;
      // Up close, the loud ones frighten foals and the timid
      const timid = typeof traitValue === "function" ? traitValue(f, "bravery") < -0.3 : false;
      if ((near.kind === "MOWER" || near.kind === "CAR") && nd < MUNSTA_SCARE_NEAR && (f.growth < 0.6 || timid) && !(f._munstaScare > now - 20)) {
        f._munstaScare = now;
        f.expressionOverride = "CRYING_SHOCKED";
        f.expressionOverrideTimer = 2;
        if (typeof scaredyMess === "function") scaredyMess(f, 0.6);
      }
      if (spoken >= 2 || f.tooYoungToSpeak() || (f._munstaAt !== undefined && now - f._munstaAt < MUNSTA_TALK_REST)) continue;
      if (Math.random() > 0.35) continue;
      f._munstaAt = now;
      spoken++;
      if (typeof getDialogue === "function") f.speak(getDialogue(["MUNSTA", near.kind], f));
    }
  }
}
registerSystem("munsta", updateMunsta, 66);
