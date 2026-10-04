// ---------------------------------------------------------------------------
// Out in the wild (plan round 8): frozen to the ground, wild generations,
// winter dens, burying the dead, a smarty recruiting from your yard, and the
// noisy alley herd.
//
// FROZEN TO THE GROUND: a fluffy asleep outside on a freezing night
// (coldness FREEZE_COLD+) with no bed or box under it, and nobody huddled
// close, may wake stuck to the ground (f.frozenDown, saved): it can't move,
// loses health (FREEZE_HURT a game hour) and cries until it thaws (a heater
// near, or the morning) or you pull it free (it tears: FREEZE_TEAR).
//
// WILD GENERATIONS: a foal born to a wild mum is a generation further from
// pets (f.wildGen, saved, up to 5): a little smaller each time
// (WILD_GEN_SIZE), rougher, worth less (WILD_GEN_PRICE). One that was
// someone's pet shows a collar mark (the magnifying glass says so).
//
// WINTER DENS: in winter wild herds dig a den (HerdDen) where they sleep at
// night - out of the wind (x DEN_COLD cold exposure near it).
// BURYING THE DEAD: wild fluffies cover their dead with leaves (f.buried):
// a leafy mound, half as quick to rot, and nobody's frightened by it. A pet
// of yours that knew the dead one may bury it in the yard or outside (and
// takes a little comfort from it).
//
// A SMARTY RECRUITING: now and then a bad smarty leading a herd nearby comes
// to your backyard fence (RECRUIT_CHANCE a game hour, in the day) and calls
// your fluffies out to join him. An unhappy one that doesn't trust you may
// go (it's gone wild, in his herd). The best fence (not broken) keeps them in.
//
// THE NOISY ALLEY HERD: a big wild herd (NOISY_HERD+) nesting in the alley
// sings and squabbles all night. The neighbours complain in the morning; a
// second night running costs a little of your name with families. Put a
// bin fence in the alley (Hardware, BIN_FENCE_PRICE: strays won't settle
// there) or call pest control when they complain (PEST_CONTROL_PRICE: off
// screen, like the street sweep). Saved: wildState.
// ---------------------------------------------------------------------------

const FREEZE_COLD = 0.6;
const FREEZE_CHANCE = 0.15; // a check (every 30 game seconds), when it could
const FREEZE_HURT = 5;
const FREEZE_TEAR = 4;
const WILD_GEN_SIZE = 0.04;
const WILD_GEN_PRICE = 0.06;
const DEN_COLD = 0.6;
const DEN_NEAR = 100;
const BURY_AFTER = 60; // game seconds dead before it's covered
const RECRUIT_CHANCE = 0.06; // a game hour
const NOISY_HERD = 8;
const BIN_FENCE_PRICE = 150;
const PEST_CONTROL_PRICE = 100;
const wildTicker = new Ticker(1);
const freezeTicker = new Ticker(30);

if (typeof MEMORY_TEXT !== "undefined") MEMORY_TEXT.frozen = "Frozen to the ground";

function freshWildState() {
  return { noisyNights: 0, lastNoisyNight: -1, complainDay: -1, checkedNight: -1 };
}
let wildState = freshWildState();
if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({ name: "wildState", get: () => wildState, set: (v) => (wildState = v && typeof v === "object" ? v : freshWildState()), fresh: () => freshWildState() });
}

function _wSay(f, keys, target = null, force = true) {
  if (f && f.isAlive && !f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(keys, f, target), force);
}
function _wDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : 1;
}
function _wHour() {
  return typeof gameHour === "function" ? gameHour() : 12;
}

// ---- Frozen to the ground ----
function isFrozenDown(f) {
  return !!(f && f.frozenDown && f.isAlive);
}

// Horse.updateSpeed
function frozenSpeed(f) {
  return isFrozenDown(f) ? 0 : 1;
}

function _couldFreeze(f) {
  if (!f.isAlive || f.isDragging || f.currentCage || f.placedOn || f.currentStateKey !== "SLEEPING") return false;
  if (typeof isOutdoorScene !== "function" || !isOutdoorScene(f.scene)) return false;
  if (typeof placeColdness !== "function" || placeColdness(f.scene) < FREEZE_COLD) return false;
  if (f.claimedBed) return false;
  if (typeof heatersIn === "function" && heatersIn(f.scene).some((h) => h.on !== false && Math.hypot(h.x - f.x, h.y - f.y) < (typeof HEATER_RADIUS === "number" ? HEATER_RADIUS : 240))) return false;
  const huddled = fluffies.some((o) => o !== f && o.isAlive && o.scene === f.scene && Math.abs(o.x - f.x) < 60 && Math.abs(o.y - f.y) < 45);
  return !huddled;
}

