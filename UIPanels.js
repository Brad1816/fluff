// ---------------------------------------------------------------------------
// Shared drawing for pop-up screens (goals, help, records, the vet, the
// morning report...), so a new screen looks the same with a few calls:
//
//   drawScreenPanel(c, L, { theme: "pink" })  dims the game and draws the
//                          rounded panel L = { x, y, w, h }
//   drawPanelTitle(c, "Breeding records", L)  the big title, top left
//   fillRoundRect(c, x, y, w, h, r, colour)   a rounded box (list rows...)
//   drawPanelButton(b, label, { enabled, on }) a glass button (greyed out
//                          when not enabled, highlighted when on)
//   fitText(c, text, maxW)   shortens text with "…" to fit a width
//
// Themes: "pink" (the default look), "green" (the vet).
// ---------------------------------------------------------------------------

const PANEL_THEMES = {
  pink: { fill: "#1f2433", stroke: "rgba(255, 214, 240, 0.8)", title: "#ffd6f0" },
  green: { fill: "#1f2b2a", stroke: "rgba(120, 220, 180, 0.8)", title: "#9ff0c8" },
};

function panelTheme(name = "pink") {
  return PANEL_THEMES[name] || PANEL_THEMES.pink;
}

function fillRoundRect(c, x, y, w, h, r, colour) {
  if (colour) c.fillStyle = colour;
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
  c.fill();
}

// Dim everything behind, then the panel. Leaves text settings ready
// (left aligned, alphabetic baseline, full opacity).
function drawScreenPanel(c, L, opts = {}) {
  const t = panelTheme(opts.theme);
  c.globalAlpha = 1;
  c.setLineDash([]);
  c.fillStyle = `rgba(0,0,0,${opts.dim ?? 0.55})`;
  c.fillRect(0, 0, width, height);
  fillRoundRect(c, L.x, L.y, L.w, L.h, opts.radius ?? 16, opts.fill || t.fill);
  c.strokeStyle = opts.stroke || t.stroke;
  c.lineWidth = 3;
  c.stroke();
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
}

function drawPanelTitle(c, text, L, opts = {}) {
  c.textAlign = opts.align || "left";
  c.textBaseline = "alphabetic";
  c.fillStyle = opts.color || panelTheme(opts.theme).title;
  c.font = opts.font || "bold 24px Arial";
  c.fillText(text, opts.align === "center" ? L.x + L.w / 2 : L.x + 24, L.y + (opts.y ?? 40));
}

function drawPanelButton(b, label, opts = {}) {
  if (typeof drawGlassButton !== "function") return;
  const enabled = opts.enabled !== false;
  const c = opts.ctx || ctx;
  c.save();
  if (!enabled) c.globalAlpha = 0.4;
  const style = { fontSize: opts.fontSize || 14, borderRadius: opts.radius || 8 };
  if (opts.on !== undefined) style.normalFill = opts.on ? "rgba(255, 170, 220, 0.35)" : "rgba(0, 0, 0, 0.15)";
  drawGlassButton(b.x, b.y, b.w, b.h, label, style);
  c.restore();
}

function fitText(c, text, maxW) {
  text = String(text);
  if (c.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 2 && c.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}
