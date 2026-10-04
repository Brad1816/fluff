// ---------------------------------------------------------------------------
// Ordering food on the computer: FluffList's "Food" tab (right-click the
// Computer). Pick how many bags of each (the same foods and prices as Fluff
// Mart, no poison), then "Order". It comes FOOD_DELIVERY_HOURS game hours
// later, into your shopping bag (ShoppingBag.js: the tan buttons in the
// toolbox), with a message. Delivery costs FOOD_DELIVERY_FEE, free on
// orders of FOOD_FREE_DELIVERY or more.
// Saved: foodDeliveries (what's on its way). The basket isn't saved.
// ---------------------------------------------------------------------------

const FOOD_DELIVERY_HOURS = 2;
const FOOD_DELIVERY_FEE = 5;
const FOOD_FREE_DELIVERY = 100;
const FOOD_MAX_EACH = 20;

let foodDeliveries = []; // [{ items: [{ name, qty }], due, cost }]
let foodBasket = {}; // shop name -> how many
const foodDeliveryTicker = new Ticker(1);

// What's for sale: the food bags (and formula), not the rat poison
function onlineFoods() {
  return SPAWN_ACTIONS.filter((a) => a.isItem === "food_bag" && a.foodType !== "rat_poison");
}

function foodBasketTotal() {
  let goods = 0;
  let bags = 0;
  for (const a of onlineFoods()) {
    const q = foodBasket[a.name] || 0;
    goods += q * a.cost;
    bags += q;
  }
  const fee = bags && goods < FOOD_FREE_DELIVERY ? FOOD_DELIVERY_FEE : 0;
  return { goods, fee, total: goods + fee, bags };
}

function setFoodBasket(name, qty) {
  if (!onlineFoods().some((a) => a.name === name)) return false;
  foodBasket[name] = Math.max(0, Math.min(FOOD_MAX_EACH, Math.round(qty)));
  if (!foodBasket[name]) delete foodBasket[name];
  return true;
}

// Pay and send it on its way. Returns the delivery, or null
function placeFoodOrder() {
  const t = foodBasketTotal();
  if (!t.bags) return null;
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < t.total) {
    if (typeof addUIMessage === "function") addUIMessage("Not enough money for that order!");
    return null;
  }
  if (!free) money -= t.total;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  const d = { items: Object.entries(foodBasket).map(([name, qty]) => ({ name, qty })), due: now + FOOD_DELIVERY_HOURS * HOUR_LENGTH, cost: t.total };
  foodDeliveries.push(d);
  foodBasket = {};
  if (typeof addUIMessage === "function") addUIMessage(`Ordered ${_foodItemsText(d.items)} for $${t.total}. It'll be here in about ${FOOD_DELIVERY_HOURS} hours.`);
  return d;
}

