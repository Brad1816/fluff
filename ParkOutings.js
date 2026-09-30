// ---------------------------------------------------------------------------
// Park outings (new features, #8).
//
// Outings: right-click one of your fluffies at home - "Park outing" takes
// everyone in that room who can walk (up to OUTING_MAX) to Fluffy Park with
// you. While you're there together they play: happier, less bored, a
// little more love for you, the park wish comes true, and they meet the
// wild ones. They stay near you (anyone who strays too far comes back).
// "Home time" (the banner at the top), or walking out of the park, takes
// everyone home to the room they came from, with a shared memory. A Rebel
// or a miserable fluffy may slip away during an outing and go wild.
//
// Old friends: a fluffy you lost (Runaways.js) that meets its old friends
// or family on an outing is overjoyed, and so are they. Right-click a
// former pet in the park: "Bring it home", if it still trusts you.
//
// Herd lore you can feel: herds that have heard you're kind (herdLore)
// send someone over to say hello, and trust you a little more; herds that
// have heard you hurt fluffies keep away from you and yours.
//
// Raids: a herd led by a fluffy that ran away from you as a Rebel (or one
// that has only heard bad things about you, led by one of your old
// fluffies) may raid the backyard at night (RAID_CHANCE, less with a sound
// fence). A few of them come over the fence, eat the food and pick fights
// until morning, or until you come out (they scatter). A miserable fluffy
// of yours in the backyard may leave with them.
// ---------------------------------------------------------------------------

const OUTING_MAX = 12;
const OUTING_JOY = 0.03; // happiness a game minute
const OUTING_BORED = 0.12; // boredom off a game minute
const OUTING_STRAY = 700; // px from the middle of the screen before it comes back
const OUTING_SLIP = 0.35; // x runAwayChance: slipping off during one outing
const LORE_GREET_GAP = 25; // game seconds between a herd's hellos
const LORE_TRUST = 0.01;
const RAID_CHANCE = 0.35;
const RAID_FENCE = 0.4; // x the chance with the backyard fence intact
const RAID_MAX = 5;
const RAID_HOURS = 3;
const RAID_LEAVE = 0.5; // a miserable fluffy in the backyard leaving with them
const RAID_FIGHT = 0.08; // a raider picking a fight, per check

function freshOutings() {
  return { outing: null, lastRaidNight: null, raids: 0 };
}
let outings = freshOutings(); // { outing: { ids, home, start }, lastRaidNight, raids }
let _raid = null; // { ids, until, from: {id: {x,y}} } (not saved: a raid ends by morning)

function _poOk() {
  if (!outings || typeof outings !== "object") outings = freshOutings();
  return outings;
}
function _poNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}
function _poName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
}
function _poSay(t) {
  if (typeof addUIMessage === "function") addUIMessage(t);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: t });
}
function _poById(id) {
  return typeof fluffies !== "undefined" ? fluffies.find((f) => f.id === id) : null;
}
function _poMiddle() {
  const cam = typeof camera !== "undefined" ? camera : { x: 0, y: 0 };
  return { x: cam.x + width / 2, y: cam.y + height / 2 + 60 };
}

// ---- Outings ----

function onOuting() {
  return !!_poOk().outing;
}
function outingMembers() {
  const o = _poOk().outing;
  if (!o) return [];
  return o.ids.map(_poById).filter((f) => f && f.isAlive && f.adopted);
}

// Who'd come from this room
function outingCandidates(scene) {
  if (typeof fluffies === "undefined") return [];
  return fluffies
    .filter(
      (f) =>
        f.isAlive &&
        f.adopted &&
        f.scene === scene &&
        !f.currentCage &&
        !f.placedOn &&
        !f.isDragging &&
        f.currentStateKey !== "SLEEPING" &&
        !(typeof f.tooYoungToWalk === "function" && f.tooYoungToWalk()),
    )
    .slice(0, OUTING_MAX);
}

