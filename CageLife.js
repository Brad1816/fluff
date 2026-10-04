// ---------------------------------------------------------------------------
// Life through the bars (playtest round).
//
// Behind bars: a fluffy in a cage or an incubator (cagedAway - not a pen:
// Enclosure.js) can't touch, play with or party with anyone outside it
// (the rest of the game checks currentCage for that), but it can still
// talk:
//   - every CAGE_TALK_EVERY seconds a caged fluffy may call to a friend or
//     family member outside nearby (CAGE_TALK_NEAR) and they answer
//     (CAGE_TALK lines; Bonds.js onFluffiesChatted - it keeps the friendship
//     going), and now and then the one outside comes over to the bars
//   - friends and family outside a cull or sell cage they understand say so
//
// Put in a cage with a job (Cage.tag), a fluffy reacts to what it knows
// (f.cageKnow, saved: { cull, sell, breeding } - what it has seen of that
// kind of cage):
//   cull      known (it saw a cull, or it fears cages: Fears.js): terror, a
//             fright; new: puzzled by the glass
//   sell      known (it saw someone sold out of one): pleads to stay; new:
//             hopes for a new family
//   breeding  a mare who's been bred in one: dread; one who wishes for foals:
//             hopeful; a trained stallion knows what it's for
//   plain     sometimes asks why it's in a box
//
// Mess in a cage (playtest 6): a fluffy that goes in a plain cage (not a pen)
// makes a mess IN the cage - cage.mess, 0..1, saved with the cage, drawn as
// stains, carried with it when it's moved - instead of a puddle on the
// floor. It's upset about it (CAGE_MESS_UPSET), and living in a messy cage
// wears on everyone in it (CAGE_MESS_SAD an hour x mess) and dirties them
// slowly (CAGE_MESS_DIRT). With a litterbox in the cage, every accident
// teaches it a little that the box is the place (CAGE_LITTER_LEARN). The
// sponge cleans a cage (Sponge.attemptClean -> cleanCageMess).
//
// Trained studs (f.breedTrain, saved, 0..1): every time you make a stallion
// breed in a breeding cage (the stick, spray or tack: script.js) he learns a
// little (BREED_TRAIN_STEP x how fast he learns, Intelligence.js). Once
// trained (1) he breeds with a mare in a breeding cage by himself
// (updateCageLife, every CAGE_LIFE_EVERY s) - no stick - whenever there's no
// reason he can't (HorseMating.forcedBreedingProblem).
// ---------------------------------------------------------------------------

const CAGE_LIFE_EVERY = 1; // seconds
const CAGE_TALK_EVERY = 8; // seconds between one caged fluffy's calls, at most
const CAGE_TALK_CHANCE = 0.35; // ...each time it could
const CAGE_TALK_NEAR = 280; // px
const CAGE_VISIT_CHANCE = 0.25; // a friend outside comes to the bars
const CAGE_VISIT_FAR = 600; // px: close enough to come over
const CAGE_REPLY_AFTER = 1.5; // seconds before the one outside answers
const BREED_TRAIN_STEP = 0.25; // per time made to breed in a breeding cage
const BREED_AUTO_REST = 20; // seconds after going in before a trained stud starts
const CAGE_MESS_POOP = 0.12; // mess from one poop (a third for a pee)
const CAGE_MESS_UPSET = 0.03;
const CAGE_MESS_SAD = 0.04; // happiness a game hour, at full mess
const CAGE_MESS_DIRT = 0.0006; // dirt a second, at full mess
const CAGE_LITTER_LEARN = 0.03; // potty training per accident with a box in the cage
const cageLifeTicker = new Ticker(CAGE_LIFE_EVERY);

function messyCage(c) {
  return !!c && c instanceof Cage && c.causesUnhappiness() && !(typeof Enclosure !== "undefined" && c instanceof Enclosure) && !(typeof Incubator !== "undefined" && c instanceof Incubator);
}

