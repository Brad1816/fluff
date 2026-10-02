// ---------------------------------------------------------------------------
// "No mating": you can tell a grown fluffy not to have special huggies.
//
// Right-click it: "No mating" (and "Allow mating" to lift it). From then on,
// each time it (or its special friend, if that's the one told) is about to
// mate, it may hold off (ruleObeyChance: more likely the more it trusts
// you - or fears you - and the more often it's been disciplined for it).
// Holding off, it waits RULE_REFRAIN_REST before it's tempted again.
//
// If it mates anyway (willingly - not forced by a Smarty or by you) that's
// a breach: you're told, and for RULE_BREACH_WINDOW a "Discipline" button
// is in its right-click menu. Each time you use it the step gets harsher
// (RULE_STEPS, by f.mateRule.strikes):
//   1. a scolding (Care.js)          2. a time-out (Care.js)
//   3. the stick (a lesson, Memory)  4. spayed / neutered (asked first,
//                                       RULE_FIX_FEE at the vet's)
// Each step makes it likelier to obey next time (RULE_OBEY_PER_STRIKE).
// Shown in the magnifying glass (Mind, "Mating").
// Saved: f.mateRule = { on, breaches, strikes, pendingAt }.
// ---------------------------------------------------------------------------

const RULE_REFRAIN_REST = HOUR_LENGTH; // game seconds before it's tempted again
const RULE_BREACH_WINDOW = DAY_LENGTH; // how long you have to discipline a breach
const RULE_OBEY_BASE = 0.45;
const RULE_OBEY_PER_STRIKE = 0.12;
const RULE_FIX_FEE = 60;
const RULE_STEPS = [
  { key: "scold", name: "Scold" },
  { key: "timeout", name: "Time-out" },
  { key: "stick", name: "The stick" },
  { key: "fix", name: "Spay / neuter" },
];

function _mrName(f) {
  return (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || (typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Fluffy");
}

function mateRuleOf(f) {
  if (!f.mateRule || typeof f.mateRule !== "object") f.mateRule = { on: false, breaches: 0, strikes: 0, pendingAt: null };
  return f.mateRule;
}

function toldNotToMate(f) {
  return !!(f && f.mateRule && f.mateRule.on);
}

function setMatingRule(f, on) {
  const r = mateRuleOf(f);
  r.on = !!on;
  if (!on) r.pendingAt = null;
  if (typeof addUIMessage === "function") addUIMessage(on ? `You tell ${_mrName(f)}: no special huggies.` : `${_mrName(f)} can have special huggies again.`);
  if (on && !f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING" && typeof getDialogue === "function") f.speak(getDialogue(["MATE_RULE", "TOLD"], f), true);
  return r.on;
}

// How likely it holds off this time
function ruleObeyChance(f) {
  const r = mateRuleOf(f);
  let p = RULE_OBEY_BASE + 0.3 * (f.playerTrust ?? 0.5) + 0.3 * (f.playerFear || 0) + RULE_OBEY_PER_STRIKE * (r.strikes || 0);
  if (typeof titleOf === "function" && titleOf(f) === "Rebel") p *= 0.5; // (Titles.js)
  if (f.isUnderAphrodisiac && f.isUnderAphrodisiac()) p *= 0.3;
  return Math.max(0.1, Math.min(0.95, p));
}

// MateDesire, before it starts: does one of them hold off? Returns the one
// who does (it says so, and he waits a while), or null
function ruleStopsMating(male, mare) {
  for (const f of [male, mare]) {
    if (!toldNotToMate(f)) continue;
    if (Math.random() < ruleObeyChance(f)) {
      male.specialHuggiesCooldown = Math.max(male.specialHuggiesCooldown || 0, RULE_REFRAIN_REST);
      if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["MATE_RULE", "HOLDS_OFF"], f), true);
      return f;
    }
  }
  return null;
}

// HorseMating.finishMating: they did it anyway
function noteMatingBreach(f) {
  if (!toldNotToMate(f)) return false;
  const r = mateRuleOf(f);
  r.breaches = (r.breaches || 0) + 1;
  r.pendingAt = timePlayed;
  const n = _mrName(f);
  const step = RULE_STEPS[Math.min(r.strikes || 0, RULE_STEPS.length - 1)];
  if (f.adopted && typeof addUIMessage === "function") addUIMessage(`${n} broke your no-mating rule${r.breaches > 1 ? ` (${r.breaches} times now)` : ""}. Right-click: Discipline (${step.name.toLowerCase()}).`);
  if (f.adopted && typeof noteDayEvent === "function") noteDayEvent("news", { text: `${n} broke the no-mating rule` });
  return true;
}

function breachPending(f) {
  const r = f && f.mateRule;
  if (!r || r.pendingAt === null || r.pendingAt === undefined) return false;
  const now = timePlayed;
  if (now < r.pendingAt || now - r.pendingAt > RULE_BREACH_WINDOW) {
    r.pendingAt = null;
    return false;
  }
  return true;
}

function nextRuleStep(f) {
  return RULE_STEPS[Math.min(mateRuleOf(f).strikes || 0, RULE_STEPS.length - 1)];
}

// The Discipline button: the next step. Returns the step's key, or null
function disciplineMating(f) {
  if (!breachPending(f)) return null;
  const r = mateRuleOf(f);
  const step = nextRuleStep(f);
  const n = _mrName(f);
  if (step.key === "fix") {
    const he = f.gender === "male";
    openChoice({
      title: `Have ${n} ${he ? "neutered" : "spayed"}?`,
      lines: [
        `${n} has broken the no-mating rule ${r.breaches} time${r.breaches === 1 ? "" : "s"}.`,
        `${he ? "He" : "She"}'ll never have foals again. It costs $${RULE_FIX_FEE} at the vet's, it hurts, and ${he ? "he" : "she"} won't forget it.`,
      ],
      buttons: [
        { label: he ? "Neuter him" : "Spay her", kind: "danger", run: () => fixFluffy(f) },
        { label: "Not yet", cancel: true, run: () => {} },
      ],
    });
    return "ask";
  }
  if (step.key === "scold" && typeof scoldFluffy === "function") scoldFluffy(f);
  else if (step.key === "timeout" && typeof timeOut === "function") timeOut(f);
  else if (step.key === "stick") {
    // A lesson with the stick: it knows what it was for
    if (typeof notifyViolence === "function") notifyViolence(f, false, "stick", true);
    f.changeHappiness(typeof HAPPINESS_PENALTY_STICK_WHACK === "number" ? HAPPINESS_PENALTY_STICK_WHACK : -0.1);
    f.expressionOverride = "CRYING_SHOCKED";
    f.expressionOverrideTimer = 3;
    if (typeof playSound === "function") playSound("sorry_stick");
  }
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["MATE_RULE", "SORRY"], f), true);
  r.strikes = (r.strikes || 0) + 1;
  r.pendingAt = null;
  return step.key;
}

