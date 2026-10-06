// ---------------------------------------------------------------------------
// Fears: thunder, the dark, the Fluff-Bot - and, learnt the hard way, the
// hot iron and cages.
//
// Each fluffy has its own fears (f.fears = { thunder, dark, bot }, 0..1,
// saved). They're made the first time they're needed (fearsOf): timid
// fluffies are much more likely to be scared of things, brave ones rarely
// are. Below FEAR_MIN a fear doesn't count.
//
// What sets them off (a "fright", f.fright - not saved):
//   - Thunder: every clap in a storm (WorldTime.js calls onThunder). Heard
//     indoors too, but it takes a stronger fear (FEAR_INDOOR_THUNDER). Wakes
//     a scared fluffy up.
//   - The dark: at night in a room with no Night Light switched on, now and
//     then (more often the more scared it is); a sleeping one can wake up
//     frightened. Buy a Night Light (Fluff Mart, NIGHT_LIGHT_PRICE) and the
//     dark isn't scary in that room.
//   - The Fluff-Bot: bumping into it (Roomba.js reactToRoomba), or it driving
//     close by.
// After a fright the same thing (not thunder) can't set it off again for
// FRIGHT_REST seconds.
// A frightened fluffy trembles, cries, loses a little happiness, and either
// runs to its mum (foals) or a friend in the room, or cowers where it is
// (FrightDesire).
//
//   - The hot iron (learnt: nobody is born scared of it). Burnt with it
//     (CauteryIron.js) a fluffy is terrified of it (FIRE_FROM_BURN); one
//     that saw it happen is scared too (FIRE_FROM_SEEING, more for family).
//     You holding the iron near it (FIRE_NEAR) sets it off, and so does
//     going near a heater that's running (HEATER_NEAR).
//   - Cages (learnt too): seeing a cage cull (Cage.js) makes the ones
//     watching dread cages (CAGES_FROM_CULL, more if family were in it).
//     Being put in a cage (not an Enclosure or incubator) sets it off, and
//     so does being near a cage set to cull. Kept in an Enclosure (a cage
//     that's nothing like that glass box) it slowly gets over it
//     (CAGES_ENCLOSURE_HEAL a game hour).
//
// Helping it:
//   - Comfort it while it's frightened: pick it up or brush it
//     (onComfortedByYou, from Memory.js). The fright stops, it's happier, and
//     the fear shrinks (FEAR_COMFORT).
//   - A mum or friend next to it calms it twice as fast (a foal: an old
//     fluffy too, Elders.js).
//   - Left to cry it out alone, the fear grows a little (FEAR_WORSEN).
//   - The "Brave" lesson (Lessons.js) shrinks every fear a bit.
//   - Foals pick up the fears of whoever raises them (Upbringing.js).
//
// Shown in the magnifying glass: "Fears" (Looks & nature), and "Frightened"
// (Wellbeing, and the header) while it's happening.
// ---------------------------------------------------------------------------

