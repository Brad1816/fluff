// ---------------------------------------------------------------------------
// The Foal-4-Sketties machine (Fluff Mart, FOAL_MACHINE_PRICE): an automatic
// way to keep wild herds small. Kill-only.
//
// Put it anywhere wild fluffies live (the alley, the garden, the river, the
// park) and stock it with sketties: long-press or right-click it to stock
// FOAL_MACHINE_STOCK plates ($FOAL_MACHINE_STOCK_COST). One plate per foal.
//
// A wild herd in the same place, within FOAL_MACHINE_RANGE, that's hungry
// (its grown members' average hunger under FOAL_MACHINE_HUNGRY) and has a
// foal (under FOAL_MACHINE_GROWTH grown) may trade one - at most once every
// FOAL_MACHINE_HERD_REST:
//   - its leader decides: a bad smarty orders it; a good smarty never will
//     ("Smawty-fwen find odda nummies"); anyone else, when they're hungry
//   - a herd that fears the machine (it saw it work, or was told what the
//     sketties are made of) won't come - unless it's starving
//     (FOAL_MACHINE_STARVING)
//   - the foal: the one they value least (a runt, a deformed one, a poopie
//     coat, the smallest)
//   - the parent (its mum, if she's there; else a grown member) fetches it
//     and carries it to the machine - reluctant, or forced by a bad smarty
//   - the machine kills it inside, and a plate of sketties and meatballs comes out (the foal, minced)
//     (FOAL_MACHINE_PLATE bites) for the herd. Your own fluffies never use it.
// Witnesses: the parent is shocked and grieves (a lost foal); everyone who
// sees it learns to fear the machine (f.machineFear, saved) and is shaken.
// The sketties are made from the foals: each bite counts as eating fluffy
// (cannibalismAcceptance + FOAL_MACHINE_CANNIBAL, unknowing). Some realise
// (onFoalSkettiesEaten): most of all the parent eating from the plate its
// foal paid for, a clever one that saw the machine work, now and then one
// that fears it. Realising: sick, horrified, never eats the machine's
// sketties again (f.refusesMachine, saved), and tells the herd - who come to
// fear it. One already used to eating fluffy may realise and not care.
// Walking past it: the "munsta box" (Munsta.js).
// Shown in the magnifying glass (Mind: "The machine").
// ---------------------------------------------------------------------------

const FOAL_MACHINE_PRICE = 400;
const FOAL_MACHINE_STOCK = 10;
const FOAL_MACHINE_STOCK_COST = 60;
const FOAL_MACHINE_RANGE = 1000; // px
const FOAL_MACHINE_HUNGRY = 0.45;
const FOAL_MACHINE_STARVING = 0.15;
const FOAL_MACHINE_GROWTH = 0.6;
const FOAL_MACHINE_HERD_REST = 4 * HOUR_LENGTH;
const FOAL_MACHINE_CHANCE = 0.6; // a game hour, a willing herd
const FOAL_MACHINE_PLATE = 3; // bites
const FOAL_MACHINE_CANNIBAL = 0.05;
const FOAL_MACHINE_FEAR_SEEN = 0.6;
const FOAL_MACHINE_FEAR_TOLD = 0.35;
const FOAL_MACHINE_SEE = 500; // px
const FOAL_MACHINE_TRADE_TIME = 150; // game seconds before a trade is given up
const foalMachineTicker = new Ticker(5);

class FoalMachine {
  constructor(scene = "ALLEY") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.plates = 0;
    this.taken = 0;
    this.trade = null; // { herdId, parentId, foalId, phase: "fetch" | "bring", at }
    this._spin = 0;
  }
  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = Math.max(mouse.y + this.dragOffset.y, sceneTop(this.scene) + 10);
    }
    if (this._spin > 0) this._spin = Math.max(0, this._spin - dt);
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
    return px >= this.x - 38 && px <= this.x + 38 && py >= this.y - 100 && py <= this.y + 4;
  }
  serialize() {
    return { classType: "FoalMachine", id: this.id, x: this.x, y: this.y, scene: this.scene, currentCageId: null, plates: this.plates, taken: this.taken };
  }
  deserialize(d) {
    this.plates = Math.max(0, d.plates | 0);
    this.taken = Math.max(0, d.taken | 0);
  }
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    drawFoalMachineShape(ctx, this.x, this.y, 1, this.plates, this._spin > 0);
  }
}

