// ---------------------------------------------------------------------------
// After surgery: rest, and the risk of the wound going bad.
//
// Every cut that takes a part off, and a stab with the knife (Surgery.js
// knifeCut), starts a recovery (f.recovery = { until, risk }, saved):
// RECOVERY_HOURS game hours in which the wound can get infected. How
// likely over the whole recovery (risk) depends on how it was done:
//                      on an operating table   anywhere else
//     scalpel                  3%                   12%
//     knife                   20%                   40%
// More cuts add up. Stitching the wound (SutureKit.js) halves what's left;
// burning it shut (CauteryIron.js) sterilises it - no infection at all.
// Resting (asleep, lying down, or in a bed) makes it far less likely while
// it rests (RECOVERY_REST); a filthy fluffy (Bath.js) more (RECOVERY_DIRTY).
//
// An infected wound (f.infection = { t }, saved) is a fever: it loses
// INFECTION_HEALTH_PER_DAY health a day (more for a foal), is miserable,
// and can die of it. It clears by itself after INFECTION_DAYS if it lives;
// the vet cures it (Vet.js vetProblems: "infected wound").
// The magnifying glass shows both ("Recovering from surgery: infection
// risk low - let it rest", "Infected wound: fever"), Today warns about an
// infection, and the surgery screen shows the risk so far.
// ---------------------------------------------------------------------------

const RECOVERY_HOURS = 12;
const RECOVERY_RISK = { scalpel: { table: 0.03, floor: 0.12 }, knife: { table: 0.2, floor: 0.4 } };
const RECOVERY_REST = 0.35; // risk while resting, x
const RECOVERY_DIRTY = 1.5; // risk while filthy, x
const INFECTION_HEALTH_PER_DAY = 50;
const INFECTION_DAYS = 2;
const recoveryTicker = new Ticker(5);

function _rcNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}

function _onTable(f) {
  return typeof OperatingTable !== "undefined" && f.placedOn instanceof OperatingTable;
}

// Surgery.js knifeCut: a wound that could go bad
function startRecovery(f, knife) {
  if (!f || !f.isAlive) return null;
  const tool = knife && knife.type === "scalpel" ? "scalpel" : "knife";
  const risk = RECOVERY_RISK[tool][_onTable(f) ? "table" : "floor"];
  const now = _rcNow();
  const r = f.recovery && f.recovery.until > now ? f.recovery : { until: now, risk: 0 };
  r.risk = 1 - (1 - r.risk) * (1 - risk);
  r.until = now + RECOVERY_HOURS * HOUR_LENGTH;
  f.recovery = r;
  return r;
}

function isRecovering(f) {
  return !!(f && f.isAlive && f.recovery && f.recovery.until > _rcNow());
}

// Stitched: half the risk; burnt shut: none
function woundStitched(f) {
  if (isRecovering(f)) f.recovery.risk *= 0.5;
}

function woundBurnt(f) {
  if (isRecovering(f)) f.recovery.risk = 0;
}

function isResting(f) {
  if (f.currentStateKey === "SLEEPING" || f.currentStateKey === "LYING") return true;
  return !!(f.claimedBed && f.claimedBed.scene === f.scene && Math.hypot(f.claimedBed.x - f.x, f.claimedBed.y - f.y) < 70);
}

function hasInfection(f) {
  return !!(f && f.infection);
}

function catchInfection(f) {
  if (!f || !f.isAlive || hasInfection(f)) return false;
  f.infection = { t: 0 };
  f.recovery = null;
  if (typeof recordStory === "function") recordStory("ill", f, { x: "an infected wound" });
  if (f.adopted && typeof addUIMessage === "function") addUIMessage(`${typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy"}'s wound is infected - it has a fever. The vet can treat it.`);
  return true;
}

function cureInfection(f) {
  if (f) f.infection = null;
}

// "low" / "medium" / "high"
function riskWord(risk) {
  return risk < 0.08 ? "low" : risk < 0.25 ? "medium" : "high";
}

// Magnifying glass: [text, tone] or null
function describeRecovery(f) {
  if (!f || !f.isAlive) return null;
  if (hasInfection(f)) return ["Infected wound: fever - needs the vet", "bad"];
  if (!isRecovering(f)) return null;
  const hrs = Math.max(1, Math.round((f.recovery.until - _rcNow()) / HOUR_LENGTH));
  if (f.recovery.risk <= 0) return [`Recovering from surgery (${hrs}h): wound burnt clean`, "ok"];
  const wrap = f.recovery.bandaged ? ", bandaged" : "";
  return [`Recovering from surgery (${hrs}h): infection risk ${riskWord(f.recovery.risk)}${wrap}${isResting(f) ? ", resting" : " - let it rest"}`, f.recovery.risk < 0.08 ? "ok" : "bad"];
}

function updateRecovery(dt) {
  const step = recoveryTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const now = _rcNow();
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    // A wound that might go bad
    if (f.recovery) {
      if (f.recovery.until <= now) f.recovery = null;
      else if (f.recovery.risk > 0) {
        // the whole risk spread over the recovery, more or less while resting or filthy
        let perStep = 1 - Math.pow(1 - f.recovery.risk, step / (RECOVERY_HOURS * HOUR_LENGTH));
        if (isResting(f)) perStep *= RECOVERY_REST;
        else if ((f.dirt || 0) > 0.6) perStep *= RECOVERY_DIRTY;
        if (Math.random() < perStep) catchInfection(f);
      }
    }
    // A fever
    if (f.infection) {
      f.infection.t += step;
      const rate = (INFECTION_HEALTH_PER_DAY * (f.growth < 1 ? 1.5 : 1) * step) / DAY_LENGTH;
      f.health -= rate;
      if (f.happiness > WAN_DIE_THRESHOLD + 0.1) f.changeHappiness((-0.04 * step) / HOUR_LENGTH);
      if (!f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING" && Math.random() < 0.003 * step && (!f.speech || !f.speech.text))
        f.speak(getDialogue(["INFECTION", "DEFAULT"], f));
      if (f.health <= 0) {
        f.health = 0;
        const mine = f.adopted;
        f.die(null, "An infected wound");
        if (mine && typeof addUIMessage === "function") addUIMessage(`${typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy"} died of an infected wound.`);
      } else if (f.infection.t >= INFECTION_DAYS * DAY_LENGTH) {
        f.infection = null; // (it pulled through)
      }
    }
  }
}
registerSystem("recovery", updateRecovery, 67);
