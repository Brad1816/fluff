// ---------------------------------------------------------------------------
// "Not for sale": keep a fluffy from being sold by accident.
//
// f.notForSale (saved). Set it with the Keep button on the magnifying glass
// (by the price) or "Not for sale" in the right-click / Actions menu. A kept
// fluffy:
//   - is never picked by a buyer at the door (script.js)
//   - is left out of "Sell the lot" (Inspector.js mill trade)
//   - can't be sold with shift+click / sell mode (Horse.canBeSold): it says
//     why instead
// Orders are still yours to send: the order screen marks kept ones.
// ---------------------------------------------------------------------------

function isKeptFromSale(f) {
  return !!(f && f.notForSale);
}

function setKeptFromSale(f, on) {
  if (!f) return;
  f.notForSale = !!on;
  if (typeof addUIMessage === "function") {
    const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "It";
    addUIMessage(on ? `${name} is not for sale: buyers will pass it by.` : `${name} can be sold again.`);
  }
}

// The right-click / Actions menu (Tricks.js rightClickActions)
function keepActions(f) {
  if (!f || !f.isAlive || !f.adopted) return [];
  return f.notForSale
    ? [{ key: "keep", name: "Can be sold", sub: "lift the lock", run: (x) => setKeptFromSale(x, false) }]
    : [{ key: "keep", name: "Not for sale", sub: "buyers pass it by", run: (x) => setKeptFromSale(x, true) }];
}

// Sell mode on a kept one: say why nothing happened (UISelling.js)
function sayKeptFromSale(f) {
  if (typeof addUIMessage !== "function") return;
  const name = typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "It";
  addUIMessage(`${name} is marked Not for sale (the Keep button in its magnifying glass).`);
}

// The magnifying glass's Keep button, by the price: { x, y, w, h } or null
function inspectionKeepButton(f, L) {
  if (!f || !f.isAlive || !f.adopted) return null;
  const w = 104;
  return { x: L.listX + L.listW - 24 - w, y: L.listY + 18 + 72, w, h: 22 }; // (beside the warning chips)
}

function drawInspectionKeepButton(c, f, L) {
  const b = inspectionKeepButton(f, L);
  if (!b) return;
  const on = isKeptFromSale(f);
  const over = typeof mouse !== "undefined" && isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h);
  c.save();
  c.fillStyle = on ? "rgba(214, 160, 60, 0.9)" : over ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.1)";
  if (typeof fillRoundRect === "function") fillRoundRect(c, b.x, b.y, b.w, b.h, 12);
  else c.fillRect(b.x, b.y, b.w, b.h);
  c.font = "bold 12px Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "white";
  c.fillText(on ? "\u{1F512} Kept" : "Keep (no sale)", b.x + b.w / 2, b.y + b.h / 2 + 1);
  c.restore();
}

function clickInspectionKeepButton(f, L) {
  const b = inspectionKeepButton(f, L);
  if (!b || !isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h)) return false;
  setKeptFromSale(f, !isKeptFromSale(f));
  return true;
}