// Right-click, at home
function outingActions(f) {
  if (!f || !f.adopted || onOuting() || typeof PARK_SCENE === "undefined") return [];
  if (typeof getSceneConfig === "function" && !getSceneConfig(f.scene).insidePlayerQuarters) return [];
  const n = outingCandidates(f.scene).length;
  if (!n) return [];
  return [{ key: "outing", name: "Park outing", sub: n === 1 ? "just this one" : `all ${n} in here`, run: (x) => startOuting(x.scene) }];
}

function startOuting(home) {
  const o = _poOk();
  if (o.outing) return false;
  const who = outingCandidates(home);
  if (!who.length) return false;
  o.outing = { ids: who.map((f) => f.id), home, start: _poNow(), memory: false };
  if (typeof changeScene === "function") changeScene(PARK_SCENE);
  const mid = _poMiddle();
  who.forEach((f, i) => {
    f.scene = PARK_SCENE;
    f.x = mid.x - 220 + (i % 6) * 80 + Math.random() * 20;
    f.y = mid.y + Math.floor(i / 6) * 70 - 40;
    if (typeof f.initBehavior === "function") f.initBehavior("IDLE");
    f._outingSlipChecked = false;
    f._outingLoved = false;
  });
  if (typeof inspectedFluffy !== "undefined") inspectedFluffy = null;
  if (typeof closeTrickUI === "function") closeTrickUI();
  _poSay(`You take ${who.length === 1 ? _poName(who[0]) : `${who.length} fluffies`} to the park.`);
  const talker = who.find((f) => !f.tooYoungToSpeak());
  if (talker && typeof getDialogue === "function") talker.speak(getDialogue(["PARK", "OUTING"], talker), true);
  return true;
}

function endOuting(why = "home") {
  const o = _poOk();
  if (!o.outing) return 0;
  const home = o.outing.home;
  const who = outingMembers();
  const minutes = (_poNow() - o.outing.start) / 60;
  let n = 0;
  for (const f of who) {
    if (f.scene !== PARK_SCENE) continue;
    if (typeof f.interruptMating === "function" && f.matingState && f.matingState.isMating) f.interruptMating();
    f.scene = home;
    f.x = 200 + Math.random() * (width - 400);
    f.y = height * 0.45 + Math.random() * height * 0.35;
    if (typeof f.initBehavior === "function") f.initBehavior("IDLE");
    n++;
  }
  // A day out together, remembered (a good long one)
  if (who.length >= 2 && minutes >= 2 && typeof makeSharedMemory === "function")
    makeSharedMemory("party", "A day out at the park", who, { key: `outing:${Math.floor(o.outing.start)}`, good: true, scene: home });
  o.outing = null;
  if (n) _poSay(why === "left" ? `You walk ${n === 1 ? "your fluffy" : `all ${n}`} home from the park.` : `Home time: ${n === 1 ? "one fluffy" : `${n} fluffies`} back home, tired and happy.`);
  return n;
}

