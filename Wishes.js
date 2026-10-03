// ---------------------------------------------------------------------------
// Wishes (design doc Phase 2): each of your fluffies wishes for one thing at
// a time, changing with its age and life.
//
//   Foals      a name, to learn a trick, a toy of its own, to stay with mum
//   Adults     a special friend, foals of its own, to see the park, a hat
//              like a friend's, a friend
//   Old ones   to see its daughter again, a warm bed, a last trip outside
// (WISHES: when it can have it, what it says, when it's come true.)
//
// Granted: a happy line in its story, a turning point, WISH_JOY happiness
//   and contentment for WISH_CONTENT_DAYS (its happiness settles higher,
//   wishHappinessTarget in Horse.update).
// Ignored: after WISH_PATIENCE_DAYS it aches - a little less happy each game
//   hour (up to WISH_ACHE_MAX for the wish) and it mentions it more; after
//   WISH_GIVE_UP_DAYS it gives up (a story line).
// Denied on purpose - you sell or give up the friend or daughter it wished
//   for, sell its mum away, or take away the hat it just got: remembered as
//   a harsh act (Memory.js "wish_denied"), trust and happiness drop, and its
//   story says what you did.
// Harsh use: "Promise wish" in the right-click menu dangles it - for
//   WISH_PROMISE_DAYS it tries harder at tricks and lessons
//   (WISH_PROMISE_BOOST), but if the wish hasn't come true by then the
//   promise is broken: remembered, trusted less, and it aches twice as
//   much. Keep the promise and it trusts you more.
// Shown in the magnifying glass (Mind tab, "Wishes for") and the Household
// screen. Goals: grant a wish, grant five (Goals.js).
// Saved on the fluffy: f.wish, f.wishCooldownUntil, f.contentUntil,
// f.seenPark, f.hatWishGrantedAt.
// ---------------------------------------------------------------------------

const WISH_PATIENCE_DAYS = 3;
const WISH_GIVE_UP_DAYS = 8;
const WISH_ACHE_PER_HOUR = 0.01;
const WISH_ACHE_MAX = 0.3;
const WISH_JOY = 0.2;
const WISH_CONTENT_DAYS = 3;
const WISH_CONTENT_TARGET = 0.1; // how much higher its happiness settles
const WISH_COOLDOWN_DAYS = 1;
const WISH_PROMISE_DAYS = 1.5;
const WISH_PROMISE_BOOST = 1.3;
const WISH_SAY_CHANCE = 0.03; // per wishing fluffy per 30s check

const wishTicker = new Ticker(2);
const wishTalkTicker = new Ticker(30);

function _wById(id) {
  return typeof fluffies !== "undefined" ? fluffyById(id) || null : null;
}
function _wP(f) {
  return f.gender === "male" ? { sub: "he", obj: "him", poss: "his", Sub: "He", Poss: "His" } : { sub: "she", obj: "her", poss: "her", Sub: "She", Poss: "Her" };
}
function _wStage(f) {
  return typeof lifeStage === "function" ? lifeStage(f) : f.growth < 1 ? "foal" : "adult";
}
function _wYoung(f) {
  return f.growth < 1 || (typeof ageDays === "function" && ageDays(f) < DAYS_PER_YEAR);
}
function _wKnownTricks(f) {
  return typeof knownTricks === "function" ? knownTricks(f).length : 0;
}
function _wRel(f, type) {
  const rels = typeof relationships !== "undefined" ? relationships[f.id] || {} : {};
  return Object.keys(rels).filter((id) => rels[id] === type).map(Number);
}
function _wHat(f) {
  return !!(f.accessories && f.accessories.head);
}
function _wDaughters(f) {
  if (typeof getFamilyChildren !== "function") return [];
  return getFamilyChildren(f.id).filter((r) => r.gender === "female" && (r.growth === undefined || r.growth >= 1) && r.status !== "dead");
}

