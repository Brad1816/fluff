// ---------------------------------------------------------------------------
// Stray dogs, in daylight (from the stories: "Street life sucks", "Cruelty").
//
// Once a game hour in the day (DOG_HOURS) there's a DOG_CHANCE that a stray
// dog runs into the alley or the park - wherever fluffies are. You see it
// (it's drawn like the fox: StrayDog.draw):
//   - it picks the weakest fluffy it can see (foals first) and runs it down
//     (DOG_SPEED: faster than a fluffy, and fluffies tire - Stamina.js)
//   - everyone near it scatters (DOG lines). A mum with foals still on milk
//     grabs ONE in her mouth - her bestest babbeh if she has one
//     (Favourites.js), else the nearest - and runs with it; the rest are
//     left behind, peeping for her
//   - a bite (DOG_BITE health): a small foal doesn't survive one; it may go
//     after one more (DOG_MAX_BITES) before it trots off, or gives up after
//     DOG_GIVE_UP seconds
//   - click it to chase it off (your fluffies there trust you a little more)
// It's reported in the morning (DayReport news). The off-screen dog that
// takes fluffies left outside at night is something else (script.js).
// ---------------------------------------------------------------------------

const DOG_CHANCE = 0.06; // a game hour, in the day, when there are fluffies about
const DOG_HOURS = [8, 19];
const DOG_SPEED = 200;
const DOG_SCARE = 320; // px: fluffies this close run
const DOG_BITE = [35, 70];
const DOG_MAX_BITES = 2;
const DOG_GIVE_UP = 40; // seconds
const DOG_CARRY_TIME = 12; // seconds a mum carries her foal off
let strayDogs = [];
let _dogHourAt = null;

function _dogScenes() {
  const out = [];
  for (const id in SCENES) {
    const cfg = SCENES[id];
    if (!cfg || (!cfg.isAlley && id !== "PARK")) continue;
    if (fluffies.some((f) => f.isAlive && f.scene === id)) out.push(id);
  }
  return out;
}

function _dogW(scene) {
  return typeof sceneW === "function" ? sceneW(scene) : width;
}

class StrayDog {
  constructor(scene) {
    this.scene = scene;
    const left = Math.random() < 0.5;
    this.x = left ? 20 : _dogW(scene) - 20;
    const top = typeof sceneTop === "function" ? sceneTop(scene) : 120;
    const bottom = typeof sceneH === "function" ? sceneH(scene) : height;
    this.y = top + 60 + Math.random() * Math.max(40, bottom - top - 120);
    this.facingRight = left;
    this.state = "hunt"; // hunt -> leave
    this.age = 0;
    this.bites = 0;
    this.biteRest = 0;
    this.step = 0;
    this.targetId = null;
    this.alerted = new Set();
    this.done = false;
    this.victims = [];
  }

  target() {
    const f = this.targetId !== null ? fluffyById(this.targetId) : null;
    if (f && f.isAlive && f.scene === this.scene && !f.isDragging && !f.currentCage) return f;
    // The weakest it can see: foals first, then the hurt
    let best = null;
    let bs = -Infinity;
    for (const o of fluffies) {
      if (!o.isAlive || o.scene !== this.scene || o.isDragging || o.currentCage || o.placedOn) continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (d > 900) continue;
      const s = (1 - Math.min(1, o.growth)) * 3 + (1 - (o.health ?? 100) / 100) - d / 600;
      if (s > bs) {
        bs = s;
        best = o;
      }
    }
    this.targetId = best ? best.id : null;
    return best;
  }

  update(dt) {
    this.age += dt;
    if (this.biteRest > 0) this.biteRest -= dt;
    if (this.state === "leave") {
      const tx = this.facingRight ? _dogW(this.scene) + 60 : -60;
      this._moveTo(tx, this.y, DOG_SPEED * 0.8, dt);
      if (this.x < -40 || this.x > _dogW(this.scene) + 40) this.done = true;
      return;
    }
    if (this.age > DOG_GIVE_UP) return this.leave();
    const v = this.target();
    if (!v) return this.leave();
    this._alarm();
    if (Math.hypot(v.x - this.x, v.y - this.y) > 30) {
      this._moveTo(v.x, v.y + 6, DOG_SPEED, dt);
      return;
    }
    if (this.biteRest > 0) return;
    this._bite(v);
  }

  _moveTo(tx, ty, speed, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const s = Math.min(d, speed * dt);
    this.x += (dx / d) * s;
    this.y += (dy / d) * s;
    this.facingRight = dx > 0;
    this.step += s * 0.09;
  }