function freeFrozen(f, pulled = false) {
  if (!f || !f.frozenDown) return false;
  f.frozenDown = null;
  if (pulled) {
    f.health = Math.max(1, f.health - FREEZE_TEAR);
    _wSay(f, ["FROZEN", "PULLED"]);
  } else _wSay(f, ["FROZEN", "THAW"]);
  return true;
}

// ---- Wild generations ----
// Pregnancy.onFoalBorn (via Coats.onBabyBornHooks)
function onWildBirth(mare, baby) {
  if (!mare || mare.adopted) return;
  baby.wildGen = Math.min(5, (mare.wildGen || 0) + 1);
  if (typeof baby.updateGrowthStats === "function") baby.updateGrowthStats();
}

function wildGenScale(f) {
  return 1 - WILD_GEN_SIZE * Math.min(5, f.wildGen || 0);
}

function wildGenPrice(f) {
  return 1 - WILD_GEN_PRICE * Math.min(5, f.wildGen || 0);
}
if (typeof PRICE_MULTIPLIERS !== "undefined") PRICE_MULTIPLIERS.push(wildGenPrice);

function hasCollarMark(f) {
  if (!f) return false;
  if (f.formerPet || f.lostPet) return true;
  const p = Array.isArray(f.personalities) ? f.personalities : [];
  return p.includes("runaway") || p.includes("abandoned");
}

function describeWildness(f) {
  const parts = [];
  const g = f && f.wildGen;
  if (g) parts.push(`born wild, ${g === 1 ? "first" : g === 2 ? "second" : g === 3 ? "third" : `${g}th`} generation: smaller and rougher`);
  if (hasCollarMark(f)) parts.push("a collar mark - it was someone's pet");
  if (isFrozenDown(f)) parts.push("frozen to the ground!");
  return parts.length ? [parts.join(" · "), isFrozenDown(f) ? "bad" : ""] : null;
}
if (typeof INSPECT_ROWS !== "undefined") INSPECT_ROWS.push(["Wild", "describeWildness"]);