function _updateOuting(step) {
  const o = _poOk();
  if (!o.outing) return;
  // You left the park: everyone comes with you
  if (typeof currentScene !== "undefined" && currentScene !== PARK_SCENE) {
    endOuting("left");
    return;
  }
  const who = outingMembers();
  if (!who.length) {
    o.outing = null;
    return;
  }
  const mid = _poMiddle();
  const mins = step / 60;
  for (const f of who) {
    if (f.scene !== PARK_SCENE) continue;
    if (typeof f.changeHappiness === "function") f.changeHappiness(OUTING_JOY * mins);
    if (typeof f.boredom === "number") f.boredom = Math.max(0, f.boredom - OUTING_BORED * mins);
    f.seenPark = true;
    if (!f._outingLoved && typeof giveAffection === "function") {
      f._outingLoved = true;
      giveAffection(f, "played");
    }
    // Strayed too far: comes back to you
    if (Math.hypot(f.x - mid.x, f.y - mid.y) > OUTING_STRAY && !f.isDragging && ["IDLE", "MOVING", "SITTING"].includes(f.currentStateKey)) {
      // ...unless it's had enough of you: it slips away
      if (!f._outingSlipChecked) {
        f._outingSlipChecked = true;
        const p = typeof runAwayChance === "function" ? runAwayChance(f) * OUTING_SLIP : 0;
        if (p > 0 && Math.random() < p && typeof _goWild === "function") {
          const n = _poName(f);
          _goWild(f, "ran away");
          _poSay(`${n} slipped away during the outing. It's wild now.`);
          if (typeof recordStory === "function") recordStory("turning", f, { x: `${n} slipped away on a trip to the park.` });
          if (typeof noteWeekRanAway === "function") noteWeekRanAway();
          continue;
        }
      }
      f.initBehavior("MOVING");
      f.setTargetPosition(mid.x + (Math.random() - 0.5) * 300, mid.y + (Math.random() - 0.5) * 160);
    }
  }
  _reunions(who);
}

// Old friends meet again
function _reunions(who) {
  if (typeof fluffies === "undefined") return;
  const day = typeof getDayNumber === "function" ? getDayNumber() : 1;
  for (const old of fluffies) {
    if (!old.isAlive || old.adopted || !old.formerPet || old.scene !== PARK_SCENE) continue;
    if (old.formerPet.reunionDay === day) continue;
    const friend = who.find((f) => Math.hypot(f.x - old.x, f.y - old.y) < 260 && typeof getLiking === "function" && getLiking(f, old) >= 0.3);
    if (!friend) continue;
    old.formerPet.reunionDay = day;
    for (const [a, b] of [
      [friend, old],
      [old, friend],
    ]) {
      if (typeof changeOpinion === "function") changeOpinion(a, b, 0.1, "met again");
      if (typeof a.changeHappiness === "function") a.changeHappiness(0.15);
      a.expressionOverride = "GOOD_UPSIES";
      a.expressionOverrideTimer = 3;
    }
    if (typeof old.setTargetPosition === "function") {
      old.initBehavior("RUNNING");
      old.setTargetPosition(friend.x + 50, friend.y);
    }
    if (!friend.tooYoungToSpeak() && typeof getDialogue === "function") friend.speak(getDialogue(["PARK", "REUNION"], friend, old), true);
    _poSay(`${_poName(friend)} found ${old.formerPet.name || "an old friend"} in the park!`);
    if (typeof makeSharedMemory === "function") makeSharedMemory("party", `${_poName(friend)} and ${old.formerPet.name || "an old friend"} meet again`, [friend, old], { key: `reunion:${old.id}:${friend.id}`, good: true, scene: PARK_SCENE });
  }
}

// ---- Bringing a former pet home (right-click, in the park) ----

function formerPetRightClick() {
  if (typeof currentScene === "undefined" || currentScene !== PARK_SCENE || typeof fluffies === "undefined") return false;
  const f = fluffies.find((x) => x.isAlive && !x.adopted && x.formerPet && x.scene === currentScene && x.hitTestAsSeen(mouse.x, mouse.y));
  if (!f) return false;
  bringFormerPetHome(f);
  return true;
}

function bringFormerPetHome(f) {
  const n = f.formerPet ? f.formerPet.name || _poName(f) : _poName(f);
  if ((f.playerTrust || 0) < 0.4 || (f.playerFear || 0) >= 0.5) {
    if (typeof addUIMessage === "function") addUIMessage(`${n} won't come with you. It doesn't trust you any more.`);
    if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["RUNAWAY", "MEET_SCARED"], f), true);
    return false;
  }
  f.adopted = true;
  if (typeof onFormerPetHome === "function") onFormerPetHome(f);
  const o = _poOk();
  if (o.outing) o.outing.ids.push(f.id);
  else o.outing = { ids: [f.id], home: "INDOORS", start: _poNow(), memory: false };
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["RUNAWAY", "MEET_HAPPY"], f), true);
  if (typeof addUIMessage === "function") addUIMessage(`${n} is coming home with you.`);
  return true;
}