const FEARS = [
  { key: "thunder", name: "thunder" },
  { key: "dark", name: "the dark" },
  { key: "bot", name: "the Fluff-Bot" },
  { key: "fire", name: "the hot iron", learnt: true }, // (CauteryIron.js)
  { key: "cages", name: "cages", learnt: true }, // (a cull: Cage.js)
  { key: "bath", name: "baths and water", learnt: true }, // (hurt in the bath, nearly drowned)
];
const FIRE_FROM_BURN = 0.75;
const FIRE_FROM_SEEING = 0.25; // (+0.15 when it was family)
const FIRE_NEAR = 260; // px: you holding the iron this close
const HEATER_NEAR = 110; // px: a running heater this close
const CAGES_FROM_CULL = 0.5; // (+0.2 when family were in it)
const CULL_CAGE_NEAR = 160; // px: a cage set to cull this close
const CAGES_ENCLOSURE_HEAL = 0.025; // fear lost a game hour kept in an Enclosure
const FEAR_MIN = 0.15; // weaker than this doesn't count
const FEAR_INDOOR_THUNDER = 0.35; // indoors it has to be at least this scared
const FEAR_COMFORT = 0.06;
const FEAR_WORSEN = 0.02;
const BATH_FROM_ROUGH = 0.35; // hurt during a bath
const BATH_FROM_DROWNING = 0.45; // pulled out of the water
const FRIGHT_TIME = { thunder: 20, dark: 15, bot: 12, fire: 15, cages: 15, bath: 12 }; // seconds, x (0.5 + fear)
const FRIGHT_REST = { thunder: 0, dark: 200, bot: 300, fire: 40, cages: 90, bath: 30 }; // seconds after a fright before the same thing can start another
const BOT_NEAR = 70; // px: the Fluff-Bot driving this close can set one off
const BOT_FRIGHT_MIN = 0.35; // a bump only frightens one this scared of it
const BOT_GET_USED = 0.12; // fear of it lost each bump (playtest: they took far too long to get used to it)
const BOT_FRIGHT_USED = 0.08; // ...and each time a fright of it wears off (it was only the Fluff-Bot)
const BOT_PASS_USED = 0.01; // ...and each second it drives by close without a fright
const DARK_FRIGHT_CHANCE = 0.004; // a second, x fear, awake in a dark room
const NIGHT_LIGHT_PRICE = 30;

const fearsTicker = new Ticker(1);

function getFear(key) {
  // (a nightmare is a fright, not a fear it has: Dreams.js)
  return FEARS.find((x) => x.key === key) || (key === "nightmare" ? { key, name: "a bad dream" } : null);
}

// { thunder, dark, bot }, made the first time
function fearsOf(f) {
  if (!f.fears || typeof f.fears !== "object") {
    const brave = traitValue(f, "bravery"); // -1 timid .. 1 brave
    const chance = Math.max(0.04, Math.min(0.65, 0.25 - 0.3 * brave));
    const fears = {};
    for (const fe of FEARS) {
      if (fe.learnt) {
        fears[fe.key] = 0; // (nobody's born scared of these)
        continue;
      }
      // (fewer are born scared of the Fluff-Bot, and not as badly - playtest 7)
      const k = fe.key === "bot" ? 0.4 : 1;
      fears[fe.key] = Math.random() < chance * k ? Math.round((0.3 + Math.random() * 0.6 * k - 0.15 * brave) * 100) / 100 : 0;
      fears[fe.key] = Math.max(0, Math.min(1, fears[fe.key]));
    }
    f.fears = fears;
  }
  for (const fe of FEARS) if (typeof f.fears[fe.key] !== "number") f.fears[fe.key] = 0;
  return f.fears;
}

function fearOf(f, key) {
  return fearsOf(f)[key] || 0;
}

function changeFear(f, key, amount) {
  const fs = fearsOf(f);
  if (!FEARS.some((x) => x.key === key)) return fs[key] || 0; // (not a real fear: a nightmare)
  fs[key] = Math.round(Math.max(0, Math.min(1, (fs[key] || 0) + amount)) * 1000) / 1000;
  return fs[key];
}

// The fears that count, strongest first
function realFears(f) {
  return FEARS.filter((fe) => fearOf(f, fe.key) >= FEAR_MIN).sort((a, b) => fearOf(f, b.key) - fearOf(f, a.key));
}

function isFrightened(f) {
  const fr = f && f.fright;
  if (!fr) return false;
  const now = timePlayed;
  // (over, or the game clock jumped back on a new game or load: updateFears
  // ends it properly - asking doesn't change anything)
  return !(fr.until < now || fr.until - now > 120);
}

// A fright ends early (comforted, a lullaby): what it was scared of
function endFright(f) {
  const key = f && f.fright ? f.fright.key : null;
  if (f) {
    f.fright = null;
    f._frightRanSaid = false;
  }
  return key;
}