// HorseToilet.excrete, an accident: in a cage it stays in the cage. True if it did.
function cageMessFrom(f, isPoop, amount = 1) {
  const c = f && f.currentCage;
  if (!messyCage(c)) return false;
  c.mess = Math.min(1, (c.mess || 0) + CAGE_MESS_POOP * (isPoop ? 1 : 0.35) * Math.max(0.3, Math.min(1, amount * 2)) * Math.max(0.3, f.growth));
  f.changeHappiness(-CAGE_MESS_UPSET, "Made a mess in its cage");
  if (!f.tooYoungToSpeak() && Math.random() < 0.5) f.speak(getDialogue(["CAGE_MESS", "SELF"], f));
  // A box right there: it learns
  const box = typeof objects !== "undefined" && objects.some((o) => typeof Litterbox !== "undefined" && o instanceof Litterbox && o.currentCage === c);
  if (box && (f.pottyTraining || 0) < 1) f.pottyTraining = Math.min(1, (f.pottyTraining || 0) + CAGE_LITTER_LEARN * (typeof smartsLearn === "function" ? smartsLearn(f) : 1));
  return true;
}

// Sponge.attemptClean: a sponge over a messy cage
function cleanCageMess(x, y, scene) {
  if (typeof objects === "undefined") return false;
  const c = objects.find((o) => o instanceof Cage && o.scene === scene && (o.mess || 0) > 0 && x >= o.bounds.left && x <= o.bounds.right && y >= o.bounds.top && y <= o.bounds.bottom);
  if (!c) return false;
  c.mess = Math.max(0, c.mess - 0.1);
  return true;
}

// Bath.js: standing in floor mess doesn't count behind bars (it's the cage's)
function cagedFromFloorMess(f) {
  return messyCage(f && f.currentCage);
}

// Behind bars (a cage or an incubator, not a pen)?
function cagedAway(f) {
  return !!(f && f.currentCage && !(typeof Enclosure !== "undefined" && f.currentCage instanceof Enclosure));
}

// Can these two touch, play or party? (the same cage, or neither behind bars)
function cageTogether(a, b) {
  if (!a || !b) return false;
  if (a.currentCage === b.currentCage) return true;
  return !cagedAway(a) && !cagedAway(b);
}

function _clKnow(f) {
  if (!f.cageKnow || typeof f.cageKnow !== "object") f.cageKnow = {};
  return f.cageKnow;
}

function knowsCage(f, tag) {
  if (!f) return false;
  if (tag === "cull" && typeof fearOf === "function" && typeof FEAR_MIN === "number" && fearOf(f, "cages") >= FEAR_MIN) return true;
  return !!(f.cageKnow && f.cageKnow[tag]);
}

// Fears.learnFearOfCages: everyone who saw a cull knows what that glass is
function noteCullSeen(cage) {
  if (!cage) return;
  for (const o of fluffies) {
    if (!o.isAlive || o.scene !== cage.scene || o.currentStateKey === "SLEEPING" || !(o.canSee() || o.canHear())) continue;
    _clKnow(o).cull = true;
  }
}

// Buyers.acceptSellRequest: one sold out of a sell cage - those who saw it go
function noteSoldFromCage(f) {
  if (!f || !f.currentCage || f.currentCage.tag !== "sell") return;
  for (const o of fluffies) {
    if (o === f || !o.isAlive || o.scene !== f.scene || o.currentStateKey === "SLEEPING" || !o.canSee()) continue;
    _clKnow(o).sell = true;
  }
}

// script.js (the stick in a breeding cage), and a trained stud by himself
function noteBredInCage(male, mare, forced) {
  if (male) {
    _clKnow(male).breeding = true;
    if (forced) {
      const learn = typeof smartsLearn === "function" ? smartsLearn(male) : 1;
      const before = male.breedTrain || 0;
      male.breedTrain = Math.min(1, before + BREED_TRAIN_STEP * learn);
      if (before < 1 && male.breedTrain >= 1 && male.adopted && typeof addUIMessage === "function")
        addUIMessage(`${fluffyDisplayName(male)} is a trained stud now: in a breeding cage he'll breed without the stick.`);
    }
  }
  if (mare) _clKnow(mare).breeding = true;
}

