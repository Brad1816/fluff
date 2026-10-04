// ---------------------------------------------------------------------------
// Surgery jobs (players' request): customers bring their fluffies to you for
// an operation. Only once you have an operating table.
//
// Now and then in the day (SURGERY_JOB_CHANCE a game hour, 8 AM - 6 PM, at
// most one a day, one at a time) someone asks: neuter a stallion, spay a
// mare, dock a tail, or take off a mangled leg. Say yes and the fluffy is
// dropped off in your living room (not yours: f.clientJob, saved - keep it
// fed). Do the operation (the operating table, the knife or scalpel, the
// suture kit or iron for the bleeding) by the end of the next game day.
//
// Once the part's off and it's stopped bleeding, the owner collects it:
//   - paid SURGERY_JOB_PAY for the job x how well it came through (its
//     health: x1 at 70+, down to x0.5); a scalpel job pays a little more
//   - anything else cut off that shouldn't have been: botched - no pay, and
//     your reputation drops (SURGERY_JOB_REP_BOTCH); if it dies: worse
//     (SURGERY_JOB_REP_DIED)
//   - not done in time: collected as it is, no pay, a little reputation lost
// A clean job adds a little reputation (SURGERY_JOB_REP_GOOD).
// Saved: surgeryJobs (SAVED_GAME_STATE).
// ---------------------------------------------------------------------------

const SURGERY_JOB_CHANCE = 0.12; // a game hour, in the day
const SURGERY_JOB_TIME = 1; // game days to do it (to the end of the next day)
const SURGERY_JOB_PAY = { lumps: 120, spay: 160, tail: 90, leg: 200 };
const SURGERY_JOB_WORDS = { lumps: "neuter", spay: "spay", tail: "dock the tail of", leg: "take off the mangled leg of" };
const SURGERY_JOB_REP_GOOD = 2;
const SURGERY_JOB_REP_BOTCH = 8;
const SURGERY_JOB_REP_DIED = 15;
const SURGERY_JOB_REP_LATE = 3;
const SURGERY_CLIENTS = ["Mrs. Pell", "Mr. Okafor", "Dana", "The Hendersons", "Old Mr. Grieve", "Priya", "Coach Barlow", "Mrs. Aldine"];
const SURGERY_PET_NAMES = ["Buttons", "Biscuit", "Pumpkin", "Taffy", "Captain", "Mopsy", "Sprout", "Dumpling", "Rosie", "Bramble"];
const surgeryJobTicker = new Ticker(2);

function freshSurgeryJobs() {
  return { active: null, done: 0, botched: 0, lastOfferDay: -1, nextId: 1 };
}
let surgeryJobs = freshSurgeryJobs();
if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({
    name: "surgeryJobs",
    get: () => surgeryJobs,
    set: (v) => (surgeryJobs = v && typeof v === "object" ? v : freshSurgeryJobs()),
    fresh: () => freshSurgeryJobs(),
  });
}

function _sjDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : 1;
}

function _sjHour() {
  return typeof gameHourOfDay === "function" ? gameHourOfDay() : ((typeof timePlayed === "number" ? timePlayed : 0) % DAY_LENGTH) / HOUR_LENGTH;
}

function hasOperatingTable() {
  return typeof OperatingTable !== "undefined" && objects.some((o) => o instanceof OperatingTable && typeof getSceneConfig === "function" && getSceneConfig(o.scene).insidePlayerQuarters);
}

function surgeryClient() {
  const a = surgeryJobs.active;
  return a ? fluffies.find((f) => f.id === a.fluffyId) || null : null;
}

// What's to be done: the part id (Surgery.js SURGERY_PARTS) and is it done?
function _sjPart(job) {
  if (job.kind === "lumps") return "lumps";
  if (job.kind === "spay") return "spay";
  if (job.kind === "tail") return "tail";
  return job.leg || "leg_0";
}

function surgeryJobDone(job, f) {
  if (!f) return false;
  if (job.kind === "spay") return !!f.spayed;
  if (job.kind === "lumps") return !f.limbs.lumps;
  if (job.kind === "tail") return !f.limbs.tail;
  return !f.limbs.legs[parseInt((job.leg || "leg_0").slice(4), 10)];
}

