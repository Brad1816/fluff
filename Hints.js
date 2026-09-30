// ---------------------------------------------------------------------------
// First-time hints: the first time something new happens (a room gets a
// feeling, a fluffy wants something, a note from new owners, a debt...) a
// small card slides in at the top right saying what it is, with a button
// that opens the matching help page (Help.js). Each hint shows once.
//
// What's been seen is remembered for the player, not the save (browser
// storage, HINTS_STORE), so a new game doesn't repeat them. They can be
// switched off in the help screen ("Hints: on/off"). A card goes by itself
// after HINT_SHOW seconds, or with its x; it waits while a pop-up screen or
// the opening tip is up.
//
// HINTS below: key, the help topic, the text, and when (checked every
// HINT_CHECK seconds; only one card at a time, the rest wait their turn).
// ---------------------------------------------------------------------------

const HINTS_STORE = "fluffyHints";
const HINT_SHOW = 14; // seconds on screen
const HINT_CHECK = 2; // seconds between checks
const HINT_W = 340;

function _hOwn() {
  return typeof fluffies !== "undefined" ? fluffies.filter((f) => f.isAlive && f.adopted) : [];
}
function _hAny(test) {
  return _hOwn().some((f) => {
    try {
      return !!test(f);
    } catch (e) {
      return false;
    }
  });
}
function _hName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
}

const HINTS = [
  {
    key: "today",
    topic: "Getting started",
    when: () => typeof todayCounts === "function" && todayCounts().urgent > 0,
    text: () => "Something needs you. The Today button (or T) lists what's urgent, what's a chance, and what's going on in the house.",
  },
  {
    key: "room",
    topic: "How a room feels",
    when: () => typeof climateOf === "function" && typeof currentScene !== "undefined" && !["Calm", ""].includes(climateOf(currentScene).label || ""),
    text: () => `This room feels ${String(climateOf(currentScene).label).toLowerCase()} now. What happens in a room lingers for a day or two; hover the word under the room name to see why.`,
  },
  {
    key: "wish",
    topic: "Feelings, fears & wishes",
    when: () => _hAny((f) => f.wish && typeof wishText === "function" && wishText(f)),
    text: () => "One of your fluffies wants something. Right-click it to see the wish, grant it, or promise it for later.",
  },
  {
    key: "buyer",
    topic: "Selling & reputation",
    when: () => typeof currentSellRequest !== "undefined" && currentSellRequest && currentSellRequest.buyer !== "shady",
    text: () => "A buyer is at the door. Each kind wants something different; you can sell, ask for more, or send them away.",
  },
  {
    key: "shady",
    topic: "Selling & reputation",
    when: () => typeof currentSellRequest !== "undefined" && currentSellRequest && currentSellRequest.buyer === "shady",
    text: () => "A shady dealer. He pays a flat price, whatever the fluffy's like, and asks no questions, but families hear about who you sell to.",
  },
  {
    key: "memory",
    topic: "Stories, names & memories",
    when: () => typeof sharedMemories !== "undefined" && sharedMemories && (sharedMemories.list || []).length > 0,
    text: () => "Your fluffies will remember that together. Shared memories and each fluffy's life story are in the Memories book (Household).",
  },
  {
    key: "pregnant",
    topic: "Breeding & foals",
    when: () => _hAny((f) => f.isPregnant),
    text: () => "A fluffy is expecting. Keep her fed and warm; the vet can tell you more about the litter.",
  },
  {
    key: "party",
    topic: "Stories, names & memories",
    when: () => typeof partyOccasion === "function" && _hAny((f) => partyOccasion(f)),
    text: () => "There's something to celebrate. Right-click the fluffy to throw a party; the room will remember it.",
  },
  {
    key: "title",
    topic: "Titles & breaking",
    when: () => typeof titleOf === "function" && _hAny((f) => titleOf(f)),
    text: () => {
      const f = _hOwn().find((x) => titleOf(x));
      return `${_hName(f)} is now ${titleOf(f)}. Titles come from how a fluffy has been treated, and change how it behaves and what it's worth.`;
    },
  },
  {
    key: "broken",
    topic: "Titles & breaking",
    when: () => typeof titleOf === "function" && _hAny((f) => titleOf(f) === "Broken"),
    text: () => "A fluffy has broken. It won't play and barely feels happy. Weeks of gentle care can bring it back.",
  },
  {
    key: "strict",
    topic: "Tricks, lessons & care",
    when: () => typeof trainingStyle !== "undefined" && trainingStyle === "strict",
    text: () => "Strict training works through fear: faster at first, but it strains a fluffy, and the whole room feels it.",
  },
  {
    key: "scar",
    topic: "Health & age",
    when: () => _hAny((f) => (f.scars || []).length),
    text: () => "That will scar. Scars stay for life, lower the price, and cost points at shows. The magnifying glass says how each one happened.",
  },
  {
    key: "note",
    topic: "Selling & reputation",
    when: () => typeof keeperRep !== "undefined" && keeperRep && (keeperRep.notes || []).length > 0,
    text: () => "New owners wrote to you. Their notes build your name with families (shown in Household); a good name brings more and richer buyers.",
  },
  {
    key: "runaway",
    topic: "Fluffy Park",
    when: () => typeof weekStats !== "undefined" && weekStats && (weekStats.ranAway || 0) > 0,
    text: () => "A fluffy ran away. Miserable fluffies and Rebels make for the door: pick them up or comfort them in time and they stay. You may meet it again in the park.",
  },
  {
    key: "rent",
    topic: "Money trouble",
    when: () => typeof economy !== "undefined" && economy && (economy.rentLog || []).some((r) => r.rent > RENT_BASE),
    text: () => `The landlord has put your rent up to $${economy.rent} a day: it follows what you earn. Click your money (top left) to see your accounts.`,
  },
  {
    key: "debt",
    topic: "Money trouble",
    when: () => typeof billsOwed === "number" && billsOwed > 0,
    text: () => "You couldn't pay all the bills. Owe for a few days and the power gets cut, then the bailiffs come.",
  },
  {
    key: "letter",
    topic: "Money trouble",
    when: () => typeof inspector !== "undefined" && inspector && inspector.warned !== null && inspector.warned !== undefined,
    text: () => "The welfare inspector is coming. They'll look at the living room, the rooms either side and the backyard. Fines, or worse, for what they find.",
  },
  {
    key: "flu",
    topic: "Health & age",
    when: () => typeof hasFlu === "function" && _hAny((f) => hasFlu(f)),
    text: () => "A fluffy is sick. Flu spreads between fluffies close together; keep it warm and fed, or take it to the vet.",
  },
  {
    key: "elder",
    topic: "Health & age",
    when: () => typeof isElderly === "function" && _hAny((f) => isElderly(f)),
    text: () => "One of your fluffies is getting old. Elders calm a room, but slow down and need more care.",
  },
  {
    key: "night",
    topic: "Day, night & weather",
    when: () => typeof isNightTime === "function" && isNightTime(),
    text: () => "Night falls. Fluffies get sleepy and some are scared of the dark; a warm room and friends nearby help.",
  },
  {
    key: "park",
    topic: "Fluffy Park",
    when: () => typeof currentScene !== "undefined" && currentScene === "PARK",
    text: () => "The park. Drag the grass or use the wheel to look around. Wild herds live here; you can befriend or bring one home.",
  },
];

