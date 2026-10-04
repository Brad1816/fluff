// ---------------------------------------------------------------------------
// Wet after a bath (plan): a fluffy that's been bathed, sprinkled or rained
// on stays wet a while (f.wet, 0..1, saved).
//
// Getting wet: a bath (Bath.scrubFluffy: soaked), the sprinkler's spray,
// rain outdoors when it isn't under cover (a cage, a box).
// Drying off by itself: WET_DRY_TIME game seconds from soaked, twice as fast
// by a running heater or on a hot summer day, half as fast in the cold.
// While it's wet:
//   - the cold bites harder (Warmth.warmthExposure x up to WET_EXPOSURE)
//   - it's miserable when it's cold (WET_SAD a game hour x how wet), a
//     little when it's not, and says so ("Fwuffy aww wet... cowd...")
//   - drips, and looks a bit flat
// Drying it (right-click / long-press, or Actions):
//   Towel it       gentle: most of the wet off, and it likes the fuss (a
//                  little affection, "towelled")
//   Hair dryer     dry at once, but loud: a fright, and a little afraid of
//                  you (a brave one shrugs it off)
//   Peg on a line  quick and dry, and terrifying: hung up by its fluff, it
//                  screams; afraid of you, unhappy, it remembers ("pegged")
// ---------------------------------------------------------------------------

const WET_DRY_TIME = 1.5 * HOUR_LENGTH; // game seconds, soaked to dry
const WET_EXPOSURE = 1.8; // cold exposure x this when soaked
const WET_SAD = 0.06; // happiness a game hour, soaked and cold
const WET_RAIN = 0.4; // wet a game hour in full rain
const PEG_TIME = 6; // game seconds on the line
const wetTicker = new Ticker(1);

if (typeof MEMORY_TEXT !== "undefined") Object.assign(MEMORY_TEXT, { pegged: "Hung on the washing line", hair_dryer: "Blasted with the hair dryer" });
if (typeof MEMORY_HARM_TYPES !== "undefined") MEMORY_HARM_TYPES.add("pegged");
if (typeof AFFECTION_ACTS !== "undefined") AFFECTION_ACTS.towelled = { amount: 0.03, perDay: 3 };

function wetOf(f) {
  return f && typeof f.wet === "number" ? Math.max(0, Math.min(1, f.wet)) : 0;
}

function soakFluffy(f, amount = 1) {
  if (!f || !f.isAlive) return;
  f.wet = Math.min(1, Math.max(wetOf(f), amount));
}

// Warmth.warmthExposure
function wetExposure(f) {
  return 1 + (WET_EXPOSURE - 1) * wetOf(f);
}

function _wetDrySpeed(f) {
  let k = 1;
  if (typeof heatersIn === "function" && heatersIn(f.scene).some((h) => h.on !== false)) k *= 2;
  const cold = typeof placeColdness === "function" ? placeColdness(f.scene) : 0;
  if (cold > 0.3) k *= 0.5;
  const heat = typeof placeHeat === "function" ? placeHeat(f.scene) : 0;
  if (heat > 0.3) k *= 2;
  return k;
}

function updateWetFur(dt) {
  const step = wetTicker.step(dt);
  if (!step || typeof fluffies === "undefined") return;
  const hours = step / HOUR_LENGTH;
  const rain = typeof rainAmount === "function" ? rainAmount() : 0;
  for (const f of fluffies) {
    if (!f.isAlive) continue;
    // Rain: outdoors, not under cover
    if (rain > 0 && typeof isOutdoorScene === "function" && isOutdoorScene(f.scene) && !f.currentCage && !(f.claimedBed && f.currentStateKey === "SLEEPING")) {
      f.wet = Math.min(1, wetOf(f) + WET_RAIN * rain * hours);
    }
    // On the line
    if (f._pegged) {
      if (timePlayed - f._pegged.at >= PEG_TIME || timePlayed < f._pegged.at || f.isDragging) {
        f._pegged = null;
        f.wet = 0;
      } else continue;
    }
    if (!(wetOf(f) > 0)) continue;
    const drying = rain > 0 && typeof isOutdoorScene === "function" && isOutdoorScene(f.scene) && !f.currentCage ? 0 : _wetDrySpeed(f);
    f.wet = Math.max(0, wetOf(f) - (step / WET_DRY_TIME) * drying);
    if (!f.adopted || f.wet <= 0.05) {
      if (f.wet <= 0.05) f.wet = 0;
      continue;
    }
    const cold = typeof placeColdness === "function" ? placeColdness(f.scene) : 0;
    f.changeHappiness(-(cold > 0.1 ? WET_SAD : WET_SAD * 0.25) * f.wet * hours, "Wet through");
    if (f.scene === currentScene && f.wet > 0.4 && Math.random() < 0.04 * step && !f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING" && typeof getDialogue === "function") {
      f.speak(getDialogue(["WET", cold > 0.1 ? "COLD" : "DEFAULT"], f));
    }
  }
}
registerSystem("wetFur", updateWetFur, 140);