function _fSay(f, key) {
  if (f.isAlive && !f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["FRIGHT", key], f), true);
}

// Something scary happened. True if it got frightened.
function startFright(f, key) {
  if (!f || !f.isAlive || f.isDragging) return false;
  // Its plushie's here: often it's not so scary after all (Plushie.js)
  if (typeof plushieSoothes === "function" && plushieSoothes(f)) return false;
  // Mum sang to it tonight: thunder and the dark often pass it by (Lullaby.js)
  if (typeof lullabySoothes === "function" && lullabySoothes(f, key)) return false;
  // A good smarty leading its herd keeps them steady (Intelligence.js)
  if (typeof goodLeaderCalms === "function" && goodLeaderCalms(f)) return false;
  // (a Fearful room makes it worse, Climate.js)
  // (...and so does remembering the last storm, SharedMemories.js)
  const fear = Math.min(
    1,
    fearOf(f, key) *
      (typeof climateFrightMultiplier === "function" ? climateFrightMultiplier(f) : 1) *
      (typeof sharedMemoryFrightMultiplier === "function" ? sharedMemoryFrightMultiplier(f, key) : 1) *
      (typeof titleFrightMultiplier === "function" ? titleFrightMultiplier(f) : 1), // (Titles.js)
  );
  if (fear < FEAR_MIN) return false;
  const now = timePlayed;
  const seconds = (FRIGHT_TIME[key] || 15) * (0.5 + fear);
  // Just had one of these: not again straight away (thunder always)
  if (!f._frightAt) f._frightAt = {};
  const last = f._frightAt[key];
  if (!isFrightened(f) && last !== undefined && now - last >= 0 && now - last < (FRIGHT_REST[key] || 0)) return false;
  f._frightAt[key] = now;
  if (isFrightened(f)) {
    f.fright.until = Math.max(f.fright.until, now + seconds * 0.5); // scared again: goes on a bit longer
    return true;
  }
  f.fright = { key, until: now + seconds, start: now };
  if (typeof recordStory === "function") recordStory("fright", f);
  if (key === "thunder" && typeof noteStormFright === "function") noteStormFright(f); // a storm they'll remember (SharedMemories.js)
  if (f.currentStateKey === "SLEEPING" && typeof f.initBehavior === "function") f.initBehavior("IDLE"); // wakes up
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 2.5;
  f.changeHappiness(-0.03 * fear, "A fright");
  _fSay(f, key.toUpperCase());
  if (typeof scaredyMess === "function") scaredyMess(f, fear); // (Scaredy.js)
  if (typeof fluffySound === "function") fluffySound(f, "sad");
  return true;
}

// Mum (for a foal) or a friend in the room it'd run to
const _FRIGHT_CLOSE = new Set(["mother", "father", "friend", "special_friend", "sister", "brother"]);

// The same, looked up again at most once a second (FrightDesire runs it every think)
function _frightComforterSoon(f) {
  const c = f._comforter;
  if (c && timePlayed >= c.at && timePlayed - c.at < 1 && (!c.o || (c.o.isAlive !== false && c.o.scene === f.scene))) return c.o;
  const o = frightComforter(f);
  f._comforter = { at: timePlayed, o };
  return o;
}