function freshHints() {
  return { seen: {}, off: false };
}
let hints = freshHints();
let hintsActive = true; // (tests switch hints off, as they do naming pop-ups)
let currentHint = null; // { key, text, topic, t }
let _hintCheckT = 0;

function _loadHints() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(HINTS_STORE) : null;
    const v = raw ? JSON.parse(raw) : null;
    if (v && typeof v === "object") hints = { seen: v.seen && typeof v.seen === "object" ? v.seen : {}, off: !!v.off };
  } catch (e) {
    hints = freshHints();
  }
}
function _saveHints() {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(HINTS_STORE, JSON.stringify(hints));
  } catch (e) {}
}
_loadHints();

function hintsOn() {
  return !hints.off;
}
function setHintsOn(on) {
  hints.off = !on;
  if (!on) currentHint = null;
  _saveHints();
}
function hintSeen(key) {
  return !!hints.seen[key];
}
// Forget what's been seen (all of them come back)
function resetHints() {
  hints.seen = {};
  currentHint = null;
  _saveHints();
}

// Show a hint now (once ever); false if it's been seen or hints are off
function showHint(key, text, topic) {
  if (hints.off || hints.seen[key]) return false;
  hints.seen[key] = Date.now();
  _saveHints();
  currentHint = { key, text, topic: topic || null, t: 0 };
  return true;
}

function _hintsBlocked() {
  if (typeof gameState !== "undefined" && gameState !== "PLAYING") return true;
  if (typeof isAnyScreenOpen === "function" && isAnyScreenOpen()) return true;
  if (typeof tutorialTimer !== "undefined" && tutorialTimer > 0) return true;
  return false;
}

// The first hint that's due and not yet seen
function nextDueHint() {
  for (const h of HINTS) {
    if (hints.seen[h.key]) continue;
    let due = false;
    try {
      due = !!h.when();
    } catch (e) {
      due = false;
    }
    if (due) return h;
  }
  return null;
}

