// ---------------------------------------------------------------------------
// Goals: optional breeder milestones with small cash rewards.
//
// Open the list with the "Goals" button next to the speed buttons, or G.
// Each goal has a check (run every couple of seconds, updateGoals) and a
// reward paid once when it's first met. Finished goals are announced, and
// show up in the morning report's news.
//
// Some goals count things over the whole game (fluffies sold, litters born
// at home, wild fluffies brought home, best sale); those counts live in
// goalsState.stats and are fed by noteGoalEvent() calls (DayReport.js,
// Separation.js, Shows.js). Everything is saved (goalsState in SAVED_GAME_STATE).
//
// To add a goal: add an entry to GOALS with id, text, reward and
// check(stats) -> true when done (optionally progress(stats) -> "3/10").
// ---------------------------------------------------------------------------

function freshGoalsState() {
  return {
    done: {}, // id -> game time it was completed
    stats: { sold: 0, bestSale: 0, litters: 0, broughtHome: 0, showWins: 0, wishes: 0 },
  };
}

let goalsState = freshGoalsState();
let goalsOpen = false;
const goalsTicker = new Ticker(2);

function _yourFluffies() {
  return fluffies.filter((f) => f.adopted && f.isAlive);
}

function _bornAtHome(f) {
  return f.motherId !== null && f.motherId !== undefined && f.adopted;
}

function _parentsOf(f) {
  const mum =
    fluffies.find((x) => x.id === f.motherId) ||
    (typeof getFamilyRecord === "function" ? getFamilyRecord(f.motherId) : null);
  const dad =
    fluffies.find((x) => x.id === f.fatherId) ||
    (typeof getFamilyRecord === "function" ? getFamilyRecord(f.fatherId) : null);
  return { mum, dad };
}