// Magnifying glass
function describeStud(f) {
  if (!f || f.gender !== "male" || !(f.breedTrain > 0)) return null;
  return isTrainedStud(f) ? ["Trained: breeds in a breeding cage by himself", "ok"] : [`Being trained to breed in a cage (${Math.round(f.breedTrain * 100)}%)`, ""];
}

function isTrainedStud(f) {
  return !!f && f.gender === "male" && (f.breedTrain || 0) >= 1;
}

function _clSay(f, keys, target, force = false) {
  if (typeof sayIfAwake === "function") return sayIfAwake(f, keys, target, force);
  return false;
}

// Just put in (or moved to) a cage with a job: how it takes it
function reactToCage(f, cage) {
  if (!f || !f.isAlive || !cage || f.tooYoungToSpeak()) return;
  const tag = cage.tag || "none";
  if (tag === "cull") {
    if (knowsCage(f, "cull")) {
      _clSay(f, ["CAGE_REACT", "CULL", "KNOWN"], null, true);
      // (knowing what that glass does is enough to fear it)
      if (typeof fearOf === "function" && typeof changeFear === "function" && fearOf(f, "cages") < FEAR_MIN) changeFear(f, "cages", FEAR_MIN + 0.05);
      if (typeof startFright === "function") startFright(f, "cages");
      f.changeHappiness(-0.08, "Put in the culling cage");
    } else _clSay(f, ["CAGE_REACT", "CULL", "NEW"]);
  } else if (tag === "sell") {
    if (knowsCage(f, "sell")) {
      _clSay(f, ["CAGE_REACT", "SELL", "KNOWN"], null, true);
      f.changeHappiness(-0.05, "Put in the selling cage");
    } else _clSay(f, ["CAGE_REACT", "SELL", "NEW"]);
  } else if (tag === "breeding") {
    if (f.gender === "male") {
      if (knowsCage(f, "breeding")) _clSay(f, ["CAGE_REACT", "BREEDING", "STALLION"]);
    } else if (f.growth >= 1) {
      if (f.wish && f.wish.id === "foal") _clSay(f, ["CAGE_REACT", "BREEDING", "HOPEFUL"]);
      else if (knowsCage(f, "breeding")) {
        _clSay(f, ["CAGE_REACT", "BREEDING", "DREAD"], null, true);
        f.changeHappiness(-0.04, "Put in the breeding cage again");
      }
    }
  } else if (tag === "none" && cage.causesUnhappiness() && Math.random() < 0.4) {
    _clSay(f, ["CAGE_REACT", "PLAIN"]);
  }
}

// Friends and family across the bars (one direction)
function _clRelKey(from, to) {
  const rel = (typeof relationships !== "undefined" && relationships[from.id] && relationships[from.id][to.id]) || null;
  if (rel === "mother") return "MUM";
  if (rel === "baby_child" || rel === "child") return "BABY";
  if (rel === "father" || rel === "brother" || rel === "sister") return "FAMILY";
  if (rel === "special_friend") return "SPECIAL";
  if (rel === "friend" || (typeof getLiking === "function" && getLiking(from, to) >= 0.45)) return "FRIEND";
  return null;
}

function _clAwake(f) {
  return f.isAlive && f.currentStateKey !== "SLEEPING" && !f.isDragging && !f.placedOn;
}

