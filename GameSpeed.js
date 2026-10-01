// ---------------------------------------------------------------------------
// Fast forward: run the game clock at 1x, 2x, 4x or 8x.
//
// Everything in the game follows the game clock (timePlayed / gameTimeMs),
// so at 4x fluffies get hungry, grow, sleep, breed and fight 4 times as
// fast. Screen things (the camera, menus, the fade between areas) stay at
// normal speed.
//
// How: script.js animate() runs extra simulation steps each frame
// (runFastForward). On a slow computer or a very busy park it won't manage
// the full speed in the time of one frame; it then runs as fast as it can
// (the clock shows the real speed in that case).
//
// Controls: the buttons next to "Chat Log", or F to go to the next speed.
// Resets to 1x on a new game or load.
// ---------------------------------------------------------------------------

const GAME_SPEEDS = [1, 2, 4, 8];
let gameSpeed = 1;
let actualGameSpeed = 1; // what we managed last frame (shown when it's behind)
const FAST_FORWARD_BUDGET_MS = 25; // at most this much work per frame
const FAST_FORWARD_STEP = 1 / 30; // game seconds per step at 2x and up

function setGameSpeed(s) {
  if (GAME_SPEEDS.includes(s)) gameSpeed = s;
}

function nextGameSpeed() {
  const i = GAME_SPEEDS.indexOf(gameSpeed);
  gameSpeed = GAME_SPEEDS[(i + 1) % GAME_SPEEDS.length];
}

// Called by animate() after the normal step(s), with the real time passed
function runFastForward(realElapsed, fixedStep) {
  if (gameSpeed <= 1 || gameState !== "PLAYING" || transitionPhase !== "OFF") {
    actualGameSpeed = gameState === "PLAYING" ? 1 : actualGameSpeed;
    return;
  }
  let extra = realElapsed * (gameSpeed - 1);
  const want = extra;
  const deadline = performance.now() + FAST_FORWARD_BUDGET_MS;
  while (extra > 1e-9 && performance.now() < deadline && gameState === "PLAYING") {
    // (bigger steps when going fast: half the work for the same game time;
    // the long test games ran on these for 40 days without trouble)
    const dt = Math.min(extra, Math.max(fixedStep, FAST_FORWARD_STEP));
    updateSimulation(dt);
    extra -= dt;
  }
  if (realElapsed > 0) {
    const done = want - Math.max(0, extra);
    // Smooth it out so the number doesn't flicker
    const now = 1 + done / realElapsed;
    actualGameSpeed = actualGameSpeed * 0.9 + now * 0.1;
  }
}