const GOALS = [
  // Wishes (Wishes.js)
  { id: "first_wish", text: "Make a fluffy's wish come true", reward: 100, check: (s) => (s.wishes || 0) >= 1 },
  { id: "rehab", text: "Heal a Broken fluffy", reward: 300, check: (s) => (s.rehabs || 0) >= 1 },
  { id: "five_wishes", text: "Make 5 wishes come true", reward: 400, check: (s) => (s.wishes || 0) >= 5, progress: (s) => `${Math.min(5, s.wishes || 0)}/5` },
  {
    id: "first_litter",
    text: "Have a litter born at home",
    reward: 100,
    check: (s) => s.litters >= 1,
  },
  {
    id: "name_one",
    text: "Give one of your fluffies a name",
    reward: 50,
    // (a breeder's or old owner's name doesn't count - Names.js namedBy)
    check: () =>
      _yourFluffies().some((f) => (typeof namedBy === "function" ? namedBy(f) === "you" : !!fluffyNames[f.id])),
  },
  {
    id: "tricks_3",
    text: "Teach one fluffy 3 tricks (right-click it)",
    reward: 200,
    check: () => typeof knownTricks === "function" && _yourFluffies().some((f) => knownTricks(f).length >= 3),
  },
  {
    id: "sell_10",
    text: "Sell 10 fluffies",
    reward: 300,
    check: (s) => s.sold >= 10,
    progress: (s) => `${Math.min(10, s.sold)}/10`,
  },
  {
    id: "orders_3",
    text: "Fill 3 customer orders",
    reward: 300,
    check: () => customerOrders.filled >= 3,
    progress: () => `${Math.min(3, customerOrders.filled)}/3`,
  },
  {
    id: "litter_trained",
    text: "Fully litter-train a fluffy",
    reward: 300,
    check: () => _yourFluffies().some((f) => (f.pottyTraining || 0) >= 0.999),
  },
  {
    id: "delightful",
    text: 'Raise a "Delightful pet" (happy, trusting, unafraid)',
    reward: 400,
    check: () =>
      typeof temperamentMultiplier === "function" && _yourFluffies().some((f) => temperamentMultiplier(f) >= 1.2),
  },
  {
    id: "wild_home",
    text: "Bring a wild fluffy home from the park",
    reward: 100,
    check: (s) => s.broughtHome >= 1,
  },
  {
    id: "hidden_genes",
    text: "Breed a unicorn or pegasus from two earthy parents",
    reward: 500,
    check: () =>
      fluffies.some((f) => {
        if (!_bornAtHome(f) || (f.type !== "unicorn" && f.type !== "pegasus")) return false;
        const { mum, dad } = _parentsOf(f);
        return mum && dad && mum.type === "earthy" && dad.type === "earthy";
      }),
  },
  {
    id: "pattern",
    text: "Breed a foal with spots or stripes",
    reward: 500,
    check: () =>
      fluffies.some((f) => {
        if (!_bornAtHome(f) || typeof describeGenes !== "function") return false;
        const g = describeGenes(f.genes);
        return !!g && (g.spots >= 4 || g.stripes >= 4);
      }),
  },
  {
    id: "pure_white",
    text: "Breed a pure white foal",
    reward: 800,
    check: () => fluffies.some((f) => _bornAtHome(f) && f.getColorName && f.getColorName() === "wite"),
  },
  {
    id: "big_sale",
    text: "Sell a fluffy for $1,000 or more",
    reward: 500,
    check: (s) => s.bestSale >= 1000,
  },
  {
    id: "three_gens",
    text: "Own a fluffy, its mum and its grandmum at once",
    reward: 400,
    check: () => {
      const mine = new Map(_yourFluffies().map((f) => [f.id, f]));
      for (const f of mine.values()) {
        const mum = mine.get(f.motherId);
        if (mum && mine.has(mum.motherId)) return true;
      }
      return false;
    },
  },
  {
    id: "herd_leader",
    text: "Have one of your fluffies lead a herd",
    reward: 300,
    check: () =>
      typeof _herdList === "function" &&
      _herdList().some((h) => {
        const l = fluffies.find((f) => f.id === h.leaderId);
        return l && l.adopted && l.isAlive;
      }),
  },
  {
    id: "twenty",
    text: "Keep 20 fluffies at once",
    reward: 500,
    check: () => _yourFluffies().length >= 20,
    progress: () => `${Math.min(20, _yourFluffies().length)}/20`,
  },
  {
    id: "show_win",
    text: "Win a fluffy show",
    reward: 300,
    check: (s) => s.showWins >= 1,
  },
  {
    id: "orders_10",
    text: "Fill 10 customer orders",
    reward: 1000,
    check: () => customerOrders.filled >= 10,
    progress: () => `${Math.min(10, customerOrders.filled)}/10`,
  },
  {
    id: "trusted",
    text: "Become a Trusted breeder (reputation)",
    reward: 1500,
    check: () => typeof getOrderLevel === "function" && getOrderLevel() >= 3,
  },
  {
    id: "champion",
    text: "Raise a champion (3 show wins)",
    reward: 1000,
    check: () => typeof isChampion === "function" && _yourFluffies().some((f) => isChampion(f)),
  },
  {
    id: "alicorn",
    text: "Breed an alicorn",
    reward: 3000,
    check: () => fluffies.some((f) => _bornAtHome(f) && f.type === "alicorn"),
  },
  {
    id: "master",
    text: "Become a Master breeder (reputation)",
    reward: 5000,
    check: () => typeof getOrderLevel === "function" && getOrderLevel() >= 5,
  },
];

// Things counted over the whole game
function noteGoalEvent(kind, info = {}) {
  if (!goalsState || typeof goalsState !== "object") goalsState = freshGoalsState();
  const s = goalsState.stats || (goalsState.stats = freshGoalsState().stats);
  if (kind === "sold") {
    s.sold = (s.sold || 0) + 1;
    s.bestSale = Math.max(s.bestSale || 0, info.money || 0);
  } else if (kind === "litter") {
    s.litters = (s.litters || 0) + 1;
  } else if (kind === "broughtHome") {
    s.broughtHome = (s.broughtHome || 0) + 1;
  } else if (kind === "rehab") {
    s.rehabs = (s.rehabs || 0) + 1; // (Inspector.js)
  } else if (kind === "wish") {
    s.wishes = (s.wishes || 0) + 1;
  } else if (kind === "showPlace") {
    if (info.place === 1) s.showWins = (s.showWins || 0) + 1;
  }
}

function isGoalDone(id) {
  return !!(goalsState && goalsState.done && goalsState.done[id] !== undefined);
}

// script.js updateSimulation; checks every 2 seconds
function updateGoals(dt) {
  if (!goalsState || typeof goalsState !== "object") goalsState = freshGoalsState();
  const fresh = freshGoalsState();
  if (!goalsState.done) goalsState.done = {};
  if (!goalsState.stats) goalsState.stats = fresh.stats;
  for (const k in fresh.stats) if (goalsState.stats[k] === undefined) goalsState.stats[k] = 0;
  if (!goalsTicker.step(dt)) return; // every 2s (Systems.js)
  for (const g of GOALS) {
    if (isGoalDone(g.id)) continue;
    let met = false;
    try {
      met = g.check(goalsState.stats);
    } catch (e) {
      met = false;
    }
    if (!met) continue;
    goalsState.done[g.id] = typeof timePlayed === "number" ? timePlayed : 0;
    if (!showDebugMenu) money += g.reward;
    const text = `Goal complete: ${g.text} (+$${g.reward.toLocaleString()})`;
    if (typeof addUIMessage === "function") addUIMessage(text);
    if (typeof noteDayEvent === "function") noteDayEvent("news", { text });
  }
}