// The last step: spayed or neutered (at the vet's)
function fixFluffy(f) {
  const r = mateRuleOf(f);
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < RULE_FIX_FEE) {
    if (typeof addUIMessage === "function") addUIMessage(`Not enough money ($${RULE_FIX_FEE}).`);
    return false;
  }
  if (!free) money -= RULE_FIX_FEE;
  const lost = f.gender === "male" ? f.amputate("lumps") : f.amputate("spay");
  f.changeHappiness(-0.15);
  f.playerTrust = Math.max(0, (f.playerTrust ?? 0.5) - 0.1);
  if (f.renderer) f.renderer.tinted = null; // (drawn again without them)
  r.strikes = (r.strikes || 0) + 1;
  r.pendingAt = null;
  r.on = false; // (no need now)
  if (typeof addUIMessage === "function") addUIMessage(`${_mrName(f)} was ${f.gender === "male" ? "neutered" : "spayed"}. No more foals.`);
  return !!lost;
}

// Right-click (Tricks.rightClickActions): set or lift the rule, and
// discipline a breach
function matingRuleActions(f) {
  if (!f || !f.isAlive || !f.adopted || f.growth < 1) return [];
  const fixed = f.gender === "male" ? !(f.limbs && f.limbs.lumps) : !!f.spayed;
  const out = [];
  if (breachPending(f)) {
    const step = nextRuleStep(f);
    out.push({ key: "mate_discipline", name: "Discipline", sub: `${step.name.toLowerCase()} (mated)`, harsh: true, run: (x) => disciplineMating(x) });
  }
  if (fixed) return out;
  if (toldNotToMate(f)) out.push({ key: "mate_allow", name: "Allow mating", sub: "lift the rule", run: (x) => setMatingRule(x, false) });
  else out.push({ key: "mate_rule", name: "No mating", sub: "tell it not to", run: (x) => setMatingRule(x, true) });
  return out;
}

// Magnifying glass: [text, tone] or null
function describeMatingRule(f) {
  const r = f && f.mateRule;
  if (!r || (!r.on && !r.breaches)) return null;
  const parts = [r.on ? "Told not to mate" : "Was told not to mate"];
  if (r.breaches) parts.push(`broke it ${r.breaches === 1 ? "once" : `${r.breaches} times`}`);
  if (r.on) parts.push(`obeys ${Math.round(ruleObeyChance(f) * 100)}% of the time`);
  if (breachPending(f)) parts.push(`next: ${nextRuleStep(f).name.toLowerCase()}`);
  return [parts.join(" · "), r.breaches ? "bad" : "ok"];
}