// "1:05:30" style game clock
function formatGameClock(seconds) {
  const t = Math.floor(Math.max(0, seconds || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ---- The clock and speed buttons (top left, next to "Chat Log") ----

// How squeezed the top bar is: 0 = room for everything, 1 = short labels,
// 2 = short labels and a narrower clock (small windows)
const TOP_BAR_WIDTHS = [
  { clock: 150, goals: 92, records: 76, today: 96, household: 100 },
  { clock: 150, goals: 58, records: 70, today: 64, household: 90 },
  { clock: 118, goals: 50, records: 64, today: 58, household: 84 },
];
function _topBarEnds(chatLogRight, w) {
  // left group: clock, 4 speeds, goals, records, help; right group: today, household
  const left = chatLogRight + 8 + w.clock + 4 + GAME_SPEEDS.length * 37 - 3 + 8 + w.goals + 6 + w.records + 6 + 30;
  const right = width - 12 - w.household - 6 - w.today;
  return { left, right };
}
function topBarSqueeze(chatLogRight) {
  for (let i = 0; i < TOP_BAR_WIDTHS.length; i++) {
    const e = _topBarEnds(chatLogRight, TOP_BAR_WIDTHS[i]);
    if (e.left + 8 <= e.right) return i;
  }
  return TOP_BAR_WIDTHS.length - 1;
}
function topBarWidths(chatLogRight) {
  return TOP_BAR_WIDTHS[topBarSqueeze(chatLogRight)];
}

function getGameSpeedLayout(chatLogRight) {
  const x = chatLogRight + 8;
  const y = 50;
  const clockW = topBarWidths(chatLogRight).clock;
  const btnW = 34;
  const h = 30;
  const buttons = GAME_SPEEDS.map((s, i) => ({ speed: s, x: x + clockW + 4 + i * (btnW + 3), y, w: btnW, h }));
  return { x, y, clockW, h, buttons };
}

function drawGameSpeed(chatLogRight) {
  const L = getGameSpeedLayout(chatLogRight);
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(L.x, L.y, L.clockW, L.h, 8);
    ctx.fill();
  } else {
    ctx.fillRect(L.x, L.y, L.clockW, L.h);
  }
  ctx.fillStyle = "white";
  ctx.font = L.clockW < 150 ? "bold 12px Arial" : "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Day and time of day (WorldTime.js), or the plain game time
  const clockText = typeof describeWorldTime === "function" ? describeWorldTime() : formatGameClock(timePlayed);
  ctx.fillText(clockText, L.x + L.clockW / 2, L.y + L.h / 2 + 1);
  // Season and weather underneath (not while the chat log is open there)
  if (typeof describeWeather === "function" && !(typeof showChatLog !== "undefined" && showChatLog)) {
    ctx.font = "bold 12px Arial";
    // On a narrow window it shortens (no season, then just the weather)
    // rather than running into the room's name (UIScenes.js houseLabelLeft)
    const limit = typeof houseLabelLeft === "number" ? houseLabelLeft - 8 : Infinity;
    const cx = L.x + L.clockW / 2;
    const full = describeWeather();
    const parts = full.split(" · ");
    let text = full;
    for (const t of [full, parts.slice(1).join(" · "), parts[1] || ""]) {
      text = t;
      if (cx + ctx.measureText(t).width / 2 <= limit) break;
    }
    if (text && cx + ctx.measureText(text).width / 2 <= limit) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillText(text, cx + 1, L.y + L.h + 12);
      ctx.fillStyle = "white";
      ctx.fillText(text, cx, L.y + L.h + 11);
    }
  }
  ctx.restore();

  for (const b of L.buttons) {
    const on = b.speed === gameSpeed;
    drawGlassButton(b.x, b.y, b.w, b.h, `${b.speed}x`, {
      fontSize: 13,
      borderRadius: 8,
      normalFill: on ? "rgba(255, 170, 0, 0.55)" : "rgba(0, 0, 0, 0.1)",
      borderColor: on ? "rgba(255, 210, 120, 0.95)" : undefined,
    });
  }
  // Goals button (Goals.js)
  const gb = getGoalsButtonRect(chatLogRight);
  if (typeof GOALS !== "undefined" && typeof drawGlassButton === "function") {
    const goalsText = `${goalsDoneCount()}/${GOALS.length}`;
    drawGlassButton(gb.x, gb.y, gb.w, gb.h, topBarSqueeze(chatLogRight) ? goalsText : `Goals ${goalsText}`, {
      fontSize: 13,
      borderRadius: 8,
      normalFill:
        typeof isGoalsOpen === "function" && isGoalsOpen() ? "rgba(255, 170, 220, 0.35)" : "rgba(0, 0, 0, 0.1)",
    });
  }
  // Help button (Help.js)
  const rb = getRecordsButtonRect(chatLogRight);
  if (typeof openRecords === "function" && typeof drawGlassButton === "function") {
    drawGlassButton(rb.x, rb.y, rb.w, rb.h, "Records", {
      fontSize: topBarSqueeze(chatLogRight) > 1 ? 12 : 13,
      borderRadius: 8,
      normalFill: isRecordsOpen() ? "rgba(255, 170, 220, 0.35)" : "rgba(0, 0, 0, 0.1)",
    });
  }
  // Household button (Household.js)
  const ob = getHouseholdButtonRect(chatLogRight);
  if (typeof openHousehold === "function" && typeof drawGlassButton === "function") {
    drawGlassButton(ob.x, ob.y, ob.w, ob.h, "Household", {
      fontSize: topBarSqueeze(chatLogRight) > 1 ? 12 : 13,
      borderRadius: 8,
      normalFill: isHouseholdOpen() ? "rgba(255, 170, 220, 0.35)" : "rgba(0, 0, 0, 0.1)",
    });
  }
  // Today: what needs you (Today.js)
  if (typeof drawTodayButton === "function" && typeof drawGlassButton === "function") drawTodayButton(ctx, chatLogRight);
  const hb = getHelpButtonRect(chatLogRight);
  if (typeof openHelp === "function" && typeof drawGlassButton === "function") {
    drawGlassButton(hb.x, hb.y, hb.w, hb.h, "?", {
      fontSize: 16,
      borderRadius: 8,
      normalFill: isHelpOpen() ? "rgba(255, 170, 220, 0.35)" : "rgba(0, 0, 0, 0.1)",
    });
  }
  // Can't keep up? Say how fast it really is
  // (only when there's room before the Today button)
  const reallyText = `(really ${actualGameSpeed.toFixed(1)}x)`;
  ctx.save();
  ctx.font = "12px Arial";
  const reallyFits =
    typeof getTodayButtonRect !== "function" || hb.x + hb.w + 6 + ctx.measureText(reallyText).width + 6 <= getTodayButtonRect(chatLogRight).x;
  ctx.restore();
  if (gameSpeed > 1 && actualGameSpeed < gameSpeed - 0.5 && reallyFits) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 220, 150, 0.95)";
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(reallyText, hb.x + hb.w + 6, L.y + L.h / 2);
    ctx.restore();
  }
}