  // Everyone close by runs; a mum grabs one foal
  _alarm() {
    for (const f of fluffies) {
      if (!f.isAlive || f.scene !== this.scene || this.alerted.has(f.id) || f.isDragging || f.currentCage) continue;
      if (Math.hypot(f.x - this.x, f.y - this.y) > DOG_SCARE) continue;
      this.alerted.add(f.id);
      if (f.currentStateKey === "SLEEPING") f.initBehavior("IDLE");
      if (f.tooYoungToWalk()) {
        f.expressionOverride = "CRYING_SHOCKED";
        f.expressionOverrideTimer = 4;
        continue;
      }
      f.actionHandler.executeRunawayFear(this, ["DOG", f.tooYoungToSpeak() ? "CHIRPY" : "FLEE"]);
      if (f.gender === "female" && f.growth >= 1 && typeof litterOf === "function") {
        const litter = litterOf(f).filter((k) => k.isAlive && k.scene === f.scene && !k.isDragging && !k.currentCage && !k._dogCarry);
        if (!litter.length) continue;
        const best = (typeof bestestOf === "function" && bestestOf(f)) || litter.sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
        if (!best || !litter.includes(best)) continue;
        best._dogCarry = { mumId: f.id, until: timePlayed + DOG_CARRY_TIME };
        if (best._riding) best._riding = null;
        if (!f.tooYoungToSpeak()) f.speak(getDialogue(["DOG", "GRAB"], f, best), true);
        for (const k of litter) {
          if (k === best) continue;
          k.expressionOverride = "CRYING_SHOCKED";
          k.expressionOverrideTimer = 5;
          k.speak(getDialogue(["DOG", "LEFT_BEHIND", k.tooYoungToSpeak() ? "CHIRPY" : "DEFAULT"], k), true, k.tooYoungToSpeak());
          k.changeHappiness(-0.06, "Left behind when a dog came");
        }
      }
    }
  }

  _bite(v) {
    this.bites++;
    this.biteRest = 1.5;
    this.victims.push(v.id);
    const dmg = DOG_BITE[0] + Math.random() * (DOG_BITE[1] - DOG_BITE[0]);
    if (v._dogCarry) v._dogCarry = null;
    v.expressionOverride = "CRYING_SHOCKED";
    v.expressionOverrideTimer = 3;
    if (typeof addPointToPuddle === "function") addPointToPuddle(v.scene, v.x, v.y + 20, "#8a0303", 0.06, 0.04);
    if (v.growth < 0.5) v.anatomy.die(null, "Killed by a dog");
    else {
      v.health = Math.max(0, (v.health ?? 100) - dmg);
      if (v.health <= 0) v.anatomy.die(null, "Killed by a dog");
      else {
        v.bleedingTimer = Math.max(v.bleedingTimer || 0, 5);
        if (!v.tooYoungToSpeak()) v.speak(getDialogue(["DOG", "BITTEN"], v), true);
        if (typeof scaredyMess === "function") scaredyMess(v, 0.8);
        if (typeof addScar === "function" && Math.random() < 0.5) addScar(v, "flank", `bitten by a stray dog on day ${getDayNumber()}`);
        v.actionHandler.executeRunawayFear(this, ["DOG", "FLEE"]);
      }
    }
    for (const f of fluffies) {
      if (f === v || !f.isAlive || f.scene !== v.scene || Math.hypot(f.x - v.x, f.y - v.y) > 400) continue;
      f.changeHappiness(-0.03, "Saw a dog attack");
      if (typeof f.setShock === "function") f.setShock(2);
    }
    this.targetId = null;
    if (this.bites >= DOG_MAX_BITES || Math.random() < 0.5) this.leave();
  }

  leave() {
    if (this.state === "leave") return;
    this.state = "leave";
    this.facingRight = this.x > _dogW(this.scene) / 2;
    this._report(false);
  }

  _report(chased) {
    if (this.reported) return;
    this.reported = true;
    const hurt = this.victims.map((id) => fluffyById(id)).filter(Boolean);
    const dead = hurt.filter((f) => !f.isAlive);
    const where = this.scene === "PARK" ? "the park" : "the alley";
    let text;
    if (chased) text = `You chased a stray dog out of ${where}${hurt.length ? ` - but not before it bit ${fluffyDisplayName(hurt[0])}` : ""}.`;
    else if (dead.length) text = `A stray dog ran through ${where} and killed ${dead.map((f) => fluffyDisplayName(f)).join(" and ")}.`;
    else if (hurt.length) text = `A stray dog ran through ${where} and bit ${hurt.map((f) => fluffyDisplayName(f)).join(" and ")}.`;
    else text = `A stray dog ran through ${where}. Everyone got away.`;
    if (typeof noteDayEvent === "function") noteDayEvent("news", { text });
    const mine = hurt.some((f) => f.adopted);
    if ((mine || currentScene === this.scene) && typeof addUIMessage === "function") addUIMessage(text);
  }

  scareOff() {
    if (this.state === "leave") return false;
    for (const f of fluffies) {
      if (!f.isAlive || f.scene !== this.scene || Math.hypot(f.x - this.x, f.y - this.y) > 400 || !f.adopted) continue;
      if (typeof f.playerTrust === "number") f.playerTrust = Math.min(1, f.playerTrust + 0.05);
    }
    this.state = "hunt";
    this._report(true);
    this.state = "leave";
    this.facingRight = this.x > _dogW(this.scene) / 2;
    return true;
  }