// id: { when(f), text(f, w), start?(f, w), done?(f, w), line(f, w) }
const WISHES = {
  name: {
    when: (f) => !f.tooYoungToSpeak() && !(typeof fluffyNames !== "undefined" && fluffyNames[f.id]),
    text: () => "A name of its own",
    done: (f) => typeof fluffyNames !== "undefined" && !!fluffyNames[f.id],
    line: (f, p) => `${p.Poss} wish came true: ${p.sub} got a name.`,
    say: "NAME",
  },
  trick: {
    when: (f) => _wYoung(f) && !f.tooYoungToWalk() && !(f.isSmarty && f.isSmarty()),
    start: (f, w) => (w.n = _wKnownTricks(f)),
    text: () => "To learn a trick",
    done: (f, w) => _wKnownTricks(f) > (w.n || 0),
    line: (f, p) => `${p.Poss} wish came true: ${p.sub} learnt a trick.`,
    say: "TRICK",
  },
  toy: {
    when: (f) => _wYoung(f) && !f.tooYoungToWalk(),
    text: () => "A toy of its own",
    line: (f, p) => `${p.Poss} wish came true: a toy of ${p.poss} own.`,
    say: "TOY",
  },
  stayWithMum: {
    when: (f) => f.growth < 1 && f.growth > 0.2 && !!_wById(f.motherId) && _wById(f.motherId).adopted && _wById(f.motherId).isAlive,
    start: (f, w) => (w.target = f.motherId),
    text: () => "To stay with its mum",
    done: (f, w) => f.growth >= 1 && !!_wById(w.target) && _wById(w.target).isAlive,
    line: (f, p) => `${p.Poss} wish came true: ${p.sub} grew up with ${p.poss} mum by ${p.poss} side.`,
    say: "MUM",
  },
  specialFriend: {
    when: (f) => f.growth >= 1 && _wStage(f) !== "elderly" && !_wRel(f, "special_friend").length,
    start: (f, w) => {
      // The one it likes most, if anyone
      let best = null;
      for (const o of fluffies) {
        if (o === f || !o.isAlive || !o.adopted || o.growth < 1) continue;
        if (typeof haveMet === "function" && !haveMet(f, o)) continue; // (one it knows)
        if (typeof isSexuallyAttractedTo === "function" && !isSexuallyAttractedTo(f, o)) continue;
        const l = typeof getLiking === "function" ? getLiking(f, o) : 0;
        if (l > 0.1 && (!best || l > best.l)) best = { id: o.id, l };
      }
      w.target = best ? best.id : null;
    },
    text: (f, w) => (w.target !== null && w.target !== undefined ? `A special friend (it has its eye on ${fluffyDisplayName(_wById(w.target) || { id: w.target })})` : "A special friend"),
    done: (f) => _wRel(f, "special_friend").length > 0,
    line: (f, p) => `${p.Poss} wish came true: ${p.sub} found a special friend.`,
    say: "SPECIAL_FRIEND",
  },
  foal: {
    when: (f) => f.growth >= 1 && _wStage(f) === "adult" && !(f.gender === "female" && f.spayed) && !f.isPregnant,
    text: () => "Foals of its own",
    line: (f, p) => `${p.Poss} wish came true: foals of ${p.poss} own.`,
    say: "FOAL",
  },
  park: {
    when: (f) => f.growth >= 1 && !f.seenPark && _wStage(f) !== "elderly",
    text: () => "To see the park",
    done: (f) => !!f.seenPark,
    line: (f, p) => `${p.Poss} wish came true: ${p.sub} saw the park.`,
    say: "PARK",
  },
  hat: {
    when: (f) =>
      f.growth >= 1 &&
      !_wHat(f) &&
      fluffies.some((o) => o !== f && o.isAlive && o.scene === f.scene && _wHat(o) && (typeof getLiking !== "function" || getLiking(f, o) >= 0)),
    start: (f, w) => {
      const o = fluffies.find((x) => x !== f && x.isAlive && x.scene === f.scene && _wHat(x));
      w.target = o ? o.id : null;
    },
    text: (f, w) => (w.target !== null && w.target !== undefined ? `A hat like ${fluffyDisplayName(_wById(w.target) || { id: w.target })}'s` : "A hat"),
    done: (f) => _wHat(f),
    line: (f, p) => `${p.Poss} wish came true: a hat of ${p.poss} own.`,
    say: "HAT",
  },
  friend: {
    when: (f) => !f.tooYoungToSpeak() && !_wRel(f, "friend").length && !_wRel(f, "special_friend").length,
    text: () => "A friend",
    done: (f) => _wRel(f, "friend").length > 0 || _wRel(f, "special_friend").length > 0,
    line: (f, p) => `${p.Poss} wish came true: ${p.sub} made a friend.`,
    say: "FRIEND",
  },
  seeDaughter: {
    when: (f) => ["senior", "elderly"].includes(_wStage(f)) && _wDaughters(f).some((r) => { const d = _wById(r.id); return !d || d.scene !== f.scene; }),
    start: (f, w) => {
      const r = _wDaughters(f).find((x) => { const d = _wById(x.id); return !d || d.scene !== f.scene; });
      w.target = r ? r.id : null;
    },
    text: (f, w) => `To see ${_wP(f).poss} daughter ${typeof fluffyDisplayNameById === "function" ? fluffyDisplayNameById(w.target, "") : ""} again`.replace(/\s+again/, " again"),
    done: (f, w) => {
      const d = _wById(w.target);
      return !!d && d.isAlive && d.scene === f.scene;
    },
    line: (f, p, w) => `${p.Poss} wish came true: ${p.sub} saw ${p.poss} daughter ${typeof fluffyDisplayNameById === "function" ? fluffyDisplayNameById(w.target, "") : ""} again.`.replace(/\s+again/, " again"),
    say: "DAUGHTER",
  },
  warmBed: {
    when: (f) => ["senior", "elderly"].includes(_wStage(f)),
    text: () => "A warm bed",
    done: (f) => !!f.claimedBed && f.currentStateKey === "SLEEPING",
    line: (f, p) => `${p.Poss} wish came true: a warm bed for ${p.poss} old bones.`,
    say: "BED",
  },
  lastTrip: {
    when: (f) => _wStage(f) === "elderly" && !["BACKYARD", "PARK"].includes(f.scene),
    text: () => "A last trip outside",
    done: (f) => f.scene === "BACKYARD" || f.scene === "PARK",
    line: (f, p) => `${p.Poss} wish came true: one more trip outside.`,
    say: "OUTSIDE",
  },
};

