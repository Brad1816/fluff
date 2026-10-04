// ---------------------------------------------------------------------------
// Working fluffies (plan): train a grown fluffy of yours for a job.
//
// Right-click / long-press a grown fluffy of yours (smart enough:
// JOB_MIN_SMARTS) "Give it a job":
//   Foal-sitter  watches the foals in its room: goes to one that's crying,
//                frightened or miserable and comforts it ("Sh-sh, babbeh,
//                fwuffy hewe"), which ends a fright and cheers it up
//   Cleaner      tidies small messes in its room - pushes litter over the
//                puddles and wipes them up (and gets a bit grubby doing it)
// It learns by doing: each job done adds JOB_LEARN x how quick it is to
// learn (smartsLearn), and until it's trained (skill 1) it sometimes gets it
// wrong. A trained worker is worth more (JOB_PRICE). Same menu: change or
// stop its job. Saved: f.job = { kind, skill }.
// ---------------------------------------------------------------------------

const JOB_MIN_SMARTS = 35; // smartsScore
const JOB_LEARN = 0.08;
const JOB_PRICE = 0.2; // x(1 + this) when trained
const JOB_LOOK = 2.5; // seconds between looking for work
const JOB_REACH = 45; // px: close enough to do it
const JOB_SEE = 650; // px: work it notices
const JOBS = {
  sitter: { name: "Foal-sitter", what: "comforts crying and frightened foals in its room" },
  cleaner: { name: "Cleaner", what: "tidies small messes in its room" },
};

function jobOf(f) {
  return f && f.job && JOBS[f.job.kind] ? f.job : null;
}

function jobSkill(f) {
  const j = jobOf(f);
  return j ? Math.max(0, Math.min(1, j.skill || 0)) : 0;
}

function canHaveJob(f) {
  if (!f || !f.isAlive || !f.adopted || f.growth < 1) return false;
  return (typeof smartsScore === "function" ? smartsScore(f) : 50) >= JOB_MIN_SMARTS;
}

