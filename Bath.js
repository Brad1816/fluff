// ---------------------------------------------------------------------------
// Getting dirty, and bath time.
//
// Dirt (f.dirt, 0..1, saved) - fluffies you own. How they get grubby:
//   - standing in mess (poop, pee, sick, blood - Puddle.js isBodilyWaste):
//     DIRT_FROM_MESS a second, twice that lying or asleep in it
//   - pooping on the floor (not in a litterbox): DIRT_FROM_ACCIDENT, and
//     the runs keep soiling them (HorseToilet)
//   - eating mess off the floor, and bleeding
//   - outside: a little all the time, and rain turns it to mud
//   - and just living: DIRT_PER_DAY, so everyone needs a bath now and then
// Levels (dirtLevel): clean, a bit grubby (0.25+), dirty (0.5+), filthy (0.8+).
//
// What it does:
//   - looks it: a dirty fluffy is drawn browner and darker (beginDirtLook),
//     a filthy one has flies and smell lines (drawDirtEffects)
//   - shows: up to -15 points (dirtShowPenalty); price x1..x0.8
//     (dirtPriceMultiplier, HorseGenetics)
//   - filthy: slowly unhappier, grumbles, and the others say it smells
//
// Bath time: rub the SPONGE on a fluffy (Sponge.js calls spongeFluffy).
// It has to be a real scrub, not a swipe going past: the sponge must rub
// back and forth over the same fluffy (SCRUB_TO_START px of rubbing with at
// least one turn back) before the bath starts (_scrubReady).
// Each rub takes off BATH_SCRUB and makes bubbles. How it takes it depends on
// f.bathLike (-1..1, made the first time, saved; gentle and playful fluffies
// like baths more, grumpy and timid ones less):
//   - likes baths: happy, splashes about, a little affection ("bathed")
//   - hates baths: screams and struggles - a little fear and less happiness
// Every bath gets it a bit more used to them (BATH_GET_USED), so a fluffy
// that hates baths comes round if you keep at it. Once per bath
// (BATH_SESSION seconds) for the reaction; scrubbing keeps cleaning.
//
// Shown in the magnifying glass: Cleanliness (Overview), Bath time (Looks &
// nature).
// ---------------------------------------------------------------------------

const DIRT_FROM_MESS = 0.004; // per second standing in it
const DIRT_FROM_ACCIDENT = 0.006; // pooping on the floor (a third of that for pee); untrained fluffies go a lot
const DIRT_PER_DAY = 0.08; // just living
const DIRT_OUTSIDE_PER_HOUR = 0.01;
const DIRT_MUD_PER_HOUR = 0.12; // out in full rain
const SCRUB_TO_START = 80; // px of rubbing over one fluffy before the bath begins
const BATH_SCRUB = 0.08; // per rub (the sponge rubs 4 times a second)
const BATH_SESSION = 12; // seconds: one reaction per bath
const BATH_GET_USED = 0.08;

const bathTicker = new Ticker(1);

function _bNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}
function _bTrait(f, key) {
  return typeof traitValue === "function" ? traitValue(f, key) : 0;
}
function _bName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Your fluffy";
}

function dirtOf(f) {
  return typeof f.dirt === "number" ? f.dirt : 0;
}

function addDirt(f, amount) {
  if (!f || !f.adopted || !f.isAlive) return;
  f.dirt = Math.max(0, Math.min(1, dirtOf(f) + amount));
}

function dirtLevel(f) {
  const d = dirtOf(f);
  if (d >= 0.8) return "filthy";
  if (d >= 0.5) return "dirty";
  if (d >= 0.25) return "grubby";
  return "clean";
}

// -1 (hates baths) .. 1 (loves them)
function bathLike(f) {
  if (typeof f.bathLike !== "number") {
    let v = Math.random() * 1.4 - 0.7;
    v -= 0.3 * _bTrait(f, "temper"); // gentle +, grumpy -
    v += 0.2 * _bTrait(f, "energy"); // playful like splashing
    v += 0.2 * _bTrait(f, "bravery"); // timid ones are scared of it
    f.bathLike = Math.round(Math.max(-1, Math.min(1, v)) * 100) / 100;
  }
  return f.bathLike;
}

// ---- What it changes ----

function dirtShowPenalty(f) {
  return Math.round(15 * dirtOf(f));
}