// ---- Having a wish ----

function pickWish(f) {
  const options = Object.keys(WISHES).filter((k) => {
    try {
      return WISHES[k].when(f);
    } catch (e) {
      return false;
    }
  });
  if (!options.length) return null;
  // A name comes first
  const id = options.includes("name") && Math.random() < 0.7 ? "name" : options[Math.floor(Math.random() * options.length)];
  const w = { id, since: timePlayed, ache: 0 };
  if (WISHES[id].start) WISHES[id].start(f, w);
  f.wish = w;
  return w;
}

function wishText(f) {
  if (!f || !f.wish || !WISHES[f.wish.id]) return null;
  return WISHES[f.wish.id].text(f, f.wish);
}

function _wDays(w) {
  return (timePlayed - w.since) / DAY_LENGTH;
}

function grantWish(f) {
  const w = f.wish;
  if (!w || !WISHES[w.id]) return false;
  const p = _wP(f);
  const line = WISHES[w.id].line(f, p, w);
  f.wish = null;
  f.wishCooldownUntil = timePlayed + WISH_COOLDOWN_DAYS * DAY_LENGTH;
  f.contentUntil = timePlayed + WISH_CONTENT_DAYS * DAY_LENGTH;
  f.changeHappiness(WISH_JOY, "Wish came true");
  if (w.promisedAt !== undefined && typeof changePlayerTrust === "function") changePlayerTrust(f, 0.05); // a promise kept
  if (typeof recordStory === "function") recordStory("wish_granted", f, { x: line });
  if (typeof noteTurningPoint === "function") noteTurningPoint(f, `${fluffyDisplayName(f)}'s wish came true!`, { record: false });
  if (typeof noteGoalEvent === "function") noteGoalEvent("wish");
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["WISH_GRANTED"], f), true);
  return true;
}

// You took away what it wished for: a harsh act
function denyWish(f, why) {
  const w = f.wish;
  if (!w) return false;
  f.wish = null;
  f.wishCooldownUntil = timePlayed + 2 * WISH_COOLDOWN_DAYS * DAY_LENGTH;
  f.changeHappiness(-0.15, "Wish taken away");
  if (typeof rememberPlayerEvent === "function") rememberPlayerEvent(f, "wish_denied");
  if (typeof changePlayerTrust === "function") changePlayerTrust(f, -0.1);
  if (typeof recordStory === "function") recordStory("wish_denied", f, { x: why });
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["WISH_DENIED"], f), true);
  return true;
}

