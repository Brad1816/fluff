// ---------------------------------------------------------------------------
// Where you see customer orders (the orders themselves are in Orders.js):
//   - the Bounty Board on Shopping Street (click it)
//   - FluffList, the website on the Computer (a store item; right-click it)
// Both open the same orders screen, just styled differently. Also here: the
// little "orders due" reminder in the bottom right corner.
// ---------------------------------------------------------------------------

// The posted / active order lists (empty if the save data is odd)
function ordersList(name) {
  return (customerOrders && Array.isArray(customerOrders[name]) && customerOrders[name]) || [];
}

// ======================= The bounty board on Shopping Street ===============

function getBountyBoardRect() {
  return { x: 150, y: height * 0.15 + 105, w: 250, h: 150 };
}

function drawBountyBoard(c) {
  if (currentScene !== "SHOP_STREET") return;
  const b = getBountyBoardRect();
  c.save();
  // Posts
  c.fillStyle = "#5c4029";
  c.fillRect(b.x + 30, b.y + b.h - 10, 14, 60);
  c.fillRect(b.x + b.w - 44, b.y + b.h - 10, 14, 60);
  // Shadow
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.beginPath();
  c.ellipse(b.x + b.w / 2, b.y + b.h + 50, b.w / 2, 8, 0, 0, Math.PI * 2);
  c.fill();
  // Frame and cork
  c.fillStyle = "#6b4a2b";
  c.fillRect(b.x - 8, b.y - 30, b.w + 16, b.h + 38);
  c.fillStyle = "#c89b6d";
  c.fillRect(b.x, b.y, b.w, b.h);
  // Header plank
  c.fillStyle = "#8a5f3a";
  c.fillRect(b.x - 8, b.y - 30, b.w + 16, 26);
  c.fillStyle = "#fbe7b5";
  c.font = "bold 15px Arial";
  c.textAlign = "center";
  c.fillText("BOUNTY BOARD", b.x + b.w / 2, b.y - 11);
  // Paper notes, one per posted order
  const n = Math.min(ordersList("posted").length, 6);
  for (let i = 0; i < n; i++) {
    const nx = b.x + 12 + (i % 3) * 78;
    const ny = b.y + 10 + Math.floor(i / 3) * 70;
    c.save();
    c.translate(nx + 30, ny + 28);
    c.rotate(((i * 37) % 11 - 5) * 0.02);
    c.fillStyle = "#fdf6e3";
    c.fillRect(-30, -28, 60, 56);
    c.fillStyle = "rgba(0,0,0,0.35)";
    for (let l = 0; l < 4; l++) c.fillRect(-22, -12 + l * 10, 44 - (l % 2) * 12, 2);
    c.fillStyle = "#d9534f";
    c.beginPath();
    c.arc(0, -24, 4, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  if (n === 0) {
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.font = "italic 14px Arial";
    c.fillText("No orders right now", b.x + b.w / 2, b.y + b.h / 2 + 5);
  }
  c.restore();
}

function _isOverBountyBoard(px, py) {
  if (currentScene !== "SHOP_STREET") return false;
  const b = getBountyBoardRect();
  return px >= b.x - 8 && px <= b.x + b.w + 8 && py >= b.y - 30 && py <= b.y + b.h + 8;
}

// Click on the board: open the orders screen. Called from mousedown (UI.js).
function bountyBoardClick() {
  if (isGlobalDragging || !_isOverBountyBoard(mouse.x, mouse.y)) return false;
  openOrdersScreen("board");
  return true;
}

// Hover label for the board, and the orders reminder (called from script.js)
function drawOrdersOverlay(c) {
  if (isGlobalDragging || (typeof isAnyScreenOpen === "function" && isAnyScreenOpen())) return;
  if (_isOverBountyBoard(mouse.x, mouse.y)) {
    const b = getBountyBoardRect();
    c.save();
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = 3;
    c.strokeRect(b.x - 10, b.y - 32, b.w + 20, b.h + 42);
    c.font = "bold 14px Arial";
    c.textAlign = "center";
    c.lineWidth = 3;
    c.strokeStyle = "black";
    c.fillStyle = "white";
    const t = `Bounty board: ${ordersList("posted").length} order${ordersList("posted").length === 1 ? "" : "s"}. Click to look.`;
    c.strokeText(t, b.x + b.w / 2, b.y - 42);
    c.fillText(t, b.x + b.w / 2, b.y - 42);
    c.restore();
  }
}

// Bottom-right reminder of accepted orders
function drawOrdersHud(c) {
  if (typeof ctx !== "undefined" && c !== ctx) return;
  if (typeof isAnyScreenOpen === "function" && isAnyScreenOpen()) return;
  const active = ordersList("active");
  if (!active.length) return;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  const soonest = Math.min(...active.map((o) => o.dueAt - now));
  const text = `Orders: ${active.length} taken · next due in ${formatOrderTime(soonest)}`;
  c.save();
  c.font = "bold 13px Arial";
  const w = c.measureText(text).width + 20;
  const x = width - w - 12;
  const y = height - 38;
  c.fillStyle = soonest < 180 ? "rgba(160, 30, 30, 0.85)" : "rgba(0, 0, 0, 0.6)";
  c.fillRect(x, y, w, 26);
  c.fillStyle = "white";
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillText(text, x + 10, y + 13);
  c.restore();
}

// ======================= The Computer (a world item) =======================

class Computer {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      this.y = Math.max(this.y, sceneTop(this.scene) + 10);
    }
  }

  onDrop() {
    return handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  // (x, y) is the middle of its bottom edge
  hitTest(px, py) {
    return px >= this.x - 48 && px <= this.x + 48 && py >= this.y - 92 && py <= this.y;
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return {
      classType: "Computer",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {}

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    drawComputerPicture(ctx, this.x, this.y, 1, ordersList("posted").length);
    const busy = isGlobalDragging || (typeof isAnyScreenOpen === "function" && isAnyScreenOpen());
    if (!busy && this.scene === currentScene && this.hitTest(mouse.x, mouse.y)) {
      ctx.save();
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "black";
      ctx.fillStyle = "white";
      ctx.strokeText("Right-click to use", this.x, this.y - 100);
      ctx.fillText("Right-click to use", this.x, this.y - 100);
      ctx.restore();
    }
  }
}

// (x, y) = middle of the bottom; scale 1 = about 96x92px
function drawComputerPicture(c, x, y, scale, badge = 0) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  // Keyboard
  c.fillStyle = "#cfd4d8";
  c.fillRect(-44, -12, 88, 12);
  c.fillStyle = "#9aa2a8";
  for (let i = 0; i < 10; i++) c.fillRect(-40 + i * 8.2, -9, 6, 3);
  for (let i = 0; i < 9; i++) c.fillRect(-36 + i * 8.2, -4, 6, 3);
  // Stand
  c.fillStyle = "#6b7479";
  c.fillRect(-6, -30, 12, 16);
  c.fillRect(-18, -16, 36, 4);
  // Monitor
  c.fillStyle = "#2b3034";
  c.fillRect(-48, -92, 96, 64);
  c.fillStyle = "#3b6fb6";
  c.fillRect(-42, -86, 84, 52);
  c.fillStyle = "white";
  c.font = "bold 14px Arial";
  c.textAlign = "center";
  c.fillText("FluffList", 0, -62);
  c.font = "9px Arial";
  c.fillText("orders & wanted ads", 0, -48);
  if (badge > 0) {
    c.fillStyle = "#d9534f";
    c.beginPath();
    c.arc(38, -86, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "white";
    c.font = "bold 11px Arial";
    c.fillText(String(badge), 38, -82);
  }
  c.restore();
}

function drawComputerIcon(ctx, btnSize) {
  drawComputerPicture(ctx, 0, 15, 0.32, 0);
}

// ======================= The orders screen =================================

let ordersScreenMode = null; // null = closed, "board" or "web"
let ordersDeliverId = null; // the order we're picking a fluffy for
let ordersDeliverPage = 0;
let _ordersPortraits = {};

const OS_W = 1160;
const OS_H = 690;

const OS_THEMES = {
  board: {
    title: "Bounty Board",
    subtitle: "Shopping Street",
    bg: "#7a5234",
    header: "#5c3d24",
    card: "#fdf6e3",
    cardText: "#3a2a1a",
    sub: "#7a6a55",
    accent: "#b5452d",
  },
  web: {
    title: "FluffList",
    subtitle: "www.flufflist.com/orders",
    bg: "#e9eef5",
    header: "#3b6fb6",
    card: "#ffffff",
    cardText: "#1f2a36",
    sub: "#6a7888",
    accent: "#3b6fb6",
  },
};

function isOrdersScreenOpen() {
  return ordersScreenMode !== null;
}

function openOrdersScreen(mode = "board") {
  ordersScreenMode = mode;
  ordersDeliverId = null;
  ordersDeliverPage = 0;
  _ordersPortraits = {};
  return true;
}

function closeOrdersScreen() {
  ordersScreenMode = null;
  ordersDeliverId = null;
  _ordersPortraits = {};
}

function _osOrigin() {
  const s = Math.min(1, (width - 30) / OS_W, (height - 30) / OS_H);
  return { s, ox: (width - OS_W * s) / 2, oy: (height - OS_H * s) / 2 };
}

function _osMouse() {
  const { s, ox, oy } = _osOrigin();
  return { x: (mouse.x - ox) / s, y: (mouse.y - oy) / s };
}

function _osIn(m, b) {
  return m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;
}

function _osRR(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function _osText(c, text, x, y, color, font, align = "left") {
  c.font = font;
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(text, x, y);
}

function _osButton(c, b, m, theme, disabled = false) {
  const over = !disabled && _osIn(m, b);
  c.fillStyle = disabled ? "rgba(128,128,128,0.35)" : over ? b.hover || theme.accent : b.color || theme.accent;
  _osRR(c, b.x, b.y, b.w, b.h, 7);
  c.fill();
  if (over) {
    c.strokeStyle = "white";
    c.lineWidth = 2;
    c.stroke();
  }
  _osText(c, b.label, b.x + b.w / 2, b.y + b.h / 2 + 5, disabled ? "rgba(255,255,255,0.7)" : "white", "bold 14px Arial", "center");
}

// Where everything goes (so drawing and clicking agree)
function _ordersLayout() {
  const L = { close: { x: OS_W - 110, y: 18, w: 90, h: 34, label: "Close", color: "rgba(0,0,0,0.35)", hover: "rgba(0,0,0,0.55)" } };
  L.posted = ordersList("posted").slice(0, 6).map((order, i) => {
    const x = 20 + (i % 2) * 345;
    const y = 112 + Math.floor(i / 2) * 186;
    return { order, x, y, w: 333, h: 176, accept: { x: x + 333 - 104, y: y + 176 - 40, w: 92, h: 30, label: "Accept" } };
  });
  L.active = ordersList("active").map((order, i) => {
    const x = 720;
    const y = 112 + i * 186;
    return {
      order,
      x,
      y,
      w: 420,
      h: 176,
      deliver: { x: x + 420 - 118, y: y + 176 - 40, w: 106, h: 30, label: "Deliver" },
      giveUp: { x: x + 420 - 214, y: y + 176 - 40, w: 88, h: 30, label: "Give up", color: "#8a8a8a", hover: "#666" },
    };
  });
  return L;
}

function _drawOrderCard(c, card, theme, m, isActive) {
  const o = card.order;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  c.fillStyle = "rgba(0,0,0,0.25)";
  _osRR(c, card.x + 3, card.y + 4, card.w, card.h, 8);
  c.fill();
  c.fillStyle = theme.card;
  _osRR(c, card.x, card.y, card.w, card.h, 8);
  c.fill();
  if (ordersScreenMode === "board") {
    c.fillStyle = "#d9534f";
    c.beginPath();
    c.arc(card.x + card.w / 2, card.y + 8, 5, 0, Math.PI * 2);
    c.fill();
  }

  const x = card.x + 14;
  _osText(c, o.customer, x, card.y + 26, theme.cardText, "bold 16px Arial");
  _osText(c, `$${o.reward.toLocaleString()}`, card.x + card.w - 14, card.y + 27, "#1e8a3a", "bold 20px Arial", "right");
  _osText(c, `"${o.note}"`, x, card.y + 45, theme.sub, "italic 12px Arial");

  let y = card.y + 67;
  const matching = countFluffiesForOrder(o);
  for (const r of o.reqs) {
    const anyone = orderCandidates(o).some((f) => orderReqMatches(r, f));
    _osText(c, anyone ? "•" : "•", x, y, anyone ? "#1e8a3a" : theme.sub, "bold 15px Arial");
    _osText(c, orderReqLabel(r), x + 12, y, theme.cardText, "13px Arial");
    y += 17;
  }

  const footY = card.y + card.h - 28;
  if (isActive) {
    const left = o.dueAt - now;
    _osText(c, `Due in ${formatOrderTime(left)}`, x, footY, left < 180 ? "#c0392b" : theme.cardText, "bold 13px Arial");
  } else {
    _osText(c, `Leaves the board in ${formatOrderTime(o.leavesAt - now)}`, x, footY, theme.sub, "12px Arial");
  }
  _osText(
    c,
    matching ? `You have ${matching} that fit${matching === 1 ? "s" : ""}` : "None of yours fit yet",
    x,
    footY + 17,
    matching ? "#1e8a3a" : theme.sub,
    "bold 12px Arial",
  );

  if (isActive) {
    _osButton(c, card.giveUp, m, theme);
    _osButton(c, card.deliver, m, theme, matching === 0);
  } else {
    _osButton(c, card.accept, m, theme, ordersList("active").length >= ORDER_MAX_ACTIVE);
  }
}

function _ordersPortrait(f, size) {
  const key = f.id + ":" + size;
  if (_ordersPortraits[key] === undefined) _ordersPortraits[key] = drawFluffyPortraitCanvas(f, size);
  return _ordersPortraits[key];
}

const OS_PICK_ROWS = 7;

function _deliverLayout(order) {
  const px = 60;
  const py = 90;
  const pw = OS_W - 120;
  const list = orderCandidates(order).sort(
    (a, b) =>
      (fluffyFitsOrder(order, b) ? 1 : 0) - (fluffyFitsOrder(order, a) ? 1 : 0) ||
      order.reqs.filter((r) => orderReqMatches(r, b)).length - order.reqs.filter((r) => orderReqMatches(r, a)).length,
  );
  const pages = Math.max(1, Math.ceil(list.length / OS_PICK_ROWS));
  ordersDeliverPage = clamp(ordersDeliverPage, 0, pages - 1);
  const rows = list.slice(ordersDeliverPage * OS_PICK_ROWS, (ordersDeliverPage + 1) * OS_PICK_ROWS).map((f, i) => {
    const y = py + 70 + i * 62;
    return { f, x: px + 16, y, w: pw - 32, h: 56, send: { x: px + pw - 16 - 100, y: y + 13, w: 88, h: 30, label: "Send" } };
  });
  return {
    panel: { x: px, y: py, w: pw, h: OS_H - py - 30 },
    rows,
    pages,
    cancel: { x: px + pw - 110, y: py + 14, w: 94, h: 32, label: "Cancel", color: "#8a8a8a", hover: "#666" },
    prev: { x: px + 16, y: OS_H - 30 - 46, w: 60, h: 30, label: "▲" },
    next: { x: px + 86, y: OS_H - 30 - 46, w: 60, h: 30, label: "▼" },
  };
}

function _drawDeliverPicker(c, order, theme, m) {
  const D = _deliverLayout(order);
  c.fillStyle = "rgba(0,0,0,0.45)";
  c.fillRect(0, 0, OS_W, OS_H);
  c.fillStyle = theme.card;
  _osRR(c, D.panel.x, D.panel.y, D.panel.w, D.panel.h, 12);
  c.fill();
  _osText(c, `Deliver to ${order.customer}`, D.panel.x + 20, D.panel.y + 36, theme.cardText, "bold 22px Arial");
  _osText(c, `Pick one of your fluffies. Only ones with a tick for everything can go. Reward: $${order.reward.toLocaleString()}`, D.panel.x + 20, D.panel.y + 58, theme.sub, "13px Arial");
  _osButton(c, D.cancel, m, theme);

  if (!D.rows.length) {
    _osText(c, "You don't have any fluffies right now.", D.panel.x + D.panel.w / 2, D.panel.y + 200, theme.sub, "16px Arial", "center");
  }
  for (const row of D.rows) {
    const fits = fluffyFitsOrder(order, row.f);
    c.fillStyle = fits ? "rgba(30, 138, 58, 0.12)" : "rgba(0,0,0,0.05)";
    _osRR(c, row.x, row.y, row.w, row.h, 8);
    c.fill();
    const p = _ordersPortrait(row.f, 52);
    if (p) c.drawImage(p, row.x + 4, row.y + 2);
    _osText(c, fluffyNames[row.f.id] || "Fluffy", row.x + 64, row.y + 24, theme.cardText, "bold 15px Arial");
    _osText(c, `${row.f.gender === "male" ? "♂" : "♀"} ${row.f.growth < 1 ? "foal " : ""}${row.f.type}`, row.x + 64, row.y + 43, theme.sub, "12px Arial");
    // One tick or cross per requirement
    let cx = row.x + 210;
    c.font = "12px Arial";
    for (const r of order.reqs) {
      const ok = orderReqMatches(r, row.f);
      const label = `${ok ? "✓" : "✗"} ${orderReqLabel(r)}`;
      const w = c.measureText(label).width + 16;
      c.fillStyle = ok ? "rgba(30, 138, 58, 0.18)" : "rgba(192, 57, 43, 0.15)";
      _osRR(c, cx, row.y + 16, w, 24, 12);
      c.fill();
      _osText(c, label, cx + 8, row.y + 32, ok ? "#1e6b30" : "#a3342a", "bold 12px Arial");
      cx += w + 6;
    }
    if (fits) _osButton(c, row.send, m, theme);
  }
  if (D.pages > 1) {
    _osButton(c, D.prev, m, theme, ordersDeliverPage === 0);
    _osButton(c, D.next, m, theme, ordersDeliverPage >= D.pages - 1);
    _osText(c, `${ordersDeliverPage + 1} / ${D.pages}`, D.next.x + D.next.w + 14, D.next.y + 20, theme.sub, "13px Arial");
  }
}

function drawOrdersScreen(c) {
  if (!ordersScreenMode) return;
  if (typeof ctx !== "undefined" && c !== ctx) return; // screen pass only
  const theme = OS_THEMES[ordersScreenMode] || OS_THEMES.board;
  // An order being delivered might have expired meanwhile
  if (ordersDeliverId !== null && !ordersList("active").some((o) => o.id === ordersDeliverId)) ordersDeliverId = null;

  const { s, ox, oy } = _osOrigin();
  const m = _osMouse();
  const L = _ordersLayout();
  c.save();
  c.globalAlpha = 1;
  c.textBaseline = "alphabetic";
  c.setLineDash([]);
  c.fillStyle = "rgba(0,0,0,0.6)";
  c.fillRect(0, 0, width, height);
  c.translate(ox, oy);
  c.scale(s, s);

  c.fillStyle = theme.bg;
  _osRR(c, 0, 0, OS_W, OS_H, 14);
  c.fill();
  c.save();
  _osRR(c, 0, 0, OS_W, OS_H, 14);
  c.clip();
  c.fillStyle = theme.header;
  c.fillRect(0, 0, OS_W, 70);
  c.restore();

  _osText(c, theme.title, 24, 44, "white", "bold 28px Arial");
  _osText(c, theme.subtitle, 24 + (ordersScreenMode === "web" ? 150 : 190), 42, "rgba(255,255,255,0.75)", "14px Arial");

  // Reputation bar
  const rep = getOrderLevelInfo();
  const bx = 520;
  _osText(c, `${rep.name} (level ${rep.level})`, bx, 30, "white", "bold 15px Arial");
  const barW = 300;
  c.fillStyle = "rgba(255,255,255,0.25)";
  c.fillRect(bx, 38, barW, 12);
  const frac = rep.to === null ? 1 : (rep.points - rep.from) / (rep.to - rep.from);
  c.fillStyle = "#f7d774";
  c.fillRect(bx, 38, barW * clamp(frac, 0, 1), 12);
  _osText(c, rep.to === null ? `${rep.points} rep (top level!)` : `${rep.points} / ${rep.to} rep`, bx + barW + 10, 49, "white", "12px Arial");

  _osButton(c, L.close, m, theme);

  // Wanted (posted) and yours (accepted)
  const headColor = ordersScreenMode === "board" ? "#fbe7b5" : theme.cardText;
  _osText(c, `Wanted (${ordersList("posted").length})`, 20, 100, headColor, "bold 17px Arial");
  _osText(c, `Your orders (${ordersList("active").length}/${ORDER_MAX_ACTIVE})`, 720, 100, headColor, "bold 17px Arial");
  if (!L.posted.length)
    _osText(c, "Nothing wanted right now. New orders are posted every few minutes.", 20, 140, headColor, "14px Arial");
  if (!L.active.length)
    _osText(c, "Accept an order, then deliver a fluffy that fits before it's due.", 720, 140, headColor, "14px Arial");
  for (const card of L.posted) _drawOrderCard(c, card, theme, m, false);
  for (const card of L.active) _drawOrderCard(c, card, theme, m, true);

  _osText(
    c,
    `Filled ${customerOrders.filled || 0} · Missed ${customerOrders.missed || 0} · Filled orders raise your reputation; missing one costs ${ORDER_REP_MISSED}, giving up costs ${ORDER_REP_GIVE_UP}.`,
    OS_W / 2,
    OS_H - 14,
    headColor,
    "12px Arial",
    "center",
  );

  if (ordersDeliverId !== null) {
    const order = ordersList("active").find((o) => o.id === ordersDeliverId);
    if (order) _drawDeliverPicker(c, order, theme, m);
  }
  c.restore();
}

// Returns true if the click was used by the orders screen
function handleOrdersScreenClick() {
  if (!ordersScreenMode) return false;
  const m = _osMouse();

  // Picking a fluffy to deliver
  if (ordersDeliverId !== null) {
    const order = ordersList("active").find((o) => o.id === ordersDeliverId);
    if (!order) {
      ordersDeliverId = null;
      return true;
    }
    const D = _deliverLayout(order);
    if (_osIn(m, D.cancel)) {
      ordersDeliverId = null;
      return true;
    }
    if (D.pages > 1 && _osIn(m, D.prev)) {
      ordersDeliverPage = Math.max(0, ordersDeliverPage - 1);
      return true;
    }
    if (D.pages > 1 && _osIn(m, D.next)) {
      ordersDeliverPage = Math.min(D.pages - 1, ordersDeliverPage + 1);
      return true;
    }
    for (const row of D.rows) {
      if (fluffyFitsOrder(order, row.f) && _osIn(m, row.send)) {
        deliverCustomerOrder(order.id, row.f.id);
        ordersDeliverId = null;
        _ordersPortraits = {};
        return true;
      }
    }
    return true;
  }

  const L = _ordersLayout();
  if (_osIn(m, L.close)) {
    closeOrdersScreen();
    return true;
  }
  for (const card of L.posted) {
    if (_osIn(m, card.accept)) {
      acceptCustomerOrder(card.order.id);
      return true;
    }
  }
  for (const card of L.active) {
    if (_osIn(m, card.deliver)) {
      if (countFluffiesForOrder(card.order) > 0) {
        ordersDeliverId = card.order.id;
        ordersDeliverPage = 0;
      }
      return true;
    }
    if (_osIn(m, card.giveUp)) {
      giveUpCustomerOrder(card.order.id);
      return true;
    }
  }
  if (m.x < 0 || m.y < 0 || m.x > OS_W || m.y > OS_H) closeOrdersScreen();
  return true;
}