function dirtPriceMultiplier(f) {
  return 1 - 0.2 * dirtOf(f);
}

function describeDirt(f) {
  const l = dirtLevel(f);
  if (l === "filthy") return ["Filthy - needs a bath", "bad"];
  if (l === "dirty") return ["Dirty", "ok"];
  if (l === "grubby") return ["A bit grubby", ""];
  return ["Clean", "good"];
}

function describeBathLike(f) {
  const b = bathLike(f);
  if (b >= 0.4) return "Loves bath time";
  if (b >= 0) return "Doesn't mind baths";
  if (b >= -0.4) return "Doesn't like baths";
  return "Hates baths";
}

// ---- Bath time (the sponge) ----

// Sponge.attemptClean: the sponge is over a fluffy. True if it scrubbed one.
function spongeFluffy(sponge) {
  // Only a fluffy of yours that needs it (so the floor and litterbox under a
  // clean one still get the sponge), and not one strapped to a table or box
  const f = fluffies.find(
    (x) =>
      x.isAlive &&
      x.adopted &&
      !x.placedOn &&
      dirtOf(x) > 0.02 &&
      x.scene === sponge.scene &&
      !x.isDragging &&
      x.hitTestAsSeen &&
      x.hitTestAsSeen(sponge.x, sponge.y),
  );
  if (!f) {
    sponge._scrub = null;
    return false;
  }
  if (!_scrubReady(sponge, f)) return false;
  scrubFluffy(f);
  return true;
}

// Has the sponge been rubbed back and forth over this fluffy (not just
// swept past it)? Tracks the rubbing on the sponge itself.
function _scrubReady(sponge, f) {
  let s = sponge._scrub;
  if (!s || s.id !== f.id) {
    sponge._scrub = { id: f.id, x: sponge.x, y: sponge.y, dist: 0, turns: 0, sx: 0, sy: 0, ready: false };
    return false;
  }
  if (s.ready) return true;
  const dx = sponge.x - s.x;
  const dy = sponge.y - s.y;
  s.x = sponge.x;
  s.y = sponge.y;
  s.dist += Math.hypot(dx, dy);
  // A turn back: the rub changes direction (sideways or up and down)
  const sx = Math.abs(dx) > 2 ? Math.sign(dx) : 0;
  const sy = Math.abs(dy) > 2 ? Math.sign(dy) : 0;
  if (sx && s.sx && sx !== s.sx) s.turns++;
  else if (sy && s.sy && sy !== s.sy) s.turns++;
  if (sx) s.sx = sx;
  if (sy) s.sy = sy;
  if (s.dist >= SCRUB_TO_START && s.turns >= 1) s.ready = true;
  return s.ready;
}

function scrubFluffy(f) {
  const before = dirtOf(f);
  f.dirt = Math.max(0, before - BATH_SCRUB);
  if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
    poofs.push(new Poof(f.x + (Math.random() - 0.5) * 50, f.y - 40 - Math.random() * 40, f.scene, "#e8f6ff"));
  }
  const now = _bNow();
  if (f._bathAt !== undefined && now - f._bathAt < BATH_SESSION) {
    if (before > 0 && f.dirt === 0 && !f._bathCleanSaid) {
      f._bathCleanSaid = true;
      if (!f.tooYoungToSpeak()) f.speak(getDialogue(["BATH", "CLEAN"], f), true);
    }
    return "scrub";
  }
  // A new bath: how does it take it?
  f._bathAt = now;
  f._bathCleanSaid = false;
  const like = bathLike(f);
  const talk = !f.tooYoungToSpeak();
  let reaction;
  if (like >= 0) {
    reaction = "happy";
    f.expressionOverride = "GOOD_UPSIES";
    f.expressionOverrideTimer = 2.5;
    f.changeHappiness(0.04 + 0.04 * like);
    if (typeof giveAffection === "function") giveAffection(f, "bathed");
    if (talk) f.speak(getDialogue(["BATH", "LOVE"], f), true);
  } else {
    reaction = "hates";
    f.expressionOverride = "CRYING_SHOCKED";
    f.expressionOverrideTimer = 2.5;
    f.changeHappiness(-0.04 * -like);
    if (typeof changePlayerFear === "function") changePlayerFear(f, 0.02 * -like);
    if (talk) f.speak(getDialogue(["BATH", "HATE"], f), true);
  }
  // Gets used to it
  f.bathLike = Math.min(1, like + BATH_GET_USED);
  return reaction;
}