// A boxy vending machine: a hopper on top, a sign, a plate chute; (x, y) the
// middle of its base
function drawFoalMachineShape(c, x, y, k = 1, plates = 0, working = false) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.lineJoin = "round";
  c.strokeStyle = "#2a2a2a";
  c.lineWidth = 2;
  // Body
  c.fillStyle = working ? "#b8463c" : "#a33a32";
  roundRectPath(c, -34, -88, 68, 86, 6);
  c.fill();
  c.stroke();
  // Hopper (where the foal goes)
  c.fillStyle = "#6d6d6d";
  c.beginPath();
  c.moveTo(-22, -88);
  c.lineTo(22, -88);
  c.lineTo(14, -100);
  c.lineTo(-14, -100);
  c.closePath();
  c.fill();
  c.stroke();
  // Sign
  c.fillStyle = "#f4e6c8";
  roundRectPath(c, -28, -80, 56, 24, 4);
  c.fill();
  c.stroke();
  c.fillStyle = "#7a1d16";
  c.font = "bold 9px Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("FOAL 4", 0, -73);
  c.fillText("SKETTIES", 0, -63);
  // Chute
  c.fillStyle = "#2b2b2b";
  roundRectPath(c, -18, -40, 36, 16, 3);
  c.fill();
  // Plates left
  c.fillStyle = plates > 0 ? "#ffe9a8" : "#ff8a80";
  c.font = "bold 11px Arial";
  c.fillText(plates > 0 ? `${plates}` : "EMPTY", 0, -16);
  // Feet
  c.fillStyle = "#333";
  c.fillRect(-30, -4, 10, 4);
  c.fillRect(20, -4, 10, 4);
  c.restore();
}

function allFoalMachines() {
  return typeof objects !== "undefined" ? objects.filter((o) => o instanceof FoalMachine) : [];
}

// ---- Stocking it (long-press / right-click) ----

function openFoalMachine(m) {
  if (!m || typeof openChoice !== "function") return false;
  return openChoice({
    title: "Foal-4-Sketties machine",
    lines: [
      `Plates left: ${m.plates}. Foals taken: ${m.taken}.`,
      "Hungry wild herds nearby trade it a foal for a plate of sketties and meatballs. The foal doesn't come out.",
    ],
    buttons: [
      { label: `Stock ${FOAL_MACHINE_STOCK} plates ($${FOAL_MACHINE_STOCK_COST})`, run: () => stockFoalMachine(m) },
      { label: "Close", cancel: true, run: () => {} },
    ],
  });
}

function stockFoalMachine(m, n = FOAL_MACHINE_STOCK) {
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < FOAL_MACHINE_STOCK_COST) {
    if (typeof addUIMessage === "function") addUIMessage(`Not enough money ($${FOAL_MACHINE_STOCK_COST}).`);
    return false;
  }
  if (!free) money -= FOAL_MACHINE_STOCK_COST;
  m.plates += n;
  if (typeof addUIMessage === "function") addUIMessage(`The machine has ${m.plates} plates of sketties.`);
  return true;
}

// ---- Who'd trade ----

function _fmHerdHere(h, m) {
  return getHerdMembers(h).filter((f) => f.isAlive && f.scene === m.scene && !f.adopted && !f.currentCage && !f.placedOn && !f.isDragging && Math.hypot(f.x - m.x, f.y - m.y) < FOAL_MACHINE_RANGE);
}

function machineFearOf(f) {
  return Math.max(0, Math.min(1, (f && f.machineFear) || 0));
}

// The foal they'd give up (least valued), or null
function pickTradeFoal(members) {
  let best = null;
  let bs = -Infinity;
  for (const f of members) {
    if (f.growth >= FOAL_MACHINE_GROWTH || f._riding) continue;
    let s = 1 - f.growth;
    if (f.runt) s += 3;
    if (Array.isArray(f.deformities) && f.deformities.length) s += 2;
    if (typeof isPoopieCoated === "function" && isPoopieCoated(f)) s += 1.5;
    if (s > bs) {
      bs = s;
      best = f;
    }
  }
  return best;
}