// ---- Herd lore you can feel ----

const _loreGreetAt = {}; // herd id -> game time
function _updateLore() {
  if (typeof currentScene === "undefined" || currentScene !== PARK_SCENE || typeof herdState === "undefined" || typeof herdLore !== "function") return;
  const now = _poNow();
  const mid = _poMiddle();
  const mine = outingMembers();
  for (const h of herdState.list || []) {
    const members = typeof getHerdMembers === "function" ? getHerdMembers(h).filter((f) => f.isAlive && !f.adopted && f.scene === PARK_SCENE) : [];
    const near = members.filter((f) => typeof isOnParkScreen === "function" && isOnParkScreen(f.x, f.y, 0));
    if (!near.length) continue;
    const lore = herdLore(h);
    if (!lore) continue;
    if (lore.harm >= LORE_HARM && lore.harm >= lore.kind) {
      // Keep away from you and yours
      for (const f of near) {
        const close = Math.hypot(f.x - mid.x, f.y - mid.y) < 320 || mine.some((m) => Math.hypot(m.x - f.x, m.y - f.y) < 200);
        if (!close || f.isDragging || f.currentStateKey === "SLEEPING" || f.currentStateKey === "RUNNING") continue;
        const away = typeof f.positioning !== "undefined" && f.positioning.getRunawayTarget ? f.positioning.getRunawayTarget(mid.x, mid.y) : { x: f.x + (f.x > mid.x ? 250 : -250), y: f.y };
        f.initBehavior("RUNNING");
        f.setTargetPosition(away.x, away.y);
        if ((_loreGreetAt[h.id] || -1e9) < now - LORE_GREET_GAP && !f.tooYoungToSpeak() && typeof getDialogue === "function") {
          _loreGreetAt[h.id] = now;
          f.speak(getDialogue(["PARK", "WARY"], f), true);
        }
      }
    } else if (lore.kind >= LORE_KIND) {
      // Someone comes over to say hello
      if ((_loreGreetAt[h.id] || -1e9) > now - LORE_GREET_GAP) continue;
      const f = near.find((x) => !x.isDragging && x.growth >= 0.5 && ["IDLE", "SITTING", "MOVING"].includes(x.currentStateKey));
      if (!f) continue;
      _loreGreetAt[h.id] = now;
      f.initBehavior("MOVING");
      f.setTargetPosition(mid.x + (Math.random() - 0.5) * 160, mid.y + 40);
      f.playerTrust = Math.min(1, (f.playerTrust || 0) + LORE_TRUST);
      if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["PARK", "WARM"], f), true);
      // ...and your fluffies make friends with them
      for (const m of mine) {
        const w = members.find((x) => Math.hypot(x.x - m.x, x.y - m.y) < 180);
        if (w && typeof changeOpinion === "function") {
          changeOpinion(m, w, 0.05, "played in the park");
          changeOpinion(w, m, 0.05, "played in the park");
        }
      }
    }
  }
}

// ---- Raids ----

// The herd that might raid: led by a Rebel that ran away from you, or by
// one of your old fluffies when the herd's heard bad things about you
function raidingHerd() {
  if (typeof herdState === "undefined" || typeof getHerdLeader !== "function") return null;
  let best = null;
  for (const h of herdState.list || []) {
    const leader = getHerdLeader(h);
    if (!leader || leader.adopted || !leader.formerPet) continue;
    const rebel = typeof titleOf === "function" && titleOf(leader) === "Rebel";
    const lore = typeof herdLore === "function" ? herdLore(h) : null;
    const bitter = lore && lore.harm >= LORE_HARM * 2 && lore.harm > lore.kind;
    if (rebel || bitter) {
      const score = (rebel ? 2 : 1) + (lore ? lore.harm : 0);
      if (!best || score > best.score) best = { h, leader, score };
    }
  }
  return best;
}

