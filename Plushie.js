// ---------------------------------------------------------------------------
// The comfort plushie (Fluff Mart, Home & Play, $25): a soft toy fluffy.
//
// A fluffy that spends time right beside one - sleeping with it, sitting by
// it (PLUSHIE_NEAR) - grows attached to it (plushie.bond, saved), and after
// a while (PLUSHIE_BOND_HOURS) it's that fluffy's plushie (plushie.ownerId,
// saved). One plushie each, one owner each.
// With its plushie in the room:
//   - frights come less often (PLUSHIE_RESIST of them don't happen at all)
//   - a frightened one runs to it if there's no mum or friend about, and
//     calms twice as fast beside it (Fears.js frightComforter)
// Without it - in another room, sold, thrown out - for long (PLUSHIE_MISS
// game hours) it misses it: a little unhappy, and it asks for it. Bring it
// back and it's overjoyed.
// When its owner dies, the plushie goes to its youngest foal still living
// (passOnPlushie), a little less attached to start with - "Pip has her
// mum's plushie now" - or back to nobody.
// The magnifying glass shows it ("Comfort toy"). The picture is drawn here.
// ---------------------------------------------------------------------------

const PLUSHIE_PRICE = 25;
const PLUSHIE_NEAR = 80; // px
const PLUSHIE_BOND_HOURS = 3; // game hours beside it to make it its own
const PLUSHIE_RESIST = 0.5;
const PLUSHIE_MISS = 4; // game hours apart before it misses it
const PLUSHIE_MISS_UNHAPPY = 0.02; // a game hour
const PLUSHIE_HANDED_DOWN = 0.7; // bond a foal starts with, inheriting it
const plushieTicker = new Ticker(3);


class Plushie {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.ownerId = null;
    this.bond = {};
    this.colour = ["#f6b8d2", "#b8d8f6", "#f6e3a1", "#c8f0c0"][Math.floor(Math.random() * 4)];
  }
  update() {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = Math.max(mouse.y + this.dragOffset.y, sceneTop(this.scene) + 10);
    }
    if (typeof handleGenericCageContainment === "function") handleGenericCageContainment(this, 36, 34);
  }
  onDrop() {
    return handleDropping(this);
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  getBottomY() {
    return this.y;
  }
  hitTest(px, py) {
    return px >= this.x - 22 && px <= this.x + 22 && py >= this.y - 36 && py <= this.y + 4;
  }
  serialize() {
    return { classType: "Plushie", id: this.id, x: this.x, y: this.y, scene: this.scene, ownerId: this.ownerId, bond: this.bond, colour: this.colour, currentCageId: this.currentCage ? this.currentCage.id : null };
  }
  deserialize(d) {
    this.ownerId = d.ownerId ?? null;
    this.bond = d.bond && typeof d.bond === "object" ? d.bond : {};
    if (d.colour) this.colour = d.colour;
  }
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    drawPlushieShape(ctx, this.x, this.y, 1, this.colour);
  }
}