function frightComforter(f) {
  const rels = typeof relationships !== "undefined" ? relationships[f.id] || {} : {};
  let best = null;
  let bd = Infinity;
  for (const o of fluffies) {
    if (o === f || !o.isAlive || o.scene !== f.scene || o.growth < 1) continue;
    if (o.id === f.motherId && f.forgotMum) continue; // (FoalLife.js: it doesn't know her)
    const isMum = o.id === f.motherId;
    // (a frightened foal runs to a wise old fluffy too: Elders.js)
    const elder = f.growth < 1 && typeof isWiseElder === "function" && isWiseElder(o);
    if (!isMum && !elder && !_FRIGHT_CLOSE.has(rels[o.id])) continue;
    if (isFrightened(o)) continue; // not much help
    const d = Math.hypot(o.x - f.x, o.y - f.y) - (isMum ? 400 : elder ? 150 : 0); // mum first, then an elder
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  // Nobody to run to: its plushie, if it's in the room (Plushie.js)
  return best || (typeof plushieComforter === "function" ? plushieComforter(f) : null);
}

// You picked it up or brushed it. True if it was frightened (and now isn't).
function onComfortedByYou(f, how = "held") {
  if (!f || !f.isAlive || !isFrightened(f)) return false;
  const key = endFright(f);
  changeFear(f, key, -FEAR_COMFORT);
  f.changeHappiness(0.03, "Comforted");
  f.expressionOverride = "GOOD_UPSIES";
  f.expressionOverrideTimer = 2;
  _fSay(f, "COMFORTED");
  if (typeof recordStory === "function") recordStory("comforted", f);
  f._frightsComforted = (f._frightsComforted || 0) + 1;
  if (key === "thunder" && typeof noteSharedComfort === "function") noteSharedComfort(f);
  return true;
}

// ---- Night Light ----

class NightLight {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.on = true;
  }
  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      this.y = Math.max(this.y, sceneTop(this.scene) + 10);
    }
    if (typeof handleGenericCageContainment === "function") handleGenericCageContainment(this, 30, 40);
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
    return px >= this.x - 16 && px <= this.x + 16 && py >= this.y - 42 && py <= this.y + 2;
  }
  serialize() {
    return {
      classType: "NightLight",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      on: this.on,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }
  deserialize(data) {
    this.on = data.on !== false;
  }
  draw(ctx) {
    this.drawOffScreen(ctx);
  }
  drawOffScreen(ctx) {
    const glow = this.on ? (typeof nightAmount === "function" ? Math.max(0.25, nightAmount()) : 1) : 0;
    drawNightLightShape(ctx, this.x, this.y, 1, glow);
  }
}

