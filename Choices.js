// ---------------------------------------------------------------------------
// A question with a few buttons, in the middle of the screen: "Put Daisy
// out?", "Strays got into the backyard - keep them?". It pauses the game
// while it's up (Screens.js) and Esc picks the cancel choice.
//
//   openChoice({
//     title: "Put Daisy out?",
//     lines: ["She won't be yours any more...", ...],   (wrapped to fit)
//     buttons: [{ label: "Put her out", run: () => ..., kind: "danger" },
//               { label: "Keep her", run: () => ..., cancel: true }],
//   })
// kind: "danger" (red), "ok" (green) or plain. The button marked cancel
// (or the last one) is what Esc does. Only one question at a time: asking
// another while one is up queues it.
// ---------------------------------------------------------------------------

let choiceDialog = null;
const choiceQueue = [];

function openChoice(opts) {
  if (!opts || !Array.isArray(opts.buttons) || !opts.buttons.length) return false;
  if (choiceDialog) {
    choiceQueue.push(opts);
    return true;
  }
  choiceDialog = { title: "", lines: [], ...opts };
  return true;
}

function isChoiceOpen() {
  return !!choiceDialog;
}

// Pick a button (by index): closes the question, runs its action, then
// shows the next queued question
function pickChoice(i) {
  const d = choiceDialog;
  if (!d) return false;
  const b = d.buttons[i];
  choiceDialog = null;
  if (b && typeof b.run === "function") b.run();
  if (!choiceDialog && choiceQueue.length) choiceDialog = { title: "", lines: [], ...choiceQueue.shift() };
  return true;
}

function cancelChoice() {
  const d = choiceDialog;
  if (!d) return false;
  let i = d.buttons.findIndex((b) => b.cancel);
  if (i < 0) i = d.buttons.length - 1;
  return pickChoice(i);
}

function closeAllChoices() {
  choiceDialog = null;
  choiceQueue.length = 0;
}

function choiceLayout(c = typeof ctx !== "undefined" ? ctx : null) {
  const d = choiceDialog;
  const w = Math.min(520, width - 40);
  const lines = [];
  if (c) {
    c.save();
    c.font = "15px Arial";
    for (const l of d.lines || []) lines.push(...(typeof wrapText === "function" ? wrapText(c, String(l), w - 48) : [String(l)]));
    c.restore();
  } else lines.push(...(d.lines || []).map(String));
  const h = 74 + lines.length * 22 + 70;
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  const n = d.buttons.length;
  const gap = 10;
  const bw = Math.min(170, (w - 48 - gap * (n - 1)) / n);
  const total = n * bw + (n - 1) * gap;
  const buttons = d.buttons.map((b, i) => ({ x: x + w / 2 - total / 2 + i * (bw + gap), y: y + h - 56, w: bw, h: 38, b }));
  return { x, y, w, h, lines, buttons };
}

function drawChoice(c) {
  if (!choiceDialog) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const L = choiceLayout(c);
  c.save();
  drawScreenPanel(c, L, { theme: "pink", dim: 0.5 });
  c.fillStyle = "#ffd6f0";
  c.font = "bold 22px Arial";
  c.textAlign = "center";
  c.fillText(typeof fitText === "function" ? fitText(c, choiceDialog.title, L.w - 40) : choiceDialog.title, L.x + L.w / 2, L.y + 40);
  c.font = "15px Arial";
  c.fillStyle = "rgba(255,255,255,0.88)";
  L.lines.forEach((l, i) => c.fillText(l, L.x + L.w / 2, L.y + 74 + i * 22));
  for (const bt of L.buttons) {
    const kind = bt.b.kind;
    const normalFill = kind === "danger" ? "rgba(200, 60, 60, 0.55)" : kind === "ok" ? "rgba(60, 160, 90, 0.5)" : "rgba(0, 0, 0, 0.15)";
    const hoverFill = kind === "danger" ? "rgba(230, 80, 80, 0.75)" : kind === "ok" ? "rgba(80, 190, 110, 0.7)" : "rgba(255, 255, 255, 0.2)";
    drawGlassButton(bt.x, bt.y, bt.w, bt.h, bt.b.label, { fontSize: 15, borderRadius: 9, normalFill, hoverFill });
  }
  c.restore();
}

function handleChoiceClick() {
  if (!choiceDialog) return false;
  const L = choiceLayout();
  const i = L.buttons.findIndex((bt) => isPointInRect(mouse.x, mouse.y, bt.x, bt.y, bt.w, bt.h));
  if (i >= 0) pickChoice(i);
  return true; // (it's a question: the click goes nowhere else)
}

registerScreen({
  name: "choice",
  layer: 40,
  isOpen: () => isChoiceOpen(),
  close: () => cancelChoice(),
  draw: (c) => drawChoice(c),
  click: () => handleChoiceClick(),
  reset: () => closeAllChoices(),
});