// Who carries it: its mum if she's there, else a grown member (not a bad smarty leader)
function pickTradeParent(foal, members, lead) {
  const mum = members.find((f) => f.id === foal.motherId && f.growth >= 1 && f.isAlive);
  if (mum && !(mum.isSensitive && mum.isSensitive())) return mum;
  return members.filter((f) => f.growth >= 1 && f !== lead && !(f.isSensitive && f.isSensitive())).sort((a, b) => Math.hypot(a.x - foal.x, a.y - foal.y) - Math.hypot(b.x - foal.x, b.y - foal.y))[0] || null;
}

// Would this herd trade now? Returns { foal, parent, lead, forced } or a reason string
function herdWouldTrade(h, m) {
  if (typeof herdIsYours === "function" && herdIsYours(h)) return "yours";
  const members = _fmHerdHere(h, m);
  const grown = members.filter((f) => f.growth >= 1);
  if (!grown.length) return "none here";
  const hunger = grown.reduce((s, f) => s + (f.hunger ?? 1), 0) / grown.length;
  if (hunger >= FOAL_MACHINE_HUNGRY) return "not hungry";
  const lead = getHerdLeader(h);
  if (lead && typeof isGoodSmarty === "function" && isGoodSmarty(lead)) return "good leader";
  const starving = hunger < FOAL_MACHINE_STARVING;
  const afraid = grown.reduce((s, f) => s + machineFearOf(f), 0) / grown.length >= 0.5 || grown.some((f) => f.refusesMachine && f === lead);
  if (afraid && !starving) return "afraid";
  const foal = pickTradeFoal(members);
  if (!foal) return "no foal";
  const parent = pickTradeParent(foal, members, lead);
  if (!parent) return "no one to carry it";
  const forced = !!(lead && lead !== parent && lead.isSmarty && lead.isSmarty());
  return { foal, parent, lead, forced, starving, afraid };
}