function startRaid(force = false) {
  const r = raidingHerd();
  if (!r || _raid) return null;
  const fenced = typeof backyardFenceBroken !== "undefined" && !backyardFenceBroken && typeof backyardFenceTier === "number" && backyardFenceTier > 0;
  if (!force && Math.random() > RAID_CHANCE * (fenced ? RAID_FENCE : 1)) return null;
  const raiders = getHerdMembers(r.h)
    .filter((f) => f.isAlive && !f.adopted && f.scene === PARK_SCENE && f.growth >= 1 && !f.isDragging)
    .sort((a, b) => (b === r.leader) - (a === r.leader))
    .slice(0, RAID_MAX);
  if (!raiders.length) return null;
  const from = {};
  raiders.forEach((f, i) => {
    from[f.id] = { x: f.x, y: f.y };
    if (f.matingState && f.matingState.isMating && typeof f.interruptMating === "function") f.interruptMating();
    f.scene = "BACKYARD";
    f.x = 60 + i * 40;
    f.y = height * 0.5 + (i % 3) * 60;
    f.initBehavior("MOVING");
    f.setTargetPosition(200 + Math.random() * 600, height * 0.45 + Math.random() * 250);
    f.raiding = true;
  });
  _raid = { ids: raiders.map((f) => f.id), until: _poNow() + RAID_HOURS * (typeof HOUR_LENGTH === "number" ? HOUR_LENGTH : 50), from, herd: r.h.id, leaderName: (r.leader.formerPet && r.leader.formerPet.name) || _poName(r.leader), herdName: typeof getHerdName === "function" ? getHerdName(r.h) : "a herd" };
  _poOk().raids++;
  if (typeof addRoomClimate === "function") addRoomClimate("BACKYARD", { f: 2, t: 1 });
  _poSay(`Raiders! The ${_raid.herdName}, led by ${_raid.leaderName} (who used to live with you), got into the backyard.`);
  return _raid;
}

function isRaiding() {
  return !!_raid;
}

function endRaid(why = "morning") {
  if (!_raid) return 0;
  const r = _raid;
  _raid = null;
  let back = 0;
  const left = [];
  // A miserable one of yours goes with them
  if (why === "morning" && typeof fluffies !== "undefined") {
    for (const f of fluffies.slice()) {
      if (!f.isAlive || !f.adopted || f.scene !== "BACKYARD" || f.currentCage || f.growth < 1) continue;
      const unhappy = f.happiness < 0.3 || (typeof titleOf === "function" && titleOf(f) === "Rebel");
      if (unhappy && Math.random() < RAID_LEAVE && typeof _goWild === "function") {
        _goWild(f, "ran away");
        f.scene = PARK_SCENE;
        const home = r.from[r.ids[0]] || { x: 400, y: 600 };
        f.x = home.x + 60;
        f.y = home.y;
        left.push(_poName(f));
        if (typeof noteWeekRanAway === "function") noteWeekRanAway();
      }
    }
  }
  for (const id of r.ids) {
    const f = _poById(id);
    if (!f || !f.isAlive || f.adopted) continue;
    f.raiding = false;
    f.scene = PARK_SCENE;
    const at = r.from[id] || { x: 400, y: 600 };
    f.x = at.x;
    f.y = at.y;
    if (typeof f.initBehavior === "function") f.initBehavior("IDLE");
    back++;
  }
  if (why === "you") _poSay("The raiders scatter when they see you, and run back to the park.");
  else _poSay(`The raiders went back to the park before morning.${left.length ? ` ${left.join(" and ")} went with them.` : ""}`);
  return back;
}