// ---- Drawing ----

// Horse.draw: browner and darker the dirtier it is. Returns true if it
// changed the canvas (then the caller restores it).
function beginDirtLook(c, f) {
  const d = dirtOf(f);
  if (d < 0.2 || !f.isAlive) return false;
  const k = (d - 0.2) / 0.8; // 0..1
  c.save();
  c.filter = `sepia(${(0.15 + k * 0.45).toFixed(2)}) brightness(${(0.97 - k * 0.3).toFixed(2)}) saturate(${(1 - k * 0.3).toFixed(2)})`;
  return true;
}

// Flies and smell lines over a filthy fluffy
function drawDirtEffects(c, f) {
  if (dirtLevel(f) !== "filthy" || !f.isAlive) return;
  const t = _bNow();
  const top = f.y - 60 - 50 * (f.growth || 1);
  c.save();
  c.strokeStyle = "rgba(120, 140, 60, 0.55)";
  c.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const x0 = f.x - 20 + i * 20;
    const rise = ((t * 25 + i * 17) % 30);
    c.beginPath();
    for (let s = 0; s <= 16; s++) {
      const y = top - rise - s;
      const x = x0 + Math.sin((s + t * 6 + i) * 0.5) * 3;
      if (s === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  c.fillStyle = "rgba(20, 20, 20, 0.85)";
  for (let i = 0; i < 3; i++) {
    const a = t * (2.8 + i * 0.6) + i * 2.1 + f.id;
    c.beginPath();
    c.arc(f.x + Math.cos(a) * (22 + i * 7), f.y - 40 + Math.sin(a * 1.4) * 12, 1.8, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// ---- The system: getting dirty ----

function _inMess(f) {
  if (typeof puddles === "undefined" || typeof isBodilyWaste !== "function") return false;
  const fy = typeof f.getBottomY === "function" ? f.getBottomY() : f.y;
  for (const p of puddles) {
    if (p.scene !== f.scene || !p.points.length || !isBodilyWaste(p.color)) continue;
    for (const pt of p.points) {
      const r = 10 + 150 * (pt.scale || 0);
      if (Math.abs(pt.x - f.x) < r && Math.abs(pt.y - fy) < r * 0.5) return true;
    }
  }
  return false;
}

function updateBath(dt) {
  const step = bathTicker.step(dt);
  if (!step) return;
  const hours = step / (typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50);
  const day = typeof DAY_LENGTH === "number" ? DAY_LENGTH : 1200;
  const now = _bNow();
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted || f.isDragging) continue;
    let add = (DIRT_PER_DAY / day) * step;
    const lying = f.currentStateKey === "SLEEPING" || f.currentStateKey === "LYING";
    if (!f.placedOn && _inMess(f)) add += DIRT_FROM_MESS * step * (lying ? 2 : 1);
    if (f.bleedingTimer > 0) add += 0.01 * step;
    const outdoor = typeof isOutdoorScene === "function" && isOutdoorScene(f.scene);
    if (outdoor) {
      add += DIRT_OUTSIDE_PER_HOUR * hours;
      const rain = typeof rainAmount === "function" ? rainAmount() : 0;
      if (rain > 0 && !f.currentCage) add += DIRT_MUD_PER_HOUR * rain * hours;
    }
    f.dirt = Math.min(1, dirtOf(f) + add);

    if (dirtLevel(f) === "filthy") {
      f.changeHappiness(-0.05 * hours);
      if (f.scene !== currentScene) continue;
      if (typeof f._nextDirtTalk !== "number") f._nextDirtTalk = now + 60 + Math.random() * 120;
      if (now < f._nextDirtTalk) continue;
      f._nextDirtTalk = now + 180 + Math.random() * 240;
      // It grumbles, or someone nearby says it smells
      const other = fluffies.find(
        (o) => o !== f && o.isAlive && o.scene === f.scene && !o.tooYoungToSpeak() && o.currentStateKey !== "SLEEPING" && Math.hypot(o.x - f.x, o.y - f.y) < 250,
      );
      if (other && Math.random() < 0.5) other.speak(getDialogue(["BATH", "SMELLY"], other));
      else if (!f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING") f.speak(getDialogue(["BATH", "FILTHY"], f));
    }
  }
}
registerSystem("bath", updateBath, 139);