  hitTest(x, y) {
    return Math.abs(x - this.x) < 50 && y > this.y - 50 && y < this.y + 20;
  }

  draw(c) {
    const dir = this.facingRight ? 1 : -1;
    const run = Math.sin(this.step) * 8;
    c.save();
    c.translate(this.x, this.y);
    c.scale(dir, 1);
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.beginPath();
    c.ellipse(0, 14, 42, 8, 0, 0, Math.PI * 2);
    c.fill();
    // Tail
    c.strokeStyle = "#5b3b22";
    c.lineWidth = 6;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-34, -22);
    c.quadraticCurveTo(-50, -38 + run * 0.5, -46, -48);
    c.stroke();
    // Legs
    c.strokeStyle = "#3b2414";
    c.lineWidth = 7;
    for (const [lx, sw] of [[-22, run], [-10, -run], [14, -run], [26, run]]) {
      c.beginPath();
      c.moveTo(lx, -10);
      c.lineTo(lx + sw, 12);
      c.stroke();
    }
    // Body
    c.fillStyle = "#6e4a2e";
    c.beginPath();
    c.ellipse(0, -20, 38, 16, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#8a6242";
    c.beginPath();
    c.ellipse(6, -12, 20, 7, 0, 0, Math.PI * 2);
    c.fill();
    // Head and snout
    c.fillStyle = "#6e4a2e";
    c.beginPath();
    c.arc(36, -32, 14, 0, Math.PI * 2);
    c.fill();
    c.fillRect(40, -34, 22, 12);
    // Ear
    c.fillStyle = "#3b2414";
    c.beginPath();
    c.ellipse(30, -42, 6, 11, 0.4, 0, Math.PI * 2);
    c.fill();
    // Eye, nose, teeth
    c.fillStyle = "#111";
    c.beginPath();
    c.arc(40, -36, 2.2, 0, Math.PI * 2);
    c.arc(62, -30, 3, 0, Math.PI * 2);
    c.fill();
    if (this.state === "hunt") {
      c.fillStyle = "#fff";
      c.fillRect(50, -23, 3, 4);
      c.fillRect(56, -23, 3, 4);
    }
    c.restore();
  }
}

function spawnStrayDog(scene) {
  const d = new StrayDog(scene);
  strayDogs.push(d);
  return d;
}

// Mums running with a foal in their mouth
function _dogCarries() {
  const now = timePlayed;
  for (const k of fluffies) {
    const c = k._dogCarry;
    if (!c) continue;
    const mum = fluffyById(c.mumId);
    if (!k.isAlive || !mum || !mum.isAlive || mum.scene !== k.scene || mum.isDragging || k.isDragging || now > c.until || now < c.until - DOG_CARRY_TIME - 1) {
      k._dogCarry = null;
      continue;
    }
    const dir = mum.facingRight ? 1 : -1;
    k.x = mum.x + dir * 34 * (mum.scale || 1) * 2;
    k.y = mum.y - 4;
    k.facingRight = mum.facingRight;
    if (k.isMovingOrRunning()) k.initBehavior("IDLE");
    k.targetX = k.x;
    k.targetY = k.y;
  }
}

function updateStrayDogs(dt) {
  if (typeof fluffies === "undefined") return;
  for (const d of strayDogs) d.update(dt);
  if (strayDogs.some((d) => d.done)) strayDogs = strayDogs.filter((d) => !d.done);
  _dogCarries();
  // Once a game hour, in daylight: maybe a dog
  const hourIndex = Math.floor((typeof timePlayed === "number" ? timePlayed : 0) / HOUR_LENGTH);
  if (_dogHourAt === hourIndex) return;
  const first = _dogHourAt === null;
  _dogHourAt = hourIndex;
  if (first || strayDogs.length) return;
  const h = typeof gameHour === "function" ? gameHour() : 12;
  if (h < DOG_HOURS[0] || h >= DOG_HOURS[1]) return;
  if (Math.random() >= DOG_CHANCE) return;
  const scenes = _dogScenes();
  if (!scenes.length) return;
  spawnStrayDog(scenes[Math.floor(Math.random() * scenes.length)]);
}
registerSystem("strayDogs", updateStrayDogs, 112);

// script.js render (inside the park camera when there is one)
function drawStrayDogs(c) {
  for (const d of strayDogs) if (d.scene === currentScene) d.draw(c);
}

// UI.js mouse down (world positions)
function handleStrayDogClick() {
  for (const d of strayDogs) {
    if (d.scene === currentScene && d.state !== "leave" && d.hitTest(mouse.x, mouse.y)) return d.scareOff();
  }
  return false;
}

function resetStrayDogs() {
  strayDogs = [];
}