function goalsDoneCount() {
  return GOALS.filter((g) => isGoalDone(g.id)).length;
}

// ---- The list (screen pass only) ----

function openGoals() {
  goalsOpen = true;
}
function closeGoals() {
  goalsOpen = false;
}
function isGoalsOpen() {
  return goalsOpen;
}

function getGoalsLayout() {
  // Rows squeeze up a little on short windows so every goal fits; too
  // short even then (a phone), and they go in two columns
  const fits = Math.floor((height - 16 - 170) / GOALS.length) >= 22;
  const cols = fits ? 1 : 2;
  const perCol = Math.ceil(GOALS.length / cols);
  const colW = 680 - 30;
  const w = cols === 1 ? 680 : Math.min(width - 20, 30 + cols * colW);
  const rowH = Math.max(22, Math.min(27, Math.floor((height - 16 - 170) / perCol)));
  const h = 110 + perCol * rowH + 60;
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(Math.max(8, height / 2 - h / 2));
  return { x, y, w, h, rowH, cols, perCol, colW: cols === 1 ? w : (w - 30) / cols, close: { x: x + w / 2 - 70, y: y + h - 50, w: 140, h: 36 } };
}

function drawGoals(c) {
  if (!goalsOpen) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const L = getGoalsLayout();
  c.save();
  // Dimmed background and the panel (UIPanels.js)
  drawScreenPanel(c, L, { theme: "pink", dim: 0.5 });
  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  c.fillStyle = "#ffd6f0";
  c.font = "bold 24px Arial";
  c.fillText("Breeder goals", L.x + L.w / 2, L.y + 40);
  c.font = "14px Arial";
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.fillText(
    `${goalsDoneCount()} of ${GOALS.length} done · rewards are paid when a goal is met`,
    L.x + L.w / 2,
    L.y + 64,
  );

  GOALS.forEach((g, gi) => {
    const col = Math.floor(gi / L.perCol);
    const y = L.y + 100 + (gi % L.perCol) * L.rowH;
    const cx = L.x + col * L.colW; // (this column's left; its right is cx + colW + 30 in one column)
    const cr = L.cols === 1 ? L.x + L.w : cx + L.colW + 15;
    const done = isGoalDone(g.id);
    c.textAlign = "left";
    c.font = "bold 16px Arial";
    c.fillStyle = done ? "#9fe0a8" : "rgba(255,255,255,0.35)";
    c.fillText(done ? "✓" : "○", cx + 28, y);
    c.font = "15px Arial";
    c.fillStyle = done ? "rgba(255,255,255,0.55)" : "white";
    c.fillText(g.text, cx + 54, y);
    c.textAlign = "right";
    if (!done && g.progress) {
      c.fillStyle = "rgba(255,255,255,0.6)";
      c.font = "13px Arial";
      c.fillText(g.progress(goalsState.stats), cr - 110, y);
    }
    c.font = "bold 15px Arial";
    c.fillStyle = done ? "rgba(159,224,168,0.6)" : "#f7d774";
    c.fillText(`$${g.reward.toLocaleString()}`, cr - 28, y);
  });
  if (typeof drawGlassButton === "function")
    drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 16, borderRadius: 10 });
  c.restore();
}

// Mouse down (screen positions); swallows clicks while open
function handleGoalsClick() {
  if (!goalsOpen) return false;
  const L = getGoalsLayout();
  const inside = isPointInRect(mouse.x, mouse.y, L.x, L.y, L.w, L.h);
  if (!inside || isPointInRect(mouse.x, mouse.y, L.close.x, L.close.y, L.close.w, L.close.h)) closeGoals();
  return true;
}

// Pop-up screen list (Screens.js)
registerScreen({
  name: "goals",
  layer: 20,
  isOpen: () => goalsOpen,
  close: () => closeGoals(),
  draw: (c) => drawGoals(c),
  click: () => handleGoalsClick(),
});

// Runs every simulation step (Systems.js)
registerSystem("goals", updateGoals, 90);