function _foodItemsText(items) {
  const parts = items.map((i) => `${i.qty} ${i.name}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] || "nothing";
}

// It's here: small things into the shopping bag, big things set down in
// the room you chose (Items tab, ShoppingBag.js deliveryRoom)
function deliverFood(d) {
  let big = 0;
  for (const it of d.items) {
    const a = typeof _shopActionByName === "function" ? _shopActionByName(it.name) : null;
    const kind = a && typeof shopDeliveryKind === "function" ? shopDeliveryKind(a) : "bag";
    for (let i = 0; i < it.qty; i++) {
      if (kind === "deliver" && typeof deliverShopAction === "function") {
        if (deliverShopAction(a, { paid: true, scene: d.room })) big++;
      } else shoppingBag.push({ name: it.name, data: null });
    }
  }
  const where = big ? ` Big things are in ${typeof deliveryRoomName === "function" ? deliveryRoomName(d.room || deliveryScene()) : "your living room"}; the rest in your shopping bag (the toolbox).` : " It's in your shopping bag (the toolbox).";
  if (typeof addUIMessage === "function") addUIMessage(`Your delivery came: ${_foodItemsText(d.items)}.${where}`);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `Delivered: ${_foodItemsText(d.items)}` });
}

function updateFoodDeliveries(dt) {
  if (!foodDeliveryTicker.step(dt) || !foodDeliveries.length) return;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  const due = foodDeliveries.filter((d) => now >= d.due);
  if (!due.length) return;
  foodDeliveries = foodDeliveries.filter((d) => now < d.due);
  for (const d of due) deliverFood(d);
}
registerSystem("foodDeliveries", updateFoodDeliveries, 130);

// ---- The page (inside the orders screen, OrderBoard.js; 1160 x 690) ----

function foodShopLayout() {
  const rows = onlineFoods().map((a, i) => {
    const x = 20;
    const y = 90 + i * 76;
    return { a, x, y, w: 700, h: 68, minus: { x: x + 540, y: y + 18, w: 34, h: 32, label: "−" }, plus: { x: x + 640, y: y + 18, w: 34, h: 32, label: "+" } };
  });
  return { rows, order: { x: 760, y: 330, w: 380, h: 44, label: "Order" }, clear: { x: 760, y: 384, w: 380, h: 32, label: "Empty the basket", color: "rgba(0,0,0,0.35)", hover: "rgba(0,0,0,0.5)" } };
}

function drawFoodShopPage(c, theme, m) {
  const L = foodShopLayout();
  for (const r of L.rows) {
    c.fillStyle = theme.card;
    roundRectPath(c, r.x, r.y, r.w, r.h, 8);
    c.fill();
    canvasText(c, r.a.name, r.x + 16, r.y + 26, theme.cardText, "bold 16px Arial");
    canvasText(c, `$${r.a.cost} a bag`, r.x + 16, r.y + 48, theme.sub, "13px Arial");
    const about = String(r.a.desc || "").split(". ")[0].replace(/\.$/, "");
    canvasText(c, typeof fitText === "function" ? fitText(c, about, 370) : about, r.x + 140, r.y + 48, theme.sub, "italic 12px Arial");
    const q = foodBasket[r.a.name] || 0;
    _osButton(c, r.minus, m, theme, q <= 0);
    canvasText(c, String(q), r.x + 607, r.y + 41, theme.cardText, "bold 18px Arial", "center");
    _osButton(c, r.plus, m, theme, q >= FOOD_MAX_EACH);
  }
  // The basket
  const t = foodBasketTotal();
  c.fillStyle = theme.card;
  roundRectPath(c, 750, 90, 400, 340, 8);
  c.fill();
  canvasText(c, "Your basket", 770, 122, theme.cardText, "bold 18px Arial");
  let y = 150;
  const items = onlineFoods().filter((a) => foodBasket[a.name]);
  if (!items.length) canvasText(c, "Empty. Use + to add bags.", 770, y, theme.sub, "14px Arial");
  for (const a of items.slice(0, 6)) {
    canvasText(c, `${foodBasket[a.name]} × ${a.name}`, 770, y, theme.cardText, "14px Arial");
    canvasText(c, `$${foodBasket[a.name] * a.cost}`, 1130, y, theme.cardText, "14px Arial", "right");
    y += 22;
  }
  canvasText(c, t.bags ? (t.fee ? `Delivery $${t.fee} (free from $${FOOD_FREE_DELIVERY})` : "Delivery: free") : `Delivery $${FOOD_DELIVERY_FEE}, free from $${FOOD_FREE_DELIVERY}`, 770, 296, theme.sub, "13px Arial");
  canvasText(c, `Total $${t.total}`, 1130, 318, theme.cardText, "bold 16px Arial", "right");
  const short = t.total > money && !(typeof showDebugMenu !== "undefined" && showDebugMenu);
  _osButton(c, { ...L.order, label: t.bags ? `Order for $${t.total}` : "Order" }, m, theme, !t.bags || short);
  if (short && t.bags) canvasText(c, "Not enough money", 950, 438, "#c0392b", "bold 13px Arial", "center");
  else if (t.bags) _osButton(c, L.clear, m, theme);
  // A mystery carrier (Trade.js)
  if (typeof drawMysteryCard === "function") drawMysteryCard(c, theme, m);
  // On its way
  canvasText(c, "On its way", 760, 470, theme.cardText, "bold 16px Arial");
  if (!foodDeliveries.length) canvasText(c, `Nothing ordered. Deliveries take about ${FOOD_DELIVERY_HOURS} hours.`, 760, 494, theme.sub, "13px Arial");
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  foodDeliveries.slice(0, 6).forEach((d, i) => {
    const mins = Math.max(0, Math.ceil(((d.due - now) / HOUR_LENGTH) * 60));
    const when = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    canvasText(c, typeof fitText === "function" ? fitText(c, _foodItemsText(d.items), 280) : _foodItemsText(d.items), 760, 494 + i * 22, theme.cardText, "13px Arial");
    canvasText(c, `in ${when}`, 1140, 494 + i * 22, theme.sub, "13px Arial", "right");
  });
}

function handleFoodShopClick(m) {
  const L = foodShopLayout();
  for (const r of L.rows) {
    const q = foodBasket[r.a.name] || 0;
    if (_osIn(m, r.minus)) {
      setFoodBasket(r.a.name, q - 1);
      return true;
    }
    if (_osIn(m, r.plus)) {
      setFoodBasket(r.a.name, q + 1);
      return true;
    }
  }
  if (_osIn(m, L.order)) {
    placeFoodOrder();
    return true;
  }
  if (typeof handleMysteryCardClick === "function" && handleMysteryCardClick(m)) return true; // (Trade.js)
  if (_osIn(m, L.clear)) {
    foodBasket = {};
    return true;
  }
  return false;
}


// ---- The Items tab (playtest 7): cages, toys, beds... ----
// The same shop entries as Fluff Mart (not food, tools or clothes), the same
// prices. Small things come in your shopping bag, big things are set down in
// the room the "Deliver to" chip says (ShoppingBag.js). Same delivery time
// and fee as food. It shares the "on its way" list (foodDeliveries).
const ITEMS_PER_PAGE = 12;
let itemBasket = {}; // shop name -> how many
let itemShopPage = 0;

function onlineItems() {
  return SPAWN_ACTIONS.filter((a) => {
    if (!a.isItem || a.isItem === "food_bag" || a.isItem === "accessory") return false;
    if (typeof isToolAction === "function" && isToolAction(a)) return false;
    const kind = typeof shopDeliveryKind === "function" ? shopDeliveryKind(a) : "carry";
    return kind === "bag" || kind === "deliver";
  });
}

function itemBasketTotal() {
  let goods = 0;
  let n = 0;
  for (const a of onlineItems()) {
    const q = itemBasket[a.name] || 0;
    goods += q * a.cost;
    n += q;
  }
  const fee = n && goods < FOOD_FREE_DELIVERY ? FOOD_DELIVERY_FEE : 0;
  return { goods, fee, total: goods + fee, n };
}

function setItemBasket(name, qty) {
  if (!onlineItems().some((a) => a.name === name)) return false;
  itemBasket[name] = Math.max(0, Math.min(FOOD_MAX_EACH, Math.round(qty)));
  if (!itemBasket[name]) delete itemBasket[name];
  return true;
}

function placeItemOrder() {
  const t = itemBasketTotal();
  if (!t.n) return null;
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < t.total) {
    if (typeof addUIMessage === "function") addUIMessage("Not enough money for that order!");
    return null;
  }
  if (!free) money -= t.total;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  const room = typeof deliveryScene === "function" ? deliveryScene() : "INDOORS";
  const d = { items: Object.entries(itemBasket).map(([name, qty]) => ({ name, qty })), due: now + FOOD_DELIVERY_HOURS * HOUR_LENGTH, cost: t.total, room };
  foodDeliveries.push(d);
  itemBasket = {};
  if (typeof addUIMessage === "function") addUIMessage(`Ordered ${_foodItemsText(d.items)} for $${t.total}. It'll be here in about ${FOOD_DELIVERY_HOURS} hours.`);
  return d;
}

function itemShopLayout() {
  const all = onlineItems();
  const pages = Math.max(1, Math.ceil(all.length / ITEMS_PER_PAGE));
  itemShopPage = Math.max(0, Math.min(pages - 1, itemShopPage));
  const rows = all.slice(itemShopPage * ITEMS_PER_PAGE, (itemShopPage + 1) * ITEMS_PER_PAGE).map((a, i) => {
    const x = 20 + (i % 2) * 362;
    const y = 76 + Math.floor(i / 2) * 84;
    return { a, x, y, w: 354, h: 76, minus: { x: x + 238, y: y + 22, w: 32, h: 32, label: "−" }, plus: { x: x + 312, y: y + 22, w: 32, h: 32, label: "+" } };
  });
  return {
    rows,
    pages,
    prev: { x: 20, y: 588, w: 110, h: 34, label: "◀ Back" },
    next: { x: 634, y: 588, w: 110, h: 34, label: "More ▶" },
    room: { x: 760, y: 588, w: 380, h: 34, label: typeof deliveryChipLabel === "function" ? deliveryChipLabel() : "Deliver to: your living room", color: "rgba(40,60,90,0.75)", hover: "rgba(60,90,130,0.9)" },
    order: { x: 760, y: 330, w: 380, h: 44, label: "Order" },
    clear: { x: 760, y: 384, w: 380, h: 32, label: "Empty the basket", color: "rgba(0,0,0,0.35)", hover: "rgba(0,0,0,0.5)" },
  };
}

function drawItemShopPage(c, theme, m) {
  const L = itemShopLayout();
  for (const r of L.rows) {
    c.fillStyle = theme.card;
    roundRectPath(c, r.x, r.y, r.w, r.h, 8);
    c.fill();
    if (typeof drawShopActionIcon === "function") drawShopActionIcon(c, r.a, r.x + 36, r.y + 38, 50);
    canvasText(c, typeof fitText === "function" ? fitText(c, r.a.name, 150) : r.a.name, r.x + 72, r.y + 30, theme.cardText, "bold 15px Arial");
    canvasText(c, `$${r.a.cost}`, r.x + 72, r.y + 52, theme.sub, "13px Arial");
    const q = itemBasket[r.a.name] || 0;
    _osButton(c, r.minus, m, theme, q <= 0);
    canvasText(c, String(q), r.x + 291, r.y + 44, theme.cardText, "bold 18px Arial", "center");
    _osButton(c, r.plus, m, theme, q >= FOOD_MAX_EACH);
  }
  if (L.pages > 1) {
    _osButton(c, L.prev, m, theme, itemShopPage <= 0);
    _osButton(c, L.next, m, theme, itemShopPage >= L.pages - 1);
    canvasText(c, `Page ${itemShopPage + 1} of ${L.pages}`, 382, 611, theme.sub, "13px Arial", "center");
  }
  _osButton(c, L.room, m, theme);
  const t = itemBasketTotal();
  c.fillStyle = theme.card;
  roundRectPath(c, 750, 90, 400, 340, 8);
  c.fill();
  canvasText(c, "Your basket", 770, 122, theme.cardText, "bold 18px Arial");
  let y = 150;
  const items = onlineItems().filter((a) => itemBasket[a.name]);
  if (!items.length) canvasText(c, "Empty. Use + to add things.", 770, y, theme.sub, "14px Arial");
  for (const a of items.slice(0, 6)) {
    canvasText(c, `${itemBasket[a.name]} × ${a.name}`, 770, y, theme.cardText, "14px Arial");
    canvasText(c, `$${itemBasket[a.name] * a.cost}`, 1130, y, theme.cardText, "14px Arial", "right");
    y += 22;
  }
  canvasText(c, t.n ? (t.fee ? `Delivery $${t.fee} (free from $${FOOD_FREE_DELIVERY})` : "Delivery: free") : `Delivery $${FOOD_DELIVERY_FEE}, free from $${FOOD_FREE_DELIVERY}`, 770, 296, theme.sub, "13px Arial");
  canvasText(c, `Total $${t.total}`, 1130, 318, theme.cardText, "bold 16px Arial", "right");
  const short = t.total > money && !(typeof showDebugMenu !== "undefined" && showDebugMenu);
  _osButton(c, { ...L.order, label: t.n ? `Order for $${t.total}` : "Order" }, m, theme, !t.n || short);
  if (short && t.n) canvasText(c, "Not enough money", 950, 438, "#c0392b", "bold 13px Arial", "center");
  else if (t.n) _osButton(c, L.clear, m, theme);
  canvasText(c, "On its way", 760, 470, theme.cardText, "bold 16px Arial");
  if (!foodDeliveries.length) canvasText(c, `Nothing ordered. Deliveries take about ${FOOD_DELIVERY_HOURS} hours.`, 760, 494, theme.sub, "13px Arial");
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  foodDeliveries.slice(0, 6).forEach((d, i) => {
    const mins = Math.max(0, Math.ceil(((d.due - now) / HOUR_LENGTH) * 60));
    const when = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    canvasText(c, typeof fitText === "function" ? fitText(c, _foodItemsText(d.items), 280) : _foodItemsText(d.items), 760, 494 + i * 22, theme.cardText, "13px Arial");
    canvasText(c, `in ${when}`, 1140, 494 + i * 22, theme.sub, "13px Arial", "right");
  });
}

function handleItemShopClick(m) {
  const L = itemShopLayout();
  for (const r of L.rows) {
    const q = itemBasket[r.a.name] || 0;
    if (_osIn(m, r.minus)) return setItemBasket(r.a.name, q - 1), true;
    if (_osIn(m, r.plus)) return setItemBasket(r.a.name, q + 1), true;
  }
  if (L.pages > 1 && _osIn(m, L.prev)) return (itemShopPage = Math.max(0, itemShopPage - 1)), true;
  if (L.pages > 1 && _osIn(m, L.next)) return (itemShopPage = Math.min(L.pages - 1, itemShopPage + 1)), true;
  if (_osIn(m, L.room)) {
    if (typeof cycleDeliveryRoom === "function") cycleDeliveryRoom(1);
    return true;
  }
  if (_osIn(m, L.order)) {
    placeItemOrder();
    return true;
  }
  if (_osIn(m, L.clear)) {
    itemBasket = {};
    return true;
  }
  return false;
}