function setJob(f, kind) {
  if (!canHaveJob(f)) return false;
  if (!kind) {
    f.job = null;
    if (typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(f)} has stopped working.`);
    return true;
  }
  if (!JOBS[kind]) return false;
  const keep = jobOf(f) && f.job.kind === kind ? f.job.skill : 0;
  f.job = { kind, skill: keep };
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["JOB", "GIVEN"], f), true);
  if (typeof addUIMessage === "function") addUIMessage(`${fluffyDisplayName(f)} is learning to be a ${JOBS[kind].name.toLowerCase()}.`);
  return true;
}

function askJob(f) {
  if (!canHaveJob(f) || typeof openChoice !== "function") return false;
  const j = jobOf(f);
  openChoice({
    title: j ? `${fluffyDisplayName(f)}: ${JOBS[j.kind].name} (${Math.round(jobSkill(f) * 100)}%)` : `A job for ${fluffyDisplayName(f)}`,
    lines: Object.values(JOBS).map((d) => `${d.name}: ${d.what}.`).concat(["It learns by doing; a trained worker is worth more."]),
    buttons: [
      ...Object.entries(JOBS).map(([k, d]) => ({ label: d.name + (j && j.kind === k ? " ✓" : ""), kind: "ok", run: () => setJob(f, k) })),
      ...(j ? [{ label: "Stop working", run: () => setJob(f, null) }] : []),
      { label: "Cancel", cancel: true, run: () => {} },
    ],
  });
  return true;
}

function jobActions(f) {
  if (!canHaveJob(f)) return [];
  const j = jobOf(f);
  return [{ key: "job", name: j ? "Its job" : "Give it a job", sub: j ? `${JOBS[j.kind].name} ${Math.round(jobSkill(f) * 100)}%` : "foal-sitter, cleaner", run: (x) => askJob(x) }];
}
if (typeof FLUFFY_ACTION_SOURCES !== "undefined") FLUFFY_ACTION_SOURCES.push(jobActions);

function describeJob(f) {
  const j = jobOf(f);
  if (!j) return null;
  const s = jobSkill(f);
  return [`${JOBS[j.kind].name} - ${s >= 1 ? "trained" : `learning (${Math.round(s * 100)}%)`}`, "good"];
}
if (typeof INSPECT_ROWS !== "undefined") INSPECT_ROWS.push(["Job", "describeJob"]);

function jobPriceMultiplier(f) {
  return jobOf(f) && jobSkill(f) >= 1 ? 1 + JOB_PRICE : 1;
}
if (typeof PRICE_MULTIPLIERS !== "undefined") PRICE_MULTIPLIERS.push(jobPriceMultiplier);

function _jobLearn(f) {
  const j = jobOf(f);
  if (!j) return;
  const before = j.skill || 0;
  j.skill = Math.min(1, before + JOB_LEARN * (typeof smartsLearn === "function" ? smartsLearn(f) : 1));
  if (before < 1 && j.skill >= 1) {
    if (typeof addUIMessage === "function" && f.scene === currentScene) addUIMessage(`${fluffyDisplayName(f)} is a trained ${JOBS[j.kind].name.toLowerCase()} now.`);
    if (typeof recordStory === "function") recordStory("trick", f, { x: `work as a ${JOBS[j.kind].name.toLowerCase()}` });
  }
}

// ---- Finding work ----

function _foalNeedsSitter(w, k) {
  if (k === w || !k.isAlive || k.scene !== w.scene || k.growth >= 0.5 || k.isDragging || k.placedOn) return false;
  if (typeof cageTogether === "function" && !cageTogether(w, k)) return false;
  if (Math.hypot(k.x - w.x, k.y - w.y) > JOB_SEE) return false;
  const frightened = typeof isFrightened === "function" && isFrightened(k);
  const crying = k.expressionOverride === "CRYING_SHOCKED" || k.expressionOverride === "MISERABLE";
  return frightened || crying || k.happiness < 0.35;
}

function _messForCleaner(w) {
  if (typeof puddles === "undefined" || w.currentCage) return null;
  let best = null;
  let bd = JOB_SEE;
  for (const p of puddles) {
    if (p.scene !== w.scene || !(typeof isBodilyWaste === "function" ? isBodilyWaste(p.type || p.color) : true)) continue;
    for (const pt of p.points) {
      if ((pt.scale || 1) > 1.2) continue; // (small messes)
      // (not under a cage: it can't get in there)
      if (objects.some((o) => o instanceof Cage && o.scene === w.scene && pt.x > o.bounds.left && pt.x < o.bounds.right && pt.y > o.bounds.top && pt.y < o.bounds.bottom)) continue;
      const d = Math.hypot(pt.x - w.x, pt.y - w.y);
      if (d < bd) {
        bd = d;
        best = { puddle: p, pt };
      }
    }
  }
  return best;
}

function findJobTask(w) {
  const j = jobOf(w);
  if (!j) return null;
  if (j.kind === "sitter") {
    let best = null;
    let bd = Infinity;
    for (const k of fluffies) {
      if (!_foalNeedsSitter(w, k)) continue;
      const d = Math.hypot(k.x - w.x, k.y - w.y);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    return best ? { kind: "sitter", foalId: best.id } : null;
  }
  if (j.kind === "cleaner") {
    const m = _messForCleaner(w);
    return m ? { kind: "cleaner", puddle: m.puddle, pt: m.pt } : null;
  }
  return null;
}

function _jobTask(w) {
  const now = timePlayed;
  if (!w._jobLook || now - w._jobLook.at > JOB_LOOK || now < w._jobLook.at) w._jobLook = { at: now, task: findJobTask(w) };
  return w._jobLook.task;
}

// ---- Doing it ----

function doJobTask(w, task) {
  const skill = jobSkill(w);
  const ok = Math.random() < 0.45 + 0.55 * skill;
  const talk = !w.tooYoungToSpeak() && typeof getDialogue === "function";
  if (task.kind === "sitter") {
    const k = fluffyById(task.foalId);
    if (!k || !k.isAlive) return false;
    if (ok) {
      if (typeof endFright === "function") endFright(k);
      k.changeHappiness(0.1, "Comforted by the foal-sitter");
      k.expressionOverride = "GOOD_UPSIES";
      k.expressionOverrideTimer = 2.5;
      if (talk) w.speak(getDialogue(["JOB", "SITTER"], w, k), true);
    } else if (talk) w.speak(getDialogue(["JOB", "SITTER_FAIL"], w, k), true);
    _jobLearn(w);
    return true;
  }
  if (task.kind === "cleaner") {
    const p = task.puddle;
    const i = p && p.points ? p.points.indexOf(task.pt) : -1;
    if (i < 0) return false;
    p.shrinkPoint(i, ok ? 0.5 : 0.15, 0.1);
    if (typeof addDirt === "function") addDirt(w, 0.015);
    if (talk && Math.random() < 0.5) w.speak(getDialogue(["JOB", ok ? "CLEANER" : "CLEANER_FAIL"], w), true);
    _jobLearn(w);
    return true;
  }
  return false;
}

class JobDesire extends Desire {
  constructor() {
    super("Job");
  }
  evaluate(h) {
    if (!jobOf(h) || !h.isAlive || h.isDragging || h.placedOn || h.currentStateKey === "SLEEPING") return 0;
    if (h.hunger < 0.3 || (typeof isFrightened === "function" && isFrightened(h))) return 0;
    const t = _jobTask(h);
    if (!t) return 0;
    return t.kind === "sitter" ? 48 : 38;
  }
  execute(h) {
    const t = _jobTask(h);
    if (!t) return false;
    let tx;
    let ty;
    if (t.kind === "sitter") {
      const k = fluffyById(t.foalId);
      if (!k || !_foalNeedsSitter(h, k)) {
        h._jobLook = null;
        return false;
      }
      tx = k.x + (k.x > h.x ? -30 : 30);
      ty = k.y;
    } else {
      if (!t.puddle || t.puddle.points.indexOf(t.pt) < 0) {
        h._jobLook = null;
        return false;
      }
      tx = t.pt.x;
      ty = t.pt.y;
    }
    if (Math.hypot(tx - h.x, ty - h.y) > JOB_REACH) {
      if (!h.isMovingOrRunning()) h.initBehavior("MOVING");
      h.setTargetPosition(tx, ty);
      if (typeof h.constrainTargetToCage === "function") h.constrainTargetToCage();
      return true;
    }
    doJobTask(h, t);
    h._jobLook = { at: timePlayed, task: null }; // (a breather before the next)
    h.initBehavior("IDLE");
    return true;
  }
}
if (typeof EXTRA_DESIRES !== "undefined") EXTRA_DESIRES.push(JobDesire);