function _clTalk(inside, now) {
  if (!_clAwake(inside) || inside.tooYoungToSpeak() || (inside.speech && inside.speech.text)) return;
  if (inside._cageTalkAt !== undefined && now - inside._cageTalkAt >= 0 && now - inside._cageTalkAt < CAGE_TALK_EVERY) return;
  if (Math.random() >= CAGE_TALK_CHANCE) return;
  let best = null;
  let bd = Infinity;
  for (const o of fluffies) {
    if (o === inside || o.scene !== inside.scene || o.currentCage === inside.currentCage || !_clAwake(o)) continue;
    if (!_clRelKey(inside, o) && !_clRelKey(o, inside)) continue;
    const d = Math.hypot(o.x - inside.x, o.y - inside.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  if (!best) return;
  inside._cageTalkAt = now;
  if (bd > CAGE_TALK_NEAR) {
    // Too far to chat: it may come over to the bars
    if (bd < CAGE_VISIT_FAR && !best.currentCage && !best.isMovingOrRunning() && Math.random() < CAGE_VISIT_CHANCE && typeof best.setTargetPosition === "function") {
      const b = inside.currentCage.bounds;
      const side = best.x < (b.left + b.right) / 2 ? b.left - 35 : b.right + 35;
      best.initBehavior("MOVING");
      best.setTargetPosition(side, b.bottom - 20);
      _clSay(best, ["CAGE_TALK", "COMING"], inside);
    }
    return;
  }
  const inKey = _clRelKey(inside, best) || "FRIEND";
  _clSay(inside, ["CAGE_TALK", "INSIDE", inKey], best, true);
  // ...and the answer (what kind of cage it can see it's in)
  const tag = inside.currentCage.tag;
  const outKey = _clRelKey(best, inside) || "FRIEND";
  if (typeof onFluffiesChatted === "function") onFluffiesChatted(inside, best);
  if (best.tooYoungToSpeak()) return;
  const key = (tag === "cull" || tag === "sell") && knowsCage(best, tag) ? (tag === "cull" ? "CULL" : "SELL") : outKey;
  best._cageReply = { id: inside.id, at: now + CAGE_REPLY_AFTER, key };
}

// A trained stud in a breeding cage with a mare: by himself
function _clStud(f, now) {
  if (!isTrainedStud(f) || !f.currentCage || f.currentCage.tag !== "breeding" || !_clAwake(f) || f.growth < 1) return;
  if (f.matingState && f.matingState.isMating) return;
  if (!(f._cageInAt !== undefined && now - f._cageInAt >= BREED_AUTO_REST)) return;
  const mares = fluffies.filter((m) => m.gender === "female" && m.growth >= 1 && m.isAlive && m.currentCage === f.currentCage);
  const mare = mares.find((m) => !forcedBreedingProblem(f, m));
  if (!mare) return;
  if (f.mateWith(mare, true, true)) {
    noteBredInCage(f, mare, false);
    _clSay(f, ["CAGE_REACT", "BREEDING", "STALLION"]);
  }
}

function updateCageLife(dt) {
  if (!cageLifeTicker.step(dt) || typeof fluffies === "undefined") return;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    // An answer through the bars
    const r = f._cageReply;
    if (r && now >= r.at) {
      f._cageReply = null;
      const to = fluffyById(r.id);
      if (to && to.isAlive && to.scene === f.scene && now - r.at < 10) _clSay(f, ["CAGE_TALK", "OUTSIDE", r.key], to, true);
    }
    const cage = f.currentCage || null;
    const id = cage ? cage.id : null;
    if (f._cageIn !== id) {
      const first = f._cageIn === undefined;
      f._cageIn = id;
      f._cageInAt = now;
      if (cage && !first && cage instanceof Cage) reactToCage(f, cage);
    }
    if (!cagedAway(f)) continue;
    _clTalk(f, now);
    _clStud(f, now);
    // Living in its mess
    const mess = cage && messyCage(cage) ? cage.mess || 0 : 0;
    if (mess > 0.15) {
      f.changeHappiness(-(CAGE_MESS_SAD * mess * CAGE_LIFE_EVERY) / HOUR_LENGTH, "A filthy cage");
      if (typeof addDirt === "function") addDirt(f, CAGE_MESS_DIRT * mess * CAGE_LIFE_EVERY);
      if (mess > 0.4 && !f.tooYoungToSpeak() && Math.random() < 0.004 && (!f.speech || !f.speech.text)) f.speak(getDialogue(["CAGE_MESS", "DIRTY"], f));
    }
  }
}
registerSystem("cageLife", updateCageLife, 66);