function _sjParts(f) {
  const l = f.limbs || {};
  return {
    leftEar: !!l.leftEar,
    rightEar: !!l.rightEar,
    leftEye: !!l.leftEye,
    rightEye: !!l.rightEye,
    horn: !!l.horn,
    leftWing: !!l.leftWing,
    rightWing: !!l.rightWing,
    tail: !!l.tail,
    lumps: !!l.lumps,
    udders: !!l.udders,
    legs: (l.legs || []).map((x) => !!x),
  };
}

// Anything gone that shouldn't be?
function surgeryJobBotched(job, f) {
  const was = job.parts;
  if (!was || !f) return false;
  const now = _sjParts(f);
  const allowed = job.kind === "leg" ? null : job.kind;
  for (const k of Object.keys(was)) {
    if (k === "legs") {
      for (let i = 0; i < was.legs.length; i++) {
        if (job.kind === "leg" && `leg_${i}` === job.leg) continue;
        if (was.legs[i] && !now.legs[i]) return true;
      }
      continue;
    }
    if (k === allowed) continue;
    if (was[k] && !now[k]) return true;
  }
  return false;
}

// ---- Offers ----

function makeSurgeryJobOffer(rnd = Math.random) {
  const kinds = ["lumps", "spay", "tail", "leg"];
  const kind = kinds[Math.floor(rnd() * kinds.length)];
  const id = surgeryJobs.nextId || 1;
  surgeryJobs.nextId = id + 1;
  return {
    id,
    kind,
    client: SURGERY_CLIENTS[Math.floor(rnd() * SURGERY_CLIENTS.length)],
    pet: SURGERY_PET_NAMES[Math.floor(rnd() * SURGERY_PET_NAMES.length)],
    gender: kind === "lumps" ? "male" : kind === "spay" ? "female" : rnd() < 0.5 ? "male" : "female",
    leg: kind === "leg" ? `leg_${Math.floor(rnd() * 4)}` : null,
    pay: SURGERY_JOB_PAY[kind],
  };
}

function offerSurgeryJob(offer = makeSurgeryJobOffer()) {
  if (typeof openChoice !== "function") return false;
  surgeryJobs.lastOfferDay = _sjDay();
  openChoice({
    title: "A surgery job",
    lines: [`${offer.client} wants you to ${SURGERY_JOB_WORDS[offer.kind]} their fluffy, ${offer.pet}.`, `$${offer.pay} if it goes well - done by the end of tomorrow. A botched job will cost you your good name.`],
    buttons: [
      { label: "Take the job", kind: "ok", run: () => acceptSurgeryJob(offer) },
      { label: "Turn it down", cancel: true, run: () => {} },
    ],
  });
  return true;
}

function acceptSurgeryJob(offer) {
  if (surgeryJobs.active) return null;
  const scene = "INDOORS";
  const r = Math.random();
  const type = r < 0.2 ? "unicorn" : r < 0.4 ? "pegasus" : "earthy";
  const f = new Horse(1, null, scene, type, null, 0.4 + Math.random() * 0.5, 0.4 + Math.random() * 0.5, offer.gender);
  f.makeType(type);
  f.x = width / 2 + (Math.random() - 0.5) * 120;
  f.y = height - 260;
  f.adopted = false;
  f.notForSale = true;
  f.playerTrust = 0.5;
  f.hunger = 1;
  f.personalities = (f.personalities || []).filter((p) => p !== "true_feral" && p !== "smarty");
  if (offer.kind === "leg") {
    f.limbState = { ...(f.limbState || {}), [offer.leg]: "mangled" };
  }
  f.clientJob = { id: offer.id, client: offer.client };
  fluffies.push(f);
  fluffyNames[f.id] = offer.pet;
  surgeryJobs.active = { ...offer, fluffyId: f.id, due: _sjDay() + SURGERY_JOB_TIME, parts: _sjParts(f), at: timePlayed };
  if (typeof poofs !== "undefined" && typeof Poof !== "undefined") poofs.push(new Poof(f.x, f.y, scene));
  if (typeof addUIMessage === "function") addUIMessage(`${offer.client} dropped ${offer.pet} off in your living room. ${SURGERY_JOB_WORDS[offer.kind][0].toUpperCase() + SURGERY_JOB_WORDS[offer.kind].slice(1)} it by the end of tomorrow.`);
  return f;
}

// ---- Collecting ----

function _sjRep(delta) {
  if (typeof customerOrders !== "undefined" && customerOrders) customerOrders.reputation = Math.max(0, (customerOrders.reputation || 0) + delta);
}