// ---- Drying ----

function towelFluffy(f) {
  if (!f || !(wetOf(f) > 0)) return false;
  f.wet = Math.max(0, wetOf(f) - 0.7);
  f.changeHappiness(0.03, "Towelled dry");
  if (typeof giveAffection === "function") giveAffection(f, "towelled");
  f.expressionOverride = "GOOD_UPSIES";
  f.expressionOverrideTimer = 2;
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["WET", "TOWEL"], f), true);
  return true;
}

function hairDryFluffy(f) {
  if (!f || !(wetOf(f) > 0)) return false;
  f.wet = 0;
  const brave = typeof traitValue === "function" ? traitValue(f, "bravery") : 0;
  if (brave < 0.3) {
    if (typeof changePlayerFear === "function") changePlayerFear(f, 0.03);
    f.changeHappiness(-0.04, "The loud hair dryer");
    f.expressionOverride = "CRYING_SHOCKED";
    f.expressionOverrideTimer = 2.5;
    if (typeof rememberPlayerEvent === "function") rememberPlayerEvent(f, "hair_dryer");
    if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["WET", "DRYER"], f), true);
  } else if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["WET", "TOWEL"], f), true);
  if (typeof playSound === "function") playSound("taser", 0.15, 0.6);
  return true;
}

function pegFluffy(f) {
  if (!f || !(wetOf(f) > 0) || f._pegged) return false;
  f._pegged = { at: timePlayed };
  f.initBehavior && f.initBehavior("IDLE");
  if (typeof changePlayerFear === "function") changePlayerFear(f, 0.1);
  if (typeof changePlayerTrust === "function") changePlayerTrust(f, -0.05);
  f.changeHappiness(-0.15, "Pegged on the washing line");
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = PEG_TIME;
  if (typeof rememberPlayerEvent === "function") rememberPlayerEvent(f, "pegged");
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["WET", "PEGGED"], f), true);
  return true;
}

function askDryFluffy(f) {
  if (typeof openChoice !== "function") return towelFluffy(f);
  const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "It";
  openChoice({
    title: `Dry ${name}`,
    lines: ["Towel: gentle, it likes the fuss. Hair dryer: dry at once, but loud.", "Peg it on the line: quick, and terrifying."],
    buttons: [
      { label: "Towel", kind: "ok", run: () => towelFluffy(f) },
      { label: "Hair dryer", run: () => hairDryFluffy(f) },
      { label: "Peg it up", kind: "danger", run: () => pegFluffy(f) },
      { label: "Leave it", cancel: true, run: () => {} },
    ],
  });
  return true;
}

function wetActions(f) {
  if (!f || !f.isAlive || !f.adopted || !(wetOf(f) > 0.1) || f._pegged) return [];
  return [{ key: "dry", name: "Dry it", sub: `${Math.round(wetOf(f) * 100)}% wet`, run: (x) => askDryFluffy(x) }];
}
if (typeof FLUFFY_ACTION_SOURCES !== "undefined") FLUFFY_ACTION_SOURCES.push(wetActions);

function describeWet(f) {
  const w = wetOf(f);
  if (!(w > 0.05)) return null;
  if (f._pegged) return ["Hung on the line to dry", "bad"];
  return [w > 0.66 ? "Soaked" : w > 0.33 ? "Wet" : "Damp", "ok"];
}
if (typeof INSPECT_ROWS !== "undefined") INSPECT_ROWS.push(["Wet", "describeWet"]);

// Horse.drawOffScreen: drips (and pegs, on the line)
function drawWetDrips(c, f) {
  const w = wetOf(f);
  if (!(w > 0.05) || !f.isAlive) return;
  const t = typeof timePlayed === "number" ? timePlayed : 0;
  const size = 0.6 + 0.4 * Math.min(1, f.growth || 1);
  c.save();
  c.fillStyle = "rgba(90, 160, 255, 0.85)";
  c.strokeStyle = "rgba(255, 255, 255, 0.7)";
  c.lineWidth = 1;
  const n = Math.ceil(w * 7);
  for (let i = 0; i < n; i++) {
    const fall = ((t * 60 + i * 23 + f.id * 7) % 30) * size;
    const x = f.x - 25 * size + ((i * 17 + f.id * 3) % 50) * size;
    const y = f.y - 30 * size + fall;
    c.beginPath();
    c.ellipse(x, y, 2.4, 3.8, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  if (f._pegged) {
    // The pegs and the line
    c.strokeStyle = "rgba(240,240,240,0.9)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(f.x - 60, f.y - 70 * size);
    c.lineTo(f.x + 60, f.y - 70 * size);
    c.stroke();
    c.fillStyle = "#c98d4a";
    c.fillRect(f.x - 14, f.y - 74 * size, 5, 14);
    c.fillRect(f.x + 9, f.y - 74 * size, 5, 14);
  }
  c.restore();
}