// A little mushroom lamp; (x, y) is the middle of its bottom. glow 0..1
function drawNightLightShape(c, x, y, k = 1, glow = 1) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  if (glow > 0) {
    const g = c.createRadialGradient(0, -26, 4, 0, -26, 90);
    g.addColorStop(0, `rgba(255, 220, 140, ${(0.45 * glow).toFixed(3)})`);
    g.addColorStop(1, "rgba(255, 220, 140, 0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, -26, 90, 0, Math.PI * 2);
    c.fill();
  }
  // Base
  c.fillStyle = "#e8e1d4";
  c.beginPath();
  c.ellipse(0, -1, 11, 3.5, 0, 0, Math.PI * 2);
  c.fill();
  c.fillRect(-4, -18, 8, 17);
  // Cap
  c.fillStyle = glow > 0 ? "#ffd98a" : "#c9a86a";
  c.beginPath();
  c.ellipse(0, -20, 15, 12, 0, Math.PI, 0);
  c.closePath();
  c.fill();
  c.strokeStyle = "#8a6d3b";
  c.lineWidth = 1.2;
  c.stroke();
  c.fillStyle = glow > 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)";
  for (const [dx, dy, r] of [[-6, -25, 2.2], [4, -28, 1.8], [7, -22, 1.5]]) {
    c.beginPath();
    c.arc(dx, dy, r, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function hasNightLight(scene) {
  return typeof objects !== "undefined" && objects.some((o) => typeof NightLight !== "undefined" && o instanceof NightLight && o.scene === scene && o.on && !o.isDragging);
}

function isDarkFor(f) {
  const night = typeof nightAmount === "function" ? nightAmount() : 0;
  return night > 0.7 && !hasNightLight(f.scene) && !(typeof lightsAlwaysOn === "function" && lightsAlwaysOn(f.scene));
}

SPAWN_ACTIONS.push({
  name: "Night Light",
  desc: "A little glowing mushroom lamp. Fluffies scared of the dark aren't scared in its room at night. Right-click to switch off.",
  cost: NIGHT_LIGHT_PRICE,
  isItem: "night_light",
});

// ---- Triggers ----

// WorldTime.js: a thunder clap
function onThunder() {
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    const fear = fearOf(f, "thunder");
    const outside = typeof isOutdoorScene === "function" && isOutdoorScene(f.scene);
    if (fear < (outside ? FEAR_MIN : FEAR_INDOOR_THUNDER)) continue;
    if (Math.random() < 0.3 + 0.7 * fear) startFright(f, "thunder");
  }
}

// Roomba.js: the Fluff-Bot bumped into it. True if it was frightened.
function onRoombaBump(f) {
  // A bump that does no harm: it gets used to the thing
  const fear = fearOf(f, "bot");
  if (fear > 0 && typeof changeFear === "function") changeFear(f, "bot", -BOT_GET_USED);
  if (fear < BOT_FRIGHT_MIN) return false;
  return startFright(f, "bot");
}

// ---- Learnt fears ----

// CauteryIron.js: burnt with the iron - it, and anyone who saw
function learnFearOfFire(victim) {
  if (!victim) return;
  changeFear(victim, "fire", FIRE_FROM_BURN);
  for (const o of fluffies) {
    if (o === victim || !o.isAlive || o.scene !== victim.scene || o.currentStateKey === "SLEEPING" || !(o.canSee() || o.canHear())) continue;
    const rel = typeof relationships !== "undefined" && relationships[o.id] ? relationships[o.id][victim.id] : null;
    const family = rel && rel !== "friend";
    changeFear(o, "fire", FIRE_FROM_SEEING + (family ? 0.15 : 0));
  }
}

// Cage.js: a cull - the ones watching from outside the cage
function learnFearOfCages(cage, victims) {
  if (!cage) return;
  const ids = new Set((victims || []).map((v) => v.id));
  for (const o of fluffies) {
    if (!o.isAlive || o.scene !== cage.scene || o.currentCage === cage || o.currentStateKey === "SLEEPING" || !(o.canSee() || o.canHear())) continue;
    const rels = (typeof relationships !== "undefined" && relationships[o.id]) || {};
    const family = [...ids].some((id) => rels[id] && rels[id] !== "friend");
    changeFear(o, "cages", CAGES_FROM_CULL + (family ? 0.2 : 0));
  }
  if (typeof noteCullSeen === "function") noteCullSeen(cage); // (CageLife.js)
}

// A rough bath (hurt while being bathed: Memory.js), or nearly drowning
// (HorsePhysics): afraid of baths and water from then on, until it gets
// over it (comfort, the Brave lesson, gentle baths: Bath.js)
function learnFearOfBaths(f, amount) {
  if (!f || !f.isAlive) return;
  changeFear(f, "bath", amount);
}

// Bath.js scrubFluffy: a new bath for one that's afraid of them
function onBathTime(f) {
  if (!f || fearOf(f, "bath") < FEAR_MIN) return false;
  return startFright(f, "bath");
}

// globals.js handleDropping: put in a cage
function onPutInCage(f, cage) {
  if (!f || !f.isAlive || !cage || !(cage instanceof Cage) || !cage.causesUnhappiness() || (typeof FoalInACan !== "undefined" && cage instanceof FoalInACan)) return false;
  if (fearOf(f, "cages") < FEAR_MIN) return false;
  // it struggles and cries (and doesn't forget who did it)
  const scared = startFright(f, "cages");
  if (scared && typeof changePlayerFear === "function") changePlayerFear(f, 0.02 * fearOf(f, "cages"));
  return scared;
}

// ---- Behaviour: cower or run to mum ----

class FrightDesire extends Desire {
  constructor() {
    super("Fright");
  }
  evaluate(h) {
    if (!isFrightened(h)) return 0;
    if (!h.isAlive || h.isDragging || h.placedOn || h.trickNow) return 0;
    return 75; // over tricks, play and wandering; under running from real dangers
  }
  execute(h) {
    h.expressionOverride = "CRYING_SHOCKED";
    h.expressionOverrideTimer = 1.5;
    const left = Math.max(0.5, h.fright.until - timePlayed);
    const buddy = !h.currentCage && !h.tooYoungToWalk() && _frightComforterSoon(h);
    if (buddy && Math.hypot(buddy.x - h.x, buddy.y - h.y) > 70) {
      if (!h.isMovingOrRunning()) {
        let tx = buddy.x + (h.x < buddy.x ? -45 : 45);
        let ty = buddy.y + 5;
        if (typeof canFluffyReach === "function" && !canFluffyReach(h, tx, ty)) {
          const p = typeof nearestReachablePoint === "function" ? nearestReachablePoint(h, tx, ty) : null;
          if (!p) return this._cower(h, left);
          tx = p.x;
          ty = p.y;
        }
        h.initBehavior("MOVING");
        h.setTargetPosition(tx, ty);
        h.currentStateKey = "RUNNING";
        if (!h._frightRanSaid) {
          h._frightRanSaid = true;
          _fSay(h, buddy instanceof Horse && buddy.id === h.motherId ? "MUM" : "FRIEND");
        }
      }
      return true;
    }
    return this._cower(h, left);
  }
  _cower(h, left) {
    if (h.currentStateKey !== "LYING") {
      h.initBehavior("LYING");
    }
    h.stateTimer = Math.min(left, 3);
    return true;
  }
}

// Horse.draw: shakes while frightened. True if it changed the canvas.
function beginFrightShake(c, f) {
  if (!f.isAlive || !(isFrightened(f) || (f._trembleUntil && f._trembleUntil > timePlayed))) return false; // (a chirpy hearing heavy metal: BodyParts.js)
  c.save();
  c.translate(Math.sin(timePlayed * 55 + f.id) * 1.6, 0);
  return true;
}

// ---- Magnifying glass ----

function _fearWord(v) {
  if (v >= 0.7) return "terrified";
  if (v >= 0.4) return "scared";
  return "a bit";
}

function describeFears(f) {
  const list = realFears(f);
  if (!list.length) return ["Not scared of much", "good"];
  const text = list.map((fe) => `${fe.name[0].toUpperCase()}${fe.name.slice(1)} (${_fearWord(fearOf(f, fe.key))})`).join(", ");
  return [text, list.some((fe) => fearOf(f, fe.key) >= 0.7) ? "bad" : "ok"];
}

function describeFright(f) {
  if (!isFrightened(f)) return null;
  const n = getFear(f.fright.key).name;
  return [`${n[0].toUpperCase()}${n.slice(1)} - cuddle it`, "bad"];
}

// ---- The system ----

function updateFears(dt) {
  const step = fearsTicker.step(dt);
  if (!step) return;
  const now = timePlayed;
  const irons = typeof CauteryIron !== "undefined" ? objects.filter((o) => o instanceof CauteryIron && o.isDragging) : [];
  const heaters = typeof Heater !== "undefined" ? objects.filter((o) => o instanceof Heater && o.heating) : [];
  const cullCages = typeof Cage !== "undefined" ? objects.filter((o) => o instanceof Cage && (o.tag === "cull" || o.isCulling())) : [];
  const bots = typeof objects !== "undefined" && typeof Roomba !== "undefined" ? objects.filter((o) => (o instanceof Roomba && o.on && o.state !== "docked" && !o.isDragging) || (typeof FeedBot !== "undefined" && o instanceof FeedBot && o.state === "driving")) : [];
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    // A fright ends
    if (f.fright) {
      const buddy = frightComforter(f);
      const near = buddy && Math.hypot(buddy.x - f.x, buddy.y - f.y) < 90;
      if (near) f.fright.until -= step; // calms twice as fast
      if (f.fright.until <= now || f.fright.until - now > 120) {
        const key = endFright(f);
        if (near) _fSay(f, "CALMED");
        else if (key === "bot") changeFear(f, "bot", -BOT_FRIGHT_USED); // (it's only the Fluff-Bot: it gets used to it)
        else if (f.adopted) changeFear(f, key, FEAR_WORSEN); // cried it out alone
        continue;
      }
      if (Math.random() < 0.15 && f.currentStateKey !== "SLEEPING") {
        f.expressionOverride = "CRYING_SHOCKED";
        f.expressionOverrideTimer = 1.5;
        if (Math.random() < 0.3) _fSay(f, f.fright.key.toUpperCase());
      }
      continue;
    }
    // Kept in an Enclosure: slowly gets over cages (Enclosure.js)
    // (saved up, as fears are kept to 3 decimal places)
    if (typeof Enclosure !== "undefined" && f.currentCage instanceof Enclosure && fearOf(f, "cages") > 0) {
      f._cageHeal = (f._cageHeal || 0) + (CAGES_ENCLOSURE_HEAL * step) / HOUR_LENGTH;
      if (f._cageHeal >= 0.005) {
        changeFear(f, "cages", -f._cageHeal);
        f._cageHeal = 0;
      }
    }
    if (f.isDragging) continue;
    const awake = f.currentStateKey !== "SLEEPING";
    // The hot iron in your hand, or a heater running
    const fire = fearOf(f, "fire");
    if (fire >= FEAR_MIN && awake) {
      const iron = irons.some((i) => i.scene === f.scene && Math.hypot(i.x - f.x, i.y - f.y) < FIRE_NEAR);
      const heater = heaters.some((h) => h.scene === f.scene && Math.hypot(h.x - f.x, h.y - f.y) < HEATER_NEAR);
      if ((iron && Math.random() < 0.6 * fire * step) || (heater && Math.random() < 0.1 * fire * step)) {
        startFright(f, "fire");
        continue;
      }
    }
    // A cage: set to cull nearby, or in one
    const cages = fearOf(f, "cages");
    if (cages >= FEAR_MIN && awake) {
      const inCage = f.currentCage instanceof Cage && f.currentCage.causesUnhappiness() && !(typeof FoalInACan !== "undefined" && f.currentCage instanceof FoalInACan);
      const cullNear = cullCages.some((c) => c.scene === f.scene && Math.hypot(c.x - f.x, c.y - f.y) < CULL_CAGE_NEAR);
      if ((cullNear && Math.random() < 0.3 * cages * step) || (inCage && Math.random() < 0.01 * cages * step)) {
        startFright(f, "cages");
        continue;
      }
    }
    // The dark
    const dark = fearOf(f, "dark");
    if (dark >= FEAR_MIN && isDarkFor(f)) {
      const asleep = f.currentStateKey === "SLEEPING";
      if (Math.random() < DARK_FRIGHT_CHANCE * dark * step * (asleep ? 0.3 : 1)) startFright(f, "dark");
      else if (asleep) f.changeHappiness((-0.01 * dark * step) / (typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50), "Scared of the dark"); // restless sleep
    }
    // The Fluff-Bot driving about nearby
    const botFear = fearOf(f, "bot");
    if (botFear >= FEAR_MIN && f.currentStateKey !== "SLEEPING") {
      for (const b of bots) {
        if (b.scene !== f.scene || Math.hypot(b.x - f.x, b.y - f.y) >= BOT_NEAR) continue;
        if (Math.random() < 0.02 * botFear * step) startFright(f, "bot");
        else changeFear(f, "bot", -BOT_PASS_USED * step); // (it went by, and nothing happened)
        break;
      }
    }
  }
}
registerSystem("fears", updateFears, 141);