function _fmSay(f, key, target = null) {
  if (f && f.isAlive && !f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING" && typeof getDialogue === "function") f.speak(getDialogue(["F4S", key], f, target), true);
}

function startFoalTrade(m, h, plan) {
  const { foal, parent, lead, forced, afraid } = plan;
  m.trade = { herdId: h.id, parentId: parent.id, foalId: foal.id, phase: "fetch", at: timePlayed };
  h._f4sAt = timePlayed;
  parent._f4s = { machineId: m.id };
  if (lead && lead !== parent) _fmSay(lead, lead.isSmarty && lead.isSmarty() ? "DECIDE" : "DECIDE_HUNGRY", parent);
  if (afraid) _fmSay(parent, "STARVING");
  else _fmSay(parent, forced ? "FORCED" : "PARENT", foal);
  return m.trade;
}

function _fmAbort(m) {
  const t = m.trade;
  m.trade = null;
  if (!t) return;
  const p = fluffyById(t.parentId);
  if (p) p._f4s = null;
  const foal = fluffyById(t.foalId);
  if (foal) foal._f4sCarried = null;
}

// It goes in
function feedFoalToMachine(m, foal, parent) {
  m.trade = null;
  if (parent) parent._f4s = null;
  if (!foal || !foal.isAlive) return false;
  foal._f4sCarried = null;
  foal.x = m.x;
  foal.y = m.y - 90;
  if (foal.tooYoungToSpeak()) {
    if (typeof getDialogue === "function") foal.speak(getDialogue(["F4S", "FOAL_CHIRPY"], foal), true);
  } else _fmSay(foal, "FOAL", parent);
  const cause = "Fed to the Foal-4-Sketties machine";
  const wasMine = foal.adopted;
  foal.die(null, cause);
  foal.isDestroyed = true; // (nothing comes out but meatballs on sketties)
  m.taken++;
  m.plates = Math.max(0, m.plates - 1);
  m._spin = 3;
  if (typeof addPointToPuddle === "function") addPointToPuddle(m.scene, m.x + (Math.random() - 0.5) * 20, m.y - 2, "blood", 6 / 200, 10 / 200);
  if (typeof poofs !== "undefined" && typeof Poof !== "undefined") poofs.push(new Poof(m.x, m.y - 60, m.scene, "#8a0303"));
  if (typeof playSound === "function") playSound("amputation");
  // The plate
  const plate = new Bowl("bowl", m.scene);
  plate.x = m.x + 55;
  plate.y = m.y + 10;
  plate.food = FOAL_MACHINE_PLATE;
  plate.foodType = "sketties";
  plate.fromFoals = true;
  plate.machinePlate = true;
  plate.byYou = false;
  plate.foalParentId = parent ? parent.id : null;
  objects.push(plate);
  // Witnesses
  for (const f of fluffies) {
    if (!f.isAlive || f === foal || f.scene !== m.scene || f.currentStateKey === "SLEEPING") continue;
    const d = Math.hypot(f.x - m.x, f.y - m.y);
    if (f === parent) {
      // It understands now
      f.lostFoalAt = timePlayed;
      f.changeHappiness(-0.3, "Fed its foal to the machine");
      f.machineFear = Math.min(1, machineFearOf(f) + FOAL_MACHINE_FEAR_SEEN);
      if (typeof f.setShock === "function") f.setShock(2);
      f.expressionOverride = "CRYING_SHOCKED";
      f.expressionOverrideTimer = 4;
      f._f4sGrief = timePlayed;
      _fmSay(f, "PARENT_REALISE", foal);
      continue;
    }
    if (d > FOAL_MACHINE_SEE || !(f.canSee && f.canSee())) continue;
    f.machineFear = Math.min(1, machineFearOf(f) + FOAL_MACHINE_FEAR_SEEN * (1 - d / (FOAL_MACHINE_SEE * 1.5)));
    f.changeHappiness(-0.1, "Saw the machine take a foal");
    if (typeof f.setShock === "function") f.setShock(1.5);
    if (Math.random() < 0.35 && (!f.speech || !f.speech.text)) _fmSay(f, "WITNESS");
  }
  // The rest of the herd at the plate: greedy or uneasy
  const h = herdOf(parent || foal);
  if (h) {
    const others = _fmHerdHere(h, m).filter((f) => f !== parent && f.growth >= 1);
    const a = others[Math.floor(Math.random() * others.length)];
    if (a) _fmSay(a, machineFearOf(a) > 0.2 || (typeof traitValue === "function" && traitValue(a, "appetite") < 0) ? "UNEASY" : "GREEDY");
    for (const f of others) f.hunger = Math.min(f.hunger ?? 1, 0.3); // (they all want some)
  }
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `The Foal-4-Sketties machine took a foal${h ? ` from the ${getHerdName(h)}` : ""}.` });
  if (currentScene === m.scene && typeof addUIMessage === "function") addUIMessage(`A ${h ? getHerdName(h) : "wild"} fluffy traded a foal to the machine. ${m.plates} plates left.`);
  if (wasMine && typeof addUIMessage === "function") addUIMessage("One of your foals was fed to the machine.");
  return true;
}

// ---- The sketties ----