// ---- Winter dens ----
class HerdDen {
  constructor(scene = "PARK") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.herdId = null;
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  update() {}
  onDrop() {}
  hitTest() {
    return false;
  }
  getBottomY() {
    return this.y - 30; // (behind those sleeping in it)
  }
  serialize() {
    return { classType: "HerdDen", id: this.id, x: this.x, y: this.y, scene: this.scene, herdId: this.herdId, currentCageId: null };
  }
  deserialize(d) {
    this.herdId = d.herdId ?? null;
  }
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(c) {
    c.save();
    c.translate(this.x, this.y);
    c.fillStyle = "#5c4630";
    c.beginPath();
    c.ellipse(0, 0, 70, 26, 0, Math.PI, 0);
    c.fill();
    c.fillStyle = "#2b2016";
    c.beginPath();
    c.ellipse(0, 2, 34, 14, 0, Math.PI, 0);
    c.fill();
    c.fillStyle = "#8a6d3b";
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.ellipse(-60 + i * 15, -18 - (i % 3) * 4, 7, 3, i * 0.7, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
}

function _isWinter() {
  return typeof getSeason === "function" && /winter/i.test(String(getSeason()));
}

function denOf(f) {
  const h = typeof herdOf === "function" ? herdOf(f) : null;
  if (!h) return null;
  return objects.find((o) => o instanceof HerdDen && o.herdId === h.id && o.scene === f.scene) || null;
}

if (typeof EXTRA_WARMTH !== "undefined") {
  EXTRA_WARMTH.push((f) => {
    if (f.adopted || !_isWinter()) return 1;
    const d = denOf(f);
    return d && Math.hypot(d.x - f.x, d.y - f.y) < DEN_NEAR ? DEN_COLD : 1;
  });
}

function _denTick() {
  const winter = _isWinter();
  if (!winter) {
    for (let i = objects.length - 1; i >= 0; i--) if (objects[i] instanceof HerdDen) objects.splice(i, 1);
    return;
  }
  const night = typeof nightAmount === "function" ? nightAmount() : 0;
  for (const h of (typeof herdState !== "undefined" && herdState && herdState.list) || []) {
    if (typeof herdIsYours === "function" && herdIsYours(h)) continue;
    const lead = getHerdLeader(h);
    if (!lead || !lead.isAlive || typeof isOutdoorScene !== "function" || !isOutdoorScene(lead.scene)) continue;
    let den = objects.find((o) => o instanceof HerdDen && o.herdId === h.id);
    if (den && den.scene !== lead.scene) {
      objects.splice(objects.indexOf(den), 1);
      den = null;
    }
    if (!den) {
      den = new HerdDen(lead.scene);
      den.herdId = h.id;
      den.setPosition(clamp(lead.x, 80, width - 80), clamp(lead.y, (typeof sceneTop === "function" ? sceneTop(lead.scene) : 120) + 80, height - 60));
      objects.push(den);
    }
    // At dusk they head to it
    if (night > 0.5) {
      for (const f of getHerdMembers(h)) {
        if (!f.isAlive || f.scene !== den.scene || f.isDragging || f.currentStateKey === "SLEEPING" || f._denNight === _wDay()) continue;
        if (Math.hypot(f.x - den.x, f.y - den.y) < DEN_NEAR) continue;
        f._denNight = _wDay();
        if (typeof f.initBehavior === "function") {
          f.initBehavior("MOVING");
          f.setTargetPosition(den.x + (Math.random() - 0.5) * 80, den.y + 10 + Math.random() * 20);
        }
      }
    }
  }
}

// ---- Burying the dead ----
function drawLeafMound(c, f) {
  const s = Math.max(0.4, f.scale || 0.5) * 2;
  c.save();
  c.translate(f.x, f.y);
  c.fillStyle = "#6b4f2a";
  c.beginPath();
  c.ellipse(0, -6 * s, 34 * s, 12 * s, 0, Math.PI, 0);
  c.fill();
  const leaf = ["#b5651d", "#c98b2b", "#8f3b1b", "#a87d2e"];
  for (let i = 0; i < 12; i++) {
    c.fillStyle = leaf[i % leaf.length];
    c.beginPath();
    c.ellipse((-28 + (i * 37) % 56) * s, (-8 - (i * 13) % 12) * s, 6 * s, 3 * s, i, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function _buryTick(step) {
  for (const body of fluffies) {
    if (body.isAlive || body.buried || body.isDragging || body.placedOn || body.currentCage) continue;
    if ((body.deathTimer || 0) < BURY_AFTER) continue;
    if (typeof isOutdoorScene !== "function" || !isOutdoorScene(body.scene)) continue;
    // A wild herd-mate or kin nearby covers it; or a pet that knew it
    const rels = (typeof relationships !== "undefined" && relationships[body.id]) || {};
    const bh = typeof herdOf === "function" ? herdOf(body) : null;
    const burier = fluffies.find((o) => {
      if (!o.isAlive || o.scene !== body.scene || o.isDragging || o.growth < 1 || Math.hypot(o.x - body.x, o.y - body.y) > 300) return false;
      if (o.currentStateKey === "SLEEPING") return false;
      const kin = rels[o.id] && rels[o.id] !== "estranged_child";
      if (!o.adopted) return kin || (bh && typeof herdOf === "function" && herdOf(o) === bh);
      return kin || (typeof getLiking === "function" && getLiking(o, body) > 0.3);
    });
    if (!burier || Math.random() > 0.2 * step) continue;
    body.buried = true;
    _wSay(burier, ["BURY", "LEAVES"], body);
    if (burier.adopted) {
      burier.changeHappiness(0.05, `Buried ${fluffyDisplayName(body)}`);
      if (body.adopted && typeof noteDayEvent === "function") noteDayEvent("news", { text: `${fluffyDisplayName(burier)} buried ${fluffyDisplayName(body)} under the leaves.` });
    }
  }
}

// ---- A smarty recruiting ----
function _recruiter() {
  for (const h of (typeof herdState !== "undefined" && herdState && herdState.list) || []) {
    if (typeof herdIsYours === "function" && herdIsYours(h)) continue;
    const lead = getHerdLeader(h);
    if (!lead || !lead.isAlive || !(lead.isSmarty && lead.isSmarty())) continue;
    if (typeof isGoodSmarty === "function" && isGoodSmarty(lead)) continue;
    if (!["ALLEY", "OUTDOORS", "ALLEY_ROAD"].includes(lead.scene)) continue;
    return { h, lead };
  }
  return null;
}

function smartyRecruits() {
  const yard = fluffies.filter((f) => f.isAlive && f.adopted && f.scene === "BACKYARD" && f.growth >= 1 && !f.currentCage && !f.placedOn && !f.isDragging);
  if (!yard.length) return null;
  const r = _recruiter();
  if (!r) return null;
  const strong = typeof backyardFenceTier !== "undefined" && backyardFenceTier >= 2 && !(typeof backyardFenceBroken !== "undefined" && backyardFenceBroken);
  if (typeof addUIMessage === "function" && currentScene === "BACKYARD") addUIMessage(`A smarty from the ${getHerdName(r.h)} is calling your fluffies over the fence.`);
  // The most likely to go: unhappy, not trusting you, not clever
  const pick = yard
    .map((f) => ({ f, w: (1 - f.happiness) * (1 - (f.playerTrust ?? 0.5)) * (1.2 - (typeof smartsOf === "function" ? Math.max(0, smartsOf(f)) : 0.5)) }))
    .sort((a, b) => b.w - a.w)[0];
  if (!pick || strong || Math.random() >= pick.w * 0.8) {
    if (pick) _wSay(pick.f, ["RECRUIT", "STAY"]);
    return null;
  }
  const f = pick.f;
  const n = fluffyDisplayName(f);
  const name = (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || null;
  f.formerPet = { how: "joined a smarty's herd", day: _wDay(), name };
  f.adopted = false;
  f.claimedBed = null;
  f.scene = r.lead.scene;
  f.x = clamp(r.lead.x + (Math.random() - 0.5) * 100, 40, width - 40);
  f.y = r.lead.y;
  if (typeof _join === "function") _join(r.h, f);
  if (typeof noteFluffyLeft === "function") noteFluffyLeft(f, "joined a smarty's herd");
  if (typeof addUIMessage === "function") addUIMessage(`${n} slipped out to join a smarty's herd.`);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `${n} was lured out of the backyard by a smarty and joined his herd.` });
  return f;
}

// ---- The noisy alley herd ----
function binFenceIn(scene) {
  return typeof objects !== "undefined" && objects.some((o) => o instanceof BinFence && o.scene === scene && !o.isDragging);
}

function _noisyHerd() {
  if (binFenceIn("ALLEY")) return null;
  for (const h of (typeof herdState !== "undefined" && herdState && herdState.list) || []) {
    if (typeof herdIsYours === "function" && herdIsYours(h)) continue;
    const here = getHerdMembers(h).filter((f) => f.isAlive && f.scene === "ALLEY" && !f.adopted);
    if (here.length >= NOISY_HERD) return h;
  }
  return null;
}

function callPestControl() {
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < PEST_CONTROL_PRICE) {
    if (typeof addUIMessage === "function") addUIMessage(`Pest control costs $${PEST_CONTROL_PRICE}.`);
    return 0;
  }
  if (!free) money -= PEST_CONTROL_PRICE;
  let n = 0;
  for (let i = fluffies.length - 1; i >= 0; i--) {
    const f = fluffies[i];
    if (f.scene !== "ALLEY" || f.adopted || f.isDragging) continue;
    if (typeof noteFluffyLeft === "function") noteFluffyLeft(f, "taken");
    fluffies.splice(i, 1);
    n++;
  }
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `Pest control cleared the alley: ${n} stray${n === 1 ? "" : "s"} taken away.` });
  if (typeof addUIMessage === "function") addUIMessage(`Pest control took ${n} stray${n === 1 ? "" : "s"} from the alley.`);
  wildState.noisyNights = 0;
  return n;
}

function _noiseTick() {
  const hour = _wHour();
  const day = _wDay();
  // Once in the small hours: are they at it?
  if (hour >= 1 && hour < 4 && wildState.checkedNight !== day) {
    wildState.checkedNight = day;
    const h = _noisyHerd();
    if (h) {
      wildState.noisyNights = wildState.lastNoisyNight === day - 1 ? (wildState.noisyNights || 0) + 1 : 1;
      wildState.lastNoisyNight = day;
      wildState.complainDay = day;
      if (wildState.noisyNights >= 2 && typeof keeperRep !== "undefined" && keeperRep && typeof keeperRep.family === "number") keeperRep.family = Math.max(-40, keeperRep.family - 1);
    }
  }
  // In the morning, the neighbours
  if (hour >= 8 && hour < 12 && wildState.complainDay === day) {
    wildState.complainDay = -1;
    const second = wildState.noisyNights >= 2;
    const text = `The neighbours complained about the herd singing and squabbling in the alley all night${second ? " - again. People are talking about you." : "."}`;
    if (typeof noteDayEvent === "function") noteDayEvent("news", { text });
    if (typeof openChoice === "function") {
      openChoice({
        title: "The neighbours are complaining",
        lines: [text, `Pest control will clear the alley ($${PEST_CONTROL_PRICE}). A bin fence (Hardware) stops strays settling there.`],
        buttons: [
          { label: `Pest control ($${PEST_CONTROL_PRICE})`, kind: "danger", run: () => callPestControl() },
          { label: "Leave it", cancel: true, run: () => {} },
        ],
      });
    }
  }
}

class BinFence {
  constructor(scene = "ALLEY") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  update() {
    if (this.isDragging) {
      this.x = mouse.x;
      this.y = Math.max(mouse.y, sceneTop(this.scene) + 20);
    }
  }
  onDrop() {
    return handleDropping(this);
  }
  hitTest(px, py) {
    return Math.abs(px - this.x) < 50 && py > this.y - 50 && py < this.y + 6;
  }
  getBottomY() {
    return this.y;
  }
  serialize() {
    return { classType: "BinFence", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: null };
  }
  deserialize() {}
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    drawBinFenceShape(ctx, this.x, this.y, 1);
  }
}