// ---- Events from the rest of the game ----

// kind: "toy" | "played" | "foal" (a litter) | "left" (a fluffy left you:
// info.who, info.reason) | "hatOff" (its hat taken off)
function noteWishEvent(f, kind, info = {}) {
  if (kind === "left") {
    // Anyone who wished for the one that's gone
    const gone = info.who;
    if (!gone) return;
    const p = (x) => _wP(x);
    const verb = info.reason === "sold" ? "sold" : info.reason === "given up" ? "gave up" : null;
    for (const o of fluffies) {
      if (!o.isAlive || !o.adopted || !o.wish || o.wish.target !== gone.id) continue;
      if (typeof haveMet === "function" && !haveMet(o, gone)) continue; // (Acquaintance.js)
      const n = fluffyDisplayName(gone);
      const id = o.wish.id;
      if (!verb) {
        o.wish = null; // not your doing
        continue;
      }
      if (id === "specialFriend") denyWish(o, `You ${verb} ${n}, the special friend ${p(o).sub} wished for.`);
      else if (id === "stayWithMum") denyWish(o, `You ${verb} ${p(o).poss} mum ${n} before ${p(o).sub} was grown.`);
      else if (id === "seeDaughter") denyWish(o, `You ${verb} ${p(o).poss} daughter ${n}, whom ${p(o).sub} longed to see.`);
      else if (id === "hat") o.wish = null;
    }
    return;
  }
  if (!f) return;
  if (kind === "hatOff") {
    if (f.hatWishGrantedAt !== undefined && timePlayed - f.hatWishGrantedAt < DAY_LENGTH) {
      f.wish = { id: "hat", since: timePlayed, ache: 0 };
      f.hatWishGrantedAt = undefined;
      denyWish(f, `You took away the hat ${_wP(f).sub} had wished for.`);
    }
    return;
  }
  const w = f.wish;
  if (!w) return;
  if ((kind === "toy" || kind === "played") && w.id === "toy") grantWish(f);
  if (kind === "foal" && w.id === "foal") grantWish(f);
}

// ---- The harsh use: promising it ----

function canPromiseWish(f) {
  return !!(f && f.adopted && f.wish && f.wish.promisedAt === undefined);
}

function promiseWish(f) {
  if (!canPromiseWish(f)) return false;
  f.wish.promisedAt = timePlayed;
  if (typeof recordStory === "function") recordStory("turning", f, { x: `You promised ${_wP(f).obj} ${wishText(f).toLowerCase()} if ${_wP(f).sub} was good.` });
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["WISH_PROMISED"], f), true);
  return true;
}

// Tricks.js / Lessons.js: tries harder while dangled
function wishPromiseBoost(f) {
  const w = f && f.wish;
  if (!w || w.promisedAt === undefined) return 1;
  return timePlayed - w.promisedAt < WISH_PROMISE_DAYS * DAY_LENGTH ? WISH_PROMISE_BOOST : 1;
}

// The right-click menu's actions row (Tricks.js rightClickActions)
function wishActions(f) {
  if (!canPromiseWish(f)) return [];
  return [{ key: "promise", name: "Promise wish", sub: "obeys better", harsh: true, run: (x) => promiseWish(x) }];
}

// ---- Its happiness settles higher while content (Horse.update) ----

function wishHappinessTarget(f) {
  return f && f.contentUntil !== undefined && timePlayed < f.contentUntil ? WISH_CONTENT_TARGET : 0;
}

// ---- Magnifying glass / Household ----

function describeWish(f) {
  if (!f || !f.adopted || !f.isAlive) return null;
  const t = wishText(f);
  if (!t) {
    if (f.contentUntil !== undefined && timePlayed < f.contentUntil) return ["Content: a wish came true", "good"];
    return null;
  }
  const days = _wDays(f.wish);
  const promised = f.wish.promisedAt !== undefined ? " · promised" : "";
  if (days >= WISH_PATIENCE_DAYS) return [`${t} (aching for it${promised})`, "bad"];
  return [`${t}${promised}`, "ok"];
}