// HorseUpdate (eating from a bowl): it was made from foals
function onFoalSkettiesEaten(f, bowl) {
  if (typeof noteAteFluffyMeat === "function") noteAteFluffyMeat(f); // (BadMeat.js: the wobbles)
  f.cannibalismAcceptance = Math.min(1, (f.cannibalismAcceptance || 0) + FOAL_MACHINE_CANNIBAL);
  if (f.refusesMachine) return null;
  const smart = typeof smartsOf === "function" ? smartsOf(f) : 0;
  const isParent = bowl && bowl.foalParentId === f.id;
  let p = 0;
  if (isParent) p = 0.6;
  else if (machineFearOf(f) > 0 && smart >= 0.3) p = 0.4;
  else if (machineFearOf(f) > 0) p = 0.1;
  if (Math.random() >= p) return null;
  // It realises
  if ((f.cannibalismAcceptance || 0) >= 0.6) {
    _fmSay(f, "DONT_CARE");
    return "doesn't care";
  }
  f.refusesMachine = true;
  f.machineFear = Math.max(machineFearOf(f), 0.8);
  f.hunger = Math.max(0.1, (f.hunger ?? 1) - 0.3); // (sick it up - but not starving for it)
  if (typeof f.triggerVomit === "function") f.triggerVomit();
  f.changeHappiness(-0.25, "Ate sketties made from foals");
  if (typeof f.setShock === "function") f.setShock(2);
  _fmSay(f, isParent ? "REALISE_PARENT" : "REALISE_CLEVER");
  if (typeof recordStory === "function") recordStory("turning", f, { x: `${typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "It"} realised what the machine's sketties are made of.` });
  // ...and tells the herd
  const h = herdOf(f);
  if (h) {
    let told = false;
    for (const o of getHerdMembers(h)) {
      if (o === f || o.scene !== f.scene || Math.hypot(o.x - f.x, o.y - f.y) > 500) continue;
      o.machineFear = Math.min(1, machineFearOf(o) + FOAL_MACHINE_FEAR_TOLD);
      told = true;
    }
    if (told) f._f4sTellAt = timePlayed + 3; // (says so in a moment: updateFoalMachines)
  }
  return "realised";
}

// HorseUpdate: won't eat the machine's sketties any more
function refusesFoalSketties(f, bowl) {
  if (!bowl || !bowl.fromFoals || !f.refusesMachine) return false;
  if ((f.hunger ?? 1) < 0.05) return false; // (starving: anything)
  if (Math.random() < 0.05) _fmSay(f, "REFUSE_SKETTIES");
  return true;
}

// ---- Every few seconds ----

// (the list of machines, looked up again once a second rather than every frame)
let _fmList = null;
let _fmListAt = -Infinity;
function updateFoalMachines(dt) {
  if (!_fmList || timePlayed - _fmListAt >= 1 || timePlayed < _fmListAt) {
    _fmList = allFoalMachines();
    _fmListAt = timePlayed;
  }
  const machines = _fmList;
  if (!machines.length) return;
  // Carrying (every frame)
  for (const m of machines) {
    const t = m.trade;
    if (!t || t.phase !== "bring") continue;
    const p = fluffyById(t.parentId);
    const foal = fluffyById(t.foalId);
    if (!p || !foal || !p.isAlive || !foal.isAlive || foal.isDragging || p.isDragging || p.scene !== m.scene || foal.scene !== m.scene) {
      _fmAbort(m);
      continue;
    }
    foal.x = p.x + (p.facingRight ? -14 : 14);
    foal.y = p.y - 18;
    foal._f4sCarried = true;
  }
  const step = foalMachineTicker.step(dt);
  if (!step || typeof herdState === "undefined" || !herdState) return;
  const now = timePlayed;
  // Empty plates are cleared away (they'd pile up in the wild otherwise)
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o instanceof Bowl && o.machinePlate && !(o.food > 0) && !o.isDragging) objects.splice(i, 1);
  }
  // "Nu eat box sketties!" - telling the herd, a moment after realising
  for (const f of fluffies) {
    if (typeof f._f4sTellAt === "number" && now >= f._f4sTellAt) {
      f._f4sTellAt = null;
      if (f.isAlive) _fmSay(f, "TELL");
    }
  }
  for (const m of machines) {
    if (m.trade) {
      if (now - m.trade.at > FOAL_MACHINE_TRADE_TIME || now < m.trade.at) _fmAbort(m);
      continue;
    }
    if (m.plates <= 0 || m.isDragging) continue;
    for (const h of herdState.list || []) {
      if (typeof h._f4sAt === "number" && now >= h._f4sAt && now - h._f4sAt < FOAL_MACHINE_HERD_REST) continue;
      const plan = herdWouldTrade(h, m);
      if (typeof plan === "string") {
        // A good smarty says no now and then; a frightened herd keeps away
        if (plan === "good leader" && Math.random() < 0.02 * step) _fmSay(getHerdLeader(h), "REFUSE");
        else if (plan === "afraid" && Math.random() < 0.02 * step) {
          const a = _fmHerdHere(h, m).find((f) => f.growth >= 1 && machineFearOf(f) > 0.3);
          if (a) _fmSay(a, "AFRAID");
        }
        continue;
      }
      if (Math.random() >= FOAL_MACHINE_CHANCE * (step / HOUR_LENGTH)) continue;
      startFoalTrade(m, h, plan);
      break;
    }
  }
}
registerSystem("foalMachines", updateFoalMachines, 136);

