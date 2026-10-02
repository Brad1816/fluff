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

// It's here: into the shopping bag
function deliverFood(d) {
  for (const it of d.items) for (let i = 0; i < it.qty; i++) shoppingBag.push({ name: it.name, data: null });
  if (typeof addUIMessage === "function") addUIMessage(`Your food delivery came: ${_foodItemsText(d.items)}. It's in your shopping bag (the toolbox).`);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `Food delivered: ${_foodItemsText(d.items)}` });
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
  if (_osIn(m, L.clear)) {
    foodBasket = {};
    return true;
  }
  return false;
}