function _updateRaid(step) {
  if (!_raid) return;
  const raiders = _raid.ids.map(_poById).filter((f) => f && f.isAlive && !f.adopted && f.scene === "BACKYARD");
  if (!raiders.length || _poNow() >= _raid.until) {
    endRaid(raiders.length ? "morning" : "gone");
    return;
  }
  // You came out: they run
  if (typeof currentScene !== "undefined" && currentScene === "BACKYARD") {
    if (!_raid.seenAt) _raid.seenAt = _poNow();
    for (const f of raiders) {
      if (f.currentStateKey !== "RUNNING") {
        f.initBehavior("RUNNING");
        f.setTargetPosition(-80, f.y);
      }
    }
    if (_poNow() - _raid.seenAt > 4) endRaid("you");
    return;
  }
  // Trouble: a fight now and then
  const mine = typeof fluffies !== "undefined" ? fluffies.filter((f) => f.isAlive && f.adopted && f.scene === "BACKYARD" && !f.currentCage) : [];
  for (const f of raiders) {
    if (!mine.length || Math.random() > RAID_FIGHT * step) continue;
    const t = mine[Math.floor(Math.random() * mine.length)];
    if (Math.hypot(t.x - f.x, t.y - f.y) > 400) {
      f.initBehavior("MOVING");
      f.setTargetPosition(t.x, t.y);
    } else if (typeof f.performAttack === "function") f.performAttack(t, "GRUDGE");
  }
}

// Once a night, around midnight
let _raidCheckedNight = null;
function _maybeRaid() {
  if (typeof gameHour !== "function" || typeof getDayNumber !== "function") return;
  const h = gameHour();
  if (h < 1 || h >= 3) return;
  const night = getDayNumber();
  const o = _poOk();
  if (o.lastRaidNight === night || _raidCheckedNight === night) return;
  _raidCheckedNight = night;
  if (startRaid()) o.lastRaidNight = night;
}

// ---- The banner in the park (screen positions) ----

function getOutingBanner() {
  if (!onOuting() || typeof currentScene === "undefined" || currentScene !== PARK_SCENE) return null;
  const w = 330;
  const x = Math.round(width / 2 - w / 2);
  return { x, y: 126, w, h: 40, home: { x: x + w - 118, y: 131, w: 108, h: 30 } };
}
function drawOutingBanner(c) {
  const B = getOutingBanner();
  if (!B || (typeof isAnyScreenOpen === "function" && isAnyScreenOpen())) return;
  c.save();
  if (typeof fillRoundRect === "function") fillRoundRect(c, B.x, B.y, B.w, B.h, 12, "rgba(20, 40, 25, 0.85)");
  c.fillStyle = "#b8f0b0";
  c.font = "bold 14px Arial";
  c.textAlign = "left";
  c.textBaseline = "middle";
  const n = outingMembers().filter((f) => f.scene === PARK_SCENE).length;
  c.fillText(`Park outing: ${n} ${n === 1 ? "fluffy" : "fluffies"}`, B.x + 14, B.y + B.h / 2);
  if (typeof drawGlassButton === "function") drawGlassButton(B.home.x, B.home.y, B.home.w, B.home.h, "Home time", { fontSize: 14, borderRadius: 8 });
  c.restore();
}
// UI.js mousedown (screen positions)
function outingBannerClick() {
  const B = getOutingBanner();
  if (!B) return false;
  const sx = mouse.x;
  const sy = mouse.y;
  if (!isPointInRect(sx, sy, B.x, B.y, B.w, B.h)) return false;
  if (isPointInRect(sx, sy, B.home.x, B.home.y, B.home.w, B.home.h)) {
    const home = _poOk().outing.home;
    endOuting("home");
    if (typeof changeScene === "function") changeScene(home);
  }
  return true;
}

const parkOutingsTicker = new Ticker(1);
function updateParkOutings(dt) {
  const step = parkOutingsTicker.step(dt);
  if (!step) return;
  _updateOuting(step);
  _updateLore();
  _maybeRaid();
  _updateRaid(step);
}

registerSystem("parkOutings", updateParkOutings, 142);