// A little stitched toy fluffy, sitting; (x, y) is its bottom middle
function drawPlushieShape(c, x, y, k = 1, colour = "#f6b8d2") {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.lineWidth = 2;
  c.strokeStyle = "#5a4050";
  c.fillStyle = colour;
  // Body
  c.beginPath();
  c.ellipse(-2, -11, 15, 11, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Head
  c.beginPath();
  c.arc(10, -24, 10, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Ear
  c.beginPath();
  c.moveTo(6, -32);
  c.lineTo(9, -40);
  c.lineTo(13, -33);
  c.fill();
  c.stroke();
  // Button eye and a stitched smile
  c.fillStyle = "#2c2028";
  c.beginPath();
  c.arc(13, -25, 2, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#2c2028";
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(12, -21, 3, 0.2, Math.PI - 0.6);
  c.stroke();
  // A stitched patch
  c.strokeStyle = "rgba(90, 64, 80, 0.7)";
  c.setLineDash([2, 2]);
  c.strokeRect(-12, -16, 9, 8);
  c.setLineDash([]);
  // Little stubby legs
  c.fillStyle = colour;
  c.strokeStyle = "#5a4050";
  c.lineWidth = 2;
  for (const lx of [-10, 4]) {
    c.beginPath();
    c.ellipse(lx, -1, 4, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  c.restore();
}

function allPlushies() {
  return typeof objects !== "undefined" ? objects.filter((o) => o instanceof Plushie) : [];
}

// Its plushie (or null)
function plushieOf(f) {
  if (!f) return null;
  return allPlushies().find((p) => p.ownerId === f.id) || null;
}

// Its plushie, here in the room (and not in your hand)
function plushieNear(f, range = Infinity) {
  const p = plushieOf(f);
  if (!p || p.scene !== f.scene || p.isDragging) return null;
  return Math.hypot(p.x - f.x, p.y - f.y) <= range ? p : null;
}

// Fears.js startFright: its plushie being here stops some frights
function plushieSoothes(f) {
  return !!plushieNear(f) && Math.random() < PLUSHIE_RESIST;
}

// Fears.js frightComforter: nobody to run to - its plushie
function plushieComforter(f) {
  return plushieNear(f);
}

// HorseAnatomy.die: its plushie goes to its youngest foal still living
function passOnPlushie(f) {
  const p = plushieOf(f);
  if (!p) return null;
  p.ownerId = null;
  delete p.bond[f.id];
  const kids = fluffies.filter((k) => k.isAlive && (k.motherId === f.id || k.fatherId === f.id) && !plushieOf(k)).sort((a, b) => a.growth - b.growth);
  const heir = kids[0];
  if (!heir) return null;
  p.ownerId = heir.id;
  p.bond[heir.id] = Math.max(p.bond[heir.id] || 0, PLUSHIE_HANDED_DOWN);
  const who = f.gender === "male" ? "dad" : "mum";
  if (typeof recordStory === "function") recordStory("turning", heir, { x: `${fluffyDisplayName(heir)} has ${heir.gender === "male" ? "his" : "her"} ${who}'s plushie now.` });
  if (heir.adopted && typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(heir)} has ${heir.gender === "male" ? "his" : "her"} ${who}'s plushie now.`);
  return heir;
}

// Magnifying glass: [text, tone] or null
function describePlushie(f) {
  if (!f || !f.isAlive) return null;
  const p = plushieOf(f);
  if (!p) {
    // Getting attached to one?
    const best = allPlushies().filter((x) => !x.ownerId).map((x) => x.bond[f.id] || 0).sort((a, b) => b - a)[0] || 0;
    return best > 0.2 ? ["Getting attached to a plushie", "ok"] : null;
  }
  if (f._plushieMissing) return ["Misses its plushie - bring it back!", "bad"];
  return [p.scene === f.scene ? "Its plushie (here: frights are rarer)" : "Its plushie (in another room)", p.scene === f.scene ? "good" : "ok"];
}

function updatePlushies(dt) {
  const step = plushieTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const now = timePlayed;
  const plushies = allPlushies();
  // Growing attached
  for (const p of plushies) {
    if (p.isDragging) continue;
    for (const f of fluffies) {
      if (!f.isAlive || f.scene !== p.scene || f.isDragging) continue;
      if (Math.hypot(f.x - p.x, f.y - p.y) > PLUSHIE_NEAR) continue;
      const calm = f.currentStateKey === "SLEEPING" || f.currentStateKey === "IDLE" || f.currentStateKey === "LYING";
      if (!calm) continue;
      p.bond[f.id] = Math.min(1.2, (p.bond[f.id] || 0) + step / (PLUSHIE_BOND_HOURS * HOUR_LENGTH));
      if (!p.ownerId && p.bond[f.id] >= 1 && !plushieOf(f)) {
        p.ownerId = f.id;
        if (typeof recordStory === "function") recordStory("turning", f, { x: `${fluffyDisplayName(f)} found a plushie to love.` });
        if (!f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING" && typeof getDialogue === "function") f.speak(getDialogue(["PLUSHIE", "HUG"], f));
      }
    }
  }
  // Owners gone: free again
  for (const p of plushies) {
    if (p.ownerId === null || p.ownerId === undefined) continue;
    const o = fluffies.find((x) => x.id === p.ownerId);
    if (!o || !o.isAlive) p.ownerId = null;
  }
  // Missing it (or it's back)
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    const p = plushieOf(f);
    const lost = f._plushieLostAt;
    if (!p) {
      // Sold or thrown away while it was its own: it never stops missing it
      if (typeof f._plushieId === "number" && !allPlushies().some((x) => x.id === f._plushieId)) {
        if (typeof lost !== "number") f._plushieLostAt = now;
      }
    } else {
      f._plushieId = p.id;
      if (p.scene === f.scene && !p.isDragging) {
        if (f._plushieMissing) {
          f.changeHappiness(0.15);
          if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["PLUSHIE", "BACK"], f), true);
        }
        f._plushieLostAt = undefined;
        f._plushieMissing = false;
        continue;
      }
      if (typeof lost !== "number") f._plushieLostAt = now;
    }
    if (typeof f._plushieLostAt !== "number") continue;
    if (now - f._plushieLostAt < PLUSHIE_MISS * HOUR_LENGTH) continue;
    // Gone for good, a couple of days on: it gets over it
    if (!p && now - f._plushieLostAt > 2 * DAY_LENGTH) {
      f._plushieId = undefined;
      f._plushieLostAt = undefined;
      f._plushieMissing = false;
      continue;
    }
    f._plushieMissing = true;
    if (f.happiness > WAN_DIE_THRESHOLD + 0.1) f.changeHappiness((-PLUSHIE_MISS_UNHAPPY * step) / HOUR_LENGTH);
    if (!f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING" && Math.random() < 0.002 * step && (!f.speech || !f.speech.text) && typeof getDialogue === "function") f.speak(getDialogue(["PLUSHIE", "MISS"], f));
  }
}
registerSystem("plushies", updatePlushies, 137);

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({
    name: "Plushie",
    desc: "A soft toy fluffy. One that sleeps or sits beside it grows attached: with its plushie in the room it's frightened less often and calms faster. Take it away and it'll miss it. Handed down to a foal when its owner dies.",
    cost: PLUSHIE_PRICE,
    isItem: "plushie",
  });
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push({
    sellType: "plushie",
    is: (o) => o instanceof Plushie,
    hitTest: (o, x, y) => o.hitTest(x, y),
    sellable: true,
    create: (a, sx, sy) => atSpot(new Plushie(currentScene), sx, sy),
    drawIcon: (ctx, btnSize) => drawPlushieShape(ctx, 0, 18, 0.9),
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.Plushie = (d) => new Plushie(d.scene);