function _sjGone(f) {
  if (!f) return;
  const i = fluffies.indexOf(f);
  if (i >= 0) fluffies.splice(i, 1);
  if (typeof poofs !== "undefined" && typeof Poof !== "undefined") poofs.push(new Poof(f.x, f.y, f.scene));
}

function _sjNews(text) {
  if (typeof addUIMessage === "function") addUIMessage(text);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text });
}

// The owner collects it. outcome: "done" | "botched" | "died" | "late"
function finishSurgeryJob(outcome) {
  const job = surgeryJobs.active;
  if (!job) return null;
  const f = surgeryClient();
  surgeryJobs.active = null;
  if (outcome === "done") {
    const health = f ? Math.max(0, Math.min(100, f.health)) : 0;
    const k = health >= 70 ? 1 : 0.5 + (0.5 * health) / 70;
    const pay = Math.round(job.pay * k * (job.scalpel ? 1.1 : 1));
    money += pay;
    if (typeof noteEarning === "function") noteEarning(pay);
    surgeryJobs.done = (surgeryJobs.done || 0) + 1;
    _sjRep(SURGERY_JOB_REP_GOOD);
    _sjGone(f);
    _sjNews(`${job.client} collected ${job.pet}: a good job. +$${pay}.`);
    return { outcome, pay };
  }
  surgeryJobs.botched = (surgeryJobs.botched || 0) + (outcome === "late" ? 0 : 1);
  if (outcome === "botched") {
    _sjRep(-SURGERY_JOB_REP_BOTCH);
    _sjGone(f);
    _sjNews(`${job.client} collected ${job.pet} and saw what you'd done. No pay - and they'll tell everyone.`);
  } else if (outcome === "died") {
    _sjRep(-SURGERY_JOB_REP_DIED);
    if (f && !f.isAlive) _sjGone(f);
    _sjNews(`${job.client}'s fluffy ${job.pet} died in your care. They're devastated, and your name suffers for it.`);
  } else {
    _sjRep(-SURGERY_JOB_REP_LATE);
    _sjGone(f);
    _sjNews(`${job.client} came for ${job.pet} - the job wasn't done. No pay.`);
  }
  return { outcome, pay: 0 };
}

function updateSurgeryJobs(dt) {
  if (!surgeryJobTicker.step(dt)) return;
  if (!surgeryJobs || typeof surgeryJobs !== "object") surgeryJobs = freshSurgeryJobs();
  for (const [k, v] of Object.entries(freshSurgeryJobs())) if (surgeryJobs[k] === undefined) surgeryJobs[k] = v;
  const job = surgeryJobs.active;
  if (job) {
    const f = surgeryClient();
    if (!f) {
      surgeryJobs.active = null; // (gone some other way)
      return;
    }
    if (!f.isAlive) return finishSurgeryJob("died");
    if (surgeryJobBotched(job, f)) {
      if (!(f.bleedingTimer > 0)) finishSurgeryJob("botched");
      return;
    }
    if (surgeryJobDone(job, f)) {
      if (typeof surgery !== "undefined" && surgery && surgery.f === f && surgery.knife && surgery.knife.type === "scalpel") job.scalpel = true;
      if (!(f.bleedingTimer > 0) && !(typeof isSurgeryOpen === "function" && isSurgeryOpen() && surgery.f === f)) finishSurgeryJob("done");
      return;
    }
    if (_sjDay() > job.due) finishSurgeryJob("late");
    return;
  }
  // A new offer: in the day, with an operating table, once a day at most
  const hour = _sjHour();
  if (hour < 8 || hour >= 18 || surgeryJobs.lastOfferDay === _sjDay() || !hasOperatingTable()) return;
  if (typeof isChoiceOpen === "function" && isChoiceOpen()) return;
  if (Math.random() < SURGERY_JOB_CHANCE * (2 / HOUR_LENGTH)) offerSurgeryJob();
}
registerSystem("surgeryJobs", updateSurgeryJobs, 177);

function describeClientJob(f) {
  const job = surgeryJobs.active;
  if (!f || !f.clientJob || !job || job.fluffyId !== f.id) return null;
  const left = job.due - _sjDay();
  return [`${job.client}'s - to ${SURGERY_JOB_WORDS[job.kind].replace(" of", "")} (${left > 0 ? "by tomorrow night" : "today"}, $${job.pay})`, "ok"];
}
if (typeof INSPECT_ROWS !== "undefined") INSPECT_ROWS.push(["Surgery job", "describeClientJob"]);