// The parent: fetch the foal, carry it to the machine
class FoalTradeDesire extends Desire {
  constructor() {
    super("FoalTrade");
  }
  _machine(h) {
    if (!h._f4s) return null;
    const m = allFoalMachines().find((x) => x.id === h._f4s.machineId);
    if (!m || !m.trade || m.trade.parentId !== h.id || m.scene !== h.scene) {
      h._f4s = null;
      return null;
    }
    return m;
  }
  evaluate(h) {
    if (!h._f4s || !h.isAlive || h.isDragging || h.placedOn || h.currentCage) return 0;
    return this._machine(h) ? 75 : 0;
  }
  execute(h) {
    const m = this._machine(h);
    if (!m) return false;
    const t = m.trade;
    const foal = fluffyById(t.foalId);
    if (!foal || !foal.isAlive || foal.scene !== h.scene || foal.isDragging) {
      _fmAbort(m);
      return false;
    }
    if (t.phase === "fetch") {
      if (Math.hypot(foal.x - h.x, foal.y - h.y) > 40) {
        if (!h.isMovingOrRunning()) h.initBehavior("MOVING");
        h.setTargetPosition(foal.x, foal.y);
        return true;
      }
      t.phase = "bring";
      t.at = timePlayed;
      return true;
    }
    if (Math.hypot(m.x - h.x, m.y + 10 - h.y) > 50) {
      if (!h.isMovingOrRunning()) h.initBehavior("MOVING");
      h.setTargetPosition(m.x - 45, m.y + 10);
      return true;
    }
    feedFoalToMachine(m, foal, h);
    return true;
  }
}

// Magnifying glass (Mind: "The machine"): [text, tone] or null
function describeFoalMachine(f) {
  if (!f) return null;
  const parts = [];
  if (typeof f._f4sGrief === "number" && timePlayed - f._f4sGrief < DAY_LENGTH) parts.push("Traded its foal to the machine");
  if (f.refusesMachine) parts.push("knows what the sketties are made of");
  else if (machineFearOf(f) >= 0.3) parts.push("afraid of the munsta box");
  if (!parts.length) return null;
  return [parts.join(" · "), "bad"];
}

// ---- Shop, registry, save ----
if (typeof SPAWN_ACTIONS !== "undefined") {
  SPAWN_ACTIONS.push({
    name: "Foal-4-Sketties",
    desc: `Keeps wild herds small: a hungry herd nearby trades it a foal for a plate of sketties and meatballs, and the foal doesn't come out. Put it where wild fluffies live. Long-press or right-click to stock it (${FOAL_MACHINE_STOCK} plates for $${FOAL_MACHINE_STOCK_COST}).`,
    cost: FOAL_MACHINE_PRICE,
    isItem: "foal_machine",
  });
}
if (typeof ITEM_TYPES !== "undefined") {
  ITEM_TYPES.push({
    sellType: "foal_machine",
    is: (o) => o instanceof FoalMachine,
    hitTest: (o, x, y) => o.hitTest(x, y),
    sellable: true,
    create: (a, sx, sy) => {
      const m = new FoalMachine(currentScene);
      m.setPosition(sx, sy);
      return m;
    },
    drawIcon: (ctx, btnSize) => drawFoalMachineShape(ctx, 0, 30, 0.38, 5),
    onRightClick: (o) => openFoalMachine(o),
  });
}
if (typeof SAVED_CLASSES !== "undefined") SAVED_CLASSES.FoalMachine = (d) => new FoalMachine(d.scene);