function updateHints(dt) {
  if (!hintsActive || hints.off) return;
  if (currentHint) {
    // The clock only runs while you can see it, in real seconds (not sped up)
    if (!_hintsBlocked()) currentHint.t += dt / Math.max(1, typeof gameSpeed === "number" ? gameSpeed : 1);
    if (currentHint.t >= HINT_SHOW) currentHint = null;
    return;
  }
  _hintCheckT += dt;
  if (_hintCheckT < HINT_CHECK) return;
  _hintCheckT = 0;
  if (_hintsBlocked()) return;
  const h = nextDueHint();
  if (h) {
    let text = "";
    try {
      text = h.text();
    } catch (e) {
      text = "";
    }
    if (text) showHint(h.key, text, h.topic);
    else hints.seen[h.key] = Date.now();
  }
}

function getHintLayout(c) {
  if (!currentHint) return null;
  const w = Math.min(HINT_W, width - 24);
  const x = width - w - 12;
  // (below the park outing's banner when that's showing - ParkOutings.js)
  const y = typeof getOutingBanner === "function" && getOutingBanner() ? 176 : 128;
  let lines = [currentHint.text];
  if (c && typeof wrapText === "function") {
    c.save();
    c.font = "14px Arial";
    lines = wrapText(c, currentHint.text, w - 28);
    c.restore();
  }
  const h = 38 + lines.length * 19 + (currentHint.topic ? 42 : 12);
  return {
    x,
    y,
    w,
    h,
    lines,
    close: { x: x + w - 30, y: y + 6, w: 24, h: 24 },
    help: currentHint.topic ? { x: x + 14, y: y + h - 40, w: 140, h: 30 } : null,
    off: { x: x + w - 124, y: y + h - 40, w: 110, h: 30 },
  };
}
let _hintLayoutCache = null;

// Drawn after the pop-up screens (UI.js), only when none is open
function drawHints(c) {
  _hintLayoutCache = null;
  if (!currentHint || !hintsActive || _hintsBlocked()) return;
  const L = getHintLayout(c);
  _hintLayoutCache = L;
  const fadeIn = Math.min(1, currentHint.t / 0.3);
  const fadeOut = Math.min(1, (HINT_SHOW - currentHint.t) / 0.8);
  c.save();
  c.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
  c.fillStyle = "rgba(40, 24, 48, 0.92)";
  if (typeof fillRoundRect === "function") fillRoundRect(c, L.x, L.y, L.w, L.h, 12);
  else c.fillRect(L.x, L.y, L.w, L.h);
  c.strokeStyle = "rgba(255, 190, 230, 0.8)";
  c.lineWidth = 2;
  c.beginPath();
  if (c.roundRect) c.roundRect(L.x, L.y, L.w, L.h, 12);
  else c.rect(L.x, L.y, L.w, L.h);
  c.stroke();
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.fillStyle = "#f7d774";
  c.font = "bold 14px Arial";
  c.fillText("New!" + (currentHint.topic ? `  ${currentHint.topic}` : ""), L.x + 14, L.y + 24);
  c.fillStyle = "rgba(255,255,255,0.92)";
  c.font = "14px Arial";
  L.lines.forEach((line, i) => c.fillText(line, L.x + 14, L.y + 46 + i * 19));
  // x
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.font = "bold 16px Arial";
  c.textAlign = "center";
  c.fillText("×", L.close.x + L.close.w / 2, L.close.y + 17);
  c.textAlign = "left";
  // Time left
  c.fillStyle = "rgba(255, 190, 230, 0.5)";
  c.fillRect(L.x + 12, L.y + L.h - 5, (L.w - 24) * Math.max(0, 1 - currentHint.t / HINT_SHOW), 2);
  if (typeof drawGlassButton === "function") {
    if (L.help) drawGlassButton(L.help.x, L.help.y, L.help.w, L.help.h, "Read more", { fontSize: 14, borderRadius: 8 });
    drawGlassButton(L.off.x, L.off.y, L.off.w, L.off.h, "No more hints", { fontSize: 12, borderRadius: 8 });
  }
  c.restore();
}

// Mouse down (UI.js, right after the pop-up screens): true if the card used it
function hintClick() {
  if (!currentHint || !hintsActive || _hintsBlocked()) return false;
  const L = _hintLayoutCache || getHintLayout(typeof ctx !== "undefined" ? ctx : null);
  if (!L) return false;
  const hit = (r) => r && isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h);
  if (!hit(L)) return false;
  if (hit(L.help)) {
    const topic = currentHint.topic;
    currentHint = null;
    if (typeof openHelpAt === "function") openHelpAt(topic);
  } else if (hit(L.off)) {
    setHintsOn(false);
    if (typeof addUIMessage === "function") addUIMessage("Hints are off. Turn them back on in the help screen (?).");
  } else if (hit(L.close)) {
    currentHint = null;
  }
  return true; // the card swallows clicks on it
}

registerSystem("hints", updateHints, 900);