// The Goals button, after the speed buttons
function getGoalsButtonRect(chatLogRight) {
  const L = getGameSpeedLayout(chatLogRight);
  const last = L.buttons[L.buttons.length - 1];
  return { x: last.x + last.w + 8, y: L.y, w: topBarWidths(chatLogRight).goals, h: L.h };
}

// The "Records" button, after Goals (BreedingRecords.js)
function getRecordsButtonRect(chatLogRight) {
  const gb = getGoalsButtonRect(chatLogRight);
  return { x: gb.x + gb.w + 6, y: gb.y, w: topBarWidths(chatLogRight).records, h: gb.h };
}

// The "Household" button (Household.js): top right, clear of the front door
function getHouseholdButtonRect(chatLogRight) {
  const rb = getRecordsButtonRect(chatLogRight);
  const w = topBarWidths(chatLogRight).household;
  return { x: width - w - 12, y: rb.y, w, h: rb.h };
}

// The "?" help button, after Records
function getHelpButtonRect(chatLogRight) {
  const rb = getRecordsButtonRect(chatLogRight);
  return { x: rb.x + rb.w + 6, y: rb.y, w: 30, h: rb.h };
}

// Mouse down on the buttons (screen positions). Returns true if handled.
function gameSpeedClick(chatLogRight) {
  const hb = getHelpButtonRect(chatLogRight);
  if (typeof openHelp === "function" && isPointInRect(mouse.x, mouse.y, hb.x, hb.y, hb.w, hb.h)) {
    if (isHelpOpen()) closeHelp();
    else openHelp();
    return true;
  }
  if (typeof todayButtonClick === "function" && todayButtonClick(chatLogRight)) return true; // (Today.js)
  const ob = getHouseholdButtonRect(chatLogRight);
  if (typeof openHousehold === "function" && isPointInRect(mouse.x, mouse.y, ob.x, ob.y, ob.w, ob.h)) {
    if (isHouseholdOpen()) closeHousehold();
    else openHousehold();
    return true;
  }
  const rb = getRecordsButtonRect(chatLogRight);
  if (typeof openRecords === "function" && isPointInRect(mouse.x, mouse.y, rb.x, rb.y, rb.w, rb.h)) {
    if (isRecordsOpen()) closeRecords();
    else openRecords();
    return true;
  }
  const gb = getGoalsButtonRect(chatLogRight);
  if (typeof openGoals === "function" && isPointInRect(mouse.x, mouse.y, gb.x, gb.y, gb.w, gb.h)) {
    if (isGoalsOpen()) closeGoals();
    else openGoals();
    return true;
  }
  const L = getGameSpeedLayout(chatLogRight);
  for (const b of L.buttons) {
    if (isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h)) {
      setGameSpeed(b.speed);
      return true;
    }
  }
  return false;
}