function drawBinFenceShape(c, x, y, k = 1) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.fillStyle = "#4a5a48";
  c.fillRect(-48, -46, 96, 46);
  c.strokeStyle = "#2c362b";
  c.lineWidth = 2;
  for (let i = -40; i <= 40; i += 16) {
    c.beginPath();
    c.moveTo(i, -46);
    c.lineTo(i, 0);
    c.stroke();
  }
  c.strokeRect(-48, -46, 96, 46);
  c.fillStyle = "#6b7d69";
  c.fillRect(-52, -50, 104, 6);
  c.restore();
}

// ---- Every second ----
function updateWild(dt) {
  const step = wildTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const hours = step / HOUR_LENGTH;
  // Freezing (every half minute)
  if (freezeTicker.step(step)) {
    for (const f of fluffies) if (!f.frozenDown && _couldFreeze(f) && Math.random() < FREEZE_CHANCE) {
      f.frozenDown = { at: timePlayed };
      if (typeof f.initBehavior === "function") f.initBehavior("IDLE");
      _wSay(f, ["FROZEN", "STUCK"]);
      if (f.adopted && typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(f)} has frozen to the ground outside!`);
    }
  }
  for (const f of fluffies) {
    if (f.buried && f.isDragging) f.buried = false; // (dug up)
    if (f.buried && !f.isAlive) f.deathTimer = Math.max(0, (f.deathTimer || 0) - step * 0.5); // (half as quick to rot)
    if (!isFrozenDown(f)) continue;
    if (f.isDragging) {
      freeFrozen(f, true);
      continue;
    }
    const warm = (typeof placeColdness === "function" && placeColdness(f.scene) < FREEZE_COLD - 0.15) || (typeof heatersIn === "function" && heatersIn(f.scene).some((h) => h.on !== false && Math.hypot(h.x - f.x, h.y - f.y) < 240)) || !(typeof isOutdoorScene === "function" && isOutdoorScene(f.scene));
    if (warm) {
      freeFrozen(f);
      continue;
    }
    f.health = Math.max(0, f.health - FREEZE_HURT * hours);
    f.changeHappiness(-0.08 * hours, "Frozen to the ground");
    if (f.health <= 0 && typeof f.die === "function") f.die(null, "Froze to the ground");
    else if (Math.random() < 0.08 * step) _wSay(f, ["FROZEN", "STUCK"], null, false);
  }
  _buryTick(step);
  if (Math.random() < 0.1 * step) _denTick();
  _noiseTick();
  // A smarty at the fence, in the day
  const hour = _wHour();
  if (hour >= 9 && hour < 19 && Math.random() < RECRUIT_CHANCE * hours) smartyRecruits();
}
registerSystem("wild", updateWild, 143.5);

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({ name: "Bin fence", desc: "Put it up in the alley (or anywhere outside): strays won't settle there - no noisy herds by your house.", cost: BIN_FENCE_PRICE, isItem: "bin_fence" });
}
if (typeof STORE_AISLES !== "undefined") {
  const hw = STORE_AISLES.find((a) => a.id === "hardware");
  if (hw && !hw.items.includes("bin_fence")) hw.items.push("bin_fence");
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push(
    {
      sellType: "bin_fence",
      is: (o) => o instanceof BinFence,
      inCage: "never",
      sellable: true,
      hitTest: (o, x, y) => o.hitTest(x, y),
      create: (a, sx, sy) => atSpot(new BinFence(currentScene), sx, sy),
      drawIcon: (ctx) => drawBinFenceShape(ctx, 0, 18, 0.32),
    },
    {
      sellType: "herd_den",
      is: (o) => o instanceof HerdDen,
      inCage: "ignore",
      canPickUp: () => false,
    },
  );
}
if (typeof SAVED_CLASSES !== "undefined") {
  SAVED_CLASSES.BinFence = (d) => new BinFence(d.scene);
  SAVED_CLASSES.HerdDen = (d) => new HerdDen(d.scene);
}