// ---- Every couple of seconds ----

function updateWish(f, step) {
  const now = timePlayed;
  if (f.scene === "PARK") f.seenPark = true;
  if (!f.wish) {
    if (f.wishCooldownUntil !== undefined && now < f.wishCooldownUntil) return;
    if (f.tooYoungToWalk()) return;
    pickWish(f);
    return;
  }
  const w = f.wish;
  const def = WISHES[w.id];
  if (!def) {
    f.wish = null;
    return;
  }
  // Came true?
  if (def.done && def.done(f, w)) {
    if (w.id === "hat") f.hatWishGrantedAt = now;
    grantWish(f);
    return;
  }
  // No longer possible (grew up, the one it wanted died...)
  let still = true;
  try {
    still = w.id === "stayWithMum" ? !!_wById(w.target) && _wById(w.target).isAlive : def.when(f) || (def.done && !def.done(f, w) && w.id !== "trick" && w.id !== "toy");
    if ((w.id === "trick" || w.id === "toy") && !_wYoung(f)) still = false;
    // (a mare that's expecting still wants her foals: it comes true at the birth)
    if (w.id === "foal" && f.isPregnant) still = true;
    if (w.id === "seeDaughter" && typeof getFamilyRecord === "function") {
      const r = getFamilyRecord(w.target);
      if (r && r.status === "dead") still = false;
    }
  } catch (e) {
    still = false;
  }
  if (!still) {
    f.wish = null;
    f.wishCooldownUntil = now + (WISH_COOLDOWN_DAYS * DAY_LENGTH) / 2;
    return;
  }
  const days = _wDays(w);
  // A broken promise
  if (w.promisedAt !== undefined && !w.broken && now - w.promisedAt >= WISH_PROMISE_DAYS * DAY_LENGTH) {
    w.broken = true;
    const p = _wP(f);
    if (typeof rememberPlayerEvent === "function") rememberPlayerEvent(f, "broken_promise");
    if (typeof changePlayerTrust === "function") changePlayerTrust(f, -0.12);
    f.changeHappiness(-0.1, "Broken promise");
    if (typeof recordStory === "function") recordStory("wish_denied", f, { x: `You promised ${p.obj} ${def.text(f, w).toLowerCase()}, and it never came.` });
  }
  // Aching
  if (days >= WISH_PATIENCE_DAYS && w.ache < WISH_ACHE_MAX) {
    const per = WISH_ACHE_PER_HOUR * (w.broken ? 2 : 1);
    const amount = Math.min(WISH_ACHE_MAX - w.ache, (per * step) / HOUR_LENGTH);
    w.ache += amount;
    f.changeHappiness(-amount, "Longing for its wish");
  }
  // Giving up
  if (days >= WISH_GIVE_UP_DAYS) {
    const p = _wP(f);
    if (typeof recordStory === "function") recordStory("wish_denied", f, { x: `${p.Sub} gave up wishing for ${def.text(f, w).replace(/^To /, "").replace(/^A /, "a ").replace(/^./, (c) => c.toLowerCase())}.` });
    f.wish = null;
    f.wishCooldownUntil = now + 2 * WISH_COOLDOWN_DAYS * DAY_LENGTH;
  }
}

function _wSayWish(f) {
  const def = f.wish && WISHES[f.wish.id];
  if (!def || !def.say || f.tooYoungToSpeak() || f.currentStateKey === "SLEEPING" || (f.speech && f.speech.timer > 0)) return false;
  const target = _wById(f.wish.target);
  f.speak(getDialogue(["WISH", def.say], f, target));
  return true;
}

function updateWishes(dt) {
  if (wishTalkTicker.step(dt) && typeof fluffies !== "undefined") {
    for (const f of fluffies) {
      if (!f.isAlive || !f.adopted || !f.wish || f.scene !== currentScene) continue;
      const aching = _wDays(f.wish) >= WISH_PATIENCE_DAYS;
      if (Math.random() < WISH_SAY_CHANCE * (aching ? 3 : 1) && _wSayWish(f)) break;
    }
  }
  const step = wishTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  for (const f of fluffies) {
    if (!f.isAlive || !f.adopted) continue;
    updateWish(f, step);
  }
}

registerSystem("wishes", updateWishes, 18);
